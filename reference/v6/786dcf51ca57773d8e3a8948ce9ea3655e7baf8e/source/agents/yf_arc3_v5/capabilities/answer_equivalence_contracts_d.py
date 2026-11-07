"""Complete answer/precondition equivalence under retained model scopes."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref


class AnswerModelD(FrozenModel):
    model_ref: Ref
    evidence_scope_ref: Ref
    observation_evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    observation_compatible: bool | None
    proposal: FrozenMap
    action_preconditions: FrozenMap
    missing_refs: tuple[Ref,...] = Field(default=(),max_length=128)


class AnswerEquivalenceInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.answer_equivalence_input_d.v1'
    evidence_scope_ref: Ref
    retained_model_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    model_rows: tuple[AnswerModelD,...] = Field(min_length=1,max_length=128)
    maximum_evaluations: int = Field(ge=1,le=65536)


class AnswerEquivalenceResultD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.answer_equivalence_result_d.v1'
    request: AnswerEquivalenceInputD
    classes: tuple[FrozenMap,...]
    facts: FrozenMap
    missing_refs: tuple[Ref,...]
    accounted_evaluations: int
    action_authority: None = None
