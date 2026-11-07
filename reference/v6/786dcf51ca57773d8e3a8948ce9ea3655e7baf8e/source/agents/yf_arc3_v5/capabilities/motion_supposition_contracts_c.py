"""Motion observations motivate questions, never unknown native K42-K46 laws."""
from pydantic import Field
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC, LayerContactInputC, StructuralSuppositionFactsC
from .typed_mask_contracts_c import TypedMaskRelationInputC, TypedMaskRelationFactsC
from .recognition_boundary_contracts_c import RecognitionBoundaryInputC, RecognitionBoundaryFactsC
from .transport_supposition_contracts_c import ScopedTransportObservationC
from .contracts import OrderedSupportGeometryMeasurements


class PhasedMotionExampleC(ScopedTransportObservationC):
    primitive_refs: tuple[Ref, ...] = Field(max_length=256)
    direct_owner_ref: Ref
    direct_delta: tuple[int, int] | None
    direct_orientation_before: Ref | None = None
    direct_orientation_after: Ref | None = None
    direct_orientation_evidence_refs: tuple[Ref, ...] = ()
    exclusive_control_evidence_refs: tuple[Ref, ...]
    automatic_body_ref: Ref | None
    automatic_delta: tuple[int, int] | None
    post_direct_phase_evidence_refs: tuple[Ref, ...]
    pose_basis_evidence_refs: tuple[Ref, ...]
    terrain_before: FrozenMap
    terrain_after: FrozenMap
    terrain_edit_evidence_refs: tuple[Ref, ...]


class ContactConsequenceC(ScopedTransportObservationC):
    first_actor_ref: Ref
    second_actor_ref: Ref
    actual_contact_evidence_refs: tuple[Ref, ...]
    observed_consequence: FrozenMap
    consequence_evidence_refs: tuple[Ref, ...]
    independent_hostility: bool | None
    hostility_evidence_refs: tuple[Ref, ...]


class AutonomousInterventionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.autonomous_intervention_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    overlay_ref: Ref
    beneficiary_ref: Ref
    transparent_overlay_evidence_refs: tuple[Ref, ...]
    advance_mark_evidence_refs: tuple[Ref, ...]
    destination_ref: Ref
    destination_role_evidence_refs: tuple[Ref, ...]
    receiving_relation: TypedMaskRelationInputC
    motion: tuple[PhasedMotionExampleC, ...] = Field(max_length=256)
    contacts: tuple[ContactConsequenceC, ...] = Field(max_length=256)


class SurvivalFieldExampleC(ScopedTransportObservationC):
    primitive_refs: tuple[Ref, ...] = Field(max_length=256)
    controlled_body_ref: Ref
    life_mark_refs_before: tuple[Ref, ...] = Field(max_length=1024)
    life_mark_refs_after: tuple[Ref, ...] = Field(max_length=1024)
    life_inventory_complete: bool
    life_role_evidence_refs: tuple[Ref, ...]
    horizon_before: int | None
    horizon_after: int | None
    horizon_direction_evidence_refs: tuple[Ref, ...]
    horizon_advance_direction: Literal["INCREASING", "DECREASING"] | None = None
    power_field_before: FrozenMap
    power_field_after: FrozenMap
    power_field_inventory_complete: bool
    power_field_evidence_refs: tuple[Ref, ...]


class KitSurvivalInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.kit_survival_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    controlled_body_ref: Ref
    marked_controlled_body_evidence_refs: tuple[Ref, ...]
    finite_process_evidence_refs: tuple[Ref, ...]
    examples: tuple[SurvivalFieldExampleC, ...] = Field(max_length=256)
    contacts: tuple[ContactConsequenceC, ...] = Field(max_length=256)


class VisibilityLossExampleC(ScopedTransportObservationC):
    body_ref: Ref
    opaque_region_ref: Ref
    visible_before: bool | None
    visible_after: bool | None
    body_identity_evidence_refs: tuple[Ref, ...]
    viewport_preservation_evidence_refs: tuple[Ref, ...]
    occlusion_relation_evidence_refs: tuple[Ref, ...]


class HiddenReceptionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.hidden_reception_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    carrier_ref: Ref
    mobile_carrier_evidence_refs: tuple[Ref, ...]
    concave_support_evidence_refs: tuple[Ref, ...]
    requested_shape_evidence_refs: tuple[Ref, ...]
    incoming_body_ref: Ref
    incoming_candidate_ref: Ref
    incoming_candidate_binding_evidence_refs: tuple[Ref, ...]
    reception_relation: TypedMaskRelationInputC
    recognition: RecognitionBoundaryInputC
    visibility_examples: tuple[VisibilityLossExampleC, ...] = Field(max_length=256)
    layer_contacts: LayerContactInputC | None = None


class TrajectoryPoseC(FrozenModel):
    chronological_ordinal: int = Field(ge=0)
    position: tuple[int, int]
    actual_pose_evidence_refs: tuple[Ref, ...]


class FlightTraceC(ScopedTransportObservationC):
    launched_body_ref: Ref
    actual_launch_primitive_refs: tuple[Ref, ...] = Field(max_length=256)
    poses: tuple[TrajectoryPoseC, ...] = Field(max_length=1024)
    transient_body_identity_evidence_refs: tuple[Ref, ...]
    common_pose_basis_evidence_refs: tuple[Ref, ...]


class BallisticSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.ballistic_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    launch_source_ref: Ref
    launch_source_evidence_refs: tuple[Ref, ...]
    persistent_target_ref: Ref
    target_persistence_evidence_refs: tuple[Ref, ...]
    magnitude_control_ref: Ref
    transient_body_ref: Ref
    separate_magnitude_control_evidence_refs: tuple[Ref, ...]
    curved_transient_body_evidence_refs: tuple[Ref, ...]
    traces: tuple[FlightTraceC, ...] = Field(max_length=64)
    oriented_aperture_refs: tuple[Ref, ...] = Field(max_length=128)
    oriented_aperture_evidence_refs: tuple[Ref, ...]
    aperture_relations: tuple[TypedMaskRelationInputC, ...] = Field(max_length=128)
    max_triple_checks: int = Field(ge=0)


class SupportHighlightExampleC(ScopedTransportObservationC):
    member_ref: Ref
    position_before: tuple[int, int]
    position_after: tuple[int, int]
    pose_evidence_refs: tuple[Ref, ...]
    highlighted_after: bool | None
    highlight_evidence_refs: tuple[Ref, ...]
    reserved_after: bool | None
    independent_reservation_evidence_refs: tuple[Ref, ...]


class OrderedTransferSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.ordered_transfer_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    geometry: OrderedSupportGeometryMeasurements
    geometry_scope_evidence_refs: tuple[Ref, ...]
    homologous_shaft_evidence_refs: tuple[Ref, ...]
    horizontal_member_evidence_refs: tuple[Ref, ...]
    bottom_to_top_order_evidence_refs: tuple[Ref, ...]
    ghost_support_ref: Ref
    distinguished_ghost_evidence_refs: tuple[Ref, ...]
    support_inventory_complete: bool
    examples: tuple[SupportHighlightExampleC, ...] = Field(max_length=256)


class MotionSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.motion_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    recognition_measurement: RecognitionBoundaryFactsC | None = None
    layer_measurement: StructuralSuppositionFactsC | None = None
    ordered_geometry: OrderedSupportGeometryMeasurements | None = None
    mask_measurements: tuple[TypedMaskRelationFactsC, ...] = ()
    actual_triple_checks: int = Field(default=0, ge=0)


class MotionSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.motion_supposition_decision_input_c.v1"
    request: AutonomousInterventionInputC | KitSurvivalInputC | HiddenReceptionInputC | BallisticSuppositionInputC | OrderedTransferSuppositionInputC
    measured: MotionSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class MotionSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.motion_supposition_decision_c.v1"
    frozen_request: AutonomousInterventionInputC | KitSurvivalInputC | HiddenReceptionInputC | BallisticSuppositionInputC | OrderedTransferSuppositionInputC
    frozen_measurement: MotionSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_native_law_goal_or_action: None = None
