#!/usr/bin/env python3
"""Record bounded v47 regression evidence, separating public replay from live games."""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'docs/migration/native-campaigns-v47'
PLAN = OUTPUT / 'regression-plan.json'
VERIFICATION = OUTPUT / 'regression-verification.json'
SUMMARY = OUTPUT / 'regression-summary.json'
SOURCE = OUTPUT / 'source-manifest.json'
HARNESS = [
    'scripts/run-v47-regression-checks.py',
    'scripts/replay-v47-public-regression.mjs',
    'scripts/compare-v47-regressions.mjs',
    'scripts/run-v47-campaign-proof.py',
    'scripts/run-v44-campaign.mjs',
    'tests/helpers/v6-live-game-campaign.ts',
]
CASES = [
    ('STCK', 'three', 'v39/stck-public-trace.json.gz'),
    ('CATL', 'six', 'v45/catl-public-trace.json.gz'),
    ('LF52', 'three', 'v45/lf52-public-trace.json.gz'),
    ('TICT', 'six', 'v46/tict-public-trace.json.gz'),
]
QUALIFICATION = (
    'Four cold native common-caller replays recalculate commands before consuming '
    'complete public returns from prior actual campaigns. These bounded affected-layer '
    'regressions cover learned programs, labeled predicates, reduction coordination '
    'and cell placement. They are not new live game successes or speed comparisons. '
    'The source manifest, commands, complete packets, source selections, retained '
    'projections and guards remain explicit. The separate current SELE and ZIPP '
    'campaigns use the opaque game host. No Python agent modules are authorized.'
)


def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def relative(path):
    return Path(path).relative_to(ROOT).as_posix()


def evidence(path):
    path = Path(path)
    return {'path': relative(path), 'sha256': sha(path), 'bytes': path.stat().st_size}


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value, *, fresh=False):
    path = Path(path)
    if fresh and path.exists():
        raise FileExistsError(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')


def native_source():
    files = {p.relative_to(ROOT).as_posix(): sha(p)
             for folder in ['src/logos-engine', 'src/runtime']
             for p in sorted((ROOT / folder).rglob('*'))
             if p.is_file() and p.suffix in ['.ts', '.json', '.drm']}
    files = dict(sorted(files.items()))
    digest = hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest()
    return {'fileCount': len(files), 'digest': digest, 'files': files}


def harness_files():
    return {path: sha(ROOT / path) for path in HARNESS}


def assert_frozen():
    current = native_source()
    if current != read(SOURCE):
        raise AssertionError('Native source differs from the declared v47 freeze')
    return current


def prepare():
    frozen = assert_frozen()
    runs = []
    for game, word, trace_name in CASES:
        lower = game.lower()
        baseline_version = 'v46' if game == 'TICT' else 'v45'
        baseline_path = ROOT / f'docs/migration/native-campaigns-{baseline_version}/{lower}-{word}-levels.json'
        baseline = read(baseline_path)
        if baseline['status'] != 'passed' or baseline['game'] != game:
            raise AssertionError(f'Invalid actual baseline for {game}')
        mode = 'recorded-public-replay' if trace_name else 'actual-game-campaign'
        report = OUTPUT / (f'{lower}-recorded-public-replay.json' if trace_name else f'{lower}-{word}-levels.json')
        comparison = OUTPUT / f'{lower}-regression-comparison.json'
        run = {'game': game, 'mode': mode, 'targetLevels': baseline['targetLevels'], 'baseline': evidence(baseline_path),
               'expectedCommands': len(baseline['actions']), 'expectedCompletePublicPackets': len(baseline['actions']) + 1,
               'expectedPrefixes': len(baseline['prefixes']), 'report': relative(report), 'comparison': relative(comparison),
               'executionReceipt': relative(OUTPUT / f'logs/regression-{lower}-receipt.json')}
        if trace_name:
            trace_path = ROOT / f'docs/migration/native-campaigns-{trace_name}'
            run['recordedTrace'] = evidence(trace_path)
            run['command'] = ['node', 'scripts/replay-v47-public-regression.mjs', relative(baseline_path), relative(trace_path), relative(report)]
        else:
            trace = OUTPUT / f'{lower}-public-trace.json.gz'
            inner_receipt = OUTPUT / f'logs/execution-{lower}.json'
            inner_log = OUTPUT / f'logs/{lower}-output.log.gz'
            run['actualTrace'] = relative(trace)
            run['actualExecutionReceipt'] = relative(inner_receipt)
            run['actualOutput'] = relative(inner_log)
            run['command'] = ['python', 'scripts/run-v47-campaign-proof.py', game, str(baseline['targetLevels']),
                              relative(report), relative(trace), relative(inner_receipt), relative(inner_log)]
        run['comparisonCommand'] = ['node', 'scripts/compare-v47-regressions.mjs', relative(baseline_path), relative(report), relative(comparison)]
        runs.append(run)
    plan = {'schema': 'logos-engine.v47.regression-plan.v1', 'status': 'prepared', 'preparedAt': utc(),
            'maxConcurrentRuns': 2, 'qualification': QUALIFICATION, 'nativeSourceManifest': evidence(SOURCE),
            'nativeSourceManifestDigest': frozen['digest'], 'nativeSourceFiles': frozen['fileCount'],
            'harnessFileSha256': harness_files(), 'runs': runs}
    write(PLAN, plan, fresh=True)
    print(json.dumps({'prepared': relative(PLAN), 'replays': 4, 'actualCampaigns': 0,
                      'sourceDigest': frozen['digest'], 'maxConcurrentRuns': 2}), flush=True)


def execute(command, name, inputs):
    before = assert_frozen()
    harness_before = harness_files()
    live = ROOT.parent / f'v47-regression-{name}-live.log'
    log = OUTPUT / f'logs/regression-{name}-output.log.gz'
    if live.exists() or log.exists():
        raise FileExistsError(f'Existing execution output for {name}')
    log.parent.mkdir(parents=True, exist_ok=True)
    started = utc()
    clock = time.monotonic()
    with live.open('xb') as stream:
        completed = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
    finished = utc()
    log.write_bytes(gzip.compress(live.read_bytes(), mtime=0))
    after = native_source()
    harness_after = harness_files()
    return {'command': command, 'startedAt': started, 'finishedAt': finished,
            'elapsedSeconds': time.monotonic() - clock, 'exitCode': completed.returncode,
            'generator': evidence(Path(__file__)), 'harnessFileSha256': harness_before,
            'harnessFileSha256After': harness_after, 'harnessFilesUnchanged': harness_before == harness_after,
            'nativeSource': before, 'nativeSourceAfter': after, 'nativeSourceUnchanged': before == after,
            'inputs': inputs, 'output': evidence(log)}


def compare(run, label=None):
    lower = run['game'].lower()
    output = ROOT / run['comparison'] if label is None else OUTPUT / f'{lower}-regression-comparison-{label}.json'
    if output.exists():
        raise FileExistsError(output)
    command = [*run['comparisonCommand'][:-1], relative(output)]
    receipt = execute(command, f'comparison-{lower}' + (f'-{label}' if label else ''),
                      {'baseline': run['baseline'], 'current': evidence(ROOT / run['report'])})
    value = read(output) if output.exists() else None
    receipt.update({'result': evidence(output) if output.exists() else None,
                    'passed': bool(value and value['passed'] and receipt['exitCode'] == 0
                                   and receipt['nativeSourceUnchanged'] and receipt['harnessFilesUnchanged']),
                    'checks': len(value['checks']) if value else 0,
                    'failedChecks': [item['name'] for item in value['checks'] if not item['passed']] if value else ['comparison did not produce evidence'],
                    'compared': value['compared'] if value else None})
    receipt_path = OUTPUT / (f'logs/comparison-{lower}-receipt.json' if label is None else f'logs/comparison-{lower}-{label}-receipt.json')
    write(receipt_path, receipt, fresh=True)
    return {'receipt': evidence(receipt_path), **receipt}


def one(run):
    inputs = {'baseline': run['baseline']}
    if 'recordedTrace' in run:
        inputs['recordedTrace'] = run['recordedTrace']
    for item in inputs.values():
        if evidence(ROOT / item['path']) != item:
            raise AssertionError(f'Input evidence changed for {run["game"]}')
    for key in ['report', 'executionReceipt', 'comparison', 'actualTrace', 'actualExecutionReceipt', 'actualOutput']:
        if key in run and (ROOT / run[key]).exists():
            raise FileExistsError(run[key])
    print(json.dumps({'phase': 'start', 'game': run['game'], 'mode': run['mode'], 'startedAt': utc()}), flush=True)
    execution = execute(run['command'], run['game'].lower(), inputs)
    value = read(ROOT / run['report']) if (ROOT / run['report']).exists() else None
    record = {'schema': 'logos-engine.v47.regression-run.v1', 'game': run['game'], 'mode': run['mode'],
              'targetLevels': run['targetLevels'], 'qualification': QUALIFICATION, 'execution': execution,
              'report': evidence(ROOT / run['report']) if value else None,
              'status': value['status'] if value else 'missing', 'final': value['final'] if value else None,
              'reportSourceMatchesFreeze': bool(value and value['source'] == execution['nativeSource']),
              'sourceUnchangedDuringRun': bool(value and value['sourceUnchangedDuringRun']),
              'pythonAgentModules': value['pythonAgentModules'] if value else None,
              'modeMatchesPlan': bool(value and bool(value.get('recordedPublicReplay')) == (run['mode'] == 'recorded-public-replay')),
              'comparisonAttempts': []}
    if 'actualExecutionReceipt' in run and (ROOT / run['actualExecutionReceipt']).exists():
        record['actualExecutionReceipt'] = evidence(ROOT / run['actualExecutionReceipt'])
        record['actualTrace'] = evidence(ROOT / run['actualTrace']) if (ROOT / run['actualTrace']).exists() else None
    if value:
        record['comparisonAttempts'].append(compare(run))
    record['passed'] = passed(record)
    write(ROOT / run['executionReceipt'], record, fresh=True)
    print(json.dumps({'phase': 'completed', 'game': run['game'], 'mode': run['mode'], 'passed': record['passed'],
                      'status': record['status'], 'actions': record['final']['actions'] if record['final'] else None,
                      'failedChecks': record['comparisonAttempts'][-1]['failedChecks'] if record['comparisonAttempts'] else ['missing report']}), flush=True)
    return record


def passed(record):
    execution = record['execution']
    return bool(execution['exitCode'] == 0 and execution['nativeSourceUnchanged'] and execution['harnessFilesUnchanged']
                and record['status'] == 'passed' and record['reportSourceMatchesFreeze']
                and record['sourceUnchangedDuringRun'] and record['pythonAgentModules'] == [] and record['modeMatchesPlan']
                and record['comparisonAttempts'] and record['comparisonAttempts'][-1]['passed'])


def summarize(plan, records, initial_source, final_source, started, finished):
    all_passed = len(records) == len(plan['runs']) and all(item['passed'] for item in records)
    frozen = initial_source == final_source == read(SOURCE)
    verification = {'schema': 'logos-engine.v47.regression-verification.v1', 'plan': evidence(PLAN),
                    'generator': evidence(Path(__file__)), 'startedAt': started, 'finishedAt': finished,
                    'nativeSourceBeforeAllRuns': initial_source, 'nativeSourceAfterAllRuns': final_source,
                    'nativeSourceUnchangedBeforeAfterAllRuns': frozen, 'qualification': QUALIFICATION,
                    'runs': records, 'passed': all_passed and frozen}
    write(VERIFICATION, verification)
    groups = []
    for mode in ['recorded-public-replay', 'actual-game-campaign']:
        selected = [item for item in records if item['mode'] == mode]
        groups.append({'mode': mode, 'runs': len(selected), 'passed': all(item['passed'] for item in selected),
                       'commands': sum(item['final']['actions'] for item in selected if item['final']),
                       'completePublicPackets': sum(item['final']['actions'] + 1 for item in selected if item['final']),
                       'prefixes': sum(item['final']['prefixes'] for item in selected if item['final']),
                       'comparisonChecks': sum(item['comparisonAttempts'][-1]['checks'] for item in selected if item['comparisonAttempts']),
                       'games': [item['game'] for item in selected]})
    summary = {'schema': 'logos-engine.v47.regression-summary.v1', 'passed': verification['passed'],
               'verification': evidence(VERIFICATION), 'plan': evidence(PLAN), 'sourceDigest': final_source['digest'],
               'nativeSourceFiles': final_source['fileCount'], 'qualification': QUALIFICATION, 'groups': groups,
               'results': [{'game': item['game'], 'mode': item['mode'], 'passed': item['passed'], 'status': item['status'],
                            'actions': item['final']['actions'] if item['final'] else None,
                            'levelsCompleted': item['final']['levelsCompleted'] if item['final'] else None,
                            'state': item['final']['state'] if item['final'] else None,
                            'prefixes': item['final']['prefixes'] if item['final'] else None,
                            'report': item['report'],
                            'comparison': item['comparisonAttempts'][-1]['result'] if item['comparisonAttempts'] else None}
                           for item in records]}
    write(SUMMARY, summary)
    print(json.dumps({'summary': relative(SUMMARY), 'passed': summary['passed'], 'groups': groups}), flush=True)
    return summary['passed']


def run_all(max_concurrent):
    if VERIFICATION.exists() or SUMMARY.exists():
        raise FileExistsError('Initial regression verification already exists')
    plan = read(PLAN)
    if harness_files() != plan['harnessFileSha256']:
        raise AssertionError('Harness changed since regression plan preparation')
    source = assert_frozen()
    started = utc()
    by_game = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_concurrent) as pool:
        futures = {pool.submit(one, run): run for run in plan['runs']}
        for future in concurrent.futures.as_completed(futures):
            item = future.result()
            by_game[item['game']] = item
    records = [by_game[item['game']] for item in plan['runs']]
    return summarize(plan, records, source, native_source(), started, utc())


def recompare(game, label):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*', label):
        raise ValueError('Comparison label must be a simple version identifier')
    plan = read(PLAN)
    run = next(item for item in plan['runs'] if item['game'] == game)
    verification = read(VERIFICATION)
    record = next(item for item in verification['runs'] if item['game'] == game)
    record['comparisonAttempts'].append(compare(run, label))
    record['passed'] = passed(record)
    write(ROOT / run['executionReceipt'], record)
    return summarize(plan, verification['runs'], verification['nativeSourceBeforeAllRuns'], native_source(),
                     verification['startedAt'], utc())


def main():
    parser = argparse.ArgumentParser()
    commands = parser.add_mutually_exclusive_group(required=True)
    commands.add_argument('--prepare', action='store_true')
    commands.add_argument('--run', action='store_true')
    commands.add_argument('--recompare', choices=[game for game, _word, _trace in CASES])
    parser.add_argument('--max-concurrent', type=int, choices=[1, 2], default=2)
    parser.add_argument('--label')
    args = parser.parse_args()
    if args.prepare:
        prepare()
        return
    ok = run_all(args.max_concurrent) if args.run else recompare(args.recompare, args.label or '')
    if not ok:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
