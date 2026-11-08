#!/usr/bin/env python3
"""Independently compare saved public Linked Packet evidence, without execution."""
from __future__ import annotations

import argparse
from collections import Counter
from decimal import Decimal
import gzip
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v47'
PUBLIC_FIELDS = ['frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash']
OBSERVATION_REF = re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')
TOLERANCE = 1e-12


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


def native_number(value):
    """Independent JS Number spelling for the finite values in saved evidence.

    Read values are exact IEEE doubles. This implements the native digest's
    decimal/fixed exponent convention; it never rounds an angle for comparison.
    """
    assert math.isfinite(value)
    if value == 0:
        return '-0.0' if isinstance(value, float) and math.copysign(1, value) < 0 else '0'
    if 1e-6 <= abs(value) < 1e21:
        result = format(Decimal(repr(value)), 'f')
        return result.rstrip('0').rstrip('.') if '.' in result else result
    result = repr(value).lower()
    if 'e' not in result: return result
    coefficient, exponent = result.split('e')
    if coefficient.endswith('.0'): coefficient = coefficient[:-2]
    exponent = int(exponent)
    return coefficient + 'e' + ('+' if exponent >= 0 else '-') + str(abs(exponent))


def native_canonical(value):
    if value is None: return 'null'
    if isinstance(value, bool): return 'true' if value else 'false'
    if isinstance(value, (int, float)): return native_number(value)
    if isinstance(value, str): return json.dumps(value, ensure_ascii=True)
    if isinstance(value, list): return '[' + ','.join(native_canonical(child) for child in value) + ']'
    assert isinstance(value, dict)
    return '{' + ','.join(json.dumps(key, ensure_ascii=True) + ':' + native_canonical(value[key]) for key in sorted(value)) + '}'


def native_digest(value): return hashlib.sha256(native_canonical(value).encode()).hexdigest()


def verify_native(campaign_path, trace_path, execution_path, manifest_path):
    campaign, trace, execution, source = map(load, (campaign_path, trace_path, execution_path, manifest_path))
    assert campaign['status'] == trace['status'] == 'passed'
    assert campaign['game'] == trace['game'] == 'SELE'
    assert exact(campaign['source'], source) and campaign['sourceUnchangedDuringRun']
    assert trace['sourceDigest'] == source['digest'] and not campaign['pythonAgentModules']
    assert source['fileCount'] == len(source['files']) == 158
    assert source['digest'] == digest(source['files'])
    current_files = {path.relative_to(ROOT).as_posix(): sha(path)
                     for folder in ['src/logos-engine', 'src/runtime']
                     for path in (ROOT/folder).rglob('*') if path.is_file() and path.suffix in ('.ts', '.json', '.drm')}
    assert exact(current_files, source['files']), 'Complete native source inventory differs from frozen execution'
    assert execution['exitCode'] == 0 and execution['nativeSourceUnchanged'] is True
    assert exact(execution['nativeSource'], source) and exact(execution['nativeSourceAfter'], source)
    assert execution['nativeSourceManifestDigest'] == source['digest']
    assert execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', 'SELE', '3', str(campaign_path), str(trace_path)]
    for key, expected in [('report', campaign_path), ('trace', trace_path)]: assert exact(execution[key], proof(expected))
    for key in ('generator', 'output'): assert exact(execution[key], proof(ROOT/execution[key]['path']))
    lines = gzip.decompress((ROOT/execution['output']['path']).read_bytes()).decode().splitlines()
    final_log = json.loads(lines[-1])
    assert final_log['status'] == 'passed' and final_log['sourceDigest'] == source['digest']
    assert final_log['report'] == str(campaign_path) and final_log['trace'] == str(trace_path)
    assert exact(final_log['final'], campaign['final']) and exact(final_log['boundaries'], campaign['boundaries'])
    assert campaign['final']['sessions'] == 1 and campaign['final']['fullV6Parity'] is False
    assert campaign['final']['nativeImplementation'] == 'logos-engine.typescript.v6.native-migration/0.17.0'
    assert len(trace['packets']) == len(campaign['actions'])+1
    assert packet_hash(trace['packets'][0]['packet']) == campaign['initial']['publicPacketSha256']
    for index, item in enumerate(trace['packets'][1:]):
        action = campaign['actions'][index]
        assert exact(item['command'], action['command']) and packet_hash(item['packet']) == action['publicPacketSha256']
        assert len(item['packet']['frame_packet']) == action['animationFrames']
        assert item['packet']['level'] == action['levelAfter'] and item['packet']['levels_completed'] == action['completedAfter']
        assert item['packet']['state'] == action['state'] and item['packet']['frame_hash'] == action['frameHash']
        assert action['sequence'] == index+1 and action['family'] == 'public_occurrence_recall'
    for name, expected in campaign['gameAssets'].items(): assert sha(ROOT/'public/python'/name) == expected, name
    return campaign, trace, source


def compare():
    campaign_path, trace_path = OUT/'sele-three-levels.json', OUT/'sele-public-trace.json.gz'
    execution_path, manifest_path = OUT/'logs/execution-sele.json', OUT/'source-manifest.json'
    campaign, trace, native_source = verify_native(campaign_path, trace_path, execution_path, manifest_path)
    probe_path = ROOT/'tests/fixtures/v6-linked-packet-original-public.json.gz'
    reference_path = ROOT/'tests/fixtures/v6-linked-packet-reference.json.gz'
    original, reference = load(probe_path), load(reference_path)
    assert original['game'] == 'SELE' and original['status'] == 'passed' and original['reason'] == 'target_levels_completed'
    assert original['sourceModified'] is False and original['sessionCount'] == 1
    assert original['manualPrimingActions'] == original['resets'] == original['levelJumps'] == 0
    assert original['actions'] == campaign['final']['actions'] == 44
    assert original['targetLevels'] == original['levelsCompleted'] == campaign['final']['levelsCompleted'] == campaign['targetLevels'] == 3
    assert original['state'] == campaign['final']['state'] == 'NOT_FINISHED'
    assert campaign['final']['reason'] == 'target_levels_completed' and campaign['final']['level'] == 4
    assert exact(original['gameAssetHashes'], campaign['gameAssets'])
    source_root = ROOT/'reference/v6'/original['sourceCommit']
    manifest = load(source_root/'manifest.json')['files']
    assert original['sourceCommit'] == campaign['referenceCommit'] == reference['sourceCommit'] == '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
    assert original['pinnedSourceFilesVerifiedBeforeImport'] == reference['pinnedSourceFilesVerifiedBeforeImport'] == len(manifest) == 1786
    for path, item in manifest.items(): assert sha(source_root/'source'/path) == item['sha256'], path
    for evidence in (original, reference):
        for path, expected in evidence['sourceHashes'].items(): assert manifest[path]['sha256'] == expected, path
        assert sha(ROOT/evidence['generator']) == evidence['generatorSha256']
    assert reference['originalPublicProbe']['sha256'] == sha(probe_path)
    assert sha(ROOT/reference['originalAliasingDiagnostic']['path']) == reference['originalAliasingDiagnostic']['sha256']
    assert len(original['requests']) == 45 and original['requests'][0] == {'type': 'load', 'code': 'SELE', 'level': 1}
    assert all(item['type'] == 'action' for item in original['requests'][1:])
    assert original['budget'] == {'levelActions': 120, 'levelSeconds': 180, 'targetLevels': 3}
    assert campaign['budget']['levelActionCaps'] == [600]*3 and campaign['budget']['activeSecondsPerLevel'] == 360
    assert len(original['packets']) == len(trace['packets']) == 45
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
                                             'scope': 'Source scalar command omits data and its host request contains null; native typed transport supplies the empty object. Action reference is exact; no coordinate or scalar parameter is added.'})
        assert exact(left['packet'], right['packet']), f'Complete raw public packet {index}'
        checkpoints.append({'index': index, 'commandRawExact': command_exact, 'commandEffectParametersExact': True, 'allPublicFieldsExact': True,
                            'canonicalPublicPacketSha256': digest(right['packet']), 'animationFrames': len(right['packet']['frame_packet'])})
    assert [item['actions'] for item in original['boundaries']] == [item['totalActions'] for item in campaign['boundaries']] == [8, 18, 44]
    assert [item['levelActions'] for item in original['boundaries']] == [item['levelActions'] for item in campaign['boundaries']] == [8, 10, 26]
    assert all(item['sessionRetained'] for item in campaign['boundaries'])
    assert len(original['prefixes']) == len(campaign['prefixes']) == len(reference['commonEnvelopes']) == 44

    source_ref = original['packets'][0]['observation']['observation_ref']
    native_ref = campaign['prefixes'][0]['linkedPacket']['plan']['observation_ref']
    source_session, native_session = OBSERVATION_REF.fullmatch(source_ref)[1], OBSERVATION_REF.fullmatch(native_ref)[1]
    assert source_session != native_session
    retained_strings = set(strings([prefix['linkedPacket'] for prefix in campaign['prefixes']] + [prefix['sharedSeries']['linkedPacketLatestEvidence'] for prefix in campaign['prefixes']]))
    scope_map, normalizations = {}, []
    for index, item in enumerate(original['packets']):
        packet, observed = item['packet'], item['observation']
        suffix = f":epoch:{packet['level']}:revision:{index+1}:frame:{packet['frame_hash']}"
        expected = native_session+suffix
        assert observed['observation_ref'] == source_session+suffix
        assert expected in retained_strings, f'Missing retained dated evidence for packet {index}'
        scope_map[observed['observation_ref']] = expected
        normalizations.append({'kind': 'actual_observation_session_namespace', 'packetIndex': index,
                               'source': observed['observation_ref'], 'native': expected})

    # The only float-derived digest inside saved plans/events is the route-cache
    # context. Validate its complete payload independently on both sides before
    # allowing that exact reference string to differ.
    cache_map = {}
    for index, (source_prefix, native_prefix) in enumerate(zip(original['prefixes'], campaign['prefixes'])):
        pair = [source_prefix['proposal']['linked_packet_plan'], native_prefix['linkedPacket']['plan']]
        caches = [plan['state'].get('geometric_route_cache') for plan in pair]
        assert bool(caches[0]) == bool(caches[1])
        if not caches[0]: continue
        cache_refs = []
        for position, (plan, cache) in enumerate(zip(pair, caches)):
            bodies = {body['ref']: body for body in plan['state']['bindings'].values()}
            bodies[plan['target_hypothesis']['ref']] = plan['target_hypothesis']
            payload = [bodies, cache['value']['grid'], cache['value']['route'][0]['source'], plan['state']['scene']['frame']]
            expected = digest(payload) if position == 0 else native_digest(payload)
            assert cache['context'] == expected, f'Independently recomputed route-cache context {index}:{position}'
            cache_refs.append(expected)
        if cache_refs[0] in cache_map: assert cache_map[cache_refs[0]] == cache_refs[1]
        else:
            cache_map[cache_refs[0]] = cache_refs[1]
            normalizations.append({'kind': 'route_cache_digest_recomputed_from_complete_exact_supports_and_native_numerical_grid',
                                   'prefixIndex': index, 'source': cache_refs[0], 'native': cache_refs[1]})

    stats = {'comparedNumbers': 0, 'maximumAbsoluteError': 0.0, 'exactIntegerValues': 0, 'normalizedObservationRefs': 0, 'normalizedCacheDigests': 0}
    def equivalent(left, right, path):
        if isinstance(left, bool) or left is None:
            assert type(left) is type(right) and left == right, path; return
        if isinstance(left, (int, float)):
            assert isinstance(right, (int, float)) and not isinstance(right, bool) and math.isfinite(right), path
            error = abs(left-right); stats['comparedNumbers'] += 1; stats['maximumAbsoluteError'] = max(stats['maximumAbsoluteError'], error)
            if isinstance(left, int) and isinstance(right, int):
                assert left == right, (path, left, right); stats['exactIntegerValues'] += 1
            else: assert error <= TOLERANCE, (path, left, right, error)
            return
        if isinstance(left, str):
            if left in scope_map:
                assert right == scope_map[left], path; stats['normalizedObservationRefs'] += 1; return
            if path.endswith('.geometric_route_cache.context'):
                assert left in cache_map and right == cache_map[left], path; stats['normalizedCacheDigests'] += 1; return
            assert left == right, (path, left, right); return
        if isinstance(left, list):
            assert isinstance(right, list) and len(left) == len(right), path
            for index, (a, b) in enumerate(zip(left, right)): equivalent(a, b, f'{path}.{index}')
            return
        assert isinstance(left, dict) and isinstance(right, dict) and set(left) == set(right), path
        for key in left: equivalent(left[key], right[key], path+'.'+key)

    checks, native_latest_count = [], 0
    for index, (left, right, envelope) in enumerate(zip(original['prefixes'], campaign['prefixes'], reference['commonEnvelopes'])):
        plan, native_plan = left['proposal']['linked_packet_plan'], right['linkedPacket']['plan']
        assert right['family'] == 'public_occurrence_recall' and right['fieldSubquestion'] == 'linked_packet_composition'
        assert right['proposalKind'] == 'linked_packet_experiment' and right['linkedPacket']['stateNode'] == 'family_state:public_occurrence_recall'
        assert right['operations'] == ['OP29', 'OP30', 'OP31'] and right['acquiredActions'] == 1
        assert right['decisionRevision'] == right['callerAcquiredTransitions'] == index+1
        assert exact(plan['scene'], native_plan['scene']) and exact(plan['command'], native_plan['command'])
        equivalent(plan, native_plan, f'prefix.{index}.plan')
        source_latest = envelope['emissionLinkedProjection']['linked_events'][-1]
        source_current_latest = left['steps'][0]['afterState']['projection']['linked_events'][-1]
        assert source_latest == source_current_latest, 'Latest event is unambiguous despite an earlier source alias'
        native_latest = right['sharedSeries']['linkedPacketLatestEvidence']
        equivalent(source_latest, native_latest, f'prefix.{index}.event')
        expected_count = len(envelope['emissionLinkedProjection']['linked_events'])
        assert right['sharedSeries']['linkedPacketEvidenceCount'] == expected_count
        assert right['sharedSeries']['eventCount'] == len(envelope['emissionEvents'])
        native_latest_count += 1
        checks.append({'prefixIndex': index, 'actionIndex': index+1, 'rawSceneExact': True, 'rawCommandExact': True,
                       'completePlanNumericallyEquivalent': True, 'completeLatestKernelEventNumericallyEquivalent': True,
                       'linkedEventCount': expected_count, 'sharedEventCount': len(envelope['emissionEvents']),
                       'nativePlanSha256': digest(native_plan), 'nativeLatestKernelEventSha256': digest(native_latest)})
    assert native_latest_count == 44 and campaign['prefixes'][-1]['sharedSeries']['linkedPacketEvidenceCount'] == 53
    assert campaign['prefixes'][-1]['sharedSeries']['eventCount'] == 59
    assert campaign['final']['caller']['acquiredTransitions'] == 44 and campaign['final']['caller']['boundaryReplays'] == 2
    aliases = sum(len(item['sourceAliasing']) for item in reference['commonEnvelopes'])
    assert aliases == 9
    frames = sum(len(item['packet']['frame_packet']) for item in trace['packets'])
    assert frames == sum(len(item['packet']['frame_packet']) for item in original['packets'])
    return {'schema': 'logos-engine.v47.linked-public-component-comparison.v1', 'status': 'passed',
            'comparisonConclusion': 'exact_complete_public_trajectory_through_third_boundary_and_dated_numerical_internal_evidence',
            'recordedPublicTrajectoryEquivalent': True, 'originalFullCommonCallerParity': False,
            'inputs': {'sourceComponent': proof(probe_path), 'sourceEmissionReference': proof(reference_path), 'nativeCampaign': proof(campaign_path),
                       'nativeTrace': proof(trace_path), 'nativeExecution': proof(execution_path), 'nativeSourceManifest': proof(manifest_path)},
            'generator': proof(Path(__file__)), 'nativeSourceDigest': native_source['digest'],
            'summary': {'levelsCompleted': 3, 'sourceCommands': 44, 'nativeCommands': 44, 'rawExactCommands': 44-len(transport_normalizations), 'normalizedPublicCommands': len(transport_normalizations),
                        'exactActionReferencesAndEffectParameters': 44,
                        'rawExactCompletePublicPackets': 45, 'animationFramesIncludingInitial': frames, 'sourcePrefixes': 44, 'nativePrefixes': 44,
                        'officialBoundaries': 3, 'sourceTargetLevels': 3, 'nativeTargetLevels': 3, 'sourceTargetReached': True, 'nativeTargetReached': True,
                        'officialState': 'NOT_FINISHED', 'enteredLevel': 4, 'completeComparedPlans': 44, 'completeComparedLatestKernelEvents': 44,
                        'linkedEventsRetained': 53, 'commonEventsRetained': 59, 'sourceMutableAliasReceipts': aliases,
                        'callerAcquiredTransitions': 44, 'callerBoundaryReplays': 2, 'sessionCountPerCampaign': 1, **stats},
            'sourceVerification': {'referenceCommit': original['sourceCommit'], 'sourceComponentImportedFiles': len(original['sourceHashes']),
                                   'sourceReferenceImportedFiles': len(reference['sourceHashes']), 'completePinnedManifestFilesVerified': len(manifest),
                                   'sourceUnchanged': True, 'sourceAndNativeAssetHashesExact': True, 'generatorsVerified': True},
            'nativeVerification': {'fileCount': len(native_source['files']), 'completeCurrentInventoryExact': True, 'beforeAndAfterExecutionManifestsExact': True,
                                   'executionExitCode': 0, 'reportTraceAndExecutionLogHashesVerified': True, 'pythonAgentModules': [], 'sourceUnchangedDuringRun': True},
            'publicComparison': {'fields': PUBLIC_FIELDS, 'packetNormalizations': [], 'commandNormalizations': transport_normalizations, 'checkpoints': checkpoints, 'boundaryActions': [8, 18, 44], 'perLevelActions': [8, 10, 26]},
            'internalProjectionComparison': {'absoluteNumericTolerance': TOLERANCE, 'normalizations': normalizations, 'prefixes': checks,
                'scope': 'Every field of the 44 plans and 44 retained latest Kernel events is compared. Observation namespaces retain exact epoch/revision/frame suffix. The only float-derived normalized identifier is each independently recomputed route-cache digest; all angles, signs, routes, rational geometry results and evidence values remain compared.',
                'notCompared': ['original full common-caller selection', 'complete graph identity and shared-family inherited digest',
                                'all 53 emitted event payloads in the production campaign, because its report retains only the latest event per prefix; all 53 are separately source-return-verified in the immutable reference replay',
                                'equal budgets or elapsed performance']},
            'qualification': 'The unchanged isolated original component and the native common caller each completed their declared three-level target in one cold continuous session. Action references and effect parameters agree for all 44 commands: 15 pointed commands are raw-identical and 29 scalar commands differ only by an explicitly verified empty transport data object. All 45 full public packets and every animation raster are exact without normalization. Internal finite numerics are compared without quantization at absolute tolerance 1e-12. Native IEEE/libm and digest spelling remain explicitly separate from Python. Nine Python record receipts are retroactively enriched through mutable aliases during record_packet; the native journal preserves emission snapshots, which are independently recorded by read-only profiling of the unchanged original methods. Current states and latest receipts agree. This is not full original caller or full-game completion parity.'}


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--verify', action='store_true'); args = parser.parse_args()
    destination = OUT/'sele-original-component-comparison.json'
    result = compare()
    if args.verify: assert exact(load(destination), result), 'Retained comparison differs from recomputed evidence'
    else:
        if destination.exists(): raise FileExistsError(destination)
        destination.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create', 'output': str(destination.relative_to(ROOT)), 'summary': result['summary']}))


if __name__ == '__main__': main()
