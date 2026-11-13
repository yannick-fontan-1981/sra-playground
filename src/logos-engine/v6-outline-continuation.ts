/** Explicit native coordination witness from five exact V5 declarations.
 * The source Outline proposal and guards stay unchanged. This subset only
 * describes one current announced service; it does not select a caller family
 * or authorize an action, and never invents the caller's no-effect evidence. */
import transferred from './v6/outline-continuation.json' with { type: 'json' };
import { NativeDrmRegistry, factConditionHolds, projectDeclaredAlternatives } from './v6-drm-projector.ts';
import type { DrmCondition } from './v6-drm-projector.ts';
import { V6_NATIVE_PROGRAM_REFERENCE } from './v6-src-program.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { symbolicDigest } from './v6-hash.ts';
import { outlineEqual as same, outlineUnique as unique } from './v6-outline-identity.ts';
import { isJsonObject } from './canonical.ts';
import type { JsonObject } from './ir.ts';
import type { NativeBeforeResult, NativeObservation, NativeRecord, NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const record = (value: unknown): value is R => isJsonObject(value);
const ref = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const refs = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(ref);
export const OUTLINE_CONTINUATION_SUBSET = retainNativeJson(transferred);
let registryPromise: Promise<NativeDrmRegistry> | null = null;
function registry(): Promise<NativeDrmRegistry> {
  return registryPromise ??= (async () => {
    if (OUTLINE_CONTINUATION_SUBSET.schema !== 'logos-engine.v5.outline-continuation-subset.v1'
      || OUTLINE_CONTINUATION_SUBSET.referenceCommit !== V6_NATIVE_PROGRAM_REFERENCE) throw new TypeError('Outline continuation subset reference mismatch');
    const drm = new NativeDrmRegistry();
    await drm.registerSource(OUTLINE_CONTINUATION_SUBSET.document.text, OUTLINE_CONTINUATION_SUBSET.document.sha256);
    drm.seal(); return drm;
  })();
}

/** The three original projections run in their original relative order. The
 * one retained tier is tested by the common exact DRM matcher. This is not a
 * SELECT result from the complete original policy. */
export async function evaluateOutlineContinuationSubset(facts: JsonObject): Promise<R> {
  if (!ref(facts.candidate_ref)) throw new TypeError('Outline continuation requires a candidate reference');
  const drm = await registry(), selection = OUTLINE_CONTINUATION_SUBSET.subsetPolicyRef;
  const [policy] = drm.resolve(selection);
  const result = projectDeclaredAlternatives({ drm, selection_policy_ref: selection,
    alternative_refs: [facts.candidate_ref], descriptive_facts: facts });
  const projected = result.alternative_facts[facts.candidate_ref] as JsonObject;
  const retainedTier = OUTLINE_CONTINUATION_SUBSET.selectionTier;
  const tier = (retainedTier.all_conditions as readonly DrmCondition[]).every(condition => factConditionHolds(condition, projected))
    ? retainedTier : undefined;
  const expected = (policy.fact_projections ?? []).map(value => value.id);
  const complete = same(result.projection_refs, expected);
  return { projection_result: result, projected_facts: projected, matched_tier_ref: tier?.id ?? null,
    all_required_projections_matched: complete, matched: complete && tier !== undefined };
}

/** A complete, exact-context caller trial is required. The owner does not infer
 * no effect from its local-operator attempt dictionary or a repeated raster. */
export function outlineRequiredServiceTrialCurrent(proposal: R, observation: NativeObservation,
  trial: NativeRecord, state: R): boolean {
  if (!record(proposal) || proposal.status !== 'proposed' || proposal.kind !== 'public_outline_service'
    || !Array.isArray(proposal.actions) || proposal.actions.length !== 1
    || !Array.isArray(proposal.steps) || proposal.steps.length !== 1 || !record(proposal.binding)
    || !record(trial) || trial.status !== 'untried_exact_public_context' || trial.domain_complete !== true
    || trial.attempted_without_effect_in_current_context !== false || !ref(trial.trial_key) || !refs(trial.evidence_refs)
    || !trial.evidence_refs.includes(observation.observation_ref) || state.epoch !== observation.level_epoch
    || !record(state.control) || state.control.level_epoch !== observation.level_epoch
    || !ref(observation.observation_ref) || !ref(observation.frame_hash)) return false;
  const command = proposal.actions[0];
  if (!record(command) || !ref(command.action_ref)
    || command.data !== undefined && (!record(command.data) || Object.keys(command.data).length !== 0)
    || trial.action_ref !== command.action_ref || !observation.available_action_refs.includes(command.action_ref)) return false;
  return ['observation_ref', 'level_epoch', 'frame_hash'].every(field =>
    trial[field] === observation[field] && proposal.binding[field] === observation[field])
    && proposal.binding.levels_completed === observation.levels_completed;
}

/** Only the four original SRC receipt fields enter this source view. Native
 * execution traces remain intact in the actual proposal and graph. No field
 * outside the three named receipt locations is removed or rewritten. */
function sourceReceipt(value: R): R {
  return Object.fromEntries(['workflow', 'src_hash', 'src_status', 'executed_statements'].map(key => [key, value[key]]));
}
function sourceMeasurement(value: R): R { return { ...value, control_workflow: sourceReceipt(value.control_workflow) }; }
function sourceProposalView(proposal: R): R {
  return {
    status: proposal.status, kind: proposal.kind, actions: proposal.actions, steps: proposal.steps,
    facts: proposal.facts, binding: proposal.binding,
    outline_plan: { ...proposal.outline_plan, measurement: sourceMeasurement(proposal.outline_plan.measurement),
      workflow: sourceReceipt(proposal.outline_plan.workflow) },
    route_refs: proposal.route_refs,
    compositions: proposal.compositions.map((value: R) => ({ ...value, properties: { ...value.properties,
      current_measurement: sourceMeasurement(value.properties.current_measurement) } })),
    question: proposal.question, bundle_template: proposal.bundle_template,
  };
}

/** `current` is regenerated by the strict source component from the actual
 * rows. The public method on OutlineService is the entry point that performs
 * this remeasurement; callers cannot promote a retained measurement alone. */
export async function currentOutlineRequiredServiceWitness(proposal: R, current: R,
  observation: NativeObservation, rows: NativeRows, currentTrial: NativeRecord,
  state: R, sourceGuard: NativeBeforeResult, interactionAction: string, historicalMethodRevalidation = false): Promise<NativeRecord | null> {
  if (!outlineRequiredServiceTrialCurrent(proposal, observation, currentTrial, state)
    || sourceGuard.admitted !== true || !record(current)
    || current.outline_plan?.meaning?.kind !== 'announced_correspondence_hypothesis'
    || current.outline_plan.operator !== false || current.steps?.[0]?.seal_after !== true
    || !record(proposal.outline_plan?.measurement?.control_workflow)
    || !record(proposal.outline_plan?.workflow) || !Array.isArray(proposal.compositions)
    || proposal.compositions.some((value: R) => !record(value.properties?.current_measurement?.control_workflow))) return null;
  const rowsHash = symbolicDigest(rows);
  if (rowsHash.slice(0, 16) !== observation.frame_hash || !same(sourceProposalView(proposal), sourceProposalView(current))) return null;
  const measured = current.outline_plan.measurement, relation = measured.relation, command = current.actions[0];
  const choices = Object.entries(measured.accompaniment ?? {}), control = state.control;
  const local = (state.methods as R[]).filter(event => event.status === 'observed_local_change'
    && (event.scope === observation.level_epoch || historicalMethodRevalidation && event.scope < observation.level_epoch) && event.local_count > 0
    && event.action?.action_ref === interactionAction && refs(event.evidence) && ref(event.local_delta_sha256));
  const transitions = (control.transitions as R[]).filter(value => value.level_epoch === observation.level_epoch);
  const recalled = historicalMethodRevalidation && control.status === 'recalled_outline_hypothesis_current_unique'
    && refs(control.recalled_method?.evidence) && transitions.length === 0;
  const controlEvidence = recalled ? control.recalled_method.evidence : control.evidence;
  if (choices.length !== 1 || choices[0]![0] !== command.action_ref
    || measured.facts.unique_mobile_correspondence !== true || measured.facts.local_operator_observed !== true
    || measured.facts.lead_on_announced_cell !== true || relation.controlled_lead_bbox_matches_cardinal_marker_cell !== true
    || local.length === 0 || !refs(controlEvidence) || !recalled && control.interior_contrast !== true
    || !recalled && transitions.length < 1 || transitions.length > 64 || !same(measured.current_transitions, transitions)) return null;
  const evidence = unique([observation.observation_ref, ...controlEvidence, ...local.flatMap(event => event.evidence),
    ...(currentTrial.evidence_refs as string[])]);
  const identity = sourceProposalView(current), proposalRef = `outline_service:${symbolicDigest(identity)}`;
  const facts: JsonObject = { ...relation, candidate_ref: proposalRef, action_ref: command.action_ref,
    interaction_measurement_kind: 'discrete', candidate_matches_compact_body_hollow_perimeter_marker_direction: true,
    attempted_without_effect_in_current_context: currentTrial.attempted_without_effect_in_current_context as boolean };
  const interpreted = await evaluateOutlineContinuationSubset(facts);
  if (!interpreted.matched || interpreted.projected_facts.remaining_action_bound !== 1
    || interpreted.projected_facts.full_metaplan_reprojection_required_after_primitive !== true
    || interpreted.projected_facts.replan_after_each_primitive_declared !== true
    || interpreted.projected_facts.declared_complete_series_authorized !== false) return null;
  return retainNativeJson({ schema: 'logos-engine.native.outline-required-service.v1',
    rule: 'native.current_announced_outline_service_before_independent_contact', status: 'current_required_service',
    observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
    action_ref: command.action_ref, trial_key: currentTrial.trial_key, proposal_ref: proposalRef,
    proposal_identity_profile: 'source_outline_proposal_with_four_original_src_receipt_fields.v1',
    current_rows_sha256: rowsHash, current_trial: currentTrial,
    source_subset: { reference_commit: OUTLINE_CONTINUATION_SUBSET.referenceCommit, source_path: OUTLINE_CONTINUATION_SUBSET.sourcePath,
      source_sha256: OUTLINE_CONTINUATION_SUBSET.sourceSha256, subset_sha256: OUTLINE_CONTINUATION_SUBSET.document.sha256,
      original_policy_ref: OUTLINE_CONTINUATION_SUBSET.sourceSelectionPolicyRef,
      declaration_refs: OUTLINE_CONTINUATION_SUBSET.sourcePointers.map(value => value.id),
      qualification: OUTLINE_CONTINUATION_SUBSET.qualification,
      wrapper_qualification: OUTLINE_CONTINUATION_SUBSET.wrapperQualification },
    source_condition_receipt: interpreted, source_guard: sourceGuard,
    current_measurement: measured, current_control: control, local_operator_evidence: local,
    ...(historicalMethodRevalidation ? { method_evidence_scope: local.every(value => value.scope === observation.level_epoch)
      ? 'current_epoch_observed' : 'historical_conditional_method_with_current_visual_rebinding',
      control_evidence_scope: recalled ? 'historical_control_current_unique_hypothesis' : 'current_epoch_observed' } : {}),
    evidence_refs: evidence, primitive_bound: 1, replan_after_each_primitive: true,
    release_authority: false, action_effect_known: false, terminal_rule_known: false,
    unknown: ['next_local_effect', 'autonomous_policy', 'terminal_rule', 'contact_consequence'],
    qualification: historicalMethodRevalidation
      ? 'The source V6 any-observed-local-method premise is re-used conditionally after current visual revalidation. Historical effects remain historical; no current effect or future path is inferred. The exact caller trial and ordinary guards still control one primitive.'
      : 'The currently remeasured announced relation and an actual same-epoch local intervention support one conditional service question. The exact caller trial is retained separately; historical evidence grants no current action permission, and this limited V5 subset is not the unchanged V6 caller order.' });
}
