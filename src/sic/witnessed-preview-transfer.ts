import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { same, diff, type XY } from './access-terrain.ts';
import { poseRole } from './occupancy-programs.ts';

type Body = { at: XY; box: readonly number[]; form: string };
export type VisualLayout = Record<string, Body[]>;
type Gesture = { op: string; point?: 'indicator' | 'subject' };
export type PreviewWitness = {
  before: string;
  after: string;
  epoch: number;
  command: string;
  from: XY;
  indicated: XY;
  arrived: XY;
  peers: XY[];
  fromBox: readonly number[];
  arrivedBox: readonly number[];
  indicatorForm: string;
  subjectForm: string;
  indicatorChanged: boolean;
};
export type WitnessedBinding = {
  relation: 'indicator_marks_subject_arrival_after_action';
  actor: string;
  indicator: string;
  gesture: Gesture;
  witnesses: PreviewWitness[];
};
export type ReadOffer = {
  kind: 'action_conditioned_subject_arrival';
  key: string;
  actor: string;
  indicator: string;
  gesture: Gesture;
  command: string;
  from: XY;
  indicated: XY;
  peers: XY[];
  before: string;
  epoch: number;
  basis: 'observed_here' | 'observed_in_previous_level';
  witness: PreviewWitness;
};
export type PreviewLearning = {
  bindings: Record<string, WitnessedBinding>;
  lastActor: Record<string, XY>;
  seen: Record<string, number>;
  rejected: Record<string, number>;
  last: string | null;
  motion: Record<string, Record<string, number>>;
};
export type PreviewCarry = {
  scope: string;
  fromEpoch: number;
  completed: number;
  bindings: Record<string, WitnessedBinding>;
};
export const newPreviewLearning = (): PreviewLearning => ({
  bindings: {},
  lastActor: {},
  seen: {},
  rejected: {},
  last: null,
  motion: {},
});
const views = new WeakMap<NativeObservation, VisualLayout>();
export function visualLayout(o: NativeObservation, rows: NativeRows): VisualLayout {
  const old = views.get(o);
  if (old) return old;
  const result: VisualLayout = {},
    max = (rows.length * rows[0]!.length) / 12;
  for (const e of o.entities) {
    if (e.area > max) continue;
    const box = e.bbox,
      k = poseRole(e);
    (result[k] ??= []).push({ at: [box[0] + box[2], box[1] + box[3]], box, form: e.signature });
  }
  views.set(o, result);
  return result;
}
const covers = (b: Body, p: XY) =>
  p[0] >= 2 * b.box[0]! && p[0] <= 2 * b.box[2]! && p[1] >= 2 * b.box[1]! && p[1] <= 2 * b.box[3]!;
const member = (g: Body[], p: XY) => g.some((b) => same(b.at, p));
const scope = (o: NativeObservation) => o.observation_ref.split(':epoch:')[0]!;
const moved = (old: Body[], next: Body[]) => {
  if (!old.length || old.length !== next.length) return null;
  const before = old.filter((b) => !member(next, b.at)),
    after = next.filter((b) => !member(old, b.at));
  return before.length === 1 && after.length === 1
    ? { from: before[0]!, to: after[0]!, peers: old.filter((b) => b !== before[0]).map((b) => b.at) }
    : null;
};
function gesture(command: string, p: Body, r: Body): Gesture | null {
  if (!command.startsWith('ACTION6:')) return { op: command };
  const [x, y] = command.slice(8).split(',').map(Number),
    pt: XY = [x! * 2, y! * 2];
  return covers(r, pt)
    ? { op: 'ACTION6', point: 'indicator' }
    : covers(p, pt)
      ? { op: 'ACTION6', point: 'subject' }
      : null;
}
const keyOf = (p: string, r: string, g: Gesture) => JSON.stringify([p, r, g.op, g.point ?? null]);
const contextKey = (k: string, from: XY, to: XY) => JSON.stringify([k, from, to]);
export function observePreviewBindings(
  learned: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  before: VisualLayout,
  after: VisualLayout,
  command: string
) {
  if (
    scope(a) !== scope(b) ||
    b.level_epoch !== a.level_epoch ||
    b.state !== a.state ||
    b.levels_completed !== a.levels_completed
  )
    return;
  const event = b.observation_ref + '/' + command + '/' + a.observation_ref;
  if (learned.last === event) return;
  learned.last = event;
  for (const [actor, parts] of Object.entries(before)) {
    const motion = moved(parts, after[actor] ?? []);
    if (!motion) continue;
    learned.lastActor[actor] = motion.to.at;
    const vector = diff(motion.to.at, motion.from.at),
      motors = (learned.motion[actor] ??= {});
    const z = JSON.stringify([command, vector]);
    motors[z] = (motors[z] ?? 0) + 1;
    for (const [indicator, markers] of Object.entries(before)) {
      if (indicator === actor) continue;
      const targets = markers.filter(
        (r) =>
          covers(motion.to, r.at) && !covers(motion.from, r.at) && !motion.peers.some((p) => same(p, r.at))
      );
      if (targets.length !== 1) continue;
      const r = targets[0]!,
        g = gesture(command, motion.from, r);
      if (!g) continue;
      const k = keyOf(actor, indicator, g),
        binding = (learned.bindings[k] ??= {
          relation: 'indicator_marks_subject_arrival_after_action',
          actor,
          indicator,
          gesture: g,
          witnesses: [],
        });
      if (
        binding.witnesses.some(
          (w) =>
            w.before === b.observation_ref ||
            (w.epoch === b.level_epoch &&
              same(w.indicated, r.at) &&
              same(w.from, motion.from.at) &&
              w.subjectForm === motion.to.form)
        )
      )
        continue;
      const witness: PreviewWitness = {
        before: b.observation_ref,
        after: a.observation_ref,
        epoch: b.level_epoch,
        command,
        from: motion.from.at,
        indicated: r.at,
        arrived: motion.to.at,
        peers: motion.peers,
        fromBox: motion.from.box,
        arrivedBox: motion.to.box,
        indicatorForm: r.form,
        subjectForm: motion.to.form,
        indicatorChanged: !member(after[indicator] ?? [], r.at),
      };
      binding.witnesses.push(witness);
      // Keep a bounded, diverse set. Preserve the first observation from each still represented epoch when possible.
      if (binding.witnesses.length > 12) {
        const n = binding.witnesses.findIndex(
          (w, i, all) => i > 0 && i < all.length - 1 && all.slice(0, i).some((x) => x.epoch === w.epoch)
        );
        binding.witnesses.splice(n > 0 ? n : 1, 1);
      }
    }
  }
}
export function carryPreviewBindings(
  learned: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation
): PreviewCarry | null {
  if (
    scope(a) !== scope(b) ||
    a.levels_completed !== b.levels_completed + 1 ||
    !Object.keys(learned.bindings).length
  )
    return null;
  return {
    scope: scope(b),
    fromEpoch: b.level_epoch,
    completed: a.levels_completed,
    bindings: structuredClone(learned.bindings),
  };
}
export function acceptPreviewCarry(c: PreviewCarry | null | undefined, o: NativeObservation) {
  const learned = newPreviewLearning();
  if (c && scope(o) === c.scope && o.level_epoch === c.fromEpoch + 1 && o.levels_completed === c.completed)
    learned.bindings = structuredClone(c.bindings);
  return learned;
}
export function offerWitnessedPreview(
  learned: PreviewLearning,
  o: NativeObservation,
  layout: VisualLayout,
  available: Set<string>
): ReadOffer | null {
  let best: ReadOffer | null = null,
    bestScore = -Infinity;
  for (const [key, b] of Object.entries(learned.bindings)) {
    const subjects = layout[b.actor] ?? [],
      markers = layout[b.indicator] ?? [],
      last = learned.lastActor[b.actor];
    const subject =
      subjects.length === 1 ? subjects[0] : last ? subjects.find((v) => same(v.at, last)) : null;
    if (!subject || !markers.length) continue;
    const prior = b.witnesses.at(-1)!;
    const inherited = b.witnesses.every((w) => w.epoch !== o.level_epoch),
      failures = learned.rejected[key] ?? 0;
    if (failures >= Math.max(2, new Set(b.witnesses.map((w) => w.indicated.join())).size)) continue;
    for (const mark of markers) {
      if (covers(subject, mark.at) || subjects.some((v) => v !== subject && covers(v, mark.at))) continue;
      const target = b.gesture.point === 'subject' ? subject : mark;
      const command = b.gesture.point
        ? 'ACTION6:' + Math.floor(target.at[0] / 2) + ',' + Math.floor(target.at[1] / 2)
        : b.gesture.op;
      if (!available.has(command) && !(b.gesture.point && o.available_action_refs.includes('ACTION6')))
        continue;
      if (learned.seen[contextKey(key, subject.at, mark.at)] !== undefined) continue;
      const novel = b.witnesses.every((w) => w.epoch !== o.level_epoch || !same(w.indicated, mark.at));
      const v = JSON.stringify([command, diff(mark.at, subject.at)]);
      const unusual = (learned.motion[b.actor]?.[v] ?? 0) === 0;
      // A repeated ordinary step gives little evidence about a displayed mark.
      if (!inherited && !novel && !unusual) continue;
      const score =
        8 * Number(inherited) +
        5 * Number(novel) +
        3 * Number(unusual) +
        2 * Number(prior.indicatorChanged) +
        Number(prior.peers.length > 0) +
        Math.min(3, b.witnesses.length) -
        3 * failures;
      if (score <= bestScore) continue;
      bestScore = score;
      best = {
        kind: 'action_conditioned_subject_arrival',
        key,
        actor: b.actor,
        indicator: b.indicator,
        gesture: b.gesture,
        command,
        from: subject.at,
        indicated: mark.at,
        peers: subjects.filter((v) => v !== subject).map((v) => v.at),
        before: o.observation_ref,
        epoch: o.level_epoch,
        basis: inherited ? 'observed_in_previous_level' : 'observed_here',
        witness: prior,
      };
    }
  }
  return best;
}
export function measureWitnessedArrival(
  x: ReadOffer,
  b: NativeObservation,
  a: NativeObservation,
  before: VisualLayout,
  after: VisualLayout
) {
  const live =
    x.before === b.observation_ref &&
    scope(a) === scope(b) &&
    b.level_epoch === a.level_epoch &&
    b.state === a.state &&
    b.levels_completed === a.levels_completed;
  const prior = before[x.actor] ?? [],
    now = after[x.actor] ?? [],
    origin = prior.find((body) => same(body.at, x.from));
  const identified = !!origin && now.length === prior.length && x.peers.every((p) => member(now, p));
  const rest = identified ? now.filter((body) => !x.peers.some((p) => same(p, body.at))) : [];
  const otherMotion = !identified && origin ? moved(prior, now) : null;
  const otherMoved = otherMotion && !same(otherMotion.from.at, x.from);
  const subject = rest.length === 1 ? rest[0] : otherMoved ? now.find((body) => same(body.at, x.from)) : null;
  const status = !live
    ? 'inapplicable'
    : !subject
      ? 'unobserved'
      : !same(subject.at, x.from) && covers(subject, x.indicated)
        ? 'realized'
        : 'contradicted';
  return { forecast: x, status, actual: subject?.at ?? null, actualBox: subject?.box ?? null };
}
export function checkWitnessedPreview(
  learned: PreviewLearning,
  x: ReadOffer,
  b: NativeObservation,
  a: NativeObservation,
  before: VisualLayout,
  after: VisualLayout,
  command: string
) {
  const measured = measureWitnessedArrival(x, b, a, before, after);
  const status = command === x.command ? measured.status : 'inapplicable';
  if (status !== 'inapplicable') {
    learned.seen[contextKey(x.key, x.from, x.indicated)] = a.revision;
    if (status === 'contradicted') learned.rejected[x.key] = (learned.rejected[x.key] ?? 0) + 1;
  }
  return { ...measured, status };
}
