"""Explicit current native dependency projections, never a second world state."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .effect_frontier_contracts_c import EffectFrontierInputC,EffectFrontierFactsC


class SolvingStateFieldD(FrozenModel):
    native_field_ref: Ref
    value_path: tuple[str|int,...] = Field(default=(),max_length=16)
    nature_ref: Literal['OBSERVED','CONDITIONAL','MISSING']
    required_for_question: bool
    actual_scene_path: tuple[str|int,...] | None = Field(default=None,max_length=16)
    conditional_model_ref: Ref | None = None


class SolvingStateInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.solving_state_input_d.v1'
    frontier: EffectFrontierInputC
    field_projections: tuple[SolvingStateFieldD,...] = Field(min_length=1,max_length=4096)
    maximum_projection_nodes: int = Field(default=65536,ge=1,le=65536)


class SolvingStateFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.solving_state_facts_d.v1'
    request: SolvingStateInputD
    acquired: EffectFrontierFactsC
    facts: FrozenMap
    field_rows: tuple[FrozenMap,...] = Field(max_length=4096)
    missing_refs: tuple[Ref,...]


class SolvingStateReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.solving_state_return_d.v1'
    measured: SolvingStateFactsD
    source_disposition_ref: Ref
    action_authority: None = None
