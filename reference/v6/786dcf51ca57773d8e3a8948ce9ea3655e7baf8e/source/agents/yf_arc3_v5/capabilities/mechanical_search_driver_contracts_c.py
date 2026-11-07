"""Exact K09 on-demand requests: primitive payloads and named STEP providers."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_common_contracts_c import SearchDomainInputC, SearchResultC
from .mechanical_contracts_b import MechanicalRequestB
from .mechanical_step_contracts_c import ExternalStepDispatchResultC
from .rigid_edit_search_contracts_c import RigidEditSearchTemplateC


class SearchPrimitiveC(FrozenModel):
    primitive_ref: Ref
    action_ref: Ref
    data: FrozenMap
    cost: int = Field(ge=0)


class SearchProviderC(FrozenModel):
    model_ref: Ref
    kernel_ref: Ref
    template: MechanicalRequestB | RigidEditSearchTemplateC


class SearchDriverInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_driver_input_c.v1"
    query: SearchDomainInputC
    primitives: tuple[SearchPrimitiveC, ...] = Field(max_length=256)
    providers: tuple[SearchProviderC, ...] = Field(min_length=1, max_length=128)
    pure_rigid_batch: bool = False


class SearchDriverSessionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_driver_session_c.v1"
    request: SearchDriverInputC
    result: SearchResultC
    actual_step_call_count: int = Field(ge=0)
    failed_return: Ref | None = None
    pending_steps_present: bool
    step_budget_remaining: bool
    facts: FrozenMap
    pure_rigid_kernel_call_count: int = Field(default=0, ge=0)
    pure_rigid_native_node_count: int = Field(default=0, ge=0)
    pure_rigid_batch_count: int = Field(default=0, ge=0)
    rigid_batch_frontier: FrozenMap = Field(default_factory=FrozenMap)


class SearchNextStepInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_next_step_input_c.v1"
    session: SearchDriverSessionC
    needed: FrozenMap


class SearchStepAppendInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_step_append_input_c.v1"
    session: SearchDriverSessionC
    dispatched: ExternalStepDispatchResultC


class SearchDriverResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_driver_response_input_c.v1"
    session: SearchDriverSessionC
    source_status: Ref
    missing_cause: Ref | None
