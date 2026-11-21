import type {
  NativeObservation,
  NativeRows,
} from "../logos-engine/v6-native-types.ts";
import {
  texture,
  poseKey,
  readGroup,
  rangeOf,
  fitReach,
  vector,
  destinations,
  type GroupPose,
  type RelativeModel,
  type RelativeMemory,
  type ReachLaw,
} from "./relative-motion-learning.ts";
import type { VisualLayout } from "./witnessed-preview-transfer.ts";
import type { XY } from "./access-terrain.ts";

export type RelativeTrial = {
  actor: string;
  partner: string;
  op: string;
  from: GroupPose;
  next: GroupPose;
  goal: number;
  remaining: number;
  desired?: {
    initial: XY;
    wanted: XY;
    piece: number;
    blockedAt: number;
    step: number;
    cause: "limit_of_range" | "blocked_translation";
    barrier?: "measured_wall" | "occupied_site" | "predicted_wall";
  };
  purpose: "reach_scoring_contact" | "test_unknown_route";
  law: ReachLaw;
  learned: string;
  contrast: string;
  contact: string;
  before: string;
  model: string;
  motorEvidence?: string;
  predictions: number;
  alternatives: number;
  usedMeasured: boolean;
  objective: {
    rigidRoute: boolean;
    alternatives: number;
    incompatible: XY[];
    targetOffsets: XY[];
  };
};
type Step = {
  op: string;
  pose: GroupPose;
  held: number[];
  cost: number;
  measured: boolean;
};
type Node = {
  pose: GroupPose;
  cost: number;
  depth: number;
  priority: number;
  parent: Node | null;
  step?: Step;
};
// Stable best-first queue. Planning only evaluates locally learned rules.
class Open {
  heap: Node[] = [];
  push(node: Node) {
    const heap = this.heap;
    let i = heap.length;
    heap.push(node);
    while (i) {
      const p = (i - 1) >> 1;
      if (heap[p]!.priority <= node.priority) break;
      heap[i] = heap[p]!;
      i = p;
    }
    heap[i] = node;
  }
  pop() {
    const heap = this.heap;
    if (!heap.length) return;
    const first = heap[0]!,
      end = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (2 * i + 1 < heap.length) {
        let j = 2 * i + 1;
        if (j + 1 < heap.length && heap[j + 1]!.priority < heap[j]!.priority)
          j++;
        if (end.priority <= heap[j]!.priority) break;
        heap[i] = heap[j]!;
        i = j;
      }
      heap[i] = end;
    }
    return first;
  }
}
function board(
  m: RelativeModel,
  rows: NativeRows,
  current: GroupPose,
  goals: Set<number>,
  law: ReachLaw,
) {
  const visited = new Set<number>([current.actor, ...current.pieces]),
    walls = new Set<number>();
  for (const [k, v] of Object.entries(m.playerTerrain))
    (v.open ? visited : walls).add(Number(k));
  for (const s of m.samples) {
    visited.add(s.q);
    if (s.moved) visited.add(s.destination);
  }
  // A failed carrier step can be due to a parked piece. Only a bare failed
  // destination is terrain evidence. A publicly reached cell overrides it.
  for (const p of visited) walls.delete(p);
  const good = new Set<string>(),
    bad = new Set<string>(),
    occupied = new Set([current.actor, ...current.pieces]);
  for (const [k, v] of Object.entries(m.playerTerrain)) {
    (v.open ? good : bad).add(v.texture);
    if (!occupied.has(Number(k)))
      (v.open ? good : bad).add(texture(m, rows, Number(k)));
  }
  for (const p of visited) if (!occupied.has(p)) good.add(texture(m, rows, p));
  const cells = new Int8Array(m.width * m.height);
  cells.fill(-1);
  for (let p = 0; p < cells.length; p++) {
    const t = texture(m, rows, p);
    if (!t || walls.has(p)) continue;
    if (visited.has(p) || goals.has(p) || good.has(t)) {
      cells[p] = 1;
      continue;
    }
    if (!bad.has(t)) cells[p] = 0;
  }
  // Separate a stopped object inside a confirmed influence range from an
  // inert one outside it. Only the former supplies evidence of a wall.
  const pieceWalls = new Set<number>();
  for (const s of m.samples)
    if (
      !s.moved &&
      s.clear &&
      !visited.has(s.destination) &&
      rangeOf(m, s.p, s.q, law.metric) <= law.radius
    )
      pieceWalls.add(s.destination);
  return { cells, pieceWalls };
}
function projected(
  m: RelativeModel,
  s: GroupPose,
  op: string,
  d: number,
  law: ReachLaw,
  cells: Int8Array,
  pieceWalls: Set<number>,
  optimistic: boolean,
): Step | null {
  const known = m.measured[poseKey(s) + "/" + op];
  if (known) {
    if (poseKey(known) === poseKey(s)) return null;
    const assignment = destinations(s.pieces, known.pieces, d);
    const held = assignment
      ? [...assignment].filter(([p, q]) => p === q).map(([p]) => p)
      : [];
    return { op, pose: known, held, cost: 1, measured: true };
  }
  const pass = (p: number) =>
    p >= 0 &&
    p < cells.length &&
    (cells[p] === 1 || (optimistic && cells[p] === 0));
  const target = s.actor + d;
  if (!pass(target)) return null;
  const next = new Set(s.pieces),
    held: number[] = [];
  for (const p of [...s.pieces].sort((x, y) => Math.sign(d) * (y - x))) {
    const q = p + d;
    if (
      rangeOf(m, s.actor, p, law.metric) > law.radius ||
      !pass(q) ||
      next.has(q) ||
      pieceWalls.has(q)
    ) {
      held.push(p);
      continue;
    }
    next.delete(p);
    next.add(q);
  }
  if (next.has(target)) return null;
  return {
    op,
    pose: { actor: target, pieces: [...next].sort((x, y) => x - y) },
    held,
    cost: cells[target] === 1 ? 1 : 4,
    measured: false,
  };
}
// Work backwards from the scored site before searching for controls. Each
// occupied piece needs a different traversable landing relative to that site.
function goalArrangements(
  m: RelativeModel,
  origin: GroupPose,
  goals: Set<number>,
  cells: Int8Array,
  ops: [string, number][],
  unknown: boolean,
) {
  const free = (p: number) =>
    p >= 0 &&
    p < cells.length &&
    (cells[p] === 1 || (unknown && cells[p] === 0));
  const offsets = new Map<number, Set<string>>();
  for (const g of goals) {
    const ends = new Set<string>();
    for (let p = 0; p < cells.length; p++)
      if (p !== g && free(p)) ends.add(vector(m, g, p).join());
    offsets.set(g, ends);
  }
  const initial = origin.pieces.map((p) => p - origin.actor),
    reachable = new Set([origin.actor]),
    queue = [origin.actor];
  for (const p of queue) {
    for (const [, d] of ops) {
      const q = p + d;
      if (
        !reachable.has(q) &&
        free(q) &&
        initial.every(
          (delta) =>
            free(q + delta) &&
            vector(m, q, q + delta).join() ===
              vector(m, origin.actor, origin.actor + delta).join(),
        )
      ) {
        reachable.add(q);
        queue.push(q);
      }
    }
  }
  return { offsets, reachable };
}
function route(
  m: RelativeModel,
  current: GroupPose,
  goal: Set<number>,
  ops: [string, number][],
  law: ReachLaw,
  cells: Int8Array,
  walls: Set<number>,
  limit: number,
  depth: number,
  optimistic: boolean,
  offsets: Map<number, Set<string>>,
) {
  const open = new Open(),
    costs = new Map([[poseKey(current), 0]]);
  const lower = (p: number) =>
    Math.min(...[...goal].map((g) => rangeOf(m, p, g, "diamond")));
  open.push({
    pose: current,
    cost: 0,
    depth: 0,
    priority: lower(current.actor),
    parent: null,
  });
  let examined = 0;
  while (open.heap.length && examined < limit) {
    const n = open.pop()!;
    if (n.cost !== costs.get(poseKey(n.pose))) continue;
    examined++;
    const permitted = offsets.get(n.pose.actor);
    if (
      n.depth &&
      permitted &&
      n.pose.pieces.every((p) =>
        permitted.has(vector(m, n.pose.actor, p).join()),
      )
    ) {
      const path: Step[] = [];
      let v: Node | null = n;
      while (v?.step) {
        path.push(v.step);
        v = v.parent;
      }
      return { path: path.reverse(), goal: n.pose.actor, examined };
    }
    if (n.depth >= depth) continue;
    for (const [op, d] of ops) {
      const step = projected(m, n.pose, op, d, law, cells, walls, optimistic);
      if (!step) continue;
      const cost = n.cost + step.cost,
        id = poseKey(step.pose);
      if ((costs.get(id) ?? Infinity) <= cost) continue;
      costs.set(id, cost);
      open.push({
        pose: step.pose,
        cost,
        depth: n.depth + 1,
        priority: cost + lower(step.pose.actor),
        parent: n,
        step,
      });
    }
  }
  return { path: [], goal: -1, examined };
}
export function chooseRelativePlan(
  mem: RelativeMemory,
  layout: VisualLayout,
  o: NativeObservation,
  rows: NativeRows,
  refs: Record<string, string>,
  limits: { maxNodes: number; maxDepth: number },
  requireObstruction = false,
): RelativeTrial | null {
  const models = Object.entries(mem.models)
    .filter(
      ([, m]) =>
        (!requireObstruction || !!m.obstruction) &&
        m.positive >= 2 &&
        m.contrasts > 0 &&
        !m.invalid &&
        Object.keys(m.moves).length >= 2,
    )
    .sort(
      ([, a], [, b]) => b.contrasts - a.contrasts || b.positive - a.positive,
    );
  let remaining = limits.maxNodes;
  for (const [key, m] of models) {
    const current = readGroup(m, layout);
    if (!current) continue;
    const goals = new Set(
      Object.entries(m.goals)
        .filter(([k]) => refs[k])
        .flatMap(([, sites]) => sites),
    );
    if (!goals.size || goals.has(current.actor)) continue;
    const ops = Object.entries(m.moves).filter(([op]) =>
      o.available_action_refs.includes(op),
    );
    const law = fitReach(m),
      { cells, pieceWalls } = board(m, rows, current, goals, law);
    for (const optimistic of [false, true]) {
      const aim = goalArrangements(m, current, goals, cells, ops, optimistic);
      const result = route(
        m,
        current,
        goals,
        ops,
        law,
        cells,
        pieceWalls,
        remaining,
        limits.maxDepth,
        optimistic,
        aim.offsets,
      );
      remaining -= result.examined;
      if (!result.path.length) {
        if (remaining <= 0) return null;
        continue;
      }
      let previous = current,
        desired: RelativeTrial["desired"];
      const identities = new Map(current.pieces.map((p) => [p, p]));
      for (const [i, step] of result.path.entries()) {
        const d = step.pose.actor - previous.actor,
          updated = new Map<number, number>();
        for (const p of previous.pieces) {
          const held = step.held.includes(p),
            id = identities.get(p)!;
          updated.set(held ? p : p + d, id);
          if (held && !desired) {
            desired = {
              initial: vector(m, current.actor, id),
              wanted: vector(m, step.pose.actor, p),
              piece: id,
              blockedAt: p + d,
              step: i + 1,
              ...(rangeOf(m, previous.actor, p, law.metric) > law.radius
                ? { cause: "limit_of_range" as const }
                : {
                    cause: "blocked_translation" as const,
                    barrier: step.pose.pieces.includes(p + d)
                      ? ("occupied_site" as const)
                      : m.playerTerrain[p + d]?.open === false
                        ? ("measured_wall" as const)
                        : ("predicted_wall" as const),
                  }),
            };
          }
        }
        previous = step.pose;
        identities.clear();
        for (const [pos, id] of updated) identities.set(pos, id);
      }
      const step = result.path[0]!,
        marker = Object.keys(m.goals).find((k) =>
          m.goals[k]!.includes(result.goal),
        )!;
      return {
        actor: m.actor,
        partner: m.partner,
        op: step.op,
        from: current,
        next: step.pose,
        model: key,
        goal: result.goal,
        remaining: result.path.length,
        desired,
        law,
        purpose: optimistic ? "test_unknown_route" : "reach_scoring_contact",
        learned: m.first,
        contrast: m.obstruction ?? m.differingRef!,
        contact: refs[marker]!,
        before: o.observation_ref,
        motorEvidence: m.inheritedMoves?.[step.op],
        predictions: limits.maxNodes - remaining,
        alternatives: goals.size,
        usedMeasured: step.measured,
        objective: {
          rigidRoute: aim.reachable.has(result.goal),
          alternatives: aim.offsets.get(result.goal)!.size,
          incompatible: current.pieces
            .map((p) => vector(m, current.actor, p))
            .filter((v) => !aim.offsets.get(result.goal)!.has(v.join())),
          targetOffsets: previous.pieces.map((p) => vector(m, result.goal, p)),
        },
      };
    }
  }
  return null;
}
