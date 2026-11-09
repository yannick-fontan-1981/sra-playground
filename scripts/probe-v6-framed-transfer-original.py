#!/usr/bin/env python3
"""Run unchanged FramedTransfer alone against an opaque public host.

This isolated component coordinator is not the full original strategic caller
or Kernel authorization. It uses a fresh component and public observations.
"""
from __future__ import annotations
import argparse
import copy
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import time
from types import SimpleNamespace
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
LAYA = SOURCE / 'agents/yf_arc3_v6/laya_proto'

def hashed(raw): return hashlib.sha256(raw).hexdigest()
def verify_source_manifest():
    entries = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    for relative, item in entries.items():
        assert hashed((SOURCE / relative).read_bytes()) == item['sha256'], relative
    return {relative: item['sha256'] for relative, item in sorted(entries.items())}

VERIFIED_PINNED_SOURCE = verify_source_manifest()
sys.path[:0] = [str(SOURCE), str(LAYA)]
from agents.yf_arc3_v6.morphology_policy.framed_transfer.family import FramedTransfer
from agents.yf_arc3_v6.morphology_policy.framed_transfer import geometry
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain

def plain(value):
    if isinstance(value, dict): return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (tuple, list)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value

def source_hashes():
    paths = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module, '__file__', None)}
    paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/framed_transfer').glob('framed.*'))
    result = {}
    for path in paths:
        if not path.is_relative_to(SOURCE) or not path.is_file(): continue
        relative = str(path.relative_to(SOURCE)); result[relative] = hashed(path.read_bytes())
        assert VERIFIED_PINNED_SOURCE[relative] == result[relative], relative
    return dict(sorted(result.items()))

def packet(engine, index):
    rows = engine['frame']
    return {'frame_rows': rows, 'frame_packet': engine['frames'], 'level': engine['level'],
            'levels_completed': engine['levelsCompleted'], 'state': engine['state'], 'step_index': index,
            'available_action_refs': [f'ACTION{value}' for value in engine['availableActionIds']],
            'frame_hash': hashed(json.dumps(rows, separators=(',', ':')).encode())[:16]}

def state(family):
    return plain(family.state())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--game', default='GARE'); parser.add_argument('--levels', type=int, default=3)
    parser.add_argument('--output', default='tests/fixtures/v6-framed-transfer-original-public.json.gz')
    args = parser.parse_args()
    if args.levels < 1: raise ValueError('positive target required')
    destination = ROOT / args.output
    if destination.exists(): raise FileExistsError(destination)
    verified_before = source_hashes()
    family = FramedTransfer()
    policy = family.policy.config
    result = {'schema': 'logos-engine.v6.framed-transfer-original-public.v1', 'sourceCommit': COMMIT,
              'policy': policy, 'game': args.game, 'targetLevels': args.levels, 'sessionCount': 1,
              'manualPrimingActions': 0, 'resets': 0, 'levelJumps': 0,
              'scope': 'Unchanged original FramedTransfer provider through an isolated component coordinator. Not original full common caller selection or Kernel authorization.',
              'providerOrder': ['FramedTransfer.propose'],
              'fullOriginalCaller': False, 'frontierEnabled': False,
              'startedAt': datetime.now(timezone.utc).isoformat(), 'status': 'running',
              'packets': [], 'prefixes': [], 'boundaries': [], 'requests': [],
              'budget': {'levelActions': 120, 'levelSeconds': 180, 'targetLevels': args.levels}}
    def persist():
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    with tempfile.TemporaryDirectory(prefix='framed-transfer-public-host-') as temporary:
        host = Path(temporary)
        for name in ('custom-games.zip', 'official-games.zip'):
            with zipfile.ZipFile(ROOT / 'public/python' / name) as archive: archive.extractall(host)
        for name in ('game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py'):
            shutil.copy(ROOT / 'public/python' / name, host / name)
        sys.path.insert(0, temporary)
        import game_bridge
        def send(kind, **values):
            request = {'type': kind, **values}; result['requests'].append(copy.deepcopy(request))
            returned = json.loads(game_bridge.dispatch(json.dumps(request)))
            if 'error' in returned: raise RuntimeError(returned['error'])
            return returned
        current = packet(send('load', code=args.game, level=1), 0)
        result['initialState'] = state(family)
        domain = ObservedInputDomain(4096)
        observation, _ = measure(SimpleNamespace(**current), 1, 'framed-transfer-reference')
        result['initialScene'] = {'offers': plain(geometry.candidates(current['frame_rows'], observation, family.policy, [], [], {}))}
        result['packets'].append({'command': None, 'packet': plain(current), 'observation': plain(observation)})
        actions = level_actions = 0; level_deadline = time.perf_counter() + result['budget']['levelSeconds']
        for cycle in range(360):
            if level_actions >= result['budget']['levelActions'] or time.perf_counter() >= level_deadline:
                result.update(status='stopped', reason='declared_component_budget'); break
            inputs = domain.candidates(observation)
            before_planning = state(family)
            proposal = family.propose(observation, current['frame_rows'], inputs,
                                      result['budget']['levelActions'] - level_actions)
            print(json.dumps({'phase': 'original_component_proposal', 'cycle': cycle, 'actions': actions,
                              'levelsCompleted': current['levels_completed'], 'kind': proposal.get('kind') if proposal else None}), flush=True)
            if not proposal:
                result.update(status='stopped', reason='framed_transfer_component_abstained'); break
            assert proposal['status'] == 'proposed' and proposal['actions']
            unbound = copy.deepcopy(proposal)
            family.bind(proposal, domain)
            prefix = {'selectedProvider': 'framed_transfer', 'unboundProposal': unbound,
                      'proposal': copy.deepcopy(proposal), 'beforeState': before_planning,
                      'afterPlanningState': state(family), 'steps': []}
            result['prefixes'].append(prefix)
            for index, command in enumerate(proposal['actions']):
                guard = family.before(proposal, index, SimpleNamespace(**current), observation)
                if not guard['admitted']:
                    result.update(status='stopped', reason='before_guard_refused'); break
                before, first = observation, current
                returned = send('action', actionId=int(command['action_ref'][6:]), data=command.get('data'))
                actions += 1; level_actions += 1; current = packet(returned, actions)
                observation, _ = measure(SimpleNamespace(**current), actions + 1, 'framed-transfer-reference')
                outcome = family.after(proposal, index, before, observation, first['frame_rows'], current['frame_rows'])
                acquired = family.record(before, observation, command, first['frame_rows'], current['frame_rows'], proposal, index)
                result['packets'].append({'command': plain(command), 'packet': plain(current), 'observation': plain(observation)})
                prefix['steps'].append({'index': index, 'actionIndex': actions, 'command': plain(command),
                                        'beforeGuard': plain(guard), 'outcome': plain(outcome), 'acquired': plain(acquired),
                                        'afterState': state(family)})
                if observation['levels_completed'] > before['levels_completed']:
                    result['boundaries'].append({'levelsCompleted': observation['levels_completed'], 'actions': actions, 'levelActions': level_actions})
                    print(json.dumps({'phase': 'completed_level', **result['boundaries'][-1]}), flush=True)
                    level_actions = 0; level_deadline = time.perf_counter() + result['budget']['levelSeconds']
                result.update(actions=actions, levelsCompleted=current['levels_completed'], state=current['state']); persist()
                if observation['levels_completed'] >= result['targetLevels']:
                    result.update(status='passed', reason='target_levels_completed'); break
                if current['state'] in ('WIN', 'GAME_OVER'):
                    result.update(status='passed' if current['state'] == 'WIN' else 'stopped', reason='official_' + current['state'].lower()); break
                if outcome.get('seal_prefix'): break
            if result['status'] != 'running': break
        else: result.update(status='stopped', reason='component_cycle_limit')
        result.update(actions=actions, levelsCompleted=current['levels_completed'], state=current['state'], finalState=state(family))
    verified_after = source_hashes()
    assert all(verified_after.get(path) == value for path, value in verified_before.items())
    assert verify_source_manifest() == VERIFIED_PINNED_SOURCE
    result.update(sourceModified=False, sourceHashes=verified_after, pinnedSourceFilesVerifiedBeforeImport=len(VERIFIED_PINNED_SOURCE), pinnedSourceFilesVerifiedAfterCampaign=len(VERIFIED_PINNED_SOURCE),
                  importedSourceModuleCount=sum(name.endswith('.py') for name in verified_after),
                  explicitPolicyFileCount=sum(not name.endswith('.py') for name in verified_after),
                  finishedAt=datetime.now(timezone.utc).isoformat(), generator=str(Path(__file__).relative_to(ROOT)),
                  generatorSha256=hashed(Path(__file__).read_bytes()),
                  gameAssetHashes={name: hashed((ROOT / 'public/python' / name).read_bytes()) for name in ('custom-games.zip', 'official-games.zip', 'game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py')})
    persist()
    print(json.dumps({'output': str(destination.relative_to(ROOT)), **{key: result[key] for key in ('status', 'reason', 'actions', 'levelsCompleted', 'state', 'boundaries')}, 'prefixes': len(result['prefixes']), 'verifiedSourceFiles': len(verified_after)}), flush=True)

if __name__ == '__main__': main()
