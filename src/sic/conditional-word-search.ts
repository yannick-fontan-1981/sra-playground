import { add, diff, same, size, type XY } from './access-terrain.ts';
import type { Role } from './exchange-roles.ts';

export type Arm = 'prepared' | 'bare' | 'durationControl';
export type WordEffect = {
  patient: XY | null;
  marker: XY | null;
  entered: boolean;
  win: boolean;
  frame: string;
  afterFirst: { p: XY | null; r: XY | null } | null;
  ref: number;
};
type Measurement = { bare?: WordEffect; prepared?: WordEffect; durationControl?: WordEffect };
export type WordQuestion = {
  id: string;
  alphabet: string[];
  prepare: string;
  rival: string;
  site: Role;
  traveller: string;
  patient: XY;
  marker: XY;
  ideal: XY;
  onset: number;
  ordinal: number;
  observations: Record<number, Measurement>;
  uses: number;
};
export type CapacityBinding = {
  kind: 'actuate' | 'transport';
  word: string[];
  op: string;
  relative: XY;
  markerDelta: XY;
  patientDelta: XY;
  refs: number[];
  sameScene: boolean;
};

// Breadth by length, lexicographic within length. Repetitions are legal and the alphabet is fixed at discovery.
export function wordAt(alphabet: readonly string[], ordinal: number): string[] {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || !alphabet.length)
    throw Error('Expected an ordinal and a nonempty actuator alphabet');
  if (alphabet.length === 1) return Array<string>(ordinal + 1).fill(alphabet[0]!);
  let count = alphabet.length,
    length = 1;
  while (ordinal >= count) {
    ordinal -= count;
    count *= alphabet.length;
    length++;
  }
  const word = Array<string>(length);
  for (let i = length - 1; i >= 0; i--) {
    word[i] = alphabet[ordinal % alphabet.length]!;
    ordinal = Math.floor(ordinal / alphabet.length);
  }
  return word;
}
export function nextArm(
  q: WordQuestion,
  justPrepared: boolean
): { arm: Arm; word: string[]; ordinal: number } | null {
  const outcomes = q.observations[q.ordinal] ?? {},
    word = wordAt(q.alphabet, q.ordinal);
  if (justPrepared && outcomes.prepared) return null;
  const arm: Arm = justPrepared
    ? 'prepared'
    : !outcomes.bare
      ? 'bare'
      : !outcomes.prepared
        ? 'prepared'
        : 'durationControl';
  return { arm, word, ordinal: q.ordinal };
}
export function recordArm(
  q: WordQuestion,
  ordinal: number,
  arm: Arm,
  effect: WordEffect
): CapacityBinding | null {
  const outcomes = (q.observations[ordinal] ??= {});
  if (outcomes[arm]) return null;
  outcomes[arm] = effect;
  if (!outcomes.bare || !outcomes.prepared || !outcomes.durationControl) return null;
  if (q.ordinal === ordinal) q.ordinal++;
  const a = outcomes.prepared,
    b = outcomes.bare,
    clock = outcomes.durationControl;
  const ap = a.afterFirst,
    cp = clock.afterFirst;
  if (
    !ap?.p ||
    !ap.r ||
    !cp?.p ||
    !cp.r ||
    !a.marker ||
    !a.patient ||
    !b.marker ||
    !b.patient ||
    !clock.marker ||
    !clock.patient ||
    !same(ap.p, cp.p)
  )
    return null;
  // Attribute a newly actuated marker only when the prefix left it at the same observed pose.
  const actuates =
    same(ap.r, q.marker) &&
    same(cp.r, ap.r) &&
    same(b.marker, q.marker) &&
    !same(a.marker, q.marker) &&
    !same(clock.marker, a.marker);
  // If the prefix actually relocated the marker, test whether the traveller acquired a new movement.
  const transports =
    !same(ap.r, q.marker) &&
    same(ap.p, q.patient) &&
    same(b.patient, q.patient) &&
    !same(a.patient, q.patient) &&
    !same(clock.patient, a.patient);
  if (!actuates && !transports) return null;
  return {
    kind: transports ? 'transport' : 'actuate',
    word: wordAt(q.alphabet, ordinal),
    op: q.prepare,
    relative: diff(q.patient, q.marker),
    markerDelta: diff(a.marker, q.marker),
    patientDelta: diff(a.patient, q.patient),
    refs: [b.ref, clock.ref, a.ref],
    sameScene: a.frame === b.frame && a.frame === clock.frame,
  };
}
export function transferBinding(law: CapacityBinding, marker: XY, patient: XY, ideal: XY, landing?: XY) {
  if (!same(diff(patient, marker), law.relative)) return null;
  const result = add(marker, law.markerDelta);
  const nextPatient = add(patient, law.patientDelta);
  if (law.kind === 'transport') {
    if (!landing || size(diff(nextPatient, landing)) >= size(diff(patient, landing))) return null;
  } else if (size(diff(result, ideal)) >= size(diff(marker, ideal))) return null;
  return { word: [law.op, ...law.word], marker: result, patient: add(patient, law.patientDelta) };
}
