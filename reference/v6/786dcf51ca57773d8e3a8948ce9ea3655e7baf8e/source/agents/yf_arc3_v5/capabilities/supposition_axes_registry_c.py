"""Scoped supposition measurements; hypotheses remain revisable in Source."""
from .supposition_axes_contracts_c import (SuppositionAxesInputC, SuppositionAxesFactsC,
    SuppositionAxesDecisionInputC, SuppositionAxesDecisionC)
from .supposition_axes_c import measure_supposition_axes, assemble_supposition_axes

SUPPOSITION_AXES_C_TYPES = ("ReferenceChangeExampleC", "NegativeSpaceRelationC", "BeneficiaryCarrierC",
    "BeneficiaryExampleC", "BeneficiaryQuantifierCandidateC", "SuppositionAxesInputC",
    "SuppositionAxesFactsC", "SuppositionAxesDecisionInputC", "SuppositionAxesDecisionC")


def supposition_axes_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.supposition_axes_facts_c", implementation=measure_supposition_axes,
            input_model=SuppositionAxesInputC, output_model=SuppositionAxesFactsC, source_file="supposition_axes_c.py",
            applicability=("current_scoped_examples_and_explicit_relation_candidates",),
            invariants=("unchanged_example_not_immutability", "geometry_not_acceptance",
                "count_equality_not_quantifier", "unknown_and_falsified_distinct", "no_role_or_action_selection"),
            falsifiers=("foreign_or_stale_scope", "contrary_isolated_acceptance", "evaluation_bound")),
        entry_factory(capability_id="capability.supposition_axes_assembly_c", implementation=assemble_supposition_axes,
            input_model=SuppositionAxesDecisionInputC, output_model=SuppositionAxesDecisionC,
            source_file="supposition_axes_c.py", applicability=("source_selected_scoped_supposition_disposition",),
            invariants=("every_example_and_candidate_frozen", "alternatives_remain_revisable", "no_causal_law_or_action"),
            falsifiers=("unobserved_relation_promoted", "refusal_with_unknown_constraints_falsifies_quantifier")),
    )


def supposition_axes_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        "capability.supposition_axes_facts_c": ((parameter("request", "SuppositionAxesInputC"),), "SuppositionAxesFactsC"),
        "capability.supposition_axes_assembly_c": ((parameter("request", "SuppositionAxesInputC"),
            parameter("measured", "SuppositionAxesFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "String")), "SuppositionAxesDecisionC"),
    }
