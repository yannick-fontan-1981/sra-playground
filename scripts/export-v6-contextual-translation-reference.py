#!/usr/bin/env python3
"""Execute unchanged pinned V6 contextual exposure on synthetic public rasters.

Only source measurements construct snapshots and expectations. No game registry,
implementation, host state, native output or solved replay supplies test data.
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
BYTECODE_LOOKUP = tempfile.TemporaryDirectory(prefix='contextual-original-bytecode-')
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
from terminal_composition import Snapshot, registered
from neutral_observer import measure
from geometric_observer import components
from agents.yf_arc3_v6.morphology_policy.geometry import pairs
from agents.yf_arc3_v6.morphology_policy.contextual_translation import contextual_translation_exposures

SCENES = {}
SNAPSHOTS = {}
CASES = []
EXECUTED = Counter()
MARKS = ((1, 1, 6), (12, 1, 7), (1, 8, 8))
OTHER_MARKS = ((2, 1, 6), (12, 2, 7), (2, 8, 8))


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


def scene(name, position, *, marks=MARKS, obstacles=((6, 3, 1),), piece=((0, 0, 9),), extra=(),
          epoch=1, score=0, transform=None):
    rows = [[0] * 14 for _ in range(10)]
    for x, y, color in (*marks, *obstacles, *extra):
        rows[y][x] = color
    for dx, dy, color in piece:
        rows[position[1] + dy][position[0] + dx] = color
    if transform:
        rows = transform(deepcopy(rows))
    frame_hash = hashed(json.dumps(rows).encode())[:16]
    packet = SimpleNamespace(frame_rows=rows, level=epoch, levels_completed=score, frame_hash=frame_hash,
                             available_action_refs=['ACTION1', 'ACTION2'], state='NOT_FINISHED')
    observation, _ = measure(packet, len(SCENES) + 1, observation_scope='synthetic-contextual')
    snapshot = Snapshot.from_public(observation, rows)
    projected = plain(pairs(snapshot.rows)[1])
    assert projected == plain(components(rows)), name
    SCENES[name] = {'rows': rows, 'observation': observation, 'components': projected}
    SNAPSHOTS[name] = snapshot
    return name


def basic(prefix, **kwargs):
    before = scene(prefix + ':before', (3, 3), **kwargs)
    after = scene(prefix + ':arrival', (4, 3), **kwargs)
    blocked = scene(prefix + ':blocked', (5, 3), **kwargs)
    blocked_after = scene(prefix + ':blocked-after', (5, 3), **kwargs)
    current = scene(prefix + ':current', (3, 5), **kwargs)
    return [[before, 'ACTION1', after], [blocked, 'ACTION1', blocked_after]], current


def capture(name, history, current, commands=('ACTION1',), *, positive=False, purpose):
    source_history = [(SNAPSHOTS[before], command, SNAPSHOTS[after]) for before, command, after in history]
    expected = plain(contextual_translation_exposures(source_history, SNAPSHOTS[current], commands))
    assert bool(expected) == positive, (name, expected)
    CASES.append({'id': name, 'purpose': purpose, 'history': history, 'current': current, 'commands': list(commands),
                  'expected': expected, 'registeredPairs': [registered(a, b) for a, _, b in source_history],
                  'registeredToCurrent': [registered(b, SNAPSHOTS[current]) for _, _, b in source_history]})
    return expected


def main():
    sys.setprofile(profile)
    history, current = basic('base')
    first = capture('positive-single-contextual-block', history, current, positive=True,
                    purpose='One positive origin, one blocked exposure, a new origin and a matching traversed destination surface.')
    assert first['ACTION1']['observed_delta'] == [1, 0]
    assert first['ACTION1']['predicted_origin'] == [3, 5]
    assert first['ACTION1']['projected_destination'] == [4, 5]
    capture('empty-history', [], current, purpose='No same-epoch transition evidence.')
    capture('empty-commands', history, current, (), purpose='No admitted plain command.')
    capture('unavailable-command', history, current, ('ACTION2',), purpose='Measured command is absent from caller admission.')
    capture('duplicate-admitted-command', history, current, ('ACTION1', 'ACTION1'), positive=True,
            purpose='Source dict construction collapses repeated admission entries.')
    capture('no-observed-movement', history[1:], current, purpose='No nonzero moving-signature track.')
    capture('no-blocked-exposure', history[:1], current, purpose='A successful translation alone does not identify contextual contrast.')
    capture('current-origin-already-successful', history, history[0][0], purpose='Any earlier trial origin equal to current rules out novelty.')
    capture('current-origin-already-blocked', history, history[1][0], purpose='A blocked trial origin is also an already exposed origin.')
    capture('current-is-only-a-prior-outcome', history, history[0][2], positive=True,
            purpose='The original novelty guard checks trial origins, not previously reached outcomes.')
    two_origins = history + [[scene('other-origin:before', (3, 6)), 'ACTION1', scene('other-origin:after', (4, 6))]]
    capture('two-distinct-success-origins', two_origins, current, purpose='Exactly one prior positive origin is required.')
    conflicting = history + [[history[0][0], 'ACTION1', scene('different-delta:after', (5, 3))]]
    capture('competing-nonzero-deltas', conflicting, current, purpose='One command has two distinct nonzero measured vectors.')
    capture('current-destination-out-of-bounds', history, scene('outside-projection', (13, 5)),
            purpose='An image edge does not supply a measured destination surface.')
    capture('current-surface-equals-blocked-surface', history, scene('same-blocker-surface', (3, 5), extra=((4, 5, 1),)),
            purpose='A matching blocked destination surface vetoes the exposure.')
    capture('current-surface-never-successfully-traversed', history, scene('unseen-surface', (3, 5), extra=((4, 5, 2),)),
            purpose='A different blocked surface is insufficient without a matching positive destination surface.')

    repeated_before = scene('repeat:before', (3, 3))
    repeated_after = scene('repeat:after', (4, 3))
    repeated = [[repeated_before, 'ACTION1', repeated_after], *history]
    ordered = capture('first-matching-positive-witness', repeated, current, positive=True,
                      purpose='Repeated successes at the same origin retain the first matching source witness in history order.')
    assert ordered['ACTION1']['evidence'][:2] == [SNAPSHOTS[repeated_before].ref, SNAPSHOTS[repeated_after].ref]
    edge_block = scene('blocked-edge:before', (13, 3))
    edge_after = scene('blocked-edge:after', (13, 3))
    capture('out-of-bounds-blocked-surface-is-distinct', [history[0], [edge_block, 'ACTION1', edge_after]], current, positive=True,
            purpose='The original accepts an absent blocked projection when current and positive projections match.')
    free_block = scene('blocked-free:before', (5, 6))
    free_after = scene('blocked-free:after', (5, 6))
    capture('one-of-several-blocked-surfaces-matches', history + [[free_block, 'ACTION1', free_after]], current,
            purpose='Any matching blocked surface vetoes, even when another blocker differs.')

    foreign, _ = basic('foreign', epoch=2)
    capture('foreign-epoch-history', foreign, current, purpose='Both transition endpoints must have the current epoch.')
    capture('foreign-history-does-not-veto-current', history + foreign, current, positive=True,
            purpose='Foreign-epoch moving evidence is removed before shared-signature analysis.')
    crossed = [[history[0][0], 'ACTION1', foreign[0][2]], history[1]]
    capture('crossed-epoch-transition', crossed, current, purpose='A boundary-crossing transition cannot establish current control.')
    scored, _ = basic('different-score', score=4)
    capture('score-is-not-an-extra-source-guard', scored, current, positive=True,
            purpose='Contextual exposure filters epochs and registration, not score equality.')
    score_crossing = [
        [history[0][0], 'ACTION1', scene('score-crossing:arrival', (4, 3), score=1)],
        [scene('score-crossing:blocked-before', (5, 3), score=1), 'ACTION1', scene('score-crossing:blocked-after', (5, 3), score=2)],
    ]
    capture('score-changes-within-an-epoch', score_crossing, current, positive=True,
            purpose='Different scores at transition endpoints do not create an unimplemented source restriction.')

    unregistered, now = basic('unregistered', marks=(), obstacles=())
    capture('unregistered-pairs', unregistered, now, purpose='A movement without three noncollinear stationary landmarks is filtered.')
    collinear, now = basic('collinear', marks=((1, 1, 6), (6, 1, 7), (12, 1, 8)), obstacles=())
    capture('collinear-landmarks', collinear, now, purpose='Three collinear stable marks cannot register a successful movement.')
    capture('unregistered-pairs-do-not-veto', history + unregistered, current, positive=True,
            purpose='Unregistered movements are removed before shared-signature and vector checks.')
    shifted, _ = basic('shifted-registration', marks=OTHER_MARKS)
    capture('history-not-registered-to-current', shifted, current,
            purpose='Coherent movement alone cannot supply command trials without current registration.')
    ignored = [scene('unregistered-current:before', (3, 3), marks=OTHER_MARKS), 'ACTION1',
               scene('unregistered-current:after', (5, 3), marks=OTHER_MARKS)]
    capture('unregistered-current-trial-is-skipped-late', history + [ignored], current, positive=True,
            purpose='An internally registered conflicting command vector is excluded only at current trial admission.')

    peer_history, peer_current = basic('static-peer', extra=((9, 6, 5),))
    capture('stationary-peer-is-not-a-second-track', peer_history, peer_current, positive=True,
            purpose='Only signatures with a nonzero history delta enter the moving-track groups.')
    peer_trial = [scene('unavailable-peer:before', (3, 6), extra=((9, 6, 5),)), 'UNAVAILABLE',
                  scene('unavailable-peer:after', (3, 6), extra=((10, 6, 5),))]
    capture('unavailable-command-still-affects-track-coherence', peer_history + [peer_trial], peer_current,
            purpose='All registered history contributes tracks before commands are filtered.')
    shifted_peer = [scene('unregistered-peer:before', (3, 6), marks=OTHER_MARKS, extra=((9, 6, 5),)), 'UNAVAILABLE',
                    scene('unregistered-peer:after', (3, 6), marks=OTHER_MARKS, extra=((10, 6, 5),))]
    capture('unregistered-current-history-still-affects-tracks', peer_history + [shifted_peer], peer_current,
            purpose='Registration to current is deliberately not an early history filter: a detached second motion still vetoes.')
    assert CASES[-1]['registeredPairs'][-1] and not CASES[-1]['registeredToCurrent'][-1]
    missing = [scene('missing-role:before', (3, 6), piece=((0, 0, 10),)), 'ACTION2',
               scene('missing-role:after', (4, 6), piece=((0, 0, 10),))]
    capture('role-missing-from-one-registered-transition', history + [missing], current,
            purpose='The tracked role must be shared by current and every retained history endpoint.')
    capture('ambiguous-current-role', history, scene('ambiguous-current', (3, 5), extra=((9, 6, 9),)),
            purpose='The original public observer excludes duplicated ambiguous signatures from Snapshot roles.')

    joined = ((0, 0, 9), (1, 0, 5))
    joined_history, joined_now = basic('joined', piece=joined, obstacles=((7, 3, 1),))
    joined_expected = capture('positive-multicolor-filled-footprint', joined_history, joined_now, positive=True,
                              purpose='Two coherently moving signatures jointly fill one rectangular footprint.')
    assert len(joined_expected['ACTION1']['role_signatures']) == 2
    detached, now = basic('detached', piece=((0, 0, 9), (2, 0, 5)), obstacles=((8, 3, 1),))
    capture('detached-same-delta-groups', detached, now, purpose='Equal measured motion does not fill the gap between detached components.')
    sparse, now = basic('sparse', piece=((0, 0, 9), (1, 0, 5), (0, 1, 4)), obstacles=((7, 3, 1),))
    capture('sparse-bounding-footprint', sparse, now, purpose='A connected but nonrectangular moving group cannot identify a filled surface.')
    swapped_history = [
        [scene('swapped:before', (3, 3), piece=joined, obstacles=((9, 3, 1),)), 'ACTION1',
         scene('swapped:after', (5, 3), piece=joined, obstacles=((9, 3, 1),))],
        [scene('swapped:blocked', (7, 3), piece=joined, obstacles=((9, 3, 1),)), 'ACTION1',
         scene('swapped:blocked-after', (7, 3), piece=joined, obstacles=((9, 3, 1),))],
    ]
    swapped_now = scene('swapped:current', (3, 5), piece=((0, 0, 5), (1, 0, 9)), obstacles=((9, 3, 1),))
    capture('no-extra-cross-history-offset-invariant', swapped_history, swapped_now, positive=True,
            purpose='Source position is per-snapshot minimum origin; it does not add rigid_role relative-offset guards.')

    for label, transform in [
        ('reflected', lambda rows: [row[::-1] for row in rows]),
        ('rotated', lambda rows: [list(row) for row in zip(*rows[::-1])]),
        ('scaled', lambda rows: [[v for value in row for v in [value, value]] for row in rows for _ in range(2)]),
        ('recolored', lambda rows: [[{0: 4, 1: 2, 6: 10, 7: 11, 8: 12, 9: 13}[v] for v in row] for row in rows]),
    ]:
        transformed, now = basic(label, transform=transform)
        capture('positive-' + label, transformed, now, positive=True,
                purpose='No fixed palette, scale, axis direction or screen coordinate is assigned to a semantic role.')

    for command in ['__proto__', 'contrôle-\U00010000', '0']:
        renamed = [[before, command, after] for before, _, after in history]
        capture('symbolic-command-' + command, renamed, current, (command,), positive=True,
                purpose='Opaque command references retain exact spelling without JavaScript object-prototype interpretation.')
    second = [[scene('second-command:before', (3, 6)), 'SECOND', scene('second-command:after', (4, 6))],
              [history[1][0], 'SECOND', history[1][2]]]
    multi = capture('multiple-eligible-commands', history + second, current, ('SECOND', 'ACTION1'), positive=True,
                    purpose='Every eligible admitted command is retained in source admission order, without early election.')
    assert list(multi) == ['SECOND', 'ACTION1']

    sys.setprofile(None)
    after = verify_source()
    assert after == VERIFIED
    used = {path for path, _, _ in EXECUTED}
    used.add('agents/yf_arc3_v6/morphology_policy/contextual_translation.py')
    result = {
        'schema': 'logos-engine.v6.contextual-translation-reference.v1', 'commit': COMMIT,
        'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': hashed(Path(__file__).read_bytes())},
        'sourceVerification': {'verifiedOriginalFilesBefore': len(VERIFIED), 'verifiedOriginalFilesAfter': len(after),
                               'manifestSha256': hashed(MANIFEST.read_bytes())},
        'method': {'sourceModified': False, 'astTransformed': False, 'monkeyPatched': False, 'nativeExecution': False,
                   'inputs': 'synthetic public rasters measured by original neutral_observer; no game implementations, private state or solution replay'},
        'scope': 'contextual_translation.contextual_translation_exposures and the consumed original registered/identity/footprint/components closure. No acquisition caller or game-success claim.',
        'sourceHashes': {path: VERIFIED[path] for path in sorted(used)},
        'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': count}
                                    for (path, line, name), count in sorted(EXECUTED.items())],
        'scenes': SCENES, 'cases': CASES,
    }
    destination = ROOT / 'tests/fixtures/v6-contextual-translation-reference.json.gz'
    destination.write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), mtime=0))
    print(json.dumps({'cases': len(CASES), 'positive': sum(bool(case['expected']) for case in CASES), 'scenes': len(SCENES),
                      'sourceFilesVerified': len(VERIFIED), 'executedSourceFunctions': len(EXECUTED), 'bytes': destination.stat().st_size}))


if __name__ == '__main__':
    main()
