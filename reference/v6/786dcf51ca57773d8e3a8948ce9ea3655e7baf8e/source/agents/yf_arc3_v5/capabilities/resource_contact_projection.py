"""Geometry adapter for a DRM-requested conditional product-graph calculation."""
from agents.yf_arc3_v5.capabilities.resource_contact_word import (
    ContactWord, measure_contact_words, measure_oriented_contact_calibration_path)
from agents.yf_arc3_v5.capabilities.contracts import InteractionProbeCandidate
from agents.yf_arc3_v5.logos.types import FrozenMap


def annotate_resource_contact_words(value, agenda):
    profile = value.route_generation_policy.get('resource_contact_word_measurement', {})
    quantity=value.resource_contact_quantity_measurements
    calibrating = bool(not quantity and profile.get('initial_movement_calibration_on_complete_geometric_witness')
                       and value.resource_contact_calibration_measurements)
    if calibrating:
        quantity=value.resource_contact_calibration_measurements
    if not profile or not quantity:
        return agenda
    if (profile.get('required_transmitted_activity_ref')
            not in value.prior_context_transmitted_workflow_activity_refs):
        return agenda
    from agents.yf_arc3_v5.capabilities.interaction import (
        _action_quantized_route_grid_candidates, _mixed_cell_traversable_pattern_refs,
        _established_anchored_quarter_turns_by_action,
        _edge_adjacent_enclosed_or_supported_non_grid_component_refs)
    turns = set(_established_anchored_quarter_turns_by_action(value).values())
    if len(turns) != 1 or len(value.canonical_provisional_control_geometry_bboxes) != 1:
        return agenda
    grids = _action_quantized_route_grid_candidates(value)
    if len(grids) != 1:
        return agenda
    grid = grids[0]; frame = value.current_observed_frame or value.frame
    cells = {(cell.row, cell.col): cell for cell in grid.cells}
    control = value.canonical_provisional_control_geometry_bboxes[0]
    def containing(box):
        center = ((box[0]+box[2])//2, (box[1]+box[3])//2)
        return tuple(rc for rc, cell in sorted(cells.items())
                     if cell.bbox.top <= center[0] <= cell.bbox.bottom
                     and cell.bbox.left <= center[1] <= cell.bbox.right)
    def box(row, prefix):
        values = tuple(row.get(f'{prefix}_bbox_{side}')
                       for side in ('top','left','bottom','right'))
        return values if all(isinstance(x,int) for x in values) else ()
    def reduced(rect, factor):
        top,left,bottom,right = rect
        if (top<0 or left<0 or bottom>=len(frame.rows) or right>=len(frame.rows[0])
                or (bottom-top+1)%factor or (right-left+1)%factor):
            return ()
        result = []
        for r in range(top,bottom+1,factor):
            line = []
            for c in range(left,right+1,factor):
                values = {frame.rows[y][x] for y in range(r,r+factor)
                          for x in range(c,c+factor)}
                if len(values) != 1: return ()
                line.append(next(iter(values)))
            result.append(tuple(line))
        return tuple(result)
    def rotate(rows):
        return tuple(tuple(rows[len(rows)-1-r][c] for r in range(len(rows)))
                     for c in range(len(rows[0])))
    pair_rows = []
    correspondence_rows=(*value.canonical_correspondence_term_facts,
        *(value.resource_contact_correspondence_measurements
          if profile.get('retain_current_scoped_reference_carriers_for_full_pattern_remeasurement') else ()))
    for row in correspondence_rows:
        a,b = box(row,'first'),box(row,'second')
        fa,fb = int(row.get('first_isotropic_factor') or 0),int(row.get('second_isotropic_factor') or 0)
        if not a or not b or min(fa,fb)<=0 or fa==fb:
            continue
        # The declared scenario relates a cell-contained smaller carrier to a
        # larger out-of-walk-region carrier. It preserves *all* rendered values.
        small,large,fs,fl = (a,b,fa,fb) if fa<fb else (b,a,fb,fa)
        if small[2]-small[0]+1 > control.height or small[3]-small[1]+1 > control.width:
            continue
        target_nodes = containing(small)
        if len(target_nodes)!=1: continue
        target_mask, display_mask = reduced(small,fs),reduced(large,fl)
        if not target_mask or not display_mask or len({x for row in target_mask for x in row})<2:
            continue
        transformed = display_mask; offsets=[]
        for offset in range(4):
            if transformed == target_mask: offsets.append(offset)
            transformed = rotate(transformed)
        if len(offsets)!=1: continue
        entry=(target_nodes[0],large,offsets[0],str(row.get('term_ref') or ''),small,fs,fl)
        if entry[:3] not in [item[:3] for item in pair_rows]: pair_rows.append(entry)
    if len(pair_rows)!=1:
        return agenda
    target, display_box, offset, relation, small_box, small_factor, display_factor = pair_rows[0]
    reference_measurement=FrozenMap({
        'term_ref':relation,'first_isotropic_factor':small_factor,'second_isotropic_factor':display_factor,
        **{f'{prefix}_bbox_{side}':rect[index]
           for prefix,rect in (('first',small_box),('second',display_box))
           for index,side in enumerate(('top','left','bottom','right'))}})
    starts=containing((control.top,control.left,control.bottom,control.right))
    if len(starts)!=1: return agenda
    start=starts[0]
    floor_refs=_mixed_cell_traversable_pattern_refs(value,grid)
    excluded = tuple(tuple(box) for fact in value.canonical_interface_member_facts
                     if fact.get('excluded_from_spatial_destination') is True
                     for box in fact.get('member_bboxes',()) if len(box)==4)
    display_components=_edge_adjacent_enclosed_or_supported_non_grid_component_refs(value,grid_candidates=(grid,))
    excluded=(*excluded,display_box,
        *((component.bbox.top,component.bbox.left,component.bbox.bottom,component.bbox.right)
          for component in value.components.components
          if component.component_id in display_components))
    def intersects(cell,rect):
        return not (cell.bbox.bottom<rect[0] or cell.bbox.top>rect[2]
                    or cell.bbox.right<rect[1] or cell.bbox.left>rect[3])
    support={rc for rc,cell in sorted(cells.items()) if cell.pattern_ref in floor_refs
             and not any(intersects(cell,b) for b in excluded)}
    # A supplied target-decoration scenario must not turn the neighbouring
    # floor into blockers merely because the fixed frame overhangs its core.
    # Revalidate all exterior pixels; a real wall outside the decoration stays
    # blocked. Unknown pixels inside the overhang remain a conditional premise.
    uniform_values=frozenset(cell.palette_values[0] for cell in grid.cells
        if cell.pattern_ref in floor_refs and cell.palette_value_count==1)
    if profile.get('target_overlay_scenario') == 'bounded_enclosing_frame_with_uniform_traversable_exterior':
        containers=tuple(component.bbox for component in value.components.components
            if component.value not in uniform_values
            and component.bbox.top<=small_box[0] and component.bbox.left<=small_box[1]
            and component.bbox.bottom>=small_box[2] and component.bbox.right>=small_box[3]
            and component.bbox.height<=3*control.height and component.bbox.width<=3*control.width)
        for rc,cell in sorted(cells.items()):
            if rc==target or any(intersects(cell,b) for b in excluded): continue
            exterior=tuple(frame.rows[r][c] for r in range(cell.bbox.top,cell.bbox.bottom+1)
                for c in range(cell.bbox.left,cell.bbox.right+1)
                if not any(box.top<=r<=box.bottom and box.left<=c<=box.right for box in containers))
            if (containers and exterior and len(set(exterior))==1
                    and exterior[0] in uniform_values
                    and any(intersects(cell,(box.top,box.left,box.bottom,box.right)) for box in containers)):
                support.add(rc)
    palette=frozenset(quantity.get('palette_values',()))
    receipts=frozenset(rc for rc,cell in sorted(cells.items())
                       if cell.palette_value_count>1 and cell.pattern_occurrence_count<=8
                       and palette.intersection(cell.palette_values)
                       and not any(intersects(cell,b) for b in excluded))
    def interior_mark(cell):
        box=cell.bbox
        border={frame.rows[r][c] for r in range(box.top,box.bottom+1)
                for c in range(box.left,box.right+1)
                if r in (box.top,box.bottom) or c in (box.left,box.right)}
        return (len(border)==1 and next(iter(border)) in uniform_values
                and any(frame.rows[r][c] not in border
                    for r in range(box.top+1,box.bottom)
                    for c in range(box.left+1,box.right)))
    unmatched=set(rc for rc,cell in sorted(cells.items())
                    if rc not in receipts|{start,target}
                    and interior_mark(cell) and cell.pattern_occurrence_count<=3
                    and not any(intersects(cell,b) for b in excluded)
                    and not (abs(rc[0]-target[0])<=1 and abs(rc[1]-target[1])<=1))
    if profile.get('preserve_current_scoped_contact_carrier_under_control_overlay'):
        unmatched.update(rc for rc,cell in sorted(cells.items())
            if rc==start and any(cell.bbox==carrier and cell.bbox==control
                for carrier in value.resource_contact_carrier_measurements))
    unmatched=tuple(sorted(unmatched))
    if profile.get('contact_scenario') != 'unique_inset_mark_in_traversable_cell' or len(unmatched)!=1:
        return agenda
    support.update((start,target,*receipts,*unmatched))
    deltas={str(action):(0 if dr==0 else 1 if dr>0 else -1,
                         0 if dc==0 else 1 if dc>0 else -1)
            for action,dr,dc in value.interface_action_translation_deltas
            if action in value.available_action_refs and (dr==0)^(dc==0)}
    edges={rc:tuple((action,(rc[0]+dr,rc[1]+dc)) for action,(dr,dc) in sorted(deltas.items())
                    if (rc[0]+dr,rc[1]+dc) in support) for rc in sorted(support)}
    if calibrating:
        path,expanded,exhausted=measure_oriented_contact_calibration_path(
            edges=edges,start=start,accepting=frozenset({target}),
            entry_turns={unmatched[0]:next(iter(turns))},required_phase=offset,modulus=4,
            max_states=int(profile['max_expanded_states']),max_actions=int(profile['max_actions']))
        words=(ContactWord(path,(),None,frozenset()),) if path else ()
    else:
        words,expanded,exhausted=measure_contact_words(
            edges=edges,start=start,accepting=frozenset({target}),
            entry_turns={unmatched[0]:next(iter(turns))},receipts=receipts,
            initial_phase=0,modulus=4,required_phase=offset,
            reserves=(int(quantity.get('remaining_quotient') or 0),),
            receipt_floor=int(quantity.get('observed_quantity_quotient') or 0),cost=1,
            max_states=int(profile['max_expanded_states']),max_actions=int(profile['max_actions']),
            max_witnesses=3)
    shared={'resource_contact_word_count':len(words),
            'resource_contact_target_degree':len(edges.get(target,())),
            'resource_contact_word_expanded_states':expanded,
            'resource_contact_word_bound_reached':exhausted}
    facts_by_action={}
    for ordinal,word in enumerate(words):
        action=word.actions[0]
        # Preserve three global witnesses, then exact deterministic first word
        # per primitive; selecting between primitives remains a DRM operation.
        if action in facts_by_action: continue
        dr,dc=deltas[action]
        facts_by_action[action]={'resource_contact_word_present':not calibrating,
            'resource_contact_geometric_witness_present':True,
            'resource_contact_calibration_present':calibrating,
            'resource_contact_geometric_witness_actions':word.actions,
            'resource_contact_word_ref':f'measurement.contact_word:{grid.candidate_ref}:{ordinal}',
            'resource_contact_word_actions':(action,) if calibrating else word.actions,
            'resource_contact_word_length':1 if calibrating else len(word.actions),
            'resource_contact_word_events':word.events,
            'resource_contact_word_final_reserve':word.remaining,
            'resource_contact_word_required_turns':offset,
            'resource_contact_word_relation_ref':relation,
            'resource_contact_word_scope_ref':str(quantity.get('evidence_scope_ref') or ''),
            'resource_contact_word_source_claim_refs':tuple(quantity.get('source_claim_refs',())),
            'resource_contact_carrier_bbox_tuple':tuple(getattr(cells[unmatched[0]].bbox,side)
                for side in ('top','left','bottom','right')),
            'resource_contact_correspondence_measurement':reference_measurement,
            'resource_contact_grid_geometry':(grid.candidate_ref,grid.row_offset,grid.col_offset,
                grid.cell_height,grid.cell_width,grid.row_pitch,grid.col_pitch,
                grid.logical_rows,grid.logical_columns),
            'resource_contact_word_step_delta_row':dr*control.height,
            'resource_contact_word_step_delta_col':dc*control.width}
    candidates=list(agenda.candidates); alternatives=dict(agenda.alternative_facts)
    deltas_out=dict(agenda.descriptive_delta_facts)
    for action,facts in sorted(facts_by_action.items()):
        ref=f'probe:discrete:{action}'
        if ref not in alternatives:
            candidates.append(InteractionProbeCandidate(candidate_ref=ref,action_ref=action,
                basis_refs=(f'measurement.available_action:{action}',)))
        additions=FrozenMap({'interaction_measurement_kind':'discrete',
                             'is_directional_interface_action':True,**facts})
        alternatives[ref]=FrozenMap.overlay(additions,alternatives.get(ref,FrozenMap()))
        deltas_out[ref]=FrozenMap.overlay(additions,deltas_out.get(ref,FrozenMap()))
    return agenda.model_copy(update={'candidates':tuple(candidates),
        'alternative_refs':tuple(row.candidate_ref for row in candidates),
        'alternative_facts':FrozenMap(alternatives),
        'descriptive_delta_facts':FrozenMap(deltas_out),
        'context_facts':FrozenMap.overlay(FrozenMap(shared),agenda.context_facts),
        'has_candidates':bool(candidates)})
