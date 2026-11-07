"""Observed editing loci and cardinal preimages, with no chosen action.

DRM supplies the conditional interpretation, scope and priorities. The orbit
service is queried for a straight approach only; no sparse table is presented
as a complete physical course.
"""
from agents.yf_arc3_v5.logos.types import stable_digest
from .arc_center_frame_measurement_d import measure_arc_center_field,measure_cardinal_packet_samples,measure_cardinal_turn_relations
from .mechanical_family_contracts_d import DMechanicalScope
from .quantized_orbit_d import (OrbitPoseD,OrbitSampleD,OrbitTableD,OrbitPostD,OrbitWorldD,
    OrbitStateD,OrbitHeadingMaskD,OrbitRasterContactD,LateralOrbitEngagementRequestD,measure_lateral_orbit_engagement_d)


def _inside(point,box,padding=0):
    y,x=point;t,l,b,r=box
    return t-padding<=y<=b+padding and l-padding<=x<=r+padding


def _same_members(a,b):
    return tuple(sorted((p['shape_token'],tuple(p['center'])) for p in a))==tuple(sorted((p['shape_token'],tuple(p['center'])) for p in b))


def _destination_clear(frame,scene,post,point):
    others={(p['center'][0]+dy,p['center'][1]+dx) for p in scene['posts'] if p['shape_token']!=post['shape_token'] for dy,dx in p['mask']}
    body={(scene['body_center'][0]+dy,scene['body_center'][1]+dx) for dy,dx,_ in scene['body_mask']}
    t,l,b,r=scene['root_box']
    return all(t<point[0]+dy<b and l<point[1]+dx<r
        and frame.rows[point[0]+dy][point[1]+dx]!=scene['root_value']
        and (point[0]+dy,point[1]+dx) not in others|body for dy,dx in post['mask'])


def _lateral_points(frame,scene,post):
    u=scene['body_heading_vector'];y,x=scene['body_center'];py,px=scene['pitch_yx']
    distance=0
    while True:
        yy,xx=y+u[0]*distance,x+u[1]*distance
        if not (0<=yy<frame.height and 0<=xx<frame.width):return ()
        if frame.rows[yy][xx]==scene['root_value']:break
        distance+=1
    quantum=px if u[0]==0 else py
    forward=max(dy*u[0]+dx*u[1] for dy,dx,_ in scene['body_mask'])
    entry_distance=distance-quantum-forward
    if entry_distance<=0:return ()
    entry=(y+u[0]*entry_distance,x+u[1]*entry_distance)
    t,l,b,r=scene['root_box'];rows=[]
    for sign in (-1,1):
        normal=(u[1]*sign,-u[0]*sign)
        point=(entry[0]+normal[0]*quantum,entry[1]+normal[1]*quantum)
        if point[0]%py!=scene['center_phase_yx'][0] or point[1]%px!=scene['center_phase_yx'][1]:continue
        if not _destination_clear(frame,scene,post,point):continue
        clearance=min(point[0]-t,b-point[0]) if normal[0] else min(point[1]-l,r-point[1])
        rows.append({'point':point,'clearance':clearance,'entry':entry,'lateral_integer_candidate':quantum})
    return tuple(rows)


def _return_points(v,frame,scene,relation,post,token,contract):
    # Narrow inverse domain: opposite parallel cardinal lines separated by 2r.
    # Other topologies stay absent; the caller does not receive a false no-route proof.
    profile=contract['raster_contact_parameters']
    if profile['coordinate_scale']!=1 or profile['position_rounding']!='EXACT':return ()
    u=tuple(relation['outgoing_direction']);start=tuple(relation['exit']);radius=relation['radius_integer_candidate']
    marker=scene['marker_box'];root=scene['root_box'];py,px=scene['pitch_yx'];phase=scene['center_phase_yx']
    desired=((1,0) if marker[2]==root[2] else (-1,0) if marker[0]==root[0]
        else (0,1) if marker[3]==root[3] else (0,-1))
    if desired!=tuple(-d for d in u):return ()
    axis=0 if u[0]==0 else 1
    goal_line=(marker[0]+py//2) if axis==0 else (marker[1]+px//2)
    if abs(goal_line-start[axis])!=2*radius:return ()
    center_cross=(goal_line+start[axis])//2
    direction_axis=1-axis
    body_radius=max(max(abs(dy),abs(dx)) for dy,dx,_ in scene['body_mask'])
    rows=[]
    for along in range(phase[direction_axis],root[2 if direction_axis==0 else 3]+1,py if direction_axis==0 else px):
        point=(along,center_cross) if axis==1 else (center_cross,along)
        steps=sum((point[i]-start[i])*u[i] for i in (0,1))
        if steps<0 or not _destination_clear(frame,scene,post,point):continue
        # Conservative envelope of the proposed half-circle plus the full body
        # radius. It is a conditional geometry bound, not a learned fine table.
        low=[point[i]-radius-body_radius for i in (0,1)]
        high=[point[i]+radius+body_radius for i in (0,1)]
        if u[0]:
            if u[0]<0:high[0]=point[0]+body_radius
            else:low[0]=point[0]-body_radius
        else:
            if u[1]<0:high[1]=point[1]+body_radius
            else:low[1]=point[1]-body_radius
        if any(not(root[0]<y<root[2] and root[1]<x<root[3])
            or frame.rows[y][x]==scene['root_value'] for y in range(low[0],high[0]+1) for x in range(low[1],high[1]+1)):
            continue
        headings=(tuple(scene['body_heading_vector']),u,desired)
        refs=tuple('measurement.direction.'+stable_digest(d)[:12] for d in headings)
        if len(set(refs))!=3:continue
        masks=[]
        base=scene['body_mask'];base_u=scene['body_heading_vector']
        for d,ref in zip(headings[:2],refs[:2]):
            offsets=tuple((dy,dx) for dy,dx,_ in base);heading=base_u
            for _ in range(4):
                if heading==d:break
                offsets=tuple((dx,-dy) for dy,dx in offsets);heading=(heading[1],-heading[0])
            masks.append(OrbitHeadingMaskD(heading=ref,offsets=tuple((dx,dy) for dy,dx in offsets),
                evidence_ref=v.current_observation_frame_ref if d==base_u else relation['acquisition_frame_ref']))
        contact=OrbitRasterContactD(**dict(contract['raster_contact_parameters']),
            declared_heading_domain=refs[:2],heading_masks=tuple(masks),
            scale_evidence_ref=v.current_observation_frame_ref,quantization_evidence_ref=v.current_observation_frame_ref)
        identity='measurement.compact.'+post['shape_token']
        current_posts=tuple(OrbitPostD(identity_ref='measurement.compact.'+p['shape_token'],
            type_ref='measurement.type.'+p['shape_token'],center=tuple(reversed(point if p['shape_token']==post['shape_token'] else p['center'])),
            collision_offsets=tuple((dx,dy) for dy,dx in p['mask'])) for p in scene['posts'])
        entry_offset=(start[1]-point[1],0) if axis==1 else (0,start[0]-point[0])
        table=OrbitTableD(table_ref='measurement.conditional.opposite_tangent',post_type_ref='measurement.type.'+post['shape_token'],sign=1,
            samples=(OrbitSampleD(offset=entry_offset,heading=refs[1]),
                OrbitSampleD(offset=tuple(-n for n in entry_offset),heading=refs[2])),
            quantization_evidence_ref=v.current_observation_frame_ref)
        world=OrbitWorldD(posts=current_posts,tables=(table,),
            straight_increments=tuple((ref,tuple(reversed(d))) for ref,d in zip(refs,headings)),body_offsets=(),
            blocked_pixels=tuple((x,y) for y in range(root[0],root[2]+1) for x in range(root[1],root[3]+1) if frame.rows[y][x]==scene['root_value']),
            known_pixels=tuple((x,y) for y in range(root[0],root[2]+1) for x in range(root[1],root[3]+1)),
            event_priority=tuple(contract['event_priority']),post_order_known=False,cooldown_release_law='NOT_LATERAL',
            cooldown_distance_squared=0,opposite_tolerance_squared=0,opposite_conflict_supported=False,raster_contact=contact)
        scope=DMechanicalScope(**dict(contract['scope']),request_ref='measurement.arc_approach.'+stable_digest(point),
            evidence_revision_ref=v.current_observation_frame_ref,model_revision_ref=token,
            epoch=v.current_context_epoch,input_domain_complete=True)
        request=LateralOrbitEngagementRequestD(scope=scope,operation_ref=contract['approach_operation_ref'],
            mode_ref='PRECONDITION',requested_result_type='DMechanicalResult',phase_ref='READ_ONLY_PRE_ENGAGEMENT',
            query_scope='first_straight_event',state=OrbitStateD(pose=OrbitPoseD(position=tuple(reversed(start)),heading=refs[1]),
                active_arc=None,cooldown_ref=None,command_ref='measurement.arc_approach.'+token,substep_index=0),
            world=world,straight_interval_substeps=steps,**dict(contract['calculation_bounds']))
        result=measure_lateral_orbit_engagement_d(request)
        verdict=result.values.get('verdict',{});eligible=verdict.get('probe',{}).get('eligible',())
        if (not result.domain_complete or result.cause!='ENGAGEMENT' or len(eligible)!=1 or eligible[0][0]!=identity):continue
        rows.append({'point':point,'approach_distance':steps,'kernel_examined':result.examined_count,
            'kernel_request_digest':stable_digest(request),'declared_contact_version':contact.schema_version,
            'raster_contact_profile':contact.model_dump(),
            'cardinal_approach_request':{'inferred_tangent_exit':start,'direction':u,
                'interval_integer_steps':steps,'requested_point':point,'query_scope':request.query_scope,
                'operation_ref':request.operation_ref,'mode_ref':request.mode_ref,
                'model_status_ref':request.scope.model_status_ref,'assumption_refs':request.scope.assumption_refs},
            'physical_course_certified':False,'conditional_quarter_turns':2})
    return tuple(rows)


def measure_arc_center_loci(v,frame,components,contract):
    scene=measure_arc_center_field(frame,components,contract)
    if scene is None or not v.current_observation_frame_ref:return ()
    posts=scene['posts']
    if len({p['shape_token'] for p in posts})!=len(posts):return ()
    token=stable_digest((scene['pitch_yx'],scene['root_box'],scene['root_value'],scene['marker_box'],
        tuple(sorted((p['shape_token'],p['value']) for p in posts)),scene['body_mask'],scene['body_center'],contract))
    carried=v.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context') or {}
    prior=bool(carried.get('arc_center_geometry_token'));response=None
    if prior:
        if not (carried['arc_center_geometry_token']==token and carried['arc_center_context_epoch']==v.current_context_epoch
            and v.previous_action_observed_frame is not None
            and carried['arc_center_source_frame_digest']==stable_digest(v.previous_action_observed_frame.rows)):return ()
        old_posts=carried['arc_center_posts'];tag=carried.get('arc_center_locus_tag');typ=carried.get('arc_center_member_shape_token')
        same=tuple(p for p in posts if p['shape_token']==typ)
        if tag=='member':response=len(same)==1 and same[0]['four_corner_enclosure'] and _same_members(posts,old_posts)
        elif tag=='point':
            response=len(same)==1 and same[0]['center']==tuple(carried['point']) and all(
                p['center']==tuple(old['center']) for p,old in ((p,next(o for o in old_posts if o['shape_token']==p['shape_token'])) for p in posts) if p['shape_token']!=typ)
        else:response=_same_members(posts,old_posts) and len(v.latest_ordered_action_frames)>1
        if response is not True:return ()
    relations=tuple(carried.get('arc_center_turn_relations',())) if prior else ()
    if prior and carried.get('arc_center_locus_tag')=='launch':
        samples=measure_cardinal_packet_samples(v.latest_ordered_action_frames,scene,contract)
        fresh=tuple({**dict(r),'acquisition_frame_ref':v.current_observation_frame_ref,
            'acquisition_intent_ref':v.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_intent_ref'),
            'acquisition_epoch':v.current_context_epoch,
            'acquisition_packet_digest':stable_digest(v.latest_ordered_action_frames)}
            for r in measure_cardinal_turn_relations(scene,samples or ()))
        relations=tuple({stable_digest(r):r for r in (*relations,*fresh)}[key] for key in sorted({stable_digest(r) for r in (*relations,*fresh)}))
    fit=relations
    common={'arc_center_geometry_token':token,'arc_center_context_epoch':v.current_context_epoch,
        'arc_center_source_frame_ref':v.current_observation_frame_ref,'arc_center_source_frame_digest':stable_digest(frame.rows),
        'arc_center_geometry_complete':True,'arc_center_posts':posts,'arc_center_turn_relations':relations,
        'arc_center_fit_count':len(fit),'arc_center_prior_context_present':prior,'arc_center_previous_response_matches':response,
        'arc_center_prior_intent_ref':v.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_intent_ref'),
        'arc_center_prior_active_goal_ref':v.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_active_goal_ref'),
        'arc_center_body_mask':scene['body_mask'],'arc_center_body_center':scene['body_center'],
        'arc_center_marker_box':scene['marker_box'],'arc_center_incoming_route_remaining_step_count':v.incoming_declared_route_remaining_step_count}
    enclosed=tuple(p for p in posts if p['four_corner_enclosure'])
    if len(enclosed)>1:return ()
    rows=[]
    for p in posts:
        counts=p['row_counts'];asymmetric=counts!=tuple(reversed(counts))
        rows.append({**common,'action_ref':contract['point_action_ref'],'point':p['center'],'component_ref':p['component_ref'],
            'arc_center_locus_tag':'member','arc_center_member_shape_token':p['shape_token'],
            'arc_center_member_asymmetric':asymmetric,'arc_center_member_has_corners':p['four_corner_enclosure'],
            'arc_center_member_has_fit':any(r['shape_token']==p['shape_token'] for r in relations),
            'arc_center_enclosed_count':len(enclosed),'arc_center_unknown_member_count':sum(not any(r['shape_token']==q['shape_token'] for r in relations) for q in posts)})
    if not enclosed:return tuple(rows)
    p=enclosed[0]
    candidates=_lateral_points(frame,scene,p) if not fit else _return_points(v,frame,scene,fit[0],p,token,contract) if len(fit)==1 and p['shape_token']!=fit[0]['shape_token'] else ()
    for candidate in candidates:
        point=candidate['point'];hits=tuple(q for q in posts if _inside(point,q['box'],contract['click_mask_padding']))
        at=p['center']==point
        maximum=max(q.get('clearance',0) for q in candidates)
        minimum=min(q.get('approach_distance',0) for q in candidates)
        row={**common,**candidate,'component_ref':p['component_ref'],'arc_center_member_shape_token':p['shape_token'],
            'arc_center_member_has_corners':True,'arc_center_point_at_member':at,'arc_center_return_preimage':bool(fit),
            'arc_center_current_preimage_point_count':sum(q['point']==p['center'] for q in candidates),
            'arc_center_unique_maximum_clearance':candidate.get('clearance',0)==maximum and sum(q.get('clearance',0)==maximum for q in candidates)==1,
            'arc_center_minimum_approach_distance':candidate.get('approach_distance',0)==minimum,
            'arc_center_kernel_approach_bound':bool(fit),'arc_center_physical_course_certified':False}
        if not hits:
            rows.append({**row,'action_ref':contract['point_action_ref'],'arc_center_locus_tag':'point'})
        if at:
            rows.append({**row,'action_ref':contract['launch_action_ref'],'point':None,'arc_center_locus_tag':'launch'})
    return tuple(rows)
