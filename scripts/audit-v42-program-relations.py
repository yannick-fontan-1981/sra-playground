#!/usr/bin/env python3
"""Audit retained public packets and pixels without importing an agent or game.

This audit reads no game implementation, hidden state or solver fixture. The
older public diagnostic supplies the complete *already acquired* program model;
its session references are rebound and its full digest is independently checked.
"""
from __future__ import annotations

import gzip
import hashlib
import json
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = 'docs/migration/native-campaigns-v42/diagnostics/stck-relation-six-level-attempt.json'
TRACE = 'docs/migration/native-campaigns-v42/diagnostics/stck-relation-public.json.gz'
PREVIOUS_REPORT = 'docs/migration/native-campaigns-v41/diagnostics/stck-control-discovery-six-level-attempt.json'
PREVIOUS_TRACE = 'docs/migration/native-campaigns-v41/diagnostics/stck-control-discovery-public.json.gz'
MODEL_DIAGNOSTIC = 'docs/migration/native-campaigns-v39/diagnostics/stck-level-four-program-diagnosis.json'
OUTPUT = 'docs/migration/native-campaigns-v42/diagnostics/stck-program-relations-audit.json'
FIELDS = ['frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash']


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def packed(value, ordered=False):
    return json.dumps(value, ensure_ascii=True, sort_keys=not ordered, separators=(',', ':'), allow_nan=False).encode()


def digest(value):
    return sha(packed(value))


def program_digest(value):
    # Independent implementation of the documented typed glyph float encoding.
    def typed(item, floating=False):
        if isinstance(item, bool) or item is None or isinstance(item, str):
            return item
        if isinstance(item, (int, float)):
            return float(item) if floating else item
        if isinstance(item, list):
            return [typed(child, floating) for child in item]
        glyph = item.get('status') == 'conditional_glyph_vector_map'
        return {key: typed(child, floating or glyph and key in ('matrix', 'center')) for key, child in item.items()}
    return digest(typed(value))


def load(relative):
    raw = (ROOT / relative).read_bytes()
    return json.loads(gzip.decompress(raw) if relative.endswith('.gz') else raw)


def proof(relative):
    raw = (ROOT / relative).read_bytes()
    result = {'path': relative, 'sha256': sha(raw), 'bytes': len(raw)}
    if relative.endswith('.gz'):
        uncompressed = gzip.decompress(raw)
        result.update(uncompressedSha256=sha(uncompressed), uncompressedBytes=len(uncompressed))
    return result


def command(value):
    return {'action_ref': value['action_ref'], 'data': value.get('data', {})}


def packet_hash(packet):
    assert set(packet) == set(FIELDS)
    return sha(packed({field: packet[field] for field in FIELDS}, ordered=True))


def verify_packets(report, trace):
    assert trace['sourceDigest'] == report['source']['digest']
    assert len(trace['packets']) == len(report['actions']) + 1
    assert report['sourceUnchangedDuringRun'] is True and report['pythonAgentModules'] == []
    assert report['source']['fileCount'] == len(report['source']['files'])
    assert sha(packed(report['source']['files'], ordered=True)) == report['source']['digest']
    assert trace['packets'][0]['command'] is None
    boundaries, last_boundary = [], 0
    for index, entry in enumerate(trace['packets']):
        packet = entry['packet']
        assert packet['step_index'] == index
        assert digest(packet['frame_rows'])[:16] == packet['frame_hash']
        if index == 0:
            assert packet_hash(packet) == report['initial']['publicPacketSha256']
            continue
        action = report['actions'][index - 1]
        before = trace['packets'][index - 1]['packet']
        assert action['sequence'] == index
        assert command(action['command']) == command(entry['command'])
        assert packet_hash(packet) == action['publicPacketSha256']
        assert packet['frame_hash'] == action['frameHash']
        assert len(packet['frame_packet']) == action['animationFrames']
        assert [before['level'], before['levels_completed']] == [action['levelBefore'], action['completedBefore']]
        assert [packet['level'], packet['levels_completed'], packet['state']] == [action['levelAfter'], action['completedAfter'], action['state']]
        if packet['levels_completed'] > before['levels_completed']:
            assert packet['levels_completed'] == before['levels_completed'] + 1
            boundaries.append({'completedLevel': packet['levels_completed'], 'levelActions': index - last_boundary,
                               'cumulativeActions': index, 'publicPacketSha256': packet_hash(packet)})
            last_boundary = index
    return boundaries


def components(rows, allowed=None, excluded=()):
    height, width = len(rows), len(rows[0])
    def inside(x, y):
        return any(left <= x <= right and top <= y <= bottom for left, top, right, bottom in excluded)
    unseen = {(x, y) for y in range(height) for x in range(width)
              if not inside(x, y) and (allowed is None or rows[y][x] in allowed)}
    output = []
    while unseen:
        seed = min(unseen, key=lambda item: (item[1], item[0]))
        unseen.remove(seed)
        color = rows[seed[1]][seed[0]]
        queue, pixels = deque([seed]), []
        while queue:
            x, y = queue.popleft()
            pixels.append([x, y, rows[y][x]])
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if (nx, ny) in unseen and (allowed is not None or rows[ny][nx] == color):
                    unseen.remove((nx, ny)); queue.append((nx, ny))
        left, top = min(p[0] for p in pixels), min(p[1] for p in pixels)
        bbox = [left, top, max(p[0] for p in pixels), max(p[1] for p in pixels)]
        mask = sorted([[x - left, y - top, value] for x, y, value in pixels])
        output.append({'bbox': bbox, 'mask': mask, 'area': len(pixels), 'color': color})
    return output


def members(rows, geometry):
    x = geometry['member_box'][0]
    width, height = geometry['member_size']
    return sorted([{'bbox': part['bbox'], 'color': part['color'], 'area': part['area']}
                   for part in components(rows)
                   if part['bbox'][0] == x and part['bbox'][2] == x + width - 1
                   and part['bbox'][3] < geometry['limit']
                   and part['bbox'][3] - part['bbox'][1] + 1 == height
                   and part['area'] == width * height], key=lambda part: part['bbox'][1])


def correspondence(rows, obj, palette, exclusions):
    parts = components(rows, palette, exclusions)
    matches = [part for part in parts if part['bbox'][:2] == obj['anchor']]
    assert len(matches) == 1, ('reported appearance not uniquely located', obj)
    chosen = matches[0]
    assert sum(part['mask'] == chosen['mask'] for part in parts) == 1
    return chosen


def public_phase_audit(effect, before, packet, palette, exclusions):
    images = [before['frame_rows'], *packet['frame_packet']]
    assert effect['packet_frame_count'] == len(packet['frame_packet'])
    assert effect['packet_frame_digests'] == [digest(frame) for frame in packet['frame_packet']]
    checked = []
    for phase in effect['phases']:
        start, end = phase['start'], phase['endpoint']
        assert 0 < start < end < effect['excluded_from'] < len(images)
        first, last = images[start], images[end]
        assert digest(first) == phase['start_frame_digest'] and digest(last) == phase['endpoint_frame_digest']
        assert phase['evidence'] == [
            {'observation_ref': effect['before_ref'], 'packet_index': start - 1},
            {'observation_ref': effect['before_ref'], 'packet_index': end - 1}]
        translated, preserved = [], []
        for item in phase['world']['translations']:
            old = [obj for obj in phase['world']['before_objects'] if obj['base'] == item['before_base'] and obj['word'] == item['word']]
            new = [obj for obj in phase['world']['after_objects'] if obj['base'] == item['after_base'] and obj['word'] == item['word']]
            assert len(old) == len(new) == 1
            a, b = correspondence(first, old[0], palette, exclusions), correspondence(last, new[0], palette, exclusions)
            assert a['mask'] == b['mask']
            delta = [b['bbox'][i] - a['bbox'][i] for i in (0, 1)]
            assert delta == item['vector'] == [item['after_base'][i] - item['before_base'][i] for i in (0, 1)]
            translated.append({'word': item['word'], 'reportedBeforeBase': item['before_base'], 'reportedAfterBase': item['after_base'],
                               'pixelVector': delta, 'beforeBbox': a['bbox'], 'afterBbox': b['bbox'],
                               'area': a['area'], 'coloredMaskSha256': digest(a['mask']), 'exactColoredShapePreserved': True})
        for obj in phase['world']['preserved_objects']:
            a, b = correspondence(first, obj, palette, exclusions), correspondence(last, obj, palette, exclusions)
            assert a == b
            preserved.append({'word': obj['word'], 'reportedBase': obj['base'], 'bbox': a['bbox'],
                              'area': a['area'], 'samePixelsAtSamePosition': True})
        checked.append({'label': phase['label'], 'memberIndex': phase['member_index'], 'newControlLabel': phase['new_control_label'],
                        'packetFrameIndicesZeroBased': [start - 1, end - 1], 'translations': translated,
                        'preserved': preserved, 'otherPublicChangesRetained': phase['residual']['other_changes']})
    return checked


def main():
    report, trace = load(REPORT), load(TRACE)
    previous_report, previous_trace = load(PREVIOUS_REPORT), load(PREVIOUS_TRACE)
    boundaries = verify_packets(report, trace)
    verify_packets(previous_report, previous_trace)
    assert boundaries[-1]['completedLevel'] == 4 and boundaries[-1]['cumulativeActions'] == 45
    assert [item['levelActions'] for item in boundaries] == [3, 7, 25, 10]
    assert report['status'] == 'failed' and report['targetLevels'] == 6
    assert report['final']['levelsCompleted'] == 4 and report['final']['level'] == 5
    assert report['final']['reason'] == 'frontier_unknown' and report['final']['sessions'] == 1
    for relative, expected in report['source']['files'].items():
        assert relative.startswith(('src/logos-engine/', 'src/runtime/'))
        assert sha((ROOT / relative).read_bytes()) == expected, relative
    for index in range(39):
        assert trace['packets'][index] == previous_trace['packets'][index], ('prior public prefix changed', index)
    assert trace['packets'][39]['command'] != previous_trace['packets'][39]['command']
    assert report['gameAssets'] == previous_report['gameAssets']
    prefixes = {prefix['callerAcquiredTransitions']: prefix for prefix in report['prefixes']}
    assert all(index in prefixes for index in range(36, 46))
    for index in range(38, 46):
        prefix = prefixes[index]
        assert prefix['acquiredActions'] == 1 and prefix['operations'] == ['OP29', 'OP30', 'OP31']
        assert report['actions'][index - 1]['family'] == 'public_occurrence_recall'
    discovery = {index: prefixes[index]['sharedSeries']['nativeControlDiscovery'] for index in range(38, 46)}
    relations = {index: prefixes[index]['sharedSeries']['nativeProgramRelations'] for index in range(38, 46)}
    binding = discovery[38]['latestBinding']
    preparation = discovery[39]['latestTrial']
    execution = discovery[40]['latestTrial']
    effect = discovery[40]['latestEffect']
    model_event = relations[40]['latestModel']
    relation = model_event['model']
    geometry = binding['current_access']['geometry']
    palette = set(geometry['known_operator_labels'] + [binding['label']])
    initial_rows = trace['packets'][38]['packet']['frame_rows']
    exclusions = [[geometry['member_box'][0], 0, geometry['member_box'][2], len(initial_rows) - 1],
                  [0, geometry['limit'], len(initial_rows[0]) - 1, len(initial_rows) - 1]]

    # Check the reconstructed complete source model against the acquired V42
    # digest, then compare every recorded source-model summary through action45.
    source_model = load(MODEL_DIAGNOSTIC)['model']
    old_session = source_model['evidence_refs'][0].split(':epoch:')[0]
    session = binding['evidence'][0].split(':epoch:')[0]
    def rebind(value):
        if isinstance(value, str): return value.replace(old_session, session)
        if isinstance(value, list): return [rebind(child) for child in value]
        if isinstance(value, dict): return {key: rebind(child) for key, child in value.items()}
        return value
    source_model = rebind(source_model)
    source_model.pop('model_id')
    source_model['model_id'] = 'program-model:' + program_digest(source_model)[:20]
    source_digest = program_digest(source_model)
    assert source_model['model_id'] == binding['model_id']
    assert source_digest == binding['model_digest'] == relation['source_model_digest']
    baseline = prefixes[37]['sharedSeries']
    for index in range(38, 46):
        series = prefixes[index]['sharedSeries']
        assert series['programModels'] == baseline['programModels']
        assert series['programRefutedEpochs'] == baseline['programRefutedEpochs'] == []
        assert series['programPhaseAlignmentCount'] == baseline['programPhaseAlignmentCount']
        assert series['programReconciliationCount'] == baseline['programReconciliationCount']
        assert discovery[index]['latestBinding'] == binding
    for event in (discovery[38]['latestTrial'], binding, preparation, execution, effect):
        assert event['model_id'] == source_model['model_id'] and event['model_digest'] == source_digest

    # Reconcile every newly issued edit using only public rectangular components.
    edits, event_history = [], []
    for index in range(38, 46):
        before = trace['packets'][index - 1]['packet']
        after = trace['packets'][index]['packet']
        event = discovery[index]['latestTrial'] if index <= 40 else relations[index]['latestTrial']
        assert command(event['command']) == command(trace['packets'][index]['command'])
        assert event['before_frame_digest'] == digest(before['frame_rows'])
        assert event['after_frame_digest'] == digest(after['frame_rows'])
        assert event['evidence'][0].endswith(f":revision:{index}:frame:{before['frame_hash']}")
        assert event['evidence'][1].endswith(f":revision:{index + 1}:frame:{after['frame_hash']}")
        entry = {'actionSequence': index, 'kind': event['kind'], 'mode': event['mode'], 'outcome': event['outcome'],
                 'command': event['command'], 'eventSha256': program_digest(event), 'evidence': event['evidence']}
        event_history.append(entry)
        if event['mode'] not in ('execute', 'probe_execute'):
            first, last = members(before['frame_rows'], geometry), members(after['frame_rows'], geometry)
            a, b = [part['color'] for part in first], [part['color'] for part in last]
            expected = binding['after_word'] if index == 38 else preparation['return_preparation']['after_word'] if index == 39 else event['expected_after_word']
            assert a == event['before_word'] and b == expected
            assert abs(len(a) - len(b)) == 1
            edits.append({'actionSequence': index, 'beforeWord': a, 'afterWord': b,
                          'beforeRectangles': first, 'afterRectangles': last, 'matchesRetainedTrial': True})
    assert preparation['mode'] == 'probe_prepare_return' and preparation['outcome'] == 'known_return_member_inserted'
    assert preparation['binding_id'] == binding['binding_id']
    assert effect['return_preparation_evidence'] == preparation['evidence']
    assert effect['return_measurement']['status'] == 'observed_return_and_current_editor_access'
    prepared_word = preparation['return_preparation']['after_word']
    assert prepared_word == execution['before_word']
    assert prepared_word.count(binding['label']) == 1
    return_label = preparation['return_preparation']['return_label']
    return_move = [move for move in source_model['moves'] if move['label'] == return_label]
    assert len(return_move) == 1 and return_move[0]['status'] == 'phase_observed_translation'
    phases = public_phase_audit(effect, trace['packets'][39]['packet'], trace['packets'][40]['packet'], palette, exclusions)
    assert [phase['label'] for phase in phases] == list(reversed(prepared_word))
    assert len([phase for phase in phases if phase['newControlLabel']]) == 1
    before_return = trace['packets'][39]['packet']['frame_rows']
    after_return = trace['packets'][40]['packet']['frame_rows']
    owner = preparation['return_preparation']['owner_after']
    old_appearance = correspondence(before_return, owner, palette, exclusions)
    new_appearance = correspondence(after_return, owner, palette, exclusions)
    assert old_appearance == new_appearance
    patches = []
    for control in [*geometry['matches'], {'current_bbox': binding['control']['bbox'], 'patch_digest': binding['control']['patch_digest'], 'label': binding['label']}]:
        left, top, right, bottom = control['current_bbox']
        patch = [row[left:right + 1] for row in after_return[top:bottom + 1]]
        assert digest(patch) == control['patch_digest']
        patches.append({'label': control['label'], 'bbox': control['current_bbox'], 'exactPatchRestored': True})

    # A model is acquired once at action40 and then genuinely used by five
    # selected common-caller actions. Official progress is not a second sample.
    assert relations[39]['modelCount'] == 0 and relations[40]['modelCount'] == 1
    assert model_event['kind'] == 'native_program_relation_model'
    assert relation['status'] == 'conditional_relative_public_translation'
    assert relation['support_count'] == len(relation['samples']) == 1
    assert [candidate['kind'] for candidate in relation['candidates']] == ['fixed_delta', 'radial_delta']
    assert relation['causal_status'] == 'phase_association_not_causal_identification'
    sample = relation['samples'][0]
    assert sample['provenance']['effect_digest'] == program_digest(effect)
    assert sample['provenance']['trial_digest'] == program_digest(execution)
    assert sample['provenance']['binding_digest'] == program_digest(binding)
    assert sample['provenance']['return_preparation_evidence'] == preparation['evidence']
    assert sample['preceding_labels'] == [phase['label'] for phase in phases[:next(i for i, phase in enumerate(phases) if phase['newControlLabel'])]]
    new_phase = next(phase for phase in effect['phases'] if phase['new_control_label'])
    world = new_phase['world']
    assert len(world['before_objects']) == len(world['after_objects']) == 2
    assert len(world['translations']) == len(world['preserved_objects']) == 1
    assert world['unmatched_before'] == world['unmatched_after'] == world['word_changes'] == []
    conserved, shifted = world['preserved_objects'][0], world['translations'][0]
    assert sample['bearer_word'] == conserved['word'] == prepared_word
    assert sample['bearer_base'] == conserved['base']
    assert sample['respondent_word'] == shifted['word'] == relation['respondent_word']
    assert sample['respondent_before'] == shifted['before_base'] and sample['respondent_after'] == shifted['after_base']
    assert sample['delta'] == shifted['vector'] == relation['observed_delta']
    assert sample['offset'] == relation['observed_offset'] == [shifted['before_base'][i] - conserved['base'][i] for i in (0, 1)]
    assert sample['phase_start'] == new_phase['start'] and sample['phase_endpoint'] == new_phase['endpoint']
    assert sample['phase_evidence'] == new_phase['evidence'] and sample['residual'] == new_phase['residual']
    assert sample['start_frame_digest'] == new_phase['start_frame_digest']
    assert sample['endpoint_frame_digest'] == new_phase['endpoint_frame_digest']
    assert relation['label'] == new_phase['label'] == binding['label']
    assert relation['binding_id'] == binding['binding_id'] and relation['control_key'] == binding['control_key']
    assert relation['candidates'][0]['delta'] == sample['delta']
    assert relation['candidates'][1]['coefficient'] == 1 and sample['delta'] == sample['offset']
    for index in range(40, 46):
        current = relations[index]
        assert current['latestModel'] == model_event and current['modelCount'] == 1 and current['refutationCount'] == 0
        assert current['trialCount'] == max(0, index - 40)
        if index > 40:
            assert prefixes[index]['proposalKind'] == 'public_program_relation_probe'
            assert current['latestTrial']['relation_id'] == relation['relation_id']
            assert current['latestTrial']['relation_model_digest'] == program_digest(relation)
    terminal = relations[45]['latestTrial']
    assert terminal['mode'] == 'execute' and terminal['official_progress'] is True
    assert terminal['destination_support'] == 'uncharacterized_support_extension'
    assert terminal['outcome'] == 'relation_measurement_unresolved'
    assert terminal['measurement'] == {'status': 'unresolved', 'reason': 'official_boundary_excluded_from_relation_attribution',
                                      'sample': None, 'official_outcome': 'official_progress_observed'}
    assert terminal['evidence'][0].split(':epoch:')[1].split(':')[0] == '4'
    assert terminal['evidence'][1].split(':epoch:')[1].split(':')[0] == '5'

    # The preparation has a different prefix. Recompute its geometric purpose
    # from already observed moves; this is a conditional projection, not a new
    # causal measurement and not evidence of the final operator's semantics.
    execution_prefix = list(reversed(terminal['before_word'][1:]))
    assert terminal['before_word'][0] == binding['label']
    known_vectors = []
    for label in execution_prefix:
        moves = [move for move in source_model['moves'] if move['label'] == label]
        assert len(moves) == 1 and moves[0]['status'] == 'phase_observed_translation'
        assert len(moves[0]['vectors']) == 1
        known_vectors.append(moves[0]['vectors'][0])
    projected_bearer = [terminal['before_bearer']['base'][i] + sum(vector[i] for vector in known_vectors) for i in (0, 1)]
    respondent = next(obj for obj in terminal['before_objects'] if obj['word'] == relation['respondent_word'])
    projected_offset = [respondent['base'][i] - projected_bearer[i] for i in (0, 1)]
    assert projected_offset == relation['observed_offset']
    pair_transport = [projected_bearer[i] - sample['bearer_base'][i] for i in (0, 1)]
    assert pair_transport == [respondent['base'][i] - sample['respondent_before'][i] for i in (0, 1)]
    assert any(pair_transport) and execution_prefix != sample['preceding_labels']

    # Independent appearance timeline, deliberately not fed back into learning.
    # Loss of this exact mask is neither object death nor a terminal-cause proof.
    target_mask = correspondence(trace['packets'][44]['packet']['frame_rows'], respondent, palette, exclusions)['mask']
    timeline = []
    for index, frame in enumerate(trace['packets'][45]['packet']['frame_packet']):
        matching = [part['bbox'] for part in components(frame, palette, exclusions) if part['mask'] == target_mask]
        timeline.append({'packetFrameIndexZeroBased': index, 'exactRespondentAppearanceBboxes': matching,
                         'frameSha256': digest(frame)})
    audit = {
        'schema': 'logos-engine.v42.public-program-relation-audit.v1', 'auditStatus': 'passed',
        'scope': 'Offline audit of saved public packets, pixel masks and retained event projections. No agent, fitted planner or game engine executed; no private state or game implementation read.',
        'inputs': {name: proof(path) for name, path in [('report', REPORT), ('publicTrace', TRACE), ('v41Report', PREVIOUS_REPORT),
                                                      ('v41PublicTrace', PREVIOUS_TRACE), ('acquiredSourceModelDiagnostic', MODEL_DIAGNOSTIC)]},
        'hashVerification': {'sourceDigest': report['source']['digest'], 'sourceManifestFilesVerified': report['source']['fileCount'],
                             'canonicalPublicPacketsVerified': len(trace['packets']), 'physicalCommandsVerified': len(report['actions']),
                             'execution40AnimationFrameDigestsVerified': len(trace['packets'][40]['packet']['frame_packet']),
                             'execution45RawAnimationFramesAudited': len(timeline), 'sourceUnchangedDuringRun': True,
                             'pythonAgentModules': [], 'qualification': 'Packet and manifest digests are recomputed. Reported Kernel projections are cross-checked; this is not an external signature or a reconstruction of the entire internal graph.'},
        'officialProgress': {'completedLevels': 4, 'targetLevels': 6, 'sixLevelTargetMet': False, 'levelFourCompleted': True,
                             'boundariesRecomputedFromPublicScores': boundaries, 'finalLevel': 5, 'stopReason': report['final']['reason'],
                             'actions': 45, 'sessions': 1, 'fullV6Parity': False},
        'v41Comparison': {'initialAndFirst38ReturnsExactlyIdentical': True, 'identicalPhysicalCommands': 38,
                          'identicalCompletePublicPacketsIncludingInitial': 39, 'firstChangedCommand': 39,
                          'sameOpaqueGameAssetHashes': True, 'qualification': 'Recorded command/packet equality only; no replayed action was injected into the physical campaign by this audit.'},
        'retainedEventChronology': event_history,
        'independentEditMeasurements': edits,
        'returnPreparation': {'wordBefore': preparation['before_word'], 'wordAfter': prepared_word,
                              'inverseLabel': return_label, 'inverseVector': return_move[0]['vectors'][0],
                              'returnMeasuredAtSameBase': preparation['return_preparation']['expected_return_base'],
                              'sameExactColoredBearerAppearance': True, 'restoredControlPatches': patches,
                              'qualification': 'The return was observed in this execution. It is not a universal preservation law for the new input.'},
        'execution40PublicPhases': phases,
        'relationModel': {'relationId': relation['relation_id'], 'sourceModelId': source_model['model_id'],
                          'sourceModelDigest': source_digest, 'supportCount': 1, 'acquiredAtAction': 40,
                          'reusedByRealActions': [41, 42, 43, 44, 45], 'offset': relation['observed_offset'],
                          'displacement': relation['observed_delta'], 'respondentWord': relation['respondent_word'],
                          'candidatesRetained': relation['candidates'], 'observedPrecedingLabels': sample['preceding_labels'],
                          'causalStatus': relation['causal_status'], 'uncertaintiesPreserved': relation['uncertainties'],
                          'unchangedThroughOfficialBoundary': True},
        'execution45BoundaryTreatment': {'beforeWord': terminal['before_word'], 'destinationSupport': terminal['destination_support'],
                                         'preparationProjection': {'executionPrefix': execution_prefix, 'observedSourceVectors': known_vectors,
                                                                   'projectedBearerBase': projected_bearer, 'respondentBaseBefore': respondent['base'],
                                                                   'projectedRelativeOffset': projected_offset, 'pairTransportFromFirstSample': pair_transport,
                                                                   'prefixMatchesFirstSample': False,
                                                                   'qualification': 'Geometry recomputed from observed source movements only. The new prefix and destination support are validation questions; this projection is not an additional measured relation sample.'},
                                         'officialScoreBefore': 3, 'officialScoreAfter': 4, 'measurement': terminal['measurement'],
                                         'newConservativeSampleCreated': False, 'relationSupportAfter': 1,
                                         'relationModelCountAfter': 1, 'relationRefutationCountAfter': 0,
                                         'removalReductionOrTerminalLawPromoted': False,
                                         'rawAppearanceTimeline': timeline,
                                         'qualification': 'The public score proves the fourth completion. The boundary prevents attribution of the full rewrite to one operator. Raw mask presence/absence is retained for audit only and is not a general disappearance, reduction or terminal rule.'},
        'originalModelPreservation': {'fullReconstructedModelMatchesAcquiredDigest': True, 'reportedModelSummariesUnchanged': True,
                                      'refutedEpochsBeforeAndAfter': [], 'phaseAlignmentCount': baseline['programPhaseAlignmentCount'],
                                      'reconciliationCount': baseline['programReconciliationCount'], 'operatorAliasCreated': False,
                                      'qualification': 'The complete recorded source-model payload is verified against the acquired digest. Its reported summaries and source guards remain unchanged throughout the new trials; the separate native relation retains its own uncertainty.'},
        'conclusion': 'Four STCK levels are officially completed in 3, 7, 25 and 10 actions. A real conditional return restores editing access. One acquired phase relation then guides four verified edits and one execution through the common caller. The final official boundary is not counted as confirmation of conservative translation: support stays one, both displacement explanations and delayed-response ambiguity remain open.',
        'nextEvidenceNeeded': 'Characterize a nonterminal transported phase or an independently controlled prefix/offset/support contrast. Keep official success separate from which operation or disappearance caused it.',
    }
    (ROOT / OUTPUT).write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'auditStatus': audit['auditStatus'], 'levels': 4, 'levelActions': [item['levelActions'] for item in boundaries],
                      'packets': len(trace['packets']), 'firstUnchangedActions': 38, 'relationSupport': 1,
                      'boundaryPromoted': False, 'output': OUTPUT}))


if __name__ == '__main__':
    main()
