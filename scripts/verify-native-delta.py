#!/usr/bin/env python3
"""Record explicit checks against a frozen native source without editing it.

Test files are supplied as arguments. Historical version-specific proof runners
remain unchanged; this runner is reusable for subsequent migration deltas.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('campaign_proof', ROOT / 'scripts/run-v53-campaign-proof.py')
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)

def inventory(folders):
    return {p.relative_to(ROOT).as_posix(): proof.sha(p)
            for folder in folders for p in sorted((ROOT / folder).rglob('*')) if p.is_file()}

def write_absent(path, value):
    with path.open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--tests', nargs='+')
    group.add_argument('--build-script')
    args = parser.parse_args()
    base = (ROOT / args.directory).resolve()
    base.relative_to(ROOT)
    frozen = json.loads((base / 'source-manifest.json').read_text())
    if proof.native_source() != frozen:
        raise ValueError('Current source differs from the declared frozen campaign')
    out = base / 'validation'
    out.mkdir(parents=True, exist_ok=True)
    receipt = out / ('delta-tests-run.json' if args.tests else 'checks-run.json')
    if receipt.exists():
        raise FileExistsError(receipt)
    if args.tests:
        for name in args.tests:
            path = (ROOT / name).resolve()
            path.relative_to(ROOT / 'tests')
            if not path.is_file() or not name.endswith('.test.ts'):
                raise ValueError('Expected an existing TypeScript test file')
        checks = [('delta-tests', ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *args.tests])]
        inputs = inventory(['src', 'tests'])
    else:
        checks = [('typecheck', ['npm', 'run', 'typecheck']),
                  ('entry-audit', ['node', 'scripts/audit-v6-entry-points.ts']),
                  ('migration-audit', ['python', 'scripts/audit-v6-migration.py']),
                  ('diff-check', ['git', 'diff', '--check']),
                  ('build', ['node', str(Path(args.build_script).resolve())])]
        inputs = None
    result = {'schema': 'logos-engine.native-delta-verification.v1', 'status': 'running',
              'generator': proof.evidence(Path(__file__)), 'nativeSource': frozen,
              'nativeSourceManifestDigest': frozen['digest'], 'checks': []}
    for name, argv in checks:
        started, clock = datetime.now(timezone.utc).isoformat(), time.monotonic()
        completed = subprocess.run(argv, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        log = out / (name + '-output.log.gz')
        with log.open('xb') as stream:
            stream.write(gzip.compress(completed.stdout, mtime=0))
        row = {'name': name, 'command': argv, 'startedAt': started,
               'finishedAt': datetime.now(timezone.utc).isoformat(), 'elapsedSeconds': time.monotonic() - clock,
               'exitCode': completed.returncode, 'output': proof.evidence(log)}
        if args.tests:
            matches = {key: re.search(r'^# ' + key + r' (\d+)\s*$', completed.stdout.decode(), re.M)
                       for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']}
            row['counts'] = {key: int(match.group(1)) if match else None for key, match in matches.items()}
            row['tapSummaryComplete'] = all(matches.values())
        result['checks'].append(row)
        print(json.dumps({'name': name, 'exitCode': completed.returncode, 'counts': row.get('counts')}), flush=True)
        if completed.returncode:
            break
    result['nativeSourceUnchanged'] = proof.native_source() == frozen
    passed = result['nativeSourceUnchanged'] and len(result['checks']) == len(checks) and all(row['exitCode'] == 0 for row in result['checks'])
    if args.tests:
        counts = result['checks'][0]['counts']
        result.update(testFiles=args.tests, sourceAndTestInputs=inputs, sourceAndTestInputsUnchanged=inputs == inventory(['src', 'tests']))
        passed = passed and result['sourceAndTestInputsUnchanged'] and result['checks'][0]['tapSummaryComplete']
        passed = passed and counts['tests'] == counts['pass'] and not any(counts[k] for k in ['fail', 'cancelled', 'skipped', 'todo'])
        result['qualification'] = 'Explicit delta contract and integration tests; not the entire historical test suite.'
    elif passed:
        workers = list((ROOT / 'dist/assets').glob('v6-agent-worker-*.js'))
        if len(workers) != 1:
            raise ValueError('Expected one native production worker')
        result['nativeAgentWorker'] = proof.evidence(workers[0])
        result['buildInputs'] = inventory(['src', 'public', 'content'])
        for name in ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html', '.openai/hosting.json',
                     'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
                     'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs']:
            path = ROOT / name
            if path.exists(): result['buildInputs'][name] = proof.sha(path)
    result['status'] = 'passed' if passed else 'failed'
    write_absent(receipt, result)
    print(json.dumps({'status': result['status'], 'receipt': str(receipt.relative_to(ROOT))}), flush=True)
    if not passed:
        raise SystemExit(1)

if __name__ == '__main__':
    main()
