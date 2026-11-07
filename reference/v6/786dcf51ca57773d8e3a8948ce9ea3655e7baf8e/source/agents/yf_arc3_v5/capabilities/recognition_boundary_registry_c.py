"""A boundary for recognition, reusing the existing Source rank contract."""
from .recognition_boundary_contracts_c import (RecognitionBoundaryInputC, RecognitionBoundaryFactsC,
    RecognitionBoundaryDecisionInputC, RecognitionBoundaryDecisionC)
from .recognition_boundary_c import measure_recognition_boundary, assemble_recognition_boundary

RECOGNITION_BOUNDARY_C_TYPES = ("RecognitionCandidateC", "IndependentRecognitionRelationC",
    "RecognitionBoundaryInputC", "ObservationalAliasGroupC", "RecognitionBoundaryFactsC",
    "RecognitionBoundaryDecisionInputC", "RecognitionBoundaryDecisionC")


def recognition_boundary_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.recognition_boundary_facts_c",
            implementation=measure_recognition_boundary, input_model=RecognitionBoundaryInputC,
            output_model=RecognitionBoundaryFactsC, source_file="recognition_boundary_c.py",
            applicability=("current_role_and_context_domain_supplied_by_source",),
            invariants=("reuse_exact_context_compatibility", "raw_masks_and_aliases_preserved",
                "unknown_context_retained", "no_new_rank_or_identity_selection"),
            falsifiers=("stale_observation", "malformed_binding_row", "duplicate_binding_token")),
        entry_factory(capability_id="capability.recognition_boundary_assembly_c",
            implementation=assemble_recognition_boundary, input_model=RecognitionBoundaryDecisionInputC,
            output_model=RecognitionBoundaryDecisionC, source_file="recognition_boundary_c.py",
            applicability=("src_scoped_recognition_disposition_and_existing_rank_return",),
            invariants=("appearance_not_identity_action_or_acceptance", "independent_evidence_kept_separate",
                "all_alias_candidates_retained", "no_role_commit_or_action_release"),
            falsifiers=("acceptance_inferred_from_appearance", "candidate_arbitrarily_removed")),
    )


def recognition_boundary_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    return {
        "capability.recognition_boundary_facts_c": ((parameter("request", "RecognitionBoundaryInputC"),),
            "RecognitionBoundaryFactsC"),
        "capability.recognition_boundary_assembly_c": ((parameter("request", "RecognitionBoundaryInputC"),
            parameter("measured", "RecognitionBoundaryFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "String"), parameter("ranked_facts", "Any", True)),
            "RecognitionBoundaryDecisionC"),
    }
