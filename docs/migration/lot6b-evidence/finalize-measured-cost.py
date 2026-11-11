#!/usr/bin/env python3
"""Finalize one completed 6B cost window; never measure, retry or overwrite.

Usage: python -B docs/migration/lot6b-evidence/finalize-measured-cost.py PERF_DIR
       --baseline-manifest BASELINE_MANIFEST
       [--candidate-source-directory docs/migration/lot6b-evidence/integrated-final-02]

Exit 0: completed and global budget accepted; 2: completed and budget refused;
1: stopped on incomplete/pre-existing/inconsistent evidence or a command error.
The append-only execution journal and every actual command log remain retained.
Interfaces follow coordination/cost-command-sequence.md, sections 6 through 9.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback

SCRIPT = Path(__file__).resolve()
BASE = SCRIPT.parent
ROOT = BASE.parents[2]
ORDER = ['A1', 'B1', 'B2', 'A2']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def local(value):
    path = (ROOT / value).resolve()
    require(path.is_relative_to(ROOT), 'Evidence must stay in this checkout: ' + str(value))
    return path


def rel(path):
    return local(path).relative_to(ROOT).as_posix()


def now():
    return datetime.now(timezone.utc).isoformat()


def fp(path):
    path = local(path)
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return {'path': rel(path), 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key: ' + key)
        result[key] = value
    return result


def read(path):
    def nonfinite(value):
        raise ValueError('Non-finite JSON value: ' + value)
    return json.loads(local(path).read_bytes(), object_pairs_hook=unique_object, parse_constant=nonfinite)


def absent(paths):
    for path in paths:
        require(not path.exists() and not path.is_symlink(), 'Refusing existing output: ' + str(path))


def write_new(path, value):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('performance_directory', type=Path)
    parser.add_argument('--baseline-manifest', type=Path, required=True)
    parser.add_argument('--candidate-source-directory', type=Path, default=BASE / 'integrated-final-02')
    args = parser.parse_args()
    perf, candidate, baseline = map(local, (args.performance_directory, args.candidate_source_directory, args.baseline_manifest))
    require(perf.is_relative_to(BASE) and perf.is_dir(), 'Use a prepared 6B performance directory')
    window_path, declaration_path, contract_path = [perf / name for name in ('window.json', 'declaration.json', 'owner-growth-contract.json')]
    window, declaration, contract = map(read, (window_path, declaration_path, contract_path))
    require(window['schema'] == 'logos-engine.native-cost-window.v1'
            and window['status'] == window['finalIntegrity'] == 'passed', 'Cost window has not completed successfully')
    require(window['plannedOrder'] == ORDER and [row['label'] for row in window['executions']] == ORDER,
            'All four ABBA series are required in their declared order')
    require(datetime.fromisoformat(window['startedAt']) < datetime.fromisoformat(window['finishedAt'])
            <= datetime.now(timezone.utc), 'Invalid completed-window chronology')
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration['status'] == 'declared_before_official_window', 'Wrong protocol declaration')
    require(declaration['baseline']['nativeVersion'] == '0.63.0' and declaration['candidate']['nativeVersion'] == '0.64.0',
            '6B finalization requires its actually declared 0.63 predecessor and frozen 0.64 candidate')
    require(contract['schema'] == 'logos-engine.lot6b-owner-cost-contract.v2' and contract['lot'] == '6B'
            and contract['performanceDirectory'] == rel(perf) and contract['declaration'] == fp(declaration_path),
            'Wrong predeclared owner contract')
    for key, path in [('baselineManifest', baseline), ('candidateManifest', candidate / 'source-manifest.json'),
                      ('candidateArchiveManifest', candidate / 'source-archive.json')]:
        require(declaration[key] == fp(path), 'Explicit source manifest differs: ' + key)
    require(window['nativeDigests'] == {'baseline': declaration['nativeDigests']['baseline'],
                                      'correction': declaration['nativeDigests']['candidate']}, 'Window source identities differ')

    pair = ROOT / 'scripts/compare-native-loop-costs.mjs'
    strict = ROOT / 'scripts/compare-native-cost-cohorts.mjs'
    consolidate, review, transport, render = [BASE / name for name in
        ('consolidate-owner-costs.mjs', 'review-owner-costs.py', 'record-cost-log-transport.py', 'write-cost-results.py')]
    require(declaration['ownerCostQualification'] == {
        'schema': 'logos-engine.lot6b-owner-cost-qualification.v1', 'contractPath': rel(contract_path), 'tools': contract['tools']},
        'Owner tool declaration differs')
    require(contract['tools'] == {'consolidator': fp(consolidate), 'reviewer': fp(review)}, 'Qualified tools changed')
    for record in [*declaration['officialTools'], declaration['globalDecisionTool'], declaration['globalCalculationTool']]:
        require(fp(record['path']) == record, 'A central tool changed: ' + record['path'])
    historical, strict_receipt, strict_log = [local(contract[key]) for key in
        ('historicalAggregateOutput', 'strictFailureReceipt', 'strictFailureLog')]
    require([historical, strict_receipt, strict_log] == [perf / name for name in
        ('combined-comparison.json', 'aggregation-failure.json', 'aggregation-failure.log')], 'Unexpected strict output paths')
    unexpected = perf / 'aggregation-unexpected-success.json'
    aggregate, reviewed = perf / 'owner-growth-comparison.json', perf / 'owner-growth-review.json'
    journal_path, final_path = perf / 'finalize-measured-cost.jsonl', perf / 'finalize-measured-cost-execution.json'
    pair_outputs = [perf / f'cohort{i}/comparison.json' for i in (1, 2)]
    pair_logs = [path.with_suffix('.log') for path in pair_outputs]
    extra_logs = [perf / name for name in ('owner-growth-consolidation.log', 'owner-growth-review.log',
                                          'log-transport-generation.log', 'results-render.log')]
    raw, cost_logs = [], []
    for row, name in zip(window['executions'], ('cohort1/baseline', 'cohort1/after', 'cohort2/after', 'cohort2/baseline')):
        path, log = perf / (name + '.json'), local(row['log'])
        require(row['status'] == 'passed' and type(row['exitCode']) is int and row['exitCode'] == 0, 'Incomplete cost series')
        require(log == perf / (name + '.log') and fp(log)['sha256'] == row['logSha256'], 'Cost log changed')
        require(local(row.get('copiedOutput', row['output'])) == path and fp(path)['sha256'] == row['reportSha256'],
                'Raw report is not the completed window output')
        report = read(path)
        require(report['schema'] == 'logos-engine.native-loop-costs.v1' and report['status'] == 'passed'
                and report['nativeSourceUnchanged'] is True and report['nativeSource']['digest'] == row['nativeDigest'],
                'Raw report lacks successful frozen-source integrity')
        raw.append(path); cost_logs.append(log)
    compressed_logs = [path.with_name(path.name + '.gz') for path in cost_logs]
    outputs = [historical, strict_receipt, strict_log, unexpected, aggregate, reviewed, journal_path, final_path,
               *pair_outputs, *pair_logs, *extra_logs, *compressed_logs,
               perf / 'log-transport.json', perf / 'results.md', perf / 'results-render.json']
    require(len(outputs) == len(set(outputs)), 'Output paths overlap')
    absent(outputs)
    base_inputs = [SCRIPT, window_path, declaration_path, contract_path, baseline,
                   candidate / 'source-manifest.json', candidate / 'source-archive.json', pair, strict,
                   consolidate, review, transport, render, *raw, *cost_logs]
    base_inputs += [perf / name for name in ('comparison-policy.json', 'global-budget-policy.json', 'cases.json',
                                           'readiness.json', 'static-preflight.json', 'preparation.json', 'protocol-check.json')]
    watched = {rel(path): fp(path) for path in base_inputs}
    outcome = {'schema': 'logos-engine.lot6b-measured-cost-finalization.v1', 'startedAt': now(),
               'generator': fp(SCRIPT), 'window': fp(window_path), 'status': 'running', 'accepted': None,
               'commands': [], 'measurementExecuted': False, 'retryPerformed': False, 'measuredSamplesExcluded': 0}
    exit_code = 1
    with journal_path.open('x', encoding='utf-8') as journal:
        def emit(value):
            journal.write(json.dumps(value, ensure_ascii=False, allow_nan=False) + '\n')
            journal.flush(); os.fsync(journal.fileno())

        def intact():
            return all(fp(path) == record for path, record in watched.items())

        def run(command, log, inputs, expected_outputs, allow_nonzero=False):
            absent([log, *expected_outputs]); require(intact(), 'Previously bound evidence changed')
            before = [fp(path) for path in inputs]
            record = {'command': command, 'startedAt': now(), 'inputs': before, 'exitCode': None}
            emit({'event': 'command_started', **record, 'logPath': rel(log)})
            print(json.dumps({'event': 'command_started', 'command': command}), flush=True)
            started = time.monotonic()
            try:
                with log.open('xb') as stream:
                    try:
                        completed = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
                        record['exitCode'] = completed.returncode
                    except BaseException:
                        stream.write(traceback.format_exc().encode()); raise
            except BaseException as error:
                record['error'] = type(error).__name__ + ': ' + str(error)
            try:
                unchanged = before == [fp(path) for path in inputs] and intact()
            except Exception as error:
                unchanged = False
                record['integrityError'] = type(error).__name__ + ': ' + str(error)
            record.update(finishedAt=now(), elapsedSeconds=time.monotonic() - started,
                          inputsUnchanged=unchanged, log=None, outputs=[])
            try:
                record['log'] = fp(log)
                record['outputs'] = [fp(path) for path in expected_outputs if path.is_file()]
            except Exception as error:
                record['captureError'] = type(error).__name__ + ': ' + str(error)
            outcome['commands'].append(record); emit({'event': 'command_finished', **record})
            for item in [record['log'], *record['outputs']]:
                if item is not None: watched[item['path']] = item
            print(json.dumps({'event': 'command_finished', 'exitCode': record['exitCode'], 'log': rel(log)}), flush=True)
            require('error' not in record, 'Command did not complete: ' + str(record.get('error')))
            require(record['log'] is not None, 'Command log cannot be fingerprinted; journal retained')
            require(allow_nonzero or record['exitCode'] == 0, 'Command failed; actual log retained: ' + rel(log))
            if not allow_nonzero:
                require('captureError' not in record, 'Command output cannot be fingerprinted; journal retained')
                require(record['inputsUnchanged'], 'Command inputs changed')
                require(all(path.is_file() for path in expected_outputs), 'Command omitted a required output')
            return record

        emit({'event': 'finalization_started', **outcome, 'inputs': list(watched.values())})
        try:
            policy = perf / 'comparison-policy.json'
            for index in (1, 2):
                inputs = [pair, policy, perf / f'cohort{index}/baseline.json', perf / f'cohort{index}/after.json']
                run(['node', *map(rel, inputs), rel(pair_outputs[index - 1])], pair_logs[index - 1], inputs, [pair_outputs[index - 1]])
                value = read(pair_outputs[index - 1])
                require(value['schema'] == 'logos-engine.native-loop-cost-comparison.v1'
                        and value['status'] in ('passed', 'budget_review_required'), 'Pair comparison is incomplete')

            strict_inputs = [strict, policy, *[perf / f'cohort{i}/{name}.json'
                             for i in (1, 2) for name in ('baseline', 'after', 'comparison')]]
            actual = run(['node', *map(rel, strict_inputs), rel(historical)], strict_log, strict_inputs, [historical], True)
            retained = {key: actual[key] for key in ('command', 'startedAt', 'finishedAt', 'exitCode', 'inputs', 'inputsUnchanged', 'log')}
            retained.update(schema='logos-engine.retained-tool-failure.v1' if actual['exitCode'] != 0
                            else 'logos-engine.retained-tool-execution.v1', outputExists=historical.exists())
            destination = strict_receipt if actual['exitCode'] != 0 else unexpected
            write_new(destination, retained); watched[rel(destination)] = fp(destination)
            outcome['strictExecution'] = fp(destination)
            require(actual['exitCode'] != 0 and actual['inputsUnchanged'] and not historical.exists()
                    and 'Within-cohort work metadata changed' in strict_log.read_text(errors='replace'),
                    'Actual strict result is outside the predeclared structural-refusal branch')

            run(['node', rel(consolidate), rel(contract_path), rel(aggregate)], extra_logs[0],
                [consolidate, contract_path, strict_receipt, strict_log, *strict_inputs[1:]], [aggregate])
            run([sys.executable, '-B', rel(review), rel(contract_path), rel(aggregate), rel(reviewed)], extra_logs[1],
                [review, contract_path, aggregate], [reviewed])
            value, combined = read(reviewed), read(aggregate)
            require(value['schema'] == 'logos-engine.lot6b-owner-cost-review.v2'
                    and value['status'] == 'qualified_owner_cost_review_passed'
                    and type(value['globalAccepted']) is bool and value['accepted'] is value['globalAccepted']
                    and combined['globalAccepted'] is value['globalAccepted'], 'Independent review and aggregate disagree')
            outcome.update(accepted=value['globalAccepted'], globalStatus=value['globalStatus'], review=fp(reviewed))
            run([sys.executable, '-B', rel(transport), rel(perf)], extra_logs[2],
                [transport, window_path, *cost_logs], [*compressed_logs, perf / 'log-transport.json'])
            run([sys.executable, '-B', rel(render), '--output-directory', rel(perf),
                 '--candidate-source-directory', rel(candidate), '--baseline-manifest', rel(baseline)], extra_logs[3],
                [render, declaration_path, aggregate, reviewed, perf / 'log-transport.json'],
                [perf / 'results.md', perf / 'results-render.json'])
            require(intact(), 'Evidence changed before finalization completed')
            outcome['status'] = 'completed_global_budget_accepted' if outcome['accepted'] else 'completed_global_budget_refused'
            exit_code = 0 if outcome['accepted'] else 2
        except BaseException as error:
            outcome.update(status='stopped_without_retry', error=type(error).__name__ + ': ' + str(error))
        outcome.update(finishedAt=now(), exitCode=exit_code)
        emit({'event': 'finalization_finished', 'status': outcome['status'], 'accepted': outcome['accepted'],
              'exitCode': exit_code, 'error': outcome.get('error')})
    outcome['journal'] = fp(journal_path)
    write_new(final_path, outcome)
    print(json.dumps({'status': outcome['status'], 'accepted': outcome['accepted'], 'exitCode': exit_code,
                      'receipt': fp(final_path)}), flush=True)
    return exit_code


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'status': 'refused_before_finalization', 'error': type(error).__name__ + ': ' + str(error),
                          'measurementExecuted': False, 'retryPerformed': False}), file=sys.stderr)
        raise SystemExit(1)
