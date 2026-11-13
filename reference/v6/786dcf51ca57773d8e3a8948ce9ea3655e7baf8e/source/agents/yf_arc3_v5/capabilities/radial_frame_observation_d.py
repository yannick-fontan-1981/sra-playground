"""Finite compass layouts, contour/frame rays and observed point-effect pairs.

No control member is chosen here. DRM decides whether a measured relative ray
licenses a tool experiment, without asserting a lighting or color-memory law.
"""
from collections import Counter,defaultdict
from agents.yf_arc3_v5.logos.types import FrozenMap,stable_digest
from .contracts import ComponentExtractionInput
from .components import detect_components
from .contour_cohort_observation_d import _fragment_frames


def _center(row):
    y,x,side,*_=row
    return (2*y+side-1,2*x+side-1)


def _ray(vector):
    y,x=vector
    if (not y and not x) or (y and x and abs(y)!=abs(x)):return None
    return ((y>0)-(y<0),(x>0)-(x<0))


def _compass_groups(contours,contract):
    by_extent=defaultdict(dict)
    for row in contours:
        by_extent[row[2]][_center(row)]=row
    groups=[]
    for side,located in sorted(by_extent.items()):
        centers=tuple(sorted({((a[0]+b[0])//2,(a[1]+b[1])//2)
            for a in sorted(located) for b in sorted(located) if a!=b and
            (a[0]+b[0])%2==0 and (a[1]+b[1])%2==0}))
        for center in centers:
            vectors={(y-center[0],x-center[1]):row for (y,x),row in sorted(located.items())}
            radii=tuple(sorted({y for y,x in sorted(vectors) if y>0 and x==0}))
            diagonal=tuple(sorted({y for y,x in sorted(vectors) if y==x and y>0}))
            for r in radii:
                axes=((r,0),(-r,0),(0,r),(0,-r))
                if any(v not in vectors for v in axes):continue
                for d in diagonal:
                    corners=((d,d),(d,-d),(-d,d),(-d,-d))
                    if not 0<d<r or any(v not in vectors for v in corners):continue
                    members=tuple(sorted((vectors[v] for v in (*axes,*corners))))
                    paints=Counter(row[3] for row in members)
                    if sorted(paints.values())!=[1,7]:continue
                    variant=next(value for value,count in sorted(paints.items()) if count==1)
                    groups.append((side,center,members,variant))
                    if len(groups)>contract['maximum_selector_groups']:return None
    return tuple(groups)


def _offcenter_pairs(contours, frames, pivot, members, contract):
    if not contract.get('measure_offcenter_pairs'):
        return ()
    member_boxes = {tuple(row[:3]) for row in members}
    rows = []
    for contour in contours:
        if tuple(contour[:3]) in member_boxes:
            continue
        center = _center(contour)
        vector = (center[0] - pivot[0], center[1] - pivot[1])
        ray = _ray(vector)
        if ray is None:
            continue
        for outer in frames:
            paint, y, x, extent, fragment = outer
            target = (2*y + extent - 1 - pivot[0],
                      2*x + extent - 1 - pivot[1])
            if (contour[2] <= extent - 2*fragment and _ray(target) == ray
                    and sum(n*n for n in vector) < sum(n*n for n in target)):
                rows.append((contour, outer, contour[3] == paint))
                if len(rows) > contract['maximum_offcenter_pairs']:
                    return None
    return tuple(rows)


def measure_radial_frame_loci(value,frame,components,contract):
    if (not contract or contract['point_action_ref'] not in value.available_action_refs
            or frame.width*frame.height>contract['maximum_frame_pixels']
            or not value.sparse_raster_transitions):return ()
    transition=value.sparse_raster_transitions[-1]
    if transition.after_digest!=stable_digest(frame.rows) or transition.after_square_contours is None:return ()
    if len(transition.after_square_contours)>contract['maximum_contours']:return ()
    full=tuple(row for row in transition.after_square_contours if row[5]==4*row[2]-4)
    groups=_compass_groups(full,contract)
    if not groups:return ()
    if frame!=value.frame:
        components=detect_components(ComponentExtractionInput(frame=frame)).components
    if len(components)>contract['maximum_components']:return ()
    frames=_fragment_frames(components,{c.value for c in components},contract)
    if frames is None:return ()
    pairs=[]
    for contour in full:
        for outer in frames:
            paint,y,x,extent,fragment=outer
            if (contour[2]<=extent-2*fragment and _center(contour)==(2*y+extent-1,2*x+extent-1)):
                pairs.append((contour,outer,contour[3]==paint))
    rows=[]
    for side,center,members,variant in groups:
        anchors=tuple(c for c in transition.after_square_contours if c[2]==side and c[3]==variant
            and 0<c[5]<4*side-4)
        if len(anchors)!=1:continue
        anchor=anchors[0];pivot=_center(anchor)
        remote = _offcenter_pairs(full, frames, pivot, members, contract)
        if remote is None:return ()
        current_pairs = (*pairs, *remote)
        if not current_pairs:continue
        differences=tuple((i,_ray(((_center(c)[0]-pivot[0]),(_center(c)[1]-pivot[1]))))
            for i,(c,_,equal) in enumerate(current_pairs) if not equal)
        if not any(ray is not None for _,ray in differences):continue
        token=stable_digest((center,members,anchor,tuple(current_pairs)))
        for contour in members:
            control_center=_center(contour)
            vector=(control_center[0]-center[0],control_center[1]-center[1])
            ray=_ray(vector)
            matched=tuple(i for i,direction in differences if direction==ray and ray is not None)
            point=(control_center[0]//2,control_center[1]//2)
            component=next((c for c in components if c.value==contour[3] and
                (c.bbox.top,c.bbox.left,c.bbox.height)==tuple(contour[:3])),None)
            if component is None:return ()
            rows.append(FrozenMap({'action_ref':contract['point_action_ref'],'point':point,
                'component_ref':component.component_id,'radial_frame_geometry_token':token,
                'radial_frame_unique_geometry_complete':len(groups)==1,
                'radial_frame_group_center_doubled':center,'radial_frame_group_contours':members,
                'radial_frame_variant_paint':variant,'radial_frame_pivot_contour':anchor,
                'radial_frame_pairs':tuple(current_pairs),'radial_frame_difference_indices':matched,
                'radial_frame_offcenter_pair_count':len(remote),
                'radial_frame_control_vector_doubled':vector,
                'radial_frame_control_on_difference_ray':bool(matched),
                'radial_frame_control_is_variant':contour[3]==variant,
                'radial_frame_source_frame_ref':value.current_observation_frame_ref,
                'radial_frame_source_frame_digest':transition.after_digest,
                'radial_frame_context_epoch':value.current_context_epoch,
                'radial_frame_incoming_route_remaining_step_count':value.incoming_declared_route_remaining_step_count}))
            if len(rows)>contract['maximum_controls']:return ()
    return tuple(rows)


def measure_radial_point_displacement_candidates(value, agenda, contract):
    """Exact square/color translation after a point input, not a future clock law."""
    if not contract.get('measure_point_color_translation') or not value.sparse_raster_transitions:
        return FrozenMap()
    frame = value.current_observed_frame or value.frame
    t = value.sparse_raster_transitions[-1]
    if (frame.width*frame.height > contract['maximum_frame_pixels']
            or t.action_ref != contract['point_action_ref'] or t.point is None
            or t.action_ref != value.last_action_ref or not t.changed_cells_complete
            or t.after_digest != stable_digest(frame.rows)
            or t.before_square_contours is None or t.after_square_contours is None
            or max(len(t.before_square_contours),len(t.after_square_contours)) > contract['maximum_contours']):
        return FrozenMap()
    previous = [list(row) for row in frame.rows]
    for y,x,before,after in t.changed_cells:
        if not (0 <= y < frame.height and 0 <= x < frame.width) or frame.rows[y][x] != after:
            return FrozenMap()
        previous[y][x] = before
    previous = tuple(tuple(row) for row in previous)
    if stable_digest(previous) != t.before_digest:
        return FrozenMap()
    components = detect_components(ComponentExtractionInput(frame=frame)).components
    old_components = detect_components(ComponentExtractionInput(
        frame=frame.model_copy(update={'rows':previous}))).components
    if max(len(components),len(old_components)) > contract['maximum_components']:
        return FrozenMap()
    frames = _fragment_frames(components,{c.value for c in components},contract)
    old_frames = _fragment_frames(old_components,{c.value for c in old_components},contract)
    full = tuple(c for c in t.after_square_contours if c[5] == 4*c[2]-4)
    old_full = tuple(c for c in t.before_square_contours if c[5] == 4*c[2]-4)
    groups = _compass_groups(full,contract);old_groups = _compass_groups(old_full,contract)
    if frames is None or old_frames is None or not groups or not old_groups or len(groups)!=1 or len(old_groups)!=1:
        return FrozenMap()
    side,center,members,variant = groups[0]
    old_side,old_center,old_members,old_variant = old_groups[0]
    if (side,center,tuple(sorted(c[:3] for c in members))) != (old_side,old_center,tuple(sorted(c[:3] for c in old_members))):
        return FrozenMap()
    anchors = tuple(c for c in t.after_square_contours if c[2]==side and c[3]==variant and 0<c[5]<4*side-4)
    old_anchors = tuple(c for c in t.before_square_contours if c[2]==side and c[3]==old_variant and 0<c[5]<4*side-4)
    if len(anchors)!=1 or len(old_anchors)!=1 or _center(anchors[0])!=_center(old_anchors[0]):
        return FrozenMap()
    remote = _offcenter_pairs(full,frames,_center(anchors[0]),members,contract)
    if remote is None:return FrozenMap()
    measured=[]
    for current,outer,equal in remote:
        if not equal or outer not in old_frames:continue
        target=(2*outer[1]+outer[3]-1,2*outer[2]+outer[3]-1)
        residual=tuple(a-b for a,b in zip(target,_center(current)))
        for prior in old_full:
            if prior[2]!=current[2] or prior[3]==current[3] or tuple(prior[:3]) in {tuple(c[:3]) for c in old_members}:continue
            delta=(current[0]-prior[0],current[1]-prior[1])
            if sum(n!=0 for n in delta)!=1:continue
            axis=0 if delta[0] else 1;step=2*delta[axis]
            if residual[1-axis] or residual[axis]%step:continue
            count=residual[axis]//step
            if not 1<=count<=contract['maximum_point_residual_steps']:continue
            measured.append(FrozenMap({'before_square':prior,'after_square':current,
                'frame_fragments':outer,'displacement':delta,'remaining_observed_steps':count,
                'stationary_anchor_before':old_anchors[0],'stationary_anchor_after':anchors[0],
                'previous_point':t.point,'source_frame_ref':value.current_observation_frame_ref,
                'source_frame_digest':t.after_digest,'prior_frame_digest':t.before_digest,
                'context_epoch':value.current_context_epoch}))
    if len(measured)!=1:return FrozenMap()
    directions={ref for ref,dr,dc in value.interface_action_translation_deltas if dr or dc}
    checkpoint=agenda.context_facts.get('level_start_checkpoint_action_ref')
    controls=tuple(c for c in agenda.candidates if c.point is None
        and c.action_ref not in directions and c.action_ref!=checkpoint)
    action_count=len({c.action_ref for c in controls})
    if len(controls)>contract['maximum_stationary_controls']:return FrozenMap()
    return FrozenMap({c.candidate_ref:FrozenMap({
        'radial_point_displacement_measurement_present':True,
        'radial_point_displacement_current_measurement':measured[0],
        'radial_point_displacement_remaining_steps':measured[0]['remaining_observed_steps'],
        'radial_point_displacement_stationary_action_count':action_count,
        'radial_point_displacement_source_frame_ref':value.current_observation_frame_ref,
        'radial_point_displacement_source_frame_digest':t.after_digest,
        'radial_point_displacement_context_epoch':value.current_context_epoch}) for c in controls})
