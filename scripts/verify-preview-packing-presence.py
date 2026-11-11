#!/usr/bin/env python3
"""Verify captured Preview owner presence without executing a provider or game.

Campaign mode binds exactly the eleven declared replay reports. --report is a
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
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = 'logos-engine.lot6a.preview-owner-presence.v1'
PIN = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
OWNER = 'preview_packing'
NATIVE_SCHEMA = 'native.preview_packing.v1'
FIELDS = {'packing_events', 'packing_model', 'packing_controls', '_packing_scene_cache'}
COLD = {'packing_events': [], 'packing_model': None, 'packing_controls': {}, '_packing_scene_cache': {}}
METHODS = {'propose', 'before', 'after', 'record', 'restoreNative', 'restoreSourceState'}
ANNOTATIONS = {'strategy_receipt', 'morphology', 'composition_target_tree'}
OBSERVATION = re.compile(r'^(.+):epoch:(\d+):revision:(\d+):frame:([0-9a-f]{16})$')
SHA = re.compile(r'^[0-9a-f]{64}$')
COUNT_FIELDS = (
    'prefixes', 'selectedPrefixes', 'foreignPrefixes', 'physicalReturns',
    'selectedReturns', 'foreignReturns', 'selectedRecords', 'passiveReturns',
    'events', 'proposalCalls', 'actualRestores', 'nativeRestores',
    'sourceRestores', 'sourceFactsRetainedPrefixes', 'acquiredSourceFacts',
    'coldPrefixes', 'completedEventCursors',
)
QUALIFICATION = (
    'Read-only consistency of one captured native Preview owner, complete call '
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
    require(isinstance(value, dict) and set(value) == FIELDS,
            'source_state_fields', where, 'Expected exactly the four source fields')
    require(isinstance(value['packing_events'], list)
            and (value['packing_model'] is None or isinstance(value['packing_model'], dict))
            and isinstance(value['packing_controls'], dict)
            and isinstance(value['_packing_scene_cache'], dict),
            'source_state_types', where, 'Malformed source-state containers')
    require(all(re.fullmatch(r'0|[1-9][0-9]*', key) for key in value['_packing_scene_cache']),
            'source_cache_epoch', where, 'Cache keys must be canonical nonnegative epochs')
    return value


def native_state(value, where):
    require(isinstance(value, dict) and set(value) == FIELDS | {'schema'}
            and value['schema'] == NATIVE_SCHEMA,
            'native_state_schema', where, 'Expected exact native.preview_packing.v1 envelope')
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
            and value['proposal_id'] and isinstance(value.get('preview_packing_plan'), dict),
            'selected_proposal', where, 'Selected Preview requires its source proposal')
    plan = value['preview_packing_plan']
    require(isinstance(value.get('actions'), list) and value['actions']
            and isinstance(value.get('steps'), list)
            and isinstance(value.get('bundle_template'), dict)
            and same(value['actions'], plan.get('commands'))
            and same(value['actions'], value['bundle_template'].get('actions'))
            and len(value['steps']) == len(value['actions'])
            and all(isinstance(step, dict) and same(step.get('action'), action)
                    for step, action in zip(value['steps'], value['actions'])),
            'proposal_commands', where, 'Source commands, steps and offered bundle differ')
    require(isinstance(value.get('preview_policy_ref'), str)
            and isinstance(value.get('preview_policy_hash'), str)
            and SHA.fullmatch(value['preview_policy_hash']),
            'proposal_policy', where, 'Missing source-policy identity')
    if 'strategy_receipt' in value:
        receipt = value['strategy_receipt']
        require(isinstance(receipt, dict) and receipt.get('selected') == 'goal_access'
                and receipt.get('workflow') == 'v6.composition_strategy.choose',
                'selected_strategy', where, 'Foreign strategy receipt on Preview proposal')
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
    require(isinstance(events, list) and events, 'event_inventory', 'previewPackingEvents',
            'A complete call/restoration journal is required')
    roots, snapshots = [], {0: COLD}

    def visit(index, depth, current, parent=None):
        event = events[index]
        where = f'previewPackingEvents[{index}]'
        require(isinstance(event, dict), 'event_shape', where, 'Event must be an object')
        method = event.get('method')
        require(integer(event.get('sequence')) and event['sequence'] == index,
                'event_sequence', where, 'Invocation sequence is not complete and ordered')
        require(method in METHODS and event.get('kind') == ('restore' if method.startswith('restore') else 'call'),
                'event_method', where, 'Unknown or inconsistent call/restore kind')
        require(integer(event.get('depthBefore')) and integer(event.get('depthAfter'))
                and event['depthBefore'] == event['depthAfter'] == depth,
                'event_depth', where, 'Malformed nesting depth')
        if depth:
            require(depth == 1 and parent == 'restoreNative' and method == 'restoreSourceState',
                    'event_nesting', where, 'Only an actual native-to-source restore may nest')
        require(event.get('returnedNormally') is True and 'result' in event
                and ((event.get('returnMode') == 'sync' and event.get('completion') == 'returned')
                     or (event.get('returnMode') == 'async' and event.get('completion') == 'resolved')),
                'event_completion', where, 'Pending, failed or missing call result')
        require(same(event.get('observationErrors'), []), 'event_observation_error', where,
                'Passive observation failed or its error inventory is missing')
        args = event.get('arguments')
        lengths = {'propose': 4, 'before': 4, 'after': 6, 'record': 8,
                   'restoreNative': 1, 'restoreSourceState': 1}
        require(isinstance(args, list) and len(args) == lengths[method],
                'event_arguments', where, 'Incomplete captured arguments')
        before = source_state(event.get('sourceBefore'), where + '.sourceBefore')
        after = source_state(event.get('sourceAfter'), where + '.sourceAfter')
        require(same(before, current), 'state_continuity', where, 'Source state changed outside the ordered journal')
        if method.startswith('restore'):
            restored = native_state(args[0], where + '.arguments[0]') if method == 'restoreNative' else source_state(args[0], where + '.arguments[0]')
            require(event['result'] is None and same(restored, after) and same(before, after),
                    'restore_state', where, 'Actual restore must preserve the captured retained state')
        elif method == 'propose':
            observation(args[0], where + '.observation')
            require(all(same(before[key], after[key]) for key in FIELDS - {'_packing_scene_cache'}),
                    'proposal_acquisition', where, 'Proposal acquired source model, controls or events')
            epoch = str(args[0]['level_epoch'])
            require(all(key == epoch or same(value, after['_packing_scene_cache'].get(key))
                        for key, value in before['_packing_scene_cache'].items())
                    and set(after['_packing_scene_cache']) - set(before['_packing_scene_cache']) <= {epoch},
                    'proposal_cache', where, 'Proposal changed a foreign epoch cache')
            result = event['result']
            if result is not None:
                if isinstance(result, dict) and result.get('status') == 'unknown':
                    require(result.get('block_unrelated_probe') is True and not result.get('actions'),
                            'unknown_release', where, 'Unknown cannot release physical actions')
                else:
                    proposal(result, where + '.result')
        elif method in {'before', 'after'}:
            proposal(args[0], where + '.proposal')
            require(integer(args[1]) and same(before, after), 'guard_state', where,
                    'A guard must have a valid index and cannot acquire source state')
            require(isinstance(event['result'], dict), 'guard_result', where, 'Missing guard result')
            if method == 'before':
                require(type(event['result'].get('admitted')) is bool,
                        'guard_result', where, 'Before result must contain an admission boolean')
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
            require(isinstance(result, dict) and set(result) == {'kind', 'events', 'boundary', 'evidence'}
                    and result['kind'] == 'preview_packing_return' and isinstance(result['events'], list)
                    and type(result['boundary']) is bool
                    and same(result['evidence'], [first['observation_ref'], second['observation_ref']]),
                    'record_envelope', where, 'Selected record lost its actual return envelope')
            boundary = first['level_epoch'] != second['level_epoch']
            require(result['boundary'] == boundary and len(result['events']) == (0 if boundary else 1),
                    'record_boundary', where, 'Boundary/event envelope is inconsistent')
            require(same(after['packing_events'], before['packing_events'] + result['events'])
                    and same(after['_packing_scene_cache'], before['_packing_scene_cache']),
                    'record_state', where, 'Acquired event sequence/cache is inconsistent')
            if boundary:
                require(same(before, after), 'record_boundary_state', where, 'Boundary reset retained source state')
            else:
                acquired = result['events'][0]
                require(isinstance(acquired, dict) and acquired.get('kind') == 'observed_preview_packing'
                        and same(acquired.get('model'), after['packing_model'])
                        and same(acquired.get('controls'), after['packing_controls'])
                        and isinstance(acquired.get('detail'), dict)
                        and acquired['detail'].get('before') == first['observation_ref']
                        and acquired['detail'].get('after') == second['observation_ref']
                        and same(acquired['detail'].get('command'), args[2])
                        and acquired['detail'].get('mode') == args[5]['preview_packing_plan'].get('mode'),
                        'acquired_event_state', where, 'Observed acquisition and retained owner differ')
        end = index + 1
        child_state = before
        while end < len(events) and isinstance(events[end], dict) and integer(events[end].get('depthBefore')) and events[end]['depthBefore'] > depth:
            require(method == 'restoreNative' and events[end]['depthBefore'] == depth + 1,
                    'event_nesting', where, 'Unqualified nested call')
            end, child_state = visit(end, depth + 1, child_state, method)
        if end > index + 1:
            require(same(child_state, after), 'nested_restore_state', where, 'Nested restore final state differs')
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
              if key.endswith('Acquisition') and isinstance(value, dict) and 'transitions' in value]
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
        events = report.get('previewPackingEvents')
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
                      sourceRestores=sum(e['method'] == 'restoreSourceState' for e in events))
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
            preview = prefix.get('previewPacking')
            require(isinstance(preview, dict) and 'proposal' in preview
                    and preview.get('stateNode') == 'family_state:preview_packing',
                    'owner_presence', where, 'Missing exact Preview owner checkpoint')
            state = native_state(preview.get('state'), where + '.state')
            instance = source_state(preview.get('instanceSourceState'), where + '.instanceSourceState')
            cursor = preview.get('eventsThrough')
            require(integer(cursor, 1) and previous_cursor < cursor <= len(events) and cursor in snapshots,
                    'event_cursor', where, 'Cursor must end complete calls and cover ordered new events')
            require(same(state, instance) and same(state, snapshots[cursor]),
                    'prefix_state', where, 'Retained envelope, actual instance and journal state differ')
            segment = [item for item in roots if previous_cursor <= item['start'] < cursor]
            require(segment and segment[-1]['event']['method'] == 'restoreNative'
                    and same(segment[-1]['event']['arguments'][0], preview['state']),
                    'prefix_actual_restore', where, 'No actual final native restore of the retained checkpoint')
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
                core = proposal(preview.get('proposal'), where + '.proposal')
                require(prefix.get('proposalKind') == OWNER and prefix.get('selectionGroup') == 'goal_access',
                        'selected_prefix', where, 'Selected prefix lacks its source family/group')
                offers = [item for item in segment if item['event']['method'] == 'propose'
                          and same(item['event']['result'], core)]
                require(offers, 'source_proposal_missing', where, 'Selected proposal was not returned by the actual raw owner')
                require(len(records) == n, 'selected_record_coverage', where, 'Expected exactly one selected record per physical return')
                admitted = [item for item in segment if item['event']['method'] == 'before'
                            and item['event']['result']['admitted'] is True]
                after_guards = [item for item in segment if item['event']['method'] == 'after']
                denied = [item for item in segment if item['event']['method'] == 'before'
                          and item['event']['result']['admitted'] is False]
                require(len(admitted) == len(after_guards) == n and len(denied) <= 1
                        and all(item['event']['arguments'][1] == n
                                and same(item['event']['arguments'][0], preview['proposal']) for item in denied),
                        'selected_guard_inventory', where, 'Extra selected guard has no corresponding physical return')
                acquired_sequence = []
                for index, (item, physical_row, transition) in enumerate(zip(records, physical, common)):
                    event, position = item['event'], item['start']; args = event['arguments']
                    require(args[6] == index and same(args[5], preview['proposal'])
                            and args[0]['revision'] == prefix['decisionRevision'] + index
                            and args[1]['revision'] == prefix['decisionRevision'] + index + 1
                            and args[0]['observation_ref'] == transition['before']
                            and args[1]['observation_ref'] == transition['after']
                            and same(command(args[2], where), command(physical_row['command'], where))
                            and same(command(args[2], where), command(core['actions'][index], where)),
                            'selected_record_binding', where, 'Record is not bound to its unique selected physical return')
                    before_calls = [entry for entry in segment if entry['event']['method'] == 'before'
                                    and entry['event']['arguments'][1] == index
                                    and same(entry['event']['arguments'][0], preview['proposal'])
                                    and entry['event']['result']['admitted'] is True]
                    after_calls = [entry for entry in segment if entry['event']['method'] == 'after'
                                   and entry['event']['arguments'][1] == index
                                   and same(entry['event']['arguments'][0], preview['proposal'])]
                    require(len(before_calls) == len(after_calls) == 1
                            and any(offer['start'] < before_calls[0]['start'] for offer in offers)
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
                    if event['sourceAfter']['packing_model'] is not None:
                        acquired_sequence.append(('restoreSourceState', event['sourceAfter']))
                observed = [item['event'] for item in segment if item['event']['method'] in {'record', 'restoreSourceState'}]
                require(len(observed) == len(acquired_sequence)
                        and all(actual['method'] == method and
                                (same(actual, expected) if method == 'record' else same(actual['arguments'][0], expected))
                                for actual, (method, expected) in zip(observed, acquired_sequence)),
                        'source_restore_coverage', where, 'Each retained-model physical return needs its actual source checkpoint restoration')
                result['selectedRecords'] += len(records)
            else:
                result['foreignPrefixes'] += 1; result['foreignReturns'] += n
                result['passiveReturns'] += len(records)
                require(not records, 'foreign_record', where, 'A foreign physical return acquired a Preview record')
                require(preview.get('proposal') is None, 'foreign_proposal', where, 'Foreign prefix carries a selected Preview proposal')
                require(not any(item['event']['method'] in {'before', 'after'} for item in segment),
                        'foreign_guard', where, 'Foreign prefix invoked selected Preview guards')
                require(len(source_restores) == (n if state['packing_model'] is not None else 0),
                        'foreign_restore_coverage', where, 'Foreign retained-model returns lack exact source restorations')
            require('acquired' in preview and isinstance(preview['acquired'], list)
                    and 'retainedSourceFact' in preview,
                    'missing_source_facts', where, 'Recorder did not retain actual Preview source facts')
            expected_acquired = [{'key': f"preview_packing_event:{item['event']['arguments'][0]['revision']}",
                                  'evidence': item['event']['arguments'][1]['observation_ref'],
                                  'revision': item['event']['arguments'][1]['revision'],
                                  'result': item['event']['result']} for item in records]
            require(same(preview['acquired'], expected_acquired), 'acquired_source_fact', where,
                    'Retained selected source envelopes differ from actual records or contain foreign records')
            result['acquiredSourceFacts'] += len(expected_acquired)
            fact = preview['retainedSourceFact']
            if state['packing_model'] is not None:
                require(isinstance(fact, dict) and set(fact) == {'episode', 'key', 'value', 'evidence', 'revision'}
                        and fact['episode'] == 'common-observation-frontier' and fact['key'] == 'preview_packing_state'
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
            and isinstance(manifest.get('cases'), list) and len(manifest['cases']) == 11,
            'case_manifest', 'caseManifest', 'Exactly eleven declared cases are required')
    cases = manifest['cases']
    require(all(isinstance(item, dict) and isinstance(item.get('id'), str)
                and re.fullmatch(r'[a-z0-9][a-z0-9_-]*', item['id'])
                and isinstance(item.get('game'), str) and item['game'] != 'LKEY' for item in cases)
            and len({item['id'] for item in cases}) == 11
            and sum(item['game'] == 'KATA' for item in cases) == 1,
            'case_population', 'caseManifest', 'Expected ten historical cases and one KATA; closed LKEY is excluded')
    require(isinstance(summary, dict) and summary.get('schema') == 'logos-engine.recorded-public-regressions.v1'
            and summary.get('status') == 'passed' and integer(summary.get('total')) and summary['total'] == 11
            and integer(summary.get('passed')) and summary['passed'] == 11
            and isinstance(summary.get('results'), list) and len(summary['results']) == 11,
            'regression_summary', 'regressionSummary', 'Expected eleven completed successful regression results')
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
            if item['game'] == 'KATA':
                require(result['selectedPrefixes'] > 0 and result['selectedReturns'] > 0,
                        'kata_selection', where, 'KATA must exercise actual selected Preview returns')
            else:
                require(result['selectedPrefixes'] == result['selectedReturns'] == result['selectedRecords'] == 0,
                        'historical_selection', where, 'Historical cases must not acquire Preview records')


def qualify(report, baseline):
    """Mutate only detached evidence copies; never feed a state into a runtime."""
    if baseline['status'] != 'passed':
        return {'status': 'not_run', 'reason': 'Unchanged report fails; no passing baseline is invented', 'cases': []}
    tests = []
    def add(name, expected, mutation):
        changed = deepcopy(report)
        mutation(changed)
        observed = verify_report(changed)
        codes = [error['code'] for error in observed['errors']]
        tests.append({'case': name, 'expectedError': expected, 'rejected': observed['status'] == 'failed',
                      'expectedErrorObserved': expected in codes, 'errors': observed['errors'],
                      'mutatedEvidenceDigest': digest(changed)})
    def event(value, method):
        return next(row for row in value['previewPackingEvents'] if row['method'] == method)
    add('event-sequence-gap', 'event_sequence', lambda value: value['previewPackingEvents'][1].update(sequence=99))
    add('boolean-sequence', 'event_sequence', lambda value: value['previewPackingEvents'][1].update(sequence=True))
    add('unfinished-call', 'event_completion', lambda value: value['previewPackingEvents'][0].update(completion='pending', returnedNormally=False))
    add('observation-error', 'event_observation_error', lambda value: value['previewPackingEvents'][0]['observationErrors'].append({'field': 'sourceBefore', 'error': 'synthetic'}))
    add('unqualified-nesting', 'event_depth', lambda value: value['previewPackingEvents'][0].update(depthBefore=1, depthAfter=1))
    add('missing-restore-result', 'event_completion', lambda value: event(value, 'restoreNative').pop('result'))
    add('restore-schema', 'native_state_schema', lambda value: event(value, 'restoreNative')['arguments'][0].update(schema='native.foreign.v1'))
    add('changed-call-state', 'state_continuity', lambda value: event(value, 'propose')['sourceBefore']['packing_controls'].update(foreign={}))
    add('boolean-prefix-cursor', 'event_cursor', lambda value: value['prefixes'][0]['previewPacking'].update(eventsThrough=True))
    add('boolean-prefix-return-count', 'prefix_return_coverage', lambda value: value['prefixes'][0].update(callerAcquiredTransitions=True))
    add('missing-final-cursor', 'uncovered_events', lambda value: value['prefixes'].pop())
    add('changed-prefix-state', 'prefix_state', lambda value: value['prefixes'][0]['previewPacking']['state'].update(packing_model=None))
    add('extra-native-field', 'native_state_schema', lambda value: value['prefixes'][0]['previewPacking']['state'].update(foreign=[]))
    add('physical-order', 'physical_sequence', lambda value: value['actions'][0].update(sequence=2))
    add('physical-packet', 'physical_packet_binding', lambda value: value['actions'][0].update(publicPacketSha256='0' * 64))
    add('missing-source-facts', 'missing_source_facts', lambda value: value['prefixes'][0]['previewPacking'].pop('retainedSourceFact'))
    add('changed-retained-source-fact', 'retained_source_fact', lambda value: value['prefixes'][0]['previewPacking']['retainedSourceFact'].update(revision=999))
    add('missing-selected-envelope', 'acquired_source_fact', lambda value: value['prefixes'][0]['previewPacking']['acquired'].clear())
    def foreign(value):
        prefix = value['prefixes'][0]
        prefix.update(family='synthetic_foreign', proposalKind='synthetic_foreign', selectionGroup='synthetic_foreign')
        prefix['previewPacking']['proposal'] = None
        for row in value['actions'][:prefix['acquiredActions']]:
            row['family'] = 'synthetic_foreign'
    add('record-on-foreign-physical-return', 'foreign_record', foreign)
    def extra_after(value):
        index = next(index for index, row in enumerate(value['previewPackingEvents']) if row['method'] == 'after') + 1
        extra = deepcopy(value['previewPackingEvents'][index - 1])
        extra['arguments'][1] = 999
        value['previewPackingEvents'].insert(index, extra)
        for number, row in enumerate(value['previewPackingEvents']):
            row['sequence'] = number
        for prefix in value['prefixes']:
            if prefix['previewPacking']['eventsThrough'] >= index:
                prefix['previewPacking']['eventsThrough'] += 1
    add('extra-after-guard-with-renumbered-events', 'selected_guard_inventory', extra_after)
    def omit_restore(value):
        target = next(index for index, row in enumerate(value['previewPackingEvents']) if row['method'] == 'restoreSourceState')
        del value['previewPackingEvents'][target]
        for index, row in enumerate(value['previewPackingEvents']):
            row['sequence'] = index
        for prefix in value['prefixes']:
            if prefix['previewPacking']['eventsThrough'] > target:
                prefix['previewPacking']['eventsThrough'] -= 1
    add('missing-actual-source-restore-with-renumbered-events', 'source_restore_coverage', omit_restore)
    def omit_native_restore(value):
        cursor = value['prefixes'][0]['previewPacking']['eventsThrough']
        del value['previewPackingEvents'][cursor - 1]
        for index, row in enumerate(value['previewPackingEvents']):
            row['sequence'] = index
        for prefix in value['prefixes']:
            prefix['previewPacking']['eventsThrough'] -= 1
    add('missing-actual-native-restore-with-renumbered-events', 'prefix_actual_restore', omit_native_restore)
    return {'status': 'passed' if all(row['rejected'] and row['expectedErrorObserved'] for row in tests) else 'failed',
            'baselineMustPass': True, 'cases': tests, 'mutations': len(tests),
            'rejected': sum(row['rejected'] for row in tests),
            'expectedErrorsObserved': sum(row['expectedErrorObserved'] for row in tests),
            'scope': 'Detached synthetic evidence mutations only; no capture rewrite, provider import, game or parity execution.'}


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
