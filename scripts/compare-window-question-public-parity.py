#!/usr/bin/env python3
"""Replay unchanged WindowQuestion cold over an actual captured public sequence.

  python3 -B scripts/compare-window-question-public-parity.py CAMPAIGN.json.gz \
    --trace PUBLIC-TRACE.json.gz --output NEW-COMPARISON.json.gz

Only public observations, rasters, candidates, budgets, commands and returned
packets feed the original. Native owner states and proposals are comparands,
never initialization. The original keeps its own produced proposals. Every
actual return, including an original None, must occur once in the ordered
recordSource stream and once in sealed public transitions. No game, native
agent, original common caller, performance sample or new success is executed.
Native cancellation/deadline refusals remain named adaptations; a native wall
clock is never reconstructed from an unrecorded elapsed duration.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import datetime, timezone
import faulthandler
import fcntl
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import tempfile
import time
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = SOURCE.parent / 'manifest.json'
FIELDS = {'epoch', 'edits', 'portable', 'launches', 'attempts', 'last'}
OWNER = 'family_state:public_window_question'
FORMAT = 'native.public_window_question.v1'
EPISODE = 'common-observation-frontier'
OBSERVATION = re.compile(r'(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]{16})')
ARITIES = {'propose': 4, 'before': 4, 'recordSource': 8}
PACKET_FIELDS = ('frame_rows', 'frame_packet', 'level', 'levels_completed', 'state',
                 'step_index', 'available_action_refs', 'frame_hash')
INTERVENTIONS = {'remove_edits': ['edits'], 'remove_portable': ['portable'],
                 'remove_attempts': ['attempts'], 'remove_all_methods': ['edits', 'portable']}
sys.dont_write_bytecode = True
_PROGRESS_STARTED_NS = None
_PROGRESS_WRITE_FAILED = False
_TRACEBACK_TIMER_STARTED = False
_OBSERVABILITY_ERRORS = []
_OBSERVABILITY_ERROR_COUNT = 0
TRACEBACK_INTERVAL_SECONDS = 30
MAX_OBSERVABILITY_ERRORS = 8


def _observability_error(operation, error):
    """A bounded, separate best-effort log; it cannot change source parity."""
    global _OBSERVABILITY_ERROR_COUNT
    try:
        _OBSERVABILITY_ERROR_COUNT += 1
        if len(_OBSERVABILITY_ERRORS) >= MAX_OBSERVABILITY_ERRORS:
            return
        try:
            message = str(error)[:256]
        except Exception:
            message = '<exception text unavailable>'
        row = {'operation': operation, 'errorType': type(error).__name__, 'message': message}
        _OBSERVABILITY_ERRORS.append(row)
        try:
            print(json.dumps({'event': 'window_source_parity_observability_error', **row},
                             allow_nan=False, separators=(',', ':')), file=sys.__stderr__, flush=True)
        except Exception:
            pass  # An unavailable diagnostic stream must not prevent the parity receipt.
    except Exception:
        pass


def diagnostic_progress(stage, **fields):
    """Small flushed progress records only; never an intermediate parity result."""
    global _PROGRESS_WRITE_FAILED
    if _PROGRESS_STARTED_NS is None or _PROGRESS_WRITE_FAILED:
        return
    try:
        row = {'event': 'window_source_parity_progress', 'stage': stage,
               'recordedAt': datetime.now(timezone.utc).isoformat(),
               'elapsedSeconds': (time.monotonic_ns() - _PROGRESS_STARTED_NS) / 1_000_000_000,
               **fields}
        print(json.dumps(row, allow_nan=False, separators=(',', ':')), file=sys.stderr, flush=True)
    except Exception as error:
        _PROGRESS_WRITE_FAILED = True
        _observability_error('progress_write', error)


def start_diagnostics():
    global _PROGRESS_STARTED_NS, _TRACEBACK_TIMER_STARTED
    try:
        _PROGRESS_STARTED_NS = time.monotonic_ns()
    except Exception as error:
        _observability_error('progress_clock_start', error)
    try:
        faulthandler.enable(file=sys.stderr, all_threads=True)
    except Exception as error:
        _observability_error('faulthandler_enable', error)
    try:
        faulthandler.dump_traceback_later(TRACEBACK_INTERVAL_SECONDS, repeat=True, file=sys.stderr)
        _TRACEBACK_TIMER_STARTED = True
    except Exception as error:
        _observability_error('faulthandler_timer_start', error)
    diagnostic_progress('observability_started', tracebackIntervalSeconds=TRACEBACK_INTERVAL_SECONDS,
                        sourceProfilingUnchanged=True, progressIsNotAParityReceipt=True)


def stop_diagnostics():
    global _PROGRESS_STARTED_NS, _TRACEBACK_TIMER_STARTED
    if _TRACEBACK_TIMER_STARTED:
        try:
            faulthandler.cancel_dump_traceback_later()
        except Exception as error:
            _observability_error('faulthandler_timer_stop', error)
        _TRACEBACK_TIMER_STARTED = False
    _PROGRESS_STARTED_NS = None
    if _OBSERVABILITY_ERRORS:
        try:
            print(json.dumps({'event': 'window_source_parity_observability_error_summary',
                              'errors': _OBSERVABILITY_ERRORS, 'totalErrors': _OBSERVABILITY_ERROR_COUNT,
                              'sourceParityVerdictUnaffected': True}, allow_nan=False, separators=(',', ':')),
                  file=sys.__stderr__, flush=True)
        except Exception:
            pass


def require(condition, message):
    if not condition:
        raise ValueError(message)


def plain(value):
    if hasattr(value, 'model_dump'):
        return plain(value.model_dump())
    if isinstance(value, dict):
        return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [plain(item) for item in value]
    if isinstance(value, (set, frozenset)):
        return [plain(item) for item in sorted(value)]
    return value


def encoded(value):
    return json.dumps(plain(value), allow_nan=False, sort_keys=True, ensure_ascii=False,
                      separators=(',', ':')).encode()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def digest(value):
    return sha(encoded(value))


def path_label(path):
    return path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)


def fingerprint(path):
    checksum, size = hashlib.sha256(), 0
    with path.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(part)
            size += len(part)
    return {'path': path_label(path), 'bytes': size, 'sha256': checksum.hexdigest()}


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, 'Duplicate JSON property: ' + key)
        value[key] = item
    return value


def invalid_number(value):
    raise ValueError('Non-JSON numeric constant: ' + value)


def read_json(path):
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rt', encoding='utf8') as stream:
        return json.load(stream, object_pairs_hook=unique_object, parse_constant=invalid_number)


def error_value(error):
    return {'name': type(error).__name__, 'message': str(error),
            **({'cause': error.cause} if hasattr(error, 'cause') else {}),
            **({'frontier': plain(error.frontier)} if hasattr(error, 'frontier') else {})}


def verify_originals():
    manifest = read_json(MANIFEST)
    require(manifest.get('commit') == COMMIT and len(manifest.get('files', {})) == 1786,
            'Expected the pinned commit and exactly 1786 original files')
    inventory = {}
    for name, expected in manifest['files'].items():
        actual = fingerprint(SOURCE / name)
        require(actual['bytes'] == expected['bytes'] and actual['sha256'] == expected['sha256'],
                'Pinned original bytes changed: ' + name)
        inventory[name] = {'bytes': actual['bytes'], 'sha256': actual['sha256']}
    return {'commit': COMMIT, 'filesVerified': len(inventory), 'inventoryDigest': digest(inventory),
            'manifest': fingerprint(MANIFEST)}


def existing_bytecode():
    inventory = [fingerprint(path) for path in sorted(SOURCE.rglob('*.pyc'))]
    return {'files': len(inventory), 'inventoryDigest': digest(inventory)}


def differences(source, native, path=''):
    """Exact JSON keys, types and order; JSON numeric values may be 1 or 1.0."""
    source, native = plain(source), plain(native)
    if isinstance(source, dict) and isinstance(native, dict):
        result = []
        for key in sorted(set(source) | set(native)):
            where = f'{path}.{key}' if path else key
            if key not in source or key not in native:
                result.append({'path': where, 'sourcePresent': key in source, 'nativePresent': key in native,
                    **({'source': source[key]} if key in source else {}),
                    **({'native': native[key]} if key in native else {})})
            else:
                result.extend(differences(source[key], native[key], where))
        return result
    if isinstance(source, list) and isinstance(native, list) and len(source) == len(native):
        return [item for index, (a, b) in enumerate(zip(source, native))
                for item in differences(a, b, f'{path}[{index}]')]
    if isinstance(source, (int, float)) and not isinstance(source, bool) \
            and isinstance(native, (int, float)) and not isinstance(native, bool):
        if math.isfinite(source) and math.isfinite(native) and source == native:
            return []
    elif type(source) is type(native) and source == native:
        return []
    return [{'path': path, 'source': source, 'native': native}]


def state(value):
    value = plain(value)
    require(isinstance(value, dict) and set(value) == FIELDS, 'Expected exactly the six original Window owner fields')
    require(value['epoch'] is None or type(value['epoch']) is int, 'Malformed source epoch')
    for name in ('edits', 'portable', 'launches'):
        require(isinstance(value[name], list) and all(isinstance(item, dict) for item in value[name]),
                'Malformed Window source list: ' + name)
    require(isinstance(value['attempts'], dict), 'Malformed source attempts')
    require(value['last'] is None or isinstance(value['last'], dict), 'Malformed source last')
    return value


def publishable(value):
    return bool(value['edits'] or value['portable'] or value['attempts'])


def checkpoint(value):
    require(isinstance(value, dict) and set(value) == {'format', 'source_state'} and value['format'] == FORMAT,
            'Malformed or foreign complete Window checkpoint')
    return state(value['source_state'])


def decision(proposal):
    if proposal is None:
        return {'status': 'no_proposal', 'actions': []}
    offer = proposal.get('window_question_plan', {}).get('offer', {})
    return {'status': proposal.get('status'), 'kind': proposal.get('kind'), 'actions': proposal.get('actions', []),
            'questionKind': offer.get('kind'), 'key': offer.get('key'), 'cost': offer.get('cost')}


def transport_command(value):
    require(isinstance(value, dict) and re.fullmatch(r'ACTION[1-7]', value.get('action_ref', '')), 'Malformed public command')
    # The browser host explicitly fills empty data on non-pointed actions.
    # Source and sealed-prefix commands are compared in full before this view.
    data = value.get('data', {})
    require(isinstance(data, dict) and (value['action_ref'] == 'ACTION6' or not data), 'Unexpected non-pointed payload')
    return {'action_ref': value['action_ref'], 'data': data}


def packet_hash(value):
    require(isinstance(value, dict) and all(key in value for key in PACKET_FIELDS), 'Missing complete public packet')
    # Exact insertion order of packetHash in the campaign harness. Unlike a
    # diagnostic digest, this hash deliberately does not sort object keys.
    return sha(json.dumps({key: value[key] for key in PACKET_FIELDS}, allow_nan=False,
                          ensure_ascii=False, separators=(',', ':')).encode())


def compare_campaign(campaign, trace, family_class, observer, geometry, *, _checkpoint_scope=None):
    require(campaign.get('referenceCommit') == COMMIT, 'Unexpected campaign reference commit')
    if _checkpoint_scope is None:
        require(campaign.get('status') in ('passed', 'failed'), 'A complete report is required; a running journal is not a campaign')
    else:
        # Only the distinct checkpoint verifier uses this explicit internal
        # path, after verifying the wrapper, archive, checkpoint and journal.
        # The normal CLI still refuses every running/partial campaign.
        require(_checkpoint_scope.get('schema') == 'logos-engine.window-question-verified-checkpoint-scope.v1'
                and _checkpoint_scope.get('completeCampaign') is False
                and _checkpoint_scope.get('historicalExecutionVerified') is True,
                'Partial history requires its separately verified historical execution scope')
        require(campaign.get('status') == 'running' and 'final' not in campaign
                and 'sourceUnchangedDuringRun' not in campaign,
                'Never fabricate a final result or a sourceUnchangedDuringRun field for a checkpoint')
    require(campaign.get('windowCaptureErrors') == [], 'The passive Window collector reported an observation failure')
    calls, restores, prefixes, actions = (campaign.get(key) for key in
        ('windowSourceCalls', 'windowRestoreCalls', 'prefixes', 'actions'))
    require(isinstance(calls, list) and calls, 'Missing actual Window source calls')
    require(all(isinstance(value, list) for value in (restores, prefixes, actions)), 'Missing complete capture inventories')
    diagnostic_progress('comparison_started', sourceCalls=len(calls), nativeRestores=len(restores),
                        sealedPrefixes=len(prefixes), physicalActions=len(actions))
    if _checkpoint_scope is None:
        require(campaign.get('final', {}).get('actions') == len(actions), 'Final action count differs from the complete action inventory')
        require(isinstance(trace, dict) and trace.get('schema') == 'logos-engine.native-public-game-trace.v1'
                and trace.get('game') == campaign.get('game') and trace.get('status') == campaign.get('status')
                and trace.get('sourceDigest') == campaign.get('source', {}).get('digest'), 'The public trace is not bound to this campaign')
        packets = trace.get('packets')
    else:
        require(trace is None and _checkpoint_scope.get('sealedActions') == len(actions),
                'Partial comparison must use only the complete journal prefix declared by its verifier')
        packets = _checkpoint_scope.get('publicJournalPrefix')
    require(isinstance(packets, list) and len(packets) == len(actions) + 1 and packets[0].get('command') is None,
            'The complete initial packet and every actual public return are required')
    for ordinal, item in enumerate(packets):
        require(isinstance(item, dict) and set(item) == {'command', 'packet'}
                and isinstance(item['packet'], dict) and set(item['packet']) == set(PACKET_FIELDS)
                and item['packet']['step_index'] == ordinal and isinstance(item['packet']['frame_packet'], list),
                'Malformed or unordered complete public trace packet')
        if ordinal:
            require(not differences(transport_command(item['command']), transport_command(actions[ordinal - 1].get('command'))),
                    'Public trace command differs from the actual action inventory')
    require(campaign.get('initial', {}).get('publicPacketSha256') == packet_hash(packets[0]['packet']),
            'The original public trace packet does not match the initial host fingerprint')
    family = family_class()
    initial = state(family.state())
    require(initial == {'epoch': None, 'edits': [], 'portable': [], 'launches': [], 'attempts': {}, 'last': None},
            'The original Window owner is not cold')
    report = {'coldStart': True, 'nativeStatesUsedToPrimeSource': False, 'nativePlansUsedToAcquireSource': False,
        'initialSourceState': initial, 'callChecks': [], 'publicObservationChecks': [], 'nativeRestorationChecks': [],
        'sourcePublicationChecks': [], 'prefixChecks': [], 'guardCoverage': [], 'nextChoiceChecks': [],
        'restorationChecks': [], 'ablations': [], 'nativeAdaptations': [], 'callerAnnotations': [],
        'differences': [], 'stop': None,
        'publicTraceBinding': {'completePackets': len(packets), 'initialPacketSha256': packet_hash(packets[0]['packet']),
            'nativeFramesUsedToInventTrace': False,
        'qualification': ('The separately retained complete public host trace is compared to every source observation and acquired packet; no initial animation packet is inferred.'
            if _checkpoint_scope is None else 'Only the declared initial packet and sealed-action prefix of the actual retained public journal are compared. Later observed returns remain outside acquired source parity; no final trace or result is fabricated.')},
        'eventFactCaptureScope': {'observedFields': ['episode', 'key', 'value', 'evidence', 'revision'],
            'episodeObservedInEventCapture': True, 'sourceEpisode': EPISODE,
            'qualification': 'The complete reasoning event fact and retained window_question_state fact are compared, including their actual episode and evidence/revision metadata.'},
        'normalizations': [
            {'field': 'selectedProposal.material_access_subquestion', 'rule': 'Only the exact window_question entry annotation'},
            {'field': 'selectedProposal.strategy_receipt/morphology/composition_target_tree',
             'rule': 'Named common-caller annotations outside Window; retained verbatim and scoped before comparison'},
            {'field': 'actions[].command.data', 'rule': 'Only the public host empty object on non-pointed commands; source/prefix commands stay exact'}]}
    observations, by_reference, proposals = {}, {}, defaultdict(list)
    records, guards, snapshots, publications = [], [], {0: deepcopy(initial)}, {0: None}
    next_restore, last_publication, last_record = 0, None, None
    record_keys, source_scopes = set(), set()

    def compare(left, right, where):
        delta = differences(left, right, where)
        report['differences'].extend(delta)
        return delta

    def replay_restores(cursor):
        nonlocal next_restore
        while next_restore < len(restores):
            row = restores[next_restore]
            require(isinstance(row, dict) and type(row.get('sourceCallsBefore')) is int and row['sourceCallsBefore'] >= cursor,
                    'Native restores have a stale or malformed source cursor')
            if row['sourceCallsBefore'] != cursor:
                break
            require(row.get('index') == next_restore and row.get('method') == 'restoreNative'
                    and row.get('stream') == 'restore', 'Unordered or foreign native restore')
            require(row.get('sourceCallsAfter') == cursor and row.get('sourceDepthBefore') == 0
                    and row.get('sourceDepthAfter') == 0, 'Native restoration intersects an unfinished source call')
            require(row.get('completion') == 'returned' and row.get('returnMode') == 'sync'
                    and not row.get('error') and row.get('observationErrors') == [], 'Native restore did not complete cleanly')
            diagnostic_progress('native_restore_started', restoreIndex=next_restore, sourceCursor=cursor)
            before = state(family.state())
            delta = compare(before, state(row.get('sourceBefore')), f'restores[{next_restore}].sourceBefore')
            delta += compare(before, checkpoint(row.get('nativeInput')), f'restores[{next_restore}].nativeInput')
            family.restore(deepcopy(before))  # Only independently acquired original state.
            after = state(family.state())
            delta += compare(before, after, f'restores[{next_restore}].originalRoundTrip')
            delta += compare(after, state(row.get('sourceAfter')), f'restores[{next_restore}].sourceAfter')
            report['nativeRestorationChecks'].append({'restoreIndex': next_restore, 'sourceCallsThrough': cursor,
                'stateOrigin': 'this cold original owner only', 'nativeStateSeed': False,
                'sourceBeforeDigest': digest(before), 'sourceAfterDigest': digest(after), 'differences': len(delta), 'passed': not delta})
            snapshots[cursor] = deepcopy(after)
            diagnostic_progress('native_restore_completed', restoreIndex=next_restore, differences=len(delta))
            next_restore += 1

    def proposal_core(value, where, selected=False):
        if value is None:
            return None
        require(isinstance(value, dict), 'Proposal must be an object or null')
        result = deepcopy(value)
        if 'material_access_subquestion' in result:
            require(result['material_access_subquestion'] == 'window_question', 'Foreign material entry on a Window proposal')
            report['callerAnnotations'].append({'path': where + '.material_access_subquestion',
                'value': result.pop('material_access_subquestion'), 'origin': 'declared factored_material_return entry adapter'})
        if selected:
            for key in ('strategy_receipt', 'morphology', 'composition_target_tree'):
                if key not in result:
                    continue
                value = result[key]
                require(isinstance(value, dict), 'Malformed common caller annotation: ' + key)
                if key == 'strategy_receipt':
                    require(value.get('selected') == 'factored_material_return'
                            and value.get('workflow') == 'v6.composition_strategy.choose', 'Foreign selected-group receipt')
                if key == 'composition_target_tree':
                    bound, template = result.get('binding', {}), result.get('bundle_template', {})
                    require(value.get('admitted') is True and value.get('observation_ref') == bound.get('observation_ref')
                            and value.get('level_epoch') == bound.get('level_epoch')
                            and value.get('root') == template.get('objective_ref')
                            and isinstance(value.get('path'), list) and len(value['path']) >= 2
                            and value['path'][0] == value['root'] and value['path'][-1] == template.get('composition_ref'),
                            'Target-tree annotation is not bound to this selected offer')
                report['callerAnnotations'].append({'path': where + '.' + key, 'value': result.pop(key),
                    'origin': 'common selection/authority after original family proposal; not removed from evidence'})
        return result

    def own_proposal(native, where, frozen=False):
        core = proposal_core(native, where, selected=True)
        require(isinstance(core, dict) and core.get('kind') == 'public_window_question'
                and 'window_question_plan' in core, 'Selected Window call received a foreign proposal')
        candidates = proposals.get(core.get('binding', {}).get('observation_ref'), [])
        require(candidates, 'No earlier independently produced original proposal binds this selection')
        field = 'snapshot' if frozen else 'value'
        exact = [item for item in candidates if not differences(item[field], core)]
        chosen = (exact or candidates)[-1]
        compare(chosen[field], core, where + '.originalProposal')
        return chosen['value'], chosen['index'], chosen['snapshot']

    def public_observation(value, rows, call_index, side, explicit_packet=None):
        require(isinstance(value, dict), 'Missing public observation')
        reference = value.get('observation_ref')
        match = OBSERVATION.fullmatch(reference or '')
        require(match is not None, 'Captured observation lacks a source-shaped public reference')
        source_scopes.add(match[1])
        key = (reference, digest(rows), digest(value), digest(explicit_packet))
        if key in observations:
            return deepcopy(observations[key])
        raster_hash = sha(json.dumps(rows, allow_nan=False, separators=(',', ':')).encode())[:16]
        packet = {'frame_rows': rows, 'level': value['level_epoch'], 'levels_completed': value['levels_completed'],
                  'state': value['state'], 'available_action_refs': value['available_action_refs'], 'frame_hash': raster_hash}
        trace_index = value['revision'] - 1
        require(type(trace_index) is int and 0 <= trace_index < len(packets), 'Public observation revision is outside the complete trace')
        actual_packet = packets[trace_index]['packet']
        compare({name: actual_packet[name] for name in packet}, packet, f'calls[{call_index}].public.{side}.actualTrace')
        if explicit_packet is not None:
            require(isinstance(explicit_packet, dict) and all(name in explicit_packet for name in packet),
                    'Guard lacks its complete public packet')
            compare(packet, {name: explicit_packet[name] for name in packet}, f'calls[{call_index}].public.{side}.packet')
            compare(actual_packet, explicit_packet, f'calls[{call_index}].public.{side}.completeGuardPacket')
            packet.update({name: explicit_packet[name] for name in packet})
        measured = plain(observer(SimpleNamespace(**packet), value['revision'], match[1])[0])
        delta = compare(measured, value, f'calls[{call_index}].public.{side}')
        retained = {'rows': deepcopy(rows), 'observation': deepcopy(value)}
        if reference in by_reference:
            compare(by_reference[reference], retained, f'calls[{call_index}].public.{side}.repeatedReference')
        else:
            by_reference[reference] = retained
        report['publicObservationChecks'].append({'callIndex': call_index, 'side': side, 'observationRef': reference,
            'rasterDigest': digest(rows), 'originalObservationDigest': digest(measured),
            'nativeObservationDigest': digest(value), 'differences': len(delta)})
        observations[key] = measured
        return deepcopy(measured)

    def ablations(index, args, before, actual, after):
        diagnostic_progress('restoration_proposal_started', callIndex=index)
        restored = family_class()
        restored.restore(deepcopy(before))
        restored_value = plain(restored.propose(*deepcopy(args)))
        delta = compare(actual, restored_value, f'calls[{index}].restoration.proposal')
        delta += compare(after, state(restored.state()), f'calls[{index}].restoration.state')
        report['restorationChecks'].append({'callIndex': index, 'nativeStateSeed': False,
            'stateOrigin': 'independent original replay only', 'differences': len(delta), 'passed': not delta})
        diagnostic_progress('restoration_proposal_completed', callIndex=index, differences=len(delta))
        for name, fields in INTERVENTIONS.items():
            diagnostic_progress('ablation_started', callIndex=index, intervention=name)
            modified = deepcopy(before)
            removed = {field: modified[field] for field in fields}
            for field in fields:
                modified[field] = {} if field == 'attempts' else []
            row = {'callIndex': index, 'intervention': name, 'fields': fields,
                'stateOrigin': 'cold original acquired state only', 'nativeStateSeed': False,
                'removed': removed, 'interventionApplied': any(bool(value) for value in removed.values()),
                'removedCount': sum(len(value) for value in removed.values()),
                'sourceStateBeforeDigest': digest(before), 'intervenedStateDigest': digest(modified),
                'allOtherOwnerFieldsPreserved': not differences({k: before[k] for k in FIELDS - set(fields)},
                                                               {k: modified[k] for k in FIELDS - set(fields)}),
                'actualDecision': decision(actual), 'actualProposalDigest': digest(actual),
                'qualification': 'Same public arguments and original component only. No new game, arbitration or whole-game causal improvement is claimed.'}
            try:
                alternative = family_class()
                alternative.restore(modified)
                value = plain(alternative.propose(*deepcopy(args)))
                delta = differences(actual, value)
                action_changed = bool(differences(None if actual is None else actual['actions'],
                                                 None if value is None else value['actions']))
                row.update(executed=True, counterfactualProposal=value, counterfactualDecision=decision(value),
                    counterfactualProposalDigest=digest(value), counterfactualSourceAfterDigest=digest(state(alternative.state())),
                    proposalDifferences=delta, strictProposalChanged=bool(delta), actionOrRefusalChanged=action_changed,
                    metadataOnlyChanged=bool(delta) and not action_changed)
            except Exception as error:
                row.update(executed=False, error=error_value(error), actionOrRefusalChanged=None)
            report['ablations'].append(row)
            diagnostic_progress('ablation_completed', callIndex=index, intervention=name,
                                executed=row['executed'], interventionApplied=row['interventionApplied'])

    def native_adaptation(index, captured, args, source_value, source_error, before, after):
        method, receipt = captured['method'], captured.get('nativeAdaptation')
        require(method in ('propose', 'before') and isinstance(receipt, dict), 'Unknown native adaptation surface')
        obs, rows = (args[0], args[1]) if method == 'propose' else (args[3], args[2].frame_rows)
        required = {'status': 'unknown', 'source_owner': 'public_window_question', 'observation_ref': obs['observation_ref'],
            'level_epoch': obs['level_epoch'], 'frame_hash': obs['frame_hash'], 'release_authority': False,
            'domain_complete': False, 'status_is_not_an_acquired_refutation': True}
        require(set(receipt) == set(required) | {'reason', 'search'}, 'Unexpected native refusal fields')
        delta = compare(required, {key: receipt[key] for key in required}, f'calls[{index}].nativeAdaptation.binding')
        search, reason = receipt['search'], receipt['reason']
        require(isinstance(search, dict) and search.get('truncated') is True, 'A native refusal must expose incomplete search')
        expected_native = None if method == 'propose' else {'admitted': False, 'reason': 'window_question_search_incomplete'}
        delta += compare(expected_native, captured['result'], f'calls[{index}].nativeAdaptation.noAuthority')
        scoped = family_class()
        scoped.restore(deepcopy(before))
        if method == 'propose':
            scoped.scope(obs)
        delta += compare(scoped.state(), after, f'calls[{index}].nativeAdaptation.scopeOnlyState')
        row = {'callIndex': index, 'reason': reason, 'receipt': deepcopy(receipt),
            'originalResultUnderFixedProjectionClock': plain(source_value), 'originalErrorUnderFixedProjectionClock': source_error,
            'exactOriginalReturnParityClaimed': False, 'noAuthority': True, 'noAcquiredAttempts': not differences(before['attempts'], after['attempts'])
                if before['epoch'] == after['epoch'] else not after['attempts']}
        if reason == 'window_question_configuration_bound':
            measured = geometry.measure(rows)
            require(measured is not None, 'Configuration refusal lacks an original measured interface')
            candidates, bound = geometry.plans(measured, family.policy.config['model'])
            require(not candidates and bound.get('truncated') is True, 'Original source does not reproduce the configuration refusal')
            expected = plain(bound)
            if bound['domain'] > 2**53 - 1:
                expected['domain'] = str(bound['domain'])
                expected['native_domain_format'] = 'exact_decimal_integer'
                row['integerTransportAdaptation'] = 'Exact decimal only on an already truncated no-plan branch'
            delta += compare(expected, search, f'calls[{index}].nativeAdaptation.originalBound')
            require(source_error is None and (source_value is None if method == 'propose' else source_value.get('admitted') is False),
                    'Original bound did not refuse its action')
        elif reason == 'window_question_projection_budget':
            require(set(search) == {'truncated', 'source_computation_interrupted'}, 'Malformed source projection refusal')
            interruption = search['source_computation_interrupted']
            require(isinstance(interruption, dict) and set(interruption) == {'cause', 'frontier'}, 'Malformed source interruption')
            if interruption['cause'] == 'TIME_BOUND':
                row['temporalQualification'] = 'Native elapsed projection time is not reconstructible; only scoped safe refusal/state is checked.'
            else:
                require(source_error is not None, 'Original finite-work projection did not interrupt')
                delta += compare(interruption, {key: source_error.get(key) for key in ('cause', 'frontier')},
                                 f'calls[{index}].nativeAdaptation.originalInterruption')
        elif reason == 'window_question_search_incomplete':
            require(set(search) <= {'truncated', 'domain', 'native_domain_format', 'native_search_incomplete'}
                    and 'native_search_incomplete' in search, 'Malformed native scheduling refusal')
            interruption = search['native_search_incomplete']
            require(isinstance(interruption, dict) and set(interruption) == {'reason', 'frontier'}
                    and interruption['reason'] in ('native_abort', 'native_deadline')
                    and isinstance(interruption['frontier'], dict), 'Unknown native scheduling interruption')
            row['temporalQualification'] = 'Current native cancellation/deadline is explicitly outside synchronous original return parity; no timing is invented.'
        else:
            raise ValueError('Unrecognized native refusal: ' + str(reason))
        row.update(differences=len(delta), passed=not delta)
        report['nativeAdaptations'].append(row)
        return delta

    for index, captured in enumerate(calls):
        try:
            diagnostic_progress('source_call_started', callIndex=index,
                                method=captured.get('method') if isinstance(captured, dict) else None)
            replay_restores(index)
            require(isinstance(captured, dict) and captured.get('index') == index and captured.get('stream') == 'source',
                    'Source call indices must be complete and ordered from zero')
            require(captured.get('completion') == 'returned' and not captured.get('error')
                    and captured.get('observationErrors') == [], 'A captured source call did not return cleanly')
            require(captured.get('sourceDepthBefore') == 0 and captured.get('sourceDepthAfter') == 0,
                    'Nested or overlapping Window source calls are not a serial acquired history')
            method, args = captured.get('method'), deepcopy(captured.get('arguments'))
            require(method in ARITIES and isinstance(args, list) and len(args) == ARITIES[method], 'Unexpected source method or arity')
            require(captured.get('returnMode') == ('sync' if method == 'recordSource' else 'async'), 'Unexpected actual return mode')
            before = state(family.state())
            delta = compare(before, state(captured.get('sourceBefore')), f'calls[{index}].sourceBefore')
            original_proposal_index, original_snapshot = None, None
            if method == 'propose':
                args[0] = public_observation(args[0], args[1], index, 'current')
            elif method == 'before':
                args[0], original_proposal_index, original_snapshot = own_proposal(args[0], f'calls[{index}].proposal')
                args[3] = public_observation(args[3], args[2]['frame_rows'], index, 'current', args[2])
                args[2] = SimpleNamespace(**args[2])
            else:
                args[0] = public_observation(args[0], args[3], index, 'before')
                args[1] = public_observation(args[1], args[4], index, 'after')
                if args[5] is not None:
                    args[5], original_proposal_index, original_snapshot = own_proposal(args[5], f'calls[{index}].proposal')
            source_value, source_error = None, None
            diagnostic_progress('source_invocation_started', callIndex=index, method=method)
            try:
                source_value = getattr(family, 'record' if method == 'recordSource' else method)(*args)
            except Exception as error:
                source_error = error_value(error)
            diagnostic_progress('source_invocation_completed', callIndex=index, method=method,
                                returned=source_error is None)
            after = state(family.state())
            delta += compare(after, state(captured.get('sourceAfter')), f'calls[{index}].sourceAfter')
            adapted = captured.get('nativeAdaptation') is not None
            if adapted:
                delta += native_adaptation(index, captured, args, source_value, source_error, before, after)
            else:
                require(source_error is None, 'Unadapted original source raised: ' + str(source_error))
                native_result = proposal_core(captured.get('result'), f'calls[{index}].result') if method == 'propose' else captured.get('result')
                delta += compare(source_value, native_result, f'calls[{index}].result')
            if method == 'propose':
                if source_value is not None and not adapted:
                    proposals[args[0]['observation_ref']].append({'index': index, 'value': source_value, 'snapshot': deepcopy(plain(source_value))})
                if source_error is None and not adapted:
                    ablations(index, args, before, plain(source_value), after)
                if last_record is not None:
                    report['nextChoiceChecks'].append({'recordCallIndex': last_record, 'proposeCallIndex': index,
                        'decision': decision(source_value), 'nativeAdaptation': adapted, 'differences': len(delta)})
            elif method == 'before':
                guards.append({'index': index, 'observationRef': args[3]['observation_ref'], 'proposalIndex': original_proposal_index,
                    'actionIndex': args[1], 'result': deepcopy(captured['result']), 'sourceResult': plain(source_value),
                    'nativeAdaptation': adapted, 'differences': len(delta)})
            else:
                require(not adapted, 'Acquisition cannot be a scheduling adaptation')
                key = (args[0]['observation_ref'], args[1]['observation_ref'], digest(args[2]))
                require(key not in record_keys, 'The same actual returned action was acquired more than once')
                record_keys.add(key)
                selected = args[5] is not None
                matching_guards = [row for row in guards if row['proposalIndex'] == original_proposal_index
                    and row['actionIndex'] == args[6] and row['observationRef'] == args[0]['observation_ref'] and row['index'] < index]
                if selected:
                    require(matching_guards and matching_guards[-1]['result'].get('admitted') is True
                            and not matching_guards[-1]['nativeAdaptation'], 'An actual selected acquisition lacks its admitted current original guard')
                    compare(args[5]['actions'][args[6]], args[2], f'calls[{index}].selectedCommand')
                report['guardCoverage'].append({'recordCallIndex': index, 'selected': selected,
                    'guardCallIndex': matching_guards[-1]['index'] if selected else None,
                    'sourceProposalCallIndex': original_proposal_index, 'publicReturnAcquiredOnce': True})
                record = {'index': index, 'before': args[0], 'after': args[1], 'command': deepcopy(args[2]),
                    'firstRows': deepcopy(args[3]), 'secondRows': deepcopy(args[4]), 'frames': deepcopy(args[7]),
                    'selected': selected, 'value': plain(source_value), 'state': deepcopy(after), 'proposalIndex': original_proposal_index}
                records.append(record)
                last_record = index
                if publishable(after):
                    last_publication = {'episode': EPISODE, 'key': 'window_question_state', 'value': deepcopy(after),
                                        'evidence': args[1]['observation_ref'], 'revision': args[1]['revision']}
                    family.restore(deepcopy(after))  # Original caller publication/restore, using only our state.
                report['sourcePublicationChecks'].append({'recordCallIndex': index, 'predicate': publishable(after),
                    'condition': 'edits or portable or attempts', 'sourceStateDigest': digest(after),
                    'publicationEvidence': None if last_publication is None else last_publication['evidence'],
                    'publicationRevision': None if last_publication is None else last_publication['revision'],
                    'nativeStateSeed': False})
            snapshots[index + 1] = deepcopy(state(family.state()))
            publications[index + 1] = deepcopy(last_publication)
            report['callChecks'].append({'index': index, 'method': method, 'nativeAdaptation': adapted,
                'sourceBeforeDigest': digest(before), 'sourceAfterDigest': digest(after),
                'sourceResultDigest': digest(source_value), 'nativeResultDigest': digest(captured.get('result')),
                'sourceError': source_error, 'differences': len(delta), 'passed': not delta})
            diagnostic_progress('source_call_completed', callIndex=index, method=method,
                                differences=len(delta), ablationsCompleted=len(report['ablations']))
        except Exception as error:
            report['stop'] = {'callIndex': index, 'error': error_value(error)}
            diagnostic_progress('source_call_stopped', callIndex=index, errorType=type(error).__name__)
            break
    if report['stop'] is None:
        try:
            replay_restores(len(calls))
            require(next_restore == len(restores), 'Actual native restores remain beyond the completed source history')
        except Exception as error:
            report['stop'] = {'restoreIndex': next_restore, 'error': error_value(error)}

    previous_cursor, previous_restore, records_covered, action_cursor = 0, 0, set(), 0
    for prefix_index, prefix in enumerate(prefixes):
        try:
            diagnostic_progress('sealed_prefix_started', prefixIndex=prefix_index)
            retained = prefix.get('windowQuestion')
            require(isinstance(retained, dict) and retained.get('stateNode') == OWNER
                    and retained.get('checkpointFormat') == FORMAT, 'Missing actual sealed Window checkpoint')
            cursor, restore_cursor = retained.get('sourceCallsThrough'), retained.get('restoreCallsThrough')
            require(type(cursor) is int and previous_cursor <= cursor <= len(calls) and cursor in snapshots,
                    'Prefix source cursor is unavailable or unordered')
            require(type(restore_cursor) is int and previous_restore <= restore_cursor <= len(restores),
                    'Prefix restore cursor is unavailable or unordered')
            require(retained.get('sourceDepthAtSnapshot') == 0, 'A sealed snapshot intersects an active Window call')
            delta = compare(snapshots[cursor], state(retained.get('sourceState')), f'prefixes[{prefix_index}].sourceState')
            delta += compare(snapshots[cursor], checkpoint(retained.get('nativeCheckpoint')), f'prefixes[{prefix_index}].nativeCheckpoint')
            delta += compare(snapshots[cursor], state(retained.get('instanceSourceState')), f'prefixes[{prefix_index}].instanceSourceState')
            latest_restore = restores[restore_cursor - 1] if restore_cursor else None
            if latest_restore is not None:
                require(latest_restore['sourceCallsAfter'] <= cursor, 'Prefix cites a future native restoration')
                require(report['nativeRestorationChecks'][restore_cursor - 1]['passed'], 'Prefix depends on an unmatched native restoration')
            delta += compare(latest_restore, retained.get('nativeRestoration'), f'prefixes[{prefix_index}].nativeRestoration')
            selected = prefix.get('family') == 'public_window_question'
            require(('selectedProposal' in retained) == selected, 'Selected proposal presence differs from actual selected family')
            selected_index = None
            if selected:
                _, selected_index, frozen = own_proposal(retained['selectedProposal'], f'prefixes[{prefix_index}].selectedProposal', frozen=True)
                delta += compare(retained['selectedProposal'].get('strategy_receipt'), retained.get('selectionReceipt'),
                                 f'prefixes[{prefix_index}].selectionReceipt')
            interval_records = [row for row in records if previous_cursor <= row['index'] < cursor]
            transitions = retained.get('transitions')
            require(isinstance(transitions, list) and len(transitions) == prefix.get('acquiredActions') == len(interval_records),
                    'Sealed transitions/acquiredActions do not cover every actual Window record exactly once')
            expected_facts = []
            for position, (transition, record) in enumerate(zip(transitions, interval_records)):
                expected_transition = {'command': record['command'], 'before': record['before']['observation_ref'],
                                       'after': record['after']['observation_ref']}
                require(isinstance(transition, dict) and set(transition) == {'command', 'before', 'after', 'outcome'},
                        'Unexpected sealed public transition shape')
                delta += compare(expected_transition, {key: transition[key] for key in expected_transition},
                                 f'prefixes[{prefix_index}].transitions[{position}]')
                require(record['selected'] == selected, 'Active/passive acquisition differs from the selected prefix family')
                if selected:
                    require(record['proposalIndex'] == selected_index, 'The selected prefix acquired a different original proposal')
                require(record['index'] not in records_covered, 'A source return is covered by multiple prefixes')
                records_covered.add(record['index'])
                if selected or record['value'] is not None:
                    expected_facts.append({'episode': EPISODE, 'key': f"window_question_event:{record['before']['revision']}",
                        'value': record['value'], 'evidence': record['after']['observation_ref'], 'revision': record['after']['revision']})
                require(action_cursor < len(actions), 'A sealed acquisition has no actual command inventory entry')
                action = actions[action_cursor]
                require(action.get('sequence') == action_cursor + 1, 'Unordered actual public actions')
                require(isinstance(record['frames'], list), 'Actual Window acquisition omitted its public animation packet')
                complete_packet = {'frame_rows': record['secondRows'], 'frame_packet': record['frames'],
                    'level': record['after']['level_epoch'], 'levels_completed': record['after']['levels_completed'],
                    'state': record['after']['state'], 'step_index': action['sequence'],
                    'available_action_refs': record['after']['available_action_refs'], 'frame_hash': record['after']['frame_hash']}
                delta += compare(packets[action_cursor + 1]['packet'], complete_packet,
                                 f'actions[{action_cursor}].completeAcquiredPublicPacket')
                delta += compare(packet_hash(complete_packet), action.get('publicPacketSha256'),
                                 f'actions[{action_cursor}].publicPacketSha256')
                delta += compare(len(record['frames']), action.get('animationFrames'), f'actions[{action_cursor}].animationFrames')
                delta += compare(transport_command(record['command']), transport_command(action.get('command')),
                                 f'actions[{action_cursor}].command')
                delta += compare(record['after']['frame_hash'], action.get('frameHash'), f'actions[{action_cursor}].frameHash')
                delta += compare(record['after']['level_epoch'], action.get('levelAfter'), f'actions[{action_cursor}].levelAfter')
                delta += compare(record['before']['level_epoch'], action.get('levelBefore'), f'actions[{action_cursor}].levelBefore')
                delta += compare(record['after']['levels_completed'], action.get('completedAfter'), f'actions[{action_cursor}].completedAfter')
                require(action.get('family') == prefix.get('family'), 'Physical action attribution differs from its sealed prefix')
                action_cursor += 1
            delta += compare(expected_facts, retained.get('acquired'), f'prefixes[{prefix_index}].acquiredSourceFacts')
            delta += compare(publications[cursor], retained.get('retainedSourceFact'), f'prefixes[{prefix_index}].retainedSourceFact')
            report['prefixChecks'].append({'prefixIndex': prefix_index, 'sourceCallsThrough': cursor,
                'restoreCallsThrough': restore_cursor, 'selectedWindow': selected, 'sourceProposalCallIndex': selected_index,
                'recordsCovered': [row['index'] for row in interval_records], 'acquiredActions': len(interval_records),
                'sourceStateDigest': digest(snapshots[cursor]), 'differences': len(delta), 'passed': not delta})
            previous_cursor, previous_restore = cursor, restore_cursor
            diagnostic_progress('sealed_prefix_completed', prefixIndex=prefix_index,
                                differences=len(delta), physicalActionsCompared=action_cursor)
        except Exception as error:
            report['prefixChecks'].append({'prefixIndex': prefix_index, 'passed': False, 'error': error_value(error)})
            diagnostic_progress('sealed_prefix_stopped', prefixIndex=prefix_index, errorType=type(error).__name__)
            break
    source_proposals = [row for row in report['callChecks'] if row['method'] == 'propose' and not row['nativeAdaptation']]
    ablation_errors = sum(not row['executed'] for row in report['ablations'])
    report['ablationCounts'] = {'expected': len(source_proposals) * len(INTERVENTIONS), 'total': len(report['ablations']),
        'errors': ablation_errors, 'applied': sum(row['interventionApplied'] for row in report['ablations']),
        'actionOrRefusalChanged': sum(row.get('actionOrRefusalChanged') is True for row in report['ablations']),
        'byIntervention': {name: {'total': sum(row['intervention'] == name for row in report['ablations']),
            'applied': sum(row['intervention'] == name and row['interventionApplied'] for row in report['ablations']),
            'actionOrRefusalChanged': sum(row['intervention'] == name and row.get('actionOrRefusalChanged') is True for row in report['ablations'])}
            for name in INTERVENTIONS}}
    report['counts'] = {'sourceCallsExpected': len(calls), 'sourceCallsCompared': len(report['callChecks']),
        'methods': dict(Counter(row['method'] for row in report['callChecks'])),
        'proposedOriginalOffers': sum(len(value) for value in proposals.values()),
        'records': len(records), 'activeRecords': sum(row['selected'] for row in records),
        'passiveRecords': sum(not row['selected'] for row in records),
        'recordsWithNullResult': sum(row['value'] is None for row in records),
        'recordsCoveredBySealedPrefixes': len(records_covered), 'physicalActionsCompared': action_cursor,
        'physicalActionsExpected': len(actions), 'prefixesExpected': len(prefixes), 'prefixesCompared': len(report['prefixChecks']),
        'selectedWindowPrefixes': sum(row.get('selectedWindow', False) for row in report['prefixChecks']),
        'nativeRestoresExpected': len(restores), 'nativeRestoresCompared': len(report['nativeRestorationChecks']),
        'nativeAdaptations': len(report['nativeAdaptations']), 'publicObservationsRecomputed': len(report['publicObservationChecks']),
        'uniquePublicScopes': len(source_scopes), 'differences': len(report['differences'])}
    report['componentComparisonPassed'] = report['stop'] is None and not report['differences'] \
        and len(report['callChecks']) == len(calls) and len(report['prefixChecks']) == len(prefixes) \
        and all(row['passed'] for row in report['prefixChecks']) and next_restore == len(restores) \
        and len(records_covered) == len(records) == len(actions) == action_cursor \
        and len(source_scopes) == 1 and ablation_errors == 0 \
        and report['ablationCounts']['expected'] == report['ablationCounts']['total']
    report['exactOriginalReturnParityPassed'] = report['componentComparisonPassed'] and not report['nativeAdaptations']
    report['componentParityPassed'] = report['exactOriginalReturnParityPassed']
    if _checkpoint_scope is not None:
        report['comparisonScope'] = {'kind': 'sealed_checkpoint_prefix_only', 'completeCampaign': False,
            'sealedActions': len(actions), 'completePublicPacketsCompared': len(packets),
            'unsealedPublicReturnsComparedAsAcquisitions': False,
            'qualification': 'Every parity/count field in this replay is limited to the verified sealed checkpoint prefix. It is not a terminal campaign or whole-journal acquisition claim.'}
    diagnostic_progress('comparison_completed', componentComparisonPassed=report['componentComparisonPassed'],
                        sourceCallsCompared=len(report['callChecks']), nativeRestoresCompared=next_restore,
                        ablationsCompleted=len(report['ablations']), physicalActionsCompared=action_cursor)
    return report


def verify_campaign_native(campaign):
    source = campaign.get('source')
    require(isinstance(source, dict) and isinstance(source.get('files'), dict)
            and source.get('fileCount') == len(source['files']) and source['files'], 'Missing captured native source manifest')
    require(campaign.get('sourceUnchangedDuringRun') is True, 'The campaign did not retain unchanged native sources')
    checked = {}
    for name, expected in source['files'].items():
        path = (ROOT / name).resolve()
        require(path.is_relative_to(ROOT / 'src/logos-engine') or path.is_relative_to(ROOT / 'src/runtime'),
                'Unexpected native source manifest path')
        actual = fingerprint(path)
        require(actual['sha256'] == expected, 'Current native bytes differ from the captured campaign: ' + name)
        checked[name] = expected
    return {'capturedDigest': source['digest'], 'filesVerified': len(checked), 'membersDigest': digest(checked),
            'qualification': 'Each captured native member matches the bytes available at comparison. Harness execution provenance is bound by the separate campaign freeze receipts.'}


def write_evidence(output, report):
    raw = gzip.compress(encoded(report) + b'\n', mtime=0)
    require(len(raw) < 32 * 1024 * 1024, 'Comparison exceeds the 32 MiB object bound')
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('xb') as stream:
        stream.write(raw)
    if len(raw) > 900_000:
        parts = []
        for index, start in enumerate(range(0, len(raw), 900_000)):
            name, block = output.name + f'.part{index:03d}', raw[start:start + 900_000]
            with output.with_name(name).open('xb') as stream:
                stream.write(block)
            parts.append({'file': name, 'bytes': len(block), 'sha256': sha(block)})
        manifest = {'schema': 'logos-engine.evidence-byte-parts.v1',
            'original': {'file': output.name, 'bytes': len(raw), 'sha256': sha(raw)}, 'parts': parts}
        with output.with_name(output.name + '.parts.json').open('x') as stream:
            json.dump(manifest, stream, indent=2)
    return {'path': path_label(output), 'bytes': len(raw), 'sha256': sha(raw)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('campaign', type=Path)
    parser.add_argument('--trace', required=True, type=Path, help='Separately retained complete public trace, including the initial packet')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--coordination-lock', type=Path, default=Path('/workspace/shared/sra-coordination/performance.lock'))
    args = parser.parse_args()
    campaign_path, trace_path, output = args.campaign.resolve(), args.trace.resolve(), args.output.resolve()
    if output.exists() or output == campaign_path or not output.is_relative_to(ROOT) \
            or output.is_relative_to(SOURCE.parent) or not output.name.endswith('.json.gz'):
        parser.error('Output must be a new .json.gz evidence path in this checkout, outside pinned originals')
    paths = {'campaign': campaign_path, 'publicTrace': trace_path, 'generator': Path(__file__).resolve(), 'manifest': MANIFEST,
        'captureHelperAtComparison': ROOT / 'tests/helpers/v6-window-question-capture.ts',
        'campaignHarnessAtComparison': ROOT / 'tests/helpers/v6-live-game-campaign.ts',
        'nativeCallerAtComparison': ROOT / 'src/logos-engine/v6-native-runtime.ts',
        'nativeAuthorityAtComparison': ROOT / 'src/logos-engine/v6-native-authority.ts',
        'nativeFamilyAtComparison': ROOT / 'src/logos-engine/v6-window-question.ts',
        'nativePolicyAtComparison': ROOT / 'src/logos-engine/v6-window-question-policy.ts',
        'nativeGeometryAtComparison': ROOT / 'src/logos-engine/v6-window-question-geometry.ts',
        'nativeConsumedV5AtComparison': ROOT / 'src/logos-engine/v5-window-processing.ts'}
    report = {'schema': 'logos-engine.window-question-public-source-parity.v1',
        'startedAt': datetime.now(timezone.utc).isoformat(), 'sourceCommit': COMMIT, 'inputs': {},
        'scope': 'Cold unchanged original Window component over actual public calls; own original proposals, full original SRC receipt, guards, six owner fields, actual restoreNative calls, source publication, every acquired public return, sealed checkpoints and subsequent choices. Four same-input source-memory interventions are component counterfactuals, not whole-game contribution or full common caller parity.',
        'gameHostRun': False, 'nativeAgentRun': False, 'originalCommonCallerRun': False, 'fullCallerParity': False,
        'clockQualification': 'The original mechanical projection clock is externally fixed at zero for deterministic finite-work comparison. Native cancellation/deadline and TIME_BOUND remain explicitly qualified safe refusals; no native timing is inferred.',
        'helperProvenanceQualification': 'Fingerprints identify comparison-time inputs. Actual campaign execution provenance remains bound by its enclosing frozen-input receipts.'}
    executed = Counter()
    with args.coordination_lock.open('a') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
        with tempfile.TemporaryDirectory(prefix='window-public-source-parity-') as cache:
            sys.pycache_prefix = cache
            report['bytecodeIsolation'] = {'dontWriteBytecode': True,
                'freshPrefixEmptyBefore': not any(Path(cache).rglob('*')), 'existingSourceBytecodeBefore': existing_bytecode()}
            try:
                diagnostic_progress('input_fingerprints_started')
                report['inputs'] = {key: fingerprint(path) for key, path in paths.items()}
                diagnostic_progress('original_inventory_before_started')
                report['sourceBefore'] = verify_originals()
                diagnostic_progress('campaign_and_trace_read_started')
                campaign, trace = read_json(campaign_path), read_json(trace_path)
                diagnostic_progress('campaign_and_trace_read_completed')
                report.update(game=campaign.get('game'), campaignSchema=campaign.get('schema'), campaignStatus=campaign.get('status'),
                    campaignFailure=campaign.get('failure'), campaignFinal=campaign.get('final'), nativeSource=campaign.get('source'))
                report['campaignNativeBinding'] = verify_campaign_native(campaign)
                sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
                from agents.yf_arc3_v6.morphology_policy.window_question.family import WindowQuestion
                from agents.yf_arc3_v6.morphology_policy.window_question import geometry
                from agents.yf_arc3_v5.capabilities import mechanical_family_contracts_d as mechanical
                from neutral_observer import measure
                prefix = str(SOURCE) + '/'
                def profile(frame, event, arg):
                    if event == 'call' and frame.f_code.co_filename.startswith(prefix):
                        executed[(frame.f_code.co_filename[len(prefix):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1
                previous_profile = sys.getprofile()
                sys.setprofile(profile)
                try:
                    with patch.object(mechanical, 'monotonic', lambda: 0):
                        report['replay'] = compare_campaign(campaign, trace, WindowQuestion, measure, geometry)
                finally:
                    sys.setprofile(previous_profile)
                imported = {Path(module.__file__).resolve() for module in tuple(sys.modules.values())
                    if getattr(module, '__file__', None) and Path(module.__file__).resolve().is_relative_to(SOURCE)}
                imported.update(SOURCE / 'agents/yf_arc3_v6/morphology_policy/window_question' / name for name in ('window.drm', 'window.src'))
                report['sourceHashes'] = {path.relative_to(SOURCE).as_posix(): fingerprint(path)['sha256'] for path in sorted(imported)}
            except Exception as error:
                report['error'] = error_value(error)
                diagnostic_progress('comparison_error', errorType=type(error).__name__)
            try:
                diagnostic_progress('original_inventory_after_started')
                report['sourceAfter'] = verify_originals()
                report['originalsUnchanged'] = report.get('sourceBefore') == report['sourceAfter']
            except Exception as error:
                report['sourceVerificationError'] = error_value(error)
                report['originalsUnchanged'] = False
            try:
                diagnostic_progress('input_fingerprints_after_started')
                report['inputsAfter'] = {key: fingerprint(path) for key, path in paths.items()}
                report['inputsUnchanged'] = report['inputs'] == report['inputsAfter']
                if report.get('campaignNativeBinding'):
                    report['campaignNativeBindingAfter'] = verify_campaign_native(campaign)
                    report['campaignNativeBindingUnchanged'] = report['campaignNativeBinding'] == report['campaignNativeBindingAfter']
            except Exception as error:
                report['inputVerificationError'] = error_value(error)
                report['inputsUnchanged'] = False
            isolation = report['bytecodeIsolation']
            isolation['freshPrefixEmptyAfter'] = not any(Path(cache).rglob('*'))
            isolation['existingSourceBytecodeAfter'] = existing_bytecode()
            isolation['existingSourceBytecodeUnchanged'] = isolation['existingSourceBytecodeBefore'] == isolation['existingSourceBytecodeAfter']
            isolation['passed'] = all(isolation[name] is True for name in
                ('dontWriteBytecode', 'freshPrefixEmptyBefore', 'freshPrefixEmptyAfter', 'existingSourceBytecodeUnchanged'))
        report['executedSourceFunctions'] = [{'path': path, 'line': line, 'function': name, 'calls': count}
            for (path, line, name), count in sorted(executed.items())]
        replay = report.get('replay', {})
        report['status'] = 'passed' if not report.get('error') and report.get('originalsUnchanged') \
            and report.get('inputsUnchanged') and report.get('campaignNativeBindingUnchanged') \
            and report['bytecodeIsolation']['passed'] and replay.get('componentComparisonPassed') and executed else 'failed'
        report['completedAt'] = datetime.now(timezone.utc).isoformat()
        diagnostic_progress('receipt_write_started', status=report['status'])
        output_fingerprint = write_evidence(output, report)
        diagnostic_progress('receipt_write_completed', status=report['status'])
    print(json.dumps({'status': report['status'], 'output': output_fingerprint,
        'counts': replay.get('counts'), 'ablations': replay.get('ablationCounts'),
        'exactOriginalReturnParityPassed': replay.get('exactOriginalReturnParityPassed'),
        'error': report.get('error'), 'stop': replay.get('stop'),
        'firstDifferences': replay.get('differences', [])[:5]}))
    raise SystemExit(0 if report['status'] == 'passed' else 1)


if __name__ == '__main__':
    start_diagnostics()
    try:
        main()
    finally:
        stop_diagnostics()
