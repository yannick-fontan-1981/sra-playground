import type {
  NativeObservation,
  NativeCommand,
  NativeRows,
  NativeEntity,
} from '../logos-engine/v6-native-types.ts';
import type { Memory, Experiment } from './preparation-experiments.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
export type Placement = {
  actor: string;
  target: string;
  x: number;
  y: number;
  b: string;
  origin: number;
  direct: string;
  refs: number[];
  steps: number;
};
const pose = (x: number, y: number) => x + ',' + y;
const placeKey = (g: Placement) => [g.actor, g.target, g.x, g.y, g.b].join('/');
type Vector = { op: string; dx: number; dy: number; count: number; ref: number };
function controls(m: Memory, o: NativeObservation) {
  const present = new Map(o.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e]));
  const data = new Map<string, Map<string, Map<string, Vector>>>();
  for (const edge of m.edges)
    if (edge.stable)
      for (const d of edge.effect.moves) {
        if (!present.has(d.actor)) continue;
        const actor = data.get(d.actor) ?? new Map<string, Map<string, Vector>>(),
          op = actor.get(edge.cmd) ?? new Map<string, Vector>();
        const key = pose(d.dx, d.dy),
          v = op.get(key) ?? { op: edge.cmd, dx: d.dx, dy: d.dy, count: 0, ref: edge.ref };
        v.count++;
        op.set(key, v);
        actor.set(edge.cmd, op);
        data.set(d.actor, actor);
      }
  const result = [];
  for (const [actor, ops] of data) {
    const model = [...ops.values()].map(
      (map) =>
        [...map.values()].sort(
          (a, b) => b.count - a.count || Math.abs(a.dx) + Math.abs(a.dy) - Math.abs(b.dx) - Math.abs(b.dy)
        )[0]!
    );
    if (model.length >= 2 && new Set(model.map((v) => pose(v.dx, v.dy))).size >= 2)
      result.push({ entity: present.get(actor)!, model });
  }
  return result.sort(
    (a, b) =>
      b.model.length - a.model.length ||
      b.model.reduce((n, v) => n + v.count, 0) - a.model.reduce((n, v) => n + v.count, 0)
  );
}
function routes(m: Memory, entity: NativeEntity, vectors: Vector[], rows: NativeRows) {
  const [sx, sy] = entity.position,
    w = entity.bbox[2] - sx + 1,
    h = entity.bbox[3] - sy + 1;
  const queue = [{ x: sx, y: sy, first: '', depth: 0 }],
    known = new Map<string, (typeof queue)[number]>([[pose(sx, sy), queue[0]!]]);
  for (let i = 0; i < queue.length && i < 768; i++) {
    const at = queue[i]!;
    if (at.depth >= 24) continue;
    for (const v of vectors) {
      const x = at.x + v.dx,
        y = at.y + v.dy,
        key = pose(x, y);
      if (x < 0 || y < 0 || y + h > rows.length || x + w > rows[0]!.length || known.has(key)) continue;
      if ((m.blocked[[entity.signature, at.x, at.y, v.op].join('/')] ?? 0) > 0) continue;
      const next = { x, y, first: at.first || v.op, depth: at.depth + 1 };
      known.set(key, next);
      queue.push(next);
    }
  }
  return known;
}
export function selectPlacement(
  m: Memory,
  o: NativeObservation,
  inputs: readonly NativeCommand[],
  rows: NativeRows,
  s: number
): Experiment | null {
  const keys = new Set(inputs.map(observedCommandKey)),
    models = controls(m, o);
  const learned = m.placement ? models.find((e) => e.entity.signature === m.placement!.actor) : models[0];
  if (!learned) return null;
  const { entity, model } = learned,
    ops = model.filter((v) => keys.has(v.op));
  if (ops.length < 2) return null;
  const positions = routes(m, entity, ops, rows),
    here = pose(...entity.position);
  let goal = m.placement;
  if (goal) {
    const [id, position] = goal.target.split('@');
    const stillVisible = o.entities.some((e) => e.id === id && pose(...e.position) === position);
    if (!keys.has(goal.b) || (here !== pose(goal.x, goal.y) && !stillVisible) || goal.steps >= 24) goal = null;
  }
  if (!goal) {
    const baseline = m.edges
      .filter((e) => e.s === s && e.stable && keys.has(e.cmd))
      .sort((a, b) => Number(ops.some((v) => v.op === a.cmd)) - Number(ops.some((v) => v.op === b.cmd)));
    if (!baseline.length) return null;
    let bestScore = Infinity;
    const [sx, sy] = entity.position,
      ox = (entity.bbox[2] - sx) / 2,
      oy = (entity.bbox[3] - sy) / 2;
    const stride = Math.min(...ops.map((v) => Math.abs(v.dx) + Math.abs(v.dy)));
    for (const landmark of o.entities) {
      if (landmark.id === entity.id || landmark.area > (rows.length * rows[0]!.length) / 3) continue;
      const target = landmark.id + '@' + pose(...landmark.position);
      const cx = Math.round((landmark.bbox[0] + landmark.bbox[2]) / 2 - ox),
        cy = Math.round((landmark.bbox[1] + landmark.bbox[3]) / 2 - oy);
      for (const [dx, dy] of [[0, 0], ...ops.map((v) => [v.dx, v.dy])]) {
        // Bind the predicted pose to the measured movement lattice.
        const x = sx + Math.round((cx + dx! - sx) / stride) * stride,
          y = sy + Math.round((cy + dy! - sy) / stride) * stride;
        const route = positions.get(pose(x, y));
        if (!route || !route.first) continue;
        for (const b of baseline.slice(0, 4)) {
          const offer: Placement = {
            actor: entity.signature,
            target,
            x,
            y,
            b: b.cmd,
            origin: s,
            direct: b.effect.key,
            refs: [b.ref],
            steps: 0,
          };
          if (m.attempts['placed:' + placeKey(offer)]) continue;
          const score =
            route.depth +
            Number(dx !== 0 || dy !== 0) * 2 +
            Number(ops.some((v) => v.op === b.cmd)) * 4 +
            Math.min(5, Math.abs(Math.log((entity.area + 1) / (landmark.area + 1)))) +
            (m.attempts['landmark:' + target] ?? 0) * 2;
          if (score < bestScore) {
            goal = offer;
            bestScore = score;
          }
        }
      }
    }
  }
  if (!goal) return null;
  const route = positions.get(pose(goal.x, goal.y));
  if (!route) return null;
  const arrived = here === pose(goal.x, goal.y);
  if (!arrived && !route.first) return null;
  return {
    phase: arrived ? 'positionB' : 'position',
    origin: goal.origin,
    a: arrived ? goal.b : route.first,
    b: goal.b,
    rule: placeKey(goal),
    expected: goal.direct,
    placement: goal,
    refs: goal.refs,
  };
}
export function updatePlacement(
  m: Memory,
  old: NativeObservation,
  next: NativeObservation,
  op: string,
  trial?: Experiment
) {
  // A failed move from one pose is a route obstruction. A changed configuration
  // can reopen it, so later observations of that same motion erase the obstruction.
  if (trial?.placement) {
    const g = trial.placement,
      actor = old.entities.find((e) => e.signature === g.actor && !e.identity_ambiguous),
      after = next.entities.find((e) => e.signature === g.actor && !e.identity_ambiguous);
    if (trial.phase === 'positionB' || !actor || !after) {
      m.attempts['placed:' + placeKey(g)] = 1;
      m.attempts['landmark:' + g.target] = (m.attempts['landmark:' + g.target] ?? 0) + 1;
      m.placement = null;
      return;
    }
    if (pose(...actor.position) === pose(...after.position))
      m.blocked[[g.actor, ...actor.position, op].join('/')] = 1;
    m.placement = { ...g, steps: g.steps + 1, refs: [g.refs[0]!, next.revision] };
  } else m.placement = null;
}
