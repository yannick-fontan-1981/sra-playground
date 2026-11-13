#!/usr/bin/env python3
"""Original V6 motion experiments on synthetic public rasters only.

The pinned source executes unchanged. Native code, game implementations, host
state and solved campaigns supply neither inputs nor expected outputs.
"""
from collections import Counter
from copy import deepcopy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = SOURCE.parent / 'manifest.json'
BYTECODE_LOOKUP = tempfile.TemporaryDirectory(prefix='motion-original-bytecode-')
sys.pycache_prefix = BYTECODE_LOOKUP.name


def hashed(data):
    return hashlib.sha256(data).hexdigest()


def verify_source():
    result = {}
    for path, item in json.loads(MANIFEST.read_text())['files'].items():
        actual = hashed((SOURCE / path).read_bytes())
        assert actual == item['sha256'], path
        result[path] = actual
    return result


VERIFIED = verify_source()
sys.path[:0] = [str(SOURCE / 'agents/yf_arc3_v6/laya_proto'), str(SOURCE)]
from terminal_composition import Snapshot
from neutral_observer import measure
from geometric_observer import components
from composition_curiosity import elect, reconcile
from agents.yf_arc3_v6.morphology_policy.geometry import footprint, pairs, rigid_role
from agents.yf_arc3_v6.morphology_policy.motion_contrast import motion_offers

SCENES = {}
SNAPSHOTS = {}
CASES = []
EXECUTED = Counter()


def profile(frame, event, _arg):
    if event == 'call' and frame.f_code.co_filename.startswith(str(SOURCE) + '/'):
        code = frame.f_code
        EXECUTED[(Path(code.co_filename).relative_to(SOURCE).as_posix(), code.co_firstlineno, code.co_qualname)] += 1


def plain(value):
    if isinstance(value, dict):
        return {key: plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple, bytes)):
        return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    return value


def scene(name, position, *, rows=None, height=7, walls=((5, 2), (10, 4)), transform=None, epoch=1, score=0, peer=None):
    if rows is None:
        rows = [[0] * 12 for _ in range(height)]
        for x, y, color in [(1, 1, 6), (10, 1, 7), (1, height - 2, 8)]:
            rows[y][x] = color
        for x, y in walls:
            rows[y][x] = 1
        rows[position[1]][position[0]] = 9
        if peer is not None:
            rows[peer[1]][peer[0]] = 5
    if transform:
        rows = transform(deepcopy(rows))
    frame_hash = hashed(json.dumps(rows).encode())[:16]
    packet = SimpleNamespace(frame_rows=rows, level=epoch, levels_completed=score, frame_hash=frame_hash,
                             available_action_refs=['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'], state='NOT_FINISHED')
    observation, _ = measure(packet, len(SCENES) + 1, observation_scope='synthetic-motion')
    snapshot = Snapshot.from_public(observation, rows)
    projected = plain(pairs(snapshot.rows)[1])
    assert projected == plain(components(rows)), name
    SCENES[name] = {'rows': rows, 'observation': observation, 'components': projected}
    SNAPSHOTS[name] = snapshot
    return name


def basic(prefix, **kwargs):
    before = scene(prefix + ':before', (3, 2), **kwargs)
    after = scene(prefix + ':arrival', (4, 2), **kwargs)
    blocked = scene(prefix + ':stationary', (4, 2), **kwargs)
    other = scene(prefix + ':other-before', (3, 3), **kwargs)
    other_after = scene(prefix + ':other-after', (4, 3), **kwargs)
    current = scene(prefix + ':current', (3, 4), **kwargs)
    return [[before, 'ACTION1', after], [after, 'ACTION1', blocked], [other, 'ACTION2', other_after]], current


def capture(name, history, current, admitted=None, observation=None, *, positive=False):
    if admitted is None:
        admitted = {'actions': [{'action_ref': 'ACTION1'}, {'action_ref': 'ACTION2'}], 'remaining_actions': 5}
    if observation is None:
        observation = SCENES[current]['observation']
    source_history = [(SNAPSHOTS[before], command, SNAPSHOTS[after]) for before, command, after in history]
    expected = plain(motion_offers(source_history, SNAPSHOTS[current], deepcopy(admitted), deepcopy(observation)))
    assert bool(expected) == positive, (name, expected)
    control = rigid_role(source_history, SNAPSHOTS[current], pairs(SNAPSHOTS[current].rows)[1])
    CASES.append({'id': name, 'history': history, 'current': current, 'admitted': admitted, 'observation': observation,
                  'expected': expected, 'sourceRigidControl': control is not None})
    return expected


def main():
    sys.setprofile(profile)
    history, current = basic('base')
    base = capture('positive-single-track', history, current, positive=True)
    assert base[0]['predictions'] == {'motion.fixed_displacement': [4, 4], 'motion.stop_before_obstacle': [9, 4]}
    assert base[0]['return_steps'] is None
    capture('zero-action-budget', history, current, {'actions': ['ACTION1', 'ACTION2'], 'remaining_actions': 0})
    capture('depleted-meter', history, current, {'actions': ['ACTION1', 'ACTION2'], 'remaining_meter_steps': 0})
    capture('measured-meter', history, current, {'actions': ['ACTION1', 'ACTION2'], 'remaining_actions': 5, 'remaining_meter_steps': 3}, positive=True)
    capture('no-inputs', history, current, {'actions': []})
    capture('only-addressed-input', history, current, {'actions': [{'action_ref': 'ACTION1', 'data': {'x': 1, 'y': 1}}]})
    capture('empty-data-is-plain', history, current, {'actions': [{'action_ref': 'ACTION1', 'data': {}}, {'action_ref': 'ACTION2'}]}, positive=True)
    capture('list-admission-strings', history, current, ['ACTION1', 'ACTION2'], positive=True)
    capture('list-admission-records', history, current, [{'action_ref': 'ACTION1'}, {'action_ref': 'ACTION2'}], positive=True)
    capture('empty-history', [], current)
    capture('stale-observation', history, current, observation={**SCENES[current]['observation'], 'observation_ref': 'earlier-public-snapshot'})
    capture('foreign-epoch', history, current, observation={**SCENES[current]['observation'], 'level_epoch': 2})
    capture('surface-not-independently-traversed', history[:2], current)
    capture('no-stationary-command-witness', [history[0], history[2]], current)
    capture('protected-swept-cell', history, current, {'actions': ['ACTION1', 'ACTION2'], 'preserve_cells': [[5, 4]]})
    capture('protected-unrelated-cell', history, current, {'actions': ['ACTION1', 'ACTION2'], 'preserve_cells': [[5, 5]]}, positive=True)
    capture('no-distinguishing-current-gap', history, scene('short-gap', (3, 2)))
    capture('image-edge-is-not-an-obstacle', history, scene('edge', (3, 4), walls=((5, 2),)))
    capture('current-surface-unmeasured', history, scene('changed-passage', (3, 4), peer=(6, 4)))
    earlier = scene('decided-before', (3, 4))
    later = scene('decided-after', (4, 4))
    capture('prior-outcome-already-separates-rivals', history + [[earlier, 'ACTION1', later]], current)
    foreign, _ = basic('different-epoch-history', epoch=2)
    capture('history-other-epoch', foreign, current)
    scored, _ = basic('different-score-history', score=1)
    capture('history-other-score', scored, current)

    for label, transform in [
        ('reflected', lambda rows: [row[::-1] for row in rows]),
        ('rotated', lambda rows: [list(row) for row in zip(*rows[::-1])]),
        ('scaled', lambda rows: [[v for value in row for v in [value, value]] for row in rows for _ in range(2)]),
        ('recolored', lambda rows: [[{0: 4, 1: 2, 6: 10, 7: 11, 8: 12, 9: 13}[v] for v in row] for row in rows]),
    ]:
        moved, now = basic(label, transform=transform)
        capture('positive-' + label, moved, now, positive=True)

    returned = history + [
        [scene('return-fixed-before', (4, 4)), 'ACTION3', scene('return-fixed-after', (3, 4))],
        [scene('return-slide-before', (9, 4)), 'ACTION4', scene('return-slide-after', (3, 4))],
    ]
    returns = capture('both-outcomes-have-directed-return', returned, current, {'actions': ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'], 'remaining_actions': 6}, positive=True)
    assert returns[0]['return_steps'] == 1 and all(returns[0]['return_evidence'])
    unavailable = capture('one-directed-return-input-unavailable', returned, current, {'actions': ['ACTION1', 'ACTION2', 'ACTION3']}, positive=True)
    assert unavailable[0]['return_steps'] is None

    options = {'height': 10, 'walls': ((5, 2), (5, 6), (10, 4))}
    rigid, now = basic('two-axis', **options)
    rigid += [
        [scene('axis-right-before', (3, 6), **options), 'ACTION1', scene('axis-right-after', (4, 6), **options)],
        [scene('axis-down-before-a', (1, 3), **options), 'ACTION3', scene('axis-down-after-a', (1, 4), **options)],
        [scene('axis-down-before-b', (2, 3), **options), 'ACTION3', scene('axis-down-after-b', (2, 4), **options)],
    ]
    capture('positive-attested-two-axis-rigid-role', rigid, now, {'actions': ['ACTION1', 'ACTION2', 'ACTION3']}, positive=True)
    assert CASES[-1]['sourceRigidControl']

    policy = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']['information_goal']
    source_history = [(SNAPSHOTS[b], cmd, SNAPSHOTS[a]) for b, cmd, a in history]
    caller_controlled = []
    outcomes = [scene('caller-fixed-return', (4, 4)), scene('caller-slide-return', (9, 4)), scene('caller-boundary-return', (4, 4), epoch=2, score=1)]
    for name, meter, protected in [('eligible-motion', None, []), ('meter-one-declines-unbound-return', {'steps_before_empty': 1}, []), ('protected-swept-cell-declines', None, [[5, 4]])]:
        obs = {**SCENES[current]['observation'], 'preserve_cells': protected}
        scope = {'actions': [{'action_ref': 'ACTION1'}, {'action_ref': 'ACTION2'}], 'remaining_actions': 5,
                 'remaining_meter_steps': meter['steps_before_empty'] if meter else None, 'preserve_cells': protected}
        offers = [dict(offer, source='motion_contrast') for offer in motion_offers(source_history, SNAPSHOTS[current], scope, obs)]
        elected = list(elect(offers, obs, 5, meter, policy))
        reconciliations = [{'after': after, 'expected': reconcile(elected[0][1], obs, SCENES[after]['observation'], None)} for after in outcomes] if elected else []
        caller_controlled.append({'id': name, 'history': history, 'current': current, 'observation': obs, 'inputs': scope['actions'],
                                  'remaining': 5, 'meter': meter, 'policy': policy, 'expectedOffers': plain(offers),
                                  'expectedElection': plain(elected), 'reconciliations': reconciliations})
    assert len(caller_controlled[0]['expectedElection']) == 1
    assert not caller_controlled[1]['expectedElection'] and caller_controlled[1]['expectedOffers']
    assert not caller_controlled[2]['expectedOffers']

    footprints = []
    for at, size in [((0, 0), (2, 2)), ((3, 4), (1, 1)), ((-1, 0), (1, 1)), ((0, -1), (1, 1)), ((11, 6), (2, 1)), ((11, 6), (1, 2))]:
        footprints.append({'scene': current, 'at': at, 'size': size, 'expected': plain(footprint(SNAPSHOTS[current].rows, at, size))})
    sys.setprofile(None)
    after = verify_source()
    assert after == VERIFIED
    used = {path for path, _, _ in EXECUTED}
    used.add('agents/yf_arc3_v6/morphology_policy/motion_contrast.py')
    used.add('agents/yf_arc3_v6/morphology_policy/strategy.drm')
    result = {
        'schema': 'logos-engine.v6.motion-contrast-reference.v1', 'commit': COMMIT,
        'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': hashed(Path(__file__).read_bytes())},
        'sourceVerification': {'verifiedOriginalFilesBefore': len(VERIFIED), 'verifiedOriginalFilesAfter': len(after), 'manifestSha256': hashed(MANIFEST.read_bytes())},
        'method': {'sourceModified': False, 'astTransformed': False, 'monkeyPatched': False, 'nativeExecution': False,
                   'inputs': 'synthetic public rasters measured by the original neutral_observer; no game implementations, private state or solution replay'},
        'scope': 'motion_contrast.motion_offers, consumed geometry.footprint/rigid_role and geometry.pairs component projection only. No MorphologyAdapter, parent-return, full caller or game-success claim.',
        'sourceHashes': {path: VERIFIED[path] for path in sorted(used)},
        'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': count} for (path, line, name), count in sorted(EXECUTED.items())],
        'scenes': SCENES, 'cases': CASES, 'footprints': footprints, 'callerControlled': caller_controlled,
    }
    destination = ROOT / 'tests/fixtures/v6-motion-contrast-reference.json.gz'
    destination.write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), mtime=0))
    print(json.dumps({'cases': len(CASES), 'positive': sum(bool(case['expected']) for case in CASES), 'scenes': len(SCENES),
                      'sourceFilesVerified': len(VERIFIED), 'executedSourceFunctions': len(EXECUTED), 'bytes': destination.stat().st_size}))


if __name__ == '__main__':
    main()
