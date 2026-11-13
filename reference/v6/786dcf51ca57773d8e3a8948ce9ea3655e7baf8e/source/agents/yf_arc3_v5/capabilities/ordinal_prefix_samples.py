"""Bounded rectangular-prefix measurements and exact inverse L1 fits.

No indicator roles, acquisition meanings, goals or action selection are authored
here. Source-owned canonical observation samples are the only recalled history.
"""
from collections.abc import Mapping
from itertools import combinations

from .components import detect_components
from .contracts import ComponentExtractionInput
from ..logos.types import FrozenMap


def _rectangular_prefixes(frame):
    result = {}
    for component in detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components:
        box = component.bbox
        if component.area != box.height * box.width or box.height == box.width:
            continue
        if box.width > box.height:
            keys = (('horizontal_from_left', box.top, box.bottom, box.left),
                    ('horizontal_from_right', box.top, box.bottom, box.right))
            length = box.width
        else:
            keys = (('vertical_from_top', box.left, box.right, box.top),
                    ('vertical_from_bottom', box.left, box.right, box.bottom))
            length = box.height
        for key in keys:
            result.setdefault(key, []).append((length, component.value))
    return result


def _inverse_l1_fit_rows(samples, universe):
    rows = []
    for size in range(1, len(universe) + 1):
        for subset in combinations(universe, size):
            distances = []
            for sample in samples:
                active = set(subset).intersection(sample['member_boxes'])
                if not active:
                    break
                row, col = sample['point']
                distances.append(min(abs(row - (top + bottom) // 2)
                    + abs(col - (left + right) // 2)
                    for top, left, bottom, right in active))
            if len(distances) != len(samples):
                continue
            # One stationary ordinal function: equal distances have equal
            # values; increasing distance cannot increase the fill length.
            by_distance = {}
            for distance, sample in zip(distances, samples):
                by_distance.setdefault(distance, set()).add(sample['fill_length'])
            if any(len(values) != 1 for _, values in sorted(by_distance.items())):
                continue
            ordered = [(distance, next(iter(values)))
                for distance, values in sorted(by_distance.items())]
            if any(a[1] < b[1] for a, b in zip(ordered, ordered[1:])):
                continue
            rows.append(FrozenMap({'member_boxes': subset,
                'sample_distances': tuple(distances),
                'zero_distance_sample_count': sum(distance == 0 for distance in distances),
                'positive_distance_sample_count': sum(distance > 0 for distance in distances)}))
    return tuple(rows)


def measure_ordinal_prefix_samples(value, domain, member_boxes, contract):
    """Measure all anchored alternatives; return exact singleton fits only."""
    if (not contract or not member_boxes or len(value.input_aligned_entity_bboxes) != 1
            or value.current_observation_frame_ref is None):
        return FrozenMap()
    body = value.input_aligned_entity_bboxes[0]
    if body.height * body.width != 1:
        return FrozenMap()
    current = _rectangular_prefixes(value.frame)
    previous = (_rectangular_prefixes(value.previous_action_observed_frame)
        if value.previous_action_observed_frame is not None else {})
    token = domain['repeated_inset_domain_token']
    epoch = value.current_context_epoch
    recalled = []
    anchors = set()
    for record in value.canonical_probe_precondition_facts[-contract['maximum_canonical_samples']:]:
        sample = record.get('support_preconditions', {}).get('repeated_inset_indicator_sample')
        if (not isinstance(sample, Mapping) or sample.get('context_epoch') != epoch
                or sample.get('domain_token') != token):
            continue
        for row in sample.get('prefix_samples', ()):
            anchors.add(tuple(row['anchor']))
            recalled.append((record['claim_ref'], row))
    for anchor, items in sorted(current.items()):
        before = previous.get(anchor, ())
        if len(items) == len(before) == 1 and items[0][0] != before[0][0]:
            anchors.add(anchor)
    anchor_count = len(anchors)
    anchor_scope_bound_exceeded = anchor_count > contract['maximum_prefixes']
    if anchor_scope_bound_exceeded:
        anchors = set()
    current_rows = []
    fits = []
    sample_scope_bound_exceeded = anchor_scope_bound_exceeded
    for anchor in sorted(anchors):
        items = current.get(anchor, ())
        if len(items) != 1:
            continue
        now = FrozenMap({'anchor': anchor, 'frame_ref': value.current_observation_frame_ref,
            'point': (body.top, body.left), 'member_boxes': tuple(sorted(member_boxes)),
            'fill_length': items[0][0], 'fill_value': items[0][1]})
        current_rows.append(now)
        samples_by_frame = {}
        refs = set()
        for claim_ref, sample in recalled:
            if tuple(sample['anchor']) == anchor:
                samples_by_frame[sample['frame_ref']] = sample
                refs.add(claim_ref)
        samples_by_frame[now['frame_ref']] = now
        samples = tuple(sample for _, sample in sorted(samples_by_frame.items()))
        if len(samples) > contract['maximum_spatial_samples']:
            sample_scope_bound_exceeded = True
            continue
        universe = tuple(sorted({tuple(box) for sample in samples for box in sample['member_boxes']}))
        if not 1 <= len(universe) <= contract['maximum_member_boxes']:
            continue
        model_rows = _inverse_l1_fit_rows(samples, universe)
        fits.append(FrozenMap({'anchor': anchor, 'sample_count': len(samples),
            'distinct_fill_count': len({sample['fill_length'] for sample in samples}),
            'distinct_point_count': len({tuple(sample['point']) for sample in samples}),
            'model_count': len(model_rows), 'support_claim_refs': tuple(sorted(refs)),
            'model_rows': model_rows}))
    unique_rows = (() if sample_scope_bound_exceeded else
        tuple(row for row in fits if row['model_count'] == 1))
    unique = unique_rows[0] if len(unique_rows) == 1 else None
    model = unique['model_rows'][0] if unique is not None else None
    current_subset = (tuple(box for box in model['member_boxes'] if box in member_boxes)
        if model is not None else ())
    return FrozenMap({'repeated_inset_indicator_sample': FrozenMap({
            'context_epoch': epoch, 'domain_token': token, 'prefix_samples': tuple(current_rows)}),
        'repeated_inset_indicator_anchor_count': anchor_count,
        'repeated_inset_indicator_anchor_scope_bound_exceeded': anchor_scope_bound_exceeded,
        'repeated_inset_indicator_sample_scope_bound_exceeded': sample_scope_bound_exceeded,
        'repeated_inset_indicator_fit_rows': tuple(fits),
        'repeated_inset_indicator_unique_fit_count': len(unique_rows),
        'repeated_inset_indicator_current_member_boxes': current_subset,
        'repeated_inset_indicator_current_member_count': len(current_subset),
        'repeated_inset_indicator_sample_count': unique['sample_count'] if unique is not None else 0,
        'repeated_inset_indicator_distinct_fill_count': unique['distinct_fill_count'] if unique is not None else 0,
        'repeated_inset_indicator_distinct_point_count': unique['distinct_point_count'] if unique is not None else 0,
        'repeated_inset_indicator_zero_distance_sample_count': model['zero_distance_sample_count'] if model is not None else 0,
        'repeated_inset_indicator_positive_distance_sample_count': model['positive_distance_sample_count'] if model is not None else 0,
        'repeated_inset_indicator_support_claim_refs': unique['support_claim_refs'] if unique is not None else (),
    })
