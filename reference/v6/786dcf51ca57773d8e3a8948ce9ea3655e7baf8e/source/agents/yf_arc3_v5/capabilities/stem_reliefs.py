"""Bounded ordered relief measurements, without palette roles or action choice.

Each retained alternative has its own observed stem, rank origins and pixel
heights. These are not calibrated tooth values, lock demands or control laws.
Adjacent decoration of another width is retained as excluded evidence, rather
than silently incorporated into the ranked profile.
"""
from collections import defaultdict


def _runs(values):
    ordered = sorted(values)
    if not ordered:
        return ()
    result = []
    start = previous = ordered[0]
    for value in ordered[1:]:
        if value != previous + 1:
            result.append((start, previous))
            start = value
        previous = value
    result.append((start, previous))
    return tuple(result)


def measure_ranked_cuts(rows, *, rank_columns, rank_width, reference_row,
                        reference_columns, reference_value, band_top, band_bottom,
                        upper_value, lower_value):
    """Measure visible one-row seams between supplied pixel-layer bindings.

    Reference and layer bindings must come from the caller's observed evidence.
    A seam offset is not a calibrated lock demand: a trial can shift that seam.
    Missing or competing cuts return uncertain ranks, never guessed heights.
    """
    height = len(rows)
    width = len(rows[0]) if rows else 0
    if (not height or any(len(row) != width for row in rows) or rank_width < 1
            or not 0 <= band_top < band_bottom < height
            or not 0 <= reference_row < height
            or not rank_columns or upper_value == lower_value
            or any(c < 0 or c + rank_width > width for c in rank_columns)
            or any(c < 0 or c >= width for c in reference_columns)):
        raise ValueError('invalid ranked seam measurement request')
    visible = bool(reference_columns) and all(
        rows[reference_row][c] == reference_value for c in reference_columns)
    cuts = []
    offsets = []
    for col in rank_columns:
        matches = tuple(r for r in range(band_top + 1, band_bottom)
            if all(rows[r - 1][c] == upper_value and rows[r + 1][c] == lower_value
                for c in range(col, col + rank_width))
            and len({rows[r][c] for c in range(col, col + rank_width)}) == 1
            and rows[r][col] not in (upper_value, lower_value))
        cuts.append(matches)
        offsets.append(matches[0] - reference_row if visible and len(matches) == 1 else None)
    return {'reference_visible': visible, 'reference_row': reference_row,
            'reference_columns': tuple(reference_columns),
            'rank_columns': tuple(rank_columns), 'rank_width_pixels': rank_width,
            'cut_rows_by_rank': tuple(cuts), 'signed_cut_offsets': tuple(offsets),
            'uncertain_rank_indexes': tuple(i for i, offset in enumerate(offsets) if offset is None)}


def measure_stem_reliefs(components, configuration):
    """Enumerate exact regular rank cohorts on explicitly requested axes.

    All alternatives are retained within request bounds. An exceeded bound
    returns a truncated domain with no unique-profile assertion. No consumer
    may infer a grasp, an authentication demand or a missing profile from it.
    """
    required = ('minimum_rank_count', 'maximum_rank_count',
                'maximum_component_count', 'maximum_alternatives_per_component',
                'axis_directions')
    if any(key not in configuration for key in required):
        return {}
    minimum = int(configuration['minimum_rank_count'])
    maximum = int(configuration['maximum_rank_count'])
    limit = int(configuration['maximum_alternatives_per_component'])
    directions = tuple(configuration['axis_directions'])
    if minimum < 2 or maximum < minimum or limit < 1:
        raise ValueError('invalid ordered relief measurement bounds')
    if any(axis not in ('up', 'down', 'left', 'right') for axis in directions):
        raise ValueError('unknown ordered relief measurement axis')
    if len(components) > int(configuration['maximum_component_count']):
        return {}
    result = {}
    for component in components:
        absolute = frozenset(component.pixels)
        alternatives = []
        truncated = False
        for axis in directions:
            horizontal = axis in ('up', 'down')
            sign = -1 if axis in ('up', 'left') else 1
            points = frozenset((r, c) if horizontal else (c, r) for r, c in absolute)
            rows = defaultdict(set)
            for r, c in sorted(points):
                rows[r].add(c)
            ray_heights = None
            for baseline, columns in sorted(rows.items()):
                for left, right in _runs(columns):
                    # Two separated nonempty ranks require at least three pixels.
                    if right - left + 1 < minimum * 2 - 1:
                        continue
                    neighbor_bands = _runs(
                            c for c in range(left, right + 1)
                            if (baseline + sign, c) in points)
                    # A cohort is a subset of these separated bands. Avoid
                    # measuring heights when no cohort can meet the declared
                    # minimum; solid regions used to rescan every column here.
                    if len(neighbor_bands) < minimum:
                        continue
                    if ray_heights is None:
                        # Compute each directional ray once, only after the
                        # first possible cohort. Repeated baselines then read
                        # exact heights instead of walking the same pixels.
                        ray_heights = {}
                        for r, c in sorted(points, reverse=sign > 0):
                            ray_heights[r, c] = 1 + ray_heights.get((r + sign, c), 0)
                    bands = []
                    for first, last in neighbor_bands:
                        heights = [ray_heights[baseline + sign, c]
                                   for c in range(first, last + 1)]
                        if len(set(heights)) == 1:
                            bands.append((first, last, heights[0]))
                    widths = sorted({b - a + 1 for a, b, _ in bands})
                    for width in widths:
                        cohort = tuple(b for b in bands if b[1] - b[0] + 1 == width)
                        if not minimum <= len(cohort) <= maximum:
                            continue
                        pitches = {b[0] - a[0] for a, b in zip(cohort, cohort[1:])}
                        if len(pitches) != 1:
                            continue
                        pitch = next(iter(pitches))
                        if len(alternatives) == limit:
                            # The retained canonical prefix is already full.
                            # One further admissible cohort proves truncation;
                            # later measurements cannot change this result.
                            truncated = True
                            break
                        origins = tuple((baseline, a) if horizontal else (a, baseline)
                                        for a, _, _ in cohort)
                        measurement = {
                            'axis_direction': axis,
                            'stem_origin': (baseline, left) if horizontal else (left, baseline),
                            'stem_pixel_length': right - left + 1,
                            'rank_origins': origins,
                            'rank_width_pixels': width,
                            'rank_pitch_pixels': pitch,
                            'rank_height_pixels': tuple(h for _, _, h in cohort),
                            'excluded_bands': tuple(b for b in bands if b not in cohort),
                        }
                        alternatives.append(measurement)
                    if truncated:
                        break
                if truncated:
                    break
            if truncated:
                break
        if alternatives or truncated:
            facts = {
                'stem_relief_alternatives': tuple(alternatives),
                'stem_relief_domain_truncated': truncated,
                'stem_relief_alternative_count': len(alternatives),
                'stem_relief_unique_profile': len(alternatives) == 1 and not truncated,
                'stem_relief_source_component_ref': component.component_id,
                'stem_relief_palette_value': component.value,
            }
            if facts['stem_relief_unique_profile']:
                facts.update({'stem_relief_' + key: val for key, val in sorted(alternatives[0].items())})
            result[component.component_id] = facts
    return result
