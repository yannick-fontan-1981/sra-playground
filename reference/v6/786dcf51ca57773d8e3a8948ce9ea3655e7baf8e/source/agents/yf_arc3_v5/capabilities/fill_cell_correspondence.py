"""Exact framed cell domains and quantized prefix counts; no role selection."""
from .components import detect_components
from .contracts import BoundingBox, ComponentExtractionInput, FrameGrid
from .transition import measure_scalar_fill_display
from .resource_integer_intervals_d import _display, refine_resource_integer_intervals_d
from .resource_interval_contracts_d import (
    ResourceIntervalLedgerD, ResourceIntervalModelD, ResourceIntervalSampleD,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _line_count(frame, *, horizontal, index, start, stop, value):
    return sum((frame.rows[index][i] if horizontal else frame.rows[i][index]) == value
               for i in range(start, stop))


def _boundary_values(frame, box, pitch):
    """Every internal boundary must separate its two adjacent raster lines."""
    candidates = {value for row in frame.rows for value in row}
    for horizontal, first, last, start, stop in (
        (True, box.top, box.bottom, box.left + 1, box.right),
        (False, box.left, box.right, box.top + 1, box.bottom),
    ):
        for index in range(first + pitch, last, pitch):
            candidates &= {
                value for value in candidates
                if _line_count(frame, horizontal=horizontal, index=index,
                               start=start, stop=stop, value=value)
                > max(_line_count(frame, horizontal=horizontal, index=neighbor,
                                  start=start, stop=stop, value=value)
                      for neighbor in (index - 1, index + 1))
            }
    return tuple(sorted(candidates))


def _cell_supports(frame, box, pitch):
    result = {}
    for row in range((box.height - 1) // pitch):
        for column in range((box.width - 1) // pitch):
            index = row * ((box.width - 1) // pitch) + column
            values = {frame.rows[y][x]
                      for y in range(box.top + row * pitch + 1, box.top + (row + 1) * pitch)
                      for x in range(box.left + column * pitch + 1, box.left + (column + 1) * pitch)}
            for value in values:
                result.setdefault(value, set()).add(index)
    return result


def measure_cell_support_growth(*, before: FrameGrid, after: FrameGrid,
                                translations, scope_ref: str):
    """Enumerate retained cell supports growing by one, independently of a bar.

    No support is assigned the role of trail, goal, exit, or action permission.
    Both-axis raster separators and a closed domain corroborate every pitch.
    """
    deltas = tuple((abs(int(dr)), abs(int(dc))) for _, dr, dc in translations
                   if (int(dr) == 0) != (int(dc) == 0))
    if not deltas:
        return ()
    candidates = []
    for component in detect_components(ComponentExtractionInput(frame=after)).components:
        box = component.bbox
        if component.touches_frame_boundary or box.height < 5 or box.width < 5:
            continue
        perimeter = {(y, x) for y in range(box.top, box.bottom + 1)
                     for x in range(box.left, box.right + 1)
                     if y in (box.top, box.bottom) or x in (box.left, box.right)}
        if (set(component.pixels) != perimeter
                or any(before.rows[y][x] != component.value for y, x in perimeter)):
            continue
        for pitch in range(2, 33):
            if ((box.height - 1) % pitch or (box.width - 1) % pitch
                    or (box.height - 1) // pitch < 2 or (box.width - 1) // pitch < 2
                    or any((dr or dc) % pitch for dr, dc in deltas)):
                continue
            separators = set(_boundary_values(before, box, pitch)) & set(_boundary_values(after, box, pitch))
            if not separators:
                continue
            total = ((box.height - 1) // pitch) * ((box.width - 1) // pitch)
            if total > 128:
                continue
            before_supports, after_supports = _cell_supports(before, box, pitch), _cell_supports(after, box, pitch)
            grouped = {}
            for value, current in sorted(after_supports.items()):
                previous = before_supports.get(value, set())
                if previous < current and len(current) - len(previous) == 1:
                    grouped.setdefault((tuple(sorted(previous)), tuple(sorted(current))), []).append(value)
            for (previous, current), values in sorted(grouped.items()):
                candidates.append(FrozenMap({'scope_ref': scope_ref,
                    'geometry_digest': stable_digest((box, pitch, tuple(sorted(separators)))),
                    'top': box.top, 'left': box.left, 'bottom': box.bottom, 'right': box.right,
                    'pitch': pitch, 'row_count': (box.height - 1) // pitch,
                    'column_count': (box.width - 1) // pitch, 'cell_count': total,
                    'support_values': tuple(values), 'previous_cell_indices': previous,
                    'previous_cell_count': len(previous), 'current_cell_count': len(current),
                    'current_cell_indices': current}))
    return tuple(candidates)


def measure_fill_cell_correspondences(*, before: FrameGrid, after: FrameGrid,
                                      translations, scope_ref: str):
    """Preserve exact covarying support/rounding alternatives for a received pair.

    A movement multiple alone never establishes cell pitch. Each internal
    boundary also needs a raster contrast on both axes inside a closed frame.
    Independent or decreasing readings return no increasing correspondence.
    """
    first = measure_scalar_fill_display(before)
    second = measure_scalar_fill_display(after)
    keys = ('scalar_fill_orientation', 'scalar_fill_index', 'scalar_fill_start',
            'scalar_fill_end', 'scalar_fill_span', 'scalar_fill_prefix_value', 'scalar_fill_suffix_value')
    if (first.get('scalar_fill_display_present') is not True
            or second.get('scalar_fill_display_present') is not True
            or any(first[k] != second[k] for k in keys)
            or first['scalar_fill_count'] >= second['scalar_fill_count']):
        return ()
    candidates = []
    for growth in measure_cell_support_growth(before=before, after=after,
            translations=translations, scope_ref=scope_ref):
        previous, current = growth['previous_cell_indices'], growth['current_cell_indices']
        total = growth['cell_count']
        samples = tuple(ResourceIntervalSampleD(
            sample_ref=f'{scope_ref}.sample.{i}', evidence_scope_ref=scope_ref,
            transition_evidence_ref=scope_ref, observed_display=reading,
            gross_input_count=i, internal_event_count=i, known_gross_debit=0,
            known_receipt_credit=i, transition_order_ref='CREDIT_THEN_DEBIT')
            for i, reading in enumerate((first['scalar_fill_count'], second['scalar_fill_count'])))
        models = tuple(ResourceIntervalModelD(
            model_ref=f'{scope_ref}.rounding.{rounding}', evidence_scope_ref=scope_ref,
            calibration_evidence_refs=(scope_ref,), capacity=total,
            render_extent=first['scalar_fill_span'], display_measure_ref='WIDTH',
            display_multiplier=1, rounding_ref=rounding, quantity_minimum=0,
            quantity_maximum=total, transition_ref='EXACT_DELTA')
            for rounding in ('FLOOR', 'CEIL', 'NEAREST_EVEN'))
        ledger = ResourceIntervalLedgerD(evidence_scope_ref=scope_ref, models=models,
            samples=samples, maximum_evaluations=65536)
        rows, missing, _ = refine_resource_integer_intervals_d(ledger, scope_ref, second['scalar_fill_count'])
        compatible = tuple(row['model_ref'].rsplit('.', 1)[-1] for row in rows
            if row['model_compatible'] and all(
                any(low <= count <= high for low, high in sample['compatible_quantity_runs'])
                for count, sample in zip((len(previous), len(current)), row['quantity_runs_by_sample'])))
        if missing or not compatible:
            continue
        candidates.append(FrozenMap.overlay({
            'previous_filled_extent': first['scalar_fill_count'],
            'current_filled_extent': second['scalar_fill_count'],
            'full_extent': first['scalar_fill_span'], 'rounding_refs': compatible}, growth))
    return tuple(candidates)


def _current_cell_support_matches(value, rows):
    """Revalidate canonical geometry, supports and motion on the current frame."""
    if not rows:
        return ()
    matches = []
    frame = value.current_observed_frame or value.frame
    boxes = tuple(value.canonical_provisional_control_geometry_bboxes) or tuple(value.input_aligned_entity_bboxes)
    if len(boxes) != 1:
        return ()
    body = boxes[0]
    for row in rows:
        try:
            box = BoundingBox(top=row['top'], left=row['left'], bottom=row['bottom'], right=row['right'])
            pitch, total = int(row['pitch']), int(row['cell_count'])
            if (box.bottom >= frame.height or box.right >= frame.width
                    or pitch < 2 or (box.height - 1) % pitch or (box.width - 1) % pitch
                    or ((box.height - 1) // pitch) * ((box.width - 1) // pitch) != total
                    or not _boundary_values(frame, box, pitch)):
                continue
            directional_refs = {ref for ref, dr, dc in value.interface_action_translation_deltas
                                if abs(dr) + abs(dc) == 1}
            magnitudes = tuple(abs(dr or dc) for ref, dr, dc in value.known_action_translation_deltas
                               if ref in directional_refs and ((dr == 0) != (dc == 0)))
            if not magnitudes or any(magnitude % pitch for magnitude in magnitudes):
                continue
            support = _cell_supports(frame, box, pitch)
            sets = tuple(tuple(sorted(support.get(v, set()))) for v in row['support_values'])
            if not sets or len(set(sets)) != 1:
                continue
            indices = sets[0]
            count = len(indices)
            nr, nc = (box.height - 1) // pitch, (box.width - 1) // pitch
            r = (body.top + body.bottom - 2 * box.top) // (2 * pitch)
            c = (body.left + body.right - 2 * box.left) // (2 * pitch)
            if not (0 <= r < nr and 0 <= c < nc
                    and box.top + r * pitch < body.top <= body.bottom < box.top + (r + 1) * pitch
                    and box.left + c * pitch < body.left <= body.right < box.left + (c + 1) * pitch
                    and r * nc + c in indices):
                continue
            matches.append((row, (), indices, r, c, nr, nc))
        except (KeyError, TypeError, ValueError):
            continue
    return tuple(matches)


def _current_fill_cell_matches(value):
    """Corroborate a current support hypothesis with its retained display law."""
    if not value.canonical_fill_cell_covariation_facts:
        return ()
    frame = value.current_observed_frame or value.frame
    reading = measure_scalar_fill_display(frame)
    if reading.get('scalar_fill_display_present') is not True:
        return ()
    matches = []
    for row, _, indices, r, c, nr, nc in _current_cell_support_matches(
            value, value.canonical_fill_cell_covariation_facts):
        if reading['scalar_fill_span'] != row.get('full_extent'):
            continue
        count, total = len(indices), nr * nc
        models = tuple(ResourceIntervalModelD(
            model_ref=f'current.{rounding}', evidence_scope_ref='current', calibration_evidence_refs=('current',),
            capacity=total, render_extent=int(row['full_extent']), display_measure_ref='WIDTH',
            display_multiplier=1, rounding_ref=rounding, quantity_minimum=0, quantity_maximum=total,
            transition_ref='EXACT_DELTA') for rounding in row['rounding_refs'])
        if not models or any(_display(model, count) != reading['scalar_fill_count'] for model in models):
            continue
        matches.append((row, models, indices, r, c, nr, nc))
    return tuple(matches)


def measure_current_fill_cell_grid_geometries(value):
    """Return unique revalidated cell geometry, without any passability claim."""
    matches = (*_current_fill_cell_matches(value), *_current_cell_support_matches(
        value, value.canonical_cell_support_growth_facts))
    groups = {}
    for row, _, indices, r, c, nr, nc in matches:
        key = (row['geometry_digest'], indices, r, c, nr, nc)
        groups.setdefault(key, []).append(row)
    if len(groups) != 1:
        return ()
    equivalent = next(iter(groups.values()))
    return (FrozenMap.overlay({'origin_refs': tuple(sorted({row['term_ref'] for row in equivalent}))},
                              equivalent[0]),)


def measure_current_fill_cell_candidates(value, agenda):
    """Measure all available directions on a revalidated support hypothesis."""
    matches = _current_fill_cell_matches(value)
    if len(matches) != 1:
        return FrozenMap()
    row, models, indices, r, c, nr, nc = matches[0]
    deltas = {ref: (dr, dc) for ref, dr, dc in value.interface_action_translation_deltas
              if abs(dr) + abs(dc) == 1}
    facts = {}
    for candidate in agenda.candidates:
        delta = deltas.get(candidate.action_ref)
        if delta is None:
            continue
        rr, cc = r + delta[0], c + delta[1]
        inside = 0 <= rr < nr and 0 <= cc < nc
        target = rr * nc + cc
        facts[candidate.candidate_ref] = FrozenMap({
            'fill_cell_probe_current': True,
            'fill_cell_probe_geometry_digest': row['geometry_digest'],
            'fill_cell_probe_target_in_domain': inside,
            'fill_cell_probe_target_already_present': inside and target in indices,
            'fill_cell_probe_current_count': len(indices),
            'fill_cell_probe_total_count': nr * nc,
            'fill_cell_probe_expected_added_count': len(indices) + 1,
            'fill_cell_probe_expected_extent_values': tuple(sorted({_display(m, len(indices) + 1) for m in models})),
        })
    return FrozenMap(facts)


def measure_current_cell_support_candidates(value, agenda):
    """Measure every unit-direction target independently of any display."""
    matches = _current_cell_support_matches(value, value.canonical_cell_support_growth_facts)
    if len(matches) != 1:
        return FrozenMap()
    row, _, indices, r, c, nr, nc = matches[0]
    deltas = {ref: (dr, dc) for ref, dr, dc in value.interface_action_translation_deltas
              if abs(dr) + abs(dc) == 1}
    facts = {}
    no_effect_refs = frozenset(value.current_context_no_effect_candidate_refs)
    for candidate in agenda.candidates:
        delta = deltas.get(candidate.action_ref)
        if delta is None:
            continue
        rr, cc = r + delta[0], c + delta[1]
        inside = 0 <= rr < nr and 0 <= cc < nc
        no_effect = candidate.action_ref in no_effect_refs or candidate.candidate_ref in no_effect_refs
        known_pattern = agenda.alternative_facts[candidate.candidate_ref].get(
            'current_action_quantized_traversable_first_edge') is True
        edge_state = ('outside_domain' if not inside else
                      'blocked_same_context_observation' if no_effect else
                      'measured_pattern_admissible' if known_pattern else 'unknown')
        facts[candidate.candidate_ref] = FrozenMap({
            'cell_support_probe_current': True,
            'cell_support_probe_geometry_digest': row['geometry_digest'],
            'cell_support_probe_target_in_domain': inside,
            'cell_support_probe_target_already_present': inside and rr * nc + cc in indices,
            'cell_support_probe_current_count': len(indices),
            'cell_support_probe_total_count': nr * nc,
            'cell_support_probe_expected_added_count': len(indices) + 1,
            'cell_support_probe_edge_state': edge_state,
            'cell_support_probe_same_context_no_effect': no_effect,
        })
    return FrozenMap(facts)
