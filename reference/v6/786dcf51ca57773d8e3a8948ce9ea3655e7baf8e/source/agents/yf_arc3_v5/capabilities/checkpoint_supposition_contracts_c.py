"""Five explicit checkpoint questions distinguish requested scope from annotations and spare objects."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .typed_mask_contracts_c import TypedMaskRelationInputC
from .production_supposition_contracts_c import NormalizedPatternUnitC
from .transport_supposition_contracts_c import ScopedTransportObservationC
from .goal_supposition_contracts_c import GoalSuppositionFactsC
from .indexed_sequence_contracts_c import IndexedSequenceMeasurementC


class RailBayAssignmentC(FrozenModel):
    bay_ref: Ref
    declared_requested_type_ref: Ref
    supplied_type_ref: Ref | None
    quiescent_frame_ref: Ref
    request_binding_evidence_refs: tuple[Ref, ...]
    actual_supply_evidence_refs: tuple[Ref, ...]


class CadencedRailSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cadenced_rail_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    elongated_support_bay_evidence_refs: tuple[Ref, ...]
    typed_positive_negative_motif_evidence_refs: tuple[Ref, ...]
    post_movement_arm_transfer_evidence_refs: tuple[Ref, ...]
    requested_bay_type_map: FrozenMap
    requested_bay_set_evidence_refs: tuple[Ref, ...]
    quiescent_frame_ref: Ref
    quiescent_checkpoint_reached: bool | None
    quiescent_checkpoint_evidence_refs: tuple[Ref, ...]
    assignments: tuple[RailBayAssignmentC, ...] = Field(max_length=1024)
    supply_inventory_complete: bool


class FixedOriginSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.fixed_origin_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    ordered_strip_evidence_refs: tuple[Ref, ...]
    selectable_origin_evidence_refs: tuple[Ref, ...]
    topology_and_distinct_launch_evidence_refs: tuple[Ref, ...]
    acquired_program_word: tuple[Ref, ...] = Field(max_length=1024)
    current_program_word: tuple[Ref, ...] = Field(max_length=1024)
    executed_program_word: tuple[Ref, ...] = Field(max_length=1024)
    whole_program_identity_evidence_refs: tuple[Ref, ...]
    complete_execution: bool | None
    actual_execution_evidence_refs: tuple[Ref, ...]
    alive_at_checkpoint: bool | None
    life_checkpoint_evidence_refs: tuple[Ref, ...]
    at_accepting_destination: bool | None
    acceptance_checkpoint_evidence_refs: tuple[Ref, ...]
    initial_choice_passes_filter: bool | None
    initial_filter_evidence_refs: tuple[Ref, ...]


class ChartObjectEvidenceC(FrozenModel):
    object_ref: Ref
    annotated_room_ref: Ref
    chart_annotation_evidence_refs: tuple[Ref, ...]
    current_room_ref: Ref
    independently_currently_available: bool | None
    current_object_identity_evidence_refs: tuple[Ref, ...]


class RoomTransitionExampleC(ScopedTransportObservationC):
    primitive_ref: Ref
    room_before_ref: Ref
    room_after_ref: Ref
    actual_transition_evidence_refs: tuple[Ref, ...]
    event_order_evidence_refs: tuple[Ref, ...]


class ChartedRoomSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.charted_room_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    partial_chart_local_view_scale_evidence_refs: tuple[Ref, ...]
    inventory_signature_evidence_refs: tuple[Ref, ...]
    locked_border_evidence_refs: tuple[Ref, ...]
    transitions: tuple[RoomTransitionExampleC, ...] = Field(max_length=256)
    annotations: tuple[ChartObjectEvidenceC, ...] = Field(max_length=1024)
    current_room_ref: Ref
    accepting_room_ref: Ref
    current_room_goal_binding_evidence_refs: tuple[Ref, ...]
    alive_at_checkpoint: bool | None
    life_checkpoint_evidence_refs: tuple[Ref, ...]
    permissions_satisfied: bool | None
    permission_evidence_refs: tuple[Ref, ...]
    event_order_checkpoint_satisfied: bool | None
    event_order_checkpoint_evidence_refs: tuple[Ref, ...]


class AdhesionAssignmentC(FrozenModel):
    crate_ref: Ref
    boundary_ref: Ref
    settled_frame_ref: Ref
    independently_adhered: bool | None
    physical_adhesion_evidence_refs: tuple[Ref, ...]
    compatible_boundary_relation: TypedMaskRelationInputC
    expected_geometric_relation_value: bool
    boundary_relation_semantic_evidence_refs: tuple[Ref, ...]


class GravityAdhesionSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.gravity_adhesion_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    common_input_until_rest_evidence_refs: tuple[Ref, ...]
    boundary_latch_evidence_refs: tuple[Ref, ...]
    shared_mode_acquire_release_evidence_refs: tuple[Ref, ...]
    required_crate_refs: tuple[Ref, ...] = Field(max_length=256)
    required_crate_set_evidence_refs: tuple[Ref, ...]
    settled_frame_ref: Ref
    settled_state_evidence_refs: tuple[Ref, ...]
    assignments: tuple[AdhesionAssignmentC, ...] = Field(max_length=1024)
    adhesion_inventory_complete: bool
    supplied_acceptance_relation: bool | None
    acceptance_relation_evidence_refs: tuple[Ref, ...]


class TopologicalRecolorSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.topological_recolor_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    separated_negative_space_legend_evidence_refs: tuple[Ref, ...]
    palette_connected_field_change_evidence_refs: tuple[Ref, ...]
    editable_field: NormalizedPatternUnitC
    derived_target: NormalizedPatternUnitC
    whole_editable_domain_evidence_refs: tuple[Ref, ...]
    internal_background_and_pocket_evidence_refs: tuple[Ref, ...]
    supported_target_derivation_evidence_refs: tuple[Ref, ...]
    actual_write_contract_satisfied: bool | None
    write_contract_evidence_refs: tuple[Ref, ...]
    terminal_contract_satisfied: bool | None
    terminal_contract_evidence_refs: tuple[Ref, ...]
    max_total_projected_slots: int = Field(ge=0)


class CheckpointSuppositionFactsC(GoalSuppositionFactsC):
    schema_version: Ref = "yf_arc3_v5.checkpoint_supposition_facts_c.v1"
    indexed_measurements: tuple[IndexedSequenceMeasurementC, ...] = ()


class CheckpointSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.checkpoint_supposition_decision_input_c.v1"
    request: CadencedRailSuppositionInputC | FixedOriginSuppositionInputC | ChartedRoomSuppositionInputC | GravityAdhesionSuppositionInputC | TopologicalRecolorSuppositionInputC
    measured: CheckpointSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class CheckpointSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.checkpoint_supposition_decision_c.v1"
    frozen_request: CadencedRailSuppositionInputC | FixedOriginSuppositionInputC | ChartedRoomSuppositionInputC | GravityAdhesionSuppositionInputC | TopologicalRecolorSuppositionInputC
    frozen_measurement: CheckpointSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_physical_law_terminal_or_action: None = None
