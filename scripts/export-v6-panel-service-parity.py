#!/usr/bin/env python3
"""Export unchanged V6 panel-service contracts from retained public pixels.

No game host, game source, solution, oracle, or physical action is used. The
initial raster is an already archived public observation. All altered rasters
and returns below are controlled component-contract examples, not game evidence.
The original source functions are called directly without patching or wrapping.
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
OUTPUT_PATH = 'tests/fixtures/v6-panel-service-parity.json.gz'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']


def hashed(value):
    return hashlib.sha256(value).hexdigest()


def verify():
    for relative, entry in MANIFEST.items():
        assert hashed((SOURCE / relative).read_bytes()) == entry['sha256'], relative
    return len(MANIFEST)


VERIFIED_BEFORE = verify()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from common_observed_compositions import ObservedCompositionConstraint
from geometric_observer import components
from observed_input_domain import ObservedInputDomain
from panel_service_access import PanelServiceAccess, projection, input_candidates
from panel_service_projection import scene
from relational_chamber_access import RelationalChamberAccess, input_candidates as inherited_inputs
from terminal_composition import identity


def plain(value):
    return json.loads(json.dumps(value, separators=(',', ':')))


def find_key(value, key):
    if isinstance(value, dict):
        if key in value:
            return value[key]
        for item in value.values():
            found = find_key(item, key)
            if found is not None:
                return found
    elif isinstance(value, list):
        for item in value:
            found = find_key(item, key)
            if found is not None:
                return found
    return None


CORPUS_RAW = (ROOT / CORPUS_PATH).read_bytes()
CORPUS = json.loads(gzip.decompress(CORPUS_RAW))
assert CORPUS['actions'] == CORPUS['levelJumps'] == 0
PUBLIC = next(view for view in CORPUS['games'] if view['game'] == 'RSWP')
ROWS = PUBLIC['packet']['frame_rows']
STRATEGY = SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
POLICY = find_key(json.loads(STRATEGY.read_text()), 'observed_composition_services')
assert POLICY and POLICY['panel_service_question']
INPUTS = [{'action_ref': value} for value in PUBLIC['observation']['available_action_refs'] if value != 'ACTION6']
CASES, GUARDS, COMMONS = [], [], []


def observation(rows, name='current', **changes):
    return {**copy.deepcopy(PUBLIC['observation']),
            'observation_ref': 'controlled:panel:' + name,
            'frame_hash': identity(rows)[:16], **changes}


def state(memory):
    return {'projection': plain({'panel_memory': memory.panel_memory, 'panel_events': memory.panel_events}),
            'parentDigest': RelationalChamberAccess.retained_digest(memory),
            'digest': memory.retained_digest()}


def memory(seed=()):
    result = PanelServiceAccess()
    for event in copy.deepcopy(list(seed)):
        result.apply_event(event)
    return result


def own(events):
    return [plain(event) for event in events if event['kind'] == 'observed_panel_service']


def add(name, operation, arguments, expected):
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), 'expected': plain(expected)})
    return expected


def memory_case(name, operation, arguments, callback, seed=()):
    instance = memory(seed)
    before = state(instance)
    expected = callback(instance)
    CASES.append({'id': name, 'operation': operation, 'seedEvents': plain(list(seed)),
                  'arguments': plain(arguments), 'expected': plain(expected),
                  'beforeState': before, 'afterState': state(instance)})
    return expected


def propose(name, rows, seed=(), limit=16, available=None, inputs=None):
    obs = observation(rows, name)
    if available is not None:
        obs['available_action_refs'] = available
    args = {'obs': obs, 'rows': rows, 'inputs': INPUTS if inputs is None else inputs,
            'limit': limit, 'config': POLICY}
    return memory_case('propose:' + name, 'propose', args,
                       lambda instance: instance.propose_graph(args['obs'], args['rows'], args['inputs'],
                                                               args['limit'], args['config']), seed)


def paint(rows, box, value):
    left, top, right, bottom = box
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            rows[y][x] = value


def outline(rows, cell, value):
    left, top, right, bottom = cell['bbox']
    for x in range(left - 1, right + 2):
        rows[top - 1][x] = rows[bottom + 1][x] = value
    for y in range(top - 1, bottom + 2):
        rows[y][left - 1] = rows[y][right + 1] = value


def select_edit(rows, edit):
    """Controlled visible outline change; no execution semantics are simulated."""
    later = copy.deepcopy(rows)
    panel = next(p for p in scene(rows)['panels'] if p['id'] == edit['panel'])
    background = rows[panel['bbox'][1] + 1][panel['bbox'][0] + 1]
    if edit['field'] == 'activity':
        for cell in panel['activity_controls']:
            if cell['outline'] is not None:
                outline(later, cell, background)
    else:
        for cell in panel['cells']:
            if cell['row'] == edit['cell']['row'] and cell['col'] >= 2 and cell['outline'] is not None:
                outline(later, cell, background)
    outline(later, edit['cell'], panel['selection_color'])
    assert scene(later) is not None
    return later


def record_case(name, proposal, rows, later, seed=(), index=0, **after_changes):
    before = observation(rows, name + ':before')
    after = observation(later, name + ':after', **after_changes)
    args = {'before': before, 'command': proposal['actions'][index], 'after': after,
            'rows': rows, 'later': later, 'proposal': proposal, 'index': index}
    return memory_case('record:' + name, 'record', args,
                       lambda instance: own(instance.record(**args)), seed)


def guard(name, operation, proposal, rows, *, later=None, index=0, meta=None):
    v = proposal['panel_service_plan']
    base = {'epoch': v['epoch'], 'score': v['score'],
            'observation_ref': v['observation_ref'], 'available': PUBLIC['observation']['available_action_refs']}
    args = {'proposal': proposal, 'index': index, 'rows': rows, 'meta': {**base, **(meta or {})}}
    instance = memory()
    if operation == 'before':
        result = instance.before(proposal, index, rows, **args['meta'])
    else:
        args['later'] = later
        result = instance.after(proposal, index, rows, later, **args['meta'])
    GUARDS.append({'id': name, 'operation': operation, 'arguments': plain(args), 'expected': plain(result)})


def common(name, rows, seed=(), remaining=16, deadline=1000000000):
    family = ObservedCompositionConstraint()
    family.level_deadline = deadline
    for event in copy.deepcopy(list(seed)):
        family.memory.apply_event(event)
    obs = observation(rows, 'common:' + name)
    item = {'id': name, 'seedEvents': plain(list(seed)), 'arguments': {
        'obs': obs, 'rows': rows, 'inputs': INPUTS, 'remaining': remaining,
        'config': POLICY, 'levelDeadline': deadline}}
    try:
        proposal = family.observed_composition_propose(obs, rows, copy.deepcopy(INPUTS), remaining, POLICY)
        item['unboundProposal'] = plain(proposal)
        if proposal and proposal.get('status') == 'proposed':
            family.bind(proposal, ObservedInputDomain(4096))
        item['proposal'] = plain(proposal)
    except Exception as error:
        item['error'] = {'name': type(error).__name__, 'message': str(error)}
    COMMONS.append(item)


def main():
    signatures = [tuple((index % 3, index // 3) for index in range(9) if mask & (1 << index))
                  for mask in range(1, 81)]
    set_cases = []
    for name, aa, bb in [('small_copy', signatures[:2], signatures[:0]),
                         ('resize_union', signatures[:8], signatures[4:24]),
                         ('larger_copy', signatures[:20], signatures[:0]),
                         ('overlap_and_resize', signatures[:40], signatures[20:80])]:
        left, right = set(aa), set(bb)
        set_cases.append({'id': name, 'left': plain(aa), 'right': plain(bb),
                          'constructed': plain(list(left)), 'copy': plain(list(left.copy())),
                          'union': plain(list(left | right)),
                          'hashes': [str(hash(value)) for value in aa]})
    initial = scene(ROWS)
    assert initial and len(initial['panels']) == 3
    measurements = []
    for view in CORPUS['games']:
        measured = scene(view['packet']['frame_rows'])
        measurements.append({'game': view['game'], 'frameHash': view['observation']['frame_hash'],
                             'scene': plain(measured)})
    assert [item['game'] for item in measurements if item['scene']] == ['RSWP']
    add('scene:public_initial', 'scene', {'rows': ROWS, 'symbols': []}, initial)
    add('projection:public_initial', 'projection', {'scene': initial}, projection(initial))
    recolored = [[(value + 7) % 16 for value in row] for row in ROWS]
    translated = [[5] * 68 for _ in range(3)] + [[5, 5] + row + [5, 5] for row in ROWS]
    broken = copy.deepcopy(ROWS)
    box = initial['panels'][0]['bbox']; broken[box[1]][box[0] + 2] = 5
    for name, rows in [('palette_permutation', recolored), ('translated_padding', translated),
                       ('broken_panel_frame', broken), ('uniform', [[5] * 64 for _ in range(64)])]:
        add('scene:' + name, 'scene', {'rows': rows, 'symbols': []}, scene(rows))
    assert scene(recolored) and scene(translated)

    for available in [PUBLIC['observation']['available_action_refs'], ['ACTION5', 'ACTION7']]:
        inherited = inherited_inputs(ROWS, available)
        add('inputs:' + ('pointing' if 'ACTION6' in available else 'non_point_only'), 'input_candidates',
            {'rows': ROWS, 'available': available, 'inherited': inherited}, input_candidates(ROWS, available))

    first = propose('direct_initial_experiment', ROWS)
    assert first['kind'] == 'panel_service' and len(first['actions']) == 1
    assert all(c['reason'] == 'current_material_matches_local_receiver' for c in first['panel_service_plan']['contributions'])
    selected = select_edit(ROWS, first['panel_service_plan']['steps'][0]['edit'])
    selection_events = record_case('observed_selection', first, ROWS, selected)
    assert selection_events[0]['memory']['selection_observed'] is True
    propose('selection_observed_batch', ROWS, selection_events)
    propose('selection_observed_limit_one', ROWS, selection_events, limit=1)
    propose('selection_observed_limit_two', ROWS, selection_events, limit=2)
    propose('selection_observed_limit_above_sixteen', ROWS, selection_events, limit=64)
    propose('palette_permutation', recolored)
    propose('translated_padding', translated)
    propose('pointing_unavailable', ROWS, available=['ACTION5', 'ACTION7'])

    no_effect = record_case('configuration_no_effect', first, ROWS, ROWS)
    propose('configuration_failed_same_context', ROWS, no_effect)
    wrong = copy.deepcopy(ROWS)
    wrong_cell = initial['panels'][0]['activity_controls'][-1]
    outline(wrong, wrong_cell, initial['panels'][0]['selection_color'])
    record_case('configuration_wrong_activity', first, ROWS, wrong)
    record_case('official_boundary_seals_unknown_effect', first, ROWS, recolored,
                level_epoch=first['panel_service_plan']['epoch'] + 1, levels_completed=1)

    # Change only an observed receiver's displayed material to exercise the
    # declared rewrite correspondence, without introducing a game rule.
    rewritten = copy.deepcopy(ROWS)
    panel = initial['panels'][-1]
    receiver = next(service for service in panel['services'] if service['kind'] == 'displayed_receiver')
    rewriting = next(service for service in panel['services'] if service['kind'] == 'displayed_rewrite')
    x, y = receiver['observed_site']
    candidates = [c for c in components(ROWS) if c['area'] == 9 and c['bbox'][0] == x
                  and 0 < c['bbox'][1] - (y + 2) <= 3]
    assert len(candidates) == 1
    paint(rewritten, candidates[0]['bbox'], rewriting['output'])
    rewrite_proposal = propose('displayed_rewrite', rewritten)
    assert any(c['reason'] == 'displayed_rewrite_prepares_local_receiver'
               for c in rewrite_proposal['panel_service_plan']['contributions'])
    add('scene:rewrite_correspondence', 'scene', {'rows': rewritten, 'symbols': []}, scene(rewritten))

    room = copy.deepcopy(rewritten)
    material = next(cell for cell in initial['panels'][0]['cells'] if cell['col'] == 0 and cell['outline'] is not None)
    paint(room, material['bbox'], rewriting['output'])
    room_proposal = propose('room_parameter', room)
    assert any(c['reason'] == 'test_room_parameter_to_prepare_matching_receiver'
               for c in room_proposal['panel_service_plan']['contributions'])
    room_batch = propose('room_activity_and_parameter_batch', room, selection_events)
    assert any(step['edit']['field'] == 'parameter' for step in room_batch['panel_service_plan']['steps'])
    ambiguous = copy.deepcopy(room)
    room_choice = room_proposal['panel_service_plan']['contributions'][0]['parameter']
    alternative = next(cell for cell in scene(room)['panels'][0]['cells']
                       if cell['row'] == room_choice['row'] and cell['col'] >= 2 and cell['point'] != room_choice['point'])
    paint(ambiguous, alternative['bbox'], room_choice['color'])
    refused = propose('ambiguous_room_parameter', ambiguous)
    assert refused['status'] == 'unknown' and refused['reason'] == 'panel_service_correspondence_unresolved'

    all_selected = copy.deepcopy(ROWS)
    for current in initial['panels']:
        direct = next(service for service in current['operators']
                      if service['kind'] == 'displayed_receiver' and service['input'] == current['material'])
        outline(all_selected, direct['control'], current['selection_color'])
    application = propose('already_selected_application', all_selected, selection_events)
    assert application['panel_service_plan']['kind'] == 'application'
    assert application['actions'] == [{'action_ref': 'ACTION5'}]
    propose('application_control_unavailable', all_selected, selection_events,
            available=['ACTION6'], inputs=[])
    application_events = record_case('application_no_effect', application, all_selected, all_selected, selection_events)
    propose('failed_application_same_context', all_selected, application_events)
    outside = copy.deepcopy(all_selected); outside[0][0] = (outside[0][0] + 1) % 16
    record_case('application_pixels_changed_projection_unchanged', application, all_selected, outside, selection_events)
    material_changed = copy.deepcopy(all_selected)
    paint(material_changed, material['bbox'], rewriting['output'])
    record_case('application_visible_material_changed', application, all_selected, material_changed, selection_events)
    record_case('application_official_boundary', application, all_selected, recolored, selection_events,
                level_epoch=application['panel_service_plan']['epoch'] + 1, levels_completed=1)

    guard('before_current', 'before', first, ROWS)
    guard('before_stale_observation_ref', 'before', first, ROWS, meta={'observation_ref': 'stale'})
    guard('before_stale_epoch', 'before', first, ROWS, meta={'epoch': first['panel_service_plan']['epoch'] + 1})
    guard('before_score_changed', 'before', first, ROWS, meta={'score': 1})
    guard('before_action_unavailable', 'before', first, ROWS, meta={'available': ['ACTION5']})
    guard('before_pixels_changed', 'before', first, wrong)
    tampered = copy.deepcopy(first); tampered['actions'][0]['data']['x'] += 1
    guard('before_command_tampered', 'before', tampered, ROWS)
    guard('after_selection_match', 'after', first, ROWS, later=selected)
    guard('after_selection_contradicted', 'after', first, ROWS, later=wrong)
    guard('after_scene_missing', 'after', first, ROWS, later=[[5] * 64 for _ in range(64)])
    guard('after_boundary', 'after', first, ROWS, later=selected, meta={'epoch': first['panel_service_plan']['epoch'] + 1})
    guard('after_application_requires_reconciliation', 'after', application, all_selected, later=material_changed)
    batch = propose('guard_batch', ROWS, selection_events)
    assert len(batch['actions']) > 1
    middle = select_edit(ROWS, batch['panel_service_plan']['steps'][0]['edit'])
    guard('before_second_action_current_projection', 'before', batch, middle, index=1)
    guard('before_second_action_stale_projection', 'before', batch, ROWS, index=1)
    later = select_edit(middle, batch['panel_service_plan']['steps'][1]['edit'])
    guard('after_second_selection_match', 'after', batch, middle, later=later, index=1)

    common('public_initial', ROWS)
    common('batch_after_observed_selection', ROWS, selection_events)
    common('remaining_one', ROWS, selection_events, remaining=1)
    common('remaining_zero', ROWS, selection_events, remaining=0)
    common('remaining_negative', ROWS, selection_events, remaining=-1)
    common('deadline_missing', ROWS, deadline=None)
    common('configured_application', all_selected, selection_events)

    source_hashes = {}
    for module in list(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if not filename:
            continue
        path = Path(filename).resolve()
        if path.is_relative_to(SOURCE) and path.is_file():
            relative = str(path.relative_to(SOURCE))
            source_hashes[relative] = hashed(path.read_bytes())
            assert source_hashes[relative] == MANIFEST[relative]['sha256'], relative
    result = {'schema': 'logos-engine.v6.panel-service-parity.v1', 'sourceCommit': COMMIT,
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': hashed(Path(__file__).read_bytes()),
              'pinnedSourceFilesVerifiedBeforeImport': VERIFIED_BEFORE,
              'pinnedSourceFilesVerifiedAfterRun': verify(), 'sourceHashes': dict(sorted(source_hashes.items())),
              'initialPublicCorpus': {'path': CORPUS_PATH, 'sha256': hashed(CORPUS_RAW), 'views': len(CORPUS['games']),
                                      'recordedActions': CORPUS['actions'], 'recordedLevelJumps': CORPUS['levelJumps']},
              'policy': POLICY, 'policySource': str(STRATEGY.relative_to(ROOT)), 'policySourceSha256': hashed(STRATEGY.read_bytes()),
              'qualification': {'sourceModified': False, 'sourceMonkeyPatched': False, 'gameHostRunByExporter': False,
                                'physicalActions': 0, 'gameSourceRead': False, 'oracleOrSolutionRead': False,
                                'controlledReturns': 'All altered rasters and acquired examples are component-contract counterfactuals, never game-success evidence.',
                                'digestScope': 'Own panel memory/event digest is compared with the actual unchanged source ancestor digest supplied as a parameter; full native ancestor parity remains a separate integration gate.',
                                'initialRaster': 'Unmodified archived public RSWP initial raster; this is a fixture input only, never production dispatch or initial memory.'},
              'initialMeasurements': measurements, 'cases': CASES, 'guards': GUARDS, 'commons': COMMONS}
    result['patternSetCases'] = set_cases
    result['sourcePythonVersion'] = sys.version
    payload = json.dumps(result, ensure_ascii=False, separators=(',', ':')).encode()
    destination = ROOT / OUTPUT_PATH
    destination.write_bytes(gzip.compress(payload, mtime=0))
    print(json.dumps({'path': OUTPUT_PATH, 'bytes': destination.stat().st_size, 'cases': len(CASES),
                      'guards': len(GUARDS), 'commons': len(COMMONS), 'sourceFilesVerified': len(MANIFEST),
                      'sourceHashes': len(source_hashes), 'initialMatches': ['RSWP']}))


if __name__ == '__main__':
    main()
