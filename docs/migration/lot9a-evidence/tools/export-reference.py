#!/usr/bin/env python3
"""Independent, bounded ChartNavigation reference from immutable original Python.

Every input raster is drawn here without importing any native module or game.
Ordinary source state/restore methods are used; no original method is patched.
The declaration is frozen and hashed before any original import/evaluation.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
import gzip
import hashlib
import importlib
import importlib.abc
import importlib.machinery
import json
from pathlib import Path
import signal
import sys
import time
import traceback
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[4]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = SOURCE.parent / 'manifest.json'
DECLARATION = ROOT / 'docs/migration/lot9a-evidence/reference-01/declaration.json'
sys.dont_write_bytecode = True
ALL_ACTIONS = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4']
STATE_FIELDS = ['epoch', 'chart', 'position', 'positions', 'position_status', 'visited',
                'grants', 'gains', 'views', 'blocked', 'evidence', 'portable', 'last', 'method_use']


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def fp(path):
    p = Path(path)
    return {'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)}


def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump(mode='json'))
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value


def paint(rows, box, value):
    x0, y0, x1, y1 = box
    assert 0 <= x0 <= x1 < 64 and 0 <= y0 <= y1 < 64
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): rows[y][x] = value


def square(rows, center, size, inside, marker=False):
    x, y = center; half = size // 2
    paint(rows, [x-half, y-half, x+half, y+half], 8)
    paint(rows, [x-half+1, y-half+1, x+half-1, y+half-1], 0 if inside is None else inside)
    if inside is None: rows[y-1][x-1] = 6
    if marker:
        for xx in (x-half, x+half):
            for yy in (y-half, y+half): rows[yy][xx] = 3
        rows[y][x] = 3


def slots(rows, held=()):
    for x in (10, 22): square(rows, (x, 55), 7, 0)
    for i, value in enumerate(held): rows[55][10+12*i] = value


def chart_rows(marker='A', branch=False, held=()):
    rows = [[0] * 64 for _ in range(64)]
    points = {'A': (10, 10), 'B': (22, 10), 'C': (34, 10), 'D': (22, 22) if branch else (46, 10)}
    interiors = {'A': 2, 'B': None if branch else 4, 'C': 4 if branch else None, 'D': 2}
    links = [('A', 'B', 1), ('B', 'C', 1), ('B', 'D', 4)] if branch else [('A', 'B', 1), ('B', 'C', 1), ('C', 'D', 4)]
    for a, b, color in links:
        x, y = points[a]; xx, yy = points[b]
        paint(rows, [min(x, xx), min(y, yy), max(x, xx), max(y, yy)], color)
    for name, point in points.items(): square(rows, point, 5, interiors[name], name == marker)
    slots(rows, held)
    return rows


def room_rows(number, held=(), boundary=None):
    rows = [[0] * 64 for _ in range(64)]
    paint(rows, [24 + number, 24, 25 + number, 26], 5)
    rows[29][30] = 6
    slots(rows, held)
    if boundary is not None: paint(rows, [60, 20, 61, 22], boundary)
    return rows


def capture(call):
    try: return {'value': plain(call())}
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
        return {'error': {'name': type(error).__name__, 'message': str(error)}}


def imported_source_paths():
    paths = {Path(m.__file__).resolve() for m in list(sys.modules.values())
             if getattr(m, '__file__', None) and Path(m.__file__).resolve().is_relative_to(SOURCE)}
    paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/chart_navigation').glob('*.drm'))
    paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/chart_navigation').glob('*.src'))
    return sorted(paths)


def verify_sources(paths, manifest):
    for path in paths:
        relative = path.relative_to(SOURCE).as_posix()
        assert relative in manifest['files'], relative
        record = manifest['files'][relative]
        assert path.stat().st_size == record['bytes'] and sha(path) == record['sha256'], relative
    return {p.relative_to(SOURCE).as_posix(): sha(p) for p in paths}


def make_corpus(raw_log, declaration):
    frames, geometry_cases, family_cases, policy_cases, sequences = {}, [], [], [], {}

    def log(kind, item):
        raw_log.write(json.dumps({'kind': kind, **item}, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
        raw_log.flush()

    def frame(name, rows, epoch=1, score=0, actions=None, revision=None):
        assert name not in frames and len(frames) < declaration['bounds']['maximumFrames']
        assert len(rows) == 64 and all(len(row) == 64 and all(type(v) is int and 0 <= v <= 15 for v in row) for row in rows)
        public = {'frame_rows': deepcopy(rows), 'frame_packet': [deepcopy(rows)],
                  'frame_hash': hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16],
                  'level': epoch, 'levels_completed': score, 'state': 'NOT_FINISHED',
                  'available_action_refs': ALL_ACTIONS if actions is None else actions}
        observation = plain(observe(SimpleNamespace(**public), len(frames) + 1 if revision is None else revision, 'chart:synthetic')[0])
        item = {'rows': deepcopy(rows), 'observation': observation, 'public': public}
        frames[name] = item; log('frame', {'id': name, **item}); return item

    def gcase(name, operation, arguments):
        assert len(geometry_cases) < declaration['bounds']['maximumGeometryCases']
        source_method = {'chartRectangles': 'rectangles', 'measureChart': 'measure', 'chartInventory': 'inventory',
                         'chartScene': 'scene', 'decodeChart': 'decoded', 'routeChart': 'route', 'chartDigest': 'digest'}.get(operation)
        args = deepcopy(arguments)
        if operation == 'routeChart': args[3] = {tuple(p) for p in args[3]}
        if operation == 'decodeChartFragments':
            request = args[0]
            request['charts'] = tuple(ChartFragment(**item) for item in request['charts'])
            request['scope'] = MechanicalFamilyScope(**request['scope'])
            run = lambda: _chart_decode(SimpleNamespace(**request))
        else: run = lambda: getattr(geometry, source_method)(*args)
        item = {'id': name, 'operation': operation, 'arguments': plain(arguments), **capture(run)}
        geometry_cases.append(item); log('geometry', item); return item

    def fcase(name, operation, arguments, seed=None, counterfactual=None):
        assert len(family_cases) < declaration['bounds']['maximumOwnerOperations']
        owner = ChartNavigation()
        if seed is not None: owner.restore(deepcopy(seed))
        state = plain(owner.state()); assert set(state) == set(STATE_FIELDS)
        args = deepcopy(arguments)
        if operation == 'before': args[2] = SimpleNamespace(**args[2])
        method = {'proposeSource': 'propose', 'recordSource': 'record', 'returnedView': 'returned_view'}.get(operation, operation)
        item = {'id': name, 'operation': operation, 'arguments': plain(arguments), 'seedState': state}
        if counterfactual: item['counterfactual'] = counterfactual
        item.update(capture(lambda: getattr(owner, method)(*args)))
        item['afterState'] = plain(owner.state()); family_cases.append(item); log('owner', item); return item

    def owner_step(label, before_name, after_name, seed=None, returned=()):
        a, b = frames[before_name], frames[after_name]
        proposed = fcase(label + '_propose', 'proposeSource', [a['observation'], a['rows'], [], 8], seed)
        assert proposed.get('value') is not None, label
        proposal, proposed_state = proposed['value'], proposed['afterState']
        admitted = fcase(label + '_before', 'before', [proposal, 0, a['public'], a['observation']], proposed_state)
        assert admitted['value']['admitted'], label
        compared = fcase(label + '_after', 'after', [proposal, 0, a['observation'], b['observation'], a['rows'], b['rows']], proposed_state)
        returned_names = list(returned or [after_name]); returned_rows = [frames[name]['rows'] for name in returned_names]
        acquired = fcase(label + '_record', 'recordSource', [a['observation'], b['observation'], proposal['actions'][0],
                         a['rows'], b['rows'], proposal, 0, returned_rows], proposed_state)
        assert 'error' not in acquired, label
        return {'beforeFrame': before_name, 'afterFrame': after_name, 'returnedFrames': returned_names,
                'observation': a['observation'], 'afterObservation': b['observation'], 'proposal': proposal,
                'proposalState': proposed_state, 'before': admitted['value'], 'after': compared['value'],
                'record': acquired['value'], 'afterState': acquired['afterState']}

    cold = frame('chart_cold', chart_rows())
    frame('room_b_held', room_rows(1, [4])); frame('room_c_empty', room_rows(2)); frame('room_d_empty', room_rows(3))
    frame('room_c_boundary4', room_rows(2, boundary=4)); frame('room_b_empty', room_rows(1), revision=3)
    frame('room_b_boundary4', room_rows(1, boundary=4)); frame('room_b_equal_held', room_rows(1, [4]), revision=3)
    frame('chart_contrary_anchor', chart_rows('D'), revision=2)
    frame('branch_chart', chart_rows(branch=True), revision=1); frame('branch_room_b', room_rows(1), revision=2); frame('branch_room_b_held', room_rows(1, [4]), revision=3)
    frame('chart_new_epoch', chart_rows(), epoch=2, score=1, revision=5); frame('blank_new_epoch', [[0]*64 for _ in range(64)], epoch=2, revision=5)
    frame('chart_with_inventory', chart_rows(held=[4]))
    frame('chart_mirror', [list(reversed(row)) for row in cold['rows']])
    frame('chart_palette', [[(5*v+3) % 16 for v in row] for row in cold['rows']])
    no_marker = chart_rows(marker=None); frame('no_marker', no_marker)
    two = chart_rows(); square(two, (46, 10), 5, 2, True); frame('two_markers', two)
    no_slots = chart_rows(); paint(no_slots, [0, 50, 63, 63], 0); frame('no_slots', no_slots)
    one = chart_rows(); paint(one, [19, 52, 25, 58], 0); frame('one_slot', one)
    groups = chart_rows(); square(groups, (10, 43), 7, 0); square(groups, (22, 43), 7, 0); frame('two_slot_groups', groups)
    wrong = chart_rows(); wrong[10][10] = 2; frame('wrong_marker_center', wrong)
    disconnected = chart_rows(); paint(disconnected, [37, 10, 43, 10], 8); frame('disconnected_goal', disconnected)
    mixed = chart_rows(); mixed[10][39] = 9; frame('mixed_link', mixed)
    frame('blank', [[0]*64 for _ in range(64)])
    frame('room_c_inventory_retained', room_rows(2, [4]))
    frame('room_c_boundary_retained', room_rows(2, boundary=4))
    foreign = room_rows(2, boundary=4); foreign[10][10] = 7; frame('foreign_intermediate', foreign)

    gcase('all_rectangles_at_origin_size', 'chartRectangles', [cold['rows']])
    measured = gcase('unique_cold_chart', 'measureChart', [cold['rows'], cold['observation']])['value']
    assert measured is not None and len(measured['nodes']) == 4 and len(measured['links']) == 6
    assert measured['current'] == [10, 10] and measured['pitch'] == 12 and measured['field_bottom'] == 52
    assert gcase('empty_inventory_is_not_annotation4', 'chartInventory', [cold['rows'], measured])['value'] == []
    assert gcase('actual_peripheral_inventory4', 'chartInventory', [frames['chart_with_inventory']['rows'], measured])['value'] == [4]
    initial_scene = gcase('scene_above_inventory', 'chartScene', [cold['rows'], measured])['value']
    assert gcase('inventory_does_not_change_scene', 'chartScene', [frames['chart_with_inventory']['rows'], measured])['value'] == initial_scene
    gcase('consumed_v5_decode_from_geometry', 'decodeChart', [measured, cold['observation']])
    for name in ('chart_mirror', 'chart_palette', 'no_marker', 'two_markers', 'no_slots', 'one_slot', 'two_slot_groups', 'wrong_marker_center', 'disconnected_goal', 'mixed_link', 'blank'):
        gcase(name, 'measureChart', [frames[name]['rows'], frames[name]['observation']])
    gcase('empty_rectangle_input', 'chartRectangles', [[]])
    gcase('route_to_goal', 'routeChart', [measured, [10, 10], [46, 10], [], []])
    gcase('route_same_node_is_empty', 'routeChart', [measured, [10, 10], [10, 10], [], []])
    gcase('route_blocked_directed_edge', 'routeChart', [measured, [10, 10], [46, 10], [], ['[22, 10]>[34, 10]']])
    gcase('route_excluded_dependency', 'routeChart', [measured, [10, 10], [46, 10], [[22, 10]], []])
    directed = deepcopy(measured); directed['links'] = [e for e in measured['links'] if e['delta'] == [1, 0]]
    gcase('route_no_invented_reverse_link', 'routeChart', [directed, [46, 10], [10, 10], [], []])
    gcase('python_sorted_unicode_digest', 'chartDigest', [{'é': [1, 2], 'anchor': 'π'}])
    scope = {'request_ref': 'synthetic:decode', 'caller_ref': 'chart-reference', 'parent_goal_ref': 'controlled',
             'parent_contribution_ref': 'partial-chart', 'epoch': 1, 'evidence_revision_ref': 'synthetic:evidence',
             'model_revision_ref': 'synthetic:model', 'model_status_ref': 'geometry_only', 'event_owner_ref': 'synthetic:evidence',
             'input_domain_complete': False, 'assumption_refs': ['chart-is-hypothesis']}
    fragment = {'chart_ref': 'synthetic:rational', 'lattice_ref': 'separate-measured-pitch', 'measured_origin': [1, 1],
                'measured_pitch': [4, 3], 'nodes': [
                    {'chart_node_ref': 'a', 'point': [3, 5], 'signature_refs': ['s'], 'static_key_type_refs': [], 'static_door_refs': [], 'disclosed': True},
                    {'chart_node_ref': 'b', 'point': [3, 5], 'signature_refs': ['s'], 'static_key_type_refs': [], 'static_door_refs': [], 'disclosed': False},
                    {'chart_node_ref': 'c', 'point': [6, 7], 'signature_refs': ['t', 'u'], 'static_key_type_refs': [], 'static_door_refs': [], 'disclosed': True}],
                'links': [{'from_ref': 'a', 'to_ref': 'c', 'direction_ref': 'observed:east', 'supported_evidence_ref': 'synthetic:link'}],
                'current_marker_alternatives': ['a', 'b'], 'corner_anchor_refs': ['synthetic:corner']}
    request = {'charts': [fragment], 'maximum_evaluations': 4096, 'scope': scope,
               'operation_ref': 'mechanics.charted_room_navigation.decode_chart', 'mode': 'MEASURE'}
    for name, bound in [('rational_partial_aliases', 4096), ('decode_exact_bound', 4), ('decode_below_bound', 3)]:
        gcase(name, 'decodeChartFragments', [{**deepcopy(request), 'maximum_evaluations': bound}])
    gcase('declared_complete_decode', 'decodeChartFragments', [{**deepcopy(request), 'scope': {**scope, 'input_domain_complete': True}}])
    gcase('empty_declared_decode_domain', 'decodeChartFragments', [{**deepcopy(request), 'charts': [], 'maximum_evaluations': 0}])

    cold_state = plain(ChartNavigation().state())
    first = owner_step('primary_1', 'chart_cold', 'room_b_held')
    second = owner_step('primary_2', 'room_b_held', 'room_c_empty', first['afterState'], ['room_c_boundary4', 'room_c_empty'])
    third = owner_step('primary_3', 'room_c_empty', 'room_d_empty', second['afterState'])
    assert first['afterState']['visited'] == [[22, 10]] and len(first['afterState']['gains']) == 1
    assert second['afterState']['position'] == [34, 10] and len(second['afterState']['grants']) == 1
    assert second['afterState']['grants'][0]['status'] == 'local_permission_hypothesis_not_confirmed_transaction'
    assert third['afterState']['position'] == [46, 10]
    assert fcase('target_reached_without_official_score', 'proposeSource', [frames['room_d_empty']['observation'], frames['room_d_empty']['rows'], [], 8], third['afterState'])['value'] is None
    sequences['primary'] = {'qualification': 'Cold component, three controlled raster returns, no official completion claim.', 'coldState': cold_state, 'steps': [first, second, third]}

    equal = owner_step('same_scene', 'room_b_held', 'room_b_equal_held', first['afterState'])
    assert equal['afterState']['positions'] == [[22, 10], [34, 10]]
    continued = fcase('same_scene_compatible_direction_continues', 'proposeSource', [frames['room_b_equal_held']['observation'], frames['room_b_equal_held']['rows'], [], 8], equal['afterState'])
    assert continued['value']['actions'] == [{'action_ref': 'ACTION4'}]
    anchor = owner_step('boundary_anchor', 'room_b_held', 'room_b_empty', first['afterState'], ['room_b_boundary4', 'room_b_empty'])
    assert anchor['afterState']['position_status'] == 'conditional_current_boundary_annotation_anchor'
    assert anchor['afterState']['position'] == [34, 10] and len(anchor['afterState']['grants']) == 1
    anchored_final = owner_step('boundary_anchor_final', 'room_b_empty', 'room_d_empty', anchor['afterState'])
    sequences['ambiguousBoundary'] = {'qualification': 'Cold acquisition then equal-scene loss and explicit boundary annotation; local conditional correspondence only.', 'coldState': cold_state, 'steps': [first, anchor, anchored_final]}
    contrary = owner_step('contrary_anchor', 'chart_cold', 'chart_contrary_anchor')
    assert contrary['afterState']['position_status'] == 'current_anchor_refutes_predicted_arrival'
    sequences['contraryAnchor'] = {'qualification': 'Current public corner anchor contradicts the predicted arrival.', 'coldState': cold_state, 'steps': [contrary]}
    branch_first = owner_step('branch_1', 'branch_chart', 'branch_room_b')
    branch_second = owner_step('branch_2', 'branch_room_b', 'branch_room_b_held', branch_first['afterState'])
    assert branch_second['afterState']['positions'] == [[22, 10], [34, 10]]
    assert branch_second['afterState']['gains'][0]['current_occurrence'] is None
    assert fcase('incompatible_directions_abstain', 'proposeSource', [frames['branch_room_b_held']['observation'], frames['branch_room_b_held']['rows'], [], 8], branch_second['afterState'])['value'] is None
    sequences['incompatibleDirections'] = {'qualification': 'Cold route to dependency, then indistinguishable stay/arrival with incompatible directions to the goal.', 'coldState': cold_state, 'steps': [branch_first, branch_second]}

    a, b = frames['room_b_held'], frames['room_c_empty']; proposal = second['proposal']; seed = second['proposalState']
    def record_variant(name, before_name='room_b_held', after_name='room_c_empty', returned=(), supplied=proposal, state=seed, cf=None):
        aa, bb = frames[before_name], frames[after_name]
        return fcase(name, 'recordSource', [aa['observation'], bb['observation'], proposal['actions'][0], aa['rows'], bb['rows'], supplied, 0,
                         [frames[n]['rows'] for n in returned]], state, cf)
    no_context = record_variant('loss_without_boundary_frame')
    assert not no_context['afterState']['grants']
    record_variant('no_inventory_loss_no_permission', after_name='room_c_inventory_retained', returned=['room_c_boundary4'])
    retained = record_variant('boundary_pigment_not_removed', after_name='room_c_boundary_retained', returned=['room_c_boundary4'])
    assert not retained['afterState']['grants']
    record_variant('foreign_pixels_disqualify_intermediate', returned=['foreign_intermediate'])
    record_variant('unattributed_scene_withdraws_location', supplied=None)
    record_variant('unattributed_same_scene_preserves_location', after_name='room_b_equal_held', supplied=None)
    initial = record_variant('return_to_original_chart_is_contrary', after_name='chart_cold')
    assert initial['afterState']['position_status'] == 'current_anchor_refutes_predicted_arrival'
    missing = deepcopy(seed); missing['chart']['links'] = [e for e in missing['chart']['links'] if not (e['from'] == [34, 10] and e['to'] == [46, 10])]
    unknown = record_variant('missing_link_cannot_refute_location', after_name='room_b_empty', returned=['room_b_boundary4'], state=missing,
                             cf={'base': 'primary_2_propose', 'changedField': 'chart.links', 'change': 'Remove explicit C-to-D link only', 'coldPhysicalQualification': False})
    assert unknown['afterState']['position'] is None and unknown['afterState']['positions'] == [[22, 10], [34, 10]] and not unknown['afterState']['grants']
    prior_permission = deepcopy(seed); prior_permission['grants'] = deepcopy(second['afterState']['grants']); prior_permission['visited'] = [[22, 10]]
    refuted = record_variant('contrary_anchor_retracts_prior_permission', after_name='chart_cold', state=prior_permission,
                            cf={'base': 'primary_2_propose', 'changedFields': ['grants', 'visited'], 'change': 'Attach already measured source receipt to test contrary-anchor retraction', 'coldPhysicalQualification': False})
    assert not refuted['afterState']['grants'] and not refuted['afterState']['visited']

    edge = {'from': [34, 10], 'to': [46, 10], 'delta': [1, 0], 'annotation': 4}; c = seed['chart']
    for name, candidates, final, e in [
        ('returned_frame_boundary', [frames['room_c_boundary4']['rows'], b['rows']], b['rows'], edge),
        ('returned_frame_absent', [], b['rows'], edge),
        ('returned_frame_wrong_dimensions', [frames['room_c_boundary4']['rows'][:-1]], b['rows'], edge),
        ('returned_frame_foreign_difference', [frames['foreign_intermediate']['rows']], b['rows'], edge),
        ('returned_frame_wrong_side', [frames['room_c_boundary4']['rows']], b['rows'], {**edge, 'delta': [-1, 0]}),
        ('returned_frame_pigment_remains', [frames['room_c_boundary4']['rows']], frames['room_c_boundary_retained']['rows'], edge),
    ]: fcase(name, 'returnedView', [c, e, 4, candidates, final, b['observation']], seed)

    initial_proposal, initial_seed = first['proposal'], first['proposalState']
    fcase('bind_exact', 'bind', [initial_proposal, None], initial_seed)
    bad = deepcopy(initial_proposal); bad['actions'][0]['action_ref'] = 'ACTION3'
    fcase('bind_action_step_mismatch', 'bind', [bad, None], initial_seed)
    bad['steps'][0]['action'] = deepcopy(bad['actions'][0])
    fcase('guard_consistent_wrong_direction', 'before', [bad, 0, cold['public'], cold['observation']], initial_seed)
    for field, value in [('observation_ref', 'changed'), ('level_epoch', 2), ('frame_hash', 'changed')]:
        fcase('guard_stale_' + field, 'before', [initial_proposal, 0, cold['public'], {**cold['observation'], field: value}], initial_seed)
    fcase('guard_wrong_index', 'before', [initial_proposal, 1, cold['public'], cold['observation']], initial_seed)
    fcase('guard_missing_action', 'before', [initial_proposal, 0, cold['public'], {**cold['observation'], 'available_action_refs': []}], initial_seed)
    fcase('guard_changed_inventory', 'before', [initial_proposal, 0, frames['chart_with_inventory']['public'], cold['observation']], initial_seed)
    fcase('guard_source_does_not_compare_score_directly', 'before', [initial_proposal, 0, cold['public'], {**cold['observation'], 'levels_completed': 1}], initial_seed)
    fcase('zero_budget_does_not_scope', 'proposeSource', [cold['observation'], cold['rows'], [], 0])
    fcase('missing_direction_abstains', 'proposeSource', [{**cold['observation'], 'available_action_refs': ['ACTION1']}, cold['rows'], [{'action_ref': 'ACTION4'}], 8])
    fcase('inputs_do_not_override_observed_actions', 'proposeSource', [cold['observation'], cold['rows'], [{'action_ref': 'ACTION1'}], 8])
    for name in ('no_marker', 'two_markers', 'disconnected_goal'):
        fcase(name + '_proposal', 'proposeSource', [frames[name]['observation'], frames[name]['rows'], [], 8])
    over = deepcopy(first['afterState']); over['positions'] = [[22, 10] for _ in range(33)]; over['position'] = None
    fcase('maximum_location_alternatives', 'offers', [a['observation'], a['rows']], over,
          {'base': 'primary_1_record', 'changedFields': ['positions', 'position'], 'change': '33 repeated component alternatives isolate configured bound; not physical states', 'coldPhysicalQualification': False})
    fcase('current_chart_remeasures_anchor', 'current', [cold['observation'], cold['rows']], initial_seed)
    fcase('restore_partial_and_unknown_key', 'restore', [{'last': None, 'unrelated': 'ignored'}], second['afterState'])
    fcase('restore_full_original_snapshot', 'restore', [second['afterState']])
    fcase('same_epoch_keeps_acquisitions', 'scope', [b['observation']], second['afterState'])
    fcase('scope_without_evidence_has_no_portable', 'scope', [frames['chart_new_epoch']['observation']], initial_seed)
    final = frames['room_d_empty']; official = frames['chart_new_epoch']
    boundary = fcase('official_boundary_retains_interpretation_only', 'recordSource', [final['observation'], official['observation'], third['proposal']['actions'][0],
                     final['rows'], official['rows'], third['proposal'], 0, [official['rows']]], third['afterState'])
    assert len(boundary['afterState']['portable']) == 1 and boundary['afterState']['chart'] is None and not boundary['afterState']['grants']
    fcase('portable_method_requires_current_morphology', 'proposeSource', [official['observation'], official['rows'], [], 8], boundary['afterState'])
    fcase('new_scope_without_official_score', 'recordSource', [final['observation'], frames['blank_new_epoch']['observation'], third['proposal']['actions'][0],
          final['rows'], frames['blank_new_epoch']['rows'], third['proposal'], 0, []], third['afterState'])
    fcase('no_chart_record_is_empty', 'recordSource', [cold['observation'], a['observation'], {'action_ref': 'ACTION4'}, cold['rows'], a['rows'], None, 0, []])

    policy = ChartNavigation().policy
    def offer(kind='annotation_dependency', distance=2, action='ACTION4', **facts):
        return {'kind': kind, 'distance': distance, 'action': action,
                'facts': {'current_scope': True, 'conditional_route_nonempty': True, 'common_action_for_locations': True, **facts}}
    policy_inputs = [('empty', []), ('dependency_priority', [offer('homologous_marker', 1), offer(distance=4)]),
                     ('shorter_route', [offer(distance=3), offer(distance=1)]),
                     ('action_lexicographic', [offer(action='ACTION4'), offer(action='ACTION1')]),
                     ('stable_original_index', [offer(), offer()]), ('unknown_kind', [offer('unknown')]),
                     ('missing_fact', [{**offer(), 'facts': {}}])]
    for scope_good in (False, True):
        for path_good in (False, True):
            for common_good in (False, True):
                policy_inputs.append((f'facts_{scope_good}_{path_good}_{common_good}', [offer(current_scope=scope_good,
                    conditional_route_nonempty=path_good, common_action_for_locations=common_good)]))
    for name, offers in policy_inputs:
        assert len(policy_cases) < declaration['bounds']['maximumPolicyCases']
        item = {'id': name, 'offers': offers, 'select': plain(policy.select(deepcopy(offers))), 'choose': plain(policy.choose(deepcopy(offers)))}
        policy_cases.append(item); log('policy', item)
    assert len(geometry_cases) <= 32 and len(family_cases) <= 120 and len(policy_cases) <= 24
    return {'stateFields': STATE_FIELDS, 'frames': frames, 'geometryCases': geometry_cases,
            'cases': family_cases, 'policyCases': policy_cases, 'sequences': sequences}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--attempt', type=int, choices=(1, 2), required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    declaration = json.loads(DECLARATION.read_text())
    directory = DECLARATION.parent
    receipt_path = directory / f'attempt-{args.attempt:02d}.json'
    raw_path = directory / f'attempt-{args.attempt:02d}-raw.jsonl'
    assert not receipt_path.exists() and not raw_path.exists() and not args.output.exists()
    timeout_seconds = 60
    if args.attempt == 2:
        earlier = json.loads((directory / 'attempt-01.json').read_text())
        assert earlier['status'] == 'failed' and earlier['elapsedSeconds'] < 120
        timeout_seconds = min(60, 120 - earlier['elapsedSeconds'])
    assert sha(MANIFEST) == declaration['sourceManifestSha256']
    start = time.monotonic()
    record = {'schema': 'logos-engine.v6.chart-navigation-reference-execution.v1', 'status': 'running',
              'attempt': args.attempt, 'startedAt': datetime.now(timezone.utc).isoformat(),
              'declaration': fp(DECLARATION), 'generator': fp(Path(__file__)), 'sourceManifest': fp(MANIFEST),
              'timeoutSeconds': timeout_seconds, 'nativeImports': False, 'gamePayloadsInterpreted': 0,
              'gameActionsDispatched': 0, 'sourceModified': False, 'globalLockAcquired': False,
              'performanceMeasurement': False}
    def receipt(): receipt_path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + '\n')
    def timeout(signum, frame): raise TimeoutError('Original ChartNavigation reference exceeded its declared 60 seconds')
    receipt(); signal.signal(signal.SIGALRM, timeout); signal.setitimer(signal.ITIMER_REAL, timeout_seconds)
    paths = []; manifest = json.loads(MANIFEST.read_text()); executed = Counter(); verified_before_execution = {}
    class PinnedSourceFinder(importlib.abc.MetaPathFinder):
        def find_spec(self, fullname, path=None, target=None):
            spec = importlib.machinery.PathFinder.find_spec(fullname, path, target)
            if spec is None or spec.origin is None: return None
            source_path = Path(spec.origin).resolve()
            if not source_path.is_relative_to(SOURCE): return None
            # Validate original bytes before Python executes even a lazy import.
            verified_before_execution.update(verify_sources([source_path], manifest))
            return spec
    source_finder = PinnedSourceFinder()
    sys.meta_path.insert(0, source_finder)
    try:
        assert manifest['commit'] == COMMIT
        sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
        global geometry, ChartNavigation, ChartFragment, MechanicalFamilyScope, _chart_decode, observe
        geometry = importlib.import_module('agents.yf_arc3_v6.morphology_policy.chart_navigation.geometry')
        ChartNavigation = importlib.import_module('agents.yf_arc3_v6.morphology_policy.chart_navigation.family').ChartNavigation
        consumed = importlib.import_module('agents.yf_arc3_v5.capabilities.inventory_gated_navigation')
        ChartFragment, _chart_decode = consumed.ChartFragment, consumed._chart_decode
        MechanicalFamilyScope = importlib.import_module('agents.yf_arc3_v5.capabilities.mechanical_family_contracts_a').MechanicalFamilyScope
        observe = importlib.import_module('neutral_observer').measure
        paths = imported_source_paths()
        assert all('/games/' not in p.as_posix() and '/game_impl/' not in p.as_posix() for p in paths)
        hashes_before = verify_sources(paths, manifest); record['sourceBefore'] = hashes_before
        receipt()
        prefix = str(SOURCE) + '/'
        def profile(frame, event, arg):
            if event == 'call' and frame.f_code.co_filename.startswith(prefix):
                executed[(frame.f_code.co_filename[len(prefix):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1
        sys.setprofile(profile)
        with raw_path.open('x') as raw_log: corpus = make_corpus(raw_log, declaration)
        sys.setprofile(None)
        all_preverified = {**hashes_before, **verified_before_execution}
        after_paths = imported_source_paths()
        assert all(p.relative_to(SOURCE).as_posix() in all_preverified for p in after_paths), 'Every lazy source import must be verified before execution'
        hashes_after = verify_sources([SOURCE / name for name in sorted(all_preverified)], manifest)
        assert all_preverified == hashes_after, 'All original source bytes remain unchanged after evaluation'
        record['sourceVerifiedBeforeEachImport'] = verified_before_execution
        record['lateVerifiedImports'] = sorted(set(verified_before_execution) - set(hashes_before))
        payload = {'schema': 'logos-engine.v6.chart-navigation-reference.v1', 'referenceCommit': COMMIT,
                   'declaration': fp(DECLARATION), 'generator': fp(Path(__file__)), 'sourceManifest': fp(MANIFEST),
                   'sourceModified': False, 'sourceHashes': hashes_after, 'sourceVerifiedBeforeEachImport': verified_before_execution,
                   'lateVerifiedImports': record['lateVerifiedImports'], 'inputOrigin': declaration['inputOrigin'],
                   'qualification': declaration['qualification'], 'bounds': declaration['bounds'],
                   'executedSourceFunctions': [{'path': p, 'line': line, 'function': name, 'calls': count}
                                              for (p, line, name), count in sorted(executed.items())], **corpus}
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('xb') as out:
            out.write(gzip.compress((json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n').encode(), mtime=0))
        record.update(status='passed', fixture=fp(args.output), raw=fp(raw_path), sourceAfter=hashes_after,
                      frameCount=len(corpus['frames']), geometryCount=len(corpus['geometryCases']),
                      ownerOperationCount=len(corpus['cases']), policyCaseCount=len(corpus['policyCases']))
    except BaseException as error:
        sys.setprofile(None)
        record.update(status='failed', error={'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()})
        if paths: record['sourceAfterFailure'] = verify_sources(paths, manifest)
        if raw_path.exists(): record['raw'] = fp(raw_path)
        raise
    finally:
        signal.alarm(0)
        if source_finder in sys.meta_path: sys.meta_path.remove(source_finder)
        record['executedSourceFunctions'] = [{'path': p, 'line': line, 'function': name, 'calls': count}
                                            for (p, line, name), count in sorted(executed.items())]
        record.update(finishedAt=datetime.now(timezone.utc).isoformat(), elapsedSeconds=time.monotonic()-start)
        receipt()
        print(json.dumps({k: record.get(k) for k in ('status', 'attempt', 'elapsedSeconds', 'frameCount', 'geometryCount', 'ownerOperationCount', 'policyCaseCount')}), flush=True)


if __name__ == '__main__': main()
