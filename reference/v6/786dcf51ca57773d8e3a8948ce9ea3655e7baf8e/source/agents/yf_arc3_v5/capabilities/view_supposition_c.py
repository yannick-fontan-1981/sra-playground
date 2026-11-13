"""Bounded exact view conditions never fabricate occupancy, authentication or submission."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .view_supposition_contracts_c import (VoxelViewSuppositionInputC, PreviewPackingSuppositionInputC,
    ProfileWorkbenchSuppositionInputC, AxialFieldSuppositionInputC, TemporalFragmentSuppositionInputC,
    ViewSuppositionDecisionInputC, ViewSuppositionDecisionC)
from .goal_supposition_contracts_c import GoalSuppositionFactsC
from .goal_supposition_c import _all_goal_values
from .structural_supposition_c import _scope_current, _typed_relation, _point


def measure_voxel_view_supposition(value: VoxelViewSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    measured, scoped = _typed_relation(value.visible_signature_equal, value.scope)
    request = value.visible_signature_equal
    qualified = (scoped and request.operator == "EQUAL" and request.required_left_kind == request.required_right_kind == "RECOGNITION"
        and bool(value.view_equivalence_binding_evidence_refs))
    return GoalSuppositionFactsC(mask_measurements=(measured,), measurements=(FrozenMap({
        "declared_view_equivalence_ref": value.declared_view_equivalence_ref,
        "visible_construction_signature_equal": measured.geometric_relation_value if qualified else None,
        "creator_occupancy_requirement": value.creator_occupancy_requirement if current and value.creator_occupancy_requirement_evidence_refs else None,
        "unique_cube_count_requirement": value.unique_cube_count_requirement if current and value.cube_count_requirement_evidence_refs else None,
        "visible_signature_infers_unique_occupancy_or_count": False}),), facts=FrozenMap({"scope_current": current,
        "visible_voxel_equivalence_question_supported": current and bool(value.shared_isometric_edge_face_evidence_refs)
            and bool(value.wireframe_create_erase_evidence_refs) and bool(value.reduced_reference_evidence_refs),
        "voxel_projection_or_terminal_law_confirmed": False}))


def _packing_mask_current(mask, scope, board, basis_kind):
    return (mask.epoch == scope.epoch and mask.revision_ref == scope.revision_ref
        and mask.scene_ref == board.scene_ref and mask.native_frame_ref == board.native_frame_ref
        and mask.coordinate_basis_ref == board.coordinate_basis_ref and mask.support_complete
        and bool(mask.evidence_refs) and mask.semantic_premises_current and bool(mask.semantic_support_refs)
        and mask.origin == "OBSERVED"
        and all(point.depth is not None if basis_kind == "LOGICAL_CELL_3D" else point.depth is None for point in mask.support))


def measure_preview_packing_supposition(value: PreviewPackingSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    board = value.board_mask
    expected = set(value.complete_piece_refs)
    pieces = {item.piece_ref: item for item in value.pieces}
    count = len(board.support) + sum(len(item.occupied_mask.support) for item in value.pieces)
    bounded = count > value.max_input_support_points
    known = (current and not bounded and bool(value.current_frame_binding_evidence_refs)
        and bool(value.piece_population_evidence_refs) and value.piece_inventory_complete
        and len(expected) == len(value.complete_piece_refs) and len(pieces) == len(value.pieces) and set(pieces) == expected
        and board.kind == "RECEIVING_APERTURE" and _packing_mask_current(board, value.scope, board, value.coordinate_basis_kind))
    rows, counted_masks, unknown = [], [], False
    for item in value.pieces:
        held = item.held_preview
        include = not held or (bool(value.acceptance_law_evidence_refs) and value.held_preview_counts_in_partition is True)
        unknown = unknown or (held and (not value.acceptance_law_evidence_refs or value.held_preview_counts_in_partition is None))
        supported = (known and item.occupied_mask.owner_ref == item.piece_ref and item.occupied_mask.kind == "OCCUPIED_BODY"
            and _packing_mask_current(item.occupied_mask, value.scope, board, value.coordinate_basis_kind)
            and bool(item.piece_identity_evidence_refs) and bool(item.placement_semantic_evidence_refs))
        unknown = unknown or not supported
        if include and supported:
            counted_masks.append(item.occupied_mask)
        rows.append(FrozenMap({"piece_ref": item.piece_ref, "held_preview": held,
            "piece_scope_qualified": supported, "included_under_supplied_acceptance": include and supported,
            "preview_overlap_before_release_is_physical_illegality": False}))
    partition, outside, overlap, missing = None, (), (), ()
    if known and not unknown:
        domain = {_point(point) for point in board.support}
        counts = {}
        for mask in counted_masks:
            for key in sorted({_point(point) for point in mask.support}):
                counts[key] = counts.get(key, 0) + 1
        outside = tuple(sorted(set(counts) - domain))
        overlap = tuple(sorted(point for point in counts if counts[point] > 1))
        missing = tuple(sorted(domain - set(counts)))
        partition = not outside and not overlap and not missing
    rows.append(FrozenMap({"strict_board_partition": partition, "outside_points": outside,
        "multiply_covered_points": overlap, "uncovered_points": missing, "supplied_point_count": count}))
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "complete_preview_population_partition_question_supported": current and bool(value.shaped_board_piece_transform_evidence_refs)
            and bool(value.pre_release_preview_overlap_evidence_refs) and bool(value.piece_population_evidence_refs),
        "piece_domain_open": bounded or unknown, "strict_partition_under_held_preview_law": partition,
        "packing_placement_or_terminal_law_confirmed": False}))


def measure_profile_workbench_supposition(value: ProfileWorkbenchSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    required = set(value.required_lock_refs)
    population = current and len(required) == len(value.required_lock_refs) and bool(value.real_lock_request_evidence_refs)
    accepted, ambiguous, rows = set(), False, []
    receipt_refs = tuple(item.receipt_ref for item in value.receipts)
    unique = len(set(receipt_refs)) == len(receipt_refs)
    for item in value.receipts:
        qualified = (population and unique and item.episode_ref == value.scope.episode_ref
            and item.acquired_epoch <= value.scope.epoch and bool(item.acquisition_evidence_refs)
            and item.current_epoch == value.scope.epoch and item.current_revision_ref == value.scope.revision_ref
            and item.current_scope_ref == value.scope.scope_ref and bool(item.current_receipt_revalidation_evidence_refs))
        if qualified and item.accepted is True and item.receipt_persists_now is True:
            accepted.add(item.lock_ref)
        ambiguous = ambiguous or (item.lock_ref in required and (not qualified or item.accepted is None or item.receipt_persists_now is None))
        rows.append(FrozenMap({"receipt_ref": item.receipt_ref, "lock_ref": item.lock_ref, "acquired_epoch": item.acquired_epoch,
            "receipt_scope_revalidated": qualified, "accepted_receipt_persists": _all_goal_values((item.accepted, item.receipt_persists_now)) if qualified else None,
            "current_key_profile_replaces_prior_receipt": False}))
    coverage = (True if required <= accepted else False if value.receipt_inventory_complete and not ambiguous else None) if population else None
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "real_requested_lock_receipt_question_supported": population and bool(value.ordered_profile_transform_station_evidence_refs)
            and bool(value.matching_request_profile_evidence_refs) and bool(value.separate_held_focus_evidence_refs),
        "all_real_requested_locks_have_accepted_receipts": coverage,
        "current_profiles_after_acquisition_are_extra_terminal_goals": False, "workbench_authentication_law_confirmed": False}))


def measure_axial_field_supposition(value: AxialFieldSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    unique = len({item.body_ref for item in value.bodies}) == len(value.bodies)
    rows, positive, unknown = [], False, False
    for item in value.bodies:
        admissible = item.admissible if current and unique and item.current_admissibility_evidence_refs else None
        occupied = item.occupies_target if current and unique and item.actual_target_occupation_evidence_refs else None
        positive = positive or (admissible is True and occupied is True)
        unknown = unknown or _all_goal_values((admissible, occupied)) is None
        rows.append(FrozenMap({"body_ref": item.body_ref, "admissible": admissible, "occupies_target": occupied}))
    some = True if positive else False if current and unique and value.body_inventory_complete and not unknown else None
    stable = value.normal_global_stable_closure if current and value.stable_closure_evidence_refs else None
    uncapped = not value.guard_cap_disqualified if current and value.guard_cap_evidence_refs and value.guard_cap_disqualified is not None else None
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "admissible_body_globally_stable_target_question_supported": current and bool(value.opposite_colored_side_evidence_refs)
            and bool(value.persistent_selection_rotation_evidence_refs) and bool(value.compatible_target_multiple_body_motion_evidence_refs),
        "some_admissible_body_at_target_after_normal_uncapped_closure": _all_goal_values((some, stable, uncapped)),
        "transient_target_passage_substitutes_stable_closure": False, "axial_motion_or_terminal_law_confirmed": False}))


def measure_temporal_fragment_supposition(value: TemporalFragmentSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    measured, scoped = _typed_relation(value.exact_window_equal, value.scope)
    request = value.exact_window_equal
    active = current and bool(value.current_photo_evidence_refs) and value.candidate_photo_ref == value.current_photo_ref
    exact = (measured.geometric_relation_value if scoped and active and value.current_photo_window_binding_evidence_refs
        and request.operator == "EQUAL" and request.required_left_kind == request.required_right_kind == "RECOGNITION" else None)
    submitted = (value.submitted_photo_ref == value.current_photo_ref and value.submitted_point is not None
        and value.submitted_window_relation_ref == request.relation_ref
        if current and value.actual_submission_evidence_refs else None)
    designated = value.point_designates_window if current and value.point_window_binding_evidence_refs else None
    accepted = value.independent_submission_accepted if current and value.acceptance_receipt_evidence_refs else None
    return GoalSuppositionFactsC(mask_measurements=(measured,), measurements=(FrozenMap({
        "current_photo_ref": value.current_photo_ref, "candidate_photo_ref": value.candidate_photo_ref,
        "exact_window_in_active_photo": exact, "actual_point_submitted_in_active_photo": submitted,
        "point_designates_window": designated, "independently_accepted": accepted,
        "remembering_or_seeking_photo_is_submission": False}),), facts=FrozenMap({"scope_current": current,
        "active_photo_exact_point_question_supported": current and bool(value.reference_related_photo_evidence_refs)
            and bool(value.indexed_filmstrip_observe_navigate_evidence_refs),
        "accepted_point_exact_reference_window_in_active_photo": _all_goal_values((exact, submitted, designated, accepted)),
        "playback_initial_view_is_unchanged_world": False, "fragment_clock_or_terminal_law_confirmed": False}))


def assemble_view_supposition(value: ViewSuppositionDecisionInputC) -> ViewSuppositionDecisionC:
    return ViewSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
