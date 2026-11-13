#!/usr/bin/env python3
"""Verify retained publication inputs without rebuilding, testing or measuring."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, sys
BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def record(p):
    return {'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}
def read(p): return json.loads(p.read_text())
def check(files):
    for name, digest in files.items():
        assert sha(ROOT / name) == digest, name
    return len(files)
manifest = read(BASE / 'final/source-manifest.json')
current = dict(sorted((p.relative_to(ROOT).as_posix(), sha(p))
    for folder in ['src/logos-engine', 'src/runtime'] for p in (ROOT / folder).rglob('*')
    if p.is_file() and p.suffix in ('.ts', '.json', '.drm')))
assert current == manifest['files']
assert hashlib.sha256(json.dumps(current, separators=(',', ':')).encode()).hexdigest() == manifest['digest']
tests = read(BASE / 'final/revalidation/validation/delta-tests-run.json')
build = read(BASE / 'final/revalidation/validation/checks-run.json')
assert tests['status'] == build['status'] == 'passed'
counts = {'native': check(manifest['files']), 'sourceAndTests': check(tests['sourceAndTestInputs']), 'buildInputs': check(build['buildInputs'])}
window = read(BASE / 'performance/window.json')
cost = read(BASE / 'performance/global-budget-decision.json')
assert window['status'] == window['finalIntegrity'] == 'passed'
assert cost['accepted'] and cost['acceptedCases'] == cost['totalCases'] == 2
assert cost['measuredSessions'] == 32 and cost['measuredActions'] == 400
assert 'En attente' not in (BASE / 'performance/results.md').read_text()
inputs = [BASE / name for name in ['final/source-manifest.json', 'final/revalidation/validation/delta-tests-run.json',
    'final/revalidation/validation/checks-run.json', 'final/delivery-integrity.json', 'performance/window.json',
    'performance/global-budget-decision.json', 'performance/consolidation-review.json', 'performance/results.md']]
value = {'schema': 'logos-engine.lot3d.publication-inputs.v1', 'status': 'passed',
    'recordedAt': datetime.now(timezone.utc).isoformat(), 'generator': record(Path(__file__)),
    'nativeDigest': manifest['digest'], 'checkedInventories': counts, 'inputs': [record(p) for p in inputs],
    'qualification': 'Final retained-input check after completed timing. No source, test, build, game or cost result is regenerated. The functional SK48 target remains unmet despite verified contracts and accepted global costs.'}
with (BASE / 'publication-preflight.json').open('x') as f: f.write(json.dumps(value, indent=2) + '\n')
print(json.dumps({'status': value['status'], 'checkedInventories': counts}))
