#!/usr/bin/env python3
"""Compare unchanged OrderedReaction with an actual native public trajectory.

This is a component replay, not a game solver or a complete strategic caller.
The command journal and retained source observations are inputs only to this
post-run comparison; they are never supplied to the native campaign.
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
spec = importlib.util.spec_from_file_location('public_evidence_contracts', HELPER)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
load, proof, check, plain = shared.load, shared.proof, shared.check, shared.plain
digest, sha = shared.digest, shared.sha
FIELDS = {'epoch', 'control', 'packets', 'attempts', 'progress', 'history'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('game')
    parser.add_argument('directory', type=Path)
    parser.add_argument('--allow-failed', action='store_true')
    args = parser.parse_args()
    directory = args.directory.resolve()
    stem = args.game.lower()
    output = directory / (stem + '-reaction-original-comparison.json.gz')
    if output.exists(): raise FileExistsError(output)
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

    references = [None] * len(trace['packets'])
    cursor = 0
    for prefix in campaign['prefixes']:
        retained = prefix['reactionAcquisition']
        assert len(retained['transitions']) == prefix['acquiredActions']
        for transition in retained['transitions']:
            for position, side in [(cursor, 'before'), (cursor + 1, 'after')]:
                assert references[position] is None or references[position] == transition[side]
                references[position] = transition[side]
            command = transition['command']
            actual = trace['packets'][cursor + 1]['command']
            check(actual, {'action_ref': command['action_ref'], 'data': command.get('data', {})}, 'command.transport.' + str(cursor + 1))
            check(actual, campaign['actions'][cursor]['command'], 'command.campaign.' + str(cursor + 1))
            cursor += 1
    assert cursor == len(campaign['actions']) and all(references)
    parsed = [shared.OBSERVATION.fullmatch(ref) for ref in references]
    assert all(parsed)
    namespaces = {match.group(1) for match in parsed}
    assert len(namespaces) == 1
    packet_checks = []
    for index, item in enumerate(trace['packets']):
        packet = item['packet']
        assert set(packet) == shared.PUBLIC_FIELDS and packet['step_index'] == index
        assert int(parsed[index].group(2)) == packet['level'] and int(parsed[index].group(3)) == index + 1
        assert parsed[index].group(4) == packet['frame_hash']
        assert packet['frame_hash'] == shared.hashlib.sha256(json.dumps(packet['frame_rows'], separators=(',', ':')).encode()).hexdigest()[:16]
        packet_checks.append({'index': index, 'packetSha256': digest(packet), 'frames': len(packet['frame_packet']), 'observationRef': references[index]})

    verified = shared.verify_source()
    sys.path[:0] = [str(shared.SOURCE), str(shared.SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from neutral_observer import measure
    from agents.yf_arc3_v6.morphology_policy.ordered_reaction.family import OrderedReaction
    observations = [measure(SimpleNamespace(**item['packet']), index + 1, next(iter(namespaces)))[0]
                    for index, item in enumerate(trace['packets'])]
    check([obs['observation_ref'] for obs in observations], references, 'original.observation.references')
    family = OrderedReaction()
    initial = plain(family.state())
    assert set(initial) == FIELDS and all(not initial[key] for key in FIELDS)
    cursor = boundary = 0
    counts = Counter()
    prefix_checks, acquisitions, proposals = [], [], []
    failure = None
    try:
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            retained = prefix['reactionAcquisition']
            assert retained['stateNode'] == 'family_state:public_ordered_reaction'
            assert retained['checkpointFormat'] == 'native.public_ordered_reaction.v1'
            assert prefix['decisionRevision'] == cursor + 1
            selected = None
            if prefix['family'] == 'public_ordered_reaction':
                observation = observations[cursor]
                caps = campaign['budget']['levelActionCaps']
                total = campaign['budget'].get('maxActions', sum(caps))
                remaining = max(0, min(total - cursor, caps[observation['level_epoch'] - 1] - (cursor - boundary)))
                selected = family.propose(observation, trace['packets'][cursor]['packet']['frame_rows'], [], remaining)
                assert selected is not None and prefix['materialSubquestion'] == 'ordered_reaction'
                selected['material_access_subquestion'] = 'ordered_reaction'
                actual = retained['selectedProposal']
                extras = set(actual) - set(selected)
                assert extras <= shared.WRAPPERS and not set(selected) - set(actual)
                check({key: value for key, value in actual.items() if key not in extras}, plain(selected), 'selected.source.proposal.' + str(prefix_index))
                family.bind(selected, None)
                proposals.append({'prefix': prefix_index, 'sourceProposal': plain(selected), 'wrapperFields': sorted(extras),
                                  'wrapperSha256': digest({key: actual[key] for key in sorted(extras)})})
                counts['selectedProposalsCompared'] += 1
            else:
                assert 'selectedProposal' not in retained
            # Unselected propose() has only scope mutation in this original
            # family. record() applies that same scope before every real return.
            # Pure losing offers and strategic ordering are outside this check.
            events = {fact['key']: fact for fact in retained['acquired']}
            assert len(events) == len(retained['acquired'])
            consumed = set()
            first_action = cursor + 1
            for index, transition in enumerate(retained['transitions']):
                first, second = [trace['packets'][position]['packet'] for position in [cursor, cursor + 1]]
                before, after = observations[cursor:cursor + 2]
                command = copy.deepcopy(transition['command'])
                guard = outcome = None
                if selected:
                    check(command, selected['actions'][index], 'selected.command.' + str(cursor + 1))
                    guard = family.before(selected, index, SimpleNamespace(**first), before)
                    assert guard['admitted']
                    outcome = family.after(selected, index, before, after, first['frame_rows'], second['frame_rows'])
                    check(transition['outcome'], plain(outcome), 'selected.outcome.' + str(cursor + 1))
                    if outcome['seal_prefix']: assert index + 1 == prefix['acquiredActions']
                    counts['selectedGuardsRecomputed'] += 1
                event = family.record(before, after, command, first['frame_rows'], second['frame_rows'], selected, index, second['frame_packet'])
                key = 'reaction_event:' + str(before['revision'])
                if selected or event is not None:
                    fact = events[key]
                    consumed.add(key)
                    assert fact['evidence'] == after['observation_ref'] and fact['revision'] == after['revision']
                    check(fact['result'], plain(event), 'source.event.' + str(cursor + 1))
                    counts['eventFactsCompared'] += 1
                else:
                    assert key not in events
                state = plain(family.state())
                acquisitions.append({'action': cursor + 1, 'prefix': prefix_index, 'selected': selected is not None,
                                     'command': command, 'before': before['observation_ref'], 'after': after['observation_ref'],
                                     'event': plain(event), 'guard': plain(guard), 'outcome': plain(outcome),
                                     'sourceStateSha256': digest(state)})
                counts['sourceRecordCalls'] += 1
                if event is not None: counts['event:' + event['status']] += 1
                if before['level_epoch'] != after['level_epoch']: counts['epochChanges'] += 1
                cursor += 1
                if after['levels_completed'] > before['levels_completed']: boundary = cursor
            assert consumed == set(events)
            state = plain(family.state())
            assert set(state) == FIELDS
            check(retained['sourceState'], state, 'complete.six.field.state.' + str(prefix_index))
            check(retained['nativeCheckpoint'], {'format': 'native.public_ordered_reaction.v1', 'source_state': state}, 'complete.checkpoint.' + str(prefix_index))
            prefix_checks.append({'index': prefix_index, 'firstAction': first_action, 'lastAction': cursor,
                                  'selected': selected is not None, 'sourceAndNativeStateSha256': digest(state),
                                  'sourceStateFields': sorted(FIELDS), 'completeCheckpointCompared': True})
            counts['prefixStatesCompared'] += 1
            counts['selectedPrefixes' if selected else 'foreignPrefixes'] += 1
        assert cursor == len(campaign['actions'])
    except Exception as error:
        failure = {'type': type(error).__name__, 'message': str(error), 'completedSourceRecords': cursor}
    imported = {}
    for module in list(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if not filename: continue
        path = Path(filename).resolve()
        if path.is_relative_to(shared.SOURCE) and path.is_file():
            name = path.relative_to(shared.SOURCE).as_posix()
            assert sha(path) == verified[name]
            imported[name] = verified[name]
    assert shared.verify_source() == verified
    result = {'schema': 'logos-engine.v55.ordered-reaction-public-source-comparison.v1',
              'status': 'failed' if failure else 'passed', 'referenceCommit': shared.COMMIT, 'game': args.game,
              'nativeSourceDigest': native['digest'], 'campaignStatus': campaign['status'], 'campaignFinal': campaign['final'],
              'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(), 'elapsedSeconds': time.monotonic() - clock,
              'inputs': {name: proof(path) for name, path in paths.items()}, 'generator': proof(Path(__file__)),
              'sharedEvidenceContracts': proof(HELPER), 'sourceFilesVerifiedBeforeAndAfter': len(verified),
              'importedOriginalSourceFiles': dict(sorted(imported.items())), 'completePublicJournalMatched': True,
              'publicPacketsCompared': len(packet_checks), 'animationFramesIncludingInitial': sum(row['frames'] for row in packet_checks),
              'packetChecks': packet_checks, 'coldInitialState': initial, 'counts': dict(counts),
              'prefixChecks': prefix_checks, 'acquisitionChecks': acquisitions, 'selectedProposals': proposals,
              'finalSourceState': plain(family.state()), 'failure': failure,
              'qualification': 'Exact six-field OrderedReaction source state, complete native checkpoints and actual source events after every sealed prefix. Selected source proposals and outcomes are literal comparisons; source guards are recomputed for compatibility because raw native before guards are not retained. Unselected proposal evaluation changes only source scope, which record() also applies; its pure losing offers and strategic ordering are outside this comparison. No identifier substitution, numeric tolerance, source-state seed or expected native action is used. This is source component evidence, not a new game execution or full original-caller parity.'}
    with output.open('xb') as stream:
        stream.write(gzip.compress(json.dumps(result, separators=(',', ':'), allow_nan=False).encode(), mtime=0))
    print(json.dumps({'status': result['status'], 'counts': dict(counts), 'publicPackets': len(packet_checks),
                      'output': str(output.relative_to(ROOT)), 'failure': failure}), flush=True)
    if failure: raise SystemExit(1)


if __name__ == '__main__':
    main()
