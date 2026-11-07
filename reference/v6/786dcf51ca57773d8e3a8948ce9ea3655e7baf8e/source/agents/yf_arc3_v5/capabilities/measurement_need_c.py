"""Measure current gaps and needed distinctions; do not select a catalogue or promise a solution."""
from .measurement_need_contracts_c import (MorphologicalBottleneckInputC, MorphologicalBottleneckFactsC,
    MorphologicalBottleneckDecisionInputC, MorphologicalBottleneckDecisionC, ConsumerMeasurementNeedInputC,
    ConsumerMeasurementNeedFactsC, ConsumerMeasurementNeedDecisionInputC, ConsumerMeasurementNeedDecisionC)
from .structural_supposition_c import _scope_current
from .mechanical_event_composition_c import predicate_value
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_morphological_bottleneck(value: MorphologicalBottleneckInputC) -> MorphologicalBottleneckFactsC:
    scope, route = value.scope, value.closed_route
    current = _scope_current(scope)
    qualified = current and bool(value.semantic_support_refs)
    condition = None
    if value.kind != "INACCESSIBLE_REGION" and qualified and value.condition is not None:
        if value.condition.field_ref not in value.unknown_field_refs:
            condition = predicate_value(value.condition, value.measured_values)
    expected_context = FrozenMap({"parent_goal_ref": scope.parent_goal_ref,
        "consumer_ref": scope.consumer_ref, "episode_ref": scope.episode_ref,
        "scope_ref": scope.scope_ref, "epoch": scope.epoch, "input_revision_ref": scope.revision_ref})
    route_context_exact = (route is not None and value.route_expected_request is not None
        and route.request == value.route_expected_request
        and route.request.immutable_inputs.get("consumer_context") == expected_context
        and bool(value.route_goal_binding_evidence_refs))
    route_qualified = (qualified and route is not None and route.request.mode == "ROUTE"
        and route_context_exact
        and bool(route.request.model_assignments)
        and route.request.kernel_ref == "mechanics.bounded_route_search"
        and route.request.operation_ref == "mechanics.bounded_route_search"
        and route.request.expected_return_type == "SearchResultC"
        and route.request.epoch == scope.epoch and route.request.input_revision_ref == scope.revision_ref
        and value.route_goal_contract_ref is not None and bool(value.route_goal_binding_evidence_refs)
        and route.request.immutable_inputs.get("source_goal_contract_ref") == value.route_goal_contract_ref)
    closed_no_route = (route_qualified and route.complete and not route.bounded and not route.contradictory
        and not route.missing_refs and not route.requested_steps and route.declared_domain_size is not None
        and not route.witnesses)
    gap = closed_no_route if value.kind == "INACCESSIBLE_REGION" else condition is False
    return MorphologicalBottleneckFactsC(measured_condition_value=condition,
        retained_model_assignments=route.request.model_assignments if route is not None else FrozenMap(),
        facts=FrozenMap({"scope_current": current, "measurement_semantics_supported": qualified,
            "required_for_current_consumer": value.required_for_current_consumer and bool(value.dependency_evidence_refs),
            "condition_gap_observed": gap, "route_scope_qualified": route_qualified,
            "route_consumer_context_exact": route_context_exact,
            "route_domain_closed_without_witness": closed_no_route,
            "condition_known": condition is not None,
            "enabling_condition_ref": value.enabling_condition_ref, "mechanism_question_ref": value.mechanism_question_ref,
            "unseen_solution_proved": False, "physical_transformation_confirmed": False}))


def assemble_morphological_bottleneck(value: MorphologicalBottleneckDecisionInputC) -> MorphologicalBottleneckDecisionC:
    return MorphologicalBottleneckDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)


def measure_consumer_measurement_need(value: ConsumerMeasurementNeedInputC) -> ConsumerMeasurementNeedFactsC:
    scope, extension = value.scope, value.extension
    demand = extension.exact_demand
    current = (_scope_current(scope) and demand.parent_goal_ref == scope.parent_goal_ref
        and demand.consumer_ref == scope.consumer_ref and demand.episode_ref == scope.episode_ref
        and demand.scope_ref == scope.scope_ref and demand.request.epoch == scope.epoch
        and demand.request.input_revision_ref == scope.revision_ref
        and extension.current_consumer_ref == scope.consumer_ref
        and extension.current_input_revision_ref == scope.revision_ref and extension.current_scope_ref == scope.scope_ref
        and bool(extension.current_consumer_evidence_refs) and extension.necessary_for_consumer)
    dimensions = value.dimension_refs
    goal_supported = (current and value.required_effect_dependency_ref is not None
        and bool(value.goal_dependency_evidence_refs))
    goal_dimensions = value.goal_required_dimension_refs if goal_supported else ()
    qualified, unqualified = [], []
    for prediction in value.predictions:
        if (current and prediction.alternative_ref in value.live_alternative_refs
                and prediction.epoch == scope.epoch and prediction.revision_ref == scope.revision_ref
                and prediction.scope_ref == scope.scope_ref and prediction.evidence_refs):
            qualified.append(prediction)
        else:
            unqualified.append(prediction.alternative_ref)
    unique_predictions = (len({row.alternative_ref for row in qualified}) == len(qualified)
        and len(set(value.live_alternative_refs)) == len(value.live_alternative_refs))
    counts, bounded, discriminating = 0, False, []
    alternative_supported = (current and unique_predictions and value.alternative_decision_dependency_ref is not None
        and bool(value.alternative_dependency_evidence_refs))
    if alternative_supported:
        for dimension in dimensions:
            known = []
            for prediction in qualified:
                if counts >= value.max_dimension_comparisons:
                    bounded = True
                    break
                counts += 1
                result = prediction.predicted_values.get(dimension)
                if result is not None:
                    known.append(result)
            if bounded:
                break
            differs = False
            for result in known[1:]:
                if counts >= value.max_dimension_comparisons:
                    bounded = True
                    break
                counts += 1
                if result != known[0]:
                    differs = True
            if bounded:
                break
            if len(known) >= 2 and differs:
                discriminating.append(dimension)
    needed = set(goal_dimensions) | set(discriminating)
    request_exact = (bool(dimensions) and len(set(dimensions)) == len(dimensions)
        and set(dimensions).issubset(needed)
        and demand.request.immutable_inputs.get("dimension_refs") == dimensions
        and demand.request.immutable_inputs.get("measurement_kind") == value.measurement_kind)
    support_unambiguous = unique_predictions or (bool(dimensions) and set(dimensions).issubset(goal_dimensions))
    continuing = (current and value.validated_continuation_current and value.next_effect_and_preservation_supported
        and value.next_action_payload_bound and not value.continuation_contradicted
        and bool(value.continuation_evidence_refs))
    memo_refs, memo_values = [], []
    memory_ids = tuple(memory.memory_ref for memory in value.geometry_memories)
    if current and request_exact and value.measurement_kind == "STRUCTURAL" and value.current_geometry_binding:
        for memory in value.geometry_memories:
            if counts >= value.max_dimension_comparisons:
                bounded = True
                break
            counts += 1
            bound = (memory.episode_ref == scope.episode_ref and memory.acquired_epoch <= scope.epoch
                and bool(memory.acquisition_evidence_refs) and memory.revalidation_epoch == scope.epoch
                and memory.revalidation_revision_ref == scope.revision_ref
                and memory.revalidation_scope_ref == scope.scope_ref and bool(memory.revalidation_evidence_refs)
                and bool(memory.premise_refs) and bool(memory.falsifier_refs)
                and memory.binding_signature == value.current_geometry_binding)
            for dimension in dimensions:
                if counts >= value.max_dimension_comparisons:
                    bounded = True
                    break
                counts += 1
                if dimension not in memory.measured_values or memory.measured_values[dimension] is None:
                    bound = False
            if bounded:
                break
            if bound:
                memo_refs.append(memory.memory_ref)
                memo_values.append(FrozenMap({dimension: memory.measured_values[dimension] for dimension in dimensions}))
    unique_memories = len(set(memory_ids)) == len(memory_ids)
    unanimous = bool(memo_values) and unique_memories
    for values in memo_values[1:]:
        for dimension in dimensions:
            if counts >= value.max_dimension_comparisons:
                bounded = True
                break
            counts += 1
            if values[dimension] != memo_values[0][dimension]:
                unanimous = False
        if bounded:
            break
    conflict = tuple(memo_refs) if memo_values and not unanimous else ()
    return ConsumerMeasurementNeedFactsC(discriminating_dimension_refs=tuple(discriminating),
        supported_goal_dimension_refs=tuple(goal_dimensions), qualified_geometry_memory_refs=tuple(memo_refs),
        conflicting_geometry_memory_refs=conflict,
        reusable_geometry_values=memo_values[0] if unanimous and not bounded else None,
        unqualified_prediction_refs=tuple(unqualified), actual_dimension_comparisons=counts,
        facts=FrozenMap({"scope_current": current, "request_dimensions_exactly_justified": request_exact,
            "needed_dimensions_have_unambiguous_support": support_unambiguous,
            "unique_live_prediction_refs": unique_predictions, "unique_geometry_memory_refs": unique_memories,
            "budget_reached": bounded, "validated_continuation_can_release": continuing,
            "qualified_geometry_unanimous": unanimous, "geometry_conflict_present": bool(conflict),
            "needed_dimension_refs": tuple(sorted(needed)), "catalogue_is_not_a_consumer_need": True}))


def assemble_consumer_measurement_need(value: ConsumerMeasurementNeedDecisionInputC) -> ConsumerMeasurementNeedDecisionC:
    return ConsumerMeasurementNeedDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        agenda_decision=value.agenda_decision, source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref)
