"""Exact point-conditioned translations of persistent endpoint supports.

All endpoint pairs survive. The measured span is not an assertion that its
interior is one rigid object, or that any contained component is cargo.
"""
from collections import Counter
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _result(rows=(), *, complete=False, status='not_measured'):
    return FrozenMap({'point_motion_span_rows': rows, 'point_motion_span_domain_complete': complete,
                      'point_motion_span_measurement_status': status})


def measure_point_motion_spans(*, before, after, before_frame, after_frame,
                              translations, point, action_ref, transition_ref,
                              candidate_ref, context_epoch, contract):
    if not contract or point is None:
        return _result(status='missing_point_or_contract')
    limit = contract['maximum_translations']
    if (len(translations) > limit
            or len(translations) * (len(translations) - 1) // 2 > contract['maximum_pairs']
            or max(len(before.entities), len(after.entities)) > contract['maximum_components']):
        return _result(status='component_or_pair_bound_exceeded')
    if max(before_frame.height * before_frame.width, after_frame.height * after_frame.width) > contract['maximum_pixels']:
        return _result(status='pixel_bound_exceeded')
    old = {e.entity_id: e.component for e in before.entities}
    current = {e.entity_id: e.component for e in after.entities}
    if len(old) != len(before.entities) or len(current) != len(after.entities):
        raise ValueError('duplicate point span component identity')

    def dominant(frame):
        counts = Counter(value for row in frame.rows for value in row)
        largest = max(counts.values(), default=0)
        values = tuple(value for value, count in sorted(counts.items()) if count == largest)
        return values[0] if len(values) == 1 else None

    old_peak, new_peak = dominant(before_frame), dominant(after_frame)
    if old_peak is None or old_peak != new_peak:
        return _result(status='dominant_value_not_unique_or_changed')

    def interval(box, horizontal):
        return (box.left, box.right, box.top, box.bottom) if horizontal else (box.top, box.bottom, box.left, box.right)

    def border_gaps(frame, first, second, horizontal):
        a, b, low, high = interval(first.bbox, horizontal)
        c, d, other_low, other_high = interval(second.bbox, horizontal)
        if (low, high) != (other_low, other_high) or b >= c:
            return False
        for orthogonal in (low, high):
            run = 0
            for coordinate in range(b + 1, c):
                value = frame.rows[orthogonal][coordinate] if horizontal else frame.rows[coordinate][orthogonal]
                run = run + 1 if value == old_peak else 0
                if run > contract['maximum_interior_border_gap']:
                    return False
        return True

    results = []
    for index, first in enumerate(translations):
        for second in translations[index + 1:]:
            delta = (first.delta_row, first.delta_col)
            if delta != (second.delta_row, second.delta_col) or (delta[0] == 0) == (delta[1] == 0):
                continue
            horizontal = delta[0] == 0
            refs = (first.entity_ref, second.entity_ref)
            if any(ref not in old or ref not in current for ref in refs):
                continue
            if old[refs[0]].value != old[refs[1]].value:
                continue
            ordered = tuple(sorted(refs, key=lambda ref: interval(old[ref].bbox, horizontal)[0]))
            left, right = (old[ref] for ref in ordered)
            new_left, new_right = (current[ref] for ref in ordered)
            if not (border_gaps(before_frame, left, right, horizontal)
                    and border_gaps(after_frame, new_left, new_right, horizontal)):
                continue
            a, _, low, high = interval(left.bbox, horizontal)
            _, b, _, _ = interval(right.bbox, horizontal)
            na, _, nl, nh = interval(new_left.bbox, horizontal)
            _, nb, _, _ = interval(new_right.bbox, horizontal)
            if (na - a, nb - b, nl - low, nh - high) != ((delta[1], delta[1], 0, 0) if horizontal else (delta[0], delta[0], 0, 0)):
                continue
            axis_point, orthogonal_point = (point[1], point[0]) if horizontal else point
            if not (low <= orthogonal_point <= high and (axis_point < a or axis_point > b)
                    and na <= axis_point <= nb):
                continue
            strip_members = tuple(t.entity_ref for t in translations if (t.delta_row, t.delta_col) == delta
                and t.entity_ref in old and t.entity_ref in current
                and interval(old[t.entity_ref].bbox, horizontal)[2] <= high
                and interval(old[t.entity_ref].bbox, horizontal)[3] >= low)
            if any(interval(old[ref].bbox, horizontal)[0] < a or interval(old[ref].bbox, horizontal)[1] > b
                   for ref in strip_members):
                continue
            results.append(FrozenMap({
                'point_span_token': stable_digest((transition_ref, ordered)),
                'point_span_endpoint_refs': ordered, 'point_span_member_refs': tuple(sorted(strip_members)),
                'point_span_member_count': len(strip_members),
                'point_span_before_interval': (a, b), 'point_span_after_interval': (na, nb),
                'point_span_orthogonal_interval': (low, high),
                'point_span_axis': 'column' if horizontal else 'row',
                'point_span_delta': delta, 'point_span_extent_preserved': True,
                'point_span_before_side': 'lower' if axis_point < a else 'upper',
                'point_span_point_to_lower_edge': axis_point - na,
                'point_span_point_to_upper_edge': nb - axis_point,
                'point_span_action_point': point, 'point_span_action_ref': action_ref,
                'point_span_operator_value': before_frame.rows[point[0]][point[1]],
                'point_span_endpoint_patches': tuple((
                    (current[ref].bbox.top, current[ref].bbox.left, current[ref].bbox.bottom, current[ref].bbox.right),
                    tuple(tuple(after_frame.rows[y][current[ref].bbox.left:current[ref].bbox.right+1])
                          for y in range(current[ref].bbox.top, current[ref].bbox.bottom+1))) for ref in ordered),
                'point_span_transition_ref': transition_ref, 'point_span_candidate_ref': candidate_ref,
                'point_span_context_epoch': context_epoch, 'point_span_frame_ref': after.frame_ref,
                'point_span_domain_complete': True,
            }))
            if len(results) > contract['maximum_spans']:
                return _result(status='span_bound_exceeded')
    return _result(tuple(results), complete=True, status='complete')


def measure_current_point_span_bindings(frame, records, context_epoch, contract):
    """Revalidate literal endpoint supports, keeping every current grouping."""
    if not contract:
        return (), False
    if len(records) > contract['maximum_recall_records']:
        return (), False
    current = {}
    for row in records:
        if row.get('context_epoch') != context_epoch:
            continue
        patches = row.get('endpoint_patches', ())
        if len(patches) != 2:
            continue
        valid = True
        for box, patch in patches:
            top, left, bottom, right = box
            if (top < 0 or left < 0 or bottom >= frame.height or right >= frame.width
                    or len(patch) != bottom - top + 1
                    or any(len(line) != right - left + 1 for line in patch)
                    or tuple(tuple(frame.rows[y][left:right+1]) for y in range(top, bottom+1)) != tuple(tuple(line) for line in patch)):
                valid = False
                break
        if not valid:
            continue
        key = (tuple(row['endpoint_refs']), row['axis'], tuple(row['after_interval']), tuple(row['orthogonal_interval']))
        current.setdefault(key, row)
    if len(current) > contract['maximum_spans']:
        return (), False
    rows = []
    for key, current_row in sorted(current.items()):
        history = tuple(r for r in records if r.get('context_epoch') == context_epoch
                        and tuple(r.get('endpoint_refs', ())) == key[0] and r.get('axis') == key[1]
                        and r.get('source_claim_ref'))
        rows.append((current_row, history))
    return tuple(rows), True


def measure_point_span_locus(frame, point, bindings, complete):
    """Arithmetic consequences of current supports and observed edge offsets."""
    matches = []
    for row, history in bindings:
        horizontal = row['axis'] == 'column'
        axis, orthogonal = (point[1], point[0]) if horizontal else point
        lower, upper = row['after_interval']
        ortho_lower, ortho_upper = row['orthogonal_interval']
        if not ortho_lower <= orthogonal <= ortho_upper or lower <= axis <= upper:
            continue
        side = 'lower' if axis < lower else 'upper'
        samples = tuple(r for r in history if r['point_before_side'] == side
                        and r['operator_value'] == frame.rows[point[0]][point[1]])
        if not samples:
            continue
        offsets = tuple(sorted({r['point_to_lower_edge'] if side == 'lower' else r['point_to_upper_edge'] for r in samples}))
        if len(offsets) != 1:
            continue
        delta = axis - offsets[0] - lower if side == 'lower' else axis + offsets[0] - upper
        matches.append((row, samples, delta))
    result = {'point_span_recall_domain_complete': complete, 'point_span_locus_binding_count': len(matches)}
    if len(matches) == 1 and complete:
        row, samples, delta = matches[0]
        result.update({
            'point_span_current_support_exact': True,
            'point_span_locus_expected_delta': delta,
            'point_span_locus_expected_distance': abs(delta),
            'point_span_locus_sample_count': len(samples),
            'point_span_locus_distinct_points': len({tuple(r['action_point']) for r in samples}),
            'point_span_locus_support_claim_refs': tuple(sorted({r['source_claim_ref'] for r in samples})),
            'point_span_locus_current_endpoint_refs': row['endpoint_refs'],
            'point_span_locus_axis': row['axis'],
        })
    return FrozenMap(result)
