import {
  controlExperiments,
  nextControlledMove,
  type ControlExperiment,
  type CalibrationExperiment,
} from './partial-control-repertoire.ts';
import { placeExperiments, type PlaceClaim } from './place-experiments.ts';
import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge, Experiment, Memory } from './preparation-experiments.ts';
import { add, point, type XY } from './access-terrain.ts';

export type Prediction = {
  role: string;
  from: XY;
  to: XY;
  op: string;
  ref: number;
  alternative?: { observedWith: string; inactiveRef: number; preparationRef: number | null };
};
export type FrontierQuestion = {
  place?: PlaceClaim;
  repertoire?: ControlExperiment;
  calibration?: CalibrationExperiment;
  after?: Prediction;
  target: number;
  probe: string;
  arrival: Prediction | null;
  use: Prediction | null;
};
export type FrontierTrial = {
  question: FrontierQuestion;
  next: number | null;
  use: boolean;
  after?: boolean;
};
export type FrontierMemory = {
  lastEdge: number;
  lastScene: number;
  exploring: boolean;
  choices: Record<number, string[]>;
  question: FrontierQuestion | null;
  follow: { scene: number; question: FrontierQuestion; after?: boolean } | null;
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

function forecast(m: Memory, target: number, probe: string, anchors: Edge['anchors']): FrontierQuestion {
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
  routes: Map<number, Route>,
  live?: NativeObservation,
  rows?: NativeRows
): Experiment | null {
  const f = m.frontier;
  function offer(q: FrontierQuestion, first: Edge | null, use = false, after = false): Experiment {
    const op = first?.cmd ?? (after ? q.after!.op : use ? q.use!.op : q.probe);
    const refs = first
      ? [first.ref]
      : [
          q.arrival?.ref,
          q.use?.ref,
          q.after?.ref,
          ...[q.arrival, q.use, q.after].flatMap((p) =>
            p?.alternative ? [p.alternative.inactiveRef, p.alternative.preparationRef ?? undefined] : []
          ),
          ...(q.calibration ? [q.calibration.setup.ref, q.calibration.direct.ref] : []),
          ...(q.repertoire
            ? [
                q.repertoire.setup.ref,
                q.repertoire.calibration.bareRef,
                q.repertoire.calibration.preparedRef,
                q.repertoire.bare.ref,
              ]
            : []),
          q.place?.opening?.controlRef ?? undefined,
          q.place?.bare?.ref,
          q.place?.preparationRef ?? undefined,
          ...(q.place?.referenceEvidence ?? []),
        ].filter((v): v is number => v !== undefined);
    return {
      phase: after ? 'frontierConsequence' : use ? 'frontierUse' : first ? 'frontierRoute' : 'frontierProbe',
      origin: s,
      a: op,
      b: op,
      rule: 'unmeasured_control_at_reachable_configuration',
      refs,
      frontier: { question: q, next: first?.t ?? null, use, after },
    };
  }
  if (f.follow?.scene === s) {
    const plan = f.follow.question,
      follow = f.follow.after ? plan.after : plan.use;
    if (follow && available.has(follow.op)) return offer(plan, null, true, f.follow.after);
  }
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
  const site = live && rows ? placeExperiments(m, live, rows, s) : null;
  const experiments = controlExperiments(m, new Set(routes.keys()));
  let best: {
    rank: number;
    probe: string;
    target: number;
    first: Edge | null;
    question?: FrontierQuestion;
  } | null = null;
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
      let option = site?.(target, op);
      const comparison = experiments.proposals.get(target + '/' + op);
      const calibration = experiments.calibrations.get(target + '/' + op);
      if (comparison) {
        const sameBody = option?.question.arrival?.role === comparison.claim.actor;
        const forecast = sameBody ? option!.question : { target, probe: op, arrival: null, use: null };
        option = {
          score: Math.max(sameBody ? option!.score : 0, 12) + 4 + comparison.score,
          question: { ...forecast, repertoire: comparison.claim },
        };
      } else if (calibration) {
        const sameBody = option?.question.arrival?.role === calibration.actor;
        const forecast = sameBody ? option!.question : { target, probe: op, arrival: null, use: null };
        option = {
          score: Math.max(sameBody ? option!.score : 0, 6) + 2,
          question: { ...forecast, calibration },
        };
      }
      const rank =
        site || comparison || calibration
          ? route.length * 1.5 + Math.log2(1 + (all.get(op) ?? 0)) / 4 - (option?.score ?? 0)
          : route.length * 8 + Math.log2(1 + (all.get(op) ?? 0));
      if (!best || rank < best.rank || (rank === best.rank && op < best.probe))
        best = { rank, probe: op, target, first: route.first, question: option?.question };
    }
  }
  if (!best) return null;
  return offer(
    best.question ?? forecast(m, best.target, best.probe, anchors.get(best.target) ?? {}),
    best.first
  );
}

export function recordFrontier(
  m: Memory,
  x: FrontierTrial,
  edge: Edge,
  won: boolean,
  pos: (role: string) => string | null,
  beforePos?: (role: string) => string | null,
  observed?: { after: NativeObservation; rows: NativeRows }
) {
  const f = m.frontier,
    q = x.question;
  f.follow = null;
  f.question = null;
  let result: string;
  let controlled: { moved: boolean; changed: boolean; actual: XY } | null = null;
  let revisedUse: Prediction | null = null;
  if (won) result = 'official_completion';
  else if (edge.effect.key.startsWith('terminal:')) result = 'terminal_without_arrival';
  else if (x.next !== null) {
    const reached = edge.t === x.next && edge.stable;
    result = reached ? 'route_verified' : 'route_refuted';
    if (reached) f.question = q;
  } else {
    const expected = x.after ? q.after : x.use ? q.use : q.arrival,
      actual = expected && pos(expected.role);
    result = expected
      ? actual === expected.to.join() && (!beforePos || beforePos(expected.role) === expected.from.join())
        ? x.after
          ? 'subsequent_use_verified'
          : x.use
            ? 'continuation_verified'
            : 'arrival_verified'
        : 'projection_refuted'
      : 'unmeasured_control_tested';
    if (!x.use && result === 'arrival_verified' && q.use && q.use.from.join() === pos(q.use.role))
      f.follow = { scene: edge.t, question: q };
    if (
      x.use &&
      !x.after &&
      result === 'continuation_verified' &&
      q.after &&
      q.after.from.join() === pos(q.after.role)
    )
      f.follow = { scene: edge.t, question: q, after: true };
  }
  const claim = q.repertoire;
  if (claim && !won && x.next === null && !x.use && !x.after && !edge.effect.key.startsWith('terminal:')) {
    const location = pos(claim.actor);
    if (beforePos?.(claim.actor) === claim.prepared.join() && location) {
      const actual = point(location);
      const displacement = [actual[0] - claim.prepared[0], actual[1] - claim.prepared[1]];
      const changed =
        displacement[0] !== claim.bare.to[0] - claim.origin[0] ||
        displacement[1] !== claim.bare.to[1] - claim.origin[1];
      controlled = { actual, changed, moved: location !== claim.prepared.join() };
      if (changed && controlled.moved && observed && !f.follow) {
        const body = observed.after.entities.find(
          (e) => e.signature === claim.actor && !e.identity_ambiguous
        );
        if (body) {
          const allowed = new Set(observed.after.available_action_refs);
          const choices = new Set(m.edges.map((e) => e.cmd).filter((op) => allowed.has(op.split(':')[0]!)));
          revisedUse = nextControlledMove(
            m,
            claim,
            actual,
            observed.rows[0]!.length - (body.bbox[2] - body.bbox[0]),
            observed.rows.length - (body.bbox[3] - body.bbox[1]),
            choices
          );
          if (revisedUse)
            f.follow = {
              scene: edge.t,
              question: {
                target: q.target,
                probe: q.probe,
                arrival: q.arrival,
                use: revisedUse,
                repertoire: claim,
              },
            };
        }
      }
    }
  }
  return {
    result,
    detail: {
      ...(q.place ? { place: q.place } : {}),
      ...(claim ? { repertoire: claim, controlled, revisedUse } : {}),
      ...(q.calibration ? { calibration: q.calibration } : {}),
      target: q.target,
      probe: q.probe,
      arrival: q.arrival,
      use: q.use,
      ...(q.after ? { after: q.after } : {}),
      routeTo: x.next,
      actualScene: edge.t,
    },
  };
}
