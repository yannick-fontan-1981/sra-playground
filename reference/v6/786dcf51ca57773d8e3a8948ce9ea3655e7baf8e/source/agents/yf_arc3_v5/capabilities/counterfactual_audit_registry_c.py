"""Private exact bindings; central registration remains coordinator owned."""
from .mechanical_common_contracts_c import CounterfactualPathResultC
from .counterfactual_audit_contracts_c import (CounterfactualAuditFactsC,
    CounterfactualAuditDecisionInputC, CounterfactualAuditDecisionC)
from .counterfactual_audit_c import measure_counterfactual_audit, assemble_counterfactual_audit

COUNTERFACTUAL_AUDIT_C_TYPES = ("CounterfactualAuditFactsC", "CounterfactualAuditDecisionInputC",
    "CounterfactualAuditDecisionC")


def counterfactual_audit_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="counterfactual_audit_c.py",
        applicability=("explicit_two_path_counterfactual_audit",),
        invariants=("no_new_step_or_search", "no_action_release", "frozen_complete_scope"),
        falsifiers=("different_parent_or_model", "partial_path", "predicate_not_re_evaluated"))
        for ref, method, inputs, outputs in (
            ("capability.counterfactual_audit_facts_c", measure_counterfactual_audit,
                CounterfactualPathResultC, CounterfactualAuditFactsC),
            ("capability.counterfactual_audit_assembly_c", assemble_counterfactual_audit,
                CounterfactualAuditDecisionInputC, CounterfactualAuditDecisionC)))


def counterfactual_audit_signatures_c(type_spec, parameter_spec):
    parameter = lambda name, model: parameter_spec(name=name, type_spec=type_spec(model))
    return {"capability.counterfactual_audit_facts_c": (
        (parameter("request", "CounterfactualPathResultC"),), "CounterfactualAuditFactsC"),
        "capability.counterfactual_audit_assembly_c": ((parameter("measured", "CounterfactualPathResultC"),
            parameter("source_disposition_ref", "Any"), parameter("source_policy_ref", "Any")),
            "CounterfactualAuditDecisionC")}

