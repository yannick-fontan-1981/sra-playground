"""Exact centred raster-mark changes; no control or selection interpretation."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_new_center_marks(before, after, components):
    if before.height != after.height or before.width != after.width:
        return FrozenMap({'new_center_mark_candidate_count': 0})
    rows = []
    for component in components:
        box = component.bbox
        if (min(box.height, box.width) < 3 or box.height % 2 == 0
                or box.width % 2 == 0 or box.height * box.width > 4096
                or component.touches_frame_boundary):
            continue
        center = ((box.top + box.bottom) // 2, (box.left + box.right) // 2)
        if center not in component.pixels:
            continue
        if before.rows[center[0]][center[1]] == after.rows[center[0]][center[1]]:
            continue
        if any(before.rows[r][c] != after.rows[r][c]
               for r in range(box.top,box.bottom+1)
               for c in range(box.left,box.right+1) if (r, c) != center):
            continue
        rows.append(FrozenMap({
            'bbox': FrozenMap({'top': box.top, 'left': box.left,
                              'bottom': box.bottom, 'right': box.right}),
            'before_component_ref': component.component_id,
            'original_relative_support':component.relative_pixels,
            'prior_value': component.value,
            'marker_value': after.rows[center[0]][center[1]],
        }))
        if len(rows) > 128:
            raise ValueError('new centre mark candidate bound exceeded')
    return FrozenMap({
        'new_center_mark_candidate_count': len(rows),
        'new_center_mark_candidate_rows': tuple(rows),
        'unique_new_center_mark_bbox': rows[0]['bbox'] if len(rows) == 1 else None,
        'new_center_mark_digest': stable_digest(tuple(rows)),
    })
