#!/usr/bin/env python3
"""Bounded independent contracts from the unchanged pinned OutlineService.

Expected values are produced only by original Python/V5/DRM/SRC. Controlled
rasters exercise contracts; they are not game returns or completed levels.
"""
from __future__ import annotations

from collections.abc import Mapping
import argparse
import copy
import gzip
import importlib.util
import itertools
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('outline_source_probe', Path(__file__).with_name('probe-v6-outline-service-original.py'))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
OutlineService = helper.OutlineService
ROOT = helper.ROOT
CASES, MEMORY_CASES, POLICY_CASES = [], [], []
RECIPES, PENDING = {}, {}


def plain(value):
    return helper.plain(copy.deepcopy(value))


def finite_canonical(value):
    if value is None: return 'null'
    if value is True: return 'true'
    if value is False: return 'false'
    if isinstance(value, str): return json.dumps(value, ensure_ascii=True)
    if isinstance(value, int):
        assert abs(value) <= 9007199254740991
        return str(value)
    if isinstance(value, float): raise AssertionError(('Unqualified floating identity operand', value))
    if isinstance(value, (tuple, list)): return '[' + ','.join(finite_canonical(v) for v in value) + ']'
    if isinstance(value, Mapping): return '{' + ','.join(json.dumps(k, ensure_ascii=True) + ':' + finite_canonical(v) for k, v in sorted(value.items())) + '}'
    raise TypeError(type(value))


def profile(frame, event, arg):
    helper.source_profile(frame, event, arg)
    if frame.f_code not in (helper.digest.__code__, helper.stable_digest.__code__): return
    caller = frame.f_back
    if caller is None: return
    source_path = Path(caller.f_code.co_filename)
    allowed = {helper.source_family.__file__, str(helper.SOURCE / 'agents/yf_arc3_v5/capabilities/components.py')}
    if str(source_path) not in allowed: return
    if event == 'call':
        PENDING[id(frame)] = (copy.deepcopy(frame.f_locals['value']), source_path.relative_to(helper.SOURCE).as_posix() + ':' + str(caller.f_lineno),
                              'outline.digest' if frame.f_code is helper.digest.__code__ else 'v5.stable_digest')
    elif event == 'return':
        value, origin, function = PENDING.pop(id(frame))
        canonical = json.dumps(value, sort_keys=True, separators=(',', ':')) if function == 'outline.digest' else helper.canonical_json(value)
        independent = finite_canonical(plain(value))
        assert canonical == independent and helper.hashed(canonical.encode()) == arg
        row = RECIPES.setdefault(arg, {'sourceHash': arg, 'sourceCanonical': canonical, 'value': plain(value),
                                      'nativeCanonical': independent, 'nativeHash': helper.hashed(independent.encode()),
                                      'callers': [], 'functions': []})
        assert row['sourceCanonical'] == canonical
        if origin not in row['callers']: row['callers'].append(origin)
        if function not in row['functions']: row['functions'].append(function)


def capture(callback):
    try: return {'value': plain(callback())}
    except (ValueError, KeyError, TypeError, IndexError, AttributeError) as exc:
        return {'error': {'name': type(exc).__name__, 'message': str(exc)}}


def add(name, operation, arguments, callback, domain='controlled_public_raster'):
    row = {'id': name, 'operation': operation, 'domain': domain, 'arguments': plain(arguments), **capture(callback)}
    CASES.append(row)
    return row.get('value')


def memory_case(family, empty, name, operation, arguments, callback, seed=None):
    family.restore(copy.deepcopy(empty if seed is None else seed))
    before = plain(family.state())
    row = {'id': name, 'operation': operation, 'seedState': before, 'arguments': plain(arguments), **capture(lambda: callback(family)),
           'afterState': plain(family.state()), 'qualification': 'Controlled component contract, not a game result.'}
    MEMORY_CASES.append(row)
    return row


def raster(width=32, height=24, value=0):
    return [[value] * width for _ in range(height)]


def paint(rows, box, value, perimeter=False):
    left, top, right, bottom = box
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            if not perimeter or x in (left, right) or y in (top, bottom): rows[y][x] = value
    return rows


def obs(rows, revision=1, epoch=1, actions=None):
    frame_hash = helper.hashed(json.dumps(rows, separators=(',', ':')).encode())[:16]
    return {'observation_ref': f'controlled-outline:epoch:{epoch}:revision:{revision}:frame:{frame_hash}',
            'frame_hash': frame_hash, 'level_epoch': epoch, 'levels_completed': epoch - 1, 'revision': revision,
            'available_action_refs': actions or ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'],
            'state': 'NOT_FINISHED'}


def bbox(values):
    return helper.BoundingBox(left=values[0], top=values[1], right=values[2], bottom=values[3])


def interaction(rows, fields, route_config):
    frame = helper.FrameGrid(rows=tuple(map(tuple, rows)))
    values = copy.deepcopy(fields)
    for name, value in list(values.items()):
        if name.endswith('_bboxes'):
            values[name] = tuple(bbox(box) for box in value)
        elif name in ('current_observed_frame', 'previous_action_observed_frame') and value is not None:
            values[name] = helper.FrameGrid(rows=tuple(map(tuple, value)))
        elif name == 'canonical_provisional_control_term_facts':
            values[name] = tuple(helper.FrozenMap(row) for row in value)
        elif name == 'prior_observed_exact_perimeter_components':
            values[name] = tuple(helper.ComponentDescription.model_validate(row) for row in value)
    return helper.InteractionProbeInput(frame=frame, components=helper.detect_components(helper.ComponentExtractionInput(frame=frame, connectivity=4)),
                                        route_generation_policy=route_config, **values)


def geometry_fields(box, component_ref='controlled:component'):
    return {'available_action_refs': ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'],
            'canonical_provisional_control_term_facts': [{'term_ref': 'hypothesis.action_conditioned_outline:controlled', 'entity_ref': component_ref}],
            'canonical_provisional_control_geometry_bboxes': [box], 'input_aligned_entity_bboxes': [box],
            'current_action_conditioned_control_outline_bboxes': [box], 'translated_entity_bboxes': [box],
            'observed_translated_entity_bboxes': [box], 'observed_distinct_translated_entity_count': 1,
            'observed_controlled_translation_count': 2,
            'known_action_translation_deltas': [['ACTION4', 0, box[2] - box[0] + 1]],
            'interface_action_translation_deltas': [['ACTION1', -1, 0], ['ACTION2', 1, 0], ['ACTION3', 0, -1], ['ACTION4', 0, 1]],
            'last_action_ref': 'ACTION4'}


def acquisition_example(family=None):
    family = OutlineService() if family is None else family
    empty = {'epoch': None, 'control': None, 'tracks': {}, 'methods': [], 'attempts': {}, 'last': None, 'last_event': None}
    family.restore(empty)
    snapshots = []
    for index, left in enumerate([2, 8, 14]):
        rows = raster()
        paint(rows, [13, 1, 19, 7], 8, True)
        paint(rows, [left, 2, left + 4, 6], 7, True)
        paint(rows, [left + 1, 3, left + 3, 5], index + 2)
        snapshots.append({'rows': rows, 'observation': obs(rows, index + 1)})
    transitions = []
    for index in [1, 2]:
        a, b = snapshots[index - 1], snapshots[index]
        before_state = plain(family.state())
        command = {'action_ref': 'ACTION4'}
        acquired = family.record(a['observation'], b['observation'], command, a['rows'], b['rows'])
        transitions.append({'before': a['observation'], 'after': b['observation'], 'command': command,
                            'first': a['rows'], 'second': b['rows'], 'beforeState': before_state,
                            'value': plain(acquired), 'afterState': plain(family.state())})
    assert transitions[0]['afterState']['control'] is None
    assert family.control is not None
    current = snapshots[-1]
    acquired_state = plain(family.state())
    measured = family.measure(current['observation'], current['rows'])
    proposal = family.propose(current['observation'], current['rows'], [], 16)
    assert proposal and proposal['outline_plan']['meaning']['kind'] == 'local_operator_hypothesis'
    assert measured['facts']['exact_locus'] is True
    bind = family.bind(proposal, None)
    guard = family.before(proposal, 0, SimpleNamespace(frame_rows=current['rows']), current['observation'])
    later = obs(current['rows'], 4)
    outcome = family.after(proposal, 0, current['observation'], later, current['rows'], current['rows'])
    local = family.record(current['observation'], later, proposal['actions'][0], current['rows'], current['rows'], proposal, 0)
    after_state = plain(family.state())
    repeated = family.propose(later, current['rows'], [], 16)
    assert guard['admitted'] and local['status'] == 'no_visible_local_change' and repeated is None
    return {'qualification': 'Synthetic public raster contract with two original acquisitions; never executed in a game or injected into a cold campaign.',
            'initialState': empty, 'snapshots': snapshots, 'transitions': transitions,
            'acquiredState': acquired_state, 'measurement': plain(measured), 'proposal': plain(proposal),
            'bind': plain(bind), 'beforeGuard': plain(guard), 'localObservation': later,
            'localOutcome': plain(outcome), 'localRecord': plain(local), 'afterLocalState': after_state,
            'repeatedProposal': plain(repeated)}


def geometry_cases(policy):
    for width, height in [(2, 5), (3, 3), (3, 16), (16, 3), (16, 16), (17, 5), (5, 17)]:
        rows = raster(24, 24)
        paint(rows, [2, 2, width + 1, height + 1], 255, True)
        add(f'boxes:extent_{width}_{height}', 'boxes', {'rows': rows}, lambda r=rows: helper.boxes(r))
    base = paint(raster(), [2, 2, 6, 6], 7, True)
    variants = {'exact': base, 'solid': paint(raster(), [2, 2, 6, 6], 7), 'blank': raster(),
                'frame_boundary': paint(raster(), [0, 0, 4, 4], 7, True)}
    for name, point, value in [('missing_corner', [2, 2], 0), ('missing_edge', [4, 2], 0),
                               ('attached_interior', [3, 3], 7), ('attached_outside', [1, 2], 7),
                               ('detached_diagonal', [1, 1], 7), ('different_interior', [4, 4], 9)]:
        rows = copy.deepcopy(base); rows[point[1]][point[0]] = value; variants[name] = rows
    rows = copy.deepcopy(base)
    paint(rows, [12, 2, 16, 6], 8, True); paint(rows, [2, 12, 6, 16], 7, True)
    variants['repeated_shape_across_palettes'] = rows
    for name, rows in variants.items():
        add('boxes:' + name, 'boxes', {'rows': rows}, lambda r=rows: helper.boxes(r))
    for name, box, value in [('exact', [2, 2, 6, 6], 7), ('wrong_value', [2, 2, 6, 6], 8),
                              ('single_pixel', [2, 2, 2, 2], 7), ('negative_left', [-1, 2, 3, 6], 7),
                              ('negative_top', [2, -1, 6, 3], 7), ('beyond_right', [29, 2, 33, 6], 7),
                              ('beyond_bottom', [2, 21, 6, 25], 7), ('reversed_x', [6, 2, 2, 6], 7),
                              ('reversed_y', [2, 6, 6, 2], 7)]:
        add('same_box:' + name, 'sameBox', {'rows': base, 'box': box, 'value': value},
            lambda b=box, v=value: helper.same_box(base, b, v))
    add('same_box:interior_is_not_a_rim', 'sameBox', {'rows': variants['different_interior'], 'box': [2, 2, 6, 6], 'value': 7},
        lambda: helper.same_box(variants['different_interior'], [2, 2, 6, 6], 7))

    room = paint(copy.deepcopy(base), [11, 1, 17, 7], 8, True)
    fields = geometry_fields([2, 2, 6, 6], helper.boxes(room)[1]['component_ref'] if len(helper.boxes(room)) > 1 else 'controlled:component')
    route_cases = [('one_reachable_locus', room, fields, policy.route_config)]
    for name, change in [('no_control_term', {'canonical_provisional_control_term_facts': []}),
                         ('no_translation', {'translated_entity_bboxes': [], 'observed_translated_entity_bboxes': []}),
                         ('no_available_direction', {'available_action_refs': ['ACTION5']}),
                         ('no_known_delta', {'known_action_translation_deltas': []}),
                         ('inconsistent_primitive_quanta', {'known_action_translation_deltas': [['ACTION4', 0, 5], ['ACTION2', 3, 0]]}),
                         ('declared_extent_mismatch', {'canonical_provisional_control_term_facts': [{'term_ref': 'hypothesis:controlled', 'entity_ref': 'controlled', 'bbox_width': 6, 'bbox_height': 5}]}),
                         ('older_translation_scope', {'translated_entity_bboxes_from_prior_frame': True}),
                         ('two_incompatible_control_descriptions', {'canonical_provisional_control_term_facts': [{'term_ref': 'a', 'entity_ref': 'first'}, {'term_ref': 'b', 'entity_ref': 'second'}]})]:
        route_cases.append((name, room, {**copy.deepcopy(fields), **change}, policy.route_config))
    for name, change in [('floor_recurrence_disabled', {'observed_control_underlay_recurrence_grounds_confirmed_floor_graph': False}),
                         ('swept_depth_zero', {'control_zone_cell_swept_route': {**plain(policy.route_config['control_zone_cell_swept_route']), 'maximum_depth': 0}}),
                         ('swept_states_one', {'control_zone_cell_swept_route': {**plain(policy.route_config['control_zone_cell_swept_route']), 'maximum_states': 1}}),
                         ('swept_unknown_mask', {'control_zone_cell_swept_route': {**plain(policy.route_config['control_zone_cell_swept_route']), 'target_mask': 'unknown'}})]:
        route_cases.append((name, room, fields, {**plain(policy.route_config), **change}))
    two = paint(copy.deepcopy(room), [11, 11, 17, 17], 9, True)
    route_cases.append(('two_reachable_loci_remain_ambiguous', two, fields, policy.route_config))
    off_grid = paint(copy.deepcopy(base), [12, 1, 18, 7], 8, True)
    route_cases.append(('locus_not_on_declared_quantum', off_grid, fields, policy.route_config))
    barrier = copy.deepcopy(room)
    for row in barrier: row[9] = 10
    route_cases.append(('floor_graph_blocked', barrier, fields, policy.route_config))
    swept = copy.deepcopy(room); swept[2][7] = 10
    route_cases.append(('center_route_is_not_swept_clearance', swept, fields, policy.route_config))
    exact = paint(raster(), [1, 1, 7, 7], 8, True); paint(exact, [2, 2, 6, 6], 7, True)
    route_cases.append(('already_at_exact_locus', exact, fields, policy.route_config))
    broken = copy.deepcopy(room); broken[1][13] = 0
    route_cases.append(('unexplained_missing_locus_border', broken, fields, policy.route_config))
    boundary = paint(copy.deepcopy(base), [11, 0, 17, 6], 8, True)
    route_cases.append(('locus_touches_frame_boundary', boundary, fields, policy.route_config))
    multi = paint(copy.deepcopy(two), [2, 12, 6, 16], 7, True)
    both = {**copy.deepcopy(fields), 'translated_entity_bboxes': [[2, 2, 6, 6], [2, 12, 6, 16]],
            'observed_translated_entity_bboxes': [[2, 2, 6, 6], [2, 12, 6, 16]], 'observed_distinct_translated_entity_count': 2}
    route_cases.append(('multi_body_ambiguous_matching', multi, both, policy.route_config))
    separated = copy.deepcopy(multi)
    for row in [9, 10]: separated[row] = [10] * len(separated[row])
    route_cases.append(('multi_body_unique_matching', separated, both, policy.route_config))
    route_cases.append(('multi_body_unequal_slot_count', paint(copy.deepcopy(base), [2, 12, 6, 16], 7, True), both, policy.route_config))
    for name, rows, facts, config in route_cases:
        args = {'rows': rows, 'fields': facts, 'routeConfig': plain(config)}
        add('routes:' + name, 'controlZoneRoutes', args,
            lambda r=rows, f=facts, c=config: helper._compatible_control_zone_cell_routes(interaction(r, f, c)),
            'controlled_v5_public_input_contract')

    lead = [7, 2, 11, 6]
    scene = raster(32, 24)
    paint(scene, lead, 7, True); paint(scene, [3, 3, 6, 6], 5); paint(scene, [17, 2, 21, 6], 5, True); scene[3][8] = 5
    af = geometry_fields(lead)
    accompaniment_cases = [('cardinal_marker', scene, af)]
    for name, change in [('no_term', {'canonical_provisional_control_term_facts': []}),
                         ('no_geometry', {'canonical_provisional_control_geometry_bboxes': []}),
                         ('multiple_geometry', {'canonical_provisional_control_geometry_bboxes': [lead, [2, 2, 6, 6]]}),
                         ('below_minimum_quantum', {'canonical_provisional_control_geometry_bboxes': [[7, 2, 8, 3]]}),
                         ('unavailable_direction', {'available_action_refs': ['ACTION1']}),
                         ('zero_direction', {'interface_action_translation_deltas': [['ACTION4', 0, 0]]}),
                         ('diagonal_direction', {'interface_action_translation_deltas': [['ACTION4', 1, 1]]}),
                         ('aliased_descriptions', {'canonical_provisional_control_term_facts': [{'term_ref': 'a', 'entity_ref': 'same'}, {'term_ref': 'b', 'entity_ref': 'same'}]}),
                         ('disagreeing_descriptions_current_outline', {'canonical_provisional_control_term_facts': [{'term_ref': 'a', 'entity_ref': 'one'}, {'term_ref': 'b', 'entity_ref': 'two'}]}),
                         ('disagreeing_descriptions_no_current_outline', {'canonical_provisional_control_term_facts': [{'term_ref': 'a', 'entity_ref': 'one'}, {'term_ref': 'b', 'entity_ref': 'two'}], 'current_action_conditioned_control_outline_bboxes': []})]:
        accompaniment_cases.append((name, scene, {**copy.deepcopy(af), **change}))
    for name, point, value in [('missing_marker', [8, 3], 0), ('different_marker_palette', [8, 3], 6), ('broken_target', [17, 2], 0)]:
        rows = copy.deepcopy(scene); rows[point[1]][point[0]] = value
        accompaniment_cases.append((name, rows, af))
    duplicate = paint(copy.deepcopy(scene), [17, 12, 21, 16], 5, True)
    accompaniment_cases.append(('two_triplets_ambiguous', duplicate, af))
    overlaid = raster(32, 24); paint(overlaid, lead, 7, True); paint(overlaid, [8, 3, 10, 5], 5)
    paint(overlaid, [22, 2, 26, 6], 5, True); overlaid[3][13] = 5
    accompaniment_cases.append(('overlaid_interior', overlaid, af))
    embedded = copy.deepcopy(overlaid); embedded[3][13] = 0; paint(embedded, [22, 2, 26, 6], 0)
    paint(embedded, [12, 2, 16, 6], 5, True); embedded[3][13] = 5
    accompaniment_cases.append(('embedded_target_marker', embedded, af))
    contact = copy.deepcopy(scene); paint(contact, [8, 8, 11, 11], 9); contact[4][9] = 9
    accompaniment_cases.append(('other_body_announces_immediate_contact', contact, af))
    previous = raster(32, 24); paint(previous, [3, 3, 6, 6], 5); previous[3][8] = 5
    turn = raster(32, 24); paint(turn, [8, 3, 11, 6], 5); turn[8][8] = 5
    paint(turn, [17, 2, 21, 6], 5, True); paint(turn, [7, 7, 11, 11], 7, True)
    tf = geometry_fields([7, 7, 11, 11])
    accompaniment_cases.append(('turn_without_previous_announcement', turn, tf))
    accompaniment_cases.append(('turn_after_previous_observed_announcement', turn, {**tf, 'previous_action_observed_frame': previous}))
    for name, rows, facts in accompaniment_cases:
        add('accompaniment:' + name, 'perimeterAccompaniment', {'rows': rows, 'fields': facts},
            lambda r=rows, f=facts: helper._compact_body_perimeter_marker_accompaniment(interaction(r, f, policy.route_config)),
            'controlled_v5_public_input_contract')
    return {'routeScene': room, 'routeFields': fields, 'accompanimentScene': scene, 'contactScene': contact}


def policy_cases(policy):
    names = ['current_scope_and_observation', 'exact_locus', 'unique_locus_route', 'unique_mobile_correspondence',
             'local_operator_observed', 'immediate_other_contact', 'lead_on_announced_cell', 'untried_current_context']
    for index, bits in enumerate(itertools.product([False, True], repeat=len(names))):
        facts = dict(zip(names, bits))
        POLICY_CASES.append({'id': f'choose:boolean_{index:03d}', 'operation': 'evaluate', 'facts': facts,
                             'interpretation': plain(policy.interpret(facts)), 'value': plain(policy.evaluate(facts))})
    controls = ['current_outline_revalidated', 'current_transition_evidence', 'interior_contrast_observed', 'recalled_method_current_unique']
    for index, bits in enumerate(itertools.product([False, True], repeat=len(controls))):
        facts = dict(zip(controls, bits))
        POLICY_CASES.append({'id': f'control:boolean_{index:02d}', 'operation': 'bindControl', 'facts': facts,
                             'interpretation': plain(policy.interpret_control(facts)), 'value': plain(policy.bind_control(facts))})
    for name, facts in [('empty', {}), ('scope_only', {'current_scope_and_observation': True}),
                        ('integer_truth', {'current_scope_and_observation': 1, 'exact_locus': 1, 'untried_current_context': 1}),
                        ('string_scope', {'current_scope_and_observation': 'current', 'exact_locus': True, 'untried_current_context': True}),
                        ('null_locus', {'current_scope_and_observation': True, 'exact_locus': None, 'untried_current_context': True})]:
        POLICY_CASES.append({'id': 'choose:' + name, 'operation': 'evaluate', 'facts': facts,
                             'interpretation': plain(policy.interpret(facts)), 'value': plain(policy.evaluate(facts))})


def acquire_scene(family, empty, rows, current_box):
    """Two controlled source acquisitions ending in the exact supplied raster."""
    family.restore(empty)
    frames = []
    left, top, right, bottom = current_box
    for index, delta in enumerate([12, 6, 0]):
        view = copy.deepcopy(rows)
        if delta:
            paint(view, current_box, 0)
            paint(view, [left + delta, top, right + delta, bottom], 7, True)
            paint(view, [left + delta + 1, top + 1, right + delta - 1, bottom - 1], index + 2)
        frames.append({'rows': view, 'observation': obs(view, index + 1)})
    records = []
    for index in [1, 2]:
        first, second = frames[index - 1], frames[index]
        acquired = family.record(first['observation'], second['observation'], {'action_ref': 'ACTION3'}, first['rows'], second['rows'])
        records.append({'before': first['observation'], 'after': second['observation'], 'first': first['rows'], 'second': second['rows'],
                        'command': {'action_ref': 'ACTION3'}, 'value': plain(acquired), 'afterState': plain(family.state())})
    assert family.control is not None
    return {'qualification': 'Controlled raster transitions only, independently acquired by unchanged source.',
            'frames': frames, 'records': records, 'state': plain(family.state())}


def memory_cases(family, empty, example, geometry):
    initial, middle, current = example['snapshots']
    acquired = example['acquiredState']; proposal = example['proposal']; rows = current['rows']; observation = current['observation']
    for index, transition in enumerate(example['transitions']):
        args = {k: transition[k] for k in ['before', 'after', 'command', 'first', 'second']}
        memory_case(family, empty, f'record:acquire_{index + 1}', 'record', args,
                    lambda f, a=args: f.record(a['before'], a['after'], a['command'], a['first'], a['second']),
                    transition['beforeState'])
    def record_case(name, first, second, command, seed=None, before=None, after=None, plan=None):
        a, b = before or obs(first, 11), after or obs(second, 12)
        args = {'before': a, 'after': b, 'command': command, 'first': first, 'second': second, 'proposal': plan, 'index': 0}
        return memory_case(family, empty, 'record:' + name, 'record', args,
                           lambda f: f.record(a, b, command, first, second, plan, 0), seed)
    record_case('no_motion', initial['rows'], initial['rows'], {'action_ref': 'ACTION4'})
    record_case('wrong_direction', initial['rows'], middle['rows'], {'action_ref': 'ACTION3'})
    record_case('wrong_axis', initial['rows'], middle['rows'], {'action_ref': 'ACTION2'})
    record_case('interaction_does_not_establish_translation', initial['rows'], middle['rows'], {'action_ref': 'ACTION5'})
    record_case('point_does_not_establish_translation', initial['rows'], middle['rows'], {'action_ref': 'ACTION6', 'data': {'x': 4, 'y': 4}})
    uniform_first, uniform_second = raster(), raster()
    paint(uniform_first, [2, 2, 6, 6], 7, True); paint(uniform_second, [8, 2, 12, 6], 7, True)
    no_contrast = record_case('same_interior_first', uniform_first, uniform_second, {'action_ref': 'ACTION4'})
    uniform_third = paint(raster(), [14, 2, 18, 6], 7, True)
    record_case('same_interior_second_still_unacquired', uniform_second, uniform_third, {'action_ref': 'ACTION4'}, no_contrast['afterState'], obs(uniform_second, 12), obs(uniform_third, 13))
    diagonal = paint(raster(), [8, 8, 12, 12], 7, True); paint(diagonal, [9, 9, 11, 11], 3)
    record_case('diagonal_displacement_not_acquired', initial['rows'], diagonal, {'action_ref': 'ACTION4'})
    recolored = copy.deepcopy(middle['rows']); paint(recolored, [8, 2, 12, 6], 6, True)
    record_case('changed_palette_signature', initial['rows'], recolored, {'action_ref': 'ACTION4'})
    source_ambiguous = copy.deepcopy(initial['rows']); paint(source_ambiguous, [22, 12, 26, 16], 7, True)
    target_ambiguous = copy.deepcopy(middle['rows']); paint(target_ambiguous, [22, 12, 26, 16], 7, True)
    record_case('duplicate_old_signature', source_ambiguous, middle['rows'], {'action_ref': 'ACTION4'})
    record_case('duplicate_new_signature', initial['rows'], target_ambiguous, {'action_ref': 'ACTION4'})
    record_case('two_signature_aliases', source_ambiguous, target_ambiguous, {'action_ref': 'ACTION4'})
    autonomous_first = copy.deepcopy(initial['rows']); autonomous_second = copy.deepcopy(middle['rows'])
    paint(autonomous_first, [2, 14, 3, 15], 10); paint(autonomous_second, [4, 14, 5, 15], 10)
    record_case('autonomous_translation_count_preserved', autonomous_first, autonomous_second, {'action_ref': 'ACTION4'})
    for name, delta, command in [('up', [0, -4], 'ACTION1'), ('down', [0, 4], 'ACTION2'), ('left', [-4, 0], 'ACTION3'), ('right', [4, 0], 'ACTION4')]:
        first = paint(raster(), [10, 10, 14, 14], 7, True); paint(first, [11, 11, 13, 13], 2)
        second = paint(raster(), [10 + delta[0], 10 + delta[1], 14 + delta[0], 14 + delta[1]], 7, True)
        paint(second, [11 + delta[0], 11 + delta[1], 13 + delta[0], 13 + delta[1]], 3)
        record_case('declared_axis_' + name, first, second, {'action_ref': command})
    doubled = []
    for index, snap in enumerate(example['snapshots']):
        frame = copy.deepcopy(snap['rows']); left = 2 + index * 6
        paint(frame, [left, 14, left + 4, 18], 11, True); paint(frame, [left + 1, 15, left + 3, 17], 4 + index)
        doubled.append(frame)
    first_two = record_case('two_eligible_tracks_first', doubled[0], doubled[1], {'action_ref': 'ACTION4'})
    second_two = record_case('two_eligible_tracks_remain_ambiguous', doubled[1], doubled[2], {'action_ref': 'ACTION4'}, first_two['afterState'], obs(doubled[1], 12), obs(doubled[2], 13))
    assert second_two['afterState']['control'] is None and len(second_two['afterState']['tracks']) == 2

    for name, state in [('cold', empty), ('acquired', acquired)]:
        for operation in ['current', 'measure']:
            args = {'obs': observation, 'rows': rows}
            memory_case(family, empty, operation + ':' + name, operation, args,
                        lambda f, op=operation: getattr(f, op)(observation, rows), state)
    duplicate_rows = copy.deepcopy(rows); paint(duplicate_rows, [22, 12, 26, 16], 7, True)
    for name, target in [('missing', raster()), ('duplicate_signature', duplicate_rows)]:
        args = {'obs': obs(target, 5), 'rows': target}
        memory_case(family, empty, 'current:' + name, 'current', args, lambda f, a=args: f.current(a['obs'], a['rows']), acquired)
        memory_case(family, empty, 'measure:' + name, 'measure', args, lambda f, a=args: f.measure(a['obs'], a['rows']), acquired)
    for name, remaining, actions in [('current', 16, None), ('budget_zero', 0, None), ('budget_negative', -1, None), ('operator_unavailable', 16, ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'])]:
        o = copy.deepcopy(observation)
        if actions is not None: o['available_action_refs'] = actions
        args = {'obs': o, 'rows': rows, 'inputs': [], 'remaining': remaining}
        memory_case(family, empty, 'propose:' + name, 'propose', args, lambda f, a=args: f.propose(a['obs'], a['rows'], a['inputs'], a['remaining']), acquired)

    for name, target in [('unique_correspondence', rows), ('missing_correspondence', raster()), ('ambiguous_correspondence', duplicate_rows)]:
        later = obs(target, 4, 2)
        args = {'obs': later, 'rows': target}
        boundary = memory_case(family, empty, 'scope:' + name, 'scope', args, lambda f, a=args: f.scope(a['obs'], a['rows']), acquired)
        record_case('official_boundary_' + name, rows, target, {'action_ref': 'ACTION5'}, acquired, observation, later, proposal)
        if name == 'unique_correspondence':
            memory_case(family, empty, 'measure:recalled_unique_hypothesis', 'measure', args, lambda f: f.measure(later, target), boundary['afterState'])
            args_propose = {**args, 'inputs': [], 'remaining': 16}
            memory_case(family, empty, 'propose:recalled_conditional_operator', 'propose', args_propose, lambda f: f.propose(later, target, [], 16), boundary['afterState'])
    args = {'obs': observation, 'rows': raster()}
    memory_case(family, empty, 'scope:same_epoch_does_not_rewrite_memory', 'scope', args, lambda f: f.scope(observation, args['rows']), acquired)
    memory_case(family, empty, 'restore:partial', 'restore', {'state': {'last': {'action_ref': 'ACTION2'}, 'ignored': 7}},
                lambda f: f.restore({'last': {'action_ref': 'ACTION2'}, 'ignored': 7}), acquired)
    memory_case(family, empty, 'restore:empty_preserves_state', 'restore', {'state': {}}, lambda f: f.restore({}), acquired)
    memory_case(family, empty, 'restore:explicit_null_control', 'restore', {'state': {'control': None}}, lambda f: f.restore({'control': None}), acquired)
    def detached_state(f):
        snapshot = f.state(); snapshot['control']['evidence'].append('controlled:external-mutation')
        snapshot['tracks'].clear()
        return {'mutatedSnapshot': snapshot, 'retainedState': f.state()}
    memory_case(family, empty, 'state:deeply_detached', 'stateDetached', {}, detached_state, acquired)
    def detached_restore(f):
        incoming = copy.deepcopy(acquired); f.restore(incoming)
        incoming['control']['evidence'].append('controlled:incoming-mutation'); incoming['tracks'].clear()
        return f.state()
    memory_case(family, empty, 'restore:deeply_detached', 'restoreDetached', {'state': acquired}, detached_restore)
    for count in [64, 65]:
        seed = copy.deepcopy(acquired)
        seed['control']['transitions'] = [copy.deepcopy(acquired['control']['transitions'][0]) for _ in range(count)]
        args = {'obs': observation, 'rows': rows}
        memory_case(family, empty, f'measure:transition_count_{count}', 'measure', args,
                    lambda f: f.measure(observation, rows), seed)

    local_noop = record_case('operator_no_local_change', rows, rows, proposal['actions'][0], acquired, observation, example['localObservation'], proposal)
    changed = copy.deepcopy(rows); changed[4][15] = 9
    local_change = record_case('operator_local_change', rows, changed, proposal['actions'][0], acquired, observation, obs(changed, 4), proposal)
    remote = copy.deepcopy(rows); remote[20][30] = 9
    record_case('operator_remote_only_is_not_local_efficacy', rows, remote, proposal['actions'][0], acquired, observation, obs(remote, 4), proposal)
    both_changed = copy.deepcopy(changed); both_changed[20][30] = 9
    record_case('operator_local_and_remote_changes', rows, both_changed, proposal['actions'][0], acquired, observation, obs(both_changed, 4), proposal)
    full_methods = copy.deepcopy(acquired); full_methods['methods'] = [dict(local_noop['value'], evidence=[f'old:{i}', f'old:{i + 1}']) for i in range(32)]
    bounded = record_case('method_memory_keeps_latest_32', rows, rows, proposal['actions'][0], full_methods, observation, example['localObservation'], proposal)
    assert len(bounded['afterState']['methods']) == 32 and bounded['afterState']['methods'][-1] == bounded['value']
    args = {'obs': obs(rows, 5, 2), 'rows': rows}
    memory_case(family, empty, 'scope:methods_and_last_event_preserved', 'scope', args, lambda f: f.scope(args['obs'], rows), local_change['afterState'])

    for name, mutate in [('intact', lambda p: None), ('missing_steps', lambda p: p.pop('steps')),
                          ('empty_steps', lambda p: p.update(steps=[])),
                          ('action_step_mismatch', lambda p: p['actions'][0].update(action_ref='ACTION1'))]:
        p = copy.deepcopy(proposal); mutate(p)
        memory_case(family, empty, 'bind:' + name, 'bind', {'proposal': p}, lambda f, p=p: f.bind(p, None), acquired)
    guard_cases = [('intact', copy.deepcopy(proposal), observation, rows, 0),
                   ('scope_changed', copy.deepcopy(proposal), {**observation, 'level_epoch': 2}, rows, 0),
                   ('stale_frame', copy.deepcopy(proposal), {**observation, 'frame_hash': 'different'}, rows, 0),
                   ('unavailable_action', copy.deepcopy(proposal), {**observation, 'available_action_refs': ['ACTION1']}, rows, 0),
                   ('negative_index', copy.deepcopy(proposal), observation, rows, -1),
                   ('past_last_index', copy.deepcopy(proposal), observation, rows, 1),
                   ('observation_ref_is_not_checked_by_original_guard', copy.deepcopy(proposal), {**observation, 'observation_ref': 'different-ref-same-frame'}, rows, 0)]
    mismatch = copy.deepcopy(proposal); mismatch['actions'][0]['action_ref'] = 'ACTION1'
    guard_cases.append(('step_list_binding_mismatch', mismatch, observation, rows, 0))
    missing_rim = copy.deepcopy(rows); missing_rim[2][14] = 0
    guard_cases.append(('rim_changed', copy.deepcopy(proposal), observation, missing_rim, 0))
    wrong_value = copy.deepcopy(proposal); wrong_value['outline_plan']['measurement']['current']['value'] = 9
    guard_cases.append(('claimed_palette_changed', wrong_value, observation, rows, 0))
    for name, p, o, view, index in guard_cases:
        args = {'proposal': p, 'index': index, 'obs': o, 'rows': view}
        memory_case(family, empty, 'before:' + name, 'before', args,
                    lambda f, a=args: f.before(a['proposal'], a['index'], SimpleNamespace(frame_rows=a['rows']), a['obs']), acquired)
    for name, after in [('unknown_operator_effect', example['localObservation']), ('official_boundary', obs(rows, 4, 2))]:
        args = {'proposal': proposal, 'index': 0, 'before': observation, 'after': after, 'first': rows, 'second': rows}
        memory_case(family, empty, 'after:' + name, 'after', args,
                    lambda f, a=args: f.after(a['proposal'], 0, a['before'], a['after'], a['first'], a['second']), acquired)

    route_acquisition = acquire_scene(family, empty, geometry['routeScene'], [2, 2, 6, 6])
    route_state = route_acquisition['state']; route_current = route_acquisition['frames'][-1]
    family.restore(route_state)
    route = family.propose(route_current['observation'], route_current['rows'], [], 16)
    assert route and route['outline_plan']['meaning']['kind'] == 'locus_access_hypothesis'
    for remaining in [1, 2, 16]:
        args = {'obs': route_current['observation'], 'rows': route_current['rows'], 'inputs': [], 'remaining': remaining}
        memory_case(family, empty, f'propose:route_budget_{remaining}', 'propose', args,
                    lambda f, a=args: f.propose(a['obs'], a['rows'], [], a['remaining']), route_state)
    for name, mutate in [('unchanged', lambda r: None), ('locus_border_changed', lambda r: r[1].__setitem__(11, 0)),
                          ('locus_interior_changed', lambda r: r[4].__setitem__(14, 9))]:
        view = copy.deepcopy(route_current['rows']); mutate(view)
        args = {'proposal': route, 'index': 0, 'obs': route_current['observation'], 'rows': view}
        memory_case(family, empty, 'before:route_' + name, 'before', args,
                    lambda f, a=args: f.before(a['proposal'], 0, SimpleNamespace(frame_rows=a['rows']), a['obs']), route_state)
    after_view = copy.deepcopy(route_current['rows']); paint(after_view, [2, 2, 6, 6], 0); paint(after_view, route['steps'][0]['expected_after']['body_bbox'], 7, True)
    for name, view in [('expected_outline', after_view), ('did_not_move', route_current['rows'])]:
        args = {'proposal': route, 'index': 0, 'before': route_current['observation'], 'after': obs(view, 4), 'first': route_current['rows'], 'second': view}
        memory_case(family, empty, 'after:route_' + name, 'after', args,
                    lambda f, a=args: f.after(a['proposal'], 0, a['before'], a['after'], a['first'], a['second']), route_state)
    for name, scene in [('announced', geometry['accompanimentScene']), ('contact', geometry['contactScene'])]:
        acquisition = acquire_scene(family, empty, scene, [7, 2, 11, 6])
        current = acquisition['frames'][-1]
        for has_method in [False, True]:
            seed = copy.deepcopy(acquisition['state'])
            if has_method: seed['methods'] = [local_change['value']]
            args = {'obs': current['observation'], 'rows': current['rows'], 'inputs': [], 'remaining': 16}
            memory_case(family, empty, f'propose:{name}_local_method_{has_method}', 'propose', args,
                        lambda f, a=args: f.propose(a['obs'], a['rows'], [], 16), seed)
    return {'route': route_acquisition, 'routeProposal': plain(route)}


def initial_cases(family, empty):
    corpus = helper.read_json(helper.INITIAL)
    result = []
    for index, item in enumerate(corpus['games']):
        family.restore(empty)
        rows = item['packet']['frame_rows']
        observation = {key: item['observation'][key] for key in ['observation_ref', 'frame_hash', 'level_epoch', 'levels_completed', 'available_action_refs', 'state', 'revision']}
        contours = helper.boxes(rows)
        proposal = family.propose(observation, rows, [], 16)
        assert proposal is None and family.control is None
        result.append({'index': index, 'game': item['game'], 'rows': rows, 'observation': observation,
                       'boxes': plain(contours), 'proposal': plain(proposal), 'afterState': plain(family.state())})
    assert len(result) == 100
    return result


def identity_boundary_cases():
    for index, value in enumerate([None, True, False, 0, 9007199254740991, -9007199254740991,
                                   {'unicode': 'é Ω 🧠', 'escaped': '\n\\"', 'null': None},
                                   {'width': 16, 'height': 3, 'palette': 255, 'points': [[0, 0], [15, 2]]}]):
        add(f'identity:safe_domain_{index}', 'digest', {'value': value}, lambda v=value: helper.digest(v),
            'declared_safe_integer_json_identity_domain')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='tests/fixtures/v6-outline-service-reference.json.gz')
    parser.add_argument('--summary', default='docs/migration/native-campaigns-v53/source-reference-contracts.json')
    args = parser.parse_args()
    assert not (ROOT / args.output).exists(), 'Refusing fixture overwrite'
    assert not (ROOT / args.summary).exists(), 'Refusing summary overwrite'
    sys.setprofile(profile)
    family = OutlineService()
    empty = plain(family.state())
    policy = family.policy
    example = acquisition_example(family)
    geometry = geometry_cases(policy)
    policy_cases(policy)
    additional = memory_cases(family, empty, example, geometry)
    public = initial_cases(family, empty)
    identity_boundary_cases()
    sys.setprofile(None)
    helper.AUDIT_ACTIVE = False
    assert not PENDING
    assert helper.verify_source_manifest() == helper.VERIFIED_SOURCE
    footprint = helper.source_footprint()
    assert not [row for row in CASES if 'error' in row], [(row['id'], row['error']) for row in CASES if 'error' in row]
    counts = {'geometryCases': len(CASES), 'policyCases': len(POLICY_CASES), 'memoryCases': len(MEMORY_CASES),
              'publicInitialViews': len(public), 'qualifiedIdentityRecipes': len(RECIPES)}
    result = {'schema': 'logos-engine.v6.outline-service-original-reference.v1', 'sourceCommit': helper.COMMIT,
              'sourceFilesVerifiedBeforeImport': len(helper.VERIFIED_SOURCE), 'sourceFilesVerifiedAfterExport': len(helper.VERIFIED_SOURCE),
              'sourceUnchanged': True, 'sourceBytecodeCachesRead': False, 'sourceBytecodeCachesWritten': False,
              'generator': helper.proof(Path(__file__).relative_to(ROOT).as_posix()),
              'probe': helper.proof(Path(helper.__file__).relative_to(ROOT).as_posix()),
              'initialPublicCorpus': helper.proof(helper.INITIAL),
              'configuration': {'policy': plain(policy.config), 'control': plain(policy.control_config), 'route': plain(policy.route_config)},
              'initialState': empty, 'controlledAcquisition': example, 'additionalControlledAcquisitions': additional,
              'geometryCases': CASES, 'policyCases': POLICY_CASES, 'memoryCases': MEMORY_CASES,
              'publicInitial': public, 'identityRecipes': [RECIPES[key] for key in sorted(RECIPES)],
              'footprint': footprint, 'counts': counts,
              'scope': {'hostSessions': 0, 'dispatchedActions': 0, 'completedLevels': 0, 'nativeExecution': False,
                        'sourceFunctionsReplaced': False, 'referenceGeneratedFromNativeOutput': False},
              'qualification': 'Expected values come from unchanged original Python, its actual V5 geometry and original DRM/SRC. Synthetic transitions are bounded component contracts, never successful game evidence or a cold memory seed. Direct V5 helper contracts may exercise public fields not supplied by OutlineService.measure; that broader helper domain is not a claim that the family uses those branches.'}
    helper.write_gzip_absent(args.output, result)
    summary = {'schema': 'logos-engine.v53.outline-source-contracts.v1', 'status': 'passed', 'sourceCommit': helper.COMMIT,
               'sourceUnchanged': True, 'sourceFilesVerifiedBeforeImport': len(helper.VERIFIED_SOURCE),
               'sourceFilesVerifiedAfterExport': len(helper.VERIFIED_SOURCE), 'counts': counts,
               'fixture': helper.proof(args.output), 'generator': result['generator'], 'probe': result['probe'],
               'importedSourceModuleCount': len(footprint['importedSourceFiles']),
               'actuallyAccessedSourceFiles': len(footprint['accessedSourceFiles']),
               'accessedDrmFiles': sum(name.endswith('.drm') for name in footprint['accessedSourceFiles']),
               'sourceBytecodeCachesRead': False, 'sourceBytecodeCachesWritten': False,
               'scope': result['scope'], 'qualification': result['qualification']}
    destination = ROOT / args.summary; destination.parent.mkdir(parents=True, exist_ok=True)
    raw = (json.dumps(summary, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()
    assert len(raw) < 1024 * 1024
    with destination.open('xb') as stream: stream.write(raw)
    print(json.dumps({'status': 'passed', 'output': args.output, 'summary': args.summary, **counts,
                      'importedSourceModules': len(footprint['importedSourceFiles']),
                      'accessedSourceFiles': len(footprint['accessedSourceFiles'])}), flush=True)


if __name__ == '__main__':
    main()
