"""Bounded public raster changes between a perimeter and a persistent patch.

This measurement does not identify mass, support, stability or acceptance.
"""
from pydantic import Field
from collections import Counter
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, stable_digest
from .contracts import FrameGrid, ComponentExtractionInput
from .components import detect_components


class RectangularCommitmentInput(FrozenModel):
    schema_version: str = 'yf_arc3_v5.rectangular_commitment_input.v1'
    before: FrameGrid
    after: FrameGrid
    action_ref: str
    context_epoch: int = Field(ge=1)
    after_epoch: int = Field(ge=1)
    transition_ref: str
    measurement_contract: FrozenMap
    evidence_refs: tuple[str, ...] = Field(min_length=2, max_length=8)
    prior_records: tuple[FrozenMap, ...] = Field(default=(), max_length=64)


class RectangularCommitmentMeasurements(FrozenModel):
    schema_version: str = 'yf_arc3_v5.rectangular_commitment_measurements.v1'
    descriptive_facts: FrozenMap
    evidence_refs: tuple[str, ...]


def _box(component):
    b = component.bbox
    return (b.top, b.left, b.bottom, b.right)


def _patch(frame, box):
    t, l, b, r = box
    return tuple(tuple(row[l:r+1]) for row in frame.rows[t:b+1])


def _perimeters(frame, contract):
    result = []
    components = detect_components(ComponentExtractionInput(frame=frame,
        connectivity=contract['connectivity'])).components
    for component in components:
        t,l,b,r = _box(component)
        h,w = b-t+1,r-l+1
        if (h < contract['minimum_height'] or w < h*contract['minimum_width_height_ratio']
                or component.area < contract['minimum_perimeter_area']
                or component.area != 2*(w+h)-4):
            continue
        perimeter = (*((t,c) for c in range(l,r+1)),
                     *((b,c) for c in range(l,r+1)),
                     *((row,l) for row in range(t+1,b)),
                     *((row,r) for row in range(t+1,b)))
        if all(frame.rows[row][col] == component.value for row,col in perimeter):
            result.append((_box(component),component.value))
    return tuple(result[:contract['maximum_perimeters']]), len(result)>contract['maximum_perimeters']


def measure_rectangular_commitment(value: RectangularCommitmentInput):
    before, before_bound = _perimeters(value.before,value.measurement_contract)
    after, after_bound = _perimeters(value.after,value.measurement_contract)
    rows = []
    changed_preview_rows = []
    pair_visits = 0
    pair_bound = False
    histogram=Counter(pixel for row in value.before.rows for pixel in row)
    modal_values=tuple(pixel for pixel,count in sorted(histogram.items()) if count==max(histogram.values()))
    for box,ink in before:
        t,l,b,r = box
        interior_size = (b-t-1)*(r-l-1)
        changed = sum(value.before.rows[row][col]!=value.after.rows[row][col]
                      for row in range(t+1,b) for col in range(l+1,r))
        before_modal=sum(value.before.rows[row][col] in modal_values
                         for row in range(t+1,b) for col in range(l+1,r))
        after_nonmodal=sum(value.after.rows[row][col] not in modal_values
                           for row in range(t+1,b) for col in range(l+1,r))
        for next_box,next_ink in after:
            pair_visits += 1
            if pair_visits>value.measurement_contract['maximum_pairs']:
                pair_bound=True
                break
            nt,nl,nb,nr=next_box
            if (next_box==box or b-t!=nb-nt or r-l!=nr-nl
                    or interior_size<=0
                    or len(modal_values)!=1
                    or before_modal*100<interior_size*value.measurement_contract['minimum_modal_interior_percent']
                    or after_nonmodal*100<interior_size*value.measurement_contract['minimum_nonmodal_after_percent']
                    or changed*100<interior_size*value.measurement_contract['minimum_changed_interior_percent']):
                continue
            # A translated filled body returns its old interior to the modal
            # raster value; it does not satisfy the opposite measured change.
            pair=FrozenMap({'before_bbox':box,'after_bbox':next_box,
                'before_perimeter_value':ink,'perimeter_value':next_ink,'changed_interior_count':changed,
                'after_old_patch':_patch(value.after,box)})
            if ink==next_ink:
                rows.append(pair)
            else:
                changed_preview_rows.append(pair)
        if pair_bound:
            break
    facts = {'rectangular_change_pair_count':len(rows),
             'changed_preview_pair_count':len(changed_preview_rows),
             'rectangular_change_inventory_complete':not(before_bound or after_bound or pair_bound),
             'same_context_epoch':value.context_epoch==value.after_epoch,
             'context_epoch':value.context_epoch,'action_ref':value.action_ref,
             'transition_ref':value.transition_ref}
    if len(rows)==1:
        facts.update(dict(rows[0]))
        facts['rectangular_change_token']=stable_digest((value.transition_ref,rows[0]))[:24]
        from .rectangular_signatures import measure_created_signature_correspondences
        facts.update(dict(measure_created_signature_correspondences(value.before,value.after,
            tuple(rows[0]['before_bbox']),value.measurement_contract['signature_contract'])))
    else:
        facts['signature_correspondence_count']=0
        facts['signature_correspondence_domain_complete']=True
    if len(changed_preview_rows)==1:
        from .rectangular_signatures import measure_created_signature_correspondences
        weak=dict(changed_preview_rows[0])
        weak['rectangular_change_token']=stable_digest((value.transition_ref,changed_preview_rows[0]))[:24]
        weak.update(dict(measure_created_signature_correspondences(value.before,value.after,
            tuple(changed_preview_rows[0]['before_bbox']),value.measurement_contract['signature_contract'])))
        facts.update({f'changed_preview_{key}':item for key,item in sorted(weak.items())})
    control_rows=[]
    for record in value.prior_records:
        old_box=tuple(record['before_bbox'])
        stored_patch=tuple(tuple(r) for r in record['after_old_patch'])
        if (record['context_epoch']!=value.context_epoch or _patch(value.before,old_box)!=stored_patch
                or _patch(value.after,old_box)!=stored_patch):
            continue
        height=record['after_bbox'][2]-record['after_bbox'][0]+1
        first=tuple((b,ink) for b,ink in before if b[2]-b[0]+1==height)
        second=tuple((b,ink) for b,ink in after if b[2]-b[0]+1==height)
        if len(first)==len(second)==1 and first[0]!=second[0]:
            (a,before_ink),(b,after_ink)=first[0],second[0]
            control_rows.append(FrozenMap({'control_before_bbox':a,'control_after_bbox':b,
                'control_delta_row':b[0]-a[0],'control_delta_column':b[1]-a[1],
                'control_delta_width':(b[3]-b[1])-(a[3]-a[1]),
                'control_perimeter_value':after_ink,
                'control_before_perimeter_value':before_ink,
                'parent_observation_ref':record['term_ref']}))
    control_groups={}
    for row in control_rows:
        geometry=FrozenMap({key:item for key,item in sorted(row.items()) if key!='parent_observation_ref'})
        key=tuple(geometry.items())
        group=control_groups.setdefault(key,(geometry,set()))
        group[1].add(row['parent_observation_ref'])
    facts['rectangular_control_support_row_count']=len(control_rows)
    control_rows=[FrozenMap({**dict(geometry),'parent_observation_refs':tuple(sorted(parents)),
        'parent_observation_ref':sorted(parents)[0] if len(parents)==1 else ''})
        for _,(geometry,parents) in sorted(control_groups.items())]
    facts['rectangular_control_pair_count']=len(control_rows)
    facts['rectangular_no_effect_observed']=value.before.rows==value.after.rows
    facts['rectangular_before_perimeters']=before
    facts['rectangular_before_perimeter_count']=len(before)
    if len(control_rows)==1:
        facts.update(dict(control_rows[0]))
        facts['rectangular_control_token']=stable_digest((value.transition_ref,control_rows[0]))[:24]
    facts['rectangular_no_effect_token']=stable_digest((value.transition_ref,before))[:24]
    return RectangularCommitmentMeasurements(descriptive_facts=FrozenMap(facts),evidence_refs=value.evidence_refs)


def measure_current_rectangular_commitment(frame,records,context_epoch,contract):
    outlines,bound = _perimeters(frame,contract)
    current = []
    for record in records:
        box=tuple(record['before_bbox'])
        if record['context_epoch']!=context_epoch or _patch(frame,box)!=tuple(tuple(r) for r in record['after_old_patch']):
            continue
        h=record['after_bbox'][2]-record['after_bbox'][0]+1
        matches=tuple(b for b,v in outlines if v==record['perimeter_value'] and b[2]-b[0]+1==h)
        if len(matches)==1 and not bound:
            current.append(record)
    facts={'current_rectangular_commitment_count':len(current)}
    if len(current)==1:
        record=current[0]
        facts.update({'rectangular_commitment_epoch':record['context_epoch'],
            'rectangular_commitment_token':record['rectangular_change_token'],
            'rectangular_commitment_observation_ref':record['term_ref']})
    return facts


def measure_rectangular_context_retests(frame,controls,no_effects,commitments,context_epoch,contract):
    outlines,bound=_perimeters(frame,contract)
    if len(controls)*len(no_effects)>contract['maximum_pairs'] or bound:
        return (), False
    rows=[]
    for control in controls:
        if control['context_epoch']!=context_epoch or control['control_delta_width']==0 or bound:
            continue
        box=tuple(control['control_after_bbox'])
        if (box,control['control_perimeter_value']) not in outlines:
            continue
        parent_refs=tuple(control.get('parent_observation_refs') or (control['parent_observation_ref'],))
        parents=tuple(record for record in commitments
                      if record['term_ref'] in parent_refs
                      and record['context_epoch']==context_epoch
                      and _patch(frame,tuple(record['before_bbox']))==tuple(tuple(r) for r in record['after_old_patch']))
        if len(parents)!=len(parent_refs):
            continue
        first=tuple(control['control_before_bbox'])
        for observation in no_effects:
            if observation['context_epoch']!=context_epoch:
                continue
            matching=tuple(b for b,ink in observation['rectangular_before_perimeters']
                if ink==control['control_perimeter_value'] and b[2]-b[0]==first[2]-first[0]
                and b[3]-b[1]==first[3]-first[1])
            if len(matching)!=1:
                continue
            answered=any(previous['context_epoch']==context_epoch
                and previous['action_ref']==observation['action_ref']
                and previous['control_perimeter_value']==control['control_perimeter_value']
                and previous['control_before_bbox'][2]-previous['control_before_bbox'][0]==box[2]-box[0]
                and previous['control_before_bbox'][3]-previous['control_before_bbox'][1]==box[3]-box[1]
                for previous in controls)
            rows.append(FrozenMap({'action_ref':observation['action_ref'],
                'rectangle_context_probe_token':stable_digest((control['term_ref'],observation['term_ref'],box))[:24],
                'rectangle_control_context_epoch':context_epoch,
                'rectangle_control_context_token':control['rectangular_control_token'],
                'rectangle_control_action_ref':control['action_ref'],
                'rectangle_no_effect_context_token':observation['rectangular_no_effect_token'],
                'rectangle_context_already_observed':answered,
                'rectangle_context_current_bbox':box}))
    return tuple(rows), True
