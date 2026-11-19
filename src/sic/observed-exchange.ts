import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { readTravelGrid, type ObservedTravel } from './observed-travel-frontier.ts';

type Cells = ReturnType<typeof readTravelGrid>['cells'];
type Move = { input: string; delta: NativePoint };
type Gate = { cell: string; mark: string; ink: number; opensWhenCovered: boolean };
type Layout = { marks: Record<string, number[]>; gates: Gate[]; exit?: string; wall: string };
type Pose = { actor: string; pieces: string[] };
type Prediction = { command: string; pose: Pose };
type Exchange = { ref: string; from: string; to: string; turns: string[] };
export type ObservedExchange = {
  body: string; layout: Layout; refs: string[]; supports: string[];
  turns: Record<string, NativePoint>; rejected: string[]; last: Exchange;
  lastTransport?: { ref: string; gate: string; control: string; support: string };
};
export type ExchangePlan = { command: NativeCommand; goal: 'test_transport' | 'reach_exit' | 'hold_control';
  subjects: string[]; focus: string; partner?: string; prediction: Prediction; evidence: string[] };

const point = (cell: string) => cell.split(',').map(Number) as [number, number];
const step = (cell: string, [dx, dy]: NativePoint) => {
  const [x, y] = point(cell);
  return `${x + dx},${y + dy}`;
};
const tileId = (pixels: readonly number[] | undefined) => pixels?.join(',') ?? '';
const isUniform = (pixels: readonly number[]) => pixels.every(ink => ink === pixels[0]);
const poseKey = ({ actor, pieces }: Pose) => `${actor}|${[...pieces].sort().join(';')}`;
const trialKey = (pose: Pose, input: string, supports: readonly string[]) => `${poseKey(pose)}|${input}|${supports.join(';')}`;
const turnKey = (tile: readonly number[], incoming: NativePoint) => `${tileId(tile)}|${incoming.join(',')}`;
const directions = (travel: ObservedTravel) => Object.entries(travel.moves).map(([input, move]) => ({ input, delta: move.delta }));

function markProfile(pixels: number[], pitch: number, floor: number) {
  if (pitch % 2 !== 1) return;
  const mid = Math.floor(pitch / 2), center = mid * pitch + mid, arm = pixels[mid]!;
  if (arm === floor || pixels[center] === floor) return;
  return pixels.every((ink, i) => i === center || ink === (i % pitch === mid || Math.floor(i / pitch) === mid ? arm : floor))
    ? [arm, pixels[center]!] : undefined;
}

function measureLayout(cells: Cells, actor: string, pitch: number, floor: number): Layout {
  const marks: Record<string, number[]> = {}, gates: Gate[] = [], exits: string[] = [];
  const materials = new Map<string, number>();
  const center = Math.floor(pitch * pitch / 2), corners = [0, pitch - 1, pitch * (pitch - 1), pitch * pitch - 1];
  for (const [cell, pixels] of cells) {
    if (cell === actor) continue;
    if (isUniform(pixels) && pixels[0] !== floor) {
      const id = tileId(pixels);
      materials.set(id, (materials.get(id) ?? 0) + 1);
    }
    const profile = markProfile(pixels, pitch, floor);
    if (profile) marks[cell] = profile;
  }
  const wall = [...materials].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  for (const [cell, pixels] of cells) {
    const rim = pixels[0]!;
    if (rim === floor || isUniform(pixels) || !corners.every(i => pixels[i] === rim)) continue;
    const compatible = Object.entries(marks).filter(([, [arm, accent]]) => rim === arm && (accent === arm || pixels.includes(accent!)));
    if (compatible.length === 1) {
      gates.push({ cell, mark: compatible[0]![0], ink: rim, opensWhenCovered: pixels[center] !== floor });
    } else if (pixels[center] === floor && Object.values(marks).every(([arm]) => arm !== rim)) exits.push(cell);
  }
  return { marks, gates, wall, ...(exits.length === 1 ? { exit: exits[0]! } : {}) };
}

function getPose(layout: Layout, body: string, actor: string, cells: Cells): Pose {
  const shape = body.split(',').map(Number), center = Math.floor(shape.length / 2);
  return { actor, pieces: [...cells].flatMap(([cell, pixels]) => {
    if (cell === actor) return [];
    if (tileId(pixels) === body) return [cell];
    const overlay = layout.marks[cell];
    return overlay && pixels[center] === shape[center] &&
      pixels.filter((ink, i) => ink === shape[i]).length * 2 > pixels.length &&
      pixels.every((ink, i) => ink === shape[i] || overlay.includes(ink)) ? [cell] : [];
  }) };
}

// The animation can witness intermediate segments when the endpoints are not collinear.
// Extract only an unambiguous path through changed strips between cell centers.
function visibleTrace(from: string, to: string, moves: readonly Move[], pitch: number, before: NativeRows, animation?: NativeRows) {
  if (!animation) return;
  const mid = Math.floor(pitch / 2);
  const queue: { cell: string; route: { cell: string; delta: NativePoint }[]; ink?: number }[] = [{ cell: from, route: [] }];
  const seen = new Set([from]);
  for (const { cell, route, ink } of queue) {
    if (cell === to) return route;
    const [x, y] = point(cell);
    for (const { delta } of moves) {
      const next = step(cell, delta);
      if (seen.has(next)) continue;
      const [nx, ny] = point(next);
      const strip = Array.from({ length: pitch - 1 }, (_, i) => i + 1)
        .filter(offset => (cell !== from || offset > mid) && (next !== to || pitch - offset > mid))
        .map(offset => {
          const xx = x + mid + Math.sign(nx - x) * offset, yy = y + mid + Math.sign(ny - y) * offset;
          return animation[yy]?.[xx] !== before[yy]?.[xx] ? animation[yy]?.[xx] : undefined;
        });
      const shade = ink ?? strip[0];
      if (!strip.length || shade === undefined || !strip.every(value => value === shade)) continue;
      seen.add(next); queue.push({ cell: next, route: [...route, { cell: next, delta }], ink: shade });
    }
  }
}

export function observeExchange(local: ObservedExchange | undefined, old: ObservedTravel | undefined, travel: ObservedTravel | undefined,
  before: NativeRows, after: NativeRows, command: NativeCommand, ref: string, frames?: readonly NativeRows[],
  expected?: Prediction): ObservedExchange | undefined {
  if (!old?.actor || !travel?.actor || old.grid.ink !== travel.grid.ink) return local;
  const delta = old.moves[command.action_ref]?.delta;
  if (!delta || !local && ((frames?.length ?? 0) < 2 || travel.actor === old.actor)) return local;
  const { grid } = old, first = readTravelGrid(before, grid).cells, second = readTravelGrid(after, grid).cells;
  const landing = first.get(travel.actor), replacement = second.get(old.actor);
  const body = local?.body ?? tileId(landing);
  const layout = local?.layout ?? measureLayout(first, old.actor, grid.pitch, grid.floor);
  const start = getPose(layout, body, old.actor, first), returned = getPose(layout, body, travel.actor, second);
  const deltaTo = (a: string, b: string) => {
    const [x, y] = point(a), [u, v] = point(b);
    return [Math.sign(u - x), Math.sign(v - y)].join(',');
  };
  const swapped = !!landing && !isUniform(landing) && !!replacement && start.pieces.includes(travel.actor)
    && returned.pieces.includes(old.actor) && start.pieces.length === returned.pieces.length
    && start.pieces.every(piece => piece === travel.actor || returned.pieces.includes(piece));
  let result = local;
  if (swapped) {
    const ray = visibleTrace(old.actor, travel.actor, directions(old), grid.pitch, before, frames?.[0]);
    const direct = deltaTo(old.actor, travel.actor) === deltaTo(old.actor, step(old.actor, delta));
    if (direct || ray?.length && ray[0]!.delta.every((value, i) => value === delta[i])) {
      const turns = { ...local?.turns }, measured: string[] = [];
      for (let i = 0; ray && i + 1 < ray.length; i++) {
        const { cell, delta: incoming } = ray[i]!, outgoing = ray[i + 1]!.delta, pixels = first.get(cell);
        if (pixels && incoming.some((value, j) => value !== outgoing[j])) {
          turns[turnKey(pixels, incoming)] = outgoing; measured.push(cell);
        }
      }
      result = { ...local, body, layout, turns, supports: local?.supports ?? [], rejected: local?.rejected ?? [],
        refs: [...(local?.refs ?? []).slice(-7), ref], last: { ref, from: old.actor, to: travel.actor, turns: measured } };
    }
  }
  if (!result) return;
  const transport = witnessedSupport(result, old, start, returned, first, second);
  if (transport) {
    return { ...result, supports: [...new Set([...result.supports, transport.support])],
      lastTransport: { ...transport, ref }, refs: [...result.refs.slice(-7), ref] };
  }
  if (expected && expected.command === command.action_ref && poseKey(expected.pose) !== poseKey(returned)) {
    const key = trialKey(start, command.action_ref, result.supports);
    result = { ...result, rejected: [...new Set([...result.rejected.slice(-127), key])] };
  }
  return result;
}

function witnessedSupport(local: ObservedExchange, travel: ObservedTravel, before: Pose, after: Pose, first: Cells, second: Cells) {
  if (before.pieces.length !== after.pieces.length + 1) return;
  for (const gate of local.layout.gates) {
    if (gate.opensWhenCovered || !before.pieces.includes(gate.cell) || after.pieces.includes(gate.cell)
      || before.actor === gate.mark || after.actor !== gate.mark) continue;
    for (const { delta } of directions(travel)) {
      const cell = step(gate.cell, delta), prior = first.get(cell), current = second.get(cell);
      if (prior && current && isUniform(prior) && prior[0] !== travel.grid.floor && tileId(prior) !== local.layout.wall
        && !isUniform(current) && cell !== after.actor && !after.pieces.includes(cell)) {
        return { gate: gate.cell, control: gate.mark, support: cell };
      }
    }
  }
}

export function assessExchange(local: ObservedExchange | undefined, travel: ObservedTravel | undefined,
  before: NativeRows, after: NativeRows, plan: ExchangePlan) {
  if (!local || !travel?.actor) return;
  const first = readTravelGrid(before, travel.grid).cells, second = readTravelGrid(after, travel.grid);
  if (second.pieces.length !== 1) return;
  const start = getPose(local.layout, local.body, travel.actor, first);
  const returned = getPose(local.layout, local.body, second.pieces[0]!, second.cells);
  const satisfied = plan.goal === 'test_transport' ? !!witnessedSupport(local, travel, start, returned, first, second.cells)
    : plan.goal === 'hold_control' && plan.subjects.every(cell => returned.pieces.includes(cell));
  return { matched: satisfied || poseKey(returned) === poseKey(plan.prediction.pose), satisfied };
}

export function chooseExchange(local: ObservedExchange | undefined, travel: ObservedTravel | undefined, rows: NativeRows): ExchangePlan | undefined {
  if (!local || !travel?.actor) return;
  const moves = directions(travel);
  if (moves.length !== 4 || new Set(moves.map(move => move.delta.join(','))).size !== 4) return;
  const { grid } = travel, { cells } = readTravelGrid(rows, grid), { layout } = local;
  const initial = getPose(layout, local.body, travel.actor, cells);
  if (!initial.pieces.length || initial.pieces.length > 5) return;
  const gates = new Map(layout.gates.map(gate => [gate.cell, gate]));
  const ground = new Set([...travel.visited, ...initial.pieces, ...Object.keys(layout.marks), ...local.supports]);
  if (layout.exit) ground.add(layout.exit);
  const holes = new Set<string>(), potentialRedirectors = new Map<string, number[]>();
  for (const [cell, pixels] of cells) {
    if (isUniform(pixels) && pixels[0] === grid.floor) ground.add(cell);
    else if (isUniform(pixels) && tileId(pixels) !== layout.wall) holes.add(cell);
    else if (!isUniform(pixels) && !ground.has(cell) && !gates.has(cell)) potentialRedirectors.set(cell, pixels);
  }
  const rejected = new Set(local.rejected);
  const covered = (pose: Pose, mark: string) => mark === pose.actor || pose.pieces.includes(mark);
  const canEnter = (cell: string, pose: Pose) => {
    const gate = gates.get(cell);
    return gate ? covered(pose, gate.mark) === gate.opensWhenCovered : ground.has(cell);
  };
  function targets(pose: Pose, delta: NativePoint) {
    const queue = [{ at: pose.actor, delta }], seen = new Set<string>(), matches = new Set<string>();
    for (const beam of queue) {
      const at = step(beam.at, beam.delta), key = `${at}:${beam.delta.join(',')}`;
      if (seen.has(key) || at === pose.actor) continue;
      seen.add(key);
      if (pose.pieces.includes(at)) { matches.add(at); continue; }
      if (canEnter(at, pose) || holes.has(at)) { queue.push({ at, delta: beam.delta }); continue; }
      const reflector = potentialRedirectors.get(at);
      if (!reflector) continue;
      const witnessed = local!.turns[turnKey(reflector, beam.delta)];
      const outgoing = witnessed ? [witnessed] : moves.filter(move => !!move.delta[0] !== !!beam.delta[0]).map(move => move.delta);
      for (const turn of outgoing) queue.push({ at, delta: turn });
    }
    return matches;
  }
  function project(pose: Pose, { input, delta }: Move): Pose[] {
    if (rejected.has(trialKey(pose, input, local!.supports))) return [];
    const hit = targets(pose, delta);
    if (hit.size) {
      return [...hit].map(target => ({ actor: target, pieces: pose.pieces.map(piece => piece === target ? pose.actor : piece) }));
    }
    const landing = step(pose.actor, delta);
    if (!canEnter(landing, pose)) return [];
    const next = { actor: landing, pieces: pose.pieces };
    return canEnter(landing, next) ? [next] : [];
  }
  const evidence = [...new Set([...local.refs, ...moves.map(move => travel.moves[move.input]!.ref)])];
  function path(goal: ExchangePlan['goal'], subjects: string[], check: (pose: Pose) => boolean): ExchangePlan | undefined {
    const queue: { pose: Pose; first?: Prediction }[] = [{ pose: initial }], seen = new Set([poseKey(initial)]);
    for (let i = 0; i < queue.length && i < 7500; i++) {
      const { pose, first } = queue[i]!;
      if (first && check(pose)) return { command: { action_ref: first.command, data: {} }, goal, subjects, focus: initial.actor,
        ...(initial.pieces.includes(first.pose.actor) ? { partner: first.pose.actor } : {}), prediction: first, evidence };
      for (const move of moves) for (const candidate of project(pose, move)) {
        const key = poseKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key); queue.push({ pose: candidate, first: first ?? { command: move.input, pose: candidate } });
      }
    }
  }
  for (const gate of layout.gates) {
    if (gate.opensWhenCovered || !moves.some(move => {
      const across = step(gate.cell, move.delta);
      return holes.has(across) && ground.has(step(across, move.delta));
    })) continue;
    const plan = path('test_transport', [gate.cell, gate.mark], pose => pose.pieces.includes(gate.cell) && pose.actor === gate.mark);
    if (plan) return plan;
  }
  if (layout.exit) {
    const plan = path('reach_exit', [layout.exit], pose => pose.actor === layout.exit);
    if (plan) return plan;
  }
  for (const gate of layout.gates) {
    if (!gate.opensWhenCovered || initial.pieces.includes(gate.mark)) continue;
    const plan = path('hold_control', [gate.mark], pose => pose.pieces.includes(gate.mark));
    if (plan) return plan;
  }
}
