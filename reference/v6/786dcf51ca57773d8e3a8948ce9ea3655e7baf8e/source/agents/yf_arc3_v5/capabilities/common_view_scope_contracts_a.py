"""Current Source questions keep recognition, action and answers distinct."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedInputReadRequest
from .typed_mask_contracts_c import TypedMaskRelationInputC
from .mechanical_common_contracts_c import SearchStateC


class CommonViewScopeA(FrozenModel):
    request_ref: Ref
    parent_goal_ref: Ref
    consumer_ref: Ref
    next_item_ref: Ref
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref


class ComparisonViewQuestionA(FrozenModel):
    bounds: tuple[int,int,int,int]
    reduction: tuple[int,int]
    license_claim_ref: Ref
    recognition_transform_refs: tuple[Ref,...] = Field(max_length=32)
    action_transform_refs: tuple[Ref,...] = Field(max_length=32)
    acceptance_transform_refs: tuple[Ref,...] = Field(max_length=32)
    action_geometry_term_ref: Ref
    action_geometry_claim_ref: Ref


class ReservedOccurrenceQuestionA(FrozenModel):
    occurrence_ref: Ref
    drawing_ref: Ref
    binding_claim_ref: Ref
    layout_term_ref: Ref
    layout_claim_ref: Ref
    predicted_layout: bool
    prediction_claim_ref: Ref | None = None


class RelationScopeQuestionA(FrozenModel):
    relation_ref: Ref
    relation_type_ref: Ref
    quantifier_ref: Literal['ALL','ANY','EXACT']
    support_refs: tuple[Ref,...] = Field(max_length=256)
    multiplicity_restrictions: FrozenMap
    domain_term_ref: Ref
    relation_claim_ref: Ref
    mask_relation: TypedMaskRelationInputC | None = None


class FutureEquivalenceQuestionA(FrozenModel):
    left_state_term_ref: Ref
    right_state_term_ref: Ref
    left_state_claim_ref: Ref
    right_state_claim_ref: Ref
    answer_equivalence_claim_ref: Ref | None = None
    answer_question_ref: Ref | None = None


class CommonViewRequestA(FrozenModel):
    scope: CommonViewScopeA
    acquisition: ObservedInputReadRequest
    operation: Literal['VIEWS','RESERVED_OCCURRENCE','RELATION_SCOPE','FUTURE_EQUIVALENCE']
    owner_claim_ref: Ref
    output_term_ref: Ref
    output_claim_ref: Ref
    maximum_work: int = Field(ge=1,le=100000)
    time_bound_ms: int = Field(ge=1,le=300000)
    view_question: ComparisonViewQuestionA | None = None
    occurrence_question: ReservedOccurrenceQuestionA | None = None
    relation_question: RelationScopeQuestionA | None = None
    future_question: FutureEquivalenceQuestionA | None = None


class CommonViewFactsA(FrozenModel):
    request: CommonViewRequestA
    values: FrozenMap = Field(default_factory=FrozenMap)
    descriptive_facts: FrozenMap = Field(default_factory=FrozenMap)
    missing_refs: tuple[Ref,...] = ()
    authority: None = None


class CommonViewReturnA(FrozenModel):
    facts: CommonViewFactsA
    canonical_claim_current: bool
    original_question_ref: Ref
    consumed_term_ref: Ref | None = None
    consumed_claim_ref: Ref | None = None
    canonical_values: FrozenMap = Field(default_factory=FrozenMap)
    missing_refs: tuple[Ref,...] = ()
    original_parent_goal_ref: Ref
    original_consumer_ref: Ref
    next_item_ref: Ref
    source_disposition_ref: Ref | None = None
    authority: None = None
