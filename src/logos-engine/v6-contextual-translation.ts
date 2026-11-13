/** Exact contextual_translation.py exposure measurement over public snapshots.
 * Source: V6 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. An exposure is a
 * falsifiable control experiment; it does not attest a movement or grant input
 * authority. The caller retains the source acquisition and budget guards. */
import { compareUnicode } from './canonical.ts';
import { compositionIdentity, registered, relativeMotion } from './v6-composition-memory.ts';
import type { CompositionTransition, Snapshot } from './v6-composition-memory.ts';
import { componentSignatures, motionFootprint } from './v6-motion-contrast.ts';
import { geometricComponents } from './v6-native-observer.ts';
import { pythonEqual as same } from './v6-operations.ts';
import type { NativePoint } from './v6-native-types.ts';

export interface ContextualTranslationExposure {
  readonly evidence: readonly [string, string, string];
  readonly observed_delta: NativePoint;
  readonly predicted_origin: NativePoint;
  readonly projected_destination: NativePoint;
  readonly surface_ref: string;
  readonly alternate_outcomes: readonly ['blocked_again', 'different_translation', 'nonlocal_effect'];
  readonly role_signatures: readonly string[];
  readonly distinct_prior_success_origins: 1;
}
type Trial = { before: Snapshot; after: Snapshot; origin: NativePoint; delta: NativePoint };
const key = (value: unknown): string => JSON.stringify(value);
const nonzero = ([x, y]: NativePoint): boolean => x !== 0 || y !== 0;

/** Preserve the original order of guards and first matching positive witness.
 * All registered same-epoch history contributes to coherent-track measurement,
 * including unavailable commands and outcomes not registered to current. The
 * latter are excluded only when collecting trials for an admitted command. */
export async function contextualTranslationExposures(history: readonly CompositionTransition[], current: Snapshot,
  commands: readonly string[]): Promise<Record<string, ContextualTranslationExposure>> {
  history = history.filter(([before, , after]) => before.epoch === current.epoch && after.epoch === current.epoch && registered(before, after));
  if (!history.length) return {};
  const shared = Object.keys(current.roles).filter(signature => history.every(([before, , after]) =>
    Object.hasOwn(before.roles, signature) && Object.hasOwn(after.roles, signature)));
  const tracks = new Map<string, string[]>();
  for (const signature of shared.sort(compareUnicode)) {
    const deltas = history.map(([before, , after]) => relativeMotion(before, after, signature)!);
    if (deltas.some(nonzero)) {
      const at = key(deltas), signatures = tracks.get(at) ?? [];
      signatures.push(signature); tracks.set(at, signatures);
    }
  }
  if (tracks.size !== 1) return {};
  const signatures = [...tracks.values()][0]!;
  const boxes = signatures.map(signature => current.roles[signature]!);
  const left = Math.min(...boxes.map(box => box[0])), top = Math.min(...boxes.map(box => box[1]));
  const size: NativePoint = [Math.max(...boxes.map(box => box[2])) - left + 1, Math.max(...boxes.map(box => box[3])) - top + 1];
  // geometry.pairs(rows)[1] is the unchanged components(rows) projection. Its
  // paired-pattern result is not consumed by contextual_translation.py.
  const parts = geometricComponents(current.rows), measured = await componentSignatures(parts);
  const tracked = new Set(signatures), pixels = new Set<string>();
  for (const part of parts) if (tracked.has(measured.get(part)!)) {
    const [x, y] = part.bbox;
    for (const [i, j] of part.mask) pixels.add(key([x + i, y + j]));
  }
  if (pixels.size !== size[0] * size[1]) return {};
  const position = (scene: Snapshot): NativePoint => [Math.min(...signatures.map(signature => scene.roles[signature]![0])),
    Math.min(...signatures.map(signature => scene.roles[signature]![1]))];
  const origin = position(current);
  const byCommand = new Map<string, Trial[]>(commands.map(command => [command, []]));
  for (const [before, command, after] of history) {
    const trials = byCommand.get(command);
    if (!trials || !registered(after, current)) continue;
    const from = position(before), to = position(after);
    trials.push({ before, after, origin: from, delta: [to[0] - from[0], to[1] - from[1]] });
  }
  const eligible = new Map<string, ContextualTranslationExposure>();
  for (const [command, trials] of byCommand) {
    const vectors = new Map(trials.filter(trial => nonzero(trial.delta)).map(trial => [key(trial.delta), trial.delta]));
    if (vectors.size !== 1) continue;
    const delta = [...vectors.values()][0]!;
    const positives = trials.filter(trial => same(trial.delta, delta)), blocked = trials.filter(trial => !nonzero(trial.delta));
    if (!blocked.length || new Set(positives.map(trial => key(trial.origin))).size !== 1) continue;
    if (trials.some(trial => same(trial.origin, origin))) continue;
    const projected = (scene: Snapshot, at: NativePoint): number[] | null => motionFootprint(scene.rows, [at[0] + delta[0], at[1] + delta[1]], size);
    const surface = projected(current, origin);
    if (surface === null || blocked.some(trial => same(projected(trial.before, trial.origin), surface))) continue;
    const witness = positives.find(trial => same(projected(trial.before, trial.origin), surface));
    if (!witness) continue;
    eligible.set(command, {
      evidence: [witness.before.ref, witness.after.ref, current.ref], observed_delta: [...delta], predicted_origin: [...origin],
      projected_destination: [origin[0] + delta[0], origin[1] + delta[1]], surface_ref: await compositionIdentity(surface),
      alternate_outcomes: ['blocked_again', 'different_translation', 'nonlocal_effect'], role_signatures: [...signatures],
      distinct_prior_success_origins: 1,
    });
  }
  return Object.fromEntries(eligible);
}
