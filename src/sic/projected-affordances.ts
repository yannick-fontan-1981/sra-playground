import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Experiment, Memory } from './preparation-experiments.ts';
import { point, same, terrain, type XY } from './access-terrain.ts';
import { allocateHorizon, contactAspirations } from './contact-aspirations.ts';
import { supportProjection } from './projected-support.ts';
import {
  equalLayout,
  spatialControls,
  layoutId,
  samplesFor,
  type Layout,
  type Roles,
} from './projected-motion.ts';

type Control = { role: string; held: string; from: Layout; expected: Layout };
type Step = {
  control?: Control;
  interaction?: Destination;
  op: string;
  from: Layout;
  to: Layout;
  refs: number[];
};
type Destination = { role: string; feature: string; position: XY };
export type Prospect = {
  roles: Roles;
  steps: Step[];
  arrival: number;
  goals: Destination[];
  score: number;
  region: boolean;
};
export type Trial = {
  plan: Prospect;
  index: number;
  alternatives?: { placement: Layout; arrival: Layout; after: Layout; score: number }[];
};
export type ProjectionMemory = { active: Trial | null; attempted: Record<string, number>; plans: number };
export const newProjectionMemory = (): ProjectionMemory => ({ active: null, attempted: {}, plans: 0 });
function mobilePairs(m: Memory, o: NativeObservation) {
  const visible = new Set(o.entities.filter((e) => !e.identity_ambiguous).map((e) => e.signature));
  const moved = new Set(
    m.edges.flatMap((e) => e.effect.moves.map((v) => v.actor)).filter((id) => visible.has(id))
  );
  const pairs: { roles: Roles; score: number }[] = [];
  const ids = [...moved].sort();
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const roles: Roles = [ids[i]!, ids[j]!];
      let switches = 0,
        independent = 0,
        observed = 0;
      const moving = new Set<string>();
      for (const e of m.edges) {
        if (!e.stable || !roles.every((id) => e.anchors[id] && e.visibleAfter?.includes(id))) continue;
        const a = e.effect.moves.find((v) => v.actor === roles[0]),
          b = e.effect.moves.find((v) => v.actor === roles[1]);
        if (!a && !b) continue;
        observed++;
        moving.add(e.cmd);
        if (!a || !b || a.dx !== b.dx || a.dy !== b.dy) independent++;
        if (a && b && a.to === b.from && b.to === a.from) switches++;
      }
      if (independent && moving.size >= 2)
        pairs.push({
          roles,
          score: Math.min(35, independent) + Math.min(15, observed) + Math.min(3, switches) * 20,
        });
    }
  return pairs.sort((a, b) => b.score - a.score);
}
const shown = (o: NativeObservation, roles: Roles): Layout | null => {
  const found = roles.map(
    (id) => o.entities.find((e) => !e.identity_ambiguous && e.signature === id)?.position
  );
  return found.every(Boolean) ? (found as Layout) : null;
};
const key = (roles: Roles, p: Layout, op: string) => [...roles, layoutId(p), op].join('/');
function distance(e: NativeEntity, p: XY, target: NativeEntity) {
  const right = p[0] + e.bbox[2] - e.bbox[0],
    bottom = p[1] + e.bbox[3] - e.bbox[1];
  return (
    Math.max(0, target.bbox[0] - right, p[0] - target.bbox[2]) +
    Math.max(0, target.bbox[1] - bottom, p[1] - target.bbox[3])
  );
}
function catalogue(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  scene: number,
  roles: Roles
) {
  const bodies = roles.map((id) => o.entities.find((e) => e.signature === id)!) as [
    NativeEntity,
    NativeEntity,
  ];
  const initial = shown(o, roles)!;
  const mobile = new Set(m.edges.flatMap((e) => e.effect.moves.map((v) => v.actor)));
  const floors = bodies.map((b) => terrain(rows, b, mobile, o, m.space.floor));
  const traces = samplesFor(m.edges, roles, available);
  const models = spatialControls(traces, available);
  if (models.length < 2) return [];
  const poses = new Set<string>(),
    reached = [new Set<string>(), new Set<string>()];
  const measured = new Map<string, Layout | null>();
  const receipts = new Map<string, number>();
  for (const [op, samples] of traces)
    for (const s of samples) {
      for (const p of [s.before, s.after]) {
        poses.add(layoutId(p));
        for (const i of [0, 1]) reached[i]!.add(p[i]!.join());
      }
      const k = key(roles, s.before, op),
        prev = measured.get(k);
      receipts.set(k, s.ref);
      measured.set(k, prev === undefined || (prev && equalLayout(prev, s.after)) ? s.after : null);
    }
  const supports = new Map(
    models.map((model) => [
      model.op,
      supportProjection(
        model,
        bodies,
        rows,
        floors.map((f) => f.ground),
        reached
      ),
    ])
  );
  const features = o.entities.filter(
    (e) => !mobile.has(e.signature) && e.area > 0 && e.area <= (rows.length * rows[0]!.length) / 12
  );
  const bestDistances = bodies.map((body, i) => {
    const locations = [...reached[i]!].map(point);
    return new Map(
      features.map((f) => [
        f.id,
        Math.min(distance(body, initial[i]!, f), ...locations.map((p) => distance(body, p, f))),
      ])
    );
  });
  const aspire = contactAspirations(bodies, features, models, reached, initial);
  const startRegions = floors.map((f, i) => f.region(initial[i]!));
  const seenRegions = floors.map((f, i) => new Set([...reached[i]!].map((k) => f.region(point(k)))));
  const evaluations = new Map<string, { score: number; goals: Destination[]; region: boolean }>();
  function interest(p: Layout) {
    const id = layoutId(p),
      known = evaluations.get(id);
    if (known) return known;
    const goals: Destination[] = [];
    let closeness = 0,
      novel = 0,
      region = false;
    for (const i of [0, 1]) {
      const body = bodies[i]!,
        pt = p[i]!,
        r = floors[i]!.region(pt);
      if (r && !seenRegions[i]!.has(r) && r !== startRegions[i]) region = true;
      if (!reached[i]!.has(pt.join())) novel++;
      let proximity = 0;
      for (const f of features) {
        const d = distance(body, pt, f);
        if (d === 0) goals.push({ role: roles[i]!, feature: f.id, position: pt });
        const improvement = Math.max(0, bestDistances[i]!.get(f.id)! - d);
        proximity = Math.max(proximity, 8 / (1 + d) + Math.min(24, improvement) * 1.5);
      }
      closeness += proximity;
    }
    const score = new Set(goals.map((g) => g.role)).size * 20 + closeness + (region ? 35 : 0) + novel * 5;
    const v = { score, goals, region };
    evaluations.set(id, v);
    return v;
  }
  // Evaluate contact and continuation relative to layouts the real agent has already reached.
  const goalKey = (g: Destination) => g.role + '/' + g.feature;
  const knownGoals = new Set<string>(),
    knownPairs = new Set<string>();
  for (const s of traces.values())
    for (const pair of s)
      for (const p of [pair.before, pair.after]) {
        const gs = interest(p).goals.map(goalKey);
        for (const g of gs) knownGoals.add(g);
        knownPairs.add(gs.sort().join('|'));
      }
  const inside = (p: XY, e: NativeEntity) =>
    p[0] >= 0 &&
    p[1] >= 0 &&
    p[0] + e.bbox[2] - e.bbox[0] < rows[0]!.length &&
    p[1] + e.bbox[3] - e.bbox[1] < rows.length;
  const exact = m.edges.filter((e) => e.s === scene);
  const originScore = interest(initial).score;
  const plans: Prospect[] = [];
  function nominate(plan: Prospect) {
    const end = plan.steps.at(-1)!;
    plan.score += aspire(end.to).reward;
    // Find the transformation that actually depends on the placement while leaving
    // at least one following action to exercise its effect.
    for (let i = plan.arrival; i >= 0; i--) {
      if (plan.steps[i]!.control) {
        plan.arrival = i;
        plan.score += 24;
        break;
      }
    }
    if (plans.length === 5 && plans[4]!.score >= plan.score) return;
    const dest = plan.steps[plan.arrival]!;
    const index = plans.findIndex(
      (c) => equalLayout(c.steps[c.arrival]!.to, dest.to) && c.steps.at(-1)!.op === plan.steps.at(-1)!.op
    );
    if (index >= 0) {
      if (plans[index]!.score >= plan.score) return;
      plans.splice(index, 1);
    }
    plans.push(plan);
    plans.sort((a, b) => b.score - a.score);
    if (plans.length > 5) plans.pop();
  }
  // A control which has not moved these two roles may interact only after contact.
  const interactionOps = [...available].filter((op) => !models.some((model) => model.op === op));
  const initialGoals = new Set(interest(initial).goals.map(goalKey));
  const queue: { p: Layout; path: Step[]; uncertainty: number }[] = [
    { p: initial, path: [], uncertainty: 0 },
  ];
  const visited = new Set([layoutId(initial)]);
  let depth = 0;
  for (let index = 0; index < queue.length && index < 2200; index++) {
    if (queue[index]!.path.length !== depth) {
      depth = queue[index]!.path.length;
      const layer = queue.splice(index);
      const keep = new Set(allocateHorizon(layer, aspire, 64));
      for (const n of layer) if (!keep.has(n)) visited.delete(layoutId(n.p));
      queue.push(...keep);
    }
    const n = queue[index]!;
    if (n.path.length) {
      const dest = interest(n.p);
      for (const g of dest.goals) {
        if (initialGoals.has(goalKey(g))) continue;
        const f = features.find((e) => e.id === g.feature)!;
        for (const op of interactionOps) {
          const click = op.split(':')[1]?.split(',').map(Number);
          if (
            click &&
            (click[0]! < f.bbox[0] || click[0]! > f.bbox[2] || click[1]! < f.bbox[1] || click[1]! > f.bbox[3])
          )
            continue;
          const testKey = key(roles, n.p, op);
          if (measured.has(testKey) || m.projection.attempted[testKey]) continue;
          const refs = n.path.at(-1)!.refs;
          const step: Step = { op, from: n.p, to: n.p, refs, interaction: g };
          const score =
            dest.score +
            (knownGoals.has(goalKey(g)) ? 5 : 34) +
            10 -
            n.path.length * 1.35 -
            n.uncertainty * 4;
          nominate({
            roles,
            steps: [...n.path, step],
            arrival: n.path.length - 1,
            goals: dest.goals,
            score,
            region: dest.region,
          });
        }
      }
    }
    for (const model of models) {
      const id = key(roles, n.p, model.op),
        actual = measured.get(id);
      if ((m.projection.attempted[id] && actual === undefined) || actual === null) continue;
      if (!n.path.length && exact.some((e) => e.cmd === model.op && (!e.stable || e.s === e.t))) continue;
      const expected = actual ?? supports.get(model.op)!(n.p);
      const variants: { pose: Layout; cost: number }[] = [];
      const crossed = expected.map(
        (p, i) =>
          !same(p, n.p[i]!) &&
          floors[i]!.ground >= 0 &&
          floors[i]!.region(n.p[i]!) > 0 &&
          !floors[i]!.region(p) &&
          !reached[i]!.has(p.join())
      );
      if (
        !actual &&
        crossed[0] !== crossed[1] &&
        expected.every((p, i) => !same(p, n.p[i]!)) &&
        model.rules.every((rule, i) => rule.formula.source === i)
      ) {
        const held = crossed[0] ? 0 : 1;
        const separate: Layout = [expected[0], expected[1]];
        separate[held] = n.p[held]!;
        variants.push({ pose: separate, cost: 1.4 });
      }
      variants.push({
        pose: expected,
        cost: actual ? 0 : crossed.some(Boolean) ? 3 : model.inferred ? 1.8 : 0.35,
      });
      for (const { pose: after, cost } of variants) {
        if (equalLayout(n.p, after) || after.some((p, i) => !inside(p, bodies[i]!))) continue;
        const uncertainty = n.uncertainty + cost;
        let control: Control | undefined;
        if (n.path.length) {
          for (const i of [0, 1]) {
            const j = 1 - i;
            if (same(n.p[j]!, initial[j]!) || same(n.p[i]!, after[i]!)) continue;
            const arm: Layout = [n.p[0], n.p[1]];
            arm[j] = initial[j]!;
            const known = measured.get(key(roles, arm, model.op));
            if (known === null) continue;
            const bare = known ?? supports.get(model.op)!(arm);
            if (!same(bare[i]!, after[i]!)) {
              control = { role: roles[i]!, held: roles[j]!, from: arm, expected: bare };
              break;
            }
          }
        }
        const step: Step = {
            op: model.op,
            from: n.p,
            to: after,
            refs: actual ? [receipts.get(id)!] : model.refs,
            ...(control ? { control } : {}),
          },
          path = [...n.path, step];
        const dest = interest(n.p),
          later = interest(after),
          land = n.path.at(-1);
        const lastKnown = poses.has(layoutId(after)),
          beforeKnown = poses.has(layoutId(n.p));
        if (land && (!lastKnown || !beforeKnown) && (!actual || !beforeKnown)) {
          const gs = later.goals.map(goalKey),
            newContact = gs.some((g) => !knownGoals.has(g));
          const joint =
            new Set(later.goals.map((g) => g.role)).size > 1 && !knownPairs.has(gs.sort().join('|'));
          const change = land.from.some((p, i) => !same(p, n.p[i]!));
          if (
            change &&
            (dest.region ||
              later.region ||
              newContact ||
              joint ||
              later.score > originScore + 4 ||
              aspire(after).reward > 8)
          ) {
            const score =
              (dest.score + later.score) / 2 +
              (newContact ? 35 : 0) +
              (joint ? 30 : 0) +
              (dest.region && later.region ? 20 : 0) +
              (beforeKnown ? 0 : 4) -
              path.length * 1.35 -
              uncertainty * 4;
            nominate({
              roles,
              steps: path,
              arrival: path.length - 2,
              goals: later.goals,
              score,
              region: dest.region || later.region,
            });
          }
        }
        const k = layoutId(after);
        if (!visited.has(k) && path.length < 36 && queue.length < 4800) {
          visited.add(k);
          queue.push({ p: after, path, uncertainty });
        }
      }
    }
  }
  return plans.sort((a, b) => b.score - a.score).slice(0, 5);
}

export function proposeProjection(
  m: Memory,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  scene: number
): Experiment | null {
  let trial = m.projection.active;
  if (trial) {
    const step = trial.plan.steps[trial.index]!,
      p = shown(o, trial.plan.roles);
    if (!p || !equalLayout(p, step.from) || !available.has(step.op)) trial = null;
  }
  if (!trial) {
    m.projection.active = null;
    if (m.turns < 6 || m.recurrences < 2) return null;
    const choices = mobilePairs(m, o)
      .slice(0, 2)
      .flatMap(({ roles }) => catalogue(m, o, rows, available, scene, roles))
      .sort((a, b) => b.score - a.score);
    if (!choices.length) return null;
    const plan = choices[0]!;
    trial = {
      plan,
      index: 0,
      alternatives: choices.slice(1, 4).map((c) => ({
        placement: c.steps[c.arrival]!.from,
        arrival: c.steps[c.arrival]!.to,
        after: c.steps[c.arrival + 1]!.to,
        score: c.score,
      })),
    };
  }
  const s = trial.plan.steps[trial.index]!;
  return {
    phase: 'projection',
    origin: scene,
    a: s.op,
    b: s.op,
    rule: 'project_layout_and_continuation',
    refs: s.refs,
    projection: trial,
  };
}
export function recordProjection(m: Memory, x: Trial, b: NativeObservation, a: NativeObservation) {
  const { plan, index } = x,
    step = plan.steps[index]!,
    positions = shown(a, plan.roles);
  const won = a.levels_completed > b.levels_completed || a.state === 'WIN';
  const matched = !!positions && equalLayout(positions, step.to);
  const feature = step.interaction && b.entities.find((e) => e.id === step.interaction!.feature);
  const interaction =
    feature &&
    !a.entities.some(
      (e) => e.signature === feature.signature && same([...e.position], [...feature.position])
    );
  const result = won
    ? 'official_completion'
    : step.interaction
      ? interaction
        ? 'contact_effect_verified'
        : 'contact_effect_refuted'
      : !matched
        ? 'projection_refuted'
        : index === plan.arrival
          ? 'arrival_verified'
          : index === plan.arrival + 1
            ? 'continuation_verified'
            : index > plan.arrival + 1
              ? 'subsequent_step_verified'
              : 'placement_verified';
  const id = key(plan.roles, step.from, step.op);
  m.projection.attempted[id] = (m.projection.attempted[id] ?? 0) + 1;
  if (!index) m.projection.plans++;
  m.projection.active =
    matched && !won && a.level_epoch === b.level_epoch && a.state === b.state && index + 1 < plan.steps.length
      ? { plan, index: index + 1 }
      : null;
  return {
    result,
    detail: {
      roles: plan.roles,
      placement: plan.steps[plan.arrival]!.from,
      destination: plan.steps[plan.arrival]!.to,
      subsequent: plan.steps[plan.arrival + 1]!.interaction ?? plan.steps[plan.arrival + 1]!.to,
      control: plan.steps[plan.arrival]!.control ?? null,
      continuation: plan.steps[plan.arrival + 1]!.op,
      goals: plan.goals,
      region: plan.region,
      program: plan.steps.map((s) => s.op),
      index,
      expected: step.to,
      observed: positions,
      alternatives: x.alternatives ?? [],
    },
  };
}
