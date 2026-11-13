"""Immutable supported/partial/blocked family returns through the common collector."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot,FamilyAgendaDemand,FamilyAgendaReceipt
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .family_result_join import FamilyJoinRequest,FamilyJoinResult
from .effect_frontier_contracts_c import EffectFrontierReturnC
from .frontier_composition_contracts_d import FrontierCompositionInputD,FrontierCompositionReturnD


class FamilyReturnRecordD(FrozenModel):
    demand: FamilyAgendaDemand
    parent_why: CoupledParentWhyC
    normalized: MechanicalNormalizedReturn | None = None
    original_frontier: EffectFrontierReturnC | None = None
    equivalent_receipt: FamilyAgendaReceipt | None = None
    missing_refs: tuple[Ref,...] = Field(default=(),max_length=256)
    next_item_ref: Ref


class FamilyCollectionPlanD(FrozenModel):
    required_request_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    join_request: FamilyJoinRequest | None = None
    composition: FrontierCompositionInputD | None = None
    maximum_projection_nodes: int = Field(default=65536,ge=1,le=65536)


class FamilyCollectorInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.family_collector_input_d.v1'
    why: CoupledParentWhyC
    agenda: FamilyAgendaSnapshot
    records: tuple[FamilyReturnRecordD,...] = Field(min_length=1,max_length=128)
    plan: FamilyCollectionPlanD


class FamilyCollectorFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.family_collector_facts_d.v1'
    request: FamilyCollectorInputD
    facts: FrozenMap
    blocked_dependency_rows: tuple[FrozenMap,...]
    missing_refs: tuple[Ref,...]


class FamilyCollectorReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.family_collector_return_d.v1'
    measured: FamilyCollectorFactsD
    joined: FamilyJoinResult | None = None
    composed: FrontierCompositionReturnD | None = None
    source_disposition_ref: Ref
    next_item_ref: Ref
    action_authority: None = None
