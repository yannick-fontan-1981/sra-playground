"""Run one declared functional check, retaining every attempt without locks."""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import gzip
import hashlib
import json
import os
import re
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[4]
STAGE = ROOT / 'docs/migration/lot8b-evidence/common-integration-01'
PLAN = STAGE / 'plan.json'
plan = json.loads(PLAN.read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--kind', choices=list(plan['commands']), required=True)
parser.add_argument('--attempt', required=True)
args = parser.parse_args()
assert re.fullmatch(r'[a-z0-9-]+', args.attempt)
spec = plan['commands'][args.kind]
out = STAGE / args.attempt
out.mkdir(exist_ok=False)


def now():
    return datetime.now(timezone.utc).isoformat()


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def write(name, data):
    with (out / name).open('x') as stream:
        json.dump(data, stream, indent=2)
        stream.write('\n')


def inputs():
    paths = set()
    # Raw hashes of original inputs are integrity work only. No original game
    # payload, source oracle or runtime is interpreted by this runner.
    for directory in ['src', 'reference', 'tests/fixtures', 'tests/helpers', 'content']:
        for path in (ROOT / directory).rglob('*'):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc':
                paths.add(path)
    names = ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html',
             '.openai/hosting.json', 'migration/v6-transfer-map.json',
             'scripts/export-v6-branch-routing-reference.py', 'scripts/audit-v6-entry-points.ts',
             'scripts/audit-v6-migration.py', 'scripts/prepare-python.mjs',
             'scripts/python-runtime-assets.json', 'scripts/generate-content-pages.mjs',
             'scripts/generate-game-gallery.mjs']
    names += [word for word in spec['argv'] if word.startswith('tests/')]
    paths.update(ROOT / name for name in names)
    paths.update([PLAN, Path(__file__).resolve()])
    return {path.relative_to(ROOT).as_posix(): sha(path) for path in sorted(paths)}


before = inputs()
write('inputs-before.json', before)
record = {'schema': 'logos-engine.lot8b.common-functional-command.v1', 'status': 'running',
          'kind': args.kind, 'command': spec['argv'], 'timeoutSeconds': spec['timeoutSeconds'],
          'startedAt': now(), 'cwd': str(ROOT),
          'headBefore': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
          'inputCount': len(before), 'globalLockAcquired': False, 'officialPerformanceMeasurement': False,
          'gameExecution': False, 'gameReplay': False, 'published': False}
write('declaration.json', record)
print(json.dumps({'started': args.kind, 'attempt': args.attempt, 'timeoutSeconds': spec['timeoutSeconds']}), flush=True)
start = time.monotonic()
with (out / 'output.raw.log').open('xb') as stream:
    child = subprocess.Popen(spec['argv'], cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT,
                             start_new_session=True)
    try:
        code = child.wait(timeout=spec['timeoutSeconds'])
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
        code = 124
        record['timedOut'] = True
raw = (out / 'output.raw.log').read_bytes()
compressed = out / 'output.log.gz'
with compressed.open('xb') as stream:
    stream.write(gzip.compress(raw, mtime=0))
after = inputs()
write('inputs-after.json', after)
record.update(finishedAt=now(), elapsedSeconds=time.monotonic() - start, exitCode=code,
              inputsUnchanged=before == after,
              changedInputPaths=sorted(p for p in set(before) | set(after) if before.get(p) != after.get(p)),
              log={'path': compressed.relative_to(ROOT).as_posix(), 'bytes': compressed.stat().st_size,
                   'sha256': sha(compressed)})
record['testCounts'] = {name: int(value) for name, value in re.findall(
    r'^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)\s*$', raw.decode(errors='replace'), re.M)}
record['status'] = 'passed' if code == 0 and before == after else 'failed'
record['outputs'] = []
for name in spec.get('outputs', []):
    path = ROOT / name
    files = sorted(p for p in path.rglob('*') if p.is_file()) if path.is_dir() else [path]
    record['outputs'] += [{'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}
                          for p in files if p.is_file()]
write('receipt.json', record)
print(json.dumps({key: record[key] for key in ['status', 'kind', 'exitCode', 'elapsedSeconds', 'inputsUnchanged', 'testCounts']}), flush=True)
if record['status'] != 'passed':
    print(raw.decode(errors='replace')[-20000:], flush=True)
raise SystemExit(0 if record['status'] == 'passed' else 1)
