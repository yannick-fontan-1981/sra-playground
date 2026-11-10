#!/usr/bin/env python3
"""Independently recalculate a completed two-cohort native cost window.

Usage: python -B scripts/review-native-cost-consolidation.py PERFORMANCE_DIRECTORY

This standard-library review reads the four raw reports and three comparisons.
It executes no runner, game, agent, test or build. A passed review establishes
consistent retained arithmetic/protocol; the independent budgetStatus still may
be budget_review_required. Outputs are exclusive and all measured trials remain.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
PHASES = ['session_elapsed', 'new_decision', 'known_prefix_service', 'known_prefix_request',
          'known_prefix_guard', 'acquisition_and_persistence', 'persistence', 'restoration']


def read(path):
    data = Path(path).read_bytes()
    return json.loads(gzip.decompress(data) if str(path).endswith('.gz') else data)


def digest(data): return hashlib.sha256(data).hexdigest()
def fingerprint(path):
    path = Path(path).resolve(); data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': digest(data), 'bytes': len(data)}


def instant(value): return datetime.fromisoformat(value.replace('Z', '+00:00'))
def without(value, fields): return {key: item for key, item in value.items() if key not in fields}


def distribution(values):
    if not values: raise ValueError('Missing declared phase samples')
    if not all(type(value) in (int, float) and math.isfinite(value) and value >= 0 for value in values):
        raise ValueError('Invalid negative/non-finite timing')
    ordered = sorted(values); count = len(ordered)
    return {'count': count, 'medianMs': median(ordered),
            'p95Ms': ordered[math.ceil(0.95 * count) - 1] if count >= 20 else None,
            'minMs': ordered[0], 'maxMs': ordered[-1]}


def samples(trial, phase):
    if phase == 'session_elapsed': return [trial['replayElapsedMs']]
    if phase in ('known_prefix_service', 'known_prefix_request'):
        field = 'nativeServiceMs' if phase == 'known_prefix_service' else 'wallMs'
        return [request[field] for request in trial['requests'] if request['type'] == 'advance' and request['kind'] == 'action']
    return [sample['elapsedMs'] for sample in trial['samples'] if sample['stage'] == phase]


def calculate(trials, phase):
    rows = [samples(trial, phase) for trial in trials]
    pooled = distribution([value for row in rows for value in row])
    session_medians = [median(row) for row in rows if row]
    center = median(session_medians)
    dispersion = (max(session_medians) - min(session_medians)) / center if center else None
    return pooled, dispersion


def metric(left, right, phase, budget):
    before, a = calculate(left, phase); after, b = calculate(right, phase)
    if before['count'] != after['count'] or before['medianMs'] <= 0: raise ValueError('Noncomparable phase work')
    increase = after['medianMs'] / before['medianMs'] - 1
    status = 'within_observed_budget' if increase <= budget else (
        'over_budget_with_noise_unresolved' if max(a or 0, b or 0) > budget else 'over_budget')
    return {'stage': phase, 'before': before, 'after': after, 'medianRelativeIncrease': increase,
            'roundMedianNoise': {'baselineRelativeRange': a, 'afterRelativeRange': b},
            'budgetApplies': True, 'result': status}


def work(trial):
    return {'case': trial['case'], 'warmup': trial['warmup'], 'actions': trial['actions'],
            'levelsCompleted': trial['levelsCompleted'], 'cycles': trial['cycles'],
            'samples': [without(row, {'elapsedMs'}) for row in trial['samples']],
            'requests': [without(row, {'wallMs', 'nativeServiceMs', 'transportAndSchedulingMs'}) for row in trial['requests']],
            'observations': trial['observations'],
            'pauses': [without(row, {'requestedAt', 'acknowledgementMs', 'safeBoundaryMs'}) for row in trial['pauses']],
            'inspection': [without(row, {'nativeServiceMs', 'endToEndMs'}) for row in trial['inspection']],
            'memorySamples': [without(row, {'heapUsed', 'rss'}) for row in trial['memory']],
            'final': without(trial['final'], {'implementation'})}


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('performance_directory', type=Path)
    args = parser.parse_args(); directory = args.performance_directory.resolve()
    if not directory.is_relative_to(ROOT): raise ValueError('Performance evidence must be inside this checkout')
    output = directory / 'consolidation-review.json'
    if output.exists(): raise FileExistsError(output)
    names = ['cases.json', 'comparison-policy.json', 'protocol.md', 'window.json', 'combined-comparison.json',
             'cohort1/baseline.json', 'cohort1/after.json', 'cohort1/comparison.json',
             'cohort2/baseline.json', 'cohort2/after.json', 'cohort2/comparison.json']
    inputs = [fingerprint(directory / name) for name in names]
    manifest, policy, window, aggregate = [read(directory / name) for name in ['cases.json', 'comparison-policy.json', 'window.json', 'combined-comparison.json']]
    rounds = manifest['rounds']; cases = manifest['cases']; case_ids = [case['id'] for case in cases]
    checks = []
    def check(name, condition, **details):
        checks.append({'name': name, 'passed': bool(condition), **details})
        if not condition: raise ValueError('Consolidation review failed: ' + name)
    check('declared_rounds_and_budget', rounds == 4 and policy['relativeBudget'] == manifest['budget']['unaffectedMedianRelativeIncrease'] == 0.1)
    check('declared_sixteen_metrics', policy['stages'] == PHASES and policy['unaffectedCaseIds'] == case_ids and len(case_ids) == 2)
    check('completed_ABBA_window', window['status'] == window['finalIntegrity'] == 'passed'
          and window['plannedOrder'] == [row['label'] for row in window['executions']] == ['A1', 'B1', 'B2', 'A2'])
    previous_end = instant(window['startedAt'])
    window_reports = {'A1': 'cohort1/baseline.json', 'B1': 'cohort1/after.json',
                      'B2': 'cohort2/after.json', 'A2': 'cohort2/baseline.json'}
    for row in window['executions']:
        check('window_execution_' + row['label'], row['status'] == 'passed' and row['exitCode'] == 0
              and previous_end <= instant(row['startedAt']) <= instant(row['finishedAt']) <= instant(window['finishedAt']))
        previous_end = instant(row['finishedAt'])
        check('window_report_fingerprint_' + row['label'], digest((directory / window_reports[row['label']]).read_bytes()) == row['reportSha256']
              and row.get('copiedReportSha256', row['reportSha256']) == row['reportSha256']
              and digest(Path(row['log']).read_bytes()) == row['logSha256'])
    for record in window['inputs']:
        check('window_retained_input/' + record['path'], digest(Path(record['path']).read_bytes()) == record['sha256'])
    reports = {(cohort, side): read(directory / f'cohort{cohort}/{side}.json') for cohort in (1, 2) for side in ('baseline', 'after')}
    official = {cohort: read(directory / f'cohort{cohort}/comparison.json') for cohort in (1, 2)}
    first = reports[(1, 'baseline')]; expected_sessions = []; retained_trials = {}; all_work = {}; sources = {}
    actions_by_side = {'baseline': 0, 'after': 0}; sessions_by_side = {'baseline': 0, 'after': 0}
    for (cohort, side), report in reports.items():
        label = f'cohort{cohort}/{side}'
        execution = next(row for row in window['executions'] if window_reports[row['label']] == label + '.json')
        last_trial_end = instant(execution['startedAt'])
        check(label + '/complete_unchanged_report', report['schema'] == 'logos-engine.native-loop-costs.v1'
              and report['status'] == 'passed' and report['nativeSourceUnchanged'] is True)
        check(label + '/same_manifest_environment_harness_inputs', report['manifest'] == manifest
              and report['generator'] == first['generator'] and report['inputs'] == first['inputs'] and report['environment'] == first['environment'])
        check(label + '/source_manifest_identity', len(report['nativeSource']['files']) == report['nativeSource']['fileCount']
              and digest(json.dumps(report['nativeSource']['files'], separators=(',', ':')).encode()) == report['nativeSource']['digest']
              and report['nativeSource']['digest'] == window['nativeDigests']['baseline' if side == 'baseline' else 'correction'])
        sources.setdefault(side, report['nativeSource']); check(label + '/same_source_within_version', report['nativeSource'] == sources[side])
        check(label + '/case_order', [item['id'] for item in report['cases']] == case_ids)
        for declaration, item in zip(cases, report['cases']):
            name = label + '/' + item['id']; warmup = [trial for trial in item['trials'] if trial['warmup']]
            measured = [trial for trial in item['trials'] if not trial['warmup']]
            for trial in item['trials']:
                check(name + '/round' + str(trial['round']) + '/within_sequential_window',
                      last_trial_end <= instant(trial['startedAt']) <= instant(trial['finishedAt']) <= instant(execution['finishedAt']))
                last_trial_end = instant(trial['finishedAt'])
            check(name + '/retained_trials_and_only_declared_warmup', len(warmup) == 1 and warmup[0]['actions'] == declaration['warmupActions'] == 3
                  and len(measured) == rounds and [trial['round'] for trial in measured] == list(range(1, rounds + 1)))
            retained_trials[(cohort, side, item['id'])] = measured
            reference_work = all_work.setdefault(item['id'], work(measured[0]))
            check(name + '/exact_work_metadata', all(work(trial) == reference_work for trial in measured))
            check(name + '/session_summary', without(item['sessionElapsed'], {'tailQualification'}) == distribution([trial['replayElapsedMs'] for trial in measured]))
            for trial in measured:
                check(name + '/round' + str(trial['round']) + '/acquisition_and_pause',
                      trial['actions'] == declaration['actions'] == trial['final']['actions'] == trial['final']['acquiredTransitions']
                      and sum(row['type'] == 'init' for row in trial['requests']) == 1
                      and sum(row['type'] == 'advance' for row in trial['requests']) == trial['actions']
                      and all(row['acknowledgedPaused'] for row in trial['pauses'])
                      and next(row for row in trial['pauses'] if row['phase'] == 'initial_planning')['actionsAtSafeBoundary'] == 0
                      and next(row for row in trial['pauses'] if row['phase'] == 'engaged_action')['actionsAtSafeBoundary'] == 1)
                expected_sessions.append({'cohort': f'cohort_{cohort}', 'side': side, 'case': item['id'], 'round': trial['round'],
                    'startedAt': trial['startedAt'], 'finishedAt': trial['finishedAt'], 'actions': trial['actions'],
                    'levelsCompleted': trial['levelsCompleted'], 'sampleCount': len(trial['samples']), 'requestCount': len(trial['requests'])})
                actions_by_side[side] += trial['actions']; sessions_by_side[side] += 1
    canonical = lambda row: json.dumps(row, sort_keys=True, separators=(',', ':'))
    check('all_measured_sessions_retained_once', sorted(map(canonical, expected_sessions)) == sorted(map(canonical, aggregate['includedMeasuredSessions']))
          and len(set(map(canonical, expected_sessions))) == len(expected_sessions) == 32)
    check('measured_actions_and_sessions', actions_by_side == {'baseline': 200, 'after': 200}
          and sessions_by_side == {'baseline': 16, 'after': 16})
    check('source_versions_distinct', sources['baseline']['digest'] != sources['after']['digest'])
    recalculated = []; cohort_results = []
    for group in (1, 2, 'combined'):
        comparison = aggregate if group == 'combined' else official[group]
        if group == 'combined':
            check('aggregate_policy_fingerprint', comparison['inputs']['policy'] == fingerprint(directory / 'comparison-policy.json'))
            for index, receipt in enumerate(comparison['inputs']['cohorts'], 1):
                check(f'aggregate_cohort{index}_fingerprints', receipt['baseline'] == fingerprint(directory / f'cohort{index}/baseline.json')
                      and receipt['after'] == fingerprint(directory / f'cohort{index}/after.json')
                      and receipt['originalComparison'] == fingerprint(directory / f'cohort{index}/comparison.json'))
        else:
            check(f'cohort{group}/comparison_input_fingerprints', comparison['inputs'] == {
                'policy': fingerprint(directory / 'comparison-policy.json'),
                'baseline': fingerprint(directory / f'cohort{group}/baseline.json'),
                'after': fingerprint(directory / f'cohort{group}/after.json')})
        unresolved = []; metrics_for_group = []
        for case in case_ids:
            left = [trial for cohort in (1, 2) if group == 'combined' or cohort == group for trial in retained_trials[(cohort, 'baseline', case)]]
            right = [trial for cohort in (1, 2) if group == 'combined' or cohort == group for trial in retained_trials[(cohort, 'after', case)]]
            row = next(item for item in comparison['comparisons'] if item['case'] == case)
            expected = [metric(left, right, phase, policy['relativeBudget']) for phase in PHASES]
            for observed, recreated in zip(row['metrics'], expected):
                check(f'{group}/{case}/{recreated["stage"]}/exact_distribution_ratio_noise_classification', observed == recreated)
            check(f'{group}/{case}/metric_count', len(row['metrics']) == len(expected))
            for item in expected:
                if item['result'] != 'within_observed_budget': unresolved.append({'case': case, 'stage': item['stage'],
                    'result': item['result'], 'medianRelativeIncrease': item['medianRelativeIncrease']})
            metrics_for_group.append({'case': case, 'metrics': expected})
        check(str(group) + '/unchanged_budget_classification', comparison['relativeBudget'] == policy['relativeBudget']
              and comparison['unresolved'] == unresolved and comparison['status'] == ('budget_review_required' if unresolved else 'passed'))
        cohort_results.append({'cohort': group, 'status': comparison['status'], 'withinObservedBudget': 16 - len(unresolved), 'unresolved': unresolved})
        if group == 'combined': recalculated = metrics_for_group
    check('aggregate_totals_and_no_extra_exclusion', aggregate['budgetMetricCount'] == 16
          and aggregate['withinObservedBudget'] == 16 - len(aggregate['unresolved'])
          and aggregate['method']['excludedMeasuredSessions'] == aggregate['method']['excludedOutliers'] == 0
          and aggregate['method']['selectedCohort'] is None and aggregate['method']['noiseAllowanceAdded'] is False)
    for record in [first['generator'], *first['inputs']]:
        check('input_fingerprint/' + record['path'], fingerprint(ROOT / record['path']) == record)
    for record in inputs: check('retained_fingerprint/' + record['path'], fingerprint(ROOT / record['path']) == record)
    result = {'schema': 'logos-engine.native-cost-consolidation-review.v2', 'status': 'passed',
              'budgetStatus': aggregate['status'], 'recordedAt': datetime.now(timezone.utc).isoformat(),
              'generator': fingerprint(Path(__file__)), 'method': 'Independent Python standard-library recalculation from four retained raw reports. No timing runner, agent, game, test or build was executed. Distributions use statistics.median, empirical nearest-rank p95 only from twenty samples, exact relative ratios and unchanged noise classification.',
              'inputs': inputs, 'checks': checks, 'checkedCount': len(checks),
              'sources': {side: {'digest': source['digest'], 'fileCount': source['fileCount']} for side, source in sources.items()},
              'cohortResults': cohort_results, 'measuredSessions': len(expected_sessions), 'measuredSessionsPerCaseAndVersion': rounds * 2,
              'measuredActionsPerVersion': actions_by_side, 'budget': {'relativeThreshold': policy['relativeBudget'], 'metrics': 16,
              'withinObservedBudget': aggregate['withinObservedBudget'], 'unresolved': aggregate['unresolved']}, 'metrics': recalculated,
              'conclusion': 'The retained aggregate, each original cohort and the predeclared ABBA session accounting agree. A passed arithmetic review does not change any budget failure.',
              'qualification': 'Verifies retained evidence and arithmetic, not operating-system isolation independently of the execution window, timing accuracy, population confidence intervals, complete private-state equivalence, browser/network/live-game latency or hours-long stability. All original cohort results remain unchanged. No historical sample is pooled into this window, and no measured trial or outlier is excluded.'}
    with output.open('x') as stream: json.dump(result, stream, indent=2, ensure_ascii=False); stream.write('\n')
    print(json.dumps({'status': result['status'], 'budgetStatus': result['budgetStatus'], 'checks': len(checks),
                      'measuredSessions': len(expected_sessions), 'measuredActions': actions_by_side,
                      'withinObservedBudget': aggregate['withinObservedBudget'], 'unresolved': aggregate['unresolved'], 'receipt': fingerprint(output)}))


if __name__ == '__main__': main()
