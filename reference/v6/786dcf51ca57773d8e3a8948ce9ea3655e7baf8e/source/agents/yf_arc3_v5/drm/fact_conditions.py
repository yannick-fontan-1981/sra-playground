"""Exact scalar conditions shared by DRM projection and authority evaluation.

Aliases expose existing measured fields only. Missing semantic facts never
receive a guessed Boolean value here.
"""
from agents.yf_arc3_v5.drm.contracts import DrmFactOperator


FACT_FIELD_INPUTS = {
    "interaction_kind": ("interaction_measurement_kind",),
    "terminal_access_candidate_ref_present": ("terminal_access_candidate_ref",),
}


def condition_input_fields(condition):
    fields = (condition.field, condition.reference_field)
    return tuple(ref for field in fields if field is not None
                 for ref in (field, *FACT_FIELD_INPUTS.get(field, ())))


def recorded_fact_value(facts, field, context=None):
    if context is not None and field not in facts:
        return context.get(field)
    return facts.get(field)


def fact_value(facts, field, context=None):
    value = recorded_fact_value(facts, field, context)
    if value is None and field == "interaction_kind":
        return recorded_fact_value(facts, "interaction_measurement_kind", context)
    if value is None and field == "terminal_access_candidate_ref_present":
        return bool(recorded_fact_value(facts, "terminal_access_candidate_ref", context))
    return value


def exact_fact_equal(left, right):
    return left is not None and right is not None and type(left) is type(right) and left == right


def fact_condition_holds(condition, facts, context=None):
    if not hasattr(facts, "get"):
        return False
    operator = condition.operator
    if operator is DrmFactOperator.IS_PRESENT:
        return recorded_fact_value(facts, condition.field, context) is not None
    if operator is DrmFactOperator.IS_ABSENT:
        return recorded_fact_value(facts, condition.field, context) is None
    value = fact_value(facts, condition.field, context)
    if operator is DrmFactOperator.EQUALS:
        return exact_fact_equal(value, condition.expected)
    if operator is DrmFactOperator.NOT_EQUALS:
        return value is not None and not exact_fact_equal(value, condition.expected)
    reference = (fact_value(facts, condition.reference_field, context)
                 if condition.reference_field is not None else None)
    if operator is DrmFactOperator.EQUALS_REFERENCE_FIELD:
        return exact_fact_equal(value, reference)
    if operator is DrmFactOperator.NOT_EQUALS_REFERENCE_FIELD:
        return value is not None and reference is not None and not exact_fact_equal(value, reference)
    if operator is DrmFactOperator.MEMBER_OF_REFERENCE_FIELD:
        return isinstance(reference, (tuple, list, set, frozenset)) and any(
            exact_fact_equal(value, item) for item in reference)
    if type(value) is not int:
        return False
    if operator is DrmFactOperator.GREATER_THAN:
        return value > condition.expected
    if operator is DrmFactOperator.BETWEEN_INCLUSIVE:
        return condition.lower <= value <= condition.upper
    if type(reference) is not int:
        return False
    if operator is DrmFactOperator.GREATER_THAN_REFERENCE_FIELD:
        return value > reference
    return value <= condition.factor * reference
