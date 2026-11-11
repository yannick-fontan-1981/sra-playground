#!/usr/bin/env python3
"""Negative qualification of Preview's independent reader on a synthetic capture."""
from __future__ import annotations
from copy import deepcopy
import datetime
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preview_cold_reader', ROOT / 'scripts/compare-preview-packing-public-parity.py')
reader = importlib.util.module_from_spec(spec); spec.loader.exec_module(reader)


def main():
    if len(sys.argv) != 3: raise ValueError('Usage: qualify-preview-packing-reader.py CAPTURE.json.gz NEW_REPORT.json')
    capture_path, output = map(Path, sys.argv[1:])
    if output.exists(): raise FileExistsError(output)
    if os.environ.get('PYTHONHASHSEED') != '0': raise ValueError('Run with PYTHONHASHSEED=0')
    started = datetime.datetime.now(datetime.timezone.utc).isoformat(); clock = time.monotonic()
    oracle = reader.load_oracle(); source_before = oracle.SOURCE_BEFORE
    capture = reader.read(capture_path)
    baseline = reader.compare_capture(capture, oracle, include_ablations=False)
    if baseline['status'] != 'passed': raise ValueError('Qualification requires an independently passing synthetic baseline')
    cases = []
    def add(name, mutation, whole_capture=False):
        changed = deepcopy(capture); mutation(changed if whole_capture else changed['previewPackingEvents'])
        try: result = reader.compare_capture(changed, oracle, include_ablations=False)
        except Exception as error:
            result = {'status': 'failed', 'differences': [], 'stop': {'type': type(error).__name__, 'message': str(error)}, 'finalSourceState': None}
        rejected = result['status'] == 'failed'
        case = {'id': name, 'rejected': rejected, 'differenceCount': len(result['differences']),
            'firstDifferences': result['differences'][:4], 'stop': result['stop'],
            'mutatedCaptureDigest': reader.digest(changed),
            'sourceFinalEqualsUnmutatedSource': reader.equivalent(result['finalSourceState'], baseline['finalSourceState'])}
        cases.append(case)
        if not rejected: raise AssertionError('Reader accepted mutated capture: '+name)
    def find(events, method): return next(e for e in events if e['method'] == method)
    def acquired_restore(events): return next(e for e in events if e['method'] == 'restoreNative' and e['arguments'][0]['packing_model'] is not None)
    add('changed-native-before-state-is-not-an-oracle-seed', lambda events: find(events, 'propose')['sourceBefore']['packing_controls'].update({'foreign': {'kind': 'translation', 'delta': [0, 1], 'evidence': []}}))
    add('changed-native-after-state-is-detected', lambda events: find(events, 'record')['sourceAfter']['packing_model'].update({'selected': 'foreign'}))
    add('changed-proposal-result-is-detected', lambda events: find(events, 'propose')['result']['actions'][0].update({'action_ref': 'ACTION5'}))
    add('changed-native-plan-is-not-used-for-original-record', lambda events: find(events, 'record')['arguments'][5]['preview_packing_plan']['calculation'].update({'method': 'fabricated'}))
    add('changed-restore-input-is-not-an-oracle-seed', lambda events: acquired_restore(events)['arguments'][0].update({'packing_model': None}))
    add('changed-restore-schema-is-rejected', lambda events: find(events, 'restoreNative')['arguments'][0].update({'schema': 'native.foreign.v1'}))
    add('omitted-event-sequence-is-rejected', lambda events: events[3].update({'sequence': 99}))
    add('failed-passive-observation-is-rejected', lambda events: events[0]['observationErrors'].append({'field': 'sourceBefore', 'error': 'synthetic failure'}))
    add('unfinished-native-call-is-rejected', lambda events: events[0].update({'completion': 'pending', 'returnedNormally': False}))
    add('unqualified-nested-call-is-rejected', lambda events: events[0].update({'depthBefore': 1, 'depthAfter': 1}))
    add('native-input-candidate-list-is-remeasured-publicly', lambda events: find(events, 'propose')['arguments'][2].pop(0))
    add('missing-null-restore-result-is-not-inferred', lambda events: find(events, 'restoreNative').pop('result'))
    add('boolean-sequence-is-not-an-integer-cursor', lambda events: events[1].update({'sequence': True}))
    add('boolean-depth-is-not-an-integer-depth', lambda events: events[0].update({'depthBefore': False}))
    def remove_before(events):
        target = next(i for i, e in enumerate(events) if e['method'] == 'before'); del events[target]
        for index, event in enumerate(events): event['sequence'] = index
    add('acquisition-without-actual-before-guard-is-rejected', remove_before)
    if capture.get('actions') and capture.get('prefixes'):
        add('physical-inventory-order-is-not-an-observation-revision', lambda report: report['actions'][0].update({'sequence': 2}), True)
        add('physical-command-is-bound-exactly', lambda report: report['actions'][0]['command'].update({'action_ref': 'ACTION5'}), True)
        add('physical-source-decision-revision-is-bound', lambda report: report['actions'][0].update({'decisionRevision': 99}), True)
        add('full-public-animation-packet-hash-is-bound', lambda report: report['actions'][0].update({'publicPacketSha256': '0'*64}), True)
        add('physical-return-requires-full-frame-packet', lambda report: find(report['previewPackingEvents'], 'record')['arguments'][7].clear(), True)
        add('prefix-retained-owner-state-is-compared', lambda report: report['prefixes'][0]['previewPacking']['state'].update({'packing_model': None}), True)
        add('no-selected-record-is-left-outside-prefixes', lambda report: report['prefixes'].pop(), True)
        def remove_final_restore(report):
            events = report['previewPackingEvents']
            last_record = max(i for i, e in enumerate(events) if e['method'] == 'record')
            report['previewPackingEvents'] = [e for i, e in enumerate(events) if not (i > last_record and e['kind'] == 'restore')]
            for index, event in enumerate(report['previewPackingEvents']): event['sequence'] = index
            report['prefixes'][-1]['previewPacking']['eventsThrough'] = len(report['previewPackingEvents'])
        add('selected-prefix-requires-observed-restore-after-final-record', remove_final_restore, True)
    if not all(c['sourceFinalEqualsUnmutatedSource'] for c in cases[:5]):
        raise AssertionError('A native comparison-only mutation altered the independent source replay')
    source_after = oracle.verify_original()
    if source_before != source_after: raise AssertionError('Original sources changed during reader qualification')
    result = {'schema': 'sra.preview-packing-reader-negative-qualification.v1', 'status': 'passed',
        'startedAt': started, 'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'elapsedSeconds': time.monotonic()-clock,
        'reader': oracle.fingerprint(ROOT / 'scripts/compare-preview-packing-public-parity.py'),
        'qualificationScript': oracle.fingerprint(Path(__file__)), 'oracle': oracle.fingerprint(ROOT / 'scripts/export-v6-preview-packing-reference.py'),
        'capture': {'path': str(capture_path), **oracle.fingerprint(capture_path)}, 'baselineCounts': baseline['counts'],
        'sourceBefore': source_before, 'sourceAfter': source_after, 'gameExecution': False,
        'cases': cases, 'rejected': sum(c['rejected'] for c in cases),
        'scope': 'Mutations of a synthetic direct-component capture qualify input validation, exact comparisons, no native-state/plan seeding, chronological restore/guard checks. This is not caller/game evidence.'}
    output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({'status': result['status'], 'rejected': result['rejected'], 'sourceFiles': source_after['files'], 'output': str(output)}, indent=2))


if __name__ == '__main__': main()
