"""Exact example comparisons, without choosing roles or fixing a quantifier by count."""
from collections import Counter
from .supposition_axes_contracts_c import SuppositionAxesInputC, SuppositionAxesFactsC, SuppositionAxesDecisionInputC, SuppositionAxesDecisionC
from .typed_mask_c import measure_typed_mask_relation
from agents.yf_arc3_v5.logos.types import FrozenMap


def _class_counts(references, population):
    if any(reference not in population or population[reference] is None for reference in references):
        return None
    counts = Counter(population[reference] for reference in references)
    return FrozenMap({key: counts[key] for key in sorted(counts)})


def _counts_valid(value):
    return isinstance(value, FrozenMap) and all(type(value[key]) is int and value[key] >= 0 for key in sorted(value))


def _quantifier_prediction(example, candidate):
    ids = tuple(carrier.carrier_ref for carrier in example.population)
    fulfilled = example.fulfilled_carrier_refs
    if (not example.population_complete or not example.fulfilled_selection_complete
            or len(set(ids)) != len(ids) or len(set(fulfilled)) != len(fulfilled)
            or not set(fulfilled).issubset(ids)):
        return None
    population = {carrier.carrier_ref: carrier.class_ref for carrier in example.population}
    if candidate.kind == "ALL_CARRIERS":
        return set(fulfilled) == set(ids)
    if candidate.kind == "REQUIRED_MULTISET":
        actual = _class_counts(fulfilled, population)
        return actual == candidate.required_class_multiset if actual is not None and _counts_valid(candidate.required_class_multiset) else None
    if candidate.kind == "ONE_CLASS":
        if candidate.required_class_ref is None or any(population[reference] is None for reference in ids):
            return None
        wanted = {reference for reference in ids if population[reference] == candidate.required_class_ref}
        return set(fulfilled) == wanted
    if candidate.kind == "EXACT_PARTITION":
        wanted = candidate.required_partition
        assignments = example.partition_by_carrier
        if not isinstance(wanted, FrozenMap) or set(assignments) != set(fulfilled) or not all(
                _counts_valid(wanted[group]) for group in sorted(wanted)):
            return None
        assigned_groups = tuple(assignments[reference] for reference in fulfilled)
        if any(not isinstance(group, str) for group in assigned_groups):
            return None
        groups = set(assigned_groups)
        if not groups.issubset(wanted):
            return False
        actual = FrozenMap({group: _class_counts(tuple(reference for reference in fulfilled
            if assignments[reference] == group), population) for group in sorted(wanted)})
        return None if any(actual[group] is None for group in sorted(actual)) else actual == wanted
    order, length = example.emitted_carrier_order, candidate.prefix_length
    if order is None or length is None or len(order) < length or len(set(order)) != len(order) or not set(order).issubset(ids):
        return None
    return set(fulfilled) == set(order[:length])


def measure_supposition_axes(value: SuppositionAxesInputC) -> SuppositionAxesFactsC:
    current = (value.epoch == value.support_epoch and value.revision_ref == value.support_revision_ref
        and value.scope_ref == value.support_scope_ref and bool(value.current_evidence_refs))
    reference_rows = []
    for example in value.reference_examples:
        scoped = (current and example.epoch == value.epoch and example.revision_ref == value.revision_ref
            and example.phase_ref == value.phase_ref and example.sealed_observation and bool(example.evidence_refs)
            and example.parent_goal_ref == value.parent_goal_ref and example.scope_ref == value.scope_ref
            and example.episode_ref == value.episode_ref)
        changed = example.before != example.after
        reference_rows.append(FrozenMap({"example_ref": example.example_ref, "region_ref": example.region_ref,
            "operation_ref": example.operation_ref, "phase_ref": example.phase_ref, "scope_current": scoped,
            "separated_from_work_area": example.separated_from_work_area,
            "inside_owned_change": scoped and example.target_inside_region and example.owned_effect_ref is not None and changed,
            "outside_conditioned_change": scoped and not example.target_inside_region and example.owned_effect_ref is not None and changed,
            "unchanged_for_this_operation": scoped and not changed,
            "relation_definition_unchanged": example.relation_definition_before == example.relation_definition_after,
            "immutability_or_new_relation_meaning_proved": False}))
    space_rows = []
    for relation in value.space_relations:
        answer = None
        scoped = (current and relation.epoch == value.epoch and relation.revision_ref == value.revision_ref
            and relation.parent_goal_ref == value.parent_goal_ref and relation.scope_ref == value.scope_ref
            and bool(relation.evidence_refs))
        if scoped and relation.compatible_body_evidence_refs:
            if relation.relation_kind == "ACCEPTANCE":
                answer = relation.accepted_value if relation.acceptance_evidence_refs else None
            elif relation.relation_kind == "LEVEL_ALIGNMENT":
                if relation.body_level_values is not None and relation.space_level_values is not None:
                    answer = set(relation.body_level_values) == set(relation.space_level_values)
            elif relation.geometry is not None:
                request = relation.geometry
                operator = "EQUAL" if relation.relation_kind == "EXACT_COINCIDENCE" else "SUBSET"
                left_owner = relation.space_ref if relation.relation_kind == "COVERAGE" else relation.body_ref
                right_owner = relation.body_ref if relation.relation_kind == "COVERAGE" else relation.space_ref
                exact_contract = (request.operator == operator and request.left.owner_ref == left_owner
                    and request.right.owner_ref == right_owner and request.parent_goal_ref == value.parent_goal_ref
                    and request.epoch == value.epoch and request.revision_ref == value.revision_ref)
                geometry = measure_typed_mask_relation(request) if exact_contract else None
                if (geometry is not None and geometry.facts["scope_current"] and geometry.facts["requested_mask_kinds_present"]
                        and geometry.facts["prediction_support_present"] and geometry.facts["requested_semantic_support_current"]
                        and not geometry.facts["budget_reached"]):
                    answer = geometry.geometric_relation_value
        space_rows.append(FrozenMap({"relation_ref": relation.relation_ref, "space_ref": relation.space_ref,
            "body_ref": relation.body_ref, "space_kind": relation.space_kind,
            "relation_kind": relation.relation_kind, "scope_current": scoped, "measured_relation_value": answer,
            "collision_or_acceptance_from_geometry": False}))
    consistent, unresolved, falsified, rows = [], [], [], []
    evaluations, bounded = 0, False
    for candidate in value.quantifier_candidates:
        contradiction, unknown, observed = False, False, 0
        for example in value.beneficiary_examples:
            if evaluations >= value.max_quantifier_evaluations:
                bounded, unknown = True, True
                break
            evaluations += 1
            prediction = _quantifier_prediction(example, candidate)
            qualified = (current and example.epoch <= value.epoch and example.sealed_observation and bool(example.evidence_refs)
                and example.parent_goal_ref == value.parent_goal_ref and example.scope_ref == value.scope_ref
                and example.episode_ref == value.episode_ref)
            observed_acceptance = example.observed_acceptance
            isolated = (observed_acceptance is True or (example.other_constraints_satisfied is True
                and bool(example.isolating_constraint_evidence_refs)))
            if not qualified or prediction is None or observed_acceptance is None or not isolated:
                unknown = True
            else:
                observed += 1
                contradiction = contradiction or prediction != observed_acceptance
            rows.append(FrozenMap({"model_ref": candidate.model_ref, "example_ref": example.example_ref,
                "prediction": prediction, "observed_acceptance": observed_acceptance,
                "other_constraints_isolated": isolated, "scope_qualified": qualified}))
        supported = bool(candidate.premise_refs) and bool(candidate.falsifier_refs)
        if contradiction:
            falsified.append(candidate.model_ref)
        elif unknown or not supported or observed == 0:
            unresolved.append(candidate.model_ref)
        else:
            consistent.append(candidate.model_ref)
    return SuppositionAxesFactsC(reference_rows=tuple(reference_rows), space_rows=tuple(space_rows),
        quantifier_rows=tuple(rows), consistent_quantifier_refs=tuple(consistent),
        unresolved_quantifier_refs=tuple(unresolved), falsified_quantifier_refs=tuple(falsified),
        actual_quantifier_evaluations=evaluations,
        facts=FrozenMap({"scope_current": current, "budget_reached": bounded,
            "unique_candidate_refs": len({candidate.model_ref for candidate in value.quantifier_candidates}) == len(value.quantifier_candidates),
            "multiple_consistent_quantifiers": len(consistent) > 1,
            "open_quantifiers_present": bool(unresolved), "relation_rows_retained": bool(reference_rows or space_rows or rows)}))


def assemble_supposition_axes(value: SuppositionAxesDecisionInputC) -> SuppositionAxesDecisionC:
    return SuppositionAxesDecisionC(source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref, frozen_request=value.request, frozen_measurement=value.measured)
