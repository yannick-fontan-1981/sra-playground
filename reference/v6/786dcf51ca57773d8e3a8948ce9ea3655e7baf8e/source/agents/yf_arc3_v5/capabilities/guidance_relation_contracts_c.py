"""Observed tutorial examples remain distinct from task and execution authority."""
from typing import Literal, Any
from pydantic import Field, field_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, freeze_json


class GuidanceOperandC(FrozenModel):
    namespace: Literal["SOURCE_DESIGNATION", "ACTION", "OBSERVED_EFFECT", "OBSERVED_OUTCOME", "NEXT_DESIGNATION", "CONSTANT"]
    path: tuple[str | int, ...] = ()
    constant: Any = None

    @field_validator("constant", mode="before")
    @classmethod
    def immutable_constant(cls, value):
        return freeze_json(value)


class GuidanceClauseC(FrozenModel):
    clause_ref: Ref
    left: GuidanceOperandC
    right: GuidanceOperandC
    comparison: Literal["EQ", "NE", "LE", "GE", "IN", "SET_EQ"]
    additive_offset: GuidanceOperandC | None = None


class GuidanceRelationCandidateC(FrozenModel):
    method_ref: Ref
    portable_explanation_ref: Ref
    clauses: tuple[GuidanceClauseC, ...] = Field(min_length=1, max_length=128)
    premise_refs: tuple[Ref, ...]
    falsifier_refs: tuple[Ref, ...]


class GuidanceExampleC(FrozenModel):
    example_ref: Ref
    episode_ref: Ref
    learned_task_ref: Ref
    epoch: int = Field(ge=0)
    sealed_sequence: int = Field(ge=0)
    actual_sealed_observation: bool
    evidence_refs: tuple[Ref, ...]
    source_designation: FrozenMap
    action: FrozenMap
    observed_effect: FrozenMap
    observed_outcome: Literal["ACCEPTED", "REFUSED", "NONWINNING", "UNKNOWN"]
    next_designation: FrozenMap | None
    next_designation_observed: bool


class GuidanceRelationInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.guidance_relation_input_c.v1"
    parent_goal_ref: Ref
    learned_task_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    episode_ref: Ref
    current_sealed_sequence: int = Field(ge=0)
    support_epoch: int = Field(ge=0)
    support_revision_ref: Ref
    support_scope_ref: Ref
    invitation_content_ref: Ref
    invitation_evidence_refs: tuple[Ref, ...]
    invitation_currently_visible: bool
    bounded_experiment_contract_ref: Ref | None
    actual_primitive_bound: int = Field(ge=0)
    examples: tuple[GuidanceExampleC, ...] = Field(max_length=1024)
    relation_candidates: tuple[GuidanceRelationCandidateC, ...] = Field(max_length=256)
    required_next_field_paths: tuple[tuple[str | int, ...], ...] = Field(min_length=1, max_length=128)
    max_clause_evaluations: int = Field(ge=0)


class GuidanceExampleExplanationC(FrozenModel):
    example_ref: Ref
    method_ref: Ref
    clause_values: tuple[bool | None, ...]
    explains_observed_next: bool | None


class GuidanceRelationFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.guidance_relation_facts_c.v1"
    facts: FrozenMap
    explanations: tuple[GuidanceExampleExplanationC, ...]
    consistent_method_refs: tuple[Ref, ...]
    unresolved_method_refs: tuple[Ref, ...]
    falsified_method_refs: tuple[Ref, ...]
    unqualified_example_refs: tuple[Ref, ...]
    actual_clause_evaluations: int


class GuidanceDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.guidance_decision_input_c.v1"
    request: GuidanceRelationInputC
    measured: GuidanceRelationFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class GuidanceDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.guidance_decision_c.v1"
    source_disposition_ref: Ref
    source_policy_ref: Ref
    frozen_request: GuidanceRelationInputC
    frozen_measurement: GuidanceRelationFactsC
    preserved_parent_goal_ref: Ref
    preserved_learned_task_ref: Ref
    retained_examples: tuple[GuidanceExampleC, ...]
    supported_relation_candidates: tuple[GuidanceRelationCandidateC, ...]
    official_completion_or_action: None = None
