#!/usr/bin/env python3
"""Read-only original ReactiveContact replay of one actual public trajectory.

This does not run a game host, choose future actions, seed native memory, or
claim full original-caller parity. It checks complete source state after every
sealed prefix, exact source events and actual current reactive entry offers.
"""
from __future__ import annotations
import argparse
from collections import Counter
import copy
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile
import time
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
FIELDS = {'epoch', 'control', 'peer', 'floor', 'observations', 'question', 'trials', 'pending', 'recipe', 'last',
          'input_trials', 'source81_plan', 'prepared_source81'}
PUBLIC_FIELDS = {'frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash'}
WRAPPERS = {'composition_target_tree', 'morphology', 'strategy_receipt'}
OBSERVATION = re.compile(r'^(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)$')
sys.dont_write_bytecode = True
CACHE = tempfile.TemporaryDirectory(prefix='reactive-public-source-lookup-')
sys.pycache_prefix = CACHE.name

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
def digest(value): return hashlib.sha256(packed(value)).hexdigest()
def proof(path):
    path = Path(path).resolve()
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def load(path):
    path = Path(path)
    return json.loads(gzip.decompress(path.read_bytes()) if path.suffix == '.gz' else path.read_bytes())
def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value
def check(actual, expected, path):
    if packed(actual) == packed(expected): return
    if isinstance(actual, dict) and isinstance(expected, dict) and set(actual) == set(expected):
        for key in sorted(actual): check(actual[key], expected[key], path + '.' + key)
    elif isinstance(actual, list) and isinstance(expected, list) and len(actual) == len(expected):
        for i, (a, b) in enumerate(zip(actual, expected)): check(a, b, path + '.' + str(i))
    raise AssertionError({'path': path, 'actual': actual, 'original': expected})
def verify_source():
    manifest = load(SOURCE.parent / 'manifest.json')['files']
    for name, entry in manifest.items(): assert sha(SOURCE / name) == entry['sha256'], name
    return {name: entry['sha256'] for name, entry in manifest.items()}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('game'); parser.add_argument('directory', type=Path)
    parser.add_argument('--output', type=Path); parser.add_argument('--allow-failed', action='store_true')
    args = parser.parse_args(); directory = args.directory.resolve(); stem = args.game.lower()
    output = args.output.resolve() if args.output else directory / 'reactive-original-comparison.json.gz'
    if output.exists(): raise FileExistsError(output)
    started = datetime.now(timezone.utc).isoformat(); start = time.monotonic()
    paths = {name: directory / file for name, file in [('campaign', stem + '-campaign.json.gz'),
        ('trace', stem + '-public-trace.json.gz'), ('execution', 'execution-' + stem + '.json'), ('source', 'source-manifest.json')]}
    campaign, trace, execution, native = [load(paths[name]) for name in ['campaign', 'trace', 'execution', 'source']]
    assert campaign['game'] == trace['game'] == args.game
    assert campaign['status'] == trace['status'] and (campaign['status'] == 'passed' or args.allow_failed)
    assert campaign['referenceCommit'] == COMMIT and campaign['pythonAgentModules'] == []
    assert campaign['sourceUnchangedDuringRun'] is True and execution['nativeSourceUnchanged'] is True and execution['executionCodeUnchanged'] is True
    assert native['digest'] == digest(native['files']) and native['fileCount'] == len(native['files'])
    check(campaign['source'], native, 'campaign.frozen_source'); check(execution['nativeSource'], native, 'execution.native_before')
    check(execution['nativeSourceAfter'], native, 'execution.native_after')
    assert trace['sourceDigest'] == execution['nativeSourceManifestDigest'] == native['digest']
    check(execution['executionInputs'], execution['executionInputsAfter'], 'execution.inputs_unchanged')
    check(execution['report'], proof(paths['campaign']), 'execution.campaign_bytes')
    check(execution['trace'], proof(paths['trace']), 'execution.trace_bytes')
    journal_path = ROOT / execution['publicJournal']['path']; check(execution['publicJournal'], proof(journal_path), 'execution.journal_bytes')
    journal = [json.loads(line) for line in gzip.decompress(journal_path.read_bytes()).splitlines()]
    check(journal, trace['packets'], 'complete_actual_public_journal')
    assert campaign['final']['actions'] == len(campaign['actions']) == len(trace['packets']) - 1
    assert campaign['final']['prefixes'] == len(campaign['prefixes'])
    assert sum(prefix['acquiredActions'] for prefix in campaign['prefixes']) == len(campaign['actions'])
    references = [None] * len(trace['packets']); cursor = 0
    for prefix in campaign['prefixes']:
        retained = prefix['reactiveAcquisition']; transitions = retained['transitions']
        assert len(transitions) == prefix['acquiredActions']
        for transition in transitions:
            for index, field in [(cursor, 'before'), (cursor + 1, 'after')]:
                assert references[index] is None or references[index] == transition[field]
                references[index] = transition[field]
            physical = trace['packets'][cursor + 1]['command']; command = transition['command']
            check(physical, {'action_ref': command['action_ref'], 'data': command.get('data', {})}, 'actual.command_transport.' + str(cursor + 1))
            check(physical, campaign['actions'][cursor]['command'], 'actual.campaign_command.' + str(cursor + 1))
            cursor += 1
    assert cursor == len(campaign['actions']) and all(references)
    parsed = [OBSERVATION.fullmatch(ref) for ref in references]; assert all(parsed)
    scopes = {row.group(1) for row in parsed}; assert len(scopes) == 1
    scope = next(iter(scopes)); packet_checks = []
    for index, item in enumerate(trace['packets']):
        packet = item['packet']; assert set(packet) == PUBLIC_FIELDS and packet['step_index'] == index
        assert int(parsed[index].group(2)) == packet['level'] and int(parsed[index].group(3)) == index + 1
        assert parsed[index].group(4) == packet['frame_hash']
        assert packet['frame_hash'] == hashlib.sha256(json.dumps(packet['frame_rows'], separators=(',', ':')).encode()).hexdigest()[:16]
        packet_checks.append({'index': index, 'packetSha256': digest(packet), 'frames': len(packet['frame_packet']), 'observationRef': references[index]})
    verified = verify_source()
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from neutral_observer import measure
    from agents.yf_arc3_v6.morphology_policy.reactive_contact.family import ReactiveContact
    config = load(SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm')['declarations'][0]['configuration']
    order = config['factored_material_return']['ordered_subquestions']; policy = config['reactive_contact_continuation']
    observations = [measure(SimpleNamespace(**item['packet']), index + 1, scope)[0] for index, item in enumerate(trace['packets'])]
    check([obs['observation_ref'] for obs in observations], references, 'unchanged_original_observation_references')
    family = ReactiveContact(); initial = plain(family.state()); assert set(initial) == FIELDS
    assert all(not initial[k] for k in FIELDS)
    counts = Counter(); acquisitions = []; prefixes = []; proposals = []; planning = []
    cursor = boundary = 0; failure = None
    try:
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            if prefix_index % 10 == 0: print(json.dumps({'phase': 'original_reactive_replay', 'prefix': prefix_index, 'returns': cursor}), file=sys.stderr, flush=True)
            retained = prefix['reactiveAcquisition']; assert retained['stateNode'] == 'family_state:public_reactive_contact'
            assert retained['checkpointFormat'] == 'native.public_reactive_contact.v1'
            assert prefix['decisionRevision'] == cursor + 1
            observation = observations[cursor]; packet = trace['packets'][cursor]['packet']; selected = None
            caps = campaign['budget']['levelActionCaps']; total = campaign['budget'].get('maxActions', sum(caps))
            remaining = max(0, min(total - cursor, caps[observation['level_epoch'] - 1] - (cursor - boundary)))
            selection = retained.get('selectionReceipt')
            if selection is None:
                # The passive-only comparison is valid when source order stops
                # before material. Never guess a losing family's mutable calls.
                selected_group = prefix['selectionGroup']
                assert config['families'].index(selected_group) < config['families'].index('factored_material_return'), 'Missing actual selection receipt for material planning'
                visited = []
            else:
                visited = selection['visited']; assert selection['selected'] == prefix['selectionGroup']
                assert not selection.get('native_coordination'), 'Native coordination planning not qualified by this source-entry replay'
            if 'factored_material_return' in visited:
                last = order.index(prefix['materialSubquestion']) if prefix['selectionGroup'] == 'factored_material_return' else len(order) - 1
                for entry in ['reactive_contact_continuation', 'reactive_contact']:
                    if order.index(entry) > last: continue
                    called = entry == 'reactive_contact' or bool(family.pending or family.recipe or family.source81_plan or family.prepared_source81)
                    proposal = family.propose(observation, packet['frame_rows'], [], remaining) if called else None
                    if proposal and entry == 'reactive_contact_continuation':
                        offer = proposal['reactive_plan']['offer']
                        if offer['kind'] not in policy['kinds'] or not family.policy.holds(policy['conditions'], offer['facts']): proposal = None
                        else: proposal['retained_dependency_continuation'] = {'reason': policy['meaning'], 'parent': offer['parent']['id'], 'evidence': offer['evidence'], 'scope': observation['level_epoch']}
                    if proposal: proposal['material_access_subquestion'] = entry
                    planning.append({'prefix': prefix_index, 'entry': entry, 'called': called, 'proposalPresent': proposal is not None})
                    if called: counts['sourcePlanningCalls'] += 1
                    if proposal:
                        assert prefix['family'] == 'public_reactive_contact' and prefix['materialSubquestion'] == entry, 'Original reactive entry would have selected a different prefix'
                        actual = retained['selectedProposal']; extras = set(actual) - set(proposal)
                        assert extras <= WRAPPERS and not set(proposal) - set(actual)
                        check({k: v for k, v in actual.items() if k not in extras}, plain(proposal), 'selected.source_proposal.' + str(prefix_index))
                        selected = proposal; family.bind(selected, None)
                        proposals.append({'prefix': prefix_index, 'entry': entry, 'sourceProposal': plain(selected), 'wrapperFields': sorted(extras),
                            'wrapperSha256': digest({k: actual[k] for k in sorted(extras)}), 'allSourceFieldsCompared': True}); break
            if prefix['family'] == 'public_reactive_contact': assert selected is not None
            else: assert 'selectedProposal' not in retained
            event_facts = {fact['key']: fact for fact in retained['acquired']}; assert len(event_facts) == len(retained['acquired'])
            consumed = set(); first_action = cursor + 1
            for index, transition in enumerate(retained['transitions']):
                first, second = [trace['packets'][i]['packet'] for i in [cursor, cursor + 1]]
                before, after = observations[cursor:cursor + 2]; command = copy.deepcopy(transition['command'])
                guard = outcome = None
                if selected:
                    check(command, selected['actions'][index], 'selected.exact_command.' + str(cursor + 1))
                    guard = family.before(selected, index, SimpleNamespace(**first), before); assert guard['admitted']
                    outcome = family.after(selected, index, before, after, first['frame_rows'], second['frame_rows'])
                    check(transition['outcome'], plain(outcome), 'selected.actual_outcome.' + str(cursor + 1))
                    if outcome['seal_prefix']: assert index + 1 == prefix['acquiredActions']
                    counts['sourceSelectedGuards'] += 1
                event = family.record(before, after, command, first['frame_rows'], second['frame_rows'], selected, index, second['frame_packet'])
                fact_key = 'reactive_event:' + str(before['revision'])
                if selected or event is not None:
                    fact = event_facts[fact_key]; consumed.add(fact_key)
                    assert fact['evidence'] == after['observation_ref'] and fact['revision'] == after['revision']
                    check(fact['result'], plain(event), 'acquisition.event.' + str(cursor + 1)); counts['acquiredFactsCompared'] += 1
                else: assert fact_key not in event_facts
                acquisitions.append({'action': cursor + 1, 'prefix': prefix_index, 'selected': selected is not None,
                    'actualSourceCommand': command, 'before': before['observation_ref'], 'after': after['observation_ref'],
                    'sourceEvent': plain(event), 'sourceGuard': plain(guard), 'sourceOutcome': plain(outcome), 'sourceStateSha256': digest(plain(family.state()))})
                counts['sourceRecordCalls'] += 1
                if event is not None: counts['event:' + event['status']] += 1
                cursor += 1
                if after['level_epoch'] != before['level_epoch']: counts['epochResets'] += 1
                if after['levels_completed'] > before['levels_completed']: boundary = cursor
            assert consumed == set(event_facts)
            source_state = plain(family.state()); assert set(source_state) == FIELDS
            check(retained['sourceState'], source_state, 'complete13field.source_state.' + str(prefix_index))
            check(retained['nativeCheckpoint'], {'format': 'native.public_reactive_contact.v1', 'source_state': source_state}, 'complete.native_checkpoint.' + str(prefix_index))
            prefixes.append({'index': prefix_index, 'firstAction': first_action, 'lastAction': cursor, 'selected': selected is not None,
                'sourceAndNativeStateSha256': digest(source_state), 'sourceStateFields': sorted(FIELDS), 'completeCheckpointCompared': True})
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
        if path.is_relative_to(SOURCE) and path.is_file():
            name = path.relative_to(SOURCE).as_posix(); assert sha(path) == verified[name]; imported[name] = verified[name]
    assert verify_source() == verified
    result = {'schema': 'logos-engine.v54.reactive-public-source-comparison.v1', 'status': 'failed' if failure else 'passed',
        'referenceCommit': COMMIT, 'game': args.game, 'campaignStatus': campaign['status'], 'campaignFinal': campaign['final'],
        'nativeSourceDigest': native['digest'], 'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(),
        'elapsedSeconds': time.monotonic() - start, 'inputs': {name: proof(path) for name, path in paths.items()},
        'generator': proof(Path(__file__)), 'sourceFilesVerifiedBeforeAndAfter': len(verified), 'importedOriginalSourceFiles': dict(sorted(imported.items())),
        'completePublicJournalMatched': True, 'publicPacketsCompared': len(packet_checks), 'animationFramesIncludingInitial': sum(p['frames'] for p in packet_checks),
        'packetChecks': packet_checks, 'coldInitialState': initial, 'counts': dict(counts), 'planningChecks': planning,
        'prefixChecks': prefixes, 'acquisitionChecks': acquisitions, 'selectedProposals': proposals, 'finalSourceState': plain(family.state()),
        'failure': failure, 'qualification': 'Exact thirteen-field ReactiveContact source-state and complete native-checkpoint comparison after each actual sealed prefix, recomputed from one empty unchanged Python owner and complete public packets. Source event values, actual component command shapes and current selected source proposals are compared without identity substitution or receipt-field normalization. Earlier-family selection excludes reactive planning by the original declared group order; retained actual selection receipts qualify evaluated material entries. Selected source guards are recomputed for compatibility, not compared against absent raw native before guards. This is component/passive-acquisition evidence, not a new game execution, cold native seed, full strategic caller comparison, complete V5 transfer, or attribution of another provider\'s game success to ReactiveContact.'}
    with output.open('xb') as stream: stream.write(gzip.compress(json.dumps(result, separators=(',', ':'), allow_nan=False).encode(), mtime=0))
    print(json.dumps({'status': result['status'], 'counts': dict(counts), 'publicPackets': len(packet_checks), 'output': str(output.relative_to(ROOT)), 'failure': failure}))
    if failure: raise SystemExit(1)

if __name__ == '__main__': main()
