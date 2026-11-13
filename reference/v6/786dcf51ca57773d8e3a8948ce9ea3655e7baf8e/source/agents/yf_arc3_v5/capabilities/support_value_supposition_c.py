"""Reuse support geometry and compare explicit value/stencil hypotheses without merging them."""
from fractions import Fraction
from .support_value_supposition_contracts_c import (ReconfigurableSupportSuppositionInputC,
    ReconfigurableSupportSuppositionFactsC, CoupledValueSuppositionInputC, CoupledValueSuppositionFactsC,
    SupportValueSuppositionDecisionInputC, SupportValueSuppositionDecisionC)
from .structural_supposition_c import _scope_current
from .reconfigurable_support import measure_reconfigurable_support_packet, measure_reconfigurable_rigid_geometry
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_support_supposition(value: ReconfigurableSupportSuppositionInputC) -> ReconfigurableSupportSuppositionFactsC:
    scope = value.scope
    current = _scope_current(scope)
    supported = all(isinstance(value.snapshot_support_by_ref.get(snapshot.snapshot_ref), FrozenMap)
        and value.snapshot_support_by_ref[snapshot.snapshot_ref].get("epoch") == scope.epoch
        and value.snapshot_support_by_ref[snapshot.snapshot_ref].get("revision_ref") == scope.revision_ref
        and value.snapshot_support_by_ref[snapshot.snapshot_ref].get("scope_ref") == scope.scope_ref
        and bool(value.snapshot_support_by_ref[snapshot.snapshot_ref].get("evidence_refs")) for snapshot in value.packet.snapshots)
    positions = sum(len(snapshot.actor_positions)+sum(len(layer.positions) for layer in snapshot.active_layers)
        for snapshot in value.packet.snapshots)
    if value.geometry is not None:
        positions += (len(value.geometry.before_positions)+len(value.geometry.after_positions)
            + sum(len(layer.positions) for layer in (*value.geometry.before_support_layers, *value.geometry.after_support_layers))
            + sum(len(candidate.staging_actor_positions) for candidate in value.geometry.pivot_candidates))
    bounded = positions > value.max_input_positions
    packet = measure_reconfigurable_support_packet(value.packet) if current and supported and not bounded else None
    geometry_linked = (value.geometry is not None
        and value.geometry.before_support_layers == value.packet.snapshots[0].active_layers
        and value.geometry.after_support_layers == value.packet.snapshots[-1].active_layers)
    geometry = measure_reconfigurable_rigid_geometry(value.geometry) if (packet is not None and geometry_linked
        and value.pivot_pose_evidence_refs) else None
    stations = tuple(dict.fromkeys(fit.candidate_ref for fit in geometry.exact_quarter_turn_fits
        if fit.staging_supported_before and fit.staging_supported_after)) if geometry is not None else ()
    return ReconfigurableSupportSuppositionFactsC(measured_packet=packet, measured_geometry=geometry,
        retained_station_candidate_refs=stations,
        facts=FrozenMap({"scope_current": current, "snapshots_supported": supported, "budget_reached": bounded,
            "remote_control_supported": bool(value.remote_control_evidence_refs),
            "mutable_support_supported": bool(value.mutable_surface_evidence_refs),
            "body_support_supported": bool(value.body_support_evidence_refs),
            "separated_destination_supported": bool(value.separated_destination_evidence_refs),
            "support_union_changed": packet is not None and packet.support_union_changed,
            "support_restoration_observed": packet is not None and bool(packet.restoration_positions),
            "final_connection_under_snapshot_model": packet is not None and packet.final_connection_present,
            "route_bound_reached": packet is not None and packet.actor_pose_bound_reached,
            "stable_pivot_station_candidates_present": bool(stations),
            "pivot_geometry_linked_to_support_snapshots": geometry_linked,
            "station_is_reconfiguration_hypothesis_not_safe_route": True,
            "control_law_or_joint_route_confirmed": False}))


def measure_coupled_value_supposition(value: CoupledValueSuppositionInputC) -> CoupledValueSuppositionFactsC:
    scope = value.scope
    current = _scope_current(scope)
    rows, influence = [], []
    for pair in value.correspondences:
        reference, surface = value.reference_values.get(pair.reference_field_ref), value.surface_values.get(pair.surface_field_ref)
        qualified = current and bool(value.homologous_nested_structure_evidence_refs) and bool(pair.evidence_refs)
        normalized = None
        match = None
        if qualified and reference is not None and surface is not None:
            if type(reference) is int and type(surface) is int:
                normalized = Fraction(reference*pair.scale_numerator, pair.scale_denominator)+pair.offset
                match = normalized == surface
                normalized = (normalized.numerator, normalized.denominator)
            elif pair.scale_numerator == pair.scale_denominator and pair.offset == 0:
                normalized, match = reference, reference == surface
        rows.append(FrozenMap({"correspondence_ref": pair.correspondence_ref,
            "reference_field_ref": pair.reference_field_ref, "surface_field_ref": pair.surface_field_ref,
            "scope_qualified": qualified, "normalized_reference_value": normalized,
            "desired_value_relation": match, "action_effect_from_desired_value": False}))
    positions = len(value.stencil_occupied_positions)+sum(len(example.observed_changed_positions) for example in value.effect_examples)
    bounded = positions > value.max_position_visits
    offsets = tuple(sorted({(row-value.stencil_origin[0], col-value.stencil_origin[1])
        for row, col in value.stencil_occupied_positions})) if current and not bounded and value.stencil_geometry_evidence_refs else ()
    for example in value.effect_examples:
        qualified = (current and not bounded and bool(value.distinct_embedded_stencil_evidence_refs)
            and bool(value.stencil_geometry_evidence_refs) and example.epoch == scope.epoch
            and example.revision_ref == scope.revision_ref and example.scope_ref == scope.scope_ref
            and example.sealed_observation and bool(example.isolated_operation_evidence_refs))
        expected = {(example.anchor[0]+dr, example.anchor[1]+dc) for dr, dc in offsets} if qualified else None
        observed = set(example.observed_changed_positions)
        matches = None
        if qualified and not observed.issubset(expected):
            matches = False
        elif qualified and example.changed_position_inventory_complete and example.every_influenced_cell_changes_evidence_refs:
            matches = expected == observed
        influence.append(FrozenMap({"example_ref": example.example_ref, "scope_qualified": qualified,
            "influence_position_relation": matches, "effect_inventory_complete": example.changed_position_inventory_complete,
            "all_influenced_cells_expected_to_change": bool(example.every_influenced_cell_changes_evidence_refs),
            "desired_goal_from_action_offsets": False}))
    ids = tuple(pair.correspondence_ref for pair in value.correspondences)
    return CoupledValueSuppositionFactsC(normalized_reference_rows=tuple(rows), influence_example_rows=tuple(influence),
        stencil_offsets=offsets, facts=FrozenMap({"scope_current": current, "budget_reached": bounded,
            "homologous_nested_structure_supported": bool(value.homologous_nested_structure_evidence_refs),
            "distinct_embedded_stencil_supported": bool(value.distinct_embedded_stencil_evidence_refs),
            "desired_and_influence_models_distinct": value.desired_value_model_ref != value.action_influence_model_ref,
            "unique_correspondence_refs": len(set(ids)) == len(ids),
            "normalized_reference_relations_present": bool(rows),
            "stencil_geometry_supported": bool(value.stencil_geometry_evidence_refs),
            "desired_and_influence_hypotheses_retained_separately": True,
            "physical_goal_or_effect_law_confirmed": False}))


def assemble_support_value_supposition(value: SupportValueSuppositionDecisionInputC) -> SupportValueSuppositionDecisionC:
    return SupportValueSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
