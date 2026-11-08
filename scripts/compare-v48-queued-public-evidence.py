#!/usr/bin/env python3
"""Independently verify retained source/native queue evidence without execution.

No agent and no game is run. Complete public packets remain byte-value exact.
Observation namespaces and their explicitly recomputed derived identifiers are
the only internal normalization. Search ranks and all model alternatives remain
exact numerical values, without a tolerance or omission of conditional models.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v48'
PUBLIC_FIELDS = ['frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash']
OBSERVATION_REF = re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def load(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)
def proof(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()
def digest(value): return hashlib.sha256(packed(value)).hexdigest()
def exact(a, b): return packed(a) == packed(b)
def packet_hash(packet): return hashlib.sha256(json.dumps(packet, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def verify_native(campaign_path, trace_path, execution_path, manifest_path):
    campaign, trace, execution, source = map(load, (campaign_path, trace_path, execution_path, manifest_path))
    assert campaign['status'] == trace['status'] == 'passed'
    assert campaign['game'] == trace['game'] == 'COLM'
    assert exact(campaign['source'], source) and campaign['sourceUnchangedDuringRun']
    assert trace['sourceDigest'] == source['digest'] and not campaign['pythonAgentModules']
    assert source['fileCount'] == len(source['files']) and source['digest'] == digest(source['files'])
    current_files = {path.relative_to(ROOT).as_posix(): sha(path)
                     for folder in ['src/logos-engine', 'src/runtime']
                     for path in (ROOT / folder).rglob('*') if path.is_file() and path.suffix in ('.ts', '.json', '.drm')}
    assert exact(current_files, source['files']), 'Current native inventory differs from frozen execution'
    assert execution['exitCode'] == 0 and execution['nativeSourceUnchanged'] is True
    assert exact(execution['nativeSource'], source) and exact(execution['nativeSourceAfter'], source)
    assert execution['nativeSourceManifestDigest'] == source['digest']
    assert execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', 'COLM', '3', str(campaign_path), str(trace_path)]
    for key, expected in [('report', campaign_path), ('trace', trace_path)]: assert exact(execution[key], proof(expected))
    for key in ('generator', 'output'): assert exact(execution[key], proof(ROOT / execution[key]['path']))
    lines = gzip.decompress((ROOT / execution['output']['path']).read_bytes()).decode().splitlines()
    final_log = json.loads(lines[-1])
    assert final_log['status'] == 'passed' and final_log['sourceDigest'] == source['digest']
    assert final_log['report'] == str(campaign_path) and final_log['trace'] == str(trace_path)
    assert exact(final_log['final'], campaign['final']) and exact(final_log['boundaries'], campaign['boundaries'])
    assert campaign['final']['sessions'] == 1 and campaign['final']['fullV6Parity'] is False
    assert campaign['final']['nativeImplementation'] == 'logos-engine.typescript.v6.native-migration/0.18.0'
    assert len(trace['packets']) == len(campaign['actions']) + 1
    assert packet_hash(trace['packets'][0]['packet']) == campaign['initial']['publicPacketSha256']
    for index, item in enumerate(trace['packets'][1:]):
        action = campaign['actions'][index]
        assert exact(item['command'], action['command']) and packet_hash(item['packet']) == action['publicPacketSha256']
        assert len(item['packet']['frame_packet']) == action['animationFrames']
        assert item['packet']['level'] == action['levelAfter'] and item['packet']['levels_completed'] == action['completedAfter']
        assert item['packet']['state'] == action['state'] and item['packet']['frame_hash'] == action['frameHash']
        assert action['sequence'] == index + 1 and action['family'] == 'public_occurrence_recall'
    for name, expected in campaign['gameAssets'].items(): assert sha(ROOT / 'public/python' / name) == expected, name
    return campaign, trace, source


def compare():
    campaign_path, trace_path = OUT / 'colm-three-levels.json', OUT / 'colm-public-trace.json.gz'
    execution_path, manifest_path = OUT / 'logs/execution-colm.json', OUT / 'source-manifest.json'
    campaign, trace, native_source = verify_native(campaign_path, trace_path, execution_path, manifest_path)
    probe_path = ROOT / 'tests/fixtures/v6-queued-field-original-public.json.gz'
    reference_path = ROOT / 'tests/fixtures/v6-queued-field-reference.json.gz'
    original, reference = load(probe_path), load(reference_path)
    assert original['game'] == 'COLM' and original['status'] == 'passed' and original['reason'] == 'target_levels_completed'
    assert original['sourceModified'] is False and original['sessionCount'] == 1
    assert original['manualPrimingActions'] == original['resets'] == original['levelJumps'] == 0
    assert original['actions'] == campaign['final']['actions'] == 45
    assert original['targetLevels'] == original['levelsCompleted'] == campaign['final']['levelsCompleted'] == campaign['targetLevels'] == 3
    assert original['state'] == campaign['final']['state'] == 'NOT_FINISHED'
    assert campaign['final']['reason'] == 'target_levels_completed' and campaign['final']['level'] == 4
    assert exact(original['gameAssetHashes'], campaign['gameAssets'])
    source_root = ROOT / 'reference/v6' / original['sourceCommit']
    manifest = load(source_root / 'manifest.json')['files']
    assert original['sourceCommit'] == campaign['referenceCommit'] == reference['sourceCommit'] == '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
    assert original['pinnedSourceFilesVerifiedBeforeImport'] == reference['pinnedSourceFilesVerifiedBeforeImport'] == len(manifest) == 1786
    for path, item in manifest.items(): assert sha(source_root / 'source' / path) == item['sha256'], path
    for evidence in (original, reference):
        for path, expected in evidence['sourceHashes'].items(): assert manifest[path]['sha256'] == expected, path
        assert sha(ROOT / evidence['generator']) == evidence['generatorSha256']
    assert reference['originalPublicProbe']['sha256'] == sha(probe_path)
    diagnostic = reference['originalParentProjectionDiagnostic']
    assert diagnostic['sha256'] == sha(ROOT / diagnostic['path'])
    assert diagnostic['generatorSha256'] == sha(ROOT / diagnostic['generatorArchive'])
    assert load(ROOT / diagnostic['path'])['generatorSha256'] == diagnostic['generatorSha256']
    assert reference['sourceAliasing'] == []
    assert len(original['requests']) == 46 and original['requests'][0] == {'type': 'load', 'code': 'COLM', 'level': 1}
    assert all(item['type'] == 'action' for item in original['requests'][1:])
    assert original['budget'] == {'levelActions': 120, 'levelSeconds': 180, 'targetLevels': 3}
    assert campaign['budget']['levelActionCaps'] == [600] * 3 and campaign['budget']['activeSecondsPerLevel'] == 360
    assert len(original['packets']) == len(trace['packets']) == 46
    checkpoints, transport_normalizations = [], []
    for index, (left, right) in enumerate(zip(original['packets'], trace['packets'])):
        assert set(left['packet']) == set(right['packet']) == set(PUBLIC_FIELDS)
        command_exact = exact(left['command'], right['command'])
        if not command_exact:
            assert set(left['command']) == {'action_ref'} and left['command']['action_ref'] != 'ACTION6', index
            assert right['command'] == {**left['command'], 'data': {}}, index
            assert original['requests'][index] == {'type': 'action', 'actionId': int(left['command']['action_ref'][6:]), 'data': None}, index
            transport_normalizations.append({'kind': 'empty_scalar_transport_payload', 'packetIndex': index,
                'source': left['command'], 'native': right['command'],
                'scope': 'The source scalar command omits data and its host request carries null. Native public transport supplies an empty object; the acquired program still retains its exact raw scalar command. No coordinate or effect parameter changes.'})
        assert exact(left['packet'], right['packet']), f'Complete raw public packet {index}'
        checkpoints.append({'index': index, 'commandRawExact': command_exact, 'commandEffectParametersExact': True,
            'allPublicFieldsExact': True, 'canonicalPublicPacketSha256': digest(right['packet']),
            'animationFrames': len(right['packet']['frame_packet'])})
    assert len(transport_normalizations) == 45
    assert [item['actions'] for item in original['boundaries']] == [item['totalActions'] for item in campaign['boundaries']] == [17, 34, 45]
    assert [item['levelActions'] for item in original['boundaries']] == [item['levelActions'] for item in campaign['boundaries']] == [17, 17, 11]
    assert all(item['sessionRetained'] for item in campaign['boundaries'])
    assert len(original['prefixes']) == len(campaign['prefixes']) == len(reference['commonEnvelopes']) == 21

    source_session = OBSERVATION_REF.fullmatch(original['packets'][0]['observation']['observation_ref'])[1]
    native_session = OBSERVATION_REF.fullmatch(campaign['prefixes'][0]['queuedField']['plan']['observation_ref'])[1]
    assert source_session != native_session
    scope_map, normalizations = {}, []
    for index, item in enumerate(original['packets']):
        packet, observed = item['packet'], item['observation']
        suffix = f":epoch:{packet['level']}:revision:{index + 1}:frame:{packet['frame_hash']}"
        expected = native_session + suffix
        assert observed['observation_ref'] == source_session + suffix
        scope_map[observed['observation_ref']] = expected
        normalizations.append({'kind': 'actual_observation_session_namespace', 'packetIndex': index,
                               'source': observed['observation_ref'], 'native': expected})

    digests = {'model_digest': {}, 'source_relation_digest': {}, 'request_ref': {}}
    stats = {'comparedNumbers': 0, 'exactIntegerValues': 0, 'exactFractionalValues': 0,
             'normalizedObservationRefs': 0, 'normalizedDerivedReferences': 0}

    def register(kind, left, right, source_payload, native_payload, prefix_index, prefix=''):
        assert left == prefix + digest(source_payload), (kind, prefix_index, 'source derived identity')
        assert right == prefix + digest(native_payload), (kind, prefix_index, 'native derived identity')
        if left in digests[kind]: assert digests[kind][left] == right
        else:
            digests[kind][left] = right
            normalizations.append({'kind': 'independently_recomputed_' + kind, 'prefixIndex': prefix_index,
                'source': left, 'native': right,
                'scope': 'Both identifiers are independently recomputed from their complete retained payload. Payload equality is checked with the explicit observation namespace mapping; no state, command, rank or conditional alternative is omitted.'})

    def equivalent(left, right, path):
        if isinstance(left, bool) or left is None:
            assert type(left) is type(right) and left == right, path
            return
        if isinstance(left, (int, float)):
            assert isinstance(right, (int, float)) and not isinstance(right, bool) and math.isfinite(right), path
            assert left == right, (path, left, right)
            stats['comparedNumbers'] += 1
            if int(left) == left: stats['exactIntegerValues'] += 1
            else: stats['exactFractionalValues'] += 1
            return
        if isinstance(left, str):
            if left in scope_map:
                assert right == scope_map[left], path
                stats['normalizedObservationRefs'] += 1
                return
            kind = next((kind for kind in digests if path.endswith('.' + kind)), None)
            if kind is not None and left in digests[kind]:
                assert right == digests[kind][left], path
                stats['normalizedDerivedReferences'] += 1
                return
            assert left == right, (path, left, right)
            return
        if isinstance(left, list):
            assert isinstance(right, list) and len(left) == len(right), path
            for index, (a, b) in enumerate(zip(left, right)): equivalent(a, b, f'{path}.{index}')
            return
        assert isinstance(left, dict) and isinstance(right, dict) and set(left) == set(right), path
        for key in left: equivalent(left[key], right[key], path + '.' + key)

    checks, source_events, native_events, action_count, empty_receipts = [], [], [], 0, 0
    for index, (source_prefix, native_prefix, envelope) in enumerate(zip(original['prefixes'], campaign['prefixes'], reference['commonEnvelopes'])):
        plan, native_plan = source_prefix['proposal']['queued_field_plan'], native_prefix['queuedField']['plan']
        assert native_prefix['family'] == 'public_occurrence_recall' and native_prefix['fieldSubquestion'] == 'queued_field_composition'
        assert native_prefix['proposalKind'] == 'queued_field_experiment' and native_prefix['queuedField']['stateNode'] == 'family_state:public_occurrence_recall'
        assert native_prefix['operations'] == ['OP29', 'OP30', 'OP31']
        assert native_prefix['acquiredActions'] == len(source_prefix['steps']) == len(envelope['steps'])
        assert envelope['firstAction'] == action_count + 1
        source_previous = source_prefix['beforeState']['projection']['queue_state']
        native_previous = native_events[-1]['state'] if native_events else None
        source_state = plan['portable_model'] or (source_previous if source_previous and source_previous['epoch'] == plan['epoch'] else None)
        native_state = native_plan['portable_model'] or (native_previous if native_previous and native_previous['epoch'] == native_plan['epoch'] else None)
        register('model_digest', plan['model_digest'], native_plan['model_digest'], source_state, native_state, index)
        if plan['portable_model'] is not None:
            assert native_plan['portable_model'] is not None
            register('source_relation_digest', plan['portable_model']['transfer_scope']['source_relation_digest'],
                native_plan['portable_model']['transfer_scope']['source_relation_digest'],
                [source_previous['controls'], source_previous['closure_models']],
                [native_previous['controls'], native_previous['closure_models']], index)
        if plan['estimate'] is not None:
            estimate, native_estimate = plan['estimate'], native_plan['estimate']
            register('request_ref', estimate['mechanical_receipt']['request']['request_ref'],
                native_estimate['mechanical_receipt']['request']['request_ref'],
                [plan['observation_ref'], estimate['placed'], estimate['model_alternatives'][0]],
                [native_plan['observation_ref'], native_estimate['placed'], native_estimate['model_alternatives'][0]], index, 'queue:')
        equivalent(source_state, native_state, f'prefix.{index}.effective_state')
        equivalent(plan, native_plan, f'prefix.{index}.plan')
        assert exact(plan['scene'], native_plan['scene']) and exact(plan['commands'], native_plan['commands'])
        new_source_events = [event for step in envelope['steps'] for event in step['ownEvents']]
        new_native_events = native_prefix['sharedSeries']['queuedFieldAcquiredModels']
        equivalent(new_source_events, new_native_events, f'prefix.{index}.all_acquired_events')
        source_events.extend(new_source_events); native_events.extend(new_native_events)
        empty_receipts += sum(not step['ownEvents'] for step in envelope['steps'])
        assert native_prefix['sharedSeries']['queuedFieldModelCount'] == len(source_events) == len(native_events)
        equivalent(source_events[-1] if source_events else None, native_prefix['sharedSeries']['queuedFieldLatestModel'], f'prefix.{index}.latest_event')
        action_count += len(envelope['steps'])
        assert native_prefix['callerAcquiredTransitions'] == action_count
        checks.append({'prefixIndex': index, 'firstAction': envelope['firstAction'], 'acquiredActions': len(envelope['steps']),
            'rawSceneExact': True, 'rawPlannedCommandsExact': True, 'completePlanEquivalent': True,
            'everyAcquiredOwnEventEquivalent': True, 'ownEventsAcquired': len(new_source_events), 'ownEventsRetained': len(source_events),
            'nativePlanSha256': digest(native_plan), 'nativeAcquiredEventsSha256': digest(new_native_events)})
    assert action_count == 45 and len(source_events) == len(native_events) == 39 and empty_receipts == 6
    equivalent(original['finalState']['projection']['queue_events'], native_events, 'complete_final_queue_events')
    assert campaign['final']['caller']['acquiredTransitions'] == 45 and campaign['final']['caller']['boundaryReplays'] == 2
    assert campaign['final']['prefixes'] == 21
    frames = sum(len(item['packet']['frame_packet']) for item in trace['packets'])
    assert frames == sum(len(item['packet']['frame_packet']) for item in original['packets']) == 125
    return {'schema': 'logos-engine.v48.queued-public-component-comparison.v1', 'status': 'passed',
        'comparisonConclusion': 'exact_complete_public_trajectory_through_third_boundary_and_complete_conditional_queue_evidence',
        'recordedPublicTrajectoryEquivalent': True, 'originalFullCommonCallerParity': False,
        'inputs': {'sourceComponent': proof(probe_path), 'sourceCommonReference': proof(reference_path), 'nativeCampaign': proof(campaign_path),
                   'nativeTrace': proof(trace_path), 'nativeExecution': proof(execution_path), 'nativeSourceManifest': proof(manifest_path)},
        'generator': proof(Path(__file__)), 'nativeSourceDigest': native_source['digest'],
        'summary': {'levelsCompleted': 3, 'sourceCommands': 45, 'nativeCommands': 45, 'rawExactCommands': 0,
                    'normalizedPublicCommands': 45, 'exactActionReferencesAndEffectParameters': 45,
                    'rawExactCompletePublicPackets': 46, 'animationFramesIncludingInitial': frames,
                    'sourcePrefixes': 21, 'nativePrefixes': 21, 'officialBoundaries': 3,
                    'sourceTargetLevels': 3, 'nativeTargetLevels': 3, 'sourceTargetReached': True, 'nativeTargetReached': True,
                    'officialState': 'NOT_FINISHED', 'enteredLevel': 4, 'completeComparedPlans': 21,
                    'completeComparedAcquiredQueueEvents': 39, 'transitionsWithoutOwnQueueEvent': 6,
                    'sourceMutableAliasMutations': 0, 'callerAcquiredTransitions': 45, 'callerBoundaryReplays': 2,
                    'sessionCountPerCampaign': 1, **stats},
        'sourceVerification': {'referenceCommit': original['sourceCommit'], 'sourceComponentImportedFiles': len(original['sourceHashes']),
                               'sourceReferenceImportedFiles': len(reference['sourceHashes']), 'completePinnedManifestFilesVerified': len(manifest),
                               'sourceUnchanged': True, 'sourceAndNativeAssetHashesExact': True, 'generatorsVerified': True,
                               'originalParentProjectionDiagnosticRetained': True},
        'nativeVerification': {'fileCount': len(native_source['files']), 'completeCurrentInventoryExact': True,
                               'beforeAndAfterExecutionManifestsExact': True, 'executionExitCode': 0,
                               'reportTraceAndExecutionLogHashesVerified': True, 'pythonAgentModules': [], 'sourceUnchangedDuringRun': True},
        'publicComparison': {'fields': PUBLIC_FIELDS, 'packetNormalizations': [], 'commandNormalizations': transport_normalizations,
                             'checkpoints': checkpoints, 'boundaryActions': [17, 34, 45], 'perLevelActions': [17, 17, 11]},
        'internalProjectionComparison': {'absoluteNumericTolerance': 0, 'normalizations': normalizations, 'prefixes': checks,
            'scope': 'Every field of all 21 conditional plans and all 39 own acquired queue events is compared. The six transitions without a queue-model receipt remain explicit. Observation namespaces retain exact epoch/revision/frame suffix. Model digests, portable relation digests and mechanical request references are independently recomputed from complete contents. All field cells, controls, alternative line models, exact search ranks, node counts, queue previews, refutations, wave traces and physical occurrence identities remain compared.',
            'notCompared': ['original full common-caller selection', 'complete graph identity and shared-family inherited digest',
                            'equal budgets or elapsed performance', 'full-game completion beyond the declared three-level target']},
        'qualification': 'The unchanged isolated original component and native common caller each complete three levels in one cold continuous session. All 45 action references and effect parameters agree; native public scalar commands add only the explicitly accounted empty transport data object. All 46 complete public packets and 125 animation images agree without normalization. Internal numeric values agree exactly. Finite contribution estimates remain conditional; no observed removal count is promoted to official terminal quota. This is not original full caller parity or a complete-game WIN.'}


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--verify', action='store_true'); args = parser.parse_args()
    destination = OUT / 'colm-original-component-comparison.json'
    result = compare()
    if args.verify: assert exact(load(destination), result), 'Retained comparison differs from recomputed evidence'
    else:
        if destination.exists(): raise FileExistsError(destination)
        destination.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create',
                      'output': str(destination.relative_to(ROOT)), 'summary': result['summary']}))


if __name__ == '__main__':
    main()
