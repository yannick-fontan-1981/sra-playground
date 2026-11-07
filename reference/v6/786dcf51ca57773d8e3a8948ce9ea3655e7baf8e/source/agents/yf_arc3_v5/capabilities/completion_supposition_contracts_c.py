"""Seven final supposition questions retain receipts, same-carrier ancestry and full populations."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .typed_mask_contracts_c import TypedMaskRelationInputC
from .goal_supposition_contracts_c import GoalSuppositionFactsC
from .transport_supposition_contracts_c import ScopedTransportObservationC


class RelayOpticsSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relay_optics_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    remote_cyclic_controller_wire_evidence_refs: tuple[Ref, ...]
    source_terminal_evidence_refs: tuple[Ref, ...]
    joint_controller_relay_selection_evidence_refs: tuple[Ref, ...]
    first_impact_chain_evidence_refs: tuple[Ref, ...]
    actual_launched: bool | None
    launch_evidence_refs: tuple[Ref, ...]
    reached_receiver_ref: Ref | None
    required_receiver_ref: Ref
    actual_receiver_evidence_refs: tuple[Ref, ...]
    declared_propagation_law_satisfied: bool | None
    propagation_law_evidence_refs: tuple[Ref, ...]
    explicitly_required_relay_refs: tuple[Ref, ...] = Field(max_length=256)
    required_relay_goal_evidence_refs: tuple[Ref, ...]
    actually_activated_relay_refs: tuple[Ref, ...] = Field(max_length=256)
    relay_activation_evidence_refs: tuple[Ref, ...]


class QuestionReceiptC(FrozenModel):
    question_ref: Ref
    receipt_ref: Ref
    acquired_epoch: int = Field(ge=0)
    episode_ref: Ref
    accepted: bool | None
    acquisition_evidence_refs: tuple[Ref, ...]
    persists_now: bool | None
    current_epoch: int = Field(ge=0)
    current_revision_ref: Ref
    current_scope_ref: Ref
    current_revalidation_evidence_refs: tuple[Ref, ...]


class VisualSequenceSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.visual_sequence_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    ordered_cards_blank_index_evidence_refs: tuple[Ref, ...]
    separate_proposal_focus_evidence_refs: tuple[Ref, ...]
    required_question_refs: tuple[Ref, ...] = Field(max_length=256)
    required_question_set_evidence_refs: tuple[Ref, ...]
    receipts: tuple[QuestionReceiptC, ...] = Field(max_length=1024)
    receipt_inventory_complete: bool


class ConstructionBeamC(FrozenModel):
    beam_ref: Ref
    actual_target_overlap: bool | None
    target_overlap_evidence_refs: tuple[Ref, ...]
    foundation_ancestry_refs: tuple[Ref, ...] = Field(max_length=256)
    ancestry_inventory_complete: bool
    actual_ancestry_evidence_refs: tuple[Ref, ...]


class SupportedConstructionSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.supported_construction_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    stock_support_foundation_target_evidence_refs: tuple[Ref, ...]
    outline_stress_quantity_evidence_refs: tuple[Ref, ...]
    required_foundation_refs: tuple[Ref, ...] = Field(max_length=256)
    required_ancestry_evidence_refs: tuple[Ref, ...]
    beams: tuple[ConstructionBeamC, ...] = Field(max_length=1024)
    beam_inventory_complete: bool
    globally_stable: bool | None
    global_stability_evidence_refs: tuple[Ref, ...]


class AlignmentAcquisitionC(ScopedTransportObservationC):
    board_ref: Ref
    chronological_ordinal: int = Field(ge=0)
    acquisition_scope_ref: Ref
    enabled_before_input: bool | None
    access_reset_evidence_refs: tuple[Ref, ...]
    player_win_acquired: bool | None
    actual_player_acquisition_evidence_refs: tuple[Ref, ...]
    disqualifying_opponent_win: bool | None
    opponent_win_evidence_refs: tuple[Ref, ...]


class AlignmentGameSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.alignment_game_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    supports_two_marks_evidence_refs: tuple[Ref, ...]
    enabled_disabled_board_evidence_refs: tuple[Ref, ...]
    alternating_line_feedback_evidence_refs: tuple[Ref, ...]
    required_player_won_board_count: int = Field(ge=0)
    acquired_count_goal_evidence_refs: tuple[Ref, ...]
    acquisition_scope_ref: Ref
    events: tuple[AlignmentAcquisitionC, ...] = Field(max_length=1024)
    acquisition_history_complete: bool


class BoundedJoystickSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.bounded_joystick_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    remote_finite_grid_active_marker_evidence_refs: tuple[Ref, ...]
    occurrence_missing_control_evidence_refs: tuple[Ref, ...]
    reference_guidance_evidence_refs: tuple[Ref, ...]
    complete_occurrence_population: bool
    occurrence_population_evidence_refs: tuple[Ref, ...]
    whole_arrangement_equal: TypedMaskRelationInputC
    admissible_nonwrapping_placement: bool | None
    placement_evidence_refs: tuple[Ref, ...]
    advisory_destination_assignment_followed: bool | None
    advisory_status_evidence_refs: tuple[Ref, ...]


class NeighborhoodSiteC(FrozenModel):
    site_ref: Ref
    permitted: bool | None
    site_permission_evidence_refs: tuple[Ref, ...]
    exact_projection_equal: TypedMaskRelationInputC
    mask_crop_law_evidence_refs: tuple[Ref, ...]


class NeighborhoodSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    occupancy_color_change_evidence_refs: tuple[Ref, ...]
    outlined_region_reference_evidence_refs: tuple[Ref, ...]
    sites: tuple[NeighborhoodSiteC, ...] = Field(max_length=256)
    comparison_site_inventory_complete: bool
    complete_physical_body_population: bool
    physical_population_evidence_refs: tuple[Ref, ...]
    all_movement_and_influence_constraints_satisfied: bool | None
    complete_influence_model_evidence_refs: tuple[Ref, ...]


class ThreadPrefixC(FrozenModel):
    thread_ref: Ref
    inserted_prefix_length: int | None
    required_full_length: int | None
    actual_insertion_evidence_refs: tuple[Ref, ...]
    required_length_evidence_refs: tuple[Ref, ...]


class LayeredPrefixSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.layered_prefix_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    row_column_grid_next_end_evidence_refs: tuple[Ref, ...]
    palette_reorder_thread_recolor_evidence_refs: tuple[Ref, ...]
    required_thread_refs: tuple[Ref, ...] = Field(max_length=256)
    required_thread_set_evidence_refs: tuple[Ref, ...]
    threads: tuple[ThreadPrefixC, ...] = Field(max_length=256)
    thread_inventory_complete: bool
    visible_projection_equal: TypedMaskRelationInputC
    visible_projection_target_binding_evidence_refs: tuple[Ref, ...]
    hidden_decomposition_matches_authored: bool | None
    independent_hidden_decomposition_requirement: bool | None
    hidden_requirement_evidence_refs: tuple[Ref, ...]


class CompletionSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.completion_supposition_decision_input_c.v1"
    request: RelayOpticsSuppositionInputC | VisualSequenceSuppositionInputC | SupportedConstructionSuppositionInputC | AlignmentGameSuppositionInputC | BoundedJoystickSuppositionInputC | NeighborhoodSuppositionInputC | LayeredPrefixSuppositionInputC
    measured: GoalSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class CompletionSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.completion_supposition_decision_c.v1"
    frozen_request: RelayOpticsSuppositionInputC | VisualSequenceSuppositionInputC | SupportedConstructionSuppositionInputC | AlignmentGameSuppositionInputC | BoundedJoystickSuppositionInputC | NeighborhoodSuppositionInputC | LayeredPrefixSuppositionInputC
    frozen_measurement: GoalSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_physical_law_terminal_or_action: None = None
