/** Bounded public-return context for the optional Outline extension. One
 * actual preceding raster is evidence, never a stored future route. */
import transferred from './v6/outline-public-context.json' with { type: 'json' };
import { NativeDrmRegistry, factConditionHolds, projectDeclaredAlternatives } from './v6-drm-projector.ts';
import type { DrmCondition } from './v6-drm-projector.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { symbolicDigest } from './v6-hash.ts';
import { V6_NATIVE_PROGRAM_REFERENCE } from './v6-src-program.ts';
import { isJsonObject } from './canonical.ts';
import { bindPreservation } from './v6-transition-learning.ts';
import { outlineEqual } from './v6-outline-identity.ts';
import type { JsonObject } from './ir.ts';
import type { NativeObservation, NativeRecord, NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const record = (value: unknown): value is R => isJsonObject(value);
const ref = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const refs = (value: unknown): value is string[] => Array.isArray(value) && value.every(ref);
const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const sha = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const publicFrameRef = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{16}$/.test(value);
const scope = (value: unknown): value is R => record(value) && ref(value.observation_ref) && natural(value.level_epoch)
  && natural(value.levels_completed) && natural(value.revision) && publicFrameRef(value.frame_hash);
const command = (value: unknown): value is R => record(value) && ref(value.action_ref)
  && (value.data === undefined || record(value.data) && Object.values(value.data).every(Number.isFinite));
export const OUTLINE_PUBLIC_OPERATOR_SUBSET = retainNativeJson(transferred);
export const OUTLINE_PUBLIC_TRANSITION_SCHEMA = 'native.outline.public_transition.v1';
export const OUTLINE_ACCOMPANIMENT_GOAL = 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter';
// Pinned V5 capabilities/interaction.py:139, an interface identifier rather
// than an inferred visual role or an application-specific control.
export const OUTLINE_SOURCE_POINT_ACTION_REF = 'ACTION6';
let registryPromise: Promise<NativeDrmRegistry> | null = null;
function registry(): Promise<NativeDrmRegistry> {
  return registryPromise ??= (async () => {
    if (OUTLINE_PUBLIC_OPERATOR_SUBSET.referenceCommit !== V6_NATIVE_PROGRAM_REFERENCE
      || OUTLINE_PUBLIC_OPERATOR_SUBSET.schema !== 'logos-engine.v5.outline-public-operator-subset.v1') throw new TypeError('Outline public operator subset reference mismatch');
    const drm = new NativeDrmRegistry();
    await drm.registerSource(OUTLINE_PUBLIC_OPERATOR_SUBSET.document.text, OUTLINE_PUBLIC_OPERATOR_SUBSET.document.sha256);
    drm.seal(); return drm;
  })();
}
export async function evaluateOutlinePublicOperatorSubset(facts: JsonObject): Promise<R> {
  if (!ref(facts.candidate_ref)) throw new TypeError('Outline public operator requires a candidate reference');
  const drm = await registry(), selection = OUTLINE_PUBLIC_OPERATOR_SUBSET.subsetPolicyRef;
  const [policy] = drm.resolve(selection), result = projectDeclaredAlternatives({ drm, selection_policy_ref: selection,
    alternative_refs: [facts.candidate_ref], descriptive_facts: facts });
  const projected = result.alternative_facts[facts.candidate_ref] as JsonObject, tier = OUTLINE_PUBLIC_OPERATOR_SUBSET.selectionTier;
  const matchedTier = (tier.all_conditions as readonly DrmCondition[]).every(condition => factConditionHolds(condition, projected));
  const required = (policy.fact_projections ?? []).map(value => value.id);
  const complete = result.projection_refs.length === required.length && required.every((value, index) => result.projection_refs[index] === value);
  return { projection_result: result, projected_facts: projected, matched_tier_ref: matchedTier ? tier.id : null,
    all_required_projections_matched: complete, matched: complete && matchedTier };
}
export function outlinePublicScope(observation: NativeObservation): R {
  return Object.fromEntries(['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash', 'revision'].map(field => [field, observation[field]]));
}
export function outlinePhysicalCommand(value: R): R { return { action_ref: value.action_ref, data: value.data ?? {} }; }

/** An explicit source/proposal identity view. Native execution annotations are
 * omitted only at the known SRC receipt sites; the retained proposal and
 * graph keep those traces. Caller coordination annotations are not an input
 * to this candidate's identity. */
export function outlinePublicProposalCore(proposal: R): R {
  const receipt = (value: R): R => Object.fromEntries(['workflow', 'src_hash', 'src_status', 'executed_statements'].map(field => [field, value[field]]));
  const measured = (value: R): R => ({ ...value, control_workflow: receipt(value.control_workflow) });
  return { status: proposal.status, kind: proposal.kind, actions: proposal.actions, steps: proposal.steps,
    facts: proposal.facts, binding: proposal.binding,
    outline_plan: { ...proposal.outline_plan, measurement: measured(proposal.outline_plan.measurement),
      ...(proposal.outline_plan.workflow ? { workflow: receipt(proposal.outline_plan.workflow) } : {}) },
    route_refs: proposal.route_refs,
    compositions: proposal.compositions.map((value: R) => record(value?.properties?.current_measurement?.control_workflow)
      ? { ...value, properties: { ...value.properties, current_measurement: measured(value.properties.current_measurement) } } : value),
    question: proposal.question, bundle_template: proposal.bundle_template,
    ...(Object.hasOwn(proposal, 'preservation') ? { preservation: proposal.preservation } : {}),
    ...(Object.hasOwn(proposal, 'preservation_changes') ? { preservation_changes: proposal.preservation_changes } : {}),
    ...(proposal.requires_current_service_witness === true ? { requires_current_service_witness: true,
      native_outline_public_context: proposal.native_outline_public_context } : {}) };
}

/** Common preservation adds specific compositions and bundle obligations.
 * Reapply that actual producer to the freshly recomputed proposal and compare
 * all of its additions exactly. Nothing is silently removed from the user's
 * action/preservation plan, and other caller mutations remain a mismatch. */
export function outlinePublicProposalMatchesCurrent(proposal: R, current: R,
  observation: NativeObservation, rows: NativeRows): boolean {
  if (!Array.isArray(proposal.compositions)) return false;
  let compared = current;
  if (Object.hasOwn(proposal, 'preservation')) {
    const bound = proposal.preservation;
    if (!record(bound) || !Array.isArray(bound.obligations) || bound.level_epoch !== observation.level_epoch
      || bound.observation_ref !== observation.observation_ref || bound.obligations.some((value: unknown) => !record(value))) return false;
    let protectedProposal: R, rejected: readonly unknown[];
    try { [protectedProposal, rejected] = bindPreservation(current, bound.obligations, observation, rows); }
    catch { return false; } // Malformed caller protection is outside this guard's domain.
    if (rejected.length || protectedProposal.status !== 'proposed' || !outlineEqual(protectedProposal.preservation, bound)) return false;
    compared = protectedProposal;
  }
  return outlineEqual(outlinePublicProposalCore(proposal), outlinePublicProposalCore(compared));
}

/** Validate the entire annex before committing any source or native state. */
export function retainOutlinePublicTransition(value: unknown, sourceState: R): R | null {
  if (value === null) return null;
  const supplied = retainNativeJson(value);
  if (!record(supplied) || supplied.schema !== OUTLINE_PUBLIC_TRANSITION_SCHEMA || !scope(supplied.before) || !scope(supplied.after)
    || supplied.before.level_epoch !== supplied.after.level_epoch || supplied.before.levels_completed !== supplied.after.levels_completed
    || supplied.after.revision !== supplied.before.revision + 1 || supplied.after.level_epoch !== sourceState.epoch
    || !command(supplied.command) || !sha(supplied.before_rows_sha256) || !sha(supplied.after_rows_sha256)
    || supplied.source_state_ref !== `outline_source:${symbolicDigest(sourceState)}`
    || !Array.isArray(supplied.before_rows) || supplied.before_rows.length < 1 || !Array.isArray(supplied.before_rows[0])
    || supplied.before_rows[0].length < 1 || supplied.before_rows.length * supplied.before_rows[0].length > 65_536
    || supplied.before_rows.some((row: unknown) => !Array.isArray(row) || row.length !== supplied.before_rows[0].length
      || row.some(value => !natural(value) || value > 255))
    || symbolicDigest(supplied.before_rows) !== supplied.before_rows_sha256
    || supplied.before_rows_sha256.slice(0, 16) !== supplied.before.frame_hash
    || supplied.after_rows_sha256.slice(0, 16) !== supplied.after.frame_hash) throw new TypeError('Invalid native outline public transition');
  const selected = supplied.selected_outline;
  if (selected !== null && (!record(selected) || !ref(selected.proposal_ref) || !ref(selected.meaning_kind)
    || selected.observation_ref !== supplied.before.observation_ref || selected.frame_hash !== supplied.before.frame_hash
    || selected.level_epoch !== supplied.before.level_epoch || !natural(selected.action_index)
    || !command(selected.command) || symbolicDigest(outlinePhysicalCommand(selected.command)) !== symbolicDigest(outlinePhysicalCommand(supplied.command))
    || selected.guard_admitted !== true || selected.active_goal_ref !== null && !ref(selected.active_goal_ref)
    || selected.active_terminal_goal_ref !== null && !ref(selected.active_terminal_goal_ref))) throw new TypeError('Invalid native outline selected public transition');
  if (selected !== null) {
    const announced = ['announced_correspondence_hypothesis', 'native_current_announced_rejoin_hypothesis',
      'native_current_announced_access_hypothesis', 'native_current_observed_body_access_hypothesis'].includes(selected.meaning_kind);
    const operator = ['native_current_obstructing_inset_operator_hypothesis',
      'native_current_observed_body_arrival_local_test_hypothesis'].includes(selected.meaning_kind);
    const capture = ['native_current_overlaid_capture_hypothesis', 'native_current_adjacent_capture_hypothesis'].includes(selected.meaning_kind);
    const expectedGoal = announced ? OUTLINE_ACCOMPANIMENT_GOAL : operator ? 'goal.reveal_action_conditioned_structure'
      : capture ? 'goal.immobilize_contact_causing_mobile_entity' : null;
    const expectedTerminal = announced || operator || capture ? OUTLINE_ACCOMPANIMENT_GOAL : null;
    if (selected.active_goal_ref !== expectedGoal || selected.active_terminal_goal_ref !== expectedTerminal)
      throw new TypeError('Invalid native outline dispatched goal binding');
    if (selected.access_relation !== undefined) {
      const access = selected.access_relation;
      if (!record(access) || access.schema !== 'logos-engine.native.outline-announced-access.v1'
        || !['native_current_announced_access_hypothesis', 'native_current_observed_body_access_hypothesis'].includes(selected.meaning_kind)
        || access.observation_ref !== selected.observation_ref || access.current_rows_sha256 !== supplied.before_rows_sha256
        || access.action_ref !== selected.command.action_ref || access.primitive_bound !== 1 || access.release_authority !== false
        || selected.access_relation_ref !== `outline_access:${symbolicDigest(access)}`) throw new TypeError('Invalid native outline retained current access relation');
    } else if (selected.access_relation_ref !== undefined) throw new TypeError('Missing native outline retained current access relation');
  }
  return supplied;
}
export function makeOutlinePublicTransition(before: NativeObservation, after: NativeObservation, action: R,
  first: NativeRows, second: NativeRows, sourceState: R, selected: R | null): R | null {
  if (before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed) return null;
  // The common observer retains the caller's frame identifier, including the
  // distinct full NumPy rowsDigest used by other public acquisition contracts.
  // This optional annex binds only the 16-character JSON public-frame digest.
  // Decline unsupported identifiers without rewriting observations or stopping
  // ordinary source acquisition. Restoration still validates every bound byte.
  if (!publicFrameRef(before.frame_hash) || !publicFrameRef(after.frame_hash)) return null;
  return retainOutlinePublicTransition({ schema: OUTLINE_PUBLIC_TRANSITION_SCHEMA,
    before: outlinePublicScope(before), after: outlinePublicScope(after), command: action,
    before_rows: first, before_rows_sha256: symbolicDigest(first), after_rows_sha256: symbolicDigest(second),
    source_state_ref: `outline_source:${symbolicDigest(sourceState)}`, selected_outline: selected,
    qualification: 'Only the immediately preceding actual public transition is retained. Its raster is evidence for the unchanged V5 previous-frame measurement, not a future action sequence or an effect guarantee.' }, sourceState);
}
export function currentOutlinePublicTransition(value: R | null, sourceState: R,
  observation: NativeObservation, rows: NativeRows): R | null {
  if (!value || value.source_state_ref !== `outline_source:${symbolicDigest(sourceState)}`
    || ['observation_ref', 'level_epoch', 'levels_completed', 'frame_hash', 'revision'].some(field => value.after[field] !== observation[field])
    || symbolicDigest(rows) !== value.after_rows_sha256) return null;
  return value;
}

/** This input is supplied by the common caller's actual acquired action
 * evidence. Local Outline methods alone cannot establish global uniqueness. */
export function outlineUniqueEffectfulLocalOperator(currentTrial: NativeRecord, observation: NativeObservation,
  action: string, interfaceDirections: readonly string[]): R | null {
  const context = currentTrial.effectful_action_context;
  if (!record(context) || context.domain_complete !== true || !refs(context.known_effectful_action_refs)
    || !refs(context.available_action_refs) || symbolicDigest(context.available_action_refs) !== symbolicDigest(observation.available_action_refs)
    || context.level_start_checkpoint_action_ref !== null && !ref(context.level_start_checkpoint_action_ref)
    || !refs(context.evidence_refs) || !context.evidence_refs.length
    || ['observation_ref', 'level_epoch', 'levels_completed'].some(field => context[field] !== observation[field])) return null;
  const known = [...new Set(context.known_effectful_action_refs)], directions = new Set(interfaceDirections);
  const candidates = known.filter(ref => observation.available_action_refs.includes(ref)
    && ref !== OUTLINE_SOURCE_POINT_ACTION_REF && ref !== context.level_start_checkpoint_action_ref && !directions.has(ref));
  if (candidates.length !== 1 || candidates[0] !== action || !known.includes(action) || directions.has(action)
    || action === OUTLINE_SOURCE_POINT_ACTION_REF || action === context.level_start_checkpoint_action_ref) return null;
  return retainNativeJson({ ...context, unique_available_nondirectional_local_action_ref: action,
    interface_directional_action_refs: [...interfaceDirections], point_action_ref: OUTLINE_SOURCE_POINT_ACTION_REF,
    candidate_count: candidates.length, qualification: context.qualification ?? 'Current global caller action evidence, not inferred from Outline methods.' });
}
