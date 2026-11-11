#!/usr/bin/env python3
"""Build explicitly synthetic evidence and qualify the independent presence reader.

No provider, original agent, game, replay host or project test harness is imported.
These fabricated observations test the evidence reader; they are not a runtime proof.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('selected_rigid_presence', ROOT / 'scripts/verify-selected-rigid-presence.py')
READER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(READER)


def encoded(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()


def sha(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def fixture():
    config = {'compose': 'synthetic conditional body question', 'control': 'synthetic input discrimination', 'scope': 'reader qualification only'}
    state = {'format': READER.FORMAT, 'events': []}
    context = {'configuration': config, 'requestedStopReason': None,
               'levelDeadlineMs': None, 'remainingLevelActions': None, 'observedNowMs': None}
    execution = {'deadlineMs': 1000, 'remainingLevelActions': 100,
                 'hasNow': True, 'hasYieldControl': True, 'hasSignal': True, 'aborted': False}
    events, prefixes, actions = [], [], []
    scene = {'geometry': {'q': 6, 'origin': [0, 0], 'size': [4, 4], 'frame_color': 8},
             'bodies': [{'key': str(i + 1), 'color': i + 1, 'position': [i, 0], 'mask': [[0, 0]]} for i in range(3)],
             'receptacle': {'key': '1', 'position': [0, 4], 'mask': [[0, 0]]}}
    models = [{'ACTION1': [0, -1], 'ACTION2': [0, 1], 'ACTION3': [-1, 0], 'ACTION4': [1, 0]}]
    refs = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION6']

    def obs(revision, epoch=1, completed=0):
        rows = [[revision]]
        frame = sha(rows)[:16]
        return {'revision': revision, 'level_epoch': epoch, 'levels_completed': completed,
                'frame_hash': frame, 'state': 'NOT_FINISHED', 'available_action_refs': refs,
                'observation_ref': f'SYN6B:epoch:{epoch}:revision:{revision}:frame:{frame}', 'entities': []}, rows

    def call(method, arguments, result=None, result_kind='undefined', depth=0, after_state=None,
             after_context=None, clocks=None, supplied_execution=None):
        nonlocal state, context
        event = {'sequence': len(events), 'kind': 'restore' if method.startswith('restore') else 'budget' if method == 'setCurrentBudget' else 'call',
                 'method': method, 'depthBefore': depth, 'depthAfter': depth, 'arguments': deepcopy(arguments),
                 'execution': deepcopy(supplied_execution), 'domainSupplied': True if method == 'bind' else None,
                 'sourceBefore': deepcopy(state), 'sourceAfter': deepcopy(after_state if after_state is not None else state),
                 'contextBefore': deepcopy(context), 'contextAfter': deepcopy(after_context if after_context is not None else context),
                 'completion': 'returned', 'returnedNormally': True, 'returnMode': 'sync',
                 'resultKind': result_kind, 'result': deepcopy(result), 'observationErrors': [], 'clockReads': clocks or []}
        events.append(event)
        state = deepcopy(event['sourceAfter']); context = deepcopy(event['contextAfter'])
        return event

    def budget(depth=0):
        updated = {**context, 'levelDeadlineMs': 1000, 'remainingLevelActions': 100, 'observedNowMs': None}
        return call('setCurrentBudget', [execution, 100], depth=depth, after_context=updated)

    def native():
        return {'schema': READER.NATIVE_SCHEMA, **deepcopy(state)}

    def source_proposal(before, rows, action, mode):
        local = {'epoch': before['level_epoch'], 'scene': scene, 'active': None if mode == 'select' else 0,
                 'evidence': [before['observation_ref']], 'tried': []}
        poses = [[i, 0] for i in range(3)]
        plan = {'scene': scene, 'state': local, 'models': models, 'commands': [action],
                'expected': [poses], 'before_states': [poses], 'active': 0, 'epoch': before['level_epoch'],
                'score': before['levels_completed'], 'observation_ref': before['observation_ref'],
                'frame_digest': sha(rows), 'mode': mode, 'why': config['compose'], 'search_nodes': 1}
        identity = hashlib.sha256(json.dumps(plan, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        return {'status': 'proposed', 'kind': READER.OWNER, 'proposal_id': 'selected-rigid:' + identity,
                'selected_rigid_plan': plan, 'actions': [action], 'steps': [{'action': action, 'expected_after': None}],
                'bundle_template': {'actions': [action]}}

    def selected(number, boundary=False):
        nonlocal context
        before, rows = obs(number)
        after, later = obs(number + 1, 2 if boundary else 1, 1 if boundary else 0)
        action = {'action_ref': 'ACTION2'} if boundary else {'action_ref': 'ACTION6', 'data': {'x': 0, 'y': 0}}
        core = source_proposal(before, rows, action, 'path' if boundary else 'select')
        proposal = {**deepcopy(core), 'strategy_receipt': {'selected': 'goal_access', 'workflow': 'v6.composition_strategy.choose'}, 'morphology': {}}
        budget()
        parent = call('propose', [before, rows, [], 100], core, 'value', supplied_execution=execution)
        budget(1)
        context = {**context, 'observedNowMs': number * 10}
        parent['contextAfter'] = deepcopy(context); parent['clockReads'] = [number * 10]
        call('bind', [proposal])
        budget()
        public = {'frame_rows': rows, 'frame_packet': [rows], 'level': 1, 'levels_completed': 0,
                  'state': 'NOT_FINISHED', 'step_index': number - 1, 'available_action_refs': refs, 'frame_hash': before['frame_hash']}
        parent = call('before', [proposal, 0, public, before], {'admitted': True, 'reason': 'synthetic_guard'}, 'value')
        call('bind', [proposal], depth=1)
        context = {**context, 'observedNowMs': number * 10 + 1}
        parent['contextAfter'] = deepcopy(context); parent['clockReads'] = [number * 10 + 1]
        outcome = {'matched': None if boundary else True, 'seal_prefix': True, 'reason': 'boundary' if boundary else 'synthetic_projection'}
        call('after', [proposal, 0, before, after, rows, later], outcome, 'value')
        result = None
        next_state = deepcopy(state)
        if not boundary:
            local = deepcopy(core['selected_rigid_plan']['state']); local['active'] = 0
            local['evidence'] += [before['observation_ref'], after['observation_ref']]
            acquired = {'kind': 'observed_selected_rigid', 'state': local, 'models': models,
                        'detail': {'before': before['observation_ref'], 'after': after['observation_ref'], 'command': action,
                                   'prior_model_count': 1, 'role_status': 'selected_receiver_hypothesis',
                                   'compatible_model_count': 1, 'selection_pixels_changed': True}}
            result = {'events': [acquired], 'scope': READER.SOURCE_SCOPE}
            next_state['events'].append(acquired)
        call('record', [before, after, action, rows, later, proposal, 0, [later]], result,
             'null' if result is None else 'value', after_state=next_state)
        call('restoreSourceState', [state]); call('restoreNative', [native()])
        finish(number, before, after, later, action, READER.OWNER, proposal, outcome, result)

    def finish(number, before, after, later, action, family, proposal, outcome, result):
        packet = {'frame_rows': later, 'frame_packet': [later], 'level': after['level_epoch'],
                  'levels_completed': after['levels_completed'], 'state': after['state'], 'step_index': number,
                  'available_action_refs': refs, 'frame_hash': after['frame_hash']}
        actions.append({'sequence': number, 'family': family, 'decisionRevision': number, 'actionIndex': 0,
                        'command': {'action_ref': action['action_ref'], 'data': action.get('data', {})},
                        'levelBefore': before['level_epoch'], 'levelAfter': after['level_epoch'],
                        'completedBefore': before['levels_completed'], 'completedAfter': after['levels_completed'],
                        'animationFrames': 1, 'frameHash': after['frame_hash'], 'publicPacketSha256': sha(packet), 'state': after['state']})
        transition = {'command': action, 'before': before['observation_ref'], 'after': after['observation_ref'], 'outcome': outcome}
        prefixes.append({'id': f'synthetic-prefix-{number}', 'decisionRevision': number, 'acquiredActions': 1,
                         'family': family, 'proposalKind': READER.OWNER if proposal else 'synthetic_foreign',
                         'selectionGroup': 'goal_access' if proposal else 'synthetic_foreign', 'callerAcquiredTransitions': number,
                         'selectedRigid': {'stateNode': 'family_state:selected_rigid', 'state': native(),
                            'eventsThrough': len(events), 'instanceSourceState': deepcopy(state), 'instanceContext': deepcopy(context),
                            'proposal': deepcopy(proposal), 'transitions': [transition],
                            'acquired': [{'key': f'selected_rigid_event:{number}', 'evidence': after['observation_ref'],
                                          'revision': number + 1, 'result': deepcopy(result)}] if proposal else [],
                            'retainedSourceFact': {'episode': 'common-observation-frontier', 'key': 'selected_rigid_state',
                                'value': deepcopy(state), 'evidence': after['observation_ref'], 'revision': number + 1}}})

    selected(1)
    before, rows = obs(2); after, later = obs(3)
    call('propose', [before, rows, [], 99], None, 'null', after_context={**context, 'observedNowMs': 20}, clocks=[20])
    call('restoreSourceState', [state]); call('restoreNative', [native()])
    finish(2, before, after, later, {'action_ref': 'ACTION1'}, 'synthetic_foreign', None,
           {'matched': None, 'seal_prefix': True, 'reason': 'synthetic_foreign'}, None)
    selected(3, boundary=True)
    files = {'synthetic/reader-only-fixture': '0' * 64}
    return {'schema': 'logos-engine.v6.recorded-public-regression.v1', 'status': 'passed', 'failure': None,
            'game': 'SYN6B', 'syntheticQualification': 'Fabricated reader-only evidence, not a native campaign, original oracle or game execution.',
            'referenceCommit': READER.PIN, 'sourceUnchangedDuringRun': True,
            'source': {'files': files, 'fileCount': 1, 'digest': READER.digest(files)},
            'selectedRigidCapture': {'schema': 'logos-engine.selected-rigid-passive-capture.v1',
                'methods': ['setCurrentBudget', 'propose', 'bind', 'before', 'after', 'record', 'restoreNative', 'restoreSourceState'],
                'clockObserverAttached': True, 'unscopedClockReads': []},
            'selectedRigidEvents': events, 'prefixes': prefixes, 'actions': actions,
            'final': {'actions': 3, 'prefixes': 3, 'caller': {'acquiredTransitions': 3}}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report-output', required=True)
    args = parser.parse_args()
    output = Path(args.report_output)
    output = (output if output.is_absolute() else ROOT / output).resolve()
    output.relative_to(ROOT)
    if output.exists():
        raise FileExistsError(output)
    document = fixture()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as stream:
        json.dump(document, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')
    baseline = READER.verify_report(document)
    negative = READER.qualify(document, baseline)
    result = {'schema': 'logos-engine.selected-rigid-reader-self-qualification.v1',
              'status': 'passed' if baseline['status'] == negative['status'] == 'passed' else 'failed',
              'report': str(output.relative_to(ROOT)), 'baseline': baseline, 'negativeQualification': negative,
              'providerExecuted': False, 'gameExecuted': False, 'pythonParityClaimed': False}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
