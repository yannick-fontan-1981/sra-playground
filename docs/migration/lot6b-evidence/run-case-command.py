#!/usr/bin/env python3
"""Execute one bounded case task and retain every outcome in its cumulative clock.

The caller holds the shared functional lock. This wrapper neither selects a
game action nor supplies state to the command. A timeout terminates the entire
child process group and preserves its log, journal and unsuccessful receipt.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse, gzip, hashlib, json, os, signal, subprocess, sys, time

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent

def local(value):
    result = (ROOT / value).resolve()
    result.relative_to(ROOT)
    return result

def fp(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}

def instant():
    return datetime.now(timezone.utc).isoformat()

def group_exists(pid):
    try:
        os.killpg(pid, 0)
        return True
    except ProcessLookupError:
        return False

def signal_group(pid, value):
    try:
        os.killpg(pid, value)
        return True
    except ProcessLookupError:
        return False

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--clock', required=True)
    parser.add_argument('--label', required=True)
    parser.add_argument('--limit-seconds', type=float, required=True)
    parser.add_argument('--receipt', required=True)
    parser.add_argument('--watch-manifest', required=True)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command or not 0 < args.limit_seconds <= 600:
        raise ValueError('An explicit command and a bound of at most 600 seconds are required')
    clock_path, receipt_path, manifest_path = map(local, [args.clock, args.receipt, args.watch_manifest])
    previous = json.loads(clock_path.read_text())
    if previous['active'] is not None or previous['remainingSeconds'] < args.limit_seconds + 20:
        raise ValueError('No sufficient inactive cumulative case allowance remains')
    log_path = receipt_path.with_suffix('.log')
    zipped_path = receipt_path.with_suffix('.log.gz')
    if any(path.exists() for path in [receipt_path, log_path, zipped_path]):
        raise FileExistsError('A case execution receipt or log already exists')
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    inputs = {row['path']: row for row in map(fp, [Path(__file__), BASE / 'case-clock.py', manifest_path])}
    manifest = json.loads(manifest_path.read_text())
    files = manifest.get('files', manifest)
    if not files:
        raise ValueError('An immutable input inventory is required')
    for name, expected in files.items():
        row = fp(local(name))
        if row['sha256'] != (expected if isinstance(expected, str) else expected['sha256']):
            raise ValueError('Frozen input changed: ' + name)
        inputs[name] = row
    clock_tool = [sys.executable, '-B', str(BASE / 'case-clock.py')]
    subprocess.run([*clock_tool, 'start', str(clock_path), '--label', args.label], check=True, cwd=ROOT)
    started, timer = instant(), time.monotonic()
    child = None
    timed_out = False
    interrupted = None
    exit_code = None
    group_reaped = False
    orphan_group_terminated = False
    try:
        with log_path.open('xb') as stream:
            child = subprocess.Popen(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                exit_code = child.wait(timeout=args.limit_seconds)
            except subprocess.TimeoutExpired:
                timed_out = True
                signal_group(child.pid, signal.SIGTERM)
                try:
                    exit_code = child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    signal_group(child.pid, signal.SIGKILL)
                    exit_code = child.wait(timeout=5)
    except BaseException as error:
        interrupted = {'type': type(error).__name__, 'message': str(error)}
        if child is not None and child.poll() is None:
            signal_group(child.pid, signal.SIGKILL)
            exit_code = child.wait(timeout=5)
    finally:
        # A completed wrapper process alone does not prove that its descendants
        # have stopped. Do not leave an orphaned game or reader running outside
        # the retained interval.
        if child is not None:
            if group_exists(child.pid):
                orphan_group_terminated = signal_group(child.pid, signal.SIGKILL)
                deadline = time.monotonic() + 2
                while group_exists(child.pid) and time.monotonic() < deadline:
                    time.sleep(0.05)
            group_reaped = child.poll() is not None and not group_exists(child.pid)
        else:
            group_reaped = True
        finished, elapsed = instant(), time.monotonic() - timer
        close = subprocess.run([*clock_tool, 'stop', str(clock_path)], cwd=ROOT, capture_output=True, text=True)
        current = json.loads(clock_path.read_text())
        unchanged = all(fp(local(name)) == row for name, row in inputs.items())
        with zipped_path.open('xb') as target, gzip.GzipFile(filename='', mode='wb', fileobj=target, mtime=0) as out:
            if log_path.exists():
                with log_path.open('rb') as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                        out.write(chunk)
        passed = (exit_code == 0 and not timed_out and interrupted is None and unchanged
                  and close.returncode == 0 and group_reaped and not orphan_group_terminated)
        receipt = {'schema': 'logos-engine.lot6b.bounded-case-command.v1',
                   'status': 'passed' if passed else 'failed', 'command': command, 'case': current['case'],
                   'label': args.label, 'startedAt': started, 'finishedAt': finished, 'elapsedSeconds': elapsed,
                   'limitSeconds': args.limit_seconds, 'timedOut': timed_out, 'exitCode': exit_code,
                   'interruption': interrupted, 'childProcessGroupReaped': group_reaped,
                   'orphanProcessGroupTerminated': orphan_group_terminated,
                   'inputs': list(inputs.values()), 'inputsUnchanged': unchanged, 'output': fp(zipped_path),
                   'caseClock': fp(clock_path), 'chargedInterval': current['intervals'][-1],
                   'chargedSeconds': current['chargedSeconds'], 'remainingSeconds': current['remainingSeconds'],
                   'clockCloseExitCode': close.returncode,
                   'qualification': 'One actual bounded task, including failed or timed out work, charged to the same cumulative case clock. Existing logs and physical public journals are retained; no outcome is reclassified.'}
        with receipt_path.open('x') as stream:
            json.dump(receipt, stream, indent=2)
            stream.write('\n')
        print(json.dumps({key: receipt[key] for key in ['status', 'case', 'label', 'elapsedSeconds', 'exitCode', 'timedOut', 'chargedSeconds', 'remainingSeconds']}), flush=True)
    raise SystemExit(0 if passed else 1)

if __name__ == '__main__':
    main()
