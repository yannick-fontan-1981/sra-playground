#!/usr/bin/env python3
"""Execute one predeclared 9A functional command, retaining every attempt."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import traceback

ROOT = Path(__file__).resolve().parents[4]
BASE = ROOT / 'docs/migration/lot9a-evidence'
DECLARATION = BASE / 'integration-declaration.json'


def now():
    return datetime.now(timezone.utc).isoformat()


def fingerprint(path):
    raw = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(raw),
            'sha256': hashlib.sha256(raw).hexdigest()}


def save(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kind', required=True)
    args = parser.parse_args()
    declaration = json.loads(DECLARATION.read_text())
    spec = declaration['commands'][args.kind]
    history = BASE / 'integration-runs'
    history.mkdir(exist_ok=True)
    previous = sorted(history.glob(args.kind + '-*'))
    assert len(previous) < spec['maximumAttempts'], 'Declared launch bound reached'
    assert all((item / 'receipt.json').is_file() for item in previous), 'Prior operation has no terminal receipt'
    spent = sum(json.loads((item / 'receipt.json').read_text())['elapsedSeconds'] for item in previous)
    deadline = min(spec['timeoutSeconds'], spec['maximumAttempts'] * spec['timeoutSeconds'] - spent)
    assert deadline > 0, 'Declared cumulative deadline exhausted'
    attempt = history / f'{args.kind}-{len(previous) + 1:02d}'
    attempt.mkdir(exist_ok=False)
    paths = {DECLARATION, Path(__file__).resolve()}
    for pattern in declaration['inputCapture']:
        paths.update(p for p in ROOT.glob(pattern) if p.is_file())
    paths = sorted(paths)

    def inventory():
        return [fingerprint(path) if path.is_file() else {'path': str(path.relative_to(ROOT)), 'missing': True}
                for path in paths]

    record = {'schema': 'logos-engine.lot9a.functional-command.v1',
              'kind': args.kind, 'attempt': len(previous) + 1, 'command': spec['command'],
              'cwd': str(ROOT), 'startedAt': now(), 'timeoutSeconds': deadline,
              'priorCumulativeSeconds': spent, 'inputsBefore': inventory(),
              'headBefore': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
              'globalLockAcquired': False, 'officialPerformanceMeasurement': False,
              'publicationPerformed': False, 'status': 'running'}
    save(attempt / 'declaration.json', record)
    output = attempt / 'output.log'
    started = time.monotonic()
    child = None

    def interrupted(signum, _frame):
        raise InterruptedError(f'Owned command interrupted: {signum}')

    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, interrupted)
    print(json.dumps({'started': args.kind, 'attempt': record['attempt'], 'timeoutSeconds': deadline}), flush=True)
    try:
        with output.open('xb') as stream:
            child = subprocess.Popen(spec['command'], cwd=ROOT, stdout=stream,
                                     stderr=subprocess.STDOUT, start_new_session=True)
            record['childPid'] = child.pid
            last_update = started
            while child.poll() is None:
                remaining = deadline - (time.monotonic() - started)
                if remaining <= 0:
                    raise TimeoutError('Declared command deadline reached')
                try:
                    child.wait(timeout=min(5, remaining))
                except subprocess.TimeoutExpired:
                    pass
                if child.poll() is None and time.monotonic() - last_update >= 25:
                    print(json.dumps({'running': args.kind, 'elapsedSeconds': round(time.monotonic() - started, 2)}), flush=True)
                    last_update = time.monotonic()
        record['exitCode'] = child.returncode
    except BaseException as error:
        record['exitCode'] = 124 if isinstance(error, TimeoutError) else 1
        record['error'] = {'type': type(error).__name__, 'message': str(error)}
        with output.open('ab') as stream:
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
            record['childTerminatedBySupervisor'] = True
        record['childExited'] = child is None or child.poll() is not None
        record['inputsAfter'] = inventory()
        record['inputsUnchanged'] = record['inputsBefore'] == record['inputsAfter']
        record['headAfter'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        record['headUnchanged'] = record['headBefore'] == record['headAfter']
        record['elapsedSeconds'] = time.monotonic() - started
        record['cumulativeSeconds'] = spent + record['elapsedSeconds']
        record['finishedAt'] = now()
        record['output'] = fingerprint(output)
        record['status'] = 'passed' if record['exitCode'] == 0 and record['childExited'] and record['inputsUnchanged'] and record['headUnchanged'] else 'failed'
        save(attempt / 'receipt.json', record)
    print(json.dumps({key: record[key] for key in ('kind', 'status', 'exitCode', 'elapsedSeconds', 'inputsUnchanged', 'headUnchanged')}), flush=True)
    return 0 if record['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
