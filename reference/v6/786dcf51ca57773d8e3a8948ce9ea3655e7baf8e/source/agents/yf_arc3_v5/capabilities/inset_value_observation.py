"""Exact local changes inside persistent homologous rectangular perimeters.

No parameter, body, selection or launch interpretation is assigned here.
The caller retains those alternatives and chooses the next experiment in DRM.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .rectangular_commitment import _perimeters, _patch


def measure_inset_value_loci(value, frame, components, contract):
    before = value.previous_action_observed_frame
    if (not contract or contract['point_order'] != 'ROW_MAJOR_CHANGED_INSET'
            or before is None or not value.current_observation_frame_ref
            or before.width != frame.width or before.height != frame.height
            or frame.width * frame.height > contract['maximum_frame_pixels']):
        return ()
    outlines, bounded = _perimeters(frame, contract)
    old_outlines, old_bounded = _perimeters(before, contract)
    if bounded or old_bounded:
        return ()
    carried = value.canonical_dispatched_goal_continuity_facts.get(
        'dispatched_composition_target_context') or {}
    current_digest = stable_digest(frame.rows)
    before_digest = stable_digest(before.rows)
    prior = (carried.get('inset_value_context_epoch') == value.current_context_epoch
             and carried.get('inset_value_source_frame_digest') == before_digest)
    old_boxes = {box for box, _ in old_outlines}
    common = tuple(sorted((box, ink) for box, ink in outlines if box in old_boxes))
    changed = []
    for box, ink in common:
        t, l, b, r = box
        points = tuple((y, x) for y in range(t + 1, b)
                       for x in range(l + 1, r)
                       if before.rows[y][x] != frame.rows[y][x])
        if points:
            changed.append((box, ink, points))
    history = tuple(carried.get('inset_value_transition_rows', ())) if prior else ()
    if prior:
        old_box = tuple(carried['inset_value_panel_bbox'])
        if not any(box == old_box for box, _ in common):
            return ()
        relative = tuple(carried['inset_value_relative_bbox'])
        relative_point = tuple(carried['inset_value_relative_point'])
        source_box = old_box
    elif len(changed) == 1:
        source_box, _ink, points = changed[0]
        t, l, _b, _r = source_box
        relative = (min(y for y, x in points) - t,
                    min(x for y, x in points) - l,
                    max(y for y, x in points) - t,
                    max(x for y, x in points) - l)
        first_y, first_x = min(points)
        relative_point = (first_y - t, first_x - l)
    else:
        return ()
    t, l, b, r = source_box
    peers = tuple((box, ink) for box, ink in common
                  if (box[2] - box[0], box[3] - box[1]) == (b - t, r - l))
    if not contract['minimum_homologous_perimeters'] <= len(peers) <= contract['maximum_homologous_perimeters']:
        return ()
    source_crop = (t + relative[0], l + relative[1],
                   t + relative[2], l + relative[3])
    old_hash = stable_digest(_patch(before, source_crop))
    new_hash = stable_digest(_patch(frame, source_crop))
    latest_ref = value.last_action_ref or value.previous_action_ref
    latest_point = tuple(carried.get('inset_value_point', ())) if prior else ()
    row = FrozenMap({'action_ref': latest_ref, 'point': latest_point,
                     'before_hash': old_hash, 'after_hash': new_hash,
                     'before_frame_digest': before_digest,
                     'after_frame_digest': current_digest,
                     'source_frame_count': value.latest_ordered_action_source_frame_count
                         or len(value.latest_ordered_action_frames)})
    if not history or history[-1] != row:
        history = (*history, row)
    if len(history) > contract['maximum_transition_rows']:
        return ()
    out = []
    for box, ink in peers:
        anchors = tuple(c.component_id for c in components
                        if (c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right) == box
                        and c.value == ink)
        if len(anchors) != 1:
            continue
        y, x = box[0] + relative_point[0], box[1] + relative_point[1]
        point = (y, x)
        matching = tuple(h for h in history if tuple(h['point']) == point
                         and h['action_ref'] == contract['point_action_ref'])
        # Closure is specific to this exact input and patch, not an arbitrary
        # return caused by a different keyboard operator or a different panel.
        closure = any(matching[i]['after_hash'] == matching[j]['before_hash']
                      for i in range(len(matching)) for j in range(i + 1)
                      if matching[i]['before_hash'] != matching[i]['after_hash'])
        no_change = bool(matching and matching[-1]['before_hash'] == matching[-1]['after_hash'])
        crop = (box[0] + relative[0], box[1] + relative[1],
                box[0] + relative[2], box[1] + relative[3])
        token = stable_digest((box, relative, value.current_context_epoch))[:24]
        out.append(FrozenMap({
            'action_ref': contract['point_action_ref'], 'point': point,
            'component_ref': anchors[0],
            'inset_value_geometry_token': token,
            'inset_value_context_epoch': value.current_context_epoch,
            'inset_value_source_frame_ref': value.current_observation_frame_ref,
            'inset_value_source_frame_digest': current_digest,
            'inset_value_panel_bbox': box,
            'inset_value_relative_bbox': relative,
            'inset_value_relative_point': relative_point,
            'inset_value_point': point,
            'inset_value_perimeter_value': ink,
            'inset_value_patch_hash': stable_digest(_patch(frame, crop)),
            'inset_value_transition_rows': history,
            'inset_value_measured_cycle_closed': closure,
            'inset_value_last_point_unchanged': no_change,
            'inset_value_matches_changed_perimeter': box == source_box,
            'inset_value_same_input_sample_count': len(matching),
            'inset_value_multiframe_response_count': sum(h.get('source_frame_count',1)>1 for h in history),
            'inset_value_stationary_perimeter_count': len(peers),
            'inset_value_latest_interior_changed_count': sum(len(ps) for bx, _, ps in changed if bx == box),
            'inset_value_incoming_route_remaining_step_count': value.incoming_declared_route_remaining_step_count,
        }))
    return tuple(out)
