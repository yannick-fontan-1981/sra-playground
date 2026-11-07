"""Current contour multisets, common translations and disconnected square frames.

These are measurements, not object identities, reception roles or future laws.
The ordinary Source probe lifecycle owns any experiment made from them.
"""
from collections import defaultdict
from agents.yf_arc3_v5.logos.types import FrozenMap,stable_digest
from .components import detect_components
from .contracts import ComponentExtractionInput


def _fragment_frames(components,values,contract):
    classes=defaultdict(set)
    for c in components:
        b=c.bbox
        if (c.value in values and b.width==b.height and c.area==b.width*b.height
                and b.width<=contract['maximum_fragment_extent']):
            classes[(c.value,b.width)].add((b.top,b.left))
    if sum(len(points)**2 for _,points in sorted(classes.items()))>contract['maximum_fragment_pairs']:
        return None
    frames=set()
    for (value,side),points in sorted(classes.items()):
        for y,x in sorted(points):
            for yy,xx in sorted(points):
                gap=xx-x
                if (yy==y and side<gap and gap+side<=contract['maximum_fragment_extent']
                        and (y+gap,x) in points and (y+gap,xx) in points):
                    frames.add((value,y,x,gap+side,side))
                    if len(frames)>contract['maximum_fragment_frames']:return None
    return tuple(sorted(frames))


def _measure_complete_contour_cohort_candidates(value,agenda,contract):
    if not contract or not value.sparse_raster_transitions:return FrozenMap()
    frame=value.current_observed_frame or value.frame
    if frame.width*frame.height>contract['maximum_frame_pixels']:return FrozenMap()
    transition=value.sparse_raster_transitions[-1]
    delta=value.last_action_measured_translation_delta
    directional={str(ref) for ref,_,_ in value.interface_action_translation_deltas}
    if (transition.action_ref!=value.last_action_ref or transition.action_ref not in directional
            or transition.after_digest!=stable_digest(frame.rows)
            or transition.before_square_contours is None or transition.after_square_contours is None
            or delta is None or sum(int(n)!=0 for n in delta)!=1
            or (transition.action_ref,*delta) not in value.known_action_translation_deltas):
        return FrozenMap()
    delta=tuple(int(n) for n in delta)
    before,after=defaultdict(set),defaultdict(set)
    for grouped,rows in ((before,transition.before_square_contours),(after,transition.after_square_contours)):
        for y,x,side,paint,inner,area in rows:
            # Complete square perimeters have the same exact mask. An equal
            # partial-contour area would not establish mask correspondence.
            if area==4*side-4:grouped[(side,paint,inner,area)].add((y,x))
    cohorts=[]
    for descriptor,starts in sorted(before.items()):
        ends=after.get(descriptor,set())
        if not contract['minimum_cohort_size']<=len(starts)<=contract['maximum_cohort_size']:continue
        if len(starts)!=len(ends):continue
        deltas={(ey-sy,ex-sx) for sy,sx in starts for ey,ex in ends}
        common=tuple(d for d in sorted(deltas) if d!=(0,0) and
            {(y+d[0],x+d[1]) for y,x in starts}==ends)
        if len(common)==1 and common[0]==delta:
            cohorts.append((descriptor,tuple(sorted(starts)),tuple(sorted(ends))))
    if not cohorts or len(cohorts)>contract['maximum_cohorts']:return FrozenMap()
    components=value.components.components
    if frame!=value.frame:
        components=detect_components(ComponentExtractionInput(frame=frame)).components
    if len(components)>contract['maximum_components']:return FrozenMap()
    frames=_fragment_frames(components,{row[0][1] for row in cohorts},contract)
    if frames is None:return FrozenMap()
    rows=[]
    for descriptor,starts,ends in cohorts:
        side,paint,inner,area=descriptor
        compatible=tuple(f for f in frames if f[0]==paint and side<=f[3]-2*f[4])
        if len(compatible)!=len(ends):continue
        centers={(2*y+side-1,2*x+side-1) for y,x in ends}
        frame_centers={(2*y+outer-1,2*x+outer-1) for _,y,x,outer,_ in compatible}
        if len(frame_centers)!=len(compatible):continue
        residuals=tuple(sorted({((fy-cy)//2,(fx-cx)//2)
            for cy,cx in centers for fy,fx in frame_centers
            if (fy-cy)%2==0 and (fx-cx)%2==0
            and {(y+fy-cy,x+fx-cx) for y,x in centers}==frame_centers}))
        rows.append(FrozenMap({'contour_cohort_descriptor':descriptor,
            'contour_cohort_before_origins':starts,'contour_cohort_current_origins':ends,
            'contour_cohort_observed_translation':delta,'contour_cohort_fragment_frames':compatible,
            'contour_cohort_joint_center_residuals':residuals,
            'contour_cohort_one_translation_residual':residuals==(delta,),
            'contour_cohort_source_frame_ref':value.current_observation_frame_ref,
            'contour_cohort_source_frame_digest':transition.after_digest,
            'contour_cohort_prior_frame_digest':transition.before_digest,
            'contour_cohort_context_epoch':value.current_context_epoch,
            'contour_cohort_action_ref':transition.action_ref,
            'contour_cohort_incoming_route_remaining_step_count':value.incoming_declared_route_remaining_step_count}))
    if not rows:return FrozenMap()
    unique=len(rows)==1
    out={}
    for candidate in agenda.candidates:
        if candidate.action_ref!=transition.action_ref or candidate.point is not None:continue
        measured=rows[0] if unique else FrozenMap({'contour_cohort_alternatives':tuple(rows)})
        out[candidate.candidate_ref]=FrozenMap.overlay({
            'contour_cohort_measurement_present':True,
            'contour_cohort_unique_geometry_complete':unique,
            'contour_cohort_current_measurement':measured,
            'contour_cohort_count':len(rows)},measured)
    return FrozenMap(out)


def _translated_contour_parts(value, agenda, contract):
    """Measure square subparts of exactly translated small raster components.

    A connected extension does not erase an enclosed perimeter. The retained
    translation attests the whole component mask, including that extension;
    no controller identity, attachment law or unobserved suffix is inferred.
    """
    limits = contract.get('translated_part_contract')
    if not limits or not value.sparse_raster_transitions:
        return FrozenMap()
    frame = value.current_observed_frame or value.frame
    transition = value.sparse_raster_transitions[-1]
    directions = {str(ref): (int(dr), int(dc))
                  for ref, dr, dc in value.interface_action_translation_deltas}
    direction = directions.get(transition.action_ref)
    if (frame.width * frame.height > contract['maximum_frame_pixels']
            or transition.action_ref != value.last_action_ref
            or transition.point is not None or direction is None
            or transition.after_digest != stable_digest(frame.rows)
            or not transition.small_component_translations_complete
            or not transition.small_component_translations
            or len(transition.small_component_translations) > limits['maximum_translations']):
        return FrozenMap()
    components = value.components.components
    if frame != value.frame:
        components = detect_components(ComponentExtractionInput(frame=frame)).components
    if len(components) > contract['maximum_components']:
        return FrozenMap()
    translations = transition.small_component_translations
    frames = _fragment_frames(components, {row[0] for row in translations}, contract)
    if frames is None:
        return FrozenMap()
    rows = []
    for paint, top, left, height, width, dr, dc, area in translations:
        if (sum(n != 0 for n in (dr, dc)) != 1
                or sum(n != 0 for n in direction) != 1
                or dr * direction[0] + dc * direction[1] <= 0
                or not limits['minimum_component_area'] <= area <= limits['maximum_component_area']):
            continue
        current = tuple(c for c in components if c.value == paint
                        and (c.bbox.top, c.bbox.left, c.bbox.height, c.bbox.width, c.area)
                        == (top + dr, left + dc, height, width, area))
        if len(current) != 1:
            continue
        component = current[0]
        pixels = frozenset(component.pixels)
        parts = []
        for side in range(limits['minimum_part_extent'],
                          min(height, width, limits['maximum_part_extent']) + 1):
            for y in range(component.bbox.top, component.bbox.bottom - side + 2):
                for x in range(component.bbox.left, component.bbox.right - side + 2):
                    perimeter = frozenset((y + r, x + c) for r in range(side)
                                          for c in range(side)
                                          if r in (0, side - 1) or c in (0, side - 1))
                    if not perimeter <= pixels:
                        continue
                    interior = {frame.rows[r][c] for r in range(y + 1, y + side - 1)
                                for c in range(x + 1, x + side - 1)}
                    if len(interior) == 1 and paint not in interior:
                        parts.append((y, x, side, next(iter(interior))))
        if len(parts) != 1:
            continue
        y, x, side, inner = parts[0]
        compatible = tuple(f for f in frames if f[0] == paint and side <= f[3] - 2 * f[4])
        if len(compatible) != 1:
            continue
        _, fy, fx, outer, _ = compatible[0]
        doubled = (2 * fy + outer - 1 - (2 * y + side - 1),
                   2 * fx + outer - 1 - (2 * x + side - 1))
        if any(n % 2 for n in doubled):
            continue
        residual = tuple(n // 2 for n in doubled)
        axis = 0 if dr else 1
        step = (dr, dc)[axis]
        if residual[1 - axis] or residual[axis] % step:
            continue
        count = residual[axis] // step
        if not 1 <= count <= limits['maximum_residual_step_count']:
            continue
        rows.append(FrozenMap({
            'translated_contour_part_current_origin': (y, x),
            'translated_contour_part_prior_origin': (y - dr, x - dc),
            'translated_contour_part_extent': side,
            'translated_contour_part_paint': paint,
            'translated_contour_part_inner_paint': inner,
            'translated_contour_part_component_before_bbox': (top, left, height, width),
            'translated_contour_part_component_area': area,
            'translated_contour_part_observed_step': (dr, dc),
            'translated_contour_part_fragment_frame': compatible[0],
            'translated_contour_part_center_residual': residual,
            'translated_contour_part_residual_step_count': count,
            'translated_contour_part_source_frame_ref': value.current_observation_frame_ref,
            'translated_contour_part_source_frame_digest': transition.after_digest,
            'translated_contour_part_prior_frame_digest': transition.before_digest,
            'translated_contour_part_context_epoch': value.current_context_epoch,
            'translated_contour_part_incoming_route_remaining_step_count': value.incoming_declared_route_remaining_step_count,
        }))
    if len(rows) != 1:
        return FrozenMap()
    measured = rows[0]
    return FrozenMap({candidate.candidate_ref: FrozenMap.overlay({
        'translated_contour_part_relation_present': True,
        'translated_contour_part_unique_geometry_complete': True,
        'translated_contour_part_current_measurement': measured,
    }, measured) for candidate in agenda.candidates
        if candidate.action_ref == transition.action_ref and candidate.point is None})


def measure_contour_cohort_candidates(value, agenda, contract):
    complete = _measure_complete_contour_cohort_candidates(value, agenda, contract)
    parts = _translated_contour_parts(value, agenda, contract)
    # Both measurements describe the same source-enumerated command. Retain
    # their distinct descriptive fields so DRM can qualify either question;
    # sharing a candidate key must not silently discard the other measurement.
    # Existing complete-cohort fields keep their exact values on overlap.
    return FrozenMap({
        ref: FrozenMap.overlay(complete.get(ref, FrozenMap()),
                               parts.get(ref, FrozenMap()))
        for ref in dict.fromkeys((*parts, *complete))
    })
