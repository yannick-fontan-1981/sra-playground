"""Three-valued mask geometry; Source owns use and semantic interpretation."""
from .typed_mask_contracts_c import (TypedMaskRelationInputC, TypedMaskRelationFactsC,
    TypedMaskDecisionInputC, TypedMaskDecisionC, MaskPointC)
from agents.yf_arc3_v5.logos.types import FrozenMap


def _point_key(point):
    return (point.row, point.column, point.depth)


def _point_order(key):
    # Unknown/2D depth remains distinct from depth zero. This is a stable
    # presentation order, never a projection between coordinate systems.
    return (key[0], key[1], key[2] is not None, key[2] if key[2] is not None else 0)


def _points(keys):
    return tuple(MaskPointC(row=key[0], column=key[1], depth=key[2])
        for key in sorted(keys, key=_point_order))


def measure_typed_mask_relation(value: TypedMaskRelationInputC) -> TypedMaskRelationFactsC:
    left, right = value.left, value.right
    same_basis = all(mask.scene_ref == value.scene_ref and mask.native_frame_ref == value.native_frame_ref
        and mask.coordinate_basis_ref == value.coordinate_basis_ref for mask in (left, right))
    current = all(mask.epoch == value.epoch and mask.revision_ref == value.revision_ref
        and bool(mask.evidence_refs) for mask in (left, right))
    kinds_equal = left.kind == value.required_left_kind and right.kind == value.required_right_kind
    prediction_current = all(mask.origin == "OBSERVED" or (mask.model_ref is not None
        and bool(mask.premise_refs) and bool(mask.falsifier_refs)
        and value.current_model_assignment_ref is not None
        and mask.model_assignment_ref == value.current_model_assignment_ref) for mask in (left, right))
    semantic_current = all(mask.kind in ("RECOGNITION", "BACKGROUND_HOLE")
        or (bool(mask.semantic_support_refs) and mask.semantic_premises_current) for mask in (left, right))
    bounded = len(left.support)+len(right.support) > value.max_input_support_points
    intersection, left_only, right_only = set(), set(), set()
    relation = None
    if not bounded and same_basis and current and prediction_current:
        left_points = {_point_key(point) for point in left.support}
        right_points = {_point_key(point) for point in right.support}
        depth_complete = (value.coordinate_basis_kind != "LOGICAL_CELL_3D"
            or all(key[2] is not None for key in left_points | right_points))
        intersection = left_points.intersection(right_points)
        left_only, right_only = left_points-right_points, right_points-left_points
        if not depth_complete:
            relation = None
        elif value.operator in ("INTERSECTS", "DISJOINT"):
            intersects = True if intersection else False if left.support_complete and right.support_complete else None
            relation = intersects if value.operator == "INTERSECTS" else not intersects if intersects is not None else None
        elif value.operator == "EQUAL":
            if (left_only and right.support_complete) or (right_only and left.support_complete):
                relation = False
            elif left.support_complete and right.support_complete:
                relation = not left_only and not right_only
        elif value.operator == "SUBSET":
            if left_only and right.support_complete:
                relation = False
            elif left.support_complete and not left_only:
                relation = True
    return TypedMaskRelationFactsC(geometric_relation_value=relation,
        common_known_support=_points(intersection), left_only_known_support=_points(left_only),
        right_only_known_support=_points(right_only),
        actual_input_support_point_visits=0 if bounded or not same_basis or not current or not prediction_current
            else len(left.support)+len(right.support),
        facts=FrozenMap({"scope_current": current and same_basis,
            "requested_mask_kinds_present": kinds_equal, "prediction_support_present": prediction_current,
            "requested_semantic_support_current": semantic_current,
            "budget_reached": bounded, "geometric_relation_known": relation is not None,
            "left_origin": left.origin, "right_origin": right.origin}))


def assemble_typed_mask_relation(value: TypedMaskDecisionInputC) -> TypedMaskDecisionC:
    return TypedMaskDecisionC(source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref, frozen_request=value.request, frozen_measurement=value.measured,
        licensed_geometric_relation_value=value.measured.geometric_relation_value
            if value.source_disposition_ref == "mask.use_requested_typed_geometry" else None)
