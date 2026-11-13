"""Hypothesis dispositions retain support means, desired values and action influence separately."""
from .support_value_supposition_contracts_c import (ReconfigurableSupportSuppositionInputC,
    ReconfigurableSupportSuppositionFactsC, CoupledValueSuppositionInputC, CoupledValueSuppositionFactsC,
    SupportValueSuppositionDecisionInputC, SupportValueSuppositionDecisionC)
from .support_value_supposition_c import (measure_support_supposition, measure_coupled_value_supposition,
    assemble_support_value_supposition)

SUPPORT_VALUE_SUPPOSITION_C_TYPES = ("ReconfigurableSupportSuppositionInputC", "ReconfigurableSupportSuppositionFactsC",
    "NormalizedValueCorrespondenceC", "StencilEffectExampleC", "CoupledValueSuppositionInputC",
    "CoupledValueSuppositionFactsC", "SupportValueSuppositionDecisionInputC", "SupportValueSuppositionDecisionC")


def support_value_supposition_entries_c(entry_factory):
    rows = (("capability.support_supposition_facts_c", measure_support_supposition,
        ReconfigurableSupportSuppositionInputC, ReconfigurableSupportSuppositionFactsC),
        ("capability.coupled_value_supposition_facts_c", measure_coupled_value_supposition,
            CoupledValueSuppositionInputC, CoupledValueSuppositionFactsC),
        ("capability.support_value_supposition_assembly_c", assemble_support_value_supposition,
            SupportValueSuppositionDecisionInputC, SupportValueSuppositionDecisionC))
    return tuple(entry_factory(capability_id=ref, implementation=implementation, input_model=before,
        output_model=after, source_file="support_value_supposition_c.py",
        applicability=("current_goal_consumer_and_scoped_structural_evidence",),
        invariants=("existing_support_measurements_only", "pivot_overlap_not_joint_route",
            "desired_value_and_stencil_influence_distinct", "unknown_and_falsified_separate",
            "hypothesis_not_confirmed_physics", "no_act_or_canonical_write"),
        falsifiers=("foreign_scope_or_snapshot", "unsupported_normalization", "unisolated_effect", "work_bound"))
        for ref, implementation, before, after in rows)


def support_value_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {"capability.support_supposition_facts_c": ((parameter("request", "ReconfigurableSupportSuppositionInputC"),), "ReconfigurableSupportSuppositionFactsC"),
        "capability.coupled_value_supposition_facts_c": ((parameter("request", "CoupledValueSuppositionInputC"),), "CoupledValueSuppositionFactsC"),
        "capability.support_value_supposition_assembly_c": ((parameter("request", "Any"), parameter("measured", "Any"),
            parameter("source_disposition_ref", "Any"), parameter("source_policy_ref", "String")), "SupportValueSuppositionDecisionC")}
