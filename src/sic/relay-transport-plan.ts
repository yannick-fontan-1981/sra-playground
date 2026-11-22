import { components, walking, stepCell, type Board, type Step } from './contact-frontier-search.ts';
import { contactRayClear } from './compose-support-plan.ts';

export type RelayDesign = {
  launch: number;
  landing: number;
  first: number;
  second: number;
  remote: number;
  local: number;
};
export type RelayStep = Step & { peerFrom: number; peerTo: number; select?: boolean };
export type RelayPlan = { design: RelayDesign; steps: RelayStep[] };
type Limits = { maxDepth: number; maxNodes: number };
type PartMove = { actor: number; at: number; steps: Step[] };
const walkingOnly = (b: Board, actor: number, occupied: number[]) =>
  walking({ ...b, transport: undefined }, actor, occupied, new Set());
const distance = (a: number, c: number, width: number) =>
  Math.abs((a % width) - (c % width)) + Math.abs(Math.floor(a / width) - Math.floor(c / width));

// A push needs both a destination and a stance. This relaxation ignores other
// bodies only to discard permanently trapped placements before planning.
function pushMap(b: Board, start: number) {
  const distances = new Map([[start, 0]]);
  for (const [at, cost] of distances)
    for (const m of b.motors) {
      const dest = stepCell(b, at, m.delta);
      if (b.floor.has(dest) && b.floor.has(stepCell(b, at, -m.delta)) && !distances.has(dest))
        distances.set(dest, cost + 1);
    }
  return distances;
}
function place(
  b: Board,
  actor: number,
  at: number,
  goal: number,
  others: number[],
  role: string,
  budget: { remaining: number },
  limit: number,
): PartMove | null {
  const queue: PartMove[] = [{ actor, at, steps: [] }],
    best = new Map<string, number>();
  while (queue.length) {
    queue.sort(
      (u, v) =>
        u.steps.length + distance(u.at, goal, b.width) - v.steps.length - distance(v.at, goal, b.width),
    );
    const node = queue.shift()!;
    if (node.at === goal) return node;
    if (node.steps.length >= limit) continue;
    const paths = walkingOnly(b, node.actor, [...others, node.at]),
      key = node.at + '/' + Math.min(...paths.keys());
    if ((best.get(key) ?? Infinity) <= node.steps.length) continue;
    if (budget.remaining <= 0) return null;
    budget.remaining--;
    best.set(key, node.steps.length);
    for (const m of b.motors) {
      const stance = stepCell(b, node.at, -m.delta),
        dest = stepCell(b, node.at, m.delta),
        approach = paths.get(stance);
      if (!approach || !b.floor.has(dest) || others.includes(dest)) continue;
      queue.push({
        actor: node.at,
        at: dest,
        steps: [...node.steps, ...approach, { from: stance, to: node.at, role, op: m.op, placed: dest }],
      });
    }
  }
  return null;
}

// The destination determines a predecessor under a later setting. Intersect
// this with the arrivals of feasible earlier settings rather than maximizing
// distance globally. A helper must be able to reach the later setting.
export function relayTransportPlan(
  b: Board,
  peer: number,
  cargo: number,
  allows: (site: number) => boolean,
  select: (site: number) => string,
  limits: Limits,
): RelayPlan | null {
  if (!b.transport || b.goals.length !== 2 || cargo === b.pivotIndex || b.parts.length !== 2) return null;
  const regions = components(b),
    home = regions.get(b.actor),
    origin = b.parts[b.pivotIndex]!,
    part = b.parts[cargo]!;
  if (home === undefined || [origin, part, peer].some((at) => regions.get(at) !== home)) return null;
  const remote = b.goals.find((p) => regions.get(p) !== home),
    local = b.goals.find((p) => regions.get(p) === home);
  if (remote === undefined || local === undefined) return null;
  const warp = b.transport.land,
    pivots = pushMap(b, origin),
    launches = pushMap(b, part);
  const candidates: { d: RelayDesign; cost: number }[] = [];
  for (const [second] of pivots) {
    const landing = warp(remote, second);
    if (
      landing === null ||
      landing < 0 ||
      landing >= b.width * b.height ||
      b.floor.has(landing) ||
      !allows(landing) ||
      warp(landing, second) !== remote
    )
      continue;
    for (const [first, pushes] of pivots) {
      if (first === second) continue;
      const launch = warp(landing, first),
        load = launch === null ? undefined : launches.get(launch);
      if (launch === null || load === undefined || warp(launch, first) !== landing) continue;
      const reconfigure = pushMap(b, first).get(second);
      if (reconfigure !== undefined)
        candidates.push({
          d: { remote, local, first, second, landing, launch },
          cost: pushes + reconfigure + load,
        });
    }
  }
  candidates.sort((a, c) => a.cost - c.cost);
  const budget = { remaining: limits.maxNodes };
  for (const { d } of candidates)
    for (const cargoFirst of [true, false]) {
      const steps: RelayStep[] = [];
      let actor = b.actor,
        standby = peer,
        pivot = origin,
        box = part;
      const deposit = () => {
        const mark = transferKeepingActor(box, d.landing, [standby]);
        if (!mark) return false;
        append(mark);
        append([
          {
            from: actor,
            to: actor,
            op: b.transport!.op,
            role: b.roles[cargo],
            placed: d.landing,
            boundary: true,
            passenger: { source: box, pushes: [] },
          },
        ]);
        box = -1;
        return true;
      };
      const occupied = () => [standby, pivot, ...(box >= 0 ? [box] : [])];
      const append = (path: Step[]) => {
        for (const s of path) {
          steps.push({ ...s, peerFrom: standby, peerTo: standby });
          actor = s.to;
        }
      };
      const transferKeepingActor = (from: number, to: number, blocked: number[]) => {
        if (!contactRayClear(b, from, to, pivot, blocked) || blocked.includes(to)) return null;
        const paths = walkingOnly(b, actor, occupied());
        for (const [p, path] of paths) {
          if (p === to || !contactRayClear(b, from, to, pivot, [p])) continue;
          const own = warp(p, pivot);
          if (
            own === null ||
            (!b.floor.has(own) && own !== d.landing) ||
            !contactRayClear(b, p, own, pivot, [from, ...blocked])
          )
            return path;
        }
        return null;
      };
      const move = (isCargo: boolean, target: number) => {
        const res = place(
          b,
          actor,
          isCargo ? box : pivot,
          target,
          [standby, isCargo ? pivot : box].filter((p) => p >= 0),
          b.roles[isCargo ? cargo : b.pivotIndex]!,
          budget,
          limits.maxDepth - steps.length,
        );
        if (!res) return false;
        append(res.steps);
        if (isCargo) box = res.at;
        else pivot = res.at;
        return true;
      };
      if (
        !move(cargoFirst, cargoFirst ? d.launch : d.first) ||
        !move(!cargoFirst, cargoFirst ? d.first : d.launch) ||
        !deposit()
      )
        continue;
      const board = walkingOnly(b, actor, occupied()).get(d.launch);
      if (
        !board ||
        !contactRayClear(b, d.launch, d.landing, pivot, [standby]) ||
        (warp(standby, pivot) !== null && b.floor.has(warp(standby, pivot)!))
      )
        continue;
      append(board);
      append([{ from: actor, to: d.landing, op: b.transport.op }]);
      steps.push({
        from: actor,
        to: standby,
        op: select(standby),
        peerFrom: standby,
        peerTo: actor,
        select: true,
      });
      [actor, standby] = [standby, actor];
      if (!move(false, d.second)) continue;
      const fire = transferKeepingActor(standby, d.remote, []);
      if (!fire) continue;
      append(fire);
      steps.push({ from: actor, to: actor, op: b.transport.op, peerFrom: standby, peerTo: d.remote });
      standby = d.remote;
      const finish = walkingOnly(b, actor, occupied()).get(d.local);
      if (!finish) continue;
      append(finish);
      if (steps.length <= limits.maxDepth) return { design: d, steps };
    }
  return null;
}
