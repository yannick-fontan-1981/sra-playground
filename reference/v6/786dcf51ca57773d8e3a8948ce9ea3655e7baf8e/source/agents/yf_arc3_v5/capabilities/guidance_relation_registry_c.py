"""Explicit tutorial relations; real effects remain separate from victory."""
from .guidance_relation_contracts_c import (GuidanceRelationInputC, GuidanceRelationFactsC,
    GuidanceDecisionInputC, GuidanceDecisionC)
from .guidance_relation_c import measure_guidance_relations, assemble_guidance_decision

GUIDANCE_C_TYPES = ("GuidanceOperandC", "GuidanceClauseC", "GuidanceRelationCandidateC", "GuidanceExampleC",
    "GuidanceRelationInputC", "GuidanceExampleExplanationC", "GuidanceRelationFactsC",
    "GuidanceDecisionInputC", "GuidanceDecisionC")


def guidance_relation_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.guidance_relation_facts_c",
            implementation=measure_guidance_relations, input_model=GuidanceRelationInputC,
            output_model=GuidanceRelationFactsC, source_file="guidance_relation_c.py",
            applicability=("sealed_examples_and_source_declared_relational_candidates",),
            invariants=("refusal_and_nonwinning_examples_count", "next_designation_explained_by_source_action_effect",
                "unknown_not_falsified", "future_example_not_earlier_support", "no_relation_or_task_selection"),
            falsifiers=("missing_required_next_relation", "contrary_example", "actual_evaluation_bound")),
        entry_factory(capability_id="capability.guidance_decision_assembly_c",
            implementation=assemble_guidance_decision, input_model=GuidanceDecisionInputC,
            output_model=GuidanceDecisionC, source_file="guidance_relation_c.py",
            applicability=("src_selected_guidance_disposition",),
            invariants=("task_survives_contour_disappearance", "all_examples_and_candidates_retained",
                "consistent_relation_not_unique_causal_law", "no_action_or_official_completion"),
            falsifiers=("disappearance_erases_task", "unobserved_suffix_interpreted_as_success")),
    )


def guidance_relation_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        "capability.guidance_relation_facts_c": ((parameter("request", "GuidanceRelationInputC"),),
            "GuidanceRelationFactsC"),
        "capability.guidance_decision_assembly_c": ((parameter("request", "GuidanceRelationInputC"),
            parameter("measured", "GuidanceRelationFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "String")), "GuidanceDecisionC"),
    }
