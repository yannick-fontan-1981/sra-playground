"""K09 asks for missing steps; Source calls the existing K24 successor."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .articulated_solving_contracts_c import ArticulatedSolvingReturnC
from .articulated_transition_domain_c import ArticulatedTransitionDomainInputC,ArticulatedTransitionDomainFactsC,ArticulatedTransitionSessionC,ArticulatedTransitionQuestionC
from .mechanical_common_contracts_c import SearchDomainInputC,SearchResultC
from .mechanical_request_contracts import MechanicalNormalizedReturn


class ArticulatedDynamicSessionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dynamic_session_c.v1"
    returned: ArticulatedSolvingReturnC
    query: SearchDomainInputC | None
    transitions: ArticulatedTransitionSessionC | None
    search: SearchResultC | None = None
    missing_refs: tuple[Ref,...] = ()
    accounted_evaluations: int = Field(default=0,ge=0)
    actual_step_call_count: int = Field(default=0,ge=0)
    pending_steps_present: bool = False
    calculation_bound: bool = False


class ArticulatedDynamicSessionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dynamic_session_input_c.v1"
    session: ArticulatedDynamicSessionC


class ArticulatedDynamicNextInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dynamic_next_input_c.v1"
    session: ArticulatedDynamicSessionC
    needed: FrozenMap


class ArticulatedDynamicNextC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dynamic_next_c.v1"
    domain: ArticulatedTransitionDomainInputC | None
    missing_refs: tuple[Ref,...]
    needed: FrozenMap = Field(default_factory=FrozenMap)


class ArticulatedDynamicBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dynamic_bind_input_c.v1"
    session: ArticulatedDynamicSessionC
    next_request: ArticulatedDynamicNextC
    qualified: ArticulatedTransitionDomainFactsC


class ArticulatedDynamicBoundC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dynamic_bound_c.v1"
    question: ArticulatedTransitionQuestionC | None
    measured: ArticulatedTransitionDomainFactsC
    missing_refs: tuple[Ref,...]
    calculation_bound: bool
    needed: FrozenMap = Field(default_factory=FrozenMap)


class ArticulatedDynamicAppendInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_dynamic_append_input_c.v1"
    session: ArticulatedDynamicSessionC
    bound: ArticulatedDynamicBoundC
    native_return: MechanicalNormalizedReturn | None
