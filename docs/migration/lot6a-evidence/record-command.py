#!/usr/bin/env python3
"""Retain one actual command, full output, elapsed time and immutable inputs.

This wrapper does not select or retry commands. Callers supply the exact argv.
Every receipt/log is created exclusively, including on a failed subprocess.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse, gzip, hashlib, json, subprocess, time

ROOT = Path(__file__).resolve().parents[3]

def fp(path):
    data = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def main():
    p = argparse.ArgumentParser(); p.add_argument('--receipt', type=Path, required=True)
    p.add_argument('--watch-manifest', type=Path); p.add_argument('command', nargs=argparse.REMAINDER)
    a = p.parse_args(); command = a.command[1:] if a.command[:1] == ['--'] else a.command
    if not command: raise ValueError('An explicit argument vector is required')
    receipt = (ROOT / a.receipt).resolve(); receipt.relative_to(ROOT); receipt.parent.mkdir(parents=True, exist_ok=True)
    log = receipt.with_suffix('.log.gz'); raw = receipt.with_suffix('.log')
    if any(x.exists() for x in (receipt, log, raw)): raise FileExistsError('Execution output already exists')
    inputs = {str(Path(__file__).relative_to(ROOT)): fp(Path(__file__))}
    if a.watch_manifest:
        manifest = (ROOT / a.watch_manifest).resolve(); inputs[str(manifest.relative_to(ROOT))] = fp(manifest)
        value = json.loads(manifest.read_bytes()); files = value.get('files', value)
        for name, expected in files.items():
            record = fp((ROOT / name).resolve())
            digest = expected if isinstance(expected, str) else expected['sha256']
            if record['sha256'] != digest: raise ValueError('Frozen input changed: ' + name)
            inputs[name] = record
    started = datetime.now(timezone.utc).isoformat(); clock = time.monotonic()
    with raw.open('xb') as stream:
        child = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
    elapsed = time.monotonic() - clock
    with log.open('xb') as stream: stream.write(gzip.compress(raw.read_bytes(), mtime=0))
    unchanged = all(fp((ROOT / name).resolve()) == record for name, record in inputs.items())
    result = {'schema': 'logos-engine.actual-command-execution.v1',
              'status': 'passed' if child.returncode == 0 and unchanged else 'failed',
              'command': command, 'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(),
              'elapsedSeconds': elapsed, 'exitCode': child.returncode, 'inputs': list(inputs.values()),
              'inputsUnchanged': unchanged, 'output': fp(log)}
    with receipt.open('x') as stream: json.dump(result, stream, indent=2); stream.write('\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'inputs'}), flush=True)
    raise SystemExit(0 if result['status'] == 'passed' else 1)

if __name__ == '__main__': main()
