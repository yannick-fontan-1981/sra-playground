"""Bounded rectangle correspondences and one adjacent measured support.

No palette role, terminal law, selection priority or action is decided here.
The domain is explicitly restricted to unique pairs of rectangular occurrences.
"""
from collections import defaultdict
from fractions import Fraction

from .contracts import InteractionProbeInput, VisualSceneInput
from .sprites import describe_visual_scene


def measure_metric_reference_residual(value: InteractionProbeInput, vectors, point_action_ref):
    empty = {'metric_reference_alignment_count': 0,
        'metric_reference_point_border_observed': False}
    previous = value.previous_action_observed_frame
    point = value.last_point_position
    after_point = value.last_action_ref == point_action_ref and previous is not None and point is not None
    scene = describe_visual_scene(VisualSceneInput(
        frame=previous if after_point else value.frame))
    components = scene.blocks.components
    if len(components) > 128:
        return {**empty, 'metric_reference_measurement_bound_reached': True}
    rectangles = [c for c in components if c.area == c.bbox.height*c.bbox.width]
    grouped = defaultdict(list)
    for c in rectangles:
        grouped[c.value].append(c)
    pairs = {v: tuple(cs) for v, cs in sorted(grouped.items()) if len(cs) == 2}
    seeds = defaultdict(set)
    for label, cs in sorted(pairs.items()):
        for a, b in (cs, cs[::-1]):
            scale = Fraction(b.bbox.width, a.bbox.width)
            if scale <= 1 or Fraction(b.bbox.height, a.bbox.height) != scale:
                continue
            seeds[(scale, b.bbox.top-scale*a.bbox.top,
                   b.bbox.left-scale*a.bbox.left)].add(label)
    alignments = []
    comparisons = 0
    for (scale, dy, dx), anchors in sorted(seeds.items()):
        if len(anchors) < 2:
            continue
        rows = []
        for label, cs in sorted(pairs.items()):
            for a, b in (cs, cs[::-1]):
                comparisons += 1
                if comparisons > 4096:
                    return {**empty, 'metric_reference_measurement_bound_reached': True}
                box = a.bbox
                target = (dy+scale*box.top, dx+scale*box.left,
                    dy+scale*(box.bottom+1)-1, dx+scale*(box.right+1)-1)
                if any(n.denominator != 1 for n in target):
                    continue
                target = tuple(int(n) for n in target)
                bb = b.bbox
                current = (bb.top, bb.left, bb.bottom, bb.right)
                if target == current:
                    rows.append((label, a, b, target, (0, 0)))
                    continue
                t, l, bottom, right = target
                delta = None
                if l == bb.left and right == bb.right:
                    if bottom+1 == bb.top:
                        delta = (-1, 0)
                    elif t == bb.bottom+1:
                        delta = (1, 0)
                if t == bb.top and bottom == bb.bottom:
                    if right+1 == bb.left:
                        delta = (0, -1)
                    elif l == bb.right+1:
                        delta = (0, 1)
                if delta is None:
                    continue
                if any((c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right) == target
                       and c.value != label for c in rectangles):
                    rows.append((label, a, b, target, delta))
        changed = [row for row in rows if row[-1] != (0, 0)]
        matched = [row for row in rows if row[-1] == (0, 0)]
        if len(changed) != 1 or len(matched) < 2 or len({row[0] for row in rows}) != len(rows):
            continue
        # All paired material classes must participate in this correspondence.
        if {row[0] for row in rows} != set(pairs):
            continue
        a, b, target, delta = changed[0][1:]
        footprint = b.bbox
        border_observed = False
        if after_point and footprint.top <= point[0] <= footprint.bottom and footprint.left <= point[1] <= footprint.right:
            differences = [(r, c) for r in range(value.frame.height) for c in range(value.frame.width)
                if value.frame.rows[r][c] != previous.rows[r][c]]
            border_observed = bool(differences) and all(
                footprint.top <= r <= footprint.bottom and footprint.left <= c <= footprint.right
                and (r in (footprint.top, footprint.bottom) or c in (footprint.left, footprint.right))
                for r, c in differences)
        alignments.append({'metric_reference_matched_count': len(matched),
            'metric_reference_residual_bbox': (footprint.top, footprint.left, footprint.bottom, footprint.right),
            'metric_reference_residual_component_ref': b.component_id,
            'metric_reference_target_bbox': target,
            'metric_reference_point_border_observed': border_observed,
            'metric_reference_adjacent_action_refs': tuple(ref for ref, vector in sorted(vectors.items())
                if tuple(vector) == delta and ref in value.available_action_refs),
            'metric_reference_scale_ratio': (scale.numerator, scale.denominator),
            'metric_reference_pair_count': len(pairs)})
    if len(alignments) != 1:
        from .metric_reference_geometry import measure_partitioned_reference
        partitioned = measure_partitioned_reference(value, vectors, point_action_ref)
        if partitioned:
            return partitioned
        return {**empty, 'metric_reference_alignment_count': len(alignments)}
    return {**alignments[0], 'metric_reference_alignment_count': 1,
        'metric_reference_residual_is_minimum_distance': True,
        'metric_reference_measurement_bound_reached': False}


def metric_reference_point_facts(measurement, candidate, point_action_ref):
    """Bind one measured occurrence to an already enumerated point, no choice."""
    row = measurement.get('metric_reference_residual_rows', {}).get(
        candidate.component_ref, measurement)
    box = row.get('metric_reference_residual_bbox')
    return {**{k: v for k, v in sorted(row.items()) if k != 'metric_reference_residual_rows'},
        'candidate_is_metric_reference_residual_point': bool(
            row.get('metric_reference_alignment_count') == 1
            and candidate.action_ref == point_action_ref
            and not row.get('metric_reference_point_border_observed')
            and candidate.component_ref == row.get('metric_reference_residual_component_ref')
            and candidate.point is not None and box
            and tuple(candidate.point) == ((box[0]+box[2])//2, (box[1]+box[3])//2))}
