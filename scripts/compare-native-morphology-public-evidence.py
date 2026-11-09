#!/usr/bin/env python3
"""Compare actual current-morphology calls with unchanged original Python.

This is an offline component-boundary comparison of a completed native game.
It does not execute a game, provide a native command, or seed native knowledge.
The original adapter starts with cold contacts/trials and retains its own state
through the complete captured call order. Its external meter/collection inputs
come from a separate cold replay of the actual shared-owner calls, never from
an assumed forecast or a native retained-state seed. The transferred domain is
station_method = entry_method = entry_access_return = None. The untransferred
morph.last handoff to the strategic caller is outside this comparison.
"""
from __future__ import annotations

import argparse
from collections import Counter
import copy
from datetime import datetime, timezone
import gzip
import importlib.util
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'scripts/compare-v54-reactive-public-evidence.py'
INVENTORY_HELPER = ROOT / 'scripts/compare-v56-inventory-public-evidence.py'


def import_helper(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


shared = import_helper('morphology_public_contracts', HELPER)
inventory = import_helper('morphology_shared_owner_contracts', INVENTORY_HELPER)
load, proof, check, plain, digest = shared.load, shared.proof, shared.check, shared.plain, shared.digest
FORMAT = 'native.current_morphology.v1'
STATE_FIELDS = {'format', 'journal', 'contacts', 'tried', 'feature_trials'}
SNAPSHOT_FIELDS = {'rows', 'roles', 'epoch', 'score', 'ref', 'frame_hash'}
POLICY_RECEIPT_FIELDS = {'trace', 'instructions', 'execution_engine', 'reference_commit',
                         'reference_semantic_hash', 'all_executed_statements', 'instruction_quantum',
                         'source_definition_hash', 'native_execution_hash', 'edited'}


def snapshot_value(snapshot):
    return {'rows': [list(row) for row in snapshot.rows], 'roles': plain(snapshot.roles),
            'epoch': snapshot.epoch, 'score': snapshot.score, 'ref': snapshot.ref,
            'frame_hash': snapshot.frame_hash}


def source_state(adapter):
    # Preserve insertion order of acquired contacts, just as the source dict and
    # the native Map do. Only the explicit JSON transport of tuple keys changes.
    return {'contacts': [[list(key), plain(value)] for key, value in adapter.contacts.items()],
            'tried': sorted(adapter.tried), 'feature_trials': plain(adapter.feature_trials)}


def native_source_state(value):
    assert set(value) == STATE_FIELDS and value['format'] == FORMAT
    assert isinstance(value['journal'], list)
    contacts = []
    for encoded, row in value['contacts']:
        key = json.loads(encoded)
        assert isinstance(key, list) and len(key) == 2
        assert encoded == json.dumps(key, separators=(',', ':'), ensure_ascii=False)
        contacts.append([key, row])
    return {'contacts': contacts, 'tried': value['tried'], 'feature_trials': value['feature_trials']}


def source_proposal(value):
    if value is None:
        return None
    result = copy.deepcopy(value)
    assert 'morphology_measurement_receipt' in result
    del result['morphology_measurement_receipt']
    decision = result['morphology']
    # The common registry adds these three fields to the standalone native SRC
    # receipt. Their provenance has no field in original MorphologyPolicy.
    assert decision['source_definition_hash'] == decision['src_hash']
    assert decision['edited'] is False
    assert isinstance(decision['native_execution_hash'], str) and len(decision['native_execution_hash']) == 64
    for key in POLICY_RECEIPT_FIELDS:
        assert key in decision, 'Missing declared native policy receipt field: ' + key
        del decision[key]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('game')
    parser.add_argument('directory', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--allow-failed', action='store_true')
    args = parser.parse_args()
    directory, stem = args.directory.resolve(), args.game.lower()
    output = args.output.resolve() if args.output else directory / (stem + '-morphology-original-comparison.json.gz')
    if output.exists():
        raise FileExistsError(output)
    started, clock = datetime.now(timezone.utc).isoformat(), time.monotonic()
    paths = {name: directory / filename for name, filename in [
        ('campaign', stem + '-campaign.json.gz'), ('trace', stem + '-public-trace.json.gz'),
        ('execution', 'execution-' + stem + '.json'), ('manifest', 'source-manifest.json')]}
    campaign, trace, execution, native = [load(paths[name]) for name in ['campaign', 'trace', 'execution', 'manifest']]
    assert campaign['game'] == trace['game'] == args.game
    assert campaign['status'] == trace['status'] and (campaign['status'] == 'passed' or args.allow_failed)
    assert campaign['referenceCommit'] == shared.COMMIT and campaign['pythonAgentModules'] == []
    assert campaign['sourceUnchangedDuringRun'] and execution['nativeSourceUnchanged'] and execution['executionCodeUnchanged']
    assert native['digest'] == digest(native['files']) and native['fileCount'] == len(native['files'])
    check(campaign['source'], native, 'campaign.frozen_source')
    check(execution['nativeSource'], native, 'execution.source.before')
    check(execution['nativeSourceAfter'], native, 'execution.source.after')
    assert trace['sourceDigest'] == execution['nativeSourceManifestDigest'] == native['digest']
    check(execution['executionInputs'], execution['executionInputsAfter'], 'execution.inputs')
    check(execution['report'], proof(paths['campaign']), 'execution.report.bytes')
    check(execution['trace'], proof(paths['trace']), 'execution.trace.bytes')
    journal_path = ROOT / execution['publicJournal']['path']
    check(execution['publicJournal'], proof(journal_path), 'execution.journal.bytes')
    journal = [json.loads(line) for line in gzip.decompress(journal_path.read_bytes()).splitlines()]
    check(journal, trace['packets'], 'complete.actual.public.journal')
    assert campaign['final']['actions'] == len(campaign['actions']) == len(trace['packets']) - 1
    assert campaign['final']['prefixes'] == len(campaign['prefixes'])
    assert sum(prefix['acquiredActions'] for prefix in campaign['prefixes']) == len(campaign['actions'])

    references = [None] * len(trace['packets'])
    cursor = 0
    for prefix in campaign['prefixes']:
        transitions = prefix['inventoryAcquisition']['transitions']
        assert len(transitions) == prefix['acquiredActions']
        for transition in transitions:
            for position, side in [(cursor, 'before'), (cursor + 1, 'after')]:
                assert references[position] is None or references[position] == transition[side]
                references[position] = transition[side]
            command, actual = transition['command'], trace['packets'][cursor + 1]['command']
            check(actual, {'action_ref': command['action_ref'], 'data': command.get('data', {})}, 'command.transport.' + str(cursor + 1))
            check(actual, campaign['actions'][cursor]['command'], 'command.campaign.' + str(cursor + 1))
            cursor += 1
    assert cursor == len(campaign['actions']) and all(references)
    parsed = [shared.OBSERVATION.fullmatch(ref) for ref in references]
    assert all(parsed) and len({match.group(1) for match in parsed}) == 1
    namespace, packet_checks = parsed[0].group(1), []
    for index, item in enumerate(trace['packets']):
        packet = item['packet']
        assert set(packet) == shared.PUBLIC_FIELDS and packet['step_index'] == index
        assert int(parsed[index].group(2)) == packet['level'] and int(parsed[index].group(3)) == index + 1
        assert parsed[index].group(4) == packet['frame_hash']
        assert packet['frame_hash'] == shared.hashlib.sha256(json.dumps(packet['frame_rows'], separators=(',', ':')).encode()).hexdigest()[:16]
        packet_checks.append({'index': index, 'packetSha256': digest(packet),
                              'frames': len(packet['frame_packet']), 'observationRef': references[index]})

    verified = shared.verify_source()
    sys.path[:0] = [str(shared.SOURCE), str(shared.SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from neutral_observer import measure
    from terminal_composition import Snapshot, GoalAccessMemory, identity
    from agents.yf_arc3_v6.morphology_policy.adapter import MorphologyAdapter
    from agents.yf_arc3_v6.morphology_policy.observed_meter import ObservedMeter
    from agents.yf_arc3_v6.morphology_policy.collection_evidence import CollectionEvidence

    print(json.dumps({'phase': 'reconstruct_public_observations', 'packets': len(trace['packets'])}), file=sys.stderr, flush=True)
    observations = [measure(SimpleNamespace(**item['packet']), index + 1, namespace)[0]
                    for index, item in enumerate(trace['packets'])]
    check([obs['observation_ref'] for obs in observations], references, 'original.observation.references')
    by_ref = {obs['observation_ref']: index for index, obs in enumerate(observations)}
    snapshots = [Snapshot.from_public(obs, item['packet']['frame_rows']) for obs, item in zip(observations, trace['packets'])]
    histories, active = [[]], []
    for index, item in enumerate(trace['packets'][1:]):
        before, after = snapshots[index:index + 2]
        command = item['command']
        key = 'addressed:' + identity(command) if command.get('data') else command['action_ref']
        active.append((before, key, after))
        if after.epoch != before.epoch or after.score > before.score:
            active = []
        histories.append(list(active))

    def public_observation(value, rows, label):
        position = by_ref[value['observation_ref']]
        check(value, plain(observations[position]), label + '.observation')
        check(rows, trace['packets'][position]['packet']['frame_rows'], label + '.rows')
        return position

    def transition(arguments, label):
        before, after, command, first, second = arguments[:5]
        position = public_observation(before, first, label + '.before')
        assert public_observation(after, second, label + '.after') == position + 1
        check({'action_ref': command['action_ref'], 'data': command.get('data', {})},
              trace['packets'][position + 1]['command'], label + '.command')
        return position

    meter, collection, adapter = ObservedMeter(), CollectionEvidence(), MorphologyAdapter()
    context = lambda: {'meter': inventory.meter_state(meter), 'collection': plain(collection.retained_state())}
    initial_context, initial_state = context(), source_state(adapter)
    assert initial_state == {'contacts': [], 'tried': [], 'feature_trials': {}}
    contexts, context_checks, call_checks, prefix_checks, decisions = {}, [], [], [], []
    counts, reasons, routes = Counter(), Counter(), Counter()
    records, departures, offers, expected_journal, acquired_ids = {}, {}, {}, [], set()
    failure, phase = None, 'shared_context_replay'

    def retain_event(event, event_id):
        assert event_id not in acquired_ids, 'Repeated acquisition is outside this actual-call replay claim'
        acquired_ids.add(event_id)
        expected_journal.append({'id': event_id, 'digest': identity(event), 'event': plain(event)})

    def compare_state(value, label):
        state = source_state(adapter)
        check(native_source_state(value), state, label + '.source_projection')
        check(value['journal'], expected_journal, label + '.native_journal_from_original_events')
        assert adapter.station_method is adapter.entry_method is adapter.entry_access_return is None
        return state

    try:
        # The two captures have separate counters, so no global order is invented.
        # Replay the complete shared-owner sequence, then require every observation
        # reference used by morphology to identify one unique verified context.
        for index, call in enumerate(campaign['inventorySourceCalls']):
            assert call['index'] == index and 'error' not in call
            method, arguments = call['method'], copy.deepcopy(call['arguments'])
            label = 'shared.context.call.' + str(index)
            check(call['callerContextBefore'], context(), label + '.before')
            if method == 'observeCallerContext':
                obs, rows = arguments
                public_observation(obs, rows, label)
                result = meter.observe(obs['level_epoch'], obs['observation_ref'], rows, primitive_index=obs.get('revision'))
                check(call['result'], plain(result), label + '.result')
                ref, current = obs['observation_ref'], context()
                prior = contexts.get(ref)
                if prior is not None:
                    check(current, prior['state'], label + '.unambiguous_context_for_reference')
                    prior['calls'].append(index)
                else:
                    contexts[ref] = {'state': current, 'meter': copy.deepcopy(meter),
                                     'collection': copy.deepcopy(collection), 'calls': [index]}
            elif method == 'recordCallerContext':
                transition(arguments, label)
                before, after, command, first, second, proposal, step_index = arguments
                result = collection.observe(before, after, first, second, command,
                                            meter_before=meter.forecast(), mover=inventory.collection_mover(proposal, step_index, before))
                check(call['result'], plain(result), label + '.result')
            else:
                assert method in {'proposeSource', 'preservation_obligations', 'recordSource'}
                # These source surfaces consume this context but do not own it.
                # Their inventory-family results are outside the present claim.
            check(call['callerContextAfter'], context(), label + '.after')
            context_checks.append({'index': index, 'method': method, 'contextSha256': digest(context())})
            counts['sharedContext.' + method] += 1

        phase = 'morphology_replay'
        captured_snapshots = campaign['motionSnapshots']
        for ref, value in captured_snapshots.items():
            assert ref in by_ref and set(value) == SNAPSHOT_FIELDS and value['ref'] == ref
            check(value, snapshot_value(snapshots[by_ref[ref]]), 'snapshot.from.public.' + ref)
        counts['publicSnapshotsCompared'] = len(captured_snapshots)
        calls = campaign['morphologySourceCalls']
        assert calls, 'No actual morphology source calls were captured'
        for index, call in enumerate(calls):
            if index % 25 == 0:
                print(json.dumps({'phase': phase, 'call': index, 'total': len(calls)}), file=sys.stderr, flush=True)
            assert call['index'] == index and 'error' not in call
            label, method, arguments = 'morphology.call.' + str(index), call['method'], copy.deepcopy(call['arguments'])
            compare_state(call['sourceBefore'], label + '.before')
            detail = {'index': index, 'method': method}
            if method == 'propose':
                assert len(arguments) == 4
                obs, rows, inputs, remaining = arguments
                position = public_observation(obs, rows, label)
                assert all(action['action_ref'] in obs['available_action_refs'] for action in inputs)
                assert isinstance(remaining, int) and remaining > 0
                assert call['current'] == references[position] and call['current'] in captured_snapshots
                history = histories[position]
                history_refs = [[a.ref, command, b.ref] for a, command, b in history]
                check(call['history'], history_refs, label + '.complete_episode_from_public')
                assert all(a in captured_snapshots and b in captured_snapshots for a, _, b in call['history'])
                verified_context = contexts[obs['observation_ref']]
                adapter.meter = copy.deepcopy(verified_context['meter'])
                adapter.collection = copy.deepcopy(verified_context['collection'])
                goal = GoalAccessMemory()
                goal.episode = history
                original = adapter.propose(goal, obs, rows, inputs, remaining)
                result = plain(original)
                check(source_proposal(call['result']), result, label + '.original_proposal')
                check({'meter': inventory.meter_state(adapter.meter), 'collection': plain(adapter.collection.retained_state())},
                      verified_context['state'], label + '.idempotent_shared_context')
                measurement = call.get('measurement')
                assert measurement is not None and call.get('refusal') is None
                facts, decision = adapter.last['measured_facts'], adapter.last
                check(measurement['facts_digest'], identity(facts), label + '.original_facts_digest')
                check(measurement['decision'], {key: plain(decision.get(key)) for key in
                      ('status', 'reason', 'route_key', 'operation', 'workflow', 'src_hash', 'executed_statements')},
                      label + '.original_decision_fields')
                check(measurement['routes'], list(facts['routes']), label + '.original_route_keys')
                check(measurement['meter_observation_ref'], (adapter.meter.forecast() or {}).get('observation_ref'), label + '.forecast_reference')
                offers.setdefault(obs['observation_ref'], []).append({'call': index, 'native': call['result'], 'original': result})
                reasons[str((obs['level_epoch'], decision['reason']))] += 1
                if decision.get('route_key'):
                    routes[str((obs['level_epoch'], decision['route_key']))] += 1
                decisions.append({'call': index, 'publicPacketIndex': position, 'levelEpoch': obs['level_epoch'],
                                  'levelsCompleted': obs['levels_completed'], 'framedPair': facts['framed_pair'],
                                  'controlAttested': facts['control_attested'], 'routeKeys': list(facts['routes']),
                                  'reason': decision['reason'], 'selectedRouteKey': decision['route_key'],
                                  'featureResiduals': plain(facts.get('feature_residuals')),
                                  'meterForecast': plain(adapter.meter.forecast()), 'offeredActions': result['actions'] if result else [],
                                  'sourceFactsSha256': identity(facts)})
                detail.update(publicPacketIndex=position, historyTransitions=len(history), historyRefsSha256=digest(history_refs),
                              sharedContextCalls=verified_context['calls'], sharedContextSha256=digest(verified_context['state']))
                counts['nonNullOffers' if original is not None else 'abstentions'] += 1
                counts['episodeTransitionsCompared'] += len(history)
                counts['sourceFactsAndDecisionComparisons'] += 1
            elif method == 'record':
                assert len(arguments) in (7, 8)
                position = transition(arguments, label)
                assert position not in records
                before, after, command, first, second, proposal, step_index = arguments[:7]
                if len(arguments) == 8:
                    # NativeFamily's shared call surface also passes the actual
                    # animation packet; MorphologyAdapter does not consume it.
                    check(arguments[7], trace['packets'][position + 1]['packet']['frame_packet'], label + '.unused_public_animation_packet')
                assert proposal and proposal['kind'] == 'morphology_probe'
                assert proposal['morphology_plan']['route_key'] not in {'entry_probe', 'entry_rebind', 'managed_access'}
                selected_action = proposal['actions'][step_index]
                check({'action_ref': command['action_ref'], 'data': command.get('data', {})},
                      {'action_ref': selected_action['action_ref'], 'data': selected_action.get('data', {})}, label + '.selected_action')
                first_packet, next_packet = [SimpleNamespace(**trace['packets'][i]['packet']) for i in (position, position + 1)]
                guard = adapter.before(proposal, step_index, first_packet, before)
                assert guard['admitted']
                outcome = adapter.after(proposal, step_index, next_packet)
                original_event = adapter.record(proposal, step_index, first_packet, next_packet,
                                                after['observation_ref'], before['observation_ref'])
                result = {'events': [] if original_event is None else [plain(original_event)]}
                check(call['result'], result, label + '.original_event')
                if original_event is not None:
                    retain_event(original_event, json.dumps(['selected', proposal['morphology_plan']['trial'], step_index,
                                 before['observation_ref'], after['observation_ref']], separators=(',', ':'), ensure_ascii=False))
                    counts['selectedEventsAcquired'] += 1
                records[position] = {'call': index, 'proposal': proposal, 'stepIndex': step_index,
                                     'guard': plain(guard), 'outcome': plain(outcome), 'result': result}
                detail.update(publicPacketIndex=position, guard=plain(guard), outcome=plain(outcome))
            elif method == 'observeDepartures':
                assert len(arguments) == 5
                before, after, first, second, command = arguments
                position = transition([before, after, command, first, second], label)
                assert position not in departures
                result = plain(adapter.observe_departures(before, after, first, second, command))
                check(call['result'], result, label + '.original_departures')
                for event in result:
                    contact_key = json.dumps([event['epoch'], event['pair_key']], separators=(',', ':'), ensure_ascii=False)
                    event_id = json.dumps(['departure', contact_key, event['station_key'], before['observation_ref'], after['observation_ref']],
                                          separators=(',', ':'), ensure_ascii=False)
                    retain_event(event, event_id)
                counts['departureEventsAcquired'] += len(result)
                departures[position] = {'call': index, 'source': source_state(adapter), 'journal': copy.deepcopy(expected_journal)}
                detail['publicPacketIndex'] = position
            else:
                raise AssertionError('Unexpected morphology source surface: ' + method)
            state = compare_state(call['sourceAfter'], label + '.after')
            detail.update(resultSha256=digest(result), sourceStateSha256=digest(state), journalSha256=digest(expected_journal))
            call_checks.append(detail)
            counts[method] += 1

        phase, cursor = 'sealed_prefixes', 0
        assert set(departures) == set(range(len(campaign['actions'])))
        consumed_records = set()
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            ownership = prefix['morphologyOwnership']
            assert ownership['stateNode'] == 'family_state:morphology'
            assert prefix['decisionRevision'] == cursor + 1
            selected = ownership['proposal']
            transitions = prefix['inventoryAcquisition']['transitions']
            if selected is not None:
                assert prefix['family'] == 'morphology' and selected['kind'] == 'morphology_probe'
                candidates = [offer for offer in offers[references[cursor]] if offer['native'] is not None]
                assert candidates
                offer = candidates[-1]
                extras = set(selected) - set(offer['native'])
                assert extras <= {'strategy_receipt', 'composition_target_tree'} and not set(offer['native']) - set(selected)
                check({key: value for key, value in selected.items() if key not in extras}, offer['native'],
                      'prefix.' + str(prefix_index) + '.selected_captured_offer')
                counts['selectedPrefixes'] += 1
            else:
                assert prefix['family'] != 'morphology'
                counts['foreignPrefixes'] += 1
            for step_index, item in enumerate(transitions):
                if selected is not None:
                    record = records[cursor]
                    check(record['proposal'], selected, 'prefix.' + str(prefix_index) + '.selected_record_proposal')
                    assert record['stepIndex'] == step_index
                    check(item['outcome'], record['outcome'], 'prefix.' + str(prefix_index) + '.original_selected_outcome.' + str(step_index))
                    consumed_records.add(cursor)
                    counts['selectedOutcomesCompared'] += 1
                else:
                    assert cursor not in records
                cursor += 1
            assert transitions
            boundary = departures[cursor - 1]
            checkpoint = ownership['nativeCheckpoint']
            check(native_source_state(checkpoint), boundary['source'], 'prefix.' + str(prefix_index) + '.source_checkpoint')
            check(checkpoint['journal'], boundary['journal'], 'prefix.' + str(prefix_index) + '.journal_checkpoint')
            prefix_checks.append({'index': prefix_index, 'throughAction': cursor, 'departureCall': boundary['call'],
                                  'selected': selected is not None, 'sourceStateSha256': digest(boundary['source']),
                                  'journalSha256': digest(boundary['journal'])})
            counts['sealedCheckpointsCompared'] += 1
        assert consumed_records == set(records)
        assert cursor == len(campaign['actions'])
    except Exception as error:
        failure = {'type': type(error).__name__, 'message': str(error), 'phase': phase,
                   'completedMorphologyCalls': len(call_checks), 'completedSharedContextCalls': len(context_checks),
                   'completedSealedPrefixes': len(prefix_checks)}

    imported = {}
    for module in list(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if not filename:
            continue
        path = Path(filename).resolve()
        if path.is_relative_to(shared.SOURCE) and path.is_file():
            name = path.relative_to(shared.SOURCE).as_posix()
            assert shared.sha(path) == verified[name]
            imported[name] = verified[name]
    assert shared.verify_source() == verified
    result = {
        'schema': 'logos-engine.lot2a.current-morphology-public-source-comparison.v1',
        'status': 'failed' if failure else 'passed', 'referenceCommit': shared.COMMIT,
        'game': args.game, 'nativeSourceDigest': native['digest'],
        'campaignStatus': campaign['status'], 'campaignFinal': campaign['final'],
        'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(),
        'elapsedSeconds': time.monotonic() - clock,
        'inputs': {name: proof(path) for name, path in paths.items()}, 'generator': proof(Path(__file__)),
        'sharedEvidenceContracts': proof(HELPER), 'sharedOwnerContracts': proof(INVENTORY_HELPER),
        'sourceFilesVerifiedBeforeAndAfter': len(verified), 'importedOriginalSourceFiles': dict(sorted(imported.items())),
        'completePublicJournalMatched': True, 'publicPacketsCompared': len(packet_checks),
        'animationFramesIncludingInitial': sum(row['frames'] for row in packet_checks),
        'packetChecks': packet_checks, 'coldInitialMorphologyState': initial_state,
        'coldInitialCallerContext': initial_context, 'counts': dict(counts),
        'decisionReasonsByEpoch': dict(reasons), 'chosenRoutesByEpoch': dict(routes),
        'sharedContextChecks': context_checks, 'sourceCallChecks': call_checks,
        'decisions': decisions, 'sealedPrefixChecks': prefix_checks,
        'finalMorphologySourceState': source_state(adapter), 'finalOriginalSharedContext': context(),
        'failure': failure,
        'scope': {
            'station_method': None, 'entry_method': None, 'entry_access_return': None,
            'sourceStateFieldsCompared': ['contacts', 'tried', 'feature_trials'],
            'nativeWrapperFieldsExcludedFromOriginalProposal': ['morphology_measurement_receipt'],
            'nativePolicyReceiptFieldsExcluded': sorted(POLICY_RECEIPT_FIELDS),
            'measurementReceiptSourceFieldsCompared': ['facts_digest', 'decision', 'routes', 'meter_observation_ref'],
            'morphLastStrategicHandoffCompared': False,
            'fullOriginalCallerCompared': False, 'independentGameSuccess': False,
            'inventoryFamilyProposalsCompared': False,
        },
        'qualification': (
            'Offline comparison at the transferred morphology component boundary, after an independently completed native campaign. '
            'Public observations and every active GoalAccess episode are reconstructed from the complete actual transport journal. '
            'The unchanged original meter and collection are replayed cold through all captured shared-owner context calls; '
            'each morphology observation must resolve to one unique verified original context. A copy of those original owner '
            'objects supplies the actual external context to the original adapter, without native state seeds or fabricated forecasts. '
            'Original contacts/tried/feature_trials start cold and evolve only through actual selected record and passive departure calls. '
            'All captured proposals, abstentions, measured facts hashes, policy decisions, acquisitions and before/after source projections '
            'are compared; native journals are separately reconstructed from original returned events. Selected guards are recomputed '
            'against actual public packets and outcomes are compared with sealed transitions. Native receipt metadata has no original '
            'counterpart and is excluded except for explicitly listed source-derived fields. The original adapter computes last internally, '
            'but the untransferred morph.last handoff, retained station/entry methods, whole strategic caller and other families are outside '
            'this claim. No source patch, identifier remapping, tolerance, native action injection or new game run is used. '
            'Passing component parity does not explain a campaign failure or claim overall game completion.'),
    }
    with output.open('xb') as stream:
        stream.write(gzip.compress(json.dumps(result, separators=(',', ':'), allow_nan=False).encode(), mtime=0))
    print(json.dumps({'status': result['status'], 'counts': dict(counts), 'publicPackets': len(packet_checks),
                      'output': str(output.relative_to(ROOT)), 'failure': failure}), flush=True)
    if failure:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
