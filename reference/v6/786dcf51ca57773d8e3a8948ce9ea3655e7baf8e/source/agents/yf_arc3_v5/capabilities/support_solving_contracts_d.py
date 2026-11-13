"""Goal-owned K22 questions; exact calculations reuse the sealed frontier."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .effect_frontier_contracts_c import EffectFrontierInputC, EffectFrontierReturnC


class SupportSolvingInputD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.support_solving_input_d.v1'
    frontier: EffectFrontierInputC
    destination_predicate: FrozenMap
    useful_region_ref: Ref
    connecting_configuration_ref: Ref
    staging_predicate: FrozenMap
    permission_dependency_refs: tuple[Ref, ...] = Field(max_length=128)
    connection_dependency_refs: tuple[Ref, ...] = Field(max_length=128)
    requested_question: Literal['SUPPORT', 'GEOMETRY', 'MOVE', 'PERMISSION', 'CODE', 'RESTORE', 'CONNECTION']


class SupportSolvingFactsD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.support_solving_facts_d.v1'
    request: SupportSolvingInputD
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]


class SupportSolvingAnswerInputD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.support_solving_answer_input_d.v1'
    measured: SupportSolvingFactsD
    returned: EffectFrontierReturnC | None = None


class SupportSolvingAnswerD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.support_solving_answer_d.v1'
    request: SupportSolvingInputD
    returned: EffectFrontierReturnC | None = None
    missing_refs: tuple[Ref, ...]
    descriptive_facts: FrozenMap = Field(default_factory=FrozenMap)
    source_disposition_ref: Ref | None = None
    action_authority: None = None


class SupportSolvingReturnMeasureInputD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.support_solving_return_measure_input_d.v1'
    answer: SupportSolvingAnswerD


class SupportSolvingReturnFactsD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.support_solving_return_facts_d.v1'
    answer: SupportSolvingAnswerD
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]


class SupportSolvingReturnSealInputD(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.support_solving_return_seal_input_d.v1'
    measured: SupportSolvingReturnFactsD
    source_disposition_ref: Ref
