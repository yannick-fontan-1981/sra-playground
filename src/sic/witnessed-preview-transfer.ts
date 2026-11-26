import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { same, diff, type XY } from './access-terrain.ts';
import { poseRole } from './occupancy-programs.ts';

import {
  rememberMotion,
  stationaryPivots,
  type PartMotion,
  type WitnessGeometry,
} from './controlled-parts.ts';

type Body = { at: XY; box: readonly number[]; form: string };
export type VisualLayout = Record<string, Body[]>;
type Gesture = { op: string; point?: 'indicator' | 'subject' };
export type PreviewWitness = {
  geometry?: WitnessGeometry;
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
type PredictiveEvidence = {
  hit: number;
  miss: number;
  rivalHit: number;
  rivalMiss: number;
  lastHit?: string;
  lastMiss?: string;
  lastRival?: string;
};
export type VisibleGeometry = { from: XY; indicated: XY; before: string; pivots: { role: string; at: XY }[] };
export type WitnessedBinding = {
  producer?: import('./seek-missing-preview.ts').CueProducer;
  displays?: VisibleGeometry[];
  calibration?: PredictiveEvidence;
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
  calibration?: PredictiveEvidence;
};
import type { TerminalContact } from './terminal-contact.ts';
import type { SituatedWitness } from './situated-preparation.ts';
export type PreviewLearning = {
  cueSearch?: import('./seek-missing-preview.ts').CueSearchMemory;
  recentPreparations?: SituatedWitness[];
  inheritedPreparations?: SituatedWitness[];
  blockedGoal?: {before:string; after:string};
  preparationAttempts?: Record<string,number>;
  testedPreparations?: Record<string,number>;
  terminal?: TerminalContact[];
  goalAttempts?: Record<string, number>;
  terminalBlockedStrokes?: Record<string, true>;
  terminalMotionRefutations?: Record<string, string | null>;
  visitedContacts?: Record<string, number>;
  partMotion?: Record<string, PartMotion>;
  bindings: Record<string, WitnessedBinding>;
  lastActor: Record<string, XY>;
  seen: Record<string, number>;
  rejected: Record<string, number>;
  last: string | null;
  calibratedSites?: Record<string, number>;
  motion: Record<string, Record<string, number>>;
};
export type PreviewCarry = {
  preparations?: SituatedWitness[];
  terminal?: TerminalContact[];
  partMotion?: Record<string, PartMotion>;
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
function rememberVisibleGeometry(learned: PreviewLearning, o: NativeObservation, layout: VisualLayout) {
  for (const b of Object.values(learned.bindings)) {
    const subjects = layout[b.actor],
      marks = layout[b.indicator],
      last = learned.lastActor[b.actor];
    if (!subjects || !marks || !b.witnesses.length) continue;
    const subject = subjects.length === 1 ? subjects[0] : subjects.find((z) => last && same(z.at, last));
    if (!subject) continue;
    const free = marks.filter((z) => !subjects.some((p) => covers(p, z.at)));
    if (free.length !== 1) continue;
    const r = free[0]!,
      prior = b.witnesses.at(-1)!,
      shift = diff(prior.arrived, prior.indicated),
      projected: XY = [r.at[0] + shift[0], r.at[1] + shift[1]];
    const allowed = new Set(b.witnesses.flatMap((w) => w.geometry?.pivots.map((c) => c.role) ?? []));
    const pivots = stationaryPivots(b.actor, b.indicator, subject.at, projected, layout, layout).filter((c) =>
      allowed.has(c.role)
    );
    if (!pivots.length) continue;
    const observations = (b.displays ??= []);
    if (
      observations.some(
        (z) =>
          same(z.from, subject.at) &&
          same(z.indicated, r.at) &&
          pivots.every((c) => z.pivots.some((v) => v.role === c.role && same(v.at, c.at)))
      )
    )
      continue;
    observations.push({ from: subject.at, indicated: r.at, before: o.observation_ref, pivots });
    if (observations.length > 24) observations.splice(1, 1);
  }
}
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
  rememberVisibleGeometry(learned, b, before);
  calibrateVisibleReadings(learned, b, a, before, after, command);
  for (const [actor, parts] of Object.entries(before)) {
    const motion = moved(parts, after[actor] ?? []);
    if (!motion) continue;
    learned.lastActor[actor] = motion.to.at;
    rememberMotion(learned, actor, motion.from.at, motion.to.at, command, b, a);
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
        geometry: { pivots: stationaryPivots(actor, indicator, motion.from.at, motion.to.at, before, after, b) },
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
  rememberVisibleGeometry(learned, a, after);
}
export function carryPreviewBindings(
  learned: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation
): PreviewCarry | null {
  if (
    scope(a) !== scope(b) ||
    a.levels_completed !== b.levels_completed + 1 ||
    (!Object.keys(learned.bindings).length && !learned.terminal?.length && !learned.recentPreparations?.length)
  )
    return null;
  return {
    scope: scope(b),
    fromEpoch: b.level_epoch,
    completed: a.levels_completed,
    bindings: structuredClone(learned.bindings),
    ...(learned.recentPreparations?.length ? {
      preparations: learned.recentPreparations.map(w => ({...structuredClone(w), completionRef: a.observation_ref})),
    } : {}),
    ...(learned.terminal?.length ? { terminal: structuredClone(learned.terminal) } : {}),
    partMotion: Object.fromEntries(
      Object.entries(learned.partMotion ?? {})
        .filter(
          ([id]) =>
            Object.values(learned.bindings).some((x) => x.actor === id) ||
            learned.terminal?.some((x) => x.actor === id) || learned.recentPreparations?.some(w=>w.actor===id)
        )
        .map(([id, m]) => [
          id,
          {
            axes: structuredClone(m.axes),
            displacements: structuredClone(m.displacements ?? m.axes),
            sites: {},
            substrate: {},
          },
        ])
    ),
  };
}
export function acceptPreviewCarry(c: PreviewCarry | null | undefined, o: NativeObservation) {
  const learned = newPreviewLearning();
  if (c && scope(o) === c.scope && o.level_epoch === c.fromEpoch + 1 && o.levels_completed === c.completed) {
    learned.bindings = structuredClone(c.bindings);
    if (c.terminal?.length) learned.terminal = structuredClone(c.terminal);
    if (c.preparations?.length) learned.inheritedPreparations=structuredClone(c.preparations);
    learned.partMotion = structuredClone(c.partMotion ?? {});
  }
  return learned;
}
function visibleReadings(
  learned: PreviewLearning,
  o: NativeObservation,
  layout: VisualLayout,
  available: Set<string>
) {
  const choices: { offer: ReadOffer; legacy: number }[] = [];
  for (const [key, b] of Object.entries(learned.bindings)) {
    let best: ReadOffer | null = null,
      bestScore = -Infinity;
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
    if (best) choices.push({ offer: best, legacy: bestScore });
  }
  return choices;
}

function calibrateVisibleReadings(
  learned: PreviewLearning,
  b: NativeObservation,
  a: NativeObservation,
  before: VisualLayout,
  after: VisualLayout,
  command: string
) {
  const seen = (learned.calibratedSites ??= {});
  for (const { offer } of visibleReadings(learned, b, before, new Set(b.available_action_refs))) {
    const id = JSON.stringify([b.frame_hash, command, offer.key, offer.from, offer.indicated]);
    if (seen[id] !== undefined) continue;
    const measured = measureWitnessedArrival(offer, b, a, before, after);
    if (measured.status !== 'realized' && measured.status !== 'contradicted') continue;
    const binding = learned.bindings[offer.key]!;
    const s = (binding.calibration ??= { hit: 0, miss: 0, rivalHit: 0, rivalMiss: 0 });
    // Bound exposure per relation. The first distinct tests remain inspectable across repeated cycles.
    if (s.hit + s.miss + s.rivalHit + s.rivalMiss >= 256) continue;
    seen[id] = a.revision;
    const hit = measured.status === 'realized';
    if (offer.command === command) {
      if (hit) {
        s.hit++;
        s.lastHit = a.observation_ref;
      } else {
        s.miss++;
        s.lastMiss = a.observation_ref;
      }
    } else {
      if (hit) s.rivalHit++;
      else s.rivalMiss++;
      s.lastRival = a.observation_ref;
    }
  }
}
export function offerWitnessedPreview(
  learned: PreviewLearning,
  o: NativeObservation,
  layout: VisualLayout,
  available: Set<string>,
  bindingKey?: string
): ReadOffer | null {
  const readings = visibleReadings(learned, o, layout, available);
  const choices = (bindingKey ? readings.filter(c=>c.offer.key===bindingKey) : readings).sort((a, b) => b.legacy - a.legacy);
  const command = choices[0]?.offer.command;
  if (!command) return null;
  let best: ReadOffer | null = null,
    precision = -1,
    selectivity = -Infinity;
  for (const { offer } of choices) {
    if (offer.command !== command) continue;
    const s = learned.bindings[offer.key]!.calibration;
    const p = s ? (s.hit + 1) / (s.hit + s.miss + 2) : 0.5;
    const background = s ? (s.rivalHit + 1) / (s.rivalHit + s.rivalMiss + 2) : 0.5;
    if (p < precision || (p === precision && p - background <= selectivity)) continue;
    precision = p;
    selectivity = p - background;
    best = s ? { ...offer, calibration: { ...s } } : offer;
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
