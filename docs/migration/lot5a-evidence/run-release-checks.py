#!/usr/bin/env python3
"""Archive actual lot 5A delta gates or five release checks for a frozen source.

Adapted from scripts/run-v53-release-checks.py; that historical runner is kept
unchanged. Test scope starts with the exact published predecessor 7A integrated test-file inventory,
then adds LinkedTemporal, transactional checkpoints, frontier deltas and path contracts.
Optional integrated-lot tests must be named in --extra-tests JSON before launch;
there is no implicit discovery of a changing test suite during execution.

Usage: python -B docs/migration/lot5a-evidence/run-release-checks.py DIRECTORY
       (--tests [--extra-tests MANIFEST] | --build-script ABSOLUTE_SCRIPT)
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
PROOF_PATH = ROOT / 'scripts/run-v53-campaign-proof.py'
spec = importlib.util.spec_from_file_location('lot5a_release_proof', PROOF_PATH)
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)
PREDECESSOR = ROOT / 'docs/migration/lot7a-evidence/integrated-final/validation/delta-tests-run.json'
ADDITIONS = [
    'tests/kernel-batch.test.ts',
    'tests/v6-frontier-native-snapshot.test.ts',
    'tests/v6-linked-temporal-preparation.test.ts',
    'tests/v6-linked-temporal-reference.test.ts',
    'tests/v6-native-mixed-path.test.ts',
    'tests/v6-source-entry-routing.test.ts',
]

COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')


def now():
    return datetime.now(timezone.utc).isoformat()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def inputs(folders):
    return {path.relative_to(ROOT).as_posix(): proof.sha(path)
            for folder in folders for path in sorted((ROOT / folder).rglob('*'))
            if path.is_file()}


def read_test_list(value, origin):
    files = value.get('testFiles') if isinstance(value, dict) else value
    require(isinstance(files, list) and all(isinstance(item, str) for item in files),
            f'{origin} must be a JSON array or an object with a testFiles array')
    result = []
    for item in files:
        path = (ROOT / item).resolve()
        require(path.is_relative_to(ROOT / 'tests') and path.is_file()
                and path.name.endswith('.test.ts'), f'Not a current checkout test file: {item}')
        result.append(path.relative_to(ROOT).as_posix())
    return result


def test_scope(extra_manifest):
    predecessor = json.loads(PREDECESSOR.read_text())
    require(predecessor.get('status') == 'passed', 'The predecessor release test receipt is not passed')
    inherited = read_test_list(predecessor, str(PREDECESSOR))
    require(inherited and len(inherited) == len(set(inherited)), 'Invalid predecessor test inventory')
    additions = read_test_list(ADDITIONS, 'lot5A additions')
    extras, extra_receipt = [], None
    if extra_manifest is not None:
        path = extra_manifest.resolve()
        require(path.is_relative_to(ROOT), 'Extra test manifest must be inside this checkout')
        extras = read_test_list(json.loads(path.read_text()), str(path))
        extra_receipt = proof.evidence(path)
    files = list(dict.fromkeys([*inherited, *additions, *extras]))
    return files, {
        'predecessor': proof.evidence(PREDECESSOR),
        'inheritedTestFiles': inherited,
        'inheritedTestFileCount': len(inherited),
        'declaredAdditionalTestFiles': additions,
        'extraTestManifest': extra_receipt,
        'explicitExtraTestFiles': extras,
        'deduplication': 'first occurrence retained; predecessor order followed by declared additions and explicit extras',
        'testFiles': files,
        'testFileCount': len(files),
        'scope': ('LinkedTemporal original consumed closure, passive/selected single ownership, conditional key paths, '
                  'atomic restoration and bounded unknown refusals; generic atomic Kernel checkpoints, exact '
                  'zero-recolor optimum, immutable Frontier deltas and mixed-path transport. Includes the exact '
                  'published 7A integrated common-owner regression scope. Explicit extras are listed separately. '
                  'This is a declared affected scope, not the complete historical suite, a live game success '
                  'claim or a performance verdict.'),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--tests', action='store_true')
    mode.add_argument('--build-script', type=Path)
    parser.add_argument('--extra-tests', type=Path)
    args = parser.parse_args()
    require(args.tests or args.extra_tests is None, '--extra-tests applies only to --tests')

    base = (ROOT / args.directory).resolve()
    require(base.is_relative_to(ROOT), 'Release evidence must be inside this checkout')
    manifest_path = base / 'source-manifest.json'
    frozen = json.loads(manifest_path.read_text())
    require(proof.native_source() == frozen, 'Current native source differs from the required frozen manifest')
    source_manifest = proof.evidence(manifest_path)
    initial_inputs = inputs(['src', 'tests'])
    test_files, scope = test_scope(args.extra_tests) if args.tests else ([], None)

    if args.tests:
        checks = [('delta-tests', ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *test_files])]
    else:
        build_script = args.build_script.resolve()
        require(build_script.is_file(), 'Build script does not exist')
        checks = [('typecheck', ['npm', 'run', 'typecheck']),
                  ('entry-audit', ['node', 'scripts/audit-v6-entry-points.ts']),
                  ('migration-audit', ['python', '-B', 'scripts/audit-v6-migration.py']),
                  ('diff-check', ['git', 'diff', '--check']),
                  ('build', ['node', str(build_script)])]

    out = base / 'validation'
    out.mkdir(parents=True, exist_ok=True)
    receipt_path = out / ('delta-tests-run.json' if args.tests else 'checks-run.json')
    output_paths = {name: out / f'{name}-output.log.gz' for name, _ in checks}
    for path in [receipt_path, *output_paths.values()]:
        if path.exists():
            raise FileExistsError(path)

    watched = {Path(__file__).resolve(): proof.sha(Path(__file__)), PROOF_PATH: proof.sha(PROOF_PATH),
               manifest_path: source_manifest['sha256']}
    if args.tests:
        watched[PREDECESSOR] = scope['predecessor']['sha256']
        if args.extra_tests is not None:
            watched[args.extra_tests.resolve()] = scope['extraTestManifest']['sha256']
    else:
        watched[build_script] = proof.sha(build_script)
    receipt = {
        'schema': 'logos-engine.lot5a.actual-release-checks.v1', 'status': 'running', 'startedAt': now(),
        'generator': proof.evidence(Path(__file__)), 'sharedProofHelper': proof.evidence(PROOF_PATH),
        'nativeSource': frozen, 'nativeSourceManifestDigest': frozen['digest'], 'sourceManifest': source_manifest,
        'sourceAndTestInputs': initial_inputs,
        'plannedChecks': [{'name': name, 'command': command} for name, command in checks], 'checks': [],
    }
    if args.tests:
        receipt.update(testFiles=test_files, testFileCount=len(test_files), testScope=scope, scope=scope['scope'])
    else:
        receipt['scope'] = ('Five project release checks on the frozen LinkedTemporal and generic-delta candidate: TypeScript, '
                            'declared-entry audit, migration audit, whitespace/conflict diff check and production build. '
                            'They do not establish complete migration, live success or a performance budget.')
    with receipt_path.open('x') as stream:
        json.dump(receipt, stream, indent=2)
        stream.write('\n')

    def save():
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')

    def integrity():
        require(proof.native_source() == frozen, 'Frozen native source changed during release checks')
        require(inputs(['src', 'tests']) == initial_inputs, 'Source or test inputs changed during release checks')
        for path, digest in watched.items():
            require(proof.sha(path) == digest, 'Release runner, manifest or scope input changed: ' + str(path))

    error = None
    try:
        for name, command in checks:
            integrity()
            started, clock = now(), time.monotonic()
            result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            output = output_paths[name]
            with output.open('xb') as stream:
                stream.write(gzip.compress(result.stdout, mtime=0))
            row = {'name': name, 'command': command, 'startedAt': started, 'finishedAt': now(),
                   'durationSeconds': time.monotonic() - clock, 'exitCode': result.returncode,
                   'output': proof.evidence(output)}
            if args.tests:
                text = result.stdout.decode('utf-8', errors='replace')
                matches = {key: re.findall(r'^# ' + key + r' (\d+)\s*$', text, re.M) for key in COUNT_KEYS}
                row['counts'] = {key: int(values[0]) if len(values) == 1 else None for key, values in matches.items()}
                row['tapSummaryComplete'] = all(len(values) == 1 for values in matches.values())
            receipt['checks'].append(row)
            save()
            print(json.dumps({'check': name, 'exitCode': result.returncode, 'counts': row.get('counts')}), flush=True)
            integrity()
            if result.returncode:
                break
        if not args.tests and len(receipt['checks']) == len(checks) and all(row['exitCode'] == 0 for row in receipt['checks']):
            workers = list((ROOT / 'dist/assets').glob('v6-agent-worker-*.js'))
            require(len(workers) == 1, 'Expected one built native V6 agent worker')
            receipt['nativeAgentWorker'] = proof.evidence(workers[0])
            receipt['buildInputs'] = inputs(['src', 'public', 'content'])
            for name in ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html', '.openai/hosting.json',
                         'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
                         'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs']:
                path = ROOT / name
                if path.exists():
                    receipt['buildInputs'][name] = proof.sha(path)
    except BaseException as exc:
        error = exc
        receipt['error'] = f'{type(exc).__name__}: {exc}'
    finally:
        try:
            receipt['nativeSourceAfter'] = proof.native_source()
            receipt['nativeSourceUnchanged'] = receipt['nativeSourceAfter'] == frozen
            receipt['sourceAndTestInputsUnchanged'] = inputs(['src', 'tests']) == initial_inputs
            integrity()
            receipt['inputIntegrity'] = 'passed'
        except BaseException as exc:
            error = error or exc
            receipt['inputIntegrity'] = 'failed'
            receipt['integrityError'] = f'{type(exc).__name__}: {exc}'
        passed = error is None and len(receipt['checks']) == len(checks) and all(row['exitCode'] == 0 for row in receipt['checks'])
        if args.tests and passed:
            row = receipt['checks'][0]
            counts = row['counts']
            passed = row['tapSummaryComplete'] and counts['tests'] == counts['pass'] and counts['tests'] > 0
            passed = passed and not any(counts[key] for key in ('fail', 'cancelled', 'skipped', 'todo'))
        receipt['status'] = 'passed' if passed else 'failed'
        receipt['finishedAt'] = now()
        save()
        print(json.dumps({'status': receipt['status'], 'sourceUnchanged': receipt.get('nativeSourceUnchanged'),
                          'testFiles': len(test_files) if args.tests else None,
                          'receipt': receipt_path.relative_to(ROOT).as_posix()}), flush=True)
    if not passed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
