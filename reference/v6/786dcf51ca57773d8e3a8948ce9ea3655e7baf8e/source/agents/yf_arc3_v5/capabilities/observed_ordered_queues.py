"""Bounded paired-format legend and flat ordered collection measurements."""
from collections import Counter,defaultdict
from functools import lru_cache
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput,InteractionProbeCandidate
from agents.yf_arc3_v5.capabilities.framed_masks import measure_enclosed_frame_groups
from agents.yf_arc3_v5.logos.types import stable_digest,FrozenMap,immutable_json_data


def _ordered_occupied_prefix(symbols, direction, row_pitch, column_pitch):
    """Read a flat prefix unchanged, or a unique occupied neighbor chain.

    The head is the inward end of the first occupied row.  No traversal of
    empty slots or arbitrary ordering of a branching/cyclic support is assumed.
    """
    if len({c.bbox.top for c in symbols}) <= 1:
        return tuple(sorted(symbols,key=lambda c:(direction*c.bbox.left,c.component_id)))
    points={(c.bbox.top,c.bbox.left):c for c in symbols}
    if len(points)!=len(symbols) or min(row_pitch,column_pitch)<=0:return None
    current=min(points,key=lambda p:(p[0],direction*p[1]));ordered=[];seen=set()
    while current not in seen:
        seen.add(current);ordered.append(points[current])
        if len(seen)==len(points):return tuple(ordered)
        row,col=current
        neighbors=tuple(p for p in ((row-row_pitch,col),(row+row_pitch,col),
            (row,col-column_pitch),(row,col+column_pitch)) if p in points and p not in seen)
        if len(neighbors)!=1:return None
        current=neighbors[0]
    return None


@lru_cache(maxsize=32)
def _measure_display(frame,contract):
    if not contract or frame.height*frame.width>contract['maximum_frame_pixels']:return None
    cs=detect_components(ComponentExtractionInput(frame=frame,connectivity=4)).components
    if len(cs)>contract['maximum_component_count']:return None
    counts=Counter(v for row in frame.rows for v in row);maximum=max(sorted(counts.values()));modes=tuple(v for v,n in sorted(counts.items()) if n==maximum)
    if len(modes)!=1:return None
    background=modes[0];solid=tuple(c for c in cs if c.value!=background and c.bbox.height==c.bbox.width and c.area==c.bbox.height*c.bbox.width and c.bbox.height>=2)
    byrow=defaultdict(list)
    for c in solid:byrow[c.bbox.top].append(c)
    rows=[]
    for top,group in sorted(byrow.items()):
        group=tuple(sorted(group,key=lambda c:c.bbox.left))
        for i in range(len(group)-3):
            a,b,c,d=group[i:i+4]
            if a.bbox.width==b.bbox.width>c.bbox.width==d.bbox.width and len({a.value,b.value,c.value,d.value})==4:
                rows.append({'top':top,'columns':tuple(x.bbox.left for x in (a,b,c,d)),'large_size':a.bbox.width,'small_size':c.bbox.width,'left_pair':(a.value,b.value),'right_pair':(c.value,d.value)})
    groups=defaultdict(list)
    for r in rows:groups[(r['columns'],r['large_size'],r['small_size'])].append(r)
    tables=[]
    for key,rows in sorted(groups.items()):
        pairs={r['left_pair'] for r in rows}|{r['right_pair'] for r in rows}
        lefts={r['left_pair'] for r in rows};rights={r['right_pair'] for r in rows}
        if not contract['minimum_legend_rows']<=len(rows)<=contract['maximum_legend_rows'] or lefts!=rights:continue
        if len({v for pair in sorted(pairs) for v in pair})!=2*len(pairs):continue
        tables.append((tuple(rows),tuple(sorted(pairs))))
    if len(tables)!=1:return None
    legend,pairs=tables[0];types={pair:'measurement:paired-type:'+stable_digest(pair)[:16] for pair in pairs};color_type={v:types[p] for p in pairs for v in p};color_camp={v:i for p in pairs for i,v in enumerate(p)}
    result=measure_enclosed_frame_groups(frame,cs,contract)
    if not result['enclosed_frame_groups_complete']:return None
    frames=result['enclosed_frame_groups'];single=tuple(c for c in cs if c.area==1)
    panels=[]
    for region in frames:
        t,l,b,r=region['frame_bbox'];points=tuple(c for c in single if t<c.bbox.top<b and l<c.bbox.left<r)
        repeated=Counter(c.value for c in points if c.value not in color_type)
        if not repeated:continue
        maximum=max(sorted(repeated.values()));marker_values=tuple(v for v,n in sorted(repeated.items()) if n==maximum)
        if len(marker_values)!=1 or maximum<contract['minimum_placeholder_points']:continue
        marker=marker_values[0];dots=tuple(c for c in points if c.value==marker);ys=tuple(sorted({c.bbox.top for c in dots}));xs=tuple(sorted({c.bbox.left for c in dots}))
        if len(ys)<2 or len(xs)<4:continue
        top=ys[0];anchors=tuple(sorted(c.bbox.left for c in points if c.bbox.top==top and c.value not in color_type))
        gaps=tuple(b-a for a,b in zip(anchors,anchors[1:]))
        if not gaps or gaps.count(max(gaps))!=1 or min(gaps)==max(gaps):continue
        cut=gaps.index(max(gaps))+1
        if min(cut,len(anchors)-cut)<2:continue
        head_points=((top,anchors[cut-1]),(top,anchors[cut]));queues=[]
        row_pitch=min(b-a for a,b in zip(ys,ys[1:]))
        column_pitch=min(b-a for a,b in zip(xs,xs[1:]))
        for camp in (0,1):
            symbols=tuple(c for c in points if c.value in color_type and color_camp[c.value]==camp)
            direction=-1 if head_points[camp][1]<head_points[1-camp][1] else 1
            symbols=_ordered_occupied_prefix(symbols,direction,row_pitch,column_pitch)
            if symbols is None:return None
            queues.append(tuple({'type_ref':color_type[c.value],'pixel':(c.bbox.top,c.bbox.left),'palette_value':c.value} for c in symbols))
        if len(queues)!=2:continue
        chambers=[]
        for child in frames:
            tt,ll,bb,rr=child['frame_bbox']
            if t<tt<bb<b and l<ll<rr<r and tt>max(ys):
                tokens=tuple(c for c in points if tt<c.bbox.top<bb and ll<c.bbox.left<rr)
                chambers.append({'bbox':child['frame_bbox'],'tokens':tuple((c.bbox.top,c.bbox.left,c.value) for c in tokens)})
        panels.append({'bbox':region['frame_bbox'],'queues':tuple(queues),'head_points':head_points,'pending_mark_count':sum(len(c['tokens']) for c in chambers),'chambers':tuple(chambers)})
    panels=tuple(sorted(panels,key=lambda p:(p['bbox'][0],p['bbox'][1])))
    if not contract['minimum_stage_count']<=len(panels)<=contract['maximum_stage_count'] or len({p['bbox'][0] for p in panels})!=1:return None
    active=tuple(i for i,p in enumerate(panels) if p['queues'][0])
    if len(active)!=1:return None
    options=[];large=max(r['large_size'] for r in legend)
    for c in solid:
        if c.value not in color_type or color_camp[c.value]!=0 or c.bbox.width<=large:continue
        enclosures=tuple(r for r in frames if r['frame_bbox'][0]<c.bbox.top<c.bbox.bottom<r['frame_bbox'][2] and r['frame_bbox'][1]<c.bbox.left<c.bbox.right<r['frame_bbox'][3])
        if enclosures:
            options.append({'component_ref':c.component_id,'palette_value':c.value,'type_ref':color_type[c.value],'point':(c.bbox.top+c.bbox.height//2,c.bbox.left+c.bbox.width//2),'size':c.bbox.width,'top':c.bbox.top})
    if len(options)!=len(pairs) or len({(o['size'],o['top']) for o in options})!=1 or len({o['type_ref'] for o in options})!=len(pairs):return None
    return immutable_json_data({'legend':legend,'pairs':pairs,'edges':tuple((types[r['left_pair']],types[r['right_pair']]) for r in legend),'types':tuple(types[p] for p in pairs),'panels':panels,'active_index':active[0],'options':tuple(options)})


def measure_display(frame,contract):
    return _measure_display(frame,FrozenMap(contract)) if contract else None


def chamber_token_count(frame,chambers):
    cs=detect_components(ComponentExtractionInput(frame=frame,connectivity=4)).components
    return sum(c.area==1 and any(t<c.bbox.top<b and l<c.bbox.left<r for t,l,b,r in chambers) for c in cs)


def annotate_ordered_queue_input(value,agenda):
    frame=value.current_observed_frame or value.frame
    measured=measure_display(frame,value.route_generation_policy.get('ordered_queue_measurement_contract',{})) is not None
    facts={
        'queue_actual_source_return':False,
        'queue_current_display_measured':measured,
        'incoming_declared_route_engagement_present':value.incoming_declared_route_engagement_present,
    }
    if measured:
        facts['observed_ordered_queue_input']=FrozenMap({'frame':frame,
            'receipt':value.retained_physical_transition_receipt,
            'frame_ref':value.current_observation_frame_ref,
            'epoch':value.current_context_epoch,'level_index':value.observed_level_index})
    return agenda.model_copy(update={'context_facts':FrozenMap.overlay(facts,agenda.context_facts)})


def append_display_controls(value,agenda):
    from .interaction import POINT_ACTION_REF
    frame=value.current_observed_frame or value.frame
    scene=measure_display(frame,value.route_generation_policy.get('ordered_queue_measurement_contract',{}))
    if not scene or POINT_ACTION_REF not in value.available_action_refs:return agenda
    candidates=list(agenda.candidates);facts=dict(agenda.alternative_facts);deltas=dict(agenda.descriptive_delta_facts)
    components={c.component_id:c for c in detect_components(ComponentExtractionInput(frame=frame)).components}
    for row in scene['options']:
        point=tuple(row['point']);ref='probe:paired-format-control:'+stable_digest((row['type_ref'],point))[:24]
        if ref in facts:continue
        component=components[row['component_ref']]
        candidate=InteractionProbeCandidate(candidate_ref=ref,action_ref=POINT_ACTION_REF,point=point,component_ref=component.component_id,action_data=FrozenMap({'x':point[1],'y':point[0]}),basis_refs=(component.component_id,))
        local=FrozenMap({'candidate_ref':ref,'action_ref':POINT_ACTION_REF,'component_ref':component.component_id,'interaction_measurement_kind':'point',
            'candidate_observation_row':point[0],'candidate_observation_col':point[1],
            'occupied_area':component.area,'palette_value':component.value,
            'candidate_execution_count':int(dict(value.candidate_execution_counts).get(ref,0)),
            'known_to_produce_scene_effect':False,
            'attempted_without_effect_in_current_context':ref in value.current_context_no_effect_candidate_refs,
            'tested_before_without_resolution_plan':ref in value.tested_candidate_refs_without_resolution_plan,
            'is_boundary_collinear_component':False,'logical_cell_candidate':False,
            'queue_control_locus_present':True,'queue_control_type_ref':row['type_ref'],
            'cell_body_reception_probe_present':False,'cell_reaction_reproduction_probe_present':False,
            'cell_supply_completion_probe_present':False,'candidate_is_open_cavity_nonreturn_first_action':False,
            'reconciled_tiled_support_alignment_route':False})
        candidates.append(candidate);facts[ref]=local;deltas[ref]=local
    return agenda.model_copy(update={'candidates':tuple(candidates),'alternative_refs':tuple(c.candidate_ref for c in candidates),'alternative_facts':FrozenMap(facts),'descriptive_delta_facts':FrozenMap(deltas),'has_candidates':bool(candidates)})
