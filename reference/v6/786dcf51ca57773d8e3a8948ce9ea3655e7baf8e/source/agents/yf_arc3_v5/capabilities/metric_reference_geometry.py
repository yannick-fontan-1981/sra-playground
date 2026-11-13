"""Bounded current-raster correspondences on a complete orthogonal partition.

No game identity, palette role, target coordinates or action priority. The
caller/DRM owns the interpretation of each returned conditional correspondence.
This restricted domain has one visible occurrence per material, no hidden stack
model, and retains every equally short unoccupied-cell continuation.
"""
from collections import Counter, deque
from fractions import Fraction
from itertools import combinations, product

from .contracts import VisualSceneInput
from .sprites import describe_visual_scene


def _box(component):
    b = component.bbox
    return b.top, b.left, b.bottom + 1, b.right + 1


def _cell(frame, box):
    t, l, b, r = box
    values = {frame.rows[y][x] for y in range(t, b) for x in range(l, r)}
    if len(values) == 1:
        return next(iter(values)), None
    if min(b-t, r-l) < 3:
        return None
    inside = {frame.rows[y][x] for y in range(t+1, b-1) for x in range(l+1, r-1)}
    border = {frame.rows[y][x] for y in range(t, b) for x in range(l, r)
        if y in (t, b-1) or x in (l, r-1)}
    if len(inside) == len(border) == 1 and inside != border:
        return next(iter(inside)), next(iter(border))
    return None


def measure_partitioned_reference(value, vectors, point_action_ref):
    """Enumerate exact uniform maps and per-occurrence distance facts only."""
    empty = {}
    frame = value.current_observed_frame or value.frame
    if frame.height * frame.width > 4096:
        return empty
    components = describe_visual_scene(VisualSceneInput(frame=frame)).blocks.components
    if len(components) > 128:
        return empty
    rectangles = tuple(c for c in components if c.area == c.bbox.height*c.bbox.width)
    counts = Counter(c.value for c in rectangles)
    models = {}
    remaining = 65536
    for floors in combinations(tuple(v for v, n in sorted(counts.items()) if n >= 4), 2):
        supports = tuple(c for c in rectangles if c.value in floors)
        yy = sorted({n for c in supports for n in (_box(c)[0], _box(c)[2])})
        xx = sorted({n for c in supports for n in (_box(c)[1], _box(c)[3])})
        if not (3 <= len(yy) <= 17 and 3 <= len(xx) <= 17
                and (len(yy)-1)*(len(xx)-1) <= 128):
            continue
        boxes = {(y, x): (t, l, b, r) for y, (t, b) in enumerate(zip(yy, yy[1:]))
            for x, (l, r) in enumerate(zip(xx, xx[1:]))}
        cells = {p: _cell(frame, box) for p, box in sorted(boxes.items())}
        if any(cells[p] is None for p in sorted(cells)):
            continue
        parity = {p: set() for p in (0, 1)}
        for (y, x), (color, ring) in sorted(cells.items()):
            if color in floors:
                parity[(y+x) % 2].add(color)
        if (any(len(parity[p]) != 1 for p in sorted(parity))
                or parity[0] == parity[1]):
            continue
        material = {p: c for p, (c, _) in sorted(cells.items()) if c not in floors}
        if not 2 <= len(material) <= 8 or len({c for _, c in sorted(material.items())}) != len(material):
            continue
        outlined = tuple(p for p, (_, ring) in sorted(cells.items()) if ring is not None)
        if len(outlined) > 1:
            continue
        active = None
        previous = value.previous_action_observed_frame
        if outlined and previous is not None and previous.height == frame.height and previous.width == frame.width:
            p = outlined[0]
            before = {q: _cell(previous, box) for q, box in sorted(boxes.items())}
            if all(before[q] is not None for q in sorted(before)):
                prior_outlined = tuple(q for q, (_, ring) in sorted(before.items()) if ring is not None)
                if value.last_action_ref == point_action_ref and value.last_point_position is not None:
                    y, x = value.last_point_position
                    t, l, b, r = boxes[p]
                    if (t <= y < b and l <= x < r and before[p] == (cells[p][0], None)
                            and all(before[q][0] == cells[q][0] for q in sorted(boxes) if q != p)):
                        active = p
                elif value.last_action_ref in vectors and len(prior_outlined) == 1:
                    q = prior_outlined[0]
                    dy, dx = vectors[value.last_action_ref]
                    if (p == (q[0]+dy, q[1]+dx) and before[q] == cells[p]
                            and before[p][0] in floors and cells[q][0] in floors
                            and all(before[z] == cells[z] for z in sorted(boxes) if z not in (p, q))):
                        active = p
            if active is None:
                continue
        elif outlined:
            continue
        by_color = {}
        for color in sorted(material.values()):
            outside = tuple(c for c in rectangles if c.value == color
                and (_box(c)[2] <= yy[0] or _box(c)[0] >= yy[-1]
                    or _box(c)[3] <= xx[0] or _box(c)[1] >= xx[-1]))
            if not 1 <= len(outside) <= 4:
                break
            by_color[color] = outside
        if len(by_color) != len(material):
            continue
        choices = 1
        for color in sorted(by_color):
            choices *= len(by_color[color])
        if choices > 256:
            continue
        box_positions = {box: p for p, box in sorted(boxes.items())}
        for parts in product(*(by_color[color] for color in sorted(by_color))):
            tt, tl = min(_box(c)[0] for c in parts), min(_box(c)[1] for c in parts)
            tb, tr = max(_box(c)[2] for c in parts), max(_box(c)[3] for c in parts)
            if tb-tt >= yy[-1]-yy[0] or tr-tl >= xx[-1]-xx[0]:
                continue
            remaining -= (tb-tt)*(tr-tl)
            if remaining < 0:
                return empty  # An incomplete domain must never become unique.
            # The complete reference box must consist of these rectangles and
            # observed empty texture, not another interface/material component.
            if any(frame.rows[y][x] not in floors and not any(
                    c.value == frame.rows[y][x] and _box(c)[0] <= y < _box(c)[2]
                    and _box(c)[1] <= x < _box(c)[3] for c in parts)
                    for y in range(tt, tb) for x in range(tl, tr)):
                continue
            first = parts[0]
            ft, fl, fb, fr = _box(first)
            for anchor_box in (boxes[p] for p in sorted(boxes)):
                remaining -= len(parts)
                if remaining < 0:
                    return empty
                at, al, ab, ar = anchor_box
                scale = Fraction(ar-al, fr-fl)
                if scale <= 1 or scale != Fraction(ab-at, fb-ft):
                    continue
                dy, dx = at-scale*ft, al-scale*fl
                targets = {}
                for c in parts:
                    t, l, b, r = _box(c)
                    target = (dy+scale*t, dx+scale*l, dy+scale*b, dx+scale*r)
                    if any(n.denominator != 1 for n in target):
                        break
                    target = tuple(map(int, target))
                    if target not in box_positions:
                        break
                    targets[c.value] = box_positions[target]
                if len(targets) != len(material):
                    continue
                outer = (dy+scale*tt, dx+scale*tl, dy+scale*tb, dx+scale*tr)
                if not (outer[0] in yy and outer[2] in yy and outer[1] in xx and outer[3] in xx):
                    continue
                matched = sum(targets[c] == p for p, c in sorted(material.items()))
                if not matched or matched == len(material):
                    continue
                key = tuple(sorted(targets.items()))
                models[key] = (boxes, cells, material, targets, active, matched, scale)
    if len(models) != 1:
        return empty
    boxes, cells, material, targets, active, matched, scale = models[min(models)]
    rows = {}
    for p, color in sorted(material.items()):
        target = targets[color]
        if p == target or target in material:
            continue
        distances = {target: 0}
        queue = deque((target,))
        while queue:
            y, x = queue.popleft()
            for _, (dy, dx) in sorted(vectors.items()):
                q = y+dy, x+dx
                if q in boxes and q not in distances and (q == p or q not in material):
                    distances[q] = distances[(y, x)] + 1
                    queue.append(q)
        if p not in distances:
            continue
        t, l, b, r = boxes[p]
        component = next((c for c in components if c.value == color and
            t <= c.bbox.top <= c.bbox.bottom < b and l <= c.bbox.left <= c.bbox.right < r), None)
        if component is None:
            continue
        bt, bl, bb, br = boxes[target]
        rows[component.component_id] = {
            'metric_reference_alignment_count': 1,
            'metric_reference_matched_count': matched,
            'metric_reference_residual_bbox': (t, l, b-1, r-1),
            'metric_reference_residual_component_ref': component.component_id,
            'metric_reference_target_bbox': (bt, bl, bb-1, br-1),
            'metric_reference_point_border_observed': active == p,
            'metric_reference_adjacent_action_refs': tuple(ref for ref, (dy, dx) in sorted(vectors.items())
                if ref in value.available_action_refs and distances.get((p[0]+dy, p[1]+dx)) == distances[p]-1),
            'metric_reference_scale_ratio': (scale.numerator, scale.denominator),
            'metric_reference_pair_count': len(material),
            'metric_reference_remaining_cell_distance': distances[p],
        }
    if not rows:
        return empty
    minimum = min(rows[ref]['metric_reference_remaining_cell_distance'] for ref in sorted(rows))
    for ref in sorted(rows):
        row = rows[ref]
        row['metric_reference_residual_is_minimum_distance'] = row['metric_reference_remaining_cell_distance'] == minimum
    selected = next((rows[ref] for ref in sorted(rows) if rows[ref]['metric_reference_point_border_observed']), {})
    return {'metric_reference_alignment_count': 1,
        'metric_reference_point_border_observed': False,
        'metric_reference_adjacent_action_refs': (),
        **selected, 'metric_reference_residual_rows': rows}
