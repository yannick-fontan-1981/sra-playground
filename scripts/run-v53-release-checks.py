#!/usr/bin/env python3
"""Retain targeted delta gates and release checks for one frozen native source."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import gzip
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v53_proof', ROOT / 'scripts/run-v53-campaign-proof.py')
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)
COMMON_TESTS = [
    'tests/v6-native-runtime.test.ts', 'tests/v6-native-family-registration.test.ts',
    'tests/v6-native-checkpoint-integration.test.ts', 'tests/v6-native-caller.test.ts',
    'tests/v6-caller-integration.test.ts', 'tests/v6-shared-series-native.test.ts',
    'tests/v6-framed-transfer-kernel.test.ts', 'tests/v6-field-service-kernel.test.ts',
    'tests/v6-material-recovery-priority.test.ts', 'tests/v6-acquired-continuation-priority.test.ts',
    'tests/v6-learned-preparation-priority.test.ts', 'tests/v6-program-control-discovery-integration.test.ts',
]


def inputs(folders):
    return {p.relative_to(ROOT).as_posix(): proof.sha(p)
            for folder in folders for p in sorted((ROOT / folder).rglob('*')) if p.is_file()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('directory')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--tests', action='store_true')
    group.add_argument('--build-script')
    args = parser.parse_args()
    base = ROOT / args.directory
    out = base / 'validation'
    out.mkdir(parents=True, exist_ok=True)
    receipt_path = out / ('delta-tests-run.json' if args.tests else 'checks-run.json')
    if receipt_path.exists():
        raise FileExistsError(receipt_path)
    frozen = json.loads((base / 'source-manifest.json').read_text())
    assert proof.native_source() == frozen
    initial_inputs = inputs(['src', 'tests']) if args.tests else None
    test_files = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'tests').glob('v6-outline-*.test.ts')) + COMMON_TESTS
    if args.tests:
        assert len(test_files) > len(COMMON_TESTS)
        checks = [('delta-tests', ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *test_files])]
    else:
        checks = [('typecheck', ['npm', 'run', 'typecheck']),
                  ('entry-audit', ['node', 'scripts/audit-v6-entry-points.ts']),
                  ('migration-audit', ['python', 'scripts/audit-v6-migration.py']),
                  ('diff-check', ['git', 'diff', '--check']),
                  ('build', ['node', str(Path(args.build_script).resolve())])]
    receipt = {'schema': 'logos-engine.v53.actual-release-checks.v1', 'status': 'running',
               'nativeSourceManifestDigest': frozen['digest'], 'nativeSource': frozen,
               'generator': proof.evidence(Path(__file__)), 'checks': []}
    for name, command in checks:
        started, clock = datetime.now(timezone.utc).isoformat(), time.monotonic()
        result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        output = out / f'{name}-output.log.gz'
        if output.exists():
            raise FileExistsError(output)
        output.write_bytes(gzip.compress(result.stdout, mtime=0))
        row = {'name': name, 'command': command, 'startedAt': started,
               'finishedAt': datetime.now(timezone.utc).isoformat(), 'durationSeconds': time.monotonic() - clock,
               'exitCode': result.returncode, 'output': proof.evidence(output)}
        if args.tests:
            text = result.stdout.decode()
            matches = {key: re.search(r'^# ' + key + r' (\d+)\s*$', text, re.M)
                       for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']}
            row['counts'] = {key: int(match.group(1)) if match else None for key, match in matches.items()}
            row['tapSummaryComplete'] = all(match is not None for match in matches.values())
            receipt.update(testFiles=test_files, testFileCount=len(test_files), sourceAndTestInputs=initial_inputs,
                           sourceAndTestInputsUnchanged=initial_inputs == inputs(['src', 'tests']))
        receipt['checks'].append(row)
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        print(json.dumps({'check': name, 'exitCode': result.returncode, 'counts': row.get('counts')}), flush=True)
        if result.returncode:
            break
    receipt['nativeSourceAfter'] = proof.native_source()
    unchanged = receipt['nativeSourceAfter'] == frozen
    receipt['nativeSourceUnchanged'] = unchanged
    passed = unchanged and len(receipt['checks']) == len(checks) and all(row['exitCode'] == 0 for row in receipt['checks'])
    if args.tests:
        counts = receipt['checks'][0]['counts']
        passed = passed and receipt['sourceAndTestInputsUnchanged'] and receipt['checks'][0]['tapSummaryComplete']
        passed = passed and counts['tests'] == counts['pass']
        passed = passed and not any(counts[k] for k in ['fail', 'cancelled', 'skipped', 'todo'])
        receipt['scope'] = 'Outline V5/V6 component contracts, shared Kernel acquisition and current guards, common-caller order, state reconstruction and adjoining material/preparation coordination. Targeted delta tests, not the full historical suite.'
    elif passed:
        workers = list((ROOT / 'dist/assets').glob('v6-agent-worker-*.js'))
        assert len(workers) == 1
        receipt['nativeAgentWorker'] = proof.evidence(workers[0])
        receipt['buildInputs'] = inputs(['src', 'public', 'content'])
        for name in ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html', '.openai/hosting.json',
                     'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
                     'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs']:
            path = ROOT / name
            if path.exists():
                receipt['buildInputs'][name] = proof.sha(path)
    receipt['status'] = 'passed' if passed else 'failed'
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'status': receipt['status'], 'sourceUnchanged': unchanged, 'receipt': receipt_path.relative_to(ROOT).as_posix()}), flush=True)
    if not passed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
