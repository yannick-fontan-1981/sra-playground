"""Exact component/rectangle relations from authenticated retained deltas.

No object role, construction law, experiment priority or action is chosen here.
"""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data


def sparse_rectangular_change_facts(value):
    frame = value.current_observed_frame or value.frame
    digest = stable_digest(frame.rows)
    rows = tuple(row for row in value.sparse_raster_transitions
                 if row.after_digest == digest and row.action_ref == value.last_action_ref)
    # Repeated readings of the same transition are one measured pair.
    rows = tuple(dict.fromkeys(rows))
    facts = {'sparse_current_shift_rectangle_count': 0}
    descriptions = []
    if len(rows) != 1:
        return facts
    row = rows[0]
    cells = {(r, c): (a, b) for r, c, a, b in row.changed_cells}
    other = row.other_changed_cells
    for _, r, c, h, w, dr, dc, area in row.small_component_translations:
        if area != 1 or h != 1 or w != 1 or bool(dr) == bool(dc) or not other:
            continue
        if (r, c) not in cells or (r + dr, c + dc) not in cells:
            continue
        after_values = {b for _, _, _, b in other}
        if len(after_values) != 1:
            continue
        old_values = tuple(sorted({a for _, _, a, _ in other}))
        new_value = next(iter(after_values))
        if (cells[(r, c)][1] != new_value
                or cells[(r + dr, c + dc)][0] not in old_values):
            continue
        support = {(rr, cc) for rr, cc, _, _ in other} | {(r, c)}
        top, left = min(rr for rr, _ in support), min(cc for _, cc in support)
        bottom, right = max(rr for rr, _ in support), max(cc for _, cc in support)
        if len(support) != (bottom - top + 1) * (right - left + 1):
            continue
        descriptions.append((row.action_ref, dr, dc,
            (top, left, bottom, right), old_values, new_value))
    facts['sparse_current_shift_rectangle_count'] = len(descriptions)
    if len(descriptions) == 1:
        action, dr, dc, box, old_value, new_value = descriptions[0]
        interface = {ref: (r, c) for ref, r, c in value.interface_action_translation_deltas}
        delta = interface.get(action)
        facts.update({
            'sparse_current_shift_rectangle_action_ref': action,
            'sparse_current_shift_rectangle_displacement': (dr, dc),
            'sparse_current_changed_rectangle_bbox': box,
            'sparse_current_changed_rectangle_palette_pair': (old_value, new_value),
            'sparse_shift_orthogonal_to_input_interface_delta': bool(
                delta and dr * delta[0] + dc * delta[1] == 0),
        })
    return facts


def annotate_sparse_raster_relations(value, agenda, point_action_ref):
    measured = sparse_rectangular_change_facts(value)
    from .orthogonal_support_geometry import measure_orthogonal_support_geometry
    layouts = measure_orthogonal_support_geometry(value)
    agenda = append_orthogonal_support_points(value, agenda, layouts, point_action_ref)
    geometry, candidate_geometry = orthogonal_trace_relations(value, layouts, agenda.candidates)
    if measured['sparse_current_shift_rectangle_count'] == 0 and not layouts:
        return agenda
    interface = {ref: (r, c) for ref, r, c in value.interface_action_translation_deltas}
    prior = interface.get(measured.get('sparse_current_shift_rectangle_action_ref'))
    facts, deltas = {}, {}
    for candidate in agenda.candidates:
        delta = interface.get(candidate.action_ref)
        local = {
            'sparse_current_shift_rectangle_count': measured['sparse_current_shift_rectangle_count'],
            'sparse_shift_orthogonal_to_input_interface_delta': measured.get(
                'sparse_shift_orthogonal_to_input_interface_delta', False),
            'sparse_candidate_interface_is_opposite_of_measured_input': bool(
                prior and delta and delta == (-prior[0], -prior[1])),
            'sparse_candidate_input_has_no_same_axis_rectangular_observation': not any(
                row.action_ref == candidate.action_ref and len(row.other_changed_cells) > 1
                and any(bool(m[5]) == bool(measured.get('sparse_current_shift_rectangle_displacement', (0,0))[0])
                        and bool(m[6]) == bool(measured.get('sparse_current_shift_rectangle_displacement', (0,0))[1])
                        for m in row.small_component_translations)
                for row in value.sparse_raster_transitions),
        }
        local.update(geometry)
        local.update(candidate_geometry.get(candidate.candidate_ref, {}))
        facts[candidate.candidate_ref] = FrozenMap.overlay(
            local, agenda.alternative_facts.get(candidate.candidate_ref, FrozenMap()))
        deltas[candidate.candidate_ref] = FrozenMap.overlay(
            local, agenda.descriptive_delta_facts.get(candidate.candidate_ref, FrozenMap()))
    return agenda.model_copy(update={
        'alternative_facts': FrozenMap(facts), 'descriptive_delta_facts': FrozenMap(deltas),
        'context_facts': FrozenMap.overlay({**measured, **geometry}, agenda.context_facts)})


def append_orthogonal_support_points(value, agenda, layouts, point_action_ref):
    """Enumerate all measured support centers, without assigning their use."""
    from .contracts import InteractionProbeCandidate
    if len(layouts) != 1 or point_action_ref not in value.available_action_refs:
        return agenda
    g = layouts[0]
    boxes = g['row_support_boxes'] + g['column_support_boxes']
    if len(boxes) > 128:
        return agenda
    existing = {(c.action_ref, c.point) for c in agenda.candidates}
    counts = dict(value.candidate_execution_counts)
    no_effect = frozenset(value.current_context_no_effect_candidate_refs)
    tested = frozenset(value.tested_candidate_refs_without_resolution_plan)
    added, facts = [], {}
    for _, y, x, size, _ in boxes:
        point = (y+(size-1)//2, x+(size-1)//2)
        if (point_action_ref, point) in existing:
            continue
        existing.add((point_action_ref, point))
        ref = 'probe:orthogonal-support:' + stable_digest((y,x,size))[:24]
        components = tuple(c for c in value.components.components if point in c.pixels)
        component_ref = components[0].component_id if len(components) == 1 else None
        added.append(InteractionProbeCandidate(candidate_ref=ref, action_ref=point_action_ref,
            component_ref=component_ref, point=point,
            action_data=FrozenMap({'x':point[1], 'y':point[0]}),
            basis_refs=('measurement:aligned-uniform-support-square',)))
        facts[ref] = FrozenMap({
            'candidate_ref':ref, 'action_ref':point_action_ref,
            'component_ref':component_ref, 'interaction_measurement_kind':'point',
            'candidate_observation_row':point[0], 'candidate_observation_col':point[1],
            'candidate_execution_count':int(counts.get(ref,0)),
            'action_execution_count':int(dict(value.action_execution_counts).get(point_action_ref,0)),
            'attempted_without_effect_in_current_context':ref in no_effect,
            'tested_before_without_resolution_plan':ref in tested,
            'is_boundary_collinear_component':False,
        })
    if not added:
        return agenda
    candidates = agenda.candidates + tuple(added)
    return agenda.model_copy(update={
        'candidates':candidates, 'alternative_refs':tuple(c.candidate_ref for c in candidates),
        'alternative_facts':FrozenMap.overlay(
            {ref:FrozenMap.overlay(fact,agenda.context_facts) for ref,fact in sorted(facts.items())},
            agenda.alternative_facts),
        'descriptive_delta_facts':FrozenMap.overlay(facts,agenda.descriptive_delta_facts),
        'has_candidates':True})


def orthogonal_trace_relations(value, layouts, candidates):
    facts = {'orthogonal_support_geometry_count': len(layouts)}
    # A new measurement is not a receipt for a calculation on an older frame.
    facts['prefix_inverse_actual_source_return'] = False
    per_candidate = {}
    if len(layouts) != 1:
        return facts, per_candidate
    g = layouts[0]
    facts['orthogonal_support_geometry'] = g
    facts['orthogonal_prefix_parameter_input'] = immutable_json_data({
        'geometry':g, 'transitions':value.sparse_raster_transitions,
        'mechanism_memories':value.canonical_prefix_mechanism_memory_facts,
        'interface_deltas':value.interface_action_translation_deltas,
        'receipt':value.retained_physical_transition_receipt,
        'level_index':value.observed_level_index, 'epoch':value.current_context_epoch,
        'frame_ref':value.current_observation_frame_ref,
    })
    subgrids = g['homologous_raster_subgrids']
    unique_subgrid = subgrids[0] if g['homologous_raster_subgrids_complete'] and len(subgrids) == 1 else None
    correspondences = unique_subgrid['cell_correspondences'] if unique_subgrid else ()
    facts.update({
        'orthogonal_homologous_subgrid_count':len(subgrids),
        'orthogonal_homologous_subgrids_complete':g['homologous_raster_subgrids_complete'],
        'orthogonal_unique_homologous_subgrid':unique_subgrid,
        'orthogonal_homologous_cell_correspondences':correspondences,
        'orthogonal_homologous_cell_correspondence_count':len(correspondences),
    })
    rows = tuple(r+(g['extent']-1)//2 for r in g['rows'])
    cols = tuple(c+(g['extent']-1)//2 for c in g['columns'])
    outlines = g['outline_support_intersections']
    if len(outlines) != 1:
        return facts, per_candidate
    axis, ordinal, _, _, _, ink = outlines[0]
    inside = tuple((r,c) for r,c,v in g['singleton_positions']
                   if v == ink and r in rows and c in cols)
    external = tuple((r,c) for r,c,v in g['singleton_positions'] if v == ink
        and ((axis == 'row' and r == rows[ordinal] and (c < cols[0] or c > cols[-1]))
             or (axis == 'column' and c == cols[ordinal] and (r < rows[0] or r > rows[-1]))))
    traces = []
    for transition in value.sparse_raster_transitions:
        for _, r, c, h, w, dr, dc, area in transition.small_component_translations:
            if area != 1 or r not in rows or c not in cols or bool(dr) == bool(dc):
                continue
            ri, ci = rows.index(r), cols.index(c)
            top, left = g['rows'][ri], g['columns'][ci]
            changes = tuple((rr,cc,a,b) for rr,cc,a,b in transition.changed_cells
                if top <= rr < top+g['extent'] and left <= cc < left+g['extent'])
            if len({b for _,_,_,b in changes}) > 1:
                # The vacated marker can expose existing crossing material.
                # Keep that restoration separate from the other pixel delta.
                changes = tuple(x for x in changes if x[:2] != (r,c))
            if len(changes) <= 1 or len({b for _,_,_,b in changes}) != 1:
                continue
            rr0, cc0 = min(x[0] for x in changes), min(x[1] for x in changes)
            rr1, cc1 = max(x[0] for x in changes), max(x[1] for x in changes)
            if len(changes) != (rr1-rr0+1)*(cc1-cc0+1):
                continue
            measured_axis = 'row' if dc else 'column'
            offset = (rr0+rr1-2*r) if dc else (cc0+cc1-2*c)
            side = int(offset > 0)-int(offset < 0)
            traces.append((measured_axis,ri if dc else ci,ci if dc else ri,
                transition.action_ref,dr,dc,changes[0][3],side))
    current = tuple(x for x in traces if x[0] == axis and x[1] == ordinal)
    native = {ref:(r,c) for ref,r,c in value.interface_action_translation_deltas}
    same_axis_inputs = tuple(x for x in traces if x[0] == axis
                            and abs(x[4] or x[5]) == g['pitch'])
    other_axis_inputs = tuple(x for x in traces if x[0] != axis
                             and abs(x[4] or x[5]) == g['pitch'])
    opposed = any(a[3] in native and b[3] in native
        and native[a[3]] == tuple(-v for v in native[b[3]]) and a[4:6] == b[4:6]
        for a in same_axis_inputs for b in same_axis_inputs)
    total = len(cols) if axis == 'row' else len(rows)
    visited = {x[2] for x in current}
    front = (cols.index(inside[0][1]) if axis == 'row' else rows.index(inside[0][0])) if len(inside) == 1 else None
    cross = tuple(t for t in traces if t[0] != axis and t[1] == front and t[2] == ordinal)
    band_relations = {a[7] == b[7] for a in traces for b in traces
        if a[0] == 'row' and b[0] == 'column' and a[1] == b[2]
        and a[2] == b[1] and a[7] != 0 and b[7] != 0}
    scoped_effects = scoped_raster_effect_rows(value, g)
    previous = value.previous_action_observed_frame
    frame = value.current_observed_frame or value.frame
    grid_unchanged = bool(previous and previous.height == frame.height
        and previous.width == frame.width and all(previous.rows[r][c] == frame.rows[r][c]
            for r in range(g['rows'][0],g['rows'][-1]+g['extent'])
            for c in range(g['columns'][0],g['columns'][-1]+g['extent'])))
    facts.update({
        'orthogonal_outlined_axis': axis,
        'orthogonal_outlined_front_inside_grid': len(inside) == 1,
        'orthogonal_outlined_front_outside_grid': len(external) == 1,
        'orthogonal_outlined_line_observed_slot_count': len(visited),
        'orthogonal_outlined_line_all_slots_observed': len(visited) == total,
        'orthogonal_opposed_inputs_have_equal_observed_shift': opposed,
        'orthogonal_outlined_axis_observed_input_count': len({x[3] for x in same_axis_inputs}),
        'orthogonal_outlined_front_slot': front,
        'orthogonal_front_other_axis_trace_count': len(cross),
        'orthogonal_scoped_action_effect_rows': scoped_effects,
        'orthogonal_last_input_grid_pixels_unchanged': grid_unchanged,
        'orthogonal_observed_two_axis_crossing_band_equalities': tuple(sorted(band_relations)),
    })
    outlined_boxes = g['row_support_boxes'] if axis == 'row' else g['column_support_boxes']
    _,_,outline_y,outline_x,outline_size,_ = outlines[0]
    outlined_values = tuple(b[4] for b in outlined_boxes if b[:4] == (ordinal,outline_y,outline_x,outline_size))
    outlined_value = outlined_values[0] if len(outlined_values) == 1 else None
    from .observed_prefix_parameter_domain import contour_bindings
    contour_color_changes = 0
    for t in value.sparse_raster_transitions:
        before = contour_bindings(g,t.before_square_contours)
        after = contour_bindings(g,t.after_square_contours)
        contour_color_changes += int(bool(t.point is not None and t.changed_cells_complete
            and len(before)==len(after)==1 and before[0][:3]==after[0][:3]
            and before[0][3]!=after[0][3]
            and any(g['rows'][0] <= r < g['rows'][-1]+g['extent']
                and g['columns'][0] <= c < g['columns'][-1]+g['extent']
                for r,c,_,_ in t.changed_cells)))
    facts['orthogonal_same_contour_color_change_with_grid_effect_count'] = contour_color_changes
    opposite_axis = 'column' if axis == 'row' else 'row'
    boxes = g['column_support_boxes'] if axis == 'row' else g['row_support_boxes']
    for candidate in candidates:
        delta = native.get(candidate.action_ref)
        sides = {t[7] for t in same_axis_inputs if t[3] == candidate.action_ref}
        last_delta = native.get(value.last_action_ref)
        local = {
            'orthogonal_candidate_is_last_observed_same_axis_input': bool(current
                and candidate.action_ref == value.last_action_ref
                and candidate.action_ref in {x[3] for x in same_axis_inputs}),
            'orthogonal_candidate_native_axis_is_perpendicular_to_other_observed_inputs': bool(
                delta and other_axis_inputs and all(native.get(x[3])
                    and delta[0]*native[x[3]][0]+delta[1]*native[x[3]][1] == 0
                    for x in other_axis_inputs)),
            'orthogonal_point_in_perpendicular_support': False,
            'orthogonal_candidate_crossing_band_relation_is_unobserved_contrast': bool(
                len(cross) == 1 and len(sides) == 1 and cross[0][7] != 0
                and 0 not in sides and len(band_relations) == 1
                and ((next(iter(sides)) == cross[0][7]) not in band_relations)),
            'orthogonal_candidate_input_unobserved_at_current_front': not any(
                e[0] == axis and e[1] == ordinal and e[2] == front
                and e[3] == candidate.action_ref for e in scoped_effects),
            'orthogonal_candidate_is_opposite_of_last_unchanged_grid_input': bool(
                grid_unchanged and delta and last_delta
                and delta == tuple(-v for v in last_delta)),
        }
        if candidate.point is not None:
            r,c = candidate.point
            same_matches = tuple(b for b in outlined_boxes if b[0] == ordinal
                and b[1] <= r < b[1]+b[3] and b[2] <= c < b[2]+b[3])
            if len(same_matches) == 1 and unique_subgrid is not None:
                palette = same_matches[0][4]
                local.update({
                    'orthogonal_point_in_current_outlined_support':True,
                    'orthogonal_point_palette_differs_from_outlined_palette':palette != outlined_value,
                    'orthogonal_point_palette_matches_reference_mismatch_on_observed_slot':any(
                        unique_subgrid['values'][ordinal if axis=='row' else slot][slot if axis=='row' else ordinal] == palette
                        and g['cell_center_values'][ordinal if axis=='row' else slot][slot if axis=='row' else ordinal] == outlined_value
                        and palette != outlined_value for slot in visited),
                })
            matches = tuple(box for box in boxes
                            if box[1] <= r < box[1]+box[3] and box[2] <= c < box[2]+box[3])
            if len(matches) == 1:
                index,y,x,size,palette = matches[0]
                other_visited = {t[2] for t in traces if t[0] == opposite_axis and t[1] == index}
                other_front = len(other_visited) if other_visited == set(range(len(other_visited))) else None
                local.update({
                    'orthogonal_point_in_perpendicular_support': True,
                    'orthogonal_point_support_crosses_first_traced_slot': bool(visited and index == min(visited)),
                    'orthogonal_point_support_has_unobserved_slots': len(other_visited) < (
                        len(rows) if opposite_axis == 'column' else len(cols)),
                    'orthogonal_point_front_crosses_observed_other_axis_material': bool(
                        other_front is not None and any(t[0] == axis and t[1] == other_front
                            and t[2] == index for t in traces)),
                    'orthogonal_point_front_has_unique_homologous_cell': sum(
                        (p[0] == index and p[1] == other_front) if opposite_axis == 'row'
                        else (p[1] == index and p[0] == other_front)
                        for p in correspondences) == 1,
                    'orthogonal_point_palette_differs_from_last_outlined_rect': bool(
                        current and palette != current[-1][6]),
                })
        per_candidate[candidate.candidate_ref] = local
    return facts, per_candidate


def scoped_raster_effect_rows(value, geometry):
    """axis, support ordinal, marker slot, input, full/grid delta counts, digests.

    Scope is an exact contour/support coincidence, not an inferred game role.
    Missing or ambiguous contours/markers remain unbound.
    """
    g = geometry
    centers_r = tuple(r+(g['extent']-1)//2 for r in g['rows'])
    centers_c = tuple(c+(g['extent']-1)//2 for c in g['columns'])
    rows = []
    for t in value.sparse_raster_transitions:
        if t.before_square_contours is None or t.before_singleton_positions is None:
            continue
        matches = []
        for top,left,extent,ink,_,_ in t.before_square_contours:
            if extent != g['extent']:
                continue
            center = (top+(extent-1)//2,left+(extent-1)//2)
            for axis,boxes in (('row',g['row_support_boxes']),('column',g['column_support_boxes'])):
                for index,y,x,size,_ in boxes:
                    if center != (y+(size-1)//2,x+(size-1)//2):
                        continue
                    markers = tuple((r,c) for r,c,v in t.before_singleton_positions
                        if v == ink and axial_slot(r,c,axis,index,centers_r,centers_c,g['pitch']) is not None)
                    if len(markers) == 1:
                        slot = axial_slot(*markers[0],axis,index,centers_r,centers_c,g['pitch'])
                        matches.append((axis,index,slot))
        if len(matches) != 1:
            continue
        grid_count = sum(g['rows'][0] <= r < g['rows'][-1]+g['extent']
            and g['columns'][0] <= c < g['columns'][-1]+g['extent']
            for r,c,_,_ in t.changed_cells) if t.changed_cells_complete else None
        rows.append((*matches[0],t.action_ref,t.changed_cell_count,grid_count,
            t.before_digest,t.after_digest))
    return tuple(rows)


def axial_slot(row, col, axis, index, rows, columns, pitch):
    if (axis == 'row' and row != rows[index]) or (axis == 'column' and col != columns[index]):
        return None
    coordinate, centers = (col,columns) if axis == 'row' else (row,rows)
    if coordinate in centers:
        return centers.index(coordinate)
    if centers[0]-pitch <= coordinate < centers[0]:
        return -1
    if centers[-1] < coordinate <= centers[-1]+pitch:
        return len(centers)
    return None
