#!/usr/bin/env python3
"""Retain actual type, audit and build results for the final v50 source."""
from __future__ import annotations
import argparse
import datetime
import gzip
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v50/validation'
spec = importlib.util.spec_from_file_location('campaign_proof', ROOT / 'scripts/run-v50-final-campaign-proof.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def evidence(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--build-script', required=True); args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True); receipt_path = OUT / 'checks-run.json'
    if receipt_path.exists(): raise FileExistsError(receipt_path)
    before = module.native_source()
    assert before == json.loads((OUT.parent / 'source-manifest-final.json').read_text())
    checks = [('typecheck', ['npm', 'run', 'typecheck']),
              ('entry-audit', ['node', 'scripts/audit-v6-entry-points.ts']),
              ('migration-audit', ['python', 'scripts/audit-v6-migration.py']),
              ('diff-check', ['git', 'diff', '--check']),
              ('build', ['node', str(pathlib.Path(args.build_script).resolve())])]
    receipt = {'schema': 'logos-engine.v50.actual-release-checks.v1',
               'nativeSourceManifestDigest': before['digest'], 'nativeSource': before, 'checks': [],
               'generator': evidence(pathlib.Path(__file__)), 'status': 'running'}
    for name, command in checks:
        start = datetime.datetime.now(datetime.timezone.utc).isoformat(); clock = time.monotonic()
        result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        output = OUT / f'{name}-output.log.gz'; output.write_bytes(gzip.compress(result.stdout))
        row = {'name': name, 'command': command, 'startedAt': start,
               'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'durationSeconds': time.monotonic() - clock, 'exitCode': result.returncode, 'output': evidence(output)}
        receipt['checks'].append(row)
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
        print(json.dumps({'check': name, 'exitCode': result.returncode}), flush=True)
        if result.returncode: break
    after = module.native_source(); receipt['nativeSourceAfter'] = after; receipt['nativeSourceUnchanged'] = before == after
    receipt['status'] = 'passed' if len(receipt['checks']) == len(checks) and all(c['exitCode'] == 0 for c in receipt['checks']) and before == after else 'failed'
    if receipt['status'] == 'passed':
        workers = list((ROOT / 'dist/assets').glob('v6-agent-worker-*.js')); assert len(workers) == 1
        receipt['nativeAgentWorker'] = evidence(workers[0])
        receipt['buildInputs'] = {p.relative_to(ROOT).as_posix(): sha(p)
                                 for folder in ['src', 'public', 'content'] for p in sorted((ROOT / folder).rglob('*')) if p.is_file()}
        for relative in ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html', '.openai/hosting.json',
                         'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
                         'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs']:
            path = ROOT / relative
            if path.exists(): receipt['buildInputs'][relative] = sha(path)
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'status': receipt['status'], 'nativeSourceUnchanged': before == after, 'receipt': str(receipt_path.relative_to(ROOT))}), flush=True)
    if receipt['status'] != 'passed': raise SystemExit(1)

if __name__ == '__main__': main()
