"""Pure descriptive facts; no PATH, STEP or search is launched by this projection."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .mechanical_common_contracts_c import CounterfactualPathResultC
from .counterfactual_audit_contracts_c import (CounterfactualAuditFactsC,
    CounterfactualAuditDecisionInputC, CounterfactualAuditDecisionC)


def measure_counterfactual_audit(value: CounterfactualPathResultC) -> CounterfactualAuditFactsC:
    return CounterfactualAuditFactsC(facts=FrozenMap({
        "comparison_scope_equal": value.comparison_scope_equal,
        "edit_scope_measurement": value.edit_scope_measurement,
        "group_usefulness_not_universal_necessity": True,
        "new_official_victory_proved": False,
        "global_minimum_proved": False,
        "both_paths_complete": value.original.complete and value.edited.complete,
        "both_paths_unbounded": not value.original.bounded and not value.edited.bounded,
        "both_paths_noncontradictory": not value.original.contradictory and not value.edited.contradictory,
        "re_evaluated_predicate_refs": value.re_evaluated_predicate_refs,
        "endpoint_equal": value.endpoint_equal, "cost_delta": value.cost_delta,
        "first_changed_event_index": value.first_changed_event_index,
        "first_changed_effect_index": value.first_changed_effect_index}))


def assemble_counterfactual_audit(value: CounterfactualAuditDecisionInputC) -> CounterfactualAuditDecisionC:
    return CounterfactualAuditDecisionC(frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
