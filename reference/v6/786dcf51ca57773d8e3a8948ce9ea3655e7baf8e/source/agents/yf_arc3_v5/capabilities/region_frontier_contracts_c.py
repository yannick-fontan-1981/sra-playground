"""Sealed spatial provenance is independent of transient region state."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref


class RegionCellObservationC(FrozenModel):
    cell_ref: Ref
    geometry: FrozenMap
    observation_ref: Ref
    actual_visible: bool


class RegionFacetC(FrozenModel):
    region_ref: Ref
    layer_ref: Ref | None
    identity_indicators: FrozenMap
    image_signature_ref: Ref
    epoch: int = Field(ge=0)
    sealed_frame_sequence: int = Field(ge=0)
    evidence_revision_ref: Ref
    observation_ref: Ref
    actual_sealed_observation: bool
    cells: tuple[RegionCellObservationC, ...] = Field(default=(), max_length=65536)
    dynamic_state: FrozenMap


class RegionFrontierInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.region_frontier_input_c.v1"
    current: RegionFacetC
    recalled: RegionFacetC | None
    current_epoch: int = Field(ge=0)
    current_frame_sequence: int = Field(ge=0)
    current_evidence_revision_ref: Ref
    parent_goal_ref: Ref
    useful_question_ref: Ref
    necessary_unknown_region: bool
    current_binding_evidence_refs: tuple[Ref, ...]
    reveal_operation_ref: Ref | None
    local_sensing_ref: Ref | None
    traversability_probe_ref: Ref | None
    return_route_ref: Ref | None
    recovery_cost: int = Field(ge=0)
    probe_cost: int = Field(ge=0)
    remaining_resource_budget: int = Field(ge=0)
    actual_costs_known: bool
    protected_conditions_current: bool


class RegionFrontierFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.region_frontier_facts_c.v1"
    facts: FrozenMap
    admissible_current_cell_refs: tuple[Ref, ...]
    admissible_recalled_cell_refs: tuple[Ref, ...]
    retained_region_refs: tuple[Ref, ...]


class RegionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.region_decision_input_c.v1"
    request: RegionFrontierInputC
    measured: RegionFrontierFactsC
    source_binding_disposition_ref: Ref
    source_disposition_ref: Ref
    binding_policy_ref: Ref
    frontier_policy_ref: Ref


class RegionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.region_decision_c.v1"
    source_disposition_ref: Ref
    source_binding_disposition_ref: Ref
    frozen_request: RegionFrontierInputC
    frozen_measurement: RegionFrontierFactsC
    binding_policy_ref: Ref
    frontier_policy_ref: Ref
    parent_goal_ref: Ref
    useful_question_ref: Ref
    current_facet: RegionFacetC
    geometry_records: tuple[RegionCellObservationC, ...]
    retained_recalled_facet: RegionFacetC | None
    current_dynamic_state: FrozenMap
    current_write_permitted: bool
    current_geometry_provenance_ref: Ref
    recalled_geometry_provenance_ref: Ref | None
    retained_region_refs: tuple[Ref, ...]
    local_experiment_refs: tuple[Ref, ...]
    eligible_local_experiment_refs: tuple[Ref, ...]
    proposed_action: None = None
