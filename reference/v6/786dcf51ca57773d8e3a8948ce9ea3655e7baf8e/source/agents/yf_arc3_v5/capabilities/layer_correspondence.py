"""Bounded geometric correspondences of overlapping binary supports.

All palette assignments below are conditional raster descriptions. No colour
has a built-in role, and these measurements do not choose an action or commit
a composition law. Closed holes and boundary-open notches are both compared.
"""

from __future__ import annotations

from .physical_transition_contracts import (
    LayerCorrespondence,
    LayerField,
    LayerRasterSample,
    LayerTransitionMeasure,
    MaskPose,
    RasterBox,
)

from collections import Counter
from itertools import combinations
from math import gcd
import hashlib
import json
from functools import lru_cache

from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput, FrameGrid

MAX_FRAME_AREA = 4096
MAX_BOXES = 8
MAX_PAIR_DESCRIPTIONS = 3
MAX_MATCHES = 3
MAX_PATCH_AREA = 256














def rectangular_outline_measurements(frame: FrameGrid) -> tuple[RasterBox, ...]:
    """Complete rectangles and a congruent three-sided outline interrupted by a band."""
    if frame.height * frame.width > MAX_FRAME_AREA:
        return ()
    components = detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
    complete = []
    for component in components:
        box = component.bbox
        h, w = box.height, box.width
        if h < 3 or w < 3 or (h - 2) * (w - 2) > MAX_PATCH_AREA:
            continue
        border = {(r, c) for r in range(box.top, box.bottom + 1) for c in range(box.left, box.right + 1)
                  if r in (box.top, box.bottom) or c in (box.left, box.right)}
        if frozenset(component.pixels) == border:
            complete.append(RasterBox(box.top, box.left, h, w, component.value, 4))
    result = list(complete)
    for component in components:
        pixels = frozenset(component.pixels)
        for exemplar in complete:
            if component.value != exemplar.value:
                continue
            # Any one side may be interrupted by a uniform raster-spanning
            # band. Enumerate all four directions; no screen position is fixed.
            h, w = exemplar.height, exemplar.width
            for side in range(4):
                top = component.bbox.top - int(side == 0)
                left = component.bbox.left - int(side == 2)
                bottom, right = top + h - 1, left + w - 1
                if top < 0 or left < 0 or bottom >= frame.height or right >= frame.width:
                    continue
                missing = ({(top, c) for c in range(left, right + 1)},
                           {(bottom, c) for c in range(left, right + 1)},
                           {(r, left) for r in range(top, bottom + 1)},
                           {(r, right) for r in range(top, bottom + 1)})[side]
                border = {(r, c) for r in range(top, bottom + 1) for c in range(left, right + 1)
                          if r in (top, bottom) or c in (left, right)}
                if pixels != border - missing:
                    continue
                line = (frame.rows[top] if side == 0 else frame.rows[bottom] if side == 1
                        else tuple(row[left if side == 2 else right] for row in frame.rows))
                if len(set(line)) == 1:
                    result.append(RasterBox(top, left, h, w, component.value, 3))
    return tuple(result) if len(result) <= MAX_BOXES else ()


def _rotate(rows: tuple[tuple[bool, ...], ...]) -> tuple[tuple[bool, ...], ...]:
    return tuple(tuple(column) for column in zip(*rows[::-1]))


def _mask_matches(
    known: tuple[tuple[bool, ...], ...], support: tuple[tuple[bool, ...], ...],
    target: tuple[tuple[bool, ...], ...], origin: tuple[int, int],
    target_known: tuple[tuple[bool, ...], ...] | None = None,
) -> tuple[tuple[MaskPose, ...], int]:
    """Measure four orientations and every bounded raster-window translation.

Retain only the maximal observed agreement count and up to three occurrences.
The caller receives ambiguity explicitly, never a silently truncated choice.
There are no paths, operator sequences, or simulated hidden cells here.
"""
    h, w = len(target), len(target[0])
    mask = (1 << w) - 1
    target_bits = tuple(sum(int(x) << c for c, x in enumerate(row)) for row in target)
    target_visible = (tuple(sum(int(x) << c for c, x in enumerate(row))
                            for row in target_known)
                      if target_known is not None else (mask,) * h)
    requires_positive = any(row & visible for row, visible in zip(target_bits, target_visible))
    requires_negative = any(~row & visible for row, visible in zip(target_bits, target_visible))
    maximum, count, occurrences = -1, 0, []
    for q in range(4):
        raster_bits = (0,) * (h - 1) + tuple(sum(int(x) << (c + w - 1) for c, x in enumerate(row)) for row in support) + (0,) * (h - 1)
        visible_bits = (0,) * (h - 1) + tuple(sum(int(x) << (c + w - 1) for c, x in enumerate(row)) for row in known) + (0,) * (h - 1)
        for r in range(len(support) + h - 1):
            for c in range(len(support[0]) + w - 1):
                evidence, positive, negative = 0, False, False
                for i, target_row in enumerate(target_bits):
                    visible = (visible_bits[r + i] >> c) & target_visible[i]
                    source = (raster_bits[r + i] >> c) & mask
                    if (source ^ target_row) & visible:
                        break
                    evidence += visible.bit_count()
                    positive |= bool(visible & target_row)
                    negative |= bool(visible & ~target_row)
                else:
                    if ((requires_positive and not positive)
                            or (requires_negative and not negative)
                            or evidence < maximum):
                        continue
                    if evidence > maximum:
                        maximum, count, occurrences = evidence, 0, []
                    count += 1
                    if len(occurrences) < MAX_MATCHES:
                        rr, cc = r - h + 1, c - w + 1
                        occurrences.append(MaskPose(q, rr, cc, evidence, origin[0] - rr, origin[1] - cc))
        support, known = _rotate(support), _rotate(known)
    return (tuple(occurrences) if count <= MAX_MATCHES else ()), count


def measure_layer_fields(
    frame: FrameGrid,
    composition_patterns: tuple[tuple[int, int, int, int], ...] = (),
) -> tuple[LayerField, ...]:
    boxes = rectangular_outline_measurements(frame)
    if not boxes:
        return ()
    raster = frame.rows
    fields = []
    for first, second in combinations(boxes, 2):
        if (first.height, first.width) != (second.height, second.width):
            continue
        # Both ordered geometric descriptions remain possible. Only a unique
        # occurrence may be consumed by an external declarative rule.
        for a, b in ((first, second), (second, first)):
            ar, ac, h, w = a.interior
            br, bc, _, _ = b.interior
            if not (ar + h <= br or br + h <= ar or ac + w <= bc or bc + w <= ac):
                continue
            target = tuple(row[bc:bc + w] for row in raster[br:br + h])
            counts = Counter(x for row in target for x in row)
            if len(counts) != 4 and not composition_patterns:
                continue
            exterior = tuple(tuple(not (b.top <= r < b.top + b.height and b.left <= c < b.left + b.width)
                                  for c in range(frame.width)) for r in range(frame.height))
            outside = Counter(x for r, row in enumerate(raster) for c, x in enumerate(row) if exterior[r][c])
            # Exterior connected supports must exceed the enclosed patch area.
            # A value spanning all four raster edges is recorded separately.
            sides = (raster[0], raster[-1], tuple(row[0] for row in raster), tuple(row[-1] for row in raster))
            background_candidates = set(counts) | {p[0] for p in composition_patterns}
            spanning_edges = [v for v in background_candidates if sum(v in side for side in sides) >= 3]
            if len(spanning_edges) != 1:
                continue
            background = spanning_edges[0]
            recalled = tuple(p for p in composition_patterns
                if p[0] == background and set(counts) <= set(p)
                and p[3] in counts and any(v in counts for v in p[1:3])
                and all(outside[v] > h * w for v in p[1:3]))
            if composition_patterns:
                if len(recalled) != 1:
                    continue
                _, first_value, second_value, extra = recalled[0]
                values = [first_value, second_value]
                described_values = set(recalled[0])
            else:
                values = [v for v in counts if v != background and outside[v] > h * w]
                if len(values) != 2:
                    continue
                remaining = set(counts) - {background, *values}
                if len(remaining) != 1:
                    continue
                extra = remaining.pop()
                described_values = set(counts)
            known = tuple(tuple(x in described_values and exterior[r][c] for c, x in enumerate(row)) for r, row in enumerate(raster))
            layers = []
            for v in sorted(values):
                support = tuple(tuple(x in (v, extra) for x in row) for row in raster)
                target_mask = tuple(tuple(x in (v, extra) for x in row) for row in target)
                poses, count = _mask_matches(known, support, target_mask, (ar, ac))
                difference = sum(support[ar+r][ac+c] != target_mask[r][c] for r in range(h) for c in range(w))
                layers.append(LayerCorrespondence(v, extra, outside[v], poses, count, difference))
            difference = sum(raster[ar+r][ac+c] != target[r][c] for r in range(h) for c in range(w))
            fields.append(LayerField(a, b, background, extra, tuple(layers), difference))
            if len(fields) > MAX_PAIR_DESCRIPTIONS:
                return ()
    return tuple(fields)


@lru_cache(maxsize=4)
def measure_layer_sample(frame: FrameGrid,
        composition_patterns: tuple[tuple[int, int, int, int], ...] = ()) -> LayerRasterSample:
    fields = measure_layer_fields(frame, composition_patterns)
    boxes = tuple(dict.fromkeys(box for field in fields for box in (field.first_box, field.second_box)))
    hashes = []
    for box in boxes:
        r, c, h, w = box.interior
        patch = tuple(tuple(row[c:c+w]) for row in frame.rows[r:r+h])
        hashes.append((box, hashlib.sha256(json.dumps(patch, sort_keys=True, separators=(",", ":")).encode()).hexdigest()))
    return LayerRasterSample(fields, tuple(hashes))


@lru_cache(maxsize=4)
def outlined_layer_sample(frame):
    hashes = []
    for box in rectangular_outline_measurements(frame):
        r, c, h, w = box.interior
        patch = tuple(tuple(row[c:c+w]) for row in frame.rows[r:r+h])
        hashes.append((box, hashlib.sha256(json.dumps(patch,
            sort_keys=True, separators=(",", ":")).encode()).hexdigest()))
    return LayerRasterSample((), tuple(hashes))

def measure_layer_transition(
    before: FrameGrid, after: FrameGrid, action_ref: str,
    point: tuple[int, int] | None,
    composition_patterns: tuple[tuple[int, int, int, int], ...] = (),
    pose_query_models: tuple = (),
) -> LayerTransitionMeasure | None:
    previous = measure_layer_sample(before, composition_patterns)
    if not previous.fields:
        # Retain a directly observed one-cell point marker even when the old
        # model cannot describe a complete current field. This does not acquire
        # a new composition law or transfer a control role to a new material.
        if not composition_patterns:
            return None
        if point is None:
            from .partial_layer_correspondence import measure_partial_pose_motions
            motions = measure_partial_pose_motions(
                before, after, composition_patterns, pose_query_models)
            if pose_query_models:
                from .unassigned_support_query import measure_unassigned_support_pose_motions
                motions = tuple(dict.fromkeys((*motions, *measure_unassigned_support_pose_motions(
                    before, after, pose_query_models))))
            if not motions:
                return None
            changed = sum(a != b for ra, rb in zip(before.rows, after.rows)
                          for a, b in zip(ra, rb))
            return LayerTransitionMeasure(action_ref, outlined_layer_sample(before),
                outlined_layer_sample(after), None, None, changed, motions, 0, 0)
        changes = tuple((r, c, a, b) for r, (ra, rb) in enumerate(zip(before.rows, after.rows))
                        for c, (a, b) in enumerate(zip(ra, rb)) if a != b)
        values = {v for pattern in composition_patterns for v in pattern}
        if not (0 <= point[0] < before.height and 0 <= point[1] < before.width):
            return None
        point_value = before.rows[point[0]][point[1]]
        point_vocabulary = values | {point_value}
        added = tuple(b for _, _, a, b in changes if a in point_vocabulary and b not in point_vocabulary)
        if len(added) != 1 or len(changes) > 2:
            return None
        # These are raw current-scene patch hashes, not inherited role bindings.
        # A later query can measure which enclosure stayed stable under this
        # observed point without interpreting its novel marker as a new layer.
        return LayerTransitionMeasure(action_ref, outlined_layer_sample(before),
            outlined_layer_sample(after), point_value, added[0], len(changes), (), 0, 0)
    current = measure_layer_sample(after, composition_patterns)
    changes = tuple((r, c, a, b) for r, (ra, rb) in enumerate(zip(before.rows, after.rows))
                    for c, (a, b) in enumerate(zip(ra, rb)) if a != b)
    point_value = before.rows[point[0]][point[1]] if point is not None and 0 <= point[0] < before.height and 0 <= point[1] < before.width else None
    # A transferred marker can reuse a colour seen in the preceding raster.
    palette = {v for f in previous.fields for v in (f.background_value, f.extra_value, f.first_box.value, *(x.value for x in f.layers))}
    added = tuple(b for _, _, a, b in changes if b not in palette and a in palette)
    marker = added[0] if point is not None and len(added) == 1 and len(changes) <= 2 else None
    motions = []
    intersection_count, mismatch_count = 0, 0
    for first in previous.fields:
        if dict(previous.patch_hashes).get(first.second_box) != dict(current.patch_hashes).get(first.second_box):
            continue
        peers = tuple(x for x in current.fields if x.first_box == first.first_box and x.second_box == first.second_box)
        if len(peers) != 1:
            continue
        second = peers[0]
        for a, b in zip(first.layers, second.layers):
            if a.value != b.value or len(a.poses) != 1 or len(b.poses) != 1:
                continue
            p, q = a.poses[0], b.poses[0]
            turns = (p.clockwise_quarters - q.clockwise_quarters) % 4
            dr = p.row_delta - q.row_delta if p.clockwise_quarters == q.clockwise_quarters == 0 else 0
            dc = p.col_delta - q.col_delta if p.clockwise_quarters == q.clockwise_quarters == 0 else 0
            if not (turns or dr or dc):
                continue
            motions.append((a.value, turns, dr, dc))
            if turns or not (dr or dc):
                continue
            other_values = tuple(x.value for x in first.layers if x.value != a.value)
            if len(other_values) != 1:
                continue
            other = other_values[0]
            base_values = (first.background_value, a.value, other, first.extra_value)
            for r in range(after.height):
                for c in range(after.width):
                    sr, sc = r - dr, c - dc
                    if not (0 <= sr < before.height and 0 <= sc < before.width):
                        continue
                    box = first.second_box
                    if any(box.top <= rr < box.top + box.height and box.left <= cc < box.left + box.width for rr, cc in ((r, c), (sr, sc))):
                        continue
                    moving, stationary, observed = before.rows[sr][sc], before.rows[r][c], after.rows[r][c]
                    if moving not in base_values or stationary not in base_values or observed not in base_values:
                        continue
                    overlap = moving in (a.value, first.extra_value) and stationary in (other, first.extra_value)
                    if overlap:
                        intersection_count += 1
                        mismatch_count += observed != first.extra_value
                    elif observed == first.extra_value:
                        mismatch_count += 1
    return LayerTransitionMeasure(action_ref, previous, current, point_value, marker, len(changes), tuple(motions), intersection_count, mismatch_count)


def layer_composition_patterns(models: tuple) -> tuple[tuple[int, int, int, int], ...]:
    return tuple(dict.fromkeys(tuple(m["palette_description"]) for m in models
        if len(m.get("palette_description", ())) == 4))


def measure_layer_probe_context(value: object) -> tuple[dict, object]:
    """Return descriptive context and a typed unique stable-patch occurrence."""
    models = value.canonical_layer_composition_memory_facts
    patterns = layer_composition_patterns(models)
    sample = measure_layer_sample(value.current_observed_frame or value.frame, patterns)
    history = tuple(value.layer_transition_measurements)
    initial = dict(history[0].before.patch_hashes) if history else dict(sample.patch_hashes)
    hashes = dict(sample.patch_hashes)
    equal_patch_fields = tuple(f for f in sample.fields if initial.get(f.second_box) == hashes.get(f.second_box))
    unique = equal_patch_fields[0] if len(equal_patch_fields) == 1 else None
    facts = {
        "layer_pair_measurement_count": len(equal_patch_fields),
        "layer_pair_unique": unique is not None,
        "layer_intersection_observed_count": sum(x.intersection_observed_count for x in history),
        "layer_intersection_mismatch_count": sum(x.intersection_mismatch_count for x in history),
    }
    if unique is not None and len(models) == 1 and value.current_observation_frame_ref is not None:
        model = models[0]
        boxes = (unique.first_box.interior, unique.second_box.interior)
        token = hashlib.sha256(json.dumps((model["term_ref"],
            value.current_observation_frame_ref, boxes), sort_keys=True, separators=(",", ":")).encode()).hexdigest()[:24]
        current_ref = model["current_claim_pattern"].format(binding_token=token)
        facts.update({"layer_recalled_model_present": True,
            "layer_recalled_model_ref": model["term_ref"],
            "layer_recalled_premise_claim_refs": (model["model_claim_ref"],),
            "layer_current_premise_claim_refs": (current_ref,),
            "layer_current_binding_token": token,
            "layer_binding_frame_ref": value.current_observation_frame_ref,
            "layer_current_field_boxes": boxes})
    return facts, unique


def _uniform_support_pose_domain(frame, field, layer, query, motions, point=None):
    br, bc, h, w = field.second_box.interior
    target = tuple(tuple(frame.rows[br+r][bc+c] in (layer.value, field.extra_value)
        for c in range(w)) for r in range(h))
    if len({x for row in target for x in row}) != 1:
        return ()
    palette = (field.background_value, *(x.value for x in field.layers), field.extra_value)
    return measure_conditional_support_pose_domain(
        frame, field.first_box, field.second_box, layer.value, palette,
        json.dumps(dict(query), sort_keys=True), tuple(motions), point)


@lru_cache(maxsize=16)
def measure_visible_support_bodies(frame, first_box, second_box, layer_value, palette, bridge_outline=False,
        support_values=None):
    """Return bounded connected visible supports, without inventing clipped cells."""
    if frame.height * frame.width > MAX_FRAME_AREA or len(palette) != 4:
        return ()
    _, _, h, w = second_box.interior
    support_values = support_values if support_values is not None else (layer_value, palette[3])
    pts = {(r,c) for r,row in enumerate(frame.rows) for c,x in enumerate(row)
        if x in support_values and not
        (second_box.top <= r < second_box.top + second_box.height
         and second_box.left <= c < second_box.left + second_box.width)}
    if bridge_outline:
        box = first_box
        border = {(r,c) for r in range(box.top,box.top+box.height)
            for c in range(box.left,box.left+box.width)
            if r in (box.top,box.top+box.height-1)
            or c in (box.left,box.left+box.width-1)}
        bridges = {(r,c) for r,c in border if frame.rows[r][c] == box.value and
            (((r-1,c) in pts and (r+1,c) in pts)
             or ((r,c-1) in pts and (r,c+1) in pts))}
        pts.update(bridges)
    bodies = []
    while pts:
        pending = [pts.pop()]
        body = set(pending)
        while pending:
            r,c = pending.pop()
            for p in ((r-1,c), (r+1,c), (r,c-1), (r,c+1)):
                if p in pts:
                    pts.remove(p)
                    body.add(p)
                    pending.append(p)
        if len(body) > h*w:
            bodies.append(frozenset(body))
    return tuple(bodies)


@lru_cache(maxsize=16)
def measure_conditional_support_pose_domain(
    frame, first_box, second_box, layer_value, palette, query_json, motions,
    point=None, target_known=None,
    support_values=None, target_values=None, known_values=None,
):
    """Enumerate the declared conditional geometry; never select a route.

    Unknown overlay pixels remain unknown. No offscreen shape is synthesized.
    The anchor and inverse quantum are the query's revisable premises.
    """
    query = json.loads(query_json)
    if (len(palette) != 4 or len(set(palette)) != 4
            or query.get("contract") != "yf_arc3_v5.uniform_support_pose_query.v1"
            or query.get("rotation_anchor_assumption") != "visible_body_minimum_corner"
            or query.get("translation_requirement") != "observed_axis_quanta_with_revisable_inverse"
            or query.get("body_requirement") != "unique_connected_support_exceeding_patch_area"):
        return ()
    br, bc, h, w = second_box.interior
    support_values = support_values if support_values is not None else (layer_value, palette[3])
    target_values = target_values if target_values is not None else (layer_value, palette[3])
    known_values = known_values if known_values is not None else palette
    target = tuple(tuple(frame.rows[br+r][bc+c] in target_values
        for c in range(w)) for r in range(h))
    if target_known is None:
        target_known = tuple((True,) * w for _ in range(h))
    if (len(target_known) != h or any(len(row) != w for row in target_known)
            or not any(any(row) for row in target_known)):
        return ()
    bodies = measure_visible_support_bodies(frame, first_box, second_box, layer_value, palette,
        query.get("outline_occlusion_assumption") == "opposite_support_pixels_across_current_frame_outline",
        support_values)
    if len(bodies) != 1:
        return ()
    body = bodies[0]
    if point is not None and (point not in body
            or frame.rows[point[0]][point[1]] not in support_values):
        return ()
    top, left = min(r for r,c in body), min(c for r,c in body)
    bottom, right = max(r for r,c in body), max(c for r,c in body)
    if query.get("require_unclipped_body") and (
            top == 0 or left == 0 or bottom == frame.height-1 or right == frame.width-1):
        return ()
    vertical = tuple(abs(dr) for _,turn,dr,dc in motions if not turn and dr and not dc)
    horizontal = tuple(abs(dc) for _,turn,dr,dc in motions if not turn and dc and not dr)
    if not vertical or not horizontal or not any(turn == 1 for _,turn,dr,dc in motions):
        return ()
    vr, hc = 0, 0
    for quantum in vertical:
        vr = gcd(vr, quantum)
    for quantum in horizontal:
        hc = gcd(hc, quantum)
    limit = query.get("maximum_translation_extent", 0)
    if not 0 < limit <= MAX_FRAME_AREA**0.5:
        return ()
    support = tuple(tuple((r,c) in body for c in range(left,right+1))
                    for r in range(top,bottom+1))
    known = tuple(tuple(frame.rows[r][c] in known_values for c in range(left,right+1))
                  for r in range(top,bottom+1))
    ar, ac, _, _ = first_box.interior
    poses = []
    for turns in range(4):
        for dr in range(-(limit//vr)*vr, limit+1, vr):
            for dc in range(-(limit//hc)*hc, limit+1, hc):
                observed, compatible = 0, True
                for r in range(h):
                    for c in range(w):
                        rr, cc = ar+r-top-dr, ac+c-left-dc
                        inside = 0 <= rr < len(support) and 0 <= cc < len(support[0])
                        visible = not inside or known[rr][cc]
                        present = inside and support[rr][cc]
                        if visible and target_known[r][c]:
                            observed += 1
                            compatible &= present == target[r][c]
                    if not compatible:
                        break
                if compatible and observed:
                    poses.append(MaskPose(turns, ar-dr, ac-dc, observed, dr, dc))
        support, known = _rotate(support), _rotate(known)
    if poses and query.get("result_mode") == "all_minimum_primitive_count_compatible_poses":
        costs = tuple(p.clockwise_quarters + abs(p.row_delta)//vr + abs(p.col_delta)//hc
                      for p in poses)
        minimum = min(costs)
        poses = [p for p,cost in zip(poses,costs) if cost == minimum]
    return tuple(poses)


def measure_layer_candidate(value: object, field: LayerField | None, candidate: object) -> dict:
    if field is None or len(value.layer_transition_measurements) >= 32:
        return {}
    history = tuple(value.layer_transition_measurements)
    marked = tuple(x for x in history if x.point_value is not None and x.added_marker_value is not None)
    control_value = marked[-1].point_value if marked else None
    point_value = None
    frame = value.current_observed_frame or value.frame
    if candidate.point is not None:
        r, c = candidate.point
        point_value = frame.rows[r][c]
        box = field.second_box
        if box.top <= r < box.top + box.height and box.left <= c < box.left + box.width:
            return {}
    layer_value = point_value if candidate.point is not None else control_value
    matches = tuple(x for x in field.layers if x.value == layer_value)
    if len(matches) != 1:
        return {}
    layer = matches[0]
    recalled = tuple(m for model in value.canonical_layer_composition_memory_facts
        for m in model.get("historical_action_motions", ()))
    all_motions = tuple(tuple(m[1:]) for m in recalled)
    query_models = tuple(model for model in value.canonical_layer_composition_memory_facts
        if model.get("uniform_pose_query"))
    provisional = False
    poses = layer.poses
    if len(poses) != 1 and len(query_models) == 1:
        poses = _uniform_support_pose_domain(frame, field, layer,
            query_models[0]["uniform_pose_query"], all_motions, candidate.point)
        provisional = True
    if len(poses) != 1:
        return {}
    pose = poses[0]
    moves = (*tuple(m for x in history for m in x.motions if m[0] == layer.value),
        *tuple(tuple(m[1:]) for m in recalled if m[1] == layer.value))
    rotation_actions = tuple(dict.fromkeys((*tuple(x.action_ref for x in history if any(m[1] for m in x.motions)),
        *tuple(m[0] for m in recalled if m[2]))))
    translation = dict((ref, (dr, dc)) for ref, dr, dc in value.interface_action_translation_deltas)
    delta = translation.get(candidate.action_ref, (0, 0))
    reduces = pose.clockwise_quarters == 0 and (
        (delta[0] != 0 and delta[1] == 0 and pose.row_delta * delta[0] > 0) or
        (delta[1] != 0 and delta[0] == 0 and pose.col_delta * delta[1] > 0)
    )
    quanta = (*tuple((dr, dc) for x in history if x.action_ref == candidate.action_ref
        for v, turn, dr, dc in x.motions if turn == 0 and (dr or dc)),
        *tuple((m[3], m[4]) for m in recalled if m[0] == candidate.action_ref and not m[2]))
    no_overshoot = all(abs(dr) <= abs(pose.row_delta) and abs(dc) <= abs(pose.col_delta) for dr, dc in quanta)
    overlay_values = ()
    if (len(query_models) == 1 and marked and query_models[0]["uniform_pose_query"].get(
            "presentation_overlay_requirement") == "observed_current_selection_marker_only"):
        overlay_values = (marked[-1].added_marker_value,)
    ar, ac, h, w = field.first_box.interior
    br, bc, _, _ = field.second_box.interior
    residuals = {x.value: sum(
        frame.rows[ar+r][ac+c] not in overlay_values and
        ((frame.rows[ar+r][ac+c] in (x.value, field.extra_value)) !=
         (frame.rows[br+r][bc+c] in (x.value, field.extra_value)))
        for r in range(h) for c in range(w)) for x in field.layers}
    overlay_count = sum(frame.rows[ar+r][ac+c] in overlay_values
                        for r in range(h) for c in range(w))
    controlled_open = any(x.value == control_value and residuals[x.value] > 0 for x in field.layers)
    return {
        "layer_support_measurement_present": True,
        "layer_pose_uses_provisional_anchor": provisional,
        "layer_palette_value": layer.value,
        "layer_extra_palette_value": field.extra_value,
        "layer_pose_observed_cell_count": pose.observed_cell_count,
        "layer_pose_quarters": pose.clockwise_quarters,
        "layer_row_delta": pose.row_delta,
        "layer_col_delta": pose.col_delta,
        "layer_patch_difference_count": residuals[layer.value],
        "layer_patch_selection_overlay_cell_count": overlay_count,
        "layer_pattern_difference_count": field.exact_current_pattern_difference_count,
        "layer_marker_after_point_observed": bool(marked),
        "layer_candidate_controls_current_value": layer.value == control_value,
        "layer_current_marked_value_has_residual": controlled_open,
        "layer_candidate_translation_reduces_residual": reduces and no_overshoot,
        "layer_candidate_rotation_previously_observed": candidate.action_ref in rotation_actions,
        "layer_observed_rotation_action_count": len(rotation_actions),
        "layer_observed_motion_count": len(moves),
        "layer_candidate_is_point": candidate.point is not None,
    }
