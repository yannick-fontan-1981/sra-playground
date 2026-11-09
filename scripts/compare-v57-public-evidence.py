#!/usr/bin/env python3
"""Compare actual V57 Recolor and Motion calls with unchanged original source.

This reads a completed public campaign. It neither runs a game nor supplies
actions, observations, learned state, history or source results to native code.
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
spec = importlib.util.spec_from_file_location('v57_public_contracts', HELPER)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
load, proof, check, plain, digest = shared.load, shared.proof, shared.check, shared.plain, shared.digest
RECOLOR_FIELDS = {'epoch', 'selection', 'writes', 'attempts', 'portable', 'last'}
SNAPSHOT_FIELDS = {'rows', 'roles', 'epoch', 'score', 'ref', 'frame_hash'}
FORMAT = 'native.public_topological_recolor.v1'


def snapshot_value(snapshot):
    """The source snapshot uses immutable bytes; JSON preserves every pixel."""
    return {'rows': [list(row) for row in snapshot.rows], 'roles': plain(snapshot.roles),
            'epoch': snapshot.epoch, 'score': snapshot.score, 'ref': snapshot.ref,
            'frame_hash': snapshot.frame_hash}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('game')
    parser.add_argument('directory', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--allow-failed', action='store_true')
    args = parser.parse_args()
    directory = args.directory.resolve()
    stem = args.game.lower()
    output = args.output.resolve() if args.output else directory / (stem + '-v57-original-comparison.json.gz')
    if output.exists():
        raise FileExistsError(output)
    started = datetime.now(timezone.utc).isoformat()
    clock = time.monotonic()
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

    # References come from actual sealed transitions, independently checked
    # against the passive transport journal and the campaign action sequence.
    references = [None] * len(trace['packets'])
    cursor = 0
    for prefix in campaign['prefixes']:
        retained = prefix['recolorAcquisition']
        assert len(retained['transitions']) == prefix['acquiredActions']
        for transition in retained['transitions']:
            for position, side in [(cursor, 'before'), (cursor + 1, 'after')]:
                assert references[position] is None or references[position] == transition[side]
                references[position] = transition[side]
            command = transition['command']
            actual = trace['packets'][cursor + 1]['command']
            check(actual, {'action_ref': command['action_ref'], 'data': command.get('data', {})},
                  'command.transport.' + str(cursor + 1))
            check(actual, campaign['actions'][cursor]['command'], 'command.campaign.' + str(cursor + 1))
            cursor += 1
    assert cursor == len(campaign['actions']) and all(references)
    parsed = [shared.OBSERVATION.fullmatch(ref) for ref in references]
    assert all(parsed) and len({match.group(1) for match in parsed}) == 1
    namespace = parsed[0].group(1)
    packet_checks = []
    for index, item in enumerate(trace['packets']):
        packet = item['packet']
        assert set(packet) == shared.PUBLIC_FIELDS and packet['step_index'] == index
        assert int(parsed[index].group(2)) == packet['level'] and int(parsed[index].group(3)) == index + 1
        assert parsed[index].group(4) == packet['frame_hash']
        frame_hash = shared.hashlib.sha256(json.dumps(packet['frame_rows'], separators=(',', ':')).encode()).hexdigest()[:16]
        assert packet['frame_hash'] == frame_hash
        packet_checks.append({'index': index, 'packetSha256': digest(packet),
                              'frames': len(packet['frame_packet']), 'observationRef': references[index]})

    verified = shared.verify_source()
    sys.path[:0] = [str(shared.SOURCE), str(shared.SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from neutral_observer import measure
    from terminal_composition import Snapshot, identity
    from agents.yf_arc3_v6.morphology_policy.topological_recolor.family import TopologicalRecolor
    from agents.yf_arc3_v6.morphology_policy.motion_contrast import motion_offers

    observations = [measure(SimpleNamespace(**item['packet']), index + 1, namespace)[0]
                    for index, item in enumerate(trace['packets'])]
    check([obs['observation_ref'] for obs in observations], references, 'original.observation.references')
    by_ref = {obs['observation_ref']: index for index, obs in enumerate(observations)}
    snapshots = [Snapshot.from_public(obs, item['packet']['frame_rows'])
                 for obs, item in zip(observations, trace['packets'])]

    def public_observation(value, rows, label):
        index = by_ref[value['observation_ref']]
        check(value, plain(observations[index]), label + '.observation')
        check(rows, trace['packets'][index]['packet']['frame_rows'], label + '.rows')
        return index

    def transition(arguments, label):
        before, after, command, first, second = arguments[:5]
        index = public_observation(before, first, label + '.before')
        assert public_observation(after, second, label + '.after') == index + 1
        check({'action_ref': command['action_ref'], 'data': command.get('data', {})},
              trace['packets'][index + 1]['command'], label + '.command')
        return index

    # Match the original GoalAccessMemory episode boundary rule exactly.
    # Addressed commands remain addressed identities, never inferred controls.
    histories = [[]]
    active = []
    for index, item in enumerate(trace['packets'][1:]):
        before, after = snapshots[index:index + 2]
        command = item['command']
        key = 'addressed:' + identity(command) if command.get('data') else command['action_ref']
        active.append((before, key, after))
        if after.epoch != before.epoch or after.score > before.score:
            active = []
        histories.append(list(active))

    family = TopologicalRecolor()
    initial = plain(family.state())
    assert set(initial) == RECOLOR_FIELDS and all(not value for value in initial.values())
    checkpoints = {0: initial}
    counts = Counter()
    recolor_checks, motion_checks, prefix_checks, acquisitions, selected_checks = [], [], [], [], []
    records, offers = {}, {}
    failure = None
    cursor = 0
    try:
        calls = campaign['recolorSourceCalls']
        for index, call in enumerate(calls):
            assert call['index'] == index and 'error' not in call
            label = 'recolor.call.' + str(index)
            method, arguments = call['method'], copy.deepcopy(call['arguments'])
            check(call['sourceBefore'], plain(family.state()), label + '.state.before')
            if method == 'proposeSource':
                assert len(arguments) == 4
                obs, rows, inputs, remaining = arguments
                public_observation(obs, rows, label)
                result = family.propose(obs, rows, inputs, remaining)
                offers.setdefault(obs['observation_ref'], []).append({'call': index, 'result': plain(result)})
                counts['recolorNonNullOffers' if result is not None else 'recolorAbstentions'] += 1
            elif method == 'recordSource':
                assert len(arguments) == 7
                position = transition(arguments, label)
                assert position not in records
                before, after, command, first, second, proposal, step_index = arguments
                assert proposal and proposal.get('recolor_plan'), 'Recolor must not acquire foreign returns'
                family.bind(proposal, None)
                guard = family.before(proposal, step_index,
                                      SimpleNamespace(**trace['packets'][position]['packet']), before)
                assert guard['admitted']
                outcome = family.after(proposal, step_index, before, after, first, second)
                result = family.record(*arguments)
                records[position] = {'call': index, 'arguments': arguments, 'result': plain(result),
                                     'guard': plain(guard), 'outcome': plain(outcome)}
                counts['recolorSelectedGuardsRecomputed'] += 1
            else:
                raise AssertionError('Unexpected Recolor source surface: ' + method)
            check(call['result'], plain(result), label + '.result')
            state = plain(family.state())
            assert set(state) == RECOLOR_FIELDS
            check(call['sourceAfter'], state, label + '.state.after')
            checkpoints[index + 1] = state
            recolor_checks.append({'index': index, 'method': method,
                                   'resultSha256': digest(plain(result)), 'sourceStateSha256': digest(state)})
            counts['recolor.' + method] += 1

        motion_calls = campaign['motionSourceCalls']
        motion_snapshots = campaign['motionSnapshots']
        assert isinstance(motion_snapshots, dict)
        referenced_snapshots = set()
        for ref, value in motion_snapshots.items():
            assert ref in by_ref and set(value) == SNAPSHOT_FIELDS and value['ref'] == ref
            check(value, snapshot_value(snapshots[by_ref[ref]]), 'motion.snapshot.from.public.' + ref)
        counts['motionUniqueSnapshotsCompared'] = len(motion_snapshots)
        for index, call in enumerate(motion_calls):
            assert call['index'] == index and 'error' not in call
            label = 'motion.call.' + str(index)
            arguments = copy.deepcopy(call['arguments'])
            assert len(arguments) == 5
            obs, rows, inputs, remaining, meter = arguments
            position = public_observation(obs, rows, label)
            current, history = snapshots[position], histories[position]
            assert isinstance(call['current'], str) and call['current'] in motion_snapshots
            assert call['current'] == current.ref
            referenced_snapshots.add(call['current'])
            expected_history = [[snapshot_value(before), command, snapshot_value(after)]
                                for before, command, after in history]
            expected_history_refs = [[before.ref, command, after.ref] for before, command, after in history]
            check(call['history'], expected_history_refs, label + '.complete.episode.refs.from.public')
            resolved_history = []
            for before_ref, command, after_ref in call['history']:
                assert before_ref in motion_snapshots and after_ref in motion_snapshots
                referenced_snapshots.update([before_ref, after_ref])
                resolved_history.append([motion_snapshots[before_ref], command, motion_snapshots[after_ref]])
            check(resolved_history, expected_history, label + '.complete.episode.from.public')
            scope = {'actions': inputs, 'remaining_actions': remaining,
                     'remaining_meter_steps': meter['steps_before_empty'] if meter else None,
                     'preserve_cells': obs.get('preserve_cells', [])}
            source = motion_offers(history, current, scope, obs)
            result = [{**candidate, 'source': 'motion_contrast'} for candidate in source]
            check(call['result'], plain(result), label + '.result')
            counts['motionCalls'] += 1
            counts['motionNonEmptyCalls' if result else 'motionAbstentions'] += 1
            counts['motionOffers'] += len(result)
            counts['motionHistoryTransitionsCompared'] += len(history)
            motion_checks.append({'index': index, 'publicPacketIndex': position,
                                  'historyTransitions': len(history), 'historySha256': digest(expected_history),
                                  'currentSha256': digest(snapshot_value(current)), 'scopeSha256': digest(plain(scope)),
                                  'offers': len(result), 'resultSha256': digest(plain(result))})
        assert referenced_snapshots == set(motion_snapshots), 'Orphan or missing actual Motion snapshot'

        through = motion_through = 0
        consumed_records = set()
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            retained = prefix['recolorAcquisition']
            selected = retained.get('selectedProposal')
            assert retained['stateNode'] == 'family_state:public_topological_recolor'
            assert retained['checkpointFormat'] == FORMAT
            assert prefix['decisionRevision'] == cursor + 1
            count = retained['sourceCallsThrough']
            assert through <= count <= len(calls)
            state = checkpoints[count]
            check(retained['sourceState'], state, 'prefix.recolor.state.' + str(prefix_index))
            check(retained['nativeCheckpoint'], {'format': FORMAT, 'source_state': state},
                  'prefix.recolor.complete.checkpoint.' + str(prefix_index))
            if selected:
                assert prefix['family'] == 'public_topological_recolor'
                candidates = [item for item in offers.get(observations[cursor]['observation_ref'], [])
                              if item['result'] is not None and through <= item['call'] < count]
                assert candidates
                source_offer = candidates[-1]['result']
                extras = set(selected) - set(source_offer)
                assert extras <= shared.WRAPPERS | {'material_access_subquestion'}
                assert not set(source_offer) - set(selected)
                check({key: value for key, value in selected.items() if key not in extras}, source_offer,
                      'selected.recolor.proposal.' + str(prefix_index))
                selected_checks.append({'prefix': prefix_index, 'sourceCall': candidates[-1]['call'],
                                        'wrapperFields': sorted(extras)})
            else:
                assert prefix['family'] != 'public_topological_recolor'
            events = {fact['key']: fact for fact in retained['acquired']}
            assert len(events) == len(retained['acquired'])
            consumed_events = set()
            first_action = cursor + 1
            for step_index, item in enumerate(retained['transitions']):
                before, after = observations[cursor:cursor + 2]
                key = 'topological_recolor_event:' + str(before['revision'])
                if selected:
                    record = records[cursor]
                    assert through <= record['call'] < count
                    check(record['arguments'][5], selected, 'record.recolor.proposal.' + str(cursor + 1))
                    assert record['arguments'][6] == step_index
                    check(item['outcome'], record['outcome'], 'selected.recolor.outcome.' + str(cursor + 1))
                    fact = events[key]
                    assert fact['evidence'] == after['observation_ref'] and fact['revision'] == after['revision']
                    check(fact['result'], record['result'], 'source.recolor.event.' + str(cursor + 1))
                    consumed_records.add(cursor)
                    consumed_events.add(key)
                    acquisitions.append({'action': cursor + 1, 'prefix': prefix_index,
                                         'sourceCall': record['call'], 'eventSha256': digest(record['result']),
                                         'guard': record['guard'], 'outcome': record['outcome']})
                    counts['recolorEventFactsCompared'] += 1
                else:
                    assert cursor not in records and key not in events
                    counts['foreignActionsWithoutRecolorAcquisition'] += 1
                cursor += 1
            assert consumed_events == set(events)
            motion_count = prefix['motionSourceCallsThrough']
            assert motion_through <= motion_count <= len(motion_calls)
            for call in motion_calls[motion_through:motion_count]:
                position = by_ref[call['arguments'][0]['observation_ref']]
                assert first_action - 1 <= position < cursor
            information = prefix.get('informationGoal')
            if information and information.get('source') == 'motion_contrast':
                candidates = [result for call in motion_calls[motion_through:motion_count]
                              for result in call['result'] if result['observation_ref'] == references[first_action - 1]]
                assert any(all(information.get(k) == v for k, v in candidate.items()) for candidate in candidates)
                counts['selectedMotionPrefixes'] += 1
            prefix_checks.append({'index': prefix_index, 'firstAction': first_action, 'lastAction': cursor,
                                  'recolorCallsThrough': count, 'motionCallsThrough': motion_count,
                                  'sourceStateSha256': digest(state), 'sourceStateFields': sorted(RECOLOR_FIELDS),
                                  'completeCheckpointCompared': True, 'selectedRecolor': selected is not None})
            counts['prefixStatesCompared'] += 1
            counts['selectedRecolorPrefixes' if selected else 'foreignPrefixes'] += 1
            through, motion_through = count, motion_count
        assert cursor == len(campaign['actions'])
        assert through == len(calls) and motion_through == len(motion_calls)
        assert consumed_records == set(records)
    except Exception as error:
        failure = {'type': type(error).__name__, 'message': str(error),
                   'completedRecolorCalls': len(recolor_checks), 'completedMotionCalls': len(motion_checks),
                   'completedPhysicalActions': cursor}

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
        'schema': 'logos-engine.v57.recolor-motion-public-source-comparison.v1',
        'status': 'failed' if failure else 'passed', 'referenceCommit': shared.COMMIT, 'game': args.game,
        'nativeSourceDigest': native['digest'], 'campaignStatus': campaign['status'], 'campaignFinal': campaign['final'],
        'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(),
        'elapsedSeconds': time.monotonic() - clock,
        'inputs': {name: proof(path) for name, path in paths.items()}, 'generator': proof(Path(__file__)),
        'sharedEvidenceContracts': proof(HELPER), 'sourceFilesVerifiedBeforeAndAfter': len(verified),
        'importedOriginalSourceFiles': dict(sorted(imported.items())), 'completePublicJournalMatched': True,
        'publicPacketsCompared': len(packet_checks),
        'animationFramesIncludingInitial': sum(row['frames'] for row in packet_checks),
        'packetChecks': packet_checks, 'coldInitialRecolorState': initial, 'counts': dict(counts),
        'recolorSourceCallChecks': recolor_checks, 'motionSourceCallChecks': motion_checks,
        'prefixChecks': prefix_checks, 'recolorAcquisitionChecks': acquisitions,
        'selectedRecolorProposals': selected_checks, 'finalRecolorState': plain(family.state()), 'failure': failure,
        'qualification': 'Post-execution comparison only. Every actual Recolor source call is replayed in order from one cold unchanged original owner, including losing proposals and their state changes. Complete six-field states and native checkpoints are compared at every sealed prefix. Foreign physical actions must not become Recolor acquisition. Every actual Motion call compares the exact original function result; its current snapshot and complete episode are reconstructed from neutral_observer, Snapshot.from_public and the actual public command journal, retaining addressed-command identity and original epoch/score resets. Meter, budget and current input scope are the actual caller arguments, not a claim of complete original strategic-caller equivalence. No game implementation, manual solution, injected native state, remapping, tolerance or expected action enters the live campaign. Abstentions on a successful trajectory establish refusal agreement, not a causal contribution to success.'
    }
    with output.open('xb') as stream:
        stream.write(gzip.compress(json.dumps(result, separators=(',', ':'), allow_nan=False).encode(), mtime=0))
    print(json.dumps({'status': result['status'], 'counts': dict(counts),
                      'publicPackets': len(packet_checks), 'output': str(output.relative_to(ROOT)),
                      'failure': failure}), flush=True)
    if failure:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
