#!/usr/bin/env python3
"""Run the unchanged isolated rooted-quota component against an opaque host.

Only public bridge load/action returns are read. Every command is proposed by
the pinned original component; no reset, manual priming or game source read.
This establishes component capability, never original full-caller selection.
"""
from __future__ import annotations
import copy
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
sys.path[:0] = [str(SOURCE), str(LAYA)]
from common_rooted_quota import RootedQuotaConstraint
from rooted_quota_access import RootedQuotaAccess
from service_transfer_access import ServiceTransferAccess
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain


def plain(value):
    if isinstance(value, dict): return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (tuple, list)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value


def hashed(raw): return hashlib.sha256(raw).hexdigest()


def source_hashes():
    manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    paths = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module, '__file__', None)}
    paths.add(SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm')
    result = {}
    for path in paths:
        if not path.is_relative_to(SOURCE) or not path.is_file(): continue
        relative = str(path.relative_to(SOURCE))
        result[relative] = hashed(path.read_bytes())
        assert manifest[relative]['sha256'] == result[relative], relative
    return dict(sorted(result.items()))


def packet(engine, index):
    rows = engine['frame']
    return {'frame_rows': rows, 'frame_packet': engine['frames'], 'level': engine['level'],
            'levels_completed': engine['levelsCompleted'], 'state': engine['state'], 'step_index': index,
            'available_action_refs': [f'ACTION{value}' for value in engine['availableActionIds']],
            'frame_hash': hashed(json.dumps(rows, separators=(',', ':')).encode())[:16]}


def state(memory):
    return {'projection': plain({key: getattr(memory, key) for key in ('quota_events', 'quota_model', 'quota_context', 'requested_stop_reason')}),
            'parentDigest': ServiceTransferAccess.retained_digest(memory), 'digest': RootedQuotaAccess.retained_digest(memory)}


def main():
    verified_before = source_hashes()
    policy = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']['window_constraints']['rooted_quota_composition']
    result = {'schema': 'logos-engine.v6.rooted-quota-original-public.v1', 'sourceCommit': COMMIT,
              'policy': policy, 'game': 'THER', 'targetLevels': 3, 'sessionCount': 1, 'manualPrimingActions': 0,
              'scope': 'Unchanged isolated original rooted-quota component; not original full common caller selection.',
              'status': 'running', 'packets': [], 'prefixes': [], 'boundaries': [],
              'budget': {'levelActions': 120, 'levelSeconds': 360, 'targetLevels': 3}}
    with tempfile.TemporaryDirectory(prefix='rooted-quota-public-host-') as temporary:
        host = Path(temporary)
        for name in ('custom-games.zip', 'official-games.zip'):
            with zipfile.ZipFile(ROOT / 'public/python' / name) as archive: archive.extractall(host)
        for name in ('game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py'):
            shutil.copy(ROOT / 'public/python' / name, host / name)
        sys.path.insert(0, temporary)
        import game_bridge
        def send(kind, **values):
            value = json.loads(game_bridge.dispatch(json.dumps({'type': kind, **values})))
            if 'error' in value: raise RuntimeError(value['error'])
            return value
        current = packet(send('load', code='THER', level=1), 0)
        family = RootedQuotaConstraint()
        result['initialState'] = state(family.memory)
        domain = ObservedInputDomain(4096)
        observation, _ = measure(SimpleNamespace(**current), 1, 'rooted-quota-reference')
        result['packets'].append({'command': None, 'packet': plain(current), 'observation': plain(observation)})
        actions = 0
        level_actions = 0
        family.level_deadline = time.perf_counter() + result['budget']['levelSeconds']
        for cycle in range(360):
            if level_actions >= result['budget']['levelActions'] or time.perf_counter() >= family.level_deadline:
                result.update(status='stopped', reason='declared_component_budget'); break
            inputs = domain.candidates(observation)
            proposal = family.rooted_propose(observation, current['frame_rows'], inputs,
                                             result['budget']['levelActions'] - level_actions, policy)
            print(json.dumps({'phase': 'original_component_proposal', 'cycle': cycle, 'actions': actions,
                              'levelsCompleted': current['levels_completed'], 'kind': proposal.get('kind') if proposal else None}), flush=True)
            if not proposal:
                result.update(status='stopped', reason='rooted_component_abstained'); break
            assert proposal['kind'] == 'rooted_quota_experiment'
            family.bind(proposal, domain)
            prefix = {'proposal': copy.deepcopy(proposal), 'beforeState': state(family.memory), 'steps': []}
            result['prefixes'].append(prefix)
            for index, command in enumerate(proposal['actions']):
                guard = family.before(proposal, index, SimpleNamespace(**current), observation)
                if not guard['admitted']:
                    result.update(status='stopped', reason='before_guard_refused'); break
                before, first = observation, current
                returned = send('action', actionId=int(command['action_ref'][6:]), data=command.get('data'))
                actions += 1; level_actions += 1
                current = packet(returned, actions)
                observation, _ = measure(SimpleNamespace(**current), actions + 1, 'rooted-quota-reference')
                outcome = family.after(proposal, index, before, observation, first['frame_rows'], current['frame_rows'])
                acquired = family.record(before, observation, command, first['frame_rows'], current['frame_rows'], proposal, index,
                                         frames=current['frame_packet'])
                result['packets'].append({'command': plain(command), 'packet': plain(current), 'observation': plain(observation)})
                prefix['steps'].append({'index': index, 'actionIndex': actions, 'command': plain(command), 'beforeGuard': plain(guard),
                                        'outcome': plain(outcome), 'acquired': plain(acquired), 'afterState': state(family.memory)})
                if observation['levels_completed'] > before['levels_completed']:
                    result['boundaries'].append({'levelsCompleted': observation['levels_completed'], 'actions': actions,
                                                 'levelActions': level_actions})
                    level_actions = 0
                    family.level_deadline = time.perf_counter() + result['budget']['levelSeconds']
                if observation['levels_completed'] >= result['targetLevels']:
                    result.update(status='passed', reason='target_levels_completed'); break
                if family.memory.requested_stop_reason:
                    result.update(status='stopped', reason=family.memory.requested_stop_reason); break
                if outcome.get('seal_prefix'): break
            if result['status'] != 'running': break
        else: result.update(status='stopped', reason='component_cycle_limit')
        result.update(actions=actions, levelsCompleted=current['levels_completed'], state=current['state'], finalState=state(family.memory))
    verified_after = source_hashes()
    assert all(verified_after.get(path) == value for path, value in verified_before.items())
    result.update(sourceModified=False, sourceHashes=verified_after,
                  generator=str(Path(__file__).relative_to(ROOT)), generatorSha256=hashed(Path(__file__).read_bytes()),
                  gameAssetHashes={name: hashed((ROOT / 'public/python' / name).read_bytes())
                                   for name in ('custom-games.zip', 'official-games.zip', 'game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py')})
    destination = ROOT / 'tests/fixtures/v6-rooted-quota-original-public.json.gz'
    destination.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(destination.relative_to(ROOT)), **{key: result[key] for key in ('status', 'reason', 'actions', 'levelsCompleted', 'state', 'boundaries')},
                      'verifiedSourceFiles': len(verified_after)}), flush=True)


if __name__ == '__main__': main()
