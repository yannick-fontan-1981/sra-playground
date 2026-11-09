#!/usr/bin/env python3
"""Run framed acquisition and common-caller delta gates on one frozen source."""
from __future__ import annotations
import datetime
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v52/attempt9/validation'
spec = importlib.util.spec_from_file_location('campaign_proof', ROOT / 'scripts/run-v52-campaign-proof.py')
proof = importlib.util.module_from_spec(spec); spec.loader.exec_module(proof)
FILES = [
    'tests/v6-framed-transfer-reference.test.ts',
    'tests/v6-framed-transfer-kernel.test.ts',
    'tests/v6-framed-public-packet.test.ts',
    'tests/v6-framed-transfer-phased-receptions.test.ts',
    'tests/v6-framed-uniform-questions.test.ts',
    'tests/v6-framed-directed-composition.test.ts',
    'tests/v6-reduction-search-bound.test.ts',
    'tests/v6-reduction-transport-parity.test.ts',
    'tests/v6-native-runtime.test.ts',
    'tests/v6-native-family-registration.test.ts',
    'tests/v6-native-checkpoint-integration.test.ts',
    'tests/v6-native-caller.test.ts',
    'tests/v6-caller-integration.test.ts',
    'tests/v6-shared-series-native.test.ts',
    'tests/v6-field-service-kernel.test.ts',
    'tests/v6-material-recovery-priority.test.ts',
    'tests/v6-acquired-continuation-priority.test.ts',
    'tests/v6-learned-preparation-priority.test.ts',
    'tests/v6-program-control-discovery-integration.test.ts',
    'tests/v6-occluded-catalogue-kernel.test.ts',
    'tests/v6-queued-field-kernel.test.ts',
    'tests/v6-trace-continuation.test.ts',
    'tests/v6-v45-kernel-integration.test.ts',
]


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def evidence(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def inputs():
    return {p.relative_to(ROOT).as_posix(): sha(p) for folder in ['tests', 'src']
            for p in sorted((ROOT / folder).rglob('*')) if p.is_file()}

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    receipt_path = OUT / 'delta-tests-run.json'; log_path = OUT / 'delta-tests-output.log.gz'
    for path in [receipt_path, log_path]:
        if path.exists(): raise FileExistsError(path)
    source = proof.native_source(); all_before = inputs()
    assert source == json.loads((OUT.parent / 'source-manifest.json').read_text())
    command = ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *FILES]
    start = datetime.datetime.now(datetime.timezone.utc).isoformat(); clock = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    text = result.stdout.decode(); log_path.write_bytes(gzip.compress(result.stdout))
    source_after = proof.native_source(); all_after = inputs()
    counts = {key: int(re.search(r'^# ' + key + r' (\d+)\s*$', text, re.M).group(1))
              for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']}
    passed = result.returncode == 0 and source == source_after and all_before == all_after
    passed = passed and counts['tests'] == counts['pass'] and not any(counts[k] for k in ['fail', 'cancelled', 'skipped', 'todo'])
    receipt = {'schema': 'logos-engine.v52.actual-delta-tests.v1', 'status': 'passed' if passed else 'failed',
        'command': command, 'startedAt': start, 'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'elapsedSeconds': time.monotonic() - clock, 'exitCode': result.returncode, 'counts': counts,
        'nativeSourceManifestDigest': source['digest'], 'nativeSource': source, 'nativeSourceAfter': source_after,
        'nativeSourceUnchanged': source == source_after, 'testFiles': FILES, 'testFileCount': len(FILES),
        'sourceAndTestInputs': all_before, 'sourceAndTestInputsUnchanged': all_before == all_after,
        'output': evidence(log_path), 'generator': evidence(Path(__file__)),
        'scope': 'Framed transfer source geometry, complete own proposals and actual acquisitions, current point guards, public packet and settled-support reception acquisition, uniform and typed control prerequisites, directed intermediate receiver questions with explicit competing control hypotheses, physical-point ambiguity and precedence of observed control evidence, two entries sharing one retained owner, native graph hydration, atomic restore, boundary portability and common acquisition ordering. The adjoining common caller, prior service, material and acquired-continuation integration gates remain included. This is a targeted delta suite, not the historical full suite.'}
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'status': receipt['status'], 'counts': counts, 'testFiles': len(FILES), 'sourceUnchanged': source == source_after}), flush=True)
    if not passed: raise SystemExit(1)

if __name__ == '__main__': main()
