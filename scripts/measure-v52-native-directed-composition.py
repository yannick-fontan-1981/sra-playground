#!/usr/bin/env python3
"""Independent current directed-receiver question specification.

This is an explicitly native hypothesis domain. Current masks, supports, point
regions and the complete source point-span locus come from unchanged Python.
Preparing a receiver is never represented as a completed reception. All
compatible offset predictions remain present at a physical point; no subset of
history is supplied to the original point-span measurement. No action, future
frame or new observed receipt is supplied to the agent by this verifier.
"""
from __future__ import annotations
import copy
import importlib.util
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v52_directed_source_contracts', ROOT/'scripts/export-v6-framed-transfer-reference.py')
contracts = importlib.util.module_from_spec(spec); spec.loader.exec_module(contracts)
g, plain = contracts.g, contracts.plain
from agents.yf_arc3_v5.capabilities.framed_reception_loci import _contains, _center
from agents.yf_arc3_v5.capabilities.framed_replacements import _gap_patches

CONTRACT = {'schema': 'native.current_directed_receiver_composition.v1', 'maximum_work': 131072,
    'maximum_records': 128, 'maximum_pairs': 32, 'maximum_anchors': 4096, 'maximum_tasks': 128, 'maximum_offers': 128}

def unique(values): return sorted(set(values))
def safe_int(value): return type(value) is int and abs(value) <= 2**53-1
def patch_signature(span): return [patch for _, patch in span.get('endpoint_patches', [])]
def shift_box(box, axis, delta):
    return [value+(delta if index in ((1, 3) if axis == 'column' else (0, 2)) else 0) for index, value in enumerate(box)]
def span_box(span):
    low, high = span['after_interval']; olow, ohigh = span['orthogonal_interval']
    return [olow, low, ohigh, high] if span['axis'] == 'column' else [low, olow, high, ohigh]
def overlaps(first, second): return first[0] <= second[2] and second[0] <= first[2] and first[1] <= second[3] and second[1] <= first[3]
def span_identity(span): return [span['axis'], span['endpoint_refs'], span['after_interval'], span['orthogonal_interval']]
def span_view(span):
    result = {key: copy.deepcopy(span[key]) for key in ['axis', 'endpoint_refs', 'after_interval', 'orthogonal_interval', 'endpoint_patches', 'context_epoch', 'source_claim_ref']}
    if span.get('evidence') is not None: result['evidence'] = copy.deepcopy(span['evidence'])
    return result
def occurrence_view(row):
    return {key: row[key] for key in ['component_ref', 'entity_ref', 'frame_bbox', 'mask_digest', 'mask_extent', 'inner_value', 'border_value', 'inner_fills_bbox']}

def measure_current_directed_receiver_questions(rows, obs, policy, spans=(), receipts=(), attempts=None, existing_source_offers=(), occupied_uniform_reception_points=()):
    attempts = {} if attempts is None else attempts
    work = anchor_count = task_count = 0
    def refused(reason): return {'complete': False, 'offers': [], 'work_count': work, 'reason': reason}
    def empty(): return {'complete': True, 'offers': [], 'work_count': work}
    def spend():
        nonlocal work
        work += 1
        return work <= CONTRACT['maximum_work']
    if len(receipts) > CONTRACT['maximum_records'] or len(existing_source_offers) > CONTRACT['maximum_offers']:
        return refused('directed_composition_inventory_bound')
    groups = {}
    for witness in receipts:
        if not spend(): return refused('directed_composition_work_bound')
        if witness.get('context_epoch') != obs.get('level_epoch') or witness.get('marker_uniform') is not True or witness.get('border_preserved') is not True or not isinstance(witness.get('source_claim_ref'), str) or not witness['source_claim_ref'] or not isinstance(witness.get('source_frame_bbox'), list) or not isinstance(witness.get('marker_frame_bbox'), list) or not isinstance(witness.get('gap_patches'), list) or not witness['gap_patches']: continue
        first, second = witness['source_frame_bbox'], witness['marker_frame_bbox']
        numerators = [second[0]+second[2]-first[0]-first[2], second[1]+second[3]-first[1]-first[3]]
        if any(value % 2 for value in numerators): continue
        vector = [value//2 for value in numerators]
        if any(not safe_int(value) for value in vector) or not any(vector): continue
        key = g.digest([witness['mask_digest'], witness['mask_extent'], witness['source_inner_value'], witness['source_border_value'],
            witness['marker_inner_value'], witness['marker_border_value'], vector,
            [[axis, [box[2]-box[0], box[3]-box[1]], patch] for axis, box, patch in witness['gap_patches']]])
        groups.setdefault(key, {'witnesses': [], 'vector': vector})['witnesses'].append(witness)
    if not groups or not spans: return empty()
    width = len(rows[0]) if rows else 0
    if not safe_int(obs.get('level_epoch')) or not isinstance(obs.get('observation_ref'), str) or not width or not rows or width*len(rows) > policy.mask['maximum_frame_pixels'] or any(len(row) != width or any(not safe_int(value) or not 0 <= value <= 255 for value in row) for row in rows):
        return refused('directed_composition_frame_invalid')
    frame, components, scene = g.extract(rows, obs['observation_ref'])
    measured = plain(g.measure_framed_mask_correspondences(frame, scene.entities, policy.mask))
    bindings, complete = g.measure_current_point_span_bindings(frame, spans, obs['level_epoch'], policy.route['point_motion_span_recall_contract'])
    bindings = plain(bindings)
    if measured['framed_mask_domain_complete'] is not True or not complete: return refused('directed_composition_measurement_incomplete')
    if len(bindings) < 2: return empty()
    occurrences = measured['framed_mask_occurrences']; by_occurrence = {row['component_ref']: row for row in occurrences}
    carried = []
    for pair in measured['framed_mask_pairs']:
        for group in groups.values():
            witness = group['witnesses'][0]
            for first, second in [('first', 'second'), ('second', 'first')]:
                if not spend(): return refused('directed_composition_work_bound')
                if pair['mask_extent'] != witness['mask_extent'] or pair[first+'_inner_value'] != witness['source_inner_value'] or pair[first+'_border_value'] != witness['source_border_value']: continue
                source, ghost = by_occurrence[pair[first+'_component_ref']], by_occurrence[pair[second+'_component_ref']]
                def same_appearance(candidate, match):
                    return all(candidate[key] == match[key] for key in ['mask_digest', 'inner_value', 'border_value', 'mask_extent'])
                if sum(same_appearance(row, source) for row in occurrences) != 1 or sum(same_appearance(row, ghost) for row in occurrences) != 1: continue
                pairs = [row for row in measured['framed_mask_pairs'] if source['component_ref'] in [row['first_component_ref'], row['second_component_ref']]]
                if len(pairs) != 1: continue
                joint = [(span, history) for span, history in bindings if _contains(span, source['frame_bbox']) and _contains(span, ghost['frame_bbox'])]
                if len(joint) != 1: continue
                carried.append({'source': source, 'ghost': ghost, 'span': joint[0][0], 'history': joint[0][1], 'group': group})
                if len(carried) > CONTRACT['maximum_pairs']: return refused('directed_composition_pair_bound')
    if not carried: return empty()
    bands_raw = g.measure_parallel_solid_bands(components, policy.route['parallel_band_measurement_contract'])
    if any(facts.get('parallel_solid_band_domain_complete') is not True for facts in bands_raw.values()): return refused('directed_composition_support_incomplete')
    regions = g.point_regions(frame, components, bands_raw); bands = plain(bands_raw); by_component = {c.component_id: c for c in components}
    classic = [record for record in receipts if record.get('native_directed_composition_only') is not True and record.get('native_packet_witness', {}).get('native_directed_composition_only') is not True]
    locus_input = {'frame': frame, 'components': components, 'records': [{**record, 'mask_extent': tuple(record['mask_extent'])} for record in classic],
        'span_records': spans, 'context_epoch': obs['level_epoch'], 'span_contract': policy.route['point_motion_span_recall_contract'],
        'contract': policy.route['framed_reception_locus_contract']}
    source_bands, bands_complete = g.measure_framed_reception_loci(**locus_input, mask_contract=policy.route['framed_reception_mask_contract'], band_facts=bands_raw)
    source_regions, regions_complete = g.measure_regional_reception_loci(**locus_input, mask_contract=policy.mask, operator_regions=regions)
    hypotheses = {}
    for witness in classic:
        if witness.get('context_epoch') != obs['level_epoch'] or not witness.get('source_claim_ref') or witness.get('marker_uniform') is not True or witness.get('border_preserved') is not True: continue
        for pair in measured['framed_mask_pairs']:
            for first, second in [('first', 'second'), ('second', 'first')]:
                if not spend(): return refused('directed_composition_work_bound')
                if pair['mask_extent'] != witness['mask_extent'] or pair[first+'_inner_value'] != witness['source_inner_value'] or pair[first+'_border_value'] != witness['source_border_value']: continue
                ref = 'hypothesis:frame_analogy:'+g.digest([witness['source_claim_ref'], pair[second+'_inner_value'], pair[second+'_border_value'], pair['mask_extent']])
                hypotheses[ref] = {**witness, 'mask_extent': tuple(witness['mask_extent']), 'marker_uniform': False,
                    'marker_inner_value': pair[second+'_inner_value'], 'marker_border_value': pair[second+'_border_value'], 'source_claim_ref': ref}
                if len(hypotheses) > policy.route['framed_reception_locus_contract']['maximum_records']: return refused('directed_competing_source_domain_incomplete')
    source_analogues, analogues_complete = g.measure_regional_reception_loci(**{**locus_input, 'records': list(hypotheses.values())},
        mask_contract=policy.mask, operator_regions=regions, require_operator_value_match=False)
    if not bands_complete or not regions_complete or not analogues_complete: return refused('directed_competing_source_domain_incomplete')
    competing_source_points = {tuple(point) for _, point, _ in [*source_bands, *source_regions, *source_analogues]}
    entries = {}
    def in_bounds(box): return box[0] >= 0 and box[1] >= 0 and box[2] < frame.height and box[3] < frame.width
    def span_fits(span, delta): return in_bounds(shift_box(span_box(span), span['axis'], delta))
    def project_frames(span, delta):
        return [{'component_ref': row['component_ref'], 'before_bbox': row['frame_bbox'], 'projected_bbox': shift_box(row['frame_bbox'], span['axis'], delta)} for row in occurrences if _contains(span, row['frame_bbox'])]
    def register(offer, key, task):
        entry_key = g.digest([offer['candidate_ref'], offer['component_ref']]); entry = entries.setdefault(entry_key, {'offer': offer, 'tasks': {}})
        prior = entry['tasks'].get(key)
        if prior:
            hypotheses = {row['observed_claim']: row for row in [*prior['receipt_hypotheses'], *task['receipt_hypotheses']]}
            entry['tasks'][key] = {**prior, 'receipt_claim_refs': unique([*prior['receipt_claim_refs'], *task['receipt_claim_refs']]),
                'receipt_hypotheses': [hypotheses[key] for key in sorted(hypotheses)]}
        else: entry['tasks'][key] = task
    def offer_for(region, point):
        first, second = [by_component.get(ref) for ref in region.support_refs]
        if first is None or second is None or bands.get(first.component_id, {}).get('parallel_solid_band_peer_refs') != [second.component_id] or bands.get(second.component_id, {}).get('parallel_solid_band_peer_refs') != [first.component_id]: return None
        patches = [{'bbox': [c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom], 'value': c.value} for c in [first, second]]
        key = g.digest([obs['level_epoch'], point, patches, rows])
        if key in attempts: return None
        return {'candidate_ref': key, 'component_ref': region.component_id, 'point': list(point), 'point_x': point[1], 'point_y': point[0],
            'point_value': frame.rows[point[0]][point[1]], 'patches': patches, 'signature': g.digest(patches),
            'bbox': [min(first.bbox.left, second.bbox.left), min(first.bbox.top, second.bbox.top), max(first.bbox.right, second.bbox.right), max(first.bbox.bottom, second.bbox.bottom)],
            'facts': {**bands[first.component_id], 'parallel_solid_band_mutually_unique': True, 'framed_reception_analogy': False,
                **plain(g.measure_point_span_locus(frame, point, bindings, complete)), 'interaction_measurement_kind': 'point', 'candidate_execution_count': 0,
                'attempted_without_effect_in_current_context': False, 'candidate_ref': key}}
    def add_questions(base, moving_span, delta):
        if not delta or not span_fits(moving_span, delta): return True
        side = 'lower' if delta < 0 else 'upper'; low, high = moving_span['after_interval']
        offset_key = 'point_to_lower_edge' if side == 'lower' else 'point_to_upper_edge'
        for region in regions:
            if not spend(): return False
            prototypes = [record for record in spans if record.get('context_epoch') == obs['level_epoch'] and record.get('axis') == moving_span['axis'] and record.get('point_before_side') == side and record.get('operator_value') == region.value and isinstance(record.get('source_claim_ref'), str) and record['source_claim_ref'] and patch_signature(record) == patch_signature(moving_span) and record['after_interval'][1]-record['after_interval'][0] == high-low]
            offsets = sorted(set(record[offset_key] for record in prototypes))
            for selected_offset in offsets:
                if not spend(): return False
                coordinate = low+delta+selected_offset if side == 'lower' else high+delta-selected_offset
                if not safe_int(coordinate) or low <= coordinate <= high: continue
                point = ((region.bbox.top+region.bbox.bottom)//2, coordinate) if moving_span['axis'] == 'column' else (coordinate, (region.bbox.left+region.bbox.right)//2)
                if point not in region.pixels: continue
                related = []
                for span, history in bindings:
                    axis, ortho = (point[1], point[0]) if span['axis'] == 'column' else point
                    if span['orthogonal_interval'][0] <= ortho <= span['orthogonal_interval'][1] and (axis < span['after_interval'][0] or axis > span['after_interval'][1]): related.append((span, history))
                if len(related) != 1 or span_identity(related[0][0]) != span_identity(moving_span): continue
                offer = offer_for(region, point)
                if offer is None: continue
                predictions = []
                for offset in offsets:
                    predicted_delta = coordinate-offset-low if side == 'lower' else coordinate+offset-high
                    projected_span = shift_box(span_box(moving_span), moving_span['axis'], predicted_delta)
                    other_span = base['co_carried_span'] if base['kind'] == 'prepare_uniform_receiver' else base['receiver_span']
                    other_pending_delta = base['pending_reception_geometry']['source_alignment_delta'] if base['kind'] == 'prepare_uniform_receiver' else 0
                    predictions.append({'offset': offset, 'predicted_delta': predicted_delta,
                        'claim_refs': unique(record['source_claim_ref'] for record in prototypes if record[offset_key] == offset),
                        'projected_span': projected_span, 'projected_frames': project_frames(moving_span, predicted_delta),
                        'within_public_bounds': span_fits(moving_span, predicted_delta), 'independent_of_other_support':
                            not overlaps(projected_span, span_box(other_span)) and not overlaps(projected_span, shift_box(span_box(other_span), other_span['axis'], other_pending_delta))})
                if any(not prediction['within_public_bounds'] or not prediction['independent_of_other_support'] for prediction in predictions): continue
                selected = next(prediction for prediction in predictions if prediction['offset'] == selected_offset)
                facts = offer['facts']; exact_locus = facts.get('point_span_recall_domain_complete') is True and facts.get('point_span_locus_binding_count') == 1 and facts.get('point_span_current_support_exact') is True and facts.get('point_span_locus_expected_delta') == delta and facts.get('point_span_locus_current_endpoint_refs') == moving_span['endpoint_refs']
                semantic = g.digest([base['kind'], base['source']['component_ref'], base['ghost']['component_ref'], base['receiver']['component_ref'], base['receiver_anchor'], base['observed_source_to_receiver_vector'], span_identity(moving_span), delta, selected_offset])
                task = {**base, 'task_ref': 'directed_receiver_task:'+semantic, 'moving_span': span_view(moving_span),
                    'requested_translation': delta, 'operator_side': side, 'operator_value_current': region.value, 'selected_offset_hypothesis': selected,
                    'all_compatible_offset_predictions': predictions, 'source_point_span_measurement': plain(g.measure_point_span_locus(frame, point, bindings, complete)),
                    'source_locus_revalidated': exact_locus, 'control_effect_established': False, 'physical_point': list(point),
                    'span_claim_refs': unique([*base['span_claim_refs'], *(record['source_claim_ref'] for record in prototypes)])}
                register(offer, semantic, task)
                if len(entries) > CONTRACT['maximum_offers']: return False
        return True

    for pair in carried:
        source, ghost, pair_span, history, group = [pair[key] for key in ['source', 'ghost', 'span', 'history', 'group']]; witness = group['witnesses'][0]
        for receiver in occurrences:
            if not spend(): return refused('directed_composition_work_bound')
            if receiver['inner_fills_bbox'] is not True or receiver['mask_extent'] != witness['mask_extent'] or receiver['inner_value'] != witness['marker_inner_value'] or receiver['border_value'] != witness['marker_border_value']: continue
            receiver_bindings = [(span, records) for span, records in bindings if _contains(span, receiver['frame_bbox'])]
            if len(receiver_bindings) != 1: continue
            receiver_span, receiver_history = receiver_bindings[0]
            if receiver_span['axis'] != pair_span['axis'] or span_identity(receiver_span) == span_identity(pair_span) or _contains(receiver_span, source['frame_bbox']) or _contains(receiver_span, ghost['frame_bbox']) or overlaps(span_box(receiver_span), span_box(pair_span)): continue
            axis = pair_span['axis']; axis_limit = frame.width if axis == 'column' else frame.height
            receiver_box, source_box = receiver['frame_bbox'], source['frame_bbox']
            for receiver_delta in range(-receiver_span['after_interval'][0], axis_limit-receiver_span['after_interval'][1]):
                if not spend(): return refused('directed_composition_anchor_bound')
                anchor_count += 1
                if anchor_count > CONTRACT['maximum_anchors']: return refused('directed_composition_anchor_bound')
                anchor = shift_box(receiver_box, axis, receiver_delta)
                projected_source = [value-group['vector'][index % 2] for index, value in enumerate(anchor)]
                source_delta = _center(projected_source, axis)-_center(source_box, axis)
                if shift_box(source_box, axis, source_delta) != projected_source or not source_delta or not span_fits(pair_span, source_delta): continue
                if any(overlaps(source_support, receiver_support) for source_support in [span_box(pair_span), shift_box(span_box(pair_span), axis, source_delta)] for receiver_support in [span_box(receiver_span), shift_box(span_box(receiver_span), axis, receiver_delta)]): continue
                projected_ghost = shift_box(ghost['frame_bbox'], axis, source_delta)
                if not in_bounds(projected_ghost): continue
                gaps = [gap for gap in plain(_gap_patches(projected_source, anchor, frame)) if gap[0] == axis and any(old_axis == gap[0] and gap[1][2]-gap[1][0] == old_box[2]-old_box[0] and gap[1][3]-gap[1][1] == old_box[3]-old_box[1] and gap[2] == old_patch for old_axis, old_box, old_patch in witness['gap_patches'])]
                if len(gaps) != 1: continue
                gap_box = gaps[0][1]
                if any(overlaps(box, gap_box) for box in [span_box(pair_span), shift_box(span_box(pair_span), axis, source_delta), span_box(receiver_span), shift_box(span_box(receiver_span), axis, receiver_delta)]): continue
                task_count += 1
                if task_count > CONTRACT['maximum_tasks']: return refused('directed_composition_task_bound')
                kind = 'test_directed_reception' if receiver_delta == 0 else 'prepare_uniform_receiver'
                base = {'kind': kind, 'source': occurrence_view(source), 'ghost': occurrence_view(ghost), 'receiver': occurrence_view(receiver),
                    'co_carried_span': span_view(pair_span), 'receiver_span': span_view(receiver_span), 'receiver_anchor': anchor,
                    'literal_gap': gaps[0], 'observed_source_to_receiver_vector': group['vector'],
                    'receipt_claim_refs': unique(record['source_claim_ref'] for record in group['witnesses']),
                    'span_claim_refs': unique(record['source_claim_ref'] for record in [*history, *receiver_history]),
                    'receipt_hypotheses': [{'observed_claim': record['source_claim_ref'],
                        'hypothesis_ref': 'hypothesis:directed_current_reception:'+g.digest([obs['observation_ref'], record['source_claim_ref'], source['component_ref'], ghost['component_ref'], receiver['component_ref'], anchor, group['vector']]),
                        'observed_mask_digest': record['mask_digest'], 'current_mask_digest': source['mask_digest'], 'same_mask_as_observed': record['mask_digest'] == source['mask_digest'],
                        'epistemic_status': 'observed_directed_reception_class' if record['mask_digest'] == source['mask_digest'] else 'current_shape_analogy_not_observed_reception',
                        'native_directed_composition_only': record.get('native_directed_composition_only') is True,
                        'evidence': record.get('evidence', []), 'observed_source_bbox': record['source_frame_bbox'], 'observed_receiver_bbox': record['marker_frame_bbox']} for record in group['witnesses']],
                    'pending_reception_geometry': {'projected_source_bbox': projected_source, 'projected_ghost_bbox': projected_ghost, 'receiver_bbox': anchor,
                        'source_alignment_delta': source_delta, 'receiver_preparation_delta': receiver_delta, 'no_following_command_committed': True},
                    'gap_outside_current_and_projected_supports': True, 'reception_observed': False, 'expected_effect_status': 'unknown',
                    'isometry_applied': False, 'palette_mapping_applied': False, 'historical_receipt_reused': False, 'stored_action_sequence': False}
                if not add_questions(base, pair_span if kind == 'test_directed_reception' else receiver_span, source_delta if kind == 'test_directed_reception' else receiver_delta):
                    return refused('directed_composition_offer_bound' if len(entries) > CONTRACT['maximum_offers'] else 'directed_composition_work_bound')
    physical, source_loci = {}, competing_source_points
    for point in occupied_uniform_reception_points:
        if point['raw_task_count'] > 0: source_loci.add(tuple(point['point']))
    for entry in entries.values(): physical.setdefault(tuple(entry['offer']['point']), set()).update(entry['tasks'])
    for offer in existing_source_offers:
        count = offer['facts'].get('framed_reception_locus_binding_count')
        if isinstance(count, (int, float)) and count > 0: source_loci.add(tuple(offer['point']))
    offers = []
    for _, entry in sorted(entries.items()):
        key = tuple(entry['offer']['point'])
        if len(physical.get(key, ())) != 1 or key in source_loci or len(entry['tasks']) != 1: continue
        task = next(iter(entry['tasks'].values()))
        question = {**task, 'schema': CONTRACT['schema'],
            'question_ref': 'directed_receiver_question:'+g.digest([obs['observation_ref'], entry['offer']['candidate_ref'], entry['offer']['component_ref'], task]),
            'current_observation_ref': obs['observation_ref'], 'context_epoch': obs['level_epoch'], 'current_frame_hash': obs['frame_hash'],
            'current_rows_sha256': g.digest(rows), 'physical_task_count': 1, 'release_authority': False, 'terminal_completion_claimed': False}
        offers.append({**entry['offer'], 'native_directed_receiver_question': question})
    return {'complete': True, 'offers': offers, 'work_count': work}
