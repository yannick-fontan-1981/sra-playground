"""Five view-linked questions preserve declared equivalence, receipts and real submission."""
from pydantic import Field
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .typed_mask_contracts_c import TypedMaskC, TypedMaskRelationInputC
from .goal_supposition_contracts_c import GoalSuppositionFactsC
from .common_view_scope_contracts_a import CommonViewRequestA


class VoxelViewSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.voxel_view_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    shared_isometric_edge_face_evidence_refs: tuple[Ref, ...]
    wireframe_create_erase_evidence_refs: tuple[Ref, ...]
    reduced_reference_evidence_refs: tuple[Ref, ...]
    visible_signature_equal: TypedMaskRelationInputC
    declared_view_equivalence_ref: Ref
    view_equivalence_binding_evidence_refs: tuple[Ref, ...]
    creator_occupancy_requirement: bool | None
    creator_occupancy_requirement_evidence_refs: tuple[Ref, ...]
    unique_cube_count_requirement: bool | None
    cube_count_requirement_evidence_refs: tuple[Ref, ...]


class PackingPieceObservationC(FrozenModel):
    piece_ref: Ref
    occupied_mask: TypedMaskC
    held_preview: bool
    piece_identity_evidence_refs: tuple[Ref, ...]
    placement_semantic_evidence_refs: tuple[Ref, ...]


class PreviewPackingSuppositionInputC(FrozenModel):
    common_view_request: CommonViewRequestA | None = None
    schema_version: Ref = "yf_arc3_v5.preview_packing_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    shaped_board_piece_transform_evidence_refs: tuple[Ref, ...]
    pre_release_preview_overlap_evidence_refs: tuple[Ref, ...]
    board_mask: TypedMaskC
    coordinate_basis_kind: Literal["RASTER_2D", "LOGICAL_CELL_2D", "LOGICAL_CELL_3D"]
    complete_piece_refs: tuple[Ref, ...] = Field(max_length=256)
    piece_population_evidence_refs: tuple[Ref, ...]
    piece_inventory_complete: bool
    pieces: tuple[PackingPieceObservationC, ...] = Field(max_length=256)
    held_preview_counts_in_partition: bool | None
    acceptance_law_evidence_refs: tuple[Ref, ...]
    current_frame_binding_evidence_refs: tuple[Ref, ...]
    max_input_support_points: int = Field(ge=0)


class AuthenticationReceiptMemoryC(FrozenModel):
    receipt_ref: Ref
    lock_ref: Ref
    accepted: bool | None
    acquired_epoch: int = Field(ge=0)
    episode_ref: Ref
    acquisition_evidence_refs: tuple[Ref, ...]
    current_epoch: int = Field(ge=0)
    current_revision_ref: Ref
    current_scope_ref: Ref
    receipt_persists_now: bool | None
    current_receipt_revalidation_evidence_refs: tuple[Ref, ...]


class ProfileWorkbenchSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.profile_workbench_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    ordered_profile_transform_station_evidence_refs: tuple[Ref, ...]
    matching_request_profile_evidence_refs: tuple[Ref, ...]
    separate_held_focus_evidence_refs: tuple[Ref, ...]
    required_lock_refs: tuple[Ref, ...] = Field(max_length=256)
    real_lock_request_evidence_refs: tuple[Ref, ...]
    receipts: tuple[AuthenticationReceiptMemoryC, ...] = Field(max_length=1024)
    receipt_inventory_complete: bool
    current_key_profiles: FrozenMap
    current_key_profile_evidence_refs: tuple[Ref, ...]


class StableTargetBodyC(FrozenModel):
    body_ref: Ref
    admissible: bool | None
    current_admissibility_evidence_refs: tuple[Ref, ...]
    occupies_target: bool | None
    actual_target_occupation_evidence_refs: tuple[Ref, ...]


class AxialFieldSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.axial_field_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    opposite_colored_side_evidence_refs: tuple[Ref, ...]
    persistent_selection_rotation_evidence_refs: tuple[Ref, ...]
    compatible_target_multiple_body_motion_evidence_refs: tuple[Ref, ...]
    bodies: tuple[StableTargetBodyC, ...] = Field(max_length=256)
    body_inventory_complete: bool
    normal_global_stable_closure: bool | None
    stable_closure_evidence_refs: tuple[Ref, ...]
    guard_cap_disqualified: bool | None
    guard_cap_evidence_refs: tuple[Ref, ...]


class TemporalFragmentSuppositionInputC(FrozenModel):
    common_view_request: CommonViewRequestA | None = None
    schema_version: Ref = "yf_arc3_v5.temporal_fragment_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    reference_related_photo_evidence_refs: tuple[Ref, ...]
    indexed_filmstrip_observe_navigate_evidence_refs: tuple[Ref, ...]
    current_photo_ref: Ref
    current_photo_evidence_refs: tuple[Ref, ...]
    candidate_photo_ref: Ref
    exact_window_equal: TypedMaskRelationInputC
    current_photo_window_binding_evidence_refs: tuple[Ref, ...]
    submitted_photo_ref: Ref | None
    submitted_point: tuple[int, int] | None
    actual_submission_evidence_refs: tuple[Ref, ...]
    submitted_window_relation_ref: Ref | None
    point_designates_window: bool | None
    point_window_binding_evidence_refs: tuple[Ref, ...]
    independent_submission_accepted: bool | None
    acceptance_receipt_evidence_refs: tuple[Ref, ...]


class ViewSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.view_supposition_decision_input_c.v1"
    request: VoxelViewSuppositionInputC | PreviewPackingSuppositionInputC | ProfileWorkbenchSuppositionInputC | AxialFieldSuppositionInputC | TemporalFragmentSuppositionInputC
    measured: GoalSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class ViewSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.view_supposition_decision_c.v1"
    frozen_request: VoxelViewSuppositionInputC | PreviewPackingSuppositionInputC | ProfileWorkbenchSuppositionInputC | AxialFieldSuppositionInputC | TemporalFragmentSuppositionInputC
    frozen_measurement: GoalSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_physical_law_terminal_or_action: None = None
