"""Appearance correspondence and three independent semantic equivalences."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref


class RecognitionCandidateC(FrozenModel):
    candidate_ref: Ref
    raw_binding_row: FrozenMap
    raw_masks: FrozenMap
    current_context_values: FrozenMap
    rendering_contract_ref: Ref
    observable_signature_ref: Ref
    rendering_evidence_refs: tuple[Ref, ...]


class IndependentRecognitionRelationC(FrozenModel):
    relation_ref: Ref
    kind: Literal["IDENTITY", "PHYSICAL_ACTION_EQUIVALENCE", "TERMINAL_ACCEPTANCE"]
    candidate_refs: tuple[Ref, ...]
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    evidence_refs: tuple[Ref, ...]
    relation_value: bool | None


class RecognitionBoundaryInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recognition_boundary_input_c.v1"
    parent_goal_ref: Ref
    consumer_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    support_epoch: int = Field(ge=0)
    support_revision_ref: Ref
    support_scope_ref: Ref
    current_observation_ref: Ref
    current_evidence_refs: tuple[Ref, ...]
    compatible_role_refs: tuple[Ref, ...]
    role_context_support_refs: tuple[Ref, ...]
    candidates: tuple[RecognitionCandidateC, ...] = Field(max_length=1024)
    independent_relations: tuple[IndependentRecognitionRelationC, ...] = Field(default=(), max_length=1024)


class ObservationalAliasGroupC(FrozenModel):
    rendering_contract_ref: Ref
    observable_signature_ref: Ref
    candidate_refs: tuple[Ref, ...]
    evidence_refs: tuple[Ref, ...]


class RecognitionBoundaryFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recognition_boundary_facts_c.v1"
    facts: FrozenMap
    recognition_input_facts: FrozenMap
    admitted_candidate_refs: tuple[Ref, ...]
    reserved_candidate_refs: tuple[Ref, ...]
    missing_context_fields: FrozenMap
    observational_alias_groups: tuple[ObservationalAliasGroupC, ...]
    current_independent_relations: tuple[IndependentRecognitionRelationC, ...]
    unqualified_independent_relation_refs: tuple[Ref, ...]


class RecognitionBoundaryDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recognition_boundary_decision_input_c.v1"
    request: RecognitionBoundaryInputC
    measured: RecognitionBoundaryFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    ranked_facts: FrozenMap | None


class RecognitionBoundaryDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recognition_boundary_decision_c.v1"
    source_disposition_ref: Ref
    source_policy_ref: Ref
    frozen_request: RecognitionBoundaryInputC
    frozen_measurement: RecognitionBoundaryFactsC
    ranked_facts: FrozenMap | None
    existing_ranking_applied: bool
    observational_alias_groups: tuple[ObservationalAliasGroupC, ...]
    identity_evidence: tuple[IndependentRecognitionRelationC, ...]
    physical_action_equivalence_evidence: tuple[IndependentRecognitionRelationC, ...]
    terminal_acceptance_evidence: tuple[IndependentRecognitionRelationC, ...]
    proposed_action: None = None
