#!/usr/bin/env python3
"""Retain lot 10C affected tests or five project gates on one frozen source.

Adapted from lot7A/run-release-checks.py, with an explicitly bounded test
inventory and the existing native-delta receipt schema consumed by the delivery
verifier. Every output is reserved exclusively. Raw output exists while each
child runs; failed attempts remain in their original evidence directory.

Usage: python -B docs/migration/lot10c-evidence/run-release-checks.py DIRECTORY
       (--tests [--extra-tests MANIFEST] | --build-script ABSOLUTE_SCRIPT)
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
PROOF_PATH = ROOT / 'scripts/run-v53-campaign-proof.py'
SPEC = importlib.util.spec_from_file_location('lot10c_release_proof', PROOF_PATH)
PROOF = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROOF)
SCOPE_PATH = Path(__file__).with_name('validation-test-scope.json')
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')


def now():
    return datetime.now(timezone.utc).isoformat()


def require(condition, message):
    if not condition: raise ValueError(message)


def local_path(value):
    path = (ROOT / value).resolve()
    require(path.is_relative_to(ROOT), 'Evidence and scope paths must be inside the checkout')
    return path


def inventory(folders):
    return {path.relative_to(ROOT).as_posix(): PROOF.sha(path)
            for folder in folders for path in sorted((ROOT / folder).rglob('*')) if path.is_file()}


def atomic_json(path, value):
    temporary = path.with_name(path.name + f'.tmp-{os.getpid()}')
    with temporary.open('x') as stream:
        json.dump(value, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    os.replace(temporary, path)


def read_tests(value, origin):
    files = value.get('testFiles') if isinstance(value, dict) else value
    require(isinstance(files, list) and all(isinstance(item, str) for item in files), origin + ' requires a testFiles array')
    for name in files:
        path = local_path(name)
        require(path.is_relative_to(ROOT / 'tests') and path.is_file() and path.name.endswith('.test.ts'), 'Missing declared test: ' + name)
    return files


def scope(extra):
    value = json.loads(SCOPE_PATH.read_text())
    require(value.get('schema') == 'logos-engine.lot10c.affected-test-scope.v1', 'Unknown test scope')
    files = [name for group in value['groups'] for name in read_tests(group, group['contract'])]
    require(files and len(files) == len(set(files)), 'Duplicated base test scope')
    extras = read_tests(json.loads(extra.read_text()), 'extra test manifest') if extra else []
    selected = list(dict.fromkeys([*files, *extras]))
    return selected, {'manifest': PROOF.evidence(SCOPE_PATH), 'declaredGroups': value['groups'],
        'explicitExtraTestManifest': PROOF.evidence(extra) if extra else None, 'explicitExtraTestFiles': extras,
        'testFiles': selected, 'testFileCount': len(selected), 'qualification': value['qualification']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--tests', action='store_true')
    mode.add_argument('--build-script', type=Path)
    parser.add_argument('--extra-tests')
    parser.add_argument('--timeout-seconds', type=int, default=2400)
    parser.add_argument('--coordination-lock', type=Path, default=Path('/workspace/shared/sra-coordination/performance.lock'))
    args = parser.parse_args()
    require(1 <= args.timeout_seconds <= 2400, 'Timeout must be in 1..2400 seconds')
    require(args.tests or args.extra_tests is None, '--extra-tests is only valid with --tests')
    # No blocking lock wait: an official cost window must never be disturbed.
    with args.coordination_lock.open('a') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
        run(args)


def run(args):
    base = local_path(args.directory); manifest_path = base / 'source-manifest.json'
    frozen = json.loads(manifest_path.read_text())
    require(PROOF.native_source() == frozen, 'Current native source differs from the required freeze')
    before = inventory(['src', 'tests'])
    extra = local_path(args.extra_tests) if args.extra_tests else None
    tests, test_scope = scope(extra) if args.tests else ([], None)
    if args.tests:
        checks = [('delta-tests', ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *tests])]
    else:
        build_script = args.build_script.resolve(); require(build_script.is_file(), 'Missing Sites build helper')
        checks = [('typecheck', ['npm', 'run', 'typecheck']),
                  ('entry-audit', ['node', 'scripts/audit-v6-entry-points.ts']),
                  ('migration-audit', [sys.executable, '-B', 'scripts/audit-v6-migration.py']),
                  ('diff-check', ['git', 'diff', '--check']),
                  ('build', ['node', str(build_script)])]
    out = base / 'validation'; out.mkdir(parents=True, exist_ok=True)
    receipt_path = out / ('delta-tests-run.json' if args.tests else 'checks-run.json')
    outputs = {name: {'raw': out / f'{name}-output.raw.txt', 'gzip': out / f'{name}-output.log.gz'} for name, _ in checks}
    for path in [receipt_path, *(path for paths in outputs.values() for path in paths.values())]:
        if path.exists(): raise FileExistsError('Preserve this attempt; use a new evidence directory: ' + str(path))
    watched = {Path(__file__).resolve(): PROOF.sha(Path(__file__)), PROOF_PATH: PROOF.sha(PROOF_PATH),
               manifest_path: PROOF.sha(manifest_path), SCOPE_PATH: PROOF.sha(SCOPE_PATH)}
    if extra: watched[extra] = PROOF.sha(extra)
    if not args.tests:
        for path in [build_script, ROOT / 'scripts/audit-v6-entry-points.ts', ROOT / 'scripts/audit-v6-migration.py',
                     ROOT / 'migration/v6-transfer-map.json']:
            watched[path] = PROOF.sha(path)
    receipt = {'schema': 'logos-engine.native-delta-verification.v1', 'status': 'running', 'startedAt': now(),
        'generator': PROOF.evidence(Path(__file__)), 'sharedProofHelper': PROOF.evidence(PROOF_PATH),
        'nativeSource': frozen, 'nativeSourceManifestDigest': frozen['digest'], 'sourceManifest': PROOF.evidence(manifest_path),
        'sourceAndTestInputs': before, 'plannedChecks': [{'name': n, 'command': c} for n, c in checks], 'checks': [],
        'coordination': {'lock': str(args.coordination_lock), 'mode': 'shared_nonblocking', 'timingClaim': False},
        'qualification': 'Declared affected contracts or five project checks on a frozen candidate. No full migration, live-game success or performance verdict.'}
    if args.tests: receipt.update(testFiles=tests, testFileCount=len(tests), testScope=test_scope)
    with receipt_path.open('x') as stream: json.dump(receipt, stream, indent=2); stream.write('\n')

    def save(): atomic_json(receipt_path, receipt)
    def integrity():
        require(PROOF.native_source() == frozen, 'Frozen native source changed during verification')
        require(inventory(['src', 'tests']) == before, 'Source or test files changed during verification')
        for path, digest in watched.items(): require(PROOF.sha(path) == digest, 'Changed verification input: ' + str(path))

    error = None; passed = False
    try:
        for name, command in checks:
            integrity(); started, clock = now(), time.monotonic()
            row = {'name': name, 'command': command, 'startedAt': started, 'exitCode': None,
                   'rawOutputPath': outputs[name]['raw'].relative_to(ROOT).as_posix(), 'timeoutSeconds': args.timeout_seconds}
            receipt['checks'].append(row); save()
            print(json.dumps({'check': name, 'phase': 'started', 'testFiles': len(tests) if args.tests else None}), flush=True)
            try:
                with outputs[name]['raw'].open('xb') as output:
                    result = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT, timeout=args.timeout_seconds)
                row['exitCode'] = result.returncode
            except subprocess.TimeoutExpired:
                row.update(exitCode=124, timedOut=True)
            except BaseException as exc:
                row.update(error=f'{type(exc).__name__}: {exc}'); raise
            finally:
                row.update(finishedAt=now(), durationSeconds=time.monotonic()-clock)
                if outputs[name]['raw'].exists():
                    PROOF.archive(outputs[name]['raw'], outputs[name]['gzip'])
                    row.update(output=PROOF.evidence(outputs[name]['gzip']), rawOutput=PROOF.evidence(outputs[name]['raw']))
                save()
            if args.tests:
                text = outputs[name]['raw'].read_text(errors='replace')
                matches = {key: re.findall(r'^# '+key+r' (\d+)\s*$', text, re.M) for key in COUNT_KEYS}
                row['counts'] = {key: int(values[0]) if len(values) == 1 else None for key, values in matches.items()}
                row['tapSummaryComplete'] = all(len(values) == 1 for values in matches.values())
            elif name == 'migration-audit' and row['exitCode'] == 0:
                # Work-in-progress audit deliberately returns exit 0 even when
                # mappings reference missing evidence. Parse its actual result.
                report_path = ROOT / 'docs/migration/v6-coverage.json'
                parsed = json.loads(outputs[name]['raw'].read_text())
                report = json.loads(report_path.read_text())
                row.update(auditSummary=parsed, auditReport=PROOF.evidence(report_path),
                    semanticPassed=isinstance(parsed.get('failures'), list) and parsed['failures'] == []
                    and report.get('failures') == [])
                save(); require(row['semanticPassed'], 'Migration audit has mapping or evidence failures despite exit 0')
            elif name == 'entry-audit' and row['exitCode'] == 0:
                report_path = ROOT / 'docs/migration/v6-entry-point-progress.json'
                report = json.loads(report_path.read_text())
                entries = [(group['id'], entry) for group in report['groups'] for entry in group['entries']
                           if entry['question'] == 'ordered_recruitment']
                row.update(auditReport=PROOF.evidence(report_path), connected=report['connected'], declared=report['declared'],
                    semanticPassed=len(entries) == 1 and entries[0][0] == 'factored_material_return'
                    and entries[0][1]['family'] == 'public_ordered_recruitment' and entries[0][1]['status'] == 'connected')
                save(); require(row['semanticPassed'], 'Entry audit did not establish the one actual Recruitment source entry')
            save(); integrity()
            print(json.dumps({'check': name, 'exitCode': row['exitCode'], 'counts': row.get('counts')}), flush=True)
            if row['exitCode']: break
        passed = len(receipt['checks']) == len(checks) and all(row['exitCode'] == 0 for row in receipt['checks'])
        if passed and args.tests:
            row = receipt['checks'][0]; counts = row['counts']
            passed = row['tapSummaryComplete'] and counts['tests'] == counts['pass'] and counts['tests'] > 0
            passed = passed and not any(counts[k] for k in ('fail', 'cancelled', 'skipped', 'todo'))
        if passed and not args.tests:
            workers = list((ROOT / 'dist/assets').glob('v6-agent-worker-*.js'))
            require(len(workers) == 1, 'Expected exactly one built native worker')
            receipt['nativeAgentWorker'] = PROOF.evidence(workers[0]); receipt['buildInputs'] = inventory(['src', 'public', 'content'])
            for name in ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html', '.openai/hosting.json',
                         'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
                         'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs']:
                if (ROOT / name).exists(): receipt['buildInputs'][name] = PROOF.sha(ROOT / name)
    except BaseException as exc:
        error = exc; receipt['error'] = f'{type(exc).__name__}: {exc}'
    finally:
        try:
            receipt['nativeSourceAfter'] = PROOF.native_source()
            receipt['nativeSourceUnchanged'] = receipt['nativeSourceAfter'] == frozen
            receipt['sourceAndTestInputsUnchanged'] = inventory(['src', 'tests']) == before
            integrity(); receipt['inputIntegrity'] = 'passed'
        except BaseException as exc:
            error = error or exc; receipt['inputIntegrity'] = 'failed'; receipt['integrityError'] = f'{type(exc).__name__}: {exc}'
        receipt.update(status='passed' if passed and error is None else 'failed', finishedAt=now())
        save(); print(json.dumps({'status': receipt['status'], 'receipt': receipt_path.relative_to(ROOT).as_posix()}), flush=True)
    if receipt['status'] != 'passed': raise SystemExit(1)


if __name__ == '__main__': main()
