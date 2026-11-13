"""Native K63 templates and source-owned goal contracts for common K09 ROUTE."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_common_contracts_c import SearchDomainInputC, SearchResultC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .metric_stack_contracts import StackPrimitive
from .metric_step_contracts_c import MetricStepInputC, MetricStepDispatchC


class MetricSearchPrimitiveC(FrozenModel):
    primitive_ref: Ref
    action_ref: Ref
    native_primitive: StackPrimitive
    cost: int = Field(ge=0)
    occurrence_binding: Literal["EXACT", "CURRENT_CELL_TOP", "CURRENT_SELECTED_TOP"] = "EXACT"


class MetricSearchInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_search_input_c.v1"
    query: SearchDomainInputC
    primitives: tuple[MetricSearchPrimitiveC, ...] = Field(max_length=256)
    providers: tuple[MetricStepInputC, ...] = Field(min_length=1, max_length=128)
    source_goal_contract_ref: Ref
    prior_step_call_count: int = Field(default=0, ge=0)


class MetricSearchSessionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_search_session_c.v1"
    request: MetricSearchInputC
    result: SearchResultC
    actual_step_call_count: int = Field(ge=0)
    pending_steps_present: bool
    step_budget_remaining: bool
    last_return: MechanicalNormalizedReturn | None = None
    facts: FrozenMap


class MetricSearchNextInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_search_next_input_c.v1"
    session: MetricSearchSessionC
    needed: FrozenMap


class MetricSearchAppendInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_search_append_input_c.v1"
    session: MetricSearchSessionC
    dispatched: MetricStepDispatchC
    source_accept_goal: bool


class MetricSearchAcceptInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_search_accept_input_c.v1"
    session: MetricSearchSessionC
    dispatched: MetricStepDispatchC


class MetricSearchResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_search_response_input_c.v1"
    session: MetricSearchSessionC
    source_status: Ref
    missing_cause: Ref | None
