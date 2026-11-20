import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge, Experiment, Memory } from './preparation-experiments.ts';
import { add, diff, point, same, size, type XY } from './access-terrain.ts';
import {
  fitSpatialCapability,
  predictSpatialCapability,
  type SpatialCapability,
} from './spatial-capability.ts';

type Condition = { axis: 0 | 1; signOnly: boolean; value: number; onMatch: boolean };
export type PlacementStep = {
  op: string;
  role: string;
  from: XY;
  to: XY;
  ref: number;
  actorFrom?: XY;
  actorTo?: XY;
  actorRef?: number;
};
export type ConditionalPlacement = {
  key: string;
  scene: number;
  actor: string;
  partner: string;
  origin: XY;
  without: number;
  rules: Condition[];
  frame?: SpatialCapability;
  support: number[];
  preparation: PlacementStep[];
  trigger: PlacementStep;
  use: PlacementStep | null;
  agreement: [number, number];
  alreadyPlaced?: number;
  reuseRef?: number;
  reconsideredRef?: number;
  alternatives?: {
    partner: string;
    location: XY;
    departure: XY;
    trigger: string;
    landing: XY;
    use: { op: string; to: XY } | null;
    preparation: string[];
    agreement: [number, number];
  }[];
};
export type ConditionalTrial = { plan: ConditionalPlacement; index: number; scene: number };
export type ReconsiderPlacement = {
  originScene: number;
  scene: number;
  actor: string;
  partner: string;
  trigger: string;
  ref: number;
};
type Sample = { edge: Edge; start: XY; end: XY; partner: XY };
const pairLayout = (actor: XY, peer: string, at: XY) => ({ actor, objects: { [peer]: at } });
const read = (edge: Edge, id: string) => {
  const anchor = edge.anchors[id];
  if (!anchor || !edge.visibleAfter?.includes(id)) return null;
  const from = point(anchor.at),
    move = edge.effect.moves.find((m) => m.actor === id);
  return { from, to: move ? point(move.to) : from };
};
const relation = (d: XY, axis: 0 | 1, signOnly: boolean) => (signOnly ? Math.sign(d[axis]) : d[axis]);

/** Keep all one-coordinate explanations consistent with the observed active and inactive trials. */
export function separateMotion(active: XY[], inactive: XY[]): Condition[] {
  if (!active.length || !inactive.length) return [];
  const rules: Condition[] = [];
  for (const axis of [0, 1] as const)
    for (const signOnly of [false, true]) {
      for (const onMatch of [true, false]) {
        const inside = onMatch ? active : inactive,
          outside = onMatch ? inactive : active;
        const value = relation(inside[0]!, axis, signOnly);
        if (
          inside.every((d) => relation(d, axis, signOnly) === value) &&
          outside.every((d) => relation(d, axis, signOnly) !== value)
        )
          rules.push({ axis, signOnly, value, onMatch });
      }
    }
  return rules;
}
const votes = (rules: Condition[], offset: XY) =>
  rules.filter((r) => (relation(offset, r.axis, r.signOnly) === r.value) === r.onMatch).length;

type UseProjection = { op: string; to: XY; ref: number; weight: number };
function continuation(
  actions: Map<string, JointSample[]>,
  source: Edge,
  landing: XY,
  origin: XY,
  extent: XY,
  rows: NativeRows,
  preparation: PlacementStep[],
  bare: Edge,
  prepared: number | null,
  known: Map<string, Edge>,
  actor: string,
  cache: Map<string, UseProjection[]>
) {
  const visited = new Set([origin.join(), landing.join(), ...preparation.map((p) => p.actorTo!.join())]);
  let best: { value: number; step: PlacementStep; distinct: boolean } | null = null;
  const key = source.t + '/' + landing;
  let projections = cache.get(key);
  if (!projections) {
    projections = [];
    for (const [op, samples] of actions) {
      const local = samples.filter((s) => same(s.a.from, landing)),
        witnesses = samples.filter((s) => s.edge.s === source.t);
      const pool = local.length ? local : witnesses.length ? witnesses : samples;
      if (
        !local.length &&
        !witnesses.length &&
        new Set(samples.filter((s) => !same(s.a.from, s.a.to)).map((s) => s.a.from.join())).size < 2
      )
        continue;
      const candidate = learnDestination(
        pool.map((s) => ({ ...s.a, ref: s.edge.ref })),
        landing
      );
      if (candidate && !same(candidate.to, landing) && fits(candidate.to, extent, rows))
        projections.push({
          op,
          to: candidate.to,
          ref: candidate.ref,
          weight: local.length ? 3 : witnesses.length ? 2 : 0,
        });
    }
    cache.set(key, projections);
  }
  for (const candidate of projections) {
    const op = candidate.op;
    const shortcut = [bare.s, bare.t, prepared].some((s) => {
      const edge = s === null ? null : known.get(s + '/' + op);
      return edge && read(edge, actor)?.to.join() === candidate.to.join();
    });
    const distinct = !visited.has(candidate.to.join()) && !shortcut;
    const value =
      (distinct ? 10 : 0) +
      candidate.weight +
      Math.min(2, size(diff(candidate.to, origin)) / Math.max(...extent) / 8);
    if (!best || value > best.value)
      best = {
        value,
        distinct,
        step: { role: actor, op, from: landing, to: candidate.to, ref: candidate.ref },
      };
  }
  return best;
}
const fits = (p: XY, extent: XY, rows: NativeRows) =>
  p[0] >= 0 && p[1] >= 0 && p[0] + extent[0] <= rows[0]!.length && p[1] + extent[1] <= rows.length;
const extentOf = (e: NativeObservation['entities'][number]): XY => [
  e.bbox[2] - e.bbox[0] + 1,
  e.bbox[3] - e.bbox[1] + 1,
];

type JointSample = { edge: Edge; a: { from: XY; to: XY }; p: { from: XY; to: XY } };
type SearchNode = { a: XY; p: XY; scene: number | null; steps: PlacementStep[]; inferred: number };
type Candidate = { score: number; plan: ConditionalPlacement };
export type LearnedPlacement = { plan: ConditionalPlacement; landingScene: number; ref: number };
function reusePlacement(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  scene: number,
  allowed: Set<string>,
  edges: Edge[]
): ConditionalPlacement | null {
  let best: Candidate | null = null;
  for (const learned of Object.values(m.conditionLearned ?? {})) {
    const { plan } = learned,
      first = plan.preparation[0]!;
    if (location(o, plan.actor) !== plan.origin.join() || location(o, plan.partner) !== first.from.join())
      continue;
    if (!allowed.has(plan.trigger.op) || plan.preparation.some((s) => !allowed.has(s.op))) continue;
    const bare = edges.find((e) => e.s === scene && e.cmd === plan.trigger.op);
    if (!bare) continue;
    const idle = read(bare, plan.actor);
    if (!idle || !same(idle.from, idle.to)) continue;
    const actor = o.entities.find((e) => e.signature === plan.actor && !e.identity_ambiguous)!;
    const observed = edges.filter((e) => e.s === learned.landingScene);
    if (
      scene !== plan.scene &&
      edges.some(
        (e) =>
          e.s === scene &&
          e.cmd === first.op &&
          (!same(read(e, plan.actor)?.to ?? [-1, -1], first.actorTo!) ||
            !same(read(e, plan.partner)?.to ?? [-1, -1], first.to))
      )
    )
      continue;
    for (const e of edges) {
      if (!allowed.has(e.cmd) || e.cmd === plan.use?.op || observed.some((x) => x.cmd === e.cmd)) continue;
      const v = e.effect.moves.find((x) => x.actor === plan.actor);
      if (!v) continue;
      const from = plan.trigger.to,
        to = add(from, [v.dx, v.dy]);
      if (!fits(to, extentOf(actor), rows)) continue;
      const key = ['reuse', learned.ref, scene, e.cmd].join('/');
      if (m.attempts['condition/' + key]) continue;
      const novel = !edges.some((s) =>
        s.effect.moves.some((x) => x.actor === plan.actor && (x.to === to.join() || x.from === to.join()))
      );
      const score = (novel ? 5 : 0) + (v.from === from.join() ? 3 : 0) + Number(!same(to, plan.origin));
      if (!best || score > best.score)
        best = {
          score,
          plan: {
            ...plan,
            scene,
            key,
            without: bare.ref,
            alreadyPlaced: 0,
            reuseRef: learned.ref,
            support: [...new Set([...plan.support, bare.ref, learned.ref])],
            use: { op: e.cmd, role: plan.actor, from, to, ref: e.ref },
            alternatives: [],
          },
        };
    }
  }
  return best?.plan ?? null;
}
function learnDestination(samples: { from: XY; to: XY; ref: number }[], from: XY) {
  const local = samples.filter((s) => same(s.from, from)),
    group = local.length ? local : samples;
  if (!group.length) return null;
  const fixed =
    !local.length &&
    new Set(group.map((s) => s.from.join())).size > 1 &&
    group.every((s) => same(s.to, group[0]!.to));
  const votes = new Map<string, { to: XY; ref: number; count: number }>();
  for (const s of group) {
    const to = fixed ? s.to : add(from, diff(s.to, s.from)),
      k = to.join();
    const v = votes.get(k) ?? { to, ref: s.ref, count: 0 };
    v.count++;
    votes.set(k, v);
  }
  const best = [...votes.values()].sort((a, b) => b.count - a.count)[0]!;
  return best.count * 2 > group.length ? best : null;
}
function candidatesForInput(list: JointSample[], at: SearchNode) {
  const exact = list.filter((x) => same(x.a.from, at.a) && same(x.p.from, at.p));
  if (exact.length) {
    const x = exact[0]!;
    if (!exact.every((s) => same(s.a.to, x.a.to) && same(s.p.to, x.p.to))) return null;
    return { a: x.a.to, p: x.p.to, ref: x.edge.ref, other: x.edge.ref };
  }
  if (!list.length) return null;
  // Translate the two displacements from the same observed neighbourhood.
  // Choosing each donor independently can splice two incompatible configurations.
  const distances = list.map((s) => size(diff(s.a.from, at.a)) + size(diff(s.p.from, at.p)));
  const nearest = Math.min(...distances),
    near = list.filter((_, i) => distances[i] === nearest);
  const a = learnDestination(
    near.map((s) => ({ ...s.a, ref: s.edge.ref })),
    at.a
  );
  const p = learnDestination(
    near.map((s) => ({ ...s.p, ref: s.edge.ref })),
    at.p
  );
  return a && p ? { a: a.to, p: p.to, ref: p.ref, other: a.ref } : null;
}
function recentPaths(m: Memory, scene: number) {
  const prefix = new Map<number, Edge[]>(),
    path: Edge[] = [];
  let at = scene;
  for (const ix of m.delayed.history.slice(-4).reverse()) {
    const e = m.edges[ix];
    if (!e?.stable || e.t !== at || e.effect.key === 'completion' || e.effect.key.startsWith('terminal:'))
      break;
    path.unshift(e);
    at = e.s;
    if (at !== scene && !prefix.has(at)) prefix.set(at, [...path]);
  }
  return prefix;
}
export function conditionalPlacements(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  scene: number,
  available: Set<string>,
  tried: Record<string, number>,
  reconsider?: ReconsiderPlacement
): ConditionalPlacement | null {
  const prefix = recentPaths(m, scene);
  const edges = m.edges.filter(
    (e) => e.stable && e.effect.key !== 'completion' && !e.effect.key.startsWith('terminal:')
  );
  const reuse = reconsider ? null : reusePlacement(m, o, rows, scene, available, edges);
  if (reuse) return reuse;
  const local = edges.filter(
    (e) =>
      (e.s === scene || prefix.has(e.s)) &&
      available.has(e.cmd) &&
      (!reconsider || (e.s === reconsider.originScene && prefix.has(e.s) && e.cmd === reconsider.trigger))
  );
  if (!local.length) return null;
  const live = new Map(
    o.entities
      .filter((e) => !e.identity_ambiguous && e.area < (rows.length * rows[0]!.length) / 4)
      .map((e) => [e.signature, e])
  );
  const known = new Map<string, Edge>(),
    inputs = new Map<string, Edge[]>(),
    movedBy = new Map<string, Set<string>>();
  const mobile = new Set<string>();
  for (const e of edges) {
    known.set(e.s + '/' + e.cmd, e);
    const prior = inputs.get(e.cmd) ?? [];
    prior.push(e);
    inputs.set(e.cmd, prior);
    const movers = movedBy.get(e.cmd) ?? new Set();
    for (const v of e.effect.moves) {
      movers.add(v.actor);
      mobile.add(v.actor);
    }
    movedBy.set(e.cmd, movers);
  }
  type Explanation = {
    bare: Edge;
    actor: string;
    partner: string;
    origin: XY;
    initial: XY;
    active: Sample[];
    inactive: Sample[];
    rules: Condition[];
    frame: SpatialCapability | null;
    weight: number;
  };
  const choices: Explanation[] = [];
  const frames = new Map<string, SpatialCapability | null>();
  for (const bare of local)
    for (const actor of movedBy.get(bare.cmd) ?? []) {
      if (reconsider && actor !== reconsider.actor) continue;
      const idle = read(bare, actor),
        entity = live.get(actor);
      if (!entity || !idle || !same(idle.from, idle.to)) continue;
      const peers = [...live.values()].filter((e) => e.signature !== actor && bare.anchors[e.signature]);
      peers.sort(
        (a, b) =>
          Number(mobile.has(b.signature)) - Number(mobile.has(a.signature)) ||
          size(diff(point(bare.anchors[a.signature]!.at), idle.from)) -
            size(diff(point(bare.anchors[b.signature]!.at), idle.from))
      );
      for (const peer of peers.slice(0, 12)) {
        if (reconsider && peer.signature !== reconsider.partner) continue;
        const partner = peer.signature,
          initial = point(bare.anchors[partner]!.at);
        const measured: Sample[] = [];
        for (const e of inputs.get(bare.cmd)!) {
          const a = read(e, actor),
            p = e.anchors[partner];
          if (a && p) measured.push({ edge: e, start: a.from, end: a.to, partner: point(p.at) });
        }
        const active = measured.filter((s) => !same(s.start, s.end)),
          inactive = measured.filter((s) => same(s.start, s.end));
        const rules = separateMotion(
          active.map((x) => diff(x.start, x.partner)),
          inactive.map((x) => diff(x.start, x.partner))
        );
        const frameKey = [actor, partner, bare.cmd].join('/');
        if (!frames.has(frameKey)) {
          let frame: SpatialCapability | null = null;
          if (active.length >= 2 && inactive.length >= 2 && mobile.has(partner)) {
            const examples = measured.map((s) => ({
              layout: pairLayout(s.start, partner, s.partner),
              outcome: !same(s.start, s.end),
            }));
            const model = fitSpatialCapability(examples, [partner], 'board');
            if (
              model &&
              model.rules.some((r) => r.to === null) &&
              model.sensitivity >= 0.75 &&
              model.specificity >= 0.75
            )
              frame = model;
          }
          frames.set(frameKey, frame);
        }
        const frame = frames.get(frameKey) ?? null;
        if (
          frame
            ? predictSpatialCapability(frame, pairLayout(idle.from, partner, initial)) !== false
            : !rules.length || votes(rules, diff(idle.from, initial))
        )
          continue;
        const diversity = (xs: Sample[]) => new Set(xs.map((s) => diff(s.start, s.partner).join())).size;
        const weight =
          Math.min(3, Math.min(active.length, inactive.length)) +
          Math.min(2, diversity(active) + diversity(inactive) - 2) +
          Number(active.some((s) => same(s.start, idle.from))) +
          Number(mobile.has(partner));
        choices.push({
          bare,
          actor,
          partner,
          origin: idle.from,
          initial,
          active,
          inactive,
          rules,
          frame,
          weight,
        });
      }
    }
  const ranked = new Map<string, Candidate>(),
    cached = new Map<string, Map<string, JointSample[]>>();
  const usesByPair = new Map<string, Map<string, UseProjection[]>>();
  const predictedByPair = new Map<string, Map<string, ReturnType<typeof candidatesForInput>>>();
  for (const c of choices.sort((a, b) => b.weight - a.weight).slice(0, 12)) {
    const { bare, actor, partner, origin, initial, active, inactive, rules, frame } = c,
      ps = prefix.get(bare.s);
    const ae = extentOf(live.get(actor)!),
      pe = extentOf(live.get(partner)!);
    const pair = actor + '/' + partner;
    const useCache = usesByPair.get(pair) ?? new Map<string, UseProjection[]>();
    usesByPair.set(pair, useCache);
    const predictions = predictedByPair.get(pair) ?? new Map<string, ReturnType<typeof candidatesForInput>>();
    predictedByPair.set(pair, predictions);
    let actions = cached.get(pair);
    if (!actions) {
      actions = new Map();
      for (const e of edges) {
        if (!available.has(e.cmd)) continue;
        const a = read(e, actor),
          p = read(e, partner);
        if (!a || !p) continue;
        const list = actions.get(e.cmd) ?? [];
        list.push({ edge: e, a, p });
        actions.set(e.cmd, list);
      }
      cached.set(pair, actions);
    }
    const queue: SearchNode[] = [{ a: origin, p: initial, scene: bare.s, steps: [], inferred: 0 }];
    const visited = new Set([bare.s + '/' + origin + '/' + initial]);
    for (let i = 0; i < queue.length && i < 64; i++) {
      const at = queue[i]!;
      if (at.steps.length >= 4) continue;
      const past = ps?.[at.steps.length];
      for (const op of past ? [past.cmd] : actions.keys()) {
        if (!past && op === bare.cmd) continue;
        const actual = at.scene !== null ? known.get(at.scene + '/' + op) : undefined;
        const la = actual && read(actual, actor),
          lp = actual && read(actual, partner);
        if (actual && (!la || !lp || !same(la.from, at.a) || !same(lp.from, at.p))) continue;
        const poseKey = op + '/' + at.a + '/' + at.p;
        if (!actual && !predictions.has(poseKey))
          predictions.set(poseKey, candidatesForInput(actions.get(op) ?? [], at));
        const predicted = actual
          ? { a: la!.to, p: lp!.to, ref: actual.ref, other: actual.ref }
          : predictions.get(poseKey);
        if (!predicted || (!past && same(predicted.a, at.a) && same(predicted.p, at.p))) continue;
        if (!fits(predicted.a, ae, rows) || !fits(predicted.p, pe, rows)) continue;
        const next = actual?.t ?? null,
          k = (next ?? 'imagined') + '/' + predicted.a + '/' + predicted.p;
        if (visited.has(k) && !past) continue;
        visited.add(k);
        const steps = [
          ...at.steps,
          {
            op,
            role: partner,
            from: at.p,
            to: predicted.p,
            ref: predicted.ref,
            actorFrom: at.a,
            actorTo: predicted.a,
            actorRef: predicted.other,
          },
        ];
        const inferred = at.inferred + Number(!actual);
        if (!ps || steps.length < ps.length)
          queue.push({ a: predicted.a, p: predicted.p, scene: next, steps, inferred });
        if (ps && (steps.length !== ps.length || next !== scene)) continue;
        const offset = diff(predicted.a, predicted.p);
        const total = frame?.rules.length ?? rules.length;
        const agreement = frame
          ? predictSpatialCapability(frame, pairLayout(predicted.a, partner, predicted.p))
            ? total
            : 0
          : votes(rules, offset);
        if (agreement * 2 <= total || (next !== null && known.has(next + '/' + bare.cmd))) continue;
        const distance = (s: Sample) => size(diff(offset, diff(s.start, s.partner)));
        const donor = active.reduce((a, b) => (distance(a) <= distance(b) ? a : b));
        const relative =
          active.length >= 2 &&
          new Set(active.map((s) => s.partner.join())).size >= 2 &&
          active.every((s) => same(diff(s.end, s.partner), diff(donor.end, donor.partner)));
        const landing = relative
          ? add(predicted.p, diff(donor.end, donor.partner))
          : add(predicted.a, diff(donor.end, donor.start));
        if (same(landing, predicted.a) || !fits(landing, ae, rows)) continue;
        const follow = continuation(
          actions,
          donor.edge,
          landing,
          origin,
          ae,
          rows,
          steps,
          bare,
          next,
          known,
          actor,
          useCache
        );
        const use = follow?.step ?? null;
        const key = [
          bare.s,
          actor,
          partner,
          bare.cmd,
          steps.map((s) => s.op).join('>'),
          predicted.a,
          predicted.p,
        ].join('/');
        if (tried['condition/' + key]) continue;
        const fresh = !edges.some((e) =>
          e.effect.moves.some(
            (v) => v.actor === actor && (v.from === landing.join() || v.to === landing.join())
          )
        );
        const anchored = same(origin, predicted.a) && !same(initial, predicted.p);
        const score =
          (4 * agreement) / total +
          Math.min(3, c.weight) +
          (follow?.distinct ? 7 : 0) +
          (use ? 1 : 0) +
          (fresh ? 2 : 0) +
          (anchored ? 2 : 0) +
          (distance(donor) === 0 ? 3 : 0) -
          4 * inferred -
          steps.length / 2;
        const layout = [actor, partner, predicted.p, predicted.a, bare.cmd, landing].join('/');
        if (score <= (ranked.get(layout)?.score ?? -Infinity)) continue;
        ranked.set(layout, {
          score,
          plan: {
            key,
            scene: bare.s,
            actor,
            partner,
            origin,
            without: bare.ref,
            ...(ps ? { alreadyPlaced: ps.length } : {}),
            ...(reconsider ? { reconsideredRef: reconsider.ref } : {}),
            rules,
            ...(frame ? { frame } : {}),
            support: [
              ...new Set([
                bare.ref,
                donor.edge.ref,
                ...active.slice(-2).map((s) => s.edge.ref),
                ...inactive.slice(-2).map((s) => s.edge.ref),
              ]),
            ],
            preparation: steps,
            trigger: { op: bare.cmd, role: actor, from: predicted.a, to: landing, ref: donor.edge.ref },
            use,
            agreement: [agreement, total],
          },
        });
      }
    }
  }
  const top = [...ranked.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  if (!top.length) return null;
  const plan = top[0]!.plan;
  plan.alternatives = top.map(({ plan: p }) => ({
    partner: p.partner,
    location: p.preparation.at(-1)!.to,
    departure: p.trigger.from,
    trigger: p.trigger.op,
    landing: p.trigger.to,
    use: p.use ? { op: p.use.op, to: p.use.to } : null,
    preparation: p.preparation.map((s) => s.op),
    agreement: p.agreement,
  }));
  return plan;
}

export function placementStep(trial: ConditionalTrial) {
  const { plan, index } = trial;
  return plan.preparation[index] ?? (index === plan.preparation.length ? plan.trigger : plan.use);
}
const location = (o: NativeObservation, id: string) =>
  o.entities.find((e) => e.signature === id && !e.identity_ambiguous)?.position.join();
export function placementOffer(
  trial: ConditionalTrial,
  o: NativeObservation,
  available: Set<string>
): Experiment | null {
  const step = placementStep(trial);
  if (!step || !available.has(step.op) || location(o, step.role) !== step.from.join()) return null;
  const { plan, index } = trial,
    n = plan.preparation.length;
  if (index < n && location(o, plan.actor) !== step.actorFrom!.join()) return null;
  if (index === n && location(o, plan.partner) !== plan.preparation[n - 1]!.to.join()) return null;
  return {
    phase: index < n ? 'conditionSetup' : index === n ? 'conditionTrigger' : 'conditionUse',
    origin: trial.scene,
    a: step.op,
    b: step.op,
    refs: [...new Set([...plan.support, step.ref, ...(step.actorRef === undefined ? [] : [step.actorRef])])],
    rule: 'test_motion_after_solving_a_spatial_condition',
    condition: trial,
  };
}
export function placementReceipt(
  m: Memory,
  trial: ConditionalTrial,
  dest: number,
  before: NativeObservation,
  after: NativeObservation
) {
  const step = placementStep(trial)!,
    { plan, index } = trial,
    n = plan.preparation.length;
  m.condition = null;
  m.attempts['condition/' + plan.key] = after.revision;
  const exact =
    location(before, step.role) === step.from.join() && location(after, step.role) === step.to.join();
  const held =
    index >= n ||
    (location(before, plan.actor) === step.actorFrom!.join() &&
      location(after, plan.actor) === step.actorTo!.join());
  const boundary = after.levels_completed > before.levels_completed || after.state === 'WIN';
  const result = boundary
    ? 'official_completion'
    : after.state !== before.state
      ? 'condition_terminal'
      : !exact || !held
        ? 'condition_refuted'
        : index < n
          ? 'condition_placed'
          : index === n
            ? 'condition_activated'
            : 'condition_used';
  if (result === 'condition_placed' || (result === 'condition_activated' && plan.use))
    m.condition = { plan, index: index + 1, scene: dest };
  if (
    result === 'condition_refuted' &&
    index < n &&
    location(after, plan.actor) &&
    location(after, plan.partner) &&
    (location(after, plan.actor) !== location(before, plan.actor) ||
      location(after, plan.partner) !== location(before, plan.partner))
  ) {
    m.reconsiderPlacement = {
      originScene: plan.scene,
      scene: dest,
      actor: plan.actor,
      partner: plan.partner,
      trigger: plan.trigger.op,
      ref: after.revision,
    };
  }
  if (result === 'condition_activated' && !plan.reuseRef) {
    const learned = (m.conditionLearned ??= {});
    if (!learned[plan.key]) {
      const { alternatives, reconsideredRef, ...recipe } = plan;
      learned[plan.key] = { plan: recipe, landingScene: dest, ref: after.revision };
      const keys = Object.keys(learned);
      if (keys.length > 32) delete learned[keys[0]!];
    }
  }
  return {
    result,
    detail: { ...trial, expected: step.to, actual: location(after, step.role) ?? null, held },
  };
}
