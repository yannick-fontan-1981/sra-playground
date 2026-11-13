#!/usr/bin/env python3
"""Verify captured SelectedRigid owner presence without executing a provider or game.

Campaign mode binds exactly the predeclared replay reports. --report is a
separate synthetic-reader qualification mode and cannot satisfy that gate.
Only JSON evidence is read; no project helper, Python oracle or native module
is imported. A failed report is retained as failed, never repaired in memory.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = 'logos-engine.lot6b.selected-rigid-owner-presence.v1'
PIN = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
OWNER = 'selected_rigid'
NATIVE_SCHEMA = 'native.selected_rigid.v1'
FIELDS = {'format', 'events'}
FORMAT = 'selected_rigid_events.v1'
COLD = {'format': FORMAT, 'events': []}
METHODS = {'setCurrentBudget', 'propose', 'bind', 'before', 'after', 'record', 'restoreNative', 'restoreSourceState'}
SOURCE_SCOPE = 'Canonical public transition; receiver remains hypothetical until discriminating displacement.'
STOP_REASONS = {'rigid_direction_domain_incomplete', 'rigid_control_or_collision_model_refuted',
                'rigid_conditional_configuration_search_incomplete', 'rigid_receptacle_matched_terminal_unknown',
                'rigid_control_discrimination_exhausted'}
ANNOTATIONS = {'strategy_receipt', 'morphology', 'composition_target_tree'}
OBSERVATION = re.compile(r'^(.+):epoch:(\d+):revision:(\d+):frame:([0-9a-f]{16})$')
SHA = re.compile(r'^[0-9a-f]{64}$')
COUNT_FIELDS = (
    'prefixes', 'selectedPrefixes', 'foreignPrefixes', 'physicalReturns',
    'selectedReturns', 'foreignReturns', 'selectedRecords', 'passiveReturns',
    'events', 'proposalCalls', 'actualRestores', 'nativeRestores',
    'sourceRestores', 'sourceFactsRetainedPrefixes', 'acquiredSourceFacts',
    'coldPrefixes', 'completedEventCursors', 'budgetCalls', 'bindCalls',
    'nullSelectedReturns', 'acquiredEvents',
)
QUALIFICATION = (
    'Read-only consistency of one captured native SelectedRigid owner, complete call '
    'journal, physical-return selection, retained source facts and actual '
    'restorations. No Python/original-source parity, game execution, new live '
    'success, cost result or complete-caller equivalence is claimed. Earlier '
    'source fact writes overwritten by the last fact are represented by the '
    'observed source-restoration calls, not reconstructed as retained facts.'
)


class VerificationError(ValueError):
    def __init__(self, code, where, message):
        self.code, self.where, self.message = code, where, message
        super().__init__(f'{code} at {where}: {message}')


def require(condition, code, where, message):
    if not condition:
        raise VerificationError(code, where, message)


def integer(value, minimum=0):
    return type(value) is int and minimum <= value <= 9007199254740991


def same(left, right):
    """Exact JSON comparison: booleans cannot stand for numeric cursors."""
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(same(left[k], right[k]) for k in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(same(a, b) for a, b in zip(left, right))
    return left == right


def encoded(value, sort=False):
    return json.dumps(value, ensure_ascii=False, sort_keys=sort,
                      separators=(',', ':'), allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(encoded(value, sort=True)).hexdigest()


def confined(value):
    path = Path(value)
    path = (path if path.is_absolute() else ROOT / path).resolve()
    path.relative_to(ROOT)
    return path


def fingerprint(path):
    path = confined(path)
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': value.hexdigest(),
            'bytes': path.stat().st_size}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key: ' + key)
        result[key] = value
    return result


def read(path):
    path = confined(path)
    opener = gzip.open if path.suffix == '.gz' else open
    def nonfinite(value):
        raise ValueError('Nonfinite JSON number: ' + value)
    with opener(path, 'rt', encoding='utf-8') as stream:
        return json.load(stream, object_pairs_hook=unique_object, parse_constant=nonfinite)


def source_state(value, where):
    require(isinstance(value, dict) and set(value) == FIELDS and value['format'] == FORMAT
            and isinstance(value['events'], list),
            'source_state_fields', where, 'Expected exactly format selected_rigid_events.v1 and events')
    for index, event in enumerate(value['events']):
        source_event(event, f'{where}.events[{index}]')
    return value


def source_event(value, where):
    require(isinstance(value, dict) and set(value) == {'kind', 'state', 'models', 'detail'}
            and value['kind'] == 'observed_selected_rigid',
            'source_event_fields', where, 'Unexpected source journal event')
    state, models, detail = value['state'], value['models'], value['detail']
    require(isinstance(state, dict) and set(state) == {'epoch', 'scene', 'active', 'evidence', 'tried'}
            and integer(state['epoch']) and (state['active'] is None or integer(state['active']))
            and isinstance(state['evidence'], list) and all(isinstance(ref, str) for ref in state['evidence'])
            and isinstance(state['tried'], list) and isinstance(state['scene'], dict),
            'source_event_state', where, 'Malformed acquired local state')
    scene = state['scene']
    require(set(scene) == {'geometry', 'bodies', 'receptacle'}
            and isinstance(scene['geometry'], dict)
            and set(scene['geometry']) == {'q', 'origin', 'size', 'frame_color'}
            and integer(scene['geometry']['q'], 1)
            and isinstance(scene['bodies'], list) and len(scene['bodies']) >= 3
            and isinstance(scene['receptacle'], dict)
            and set(scene['receptacle']) == {'key', 'position', 'mask'},
            'source_event_scene', where, 'Incomplete measured scene')
    require(state['active'] is None or state['active'] < len(scene['bodies']),
            'source_active', where, 'Active receiver is outside the measured body inventory')
    require(isinstance(models, list) and len(models) <= 24,
            'source_models', where, 'Models must be retained direction alternatives')
    signatures = set()
    for model in models:
        require(isinstance(model, dict) and set(model) == {'ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'}
                and all(isinstance(direction, list) and len(direction) == 2
                        and all(type(n) is int for n in direction) for direction in model.values()),
                'source_models', where, 'Incomplete direction hypothesis')
        signature = tuple(tuple(model[key]) for key in sorted(model))
        require(set(signature) == {(0, -1), (0, 1), (-1, 0), (1, 0)} and signature not in signatures,
                'source_models', where, 'Direction hypothesis is not a unique permutation')
        signatures.add(signature)
    required = {'before', 'after', 'command', 'prior_model_count', 'role_status', 'compatible_model_count'}
    require(isinstance(detail, dict) and required <= set(detail)
            and set(detail) <= required | {'selection_pixels_changed', 'moved'}
            and isinstance(detail['before'], str) and isinstance(detail['after'], str)
            and integer(detail['prior_model_count']) and detail['prior_model_count'] <= 24
            and integer(detail['compatible_model_count']) and detail['compatible_model_count'] == len(models)
            and detail['role_status'] in {'selected_receiver_hypothesis', 'observed_exclusive_receiver',
                                          'blocked_or_unselected_remains_conditional'}
            and all(type(detail[key]) is bool for key in ('selection_pixels_changed', 'moved') if key in detail),
            'source_event_detail', where, 'Incomplete source transition detail')
    command(detail['command'], where + '.command')
    return value


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def context(value, where):
    require(isinstance(value, dict) and set(value) == {'configuration', 'requestedStopReason',
            'levelDeadlineMs', 'remainingLevelActions', 'observedNowMs'},
            'context_fields', where, 'Missing actual diagnostic context')
    require(isinstance(value['configuration'], dict)
            and value['requestedStopReason'] in STOP_REASONS | {None}
            and (value['levelDeadlineMs'] is None or finite(value['levelDeadlineMs']))
            and (value['remainingLevelActions'] is None or integer(value['remainingLevelActions']))
            and (value['observedNowMs'] is None or finite(value['observedNowMs'])),
            'context_values', where, 'Malformed actual budget or source stop reason')
    return value


def execution_descriptor(value, where, required=False):
    if value is None and not required:
        return None
    require(isinstance(value, dict) and set(value) == {'deadlineMs', 'remainingLevelActions',
            'hasNow', 'hasYieldControl', 'hasSignal', 'aborted'}
            and (value['deadlineMs'] is None or finite(value['deadlineMs']))
            and (value['remainingLevelActions'] is None or integer(value['remainingLevelActions']))
            and all(type(value[key]) is bool for key in ('hasNow', 'hasYieldControl', 'hasSignal'))
            and (type(value['aborted']) is bool if value['hasSignal'] else value['aborted'] is None),
            'execution_descriptor', where, 'Incomplete actual primitive execution metadata')
    return value


def native_state(value, where):
    require(isinstance(value, dict) and set(value) == FIELDS | {'schema'}
            and value['schema'] == NATIVE_SCHEMA,
            'native_state_schema', where, 'Expected exact native.selected_rigid.v1 envelope')
    return source_state({key: value[key] for key in FIELDS}, where)


def command(value, where):
    require(isinstance(value, dict) and 'action_ref' in value
            and set(value) <= {'action_ref', 'data'}
            and isinstance(value['action_ref'], str) and value['action_ref']
            and isinstance(value.get('data', {}), dict),
            'command_shape', where, 'Malformed physical command')
    return {'action_ref': value['action_ref'], 'data': value.get('data', {})}


def proposal(value, where):
    require(isinstance(value, dict) and value.get('status') == 'proposed'
            and value.get('kind') == OWNER and isinstance(value.get('proposal_id'), str)
            and value['proposal_id'] and isinstance(value.get('selected_rigid_plan'), dict),
            'selected_proposal', where, 'Selected SelectedRigid requires its source proposal')
    plan = value['selected_rigid_plan']
    require(isinstance(value.get('actions'), list) and value['actions']
            and isinstance(value.get('steps'), list)
            and isinstance(value.get('bundle_template'), dict)
            and same(value['actions'], plan.get('commands'))
            and same(value['actions'], value['bundle_template'].get('actions'))
            and len(value['steps']) == len(value['actions'])
            and all(isinstance(step, dict) and same(step.get('action'), action)
                    for step, action in zip(value['steps'], value['actions'])),
            'proposal_commands', where, 'Source commands, steps and offered bundle differ')
    require(len(value['actions']) <= 16 and plan.get('mode') in {'path', 'select', 'probe'}
            and isinstance(plan.get('expected'), list) and len(plan['expected']) == len(value['actions'])
            and isinstance(plan.get('before_states'), list) and len(plan['before_states']) == len(value['actions'])
            and integer(plan.get('epoch')) and integer(plan.get('score'))
            and isinstance(plan.get('observation_ref'), str) and isinstance(plan.get('frame_digest'), str)
            and SHA.fullmatch(plan['frame_digest']) and integer(plan.get('search_nodes')),
            'proposal_plan', where, 'Incomplete conditional selected-body plan')
    require(value['proposal_id'] == 'selected-rigid:' + hashlib.sha256(
                json.dumps(plan, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest(),
            'proposal_identity', where, 'Plan differs from its source identity')
    if 'strategy_receipt' in value:
        receipt = value['strategy_receipt']
        require(isinstance(receipt, dict) and receipt.get('selected') == 'goal_access'
                and receipt.get('workflow') == 'v6.composition_strategy.choose',
                'selected_strategy', where, 'Foreign strategy receipt on SelectedRigid proposal')
    for field in ANNOTATIONS & value.keys():
        require(isinstance(value[field], dict), 'caller_annotation', where, field)
    return {key: item for key, item in value.items() if key not in ANNOTATIONS}


def observation(value, where):
    require(isinstance(value, dict) and all(integer(value.get(key)) for key in
            ('revision', 'level_epoch', 'levels_completed')),
            'observation_shape', where, 'Missing public observation counters')
    match = OBSERVATION.fullmatch(value.get('observation_ref', ''))
    require(match is not None and int(match[2]) == value['level_epoch']
            and int(match[3]) == value['revision'] and match[4] == value.get('frame_hash'),
            'observation_reference', where, 'Reference and public counters/hash differ')
    return value


def source_manifest(value, where):
    require(isinstance(value, dict) and set(value) == {'digest', 'fileCount', 'files'}
            and isinstance(value['files'], dict) and value['files']
            and integer(value['fileCount'], 1) and value['fileCount'] == len(value['files'])
            and all(isinstance(path, str) and isinstance(sha, str) and SHA.fullmatch(sha)
                    for path, sha in value['files'].items())
            and value['digest'] == digest(value['files']),
            'native_digest', where, 'Native inventory digest/count is inconsistent')
    return value['digest']


def journal(events):
    require(isinstance(events, list) and events, 'event_inventory', 'selectedRigidEvents',
            'A complete call/restoration journal is required')
    roots, snapshots = [], {0: COLD}
    configuration = events[0].get('contextBefore', {}).get('configuration') if isinstance(events[0], dict) else None

    def visit(index, depth, current, parent=None):
        event = events[index]
        where = f'selectedRigidEvents[{index}]'
        require(isinstance(event, dict), 'event_shape', where, 'Event must be an object')
        method = event.get('method')
        require(integer(event.get('sequence')) and event['sequence'] == index,
                'event_sequence', where, 'Invocation sequence is not complete and ordered')
        require(method in METHODS and event.get('kind') == ('restore' if method.startswith('restore') else 'budget' if method == 'setCurrentBudget' else 'call'),
                'event_method', where, 'Unknown or inconsistent call/restore kind')
        require(integer(event.get('depthBefore')) and integer(event.get('depthAfter'))
                and event['depthBefore'] == event['depthAfter'] == depth,
                'event_depth', where, 'Malformed nesting depth')
        if depth:
            require(depth == 1 and (parent, method) in {('before', 'bind'), ('propose', 'setCurrentBudget')},
                    'event_nesting', where, 'Unexpected nested source invocation')
        require(event.get('returnedNormally') is True and 'result' in event
                and ((event.get('returnMode') == 'sync' and event.get('completion') == 'returned')
                     or (event.get('returnMode') == 'async' and event.get('completion') == 'resolved')),
                'event_completion', where, 'Pending, failed or missing call result')
        require(same(event.get('observationErrors'), []), 'event_observation_error', where,
                'Passive observation failed or its error inventory is missing')
        require(event.get('resultKind') in {'null', 'undefined', 'value'}
                and (event['result'] is None if event['resultKind'] != 'value' else event['result'] is not None),
                'result_kind', where, 'Null, void and a missing return must remain distinguishable')
        cb = context(event.get('contextBefore'), where + '.contextBefore')
        ca = context(event.get('contextAfter'), where + '.contextAfter')
        require(same(cb['configuration'], ca['configuration']),
                'configuration_changed', where, 'The actual source configuration changed during a call')
        require(same(cb['configuration'], configuration),
                'configuration_changed', where, 'One owner changed configuration between invocations')
        clocks = event.get('clockReads')
        require(isinstance(clocks, list) and all(finite(value) for value in clocks)
                and all(a <= b for a, b in zip(clocks, clocks[1:]))
                and (not clocks or same(clocks[-1], ca['observedNowMs'])),
                'clock_reads', where, 'Consumed clock reads are missing, unordered or inconsistent')
        require(method in {'propose', 'before'} or not clocks,
                'unexpected_clock_read', where, 'A nonplanning method consumed an undocumented clock read')
        args = event.get('arguments')
        lengths = {'setCurrentBudget': 2, 'propose': 4, 'bind': 1, 'before': 4, 'after': 6, 'record': 8,
                   'restoreNative': 1, 'restoreSourceState': 1}
        require(isinstance(args, list) and len(args) == lengths[method],
                'event_arguments', where, 'Incomplete captured arguments')
        before = source_state(event.get('sourceBefore'), where + '.sourceBefore')
        after = source_state(event.get('sourceAfter'), where + '.sourceAfter')
        require(same(before, current), 'state_continuity', where, 'Source state changed outside the ordered journal')
        if method.startswith('restore'):
            restored = native_state(args[0], where + '.arguments[0]') if method == 'restoreNative' else source_state(args[0], where + '.arguments[0]')
            require(event['resultKind'] == 'undefined' and event['result'] is None
                    and same(restored, after) and same(before, after) and same(cb, ca),
                    'restore_state', where, 'Actual restore must preserve the captured retained state')
        elif method == 'setCurrentBudget':
            execution = execution_descriptor(args[0], where + '.execution')
            require(args[1] is None or integer(args[1]), 'budget_argument', where, 'Missing actual level action quota')
            require(same(before, after) and event['resultKind'] == 'undefined'
                    and ca['levelDeadlineMs'] == (execution['deadlineMs'] if execution else None)
                    and same(ca['remainingLevelActions'], args[1]) and ca['observedNowMs'] is None
                    and cb['requestedStopReason'] == ca['requestedStopReason'],
                    'budget_state', where, 'Budget setter changed source state or did not retain its actual inputs')
        elif method == 'propose':
            observation(args[0], where + '.observation')
            execution_descriptor(event.get('execution'), where + '.execution')
            require(integer(args[3]) and same(before, after),
                    'proposal_acquisition', where, 'Proposal acquired a source state or event')
            result = event['result']
            require(event['resultKind'] != 'undefined', 'proposal_return', where, 'Propose must return null or an actual proposal')
            if result is not None:
                if isinstance(result, dict) and result.get('status') == 'unknown':
                    require(result.get('block_unrelated_probe') is True and not result.get('actions'),
                            'unknown_release', where, 'Unknown cannot release physical actions')
                else:
                    proposal(result, where + '.result')
                    require(ca['requestedStopReason'] is None and ca['levelDeadlineMs'] is not None
                            and integer(ca['remainingLevelActions']) and clocks,
                            'proposal_budget', where, 'An actual proposal lacks its consumed level budget and clock')
        elif method == 'bind':
            proposal(args[0], where + '.proposal')
            require(same(before, after) and same(cb, ca) and event['resultKind'] == 'undefined'
                    and type(event.get('domainSupplied')) is bool,
                    'bind_state', where, 'Bind changed source state or lost the opaque domain-presence witness')
        elif method in {'before', 'after'}:
            proposal(args[0], where + '.proposal')
            require(integer(args[1]) and same(before, after), 'guard_state', where,
                    'A guard must have a valid index and cannot acquire source state')
            require(isinstance(event['result'], dict), 'guard_result', where, 'Missing guard result')
            if method == 'before':
                require(type(event['result'].get('admitted')) is bool,
                        'guard_result', where, 'Before result must contain an admission boolean')
                if event['result']['admitted']:
                    require(clocks and ca['levelDeadlineMs'] is not None
                            and clocks[-1] < ca['levelDeadlineMs'],
                            'guard_budget', where, 'Admitted before guard lacks a consumed unexpired deadline')
            else:
                require(event['result'].get('matched') is None or type(event['result'].get('matched')) is bool,
                        'guard_result', where, 'After match must be boolean or null')
                require(type(event['result'].get('seal_prefix')) is bool,
                        'guard_result', where, 'After result must contain a seal boolean')
        else:
            first, second = observation(args[0], where + '.before'), observation(args[1], where + '.after')
            proposal(args[5], where + '.proposal')
            require(integer(args[6]), 'record_index', where, 'Record index is not an integer')
            command(args[2], where + '.command')
            result = event['result']
            boundary = first['level_epoch'] != second['level_epoch']
            require(event['resultKind'] != 'undefined', 'record_return', where, 'A selected null return cannot be replaced by a void/missing return')
            require(same(cb, ca), 'record_context', where, 'Acquisition changed ephemeral budget or stop context')
            if result is None:
                require(event['resultKind'] == 'null' and same(before, after),
                        'record_null_state', where, 'Null acquisition mutated its retained source journal')
            else:
                require(not boundary and isinstance(result, dict) and set(result) == {'events', 'scope'}
                        and result['scope'] == SOURCE_SCOPE and isinstance(result['events'], list)
                        and len(result['events']) == 1,
                        'record_envelope', where, 'Selected record lost its exact nonboundary source envelope')
                require(same(after['events'], before['events'] + result['events']),
                        'record_state', where, 'Acquired journal differs from the actual returned source event')
                acquired = result['events'][0]
                source_event(acquired, where + '.acquired')
                require(same(acquired, after['events'][-1])
                        and isinstance(acquired.get('detail'), dict)
                        and acquired['detail'].get('before') == first['observation_ref']
                        and acquired['detail'].get('after') == second['observation_ref']
                        and same(acquired['detail'].get('command'), args[2])
                        and acquired['state']['epoch'] == first['level_epoch'],
                        'acquired_event_state', where, 'Observed acquisition and retained owner differ')
        end = index + 1
        child_state = before
        while end < len(events) and isinstance(events[end], dict) and integer(events[end].get('depthBefore')) and events[end]['depthBefore'] > depth:
            require((method, events[end].get('method')) in {('before', 'bind'), ('propose', 'setCurrentBudget')}
                    and events[end]['depthBefore'] == depth + 1,
                    'event_nesting', where, 'Unqualified nested call')
            if method == 'before':
                require(same(events[end].get('arguments'), [args[0]]),
                        'nested_binding', where, 'Nested bind did not receive the actual guarded proposal')
            else:
                descriptor = event.get('execution')
                expected_remaining = descriptor.get('remainingLevelActions') if isinstance(descriptor, dict) else None
                require(descriptor is not None and same(events[end].get('arguments'),
                        [descriptor, args[3] if expected_remaining is None else expected_remaining]),
                        'nested_budget', where, 'Nested setter did not receive the actual execution/level budget')
            end, child_state = visit(end, depth + 1, child_state, method)
        if end > index + 1:
            require(same(child_state, after), 'nested_state', where, 'Nested read-only call changed the source state')
        return end, after

    position, current = 0, COLD
    while position < len(events):
        end, current = visit(position, 0, current)
        roots.append({'start': position, 'end': end, 'event': events[position]})
        snapshots[end] = current
        position = end
    return roots, snapshots


def transitions(prefix, where):
    copies = [value['transitions'] for key, value in prefix.items()
              if (key.endswith('Acquisition') or key == 'selectedRigid')
              and isinstance(value, dict) and 'transitions' in value]
    require(copies and isinstance(copies[0], list) and all(same(copies[0], value) for value in copies),
            'common_transitions', where, 'Common retained transition references are absent or disagree')
    return copies[0]


def verify_report(report, case='synthetic', expected_digest=None):
    result = {'case': case, 'status': 'failed', **{key: 0 for key in COUNT_FIELDS}, 'errors': []}
    try:
        require(isinstance(report, dict) and report.get('schema') == 'logos-engine.v6.recorded-public-regression.v1'
                and report.get('status') == 'passed' and report.get('failure') is None,
                'report_status', 'report', 'Expected a successful completed recorded-public report')
        require(report.get('referenceCommit') == PIN and report.get('sourceUnchangedDuringRun') is True,
                'report_source', 'report', 'Pinned source or unchanged native source is not established')
        native_digest = source_manifest(report.get('source'), 'source')
        result['nativeDigest'] = native_digest
        require(expected_digest is None or native_digest == expected_digest,
                'native_digest_binding', 'source', 'Report is not from the declared native freeze')
        events = report.get('selectedRigidEvents')
        capture = report.get('selectedRigidCapture')
        require(isinstance(capture, dict) and set(capture) == {'schema', 'methods', 'clockObserverAttached', 'unscopedClockReads'}
                and capture['schema'] == 'logos-engine.selected-rigid-passive-capture.v1'
                and capture['clockObserverAttached'] is True and same(capture['unscopedClockReads'], [])
                and isinstance(capture['methods'], list) and len(capture['methods']) == len(METHODS)
                and set(capture['methods']) == METHODS,
                'capture_surface', 'selectedRigidCapture', 'Complete unique-owner clock/call observation is not established')
        roots, snapshots = journal(events)
        prefixes, actions = report.get('prefixes'), report.get('actions')
        require(isinstance(prefixes, list) and prefixes and isinstance(actions, list) and actions,
                'physical_inventory', 'report', 'Missing physical returns or sealed prefixes')
        require(all(isinstance(row, dict) and integer(row.get('sequence'), 1) and row['sequence'] == index + 1
                    for index, row in enumerate(actions)),
                'physical_sequence', 'actions', 'Physical sequence is not complete and ordered')
        result.update(prefixes=len(prefixes), physicalReturns=len(actions), events=len(events),
                      proposalCalls=sum(e['method'] == 'propose' for e in events),
                      actualRestores=sum(e['kind'] == 'restore' for e in events),
                      nativeRestores=sum(e['method'] == 'restoreNative' for e in events),
                      sourceRestores=sum(e['method'] == 'restoreSourceState' for e in events),
                      budgetCalls=sum(e['method'] == 'setCurrentBudget' for e in events),
                      bindCalls=sum(e['method'] == 'bind' for e in events))
        previous_cursor = offset = 0
        ids, decisions = set(), set()
        prefix_checks = []
        for pindex, prefix in enumerate(prefixes):
            where = f'prefixes[{pindex}]'
            require(isinstance(prefix, dict) and isinstance(prefix.get('id'), str) and prefix['id'] not in ids
                    and integer(prefix.get('decisionRevision'), 1) and prefix['decisionRevision'] not in decisions
                    and integer(prefix.get('acquiredActions'), 1) and isinstance(prefix.get('family'), str),
                    'prefix_inventory', where, 'Malformed/duplicate prefix identity or counts')
            ids.add(prefix['id']); decisions.add(prefix['decisionRevision'])
            rigid = prefix.get('selectedRigid')
            require(isinstance(rigid, dict) and 'proposal' in rigid
                    and rigid.get('stateNode') == 'family_state:selected_rigid',
                    'owner_presence', where, 'Missing exact SelectedRigid owner checkpoint')
            state = native_state(rigid.get('state'), where + '.state')
            instance = source_state(rigid.get('instanceSourceState'), where + '.instanceSourceState')
            cursor = rigid.get('eventsThrough')
            require(integer(cursor, 1) and previous_cursor < cursor <= len(events) and cursor in snapshots,
                    'event_cursor', where, 'Cursor must end complete calls and cover ordered new events')
            require(same(state, instance) and same(state, snapshots[cursor]),
                    'prefix_state', where, 'Retained envelope, actual instance and journal state differ')
            segment = [item for item in roots if previous_cursor <= item['start'] < cursor]
            require(segment and segment[-1]['event']['method'] == 'restoreNative'
                    and same(segment[-1]['event']['arguments'][0], rigid['state']),
                    'prefix_actual_restore', where, 'No actual final native restore of the retained checkpoint')
            require(same(context(rigid.get('instanceContext'), where + '.instanceContext'),
                         segment[-1]['event']['contextAfter']),
                    'prefix_context', where, 'Prefix diagnostic context differs from the actual final restoration')
            n = prefix['acquiredActions']
            physical = actions[offset:offset + n]
            common = transitions(prefix, where)
            require(len(physical) == n and len(common) == n
                    and integer(prefix.get('callerAcquiredTransitions'))
                    and prefix['callerAcquiredTransitions'] == offset + n,
                    'prefix_return_coverage', where, 'Common prefix does not cover exactly its physical returns')
            selected = prefix['family'] == OWNER
            for index, (physical_row, transition) in enumerate(zip(physical, common)):
                require(physical_row.get('family') == prefix['family']
                        and integer(physical_row.get('decisionRevision'), 1)
                        and physical_row['decisionRevision'] == prefix['decisionRevision']
                        and integer(physical_row.get('actionIndex')) and physical_row['actionIndex'] == index,
                        'physical_prefix_binding', where, 'Physical family/decision/index differs from its prefix')
                require(all(integer(physical_row.get(key)) for key in
                            ('levelBefore', 'levelAfter', 'completedBefore', 'completedAfter', 'animationFrames')),
                        'physical_counters', where, 'Physical counters must be JSON integers')
                require(isinstance(transition, dict)
                        and same(command(transition.get('command'), where), command(physical_row.get('command'), where)),
                        'physical_command', where, 'Common transition command differs from physical return')
                for side, revision, level, frame in [('before', prefix['decisionRevision'] + index, physical_row.get('levelBefore'), None),
                                                       ('after', prefix['decisionRevision'] + index + 1, physical_row.get('levelAfter'), physical_row.get('frameHash'))]:
                    match = OBSERVATION.fullmatch(transition.get(side, ''))
                    require(match is not None and int(match[2]) == level and int(match[3]) == revision
                            and (frame is None or match[4] == frame),
                            'physical_reference', where, 'Common observation reference is not this physical return')
            records = [item for item in segment if item['event']['method'] == 'record']
            source_restores = [item for item in segment if item['event']['method'] == 'restoreSourceState']
            if selected:
                result['selectedPrefixes'] += 1; result['selectedReturns'] += n
                core = proposal(rigid.get('proposal'), where + '.proposal')
                require(prefix.get('proposalKind') == OWNER and prefix.get('selectionGroup') == 'goal_access',
                        'selected_prefix', where, 'Selected prefix lacks its source family/group')
                offers = [item for item in segment if item['event']['method'] == 'propose'
                          and same(item['event']['result'], core)]
                require(offers, 'source_proposal_missing', where, 'Selected proposal was not returned by the actual raw owner')
                binds = [item for item in segment if item['event']['method'] == 'bind'
                         and same(item['event']['arguments'][0], rigid['proposal'])]
                require(binds and any(offer['start'] < bound['start'] for offer in offers for bound in binds),
                        'selected_bind_missing', where, 'Selected proposal was not actually bound by its unique owner')
                require(len(records) == n, 'selected_record_coverage', where, 'Expected exactly one selected record per physical return')
                admitted = [item for item in segment if item['event']['method'] == 'before'
                            and item['event']['result']['admitted'] is True]
                after_guards = [item for item in segment if item['event']['method'] == 'after']
                denied = [item for item in segment if item['event']['method'] == 'before'
                          and item['event']['result']['admitted'] is False]
                require(len(admitted) == len(after_guards) == n and len(denied) <= 1
                        and all(item['event']['arguments'][1] == n
                                and same(item['event']['arguments'][0], rigid['proposal']) for item in denied),
                        'selected_guard_inventory', where, 'Extra selected guard has no corresponding physical return')
                acquired_sequence = []
                for index, (item, physical_row, transition) in enumerate(zip(records, physical, common)):
                    event, position = item['event'], item['start']; args = event['arguments']
                    require(args[6] == index and same(args[5], rigid['proposal'])
                            and args[0]['revision'] == prefix['decisionRevision'] + index
                            and args[1]['revision'] == prefix['decisionRevision'] + index + 1
                            and args[0]['observation_ref'] == transition['before']
                            and args[1]['observation_ref'] == transition['after']
                            and same(command(args[2], where), command(physical_row['command'], where))
                            and same(command(args[2], where), command(core['actions'][index], where)),
                            'selected_record_binding', where, 'Record is not bound to its unique selected physical return')
                    before_calls = [entry for entry in segment if entry['event']['method'] == 'before'
                                    and entry['event']['arguments'][1] == index
                                    and same(entry['event']['arguments'][0], rigid['proposal'])
                                    and entry['event']['result']['admitted'] is True]
                    after_calls = [entry for entry in segment if entry['event']['method'] == 'after'
                                   and entry['event']['arguments'][1] == index
                                   and same(entry['event']['arguments'][0], rigid['proposal'])]
                    require(len(before_calls) == len(after_calls) == 1
                            and any(offer['start'] < before_calls[0]['start'] for offer in offers)
                            and any(bound['start'] < before_calls[0]['start'] for bound in binds)
                            and before_calls[0]['start'] < after_calls[0]['start'] < position,
                            'selected_guard_coverage', where, 'Physical return lacks ordered actual before/after guards')
                    bargs, aargs = before_calls[0]['event']['arguments'], after_calls[0]['event']['arguments']
                    require(same(bargs[3], args[0]) and same(aargs[2], args[0]) and same(aargs[3], args[1])
                            and same(aargs[4], args[3]) and same(aargs[5], args[4])
                            and isinstance(bargs[2], dict) and same(bargs[2].get('frame_rows'), args[3])
                            and same(after_calls[0]['event']['result'], transition.get('outcome')),
                            'selected_guard_binding', where, 'Guard observations/rasters/outcome differ from the recorded return')
                    require(isinstance(args[7], list) and args[7]
                            and physical_row.get('animationFrames') == len(args[7]),
                            'physical_frames', where, 'Complete returned animation packet is missing')
                    after = args[1]
                    frame_hash = hashlib.sha256(encoded(args[4])).hexdigest()[:16]
                    packet = {'frame_rows': args[4], 'frame_packet': args[7], 'level': after['level_epoch'],
                              'levels_completed': after['levels_completed'], 'state': after['state'],
                              'step_index': physical_row['sequence'], 'available_action_refs': after['available_action_refs'],
                              'frame_hash': frame_hash}
                    require(physical_row.get('frameHash') == after['frame_hash'] == frame_hash
                            and physical_row.get('publicPacketSha256') == hashlib.sha256(encoded(packet)).hexdigest()
                            and physical_row.get('completedBefore') == args[0]['levels_completed']
                            and physical_row.get('completedAfter') == after['levels_completed']
                            and physical_row.get('state') == after['state'],
                            'physical_packet_binding', where, 'Recorded return differs from the physical complete packet')
                    acquired_sequence.append(('record', event))
                    if event['sourceAfter']['events']:
                        acquired_sequence.append(('restoreSourceState', event['sourceAfter']))
                observed = [item['event'] for item in segment if item['event']['method'] in {'record', 'restoreSourceState'}]
                require(len(observed) == len(acquired_sequence)
                        and all(actual['method'] == method and
                                (same(actual, expected) if method == 'record' else same(actual['arguments'][0], expected))
                                for actual, (method, expected) in zip(observed, acquired_sequence)),
                        'source_restore_coverage', where, 'Each physical return with a retained journal needs its actual source checkpoint restoration')
                result['selectedRecords'] += len(records)
                result['nullSelectedReturns'] += sum(item['event']['result'] is None for item in records)
                result['acquiredEvents'] += sum(len(item['event']['result']['events']) if item['event']['result'] is not None else 0 for item in records)
            else:
                result['foreignPrefixes'] += 1; result['foreignReturns'] += n
                result['passiveReturns'] += len(records)
                require(not records, 'foreign_record', where, 'A foreign physical return acquired a SelectedRigid record')
                require(rigid.get('proposal') is None, 'foreign_proposal', where, 'Foreign prefix carries a selected SelectedRigid proposal')
                require(not any(item['event']['method'] in {'bind', 'before', 'after'} for item in segment),
                        'foreign_guard', where, 'Foreign prefix invoked selected SelectedRigid guards')
                require(len(source_restores) == (n if state['events'] else 0),
                        'foreign_restore_coverage', where, 'Foreign retained-model returns lack exact source restorations')
            require('acquired' in rigid and isinstance(rigid['acquired'], list)
                    and 'retainedSourceFact' in rigid,
                    'missing_source_facts', where, 'Recorder did not retain actual SelectedRigid source facts')
            expected_acquired = [{'key': f"selected_rigid_event:{item['event']['arguments'][0]['revision']}",
                                  'evidence': item['event']['arguments'][1]['observation_ref'],
                                  'revision': item['event']['arguments'][1]['revision'],
                                  'result': item['event']['result']} for item in records]
            require(same(rigid['acquired'], expected_acquired), 'acquired_source_fact', where,
                    'Retained selected source envelopes differ from actual records or contain foreign records')
            result['acquiredSourceFacts'] += len(expected_acquired)
            fact = rigid['retainedSourceFact']
            if state['events']:
                require(isinstance(fact, dict) and set(fact) == {'episode', 'key', 'value', 'evidence', 'revision'}
                        and fact['episode'] == 'common-observation-frontier' and fact['key'] == 'selected_rigid_state'
                        and integer(fact['revision'], 1) and fact['revision'] == prefix['decisionRevision'] + n
                        and fact['evidence'] == common[-1]['after'] and same(fact['value'], state)
                        and source_restores and same(source_restores[-1]['event']['arguments'][0], fact['value']),
                        'retained_source_fact', where, 'Retained model lacks its actual last source fact and matching restoration')
                result['sourceFactsRetainedPrefixes'] += 1
            else:
                require(fact is None, 'cold_source_fact', where, 'Cold owner must not claim an acquired source-model fact')
                result['coldPrefixes'] += 1
            prefix_checks.append({'id': prefix['id'], 'eventsFrom': previous_cursor, 'eventsThrough': cursor,
                                  'selected': selected, 'returns': n, 'records': len(records),
                                  'sourceRestores': len(source_restores), 'stateDigest': digest(state)})
            offset += n; previous_cursor = cursor; result['completedEventCursors'] += 1
        require(previous_cursor == len(events), 'uncovered_events', 'prefixes', 'Journal events remain outside sealed prefix cursors')
        require(offset == len(actions), 'uncovered_returns', 'prefixes', 'Physical returns remain outside sealed prefixes')
        final = report.get('final', {})
        require(integer(final.get('actions')) and final['actions'] == len(actions)
                and integer(final.get('prefixes')) and final['prefixes'] == len(prefixes)
                and isinstance(final.get('caller'), dict) and integer(final['caller'].get('acquiredTransitions'))
                and final['caller']['acquiredTransitions'] == len(actions),
                'final_coverage', 'final', 'Final caller counters differ from the complete physical/prefix inventory')
        result.update(status='passed', prefixChecks=prefix_checks)
    except VerificationError as error:
        result['errors'].append({'code': error.code, 'where': error.where, 'message': error.message})
    except (KeyError, IndexError, TypeError, ValueError) as error:
        result['errors'].append({'code': 'malformed_evidence', 'where': 'report', 'message': f'{type(error).__name__}: {error}'})
    return result


def check_fingerprint(record, path, where):
    require(isinstance(record, dict) and set(record) == {'path', 'sha256', 'bytes'}
            and same(record, fingerprint(path)), 'input_fingerprint', where, 'Input bytes differ from their retained fingerprint')


def campaign(manifest_path, summary_path, receipt):
    manifest, summary = read(manifest_path), read(summary_path)
    require(isinstance(manifest, dict) and manifest.get('schema') == 'logos-engine.recorded-public-regression-cases.v1'
            and isinstance(manifest.get('cases'), list) and manifest['cases'],
            'case_manifest', 'caseManifest', 'A nonempty predeclared case inventory is required')
    cases = manifest['cases']
    require(all(isinstance(item, dict) and isinstance(item.get('id'), str)
                and re.fullmatch(r'[a-z0-9][a-z0-9_-]*', item['id'])
                and isinstance(item.get('game'), str) and item['game'] != 'LKEY' for item in cases)
            and len({item['id'] for item in cases}) == len(cases),
            'case_population', 'caseManifest', 'Cases must have unique IDs; the closed LKEY case remains excluded')
    population = manifest.get('selectedRigidPresence')
    require(isinstance(population, dict) and set(population) == {'selectedCases', 'foreignCases'}
            and all(isinstance(population[key], list) and all(isinstance(case, str) for case in population[key])
                    for key in population)
            and population['selectedCases']
            and len(population['selectedCases']) == len(set(population['selectedCases']))
            and len(population['foreignCases']) == len(set(population['foreignCases']))
            and not (set(population['selectedCases']) & set(population['foreignCases']))
            and set(population['selectedCases']) | set(population['foreignCases']) == {item['id'] for item in cases},
            'presence_contract', 'caseManifest.selectedRigidPresence', 'Predeclared selected/foreign cases must partition the exact manifest')
    receipt['presenceContract'] = deepcopy(population)
    require(isinstance(summary, dict) and summary.get('schema') == 'logos-engine.recorded-public-regressions.v1'
            and summary.get('status') == 'passed' and integer(summary.get('total')) and summary['total'] == len(cases)
            and integer(summary.get('passed')) and summary['passed'] == len(cases)
            and isinstance(summary.get('results'), list) and len(summary['results']) == len(cases),
            'regression_summary', 'regressionSummary', 'Every declared regression must be completed and successful')
    check_fingerprint(summary.get('caseManifest'), manifest_path, 'regressionSummary.caseManifest')
    native_digest = source_manifest(summary.get('nativeSource'), 'regressionSummary.nativeSource')
    require(same(summary['nativeSource'], summary.get('nativeSourceAfter'))
            and summary.get('executionInputsUnchanged') is True
            and same(summary.get('executionInputs'), summary.get('executionInputsAfter')),
            'regression_immutable_inputs', 'regressionSummary', 'Frozen native/execution inputs changed')
    receipt['nativeDigest'] = native_digest
    require([row.get('case') for row in summary['results']] == [item['id'] for item in cases],
            'regression_case_binding', 'regressionSummary.results', 'Results do not cover the exact ordered manifest')
    report_paths = set()
    for item, row in zip(cases, summary['results']):
        where = 'results.' + item['id']
        require(row.get('game') == item['game'] and row.get('passed') is True and row.get('status') == 'passed'
                and row.get('exitCode') == 0 and type(row.get('exitCode')) is int and row.get('timedOut') is False
                and row.get('nativeSourceUnchanged') is True and row.get('immutableInputsUnchanged') is True
                and row.get('nativeSourceBeforeDigest') == row.get('nativeSourceAfterDigest') == native_digest,
                'regression_case_status', where, 'Case completion/native freeze is not established')
        for key in ('baseline', 'trace'):
            require(isinstance(item.get(key), dict) and isinstance(row.get(key), dict)
                    and all(same(item[key].get(field), row[key].get(field)) for field in ('path', 'sha256')),
                    'regression_case_input', where, 'Declared immutable baseline/trace differs')
        require(isinstance(row.get('report'), dict) and isinstance(row['report'].get('path'), str),
                'regression_report', where, 'Missing replay-report fingerprint')
        path = confined(row['report']['path'])
        require(path not in report_paths, 'duplicate_report', where, 'A replay report cannot stand for two cases')
        report_paths.add(path)
        check_fingerprint(row['report'], path, where + '.report')
        receipt['inputs'].append(fingerprint(path))
        report = read(path)
        require(report.get('game') == item['game'] and same(report.get('source'), summary['nativeSource']),
                'report_case_binding', where, 'Report game/native inventory differs from the declared case')
        replay = report.get('recordedPublicReplay')
        require(isinstance(replay, dict) and all(isinstance(replay.get(key), dict)
                and all(same(replay[key].get(field), item[key].get(field)) for field in ('path', 'sha256'))
                for key in ('baseline', 'trace')),
                'report_replay_binding', where, 'Report did not consume this declared baseline/public trace')
        result = verify_report(report, item['id'], native_digest)
        result.update(game=item['game'], report=fingerprint(path))
        receipt['cases'].append(result)
        if result['status'] == 'passed':
            if item['id'] in population['selectedCases']:
                require(result['selectedPrefixes'] > 0 and result['selectedReturns'] > 0,
                        'required_selection', where, 'A predeclared positive case did not exercise actual selected returns')
            else:
                require(result['selectedPrefixes'] == result['selectedReturns'] == result['selectedRecords'] == 0,
                        'historical_selection', where, 'Historical cases must not acquire SelectedRigid records')


def qualify(report, baseline):
    """Detached evidence mutations; an unchanged failing capture is never repaired."""
    if baseline['status'] != 'passed':
        return {'status': 'not_run', 'reason': 'Unchanged report fails; no passing baseline is invented', 'cases': []}
    tests = []
    selected = [i for i, prefix in enumerate(report['prefixes']) if prefix['family'] == OWNER]
    foreign = [i for i, prefix in enumerate(report['prefixes'])
               if prefix['family'] != OWNER and prefix['selectedRigid']['state']['events']]
    null_records = [i for i, event in enumerate(report['selectedRigidEvents'])
                    if event['method'] == 'record' and event['result'] is None]
    require(selected and foreign and null_records, 'qualification_coverage', 'synthetic',
            'Qualification needs selected acquisition, a null selected return and a foreign prefix with retained journal')
    pindex = selected[0]
    first_action = sum(prefix['acquiredActions'] for prefix in report['prefixes'][:pindex])
    def event(value, method):
        return next(row for row in value['selectedRigidEvents'] if row['method'] == method)
    def owner(value):
        return value['prefixes'][pindex]['selectedRigid']
    def add(name, expected, mutation):
        changed = deepcopy(report)
        mutation(changed)
        observed = verify_report(changed)
        codes = [error['code'] for error in observed['errors']]
        tests.append({'case': name, 'expectedError': expected, 'rejected': observed['status'] == 'failed',
                      'expectedErrorObserved': expected in codes, 'errors': observed['errors'],
                      'mutatedEvidenceDigest': digest(changed)})
    def remove(value, position):
        del value['selectedRigidEvents'][position]
        for number, row in enumerate(value['selectedRigidEvents']):
            row['sequence'] = number
        for prefix in value['prefixes']:
            if prefix['selectedRigid']['eventsThrough'] > position:
                prefix['selectedRigid']['eventsThrough'] -= 1
    def segment(value, index):
        low = value['prefixes'][index - 1]['selectedRigid']['eventsThrough'] if index else 0
        high = value['prefixes'][index]['selectedRigid']['eventsThrough']
        return range(low, high)
    add('event-sequence-gap', 'event_sequence', lambda value: value['selectedRigidEvents'][1].update(sequence=99))
    add('boolean-sequence', 'event_sequence', lambda value: value['selectedRigidEvents'][1].update(sequence=True))
    add('unfinished-call', 'event_completion', lambda value: value['selectedRigidEvents'][0].update(completion='pending', returnedNormally=False))
    add('observation-error', 'event_observation_error', lambda value: value['selectedRigidEvents'][0]['observationErrors'].append({'field': 'sourceBefore', 'error': 'synthetic'}))
    add('unqualified-nesting', 'event_depth', lambda value: value['selectedRigidEvents'][0].update(depthBefore=1, depthAfter=1))
    add('missing-restore-result', 'event_completion', lambda value: event(value, 'restoreNative').pop('result'))
    add('restore-schema', 'native_state_schema', lambda value: event(value, 'restoreNative')['arguments'][0].update(schema='native.foreign.v1'))
    add('boolean-prefix-cursor', 'event_cursor', lambda value: owner(value).update(eventsThrough=True))
    add('boolean-prefix-return-count', 'prefix_return_coverage', lambda value: value['prefixes'][pindex].update(callerAcquiredTransitions=True))
    add('missing-final-cursor', 'uncovered_events', lambda value: value['prefixes'].pop())
    add('changed-prefix-state', 'prefix_state', lambda value: owner(value)['state']['events'].clear())
    add('extra-native-field', 'native_state_schema', lambda value: owner(value)['state'].update(foreign=[]))
    add('physical-order', 'physical_sequence', lambda value: value['actions'][0].update(sequence=2))
    add('physical-packet', 'physical_packet_binding', lambda value: value['actions'][first_action].update(publicPacketSha256='0' * 64))
    add('missing-source-facts', 'missing_source_facts', lambda value: owner(value).pop('retainedSourceFact'))
    add('changed-retained-source-fact', 'retained_source_fact', lambda value: owner(value)['retainedSourceFact'].update(revision=999))
    add('missing-selected-envelope', 'acquired_source_fact', lambda value: owner(value)['acquired'].clear())
    add('null-return-misreported-as-void', 'record_return', lambda value: value['selectedRigidEvents'][null_records[0]].update(resultKind='undefined'))
    add('missing-null-return', 'event_completion', lambda value: value['selectedRigidEvents'][null_records[0]].pop('result'))
    add('unscoped-clock', 'capture_surface', lambda value: value['selectedRigidCapture']['unscopedClockReads'].append(1))
    add('missing-clock-surface', 'capture_surface', lambda value: value['selectedRigidCapture'].update(clockObserverAttached=False))
    add('missing-clock-list', 'clock_reads', lambda value: event(value, 'propose').pop('clockReads'))
    add('invented-last-clock', 'clock_reads', lambda value: event(value, 'propose')['clockReads'].append(999999999))
    add('budget-mismatch', 'budget_state', lambda value: event(value, 'setCurrentBudget')['contextAfter'].update(remainingLevelActions=999999))
    def foreign_record(value):
        prefix = value['prefixes'][pindex]
        prefix.update(family='synthetic_foreign', proposalKind='synthetic_foreign', selectionGroup='synthetic_foreign')
        prefix['selectedRigid']['proposal'] = None
        for row in value['actions'][first_action:first_action + prefix['acquiredActions']]:
            row['family'] = 'synthetic_foreign'
    add('record-on-foreign-return', 'foreign_record', foreign_record)
    def extra_after(value):
        position = next(i for i in segment(value, pindex) if value['selectedRigidEvents'][i]['method'] == 'after') + 1
        extra = deepcopy(value['selectedRigidEvents'][position - 1]); extra['arguments'][1] = 999
        value['selectedRigidEvents'].insert(position, extra)
        for number, row in enumerate(value['selectedRigidEvents']):
            row['sequence'] = number
        for prefix in value['prefixes']:
            if prefix['selectedRigid']['eventsThrough'] >= position:
                prefix['selectedRigid']['eventsThrough'] += 1
    add('extra-after-with-renumbered-events', 'selected_guard_inventory', extra_after)
    def omit_source_restore(value):
        position = next(i for i in segment(value, pindex) if value['selectedRigidEvents'][i]['method'] == 'restoreSourceState')
        remove(value, position)
    add('missing-source-restore-with-renumbered-events', 'source_restore_coverage', omit_source_restore)
    def omit_native_restore(value):
        position = value['prefixes'][pindex]['selectedRigid']['eventsThrough'] - 1
        require(value['selectedRigidEvents'][position]['method'] == 'restoreNative',
                'qualification_shape', 'synthetic', 'Expected an actual final native restoration')
        remove(value, position)
    add('missing-native-restore-with-renumbered-events', 'prefix_actual_restore', omit_native_restore)
    def omit_bind(value):
        position = next(i for i in segment(value, pindex) if value['selectedRigidEvents'][i]['method'] == 'bind'
                        and value['selectedRigidEvents'][i]['depthBefore'] == 0)
        remove(value, position)
    add('missing-selected-bind-with-renumbered-events', 'selected_bind_missing', omit_bind)
    def omit_foreign_restore(value):
        position = next(i for i in segment(value, foreign[0]) if value['selectedRigidEvents'][i]['method'] == 'restoreSourceState')
        remove(value, position)
    add('missing-foreign-checkpoint-with-renumbered-events', 'foreign_restore_coverage', omit_foreign_restore)
    return {'status': 'passed' if all(row['rejected'] and row['expectedErrorObserved'] for row in tests) else 'failed',
            'baselineMustPass': True, 'cases': tests, 'mutations': len(tests),
            'rejected': sum(row['rejected'] for row in tests),
            'expectedErrorsObserved': sum(row['expectedErrorObserved'] for row in tests),
            'scope': 'Detached synthetic evidence mutations only; no capture rewrite, source import, game or parity execution.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--case-manifest')
    parser.add_argument('--regression-summary')
    parser.add_argument('--report', help='Synthetic report only; runs detached negative-reader qualification')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    if args.report:
        if args.case_manifest or args.regression_summary:
            parser.error('--report is synthetic-only and cannot be mixed with the campaign inputs')
    elif not args.case_manifest or not args.regression_summary:
        parser.error('Campaign mode needs --case-manifest and --regression-summary')
    output = confined(args.output)
    if output.exists():
        raise FileExistsError('Presence receipts are exclusive: ' + str(output))
    generator = fingerprint(Path(__file__))
    receipt = {'schema': SCHEMA, 'mode': 'synthetic_qualification' if args.report else 'recorded_public_regressions',
               'recordedAt': datetime.now(timezone.utc).isoformat(), 'generator': generator,
               'inputs': [], 'caseManifest': None, 'regressionSummary': None, 'nativeDigest': None,
               'status': 'failed', 'cases': [], 'errors': [], 'qualification': QUALIFICATION,
               'pythonParityClaimed': False, 'gameExecution': False}
    try:
        if args.report:
            path = confined(args.report)
            receipt['inputs'].append(fingerprint(path))
            report = read(path)
            require(isinstance(report.get('syntheticQualification'), str) and report['syntheticQualification']
                    and report.get('game', '').startswith('SYN'),
                    'synthetic_only', 'report', '--report cannot substitute for campaign/game verification')
            result = verify_report(report)
            result.update(game=report.get('game'), report=fingerprint(path))
            receipt['cases'].append(result)
            receipt['nativeDigest'] = result.get('nativeDigest')
            receipt['negativeQualification'] = qualify(report, result)
        else:
            manifest, summary = confined(args.case_manifest), confined(args.regression_summary)
            receipt['caseManifest'], receipt['regressionSummary'] = fingerprint(manifest), fingerprint(summary)
            receipt['inputs'].extend([receipt['caseManifest'], receipt['regressionSummary']])
            campaign(manifest, summary, receipt)
        require(fingerprint(Path(__file__)) == generator
                and all(fingerprint(record['path']) == record for record in receipt['inputs']),
                'inputs_changed', 'inputs', 'Verifier or evidence bytes changed during verification')
        receipt['inputsUnchanged'] = True
        receipt['status'] = 'passed' if receipt['cases'] and all(row['status'] == 'passed' for row in receipt['cases']) \
            and receipt.get('negativeQualification', {'status': 'passed'})['status'] == 'passed' else 'failed'
    except VerificationError as error:
        receipt['errors'].append({'code': error.code, 'where': error.where, 'message': error.message})
    except (OSError, ValueError, KeyError, TypeError) as error:
        receipt['errors'].append({'code': 'input_error', 'where': 'inputs', 'message': f'{type(error).__name__}: {error}'})
    receipt['totals'] = {key: sum(row[key] for row in receipt['cases']) for key in COUNT_FIELDS}
    receipt['totals'].update(cases=len(receipt['cases']), passedCases=sum(row['status'] == 'passed' for row in receipt['cases']))
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as stream:
        json.dump(receipt, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')
    print(json.dumps({'status': receipt['status'], 'mode': receipt['mode'], 'receipt': fingerprint(output),
                      'totals': receipt['totals'], 'errors': receipt['errors'],
                      'caseErrors': [{key: row[key] for key in ('case', 'errors')} for row in receipt['cases'] if row['errors']],
                      'negativeQualification': {key: value for key, value in receipt.get('negativeQualification', {}).items() if key != 'cases'}},
                     ensure_ascii=False))
    return 0 if receipt['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
