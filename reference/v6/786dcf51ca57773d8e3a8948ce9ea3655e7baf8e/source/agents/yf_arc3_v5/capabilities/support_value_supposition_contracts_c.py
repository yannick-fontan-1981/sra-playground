"""Support configurations and desired/influence models are independent hypotheses."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .contracts import (ReconfigurableSupportPacketInput, ReconfigurableSupportPacketMeasurements,
    ReconfigurableRigidGeometryInput, ReconfigurableRigidGeometryMeasurements)


class ReconfigurableSupportSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reconfigurable_support_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    remote_control_evidence_refs: tuple[Ref, ...]
    mutable_surface_evidence_refs: tuple[Ref, ...]
    body_support_evidence_refs: tuple[Ref, ...]
    separated_destination_evidence_refs: tuple[Ref, ...]
    snapshot_support_by_ref: FrozenMap
    packet: ReconfigurableSupportPacketInput
    geometry: ReconfigurableRigidGeometryInput | None
    pivot_pose_evidence_refs: tuple[Ref, ...]
    max_input_positions: int = Field(ge=0)


class ReconfigurableSupportSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reconfigurable_support_supposition_facts_c.v1"
    facts: FrozenMap
    measured_packet: ReconfigurableSupportPacketMeasurements | None
    measured_geometry: ReconfigurableRigidGeometryMeasurements | None
    retained_station_candidate_refs: tuple[Ref, ...]


class NormalizedValueCorrespondenceC(FrozenModel):
    correspondence_ref: Ref
    reference_field_ref: Ref
    surface_field_ref: Ref
    evidence_refs: tuple[Ref, ...]
    # An explicit affine hypothesis, never inferred from colors or benchmark id.
    scale_numerator: int = 1
    scale_denominator: int = Field(default=1, ge=1)
    offset: int = 0


class StencilEffectExampleC(FrozenModel):
    example_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    anchor: tuple[int, int]
    observed_changed_positions: tuple[tuple[int, int], ...] = Field(max_length=4096)
    changed_position_inventory_complete: bool
    sealed_observation: bool
    isolated_operation_evidence_refs: tuple[Ref, ...]
    every_influenced_cell_changes_evidence_refs: tuple[Ref, ...] = ()


class CoupledValueSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_value_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    desired_value_model_ref: Ref
    action_influence_model_ref: Ref
    homologous_nested_structure_evidence_refs: tuple[Ref, ...]
    distinct_embedded_stencil_evidence_refs: tuple[Ref, ...]
    reference_values: FrozenMap
    surface_values: FrozenMap
    correspondences: tuple[NormalizedValueCorrespondenceC, ...] = Field(max_length=256)
    stencil_origin: tuple[int, int]
    stencil_occupied_positions: tuple[tuple[int, int], ...] = Field(max_length=4096)
    stencil_geometry_evidence_refs: tuple[Ref, ...]
    effect_examples: tuple[StencilEffectExampleC, ...] = Field(max_length=256)
    max_position_visits: int = Field(ge=0)


class CoupledValueSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.coupled_value_supposition_facts_c.v1"
    facts: FrozenMap
    normalized_reference_rows: tuple[FrozenMap, ...]
    influence_example_rows: tuple[FrozenMap, ...]
    stencil_offsets: tuple[tuple[int, int], ...]


class SupportValueSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.support_value_supposition_decision_input_c.v1"
    request: ReconfigurableSupportSuppositionInputC | CoupledValueSuppositionInputC
    measured: ReconfigurableSupportSuppositionFactsC | CoupledValueSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class SupportValueSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.support_value_supposition_decision_c.v1"
    frozen_request: ReconfigurableSupportSuppositionInputC | CoupledValueSuppositionInputC
    frozen_measurement: ReconfigurableSupportSuppositionFactsC | CoupledValueSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_causal_law_or_action: None = None
