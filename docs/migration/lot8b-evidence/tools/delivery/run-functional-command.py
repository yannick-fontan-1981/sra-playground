#!/usr/bin/env python3
"""Run one predeclared functional command with immutable inputs and retained output."""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time
import traceback

ROOT = Path(__file__).resolve().parents[5]
STAGE = ROOT / 'docs/migration/lot8b-evidence/delivery-qualification-01'


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    value = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def file_info(path):
    path = Path(path)
    return {'path': str(path), 'bytes': path.stat().st_size, 'sha256': digest(path)}


def dump(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True)
    parser.add_argument('--key', required=True)
    parser.add_argument('--attempt', required=True)
    args = parser.parse_args()
    assert re.fullmatch(r'[a-z0-9-]+', args.attempt)
    plan_path = (ROOT / args.plan).resolve()
    plan = json.loads(plan_path.read_text())
    assert plan['schema'] == 'logos-engine.lot8b.functional-execution-plan.v1'
    spec = plan['commands'][args.key]
    assert 1 <= spec['timeoutSeconds'] <= 1200
    attempt = STAGE / args.attempt
    attempt.mkdir(exist_ok=False)
    replacements = {'{attempt}': str(attempt), '{root}': str(ROOT),
                    '{baseline}': plan['baselineCheckout']}

    def expand(value):
        for marker, replacement in replacements.items():
            value = value.replace(marker, replacement)
        return value

    command = [expand(arg) for arg in spec['argv']]
    declared = {str((ROOT / entry['path']).resolve()): entry['sha256']
                for entry in plan['inputFiles']}
    dependencies = [str((ROOT / expand(path)).resolve()) for path in spec.get('dependencies', [])]
    paths = sorted(set(declared) | set(dependencies) | {str(plan_path), str(Path(__file__).resolve())})

    def inventory():
        return {path: digest(path) if Path(path).is_file() else None for path in paths}

    before = inventory()
    dump(attempt / 'inputs-before.json', before)
    record = {'schema': 'logos-engine.lot8b.functional-command.v1', 'key': args.key,
              'attempt': args.attempt, 'plan': file_info(plan_path), 'command': command,
              'cwd': str(ROOT), 'startedAt': now(), 'timeoutSeconds': spec['timeoutSeconds'],
              'headBefore': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
              'globalLockAcquired': False, 'officialPerformanceMeasurement': False,
              'gameEngineExecuted': False, 'published': False, 'status': 'running'}
    dump(attempt / 'declaration.json', record)
    print(json.dumps({'started': args.key, 'attempt': args.attempt,
                      'timeoutSeconds': spec['timeoutSeconds']}), flush=True)
    child = None
    start = time.monotonic()
    raw_path = attempt / 'output.raw.log'

    def interrupted(signum, _frame):
        raise InterruptedError(f'Functional command interrupted by signal {signum}')

    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, interrupted)
    try:
        assert all(value is not None for value in before.values()), 'Declared input is missing'
        mismatches = [path for path, expected in declared.items() if before[path] != expected]
        assert not mismatches, f'Frozen inputs changed: {mismatches}'
        environment = dict(os.environ)
        environment.update(spec.get('environment', {}))
        with raw_path.open('xb') as stream:
            child = subprocess.Popen(command, cwd=ROOT, env=environment, stdout=stream,
                                     stderr=subprocess.STDOUT, start_new_session=True)
            last_update = start
            while child.poll() is None:
                elapsed = time.monotonic() - start
                if elapsed >= spec['timeoutSeconds']:
                    record['timedOut'] = True
                    raise TimeoutError('Declared functional command deadline exceeded')
                try:
                    child.wait(timeout=min(10, spec['timeoutSeconds'] - elapsed))
                except subprocess.TimeoutExpired:
                    pass
                if child.poll() is None and time.monotonic() - last_update >= 30:
                    print(json.dumps({'running': args.key,
                                      'elapsedSeconds': round(time.monotonic() - start, 2)}), flush=True)
                    last_update = time.monotonic()
        record['exitCode'] = child.returncode
    except BaseException as error:
        record['error'] = {'type': type(error).__name__, 'message': str(error)}
        record['exitCode'] = 124 if isinstance(error, TimeoutError) else 1
        with raw_path.open('ab') as stream:
            stream.write(traceback.format_exc().encode())
    finally:
        for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            signal.signal(sig, signal.SIG_IGN)
        if child is not None and child.poll() is None:
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                child.wait(timeout=5)
        after = inventory()
        dump(attempt / 'inputs-after.json', after)
        compressed = attempt / 'output.log.gz'
        with compressed.open('xb') as stream:
            stream.write(gzip.compress(raw_path.read_bytes(), mtime=0))
        record.update(finishedAt=now(), elapsedSeconds=time.monotonic() - start,
                      inputsUnchanged=before == after,
                      changedInputPaths=[path for path in paths if before[path] != after[path]],
                      log=file_info(compressed), childProcessReaped=child is None or child.poll() is not None)
        record['status'] = 'passed' if record['exitCode'] == 0 and before == after else 'failed'
        exclusions = {'declaration.json', 'inputs-before.json', 'inputs-after.json',
                      'output.raw.log', 'output.log.gz', 'receipt.json'}
        record['outputs'] = [file_info(path) for path in sorted(attempt.rglob('*'))
                             if path.is_file() and path.name not in exclusions]
        dump(attempt / 'receipt.json', record)
        print(json.dumps({key: record[key] for key in ['status', 'key', 'exitCode',
                         'elapsedSeconds', 'inputsUnchanged', 'childProcessReaped']}), flush=True)
        if record['status'] != 'passed':
            print(raw_path.read_text(errors='replace')[-12000:], flush=True)
    return 0 if record['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
