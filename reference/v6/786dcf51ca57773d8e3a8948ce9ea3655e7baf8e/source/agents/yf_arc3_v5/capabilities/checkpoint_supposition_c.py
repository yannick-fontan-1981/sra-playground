"""Requested checkpoint predicates are descriptive; no simulation or actuation lives here."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .checkpoint_supposition_contracts_c import (CadencedRailSuppositionInputC, FixedOriginSuppositionInputC,
    ChartedRoomSuppositionInputC, GravityAdhesionSuppositionInputC, TopologicalRecolorSuppositionInputC,
    CheckpointSuppositionFactsC, CheckpointSuppositionDecisionInputC, CheckpointSuppositionDecisionC)
from .goal_supposition_c import _all_goal_values
from .structural_supposition_c import _scope_current, _typed_relation
from .transport_supposition_c import _observation_current
from .production_supposition_c import _normalized_pattern


def measure_cadenced_rail_supposition(value: CadencedRailSuppositionInputC) -> CheckpointSuppositionFactsC:
    current = _scope_current(value.scope)
    targets = value.requested_bay_type_map
    population = current and bool(value.requested_bay_set_evidence_refs) and all(isinstance(targets[ref], str) for ref in sorted(targets))
    checkpoint = value.quiescent_checkpoint_reached if current and value.quiescent_checkpoint_evidence_refs else None
    rows, assignments = [], {}
    for item in value.assignments:
        required = item.bay_ref in targets
        qualified = (population and required and item.quiescent_frame_ref == value.quiescent_frame_ref
            and bool(item.request_binding_evidence_refs) and bool(item.actual_supply_evidence_refs)
            and item.declared_requested_type_ref == targets[item.bay_ref])
        match = item.supplied_type_ref == targets[item.bay_ref] if qualified and item.supplied_type_ref is not None else None
        if required:
            assignments.setdefault(item.bay_ref, []).append(match)
        rows.append(FrozenMap({"bay_ref": item.bay_ref, "in_requested_typed_bay_set": required,
            "typed_supply_matches_request": match, "quiescent_frame_ref": item.quiescent_frame_ref}))
    supply = None
    if population and value.supply_inventory_complete:
        if set(assignments) != set(targets):
            supply = False
        elif all(len(assignments[ref]) == 1 for ref in sorted(targets)):
            supply = _all_goal_values(tuple(assignments[ref][0] for ref in sorted(targets)))
    goal = _all_goal_values((supply, checkpoint))
    return CheckpointSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "requested_typed_bay_question_supported": population and bool(value.elongated_support_bay_evidence_refs)
            and bool(value.typed_positive_negative_motif_evidence_refs) and bool(value.post_movement_arm_transfer_evidence_refs),
        "requested_bays_correct_at_quiescent_checkpoint": goal,
        "generic_bays_spare_boxes_or_unrelated_trains_are_goals": False, "rail_transfer_or_terminal_law_confirmed": False}))


def measure_fixed_origin_supposition(value: FixedOriginSuppositionInputC) -> CheckpointSuppositionFactsC:
    current = _scope_current(value.scope)
    program = current and bool(value.whole_program_identity_evidence_refs)
    unedited = value.current_program_word == value.acquired_program_word if program else None
    whole_word = value.executed_program_word == value.acquired_program_word if program and value.actual_execution_evidence_refs else None
    complete = value.complete_execution if current and value.actual_execution_evidence_refs else None
    alive = value.alive_at_checkpoint if current and value.life_checkpoint_evidence_refs else None
    accepting = value.at_accepting_destination if current and value.acceptance_checkpoint_evidence_refs else None
    initial = value.initial_choice_passes_filter if current and value.initial_filter_evidence_refs else None
    return CheckpointSuppositionFactsC(measurements=(FrozenMap({"initial_choice_passes_filter": initial,
        "initial_filter_applied_to_later_program_cells": False, "program_unedited": unedited,
        "complete_acquired_word_executed": whole_word}),), facts=FrozenMap({"scope_current": current,
        "whole_fixed_program_origin_question_supported": current and bool(value.ordered_strip_evidence_refs)
            and bool(value.selectable_origin_evidence_refs) and bool(value.topology_and_distinct_launch_evidence_refs),
        "whole_unedited_program_finishes_alive_accepting": _all_goal_values((unedited, whole_word, complete, alive, accepting)),
        "fixed_program_or_terminal_law_confirmed": False}))


def measure_charted_room_supposition(value: ChartedRoomSuppositionInputC) -> CheckpointSuppositionFactsC:
    current = _scope_current(value.scope)
    rows, transitions = [], False
    for item in value.transitions:
        actual = (_observation_current(item, value.scope) and bool(item.actual_transition_evidence_refs) and bool(item.event_order_evidence_refs))
        changed = actual and item.room_before_ref != item.room_after_ref
        transitions = transitions or changed
        rows.append(FrozenMap({"example_ref": item.example_ref, "primitive_ref": item.primitive_ref,
            "actual_room_transition_observed": changed, "room_before_ref": item.room_before_ref, "room_after_ref": item.room_after_ref}))
    for item in value.annotations:
        live = (current and item.current_room_ref == value.current_room_ref and bool(item.current_object_identity_evidence_refs))
        rows.append(FrozenMap({"object_ref": item.object_ref, "annotated_room_ref": item.annotated_room_ref,
            "chart_annotation_observed": current and bool(item.chart_annotation_evidence_refs),
            "independently_currently_available": item.independently_currently_available if live else None,
            "annotation_itself_is_current_object": False}))
    room = value.current_room_ref == value.accepting_room_ref if current and value.current_room_goal_binding_evidence_refs else None
    alive = value.alive_at_checkpoint if current and value.life_checkpoint_evidence_refs else None
    permissions = value.permissions_satisfied if current and value.permission_evidence_refs else None
    order = value.event_order_checkpoint_satisfied if current and value.event_order_checkpoint_evidence_refs else None
    return CheckpointSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "charted_permission_navigation_question_supported": current and transitions
            and bool(value.partial_chart_local_view_scale_evidence_refs) and bool(value.inventory_signature_evidence_refs)
            and bool(value.locked_border_evidence_refs),
        "accepting_room_alive_with_permissions_and_event_order": _all_goal_values((room, alive, permissions, order)),
        "chart_navigation_or_terminal_law_confirmed": False}))


def measure_gravity_adhesion_supposition(value: GravityAdhesionSuppositionInputC) -> CheckpointSuppositionFactsC:
    current = _scope_current(value.scope)
    required = set(value.required_crate_refs)
    population = current and len(required) == len(value.required_crate_refs) and bool(value.required_crate_set_evidence_refs)
    settled = current and bool(value.settled_state_evidence_refs)
    rows, masks, assignments = [], [], {}
    for item in value.assignments:
        measured, scoped = _typed_relation(item.compatible_boundary_relation, value.scope)
        masks.append(measured)
        request = item.compatible_boundary_relation
        qualified = (population and settled and scoped and item.settled_frame_ref == value.settled_frame_ref
            and bool(item.physical_adhesion_evidence_refs) and request.left.owner_ref == item.crate_ref
            and request.right.owner_ref == item.boundary_ref and request.required_left_kind == "OCCUPIED_BODY"
            and request.required_right_kind == "COLLISION" and request.operator in ("INTERSECTS", "DISJOINT")
            and bool(item.boundary_relation_semantic_evidence_refs))
        adhesion = item.independently_adhered if qualified else None
        fit = measured.geometric_relation_value == item.expected_geometric_relation_value if qualified and measured.geometric_relation_value is not None else None
        if item.crate_ref in required:
            assignments.setdefault(item.crate_ref, []).append((adhesion, fit))
        rows.append(FrozenMap({"crate_ref": item.crate_ref, "boundary_ref": item.boundary_ref,
            "same_settled_frame_qualified": qualified, "physical_adhesion_value": adhesion, "boundary_relation_value": fit,
            "visual_latch_alone_confirms_adhesion": False}))
    complete = None
    if population and settled and value.adhesion_inventory_complete:
        if set(assignments) != required:
            complete = False
        elif all(len(assignments[ref]) == 1 for ref in sorted(required)):
            complete = _all_goal_values(tuple(value for ref in sorted(required) for value in assignments[ref][0]))
    accepting = value.supplied_acceptance_relation if current and value.acceptance_relation_evidence_refs else None
    return CheckpointSuppositionFactsC(mask_measurements=tuple(masks), measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "required_crate_physical_adhesion_question_supported": population and bool(value.common_input_until_rest_evidence_refs)
            and bool(value.boundary_latch_evidence_refs) and bool(value.shared_mode_acquire_release_evidence_refs),
        "all_required_crates_adhered_in_same_settled_state": complete,
        "physical_adhesion_and_supplied_acceptance_satisfied": _all_goal_values((complete, accepting)),
        "gravity_adhesion_or_terminal_law_confirmed": False}))


def measure_topological_recolor_supposition(value: TopologicalRecolorSuppositionInputC) -> CheckpointSuppositionFactsC:
    current = _scope_current(value.scope)
    declared = sum(len(domain.original_ordinals) for unit in (value.editable_field, value.derived_target) for domain in unit.sequence.domain_alternatives)
    bounded = declared > value.max_total_projected_slots
    indexed, actual, target = [], None, None
    if not bounded:
        first, actual = _normalized_pattern(value.editable_field, value.scope)
        second, target = _normalized_pattern(value.derived_target, value.scope)
        indexed.extend((first, second))
    domain = (current and actual is not None and target is not None
        and value.editable_field.comparison_basis_ref == value.derived_target.comparison_basis_ref
        and set(actual) == set(target) and bool(value.whole_editable_domain_evidence_refs)
        and bool(value.internal_background_and_pocket_evidence_refs) and bool(value.supported_target_derivation_evidence_refs))
    equal = actual == target if domain else None
    write = value.actual_write_contract_satisfied if current and value.write_contract_evidence_refs else None
    terminal = value.terminal_contract_satisfied if current and value.terminal_contract_evidence_refs else None
    return CheckpointSuppositionFactsC(indexed_measurements=tuple(indexed), measurements=(FrozenMap({"editable_field_ref": value.editable_field.unit_ref,
        "derived_target_ref": value.derived_target.unit_ref, "entire_field_with_background_and_pockets_equal": equal,
        "internal_unknown_slot_replaced_by_background": False}),), facts=FrozenMap({"scope_current": current,
        "whole_topological_field_question_supported": current and bool(value.separated_negative_space_legend_evidence_refs)
            and bool(value.palette_connected_field_change_evidence_refs),
        "whole_derived_field_actual_write_and_terminal_satisfied": _all_goal_values((equal, write, terminal)),
        "field_domain_open": bounded or any(item.remaining_domain_refs for item in indexed) or not domain,
        "recolor_target_write_or_terminal_law_confirmed": False}))


def assemble_checkpoint_supposition(value: CheckpointSuppositionDecisionInputC) -> CheckpointSuppositionDecisionC:
    return CheckpointSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
