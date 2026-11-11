#!/usr/bin/env python3
"""Retain all four completed cost logs as exact deterministic gzip transport.

Usage: python -B docs/migration/lot6b-evidence/record-cost-log-transport.py
       docs/migration/lot6b-evidence/performance-integrated
No measurement, comparison, exclusion or verdict is changed by this command.
"""
# Directly adapted from docs/migration/lot5b-evidence/record-cost-log-transport.py.
# Only 6B location/provenance metadata changes; transport bytes and checks are unchanged.
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fingerprint(path):
    path = path.resolve()
    require(path.is_relative_to(ROOT), 'Log evidence must stay inside this checkout')
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    directory = args.directory.resolve()
    require(directory.is_relative_to(BASE), 'Expected a lot6B performance directory')
    output = directory / 'log-transport.json'
    if output.exists():
        raise FileExistsError(output)
    window_path = directory / 'window.json'
    window = json.loads(window_path.read_text())
    require(window['status'] == window['finalIntegrity'] == 'passed', 'Cost window is incomplete')
    require([row['label'] for row in window['executions']] == ['A1', 'B1', 'B2', 'A2'],
            'Expected all four predeclared series in their actual order')
    original_window = fingerprint(window_path)
    logs = []
    for row in window['executions']:
        require(row['status'] == 'passed' and row['exitCode'] == 0, 'A cost series did not complete')
        path = Path(row['log']).resolve()
        require(path.is_relative_to(directory), 'The cost log belongs to another window')
        original = fingerprint(path)
        require(original['sha256'] == row['logSha256'], 'Original cost log differs from the window')
        data = path.read_bytes()
        target = path.with_name(path.name + '.gz')
        if not target.exists():
            with target.open('xb') as stream:
                stream.write(gzip.compress(data, mtime=0))
        require(gzip.decompress(target.read_bytes()) == data, 'Compressed log is not byte-identical')
        require(fingerprint(path) == original, 'Original cost log changed during transport')
        logs.append({'series': row['label'], 'original': original,
                     'transport': fingerprint(target), 'byteIdentical': True})
    require(fingerprint(window_path) == original_window, 'Window changed during transport')
    receipt = {'schema': 'logos-engine.lossless-log-transport.v1', 'status': 'passed',
               'recordedAt': datetime.now(timezone.utc).isoformat(),
               'generator': fingerprint(Path(__file__)), 'mode': 'cost-window',
               'adaptedFrom': fingerprint(ROOT / 'docs/migration/lot5b-evidence/record-cost-log-transport.py'),
               'window': original_window, 'logs': logs,
               'qualification': 'All completed original logs remain available and unchanged. '
                   'Deterministic gzip transport is decompressed and compared byte for byte. '
                   'No log, sample or diagnostic is truncated, filtered or excluded.'}
    with output.open('x') as stream:
        json.dump(receipt, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'status': 'passed', 'logs': len(logs), 'receipt': fingerprint(output)}))


if __name__ == '__main__':
    main()
