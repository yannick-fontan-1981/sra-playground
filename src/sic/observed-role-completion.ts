import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

/** A new level's final raster cannot serve as evidence for the old role's effect. */
export function publicCompletionFrames(before: NativeObservation, after: NativeObservation,
  second: NativeRows, frames: readonly NativeRows[]): readonly NativeRows[] {
  if (after.levels_completed !== before.levels_completed + 1) return [];
  if (before.level_epoch === after.level_epoch && before.level === after.level) return [...frames, second];
  return frames.filter(rows => rows.length !== second.length || rows.some((row, y) => row.length !== second[y]?.length
    || row.some((value, x) => value !== second[y]?.[x])));
}

/** Advance a proved role only after its own public effect confirms the boundary. */
export function continueRoleAfterPublicCompletion<T extends { completed: number; evidence?: readonly string[] }>(
  role: T, before: NativeObservation, after: NativeObservation, effectConfirmed: boolean, evidence: readonly string[] = [],
): T | null {
  if (!effectConfirmed || role.completed !== before.levels_completed || after.levels_completed !== before.levels_completed + 1) return null;
  return { ...role, completed: after.levels_completed,
    evidence: [...new Set([...(role.evidence ?? []), ...evidence, before.observation_ref, after.observation_ref])] };
}
