"""Exact quantified completion descriptors retain actual acquisition and declared scope."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .completion_supposition_contracts_c import (RelayOpticsSuppositionInputC, VisualSequenceSuppositionInputC,
    SupportedConstructionSuppositionInputC, AlignmentGameSuppositionInputC, BoundedJoystickSuppositionInputC,
    NeighborhoodSuppositionInputC, LayeredPrefixSuppositionInputC, CompletionSuppositionDecisionInputC,
    CompletionSuppositionDecisionC)
from .goal_supposition_contracts_c import GoalSuppositionFactsC
from .goal_supposition_c import _all_goal_values
from .structural_supposition_c import _scope_current, _typed_relation
from .transport_supposition_c import _observation_current


def measure_relay_optics_supposition(value: RelayOpticsSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    launched = value.actual_launched if current and value.launch_evidence_refs else None
    receiver = value.reached_receiver_ref == value.required_receiver_ref if current and value.actual_receiver_evidence_refs and value.reached_receiver_ref is not None else None
    propagation = value.declared_propagation_law_satisfied if current and value.propagation_law_evidence_refs else None
    relay_requirement = None
    if current and value.required_relay_goal_evidence_refs and value.relay_activation_evidence_refs:
        relay_requirement = set(value.explicitly_required_relay_refs) <= set(value.actually_activated_relay_refs)
    conditions = (launched, receiver, propagation) if not value.explicitly_required_relay_refs else (launched, receiver, propagation, relay_requirement)
    return GoalSuppositionFactsC(measurements=(FrozenMap({"required_receiver_ref": value.required_receiver_ref,
        "reached_receiver_ref": value.reached_receiver_ref, "explicit_required_relays_activated": relay_requirement,
        "every_visible_relay_is_automatically_required": False, "internal_hops_are_external_inputs": False}),), facts=FrozenMap({
        "scope_current": current, "first_impact_terminal_receiver_question_supported": current
            and bool(value.remote_cyclic_controller_wire_evidence_refs) and bool(value.source_terminal_evidence_refs)
            and bool(value.joint_controller_relay_selection_evidence_refs) and bool(value.first_impact_chain_evidence_refs),
        "launched_chain_reaches_required_receiver_under_law": _all_goal_values(conditions),
        "relay_propagation_or_terminal_law_confirmed": False}))


def measure_visual_sequence_supposition(value: VisualSequenceSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    required = set(value.required_question_refs)
    population = current and len(required) == len(value.required_question_refs) and bool(value.required_question_set_evidence_refs)
    unique = len({item.receipt_ref for item in value.receipts}) == len(value.receipts)
    accepted, uncertain, rows = set(), False, []
    for item in value.receipts:
        scoped = (population and unique and item.episode_ref == value.scope.episode_ref and item.acquired_epoch <= value.scope.epoch
            and item.current_epoch == value.scope.epoch and item.current_revision_ref == value.scope.revision_ref
            and item.current_scope_ref == value.scope.scope_ref
            and bool(item.acquisition_evidence_refs) and bool(item.current_revalidation_evidence_refs))
        acquisition = _all_goal_values((item.accepted, item.persists_now)) if scoped else None
        if acquisition is True:
            accepted.add(item.question_ref)
        uncertain = uncertain or (item.question_ref in required and acquisition is None)
        rows.append(FrozenMap({"question_ref": item.question_ref, "receipt_ref": item.receipt_ref,
            "actual_accepted_receipt_persists": acquisition, "inferred_or_focused_card_is_acquisition": False}))
    goal = (True if required <= accepted else False if value.receipt_inventory_complete and not uncertain else None) if population else None
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "all_required_visual_question_receipts_supported": population and bool(value.ordered_cards_blank_index_evidence_refs)
            and bool(value.separate_proposal_focus_evidence_refs),
        "every_required_question_has_accepted_receipt": goal, "visual_cycle_or_acceptance_law_confirmed": False}))


def measure_supported_construction_supposition(value: SupportedConstructionSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    roots = set(value.required_foundation_refs)
    population = current and len(roots) == len(value.required_foundation_refs) and bool(value.required_ancestry_evidence_refs)
    unique = len({beam.beam_ref for beam in value.beams}) == len(value.beams)
    rows, found, unknown = [], False, False
    for beam in value.beams:
        target = beam.actual_target_overlap if current and unique and beam.target_overlap_evidence_refs else None
        ancestry = roots <= set(beam.foundation_ancestry_refs) if population and unique and beam.ancestry_inventory_complete and beam.actual_ancestry_evidence_refs else None
        together = _all_goal_values((target, ancestry))
        found = found or together is True
        unknown = unknown or together is None
        rows.append(FrozenMap({"beam_ref": beam.beam_ref, "actual_target_overlap": target,
            "this_beam_has_all_required_ancestries": ancestry, "one_beam_satisfies_both": together,
            "ancestries_of_separate_beams_merged_for_goal": False}))
    one = True if found else False if current and unique and value.beam_inventory_complete and not unknown else None
    stable = value.globally_stable if current and value.global_stability_evidence_refs else None
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "same_target_beam_ancestry_stability_question_supported": population and bool(value.stock_support_foundation_target_evidence_refs)
            and bool(value.outline_stress_quantity_evidence_refs),
        "globally_stable_and_one_target_beam_has_required_ancestries": _all_goal_values((stable, one)),
        "construction_stress_or_terminal_law_confirmed": False}))


def measure_alignment_game_supposition(value: AlignmentGameSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    population = current and bool(value.acquired_count_goal_evidence_refs)
    unique = len({item.chronological_ordinal for item in value.events}) == len(value.events)
    won, rows, reached, lost, unknown = set(), [], value.required_player_won_board_count == 0, False, False
    for item in sorted(value.events, key=lambda row: row.chronological_ordinal):
        scoped = (_observation_current(item, value.scope) and unique and item.acquisition_scope_ref == value.acquisition_scope_ref
            and item.enabled_before_input is True and bool(item.access_reset_evidence_refs))
        player = item.player_win_acquired if scoped and item.actual_player_acquisition_evidence_refs else None
        opponent = item.disqualifying_opponent_win if scoped and item.opponent_win_evidence_refs else None
        if not reached:
            unknown = unknown or player is None or opponent is None
            if opponent is True:
                lost = True
            if not lost and player is True:
                won.add(item.board_ref)
                reached = len(won) >= value.required_player_won_board_count
        rows.append(FrozenMap({"board_ref": item.board_ref, "chronological_ordinal": item.chronological_ordinal,
            "enabled_board_event_qualified": scoped, "player_win_actually_acquired": player,
            "opponent_disqualifying_win": opponent, "quota_reached_so_far": reached}))
    goal = (True if reached and not lost and not unknown else False if lost or value.acquisition_history_complete and not unknown else None) if population else None
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "player_board_acquisition_before_opponent_question_supported": population and bool(value.supports_two_marks_evidence_refs)
            and bool(value.enabled_disabled_board_evidence_refs) and bool(value.alternating_line_feedback_evidence_refs),
        "required_player_won_boards_acquired_before_disqualification": goal,
        "dimmed_or_inaccessible_board_used_by_appearance": False, "alignment_access_reset_or_terminal_law_confirmed": False}))


def measure_bounded_joystick_supposition(value: BoundedJoystickSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    measured, scoped = _typed_relation(value.whole_arrangement_equal, value.scope)
    request = value.whole_arrangement_equal
    domain = (scoped and value.complete_occurrence_population and bool(value.occurrence_population_evidence_refs)
        and request.operator == "EQUAL" and request.required_left_kind == request.required_right_kind == "RECOGNITION")
    equal = measured.geometric_relation_value if domain else None
    placement = value.admissible_nonwrapping_placement if current and value.placement_evidence_refs else None
    return GoalSuppositionFactsC(mask_measurements=(measured,), measurements=(FrozenMap({
        "complete_population_relative_arrangement_equal": equal, "nonwrapping_admissible_placement": placement,
        "advisory_destination_assignment_followed": value.advisory_destination_assignment_followed if current and value.advisory_status_evidence_refs else None,
        "advisory_assignment_is_terminal_requirement": False}),), facts=FrozenMap({"scope_current": current,
        "whole_occurrence_nonwrapping_arrangement_question_supported": current and bool(value.remote_finite_grid_active_marker_evidence_refs)
            and bool(value.occurrence_missing_control_evidence_refs) and bool(value.reference_guidance_evidence_refs),
        "complete_occurrences_realize_required_relative_arrangement": _all_goal_values((equal, placement)),
        "joystick_control_or_terminal_law_confirmed": False}))


def measure_neighborhood_supposition(value: NeighborhoodSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    unique = len({item.site_ref for item in value.sites}) == len(value.sites)
    rows, masks, matched, unknown = [], [], False, False
    for item in value.sites:
        measured, scoped = _typed_relation(item.exact_projection_equal, value.scope)
        masks.append(measured)
        request = item.exact_projection_equal
        permitted = item.permitted if current and unique and item.site_permission_evidence_refs else None
        equal = measured.geometric_relation_value if scoped and item.mask_crop_law_evidence_refs and request.operator == "EQUAL" and request.required_left_kind == request.required_right_kind == "RECOGNITION" else None
        condition = _all_goal_values((permitted, equal))
        matched = matched or condition is True
        unknown = unknown or condition is None
        rows.append(FrozenMap({"site_ref": item.site_ref, "permitted": permitted, "projection_equals_reference": equal}))
    some = True if matched else False if current and unique and value.comparison_site_inventory_complete and not unknown else None
    legal = value.all_movement_and_influence_constraints_satisfied if current and value.complete_physical_body_population and value.physical_population_evidence_refs and value.complete_influence_model_evidence_refs else None
    return GoalSuppositionFactsC(mask_measurements=tuple(masks), measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "permitted_projection_and_full_physical_model_question_supported": current and bool(value.occupancy_color_change_evidence_refs)
            and bool(value.outlined_region_reference_evidence_refs),
        "some_permitted_site_matches_and_all_physical_constraints_hold": _all_goal_values((some, legal)),
        "outside_or_masked_bodies_removed_from_influence_model": False, "neighborhood_influence_or_terminal_law_confirmed": False}))


def measure_layered_prefix_supposition(value: LayeredPrefixSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    required = set(value.required_thread_refs)
    population = current and len(required) == len(value.required_thread_refs) and bool(value.required_thread_set_evidence_refs)
    unique = len({item.thread_ref for item in value.threads}) == len(value.threads)
    threads, rows = {}, []
    for item in value.threads:
        known = (current and unique and item.inserted_prefix_length is not None and item.required_full_length is not None
            and item.inserted_prefix_length >= 0 and item.required_full_length >= 0
            and bool(item.actual_insertion_evidence_refs) and bool(item.required_length_evidence_refs))
        full = item.inserted_prefix_length == item.required_full_length if known else None
        if item.thread_ref in required:
            threads[item.thread_ref] = full
        rows.append(FrozenMap({"thread_ref": item.thread_ref, "full_required_prefix_inserted": full}))
    complete = (_all_goal_values(tuple(threads[ref] for ref in sorted(required))) if set(threads) == required else False) if population and unique and value.thread_inventory_complete else None
    measured, scoped = _typed_relation(value.visible_projection_equal, value.scope)
    request = value.visible_projection_equal
    equal = measured.geometric_relation_value if scoped and value.visible_projection_target_binding_evidence_refs and request.operator == "EQUAL" and request.required_left_kind == request.required_right_kind == "RECOGNITION" else None
    hidden_required = value.independent_hidden_decomposition_requirement if current and value.hidden_requirement_evidence_refs else None
    hidden_condition = (value.hidden_decomposition_matches_authored if hidden_required is True
        else True if hidden_required is False else None)
    conditions = (complete, equal, hidden_condition)
    return GoalSuppositionFactsC(mask_measurements=(measured,), measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "full_prefix_visible_projection_question_supported": population and bool(value.row_column_grid_next_end_evidence_refs)
            and bool(value.palette_reorder_thread_recolor_evidence_refs),
        "all_required_prefixes_full_and_visible_target_matches": _all_goal_values(conditions),
        "hidden_authored_decomposition_independently_required": hidden_required,
        "hidden_authored_decomposition_imposed_by_appearance": False, "layered_palette_or_terminal_law_confirmed": False}))


def assemble_completion_supposition(value: CompletionSuppositionDecisionInputC) -> CompletionSuppositionDecisionC:
    return CompletionSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
