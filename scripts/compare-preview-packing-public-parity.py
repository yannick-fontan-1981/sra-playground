#!/usr/bin/env python3
"""Cold original PreviewPacking comparison over passive native call evidence.

No game, native implementation, private level or expected solution is executed.
Native states/plans are comparands only. Original observations are remeasured
from public rasters. Original proposals are retained and reused for guards and
acquisition. Every actual restore reuses independently acquired Python state.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import datetime
import gzip
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys
import time
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
STATE_FIELDS = ('packing_events', 'packing_model', 'packing_controls', '_packing_scene_cache')
SCHEMA = 'native.preview_packing.v1'
OBSERVATION = re.compile(r'(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)')


def require(condition, message):
    if not condition: raise ValueError(message)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def equivalent(a, b):
    if isinstance(a, bool) or isinstance(b, bool): return type(a) is type(b) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isfinite(a) and math.isfinite(b) and a == b
    if isinstance(a, dict) and isinstance(b, dict): return set(a) == set(b) and all(equivalent(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list): return len(a) == len(b) and all(equivalent(x, y) for x, y in zip(a, b))
    return type(a) is type(b) and a == b


def differences(expected, actual, path='$', limit=12):
    if equivalent(expected, actual): return []
    if isinstance(expected, dict) and isinstance(actual, dict):
        rows = []
        for key in sorted(set(expected) | set(actual)):
            if key not in expected or key not in actual:
                rows.append({'path': path+'.'+key, 'expectedPresent': key in expected, 'actualPresent': key in actual})
            else: rows += differences(expected[key], actual[key], path+'.'+key, limit-len(rows))
            if len(rows) >= limit: break
        return rows
    if isinstance(expected, list) and isinstance(actual, list):
        rows = []
        if len(expected) != len(actual): rows.append({'path': path+'.length', 'expected': len(expected), 'actual': len(actual)})
        for index, (a, b) in enumerate(zip(expected, actual)):
            rows += differences(a, b, path+f'[{index}]', limit-len(rows))
            if len(rows) >= limit: break
        return rows
    return [{'path': path, 'expected': expected, 'actual': actual}]


def source_state(value, envelope=False):
    require(isinstance(value, dict), 'Source state must be an object')
    require(set(value) == set(STATE_FIELDS) | ({'schema'} if envelope else set()), 'Unexpected source/checkpoint fields')
    if envelope: require(value['schema'] == SCHEMA, 'Wrong native checkpoint schema')
    return {k: deepcopy(value[k]) for k in STATE_FIELDS}


def choice(proposal):
    if proposal is None: return {'status': 'abstained', 'actions': []}
    return {k: deepcopy(proposal[k]) for k in ('status', 'kind', 'actions', 'reason', 'block_unrelated_probe') if k in proposal}


def command(value):
    require(isinstance(value, dict) and set(value) <= {'action_ref', 'data'} and 'action_ref' in value, 'Malformed physical command')
    data = value.get('data', {})
    require(isinstance(data, dict), 'Command payload must be an object')
    return {'action_ref': value['action_ref'], 'data': deepcopy(data)}


def compare_capture(capture, oracle, include_ablations=True, require_prefixes=False):
    calls = capture.get('previewPackingEvents')
    require(isinstance(calls, list) and calls, 'Missing chronological PreviewPacking call/restore journal')
    require(capture.get('referenceCommit') == COMMIT, 'Capture is not bound to the pinned original source')
    require(capture.get('status') in ('passed', 'failed'), 'Capture is not completed')
    prefixes = capture.get('prefixes', [])
    require(isinstance(prefixes, list), 'Prefix inventory must be a list')
    if require_prefixes: require(prefixes and any(p.get('previewPacking', {}).get('proposal') for p in prefixes), 'No selected Preview prefix checkpoint')
    family_class = oracle.PreviewPacking
    family = family_class()
    common_policy = json.loads((oracle.REF / 'agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json').read_text())
    point_limit = common_policy['input_domain']['max_point_occurrences']
    initial = oracle.state(family)
    require(initial == {'packing_events': [], 'packing_model': None, 'packing_controls': {}, '_packing_scene_cache': {}}, 'Original owner is not cold')
    report = {'schema': 'sra.preview-packing-cold-original-parity.v1', 'coldStart': True,
        'nativeStatesUsedToPrimeSource': False, 'nativePlansUsedToAcquireSource': False,
        'callChecks': [], 'restorationChecks': [], 'publicObservationChecks': [], 'callerAnnotations': [],
        'prefixChecks': [], 'guardCoverage': [], 'physicalActionChecks': [], 'ablations': [], 'differences': [], 'stop': None,
        'scope': 'One unchanged original component and its consumed V5 calculus over captured public calls; not complete original caller or game parity.',
        'normalizations': [
            {'field': 'Selected proposal.strategy_receipt/morphology/composition_target_tree', 'rule': 'Only these named top-level common-caller receipts, validated and retained separately; no component field is removed.'},
            {'field': 'Physical command binding only', 'rule': 'Omitted data and the empty object both denote the same zero-argument command; complete proposals, calls, returns and states keep exact JSON fields.'},
            {'field': 'JSON tuples', 'rule': 'Original tuple/list transport only. Objects retain all keys, arrays retain order and booleans cannot compare equal to numbers.'}]}
    counts = Counter(); offers = {}; observations = {}; source_by_reference = {}
    needed = {p.get('previewPacking', {}).get('eventsThrough') for p in prefixes}
    snapshots = {0: deepcopy(initial)}
    guards_before, guards_after, records, restores = [], [], [], []
    record_keys = set()
    def check(expected, actual, where):
        diff = differences(expected, actual, where)
        report['differences'].extend(diff)
        return len(diff)
    def observe(value, rows, index, side, public=None):
        require(isinstance(value, dict), 'Missing public observation')
        require(all(type(value.get(k)) is int and value[k] >= 0 for k in ('revision', 'level_epoch', 'levels_completed')),
                'Public observation counters must be nonnegative JSON integers')
        ref = value.get('observation_ref'); match = OBSERVATION.fullmatch(ref or '')
        require(match is not None, 'Malformed source observation reference')
        raster_hash = hashlib.sha256(json.dumps(rows, separators=(',', ':'), allow_nan=False).encode()).hexdigest()[:16]
        packet = {'frame_rows': deepcopy(rows), 'level': value['level_epoch'], 'levels_completed': value['levels_completed'],
            'state': value['state'], 'available_action_refs': deepcopy(value['available_action_refs']), 'frame_hash': raster_hash}
        if public is not None:
            require(isinstance(public, dict), 'Missing explicit public packet')
            for key, expected in packet.items(): check(expected, public.get(key), f'events[{index}].{side}.packet.{key}')
        measured = oracle.plain(oracle.measure(SimpleNamespace(**packet), value['revision'], match[1])[0])
        key = (ref, digest(rows), digest(value))
        if key not in observations:
            mismatch = check(measured, value, f'events[{index}].{side}.observation')
            if ref in source_by_reference: check(source_by_reference[ref], {'rows': rows, 'observation': value}, f'events[{index}].{side}.sameReference')
            source_by_reference[ref] = {'rows': deepcopy(rows), 'observation': deepcopy(value)}
            report['publicObservationChecks'].append({'firstEvent': index, 'side': side, 'reference': ref, 'rowsDigest': digest(rows),
                'originalObservationDigest': digest(measured), 'capturedObservationDigest': digest(value), 'differences': mismatch})
            observations[key] = measured
        return deepcopy(measured)
    def proposal_core(native, where, selected):
        if native is None: return None
        require(isinstance(native, dict), 'Proposal must be object or null')
        core = deepcopy(native)
        if selected:
            for key in ('strategy_receipt', 'morphology', 'composition_target_tree'):
                if key not in core: continue
                annotation = core.pop(key)
                require(isinstance(annotation, dict), 'Malformed caller annotation '+key)
                if key == 'strategy_receipt':
                    require(annotation.get('selected') == 'goal_access' and annotation.get('workflow') == 'v6.composition_strategy.choose', 'Foreign common selection receipt')
                elif key == 'composition_target_tree':
                    binding, bundle = core.get('binding', {}), core.get('bundle_template', {})
                    require(annotation.get('admitted') is True and annotation.get('observation_ref') == binding.get('observation_ref')
                        and annotation.get('level_epoch') == binding.get('level_epoch') and annotation.get('root') == bundle.get('objective_ref')
                        and isinstance(annotation.get('path'), list) and len(annotation['path']) >= 2
                        and annotation['path'][0] == annotation['root'] and annotation['path'][-1] == bundle.get('composition_ref'), 'Unbound common target tree')
                report['callerAnnotations'].append({'path': where+'.'+key, 'value': annotation, 'origin': 'Common native caller, outside PreviewPacking'})
        return core
    def proposal(native, where, snapshot=False):
        core = proposal_core(native, where, True)
        require(isinstance(core, dict) and core.get('kind') == 'preview_packing' and core.get('proposal_id') in offers,
                'Selected call lacks an earlier independent original proposal')
        entry = offers[core['proposal_id']]
        value = entry['snapshot'] if snapshot else entry['proposal']
        check(oracle.plain(value), core, where+'.independentSourceProposal')
        return value, entry['event']
    def ablations(index, before, args, expected):
        if not include_ablations or expected is None or expected.get('status') != 'proposed': return
        for field in STATE_FIELDS:
            changed = deepcopy(before)
            changed[field] = [] if field == 'packing_events' else None if field == 'packing_model' else {}
            branch = family_class(); branch.restore(deepcopy(changed))
            outcome, error = None, None
            try: outcome = oracle.plain(branch.propose(*deepcopy(args)))
            except Exception as caught: error = {'type': type(caught).__name__, 'message': str(caught)}
            applied = not equivalent(before, changed)
            report['ablations'].append({'event': index, 'field': field, 'sourceStateOrigin': 'Cold independently acquired original state',
                'sourceStateChanged': applied, 'emptyIntervention': not applied, 'error': error,
                'originalDecision': choice(expected), 'ablatedDecision': choice(outcome),
                'actionOrRefusalChanged': not equivalent(choice(expected), choice(outcome)),
                'fullProposalChanged': not equivalent(expected, outcome), 'proposal': outcome,
                'baselineSourceStateDigest': digest(before), 'intervenedSourceStateDigest': digest(changed)})
    for index, call in enumerate(calls):
        try:
            require(type(call.get('sequence')) is int and call['sequence'] == index, 'Events must be complete and ordered from zero')
            require(call.get('observationErrors') == [] and call.get('returnedNormally') is True and 'error' not in call, 'Call failed or passive capture lost information')
            require(all(type(call.get(k)) is int and call[k] == 0 for k in ('depthBefore', 'depthAfter')), 'Unqualified nested or concurrent Preview call')
            require((call.get('returnMode'), call.get('completion')) in (('sync', 'returned'), ('async', 'resolved')), 'Incomplete call return')
            require('result' in call, 'Completed call lacks its explicitly observed return value')
            method, args = call.get('method'), deepcopy(call.get('arguments'))
            require(isinstance(args, list), 'Call arguments must be a list')
            before = oracle.state(family)
            before_differences = check(before, source_state(call.get('sourceBefore')), f'events[{index}].sourceBefore')
            own_index = None
            if method in ('restoreNative', 'restoreSourceState'):
                require(call.get('kind') == 'restore' and len(args) == 1 and call['returnMode'] == 'sync', 'Malformed actual restore')
                received = source_state(args[0], envelope=method == 'restoreNative')
                received_diff = check(before, received, f'events[{index}].receivedState')
                family.restore(deepcopy(family.state()))
                returned = None
                restores.append(index); counts['actualRestores'] += 1
                report['restorationChecks'].append({'event': index, 'method': method, 'nativeStateSeed': False,
                    'stateOrigin': 'This cold original owner only', 'receivedDifferences': received_diff,
                    'sourceStateDigest': digest(before), 'nativeReceivedStateDigest': digest(received)})
            else:
                require(call.get('kind') == 'call' and method in ('propose', 'before', 'after', 'record'), 'Unknown source method')
                if method == 'propose':
                    require(len(args) == 4, 'Propose source arity')
                    obs, rows, inputs, remaining = args
                    measured = observe(obs, rows, index, 'current')
                    measured_inputs = oracle.plain(oracle.ObservedInputDomain(point_limit).candidates(measured))
                    check(measured_inputs, inputs, f'events[{index}].currentPublicInputDomain')
                    source_args = [measured, rows, measured_inputs, remaining]
                    value = family.propose(*deepcopy(source_args)); returned = oracle.plain(value)
                    if returned is not None and returned.get('status') == 'proposed':
                        offers[returned['proposal_id']] = {'event': index, 'proposal': value, 'snapshot': deepcopy(returned), 'observationRevision': measured['revision']}
                        counts['proposed'] += 1
                    elif returned is not None: counts['blocked'] += 1
                    else: counts['abstained'] += 1
                    ablations(index, before, source_args, returned)
                elif method == 'before':
                    require(len(args) == 4, 'Before source arity')
                    native, action_index, public, obs = args
                    own, own_index = proposal(native, f'events[{index}].arguments[0]')
                    require(type(action_index) is int and 0 <= action_index < len(own['actions']), 'Before index outside source prefix')
                    observed = observe(obs, public['frame_rows'], index, 'beforeGuard', public)
                    returned = oracle.plain(family.before(own, action_index, SimpleNamespace(**public), observed))
                    guards_before.append({'event': index, 'proposalEvent': own_index, 'actionIndex': action_index,
                        'before': observed['observation_ref'], 'command': command(own['actions'][action_index]), 'result': returned})
                elif method == 'after':
                    require(len(args) == 6, 'After source arity')
                    native, action_index, obs1, obs2, rows, later = args
                    own, own_index = proposal(native, f'events[{index}].arguments[0]')
                    require(type(action_index) is int and 0 <= action_index < len(own['actions']), 'After index outside source prefix')
                    first, second = observe(obs1, rows, index, 'before'), observe(obs2, later, index, 'after')
                    returned = oracle.plain(family.after(own, action_index, first, second, rows, later))
                    guards_after.append({'event': index, 'proposalEvent': own_index, 'actionIndex': action_index,
                        'before': first['observation_ref'], 'after': second['observation_ref'],
                        'command': command(own['actions'][action_index]), 'result': returned})
                else:
                    require(len(args) in (7, 8), 'Record source arity')
                    obs1, obs2, actual, rows, later, native, action_index = args[:7]
                    own, own_index = proposal(native, f'events[{index}].arguments[5]')
                    require(type(action_index) is int and 0 <= action_index < len(own['actions']), 'Record index outside source prefix')
                    check(command(own['actions'][action_index]), command(actual), f'events[{index}].selectedCommand')
                    first, second = observe(obs1, rows, index, 'before'), observe(obs2, later, index, 'after')
                    key = (first['observation_ref'], second['observation_ref'], digest(command(actual)))
                    require(key not in record_keys, 'Duplicate selected transition acquisition')
                    record_keys.add(key)
                    returned = oracle.plain(family.record(first, second, actual, rows, later, own, action_index, args[7] if len(args) == 8 else None))
                    records.append({'event': index, 'proposalEvent': own_index, 'actionIndex': action_index,
                        'decisionRevision': offers[own['proposal_id']]['observationRevision'],
                        'before': first['observation_ref'], 'after': second['observation_ref'], 'beforeObservation': first, 'afterObservation': second,
                        'command': command(actual), 'result': returned, 'afterRows': deepcopy(later), 'frames': args[7] if len(args) == 8 else None})
                    counts['selectedRecords'] += 1
                    counts['controlChangingRecords'] += not equivalent(before['packing_controls'], oracle.state(family)['packing_controls'])
                    counts['modelChangingRecords'] += not equivalent(before['packing_model'], oracle.state(family)['packing_model'])
                    counts['epochBoundaryReturns'] += first['level_epoch'] != second['level_epoch']
                counts[method] += 1
            after = oracle.state(family)
            result_differences = check(returned, call.get('result'), f'events[{index}].result')
            after_differences = check(after, source_state(call.get('sourceAfter')), f'events[{index}].sourceAfter')
            report['callChecks'].append({'event': index, 'method': method, 'sourceProposalEvent': own_index,
                'sourceBeforeDigest': digest(before), 'sourceAfterDigest': digest(after), 'sourceResult': returned,
                'beforeDifferences': before_differences, 'returnDifferences': result_differences, 'afterDifferences': after_differences})
            if index + 1 in needed: snapshots[index + 1] = deepcopy(after)
        except Exception as error:
            report['stop'] = {'event': index, 'type': type(error).__name__, 'message': str(error)}
            break
    for recorded in records:
        prior = [g for g in guards_before if g['event'] < recorded['event'] and g['proposalEvent'] == recorded['proposalEvent']
            and g['actionIndex'] == recorded['actionIndex'] and g['before'] == recorded['before'] and g['command'] == recorded['command']]
        after = [g for g in guards_after if g['event'] < recorded['event'] and g['proposalEvent'] == recorded['proposalEvent']
            and g['actionIndex'] == recorded['actionIndex'] and g['before'] == recorded['before'] and g['after'] == recorded['after'] and g['command'] == recorded['command']]
        passed = any(g['result'].get('admitted') is True for g in prior) and len(after) == 1 and max(g['event'] for g in prior) < after[0]['event']
        report['guardCoverage'].append({'recordEvent': recorded['event'], 'beforeEvents': [g['event'] for g in prior], 'afterEvents': [g['event'] for g in after], 'passed': passed})
        check(True, passed, f'events[{recorded["event"]}].actualGuardCoverage')
    actions = capture.get('actions')
    if isinstance(actions, list):
        require([a.get('sequence') for a in actions] == list(range(1, len(actions)+1)), 'Physical action inventory is not complete and ordered')
        selected_actions = [a for a in actions if a.get('family') == 'preview_packing']
        check(len(selected_actions), len(records), 'selectedPhysicalActions.exactCount')
        for ordinal, recorded in enumerate(records):
            obs1, obs2 = recorded['beforeObservation'], recorded['afterObservation']
            # Observation revisions include initialization and are not physical
            # action numbers. Bind the two complete chronological inventories,
            # then verify every command, source decision, outcome and packet.
            actual = selected_actions[ordinal] if ordinal < len(selected_actions) else None
            n = len(report['differences'])
            if actual is None: check(True, False, f'events[{recorded["event"]}].physicalActionPresent')
            else:
                for key, expected in {'command': recorded['command'], 'levelBefore': obs1['level_epoch'], 'completedBefore': obs1['levels_completed'],
                    'levelAfter': obs2['level_epoch'], 'completedAfter': obs2['levels_completed'], 'state': obs2['state'],
                    'frameHash': obs2['frame_hash'], 'actionIndex': recorded['actionIndex'], 'decisionRevision': recorded['decisionRevision']}.items():
                    check(expected, command(actual[key]) if key == 'command' else actual.get(key), f'physicalActions[{actual["sequence"]}].{key}')
                require(isinstance(recorded['frames'], list) and recorded['frames'], 'Physical return lacks its full captured animation packet')
                check(actual.get('animationFrames'), len(recorded['frames']), f'physicalActions[{actual["sequence"]}].animationFrames')
                packet = {'frame_rows': recorded['afterRows'], 'frame_packet': recorded['frames'],
                    'level': obs2['level_epoch'], 'levels_completed': obs2['levels_completed'], 'state': obs2['state'], 'step_index': actual['sequence'],
                    'available_action_refs': obs2['available_action_refs'], 'frame_hash': obs2['frame_hash']}
                packet_hash = hashlib.sha256(json.dumps(packet, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest()
                check(packet_hash, actual.get('publicPacketSha256'), f'physicalActions[{actual["sequence"]}].fullPublicPacketHash')
            report['physicalActionChecks'].append({'recordEvent': recorded['event'], 'sequence': None if actual is None else actual['sequence'],
                'observationRevisionAfter': obs2['revision'], 'differences': len(report['differences'])-n})
    previous = 0
    covered_records = set()
    for index, prefix in enumerate(prefixes):
        try:
            checkpoint = prefix.get('previewPacking')
            require(isinstance(checkpoint, dict) and checkpoint.get('stateNode') == 'family_state:preview_packing', 'Prefix lacks real Preview owner checkpoint')
            through = checkpoint.get('eventsThrough')
            require(type(through) is int and previous <= through <= len(calls) and through in snapshots, 'Invalid prefix journal cursor')
            expected = snapshots[through]; start_differences = len(report['differences'])
            check(expected, source_state(checkpoint.get('state'), True), f'prefixes[{index}].checkpoint')
            check(expected, source_state(checkpoint.get('instanceSourceState')), f'prefixes[{index}].instance')
            acquired = [r for r in records if previous <= r['event'] < through]
            covered_records.update(r['event'] for r in acquired)
            restored = [r for r in restores if previous <= r < through]
            selected = checkpoint.get('proposal') is not None
            if selected:
                require(prefix.get('family') == 'preview_packing' and prefix.get('selectionGroup') == 'goal_access' and prefix.get('proposalKind') == 'preview_packing', 'Selected prefix has a foreign owner/entry')
                own, offer_index = proposal(checkpoint['proposal'], f'prefixes[{index}].proposal', True)
                require(len(acquired) == prefix.get('acquiredActions') and acquired and all(r['proposalEvent'] == offer_index for r in acquired), 'Selected prefix does not own its exact records')
                require(restored and max(restored) > max(r['event'] for r in acquired), 'No actual restore after selected acquisition')
                check(list(range(len(acquired))), [r['actionIndex'] for r in acquired], f'prefixes[{index}].orderedPrefixAcquisition')
            else: require(not acquired, 'Foreign prefix acquired Preview passively')
            require(restored, 'No actual Preview restore in this prefix interval')
            report['prefixChecks'].append({'prefix': index, 'eventsThrough': through, 'selected': selected,
                'recordEvents': [r['event'] for r in acquired], 'restoreEvents': restored,
                'differences': len(report['differences'])-start_differences, 'passed': len(report['differences']) == start_differences})
            previous = through
        except Exception as error:
            report['prefixChecks'].append({'prefix': index, 'passed': False, 'error': {'type': type(error).__name__, 'message': str(error)}})
    if prefixes:
        check(sorted(r['event'] for r in records), sorted(covered_records), 'prefixes.exhaustiveSelectedRecordCoverage')
    report['counts'] = dict(counts)
    report['counts'].update(chronologicalEvents=len(calls), comparedEvents=len(report['callChecks']), uniqueObservations=len(report['publicObservationChecks']),
        selectedPrefixes=sum(r.get('selected', False) for r in report['prefixChecks']), foreignPrefixes=sum(r.get('selected') is False for r in report['prefixChecks']),
        ablations=len(report['ablations']), actionChangingAblations=sum(r['actionOrRefusalChanged'] for r in report['ablations']),
        nonemptyAblations=sum(r['sourceStateChanged'] for r in report['ablations']), ablationErrors=sum(r['error'] is not None for r in report['ablations']))
    report['status'] = 'passed' if report['stop'] is None and not report['differences'] and all(r['passed'] for r in report['prefixChecks']) and report['counts']['ablationErrors'] == 0 else 'failed'
    report['finalSourceState'] = oracle.state(family)
    return report


def load_oracle():
    spec = importlib.util.spec_from_file_location('preview_original_oracle', ROOT / 'scripts/export-v6-preview-packing-reference.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def read(path):
    def unique(pairs):
        out = {}
        for k, v in pairs:
            require(k not in out, 'Duplicate JSON property '+k); out[k] = v
        return out
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data, object_pairs_hook=unique,
        parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Invalid JSON number '+value)))


def write(path, value):
    require(not path.exists(), 'Retain former attempt; select a new output path')
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n').encode()
    path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == '.gz' else raw)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--receipt', type=Path, required=True)
    parser.add_argument('--without-ablations', action='store_true')
    parser.add_argument('--require-prefixes', action='store_true')
    args = parser.parse_args(); start = time.monotonic(); started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    require(not args.output.exists() and not args.receipt.exists(), 'Use fresh output and execution receipt paths')
    require(os.environ.get('PYTHONHASHSEED') == '0', 'Run with PYTHONHASHSEED=0')
    oracle = load_oracle()
    receipt = {'schema': 'sra.preview-packing-cold-original-execution.v1', 'startedAt': started_at,
        'sourceBefore': oracle.SOURCE_BEFORE, 'input': {'path': str(args.report), **oracle.fingerprint(args.report)},
        'reader': oracle.fingerprint(Path(__file__)), 'oracle': oracle.fingerprint(ROOT / 'scripts/export-v6-preview-packing-reference.py'),
        'gameExecution': False, 'nativeStateSeed': False, 'nativePlanSeed': False}
    try:
        report = compare_capture(read(args.report), oracle, not args.without_ablations, args.require_prefixes)
        write(args.output, report)
        receipt.update(status=report['status'], output={'path': str(args.output), **oracle.fingerprint(args.output)},
            counts=report['counts'], differences=len(report['differences']), stop=report['stop'])
    except Exception as error:
        receipt.update(status='failed', error={'type': type(error).__name__, 'message': str(error)})
    finally:
        receipt['sourceAfter'] = oracle.verify_original()
        require(receipt['sourceBefore'] == receipt['sourceAfter'], 'Original source changed during replay')
        receipt.update(elapsedSeconds=time.monotonic()-start, finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), exitCode=0 if receipt['status']=='passed' else 1)
        write(args.receipt, receipt)
        print(json.dumps(receipt, indent=2))
    return 0 if receipt['status'] == 'passed' else 1


if __name__ == '__main__': raise SystemExit(main())
