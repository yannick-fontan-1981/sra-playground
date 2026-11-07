"""Finite parameter fitting under a caller-declared binary prefix model.

Returns every consistent table. No mechanism, goal, model or action is selected.
Coordinates, palettes and input identities come only from measured records.
"""
from itertools import product

from agents.yf_arc3_v5.logos.types import stable_digest
from .layered_prefix_construction import PrefixModel, PrefixThread, PrefixCommitment
from .contracts import FrameGrid


def contour_bindings(g, contours):
    bindings = []
    for top,left,extent,ink,color,_ in contours or ():
        if extent != g['extent']:
            continue
        center = (top+(extent-1)//2,left+(extent-1)//2)
        for axis,boxes in (('row',g['row_support_boxes']),('column',g['column_support_boxes'])):
            for index,y,x,size,_ in boxes:
                if center == (y+(size-1)//2,x+(size-1)//2):
                    bindings.append((axis,index,ink,color))
    return tuple(bindings)


def fit_observed_prefix_parameter_domain(g, transitions, interface_deltas, contract):
    """Fit supplied law parameters; an unsupported/incomplete domain stays empty."""
    return _prefix_parameter_domain(g, transitions, interface_deltas, contract)


def replay_recalled_prefix_parameter_domain(g, transitions, interface_deltas, contract,
                                          parameter_table, forward_signs):
    """Rebuild current material under supplied historical parameters, not old state."""
    return _prefix_parameter_domain(g, transitions, interface_deltas, contract,
                                    parameter_table, forward_signs)


def _prefix_parameter_domain(g, transitions, interface_deltas, contract,
                             recalled_table=(), recalled_forward=()):
    empty = {'models':(), 'commitments':(), 'parameter_tables':(),
             'refusal_count':0, 'occlusion_order_count':0, 'cause':'incomplete_measurements'}
    if (not contract or contract.get('layer_law_ref') != 'binary_complementary_layers_top_is_one'
            or contract.get('initial_material_binding') != 'uniform_grid_outside_material_palette'
            or not g.get('homologous_raster_subgrids_complete')
            or len(g.get('homologous_raster_subgrids',())) != 1 or not transitions
            or transitions[-1].after_digest != g['frame_digest']
            or any(a.after_digest != b.before_digest for a,b in zip(transitions,transitions[1:]))):
        return empty
    rows = tuple(r+(g['extent']-1)//2 for r in g['rows'])
    cols = tuple(c+(g['extent']-1)//2 for c in g['columns'])
    palette_values = {b[4] for b in g['row_support_boxes']+g['column_support_boxes']}
    initial_patches = transitions[0].before_uniform_square_patches
    initial_contours = contour_bindings(g,transitions[0].before_square_contours)
    recalled = bool(recalled_table)
    if initial_patches is None or (len(initial_contours) != 1 and not recalled):
        return empty
    contours = initial_contours
    if not contours and recalled:
        contours = next((bound for t in transitions
            for bound in (contour_bindings(g, t.before_square_contours),
                          contour_bindings(g, t.after_square_contours)) if len(bound) == 1), ())
    if len(contours) != 1:
        return empty
    ink = contours[0][2]
    initial_markers = tuple((r,c) for r,c,v in transitions[0].before_singleton_positions or ()
                            if r in rows and c in cols and v == ink)
    patches = tuple(p for p in initial_patches if p[0] in g['rows']
        and p[1] in g['columns'] and p[2] == g['extent'])
    if ((len(initial_markers) != 1 if initial_contours else len(initial_markers) != 0)
            or len(patches) != len(rows)*len(cols)
            or len({p[3] for p in patches}) != 1 or any(p[3] in palette_values for p in patches)
            or any(p[4] is not None and (p[4] != ink or
                (p[0]+(p[2]-1)//2,p[1]+(p[2]-1)//2) not in initial_markers) for p in patches)):
        return empty
    native = {ref:(dr,dc) for ref,dr,dc in interface_deltas}
    moves, scopes, command_axes, signs = {}, {}, {}, {'row':set(), 'column':set()}
    if recalled:
        reverse_axes = {name:axis for axis,name in sorted(dict(contract['axis_names']).items())}
        if (len(recalled_table) != 4 or len({r[0] for r in recalled_table}) != 4
                or any(ref not in native or axis not in reverse_axes or bit not in (0,1)
                       for ref,axis,bit in recalled_table)):
            return empty
        command_axes = {ref:{reverse_axes[axis]} for ref,axis,_ in recalled_table}
        for axis, sign in recalled_forward:
            if axis not in reverse_axes or sign not in (-1,1):
                return empty
            signs[reverse_axes[axis]].add(sign)
    for ordinal,t in enumerate(transitions):
        before = contour_bindings(g,t.before_square_contours)
        if len(before) != 1:
            continue
        scopes[ordinal] = before[0]
        if t.action_ref not in native:
            continue
        matches = []
        for _,r,c,h,w,dr,dc,area in t.small_component_translations:
            if area != 1 or r not in rows or c not in cols or bool(dr) == bool(dc):
                continue
            axis = 'row' if dc else 'column'
            index,slot = (rows.index(r),cols.index(c)) if dc else (cols.index(c),rows.index(r))
            if before[0][:2] == (axis,index):
                matches.append((axis,index,slot,int((dr or dc)>0)*2-1,r,c))
        if len(matches) == 1:
            move = matches[0]
            moves[ordinal] = move
            command_axes.setdefault(t.action_ref,set()).add(move[0])
            signs[move[0]].add(move[3])
    if any(len(v) != 1 for _,v in sorted(command_axes.items())) or any(len(signs[a]) != 1 for a in ('row','column')):
        return empty
    axis_inputs = {axis:tuple(ref for ref,axes in sorted(command_axes.items()) if axes == {axis})
                   for axis in ('row','column')}
    if any(len(axis_inputs[axis]) != 2 for axis in ('row','column')):
        return empty
    forward = {axis:next(iter(signs[axis])) for axis in ('row','column')}
    axis_names = dict(contract['axis_names'])
    models, commitments, tables = [], [], []
    max_refusals, max_occlusions = 0, 0
    parameter_tables = (tuple({ref:bit for ref,_,bit in recalled_table} for _ in (0,))
        if recalled else tuple({ref:bit for axis,flip in zip(('row','column'),flips)
            for ref,bit in zip(axis_inputs[axis],(flip,1-flip))}
            for flips in product((0,1),repeat=2)))
    for table in parameter_tables:
        material, colors = {}, {}
        background = {patches[0][3]} if recalled else set()
        valid, refusals, occlusions = True, 0, 0
        for ordinal,t in enumerate(transitions):
            before = scopes.get(ordinal)
            if before is not None:
                colors[before[:2]] = before[3]
            move = moves.get(ordinal)
            if move is not None:
                axis,index,slot,_,r,c = move
                key = (axis,index)
                prefix = material.setdefault(key,[])
                size = len(cols) if axis == 'row' else len(rows)
                expected = len(prefix) if forward[axis] > 0 else size-1-len(prefix)
                if slot != expected or not t.changed_cells_complete:
                    valid = False; break
                ri,ci = (index,slot) if axis == 'row' else (slot,index)
                other_key = ('column',ci) if axis == 'row' else ('row',ri)
                other = next((bit for cell,bit in material.get(other_key,()) if cell == index),None)
                bit = table[t.action_ref]
                if other is not None and other == bit:
                    valid = False; break
                cells = {(rr,cc):(a,b) for rr,cc,a,b in t.changed_cells}
                marker_values = tuple(v for rr,cc,v in t.before_singleton_positions or () if (rr,cc)==(r,c))
                center_after = cells[(r,c)][1] if (r,c) in cells else marker_values[0] if len(marker_values)==1 else None
                if other is not None and colors.get(other_key) is not None and colors[other_key] != before[3]:
                    if center_after not in (colors[other_key],before[3]):
                        valid = False; break
                    if bit != int(center_after == before[3]):
                        valid = False; break
                    occlusions += 1
                if other is None:
                    top,left = g['rows'][ri],g['columns'][ci]
                    background.update(a for rr,cc,a,_ in t.changed_cells
                        if top <= rr < top+g['extent'] and left <= cc < left+g['extent'] and (rr,cc)!=(r,c))
                prefix.append((slot,bit))
            elif before is not None and t.action_ref in table and t.changed_cells_complete:
                axis,index,ink,_ = before
                if command_axes[t.action_ref] == {axis}:
                    markers = tuple((r,c) for r,c,v in t.before_singleton_positions or ()
                        if v == ink and r in rows and c in cols
                        and (r == rows[index] if axis == 'row' else c == cols[index]))
                    grid_changes = sum(g['rows'][0] <= r < g['rows'][-1]+g['extent']
                        and g['columns'][0] <= c < g['columns'][-1]+g['extent'] for r,c,_,_ in t.changed_cells)
                    if len(markers) == 1 and grid_changes == 0:
                        r,c = markers[0]
                        ri,ci = rows.index(r),cols.index(c)
                        other_key = ('column',ci) if axis == 'row' else ('row',ri)
                        other_slot = ri if axis == 'row' else ci
                        other = next((bit for cell,bit in material.get(other_key,()) if cell == other_slot),None)
                        if other is None or table[t.action_ref] != other:
                            valid = False; break
                        refusals += 1
            after = contour_bindings(g,t.after_square_contours)
            if len(after) == 1:
                colors[after[0][:2]] = after[0][3]
        if not valid or len(background) != 1:
            continue
        if background != {patches[0][3]}:
            continue
        current_colors = {('row',i):v for i,v in enumerate(g['row_boundary_adjacent_values'])}
        current_colors.update({('column',i):v for i,v in enumerate(g['column_boundary_adjacent_values'])})
        if any(value not in palette_values for _,value in sorted(current_colors.items())):
            continue
        outlines = g['outline_support_intersections']
        masked = {(r,c) for r,c,v in g['singleton_positions'] if r in rows and c in cols
            and len(outlines) == 1 and v == outlines[0][5]
            and (r == rows[outlines[0][1]] if outlines[0][0]=='row' else c == cols[outlines[0][1]])}
        for ri,r in enumerate(rows):
            for ci,c in enumerate(cols):
                if (r,c) in masked:
                    continue
                parts = tuple((key,bit) for key,slot in ((('row',ri),ci),(('column',ci),ri))
                    for cell,bit in material.get(key,()) if cell == slot)
                upper = tuple(key for key,bit in parts if bit == 1)
                expected = (current_colors[upper[0]] if len(upper)==1 else current_colors[parts[0][0]]
                            if len(parts)==1 else patches[0][3] if not parts else None)
                if expected != g['cell_center_values'][ri][ci]:
                    valid = False
        if not valid:
            continue
        token = stable_digest((g['rows'],g['columns'],g['extent']))[:20]
        refs = {(axis,i):f'measurement:axial-line:{token}:{axis}:{i}'
                for axis,count in (('row',len(rows)),('column',len(cols))) for i in range(count)}
        thread_rows = []
        for (axis,index),ref in sorted(refs.items()):
            n = len(cols) if axis == 'row' else len(rows)
            indices = tuple(range(n)) if forward[axis] > 0 else tuple(reversed(range(n)))
            boxes = g['row_support_boxes'] if axis == 'row' else g['column_support_boxes']
            supports = tuple(b for b in boxes if b[0] == index)
            thread_rows.append(PrefixThread(thread_ref=ref,axis_ref=axis_names[axis],
                crossings=tuple((index,i) if axis == 'row' else (i,index) for i in indices),
                color_domain=tuple(sorted({b[4] for b in supports})),
                palette_support_refs=tuple('measurement:support-square:'+stable_digest(b[:4])[:20] for b in supports)))
        params = tuple((ref,axis_names[next(iter(command_axes[ref]))],table[ref]) for ref in sorted(table))
        model = PrefixModel(model_ref='measurement:prefix-model:'+stable_digest((token,params,g['homologous_raster_subgrids']))[:24],
            threads=tuple(thread_rows),target=FrameGrid(rows=g['homologous_raster_subgrids'][0]['values']),
            target_origin=(0,0),target_evidence_ref='measurement:subgrid:'+stable_digest(g['homologous_raster_subgrids'][0])[:24],
            topology_evidence_ref='measurement:axial-grid:'+token,layer_law_ref=contract['layer_law_ref'],
            direction_layers=tuple((axis,native[ref],bit) for ref,axis,bit in params),empty_value=next(iter(background)))
        models.append(model)
        commitments.append(tuple(PrefixCommitment(thread_ref=ref,layers=tuple(bit for _,bit in material.get(key,())))
                                 for key,ref in sorted(refs.items())))
        tables.append(params)
        max_refusals,max_occlusions = max(max_refusals,refusals),max(max_occlusions,occlusions)
    return {'models':tuple(models),'commitments':tuple(commitments),'parameter_tables':tuple(tables),
            'refusal_count':max_refusals,'occlusion_order_count':max_occlusions,
            'cause':'finite_declared_parameter_domain'}
