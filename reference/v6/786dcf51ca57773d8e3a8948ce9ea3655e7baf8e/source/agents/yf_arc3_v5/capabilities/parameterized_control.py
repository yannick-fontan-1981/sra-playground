"""Source-owned relative-setting questions over exact current measurements.

This adapter enumerates descriptions and transports Source decisions. It never
chooses a body, control, operator or assignment and does not authorize action.
"""
from ..logos.types import FrozenMap, stable_digest, thaw_json
from .agenda_measurement_transport import append_candidate_measurements
from .homologous_interface import InterfaceObservation, InterfaceProposal, InterfaceAdmission
from .parameterized_control_geometry import (measure_enclosed_lattice_correspondences,
    measure_external_cell_groups)
from .parameterized_control_inverse import axis_inverse_rows
from .contracts import InteractionProbeAgenda, InteractionProbeInput


def retained_parameterized_scope(request: InteractionProbeInput) -> InterfaceProposal:
    """Empty measurement carrier; it asserts no scene role or continuation."""
    alignment = FrozenMap({
        'input_aligned_entity_bbox_count': len(request.input_aligned_entity_bboxes),
        'input_aligned_entity_bbox_tuples': tuple(
            (box.top, box.left, box.bottom, box.right)
            for box in request.input_aligned_entity_bboxes),
    })
    agenda = InteractionProbeAgenda(candidates=(), alternative_refs=(),
        alternative_facts=FrozenMap(), context_facts=alignment, has_candidates=False)
    return measure_parameterized_control(InterfaceObservation(
        request=request, agenda=agenda, enumerate_current=False))


def measure_retained_parameterized_control(value: InterfaceObservation) -> InterfaceProposal:
    """Re-measure an existing current population witness, never start a family."""
    request = value.request
    frame = request.current_observed_frame or request.frame
    before = request.previous_action_observed_frame
    current_hash = stable_digest(frame.rows)
    before_hash = stable_digest(before.rows) if before is not None else None
    cfg = request.route_generation_policy.get('parameterized_control_measurement_contract', {})
    eligible = any(
        row.get('snapshot', {}).get('population_program') is True
        and row['snapshot'].get('scope_counter') == str(request.observed_level_index)
        and (row['snapshot'].get('frame_hash') == current_hash
             or (before_hash is not None
                 and row['snapshot'].get('frame_hash') == before_hash
                 and request.retained_physical_transition_receipt is not None
                 and request.last_action_ref == cfg.get('point_action_ref')
                 and request.last_point_position == tuple(row['snapshot'].get('point', ()))))
        for row in value.prior_model_rows)
    if not eligible:
        return measure_parameterized_control(value.model_copy(
            update={'prior_model_rows': (), 'enumerate_current': False}))
    # Source declares the bounded measurement scope; use the ordinary complete
    # measurement producer, not a hand-maintained subset of its context schema.
    scope = cfg.get('retained_population_measurement_scope_ref')
    if scope != 'probe_scope.access_witness_only':
        raise ValueError('retained population has no declared bounded measurement scope')
    from .interaction import enumerate_interaction_probes
    measured = enumerate_interaction_probes(request.model_copy(update={
        'declared_point_candidate_scope_ref': scope}))
    return measure_parameterized_control(value.model_copy(update={'agenda': measured}))


def _population(layout):
    return tuple((c['base_value'],c['row'],c['column']) for c in layout['population'])


def _population_correspondence(previous, current, index):
    if len(previous)!=len(current):
        return None
    remaining=list(current);result=[]
    for i,member in enumerate(previous):
        if i==index:
            result.append(None)
        elif member in remaining:
            result.append(member);remaining.remove(member)
        else:
            return None
    if len(remaining)!=1 or remaining[0][0]!=previous[index][0]:
        return None
    result[index]=remaining[0]
    return tuple(result)


def _markers(layout, groups, member):
    cells=tuple(c for c in layout['population'] if (c['base_value'],c['row'],c['column'])==member)
    if len(cells)!=1 or len(cells[0]['interior_differences'])!=1:
        return None
    cell=cells[0];dy,dx,pigment=cell['interior_differences'][0]
    if (dy,dx)!=(layout['cell_height']//2,layout['cell_width']//2):
        return None
    positions=[]
    for group in groups:
        marked=tuple(c for c in group['cells'] if c['base_value']==member[0]
                     and c['interior_differences']==((group['cell_height']//2,group['cell_width']//2,pigment),))
        if len(marked)!=1:
            return None
        positions.append((marked[0]['row_index'],marked[0]['column_index']))
    return tuple(positions)


def _relative_equal(population,pattern):
    cells=tuple((r,c,v)for r,line in enumerate(pattern)for c,v in enumerate(line)if v is not None)
    if len(cells)!=len(population):
        return False
    images={(r,c,v)for v,r,c in population}
    origins={(pr-r,pc-c)for value,pr,pc in population for r,c,v in cells if value==v}
    return any({(ro+r,co+c,v)for r,c,v in cells}==images for ro,co in origins)


def _relative_offsets(population, pattern, member_index):
    cells=tuple((r,c,v)for r,line in enumerate(pattern)for c,v in enumerate(line)if v is not None)
    fixed=tuple(v for i,v in enumerate(population)if i!=member_index)
    member=population[member_index]
    origins={(body[1]-r,body[2]-c)for body in fixed for r,c,v in cells if body[0]==v}
    offsets=set()
    for ro,co in sorted(origins):
        image={(ro+r,co+c,v)for r,c,v in cells}
        if not all((body[1],body[2],body[0])in image for body in fixed):
            continue
        for r,c,v in cells:
            target=(ro+r,co+c,v)
            if v==member[0]and target not in {(b[1],b[2],b[0])for b in fixed}:
                offsets.add((target[0]-member[1],target[1]-member[2]))
    return tuple(sorted(offsets))


def _proposal(value,agenda,facts,rows,evidence):
    refs=tuple(sorted(rows))+('program.unknown',)
    return InterfaceProposal(request=value.request,agenda=agenda,facts=FrozenMap(facts),
        rows=FrozenMap(rows),evidence_refs=tuple(evidence),alternative_refs=refs,
        descriptive_facts=FrozenMap({**{key:FrozenMap(row)for key,row in sorted(rows.items())},
                                    'program.unknown':FrozenMap({'program_unknown':True})}))


def measure_parameterized_control(value:InterfaceObservation)->InterfaceProposal:
    v=value.request;cfg=v.route_generation_policy.get('parameterized_control_measurement_contract',{})
    agenda=append_candidate_measurements(value.agenda,FrozenMap(),FrozenMap({'parameterized_control_active':False}))
    scope=str(v.observed_level_index)
    current_frame = v.current_observed_frame or v.frame
    before_frame = v.previous_action_observed_frame
    frame_window = (stable_digest(current_frame.rows),)+((stable_digest(before_frame.rows),) if before_frame is not None else ())
    base={'scope_counter':scope,'program_geometry_complete':False,'program_unique_pair':False,
          'frame_digest_window':frame_window,
          'population_moved_count':0,'population_displacement_sum':0,'population_inverse_cost':0,
          'program_point_available':cfg.get('point_action_ref') in v.available_action_refs,
          'committed_plan_present':v.committed_plan_present,
          'incoming_declared_route_engagement_present':v.incoming_declared_route_engagement_present}
    if not cfg or not value.enumerate_current:
        return _proposal(value,agenda,base,{},())
    frame=v.current_observed_frame or v.frame
    layouts,components,complete=measure_enclosed_lattice_correspondences(frame,cfg)
    base.update(program_geometry_complete=complete,program_unique_pair=len(layouts)==1)
    if not complete or len(layouts)!=1:
        return _proposal(value,agenda,base,{},())
    layout,=layouts
    groups,complete=measure_external_cell_groups(frame,components,(layout['box'],layout['small_box']),cfg)
    base['program_external_groups_complete']=complete
    base['program_external_group_count']=len(groups)
    if not complete or len(groups)<cfg['minimum_external_groups']:
        return _proposal(value,agenda,base,{},())
    if cfg.get('population_contract') and any(v is None for line in layout['small_pattern'] for v in line):
        from .parameterized_population import measure_population
        return measure_population(value, agenda, base, layout, groups, cfg)
    frame_hash=stable_digest(frame.rows);before=v.previous_action_observed_frame
    before_hash=stable_digest(before.rows) if before else None
    priors=tuple(row for row in value.prior_model_rows
                 if row['snapshot']['scope_counter']==scope
                 and row['snapshot']['geometry_token']==layout['geometry_token'])
    same=tuple(row for row in priors if row['snapshot']['frame_hash']==frame_hash
               and row['snapshot']['frame_ref']==v.current_observation_ref)
    previous_frame=tuple(row for row in priors if row['snapshot']['frame_hash']==before_hash)
    previous_row=max(same or previous_frame,key=lambda row:row['snapshot']['generation']) if same or previous_frame else None
    previous=previous_row['snapshot'] if previous_row else None
    receipt=v.retained_physical_transition_receipt
    bound=bool(previous and not same and receipt and before
               and v.last_action_ref==cfg['point_action_ref']
               and v.last_point_position==tuple(previous['point']))
    population=_population(layout)
    if previous:
        population=_population_correspondence(tuple(tuple(x)for x in previous['population']),population,previous['member_index'])
        if population is None:
            return _proposal(value,agenda,base,{},())
    rows={};evidence=tuple(x for x in (v.current_observation_ref,
        receipt.checkpoint_ref if receipt else None,
        previous_row['witness_claim_ref'] if previous_row else None) if x is not None)
    compact={k:layout[k]for k in ('box','height','width','cell_height','cell_width','small_box','small_pattern','geometry_token')}
    generation=previous['generation']+int(not same) if previous else 1
    def add(kind,point,member_index,pad_index=-1,order=0,origin=None,selection=False,probe=False,axis=False,axis_support=False):
        snapshot={**compact,'scope_counter':scope,'population':population,'frame_hash':frame_hash,
            'frame_ref':v.current_observation_ref,'generation':generation,'kind':kind,'point':point,
            'member_index':member_index,'pad_index':pad_index,'group_boxes':tuple(g['box']for g in groups),
            'calibration_origin':origin}
        token=stable_digest(snapshot);ref='program.'+kind+'.'+token
        rows[ref]={**base,'kind':kind,'point':point,'action_ref':cfg['point_action_ref'],
            'member_order':member_index,'pad_order':pad_index,'direction_order':order,'assignment_order':0,
            'program_selection_ready':selection,'program_probe_ready':probe,'program_axis_ready':axis,
            'program_inverse_ready':False,'program_direction_axis_supported':axis_support,'program_full_relative_equal':_relative_equal(population,layout['small_pattern']),
            'snapshot':snapshot,'frame_ref':v.current_observation_ref,'witness_token':token,'scope_counter':scope}
    # A retained selection question is not an executed selection. If another
    # operator won before its click, re-enumerate current measured members;
    # never consume that proposal as though a bound physical response existed.
    if previous is None or previous['kind']=='selection' and (same or not bound):
        for index,member in enumerate(population):
            cells=tuple(c for c in layout['population']if (c['base_value'],c['row'],c['column'])==member)
            if len(cells)==1:
                add('selection',cells[0]['point'],index,selection=True)
    elif previous['kind'] in ('selection','probe'):
        index=previous['member_index'];markers=_markers(layout,groups,population[index])
        if markers is None or tuple(g['box']for g in groups)!=tuple(tuple(x)for x in previous['group_boxes']):
            return _proposal(value,agenda,base,{},evidence)
        selection_response=previous['kind']=='selection' and bound and population==tuple(tuple(x)for x in previous['population'])
        replay_probe=previous['kind']=='probe' and bool(same)
        if selection_response or replay_probe:
            origin=previous['calibration_origin'] if replay_probe else {'population':population,'markers':markers,'frame_ref':v.current_observation_ref}
            for pad_index,group in enumerate(groups):
                for order,(dr,dc) in enumerate(cfg['calibration_setting_deltas']):
                    rr,cc=markers[pad_index][0]+dr,markers[pad_index][1]+dc
                    cells=tuple(c for c in group['cells']if (c['row_index'],c['column_index'])==(rr,cc))
                    if len(cells)==1:
                        offsets=_relative_offsets(population,layout['small_pattern'],index)
                        support=any(bool(dr and rr)or bool(dc and cc)for rr,cc in offsets)
                        add('probe',cells[0]['point'],index,pad_index,order,origin=origin,probe=True,axis_support=support)
        elif previous['kind']=='probe' and bound:
            origin=previous['calibration_origin'];pi=previous['pad_index']
            marker_before=tuple(origin['markers'][pi]);marker_now=markers[pi]
            other_markers_fixed=all(tuple(a)==tuple(b)for j,(a,b)in enumerate(zip(origin['markers'],markers))if j!=pi)
            old_population=tuple(tuple(x)for x in origin['population'])
            changed=(marker_now[0]!=marker_before[0],marker_now[1]!=marker_before[1])
            moving=population[index]!=old_population[index]
            others_fixed=all(a==b for j,(a,b)in enumerate(zip(old_population,population))if j!=index)
            if sum(changed)==1 and moving and others_fixed and other_markers_fixed:
                add('axis',previous['point'],index,pi,origin=origin,axis=True)
    elif previous['kind']=='inverse' and same:
        token=stable_digest(previous);ref='program.inverse.'+token
        rows[ref]={**base,'kind':'inverse','point':previous['point'],'action_ref':cfg['point_action_ref'],
            'member_order':previous['member_index'],'pad_order':previous['pad_index'],
            'direction_order':0,'assignment_order':0,'program_selection_ready':False,
            'program_probe_ready':False,'program_axis_ready':False,'program_inverse_ready':True,
            'program_inverse_domain_complete':previous['axis_measurements']['restricted_domain_has_no_boundary_crossing'],
            'program_full_relative_equal':_relative_equal(population,layout['small_pattern']),
            'snapshot':previous,'frame_ref':v.current_observation_ref,'witness_token':token,'scope_counter':scope,
            'program_axis_model_parent_claim_ref':previous['axis_model_parent_claim_ref']}
    return _proposal(value,agenda,base,rows,evidence)


def calculate_admitted_parameterized_inverse(value:InterfaceAdmission)->InterfaceProposal:
    p=value.proposal;declared=value.source_alternative_facts[value.source_description_ref]
    if declared.get('program_population_model_admitted') is True:
        from .parameterized_population import calculate_population_inverse
        return calculate_population_inverse(value, declared)
    if (declared.get('program_axis_model_admitted') is not True
            or declared.get('program_fixed_other_members') is not True
            or declared.get('program_fixed_other_controls') is not True
            or declared.get('program_unobserved_axes_fixed_at_current') is not True
            or value.source_description_ref not in p.rows):
        raise ValueError('Current Source axis hypothesis admission is required before finite inverse calculation')
    row=p.rows[value.source_description_ref];snap=row['snapshot'];cfg=p.request.route_generation_policy['parameterized_control_measurement_contract']
    frame=p.request.current_observed_frame or p.request.frame
    layouts,components,complete=measure_enclosed_lattice_correspondences(frame,cfg)
    layouts=tuple(x for x in layouts if x['geometry_token']==snap['geometry_token'])
    if not complete or len(layouts)!=1:
        return _proposal(InterfaceObservation(request=p.request,agenda=p.agenda),p.agenda,p.facts,{},p.evidence_refs)
    layout,=layouts;groups,done=measure_external_cell_groups(frame,components,(layout['box'],layout['small_box']),cfg)
    index=snap['member_index'];pi=snap['pad_index'];population=tuple(tuple(v)for v in snap['population'])
    markers=_markers(layout,groups,population[index])
    if not done or markers is None or pi>=len(groups):
        return _proposal(InterfaceObservation(request=p.request,agenda=p.agenda),p.agenda,p.facts,{},p.evidence_refs)
    origin=snap['calibration_origin'];witness_ref=declared['program_witness_claim_ref']
    outputs,measured=axis_inverse_rows(contract=cfg['inverse_contract'],
        observation_ref=p.request.current_observation_ref,epoch=p.request.current_context_epoch,
        assumption_refs=tuple(p.evidence_refs)+(witness_ref,),layout=layout,
        before_population=tuple(tuple(x)for x in origin['population']),current_population=population,
        member_index=index,pad=groups[pi],before_marker=tuple(origin['markers'][pi]),current_marker=markers[pi])
    rows={}
    for order,output in enumerate(outputs):
        snapshot={**snap,'kind':'inverse','generation':snap['generation']+1,'point':output['point'],'inverse_witness':output,
                  'axis_measurements':measured,'axis_model_parent_claim_ref':witness_ref}
        token=stable_digest(snapshot);ref='program.inverse.'+token
        rows[ref]={**row,'kind':'inverse','point':output['point'],'snapshot':snapshot,'witness_token':token,
            'program_axis_ready':False,'program_inverse_ready':True,'assignment_order':order,
            'program_inverse_domain_complete':bool(measured.get('restricted_domain_has_no_boundary_crossing')),
            'program_axis_gain_matrix':measured.get('axis_gain_matrix'),
            'program_axis_model_parent_claim_ref':witness_ref}
    evidence=tuple(p.evidence_refs)+(witness_ref,)
    return _proposal(InterfaceObservation(request=p.request,agenda=p.agenda),p.agenda,p.facts,rows,evidence)


def append_parameterized_control(value:InterfaceAdmission):
    p=value.proposal;declared=value.source_alternative_facts[value.source_description_ref]
    if declared.get('program_description_admitted') is not True or value.source_description_ref not in p.rows:
        raise ValueError('Source has not admitted the current relative-setting question')
    row=p.rows[value.source_description_ref]
    from .interaction import _attach_current_open_cavity_measurements
    from .open_cavity import measure_open_cavity_stop_geometry
    from .current_point_admission import append_one_current_point
    agenda,point_admission=append_one_current_point(p.request,p.agenda,
        action_ref=row['action_ref'],point=row['point'])
    if not point_admission['point_available']:
        return append_candidate_measurements(agenda,FrozenMap(),FrozenMap({
            'parameterized_control_active':False,'parameterized_control_point_admission':point_admission}))
    ordered=agenda.candidates
    contribution={c.candidate_ref:FrozenMap({'parameterized_control_input_proposed':c.action_ref==row['action_ref'] and c.point==tuple(row['point']),
        'committed_plan_present':p.request.committed_plan_present,
        'incoming_declared_route_engagement_present':p.request.incoming_declared_route_engagement_present,
        'program_current_setting_change_measured':row.get('program_current_setting_change_measured',False),
        'program_witness_claim_refs':(declared['program_witness_claim_ref'],)+
            ((declared['program_axis_model_parent_claim_ref'],)if declared.get('program_axis_model_parent_claim_ref')else ()),'program_current_frame_ref':row['frame_ref'],
        'program_scope_counter':row['scope_counter'],'program_question_kind':row['kind'],
        **{key:declared[key]for key in ('program_witness_claim_ref','program_question_ref',
               'program_expected_relation_ref','program_falsifier_refs')}})for c in ordered}
    agenda=append_candidate_measurements(agenda,FrozenMap(contribution),FrozenMap({'parameterized_control_active':True,'parameterized_control_point_admission':point_admission}))
    return _attach_current_open_cavity_measurements(agenda,
        FrozenMap(measure_open_cavity_stop_geometry(p.request)))
