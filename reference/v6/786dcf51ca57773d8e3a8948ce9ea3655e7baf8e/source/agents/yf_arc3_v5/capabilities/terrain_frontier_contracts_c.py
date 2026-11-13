"""One hypothetical edit is assessed after full family-owned settlement."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_common_contracts_c import (ExternalPrimitivePacketC, MechanicalPredicateC,
    EventCompositionResultC, SearchDomainInputC, SearchResultC)


class TerrainCellEffectC(FrozenModel):
    cell_ref: Ref
    operation: Literal["REMOVE", "RECREATE", "NEIGHBOR_CREATE"]
    present_predicate: MechanicalPredicateC
    occurrence_ref: Ref
    role_alternatives: tuple[Literal["SUPPORT", "BLOCKER", "HAZARD", "UNKNOWN"], ...] = Field(min_length=1)
    role_support_refs: tuple[Ref, ...]


class TerrainFrontierInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.terrain_frontier_input_c.v1"
    parent_goal_ref: Ref
    current_epoch: int = Field(ge=0)
    current_revision_ref: Ref
    packet: ExternalPrimitivePacketC
    pre_action_snapshot_ref: Ref
    post_direct_snapshot_ref: Ref
    direct_event_kind_refs: tuple[Ref, ...]
    required_settlement_kind_refs: tuple[Ref, ...]
    cells: tuple[TerrainCellEffectC, ...] = Field(max_length=4096)
    preservation_predicates: tuple[MechanicalPredicateC, ...] = Field(max_length=128)
    post_edit_route: SearchDomainInputC
    source_goal_contract_ref: Ref


class TerrainScopeFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.terrain_scope_facts_c.v1"
    facts: FrozenMap


class TerrainCellEffectMeasurementC(FrozenModel):
    cell_ref: Ref
    before_present: bool | None
    after_direct_present: bool | None
    declared_effect_holds: bool | None
    xor_interpretation_contradicted: bool
    role_alternatives: tuple[Ref, ...]


class TerrainFrontierMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.terrain_frontier_measurement_c.v1"
    folded: EventCompositionResultC
    cells: tuple[TerrainCellEffectMeasurementC, ...]
    facts: FrozenMap


class TerrainFrontierDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.terrain_frontier_decision_input_c.v1"
    request: TerrainFrontierInputC
    measured: TerrainFrontierMeasurementC | None
    route: SearchResultC | None
    source_disposition_ref: Ref
    source_policy_ref: Ref


class TerrainFrontierDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.terrain_frontier_decision_c.v1"
    source_disposition_ref: Ref
    source_policy_ref: Ref
    frozen_request: TerrainFrontierInputC
    folded_settlement: EventCompositionResultC | None
    cell_effects: tuple[TerrainCellEffectMeasurementC, ...]
    post_edit_route: SearchResultC | None
    preservation_predicate_refs: tuple[Ref, ...]
    proposed_action_or_edit_commit: None = None
