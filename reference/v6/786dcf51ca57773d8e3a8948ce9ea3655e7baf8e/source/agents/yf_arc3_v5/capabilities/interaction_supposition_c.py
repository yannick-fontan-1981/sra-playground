"""Pure descriptors retain lifetime, latches, authentication and exact support-route scope."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .interaction_supposition_contracts_c import (EndpointRewriteSuppositionInputC, RecurringQuantitySuppositionInputC,
    SharedSymbolSuppositionInputC, AuthenticationSuppositionInputC, PushLogisticsSuppositionInputC,
    InteractionSuppositionFactsC, InteractionSuppositionDecisionInputC, InteractionSuppositionDecisionC)
from .structural_supposition_c import _scope_current, measure_visible_graph
from .production_supposition_c import _native_binding_current, _normalized_pattern, _graph_pairs
from .transport_supposition_c import _observation_current
from .shared_symbol_automata import measure_shared_symbol_automata
from .identity_contact_authentication import measure_identity_contact_authentication
from .push_only_logistics import measure_push_only_logistics


def measure_endpoint_rewrite_supposition(value: EndpointRewriteSuppositionInputC) -> InteractionSuppositionFactsC:
    current = _scope_current(value.scope)
    graph = measure_visible_graph(value.graph)
    endpoint_refs = set(value.endpoint_refs)
    unique = len(endpoint_refs) == len(value.endpoint_refs)
    requested_slots = sum(len(domain.original_ordinals) for pair in value.patterns for unit in (pair.first, pair.second)
        for domain in unit.sequence.domain_alternatives)
    bounded = requested_slots > value.max_total_pattern_slots
    rows, indexed, matching = [], [], False
    if not bounded:
        for pair in value.patterns:
            before, first = _normalized_pattern(pair.first, value.scope)
            after, second = _normalized_pattern(pair.second, value.scope)
            indexed.extend((before, after))
            qualified = (current and unique and bool(pair.endpoint_role_evidence_refs)
                and pair.first.unit_ref in endpoint_refs and pair.second.unit_ref in endpoint_refs
                and pair.first.unit_ref != pair.second.unit_ref and first is not None and second is not None
                and pair.first.comparison_basis_ref == pair.second.comparison_basis_ref and set(first) == set(second))
            equal = first == second if qualified else None
            matching = matching or equal is True
            rows.append(FrozenMap({"first_endpoint_ref": pair.first.unit_ref, "second_endpoint_ref": pair.second.unit_ref,
                "whole_endpoint_patterns_equal": equal, "pattern_equality_confirms_current_pairing": False}))
    for item in value.rewrites:
        known = (_observation_current(item, value.scope) and unique and item.complete_pairing_inventory
            and bool(item.actual_contact_evidence_refs) and bool(item.independent_pairing_identity_evidence_refs)
            and set(item.pairing_before) == set(item.pairing_after) and bool(item.pairing_before)
            and all(ref in endpoint_refs for ref in (*sorted(item.pairing_before), *sorted(item.pairing_after)))
            and all(isinstance(item.pairing_before[ref], str) and isinstance(item.pairing_after[ref], str)
                and item.pairing_before[ref] in endpoint_refs and item.pairing_after[ref] in endpoint_refs
                for ref in sorted(item.pairing_before)))
        rows.append(FrozenMap({"example_ref": item.example_ref, "pairing_change_observed_after_contact": known
            and item.pairing_before != item.pairing_after, "pairing_before": item.pairing_before, "pairing_after": item.pairing_after,
            "contact_rewrite_law_confirmed": False}))
    return InteractionSuppositionFactsC(graph_measurement=graph, indexed_measurements=tuple(indexed), measurements=tuple(rows),
        actual_projected_slot_count=sum(item.actual_projected_slot_count for item in indexed),
        facts=FrozenMap({"scope_current": current, "rewritable_transport_question_supported": current and matching
            and value.graph.scope == value.scope and bool(_graph_pairs(graph))
            and bool(value.oriented_exit_evidence_refs) and bool(value.acquisition_light_evidence_refs)
            and bool(value.access_controlled_destination_evidence_refs),
            "pattern_domain_open": bounded or any(item.remaining_domain_refs for item in indexed),
            "transport_pairing_or_acquisition_law_confirmed": False}))


def measure_recurring_quantity_supposition(value: RecurringQuantitySuppositionInputC) -> InteractionSuppositionFactsC:
    current = _scope_current(value.scope)
    wells = {well.well_ref: well for well in value.wells}
    unique = len(wells) == len(value.wells)
    rows, bands = [], 0
    for well in value.wells:
        qualified = (current and unique and bool(well.quantity_identity_evidence_refs) and bool(well.band_role_evidence_refs)
            and well.value is not None and well.lower_bound is not None and well.upper_bound is not None
            and well.lower_bound <= well.upper_bound)
        bands += int(qualified)
        rows.append(FrozenMap({"well_ref": well.well_ref,
            "current_inside_band": well.lower_bound <= well.value <= well.upper_bound if qualified else None,
            "value": well.value, "lower_bound": well.lower_bound, "upper_bound": well.upper_bound}))
    for item in value.examples:
        scoped = _observation_current(item, value.scope)
        before, after = item.quantities_before, item.quantities_after
        numeric = (set(before) == set(after) and set(before) <= set(wells)
            and all(type(data[ref]) is int for data in (before, after) for ref in sorted(data)))
        measured = scoped and numeric and item.complete_quantity_inventory and bool(item.quantity_evidence_refs)
        glyph = scoped and item.complete_glyph_inventory and bool(item.glyph_identity_evidence_refs)
        transfer = (glyph and item.glyph_well_before in wells and item.glyph_well_after in wells
            and item.glyph_well_before != item.glyph_well_after)
        rows.append(FrozenMap({"example_ref": item.example_ref, "glyph_ref": item.glyph_ref,
            "well_deltas": FrozenMap({ref: after[ref] - before[ref] for ref in sorted(before)}) if measured else FrozenMap(),
            "glyph_persistence_observed": item.glyph_persistence_value if glyph else None,
            "named_well_transfer_observed": transfer, "glyph_well_before": item.glyph_well_before,
            "glyph_well_after": item.glyph_well_after, "glyph_lifetime_from_appearance": None}))
    return InteractionSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "finite_well_quantity_question_supported": current and unique and bands > 1
            and bool(value.grouped_queue_alternative_evidence_refs) and bool(value.finite_horizon_evidence_refs),
        "once_persistent_and_transfer_explanations_separate": True, "quantity_or_glyph_lifetime_law_confirmed": False}))


def measure_shared_symbol_supposition(value: SharedSymbolSuppositionInputC) -> InteractionSuppositionFactsC:
    current = _scope_current(value.scope)
    channels = set(value.shared_channel_refs)
    groups = set(value.group_refs)
    unique = len(channels) == len(value.shared_channel_refs) and len(groups) == len(value.group_refs)
    rows = []
    for item in value.examples:
        before, after, lengths = item.prefix_before, item.prefix_after, item.word_lengths
        numeric = (set(before) == set(after) == set(lengths) == groups and bool(before)
            and all(type(data[ref]) is int for data in (before, after, lengths) for ref in sorted(data))
            and all(0 <= before[ref] <= lengths[ref] and 0 <= after[ref] <= lengths[ref] for ref in sorted(before)))
        scoped = (_observation_current(item, value.scope) and unique and item.input_channel_ref in channels
            and item.full_group_inventory and bool(item.ordered_word_focus_evidence_refs) and numeric)
        advanced = tuple(ref for ref in sorted(before) if after[ref] > before[ref]) if scoped else ()
        revoked = tuple(ref for ref in sorted(before) if after[ref] < before[ref]) if scoped else ()
        acquired = tuple(ref for ref in item.latched_group_refs if scoped and item.independent_latch_evidence_refs
            and ref in lengths and after[ref] == lengths[ref])
        rows.append(FrozenMap({"example_ref": item.example_ref, "input_channel_ref": item.input_channel_ref,
            "advanced_group_refs": advanced, "revoked_prefix_group_refs": revoked,
            "independently_latched_completed_group_refs": acquired,
            "completed_visual_frame_alone_confirms_latch": False}))
    native = measure_shared_symbol_automata(value.native_groups) if _native_binding_current(
        value, value.native_groups, value.native_binding, ("group_focus_measurement",)) else None
    return InteractionSuppositionFactsC(native_measurement=native, measurements=tuple(rows), facts=FrozenMap({
        "scope_current": current, "synchronized_prefix_question_supported": current and unique and bool(channels) and len(groups) > 1
            and bool(value.shared_channel_identity_evidence_refs) and bool(value.framed_ordered_rows_evidence_refs)
            and bool(value.independent_focus_evidence_refs),
        "partial_prefix_and_complete_latch_separate": True, "shared_emission_or_latch_law_confirmed": False}))


def measure_authentication_supposition(value: AuthenticationSuppositionInputC) -> InteractionSuppositionFactsC:
    current = _scope_current(value.scope)
    candidates, requests = set(value.candidate_refs), set(value.requested_identity_refs)
    unique = len(candidates) == len(value.candidate_refs) and len(requests) == len(value.requested_identity_refs)
    rows = []
    for item in value.examples:
        scoped = _observation_current(item, value.scope) and unique and item.candidate_ref in candidates
        accepted = (tuple(sorted(item.independently_accepted_request_refs)) if scoped and item.accepted_request_evidence_refs
            and len(set(item.independently_accepted_request_refs)) == len(item.independently_accepted_request_refs)
            and set(item.independently_accepted_request_refs) <= requests else ())
        rows.append(FrozenMap({"example_ref": item.example_ref, "candidate_ref": item.candidate_ref, "mode_ref": item.mode_ref,
            "contact_observed": scoped and bool(item.actual_contact_evidence_refs),
            "glow_observed": item.glow_observed if scoped and item.display_identity_evidence_refs else None,
            "readiness_display": item.readiness_display if scoped and item.display_identity_evidence_refs else None,
            "calibrated_readiness": item.calibrated_readiness if scoped and item.calibration_evidence_refs else None,
            "independently_accepted_request_refs": accepted, "glow_or_readiness_implies_acceptance": False}))
    native = measure_identity_contact_authentication(value.native_layers) if _native_binding_current(
        value, value.native_layers, value.native_binding, ("candidate_sensor_layers",)) else None
    return InteractionSuppositionFactsC(native_measurement=native, measurements=tuple(rows), facts=FrozenMap({
        "scope_current": current, "authentication_question_supported": current and unique and bool(candidates) and bool(requests)
            and bool(value.similar_candidate_evidence_refs) and bool(value.counted_request_evidence_refs)
            and bool(value.calibration_device_evidence_refs) and bool(value.mode_dependent_visibility_evidence_refs),
        "counted_request_and_visual_candidate_sets_separate": True, "identity_acceptance_or_calibration_law_confirmed": False}))


def _support_route_current(route, site, scope, support):
    if route is None:
        return False
    request, result = route.expected_request, route.returned
    context = FrozenMap({"parent_goal_ref": scope.parent_goal_ref, "consumer_ref": scope.consumer_ref,
        "episode_ref": scope.episode_ref, "scope_ref": scope.scope_ref, "epoch": scope.epoch,
        "input_revision_ref": scope.revision_ref})
    goal = FrozenMap({"actor_ref": site.actor_ref, "support_cell": support})
    return (_scope_current(scope) and bool(route.issuance_evidence_refs) and bool(route.actor_support_goal_evidence_refs)
        and request == result.request and request.mode == "ROUTE" and request.caller_ref == scope.consumer_ref
        and request.epoch == scope.epoch and request.input_revision_ref == scope.revision_ref
        and bool(request.model_assignments)
        and request.immutable_inputs.get("consumer_context") == context
        and request.immutable_inputs.get("actor_support_goal") == goal
        and route.actor_ref == site.actor_ref and route.support_cell == support
        and result.complete and not result.bounded and not result.contradictory and not result.missing_refs
        and not result.requested_steps and bool(result.witnesses))


def measure_push_logistics_supposition(value: PushLogisticsSuppositionInputC) -> InteractionSuppositionFactsC:
    current = _scope_current(value.scope)
    rows = []
    for site in value.sites:
        delta, crate = site.declared_push_delta, site.crate_cell
        support = (crate[0] - delta[0], crate[1] - delta[1])
        destination = (crate[0] + delta[0], crate[1] + delta[1])
        scoped = current and delta != (0, 0) and bool(site.single_cell_crate_evidence_refs) and bool(site.lattice_and_delta_evidence_refs)
        receiving = site.receiving_space_free if scoped and site.receiving_inventory_evidence_refs and site.receiving_cell_observed == destination else None
        access = scoped and _support_route_current(site.support_route, site, value.scope, support)
        rows.append(FrozenMap({"crate_ref": site.crate_ref, "actor_ref": site.actor_ref,
            "opposite_support_cell": support, "receiving_cell": destination, "single_cell_geometry_scope_qualified": scoped,
            "receiving_space_free": receiving, "exact_actor_support_route_qualified": access,
            "actor_route_is_crate_route": False, "push_legal_or_released": False}))
    native = measure_push_only_logistics(value.native_board) if _native_binding_current(
        value, value.native_board, value.native_binding, ("board_layers",)) else None
    return InteractionSuppositionFactsC(native_measurement=native, measurements=tuple(rows), facts=FrozenMap({
        "scope_current": current, "contact_logistics_question_supported": current and bool(value.movable_crate_evidence_refs)
            and bool(value.repeated_hollow_target_evidence_refs) and bool(value.small_independently_moving_actor_evidence_refs),
        "push_needs_both_receiving_and_opposite_support": True, "multi_cell_crate_requires_native_geometry": True,
        "push_transport_or_target_assignment_law_confirmed": False}))


def assemble_interaction_supposition(value: InteractionSuppositionDecisionInputC) -> InteractionSuppositionDecisionC:
    return InteractionSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
