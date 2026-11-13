"""Bounded framed raster pairs and repeated one-outlier support inventories.

No region is assigned a role, accepted as a request, or selected for action.
"""
from collections import Counter,defaultdict
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap,FrozenModel,stable_digest
from .contracts import FrameGrid


class FramedPacketObservationInput(FrozenModel):
    before:FrameGrid
    packet:tuple[FrameGrid,...]=Field(max_length=128)
    region_contract:FrozenMap
    comparison_contract:FrozenMap
    transition_ref:str
    before_epoch:int=Field(ge=1)
    after_epoch:int=Field(ge=1)
    evidence_refs:tuple[str,...]=Field(min_length=1,max_length=8)
    schema_version:str='yf_arc3_v5.framed_packet_observation_input.v1'


class FramedPacketObservationMeasurements(FrozenModel):
    descriptive_facts:FrozenMap
    evidence_refs:tuple[str,...]
    schema_version:str='yf_arc3_v5.framed_packet_observation_measurements.v1'


def measure_framed_packet_observation(value):
    from .components import detect_components
    from .contracts import ComponentExtractionInput
    components=detect_components(ComponentExtractionInput(frame=value.before,
        connectivity=value.region_contract['component_connectivity'])).components
    measured=measure_framed_packet_regions(value.before,value.packet,components,value.region_contract)
    windows=measure_framed_packet_windows(measured,value.comparison_contract,value.transition_ref,value.before_epoch)
    facts=FrozenMap({'framed_packet_pair_count':measured['framed_packet_pair_count'],
        'packet_same_context_epoch':value.before_epoch==value.after_epoch,
        'context_epoch':value.before_epoch,'transition_ref':value.transition_ref,
        **dict(windows)})
    return FramedPacketObservationMeasurements(descriptive_facts=facts,evidence_refs=value.evidence_refs)


def _inside(a,b):
    return a[0]<=b[0]<=b[2]<=a[2] and a[1]<=b[1]<=b[3]<=a[3]


def _crop(rows,b):
    return tuple(tuple(row[b[1]:b[3]+1]) for row in rows[b[0]:b[2]+1])


def measure_framed_packet_regions(before,packet,components,contract):
    if not contract or len(packet)<int(contract['minimum_packet_frames']):
        return FrozenMap({'framed_packet_pair_count':0,'framed_packet_pair_rows':()})
    if len(packet)>int(contract['maximum_packet_frames']):
        return FrozenMap({'framed_packet_pair_count':0,'framed_packet_bound_reached':True,'framed_packet_pair_rows':()})
    frames=(before.rows,*(f.rows for f in packet))
    if any(len(f)!=before.height or any(len(r)!=before.width for r in f) for f in frames):
        return FrozenMap({'framed_packet_pair_count':0,'framed_packet_pair_rows':()})
    boxes=[]
    for c in components:
        b=c.bbox
        if min(b.height,b.width)<int(contract['minimum_border_side']):continue
        perimeter={(r,k) for r in range(b.top,b.bottom+1) for k in range(b.left,b.right+1)
                   if r in (b.top,b.bottom) or k in (b.left,b.right)}
        if not perimeter.issubset(c.pixels):continue
        if any(len({f[r][k] for r,k in perimeter})!=1 for f in frames):continue
        inner=(b.top+1,b.left+1,b.bottom-1,b.right-1)
        if (inner not in boxes and len({v for row in _crop(frames[0],inner) for v in row})>=
                int(contract['minimum_inner_palette_count'])):boxes.append(inner)
    if len(boxes)>int(contract['maximum_framed_regions']):
        return FrozenMap({'framed_packet_pair_count':0,'framed_packet_bound_reached':True,'framed_packet_pair_rows':()})
    groups=defaultdict(list)
    for c in components:
        b=c.bbox;box=(b.top,b.left,b.bottom,b.right)
        if (b.height!=b.width or c.area!=b.height*b.width
            or not int(contract['minimum_uniform_support_side'])<=b.height<=int(contract['maximum_uniform_support_side'])):continue
        groups[(b.top,b.bottom,b.width)].append(box)
    inventories=[]
    for group_key in sorted(groups):
        group=groups[group_key]
        group=tuple(sorted(group,key=lambda x:x[1]));n=len(group)
        if not int(contract['minimum_uniform_support_count'])<=n<=int(contract['maximum_uniform_support_count']):continue
        pitches={b[1]-a[1] for a,b in zip(group,group[1:])}
        if len(pitches)!=1 or next(iter(pitches))<=group[0][3]-group[0][1]:continue
        indices=[]
        for f in frames:
            patches=tuple(_crop(f,b) for b in group)
            if any(len({v for row in p for v in row})!=1 for p in patches):break
            values=tuple(p[0][0] for p in patches);counts=Counter(values)
            singles=tuple(i for i,v in enumerate(values) if counts[v]==1)
            if len(counts)!=2 or len(singles)!=1 or max(counts.values())!=n-1:break
            indices.append(singles[0])
        if len(indices)==len(frames) and len(set(indices))>=int(contract['minimum_distinct_marker_ordinals']):
            inventories.append((group,tuple(indices)))
    rows=[]
    for small in boxes:
        patch=_crop(frames[0],small)
        if len(patch)*len(patch[0])>int(contract['maximum_fixed_patch_pixels']):continue
        if any(_crop(f,small)!=patch for f in frames):continue
        for large in boxes:
            if (small==large or _inside(large,small) or _inside(small,large)
                or large[2]-large[0]<small[2]-small[0] or large[3]-large[1]<small[3]-small[1]):continue
            crops=tuple(_crop(f,large) for f in frames)
            if len(set(crops))<int(contract['minimum_distinct_large_patches']):continue
            for group,indices in inventories:
                if any(_inside(large,b) or _inside(small,b) for b in group):continue
                by_index={};consistent=True
                for i,crop in zip(indices,crops):
                    if i in by_index and by_index[i]!=crop:consistent=False;break
                    by_index[i]=crop
                if not consistent:continue
                token=stable_digest((small,large,group,patch))[:24]
                rows.append(FrozenMap({'framed_packet_geometry_token':token,
                    'fixed_patch_bbox':small,'fixed_patch_rows':patch,'varying_patch_bbox':large,
                    'uniform_support_bboxes':group,'ordered_marker_ordinals':indices,
                    'indexed_patch_rows':tuple((i,by_index[i]) for i in sorted(by_index)),
                    'uniform_support_count':len(group),'observed_index_count':len(by_index),
                    'uniform_support_ordinal_coverage_complete':set(by_index)==set(range(len(group))),
                    'current_marker_ordinal':indices[-1]}))
                if len(rows)>int(contract['maximum_framed_pairs']):
                    return FrozenMap({'framed_packet_pair_count':0,'framed_packet_bound_reached':True,'framed_packet_pair_rows':()})
    return FrozenMap({'framed_packet_pair_count':len(rows),'framed_packet_pair_rows':tuple(rows)})


def measure_framed_packet_windows(measured, contract, transition_ref, epoch):
    """Compare every measured pair through the existing source-configured kernel."""
    from .contracts import FrameGrid
    from .temporal_fragment_match import (FragmentModel,FragmentPhoto,FragmentWindow,
        TemporalFragmentRequest,measure_temporal_fragment_match)
    from .mechanical_family_contracts_d import DMechanicalScope
    matches=[];complete=True;receipts=[]
    for pair in measured['framed_packet_pair_rows']:
        token=pair['framed_packet_geometry_token']
        reference=FrameGrid(rows=pair['fixed_patch_rows'])
        model=FragmentModel(model_ref=f'{transition_ref}:{token}',
            photo_count=pair['uniform_support_count'],equality_law_ref=contract['equality_law_ref'])
        for ordinal,rows in pair['indexed_patch_rows']:
            frame=FrameGrid(rows=rows);ref=f'{transition_ref}:{token}:{ordinal}'
            windows=tuple(FragmentWindow(window_ref=f'{ref}:{r}:{c}',photo_ref=ref,top=r,left=c)
                for r in range(frame.height-reference.height+1)
                for c in range(frame.width-reference.width+1))
            if len(windows)>int(contract['maximum_window_count']):complete=False;continue
            scope=DMechanicalScope(request_ref=ref,epoch=epoch,evidence_revision_ref=transition_ref,
                model_revision_ref=token,event_owner_ref=transition_ref,**dict(contract['scope_fields']))
            photo=FragmentPhoto(photo_ref=ref,scene_ref=transition_ref,film_revision_ref=token,
                photo_index=ordinal,frame=frame,evidence_ref=ref,
                content_support_ref=f'{token}:large_patch',content_kind_ref=contract['content_kind_ref'])
            request=TemporalFragmentRequest(scope=scope,operation_ref=contract['operation_ref'],
                mode_ref=contract['mode_ref'],requested_result_type=contract['requested_result_type'],
                node_bound=int(contract['node_bound']),depth_bound=int(contract['depth_bound']),
                domain_bound=int(contract['maximum_window_count']),time_bound_ms=int(contract['time_bound_ms']),
                models=(model,),reference=reference,reference_revision_ref=f'{token}:fixed_patch',
                photos=(photo,),windows=windows)
            result=measure_temporal_fragment_match(request)
            receipts.append(FrozenMap({'request_ref':ref,'operation_ref':result.operation_ref,
                'status':result.status,'cause':result.cause,'domain_complete':result.domain_complete,
                'examined_count':result.examined_count}))
            complete=complete and result.domain_complete
            for row in result.values.get('model_correlated_results',()):
                for window in row['result'].get('window_results',()):
                    if not window['exact_match']:continue
                    top=pair['varying_patch_bbox'][0]+window['window_top']
                    left=pair['varying_patch_bbox'][1]+window['window_left']
                    matches.append(FrozenMap({'framed_packet_geometry_token':token,
                        'fixed_patch_bbox':pair['fixed_patch_bbox'],'fixed_patch_rows':pair['fixed_patch_rows'],
                        'varying_patch_bbox':pair['varying_patch_bbox'],
                        'uniform_support_bboxes':pair['uniform_support_bboxes'],
                        'uniform_support_ordinal_coverage_complete':pair['uniform_support_ordinal_coverage_complete'],
                        'matching_marker_ordinal':ordinal,'matching_window_bbox':(top,left,
                            top+reference.height-1,left+reference.width-1),
                        'comparison_evidence_ref':ref,'comparison_operation_ref':result.operation_ref}))
    facts={'framed_packet_exact_match_count':len(matches),
        'framed_packet_comparison_domain_complete':complete,
        'framed_packet_comparison_receipts':tuple(receipts)}
    if len(matches)==1:facts.update(matches[0])
    return FrozenMap(facts)


def measure_current_indexed_window_loci(frame,records,epoch):
    rows=[]
    for record in records:
        small=tuple(record['fixed_patch_bbox']);large=tuple(record['varying_patch_bbox'])
        window=tuple(record['matching_window_bbox']);slots=tuple(record['uniform_support_bboxes'])
        if any(not (0<=b[0]<=b[2]<frame.height and 0<=b[1]<=b[3]<frame.width)
               for b in (small,large,window,*slots)):continue
        patches=tuple(_crop(frame.rows,b) for b in slots)
        if any(len({v for row in p for v in row})!=1 for p in patches):continue
        values=tuple(p[0][0] for p in patches);counts=Counter(values)
        singles=tuple(i for i,v in enumerate(values) if counts[v]==1)
        if len(counts)!=2 or len(singles)!=1 or max(counts.values())!=len(slots)-1:continue
        ordinal=record['matching_marker_ordinal']
        if not 0<=ordinal<len(slots):continue
        common={'indexed_window_term_ref':record['term_ref'],
            'indexed_window_context_epoch':record['context_epoch'],
            'indexed_window_geometry_token':record['framed_packet_geometry_token'],
            'indexed_current_context_epoch_matches':record['context_epoch']==epoch,
            'indexed_current_fixed_patch_equals_acquired_patch':_crop(frame.rows,small)==tuple(record['fixed_patch_rows']),
            'indexed_current_marker_equals_matching_ordinal':singles[0]==ordinal,
            'indexed_current_window_equals_acquired_patch':_crop(frame.rows,window)==tuple(record['fixed_patch_rows']),
            'indexed_window_comparison_evidence_ref':record['comparison_evidence_ref']}
        outer=(large[0]-1,large[1]-1,large[2]+1,large[3]+1)
        for kind,box,support in (('uniform_support_center',slots[ordinal],slots[ordinal]),
                                 ('matched_window_center',window,outer)):
            rows.append(FrozenMap({**common,'indexed_window_locus_kind':kind,
                'indexed_window_current_component_bbox':support,
                'point':((box[0]+box[2])//2,(box[1]+box[3])//2)}))
    return tuple(rows)
