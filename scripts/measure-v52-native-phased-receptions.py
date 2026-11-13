#!/usr/bin/env python3
"""Independent specification of observed receptions after a support settles.

This declares a native extension, not a capability attributed to the original
Python agent. The unchanged source extractor, mask and point-span measurements
consume only the real public before frame and returned animation packet. Every
expected fact and witness is then computed here, never copied from a native
result. Contextual framed appearance is kept distinct from component identity,
and these directed observations cannot enter original directionless candidates.
"""
from __future__ import annotations
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v52_phased_source_contracts', ROOT/'scripts/export-v6-framed-transfer-reference.py')
contracts = importlib.util.module_from_spec(spec); spec.loader.exec_module(contracts)
g, plain = contracts.g, contracts.plain
from agents.yf_arc3_v5.capabilities.framed_replacements import _gap_patches

CONTRACT = {
    'schema': 'native.framed_public_phased_reception.v1',
    'maximum_frames': 64, 'maximum_total_pixels': 262144,
    'maximum_tracked_signatures': 128, 'maximum_outer_spans': 32,
    'maximum_work': 65536, 'maximum_receptions': 64,
    'minimum_stable_frames': 2, 'stationary_collar_width': 1,
}

def safe_int(value): return type(value) is int and abs(value) <= 2**53-1
def rows_in_domain(rows, width, height):
    return isinstance(rows, list) and len(rows) == height and all(isinstance(row, list) and len(row) == width
        and all(safe_int(value) and 0 <= value <= 255 for value in row) for row in rows)
def contains(outer, inner):
    return outer[0] <= inner[0] and outer[1] <= inner[1] and inner[2] <= outer[2] and inner[3] <= outer[3]
def intersects(first, second):
    return first[0] <= second[2] and second[0] <= first[2] and first[1] <= second[3] and second[1] <= first[3]
def valid_box(box, width, height):
    return isinstance(box, list) and len(box) == 4 and all(safe_int(value) for value in box) and 0 <= box[0] <= box[2] < height and 0 <= box[1] <= box[3] < width
def motion_box(span, which):
    low, high = span['point_span_'+which+'_interval']; olow, ohigh = span['point_span_orthogonal_interval']
    return [olow, low, ohigh, high] if span['point_span_axis'] == 'column' else [low, olow, high, ohigh]
def collar(frame, box):
    top, left, bottom, right = box[0]-1, box[1]-1, box[2]+1, box[3]+1
    if top < 0 or left < 0 or bottom >= frame.height or right >= frame.width: return None
    return [[y, x, frame.rows[y][x]] for y in range(top, bottom+1) for x in range(left, right+1)
            if y in (top, bottom) or x in (left, right)]

def measure_current_phased_public_packet_receptions(first, final, before, after, command, frames, policy):
    """A bounded, monotone observed passage; no hypothetical action is added."""
    work = 0
    def refusal(reason):
        return {'complete': False, 'rows': [], 'frame_count': len(frames), 'work_count': work, 'reason': reason}
    def spend(amount=1):
        nonlocal work
        work += amount
        return work <= CONTRACT['maximum_work']
    if not frames: return refusal('phased_public_frame_packet_unavailable')
    if len(frames) > CONTRACT['maximum_frames']: return refusal('phased_public_frame_count_bound')
    if not safe_int(before.get('level_epoch')) or before.get('level_epoch') != after.get('level_epoch') or not isinstance(before.get('observation_ref'), str) or not isinstance(after.get('observation_ref'), str):
        return refusal('phased_public_epoch_or_observation_mismatch')
    height = len(first); width = len(first[0]) if first else 0; pixels = height*width
    if not height or not width or pixels > policy.mask['maximum_frame_pixels'] or pixels*(len(frames)+1) > CONTRACT['maximum_total_pixels']:
        return refusal('phased_public_frame_pixel_bound')
    if not rows_in_domain(first, width, height) or not rows_in_domain(final, width, height) or any(not rows_in_domain(rows, width, height) for rows in frames):
        return refusal('phased_public_frame_domain_invalid')
    if frames[-1] != final: return refusal('phased_public_frame_packet_final_mismatch')
    data = command.get('data') or {}
    if not isinstance(command.get('action_ref'), str) or not command['action_ref'] or not safe_int(data.get('x')) or not safe_int(data.get('y')) or not (0 <= data['x'] < width and 0 <= data['y'] < height):
        return refusal('phased_public_point_command_invalid')
    contract = policy.policies.get('policy.record_observed_framed_replacement', {}).get('configuration', {}).get('measurement_contract')
    if not contract or not safe_int(contract.get('maximum_replacements')) or contract['maximum_replacements'] < 0 or not safe_int(contract.get('maximum_components')) or not safe_int(contract.get('maximum_occurrences')):
        return refusal('phased_replacement_contract_unavailable')

    span_facts, _ = g.transition(first, final, before, after, command, policy)
    if span_facts['point_motion_span_domain_complete'] is not True: return refusal('phased_outer_point_motion_domain_incomplete')
    spans = plain(span_facts['point_motion_span_rows'])
    if not spans: return refusal('phased_outer_point_motion_witness_unavailable')
    if len(spans) > CONTRACT['maximum_outer_spans']: return refusal('phased_outer_point_motion_count_bound')
    supports = []
    for span in spans:
        start, end = motion_box(span, 'before'), motion_box(span, 'after')
        patches, refs = span.get('point_span_endpoint_patches'), span.get('point_span_endpoint_refs')
        if not valid_box(start, width, height) or not valid_box(end, width, height) or not isinstance(patches, list) or len(patches) != 2 or not isinstance(refs, list) or len(refs) != 2 or refs[0] == refs[1]:
            return refusal('phased_outer_endpoint_inventory_invalid')
        if any(not valid_box(box, width, height) or not contains(end, box) or not rows_in_domain(patch, box[3]-box[1]+1, box[2]-box[0]+1) for box, patch in patches):
            return refusal('phased_outer_endpoint_inventory_invalid')
        supports.append({'token': span['point_span_token'], 'before_bbox': start, 'after_bbox': end,
            'swept_bbox': [min(start[0], end[0]), min(start[1], end[1]), max(start[2], end[2]), max(start[3], end[3])],
            'endpoint_refs': refs, 'endpoint_patches': patches})

    parent = 'transition:'+g.digest([before['observation_ref'], after['observation_ref'], command])
    snapshots, tracks = [], {}
    for position, frame_rows in enumerate([first, *frames]):
        index = position-1; rows_hash = g.digest(frame_rows)
        ref = before['observation_ref'] if index < 0 else after['observation_ref']+':public_frame:'+str(index)+':rows:'+rows_hash
        frame, _, scene = g.extract(frame_rows, ref)
        measured = plain(g.measure_framed_mask_correspondences(frame, scene.entities, policy.mask))
        if measured['framed_mask_domain_complete'] is not True: return refusal('phased_public_mask_inventory_incomplete')
        occurrences = measured['framed_mask_occurrences']
        if len(scene.entities) > contract['maximum_components'] or len(occurrences) > contract['maximum_occurrences']:
            return refusal('phased_public_replacement_inventory_bound')
        snapshots.append({'index': index, 'frame': frame, 'hash': rows_hash, 'ref': ref, 'occurrences': occurrences})
        groups = {}
        for occurrence in occurrences:
            if not spend(): return refusal('phased_public_reception_work_bound')
            if occurrence['inner_fills_bbox']: continue
            key = g.digest([occurrence['mask_digest'], occurrence['mask_extent'], occurrence['inner_value'], occurrence['border_value']])
            groups.setdefault(key, []).append(occurrence)
        for key, group in groups.items():
            if len(group) != 1: continue
            tracks.setdefault(key, []).append({'snapshot': position, 'occurrence': group[0]})
            if len(tracks) > CONTRACT['maximum_tracked_signatures']: return refusal('phased_public_signature_count_bound')

    result = []
    for appearance, positions in sorted(tracks.items()):
        runs, current = [], None
        for position in positions:
            if not spend(): return refusal('phased_public_reception_work_bound')
            if current and position['snapshot'] == current['end']+1 and position['occurrence']['frame_bbox'] == current['occurrence']['frame_bbox']:
                current = {**current, 'end': position['snapshot']}; runs[-1] = current
            else:
                current = {'start': position['snapshot'], 'end': position['snapshot'], 'occurrence': position['occurrence']}; runs.append(current)
        previous = None
        for run in runs:
            if run['end']-run['start']+1 < CONTRACT['minimum_stable_frames']: continue
            source_run, previous = previous, run
            if source_run is None: continue
            chain = [p for p in positions if source_run['start'] <= p['snapshot'] <= run['end']]
            if len(chain) != run['end']-source_run['start']+1: continue
            source, displayed = source_run['occurrence'], run['occurrence']
            source_box, target_box = source['frame_bbox'], displayed['frame_bbox']
            dr, dc = target_box[0]-source_box[0], target_box[1]-source_box[1]
            if (dr == 0) == (dc == 0) or intersects(source_box, target_box) or displayed['border_value'] != source['border_value'] or displayed['mask_extent'] != source['mask_extent']: continue
            source_supports = [s for s in supports if contains(s['after_bbox'], source_box) and not intersects(s['after_bbox'], target_box)]
            if len(source_supports) != 1: continue
            source_support = source_supports[0]
            relevant = [s for s in supports if intersects(s['swept_bbox'], source_box) or intersects(s['swept_bbox'], target_box)]
            old, arrival = snapshots[source_run['end']], snapshots[run['start']]
            if not spend(len(old['occurrences'])): return refusal('phased_public_reception_work_bound')
            markers = [r for r in old['occurrences'] if r['inner_fills_bbox'] is True and r['frame_bbox'] == target_box and r['mask_extent'] == source['mask_extent']]
            if len(markers) != 1: continue
            marker = markers[0]; before_collar = collar(old['frame'], target_box)
            if before_collar is None: continue
            def lateral(pixels):
                return [p for p in pixels if (p[1] in (target_box[1]-1, target_box[3]+1) if dr != 0 else p[0] in (target_box[0]-1, target_box[2]+1))]
            before_lateral = lateral(before_collar); settled_position = None; after_collar = None; previous_progress = 0
            for position in range(source_run['start'], run['end']+1):
                snapshot = snapshots[position]; visible_box = chain[position-source_run['start']]['occurrence']['frame_bbox']
                displacement = visible_box[0]-source_box[0] if dr != 0 else visible_box[1]-source_box[1]
                direction = dr if dr else dc; progress = (1 if direction > 0 else -1)*displacement
                axial_box = [value+(displacement if index in ((0, 2) if dr != 0 else (1, 3)) else 0) for index, value in enumerate(source_box)]
                if not spend(): return refusal('phased_public_reception_work_bound')
                if visible_box != axial_box or progress < previous_progress or progress > abs(direction): break
                previous_progress = progress; endpoints_unchanged = True
                for support in relevant:
                    for box, patch in support['endpoint_patches']:
                        for y in range(box[0], box[2]+1):
                            for x in range(box[1], box[3]+1):
                                if not spend(): return refusal('phased_public_reception_work_bound')
                                if snapshot['frame'].rows[y][x] != patch[y-box[0]][x-box[1]]: endpoints_unchanged = False
                if not endpoints_unchanged: break
                current_collar = collar(snapshot['frame'], target_box)
                if current_collar is None: break
                if not spend(len(current_collar)): return refusal('phased_public_reception_work_bound')
                if lateral(current_collar) != before_lateral: break
                if position < run['start']:
                    if not spend(len(snapshot['occurrences'])): return refusal('phased_public_reception_work_bound')
                    present = [r for r in snapshot['occurrences'] if r['inner_fills_bbox'] is True and r['frame_bbox'] == target_box and r['mask_extent'] == marker['mask_extent'] and r['inner_value'] == marker['inner_value'] and r['border_value'] == marker['border_value']]
                    if len(present) != 1: break
                if position < run['start']+CONTRACT['minimum_stable_frames']-1 or before_collar != current_collar: continue
                if not spend(len(snapshot['occurrences'])): return refusal('phased_public_reception_work_bound')
                if any(r['inner_fills_bbox'] is True and r['frame_bbox'] == target_box for r in snapshot['occurrences']): continue
                settled_position, after_collar = position, current_collar
                break
            if settled_position is None or after_collar is None: continue
            settled = snapshots[settled_position]; gaps = plain(_gap_patches(source_box, target_box, settled['frame']))
            if not spend(sum(len(line) for _, _, patch in gaps for line in patch)): return refusal('phased_public_reception_work_bound')
            if len(gaps) != 1: continue
            segment = 'public_phased_reception:'+g.digest([parent, appearance, old['index'], arrival['index'], settled['index'], source_support['token']])
            facts = {
                'framed_replacement_token': g.digest([segment, source['entity_ref'], marker['entity_ref'], 'settled_support_contextual_framed_appearance']),
                'framed_replacement_source_ref': source['entity_ref'], 'framed_replacement_current_visible_ref': displayed['entity_ref'],
                'framed_replacement_marker_ref': marker['entity_ref'], 'framed_replacement_tracking_lineage_agrees': displayed['entity_ref'] == source['entity_ref'],
                'framed_replacement_marker_uniform': True, 'framed_replacement_gap_patches': gaps,
                'framed_replacement_mask_digest': source['mask_digest'], 'framed_replacement_mask_extent': source['mask_extent'],
                'framed_replacement_source_inner_value': source['inner_value'], 'framed_replacement_source_border_value': source['border_value'],
                'framed_replacement_marker_inner_value': marker['inner_value'], 'framed_replacement_marker_border_value': marker['border_value'],
                'framed_replacement_after_border_value': displayed['border_value'], 'framed_replacement_border_preserved': True,
                'framed_replacement_source_frame_bbox': source_box, 'framed_replacement_marker_frame_bbox': target_box,
                'framed_replacement_before_marker_frame_bbox': target_box, 'framed_replacement_receiver_endpoint_refs': None,
                'framed_replacement_delta': [dr, dc], 'framed_replacement_action_ref': command['action_ref'],
                'framed_replacement_transition_ref': segment, 'framed_replacement_context_epoch': before['level_epoch'],
                'framed_replacement_frame_ref': settled['ref'], 'framed_replacement_unique_preserved_copy': True,
                'framed_replacement_marker_disappeared': True, 'framed_replacement_prior_goal_ref': None,
                'framed_replacement_prior_subgoal_ref': None, 'framed_replacement_native_directed_composition_only': True,
            }
            def describe(snapshot):
                return {'packet_index': snapshot['index'], 'frame_ref': snapshot['ref'], 'rows_sha256': snapshot['hash']}
            witness = {
                'schema': CONTRACT['schema'], 'epistemic_status': 'observed_contextual_framed_replacement_not_control_law',
                'native_directed_composition_only': True, 'original_directionless_candidate_eligible': False,
                'before_observation_ref': before['observation_ref'], 'after_observation_ref': after['observation_ref'],
                'parent_transition_ref': parent, 'actual_returned_command': command, 'causal_action_efficacy_established': False,
                'intermediate_command_count': 0, 'context_epoch': before['level_epoch'], 'packet_frame_count': len(frames),
                'source_snapshot': describe(old), 'arrival_snapshot': describe(arrival), 'settled_snapshot': describe(settled),
                'source_stable_packet_range': [snapshots[source_run['start']]['index'], old['index']],
                'receiver_stable_packet_range': [arrival['index'], settled['index']], 'first_valid_settlement_after_minimum_stability': True,
                'contextual_identity': {'signature': appearance, 'mask_digest': source['mask_digest'], 'mask_extent': source['mask_extent'],
                    'inner_value': source['inner_value'], 'border_value': source['border_value'], 'unique_in_each_observed_frame': True,
                    'identity_scope': 'current_framed_appearance', 'global_component_identity_asserted': False},
                'unique_framed_appearance_trajectory': [{**describe(snapshots[p['snapshot']]), 'frame_bbox': p['occurrence']['frame_bbox'],
                    'component_ref': p['occurrence']['component_ref'], 'entity_ref': p['occurrence']['entity_ref']} for p in chain if p['snapshot'] <= settled_position],
                'settled_source_support': source_support, 'outer_support_phase_witnesses': relevant,
                'support_endpoint_patches_unchanged_in_all_observed_frames': True,
                'support_observed_packet_range': [snapshots[source_run['start']]['index'], settled['index']],
                'receiver_surroundings': {'collar_ends_equal': True, 'collar_before_pixels': before_collar, 'collar_after_sha256': g.digest(after_collar),
                    'lateral_sides': 'left_right' if dr != 0 else 'top_bottom', 'lateral_before_pixels': before_lateral,
                    'lateral_unchanged_in_all_observed_frames': True, 'observed_packet_range': [snapshots[source_run['start']]['index'], settled['index']]},
                'observed_trajectory_axial': True, 'observed_axis_progression_monotone': True,
                'observed_motion_axis': 'row' if dr != 0 else 'column', 'observed_source_to_receiver_vector': [dr, dc],
                'historical_receipt_reused': False, 'current_control_authority': False,
            }
            result.append({'facts': facts, 'packet_witness': witness})
            if len(result) > min(CONTRACT['maximum_receptions'], contract['maximum_replacements']): return refusal('phased_public_reception_count_bound')
    return {'complete': True, 'rows': result, 'frame_count': len(frames), 'work_count': work}
