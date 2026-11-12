#!/usr/bin/env python3
"""Run ordinary sequential regressions for a frozen lot 10C candidate without a global lock.

The default manifest retains the ten actual reports and public traces used by published Site95,
with complete archived public returns. No baseline is regenerated here. Missing
byte-part originals must be restored using the existing evidence helper first.
The unchanged durable driver retains all replay, preflight and comparison data.
Ordinary work has no peer quiet/publication admission gate and takes no global
coordination lock. Official timing is not claimed.

Usage: python -B docs/migration/lot10c-evidence/run-ordinary-regressions.py DIRECTORY
       [--case-manifest REPOSITORY_PATH] [--timeout-seconds 2400]
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
PROOF_PATH = ROOT / 'scripts/run-v53-campaign-proof.py'
SPEC = importlib.util.spec_from_file_location('lot10c_regression_proof', PROOF_PATH)
PROOF = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROOF)
DEFAULT_CASES = 'docs/migration/lot10c-evidence/recorded-regression-cases.json'
DRIVER = 'scripts/run-released-public-regressions-streamlog.py'
HELPERS = [DRIVER, 'scripts/run-released-public-regressions.py', 'scripts/run-recorded-public-regressions.py',
    'scripts/compare-v54-regressions.py', 'scripts/replay-public-regression-released-baseline.mjs',
    'scripts/replay-v53-public-regression.mjs', 'scripts/run-v53-campaign-proof.py', 'tests/helpers/v6-live-game-campaign.ts']
EXPECTED_GAMES = ['CATR', 'RSWP', 'FOGW', 'VOIS', 'CONN', 'MIND', 'WEAV', 'TRIA', 'CRAF', 'ISOS']


def now(): return datetime.now(timezone.utc).isoformat()


def require(condition, message):
    if not condition: raise ValueError(message)


def local_path(value):
    path = (ROOT / value).resolve()
    require(path.is_relative_to(ROOT), 'Paths must remain inside this checkout')
    return path


def relative(path): return path.relative_to(ROOT).as_posix()


def atomic_json(path, value):
    temp = path.with_name(path.name + f'.tmp-{os.getpid()}')
    with temp.open('x') as stream:
        json.dump(value, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    os.replace(temp, path)


def verify_case_inputs(manifest):
    require(manifest.get('schema') == 'logos-engine.recorded-public-regression-cases.v1', 'Unknown regression case schema')
    require([row.get('game') for row in manifest['cases']] == EXPECTED_GAMES, 'The declared declared-game order changed')
    evidence, missing = [], []
    for row in manifest['cases']:
        for role in ['baseline', 'trace']:
            item = row[role]; path = local_path(item['path'])
            if not path.is_file():
                missing.append({'game': row['game'], 'role': role, 'path': item['path'],
                                'partsManifestPresent': path.with_name(path.name+'.parts.json').is_file()})
            else:
                require(PROOF.sha(path) == item['sha256'], 'Pinned case input changed: ' + item['path'])
                evidence.append({'game': row['game'], 'role': role, **PROOF.evidence(path)})
    require(not missing, 'Restore these declared originals without changing bytes before replay: ' + json.dumps(missing))
    # Repository membership and baseline hash are separate checks. The actual
    # publication receipt remains the evidence for hosted publication itself.
    publication = manifest.get('baselinePublication')
    membership = []
    if publication:
        commit = publication['commit']
        require(isinstance(commit, str) and len(commit) == 40 and all(c in '0123456789abcdef' for c in commit), 'Invalid retained baseline commit')
        paths = [local_path(publication['reportProvenance']), local_path(publication['firstNativePublication'])]
        for row in manifest['cases']:
            baseline = local_path(row['baseline']['path']); parts = baseline.with_name(baseline.name+'.parts.json')
            paths.append(parts if parts.is_file() else baseline)
            paths.append(local_path(row['trace']['path']))
        for path in dict.fromkeys(paths):
            original = subprocess.check_output(['git', 'show', f'{commit}:{relative(path)}'], cwd=ROOT)
            require(hashlib.sha256(original).hexdigest() == PROOF.sha(path), 'Baseline membership differs at declared published commit: '+relative(path))
            membership.append({'path': relative(path), 'sha256': PROOF.sha(path), 'commit': commit})
    return evidence, membership


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    parser.add_argument('--case-manifest', default=DEFAULT_CASES)
    parser.add_argument('--node-old-space-mib', type=int, choices=[768, 1024, 1536], default=1536)
    parser.add_argument('--timeout-seconds', type=int, default=2400)
    args = parser.parse_args()
    require(1 <= args.timeout_seconds <= 2400, 'Per-case timeout must be in 1..2400 seconds')
    run(args)


def run(args):
    base = local_path(args.directory); manifest_path = local_path(args.case_manifest)
    source_path = base / 'source-manifest.json'; frozen = json.loads(source_path.read_text())
    require(PROOF.native_source() == frozen, 'Current native source differs from the declared freeze')
    manifest = json.loads(manifest_path.read_text())
    receipt_path = base / 'regression-launch.json'; raw = base / 'regression-driver-output.raw.txt'
    compressed = base / 'regression-driver-output.log.gz'; summary_path = base / 'regressions/regression-summary.json'
    for path in [receipt_path, raw, compressed, summary_path, base / 'preflight.json']:
        if path.exists(): raise FileExistsError('Retain the existing attempt and use a new evidence directory: ' + str(path))
    watched = {relative(path): PROOF.sha(path) for path in [Path(__file__).resolve(), manifest_path, source_path, *(ROOT/name for name in HELPERS)]}
    command = [sys.executable, '-B', DRIVER, relative(manifest_path), relative(base), '--source-manifest', relative(source_path),
               '--node-old-space-mib', str(args.node_old_space_mib), '--timeout-seconds', str(args.timeout_seconds)]
    receipt = {'schema': 'logos-engine.lot10c.regression-launch.v1', 'status': 'running', 'startedAt': now(),
        'generator': PROOF.evidence(Path(__file__)), 'caseManifest': PROOF.evidence(manifest_path),
        'sourceManifest': PROOF.evidence(source_path), 'nativeSourceDigest': frozen['digest'],
        'command': command, 'executionInputs': watched, 'exitCode': None,
        'coordination': {'mode': 'ordinary_unlocked', 'globalLockAcquired': False, 'timingClaim': False},
        'qualification': manifest['qualification'],
        'comparison': 'Unchanged comparator and 17 original checks per case. Full reports and public packets remain retained.'}
    with receipt_path.open('x') as stream: json.dump(receipt, stream, indent=2); stream.write('\n')
    clock = time.monotonic(); error = None
    try:
        receipt['caseInputs'], receipt['baselineCommitMembership'] = verify_case_inputs(manifest)
        atomic_json(receipt_path, receipt)
        print(json.dumps({'phase': 'regression_driver_started', 'cases': EXPECTED_GAMES,
                          'sourceDigest': frozen['digest'], 'rawOutput': relative(raw)}), flush=True)
        with raw.open('xb') as output:
            completed = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
        receipt['exitCode'] = completed.returncode
        if summary_path.is_file():
            summary = json.loads(summary_path.read_text())
            receipt['regressionSummary'] = PROOF.evidence(summary_path)
            receipt['summary'] = {k: summary.get(k) for k in ['status', 'passed', 'total', 'comparisonChecksPassed', 'comparisonChecksExpected', 'prevalidatedTotals']}
            require(summary.get('nativeSource') == frozen and summary.get('nativeSourceAfter') == frozen, 'Replay summary differs from frozen source')
        require(receipt['exitCode'] == 0 and receipt.get('summary', {}).get('status') == 'passed', 'Recorded regression driver did not pass completely')
        require(receipt['summary']['total'] == len(EXPECTED_GAMES) and receipt['summary']['passed'] == len(EXPECTED_GAMES), 'Incomplete declared-game population')
        require(receipt['summary']['comparisonChecksPassed'] == receipt['summary']['comparisonChecksExpected'] == 17*len(EXPECTED_GAMES), 'Incomplete comparison population')
    except BaseException as exc:
        error = exc; receipt['error'] = f'{type(exc).__name__}: {exc}'
    finally:
        # A failed archive or a deleted input must still produce a terminal
        # failed receipt. Keep raw output and the original driver error intact.
        finalization_errors = []
        try:
            if raw.exists():
                receipt['rawOutput'] = PROOF.evidence(raw)
                PROOF.archive(raw, compressed); receipt['output'] = PROOF.evidence(compressed)
        except BaseException as exc:
            error = error or exc
            finalization_errors.append({'stage': 'output_retention', 'error': f'{type(exc).__name__}: {exc}'})
        try:
            after = {name: PROOF.sha(ROOT/name) for name in watched}
            receipt['executionInputsAfter'] = after; receipt['executionInputsUnchanged'] = after == watched
            require(receipt['executionInputsUnchanged'], 'Regression execution inputs changed during the attempt')
        except BaseException as exc:
            error = error or exc; receipt['executionInputsUnchanged'] = False
            finalization_errors.append({'stage': 'execution_input_integrity', 'error': f'{type(exc).__name__}: {exc}'})
        try:
            receipt['nativeSourceUnchanged'] = PROOF.native_source() == frozen
            require(receipt['nativeSourceUnchanged'], 'Frozen native source changed during the attempt')
        except BaseException as exc:
            error = error or exc; receipt['nativeSourceUnchanged'] = False
            finalization_errors.append({'stage': 'native_source_integrity', 'error': f'{type(exc).__name__}: {exc}'})
        if finalization_errors: receipt['finalizationErrors'] = finalization_errors
        receipt.update(status='passed' if error is None else 'failed',
                       finishedAt=now(), elapsedSeconds=time.monotonic()-clock)
        atomic_json(receipt_path, receipt)
        print(json.dumps({'status': receipt['status'], 'receipt': relative(receipt_path), 'summary': receipt.get('summary')}), flush=True)
    if receipt['status'] != 'passed': raise SystemExit(1)


if __name__ == '__main__': main()
