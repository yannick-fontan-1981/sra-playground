#!/usr/bin/env python3
"""Independent checks for the declared native directed uniform-receiver rule.

The original Python candidates function is never replaced. This verifier uses
unchanged source measurements to compute a separate, explicitly native question
domain. Literal direction, palette values and gap pixels remain unchanged; an
unobserved control offset yields only an existing source calibration question.
The optional typed dependency keeps the original current-pair analogy explicit:
its observed receipt and its different current mask are never one observed law.
"""
from __future__ import annotations
import copy
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('uniform_source_contracts',ROOT/'scripts/export-v6-framed-transfer-reference.py')
contracts=importlib.util.module_from_spec(spec);spec.loader.exec_module(contracts)
g,plain=contracts.g,contracts.plain
from agents.yf_arc3_v5.capabilities.framed_reception_loci import _contains,_center
from agents.yf_arc3_v5.capabilities.framed_replacements import _gap_patches

CONTRACT={'schema':'native.current_uniform_reception_question.v1','maximum_work':65536,'maximum_existing_offers':128}
def unique(values):return sorted(set(values))
def safe_int(value):return type(value) is int and abs(value)<=2**53-1
def vector(first,second):
    numerators=[second[0]+second[2]-first[0]-first[2],second[1]+second[3]-first[1]-first[3]]
    return [value//2 if value%2==0 else value/2 for value in numerators]
def endpoint_patches(span):return [row[1] for row in span.get('endpoint_patches',[])]

def measure_current_uniform_reception_questions(rows,obs,policy,spans=(),receipts=(),attempts=None,existing_offers=(),include_reception_domain=False):
    attempts={} if attempts is None else attempts
    contract=policy.route.get('framed_reception_locus_contract');work=tasks_count=0
    def refused(reason):return {'complete':False,'receptionOffers':[],'calibrationOffers':[],'work_count':work,'reason':reason}
    if not contract or len(receipts)>contract['maximum_records'] or len(existing_offers)>CONTRACT['maximum_existing_offers']:
        return refused('uniform_question_inventory_bound')
    if not safe_int(obs.get('level_epoch')) or not isinstance(obs.get('observation_ref'),str):return refused('uniform_question_observation_invalid')
    width=len(rows[0]) if rows else 0
    if not width or not rows or width*len(rows)>policy.mask['maximum_frame_pixels'] or any(len(row)!=width or any(not safe_int(v) or not 0<=v<=255 for v in row) for row in rows):
        return refused('uniform_question_frame_invalid')
    frame,components,scene=g.extract(rows,obs['observation_ref'])
    measured=plain(g.measure_framed_mask_correspondences(frame,scene.entities,policy.mask))
    bindings,binding_complete=g.measure_current_point_span_bindings(frame,spans,obs['level_epoch'],policy.route['point_motion_span_recall_contract'])
    bindings=plain(bindings)
    if measured['framed_mask_domain_complete'] is not True or not binding_complete:return refused('uniform_question_measurement_incomplete')
    bands=g.measure_parallel_solid_bands(components,policy.route['parallel_band_measurement_contract'])
    if any(facts['parallel_solid_band_domain_complete'] is not True for facts in bands.values()):return refused('uniform_question_band_inventory_incomplete')
    regions=g.point_regions(frame,components,bands);bands=plain(bands);byref={c.component_id:c for c in components}
    occurrences=measured['framed_mask_occurrences'];classes={}
    for witness in receipts:
        work+=1
        if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
        if witness.get('context_epoch')!=obs['level_epoch'] or witness.get('marker_uniform') is not True or witness.get('border_preserved') is not True or not isinstance(witness.get('source_claim_ref'),str) or not witness['source_claim_ref'] or not isinstance(witness.get('source_frame_bbox'),list) or not isinstance(witness.get('marker_frame_bbox'),list):continue
        direction=vector(witness['source_frame_bbox'],witness['marker_frame_bbox'])
        key=g.digest([witness['mask_digest'],witness['mask_extent'],witness['source_inner_value'],witness['source_border_value'],
            witness['marker_inner_value'],witness['marker_border_value'],direction,
            [[axis,[box[2]-box[0],box[3]-box[1]],patch] for axis,box,patch in witness.get('gap_patches',[])]])
        group=classes.setdefault(key,{'witnesses':[],'vector':direction});group['witnesses'].append(witness)
    if len(classes)>contract['maximum_relations']:return refused('uniform_question_class_bound')
    ready={};calibration={}
    def no_attempt(offer):return offer['facts']['candidate_execution_count']==0 and offer['facts'].get('attempted_without_effect_in_current_context') is not True and offer['candidate_ref'] not in attempts
    def mutually_unique(first,second):
        a,b=bands.get(first.component_id,{}),bands.get(second.component_id,{})
        return a.get('parallel_solid_band_domain_complete') is True and b.get('parallel_solid_band_domain_complete') is True and a.get('parallel_solid_band_peer_refs')==[second.component_id] and b.get('parallel_solid_band_peer_refs')==[first.component_id]
    def register(target,offer,task):
        key=g.digest([offer['candidate_ref'],offer['component_ref']]);entry=target.setdefault(key,{'offer':offer,'tasks':{}})
        prior=entry['tasks'].get(task['task_ref'])
        entry['tasks'][task['task_ref']]={**prior,'receipt_claim_refs':unique([*prior['receipt_claim_refs'],*task['receipt_claim_refs']]),
            'span_claim_refs':unique([*prior['span_claim_refs'],*task['span_claim_refs']]),
            'prototype_claim_refs':unique([*prior.get('prototype_claim_refs',[]),*task.get('prototype_claim_refs',[])])} if prior else task
    def current_offer(region,point,facts):
        a,b=(byref.get(ref) for ref in region.support_refs)
        if a is None or b is None or not mutually_unique(a,b):return None
        patches=[{'bbox':[c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom],'value':c.value} for c in [a,b]]
        key=g.digest([obs['level_epoch'],point,patches,rows])
        offer={'candidate_ref':key,'component_ref':region.component_id,'point':list(point),'point_x':point[1],'point_y':point[0],
            'patches':patches,'signature':g.digest(patches),'point_value':rows[point[0]][point[1]],
            'bbox':[min(a.bbox.left,b.bbox.left),min(a.bbox.top,b.bbox.top),max(a.bbox.right,b.bbox.right),max(a.bbox.bottom,b.bbox.bottom)],
            'facts':{**bands[a.component_id],'parallel_solid_band_mutually_unique':True,'framed_reception_analogy':False,**facts,
                'interaction_measurement_kind':'point','candidate_execution_count':int(key in attempts),
                'attempted_without_effect_in_current_context':attempts.get(key,{}).get('unchanged') is True,'candidate_ref':key}}
        return offer if no_attempt(offer) else None
    current_exploration=[]
    for offer in existing_offers:
        a=byref.get(offer['component_ref']);peers=bands.get(a.component_id,{}).get('parallel_solid_band_peer_refs',[]) if a is not None else []
        b=byref.get(peers[0]) if peers else None
        if a is None or b is None or not mutually_unique(a,b):continue
        patches=[{'bbox':[c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom],'value':c.value} for c in [a,b]]
        point=[(min(a.bbox.top,b.bbox.top)+max(a.bbox.bottom,b.bbox.bottom))//2,(min(a.bbox.left,b.bbox.left)+max(a.bbox.right,b.bbox.right))//2]
        if offer['patches']==patches and offer['point']==point and offer['signature']==g.digest(patches) and offer['candidate_ref']==g.digest([obs['level_epoch'],point,patches,rows]):current_exploration.append(offer)
    for _,group in sorted(classes.items()):
        witnesses=sorted(group['witnesses'],key=lambda w:w['source_claim_ref']);witness=witnesses[0];receipt_refs=unique(w['source_claim_ref'] for w in witnesses)
        sources=[r for r in occurrences if r['inner_fills_bbox'] is False and r['mask_digest']==witness['mask_digest'] and r['mask_extent']==witness['mask_extent'] and r['inner_value']==witness['source_inner_value'] and r['border_value']==witness['source_border_value']]
        if len(sources)!=1 or not str(sources[0]['entity_ref']).startswith('shape:'):continue
        source=sources[0];source_box=source['frame_bbox']
        for receiver in occurrences:
            work+=1
            if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
            if receiver['inner_fills_bbox'] is not True or receiver['mask_extent']!=witness['mask_extent'] or receiver['inner_value']!=witness['marker_inner_value'] or receiver['border_value']!=witness['marker_border_value']:continue
            receiver_box=receiver['frame_bbox']
            for span,history in bindings:
                for moving in ['source','receiver']:
                    work+=1
                    if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
                    source_inside,receiver_inside=_contains(span,source_box),_contains(span,receiver_box)
                    if not(source_inside and not receiver_inside if moving=='source' else receiver_inside and not source_inside):continue
                    axis=span['axis'];delta=_center(receiver_box,axis)-_center(source_box,axis) if moving=='source' else _center(source_box,axis)-_center(receiver_box,axis)
                    if not delta:continue
                    low,high=span['after_interval']
                    if low+delta<0 or high+delta>=(frame.width if axis=='column' else frame.height):continue
                    def shift(box,which):return [value+(delta if moving==which and index in ([1,3] if axis=='column' else [0,2]) else 0) for index,value in enumerate(box)]
                    shifted_source,shifted_receiver=shift(source_box,'source'),shift(receiver_box,'receiver')
                    if vector(shifted_source,shifted_receiver)!=group['vector']:continue
                    gaps=[gap for gap in plain(_gap_patches(shifted_source,shifted_receiver,frame)) if gap[0]==axis]
                    matching=[gap for gap in gaps if any(old_axis==gap[0] and gap[1][2]-gap[1][0]==old_box[2]-old_box[0] and gap[1][3]-gap[1][1]==old_box[3]-old_box[1] and gap[2]==old_patch for old_axis,old_box,old_patch in witness.get('gap_patches',[]))]
                    if len(matching)!=1:continue
                    tasks_count+=1
                    if tasks_count>contract['maximum_tasks']:return refused('uniform_question_task_bound')
                    side='lower' if delta<0 else 'upper';span_refs=unique(r['source_claim_ref'] for r in history if isinstance(r.get('source_claim_ref'),str) and r['source_claim_ref'])
                    prototypes=[p for p in spans if p['context_epoch']==obs['level_epoch'] and p['axis']==axis and p['point_before_side']==side
                        and isinstance(p.get('source_claim_ref'),str) and p['source_claim_ref'] and endpoint_patches(p)==endpoint_patches(span) and p['after_interval'][1]-p['after_interval'][0]==high-low]
                    base={'task_ref':'uniform_reception_task:'+g.digest([obs['observation_ref'],source['component_ref'],receiver['component_ref'],span['endpoint_refs'],moving,delta,matching,receipt_refs]),
                        'source':{'component_ref':source['component_ref'],'entity_ref':source['entity_ref'],'frame_bbox':source_box,'mask_digest':source['mask_digest'],'mask_extent':source['mask_extent'],'inner_value':source['inner_value'],'border_value':source['border_value']},
                        'receiver':{'component_ref':receiver['component_ref'],'frame_bbox':receiver_box,'mask_extent':receiver['mask_extent'],'inner_value':receiver['inner_value'],'border_value':receiver['border_value'],'inner_fills_bbox':True},
                        'moving':moving,'axis':axis,'required_side':side,'alignment_delta':delta,'projected_source_bbox':shifted_source,'projected_receiver_bbox':shifted_receiver,
                        'projected_span_interval':[low+delta,high+delta],'literal_gap':matching[0],'observed_source_to_receiver_vector':group['vector'],
                        'orientation_preserved':True,'isometry_applied':False,'palette_mapping_applied':False,'receipt_claim_refs':receipt_refs,'span_claim_refs':span_refs,
                        'current_span':{key:span[key] for key in ['axis','after_interval','orthogonal_interval','endpoint_refs','endpoint_patches']}}
                    for region in regions:
                        work+=1
                        if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
                        usable=[p for p in prototypes if p['operator_value']==region.value]
                        offsets=unique(str(p['point_to_lower_edge'] if side=='lower' else p['point_to_upper_edge']) for p in usable)
                        if len(offsets)!=1:continue
                        offset=int(offsets[0]);coordinate=low+delta+offset if side=='lower' else high+delta-offset
                        if low<=coordinate<=high:continue
                        point=[(region.bbox.top+region.bbox.bottom)//2,coordinate] if axis=='column' else [coordinate,(region.bbox.left+region.bbox.right)//2]
                        orthogonal=point[0] if axis=='column' else point[1]
                        if not(span['orthogonal_interval'][0]<=orthogonal<=span['orthogonal_interval'][1]) or tuple(point) not in region.pixels:continue
                        prototype_refs=unique(p['source_claim_ref'] for p in usable);support_refs=unique([*receipt_refs,*span_refs,*prototype_refs])
                        offer=current_offer(region,point,{'framed_reception_locus_complete':True,'framed_reception_locus_binding_count':1,'framed_reception_locus_same_mask_marker':False,
                            'framed_reception_locus_mask_digest':source['mask_digest'],'framed_reception_locus_expected_delta':delta,'framed_reception_locus_axis':axis,
                            'framed_reception_locus_source_ref':source['component_ref'],'framed_reception_locus_marker_ref':receiver['component_ref'],
                            'framed_reception_locus_local_operator':any(p['endpoint_refs']==span['endpoint_refs'] for p in usable),'framed_reception_locus_premise_refs':support_refs,
                            'operator_value_current':region.value,'operator_value_observed':region.value,'operator_value_matches_observation':True})
                        if offer:register(ready,offer,{**base,'prototype_status':'observed_current_epoch','prototype_claim_refs':prototype_refs,
                            'span_claim_refs':unique([*span_refs,*prototype_refs]),'operator_value_current':region.value,'observed_offset':offset,'qualified_point':point})
                    for offer in current_exploration:
                        work+=1
                        if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
                        facts=offer['facts']
                        if not no_attempt(offer) or facts.get('parallel_solid_band_domain_complete') is not True or facts.get('parallel_solid_band_peer_count')!=1 or facts.get('parallel_solid_band_mutually_unique') is not True or facts.get('framed_reception_analogy') is True:continue
                        point=offer['point'];coordinate,orthogonal=(point[1],point[0]) if axis=='column' else (point[0],point[1])
                        if not(span['orthogonal_interval'][0]<=orthogonal<=span['orthogonal_interval'][1]) or (coordinate>=low if side=='lower' else coordinate<=high) or offer['point_value']!=rows[point[0]][point[1]]:continue
                        related=[]
                        for other,_ in bindings:
                            c,o=(point[1],point[0]) if other['axis']=='column' else (point[0],point[1])
                            if other['orthogonal_interval'][0]<=o<=other['orthogonal_interval'][1] and (c<other['after_interval'][0] or c>other['after_interval'][1]):related.append(other)
                        if len(related)!=1 or any(p['operator_value']==offer['point_value'] for p in prototypes):continue
                        register(calibration,offer,{**base,'prototype_status':'missing_for_required_side_and_current_value','prototype_claim_refs':[],
                            'operator_value_current':offer['point_value'],'existing_candidate_ref':offer['candidate_ref'],'existing_component_ref':offer['component_ref'],
                            'calibration_point':offer['point'],'pending_alignment_is_not_an_action_plan':True})
                    if len(ready)+len(calibration)>contract['maximum_loci']:return refused('uniform_question_offer_bound')
    # Missing-side questions may also depend on the original source's current
    # typed analogy. This creates no typed reception, offset or point candidate.
    by_component={row['component_ref']:row for row in occurrences};source_markers={};typed_relations=[]
    for _,group in sorted(classes.items()):
        witness=group['witnesses'][0]
        for pair in measured['framed_mask_pairs']:
            for first,second in [('first','second'),('second','first')]:
                work+=1
                if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
                if pair['mask_extent']!=witness['mask_extent'] or pair[first+'_inner_value']!=witness['source_inner_value'] or pair[first+'_border_value']!=witness['source_border_value']:continue
                source,receiver=by_component.get(pair[first+'_component_ref']),by_component.get(pair[second+'_component_ref'])
                if source is None or receiver is None:continue
                source_markers.setdefault(source['component_ref'],set()).add(receiver['component_ref'])
                typed_relations.append((group,source,receiver))
                if len(typed_relations)>contract['maximum_relations']:return refused('typed_calibration_relation_bound')
    for group,source,receiver in typed_relations:
        if len(source_markers.get(source['component_ref'],()))!=1:continue
        matching_sources=[row for row in occurrences if row['mask_digest']==source['mask_digest'] and row['inner_value']==source['inner_value']
            and row['border_value']==source['border_value'] and row['mask_extent']==source['mask_extent']]
        if len(matching_sources)!=1:continue
        witnesses=sorted(group['witnesses'],key=lambda row:row['source_claim_ref']);witness=witnesses[0]
        receipt_refs=unique(row['source_claim_ref'] for row in witnesses);source_box,receiver_box=source['frame_bbox'],receiver['frame_bbox']
        for span,history in bindings:
            for moving in ['source','receiver']:
                work+=1
                if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
                source_inside,receiver_inside=_contains(span,source_box),_contains(span,receiver_box)
                if not(source_inside and not receiver_inside if moving=='source' else receiver_inside and not source_inside):continue
                axis=span['axis'];delta=_center(receiver_box,axis)-_center(source_box,axis) if moving=='source' else _center(source_box,axis)-_center(receiver_box,axis)
                if not delta:continue
                low,high=span['after_interval']
                if low+delta<0 or high+delta>=(frame.width if axis=='column' else frame.height):continue
                def shift(box,which):return [value+(delta if moving==which and index in ([1,3] if axis=='column' else [0,2]) else 0) for index,value in enumerate(box)]
                shifted_source,shifted_receiver=shift(source_box,'source'),shift(receiver_box,'receiver')
                if vector(shifted_source,shifted_receiver)!=group['vector']:continue
                matching=[gap for gap in plain(_gap_patches(shifted_source,shifted_receiver,frame)) if gap[0]==axis and any(old_axis==gap[0]
                    and gap[1][2]-gap[1][0]==old_box[2]-old_box[0] and gap[1][3]-gap[1][1]==old_box[3]-old_box[1] and gap[2]==old_patch
                    for old_axis,old_box,old_patch in witness.get('gap_patches',[]))]
                if len(matching)!=1:continue
                tasks_count+=1
                if tasks_count>contract['maximum_tasks']:return refused('uniform_question_task_bound')
                side='lower' if delta<0 else 'upper';span_refs=unique(row['source_claim_ref'] for row in history if isinstance(row.get('source_claim_ref'),str) and row['source_claim_ref'])
                prototypes=[row for row in spans if row['context_epoch']==obs['level_epoch'] and row['axis']==axis and row['point_before_side']==side
                    and isinstance(row.get('source_claim_ref'),str) and row['source_claim_ref'] and endpoint_patches(row)==endpoint_patches(span)
                    and row['after_interval'][1]-row['after_interval'][0]==high-low]
                hypotheses=[{'hypothesis_ref':'hypothesis:frame_analogy:'+g.digest([row['source_claim_ref'],receiver['inner_value'],receiver['border_value'],source['mask_extent']]),
                    'observed_claim':row['source_claim_ref'],'observed_mask_digest':row['mask_digest'],'current_mask_digest':source['mask_digest'],
                    'source_ref':source['component_ref'],'marker_ref':receiver['component_ref'],'epistemic_status':'hypothesis_not_observed_reception'} for row in witnesses]
                for offer in current_exploration:
                    work+=1
                    if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
                    facts=offer['facts']
                    if not no_attempt(offer) or facts.get('parallel_solid_band_domain_complete') is not True or facts.get('parallel_solid_band_peer_count')!=1 or facts.get('parallel_solid_band_mutually_unique') is not True or facts.get('framed_reception_analogy') is True:continue
                    point=offer['point'];coordinate,orthogonal=(point[1],point[0]) if axis=='column' else (point[0],point[1])
                    if not(span['orthogonal_interval'][0]<=orthogonal<=span['orthogonal_interval'][1]) or (coordinate>=low if side=='lower' else coordinate<=high) or offer['point_value']!=rows[point[0]][point[1]]:continue
                    related=[]
                    for other,_ in bindings:
                        c,o=(point[1],point[0]) if other['axis']=='column' else (point[0],point[1])
                        if other['orthogonal_interval'][0]<=o<=other['orthogonal_interval'][1] and (c<other['after_interval'][0] or c>other['after_interval'][1]):related.append(other)
                    if len(related)!=1 or any(row['operator_value']==offer['point_value'] for row in prototypes):continue
                    register(calibration,offer,{'task_ref':'typed_reception_calibration_task:'+g.digest([obs['observation_ref'],source['component_ref'],receiver['component_ref'],
                        span['endpoint_refs'],moving,delta,matching,hypotheses]),'basis_kind':'current_typed_analogy_prerequisite',
                        'source_reception_projection_ref':'projection.current_observed_entry_analogy','source_hypotheses':hypotheses,'typed_reception_observed':False,
                        'source':{key:source[key] for key in ['component_ref','entity_ref','frame_bbox','mask_digest','mask_extent','inner_value','border_value']},
                        'receiver':{key:receiver[key] for key in ['component_ref','frame_bbox','mask_digest','mask_extent','inner_value','border_value','inner_fills_bbox']},
                        'moving':moving,'axis':axis,'required_side':side,'alignment_delta':delta,'projected_source_bbox':shifted_source,'projected_receiver_bbox':shifted_receiver,
                        'projected_span_interval':[low+delta,high+delta],'literal_gap':matching[0],'observed_source_to_receiver_vector':group['vector'],
                        'orientation_preserved':True,'isometry_applied':False,'palette_mapping_applied':False,'receipt_claim_refs':receipt_refs,'span_claim_refs':span_refs,
                        'current_span':{key:span[key] for key in ['axis','after_interval','orthogonal_interval','endpoint_refs','endpoint_patches']},
                        'prototype_status':'missing_for_required_side_and_current_value','prototype_claim_refs':[],'operator_value_current':offer['point_value'],
                        'existing_candidate_ref':offer['candidate_ref'],'existing_component_ref':offer['component_ref'],'calibration_point':offer['point'],
                        'pending_alignment_is_not_an_action_plan':True})
                    if len(ready)+len(calibration)>contract['maximum_loci']:return refused('uniform_question_offer_bound')
    # Reception uniqueness is physical-point scoped. Distinct display/support
    # descriptions cannot each turn a shared click into one unique task.
    physical_tasks={};source_ambiguous=set()
    def task_key(source,receiver,mask,axis,delta,same_mask):return g.digest([source,receiver,mask,axis,delta,same_mask])
    def register_physical(point,key,native_task_ref=None):
        tasks=physical_tasks.setdefault(tuple(point),{});bindings=tasks.setdefault(key,set())
        if native_task_ref is not None:bindings.add(native_task_ref)
    for entry in ready.values():
        for task in entry['tasks'].values():
            work+=1
            if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
            register_physical(entry['offer']['point'],task_key(task['source']['component_ref'],task['receiver']['component_ref'],
                task['source']['mask_digest'],task['axis'],task['alignment_delta'],False),task['task_ref'])
    locus_fields=['framed_reception_locus_source_ref','framed_reception_locus_marker_ref','framed_reception_locus_mask_digest',
        'framed_reception_locus_axis','framed_reception_locus_expected_delta','framed_reception_locus_same_mask_marker']
    for offer in existing_offers:
        work+=1
        if work>CONTRACT['maximum_work']:return refused('uniform_question_work_bound')
        facts=offer['facts'];count=facts.get('framed_reception_locus_binding_count')
        if type(count) not in [int,float] or count<=0:continue
        point=tuple(offer['point'])
        if any(field not in facts for field in locus_fields):source_ambiguous.add(point);continue
        register_physical(point,task_key(*(facts[field] for field in locus_fields)))
        # The original candidate map can retain one description of a declared
        # multiplicity. Preserve that refusal without mutating source facts.
        if count!=1 or facts.get('framed_reception_locus_complete') is not True:source_ambiguous.add(point)
    def finish(entries,kind):
        result=[]
        for _,entry in sorted(entries.items()):
            tasks=sorted(entry['tasks'].values(),key=lambda task:task['task_ref'])
            point=tuple(entry['offer']['point']);physical_count=sum(max(1,len(refs)) for refs in physical_tasks.get(point,{}).values())
            if kind=='reception_question' and (len(tasks)!=1 or physical_count!=1 or point in source_ambiguous):continue
            receipt_refs=unique(ref for task in tasks for ref in task['receipt_claim_refs']);span_refs=unique(ref for task in tasks for ref in task['span_claim_refs'])
            typed_tasks=[task for task in tasks if task.get('basis_kind')=='current_typed_analogy_prerequisite']
            witness={'kind':kind,'question_ref':'uniform_reception_question:'+g.digest([obs['observation_ref'],kind,entry['offer']['candidate_ref'],entry['offer']['component_ref'],tasks]),
                **({'basis_kind':'current_typed_analogy_prerequisite' if len(typed_tasks)==len(tasks) else 'mixed_current_reception_prerequisites'} if typed_tasks else {}),
                'schema':CONTRACT['schema'],'current_observation_ref':obs['observation_ref'],'context_epoch':obs['level_epoch'],'current_frame_hash':obs.get('frame_hash'),
                'current_rows_sha256':g.digest(rows),'receipt_claim_refs':receipt_refs,'span_claim_refs':span_refs,'tasks':tasks,
                'expected_effect_status':'control_offset_to_be_observed' if kind=='calibration_dependency' else 'conditional_reception_not_terminal_law',
                'historical_receipt_reused':False,'terminal_completion_claimed':False,'stored_action_sequence':False}
            result.append({**copy.deepcopy(entry['offer']),'native_uniform_reception_question':witness})
        return result
    occupied={}
    if include_reception_domain:
        for entry in ready.values():
            key=json.dumps(entry['offer']['point'],separators=(',',':'))
            value=occupied.setdefault(key,{'point':entry['offer']['point'],'refs':set()})
            value['refs'].update(entry['tasks'])
    return {'complete':True,'receptionOffers':finish(ready,'reception_question'),'calibrationOffers':finish(calibration,'calibration_dependency'),'work_count':work,
        **({'occupiedReceptionPoints':[{'point':value['point'],'raw_task_count':len(value['refs']),'task_refs':unique(value['refs'])}
            for key,value in sorted(occupied.items())]} if include_reception_domain else {})}
