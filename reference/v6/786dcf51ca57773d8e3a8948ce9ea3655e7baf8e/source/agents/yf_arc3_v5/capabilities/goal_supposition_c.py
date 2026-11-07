"""Whole scoped goal conditions do not become confirmed terminal laws or ACTs."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .goal_supposition_contracts_c import (CyclicCoverageSuppositionInputC, MetricImageSuppositionInputC,
    OrientedPassageSuppositionInputC, ReactiveCaptureSuppositionInputC, StationCargoSuppositionInputC,
    GoalSuppositionFactsC, GoalSuppositionDecisionInputC, GoalSuppositionDecisionC)
from .structural_supposition_c import _scope_current, _typed_relation
from .transport_supposition_c import _observation_current


def _all_goal_values(values):
    if any(value is False for value in values):
        return False
    if any(value is None for value in values):
        return None
    return True


def measure_cyclic_coverage_supposition(value: CyclicCoverageSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    required = set(value.required_tuples)
    catalogue = (current and value.complete_required_catalogue and bool(value.required_catalogue_evidence_refs)
        and len(required) == len(value.required_tuples))
    rows, visits = [], set()
    for item in value.visits:
        actual = (_observation_current(item, value.scope) and item.observed_epoch <= value.scope.epoch
            and item.episode_ref == value.scope.episode_ref and bool(item.current_revalidation_evidence_refs)
            and item.reset_scope_ref == value.reset_scope_ref
            and bool(item.actual_visit_evidence_refs))
        if actual:
            visits.add(item.tuple_values)
        rows.append(FrozenMap({"example_ref": item.example_ref, "tuple_values": item.tuple_values,
            "observed_epoch": item.observed_epoch,
            "actual_visit_qualified": actual, "reset_scope_ref": item.reset_scope_ref}))
    complete_history = value.complete_visit_history and all(row["actual_visit_qualified"] for row in rows)
    coverage = (True if required <= visits else False if complete_history else None) if catalogue else None
    final_required = value.separately_required_final_tuple is not None and bool(value.final_tuple_requirement_evidence_refs)
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "finite_catalogue_coverage_question_supported": catalogue and bool(value.independent_value_control_evidence_refs)
            and bool(value.local_sample_cycle_evidence_refs) and bool(value.current_and_visited_border_evidence_refs),
        "all_required_tuples_actually_visited": coverage,
        "final_tuple_is_separately_constrained": final_required,
        "separate_final_tuple_satisfied": value.current_tuple == value.separately_required_final_tuple if current and final_required else None,
        "coverage_imposes_an_unproved_final_tuple": False, "cycle_or_terminal_law_confirmed": False}))


def measure_metric_image_supposition(value: MetricImageSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    raster, raster_current = _typed_relation(value.raster_equal, value.scope)
    holes, holes_current = _typed_relation(value.empty_regions_equal, value.scope)
    first, second = value.raster_equal, value.empty_regions_equal
    same = all(getattr(first, name) == getattr(second, name) for name in
        ("scene_ref", "native_frame_ref", "coordinate_basis_ref", "current_model_assignment_ref", "coordinate_basis_kind"))
    owners = (first.left.owner_ref == second.left.owner_ref == value.current_top_projection_ref
        and first.right.owner_ref == second.right.owner_ref == value.reference_ref)
    qualified = (current and raster_current and holes_current and same and owners
        and first.operator == second.operator == "EQUAL"
        and first.required_left_kind == first.required_right_kind == "RECOGNITION"
        and second.required_left_kind == second.required_right_kind == "BACKGROUND_HOLE"
        and bool(value.licensed_transform_evidence_refs) and bool(value.transform_binding_evidence_refs))
    match = raster.geometric_relation_value and holes.geometric_relation_value if qualified and raster.geometric_relation_value is not None and holes.geometric_relation_value is not None else None
    return GoalSuppositionFactsC(mask_measurements=(raster, holes), measurements=(FrozenMap({
        "common_scale_ref": value.common_scale_ref, "common_placement_ref": value.common_placement_ref,
        "single_transform_scope_qualified": qualified,
        "whole_visible_raster_and_internal_empty_regions_match": match,
        "independent_pose_per_piece_allowed": False}),), facts=FrozenMap({"scope_current": current,
        "top_layer_reference_question_supported": current and bool(value.irregular_support_grid_evidence_refs)
            and bool(value.support_dependent_extent_evidence_refs) and bool(value.top_layer_visibility_evidence_refs),
        "occupied_body_not_interchanged_with_visible_top_layer": True, "metric_stack_or_terminal_law_confirmed": False}))


def measure_oriented_passage_supposition(value: OrientedPassageSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    rows = []
    for item in value.examples:
        observed = (_observation_current(item, value.scope) and item.body_ref == value.controlled_body_ref
            and bool(item.actual_transfer_evidence_refs) and bool(item.independent_layer_indicator_evidence_refs))
        rows.append(FrozenMap({"example_ref": item.example_ref, "body_ref": item.body_ref,
            "layer_change_at_actual_transfer_observed": observed and item.layer_before_ref != item.layer_after_ref,
            "cell_before": item.cell_before, "cell_after": item.cell_after,
            "layer_before_ref": item.layer_before_ref, "layer_after_ref": item.layer_after_ref}))
    pose = current and bool(value.current_pose_layer_evidence_refs) and bool(value.terminal_goal_binding_evidence_refs)
    terminal = value.terminal_checkpoint_reached if current and value.terminal_checkpoint_evidence_refs else None
    resource = value.resource_checkpoint_satisfied if current and value.resource_checkpoint_evidence_refs else None
    goal = _all_goal_values((value.current_body_cell == value.accepting_cell,
        value.current_layer_ref == value.required_layer_ref, terminal, resource)) if pose else None
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "layered_passage_question_supported": current and bool(value.disconnected_walkable_region_evidence_refs)
            and bool(value.oriented_passage_glyph_evidence_refs) and any(row["layer_change_at_actual_transfer_observed"] for row in rows),
        "accepting_cell_correct_layer_and_checkpoints_satisfied": goal,
        "cell_match_alone_is_acceptance": False, "passage_or_terminal_law_confirmed": False}))


def measure_reactive_capture_supposition(value: ReactiveCaptureSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    required = set(value.required_target_identity_refs)
    population = current and len(required) == len(value.required_target_identity_refs) and bool(value.required_identity_set_evidence_refs)
    rows, latest = [], {}
    for item in value.examples:
        scoped = (_observation_current(item, value.scope) and item.observed_epoch <= value.scope.epoch
            and item.episode_ref == value.scope.episode_ref and bool(item.current_revalidation_evidence_refs)
            and item.capture_scope_ref == value.capture_scope_ref
            and bool(item.actual_contact_evidence_refs)
            and bool(item.contact_reactive_update_scope_evidence_refs))
        independent = scoped and bool(item.capture_identity_evidence_refs)
        if independent and item.independently_captured is not None:
            record = latest.get(item.target_identity_ref)
            if record is None or item.chronological_ordinal > record[0]:
                latest[item.target_identity_ref] = (item.chronological_ordinal, {item.independently_captured})
            elif item.chronological_ordinal == record[0]:
                record[1].add(item.independently_captured)
        rows.append(FrozenMap({"example_ref": item.example_ref, "target_identity_ref": item.target_identity_ref,
            "chronological_ordinal": item.chronological_ordinal, "capture_scope_ref": item.capture_scope_ref,
            "observed_epoch": item.observed_epoch,
            "independently_captured": item.independently_captured if independent else None,
            "disappearance_observed": item.disappearance_observed if scoped and item.rendering_change_evidence_refs else None,
            "exchange_observed": item.exchange_observed if scoped and item.rendering_change_evidence_refs else None,
            "disappearance_alone_means_capture": False}))
    conflict = any(len(latest[ref][1]) > 1 for ref in sorted(latest) if ref in required)
    captured = {ref for ref in sorted(latest) if latest[ref][1] == {True}}
    rejected = {ref for ref in sorted(latest) if latest[ref][1] == {False}}
    complete = value.capture_history_inventory_complete and all(
        row["independently_captured"] is not None for row in rows)
    goal = (True if required <= captured else False if required & rejected or complete else None) if population and not conflict else None
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "all_required_identity_capture_question_supported": population
            and bool(value.controlled_mover_reactive_peer_evidence_refs) and bool(value.movable_barrier_evidence_refs),
        "all_required_identities_actually_captured": goal, "capture_identity_conflict_present": conflict,
        "rendering_disappearance_and_captured_identity_separate": True, "contact_reactive_or_terminal_law_confirmed": False}))


def measure_station_cargo_supposition(value: StationCargoSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    required = set(value.required_cargo_refs)
    population = current and len(required) == len(value.required_cargo_refs) and bool(value.required_cargo_set_evidence_refs)
    frames = current and bool(value.settled_frame_evidence_refs)
    rows, masks, assignments = [], [], {}
    for item in value.assignments:
        measured, scoped = _typed_relation(item.whole_body_inside_receiver, value.scope)
        masks.append(measured)
        request = item.whole_body_inside_receiver
        qualified = (population and frames and scoped and item.settled_frame_ref == value.settled_frame_ref
            and bool(item.current_delivery_identity_evidence_refs) and request.left.owner_ref == item.cargo_ref
            and request.right.owner_ref == item.receiver_ref and request.required_left_kind == "OCCUPIED_BODY"
            and request.required_right_kind == "RECEIVING_APERTURE" and request.operator == "SUBSET")
        delivered = item.delivered_now if qualified else None
        fit = measured.geometric_relation_value if qualified else None
        if item.cargo_ref in required:
            assignments.setdefault(item.cargo_ref, []).append((delivered, fit, qualified))
        rows.append(FrozenMap({"cargo_ref": item.cargo_ref, "receiver_ref": item.receiver_ref,
            "same_settled_frame_qualified": qualified, "delivered_now": delivered, "whole_body_inside_receiver": fit}))
    delivery = None
    if population and frames and value.delivery_inventory_complete:
        if set(assignments) != required:
            delivery = False
        elif all(len(assignments[ref]) == 1 and assignments[ref][0][2] and assignments[ref][0][0] is not None
                and assignments[ref][0][1] is not None for ref in sorted(required)):
            delivery = all(assignments[ref][0][0] is True and assignments[ref][0][1] is True for ref in sorted(required))
    released = value.carrier_released if current and frames and value.carrier_release_evidence_refs else None
    goal = _all_goal_values((delivery, released))
    return GoalSuppositionFactsC(mask_measurements=tuple(masks), measurements=tuple(rows), facts=FrozenMap({
        "scope_current": current, "all_required_cargo_and_carrier_release_question_supported": population
            and bool(value.multicell_cargo_evidence_refs) and bool(value.carrier_evidence_refs)
            and bool(value.compatible_receiving_support_evidence_refs) and bool(value.station_orientation_control_evidence_refs),
        "all_required_cargo_inside_receivers": delivery, "carrier_released": released,
        "required_cargo_delivered_and_carrier_released": goal, "all_receiver_cells_must_be_filled": False,
        "station_cargo_or_terminal_law_confirmed": False}))


def assemble_goal_supposition(value: GoalSuppositionDecisionInputC) -> GoalSuppositionDecisionC:
    return GoalSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
