"""Exact displayed bundles, parallel columns and small normalized masks.

No actions are selected or sent, and no glyph effect or lifetime is assigned.
"""
from collections import Counter
from agents.yf_arc3_v5.capabilities.banded_column_measurements import _columns
from agents.yf_arc3_v5.capabilities.interaction import measure_lateral_outlined_option_pair
from agents.yf_arc3_v5.logos.types import stable_digest


def token_mask(points):
    top = min(r for r, _ in points)
    left = min(c for _, c in points)
    return tuple(sorted((r - top, c - left) for r, c in points))


def measure_chart(scene):
    frame = scene.frame
    columns = _columns(scene)
    if len(columns) < 2 or len({c[2] for c in columns}) != len(columns):
        return None
    palette = tuple(c[2] for c in columns)
    pair = measure_lateral_outlined_option_pair(frame, scene.blocks.components)
    if not pair.get('lateral_outlined_option_pair_unique'):
        return None
    lower_box = tuple(pair['lateral_outlined_option_lower_column_bbox'])
    higher_box = tuple(pair['lateral_outlined_option_higher_column_bbox'])
    cell_height = lower_box[2] - lower_box[0] - 1
    spans = (pair['lateral_outlined_option_lower_column_member_spans'],
             pair['lateral_outlined_option_higher_column_member_spans'])
    background = Counter(v for row in frame.rows for v in row).most_common(1)[0][0]
    outline = pair['lateral_outlined_option_outline_observed_value']
    occupied_rows = [row for row in range(lower_box[2]) if any(
        frame.rows[row][col] in palette for ss in spans for left,right in ss
        for col in range(left,right+1))]
    runs = []
    for row in occupied_rows:
        if not runs or row > runs[-1][-1] + 1:
            runs.append([row])
        else:
            runs[-1].append(row)
    if not runs or any(len(run) > cell_height for run in runs):
        return None
    centers = [run[0] + run[-1] for run in runs]
    center_steps = {b-a for a,b in zip(centers,centers[1:])}
    if len(center_steps) > 1 or any(v % 2 for v in center_steps):
        return None
    step = next(iter(center_steps)) // 2 if center_steps else cell_height + 1
    if step <= cell_height:
        return None
    cells = []
    for depth in range(frame.height // step + 1):
        top = lower_box[0] + 1 - depth * step
        if top < 0:
            break
        sides = []
        occupied = 0
        for side_spans in spans:
            tokens = []
            for left, right in side_spans:
                points = [(row, col) for row in range(top, top + cell_height)
                          for col in range(left, right + 1)
                          if frame.rows[row][col] not in (background, outline)]
                if not points:
                    tokens.append(None)
                    continue
                occupied += 1
                colors = {frame.rows[row][col] for row, col in points}
                if not colors <= set(palette):
                    return None
                mask = token_mask(points)
                tokens.append({'mask': mask, 'mask_ref': stable_digest(mask),
                               'observed_values': tuple(sorted(colors)),
                               'observed_value': next(iter(colors)) if len(colors)==1 else None})
            sides.append(tuple(tokens))
        if not occupied:
            break
        if any(token is None for side in sides for token in side):
            return None
        cells.append(tuple(sides))
    if not cells:
        return None
    stock = []
    outside = []
    for component in scene.blocks.components:
        if component.value not in palette:
            continue
        b = component.bbox
        if b.right <= lower_box[3] or b.left >= higher_box[1]:
            continue
        if any(c[0] <= b.left <= b.right <= c[1] for c in columns):
            continue
        if b.height > cell_height or b.width > max(right-left+1 for ss in spans for left,right in ss):
            outside.append(component.component_id)
            continue
        mask = token_mask(tuple(component.pixels))
        stock.append({'mask': mask, 'mask_ref': stable_digest(mask),
                      'observed_value': component.value,
                      'component_ref': component.component_id,
                      'bbox': (b.top,b.left,b.bottom,b.right)})
    return {'palette': palette, 'lengths': tuple(c[3] for c in columns),
            'marks': tuple(c[4] for c in columns),
            'rows': tuple(cells), 'stock': tuple(stock),
            'unclassified_component_refs': tuple(outside),
            'cell_height': cell_height, 'row_pitch': step}
