"""Source contribution reasoning over exact K21 evidence; no paint simulation."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .family_agenda_projection import project_family_agenda, demand_signature
from .relief_solving_contracts_c import (ReliefSolvingFactsC, ReliefSolvingBindInputC,
    ReliefSolvingFinishInputC, ReliefSolvingReturnC, ReliefJoinFactsC)
from .family_agenda_projection import FamilyAgendaReceipt
from .family_result_join import FamilyJoinCandidate, FamilyJoinGroup, FamilyJoinRequest
from .ordered_relief_writing import RELIEF_OPERATION_MODES
from .mechanical_return_a import mechanical_request_identity_a

def measure_relief_solving(request, canonical_rows):
    native, why, agenda, demand = request.native_request, request.why, request.agenda, request.demand
    missing, reasons = [], []
    operation = native.operation_ref.removeprefix("mechanics.ordered_relief_writing.")
    if native.mode not in RELIEF_OPERATION_MODES.get(operation, ()):
        missing.append("registered_exact_K21_operation_mode")
    if (demand.request.request_ref != native.scope.request_ref
            or demand.request.operation_ref != native.operation_ref or demand.request.mode != native.mode
            or demand.request.caller_ref != native.scope.caller_ref
            or demand.request.parent_contribution_ref != native.scope.parent_contribution_ref
            or demand.request.epoch != native.scope.epoch or demand.request.input_revision_ref != native.scope.evidence_revision_ref
            or native.scope.parent_goal_ref != why.parent_goal_ref or demand.parent_goal_ref != why.parent_goal_ref
            or demand.consumer_ref != why.consumer_ref or demand.episode_ref != why.episode_ref
            or demand.level_scope_ref != why.level_scope_ref or demand not in agenda.demands
            or demand.request != mechanical_request_identity_a(native, "mechanics.ordered_relief_writing",
                native.scope, native.operation_ref, native.mode)):
        missing.append("exact_current_relief_parent_question")
    if (len(canonical_rows) != 1 or canonical_rows[0].get("family_agenda") != immutable_json_data(agenda)
            or not canonical_rows[0].get("supported_agenda_claim_refs")):
        missing.append("current_canonical_relief_parent_agenda")
    rows = tuple(row for row in project_family_agenda(agenda)["rows"]
        if row["signature_ref"] == demand_signature(demand)
        and row["demand"]["request"]["request_ref"] == demand.request.request_ref)
    if (len(rows) != 1 or not rows[0]["owner_current"] or not rows[0]["current_inputs_bound"]
            or not rows[0]["prerequisites_current"] or rows[0]["conflicting_current_returns"]
            or rows[0]["consumed_current_signature"]):
        missing.append("next_prerequisite_satisfied_relief_question")
    contract = request.terminal_contract
    if (native.surface is None or not contract.reference_evidence_refs
            or contract.evidence_revision_ref != native.scope.evidence_revision_ref
            or contract.reference_cells != native.reference_cells or contract.preserved_cells != native.preserved_cells
            or contract.preserved_cells and not contract.preservation_evidence_refs
            or why.desired_future.get("relief_reference_contract_digest") != stable_digest(immutable_json_data(contract))):
        missing.append("grounded_current_reference_and_incidental_preservation")
    work = sum(len(support.forward_request.candidates) + sum(len(candidate.steps)
        for candidate in support.forward_request.candidates) + sum(len(write.full_positions)
        for write in support.forward_request.writes) for support in request.contribution_supports)
    if work > native.maximum_evaluations:
        return ReliefSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_relief_question": False}),
            contribution_reasons=(), missing_refs=tuple(sorted(set((*missing, "relief_reason_preparation_bound")))))
    for support in request.contribution_supports:
        forward, result = support.forward_request, support.forward_result
        if (forward.operation_ref != "mechanics.ordered_relief_writing.forward_certificate" or forward.mode != "COMPARE"
                or forward.surface != native.surface or forward.reference_cells != native.reference_cells
                or forward.preserved_cells != native.preserved_cells
                or forward.writes != native.writes or forward.pose != native.pose
                or forward.clipping_policy != native.clipping_policy
                or forward.source_identity_ref != native.source_identity_ref
                or forward.scope.parent_goal_ref != native.scope.parent_goal_ref
                or forward.scope.caller_ref != native.scope.caller_ref
                or forward.scope.parent_contribution_ref != native.scope.parent_contribution_ref
                or forward.scope.epoch != native.scope.epoch
                or forward.scope.evidence_revision_ref != native.scope.evidence_revision_ref
                or forward.scope.model_revision_ref != native.scope.model_revision_ref
                or forward.scope.model_status_ref != native.scope.model_status_ref
                or forward.scope.event_owner_ref != native.scope.event_owner_ref
                or result.scope != forward.scope or result.operation_ref != forward.operation_ref or result.mode != forward.mode
                or not result.domain_complete or result.prerequisite_refs or result.computation_bound_reached
                or not support.contribution_evidence_refs):
            missing.append("exact_complete_K21_forward_certificate_from_actual_canvas")
            continue
        candidates = tuple(candidate for candidate in forward.candidates if candidate.candidate_ref == support.candidate_ref)
        certificates = tuple(row for row in result.values.get("forward_certificates", ())
            if isinstance(row, FrozenMap) and row.get("candidate_ref") == support.candidate_ref
            and row.get("fully_executed") is True and row.get("final_compatible") is True)
        if len(candidates) != 1 or len(certificates) != 1:
            missing.append("one_complete_resource_and_reference_compatible_candidate")
            continue
        candidate, certificate = candidates[0], certificates[0]
        events = certificate.get("events")
        total_cost = certificate.get("total_cost")
        if (not isinstance(events, tuple) or len(events) != len(candidate.steps)
                or not isinstance(total_cost, int) or isinstance(total_cost, bool) or total_cost < 0
                or any(not isinstance(event, FrozenMap) or event.get("step_index") != index
                    or event.get("kind") != candidate.steps[index].kind for index, event in enumerate(events))):
            missing.append("complete_ordered_native_primitive_event_ledger")
            continue
        if (request.minimum_complete_cost_allowance is None or not request.resource_evidence_refs
                or total_cost > request.minimum_complete_cost_allowance):
            missing.append("current_resource_allowance_covers_complete_SELECT_MOVE_WRITE_plan")
            continue
        writes = {write.write_ref: write for write in forward.writes}
        reference = dict(forward.reference_cells)
        applications = []
        substrate = forward.surface
        erased_by_reset = []
        valid = True
        for event in events:
            if event["kind"] == "RESET":
                if forward.reset_surface is None or not forward.reset_evidence_refs:
                    missing.append("measured_reset_substrate_and_scope")
                    valid = False
                    break
                erased_by_reset.extend(index for index, _, _ in applications)
                applications = []
                substrate = forward.reset_surface
            if event["kind"] != "WRITE":
                continue
            step_index = event["step_index"]
            step = candidate.steps[step_index]
            write = writes.get(step.write_ref)
            write_event = event.get("event")
            if not isinstance(write_event, FrozenMap):
                missing.append("typed_native_application_event")
                valid = False
                break
            if write_event.get("write_rejected") is True:
                continue
            positions = write_event.get("applied_positions")
            if write is None or positions is None or write_event.get("full_positions") != write.full_positions:
                missing.append("actual_full_mask_including_transparent_holes")
                valid = False
                break
            applications.append((step_index, write, tuple(positions)))
        if not valid:
            continue
        upper = set()
        derived = []
        for step_index, write, positions in reversed(applications):
            full = set(positions)
            surviving = full - upper
            covered = full & upper
            key = str(step_index)
            supplied_surviving = support.surviving_by_step_ref.get(key)
            supplied_cover = support.future_cover_by_step_ref.get(key)
            if (supplied_surviving is None or set(supplied_surviving) != surviving
                    or supplied_cover is None or set(supplied_cover) != covered):
                missing.append("exact_surviving_contribution_and_later_cover_by_primitive")
                valid = False
                break
            if any(cell in reference and reference[cell] != write.value for cell in surviving):
                missing.append("last_exposed_layer_value_matches_reference")
                valid = False
                break
            if write.required_size is not None and any(other.required_size is not None
                    and other.required_size > write.required_size for other in forward.writes):
                if not support.smaller_control_evidence_refs and not support.changed_footprint_evidence_refs:
                    missing.append("grounded_smaller_applicator_control_or_measured_footprint")
                    valid = False
                    break
            derived.append(FrozenMap({"step_index": step_index, "write_ref": write.write_ref,
                "complete_application_positions": positions, "surviving_visible_positions": tuple(sorted(surviving)),
                "later_covered_positions": tuple(sorted(covered)), "value": write.value,
                "holes_not_filled_by_bbox": True, "temporary_mismatch_justified_by_later_cover": bool(covered)}))
            upper.update(full)
        if not valid:
            continue
        uncovered = tuple(cell for cell in sorted(reference) if cell not in upper)
        if substrate is None or any(not 0 <= r < len(substrate.rows)
                or not 0 <= c < len(substrate.rows[0])
                or substrate.rows[r][c] != reference[(r,c)] for r,c in uncovered):
            missing.append("uncovered_correct_residue_remains_actual_substrate")
            continue
        reasons.append(FrozenMap({"candidate_ref": support.candidate_ref, "backward_visible_contributions": tuple(derived),
            "uncovered_substrate_cells": uncovered, "complete_forward_certificate": certificate,
            "measured_substrate": immutable_json_data(substrate), "applications_erased_by_reset": tuple(erased_by_reset),
            "current_canvas_used_for_repair": True, "each_stroke_need_not_reduce_current_mismatch": True,
            "palette_pose_write_order_native_verified": True, "pose_graph_not_free_planar_navigation": True,
            "remaining_cost_allowance": request.minimum_complete_cost_allowance-certificate["total_cost"],
            "global_minimum_or_global_necessity_not_claimed": True}))
    return ReliefSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_relief_question": not bool(missing)}),
        contribution_reasons=tuple(reasons), missing_refs=tuple(sorted(set(missing))))

def bind_relief_solving_native(value: ReliefSolvingBindInputC):
    return value.measured.frozen_input.native_request

def finish_relief_solving(value: ReliefSolvingFinishInputC) -> ReliefSolvingReturnC:
    request = value.measured.frozen_input
    returned = value.returned
    receipt = FrozenMap()
    if returned is not None and returned.request == request.demand.request and not value.measured.missing_refs:
        receipt = immutable_json_data(FamilyAgendaReceipt(
            receipt_ref="receipt.relief_solving." + stable_digest((request.demand, returned)),
            demand=request.demand, result=returned))
    join = None
    if receipt and returned.status == "FOUND" and request.peer_groups and request.join_request_ref:
        peer_rows = tuple(candidate for group in request.peer_groups for candidate in group.candidates)
        current = all(candidate.result.request.epoch == request.agenda.epoch
            and candidate.rationale.get("parent_goal_ref") == request.why.parent_goal_ref
            and candidate.rationale.get("episode_ref") == request.why.episode_ref
            and candidate.rationale.get("level_scope_ref") == request.why.level_scope_ref
            and all(ref not in request.agenda.invalidated_dependency_refs
                and request.agenda.current_dependency_revisions.get(ref) == candidate.dependency_revisions[ref]
                for ref in sorted(candidate.dependency_revisions)) for candidate in peer_rows)
        candidates = []
        for reason in value.measured.contribution_reasons:
            surface = reason["complete_forward_certificate"]["after_surface"]
            assignments = FrozenMap({"canvas:"+str(r)+","+str(c): surface["rows"][r][c]
                for (r,c), _ in request.native_request.reference_cells})
            if len(assignments) > 256 or len(candidates) >= 128 or len(candidates)+len(peer_rows) >= 256:
                current = False
                break
            why = request.why
            candidates.append(FamilyJoinCandidate(candidate_ref=request.join_request_ref+"."+reason["candidate_ref"],
                result=returned, assignments=assignments, resource_provenance=FrozenMap(),
                dependency_revisions=request.agenda.current_dependency_revisions, preservation_refs=why.preservation_refs,
                rationale=FrozenMap({"usefulness_premise_refs":why.usefulness_premise_refs,
                    "morphology_premise_refs":why.morphology_premise_refs,"consumer_ref":why.consumer_ref,
                    "desired_predicate":why.desired_future,"and_dependency_refs":why.and_dependency_refs,
                    "or_dependency_refs":why.or_dependency_refs,"temporal_scope_ref":why.temporal_scope_ref,
                    "evidence_status":"supported","falsifier_ref":why.falsifier_ref,
                    "parent_goal_ref":why.parent_goal_ref,"episode_ref":why.episode_ref,
                    "level_scope_ref":why.level_scope_ref,"forward_candidate_ref":reason["candidate_ref"]})))
        group_ref=request.join_request_ref+".relief"
        if current and candidates and group_ref not in tuple(group.group_ref for group in request.peer_groups):
            refs=tuple(candidate.candidate_ref for candidate in peer_rows)
            if (len(set(refs)) == len(refs) and len({candidate.candidate_ref for candidate in candidates}) == len(candidates)
                    and not any(candidate.candidate_ref in refs for candidate in candidates)):
                join=FamilyJoinRequest(request_ref=request.join_request_ref,parent_goal_ref=request.why.parent_goal_ref,
                    episode_ref=request.why.episode_ref,level_scope_ref=request.why.level_scope_ref,epoch=request.agenda.epoch,
                    groups=(FamilyJoinGroup(group_ref=group_ref,candidates=tuple(candidates),domain_complete=False),*request.peer_groups),
                    max_pairs=request.maximum_join_pairs,max_candidates=request.maximum_join_candidates)
    return ReliefSolvingReturnC(frozen_measurement=value.measured, returned=returned,
        receipt=receipt, next_item_ref=request.why.next_item_ref, family_join_request=join)

def measure_relief_join(value):
    return ReliefJoinFactsC(returned=value.returned,
        facts=FrozenMap({"join_bound":value.returned.family_join_request is not None}))

def get_relief_join(value):
    return value.returned.family_join_request

def return_relief_join(value):
    return value.returned.model_copy(update={"family_join_result":value.joined})
