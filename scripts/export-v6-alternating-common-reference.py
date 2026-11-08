#!/usr/bin/env python3
"""Whole unchanged common-adapter envelopes for the graph access contracts.

This development oracle uses controlled public raster responses from the access
oracle. It neither runs a game nor replaces a source planner. Every returned
ancestor event remains present; native inherited coverage is assessed explicitly.
"""
from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from common_coupled_support import CoupledSupportConstraint


def plain(value):
    if isinstance(value, dict): return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value


def main():
    inputs = ROOT / 'tests/fixtures/v6-alternating-graph-access-reference.json.gz'
    oracle = json.loads(gzip.decompress(inputs.read_bytes()))
    journals = []
    for original in oracle['journals']:
        family = CoupledSupportConstraint()
        initial = original['initialState']
        events = oracle['states'][initial]['events'] if initial else []
        for event in events:
            family.memory.apply_event(copy.deepcopy(event))
            family.events.append(copy.deepcopy(event))
        journal = {'id': original['id'], 'initialState': initial, 'steps': []}
        for step in original['steps']:
            before, after = oracle['scenes'][step['before']], oracle['scenes'][step['after']]
            args = copy.deepcopy([before['observation'], after['observation'], step['command'],
                before['rows'], after['rows'], step['proposal'], step['index']])
            frames = copy.deepcopy(after['public']['frame_packet'])
            untouched = copy.deepcopy([args, frames])
            result = family.record(*args, frames=frames)
            assert [args, frames] == untouched
            journal['steps'].append({'expected': plain(result), 'state': plain(family.state())})
        journals.append(journal)
    manifest = json.loads((ROOT / 'reference/v6' / COMMIT / 'manifest.json').read_text())
    source_hashes = {}
    for module in list(sys.modules.values()):
        value = getattr(module, '__file__', None)
        if not value: continue
        path = Path(value).resolve()
        if path.suffix != '.py' or not path.is_relative_to(SOURCE): continue
        relative = str(path.relative_to(SOURCE))
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        assert manifest['files'][relative]['sha256'] == digest
        source_hashes[relative] = digest
    result = {'schema': 'logos-engine.v6.alternating-common-oracle.v1', 'sourceCommit': COMMIT,
        'sourceModified': False, 'sourceHashes': dict(sorted(source_hashes.items())),
        'inputFixture': str(inputs.relative_to(ROOT)), 'inputSha256': hashlib.sha256(inputs.read_bytes()).hexdigest(),
        'qualification': 'Complete unchanged CoupledSupportConstraint.record envelopes. Synthetic public contracts are not a solved game. The native closure digest does not claim full inherited source parity.',
        'journals': journals}
    target = ROOT / 'tests/fixtures/v6-alternating-common-reference.json.gz'
    with target.open('wb') as raw:
        with gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as stream:
            stream.write(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())
    print(json.dumps({'journals': len(journals), 'records': sum(len(j['steps']) for j in journals),
        'eventKinds': sorted({e['kind'] for j in journals for s in j['steps'] for e in s['expected']['events']}),
        'bytes': target.stat().st_size}))


if __name__ == '__main__': main()
