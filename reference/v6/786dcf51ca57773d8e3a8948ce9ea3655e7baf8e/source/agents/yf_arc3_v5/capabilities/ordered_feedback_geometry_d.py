"""Exact ordered rows, palette correspondence, contour and counter geometry.

All role and protocol readings are caller-declared conditional assignments.
Only compact observations from the preceding released WHY can be revalidated;
this module has no mutable memory, cognitive policy or environment access.
"""
from collections import defaultdict
from functools import lru_cache
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .symbolic_diagrams import _components
from .concentric_frames import measure_concentric_frames

@lru_cache(maxsize=16)
def measure_ordered_panel_geometry(frame):
    cs=_components(frame)
    by_extent=defaultdict(lambda:defaultdict(list))
    for c in cs:
        b=c.bbox
        if b.height==b.width and b.height>=3 and c.area==b.height*b.width:
            by_extent[b.height][b.top].append(c)
    models=[]
    for extent,rows in sorted(by_extent.items()):
        if len(rows)<3:continue
        ordered=tuple((y,tuple(sorted(g,key=lambda c:c.bbox.left)))for y,g in sorted(rows.items()))
        top,entry,palette=ordered[0],ordered[-2],ordered[-1]
        n=len(top[1])
        if n<2 or len(entry[1])!=n or not palette[1]:continue
        xs=tuple(c.bbox.left for c in top[1]);gaps={b-a for a,b in zip(xs,xs[1:])}
        if len(gaps)!=1:continue
        pitch=next(iter(gaps))
        if pitch<=extent or tuple(c.bbox.left for c in entry[1])!=xs:continue
        px=tuple(c.bbox.left for c in palette[1])
        if px!=tuple(xs[0]+i*pitch for i in range(len(px))):continue
        palette_values=tuple(c.value for c in palette[1])
        if len(set(palette_values))!=len(palette_values):continue
        controls=[]
        for c in cs:
            b=c.bbox
            if b.left<=max(x.bbox.right for x in palette[1])or b.width<=b.height:continue
            if not (b.top<=palette[0]+extent//2<=b.bottom):continue
            if not all(frame.rows[y][x]==c.value for y in range(b.top,b.bottom+1)
                for x in range(b.left,b.right+1)if y in (b.top,b.bottom)or x in (b.left,b.right)):continue
            inners=tuple(x for x in cs if b.top<x.bbox.top<=x.bbox.bottom<b.bottom
                and b.left<x.bbox.left<=x.bbox.right<b.right)
            if len(inners)!=1 or inners[0].area!=inners[0].bbox.height*inners[0].bbox.width:continue
            controls.append({'bounds':(b.top,b.left,b.bottom,b.right),
                'point':((b.top+b.bottom)//2,(b.left+b.right)//2),
                'outer_paint':c.value,'bar_paint':inners[0].value})
        if len(controls)!=1:continue
        models.append({'extent':extent,'pitch':pitch,'rank_lefts':xs,
            'upper_row_top':top[0],'upper_row_values':tuple(c.value for c in top[1]),
            'entry_row_top':entry[0],'entry_values':tuple(c.value for c in entry[1]),
            'palette_row_top':palette[0],'palette_values':palette_values,
            'control':controls[0],'intermediate_solid_row_count':len(ordered)-3})
    return models


def _uniform_patch(frame,top,left,extent):
    if top<0 or left<0 or top+extent>frame.height or left+extent>frame.width:
        return None
    paints={frame.rows[y][x]for y in range(top,top+extent)for x in range(left,left+extent)}
    return next(iter(paints))if len(paints)==1 else None


def _counter_parts(frame,geometry,maximum):
    rows=defaultdict(list)
    for c in _components(frame):
        b=c.bbox
        if (b.top>geometry['control']['bounds'][2] and b.height<geometry['extent']
                and 0<b.width<=maximum and c.area==b.height*b.width):
            rows[(b.top,b.height)].append(c)
    if not rows:
        return None
    height=min(k[1]for k in rows)
    groups=[]
    for (top,h),cs in sorted(rows.items()):
        if h!=height:continue
        cs=tuple(sorted(cs,key=lambda c:c.bbox.left))
        runs=[]
        for c in cs:
            if not runs or runs[-1][-1].bbox.right+1!=c.bbox.left:runs.append([c])
            else:runs[-1].append(c)
        for run in runs:
            width=sum(c.bbox.width for c in run)
            if not h<width<=maximum:continue
            groups.append(tuple((c.value,c.bbox.width)for c in run))
    return groups[0]if len(groups)==1 else None


def measure_ordered_feedback_scene(value,contract):
    if not contract or contract.get('geometry_ref')!='homologous_rows_distinct_palette_and_bar_control':
        return None
    frame=value.current_observed_frame or value.frame
    if frame.width*frame.height>contract['maximum_frame_pixels']:
        return None
    models=measure_ordered_panel_geometry(frame)
    if len(models)!=1:return None
    geometry=models[0];n=len(geometry['rank_lefts'])
    if n>contract['maximum_ranks']:return None
    prior=value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context')or{}
    contract_digest=stable_digest(immutable_json_data(contract))
    current_scope=(value.current_context_epoch,value.observed_level_index)
    scope_matches=(prior.get('schema_ref')==contract['schema_ref']
        and prior.get('contract_digest')==contract_digest
        and tuple(prior.get('scope_signature',()))==current_scope
        and all(type(x)is int for x in current_scope))
    carried=prior.get('scene',{})if scope_matches else {}
    empty=carried.get('empty_paint')
    if len(set(geometry['entry_values']))==1 and geometry['entry_values'][0]not in geometry['palette_values']:
        measured_empty=geometry['entry_values'][0]
        if empty is not None and empty!=measured_empty:return None
        empty=measured_empty
    if empty is None:return None
    current=tuple(geometry['entry_values']);prefix=tuple(p for p in current if p!=empty)
    if current!=prefix+(empty,)*(n-len(prefix)):return None
    alphabet=tuple(sorted(set(geometry['palette_values'])|set(prefix)))
    if not n<len(alphabet)<=contract['maximum_alphabet']:return None
    if carried and tuple(carried.get('alphabet',()))!=alphabet:return None
    masked=carried.get('masked_upper_paint')
    if masked is None:
        if len(set(geometry['upper_row_values']))!=1 or geometry['upper_row_values'][0]in alphabet:
            return None
        masked=geometry['upper_row_values'][0]
    if any(p!=masked and p not in alphabet for p in geometry['upper_row_values']):return None
    e=geometry['extent'];xs=geometry['rank_lefts'];visible=[]
    for y in range(geometry['upper_row_top']+e,geometry['entry_row_top']-e+1):
        paints=tuple(_uniform_patch(frame,y,x,e)for x in xs)
        if not all(p in alphabet for p in paints):continue
        styles=tuple(tuple(sorted({frame.rows[y-1][c]for c in range(x,x+e)}))for x in xs)
        if not all(len(s)==1 for s in styles):return None
        visible.append({'values':paints,'style_values':tuple(s[0]for s in styles),
            'first_observation_ref':value.current_observation_frame_ref,
            'last_observation_ref':value.current_observation_frame_ref})
    parts=_counter_parts(frame,geometry,contract['maximum_attempt_units'])
    if not parts:return None
    capacity=sum(count for _,count in parts)
    remaining_paint=carried.get('remaining_paint')
    if remaining_paint is None:
        if not visible and len(parts)==1:remaining_paint=parts[0][0]
        elif len(parts)==2 and parts[0][1]==len(visible):remaining_paint=parts[1][0]
        else:return None
    remaining=sum(count for paint,count in parts if paint==remaining_paint)
    used=capacity-remaining
    if carried:
        if capacity!=carried['attempt_capacity'] or not carried.get('history_complete'):
            return None
        if not carried['attempts_used']<=used<=carried['attempts_used']+1:return None
        if used>carried['attempts_used']and not visible:return None
    elif used!=len(visible):
        return None
    retained={stable_digest((tuple(r['values']),tuple(r['style_values']))):dict(r)
              for r in carried.get('history_rows',())}
    for row in visible:
        digest=stable_digest((row['values'],row['style_values']))
        if digest in retained:
            retained[digest]['last_observation_ref']=value.current_observation_frame_ref
        else:retained[digest]=row
    if len(retained)>contract['maximum_history_rows']:return None
    current_overlap=len(set(prefix)&set(geometry['palette_values']))
    previous_prefix=tuple(carried.get('prefix',()))
    previous_palette=tuple(carried.get('geometry',{}).get('palette_values',()))
    previous_overlap=len(set(previous_prefix)&set(previous_palette))
    base_order=tuple(carried.get('initial_palette_order',()))
    if not base_order and not prefix:base_order=tuple(geometry['palette_values'])
    geometry_keys=('extent','pitch','rank_lefts','entry_row_top','palette_row_top')
    same_geometry=bool(carried and all(tuple(carried['geometry'][k])==tuple(geometry[k])
        if isinstance(geometry[k],(tuple,list)) else carried['geometry'][k]==geometry[k]
        for k in geometry_keys))
    prior_compaction=carried.get('input_compaction_correspondence_observed')is True
    current_palette=tuple(geometry['palette_values'])
    one_add=(len(prefix)==len(previous_prefix)+1 and prefix[:-1]==previous_prefix)
    prior_geometry=carried.get('geometry',{})
    last_point=tuple(value.last_point_position or())
    prior_input_point=((prior_geometry.get('palette_row_top',0)+e//2,
        xs[0]+previous_palette.index(prefix[-1])*geometry['pitch']+e//2)
        if one_add and prefix[-1]in previous_palette else ())
    point_action_observed=value.last_action_ref==contract['point_action_ref']
    exact_removed_and_shifted=(one_add and previous_palette.count(prefix[-1])==1
        and point_action_observed and last_point==prior_input_point
        and current_palette==tuple(p for p in previous_palette if p!=prefix[-1]))
    unchanged=(prefix==previous_prefix and current_palette==previous_palette
        and used==carried.get('attempts_used'))
    restored=(not prefix and used==carried.get('attempts_used',-1)+1
        and point_action_observed and last_point==tuple(prior_geometry.get('control',{}).get('point',()))
        and current_palette==base_order)
    compaction_observed=bool(same_geometry and (exact_removed_and_shifted
        or prior_compaction and (unchanged or restored)))
    palette_points=tuple((geometry['palette_row_top']+e//2,xs[0]+i*geometry['pitch']+e//2)
                         for i in range(len(geometry['palette_values'])))
    decorations=sum(f.center in palette_points and f.bottom-f.top+1==e+2
                    for f in measure_concentric_frames(frame))
    cb=geometry['control']['bounds']
    control_decorations=sum(f.center==tuple(geometry['control']['point'])
        and f.bottom-f.top+1==cb[2]-cb[0]+3 and f.right-f.left+1==cb[3]-cb[1]+3
        for f in measure_concentric_frames(frame))
    return FrozenMap({'geometry':geometry,'empty_paint':empty,'masked_upper_paint':masked,
        'alphabet':alphabet,'prefix':prefix,'initial_palette_order':base_order,
        'input_compaction_correspondence_observed':compaction_observed,
        'history_rows':tuple(retained[k]for k in sorted(retained)),
        'visible_history_count':len(visible),'history_complete':True,
        'attempt_capacity':capacity,'remaining_paint':remaining_paint,
        'attempts_remaining':remaining,'attempts_used':used,
        'upper_values':tuple(geometry['upper_row_values']),
        'current_prefix_distinct_count':len(set(prefix)),
        'current_palette_overlap_count':current_overlap,
        'prior_prefix_distinct_count':len(set(previous_prefix)),
        'prior_prefix_repeated_count':len(previous_prefix)-len(set(previous_prefix)),
        'prior_palette_overlap_count':previous_overlap,
        'palette_concentric_frame_count':decorations,'control_outer_frame_count':control_decorations,
        'prior_scope_matches':scope_matches,'source_frame_ref':value.current_observation_frame_ref,
        'source_frame_digest':stable_digest(frame),'scope_signature':current_scope,
        'schema_ref':contract['schema_ref'],'contract_digest':contract_digest})
