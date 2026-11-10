#!/usr/bin/env python3
"""Find cold SymbolTransactions offers in retained public initial observations.

This reads the unchanged 100-game public raster corpus. It imports no game
engine or private state, supplies no acquired method, and dispatches no action.
All eligible scenes and all refusals are retained before choosing a live case.
"""
from __future__ import annotations
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
CORPUS = ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
OUT = ROOT / 'docs/migration/lot7b-evidence/candidate-selection.json'
sys.dont_write_bytecode = True
BYTECODE = tempfile.TemporaryDirectory(prefix='symbols-candidate-')
sys.pycache_prefix = BYTECODE.name

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value
def verify():
    files = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    for name, record in files.items(): assert sha(SOURCE / name) == record['sha256'], name
    return {name: record['sha256'] for name, record in sorted(files.items())}
def main():
    if OUT.exists(): raise FileExistsError(OUT)
    started = datetime.now(timezone.utc).isoformat()
    verified = verify()
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from agents.yf_arc3_v6.morphology_policy.symbol_transactions.family import SymbolTransactions, holds
    from agents.yf_arc3_v6.morphology_policy.symbol_transactions.geometry import project
    from agents.yf_arc3_v6.laya_proto.observed_input_domain import ObservedInputDomain
    policy = json.loads((SOURCE / 'agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json').read_text())
    corpus = json.loads(gzip.decompress(CORPUS.read_bytes()))
    assert corpus['sourceCommit'] == COMMIT and corpus['actions'] == corpus['levelJumps'] == 0
    assert len(corpus['games']) == 100
    results = []
    for view in corpus['games']:
        tick = time.monotonic()
        packet, observation = view['packet'], view['observation']
        rows = packet['frame_rows']
        assert packet['step_index'] == packet['levels_completed'] == 0
        raster_hash = hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()
        assert raster_hash[:16] == packet['frame_hash']
        result = {'game': view['game'], 'observationRef': observation['observation_ref'], 'frameSha256': raster_hash,
                  'initialLevel': packet['level'], 'levelsCompleted': 0, 'proposal': None, 'error': None}
        owner = SymbolTransactions()
        try:
            inputs = ObservedInputDomain(policy['input_domain']['max_point_occurrences']).candidates(observation)
            measured = project(observation, rows, inputs, owner.config, 0)
            result.update(inputCount=len(inputs), guideContext=plain(measured['context']) if measured else None,
                          guideActive=bool(measured and holds(owner.config['activation'], measured['context'])))
            result['proposal'] = plain(owner.propose(observation, rows, inputs, 1))
            result['sourceState'] = plain(owner.state())
            result['srcCalls'] = owner.src_calls
        except Exception as error:
            result['error'] = {'type': type(error).__name__, 'message': str(error)}
        result['elapsedSeconds'] = time.monotonic() - tick
        results.append(result)
    imported = {}
    for module in list(sys.modules.values()):
        file = getattr(module, '__file__', None)
        if not file: continue
        path = Path(file).resolve()
        if path.is_relative_to(SOURCE) and path.is_file():
            relative = path.relative_to(SOURCE).as_posix(); imported[relative] = sha(path)
            assert imported[relative] == verified[relative], relative
    assert verify() == verified
    candidates = [r['game'] for r in results if r['proposal'] is not None]
    output = {'schema': 'logos-engine.lot7b.public-initial-candidate-selection.v1', 'sourceCommit': COMMIT,
              'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(),
              'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': sha(__file__)},
              'sourceFilesVerifiedBeforeAndAfter': len(verified), 'importedSourceHashes': dict(sorted(imported.items())),
              'corpus': {'path': CORPUS.relative_to(ROOT).as_posix(), 'sha256': sha(CORPUS), 'views': len(results)},
              'scope': {'gameExecutions': 0, 'privateStatesRead': 0, 'dispatchedActions': 0, 'levelJumps': 0,
                        'coldOriginalOwners': len(results), 'acquisitionCalls': 0, 'suppliedAcquiredMethods': 0},
              'results': results, 'candidateGames': candidates,
              'selectionCriterion': 'Retain every actual cold original source proposal on the complete pinned initial public corpus. The game label is report metadata and never participates in the solver.',
              'qualification': 'Initial source admissibility is a case-selection diagnostic; it establishes neither production caller selection nor successful game execution.'}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'views': len(results), 'candidates': candidates, 'sourceFilesVerified': len(verified),
                      'errors': [{'game': r['game'], 'error': r['error']} for r in results if r['error']],
                      'actions': 0, 'path': OUT.relative_to(ROOT).as_posix()}))
if __name__ == '__main__': main()
