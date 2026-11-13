"""Source-declared projection of exact family returns into the common collector."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot
from .family_result_join import FamilyJoinRequest,FamilyJoinCandidate,FamilyJoinResult
from .effect_frontier_contracts_c import EffectFrontierReturnC


class FrontierCompositionBindingD(FrozenModel):
    candidate: FamilyJoinCandidate
    group_ref: Ref
    returned: EffectFrontierReturnC
    assignment_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    resource_path: tuple[str|int,...] | None = Field(default=None,max_length=16)


class FrontierCompositionInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.frontier_composition_input_d.v1'
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    join_request: FamilyJoinRequest
    bindings: tuple[FrontierCompositionBindingD,...] = Field(min_length=1,max_length=256)
    required_request_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    maximum_projection_nodes: int = Field(default=65536,ge=1,le=65536)


class FrontierCompositionMeasureInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.frontier_composition_measure_input_d.v1'
    request: FrontierCompositionInputD
    canonical_agenda_rows: tuple[FrozenMap,...]


class FrontierCompositionFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.frontier_composition_facts_d.v1'
    request: FrontierCompositionInputD
    facts: FrozenMap
    missing_refs: tuple[Ref,...]


class FrontierCompositionFinishInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.frontier_composition_finish_input_d.v1'
    measured: FrontierCompositionFactsD
    joined: FamilyJoinResult | None = None
    source_disposition_ref: Ref


class FrontierCompositionReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.frontier_composition_return_d.v1'
    request: FrontierCompositionInputD
    joined: FamilyJoinResult | None = None
    missing_refs: tuple[Ref,...]
    parent_why: CoupledParentWhyC
    next_item_ref: Ref
    source_disposition_ref: Ref
    action_authority: None = None
