/** Three exact V5 service subsets, kept separate from native coordination. */
import transferred from './v6/outline-recovery.json' with { type: 'json' };
import { NativeDrmRegistry, factConditionHolds, projectDeclaredAlternatives } from './v6-drm-projector.ts';
import type { DrmCondition } from './v6-drm-projector.ts';
import type { JsonObject } from './ir.ts';
import { V6_NATIVE_PROGRAM_REFERENCE } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { outlineEqual } from './v6-outline-identity.ts';

type R = Record<string, any>;
export type OutlineRecoveryMode = 'announced_rejoin' | 'overlaid_capture' | 'adjacent_capture';
export const OUTLINE_RECOVERY_SUBSETS = retainNativeJson(transferred.subsets);
export const OUTLINE_RECOVERY_ORDER: readonly OutlineRecoveryMode[] = ['announced_rejoin', 'overlaid_capture', 'adjacent_capture'];
const registries = new Map<string, Promise<NativeDrmRegistry>>();
async function registry(mode: OutlineRecoveryMode): Promise<NativeDrmRegistry> {
  if (!registries.has(mode)) registries.set(mode, (async () => {
    const subset = OUTLINE_RECOVERY_SUBSETS[mode];
    if (transferred.schema !== 'logos-engine.v5.outline-recovery-subsets.v1'
      || subset.referenceCommit !== V6_NATIVE_PROGRAM_REFERENCE) throw new TypeError('Outline recovery source mismatch');
    const value = new NativeDrmRegistry();
    await value.registerSource(subset.document.text, subset.document.sha256); value.seal(); return value;
  })());
  return registries.get(mode)!;
}
export async function evaluateOutlineRecoverySubset(mode: OutlineRecoveryMode, facts: JsonObject): Promise<R> {
  if (typeof facts.candidate_ref !== 'string' || !facts.candidate_ref) throw new TypeError('Recovery requires a current candidate reference');
  const subset = OUTLINE_RECOVERY_SUBSETS[mode], drm = await registry(mode), [policy] = drm.resolve(subset.subsetPolicyRef);
  const result = projectDeclaredAlternatives({ drm, selection_policy_ref: subset.subsetPolicyRef,
    alternative_refs: [facts.candidate_ref], descriptive_facts: facts });
  const projected = result.alternative_facts[facts.candidate_ref] as JsonObject;
  const matchedTier = (subset.selectionTier.all_conditions as readonly DrmCondition[]).every(condition => factConditionHolds(condition, projected));
  const complete = outlineEqual(result.projection_refs, (policy.fact_projections ?? []).map(value => value.id));
  return { projection_result: result, projected_facts: projected, matched_tier_ref: matchedTier ? subset.selectionTier.id : null,
    all_required_projections_matched: complete, matched: complete && matchedTier };
}
