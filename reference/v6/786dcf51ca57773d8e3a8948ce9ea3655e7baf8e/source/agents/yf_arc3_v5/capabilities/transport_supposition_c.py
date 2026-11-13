"""Existing geometry/graph measurements feed Source; similarity never selects a law."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .transport_supposition_contracts_c import (ReactiveGraphSuppositionInputC, QuantityIdentitySuppositionInputC,
    OrientedCargoSuppositionInputC, PiercingOrderSuppositionInputC, TransportSuppositionFactsC,
    TransportSuppositionDecisionInputC, TransportSuppositionDecisionC)
from .structural_supposition_c import _scope_current, _typed_relation, measure_visible_graph, measure_layer_contact
from .piercing_rooted_order import measure_piercing_intersections


def _observation_current(example, scope):
    return (_scope_current(scope) and example.epoch == scope.epoch and example.revision_ref == scope.revision_ref
        and example.scope_ref == scope.scope_ref and example.sealed and bool(example.evidence_refs))


def measure_reactive_graph_supposition(value: ReactiveGraphSuppositionInputC) -> TransportSuppositionFactsC:
    current = _scope_current(value.scope)
    graph = measure_visible_graph(value.graph)
    exact_scope = value.graph.scope == value.scope
    node_refs = {port.node_ref for port in value.graph.ports}
    connected = exact_scope and current and any(row.get("first_node_ref") in node_refs
        and row.get("second_node_ref") in node_refs and row.get("same_node") is False
        and row.get("endpoint_pair_ambiguous") is False for row in graph.measurements)
    rows = []
    for example in value.examples:
        qualified = (_observation_current(example, value.scope) and exact_scope
            and bool(value.logical_position_basis_evidence_refs)
            and example.before_node_ref in node_refs and example.after_node_ref in node_refs)
        delta = (example.after_position[0] - example.before_position[0],
            example.after_position[1] - example.before_position[1])
        movement = qualified and bool(example.actual_actor_movement_evidence_refs) and bool(example.node_pose_evidence_refs) and delta != (0, 0)
        peer = (qualified and example.automatic_peer_ref in value.oriented_peer_refs
            and example.automatic_peer_ref is not None and bool(value.oriented_peer_evidence_refs)
            and example.peer_before_position is not None and example.peer_after_position is not None
            and bool(example.post_direct_phase_evidence_refs))
        landing = qualified and bool(example.landing_inventory_evidence_refs)
        rows.append(FrozenMap({"example_ref": example.example_ref, "primitive_ref": example.primitive_ref,
            "qualified": qualified, "before_node_ref": example.before_node_ref, "after_node_ref": example.after_node_ref,
            "actual_action_delta": delta if movement else None,
            "action_step_differs_from_smallest_tile": movement and value.smallest_tile_displacement is not None
                and bool(value.smallest_tile_evidence_refs) and
                sum(part * part for part in delta) != sum(part * part for part in value.smallest_tile_displacement),
            "post_direct_peer_moved": peer and example.peer_before_position != example.peer_after_position,
            "landing_became_occupied": landing and example.landing_occupied_before is False and example.landing_occupied_after is True,
            "independently_unsafe_after": example.independently_unsafe_after
                if qualified and bool(example.unsafe_relation_evidence_refs) else None,
            "empty_before_proves_safe_after": False}))
    return TransportSuppositionFactsC(graph_measurement=graph, measurements=tuple(rows),
        actual_support_point_visits=graph.actual_support_point_visits,
        facts=FrozenMap({"scope_current": current, "landing_connector_graph_supported": connected
            and bool(value.alternating_landing_tile_evidence_refs),
            "graph_domain_open": bool(graph.facts["budget_reached"]), "graph_step_not_texture_assumed": True,
            "reaction_observed": any(row["post_direct_peer_moved"] for row in rows),
            "safe_landing_law_confirmed": False}))


def measure_quantity_identity_supposition(value: QuantityIdentitySuppositionInputC) -> TransportSuppositionFactsC:
    current = _scope_current(value.scope)
    actuators = set(value.distinct_actuator_refs)
    unique = len(actuators) == len(value.distinct_actuator_refs)
    rows = []
    for example in value.examples:
        qualified = (_observation_current(example, value.scope) and unique and
            example.actuator_ref in actuators and example.tagged_body_ref == value.tagged_body_ref)
        before, after = example.quantities_before, example.quantities_after
        numeric = (set(before) == set(after) and bool(before)
            and all(type(mapping[ref]) is int and mapping[ref] >= 0
                for mapping in (before, after) for ref in sorted(mapping)))
        whole = qualified and numeric and example.quantity_inventory_complete
        deltas = FrozenMap({ref: after[ref] - before[ref] for ref in sorted(before)}) if whole else FrozenMap()
        conserved = whole and bool(example.boundary_exchange_zero_evidence_refs) and sum(deltas[ref] for ref in sorted(deltas)) == 0
        identity = qualified and bool(example.persistent_tag_identity_evidence_refs)
        rows.append(FrozenMap({"example_ref": example.example_ref, "actuator_ref": example.actuator_ref,
            "quantity_inventory_qualified": whole, "quantity_deltas": deltas,
            "closed_inventory_total_unchanged": conserved,
            "quantity_distribution_changed": whole and any(deltas[ref] != 0 for ref in sorted(deltas)),
            "same_tag_identity_supported": identity,
            "tagged_body_displaced": identity and example.tagged_position_before != example.tagged_position_after,
            "tagged_position_before": example.tagged_position_before, "tagged_position_after": example.tagged_position_after}))
    quantity_actuators = tuple(sorted({row["actuator_ref"] for row in rows if row["quantity_distribution_changed"]}))
    identity_actuators = tuple(sorted({row["actuator_ref"] for row in rows if row["tagged_body_displaced"]}))
    return TransportSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({
        "scope_current": current, "tag_material_marker_supported": current and bool(value.tagged_body_evidence_refs)
            and bool(value.resting_on_transferable_material_evidence_refs) and bool(value.matching_wall_marker_evidence_refs),
        "distinct_actuator_passage_supported": current and unique and len(actuators) > 1
            and bool(value.actuator_identity_evidence_refs) and bool(value.distinct_passage_shape_evidence_refs),
        "quantity_actuator_refs": quantity_actuators, "identity_actuator_refs": identity_actuators,
        "quantity_and_identity_relations_remain_separate": True, "universal_conservation_or_transport_law_confirmed": False}))


def measure_oriented_cargo_supposition(value: OrientedCargoSuppositionInputC) -> TransportSuppositionFactsC:
    current = _scope_current(value.scope)
    cargo = set(value.cargo_refs)
    unique = len(cargo) == len(value.cargo_refs)
    relation, qualified = _typed_relation(value.compatible_receptacle_relation, value.scope)
    request = value.compatible_receptacle_relation
    compatible = (qualified and unique and request.left.owner_ref in cargo and request.right.owner_ref == value.receptacle_ref
        and request.required_left_kind == "OCCUPIED_BODY" and request.required_right_kind == "RECEIVING_APERTURE"
        and request.operator in ("EQUAL", "SUBSET") and relation.geometric_relation_value is True)
    rows = []
    for example in value.examples:
        scoped = (_observation_current(example, value.scope) and unique and example.cargo_ref in cargo
            and example.receptacle_ref == value.receptacle_ref)
        orientation = scoped and bool(example.oriented_face_evidence_refs) and example.facing_normal != (0, 0)
        dot = sum(left * right for left, right in zip(example.facing_normal, example.reference_to_cargo_vector))
        delivered = scoped and example.delivery_inventory_complete and bool(example.delivery_evidence_refs)
        before, after = set(example.delivered_refs_before), set(example.delivered_refs_after)
        delivered = delivered and len(before) == len(example.delivered_refs_before) and len(after) == len(example.delivered_refs_after)
        rows.append(FrozenMap({"example_ref": example.example_ref, "cargo_ref": example.cargo_ref,
            "front_projection_positive": dot > 0 if orientation else None,
            "outline_changed": example.outline_changed if scoped and bool(example.outline_evidence_refs) else None,
            "independently_attached": example.independently_attached if scoped and bool(example.attachment_evidence_refs) else None,
            "delivered_added_refs": tuple(sorted(after - before)) if delivered else (),
            "delivered_removed_refs": tuple(sorted(before - after)) if delivered else (),
            "actor_intervention_observed": scoped and example.actor_ref is not None and bool(example.actor_intervention_evidence_refs),
            "actor_ref": example.actor_ref, "actor_cause_confirmed": False,
            "front_or_outline_confirms_attachment": False}))
    layer = measure_layer_contact(value.layer_contacts) if value.layer_contacts is not None and value.layer_contacts.scope == value.scope else None
    return TransportSuppositionFactsC(measurements=tuple(rows), layer_measurement=layer,
        actual_support_point_visits=relation.actual_input_support_point_visits + (layer.actual_support_point_visits if layer else 0),
        facts=FrozenMap({"scope_current": current,
            "repeated_cargo_compatible_receptacle_supported": current and compatible and len(cargo) > 1 and bool(value.repeated_cargo_evidence_refs),
            "face_outline_roles_supported": current and bool(value.face_and_outline_role_evidence_refs),
            "delivery_attachment_assistance_remain_separate": True, "delivery_or_attachment_law_confirmed": False}))


def measure_piercing_order_supposition(value: PiercingOrderSuppositionInputC) -> TransportSuppositionFactsC:
    current = _scope_current(value.scope)
    geometry = value.geometry
    point_count = sum(len(rod.root_to_tip_positions) + (len(rod.rod_footprint_positions) if rod.rod_footprint_positions is not None else 0)
        for rod in geometry.rods) + sum(len(piece.occupied_positions) for piece in geometry.pieces)
    bounded = point_count > value.max_support_points
    unique = len({rod.rod_ref for rod in geometry.rods}) == len(geometry.rods) and len({piece.piece_ref for piece in geometry.pieces}) == len(geometry.pieces)
    roots = tuple(rod for rod in geometry.rods if rod.root_ref == geometry.requested_root_ref)
    support = (current and unique and len(roots) == 1 and bool(value.geometry_scope_evidence_refs)
        and bool(value.desired_support_evidence_refs)
        and all(bool(value.piece_support_relation_evidence.get(piece.piece_ref)) for piece in geometry.pieces if piece.support_refs))
    native = measure_piercing_intersections(geometry) if support and not bounded else None
    tied = False
    if native is not None:
        stations = tuple(row.first_root_index for row in native.intersections if row.rod_ref == native.requested_support_ref
            and row.piece_ref in native.requested_support_piece_refs)
        tied = len(stations) != len(set(stations))
    rows = (FrozenMap({"requested_root_ref": geometry.requested_root_ref, "handle_ref": value.handle_ref,
        "fixed_receiver_refs": value.fixed_receiver_refs, "root_order_ambiguous": tied,
        "native_rooted_match": native.rooted_match if native is not None and not tied else None,
        "requested_support_is_handle": geometry.requested_root_ref == value.handle_ref,
        "requested_support_is_receiver": geometry.requested_root_ref in value.fixed_receiver_refs
            and bool(value.receiver_role_evidence_refs), "physical_attachment_inferred_from_intersection": False}),)
    return TransportSuppositionFactsC(measurements=rows, piercing_measurement=native,
        piercing_input_point_count=point_count,
        facts=FrozenMap({"scope_current": current,
            "rail_rod_pieces_rooted_reference_supported": current and bool(value.rail_handle_evidence_refs)
                and bool(value.variable_rod_evidence_refs) and bool(value.movable_piece_evidence_refs)
                and bool(value.homologous_rooted_reference_evidence_refs),
            "desired_support_scope_qualified": support, "geometry_domain_open": bounded,
            "handle_never_assumed_requested_receiver": True, "rooted_order_or_goal_law_confirmed": False}))


def assemble_transport_supposition(value: TransportSuppositionDecisionInputC) -> TransportSuppositionDecisionC:
    return TransportSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
