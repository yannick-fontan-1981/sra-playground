"""Exact before/after replacements of recolored framed counterparts."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _gap_patches(source_box, marker_box, frame):
    st, sl, sb, sr = source_box
    mt, ml, mb, mr = marker_box
    boxes = []
    if sb < mt:
        boxes.append(('column', (sb+1, ml, mt-1, mr)))
    elif mb < st:
        boxes.append(('column', (mb+1, ml, st-1, mr)))
    if sr < ml:
        boxes.append(('row', (mt, sr+1, mb, ml-1)))
    elif mr < sl:
        boxes.append(('row', (mt, mr+1, mb, sl-1)))
    return tuple((axis, box, tuple(tuple(frame.rows[y][box[1]:box[3]+1]) for y in range(box[0], box[2]+1)))
                 for axis, box in boxes if 0 <= box[0] <= box[2] < frame.height and 0 <= box[1] <= box[3] < frame.width)


def measure_framed_replacements(*, pairs, before, after, after_frame, complete, action_ref,
                                transition_ref, context_epoch, contract,
                                before_occurrences=(), after_occurrences=(), motion_spans=(),
                                prior_authority=None):
    if not complete or not contract:
        return FrozenMap({'framed_replacement_rows': (), 'framed_replacement_domain_complete': False})
    if max(len(before.entities), len(after.entities)) > contract['maximum_components'] or len(pairs) > contract['maximum_pairs']:
        return FrozenMap({'framed_replacement_rows': (), 'framed_replacement_domain_complete': False})
    old = {e.entity_id: e for e in before.entities}
    current = {e.entity_id: e for e in after.entities}
    rows = []
    for pair in pairs:
        for first, second in (('first', 'second'), ('second', 'first')):
            source = old.get(pair[first + '_entity_ref'])
            target = old.get(pair[second + '_entity_ref'])
            if source is None or target is None:
                continue
            a, b = source.component, target.component
            signature = (a.value, a.bbox.height, a.bbox.width, a.relative_pixels)
            def same(entity):
                part = entity.component
                return (part.value, part.bbox.height, part.bbox.width, part.relative_pixels) == signature
            if sum(same(e) for e in before.entities) != 1 or sum(same(e) for e in after.entities) != 1:
                continue
            moved = next(e for e in after.entities if same(e))
            c = moved.component
            if c.bbox != b.bbox or a.bbox == c.bbox:
                continue
            if any(e.component.bbox == b.bbox and e.component.value == b.value
                   and e.component.relative_pixels == b.relative_pixels for e in after.entities):
                continue
            top, left, bottom, right = pair[second + '_frame_bbox']
            if top < 0 or left < 0 or bottom >= after_frame.height or right >= after_frame.width:
                continue
            border_values = {after_frame.rows[y][x] for y in range(top, bottom+1)
                             for x in range(left, right+1) if y in (top, bottom) or x in (left, right)}
            if len(border_values) != 1:
                continue
            rows.append(FrozenMap({
                'framed_replacement_token': stable_digest((transition_ref, source.entity_id, target.entity_id)),
                'framed_replacement_source_ref': source.entity_id,
                'framed_replacement_current_visible_ref': moved.entity_id,
                'framed_replacement_marker_ref': target.entity_id,
                'framed_replacement_tracking_lineage_agrees': moved.entity_id == source.entity_id,
                'framed_replacement_marker_uniform': False,
                'framed_replacement_gap_patches': _gap_patches(pair[first + '_frame_bbox'], pair[second + '_frame_bbox'], after_frame),
                'framed_replacement_mask_digest': pair['mask_digest'],
                'framed_replacement_mask_extent': pair['mask_extent'],
                'framed_replacement_source_inner_value': pair[first + '_inner_value'],
                'framed_replacement_source_border_value': pair[first + '_border_value'],
                'framed_replacement_marker_inner_value': pair[second + '_inner_value'],
                'framed_replacement_marker_border_value': pair[second + '_border_value'],
                'framed_replacement_after_border_value': next(iter(border_values)),
                'framed_replacement_border_preserved': border_values == {pair[first + '_border_value']},
                'framed_replacement_source_frame_bbox': pair[first + '_frame_bbox'],
                'framed_replacement_marker_frame_bbox': pair[second + '_frame_bbox'],
                'framed_replacement_delta': (c.bbox.top - a.bbox.top, c.bbox.left - a.bbox.left),
                'framed_replacement_action_ref': action_ref,
                'framed_replacement_transition_ref': transition_ref,
                'framed_replacement_context_epoch': context_epoch,
                'framed_replacement_frame_ref': after.frame_ref,
                'framed_replacement_unique_preserved_copy': True,
                'framed_replacement_marker_disappeared': True,
            }))
            if len(rows) > contract['maximum_replacements']:
                return FrozenMap({'framed_replacement_rows': (), 'framed_replacement_domain_complete': False})
    if (len(before_occurrences) > contract['maximum_occurrences']
            or len(after_occurrences) > contract['maximum_occurrences']
            or len(motion_spans) > contract['maximum_motion_spans']):
        return FrozenMap({'framed_replacement_rows': (), 'framed_replacement_domain_complete': False})
    for source in before_occurrences:
        if source['inner_fills_bbox']:
            continue
        copies_before = tuple(r for r in before_occurrences if r['inner_value'] == source['inner_value'] and r['mask_digest'] == source['mask_digest'])
        copies_after = tuple(r for r in after_occurrences if r['inner_value'] == source['inner_value'] and r['mask_digest'] == source['mask_digest'])
        if len(copies_before) != 1 or len(copies_after) != 1:
            continue
        displayed = copies_after[0]
        for span in motion_spans:
            low, high = span['point_span_before_interval']
            olow, ohigh = span['point_span_orthogonal_interval']
            before_box = (olow, low, ohigh, high) if span['point_span_axis'] == 'column' else (low, olow, high, ohigh)
            def inside(box):
                return before_box[0] <= box[0] and before_box[1] <= box[1] and box[2] <= before_box[2] and box[3] <= before_box[3]
            if inside(source['frame_bbox']):
                continue
            dr, dc = span['point_span_delta']
            for marker in before_occurrences:
                if (marker['mask_extent'] != source['mask_extent'] or not inside(marker['frame_bbox'])
                        or not (marker['inner_fills_bbox'] or (marker['mask_digest'] == source['mask_digest'] and marker['inner_value'] != source['inner_value']))):
                    continue
                mt, ml, mb, mr = marker['frame_bbox']
                projected = (mt+dr, ml+dc, mb+dr, mr+dc)
                if displayed['frame_bbox'] != projected or displayed['frame_bbox'] == source['frame_bbox']:
                    continue
                st, sl, sb, sr = source['frame_bbox']
                rows.append(FrozenMap({
                    'framed_replacement_token': stable_digest((transition_ref, source['entity_ref'], marker['entity_ref'], span['point_span_token'])),
                    'framed_replacement_source_ref': source['entity_ref'], 'framed_replacement_current_visible_ref': displayed['entity_ref'],
                    'framed_replacement_marker_ref': marker['entity_ref'],
                    'framed_replacement_tracking_lineage_agrees': displayed['entity_ref'] == source['entity_ref'],
                    'framed_replacement_mask_digest': source['mask_digest'], 'framed_replacement_mask_extent': source['mask_extent'],
                    'framed_replacement_source_inner_value': source['inner_value'], 'framed_replacement_source_border_value': source['border_value'],
                    'framed_replacement_marker_inner_value': marker['inner_value'], 'framed_replacement_marker_border_value': marker['border_value'],
                    'framed_replacement_after_border_value': displayed['border_value'],
                    'framed_replacement_border_preserved': displayed['border_value'] == source['border_value'],
                    'framed_replacement_source_frame_bbox': source['frame_bbox'], 'framed_replacement_marker_frame_bbox': projected,
                    'framed_replacement_before_marker_frame_bbox': marker['frame_bbox'],
                    'framed_replacement_marker_uniform': marker['inner_fills_bbox'],
                    'framed_replacement_gap_patches': _gap_patches(source['frame_bbox'], projected, after_frame),
                    'framed_replacement_receiver_endpoint_refs': span['point_span_endpoint_refs'],
                    'framed_replacement_delta': (projected[0]-st, projected[1]-sl),
                    'framed_replacement_action_ref': action_ref, 'framed_replacement_transition_ref': transition_ref,
                    'framed_replacement_context_epoch': context_epoch, 'framed_replacement_frame_ref': after.frame_ref,
                    'framed_replacement_unique_preserved_copy': True, 'framed_replacement_marker_disappeared': True,
                }))
                if len(rows) > contract['maximum_replacements']:
                    return FrozenMap({'framed_replacement_rows': (), 'framed_replacement_domain_complete': False})
    transported = tuple(FrozenMap({**row,
        'framed_replacement_prior_goal_ref': prior_authority.active_goal_ref if prior_authority is not None else None,
        'framed_replacement_prior_subgoal_ref': prior_authority.subgoal_ref if prior_authority is not None else None,
    }) for row in rows)
    return FrozenMap({'framed_replacement_rows': transported, 'framed_replacement_domain_complete': True})
