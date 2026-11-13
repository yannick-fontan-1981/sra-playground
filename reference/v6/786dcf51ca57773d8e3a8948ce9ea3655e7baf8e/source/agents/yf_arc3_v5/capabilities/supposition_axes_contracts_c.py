"""Mutable references, typed spaces and beneficiary quantifiers stay scoped hypotheses."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .typed_mask_contracts_c import TypedMaskRelationInputC


class ReferenceChangeExampleC(FrozenModel):
    example_ref: Ref
    parent_goal_ref: Ref
    scope_ref: Ref
    episode_ref: Ref
    region_ref: Ref
    operation_ref: Ref
    phase_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    sealed_observation: bool
    evidence_refs: tuple[Ref, ...]
    owned_effect_ref: Ref | None
    target_inside_region: bool
    separated_from_work_area: bool | None
    before: FrozenMap
    after: FrozenMap
    relation_definition_before: FrozenMap
    relation_definition_after: FrozenMap


class NegativeSpaceRelationC(FrozenModel):
    relation_ref: Ref
    parent_goal_ref: Ref
    scope_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    evidence_refs: tuple[Ref, ...]
    space_ref: Ref
    body_ref: Ref
    space_kind: Literal["CAVITY", "HOLLOW_FRAME", "MARKER_CONSTELLATION", "ROOTED_SEQUENCE", "ENTRY_HALO"]
    relation_kind: Literal["CONTAINMENT", "EXACT_COINCIDENCE", "LEVEL_ALIGNMENT", "COVERAGE", "ACCEPTANCE"]
    compatible_body_evidence_refs: tuple[Ref, ...]
    geometry: TypedMaskRelationInputC | None
    body_level_values: tuple[int, ...] | None
    space_level_values: tuple[int, ...] | None
    accepted_value: bool | None
    acceptance_evidence_refs: tuple[Ref, ...]


class BeneficiaryCarrierC(FrozenModel):
    carrier_ref: Ref
    class_ref: Ref | None


class BeneficiaryExampleC(FrozenModel):
    example_ref: Ref
    parent_goal_ref: Ref
    scope_ref: Ref
    episode_ref: Ref
    epoch: int = Field(ge=0)
    sealed_observation: bool
    evidence_refs: tuple[Ref, ...]
    population: tuple[BeneficiaryCarrierC, ...] = Field(max_length=4096)
    population_complete: bool
    fulfilled_carrier_refs: tuple[Ref, ...]
    fulfilled_selection_complete: bool
    partition_by_carrier: FrozenMap
    emitted_carrier_order: tuple[Ref, ...] | None
    observed_acceptance: bool | None
    other_constraints_satisfied: bool | None
    isolating_constraint_evidence_refs: tuple[Ref, ...]


class BeneficiaryQuantifierCandidateC(FrozenModel):
    model_ref: Ref
    kind: Literal["ALL_CARRIERS", "REQUIRED_MULTISET", "ONE_CLASS", "EXACT_PARTITION", "FINITE_EMITTED_PREFIX"]
    required_class_multiset: FrozenMap | None
    required_class_ref: Ref | None
    required_partition: FrozenMap | None
    prefix_length: int | None = Field(default=None, ge=0)
    premise_refs: tuple[Ref, ...]
    falsifier_refs: tuple[Ref, ...]


class SuppositionAxesInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.supposition_axes_input_c.v1"
    parent_goal_ref: Ref
    episode_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    phase_ref: Ref
    support_epoch: int = Field(ge=0)
    support_revision_ref: Ref
    support_scope_ref: Ref
    current_evidence_refs: tuple[Ref, ...]
    reference_examples: tuple[ReferenceChangeExampleC, ...] = Field(max_length=512)
    space_relations: tuple[NegativeSpaceRelationC, ...] = Field(max_length=512)
    beneficiary_examples: tuple[BeneficiaryExampleC, ...] = Field(max_length=512)
    quantifier_candidates: tuple[BeneficiaryQuantifierCandidateC, ...] = Field(max_length=256)
    max_quantifier_evaluations: int = Field(ge=0)


class SuppositionAxesFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.supposition_axes_facts_c.v1"
    reference_rows: tuple[FrozenMap, ...]
    space_rows: tuple[FrozenMap, ...]
    quantifier_rows: tuple[FrozenMap, ...]
    consistent_quantifier_refs: tuple[Ref, ...]
    unresolved_quantifier_refs: tuple[Ref, ...]
    falsified_quantifier_refs: tuple[Ref, ...]
    actual_quantifier_evaluations: int
    facts: FrozenMap


class SuppositionAxesDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.supposition_axes_decision_input_c.v1"
    request: SuppositionAxesInputC
    measured: SuppositionAxesFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class SuppositionAxesDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.supposition_axes_decision_c.v1"
    source_disposition_ref: Ref
    source_policy_ref: Ref
    frozen_request: SuppositionAxesInputC
    frozen_measurement: SuppositionAxesFactsC
    causal_law_role_or_action: None = None
