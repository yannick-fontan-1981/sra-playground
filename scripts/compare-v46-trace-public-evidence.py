#!/usr/bin/env python3
"""Validate and compare saved trace-field evidence; never run an agent or game."""
from __future__ import annotations

import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v46'
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
def strings(value):
    if isinstance(value, str): yield value
    elif isinstance(value, dict):
        for child in value.values(): yield from strings(child)
    elif isinstance(value, list):
        for child in value: yield from strings(child)


def verify_native(campaign_path, trace_path, execution_path, manifest_path):
    campaign, trace, execution, source = map(load, (campaign_path, trace_path, execution_path, manifest_path))
    assert campaign['status'] == trace['status'] == 'passed'
    assert campaign['game'] == trace['game'] == 'ZIPP'
    assert exact(campaign['source'], source) and campaign['sourceUnchangedDuringRun']
    assert trace['sourceDigest'] == source['digest'] and not campaign['pythonAgentModules']
    assert source['fileCount'] == len(source['files']) == 152
    assert source['digest'] == digest(source['files'])
    current_files = {p.relative_to(ROOT).as_posix(): sha(p)
                     for folder in ['src/logos-engine', 'src/runtime']
                     for p in (ROOT / folder).rglob('*') if p.is_file() and p.suffix in ('.ts', '.json', '.drm')}
    assert exact(current_files, source['files']), 'Current complete native source must equal the campaign snapshot'
    assert execution['exitCode'] == 0 and execution['nativeSourceUnchanged'] is True
    assert exact(execution['nativeSource'], source) and exact(execution['nativeSourceAfter'], source)
    assert execution['nativeSourceManifestDigest'] == source['digest']
    assert execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', 'ZIPP', '4', str(campaign_path), str(trace_path)]
    for key, expected in [('report', campaign_path), ('trace', trace_path)]: assert exact(execution[key], proof(expected))
    for key in ('generator', 'output'): assert exact(execution[key], proof(ROOT / execution[key]['path']))
    lines = gzip.decompress((ROOT / execution['output']['path']).read_bytes()).decode().splitlines()
    final_log = json.loads(lines[-1])
    assert final_log['status'] == 'passed' and final_log['sourceDigest'] == source['digest']
    assert final_log['report'] == str(campaign_path) and final_log['trace'] == str(trace_path)
    assert exact(final_log['final'], campaign['final']) and exact(final_log['boundaries'], campaign['boundaries'])
    assert campaign['final']['sessions'] == 1 and campaign['final']['fullV6Parity'] is False
    assert campaign['final']['nativeImplementation'] == 'logos-engine.typescript.v6.native-migration/0.16.0'
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
    return campaign, trace, execution, source


def compare():
    campaign_path, trace_path = OUT / 'zipp-four-levels.json', OUT / 'zipp-public-trace.json.gz'
    execution_path, manifest_path = OUT / 'logs/execution-zipp.json', OUT / 'source-manifest.json'
    campaign, trace, execution, source = verify_native(campaign_path, trace_path, execution_path, manifest_path)
    fixture_path = ROOT / 'tests/fixtures/v6-trace-field-original-public.json.gz'
    original = load(fixture_path)
    assert original['game'] == 'ZIPP' and original['targetLevels'] == 6
    assert original['status'] == 'stopped' and original['reason'] == 'trace_component_abstained'
    assert original['sourceModified'] is False and original['sessionCount'] == 1
    assert original['manualPrimingActions'] == original['resets'] == original['levelJumps'] == 0
    assert original['actions'] == campaign['final']['actions'] == 53
    assert original['levelsCompleted'] == campaign['final']['levelsCompleted'] == campaign['targetLevels'] == 4
    assert original['state'] == campaign['final']['state'] == 'NOT_FINISHED'
    assert campaign['final']['reason'] == 'target_levels_completed' and campaign['final']['level'] == 5
    assert exact(original['gameAssetHashes'], campaign['gameAssets'])
    reference = ROOT / 'reference/v6' / original['sourceCommit']
    manifest = load(reference / 'manifest.json')['files']
    assert original['sourceCommit'] == campaign['referenceCommit'] == '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
    assert original['pinnedSourceFilesVerifiedBeforeImport'] == len(manifest) == 1786
    for path, item in manifest.items(): assert sha(reference / 'source' / path) == item['sha256'], path
    for path, expected in original['sourceHashes'].items(): assert manifest[path]['sha256'] == expected, path
    assert len(original['sourceHashes']) == 786
    assert sha(ROOT / original['generator']) == original['generatorSha256']
    assert len(original['requests']) == 54 and original['requests'][0] == {'type': 'load', 'code': 'ZIPP', 'level': 1}
    assert all(item['type'] == 'action' for item in original['requests'][1:])
    assert original['budget'] == {'levelActions': 120, 'levelSeconds': 180, 'targetLevels': 6}
    assert campaign['budget']['levelActionCaps'] == [600] * 4 and campaign['budget']['activeSecondsPerLevel'] == 360
    assert len(original['packets']) == len(trace['packets']) == 54
    checkpoints = []
    for index, (left, right) in enumerate(zip(original['packets'], trace['packets'])):
        assert set(left['packet']) == set(right['packet']) == set(PUBLIC_FIELDS)
        assert exact(left['command'], right['command']), f'command {index}'
        assert exact(left['packet'], right['packet']), f'complete public packet {index}'
        checkpoints.append({'index': index, 'commandExact': True, 'allPublicFieldsExact': True,
            'canonicalPublicPacketSha256': digest(right['packet']), 'nativeRecordedPublicPacketSha256': packet_hash(right['packet']),
            'animationFrames': len(right['packet']['frame_packet'])})
    assert [item['actions'] for item in original['boundaries']] == [item['totalActions'] for item in campaign['boundaries']] == [8, 23, 38, 53]
    assert [item['levelActions'] for item in original['boundaries']] == [item['levelActions'] for item in campaign['boundaries']] == [8, 15, 15, 15]
    assert all(item['sessionRetained'] for item in campaign['boundaries'])
    assert len(original['prefixes']) == len(campaign['prefixes']) == 12

    # Map only complete, actually observed scope references. No pixels,
    # commands, chronological indices or public protocol fields are normalized.
    source_ref = original['packets'][0]['observation']['observation_ref']
    native_ref = campaign['prefixes'][0]['traceField']['plan']['observation_ref']
    source_session, native_session = OBSERVATION_REF.fullmatch(source_ref)[1], OBSERVATION_REF.fullmatch(native_ref)[1]
    assert source_session != native_session
    native_strings = set(strings([p['traceField'] for p in campaign['prefixes']] + [p['sharedSeries']['traceFieldLatestExtension'] for p in campaign['prefixes']]))
    scope_map, normalizations = {}, []
    for index, item in enumerate(original['packets']):
        observed, packet = item['observation'], item['packet']
        suffix = f":epoch:{packet['level']}:revision:{index + 1}:frame:{packet['frame_hash']}"
        expected = native_session + suffix
        assert observed['observation_ref'] == source_session + suffix
        assert expected in native_strings, f'No retained current-scope evidence for public packet {index}'
        scope_map[observed['observation_ref']] = expected
        normalizations.append({'kind': 'actual_observation_session_namespace', 'packetIndex': index,
                               'source': observed['observation_ref'], 'native': expected})
    for index, (left, right) in enumerate(zip(original['prefixes'], campaign['prefixes'])):
        a, b = left['proposal']['trace_field_plan'], right['traceField']['plan']
        source_request = 'trace:' + digest([a['observation_ref'], a['scene']])
        native_request = 'trace:' + digest([b['observation_ref'], b['scene']])
        assert a['estimate']['receipt']['scope']['request_ref'] == source_request
        assert b['estimate']['receipt']['scope']['request_ref'] == native_request
        assert a['estimate']['receipt']['descriptive_facts']['request_ref'] == source_request
        assert b['estimate']['receipt']['descriptive_facts']['request_ref'] == native_request
        scope_map[source_request] = native_request
        normalizations.append({'kind': 'mechanical_request_digest_recomputed_from_exact_scene_and_observation', 'prefixIndex': index,
                               'source': source_request, 'native': native_request})
    def normalized(value):
        if isinstance(value, str):
            if value.startswith(source_session + ':'): assert value in scope_map, value
            return scope_map.get(value, value)
        if isinstance(value, dict): return {key: normalized(child) for key, child in value.items()}
        if isinstance(value, list): return [normalized(child) for child in value]
        return value

    prefix_checks, observed_evidence = [], {}
    actions = 0
    for index, (left, right) in enumerate(zip(original['prefixes'], campaign['prefixes'])):
        proposal, plan = left['proposal'], right['traceField']['plan']
        assert right['family'] == 'public_occurrence_recall' and right['fieldSubquestion'] == 'trace_field_composition'
        assert right['proposalKind'] == 'trace_field_experiment' and right['traceField']['stateNode'] == 'family_state:public_occurrence_recall'
        assert right['operations'] == ['OP29', 'OP30', 'OP31']
        assert right['acquiredActions'] == len(left['steps'])
        assert right['decisionRevision'] == actions + 1
        assert exact(proposal['trace_field_plan']['scene'], plan['scene'])
        assert exact(proposal['trace_field_plan']['estimate']['path'], plan['estimate']['path'])
        assert exact([step['relation_observed'] for step in proposal['steps']], right['traceField']['observedSteps'])
        assert exact(normalized(proposal['trace_field_plan']), plan), f'normalized complete conditional plan {index}'
        actions += right['acquiredActions']
        assert right['callerAcquiredTransitions'] == actions and right['sharedSeries']['traceFieldExtensionCount'] == actions
        latest_source = left['steps'][-1]['afterState']['projection']['trace_events'][-1]
        latest_native = right['sharedSeries']['traceFieldLatestExtension']
        assert exact(normalized(latest_source), latest_native), f'actual retained latest trace event {index}'
        for evidence in [*latest_native['state']['successes'], *latest_native['state']['failures'], latest_native['transition']]:
            key = evidence['after_ref']
            if key in observed_evidence: assert exact(observed_evidence[key], evidence)
            observed_evidence[key] = evidence
        assert plan['estimate']['receipt']['status'] == 'COMPLETE'
        assert not plan['estimate']['receipt']['values']['contradiction_certificates']
        assert plan['estimate']['receipt']['descriptive_facts']['primitive_release_authorized'] is False
        prefix_checks.append({'prefixIndex': index, 'firstAction': left['steps'][0]['actionIndex'], 'lastAction': actions,
            'acquiredActions': right['acquiredActions'], 'rawSceneExact': True, 'rawCoverPathExact': True,
            'relationObservedStepsExact': True, 'scopeNormalizedCompletePlanExact': True,
            'scopeNormalizedLatestKernelTraceEventExact': True, 'callerAcquiredTransitions': right['callerAcquiredTransitions'],
            'kernelTraceExtensionCount': right['sharedSeries']['traceFieldExtensionCount'],
            'normalizedPlanSha256': digest(plan), 'normalizedLatestKernelEventSha256': digest(latest_native),
            'residualExaminedCount': plan['estimate']['receipt']['examined_count'], 'searchNodes': plan['estimate']['search_nodes']})
    source_evidence = [event['transition'] for event in original['finalState']['projection']['trace_events']]
    assert len(observed_evidence) == len(source_evidence) == actions == 53
    for event in source_evidence:
        normalized_event = normalized(event)
        assert exact(normalized_event, observed_evidence[normalized_event['after_ref']])
    outcomes = dict(Counter(event['outcome'] for event in observed_evidence.values()))
    assert outcomes == {'local_extension_observed': 49, 'official_boundary': 4}
    frames = sum(len(item['packet']['frame_packet']) for item in trace['packets'])
    assert frames == sum(len(item['packet']['frame_packet']) for item in original['packets']) == 66
    assert campaign['final']['caller']['acquiredTransitions'] == 53 and campaign['final']['caller']['boundaryReplays'] == 3
    return {'schema': 'logos-engine.v46.trace-public-component-comparison.v1', 'status': 'passed',
        'comparisonConclusion': 'exact_recorded_public_trajectory_through_fourth_boundary_with_explicit_scope_normalization_for_internal_projections',
        'recordedPublicTrajectoryEquivalent': True, 'originalFullCommonCallerParity': False,
        'inputs': {'sourceComponent': proof(fixture_path), 'nativeCampaign': proof(campaign_path), 'nativeTrace': proof(trace_path),
                   'nativeExecution': proof(execution_path), 'nativeSourceManifest': proof(manifest_path)},
        'generator': proof(Path(__file__)), 'nativeSourceDigest': source['digest'],
        'summary': {'levelsCompleted': 4, 'sourceCommands': 53, 'nativeCommands': 53, 'rawExactCommands': 53, 'normalizedPublicCommands': 0,
            'sourceCompletePublicPackets': 54, 'nativeCompletePublicPackets': 54, 'rawExactCompletePublicPackets': 54,
            'animationFramesIncludingInitial': frames, 'sourcePrefixes': 12, 'nativePrefixes': 12, 'officialBoundaries': 4,
            'sourceTargetLevels': 6, 'sourceTargetReached': False, 'sourceStopReason': original['reason'],
            'nativeTargetLevels': 4, 'nativeTargetReached': True, 'nativeStopReason': campaign['final']['reason'], 'officialState': 'NOT_FINISHED',
            'rawExactScenes': 12, 'rawExactCoverPaths': 12, 'exactRelationObservedProjections': 12,
            'scopeNormalizedCompletePlans': 12, 'scopeNormalizedLatestKernelExtensionEvents': 12,
            'scopeNormalizedRetainedTransitionEvidence': 53, 'callerAcquiredTransitions': 53, 'callerBoundaryReplays': 3,
            'sessionCountPerCampaign': 1, 'actualTraceOutcomes': outcomes},
        'sourceVerification': {'referenceCommit': original['sourceCommit'], 'listedSourceFiles': len(original['sourceHashes']),
            'completePinnedManifestFilesVerified': len(manifest), 'sourceUnchanged': True, 'generatorVerified': True,
            'sourceAndNativeAssetHashesExact': True},
        'nativeVerification': {'fileCount': len(source['files']), 'completeCurrentInventoryExact': True,
            'beforeAndAfterExecutionManifestsExact': True, 'executionExitCode': 0, 'reportTraceAndExecutionLogHashesVerified': True,
            'pythonAgentModules': [], 'sourceUnchangedDuringRun': True},
        'publicComparison': {'fields': PUBLIC_FIELDS, 'normalizations': [], 'checkpoints': checkpoints,
            'boundaryActions': [8, 23, 38, 53], 'perLevelActions': [8, 15, 15, 15]},
        'internalProjectionComparison': {'normalizations': normalizations, 'prefixes': prefix_checks,
            'notCompared': ['original full caller selection or request stream', 'complete source and native graph states',
                'graph chain and graph revision', 'shared-family complete inherited digest', 'hashed proposal/composition IDs',
                'complete native event state at every intermediate action', 'elapsed times or speed'],
            'scope': 'Observation namespaces are mapped one-to-one with their unchanged epoch/revision/frame suffix. Each mechanical request digest is independently recomputed from that actual observation and the exactly matching scene. Only these full reference strings change. Plans and latest actual Kernel trace events are then compared completely; retained transition evidence is recovered from their acquired state projections.'},
        'qualification': 'Both recorded public trajectories contain the same 53 commands, 54 complete packets and all 66 animation images from initial load through the fourth official boundary. The isolated unchanged original component attempted target6 and abstained before acting in level5; the native common caller completed its declared target4 and stopped there. This does not show native level5 exploration or original full common-caller parity. Source budget is 120 actions/180 seconds per level; native budget is 600 actions/360 active seconds. Internal comparisons explicitly normalize only session observation references and their mechanically recomputed request digests. Complete graph identity, hashed proposals, identical budgets and performance are not claimed.'}


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--verify', action='store_true'); args = parser.parse_args()
    destination = OUT / 'zipp-original-component-comparison.json'
    result = compare()
    if args.verify:
        assert exact(load(destination), result), 'Retained comparison differs from independently recomputed evidence'
    else:
        if destination.exists(): raise FileExistsError(destination)
        destination.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create', 'output': str(destination.relative_to(ROOT)), 'summary': result['summary']}))


if __name__ == '__main__': main()
