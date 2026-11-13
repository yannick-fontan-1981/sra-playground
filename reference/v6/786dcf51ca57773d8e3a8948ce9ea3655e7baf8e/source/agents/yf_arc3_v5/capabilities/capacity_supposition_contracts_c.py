"""Four scoped capacity/support questions keep editing, visibility and settled occupancy separate."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC, VisibleGraphInputC, StructuralSuppositionFactsC
from .transport_supposition_contracts_c import ScopedTransportObservationC
from .production_supposition_contracts_c import NativeMeasureBindingC
from .region_frontier_contracts_c import RegionFrontierInputC, RegionFrontierFactsC
from .typed_mask_contracts_c import TypedMaskRelationInputC, TypedMaskRelationFactsC
from .finite_flow_network import FlowRequest
from .mechanical_family_contracts_a import MechanicalFamilyResult


class ActorStackExampleC(ScopedTransportObservationC):
    stack_ref: Ref
    actor_ref: Ref
    ordered_item_refs_before: tuple[Ref, ...] = Field(max_length=1024)
    ordered_item_refs_after: tuple[Ref, ...] = Field(max_length=1024)
    whole_stack_inventory_complete: bool
    ordered_stack_identity_evidence_refs: tuple[Ref, ...]
    editable_content_changed: bool | None
    actual_edit_evidence_refs: tuple[Ref, ...]
    actor_delta: tuple[int, int] | None
    actual_actor_pose_evidence_refs: tuple[Ref, ...]
    workbench_ref: Ref | None
    edit_permission: bool | None
    edit_permission_evidence_refs: tuple[Ref, ...]
    movement_permission: bool | None
    movement_permission_evidence_refs: tuple[Ref, ...]


class ActorProgramSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.actor_program_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    stack_ref: Ref
    actor_ref: Ref
    ordered_editable_stack_evidence_refs: tuple[Ref, ...]
    separate_activation_evidence_refs: tuple[Ref, ...]
    stack_actor_binding_evidence_refs: tuple[Ref, ...]
    examples: tuple[ActorStackExampleC, ...] = Field(max_length=256)


class VisibilityPermissionC(FrozenModel):
    cell_ref: Ref
    traversable: bool | None
    traversal_evidence_refs: tuple[Ref, ...]
    mechanism_ref: Ref | None
    actuation_permitted: bool | None
    permission_evidence_refs: tuple[Ref, ...]


class VisibilityCapacitySuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.visibility_capacity_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    region: RegionFrontierInputC
    dark_room_evidence_refs: tuple[Ref, ...]
    wall_contact_control_evidence_refs: tuple[Ref, ...]
    door_evidence_refs: tuple[Ref, ...]
    finite_capacity_display_evidence_refs: tuple[Ref, ...]
    permissions: tuple[VisibilityPermissionC, ...] = Field(max_length=4096)


class FlowVesselObservationC(FrozenModel):
    vessel_ref: Ref
    envelope_signature_ref: Ref
    envelope_evidence_refs: tuple[Ref, ...]
    observed_quantity: int | None
    quantity_evidence_refs: tuple[Ref, ...]
    measured_threshold: int | None
    threshold_evidence_refs: tuple[Ref, ...]
    routing_role_ref: Ref | None
    routing_role_evidence_refs: tuple[Ref, ...]


class FiniteFlowSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.finite_flow_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    source_ref: Ref
    terminal_container_refs: tuple[Ref, ...] = Field(max_length=128)
    source_terminal_role_evidence_refs: tuple[Ref, ...]
    vessels: tuple[FlowVesselObservationC, ...] = Field(max_length=128)
    graph: VisibleGraphInputC
    reversible_valve_evidence_refs: tuple[Ref, ...]
    finite_source_evidence_refs: tuple[Ref, ...]
    native_graph: FlowRequest | None = None
    native_binding: NativeMeasureBindingC | None = None
    max_envelope_pair_checks: int = Field(ge=0)


class SettledSeatAssignmentC(FrozenModel):
    cursor_ref: Ref
    seat_ref: Ref
    sealed_frame_ref: Ref
    occupied_at_seal: bool | None
    current_identity_evidence_refs: tuple[Ref, ...]
    occupation_evidence_refs: tuple[Ref, ...]
    compatibility: TypedMaskRelationInputC


class WrapSlideSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.wrap_slide_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    movable_cell_body_evidence_refs: tuple[Ref, ...]
    compatible_cavity_evidence_refs: tuple[Ref, ...]
    coordinated_motion_or_edge_reappearance_evidence_refs: tuple[Ref, ...]
    required_cursor_refs: tuple[Ref, ...] = Field(max_length=256)
    required_population_evidence_refs: tuple[Ref, ...]
    sealed_settled_frame_ref: Ref
    settled_state_evidence_refs: tuple[Ref, ...]
    settled_assignment_inventory_complete: bool
    assignments: tuple[SettledSeatAssignmentC, ...] = Field(max_length=256)


class CapacitySuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.capacity_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    region_measurement: RegionFrontierFactsC | None = None
    graph_measurement: StructuralSuppositionFactsC | None = None
    mask_measurements: tuple[TypedMaskRelationFactsC, ...] = ()
    native_measurement: MechanicalFamilyResult | None = None
    actual_envelope_pair_checks: int = Field(default=0, ge=0)


class CapacitySuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.capacity_supposition_decision_input_c.v1"
    request: ActorProgramSuppositionInputC | VisibilityCapacitySuppositionInputC | FiniteFlowSuppositionInputC | WrapSlideSuppositionInputC
    measured: CapacitySuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class CapacitySuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.capacity_supposition_decision_c.v1"
    frozen_request: ActorProgramSuppositionInputC | VisibilityCapacitySuppositionInputC | FiniteFlowSuppositionInputC | WrapSlideSuppositionInputC
    frozen_measurement: CapacitySuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_law_terminal_or_action: None = None
