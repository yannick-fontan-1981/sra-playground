"""Measure an observed single-value addition between aligned rectangular rows.

No row is assigned a purpose here. DRM owns interpretation and release.
"""

from collections import Counter

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_aligned_row_closure(frame, previous_frame, collections, last_point):
    records = []
    if previous_frame is not None and last_point is not None:
        origin_row, origin_column = last_point
        if (len(previous_frame.rows) == len(frame.rows)
                and all(len(a) == len(b) for a, b in zip(previous_frame.rows, frame.rows))
                and 0 <= origin_row < len(frame.rows)
                and 0 <= origin_column < len(frame.rows[origin_row])):
            origin_value = previous_frame.rows[origin_row][origin_column]
            horizontal = tuple(r for r in collections if r['alignment_axis'] == 'horizontal')
            for lower in horizontal:
                boxes = lower['member_bounding_boxes']
                if origin_row <= boxes[0][2]:
                    continue
                before_values = []
                for top, left, bottom, right in boxes:
                    values = {previous_frame.rows[row][column]
                              for row in range(top, bottom + 1)
                              for column in range(left, right + 1)}
                    before_values.append(next(iter(values)) if len(values) == 1 else None)
                after_values = tuple(lower['member_palette_values'])
                changes = tuple(i for i, (a, b) in enumerate(zip(before_values, after_values)) if a != b)
                if len(changes) != 1 or after_values[changes[0]] != origin_value:
                    continue
                for upper in horizontal:
                    upper_boxes = upper['member_bounding_boxes']
                    if (len(boxes) != len(upper_boxes) or upper_boxes[0][2] >= boxes[0][0]
                            or tuple((b[1], b[3], b[2] - b[0]) for b in boxes)
                            != tuple((b[1], b[3], b[2] - b[0]) for b in upper_boxes)):
                        continue
                    upper_values = tuple(upper['member_palette_values'])
                    domain = frozenset(upper_values)
                    if (len(domain) != len(upper_values)
                            or Counter(after_values) != Counter(upper_values)
                            or sum(v not in domain for v in before_values) != 1):
                        continue
                    records.append((upper['collection_measurement_ref'],
                                    lower['collection_measurement_ref'], changes[0], len(boxes)))
    unique = tuple(dict.fromkeys(records))
    return FrozenMap({
        'aligned_row_single_addition_closure_count': len(unique),
        'aligned_row_single_addition_closure_unique': len(unique) == 1,
        'aligned_row_single_addition_closure_member_count': unique[0][3] if len(unique) == 1 else 0,
        'aligned_row_single_addition_closure_ordinal': unique[0][2] if len(unique) == 1 else -1,
        'aligned_row_single_addition_closure_digest': stable_digest(unique) if unique else '',
    })
