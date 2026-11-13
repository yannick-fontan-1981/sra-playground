#!/usr/bin/env python3
"""Original owner contracts on the retained initial public CRAF raster.

No game executes here. The unchanged initial public raster is used because the
complete native strategy genuinely elects Symbols on it. The unchanged-raster
return below is explicitly controlled, not an asserted game response.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
CORPUS = ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
OUT = ROOT / 'tests/fixtures/v6-symbol-kernel-reference.json.gz'
sys.dont_write_bytecode = True
CACHE = tempfile.TemporaryDirectory(prefix='symbol-kernel-oracle-')
sys.pycache_prefix = CACHE.name
def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value
def main():
    manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    def verify():
        for name, record in manifest.items(): assert sha(SOURCE / name) == record['sha256'], name
    verify()
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from neutral_observer import measure
    from observed_input_domain import ObservedInputDomain
    from agents.yf_arc3_v6.morphology_policy.symbol_transactions.family import SymbolTransactions
    corpus = json.loads(gzip.decompress(CORPUS.read_bytes()))
    assert corpus['actions'] == corpus['levelJumps'] == 0 and corpus['sourceCommit'] == COMMIT
    view = next(v for v in corpus['games'] if v['game'] == 'CRAF')
    public = copy.deepcopy(view['packet']); rows = copy.deepcopy(public['frame_rows'])
    assert public['levels_completed'] == public['step_index'] == 0
    session_id = 'symbols:public-kernel'
    observation = measure(SimpleNamespace(**public), 1, session_id)[0]
    policy = json.loads((SOURCE / 'agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json').read_text())
    inputs = ObservedInputDomain(policy['input_domain']['max_point_occurrences']).candidates(observation)
    owner = SymbolTransactions(); proposal = owner.propose(observation, rows, inputs, 16)
    assert proposal and proposal['kind'] == 'public_symbol_transaction'
    after_propose = plain(owner.state()); before_current = owner.before(proposal, 0, SimpleNamespace(**public), observation)
    assert before_current['admitted'] is True
    returned_public = {**copy.deepcopy(public), 'step_index': 1}
    returned_observation = measure(SimpleNamespace(**returned_public), 2, session_id)[0]
    event = owner.record(observation, returned_observation, copy.deepcopy(proposal['actions'][0]), rows, rows, proposal, 0)
    after_record = plain(owner.state()); owner.restore(copy.deepcopy(after_record))
    next_proposal = owner.propose(returned_observation, rows, inputs, 15)
    assert next_proposal is None
    imported = {}
    for module in list(sys.modules.values()):
        file = getattr(module, '__file__', None)
        if not file: continue
        path = Path(file).resolve()
        if path.is_relative_to(SOURCE) and path.is_file():
            relative = path.relative_to(SOURCE).as_posix(); imported[relative] = sha(path)
            assert imported[relative] == manifest[relative]['sha256']
    verify()
    result = {'schema': 'logos-engine.v6.symbol-kernel-reference.v1', 'referenceCommit': COMMIT,
        'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': sha(__file__)},
        'sourceFilesVerifiedBeforeAndAfter': len(manifest), 'sourceHashes': dict(sorted(imported.items())), 'sourceModified': False,
        'corpus': {'path': CORPUS.relative_to(ROOT).as_posix(), 'sha256': sha(CORPUS), 'game': 'CRAF'},
        'scope': {'gameExecutions': 0, 'dispatchedActions': 0, 'privateStatesRead': 0, 'suppliedAcquiredStates': 0,
                  'originalOwnStateRoundTrips': 1, 'actualPublicInitialRasters': 1, 'controlledUnchangedReturns': 1},
        'kernelPublic': {'qualification': 'Actual initial public raster with an explicitly controlled unchanged return. The normal native factory must independently select the owner; this is no game-success claim.',
            'sessionId': session_id, 'rows': rows, 'observation': observation, 'public': public, 'inputs': inputs,
            'remaining': 16, 'proposal': proposal, 'afterProposeState': after_propose, 'beforeCurrent': before_current,
            'noEffectObservation': returned_observation, 'noEffectPublic': returned_public, 'noEffectReturn': event,
            'noEffectState': after_record, 'postRefutationProposal': next_proposal}}
    OUT.write_bytes(gzip.compress((json.dumps(plain(result), sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode(), mtime=0))
    print(json.dumps({'sourceFilesVerified': len(manifest), 'gameExecutions': 0, 'action': proposal['actions'][0],
                      'before': before_current, 'event': event['status'], 'nextProposal': next_proposal,
                      'path': OUT.relative_to(ROOT).as_posix(), 'sha256': sha(OUT)}))
if __name__ == '__main__': main()
