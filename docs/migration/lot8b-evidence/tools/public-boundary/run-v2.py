#!/usr/bin/env python3
"""Bound one declared public-boundary capture or read-only qualification.

This supervisor owns only its child process group. It acquires no lock, changes
no production input, and retains failed attempts and complete output verbatim.
"""
import argparse
from datetime import datetime, timezone
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
BASE = ROOT / 'docs/migration/lot8b-evidence/public-boundary-01'
TOOLS = ROOT / 'docs/migration/lot8b-evidence/tools/public-boundary'


def now():
    return datetime.now(timezone.utc).isoformat()


def fingerprint(path):
    path = Path(path)
    sha = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            sha.update(block)
    return {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size,
            'sha256': sha.hexdigest()}


def write_new(path, value):
    with path.open('x', encoding='utf8') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kind', required=True, choices=('capture', 'qualify', 'probe'))
    parser.add_argument('--attempt', required=True)
    parser.add_argument('--capture-dir')
    args = parser.parse_args()
    assert re.fullmatch(r'[a-z0-9-]+', args.attempt)
    declaration_path = BASE / 'declaration-v2.json'
    frozen_path = BASE / 'preflight-v2.json'
    frozen = json.loads(frozen_path.read_text())
    assert frozen['status'] == 'ready_for_bounded_functional_capture'
    attempt = BASE / args.attempt
    attempt.mkdir(exist_ok=False)
    if args.kind in ('capture', 'probe'):
        script = 'capture-v2.mjs' if args.kind == 'capture' else 'probe-terminal.mjs'
        command = ['node', str(TOOLS / script), '--output', str(attempt / args.kind),
                   '--declaration', str(declaration_path)]
        deadline = 390 if args.kind == 'capture' else 90
        assert args.capture_dir is None
    else:
        assert args.capture_dir
        capture_dir = (ROOT / args.capture_dir).resolve()
        assert capture_dir.is_relative_to(BASE) and capture_dir.is_dir()
        command = ['node', str(TOOLS / 'qualify-v2.mjs'), '--capture', str(capture_dir),
                   '--output', str(attempt / 'review')]
        deadline = 180
    paths = sorted({item['path'] for item in frozen['inputs']}
                   | {str(frozen_path.relative_to(ROOT))})

    def inventory(tolerate_errors=False):
        rows = []
        for path in paths:
            try:
                rows.append(fingerprint(ROOT / path))
            except OSError as error:
                if not tolerate_errors:
                    raise
                rows.append({'path': path, 'error': {'type': type(error).__name__,
                                                   'message': str(error)}})
        return rows

    before = inventory()
    record = {'schema': 'logos-engine.lot8b.public-functional-command.v1',
              'kind': args.kind, 'command': command, 'cwd': str(ROOT),
              'startedAt': now(), 'timeoutSeconds': deadline,
              'status': 'running', 'globalLockAcquired': False,
              'officialPerformanceMeasurement': False, 'publicationPerformed': False,
              'headBefore': subprocess.check_output(['git', 'rev-parse', 'HEAD'],
                                                    cwd=ROOT, text=True).strip(),
              'inputsBefore': before, 'supervisorPid': os.getpid()}
    write_new(attempt / 'declaration.json', record)
    output = attempt / 'output.log'
    child = None
    started = time.monotonic()

    def interrupted(signum, _frame):
        raise InterruptedError(f'Owned functional operation interrupted: {signum}')

    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, interrupted)
    print(json.dumps({'started': args.kind, 'attempt': args.attempt,
                      'timeoutSeconds': deadline}), flush=True)
    try:
        actual = {row['path']: row for row in before}
        for expected in frozen['inputs']:
            assert actual[expected['path']] == expected, expected['path']
        with output.open('xb') as stream:
            child = subprocess.Popen(command, cwd=ROOT, stdout=stream,
                                     stderr=subprocess.STDOUT, start_new_session=True)
            record['childPid'] = child.pid
            last_update = started
            while child.poll() is None:
                remaining = deadline - (time.monotonic() - started)
                if remaining <= 0:
                    raise TimeoutError('Declared functional deadline exceeded')
                try:
                    child.wait(timeout=min(5, remaining))
                except subprocess.TimeoutExpired:
                    pass
                if child.poll() is None and time.monotonic() - last_update >= 30:
                    print(json.dumps({'running': args.kind,
                                      'elapsedSeconds': round(time.monotonic() - started, 2)}), flush=True)
                    last_update = time.monotonic()
        record['exitCode'] = child.returncode
    except BaseException as error:
        record['error'] = {'type': type(error).__name__, 'message': str(error)}
        record['exitCode'] = 124 if isinstance(error, TimeoutError) else 1
        with output.open('ab') as stream:
            stream.write(traceback.format_exc().encode())
    finally:
        for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            signal.signal(sig, signal.SIG_IGN)
        if child is not None and child.poll() is None:
            cleanup_errors = []
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            except OSError as error:
                cleanup_errors.append(str(error))
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except OSError as error:
                    cleanup_errors.append(str(error))
                try:
                    child.wait(timeout=5)
                except (OSError, subprocess.TimeoutExpired) as error:
                    cleanup_errors.append(str(error))
            except OSError as error:
                cleanup_errors.append(str(error))
            record['childTerminatedBySupervisor'] = True
            record['cleanupErrors'] = cleanup_errors
        record['childExited'] = child is None or child.poll() is not None
        record['inputsAfter'] = inventory(tolerate_errors=True)
        record['inputsUnchanged'] = record['inputsBefore'] == record['inputsAfter']
        try:
            record['headAfter'] = subprocess.check_output(['git', 'rev-parse', 'HEAD'],
                                                         cwd=ROOT, text=True).strip()
        except (OSError, subprocess.CalledProcessError) as error:
            record['headAfter'] = None
            record['headReadError'] = str(error)
        record['headUnchanged'] = record['headBefore'] == record['headAfter']
        record['output'] = fingerprint(output)
        record['finishedAt'] = now()
        record['elapsedSeconds'] = time.monotonic() - started
        record['status'] = ('passed' if record.get('exitCode') == 0
                            and record['childExited'] and record['inputsUnchanged']
                            and not record.get('cleanupErrors')
                            and record['headUnchanged'] else 'failed')
        write_new(attempt / 'receipt.json', record)
    print(json.dumps({key: record[key] for key in
                      ('kind', 'status', 'exitCode', 'elapsedSeconds', 'inputsUnchanged', 'headUnchanged')}), flush=True)
    return 0 if record['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
