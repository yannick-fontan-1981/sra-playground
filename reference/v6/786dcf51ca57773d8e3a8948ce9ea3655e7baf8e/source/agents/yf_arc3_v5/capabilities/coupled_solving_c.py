"""K23 Source producers and evidence transport; no native search or action choice."""
from fractions import Fraction
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .coupled_value_contracts_c import CoupledDemandC
from .coupled_value_c import coupled_input_missing, affine_binding_missing
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalResponseInput
from .family_agenda_projection import FamilyAgendaDemand, FamilyAgendaReceipt
from .coupled_solving_contracts_c import (CoupledSolvingMeasureInputC, CoupledSolvingMeasurementC,
    CoupledSolvingBindInputC, CoupledSolvingQuestionC, CoupledSolvingReceiptFactsC,
    CoupledSolvingResponseInputC, CoupledSolvingConsumeInputC, CoupledSolvingConsumedC,
    CoupledSolvingReceiptInputC, CoupledSolvingAnswerInputC, CoupledSolvingAnswerC)
from .coupled_solving_contracts_c import (CoupledSolvingJoinInputC, CoupledSolvingJoinFactsC,
    CoupledSolvingJoinReturnInputC, CoupledSolvingJoinedC)
from .family_result_join import FamilyJoinCandidate, FamilyJoinGroup, FamilyJoinRequest

def measure_coupled_solving(value: CoupledSolvingMeasureInputC) -> CoupledSolvingMeasurementC:
    request = value.request
    why, agenda, native = request.why, request.agenda, request.native_template
    missing, rows, probe_rows = [], [], []
    current = (len(value.canonical_agenda_rows) == 1
        and value.canonical_agenda_rows[0].get("family_agenda") == immutable_json_data(agenda)
        and bool(value.canonical_agenda_rows[0].get("supported_agenda_claim_refs")))
    if not current: missing.append("current_canonical_parent_agenda")
    if (agenda.parent_goal_ref != why.parent_goal_ref or native.scope.parent_goal_ref != why.parent_goal_ref
            or agenda.epoch != native.scope.epoch or agenda.episode_ref != why.episode_ref
            or agenda.level_scope_ref != why.level_scope_ref
            or not why.desired_future or not request.field_goal_evidence_refs
            or not why.usefulness_premise_refs or not why.morphology_premise_refs):
        missing.append("complete_current_parent_field_why")
    if (not request.retained_model_refs or tuple(request.retained_model_refs) != native.scope.retained_alternative_refs):
        missing.append("exact_unrejected_coupled_model_alternatives")
    if native.scope.model_status_ref != "ACTIVE": missing.append("active_current_coupled_model")
    missing.extend(coupled_input_missing(native))
    agenda_request_refs = tuple(demand.request.request_ref for demand in agenda.demands)
    if (len(set(request.mechanical_prerequisite_request_refs)) != len(request.mechanical_prerequisite_request_refs)
            or any(ref not in agenda_request_refs for ref in request.mechanical_prerequisite_request_refs)):
        missing.append("exact_existing_mechanical_prerequisite_requests")
    if (len({c.constraint_ref for c in request.constraints}) != len(request.constraints)
            or not request.constraints):
        missing.append("distinct_complete_local_constraint_inventory")
    carriers = {c.carrier_ref: c for c in native.carriers}
    mapping_work = (len(request.constraints) * (len(native.correspondences) + 1)
        + len(native.actions) * (len(request.declared_stencil_offsets) + 1) * (len(native.correspondences) + 1))
    if mapping_work > native.maximum_evaluations:
        return CoupledSolvingMeasurementC(frozen_input=request,
            facts=FrozenMap({"requested_question": request.requested_question,
                "nonbinary_method": request.nonbinary_method, "current_parent_question": False,
                "mapping_bound_reached": True}), projected_constraints=(),
            missing_refs=tuple(sorted(set((*missing, "local_constraint_mapping_work_bound")))))
    if request.requested_question == "STENCILS":
        if not request.stencil_geometry_evidence_refs or not request.declared_stencil_offsets:
            missing.append("current_declared_relative_stencil_geometry")
        elif request.self_effect_status == "UNKNOWN" or not request.self_effect_evidence_refs:
            # Retain both self-effect hypotheses; clipping cannot settle them.
            offsets = tuple(sorted(set((*request.declared_stencil_offsets, (0, 0)))))
            for action in native.actions:
                supports = []
                for offset in offsets:
                    matching = tuple(row for row in native.correspondences
                        if row.anchor_ref == action.centre_anchor_ref and row.offset == offset and row.geometry_evidence_refs)
                    refs = tuple(dict.fromkeys(row.carrier_ref for row in matching))
                    if (len(refs) != 1 or refs[0] not in carriers or carriers[refs[0]].exists is not True
                            or carriers[refs[0]].protected or not carriers[refs[0]].mutable):
                        break
                    supports.append(refs[0])
                else:
                    probe_rows.append(FrozenMap({"actual_action_ref": action.action_ref,
                        "centre_anchor_ref": action.centre_anchor_ref, "interior_support_refs": tuple(supports),
                        "self_effect_alternatives": ("INCLUDED", "EXCLUDED"),
                        "falsifier": "isolated_current_before_after_at_centre_under_declared_effect_law",
                        "unchanged_centre_is_inconclusive_without_value_change_law": True,
                        "proposed_action_authorized": False}))
            missing.append("observe_self_effect_on_complete_interior_support" if probe_rows else "actual_unclipped_interior_probe_support")
    if why.desired_future.get("constraint_refs") != tuple(c.constraint_ref for c in request.constraints):
        missing.append("complete_parent_goal_constraint_inventory")
    for constraint in request.constraints:
        valid_scale = all(x > 0 for x in (*constraint.scale_numerator, *constraint.scale_denominator))
        mapped = tuple(Fraction(delta * numerator, denominator) for delta, numerator, denominator in
            zip(constraint.marked_offset, constraint.scale_numerator, constraint.scale_denominator)) if valid_scale else ()
        if len(mapped) != 2 or any(x.denominator != 1 for x in mapped):
            missing.append("exact_integral_local_anchor_scale_mapping:" + constraint.constraint_ref)
            continue
        offset = tuple(x.numerator for x in mapped)
        matches = tuple(row for row in native.correspondences
            if row.anchor_ref == constraint.anchor_ref and row.offset == offset)
        refs = tuple(dict.fromkeys(row.carrier_ref for row in matches))
        if len(refs) != 1 or refs[0] not in carriers or not constraint.evidence_refs:
            missing.append("evidenced_unique_local_carrier:" + constraint.constraint_ref)
            continue
        carrier = carriers[refs[0]]
        if constraint.kind in ("SAME", "DIFFERENT") and constraint.reference_value_ref is None:
            missing.append("current_local_reference_parameter:" + constraint.reference_parameter_ref)
            continue
        allowed = (tuple(v for v in carrier.allowed_domain if v == constraint.reference_value_ref)
            if constraint.kind == "SAME" else tuple(v for v in carrier.allowed_domain if v != constraint.reference_value_ref)
            if constraint.kind == "DIFFERENT" else constraint.requested_values)
        if constraint.kind in ("SAME", "DIFFERENT") and constraint.reference_value_ref not in carrier.allowed_domain:
            missing.append("reference_value_inside_declared_domain:" + constraint.constraint_ref)
            continue
        rows.append(FrozenMap({"constraint_ref": constraint.constraint_ref, "anchor_ref": constraint.anchor_ref,
            "offset": offset, "carrier_ref": carrier.carrier_ref,
            "predicate_kind": "VALUE" if constraint.kind in ("SAME", "DIFFERENT", "VALUES") else constraint.kind,
            "allowed_values": allowed, "support_refs": constraint.evidence_refs,
            "correlation_ref": constraint.correlation_ref,
            "reference_parameter_ref": constraint.reference_parameter_ref,
            "reference_value_ref": constraint.reference_value_ref,
            "carrier_exists": carrier.exists, "carrier_protected": carrier.protected}))
    demand_rows = tuple(CoupledDemandC(**{key: row[key] for key in
        ("constraint_ref", "anchor_ref", "offset", "predicate_kind", "allowed_values", "support_refs", "correlation_ref")}) for row in rows)
    prepared = native.model_copy(update={"demands": demand_rows})
    if why.desired_future.get("coupled_goal_digest") != stable_digest((demand_rows, native.correlations, native.target_values)):
        missing.append("exact_parent_full_value_existence_goal_binding")
    affine_missing = affine_binding_missing(prepared)
    if request.requested_question == "NONBINARY" and (native.finite_query is None or not native.finite_query_evidence_refs):
        missing.append("current_contextual_joint_transition_query")
    facts = FrozenMap({"requested_question": request.requested_question, "nonbinary_method": request.nonbinary_method,
        "current_parent_question": not bool(missing),
        "affine_certificate_bound": not bool(affine_missing),
        "finite_joint_query_bound": native.finite_query is not None and bool(native.finite_query_evidence_refs),
        "directional_order_supplied": bool(native.influence_order) and bool(native.directional_action_refs),
        "self_effect_unresolved": any(not action.support_evidence_refs for action in native.actions),
        "all_actual_action_supports_present": native.action_domain_complete and all(action.support_evidence_refs for action in native.actions),
        "mapping_complete": len(rows) == len(request.constraints),
        "goal_is_full_conjunction": True, "singleton_actions_not_invented": True})
    return CoupledSolvingMeasurementC(frozen_input=request, facts=facts,
        projected_constraints=tuple(rows), missing_refs=tuple(sorted(set(missing))), stencil_probe_facts=tuple(probe_rows))

def bind_coupled_solving_question(value: CoupledSolvingBindInputC) -> CoupledSolvingQuestionC:
    measured, operation = value.measured, value.source_disposition_ref
    parent, template = measured.frozen_input.why, measured.frozen_input.native_template
    # Source disposition is an exact requested K23 operation/mode, not a Python strategy.
    parts = operation.split("|")
    missing = measured.missing_refs
    if len(parts) != 2 or missing or operation == "coupled_solving.need_evidence":
        return CoupledSolvingQuestionC(frozen_measurement=measured, native_request=None, demand=None,
            source_disposition_ref=operation, source_reason_ref=value.source_reason_ref,
            missing_refs=missing or ("drm_current_coupled_question_signature",))
    demands = tuple(CoupledDemandC(**{key: row[key] for key in
        ("constraint_ref", "anchor_ref", "offset", "predicate_kind", "allowed_values", "support_refs", "correlation_ref")})
        for row in measured.projected_constraints)
    native = template.model_copy(update={"operation_ref": parts[0], "mode": parts[1], "demands": demands})
    # A previous calculation's checkpoint cannot migrate to a different question.
    missing = coupled_input_missing(native)
    if missing:
        return CoupledSolvingQuestionC(frozen_measurement=measured, native_request=None, demand=None,
            source_disposition_ref=operation, source_reason_ref=value.source_reason_ref, missing_refs=missing)
    identity = MechanicalRequestIdentity(request_ref=native.scope.request_ref,
        kernel_ref="mechanics.coupled_value_constraints", operation_ref=native.operation_ref, mode=native.mode,
        caller_ref=native.scope.caller_ref, parent_contribution_ref=native.scope.parent_contribution_ref,
        epoch=native.scope.epoch, input_revision_ref=native.scope.evidence_revision_ref,
        model_assignments=FrozenMap({"model_revision_ref": native.scope.model_revision_ref,
            "retained_model_refs": measured.frozen_input.retained_model_refs}),
        immutable_inputs=FrozenMap({"native_request_digest": stable_digest(immutable_json_data(native)),
            "parent_why": immutable_json_data(parent)}),
        actual_bounds=FrozenMap({"maximum_evaluations": native.maximum_evaluations,
            "maximum_states": native.maximum_states, "maximum_depth": native.maximum_depth}),
        expected_return_type="MechanicalFamilyResult", requested_domain_ref=parent.question_ref)
    demand = FamilyAgendaDemand(request=identity, parent_goal_ref=parent.parent_goal_ref,
        descriptive_domain_ref=parent.question_ref, consumer_ref=parent.consumer_ref,
        scope_ref=parent.temporal_scope_ref, episode_ref=parent.episode_ref, level_scope_ref=parent.level_scope_ref,
        dependency_revisions=measured.frozen_input.agenda.current_dependency_revisions,
        prerequisite_request_refs=measured.frozen_input.mechanical_prerequisite_request_refs)
    return CoupledSolvingQuestionC(frozen_measurement=measured, native_request=native, demand=demand,
        source_disposition_ref=operation, source_reason_ref=value.source_reason_ref, missing_refs=())

def measure_coupled_solving_receipt(request, canonical_rows):
    question, returned, agenda = request.question, request.returned, request.current_agenda
    original = question.frozen_measurement.frozen_input
    missing = []
    bound = question.demand is not None and question.native_request is not None and not question.missing_refs
    current = (len(canonical_rows) == 1 and canonical_rows[0].get("family_agenda") == immutable_json_data(agenda)
        and bool(canonical_rows[0].get("supported_agenda_claim_refs")))
    if not bound:
        missing.append("bound_parent_k23_question")
    if not current:
        missing.append("current_canonical_receipt_agenda")
    if bound:
        demand, native = question.demand, question.native_request
        if (agenda.parent_goal_ref != original.why.parent_goal_ref or agenda.epoch != native.scope.epoch
                or agenda.episode_ref != original.why.episode_ref or agenda.level_scope_ref != original.why.level_scope_ref
                or demand not in agenda.demands
                or any(ref in agenda.invalidated_dependency_refs
                    or agenda.current_dependency_revisions.get(ref) != demand.dependency_revisions[ref]
                    for ref in sorted(demand.dependency_revisions))):
            missing.append("unchanged_current_question_dependencies")
        if (returned.frozen_request != native or returned.calculation.native.scope != native.scope
                or returned.calculation.native.operation_ref != native.operation_ref
                or returned.calculation.native.mode != native.mode):
            missing.append("exact_k23_request_and_native_receipt")
    result = returned.calculation.native
    contradiction = bool(result.values.get("conflicting_carrier_refs")) or any(
        row.get("empty_value_intersection") is True or row.get("existence_conflict") is True
        or row.get("value_request_on_absent_carrier") is True for row in returned.calculation.rows)
    return CoupledSolvingReceiptFactsC(frozen_input=request, missing_refs=tuple(sorted(set(missing))),
        facts=FrozenMap({"question_bound": bound, "receipt_current": not bool(missing),
            "native_bound_reached": result.computation_bound_reached,
            "native_missing_evidence": bool(result.prerequisite_refs) or bool(result.implementation_debt_refs),
            "native_signature_supported": result.signature_supported,
            "native_domain_complete": result.domain_complete,
            "local_constraint_contradiction": contradiction,
            "goal_not_universally_rejected": True}))

def bind_coupled_solving_response(value: CoupledSolvingResponseInputC) -> MechanicalResponseInput:
    measured, source = value.measured, value.measured.frozen_input
    question, returned = source.question, source.returned
    result = returned.calculation.native
    missing = (*measured.missing_refs, *result.prerequisite_refs, *result.implementation_debt_refs)
    native = question.native_request
    return MechanicalResponseInput(request=question.demand.request, returned_identity=question.demand.request,
        source_status=value.source_status, returned_type="MechanicalFamilyResult",
        descriptive_values=FrozenMap({"native_return": immutable_json_data(result),
            "coupled_value_rows": returned.calculation.rows, "missing_refs": tuple(dict.fromkeys(missing)),
            "parent_why": immutable_json_data(question.frozen_measurement.frozen_input.why),
            "source_reason_ref": returned.source_reason_ref, "source_policy_ref": returned.source_policy_ref,
            "contradiction_scope": "this_current_constraint_model_only", "goal_not_universally_rejected": True}),
        retained_alternative_refs=native.scope.retained_alternative_refs,
        eligible_sibling_refs=native.scope.eligible_sibling_refs,
        distinguishing_question_ref=question.frozen_measurement.frozen_input.why.question_ref,
        missing_cause="COMPUTATION_BOUND" if value.source_status == "BUDGET_REACHED"
            else "MISSING_OBSERVATION" if value.source_status == "NEEDS_EVIDENCE" else None,
        consumed_request_refs=native.scope.consumed_request_refs,
        retained_frontier=FrozenMap({"native_frontier": result.frontier,
            "coupled_checkpoint": immutable_json_data(returned.calculation.checkpoint)
                if returned.calculation.checkpoint is not None else None,
            "caller_next_item_ref": question.frozen_measurement.frozen_input.why.next_item_ref}))

def consume_coupled_solving(value: CoupledSolvingConsumeInputC) -> CoupledSolvingConsumedC:
    source = value.measured.frozen_input
    why = source.question.frozen_measurement.frozen_input.why
    normalized = value.normalized
    exact = (normalized is not None and source.question.demand is not None
        and normalized.request == source.question.demand.request
        and value.measured.facts.get("receipt_current") is True)
    receipt = (immutable_json_data(FamilyAgendaReceipt(
        receipt_ref="receipt.coupled_solving." + stable_digest((source.question.demand, normalized)),
        demand=source.question.demand, result=normalized)) if exact else FrozenMap())
    return CoupledSolvingConsumedC(frozen_input=source, normalized=normalized, receipt=receipt,
        next_item_ref=why.next_item_ref, parent_why=why)

def bind_coupled_execution_receipt(value: CoupledSolvingAnswerInputC) -> CoupledSolvingReceiptInputC:
    return CoupledSolvingReceiptInputC(question=value.request.question,
        returned=value.native_return, current_agenda=value.request.current_agenda)

def finish_coupled_solving_answer(value: CoupledSolvingAnswerInputC) -> CoupledSolvingAnswerC:
    return CoupledSolvingAnswerC(request=value.request, native_return=value.native_return,
        consumed=value.consumed, missing_refs=() if value.native_return is not None else
            (*value.request.question.missing_refs, "current_published_parent_k23_question_required"))

def produce_coupled_solving_join(value: CoupledSolvingJoinInputC) -> CoupledSolvingJoinFactsC:
    answer, missing, candidates = value.answer, [], []
    why = answer.request.question.frozen_measurement.frozen_input.why
    consumed = answer.consumed
    if (answer.native_return is None or consumed is None or not consumed.receipt
            or consumed.normalized is None or consumed.normalized.status != "FOUND"
            or not answer.native_return.calculation.native.domain_complete):
        missing.append("complete_current_supported_coupled_witness_receipt")
    if not missing:
        result = answer.native_return.calculation
        payload = result.native.values
        witnesses = tuple(row for row in result.rows if "final_values" in row and "actual_action_word" in row)
        if not witnesses and (payload.get("word_verified_under_same_successor") is True
                or payload.get("full_forward_verification") is True or payload.get("witness_supported") is True):
            witnesses = (FrozenMap({"final_values": result.current_values,
                "actual_action_word": payload.get("actual_action_word", ())}),)
        if not witnesses:
            missing.append("goal_satisfying_word_under_same_full_successor")
        if len(witnesses) > 128 or any(len(row["final_values"]) > 256 for row in witnesses):
            missing.append("bounded_whole_coupled_assignment_projection")
        peer_rows = tuple(candidate for group in value.peer_groups for candidate in group.candidates)
        if len(peer_rows) + len(witnesses) > 256:
            missing.append("bounded_current_peer_candidate_domain")
        if any(candidate.result.request.epoch != answer.request.current_agenda.epoch
                or candidate.rationale.get("parent_goal_ref") != why.parent_goal_ref
                or candidate.rationale.get("episode_ref") != why.episode_ref
                or candidate.rationale.get("level_scope_ref") != why.level_scope_ref for candidate in peer_rows):
            missing.append("same_parent_and_level_peer_domains")
        if any(ref in answer.request.current_agenda.invalidated_dependency_refs
                or answer.request.current_agenda.current_dependency_revisions.get(ref) != candidate.dependency_revisions[ref]
                for candidate in peer_rows for ref in sorted(candidate.dependency_revisions)):
            missing.append("current_peer_domain_dependency_revisions")
        if not missing:
            for index, row in enumerate(witnesses):
                candidates.append(FamilyJoinCandidate(candidate_ref=value.candidate_prefix_ref + "." + str(index),
                    result=consumed.normalized, dependency_revisions=answer.request.current_agenda.current_dependency_revisions,
                    assignments=row["final_values"], resource_provenance=FrozenMap(),
                    preservation_refs=why.preservation_refs,
                    rationale=FrozenMap({"usefulness_premise_refs": why.usefulness_premise_refs,
                        "morphology_premise_refs": why.morphology_premise_refs, "consumer_ref": why.consumer_ref,
                        "desired_predicate": why.desired_future, "and_dependency_refs": why.and_dependency_refs,
                        "or_dependency_refs": why.or_dependency_refs, "temporal_scope_ref": why.temporal_scope_ref,
                        "evidence_status": "supported", "falsifier_ref": why.falsifier_ref,
                        "parent_goal_ref": why.parent_goal_ref, "episode_ref": why.episode_ref,
                        "level_scope_ref": why.level_scope_ref, "actual_action_word": row["actual_action_word"],
                        "no_execution_authority": True})))
    group = FamilyJoinGroup(group_ref=value.candidate_prefix_ref, candidates=tuple(candidates), domain_complete=False)
    if group.group_ref in tuple(peer.group_ref for peer in value.peer_groups):
        missing.append("distinct_current_composition_group")
    refs = tuple(candidate.candidate_ref for peer in value.peer_groups for candidate in peer.candidates)
    if len(set(refs)) != len(refs) or any(candidate.candidate_ref in refs for candidate in candidates):
        missing.append("distinct_current_composition_candidates")
    request = None if missing else FamilyJoinRequest(request_ref=value.join_request_ref,
        parent_goal_ref=why.parent_goal_ref, episode_ref=why.episode_ref, level_scope_ref=why.level_scope_ref,
        epoch=answer.request.current_agenda.epoch, groups=(group, *value.peer_groups),
        max_pairs=value.max_pairs, max_candidates=value.max_candidates)
    return CoupledSolvingJoinFactsC(frozen_input=value, request=request,
        facts=FrozenMap({"join_bound": request is not None, "witness_domain_only": True}),
        missing_refs=tuple(sorted(set(missing))))

def return_coupled_solving_join(value: CoupledSolvingJoinReturnInputC) -> CoupledSolvingJoinedC:
    return CoupledSolvingJoinedC(frozen_measurement=value.measured, joined=value.joined,
        next_item_ref=value.measured.frozen_input.answer.request.question.frozen_measurement.frozen_input.why.next_item_ref)
