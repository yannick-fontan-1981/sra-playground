"""Exact correspondences between repeated raster bands, spans and panel insets.

These are geometry/value alternatives. Processing and parameter meanings belong
to the caller's declared conditional model, never to this measurement.
"""
from collections import Counter, defaultdict
from .components import detect_components
from .contracts import ComponentExtractionInput
from .rectangular_commitment import _perimeters


def _box(c):
    b = c.bbox
    return b.top, b.left, b.bottom, b.right


def measure_ordered_span_geometry(frame, contract):
    if (not contract or contract['layout_order'] != 'ROW_MAJOR'
            or frame.width * frame.height > contract['maximum_frame_pixels']):
        return ()
    components = detect_components(ComponentExtractionInput(frame=frame)).components
    if len(components) > contract['maximum_components']:
        return ()
    outlines, bounded = _perimeters(frame, contract)
    if bounded:
        return ()
    groups = defaultdict(list)
    for box, ink in outlines:
        groups[(box[2] - box[0], box[3] - box[1])].append((box, ink))
    counts = Counter(v for row in frame.rows for v in row)
    modes = tuple(v for v, n in sorted(counts.items()) if n == max(counts.values()))
    if len(modes) != 1:
        return ()
    background = modes[0]
    alternatives = []
    pair_visits = 0
    for group_key in sorted(groups):
        panels = groups[group_key]
        if not contract['minimum_panels'] <= len(panels) <= contract['maximum_panels']:
            continue
        def outside(c):
            t, l, b, r = _box(c)
            return not any(a <= t <= b <= d and x <= l <= r <= z for (a, x, d, z), _ in panels)
        filled, open_bands = defaultdict(list), defaultdict(list)
        for c in components:
            t, l, b, r = _box(c)
            q = b - t + 1
            if (q < contract['minimum_square_extent'] or q != r - l + 1
                    or not outside(c) or c.value == background):
                continue
            if c.area == q * q:
                filled[(t, q)].append(c)
            if 0 < c.area < q * q:
                open_bands[(t, q, c.value)].append(c)
        for (y, q), squares in sorted(filled.items()):
            squares.sort(key=lambda c: c.bbox.left)
            if (not 2 <= len(squares) <= contract['maximum_word_units']
                    or len({c.value for c in squares}) < 2
                    or y + q > min(b[0] for b, _ in panels)):
                continue
            pitches = {b.bbox.left - a.bbox.left for a, b in zip(squares, squares[1:])}
            if len(pitches) != 1:
                continue
            pitch = next(iter(pitches))
            if pitch <= q:
                continue
            for (by, bq, _ink), band in sorted(open_bands.items()):
                pair_visits += 1
                if pair_visits > contract['maximum_layout_pairs']:
                    return ()
                band.sort(key=lambda c: c.bbox.left)
                if (bq != q or len(band) < len(squares)
                        or by <= max(b[2] for b, _ in panels)
                        or any(b.bbox.left - a.bbox.left != pitch for a, b in zip(band, band[1:]))):
                    continue
                spans = []
                for yy in range(by + q, frame.height):
                    runs = []
                    for x, value in enumerate(frame.rows[yy]):
                        if value == background:
                            continue
                        if runs and runs[-1][-1] + 1 == x:
                            runs[-1].append(x)
                        else:
                            runs.append([x])
                    for run in runs:
                        l, r = run[0], run[-1]
                        if r - l + 1 < 3 or (r - l + 2) % pitch:
                            continue
                        if (frame.rows[yy - 1][l] == background or frame.rows[yy - 1][r] == background
                                or any(frame.rows[yy - 1][x] != background for x in range(l + 1, r))):
                            continue
                        spans.append((yy - 1, l, yy, r))
                panel_rows = []
                for box, ink in sorted(panels):
                    matched = tuple(s for s in spans if box[1] < s[1] <= s[3] < box[3])
                    if len(matched) != 1:
                        break
                    span = matched[0]
                    numerator = span[1] - band[0].bbox.left
                    anchors = tuple(c.component_id for c in components if _box(c) == box and c.value == ink)
                    if numerator % pitch or len(anchors) != 1:
                        break
                    slots = defaultdict(list)
                    for c in components:
                        t, l, b, r = _box(c)
                        h = b - t + 1
                        if (box[0] < t <= b < box[2] and box[1] < l <= r < box[3]
                                and h == r - l + 1 >= 2 and c.area == h * h):
                            slots[(t, h, l % pitch)].append(c)
                    strips = []
                    for slot_key in sorted(slots):
                        group = slots[slot_key]
                        group.sort(key=lambda c: c.bbox.left)
                        if len(group) >= 2 and all(b.bbox.left - a.bbox.left == pitch for a, b in zip(group, group[1:])):
                            strips.append(tuple(_box(c) for c in group))
                    unique_strip = strips[0] if len(strips) == 1 else ()
                    panel_rows.append({'bbox': box, 'component_ref': anchors[0], 'span_bbox': span,
                        'index_offset': numerator // pitch, 'span_count': (span[3] - span[1] + 2) // pitch,
                        'slot_boxes': unique_strip, 'slot_count': len(unique_strip)})
                if len(panel_rows) != len(panels):
                    continue
                # Homologous differences outside the measured slot rows expose
                # another inset. They do not themselves assign a filter role.
                skipped_rows = {yy - p['bbox'][0] for p in panel_rows for b in p['slot_boxes']
                                for yy in range(b[0], b[2] + 1)}
                h, w = panel_rows[0]['bbox'][2] - panel_rows[0]['bbox'][0], panel_rows[0]['bbox'][3] - panel_rows[0]['bbox'][1]
                differences = tuple((dy, dx) for dy in range(1, h) for dx in range(1, w)
                    if dy not in skipped_rows and len({frame.rows[p['bbox'][0] + dy][p['bbox'][1] + dx] for p in panel_rows}) > 1)
                values = tuple(c.value for c in squares)
                for p in panel_rows:
                    p.update(palette_roi=None, majority_value=None, palette_point=None, inset_values=())
                    if not differences:
                        continue
                    t, l = p['bbox'][:2]
                    roi = (t + min(y for y, x in differences), l + min(x for y, x in differences),
                           t + max(y for y, x in differences), l + max(x for y, x in differences))
                    roi_counts = Counter(frame.rows[y][x] for y in range(roi[0], roi[2] + 1) for x in range(roi[1], roi[3] + 1))
                    area = (roi[2] - roi[0] + 1) * (roi[3] - roi[1] + 1)
                    majority = tuple(v for v, n in sorted(roi_counts.items()) if 2 * n > area and v in values)
                    p.update(palette_roi=roi, inset_values=tuple(sorted(v for v in set(values) if roi_counts[v])))
                    if len(majority) == 1:
                        v = majority[0]
                        point = next((y, x) for y in range(roi[0], roi[2] + 1) for x in range(roi[1], roi[3] + 1) if frame.rows[y][x] == v)
                        p.update(majority_value=v, palette_point=point)
                alternatives.append({'square_values': values, 'square_bboxes': tuple(_box(c) for c in squares),
                    'pitch': pitch, 'square_extent': q, 'band_y': by, 'band_left': band[0].bbox.left,
                    'band_count': len(band), 'panel_rows': tuple(panel_rows)})
    return tuple(alternatives)


def measure_ordered_packet(value, geometry, contract):
    q, pitch = geometry['square_extent'], geometry['pitch']
    values, y = geometry['square_values'], geometry['band_y']
    rows = []
    if len(value.latest_ordered_action_frames) > contract['maximum_packet_frames']:
        return None
    for frame in value.latest_ordered_action_frames:
        components = detect_components(ComponentExtractionInput(frame=frame)).components
        rows.append(tuple((c.value, c.bbox.left) for c in components if c.value in values
                    and c.bbox.top == y and c.bbox.height == c.bbox.width == q
                    and c.area in (q * q, q * q - 1)))
    steps = {b - a for before, after in zip(rows, rows[1:])
             for color, a in before for c, b in after if c == color and a != b}
    if len(steps) > contract['maximum_affine_candidates']:
        return None
    compatible = []
    for step in sorted(steps):
        offsets = None
        for i, row in enumerate(rows):
            for color, x in row:
                current = {x - i * step + j * pitch for j, v in enumerate(values) if v == color}
                offsets = current if offsets is None else offsets & current
        compatible.extend((step, offset) for offset in sorted(offsets or ()))
    if len(compatible) != 1:
        return None
    step, offset = compatible[0]
    events = []
    for i, (before, after) in enumerate(zip(rows, rows[1:]), 1):
        for color, x in before:
            end = x + step
            if (color, end) in after or not 0 <= end <= value.frame.width - q:
                continue
            numerator, head = i * step + offset - end, i * step + offset - geometry['band_left']
            if numerator % pitch or head % pitch:
                continue
            rank = numerator // pitch
            if 0 <= rank < len(values):
                events.append((head // pitch + 1, rank, color, end))
    return {'pixel_step': step, 'pixel_offset': offset, 'nonboundary_absence_rows': tuple(sorted(set(events))),
            'moving_frame_count': sum(bool(row) for row in rows), 'frame_count': len(rows)}
