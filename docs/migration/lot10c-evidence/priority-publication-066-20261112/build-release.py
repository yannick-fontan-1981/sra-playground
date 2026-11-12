"""Fresh 0.66 publication build with retained input fingerprints; no performance run."""
from pathlib import Path
from datetime import datetime, timezone
import gzip, hashlib, json, os, signal, subprocess, sys, time

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
now = lambda: datetime.now(timezone.utc).isoformat()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def fp(p):
    return {'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}
def write_new(name, value):
    with (OUT / name).open('x') as f:
        json.dump(value, f, indent=2); f.write('\n')
profiles = ['src', 'tests', 'scripts', 'public', 'content', 'migration', 'reference', '.openai', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html']
paths = sorted(set(p for p in subprocess.check_output(['git', 'ls-files', '-z', '--', *profiles], cwd=ROOT).decode().split('\0') if p))
assets = json.loads((ROOT / 'scripts/python-runtime-assets.json').read_text())['files']
paths = sorted(set(paths + ['public/vendor/pyodide/' + entry['file'] for entry in assets]))
inputs = lambda: {p: sha(ROOT / p) for p in paths}
before = inputs()
frozen = json.loads((ROOT / 'docs/migration/lot10c-evidence/recovery-20261111/composed-functional02/source-manifest.json').read_text())
assert frozen['fileCount'] == 329 and frozen['digest'] == 'ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316'
assert all(sha(ROOT / p) == value for p, value in frozen['files'].items())
write_new('build-inputs.json', {'files': before, 'count': len(before), 'nativeSource': frozen, 'recordedAt': now()})
commands = [
    ('entry-audit', ['node', 'scripts/audit-v6-entry-points.ts']),
    ('migration-audit', [sys.executable, '-B', 'scripts/audit-v6-migration.py']),
    ('build', ['node', '/home/agent/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/scripts/build-site.mjs']),
]
record = {'schema': 'logos-engine.lot10c.priority066-build.v1', 'startedAt': now(), 'cwd': str(ROOT), 'nativeFileCount': 329, 'nativeDigest': frozen['digest'], 'inputFileCount': len(before), 'globalLockAcquired': False, 'performanceMeasurement': False, 'functionalTestsRerun': False, 'checks': []}
try:
    for name, command in commands:
        step = {'name': name, 'command': command, 'startedAt': now(), 'childTimeoutSeconds': 180, 'terminationGraceSeconds': 5}
        start = time.monotonic()
        log_path = OUT / (name + '.raw.log')
        with log_path.open('xb') as log:
            child = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                code = child.wait(timeout=180)
            except subprocess.TimeoutExpired:
                step['timedOut'] = True
                os.killpg(child.pid, signal.SIGTERM)
                try: child.wait(timeout=5)
                except subprocess.TimeoutExpired: os.killpg(child.pid, signal.SIGKILL); child.wait()
                code = 124
            except BaseException:
                os.killpg(child.pid, signal.SIGTERM)
                try: child.wait(timeout=5)
                except subprocess.TimeoutExpired: os.killpg(child.pid, signal.SIGKILL); child.wait()
                raise
        packed = OUT / (name + '.log.gz')
        with packed.open('xb') as f: f.write(gzip.compress(log_path.read_bytes(), mtime=0))
        step.update(exitCode=code, elapsedSeconds=time.monotonic()-start, finishedAt=now(), childTerminal=True, log=fp(packed))
        record['checks'].append(step)
        print(json.dumps({'name': name, 'exitCode': code, 'elapsedSeconds': step['elapsedSeconds']}), flush=True)
        if code != 0: raise RuntimeError(name + ' failed; retained raw log')
    record['inputEqualityAfter'] = inputs() == before
    record['nativeInputEqualityAfter'] = all(sha(ROOT / p) == value for p, value in frozen['files'].items())
    workers = list((ROOT / 'dist/assets').glob('v6-agent-worker-*.js'))
    record['nativeWorker'] = [fp(p) for p in workers]
    record['native066InWorker'] = len(workers) == 1 and b'logos-engine.typescript.v6.native-migration/0.66.0' in workers[0].read_bytes()
    record['outputFiles'] = [fp(p) for p in sorted((ROOT / 'dist').rglob('*')) if p.is_file()]
    assert record['inputEqualityAfter'] and record['nativeInputEqualityAfter'] and record['native066InWorker']
    record['status'] = 'passed'
except BaseException as error:
    record.update(status='failed', error=type(error).__name__ + ': ' + str(error))
    raise
finally:
    record['finishedAt'] = now()
    write_new('build-execution.json', record)
    print(json.dumps({k: record.get(k) for k in ['status', 'inputEqualityAfter', 'nativeInputEqualityAfter', 'native066InWorker']}), flush=True)
