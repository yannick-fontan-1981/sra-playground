/** Exact scoped public-response reconciliation from V6 stationary_return.py.
 * Reference 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. No physical action authority.
 */
import { symbolicDigest } from './v6-hash.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import { supportCompare } from './v6-support-measurements.ts';
type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const refs = (values: string[]): string[] => [...new Set(values)];
function shape(entity: R): any { return entity.mask == null ? null : [entity.area ?? null, [...entity.mask].sort(supportCompare)]; }
function sameCurrent(obs: R, prior: R): R | null {
  const rows = (obs.entities ?? []).filter((e: R) => e.signature === prior.signature);
  return rows.length === 1 ? rows[0] : null;
}
function partAtPose(obs: R, prior: R, causalOperatorRecolor = false): R | null {
  const rows = (obs.entities ?? []).filter((e: R) => eq(e.bbox, prior.bbox) && eq(shape(e), shape(prior))
    && shape(prior) !== null && (causalOperatorRecolor || e.signature === prior.signature));
  return rows.length === 1 ? rows[0] : null;
}

export function retain_selected(scene: R, question: R, recipe: R, row: R, subject: R,
  observation_ref: string, epoch: number, selection_ref: string, prior: R | null = null,
  options: { binding?: R | null } = {}): R {
  const binding = options.binding;
  if (!truth(selection_ref) || !truth(question.id) || !truth(row.candidate_ref)) throw new TypeError('Selected parent and geometric contrast references required');
  if (!truth(binding) || binding!.observation_ref !== observation_ref || binding!.epoch !== epoch
    || row.actor_component_ref !== binding!.actor_ref || row.peer_component_ref !== binding!.peer_ref) {
    throw new TypeError('Selected geometry is not bound to the current parent actor and pursued peer');
  }
  if (row.part_entity_ref != null && (!truth(binding!.part_entity_ref) || row.part_entity_ref !== binding!.part_entity_ref
    || subject.id !== binding!.part_entity_ref)) throw new TypeError('Selected geometry has no current part entity correspondence');
  if (row.part_component_ref != null && row.part_component_ref !== binding!.part_ref) throw new TypeError('Selected geometry changed the acquired part component');
  if (!Number.isSafeInteger(row.access_distance) || row.access_distance < 0) throw new TypeError('Selected preparation has no measured access distance');
  const hasStationaryContrast = ['independent_terminal', 'stationary_part_neighbor_loss', 'joint_terminal_reachable',
    'peer_exit_count_after_independent_actor', 'future_part_cells'].every(k => Object.hasOwn(row, k));
  if (['grip_root', 'peer_cell', 'part_cells'].some(k => !Object.hasOwn(row, k))) throw new TypeError('Incomplete selected preparation geometry');
  if (recipe.scope !== epoch || !truth(recipe.evidence)) throw new TypeError('Current acquired coupling evidence missing');
  const operator = recipe.operator_action_ref, operatorRefs = recipe.operator_observation_refs ?? [];
  if (!truth(operator) || !truth(operatorRefs)) throw new TypeError('Actual acquisition operator was not retained');
  if (!eq(subject.bbox, recipe.subject_box)) throw new TypeError('Current prepared part mismatch');
  const offset = [0, 1].map(i => subject.bbox[i] - scene.body.bbox[i]);
  if (!eq(offset, recipe.offset)) throw new TypeError('Current coupling relation mismatch');
  let ref = 'prepared-constraint:' + symbolicDigest([epoch, question.id, row.candidate_ref, observation_ref]);
  let sameTarget = Boolean(truth(prior) && prior!.epoch === epoch && prior!.parent_ref === question.id
    && eq(prior!.geometry_row.grip_root, row.grip_root) && eq(prior!.grid ?? null, scene.grid));
  const contract = row.prepared_constraint_contract;
  if (contract != null) {
    const proposed = row.prepared_constraint_ref;
    if (!truth(proposed) || contract.ref !== proposed || contract.status !== 'PROPOSED' || contract.parent !== question.id
      || contract.scope !== epoch || contract.source_frame_ref !== observation_ref || !eq(contract.coupling_claim_refs, recipe.method_claim_refs)) {
      throw new TypeError('Prepared proposal reference is not bound to its current parent, scope and acquired coupling');
    }
    ref = proposed; sameTarget = sameTarget && prior!.ref === proposed;
  } else if (sameTarget) ref = prior!.ref;
  return { ref, parent_ref: question.id, epoch,
    phase: row.access_distance === 0 ? hasStationaryContrast ? 'inverse_question_pending' : 'preparation_geometry_question' : 'loaded_preparation_access',
    epistemic_status: 'proposed', selection_ref, geometry_row: copy(row), grid: copy(scene.grid), target_retained: sameTarget,
    role_binding: copy(binding), stationary_contrast_available: hasStationaryContrast,
    supersedes_prepared_ref: truth(prior) && !sameTarget ? prior!.ref ?? null : null,
    body: copy(scene.body), peer: copy(scene.peer), part: copy(subject), operator_action_ref: operator,
    operator_observation_refs: [...operatorRefs], coupling_evidence: [...recipe.evidence], evidence: [observation_ref],
    part_stationary_independence_observed: false, capture_law_proved: false,
    falsifiers: ['stationary_part_or_independent_access_not_preserved', 'current_scope_or_identity_unresolved', 'official_contact_does_not_complete_parent'] };
}

export function current_binding(prepared: R, observation: R): R {
  if (observation.level_epoch !== prepared.epoch) return { admitted: false, reason: 'prepared_constraint_scope_changed' };
  const body = sameCurrent(observation, prepared.body), peer = sameCurrent(observation, prepared.peer), part = partAtPose(observation, prepared.part);
  return { admitted: Boolean(body && peer && part), reason: 'current_distinct_body_peer_and_stationary_part',
    body, peer, part, prepared_constraint_ref: prepared.ref };
}

export function record_loaded(prepared: R, before: R, after: R, command: R, expected_body_box: readonly number[],
  expected_part_box: readonly number[], options: { at_target?: boolean } = {}): R {
  const p = copy(prepared);
  if (!['loaded_preparation_access', 'loaded_preparation_revalidation_required'].includes(p.phase)) throw new TypeError('No selected preparation access is active');
  const prior = current_binding(p, before);
  if (!prior.admitted || !eq(prior.body.bbox, p.body.bbox)) throw new TypeError('Loaded approach did not start at its actual bound composition');
  const evidence = [before.observation_ref, after.observation_ref];
  if (evidence[0] === evidence[1]) throw new TypeError('Loaded approach lacks a new actual response');
  if (after.levels_completed > before.levels_completed) return { ...p, phase: 'official_completion', official_completion_evidence: evidence };
  if (after.level_epoch !== p.epoch) return { ...p, phase: 'current_binding_unresolved', scope_change_refs: evidence };
  const body = sameCurrent(after, p.body), wanted = { ...copy(p.part), bbox: [...expected_part_box] },
    part = partAtPose(after, wanted), peer = sameCurrent(after, p.peer);
  const bodyOk = Boolean(body && eq(body.bbox, expected_body_box)), partOk = part !== null,
    peerSame = Boolean(peer && eq(peer.bbox, p.peer.bbox));
  p.last_loaded_reply = { evidence, command: copy(command), body_arrival_matched: bodyOk, part_arrival_matched: partOk,
    peer_premise_preserved: peerSame, target_ref: p.ref, target_reached_geometrically: Boolean(options.at_target && bodyOk && partOk),
    capture_or_constraint_proved: false };
  p.evidence = refs([...p.evidence, ...evidence]);
  if (bodyOk && partOk) {
    p.body = copy(body); p.part = copy(part);
    p.phase = options.at_target && peerSame ? 'preparation_pose_reached_requires_current_geometry'
      : peerSame ? 'loaded_preparation_access' : 'loaded_preparation_revalidation_required';
  } else p.phase = 'current_binding_unresolved';
  p.current_peer_revalidated = peer !== null; if (peer) p.peer = copy(peer); return p;
}

export function facts(prepared: R | null, suppliedRow: R | null = null): R {
  const p = truth(prepared) ? prepared! : {}, row = truth(suppliedRow) ? suppliedRow! : {};
  return { prepared_constraint_experiment: truth(p.ref), current_parent_peer_bound: truth(p.role_binding),
    candidate_is_prepared_inverse_operator: p.phase === 'inverse_question_pending',
    prospective_grasp_prepared_constraint_ref: p.ref ?? null,
    prospective_grasp_prepared_constraint_claim_refs: truth(p.ref) ? [p.ref] : [],
    prospective_grasp_coupling_claim_refs: p.coupling_evidence ?? [], prospective_grasp_operator_observation_refs: p.inverse_reply_refs ?? [],
    prospective_grasp_independent_motion: row.independent_motion_present === true,
    prospective_grasp_conditional_peer_contact: row.conditional_peer_contact === true,
    prospective_grasp_independence_observed: p.part_stationary_independence_observed === true,
    prospective_grasp_peer_exit_count_after_independent_actor: row.peer_exit_count_after_independent_actor ?? null,
    prospective_grasp_stationary_part_neighbor_loss: row.stationary_part_neighbor_loss ?? null };
}

export function record_inverse(prepared: R, before: R, after: R, command: R): R {
  const p = copy(prepared);
  if (p.phase !== 'inverse_question_pending' || !eq(command, { action_ref: p.operator_action_ref })) throw new TypeError('Inverse reply is not the selected acquired operator');
  if (before.level_epoch !== p.epoch || before.observation_ref === after.observation_ref) throw new TypeError('Inverse reply scope or actual response missing');
  const prior = current_binding(p, before);
  if (!prior.admitted || !eq(prior.body.bbox, p.body.bbox)) throw new TypeError('Inverse did not start at its currently bound preparation');
  const evidence = [before.observation_ref, after.observation_ref];
  if (after.levels_completed > before.levels_completed) return { ...p, phase: 'official_completion', official_completion_evidence: evidence };
  if (after.level_epoch !== p.epoch) return { ...p, phase: 'current_binding_unresolved', scope_change_refs: evidence };
  const body = sameCurrent(after, p.body), part = partAtPose(after, p.part, true);
  const samePose = Boolean(body && eq(body.bbox, p.body.bbox) && part);
  p.inverse_reply_refs = evidence; p.evidence = refs([...p.evidence, ...evidence]);
  p.inverse_observation = { body_pose_preserved: samePose, part_unique_same_geometry: part !== null,
    appearance_changed: Boolean(part && part.signature !== p.part.signature), detachment_proved: false };
  if (samePose) { p.part = copy(part); p.body = copy(body); }
  p.phase = samePose ? 'independent_probe_required' : 'current_binding_unresolved'; return p;
}

export function record_independent(prepared: R, before: R, after: R, command: R, expected_body_box: readonly number[]): R {
  const p = copy(prepared);
  if (!['independent_probe_required', 'independent_access'].includes(p.phase)) throw new TypeError('No returned inverse awaiting independent access');
  const evidence = [before.observation_ref, after.observation_ref];
  if (before.level_epoch !== p.epoch || before.observation_ref === after.observation_ref) throw new TypeError('Independent reply lacks its scoped actual response');
  const prior = current_binding(p, before);
  if (!prior.admitted || !eq(prior.body.bbox, p.body.bbox)) throw new TypeError('Independent access did not start at its current bound body and part');
  if (after.levels_completed > before.levels_completed) return { ...p, phase: 'official_completion', official_completion_evidence: evidence };
  if (after.level_epoch !== p.epoch) return { ...p, phase: 'current_binding_unresolved', scope_change_refs: evidence };
  const body = sameCurrent(after, p.body), part = partAtPose(after, p.part);
  const moved = Boolean(body && eq(body.bbox, expected_body_box) && !eq(body.bbox, p.body.bbox)), independent = Boolean(moved && part);
  p.last_independent_reply = { evidence, command: copy(command), body_arrival_matched: moved, part_stationary_currently_matched: part !== null,
    independence_observed: independent, capture_proved: false };
  p.evidence = refs([...p.evidence, ...evidence]);
  if (independent) {
    p.body = copy(body); p.part = copy(part); p.part_stationary_independence_observed = true; p.phase = 'independent_access';
  } else p.phase = 'independence_unresolved_or_contradicted';
  const peer = sameCurrent(after, p.peer); p.current_peer_revalidated = peer !== null;
  if (peer) p.peer = copy(peer); return p;
}

export const retainSelected = retain_selected, currentBinding = current_binding, recordLoaded = record_loaded,
  recordInverse = record_inverse, recordIndependent = record_independent;
