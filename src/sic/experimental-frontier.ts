import type { Edge, Experiment, Memory } from './preparation-experiments.ts';
import { add, point, type XY } from './access-terrain.ts';

type Prediction = { role: string; from: XY; to: XY; op: string; ref: number };
type Question = { target: number; probe: string; arrival: Prediction | null; use: Prediction | null };
export type FrontierTrial = { question: Question; next: number | null; use: boolean };
export type FrontierMemory = {
  lastEdge: number;
  lastScene: number;
  exploring: boolean;
  choices: Record<number, string[]>;
  question: Question | null;
  follow: { scene: number; question: Question } | null;
};
export const newFrontierMemory = (): FrontierMemory => ({
  lastEdge: 0,
  lastScene: 0,
  exploring: false,
  choices: {},
  question: null,
  follow: null,
});
type Route = { first: Edge | null; length: number };

function forecast(m: Memory, target: number, probe: string, anchors: Edge['anchors']): Question {
  let best: { score: number; arrival: Prediction; source: Edge } | null = null;
  for (const e of m.edges) {
    if (!e.stable || e.cmd !== probe) continue;
    for (const move of e.effect.moves) {
      const at = anchors[move.actor];
      if (!at) continue;
      const from = point(at.at),
        d: XY = [move.dx, move.dy];
      let to = add(from, d),
        score = at.at === move.from ? 3 : 1;
      // A witnessed exchange binds the predicted landing to the other body's current position.
      const peer = e.effect.moves.find(
        (v) => v !== move && v.to === move.from && v.from === move.to && anchors[v.actor]
      );
      if (peer) {
        to = point(anchors[peer.actor]!.at);
        score += 3;
      }
      if (!best || score > best.score)
        best = { score, source: e, arrival: { role: move.actor, from, to, op: probe, ref: e.ref } };
    }
  }
  let use: Prediction | null = null;
  if (best)
    for (const e of m.edges) {
      if (!e.stable || e.s !== best.source.t) continue;
      const v = e.effect.moves.find((v) => v.actor === best!.arrival.role);
      if (v) {
        const from = best.arrival.to;
        use = { role: v.actor, op: e.cmd, from, to: add(from, [v.dx, v.dy]), ref: e.ref };
        break;
      }
    }
  return { target, probe, arrival: best?.arrival ?? null, use };
}

export function selectFrontier(
  m: Memory,
  s: number,
  available: Set<string>,
  routes: Map<number, Route>
): Experiment | null {
  const f = m.frontier;
  function offer(q: Question, first: Edge | null, use = false): Experiment {
    const op = first?.cmd ?? (use ? q.use!.op : q.probe);
    const refs = first
      ? [first.ref]
      : [q.arrival?.ref, q.use?.ref].filter((v): v is number => v !== undefined);
    return {
      phase: use ? 'frontierUse' : first ? 'frontierRoute' : 'frontierProbe',
      origin: s,
      a: op,
      b: op,
      rule: 'unmeasured_control_at_reachable_configuration',
      refs,
      frontier: { question: q, next: first?.t ?? null, use },
    };
  }
  if (f.follow?.scene === s && f.follow.question.use && available.has(f.follow.question.use.op))
    return offer(f.follow.question, null, true);
  const byScene = new Map<number, Set<string>>(),
    anchors = new Map<number, Edge['anchors']>();
  for (const e of m.edges) {
    const used = byScene.get(e.s) ?? new Set<string>();
    used.add(e.cmd);
    byScene.set(e.s, used);
    if (!anchors.has(e.s)) anchors.set(e.s, e.anchors);
  }
  function permits(target: number, op: string) {
    return (target !== s || available.has(op)) && !byScene.get(target)?.has(op);
  }
  const open = f.question,
    path = open && routes.get(open.target);
  if (open && path && permits(open.target, open.probe) && (!path.first || available.has(path.first.cmd)))
    return offer(open, path.first);
  // Choose an unanswered experiment before a route. Replaying an entire known cycle
  // cannot discharge it. Each accepted probe measures a previously absent edge.
  let best: { rank: number; probe: string; target: number; first: Edge | null } | null = null;
  const all = new Map<string, number>();
  for (const e of m.edges) all.set(e.cmd, (all.get(e.cmd) ?? 0) + 1);
  for (const [target, route] of routes) {
    if (route.first && !available.has(route.first.cmd)) continue;
    const choices =
      target === s
        ? [...available]
        : (f.choices[target] ??
          m.scenes[target]!.split('|')
            .at(-1)!
            .split(',')
            .filter((op) => op !== 'ACTION6'));
    for (const op of choices) {
      if (!permits(target, op)) continue;
      const rank = route.length * 8 + Math.log2(1 + (all.get(op) ?? 0));
      if (!best || rank < best.rank || (rank === best.rank && op < best.probe))
        best = { rank, probe: op, target, first: route.first };
    }
  }
  if (!best) return null;
  return offer(forecast(m, best.target, best.probe, anchors.get(best.target) ?? {}), best.first);
}

export function recordFrontier(
  m: Memory,
  x: FrontierTrial,
  edge: Edge,
  won: boolean,
  pos: (role: string) => string | null
) {
  const f = m.frontier,
    q = x.question;
  f.follow = null;
  f.question = null;
  let result: string;
  if (won) result = 'official_completion';
  else if (edge.effect.key.startsWith('terminal:')) result = 'terminal_without_arrival';
  else if (x.next !== null) {
    const reached = edge.t === x.next && edge.stable;
    result = reached ? 'route_verified' : 'route_refuted';
    if (reached) f.question = q;
  } else {
    const expected = x.use ? q.use : q.arrival,
      actual = expected && pos(expected.role);
    result = expected
      ? actual === expected.to.join()
        ? x.use
          ? 'continuation_verified'
          : 'arrival_verified'
        : 'projection_refuted'
      : 'unmeasured_control_tested';
    if (!x.use && result === 'arrival_verified' && q.use && q.use.from.join() === actual)
      f.follow = { scene: edge.t, question: q };
  }
  return {
    result,
    detail: {
      target: q.target,
      probe: q.probe,
      arrival: q.arrival,
      use: q.use,
      routeTo: x.next,
      actualScene: edge.t,
    },
  };
}
