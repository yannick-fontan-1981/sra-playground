#!/usr/bin/env python3
"""Independently review retained cost arithmetic under a proved owner addition.

Usage: python -B docs/migration/lot4a-evidence/review-owner-qualified-cost.py [PERFORMANCE_DIR]
Reads completed inputs only. Creates two exclusive, explicitly qualified receipts.
No official main, measurement, native replay, test or build is invoked.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
from statistics import median
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
ADDED = ['family_state:feedback_sequences', 'family_activation:feedback_sequences', 'program:v6.feedback_sequences.choose']
QUALIFICATION = (
    'The numerical rule was declared before measurement and is unchanged: strict <10% complete-session median increase '
    'for each game, with no cross-game compensation. Additive-owner comparability was established after measurement. '
    'Separate graph captures do not retrospectively prove uncaptured leaves of measured sessions. All original times, '
    'additional-owner costs, cohorts and adverse phase results remain. Strict aggregation stays failed; complete graph '
    'identity and exact work metadata across versions are not claimed. No measurement, replay, test or build is executed.'
)


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def differences(left, right, path='$'):
    if type(left) is not type(right):
        return [(path, left, right)]
    if isinstance(left, dict):
        if left.keys() != right.keys():
            return [(path + '.keys', sorted(left), sorted(right))]
        return [row for key in left for row in differences(left[key], right[key], path + '.' + key)]
    if isinstance(left, list):
        if len(left) != len(right):
            return [(path + '.length', len(left), len(right))]
        return [row for index, (a, b) in enumerate(zip(left, right)) for row in differences(a, b, f'{path}[{index}]')]
    return [] if left == right else [(path, left, right)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('performance_directory', nargs='?', default='docs/migration/lot4a-evidence/performance-integrated')
    args = parser.parse_args()
    V = load('owner_review_delivery_helpers', 'scripts/verify-native-delivery.py')
    directory = V.confined(args.performance_directory)
    review_path, decision_path = [directory / name for name in
                                  ('owner-qualified-cost-review.json', 'owner-qualified-global-budget-decision.json')]
    for path in (review_path, decision_path):
        V.confined(path); V.require(not path.exists(), 'Exclusive output already exists: ' + str(path))
    names = ['cases.json', 'comparison-policy.json', 'protocol.md', 'declaration.json', 'global-budget-policy.json',
             'window.json', 'owner-addition-protocol.md', 'owner-addition-declaration.json',
             'aggregation-failure-reproduced.json', 'owner-addition-qualification.json', 'owner-qualified-comparison.json']
    names += [f'cohort{i}/{name}.json' for i in (1, 2) for name in ('baseline', 'after', 'comparison')]
    missing = [name for name in names if not (directory / name).is_file()]
    V.require(not missing, 'Completed qualification inputs missing; no output: ' + ', '.join(missing))
    V.require(not (directory / 'combined-comparison.json').exists(), 'A strict aggregate must not be fabricated')
    records, checks, baseline_root = {}, [], None

    def check(name, condition, **details):
        checks.append({'name': name, 'passed': bool(condition), **details})
        V.require(condition, 'Owner-qualified independent review failed: ' + name)

    def fingerprint(path):
        path = Path(path); path = path if path.is_absolute() else ROOT / path
        boundary = ROOT if path.is_relative_to(ROOT) else baseline_root
        V.require(boundary is not None, 'Undeclared external input: ' + str(path))
        result = V.fingerprint(V.confined(path, boundary), boundary)
        if boundary != ROOT:
            result['path'] = str(path)
        return result

    def retain(path, expected=None):
        actual = fingerprint(path)
        V.require(expected is None or all(actual.get(key) == value for key, value in expected.items()
                  if key in ('sha256', 'bytes')), 'Input fingerprint differs: ' + str(path))
        V.require(actual['path'] not in records or records[actual['path']] == actual, 'Input changed during review: ' + str(path))
        records[actual['path']] = actual
        return actual

    def read(name):
        path = directory / name; retain(path)
        return V.read_json(path)

    def verify(record):
        V.require(isinstance(record, dict) and isinstance(record.get('path'), str) and V.valid_digest(record.get('sha256')),
                  'Invalid linked input fingerprint')
        return retain(record['path'], record)

    for name in names:
        retain(directory / name)
    generator = retain(Path(__file__))
    helper_names = ['scripts/review-native-cost-consolidation.py', 'scripts/review-native-global-cost-window.py',
                    'scripts/review-native-global-cost-budget.py', 'scripts/verify-native-delivery.py', V.SOURCE_HELPER]
    helpers = [retain(ROOT / name) for name in helper_names]
    arithmetic = load('unchanged_owner_review_arithmetic', helper_names[0])
    global_window = load('unchanged_owner_review_protocol', helper_names[1])
    budget = load('unchanged_owner_review_global_rule', helper_names[2])
    declared, policy, manifest, baseline, candidate, protocol_records = global_window.protocol(directory / 'declaration.json')
    for record in protocol_records:
        verify(record)
    check('unchanged_imported_arithmetic_tools', helpers[0] in declared['officialTools']
          and helpers[1] == declared['globalDecisionTool'] and helpers[2] == declared['globalCalculationTool'])
    phase_policy, window, extension, qualification, aggregate, strict = [read(name) for name in
        ('comparison-policy.json', 'window.json', 'owner-addition-declaration.json', 'owner-addition-qualification.json',
         'owner-qualified-comparison.json', 'aggregation-failure-reproduced.json')]
    baseline_root = V.confined(Path(window['baselineCheckout']), ROOT.parent.parent)
    check('distinct_recorded_checkouts', baseline_root != ROOT and Path(window['correctionCheckout']) == ROOT)
    instant = global_window.instant
    check('completed_predeclared_window', window['schema'] == 'logos-engine.native-cost-window.v1'
          and window['status'] == window['finalIntegrity'] == 'passed'
          and window['plannedOrder'] == [row['label'] for row in window['executions']] == policy['plannedOrder']
          and instant(declared['finalizedAt']) < instant(window['startedAt']) < instant(window['finishedAt']))
    check('post_measurement_extension_declaration', extension['schema'] == 'logos-engine.native-cost-owner-qualification-declaration.v1'
          and extension['status'] == 'declared_after_measurement_before_graph_capture_and_qualified_pooling'
          and instant(window['finishedAt']) < instant(extension['recordedAt']) <= instant(qualification['startedAt'])
          <= instant(qualification['completedAt']) <= instant(aggregate['recordedAt'])
          and extension['numericPolicyChanged'] is False and extension['measurementOrNativeChange'] is False
          and extension['rawTimingModificationPermitted'] is False and extension['captureExists'] is False
          and extension['qualifiedAggregateExists'] is False and extension['originalStrictAggregationStatus'] == 'failed')
    check('exact_declared_extension', extension['expectedAddedNodeIds'] == ADDED and extension['expectedNodeCountDelta'] == 3
          and extension['expectedFinalGraphRevisionDelta'] == '3 + trial.cycles' and extension['allOtherWorkFieldsMustBeExact'] is True)
    for record in extension['inputs']:
        verify(record)
    check('extension_declaration_input_binding', all(retain(directory / name) in extension['inputs'] for name in
          ['owner-addition-protocol.md', 'declaration.json', 'window.json', 'aggregation-failure-reproduced.json',
           *[f'cohort{i}/{name}.json' for i in (1, 2) for name in ('baseline', 'after', 'comparison')]]))
    check('preserved_failed_strict_attempt', strict['schema'] == 'logos-engine.retained-tool-failure.v1'
          and strict['exitCode'] == 1 and strict['outputExists'] is False and strict['inputsUnchanged'] is True)
    strict_log = verify(strict['log'])
    check('retained_strict_failure_reason', 'Within-cohort work metadata changed' in (ROOT / strict_log['path']).read_text())
    for record in strict['inputs']:
        verify(record)
    expected_strict_paths = ['scripts/compare-native-cost-cohorts.mjs', str((directory / 'comparison-policy.json').relative_to(ROOT))]
    expected_strict_paths += [str((directory / f'cohort{i}/{name}.json').relative_to(ROOT)) for i in (1, 2) for name in ('baseline', 'after', 'comparison')]
    check('strict_attempt_bound_to_same_inputs', [row['path'] for row in strict['inputs']] == expected_strict_paths
          and strict['command'][1:] == expected_strict_paths + [str((directory / 'combined-comparison.json').relative_to(ROOT))])
    check('qualified_owner_contract', qualification['schema'] == 'logos-engine.feedback-cost-owner-addition-qualification.v1'
          and qualification['status'] == 'qualified_owner_addition_verified' and qualification['workMetadataExact'] is False
          and qualification['strictAggregationReclassified'] is False and qualification['nativeDigests'] == declared['nativeDigests']
          and sorted(qualification['addedNodeIds']) == sorted(ADDED) and len(qualification['addedNodeIds']) == 3)
    owner_checks = qualification['checks']
    check('owner_proof_all_assertions_complete', bool(owner_checks) and all(row['passed'] is True and type(row['assertions']) is int
          and row['assertions'] > 0 for row in owner_checks) and qualification['checkedCount'] == sum(row['assertions'] for row in owner_checks)
          and qualification['inputsUnchanged'] is True and qualification['inputsAfter'] == qualification['inputs'])
    verify(qualification['generator'])
    for record in qualification['inputs']:
        verify(record)
    check('owner_proof_bound_to_protocol_and_all_measurements', len({row['path'] for row in qualification['inputs']}) == len(qualification['inputs'])
          and all(retain(directory / name) in qualification['inputs'] for name in
                  ['owner-addition-protocol.md', 'owner-addition-declaration.json', 'aggregation-failure-reproduced.json',
                   *[f'cohort{i}/{side}.json' for i in (1, 2) for side in ('baseline', 'after')]]))
    check('qualified_aggregate_contract', aggregate['schema'] == 'logos-engine.native-cost-owner-qualified-comparison.v1'
          and aggregate['status'] == 'qualified_diagnostic_calculation'
          and aggregate['ownerQualification'] == retain(directory / 'owner-addition-qualification.json')
          and aggregate['originalStrictAggregation'] == {'status': 'failed', 'receipt': retain(directory / 'aggregation-failure-reproduced.json'),
                                                       'unchanged': True, 'originalOutputAbsent': True})
    aggregate_generator = verify(aggregate['generator']); aggregate_helper = verify(aggregate['calculationHelper'])
    check('qualified_aggregate_generators', aggregate_generator['path'] == 'docs/migration/lot4a-evidence/aggregate-owner-qualified-cost.mjs'
          and aggregate_helper['path'] == 'scripts/compare-native-cost-cohorts.mjs' and aggregate_helper in declared['officialTools'])
    for record in aggregate['inputs']['retained']:
        verify(record)
    check('aggregate_retains_additional_declaration', all(retain(directory / name) in aggregate['inputs']['retained']
          for name in ('owner-addition-declaration.json', 'owner-addition-protocol.md', 'owner-addition-qualification.json')))
    method = aggregate['method']
    expected_method = {'workMetadataExactAcrossAllSessions': False, 'workMetadataExactWithinEachVersion': True,
                       'allOtherMeasuredWorkFieldsExact': True, 'qualificationDeclaredAfterWindow': True, 'originalStrictFailurePreserved': True,
                       'excludedMeasuredSessions': 0, 'excludedOutliers': 0, 'excludedWarmupsPerCaseAndVersion': 2,
                       'selectedCohort': None, 'noiseAllowanceAdded': False, 'timingsModified': False, 'addedOwnerCostSubtracted': False,
                       'originalBudgetMetricsExactlyReproduced': True, 'p95MinimumSamples': 20}
    check('no_reclassification_or_work_cost_subtraction', all(type(method.get(key)) is type(value) and method[key] == value
          for key, value in expected_method.items()))
    case_ids = [row['id'] for row in manifest['cases']]; rounds = manifest['rounds']
    check('declared_cases_rounds_and_phases', case_ids == policy['caseIds'] == phase_policy['unaffectedCaseIds'] == ['STCK', 'SMLP']
          and rounds == 4 and phase_policy['stages'] == arithmetic.PHASES and phase_policy['relativeBudget']
          == manifest['budget']['unaffectedMedianRelativeIncrease'] == policy['relativeIncreaseLimit'] == 0.1)
    sources = {'baseline': baseline, 'after': candidate}
    expected_sources = {side: {key: source[key] for key in ('digest', 'fileCount')} for side, source in sources.items()}
    check('aggregate_sources', aggregate['sources'] == expected_sources and window['nativeDigests'] == {
        'baseline': baseline['digest'], 'correction': candidate['digest']})
    for record in window['inputs']:
        verify(record)
    check('watched_protocol_precommits_numeric_rule', any(Path(row['path']) == ROOT / declared['protocol']['path']
          and row['sha256'] == declared['protocol']['sha256'] for row in window['inputs']))

    def native_inventory(checkout, expected):
        files = dict(sorted((path.relative_to(checkout).as_posix(), V.sha(path)) for folder in ('src/logos-engine', 'src/runtime')
                     for path in V.walk_files(checkout / folder, checkout) if path.suffix in ('.ts', '.json', '.drm')))
        V.require(files == expected['files'], 'Actual frozen native files changed: ' + str(checkout))
        return {'digest': expected['digest'], 'fileCount': len(files)}

    actual_sources = {side: native_inventory(checkout, sources[side]) for side, checkout in [('baseline', baseline_root), ('after', ROOT)]}
    check('actual_frozen_native_inventories', actual_sources == expected_sources)
    original_helper = V.load_helper('owner_review_pinned_original', V.SOURCE_HELPER)
    original_before = V.verify_pinned_source(original_helper); verify(original_before[1])
    reports = {(n, side): read(f'cohort{n}/{side}.json') for n in (1, 2) for side in ('baseline', 'after')}
    official = {n: read(f'cohort{n}/comparison.json') for n in (1, 2)}
    first = reports[1, 'baseline']; measured = {}; all_trials = {}; work_by_version = {}; ledger = []; sessions = []; warmups = []
    runner = next(row for row in declared['officialTools'] if row['path'] == 'scripts/measure-native-loop-costs.mjs')
    check('window_timing_harness_identity', window['runnerSha256'] == runner['sha256'] and aggregate['timingHarness'] == runner
          and aggregate['environment'] == first['environment'])
    order = [('A1', 1, 'baseline'), ('B1', 1, 'after'), ('B2', 2, 'after'), ('A2', 2, 'baseline')]
    previous_end = instant(window['startedAt'])
    for execution, (label, n, side) in zip(window['executions'], order):
        report = reports[n, side]; report_record = retain(directory / f'cohort{n}/{side}.json')
        check(label + '/chronology_source_and_exit', execution['status'] == 'passed' and execution['exitCode'] == 0
              and execution['nativeDigest'] == sources[side]['digest'] and previous_end <= instant(execution['startedAt'])
              <= instant(execution['finishedAt']) <= instant(window['finishedAt']))
        previous_end = instant(execution['finishedAt'])
        check(label + '/report_and_copy_identity', execution['reportSha256'] == report_record['sha256']
              and execution.get('copiedReportSha256', execution['reportSha256']) == report_record['sha256'])
        retain(execution['output'], report_record)
        log = retain(execution['log'], {'sha256': execution['logSha256']})
        check(label + '/local_retained_log', log == retain(directory / f'cohort{n}/{side}.log'))
        check(label + '/complete_frozen_report', report['schema'] == 'logos-engine.native-loop-costs.v1' and report['status'] == 'passed'
              and report['nativeSourceUnchanged'] is True and report['nativeSource'] == sources[side])
        check(label + '/same_declared_inputs_environment', report['manifest'] == manifest and report['generator'] == first['generator'] == runner
              and report['inputs'] == first['inputs'] and report['environment'] == first['environment']
              and [row['id'] for row in report['cases']] == case_ids)
        for record in [report['generator'], *report['inputs']]:
            verify(record)
        check(label + '/cases_file_bound', declared['cases'] in report['inputs'])
        last_trial_end = instant(execution['startedAt'])
        for declared_case, case in zip(manifest['cases'], report['cases']):
            game = case['id']; prefix = label + '/' + game
            check(prefix + '/declared_trial_order', len(case['trials']) == rounds + 1
                  and [trial['round'] for trial in case['trials']] == list(range(rounds + 1))
                  and all(type(t['warmup']) is bool and t['warmup'] == (t['round'] == 0) for t in case['trials']))
            selected = [t for t in case['trials'] if not t['warmup']]; measured[n, side, game] = selected
            all_trials[n, side, game] = case['trials']
            check(prefix + '/session_summary', arithmetic.without(case['sessionElapsed'], {'tailQualification'})
                  == arithmetic.distribution([t['replayElapsedMs'] for t in selected]))
            for trial in case['trials']:
                name = prefix + '/round' + str(trial['round'])
                check(name + '/sequential_trial', last_trial_end <= instant(trial['startedAt']) <= instant(trial['finishedAt'])
                      <= instant(execution['finishedAt']))
                last_trial_end = instant(trial['finishedAt'])
                expected_actions = declared_case['warmupActions' if trial['warmup'] else 'actions']
                check(name + '/acquisition', trial['case'] == game and trial['actions'] == expected_actions == trial['final']['actions']
                      == trial['final']['acquiredTransitions'] and sum(r['type'] == 'init' for r in trial['requests']) == 1
                      and sum(r['type'] == 'advance' for r in trial['requests']) == expected_actions
                      and all(row['acknowledgedPaused'] is True for row in trial['pauses']))
                if not trial['warmup']:
                    check(name + '/pause_boundaries', [row['phase'] for row in trial['pauses']] == ['initial_planning', 'engaged_action']
                          and [row['actionsAtSafeBoundary'] for row in trial['pauses']] == [0, 1])
                signature = arithmetic.work(trial); key = side, game, trial['warmup']
                work_by_version.setdefault(key, signature)
                check(name + '/exact_work_within_version', canonical(signature) == canonical(work_by_version[key]))
                row = {'cohort': f'cohort_{n}', 'side': side, 'case': game, 'round': trial['round'], 'startedAt': trial['startedAt'],
                       'finishedAt': trial['finishedAt'], 'actions': trial['actions'], 'levelsCompleted': trial['levelsCompleted'],
                       'sampleCount': len(trial['samples']), 'requestCount': len(trial['requests'])}
                if trial['warmup']:
                    warmups.append(row)
                else:
                    ledger.append(row); sessions.append({**row, 'elapsedMs': trial['replayElapsedMs']})

    work_differences = []
    for n in (1, 2):
        for game in case_ids:
            for a, b in zip(all_trials[n, 'baseline', game], all_trials[n, 'after', game]):
                name = f'cohort{n}/{game}/round{a["round"]}'
                allowed = {f'$.observations[{i}].nodeCount': 3 for i in range(len(a['observations']))}
                allowed.update({f'$.inspection[{i}].graphNodes': 3 for i in range(len(a['inspection']))})
                allowed.update({'$.final.nodeCount': 3, '$.final.graphRevision': 3 + a['cycles']})
                actual = differences(arithmetic.work(a), arithmetic.work(b))
                check(name + '/only_exact_additive_work_differences', {path for path, _, _ in actual} == set(allowed)
                      and all(type(left) is int and type(right) is int and right - left == allowed[path] for path, left, right in actual))
                work_differences += [{'cohort': n, 'case': game, 'round': a['round'], 'warmup': a['warmup'],
                                      'path': path, 'baseline': left, 'after': right, 'delta': right - left} for path, left, right in actual]
    check('independent_work_difference_ledger', sorted(map(canonical, work_differences)) == sorted(map(canonical, aggregate['qualifiedWorkDifferences'])))
    check('all_measured_sessions_once', sorted(map(canonical, ledger)) == sorted(map(canonical, aggregate['includedMeasuredSessions']))
          and len({(row['startedAt'], row['finishedAt']) for row in ledger}) == len(ledger) == policy['measuredSessions'] == 32)
    check('measured_and_warmup_accounting', sum(row['actions'] for row in ledger) == policy['measuredActions'] == 400
          and len(warmups) == policy['excludedWarmupSessions'] == 8 and sum(row['actions'] for row in warmups)
          == policy['excludedWarmupActions'] == 24)
    check('qualified_pool_input_links', aggregate['inputs']['policy'] == retain(directory / 'comparison-policy.json')
          and [row['id'] for row in aggregate['inputs']['cohorts']] == ['cohort_1', 'cohort_2'])
    cohort_results, pooled = [], []
    for group in (1, 2, 'combined'):
        comparison = aggregate if group == 'combined' else official[group]
        check(str(group) + '/complete_case_order', [row['case'] for row in comparison['comparisons']] == case_ids)
        if group != 'combined':
            official_generator = verify(comparison['generator'])
            check(f'cohort{group}/official_comparator_identity', official_generator in declared['officialTools']
                  and comparison['schema'] == 'logos-engine.native-loop-cost-comparison.v1'
                  and comparison['harnessInputsMatched'] is True and comparison['environmentMatched'] is True and comparison['replayWorkMatched'] is True)
            check(f'cohort{group}/inputs', comparison['inputs'] == {'policy': retain(directory / 'comparison-policy.json'),
                  'baseline': retain(directory / f'cohort{group}/baseline.json'), 'after': retain(directory / f'cohort{group}/after.json')})
            check(f'cohort{group}/source_commit_labels', comparison['before'] == {'headCommit': reports[group, 'baseline']['gitHead'], 'nativeDigest': baseline['digest']}
                  and comparison['after'] == {'headCommit': reports[group, 'after']['gitHead'], 'nativeDigest': candidate['digest']})
            linked = aggregate['inputs']['cohorts'][group - 1]
            check(f'cohort{group}/aggregate_links', all(linked[field] == retain(directory / f'cohort{group}/{name}.json')
                  for field, name in [('baseline', 'baseline'), ('after', 'after'), ('originalComparison', 'comparison')]))
        unresolved, reproduced = [], []
        for row in comparison['comparisons']:
            game = row['case']; selected_cohorts = (1, 2) if group == 'combined' else (group,)
            a = [trial for n in selected_cohorts for trial in measured[n, 'baseline', game]]
            b = [trial for n in selected_cohorts for trial in measured[n, 'after', game]]
            metrics = [arithmetic.metric(a, b, phase, phase_policy['relativeBudget']) for phase in arithmetic.PHASES]
            check(f'{group}/{game}/exact_distributions_ratios_noise_and_classifications', row['metrics'] == metrics)
            check(f'{group}/{game}/work_counts', row['unaffected'] is True and row['actionsPerSession'] == a[0]['actions']
                  and row['levelsCompleted'] == a[0]['levelsCompleted']
                  and row['measuredSessionsPerVersion' if group == 'combined' else 'measuredSessions'] == len(a) == len(b))
            if group != 'combined':
                first_case = next(c for c in reports[group, 'baseline']['cases'] if c['id'] == game)
                other_case = next(c for c in reports[group, 'after']['cases'] if c['id'] == game)
                check(f'{group}/{game}/session_elapsed_summary', row['sessionElapsed'] == {'before': first_case['sessionElapsed'],
                      'after': other_case['sessionElapsed'], 'medianRelativeIncrease': other_case['sessionElapsed']['medianMs'] / first_case['sessionElapsed']['medianMs'] - 1})
            unresolved += [{'case': game, 'stage': m['stage'], 'result': m['result'], 'medianRelativeIncrease': m['medianRelativeIncrease']}
                           for m in metrics if m['result'] != 'within_observed_budget']
            reproduced.append({'case': game, 'metrics': metrics})
        status = comparison['budgetStatus' if group == 'combined' else 'status']
        check(str(group) + '/unchanged_diagnostic_verdict', comparison['relativeBudget'] == phase_policy['relativeBudget']
              and comparison['unresolved'] == unresolved and status == ('budget_review_required' if unresolved else 'passed'))
        cohort_results.append({'cohort': group, 'budgetStatus': status, 'withinObservedBudget': 16 - len(unresolved), 'unresolved': unresolved})
        if group == 'combined':
            pooled = reproduced
    check('sixteen_pooled_metrics_accounted', aggregate['budgetMetricCount'] == declared['diagnosticMetrics'] == 16
          and aggregate['withinObservedBudget'] == 16 - len(aggregate['unresolved']))
    global_cases = []
    for game in case_ids:
        a = [t['replayElapsedMs'] for n in (1, 2) for t in measured[n, 'baseline', game]]
        b = [t['replayElapsedMs'] for n in (1, 2) for t in measured[n, 'after', game]]
        before, after = median(a), median(b)
        metric = next(m for row in pooled if row['case'] == game for m in row['metrics'] if m['stage'] == 'session_elapsed')
        check(game + '/global_medians_recomputed_from_raw_sessions', len(a) == len(b) == 8 and before == metric['before']['medianMs']
              and after == metric['after']['medianMs'] and metric['before']['p95Ms'] is None and metric['after']['p95Ms'] is None)
        accepted = budget.within(before, after)
        global_cases.append({'case': game, 'sessionsPerVersion': len(a), 'beforeMedianMs': before, 'afterMedianMs': after,
                             'medianRelativeIncrease': after / before - 1, 'accepted': accepted,
                             'result': 'within_user_global_budget' if accepted else 'global_budget_exceeded'})
    before_inputs = [records[key] for key in sorted(records)]
    check('frozen_native_sources_unchanged_after_review', {side: native_inventory(checkout, sources[side])
          for side, checkout in [('baseline', baseline_root), ('after', ROOT)]} == actual_sources)
    check('pinned_original_source_unchanged', V.verify_pinned_source(original_helper) == original_before)
    after_inputs = [fingerprint(row['path']) for row in before_inputs]
    check('all_retained_inputs_and_generators_unchanged', after_inputs == before_inputs, inputs=len(before_inputs))
    check('strict_output_still_absent', not (directory / 'combined-comparison.json').exists())
    timestamp = datetime.now(timezone.utc).isoformat()
    shared = {'recordedAt': timestamp, 'generator': generator, 'calculationHelpers': helpers, 'qualification': QUALIFICATION,
              'sources': expected_sources, 'ownerQualification': retain(directory / 'owner-addition-qualification.json'),
              'ownerAdditionDeclaration': retain(directory / 'owner-addition-declaration.json'),
              'originalStrictAggregation': aggregate['originalStrictAggregation'], 'workMetadataExactAcrossAllSessions': False,
              'workMetadataExactWithinEachVersion': True, 'strictAggregationReclassified': False,
              'inputsBefore': before_inputs, 'inputsAfter': after_inputs, 'inputsUnchanged': True,
              'measuredSessions': len(ledger), 'measuredActions': sum(row['actions'] for row in ledger),
              'excludedWarmupSessions': len(warmups), 'excludedWarmupActions': sum(row['actions'] for row in warmups),
              'runtimeOrGameExecuted': False, 'measurementExecuted': False}
    review = {**shared, 'schema': 'logos-engine.native-cost-owner-qualified-review.v1', 'status': 'owner_qualified_arithmetic_verified',
              'aggregate': retain(directory / 'owner-qualified-comparison.json'), 'checks': checks, 'checkedCount': len(checks),
              'budgetStatus': aggregate['budgetStatus'], 'budget': {'metrics': 16, 'withinObservedBudget': aggregate['withinObservedBudget'],
              'unresolved': aggregate['unresolved']}, 'metrics': pooled, 'cohortResults': cohort_results,
              'qualifiedWorkDifferences': work_differences, 'includedMeasuredSessions': ledger, 'excludedWarmups': warmups,
              'originalSourceFilesVerified': len(original_before[0]), 'originalSourceManifest': original_before[1],
              'method': 'Independent Python calculation from the four original raw reports, using unchanged metric functions. JavaScript results and work differences are checked only after independent reconstruction.'}
    accepted = all(row['accepted'] for row in global_cases)
    decision = {**shared, 'schema': 'logos-engine.native-cost-owner-qualified-global-budget-decision.v1',
                'status': 'accepted_under_user_global_rule_with_owner_addition_qualification' if accepted else 'global_budget_review_required',
                'accepted': accepted, 'lot': '4A', 'nativeVersion': policy['candidate']['nativeVersion'], 'policy': policy,
                'numericRulePredeclared': True, 'comparabilityDeclaredAfterMeasurement': True,
                'predeclaration': {'finalizedAt': declared['finalizedAt'], 'windowStartedAt': window['startedAt'],
                                  'ownerAdditionDeclaredAt': extension['recordedAt']},
                'globalCases': global_cases, 'acceptedCases': sum(row['accepted'] for row in global_cases), 'totalCases': len(global_cases),
                'diagnosticPhaseRule': {key: aggregate[key] for key in ('budgetStatus', 'budgetMetricCount', 'withinObservedBudget', 'unresolved')},
                'retainedPhaseMetrics': [{'case': row['case'], **m} for row in pooled for m in row['metrics']], 'sessionLedger': sessions,
                'strictNumericCalculationHelper': declared['globalCalculationTool'], 'arithmeticReviewChecks': len(checks)}
    with V.confined(review_path).open('x') as stream:
        json.dump(review, stream, ensure_ascii=False, indent=2, allow_nan=False); stream.write('\n')
    review_record = fingerprint(review_path)
    decision['arithmeticReview'] = review_record
    decision['inputsBefore'] = [*before_inputs, review_record]
    decision['inputsAfter'] = [fingerprint(row['path']) for row in decision['inputsBefore']]
    V.require(decision['inputsBefore'] == decision['inputsAfter'], 'Input changed before exclusive decision write')
    with V.confined(decision_path).open('x') as stream:
        json.dump(decision, stream, ensure_ascii=False, indent=2, allow_nan=False); stream.write('\n')
    print(json.dumps({'review': review_record, 'decision': fingerprint(decision_path), 'status': decision['status'],
                      'checks': len(checks), 'acceptedCases': decision['acceptedCases'], 'totalCases': len(global_cases),
                      'strictAggregationStatus': 'failed', 'measurementExecuted': False}))


if __name__ == '__main__':
    main()
