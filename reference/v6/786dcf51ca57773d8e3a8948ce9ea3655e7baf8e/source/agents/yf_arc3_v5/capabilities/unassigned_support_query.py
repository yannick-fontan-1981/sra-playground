"""Conditional appearance queries under a retained procedure, not a new palette law."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from agents.yf_arc3_v5.logos.types import stable_digest

from .layer_correspondence import (
    measure_conditional_support_pose_domain,
    measure_visible_support_bodies,
)
from .partial_layer_correspondence import (
    PartialLayerField,
    measure_partial_layer_fields,
)
from .physical_transition_contracts import MaskPose


@dataclass(frozen=True)
class UnassignedSupportQuery:
    value: int
    poses: tuple[MaskPose, ...]
    body: frozenset[tuple[int, int]]
    known_count: int
    unknown_count: int


def measure_unassigned_support_queries(
    frame: Any, field: Any, model: Any
) -> tuple[UnassignedSupportQuery, ...]:
    palette = tuple(model.get("palette_description", ()))
    query = model.get("uniform_pose_query", {})
    if (
        len(palette) != 4
        or query.get("contract") != "yf_arc3_v5.uniform_support_pose_query.v1"
    ):
        return ()
    r, c, h, w = field.second_box.interior
    target = tuple(tuple(row[c : c + w]) for row in frame.rows[r : r + h])
    novel = tuple(sorted({x for row in target for x in row} - set(palette)))
    if len(novel) > 8:
        return ()
    rows = []
    motions = tuple(tuple(m[1:]) for m in model.get("historical_action_motions", ()))
    for material in novel:
        # Appearance equality and the retained empty-field value are the only
        # target observations here. Other colours have no assigned membership.
        known_values = (palette[0], material)
        known = tuple(tuple(x in known_values for x in row) for row in target)
        bodies = measure_visible_support_bodies(
            frame,
            field.first_box,
            field.second_box,
            material,
            palette,
            True,
            (material,),
        )
        if len(bodies) != 1:
            continue
        poses = tuple(
            measure_conditional_support_pose_domain(
                frame,
                field.first_box,
                field.second_box,
                material,
                palette,
                json.dumps(dict(query), sort_keys=True),
                motions,
                None,
                known,
                (material,),
                (material,),
                known_values,
            )
        )
        if len(poses) != 1:
            continue
        count = sum(sum(row) for row in known)
        rows.append(
            UnassignedSupportQuery(material, poses, bodies[0], count, h * w - count)
        )
    return tuple(rows)


def measure_unassigned_support_context(
    value: Any, field: PartialLayerField | None
) -> tuple[dict[str, Any], tuple[UnassignedSupportQuery, ...]]:
    if field is None or len(value.layer_transition_measurements) >= 32:
        return {}, ()
    models = tuple(
        m
        for m in value.canonical_layer_composition_memory_facts
        if m["term_ref"] == field.model_ref
    )
    if len(models) != 1:
        return {}, ()
    queries = measure_unassigned_support_queries(
        value.current_observed_frame or value.frame, field, models[0]
    )
    return {
        "layer_unassigned_prior_known_difference_sum": sum(
            x.current_known_difference_count for x in field.layers
        ),
        "layer_unassigned_prior_known_comparison_complete": all(
            x.compared_current_cell_count == x.known_target_cell_count
            for x in field.layers
        ),
    }, queries


def measure_unassigned_support_candidate(
    value: Any, field: Any, queries: tuple[UnassignedSupportQuery, ...], candidate: Any
) -> dict[str, Any]:
    if field is None or len(queries) != 1:
        return {}
    q = queries[0]
    history = tuple(value.layer_transition_measurements)
    markers = tuple(
        i
        for i, x in enumerate(history)
        if x.point_value is not None and x.added_marker_value is not None
    )
    focus = history[markers[-1]].point_value if markers else None
    if value.last_selected_point_palette_value != focus:
        focus = None
    if candidate.point is not None:
        frame = value.current_observed_frame or value.frame
        if (
            candidate.point not in q.body
            or frame.rows[candidate.point[0]][candidate.point[1]] != q.value
        ):
            return {}
    elif focus != q.value:
        return {}
    model = next(
        m
        for m in value.canonical_layer_composition_memory_facts
        if m["term_ref"] == field.model_ref
    )
    pose = q.poses[0]
    observations = tuple(
        tuple(m)
        for t in (history[markers[-1] + 1 :] if markers else ())
        if t.action_ref == candidate.action_ref and focus == q.value
        for m in t.motions
        if m[0] == q.value
    )
    old = tuple(tuple(m) for m in model.get("historical_action_motions", ()))
    rotations = tuple(m for m in old if m[0] == candidate.action_ref and m[2])
    rotation = (
        len({m[1] for m in rotations}) >= 2
        and {m[2] for m in rotations} == {1}
        and pose.clockwise_quarters > 0
    )
    rotation_contradicted = any(m[1] != 1 or m[2] or m[3] for m in observations)
    directions = {
        a: (dr, dc) for a, dr, dc in value.interface_action_translation_deltas
    }
    direction = directions.get(candidate.action_ref)
    shifts = []
    for action, material, turn, dr, dc in old:
        source_direction = directions.get(action)
        if turn or not (dr or dc) or (dr and dc) or source_direction is None:
            continue
        if (
            dr * source_direction[1] != dc * source_direction[0]
            or dr * source_direction[0] + dc * source_direction[1] <= 0
        ):
            continue
        if action == candidate.action_ref:
            shifts.append((dr, dc))
        elif direction == (-source_direction[0], -source_direction[1]):
            shifts.append((-dr, -dc))
    shift_vectors = tuple(sorted(set(shifts)))
    translation = (
        pose.clockwise_quarters == 0
        and len(shift_vectors) == 1
        and any(
            (dr == 0 and dc * pose.col_delta > 0 and abs(dc) <= abs(pose.col_delta))
            or (dc == 0 and dr * pose.row_delta > 0 and abs(dr) <= abs(pose.row_delta))
            for dr, dc in shift_vectors
        )
    )
    translation_contradicted = len(shift_vectors) == 1 and any(
        m[1] or (m[2], m[3]) != shift_vectors[0] for m in observations
    )
    token = stable_digest(
        (
            "unassigned-support-query",
            field.model_ref,
            value.current_observation_frame_ref,
            q.value,
            (pose.clockwise_quarters, pose.row_delta, pose.col_delta),
            candidate.action_ref,
            observations,
            markers[-1] if markers else None,
        )
    )[:24]
    return {
        "layer_current_binding_token": token,
        "layer_current_premise_claim_refs": (
            field.current_claim_pattern.format(binding_token=token),
        ),
        "layer_support_measurement_present": True,
        "layer_unassigned_support_query_present": True,
        "layer_unassigned_query_contract_ref": model["uniform_pose_query"]["contract"],
        "layer_unassigned_query_material_value": q.value,
        "layer_unassigned_query_pose_count": len(q.poses),
        "layer_unassigned_query_body_support_count": len(q.body),
        "layer_unassigned_query_known_cell_count": q.known_count,
        "layer_unassigned_query_unknown_cell_count": q.unknown_count,
        "layer_unassigned_query_quarters": pose.clockwise_quarters,
        "layer_unassigned_query_row_delta": pose.row_delta,
        "layer_unassigned_query_col_delta": pose.col_delta,
        "layer_unassigned_query_candidate_is_point": candidate.point is not None,
        "layer_unassigned_query_controls_current_value": focus == q.value,
        "layer_unassigned_query_rotation_reduces": rotation,
        "layer_unassigned_query_rotation_contradicted": rotation_contradicted,
        "layer_unassigned_query_translation_reduces": translation,
        "layer_unassigned_query_translation_contradicted": translation_contradicted,
        "layer_unassigned_query_operator_observations": observations,
        "layer_unassigned_query_shift_vectors": shift_vectors,
    }


def measure_unassigned_support_pose_motions(
    before: Any, after: Any, models: tuple[Any, ...]
) -> tuple[tuple[int, int, int, int], ...]:
    pairs = []
    for model in models:
        for a in measure_partial_layer_fields(before, (model,)):
            for b in measure_partial_layer_fields(after, (model,)):
                if (a.first_box, a.second_box) != (b.first_box, b.second_box):
                    continue
                r, c, h, w = a.second_box.interior
                if any(
                    before.rows[r + i][c : c + w] != after.rows[r + i][c : c + w]
                    for i in range(h)
                ):
                    continue
                for x in measure_unassigned_support_queries(before, a, model):
                    for y in measure_unassigned_support_queries(after, b, model):
                        if x.value == y.value:
                            pairs.append((x.value, x.poses[0], y.poses[0]))
    if len(pairs) != 1:
        return ()
    material, p, q = pairs[0]
    turn = (p.clockwise_quarters - q.clockwise_quarters) % 4
    if turn:
        return ((material, turn, 0, 0),)
    return ((material, 0, p.row_delta - q.row_delta, p.col_delta - q.col_delta),)
