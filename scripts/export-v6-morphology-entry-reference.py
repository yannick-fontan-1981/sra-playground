#!/usr/bin/env python3
"""Unchanged V6 entry/reprise consumers on synthetic public raster histories.

Recalled methods and pending returns are explicit consumer-boundary inputs.
The original observer and geometry produce all raster facts and expected plans;
no game engine, private state, native output or stored game solution is read.
"""
from collections import Counter
from copy import deepcopy
import gzip
import hashlib
import importlib.util
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
BYTECODE = tempfile.TemporaryDirectory(prefix='morphology-entry-source-bytecode-')
sys.pycache_prefix = BYTECODE.name


def hashed(data): return hashlib.sha256(data).hexdigest()


def verify_source():
    verified = {}
    for name, item in json.loads(MANIFEST.read_text())['files'].items():
        actual = hashed((SOURCE / name).read_bytes())
        assert actual == item['sha256'], name
        verified[name] = actual
    return verified


VERIFIED = verify_source()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from terminal_composition import Snapshot, identity, registered
from neutral_observer import measure
from agents.yf_arc3_v6.morphology_policy.geometry import pairs, measure_routes, footprint
from agents.yf_arc3_v6.morphology_policy.entry_rebind import approach, perimeter_values
from agents.yf_arc3_v6.morphology_policy.continuation import resume, contour
from agents.yf_arc3_v6.morphology_policy.observed_meter import ObservedMeter

SHARED_GENERATOR = 'scripts/export-v6-morphology-measurements-reference.py'
spec = importlib.util.spec_from_file_location('current_morphology_canvas', ROOT / SHARED_GENERATOR)
canvas_helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(canvas_helper)
SCENES = {}
SNAPSHOTS = {}
APPROACH = []
RESUME = []
CONTOURS = []
METERS = []
EXECUTED = Counter()


def plain(value):
    if isinstance(value, dict): return {key: plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple, bytes)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value


def profile(frame, event, _arg):
    if event == 'call' and frame.f_code.co_filename.startswith(str(SOURCE) + '/'):
        code = frame.f_code
        EXECUTED[(Path(code.co_filename).relative_to(SOURCE).as_posix(), code.co_firstlineno, code.co_qualname)] += 1


def scene(name, position=(6, 14), *, known_surround=False, transform=None, epoch=2, score=1, rows=None, extra=(),
          meter_length=None, actor_hole=False, actor_multicolor=False):
    if rows is None:
        rows = canvas_helper.canvas(position, other_color=4, meter_length=meter_length)
        for dx, dy, pigment in [(0, 0, 3), (1, 0, 4), (0, 1, 4), (1, 1, 3)]: rows[14 + dy][16 + dx] = pigment
        if known_surround:
            rows[13][6] = 3
            rows[16][7] = 4
        for x, y, pigment in extra: rows[y][x] = pigment
        if actor_hole: rows[position[1] + 1][position[0] + 1] = 0
        if actor_multicolor:
            for dy in range(2): rows[position[1] + dy][position[0] + 1] = 12
    if transform: rows = transform(deepcopy(rows))
    packet = SimpleNamespace(frame_rows=rows, level=epoch, levels_completed=score,
        frame_hash=hashed(json.dumps(rows).encode())[:16], available_action_refs=['ACTION1', 'ACTION2'], state='NOT_FINISHED')
    # Keep the profile bounded to consumers/geometry. Every observer source is
    # nevertheless byte-verified in the complete pinned manifest before/after.
    previous_profile = sys.getprofile(); sys.setprofile(None)
    observation, _ = measure(packet, len(SCENES) + 1, observation_scope='synthetic-morphology-entry')
    sys.setprofile(previous_profile)
    snapshot = Snapshot.from_public(observation, rows)
    inventory, components = pairs(snapshot.rows)
    SCENES[name] = {'rows': rows, 'observation': observation, 'pairs': plain(inventory), 'components': plain(components)}
    SNAPSHOTS[name] = snapshot
    return name


def source_history(transitions): return [(SNAPSHOTS[a], command, SNAPSHOTS[b]) for a, command, b in transitions]


def base(prefix, **options):
    history = [[scene(prefix + ':first-before', (4, 14), **options), 'ACTION1', scene(prefix + ':first-after', (6, 14), **options)],
               [scene(prefix + ':second-before', (8, 18), **options), 'ACTION1', scene(prefix + ':second-after', (10, 18), **options)]]
    current = scene(prefix + ':current', **options)
    before, after = SNAPSHOTS[history[0][0]], SNAPSHOTS[history[0][2]]
    roles = sorted(sig for sig in before.roles.keys() & after.roles.keys() if before.roles[sig] != after.roles[sig])
    assert roles
    role = roles[0]; dx = after.roles[role][0] - before.roles[role][0]; dy = after.roles[role][1] - before.roles[role][1]
    boxes = [SNAPSHOTS[current].roles[sig] for sig in roles]
    size = [max(b[2] for b in boxes) - min(b[0] for b in boxes) + 1,
            max(b[3] for b in boxes) - min(b[1] for b in boxes) + 1]
    pair = SCENES[current]['pairs'][0]
    witness = {'role_refs': roles, 'size': size, 'after': 'synthetic-prior-selective-entry', 'source_epoch': 1,
               'site_surface': identity((10, 11, 11, 10)), 'peer_scale': pair['scales'][0], 'observed_scales': pair['scales'], 'delta': 1}
    method = {'composition': 'alignment_of_homologous_patterns', 'source_scope': 1, 'role_refs': roles,
              'motion_examples': {'ACTION1': [dx, dy], 'ACTION2': [-dx, -dy]}, 'station_hypothesis': witness,
              'scoring_observation': 'synthetic-prior-scoring-observation'}
    facts, _ = measure_routes([], SNAPSHOTS[current], 16, {}, set(), {'ACTION1', 'ACTION2'},
                              station_method=witness, observation=SCENES[current]['observation'])
    return {'method': method, 'history': history, 'current': current, 'observation': SCENES[current]['observation'],
            'facts': facts, 'remaining': 100, 'available': ['ACTION1', 'ACTION2'], 'forecast': None, 'collection': None}


def capture_approach(name, inputs, *, positive=False, purpose):
    args = deepcopy(inputs); facts = args['facts']
    expected = approach(args['method'], source_history(args['history']), SNAPSHOTS[args['current']], args['observation'], facts,
                        args['remaining'], set(args['available']), args['forecast'], args['collection'])
    assert bool(expected) == positive, (name, bool(expected), {k: v for k, v in facts.items() if k != 'routes'})
    APPROACH.append({'id': name, 'purpose': purpose, 'args': plain(inputs), 'expected': plain(expected), 'expectedFacts': plain(facts)})
    return expected, facts


def capture_resume(name, inputs, *, positive=False, purpose):
    args = deepcopy(inputs); facts = args['facts']
    expected = resume(args['pending'], SNAPSHOTS[args['current']], args['observation'], facts,
                      args['remaining'], set(args['available']), args['forecast'])
    assert bool(expected) == positive, (name, bool(expected), {k: v for k, v in facts.items() if k != 'routes'})
    RESUME.append({'id': name, 'purpose': purpose, 'args': plain(inputs), 'expected': plain(expected), 'expectedFacts': plain(facts)})
    return expected, facts


def changed(inputs, path, value):
    result = deepcopy(inputs); target = result
    for part in path[:-1]: target = target[part]
    target[path[-1]] = value
    return result


def with_current(inputs, name):
    result = deepcopy(inputs)
    result['current'] = name; result['observation'] = SCENES[name]['observation']
    return result


def metered(prefix, steps, **options):
    inputs = base(prefix, meter_length=steps, **options)
    meter = ObservedMeter(); names = []
    for length in range(steps + 4, steps, -1):
        name = scene(prefix + ':meter-' + str(length), meter_length=length, **options)
        names.append(name)
    names.append(inputs['current'])
    for index, name in enumerate(names):
        snap = SNAPSHOTS[name]
        meter.observe(snap.epoch, snap.ref, snap.rows, primitive_index=index)
    forecast = meter.forecast()
    assert forecast and forecast['steps_before_empty'] == steps
    inputs['forecast'] = forecast
    METERS.append({'scenes': names, 'forecast': forecast})
    return inputs


def resume_inputs(prefix, inputs, plan, *, transform=None, actor_multicolor=False):
    # The next public raster is independently measured after the released local
    # prefix. This pending record is a declared adapter-consumer boundary; the
    # adapter exporter separately verifies record/apply_event from this plan.
    current_rows = deepcopy(SCENES[inputs['current']]['rows'])
    size = plan['size']; origin = plan['steps'][0]['from']; destination = plan['steps'][-1]['to']
    patch = [row[origin[0]:origin[0] + size[0]] for row in current_rows[origin[1]:origin[1] + size[1]]]
    background = Counter(value for row in current_rows for value in row).most_common(1)[0][0]
    for y in range(size[1]):
        for x in range(size[0]): current_rows[origin[1] + y][origin[0] + x] = background
    for y in range(size[1]):
        for x in range(size[0]): current_rows[destination[1] + y][destination[0] + x] = patch[y][x]
    name = scene(prefix + ':returned', rows=current_rows)
    current = SNAPSHOTS[name]
    facts, _ = measure_routes([], current, 16, {}, set(), set(inputs['available']),
        observation=SCENES[name]['observation'], station_method=inputs['method']['station_hypothesis'])
    pending = {'before': plan['observation_ref'], 'after': current.ref,
        'return_ref': 'return:' + plan['trial'] + ':' + current.ref,
        'plan': plan['deferred_probe'], 'observation_ref': current.ref, 'epoch': current.epoch, 'trial': plan['trial']}
    return {'pending': pending, 'current': name, 'observation': SCENES[name]['observation'], 'facts': facts,
        'remaining': 100, 'available': inputs['available'],
        'forecast': {'steps_before_empty': 9, 'qualification': 'explicit continuation consumer-boundary reserve'}}


def renamed(inputs, forward, reverse):
    result = deepcopy(inputs); mapping = {'ACTION1': forward, 'ACTION2': reverse}
    result['method']['motion_examples'] = {mapping[k]: v for k, v in result['method']['motion_examples'].items()}
    result['available'] = [mapping[k] for k in result['available']]
    result['history'] = [[a, mapping[cmd], b] for a, cmd, b in result['history']]
    return result


def main():
    sys.setprofile(profile)
    inputs = base('base')
    result, facts = capture_approach('positive-deferred-contour', inputs, positive=True,
        purpose='A recalled axis is reproduced at two public origins. Only the common confirmed prefix is bound; the changed contour remains deferred.')
    assert result['deferred_probe'] and len(result['steps']) >= 2
    known = base('known-surround', known_surround=True)
    plain_result, _ = capture_approach('positive-known-surround', known, positive=True,
        purpose='Previously witnessed perimeter pigments allow the common prefix up to, but excluding, the visible effectful goal.')
    assert plain_result['deferred_probe'] is None

    # Generic geometry and palette transformations preserve source decisions;
    # role signatures, dimensions and displacements are measured afresh.
    transforms = {
        'rotated': lambda rows: [list(row) for row in zip(*rows[::-1])],
        'reflected': lambda rows: [row[::-1] for row in rows],
        'translated': lambda rows: [[0] * (len(rows[0]) + 5) for _ in range(3)] + [[0] * 5 + row for row in rows],
        'recolored': lambda rows: [[{0: 0, 2: 8, 3: 6, 4: 7, 5: 3, 6: 4, 7: 5, 9: 12}[v] for v in row] for row in rows],
        # The source contour producer bounds area to 4096 pixels. Crop the
        # unused border and two landmarks before this synthetic scale change.
        'scaled': lambda rows: [[v for v in row[:32] for _ in range(2)] for row in rows[:24] for _ in range(2)],
    }
    positives = [('base', inputs, result)]
    for name, transform in transforms.items():
        candidate = base('generic-' + name, transform=transform)
        plan, _ = capture_approach('generic-' + name, candidate, positive=True,
            purpose='Original source remeasures roles, direction, size and candidate surface after a ' + name + ' public-raster transformation.')
        assert plan['deferred_probe'] and len(plan['steps']) >= 2
        positives.append(('generic-' + name, candidate, plan))
    multi = base('multicomponent', actor_multicolor=True)
    multi_plan, _ = capture_approach('positive-multicomponent-footprint', multi, positive=True,
        purpose='Several colored components jointly fill one rigid footprint with stable offsets; none is assigned a fixed game role.')
    positives.append(('multicomponent', multi, multi_plan))
    for name, forward, reverse in [('prototype', '__proto__', 'constructor'), ('unicode', '🧭', '\ue000'), ('numeric', '10', '2')]:
        candidate = renamed(inputs, forward, reverse)
        plan, _ = capture_approach('opaque-commands-' + name, candidate, positive=True,
            purpose='Action references are opaque consumer keys; only public displacements supply direction.')
        positives.append(('opaque-' + name, candidate, plan))
    repeated = deepcopy(inputs)
    repeated['history'].append([scene('reobserved-origin:before', (4, 14)), 'ACTION1', scene('reobserved-origin:after', (6, 14))])
    capture_approach('positive-reobserved-origin-evidence-order', repeated, positive=True,
        purpose='Later evidence replaces the same origin without changing Python insertion order of the two witnesses.')
    no_inverse = changed(inputs, ['method', 'motion_examples'], {'ACTION1': [2, 0]})
    no_inverse_plan, _ = capture_approach('positive-prefix-without-recalled-inverse', no_inverse, positive=True,
        purpose='A confirmed prefix is still possible; lack of one recalled inverse prevents only the deferred probe.')
    assert no_inverse_plan['deferred_probe'] is None
    ambiguous_inverse = deepcopy(inputs)
    ambiguous_inverse['method']['motion_examples']['ACTION3'] = [-2, 0]; ambiguous_inverse['available'].append('ACTION3')
    ambiguous_plan, _ = capture_approach('positive-prefix-with-ambiguous-inverse', ambiguous_inverse, positive=True,
        purpose='Two inverse command aliases do not establish a unique exit candidate for a deferred entry.')
    assert ambiguous_plan['deferred_probe'] is None

    for name, path, value in [
        ('missing-method', ['method'], None), ('empty-method', ['method'], {}),
        ('empty-history', ['history'], []), ('insufficient-remaining', ['remaining'], 1),
        ('control-already-attested', ['facts', 'control_attested'], True),
        ('no-framed-pair', ['facts', 'framed_pair'], False), ('not-homologous', ['facts', 'homologous'], False),
        ('not-asymmetric', ['facts', 'asymmetric'], False), ('alignment-refuted', ['facts', 'alignment_refuted'], True),
        ('observation-epoch-mismatch', ['observation', 'level_epoch'], 3),
        ('observation-ref-mismatch', ['observation', 'observation_ref'], 'foreign-public-ref'),
        ('method-same-epoch', ['method', 'source_scope'], 2),
        ('different-method-composition', ['method', 'composition'], 'different_public_relation'),
        ('no-recalled-motions', ['method', 'motion_examples'], {}), ('no-available-command', ['available'], []),
        ('missing-method-roles', ['method', 'role_refs'], []),
        ('foreign-method-role', ['method', 'role_refs'], ['absent-public-component']),
        ('missing-station', ['method', 'station_hypothesis'], None),
        ('station-role-mismatch', ['method', 'station_hypothesis', 'role_refs'], []),
        ('station-size-mismatch', ['method', 'station_hypothesis', 'size'], [3, 2]),
        ('missing-scoring-observation', ['method', 'scoring_observation'], None),
        ('only-one-origin', ['history'], inputs['history'][:1]),
        ('same-origin-repeated', ['history'], inputs['history'][:1] * 2),
        ('hypothetical-goal-outside-budget', ['remaining'], 2),
    ]:
        capture_approach('refuse-' + name, changed(inputs, path, value),
            purpose='Source guard independently rejects: ' + name + '.')
    capture_approach('refuse-sparse-footprint', base('sparse-footprint', actor_hole=True),
        purpose='A sparse bounding box is not promoted to a solid traversed footprint.')
    wrong_history = deepcopy(inputs)
    wrong_history['history'] = [[scene('foreign-epoch:before', (4, 14), epoch=3), 'ACTION1', scene('foreign-epoch:after', (6, 14), epoch=3)], inputs['history'][1]]
    capture_approach('refuse-history-from-another-epoch', wrong_history,
        purpose='One useful origin and one foreign-scope transition do not establish a repeated local axis.')
    scored_history = deepcopy(inputs)
    scored_history['history'][0][2] = scene('score-changing:after', (6, 14), score=2)
    capture_approach('refuse-score-changing-history', scored_history,
        purpose='A scoring transition is excluded from local unchanged-effect evidence.')
    nonlocal_history = deepcopy(inputs)
    nonlocal_history['history'].append([scene('nonlocal:before', (20, 18)), 'ACTION1', scene('nonlocal:after', (24, 18))])
    capture_approach('refuse-nonlocal-effect-vetoes-axis', nonlocal_history,
        purpose='A registered unexpected displacement vetoes the command despite two earlier local successes.')
    blocked = deepcopy(inputs)
    blocked['history'].append([scene('blocked:before', (6, 14)), 'ACTION1', scene('blocked:after', (6, 14))])
    capture_approach('refuse-observed-blocked-entry', blocked,
        purpose='Observed stationary contact must not be treated as a confirmed free entrance.')
    early = deepcopy(inputs)
    early_name = scene('early-unknown-contour', extra=[(10, 13, 12)])
    early = with_current(early, early_name)
    capture_approach('refuse-new-contour-before-two-prefix-steps', early,
        purpose='An untested surrounding pigment before two confirmed steps leaves no releasable approach.')

    short_meter = metered('meter-two', 2)
    capture_approach('refuse-meter-reserve-leaves-one-step', short_meter,
        purpose='A real measured depletion forecast cannot support the required two-step prefix and a reserve.')
    three_meter = metered('meter-three', 3)
    capped, _ = capture_approach('positive-prefix-capped-by-real-meter', three_meter, positive=True,
        purpose='The original strip observer limits the prefix to two steps while preserving one unit of reserve.')
    assert len(capped['steps']) == 2 and capped['deferred_probe'] is None
    common = metered('two-goals-common-prefix', 15, extra=[(12, 18, 13)])
    common['method']['motion_examples'].update(ACTION3=[0, 2], ACTION4=[0, -2]); common['available'] += ['ACTION3', 'ACTION4']
    common_plan, _ = capture_approach('positive-common-prefix-of-two-goal-families', common, positive=True,
        purpose='Feature and gauge-related mark plans release only their identical leading axis; alternatives remain unresolved.')
    assert len(common_plan['steps']) >= 2
    divergent = metered('two-goals-divergent-prefix', 15, extra=[(6, 18, 13)])
    divergent['method']['motion_examples'].update(ACTION3=[0, 2], ACTION4=[0, -2]); divergent['available'] += ['ACTION3', 'ACTION4']
    capture_approach('refuse-divergent-goal-prefixes', divergent,
        purpose='Two public candidate goal families with different first commands have no common approach prefix.')

    resume_base = None
    for name, candidate, plan in positives:
        pending_inputs = resume_inputs(name, candidate, plan)
        probe, _ = capture_resume('positive-return-' + name, pending_inputs, positive=True,
            purpose='A separately observed return binds the exact saved contour, entrance patch, role footprint and available retreat.')
        assert probe['access_phase'] == 'discriminant' and probe['reserve_after_probe'] == 8
        if name == 'base': resume_base = pending_inputs
    assert resume_base is not None
    for name, path, value in [
        ('missing-return', ['pending'], None), ('empty-return', ['pending'], {}),
        ('insufficient-remaining', ['remaining'], 1), ('missing-forecast', ['forecast'], None),
        ('insufficient-reserve', ['forecast', 'steps_before_empty'], 1),
        ('return-ref-mismatch', ['pending', 'after'], 'foreign-public-ref'),
        ('plan-epoch-mismatch', ['pending', 'plan', 'level_epoch'], 3),
        ('plan-score-mismatch', ['pending', 'plan', 'score'], 2),
        ('facts-pair-mismatch', ['facts', 'pair_ref'], 'foreign-pair'),
        ('observation-ref-mismatch', ['observation', 'observation_ref'], 'foreign-public-ref'),
        ('alignment-refuted', ['facts', 'alignment_refuted'], True),
        ('missing-role', ['pending', 'plan', 'role_refs'], ['missing-public-role']),
        ('origin-mismatch', ['pending', 'plan', 'steps', 0, 'from'], [10, 14]),
        ('entry-command-unavailable', ['available'], ['ACTION2']),
        ('controlled-footprint-mismatch', ['pending', 'plan', 'footprint_sha'], 'foreign-footprint'),
        ('destination-patch-mismatch', ['pending', 'plan', 'steps', 0, 'surface_sha'], 'foreign-surface'),
        ('saved-contour-mismatch', ['pending', 'plan', 'untested_contour'], []),
        ('retreat-patch-mismatch', ['pending', 'plan', 'exit_candidate', 'surface_sha'], 'foreign-retreat-surface'),
        ('retreat-command-unavailable', ['available'], ['ACTION1']),
    ]:
        capture_resume('refuse-' + name, changed(resume_base, path, value), purpose='Source continuation independently rejects: ' + name + '.')
    for name, coords in [('changed-entrance-raster', (14, 14)), ('changed-contour-raster', (16, 14)), ('changed-retreat-raster', (10, 14))]:
        rows = deepcopy(SCENES[resume_base['current']]['rows']); rows[coords[1]][coords[0]] = 8
        altered = with_current(resume_base, scene(name, rows=rows))
        altered['pending']['after'] = SNAPSHOTS[altered['current']].ref
        capture_resume('refuse-' + name, altered, purpose='A freshly observed pixel change invalidates the saved ' + name + ' guard.')
    for name, epoch, score in [('changed-current-epoch', 3, 1), ('changed-current-score', 2, 2)]:
        altered = with_current(resume_base, scene(name, rows=SCENES[resume_base['current']]['rows'], epoch=epoch, score=score))
        altered['pending']['after'] = SNAPSHOTS[altered['current']].ref
        capture_resume('refuse-' + name, altered, purpose='The observed return cannot cross its saved score/epoch scope.')
    capture_resume('positive-snapshot-owns-epoch-check', changed(resume_base, ['observation', 'level_epoch'], 99), positive=True,
        purpose='Exact helper contract: scope is compared to current Snapshot; resume itself does not read observation.level_epoch.')
    capture_resume('positive-control-already-attested', changed(resume_base, ['facts', 'control_attested'], True), positive=True,
        purpose='Unlike approach, resume has no additional control_attested refusal; saved return evidence is checked directly.')
    extension = changed(resume_base, ['pending', 'plan', 'consumer_extension'], {'label': 'opaque copied metadata', 'items': ['a', 'b']})
    capture_resume('positive-copy-preserves-plan-metadata', extension, positive=True,
        purpose='Python plan expansion preserves unknown metadata and exact evidence order while replacing only documented fields.')

    contour_rows = [[(x + 2 * y) % 7 for x in range(8)] for y in range(6)]
    for name, at, size, exclude in [
        ('interior-coordinate-sort', [2, 2], [3, 2], None), ('exclude-prior-footprint', [2, 2], [3, 2], [0, 2]),
        ('left-top-boundary', [0, 0], [2, 3], None), ('right-bottom-boundary', [6, 4], [2, 2], None),
        ('outside-boundary-clipping', [-1, 1], [2, 2], None), ('non-square-footprint', [3, 1], [1, 4], [3, 0]),
        ('full-board', [0, 0], [8, 6], None), ('empty-exclude-is-false', [2, 2], [2, 2], []),
    ]:
        CONTOURS.append({'id': name, 'rows': contour_rows, 'point': at, 'size': size, 'exclude': exclude,
            'expectedContour': contour(contour_rows, at, size, exclude),
            'expectedPerimeter': sorted(perimeter_values(contour_rows, at, size))})

    sys.setprofile(None)
    assert verify_source() == VERIFIED
    used = {path for path, _, _ in EXECUTED}
    result = {'schema': 'logos-engine.v6.morphology-entry-reference.v1', 'commit': COMMIT,
        'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': hashed(Path(__file__).read_bytes())},
        'sharedGenerator': {'path': SHARED_GENERATOR, 'sha256': hashed((ROOT / SHARED_GENERATOR).read_bytes())},
        'sourceVerification': {'verifiedOriginalFilesBefore': len(VERIFIED), 'verifiedOriginalFilesAfter': len(VERIFIED),
                              'manifestSha256': hashed(MANIFEST.read_bytes())},
        'method': {'sourceModified': False, 'astTransformed': False, 'monkeyPatched': False, 'nativeExecution': False,
                   'inputs': 'Synthetic public rasters measured by the original observer. Recalled-method/pending-return structures are declared consumer-boundary inputs; no game engine or solution is read.'},
        'scope': 'entry_rebind.approach, continuation.resume/contour, and their real source geometry closure. These references do not establish acquisition of recalled methods by the complete runtime or any game success.',
        'sourceHashes': {path: VERIFIED[path] for path in sorted(used)},
        'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': count} for (path, line, name), count in sorted(EXECUTED.items())],
        'scenes': SCENES, 'casesApproach': APPROACH, 'casesResume': RESUME, 'casesContour': CONTOURS, 'measuredMeters': METERS}
    destination = ROOT / 'tests/fixtures/v6-morphology-entry-reference.json.gz'
    destination.write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), mtime=0))
    print(json.dumps({'approach': len(APPROACH), 'resume': len(RESUME), 'contours': len(CONTOURS), 'scenes': len(SCENES),
                      'sourceFilesVerified': len(VERIFIED), 'bytes': destination.stat().st_size}))


if __name__ == '__main__': main()
