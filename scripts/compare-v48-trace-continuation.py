#!/usr/bin/env python3
"""Recheck retained public evidence and acquired continuation receipts, without a game host."""
from __future__ import annotations

import argparse
from collections import Counter
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / 'docs/migration/native-campaigns-v47'
OUT = ROOT / 'docs/migration/native-campaigns-v48'
PUBLIC_FIELDS = ['frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash']
OBSERVATION_REF = re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')
helper_path = ROOT / 'scripts/compare-v47-trace-extension.py'
spec = importlib.util.spec_from_file_location('retained_public_trace_measurements', helper_path)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def load(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)
def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()
def digest(value): return hashlib.sha256(packed(value)).hexdigest()
def exact(left, right): return packed(left) == packed(right)
def proof(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def verify_proof(item): assert exact(item, proof(ROOT / item['path'])), item['path']
def packet_hash(packet):
    return hashlib.sha256(json.dumps({key: packet[key] for key in PUBLIC_FIELDS}, separators=(',', ':')).encode()).hexdigest()
def observation_ref(session, packet, index):
    return f"{session}:epoch:{packet['level']}:revision:{index + 1}:frame:{packet['frame_hash']}"
def strings(value):
    if isinstance(value, str): yield value
    elif isinstance(value, dict):
        for child in value.values(): yield from strings(child)
    elif isinstance(value, list):
        for child in value: yield from strings(child)


def verify_inputs():
    paths = {'baselineCampaign': OLD / 'zipp-six-levels.json', 'baselineTrace': OLD / 'zipp-public-trace.json.gz',
        'baselineComparison': OLD / 'zipp-trace-extension-comparison.json', 'baselineManifest': OLD / 'source-manifest.json',
        'nativeCampaign': OUT / 'zipp-six-levels.json', 'nativeTrace': OUT / 'zipp-public-trace.json.gz',
        'nativeExecution': OUT / 'logs/execution-zipp.json', 'nativeManifest': OUT / 'source-manifest.json',
        'independentPublicMeasurementCode': helper_path}
    values = {key: load(path) for key, path in paths.items() if key != 'independentPublicMeasurementCode'}
    old, old_trace, old_comparison, old_source = [values[key] for key in
        ['baselineCampaign', 'baselineTrace', 'baselineComparison', 'baselineManifest']]
    assert old_comparison['status'] == 'passed' and old['status'] == old_trace['status'] == 'failed'
    for item in old_comparison['inputs'].values(): verify_proof(item)
    verify_proof(old_comparison['generator'])
    assert old_comparison['generator']['sha256'] == sha(helper_path)
    assert old_source['digest'] == old['source']['digest'] == old_trace['sourceDigest'] == old_comparison['nativeSourceDigest']
    assert old_source['digest'] == '2f8f5d8660716e44e81fa987d08264324f61838c81ba9e96b2e64f69c136d100'
    assert old_source['fileCount'] == 158 and digest(old_source['files']) == old_source['digest']
    assert old['final']['levelsCompleted'] == 5 and old['final']['actions'] == 78
    assert old['final']['state'] == 'NOT_FINISHED' and old['final']['reason'] == 'frontier_unknown'
    assert old['boundaries'][-1]['totalActions'] == 77
    assert len(old['prefixes']) == 37 and len(old_trace['packets']) == 79
    campaign, trace, execution, source = [values[key] for key in
        ['nativeCampaign', 'nativeTrace', 'nativeExecution', 'nativeManifest']]
    assert campaign['game'] == trace['game'] == 'ZIPP' and campaign['targetLevels'] == 6
    assert campaign['status'] == trace['status'] and campaign['status'] in ('passed', 'failed')
    assert source['digest'] == digest(source['files']) and source['fileCount'] == len(source['files'])
    current = {p.relative_to(ROOT).as_posix(): sha(p)
        for directory in ['src/logos-engine', 'src/runtime'] for p in (ROOT / directory).rglob('*')
        if p.is_file() and p.suffix in ('.ts', '.json', '.drm')}
    assert exact(source['files'], current), 'Current source differs from the frozen live campaign source'
    assert exact(campaign['source'], source) and trace['sourceDigest'] == source['digest']
    assert campaign['sourceUnchangedDuringRun'] and execution['nativeSourceUnchanged']
    assert exact(execution['nativeSource'], source) and exact(execution['nativeSourceAfter'], source)
    assert execution['nativeSourceManifestDigest'] == source['digest']
    assert execution['exitCode'] == (0 if campaign['status'] == 'passed' else 1)
    assert execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', 'ZIPP', '6', str(paths['nativeCampaign']), str(paths['nativeTrace'])]
    for key in ('report', 'trace', 'generator', 'output'): verify_proof(execution[key])
    assert execution['report']['path'] == paths['nativeCampaign'].relative_to(ROOT).as_posix()
    assert execution['trace']['path'] == paths['nativeTrace'].relative_to(ROOT).as_posix()
    final_log = json.loads(gzip.decompress((ROOT / execution['output']['path']).read_bytes()).decode().splitlines()[-1])
    assert final_log['status'] == campaign['status'] and final_log['sourceDigest'] == source['digest']
    assert exact(final_log['final'], campaign['final']) and exact(final_log['boundaries'], campaign['boundaries'])
    assert final_log['failure'] == campaign['failure']
    assert exact(campaign['gameAssets'], old['gameAssets'])
    for name, expected in campaign['gameAssets'].items(): assert sha(ROOT / 'public/python' / name) == expected
    assert not campaign['pythonAgentModules'] and campaign['final']['sessions'] == 1
    assert campaign['final']['nativeImplementation'] == 'logos-engine.typescript.v6.native-migration/0.18.0'
    assert campaign['final']['fullV6Parity'] is False
    assert campaign['budget']['levelActionCaps'] == [600] * 6 and campaign['budget']['activeSecondsPerLevel'] == 360
    assert len(trace['packets']) == len(campaign['actions']) + 1 == campaign['final']['actions'] + 1
    assert trace['packets'][0]['command'] is None
    assert packet_hash(trace['packets'][0]['packet']) == campaign['initial']['publicPacketSha256']
    for index, item in enumerate(trace['packets']):
        assert set(item['packet']) == set(PUBLIC_FIELDS)
        if not index: continue
        action, before = campaign['actions'][index - 1], trace['packets'][index - 1]['packet']
        assert action['sequence'] == index and exact(item['command'], action['command'])
        assert packet_hash(item['packet']) == action['publicPacketSha256']
        assert action['levelBefore'] == before['level'] and action['completedBefore'] == before['levels_completed']
        assert action['levelAfter'] == item['packet']['level'] and action['completedAfter'] == item['packet']['levels_completed']
        assert action['state'] == item['packet']['state'] and action['frameHash'] == item['packet']['frame_hash']
        assert action['animationFrames'] == len(item['packet']['frame_packet'])
    assert trace['packets'][-1]['packet']['levels_completed'] == campaign['final']['levelsCompleted']
    assert trace['packets'][-1]['packet']['state'] == campaign['final']['state']
    assert sum(prefix['acquiredActions'] for prefix in campaign['prefixes']) == campaign['final']['actions']
    assert campaign['final']['caller']['acquiredTransitions'] == campaign['final']['actions']
    assert campaign['final']['operationCounts']['advance'] == campaign['final']['actions']
    return values, {key: proof(path) for key, path in paths.items()}


def compare_baseline(old, old_trace, campaign, trace):
    old_prefixes = [p for p in old['prefixes'] if p['decisionRevision'] <= 77]
    new_prefixes = [p for p in campaign['prefixes'] if p['decisionRevision'] <= 77]
    assert len(old_prefixes) == len(new_prefixes) == 36
    checks = []
    for index, left in enumerate(old_trace['packets'][:78]):
        right = trace['packets'][index]
        assert exact(left, right), f'Raw public command or complete packet changed at index {index}'
        checks.append({'packetIndex': index, 'rawExact': True, 'packetSha256': digest(right['packet']),
            'animationFrames': len(right['packet']['frame_packet'])})
    assert [b['totalActions'] for b in campaign['boundaries'][:5]] == [b['totalActions'] for b in old['boundaries']] == [8, 23, 38, 53, 77]
    old_session, new_session = [OBSERVATION_REF.fullmatch(ps[0]['traceField']['plan']['observation_ref'])[1]
        for ps in (old_prefixes, new_prefixes)]
    assert old_session != new_session
    old_strings, new_strings = set(strings(old_prefixes)), set(strings(new_prefixes))
    mapping, normalizations = {}, []
    for index, entry in enumerate(old_trace['packets'][:78]):
        left, right = [observation_ref(session, entry['packet'], index) for session in (old_session, new_session)]
        assert left in old_strings and right in new_strings
        mapping[left] = right
        normalizations.append({'kind': 'actual_observation_session_namespace', 'packetIndex': index, 'source': left, 'native': right})
    for index, (left, right) in enumerate(zip(old_prefixes, new_prefixes)):
        a, b = left['traceField']['plan'], right['traceField']['plan']
        assert exact(a['scene'], b['scene'])
        old_request, new_request = ['trace:' + digest([plan['observation_ref'], plan['scene']]) for plan in (a, b)]
        for plan, request in [(a, old_request), (b, new_request)]:
            assert plan['estimate']['receipt']['scope']['request_ref'] == request
            assert plan['estimate']['receipt']['descriptive_facts']['request_ref'] == request
        mapping[old_request] = new_request
        normalizations.append({'kind': 'mechanical_request_digest_recomputed_from_exact_scene_and_observation',
            'prefixIndex': index, 'source': old_request, 'native': new_request})
    def normalize(value):
        if isinstance(value, str):
            if value.startswith(old_session + ':'): assert value in mapping, value
            return mapping.get(value, value)
        if isinstance(value, dict): return {key: normalize(child) for key, child in value.items()}
        if isinstance(value, list): return [normalize(child) for child in value]
        return value
    prefix_checks, old_events, new_events = [], {}, {}
    for index, (left, right) in enumerate(zip(old_prefixes, new_prefixes)):
        assert left['decisionRevision'] == right['decisionRevision']
        for key in ['acquiredActions', 'family', 'operations', 'proposalKind', 'fieldSubquestion', 'callerAcquiredTransitions']:
            assert exact(left[key], right[key]), (index, key)
        assert exact(normalize(left['traceField']), right['traceField']), f'Complete baseline trace plan {index}'
        a, b = [p['sharedSeries']['traceFieldLatestExtension'] for p in (left, right)]
        assert exact(normalize(a), b), f'Latest acquired baseline trace event {index}'
        assert left['sharedSeries']['traceFieldExtensionCount'] == right['sharedSeries']['traceFieldExtensionCount']
        assert not right.get('nativeCoordination'), 'The previously successful prefix needed no new arbitration'
        for event, collected in [(normalize(a), old_events), (b, new_events)]:
            for item in [*event['state']['successes'], *event['state']['failures'], event['transition']]:
                if item['after_ref'] in collected: assert exact(collected[item['after_ref']], item)
                collected[item['after_ref']] = item
        prefix_checks.append({'prefixIndex': index, 'firstAction': right['decisionRevision'], 'acquiredActions': right['acquiredActions'],
            'scopeNormalizedCompletePlanExact': True, 'scopeNormalizedLatestKernelEventExact': True,
            'planSha256': digest(right['traceField']['plan']), 'latestKernelEventSha256': digest(b)})
    assert len(old_events) == len(new_events) == 77 and exact(old_events, new_events)
    return {'rawExactCommands': 77, 'rawExactPackets': 78,
        'animationFramesIncludingInitial': sum(item['animationFrames'] for item in checks),
        'scopeNormalizedCompletePlans': 36, 'scopeNormalizedLatestKernelEvents': 36, 'scopeNormalizedRetainedTransitions': 77,
        'publicNormalizations': [], 'publicChecks': checks, 'internalNormalizations': normalizations, 'prefixChecks': prefix_checks,
        'notCompared': ['complete graph identity', 'hashed proposal/composition IDs', 'full inherited shared-family digest',
            'elapsed time or speed', 'original full common caller parity', 'complete Kernel event at every intermediate action']}, new_session


def measured_current_plan(prefix, packet):
    plan = prefix['traceField']['plan']; scene, geometry = plan['scene'], plan['scene']['geometry']
    assert plan['epoch'] == packet['level'] and plan['score'] == packet['levels_completed']
    assert plan['frame_digest'] == digest(packet['frame_rows']) and scene['geometry_ref'] == digest(geometry)
    assert 'native_support_discrimination' not in scene, 'This continuation should use the unchanged source measurement'
    projection = helper.source_projection(packet['frame_rows'], geometry)
    assert projection is not None
    assert projection['head'] == scene['head'] and projection['receiver'] == scene['receiver_hypothesis']
    assert projection['prefix'] == scene['prefix'] and projection['allowedEdges'] == scene['allowed_edges_hypothesis']
    path = plan['estimate']['path']; cells = {(x, y) for y in range(geometry['shape'][1]) for x in range(geometry['shape'][0])}
    assert len(path) == len(cells) and set(map(tuple, path)) == cells
    assert path[:len(scene['prefix'])] == scene['prefix'] and path[-1] == scene['receiver_hypothesis']['cell']
    edges = {frozenset(map(tuple, pair)) for pair in scene['allowed_edges_hypothesis']}
    assert all(frozenset((tuple(a), tuple(b))) in edges for a, b in zip(path, path[1:]))
    assert plan['estimate']['receipt']['status'] == 'COMPLETE'
    assert plan['estimate']['receipt']['descriptive_facts']['primitive_release_authorized'] is False
    assert 'ACTION6' in packet['available_action_refs']
    for index, command in enumerate(plan['commands']):
        pixel = helper.center(geometry, path[len(scene['prefix']) + index])
        assert command == {'action_ref': 'ACTION6', 'data': {'x': pixel[0], 'y': pixel[1]}}
    return {'sourcePairUnique': True, 'currentMarkersPrefixAndGraphExact': True, 'currentActionAvailable': True,
        'frameAndPointBound': True, 'boundedCoverCells': len(cells), 'nativeSearchVisits': plan['estimate']['search_nodes'],
        'pathSha256': digest(path), 'terminalRoleAcquired': False,
        'qualification': 'The independent public-raster projection and the supplied conditional cover are checked before dispatch. This does not prove an environment terminal law.'}


def ring_matches(rows, geometry, mark, cell):
    x, y = helper.center(geometry, cell); half = mark['width'] // 2
    return helper.perimeter(rows, [x - half, y - half, x + half, y + half], mark['palette'])


def reconcile_trace_return(plan, index, before, after, session, first):
    scene, geometry = plan['scene'], plan['scene']['geometry']; path = plan['estimate']['path']
    source, target = path[len(scene['prefix']) + index - 1:len(scene['prefix']) + index + 1]
    initial, later = before['frame_rows'], after['frame_rows']
    boundary = before['level'] != after['level'] or after['levels_completed'] > before['levels_completed']
    a, b = helper.center(geometry, source), helper.center(geometry, target)
    half = (geometry['pitch'] - 2) // 2
    bounds = [min(a[0], b[0]) - half, min(a[1], b[1]) - half, max(a[0], b[0]) + half, max(a[1], b[1]) + half]
    left, top, right, bottom = geometry['bbox']
    local = ring_matches(later, geometry, scene['head'], target) and not ring_matches(later, geometry, scene['head'], source)
    if local:
        local = all(initial[y][x] == later[y][x] or bounds[0] <= x <= bounds[2] and bounds[1] <= y <= bounds[3]
            for y in range(top, bottom + 1) for x in range(left, right + 1))
    outcome = 'official_boundary' if boundary else 'local_extension_observed' if local else 'projection_refuted'
    if outcome == 'local_extension_observed':
        projected = helper.source_projection(later, geometry)
        if not projected or projected['prefix'] != path[:len(scene['prefix']) + index + 1]:
            outcome = 'ordered_trace_projection_refuted'
    outside = sum(initial[y][x] != later[y][x] for y in range(len(initial)) for x in range(len(initial[y]))
        if not (left <= x <= right and top <= y <= bottom))
    sequence = first + index
    return {'source': source, 'target': target, 'command': plan['commands'][index],
        'before_ref': observation_ref(session, before, sequence - 1), 'after_ref': observation_ref(session, after, sequence),
        'frame_digest': digest(initial), 'outcome': outcome, 'outside_support_changed_pixels': outside,
        'outside_support_effect_role': 'unknown'}


def compare_continuation(campaign, trace, session):
    by_revision = {p['decisionRevision']: p for p in campaign['prefixes']}
    receipts, transitions, current_prefixes = [], {}, []
    for prefix in campaign['prefixes']:
        if 'traceField' not in prefix: continue
        latest = prefix['sharedSeries']['traceFieldLatestExtension']
        for event in [*latest['state']['successes'], *latest['state']['failures'], latest['transition']]:
            if event['after_ref'] in transitions: assert exact(transitions[event['after_ref']], event)
            transitions[event['after_ref']] = event
        first = prefix['decisionRevision']
        if first <= 77: continue
        plan = prefix['traceField']['plan']; before = trace['packets'][first - 1]['packet']
        assert plan['observation_ref'] == observation_ref(session, before, first - 1)
        current_guard = measured_current_plan(prefix, before)
        for index in range(prefix['acquiredActions']):
            action = campaign['actions'][first + index - 1]
            assert action['family'] == prefix['family'] and exact(action['command'], plan['commands'][index])
            expected = reconcile_trace_return(plan, index, trace['packets'][first + index - 1]['packet'],
                trace['packets'][first + index]['packet'], session, first)
            assert exact(transitions[expected['after_ref']], expected), f'Actual returned trace evidence at action {first + index}'
        current_prefixes.append({'firstAction': first, 'acquiredActions': prefix['acquiredActions'], 'guard': current_guard,
            'currentEpochLocalEffectsBefore': len(plan['state']['successes']), 'observedSteps': prefix['traceField']['observedSteps'],
            'completeAcquiredTransitionPayloadsVerified': prefix['acquiredActions'], 'latestAcquiredOutcome': latest['transition']['outcome']})
        for receipt in prefix.get('nativeCoordination', []):
            assert receipt['rule'] == 'current_acquired_continuation_before_unacquired_exploration'
            assert receipt['source_trigger_group'] == 'goal_access' and receipt['deferred_family'] == 'animated_contact'
            assert receipt['preferred_family'] == 'public_occurrence_recall' and receipt['selected_group'] == 'window_constraints'
            assert receipt['selected_entry'] == receipt['selected_subquestion'] == 'trace_field_composition'
            assert receipt['observation_ref'] == plan['observation_ref'] and receipt['physical_action_authorized'] is False
            assert receipt['source_state_ref'] == 'family_state:public_occurrence_recall'
            assert receipt['deferred_state_ref'] == 'family_state:animated_contact'
            assert receipt['guard_reason'] == 'trace_current_head_and_point_bound'
            assert receipt['preferred_proposal_digest_profile'] == 'logos-engine.v6.continuation-proposal/typed-state-graph.v1'
            assert re.fullmatch('[a-f0-9]{64}', receipt['preferred_proposal_digest'])
            question, continuation, proof = [receipt[key] for key in ['unacquired_inquiry', 'acquired_continuation', 'acquired_kernel_contribution']]
            assert question['status'] == 'unacquired_exploration' and question['evidence_refs'] == []
            assert question['observation_ref'] == continuation['observation_ref'] == plan['observation_ref']
            assert continuation['status'] == 'conditional_acquired_continuation' and continuation['kernel_score_corroboration_required'] is True
            assert continuation['source_entry'] == 'trace_field_composition' and continuation['source_kind'] == 'trace_field_experiment'
            assert continuation['score'] == before['levels_completed']
            assert proof['status'] == 'acquired_official_contribution' and proof['family'] == prefix['family']
            assert proof['entry'] == prefix['fieldSubquestion'] and proof['proposal_kind'] == prefix['proposalKind']
            assert proof['primitive_release_authorized'] is False and proof['causal_terminal_role'] == 'unknown'
            acquired = by_revision[proof['committed_decision_revision']]
            boundary_action = acquired['decisionRevision'] + acquired['acquiredActions'] - 1
            assert boundary_action < first
            actual = campaign['actions'][boundary_action - 1]
            prior, returned = [trace['packets'][index]['packet'] for index in [boundary_action - 1, boundary_action]]
            assert proof['prefix_evidence_ref'] == acquired['id'] and proof['transition_ref'] == f'reasoning:transition:{boundary_action}'
            assert proof['levels_completed_before'] == actual['completedBefore'] == prior['levels_completed']
            assert proof['levels_completed_after'] == actual['completedAfter'] == returned['levels_completed'] == before['levels_completed']
            assert proof['levels_completed_after'] > proof['levels_completed_before']
            assert exact(proof['acquired_command'], actual['command'])
            assert proof['before_observation_ref'] == observation_ref(session, prior, boundary_action - 1)
            assert proof['after_observation_ref'] == observation_ref(session, returned, boundary_action)
            assert continuation['success_ref'] == proof['after_observation_ref']
            assert continuation['evidence_refs'] == [proof['after_observation_ref']]
            assert acquired['sharedSeries']['traceFieldLatestExtension']['transition']['after_ref'] == proof['after_observation_ref']
            source_ref = 'C_trace_' + digest(acquired['traceField']['plan'])[:20]
            assert proof['source_proposal_ref'] == proof['released_composition_ref'] == source_ref
            assert continuation['proposal_ref'] == receipt['preferred_proposal_ref'] == 'C_trace_' + digest(plan)[:20]
            if first == 78:
                assert len(plan['commands']) == 1 and prefix['acquiredActions'] == 1 and prefix['traceField']['observedSteps'] == [False]
                assert plan['state']['successes'] == plan['state']['failures'] == plan['state']['evidence'] == []
                assert continuation['action_effect_known'] is False and continuation['current_epoch_local_effects'] == 0
                assert continuation['effect_scope'] == 'current_effect_remains_an_information_question'
            receipts.append({'firstAction': first, 'actualPriorOfficialBoundaryAction': boundary_action,
                'officialScores': [proof['levels_completed_before'], proof['levels_completed_after']],
                'sourceFamilyEntryAndKindExact': True, 'commandCompositionAndObservationRefsExact': True,
                'freshPublicGuardVerified': True, 'candidateEffectKnown': continuation['action_effect_known'],
                'primitiveReleaseAuthorizedByPriority': False, 'receiptSha256': digest(receipt)})
    assert receipts and receipts[0]['firstAction'] == 78
    assert len(transitions) == sum(p['acquiredActions'] for p in campaign['prefixes'] if 'traceField' in p)
    boundaries = [b['totalActions'] for b in campaign['boundaries']]
    for boundary in campaign['boundaries']:
        assert trace['packets'][boundary['totalActions']]['packet']['levels_completed'] == boundary['completedLevel']
    return {'campaignStatus': campaign['status'], 'executionFailureRetained': campaign['failure'], 'targetLevels': campaign['targetLevels'],
        'targetReached': campaign['final']['levelsCompleted'] >= campaign['targetLevels'], 'officialState': campaign['final']['state'],
        'stopReason': campaign['final']['reason'], 'officialBoundaries': boundaries,
        'additionalOfficialBoundaries': [b for b in campaign['boundaries'] if b['completedLevel'] > 5],
        'coordinationChecks': receipts, 'currentTracePrefixes': current_prefixes,
        'traceTransitionCount': len(transitions), 'traceOutcomes': dict(Counter(t['outcome'] for t in transitions.values())),
        'completePreauthorizationProposalDigestRecomputed': False,
        'qualification': 'The report retains the complete plan and acquired coordination receipt. The independently verified public score, prior command, entry, composition and current raster guard are distinct from a causal terminal law. The full preauthorization proposal payload is not retained here, so its typed provenance hash is not independently recomputed by this comparison.'}


def compare():
    historical_before = {str(p): sha(p) for p in OLD.rglob('*') if p.is_file()}
    values, inputs = verify_inputs()
    old, old_trace, campaign, trace = [values[key] for key in ['baselineCampaign', 'baselineTrace', 'nativeCampaign', 'nativeTrace']]
    baseline, session = compare_baseline(old, old_trace, campaign, trace)
    continuation = compare_continuation(campaign, trace, session)
    assert historical_before == {str(p): sha(p) for p in OLD.rglob('*') if p.is_file()}
    return {'schema': 'logos-engine.v48.trace-continuation-comparison.v1', 'status': 'passed', 'inputs': inputs,
        'generator': proof(Path(__file__)), 'nativeSourceDigest': values['nativeManifest']['digest'],
        'summary': {'baselineLevels': 5, 'rawExactBaselineCommands': 77, 'rawExactBaselinePackets': 78,
            'scopeNormalizedBaselinePlans': 36, 'scopeNormalizedBaselineLatestKernelEvents': 36,
            'scopeNormalizedBaselineRetainedTransitions': 77, 'levelsCompleted': campaign['final']['levelsCompleted'],
            'totalActions': campaign['final']['actions'], 'additionalOfficialLevels': campaign['final']['levelsCompleted'] - 5,
            'additionalActions': campaign['final']['actions'] - 77, 'coordinationReceipts': len(continuation['coordinationChecks']),
            'traceTransitionCount': continuation['traceTransitionCount'], 'campaignTargetReached': continuation['targetReached'],
            'officialWin': continuation['officialState'] == 'WIN'},
        'baselineComparison': baseline, 'continuation': continuation,
        'nativeVerification': {'sourceUnchanged': True, 'completeCurrentInventoryExact': True,
            'sourceFileCount': values['nativeManifest']['fileCount'], 'reportTraceExecutionHashesVerified': True,
            'allHistoricalV47FilesUnchanged': True, 'executionExitCode': values['nativeExecution']['exitCode'],
            'pythonAgentModules': [], 'sessionCount': 1},
        'qualification': 'Passed verifies this evidence comparison, not full V6 behavioral parity. No game engine or solver is executed. Public commands and full animated packets remain exact; baseline internal observation namespaces and mechanical request digests are explicitly normalized. Official campaign outcome and unknown physical laws remain separate.'}


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--verify', action='store_true'); args = parser.parse_args()
    destination = OUT / 'zipp-trace-continuation-comparison.json'; result = compare()
    if args.verify: assert exact(load(destination), result), 'Stored comparison differs from recomputed evidence'
    else:
        if destination.exists(): raise FileExistsError(destination)
        destination.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create',
        'output': destination.relative_to(ROOT).as_posix(), 'summary': result['summary'],
        'campaignStatus': result['continuation']['campaignStatus']}))


if __name__ == '__main__': main()
