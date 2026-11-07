"""K24 transition receipts for the shared K09 route search, without a second BFS."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .articulated_channel_kinematics import ArtiRequest
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .mechanical_common_contracts_c import SearchDomainInputC,ExternalPrimitivePacketC


class ArticulatedRouteEdgeC(FrozenModel):
    native_request: ArtiRequest
    native_return: MechanicalNormalizedReturn
    action_ref: Ref
    primitive_ref: Ref
    cost: int = Field(ge=0)
    closure_domain_ref: Ref
    response_ref: Ref
    clock_ref: Ref
    temporal_scope_ref: Ref
    tick: int = Field(ge=0)


class ArticulatedRouteBridgeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_route_bridge_input_c.v1"
    query: SearchDomainInputC
    edges: tuple[ArticulatedRouteEdgeC,...] = Field(max_length=4096)


class ArticulatedRouteBridgeFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_route_bridge_facts_c.v1"
    query: SearchDomainInputC
    packets: tuple[ExternalPrimitivePacketC,...] = Field(max_length=4096)
    missing_refs: tuple[Ref,...]
    facts: FrozenMap


class ArticulatedRouteQueryInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_route_query_input_c.v1"
    measured: ArticulatedRouteBridgeFactsC


class ArticulatedRouteReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_route_return_input_c.v1"
    measured: ArticulatedRouteBridgeFactsC
    returned: MechanicalNormalizedReturn | None


class ArticulatedRouteReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.articulated_route_return_c.v1"
    bridge: ArticulatedRouteBridgeFactsC
    returned: MechanicalNormalizedReturn | None
    missing_refs: tuple[Ref,...]
    action_authority: None = None
