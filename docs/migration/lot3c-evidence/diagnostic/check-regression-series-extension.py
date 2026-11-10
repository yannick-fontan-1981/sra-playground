#!/usr/bin/env python3
"""Qualify the retained lot 3C observer-schema difference without rewriting gates.

From the checkout root:
  python -B docs/migration/lot3c-evidence/diagnostic/check-regression-series-extension.py [OUTPUT]
  python -B docs/migration/lot3c-evidence/diagnostic/check-regression-series-extension.py --verify RECEIPT

No argument prints the result summary without writing. OUTPUT must not exist.
This is a pure comparison of retained reports, not a replay, test or benchmark.
"""
from __future__ import annotations

from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
QUALIFIER = ROOT / 'scripts/qualify-empty-series-extension.py'
spec = importlib.util.spec_from_file_location('retained_empty_series_qualification', QUALIFIER)
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
spec = importlib.util.spec_from_file_location('unchanged_historical_comparator', helpers.COMPARATOR)
comparator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(comparator)

SUMMARY = ROOT / 'docs/migration/lot3c-evidence/final/regressions/regression-summary.json'
COUNTER = 'exposedReceptionEventCount'
EVENTS = 'exposedReceptionAcquiredEvents'
CAPTURE = 'observedExposedReception'
PLAN = 'exposed_reception_plan'
COUNT_CHECK = helpers.COUNT_CHECK
require = helpers.require


def strictly_equal(left, right):
    """JSON value equality that also distinguishes booleans, integers and floats."""
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(strictly_equal(left[key], right[key]) for key in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(strictly_equal(a, b) for a, b in zip(left, right))
    return left == right


def verify(receipt_path=None):
    """Recompute the diagnostic; optionally verify a retained receipt in full.

    Only recordedAt is excluded when comparing a prior receipt to a fresh
    computation. Returns the complete qualified result, or raises ValueError.
    """
    inputs = {}

    def pin(path):
        item = helpers.fingerprint(path)
        inputs[item['path']] = item
        return item

    def verify(record):
        path = helpers.verify_fingerprint(record)
        pin(path)
        return path

    for path in [Path(__file__), QUALIFIER, helpers.COMPARATOR, SUMMARY]:
        pin(path)
    summary = comparator.read(SUMMARY)
    require(summary['schema'] == 'logos-engine.recorded-public-regressions.v1', 'Unexpected summary schema')
    require(summary['status'] == 'failed' and summary['passed'] == 0, 'Strict statuses must remain failed')
    require(summary['total'] == len(summary['results']) == 2, 'Expected the two retained regressions')
    require(summary['nativeSource'] == summary['nativeSourceAfter'], 'Source changed during replays')
    require(summary['executionInputsUnchanged'] is True, 'Replay inputs changed during execution')
    require(summary['executionInputs'] == summary['executionInputsAfter'], 'Replay input fingerprints differ')
    for name, digest in summary['executionInputs'].items():
        require(pin(helpers.confined(name))['sha256'] == digest, 'Replay input changed since execution: ' + name)
    require(summary['executionInputs']['scripts/compare-v54-regressions.py'] == helpers.sha(helpers.COMPARATOR),
            'Historical comparator is not pinned')
    manifest = comparator.read(verify(summary['caseManifest']))
    require(manifest['passiveOwnerRequirements'] == [], 'Expected explicitly empty passive-owner requirements')
    require(summary['passiveOwnerRequirements'] == [], 'Unexpected passive-owner requirements')
    for key in ['passiveOwnerPrefixesChecked', 'passiveOwnerPrefixesPassed', 'passiveOwnerTransitionsRetained']:
        require(summary[key] == 0, 'Passive-owner coverage must be reported as zero: ' + key)

    cases = []
    passed = expected = prefixes = count_values = 0
    for row in summary['results']:
        require(row['exitCode'] == 0 and row['timedOut'] is False and row['status'] == 'passed', 'Replay did not complete')
        require(row['comparisonPassed'] is False and row['passed'] is False, 'Strict failure was not retained')
        require(row['nativeSourceUnchanged'] is True and row['immutableInputsUnchanged'] is True, 'Replay inputs changed')
        require(row['nativeSourceBeforeDigest'] == row['nativeSourceAfterDigest'] == summary['nativeSource']['digest'],
                'Replay source differs from frozen source')
        paths = {key: verify(row[key]) for key in ['baseline', 'report', 'trace', 'comparison', 'execution', 'passiveOwnerPresence']}
        old, current, trace = [comparator.read(paths[key]) for key in ['baseline', 'report', 'trace']]
        original, execution, passive = [comparator.read(paths[key]) for key in ['comparison', 'execution', 'passiveOwnerPresence']]
        require(execution == {key: value for key, value in row.items() if key != 'execution'}, 'Execution receipt differs')
        require(passive['owners'] == [] and passive['passed'] is True, 'Passive-owner receipt changed')
        require(row['passiveOwnerPrefixesChecked'] == row['passiveOwnerPrefixesPassed'] == row['passiveOwnerTransitionsRetained'] == 0,
                'Do not infer passive-owner coverage from empty requirements')
        repeated = comparator.compare(old, current, trace, summary['nativeSource'], paths['baseline'], paths['report'], paths['trace'])
        require(strictly_equal(repeated['checks'], original['checks']), 'Historical checks do not reproduce exactly')
        failures = [check['name'] for check in repeated['checks'] if not check['passed']]
        require(failures == row['failedChecks'] == [COUNT_CHECK], 'Failure is not the single declared count-schema difference')
        require(repeated['passed'] is False and original['passed'] is False, 'Historical decision changed')
        require(len(repeated['checks']) == row['comparisonChecks'] == 17, 'Historical check count changed')
        require(len(old['prefixes']) == len(current['prefixes']) == repeated['compared']['prefixes'] > 0, 'Prefix count changed')
        capture_paths = helpers.key_paths(current, {CAPTURE, PLAN})
        require(capture_paths == [], 'Exposed reception has a retained capture or plan')

        rows = []
        baseline_counts = []
        retained_counts = []
        all_raw_differences = {}
        for index, (a, b) in enumerate(zip(old['prefixes'], current['prefixes'])):
            before, after = a['sharedSeries'], b['sharedSeries']
            require(a['id'] == b['id'], 'Prefix identifiers differ')
            require(set(after) - set(before) == {COUNTER, EVENTS} and not set(before) - set(after),
                    'Shared-series additions/removals are not exactly the two declared fields')
            require(type(after[COUNTER]) is int and after[COUNTER] == 0, 'New counter is not integer zero')
            require(type(after[EVENTS]) is list and after[EVENTS] == [], 'New acquired-event list is not exactly empty')
            old_counts = comparator.series_counts(a)
            new_counts = comparator.series_counts(b)
            require(set(new_counts) - set(old_counts) == {COUNTER}, 'Unexpected count field addition')
            retained = {key: value for key, value in new_counts.items() if key != COUNTER}
            require(strictly_equal(old_counts, retained), 'An inherited counter changed value, type or presence')
            require(all(type(value) is int for value in old_counts.values()), 'An inherited counter is not an integer')
            baseline_counts.append(old_counts)
            retained_counts.append(retained)
            raw_differences = [key for key in before if not strictly_equal(before[key], after[key])]
            for key in raw_differences:
                all_raw_differences.setdefault(key, []).append(index)
            # This second, explicitly scoped comparison reports the limitations
            # of raw equality instead of calling every historical field equal.
            inherited = {key: value for key, value in before.items() if key not in {'digestScope', 'digest'}}
            projected = {key: value for key, value in after.items() if key not in {COUNTER, EVENTS, 'digestScope', 'digest'}}
            require(strictly_equal(comparator.scope(inherited), comparator.scope(projected)),
                    'An old shared-series payload differs beyond the declared session namespace and two digest fields')
            require(set(raw_differences) <= {'digestScope', 'digest', 'epochAnchors', 'panelServiceAcquiredEvents', 'chamberRelationAcquiredEvents'},
                    'An undeclared raw old-field difference exists')
            rows.append({
                'prefixIndex': index, 'prefixId': b['id'], 'inheritedCountFieldCount': len(old_counts),
                'inheritedCountKeys': sorted(old_counts), 'inheritedCountValues': old_counts,
                'inheritedCountsStrictlyEqualIncludingTypes': True,
                'inheritedBaselineCountSha256': comparator.canonical_sha(old_counts),
                'inheritedCurrentCountSha256': comparator.canonical_sha(retained),
                'addedFields': {COUNTER: 0, EVENTS: []}, 'removedFields': [],
                'rawInheritedFieldsStrictlyEqual': len(before) - len(raw_differences),
                'rawInheritedFieldsCompared': len(before), 'rawInheritedFieldsThatDiffer': sorted(raw_differences),
                'inheritedPayloadEqualWithDeclaredNamespaceNormalizationAndDigestExclusions': True,
                'normalizedInheritedPayloadSha256': comparator.canonical_sha(comparator.scope(inherited)),
            })
            count_values += len(old_counts)
        case_passed = sum(check['passed'] for check in repeated['checks'])
        passed += case_passed
        expected += len(repeated['checks'])
        prefixes += len(rows)
        cases.append({
            'case': row['case'], 'game': row['game'], 'baseline': pin(paths['baseline']), 'current': pin(paths['report']),
            'strictComparison': pin(paths['comparison']), 'strictPassed': False,
            'strictChecksPassed': case_passed, 'strictChecksExpected': len(repeated['checks']),
            'strictChecksExactlyReproduced': True, 'strictFailure': COUNT_CHECK,
            'compared': repeated['compared'], 'prefixes': rows,
            'inheritedBaselineCountProjectionSha256': comparator.canonical_sha(baseline_counts),
            'inheritedCurrentCountProjectionSha256': comparator.canonical_sha(retained_counts),
            'rawInheritedDifferencesByField': dict(sorted(all_raw_differences.items())),
            'newCounterMaximum': 0, 'newAcquiredEventsTotal': 0, 'exposedCaptureOrPlanPaths': capture_paths,
            'passiveOwnerCoverage': {'requirements': 0, 'owners': 0, 'prefixesChecked': 0, 'transitionsRetained': 0},
        })
    require(passed == summary['comparisonChecksPassed'] == 32, 'Strict pass total changed')
    require(expected == summary['comparisonChecksExpected'] == 34, 'Strict expected total changed')
    require(prefixes == 19 and count_values == 551, 'Unexpected retained case scope')
    for record in inputs.values():
        helpers.verify_fingerprint(record)
    result = {
        'schema': 'logos-engine.lot3c.empty-series-diagnostic-contract.v1',
        'status': 'qualified_empty_observer_extension', 'recordedAt': datetime.now(timezone.utc).isoformat(),
        'generator': pin(Path(__file__)), 'strictSummary': pin(SUMMARY), 'inputs': list(inputs.values()),
        'inputsUnchangedAfterComparison': True, 'nativeSourceDigest': summary['nativeSource']['digest'],
        'strictStatus': 'failed', 'strictCasePasses': 0, 'strictCasesExpected': 2,
        'strictChecksPassed': passed, 'strictChecksExpected': expected, 'strictChecksExactlyReproduced': True,
        'sealedPrefixes': prefixes, 'inheritedIntegerCountValuesStrictlyEqual': count_values,
        'newCounterZeroPrefixes': prefixes, 'newAcquiredEventsEmptyPrefixes': prefixes,
        'passiveOwnerCoverage': {'requirements': 0, 'owners': 0, 'prefixesChecked': 0, 'transitionsRetained': 0},
        'declaredNormalization': {
            'inheritedCounters': 'None: all old count keys, integer types and values are strictly equal.',
            'supplementalInheritedPayload': 'Historical comparator.scope normalizes only sra-v6-SESSION:epoch: string prefixes; digest and digestScope are explicitly excluded.',
            'newFields': {COUNTER: 0, EVENTS: []},
        },
        'cases': cases,
        'qualification': (
            'Pure data comparison of retained reports, not a new game, replay, test or performance run. '
            'All 34 unchanged historical checks reproduce exactly; the strict result remains 32/34 with two failed cases. '
            'The sole failed check in each case compares the complete dictionary of Count-suffixed sharedSeries fields, '
            'which now adds exposedReceptionEventCount. Every previous integer counter is strictly equal without normalization. '
            'Both newly added fields are exactly zero/empty on every sealed prefix. Raw sharedSeries equality is not asserted: '
            'digestScope and digest differ, and retained epoch/event evidence uses fresh session references. A separately '
            'identified supplemental comparison normalizes only that namespace and excludes the two digest fields. '
            'No passive-owner requirement, owner, prefix or transition was checked; empty owner checks provide no coverage. '
            'This qualifies an observer-schema compatibility difference only, without replacing any historical gate, '
            'claiming private state/full caller identity, live success, performance, or an Exposed reception contribution.'
        ),
    }
    if receipt_path is not None:
        retained = comparator.read(helpers.confined(receipt_path))
        require(strictly_equal({key: value for key, value in retained.items() if key != 'recordedAt'},
                               {key: value for key, value in result.items() if key != 'recordedAt'}),
                'Retained diagnostic does not reproduce exactly apart from recordedAt')
    return result


def main():
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == '--verify':
        result = verify(args[1])
        output = None
    else:
        require(len(args) <= 1, 'Expected no argument, OUTPUT, or --verify RECEIPT')
        output = helpers.confined(args[0]) if args else None
        require(output is None or not output.exists(), 'Output already exists; retained evidence is immutable')
        result = verify()
    short = {key: result[key] for key in ['status', 'strictStatus', 'strictChecksPassed', 'strictChecksExpected',
                                        'sealedPrefixes', 'inheritedIntegerCountValuesStrictlyEqual',
                                        'newCounterZeroPrefixes', 'newAcquiredEventsEmptyPrefixes', 'passiveOwnerCoverage']}
    if output:
        with output.open('x') as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        short['receipt'] = helpers.fingerprint(output)
    print(json.dumps(short, ensure_ascii=False))


if __name__ == '__main__':
    main()
