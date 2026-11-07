"""Current partial correspondences under an explicitly recalled binary model.

Novel raster values remain unknown on both sides of every comparison. These
measurements neither extend the composition table nor identify a working field,
reference field, control role, terminal condition, or executable method.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations
from typing import Any

from agents.yf_arc3_v5.logos.types import stable_digest

from .contracts import FrameGrid
from .layer_correspondence import (
    MAX_FRAME_AREA,
    _mask_matches,
    measure_conditional_support_pose_domain,
    measure_visible_support_bodies,
    rectangular_outline_measurements,
)
from .physical_transition_contracts import MaskPose, RasterBox


@dataclass(frozen=True)
class PartialLayerCorrespondence:
    value: int
    poses: tuple[MaskPose, ...]
    pose_count: int
    known_target_cell_count: int
    unknown_target_cell_count: int
    compared_current_cell_count: int
    current_known_difference_count: int
    matching_support_pixels: tuple[tuple[int, int], ...]


@dataclass(frozen=True)
class PartialLayerField:
    model_ref: str
    model_claim_ref: str
    current_claim_pattern: str
    first_box: RasterBox
    second_box: RasterBox
    layers: tuple[PartialLayerCorrespondence, ...]


@dataclass(frozen=True)
class PartialLayerGeometry:
    palette: tuple[int, ...]
    first_box: RasterBox
    second_box: RasterBox
    layers: tuple[PartialLayerCorrespondence, ...]


@lru_cache(maxsize=4)
def measure_partial_layer_geometries(
    frame: FrameGrid, palettes: tuple[tuple[int, ...], ...]
) -> tuple[PartialLayerGeometry, ...]:
    """Enumerate both geometric orders, retaining ambiguity and unknown cells.

    Only the supplied model's exact palette participates. New values are never
    assigned membership by numeric value, position, absence, or guesswork.
    Bounds refuse the entire inventory rather than selecting a truncated row.
    """
    if frame.height * frame.width > MAX_FRAME_AREA or len(palettes) > 8:
        return ()
    boxes = rectangular_outline_measurements(frame)
    if len(boxes) > 8:
        return ()
    fields = []
    for palette in palettes:
        if len(palette) != 4 or len(set(palette)) != 4:
            continue
        background, first_value, second_value, extra = palette
        for first, second in combinations(boxes, 2):
            if (first.height, first.width) != (second.height, second.width):
                continue
            for a, b in ((first, second), (second, first)):
                ar, ac, h, w = a.interior
                br, bc, _, _ = b.interior
                if not (ar + h <= br or br + h <= ar or ac + w <= bc or bc + w <= ac):
                    continue
                target = tuple(row[bc : bc + w] for row in frame.rows[br : br + h])
                target_known = tuple(tuple(x in palette for x in row) for row in target)
                known_count = sum(sum(row) for row in target_known)
                if known_count in (0, h * w):
                    continue
                sides = (
                    frame.rows[0],
                    frame.rows[-1],
                    tuple(row[0] for row in frame.rows),
                    tuple(row[-1] for row in frame.rows),
                )
                if sum(background in side for side in sides) < 3:
                    continue
                exterior = tuple(
                    tuple(
                        not (
                            b.top <= r < b.top + b.height
                            and b.left <= c < b.left + b.width
                        )
                        for c in range(frame.width)
                    )
                    for r in range(frame.height)
                )
                outside = Counter(
                    x
                    for r, row in enumerate(frame.rows)
                    for c, x in enumerate(row)
                    if exterior[r][c]
                )
                if any(outside[v] <= h * w for v in (first_value, second_value)):
                    continue
                source_known = tuple(
                    tuple(x in palette and exterior[r][c] for c, x in enumerate(row))
                    for r, row in enumerate(frame.rows)
                )
                layers = []
                for value in sorted((first_value, second_value)):
                    support = tuple(
                        tuple(x in (value, extra) for x in row) for row in frame.rows
                    )
                    target_mask = tuple(
                        tuple(x in (value, extra) for x in row) for row in target
                    )
                    poses, count = _mask_matches(
                        source_known, support, target_mask, (ar, ac), target_known
                    )
                    compared = tuple(
                        (r, c)
                        for r in range(h)
                        for c in range(w)
                        if target_known[r][c] and source_known[ar + r][ac + c]
                    )
                    difference = sum(
                        support[ar + r][ac + c] != target_mask[r][c]
                        for r, c in compared
                    )
                    matched_pixels: set[tuple[int, int]] = set()
                    if count == 1:
                        pose = poses[0]
                        seeds = []
                        for r in range(h):
                            for c in range(w):
                                if not target_known[r][c] or not target_mask[r][c]:
                                    continue
                                rr, cc = pose.window_row + r, pose.window_col + c
                                if pose.clockwise_quarters == 1:
                                    rr, cc = frame.height - 1 - cc, rr
                                elif pose.clockwise_quarters == 2:
                                    rr, cc = frame.height - 1 - rr, frame.width - 1 - cc
                                elif pose.clockwise_quarters == 3:
                                    rr, cc = cc, frame.width - 1 - rr
                                if (
                                    0 <= rr < frame.height
                                    and 0 <= cc < frame.width
                                    and source_known[rr][cc]
                                    and support[rr][cc]
                                ):
                                    seeds.append((rr, cc))
                        while seeds:
                            rr, cc = seeds.pop()
                            if (
                                (rr, cc) in matched_pixels
                                or not (
                                    0 <= rr < frame.height and 0 <= cc < frame.width
                                )
                                or not exterior[rr][cc]
                                or not support[rr][cc]
                            ):
                                continue
                            matched_pixels.add((rr, cc))
                            seeds.extend(
                                ((rr - 1, cc), (rr + 1, cc), (rr, cc - 1), (rr, cc + 1))
                            )
                    layers.append(
                        PartialLayerCorrespondence(
                            value,
                            poses,
                            count,
                            known_count,
                            h * w - known_count,
                            len(compared),
                            difference,
                            tuple(sorted(matched_pixels)),
                        )
                    )
                fields.append(
                    PartialLayerGeometry(
                        palette,
                        a,
                        b,
                        tuple(layers),
                    )
                )
                if len(fields) > 8:
                    return ()
    return tuple(fields)


def measure_partial_layer_fields(
    frame: FrameGrid, models: tuple[Mapping[str, Any], ...]
) -> tuple[PartialLayerField, ...]:
    """Attach actual canonical model provenance to physical descriptions."""
    if len(models) > 8:
        return ()
    eligible = tuple(
        model
        for model in models
        if model.get("term_ref")
        and model.get("model_claim_ref")
        and model.get("current_claim_pattern")
    )
    palettes = tuple(
        dict.fromkeys(tuple(model.get("palette_description", ())) for model in eligible)
    )
    geometries = measure_partial_layer_geometries(frame, palettes)
    fields = tuple(
        PartialLayerField(
            str(model["term_ref"]),
            str(model["model_claim_ref"]),
            str(model["current_claim_pattern"]),
            geometry.first_box,
            geometry.second_box,
            geometry.layers,
        )
        for model in eligible
        for geometry in geometries
        if tuple(model.get("palette_description", ())) == geometry.palette
    )
    return fields if len(fields) <= 8 else ()


def _retained_partial_pose_query(
    frame: FrameGrid,
    field: Any,
    layer: PartialLayerCorrespondence,
    model: Mapping[str, Any],
    point: tuple[int, int] | None = None,
) -> tuple[MaskPose, ...]:
    """Evaluate the retained conditional query, preserving unknown target cells."""
    query = model.get("uniform_pose_query")
    palette = tuple(model.get("palette_description", ()))
    if (
        not isinstance(query, Mapping)
        or len(palette) != 4
        or query.get("require_unique_compatible_pose") is not True
    ):
        return ()
    r, c, h, w = field.second_box.interior
    target_known = tuple(
        tuple(x in palette for x in row[c : c + w]) for row in frame.rows[r : r + h]
    )
    return tuple(
        measure_conditional_support_pose_domain(
            frame,
            field.first_box,
            field.second_box,
            layer.value,
            palette,
            json.dumps(dict(query), sort_keys=True),
            tuple(tuple(m[1:]) for m in model.get("historical_action_motions", ())),
            point,
            target_known,
        )
    )


def _measure_partial_query_boundary(
    value: Any,
    field: PartialLayerField,
    layer: PartialLayerCorrespondence,
    model: Mapping[str, Any],
    candidate: Any,
    control_value: int | None,
) -> dict[str, Any]:
    """Expose a failed visibility prerequisite, not a completed object mask."""
    query = model.get("uniform_pose_query", {})
    palette = tuple(model.get("palette_description", ()))
    if (
        query.get("contract") != "yf_arc3_v5.uniform_support_pose_query.v1"
        or query.get("body_requirement")
        != "unique_connected_support_exceeding_patch_area"
        or query.get("require_unclipped_body") is not True
        or len(palette) != 4
    ):
        return {}
    frame = value.current_observed_frame or value.frame
    bodies = measure_visible_support_bodies(
        frame,
        field.first_box,
        field.second_box,
        layer.value,
        palette,
        query.get("outline_occlusion_assumption")
        == "opposite_support_pixels_across_current_frame_outline",
    )
    if len(bodies) != 1:
        return {}
    body = bodies[0]
    boundary = any(
        r in (0, frame.height - 1) or c in (0, frame.width - 1) for r, c in body
    )
    if not boundary or (candidate.point is not None and candidate.point not in body):
        return {}
    r, c, h, w = field.second_box.interior
    target_positive = sum(
        frame.rows[r + i][c + j] in (layer.value, palette[3])
        for i in range(h)
        for j in range(w)
    )
    history = tuple(value.layer_transition_measurements)
    point_indices = tuple(
        i
        for i, x in enumerate(history)
        if x.point_value == layer.value and x.added_marker_value is not None
    )
    trials = (
        sum(
            x.action_ref == candidate.action_ref
            for x in history[point_indices[-1] + 1 :]
        )
        if point_indices
        else 0
    )
    rotations = set(
        m[2]
        for m in model.get("historical_action_motions", ())
        if m[0] == candidate.action_ref and m[1] == layer.value and m[2]
    )
    token = stable_digest(
        (
            "partial-query-boundary",
            field.model_ref,
            value.current_observation_frame_ref,
            layer.value,
            candidate.action_ref,
            candidate.point,
        )
    )[:24]
    return {
        "layer_current_binding_token": token,
        "layer_current_premise_claim_refs": (
            field.current_claim_pattern.format(binding_token=token),
        ),
        "layer_support_measurement_present": True,
        "layer_candidate_is_point": candidate.point is not None,
        "layer_candidate_controls_current_value": layer.value == control_value,
        "layer_current_marked_value_has_residual": any(
            x.value == control_value and x.current_known_difference_count > 0
            for x in field.layers
        ),
        "layer_patch_difference_count": layer.current_known_difference_count,
        "layer_partial_known_target_cell_count": layer.known_target_cell_count,
        "layer_partial_unknown_target_cell_count": layer.unknown_target_cell_count,
        "layer_partial_observed_pose_cell_count": 0,
        "layer_partial_pose_query_used": True,
        "layer_partial_pose_query_contract_ref": query["contract"],
        "layer_partial_pose_query_requires_unclipped_body": query[
            "require_unclipped_body"
        ],
        "layer_partial_body_count": len(bodies),
        "layer_partial_body_support_count": len(body),
        "layer_partial_body_boundary_contact": boundary,
        "layer_partial_target_visible_material_cell_count": target_positive,
        "layer_partial_retained_rotation_quarters": next(iter(rotations))
        if len(rotations) == 1
        else None,
        "layer_partial_pose_query_rotation_trial_count": trials,
        "layer_partial_current_palette_value": layer.value,
        "layer_partial_operator_action_ref": candidate.action_ref,
    }


def measure_partial_pose_motions(
    before: FrameGrid,
    after: FrameGrid,
    palettes: tuple[tuple[int, ...], ...],
    models: tuple[Mapping[str, Any], ...] = (),
) -> tuple[tuple[int, int, int, int], ...]:
    """Current observed pose deltas under one stable geometric description.

    Zero is retained when an oriented, uniquely measured projection did not
    move. No motion is inferred through an ambiguous pose or changed panel.
    This transports counterevidence as well as positive calibration.
    """
    pairs = []
    for first in measure_partial_layer_geometries(before, palettes):
        for second in measure_partial_layer_geometries(after, palettes):
            if (first.palette, first.first_box, first.second_box) != (
                second.palette,
                second.first_box,
                second.second_box,
            ):
                continue
            r, c, h, w = first.second_box.interior
            if any(
                before.rows[r + i][c : c + w] != after.rows[r + i][c : c + w]
                for i in range(h)
            ):
                continue
            query_models = tuple(
                m
                for m in models
                if tuple(m.get("palette_description", ())) == first.palette
            )
            known = []
            for a, b in zip(first.layers, second.layers):
                if a.value != b.value:
                    continue
                ap = a.poses if a.pose_count == 1 else ()
                bp = b.poses if b.pose_count == 1 else ()
                if len(query_models) == 1:
                    if not ap:
                        ap = _retained_partial_pose_query(
                            before, first, a, query_models[0]
                        )
                    if not bp:
                        bp = _retained_partial_pose_query(
                            after, second, b, query_models[0]
                        )
                if len(ap) == len(bp) == 1:
                    known.append((a.value, ap[0], bp[0]))
            if known:
                pairs.append(tuple(known))
    if len(pairs) != 1:
        return ()
    motions = []
    for material, p, q in pairs[0]:
        turn = (p.clockwise_quarters - q.clockwise_quarters) % 4
        if turn:
            motions.append((material, turn, 0, 0))
        elif p.clockwise_quarters == q.clockwise_quarters == 0:
            motions.append(
                (
                    material,
                    0,
                    p.row_delta - q.row_delta,
                    p.col_delta - q.col_delta,
                )
            )
    return tuple(motions)


def measure_partial_layer_context(
    value: Any,
) -> tuple[dict[str, Any], PartialLayerField | None]:
    models = tuple(value.canonical_layer_composition_memory_facts)
    if not models or len(value.layer_transition_measurements) >= 32:
        return {"layer_partial_pair_unique": False}, None
    frame = value.current_observed_frame or value.frame
    fields = measure_partial_layer_fields(frame, models)
    marked = tuple(
        x
        for x in value.layer_transition_measurements
        if x.point_value is not None and x.added_marker_value is not None
    )
    prior_hashes = dict(marked[0].before.patch_hashes) if marked else {}
    stability_observed = bool(prior_hashes)
    if stability_observed:
        stable_fields = []
        for field in fields:
            box = field.second_box
            r, c, h, w = box.interior
            patch = tuple(tuple(row[c : c + w]) for row in frame.rows[r : r + h])
            digest = hashlib.sha256(
                json.dumps(patch, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest()
            if prior_hashes.get(box) == digest:
                stable_fields.append(field)
        fields = tuple(stable_fields)
    if len(fields) != 1 or value.current_observation_frame_ref is None:
        return {"layer_partial_pair_unique": False}, None
    field = fields[0]
    boxes = (field.first_box.interior, field.second_box.interior)
    token = stable_digest(
        ("partial", field.model_ref, value.current_observation_frame_ref, boxes)
    )[:24]
    return {
        "layer_partial_pair_unique": True,
        "layer_partial_second_patch_stable_after_observed_point": stability_observed,
        "layer_recalled_model_ref": field.model_ref,
        "layer_recalled_premise_claim_refs": (field.model_claim_ref,),
        "layer_current_premise_claim_refs": (
            field.current_claim_pattern.format(binding_token=token),
        ),
        "layer_current_binding_token": token,
        "layer_binding_frame_ref": value.current_observation_frame_ref,
        "layer_current_field_boxes": boxes,
    }, field


def measure_partial_layer_candidate(
    value: Any, field: PartialLayerField | None, candidate: Any
) -> dict[str, Any]:
    if field is None:
        return {}
    history = tuple(value.layer_transition_measurements)
    marker_indices = tuple(
        i
        for i, x in enumerate(history)
        if x.point_value is not None and x.added_marker_value is not None
    )
    marked = tuple(history[i] for i in marker_indices)
    control_value = marked[-1].point_value if marked else None
    if value.last_selected_point_palette_value != control_value:
        control_value = None
    frame = value.current_observed_frame or value.frame
    if candidate.point is not None:
        r, c = candidate.point
        b = field.second_box
        if b.top <= r < b.top + b.height and b.left <= c < b.left + b.width:
            return {}
        layer_value = frame.rows[r][c]
    else:
        layer_value = control_value
    layers = tuple(x for x in field.layers if x.value == layer_value)
    if len(layers) != 1:
        return {}
    layer = layers[0]
    poses = layer.poses if layer.pose_count == 1 else ()
    query_used = False
    models = tuple(
        m
        for m in value.canonical_layer_composition_memory_facts
        if m["term_ref"] == field.model_ref
    )
    if not poses and len(models) == 1:
        poses = _retained_partial_pose_query(
            frame, field, layer, models[0], candidate.point
        )
        query_used = True
    if len(poses) != 1:
        return (
            _measure_partial_query_boundary(
                value, field, layer, models[0], candidate, control_value
            )
            if len(models) == 1
            else {}
        )
    if (
        candidate.point is not None
        and not query_used
        and candidate.point not in layer.matching_support_pixels
    ):
        return {}
    pose = poses[0]
    motions = tuple(
        tuple(m)
        for model in value.canonical_layer_composition_memory_facts
        if model["term_ref"] == field.model_ref
        for m in model.get("historical_action_motions", ())
        if m[0] == candidate.action_ref and (m[1] == layer.value or query_used)
    )
    turns = tuple(m[2] for m in motions if m[2])
    shifts = tuple((m[3], m[4]) for m in motions if m[2] == 0 and (m[3] or m[4]))
    rotation = len(set(turns)) == 1 and turns[0] == 1 and pose.clockwise_quarters > 0
    translation = (
        pose.clockwise_quarters == 0
        and len(set(shifts)) == 1
        and any(
            (dr == 0 and dc * pose.col_delta > 0 and abs(dc) <= abs(pose.col_delta))
            or (dc == 0 and dr * pose.row_delta > 0 and abs(dr) <= abs(pose.row_delta))
            for dr, dc in shifts
        )
    )
    current_observations = tuple(
        tuple(m)
        for transition in (history[marker_indices[-1] + 1 :] if marker_indices else ())
        if control_value == layer.value
        and transition.action_ref == candidate.action_ref
        for m in transition.motions
        if m[0] == layer.value
    )
    current_shifts = tuple(
        (m[2], m[3]) for m in current_observations if m[1] == 0 and (m[2] or m[3])
    )
    interface = {
        ref: (dr, dc) for ref, dr, dc in value.interface_action_translation_deltas
    }
    candidate_direction = interface.get(candidate.action_ref)
    inverse_candidates = []
    inverse_motion_materials = []
    query_requirements = []
    for model in value.canonical_layer_composition_memory_facts:
        if model["term_ref"] != field.model_ref:
            continue
        metric_requirement = model.get("uniform_pose_query", {}).get(
            "translation_requirement"
        )
        query_requirements.append(metric_requirement)
        metric_reuse_declared = (
            metric_requirement == "observed_axis_quanta_with_revisable_inverse"
        )
        for action, material, turn, dr, dc in model.get(
            "historical_action_motions", ()
        ):
            direction = interface.get(action)
            if (
                (material == layer.value or metric_reuse_declared)
                and turn == 0
                and (dr or dc)
                and not (dr and dc)
                and direction is not None
                and candidate_direction == (-direction[0], -direction[1])
                and dr * direction[0] + dc * direction[1] > 0
                and dr * direction[1] == dc * direction[0]
            ):
                inverse_candidates.append((-dr, -dc))
                inverse_motion_materials.append(material)
    inverse_shifts = tuple(sorted(set(inverse_candidates)))
    inverse_translation = (
        pose.clockwise_quarters == 0
        and len(inverse_shifts) == 1
        and any(
            (dr == 0 and dc * pose.col_delta > 0 and abs(dc) <= abs(pose.col_delta))
            or (dc == 0 and dr * pose.row_delta > 0 and abs(dr) <= abs(pose.row_delta))
            for dr, dc in inverse_shifts
        )
    )
    current_translation = (
        pose.clockwise_quarters == 0
        and len(set(current_shifts)) == 1
        and all(
            m[1] == 0 and (m[2], m[3]) == current_shifts[0]
            for m in current_observations
        )
        and any(
            (dr == 0 and dc * pose.col_delta > 0 and abs(dc) <= abs(pose.col_delta))
            or (dc == 0 and dr * pose.row_delta > 0 and abs(dr) <= abs(pose.row_delta))
            for dr, dc in current_shifts
        )
    )
    inverse_contradicted = len(inverse_shifts) == 1 and any(
        m[1] != 0 or (m[2], m[3]) != inverse_shifts[0] for m in current_observations
    )
    prior_contradicted = len(set(shifts)) == 1 and any(
        m[1] != 0 or (m[2], m[3]) != shifts[0] for m in current_observations
    )
    controlled_open = any(
        x.value == control_value and x.current_known_difference_count > 0
        for x in field.layers
    )
    token = stable_digest(
        (
            "partial-material",
            field.model_ref,
            value.current_observation_frame_ref,
            field.first_box.interior,
            field.second_box.interior,
            layer.value,
            pose.clockwise_quarters,
            pose.window_row,
            pose.window_col,
            pose.observed_cell_count,
            candidate.action_ref,
            inverse_shifts,
            current_observations,
            marker_indices[-1] if marker_indices else None,
            query_used,
        )
    )[:24]
    return {
        "layer_current_binding_token": token,
        "layer_current_premise_claim_refs": (
            field.current_claim_pattern.format(binding_token=token),
        ),
        "layer_support_measurement_present": True,
        "layer_candidate_is_point": candidate.point is not None,
        "layer_candidate_controls_current_value": layer.value == control_value,
        "layer_current_marked_value_has_residual": controlled_open,
        "layer_patch_difference_count": layer.current_known_difference_count,
        "layer_partial_known_target_cell_count": layer.known_target_cell_count,
        "layer_partial_unknown_target_cell_count": layer.unknown_target_cell_count,
        "layer_partial_observed_pose_cell_count": pose.observed_cell_count,
        "layer_partial_pose_query_used": query_used,
        "layer_partial_pose_query_contract_ref": (
            models[0]["uniform_pose_query"]["contract"] if query_used else None
        ),
        "layer_partial_rotation_reduces_quarters": rotation,
        "layer_partial_translation_reduces_displacement": translation,
        "layer_partial_current_translation_reduces_displacement": current_translation,
        "layer_partial_inverse_translation_reduces_displacement": inverse_translation,
        "layer_partial_inverse_query_requirements": tuple(query_requirements),
        "layer_partial_inverse_query_requirement": (
            query_requirements[0] if len(query_requirements) == 1 else None
        ),
        "layer_partial_current_operator_observations": current_observations,
        "layer_partial_current_control_observation_start_index": (
            marker_indices[-1] if marker_indices else None
        ),
        "layer_partial_inverse_motion_materials": tuple(
            sorted(set(inverse_motion_materials))
        ),
        "layer_partial_inverse_shift_candidates": inverse_shifts,
        "layer_partial_inverse_contradicted": inverse_contradicted,
        "layer_partial_prior_translation_contradicted": prior_contradicted,
        "layer_partial_operator_action_ref": candidate.action_ref,
        "layer_partial_current_palette_value": layer.value,
        "layer_partial_current_pose_quarters": pose.clockwise_quarters,
        "layer_partial_current_row_delta": pose.row_delta,
        "layer_partial_current_col_delta": pose.col_delta,
    }
