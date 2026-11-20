import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { contactEvidence } from './contact-aspirations.ts';
import type { Experiment } from './preparation-experiments.ts';
import { add, diff, point, same, type XY } from './access-terrain.ts';
import { equalLayout, layoutId, type Layout } from './projected-motion.ts';
import {
  groupsOf,
  observedExchanges,
  poseOf,
  resolveRole,
  type Groups,
  type RolePair,
} from './exchange-roles.ts';

type Action = { op: string; role?: number; offset?: XY };
type Example = { op: string; before: Layout; after: Layout; ref: number };
type Relation = {
  key: string;
  roles: RolePair;
  action: Action;
  swaps: Example[];
  ordinary: Example[];
  failed: number;
  completed: number;
};
type Step = { op: string; before: Layout; after: Layout; kind: 'prepare' | 'exchange' | 'use' };
type Aim = { member: number; feature: string; at: XY; gap: number; directGap: number; value: number };
type Program = {
  aims: Aim[];
  key: string;
  roles: RolePair;
  relation: string;
  steps: Step[];
  score: number;
  refs: number[];
  alternatives: { placement: Layout; arrival: Layout; next: Layout }[];
};
export type ExchangeTrial = { program: Program; index: number };
export type ExchangeMemory = {
  relations: Relation[];
  tried: Record<string, number>;
  active: ExchangeTrial | null;
};
export const newExchangeMemory = (): ExchangeMemory => ({ relations: [], tried: {}, active: null });
const swap = (p: Layout): Layout => [p[1], p[0]];
const contains = (p: XY, box: readonly number[]) =>
  p[0] >= box[0]! && p[0] <= box[2]! && p[1] >= box[1]! && p[1] <= box[3]!;
function bind(op: string, g: Groups, roles: RolePair): Action {
  if (!op.startsWith('ACTION6:')) return { op };
  const p = point(op.slice(8));
  const i = roles.findIndex((r) => contains(p, resolveRole(g, r)!.bbox));
  return i < 0
    ? { op }
    : { op: 'ACTION6', role: i, offset: diff(p, [...resolveRole(g, roles[i]!)!.position]) };
}
const commandAt = (act: Action, p: Layout) =>
  act.role === undefined ? act.op : 'ACTION6:' + add(p[act.role]!, act.offset!).join();
function include(list: Example[], e: Example) {
  if (list.some((s) => s.op === e.op && equalLayout(s.before, e.before) && equalLayout(s.after, e.after)))
    return;
  if (list.length >= 48) list.shift();
  list.push(e);
}
export function observeExchange(m: ExchangeMemory, b: NativeObservation, a: NativeObservation, op: string) {
  if (b.level_epoch !== a.level_epoch || b.state !== a.state || b.frame_hash === a.frame_hash) return;
  const before = groupsOf(b),
    after = groupsOf(a);
  for (const roles of observedExchanges(before, after)) {
    const action = bind(op, before, roles),
      key = JSON.stringify([roles, action]);
    if (m.relations.some((r) => r.key === key) || m.relations.length >= 32) continue;
    m.relations.push({ key, roles, action, swaps: [], ordinary: [], failed: 0, completed: 0 });
  }
  for (const r of m.relations) {
    const p = poseOf(before, r.roles),
      q = poseOf(after, r.roles);
    if (!p || !q) continue;
    const sample = { op, before: p, after: q, ref: a.revision };
    if (op === commandAt(r.action, p)) {
      if (equalLayout(q, swap(p)) && !equalLayout(q, p)) include(r.swaps, sample);
    } else if (!op.includes(':') && same(p[0], q[0]) !== same(p[1], q[1])) include(r.ordinary, sample);
  }
}
type Control = { op: string; member: number; delta: XY; ref: number; support: number };
function controls(r: Relation, available: Set<string>) {
  const options = new Map<string, { control: Control; sites: Set<string> }[]>();
  for (const s of r.ordinary) {
    if (!available.has(s.op)) continue;
    const member = same(s.before[0], s.after[0]) ? 1 : 0;
    const delta = diff(s.after[member]!, s.before[member]!);
    const candidates = options.get(s.op) ?? [];
    let v = candidates.find((o) => o.control.member === member && same(o.control.delta, delta));
    if (!v) {
      v = { control: { op: s.op, member, delta, ref: s.ref, support: 0 }, sites: new Set() };
      candidates.push(v);
    }
    v.sites.add(layoutId(s.before));
    v.control.support = v.sites.size;
    v.control.ref = s.ref;
    options.set(s.op, candidates);
  }
  return [...options.values()].flatMap((cs) => {
    cs.sort((a, b) => b.sites.size - a.sites.size);
    return cs[0]!.sites.size > (cs[1]?.sites.size ?? 0) ? [cs[0]!.control] : [];
  });
}
function slide(p: Layout, c: Control): Layout {
  const next: Layout = [p[0], p[1]];
  next[c.member] = add(p[c.member]!, c.delta);
  return next;
}
function catalogue(
  r: Relation,
  g: Groups,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  m: ExchangeMemory
) {
  const p = poseOf(g, r.roles);
  if (!p || !r.swaps.length || r.failed >= 5 || r.completed >= 5) return [];
  const choices = controls(r, available);
  if (!choices.length) return [];
  const bodies = r.roles.map((role) => resolveRole(g, role)!);
  const features = o.entities.filter(
    (e) => !r.roles.some((v) => v.signature === e.signature) && e.area <= (rows.length * rows[0]!.length) / 12
  );
  function distance(i: number, pt: XY, f: readonly number[]) {
    const body = bodies[i]!,
      w = body.bbox[2] - body.bbox[0],
      h = body.bbox[3] - body.bbox[1];
    return Math.max(0, f[0]! - pt[0] - w, pt[0] - f[2]!) + Math.max(0, f[1]! - pt[1] - h, pt[1] - f[3]!);
  }
  function inside(q: Layout) {
    return (
      q.every(([x, y], i) => {
        const box = bodies[i]!.bbox;
        return (
          x >= 0 &&
          y >= 0 &&
          x + box[2] - box[0] < rows[0]!.length &&
          y + box[3] - box[1] < rows.length &&
          !r.roles[i]!.fixed.includes([x, y].join())
        );
      }) && !same(q[0], q[1])
    );
  }
  const weights = bodies.map((b) => features.map((f) => Math.exp(contactEvidence(b, f))));
  const goals = new Map<string, Aim | null>();
  function interest(i: number, q: XY, bare: XY) {
    const key = [i, q, bare].join('/');
    if (goals.has(key)) return goals.get(key) ?? null;
    let aim: Aim | null = null;
    for (const [j, f] of features.entries()) {
      const was = distance(i, bare, f.bbox),
        now = distance(i, q, f.bbox);
      const value = weights[i]![j]! * (Math.min(20, was - now) + 12 / (1 + now));
      if (now < was && (!aim || value > aim.value))
        aim = { member: i, feature: f.signature, at: [...f.position], gap: now, directGap: was, value };
    }
    goals.set(key, aim);
    return aim;
  }
  const plans: Program[] = [];
  // The moving partner fixes which destination the other member can acquire.
  for (const member of [0, 1]) {
    const queue: { p: Layout; steps: Step[]; refs: number[] }[] = [{ p, steps: [], refs: [] }],
      seen = new Set([layoutId(p)]);
    for (const n of queue) {
      if (n.steps.length >= 3) continue;
      for (const c of choices.filter((c) => c.member === member)) {
        const placed = slide(n.p, c),
          lid = layoutId(placed);
        if (
          seen.has(lid) ||
          !inside(placed) ||
          (!n.steps.length && m.tried[JSON.stringify([r.key, o.frame_hash, c.op, placed])])
        )
          continue;
        seen.add(lid);
        const setup: Step[] = [...n.steps, { op: c.op, before: n.p, after: placed, kind: 'prepare' }];
        const refs = [...n.refs, c.ref];
        queue.push({ p: placed, steps: setup, refs });
        const trigger = commandAt(r.action, placed),
          arrived = swap(placed);
        if (
          (!available.has(trigger) && !trigger.startsWith('ACTION6:')) ||
          !inside(arrived) ||
          r.swaps.some((s) => same(s.after[1 - member]!, arrived[1 - member]!))
        )
          continue;
        for (const follow of choices) {
          const next = slide(arrived, follow),
            bare = slide(placed, follow);
          if (!inside(next)) continue;
          const key = JSON.stringify([r.key, placed, follow.op]);
          if (m.tried[key]) continue;
          const aims = [
            interest(1 - member, arrived[1 - member]!, p[1 - member]!),
            interest(follow.member, next[follow.member]!, bare[follow.member]!),
          ].filter((a): a is Aim => !!a);
          const score =
            aims.reduce((n, aim) => n + aim.value, 0) +
            Math.min(4, follow.support + c.support) -
            setup.length * 2;
          plans.push({
            key,
            relation: r.key,
            aims,
            roles: r.roles,
            score,
            alternatives: [],
            refs: [...new Set([r.swaps.at(-1)!.ref, ...refs, follow.ref])],
            steps: [
              ...setup,
              { op: trigger, before: placed, after: arrived, kind: 'exchange' },
              { op: follow.op, before: arrived, after: next, kind: 'use' },
            ],
          });
        }
      }
    }
  }
  return plans;
}
export function exchangeOffer(
  m: ExchangeMemory,
  o: NativeObservation,
  rows: NativeRows,
  available: Set<string>,
  scene: number
): Experiment | null {
  if (!m.relations.length) return null;
  const g = groupsOf(o);
  let trial = m.active;
  if (!trial) {
    const plans = m.relations
      .flatMap((r) => catalogue(r, g, o, rows, available, m))
      .sort((a, b) => b.score - a.score);
    const best = plans[0];
    if (!best) return null;
    const locations = new Set<string>([layoutId(best.steps.at(-2)!.before)]);
    for (const other of plans) {
      const trigger = other.steps.at(-2)!;
      if (other.relation !== best.relation || locations.has(layoutId(trigger.before))) continue;
      best.alternatives.push({
        placement: trigger.before,
        arrival: trigger.after,
        next: other.steps.at(-1)!.after,
      });
      locations.add(layoutId(trigger.before));
      if (best.alternatives.length === 5) break;
    }
    trial = { program: best, index: 0 };
  }
  const { program, index } = trial,
    step = program.steps[index]!;
  const p = poseOf(g, program.roles);
  if (!p || !equalLayout(step.before, p) || !available.has(step.op)) return null;
  return {
    phase: 'placedExchange',
    origin: scene,
    a: '',
    b: step.op,
    rule: 'prepare_exchange_and_use',
    refs: program.refs,
    exchange: trial,
  };
}
export function recordExchange(
  m: ExchangeMemory,
  x: ExchangeTrial,
  b: NativeObservation,
  a: NativeObservation
) {
  const { program, index } = x,
    step = program.steps[index]!;
  const observed = poseOf(groupsOf(a), program.roles);
  const won = a.levels_completed > b.levels_completed || a.state === 'WIN';
  const exact =
    !won &&
    a.level_epoch === b.level_epoch &&
    a.state === b.state &&
    !!observed &&
    equalLayout(step.after, observed);
  m.tried[program.key] = a.revision;
  const r = m.relations.find((r) => r.key === program.relation)!;
  m.active = exact && index + 1 < program.steps.length ? { program, index: index + 1 } : null;
  if (!exact && !won) {
    m.tried[JSON.stringify([r.key, b.frame_hash, step.op, step.after])] = a.revision;
    r.failed++;
  }
  if (exact && step.kind === 'use') r.completed++;
  return {
    result: 'placed_' + step.kind + (won ? '_completion' : exact ? '_verified' : '_refuted'),
    detail: {
      roles: program.roles,
      refs: program.refs,
      index,
      aims: program.aims,
      steps: program.steps,
      alternatives: program.alternatives,
      observed,
      exact,
      won,
    },
  };
}
