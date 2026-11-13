#!/usr/bin/env python3
"""Index observed method ownership and continuation chains in a closed capture.

This passive extractor reads only report, public transport and execution
receipts. It imports no agent or game, releases no action, and does not infer
completion or causal necessity from method/route counts. JSON pointers identify
the original hashed evidence for every compact projection.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'scripts/extract-native-control-attention-evidence.py'
spec = importlib.util.spec_from_file_location('passive_public_evidence_utilities', HELPER)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
load, proof, digest, bytes_for, packet_digest, pick = (
    shared.load, shared.proof, shared.digest, shared.bytes_for, shared.packet_digest, shared.pick)
ROUTES = ('entry_rebind', 'entry_probe', 'managed_access')
STATION_FIELDS = ('site_surface', 'size', 'role_refs', 'delta', 'peer_scale', 'observed_scales', 'after')


def source_identity(value):
    # terminal_composition.identity uses the default ASCII JSON escaping. This
    # digest is used only to verify an existing event receipt, never to decide.
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def method_summary(value):
    if value is None:
        return None
    summary = pick(value, ['composition', 'source_scope', 'role_refs', 'motion_examples',
                           'peer_approach_return', 'scoring_observation', 'qualification'])
    summary['methodSha256'] = digest(value)
    summary['verifiedSelectiveChange'] = value.get('verified_selective_change')
    summary['stationHypothesis'] = value.get('station_hypothesis')
    return summary


def extension_summary(value):
    if not isinstance(value, dict):
        return None
    return {**pick(value, ['currently_bound', 'first_route_key', 'selected', 'status', 'reason', 'release_authority']),
            'kind': (value.get('proposed') or {}).get('kind'), 'sha256': digest(value)}


def station_candidates(checkpoint, method, pointer):
    result = []
    effect = method.get('verified_selective_change') or {}
    for contact_index, (encoded, contact) in enumerate(checkpoint['contacts']):
        key = json.loads(encoded)
        assert isinstance(key, list) and len(key) == 2
        if key[0] != method['source_scope']:
            continue
        for station_key, station in contact.get('stations', {}).items():
            for index, entry in enumerate(station['entries']):
                if entry['after'] == effect.get('after') and entry['peer_preserved']:
                    escaped = station_key.replace('~', '~0').replace('/', '~1')
                    result.append({'entry': {key: entry[key] for key in STATION_FIELDS},
                                   'contactKey': key, 'stationKey': station_key,
                                   'evidence': f'{pointer}/contacts/{contact_index}/1/stations/{escaped}/entries/{index}'})
    return result


def validate_capture(report, trace, execution, manifest, evidence):
    assert report['status'] in ('passed', 'failed'), 'A running capture cannot establish sealed attribution'
    assert report['game'] == trace['game'] and report['status'] == trace['status']
    assert report['sourceUnchangedDuringRun'] and execution['nativeSourceUnchanged'] and execution['executionCodeUnchanged']
    assert report['source'] == execution['nativeSource'] == execution['nativeSourceAfter'] == manifest
    assert manifest['digest'] == digest(manifest['files']) and manifest['fileCount'] == len(manifest['files'])
    assert trace['sourceDigest'] == execution['nativeSourceManifestDigest'] == manifest['digest']
    assert execution['executionInputs'] == execution['executionInputsAfter']
    assert execution['report'] == evidence['report'] and execution['trace'] == evidence['trace']
    assert report['pythonAgentModules'] == []
    if execution.get('publicJournal'):
        path = ROOT / execution['publicJournal']['path']
        data = bytes_for(path)
        evidence['journal'] = proof(path, data)
        assert evidence['journal'] == execution['publicJournal']
        journal = [json.loads(line) for line in gzip.decompress(data).splitlines() if line]
        assert journal == trace['packets'], 'The public trace must equal the actual append-only journal'
    actions, packets = report['actions'], trace['packets']
    assert report['final']['actions'] == len(actions) == len(packets) - 1
    assert packets[0]['command'] is None
    for ordinal, (action, entry) in enumerate(zip(actions, packets[1:]), 1):
        packet = entry['packet']
        assert action['sequence'] == ordinal == packet['step_index']
        assert action['command'] == entry['command']
        assert action['publicPacketSha256'] == packet_digest(packet)
        assert action['frameHash'] == packet['frame_hash']
        assert (action['levelAfter'], action['completedAfter'], action['state']) == (
            packet['level'], packet['levels_completed'], packet['state'])
    final = packets[-1]['packet']
    assert (report['final']['level'], report['final']['levelsCompleted'], report['final']['state']) == (
        final['level'], final['levels_completed'], final['state'])


def extract(report, trace, examples):
    actions, prefixes = report['actions'], report['prefixes']
    assert 'morphologySourceCalls' in report, 'Absent instrumentation cannot establish zero method use'
    assert all('morphologyOwnership' in prefix for prefix in prefixes), 'Missing owner checkpoints'
    calls = report['morphologySourceCalls']
    by_decision = defaultdict(list)
    for index, action in enumerate(actions):
        by_decision[action['decisionRevision']].append((index, action))
    method_acquisitions, method_views, selected_routes, return_chains = [], [], [], []
    checkpoint_returns, journal_events, owner_at_position, ref_positions = {}, {}, {0: (None, None)}, {}
    selected_by_route, selected_by_level, called_routes = Counter(), defaultdict(Counter), Counter()
    call_counts, errors, anomalies = Counter(), Counter(), []
    score_increases = []
    level_actions = Counter(str(action['levelBefore']) for action in actions)
    for index, action in enumerate(actions):
        if action['completedAfter'] > action['completedBefore']:
            score_increases.append({**pick(action, ['sequence', 'levelBefore', 'levelAfter', 'completedBefore', 'completedAfter', 'state']),
                                    'evidence': {'report': f'/actions/{index}', 'trace': f'/packets/{index + 1}'}})
    previous_journal, previous_method, cursor = [], None, 0
    method_instrumentation = all('targetMethod' in prefix['morphologyOwnership'] for prefix in prefixes)
    for prefix_index, prefix in enumerate(prefixes):
        pointer = f'/prefixes/{prefix_index}'
        ownership = prefix['morphologyOwnership']
        checkpoint = ownership['nativeCheckpoint']
        checkpoint_pointer = pointer + '/morphologyOwnership/nativeCheckpoint'
        assert ownership['stateNode'] == 'family_state:morphology'
        assert checkpoint['format'] in ('native.current_morphology.v1', 'native.current_morphology.v2')
        if checkpoint['format'] == 'native.current_morphology.v2':
            assert 'targetMethod' in ownership and 'entry_access_return' in checkpoint
        journal = checkpoint['journal']
        assert journal[:len(previous_journal)] == previous_journal, 'Acquired morphology journal must be retained in order'
        prefix_actions = by_decision[prefix['decisionRevision']][:prefix['acquiredActions']]
        assert len(prefix_actions) == prefix['acquiredActions']
        transitions = prefix['inventoryAcquisition']['transitions']
        assert len(transitions) == len(prefix_actions)
        for offset, (transition, (action_index, action)) in enumerate(zip(transitions, prefix_actions)):
            assert action_index == cursor + offset
            assert {'action_ref': transition['command']['action_ref'], 'data': transition['command'].get('data', {})} == action['command']
            for position, ref in ((action_index, transition['before']), (action_index + 1, transition['after'])):
                assert position not in ref_positions or ref_positions[position] == ref
                ref_positions[position] = ref
        for index, row in enumerate(journal[len(previous_journal):], len(previous_journal)):
            assert row['id'] not in journal_events and row['digest'] == source_identity(row['event'])
            event = row['event']
            event_pointer = f'{checkpoint_pointer}/journal/{index}'
            journal_events[row['id']] = {'event': event, 'digest': row['digest'], 'evidence': event_pointer, 'prefixIndex': prefix_index}
            if event.get('kind') == 'entry_access_return':
                assert event['return_ref'] == 'return:' + event['trial'] + ':' + event['after']
                assert event['observation_ref'] == event['after']
                assert any(transition['after'] == event['after'] for transition in transitions)
                assert event['return_ref'] not in checkpoint_returns
                checkpoint_returns[event['return_ref']] = {'event': event, 'evidence': event_pointer,
                    'prefixIndex': prefix_index, 'throughAction': cursor + len(prefix_actions), 'recordCalls': []}
        previous_journal = journal
        pending = checkpoint.get('entry_access_return')
        if pending is not None:
            assert pending['return_ref'] in checkpoint_returns
            assert checkpoint_returns[pending['return_ref']]['event'] == pending
        current_method = ownership.get('targetMethod')
        if current_method != previous_method and current_method is not None:
            assert prefix_actions
            last_index, last_action = prefix_actions[-1]
            last_transition = transitions[-1]
            candidates = station_candidates(checkpoint, current_method, checkpoint_pointer)
            station = current_method.get('station_hypothesis')
            expected_station = {**candidates[0]['entry'], 'source_epoch': current_method['source_scope']} if len(candidates) == 1 else None
            checks = {
                'exactlyOnePublicScoreIncrement': last_action['completedAfter'] == last_action['completedBefore'] + 1,
                'sourceEpochMatchesPublicBoundary': current_method['source_scope'] == last_action['levelBefore'],
                'scoringReferenceMatchesPublicReturn': current_method['scoring_observation'] == last_transition['after'],
                'peerApproachReferenceMatchesBoundaryBefore': current_method['peer_approach_return'] == last_transition['before'],
                'stationProjectionMatchesUniqueAcquiredEntry': station == expected_station,
            }
            target = (prefix.get('compositionAttention') or {}).get('selectedTarget')
            if target is None and ownership.get('proposal'):
                target = ownership['proposal'].get('composition_target_tree')
            if target:
                retained = target.get('retained_target') or {}
                peer = target.get('preceding_peer_access') or {}
                checks.update(targetEffectMatches=retained.get('verified_child_effect') == current_method.get('verified_selective_change'),
                              targetCompositionMatches=retained.get('composition') == current_method.get('composition'),
                              precedingPeerComplete=bool(peer.get('complete')),
                              targetAndPeerPairMatch=retained.get('pair_ref') == peer.get('pair_ref'),
                              targetObservationMatchesBoundaryBefore=target.get('observation_ref') == last_transition['before'])
            acquisition = {'prefixIndex': prefix_index, 'throughAction': cursor + len(prefix_actions),
                'method': method_summary(current_method), 'stationMatchingEntries': candidates,
                'targetReceiptCaptured': target is not None, 'checks': checks, 'allCapturedChecksMatch': all(checks.values()),
                'evidence': {'owner': pointer + '/morphologyOwnership/targetMethod', 'publicBoundary': f'/actions/{last_index}',
                             'publicReturn': f'/packets/{last_index + 1}', 'selectedTarget': pointer + '/compositionAttention/selectedTarget' if target is not None else None}}
            method_acquisitions.append(acquisition)
            if not all(checks.values()):
                anomalies.append({'kind': 'method_boundary_link_mismatch', 'evidence': acquisition['evidence'], 'checks': checks})
        previous_method = current_method
        cursor += len(prefix_actions)
        owner_at_position[cursor] = (current_method, pointer + '/morphologyOwnership/targetMethod' if 'targetMethod' in ownership else None)
        proposal = ownership.get('proposal')
        if proposal is not None:
            assert prefix['family'] == 'morphology'
            plan = proposal['morphology_plan']
            route = plan['route_key']
            selected_by_route[route] += 1
            for _, action in prefix_actions:
                selected_by_level[str(action['levelBefore'])][route] += 1
            parent_ref = plan.get('parent_return_ref')
            facts_ref = ((proposal.get('morphology') or {}).get('measured_facts') or {}).get('entry_access_return')
            extension = (proposal.get('morphology') or {}).get('target_extension')
            selected_routes.append({'prefixIndex': prefix_index, 'routeKey': route, 'proposalId': proposal.get('proposal_id'),
                'selectedActions': len(prefix_actions), 'firstAction': prefix_actions[0][1]['sequence'] if prefix_actions else None,
                'lastAction': prefix_actions[-1][1]['sequence'] if prefix_actions else None,
                'plan': pick(plan, ['trial', 'observation_ref', 'level_epoch', 'score', 'access_phase', 'contact_in_prefix',
                                    'full_access_length', 'information_cost', 'reserve_after_probe', 'parent_return_ref']),
                'deferredProbePresent': bool(plan.get('deferred_probe')), 'factsEntryAccessReturn': facts_ref,
                'targetExtension': extension_summary(extension),
                'evidence': {'proposal': pointer + '/morphologyOwnership/proposal',
                             'targetExtension': pointer + '/morphologyOwnership/proposal/morphology/target_extension' if extension else None,
                             'actions': [f'/actions/{index}' for index, _ in prefix_actions],
                             'publicReturns': [f'/packets/{action["sequence"]}' for _, action in prefix_actions]}})
            if route == 'entry_probe':
                parent = checkpoint_returns.get(parent_ref)
                checks = {'parentReturnAcquired': parent is not None, 'factsReferenceMatchesParent': facts_ref == parent_ref,
                          'currentObservationMatchesParentAfter': parent is not None and plan['observation_ref'] == parent['event']['after'],
                          'epochMatchesParent': parent is not None and plan['level_epoch'] == parent['event']['epoch']}
                return_chains.append({'returnRef': parent_ref, 'acquisition': parent['evidence'] if parent else None,
                    'acquisitionPrefix': parent['prefixIndex'] if parent else None, 'probePrefix': prefix_index,
                    'probeEvidence': pointer + '/morphologyOwnership/proposal', 'targetExtension': extension_summary(extension),
                    'checks': checks, 'allCapturedChecksMatch': all(checks.values())})
                if not all(checks.values()):
                    anomalies.append({'kind': 'continuation_parent_link_mismatch', 'prefixIndex': prefix_index, 'checks': checks})
    reverse_refs = {ref: position for position, ref in ref_positions.items()}
    for index, call in enumerate(calls):
        assert call['index'] == index
        method = call['method']
        call_counts[method] += 1
        errors[method] += 'error' in call
        if method == 'propose':
            observation = call['arguments'][0]
            ref = call.get('current') or observation['observation_ref']
            position = reverse_refs.get(ref)
            if position is None:
                # A final failed planning call may occur after the last sealed
                # prefix; its public revision still identifies the trace packet.
                position = observation['revision'] - 1
                assert 0 <= position < len(trace['packets'])
            packet = trace['packets'][position]['packet']
            assert observation['frame_hash'] == packet['frame_hash'] and observation['level_epoch'] == packet['level']
            if call['sourceBefore']['format'] == 'native.current_morphology.v2':
                assert 'targetMethod' in call
            captured = call.get('targetMethod')
            owner, owner_pointer = owner_at_position.get(position, (None, None))
            owner_matches = captured == owner if position in owner_at_position else None
            if owner_matches is False:
                anomalies.append({'kind': 'proposal_method_owner_mismatch', 'call': index, 'owner': owner_pointer})
            proposal = call.get('result')
            route = (proposal or {}).get('morphology_plan', {}).get('route_key')
            if route:
                called_routes[route] += 1
            pending = call['sourceBefore'].get('entry_access_return')
            method_views.append({'call': index, 'publicPacketIndex': position, 'observationRef': ref,
                'methodCaptured': 'targetMethod' in call, 'methodSha256': digest(captured) if captured is not None else None,
                'methodSourceScope': (captured or {}).get('source_scope'), 'stationPresent': bool((captured or {}).get('station_hypothesis')),
                'matchesSealedOwner': owner_matches, 'offeredRoute': route,
                'pendingReturnRef': pending.get('return_ref') if pending else None,
                'evidence': {'call': f'/morphologySourceCalls/{index}', 'owner': owner_pointer,
                             'publicObservation': f'/packets/{position}'}})
        elif method == 'record':
            for event in (call.get('result') or {}).get('events', []):
                if event.get('kind') != 'entry_access_return':
                    continue
                parent = checkpoint_returns.get(event['return_ref'])
                if parent is None:
                    anomalies.append({'kind': 'returned_event_not_in_sealed_checkpoint', 'call': index, 'returnRef': event['return_ref']})
                else:
                    assert parent['event'] == event
                    parent['recordCalls'].append(f'/morphologySourceCalls/{index}')
    for parent in checkpoint_returns.values():
        if not parent['recordCalls']:
            anomalies.append({'kind': 'checkpoint_return_without_captured_record', 'evidence': parent['evidence']})
    return_rows = [{**pick(value, ['evidence', 'prefixIndex', 'throughAction', 'recordCalls']),
                    'event': pick(value['event'], ['kind', 'before', 'after', 'return_ref', 'observation_ref', 'epoch', 'trial']),
                    'deferredPlanSha256': digest(value['event']['plan'])} for value in checkpoint_returns.values()]
    return {'instrumentation': {'callerMethodViewsCaptured': method_instrumentation,
                               'legacyMethodAbsenceIsNotZeroAcquisitionEvidence': not method_instrumentation},
            'counts': {'sealedPrefixes': len(prefixes), 'acquiredActions': cursor, 'dispatchedActions': len(actions),
                       'unattributedDispatchedActions': len(actions) - cursor,
                       'newlyObservedCallerMethods': len(method_acquisitions) if method_instrumentation else None,
                       'methodsWithStation': sum(bool(row['method']['stationHypothesis']) for row in method_acquisitions) if method_instrumentation else None,
                       'sourceCalls': dict(call_counts), 'sourceCallErrors': dict(errors),
                       'proposeCallsWithMethod': sum(row['methodSha256'] is not None for row in method_views) if method_instrumentation else None,
                       'offeredRoutes': dict(called_routes), 'selectedRoutes': {route: selected_by_route[route] for route in sorted(set(ROUTES) | set(selected_by_route))},
                       'selectedActionsBySourceLevelAndRoute': {level: dict(rows) for level, rows in selected_by_level.items()},
                       'acquiredEntryReturns': len(return_rows), 'selectedEntryProbeChains': len(return_chains),
                       'linkedEntryProbeChains': sum(row['allCapturedChecksMatch'] for row in return_chains)},
            'publicProgression': {'actionsBySourceLevel': dict(level_actions), 'scoreIncreases': score_increases},
            'methodAcquisitions': method_acquisitions, 'methodConsumers': method_views,
            'selectedMorphologyRoutes': selected_routes, 'acquiredEntryReturns': return_rows,
            'entryProbeChains': return_chains, 'firstContinuationExamples': [row for row in selected_routes if row['routeKey'] in ROUTES][:examples],
            'capturedLinkAnomalies': anomalies, 'capturedLinksConsistent': not anomalies}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('game', help='Public identifier used only to locate the captured evidence')
    parser.add_argument('directory', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--examples', type=int, default=12)
    args = parser.parse_args()
    assert 1 <= args.examples <= 40
    directory, stem = args.directory.resolve(), args.game.lower()
    destination = args.output.resolve() if args.output else directory / f'{stem}-method-continuation-attribution.json'
    if destination.exists():
        raise FileExistsError(destination)
    paths = {key: directory / name for key, name in [
        ('report', f'{stem}-campaign.json.gz'), ('trace', f'{stem}-public-trace.json.gz'),
        ('execution', f'execution-{stem}.json'), ('manifest', 'source-manifest.json')]}
    loaded = {key: load(path) for key, path in paths.items()}
    report, trace, execution, manifest = (loaded[key][0] for key in paths)
    assert report['game'] == args.game
    evidence = {key: item[1] for key, item in loaded.items()}
    validate_capture(report, trace, execution, manifest, evidence)
    archive_path = directory / 'source-archive.json'
    if archive_path.is_file():
        archive, evidence['archiveManifest'] = load(archive_path)
        assert archive['nativeSourceManifestDigest'] == manifest['digest']
        for item in execution['executionInputs'].values():
            if item['path'] in archive['files']:
                assert archive['files'][item['path']] == item['sha256']
    result = extract(report, trace, args.examples)
    final = trace['packets'][-1]['packet']
    output = {'schema': 'logos-engine.native-method-continuation-attribution.v1',
              'generatedAt': datetime.now(timezone.utc).isoformat(), 'game': args.game,
              'evidence': evidence, 'extractor': proof(Path(__file__)), 'sharedEvidenceUtilities': proof(HELPER),
              'source': {'referenceCommit': report['referenceCommit'], 'nativeManifestDigest': manifest['digest'],
                         'nativeFileCount': manifest['fileCount'], 'unchangedDuringRun': True,
                         'executionInputsUnchanged': True, 'pythonAgentModules': []},
              'observedOutcome': {'campaignStatus': report['status'], 'failure': report.get('failure'),
                                  'requestedTargetLevels': report['targetLevels'], 'publicLevelsCompleted': final['levels_completed'],
                                  'publicFinalLevel': final['level'], 'publicFinalState': final['state'],
                                  'publicWinStateObserved': final['state'] == 'WIN', 'actions': len(report['actions']),
                                  'elapsedSeconds': execution['elapsedSeconds'],
                                  'startedAt': execution['startedAt'], 'finishedAt': execution['finishedAt']},
              **result,
              'qualifications': [
                  'The report, trace, execution receipts, frozen native manifest and actual public journal are byte-linked before indexing.',
                  'Method acquisition means a newly observed value in the existing sealed caller owner. Its source epoch, scoring reference, boundary score and unique station projection are checked against captured evidence; this is not a reexecution of the historical caller.',
                  'Station candidates follow the historical source filter: source epoch, selective-effect after reference and preserved peer, with no additional pair-key filter.',
                  'Captured target-method views at propose are compared with the preceding sealed caller owner. Null views in legacy reports are not evidence that historical method acquisition never occurred.',
                  'An offered route, a selected sealed prefix, acquired actions, an entry-access-return event and a selected continuation are counted separately.',
                  'An entry probe chain must name an actually acquired return_ref and agree with its current reference and epoch. Retained target extensions are indexed as captured, without granting release authority or inferring their truth.',
                  'Official progress is read only from public score and terminal-state returns. Provider participation or link consistency does not establish that the provider caused progress, nor that an unobserved run would succeed.',
                  'No solver, game implementation, private state, native-source mutation, action execution or ablation is used by this extractor.',
              ]}
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': proof(destination), 'observedOutcome': output['observedOutcome'],
                      'counts': output['counts'], 'capturedLinksConsistent': output['capturedLinksConsistent']}, ensure_ascii=False))
    if output['capturedLinkAnomalies']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
