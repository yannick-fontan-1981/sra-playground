#!/usr/bin/env python3
"""Run a predeclared, sequential A1/B1/B2/A2 native cost window.

Usage: python -B scripts/run-native-cost-window.py BASELINE_CHECKOUT PERFORMANCE_DIR
       BASELINE_MANIFEST CORRECTION_MANIFEST

PERFORMANCE_DIR is inside this checkout and already contains cases.json,
comparison-policy.json and protocol.md. No runner, comparator or policy is edited.
Outputs are exclusive. This command starts measurements; prepare it before, and
execute it only after the delivery owner has authorized the measurement window.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
RUNNER = 'scripts/measure-native-loop-costs.mjs'
COMPARATORS = ['scripts/compare-native-loop-costs.mjs', 'scripts/compare-native-cost-cohorts.mjs']
SOURCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/'
DECLARATIONS = [SOURCE + 'laya_proto/common_frontier_policy.drm.json', SOURCE + 'morphology_policy/strategy.drm']


def now(): return datetime.now(timezone.utc).isoformat()
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def require(ok, message):
    if not ok: raise ValueError(message)


def inventory(root):
    files = {p.relative_to(root).as_posix(): sha(p) for folder in ['src/logos-engine', 'src/runtime']
             for p in (root / folder).rglob('*') if p.is_file() and p.suffix in ('.ts', '.json', '.drm')}
    files = dict(sorted(files.items()))
    return {'fileCount': len(files), 'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(), 'files': files}


def copy_exclusive(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with source.open('rb') as incoming, destination.open('xb') as outgoing:
        shutil.copyfileobj(incoming, outgoing)
    require(sha(source) == sha(destination), 'Copied bytes differ: ' + str(destination))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['baseline_checkout', 'performance_dir', 'baseline_manifest', 'correction_manifest']: parser.add_argument(name, type=Path)
    args = parser.parse_args()
    baseline, performance = args.baseline_checkout.resolve(), args.performance_dir.resolve()
    relative = performance.relative_to(ROOT)
    require(baseline != ROOT, 'Baseline and correction must be distinct checkouts')
    require(performance.is_dir(), 'Prepare the performance directory and protocol first')
    window = performance / 'window.json'
    receipt = {'schema': 'logos-engine.native-cost-window.v1', 'status': 'running', 'startedAt': now(),
               'plannedOrder': ['A1', 'B1', 'B2', 'A2'], 'baselineCheckout': str(baseline), 'correctionCheckout': str(ROOT), 'executions': []}
    with window.open('x') as stream: json.dump(receipt, stream, indent=2); stream.write('\n')
    def save():
        with window.open('w') as stream: json.dump(receipt, stream, indent=2); stream.write('\n')
    plans = [('A1', baseline, 'cohort1/baseline'), ('B1', ROOT, 'cohort1/after'),
             ('B2', ROOT, 'cohort2/after'), ('A2', baseline, 'cohort2/baseline')]
    expected, watched = {}, {}
    def verify():
        for checkout, frozen in expected.items(): require(inventory(checkout) == frozen, 'Native source changed: ' + str(checkout))
        for path, digest in watched.items(): require(sha(path) == digest, 'Window input changed: ' + str(path))
    try:
        for _, checkout, name in plans:
            for path in {checkout / relative / (name + '.json'), performance / (name + '.json'), performance / (name + '.log')}:
                require(not path.exists(), 'Refusing existing output: ' + str(path))
        for checkout, manifest in [(baseline, args.baseline_manifest.resolve()), (ROOT, args.correction_manifest.resolve())]:
            expected[checkout] = json.loads(manifest.read_bytes()); watched[manifest] = sha(manifest)
            require(inventory(checkout) == expected[checkout], 'Frozen native inventory differs: ' + str(checkout))
        runner_hash = sha(ROOT / RUNNER)
        require(sha(baseline / RUNNER) == runner_hash, 'Measurement runners differ')
        for path in [ROOT / RUNNER, baseline / RUNNER, *(ROOT / p for p in COMPARATORS), Path(__file__).resolve()]: watched[path] = sha(path)
        for name in DECLARATIONS:
            require(sha(ROOT / name) == sha(baseline / name), 'Source declarations differ: ' + name)
            for checkout in [ROOT, baseline]: watched[checkout / name] = sha(checkout / name)
        for name in ['cases.json', 'comparison-policy.json', 'protocol.md']:
            source, destination = performance / name, baseline / relative / name
            if destination.exists(): require(sha(source) == sha(destination), 'Existing baseline input differs: ' + str(destination))
            else: copy_exclusive(source, destination)
            watched[source] = watched[destination] = sha(source)
        manifest = json.loads((performance / 'cases.json').read_bytes())
        for case in manifest['cases']:
            for checkout in [baseline, ROOT]:
                path = (checkout / case['trace']).resolve()
                require(path.is_relative_to(checkout) and sha(path) == case['traceSha256'], 'Public trace differs: ' + str(path))
                watched[path] = sha(path)
        receipt.update(nativeDigests={'baseline': expected[baseline]['digest'], 'correction': expected[ROOT]['digest']},
                       runnerSha256=runner_hash, inputs=[{'path': str(p), 'sha256': digest} for p, digest in watched.items()])
        save()
        for label, checkout, name in plans:
            verify()
            output, log = checkout / relative / (name + '.json'), performance / (name + '.log')
            log.parent.mkdir(parents=True, exist_ok=True)
            command = ['node', RUNNER, (relative / 'cases.json').as_posix(), (relative / (name + '.json')).as_posix()]
            row = {'label': label, 'checkout': str(checkout), 'command': command, 'nativeDigest': expected[checkout]['digest'],
                   'startedAt': now(), 'status': 'running', 'output': str(output), 'log': str(log)}
            receipt['executions'].append(row); save(); print(json.dumps({'phase': 'starting', 'label': label}), flush=True)
            process, started = None, time.monotonic()
            try:
                with log.open('xb') as stream:
                    process = subprocess.Popen(command, cwd=checkout, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                    for line in process.stdout:
                        stream.write(line); stream.flush(); sys.stdout.buffer.write(line); sys.stdout.buffer.flush()
                    process.wait()
            finally:
                if process and process.poll() is None:
                    process.terminate()
                    try: process.wait(timeout=10)
                    except subprocess.TimeoutExpired: process.kill(); process.wait()
                row.update(finishedAt=now(), elapsedMs=(time.monotonic() - started) * 1000,
                           exitCode=process.returncode if process else None, status='failed')
                if log.exists(): row['logSha256'] = sha(log)
                if output.exists(): row['reportSha256'] = sha(output)
                save()
            verify()
            require(row['exitCode'] == 0, 'Measurement failed: ' + label)
            report = json.loads(output.read_bytes())
            require(report['status'] == 'passed' and report['nativeSourceUnchanged'] is True
                    and report['nativeSource'] == expected[checkout] and report['generator']['sha256'] == runner_hash,
                    'Measurement report does not bind the frozen source: ' + label)
            if checkout == baseline:
                destination = performance / (name + '.json'); copy_exclusive(output, destination)
                row.update(copiedOutput=str(destination), copiedReportSha256=sha(destination))
            row['status'] = 'passed'; save(); print(json.dumps({'phase': 'finished', 'label': label, 'exitCode': row['exitCode']}), flush=True)
        verify(); receipt['status'] = 'passed'
    except BaseException as error:
        receipt['status'] = 'failed'; receipt['error'] = f'{type(error).__name__}: {error}'
    finally:
        try:
            verify(); receipt['finalIntegrity'] = 'passed' if len(expected) == 2 and watched else 'incomplete'
        except Exception as error:
            receipt['status'] = 'failed'; receipt['finalIntegrity'] = 'failed'; receipt['integrityError'] = str(error)
        receipt['finishedAt'] = now(); save(); print(json.dumps({'status': receipt['status'], 'window': str(window)}), flush=True)
    return 0 if receipt['status'] == 'passed' else 1


if __name__ == '__main__': sys.exit(main())
