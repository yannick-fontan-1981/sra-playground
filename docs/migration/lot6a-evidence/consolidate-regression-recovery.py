#!/usr/bin/env python3
"""Compose nine original successes and two successful recovered cases.

This reads immutable receipts and their exact bytes. It runs no game, agent,
replay, comparator or test. Every failed summary remains unchanged. An optional
third invocation may recover only WEAV at 1024 MiB. If it instead aborts with an
actual V8 heap diagnostic, explicit intermediate-failure inputs permit a fourth
WEAV-only invocation at 1536 MiB. Only an exclusive composed summary is written.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
HELPER = BASE / 'finalize-cost-readiness.py'
spec = importlib.util.spec_from_file_location('lot6a_recovery_file_helpers', HELPER)
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
require, local, same, instant = h.require, h.local, h.same, h.instant
COMPOSITION_SCHEMA = 'logos-engine.lot6a.regression-recovery-composition.v1'
RECOVERED_CASES = ['weav-051', 'craf-055']
TOTAL_KEYS = ('commands', 'completePublicPackets', 'animationFrames', 'prefixes', 'requests', 'naturalLevelBoundaries')
PRESENCE_KEYS = ('passiveOwnerPrefixesChecked', 'passiveOwnerPrefixesPassed', 'passiveOwnerTransitionsRetained')
PARENT_FIELDS = {'schema', 'status', 'command', 'startedAt', 'finishedAt', 'elapsedSeconds',
                 'exitCode', 'inputsUnchanged', 'output'}


def invocation(e, path, summary_path, summary, role, source_path, partial=False, heap=1536):
    receipt = e.load(path)
    expected_status, expected_exit = ('failed', 1) if role == 'original' or partial else ('passed', 0)
    require(receipt.get('schema') == 'logos-engine.actual-command-execution.v1'
            and receipt.get('status') == expected_status and type(receipt.get('exitCode')) is int
            and receipt['exitCode'] == expected_exit and receipt.get('inputsUnchanged') is True,
            'Enclosing replay invocation does not retain its actual result: ' + role)
    if 'inputs' in receipt:
        require(set(receipt) == PARENT_FIELDS | {'inputs'} and isinstance(receipt['inputs'], list) and receipt['inputs'],
                'Unexpected parent receipt shape or empty retained parent input inventory')
        for record in receipt['inputs']:
            e.checked(record)
        binding = {'mode': 'actual_parent_input_inventory', 'parentInputInventoryRetained': True,
                   'parentReceipt': e.keep(path), 'parentInputCount': len(receipt['inputs'])}
    else:
        require(set(receipt) == PARENT_FIELDS and role == 'final_recovery' and partial is False and heap == 1536
                and summary.get('status') == 'passed' and summary.get('passed') == summary.get('total') == 1
                and [row.get('case') for row in summary.get('results', [])] == ['weav-051'],
                'Missing parent input inventory is allowed only for the explicitly retained final WEAV1536 receipt variant')
        binding = None
    e.checked(receipt['output'])
    command = receipt['command']
    driver = 'scripts/run-recorded-public-regressions.py' if role == 'original' else 'scripts/run-released-public-regressions-streamlog.py'
    require(len(command) >= 5 and Path(command[0]).name in ('python', 'python3')
            and command[1:3] == ['-B', driver]
            and local(command[3]) == local(summary['caseManifest']['path'])
            and local(command[4]) / 'regressions/regression-summary.json' == local(summary_path),
            'Summary is not the output of its declared actual replay invocation')
    e.keep(driver)
    if role != 'original':
        require('--source-manifest' in command and local(command[command.index('--source-manifest') + 1]) == local(source_path)
                and '--node-old-space-mib' in command and command[command.index('--node-old-space-mib') + 1] == str(heap),
                'Recovery invocation changed the frozen source or declared replay-only heap cap')
        require(command[1:] == ['-B', driver, summary['caseManifest']['path'],
                local(summary_path).parent.parent.relative_to(ROOT).as_posix(), '--source-manifest',
                local(source_path).relative_to(ROOT).as_posix(), '--node-old-space-mib', str(heap),
                '--timeout-seconds', '600'], 'Recovery invocation differs from the exact declared unchanged command')
    require(e.at(receipt['startedAt'], role + ' replay invocation start')
            <= e.at(receipt['finishedAt'], role + ' replay invocation finish'), 'Invalid enclosing replay chronology')
    require(h.finite(receipt['elapsedSeconds']) and receipt['elapsedSeconds'] >= 0, 'Invalid actual parent elapsed time')
    if binding is None:
        binding = retained_child_input_binding(e, path, receipt, summary_path, summary, source_path)
    return receipt, binding


def retained_child_input_binding(e, parent_path, parent, summary_path, summary, source_path):
    """Qualify actual child records without manufacturing a parent-before hash."""
    input_names = {'scripts/run-released-public-regressions.py', 'scripts/run-recorded-public-regressions.py',
        'scripts/compare-v54-regressions.py', 'scripts/replay-public-regression-released-baseline.mjs',
        'scripts/replay-v53-public-regression.mjs', 'scripts/run-v53-campaign-proof.py',
        'scripts/run-released-public-regressions-streamlog.py', 'tests/helpers/v6-live-game-campaign.ts',
        summary['caseManifest']['path'], local(source_path).relative_to(ROOT).as_posix()}
    require(set(summary['executionInputs']) == set(summary['executionInputsAfter']) == input_names
            and summary['executionInputs'] == summary['executionInputsAfter']
            and summary.get('executionInputsUnchanged') is True
            and set(summary['nativeSource']) == set(summary['nativeSourceAfter']) == {'fileCount', 'digest', 'files'}
            and same(summary['nativeSource'], summary['nativeSourceAfter']),
            'Final child driver does not retain the exact complete before/after source and execution-input inventories')
    e.file_map(summary['executionInputs'], 'actual retained final-child execution inputs')
    row = summary['results'][0]
    actual = e.referenced(row['execution'])
    start = e.referenced(row['startedReceipt'])
    preflight = e.referenced(row['preflight'])
    start_fields = {'case', 'game', 'mode', 'command', 'startedAt', 'timeoutSeconds', 'baseline', 'trace',
        'expectedActions', 'nodeOldSpaceMiB', 'preflight', 'historicalReportProcessExitedBeforeNode',
        'nativeSourceBeforeDigest', 'executionInputsBefore', 'phase', 'finishedAt', 'exitCode', 'timedOut',
        'passed', 'nodeExitObserved', 'rawOutputPath', 'driverPid', 'nodePid', 'memorySamples'}
    require(same(actual, {key: value for key, value in row.items() if key != 'execution'})
            and set(start) == start_fields and start.get('phase') == 'started'
            and start.get('finishedAt') is None and start.get('exitCode') is None and start.get('nodePid') is None
            and start.get('passed') is False and start.get('nodeExitObserved') is False
            and start.get('timedOut') is False and start.get('memorySamples') == [],
            'Final invocation lacks its immutable actual pre-child start record or completed child execution')
    stable_fields = ['case', 'game', 'mode', 'command', 'startedAt', 'timeoutSeconds', 'baseline', 'trace',
        'expectedActions', 'nodeOldSpaceMiB', 'preflight', 'historicalReportProcessExitedBeforeNode',
        'nativeSourceBeforeDigest', 'executionInputsBefore', 'rawOutputPath', 'driverPid']
    require(all(same(start[key], actual[key]) for key in stable_fields)
            and start['executionInputsBefore'] == actual['executionInputsBefore'] == summary['executionInputs']
            and start['nativeSourceBeforeDigest'] == actual['nativeSourceBeforeDigest']
            == actual['nativeSourceAfterDigest'] == summary['nativeSource']['digest']
            and actual.get('nativeSourceUnchanged') is True and actual.get('immutableInputsUnchanged') is True,
            'Actual child start, completion and driver before/after inventories disagree')
    require(preflight.get('schema') == 'logos-engine.released-baseline-replay-preflight.v1'
            and preflight.get('status') == 'passed' and preflight.get('caseManifest') == summary['caseManifest']
            and preflight.get('nativeSourceDigest') == summary['nativeSource']['digest']
            and preflight.get('replaysExecuted') == 0 and preflight.get('prevalidationProcessExitedBeforeAnyReplay') is True
            and preflight.get('prevalidator') == e.keep('scripts/run-recorded-public-regressions.py')
            and preflight.get('passiveOwnerRequirements') == summary['passiveOwnerRequirements']
            and preflight.get('totals') == summary['prevalidatedTotals']
            and len(preflight.get('cases', [])) == 1,
            'Actual child preflight is incomplete or binds another population')
    case = preflight['cases'][0]
    require(case.get('id') == row['case'] == 'weav-051' and case.get('game') == row['game'] == 'WEAV'
            and case.get('baseline') == row['baseline']['path'] and case.get('trace') == row['trace']['path']
            and case.get('counts') == preflight['totals']
            and case['counts']['commands'] == row['expectedActions'] == row['actions']
            and row.get('nodeOldSpaceMiB') == 1536 and row.get('timeoutSeconds') == 600,
            'Actual final child preflight/start/return do not describe the same exact WEAV invocation')
    require(instant(parent['startedAt']) <= instant(start['startedAt']) <= instant(actual['finishedAt'])
            <= instant(actual['postprocessingFinishedAt']) <= instant(parent['finishedAt']),
            'Retained child input evidence is outside the actual enclosing invocation')
    return {'mode': 'actual_retained_child_execution_inputs', 'parentInputInventoryRetained': False,
        'parentPrelaunchHashesClaimed': False, 'parentReceipt': e.keep(parent_path),
        'retainedDriverSummary': e.keep(summary_path), 'beforeInventoryField': 'executionInputs',
        'afterInventoryField': 'executionInputsAfter', 'exactInputNames': sorted(input_names),
        'childStartedReceipt': row['startedReceipt'], 'childExecution': row['execution'], 'preflight': row['preflight'],
        'nativeSourceBeforeField': 'nativeSource', 'nativeSourceAfterField': 'nativeSourceAfter',
        'qualification': 'Post-execution binding of actual retained child-driver before/after inventories, '
            'the immutable record written before the native child starts, its real completed execution and preflight. '
            'The parent receipt contains no input list; no parent prelaunch fingerprint inventory is asserted or recreated.'}


def heap_failure_diagnostic(e, row):
    """Read only the retained V8 diagnostic; do not infer host/cgroup OOM."""
    path = e.checked(row['output'])
    with gzip.open(path, 'rt', encoding='utf-8', errors='replace') as stream:
        lines = [line.rstrip('\r\n') for line in stream
                 if 'FATAL ERROR:' in line and 'JavaScript heap out of memory' in line]
    require(len(lines) == 1 and row.get('exitCode') == -6 and row.get('nodeOldSpaceMiB') == 1024,
            'The intermediate failure lacks its explicit actual 1024 MiB V8 heap diagnostic')
    return {'source': row['output'], 'line': lines[0], 'scope': 'Explicit Node/V8 heap diagnostic; no cgroup OOM inference'}


def inspect_batch(e, summary_path, execution_path, source_path, native, role, partial=False, heap=1536):
    summary = e.load(summary_path)
    require(summary.get('schema') == 'logos-engine.recorded-public-regressions.v1'
            and summary.get('nativeSource') == summary.get('nativeSourceAfter') == native
            and summary.get('executionInputsUnchanged') is True
            and summary.get('executionInputs') == summary.get('executionInputsAfter'),
            'Replay batch changed its frozen source or execution inputs')
    e.file_map(summary['executionInputs'], role + ' replay inputs')
    require(summary['executionInputs'].get(local(source_path).relative_to(ROOT).as_posix()) == e.keep(source_path)['sha256'],
            'Replay execution did not bind the declared frozen source manifest')
    manifest = e.referenced(summary['caseManifest'])
    require(manifest.get('schema') == 'logos-engine.recorded-public-regression-cases.v1'
            and manifest.get('strictComparisonCheckNames') == h.STRICT_REGRESSION_CHECK_NAMES
            and manifest.get('expectedChecksPerCase') == len(h.STRICT_REGRESSION_CHECK_NAMES) == 17
            and manifest.get('strictComparator') == e.keep('scripts/compare-v54-regressions.py')
            and summary.get('passiveOwnerRequirements') == manifest.get('passiveOwnerRequirements', []),
            'Batch changed the exact seventeen historical comparison labels or owner requirements')
    rows = summary['results']
    require(type(summary.get('total')) is int and summary['total'] == len(rows) == len(manifest['cases'])
            and [row['case'] for row in rows] == [case['id'] for case in manifest['cases']]
            and len({row['case'] for row in rows}) == len(rows), 'Batch case population/order is incomplete or repeated')
    run, input_binding = invocation(e, execution_path, summary_path, summary, role, source_path, partial, heap)
    require(e.at(manifest['declaredAt'], role + ' case declaration') <= instant(run['startedAt']),
            'Recovery case population was declared after execution')
    compared, totals = {}, {key: 0 for key in TOTAL_KEYS}
    passed_count, check_count = 0, 0
    for case, row in zip(manifest['cases'], rows):
        require(row.get('game') == case['game'] and row.get('mode') == 'recorded-public-replay'
                and type(row.get('passed')) is bool and type(row.get('exitCode')) is int
                and row.get('nativeSourceBeforeDigest') == row.get('nativeSourceAfterDigest') == native['digest']
                and row.get('nativeSourceUnchanged') is True and row.get('immutableInputsUnchanged') is True
                and row.get('timedOut') is False, 'Replay case changed its identity or inputs')
        require(instant(run['startedAt']) <= e.at(row['startedAt'], row['case'] + ' started')
                <= e.at(row['finishedAt'], row['case'] + ' node finished') <= instant(run['finishedAt']),
                'Actual case execution lies outside its enclosing invocation')
        for key in ('baseline', 'trace', 'output', 'execution'):
            e.checked(row[key])
        for key in ('baseline', 'trace'):
            require(all(row[key][name] == case[key][name] for name in ('path', 'sha256')),
                    'Replay used another pinned baseline or public trace')
        execution = e.referenced(row['execution'])
        require(same(execution, {key: value for key, value in row.items() if key != 'execution'}),
                'Summary row differs from its complete actual execution receipt')
        if role != 'original':
            require(row.get('nodeExitObserved') is True and row.get('nodeExitedBeforeComparison') is True
                    and row.get('historicalReportProcessExitedBeforeNode') is True
                    and row.get('nodeOldSpaceMiB') == heap and row.get('hostPreparationPassed') is True
                    and row.get('phase') == 'completed' and 'driverInterruption' not in row
                    and row.get('executionInputsBefore') == summary['executionInputs'] and row.get('timeoutSeconds') == 600,
                    'Released-baseline recovery did not retain its actual completed host lifecycle')
            for key in ('preflight', 'hostPreparation', 'outputRaw', 'startedReceipt'):
                e.checked(row[key])
            expected_report = local(summary_path).parent / (row['case'] + '-replay.json.gz')
            require(row['command'] == ['node', '--expose-gc', '--max-old-space-size=' + str(heap),
                    'scripts/replay-public-regression-released-baseline.mjs', case['baseline']['path'], case['trace']['path'],
                    expected_report.relative_to(ROOT).as_posix(), row['hostPreparation']['path']],
                    'Native recorded replay command changed its exact host, heap setting or pinned inputs')
            require(instant(row['finishedAt']) <= e.at(row['postprocessingFinishedAt'], row['case'] + ' comparison/cleanup finished')
                    <= instant(run['finishedAt']), 'Recovery postprocessing has invalid actual chronology')
        if not row['passed']:
            allowed = (role == 'original' and row['case'] in RECOVERED_CASES) or (role == 'recovery' and partial and row['case'] == 'weav-051')
            heap_failure = role == 'intermediate_failed' and partial and row['case'] == 'weav-051'
            require((allowed and row['exitCode'] == -9 or heap_failure and row['exitCode'] == -6)
                    and row.get('status') != 'passed'
                    and not any(key in row for key in ('report', 'comparison', 'comparisonChecks')),
                    'Only the declared actual uncompleted failures may be retained for recovery')
            if role != 'original':
                require(not expected_report.exists()
                        and not (local(summary_path).parent / (row['case'] + '-comparison.json')).exists(),
                        'A failed recovery unexpectedly retains an unqualified report or comparison')
            if heap_failure:
                heap_failure_diagnostic(e, row)
            continue
        passed_count += 1
        require(row.get('status') == 'passed' and row['exitCode'] == 0 and row.get('comparisonPassed') is True
                and row.get('comparisonChecks') == 17 and row.get('failedChecks') == []
                and row.get('passiveOwnerPresencePassed') is True, 'A selected replay did not pass all original checks')
        e.checked(row['report'])
        if role != 'original':
            require(local(row['report']['path']) == expected_report, 'Successful replay report is not the exact declared command output')
        comparison = e.referenced(row['comparison'])
        require(comparison.get('schema') == 'logos-engine.scoped-public-regression-comparison.v1'
                and comparison.get('game') == case['game'] and comparison.get('passed') is True
                and [item['name'] for item in comparison['checks']] == h.STRICT_REGRESSION_CHECK_NAMES
                and len(comparison['checks']) == 17 and all(item.get('passed') is True for item in comparison['checks'])
                and comparison['legacyComparatorMetadata'].get('implementation') == manifest['strictComparator']
                and comparison['legacyComparatorMetadata'].get('checkLabelsPreserved') is True,
                'Selected case lacks the unchanged complete seventeen-check comparison')
        for key, row_key in [('before', 'baseline'), ('after', 'report'), ('trace', 'trace')]:
            e.checked(comparison[key])
            require(all(comparison[key][name] == row[row_key][name] for name in ('path', 'sha256', 'bytes')),
                    'Comparison identifies another complete actual report or public trace')
        require(comparison['after'].get('sourceDigest') == native['digest'], 'Comparison names another frozen native implementation')
        counts = comparison['compared']
        require(set(counts) == set(TOTAL_KEYS) and all(type(counts[key]) is int and counts[key] >= 0 for key in TOTAL_KEYS)
                and counts['commands'] == row['actions'] and counts['prefixes'] == row['prefixes'],
                'Exact comparison population differs from its actual replay')
        compared[row['case']] = counts
        for key in TOTAL_KEYS:
            totals[key] += counts[key]
        check_count += len(comparison['checks'])
        presence = e.referenced(row['passiveOwnerPresence'])
        require(presence.get('schema') == 'logos-engine.passive-owner-evidence-presence.v1'
                and presence.get('passed') is True and presence.get('report') == row['report']
                and presence.get('caseManifest') == summary['caseManifest'], 'Owner presence does not bind its actual invocation manifest')
        if role != 'original':
            preparation = e.referenced(row['hostPreparation'])
            require(preparation.get('status') == 'passed' and preparation.get('baselineRootCollectedBeforeHarnessImport') is True
                    and preparation.get('baseline') == row['baseline'] and preparation.get('trace') == row['trace']
                    and preparation.get('expectedActions') == counts['commands']
                    and preparation.get('completePublicPackets') == counts['completePublicPackets'],
                    'Released-baseline host preparation changed the replay population')
    require(summary.get('passed') == passed_count and summary.get('comparisonChecksPassed') == check_count
            and summary.get('comparisonChecksExpected') == 17 * len(rows)
            and all(summary.get(key) == sum(row.get(key, 0) for row in rows) for key in PRESENCE_KEYS),
            'Batch summary counters differ from its retained actual cases')
    if role == 'original':
        require(summary.get('status') == 'failed' and len(rows) == 11 and passed_count == 9 and check_count == 153
                and [row['case'] for row in rows if not row['passed']] == RECOVERED_CASES,
                'Original failed attempt must retain exactly its nine completed and two killed cases')
    else:
        wanted = RECOVERED_CASES if role == 'recovery' else ['weav-051']
        successes = len(wanted) - (1 if partial else 0)
        require(summary.get('status') == ('failed' if partial else 'passed') and len(rows) == len(wanted)
                and passed_count == successes and check_count == 17 * successes
                and [row['case'] for row in rows] == wanted
                and [row['case'] for row in rows if not row['passed']] == (['weav-051'] if partial else [])
                and summary.get('maximumConcurrentReplays') == 1 and summary.get('nodeOldSpaceMiB') == heap
                and (partial or summary.get('prevalidatedTotals') == totals),
                'Recovery batch differs from its exact declared complete or retained failed population')
        e.checked(summary['preflight'])
        for before, after in zip(rows, rows[1:]):
            require(instant(before['postprocessingFinishedAt']) <= instant(after['startedAt']), 'Recovery cases were not sequential')
    return summary, manifest, run, compared, input_binding


def build(original_path, recovery_path, original_execution, recovery_execution, source_path,
          final_recovery_path=None, final_recovery_execution=None,
          intermediate_failed_path=None, intermediate_failed_execution=None):
    require((final_recovery_path is None) == (final_recovery_execution is None),
            'Final recovery summary and execution must be supplied together')
    has_final = final_recovery_path is not None
    require((intermediate_failed_path is None) == (intermediate_failed_execution is None),
            'Intermediate failed summary and execution must be supplied together')
    has_intermediate = intermediate_failed_path is not None
    require(not has_intermediate or has_final, 'An intermediate failed invocation requires an explicit completed final recovery')
    e = h.Evidence()
    e.keep(__file__)
    helpers = [e.keep(path) for path in (HELPER, h.COMMON_PATH, h.DELIVERY_PATH)]
    native = e.load(source_path)
    h.manifest_valid(native, 'recovered replay freeze')
    e.file_map(native['files'], 'current frozen native source')
    require(h.delivery.inventory(['src/logos-engine', 'src/runtime'], {'.ts', '.json', '.drm'}) == native['files'],
            'Current native membership differs from the completed replay freeze')
    first, manifest, first_run, first_counts, first_binding = inspect_batch(
        e, original_path, original_execution, source_path, native, 'original')
    retry, retry_manifest, retry_run, retry_counts, retry_binding = inspect_batch(
        e, recovery_path, recovery_execution, source_path, native, 'recovery', partial=has_final, heap=1536)
    require(retry_manifest.get('recoveryOf') == first['caseManifest']
            and retry_manifest['cases'] == [case for case in manifest['cases'] if case['id'] in RECOVERED_CASES]
            and retry['passiveOwnerRequirements'] == first['passiveOwnerRequirements']
            and instant(first_run['finishedAt']) <= instant(retry_run['startedAt']),
            'Recovery changed the original case pins, requirements or temporal order')
    batches = [
        {'role': 'original', 'summary': first, 'manifest': manifest, 'run': first_run, 'compared': first_counts,
         'summaryPath': original_path, 'executionPath': original_execution, 'inputBinding': first_binding},
        {'role': 'recovery', 'summary': retry, 'manifest': retry_manifest, 'run': retry_run, 'compared': retry_counts,
         'summaryPath': recovery_path, 'executionPath': recovery_execution, 'inputBinding': retry_binding},
    ]
    if has_intermediate:
        middle, middle_manifest, middle_run, middle_counts, middle_binding = inspect_batch(e, intermediate_failed_path,
            intermediate_failed_execution, source_path, native, 'intermediate_failed', partial=True, heap=1024)
        require(middle_manifest['cases'] == [case for case in manifest['cases'] if case['id'] == 'weav-051']
                and middle_manifest['cases'] == [case for case in retry_manifest['cases'] if case['id'] == 'weav-051']
                and middle_manifest.get('recoveryOf') in (first['caseManifest'], retry['caseManifest'])
                and middle['passiveOwnerRequirements'] == first['passiveOwnerRequirements']
                and instant(retry_run['finishedAt']) <= instant(middle_run['startedAt']),
                'The retained failed 1024 MiB invocation changed the original WEAV pins or chronology')
        batches.append({'role': 'intermediate_failed', 'summary': middle, 'manifest': middle_manifest, 'run': middle_run,
            'compared': middle_counts, 'summaryPath': intermediate_failed_path, 'executionPath': intermediate_failed_execution,
            'inputBinding': middle_binding})
    if has_final:
        final_heap = 1536 if has_intermediate else 1024
        last, last_manifest, last_run, last_counts, last_binding = inspect_batch(e, final_recovery_path, final_recovery_execution,
            source_path, native, 'final_recovery', heap=final_heap)
        require(last_manifest['cases'] == [case for case in manifest['cases'] if case['id'] == 'weav-051']
                and last_manifest['cases'] == [case for case in retry_manifest['cases'] if case['id'] == 'weav-051']
                and last_manifest.get('recoveryOf') in [batch['summary']['caseManifest'] for batch in batches]
                and last['passiveOwnerRequirements'] == first['passiveOwnerRequirements']
                and instant(batches[-1]['run']['finishedAt']) <= instant(last_run['startedAt']),
                'Final recovery must be only the same original WEAV case, after every retained failed recovery')
        batches.append({'role': 'final_recovery', 'summary': last, 'manifest': last_manifest, 'run': last_run,
                        'compared': last_counts, 'summaryPath': final_recovery_path, 'executionPath': final_recovery_execution,
                        'inputBinding': last_binding})
    merged_inputs = {}
    for batch in batches:
        for name, digest in batch['summary']['executionInputs'].items():
            require(merged_inputs.setdefault(name, digest) == digest,
                    'Replay batches executed conflicting versions of a shared input')
    published = e.load(ROOT / 'docs/migration/lot5b-evidence/integrated-final/regressions/regression-summary.json')
    central_tools = ['scripts/run-released-public-regressions.py', 'scripts/run-recorded-public-regressions.py',
        'scripts/run-released-public-regressions-streamlog.py', 'scripts/compare-v54-regressions.py',
        'scripts/replay-public-regression-released-baseline.mjs', 'scripts/replay-v53-public-regression.mjs',
        'scripts/run-v53-campaign-proof.py']
    require(published.get('status') == 'passed'
            and all(merged_inputs.get(name) == published['executionInputs'].get(name) == e.keep(name)['sha256']
                    for name in central_tools), 'A central released replay tool differs from its published implementation')
    rows, source_rows, selections, failures = [], [], {}, []
    for case in manifest['cases']:
        successful = [(batch, row) for batch in batches for row in batch['summary']['results']
                      if row['case'] == case['id'] and row['passed']]
        require(len(successful) == 1, 'Every declared case needs one unique actual successful execution')
        batch, selected = successful[0]
        rows.append(selected)
        selections[case['id']] = batch
        source_rows.append({'case': selected['case'], 'source': batch['role'],
            'summary': e.keep(batch['summaryPath']), 'caseManifest': batch['summary']['caseManifest'],
            'execution': selected['execution'], 'enclosingExecution': e.keep(batch['executionPath']),
            'inputBindingMode': batch['inputBinding']['mode'],
            'postprocessingCompletedNoLaterThan': selected.get('postprocessingFinishedAt', batch['run']['finishedAt']),
            'postprocessingTimeBasis': 'actual_case_receipt' if 'postprocessingFinishedAt' in selected else 'actual_enclosing_invocation_upper_bound'})
    for batch in batches:
        for row in batch['summary']['results']:
            if row['passed']:
                continue
            failure = {'case': row['case'], 'source': batch['role'], 'summary': e.keep(batch['summaryPath']),
                'execution': row['execution'], 'output': row['output'],
                **({'outputRaw': row['outputRaw']} if 'outputRaw' in row else {}),
                'exitCode': row['exitCode'], 'timedOut': row['timedOut'], 'passed': False}
            if row['exitCode'] == -6:
                require(batch['role'] == 'intermediate_failed', 'Unexpected abort outside the actual retained heap failure')
                failure.update(observedTermination='SIGABRT', cause='explicit_node_v8_heap_exhaustion_diagnostic',
                               diagnostic=heap_failure_diagnostic(e, row))
            else:
                require(row['exitCode'] == -9, 'Unexpected retained failure signal')
                failure.update(observedTermination='SIGKILL', cause='not_established_by_retained_evidence')
            failures.append(failure)
    require(len(failures) == (4 if has_intermediate else 3 if has_final else 2),
            'A failed native execution was omitted from recovery provenance')
    populations = {key: sum(selections[row['case']]['compared'][row['case']][key] for row in rows) for key in TOTAL_KEYS}
    require(populations == first['prevalidatedTotals'], 'Recovered complete eleven-case population differs from the original prevalidation')
    retry_populations = {key: sum(selections[case['id']]['compared'][case['id']][key] for case in retry_manifest['cases'])
                         for key in TOTAL_KEYS}
    require(retry_populations == retry['prevalidatedTotals'], 'Recovered two-case population differs from its original recovery prevalidation')
    selected_counts = {role: sum(batch['role'] == role for batch in selections.values())
                       for role in ('original', 'recovery', 'intermediate_failed', 'final_recovery')}
    require(selected_counts == {'original': 9, 'recovery': 1 if has_final else 2,
                                'intermediate_failed': 0, 'final_recovery': 1 if has_final else 0},
            'Recovery replaced an already successful case or selected a different population')
    invocation_records = [{'source': batch['role'], 'summary': e.keep(batch['summaryPath']),
        'execution': e.keep(batch['executionPath']), 'status': batch['summary']['status'],
        'cases': batch['summary']['total'], 'passed': batch['summary']['passed'],
        'inputBindingMode': batch['inputBinding']['mode'], 'inputBinding': batch['inputBinding'],
        'maximumConcurrentReplays': batch['summary']['maximumConcurrentReplays'],
        'nodeOldSpaceMiB': batch['summary'].get('nodeOldSpaceMiB')} for batch in batches]
    result = {'schema': 'logos-engine.recorded-public-regressions.v1', 'status': 'passed',
        'mode': 'composed_completed_replay_evidence', 'caseManifest': first['caseManifest'],
        'nativeSource': native, 'nativeSourceAfter': native,
        'executionInputs': merged_inputs, 'executionInputsAfter': merged_inputs, 'executionInputsUnchanged': True,
        'maximumConcurrentReplays': max(batch['summary']['maximumConcurrentReplays'] for batch in batches),
        'prevalidatedTotals': populations, 'results': rows, 'passed': len(rows), 'total': len(rows),
        'comparisonChecksPassed': sum(row['comparisonChecks'] for row in rows), 'comparisonChecksExpected': 17 * len(rows),
        'passiveOwnerRequirements': first['passiveOwnerRequirements'],
        **{key: sum(row[key] for row in rows) for key in PRESENCE_KEYS},
        'composition': {'schema': COMPOSITION_SCHEMA, 'generator': e.keep(__file__), 'verificationHelpers': helpers,
            'originalSummary': e.keep(original_path), 'recoverySummary': e.keep(recovery_path),
            'intermediateFailedSummary': e.keep(intermediate_failed_path) if has_intermediate else None,
            'finalRecoverySummary': e.keep(final_recovery_path) if has_final else None,
            'originalExecution': e.keep(original_execution), 'recoveryExecution': e.keep(recovery_execution),
            'intermediateFailedExecution': e.keep(intermediate_failed_execution) if has_intermediate else None,
            'finalRecoveryExecution': e.keep(final_recovery_execution) if has_final else None,
            'sourceManifest': e.keep(source_path), 'originalStatusPreserved': first['status'],
            'recoveryStatusPreserved': retry['status'], 'sourceInvocations': invocation_records,
            'selectedOriginalCases': selected_counts['original'], 'selectedRecoveryCases': selected_counts['recovery'],
            'selectedIntermediateFailedCases': 0,
            'selectedFinalRecoveryCases': selected_counts['final_recovery'], 'retainedFailures': failures,
            'selections': source_rows, 'replaysExecuted': 0, 'comparisonsReexecuted': 0,
            'comparisonChecksRecountedFromExactRetainedChecks': True, 'inputs': list(e.inputs.values())},
        'qualification': 'Explicit composition of nine unchanged completed cases from the retained failed eleven-case attempt '
            'and exactly two successful recovered cases, with every intermediate failed invocation retained. '
            'Each selected row remains identical to its actual source summary and execution receipt. All seventeen comparison '
            'labels, complete input/report fingerprints, frozen native source and populations are checked. Failed -9 exits and '
            'logs remain failed with cause undetermined. A retained -6 exit is separately bound to its explicit V8 heap diagnostic, '
            'without inferring host or cgroup OOM. Replay-host lifetime and declared heap-cap differences remain '
            'visible in the actual commands and source invocations. No replay, game, comparator or measurement is run by '
            'consolidation. Each parent input-inventory variant is explicit. When the final parent contains no input list, '
            'binding relies on its actual retained child-driver before/after inventories, immutable child-start receipt, '
            'completed child execution and preflight; no parent prelaunch inventory is asserted or recreated. '
            'KATA is reused from its sole completed replay.'}
    e.recheck()
    return result


def verify_summary(path, native=None):
    e = h.Evidence()
    actual = e.load(path)
    composition = actual.get('composition', {})
    require(composition.get('schema') == COMPOSITION_SCHEMA, 'Missing explicit replay recovery composition')
    before = e.keep(path)
    expected = build(composition['originalSummary']['path'], composition['recoverySummary']['path'],
                     composition['originalExecution']['path'], composition['recoveryExecution']['path'],
                     composition['sourceManifest']['path'],
                     composition['finalRecoverySummary']['path'] if composition['finalRecoverySummary'] is not None else None,
                     composition['finalRecoveryExecution']['path'] if composition['finalRecoveryExecution'] is not None else None,
                     composition['intermediateFailedSummary']['path'] if composition['intermediateFailedSummary'] is not None else None,
                     composition['intermediateFailedExecution']['path'] if composition['intermediateFailedExecution'] is not None else None)
    require(same({key: value for key, value in actual.items() if key != 'recordedAt'}, expected)
            and set(actual) == set(expected) | {'recordedAt'}, 'Composed summary differs from its independently verified source receipts')
    require(native is None or same(actual['nativeSource'], native), 'Composed summary names another candidate freeze')
    require(all(instant(row['postprocessingCompletedNoLaterThan']) <= instant(actual['recordedAt'])
                for row in composition['selections']), 'Composition was dated before its actual completed comparisons')
    require(e.keep(path) == before, 'Composed summary changed during verification')
    return actual


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original-summary', type=Path, required=True)
    parser.add_argument('--recovery-summary', type=Path, required=True)
    parser.add_argument('--original-execution', type=Path, required=True)
    parser.add_argument('--recovery-execution', type=Path, required=True)
    parser.add_argument('--final-recovery-summary', type=Path)
    parser.add_argument('--final-recovery-execution', type=Path)
    parser.add_argument('--intermediate-failed-summary', type=Path)
    parser.add_argument('--intermediate-failed-execution', type=Path)
    parser.add_argument('--source-manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = local(args.output)
    require(output.is_relative_to(BASE) and not output.exists() and not output.is_symlink(), 'Composed summary output must be fresh and confined')
    result = build(args.original_summary, args.recovery_summary, args.original_execution, args.recovery_execution,
                   args.source_manifest, args.final_recovery_summary, args.final_recovery_execution,
                   args.intermediate_failed_summary, args.intermediate_failed_execution)
    result['recordedAt'] = datetime.now(timezone.utc).isoformat()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': 'passed', 'receipt': h.fingerprint(output), 'cases': result['total'],
                      'comparisonChecks': result['comparisonChecksPassed'],
                      'retainedFailedExecutions': len(result['composition']['retainedFailures']),
                      'replaysExecuted': 0, 'comparisonsReexecuted': 0}))


if __name__ == '__main__':
    main()
