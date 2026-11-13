#!/usr/bin/env python3
"""Snapshot witnessed public returns and replay a bounded unchanged caller.

This development diagnostic imports no native agent and has no game host. The
existing original-caller replay returns a saved outcome only after an exact
command match and stops on its first different command. No replay state or
decision is fed to the native caller.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
REPLAYER = ROOT / 'scripts/replay-v6-original-public-caller.py'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def proof(path):
    data = path.read_bytes()
    return {'path': str(path), 'bytes': len(data), 'sha256': sha(data)}


def packed(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode() + b'\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--journal', type=Path, required=True)
    parser.add_argument('--native-manifest', type=Path, required=True)
    parser.add_argument('--output-directory', type=Path, required=True)
    parser.add_argument('--work-root', type=Path, required=True)
    parser.add_argument('--max-returns', type=int, default=16)
    parser.add_argument('--timeout', type=float, default=120)
    args = parser.parse_args()
    if not 1 <= args.max_returns <= 64 or not 1 <= args.timeout <= 300:
        parser.error('This diagnostic is bounded to 1..64 returns and 1..300 seconds')
    out = args.output_directory.resolve()
    out.mkdir(parents=True, exist_ok=False)
    manifest = json.loads(args.native_manifest.read_bytes())
    raw = args.journal.read_bytes()
    complete_end = raw.rfind(b'\n') + 1
    if not complete_end:
        raise ValueError('No complete public journal line')
    snapshot = raw[:complete_end]
    lines = snapshot.splitlines()
    journal_copy = out / 'actual-public-journal-snapshot.jsonl.gz'
    journal_copy.write_bytes(gzip.compress(snapshot, mtime=0))
    selected = lines[:args.max_returns + 1]
    packets = [json.loads(line) for line in selected]
    if not packets or packets[0]['command'] is not None:
        raise ValueError('The retained prefix must start with the actual initial observation')
    for index, item in enumerate(packets):
        if item['packet']['step_index'] != index or (index and item['command'] is None):
            raise ValueError('The retained public prefix is not contiguous')
        if item['packet']['frame_packet'][-1] != item['packet']['frame_rows']:
            raise ValueError('The final animation frame must equal the canonical public raster')
    trace = out / 'bounded-public-trace.json.gz'
    trace_bytes = packed({'schema': 'logos-engine.native-public-game-trace.v1',
                         'sourceDigest': manifest['digest'], 'status': 'retained_public_prefix_only',
                         'packets': packets})
    trace.write_bytes(gzip.compress(trace_bytes, mtime=0))
    invocation = [sys.executable, str(REPLAYER), '--trace', str(trace),
                  '--work-root', str(args.work_root.resolve()), '--output-prefix', str(out / 'original'),
                  '--timeout', str(args.timeout)]
    record = {
        'schema': 'logos-engine.v53.original-outline-caller-public-prefix.v1',
        'qualification': 'Read-only replay of already witnessed complete public packets. Commands must match exactly before an outcome is returned. No game implementation, host action, native state injection or success claim.',
        'generator': proof(Path(__file__).resolve()), 'replayer': proof(REPLAYER),
        'nativeSourceManifest': proof(args.native_manifest.resolve()),
        'nativeSourceDigest': manifest['digest'],
        'journalInput': {'path': str(args.journal.resolve()), 'bytesRead': len(raw),
                         'completeBytes': len(snapshot), 'incompleteTrailingBytesNotReadAsPackets': len(raw) - complete_end,
                         'completeSnapshotSha256': sha(snapshot), 'completePublicPackets': len(lines)},
        'journalSnapshot': proof(journal_copy), 'boundedTrace': proof(trace),
        'boundedTraceUncompressedSha256': sha(trace_bytes),
        'retainedPublicReturns': len(packets) - 1, 'bounds': {'maxReturns': args.max_returns, 'wallSeconds': args.timeout},
        'hostActionsExecuted': 0, 'nativeDecisionsExecuted': 0, 'stateInjectedIntoNative': 0,
        'command': invocation,
    }
    (out / 'input-manifest.json').write_bytes(packed(record))
    with (out / 'replay-output.log').open('xb') as output:
        result = subprocess.run(invocation, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
    collision = out / 'original-collision.json'
    record['replayProcessExitCode'] = result.returncode
    record['replayOutput'] = proof(out / 'replay-output.log')
    if collision.exists():
        summary = json.loads(collision.read_bytes())
        record['collisionReport'] = proof(collision)
        record['matchedActions'] = summary['matchedActions']
        record['stop'] = summary['stop']
    (out / 'execution.json').write_bytes(packed(record))
    print(json.dumps({key: record.get(key) for key in ('retainedPublicReturns', 'matchedActions', 'stop', 'replayProcessExitCode')}, indent=2), flush=True)
    return result.returncode


if __name__ == '__main__':
    raise SystemExit(main())
