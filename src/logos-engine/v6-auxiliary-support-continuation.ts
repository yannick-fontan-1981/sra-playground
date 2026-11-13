/** Exact current-mode recall and suffix admission from support_continuation.py. */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { auxiliarySupportPatch as patch, auxiliarySupportPut as put, auxiliarySupportInside as inside } from './v6-auxiliary-support-preparation.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const clone = <T>(value: T): T => structuredClone(value);

export function auxiliarySupportModeKey(aux: R): string {
  return identity([aux.epoch, aux.selected_patch.length, aux.floor, aux.selected_patch]);
}
export function auxiliarySupportSceneKey(rows: NativeRows, aux: R): string {
  const clean = rows.map(row => [...row]), q = aux.selected_patch.length;
  put(clean, aux.box, Array.from({ length: q }, () => Array(q).fill(aux.floor)));
  return identity(clean.slice(1, -1).map(row => row.slice(1, -1)));
}
export function auxiliarySupportRecall(models: R, aux: R, available: readonly string[]): R {
  const key = auxiliarySupportModeKey(aux), model = models[key], result: R = {};
  if (!truth(model)) return result;
  for (const [action, record] of Object.entries(model.controls) as [string, R][]) {
    const deltas = new Map<string, readonly number[]>();
    for (const witness of record.witnesses) deltas.set(JSON.stringify(witness.delta), witness.delta);
    if (available.includes(action) && deltas.size === 1 && !truth(record.counterexamples)) {
      result[action] = { delta: [...deltas.values()][0]!.slice(), model_ref: key, acquisition_epoch: model.epoch,
        evidence: record.witnesses.flatMap((witness: R) => witness.evidence).slice(-16),
        scope: 'Same selected pattern, stride, revealed support and epoch; different occurrence is a conditional application with per-primitive falsifiers.' };
    }
  }
  return result;
}
export function auxiliarySupportObservedModel(models: R, aux: R, action: string, delta: readonly number[], evidence: readonly string[], refutation: R | null = null): R {
  const key = auxiliarySupportModeKey(aux), model = clone(models[key] ?? { epoch: aux.epoch, quantum: aux.selected_patch.length,
    selected_pattern_digest: identity(aux.selected_patch), controls: {} });
  const record = model.controls[action] ??= { witnesses: [], counterexamples: [] };
  if (truth(refutation)) record.counterexamples.push({ evidence, cause: 'Expected effect refuted in the current geometry; control versus support cause unresolved.', detail: refutation });
  else record.witnesses.push({ delta: [...delta], evidence: [...evidence], occurrence: aux.selection_ref });
  return { kind: 'coupled_support_control_model', model_ref: key, model };
}
export function auxiliarySupportCovered(step: R, aux: R): boolean {
  const action = step.action_ref, delta = [step.to[0] - step.from[0], step.to[1] - step.from[1]];
  const actual = (aux.measured_moves ?? {})[action], prior = (aux.recalled_moves ?? {})[action];
  return equal(actual ?? null, delta) || !!(truth(prior) && equal(prior.delta, delta));
}
export function auxiliarySupportPrefix(route: R, aux: R, rows: NativeRows, limit: number): R[] {
  const clean = rows.map(row => [...row]), q = aux.selected_patch.length, result: R[] = [];
  put(clean, aux.box, Array.from({ length: q }, () => Array(q).fill(aux.floor)));
  let expectedFrom = aux.box;
  for (const original of route.path.slice(0, limit)) {
    const step = clone(original);
    if (!equal(step.from, expectedFrom) || !inside(clean, step.to) || patch(clean, step.to).some(row => row.some(value => value !== aux.floor))) break;
    step.mapping_observed = Object.hasOwn(aux.measured_moves ?? {}, step.action_ref);
    step.mapping_covered = auxiliarySupportCovered(step, aux);
    step.control_provenance = step.mapping_observed ? 'current_selected_occurrence' : step.mapping_covered ? 'conditional_recall' : 'borrowed_mapping_hypothesis';
    step.control_evidence = (aux.recalled_moves ?? {})[step.action_ref]?.evidence ?? [];
    result.push(step); expectedFrom = step.to;
    if (!step.mapping_covered) break;
  }
  return result;
}
export function auxiliarySupportCachedRoute(aux: R, rows: NativeRows): R | null {
  const cached = aux.continuation;
  if (!truth(cached) || cached.scene_key !== auxiliarySupportSceneKey(rows, aux) || !equal(patch(rows, aux.box), aux.selected_patch)) return null;
  const route = clone(cached.route);
  if (route.path.length && !equal(route.path[0].from, aux.box)) return null;
  route.continuation_source = cached.source_ref; return route;
}
/** Mutates only the owned auxiliary copy, exactly at the sealed response. */
export function auxiliarySupportRetainSuffix(aux: R, rows: NativeRows, plan: R, index: number): void {
  const route = clone(plan.detail.parking); route.path = route.path.slice(index + 1);
  aux.continuation = { route, source_ref: plan.observation_ref, scene_key: auxiliarySupportSceneKey(rows, aux),
    scope: 'Same conditional parking goal and geometry, selected role preserved. No planning or SRC reconciliation inside the released prefix.' };
}
