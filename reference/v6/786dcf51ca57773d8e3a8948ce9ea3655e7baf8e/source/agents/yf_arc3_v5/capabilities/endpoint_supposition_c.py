"""Existing exact measurements support revisable role questions, not selected physical laws."""
from .endpoint_supposition_contracts_c import (ArticulatedChannelSuppositionInputC, InverseAnchorSuppositionInputC,
    ContactShapeSuppositionInputC, EndpointSuppositionFactsC, EndpointSuppositionDecisionInputC, EndpointSuppositionDecisionC)
from .structural_supposition_c import _scope_current, _typed_relation
from .articulated_channel_kinematics import measure_articulated_kinematics
from .inverse_anchor import measure_rational_anchor_dependence
from agents.yf_arc3_v5.logos.types import FrozenMap


def _current_support(row, scope):
    return (isinstance(row, FrozenMap) and row.get("epoch") == scope.epoch
        and row.get("revision_ref") == scope.revision_ref and row.get("scope_ref") == scope.scope_ref
        and bool(row.get("evidence_refs")))


def measure_articulated_channel_supposition(value: ArticulatedChannelSuppositionInputC) -> EndpointSuppositionFactsC:
    scope, bodies = value.scope, value.geometry.bodies
    current = _scope_current(scope)
    supported = current and all(_current_support(value.body_support_by_ref.get(body.body_ref), scope) for body in bodies)
    measured = measure_articulated_kinematics(value.geometry) if supported else None
    rows = []
    for body in bodies:
        if body.parent_ref is not None:
            rows.append(FrozenMap({"relation_kind": "PASSIVE_MECHANICAL_ATTACHMENT",
                "parent_ref": body.parent_ref, "body_ref": body.body_ref,
                "scope_supported": supported and _current_support(value.passive_attachment_evidence_by_ref.get(body.body_ref), scope),
                "channel_control_from_attachment": False}))
    for first_index, first in enumerate(bodies):
        for second in bodies[first_index+1:]:
            channels = tuple(sorted(set(first.channel_refs).intersection(second.channel_refs)))
            if not channels:
                continue
            pair = "|".join(sorted((first.body_ref, second.body_ref)))
            rows.append(FrozenMap({"relation_kind": "REMOTE_SHARED_CHANNEL",
                "first_ref": first.body_ref, "second_ref": second.body_ref, "channel_refs": channels,
                "scope_supported": supported and _current_support(value.remote_same_channel_evidence_by_pair.get(pair), scope),
                "mechanical_attachment_from_channel": False}))
    return EndpointSuppositionFactsC(articulated_geometry=measured, measurements=tuple(rows),
        facts=FrozenMap({"scope_current": current, "body_geometry_supported": supported,
            "capped_variable_extent_supported": bool(value.capped_variable_extent_evidence_refs),
            "endpoint_marker_supported": bool(value.endpoint_marker_evidence_refs),
            "mechanical_and_channel_relations_kept_separate": True,
            "extension_law_confirmed": False}))


def measure_inverse_anchor_supposition(value: InverseAnchorSuppositionInputC) -> EndpointSuppositionFactsC:
    scope = value.scope
    current = _scope_current(scope)
    anchors = set(value.anchor_refs)
    wired = {first if second == value.beacon_ref else second for first, second in value.wire_endpoint_pairs
        if (first in anchors and second == value.beacon_ref) or (second in anchors and first == value.beacon_ref)}
    explicit = (current and len(anchors) == len(value.anchor_refs) and value.beacon_ref not in anchors
        and wired == anchors and bool(value.redrawn_wire_evidence_refs)
        and len(value.joint_dependence.anchor_positions) == len(value.anchor_refs)
        and bool(value.joint_dependence_evidence_refs))
    measured = measure_rational_anchor_dependence(value.joint_dependence) if explicit else None
    rows = (FrozenMap({"beacon_ref": value.beacon_ref, "anchor_refs": value.anchor_refs,
        "all_anchor_beacon_endpoints_supported": explicit,
        "joint_quantized_prediction": measured.quantized_position if measured is not None else None,
        "signature_receiver_candidate_refs": value.signature_receiver_candidate_refs,
        "destination_receiver_candidate_refs": value.destination_receiver_candidate_refs,
        "anchor_destination_from_beacon_signature": False}),)
    return EndpointSuppositionFactsC(anchor_prediction=measured, measurements=rows,
        facts=FrozenMap({"scope_current": current, "joint_wire_dependence_supported": explicit,
            "hollow_multicolour_ensemble_supported": bool(value.hollow_multicolour_ensemble_evidence_refs),
            "signature_and_destination_receivers_retained": bool(value.signature_receiver_candidate_refs)
                and bool(value.destination_receiver_candidate_refs), "goal_receiver_confirmed": False}))


def measure_contact_shape_supposition(value: ContactShapeSuppositionInputC) -> EndpointSuppositionFactsC:
    scope = value.scope
    contour, contour_scoped = _typed_relation(value.contour_relation, scope)
    shape, shape_scoped = _typed_relation(value.normalized_shape_change_relation, scope)
    contour_scoped = (contour_scoped and value.contour_relation.left.owner_ref == value.body_ref
        and value.contour_relation.operator in ("EQUAL", "SUBSET"))
    shape_scoped = (shape_scoped and value.normalized_shape_change_relation.operator == "EQUAL"
        and value.normalized_shape_change_relation.left.owner_ref == value.body_ref
        and value.normalized_shape_change_relation.right.owner_ref == value.body_ref
        and bool(value.shared_local_pose_basis_evidence_refs))
    identity_supported = (bool(value.body_identity_evidence_refs) and value.current_independent_identity_relation is True)
    rows = (FrozenMap({"relation_kind": "WHOLE_CONTOUR_REQUEST", "scope_supported": contour_scoped,
        "geometric_contour_relation": contour.geometric_relation_value if contour_scoped else None,
        "focus_point_not_whole_contour": True}),
        FrozenMap({"relation_kind": "CONTACT_INTERNAL_SHAPE_OR_ASPECT", "body_ref": value.body_ref,
            "pose_normalized_shape_equal": shape.geometric_relation_value if shape_scoped else None,
            "aspect_signature_changed": value.before_aspect_signature != value.after_aspect_signature
                if value.aspect_observation_evidence_refs else None,
            "independent_identity_retained": identity_supported, "new_object_from_appearance_change": False}))
    return EndpointSuppositionFactsC(measurements=rows, facts=FrozenMap({"scope_current": _scope_current(scope),
        "marker_constellation_supported": bool(value.marker_constellation_evidence_refs),
        "contour_relation_scope_supported": contour_scoped, "shape_relation_scope_supported": shape_scoped,
        "contact_supported": bool(value.contact_evidence_refs), "stop_or_palette_supported": bool(value.stop_or_palette_evidence_refs),
        "independent_identity_supported": identity_supported, "contact_transformation_law_confirmed": False}))


def assemble_endpoint_supposition(value: EndpointSuppositionDecisionInputC) -> EndpointSuppositionDecisionC:
    return EndpointSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
