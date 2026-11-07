"""Bounded geometric loci from observed framed entry and endpoint offsets.

All class matches, endpoint bindings, operators and registered bridge patches
are retained. DRM decides whether a locus licenses a conditional experiment.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .framed_masks import measure_framed_mask_correspondences
from .point_motion_spans import measure_current_point_span_bindings


def _contains(span, box):
    lower, upper = span['after_interval']
    olower, oupper = span['orthogonal_interval']
    outer = (olower, lower, oupper, upper) if span['axis'] == 'column' else (lower, olower, upper, oupper)
    return outer[0] <= box[0] and outer[1] <= box[1] and box[2] <= outer[2] and box[3] <= outer[3]


def _center(box, axis):
    return (box[1] + box[3]) // 2 if axis == 'column' else (box[0] + box[2]) // 2


def measure_framed_reception_loci(*, frame, components, records, span_records,
                                context_epoch, mask_contract, span_contract,
                                band_facts, contract):
    if not contract or len(records) > contract['maximum_records']:
        return (), False
    measured = measure_framed_mask_correspondences(frame, components, mask_contract)
    bindings, span_complete = measure_current_point_span_bindings(frame, span_records, context_epoch, span_contract)
    if not measured['framed_mask_domain_complete'] or not span_complete:
        return (), False
    classes = tuple(r for r in records if r.get('context_epoch') == context_epoch
                    and r.get('border_preserved') is True and r.get('source_claim_ref'))
    occurrences = measured.get('framed_mask_occurrences', ())
    typed_relations = {}
    for witness in classes:
        if witness['marker_uniform']:
            continue
        for pair in measured['framed_mask_pairs']:
            for first, second in (('first', 'second'), ('second', 'first')):
                if not (pair['mask_extent'] == witness['mask_extent']
                        and pair[first+'_inner_value'] == witness['source_inner_value']
                        and pair[first+'_border_value'] == witness['source_border_value']
                        and pair[second+'_inner_value'] == witness['marker_inner_value']
                        and pair[second+'_border_value'] == witness['marker_border_value']):
                    continue
                key = (pair[first+'_component_ref'], pair[second+'_component_ref'])
                typed_relations.setdefault(key, []).append((pair['mask_digest'], pair[first+'_frame_bbox'], pair[second+'_frame_bbox'], witness))
    if sum(len(rows) for key, rows in sorted(typed_relations.items())) > contract['maximum_relations']:
        return (), False
    tasks = []
    for (source_ref, marker_ref), (mask, source_box, marker_box, witness) in tuple(
            (key, row) for key, rows in sorted(typed_relations.items()) for row in rows):
        for span, history in bindings:
            if _contains(span, source_box) and not _contains(span, marker_box):
                tasks.append((mask, source_ref, marker_ref, source_box, marker_box, witness, span, history, True, 'first'))
            if _contains(span, marker_box) and not _contains(span, source_box):
                tasks.append((mask, source_ref, marker_ref, source_box, marker_box, witness, span, history, True, 'second'))
        for pocket_witness in classes:
            if not pocket_witness['marker_uniform']:
                continue
            if (pocket_witness['source_inner_value'], pocket_witness['source_border_value'], pocket_witness['mask_extent']) != (witness['source_inner_value'], witness['source_border_value'], witness['mask_extent']):
                continue
            for pocket in occurrences:
                if not (pocket['inner_fills_bbox'] and pocket['mask_extent'] == pocket_witness['mask_extent']
                        and pocket['inner_value'] == pocket_witness['marker_inner_value']
                        and pocket['border_value'] == pocket_witness['marker_border_value']):
                    continue
                for span, history in bindings:
                    if _contains(span, pocket['frame_bbox']) and not _contains(span, source_box):
                        tasks.append((mask, source_ref, pocket['component_ref'], source_box, pocket['frame_bbox'], pocket_witness, span, history, False, 'second'))
    if len(tasks) > contract['maximum_tasks']:
        return (), False
    output = {}
    for mask, source_ref, marker_ref, source_box, marker_box, witness, span, history, typed, moving in tasks:
        axis = span['axis']
        source_axis, marker_axis = _center(source_box, axis), _center(marker_box, axis)
        delta = marker_axis - source_axis if moving == 'first' else source_axis - marker_axis
        if delta == 0:
            continue
        shifted_source = tuple(v + (delta if (index in (1,3) if axis=='column' else index in (0,2)) and moving=='first' else 0) for index,v in enumerate(source_box))
        shifted_marker = tuple(v + (delta if (index in (1,3) if axis=='column' else index in (0,2)) and moving=='second' else 0) for index,v in enumerate(marker_box))
        # Reproduce an observed intervening raster, without assigning it a role.
        bridge_matches = []
        for bridge_axis, old_bridge_box, patch in witness.get('gap_patches', ()):
            if bridge_axis != axis:
                continue
            st, sl, sb, sr = shifted_source
            mt, ml, mb, mr = shifted_marker
            if axis == 'column':
                box = (sb+1, ml, mt-1, mr) if sb < mt else (mb+1, ml, st-1, mr) if mb < st else None
            else:
                box = (mt, sr+1, mb, ml-1) if sr < ml else (mt, mr+1, mb, sl-1) if mr < sl else None
            if box is None or not (0 <= box[0] <= box[2] < frame.height and 0 <= box[1] <= box[3] < frame.width):
                continue
            if (box[2]-box[0], box[3]-box[1]) != (old_bridge_box[2]-old_bridge_box[0], old_bridge_box[3]-old_bridge_box[1]):
                continue
            actual = tuple(tuple(frame.rows[y][box[1]:box[3]+1]) for y in range(box[0], box[2]+1))
            if actual == tuple(tuple(row) for row in patch):
                bridge_matches.append(box)
        if not bridge_matches:
            continue
        side = 'lower' if delta < 0 else 'upper'
        low, high = span['after_interval']
        # Enumerate local and analogous observations separately; no rank choice.
        patch_signature = tuple(tuple(tuple(line) for line in patch) for box, patch in span.get('endpoint_patches', ()))
        for prototype in span_records:
            if prototype.get('context_epoch') != context_epoch or prototype.get('axis') != axis or prototype.get('point_before_side') != side or not prototype.get('source_claim_ref'):
                continue
            other_signature = tuple(tuple(tuple(line) for line in patch) for box, patch in prototype.get('endpoint_patches', ()))
            if other_signature != patch_signature or prototype['after_interval'][1]-prototype['after_interval'][0] != high-low:
                continue
            offset = prototype['point_to_lower_edge'] if side == 'lower' else prototype['point_to_upper_edge']
            coordinate = low + delta + offset if side == 'lower' else high + delta - offset
            if low <= coordinate <= high or low+delta < 0 or high+delta >= (frame.width if axis=='column' else frame.height):
                continue
            for component in components:
                facts = band_facts.get(component.component_id, {})
                if facts.get('parallel_solid_band_domain_complete') is not True or facts.get('parallel_solid_band_peer_count') != 1 or component.value != prototype['operator_value']:
                    continue
                point = ((component.bbox.top+component.bbox.bottom)//2, coordinate) if axis=='column' else (coordinate, (component.bbox.left+component.bbox.right)//2)
                orthogonal = point[0] if axis=='column' else point[1]
                if not span['orthogonal_interval'][0] <= orthogonal <= span['orthogonal_interval'][1] or point not in component.pixels:
                    continue
                key = (component.component_id, point, mask, typed, source_ref, marker_ref, delta)
                fields = {
                    'framed_reception_locus_complete': True, 'framed_reception_locus_mask_digest': mask,
                    'framed_reception_locus_same_mask_marker': typed, 'framed_reception_locus_expected_delta': delta,
                    'framed_reception_locus_axis': axis, 'framed_reception_locus_source_ref': source_ref,
                    'framed_reception_locus_marker_ref': marker_ref,
                    'framed_reception_locus_local_operator': tuple(prototype['endpoint_refs']) == tuple(span['endpoint_refs']),
                    'framed_reception_locus_premise_refs': (witness['source_claim_ref'], prototype['source_claim_ref']),
                }
                prior = output.get(key)
                if prior is not None:
                    fields['framed_reception_locus_premise_refs'] = tuple(sorted(set(prior['framed_reception_locus_premise_refs']) | set(fields['framed_reception_locus_premise_refs'])))
                    fields['framed_reception_locus_local_operator'] = prior['framed_reception_locus_local_operator'] or fields['framed_reception_locus_local_operator']
                output[key] = FrozenMap(fields)
                if len(output) > contract['maximum_loci']:
                    return (), False
    return tuple((key[0], key[1], facts) for key, facts in sorted(output.items())), True
