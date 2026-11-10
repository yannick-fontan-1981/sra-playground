#!/usr/bin/env python3
"""Keep the interrupted attempt and consolidate five strict completed replays.

No replay, comparator, test or benchmark is run here. The only repeated case
must be the externally terminated WEAV process; all 17 checks remain required.
"""
from datetime import datetime, timedelta, timezone
import copy
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
def read(p): return json.loads(p.read_text())
def sha(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()
def fp(p): return {'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}
def write(p, value):
    with p.open('x') as f: f.write(json.dumps(value, indent=2) + '\n')
def checkfp(row): assert fp(ROOT / row['path']) == row, row['path']

def main():
    first_path = BASE / 'final/regressions/regression-summary-interrupted.json'
    current = BASE / 'final/regressions/regression-summary.json'
    second_path = BASE / 'final/weav-retry/regressions/regression-summary.json'
    incomplete_path = BASE / 'final/weav-memory-retry/interruption-observation.json'
    retry_path = BASE / 'final/weav-memory-retry-v2/regressions/regression-summary.json'
    assert current.read_bytes() == first_path.read_bytes(), 'Current summary must still equal the retained initial attempt'
    first, second, retry = read(first_path), read(second_path), read(retry_path)
    interrupted_invocation = read(incomplete_path)
    assert interrupted_invocation['status'] == 'incomplete_process_handle_unavailable'
    assert interrupted_invocation['finalSummaryPresent'] is False
    assert interrupted_invocation['finalReplayReportPresent'] is False
    checkfp(interrupted_invocation['completedHostPreparation'])
    checkfp(interrupted_invocation['completedPreflight'])
    frozen = read(BASE / 'final/source-manifest.json')
    assert first['status'] == 'failed' and first['passed'] == 4 and first['total'] == 5
    assert first['comparisonChecksPassed'] == 68 and first['comparisonChecksExpected'] == 85
    incomplete = [row for row in first['results'] if not row['passed']]
    assert len(incomplete) == 1 and incomplete[0]['game'] == 'WEAV'
    assert incomplete[0]['exitCode'] == -9 and incomplete[0]['timedOut'] is False
    assert second['status'] == 'failed' and second['passed'] == 0 and second['total'] == 1
    assert second['comparisonChecksPassed'] == 0 and second['comparisonChecksExpected'] == 17
    assert second['results'][0]['game'] == 'WEAV'
    assert second['results'][0]['exitCode'] == -6 and second['results'][0]['timedOut'] is False
    assert retry['status'] == 'passed' and retry['passed'] == retry['total'] == 1
    assert retry['comparisonChecksPassed'] == retry['comparisonChecksExpected'] == 17
    assert retry['results'][0]['game'] == 'WEAV'
    assert incomplete[0]['baseline'] == retry['results'][0]['baseline']
    assert incomplete[0]['trace'] == retry['results'][0]['trace']
    assert second['results'][0]['baseline'] == incomplete[0]['baseline']
    assert second['results'][0]['trace'] == incomplete[0]['trace']
    inputs = {}
    for value in [first, second, retry]:
        assert value['nativeSource'] == value['nativeSourceAfter'] == frozen
        assert value['executionInputsUnchanged'] and value['executionInputs'] == value['executionInputsAfter']
        for name, digest in value['executionInputs'].items():
            assert sha(ROOT / name) == digest
            assert name not in inputs or inputs[name] == digest
            inputs[name] = digest
    rows = [copy.deepcopy(row) for row in first['results'] if row['passed']] + copy.deepcopy(retry['results'])
    assert [row['game'] for row in rows] == ['CATR', 'RSWP', 'FOGW', 'VOIS', 'WEAV']
    for row in rows:
        assert row['passed'] and row['exitCode'] == 0 and not row['timedOut']
        assert row['comparisonPassed'] and row['comparisonChecks'] == 17 and row['failedChecks'] == []
        for key in ['report', 'comparison', 'output', 'baseline', 'trace', 'passiveOwnerPresence']: checkfp(row[key])
        comparison = read(ROOT / row['comparison']['path'])
        assert comparison['passed'] and len(comparison['checks']) == 17 and all(check['passed'] for check in comparison['checks'])
    assert sum(row['actions'] for row in rows) == first['prevalidatedTotals']['commands'] == 240
    assert sum(row['prefixes'] for row in rows) == first['prevalidatedTotals']['prefixes'] == 169
    manifest = read(BASE / 'recorded-regression-cases.json')
    manifest['cases'][-1]['id'] = retry['results'][0]['case']
    manifest['qualification'] += ' Consolidated execution identity names the memory-efficient WEAV replay host; baseline and public trace bytes are identical to the original declaration.'
    manifest_path = BASE / 'recorded-regression-cases-final.json'; write(manifest_path, manifest)
    for p in [first_path, second_path, incomplete_path, retry_path, manifest_path, BASE / 'weav-recovery-plan.json',
              BASE / 'weav-memory-recovery-plan.json', BASE / 'weav-streamlog-recovery-plan.json',
              Path(__file__).resolve()]:
        inputs[p.relative_to(ROOT).as_posix()] = sha(p)
    inputs = dict(sorted(inputs.items()))
    combined = copy.deepcopy(first)
    combined.update(status='passed', caseManifest=fp(manifest_path), results=rows, passed=5, total=5,
        comparisonChecksPassed=85, comparisonChecksExpected=85,
        executionInputs=inputs, executionInputsAfter=copy.deepcopy(inputs), executionInputsUnchanged=True,
        generator=fp(Path(__file__).resolve()), recordedAt=datetime.now(timezone(timedelta(hours=-3))).isoformat())
    for key in ['passiveOwnerPrefixesChecked', 'passiveOwnerPrefixesPassed', 'passiveOwnerTransitionsRetained']:
        combined[key] = sum(row.get(key, 0) for row in rows)
    combined['recovery'] = {'initialSummary': fp(first_path), 'memoryCappedSummary': fp(second_path),
        'incompleteAttempt': fp(incomplete_path), 'isolatedSummary': fp(retry_path),
        'plan': fp(BASE / 'weav-streamlog-recovery-plan.json'),
        'earlierMemoryPlan': fp(BASE / 'weav-memory-recovery-plan.json'),
        'earlierPlan': fp(BASE / 'weav-recovery-plan.json'),
        'reusedCompletedCases': ['CATR', 'RSWP', 'FOGW', 'VOIS'],
        'repeatedCase': 'WEAV', 'retainedInterruptedExecution': copy.deepcopy(incomplete[0]),
        'retainedMemoryCappedExecution': copy.deepcopy(second['results'][0]),
        'productionSourceChanged': False, 'comparatorOrTraceChanged': False, 'checksRemoved': 0,
        'qualification': 'The first four completed passes are reused verbatim. WEAV retains the signal 9 interruption at 67 actions (cause unproven), the separate 768 MiB V8 heap exhaustion, and the later invocation whose execution handle disappeared without a retained final exit status or report. No cause is assigned to that incomplete invocation. The final host releases the full historical baseline before running the unchanged campaign harness and reloads it for the unchanged 17-check comparator only after the native process ends. Its raw log and heartbeat are persisted while it runs. All 17 original checks pass on the full 81-action replay. No trace, expected command, comparison tolerance, native source or test changed. No game clock restarts and the official timing runner/environment does not use this replay host.'}
    combined['qualification'] += ' This final summary consolidates the retained initial four strict passes and the isolated complete WEAV strict pass; see recovery for the unmodified initial failure and actual process configuration.'
    accepted = current.with_name('regression-summary-recovered.json'); write(accepted, combined)
    # The current summary is a pointer to the completed consolidated result.
    # The producer's entire initial bytes remain in the distinct archive above.
    assert current.read_bytes() == first_path.read_bytes()
    current.write_bytes(accepted.read_bytes())
    write(BASE / 'regression-recovery.json', {'schema': 'logos-engine.recorded-regression-recovery.v1',
        'status': 'passed', 'recordedAt': combined['recordedAt'], 'generator': fp(Path(__file__).resolve()),
        'initialSummary': fp(first_path), 'memoryCappedSummary': fp(second_path),
        'incompleteAttempt': fp(incomplete_path), 'isolatedSummary': fp(retry_path), 'finalSummary': fp(current),
        'firstPasses': 4, 'firstInterrupted': 1, 'memoryCappedFailures': 1, 'isolatedPasses': 1,
        'incompleteInvocationWithoutFinalExitStatus': 1,
        'finalCasesPassed': 5, 'finalCasesExpected': 5,
        'finalChecksPassed': 85, 'finalChecksExpected': 85, 'nativeSourceDigest': frozen['digest'],
        'qualification': combined['recovery']['qualification']})
    print(json.dumps({'status': 'passed', 'cases': '5/5', 'checks': '85/85', 'retainedInterruptedAttempt': fp(first_path)}))

if __name__ == '__main__': main()
