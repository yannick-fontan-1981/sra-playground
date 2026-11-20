import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { add, diff, same, size, type XY } from './access-terrain.ts';
import { type OccupancyMemory } from './occupancy-programs.ts';
import type { Memory } from './preparation-experiments.ts';
import type { MechanismTrial } from './reconfigure-local-mechanism.ts';

export type Motor = { op: string; d: XY; refs: number[] };
export type ZoneRepeat = {
  tag: 'stagnation_same_zone';
  actor: string;
  op: string;
  from: XY;
  to: XY;
  zoneSize: number;
  connection: 'witnessed_walk' | 'observed_substrate';
  previous: number;
  revision: number;
  movementRefs: number[];
  walkRefs: number[];
  floor: number | null;
  route: XY[];
  sourceScene: number;
  returnScene: number;
};
export type LocalProgress = {
  last: ZoneRepeat | null;
  repeats: Record<string, ZoneRepeat>;
  attempts: Record<string, number>;
  active: MechanismTrial | null;
};
export const newLocalProgress = (): LocalProgress => ({
  last: null,
  repeats: {},
  attempts: {},
  active: null,
});
export const repeatKey = (s: number, q: string) => JSON.stringify([s, q]);
export function motorsFor(occ: OccupancyMemory, p: string, except?: string): Motor[] {
  const by = new Map<string, Map<string, Motor>>();
  for (const e of occ.edges) {
    if (e.unstable || e.op === except || e.op.startsWith('ACTION6:')) continue;
    const a = occ.layouts[e.s]?.[p],
      b = occ.layouts[e.t]?.[p];
    if (!a || !b) continue;
    const d = diff(b, a);
    if ((d[0] === 0) === (d[1] === 0)) continue;
    const choices = by.get(e.op) ?? new Map<string, Motor>();
    by.set(e.op, choices);
    const v = choices.get(d.join()) ?? { op: e.op, d, refs: [] };
    v.refs.push(e.ref);
    choices.set(d.join(), v);
  }
  const picked = [...by.values()].map(
    (v) => [...v.values()].sort((a, b) => b.refs.length - a.refs.length || size(a.d) - size(b.d))[0]!
  );
  return picked.filter(
    (v) => !picked.some((other) => (v.d[0] === 0) === (other.d[0] === 0) && size(other.d) < size(v.d))
  );
}
function witnessedWalk(occ: OccupancyMemory, p: string, from: XY, to: XY, motors: Motor[]) {
  const routes = new Map<string, { next: XY; ref: number }[]>();
  for (const e of occ.edges) {
    const x = occ.layouts[e.s]?.[p],
      y = occ.layouts[e.t]?.[p];
    if (e.unstable || !x || !y || !motors.some((v) => v.op === e.op && same(diff(y, x), v.d))) continue;
    const list = routes.get(x.join()) ?? [];
    list.push({ next: y, ref: e.ref });
    routes.set(x.join(), list);
  }
  const queue = [from],
    parent = new Map<string, { prev: XY; ref: number }>();
  for (const x of queue)
    for (const step of routes.get(x.join()) ?? []) {
      const k = step.next.join();
      if (same(step.next, from) || parent.has(k)) continue;
      parent.set(k, { prev: x, ref: step.ref });
      queue.push(step.next);
    }
  if (!same(from, to) && !parent.has(to.join())) return null;
  const refs = [];
  let v = to;
  while (!same(v, from)) {
    const s = parent.get(v.join())!;
    refs.push(s.ref);
    v = s.prev;
  }
  return { refs: refs.reverse(), count: queue.length };
}
export function zoneFloor(
  occ: OccupancyMemory,
  p: string,
  o: NativeObservation,
  rows: NativeRows,
  motors: Motor[],
  start: XY
) {
  const prior = new Set(Object.keys(occ.visited[p] ?? {})),
    ground = new Map<number, number>();
  const small = o.entities.filter((e) => e.area <= (rows.length * rows[0]!.length) / 12);
  const signature = new Set(
    small.flatMap((e) => e.mask.map(([dx, dy]) => [e.bbox[0] + dx, e.bbox[1] + dy].join()))
  );
  const ink = (s: XY) => rows[Math.floor(s[1] / 2)]?.[Math.floor(s[0] / 2)];
  for (const point of prior) {
    const xy = point.split(',').map(Number) as XY,
      c = ink(xy);
    if (c === undefined || signature.has([Math.floor(xy[0] / 2), Math.floor(xy[1] / 2)].join())) continue;
    ground.set(c, (ground.get(c) ?? 0) + 1);
  }
  const best = [...ground].sort((a, b) => b[1] - a[1])[0],
    floor = best && best[1] > [...ground.values()].reduce((a, b) => a + b, 0) - best[1] ? best[0] : null;
  const width = 2 * rows[0]!.length,
    height = 2 * rows.length;
  const open = (q: XY) =>
    q[0] >= 0 &&
    q[1] >= 0 &&
    q[0] < width &&
    q[1] < height &&
    (prior.has(q.join()) || (floor !== null && ink(q) === floor));
  const component = new Set([start.join()]),
    queue = [start],
    parent = new Map<string, XY>();
  for (const v of queue)
    for (const m of motors) {
      const next = add(v, m.d);
      if (open(next) && !component.has(next.join())) {
        component.add(next.join());
        parent.set(next.join(), v);
        queue.push(next);
      }
    }
  return {
    open,
    component,
    floor,
    path(end: XY) {
      if (!component.has(end.join())) return [];
      const route = [end];
      let v = end;
      while (!same(v, start)) {
        v = parent.get(v.join())!;
        route.push(v);
      }
      return route.reverse();
    },
  };
}
function enablesKnownUse(occ: OccupancyMemory, s: number, t: number, repeat: string) {
  if (s === t) return false;
  for (const use of occ.edges) {
    if (use.s !== t || use.unstable || use.op === repeat) continue;
    const control = occ.observed[s + '/' + use.op];
    if (control === undefined || control < 0) continue;
    const before = occ.layouts[s]!,
      bare = occ.layouts[control]!,
      after = occ.layouts[t]!,
      used = occ.layouts[use.t]!;
    for (const [role, at] of Object.entries(after)) {
      if (
        used[role] &&
        !same(at, used[role]!) &&
        before[role] &&
        bare[role] &&
        same(before[role]!, bare[role]!)
      )
        return true;
    }
  }
  return false;
}
export function knownLocalRepeat(m: Memory, s: number, op: string) {
  const prior = m.localProgress?.repeats[repeatKey(s, op)],
    occ = m.occupancy;
  if (
    !prior ||
    !occ ||
    occ.observed[s + '/' + op] !== prior.returnScene ||
    enablesKnownUse(occ, s, prior.returnScene, op)
  )
    return null;
  return prior;
}
export function measureLocalRepeat(
  m: Memory,
  s: number,
  t: number,
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows,
  op: string,
  focus?: string
): ZoneRepeat | null {
  const occ = m.occupancy;
  if (
    !occ ||
    b.level_epoch !== a.level_epoch ||
    b.state !== a.state ||
    a.state === 'WIN' ||
    b.levels_completed !== a.levels_completed ||
    occ.observed[s + '/' + op] !== t
  )
    return null;
  const previous = occ.edges.find((e) => e.s === s && e.t === t && e.op === op && !e.unstable);
  if (
    !previous ||
    previous.ref >= a.revision ||
    a.available_action_refs.some((q) => !b.available_action_refs.includes(q)) ||
    enablesKnownUse(occ, s, t, op)
  )
    return null;
  const first = occ.layouts[s]!,
    last = occ.layouts[t]!;
  const options = Object.keys(first)
    .filter((p) => last[p] && occ.visited[p])
    .map((p) => {
      const motors = motorsFor(occ, p, op),
        n = new Set(motors.map((v) => v.d.join())).size;
      return {
        p,
        motors,
        score:
          n >= 2 || same(first[p]!, last[p]!)
            ? Object.keys(occ.visited[p]!).length * Math.max(1, Math.min(n, 4))
            : 0,
      };
    })
    .filter((x) => x.score)
    .sort(
      (a, b) =>
        Number(!same(first[b.p]!, last[b.p]!)) - Number(!same(first[a.p]!, last[a.p]!)) ||
        Number(b.p === focus) - Number(a.p === focus) ||
        b.score - a.score
    )
    .slice(0, 1);
  for (const { p, motors } of options) {
    const from = first[p]!,
      to = last[p]!,
      walk = witnessedWalk(occ, p, from, to, motors);
    let zoneSize = walk?.count ?? 0,
      floor: number | null = null;
    let route: XY[] = [];
    if (!walk) {
      const model = zoneFloor(occ, p, b, rows, motors, from);
      if (model.floor === null || !model.component.has(to.join())) continue;
      zoneSize = model.component.size;
      floor = model.floor;
      route = model.path(to);
    }
    if (b.frame_hash !== a.frame_hash && motors.length) {
      const substrate = floor ?? zoneFloor(occ, p, b, rows, motors, from).floor;
      if (substrate !== null) {
        const reachable = (board: NativeRows, start: XY) => {
          const found = new Set([start.join()]),
            queue = [start];
          for (const v of queue)
            for (const motor of motors) {
              const candidate = add(v, motor.d),
                key = candidate.join();
              if (
                found.has(key) ||
                candidate[0] < 0 ||
                candidate[1] < 0 ||
                candidate[0] >= 2 * board[0]!.length ||
                candidate[1] >= 2 * board.length
              )
                continue;
              if (
                !same(candidate, from) &&
                !same(candidate, to) &&
                board[Math.floor(candidate[1] / 2)]![Math.floor(candidate[0] / 2)] !== substrate
              )
                continue;
              found.add(key);
              queue.push(candidate);
            }
          return found;
        };
        const original = reachable(rows, from),
          future = reachable(next, to);
        if ([...future].some((v) => !original.has(v))) return null;
      }
    }
    return {
      tag: 'stagnation_same_zone',
      actor: p,
      op,
      from,
      to,
      zoneSize,
      connection: walk ? 'witnessed_walk' : 'observed_substrate',
      previous: previous.ref,
      revision: a.revision,
      movementRefs: motors.map((v) => v.refs[0]!),
      walkRefs: walk?.refs ?? [],
      floor,
      route,
      sourceScene: s,
      returnScene: t,
    };
  }
  return null;
}
