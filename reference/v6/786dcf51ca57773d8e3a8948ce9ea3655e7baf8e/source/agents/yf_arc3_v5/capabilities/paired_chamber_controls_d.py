"""Current multi-scale compartments and unordered painted-pair incidences.

The base scene infers no force or control meaning. A separately Source-declared
conditional model may use these correspondences through the finite service.
"""
from collections import Counter, defaultdict

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .agenda_measurement_transport import append_candidate_measurements
from .components import detect_components
from .contracts import ComponentExtractionInput
from .framed_masks import measure_enclosed_frame_groups


def _inside(box, bounds):
    top,left,bottom,right=bounds
    return top<box.top<=box.bottom<bottom and left<box.left<=box.right<right


def _center2(box):
    return box.top+box.bottom,box.left+box.right


def _perimeter(frame, component):
    b=component.bbox
    return all(frame.rows[y][x]==component.value
        for y in range(b.top,b.bottom+1)for x in range(b.left,b.right+1)
        if y in (b.top,b.bottom)or x in (b.left,b.right))


def _main_groups(frame, components, squares, contract):
    measured=measure_enclosed_frame_groups(frame,components,contract)
    if not measured['enclosed_frame_groups_complete']:
        return None
    grouped=defaultdict(list)
    for row in measured['enclosed_frame_groups']:
        bounds=tuple(row['frame_bbox'])
        bodies=tuple(c for c in squares if _inside(c.bbox,bounds))
        if len(bodies)!=1:
            continue
        body=bodies[0]
        top,left,bottom,right=bounds
        # Enclosures around a body can be mere background halos. Only a
        # complete 2-D tiling can support the larger compartment description.
        grouped[(bottom-top,right-left,row['border_value'])].append((bounds,body))
    result=[]
    for (rp,cp,border),members in sorted(grouped.items()):
        # Extent is an observation, not occurrence identity. A larger solid
        # union keeps its actual footprint and center; no hidden layer is split.
        side=min(body.bbox.width for _,body in members)
        if not 4<=len(members)<=contract['maximum_room_count'] or rp<=side or cp<=side:
            continue
        rows=tuple(sorted({b[0]for b,_ in members}));cols=tuple(sorted({b[1]for b,_ in members}))
        if (len(rows)<2 or len(cols)<2 or len(rows)*len(cols)!=len(members)
                or any(b-a!=rp for a,b in zip(rows,rows[1:]))
                or any(b-a!=cp for a,b in zip(cols,cols[1:]))):
            continue
        ordered=tuple(sorted(members,key=lambda pair:pair[0]))
        result.append((ordered,border,side))
        if len(result)>contract['maximum_layout_count']:
            return None
    return tuple(result)


def _panel_layouts(frame, components, squares, main, contract):
    members,_,main_side=main
    paints={c.value for _,c in members}
    main_width=max(b[3]for b,_ in members)-min(b[1]for b,_ in members)
    layouts=[]
    for outer in components:
        box=outer.bbox
        if box.width>=main_width or min(box.height,box.width)<4 or not _perimeter(frame,outer):
            continue
        bounds=(box.top,box.left,box.bottom,box.right)
        bodies=tuple(c for c in squares if c.bbox.width<main_side and _inside(c.bbox,bounds))
        if (not 4<=len(bodies)<=contract['maximum_room_count']
                or not {c.value for c in bodies}<=paints
                or len({c.bbox.width for c in bodies})!=1):
            continue
        histogram=Counter(frame.rows[y][x]for y in range(box.top+1,box.bottom)
                          for x in range(box.left+1,box.right))
        peak=max(n for _,n in sorted(histogram.items()))
        modes=tuple(v for v,n in sorted(histogram.items())if n==peak)
        if len(modes)!=1:
            continue
        for nr in range(2,len(bodies)):
            if len(bodies)%nr:
                continue
            nc=len(bodies)//nr
            if nc<2 or (box.height-1)%nr or (box.width-1)%nc:
                continue
            rp,cp=(box.height-1)//nr,(box.width-1)//nc
            horizontal=tuple(box.top+i*rp for i in range(1,nr))
            vertical=tuple(box.left+i*cp for i in range(1,nc))
            if (any(frame.rows[y][x]==modes[0]for y in horizontal for x in range(box.left,box.right+1))
                    or any(frame.rows[y][x]==modes[0]for x in vertical for y in range(box.top,box.bottom+1))):
                continue
            rooms=[]
            for r in range(nr):
                for c in range(nc):
                    cell=(box.top+r*rp,box.left+c*cp,box.top+(r+1)*rp,box.left+(c+1)*cp)
                    occupants=tuple(body for body in bodies if _inside(body.bbox,cell))
                    if len(occupants)!=1:
                        break
                    rooms.append((cell,occupants[0]))
            if len(rooms)==len(bodies):
                layouts.append((outer,modes[0],tuple(rooms)))
                if len(layouts)>contract['maximum_panel_candidates']:
                    return None
    return tuple(layouts)


def _edges(rooms):
    edges=[]
    for i,(a,first)in enumerate(rooms):
        for j,(b,second)in enumerate(rooms):
            if i>=j:
                continue
            if a[0]==b[0]and a[2]==b[2]and a[3]==b[1]:
                edges.append((i,j,1,(a[0],a[3],a[2],a[3]),tuple(sorted((first.value,second.value)))))
            elif a[1]==b[1]and a[3]==b[3]and a[2]==b[0]:
                edges.append((i,j,0,(a[2],a[1],a[2],a[3]),tuple(sorted((first.value,second.value)))))
    return tuple(edges)


def measure_paired_chamber_scene(value, contract):
    if not contract:
        return None
    frame=value.current_observed_frame or value.frame
    if frame.width*frame.height>contract['maximum_frame_pixels']:
        return None
    components=value.components.components if frame==value.frame else detect_components(
        ComponentExtractionInput(frame=frame)).components
    if len(components)>contract['maximum_component_count']:
        return None
    squares=tuple(c for c in components if c.bbox.width==c.bbox.height and c.bbox.width>=2
                  and c.area==c.bbox.width*c.bbox.height)
    mains=_main_groups(frame,components,squares,contract)
    if mains is None or len(mains)!=1:
        return None
    main=mains[0]
    panels=_panel_layouts(frame,components,squares,main,contract)
    if not panels:
        return None
    panels=tuple(sorted(panels,key=lambda panel:(panel[0].bbox.top,panel[0].bbox.left,
                                               panel[0].bbox.bottom,panel[0].bbox.right)))
    # Distinct partitions of overlapping interiors remain ambiguous. Separate
    # panels may describe subsets of the shared palette, never new body types.
    for index,(outer,_,_) in enumerate(panels):
        a=outer.bbox
        for other,_,_ in panels[index+1:]:
            b=other.bbox
            if max(a.top,b.top)<min(a.bottom,b.bottom) and max(a.left,b.left)<min(a.right,b.right):
                return None
    rooms,_,side=main
    room_rows=[]
    for bounds,body in rooms:
        fitting=tuple(c for c in components if c.bbox.width==c.bbox.height==side+2
                      and c.area==4*c.bbox.width-4 and _inside(c.bbox,bounds)
                      and _perimeter(frame,c))
        if len(fitting)>1:
            return None
        room_rows.append(FrozenMap({'bounds':bounds,'paint':body.value,
            'body_center2':_center2(body.bbox),
            **({'observed_solid_body_bbox':(body.bbox.top,body.bbox.left,body.bbox.bottom,body.bbox.right)}
               if body.bbox.width!=side else {}),
            'fitting_frame_center2':_center2(fitting[0].bbox)if fitting else None}))
    if not any(row['fitting_frame_center2']is not None for row in room_rows):
        return None
    main_edges=_edges(rooms)
    if {c.value for _,c in rooms}!={c.value for _,_,panel_rooms in panels for _,c in panel_rooms}:
        return None
    if len(panels)>1 and not {pair for *_,pair in main_edges}<={pair for _,_,panel_rooms in panels for *_,pair in _edges(panel_rooms)}:
        return None
    controls=[]
    for panel_index,(outer,floor,panel_rooms) in enumerate(panels):
        for i,j,axis,band,pair in _edges(panel_rooms):
            top,left,bottom,right=band
            points=tuple((y,x)for y in range(top,bottom+1)for x in range(left,right+1)
                         if frame.rows[y][x]not in (outer.value,floor))
            if not points:
                return None
            # Last-command end marks may change paint, not the paired divider.
            center=((top+bottom)//2,(left+right)//2)
            if center not in points:
                return None
            incidence=tuple((a,b,k)for a,b,k,_,p in main_edges if p==pair)
            if not incidence:
                return None
            differences=[]
            for a,b,k in incidence:
                for index in (a,b):
                    row=room_rows[index];target=row['fitting_frame_center2']
                    if target is not None:
                        differences.append(target[k]-row['body_center2'][k])
            counts=Counter(frame.rows[y][x]for y,x in points)
            peak=max(n for _,n in sorted(counts.items()))
            modal=tuple(v for v,n in sorted(counts.items())if n==peak)
            if len(modal)!=1:
                return None
            controls.append(FrozenMap({'point':center,'typed_pair':pair,'panel_axis':axis,
                **({'panel_index':panel_index} if len(panels)>1 else {}),
                'panel_room_indices':(i,j),'band_bounds':band,'modal_band_paint':modal[0],
                'main_incidence_indices':incidence,'fitting_axis_differences2':tuple(differences),
                'fitting_axis_difference_present':any(d!=0 for d in differences)}))
    if not controls or len(controls)>contract['maximum_control_count']:
        return None
    panel_rows=tuple(FrozenMap({'panel_bounds':(outer.bbox.top,outer.bbox.left,outer.bbox.bottom,outer.bbox.right),
        'panel_rooms':tuple(FrozenMap({'bounds':b,'paint':c.value,'body_center2':_center2(c.bbox)})for b,c in panel_rooms)})
        for outer,_,panel_rooms in panels)
    return FrozenMap({'main_rooms':tuple(room_rows),
        **(dict(panel_rows[0]) if len(panel_rows)==1 else {'panel_groups':panel_rows}),
        'controls':tuple(controls),'source_frame_ref':value.current_observation_frame_ref,
        'source_frame_digest':stable_digest(frame.rows),'context_epoch':value.current_context_epoch,
        'incoming_route_remaining_step_count':value.incoming_declared_route_remaining_step_count})


def append_paired_chamber_candidates(value, agenda, contract, point_producer):
    scene=measure_paired_chamber_scene(value,contract)
    if scene is None:
        return agenda
    points=tuple(sorted(row['point']for row in scene['controls']))
    represented={c.point for c in agenda.candidates if c.action_ref==contract['point_action_ref']}
    missing=tuple(point for point in points if point not in represented)
    additions=()
    if missing and contract['point_action_ref']in value.available_action_refs:
        additions=tuple((c,f)for c,f in point_producer(value,
            frozenset(agenda.current_context_no_effect_candidate_refs),
            frozenset(agenda.tested_candidate_refs_without_resolution_plan),{},{},{},{},requested_points=missing)
            if c.point in missing)
    if len(agenda.candidates)+len(additions)>contract['maximum_frontier_candidates']:
        return agenda
    candidates=list(agenda.candidates);facts=dict(agenda.alternative_facts)
    deltas=dict(agenda.descriptive_delta_facts or agenda.alternative_facts)
    refs=set(agenda.alternative_refs)
    for candidate,base in additions:
        if candidate.candidate_ref not in refs:
            candidates.append(candidate);refs.add(candidate.candidate_ref)
            facts[candidate.candidate_ref]=base;deltas[candidate.candidate_ref]=base
    agenda=agenda.model_copy(update={'candidates':tuple(candidates),
        'alternative_refs':tuple(c.candidate_ref for c in candidates),
        'alternative_facts':FrozenMap(facts),'descriptive_delta_facts':FrozenMap(deltas),
        'has_candidates':bool(candidates)})
    controls={row['point']:row for row in scene['controls']}
    from .paired_chamber_configuration_d import measure_paired_configuration
    configuration=measure_paired_configuration(value,scene,contract.get('configuration_contract',{}))
    measured={}
    for candidate in agenda.candidates:
        if candidate.action_ref!=contract['point_action_ref']or candidate.point not in controls:
            continue
        control=controls[candidate.point]
        measured[candidate.candidate_ref]=FrozenMap({
            'paired_chamber_geometry_complete':True,'paired_chamber_current_measurement':scene,
            'paired_chamber_control_measurement':control,
            'paired_chamber_fitting_axis_difference_present':control['fitting_axis_difference_present'],
            'paired_chamber_incoming_route_remaining_step_count':value.incoming_declared_route_remaining_step_count,
            **(dict(configuration.get(candidate.point,{})) if configuration else {})})
    return append_candidate_measurements(agenda,FrozenMap(measured),FrozenMap())
