/**
 * Native coordination witnesses, separate from the unchanged V6 families.
 * A past official success can support a currently guarded conditional inquiry.
 * These read-only witnesses neither select an action nor establish its effect.
 */
import { pythonEqual as equal } from './v6-operations.ts';

type R = Record<string, any>;
export interface UnacquiredInquiryWitness extends Record<string, unknown> {
  status: 'unacquired_exploration';
  observation_ref: string;
  proposal_ref: string;
  evidence_refs: string[];
  qualification: string;
}
export interface AcquiredContinuationWitness extends Record<string, unknown> {
  status: 'conditional_acquired_continuation';
  observation_ref: string;
  score: number;
  success_ref: string;
  evidence_refs: string[];
  qualification: string;
  proposal_ref?: string;
  step_mode?: string;
  action_effect_known?: boolean;
  effect_scope?: string;
}

const record = (value: unknown): value is R => value !== null && typeof value === 'object' && !Array.isArray(value);
const reference = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const emptyRecord = (value: unknown): boolean => record(value) && Object.keys(value).length === 0;
const emptyList = (value: unknown): boolean => Array.isArray(value) && value.length === 0;
const point = (value: unknown): value is number[] => Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
const currentObservation = (observation: R): boolean => reference(observation.observation_ref) && reference(observation.frame_hash)
  && Number.isSafeInteger(observation.level_epoch) && Number.isSafeInteger(observation.levels_completed) && observation.levels_completed >= 0;
const currentBinding = (proposal: R, observation: R): boolean => record(proposal.binding)
  && proposal.binding.observation_ref === observation.observation_ref && proposal.binding.level_epoch === observation.level_epoch;

/** Absence is checked in the acquired Cell owner, not inferred from the offer. */
export function cellUnacquiredInquiryWitness(cellState: unknown, proposal: unknown, observation: Readonly<R>): UnacquiredInquiryWitness | null {
  if (!record(cellState) || !record(proposal) || !currentObservation(observation) || proposal.status !== 'proposed'
    || proposal.kind !== 'cell_patch_placement' || !record(proposal.cell_placement_plan) || !currentBinding(proposal, observation)) return null;
  if (!emptyList(cellState.cell_events) || !emptyList(cellState.cell_refused) || !emptyRecord(cellState.cell_models)
    || !emptyRecord(cellState.cell_paths) || !emptyRecord(cellState.cell_returns)) return null;
  const plan = proposal.cell_placement_plan;
  if (plan.model !== null || plan.search !== null || plan.expected_motif !== null || plan.epoch !== observation.level_epoch
    || plan.score !== observation.levels_completed || plan.observation_ref !== observation.observation_ref
    || !reference(proposal.proposal_id) || !reference(plan.frame_digest) || !reference(plan.field?.ref)) return null;
  if (!Array.isArray(proposal.actions) || proposal.actions.length !== 1 || !Array.isArray(proposal.steps) || proposal.steps.length !== 1
    || !equal(proposal.actions[0], plan.command) || !equal(proposal.steps[0]?.action, plan.command)
    || !equal(proposal.bundle_template?.actions, proposal.actions) || proposal.bundle_template?.objective_ref !== 'G_official_completion') return null;
  const expected = proposal.steps[0].expected_before, support = proposal.steps[0].point_support;
  if (!record(expected) || expected.level_epoch !== observation.level_epoch || expected.frame_hash !== observation.frame_hash
    || expected.levels_completed !== observation.levels_completed || expected.state !== observation.state
    || !record(support) || support.observation_ref !== observation.observation_ref || support.level_epoch !== observation.level_epoch
    || support.frame_hash !== observation.frame_hash || !equal(support.point, plan.pixel)) return null;
  if (proposal.question?.reason !== 'test_pointed_cell_patch_and_dated_response'
    || !equal(proposal.question?.hypothesis_refs, [observation.observation_ref])
    || !equal(proposal.route_refs, [observation.observation_ref]) || !equal(proposal.bundle_template.evidence, [observation.observation_ref])) return null;
  return { status: 'unacquired_exploration', observation_ref: observation.observation_ref, proposal_ref: proposal.proposal_id, evidence_refs: [],
    qualification: 'Current measured cell inquiry with no retained Cell event, model, refusal, path or return. Its placement and goal roles remain unacquired.' };
}

/** O(1) prefilter over the latest acquired official boundary, before planning. */
export function retainedReductionSuccess(state: unknown, observation: Readonly<R>): AcquiredContinuationWitness | null {
  if (!record(state) || !currentObservation(observation) || !Array.isArray(state.passed) || !state.passed.length) return null;
  const success = state.passed[state.passed.length - 1];
  if (!record(success) || !reference(success.ref) || !Number.isSafeInteger(success.score) || success.score <= 0
    || success.score !== observation.levels_completed) return null;
  return { status: 'conditional_acquired_continuation', observation_ref: observation.observation_ref, score: observation.levels_completed,
    success_ref: success.ref, evidence_refs: [success.ref],
    qualification: 'The latest official success belongs to this acquired program and the current completion score. Current geometry, route and physical effects still require separate validation.' };
}

/** The caller must additionally check activation and the present before guard. */
export function reductionAcquiredContinuationWitness(state: unknown, proposal: unknown, observation: Readonly<R>): AcquiredContinuationWitness | null {
  const retained = retainedReductionSuccess(state, observation);
  if (!retained || !record(state) || !record(proposal) || proposal.status !== 'proposed' || proposal.kind !== 'supported_ternary_reduction'
    || state.epoch !== observation.level_epoch || state.retired !== false || !record(state.model) || !record(state.scene)
    || !currentBinding(proposal, observation) || proposal.binding.levels_completed !== observation.levels_completed) return null;
  const plan = proposal.reduction_plan, facts = proposal.facts;
  if (!record(plan) || !record(facts) || facts.measured_repeated_cells !== true || facts.ternary_reduction_hypothesis !== true
    || facts.bounded_continuation_found !== true || !Number.isSafeInteger(plan.continuation_operations) || plan.continuation_operations < 1
    || !Number.isSafeInteger(plan.population) || plan.population < 2 || !Number.isSafeInteger(plan.carriers) || plan.carriers < 0
    || !point(plan.camera_offset) || !equal(plan.camera_offset, state.offset) || !record(state.motion) || !equal(plan.control_vectors, state.motion)) return null;
  if (!Array.isArray(proposal.actions) || proposal.actions.length < 1 || proposal.actions.length > 16 || !Array.isArray(proposal.steps)
    || proposal.steps.length !== proposal.actions.length || !equal(proposal.bundle_template?.actions, proposal.actions)
    || proposal.bundle_template?.objective_ref !== 'G_official_completion' || !reference(proposal.bundle_template?.composition_ref)) return null;
  const step = proposal.steps[0], action = proposal.actions[0], expected = step?.expected_before;
  if (!record(step) || !record(action) || !reference(action.action_ref) || !equal(step.action, action) || !record(expected)
    || expected.level_epoch !== observation.level_epoch || expected.frame_hash !== observation.frame_hash
    || !['select', 'jump', 'move', 'calibrate'].includes(step.mode)) return null;
  if (step.mode === 'calibrate' && (step.expected_after !== null || Object.hasOwn(state.motion, action.action_ref))) return null;
  const priorEffectRef = state.refs?.[step.mode === 'move' ? action.action_ref : step.mode];
  const effectKnown = step.mode !== 'calibrate' && reference(priorEffectRef)
    && (step.mode === 'move' ? point(state.motion[action.action_ref]) : Array.isArray(state.verified) && state.verified.includes(step.mode));
  return { ...retained, proposal_ref: proposal.bundle_template.composition_ref, step_mode: step.mode,
    evidence_refs: effectKnown ? [...new Set([retained.success_ref, priorEffectRef])] : [retained.success_ref],
    action_effect_known: effectKnown,
    effect_scope: effectKnown ? 'observed_relation_under_current_conditional_model' : 'current_effect_remains_an_information_question',
    qualification: step.mode === 'calibrate'
      ? 'A previously successful reduction program has a freshly measured finite continuation. This command tests an unknown control vector; its proposed vector is a hypothesis and acquires no authority before the actual response.'
      : 'A previously successful reduction program has a freshly measured finite continuation. Prior success supports this current question; the current guard and actual response remain required, and no universal law is established.' };
}
