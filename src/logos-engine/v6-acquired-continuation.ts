/**
 * Native coordination witnesses, separate from the unchanged V6 families.
 * A past official success can support a currently guarded conditional inquiry.
 * These read-only witnesses neither select an action nor establish its effect.
 */
import { pythonEqual as equal } from './v6-operations.ts';
import { symbolicDigest } from './v6-hash.ts';
import { splitNativeState } from './v6-native-state-graph.ts';
import { traceFieldCenter } from './v6-trace-field-observation.ts';

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

/** The typed native graph preserves finite Float64 bits without changing V7 JSON. */
export const CONTINUATION_PROPOSAL_DIGEST_PROFILE = 'logos-engine.v6.continuation-proposal/typed-state-graph.v1';
export function continuationProposalDigest(proposal: unknown): string {
  return symbolicDigest(splitNativeState(proposal, CONTINUATION_PROPOSAL_DIGEST_PROFILE).root);
}

/** An invitation is unacquired only when this entire owner has no past return. */
export function animatedUnacquiredInquiryWitness(state: unknown, pending: unknown, proposal: unknown,
  observation: Readonly<R>): UnacquiredInquiryWitness | null {
  if (!record(state) || state.format !== 'animated_contact.v1' || !emptyList(state.events) || pending !== null
    || !record(proposal) || !currentObservation(observation) || proposal.status !== 'proposed'
    || proposal.kind !== 'measured_animated_contact' || !currentBinding(proposal, observation)
    || proposal.binding.levels_completed !== observation.levels_completed || proposal.binding.frame_hash !== observation.frame_hash) return null;
  const plan = proposal.animated_contact_plan, step = proposal.steps?.[0], command = proposal.actions?.[0];
  if (!record(plan) || plan.mode !== 'invitation' || plan.epoch !== observation.level_epoch
    || plan.score !== observation.levels_completed || plan.observation_ref !== observation.observation_ref
    || !reference(plan.frame_digest) || plan.frame_digest.slice(0, 16) !== observation.frame_hash
    || !reference(proposal.proposal_id) || !record(step) || !record(command)
    || command.action_ref !== 'ACTION6' || !record(command.data) || !point([command.data.x, command.data.y])
    || proposal.proposal_id !== 'animated-contact:' + symbolicDigest([plan.observation_ref, plan.mode, command])
    || !Array.isArray(proposal.actions) || proposal.actions.length !== 1 || !Array.isArray(proposal.steps) || proposal.steps.length !== 1
    || !equal(plan.command, command) || !equal(step.action, command) || step.expected_after !== null
    || !equal(proposal.bundle_template?.actions, proposal.actions) || proposal.bundle_template?.objective_ref !== 'G_official_completion'
    || !equal(proposal.route_refs, [observation.observation_ref])
    || !equal(proposal.question?.hypothesis_refs, [observation.observation_ref])
    || !equal(proposal.bundle_template.evidence, [observation.observation_ref])
    || proposal.facts?.unique_symmetric_cross_invitation !== true || proposal.facts?.physical_role !== 'unknown'
    || !reference(proposal.facts.current_occurrence)
    || !record(step.locus_witness) || !equal(step.locus_witness.point, [command.data.x, command.data.y])
    || step.locus_witness.observation_ref !== observation.observation_ref
    || step.locus_witness.frame_hash !== observation.frame_hash) return null;
  return { status: 'unacquired_exploration', observation_ref: observation.observation_ref,
    proposal_ref: proposal.proposal_id, evidence_refs: [],
    qualification: 'Only a current symmetric visual invitation is measured. This owner has no acquired event in any epoch and no pending return; neither contact nor terminal role is known.' };
}

/**
 * This is only a cheap candidate reference, not a proof of official progress.
 * The source labels an epoch change OR a score increase official_boundary.
 * The caller must corroborate the referenced return against the actual Kernel
 * boundary scores, selected entry, released composition and acquired command.
 */
export function retainedTraceBoundaryCandidate(state: unknown, observation: Readonly<R>): AcquiredContinuationWitness | null {
  if (!record(state) || !currentObservation(observation) || observation.levels_completed < 1
    || !Array.isArray(state.trace_events) || !record(state.trace_state)) return null;
  const event = [...state.trace_events].reverse().find((item: unknown) => record(item)
    && item.kind === 'observed_trace_extension' && item.transition?.outcome === 'official_boundary');
  if (!record(event) || !record(event.state) || !record(event.transition)
    || !reference(event.transition.before_ref) || !reference(event.transition.after_ref)
    || !Number.isSafeInteger(event.state.epoch) || event.state.epoch > observation.level_epoch
    || !Array.isArray(event.state.evidence) || !event.state.evidence.includes(event.transition.after_ref)) return null;
  return { status: 'conditional_acquired_continuation', observation_ref: observation.observation_ref,
    score: observation.levels_completed, success_ref: event.transition.after_ref,
    evidence_refs: [event.transition.after_ref], source_entry: 'trace_field_composition', source_kind: 'trace_field_experiment',
    kernel_score_corroboration_required: true, source_boundary_outcome: event.transition.outcome,
    qualification: 'The retained trace event supplies a boundary reference only. Official progress is unproved until the common caller binds its actual acquired Kernel score increase and this exact provider entry.' };
}

/** Current geometry and effects remain conditional even after a proven success. */
export function traceAcquiredContinuationWitness(state: unknown, proposal: unknown,
  observation: Readonly<R>): AcquiredContinuationWitness | null {
  const retained = retainedTraceBoundaryCandidate(state, observation);
  if (!retained || !record(state) || !record(proposal) || proposal.status !== 'proposed'
    || proposal.kind !== 'trace_field_experiment' || proposal.field_subquestion !== 'trace_field_composition'
    || !currentBinding(proposal, observation)) return null;
  const plan = proposal.trace_field_plan, facts = proposal.facts;
  if (!record(plan) || !record(plan.scene) || !record(plan.state) || !record(plan.estimate) || !record(facts)
    || plan.epoch !== observation.level_epoch || plan.score !== observation.levels_completed
    || plan.observation_ref !== observation.observation_ref || !reference(plan.frame_digest)
    || plan.frame_digest.slice(0, 16) !== observation.frame_hash
    || facts.measured_cell_domain !== true || facts.simple_cover_is_declared_experimental_target !== true
    || facts.official_terminal_law_unknown !== true
    || proposal.proposal_id !== 'C_trace_' + symbolicDigest(plan).slice(0, 20)) return null;
  const scene = plan.scene, geometry = scene.geometry, estimate = plan.estimate;
  if (!record(geometry) || scene.geometry_ref !== symbolicDigest(geometry)
    || !Array.isArray(scene.prefix) || !scene.prefix.length || !scene.prefix.every(point)
    || !point(scene.head?.cell) || !point(scene.receiver_hypothesis?.cell)
    || !equal(scene.prefix.at(-1), scene.head.cell) || !Array.isArray(scene.allowed_edges_hypothesis)
    || !Array.isArray(estimate.path) || !estimate.path.every(point)
    || estimate.receipt?.status !== 'COMPLETE' || estimate.receipt?.descriptive_facts?.primitive_release_authorized !== false) return null;
  const old = record(state.trace_state) && state.trace_state.epoch === observation.level_epoch
    && state.trace_state.geometry_ref === scene.geometry_ref ? state.trace_state : null;
  const expectedState = old ?? { epoch: observation.level_epoch, geometry, geometry_ref: scene.geometry_ref,
    successes: [], failures: [], evidence: [] };
  if (!equal(plan.state, expectedState) || !Array.isArray(plan.state.successes) || !Array.isArray(plan.state.failures)
    || !Array.isArray(plan.state.evidence)) return null;
  const path: number[][] = estimate.path, key = (cell: readonly number[]) => JSON.stringify(cell);
  if (!point(geometry.shape)) return null;
  const columns = geometry.shape[0]!, rows = geometry.shape[1]!;
  if (!Number.isSafeInteger(columns) || !Number.isSafeInteger(rows) || columns < 1 || rows < 1
    || path.length !== columns * rows || new Set(path.map(key)).size !== path.length
    || path.some(cell => cell[0]! < 0 || cell[0]! >= columns || cell[1]! < 0 || cell[1]! >= rows)
    || !equal(path.slice(0, scene.prefix.length), scene.prefix)
    || !equal(path.at(-1), scene.receiver_hypothesis.cell)) return null;
  const edge = (first: readonly number[], second: readonly number[]) => [key(first), key(second)].sort().join('|');
  if (!scene.allowed_edges_hypothesis.every((pair: unknown) => Array.isArray(pair) && pair.length === 2 && pair.every(point))) return null;
  const edges = new Set((scene.allowed_edges_hypothesis as number[][][]).map(pair => edge(pair[0]!, pair[1]!)));
  if (path.slice(1).some((cell, index) => !edges.has(edge(path[index]!, cell)))) return null;
  if (!plan.state.successes.every((event: unknown) => record(event) && point(event.source) && point(event.target))) return null;
  const learned = !plan.state.failures.length && new Set((plan.state.successes as R[])
    .map(event => JSON.stringify([...event.source, ...event.target]))).size >= 2;
  if (!Array.isArray(proposal.actions) || !proposal.actions.length || proposal.actions.length > (learned ? 16 : 1)
    || !Array.isArray(proposal.steps) || proposal.steps.length !== proposal.actions.length
    || !equal(plan.commands, proposal.actions) || !equal(proposal.bundle_template?.actions, proposal.actions)
    || proposal.bundle_template?.objective_ref !== 'G_official_completion'
    || proposal.bundle_template?.composition_ref !== proposal.proposal_id) return null;
  for (const [index, step] of (proposal.steps as R[]).entries()) {
    const target = path[scene.prefix.length + index], source = path[scene.prefix.length + index - 1];
    if (!target || !source || !record(step) || !equal(step.source, source) || !equal(step.target, target)
      || !equal(step.prefix_before, path.slice(0, scene.prefix.length + index))
      || step.relation_observed !== learned || step.expected_after !== null) return null;
    const pixel = traceFieldCenter(geometry, target), command = { action_ref: 'ACTION6', data: { x: pixel[0], y: pixel[1] } };
    const expected = step.expected_before, support = step.point_support;
    if (!equal(step.action, command) || !equal(proposal.actions[index], command)
      || !record(expected) || expected.level_epoch !== observation.level_epoch || expected.frame_hash !== observation.frame_hash
      || expected.levels_completed !== observation.levels_completed || expected.state !== observation.state
      || !record(support) || support.observation_ref !== observation.observation_ref
      || support.level_epoch !== observation.level_epoch || support.frame_hash !== observation.frame_hash
      || !equal(support.point, pixel)) return null;
  }
  return { ...retained, proposal_ref: proposal.proposal_id, action_effect_known: learned,
    effect_scope: learned ? 'observed_local_extensions_in_current_epoch_only' : 'current_effect_remains_an_information_question',
    bounded_cover_cells: path.length, current_epoch_local_effects: plan.state.successes.length,
    qualification: 'A current finite covering witness supports this experiment only after the retained boundary is corroborated by the acquired Kernel. Prior-epoch control effects and terminal law remain unknown; current guards and actual public returns are still mandatory.' };
}

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
