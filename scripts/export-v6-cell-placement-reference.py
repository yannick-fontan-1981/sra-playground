#!/usr/bin/env python3
"""Unchanged V6 cell-patch source contracts on controlled public rasters.

These synthetic observations are not game trajectories or successful-game
evidence. Every original ancestor return is retained; native own-layer parity
is qualified separately from the full common envelopes captured below.
"""
from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
LAYA = SOURCE / 'agents/yf_arc3_v6/laya_proto'
sys.path[:0] = [str(SOURCE), str(LAYA)]

from cell_patch_observation import center, validate_geometry, fields, project, changes
from cell_placement_access import CellPlacementAccess
from linked_packet_access import LinkedPacketAccess
from common_cell_placement import CellPlacementConstraint
from common_observed_compositions import ObservedCompositionConstraint
from common_supported_lines import insertions, line_windows, place, search_lines
from neutral_observer import measure
from terminal_composition import identity

CONFIG = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']
POLICY = CONFIG['window_constraints']['cell_patch_composition']
PROJECTION = ('cell_models', 'cell_geometries', 'cell_events', 'cell_refused', 'cell_paths', 'cell_returns')
KIND = 'cell_patch_placement_evidence'
SCENES, STATES, PLANS, RAW_EVENTS = {}, {}, {}, {}
MEASUREMENTS, LINE_CASES, JOURNALS, PROPOSALS, GUARDS, BINDS, COMMON = [], [], [], [], [], [], []
COVERED = {}
OWN_FILES = {str(LAYA / name) for name in ('cell_patch_observation.py', 'cell_placement_access.py', 'common_cell_placement.py', 'common_supported_lines.py')}
OWN = [[2, 1, 2], [1, 2, 1], [2, 1, 2]]
OTHER = [[2, 2, 2], [2, 1, 2], [2, 2, 2]]
DIFFERENT = [[3, 1, 3], [1, 3, 1], [3, 1, 3]]
G = {'origin': [3, 3], 'shape': [3, 3], 'size': [3, 3], 'pitch': [4, 4]}


def plain(value):
    if isinstance(value, dict): return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (tuple, list)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value


def traced(call, parent_method=None):
    parents = []
    def trace(frame, event, arg):
        if event == 'line' and frame.f_code.co_filename in OWN_FILES:
            COVERED.setdefault(Path(frame.f_code.co_filename).name + ':' + frame.f_code.co_name, set()).add(frame.f_lineno)
        if parent_method is not None and event == 'return' and frame.f_code is parent_method.__code__:
            parents.append(copy.deepcopy(arg))
        return trace
    sys.settrace(trace)
    try: return call(), parents
    finally: sys.settrace(None)


def paint_cell(rows, point, patch, geometry=G):
    x, y = [geometry['origin'][i] + point[i] * geometry['pitch'][i] for i in (0, 1)]
    w, h = geometry['size']
    for dy in range(h):
        for dx in range(w): rows[y + dy][x + dx] = patch[dy][dx] if isinstance(patch, list) else patch


def board(*, geometry=G, cells=(), frame=5, empty=1, canvas=None):
    x, y = geometry['origin']; w, h = geometry['size']; dx, dy = geometry['pitch']; nx, ny = geometry['shape']
    right, bottom = x + (nx - 1) * dx + w, y + (ny - 1) * dy + h
    rows = copy.deepcopy(canvas) if canvas is not None else [[0] * (right + 4) for _ in range(bottom + 4)]
    for yy in range(y - 1, bottom + 1):
        for xx in range(x - 1, right + 1): rows[yy][xx] = frame
    for j in range(ny):
        for i in range(nx): paint_cell(rows, (i, j), empty, geometry)
    for point, patch in cells: paint_cell(rows, point, patch, geometry)
    return rows


def scene(name, rows, *, frames=None, epoch=1, score=0, state='NOT_FINISHED', available=None):
    revision = len(SCENES) + 1
    public = SimpleNamespace(frame_rows=copy.deepcopy(rows), frame_packet=copy.deepcopy(frames if frames is not None else [rows]),
        level=epoch, levels_completed=score, state=state, step_index=revision - 1,
        available_action_refs=['ACTION6'] if available is None else list(available), frame_hash=identity(rows)[:16])
    observation, _ = measure(public, revision, 'cell-placement-reference')
    SCENES[name] = {'rows': copy.deepcopy(rows), 'public': plain(vars(public)), 'observation': plain(observation)}
    return name


def snapshot(memory):
    return {'projection': plain({name: getattr(memory, name) for name in PROJECTION}),
        'sourceParentDigest': LinkedPacketAccess.retained_digest(memory), 'sourceDigest': CellPlacementAccess.retained_digest(memory)}


def remember(name, memory):
    STATES[name] = {'events': plain(RAW_EVENTS.get(memory, [])), **snapshot(memory)}
    return name


def restored(name):
    memory = CellPlacementAccess()
    RAW_EVENTS[memory] = copy.deepcopy(STATES[name]['events'])
    for event in RAW_EVENTS[memory]: memory.apply_event(copy.deepcopy(event))
    assert snapshot(memory) == {key: STATES[name][key] for key in ('projection', 'sourceParentDigest', 'sourceDigest')}
    return memory


def journal(name, initial=None):
    memory = restored(initial) if initial else CellPlacementAccess(); RAW_EVENTS.setdefault(memory, [])
    entry = {'id': name, 'initialState': initial, 'steps': []}; JOURNALS.append(entry)
    return memory, entry


def acquire(memory, entry, operation, before, after, command, proposal=None, *, frames=None, index=0):
    first, second = SCENES[before], SCENES[after]
    packet = second['public']['frame_packet'] if frames is None else frames
    if operation == 'record':
        args = [copy.deepcopy(first['observation']), copy.deepcopy(command), copy.deepcopy(second['observation']),
            copy.deepcopy(first['rows']), copy.deepcopy(second['rows']), copy.deepcopy(proposal or {}), index]
        call, parent = lambda: memory.record(*args), LinkedPacketAccess.record
    else:
        args = [copy.deepcopy(first['observation']), copy.deepcopy(command), copy.deepcopy(second['observation']),
            copy.deepcopy(first['rows']), copy.deepcopy(packet), []]
        call, parent = lambda: memory.record_packet(*args), LinkedPacketAccess.record_packet
    untouched = copy.deepcopy(args); old = snapshot(memory)
    step = {'operation': operation, 'before': before, 'after': after, 'command': plain(command),
        'proposal': plain(proposal or {}), 'index': index, 'frames': plain(packet)}
    try:
        result, parents = traced(call, parent)
        assert len(parents) == 1 and result[:len(parents[0])] == parents[0]
        own = result[len(parents[0]):]
        assert all(event['kind'] == KIND for event in own)
        RAW_EVENTS[memory].extend(copy.deepcopy(result))
        step.update(sourceEvents=plain(result), parentEvents=plain(parents[0]), expectedOwnEvents=plain(own))
    except ValueError as error:
        step['error'] = {'type': type(error).__name__, 'message': str(error)}
        assert snapshot(memory) == old
    assert args == untouched
    step.update(state=snapshot(memory), sourceInputsUnchanged=True)
    entry['steps'].append(step); entry['finalState'] = snapshot(memory)
    return step


def propose(name, *, state='empty', view='seed:empty', maximum=16, remaining=40, config=None,
            common=False, deadline=1, observation_patch=None):
    memory = restored(state); current = SCENES[view]
    observation = {**copy.deepcopy(current['observation']), **(observation_patch or {})}
    policy = copy.deepcopy(POLICY if config is None else config)
    entry = {'id': name, 'operation': 'common' if common else 'own', 'state': state, 'scene': view,
        'observation': observation, 'maxPrefix': maximum, 'remaining': remaining, 'config': policy, 'deadline': deadline, 'inputs': []}
    old = snapshot(memory)
    try:
        if common:
            family = CellPlacementConstraint(); family.level_deadline = deadline
            for event in STATES[state]['events']: family.memory.apply_event(copy.deepcopy(event)); family.events.append(copy.deepcopy(event))
            before = copy.deepcopy(family.state())
            result, parents = traced(lambda: family.cell_propose(observation, current['rows'], [], remaining, policy), LinkedPacketAccess.propose)
            assert family.state() == before
        else:
            result, parents = traced(lambda: memory.propose([], observation, current['rows'], [], maximum, policy), LinkedPacketAccess.propose)
        entry['expected'] = plain(result)
        if parents: assert len(parents) == 1; entry['sourceBaseProposal'] = plain(parents[0])
    except (ValueError, TypeError, KeyError, IndexError) as error:
        entry['error'] = {'type': type(error).__name__, 'message': str(error)}
    assert snapshot(memory) == old
    entry['sourceStateUnchanged'] = True; PROPOSALS.append(entry)
    return entry.get('expected')


def guard(name, operation, plan, before, after=None, *, state='empty', index=0, edit=lambda p: None, meta_patch=None):
    memory = restored(state); proposal = copy.deepcopy(PLANS[plan]); edit(proposal)
    obs = SCENES[before if operation == 'before' else after]['observation']
    meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'state': obs['state'],
        'observation_ref': obs['observation_ref'], 'available': obs['available_action_refs'], **(meta_patch or {})}
    entry = {'id': name, 'operation': operation, 'state': state, 'proposal': plain(proposal),
        'before': before, 'after': after, 'index': index, 'meta': meta}
    before_state = snapshot(memory); untouched = copy.deepcopy(proposal)
    call = (lambda: memory.before(proposal, index, SCENES[before]['rows'], **meta)) if operation == 'before' else (
        lambda: memory.after(proposal, index, SCENES[before]['rows'], SCENES[after]['rows'], **meta))
    value, _ = traced(call); entry['expected'] = plain(value)
    assert snapshot(memory) == before_state and proposal == untouched
    GUARDS.append(entry)


def measured(name, operation, args):
    helpers = {'fields': fields, 'project': project, 'validate_geometry': validate_geometry, 'center': center, 'changes': changes}
    old = copy.deepcopy(args); value, _ = traced(lambda: helpers[operation](*args)); assert args == old
    MEASUREMENTS.append({'id': name, 'operation': operation, 'args': plain(args), 'expected': plain(value)})


def lines(name, operation, args):
    helpers = {'insertions': insertions, 'line_windows': line_windows, 'place': place, 'search_lines': search_lines}
    old = copy.deepcopy(args); value, _ = traced(lambda: helpers[operation](*args)); assert args == old
    LINE_CASES.append({'id': name, 'operation': operation, 'args': plain(args), 'expected': plain(value)})


def common_journal(name, transitions):
    family = ObservedCompositionConstraint(); family.level_deadline = 1
    entry = {'id': name, 'steps': []}; COMMON.append(entry)
    for before, after, proposal in transitions:
        first, second = SCENES[before], SCENES[after]
        command = copy.deepcopy(proposal['actions'][0])
        result, _ = traced(lambda: family.record(first['observation'], second['observation'], command,
            first['rows'], second['rows'], copy.deepcopy(proposal), 0, frames=second['public']['frame_packet']))
        state = copy.deepcopy(family.state()); rebuilt = ObservedCompositionConstraint(); rebuilt.restore(state)
        assert rebuilt.state() == state and snapshot(rebuilt.memory) == snapshot(family.memory)
        family = rebuilt; family.level_deadline = 1
        entry['steps'].append({'before': before, 'after': after, 'command': command, 'proposal': plain(proposal),
            'index': 0, 'expected': plain(result), 'cellState': snapshot(family.memory), 'fullSourceState': plain(state)})


def main():
    blank = board(); local = board(cells=[((1, 1), OWN)]); reply = board(cells=[((1, 1), OWN), ((0, 0), OTHER)])
    scene('seed:empty', blank); scene('seed:local', local)
    scene('seed:reply', reply, frames=[local, local, reply, reply])
    scene('seed:same', blank)
    scene('seed:epoch2', blank, epoch=2, score=1)
    scene('seed:win', reply, score=1, state='WIN')
    other_only = board(cells=[((0, 0), OTHER)])
    uniform_local = board(cells=[((1, 1), 2)])
    uniform_reply = board(cells=[((1, 1), 2), ((0, 0), OTHER)])
    same_reply = board(cells=[((1, 1), OWN), ((0, 0), OWN)])
    many_reply = board(cells=[((1, 1), OWN), ((0, 0), OTHER), ((2, 0), OTHER)])
    different_local = board(cells=[((1, 1), DIFFERENT)])
    different_reply = board(cells=[((1, 1), DIFFERENT), ((0, 0), OTHER)])
    bad_separator = copy.deepcopy(reply); bad_separator[6][4] = 7
    bad_perimeter = copy.deepcopy(blank); bad_perimeter[2][4] = 7
    scene('seed:broken', bad_separator)
    scene('seed:different', different_reply, frames=[different_local, different_local, different_reply, different_reply])
    scene('seed:occupied_command', reply)
    empty = CellPlacementAccess(); RAW_EVENTS[empty] = []; remember('empty', empty)

    # Geometry and exact patch identities, including interrupted uniform cells.
    for name, raster, prior in [
        ('blank_framed_lattice', blank, []), ('partial_repeated_rectangles', reply, []),
        ('prior_geometry_revalidated', reply, [G]), ('broken_separator', bad_separator, [G]),
        ('broken_perimeter', bad_perimeter, [G]),
        ('nested_geometry_removed', blank, [{**G, 'shape': [2, 2]}]),
    ]: measured(name, 'fields', [raster, prior])
    all_marked = board(cells=[((x, y), OWN if (x + y) % 2 else OTHER) for y in range(3) for x in range(3)])
    measured('all_marks_need_revalidated_prior', 'fields', [all_marked, [G]])
    measured('all_marks_supply_no_uniform_empty_role', 'project', [all_marked, G])
    tie_geometry = {**G, 'shape': [2, 2]}
    ties = board(geometry=tie_geometry, cells=[((0, 1), 4), ((1, 0), 4)])
    measured('uniform_majority_tie_is_unknown', 'project', [ties, tie_geometry])
    rectangular = {'origin': [4, 4], 'shape': [4, 2], 'size': [2, 3], 'pitch': [4, 5]}
    measured('rectangular_cells_and_wider_separators', 'fields', [board(geometry=rectangular), []])
    attached = copy.deepcopy(reply)
    for y in range(3): attached[y][8] = 5
    measured('thin_indicator_connected_to_perimeter', 'fields', [attached, []])
    wide = board(canvas=[[0] * 42 for _ in range(22)])
    wide = board(geometry={**G, 'origin': [25, 5]}, canvas=wide)
    measured('multiple_fields_sorted_by_y_then_x', 'fields', [wide, []])
    measured('center_floor_for_even_cell_dimensions', 'center', [rectangular, [3, 1]])
    measured('valid_current_geometry', 'validate_geometry', [reply, G])
    measured('out_of_bounds_geometry', 'validate_geometry', [reply, {**G, 'origin': [0, 0]}])
    measured('bad_current_separator_rejects_projection', 'project', [bad_separator, G])
    measured('exact_same_palette_distinct_motifs', 'project', [reply, G])
    measured('dated_patch_changes_in_row_major_order', 'changes', [project(blank, G), project(reply, G)])
    measured('geometry_change_cannot_supply_patch_delta', 'changes', [project(blank, G), project(ties, tie_geometry)])

    # Search is a conditional finite horizon, never official terminal authority.
    empty_grid = [['e'] * 3 for _ in range(3)]
    mid_grid = [['o', 'e', 'e'], ['e', 'x', 'e'], ['e', 'e', 'e']]
    holes = [['e', 'o', 'e'], [None, 'x', 'e'], ['e', 'e', 'e']]
    lines('all_full_span_windows', 'line_windows', [empty_grid, 3])
    lines('blocked_cells_remove_windows', 'line_windows', [holes, 2])
    lines('oversized_span_has_no_windows', 'line_windows', [mid_grid, 4])
    lines('free_insertions_keep_row_major_order', 'insertions', [holes, 'e', None, 0])
    for axis in (0, 1):
        for sign in (-1, 1): lines('supported_insertions_%d_%d' % (axis, sign), 'insertions', [holes, 'e', axis, sign])
    lines('place_does_not_mutate_its_board', 'place', [mid_grid, [2, 0], 'x'])
    for depth in (1, 2, 4, 6): lines('equal_choices_depth_%d' % depth, 'search_lines', [mid_grid, 'x', 'o', 'e', 3, None, 0, depth])
    lines('empty_board_finite_search', 'search_lines', [empty_grid, 'x', 'o', 'e', 3, None, 0, 6])
    lines('immediate_goal_wins_conditional_ranking', 'search_lines', [[['x', 'x', 'e'], ['o', 'e', 'e'], ['o', 'e', 'e']], 'x', 'o', 'e', 3, None, 0, 4])
    lines('adverse_immediate_goal_is_considered', 'search_lines', [[['o', 'o', 'e'], ['e', 'x', 'e'], ['e', 'e', 'x']], 'x', 'o', 'e', 3, None, 0, 4])
    lines('supported_finite_horizon_with_holes', 'search_lines', [holes, 'x', 'o', 'e', 2, 1, 1, 4])
    lines('no_free_cell_returns_empty_ranking', 'search_lines', [[['x', 'o'], ['o', 'x']], 'x', 'o', 'e', 2, None, 0, 4])

    PLANS['initial'] = propose('initial_measured_cell_question')
    assert PLANS['initial']['cell_placement_plan']['point'] == [1, 1]
    PLANS['common_initial'] = propose('common_current_pixel_support', common=True)
    learned, entry = journal('learn_roles_and_observed_return')
    command = PLANS['initial']['actions'][0]
    acquire(learned, entry, 'record', 'seed:empty', 'seed:reply', command, PLANS['initial'])
    remember('recorded_before_packet', learned)
    acquire(learned, entry, 'packet', 'seed:empty', 'seed:reply', command)
    remember('learned', learned)
    assert len(learned.cell_models) == 1
    PLANS['learned'] = propose('conditional_line_preparation', state='learned', view='seed:reply')
    assert PLANS['learned']['cell_placement_plan']['point'] == [0, 2]
    next_local = copy.deepcopy(reply); paint_cell(next_local, PLANS['learned']['cell_placement_plan']['point'], OWN)
    next_reply = copy.deepcopy(next_local); paint_cell(next_reply, [1, 0], OTHER)
    scene('second:local', next_local)
    scene('second:reply', next_reply, frames=[next_local, next_local, next_reply, next_reply])
    acquire(learned, entry, 'record', 'seed:reply', 'second:reply', PLANS['learned']['actions'][0], PLANS['learned'])
    acquire(learned, entry, 'packet', 'seed:reply', 'second:reply', PLANS['learned']['actions'][0])
    remember('second', learned)
    PLANS['second'] = propose('second_conditional_preparation', state='second', view='second:reply')
    scene('returned:reply', reply, frames=[reply, reply])
    step = acquire(learned, entry, 'record', 'second:reply', 'returned:reply', PLANS['second']['actions'][0], PLANS['second'])
    assert step['expectedOwnEvents'][0]['detail']['outcome']['matched'] is None
    assert step['expectedOwnEvents'][0]['detail']['observed_return']
    acquire(learned, entry, 'packet', 'second:reply', 'returned:reply', PLANS['second']['actions'][0])
    remember('returned', learned)
    PLANS['returned'] = propose('observed_return_contrasts_equal_preparations', state='returned', view='returned:reply')
    assert PLANS['returned']['cell_placement_plan']['search']['return_contrast']['choice_changed'] is True
    assert next(iter(learned.cell_models.values()))['status'] == 'candidate'

    # Controlled packet negatives and conflicts. No roles come from palette IDs.
    packet_cases = [
        ('one_frame_cannot_date_order', [reply], command),
        ('simultaneous_local_remote_is_not_ordered', [reply, reply], command),
        ('unstable_local_is_not_a_witness', [local, reply, reply], command),
        ('unstable_remote_is_not_a_witness', [local, local, reply], command),
        ('remote_before_local_is_not_own_then_other', [other_only, other_only, reply, reply], command),
        ('uniform_local_patch_has_no_mark_role', [uniform_local, uniform_local, uniform_reply, uniform_reply], command),
        ('remote_motif_must_differ_from_local', [local, local, same_reply, same_reply], command),
        ('two_remote_additions_do_not_choose_one', [local, local, many_reply, many_reply], command),
        ('local_motif_must_persist_at_remote_stage', [local, local, different_reply, different_reply], command),
        ('non_point_command_has_no_cell_role', [local, local, reply, reply], {'action_ref': 'ACTION5'}),
        ('missing_point_payload_has_no_cell_role', [local, local, reply, reply], {'action_ref': 'ACTION6'}),
        ('near_center_is_not_the_bound_point', [local, local, reply, reply], {'action_ref': 'ACTION6', 'data': {'x': 7, 'y': 8}}),
    ]
    for name, packet, cmd in packet_cases:
        memory, negative = journal(name)
        result = acquire(memory, negative, 'packet', 'seed:empty', 'seed:reply', cmd, frames=packet)
        assert result['expectedOwnEvents'] == [] and not memory.cell_models
    memory, invalid = journal('intermediate_invalid_projection_does_not_fabricate_an_order')
    acquire(memory, invalid, 'packet', 'seed:empty', 'seed:reply', command, frames=[local, local, bad_separator, bad_separator, reply, reply])
    assert next(iter(memory.cell_models.values()))['ordered_frames'] == [0, 4]
    memory, epoch_packet = journal('packet_roles_keep_the_before_epoch_scope')
    acquire(memory, epoch_packet, 'packet', 'seed:empty', 'seed:epoch2', command, frames=[local, local, reply, reply])
    assert next(iter(memory.cell_models.values()))['epoch'] == 1
    memory, occupied = journal('point_on_an_occupied_patch_cannot_seed_a_role')
    acquire(memory, occupied, 'packet', 'seed:reply', 'seed:reply', command, frames=[local, local, reply, reply])
    assert not memory.cell_models
    memory, conflict = journal('conflicting_dated_role_packet_refutes_prior', 'learned')
    acquire(memory, conflict, 'packet', 'seed:empty', 'seed:different', command)
    remember('conflict', memory)
    assert next(iter(memory.cell_models.values()))['status'] == 'refuted'
    acquire(memory, conflict, 'packet', 'seed:empty', 'seed:reply', command)
    remember('still_refuted', memory)
    assert next(iter(memory.cell_models.values()))['status'] == 'refuted'

    memory, stationary = journal('unchanged_frame_refuses_only_this_trial')
    acquire(memory, stationary, 'record', 'seed:empty', 'seed:same', command, PLANS['initial'])
    remember('stationary', memory)
    memory, no_plan = journal('unselected_cell_has_no_plan_acquisition')
    acquire(memory, no_plan, 'record', 'seed:empty', 'seed:reply', command)
    assert not memory.cell_events
    memory, mismatch = journal('command_must_match_the_committed_point')
    acquire(memory, mismatch, 'record', 'seed:empty', 'seed:reply', {'action_ref': 'ACTION6', 'data': {'x': 4, 'y': 4}}, PLANS['initial'])
    memory, refutation = journal('predicted_local_motif_is_refuted_by_different_patch', 'learned')
    wrong = copy.deepcopy(reply); paint_cell(wrong, PLANS['learned']['cell_placement_plan']['point'], DIFFERENT)
    scene('wrong:local', wrong)
    acquire(memory, refutation, 'record', 'seed:reply', 'wrong:local', PLANS['learned']['actions'][0], PLANS['learned'])
    remember('wrong_patch', memory)
    assert next(iter(memory.cell_models.values()))['status'] == 'refuted'
    memory, boundary = journal('official_boundary_seals_without_refuting_the_old_model', 'learned')
    acquire(memory, boundary, 'record', 'seed:reply', 'seed:epoch2', PLANS['learned']['actions'][0], PLANS['learned'])
    remember('boundary', memory)
    assert next(iter(memory.cell_models.values()))['status'] == 'candidate'

    for name, kwargs in [
        ('disabled_cell_question', {'config': {}}),
        ('empty_cell_question', {'config': {'cell_placement_question': {}}}),
        ('zero_prefix', {'maximum': 0}), ('negative_prefix', {'maximum': -1}),
        ('point_action_absent', {'observation_patch': {'available_action_refs': ['ACTION1']}}),
        ('refused_trial_stays_refused', {'state': 'stationary'}),
        ('model_is_epoch_bound', {'state': 'learned', 'view': 'seed:reply', 'observation_patch': {'level_epoch': 2}}),
        ('refuted_roles_do_not_authorize_prediction', {'state': 'wrong_patch', 'view': 'seed:reply'}),
        ('known_roles_require_current_other_motif', {'state': 'learned', 'view': 'seed:empty'}),
        ('search_empty_bound_is_respected', {'state': 'learned', 'view': 'seed:reply', 'config': {'cell_placement_question': {**POLICY['cell_placement_question'], 'free_search_empty_bound': 6}}}),
        ('reply_horizon_one_is_exact', {'state': 'learned', 'view': 'seed:reply', 'config': {'cell_placement_question': {**POLICY['cell_placement_question'], 'reply_plies': 1}}}),
        ('common_zero_remaining', {'common': True, 'remaining': 0}),
        ('common_missing_deadline', {'common': True, 'deadline': None}),
        ('common_zero_precedes_deadline_check', {'common': True, 'remaining': 0, 'deadline': None}),
        ('common_learned_support', {'common': True, 'state': 'learned', 'view': 'seed:reply'}),
    ]: propose(name, **kwargs)

    guard('initial_current_context', 'before', 'initial', 'seed:empty')
    for name, patch in [('changed_epoch', {'epoch': 2}), ('changed_score', {'score': 1}),
        ('changed_ref', {'observation_ref': 'outside'}), ('unavailable_point_action', {'available': []})]:
        guard(name, 'before', 'initial', 'seed:empty', meta_patch=patch)
    for index in (-1, 1, 30): guard('only_zero_step_index_%d' % index, 'before', 'initial', 'seed:empty', index=index)
    guard('changed_full_raster', 'before', 'initial', 'seed:reply', meta_patch={'observation_ref': SCENES['seed:empty']['observation']['observation_ref']})
    guard('changed_command', 'before', 'initial', 'seed:empty', edit=lambda p: p['actions'][0]['data'].update(x=9))
    guard('changed_bundle', 'before', 'initial', 'seed:empty', edit=lambda p: p['bundle_template'].update(actions=[]))
    guard('cell_point_changed', 'before', 'initial', 'seed:empty', edit=lambda p: p['cell_placement_plan'].update(point=[0, 0]))
    guard('unlearned_reply_seals_as_unknown', 'after', 'initial', 'seed:empty', 'seed:reply')
    guard('learned_local_patch_matches', 'after', 'learned', 'seed:reply', 'second:reply', state='learned')
    guard('different_local_patch_refutes', 'after', 'learned', 'seed:reply', 'wrong:local', state='learned')
    guard('broken_geometry_refutes_a_predicted_patch', 'after', 'learned', 'seed:reply', 'seed:broken', state='learned')
    guard('observed_whole_view_return_stays_unknown', 'after', 'second', 'second:reply', 'returned:reply', state='second')
    for name, patch in [('win', {'state': 'WIN'}), ('game_over', {'state': 'GAME_OVER'}), ('epoch', {'epoch': 2}), ('score', {'score': 1})]:
        guard('official_boundary_' + name, 'after', 'learned', 'seed:reply', 'wrong:local', state='learned', meta_patch=patch)
    for name, mutate in [('current_point_binding', lambda p: None), ('changed_point_binding_rejected', lambda p: p['steps'][0]['point_support'].update(point=[9, 9]))]:
        proposal = copy.deepcopy(PLANS['common_initial']); mutate(proposal); item = {'id': name, 'proposal': plain(proposal)}
        try:
            CellPlacementConstraint().bind(proposal, None); item['expected'] = plain(proposal)
        except AssertionError: item['error'] = {'type': 'AssertionError'}
        BINDS.append(item)

    common_journal('unfiltered_common_acquisition_and_closed_return', [
        ('seed:empty', 'seed:reply', PLANS['initial']), ('seed:reply', 'second:reply', PLANS['learned']),
        ('second:reply', 'returned:reply', PLANS['second']), ('returned:reply', 'seed:epoch2', PLANS['returned']),
    ])
    common_journal('unfiltered_common_official_terminal', [('seed:empty', 'seed:win', PLANS['initial'])])

    manifest = json.loads((ROOT / 'reference/v6' / COMMIT / 'manifest.json').read_text()); hashes = {}
    for module in list(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if not filename: continue
        filename = Path(filename).resolve()
        if filename.suffix != '.py' or not filename.is_relative_to(SOURCE): continue
        relative = str(filename.relative_to(SOURCE)); digest = hashlib.sha256(filename.read_bytes()).hexdigest()
        assert manifest['files'][relative]['sha256'] == digest, relative
        hashes[relative] = digest
    result = {'schema': 'logos-engine.v6.cell-placement-oracle.v1', 'sourceCommit': COMMIT, 'sourceModified': False,
        'qualification': 'Unchanged original functions with full raw ancestor returns retained. Own cell projection/digest comparisons are separate from unfiltered full common envelopes. Controlled public raster contracts are not successful-game evidence.',
        'sourceHashes': dict(sorted(hashes.items())), 'policy': {'cell': POLICY, 'recall': CONFIG['window_constraints']},
        'scenes': SCENES, 'states': STATES, 'plans': PLANS, 'measurementCases': MEASUREMENTS, 'lineCases': LINE_CASES,
        'journals': JOURNALS, 'proposalCases': PROPOSALS, 'guardCases': GUARDS, 'bindCases': BINDS, 'commonJournals': COMMON,
        'sourceLineCoverage': {name: sorted(value) for name, value in sorted(COVERED.items())},
        'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    output = ROOT / 'tests/fixtures/v6-cell-placement-reference.json.gz'
    with output.open('wb') as raw:
        with gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as stream:
            stream.write(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())
    print(json.dumps({'path': str(output.relative_to(ROOT)), 'scenes': len(SCENES), 'states': len(STATES),
        'measurementCases': len(MEASUREMENTS), 'lineCases': len(LINE_CASES), 'journals': len(JOURNALS),
        'acquisitions': sum(len(row['steps']) for row in JOURNALS), 'proposals': len(PROPOSALS), 'guards': len(GUARDS),
        'commonAcquisitions': sum(len(row['steps']) for row in COMMON), 'sourceFiles': len(hashes),
        'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__': main()
