"""K03 folds exact externally produced STEP packets; it never simulates twice."""
from .mechanical_common_contracts_c import (
    SimulationPathInputC, EventCompositionInputC, CounterfactualPathInputC,
    CounterfactualPathResultC,
)
from .mechanical_event_composition_c import compose_mechanical_events
from agents.yf_arc3_v5.logos.types import FrozenMap
from .counterfactual_scope_d import measure_counterfactual_scope_d


def fold_mechanical_path(value: SimulationPathInputC):
    aligned = len(value.packets) <= len(value.word) and all(
        packet.action_ref == action for packet, action in zip(value.packets, value.word))
    composed = compose_mechanical_events(EventCompositionInputC(
        request=value.request, initial=value.initial,
        packets=value.packets if aligned else (), predicates=value.predicates,
        relation_bindings=value.relation_bindings,
        consumed_request_refs=value.consumed_request_refs,
        acceptance_boundaries=value.acceptance_boundaries, declared_event_order=value.declared_event_order))
    missing = set(composed.missing_refs)
    if not aligned:
        missing.add("ordered_external_word")
    elif composed.packet_cursor < len(value.word) and composed.interruption_ref is None:
        missing.add("next_external_step")
    complete = composed.complete and not missing
    return composed.model_copy(update={"complete": complete,
        "missing_refs": tuple(sorted(missing)), "facts": FrozenMap.overlay({
            "complete": complete, "missing_measurement": bool(missing),
            "word_length": len(value.word), "remaining_primitive_count":
                max(0, len(value.word)-composed.packet_cursor)}, composed.facts)})


def compare_counterfactual_paths(value: CounterfactualPathInputC) -> CounterfactualPathResultC:
    same_initial = (value.original.initial == value.edited.initial
        and value.original.request.model_assignments == value.edited.request.model_assignments
        and value.original.request.input_revision_ref == value.edited.request.input_revision_ref
        and value.original.request.epoch == value.edited.request.epoch)
    first_request, second_request = value.original.request, value.edited.request
    inputs_equal = first_request.immutable_inputs == second_request.immutable_inputs
    if value.word_input_ref is not None:
        word_ref = value.word_input_ref
        inputs_equal = (first_request.immutable_inputs.get(word_ref) == value.original.word
            and second_request.immutable_inputs.get(word_ref) == value.edited.word
            and {key: first_request.immutable_inputs[key] for key in sorted(first_request.immutable_inputs) if key != word_ref}
                == {key: second_request.immutable_inputs[key] for key in sorted(second_request.immutable_inputs) if key != word_ref})
    same_scope = (same_initial and inputs_equal and first_request.mode == second_request.mode == "PATH"
        and len({p.predicate_ref for p in value.original.predicates}) == len(value.original.predicates)
        and len({p.predicate_ref for p in value.edited.predicates}) == len(value.edited.predicates)
        and all(getattr(first_request, name) == getattr(second_request, name) for name in (
            "caller_ref", "parent_contribution_ref", "kernel_ref", "operation_ref",
            "actual_bounds", "expected_return_type", "requested_domain_ref")))
    original = fold_mechanical_path(value.original)
    edited = fold_mechanical_path(value.edited)
    edit_measurement=measure_counterfactual_scope_d(value,original,edited)
    if value.edit_scope is not None:
        same_scope=same_scope and edit_measurement['scoped_group_comparison_complete']
    first = next((i for i, (a, b) in enumerate(zip(original.events, edited.events)) if a != b), None)
    if first is None and len(original.events) != len(edited.events):
        first = min(len(original.events), len(edited.events))
    # A common endpoint is never sufficient to certify the erased suffix.
    re_evaluated = tuple(sorted({p.predicate_ref for p in value.original.predicates
        if p in value.edited.predicates})) if same_scope and original.complete and edited.complete else ()

    def effects(path, result):
        by_instance = {}
        for packet in path.packets:
            for event in packet.events:
                # Only the instance identifiers are omitted. Producer, clock,
                # temporal scope, actual snapshot and every effect remain exact.
                by_instance.setdefault(event.occurrence_ref, (event.producer_ref, event.kind_ref,
                    event.clock_ref, event.tick, event.temporal_scope_ref, event.snapshot_kind,
                    event.snapshot_ref in packet.snapshots, packet.snapshots.get(event.snapshot_ref),
                    event.reads, event.writes, event.deleted_state_refs, event.costs,
                    event.predicate_values, event.interruption_ref))
        return tuple(by_instance[event.occurrence_ref] for event in result.events)

    original_effects, edited_effects = effects(value.original, original), effects(value.edited, edited)
    first_effect = next((i for i, (a, b) in enumerate(zip(original_effects, edited_effects)) if a != b), None)
    if first_effect is None and len(original_effects) != len(edited_effects):
        first_effect = min(len(original_effects), len(edited_effects))
    return CounterfactualPathResultC(frozen_request=value, original=original, edited=edited,
        re_evaluated_predicate_refs=re_evaluated, first_changed_event_index=first,
        endpoint_equal=original.state == edited.state, cost_delta=edited.cost-original.cost,
        initial_and_model_equal=same_initial, comparison_scope_equal=same_scope,
        first_changed_effect_index=first_effect,edit_scope_measurement=edit_measurement)
