#!/usr/bin/env python3
"""Retain completed logs as deterministic, byte-verified gzip transport."""
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import json
from pathlib import Path
import sys

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]

def fp(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}

def retain(path):
    original = path.read_bytes()
    target = path.with_name(path.name + '.gz')
    if not target.exists():
        with target.open('xb') as stream:
            stream.write(gzip.compress(original, mtime=0))
    assert gzip.decompress(target.read_bytes()) == original, str(path)
    return {'original': fp(path), 'transport': fp(target), 'byteIdentical': True}

def main():
    assert sys.argv[1:] in [['pre-window'], ['cost-window']]
    mode = sys.argv[1]
    destination = BASE / ('pre-window-log-transport.json' if mode == 'pre-window' else 'performance/log-transport.json')
    if destination.exists():
        raise FileExistsError(destination)
    receipt = {'schema': 'logos-engine.lossless-log-transport.v1', 'status': 'passed',
               'recordedAt': datetime.now(timezone(timedelta(hours=-3))).isoformat(),
               'generator': fp(Path(__file__).resolve()), 'mode': mode}
    if mode == 'pre-window':
        assert not (BASE / 'performance/window.json').exists()
        receipt['logs'] = [retain(path) for path in sorted(BASE.rglob('*.log'))]
    else:
        window = BASE / 'performance/window.json'
        value = json.loads(window.read_text())
        assert value['status'] == value['finalIntegrity'] == 'passed'
        assert [row['label'] for row in value['executions']] == ['A1', 'B1', 'B2', 'A2']
        receipt['window'] = fp(window)
        receipt['logs'] = []
        for row in value['executions']:
            assert row['status'] == 'passed' and row['exitCode'] == 0
            path = Path(row['log'])
            assert fp(path)['sha256'] == row['logSha256']
            receipt['logs'].append({'series': row['label'], **retain(path)})
    receipt['qualification'] = 'Completed original logs remain available and unchanged. Deterministic gzip transport is decompressed and compared byte for byte; no log is truncated or filtered.'
    with destination.open('x') as stream:
        stream.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'logs': len(receipt['logs']), 'receipt': fp(destination)}))

if __name__ == '__main__':
    main()
