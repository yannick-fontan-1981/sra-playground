#!/usr/bin/env python3
"""Independent specification of the declared native public-packet extension.

This is new verification code, not an original Python capability. It derives
every expected row from actual public frames using the unchanged pinned source
extractor, mask measurement, point-span transition and gap sampler. No native
result, game implementation, hidden state or synthetic intermediate action is
used as an expectation. The existing source FramedTransfer acquisition remains
separate from these explicitly native observations.
"""
from __future__ import annotations
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('v52_reception_source_contracts',ROOT/'scripts/export-v6-framed-transfer-reference.py')
contracts=importlib.util.module_from_spec(spec);spec.loader.exec_module(contracts)
g=contracts.g
plain=contracts.plain
from agents.yf_arc3_v5.capabilities.framed_replacements import _gap_patches

CONTRACT={
    'schema':'native.framed_public_packet_reception.v1',
    'maximum_frames':64,'maximum_total_pixels':262144,'maximum_tracked_signatures':128,
    'maximum_work':65536,'maximum_receptions':64,'minimum_stable_frames':2,'stationary_collar_width':1,
}

def safe_int(value):return type(value) is int and -(2**53-1)<=value<=2**53-1
def rows_in_domain(rows,width,height):
    return isinstance(rows,list) and len(rows)==height and all(isinstance(row,list) and len(row)==width
        and all(safe_int(value) and 0<=value<=255 for value in row) for row in rows)
def intersects(first,second):
    return first[0]<=second[2] and second[0]<=first[2] and first[1]<=second[3] and second[1]<=first[3]
def motion_box(span,which):
    low,high=span['point_span_'+which+'_interval'];orthogonal_low,orthogonal_high=span['point_span_orthogonal_interval']
    return [orthogonal_low,low,orthogonal_high,high] if span['point_span_axis']=='column' else [low,orthogonal_low,high,orthogonal_high]
def collar(frame,box):
    top,left,bottom,right=box[0]-1,box[1]-1,box[2]+1,box[3]+1
    if top<0 or left<0 or bottom>=frame.height or right>=frame.width:return None
    return [[y,x,frame.rows[y][x]] for y in range(top,bottom+1) for x in range(left,right+1)
            if y in (top,bottom) or x in (left,right)]

def measure_current_public_packet_receptions(first,final,before,after,command,frames,policy):
    """Bounded observations within one returned command; no effect law follows."""
    work=0
    def refusal(reason):return {'complete':False,'rows':[],'frame_count':len(frames),'work_count':work,'reason':reason}
    if not frames:return refusal('public_frame_packet_unavailable')
    if len(frames)>CONTRACT['maximum_frames']:return refusal('public_frame_count_bound')
    if not safe_int(before.get('level_epoch')) or before.get('level_epoch')!=after.get('level_epoch') or not isinstance(before.get('observation_ref'),str) or not isinstance(after.get('observation_ref'),str):
        return refusal('public_epoch_or_observation_mismatch')
    height=len(first);width=len(first[0]) if first else 0;pixels=height*width
    if not height or not width or pixels>policy.mask['maximum_frame_pixels'] or pixels*(len(frames)+1)>CONTRACT['maximum_total_pixels']:
        return refusal('public_frame_pixel_bound')
    if not rows_in_domain(first,width,height) or not rows_in_domain(final,width,height) or any(not rows_in_domain(rows,width,height) for rows in frames):
        return refusal('public_frame_domain_invalid')
    if frames[-1]!=final:return refusal('public_frame_packet_final_mismatch')
    data=command.get('data') or {}
    if not isinstance(command.get('action_ref'),str) or not safe_int(data.get('x')) or not safe_int(data.get('y')) or not(0<=data['x']<width and 0<=data['y']<height):
        return refusal('public_point_command_invalid')
    contract=policy.policies.get('policy.record_observed_framed_replacement',{}).get('configuration',{}).get('measurement_contract')
    if not contract or not safe_int(contract.get('maximum_replacements')) or contract['maximum_replacements']<0:
        return refusal('replacement_contract_unavailable')
    spans,_=g.transition(first,final,before,after,command,policy)
    if spans['point_motion_span_domain_complete'] is not True:return refusal('outer_point_motion_domain_incomplete')
    spans=spans['point_motion_span_rows']
    if not spans:return refusal('outer_point_motion_witness_unavailable')
    moving_supports=[]
    for span in spans:
        start,end=motion_box(span,'before'),motion_box(span,'after')
        swept=[min(start[0],end[0]),min(start[1],end[1]),max(start[2],end[2]),max(start[3],end[3])]
        moving_supports.append({'token':span['point_span_token'],'before_bbox':start,'after_bbox':end,'swept_bbox':swept})
    moving_boxes=[span['swept_bbox'] for span in moving_supports]
    parent='transition:'+g.digest([before['observation_ref'],after['observation_ref'],command])
    snapshots=[];tracks={}
    for position,rows in enumerate([first,*frames]):
        index=position-1;rows_hash=g.digest(rows)
        ref=before['observation_ref'] if index<0 else after['observation_ref']+':public_frame:'+str(index)+':rows:'+rows_hash
        frame,_,scene=g.extract(rows,ref)
        measured=plain(g.measure_framed_mask_correspondences(frame,scene.entities,policy.mask))
        if measured['framed_mask_domain_complete'] is not True:return refusal('public_mask_inventory_incomplete')
        occurrences=measured['framed_mask_occurrences']
        if len(scene.entities)>contract['maximum_components'] or len(occurrences)>contract['maximum_occurrences']:
            return refusal('public_replacement_inventory_bound')
        snapshots.append({'index':index,'frame':frame,'hash':rows_hash,'ref':ref,'occurrences':occurrences})
        groups={}
        for occurrence in occurrences:
            work+=1
            if work>CONTRACT['maximum_work']:return refusal('public_reception_work_bound')
            if occurrence['inner_fills_bbox']:continue
            key=g.digest([occurrence['inner_value'],occurrence['mask_digest']]);groups.setdefault(key,[]).append(occurrence)
        for key,group in groups.items():
            if len(group)!=1 or not str(group[0]['entity_ref']).startswith('shape:'):continue
            tracks.setdefault(key,[]).append({'snapshot':position,'occurrence':group[0]})
            if len(tracks)>CONTRACT['maximum_tracked_signatures']:return refusal('public_signature_count_bound')
    result=[]
    for key,positions in sorted(tracks.items()):
        runs=[];current=None
        for position in positions:
            work+=1
            if work>CONTRACT['maximum_work']:return refusal('public_reception_work_bound')
            if current and position['snapshot']==current['end']+1 and position['occurrence']['frame_bbox']==current['occurrence']['frame_bbox'] and position['occurrence']['border_value']==current['occurrence']['border_value']:
                current={**current,'end':position['snapshot']};runs[-1]=current
            else:
                current={'start':position['snapshot'],'end':position['snapshot'],'occurrence':position['occurrence']};runs.append(current)
        previous=None
        for run in runs:
            if run['end']-run['start']+1<CONTRACT['minimum_stable_frames']:continue
            source_run,previous=previous,run
            if source_run is None:continue
            chain=[p for p in positions if source_run['end']<=p['snapshot']<=run['end']]
            if len(chain)!=run['end']-source_run['end']+1:continue
            source,displayed=source_run['occurrence'],run['occurrence'];source_box,target_box=source['frame_bbox'],displayed['frame_bbox']
            dr,dc=target_box[0]-source_box[0],target_box[1]-source_box[1]
            if (dr==0)==(dc==0) or intersects(source_box,target_box) or displayed['border_value']!=source['border_value'] or source['mask_extent']!=displayed['mask_extent']:continue
            if any(intersects(source_box,box) or intersects(target_box,box) for box in moving_boxes):continue
            old,settled,arrival=snapshots[source_run['end']],snapshots[run['end']],snapshots[run['start']]
            markers=[r for r in old['occurrences'] if r['inner_fills_bbox'] is True and r['frame_bbox']==target_box and r['mask_extent']==source['mask_extent']]
            if len(markers)!=1:continue
            marker=markers[0]
            if any(r['inner_fills_bbox'] is True and r['frame_bbox']==target_box for r in settled['occurrences']):continue
            before_collar,after_collar=collar(old['frame'],target_box),collar(settled['frame'],target_box)
            if before_collar is None or after_collar is None or before_collar!=after_collar:continue
            def lateral(pixels):
                return [pixel for pixel in pixels if (pixel[1] in (target_box[1]-1,target_box[3]+1) if dr!=0 else pixel[0] in (target_box[0]-1,target_box[2]+1))]
            before_lateral=lateral(before_collar);lateral_unchanged=True
            for index in range(source_run['end'],run['end']+1):
                work+=1
                if work>CONTRACT['maximum_work']:return refusal('public_reception_work_bound')
                pixels=collar(snapshots[index]['frame'],target_box)
                if pixels is None or lateral(pixels)!=before_lateral:lateral_unchanged=False
            if not lateral_unchanged:continue
            marker_stayed=True
            for index in range(source_run['end'],run['start']):
                work+=1
                if work>CONTRACT['maximum_work']:return refusal('public_reception_work_bound')
                if not any(r['inner_fills_bbox'] is True and r['frame_bbox']==target_box and r['inner_value']==marker['inner_value'] and r['border_value']==marker['border_value'] for r in snapshots[index]['occurrences']):marker_stayed=False
            if not marker_stayed:continue
            gaps=plain(_gap_patches(source_box,target_box,settled['frame']))
            if len(gaps)!=1:continue
            segment='public_packet_reception:'+g.digest([parent,old['index'],arrival['index'],settled['index'],source['entity_ref'],marker['entity_ref']])
            facts={
                'framed_replacement_token':g.digest([segment,source['entity_ref'],marker['entity_ref'],'stationary_uniform_public_packet']),
                'framed_replacement_source_ref':source['entity_ref'],'framed_replacement_current_visible_ref':displayed['entity_ref'],
                'framed_replacement_marker_ref':marker['entity_ref'],'framed_replacement_tracking_lineage_agrees':displayed['entity_ref']==source['entity_ref'],
                'framed_replacement_marker_uniform':True,'framed_replacement_gap_patches':gaps,
                'framed_replacement_mask_digest':source['mask_digest'],'framed_replacement_mask_extent':source['mask_extent'],
                'framed_replacement_source_inner_value':source['inner_value'],'framed_replacement_source_border_value':source['border_value'],
                'framed_replacement_marker_inner_value':marker['inner_value'],'framed_replacement_marker_border_value':marker['border_value'],
                'framed_replacement_after_border_value':displayed['border_value'],'framed_replacement_border_preserved':True,
                'framed_replacement_source_frame_bbox':source_box,'framed_replacement_marker_frame_bbox':target_box,
                'framed_replacement_before_marker_frame_bbox':target_box,'framed_replacement_receiver_endpoint_refs':None,
                'framed_replacement_delta':[dr,dc],'framed_replacement_action_ref':command['action_ref'],
                'framed_replacement_transition_ref':segment,'framed_replacement_context_epoch':before['level_epoch'],
                'framed_replacement_frame_ref':settled['ref'],'framed_replacement_unique_preserved_copy':True,
                'framed_replacement_marker_disappeared':True,'framed_replacement_prior_goal_ref':None,'framed_replacement_prior_subgoal_ref':None,
            }
            def describe(snapshot):return {'packet_index':snapshot['index'],'frame_ref':snapshot['ref'],'rows_sha256':snapshot['hash']}
            witness={
                'schema':CONTRACT['schema'],'epistemic_status':'observed_replacement_not_control_law',
                'before_observation_ref':before['observation_ref'],'after_observation_ref':after['observation_ref'],
                'parent_transition_ref':parent,'actual_returned_command':command,'causal_action_efficacy_established':False,
                'intermediate_command_count':0,'context_epoch':before['level_epoch'],'packet_frame_count':len(frames),
                'source_snapshot':describe(old),'arrival_snapshot':describe(arrival),'settled_snapshot':describe(settled),
                'source_stable_packet_range':[snapshots[source_run['start']]['index'],old['index']],
                'receiver_stable_packet_range':[arrival['index'],settled['index']],
                'unique_shape_trajectory':[{**describe(snapshots[p['snapshot']]),'frame_bbox':p['occurrence']['frame_bbox']} for p in chain],
                'receiver_surroundings':{'collar_ends_equal':True,'collar_before_pixels':before_collar,'collar_after_sha256':g.digest(after_collar),
                    'lateral_sides':'left_right' if dr!=0 else 'top_bottom','lateral_before_pixels':before_lateral,
                    'lateral_unchanged_in_all_observed_frames':True,'observed_packet_range':[old['index'],settled['index']]},
                'excluded_outer_motion_spans':moving_supports,
                'historical_receipt_reused':False,'current_control_authority':False,
            }
            result.append({'facts':facts,'packet_witness':witness})
            if len(result)>min(CONTRACT['maximum_receptions'],contract['maximum_replacements']):return refusal('public_reception_count_bound')
    return {'complete':True,'rows':result,'frame_count':len(frames),'work_count':work}
