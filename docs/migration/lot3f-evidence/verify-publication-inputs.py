#!/usr/bin/env python3
"""Verify retained publication inputs without rebuilding, testing or measuring."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(path):
    return {'path': path.relative_to(ROOT).as_posix(),
            'bytes': path.stat().st_size, 'sha256': sha(path)}


def read(path):
    return json.loads(path.read_text())


def check(files):
    for name, digest in files.items():
        assert sha(ROOT / name) == digest, name
    return len(files)


manifest = read(BASE / 'final/source-manifest.json')
current = dict(sorted((path.relative_to(ROOT).as_posix(), sha(path))
    for folder in ['src/logos-engine', 'src/runtime']
    for path in (ROOT / folder).rglob('*')
    if path.is_file() and path.suffix in ('.ts', '.json', '.drm')))
assert current == manifest['files']
assert hashlib.sha256(json.dumps(current, separators=(',', ':')).encode()).hexdigest() == manifest['digest']
tests = read(BASE / 'final/validation/delta-tests-run.json')
build = read(BASE / 'final/validation/checks-run.json')
assert tests['status'] == build['status'] == 'passed'
counts = {'native': check(manifest['files']),
          'sourceAndTests': check(tests['sourceAndTestInputs']),
          'buildInputs': check(build['buildInputs'])}
window = read(BASE / 'performance/window.json')
cost = read(BASE / 'performance/global-budget-decision.json')
assert window['status'] == window['finalIntegrity'] == 'passed'
assert cost['totalCases'] == 2
assert cost['accepted'] == (cost['acceptedCases'] == cost['totalCases'])
assert cost['measuredSessions'] == 32 and cost['measuredActions'] == 400
readiness = read(BASE / 'performance/readiness.json')
assert readiness['measurementAuthorized'] and not readiness['pendingRequirements']
for item in readiness['inputs']:
    assert record(ROOT / item['path']) == item, item['path']
resolution = read(BASE / 'final/vois-resolution.json')
assert resolution['actual']['levelsCompleted'] == resolution['targetLevels'] == 3
assert resolution['caseClock']['cumulativeSeconds'] < 2400
assert not resolution['caseClock']['furtherWorkThisDelivery']
results = (BASE / 'performance/results.md').read_text()
report = (BASE.parent / 'lot3f-reference-population.md').read_text()
assert 'En attente' not in results
assert 'Aucun résultat de coût n’est anticipé.' not in report
inputs = [BASE / name for name in [
    'final/source-manifest.json', 'final/validation/delta-tests-run.json',
    'final/validation/checks-run.json', 'final/regressions/regression-summary.json',
    'final/browser/browser-qa.json', 'final/vois-resolution.json',
    'final/delivery-integrity.json', 'performance/readiness.json',
    'performance/window.json', 'performance/global-budget-decision.json',
    'performance/consolidation-review.json', 'performance/results.md',
]]
value = {
    'schema': 'logos-engine.lot3f.publication-inputs.v1', 'status': 'passed',
    'recordedAt': datetime.now(timezone.utc).isoformat(),
    'generator': record(Path(__file__)), 'nativeDigest': manifest['digest'],
    'checkedInventories': counts, 'globalCostAccepted': cost['accepted'],
    'inputs': [record(path) for path in inputs],
    'qualification': 'Final retained-input check after completed timing. No source, test, build, game or cost result is regenerated. ReferencePopulation meets the announced three-level VOIS target. Partial inherited-caller scope, incomplete retained-frame revalidation, missing control revocation and unknown color law remain explicit. Prior CWSE/SK48/FOGW clocks are unchanged. Cost acceptance is reported independently; this check cannot override it.'
}
with (BASE / 'publication-preflight.json').open('x') as stream:
    stream.write(json.dumps(value, indent=2) + '\n')
print(json.dumps({'status': value['status'], 'checkedInventories': counts,
                  'globalCostAccepted': cost['accepted']}))
