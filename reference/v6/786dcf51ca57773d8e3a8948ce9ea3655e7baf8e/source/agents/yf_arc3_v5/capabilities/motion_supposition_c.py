"""Exact local descriptors reuse mask/context/layer methods; no flight or game physics."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .motion_supposition_contracts_c import (AutonomousInterventionInputC, KitSurvivalInputC, HiddenReceptionInputC,
    BallisticSuppositionInputC, OrderedTransferSuppositionInputC, MotionSuppositionFactsC,
    MotionSuppositionDecisionInputC, MotionSuppositionDecisionC)
from .structural_supposition_c import _scope_current, _typed_relation, measure_layer_contact
from .transport_supposition_c import _observation_current
from .recognition_boundary_c import measure_recognition_boundary


def _contact_current(item, scope):
    return (_observation_current(item, scope) and item.first_actor_ref != item.second_actor_ref
        and bool(item.actual_contact_evidence_refs))


def _contact_rows(contacts, scope):
    return tuple(FrozenMap({"example_ref": item.example_ref, "first_actor_ref": item.first_actor_ref,
        "second_actor_ref": item.second_actor_ref,
        "actual_contact_qualified": _contact_current(item, scope),
        "observed_consequence": item.observed_consequence if _contact_current(item, scope)
            and item.consequence_evidence_refs else None,
        "independent_hostility": item.independent_hostility if _contact_current(item, scope)
            and item.hostility_evidence_refs else None,
        "appearance_implies_hostility": False}) for item in contacts)


def _body_receiver_relation(request, scope, body_ref, receiver_ref):
    measured, current = _typed_relation(request, scope)
    supported = (current and request.left.owner_ref == body_ref and request.right.owner_ref == receiver_ref
        and request.required_left_kind == "OCCUPIED_BODY"
        and request.required_right_kind in ("RECEIVING_APERTURE", "SCORED_WINDOW")
        and request.operator in ("EQUAL", "SUBSET"))
    return measured, supported and measured.geometric_relation_value is True


def measure_autonomous_intervention(value: AutonomousInterventionInputC) -> MotionSuppositionFactsC:
    current = _scope_current(value.scope)
    relation, receiving = _body_receiver_relation(value.receiving_relation, value.scope, value.beneficiary_ref, value.destination_ref)
    rows = []
    for item in value.motion:
        scoped = _observation_current(item, value.scope) and bool(item.pose_basis_evidence_refs) and bool(item.primitive_refs)
        rotated = (scoped and bool(item.direct_orientation_evidence_refs)
            and item.direct_orientation_before is not None and item.direct_orientation_after is not None
            and item.direct_orientation_before != item.direct_orientation_after)
        overlay = (scoped and item.direct_owner_ref == value.overlay_ref and value.overlay_ref != value.beneficiary_ref
            and bool(item.exclusive_control_evidence_refs) and (rotated or
                (item.direct_delta is not None and item.direct_delta != (0, 0))))
        automatic = (scoped and item.automatic_body_ref == value.beneficiary_ref and bool(item.post_direct_phase_evidence_refs)
            and item.automatic_delta is not None and item.automatic_delta != (0, 0))
        rows.append(FrozenMap({"example_ref": item.example_ref, "overlay_direct_motion_observed": overlay,
            "overlay_direct_rotation_observed": overlay and rotated,
            "beneficiary_post_direct_motion_observed": automatic,
            "terrain_change_observed": scoped and bool(item.terrain_edit_evidence_refs) and item.terrain_before != item.terrain_after,
            "terrain_before": item.terrain_before, "terrain_after": item.terrain_after,
            "overlay_motion_proves_direct_beneficiary_control": False}))
    controls = any(row["overlay_direct_motion_observed"] for row in rows)
    motion = any(row["beneficiary_post_direct_motion_observed"] for row in rows)
    rows.extend(_contact_rows(value.contacts, value.scope))
    return MotionSuppositionFactsC(measurements=tuple(rows), mask_measurements=(relation,), facts=FrozenMap({"scope_current": current,
        "overlay_beneficiary_destination_supported": current and controls and motion and receiving
            and bool(value.transparent_overlay_evidence_refs) and bool(value.advance_mark_evidence_refs)
            and bool(value.destination_role_evidence_refs),
        "terrain_intervention_law_confirmed": False, "contact_hostility_unproven_by_appearance": True}))


def measure_kit_survival(value: KitSurvivalInputC) -> MotionSuppositionFactsC:
    current = _scope_current(value.scope)
    rows, finite_life, advance, fields = [], False, False, False
    for item in value.examples:
        scoped = _observation_current(item, value.scope) and item.controlled_body_ref == value.controlled_body_ref
        before, after = set(item.life_mark_refs_before), set(item.life_mark_refs_after)
        life = (scoped and item.life_inventory_complete and bool(item.life_role_evidence_refs)
            and len(before) == len(item.life_mark_refs_before) and len(after) == len(item.life_mark_refs_after))
        horizon = (scoped and item.horizon_before is not None and item.horizon_after is not None
            and item.horizon_advance_direction is not None
            and bool(item.horizon_direction_evidence_refs))
        changed_field = (scoped and bool(item.primitive_refs) and item.power_field_inventory_complete
            and bool(item.power_field_evidence_refs) and item.power_field_before != item.power_field_after)
        finite_life = finite_life or life
        advance = advance or (horizon and ((item.horizon_advance_direction == "INCREASING"
            and item.horizon_after > item.horizon_before) or (item.horizon_advance_direction == "DECREASING"
            and item.horizon_after < item.horizon_before)))
        fields = fields or changed_field
        rows.append(FrozenMap({"example_ref": item.example_ref,
            "life_marker_count_before": len(before) if life else None, "life_marker_count_after": len(after) if life else None,
            "life_mark_added_refs": tuple(sorted(after - before)) if life else (),
            "life_mark_removed_refs": tuple(sorted(before - after)) if life else (),
            "horizon_delta": item.horizon_after - item.horizon_before if horizon else None,
            "action_correlated_power_field_change_observed": changed_field, "action_quota_from_life_marks": None}))
    contacts = _contact_rows(value.contacts, value.scope)
    other_pairs = tuple((row["first_actor_ref"], row["second_actor_ref"]) for row in contacts
        if row["actual_contact_qualified"] and value.controlled_body_ref not in (row["first_actor_ref"], row["second_actor_ref"]))
    rows.extend(contacts)
    return MotionSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "finite_survival_question_supported": current and bool(value.marked_controlled_body_evidence_refs)
            and bool(value.finite_process_evidence_refs) and finite_life and advance and fields,
        "observed_other_actor_contact_pairs": other_pairs, "universal_pursuit_relation": None,
        "survival_clock_or_power_law_confirmed": False}))


def measure_hidden_reception(value: HiddenReceptionInputC) -> MotionSuppositionFactsC:
    current = _scope_current(value.scope)
    recognition = measure_recognition_boundary(value.recognition)
    request = value.recognition
    context = (current and request.parent_goal_ref == value.scope.parent_goal_ref
        and request.consumer_ref == value.scope.consumer_ref and request.epoch == value.scope.epoch
        and request.revision_ref == value.scope.revision_ref and request.scope_ref == value.scope.scope_ref
        and all(recognition.facts[key] for key in ("scope_current", "role_context_support_present",
            "candidate_refs_unique", "binding_tokens_unique", "rows_well_formed"))
        and not recognition.facts["context_unknowns_present"]
        and value.incoming_candidate_ref in recognition.admitted_candidate_refs
        and bool(value.incoming_candidate_binding_evidence_refs))
    relation, fit = _body_receiver_relation(value.reception_relation, value.scope, value.incoming_body_ref, value.carrier_ref)
    rows = []
    for item in value.visibility_examples:
        loss = (_observation_current(item, value.scope) and item.body_ref == value.incoming_body_ref
            and item.visible_before is True and item.visible_after is False
            and bool(item.body_identity_evidence_refs) and bool(item.viewport_preservation_evidence_refs)
            and bool(item.occlusion_relation_evidence_refs))
        rows.append(FrozenMap({"example_ref": item.example_ref, "body_ref": item.body_ref,
            "opaque_region_ref": item.opaque_region_ref, "observed_visibility_loss": loss,
            "hidden_pose_observed": False, "disappearance_confirms_destruction": False}))
    layer = measure_layer_contact(value.layer_contacts) if value.layer_contacts is not None and value.layer_contacts.scope == value.scope else None
    return MotionSuppositionFactsC(measurements=tuple(rows), recognition_measurement=recognition, layer_measurement=layer,
        mask_measurements=(relation,),
        facts=FrozenMap({"scope_current": current,
            "contextual_reception_question_supported": context and fit and bool(value.mobile_carrier_evidence_refs)
                and bool(value.concave_support_evidence_refs) and bool(value.requested_shape_evidence_refs)
                and any(row["observed_visibility_loss"] for row in rows),
            "shape_match_never_excludes_hazard_by_itself": True, "appearance_not_terminal_acceptance": True,
            "hidden_kinematics_or_reception_law_confirmed": False}))


def measure_ballistic_supposition(value: BallisticSuppositionInputC) -> MotionSuppositionFactsC:
    current = _scope_current(value.scope)
    rows, checks, bounded, curved = [], 0, False, False
    for trace in value.traces:
        ordered = all(first.chronological_ordinal < second.chronological_ordinal for first, second in zip(trace.poses, trace.poses[1:]))
        supported = (_observation_current(trace, value.scope) and ordered
            and trace.launched_body_ref == value.transient_body_ref and bool(trace.actual_launch_primitive_refs)
            and bool(trace.transient_body_identity_evidence_refs) and bool(trace.common_pose_basis_evidence_refs)
            and all(pose.actual_pose_evidence_refs for pose in trace.poses))
        for first, middle, last in zip(trace.poses, trace.poses[1:], trace.poses[2:]):
            if checks >= value.max_triple_checks:
                bounded = True
                break
            checks += 1
            a = (middle.position[0] - first.position[0], middle.position[1] - first.position[1])
            b = (last.position[0] - middle.position[0], last.position[1] - middle.position[1])
            cross = a[0] * b[1] - a[1] * b[0]
            curve = supported and cross != 0
            curved = curved or curve
            rows.append(FrozenMap({"example_ref": trace.example_ref, "launched_body_ref": trace.launched_body_ref,
                "sample_ordinals": (first.chronological_ordinal, middle.chronological_ordinal, last.chronological_ordinal),
                "noncollinear_actual_positions": curve, "signed_cross_product": cross if supported else None,
                "gravity_velocity_or_acceleration_inferred": False}))
        if bounded:
            break
    apertures = set(value.oriented_aperture_refs)
    mask_measurements = []
    for request in value.aperture_relations:
        measured, scoped = _typed_relation(request, value.scope)
        mask_measurements.append(measured)
        supported = (scoped and request.left.owner_ref == value.transient_body_ref
            and request.right.owner_ref in apertures and bool(value.oriented_aperture_evidence_refs)
            and request.required_left_kind == "OCCUPIED_BODY" and request.required_right_kind == "RECEIVING_APERTURE"
            and request.operator in ("SUBSET", "EQUAL"))
        rows.append(FrozenMap({"relation_ref": request.relation_ref, "aperture_ref": request.right.owner_ref,
            "geometric_fit": measured.geometric_relation_value if supported else None,
            "persistent_target_ref": value.persistent_target_ref, "aperture_shape_selects_target": False}))
    return MotionSuppositionFactsC(measurements=tuple(rows), actual_triple_checks=checks, mask_measurements=tuple(mask_measurements),
        facts=FrozenMap({"scope_current": current, "aimed_flight_question_supported": current
            and value.launch_source_ref != value.magnitude_control_ref
            and bool(value.launch_source_evidence_refs) and bool(value.target_persistence_evidence_refs)
            and bool(value.separate_magnitude_control_evidence_refs)
            and (curved or bool(value.curved_transient_body_evidence_refs)),
            "trajectory_domain_open": bounded, "actual_noncollinear_trace_observed": curved,
            "aperture_transport_and_target_roles_separate": True, "ballistic_law_confirmed": False}))


def measure_ordered_transfer_supposition(value: OrderedTransferSuppositionInputC) -> MotionSuppositionFactsC:
    current = _scope_current(value.scope)
    supports = value.geometry.supports
    unique = len({item.support_ref for item in supports}) == len(supports)
    geometry = (current and unique and bool(value.geometry_scope_evidence_refs) and value.support_inventory_complete
        and all(extent > 0 for support in supports for extent in support.layer_extents))
    rows = tuple(FrozenMap({"support_ref": item.support_ref, "layer_extents": item.layer_extents,
        "strict_bottom_to_top_extent_order": geometry and bool(value.bottom_to_top_order_evidence_refs)
            and all(lower > upper for lower, upper in zip(item.layer_extents, item.layer_extents[1:])),
        "nested_members_present": geometry and len(item.layer_extents) > 1,
        "ghost_support_currently_empty": geometry and item.support_ref == value.ghost_support_ref and not item.layer_extents})
        for item in supports)
    observed = list(rows)
    for item in value.examples:
        scoped = _observation_current(item, value.scope)
        stationary = scoped and bool(item.pose_evidence_refs) and item.position_before == item.position_after
        observed.append(FrozenMap({"example_ref": item.example_ref, "member_ref": item.member_ref,
            "stationary_highlight_observed": stationary and item.highlighted_after is True and bool(item.highlight_evidence_refs),
            "independent_reservation": item.reserved_after if scoped and item.independent_reservation_evidence_refs else None,
            "highlight_proves_completed_transport": False}))
    return MotionSuppositionFactsC(measurements=tuple(observed), ordered_geometry=value.geometry,
        facts=FrozenMap({"scope_current": current, "ordered_family_ghost_question_supported": geometry
            and len(supports) > 1 and bool(value.homologous_shaft_evidence_refs) and bool(value.horizontal_member_evidence_refs)
            and bool(value.distinguished_ghost_evidence_refs) and any(row["nested_members_present"] for row in rows)
            and any(row["ghost_support_currently_empty"] for row in rows),
            "highlight_and_completed_transfer_separate": True, "ordered_transfer_law_confirmed": False}))


def assemble_motion_supposition(value: MotionSuppositionDecisionInputC) -> MotionSuppositionDecisionC:
    return MotionSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
