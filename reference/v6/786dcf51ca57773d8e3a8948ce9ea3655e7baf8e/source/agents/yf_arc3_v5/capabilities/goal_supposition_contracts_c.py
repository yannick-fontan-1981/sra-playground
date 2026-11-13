"""Five goal-linked questions distinguish actual coverage, layer and delivered identities."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .typed_mask_contracts_c import TypedMaskRelationInputC, TypedMaskRelationFactsC
from .transport_supposition_contracts_c import ScopedTransportObservationC


class TupleVisitC(ScopedTransportObservationC):
    observed_epoch: int = Field(ge=0)
    episode_ref: Ref
    current_revalidation_evidence_refs: tuple[Ref, ...]
    tuple_values: tuple[Ref, ...] = Field(max_length=128)
    actual_visit_evidence_refs: tuple[Ref, ...]
    reset_scope_ref: Ref


class CyclicCoverageSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cyclic_coverage_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    independent_value_control_evidence_refs: tuple[Ref, ...]
    local_sample_cycle_evidence_refs: tuple[Ref, ...]
    current_and_visited_border_evidence_refs: tuple[Ref, ...]
    required_tuples: tuple[tuple[Ref, ...], ...] = Field(max_length=4096)
    complete_required_catalogue: bool
    required_catalogue_evidence_refs: tuple[Ref, ...]
    reset_scope_ref: Ref
    visits: tuple[TupleVisitC, ...] = Field(max_length=4096)
    complete_visit_history: bool
    current_tuple: tuple[Ref, ...] = Field(max_length=128)
    separately_required_final_tuple: tuple[Ref, ...] | None = None
    final_tuple_requirement_evidence_refs: tuple[Ref, ...] = ()


class MetricImageSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_image_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    current_top_projection_ref: Ref
    reference_ref: Ref
    irregular_support_grid_evidence_refs: tuple[Ref, ...]
    support_dependent_extent_evidence_refs: tuple[Ref, ...]
    top_layer_visibility_evidence_refs: tuple[Ref, ...]
    raster_equal: TypedMaskRelationInputC
    empty_regions_equal: TypedMaskRelationInputC
    common_scale_ref: Ref
    common_placement_ref: Ref
    licensed_transform_evidence_refs: tuple[Ref, ...]
    transform_binding_evidence_refs: tuple[Ref, ...]


class PassageLayerExampleC(ScopedTransportObservationC):
    body_ref: Ref
    cell_before: tuple[int, int]
    cell_after: tuple[int, int]
    layer_before_ref: Ref
    layer_after_ref: Ref
    actual_transfer_evidence_refs: tuple[Ref, ...]
    independent_layer_indicator_evidence_refs: tuple[Ref, ...]


class OrientedPassageSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.oriented_passage_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    controlled_body_ref: Ref
    disconnected_walkable_region_evidence_refs: tuple[Ref, ...]
    oriented_passage_glyph_evidence_refs: tuple[Ref, ...]
    examples: tuple[PassageLayerExampleC, ...] = Field(max_length=256)
    current_body_cell: tuple[int, int]
    current_layer_ref: Ref
    current_pose_layer_evidence_refs: tuple[Ref, ...]
    accepting_cell: tuple[int, int]
    required_layer_ref: Ref
    terminal_goal_binding_evidence_refs: tuple[Ref, ...]
    terminal_checkpoint_reached: bool | None
    terminal_checkpoint_evidence_refs: tuple[Ref, ...]
    resource_checkpoint_satisfied: bool | None
    resource_checkpoint_evidence_refs: tuple[Ref, ...]


class CaptureIdentityExampleC(ScopedTransportObservationC):
    target_identity_ref: Ref
    observed_epoch: int = Field(ge=0)
    episode_ref: Ref
    current_revalidation_evidence_refs: tuple[Ref, ...]
    chronological_ordinal: int = Field(ge=0)
    capture_scope_ref: Ref
    actual_contact_evidence_refs: tuple[Ref, ...]
    contact_reactive_update_scope_evidence_refs: tuple[Ref, ...]
    disappearance_observed: bool | None
    exchange_observed: bool | None
    rendering_change_evidence_refs: tuple[Ref, ...]
    independently_captured: bool | None
    capture_identity_evidence_refs: tuple[Ref, ...]


class ReactiveCaptureSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_capture_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    capture_scope_ref: Ref
    controlled_mover_reactive_peer_evidence_refs: tuple[Ref, ...]
    movable_barrier_evidence_refs: tuple[Ref, ...]
    required_target_identity_refs: tuple[Ref, ...] = Field(max_length=256)
    required_identity_set_evidence_refs: tuple[Ref, ...]
    examples: tuple[CaptureIdentityExampleC, ...] = Field(max_length=1024)
    capture_history_inventory_complete: bool


class CargoDeliveryAssignmentC(FrozenModel):
    cargo_ref: Ref
    receiver_ref: Ref
    settled_frame_ref: Ref
    delivered_now: bool | None
    current_delivery_identity_evidence_refs: tuple[Ref, ...]
    whole_body_inside_receiver: TypedMaskRelationInputC


class StationCargoSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.station_cargo_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    multicell_cargo_evidence_refs: tuple[Ref, ...]
    carrier_evidence_refs: tuple[Ref, ...]
    compatible_receiving_support_evidence_refs: tuple[Ref, ...]
    station_orientation_control_evidence_refs: tuple[Ref, ...]
    required_cargo_refs: tuple[Ref, ...] = Field(max_length=256)
    required_cargo_set_evidence_refs: tuple[Ref, ...]
    settled_frame_ref: Ref
    settled_frame_evidence_refs: tuple[Ref, ...]
    assignments: tuple[CargoDeliveryAssignmentC, ...] = Field(max_length=1024)
    delivery_inventory_complete: bool
    carrier_released: bool | None
    carrier_release_evidence_refs: tuple[Ref, ...]


class GoalSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.goal_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    mask_measurements: tuple[TypedMaskRelationFactsC, ...] = ()


class GoalSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.goal_supposition_decision_input_c.v1"
    request: CyclicCoverageSuppositionInputC | MetricImageSuppositionInputC | OrientedPassageSuppositionInputC | ReactiveCaptureSuppositionInputC | StationCargoSuppositionInputC
    measured: GoalSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class GoalSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.goal_supposition_decision_c.v1"
    frozen_request: CyclicCoverageSuppositionInputC | MetricImageSuppositionInputC | OrientedPassageSuppositionInputC | ReactiveCaptureSuppositionInputC | StationCargoSuppositionInputC
    frozen_measurement: GoalSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_physical_law_terminal_or_action: None = None
