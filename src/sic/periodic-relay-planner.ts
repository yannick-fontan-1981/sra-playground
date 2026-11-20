import type { NativeExecution, NativePoint } from '../logos-engine/v6-native-types.ts';
import type { Direction } from './rectangular-contact-route.ts';
import type { PeriodicContactMove, PeriodicContactRoute, PeriodicPose } from './periodic-contact-route.ts';
import { createPeriodicPayloadProjection, periodicBodyGeometry } from './periodic-payload-motion.ts';

type BodyGeometry = { cells: number[][]; terrain: number[] };
type Approach = { carrier: number; at: number };
type Transfer = { to: number; from: Approach[] };
type Pulse = { to: number; source: number; at: number };
type Candidate = { pose: PeriodicPose; key: string; depth: number; previous?: Candidate; move?: PeriodicContactMove };

const unreachable = 1_000;
const selector: Direction = ['ACTION6', 0, 0];

function distanceToLinks(links: readonly number[][], goals: readonly number[]) {
  const from = Array.from({ length: links.length }, () => [] as number[]);
  links.forEach((next, i) => {
    for (const at of next) from[at]!.push(i);
  });
  const distances = new Uint16Array(links.length).fill(unreachable);
  const pending = [...new Set(goals)];
  for (const goal of pending) distances[goal] = 0;
  for (let read = 0; read < pending.length; read++) {
    const at = pending[read]!, next = distances[at]! + 1;
    for (const previous of from[at]!) {
      if (distances[previous] !== unreachable) continue;
      distances[previous] = next;
      pending.push(previous);
    }
  }
  return distances;
}

function periodicRelayHeuristic(route: PeriodicContactRoute, directions: readonly Direction[], geometry: ReturnType<typeof periodicBodyGeometry>) {
  const carriers = route.carriers!, payloads = route.payloads ?? [];
  const [width] = route.size, { shift, masks, footprints, terrain, sourceOffset, cargoOffset } = geometry;
  const cells = route.field.map((_, at) => at);
  const xy = (at: number): NativePoint => [at % width, Math.floor(at / width)];
  const bodies: BodyGeometry[] = footprints.map((cells, index) => ({ cells, terrain: terrain[index]! }));
  const touches = (a: readonly number[], b: readonly number[]) => a.some(cell => b.includes(cell));
  function launch(body: BodyGeometry, at: number, dx: number, dy: number) {
    const start = at;
    for (let step = 0; step < route.calibration.steps || body.terrain[at] === 1; step++) {
      const next = shift(at, dx, dy);
      if (next < 0 || body.terrain[next] === 2) break;
      at = next;
    }
    return body.terrain[at] === 0 ? at : start;
  }
  function launchApproaches(body: number, at: number, dx: number, dy: number): Approach[] {
    const footprint = bodies[body]!.cells[at]!;
    return carriers.flatMap((_, carrier) => {
      if (carrier === body) return [];
      const active = bodies[carrier]!;
      const anchors = new Set<number>();
      for (const cell of footprint) for (const [x, y] of masks[carrier]!) {
        const contact = shift(cell, -x, -y);
        const before = contact < 0 ? -1 : shift(contact, -dx, -dy);
        if (active.terrain[before] !== 0 || active.terrain[contact] !== 0 || touches(active.cells[before]!, footprint)) continue;
        anchors.add(before);
      }
      return [...anchors].map(at => ({ carrier, at }));
    });
  }
  const transfers = bodies.map((body, index) => cells.map(at => {
    if (body.terrain[at] !== 0) return [];
    return directions.flatMap(([, dx, dy]): Transfer[] => {
      const to = launch(body, at, dx, dy);
      if (to === at) return [];
      const from = launchApproaches(index, at, dx, dy);
      return from.length ? [{ to, from }] : [];
    });
  }));
  const walks = bodies.slice(0, sourceOffset).map(body => cells.map(at => {
    if (body.terrain[at] !== 0) return [];
    return directions.flatMap(([, x, y]) => {
      const next = shift(at, x, y);
      return body.terrain[next] === 0 ? [next] : [];
    });
  }));
  const walked = walks.map(graph => cells.map(goal => distanceToLinks(graph, [goal])));
  const sourcePlaces = route.sources.map((_, source) => cells.filter(at => bodies[sourceOffset + source]!.terrain[at] === 0));
  const contact = (body: number, at: number, source: number, from: number) => {
    const profile = route.rhythms[source]!, actuator = route.sources[source]!;
    const base = bodies[sourceOffset + source]!.cells[from]!, shape = bodies[body]!;
    if (touches(base, shape.cells[at]!)) return at;
    const sign = profile.side === 0 ? 1 : -1, dx = actuator.axis === 0 ? sign : 0, dy = actuator.axis === 1 ? sign : 0;
    const cross = actuator.size[1 - actuator.axis]!, along = sign === 1 ? actuator.size[actuator.axis] - 1 : 0;
    const start = at;
    for (let length = 1; length <= profile.reach!; length++) {
      const edge = along + length * sign;
      const hit = Array.from({ length: cross }, (_, c) =>
        actuator.axis === 0 ? shift(from, edge, c) : shift(from, c, edge));
      if (!touches(shape.cells[at]!, hit)) continue;
      const next = shift(at, dx, dy);
      if (next >= 0 && shape.terrain[next] !== 2 && !touches(base, shape.cells[next]!)) at = next;
    }
    if (at === start) return at;
    while (shape.terrain[at] === 1) {
      const next = shift(at, dx, dy);
      if (next < 0 || shape.terrain[next] === 2) return start;
      at = next;
    }
    return at;
  };
  const pulses = bodies.map((body, index) => cells.map(at => {
    if (!body || body.terrain[at] !== 0 || index >= sourceOffset && index < cargoOffset) return [];
    return route.sources.flatMap((_, source) => sourcePlaces[source]!.flatMap(from => {
      const to = contact(index, at, source, from);
      return to !== at ? [{ to, source, at: from }] : [];
    }));
  }));
  // Reverse links identify useful landings and pusher placements without choosing
  // a carrier in advance. The full projection checks each candidate with every
  // body, the selected carrier, and the current phases present.
  const cargoDistance = payloads.map(({ goal }, i) => distanceToLinks(cells.map(at => [
    ...transfers[cargoOffset + i]![at]!.map(edge => edge.to), ...pulses[cargoOffset + i]![at]!.map(edge => edge.to),
  ]), [goal]));
  const carrierDistance = carriers.map(({ goal }, i) => distanceToLinks(cells.map(at => [
    ...walks[i]![at]!, ...transfers[i]![at]!.map(edge => edge.to), ...pulses[i]![at]!.map(edge => edge.to),
  ]), [goal]));
  const setups = cargoDistance.map(() => new Map<number, Uint16Array[]>());
  function sourceSetups(payload: number, at: number) {
    const known = setups[payload]!, cached = known.get(at);
    if (cached) return cached;
    const dist = cargoDistance[payload]!;
    const options = pulses[cargoOffset + payload]![at]!.filter(pulse => dist[pulse.to]! < dist[at]!);
    const next = route.sources.map((_, source) => distanceToLinks(transfers[sourceOffset + source]!.map(edges => edges.map(e => e.to)),
      options.filter(option => option.source === source).map(option => option.at)));
    known.set(at, next);
    return next;
  }
  function approachCost(pose: PeriodicPose, options: readonly Approach[]) {
    let best = 100;
    for (const { carrier, at } of options) {
      const held = pose.carriers![carrier]!, cost = walked[carrier]![at]![held]!;
      const [x, y] = xy(at), [u, v] = xy(held);
      const next = cost === unreachable ? 22 + Math.abs(x - u) + Math.abs(y - v) : cost;
      best = Math.min(best, next + Number(carrier !== pose.selected));
    }
    return best;
  }
  return (pose: PeriodicPose) => {
    let estimates = 0, unfinished = false;
    for (const [i, payload] of payloads.entries()) {
      const at = pose.payloads![i]!;
      if (at === payload.goal) continue;
      unfinished = true;
      const dist = cargoDistance[i]!, degree = dist[at]!;
      let next = 120;
      for (const edge of transfers[cargoOffset + i]![at]!) {
        if (dist[edge.to]! < degree) next = Math.min(next, approachCost(pose, edge.from));
      }
      for (const [source, goals] of sourceSetups(i, at).entries()) {
        const from = pose.sources[source]!, setup = goals[from]!;
        if (setup === 0) next = Math.min(next, 1);
        if (setup >= unreachable) continue;
        for (const edge of transfers[sourceOffset + source]![from]!) {
          if (goals[edge.to]! >= setup) continue;
          next = Math.min(next, 15 * setup + approachCost(pose, edge.from));
        }
      }
      estimates += degree * 32 + next;
    }
    if (unfinished) return estimates;
    for (const [i, at] of pose.carriers!.entries()) estimates += carrierDistance[i]![at]!;
    return estimates;
  };
}

export async function planPeriodicRelay(route: PeriodicContactRoute, directions: readonly Direction[], limit: number,
  execution?: NativeExecution): Promise<PeriodicContactMove[]> {
  const geometry = periodicBodyGeometry(route);
  const estimate = periodicRelayHeuristic(route, directions, geometry);
  const project = createPeriodicPayloadProjection(route, true, geometry);
  const keyOf = (pose: PeriodicPose) => [pose.selected, ...pose.carriers!, ...pose.sources, ...(pose.payloads ?? []), ...pose.phases].join(',');
  const complete = (pose: PeriodicPose) => route.carriers!.every((body, i) => body.goal === pose.carriers![i])
    && (route.payloads ?? []).every((body, i) => body.goal === pose.payloads?.[i]);
  const frontier: Candidate[][] = [], lengths = new Map<string, number>();
  let first = Infinity, lastYield = execution?.now?.() ?? performance.now();
  function offer(pose: PeriodicPose, depth: number, previous?: Candidate, move?: PeriodicContactMove) {
    const key = keyOf(pose);
    if ((lengths.get(key) ?? Infinity) <= depth) return;
    lengths.set(key, depth);
    const score = depth + Math.round(estimate(pose) * 2);
    (frontier[score] ??= []).push({ pose, key, depth, previous, move });
    first = Math.min(first, score);
  }
  offer(route.pose, 0);
  for (let expanded = 0; expanded < 250_000; expanded++) {
    while (first < frontier.length && !frontier[first]?.length) first++;
    const node = frontier[first]?.pop();
    if (!node) return [];
    if (node.depth !== lengths.get(node.key)) continue;
    if (complete(node.pose) && node.move) {
      const path: PeriodicContactMove[] = [];
      for (let current: Candidate | undefined = node; current?.move; current = current.previous) path.push(current.move);
      return path.reverse();
    }
    if (node.depth >= limit) continue;
    const now = execution?.now?.() ?? performance.now();
    if (execution?.signal?.aborted || execution?.deadlineMs !== undefined && now >= execution.deadlineMs) return [];
    if (execution && now - lastYield >= 12) {
      await execution.yieldControl();
      lastYield = execution.now?.() ?? performance.now();
    }
    for (const direction of directions) {
      const move = project(node.pose, direction);
      if (move) offer(move.pose, node.depth + 1, node, move);
    }
    for (const [selected, actor] of node.pose.carriers!.entries()) {
      if (selected === node.pose.selected) continue;
      const pose = { ...node.pose, selected, actor };
      offer(pose, node.depth + 1, node, { direction: selector, pose, contact: null, automatic: [] });
    }
  }
  return [];
}
