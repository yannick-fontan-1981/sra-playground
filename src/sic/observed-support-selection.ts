import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

/** A control effect acquired from one actual, pose-preserving selection. */
export type ObservedSupportSelection = {
  from: number; to: number; action: string; point: NativePoint; ink: number;
  before: string[]; after: string[]; refs: [string, string];
};

const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((item, i) => item === b[i]);
const scope = (ref: string) => ref.split(':revision:', 1)[0];

export function supportSelectionAt(effects: readonly ObservedSupportSelection[], from: number, to: number,
  action: string, point: NativePoint, markings: readonly string[], rows: NativeRows, ref: string): ObservedSupportSelection | null {
  const matching = effects.filter(effect => effect.from === from && effect.to === to && effect.action === action
    && same(effect.point, point) && same(effect.before, markings) && effect.refs.every(proof => scope(proof) === scope(ref))
    && rows[point[1]]?.[point[0]] === effect.ink);
  if (!matching.length || matching.some(effect => !same(effect.after, matching[0]!.after))) return null;
  return matching[0]!;
}

/** Unknown or contradictory selections cannot acquire a reusable effect. */
export function observeSupportSelection(previous: readonly ObservedSupportSelection[], effect: ObservedSupportSelection,
  preservedPose: boolean, matched: boolean): ObservedSupportSelection[] {
  const other = previous.filter(known => known.from !== effect.from || known.to !== effect.to || known.action !== effect.action);
  if (!preservedPose || !matched || effect.from === effect.to || effect.before.length !== effect.after.length
    || !effect.before.length || effect.before.some((marking, i) => marking === effect.after[i])
    || effect.refs[0] === effect.refs[1] || scope(effect.refs[0]) !== scope(effect.refs[1])) return other;
  return [...other, effect];
}
