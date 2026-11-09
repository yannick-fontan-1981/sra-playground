/**
 * Native coordination extension, not an additional transferred pose model.
 * AttentionMemory.composition owns the request obligation; SharedSeries.material
 * remains the sole owner of acquired material/pose knowledge. These functions
 * consume its already recorded actual returns and never call a domain reducer.
 */
import { AttentionMemory } from './v6-attention-memory.ts';
import { proposedTypedMaterialInquiryWitness } from './v6-typed-material-evidence.ts';
import { currentTypedMarks, rotatedTypedMarks, typedControlMatches, typedMaterialRequests,
  typedMaterialDigest as identity } from './v6-typed-material-observation.ts';
import { pythonEqual as same } from './v6-operations.ts';
import type { NativeAuthorityTransition } from './v6-native-authority.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
export const TYPED_MATERIAL_COMPOSITION_OWNER = 'native:typed_material_flow';
export const TYPED_MATERIAL_COMPOSITION_EXTENSION = 'retained_typed_material_request_parent';
const familyId = 'public_occurrence_recall';
const eventRef = (event: R): string => 'typed-material-event:' + identity(event);
const requestBinding = (target: R): R => ({ id: target.id, bbox: target.bbox, point: target.point, descriptor: target.descriptor });
const childBinding = (child: R): R => ({ id: child.id, bbox: child.bbox, center: child.center, point: child.point,
  body_palette: child.body_palette, source_ref: child.source_ref });
const controlBinding = (control: R): R => ({ bbox: control.bbox, point: control.point, epoch: control.epoch, source_ref: control.source_ref });
const marks = (value: number[][]): number[][] => value.map(item => [...item]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
const unique = (refs: string[]): string[] => [...new Set(refs)];

function pending(attention: AttentionMemory): R | null {
  const item = attention.composition;
  return item?.owner === TYPED_MATERIAL_COMPOSITION_OWNER && item.status === 'pending' ? item : null;
}
function receipt(item: R, obs: R, decision: string, reason: string, extra: R = {}): R {
  return { native_extension: TYPED_MATERIAL_COMPOSITION_EXTENSION, parent_ref: item.id, target_ref: item.target_ref,
    observation_ref: obs.observation_ref, level_epoch: obs.level_epoch, decision, reason,
    condition: item.binding?.condition ?? null, child_ref: item.binding?.child_ref ?? null,
    returned_transition_ref: item.binding?.last_return?.transition_ref ?? null,
    release_authority: false, ...extra };
}
function revise(attention: AttentionMemory, item: R, binding: R, obs: R, evidence: string[] = []): R {
  const result = attention.reviseComposition(TYPED_MATERIAL_COMPOSITION_OWNER, item.target_ref, binding,
    unique([obs.observation_ref, ...evidence]), obs);
  if (!result) throw new Error('Native material parent revision lost its pending owner or current scope');
  return result;
}
function suspend(attention: AttentionMemory, item: R, obs: R, reason: string, extra: R = {}): R {
  const next = revise(attention, item, { ...item.binding, phase: 'suspended', suspension_reason: reason,
    last_revalidation: { observation_ref: obs.observation_ref, admitted: false, reason }, ...extra }, obs);
  return receipt(next, obs, 'suspend', reason, { admitted: false });
}
export function suspendTypedMaterialParent(attention: AttentionMemory, obs: R, reason: string): R | null {
  const item = pending(attention); return item ? suspend(attention, item, obs, reason) : null;
}

/** Validate exact measured occurrences, not ancestry alternatives. An ambiguous
 * source lineage is legitimate when the current child and its marks are unique. */
function current(item: R, state: R, obs: R, rows: NativeRows, expectedMarks?: number[][]): R {
  const binding = item.binding;
  if (!binding || binding.native_extension !== TYPED_MATERIAL_COMPOSITION_EXTENSION || binding.family_id !== familyId
    || item.target_ref !== binding.request?.id || item.level_epoch !== obs.level_epoch
    || state.flow_epoch !== obs.level_epoch || state.pose_epoch !== obs.level_epoch
    || !Array.isArray(state.flow_children) || !Array.isArray(state.flow_filled) || !Array.isArray(state.pose_controls)
    || !Array.isArray(state.pose_events) || !state.pose_models) return { admitted: false, reason: 'parent_scope_changed' };
  if (state.requested_stop_reason !== null) return { admitted: false, reason: state.requested_stop_reason ?? 'material_return_unresolved' };
  const children = state.flow_children.filter((child: R) => child.id === binding.child_ref);
  if (children.length !== 1 || !same(childBinding(children[0]), binding.child)
    || state.flow_children.filter((child: R) => same(child.bbox, binding.child.bbox) && same(child.center, binding.child.center)).length !== 1) {
    return { admitted: false, reason: 'parent_child_identity_changed_or_ambiguous' };
  }
  const child = children[0], observedMarks = currentTypedMarks(child, rows);
  if (identity(child.marks) !== binding.child_marks_digest || !observedMarks || !same(observedMarks, expectedMarks ?? child.marks)) {
    return { admitted: false, reason: 'parent_child_marks_changed_or_ambiguous' };
  }
  const targets = typedMaterialRequests(rows, obs, state.flow_filled.map((box: number[]) => [box[2]! - box[0]!, box[3]! - box[1]!]))
    .filter(target => !state.flow_filled.some((box: number[]) => same(box, target.bbox)) && target.id === item.target_ref);
  if (targets.length !== 1 || !same(requestBinding(targets[0]!), binding.request)) return { admitted: false, reason: 'parent_request_changed_or_ambiguous' };
  const controls = state.pose_controls.filter((control: R) => typedControlMatches(control, rows, obs.level_epoch));
  if (controls.length !== 1 || !same(controlBinding(controls[0]), binding.control)
    || identity(controls[0].projection) !== binding.control_projection_digest) return { admitted: false, reason: 'parent_control_changed_or_ambiguous' };
  const model = state.pose_models[binding.model_ref];
  if (!model || identity(model) !== binding.model_digest || !same(model.descriptor, binding.request.descriptor)) {
    return { admitted: false, reason: 'parent_comparison_model_changed' };
  }
  if (binding.phase !== 'needs_selection') {
    const context = state.pose_context ?? state.flow_context;
    if (context?.child.id !== binding.child_ref || !same(context.child, child)) return { admitted: false, reason: 'parent_selected_context_lost' };
    const selected = binding.selection_witness, selection = state.pose_events.find((value: R) => eventRef(value) === selected?.event_ref);
    if (!selected || !selection || selection.kind !== 'typed_pose_response' || selection.stop_reason !== null
      || selection.child?.id !== binding.child_ref || selection.control || !same(selection.evidence, selected.evidence)
      || !Array.isArray(selected.pixels) || !selected.pixels.length || !selected.pixels.every((pixel: number[]) =>
        pixel.length === 3 && pixel.every(Number.isSafeInteger) && rows[pixel[1]!]?.[pixel[0]!] === pixel[2])) {
      return { admitted: false, reason: 'parent_selection_mark_changed_or_unwitnessed' };
    }
    const returned = binding.last_return, event = state.pose_events.find((value: R) => eventRef(value) === returned?.event_ref);
    if (!event || event.kind !== 'typed_pose_response' || event.stop_reason !== null || event.child?.id !== binding.child_ref
      || !same(event.evidence, returned.evidence) || !same(context.evidence, event.evidence)) return { admitted: false, reason: 'parent_return_not_in_acquired_owner' };
  }
  return { admitted: true, reason: 'retained_request_and_selected_scope_revalidated', child, control: controls[0], target: targets[0], model };
}

/** Only a selected, acquired-context pose question can create this parent. */
export async function retainTypedMaterialParent(attention: AttentionMemory, state: R, proposal: R, obs: R, rows: NativeRows): Promise<R | null> {
  const plan = proposal.material_pose_plan;
  if (!plan) return null;
  const existing = pending(attention);
  if (existing) return receipt(existing, obs, 'retain', 'parent_already_pending', { admitted: true });
  if (attention.composition?.status === 'pending') return { admitted: false, reason: 'another_composition_parent_pending', release_authority: false };
  if (plan.mode !== 'select' || !proposedTypedMaterialInquiryWitness(state, proposal, obs, rows)) {
    return { admitted: false, reason: 'parent_requires_current_acquired_selection_question', release_authority: false };
  }
  const binding = { native_extension: TYPED_MATERIAL_COMPOSITION_EXTENSION, family_id: familyId, source_entry: 'typed_material_flow',
    request: requestBinding(plan.option.target), child_ref: plan.child.id, child: childBinding(plan.child), child_marks_digest: identity(plan.child.marks),
    control: controlBinding(plan.control), control_projection_digest: identity(plan.control.projection),
    model_ref: plan.option.model_ref, model_digest: identity(plan.option.model), condition: 'selected_pose_matches_retained_request',
    phase: 'needs_selection', selection_witness: null, last_return: null, consumed_return_ref: null, active_question: null, suspension_reason: null };
  const item = await attention.retainComposition(TYPED_MATERIAL_COMPOSITION_OWNER, binding.request.id,
    'Deliver the selected typed material to this measured request; first resolve its current pose.',
    [obs.observation_ref, ...proposal.route_refs], obs, binding);
  return item ? receipt(item, obs, 'retain', 'measured_request_parent_retained', { admitted: true })
    : { admitted: false, reason: 'composition_parent_not_retained', release_authority: false };
}

/** Every new decision revalidates the retained parent, including foreign returns
 * and restored checkpoints. No old point or released prefix is reused. */
export function revalidateTypedMaterialParent(attention: AttentionMemory, state: R, obs: R, rows: NativeRows): R | null {
  const item = pending(attention); if (!item) return null;
  if (item.level_epoch !== obs.level_epoch || ['WIN', 'GAME_OVER'].includes(obs.state)) {
    const closed = attention.returnComposition(TYPED_MATERIAL_COMPOSITION_OWNER, item.target_ref, 'boundary', [obs.observation_ref], obs)!;
    return receipt(closed, obs, 'boundary', 'parent_scope_ended', { admitted: true });
  }
  if (item.binding?.phase === 'suspended') return receipt(item, obs, 'suspend', item.binding.suspension_reason, { admitted: false });
  const validation = current(item, state, obs, rows);
  return validation.admitted ? receipt(item, obs, 'revalidate', validation.reason, { admitted: true })
    : suspend(attention, item, obs, validation.reason);
}

/** Consume the actual child return at the next selected decision. Resolving pose
 * keeps the delivery parent pending. This receipt never authorizes an action. */
export function consumeTypedMaterialParent(attention: AttentionMemory, state: R, proposal: R, obs: R, rows: NativeRows): R | null {
  const item = pending(attention); if (!item) return null;
  const pose = proposal.material_pose_plan, flow = proposal.material_flow_plan;
  if (!pose && !flow) return null;
  const validation = revalidateTypedMaterialParent(attention, state, obs, rows);
  if (validation?.decision === 'boundary') return { ...validation, admitted: false };
  if (!validation?.admitted) return validation;
  const binding = item.binding, plan = pose ?? flow, target = pose ? pose.option.target : flow.target;
  if (plan.child.id !== binding.child_ref || !same(requestBinding(target), binding.request)
    || proposal.binding?.observation_ref !== obs.observation_ref || proposal.binding?.level_epoch !== obs.level_epoch
    || pose && (pose.option.model_ref !== binding.model_ref || !same(controlBinding(pose.control), binding.control))
    || flow && (flow.mode !== 'deliver' || binding.phase !== 'ready_for_delivery')
    || pose && (pose.mode === 'select' ? binding.phase !== 'needs_selection' : binding.phase !== 'needs_pose')) {
    return suspend(attention, item, obs, 'proposal_does_not_discharge_retained_parent');
  }
  const returned = binding.last_return;
  const next = revise(attention, item, { ...binding, consumed_return_ref: returned?.transition_ref ?? null,
    consumed_at: obs.observation_ref, active_question: { proposal_ref: proposal.proposal_id, kind: proposal.kind,
      mode: plan.mode, opened_at: obs.observation_ref }, suspension_reason: null }, obs, returned?.evidence ?? []);
  const result = receipt(next, obs, flow ? 'deliver' : plan.mode === 'select' ? 'select' : 'resume_pose',
    returned ? 'actual_child_return_consumed' : 'current_child_question_bound', { admitted: true,
      proposal_ref: proposal.proposal_id, consumed_return_ref: returned?.transition_ref ?? null,
      returned_event_ref: returned?.event_ref ?? null, return_status: returned?.status ?? null,
      parent_status: 'pending', evidence_refs: unique([obs.observation_ref, ...(returned?.evidence ?? [])]) });
  proposal.native_composition_dependency = result;
  return result;
}

/** Extra refusal premise before the ordinary family/WHY-ACT gates. During a
 * committed multi-action prefix the domain reducer has not run yet: use only
 * its acquired initial child plus the separately guarded expected current marks. */
export function typedMaterialParentGuard(attention: AttentionMemory, state: R, proposal: R, index: number, obs: R, rows: NativeRows): R | null {
  const binding = proposal.native_composition_dependency;
  if (!binding) return null;
  const item = pending(attention), plan = proposal.material_pose_plan ?? proposal.material_flow_plan;
  if (!item || binding.parent_ref !== item.id || binding.target_ref !== item.target_ref
    || item.binding.active_question?.proposal_ref !== proposal.proposal_id || item.binding.phase === 'suspended'
    || !plan || (proposal.material_pose_plan ? plan.option.target.id : plan.target.id) !== item.target_ref) {
    return { admitted: false, reason: 'retained_parent_question_not_current', release_authority: false };
  }
  const expected = index > 0 ? proposal.material_pose_plan?.expected_before[index] : undefined;
  if (index > 0 && !expected) return { admitted: false, reason: 'parent_conditional_prefix_not_witnessed', release_authority: false };
  const result = current(item, state, obs, rows, expected);
  return receipt(item, obs, 'guard', result.reason, { admitted: result.admitted });
}

/** Called once after the selected and passive domain owners acquire a real
 * transition. It references those events rather than applying them again. */
export function recordTypedMaterialParent(attention: AttentionMemory, state: R, proposal: R,
  transition: NativeAuthorityTransition, record: R | null): R | null {
  let item = pending(attention); if (!item) return null;
  const { before, after, command, first, second, index } = transition;
  const evidence = [before.observation_ref, after.observation_ref], transitionRef = `reasoning:transition:${before.revision}`;
  if (item.binding?.last_return?.transition_ref === transitionRef && same(item.binding.last_return.evidence, evidence)) {
    return receipt(item, after, 'already_consumed', 'actual_return_already_reconciled', { duplicate: true });
  }
  const pose = proposal.material_pose_plan, flow = proposal.material_flow_plan, plan = pose ?? flow;
  const own = proposal.native_composition_dependency?.parent_ref === item.id
    && item.binding?.active_question?.proposal_ref === proposal.proposal_id && !!plan;
  const events: R[] = record?.events ?? [];
  const event = own ? events.find(value => value.kind === (pose ? 'typed_pose_response' : 'typed_material_flow') && same(value.evidence, evidence)) : null;
  const prior = item.binding.last_return;
  const boundReturn = own && same(command, proposal.actions[index]) && plan.child.id === item.binding.child_ref
    && same(requestBinding(pose ? pose.option.target : flow.target), item.binding.request)
    && (index === 0 ? plan.observation_ref === before.observation_ref
      : prior?.proposal_ref === proposal.proposal_id && prior.index === index - 1 && prior.evidence[1] === before.observation_ref)
    && !!event && (pose ? state.pose_events : state.flow_events).some((value: R) => eventRef(value) === eventRef(event));
  const boundary = before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed || ['WIN', 'GAME_OVER'].includes(after.state);
  const delivered = boundReturn && flow?.mode === 'deliver' && flow.child.id === item.binding.child_ref
    && same(requestBinding(flow.target), item.binding.request) && event?.stop_reason === null
    && ['material_consumed_and_request_changed', 'official_boundary_after_request'].includes(event.effect)
    && event.removed_children?.includes(item.binding.child_ref) && same(event.model?.descriptor, item.binding.request.descriptor);
  if (boundary) {
    const closed = attention.returnComposition(TYPED_MATERIAL_COMPOSITION_OWNER, item.target_ref, 'boundary', evidence, after)!;
    return receipt(closed, after, 'boundary', delivered ? 'request_delivered_at_observed_boundary' : 'parent_scope_ended',
      { request_achieved: delivered, returned_transition_ref: transitionRef, returned_event_ref: event ? eventRef(event) : null, evidence_refs: evidence });
  }
  if (!own) {
    const check = current(item, state, after, second.frame_rows), scope = { transition_ref: transitionRef, evidence, admitted: check.admitted, reason: check.reason };
    if (!check.admitted) return suspend(attention, item, after, check.reason, { last_scope_return: scope });
    item = revise(attention, item, { ...item.binding, last_scope_return: scope }, after, evidence);
    return receipt(item, after, 'revalidate', 'foreign_return_preserved_measured_parent', { returned_transition_ref: transitionRef, evidence_refs: evidence });
  }
  if (!boundReturn || !event) {
    return suspend(attention, item, after, 'actual_return_not_bound_to_parent_question');
  }
  const returned = { transition_ref: transitionRef, proposal_ref: proposal.proposal_id, index, evidence, event_ref: eventRef(event), status: 'unresolved' };
  if (delivered) {
    item = revise(attention, item, { ...item.binding, phase: 'achieved', last_return: { ...returned, status: 'request_delivered' } }, after, evidence);
    const closed = attention.returnComposition(TYPED_MATERIAL_COMPOSITION_OWNER, item.target_ref, 'achieved', evidence, after)!;
    return receipt(closed, after, 'achieved', 'actual_material_consumption_and_request_change', { returned_event_ref: returned.event_ref, evidence_refs: evidence });
  }
  if (event.rule?.status === 'refuted') {
    item = revise(attention, item, { ...item.binding, phase: 'refuted', last_return: { ...returned, status: 'pose_prediction_refuted' } }, after, evidence);
    const closed = attention.returnComposition(TYPED_MATERIAL_COMPOSITION_OWNER, item.target_ref, 'refuted', evidence, after)!;
    return receipt(closed, after, 'refuted', 'actual_pose_counterexample', { returned_event_ref: returned.event_ref, evidence_refs: evidence });
  }
  if (!pose || event.stop_reason !== null || event.child?.id !== item.binding.child_ref) {
    return suspend(attention, item, after, event.stop_reason ?? 'parent_response_uncharacterized', { last_return: returned });
  }
  // The source select return attests local marking, not a timeless selection.
  // Retain only its changed public pixels as a current binding witness. This
  // is deliberately outside the acquired pose/flow model and has no authority.
  let selectionWitness = item.binding.selection_witness;
  if (pose.mode === 'select') {
    const pixels: number[][] = [], [left, top, right, bottom] = event.child.bbox;
    for (let y = 0; y < first.frame_rows.length; y++) for (let x = 0; x < first.frame_rows[y]!.length; x++) {
      if (first.frame_rows[y]![x] !== second.frame_rows[y]![x] && !(left <= x && x <= right && top <= y && y <= bottom)) {
        pixels.push([x, y, second.frame_rows[y]![x]!]);
      }
    }
    selectionWitness = { event_ref: returned.event_ref, evidence, pixels };
  }
  const binding = { ...item.binding, child_marks_digest: identity(event.child.marks),
    control_projection_digest: event.control ? identity(event.control.projection) : item.binding.control_projection_digest,
    selection_witness: selectionWitness, last_return: returned, phase: 'needs_pose', suspension_reason: null };
  const candidate = { ...item, binding }, check = current(candidate, state, after, second.frame_rows);
  if (!check.admitted) return suspend(attention, candidate, after, check.reason);
  const ready = same(marks(check.child.marks), marks(check.model.marks));
  const rule = state.pose_rule, reachable = ready || !rule || [1, 2, 3].some(turns => same(rotatedTypedMarks(check.child.marks, rule.turns * turns), marks(check.model.marks)));
  const status = ready ? 'pose_resolved_for_retained_request' : reachable ? 'pose_still_required_for_retained_request' : 'retained_request_unreachable_under_observed_rule';
  item = revise(attention, item, { ...binding, phase: ready ? 'ready_for_delivery' : reachable ? 'needs_pose' : 'suspended',
    suspension_reason: reachable ? null : status, last_return: { ...returned, status } }, after, evidence);
  return receipt(item, after, ready ? 'resume_delivery' : reachable ? 'revise_pose' : 'suspend', status,
    { parent_status: 'pending', returned_event_ref: returned.event_ref, evidence_refs: evidence, effect_acquired_once: true });
}
