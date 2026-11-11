#!/usr/bin/env python3
"""Run one declared command and retain a durable start, output and terminal receipt.

This evidence wrapper does not alter a command, retry a failure, or run a game.
Use an exclusive new output stem, a timeout and an explicit argv after --.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]


def stamp():
    return datetime.now(timezone.utc).isoformat()


def fingerprint(path):
    data = path.read_bytes()
    try:
        name = path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        name = str(path.resolve())
    return {'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stem', required=True)
    parser.add_argument('--cwd', type=Path, default=ROOT)
    parser.add_argument('--timeout', type=float, required=True)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command or not 0 < args.timeout <= 3600:
        parser.error('An explicit command and timeout in (0, 3600] are required')
    stem = (ROOT / args.stem).resolve()
    stem.relative_to(ROOT / 'docs/migration/lot5c-evidence')
    stem.parent.mkdir(parents=True, exist_ok=True)
    receipt_path, log_path = Path(str(stem) + '.execution.json'), Path(str(stem) + '.log')
    compressed_path = Path(str(log_path) + '.gz')
    if any(path.exists() for path in [receipt_path, log_path, compressed_path]):
        raise FileExistsError('An evidence output already exists: ' + str(stem))
    receipt = {'schema': 'logos-engine.lot5c.command-execution.v1', 'status': 'running',
               'startedAt': stamp(), 'command': command, 'cwd': str(args.cwd.resolve()),
               'timeoutSeconds': args.timeout, 'wrapper': fingerprint(Path(__file__))}
    with receipt_path.open('x') as stream:
        json.dump(receipt, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    start = time.monotonic()
    timed_out = False
    with log_path.open('xb') as output:
        process = subprocess.Popen(command, cwd=args.cwd, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            returncode = process.wait(timeout=args.timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(process.pid, signal.SIGTERM)
            try:
                returncode = process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                returncode = process.wait()
        output.flush(); os.fsync(output.fileno())
    with log_path.open('rb') as source, compressed_path.open('xb') as destination:
        with gzip.GzipFile(filename='', mode='wb', fileobj=destination, mtime=0) as compressed:
            while chunk := source.read(1 << 20):
                compressed.write(chunk)
    receipt.update(status='passed' if returncode == 0 and not timed_out else 'failed',
                   finishedAt=stamp(), durationSeconds=time.monotonic() - start,
                   exitCode=returncode, timedOut=timed_out,
                   log=fingerprint(log_path), compressedLog=fingerprint(compressed_path))
    receipt_path.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({key: receipt[key] for key in ['status', 'exitCode', 'timedOut', 'durationSeconds']}
                     | {'receipt': receipt_path.relative_to(ROOT).as_posix()}), flush=True)
    raise SystemExit(0 if receipt['status'] == 'passed' else 1)


if __name__ == '__main__':
    main()
