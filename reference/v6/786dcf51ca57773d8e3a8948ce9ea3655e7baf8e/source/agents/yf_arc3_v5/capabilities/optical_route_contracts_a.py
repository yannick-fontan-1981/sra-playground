"""Source-supplied optical graph vocabulary and exact common-search template."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .mechanical_common_contracts_c import SearchDomainInputC


class OpticalRouteActionA(FrozenModel):
    model_ref: Ref
    source_body_ref: Ref
    direction_ref: Ref
    action_ref: Ref
    cost: int = Field(ge=0)
    evidence_ref: Ref


class OpticalRouteInputA(FrozenModel):
    query: SearchDomainInputC
    terminal_contract: FrozenMap
    actions: tuple[OpticalRouteActionA, ...] = Field(min_length=1, max_length=4096)
    cost_law_ref: Literal['ADDITIVE_RAY_EDGE_COST']
