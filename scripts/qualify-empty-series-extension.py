#!/usr/bin/env python3
"""Qualify one explicit empty observer extension without changing strict evidence.

Usage: python -B scripts/qualify-empty-series-extension.py STRICT_SUMMARY
       COUNTER_FIELD ACQUIRED_EVENTS_FIELD CAPTURE_FIELD PLAN_FIELD OUTPUT

The unchanged historical comparator is rerun as pure data comparison, never as a
game/agent runner. Every original check is reproduced exactly. Only its inherited
series-count comparison may fail, solely because each current prefix adds the
named integer-zero counter. The named acquired-event list must be newly empty,
and the named capture/plan fields must be absent throughout the retained report.
Original receipts, reports, scripts and strict statuses are never rewritten.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMPARATOR = ROOT / 'scripts/compare-v54-regressions.py'
COUNT_CHECK = 'same inherited source-series event counts on every sealed prefix'


def require(condition, message):
    if not condition: raise ValueError(message)


def confined(name):
    path = Path(name)
    path = path if path.is_absolute() else ROOT / path
    require(path.resolve().is_relative_to(ROOT.resolve()), 'Path outside checkout')
    return path


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def fingerprint(path):
    path = confined(path)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}


def verify_fingerprint(record):
    path = confined(record['path'])
    actual = fingerprint(path)
    for key in ['path', 'sha256', 'bytes']:
        if key in record: require(actual[key] == record[key], 'Fingerprint differs: ' + record['path'])
    return path


def key_paths(value, forbidden, path='$'):
    result = []
    if isinstance(value, dict):
        for key, item in value.items():
            child = path + '.' + key
            if key in forbidden: result.append(child)
            result.extend(key_paths(item, forbidden, child))
    elif isinstance(value, list):
        for index, item in enumerate(value): result.extend(key_paths(item, forbidden, f'{path}[{index}]'))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for field in ['strict_summary', 'counter_field', 'events_field', 'capture_field', 'plan_field', 'output']:
        parser.add_argument(field)
    args = parser.parse_args()
    require(re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*Count', args.counter_field) is not None, 'Expected an explicit count field')
    for field in [args.events_field, args.capture_field, args.plan_field]:
        require(re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', field) is not None, 'Invalid explicit field name')
    require(len({args.counter_field, args.events_field, args.capture_field, args.plan_field}) == 4, 'Fields must be distinct')
    summary_path, output = confined(args.strict_summary), confined(args.output)
    require(not output.exists(), 'Output is exclusive')
    spec = importlib.util.spec_from_file_location('unchanged_regression_comparator', COMPARATOR)
    comparator = importlib.util.module_from_spec(spec); spec.loader.exec_module(comparator)
    strict = comparator.read(summary_path)
    require(strict['schema'] == 'logos-engine.recorded-public-regressions.v1', 'Unsupported strict summary')
    require(strict['status'] == 'failed', 'This qualification requires a retained strict failure')
    require(strict['nativeSource'] == strict['nativeSourceAfter'], 'Native source changed during regression')
    require(strict['executionInputsUnchanged'] is True and strict['executionInputs'] == strict['executionInputsAfter'], 'Execution inputs changed')
    for name, digest in strict['executionInputs'].items(): require(sha(confined(name)) == digest, 'Execution input changed since replay: ' + name)
    require(strict['executionInputs'].get('scripts/compare-v54-regressions.py') == sha(COMPARATOR), 'Historical comparator is not pinned')
    require(strict['results'] and len(strict['results']) == strict['total'], 'Missing strict case results')
    frozen = strict['nativeSource']; verify_fingerprint(strict['caseManifest'])
    inputs = [fingerprint(summary_path), fingerprint(COMPARATOR), fingerprint(Path(__file__)), fingerprint(confined(strict['caseManifest']['path']))]
    cases = []; strict_passed = strict_expected = 0
    for row in strict['results']:
        require(row['exitCode'] == 0 and row['timedOut'] is False and row['status'] == 'passed', 'The actual replay did not complete successfully')
        require(row['nativeSourceUnchanged'] is True and row['immutableInputsUnchanged'] is True, 'Case inputs changed')
        require(row['nativeSourceBeforeDigest'] == row['nativeSourceAfterDigest'] == frozen['digest'], 'Case source differs')
        require(row['passiveOwnerPresencePassed'] is True, 'Independent passive-owner check failed')
        baseline_path, current_path, trace_path = [verify_fingerprint(row[key]) for key in ['baseline', 'report', 'trace']]
        comparison_path, execution_path, passive_path = [verify_fingerprint(row[key]) for key in ['comparison', 'execution', 'passiveOwnerPresence']]
        inputs.extend(fingerprint(path) for path in [baseline_path, current_path, trace_path, comparison_path, execution_path, passive_path])
        before, after, trace = [comparator.read(path) for path in [baseline_path, current_path, trace_path]]
        original, execution, passive = [comparator.read(path) for path in [comparison_path, execution_path, passive_path]]
        require(passive['passed'] is True, 'Passive-owner receipt disagrees')
        require(execution == {key: value for key, value in row.items() if key != 'execution'}, 'Execution receipt differs from summary')
        repeated = comparator.compare(before, after, trace, frozen, baseline_path, current_path, trace_path)
        require(repeated['checks'] == original['checks'], 'Original strict checks did not reproduce exactly')
        require(repeated['passed'] is False and original['passed'] is False and row['comparisonPassed'] is False and row['passed'] is False, 'Strict failure must remain explicit')
        failures = [check['name'] for check in repeated['checks'] if not check['passed']]
        require(failures == [COUNT_CHECK] and row['failedChecks'] == failures, 'A different or additional strict check failed')
        require(len(repeated['checks']) == row['comparisonChecks'], 'Strict check count differs')
        require(len(before['prefixes']) == len(after['prefixes']) > 0, 'Prefix counts differ or are empty')
        forbidden_paths = key_paths(after, {args.capture_field, args.plan_field})
        require(not forbidden_paths, 'New branch capture/plan exists in the current report')
        rows = []; inherited_before = []; inherited_after = []
        for index, (old_prefix, new_prefix) in enumerate(zip(before['prefixes'], after['prefixes'])):
            old, new = old_prefix['sharedSeries'], new_prefix['sharedSeries']
            old_counts, new_counts = comparator.series_counts(old_prefix), comparator.series_counts(new_prefix)
            require(args.counter_field not in old and args.events_field not in old, 'Extension was already present in baseline')
            require(set(new_counts) - set(old_counts) == {args.counter_field} and not (set(old_counts) - set(new_counts)), 'Count field difference is not the single declared addition')
            require(type(new[args.counter_field]) is int and new[args.counter_field] == 0, 'New counter is not integer zero')
            require(type(new.get(args.events_field)) is list and new[args.events_field] == [], 'Newly acquired events are not exactly empty')
            retained = {key: value for key, value in new_counts.items() if key != args.counter_field}
            require(old_counts == retained, 'An inherited count changed')
            inherited_before.append(old_counts); inherited_after.append(retained)
            rows.append({'prefixIndex': index, 'prefixId': new_prefix['id'], 'addedCounter': {args.counter_field: 0},
                         'addedAcquiredEvents': {args.events_field: []}, 'inheritedCountKeys': sorted(old_counts),
                         'inheritedCountProjectionSha256': comparator.canonical_sha(old_counts)})
        strict_passed += sum(check['passed'] for check in repeated['checks']); strict_expected += len(repeated['checks'])
        cases.append({'case': row['case'], 'game': row['game'], 'status': 'qualified_empty_observer_extension',
                      'strictComparisonPassed': False, 'strictChecksPassed': sum(check['passed'] for check in repeated['checks']),
                      'strictChecksExpected': len(repeated['checks']), 'strictFailure': failures[0],
                      'strictChecksExactlyReproduced': True, 'compared': repeated['compared'], 'final': after['final'],
                      'inheritedCountsExactlyEqual': True,
                      'inheritedBaselineProjectionSha256': comparator.canonical_sha(inherited_before),
                      'inheritedCurrentProjectionSha256': comparator.canonical_sha(inherited_after),
                      'forbiddenCaptureAndPlanPaths': forbidden_paths, 'prefixes': rows})
    require(strict_passed == strict['comparisonChecksPassed'] and strict_expected == strict['comparisonChecksExpected'], 'Strict totals disagree')
    require(strict['passed'] == 0, 'Unexpected strict case-pass total')
    # Pin every input again after comparison. The output does not alter or replace
    # any original pass/fail decision; even the full strict summary is an input.
    for record in inputs: verify_fingerprint(record)
    result = {'schema': 'logos-engine.empty-series-observer-extension-qualification.v1', 'status': 'passed',
              'recordedAt': datetime.now(timezone.utc).isoformat(), 'generator': fingerprint(Path(__file__)),
              'strictSummary': fingerprint(summary_path), 'inputs': list({item['path']: item for item in inputs}.values()),
              'nativeSourceDigest': frozen['digest'], 'declaredExtension': {'counterField': args.counter_field,
              'acquiredEventsField': args.events_field, 'captureField': args.capture_field, 'planField': args.plan_field},
              'strictStatus': 'failed', 'strictComparisonChecksPassed': strict_passed,
              'strictComparisonChecksExpected': strict_expected, 'qualifiedCases': len(cases), 'cases': cases,
              'qualification': 'Pure comparison of retained evidence, not a new game/replay/test/performance run. Every historical strict check is recomputed with the unchanged comparator and must exactly match its retained receipt; only the single inherited-count check may fail. The new named counter must be integer zero on every prefix, its new acquired-event list exactly empty, and the named capture/plan fields absent throughout the retained current report. All inherited counters are independently equal after projecting only the explicitly declared addition. The strict summary and case statuses remain failed. This qualified observer-schema extension does not claim full report, provider-state, proposal, private graph or complete V5/V6 identity, and does not modify the original gate.'}
    with output.open('x') as stream: json.dump(result, stream, indent=2, ensure_ascii=False); stream.write('\n')
    print(json.dumps({'status': result['status'], 'receipt': fingerprint(output), 'strictStatus': result['strictStatus'],
                      'strictChecksPassed': strict_passed, 'strictChecksExpected': strict_expected, 'qualifiedCases': len(cases)}))


if __name__ == '__main__': main()
