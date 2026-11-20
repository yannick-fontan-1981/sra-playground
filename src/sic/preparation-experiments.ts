import { newDelayedMemory, selectDelayed, recordDelayed, type DelayedTrial, type DelayedMemory } from './distinguishing-suffix.ts';
import type {
  NativeCommand,
  NativeEntity,
  NativeObservation,
  NativeRows,
} from '../logos-engine/v6-native-types.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
import returnPrior from './preparation-return-prior.json' with { type: 'json' };
export const preparationReturns: Readonly<
  Record<string, { probability: number; games: number; reversingGames: number }>
> = returnPrior;
import { selectPlacement, updatePlacement, type Placement } from './position-experiment.ts';
import {
  changedMark,
  witnessAnchors,
  proposeDerivation,
  carryStep,
  derivationReceipt,
  type Anchor,
  type Mark,
  type Derivation,
} from './derive-at-site.ts';

import { observeFloor } from './access-terrain.ts';
import {
  proposeAccess,
  recordAccess,
  newSpatialMemory,
  type SpatialMemory,
  type AccessCard,
} from './spatial-access.ts';

import {
  freshCapabilities,
  proposeCapability,
  recordCapability,
  type CapabilityMemory,
  type CapabilityTrial,
} from './derive-capabilities.ts';
import { newProjectionMemory, proposeProjection, recordProjection, type Trial, type ProjectionMemory } from './projected-affordances.ts';
import {newFrontierMemory,selectFrontier,recordFrontier,type FrontierMemory,type FrontierTrial} from './experimental-frontier.ts';
import {conditionalPlacements,placementOffer,placementReceipt,type ConditionalTrial,type LearnedPlacement,type ReconsiderPlacement} from './conditional-placements.ts';
export type Move = { actor: string; from: string; to: string; dx: number; dy: number };
export type Effect = { key: string; moves: Move[] };
export type Edge = {
  s: number;
  t: number;
  cmd: string;
  effect: Effect;
  ref: number;
  stable: boolean;
  anchors: Record<string, Anchor>;
  mark?: Mark;
  visibleAfter?: string[];
};
export type Pair = {
  origin: number;
  prep: string;
  probe: string;
  prepared: number;
  direct: Edge;
  after: Edge;
  first: Edge;
  id: string;
};
type Rule = {
  id: string;
  evaluations: number;
  refutations: number;
  uses: number;
  last: number;
  verifiedAt?: number;
};
export type Experiment = {
  phase:
    | 'conditionSetup' | 'conditionTrigger' | 'conditionUse'
    | 'frontierRoute' | 'frontierProbe' | 'frontierUse' | 'frontierConsequence'
    | 'delayedProbe'
    | 'projection'
    | 'prepare'
    | 'probe'
    | 'control'
    | 'confirmControl'
    | 'confirmA'
    | 'confirmB'
    | 'reuseA'
    | 'reuseB'
    | 'route'
    | 'inverse'
    | 'explore'
    | 'position'
    | 'positionB'
    | 'deriveControl'
    | 'deriveA'
    | 'deriveB'
    | 'carry'
    | 'carryB'
    | 'capabilityUse'
    | 'capabilityStep'
    | 'accessContinue'
    | 'accessSetup'
    | 'accessTrigger';
  origin: number;
  a: string;
  b: string;
  rule: string;
  expected?: string;
  predictedGap?: boolean;
  prepEffect?: string;
  purpose?: string;
  refs: number[];
  delayed?: DelayedTrial;
  frontier?: FrontierTrial;
  condition?: ConditionalTrial;
  projection?: Trial;
  placement?: Placement;
  derive?: Derivation;
  equation?: CapabilityTrial;
  access?: { card: AccessCard; step: number; alternatives: Record<string, unknown>[] };
};
export type Outcome = {
  precondition?: string;
  predictedGap?: boolean;
  phase: string;
  hypothesis: string;
  result: string;
  longer: boolean;
  actor: string | null;
  from: string | null;
  to: string | null;
  localPath: boolean | null;
  revision: number;
  refs: number[];
  trainedSite?: string;
  testSite?: string;
  predicted?: string;
  actual?: string;
  bareEffect?: string;
  enabledMotion?: boolean;
  capability?: Derivation['capability'];
  strictMatch?: boolean;
  access?: Record<string, unknown>;
  equation?: Record<string, unknown>;
  delayed?: Record<string, unknown>;
  frontier?: Record<string, unknown>;
  condition?: Record<string, unknown>;
  projection?: Record<string, unknown>;
};
export type Memory = {
  epoch: number;
  delayed: DelayedMemory;
  frontier:FrontierMemory;
  condition?: ConditionalTrial | null;
  reconsiderPlacement?: ReconsiderPlacement | null;
  conditionLearned?: Record<string,LearnedPlacement>;
  projection: ProjectionMemory;
  space: SpatialMemory;
  equations: CapabilityMemory;
  scenes: string[];
  revisionScene: Record<number, number>;
  edges: Edge[];
  chains: { first: number; second: number }[];
  rules: Record<string, Rule>;
  previous: number;
  pending: Experiment | null;
  derivationOrigin: Experiment | null;
  placement: Placement | null;
  blocked: Record<string, number>;
  activeMarks: Record<string, { op: string; bare: string; revision: number }>;
  attempts: Record<string, number>;
  turns: number;
  lastTrial: number;
  recurrences: number;
  seenAt: number[];
};
export const initialMemory = (epoch: number): Memory => ({
  epoch,
  delayed: newDelayedMemory(),
  frontier:newFrontierMemory(),
  projection: newProjectionMemory(),
  space: newSpatialMemory(),
  equations: freshCapabilities(),
  scenes: [],
  revisionScene: {},
  edges: [],
  chains: [],
  rules: {},
  previous: -1,
  pending: null,
  derivationOrigin: null,
  placement: null,
  blocked: {},
  activeMarks: {},
  attempts: {},
  turns: 0,
  lastTrial: -1,
  recurrences: 0,
  seenAt: [],
});
export const sceneKey = (o: NativeObservation) =>
  o.frame_hash + '|' + [...o.available_action_refs].sort().join(',');
function sceneIndex(m: Memory, o: NativeObservation) {
  const k = sceneKey(o);
  let i = m.scenes.indexOf(k);
  if (i < 0) {
    i = m.scenes.length;
    m.scenes.push(k);
  }
  return i;
}
const pos = (e: NativeEntity) => e.position.join(',');
export function measureEffect(
  before: NativeObservation,
  after: NativeObservation,
  rows: NativeRows,
  next: NativeRows
): Effect {
  if (before.levels_completed < after.levels_completed || after.state === 'WIN')
    return { key: 'completion', moves: [] };
  if (before.state !== after.state) return { key: 'terminal:' + after.state, moves: [] };
  if (before.frame_hash === after.frame_hash) return { key: 'still', moves: [] };
  const entities = new Map(after.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e]));
  const moves: Move[] = [];
  for (const e of before.entities) {
    const d = !e.identity_ambiguous && entities.get(e.signature);
    if (!d || pos(e) === pos(d)) continue;
    moves.push({
      actor: e.signature,
      from: pos(e),
      to: pos(d),
      dx: d.position[0] - e.position[0],
      dy: d.position[1] - e.position[1],
    });
  }
  moves.sort((a, b) => a.actor.localeCompare(b.actor));
  if (moves.length)
    return { key: 'move:' + moves.map((m) => [m.actor, m.dx, m.dy].join('/')).join('|'), moves };
  // Compare the change attributable to B in its own arm. Absolute endpoints include A.
  const replacements = new Map<string, number>();
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y]!.length; x++) {
      const v = rows[y]![x],
        w = next[y]?.[x];
      if (v === w) continue;
      const k = v + '>' + w;
      replacements.set(k, (replacements.get(k) ?? 0) + 1);
    }
  return {
    key:
      'edit:' +
      Array.from(replacements)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, n]) => k + 'x' + n)
        .join(','),
    moves,
  };
}
const idOf = (s: number, a: string, b: string) => [s, a, b].join('|');
function stableIndex(m: Memory) {
  const index = new Map<string, Edge>();
  for (const e of m.edges) if (e.stable) index.set(e.s + '|' + e.cmd, e);
  return index;
}
function pairs(m: Memory): Pair[] {
  const index = stableIndex(m),
    pairs = new Map<string, Pair>();
  for (const c of m.chains) {
    const a = m.edges[c.first]!,
      b = m.edges[c.second]!;
    if (!a.stable || !b.stable || a.s === a.t || a.cmd === b.cmd || a.t !== b.s) continue;
    const d = index.get(a.s + '|' + b.cmd);
    if (!d || d.effect.key === b.effect.key) continue;
    const id = idOf(a.s, a.cmd, b.cmd);
    pairs.set(id, {
      id,
      origin: a.s,
      prepared: a.t,
      prep: a.cmd,
      probe: b.cmd,
      direct: d,
      after: b,
      first: a,
    });
  }
  return [...pairs.values()];
}
function firstRoutes(m: Memory, start: number, limit: number) {
  const outgoing = new Map<number, Edge[]>();
  for (const e of m.edges)
    if (e.stable && e.s !== e.t && e.effect.key!=='completion' && !e.effect.key.startsWith('terminal:')) {
      const g = outgoing.get(e.s) ?? [];
      g.push(e);
      outgoing.set(e.s, g);
    }
  const routes = new Map<number, { first: Edge | null; length: number }>([
      [start, { first: null, length: 0 }],
    ]),
    queue = [start];
  for (const s of queue) {
    const path = routes.get(s)!;
    if (path.length >= limit) continue;
    for (const e of outgoing.get(s) ?? [])
      if (!routes.has(e.t)) {
        routes.set(e.t, { first: path.first ?? e, length: path.length + 1 });
        queue.push(e.t);
      }
  }
  return routes;
}
const length = (m: Move) => Math.abs(m.dx) + Math.abs(m.dy);
function distanceEvidence(m: Memory, edge: Edge) {
  for (const move of edge.effect.moves) {
    const all = m.edges
      .filter((e) => e.stable && e !== edge)
      .flatMap((e) => e.effect.moves.filter((v) => v.actor === move.actor));
    const magnitudes = all
      .map(length)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    if (magnitudes.length < 3) continue;
    const step = magnitudes[Math.floor((magnitudes.length - 1) / 2)]!;
    if (length(move) < 2 * step) continue;
    const reached = new Set([move.from]),
      q = [move.from];
    for (const point of q)
      for (const v of all)
        if (length(v) <= step) {
          const to = v.from === point ? v.to : v.to === point ? v.from : null;
          if (to && !reached.has(to)) {
            reached.add(to);
            q.push(to);
          }
        }
    return { move, localPath: reached.has(move.to) };
  }
  return null;
}
function similarity(m: Memory, p: Pair, current: number) {
  if (current === p.origin) return 2;
  const edges = m.edges.filter((e) => e.s === current && e.stable);
  const a = edges.find((e) => e.cmd === p.prep),
    b = edges.find((e) => e.cmd === p.probe);
  return a?.effect.key === p.first.effect.key && b?.effect.key === p.direct.effect.key ? 1 : 0;
}
export function selectExperiment(
  m: Memory,
  o: NativeObservation,
  inputs: readonly NativeCommand[],
  late: boolean,
  rows?: NativeRows
): Experiment | null {
  const s = m.scenes.indexOf(sceneKey(o)),
    available = new Set(inputs.map(observedCommandKey));
  if (s < 0 || !available.size) return null;
  const frontier=m.frontier;
  frontier.choices[s]=[...available];
  if(m.condition?.scene===s) {
    const continuing=placementOffer(m.condition,o,available);
    if(continuing) return continuing;
  }
  const repair=m.reconsiderPlacement;
  if(rows && repair?.scene===s && repair.ref===o.revision) {
    const plan=conditionalPlacements(m,o,rows,s,available,m.attempts,repair);
    if(plan) {
      const offer=placementOffer({plan,index:plan.alreadyPlaced??0,scene:s},o,available);
      if(offer)return offer;
    }
  }
  const pending = m.pending;
  if (pending?.phase === 'explore') {
    const fresh = [...available].find((op) => !m.edges.some((e) => e.s === s && e.cmd === op));
    if (fresh) return { ...pending, b: fresh };
  } else if (pending?.phase === 'carry' && rows) {
    const next = carryStep(m, o, rows, available, pending);
    if (next) return next;
  } else if (pending && available.has(pending.b)) return pending;
  // Finish committed controls and exercise a verified access while its original
  // preparation and a fresh continuation are both available.
  const localRules = new Set(
    Object.values(m.rules)
      .filter(r => r.id.startsWith(s + '|') && r.evaluations > 0 && r.uses < 2 && r.refutations < 2)
      .map(r => r.id)
  );
  const localPairs = localRules.size ? pairs(m) : null;
  const reuseReady = localPairs?.some(p =>
    localRules.has(p.id) && available.has(p.prep) && p.after.effect.key !== 'still' &&
    !p.after.effect.key.startsWith('terminal:') &&
    [...available].some(op => !m.edges.some(e => e.s === p.after.t && e.cmd === op))
  );
  if (!reuseReady) {
    const ongoingPlan = frontier.question || frontier.follow || m.projection.active ||
      m.equations.active || m.space.active || (pending && pending.phase !== 'explore');
    if(rows && !ongoingPlan && !m.delayed.active && m.recurrences>=2) {
      const plan=conditionalPlacements(m,o,rows,s,available,m.attempts);
      if(plan) {
        const proposal=placementOffer({plan,index:plan.alreadyPlaced??0,scene:s},o,available);
        if(proposal) return proposal;
      }
    }
    if (m.delayed.active || !ongoingPlan) {
      const experiment = selectDelayed(m, o, s, available);
      if (experiment) return experiment;
    }
    const stalled = m.turns - frontier.lastEdge >= 4 ||
      m.turns - frontier.lastScene >= Math.max(12, 2 * available.size);
    if (frontier.question || frontier.follow || (!m.projection.active && (frontier.exploring || stalled))) {
      const search = selectFrontier(m, s, available, firstRoutes(m, s, m.scenes.length), o, rows);
      if (search) return search;
    }
    if (rows && (m.projection.active || (!m.pending && !m.equations.active && !m.space.active))) {
      const projection = proposeProjection(m, o, rows, available, s);
      if (projection) return projection;
    }
    if (rows && (m.equations.active || (!m.pending && !m.space.active))) {
      const capability = proposeCapability(m, o, rows, available, s);
      if (capability) return capability;
    }
    if (rows && (!m.pending || m.space.active)) {
      const access = proposeAccess(m, o, rows, available, s);
      if (access) return access;
    }
  }
  if (!reuseReady && !late && !m.placement && (m.recurrences < 3 || (m.turns - m.lastTrial === 1 && m.turns % 4 === 0)))
    return null;
  const outgoing = m.edges.filter((e) => e.s === s && e.stable);
  const prev = m.edges[m.previous],
    options = [...available];
  const mk = (
    phase: Experiment['phase'],
    origin: number,
    a: string,
    b: string,
    refs: number[],
    rule = '',
    purpose?: string
  ): Experiment => ({ phase, origin, a, b, refs, rule, ...(purpose ? { purpose } : {}) });
  const candidates = (localPairs ?? pairs(m)).filter(
    (p) => p.after.effect.key !== 'still' && !p.after.effect.key.startsWith('terminal:')
  );
  const routes = firstRoutes(m, s, 12);
  const outstanding = m.derivationOrigin;
  if (outstanding) {
    const d = outstanding.derive!;
    const bare = m.edges.find(
      (e) =>
        e.s === outstanding.origin && e.cmd === outstanding.b && e.stable && e.effect.key === d.bareEffect
    );
    if (bare && s === outstanding.origin && available.has(outstanding.a)) return outstanding;
    const route = routes.get(outstanding.origin)?.first;
    const id = 'derive-route:' + outstanding.rule + ':' + d.site;
    if (bare && route && available.has(route.cmd) && (m.attempts['route:' + id] ?? 0) < 6)
      return mk(
        'route',
        s,
        route.cmd,
        outstanding.b,
        [bare.ref, route.ref],
        id,
        'return_for_derived_treatment'
      );
    if (bare && s === bare.t && bare.s !== bare.t) {
      const trials = [];
      for (const op of available) {
        const known = m.edges.find((e) => e.s === s && e.cmd === op);
        if (known || m.attempts['inverse:' + id + ':' + op]) continue;
        const source = preparationReturns[bare.cmd.split(':')[0] + '/' + op.split(':')[0]];
        const witnesses = m.chains.filter((c) => {
          const f = m.edges[c.first]!,
            g = m.edges[c.second]!;
          return (
            f.cmd === bare.cmd &&
            g.cmd === op &&
            f.s !== s &&
            f.s !== f.t &&
            g.t === f.s &&
            f.stable &&
            g.stable
          );
        });
        if (witnesses.length || source)
          trials.push({
            op,
            score: (source?.probability ?? 0) + witnesses.length,
            ref: witnesses.length ? m.edges[witnesses[0]!.second]!.ref : bare.ref,
          });
      }
      const guess = trials.sort((p, q) => q.score - p.score)[0];
      if (guess)
        return {
          ...mk('inverse', bare.s, guess.op, bare.cmd, [bare.ref, guess.ref], id),
          expected: m.scenes[bare.s],
        };
    }
  }
  const offerings: { r: Experiment; rank: number; latest: number }[] = [];
  const distances = new Map<Edge, ReturnType<typeof distanceEvidence>>();
  const unusualMove = (e: Edge) => {
    if (!distances.has(e)) distances.set(e, distanceEvidence(m, e));
    return distances.get(e);
  };
  for (const p of candidates) {
    const rule = m.rules[p.id],
      match = similarity(m, p, s);
    if ((rule?.refutations ?? 0) >= 2) continue;
    const confirmed = (rule?.evaluations ?? 0) > 0;
    if (confirmed && rows) {
      const d = proposeDerivation(m, o, rows, s, available, p);
      if (d) {
        const knownJump = unusualMove(p.after);
        d.predictedGap = !!knownJump && !knownJump.localPath;
        offerings.push({ r: d, rank: d.phase === 'carry' ? 0 : 2, latest: rule!.last });
      }
    }
    const freshDestination = options.some((op) => !m.edges.some((e) => e.s === p.after.t && e.cmd === op));
    if (confirmed && ((!freshDestination && match !== 1) || (rule?.uses ?? 0) >= 2)) continue;
    const route = routes.get(p.origin);
    if (!match && (!route?.first || route.length > 6)) continue;
    if (!match && (m.attempts['route:' + p.id] ?? 0) >= 8) continue;
    const local = match === 2;
    if (!local && !route?.first) continue;
    if (local && !available.has(p.prep)) continue;
    if (!local && !available.has(route!.first!.cmd)) continue;
    const refs = [
      p.first.ref,
      p.direct.ref,
      p.after.ref,
      ...(m.attempts['baseline:' + p.id] ? [m.attempts['baseline:' + p.id]!] : []),
      ...(rule?.verifiedAt ? [rule.verifiedAt] : []),
    ];
    const unusual = unusualMove(p.after);
    const priority =
      (confirmed ? (rule!.uses ? 3 : 0) : 1) +
      (local ? 0 : 8 + route!.length) +
      (rule?.last === m.turns ? 10 : 0) -
      (unusual && !unusual.localPath ? 4 : 0);
    const requireControl = !confirmed && !m.attempts['baseline:' + p.id];
    if (local && requireControl && !available.has(p.probe)) continue;
    const x = local
      ? mk(
          confirmed ? 'reuseA' : requireControl ? 'confirmControl' : 'confirmA',
          s,
          p.prep,
          p.probe,
          refs,
          p.id,
          confirmed ? 'reach_untried_continuation' : 'replicate_contrast'
        )
      : mk('route', s, route!.first!.cmd, p.probe, refs, p.id, 'reach_matched_origin');
    x.expected = x.phase === 'confirmControl' ? p.direct.effect.key : p.after.effect.key;
    x.prepEffect = p.first.effect.key;
    x.predictedGap = !!unusual && !unusual.localPath;
    offerings.push({ r: x, rank: priority, latest: rule?.last ?? -1 });
  }
  if (rows && (m.placement || m.turns % 6 === 0) && !offerings.some((o) => o.rank <= 2)) {
    const arrangement = selectPlacement(m, o, inputs, rows, s);
    if (arrangement) return arrangement;
  }
  if (offerings.length) return offerings.sort((a, b) => a.rank - b.rank || a.latest - b.latest)[0]!.r;
  // A measured displacement outside the local movement graph is worth a control
  // even when its origin must first be reached again along witnessed transitions.
  const index = stableIndex(m);
  for (const c of m.chains) {
    const first = m.edges[c.first]!,
      second = m.edges[c.second]!;
    if (
      !first.stable ||
      !second.stable ||
      first.s === first.t ||
      first.cmd === second.cmd ||
      index.has(first.s + '|' + second.cmd)
    )
      continue;
    const travel = routes.get(first.s);
    if (!travel || travel.length > 6) continue;
    const variant = unusualMove(second);
    if (!variant || variant.localPath) continue;
    const id = idOf(first.s, first.cmd, second.cmd),
      refs = [first.ref, second.ref];
    if (!travel.first && available.has(second.cmd)) return mk('control', s, first.cmd, second.cmd, refs, id);
    if (travel.first && available.has(travel.first.cmd) && (m.attempts['route:' + id] ?? 0) < 8)
      return mk('route', s, travel.first.cmd, second.cmd, refs, id, 'compare_access_to_new_region');
  }
  // Repeat B from the original scene when only A followed by B has been seen.
  for (const c of m.chains) {
    const a = m.edges[c.first]!,
      b = m.edges[c.second]!;
    if (
      a.s === s &&
      a.s !== a.t &&
      a.stable &&
      b.stable &&
      a.cmd !== b.cmd &&
      available.has(b.cmd) &&
      !outgoing.some((e) => e.cmd === b.cmd)
    )
      return mk('control', s, a.cmd, b.cmd, [a.ref, b.ref], idOf(s, a.cmd, b.cmd));
  }
  // Real A just ran. Complete the second arm using a previously measured B alone.
  if (prev && prev.t === s && prev.s !== s && prev.stable) {
    const controls = m.edges.filter(
      (e) =>
        e.stable &&
        e.s === prev.s &&
        e.cmd !== prev.cmd &&
        available.has(e.cmd) &&
        !outgoing.some((h) => h.cmd === e.cmd)
    );
    if (controls.length) {
      const d = controls.sort(
        (x, y) => Number(y.effect.key === 'still') - Number(x.effect.key === 'still')
      )[0]!;
      return mk('probe', prev.s, prev.cmd, d.cmd, [prev.ref, d.ref], idOf(prev.s, prev.cmd, d.cmd));
    }
  }
  // Ask a controlled question at an origin whose B baseline is already known.
  const tries: { a: string; b: Edge; score: number }[] = [];
  for (const b of outgoing) {
    for (const a of options) {
      if (a === b.cmd) continue;
      const p = outgoing.find((e) => e.cmd === a);
      if (p && (p.s === p.t || m.edges.some((e) => e.s === p.t && e.cmd === b.cmd))) continue;
      const key = idOf(s, a, b.cmd);
      if (m.attempts[key]) continue;
      tries.push({
        a,
        b,
        score: (p ? 0 : 2) + (b.effect.key === 'still' ? 0 : 1) + (m.attempts['op:' + a] ?? 0) / 4,
      });
    }
  }
  if (tries.length) {
    const x = tries.sort((a, b) => a.score - b.score)[0]!;
    return mk('prepare', s, x.a, x.b.cmd, [x.b.ref], idOf(s, x.a, x.b.cmd));
  }
  return null;
}
export function recordExperiment(
  m: Memory,
  b: NativeObservation,
  a: NativeObservation,
  cmd: NativeCommand,
  rows: NativeRows,
  next: NativeRows,
  x?: Experiment
): Outcome | null {
  const s = sceneIndex(m, b),
    t = sceneIndex(m, a),
    op = observedCommandKey(cmd),
    effect = measureEffect(b, a, rows, next);
  const previous = m.edges[m.previous];
  m.turns++;
  const frontier=m.frontier;
  if(!x?.condition)m.condition=null;
  if(m.reconsiderPlacement)m.reconsiderPlacement=null;
  const newScene=m.seenAt[t]===undefined && t!==s;
  if(newScene){frontier.lastScene=m.turns;frontier.exploring=false;}
  if(!x?.frontier){frontier.question=null;frontier.follow=null;}
  if (!x?.projection) m.projection.active = null;
  if (!x?.equation) {
    m.equations.active = null;
    m.equations.follow = null;
  }
  if (!x?.access) {
    m.space.active = null;
    m.space.continuation = null;
  }
  observeFloor(m.space.floor, b, a, next, effect.moves);
  for (const move of effect.moves) delete m.blocked[[move.actor, ...move.from.split(','), op].join('/')];
  updatePlacement(m, b, a, op, x);
  m.revisionScene[b.revision] = s;
  m.revisionScene[a.revision] = t;
  if (t !== s && m.seenAt[t] !== undefined) m.recurrences++;
  m.seenAt[s] = m.turns;
  m.seenAt[t] = m.turns;
  const mark = changedMark(b, a, rows);
  for (const id of Object.keys(m.activeMarks)) {
    if (
      !b.entities.some((e) => e.signature === id && !e.identity_ambiguous) ||
      !a.entities.some((e) => e.signature === id && !e.identity_ambiguous)
    )
      delete m.activeMarks[id];
  }
  if (mark) m.activeMarks[mark.prepared] = { op, bare: mark.bare, revision: a.revision };
  const tracked = new Set(effect.moves.map((v) => v.actor)),
    marks = new Set<string>();
  for (const e of m.edges) {
    for (const v of e.effect.moves) tracked.add(v.actor);
    if (e.mark) {
      marks.add(e.mark.bare);
      marks.add(e.mark.prepared);
    }
  }
  if (mark) {
    marks.add(mark.bare);
    marks.add(mark.prepared);
  }
  // Retain initial poses so a component identified as mobile later can be measured in its earlier controls.
  for (const e of b.entities) if (!e.identity_ambiguous) tracked.add(e.signature);
  const anchors = witnessAnchors(b, rows, new Set([...tracked, ...marks]), marks);
  let index = m.edges.findIndex((e) => e.s === s && e.cmd === op);
  if (index < 0) {
    frontier.lastEdge=m.turns;
    index = m.edges.length;
    m.edges.push({
      s,
      t,
      cmd: op,
      effect,
      ref: a.revision,
      stable: true,
      anchors,
      ...(mark ? { mark } : {}),
    });
  }
  const edge = m.edges[index]!;
  Object.assign(edge.anchors, anchors);
  edge.visibleAfter = a.entities
    .filter((z) => !z.identity_ambiguous && edge.anchors[z.signature])
    .map((z) => z.signature);
  if (edge.t !== t || edge.effect.key !== effect.key) edge.stable = false;
  if (previous?.t === s && !m.chains.some((c) => c.first === m.previous && c.second === index))
    m.chains.push({ first: m.previous, second: index });
  m.delayed.history.push(index);
  if (m.delayed.history.length > 256) m.delayed.history.shift();
  if (!x?.delayed) m.delayed.active = null;
  m.previous = index;
  m.pending = null;
  if (!x) return null;
  m.lastTrial = m.turns;
  const out: Outcome = {
    predictedGap: x.predictedGap === true,
    phase: x.phase,
    hypothesis: x.rule,
    result: 'observed',
    longer: false,
    actor: null,
    from: null,
    to: null,
    localPath: null,
    revision: a.revision,
    refs: x.refs,
  };
  if(x.condition) {
    const {result,detail}=placementReceipt(m,x.condition,edge.t,b,a);
    return {...out,result,condition:detail};
  }
  if (x.delayed) {
    const won = a.levels_completed > b.levels_completed || a.state === 'WIN';
    const { result, detail } = recordDelayed(m, x.delayed, edge, b, a, won);
    return { ...out, result, delayed: detail };
  }
  if(x.frontier){
    if(!newScene)frontier.exploring=true;
    const position = (o: NativeObservation, id: string) =>
      o.entities.find(e => !e.identity_ambiguous && e.signature === id)?.position.join() ?? null;
    const {result,detail}=recordFrontier(m,x.frontier,edge,a.levels_completed>b.levels_completed||a.state==='WIN',
      id => position(a,id), id => position(b,id), {after:a, rows:next});
    return {...out,result,frontier:detail};
  }
  if (x.projection) {
    const { result, detail } = recordProjection(m, x.projection, b, a);
    return { ...out, result, projection: detail };
  }
  if (x.equation) {
    const { result, detail } = recordCapability(m, x, a, b);
    return { ...out, result, equation: detail };
  }
  if (x.access) {
    const { result, detail } = recordAccess(m, x, b, a);
    return { ...out, result, access: detail };
  }
  if (x.derive && x.phase !== 'explore') {
    out.result = derivationReceipt(m, x, edge, effect.key, b, a);
    out.trainedSite = x.derive.trained;
    out.testSite = x.derive.site;
    out.bareEffect = x.derive.bareEffect;
    out.predicted = x.expected;
    out.actual = effect.key;
    if (x.prepEffect) out.precondition = x.prepEffect;
    if (x.derive.capability) out.capability = x.derive.capability;
    if (x.phase === 'deriveB' || x.phase === 'carryB') {
      out.strictMatch = effect.key === x.expected;
      out.enabledMotion =
        out.result.endsWith('_verified') &&
        effect.moves.some(
          (v) =>
            !x
              .derive!.bareEffect.split('|')
              .some((token) =>
                token
                  .replace(/^move:/, '')
                  .startsWith((v.actor === x.derive!.mark?.prepared ? x.derive!.mark.bare : v.actor) + '/')
              )
        );
      const v = distanceEvidence(m, edge);
      if (v) {
        out.longer = true;
        out.actor = v.move.actor;
        out.from = v.move.from;
        out.to = v.move.to;
        out.localPath = v.localPath;
      }
    }
    return out;
  }
  if (x.phase === 'positionB') {
    out.result = effect.key === x.expected ? 'same_effect_at_placement' : 'different_effect_at_placement';
    const observed = distanceEvidence(m, edge);
    if (observed) {
      out.longer = true;
      out.actor = observed.move.actor;
      out.from = observed.move.from;
      out.to = observed.move.to;
      out.localPath = observed.localPath;
    }
    return out;
  }
  if (x.phase === 'route') {
    m.attempts['route:' + x.rule] = (m.attempts['route:' + x.rule] ?? 0) + 1;
    return out;
  }
  if (x.phase === 'inverse') {
    m.attempts['inverse:' + x.rule + ':' + op] = 1;
    out.result = m.scenes[t] === x.expected ? 'matched_origin_restored' : 'inverse_refuted';
    return out;
  }
  if (x.phase === 'confirmControl') {
    if (edge.stable && effect.key === x.expected) {
      m.attempts['baseline:' + x.rule] = a.revision;
      out.result = 'control_replicated';
    } else out.result = 'prediction_refuted';
    return out;
  }
  if (['prepare', 'confirmA', 'reuseA'].includes(x.phase)) {
    m.attempts[idOf(s, x.a, x.b)] = 1;
    m.attempts['op:' + x.a] = (m.attempts['op:' + x.a] ?? 0) + 1;
    if (s !== t && edge.stable && (!x.prepEffect || effect.key === x.prepEffect)) {
      m.pending = {
        ...x,
        phase: x.phase === 'prepare' ? 'probe' : x.phase === 'confirmA' ? 'confirmB' : 'reuseB',
        refs: [...x.refs, a.revision],
      };
    } else out.result = 'precondition_failed';
  } else if (x.phase === 'confirmB' || x.phase === 'reuseB') {
    const r = (m.rules[x.rule] ??= { id: x.rule, evaluations: 0, refutations: 0, uses: 0, last: 0 });
    r.last = m.turns;
    if (edge.stable && effect.key === x.expected) {
      if (x.phase === 'confirmB') {
        r.evaluations++;
        r.verifiedAt = a.revision;
      } else {
        r.uses++;
        m.pending = { ...x, phase: 'explore', refs: [...x.refs, a.revision] };
      }
      out.result = x.phase === 'confirmB' ? 'prediction_confirmed' : 'reused_as_predicted';
      const transfer = distanceEvidence(m, edge);
      if (transfer) {
        out.longer = true;
        out.actor = transfer.move.actor;
        out.from = transfer.move.from;
        out.to = transfer.move.to;
        out.localPath = transfer.localPath;
      }
    } else {
      r.refutations++;
      out.result = 'prediction_refuted';
    }
  } else if (x.phase === 'probe' || x.phase === 'control') {
    const p = pairs(m).find((p) => p.id === x.rule);
    out.result = p ? 'differential' : 'no_differential';
  }
  return out;
}
