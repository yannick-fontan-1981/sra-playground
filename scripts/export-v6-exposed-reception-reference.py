#!/usr/bin/env python3
"""Export unchanged V5/V6 exposed-reception contracts from public pixels.

This uses the retained original functions without patching. The 100 initial
rasters were archived before any action. Synthetic rasters/returns are component
contracts, never evidence of a game trajectory or success. No game source,
host, solution or oracle is read by this exporter.
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
CORPUS_PATH = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
OUTPUT_PATH = 'tests/fixtures/v6-exposed-reception-parity.json.gz'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']


def sha(value): return hashlib.sha256(value).hexdigest()
def verify():
    for relative, entry in MANIFEST.items():
        assert sha((SOURCE / relative).read_bytes()) == entry['sha256'], relative
    return len(MANIFEST)


VERIFIED_BEFORE = verify()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from exposed_reception_access import ExposedReceptionAccess, scene, large_scene, input_candidates, nominal_step, path_to_receptions, Visits
from reception_lattice_projection import small_scene
from auxiliary_support_access import AuxiliarySupportAccess, input_candidates as inherited_inputs
from common_observed_compositions import ObservedCompositionConstraint
from observed_input_domain import ObservedInputDomain
from terminal_composition import identity


def plain(value): return json.loads(json.dumps(value, separators=(',', ':')))
def find_key(value, key):
    if isinstance(value, dict):
        if key in value: return value[key]
        for child in value.values():
            found = find_key(child, key)
            if found is not None: return found
    elif isinstance(value, list):
        for child in value:
            found = find_key(child, key)
            if found is not None: return found
    return None


CORPUS_RAW = (ROOT / CORPUS_PATH).read_bytes()
CORPUS = json.loads(gzip.decompress(CORPUS_RAW))
assert CORPUS['actions'] == CORPUS['levelJumps'] == 0
PUBLIC = next(view for view in CORPUS['games'] if view['game'] == 'CWSE')
ROWS = PUBLIC['packet']['frame_rows']
POLICY_PATH = 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
POLICY = find_key(json.loads((SOURCE / POLICY_PATH).read_text()), 'observed_composition_services')
CASES, GUARDS, COMMONS = [], [], []


def raster(pitch=4, actor=(1, 2), bodies=None, slots=None, active=0):
    """Independent test renderer of the measured grammar, not a game model."""
    bodies = [{'pos': [2, 2], 'color': 7}] if bodies is None else bodies
    slots = [{'pos': [5, 2], 'color': 7}] if slots is None else slots
    rows = [[0] * 64 for _ in range(64)]
    side = pitch - 2
    def tile(pos): return 8 + pos[0] * pitch, 8 + pos[1] * pitch
    for y in range(6):
        for x in range(8):
            if y not in (0, 5) and x not in (0, 7): continue
            px, py = tile((x, y))
            for dx in range(pitch): rows[py][px + dx] = 1
    for slot in slots:
        px, py = tile(slot['pos'])
        for dx in (0, pitch - 1):
            for dy in (0, pitch - 1): rows[py + dy][px + dx] = slot['color']
    for body in bodies:
        px, py = tile(body['pos'])
        for dy in range(side):
            for dx in range(side): rows[py + 1 + dy][px + 1 + dx] = body['color']
        if side == 3 or body.get('overlap'):
            rows[py + 1 + side // 2][px + 1 + side // 2] = 0
    px, py = tile(actor)
    if side == 2:
        rows[py + 1][px + 1: px + 3] = [4, 4]
        rows[py + 2][px + 1: px + 3] = [2, 3]
    else:
        for dy in range(side):
            for dx in range(side): rows[py + 1 + dy][px + 1 + dx] = 4
        rows[py + 1][px + 3] = rows[py + 2][px + 2] = 0
    centers = [(50, 48), (54, 48), (58, 48), (50, 52), (58, 52), (50, 56), (54, 56), (58, 56)]
    for index, (cx, cy) in enumerate(centers):
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx or dy: rows[cy + dy][cx + dx] = 9 if index == active else 8
    return rows


def observation(rows, name='current', **changes):
    return {**copy.deepcopy(PUBLIC['observation']), 'observation_ref': 'controlled:reception:' + name,
            'frame_hash': identity(rows)[:16], **changes}


def state(memory):
    return {'projection': plain({key: getattr(memory, key) for key in
                                 ('reception_state', 'reception_controls', 'reception_models', 'reception_events')}),
            'parentDigest': AuxiliarySupportAccess.retained_digest(memory), 'digest': memory.retained_digest()}


def instance(seed=()):
    memory = ExposedReceptionAccess()
    for event in copy.deepcopy(list(seed)): memory.apply_event(event)
    return memory


def add(name, operation, arguments, expected):
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), 'expected': plain(expected)})
    return expected


def memory_case(name, operation, arguments, callback, seed=()):
    memory = instance(seed)
    before = state(memory)
    expected = callback(memory)
    CASES.append({'id': name, 'operation': operation, 'seedEvents': plain(list(seed)), 'arguments': plain(arguments),
                  'expected': plain(expected), 'beforeState': before, 'afterState': state(memory)})
    return expected


def propose(name, rows, seed=(), limit=16, available=None, config=None):
    obs = observation(rows, name)
    if available is not None: obs['available_action_refs'] = available
    args = {'obs': obs, 'rows': rows, 'inputs': [], 'limit': limit, 'config': config or POLICY}
    return memory_case('propose:' + name, 'propose', args,
                       lambda memory: memory.propose_graph(obs, rows, [], limit, args['config']), seed)


def own(events): return [plain(event) for event in events if event['kind'] == 'observed_exposed_reception']
def record(name, proposal, rows, later, seed=(), index=0, command=None, **changes):
    before = observation(rows, name + ':before')
    after = observation(later, name + ':after', **changes)
    args = {'before': before, 'command': command or proposal['actions'][index], 'after': after,
            'rows': rows, 'later': later, 'proposal': proposal, 'index': index}
    return memory_case('record:' + name, 'record', args,
                       lambda memory: own(memory.record(args['before'], args['command'], args['after'], rows, later, proposal, index)), seed)


def seed(rows, controls=None, models=None, epoch=0, extra=None):
    measured = scene(rows)
    assert measured
    current = {'epoch': epoch, 'layout': measured['layout'], 'evidence': ['controlled:seed'], 'probed': [], 'dial_tried': []}
    if extra: current.update(copy.deepcopy(extra))
    return [{'kind': 'observed_exposed_reception', 'state': current,
             'controls': copy.deepcopy(controls or {}),
             'models': copy.deepcopy(models or {'attached': {}, 'coupled': {}, 'color_edges': [], 'repulsion': {}}),
             'detail': {'controlled': True}}]


def guard(name, operation, proposal, rows, later=None, index=0, **meta):
    plan = proposal['exposed_reception_plan']
    current = {'epoch': plan['epoch'], 'score': plan['score'], 'observation_ref': plan['observation_ref'],
               'available': PUBLIC['observation']['available_action_refs'], **meta}
    args = {'proposal': proposal, 'index': index, 'rows': rows, 'meta': current}
    memory = instance()
    if operation == 'before': result = memory.before(proposal, index, rows, **current)
    else:
        args['later'] = later
        result = memory.after(proposal, index, rows, later, **current)
    GUARDS.append({'id': name, 'operation': operation, 'arguments': plain(args), 'expected': plain(result)})


def common(name, rows, seed_events=(), remaining=16, deadline=1000000000):
    family = ObservedCompositionConstraint()
    family.level_deadline = deadline
    for event in copy.deepcopy(list(seed_events)): family.memory.apply_event(event)
    obs = observation(rows, 'common:' + name)
    item = {'id': name, 'seedEvents': plain(list(seed_events)), 'arguments': {'obs': obs, 'rows': rows, 'inputs': [],
            'remaining': remaining, 'config': POLICY, 'levelDeadline': deadline}}
    try:
        proposal = family.observed_composition_propose(obs, rows, [], remaining, POLICY)
        item['unboundProposal'] = plain(proposal)
        if proposal and proposal.get('status') == 'proposed': family.bind(proposal, ObservedInputDomain(4096))
        item['proposal'] = plain(proposal)
    except Exception as error:
        item['error'] = {'name': type(error).__name__, 'message': str(error)}
    COMMONS.append(item)


def main():
    measurements = []
    for view in CORPUS['games']:
        rows = view['packet']['frame_rows']
        measurements.append({'game': view['game'], 'frameHash': view['observation']['frame_hash'],
                             'scene': scene(rows), 'largeScene': large_scene(rows), 'smallScene': small_scene(rows)})
    small, large = raster(), raster(pitch=5)
    assert small_scene(small) and large_scene(large)
    assert scene(small)['layout'] == '52d269abe1fe341fe5c1d6eac27a7113af66ef414687413defd39f12947da270'
    assert scene(large)['layout'] == 'b84b9e8c5511c7a85e93590c95b84a60e60cfdd7b4c9ea424d66203f1d5c024f'
    overlap = raster(bodies=[{'pos': [5, 2], 'color': 7, 'overlap': True}])
    palette = [[(value * 7 + 3) % 16 for value in row] for row in small]
    two_active = copy.deepcopy(small)
    for y in range(47, 50):
        for x in range(53, 56):
            if two_active[y][x] == 8: two_active[y][x] = 9
    for name, rows in [('public_initial', ROWS), ('small', small), ('large', large), ('receiver_overlap', overlap),
                       ('palette_permutation', palette), ('orientation_changed', raster(active=4)),
                       ('ambiguous_dial', two_active), ('missing', [[0] * 64 for _ in range(64)])]:
        for operation, function in [('scene', scene), ('large_scene', large_scene), ('small_scene', small_scene)]:
            add(operation + ':' + name, operation, {'rows': rows}, function(rows))
    for name, rows in [('small', small), ('large', large), ('public', ROWS), ('missing', [[0] * 64 for _ in range(64)])]:
        for available in [['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'], ['ACTION2']]:
            inherited = list(inherited_inputs(rows, available))
            add('inputs:' + name + ':' + str(len(available)), 'input_candidates',
                {'rows': rows, 'available': available, 'inherited': inherited}, input_candidates(rows, available))
    empty_models = {'attached': {}, 'coupled': {}, 'color_edges': [], 'repulsion': {}}
    one = scene(small)
    for name, models, delta in [('push', empty_models, (1, 0)), ('free', empty_models, (0, -1)),
                               ('wall', empty_models, (-1, 0)),
                               ('attached_side', {**empty_models, 'attached': {'7': {'status': 'candidate'}}}, (0, 1))]:
        visits = Visits()
        poses = [tuple(b['pos']) for b in one['bodies']]
        result = nominal_step(one, tuple(one['actor']), poses, delta, models, visits)
        add('nominal:' + name, 'nominal_step', {'scene': one, 'actor': one['actor'], 'poses': poses, 'delta': delta, 'models': models},
            {'result': result, 'visits': visits.n})
    multi_rows = raster(bodies=[{'pos': [2, 2], 'color': 7}, {'pos': [4, 3], 'color': 7}],
                        slots=[{'pos': [5, 2], 'color': 7}, {'pos': [5, 3], 'color': 7}])
    multi = scene(multi_rows)
    assert multi
    for name, models in [('ordinary', empty_models), ('coupled', {**empty_models, 'coupled': {'7': {'status': 'candidate'}}}),
                          ('attached_coupled', {**empty_models, 'attached': {'7': {}}, 'coupled': {'7': {}}})]:
        visits = Visits()
        poses = [tuple(b['pos']) for b in multi['bodies']]
        result = nominal_step(multi, tuple(multi['actor']), poses, (1, 0), models, visits)
        add('nominal_multi:' + name, 'nominal_step', {'scene': multi, 'actor': multi['actor'], 'poses': poses, 'delta': [1, 0], 'models': models},
            {'result': result, 'visits': visits.n})
    mismatched_rows = raster(slots=[{'pos': [5, 2], 'color': 11}])
    mismatched = scene(mismatched_rows)
    for name, measured, models, bound in [('solved_path', one, empty_models, 8000), ('zero_bound', one, empty_models, 0),
                                         ('partial_one', one, empty_models, 1), ('partial_two', one, empty_models, 2),
                                         ('missing_color_domain', mismatched, empty_models, 100),
                                         ('transitive_color_edges', mismatched, {**empty_models, 'color_edges': [[7, 9], [9, 11]]}, 100),
                                         ('coupled_path', multi, {**empty_models, 'coupled': {'7': {}}}, 100),
                                         ('already_received', scene(overlap), empty_models, 100)]:
        path, nodes, visits = path_to_receptions(measured, models, bound)
        add('path:' + name, 'path_to_receptions', {'scene': measured, 'models': models, 'maxNodes': bound},
            {'path': path, 'nodes': nodes, 'visits': visits})
    first = propose('public_initial', ROWS)
    first_small = propose('small_unmeasured_controls', small)
    propose('large_unmeasured_controls', large)
    controls = {a: {'delta': d, 'evidence': ['controlled:before', 'controlled:after']} for a, d in
                [('ACTION1', [0, -1]), ('ACTION2', [0, 1]), ('ACTION3', [-1, 0]), ('ACTION4', [1, 0])]}
    known = seed(small, controls=controls)
    batch = propose('known_controls_path', small, known)
    assert batch.get('exposed_reception_plan') and len(batch['actions']) > 1
    propose('known_controls_limit_one', small, known, limit=1)
    propose('wrong_epoch_reset', small, seed(small, controls=controls, epoch=77))
    propose('wrong_layout_reset', large, known)
    no_actions = propose('unavailable_actions', small, known, available=[])
    assert no_actions.get('block_unrelated_probe')
    propose('search_partial', small, known, config={**POLICY, 'exposed_reception_question': {**POLICY['exposed_reception_question'], 'max_search_nodes': 2}})
    expose_rows = raster(bodies=[{'pos': [5, 2], 'color': 7}], slots=[{'pos': [5, 2], 'color': 11}])
    expose = propose('mismatched_receiver_exposure', expose_rows)
    assert expose['exposed_reception_plan']['kind'] == 'exposure_question'
    fallback_expose = propose('unmatched_color_fallback', mismatched_rows, available=['ACTION6'])
    assert fallback_expose['exposed_reception_plan']['kind'] == 'exposure_question'
    propose('maintain_repulsion', small, seed(small, models={**empty_models, 'repulsion': {'7': {'status': 'candidate'}}}))
    side_rows = raster(slots=[{'pos': [2, 4], 'color': 7}])
    propose('side_contact_question', side_rows, seed(side_rows, controls=controls))
    later = raster(actor=(1, 3))
    acquired = record('unit_control', first_small, small, later, command={'action_ref': 'ACTION2'})
    propose('after_observed_control', small, acquired)
    record('control_conflict_preserves_old', first_small, small, later, seed(small, controls={'ACTION2': {'delta': [0, -1], 'evidence': ['old']}}), command={'action_ref': 'ACTION2'})
    record('same_layout_old_epoch_retained', first_small, small, later, seed(small, epoch=77), command={'action_ref': 'ACTION2'})
    record('unchanged_return', first_small, small, small)
    record('layout_missing_no_event', first_small, small, [[0] * 64 for _ in range(64)])
    record('level_boundary_unknown', first_small, small, later, level_epoch=1, levels_completed=1)
    side_later = raster(actor=(1, 3), bodies=[{'pos': [2, 3], 'color': 7}])
    record('side_contact_co_motion', first_small, small, side_later, command={'action_ref': 'ACTION2'})
    multi_first = propose('multi_unmeasured', multi_rows)
    multi_later = raster(actor=(1, 3), bodies=[{'pos': [2, 3], 'color': 7}, {'pos': [4, 4], 'color': 7}],
                         slots=[{'pos': [5, 2], 'color': 7}, {'pos': [5, 3], 'color': 7}])
    record('same_color_coupled_candidate', multi_first, multi_rows, multi_later, command={'action_ref': 'ACTION2'})
    recolored = raster(bodies=[{'pos': [2, 2], 'color': 11}])
    record('observed_color_edge', first_small, small, recolored)
    moved_by_orientation = raster(bodies=[{'pos': [3, 2], 'color': 7}], slots=[{'pos': [5, 2], 'color': 11}], active=4)
    record('orientation_motion_candidate', fallback_expose, mismatched_rows, moved_by_orientation,
           command={'action_ref': 'ACTION6', 'data': {'x': 58, 'y': 52}})
    ambiguous_before = raster(bodies=[{'pos': [2, 2], 'color': 7}, {'pos': [4, 2], 'color': 7}],
                              slots=[{'pos': [5, 2], 'color': 7}, {'pos': [5, 3], 'color': 7}])
    ambiguous_after = raster(bodies=[{'pos': [3, 1], 'color': 7}, {'pos': [3, 3], 'color': 7}],
                             slots=[{'pos': [5, 2], 'color': 7}, {'pos': [5, 3], 'color': 7}])
    ambiguous_plan = propose('ambiguous_correspondence_initial', ambiguous_before)
    record('ambiguous_body_correspondence', ambiguous_plan, ambiguous_before, ambiguous_after)
    prediction = batch['exposed_reception_plan']['predicted'][0]
    predicted_rows = raster(actor=prediction['actor'], bodies=[{'pos': p, 'color': c} for p, c in prediction['bodies']])
    assert scene(predicted_rows)
    guard('before_current', 'before', batch, small)
    guard('before_stale_observation', 'before', batch, small, observation_ref='stale')
    guard('before_stale_epoch', 'before', batch, small, epoch=1)
    guard('before_score_changed', 'before', batch, small, score=1)
    guard('before_action_unavailable', 'before', batch, small, available=['ACTION5'])
    guard('before_changed_pixels', 'before', batch, raster(active=4))
    tampered = copy.deepcopy(batch)
    tampered['actions'][0]['action_ref'] = 'ACTION5'
    guard('before_tampered_action', 'before', tampered, small)
    guard('before_second_current', 'before', batch, predicted_rows, index=1)
    guard('before_second_wrong_position', 'before', batch, small, index=1)
    guard('before_second_orientation_changed', 'before', batch,
          raster(actor=prediction['actor'], bodies=[{'pos': p, 'color': c} for p, c in prediction['bodies']], active=4), index=1)
    guard('after_predicted', 'after', batch, small, later=predicted_rows)
    guard('after_wrong_position', 'after', batch, small, later=small)
    guard('after_missing_scene', 'after', batch, small, later=[[0] * 64 for _ in range(64)])
    guard('after_boundary', 'after', batch, small, later=predicted_rows, epoch=1)
    guard('after_unknown_effect', 'after', first_small, small, later=later)
    guard('after_orientation_only_source_does_not_check', 'after', batch, small,
          later=raster(actor=prediction['actor'], bodies=[{'pos': p, 'color': c} for p, c in prediction['bodies']], active=4))
    for name, remaining in [('public_initial', 16), ('remaining_one', 1), ('remaining_zero', 0), ('remaining_negative', -1)]:
        common(name, ROWS, remaining=remaining)
    common('known_controls_small', small, known)
    common('exposure_point_binding', expose_rows)
    common('deadline_missing', small, deadline=None)
    hashes = {}
    for module in list(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if filename:
            path = Path(filename).resolve()
            if path.is_relative_to(SOURCE) and path.is_file():
                relative = str(path.relative_to(SOURCE))
                hashes[relative] = sha(path.read_bytes())
                assert hashes[relative] == MANIFEST[relative]['sha256']
    result = {'schema': 'logos-engine.v6.exposed-reception-parity.v1', 'sourceCommit': COMMIT,
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': sha(Path(__file__).read_bytes()),
              'pinnedSourceFilesVerifiedBeforeImport': VERIFIED_BEFORE, 'pinnedSourceFilesVerifiedAfterRun': verify(),
              'sourceHashes': dict(sorted(hashes.items())), 'policySource': 'reference/v6/' + COMMIT + '/source/' + POLICY_PATH,
              'policySourceSha256': sha((SOURCE / POLICY_PATH).read_bytes()),
              'initialPublicCorpus': {'path': CORPUS_PATH, 'sha256': sha(CORPUS_RAW), 'views': len(CORPUS['games']),
                                      'recordedActions': 0, 'recordedLevelJumps': 0},
              'initialMeasurements': measurements, 'cases': CASES, 'guards': GUARDS, 'commons': COMMONS,
              'qualification': {'sourceModified': False, 'sourceMonkeyPatched': False, 'gameHostRunByExporter': False,
                                'gameSourceRead': False, 'oracleOrSolutionRead': False, 'physicalActions': 0,
                                'controlledReturns': 'Synthetic measurements and memories are component contracts, never game-success evidence.',
                                'digestScope': 'Own exposed layer anchored to the original parent digest; shared native owner is a separate integration gate.',
                                'boundedExtension': 'Native interruption/assignment limits beyond the original max_nodes are separate tests, not source equivalence claims.'}}
    output = ROOT / OUTPUT_PATH
    output.write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode(), mtime=0))
    print(json.dumps({'output': OUTPUT_PATH, 'bytes': output.stat().st_size, 'cases': len(CASES),
                      'guards': len(GUARDS), 'commons': len(COMMONS), 'publicRasters': len(measurements),
                      'admittedPublicRasters': [m['game'] for m in measurements if m['scene'] is not None]}))


if __name__ == '__main__':
    main()
