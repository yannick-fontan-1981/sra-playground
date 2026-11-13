"""Exact aligned-square relayout measurements from retained raster deltas.

No row is assigned a control, proposal, secret or feedback role here. The
caller supplies work bounds; Source/DRM owns any interpretation and priority.
"""
from .components import detect_components
from .contracts import ComponentExtractionInput, FrameGrid
from ..logos.types import stable_digest


def measure_current_aligned_point_relayout(value):
    contract = value.route_generation_policy.get('ordered_point_relayout_measurement_contract', {})
    maximum_members = int(contract.get('maximum_members', 0))
    maximum_transitions = int(contract.get('maximum_transitions', 0))
    maximum_cells = int(contract.get('maximum_cells', 0))
    maximum_records = int(contract.get('maximum_records', 0))
    transitions = value.sparse_raster_transitions
    current = value.frame
    if (maximum_members < 2 or maximum_transitions < 1 or maximum_records < 1
            or not transitions or len(transitions) > maximum_transitions
            or len(current.rows) * len(current.rows[0]) > maximum_cells):
        return {}
    # These are exact observations, not a predicted or engine-supplied state.
    states = []
    after = current
    for transition in reversed(transitions):
        # A missing older raster delta does not invalidate the fully observed
        # current suffix. Never reconstruct across that missing boundary.
        if not transition.changed_cells_complete:
            break
        if stable_digest(after.rows) != transition.after_digest:
            return {}
        rows = [list(row) for row in after.rows]
        for row, column, before_value, after_value in transition.changed_cells:
            if (not 0 <= row < len(rows) or not 0 <= column < len(rows[0])
                    or rows[row][column] != after_value):
                return {}
            rows[row][column] = before_value
        before = FrameGrid(rows=tuple(tuple(row) for row in rows))
        if stable_digest(before.rows) != transition.before_digest:
            return {}
        states.append((transition, before, after))
        after = before

    def content(frame, top, left, side):
        if top < 0 or left < 0 or top + side > len(frame.rows) or left + side > len(frame.rows[0]):
            return None
        values = {pixel for row in frame.rows[top:top+side] for pixel in row[left:left+side]}
        return next(iter(values)) if len(values) == 1 else None

    records = []
    for transition, before, after in states:
        point = transition.point
        if point is None:
            continue
        row, column = point
        patches = (transition.before_uniform_square_patches or ())
        for point_patch in patches:
            top, left, side, point_value, *_ = point_patch
            if side < 1 or not (top <= row < top+side and left <= column < left+side):
                continue
            family = tuple(sorted((patch for patch in patches
                                   if patch[0] == top and patch[2] == side), key=lambda patch: patch[1]))
            if not 2 <= len(family) <= maximum_members or point_patch not in family:
                continue
            columns = tuple(patch[1] for patch in family)
            pitch = columns[1] - columns[0]
            values = tuple(patch[3] for patch in family)
            if (pitch <= side or len(set(values)) != len(values)
                    or any(b-a != pitch for a, b in zip(columns, columns[1:]))
                    or any(content(before, top, x, side) != v for x, v in zip(columns, values))):
                continue
            point_ordinal = family.index(point_patch)
            remaining = values[:point_ordinal] + values[point_ordinal+1:]
            if (any(content(after, top, x, side) != v for x, v in zip(columns, remaining))
                    or content(after, top, columns[-1], side) is None
                    or content(after, top, columns[-1], side) in values
                    or any(content(current, top, x, side) != content(after, top, x, side) for x in columns)):
                continue
            additions = tuple(component for component in detect_components(
                ComponentExtractionInput(frame=after)).components
                if component.value == point_value
                and component.bbox.width == component.bbox.height == side
                and component.area == side * side
                and component.bbox.top != top
                and content(before, component.bbox.top, component.bbox.left, side) != point_value)
            if len(additions) != 1:
                continue
            records.append({
                'top': top, 'left': columns[0], 'side': side,
                'point_left': left,
                'before_count': len(family), 'after_count': len(remaining),
                'point_ordinal': point_ordinal,
                'after_values': remaining,
                'before_digest': transition.before_digest,
                'after_digest': transition.after_digest,
                'remote_added_box': (additions[0].bbox.top, additions[0].bbox.left,
                                     additions[0].bbox.bottom, additions[0].bbox.right),
            })
            if len(records) > maximum_records:
                return {}
    # Ambiguous histories remain unknown; no first-match semantic choice.
    unique = {stable_digest(record): record for record in records}
    if len(unique) != 1:
        return {}
    record_ref, record = next(iter(unique.items()))
    result = {}
    for component in value.components.components:
        box = component.bbox
        if (box.top == record['top'] and box.left == record['left']
                and box.width == box.height == record['side']
                and component.area == record['side'] ** 2
                and component.value == record['after_values'][0]):
            result[component.component_id] = {
                'current_aligned_point_relayout_measurement_present': True,
                'current_aligned_point_relayout_before_count': record['before_count'],
                'current_aligned_point_relayout_after_count': record['after_count'],
                'current_aligned_point_relayout_survivor_order_preserved': True,
                'current_aligned_point_relayout_remote_addition_count': 1,
                'current_aligned_point_relayout_record_ref': 'measurement.aligned_point_relayout.' + record_ref,
                'current_aligned_point_relayout_before_digest': record['before_digest'],
                'current_aligned_point_relayout_after_digest': record['after_digest'],
                'current_aligned_point_relayout_remote_added_box': record['remote_added_box'],
            }
    return result
