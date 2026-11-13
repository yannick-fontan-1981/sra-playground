"""Exact Source qualifications over K25; no inverse, clearance or write engine."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .mechanical_return_a import mechanical_request_identity_a
from .family_agenda_projection import project_family_agenda, demand_signature, FamilyAgendaReceipt
from .inverse_anchor_signature import ANCHOR_OPERATION_MODES
from .anchor_solving_contracts_c import AnchorSolvingFactsC, AnchorSolvingReturnC, AnchorJoinFactsC

def measure_anchor_solving(request, canonical_rows, binding_rows):
    native, why, agenda, demand = request.native_request, request.why, request.agenda, request.demand
    missing, reasons = [], []
    identity = mechanical_request_identity_a(native,"mechanics.inverse_anchor_signature",native.scope,
        native.operation_ref,native.mode)
    if (demand.request != identity or demand not in agenda.demands or native.scope.parent_goal_ref != why.parent_goal_ref
            or demand.parent_goal_ref != why.parent_goal_ref or demand.consumer_ref != why.consumer_ref
            or demand.episode_ref != why.episode_ref or demand.level_scope_ref != why.level_scope_ref
            or not why.usefulness_premise_refs or not why.morphology_premise_refs):
        missing.append("exact_current_anchor_parent_why_and_question")
    if (len(canonical_rows) != 1 or canonical_rows[0].get("family_agenda") != immutable_json_data(agenda)
            or not canonical_rows[0].get("supported_agenda_claim_refs")):
        missing.append("current_canonical_anchor_parent_agenda")
    rows = tuple(row for row in project_family_agenda(agenda)["rows"]
        if row["signature_ref"] == demand_signature(demand)
        and row["demand"]["request"]["request_ref"] == demand.request.request_ref)
    if (len(rows) != 1 or not rows[0]["owner_current"] or not rows[0]["current_inputs_bound"]
            or not rows[0]["prerequisites_current"] or rows[0]["conflicting_current_returns"]
            or rows[0]["consumed_current_signature"]):
        missing.append("next_prerequisite_satisfied_unconsumed_anchor_question")
    operation = native.operation_ref.removeprefix("mechanics.inverse_anchor_signature.")
    if native.mode not in ANCHOR_OPERATION_MODES.get(operation,()):
        missing.append("registered_exact_K25_operation_mode")
    fields = native.model_fields_set - {"schema_version","scope","operation_ref","mode","source_identity_ref",
        "maximum_evaluations","maximum_states","resume"}
    bound_fields = {binding.native_field_ref for binding in request.canonical_bindings}
    if (fields != bound_fields or len(bound_fields) != len(request.canonical_bindings)
            or len(binding_rows) != len(request.canonical_bindings)):
        missing.append("complete_current_canonical_anchor_native_binding_closure")
    for binding in request.canonical_bindings:
        if (binding.native_field_ref not in fields
                or binding.value != FrozenMap({"value":immutable_json_data(getattr(native,binding.native_field_ref,None))})
                or binding.epoch != native.scope.epoch or binding.evidence_revision_ref != native.scope.evidence_revision_ref
                or binding.model_revision_ref != native.scope.model_revision_ref):
            missing.append("exact_current_anchor_binding_payload_and_revisions")
    contract = request.goal_contract
    if (not contract.quantifier_evidence_refs or not contract.resource_evidence_refs
            or contract.evidence_revision_ref != native.scope.evidence_revision_ref
            or why.desired_future.get("anchor_goal_contract_digest") != stable_digest(immutable_json_data(contract))
            or len({target.target_ref for target in contract.targets}) != len(contract.targets)
            or len({target.system_ref for target in contract.targets}) != len(contract.targets)
            or any(not target.grouping_evidence_refs or not target.layout_evidence_refs
                or len({cell for cell,_ in target.spatial_signature}) != len(target.spatial_signature)
                for target in contract.targets)):
        missing.append("grounded_common_center_spatial_target_relation_and_all_system_contract")
    for target in contract.targets:
        pixels = tuple(pixel for stroke in target.observed_strokes for pixel in stroke)
        if not pixels or len({point for point,_ in pixels}) != len(pixels):
            missing.append("nonempty_disconnected_target_strokes_with_unique_spatial_pixels")
            continue
        center = target.common_center
        if (tuple(sorted(((r-center[0],c-center[1]),colour) for (r,c),colour in pixels))
                    != tuple(sorted(target.spatial_signature))):
            missing.append("actual_target_strokes_share_measured_center_and_exact_spatial_colour_layout")
    law = request.law_scope
    target_signatures = tuple(target.spatial_signature for target in contract.targets)
    if any(candidate.target_signature not in target_signatures for candidate in native.construction_candidates):
        missing.append("construction_target_uses_exact_spatial_layout_not_palette_set")
    if native.mean_domain is not None:
        if (law is None or law.status == "MISSING" or law.relation_kind != "MEAN" or not law.evidence_refs
                or law.anchor_count != native.mean_domain.anchor_count or law.quantizer != native.mean_domain.quantizer
                or law.model_revision_ref != native.scope.model_revision_ref
                or not native.mean_evidence_refs or not set(law.evidence_refs) <= set(native.mean_evidence_refs)):
            missing.append("mean_law_grounded_for_current_anchor_count_and_quantizer")
    if native.dependence is not None:
        if (law is None or law.status == "MISSING" or not law.evidence_refs or not native.dependence_evidence_refs
                or law.anchor_count != len(native.dependence.anchor_positions) or law.quantizer != native.dependence.quantizer
                or law.model_revision_ref != native.scope.model_revision_ref
                or not set(law.evidence_refs) <= set(native.dependence_evidence_refs)):
            missing.append("scoped_measured_dependence_not_two_anchor_extrapolation")
        elif law.relation_kind == "MEAN" and (any(numerator*law.anchor_count != denominator
                for numerator,denominator in zip(native.dependence.coefficient_numerators,native.dependence.coefficient_denominators))
                or native.dependence.bias_numerators != (0,0)):
            missing.append("declared_mean_matches_actual_rational_coefficients_and_bias")
    if native.successor is not None:
        binding, packet = request.action_binding, native.successor
        if (binding is None or binding.operator_kind != packet.operator_kind
                or binding.requested_anchor_ref != packet.requested_anchor_ref
                or binding.affected_system_ref != packet.affected_system_ref or binding.destination != packet.destination
                or not binding.evidence_refs or not binding.payload
                or binding.epoch != native.scope.epoch or binding.evidence_revision_ref != native.scope.evidence_revision_ref):
            missing.append("actual_select_or_place_operator_and_grounded_destination_payload")
        if packet.operator_kind == "place_active_anchor":
            if native.clearance is None or not native.anchor_mask_offsets or not native.beacon_mask_offsets:
                missing.append("both_complete_anchor_and_dependent_footprints_and_transition_clearance")
            actual = tuple(system for system in packet.systems if system.system_ref == packet.affected_system_ref)
            if len(actual) != 1 or actual[0].active_anchor_ref != packet.requested_anchor_ref:
                missing.append("place_requires_current_active_anchor_not_implicit_selection")
        if not set(contract.preserved_system_refs) <= {system.system_ref for system in packet.systems}:
            missing.append("preserved_systems_present_in_full_successor_scope")
    for support in request.preparation_supports:
        old, before = support.exhausted_inverse_request, support.exhausted_inverse_result
        prep, prepared = support.preparation_request, support.preparation_result
        new, after = support.newly_available_request, support.newly_available_result
        receipts = ((old,before),(prep,prepared),(new,after))
        current = all(result.scope == query.scope and result.operation_ref == query.operation_ref
            and result.mode == query.mode and result.domain_complete and not result.prerequisite_refs
            and not result.computation_bound_reached and query.source_identity_ref == native.source_identity_ref
            and query.scope.parent_goal_ref == native.scope.parent_goal_ref and query.scope.epoch == native.scope.epoch
            and query.scope.evidence_revision_ref == native.scope.evidence_revision_ref
            and query.scope.model_revision_ref == native.scope.model_revision_ref for query,result in receipts)
        if (not current or not support.prerequisite_evidence_refs
                or old.operation_ref != "mechanics.inverse_anchor_signature.inverse_domains"
                or new.operation_ref != old.operation_ref or old.mean_domain is None or new.mean_domain is None
                or before.values.get("compatible_anchor_positions") != ()
                or not after.values.get("compatible_anchor_positions")
                or prep.operation_ref != "mechanics.inverse_anchor_signature.successor" or prep.successor is None
                or prep.successor.affected_system_ref != support.consumer_system_ref
                or old.mean_domain.desired_quantized_position != new.mean_domain.desired_quantized_position):
            missing.append("causal_preparation_opens_previously_empty_current_inverse_domain")
            continue
        previous = tuple(system for system in prep.successor.systems if system.system_ref == support.consumer_system_ref)
        variable = support.inverse_variable_anchor_ref
        if (len(previous) != 1 or variable not in tuple(ref for ref,_ in previous[0].anchor_positions)
                or tuple(pos for ref,pos in previous[0].anchor_positions if ref != variable) != old.mean_domain.fixed_anchor_positions
                or old.mean_domain.anchor_count != len(previous[0].anchor_positions)
                or new.mean_domain.anchor_count != old.mean_domain.anchor_count
                or new.mean_domain.quantizer != old.mean_domain.quantizer):
            missing.append("old_and_new_inverse_domains_bind_same_variable_anchor_and_law")
            continue
        systems = prepared.values.get("resulting_systems")
        if not isinstance(systems,tuple):
            missing.append("actual_prepared_anchor_configuration")
            continue
        system = tuple(row for row in systems if isinstance(row,FrozenMap) and row.get("system_ref") == support.consumer_system_ref)
        positions = system[0].get("anchor_positions") if len(system) == 1 else None
        if (not isinstance(positions,tuple) or any(not isinstance(row,tuple) or len(row) != 2 for row in positions)
                or tuple(pos for ref,pos in positions if ref != variable)
                    != new.mean_domain.fixed_anchor_positions):
            missing.append("new_inverse_domain_bound_to_preparation_successor_configuration")
            continue
        reasons.append(FrozenMap({"consumer_system_ref":support.consumer_system_ref,"waypoint_ref":support.waypoint_ref,
            "empty_inverse_receipt":immutable_json_data(before),"preparation_receipt":immutable_json_data(prepared),
            "opened_inverse_receipt":immutable_json_data(after),"prerequisite_evidence_refs":support.prerequisite_evidence_refs}))
    return AnchorSolvingFactsC(frozen_input=request,facts=FrozenMap({"current_anchor_question":not bool(missing)}),
        preparation_reasons=tuple(reasons),missing_refs=tuple(sorted(set(missing))))

def bind_anchor_solving(value):
    return value.measured.frozen_input.native_request

def finish_anchor_solving(value):
    request, returned = value.measured.frozen_input, value.returned
    receipt, reasons = FrozenMap(),FrozenMap()
    if returned is not None and returned.request == request.demand.request and not value.measured.missing_refs:
        receipt = immutable_json_data(FamilyAgendaReceipt(receipt_ref="receipt.anchor_solving."+stable_digest((request.demand,returned)),
            demand=request.demand,result=returned))
        reasons = FrozenMap({"goal_contract":immutable_json_data(request.goal_contract),"why":immutable_json_data(request.why),
            "preparation_reasons":value.measured.preparation_reasons,"native_values":returned.descriptive_values,
            "action_binding":immutable_json_data(request.action_binding)})
    return AnchorSolvingReturnC(frozen_measurement=value.measured,returned=returned,receipt=receipt,
        next_item_ref=request.why.next_item_ref,result_reasons=reasons)

def measure_anchor_join(value):
    return AnchorJoinFactsC(returned=value.returned,facts=FrozenMap({"join_bound":value.returned.family_join_request is not None}))

def get_anchor_join(value):
    return value.returned.family_join_request

def return_anchor_join(value):
    return value.returned.model_copy(update={"family_join_result":value.joined})

def blocked_anchor_publication(value):
    return AnchorSolvingFactsC(frozen_input=value.returned.request,facts=FrozenMap({"current_anchor_question":False}),
        preparation_reasons=(),missing_refs=value.returned.missing_refs)
