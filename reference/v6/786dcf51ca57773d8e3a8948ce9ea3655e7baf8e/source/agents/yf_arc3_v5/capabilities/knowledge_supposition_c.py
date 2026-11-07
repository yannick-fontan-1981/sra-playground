"""Memory and ordinals preserve provenance; Source owns interpretations and permissions."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .knowledge_supposition_contracts_c import (InventoryNavigationSuppositionInputC, LineageSuppositionInputC,
    FiniteNetworkSuppositionInputC, TemporalReferenceSuppositionInputC, FeedbackIdentificationSuppositionInputC,
    KnowledgeSuppositionFactsC, KnowledgeSuppositionDecisionInputC, KnowledgeSuppositionDecisionC)
from .structural_supposition_c import _scope_current, _typed_relation, _point, measure_visible_graph
from .entry_memory_c import measure_entry_memory
from .production_supposition_c import _native_binding_current, _normalized_pattern, _graph_pairs
from .transport_supposition_c import _observation_current
from .finite_relation_network import measure_finite_relation_network
from .feedback_code_identification import measure_feedback_code_identification


def measure_inventory_navigation_supposition(value: InventoryNavigationSuppositionInputC) -> KnowledgeSuppositionFactsC:
    current = _scope_current(value.scope)
    entry = measure_entry_memory(value.inventory)
    request = value.inventory
    scoped = (current and request.parent_goal_ref == value.scope.parent_goal_ref and request.episode_ref == value.scope.episode_ref
        and request.epoch == value.scope.epoch and request.revision_ref == value.scope.revision_ref
        and request.scope_ref == value.scope.scope_ref and request.next_contribution_ref == value.inventory_next_contribution_ref
        and bool(value.inventory_consumer_binding_evidence_refs))
    fields = {item.field_ref: item for item in entry.measured_fields}
    bindings_unique = len({item.slot_ref for item in value.identity_bindings}) == len(value.identity_bindings)
    rows = []
    for binding in value.identity_bindings:
        field = fields.get(binding.field_ref)
        bound = (scoped and bindings_unique and bool(binding.independent_binding_evidence_refs)
            and field is not None and field.facts["scope_current"] and field.facts["current_field_unique"]
            and field.facts["current_identity_supported"] and field.observed[0].owner_ref == binding.field_owner_ref)
        actual = field.observed[0].value == binding.possession_value if bound and field.facts["actual_content_evidenced"] else None
        persisted = (all(item.value == binding.possession_value for item in field.persistence_candidates)
            if bound and field.facts["persistence_value_unambiguous"] else None)
        rows.append(FrozenMap({"slot_ref": binding.slot_ref, "field_ref": binding.field_ref,
            "key_identity_ref": binding.key_identity_ref, "binding_qualified": bound,
            "observed_equals_possession_value": actual, "persistent_memory_equals_possession_value": persisted,
            "observed_memory_conflict": actual is not None and persisted is not None and actual != persisted,
            "slot_is_key_identity_by_appearance": False, "permission_to_cross_confirmed": False}))
    return KnowledgeSuppositionFactsC(entry_measurement=entry, measurements=tuple(rows),
        facts=FrozenMap({"scope_current": current, "map_cutout_inventory_question_supported": scoped
            and bool(value.map_object_cutout_evidence_refs) and bool(value.separate_finite_inventory_evidence_refs),
            "masked_or_missing_inventory_drawing_means_no_possession": False, "permission_law_confirmed": False}))


def measure_lineage_supposition(value: LineageSuppositionInputC) -> KnowledgeSuppositionFactsC:
    current = _scope_current(value.scope)
    first, first_current = _typed_relation(value.parent_contour_relation, value.scope)
    whole, whole_current = _typed_relation(value.union_composite_equal, value.scope)
    a, b = value.parent_contour_relation.left, value.parent_contour_relation.right
    union, composite = value.union_composite_equal.left, value.union_composite_equal.right
    same_basis = all(getattr(mask, field) == getattr(a, field)
        for mask in (b, union, composite) for field in ("scene_ref", "native_frame_ref", "coordinate_basis_ref"))
    roles = (value.first_parent_ref != value.second_parent_ref and a.owner_ref == value.first_parent_ref
        and b.owner_ref == value.second_parent_ref and union.owner_ref == value.union_projection_ref
        and composite.owner_ref == value.composite_ref and
        all(mask.kind == "RECOGNITION" for mask in (a, b, union, composite)))
    union_points = len(a.support) + len(b.support) + len(union.support)
    union_open = union_points > value.max_union_input_points
    complementary_parts = False
    if (first_current and whole_current and same_basis and roles and not union_open
            and value.parent_contour_relation.operator in ("DISJOINT", "INTERSECTS")
            and first.geometric_relation_value is not None
            and value.union_composite_equal.operator == "EQUAL" and whole.geometric_relation_value is True):
        left = {_point(point) for point in a.support}
        right = {_point(point) for point in b.support}
        complementary_parts = bool(left - right) and bool(right - left) and (
            {_point(point) for point in union.support} == left | right)
    complement = complementary_parts
    declared_slots = sum(len(domain.original_ordinals) for item in value.marks for unit in (item.first, item.second)
        for domain in unit.sequence.domain_alternatives)
    bounded = declared_slots > value.max_total_mark_slots
    rows, indexed = [], []
    if not bounded:
        for item in value.marks:
            before, left = _normalized_pattern(item.first, value.scope)
            after, right = _normalized_pattern(item.second, value.scope)
            indexed.extend((before, after))
            supported = (left is not None and right is not None and bool(item.stable_mark_order_evidence_refs)
                and bool(item.compatibility_role_evidence_refs) and item.first.comparison_basis_ref == item.second.comparison_basis_ref
                and set(left) == set(right))
            rows.append(FrozenMap({"first_unit_ref": item.first.unit_ref, "second_unit_ref": item.second.unit_ref,
                "ordered_internal_marks_equal": left == right if supported else None,
                "whole_mark_domains_qualified": supported, "external_appearance_is_required_for_mark_identity": False}))
    return KnowledgeSuppositionFactsC(mask_measurements=(first, whole), indexed_measurements=tuple(indexed), measurements=tuple(rows),
        actual_projected_slot_count=sum(item.actual_projected_slot_count for item in indexed),
        facts=FrozenMap({"scope_current": current, "complementary_lineage_receptacle_question_supported": current and complement
            and bool(value.descendant_seed_evidence_refs) and bool(value.matching_receptacle_evidence_refs),
            "mark_domain_open": bounded or any(item.remaining_domain_refs for item in indexed)
                or any(not row["whole_mark_domains_qualified"] for row in rows),
            "union_domain_open": union_open, "union_input_point_count": union_points,
            "physical_production_or_lineage_identity_law_confirmed": False}))


def measure_finite_network_supposition(value: FiniteNetworkSuppositionInputC) -> KnowledgeSuppositionFactsC:
    current = _scope_current(value.scope)
    graph = measure_visible_graph(value.graph)
    scoped = current and value.graph.scope == value.scope
    unique_outputs = len({row.output_ref for row in value.requested_outputs}) == len(value.requested_outputs)
    rows = tuple(FrozenMap({"output_ref": item.output_ref, "desired_value": item.desired_value
        if scoped and unique_outputs and item.independent_goal_evidence_refs else None})
        for item in value.requested_outputs)
    native = measure_finite_relation_network(value.native_ports) if _native_binding_current(
        value, value.native_ports, value.native_binding, ("ports_and_wires",)) else None
    return KnowledgeSuppositionFactsC(graph_measurement=graph, native_measurement=native, measurements=rows,
        facts=FrozenMap({"scope_current": current, "composed_network_question_supported": scoped and bool(_graph_pairs(graph))
            and bool(value.repeated_switch_input_evidence_refs) and bool(value.differentiated_component_evidence_refs)
            and bool(value.terminal_lamp_evidence_refs), "graph_domain_open": bool(graph.facts["budget_reached"]),
            "desired_false_output_refs": tuple(row["output_ref"] for row in rows if row["desired_value"] is False),
            "all_switches_active_is_required_by_appearance": False, "monotonic_output_improvement_required": False,
            "network_relation_or_assignment_law_confirmed": False}))


def _population_current(item, scope, bound):
    return (_scope_current(scope) and item.episode_ref == scope.episode_ref and item.observed_epoch <= scope.epoch
        and item.actual_sealed_observation and bool(item.acquisition_evidence_refs)
        and item.recall_epoch == scope.epoch and item.recall_revision_ref == scope.revision_ref
        and item.recall_scope_ref == scope.scope_ref and bool(item.current_recall_evidence_refs)
        and bool(item.normalization_evidence_refs) and item.inventory_complete and len(item.population) <= bound)


def measure_temporal_reference_supposition(value: TemporalReferenceSuppositionInputC) -> KnowledgeSuppositionFactsC:
    current = _scope_current(value.scope)
    previous, present = value.previous, value.current
    scoped = (_population_current(previous, value.scope, value.max_population_items)
        and _population_current(present, value.scope, value.max_population_items)
        and present.observed_epoch == value.scope.epoch
        and previous.scene_ref != present.scene_ref and previous.chronological_ordinal < present.chronological_ordinal
        and previous.comparison_schema_ref == present.comparison_schema_ref)
    designated = previous if value.invitation_designated_scene_ref == previous.scene_ref else (
        present if value.invitation_designated_scene_ref == present.scene_ref else None)
    contents = (scoped and designated is not None and bool(value.invitation_content_evidence_refs)
        and bool(value.invitation_content_refs) and len(set(value.invitation_content_refs)) == len(value.invitation_content_refs)
        and set(value.invitation_content_refs) <= set(designated.population))
    # Compare normalized descriptors, not changing scene-local object handles.
    before = tuple(sorted(previous.population.values(), key=stable_digest)) if scoped else ()
    after = tuple(sorted(present.population.values(), key=stable_digest)) if scoped else ()
    return KnowledgeSuppositionFactsC(measurements=(FrozenMap({"previous_scene_ref": previous.scene_ref,
        "current_scene_ref": present.scene_ref, "whole_normalized_populations_qualified": scoped,
        "population_multisets_equal": before == after if scoped else None,
        "invitation_content_refs": value.invitation_content_refs, "invitation_contents_qualified": contents,
        "contour_is_memorized_object_identity": False}),), facts=FrozenMap({"scope_current": current,
        "previous_scene_relation_question_supported": scoped and contents
            and bool(value.temporary_enclosing_invitation_evidence_refs)
            and bool(value.accumulating_progress_indicator_evidence_refs),
        "population_domain_open": len(previous.population) > value.max_population_items or len(present.population) > value.max_population_items,
        "temporal_selection_or_acceptance_law_confirmed": False}))


def measure_feedback_identification_supposition(value: FeedbackIdentificationSuppositionInputC) -> KnowledgeSuppositionFactsC:
    current = _scope_current(value.scope)
    declared = sum(len(domain.original_ordinals) for unit in (value.proposal, value.revealed) for domain in unit.sequence.domain_alternatives)
    bounded = declared > value.max_total_projected_slots
    indexed, proposal, revealed = [], None, None
    if not bounded:
        first, proposal = _normalized_pattern(value.proposal, value.scope)
        second, revealed = _normalized_pattern(value.revealed, value.scope)
        indexed.extend((first, second))
    distinct = (current and bool(value.proposal_reveal_role_evidence_refs) and value.proposal.unit_ref != value.revealed.unit_ref
        and value.proposal.comparison_basis_ref == value.revealed.comparison_basis_ref)
    rows = []
    proposal_request = value.proposal.sequence
    proposal_domain = None
    if (not bounded and indexed[0].facts["scope_current"] and not indexed[0].remaining_domain_refs
            and len(indexed[0].projections) == 1 and proposal_request.parent_goal_ref == value.scope.parent_goal_ref
            and proposal_request.consumer_ref == value.scope.consumer_ref and proposal_request.epoch == value.scope.epoch
            and proposal_request.revision_ref == value.scope.revision_ref and proposal_request.scope_ref == value.scope.scope_ref):
        proposal_domain = indexed[0].projections[0].domain
    trials_unique = len({trial.trial_ref for trial in value.trials}) == len(value.trials)
    for trial in value.trials:
        ordinals = trial.submitted_ordinals
        feedback = tuple(item.ordinal for item in trial.feedback)
        complete = (_observation_current(trial, value.scope) and trials_unique and distinct
            and proposal_domain is not None and bool(proposal_domain.evidence_refs)
            and set(ordinals) == set(proposal_domain.original_ordinals)
            and trial.complete_submission and bool(trial.submission_evidence_refs)
            and trial.actual_feedback_inventory_complete and bool(trial.feedback_response_evidence_refs)
            and bool(ordinals) and len(ordinals) == len(trial.submitted_values) and len(set(ordinals)) == len(ordinals)
            and len(set(feedback)) == len(feedback) and set(feedback) == set(ordinals)
            and all(item.observed_value_ref is not None and item.feedback_identity_evidence_refs for item in trial.feedback))
        rows.append(FrozenMap({"trial_ref": trial.trial_ref, "complete_trial_feedback_qualified": complete,
            "submitted_ordinals": ordinals, "submitted_values": trial.submitted_values,
            "feedback_by_ordinal": FrozenMap({str(item.ordinal): item.observed_value_ref for item in trial.feedback}) if complete else FrozenMap(),
            "feedback_accounting_law_confirmed": False}))
    same_domain = distinct and proposal is not None and revealed is not None and set(proposal) == set(revealed)
    rows.append(FrozenMap({"proposal_unit_ref": value.proposal.unit_ref, "revealed_unit_ref": value.revealed.unit_ref,
        "proposal_equals_revealed": proposal == revealed if same_domain else None,
        "revealed_knowledge_is_entered_by_revelation": False}))
    native = measure_feedback_code_identification(value.native_layers) if _native_binding_current(
        value, value.native_layers, value.native_binding, ("proposal_feedback_layers",)) else None
    return KnowledgeSuppositionFactsC(measurements=tuple(rows), indexed_measurements=tuple(indexed), native_measurement=native,
        actual_projected_slot_count=sum(item.actual_projected_slot_count for item in indexed),
        facts=FrozenMap({"scope_current": current, "hidden_sequence_trial_question_supported": distinct
            and bool(value.selectable_sample_evidence_refs) and bool(value.ordered_proposal_slot_evidence_refs)
            and bool(value.submit_control_evidence_refs) and bool(value.separate_revealed_row_evidence_refs)
            and bool(value.per_position_feedback_evidence_refs),
            "slot_domain_open": bounded or any(item.remaining_domain_refs for item in indexed),
            "proposal_reveal_and_trial_feedback_separate": True, "identification_or_submission_law_confirmed": False}))


def assemble_knowledge_supposition(value: KnowledgeSuppositionDecisionInputC) -> KnowledgeSuppositionDecisionC:
    return KnowledgeSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
