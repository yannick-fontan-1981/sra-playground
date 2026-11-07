"""Assembly/transport of Source-scoped finite actuator calculations.

The caller supplies the selected member, control, measured axis and declared
model scope. No operator or target is ranked here; all finite assignments and
measured cells are returned for Source assessment. Unknown coefficients stay None.
"""
from ..logos.types import FrozenMap, stable_digest, thaw_json
from .bounded_joystick import (BoundedJoystickRequest,
    JoystickModel, JoystickOccurrence, JoystickPad, JoystickSetting,
    JoystickSlot, JoystickState, JoystickTarget, measure_bounded_joystick)
from .mechanical_family_contracts_d import DMechanicalScope


def axis_inverse_rows(*, contract, observation_ref, epoch, assumption_refs,
                      layout, before_population, current_population,
                      member_index, pad, before_marker, current_marker):
    """Exact fit, restricted preimages, relative assignment and input binding."""
    drs=current_marker[0]-before_marker[0]
    dcs=current_marker[1]-before_marker[1]
    if bool(drs)==bool(dcs) or len(before_population)!=len(current_population):
        return (), {'axis_sample_single':False}
    before=before_population[member_index];now=current_population[member_index]
    drow,dcol=now[1]-before[1],now[2]-before[2]
    step=drs or dcs
    if not (drow or dcol) or drow%step or dcol%step:
        return (), {'axis_sample_integral_nonzero':False}
    if any(a!=b for i,(a,b) in enumerate(zip(before_population,current_population)) if i!=member_index):
        return (), {'other_members_preserved':False}
    refs=tuple('measurement.setting_member.'+stable_digest((layout['geometry_token'],i))
               for i in range(len(current_population)))
    pad_ref='measurement.setting_cell_group.'+stable_digest(pad['box'])
    gains=(drow//step,None,dcol//step,None) if drs else (None,drow//step,None,dcol//step)
    # Only the measured setting axis is varied. Every other axis stays at its
    # CURRENT value; no zero coefficient or neutral/reset assumption is added.
    rd=tuple(range(pad['height'])) if drs else (current_marker[0],)
    cd=tuple(range(pad['width'])) if dcs else (current_marker[1],)
    model=JoystickModel(model_ref=contract['model_ref'],height=layout['height'],width=layout['width'],
        displacement_law=contract['displacement_law'],crossing_count_law=None,
        stacking_allowed=None,draw_order_law=None,nudge_bound_law=None,nudge_cost=None,wrap_cost=None,
        pad_gains=((pad_ref,gains),))
    def state(population,marker):
        bodies=tuple(JoystickOccurrence(occurrence_ref=ref,color_ref=str(v[0]),row=v[1],column=v[2])
                     for ref,v in zip(refs,population))
        return JoystickState(occurrences=bodies,pads=(JoystickPad(pad_ref=pad_ref,
            occurrence_ref=refs[member_index],enabled=True,row_setting=marker[0],column_setting=marker[1],
            row_domain=rd,column_domain=cd),),active_occurrence_ref=refs[member_index],
            active_pad_ref=pad_ref,draw_order=refs)
    previous=state(before_population,before_marker);current=state(current_population,current_marker)
    scope=DMechanicalScope(request_ref='measurement.setting_query.'+stable_digest((observation_ref,pad_ref)),
        caller_ref=contract['caller_ref'],parent_consumer_ref=contract['parent_consumer_ref'],
        parent_goal_ref=contract['parent_goal_ref'],parent_contribution_ref=contract['parent_contribution_ref'],
        caller_next_item_ref=contract['caller_next_item_ref'],epoch=epoch,
        evidence_revision_ref=observation_ref,model_revision_ref=observation_ref,
        model_status_ref=contract['model_status_ref'],event_owner_ref=contract['event_owner_ref'],
        input_domain_complete=True,assumption_refs=tuple(assumption_refs))
    records=[]
    def calculate(operation_key,**kwargs):
        spec=contract[operation_key]
        request=BoundedJoystickRequest(scope=scope,operation_ref=spec['operation_ref'],mode_ref=spec['mode_ref'],
            requested_result_type='DMechanicalResult',node_bound=contract['node_bound'],
            depth_bound=contract['depth_bound'],domain_bound=contract['domain_bound'],
            time_bound_ms=contract['time_bound_ms'],models=(model,),state=current,**kwargs)
        result=measure_bounded_joystick(request)
        records.append({'operation_ref':result.operation_ref,'mode_ref':result.mode_ref,
            'status':result.status,'cause':result.cause,'domain_complete':result.domain_complete,
            'values':thaw_json(result.values)})
        if result.status!='COMPLETE' or not result.domain_complete:
            return None
        rows=result.values.get('model_correlated_results',())
        return rows[0]['result'] if len(rows)==1 else None
    sample=FrozenMap({'sealed':True,'before_state':previous.model_dump(),
        'after_state':current.model_dump(),'settings':(JoystickSetting(pad_ref=pad_ref,
         row=current_marker[0],column=current_marker[1]).model_dump(),),'wrap_counter_delta':None})
    fit=calculate('fit',observations=(sample,))
    base={'axis_gain_matrix':gains,'row_domain':rd,'column_domain':cd,'mechanical_calls':records,
          'other_members_preserved':True,'scope_full_actuator_domain_claimed':False}
    if fit is None or not all(r['positions_match'] and r['settings_match'] for r in fit['observed_domain_fit']):
        return (),base
    preimages=calculate('preimages',occurrence_ref=refs[member_index])
    if preimages is None:
        return (),base
    # Arithmetic modulo is never used here as evidence of a physical wrapping
    # law. Reject the query if ANY candidate leaves the observed rectangle.
    traces=tuple(t for row in preimages['preimages'] for t in row['delta_trace'])
    no_crossing=all(0<=t['unwrapped_endpoint'][0]<model.height and
                    0<=t['unwrapped_endpoint'][1]<model.width for t in traces)
    other_positions={(v[1],v[2])for i,v in enumerate(current_population)if i!=member_index}
    no_overlap=all(tuple(item['position'])not in other_positions for item in preimages['preimages'])
    base['restricted_domain_has_no_boundary_crossing']=no_crossing
    base['restricted_domain_has_no_overlap']=no_overlap
    if not no_crossing or not no_overlap:
        return (),base
    pattern=layout['small_pattern'];slots=tuple((r,c,value) for r,line in enumerate(pattern)
                                               for c,value in enumerate(line) if value is not None)
    # The caller's Source scope preserves every other member as a contributor.
    # Keep all corresponding pattern translations, not just the first one.
    fixed=tuple(v for i,v in enumerate(current_population) if i!=member_index)
    origins={(body[1]-r,body[2]-c) for body in fixed for r,c,value in slots if value==body[0]}
    targets=[]
    for ro,co in sorted(origins):
        proposed={(ro+r,co+c,value) for r,c,value in slots}
        if not all((v[1],v[2],v[0]) in proposed for v in fixed):
            continue
        if not all(0<=r<model.height and 0<=c<model.width for r,c,v in proposed):
            continue
        token='measurement.relative_slots.'+stable_digest((layout['geometry_token'],ro,co))
        targets.append(JoystickTarget(target_ref=token,translation=(ro,co),full_population_required=True,
            slots=tuple(JoystickSlot(slot_ref=token+'.'+str(i),color_ref=str(value),row=ro+r,column=co+c)
                        for i,(r,c,value) in enumerate(slots))))
    if not targets or len(targets)>contract['domain_bound']:
        return (),base
    assignment=calculate('assignments',targets=tuple(targets))
    if assignment is None:
        return (),base
    outputs=[]
    for witness in assignment['assignments']:
        members=tuple(v for v in witness['members'] if v['occurrence_ref']==refs[member_index])
        if len(members)!=1:
            continue
        changed=members[0]['preimage']['changed_settings']
        if len(changed)!=1:
            continue
        setting=JoystickSetting.model_validate(thaw_json(changed[0]))
        cells=tuple(cell for cell in pad['cells'] if cell['row_index']==setting.row
                    and cell['column_index']==setting.column)
        if len(cells)!=1:
            continue
        outputs.append({'assignment':thaw_json(witness),'setting':setting.model_dump(),
            'point':cells[0]['point'],'row_domain':rd,'column_domain':cd})
        if len(outputs)>contract['maximum_bindings']:
            return (),{**base,'binding_domain_overflow':True}
    return tuple(outputs),base
