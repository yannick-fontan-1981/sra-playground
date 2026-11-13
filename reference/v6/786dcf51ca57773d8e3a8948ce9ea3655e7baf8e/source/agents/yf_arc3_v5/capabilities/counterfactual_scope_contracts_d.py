"""Exact deletion/replacement scope; never a new official completion proof."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref


class CounterfactualProjectionD(FrozenModel):
    quantity_ref: Ref
    dimension: Literal['TIMING','KNOWLEDGE','RESOURCE']
    field_path: tuple[str|int,...] = Field(min_length=1,max_length=16)


class CounterfactualEditScopeD(FrozenModel):
    audit_ref: Ref
    recorded_group_ref: Ref
    model_scope_ref: Ref
    model_evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    group_start: int = Field(ge=0,le=1024)
    group_stop: int = Field(ge=1,le=1024)
    replacement_word: tuple[Ref,...] = Field(default=(),max_length=1024)
    projections: tuple[CounterfactualProjectionD,...] = Field(min_length=3,max_length=128)
    discovery_scope: Literal['EXCLUDED','EXPLICITLY_MODELED'] = 'EXCLUDED'
    discovery_predicate_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    maximum_evaluations: int = Field(ge=1,le=65536)
