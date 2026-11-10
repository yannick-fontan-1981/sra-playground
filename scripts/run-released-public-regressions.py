#!/usr/bin/env python3
"""Sequential recorded replay with no full historical report alive beside Node.

The existing prevalidator runs in a child that exits before Node starts. The
unchanged 17-check comparator runs in another child only after Node has exited.
Production source, the complete harness, original inputs and comparisons stay
unchanged. The new Node host verifies historical-root collection before import.
"""
from __future__ import annotations

import argparse
import gzip
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
HISTORICAL = ROOT / 'scripts/run-recorded-public-regressions.py'
SPEC = importlib.util.spec_from_file_location('retained_regression_runner', HISTORICAL)
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)
PROOF, READ, WRITE, UTC = RUNNER.PROOF, RUNNER.READ, RUNNER.WRITE, RUNNER.UTC
COMPARATOR, COMPARATOR_PATH = RUNNER.COMPARATOR, RUNNER.COMPARATOR_PATH
REPLAY = 'scripts/replay-public-regression-released-baseline.mjs'
QUALIFICATION = RUNNER.QUALIFICATION + (
    ' This recovery changes only replay-host lifetimes: full historical reports '
    'are released before the unchanged native harness starts. Prevalidation and '
    'the unchanged 17-check comparison execute in separate, non-overlapping '
    'processes. All new replay evidence is retained in full. The explicit Node '
    'heap cap applies only to this recorded regression, never to official costs.'
)


def prevalidate_child(manifest_path):
    cases, totals, requirements = RUNNER.prepare(manifest_path)
    return {'schema': 'logos-engine.released-baseline-replay-preflight.v1', 'status': 'passed',
            'caseManifest': PROOF.evidence(manifest_path),
            'cases': [{**item, 'baseline': item['baseline'].relative_to(ROOT).as_posix(),
                       'trace': item['trace'].relative_to(ROOT).as_posix()} for item in cases],
            'totals': totals, 'passiveOwnerRequirements': requirements,
            'prevalidator': PROOF.evidence(HISTORICAL), 'replaysExecuted': 0}


def compare_child(data):
    baseline, trace_path, report_path, frozen_path, manifest_path, comparison_path, presence_path = [
        RUNNER.local_path(data[key]) for key in ['baseline', 'trace', 'report', 'sourceManifest',
                                               'caseManifest', 'comparison', 'presence']]
    # These are the original complete reports, loaded only after Node exits.
    before, actual, trace, frozen = READ(baseline), READ(report_path), READ(trace_path), READ(frozen_path)
    presence = RUNNER.passive_owner_presence(actual, data['requirements'], report_path, manifest_path)
    WRITE(presence_path, presence)
    comparison = COMPARATOR.compare(before, actual, trace, frozen, baseline, report_path, trace_path)
    comparison['legacyComparatorMetadata'] = {
        'implementation': PROOF.evidence(COMPARATOR_PATH), 'schema': comparison['schema'],
        'qualification': comparison['qualification'], 'checkLabelsPreserved': True}
    comparison['schema'] = 'logos-engine.scoped-public-regression-comparison.v1'
    comparison['qualification'] = QUALIFICATION
    if len(comparison['checks']) != 17:
        raise ValueError('The retained comparator check count changed')
    WRITE(comparison_path, comparison)
    return {'report': PROOF.evidence(report_path), 'status': actual['status'],
            'actions': len(actual['actions']), 'prefixes': len(actual['prefixes']), 'final': actual['final'],
            'passiveOwnerPresence': PROOF.evidence(presence_path),
            'passiveOwnerPresencePassed': presence['passed'],
            'passiveOwnerPrefixesChecked': sum(owner['prefixesChecked'] for owner in presence['owners']),
            'passiveOwnerPrefixesPassed': sum(owner['prefixesPassed'] for owner in presence['owners']),
            'passiveOwnerTransitionsRetained': sum(owner['transitionsRetained'] for owner in presence['owners']),
            'comparison': PROOF.evidence(comparison_path), 'comparisonPassed': comparison['passed'],
            'comparisonChecks': len(comparison['checks']),
            'failedChecks': [check['name'] for check in comparison['checks'] if not check['passed']]}


def child(mode, value, timeout=2400):
    completed = subprocess.run([sys.executable, str(Path(__file__).resolve()), mode, value],
                               cwd=ROOT, capture_output=True, text=True, timeout=timeout)
    if completed.returncode != 0:
        raise RuntimeError(f'{mode} failed ({completed.returncode}): {completed.stderr[-8000:]}')
    return json.loads(completed.stdout)


def execution_inputs(manifest_path, source_manifest_path):
    paths = [Path(__file__), HISTORICAL, COMPARATOR_PATH, ROOT / REPLAY,
             ROOT / 'scripts/replay-v53-public-regression.mjs', ROOT / 'scripts/run-v53-campaign-proof.py',
             ROOT / 'tests/helpers/v6-live-game-campaign.ts', manifest_path, source_manifest_path]
    return {path.relative_to(ROOT).as_posix(): PROOF.sha(path) for path in paths}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest')
    parser.add_argument('directory')
    parser.add_argument('--source-manifest', required=True)
    parser.add_argument('--node-old-space-mib', type=int, choices=[768, 1024, 1536], default=1536)
    parser.add_argument('--timeout-seconds', type=int, default=2400)
    args = parser.parse_args()
    if not 1 <= args.timeout_seconds <= 2400:
        parser.error('Replay timeout must be between 1 and 2400 seconds')
    manifest_path = RUNNER.local_path(args.manifest)
    base, source_manifest_path = RUNNER.local_path(args.directory), RUNNER.local_path(args.source_manifest)
    out, summary_path = base / 'regressions', base / 'regressions/regression-summary.json'
    preflight_path = base / 'preflight.json'
    for path in [summary_path, preflight_path]:
        if path.exists():
            raise FileExistsError(path)
    frozen = READ(source_manifest_path)
    if PROOF.native_source() != frozen:
        raise ValueError('Current native source differs from the declared freeze')
    inputs_before, memory_before = execution_inputs(manifest_path, source_manifest_path), COMPARATOR.memory()
    preflight = child('--prepare-manifest', args.manifest)
    # The process owning all historical decoded reports has now exited.
    preflight['prevalidationProcessExitedBeforeAnyReplay'] = True
    preflight['nativeSourceDigest'] = frozen['digest']
    out.mkdir(parents=True, exist_ok=True)
    WRITE(preflight_path, preflight)
    requirements, results = preflight['passiveOwnerRequirements'], []
    for item in preflight['cases']:
        name, game = item['id'], item['game']
        baseline, trace_path = RUNNER.local_path(item['baseline']), RUNNER.local_path(item['trace'])
        paths = {key: out / f'{name}-{suffix}' for key, suffix in {
            'report': 'replay.json.gz', 'comparison': 'comparison.json', 'presence': 'passive-owner-presence.json',
            'log': 'output.log.gz', 'execution': 'execution.json', 'preparation': 'host-preparation.json'}.items()}
        for path in paths.values():
            if path.exists():
                raise FileExistsError(path)
        immutable = {'baseline': PROOF.evidence(baseline), 'trace': PROOF.evidence(trace_path)}
        source_before = PROOF.native_source()
        if source_before != frozen:
            raise ValueError('Native source changed before replay: ' + name)
        command = ['node', '--expose-gc', f'--max-old-space-size={args.node_old_space_mib}', REPLAY,
                   item['baseline'], item['trace'], paths['report'].relative_to(ROOT).as_posix(),
                   paths['preparation'].relative_to(ROOT).as_posix()]
        started, clock, timed_out = UTC(), time.monotonic(), False
        print(json.dumps({'case': name, 'game': game, 'phase': 'started', 'expectedActions': item['counts']['commands'],
                          'maximumConcurrentReplays': 1, 'historicalReportProcessExited': True,
                          'nodeOldSpaceMiB': args.node_old_space_mib}), flush=True)
        with tempfile.TemporaryFile() as output:
            try:
                completed = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT,
                                           timeout=args.timeout_seconds)
                exit_code = completed.returncode
            except subprocess.TimeoutExpired:
                timed_out, exit_code = True, 124
            output.seek(0)
            with paths['log'].open('xb') as destination:
                with gzip.GzipFile(filename='', mode='wb', fileobj=destination, mtime=0) as compressed:
                    for chunk in iter(lambda: output.read(1024 * 1024), b''):
                        compressed.write(chunk)
        row = {'case': name, 'game': game, 'mode': 'recorded-public-replay', 'command': command,
               'startedAt': started, 'finishedAt': UTC(), 'elapsedSeconds': time.monotonic() - clock,
               'exitCode': exit_code, 'timeoutSeconds': args.timeout_seconds, 'timedOut': timed_out,
               **immutable, 'output': PROOF.evidence(paths['log']), 'passed': False,
               'nodeOldSpaceMiB': args.node_old_space_mib, 'preflight': PROOF.evidence(preflight_path),
               'historicalReportProcessExitedBeforeNode': True, 'nodeExitedBeforeComparison': True}
        if paths['preparation'].exists():
            preparation = READ(paths['preparation'])
            row['hostPreparation'] = PROOF.evidence(paths['preparation'])
            row['hostPreparationPassed'] = (preparation['status'] == 'passed'
                and preparation['baselineRootCollectedBeforeHarnessImport'] is True
                and preparation['expectedActions'] == item['counts']['commands']
                and preparation['completePublicPackets'] == item['counts']['completePublicPackets']
                and preparation['baseline'] == immutable['baseline'] and preparation['trace'] == immutable['trace'])
        if paths['report'].exists():
            data = {'baseline': item['baseline'], 'trace': item['trace'], 'sourceManifest': args.source_manifest,
                    'caseManifest': args.manifest, 'requirements': requirements,
                    **{key: paths[key].relative_to(ROOT).as_posix() for key in ['report', 'comparison', 'presence']}}
            try:
                row.update(child('--compare-case', json.dumps(data), args.timeout_seconds))
                row['passed'] = (exit_code == 0 and row['comparisonPassed'] and row['passiveOwnerPresencePassed']
                                 and row.get('hostPreparationPassed', False))
            except Exception as error:
                row['comparisonError'] = f'{type(error).__name__}: {error}'
        source_after = PROOF.native_source()
        row['nativeSourceBeforeDigest'], row['nativeSourceAfterDigest'] = source_before['digest'], source_after['digest']
        row['nativeSourceUnchanged'] = source_before == source_after == frozen
        row['immutableInputsUnchanged'] = immutable == {'baseline': PROOF.evidence(baseline), 'trace': PROOF.evidence(trace_path)}
        row['passed'] = row['passed'] and row['nativeSourceUnchanged'] and row['immutableInputsUnchanged']
        WRITE(paths['execution'], row); row['execution'] = PROOF.evidence(paths['execution']); results.append(row)
        print(json.dumps({'case': name, 'phase': 'completed', 'passed': row['passed'], 'actions': row.get('actions'),
                          'levelsCompleted': row.get('final', {}).get('levelsCompleted'),
                          'comparisonChecks': row.get('comparisonChecks'), 'failedChecks': row.get('failedChecks')}), flush=True)
    source_after, inputs_after = PROOF.native_source(), execution_inputs(manifest_path, source_manifest_path)
    unchanged = source_after == frozen and inputs_after == inputs_before
    passed = unchanged and all(row['passed'] for row in results)
    value = {'schema': 'logos-engine.recorded-public-regressions.v1', 'status': 'passed' if passed else 'failed',
             'caseManifest': PROOF.evidence(manifest_path), 'nativeSource': frozen, 'nativeSourceAfter': source_after,
             'executionInputs': inputs_before, 'executionInputsAfter': inputs_after, 'executionInputsUnchanged': unchanged,
             'maximumConcurrentReplays': 1, 'nodeOldSpaceMiB': args.node_old_space_mib,
             'memoryBefore': memory_before, 'memoryAfter': COMPARATOR.memory(), 'preflight': PROOF.evidence(preflight_path),
             'prevalidatedTotals': preflight['totals'], 'results': results,
             'passed': sum(row['passed'] for row in results), 'total': len(results),
             'comparisonChecksPassed': sum(row.get('comparisonChecks', 0) - len(row.get('failedChecks', []))
                                           for row in results if 'comparisonChecks' in row),
             'comparisonChecksExpected': 17 * len(results), 'passiveOwnerRequirements': requirements,
             'passiveOwnerPrefixesChecked': sum(row.get('passiveOwnerPrefixesChecked', 0) for row in results),
             'passiveOwnerPrefixesPassed': sum(row.get('passiveOwnerPrefixesPassed', 0) for row in results),
             'passiveOwnerTransitionsRetained': sum(row.get('passiveOwnerTransitionsRetained', 0) for row in results),
             'qualification': QUALIFICATION}
    WRITE(summary_path, value)
    print(json.dumps({'status': value['status'], 'passed': value['passed'], 'total': value['total'],
                      'comparisonChecksPassed': value['comparisonChecksPassed']}), flush=True)
    if not passed:
        raise SystemExit(1)


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--prepare-manifest':
        print(json.dumps(prevalidate_child(RUNNER.local_path(sys.argv[2]))))
    elif len(sys.argv) == 3 and sys.argv[1] == '--compare-case':
        print(json.dumps(compare_child(json.loads(sys.argv[2]))))
    else:
        main()
