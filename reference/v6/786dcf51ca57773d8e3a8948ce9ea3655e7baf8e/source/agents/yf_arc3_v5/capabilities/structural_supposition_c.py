"""Bounded exact structural comparisons; Source owns interpretations and action."""
from .structural_supposition_contracts_c import (TransitShapeInputC, LayerContactInputC,
    VisibleGraphInputC, StructuralSuppositionFactsC, StructuralSuppositionDecisionInputC,
    StructuralSuppositionDecisionC)
from .typed_mask_c import measure_typed_mask_relation
from agents.yf_arc3_v5.logos.types import FrozenMap


def _scope_current(scope):
    return (scope.epoch == scope.support_epoch and scope.revision_ref == scope.support_revision_ref
        and scope.scope_ref == scope.support_scope_ref and bool(scope.current_evidence_refs)
        and bool(scope.premise_refs) and bool(scope.falsifier_refs))


def _point(point):
    return (point.row, point.column, point.depth)


def _typed_relation(request, scope):
    measured = measure_typed_mask_relation(request)
    qualified = (_scope_current(scope) and request.parent_goal_ref == scope.parent_goal_ref
        and request.consumer_ref == scope.consumer_ref
        and request.epoch == scope.epoch and request.revision_ref == scope.revision_ref
        and all(measured.facts[name] for name in ("scope_current", "requested_mask_kinds_present",
            "prediction_support_present", "requested_semantic_support_current"))
        and not measured.facts["budget_reached"])
    return measured, qualified


def measure_transit_shape(value: TransitShapeInputC) -> StructuralSuppositionFactsC:
    rows, qualified, answers, visits = [], [], [], 0
    contracts = (
        ("CURRENT_OPENING", value.current_opening_relation, "SUBSET", value.current_shape_ref, value.opening_ref),
        ("TRANSIT_OPENING", value.transit_opening_relation, "SUBSET", value.transit_shape_ref, value.opening_ref),
        ("TRANSIT_TERMINAL", value.transit_terminal_relation, "EQUAL", value.transit_shape_ref, value.terminal_shape_ref))
    for role, request, operator, left_owner, right_owner in contracts:
        measured, scoped = _typed_relation(request, value.scope)
        visits += measured.actual_input_support_point_visits
        contract_exact = (request.operator == operator and request.left.owner_ref == left_owner
            and request.right.owner_ref == right_owner
            and request.current_model_assignment_ref == value.model_assignment_ref
            and request.required_left_kind in ("OCCUPIED_BODY", "COLLISION")
            and (role == "TRANSIT_TERMINAL" or request.required_right_kind == "RECEIVING_APERTURE"))
        qualified.append(scoped and contract_exact)
        answer = measured.geometric_relation_value if scoped and contract_exact else None
        answers.append(answer)
        rows.append(FrozenMap({"role_ref": role, "relation_ref": request.relation_ref,
            "typed_contract_qualified": scoped and contract_exact, "geometric_relation_value": answer,
            "physical_traversal_or_acceptance_proved": False}))
    return StructuralSuppositionFactsC(measurements=tuple(rows), actual_support_point_visits=visits,
        actual_comparisons=3, facts=FrozenMap({"scope_current": _scope_current(value.scope),
            "typed_relations_qualified": all(qualified), "budget_reached": any(
                len(request.left.support)+len(request.right.support) > request.max_input_support_points
                for _, request, _, _, _ in contracts),
            "current_fits_opening": answers[0], "transit_fits_opening": answers[1],
            "transit_equals_terminal": answers[2],
            "restoration_dependency_present": value.restoration_dependency_ref is not None,
            "restoration_method_supported": value.restoration_method_ref is not None
                and bool(value.restoration_premise_refs) and bool(value.restoration_falsifier_refs),
            "parent_terminal_contract_ref": value.parent_terminal_contract_ref,
            "transit_must_not_replace_parent_terminal": True}))


def measure_layer_contact(value: LayerContactInputC) -> StructuralSuppositionFactsC:
    scope = value.scope
    current = _scope_current(scope)
    memory_ids = tuple(memory.memory_ref for memory in value.memories)
    memories = {memory.memory_ref: memory for memory in value.memories}
    original_points = sum(len(mask.support) for memory in value.memories for mask in memory.original_masks)
    projected_points = sum(len(row.projected_mask.support) for row in value.projections)
    relation_points = sum(len(row.visible_relation.left.support)+len(row.visible_relation.right.support)
        for row in value.projections if row.visible_relation is not None)
    bounded = original_points+projected_points+relation_points > value.max_support_points
    rows, visits, comparisons = [], 0, 0
    for projection in value.projections:
        memory = memories.get(projection.memory_ref)
        matches = tuple(mask for mask in memory.original_masks if mask.mask_ref == projection.original_mask_ref) if memory else ()
        original = matches[0] if len(matches) == 1 else None
        projected = projection.projected_mask
        memory_current = (current and memory is not None and original is not None
            and memory.episode_ref == scope.episode_ref and memory.scope_ref == scope.scope_ref
            and memory.acquired_epoch <= scope.epoch and bool(memory.acquisition_evidence_refs)
            and original.epoch <= memory.acquired_epoch and bool(original.evidence_refs)
            and original.owner_ref == memory.owner_ref and projected.owner_ref == memory.owner_ref
            and projected.epoch == scope.epoch and projected.revision_ref == scope.revision_ref
            and original.coordinate_basis_ref == projected.coordinate_basis_ref
            and original.kind == projected.kind and bool(projection.pose_premise_refs)
            and bool(projection.pose_falsifier_refs))
        shape_equal, visible, observed_scoped = None, None, False
        required_visits = (len(original.support)+len(projected.support) if original is not None else 0)
        if projection.visible_relation is not None:
            required_visits += len(projection.visible_relation.left.support)+len(projection.visible_relation.right.support)
        if visits+required_visits > value.max_support_points:
            bounded = True
        if memory_current and not bounded:
            dr, dc, dd = projection.translation
            depth_compatible = all((point.depth is None and dd is None) or (point.depth is not None and dd is not None)
                for point in original.support)
            if depth_compatible:
                expected = {(point.row+dr, point.column+dc, None if point.depth is None else point.depth+dd)
                    for point in original.support}
                actual = {_point(point) for point in projected.support}
                shape_equal = expected == actual if original.support_complete and projected.support_complete else None
                visits += len(original.support)+len(projected.support)
                comparisons += 1
            if projection.visible_relation is not None:
                relation = projection.visible_relation
                measured, scoped = _typed_relation(relation, scope)
                visits += measured.actual_input_support_point_visits
                comparisons += 1
                observed_scoped = (scoped and relation.operator == "SUBSET" and relation.right == projected
                    and relation.left.owner_ref == memory.owner_ref
                    and bool(projection.visible_pixel_ownership_evidence_refs))
                visible = measured.geometric_relation_value if observed_scoped else None
        rows.append(FrozenMap({"projection_ref": projection.projection_ref, "memory_ref": projection.memory_ref,
            "memory_current": memory_current, "original_shape_under_translation_equal": shape_equal,
            "original_mask_binding_unique": len(matches) == 1,
            "owned_visible_subset_value": visible, "owned_visible_relation_qualified": observed_scoped,
            "occlusion_evidence_refs": projection.occlusion_evidence_refs,
            "selection_rendering_evidence_refs": projection.selection_rendering_evidence_refs,
            "disappearance_evidence_refs": projection.disappearance_evidence_refs,
            "original_memory_replaced_or_identity_destroyed": False}))
    for example in value.motion_examples:
        qualified = (current and example.episode_ref == scope.episode_ref and example.scope_ref == scope.scope_ref
            and example.epoch <= scope.epoch and example.sealed_observation and bool(example.evidence_refs)
            and example.first_owner_ref != example.second_owner_ref)
        same = example.first_delta == example.second_delta and example.first_delta != (0, 0)
        exclusive = (example.direct_input_inventory_complete
            and example.direct_input_owner_refs in ((example.first_owner_ref,), (example.second_owner_ref,)))
        rows.append(FrozenMap({"example_ref": example.example_ref, "motion_scope_qualified": qualified,
            "common_nonzero_motion": qualified and same,
            "one_owner_direct_input_only": qualified and exclusive,
            "synchronized_direct_inputs": qualified and example.direct_input_inventory_complete
                and len(set(example.direct_input_owner_refs)) > 1,
            "attachment_relation_ref": example.attachment_relation_ref,
            "independent_attachment_relation_value": example.attachment_relation_value
                if qualified and example.attachment_relation_ref is not None and example.attachment_evidence_refs
                and example.excluded_competing_cause_refs else None,
            "attachment_inferred_from_common_motion": False}))
        comparisons += 1
    return StructuralSuppositionFactsC(measurements=tuple(rows), actual_support_point_visits=visits,
        actual_comparisons=comparisons, facts=FrozenMap({"scope_current": current, "budget_reached": bounded,
            "unique_memory_refs": len(memories) == len(memory_ids), "memory_present": bool(value.memories),
            "original_masks_and_attributes_retained": True, "all_projection_and_motion_hypotheses_retained": True,
            "common_motion_never_attachment_by_itself": True}))


def measure_visible_graph(value: VisibleGraphInputC) -> StructuralSuppositionFactsC:
    scope, rows = value.scope, []
    current = _scope_current(scope)
    port_ids, stroke_ids = tuple(port.port_ref for port in value.ports), tuple(row.stroke_ref for row in value.strokes)
    points = sum(len(port.support) for port in value.ports)+sum(len(stroke.ordered_trace) for stroke in value.strokes)
    bounded = points > value.max_support_points
    ports = {port.port_ref: port for port in value.ports}
    supports = {port.port_ref: {_point(point) for point in port.support} for port in value.ports} if not bounded else {}
    visits, comparisons, pairs = 0 if bounded else points, 0, 0
    for stroke in value.strokes:
        if bounded:
            break
        trace = tuple(_point(point) for point in stroke.ordered_trace)
        scoped = (current and stroke.epoch == scope.epoch and stroke.revision_ref == scope.revision_ref
            and stroke.native_frame_ref == value.native_frame_ref and stroke.coordinate_basis_ref == value.coordinate_basis_ref
            and bool(stroke.trace_evidence_refs) and bool(value.connection_convention_evidence_refs))
        contiguous = len(trace) >= 2 and len(set(trace)) == len(trace)
        if contiguous and value.coordinate_basis_kind == "LOGICAL_CELL_3D" and any(point[2] is None for point in trace):
            contiguous = None
        for first, second in zip(trace, trace[1:]):
            if comparisons >= value.max_endpoint_comparisons:
                bounded = True
                break
            comparisons += 1
            if (first[2] is None) != (second[2] is None):
                contiguous = None if contiguous is not False else False
            else:
                delta = (second[0]-first[0], second[1]-first[1], 0 if first[2] is None else second[2]-first[2])
                if delta not in value.adjacency_offsets:
                    contiguous = False
        separators = set(stroke.crossed_separator_refs).issubset(stroke.licensed_separator_crossing_refs)
        first_hits, second_hits = [], []
        if scoped and contiguous and not bounded:
            for port in value.ports:
                if comparisons+2 > value.max_endpoint_comparisons:
                    bounded = True
                    break
                comparisons += 2
                port_current = (port.epoch == scope.epoch and port.revision_ref == scope.revision_ref
                    and port.native_frame_ref == value.native_frame_ref and port.coordinate_basis_ref == value.coordinate_basis_ref
                    and bool(port.endpoint_evidence_refs) and port.domain_ref == stroke.domain_ref)
                if port_current and trace[0] in supports[port.port_ref]:
                    first_hits.append(port.port_ref)
                if port_current and trace[-1] in supports[port.port_ref]:
                    second_hits.append(port.port_ref)
        rows.append(FrozenMap({"stroke_ref": stroke.stroke_ref, "trace_scope_qualified": scoped,
            "trace_contiguous_under_declared_convention": contiguous,
            "separator_crossings_licensed": separators, "first_endpoint_port_refs": tuple(first_hits),
            "second_endpoint_port_refs": tuple(second_hits), "unresolved_junction_refs": stroke.unresolved_junction_refs,
            "endpoint_inventory_complete": not bounded}))
        if scoped and contiguous and separators and not bounded:
            for first_ref in first_hits:
                for second_ref in second_hits:
                    if pairs >= value.max_endpoint_pairs:
                        bounded = True
                        break
                    pairs += 1
                    first, second = ports[first_ref], ports[second_ref]
                    rows.append(FrozenMap({"stroke_ref": stroke.stroke_ref, "first_port_ref": first_ref,
                        "second_port_ref": second_ref, "first_node_ref": first.node_ref,
                        "second_node_ref": second.node_ref, "same_node": first.node_ref == second.node_ref,
                        "first_direction": first.direction if first.direction_evidence_refs else "UNKNOWN",
                        "second_direction": second.direction if second.direction_evidence_refs else "UNKNOWN",
                        "first_root_evidence_refs": first.root_evidence_refs,
                        "second_root_evidence_refs": second.root_evidence_refs,
                        "endpoint_pair_ambiguous": len(first_hits) != 1 or len(second_hits) != 1
                            or bool(stroke.unresolved_junction_refs), "causal_edge_confirmed": False}))
                if bounded:
                    break
    for control in value.homologous_controls:
        if comparisons >= value.max_endpoint_comparisons:
            bounded = True
            break
        comparisons += 1
        first, second = ports.get(control.first_port_ref), ports.get(control.second_port_ref)
        qualified = (current and not bounded and control.epoch == scope.epoch and control.revision_ref == scope.revision_ref
            and first is not None and second is not None
            and all(port.epoch == scope.epoch and port.revision_ref == scope.revision_ref
                and port.native_frame_ref == value.native_frame_ref and port.coordinate_basis_ref == value.coordinate_basis_ref
                and bool(port.endpoint_evidence_refs) for port in (first, second))
            and (first.domain_ref == second.domain_ref or (control.cross_domain_contract_ref is not None
                and bool(control.cross_domain_evidence_refs))) and control.shared_channel_ref is not None
            and bool(control.shared_channel_evidence_refs))
        rows.append(FrozenMap({"control_evidence_ref": control.evidence_ref,
            "first_port_ref": control.first_port_ref, "second_port_ref": control.second_port_ref,
            "shared_channel_ref": control.shared_channel_ref, "shared_channel_scope_qualified": qualified,
            "causal_edge_confirmed": False}))
    return StructuralSuppositionFactsC(measurements=tuple(rows), actual_support_point_visits=visits,
        actual_comparisons=comparisons, facts=FrozenMap({"scope_current": current, "budget_reached": bounded,
            "unique_port_and_stroke_refs": len(set(port_ids)) == len(port_ids) and len(set(stroke_ids)) == len(stroke_ids),
            "explicit_endpoint_or_channel_evidence_present": any(row.get("shared_channel_scope_qualified") is True
                or (row.get("trace_scope_qualified") is True and row.get("trace_contiguous_under_declared_convention") is True
                    and row.get("separator_crossings_licensed") is True and row.get("endpoint_inventory_complete") is True
                    and bool(row.get("first_endpoint_port_refs")) and bool(row.get("second_endpoint_port_refs"))) for row in rows),
            "measured_endpoint_pairs": pairs,
            "adjacency_alone_never_creates_causal_edge": True}))


def assemble_structural_supposition(value: StructuralSuppositionDecisionInputC) -> StructuralSuppositionDecisionC:
    return StructuralSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
