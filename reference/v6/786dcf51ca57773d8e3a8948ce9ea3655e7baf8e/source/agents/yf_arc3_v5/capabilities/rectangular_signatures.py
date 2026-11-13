"""Exact bounded palette correspondences around an observed created patch.

Reference/source roles, inheritance and completion are DRM hypotheses.
"""
from collections import Counter
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .contracts import ComponentExtractionInput
from .components import detect_components


def measure_created_signature_correspondences(before,after,created_box,contract):
    components=detect_components(ComponentExtractionInput(frame=before,
        connectivity=contract['connectivity'])).components
    histogram=Counter(v for row in before.rows for v in row)
    modal=tuple(v for v,n in sorted(histogram.items()) if n==max(histogram.values()))
    large=tuple(c for c in components if c.area>=contract['minimum_large_area']
        and c.area*100>=c.bbox.height*c.bbox.width*contract['minimum_fill_percent']
        and c.value not in modal)
    framed=[]
    for component in components:
        b=component.bbox
        if min(b.height,b.width)<contract['minimum_frame_side']:
            continue
        perimeter=tuple((r,c) for r in range(b.top,b.bottom+1) for c in range(b.left,b.right+1)
                        if r in (b.top,b.bottom) or c in (b.left,b.right))
        if not all(before.rows[r][c]==component.value for r,c in perimeter):
            continue
        counts=Counter(before.rows[r][c] for r in range(b.top+1,b.bottom) for c in range(b.left+1,b.right))
        values=tuple(v for v,n in sorted(counts.items()) if n<=contract['maximum_small_count']
                     and v!=component.value and any(c.value==v and c.bbox.top>b.bottom for c in large))
        if len(values)>=contract['minimum_shared_values']:
            framed.append(((b.top,b.left,b.bottom,b.right),values))
    if len(framed)>contract['maximum_reference_regions']:
        return FrozenMap({'signature_correspondence_count':0,'signature_correspondence_domain_complete':False})
    t,l,b,r=created_box
    patch_counts=Counter(after.rows[y][x] for y in range(t,b+1) for x in range(l,r+1))
    rows=[]
    for frame_box,values in framed:
        sources=tuple((c.value,(c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right))
                      for c in large if c.value in values and c.bbox.top>frame_box[2])
        received=tuple(v for v in values if patch_counts.get(v,0)>0)
        overlaps=tuple((v,box,box[0]-b) for v,box in sources if v in received
                       and max(l,box[1])<=min(r,box[3]) and box[0]>b)
        rows.append(FrozenMap({'signature_reference_bbox':frame_box,'signature_values':values,
            'signature_source_bboxes':sources,'signature_received_values':received,
            'signature_positive_overlap_rows':overlaps,'signature_created_bbox':created_box}))
    facts={'signature_correspondence_count':len(rows),'signature_correspondence_domain_complete':True}
    if len(rows)==1:
        facts.update(dict(rows[0]))
        facts['signature_geometry_token']=stable_digest((rows[0]['signature_reference_bbox'],
            rows[0]['signature_values'],rows[0]['signature_source_bboxes']))[:24]
        facts['signature_received_count']=len(rows[0]['signature_received_values'])
        facts['signature_positive_overlap_count']=len(rows[0]['signature_positive_overlap_rows'])
    return FrozenMap(facts)


def measure_missing_signature_projections(frame,goals,commitments,controls,epoch,contract,*,no_effects=()):
    from .rectangular_commitment import _perimeters,_patch
    outlines,bound=_perimeters(frame,contract)
    if bound or len(goals)*len(commitments)*max(1,len(controls))>contract['maximum_pairs']:
        return (),False
    rows=[]
    for goal in goals:
        if goal['context_epoch']!=epoch:
            continue
        reference=tuple(goal['signature_reference_bbox'])
        required=tuple(goal['signature_values'])
        reference_values={v for row in _patch(frame,reference) for v in row}
        if not set(required)<=reference_values:
            continue
        current_sources=tuple((v,tuple(box)) for v,box in goal['signature_source_bboxes']
            if any(pixel==v for row in _patch(frame,tuple(box)) for pixel in row))
        received=set()
        for record in commitments:
            if record['context_epoch']==epoch:
                values={v for row in _patch(frame,tuple(record['before_bbox'])) for v in row}
                received.update(set(required)&values)
        if set(required)<=received:
            rows.extend(_measure_two_carrier_join(frame,goal,commitments,controls,outlines,epoch))
            rows.extend(_measure_same_carrier_reference(frame,goal,commitments,controls,no_effects,outlines,epoch))
        for record in commitments:
            if record['context_epoch']!=epoch:
                continue
            old=tuple(record['before_bbox'])
            if _patch(frame,old)!=tuple(tuple(r) for r in record['after_old_patch']):
                continue
            height=record['after_bbox'][2]-record['after_bbox'][0]+1
            matches=tuple(box for box,ink in outlines if ink==record['perimeter_value'] and box[2]-box[0]+1==height)
            if len(matches)!=1:
                continue
            preview=matches[0]
            for value,source in current_sources:
                if value in received:
                    continue
                positive=tuple(row for row in goal['signature_positive_overlap_rows']
                    if row[1][2]-row[1][0]==source[2]-source[0]
                    and row[1][3]-row[1][1]==source[3]-source[1])
                if len(positive)!=1:
                    continue
                center2=preview[1]+preview[3]
                distance2=max(2*source[1]-center2,0,center2-2*source[3])
                gap=source[0]-preview[2]
                common={'signature_goal_epoch':epoch,'signature_goal_token':goal['signature_geometry_token'],
                    'signature_commitment_token':record['rectangular_change_token'],
                    'signature_missing_value':value,'signature_source_bbox':source,
                    'signature_current_preview_bbox':preview,'signature_distance2':distance2,
                    'signature_contact_gap_repeats_observation':gap==positive[0][2]}
                rows.append(FrozenMap({**common,'action_ref':record['action_ref'],
                    'signature_projection_kind':'current_site','signature_projected_distance_delta2':0,
                    'signature_projected_distance_reduction2':0,
                    'signature_method_after_matches_current':False,
                    'signature_projected_bbox_within_frame':0<=preview[1]<=preview[3]<len(frame.rows[0]),
                    'signature_method_token':'','signature_query_token':stable_digest((goal['term_ref'],record['term_ref'],value,preview,'current'))[:24]}))
                for method in controls:
                    before=method['control_before_bbox'];after=method['control_after_bbox']
                    if (method['context_epoch']!=epoch or method['control_delta_width']!=0
                            or method['control_perimeter_value']!=record['perimeter_value']
                            or before[2]-before[0]!=preview[2]-preview[0]
                            or before[3]-before[1]!=preview[3]-preview[1]
                            or after[2]-after[0]!=preview[2]-preview[0]):
                        continue
                    next_center2=center2+2*method['control_delta_column']
                    next_distance2=max(2*source[1]-next_center2,0,next_center2-2*source[3])
                    rows.append(FrozenMap({**common,'action_ref':method['action_ref'],
                        'signature_projection_kind':'observed_horizontal_delta',
                        'signature_projected_distance_delta2':next_distance2-distance2,
                        'signature_projected_distance_reduction2':distance2-next_distance2,
                        'signature_method_after_matches_current':tuple(after)==preview,
                        'signature_projected_bbox_within_frame':0<=preview[1]+method['control_delta_column']
                            <=preview[3]+method['control_delta_column']<len(frame.rows[0]),
                        'signature_method_token':method['rectangular_control_token'],
                        'signature_query_token':stable_digest((goal['term_ref'],record['term_ref'],method['term_ref'],value,preview))[:24]}))
    return tuple(rows),True


def _measure_two_carrier_join(frame,goal,commitments,controls,outlines,epoch):
    """Enumerate measured translations and overlap gaps for two intact patches.

    No stability, inheritance or acceptance is inferred. Higher arities remain
    without a qualified projection until their explicit construction is defined.
    """
    from .rectangular_commitment import _patch
    required=set(goal['signature_values'])
    pieces=[]
    for record in commitments:
        box=tuple(record['before_bbox'])
        if record['context_epoch']!=epoch or _patch(frame,box)!=tuple(tuple(r) for r in record['after_old_patch']):
            continue
        values={v for row in _patch(frame,box) for v in row}&required
        if values:pieces.append((box,values,record))
    if any(required<=values for _,values,_ in pieces):return ()
    if len(pieces)!=2 or not required<=set.union(*(values for _,values,_ in pieces)):return ()
    pieces.sort(key=lambda item:item[0])
    first=pieces[0][2];second=pieces[1][2]
    if first['action_ref']!=second['action_ref'] or pieces[0][0][0]!=pieces[1][0][0]:return ()
    height=first['after_bbox'][2]-first['after_bbox'][0]+1
    matches=tuple(box for box,ink in outlines if ink==first['perimeter_value'] and box[2]-box[0]+1==height)
    if len(matches)!=1:return ()
    preview=matches[0];reference=tuple(goal['signature_reference_bbox'])
    def distances(box):
        contact=sum(max(part[0][1]-box[3],0,box[1]-part[0][3]) for part in pieces)
        center=abs(box[1]+box[3]-reference[1]-reference[3])
        return contact,center
    contact,center=distances(preview)
    methods=[]
    translation_deltas={}
    for method in controls:
        before=method['control_before_bbox'];after=method['control_after_bbox']
        if (method['context_epoch']==epoch and method['control_delta_width']==0
                and method['control_perimeter_value']==first['perimeter_value']
                and before[2]-before[0]==preview[2]-preview[0]
                and after[2]-after[0]==preview[2]-preview[0]):
            translation_deltas.setdefault(method['action_ref'],set()).add(method['control_delta_column'])
    for method in controls:
        before=method['control_before_bbox'];after=method['control_after_bbox']
        if (method['context_epoch']!=epoch or method['control_delta_width']!=0
                or method['control_perimeter_value']!=first['perimeter_value']
                or before[2]-before[0]!=preview[2]-preview[0]
                or after[2]-after[0]!=preview[2]-preview[0]):continue
        same_extent=before[3]-before[1]==preview[3]-preview[1]
        # A different width is a measured analogy, never a qualified control
        # at the current extent. DRM declares its experiment and falsifier.
        if not same_extent and (method['control_delta_column']==0
                or len(translation_deltas[method['action_ref']])!=1):continue
        dx=method['control_delta_column']
        next_box=(preview[0],preview[1]+dx,preview[2],preview[3]+dx)
        if next_box[1]<0 or next_box[3]>=len(frame.rows[0]):continue
        next_contact,next_center=distances(next_box)
        methods.append((method,next_contact,next_center,same_extent))
    center_improvements=sum(next_contact==0 and next_center<center for _,next_contact,next_center,_ in methods)
    gap_matches=all(part[0][0]-preview[2]==part[2]['before_bbox'][0]-part[2]['after_bbox'][2] for part in pieces)
    common={'signature_goal_epoch':epoch,'signature_goal_token':goal['signature_geometry_token'],
        'signature_commitment_token':first['rectangular_change_token'],
        'signature_second_commitment_token':second['rectangular_change_token'],
        'signature_join_query_present':True,'signature_distance2':contact,
        'signature_reference_center_distance2':center,'signature_reference_center_improvement_count':center_improvements,
        'signature_contact_gap_repeats_observation':gap_matches,'signature_current_preview_bbox':preview,
        'signature_projected_bbox_within_frame':True}
    rows=[FrozenMap({**common,'action_ref':first['action_ref'],'signature_projection_kind':'join_current_site',
        'signature_projected_distance_reduction2':0,'signature_projected_center_reduction2':0,
        'signature_method_token':'','signature_method_after_matches_current':False,
        'signature_query_token':stable_digest((goal['term_ref'],preview,'join-current'))[:24]})]
    for method,next_contact,next_center,same_extent in methods:
        rows.append(FrozenMap({**common,'action_ref':method['action_ref'],
            'signature_projection_kind':'observed_join_horizontal_delta',
            'signature_projected_distance_reduction2':contact-next_contact,
            'signature_projected_center_reduction2':center-next_center,
            'signature_method_token':method['rectangular_control_token'],
            'signature_method_extent_matches_current':same_extent,
            'signature_method_after_matches_current':tuple(method['control_after_bbox'])==preview,
            'signature_query_token':stable_digest((goal['term_ref'],preview,method['term_ref'],'join'))[:24]}))
    return tuple(rows)


def _measure_same_carrier_reference(frame,goal,commitments,controls,no_effects,outlines,epoch):
    """Exact outline/support overlaps and recorded no-effect contexts.

    DRM decides whether another deposit or an extent-discrimination is useful.
    """
    from .rectangular_commitment import _patch
    required=set(goal['signature_values']);reference=tuple(goal['signature_reference_bbox'])
    carriers=[]
    for record in commitments:
        box=tuple(record['before_bbox'])
        if record['context_epoch']!=epoch or _patch(frame,box)!=tuple(tuple(r) for r in record['after_old_patch']):continue
        values={v for row in _patch(frame,box) for v in row}
        if required<=values:carriers.append(record)
    rows=[]
    for record in carriers:
        rows.extend(_measure_reference_from_carrier(frame,goal,record,controls,no_effects,outlines,epoch))
    return tuple(rows)


def _measure_reference_from_carrier(frame,goal,record,controls,no_effects,outlines,epoch):
    reference=tuple(goal['signature_reference_bbox']);support=tuple(record['before_bbox'])
    height=record['after_bbox'][2]-record['after_bbox'][0]+1
    previews=tuple((box,ink) for box,ink in outlines if box[2]-box[0]+1==height)
    if len(previews)!=1:return ()
    preview,ink=previews[0]
    gap_matches=support[0]-preview[2]==record['before_bbox'][0]-record['after_bbox'][2]
    overlap=max(preview[1],support[1])<=min(preview[3],support[3])
    reference_overlap=max(preview[1],reference[1])<=min(preview[3],reference[3])
    no_effect_matches=tuple(n for n in no_effects if n['context_epoch']==epoch and n['action_ref']==record['action_ref']
        and (preview,ink) in n['rectangular_before_perimeters'])
    common={'signature_goal_epoch':epoch,'signature_goal_token':goal['signature_geometry_token'],
        'signature_commitment_token':record['rectangular_change_token'],'signature_carrier_reference_query_present':True,
        'signature_current_preview_bbox':preview,'signature_distance2':0 if overlap else 1,
        'signature_contact_gap_repeats_observation':gap_matches,'signature_reference_horizontal_overlap':reference_overlap,
        'signature_preview_above_reference':preview[0]<reference[0],
        'signature_support_above_reference':support[0]<reference[0],
        'signature_creation_no_effect_at_current_outline':bool(no_effect_matches),
        'signature_creation_no_effect_match_count':len(no_effect_matches),
        'signature_no_effect_token':no_effect_matches[0]['rectangular_no_effect_token'] if len(no_effect_matches)==1 else '',
        'signature_projected_bbox_within_frame':0<=preview[1]<=preview[3]<len(frame.rows[0])}
    rows=[FrozenMap({**common,'action_ref':record['action_ref'],'signature_projection_kind':'carrier_current_site',
        'signature_method_token':'','signature_method_after_matches_current':False,
        'signature_projected_distance_reduction2':0,
        'signature_query_token':stable_digest((goal['term_ref'],record['term_ref'],preview,ink,'carrier-create'))[:24]})]
    for method in controls:
        before=method['control_before_bbox'];after=method['control_after_bbox']
        if (method['context_epoch']!=epoch or method['control_delta_width']==0
                or before[2]-before[0]!=preview[2]-preview[0]
                or before[3]-before[1]!=preview[3]-preview[1]):continue
        next_right=preview[3]+method['control_delta_width']
        rows.append(FrozenMap({**common,'action_ref':method['action_ref'],
            'signature_projection_kind':'carrier_extent_context_probe',
            'signature_observed_width_delta':method['control_delta_width'],
            'signature_projected_bbox_within_frame':0<=preview[1]<=next_right<len(frame.rows[0]),
            'signature_method_token':method['rectangular_control_token'],
            'signature_method_after_matches_current':tuple(after)==preview,
            'signature_projected_distance_reduction2':0,
            'signature_query_token':stable_digest((goal['term_ref'],record['term_ref'],preview,ink,method['term_ref'],'extent'))[:24]}))
    return tuple(rows)
