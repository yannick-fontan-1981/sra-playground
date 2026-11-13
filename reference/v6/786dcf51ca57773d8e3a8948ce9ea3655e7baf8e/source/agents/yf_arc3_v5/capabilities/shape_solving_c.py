"""Source-qualified full-contour reasoning over existing K26 receipt domains."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .family_agenda_projection import project_family_agenda,demand_signature,FamilyAgendaReceipt
from .mechanical_return_a import mechanical_request_identity_a
from .contact_shape_repair import SHAPE_OPERATION_MODES
from .shape_solving_contracts_c import ShapeSolvingFactsC,ShapeSolvingReturnC,ShapeJoinFactsC
from .family_result_join import FamilyJoinCandidate,FamilyJoinGroup,FamilyJoinRequest
from .word_solving_c import word_result_path
from .shape_contact_reasons_c import project_shape_contact_reasons

def shape_receipt_current(base,support):
    request,result = support.native_request,support.native_result
    return (bool(support.evidence_refs) and result.scope == request.scope
        and result.operation_ref == request.operation_ref and result.mode == request.mode
        and request.mode in SHAPE_OPERATION_MODES.get(request.operation_ref.removeprefix("mechanics.contact_shape_repair."), ())
        and result.signature_supported and result.domain_complete
        and not result.prerequisite_refs and not result.implementation_debt_refs
        and not result.computation_bound_reached
        and request.source_identity_ref == base.source_identity_ref and request.model == base.model
        and all(getattr(request.scope,key) == getattr(base.scope,key) for key in (
            "parent_goal_ref","epoch","evidence_revision_ref","model_revision_ref","model_status_ref","event_owner_ref")))

def measure_shape_solving(request,canonical_rows,binding_rows,conditional_body_refs=()):
    native,why,agenda,demand = request.native_request,request.why,request.agenda,request.demand
    missing,reasons = [],[]
    identity = mechanical_request_identity_a(native,"mechanics.contact_shape_repair",native.scope,native.operation_ref,native.mode)
    if (demand.request != identity or demand not in agenda.demands or native.scope.parent_goal_ref != why.parent_goal_ref
            or demand.parent_goal_ref != why.parent_goal_ref or demand.consumer_ref != why.consumer_ref
            or demand.episode_ref != why.episode_ref or demand.level_scope_ref != why.level_scope_ref
            or not why.usefulness_premise_refs or not why.morphology_premise_refs):
        missing.append("exact_current_shape_parent_why_and_question")
    if (len(canonical_rows) != 1 or canonical_rows[0].get("family_agenda") != immutable_json_data(agenda)
            or not canonical_rows[0].get("supported_agenda_claim_refs")):
        missing.append("current_canonical_shape_parent_agenda")
    rows = tuple(row for row in project_family_agenda(agenda)["rows"]
        if row["signature_ref"] == demand_signature(demand)
        and row["demand"]["request"]["request_ref"] == demand.request.request_ref)
    if (len(rows) != 1 or not rows[0]["owner_current"] or not rows[0]["current_inputs_bound"]
            or not rows[0]["prerequisites_current"] or rows[0]["conflicting_current_returns"]
            or rows[0]["consumed_current_signature"]):
        missing.append("next_prerequisite_satisfied_unconsumed_shape_question")
    if native.mode not in SHAPE_OPERATION_MODES.get(native.operation_ref.removeprefix("mechanics.contact_shape_repair."),()):
        missing.append("registered_exact_K26_operation_mode")
    fields = native.model_fields_set - {"schema_version","scope","source_identity_ref","operation_ref","mode",
        "maximum_evaluations","maximum_states","resume"}
    if conditional_body_refs:
        if not set(conditional_body_refs) <= set(native.scope.assumption_refs):
            missing.append("explicit_current_shape_geometry_assumptions")
        fields = fields - {"bodies"}
    bound = {binding.native_field_ref for binding in request.canonical_bindings}
    if (fields != bound or len(bound) != len(request.canonical_bindings) or len(binding_rows) != len(request.canonical_bindings)):
        missing.append("complete_current_canonical_shape_native_binding_closure")
    contract = request.goal_contract
    if (contract.targets != native.targets or not contract.marker_ensemble_evidence_refs or not contract.contour_family_evidence_refs
            or not contract.aspect_evidence_refs or contract.evidence_revision_ref != native.scope.evidence_revision_ref
            or contract.cross_intersection_only and not contract.cross_model_evidence_refs
            or not contract.cross_intersection_only and any(target.required_mask is None for target in contract.targets)
            or why.desired_future.get("shape_goal_contract_digest") != stable_digest(immutable_json_data(contract))):
        missing.append("independent_complete_contour_family_marker_and_aspect_contract")
    if (contract.restoration_target_refs and not contract.restoration_evidence_refs
            or not set(contract.restoration_target_refs) <= {target.target_ref for target in contract.targets}):
        missing.append("explicit_restoration_targets_in_terminal_conjunction")
    bodies = {body.body_ref:body for body in native.bodies}
    contact_reasons, contact_missing = project_shape_contact_reasons(request, shape_receipt_current)
    reasons.extend(contact_reasons)
    missing.extend(contact_missing)
    if len({row.body_ref for row in request.observability}) != len(request.observability):
        missing.append("unique_current_shape_observability_per_body")
    for observation in request.observability:
        body = bodies.get(observation.body_ref)
        if (body is None or observation.status == "MISSING" or not observation.retained_geometry_evidence_refs
                or not observation.falsifier_ref or observation.status == "OBSERVED" and observation.clipped_or_covered_segment_refs
                or not set(observation.clipped_or_covered_segment_refs) <= {segment.segment_ref for segment in body.segments}):
            missing.append("retained_occluded_geometry_not_deleted_by_clipping_or_focus_overlay")
    for support in request.transit_supports:
        transit,restoration = support.transit_receipt,support.restoration_receipt
        if (not shape_receipt_current(native,transit) or not shape_receipt_current(native,restoration)
                or transit.native_request.bodies != native.bodies
                or transit.native_request.operation_ref != "mechanics.contact_shape_repair.inverse_shape"
                or restoration.native_request.operation_ref != transit.native_request.operation_ref
                or not tuple(target for target in restoration.native_request.targets
                    if target.target_ref == support.restoration_target_ref)
                    == tuple(target for target in contract.targets if target.target_ref == support.restoration_target_ref)
                or not support.temporary_contour_evidence_refs or not support.gap_clearance_evidence_refs
                or support.restoration_target_ref not in contract.restoration_target_refs
                or not support.enabling_dependency_refs or not set(support.enabling_dependency_refs) <= set(why.and_dependency_refs)):
            missing.append("temporary_transit_shape_has_current_receipts_and_explicit_restoration")
            continue
        before = tuple(row for row in transit.native_result.values.get("candidate_rows",())
            if isinstance(row,FrozenMap) and row.get("candidate_ref") == transit.candidate_ref)
        after = tuple(row for row in restoration.native_result.values.get("candidate_rows",())
            if isinstance(row,FrozenMap) and row.get("candidate_ref") == restoration.candidate_ref)
        if (len(before) != 1 or len(after) != 1 or before[0].get("transit_supported") is not True
                or after[0].get("transit_supported") is not True or after[0].get("final_pose_compatible") is not True):
            missing.append("real_forward_supported_transit_and_final_restoration_pose")
            continue
        matches = after[0].get("target_matches")
        if (not isinstance(matches,tuple) or not any(isinstance(row,FrozenMap)
                and row.get("target_ref") == support.restoration_target_ref and row.get("compatible") is True for row in matches)):
            missing.append("restoration_really_satisfies_its_named_terminal_target")
            continue
        intermediate = before[0].get("actual_body_after_word")
        transit_candidates = tuple(candidate for candidate in transit.native_request.candidates
            if candidate.candidate_ref == transit.candidate_ref)
        restore_candidates = tuple(candidate for candidate in restoration.native_request.candidates
            if candidate.candidate_ref == restoration.candidate_ref)
        restored_before = tuple(body for body in restoration.native_request.bodies if body.body_ref == support.body_ref)
        if (len(restored_before) != 1 or len(transit_candidates) != 1 or len(restore_candidates) != 1
                or transit_candidates[0].body_ref != support.body_ref or restore_candidates[0].body_ref != support.body_ref
                or intermediate != immutable_json_data(restored_before[0])):
            missing.append("restoration_starts_at_actual_transit_body_not_initial_witness")
            continue
        reasons.append(FrozenMap({"body_ref":support.body_ref,"transit_receipt":before[0],"restoration_receipt":after[0],
            "restoration_target_ref":support.restoration_target_ref,"enabling_dependency_refs":support.enabling_dependency_refs}))
    for support in request.reassignment_supports:
        receipt = support.receipt
        if (not shape_receipt_current(native,receipt) or receipt.native_request.operation_ref != "mechanics.contact_shape_repair.assignment_domain"
                or receipt.native_request.bodies != native.bodies or receipt.native_request.targets != contract.targets
                or not support.blocked_previous_evidence_refs or not support.replacement_evidence_refs
                or not set(support.restoration_target_refs) <= set(contract.restoration_target_refs)):
            missing.append("reassignment_has_current_complete_domain_and_explicit_restoration")
            continue
        domain = receipt.native_result.values.get("candidate_rows",())
        previous = tuple(row for row in domain if isinstance(row,FrozenMap) and row.get("assignment_ref") == support.previous_assignment_ref)
        replacement = tuple(row for row in domain if isinstance(row,FrozenMap) and row.get("assignment_ref") == support.replacement_assignment_ref)
        if (len(previous) != 1 or len(replacement) != 1 or previous[0].get("compatible") is not False
                or replacement[0].get("compatible") is not True or replacement[0].get("complete_target_coverage") is not True
                or replacement[0].get("injective") is not True):
            missing.append("replacement_injective_assignment_restores_complete_terminal_conjunction")
            continue
        reasons.append(FrozenMap({"previous_assignment":previous[0],"replacement_assignment":replacement[0],
            "restoration_target_refs":support.restoration_target_refs,"evidence_refs":support.replacement_evidence_refs,
            "route_not_proved_by_assignment":replacement[0].get("transit_or_route_proven")}))
    for support in request.loop_supports:
        receipt = support.receipt
        if (not shape_receipt_current(native,receipt) or receipt.native_request.operation_ref != "mechanics.contact_shape_repair.round_trip_delta"
                or receipt.native_request.bodies != native.bodies
                or not support.focus_evidence_refs or support.focus_before != support.focus_after
                or not support.enabling_dependency_refs or not set(support.enabling_dependency_refs) <= set(why.and_dependency_refs)):
            missing.append("closed_focus_loop_has_grounded_enabling_shape_dependency")
            continue
        rows = receipt.native_result.values.get("candidate_rows",())
        deltas = rows[0].get("loop_geometry_deltas") if isinstance(rows,tuple) and len(rows) == 1 and isinstance(rows[0],FrozenMap) else None
        relevant = tuple(row for row in deltas if isinstance(row,FrozenMap) and row.get("body_ref") == support.body_ref) if isinstance(deltas,tuple) else ()
        if len(relevant) != 1 or relevant[0].get("internal_geometry_equal") is not False:
            missing.append("same_focus_loop_really_changes_internal_segment_geometry")
            continue
        reasons.append(FrozenMap({"body_ref":support.body_ref,"closed_focus_evidence_refs":support.focus_evidence_refs,
            "internal_geometry_delta":relevant[0],"enabling_dependency_refs":support.enabling_dependency_refs}))
    return ShapeSolvingFactsC(frozen_input=request,facts=FrozenMap({"current_shape_question":not bool(missing)}),
        support_reasons=tuple(reasons),missing_refs=tuple(sorted(set(missing))))

def bind_shape_solving(value):
    return value.measured.frozen_input.native_request

def finish_shape_solving(value):
    request,returned = value.measured.frozen_input,value.returned
    receipt = FrozenMap()
    if returned is not None and returned.request == request.demand.request and not value.measured.missing_refs:
        receipt = immutable_json_data(FamilyAgendaReceipt(receipt_ref="receipt.shape_solving."+stable_digest((request.demand,returned)),
            demand=request.demand,result=returned))
    join,missing = None,[]
    if request.join_request_ref is not None:
        peers = tuple(candidate for group in request.peer_groups for candidate in group.candidates)
        refs = tuple(candidate.candidate_ref for candidate in peers)
        group_refs = tuple(group.group_ref for group in request.peer_groups)
        support_refs = tuple(support.candidate_ref for support in request.join_supports)
        if (not receipt or returned.status != "FOUND" or not request.join_supports
                or len(set(refs)) != len(refs) or len(set(group_refs)) != len(group_refs)
                or len(set(support_refs)) != len(support_refs) or set(refs)&set(support_refs)
                or len(peers)+len(support_refs)>256
                or any(candidate.result.request.epoch != request.agenda.epoch
                    or candidate.rationale.get("parent_goal_ref") != request.why.parent_goal_ref
                    or candidate.rationale.get("episode_ref") != request.why.episode_ref
                    or candidate.rationale.get("level_scope_ref") != request.why.level_scope_ref
                    or any(ref in request.agenda.invalidated_dependency_refs
                        or request.agenda.current_dependency_revisions.get(ref) != candidate.dependency_revisions[ref]
                        for ref in sorted(candidate.dependency_revisions)) for candidate in peers)):
            missing.append("current_correlated_shape_and_peer_domains_for_scoped_join")
        else:
            calculation = returned.descriptive_values.get("calculation")
            native_values = calculation.get("values") if isinstance(calculation,FrozenMap) else None
            if (not isinstance(native_values,FrozenMap) or calculation.get("domain_complete") is not True
                    or calculation.get("prerequisite_refs") or calculation.get("computation_bound_reached")):
                missing.append("exact_complete_shape_result_domain")
            else:
                candidates = []
                for support in request.join_supports:
                    row,row_bound = word_result_path(native_values,support.native_row_path)
                    assignments,resources = {},{}
                    valid = row_bound and bool(support.evidence_refs)
                    for declared,projected in ((support.assignment_paths,assignments),(support.resource_paths,resources)):
                        if len(declared)>256:
                            valid=False
                            break
                        for key in sorted(declared):
                            projected_value,bound = word_result_path(row,declared[key])
                            valid=valid and bound
                            projected[key]=projected_value
                    if not valid:
                        missing.append("exact_shape_row_assignments_and_resource_projection")
                        continue
                    why = request.why
                    candidates.append(FamilyJoinCandidate(candidate_ref=support.candidate_ref,result=returned,
                        dependency_revisions=request.agenda.current_dependency_revisions,assignments=FrozenMap(assignments),
                        resource_provenance=FrozenMap(resources),preservation_refs=why.preservation_refs,
                        rationale=FrozenMap({"usefulness_premise_refs":why.usefulness_premise_refs,
                            "morphology_premise_refs":why.morphology_premise_refs,"consumer_ref":why.consumer_ref,
                            "desired_predicate":why.desired_future,"and_dependency_refs":why.and_dependency_refs,
                            "or_dependency_refs":why.or_dependency_refs,"temporal_scope_ref":why.temporal_scope_ref,
                            "evidence_status":"supported","falsifier_ref":why.falsifier_ref,
                            "parent_goal_ref":why.parent_goal_ref,"episode_ref":why.episode_ref,
                            "level_scope_ref":why.level_scope_ref,"native_row_path":support.native_row_path})))
                group_ref=request.join_request_ref+".shape"
                if group_ref in group_refs:
                    missing.append("distinct_shape_group_identity")
                if not missing:
                    join=FamilyJoinRequest(request_ref=request.join_request_ref,parent_goal_ref=request.why.parent_goal_ref,
                        episode_ref=request.why.episode_ref,level_scope_ref=request.why.level_scope_ref,epoch=request.agenda.epoch,
                        groups=(FamilyJoinGroup(group_ref=group_ref,candidates=tuple(candidates),domain_complete=False),*request.peer_groups),
                        max_pairs=request.maximum_join_pairs,max_candidates=request.maximum_join_candidates)
    return ShapeSolvingReturnC(frozen_measurement=value.measured,returned=returned,receipt=receipt,
        next_item_ref=request.why.next_item_ref,support_reasons=value.measured.support_reasons,
        family_join_request=join,composition_missing_refs=tuple(sorted(set(missing))))

def blocked_shape_publication(value):
    return ShapeSolvingFactsC(frozen_input=value.returned.request,facts=FrozenMap({"current_shape_question":False}),
        support_reasons=(),missing_refs=value.returned.missing_refs)

def measure_shape_join(value):
    return ShapeJoinFactsC(returned=value.returned,facts=FrozenMap({"join_bound":value.returned.family_join_request is not None}))

def get_shape_join(value):
    return value.returned.family_join_request

def return_shape_join(value):
    return value.returned.model_copy(update={"family_join_result":value.joined})
