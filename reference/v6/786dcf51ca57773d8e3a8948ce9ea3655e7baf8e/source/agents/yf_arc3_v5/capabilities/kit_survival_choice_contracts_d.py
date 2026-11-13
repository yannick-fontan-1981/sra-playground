"""One Source-declared comparison of conditional survival witness metrics."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .mutable_kit_survival import MutableKitRequest
from .mechanical_request_contracts import MechanicalNormalizedReturn


class KitSurvivalChoiceInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.kit_survival_choice_input_d.v1'
    calculation: MutableKitRequest
    witness_refs: tuple[Ref,...] = Field(min_length=1,max_length=3)
    priority: Literal['COMMAND_COST_THEN_LIFE','LIFE_THEN_COMMAND_COST']
    unresolved_ref: Ref
    maximum_projection_nodes: int = Field(ge=1,le=65536)


class KitSurvivalBindInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.kit_survival_bind_input_d.v1'
    choice: KitSurvivalChoiceInputD
    reply: MechanicalNormalizedReturn


class KitSurvivalFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.kit_survival_facts_d.v1'
    request: KitSurvivalBindInputD
    alternative_refs: tuple[Ref,...]
    alternative_facts: FrozenMap
    missing_refs: tuple[Ref,...]


class KitSurvivalFinishInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.kit_survival_finish_input_d.v1'
    measured: KitSurvivalFactsD
    source_alternative_ref: Ref


class KitSurvivalChoiceReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.kit_survival_choice_return_d.v1'
    request: KitSurvivalChoiceInputD
    alternative_facts: FrozenMap
    missing_refs: tuple[Ref,...]
    source_alternative_ref: Ref
    witness: FrozenMap | None
    rejected_executable_words_retained: bool = False
    action_authority: None = None
