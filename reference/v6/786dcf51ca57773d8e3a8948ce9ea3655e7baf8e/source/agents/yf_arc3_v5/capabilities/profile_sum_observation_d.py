"""Observed dashed baselines, filled profiles, samples and homologous controls.

Only measurements and existing finite profile calculations. DRM owns the sum
interpretation, channel supposition and experiment order; no gain is invented.
"""
from collections import Counter,defaultdict
from agents.yf_arc3_v5.logos.types import FrozenMap,stable_digest
from .mechanical_family_contracts_d import DMechanicalScope
from .periodic_profile_preimages_d import (
    PeriodicProfileLawD,ProfileSampleReceiptD,ProfilePhaseAssignmentD,
    ProfileDetectorD,PeriodicProfilePreimagesRequestD,measure_periodic_profile_preimages_d)


def _box(c):
    return (c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right)


def _runs(xs):
    out=[]
    for x in xs:
        if out and x==out[-1][-1]+1:out[-1].append(x)
        else:out.append([x])
    return out


def _arrow_controls(frame,components,contract):
    out=[]
    for c in components:
        t,l,b,r=_box(c)
        if not (contract['minimum_arrow_frame_height']<=b-t+1<=contract['maximum_arrow_frame_extent']
                and 4<=r-l+1<=contract['maximum_arrow_frame_extent']):continue
        if not (all(frame.rows[y][x]==c.value for y in (t,b) for x in range(l,r+1))
                and all(frame.rows[y][x]==c.value for x in (l,r) for y in range(t,b+1))):continue
        for color in sorted({frame.rows[y][x] for y in range(t+1,b) for x in range(l+1,r)}-{c.value}):
            rows=[[x for x in range(l+1,r) if frame.rows[y][x]==color] for y in range(t+1,b)]
            if len(rows)!=3 or not (len(rows[0])==len(rows[2])==1 and rows[0]==rows[2]):continue
            middle=rows[1]
            if len(middle)<3 or middle!=list(range(min(middle),max(middle)+1)):continue
            x=rows[0][0]
            if not min(middle)<x<max(middle):continue
            offset=2*x-min(middle)-max(middle)
            if offset==0:continue
            mask=tuple((y,x-min(middle)) for y,row in enumerate(rows) for x in row)
            out.append({'box':_box(c),'point':((t+b)//2,(l+r)//2),'component_ref':c.component_id,
                'glyph_mask':mask,'glyph_extent':len(middle),'glyph_horizontal_sign':-1 if offset<0 else 1})
    pairs=[]
    for i,a in enumerate(out):
        for b in out[i+1:]:
            if a['box'][0:1]+a['box'][2:3]!=b['box'][0:1]+b['box'][2:3]:continue
            if a['glyph_extent']!=b['glyph_extent'] or a['glyph_horizontal_sign']==b['glyph_horizontal_sign']:continue
            reflected=tuple(sorted((y,a['glyph_extent']-1-x) for y,x in a['glyph_mask']))
            if reflected==tuple(sorted(b['glyph_mask'])):pairs.append(tuple(sorted((a,b),key=lambda q:q['box'])))
    return pairs[0] if len(pairs)==1 else ()


def measure_profile_sum_frame(frame,components,contract):
    if (not contract or frame.width*frame.height>contract['maximum_frame_pixels']
            or len(components)>contract['maximum_components']):return None
    rows=frame.rows;width=frame.width
    background=Counter(p for row in rows for p in row).most_common(1)[0][0]
    baselines=defaultdict(list)
    for y,row in enumerate(rows):
        for color,count in sorted(Counter(row).items()):
            if color==background or count<width//3:continue
            xs=[x for x,p in enumerate(row) if p==color];runs=_runs(xs)
            if (len(runs)>=contract['minimum_baseline_dashes']
                    and max(map(len,runs))<=contract['maximum_baseline_dash_width']
                    and xs[0]<=contract['maximum_edge_gap'] and width-1-xs[-1]<=contract['maximum_edge_gap']):
                baselines[color].append(y)
    groups=[]
    for color,ys in sorted(baselines.items()):
        if not contract['minimum_tracks']<=len(ys)<=contract['maximum_tracks']:continue
        pitches={b-a for a,b in zip(ys,ys[1:])}
        if len(pitches)==1 and min(pitches)>=contract['minimum_track_spacing']:groups.append((color,ys,min(pitches)))
    if len(groups)!=1:return None
    baseline_color,ys,pitch=groups[0]
    controls=_arrow_controls(frame,components,contract)
    if not controls or any(c['box'][2]>=ys[0] for c in controls):return None
    tracks=[]
    for b in ys:
        start=max(0,b-pitch+1);values=defaultdict(list)
        for y in range(start,b):
            for x,p in enumerate(rows[y]):
                if p not in (background,baseline_color):values[p].append((y,x))
        full=[(p,pts) for p,pts in sorted(values.items()) if len(pts)>=width//2
            and max(x for _,x in pts)-min(x for _,x in pts)+1>=width*contract['minimum_profile_span_fraction']]
        if len(full)!=1:return None
        color=full[0][0]
        start=b-1
        while start>=max(0,b-pitch+1) and color in rows[start]:start-=1
        start+=1
        tracks.append({'value':color,'baseline':b,'band_top':start})
    if len({t['value'] for t in tracks})!=len(tracks):return None
    separators=[c.bbox.top for c in components if c.bbox.height==1 and c.area==width and c.bbox.width==width and c.bbox.top>ys[-1]]
    if len(separators)<2:return None
    lower,upper=sorted(separators)[:2];receivers=[]
    for c in components:
        t,l,b,r=_box(c)
        if not (lower<t==b<upper and c.area==r-l+1 and c.area%2==1
                and contract['minimum_receiver_width']<=c.area<=contract['maximum_receiver_width']):continue
        labels=[m for m in components if m.bbox.height==1 and m.area==m.bbox.width<=contract['maximum_label_width']
            and lower<m.bbox.top<t]
        pairs=[(a,z) for a in labels for z in labels if a.value==z.value and a.bbox.top==z.bbox.top
            and l-a.bbox.right==z.bbox.left-r and l-a.bbox.right in (0,1)
            and a.bbox.left<l and z.bbox.right>r
            and a.bbox.width==z.bbox.width]
        if len(pairs)!=1:continue
        a,z=pairs[0];target_y=a.bbox.top
        panel_background=Counter(rows[y][x] for y in range(lower+1,upper) for x in range(width)).most_common(1)[0][0]
        if not all(rows[y][l]==rows[y][r]!=panel_background for y in range(target_y,t)):continue
        interior=[]
        for y in range(lower+1,t):
            vals={rows[y][x] for x in range(l+1,r)}
            if len(vals)!=1:break
            interior.append(next(iter(vals)))
        else:
            if any(p not in {panel_background,*[q['value'] for q in tracks]} for p in interior):continue
            contributions=tuple(interior.count(q['value']) for q in tracks)
            receivers.append({'column':(l+r)//2,'base':t,'box':_box(c),'target':t-target_y,
                'label_boxes':(_box(a),_box(z)),'stack_contributions':contributions,'stack_total':sum(contributions)})
    if not receivers or len(receivers)>contract['maximum_detectors']:return None
    receivers.sort(key=lambda r:r['column'])
    for track in tracks:
        b=track['baseline'];color=track['value'];points=[]
        for receiver in receivers:
            x=receiver['column']
            candidates=[(y,rows[y][x]) for y in range(track['band_top'],b+1)
                if rows[y][x] not in (background,baseline_color,color)]
            if len(candidates)!=1:return None
            y,p=candidates[0];points.append((x,y,p))
        track['points']=tuple(points)
        vector=[];point_map={x:y for x,y,_ in points}
        for x in range(width):
            if x in point_map:h=b-point_map[x]
            else:
                h=0;y=b-1
                while y>=track['band_top'] and rows[y][x]==color:h+=1;y-=1
            if h>contract['maximum_sample_height']:return None
            vector.append(h)
        periods=tuple(p for p in range(1,min(contract['maximum_observed_period'],width//contract['minimum_repeated_periods'])+1)
            if all(h==vector[x%p] for x,h in enumerate(vector)))
        if not periods:return None
        track.update(samples=tuple(vector),observed_periods=periods)
    if len({p for track in tracks for _,_,p in track['points']})!=1:return None
    return {'tracks':tuple(tracks),'receivers':tuple(receivers),'controls':controls,'profile_background':background,
        'baseline_color':baseline_color,'receiver_separators':(lower,upper),'period_uniqueness_proved':False}


def measure_profile_sum_loci(v,frame,components,contract):
    if not contract or not v.current_observation_frame_ref:return ()
    scene=measure_profile_sum_frame(frame,components,contract)
    if scene is None:return ()
    token=stable_digest((tuple((t['value'],t['baseline']) for t in scene['tracks']),
        scene['receivers'],scene['controls'],contract))
    scope=DMechanicalScope(**dict(contract['scope']),request_ref='measurement.profile_sum.'+token,
        evidence_revision_ref=v.current_observation_frame_ref,model_revision_ref=stable_digest(scene),
        epoch=v.current_context_epoch,input_domain_complete=True)
    laws=[];samples=[]
    for i,track in enumerate(scene['tracks']):
        ref='measurement.profile_track.'+str(i)
        for p in track['observed_periods']:
            laws.append(PeriodicProfileLawD(law_ref=ref+'.period.'+str(p),track_ref=ref,
                period=p,samples=track['samples'][:p],index_offset=0,phase_sign=-1))
        samples.extend(ProfileSampleReceiptD(evidence_ref=v.current_observation_frame_ref,track_ref=ref,
            index=x,value=h,sealed=True,epoch=v.current_context_epoch) for x,h in enumerate(track['samples']))
    refs=tuple('measurement.profile_track.'+str(i) for i in range(len(scene['tracks'])))
    common=dict(operation_ref=contract['profile_operation_ref'],requested_result_type='DMechanicalResult',
        track_refs=refs,**dict(contract['calculation_bounds']))
    fit=measure_periodic_profile_preimages_d(PeriodicProfilePreimagesRequestD(**common,mode_ref='FIT',
        scope=scope.model_copy(update={'request_ref':scope.request_ref+'.fit'}),
        phase_ref='SEALED_PROFILE_FIT',laws=tuple(laws),observed_samples=tuple(samples),assignment_domain_complete=False))
    if not fit.domain_complete or len(fit.values['consistent_law_refs'])!=len(laws):return ()
    # Minimal observed repetition is a numeric property, not uniqueness of a future law.
    minimal=tuple(next(l for l in laws if l.track_ref==ref) for ref in refs)
    assignment=ProfilePhaseAssignmentD(assignment_ref='measurement.current_profile_samples',
        track_law_phases=tuple((l.track_ref,l.law_ref,0) for l in minimal))
    detectors=tuple(ProfileDetectorD(detector_ref='measurement.profile_detector.'+str(i),column=r['column'],target_value=r['target'])
        for i,r in enumerate(scene['receivers']))
    result=measure_periodic_profile_preimages_d(PeriodicProfilePreimagesRequestD(**common,mode_ref='EVALUATE',
        scope=scope.model_copy(update={'request_ref':scope.request_ref+'.evaluate'}),
        phase_ref='CORRELATED_PHASE_DOMAIN',laws=minimal,assignments=(assignment,),detectors=detectors,assignment_domain_complete=True))
    if not result.domain_complete:return ()
    measured=result.values['correlated_assignment_results'][0]
    stack_matches=all(tuple(c['value'] for c in d['contributions'])==tuple(r['stack_contributions'])
        for d,r in zip(measured['detector_results'],scene['receivers']))
    carried=v.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context') or {}
    prior=bool(carried.get('profile_sum_geometry_token'))
    # Only the initial unknown-channel experiment is exposed by this narrow entry.
    # A later correction requires a separately declared, currently revalidated question.
    out=[]
    for i,c in enumerate(scene['controls']):
        out.append(FrozenMap({'action_ref':contract['point_action_ref'],'point':c['point'],'component_ref':c['component_ref'],
            'profile_sum_geometry_token':token,'profile_sum_context_epoch':v.current_context_epoch,
            'profile_sum_source_frame_ref':v.current_observation_frame_ref,'profile_sum_source_frame_digest':stable_digest(frame.rows),
            'profile_sum_geometry_complete':True,'profile_sum_tracks':scene['tracks'],'profile_sum_receivers':scene['receivers'],
            'profile_sum_controls':scene['controls'],'profile_sum_leftmost_homologous_control':i==0,
            'profile_sum_glyph_horizontal_sign':c['glyph_horizontal_sign'],'profile_sum_prior_context_present':prior,
            'profile_sum_current_stack_matches':stack_matches,'profile_sum_all_targets_currently_hit':measured['all_target_hits'],
            'profile_sum_fit_examined':fit.examined_count,'profile_sum_evaluate_examined':result.examined_count,
            'profile_sum_period_uniqueness_proved':False,'profile_sum_channel_gains_acquired':False,
            'profile_sum_fit_request':fit.scope.request_ref,'profile_sum_evaluate_request':result.scope.request_ref,
            'profile_sum_result_revision':result.scope.model_revision_ref,'profile_sum_aggregation':measured['detector_results'],
            'profile_sum_scope':scope.model_dump(),'profile_sum_laws':tuple(l.model_dump() for l in minimal),
            'profile_sum_incoming_route_remaining_step_count':v.incoming_declared_route_remaining_step_count}))
    return tuple(out)
