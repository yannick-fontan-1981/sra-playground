#!/usr/bin/env python3
"""Replay the actual inventory source calls against unchanged original Python.

Public packets and actual call arguments are evidence inputs after execution.
Neither original proposals nor retained states feed the native game campaign.
Losing proposal evaluations are replayed because the source mutates its state.
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

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'scripts/compare-v54-reactive-public-evidence.py'
spec = importlib.util.spec_from_file_location('inventory_public_contracts', HELPER)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
load, proof, check, plain, digest = shared.load, shared.proof, shared.check, shared.plain, shared.digest
FIELDS = {'tracker', 'seen_pairs', 'failed', 'access_returns', 'endpoint_memory', 'boundary_memory', 'pending_access', 'retained_effect_scope'}


def meter_state(meter):
    pairs = lambda mapping: [[list(key), plain(value)] for key, value in sorted(mapping.items())]
    return {'epoch': meter.epoch, 'recent': [[ref, pairs(value)] for ref, value in meter.recent],
            'hypotheses': pairs(meter.hypotheses), 'peaks': pairs(meter.peaks), 'last_ref': meter.last_ref,
            'previous_rows': plain(meter.previous_rows), 'single_line_evidence': pairs(meter.single_line_evidence),
            'recent_steps': list(meter.recent_steps), 'last_step_index': meter.last_step_index}


def collection_mover(proposal, index, before):
    # Exact consumed collection-context projection from common_frontier_runtime.py.
    role = proposal.get('morphology', {}).get('measured_facts', {})
    mover = {'role_refs': role.get('controlled_role_refs', []), 'moves': role.get('motion_examples', {})}
    if proposal.get('inventory_plan'):
        scene = proposal['inventory_plan']['offer']['scene']
        mover = {'role_refs': [scene['body_signature']],
                 'moves': {key: record['delta'] for key, record in scene['controls'].items() if not record.get('contradictions')},
                 'observation_ref': before['observation_ref'], 'level_epoch': before['level_epoch']}
        cell = next((cell for cell in scene['grids'][0]['cells']
                     if (cell['row'], cell['col']) == tuple(proposal['steps'][index]['to_cell'])), None)
        if cell: mover['contact_cell_bbox'] = [cell['bbox'][key] for key in ('left', 'top', 'right', 'bottom')]
    return mover


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('game'); parser.add_argument('directory', type=Path)
    parser.add_argument('--allow-failed', action='store_true')
    args = parser.parse_args(); directory = args.directory.resolve(); stem = args.game.lower()
    output = directory / (stem + '-inventory-original-comparison.json.gz')
    if output.exists(): raise FileExistsError(output)
    started = datetime.now(timezone.utc).isoformat(); clock = time.monotonic()
    paths = {name: directory / filename for name, filename in [
        ('campaign', stem + '-campaign.json.gz'), ('trace', stem + '-public-trace.json.gz'),
        ('execution', 'execution-' + stem + '.json'), ('manifest', 'source-manifest.json')]}
    campaign, trace, execution, native = [load(paths[name]) for name in ['campaign', 'trace', 'execution', 'manifest']]
    assert campaign['game'] == trace['game'] == args.game
    assert campaign['status'] == trace['status'] and (campaign['status'] == 'passed' or args.allow_failed)
    assert campaign['referenceCommit'] == shared.COMMIT and campaign['pythonAgentModules'] == []
    assert campaign['sourceUnchangedDuringRun'] and execution['nativeSourceUnchanged'] and execution['executionCodeUnchanged']
    assert native['digest'] == digest(native['files']) and native['fileCount'] == len(native['files'])
    check(campaign['source'], native, 'campaign.source')
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
    references = [None] * len(trace['packets']); cursor = 0
    for prefix in campaign['prefixes']:
        retained = prefix['inventoryAcquisition']
        assert len(retained['transitions']) == prefix['acquiredActions']
        for transition in retained['transitions']:
            for position, side in [(cursor, 'before'), (cursor + 1, 'after')]:
                assert references[position] is None or references[position] == transition[side]
                references[position] = transition[side]
            command = transition['command']; actual = trace['packets'][cursor + 1]['command']
            check(actual, {'action_ref': command['action_ref'], 'data': command.get('data', {})}, 'command.transport.' + str(cursor + 1))
            check(actual, campaign['actions'][cursor]['command'], 'command.campaign.' + str(cursor + 1)); cursor += 1
    assert cursor == len(campaign['actions']) and all(references)
    parsed = [shared.OBSERVATION.fullmatch(ref) for ref in references]
    assert all(parsed) and len({match.group(1) for match in parsed}) == 1
    namespace = parsed[0].group(1); packet_checks = []
    for index, item in enumerate(trace['packets']):
        packet = item['packet']; assert set(packet) == shared.PUBLIC_FIELDS and packet['step_index'] == index
        assert int(parsed[index].group(2)) == packet['level'] and int(parsed[index].group(3)) == index + 1
        assert parsed[index].group(4) == packet['frame_hash']
        assert packet['frame_hash'] == shared.hashlib.sha256(json.dumps(packet['frame_rows'], separators=(',', ':')).encode()).hexdigest()[:16]
        packet_checks.append({'index': index, 'packetSha256': digest(packet), 'frames': len(packet['frame_packet']), 'observationRef': references[index]})
    verified = shared.verify_source()
    sys.path[:0] = [str(shared.SOURCE), str(shared.SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from neutral_observer import measure
    from agents.yf_arc3_v6.morphology_policy.observed_inventory.family import ObservedInventory
    from agents.yf_arc3_v6.morphology_policy.observed_meter import ObservedMeter
    from agents.yf_arc3_v6.morphology_policy.collection_evidence import CollectionEvidence
    observations = [measure(SimpleNamespace(**item['packet']), index + 1, namespace)[0] for index, item in enumerate(trace['packets'])]
    check([obs['observation_ref'] for obs in observations], references, 'original.observation.references')
    family, meter, collection = ObservedInventory(), ObservedMeter(), CollectionEvidence()
    context = lambda: {'meter': meter_state(meter), 'collection': plain(collection.retained_state())}
    initial, initial_context = plain(family.state()), context()
    assert set(initial) == FIELDS
    by_ref = {obs['observation_ref']: index for index, obs in enumerate(observations)}

    def public_observation(value, rows, label):
        index = by_ref[value['observation_ref']]
        check(value, plain(observations[index]), label + '.observation')
        check(rows, trace['packets'][index]['packet']['frame_rows'], label + '.rows')
        return index

    def transition(arguments, label):
        before, after, command, first, second = arguments[:5]
        index = public_observation(before, first, label + '.before')
        assert public_observation(after, second, label + '.after') == index + 1
        check({'action_ref': command['action_ref'], 'data': command.get('data', {})}, trace['packets'][index + 1]['command'], label + '.command')
        return index

    counts = Counter(); call_checks, prefix_checks, acquisitions, proposals = [], [], [], []
    checkpoints = {0: {'source': initial, 'context': initial_context}}
    records, contexts, offers = {}, {}, {}
    failure = None; cursor = 0
    try:
        calls = campaign['inventorySourceCalls']; assert calls
        for index, call in enumerate(calls):
            assert call['index'] == index and 'error' not in call
            label = 'source.call.' + str(index); method = call['method']; arguments = copy.deepcopy(call['arguments'])
            check(call['sourceBefore'], plain(family.state()), label + '.state.before')
            check(call['callerContextBefore'], context(), label + '.context.before')
            if method == 'observeCallerContext':
                obs, rows = arguments; public_observation(obs, rows, label)
                result = meter.observe(obs['level_epoch'], obs['observation_ref'], rows, primitive_index=obs.get('revision'))
            elif method == 'recordCallerContext':
                position = transition(arguments, label); assert position not in contexts
                before, after, command, first, second, proposal, step_index = arguments
                result = collection.observe(before, after, first, second, command, meter_before=meter.forecast(),
                                            mover=collection_mover(proposal, step_index, before))
                contexts[position] = {'call': index, 'proposal': proposal, 'index': step_index}
            elif method == 'proposeSource':
                obs, rows, inputs, remaining, forecast, goals, retained_collection = arguments
                public_observation(obs, rows, label)
                check(forecast, plain(meter.forecast()), label + '.forecast')
                check(retained_collection, plain(collection.retained_state()), label + '.collection')
                result = family.propose(obs, rows, inputs, remaining, meter.forecast(), goals, collection)
                offers.setdefault(obs['observation_ref'], []).append({'call': index, 'result': plain(result)})
                counts['nonNullOffers' if result is not None else 'abstentions'] += 1
            elif method == 'preservation_obligations':
                obs, rows = arguments; public_observation(obs, rows, label)
                result = family.preservation_obligations(obs, rows)
            elif method == 'recordSource':
                position = transition(arguments, label); assert position not in records
                result = family.record(*arguments)
                records[position] = {'call': index, 'arguments': arguments, 'result': plain(result)}
            else: raise AssertionError('Unexpected source surface: ' + method)
            check(call['result'], plain(result), label + '.result')
            state, current_context = plain(family.state()), context()
            assert set(state) == FIELDS
            check(call['sourceAfter'], state, label + '.state.after')
            check(call['callerContextAfter'], current_context, label + '.context.after')
            checkpoints[index + 1] = {'source': state, 'context': current_context}
            call_checks.append({'index': index, 'method': method, 'resultSha256': digest(plain(result)),
                                'sourceStateSha256': digest(state), 'callerContextSha256': digest(current_context)})
            counts[method] += 1
        assert set(records) == set(contexts) == set(range(len(campaign['actions'])))
        through = 0
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            retained = prefix['inventoryAcquisition']; selected = retained.get('selectedProposal')
            assert retained['stateNode'] == 'family_state:public_observed_inventory'
            assert retained['checkpointFormat'] == 'native.public_observed_inventory.v1'
            assert prefix['decisionRevision'] == cursor + 1
            count = retained['sourceCallsThrough']; assert through < count <= len(calls)
            state, current_context = checkpoints[count]['source'], checkpoints[count]['context']
            check(retained['sourceState'], state, 'prefix.state.' + str(prefix_index))
            check(retained['callerContext'], current_context, 'prefix.context.' + str(prefix_index))
            check(retained['nativeCheckpoint'], {'format': 'native.public_observed_inventory.v1', 'source_state': state, 'caller_context': current_context}, 'prefix.complete.checkpoint.' + str(prefix_index))
            if selected:
                assert prefix['family'] == 'public_observed_inventory'
                candidates = [item for item in offers.get(observations[cursor]['observation_ref'], []) if item['result'] is not None]
                assert candidates
                source_offer = candidates[-1]['result']; extras = set(selected) - set(source_offer)
                assert extras <= shared.WRAPPERS | {'material_access_subquestion'} and not set(source_offer) - set(selected)
                check({key: value for key, value in selected.items() if key not in extras}, source_offer, 'selected.proposal.' + str(prefix_index))
                family.bind(selected, None)
                proposals.append({'prefix': prefix_index, 'sourceCall': candidates[-1]['call'], 'wrapperFields': sorted(extras)})
            else: assert prefix['family'] != 'public_observed_inventory'
            events = {fact['key']: fact for fact in retained['acquired']}; assert len(events) == len(retained['acquired'])
            consumed = set(); first_action = cursor + 1
            for step_index, item in enumerate(retained['transitions']):
                record = records[cursor]; args_record = record['arguments']
                assert through <= record['call'] < count and through <= contexts[cursor]['call'] < count
                check(args_record[5], selected, 'record.proposal.' + str(cursor + 1)); assert args_record[6] == step_index
                assert contexts[cursor]['index'] == step_index
                if selected: check(contexts[cursor]['proposal'], selected, 'collection.selected.proposal.' + str(cursor + 1))
                before, after = observations[cursor:cursor + 2]
                guard = outcome = None
                if selected:
                    packet, following = trace['packets'][cursor]['packet'], trace['packets'][cursor + 1]['packet']
                    guard = family.before(selected, step_index, SimpleNamespace(**packet), before); assert guard['admitted']
                    outcome = family.after(selected, step_index, before, after, packet['frame_rows'], following['frame_rows'])
                    check(item['outcome'], plain(outcome), 'selected.outcome.' + str(cursor + 1)); counts['selectedGuardsRecomputed'] += 1
                key = 'observed_inventory_event:' + str(before['revision']); event = record['result']
                if selected or event is not None:
                    fact = events[key]; consumed.add(key)
                    assert fact['evidence'] == after['observation_ref'] and fact['revision'] == after['revision']
                    check(fact['result'], event, 'source.event.' + str(cursor + 1)); counts['eventFactsCompared'] += 1
                else: assert key not in events
                acquisitions.append({'action': cursor + 1, 'prefix': prefix_index, 'sourceCall': record['call'],
                                     'before': before['observation_ref'], 'after': after['observation_ref'], 'eventSha256': digest(event),
                                     'selected': selected is not None, 'guard': plain(guard), 'outcome': plain(outcome)})
                if before['level_epoch'] != after['level_epoch']: counts['epochChanges'] += 1
                cursor += 1
            assert consumed == set(events)
            prefix_checks.append({'index': prefix_index, 'firstAction': first_action, 'lastAction': cursor, 'sourceCallsThrough': count,
                                  'sourceStateSha256': digest(state), 'callerContextSha256': digest(current_context),
                                  'sourceStateFields': sorted(FIELDS), 'completeCheckpointCompared': True})
            counts['prefixStatesCompared'] += 1; counts['selectedPrefixes' if selected else 'foreignPrefixes'] += 1; through = count
        assert cursor == len(campaign['actions']) and through == len(calls)
    except Exception as error:
        failure = {'type': type(error).__name__, 'message': str(error), 'completedSourceCalls': len(call_checks), 'completedAcquisitions': cursor}
    imported = {}
    for module in list(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if not filename: continue
        path = Path(filename).resolve()
        if path.is_relative_to(shared.SOURCE) and path.is_file():
            name = path.relative_to(shared.SOURCE).as_posix(); assert shared.sha(path) == verified[name]; imported[name] = verified[name]
    assert shared.verify_source() == verified
    result = {'schema': 'logos-engine.v56.observed-inventory-public-source-comparison.v1',
              'status': 'failed' if failure else 'passed', 'referenceCommit': shared.COMMIT, 'game': args.game,
              'nativeSourceDigest': native['digest'], 'campaignStatus': campaign['status'], 'campaignFinal': campaign['final'],
              'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(), 'elapsedSeconds': time.monotonic() - clock,
              'inputs': {name: proof(path) for name, path in paths.items()}, 'generator': proof(Path(__file__)),
              'sharedEvidenceContracts': proof(HELPER), 'sourceFilesVerifiedBeforeAndAfter': len(verified),
              'importedOriginalSourceFiles': dict(sorted(imported.items())), 'completePublicJournalMatched': True,
              'publicPacketsCompared': len(packet_checks), 'animationFramesIncludingInitial': sum(row['frames'] for row in packet_checks),
              'packetChecks': packet_checks, 'coldInitialState': initial, 'coldInitialCallerContext': initial_context,
              'counts': dict(counts), 'sourceCallChecks': call_checks, 'prefixChecks': prefix_checks,
              'acquisitionChecks': acquisitions, 'selectedProposals': proposals, 'finalSourceState': plain(family.state()),
              'finalCallerContext': context(), 'failure': failure,
              'qualification': 'Exact replay from cold original objects of the actual source-facing call order, including losing proposals, preservation queries, passive/selected acquisition and meter/collection context. Every call compares its literal result and complete before/after state; every sealed prefix compares the eight-field source state plus full native context checkpoint. Observations and commands are independently reconstructed from the full actual public journal. Goal-model inputs and foreign proposals are actual common-caller context, not a claim of full original strategic-caller parity. No identifier remapping, tolerance, learned-state seed or expected native action is supplied. This comparison runs after the independent live game campaign and is not another game success.'}
    with output.open('xb') as stream: stream.write(gzip.compress(json.dumps(result, separators=(',', ':'), allow_nan=False).encode(), mtime=0))
    print(json.dumps({'status': result['status'], 'counts': dict(counts), 'publicPackets': len(packet_checks), 'output': str(output.relative_to(ROOT)), 'failure': failure}), flush=True)
    if failure: raise SystemExit(1)


if __name__ == '__main__': main()
