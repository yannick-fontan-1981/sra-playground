"""Exact descriptors retain separate permissions, flow roles and simultaneous occupancy."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .capacity_supposition_contracts_c import (ActorProgramSuppositionInputC, VisibilityCapacitySuppositionInputC,
    FiniteFlowSuppositionInputC, WrapSlideSuppositionInputC, CapacitySuppositionFactsC,
    CapacitySuppositionDecisionInputC, CapacitySuppositionDecisionC)
from .structural_supposition_c import _scope_current, _typed_relation, measure_visible_graph
from .transport_supposition_c import _observation_current
from .production_supposition_c import _native_binding_current, _graph_pairs
from .region_frontier_c import measure_region_frontier
from .finite_flow_network import measure_finite_flow_network


def measure_actor_program_supposition(value: ActorProgramSuppositionInputC) -> CapacitySuppositionFactsC:
    current = _scope_current(value.scope)
    rows, moving, shrinking = [], False, False
    for item in value.examples:
        scoped = (_observation_current(item, value.scope) and item.stack_ref == value.stack_ref and item.actor_ref == value.actor_ref)
        before, after = item.ordered_item_refs_before, item.ordered_item_refs_after
        before_refs, after_refs = set(before), set(after)
        whole = (scoped and item.whole_stack_inventory_complete and bool(item.ordered_stack_identity_evidence_refs)
            and len(before_refs) == len(before) and len(after_refs) == len(after))
        removed = tuple(ref for ref in before if ref not in after_refs) if whole else ()
        gained = tuple(ref for ref in after if ref not in before_refs) if whole else ()
        shrink = whole and len(after) < len(before)
        move = scoped and bool(item.actual_actor_pose_evidence_refs) and item.actor_delta is not None and item.actor_delta != (0, 0)
        moving = moving or move
        shrinking = shrinking or shrink
        rows.append(FrozenMap({"example_ref": item.example_ref, "stack_ref": item.stack_ref, "actor_ref": item.actor_ref,
            "ordered_items_before": before, "ordered_items_after": after,
            "removed_item_refs": removed, "added_item_refs": gained,
            "capacity_count_before": len(before) if whole else None, "capacity_count_after": len(after) if whole else None,
            "actual_stack_shrink_observed": shrink, "actor_motion_observed": move,
            "editable_content_changed": item.editable_content_changed if scoped and item.actual_edit_evidence_refs else None,
            "workbench_ref": item.workbench_ref,
            "edit_permission": item.edit_permission if scoped and item.edit_permission_evidence_refs else None,
            "movement_permission": item.movement_permission if scoped and item.movement_permission_evidence_refs else None,
            "edit_permission_substitutes_movement_permission": False}))
    return CapacitySuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "program_and_destructible_capacity_question_supported": current and moving and shrinking
            and bool(value.ordered_editable_stack_evidence_refs) and bool(value.separate_activation_evidence_refs)
            and bool(value.stack_actor_binding_evidence_refs),
        "program_edit_execution_and_capacity_separate": True, "program_or_workbench_gate_law_confirmed": False}))


def measure_visibility_capacity_supposition(value: VisibilityCapacitySuppositionInputC) -> CapacitySuppositionFactsC:
    current = _scope_current(value.scope)
    region = measure_region_frontier(value.region)
    request = value.region
    scoped = (current and request.parent_goal_ref == value.scope.parent_goal_ref and request.useful_question_ref == value.question_ref
        and request.current_epoch == value.scope.epoch and request.current_evidence_revision_ref == value.scope.revision_ref
        and region.facts["current_observation_fenced"] and region.facts["current_binding_evidenced"]
        and region.facts["current_cell_identity_unique"])
    cells = {item.cell_ref for item in request.current.cells}
    unique = len({item.cell_ref for item in value.permissions}) == len(value.permissions)
    rows = tuple(FrozenMap({"cell_ref": item.cell_ref, "currently_visible": scoped and item.cell_ref in region.admissible_current_cell_refs,
        "traversable": item.traversable if scoped and unique and item.cell_ref in cells and item.traversal_evidence_refs else None,
        "mechanism_ref": item.mechanism_ref,
        "actuation_permitted": item.actuation_permitted if scoped and unique and item.cell_ref in cells
            and item.mechanism_ref is not None and item.permission_evidence_refs else None,
        "visibility_substitutes_traversability_or_permission": False}) for item in value.permissions)
    return CapacitySuppositionFactsC(region_measurement=region, measurements=rows, facts=FrozenMap({
        "scope_current": current, "reveal_and_reserve_capacity_question_supported": scoped
            and bool(value.dark_room_evidence_refs) and bool(value.wall_contact_control_evidence_refs)
            and bool(value.door_evidence_refs) and bool(value.finite_capacity_display_evidence_refs),
        "recovery_inclusive_budget_fit_evidenced": scoped and region.facts["recovery_inclusive_budget_fits"],
        "visibility_traversability_and_actuation_separate": True, "capacity_or_permission_law_confirmed": False}))


def measure_finite_flow_supposition(value: FiniteFlowSuppositionInputC) -> CapacitySuppositionFactsC:
    current = _scope_current(value.scope)
    graph = measure_visible_graph(value.graph)
    vessels = {item.vessel_ref: item for item in value.vessels}
    unique = len(vessels) == len(value.vessels)
    source = vessels.get(value.source_ref)
    source_filled = current and unique and source is not None and bool(source.quantity_evidence_refs) and source.observed_quantity is not None and source.observed_quantity > 0
    terminals = tuple(ref for ref in value.terminal_container_refs if ref in vessels and vessels[ref].observed_quantity == 0
        and bool(vessels[ref].quantity_evidence_refs))
    rows, checks, bounded = [], 0, False
    for index, first in enumerate(value.vessels):
        for second in value.vessels[index + 1:]:
            if checks >= value.max_envelope_pair_checks:
                bounded = True
                break
            checks += 1
            same = (current and unique and bool(first.envelope_evidence_refs) and bool(second.envelope_evidence_refs)
                and first.envelope_signature_ref == second.envelope_signature_ref)
            thresholds = (current and unique and first.measured_threshold is not None and second.measured_threshold is not None
                and first.measured_threshold >= 0 and second.measured_threshold >= 0
                and bool(first.threshold_evidence_refs) and bool(second.threshold_evidence_refs))
            roles = current and unique and first.routing_role_ref is not None and second.routing_role_ref is not None and bool(first.routing_role_evidence_refs) and bool(second.routing_role_evidence_refs)
            rows.append(FrozenMap({"first_vessel_ref": first.vessel_ref, "second_vessel_ref": second.vessel_ref,
                "same_observed_envelope": same, "measured_thresholds_equal": first.measured_threshold == second.measured_threshold if thresholds else None,
                "independent_routing_roles_equal": first.routing_role_ref == second.routing_role_ref if roles else None,
                "envelope_equality_confirms_threshold_or_role": False}))
        if bounded:
            break
    native = measure_finite_flow_network(value.native_graph) if _native_binding_current(
        value, value.native_graph, value.native_binding, ("flow_graph_measurement",)) else None
    return CapacitySuppositionFactsC(graph_measurement=graph, native_measurement=native, measurements=tuple(rows), actual_envelope_pair_checks=checks,
        facts=FrozenMap({"scope_current": current, "conditional_material_distribution_question_supported": source_filled
            and bool(terminals) and bool(value.source_terminal_role_evidence_refs) and value.graph.scope == value.scope
            and bool(_graph_pairs(graph)) and bool(value.reversible_valve_evidence_refs) and bool(value.finite_source_evidence_refs),
            "empty_terminal_container_refs": terminals if current and unique else (),
            "envelope_pair_domain_open": bounded, "flow_or_threshold_law_confirmed": False}))


def measure_wrap_slide_supposition(value: WrapSlideSuppositionInputC) -> CapacitySuppositionFactsC:
    current = _scope_current(value.scope)
    required = set(value.required_cursor_refs)
    required_population = (current and bool(required) and len(required) == len(value.required_cursor_refs)
        and bool(value.required_population_evidence_refs))
    population = required_population and bool(value.settled_state_evidence_refs)
    assignments, rows, masks = {}, [], []
    for item in value.assignments:
        measured, scoped = _typed_relation(item.compatibility, value.scope)
        masks.append(measured)
        request = item.compatibility
        qualified = (population and scoped and item.cursor_ref in required
            and item.sealed_frame_ref == value.sealed_settled_frame_ref and bool(item.current_identity_evidence_refs)
            and bool(item.occupation_evidence_refs) and request.left.owner_ref == item.cursor_ref
            and request.right.owner_ref == item.seat_ref and request.operator in ("EQUAL", "SUBSET")
            and request.required_left_kind == "OCCUPIED_BODY" and request.required_right_kind == "RECEIVING_APERTURE")
        occupied = item.occupied_at_seal if qualified else None
        fit = measured.geometric_relation_value if qualified else None
        if item.cursor_ref in required:
            assignments.setdefault(item.cursor_ref, []).append((item.seat_ref, occupied, fit, qualified))
        rows.append(FrozenMap({"cursor_ref": item.cursor_ref, "seat_ref": item.seat_ref, "same_settled_frame_qualified": qualified,
            "occupied_at_seal": occupied, "whole_footprint_compatible": fit, "prior_visit_counts_as_current_occupancy": False}))
    coverage = None
    if population and value.settled_assignment_inventory_complete:
        if set(assignments) != required:
            coverage = False
        elif all(len(assignments[ref]) == 1 and assignments[ref][0][3]
                and assignments[ref][0][1] is not None and assignments[ref][0][2] is not None for ref in sorted(required)):
            coverage = (all(assignments[ref][0][1] is True and assignments[ref][0][2] is True for ref in sorted(required))
                and len({assignments[ref][0][0] for ref in sorted(required)}) == len(required))
    return CapacitySuppositionFactsC(mask_measurements=tuple(masks), measurements=tuple(rows), facts=FrozenMap({
        "scope_current": current, "distinct_seat_coverage_question_supported": required_population
            and bool(value.movable_cell_body_evidence_refs) and bool(value.compatible_cavity_evidence_refs)
            and bool(value.coordinated_motion_or_edge_reappearance_evidence_refs),
        "all_required_cursors_distinct_compatible_seats_in_same_settled_frame": coverage,
        "surplus_seat_occupancy_substitutes_required_cursor": False, "wrap_or_acceptance_law_confirmed": False}))


def assemble_capacity_supposition(value: CapacitySuppositionDecisionInputC) -> CapacitySuppositionDecisionC:
    return CapacitySuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
