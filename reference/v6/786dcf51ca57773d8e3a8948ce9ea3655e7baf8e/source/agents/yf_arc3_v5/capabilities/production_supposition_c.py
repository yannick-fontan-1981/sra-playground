"""Pure bounded observations; native calls are restricted to descriptive MEASURE."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .production_supposition_contracts_c import (ReactionSuppositionInputC, ChromaticSuppositionInputC,
    AdversarialSuppositionInputC, WorkbenchSuppositionInputC, LatentRestorationSuppositionInputC,
    ProductionSuppositionFactsC, ProductionSuppositionDecisionInputC, ProductionSuppositionDecisionC)
from .structural_supposition_c import _scope_current, _typed_relation, measure_visible_graph
from .transport_supposition_c import _observation_current
from .indexed_sequence_c import measure_indexed_sequence
from .consumable_reaction_network import measure_consumable_reaction_network
from .chromatic_window_composition import measure_chromatic_window_composition
from .adversarial_drop_alignment import measure_adversarial_drop_alignment


def _native_binding_current(value, request, binding, operations):
    if request is None or binding is None:
        return False
    scope, native = value.scope, request.scope
    return (_scope_current(scope) and bool(binding.binding_evidence_refs)
        and request.mode == "MEASURE" and request.operation_ref in operations
        and native.request_ref == value.question_ref and native.caller_ref == scope.consumer_ref
        and native.parent_goal_ref == scope.parent_goal_ref and native.epoch == scope.epoch
        and native.evidence_revision_ref == scope.revision_ref
        and native.model_revision_ref == binding.current_model_revision_ref)


def _graph_pairs(measured):
    return tuple(row for row in measured.measurements if row.get("first_node_ref") is not None
        and row.get("second_node_ref") is not None and row.get("endpoint_pair_ambiguous") is False
        and row.get("same_node") is False)


def measure_reaction_supposition(value: ReactionSuppositionInputC) -> ProductionSuppositionFactsC:
    current = _scope_current(value.scope)
    walking, transmission = measure_visible_graph(value.walking_graph), measure_visible_graph(value.transmission_graph)
    scoped = current and value.walking_graph.scope == value.scope and value.transmission_graph.scope == value.scope
    pairs = _graph_pairs(transmission) if scoped else ()
    incoming = {}
    for row in pairs:
        if row["first_direction"] == "OUT" and row["second_direction"] == "IN":
            incoming.setdefault(row["second_node_ref"], set()).add(row["first_node_ref"])
        elif row["second_direction"] == "OUT" and row["first_direction"] == "IN":
            incoming.setdefault(row["first_node_ref"], set()).add(row["second_node_ref"])
    convergent = tuple(sorted(ref for ref in sorted(incoming) if len(incoming[ref]) > 1))
    native = measure_consumable_reaction_network(value.native_layers) if _native_binding_current(
        value, value.native_layers, value.native_binding, ("layers",)) else None
    return ProductionSuppositionFactsC(graph_measurements=(walking, transmission), native_measurement=native,
        measurements=(FrozenMap({"convergent_node_refs": convergent,
            "walking_and_transmission_requests_distinct": value.walking_graph != value.transmission_graph,
            "overlay_mobility_supported": current and bool(value.independently_movable_overlay_evidence_refs),
            "overlay_inhibition_or_relay_law_confirmed": False}),),
        facts=FrozenMap({"scope_current": current,
            "directed_reaction_question_supported": scoped and bool(value.graph_role_evidence_refs)
                and bool(value.repeated_oriented_cell_evidence_refs) and bool(value.distinct_primed_state_evidence_refs)
                and bool(value.differentiated_terminal_evidence_refs) and bool(convergent),
            "graph_domain_open": bool(walking.facts["budget_reached"] or transmission.facts["budget_reached"]),
            "walking_graph_never_substitutes_transmission": True, "reaction_law_confirmed": False}))


def measure_chromatic_supposition(value: ChromaticSuppositionInputC) -> ProductionSuppositionFactsC:
    current = _scope_current(value.scope)
    panes = set(value.pane_refs)
    unique = len(panes) == len(value.pane_refs)
    rows, overlap = [], False
    for request in value.pane_overlap_relations:
        measured, supported = _typed_relation(request, value.scope)
        supported = (supported and unique and request.operator == "INTERSECTS"
            and request.required_left_kind == "RECOGNITION" and request.required_right_kind == "RECOGNITION"
            and request.left.owner_ref in panes and request.right.owner_ref in panes
            and request.left.owner_ref != request.right.owner_ref)
        actual = measured.geometric_relation_value if supported else None
        overlap = overlap or actual is True
        rows.append(FrozenMap({"relation_ref": request.relation_ref, "overlap_value": actual,
            "left_pane_ref": request.left.owner_ref, "right_pane_ref": request.right.owner_ref,
            "actual_support_point_visits": measured.actual_input_support_point_visits}))
    repeats = {}
    for example in value.mixtures:
        supported = (_observation_current(example, value.scope) and unique and example.canonical_value_ref is not None
            and bool(example.mixed_value_identity_evidence_refs) and bool(example.pane_ownership_evidence_refs)
            and bool(example.window_relation_evidence_refs) and example.inside_observed_window is True
            and len(set(example.pane_refs)) == len(example.pane_refs) and len(example.pane_refs) > 1
            and set(example.pane_refs) <= panes)
        if supported:
            key = tuple(sorted(example.pane_refs)), example.canonical_value_ref
            repeats.setdefault(key, set()).add(example.example_ref)
        rows.append(FrozenMap({"example_ref": example.example_ref, "sample_ref": example.sample_ref,
            "inside_window_mixture_qualified": supported, "canonical_value_ref": example.canonical_value_ref,
            "pane_refs": example.pane_refs}))
    native = measure_chromatic_window_composition(value.native_window) if _native_binding_current(
        value, value.native_window, value.native_binding, ("window_correspondence", "layer_ownership")) else None
    repeated = any(len(repeats[key]) > 1 for key in sorted(repeats))
    return ProductionSuppositionFactsC(measurements=tuple(rows), native_measurement=native,
        facts=FrozenMap({"scope_current": current,
            "framed_reference_panes_supported": current and unique and len(panes) > 1
                and bool(value.framed_field_evidence_refs) and bool(value.smaller_homologous_reference_evidence_refs)
                and bool(value.irregular_pane_evidence_refs), "pane_overlap_supported": overlap,
            "repeatable_mixture_observed": repeated, "white_point_ref": value.white_point_ref,
            "white_point_competing_role_refs": value.white_point_competing_role_refs,
            "white_point_selection_or_mix_unresolved": value.white_point_ref is not None,
            "composition_or_acceptance_law_confirmed": False}))


def measure_adversarial_supposition(value: AdversarialSuppositionInputC) -> ProductionSuppositionFactsC:
    current = _scope_current(value.scope)
    rows, other_owners = [], set()
    for transaction in value.transactions:
        places = transaction.placements
        complete = (_observation_current(transaction, value.scope) and len(transaction.primitive_refs) == 1
            and transaction.full_transaction_inventory_complete and bool(transaction.transaction_evidence_refs)
            and len({row.token_ref for row in places}) == len(places)
            and len({row.chronological_ordinal for row in places}) == len(places)
            and all(row.board_ref == transaction.board_ref and bool(row.owner_identity_evidence_refs)
                and bool(row.actual_placement_evidence_refs) for row in places))
        direct = tuple(row for row in places if row.owner_ref == transaction.input_owner_ref
            and row.post_input_automatic is False and bool(row.phase_ownership_evidence_refs))
        foreign = tuple(row for row in places if row.owner_ref != transaction.input_owner_ref
            and row.post_input_automatic is True and bool(row.phase_ownership_evidence_refs))
        responding = tuple(sorted({row.owner_ref for row in foreign if complete
            and any(prior.chronological_ordinal < row.chronological_ordinal for prior in direct)}))
        other_owners.update(responding)
        rows.append(FrozenMap({"example_ref": transaction.example_ref, "board_ref": transaction.board_ref,
            "one_input_complete_transaction_qualified": complete, "post_input_foreign_owner_refs": responding,
            "static_foreign_tokens_establish_opponent": False}))
    native = measure_adversarial_drop_alignment(value.native_board) if _native_binding_current(
        value, value.native_board, value.native_binding, ("board_owners",)) else None
    return ProductionSuppositionFactsC(measurements=tuple(rows), native_measurement=native,
        facts=FrozenMap({"scope_current": current,
            "supported_alignment_board_question": current and bool(value.aligned_same_owner_evidence_refs)
                and bool(value.gravity_supported_board_evidence_refs),
            "observed_post_input_other_owner_refs": tuple(sorted(other_owners)), "other_owner_response_observed": bool(other_owners),
            "opponent_policy_or_adversarial_law_confirmed": False}))


def measure_workbench_supposition(value: WorkbenchSuppositionInputC) -> ProductionSuppositionFactsC:
    current = _scope_current(value.scope)
    graph = measure_visible_graph(value.diagrams)
    scoped = current and value.diagrams.scope == value.scope and bool(value.holder_role_evidence_refs)
    inputs, outputs = set(value.input_holder_node_refs), set(value.output_holder_node_refs)
    distinct = (inputs.isdisjoint(outputs) and len(inputs) == len(value.input_holder_node_refs)
        and len(outputs) == len(value.output_holder_node_refs))
    directional = tuple(row for row in _graph_pairs(graph) if scoped and distinct and
        ((row["first_node_ref"] in inputs and row["second_node_ref"] in outputs
            and row["first_direction"] == "OUT" and row["second_direction"] == "IN") or
         (row["second_node_ref"] in inputs and row["first_node_ref"] in outputs
            and row["second_direction"] == "OUT" and row["first_direction"] == "IN")))
    operands, slots = set(value.operand_refs), set(value.requested_slot_refs)
    slot_scope = (current and bool(value.slot_role_evidence_refs)
        and len(operands) == len(value.operand_refs) and len(slots) == len(value.requested_slot_refs))
    matches = tuple(FrozenMap({"operand_ref": item.operand_ref, "requested_slot_ref": item.requested_slot_ref,
        "compatibility_value": item.compatible if slot_scope and item.operand_ref in operands
            and item.requested_slot_ref in slots and item.independent_type_relation_evidence_refs else None})
        for item in value.compatibility)
    return ProductionSuppositionFactsC(graph_measurements=(graph,), measurements=matches,
        facts=FrozenMap({"scope_current": current,
            "stock_holders_diagram_slots_supported": scoped and distinct and bool(value.stock_area_evidence_refs)
                and bool(value.separate_operand_holder_evidence_refs) and bool(directional)
                and any(row["compatibility_value"] is True for row in matches),
            "diagram_domain_open": bool(graph.facts["budget_reached"]),
            "emphasized_control_ref": value.emphasized_control_ref,
            "emphasized_control_competing_role_refs": value.emphasized_control_competing_role_refs,
            "emphasized_control_is_final_answer": False, "production_or_delivery_law_confirmed": False}))


def _normalized_pattern(unit, scope):
    request = unit.sequence
    measured = measure_indexed_sequence(request)
    supported = (_scope_current(scope) and bool(unit.normalization_evidence_refs)
        and unit.unit_ref == request.sequence_ref and request.parent_goal_ref == scope.parent_goal_ref
        and request.consumer_ref == scope.consumer_ref and request.epoch == scope.epoch
        and request.revision_ref == scope.revision_ref and request.scope_ref == scope.scope_ref
        and request.actual_sealed_observation and request.observation_epoch == scope.epoch
        and request.observation_revision_ref == scope.revision_ref and request.observation_scope_ref == scope.scope_ref
        and not measured.remaining_domain_refs and len(measured.projections) == 1)
    canonical = {}
    if supported:
        projection = measured.projections[0]
        supported = (bool(projection.domain.evidence_refs) and bool(projection.slots)
            and not projection.unsupported_observation_refs and not projection.contradictory_ordinals
            and not projection.outside_declared_domain and all(slot.content_known for slot in projection.slots))
        if supported:
            canonical = {slot.ordinal: (slot.observations[0].status, slot.observations[0].content) for slot in projection.slots}
    return measured, canonical if supported else None


def measure_latent_restoration_supposition(value: LatentRestorationSuppositionInputC) -> ProductionSuppositionFactsC:
    current = _scope_current(value.scope)
    all_units = (*value.units, *(unit for edit in value.edits for unit in (edit.before, edit.after)))
    declared_slots = sum(len(domain.original_ordinals) for unit in all_units for domain in unit.sequence.domain_alternatives)
    bounded = declared_slots > value.max_total_projected_slots
    indexed, patterns, rows, checks, possible, edited = [], [], [], 0, False, False
    unique = len({unit.unit_ref for unit in value.units}) == len(value.units)
    if not bounded:
        for unit in value.units:
            measured, canonical = _normalized_pattern(unit, value.scope)
            indexed.append(measured)
            patterns.append((unit, canonical))
        for index, (left, first) in enumerate(patterns):
            for right, second in patterns[index + 1:]:
                if checks >= value.max_pair_checks:
                    bounded = True
                    break
                checks += 1
                supported = (unique and first is not None and second is not None
                    and left.comparison_basis_ref == right.comparison_basis_ref and set(first) == set(second))
                changes = tuple(ordinal for ordinal in sorted(first) if first[ordinal] != second[ordinal]) if supported else ()
                repeated = supported and len(changes) < len(first) and len(changes) <= value.localized_deviation_cap
                possible = possible or repeated
                rows.append(FrozenMap({"left_unit_ref": left.unit_ref, "right_unit_ref": right.unit_ref,
                    "whole_normalized_domains_qualified": supported, "different_ordinals": changes,
                    "latent_reference_question_supported": repeated, "intentional_variation_still_possible": True}))
            if bounded:
                break
        for edit in value.edits:
            before_measure, before = _normalized_pattern(edit.before, value.scope)
            after_measure, after = _normalized_pattern(edit.after, value.scope)
            indexed.extend((before_measure, after_measure))
            supported = (_observation_current(edit, value.scope) and bool(edit.isolated_edit_evidence_refs)
                and 0 < len(edit.primitive_refs) <= value.maximum_probe_primitives
                and edit.before.unit_ref == edit.after.unit_ref and before is not None and after is not None
                and edit.before.comparison_basis_ref == edit.after.comparison_basis_ref and set(before) == set(after))
            changes = tuple(ordinal for ordinal in sorted(before) if before[ordinal] != after[ordinal]) if supported else ()
            edited = edited or (supported and bool(changes))
            rows.append(FrozenMap({"example_ref": edit.example_ref, "bounded_local_edit_observed": supported and bool(changes),
                "changed_ordinals": changes, "primitive_refs": edit.primitive_refs, "general_repair_series_known": False}))
    return ProductionSuppositionFactsC(indexed_measurements=tuple(indexed), measurements=tuple(rows), actual_pair_checks=checks,
        actual_projected_slot_count=sum(item.actual_projected_slot_count for item in indexed),
        facts=FrozenMap({"scope_current": current, "localized_repetition_supported": current and possible,
            "bounded_local_edit_observed": current and edited, "comparison_domain_open": bounded
                or any(item.remaining_domain_refs for item in indexed) or any(pattern is None for _, pattern in patterns),
            "rarity_alone_confirms_corruption": False, "repair_series_or_latent_reference_confirmed": False}))


def assemble_production_supposition(value: ProductionSuppositionDecisionInputC) -> ProductionSuppositionDecisionC:
    return ProductionSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
