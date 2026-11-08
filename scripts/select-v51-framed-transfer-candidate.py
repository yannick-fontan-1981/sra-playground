#!/usr/bin/env python3
"""Measure framed-transfer geometry on retained public initial rasters only."""
from __future__ import annotations
import gzip
import hashlib
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
LAYA = SOURCE / 'agents/yf_arc3_v6/laya_proto'
CORPUS = ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
OUT = ROOT / 'docs/migration/native-campaigns-v51'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    files = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    for name, entry in files.items(): assert sha(SOURCE / name) == entry['sha256'], name
    return {name: entry['sha256'] for name, entry in sorted(files.items())}
def plain(value):
    if isinstance(value, dict): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value
def main():
    verified = verify(); sys.path[:0] = [str(SOURCE), str(LAYA)]
    from agents.yf_arc3_v6.morphology_policy.framed_transfer.geometry import candidates
    from agents.yf_arc3_v6.morphology_policy.framed_transfer.policy import FramedPolicy
    policy = FramedPolicy()
    corpus = json.loads(gzip.decompress(CORPUS.read_bytes()))
    assert corpus['sourceCommit'] == COMMIT and corpus['actions'] == corpus['levelJumps'] == 0
    assert len(corpus['games']) == 100
    results = []
    for view in corpus['games']:
        packet = view['packet']; rows = packet['frame_rows']
        assert packet['step_index'] == packet['levels_completed'] == 0
        raster_hash = hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()
        assert raster_hash[:16] == packet['frame_hash']
        offers = candidates(rows, view['observation'], policy, [], [], {})
        eligible = []
        for offer in offers:
            matches = [key for key in policy.config['priority'] if policy.holds(policy.projections[key]['all_conditions'], offer['facts']) and policy.holds(policy.config['local_conditions'], offer['facts']) and policy.holds(policy.config.get('projection_scope_conditions', {}).get(key, []), offer['facts'])]
            if matches: eligible.append({'candidateRef': offer['candidate_ref'], 'projections': matches})
        results.append({'game': view['game'], 'observation_ref': view['observation']['observation_ref'],
                        'frameDigest': raster_hash, 'offers': plain(offers), 'eligible': eligible})
    source_hashes = {}
    for module in list(sys.modules.values()):
        file = getattr(module, '__file__', None)
        if not file: continue
        path = Path(file).resolve()
        if path.is_relative_to(SOURCE) and path.is_file():
            relative = str(path.relative_to(SOURCE)); source_hashes[relative] = sha(path)
            assert source_hashes[relative] == verified[relative]
    assert verify() == verified
    candidate_games = [r['game'] for r in results if r['eligible']]
    audit_path = ROOT / 'docs/migration/v6-entry-point-progress.json'; audit = json.loads(audit_path.read_text())
    entry = next(e for g in audit['groups'] if g['id'] == 'factored_material_return' for e in g['entries'] if e['question'] == 'observed_framed_transfer')
    assert entry['status'] == 'pending'
    result = {'schema': 'logos-engine.v51.readonly-candidate-selection.v1', 'sourceCommit': COMMIT,
        'sourceFilesVerifiedBeforeAndAfter': len(verified), 'sourceHashes': dict(sorted(source_hashes.items())),
        'generator': {'path': str(Path(__file__).relative_to(ROOT)), 'sha256': sha(Path(__file__))},
        'corpus': {'path': str(CORPUS.relative_to(ROOT)), 'sha256': sha(CORPUS), 'views': len(results), 'actions': 0, 'levelJumps': 0},
        'entryAudit': {'path': str(audit_path.relative_to(ROOT)), 'sha256': sha(audit_path), 'implementation': audit['implementation'], 'entry': entry},
        'executionScope': {'gameHostsLoaded': 0, 'gameExecutions': 0, 'agentProposals': 0, 'acquisitionCalls': 0, 'dispatchedActions': 0, 'privateStatesRead': 0},
        'sourceFunctionsCalled': ['framed_transfer.geometry.candidates (empty acquired memories)', 'framed_transfer.policy.FramedPolicy.holds (declarative eligibility only)'],
        'results': results, 'selection': {'entry': 'observed_framed_transfer', 'candidateGames': candidate_games,
        'evaluationGame': candidate_games[0] if len(candidate_games) == 1 else None,
        'criterion': 'Current mutually supported parallel bands and declared eligibility, with empty acquired spans and replacement records; all eligible games retained without selection by game code.',
        'status': 'candidate_only_no_executed_action_or_level_completion',
        'nextTarget': 'Transfer framed support measurement, actual point-motion and replacement acquisition, current rebinding and conditional reception/analogy in the common graph; then evaluate cold continuous candidate games.'}}
    OUT.mkdir(parents=True, exist_ok=True)
    destination = OUT / 'framed-transfer-candidate-selection.json'
    if destination.exists(): raise FileExistsError(destination)
    destination.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'views': len(results), 'candidates': candidate_games, 'sourceFilesVerified': len(verified), 'actions': 0}))
if __name__ == '__main__': main()
