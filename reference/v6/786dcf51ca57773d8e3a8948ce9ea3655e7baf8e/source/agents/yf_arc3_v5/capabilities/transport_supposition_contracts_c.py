"""Current observational premises for four transport questions, never an ACT."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC, VisibleGraphInputC, LayerContactInputC, StructuralSuppositionFactsC
from .typed_mask_contracts_c import TypedMaskRelationInputC
from .contracts import PiercingIntersectionInput, PiercingIntersectionMeasurements


class ScopedTransportObservationC(FrozenModel):
    example_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    sealed: bool
    evidence_refs: tuple[Ref, ...]


class GraphLandingExampleC(ScopedTransportObservationC):
    primitive_ref: Ref
    before_node_ref: Ref
    after_node_ref: Ref
    before_position: tuple[int, int]
    after_position: tuple[int, int]
    actual_actor_movement_evidence_refs: tuple[Ref, ...]
    node_pose_evidence_refs: tuple[Ref, ...]
    automatic_peer_ref: Ref | None
    peer_before_position: tuple[int, int] | None
    peer_after_position: tuple[int, int] | None
    post_direct_phase_evidence_refs: tuple[Ref, ...]
    landing_occupied_before: bool | None
    landing_occupied_after: bool | None
    landing_inventory_evidence_refs: tuple[Ref, ...]
    independently_unsafe_after: bool | None
    unsafe_relation_evidence_refs: tuple[Ref, ...]


class ReactiveGraphSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_graph_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    graph: VisibleGraphInputC
    alternating_landing_tile_evidence_refs: tuple[Ref, ...]
    logical_position_basis_evidence_refs: tuple[Ref, ...]
    smallest_tile_displacement: tuple[int, int] | None
    smallest_tile_evidence_refs: tuple[Ref, ...]
    oriented_peer_refs: tuple[Ref, ...] = Field(max_length=128)
    oriented_peer_evidence_refs: tuple[Ref, ...]
    examples: tuple[GraphLandingExampleC, ...] = Field(max_length=256)


class QuantityIdentityExampleC(ScopedTransportObservationC):
    actuator_ref: Ref
    quantities_before: FrozenMap
    quantities_after: FrozenMap
    quantity_inventory_complete: bool
    boundary_exchange_zero_evidence_refs: tuple[Ref, ...]
    tagged_body_ref: Ref
    tagged_position_before: tuple[int, int]
    tagged_position_after: tuple[int, int]
    persistent_tag_identity_evidence_refs: tuple[Ref, ...]


class QuantityIdentitySuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.quantity_identity_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    tagged_body_ref: Ref
    tagged_body_evidence_refs: tuple[Ref, ...]
    resting_on_transferable_material_evidence_refs: tuple[Ref, ...]
    matching_wall_marker_evidence_refs: tuple[Ref, ...]
    distinct_actuator_refs: tuple[Ref, ...] = Field(max_length=128)
    actuator_identity_evidence_refs: tuple[Ref, ...]
    distinct_passage_shape_evidence_refs: tuple[Ref, ...]
    examples: tuple[QuantityIdentityExampleC, ...] = Field(max_length=256)


class CargoOrientationExampleC(ScopedTransportObservationC):
    cargo_ref: Ref
    receptacle_ref: Ref
    facing_normal: tuple[int, int]
    reference_to_cargo_vector: tuple[int, int]
    oriented_face_evidence_refs: tuple[Ref, ...]
    outline_changed: bool | None
    outline_evidence_refs: tuple[Ref, ...]
    independently_attached: bool | None
    attachment_evidence_refs: tuple[Ref, ...]
    actor_ref: Ref | None
    actor_intervention_evidence_refs: tuple[Ref, ...]
    delivered_refs_before: tuple[Ref, ...]
    delivered_refs_after: tuple[Ref, ...]
    delivery_inventory_complete: bool
    delivery_evidence_refs: tuple[Ref, ...]


class OrientedCargoSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.oriented_cargo_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    cargo_refs: tuple[Ref, ...] = Field(max_length=128)
    repeated_cargo_evidence_refs: tuple[Ref, ...]
    receptacle_ref: Ref
    compatible_receptacle_relation: TypedMaskRelationInputC
    face_and_outline_role_evidence_refs: tuple[Ref, ...]
    examples: tuple[CargoOrientationExampleC, ...] = Field(max_length=256)
    layer_contacts: LayerContactInputC | None = None


class PiercingOrderSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.piercing_order_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    handle_ref: Ref
    rail_handle_evidence_refs: tuple[Ref, ...]
    variable_rod_evidence_refs: tuple[Ref, ...]
    movable_piece_evidence_refs: tuple[Ref, ...]
    homologous_rooted_reference_evidence_refs: tuple[Ref, ...]
    desired_support_evidence_refs: tuple[Ref, ...]
    fixed_receiver_refs: tuple[Ref, ...] = Field(max_length=16)
    receiver_role_evidence_refs: tuple[Ref, ...]
    geometry: PiercingIntersectionInput
    geometry_scope_evidence_refs: tuple[Ref, ...]
    piece_support_relation_evidence: FrozenMap
    max_support_points: int = Field(ge=0)


class TransportSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.transport_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    graph_measurement: StructuralSuppositionFactsC | None = None
    layer_measurement: StructuralSuppositionFactsC | None = None
    piercing_measurement: PiercingIntersectionMeasurements | None = None
    actual_support_point_visits: int | None = Field(default=None, ge=0)
    piercing_input_point_count: int = Field(default=0, ge=0)


class TransportSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.transport_supposition_decision_input_c.v1"
    request: ReactiveGraphSuppositionInputC | QuantityIdentitySuppositionInputC | OrientedCargoSuppositionInputC | PiercingOrderSuppositionInputC
    measured: TransportSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class TransportSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.transport_supposition_decision_c.v1"
    frozen_request: ReactiveGraphSuppositionInputC | QuantityIdentitySuppositionInputC | OrientedCargoSuppositionInputC | PiercingOrderSuppositionInputC
    frozen_measurement: TransportSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_law_goal_or_action: None = None
