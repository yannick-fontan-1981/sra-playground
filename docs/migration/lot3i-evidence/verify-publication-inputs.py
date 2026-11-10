#!/usr/bin/env python3
"""Verify completed 3I publication inputs without rerunning their producers.

Run only after final tests, actual case work/browser QA, all four WEAV attempt
receipts and strict recovery, timing, consolidation, integrity and report writing.
Actual results are read from receipts; rejected cost is a qualified publication
outcome, never silently promoted to acceptance. This file runs no producer.
"""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import gzip
import hashlib
import json
import math

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
LOCAL = timezone(timedelta(hours=-3))
NATIVE_DIGEST = 'e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87'
BASELINE_COMMIT = '8fa6b261b8b23ac8d232e60c9c179e2f3407d82f'
BASELINE_DIGEST = 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054'
VALIDATION = BASE / 'final/validation'
EXPECTED_CASE_CLOCKS = {'CWSE': 2399.683865, 'SK48': 667.35444, 'FOGW': 951.320275,
                        'VOIS': 1017.469531, 'WEAV': 1277.782615}


@lru_cache(maxsize=None)
def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def record(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError('Expected regular retained input: ' + str(path))
    return {'path': path.relative_to(ROOT).as_posix(),
            'bytes': path.stat().st_size, 'sha256': sha(path)}


def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)


def check(files):
    for name, digest in files.items():
        assert record(ROOT / name)['sha256'] == digest, name
    return len(files)


def check_record(item):
    actual = record(ROOT / item['path'])
    assert actual == {key: item[key] for key in ('path', 'bytes', 'sha256')}, item['path']


def check_embedded_records(value):
    """Verify explicit file fingerprints without interpreting arbitrary data."""
    if isinstance(value, dict):
        if all(key in value for key in ('path', 'bytes', 'sha256')):
            check_record(value)
        else:
            for item in value.values():
                check_embedded_records(item)
    elif isinstance(value, list):
        for item in value:
            check_embedded_records(item)


def final_status(value, label):
    status = value.get('status')
    assert isinstance(status, str) and status, label
    assert status not in ('pending', 'running', 'in_progress', 'not_started', 'awaiting_result'), label
    return status


def check_weav_recovery(regressions):
    """Require two failures, the incomplete third attempt and the fourth strict pass.

    The successful directory is obtained from the consolidated result, not an
    assumed future path. No preflight output can exist before recovery finishes.
    """
    first_path = BASE / 'final/regressions/regression-summary-interrupted.json'
    second_path = BASE / 'final/weav-retry/regressions/regression-summary.json'
    first, second = read(first_path), read(second_path)
    assert first['status'] == second['status'] == 'failed'
    assert first['passed'] == 4 and first['total'] == 5
    assert first['comparisonChecksPassed'] == 68 and first['comparisonChecksExpected'] == 85
    assert second['passed'] == 0 and second['total'] == 1
    assert second['comparisonChecksPassed'] == 0 and second['comparisonChecksExpected'] == 17
    first_failed = [row for row in first['results'] if not row['passed']]
    assert len(first_failed) == 1 and first_failed[0]['game'] == 'WEAV'
    assert len(second['results']) == 1 and second['results'][0]['game'] == 'WEAV'
    attempt_paths = [BASE / 'final/regressions/weav-049-execution.json',
                     BASE / 'final/weav-retry/regressions/weav-049-isolated-execution.json']
    attempts = [read(path) for path in attempt_paths]
    for summary, attempt, failed, code in zip([first, second], attempts,
            [first_failed[0], second['results'][0]], [-9, -6]):
        assert attempt == {key: value for key, value in failed.items() if key != 'execution'}
        assert failed['execution'] == record(attempt_paths[0] if code == -9 else attempt_paths[1])
        assert attempt['game'] == 'WEAV' and attempt['passed'] is False
        assert attempt['exitCode'] == code and attempt['timedOut'] is False
        assert attempt['nativeSourceBeforeDigest'] == attempt['nativeSourceAfterDigest'] == NATIVE_DIGEST
        assert attempt['nativeSourceUnchanged'] and attempt['immutableInputsUnchanged']
        assert summary['nativeSource']['digest'] == summary['nativeSourceAfter']['digest'] == NATIVE_DIGEST
        assert summary['executionInputsUnchanged'] and summary['executionInputs'] == summary['executionInputsAfter']
        check(summary['executionInputs'])
        check_embedded_records(attempt)
    plan = read(BASE / 'weav-recovery-plan.json')
    assert plan['nodeOldSpaceMiB'] == 768
    assert plan['productionSourceChanged'] is False and plan['traceOrComparatorChanged'] is False
    assert plan['officialCostEnvironmentChanged'] is False and plan['priorWEAVClockChanged'] is False
    check_embedded_records(plan)
    second_output = ROOT / attempts[1]['output']['path']
    raw = second_output.read_bytes()
    heap_log = (gzip.decompress(raw) if second_output.suffix == '.gz' else raw).decode(errors='replace')
    assert 'heap out of memory' in heap_log.lower(), 'Second failure must retain its actual heap error'

    incomplete_path = BASE / 'final/weav-memory-retry/interruption-observation.json'
    incomplete = read(incomplete_path)
    assert incomplete['schema'] == 'logos-engine.external-execution-interruption-observation.v1'
    assert incomplete['status'] == 'incomplete_process_handle_unavailable'
    assert incomplete['executionSessionId'] == 68109
    assert incomplete['performanceLockProbeExitCode'] == 0
    assert incomplete['finalSummaryPresent'] is False and incomplete['finalReplayReportPresent'] is False
    assert 'Unknown process id' in incomplete['observedToolError']
    assert 'exitCode' not in incomplete, 'The incomplete third attempt has no retained exit status'
    assert incomplete['cause'].startswith('Not established.')
    check_embedded_records(incomplete)
    incomplete_host = read(ROOT / incomplete['completedHostPreparation']['path'])
    assert incomplete_host['schema'] == 'logos-engine.released-baseline-replay-preparation.v1'
    assert incomplete_host['status'] == 'passed'
    assert incomplete_host['baselineRootCollectedBeforeHarnessImport'] is True
    assert incomplete_host['expectedActions'] == 81 and incomplete_host['completePublicPackets'] == 82
    assert incomplete_host['baseline'] == attempts[0]['baseline']
    assert incomplete_host['trace'] == attempts[0]['trace']
    check_embedded_records(incomplete_host)
    incomplete_preflight = read(ROOT / incomplete['completedPreflight']['path'])
    assert incomplete_preflight['schema'] == 'logos-engine.released-baseline-replay-preflight.v1'
    assert incomplete_preflight['status'] == 'passed'
    assert incomplete_preflight['prevalidationProcessExitedBeforeAnyReplay'] is True
    assert incomplete_preflight['nativeSourceDigest'] == NATIVE_DIGEST
    check_embedded_records(incomplete_preflight)

    final_rows = [row for row in regressions['results'] if row['game'] == 'WEAV']
    assert len(final_rows) == 1
    final = final_rows[0]
    assert final['case'] == 'weav-049-streamlog' and final['phase'] == 'completed'
    assert final['passed'] and final['exitCode'] == 0 and final['timedOut'] is False
    assert final['nodeExitObserved'] is True and 'driverInterruption' not in final
    assert final['comparisonPassed'] and final['comparisonChecks'] == 17 and final['failedChecks'] == []
    final_execution_path = ROOT / final['execution']['path']
    check_record(final['execution'])
    assert final_execution_path not in attempt_paths
    assert final_execution_path.parent == BASE / 'final/weav-memory-retry-v2/regressions'
    final_execution = read(final_execution_path)
    assert final_execution == {key: value for key, value in final.items() if key != 'execution'}
    check_embedded_records(final_execution)
    assert final['baseline'] == attempts[0]['baseline'] == attempts[1]['baseline']
    assert final['trace'] == attempts[0]['trace'] == attempts[1]['trace']
    assert isinstance(final['memorySamples'], list) and final['memorySamples']
    assert 'lastProgress' in final
    raw_output_path = ROOT / final['outputRaw']['path']
    compressed_output_path = ROOT / final['output']['path']
    assert raw_output_path.parent == compressed_output_path.parent == final_execution_path.parent
    assert raw_output_path.name == 'weav-049-streamlog-output.raw.log'
    assert compressed_output_path.name == 'weav-049-streamlog-output.log.gz'
    decompressed_digest, decompressed_bytes = hashlib.sha256(), 0
    with gzip.open(compressed_output_path, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            decompressed_digest.update(chunk)
            decompressed_bytes += len(chunk)
    assert decompressed_digest.hexdigest() == final['outputRaw']['sha256']
    assert decompressed_bytes == final['outputRaw']['bytes']
    assert 0 <= final['rawOutputBytes'] <= decompressed_bytes
    started_path = ROOT / final['startedReceipt']['path']
    assert started_path.parent == final_execution_path.parent
    started = read(started_path)
    assert started['phase'] == 'started' and started['passed'] is False
    assert started['exitCode'] is None and started['nodeExitObserved'] is False
    assert started['case'] == final['case'] and started['command'] == final['command']
    assert started['baseline'] == final['baseline'] and started['trace'] == final['trace']
    assert started['nativeSourceBeforeDigest'] == NATIVE_DIGEST
    check_embedded_records(started)
    retained_passes = {row['game']: row for row in first['results'] if row['passed']}
    assert {row['game']: row for row in regressions['results'] if row['game'] != 'WEAV'} == retained_passes
    assert isinstance(regressions.get('recovery'), dict), 'Consolidated strict recovery must be explicit'
    recovery_chain = regressions['recovery']
    assert recovery_chain['initialSummary'] == record(first_path)
    assert recovery_chain['memoryCappedSummary'] == record(second_path)
    assert recovery_chain['incompleteAttempt'] == record(incomplete_path)
    fourth_summary_path = BASE / 'final/weav-memory-retry-v2/regressions/regression-summary.json'
    assert recovery_chain['isolatedSummary'] == record(fourth_summary_path)
    assert recovery_chain['plan'] == record(BASE / 'weav-streamlog-recovery-plan.json')
    assert recovery_chain['earlierMemoryPlan'] == record(BASE / 'weav-memory-recovery-plan.json')
    assert recovery_chain['earlierPlan'] == record(BASE / 'weav-recovery-plan.json')
    fourth_summary = read(fourth_summary_path)
    assert fourth_summary['status'] == 'passed' and fourth_summary['passed'] == fourth_summary['total'] == 1
    assert fourth_summary['comparisonChecksPassed'] == fourth_summary['comparisonChecksExpected'] == 17
    assert fourth_summary['results'] == [final]
    assert fourth_summary['executionInputsUnchanged'] is True
    assert fourth_summary['executionInputs'] == fourth_summary['executionInputsAfter']
    check(fourth_summary['executionInputs'])
    streamlog_plan = read(BASE / 'weav-streamlog-recovery-plan.json')
    assert streamlog_plan['schema'] == 'logos-engine.recorded-regression-streamlog-recovery-plan.v1'
    assert streamlog_plan['previousAttempt']['status'] == incomplete['status']
    assert streamlog_plan['previousAttempt']['exitCode'] is None
    assert streamlog_plan['previousAttempt']['preflight'] == incomplete['completedPreflight']
    assert streamlog_plan['previousAttempt']['hostPreparation'] == incomplete['completedHostPreparation']
    assert streamlog_plan['expected']['id'] == final['case']
    assert streamlog_plan['expected']['commands'] == 81
    assert streamlog_plan['expected']['completePublicPackets'] == 82
    assert streamlog_plan['expected']['comparisonChecks'] == 17
    assert ROOT / streamlog_plan['expected']['summary'] == fourth_summary_path
    assert streamlog_plan['memoryPolicy']['nodeOldSpaceMiB'] == final['nodeOldSpaceMiB'] == 1536
    assert streamlog_plan['memoryPolicy']['productionBudgetsChanged'] is False
    assert streamlog_plan['memoryPolicy']['officialCostEnvironmentChanged'] is False
    check_embedded_records(streamlog_plan)
    check_embedded_records(recovery_chain)
    recovery_path = BASE / 'regression-recovery.json'
    recovery = read(recovery_path)
    assert recovery['status'] == 'passed' and recovery['nativeSourceDigest'] == NATIVE_DIGEST
    assert recovery['finalCasesPassed'] == recovery['finalCasesExpected'] == 5
    assert recovery['finalChecksPassed'] == recovery['finalChecksExpected'] == 85
    assert recovery['incompleteAttempt'] == record(incomplete_path)
    assert recovery['isolatedSummary'] == record(fourth_summary_path)
    assert recovery['finalSummary'] == record(BASE / 'final/regressions/regression-summary.json')
    check_embedded_records(recovery)
    assert final['hostPreparationPassed'] is True
    assert final['historicalReportProcessExitedBeforeNode'] is True
    assert final['nodeExitedBeforeComparison'] is True
    host_path = ROOT / final['hostPreparation']['path']
    check_record(final['hostPreparation'])
    assert host_path.is_file(), 'The actual low-memory host preparation must be retained'
    host = read(host_path)
    assert host['schema'] == 'logos-engine.released-baseline-replay-preparation.v1'
    assert host['status'] == 'passed' and host['baselineRootCollectedBeforeHarnessImport'] is True
    assert host['expectedActions'] == 81 and host['completePublicPackets'] == 82
    assert host['baseline'] == final['baseline'] and host['trace'] == final['trace']
    check_embedded_records(host)
    preparation_path = ROOT / final['preflight']['path']
    check_record(final['preflight'])
    preparation = read(preparation_path)
    assert preparation['schema'] == 'logos-engine.released-baseline-replay-preflight.v1'
    assert preparation['status'] == 'passed' and preparation['prevalidationProcessExitedBeforeAnyReplay'] is True
    assert preparation['nativeSourceDigest'] == NATIVE_DIGEST
    check_embedded_records(preparation)
    return {
        'status': 'passed', 'retainedFailedAttempts': [record(path) for path in attempt_paths],
        'retainedFailureExitCodes': [-9, -6], 'secondAttemptDeclaredNodeOldSpaceMiB': 768,
        'retainedIncompleteAttempts': [record(incomplete_path)],
        'retainedIncompleteAttemptStatuses': [incomplete['status']],
        'incompleteAttemptExitStatusKnown': False, 'incompleteAttemptCauseEstablished': False,
        'incompleteHostPreparation': incomplete['completedHostPreparation'],
        'incompleteSubprocessPreflight': incomplete['completedPreflight'],
        'finalAttemptNumber': 4,
        'finalExecution': record(final_execution_path), 'strictComparison': final['comparison'],
        'startedReceipt': record(started_path),
        'retainedOutputRaw': final['outputRaw'], 'retainedOutputCompressed': final['output'],
        'rawOutputMatchesCompressed': True, 'nodeExitObserved': True,
        'hostPreparation': record(host_path), 'subprocessPreflight': record(preparation_path),
        'recovery': record(recovery_path), 'strictChecksPassed': 17,
        'qualification': 'Both failures remain retained. The first signal9 termination is not asserted to have a proved memory cause; the second log records heap exhaustion. The third invocation remains incomplete with an unavailable process handle, no retained exit status and no established cause; only its completed prevalidation and host preparation are credited. The fourth invocation must complete every unchanged strict comparison on identical archived baseline and public-trace bytes before this verification can pass.'
    }


def main():
    output = BASE / 'publication-preflight.json'
    if output.exists():
        raise FileExistsError(output)
    manifest = read(BASE / 'final/source-manifest.json')
    assert manifest['digest'] == NATIVE_DIGEST and manifest['fileCount'] == 270
    current = dict(sorted((path.relative_to(ROOT).as_posix(), sha(path))
        for folder in ['src/logos-engine', 'src/runtime']
        for path in (ROOT / folder).rglob('*')
        if path.is_file() and path.suffix in ('.ts', '.json', '.drm')))
    assert current == manifest['files']
    assert hashlib.sha256(json.dumps(current, separators=(',', ':')).encode()).hexdigest() == NATIVE_DIGEST
    archive = read(BASE / 'final/source-archive.json')
    assert archive['nativeSourceManifestDigest'] == NATIVE_DIGEST and len(archive['files']) == 281
    check_record(archive['archive'])

    baseline = read(BASE / 'baseline/provenance.json')
    assert baseline['siteVersion'] == 78 and baseline['nativeVersion'] == '0.49.0'
    assert baseline['commit'] == BASELINE_COMMIT
    assert baseline['nativeSource']['digest'] == BASELINE_DIGEST
    assert baseline['nativeSource']['fileCount'] == 268

    tests = read(VALIDATION / 'delta-tests-run.json')
    build = read(VALIDATION / 'checks-run.json')
    assert tests['status'] == build['status'] == 'passed'
    formal = [item for item in tests['checks'] if item['name'] == 'delta-tests']
    assert len(formal) == 1 and formal[0]['tapSummaryComplete'] is True
    formal = formal[0]
    assert formal['exitCode'] == 0
    test_counts = formal['counts']
    assert test_counts['tests'] == test_counts['pass'] and test_counts['tests'] == 3225
    assert all(test_counts[key] == 0 for key in ('fail', 'cancelled', 'skipped', 'todo'))
    assert len(tests['testFiles']) == len(set(tests['testFiles'])) == 76
    for value in [tests, build]:
        assert value['nativeSourceManifestDigest'] == NATIVE_DIGEST
        assert value['nativeSourceUnchanged'] is True
        for item in value['checks']:
            check_record(item['output'])
    assert tests['sourceAndTestInputsUnchanged'] is True
    assert len(build['checks']) == 5 and all(item['exitCode'] == 0 for item in build['checks'])
    assert {item['name'] for item in build['checks']} == {'typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build'}
    audit_path = VALIDATION / 'migration-audit-resolution.json'
    audit = read(audit_path)
    assert audit['status'] == 'passed' and audit['exitCode'] == 0
    assert audit['nativeSourceDigest'] == NATIVE_DIGEST and audit['audit']['failures'] == []
    original_audit = next(item['output'] for item in build['checks'] if item['name'] == 'migration-audit')
    assert audit['earlierAudit'] == original_audit
    check_embedded_records(audit)
    assert 'Missing differential evidence: docs/migration/lot3i-recurrent-series-lineage.md' in gzip.decompress(
        (ROOT / original_audit['path']).read_bytes()).decode()
    counts = {'native': check(manifest['files']), 'frozenArchiveInputs': check(archive['files']),
              'sourceAndTests': check(tests['sourceAndTestInputs']),
              'buildInputs': check(build['buildInputs'])}

    scope = read(BASE / 'final/recurrent-series-validation-scope.json')
    loop = read(BASE / 'final/recurrent-series-common-loop.json.gz')
    assert scope['nativeDigest'] == loop['nativeSource']['digest'] == NATIVE_DIGEST
    assert isinstance(scope['gameContributionStatus'], str) and scope['gameContributionStatus']
    assert isinstance(scope['integratedEvidenceKind'], str) and scope['integratedEvidenceKind']
    assert scope['integratedEvidence']['path'] == (BASE / 'final/recurrent-series-common-loop.json.gz').relative_to(ROOT).as_posix()
    check_embedded_records(scope)
    assert loop['status'] == 'passed' and loop['verifiedCheckGroups'] == len(loop['checks']) == 18
    assert loop['scope']['synthetic'] is True and loop['scope']['coldControllerSessions'] == 2
    assert loop['scope']['controlledReturnedCommands'] == loop['scope']['commonAcquiredTransitions'] == 2
    assert loop['scope']['ownControlledReturnedCommands'] == 2
    assert loop['scope']['priorSourceControlledReturns'] == 0
    for name in ['liveGameSessions', 'liveGameActions', 'liveGameLevelCompletions',
                 'liveGameVictories', 'sourcePythonAgentExecutions', 'learnedCheckpointsInjected']:
        assert loop['scope'][name] == 0, name
    assert loop['scope']['fullCallerParityClaimed'] is False
    assert loop['scope']['fullCallerAblationExecuted'] is False
    assert loop['scope']['supportedPreparationCompleteCallerClaimed'] is False
    assert len(loop['componentAblations']) == 2
    assert {item['branch'] for item in loop['componentAblations']} == {'matched', 'refuted'}
    for item in loop['componentAblations']:
        assert item['actionOrRefusalChanged'] is True
        assert item['scope'] == 'recurrent_series_component_only'
        assert item['fullCallerCounterfactualExecuted'] is False
    assert loop['sourceUnchangedDuringRun'] and loop['executionInputsUnchangedDuringRun']
    assert loop['sourceDeclarationsModified'] is False
    for item in loop['executionInputs']:
        check_record(item)

    # Actual CONN contribution is distinct from the two-return synthetic proof.
    conn = read(BASE / 'final/conn-resolution.json')
    selection = read(BASE / 'conn-selection.json')
    assert conn['game'] == selection['game'] == 'CONN'
    conn_status = final_status(conn, 'CONN resolution')
    assert conn_status == 'target_reached' and conn['nativeSourceDigest'] == NATIVE_DIGEST
    assert conn['nativeVersion'] == '0.50.0' and conn['targetLevels'] == 3
    actual = conn['actual']
    assert actual['actions'] == actual['prefixes'] == 21 and actual['levelsCompleted'] == 3
    assert actual['level'] == 4 and actual['state'] == 'NOT_FINISHED'
    assert actual['reason'] == 'target_levels_completed' and actual['sessions'] == 1
    assert actual['fullV6Parity'] is False
    clock = conn['caseClock']
    assert clock['previousCumulativeSeconds'] == selection['caseClock']['previousChargedSeconds'] == 0
    assert clock['maximumCumulativeSeconds'] == selection['caseClock']['maximumSeconds'] == 2400
    assert clock['clockReset'] is False and clock['furtherWorkThisDelivery'] is False
    assert math.isclose(clock['cumulativeSeconds'], 1014.763812, rel_tol=0, abs_tol=1e-6)
    assert math.isclose(clock['cumulativeSeconds'], clock['previousCumulativeSeconds'] + clock['currentIntervalSeconds'], rel_tol=0, abs_tol=1e-6)
    assert math.isclose(clock['remainingSeconds'], 2400 - clock['cumulativeSeconds'], rel_tol=0, abs_tol=1e-6)
    assert clock['startedAt'] == selection['resumedAt'] and scope['retainedCaseClocks'] == EXPECTED_CASE_CLOCKS
    assert selection['clocksUnchanged'] == EXPECTED_CASE_CLOCKS
    check_embedded_records(conn)
    check_embedded_records(selection)
    native_parity = read(BASE / 'diagnostic/conn-public-parity.json')
    source_parity = read(BASE / 'diagnostic/conn-public-source-parity.json.gz')
    assert native_parity['status'] == source_parity['status'] == 'passed'
    assert native_parity['checkedCount'] == len(native_parity['checks']) == 1361 and native_parity['failure'] is None
    assert native_parity['nativeSourceDigest'] == source_parity['nativeSourceDigest'] == NATIVE_DIGEST
    for value in [native_parity, source_parity]:
        assert value['originalFilesVerifiedBefore'] == value['originalFilesVerifiedAfter'] == 1786
        assert value['newGameActions'] == value['levelJumps'] == 0
        for item in value['inputs']: check_record(item)
    own = native_parity['exactOriginal']
    assert own['coldStart'] is True and own['primedFromCapturedProposalMemory'] is False
    assert own['selectedPrefixes'] == own['selectedReturns'] == 14
    assert own['returns'] == 21 and own['ownEvents'] == 34 and own['restorations'] == 35
    assert own['completeSelectedOwnTrajectoryParity'] and own['completeAllReturnAcquisitionParity']
    assert own['fullInheritedCallerParity'] is False
    assert source_parity['capturedGameActions'] == 21 and source_parity['capturedSelectedRecurrentPrefixes'] == 14
    assert source_parity['capturedAllRecurrentEvents'] == 34 and not source_parity['exactOriginal']['differences']
    assert source_parity['exactOriginal']['stop'] is None
    assert conn['sourceComparison']['checkedCount'] == native_parity['checkedCount']
    assert conn['sourceComparison']['exactOriginal'] == own
    contribution = native_parity['contribution']
    assert conn['contribution'] == contribution
    assert contribution['interventions'] == contribution['executed'] == 84
    assert contribution['actionOrRefusalChanges'] == 33 and contribution['negativeOrUnchanged'] == 51
    assert contribution['decisionChanges'] == 35 and contribution['componentAblation'] is True
    assert contribution['fullCallerAblation'] is False
    assert source_parity['ablation']['interventions'] == source_parity['ablation']['executed'] == 84
    assert source_parity['ablation']['actionOrRefusalChanges'] == 33
    assert source_parity['ablation']['negativeOrUnchanged'] == 51
    assert len(native_parity['ablations']) == len(source_parity['ablation']['cases']) == 84

    regressions = read(BASE / 'final/regressions/regression-summary.json')
    assert regressions['status'] == 'passed' and regressions['passed'] == regressions['total'] == 5
    assert regressions['nativeSource']['digest'] == regressions['nativeSourceAfter']['digest'] == NATIVE_DIGEST
    assert regressions['executionInputsUnchanged'] is True
    assert regressions['comparisonChecksPassed'] == regressions['comparisonChecksExpected'] == 85
    assert {item['game'] for item in regressions['results']} == {'CATR', 'RSWP', 'FOGW', 'VOIS', 'WEAV'}
    assert all(item['passed'] and item['comparisonPassed'] and item['comparisonChecks'] == 17 for item in regressions['results'])
    check_embedded_records(regressions)
    for item in regressions['results']:
        comparison = read(ROOT / item['comparison']['path'])
        assert comparison['passed'] is True and len(comparison['checks']) == 17
        assert all(check['passed'] is True and check['baselineProjectionSha256'] == check['currentProjectionSha256']
                   for check in comparison['checks'])
        assert comparison['before']['sourceDigest'] == BASELINE_DIGEST
        assert comparison['after']['sourceDigest'] == NATIVE_DIGEST
        assert comparison['before']['path'] == item['baseline']['path']
        assert comparison['after']['path'] == item['report']['path']
        assert item['nativeSourceBeforeDigest'] == item['nativeSourceAfterDigest'] == NATIVE_DIGEST
        assert item['nativeSourceUnchanged'] and item['immutableInputsUnchanged']
        assert item['final']['nativeImplementation'] == 'logos-engine.typescript.v6.native-migration/0.50.0'
    recovery_summary = check_weav_recovery(regressions)
    counts['regressionExecutionInputs'] = check(regressions['executionInputs'])
    browser = read(BASE / 'final/browser/browser-qa.json')
    browser_status = final_status(browser, 'Browser QA')
    assert browser_status not in ('failed', 'not_run')
    assert browser['nativeSourceDigest'] == NATIVE_DIGEST
    assert browser['game'] == 'CONN' and browser['continuousColdSession'] is True
    assert browser['manualGameActions'] == browser['levelJumps'] == 0
    assert browser['final'] == {'actions': 21, 'levelsCompleted': 3, 'plans': 21, 'currentLevel': 4}
    assert len(browser['checks']) == 5 and browser['checks'][0]['state'] == 'Paused.'
    assert browser['checks'][1]['state'] == 'One action completed.'
    for item in browser['artifacts']:
        check_record(item)
    integrity = read(BASE / 'final/delivery-integrity.json')
    assert integrity['status'] == 'passed' and integrity['nativeSourceDigest'] == NATIVE_DIGEST
    assert integrity['matchedFileInventories']['native'] == counts['native']
    assert integrity['matchedFileInventories']['archive'] == counts['frozenArchiveInputs']
    assert integrity['matchedFileInventories']['sourceAndTests'] == counts['sourceAndTests']
    assert integrity['matchedFileInventories']['buildInputs'] == counts['buildInputs']
    assert integrity['matchedFileInventories']['regressionExecutionInputs'] == counts['regressionExecutionInputs']
    assert integrity['originalSourceFilesUnchanged'] == 1786
    for item in integrity['receipts']:
        check_record(item)

    window = read(BASE / 'performance/window.json')
    cost = read(BASE / 'performance/global-budget-decision.json')
    policy = read(BASE / 'performance/global-budget-policy.json')
    consolidation = read(BASE / 'performance/consolidation-review.json')
    assert window['status'] == window['finalIntegrity'] == consolidation['status'] == 'passed'
    assert consolidation['checkedCount'] == len(consolidation['checks']) == 231
    assert all(item['passed'] is True for item in consolidation['checks'])
    assert cost['totalCases'] == len(cost['globalCases']) == 2
    assert {item['case'] for item in cost['globalCases']} == {'STCK', 'SMLP'}
    for item in cost['globalCases']:
        assert item['sessionsPerVersion'] == 8 and item['beforeMedianMs'] > 0
        ratio = item['afterMedianMs'] / item['beforeMedianMs'] - 1
        assert math.isclose(item['medianRelativeIncrease'], ratio, rel_tol=0, abs_tol=1e-12)
        assert item['accepted'] == (ratio < 0.1)
    assert cost['acceptedCases'] == sum(item['accepted'] is True for item in cost['globalCases'])
    assert cost['accepted'] == (cost['acceptedCases'] == cost['totalCases'])
    assert cost['status'] == ('accepted_under_user_global_rule' if cost['accepted'] else 'global_budget_review_required')
    assert cost['measuredSessions'] == 32 and cost['measuredActions'] == 400
    assert policy['globalStage'] == 'session_elapsed' and policy['relativeIncreaseLimit'] == 0.1
    assert policy['comparison'] == 'strictly_less_than' and policy['allCasesMustPass'] is True
    assert policy['crossCaseCompensation'] is False and policy['phaseOverrunsMayBeAccepted'] is True
    assert policy['baseline']['commit'] == BASELINE_COMMIT and policy['baseline']['siteVersion'] == 78
    assert policy['candidate']['nativeDigest'] == NATIVE_DIGEST
    assert policy['baseline']['nativeDigest'] == BASELINE_DIGEST
    assert policy['measuredSessions'] == 32 and policy['measuredActions'] == 400
    readiness = read(BASE / 'performance/readiness.json')
    assert readiness['measurementAuthorized'] and not readiness['pendingRequirements']
    isolation_path = BASE / 'performance/coordinated-isolation.json'
    isolation = read(isolation_path)
    assert isolation['status'] == 'acknowledged_quiet_before_window'
    acknowledgement_path = BASE / 'performance/other-lane-quiet-acknowledgement.json'
    acknowledgement = read(acknowledgement_path)
    assert acknowledgement['acknowledgement']['coordination_acknowledged'] is True
    assert acknowledgement['acknowledgement']['heavy_work_started'] is False
    assert acknowledgement['acknowledgement']['performance_started'] is False
    readiness_paths = {item['path'] for item in readiness['inputs']}
    assert isolation_path.relative_to(ROOT).as_posix() in readiness_paths
    for item in [*readiness['inputs'], *consolidation['inputs'], *cost['inputs']]:
        check_record(item)
    optional_review = BASE / 'diagnostic/cost-result-review.json'
    optional_review_record = None
    if optional_review.is_file():
        independent = read(optional_review)
        assert independent['status'] == 'passed'
        assert independent['checkedCount'] == len(independent['checks']) and independent['checkedCount'] > 0
        assert all(item['passed'] is True for item in independent['checks'])
        assert not independent.get('unsatisfied', [])
        if 'inputReceiptsUnchanged' in independent:
            assert independent['inputReceiptsUnchanged'] is True
        for item in independent['inputs']:
            check_record(item)
        optional_review_record = record(optional_review)
    results = (BASE / 'performance/results.md').read_text()
    report = (BASE.parent / 'lot3i-recurrent-series.md').read_text()
    assert 'En attente' not in results
    for placeholder in ['Aucun résultat de coût n’est anticipé.', 'FINAL_COST', 'LOT3I_COST_RESULT']:
        assert placeholder not in report
    entries = read(BASE.parent / 'v6-entry-point-progress.json')
    assert entries['connected'] == 54 and entries['declared'] == 76 and entries['partiallyConnected'] == 0
    assert entries['fullV6Parity'] is False

    inputs = [BASE / name for name in [
        'baseline/provenance.json', 'final/source-manifest.json', 'final/source-archive.json',
        'final/validation/delta-tests-run.json', 'final/validation/checks-run.json',
        'final/regressions/regression-summary.json', 'final/browser/browser-qa.json',
        'final/recurrent-series-common-loop.json.gz', 'final/recurrent-series-validation-scope.json',
        'final/conn-resolution.json', 'final/delivery-integrity.json',
        'performance/readiness.json', 'performance/window.json', 'performance/global-budget-policy.json',
        'performance/global-budget-decision.json', 'performance/consolidation-review.json',
        'performance/coordinated-isolation.json', 'performance/other-lane-quiet-acknowledgement.json',
        'performance/results.md', 'README.md',
    ]]
    inputs += [BASE.parent / name for name in ['lot3i-recurrent-series.md', 'lot3i-recurrent-series-lineage.md',
                                             'v6-delivery-roadmap.md', 'v6-native-transfer.md', 'v6-entry-point-progress.json']]
    inputs += [BASE / name for name in ['conn-selection.json', 'diagnostic/conn-public-parity.json',
        'diagnostic/conn-public-source-parity.json.gz', 'final/validation/migration-audit-resolution.json',
        'final/regressions/regression-summary-interrupted.json',
        'final/weav-retry/regressions/regression-summary.json',
        'final/weav-memory-retry/interruption-observation.json',
        'final/weav-memory-retry-v2/regressions/regression-summary.json',
        'weav-recovery-plan.json', 'weav-memory-recovery-plan.json',
        'weav-streamlog-recovery-plan.json', 'regression-recovery.json']]
    if optional_review_record is not None:
        inputs.append(optional_review)
    value = {
        'schema': 'logos-engine.lot3i.publication-inputs.v1', 'status': 'passed',
        'recordedAt': datetime.now(LOCAL).isoformat(), 'displayTimeZone': 'UTC-03:00',
        'generator': record(Path(__file__)), 'nativeVersion': '0.50.0', 'nativeDigest': NATIVE_DIGEST,
        'baselineSiteVersion': 78, 'baselineNativeVersion': '0.49.0', 'baselineCommit': BASELINE_COMMIT,
        'checkedInventories': counts, 'globalCostAccepted': cost['accepted'], 'globalCostStatus': cost['status'],
        'finalFormalTestCounts': test_counts, 'formalTestFiles': len(tests['testFiles']),
        'formalValidationDirectory': VALIDATION.relative_to(ROOT).as_posix(),
        'gameContributionStatus': scope['gameContributionStatus'],
        'integratedEvidenceKind': scope['integratedEvidenceKind'], 'integratedCheckGroups': loop['verifiedCheckGroups'],
        'syntheticCommonScope': loop['scope'], 'connResolutionStatus': conn_status,
        'connActual': conn['actual'], 'connCaseClock': clock, 'browserStatus': browser_status,
        'connSourceParity': conn['sourceComparison'], 'connComponentContribution': contribution,
        'migrationAuditResolution': record(audit_path), 'regressionRecovery': recovery_summary,
        'strictRegressionCases': regressions['passed'], 'strictRegressionChecks': regressions['comparisonChecksPassed'],
        'coordinatedIsolation': record(isolation_path),
        'publicationQualification': 'functional_evidence_verified_global_cost_accepted' if cost['accepted']
            else 'functional_evidence_verified_global_cost_reserve_retained',
        'optionalIndependentCostReview': optional_review_record,
        'inputs': [record(path) for path in inputs],
        'qualification': 'Final retained-input verification only; no producer is rerun. The actual 3225-test/76-file receipt, five checks and separate resolved migration audit are preserved. The two-cold-session/18-group synthetic proof has two own returned commands and zero live game actions. CONN actual contribution and its unchanged 1014.763812-second cumulative clock remain separate. All five strict recorded regressions must complete 85 checks; both WEAV failures and the incomplete third invocation remain retained, and only the fourth actual complete recovery can satisfy the strict gate. No exit status or memory cause is inferred for the third invocation. Cost rejection is accepted here only as an explicit qualified publication outcome; no threshold, phase or session is changed. Full inherited-caller parity and whole migration closure are not claimed.'
    }
    with output.open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': value['status'], 'checkedInventories': counts, 'formalTests': test_counts,
                      'globalCostAccepted': cost['accepted'], 'gameContributionStatus': scope['gameContributionStatus'],
                      'connResolutionStatus': conn_status, 'optionalIndependentCostReviewPresent': optional_review_record is not None}))


if __name__ == '__main__':
    main()
