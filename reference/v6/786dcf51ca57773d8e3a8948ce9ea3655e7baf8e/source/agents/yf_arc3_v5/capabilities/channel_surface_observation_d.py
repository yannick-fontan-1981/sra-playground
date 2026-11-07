"""Bounded raster relations between homologous controls and boundary strips.

No palette roles, physics constants, selected action or semantic conclusion.
Every locus is returned; declarative callers decide which question is useful.
"""
from collections import deque
from agents.yf_arc3_v5.logos.types import stable_digest


def _box(c):
    b=c.bbox
    return (b.top,b.left,b.bottom,b.right)


def _inside(point,box):
    y,x=point;t,l,b,r=box
    return t<=y<=b and l<=x<=r


def _center(box):
    t,l,b,r=box
    return ((t+b)//2,(l+r)//2)


def measure_channel_surface_scene(frame,components,contract):
    if (not contract or frame.height*frame.width>contract['maximum_frame_pixels']
            or len(components)>contract['maximum_components']):return None
    large=[c for c in components if c.area*contract['minimum_field_area_divisor']>=frame.height*frame.width
        and c.bbox.width*2>=frame.width and c.bbox.height*2>=frame.height]
    if len(large)!=1:return None
    field=large[0];air=field.value;ft,fl,fb,fr=_box(field)
    patterns={}
    for c in components:
        b=c.bbox
        if not (1<b.height<b.width<=contract['maximum_control_width'] and b.bottom<ft
                and b.width*b.height>c.area>b.width):continue
        mask=tuple((y-b.top,x-b.left) for y in range(b.top,b.bottom+1)
            for x in range(b.left,b.right+1) if frame.rows[y][x]==c.value)
        patterns.setdefault((b.height,b.width,mask),[]).append(c)
    pairs=[tuple(cs) for cs in sorted(patterns.values(),key=lambda cs:tuple(_box(c) for c in sorted(cs,key=_box)))
        if len(cs)==2 and len({c.value for c in cs})==2]
    if len(pairs)!=1:return None
    controls=tuple(sorted(pairs[0],key=_box));tones={c.value for c in controls}
    strips=[]
    for c in components:
        t,l,b,r=_box(c)
        if not (contract['minimum_strip_length']<=b-t+1<=contract['maximum_strip_length']
                and r-l+1<=contract['maximum_strip_thickness'] and ft<=t<=b<=fb):continue
        columns=[(x,n) for x,n in ((fl-1,1),(fr+1,-1)) if l<=x<=r and 0<=x<frame.width]
        if len(columns)!=1:continue
        x,n=columns[0]
        values={frame.rows[y][x] for y in range(t,b+1)}
        if values!={c.value}:continue
        # A strip lies between a repeated exterior and the large interior.
        outside={frame.rows[y][x-n] for y in range(t,b+1) if 0<=x-n<frame.width}
        if len(outside)!=1 or air in outside:continue
        strips.append({'box':(t,x,b,x),'raster_extent':_box(c),'normal':(0,n),'value':c.value,
            'matches_control':c.value in tones,'component_ref':c.component_id})
    if (len(strips)!=2 or strips[0]['box'][0::2]!=strips[1]['box'][0::2]
            or strips[0]['normal']==strips[1]['normal']):return None
    strips.sort(key=lambda p:p['box'])
    dots=[c for c in components if c.area==1 and c.value in tones
        and _inside((c.bbox.top,c.bbox.left),_box(field))
        and not any(abs(c.bbox.left-p['box'][1])<=contract['maximum_strip_thickness'] for p in strips)]
    if len(dots)!=1:return None
    dot=dots[0];seed=(dot.bbox.top,dot.bbox.left)
    pixels=set()
    for c in components:
        if (c.value==air or c.area>contract['maximum_body_pixels'] or c.bbox.top<ft
                or max(c.bbox.height,c.bbox.width)>contract['maximum_body_component_extent']):continue
        if any(c.component_id==p['component_ref'] for p in strips):continue
        for y in range(c.bbox.top,c.bbox.bottom+1):
            for x in range(c.bbox.left,c.bbox.right+1):
                if (frame.rows[y][x]==c.value
                        and not any(_inside((y,x),p['raster_extent']) for p in strips)):
                    pixels.add((y,x))
    seen={seed};q=deque([seed])
    while q:
        y,x=q.popleft()
        for point in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
            if point in pixels and point not in seen:
                seen.add(point);q.append(point)
        if len(seen)>contract['maximum_body_pixels']:return None
    ys,xs=zip(*sorted(seen));body=(min(ys),min(xs),max(ys),max(xs))
    if not (body[2]>body[0] and body[3]>body[1]):return None
    markers=[]
    for c in components:
        t,l,b,r=_box(c)
        if (c.value==air or c.value in tones or t<ft or c.area<=len(seen)
                or not (body[2]-body[0]+1<=b-t+1<=contract['maximum_marker_extent'])
                or not (1<r-l+1<=contract['maximum_marker_extent'])
                or c.area>=(b-t+1)*(r-l+1)):continue
        # A closed contour surrounding at least one interior field pixel.
        if (all(frame.rows[y][x]==c.value for y,x in
                [(t,x) for x in range(l,r+1)]+[(b,x) for x in range(l,r+1)]
                +[(y,l) for y in range(t,b+1)]+[(y,r) for y in range(t,b+1)])
            and any(frame.rows[y][x]==air for y in range(t+1,b) for x in range(l+1,r))):
            markers.append({'box':_box(c),'component_ref':c.component_id})
    if len(markers)!=1:return None
    marker=markers[0]
    def span(box):
        y=box[2]+1;x=_center(box)[1]
        if y>=frame.height or frame.rows[y][x]==air:return None
        v=frame.rows[y][x];l=r=x
        while l>0 and frame.rows[y][l-1]==v:l-=1
        while r+1<frame.width and frame.rows[y][r+1]==v:r+=1
        return (y,l,r,v)
    body_span=span(body);marker_span=span(marker['box'])
    if body_span is None or marker_span is None:return None
    return {'field_box':_box(field),'field_value':air,'controls':tuple({'box':_box(c),'value':c.value,
        'component_ref':c.component_id} for c in controls),'strips':tuple(strips),
        'body_box':body,'body_component_ref':dot.component_id,'body_dot_value':dot.value,
        'marker':marker,'body_support_span':body_span,'marker_support_span':marker_span}


def measure_channel_surface_loci(value,frame,components,contract):
    scene=measure_channel_surface_scene(frame,components,contract)
    if scene is None or not value.current_observation_frame_ref:return ()
    strips=scene['strips'];controls=scene['controls'];body=scene['body_box'];marker=scene['marker']['box']
    tone=scene['body_dot_value'];assigned=tuple(p for p in strips if p['matches_control'])
    token=stable_digest((scene['field_box'],tuple(c['box'] for c in controls),
        tuple((p['box'],p['normal']) for p in strips),marker,contract))
    carried=value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context') or {}
    prior=bool(carried.get('channel_surface_geometry_token'))
    if prior and not (carried['channel_surface_geometry_token']==token
            and carried.get('channel_surface_context_epoch')==value.current_context_epoch
            and value.previous_action_observed_frame is not None
            and carried.get('channel_surface_source_frame_digest')==stable_digest(value.previous_action_observed_frame.rows)):
        return ()
    previous_response=None
    if prior:
        previous_strips=tuple(carried.get('channel_surface_strips',()))
        same_strips=tuple((p['box'],p['value']) for p in strips)==tuple((tuple(p['box']),p['value']) for p in previous_strips)
        if carried.get('channel_surface_control_locus'):
            previous_response=(tone==carried.get('channel_surface_locus_value') and same_strips
                and body==tuple(carried.get('channel_surface_body_box',())))
        elif carried.get('channel_surface_strip_locus'):
            point=tuple(carried.get('point',()))
            hits=tuple(p for p in strips if _inside(point,p['box']))
            previous_response=(len(hits)==1 and hits[0]['value']==carried.get('channel_surface_body_dot_value')
                and body==tuple(carried.get('channel_surface_body_box',()))
                and all(p['value']==old['value'] for p,old in zip(strips,previous_strips)
                    if not _inside(point,p['box'])))
        else:
            previous_response=same_strips and body!=tuple(carried.get('channel_surface_body_box',()))
        if previous_response is not True:return ()
    span=scene['body_support_span'];other=scene['marker_support_span']
    local=tuple(p for p in strips if span[1]<=p['box'][1]<=span[2] and p['box'][2]+1==span[0])
    body_x=_center(body)[1]
    shared={'channel_surface_geometry_token':token,'channel_surface_context_epoch':value.current_context_epoch,
        'channel_surface_source_frame_ref':value.current_observation_frame_ref,
        'channel_surface_source_frame_digest':stable_digest(frame.rows),'channel_surface_geometry_complete':True,
        'channel_surface_body_box':body,'channel_surface_marker_box':marker,
        'channel_surface_body_dot_value':tone,
        'channel_surface_controls':controls,'channel_surface_strips':strips,
        'channel_surface_body_support_span':span,'channel_surface_marker_support_span':other,
        'channel_surface_assignment_count':len(assigned),
        'channel_surface_distinct_assignment_count':len({p['value'] for p in assigned}),
        'channel_surface_current_tone_assignment_count':sum(p['value']==tone for p in assigned),
        'channel_surface_body_and_marker_same_span':span==other,
        'channel_surface_local_strip_count':len(local),
        'channel_surface_prior_context_present':prior,'channel_surface_previous_response_matches':previous_response,
        'channel_surface_incoming_route_remaining_step_count':value.incoming_declared_route_remaining_step_count}
    rows=[]
    for p in strips:
        rows.append({**shared,'point':_center(p['box']),'action_ref':'ACTION6','component_ref':p['component_ref'],
            'channel_surface_strip_locus':True,'channel_surface_control_locus':False,'channel_surface_direction_locus':False,
            'channel_surface_locus_matches_control':p['matches_control'],
            'channel_surface_locus_value':p['value'],
            'channel_surface_locus_on_body_span':p in local,
            'channel_surface_locus_matches_current_tone':p['value']==tone})
    for c in controls:
        rows.append({**shared,'point':_center(c['box']),'action_ref':'ACTION6','component_ref':c['component_ref'],
            'channel_surface_strip_locus':False,'channel_surface_control_locus':True,'channel_surface_direction_locus':False,
            'channel_surface_locus_matches_current_tone':c['value']==tone,
            'channel_surface_locus_value':c['value'],
            'channel_surface_locus_tone_assignment_count':sum(p['value']==c['value'] for p in assigned)})
    for action,dy,dx in value.interface_action_translation_deltas:
        if action not in value.available_action_refs:continue
        rows.append({**shared,'point':None,'action_ref':action,'component_ref':scene['body_component_ref'],
            'channel_surface_strip_locus':False,'channel_surface_control_locus':False,'channel_surface_direction_locus':True,
            'channel_surface_direction_toward_local_strip':len(local)==1 and dy==0 and dx*(local[0]['box'][1]-body_x)>0,
            'channel_surface_direction_toward_marker':dy==0 and dx*(_center(marker)[1]-body_x)>0,
            'channel_surface_direction_delta':(dy,dx)})
    return tuple(rows)
