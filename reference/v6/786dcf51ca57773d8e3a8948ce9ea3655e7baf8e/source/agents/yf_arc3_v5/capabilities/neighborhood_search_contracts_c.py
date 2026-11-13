"""Native D templates and source-owned goal contracts for common K09 ROUTE."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_common_contracts_c import SearchDomainInputC, SearchResultC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .neighborhood_pattern_construction import NeighborhoodInput
from .neighborhood_step_contracts_c import NeighborhoodStepInputC, NeighborhoodStepDispatchC


class NeighborhoodSearchPrimitiveC(FrozenModel):
    primitive_ref: Ref
    action_ref: Ref
    native_primitive: NeighborhoodInput
    cost: int = Field(ge=0)


class NeighborhoodSearchInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_search_input_c.v1"
    query: SearchDomainInputC
    primitives: tuple[NeighborhoodSearchPrimitiveC, ...] = Field(max_length=256)
    providers: tuple[NeighborhoodStepInputC, ...] = Field(min_length=1, max_length=128)
    source_goal_contract_ref: Ref


class NeighborhoodSearchSessionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_search_session_c.v1"
    request: NeighborhoodSearchInputC
    result: SearchResultC
    actual_step_call_count: int = Field(ge=0)
    pending_steps_present: bool
    step_budget_remaining: bool
    last_return: MechanicalNormalizedReturn | None = None
    facts: FrozenMap


class NeighborhoodSearchNextInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_search_next_input_c.v1"
    session: NeighborhoodSearchSessionC
    needed: FrozenMap


class NeighborhoodSearchAppendInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_search_append_input_c.v1"
    session: NeighborhoodSearchSessionC
    dispatched: NeighborhoodStepDispatchC
    source_accept_goal: bool


class NeighborhoodSearchAcceptInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_search_accept_input_c.v1"
    session: NeighborhoodSearchSessionC
    dispatched: NeighborhoodStepDispatchC


class NeighborhoodSearchResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_search_response_input_c.v1"
    session: NeighborhoodSearchSessionC
    source_status: Ref
    missing_cause: Ref | None
