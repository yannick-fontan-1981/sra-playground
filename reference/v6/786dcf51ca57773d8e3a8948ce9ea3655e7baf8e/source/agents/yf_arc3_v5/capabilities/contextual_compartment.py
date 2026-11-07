"""Current frame descriptions for Source-owned contextual compartment experiments."""
from collections import Counter
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .contracts import InteractionProbeInput, InteractionProbeAgenda, ComponentExtractionInput
from .components import detect_components
from .compartment_frame_geometry import measure_parallel_frame_groups, crop_counts, _turn_box, _turn_point, _turned_rows
from .agenda_measurement_transport import append_candidate_measurements

POINT_ACTION_REF = "ACTION6"


class CompartmentObservation(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.CompartmentObservation.v1"
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda
    prior_model_rows: tuple[FrozenMap, ...] = Field(default=(), max_length=4)
    enumerate_current: bool = True


class CompartmentProposal(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.CompartmentProposal.v1"
    request: InteractionProbeInput
    agenda: InteractionProbeAgenda
    model: FrozenMap
    prior_model_present: bool
    facts: FrozenMap
    measurement_ref: Ref


class CompartmentDescriptionRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.CompartmentDescriptionRequest.v1"
    proposal: CompartmentProposal
    source_disposition_ref: Ref
    source_alternative_facts: FrozenMap


class CompartmentDescriptions(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.CompartmentDescriptions.v1"
    proposal: CompartmentProposal
    alternative_refs: tuple[Ref, ...]
    rows: FrozenMap
    facts: FrozenMap
    evidence_refs: tuple[Ref, ...]


class CompartmentAdmission(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.CompartmentAdmission.v1"
    calculation: CompartmentDescriptions
    source_description_ref: Ref
    source_alternative_facts: FrozenMap


def _outline(frame, box):
    top,left,bottom,right=box
    if not (0<=top<bottom<frame.height and 0<=left<right<frame.width):
        return None
    rows=frame.rows; border=rows[top][left]; stripes=[]
    if not (all(v==border for v in rows[top][left:right+1]) and all(v==border for v in rows[bottom][left:right+1])):
        return None
    for y in range(top+1,bottom):
        row=rows[y][left:right+1]
        if row[0]==row[-1]==border:
            if len(set(row))==1:stripes.append(y)
            continue
        if len(set(row))!=1:return None
        stripes.append(y)
    return border,tuple(stripes)


def _snapshot(frame, layout, background, *, oriented=None):
    members=tuple(tuple(q) for q in layout['equal_frame_group'])
    adjacent=tuple(layout['adjacent_frame']); parallel=tuple(layout['parallel_frame'])
    turn=layout['description_quarter_turn']
    if oriented is None:
        rows=_turned_rows(frame,turn)
        local_frame=frame.model_copy(update={'rows':rows})
    else:
        rows,local_frame=oriented
    local=lambda q:_turn_box(q,frame.height,frame.width,turn)
    outlines=tuple(_outline(local_frame,local(b)) for b in (*members,adjacent,parallel))
    if any(r is None or r[0]==background for r in outlines):return None
    contents=tuple(crop_counts(frame,b) for b in members)
    if any(len(c)!=1 for c in contents):return None
    values=tuple(c[0][0] for c in contents)
    border,stripes=outlines[-1]
    t,l,b,r=local(parallel)
    counts=Counter(rows[y][x] for y in range(t+1,b) if y not in stripes for x in range(l+1,r))
    foreign=tuple(sorted(v for v,n in counts.items() if n and v not in (background,border)))
    hints=[];hint_positions=[]
    for member,value in zip(members,values):
        q=_turn_box(member,frame.height,frame.width,turn)
        y=(q[0]+q[2])//2;x=q[1]-1
        hints.append(rows[y][x] if x>=0 and rows[y][x]!=background else None)
        hint_positions.append(_turn_point((y,x),len(rows),len(rows[0]),(4-turn)%4) if x>=0 else None)
    return {'member_values':values,'outside_values':tuple(hints),'outside_positions':tuple(hint_positions),'parallel_foreign_values':foreign,
        'adjacent_counts':crop_counts(frame,adjacent),'parallel_counts':tuple(sorted(counts.items()))}


def _snapshots(frame, layouts, background):
    # A frame has at most four orientations. Keep them only for this scan;
    # current and previous observations never share an orientation cache.
    orientations={}
    for layout in layouts:
        turn=layout['description_quarter_turn']
        if turn not in orientations:
            rows=_turned_rows(frame,turn)
            orientations[turn]=(rows,frame.model_copy(update={'rows':rows}))
        yield _snapshot(frame,layout,background,oriented=orientations[turn])


def measure_contextual_compartment(value: CompartmentObservation) -> CompartmentProposal:
    v=value.request;cfg=v.route_generation_policy.get('contextual_compartment_measurement_contract',{})
    agenda=append_candidate_measurements(value.agenda,FrozenMap(),FrozenMap({'contextual_compartment_active':False}))
    facts={'scope_counter':str(v.observed_level_index),'compartment_geometry_complete':False,
        'compartment_current_model_fits':False,'compartment_point_available':POINT_ACTION_REF in v.available_action_refs,
        'committed_plan_present':bool(agenda.context_facts.get('committed_plan_present'))}
    args={'request':v,'agenda':agenda,'model':FrozenMap(),'prior_model_present':False,'facts':FrozenMap(facts),
        'measurement_ref':'measurement.contextual_compartment.'+stable_digest((v.current_observation_ref,v.observed_level_index))}
    if not value.enumerate_current or cfg.get('retain_loci') is not True or len(value.prior_model_rows)>1:
        return CompartmentProposal(**args)
    frame=v.current_observed_frame or v.frame
    modes=Counter(x for row in frame.rows for x in row).most_common(2)
    if not modes or len(modes)>1 and modes[0][1]==modes[1][1]:return CompartmentProposal(**args)
    background=modes[0][0]
    if value.prior_model_rows:
        model=value.prior_model_rows[0]['model'];complete=True
    else:
        layouts,complete,work=measure_parallel_frame_groups(frame,cfg)
        model=FrozenMap({'layouts':layouts,'background_value':background,'frame_shape':(frame.height,frame.width)})
        facts['geometry_work_count']=work
    layouts=model['layouts']
    fits=bool(layouts) and tuple(model['frame_shape'])==(frame.height,frame.width) and model['background_value']==background
    fits=fits and all(snapshot is not None for snapshot in _snapshots(frame,layouts,background))
    facts.update({'compartment_geometry_complete':complete,'compartment_current_model_fits':fits,
        'compartment_layout_count':len(layouts)})
    args.update({'model':model,'prior_model_present':bool(value.prior_model_rows),'facts':FrozenMap(facts)})
    return CompartmentProposal(**args)


def describe_contextual_compartment(value: CompartmentDescriptionRequest) -> CompartmentDescriptions:
    if value.source_alternative_facts[value.source_disposition_ref].get('compartment_scope_admitted') is not True:
        raise ValueError('Source has not admitted a current conditional compartment description')
    p=value.proposal;v=p.request;frame=v.current_observed_frame or v.frame;bg=p.model['background_value']
    layouts=p.model['layouts'];current=tuple(_snapshots(frame,layouts,bg))
    previous_frame=v.previous_action_observed_frame
    if previous_frame is None:
        prior=(None,)*len(layouts)
    elif previous_frame.rows==frame.rows:
        prior=current
    else:
        prior=tuple(_snapshots(previous_frame,layouts,bg))
    descriptions=[]
    cfg=v.route_generation_policy.get('contextual_compartment_measurement_contract',{})
    component_at={};patches={};matching_parts={}
    if cfg.get('measure_connected_source_patches') is True:
        from .interaction import _deep_axis_clearance_witness
        full_components=detect_components(ComponentExtractionInput(frame=frame,connectivity=4)).components
        component_at={point:component for component in full_components for point in component.pixels}
    for i,(layout,state,old) in enumerate(zip(layouts,current,prior)):
        if state is None:continue
        values=state['member_values'];populated=tuple(x!=bg for x in values)
        active_box=tuple(layout['adjacent_frame']);t,l,b,r=active_box
        previous_contact=v.last_point_position is not None and any(q[0]<=v.last_point_position[0]<=q[2] and q[1]<=v.last_point_position[1]<=q[3] for q in (*layout['equal_frame_group'],layout['adjacent_frame'],layout['parallel_frame']))
        common={'layout_index':i,'member_values':values,'parallel_values':state['parallel_foreign_values'],
            'all_members_populated':all(populated),'all_members_unpopulated':not any(populated),
            'previous_contact_in_bound_group':previous_contact,'previous_snapshot_present':old is not None,
            'adjacent_pattern_changed':old is not None and old['adjacent_counts']!=state['adjacent_counts'],
            'parallel_previously_unfilled':old is not None and not old['parallel_foreign_values'],
            'adjacent_has_non_background_interior':any(x!=bg and n for x,n in state['adjacent_counts'])}
        for j,origin in enumerate(current):
            if i==j or origin is None or len(origin['parallel_foreign_values'])!=1:continue
            pigment=origin['parallel_foreign_values'][0]
            missing=tuple(k for k,(a,hint) in enumerate(zip(populated,state['outside_values'])) if not a and hint==pigment)
            if missing:
                descriptions.append({**common,'description_kind':'parallel_matches_missing_outside_value',
                    'point_box':layouts[j]['parallel_frame'],'origin_layout_index':j,'matched_member_indices':missing})
                origin_boxes=(*layouts[j]['equal_frame_group'],layouts[j]['adjacent_frame'],layouts[j]['parallel_frame'])
                known_contact=any(any(box[0]<=y<=box[2] and box[1]<=x<=box[3] for box in origin_boxes)
                    for _ref,y,x in v.known_effectful_point_loci)
                descriptions.append({**common,'description_kind':'known_group_has_matching_parallel_content',
                    'point_box':layouts[j]['adjacent_frame'],'origin_layout_index':j,'matched_member_indices':missing,
                    'origin_group_contains_known_effectful_point':known_contact,
                    'parallel_content_area':sum(n for value,n in origin['parallel_counts'] if value in origin['parallel_foreign_values'])})
        for k,(filled,hint,position) in enumerate(zip(populated,state['outside_values'],state['outside_positions'])):
            if filled or hint is None or position not in component_at:
                continue
            ribbon=component_at[position]
            if ribbon.component_id not in matching_parts:
                parts={ribbon.component_id:ribbon}
                if cfg.get('bridge_single_pixel_hint_separators') is True:
                    for y,x in ribbon.pixels:
                        for dy,dx in ((-1,0),(1,0),(0,-1),(0,1)):
                            middle=component_at.get((y+dy,x+dx));beyond=component_at.get((y+2*dy,x+2*dx))
                            if (middle is not None and beyond is not None
                                    and middle.value not in (bg,hint) and beyond.value==hint):
                                parts[beyond.component_id]=beyond
                matching_parts[ribbon.component_id]=tuple(parts.values())
            for component in matching_parts[ribbon.component_id]:
                if component.component_id not in patches:
                    point,horizontal,vertical=_deep_axis_clearance_witness(component)
                    outside_groups=all(not (box[0]<=point[0]<=box[2] and box[1]<=point[1]<=box[3])
                        for group in layouts for box in (*group['equal_frame_group'],group['adjacent_frame'],group['parallel_frame']))
                    patches[component.component_id]=(point,min(horizontal,vertical),outside_groups)
                point,clearance,outside_groups=patches[component.component_id]
                descriptions.append({**common,'description_kind':'connected_patch_matches_missing_outside_value',
                    'point':point,'source_component_ref':component.component_id,'matched_member_indices':(k,),
                    'hint_component_ref':ribbon.component_id,'single_pixel_separator_crossed':component.component_id!=ribbon.component_id,
                    'connected_patch_clearance':clearance,'connected_patch_area':component.area,
                    'connected_patch_outside_groups':outside_groups})
        if all(populated) and not state['parallel_foreign_values']:
            descriptions.append({**common,'description_kind':'jointly_populated_group_with_unfilled_parallel','point_box':active_box})
        if old and previous_contact and not any(populated) and not state['parallel_foreign_values'] and common['adjacent_pattern_changed'] and common['adjacent_has_non_background_interior']:
            descriptions.append({**common,'description_kind':'cleared_group_and_changed_adjacent_pattern','point_box':active_box})
        if old and previous_contact and state['parallel_foreign_values'] and not old['parallel_foreign_values']:
            descriptions.append({**common,'description_kind':'new_parallel_content_after_adjacent_contact','point_box':active_box})
    rows={};facts={};geometry_token=stable_digest(p.model);frame_token=stable_digest(v.current_observation_ref)
    model_token=stable_digest((p.model,v.observed_level_index))
    # One physical experiment can test several matching receiver hypotheses.
    # Retain every observation; never merge their material units or capacities.
    experiments={};experiment_order=[]
    for description in descriptions:
        if 'point' in description:
            point=tuple(description['point'])
        else:
            box=description['point_box'];point=((box[0]+box[2])//2,(box[1]+box[3])//2)
        key=(description['description_kind'],point)
        if key not in experiments:
            experiments[key]=[];experiment_order.append(key)
        experiments[key].append(description)
    kind_counts=Counter(kind for kind,point in experiment_order)
    for description_kind,point in experiment_order:
        observations=experiments[(description_kind,point)]
        measured=observations[0]
        description=(observations[0] if len(observations)==1 else
            {'description_kind':description_kind,'observations':tuple(observations)})
        token=stable_digest((description,v.current_observation_ref));ref='measurement.contextual_compartment.'+token
        rows[ref]={'description':description,'point':point}
        facts[ref]=FrozenMap({'description_kind':description_kind,'compartment_description_count':len(experiments),
            'compartment_description_kind_count':kind_counts[description_kind],
            'compartment_raw_description_count':len(descriptions),
            'compartment_connected_patch_clearance':measured.get('connected_patch_clearance',0),
            'compartment_connected_patch_area':measured.get('connected_patch_area',0),
            'compartment_connected_patch_outside_groups':measured.get('connected_patch_outside_groups',False),
            'compartment_origin_group_contains_known_effectful_point':measured.get('origin_group_contains_known_effectful_point',False),
            'compartment_parallel_content_area':measured.get('parallel_content_area',0),
            'compartment_point_row':point[0],'compartment_point_column':point[1],
            'compartment_description_unknown':False,'model':p.model,'level_index':v.observed_level_index,
            'scope_counter':str(v.observed_level_index),'geometry_token':geometry_token,'model_token':model_token,
            'measurement_ref':p.measurement_ref,'frame_ref':v.current_observation_ref,'frame_token':frame_token,
            'word_ref':ref,'word_token':token,'description':description,'point':point,'prior_model_present':p.prior_model_present})
    unknown='contextual_compartment.description_unknown'
    facts[unknown]=FrozenMap({'compartment_description_unknown':True})
    return CompartmentDescriptions(proposal=p,alternative_refs=tuple(sorted(facts)),rows=FrozenMap(rows),facts=FrozenMap(facts),evidence_refs=(v.current_observation_ref,))


def append_contextual_compartment(value: CompartmentAdmission) -> InteractionProbeAgenda:
    q=value.calculation;declared=value.source_alternative_facts[value.source_description_ref]
    if declared.get('compartment_description_admitted') is not True or value.source_description_ref not in q.rows:
        raise ValueError('Source has not admitted the current contextual experiment')
    if declared.get('compartment_candidate_scope') != 'current_admitted_point':
        raise ValueError('Source has not declared the current compartment point scope')
    p=q.proposal;point=tuple(q.rows[value.source_description_ref]['point'])
    from .interaction import _point_candidates, _attach_current_open_cavity_measurements
    from .open_cavity import measure_open_cavity_stop_geometry
    # Geometry describes the complete observed raster, while the transported
    # scene may contain only changed components. Measure the admitted input
    # freshly on that same raster; an existing candidate's sparse delta is
    # not a complete current point witness for the compact controller.
    frame=p.request.current_observed_frame or p.request.frame
    point_request=p.request.model_copy(update={'frame':frame,
        'components':detect_components(ComponentExtractionInput(frame=frame,connectivity=4))})
    added=_point_candidates(point_request,frozenset(p.request.current_context_no_effect_candidate_refs),
        frozenset(p.request.tested_candidate_refs_without_resolution_plan),dict(p.agenda.context_facts),{},{},{},requested_points=(point,))
    candidates={};facts={};deltas={}
    for c,measured in added:
        # The ordinary producer also describes remembered effectful loci.
        # They remain measurements, outside this Source-admitted input scope.
        if c.action_ref!=POINT_ACTION_REF or c.point!=point:
            continue
        candidates[c.candidate_ref]=c
        facts[c.candidate_ref]=FrozenMap.overlay(measured,p.agenda.context_facts)
        deltas[c.candidate_ref]=measured
    ordered=tuple(candidates[k] for k in sorted(candidates))
    if len(ordered)>64:raise ValueError('compartment witness exceeds the declared agenda bound')
    extended=p.agenda.model_copy(update={'candidates':ordered,'alternative_refs':tuple(c.candidate_ref for c in ordered),
        'alternative_facts':FrozenMap(facts),'descriptive_delta_facts':FrozenMap(deltas),'has_candidates':bool(ordered)})
    measurements={c.candidate_ref:FrozenMap({'contextual_compartment_current_point':c.point==point,
        **{key:declared[key] for key in ('compartment_model_term_ref','compartment_model_claim_ref','compartment_witness_claim_ref',
            'compartment_premise_claim_refs','compartment_expectation_ref','compartment_experiment_ref','scope_counter','frame_ref','model_token','description_kind','compartment_question_ref','compartment_expected_relation_ref','compartment_falsifier_refs')}})
        for c in extended.candidates}
    annotated=append_candidate_measurements(extended,FrozenMap(measurements),FrozenMap({'contextual_compartment_active':True}))
    return _attach_current_open_cavity_measurements(annotated,FrozenMap(measure_open_cavity_stop_geometry(p.request)))
