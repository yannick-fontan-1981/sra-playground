#!/usr/bin/env python3
"""Read only retained initial public rasters; never import or execute a game.

The plan is written before any source measurement. All excluded case clocks
remain untouched. Results select possible experiments, not production rules.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
import gzip
import hashlib
import json
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
OUT = ROOT / 'docs/migration/lot3i-evidence/diagnostic'
CORPUS = ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
EXCLUDED = ['CWSE', 'SK48', 'FOGW', 'VOIS', 'WEAV']
def now(): return datetime.now(timezone(timedelta(hours=-3))).isoformat()
def sha(data): return hashlib.sha256(data).hexdigest()
def fp(path): return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path.read_bytes())}
def verify():
    files = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    for name, item in files.items(): assert sha((SOURCE / name).read_bytes()) == item['sha256'], name
    return len(files)

def main():
    corpus = json.loads(gzip.decompress(CORPUS.read_bytes()))
    selected = [item for item in corpus['games'] if item['game'] not in EXCLUDED]
    OUT.mkdir(parents=True, exist_ok=True)
    plan = {'schema': 'logos-engine.lot3i.initial-public-scan-plan.v1', 'recordedAt': now(),
        'sourceCommit': COMMIT, 'corpus': fp(CORPUS), 'maximumViews': 95,
        'selectedViews': len(selected), 'excludedGames': EXCLUDED,
        'selectedGames': [item['game'] for item in selected],
        'sourceOperations': ['common_repeated_lines.fields', 'common_supported_lines.SupportedLineConstraint.propose'],
        'commandsRead': False, 'gameExecution': False,
        'scope': 'Retained initial canonical public rasters only, exclusions before source calls. Cold own memory, zero actual actions, no game engine/spec/solution, no clock restart.'}
    with (OUT / 'initial-public-scan-plan.json').open('x') as stream: json.dump(plan, stream, indent=2)
    assert len(selected) <= plan['maximumViews']
    before = verify()
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from common_repeated_lines import fields
    from common_supported_lines import SupportedLineConstraint
    config = {'prepare_supported_lines': True, 'supported_line_reply_plies': 6}
    started, clock = now(), time.monotonic()
    results = []
    for item in selected:
        rows = item['packet']['frame_rows']; observation = item['observation']
        inputs = [{'action_ref': action} for action in observation['available_action_refs'] if action != 'ACTION6']
        result = {'game': item['game'], 'frameHash': item['packet']['frame_hash']}
        try:
            measured = fields(rows)
            proposal = SupportedLineConstraint().propose(observation, rows, inputs, 1, config)
            result.update(fields=measured, proposal=proposal)
        except Exception as error:
            result['sourceException'] = {'type': type(error).__name__, 'message': str(error)}
        results.append(result)
    assert verify() == before == 1786
    output = {'schema': 'logos-engine.lot3i.initial-public-scan.v1', 'startedAt': started, 'finishedAt': now(),
        'elapsedSeconds': time.monotonic() - clock, 'plan': fp(OUT / 'initial-public-scan-plan.json'),
        'generator': fp(Path(__file__)), 'sourceFilesVerifiedBeforeAfter': before, 'sourceModified': False,
        'actualActions': 0, 'gameExecution': False, 'results': results,
        'proposingGames': [item['game'] for item in results if item.get('proposal')]}
    path = OUT / 'initial-public-scan.json.gz'
    with path.open('xb') as stream: stream.write(gzip.compress(json.dumps(output, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'views': len(results), 'proposingGames': output['proposingGames'],
        'measuredGames': [[item['game'], len(item.get('fields', []))] for item in results if item.get('fields')],
        'exceptions': [item['game'] for item in results if 'sourceException' in item], 'output': fp(path)}))

if __name__ == '__main__': main()
