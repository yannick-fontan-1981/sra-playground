#!/usr/bin/env python3
"""Independent RepeatedLine + SupportedLine contracts from frozen V6 Python.

All rasters and returned packets here are declared synthetic observations.  This
script imports no native implementation, game engine, specification or solution.
Source exceptions and behaviors outside the admitted native domain stay visible.
"""
from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
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
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from common_repeated_lines import (RepeatedLinePatterns, PointedLineConstraint,
                                   fields, pointed_candidates, extensions)
from common_supported_lines import (SupportedLineAccess, SupportedLineConstraint,
                                    layout_key, insertions, line_windows, place,
                                    search_lines)
from common_observed_compositions import ObservedCompositionConstraint
from neutral_observer import measure as observe
from terminal_composition import identity
from src_bridge import plain

EVIDENCE = ROOT / 'docs/migration/lot3i-evidence/diagnostic'
AVAILABLE = ['ACTION' + str(i) for i in range(1, 7)]
INPUTS = [{'action_ref': a} for a in AVAILABLE if a != 'ACTION6']
CONFIG = {'repeated_line_completion': True, 'prepare_supported_lines': True,
          'supported_line_reply_plies': 6}
LOCAL = timezone(timedelta(hours=-3))


def sha(data): return hashlib.sha256(data).hexdigest()


def verify_source():
    for name, item in MANIFEST.items():
        assert sha((SOURCE / name).read_bytes()) == item['sha256'], name
    return len(MANIFEST)


def err(error): return {'type': type(error).__name__, 'message': str(error)}


def record(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': sha(data)}


def raster(boards, *, origins=None, size=(3, 3), gap=(1, 1), canvas=None,
           background=0, separator=8, gap_color=9, permutation=None):
    """Rectangular patches separated by independently visible vertical/gap bars."""
    if origins is None:
        origins = [(2 + 22 * i, 3) for i in range(len(boards))]
    cw, ch = size
    gx, gy = gap
    width = max(o[0] + len(b[0]) * (cw + gx) - gx for b, o in zip(boards, origins)) + 2
    height = max(o[1] + len(b) * (ch + gy) - gy for b, o in zip(boards, origins)) + 2
    if canvas:
        width, height = canvas
    rows = [[background] * width for _ in range(height)]
    for board, (left, top) in zip(boards, origins):
        nx, ny = len(board[0]), len(board)
        bottom = top + ny * (ch + gy) - gy
        for i in range(nx - 1):
            for y in range(top, bottom):
                for x in range(left + (i + 1) * cw + i * gx, left + (i + 1) * (cw + gx)):
                    rows[y][x] = separator
        for j in range(ny):
            for i in range(nx):
                x, y = left + i * (cw + gx), top + j * (ch + gy)
                for v in range(y, y + ch):
                    for u in range(x, x + cw):
                        rows[v][u] = board[j][i]
                if j < ny - 1:
                    for v in range(y + ch, y + ch + gy):
                        for u in range(x, x + cw):
                            rows[v][u] = gap_color
    if permutation:
        rows = [[permutation.get(v, v) for v in row] for row in rows]
    return rows


def observation(rows, name, **changes):
    packet = SimpleNamespace(frame_rows=rows,
        frame_hash=sha(json.dumps(rows, separators=(',', ':')).encode())[:16],
        level=changes.pop('level_epoch', 1), levels_completed=changes.pop('levels_completed', 0),
        state=changes.pop('state', 'NOT_FINISHED'),
        available_action_refs=changes.pop('available_action_refs', AVAILABLE))
    value, _ = observe(packet, changes.pop('revision', 0), 'synthetic:recurrent-series:' + name)
    value.update(changes)
    return plain(value)


def state(memory):
    result = {'line_trials': memory.line_trials, 'line_goals': memory.line_goals,
              'digest': memory.retained_digest()}
    if isinstance(memory, SupportedLineAccess):
        result.update(insert_samples=memory.insert_samples, insert_orders=memory.insert_orders,
            insert_rejections=sorted(memory.insert_rejections),
            insert_refuted_epochs=sorted(memory.insert_refuted_epochs),
            repeated_digest=RepeatedLinePatterns.retained_digest(memory))
    return plain(result)


def instance(owner='supported', events=()):
    value = RepeatedLinePatterns() if owner == 'repeated' else SupportedLineAccess()
    for event in copy.deepcopy(events):
        value.apply_event(event)
    return value


def change_cell(rows, field, point, color, *, corner=None):
    later = copy.deepcopy(rows)
    x = field['origin'][0] + point[0] * field['pitch'][0]
    y = field['origin'][1] + point[1] * field['pitch'][1]
    for v in range(y, y + field['size'][1]):
        for u in range(x, x + field['size'][0]):
            later[v][u] = color
    if corner is not None:
        later[y][x] = corner
    return later


def command(field, point):
    return {'action_ref': 'ACTION6', 'data': {
        'x': field['origin'][0] + point[0] * field['pitch'][0] + (field['size'][0] - 1) // 2,
        'y': field['origin'][1] + point[1] * field['pitch'][1] + (field['size'][1] - 1) // 2}}


def wrapper(name, events=()):
    cls = {'pointed': PointedLineConstraint, 'supported': SupportedLineConstraint,
           'observed': ObservedCompositionConstraint}[name]
    value = cls()
    for event in copy.deepcopy(events):
        value.memory.apply_event(event)
    if name != 'pointed':
        value.events = copy.deepcopy(events)
    return value


def run_export():
    verified_before = verify_source()
    field_cases, pointed_cases, extension_cases, layout_cases, helper_cases = [], [], [], [], []
    access_cases, guard_cases, record_cases, packet_cases, event_cases = [], [], [], [], []
    restore_cases, adapter_cases, chains, divergences = [], [], [], []

    def pure(collection, name, data, call):
        item = {'id': name, **plain(data)}
        try:
            item['expected'] = plain(call())
        except Exception as error:
            item['error'] = err(error)
        collection.append(item)
        return item.get('expected')

    board = [[2, 2, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]
    empty = [[1] * 4 for _ in range(3)]
    rows = raster([board, board])
    fs = fields(rows)
    assert len(fs) == 2 and all(f['shape'] == [4, 3] for f in fs)
    obs = observation(rows, 'initial')
    measured = pointed_candidates(rows, AVAILABLE)
    inputs = INPUTS + measured
    variants = {
        'two_fields': rows,
        'one_field': raster([board]),
        'three_fields': raster([board, board, board]),
        'translated_fields': raster([board, board], origins=[(6, 7), (28, 7)]),
        'field_order_top_then_left': raster([board, board], origins=[(25, 3), (2, 19)]),
        'even_rectangular_cells': raster([board, board], origins=[(2, 3), (28, 3)], size=(4, 2)),
        'scaled_cells_and_gaps': raster([board, board], origins=[(4, 6), (48, 6)], size=(6, 6), gap=(2, 2)),
        'palette_permuted': raster([board, board], permutation={0:17, 1:255, 2:0, 8:31, 9:64}),
        'uniform_cells': raster([empty]),
        'majority_tie_rejected': raster([[[2, 2, 3, 3] for _ in range(3)]]),
        'only_three_columns': raster([[[2, 2, 1], [1, 1, 1], [1, 1, 1]]]),
        'only_two_rows': raster([board[:2]]),
        'blank': [[0] * 20 for _ in range(12)],
    }
    for count in [1, 3, 4]:
        pixels = raster([board])
        field = fields(pixels)[0]
        for x, y in [(0, 1), (1, 1), (2, 1), (3, 1)][:count]:
            pixels[field['origin'][1] + y * field['pitch'][1]][field['origin'][0] + x * field['pitch'][0]] = 7
        variants['unknown_cells_' + str(count)] = pixels
    missing_bar = raster([board])
    for y in range(3, 14):
        missing_bar[y][9] = 0
    variants['missing_separator'] = missing_bar
    # Two modal gaps of each height.  Edge gaps merge into the exterior; two
    # internal gaps expand by one pixel.  Component encounter order breaks ties.
    for name, convert_column in [('gap_tie_first_one_admitted', 2), ('gap_tie_first_two_refused', 1)]:
        pixels = raster([board])
        for j in range(2):
            for i in [0, 3]:
                for x in range(2 + i * 4, 5 + i * 4):
                    pixels[6 + j * 4][x] = 0
            for x in range(2 + convert_column * 4, 5 + convert_column * 4):
                pixels[7 + j * 4][x] = 9
            # Break the remaining 3x2 cell fragment so it is not itself counted
            # as another rectangular horizontal gap of height two.
            pixels[9 + j * 4][2 + convert_column * 4] = 7
        variants[name] = pixels
    for name, pixels in variants.items():
        result = pure(field_cases, name, {'rows': pixels}, lambda p=pixels: fields(p))
        if name in ['unknown_cells_3', 'gap_tie_first_one_admitted']:
            assert result, name
        if name in ['unknown_cells_4', 'gap_tie_first_two_refused', 'majority_tie_rejected']:
            assert not result, name
    for name, pixels in [('empty', []), ('empty_row', [[]]), ('ragged', [[0, 0], [0]]),
                         ('outside_uint8', [[256] * 4 for _ in range(3)]),
                         ('negative_palette', [[-1] * 4 for _ in range(3)]),
                         ('fractional_palette', [[1.5] * 4 for _ in range(3)]),
                         ('numeric_bool_palette', [[True] * 4 for _ in range(3)]),
                         ('domain_area_exceeded', [[0] * 257 for _ in range(256)])]:
        pure(divergences, 'fields:' + name, {'method': 'fields', 'rows': pixels,
             'nativeDomain': 'positive rectangular uint8 raster of at most 65536 pixels'}, lambda p=pixels: fields(p))
    for name in ['two_fields', 'even_rectangular_cells', 'unknown_cells_3', 'blank', 'palette_permuted']:
        pure(pointed_cases, name, {'rows': variants[name], 'available': AVAILABLE},
             lambda p=variants[name]: pointed_candidates(p, AVAILABLE))
    for name, pixels in [('unavailable', rows), ('unavailable_skips_empty_domain', [])]:
        pure(pointed_cases, name, {'rows': pixels, 'available': ['ACTION1']},
             lambda p=pixels: pointed_candidates(p, ['ACTION1']))
    for name, grid in [
        ('horizontal_both_ends', [[1, 2, 2, 1], [1, 1, 1, 1], [1, 1, 1, 1]]),
        ('vertical_both_ends', [[1, 1, 1, 1], [1, 2, 1, 1], [1, 2, 1, 1], [1, 1, 1, 1]]),
        ('diagonal_down', [[2, 1, 1, 1], [1, 2, 1, 1], [1, 1, 1, 1]]),
        ('diagonal_up', [[1, 1, 1, 1], [1, 2, 1, 1], [2, 1, 1, 1]]),
        ('duplicate_target_order', [[2, 1, 2, 1], [1, 2, 2, 1], [1, 1, 1, 1]]),
        ('longest_run_only', [[2, 2, 2, 1], [1, 1, 1, 1], [1, 1, 1, 1]]),
        ('unknown_blocks_extension', [[2, 2, None, 1], [1, 1, 1, 1], [1, 1, 1, 1]]),
        ('unknown_blocks_run', [[2, None, 2, 1], [1, 1, 1, 1], [1, 1, 1, 1]]),
        ('singleton_not_line', [[2, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]),
        ('no_empty_endpoint', [[3, 2, 2, 3], [1, 1, 1, 1], [1, 1, 1, 1]]),
        ('empty_grid', []), ('zero_width', [[], []])]:
        field = {'grid': grid, 'shape': [len(grid[0]) if grid else 0, len(grid)], 'empty_hypothesis': 1}
        pure(extension_cases, name, {'field': field}, lambda f=field: extensions(f))
    for name, field in [('canonical', fs[0]), ('other_origin', fs[1]),
                        ('empty_hypothesis_changed', {**fs[0], 'empty_hypothesis': 7}),
                        ('grid_changed', {**fs[0], 'grid': empty})]:
        pure(layout_cases, name, {'field': field}, lambda f=field: layout_key(f))
    for name, grid in [('canonical', board), ('blocked', [[1, None, 1, 1], [2, 1, 1, None], [1, 1, 1, 1]])]:
        for axis in [None, 0, 1]:
            for sign in [-1, 1]:
                arguments = {'board': grid, 'empty': 1, 'axis': axis, 'sign': sign}
                pure(helper_cases, f'insertions:{name}:{axis}:{sign}', {'method': 'insertions', 'arguments': arguments},
                     lambda a=arguments: insertions(**a))
        for length in [1, 2, 3, 4]:
            arguments = {'board': grid, 'length': length}
            pure(helper_cases, f'line_windows:{name}:{length}', {'method': 'line_windows', 'arguments': arguments},
                 lambda a=arguments: line_windows(**a))
    for point in [(0, 0), (3, 2)]:
        arguments = {'board': board, 'p': list(point), 'color': 3}
        pure(helper_cases, f'place:{point}', {'method': 'place', 'arguments': arguments}, lambda a=arguments: place(**a))

    def access(name, *, owner='supported', pixels=rows, value=obs, events=(), method='line_question',
               supplied=None, limit=1, config=None, remaining=1):
        memory = instance(owner, events)
        selected_inputs = pointed_candidates(pixels, value['available_action_refs']) + INPUTS if supplied is None else supplied
        item = {'id': name, 'owner': owner, 'method': method, 'rows': pixels, 'observation': value,
                'inputs': plain(selected_inputs), 'initialEvents': plain(events), 'beforeState': state(memory)}
        try:
            if method in ['pointed_propose', 'supported_propose', 'observed_propose']:
                which = method.removesuffix('_propose')
                adapter = wrapper(which, events)
                item.update(wrapper=which, remaining=remaining, config=config or CONFIG)
                args = (value, pixels, selected_inputs, remaining)
                result = adapter.propose(*args) if which == 'pointed' else adapter.propose(*args, config or CONFIG)
                item['adapterState'] = plain(adapter.state())
            elif method == 'propose':
                item.update(limit=limit, config=config if config is not None else CONFIG)
                result = memory.propose([], value, pixels, selected_inputs, limit, item['config'])
            else:
                result = memory.line_question(value, pixels, selected_inputs)
            item['expected'] = plain(result)
        except Exception as error:
            item['error'] = err(error)
        item['afterState'] = state(memory)
        access_cases.append(item)
        return item.get('expected')

    repeated = access('repeated:fresh', owner='repeated')
    full_repeated = access('supported:repeated_priority', method='propose')
    common_repeated = access('adapter:supported_repeated', method='supported_propose', supplied=INPUTS)
    access('adapter:pointed_repeated', owner='repeated', method='pointed_propose', supplied=INPUTS)
    observed_repeated = access('adapter:actual_observed_repeated', method='observed_propose', supplied=INPUTS)
    assert repeated['line_plan'] == full_repeated['line_plan']
    assert observed_repeated == common_repeated
    for limit in [-1, 0, 1, 12]:
        access('repeated:own_max_prefix_' + str(limit), owner='repeated', method='propose', limit=limit)
    for remaining in [-1, 0, 8]:
        access('adapter:remaining_' + str(remaining), method='supported_propose', remaining=remaining, supplied=INPUTS)
    access('repeated:disabled', owner='repeated', method='propose', config={})
    access('repeated:python_empty_object_disabled', owner='repeated', method='propose', config={'repeated_line_completion': {}})
    access('repeated:no_point_input', owner='repeated', supplied=INPUTS)
    access('repeated:point_empty_payload', owner='repeated', supplied=[{'action_ref': 'ACTION6', 'data': {}}])
    access('repeated:point_wrong_coordinate', owner='repeated', supplied=[{'action_ref': 'ACTION6', 'data': {'x': 0, 'y': 0}}])
    for name in ['one_field', 'blank', 'palette_permuted', 'unknown_cells_3']:
        pixels = variants[name]
        access('repeated:' + name, owner='repeated', pixels=pixels, value=observation(pixels, name))
    tied_board = [[2, 2, 1, 1], [3, 3, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]
    tied_rows = raster([tied_board, tied_board])
    access('repeated:equal_palette_rank_refused', owner='repeated', pixels=tied_rows,
           value=observation(tied_rows, 'palette-rank-tie'))
    longer = [[2, 2, 1, 1], [3, 3, 3, 1], [1, 1, 1, 1], [1, 1, 1, 1]]
    longer_rows = raster([longer, longer])
    access('repeated:length_breaks_support_tie', owner='repeated', pixels=longer_rows,
           value=observation(longer_rows, 'longer-winner'))
    popular_rows = raster([board, board, [[3, 3, 3, 1], [1, 1, 1, 1], [1, 1, 1, 1]]])
    access('repeated:support_precedes_length', owner='repeated', pixels=popular_rows,
           value=observation(popular_rows, 'support-winner'))

    def record_case(name, *, owner='supported', p=repeated, pixels=rows, later=rows, before=obs,
                    after=None, cmd=None, events=(), index=0):
        memory = instance(owner, events)
        after = after or observation(later, name, revision=1)
        cmd = copy.deepcopy(p['actions'][0]) if cmd is None else cmd
        item = {'id': name, 'owner': owner, 'proposal': plain(p), 'index': index,
                'rows': pixels, 'later': later, 'before': before, 'after': after,
                'command': cmd, 'initialEvents': plain(events), 'beforeState': state(memory)}
        try:
            item['expected'] = plain(memory.record(before, cmd, after, pixels, later, copy.deepcopy(p), index))
        except Exception as error:
            item['error'] = err(error)
        item['afterState'] = state(memory)
        record_cases.append(item)
        return item.get('expected', [])

    target_point = [2, 0]
    completed = change_cell(rows, fs[0], target_point, 2)
    matched_events = record_case('repeated:matched', owner='repeated', later=completed)
    refuted_events = record_case('repeated:refuted', owner='repeated')
    record_case('repeated:no_plan_no_record', owner='repeated', p={}, cmd={'action_ref': 'ACTION1'})
    record_case('repeated:actual_command_retained', owner='repeated', later=completed, cmd={'action_ref': 'ACTION5'})
    record_case('repeated:score_decrease_is_boundary', owner='repeated', later=completed,
                after=observation(completed, 'decrease', levels_completed=-1))
    scored_events = record_case('repeated:scored_boundary', owner='repeated', later=completed,
                after=observation(completed, 'scored', level_epoch=2, levels_completed=1))
    assert len(scored_events) == 2 and scored_events[-1]['kind'] == 'repeated_line_scored'
    goal = scored_events[-1]
    access('repeated:matched_field_skipped', owner='repeated', events=matched_events)
    access('repeated:refuted_trial_not_retried', owner='repeated', events=refuted_events)
    access('repeated:all_original_fields_required', owner='repeated', events=matched_events,
           pixels=variants['one_field'], value=observation(variants['one_field'], 'one-original-left'))
    anchor = {**matched_events[0], 'support_fields': [fs[1]['ref'], fs[0]['ref'], fs[1]['ref']]}
    access('repeated:retained_evidence_order_and_duplicates', owner='repeated', events=[anchor])
    alien_anchor = {**matched_events[0], 'trial': 'unrelated-first-anchor', 'palette': 7, 'candidate_length': 5}
    access('repeated:first_matched_anchor_is_authority', owner='repeated', events=[alien_anchor, matched_events[0]])
    all_accepted = [matched_events[0], {**matched_events[0], 'trial': 'unrelated-accepted-field',
        'field': fs[1]['ref'], 'palette': 7, 'candidate_length': 9, 'support_fields': []}]
    access('repeated:any_matched_trial_accepts_field', owner='repeated', events=all_accepted)
    access('repeated:previous_epoch_not_anchor', owner='repeated', events=[{**matched_events[0], 'epoch': 0}])
    access('repeated:trial_key_seen_even_if_stored_epoch_differs', owner='repeated',
           events=[{**refuted_events[0], 'epoch': 0}])

    def guard(name, method, *, owner='supported', p=repeated, pixels=rows, later=completed,
              index=0, meta=None, mutate=None):
        proposal = copy.deepcopy(p)
        if mutate:
            mutate(proposal)
        values = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'],
                  'state': obs['state'], 'observation_ref': obs['observation_ref'], 'available': AVAILABLE}
        values.update(meta or {})
        item = {'owner': owner, 'method': method, 'proposal': proposal, 'index': index,
                'rows': pixels, 'later': later, 'meta': values}
        memory = instance(owner)
        return pure(guard_cases, name, item,
            lambda: memory.before(proposal, index, pixels, **values) if method == 'before'
            else memory.after(proposal, index, pixels, later, **values))

    for owner in ['repeated', 'supported']:
        guard(owner + ':before:fresh', 'before', owner=owner)
        guard(owner + ':after:matched', 'after', owner=owner)
        guard(owner + ':after:unchanged', 'after', owner=owner, later=rows)
        for method in ['before', 'after']:
            guard(owner + ':' + method + ':missing_plan', method, owner=owner, p={})
    for name, meta in [('epoch', {'epoch': 2}), ('score_increase', {'score': 1}),
                       ('score_decrease', {'score': -1}), ('observation', {'observation_ref': 'different'}),
                       ('unavailable', {'available': ['ACTION1']})]:
        guard('repeated:before:' + name, 'before', owner='repeated', meta=meta)
    guard('repeated:before:index', 'before', owner='repeated', index=1)
    guard('repeated:before:full_frame_changed', 'before', owner='repeated', pixels=completed)
    for name, meta in [('epoch', {'epoch': 2}), ('score_increase', {'score': 1}),
                       ('score_decrease', {'score': -1}), ('win', {'state': 'WIN'}), ('game_over', {'state': 'GAME_OVER'})]:
        guard('repeated:after:' + name, 'after', owner='repeated', meta=meta)
    damaged = change_cell(rows, fs[0], target_point, 2, corner=7)
    nonlocal_change = copy.deepcopy(completed)
    nonlocal_change[-1][-1] = 7
    guard('repeated:after:whole_target_required', 'after', owner='repeated', later=damaged)
    guard('repeated:after:unrelated_change_allowed', 'after', owner='repeated', later=nonlocal_change)
    guard('repeated:after:index_not_checked', 'after', owner='repeated', index=99)
    for label, mutate in [
        ('outer_actions_not_authenticated', lambda p: p.__setitem__('actions', [{'action_ref': 'ACTION1'}])),
        ('proposal_id_not_authenticated', lambda p: p.__setitem__('proposal_id', 'foreign')),
        ('step_action_not_authenticated', lambda p: p['steps'][0].__setitem__('action', {'action_ref': 'ACTION5'})),
        ('plan_point_not_authenticated', lambda p: p['line_plan']['action']['data'].__setitem__('x', 0)),
        ('bundle_actions_not_authenticated', lambda p: p['bundle_template'].__setitem__('actions', [{'action_ref': 'ACTION1'}]))]:
        guard('repeated:before:' + label, 'before', owner='repeated', mutate=mutate)

    # A genuine source-produced scored witness precedes two passive, ordered
    # insertion observations.  The supplied returns form one continuous board.
    one = raster([empty])
    field = fields(one)[0]
    obs_one = observation(one, 'passive-0', level_epoch=2, levels_completed=1)
    source_adapter = wrapper('supported', scored_events)
    passive_steps = []
    passive_events = copy.deepcopy(scored_events)
    current_rows, current_obs = one, obs_one
    for n, (clicked, arrived, reply) in enumerate([((0, 0), (0, 2), (1, 2)), ((0, 1), (0, 1), (0, 0))]):
        cmd = command(field, clicked)
        own_frame = change_cell(current_rows, field, arrived, 2)
        final_frame = change_cell(own_frame, field, reply, 3)
        after = observation(final_frame, 'passive-' + str(n + 1), level_epoch=2, levels_completed=1, revision=n + 1)
        packet = [copy.deepcopy(current_rows), own_frame, final_frame]
        initial_events = copy.deepcopy(source_adapter.events)
        before_state = state(source_adapter.memory)
        result = source_adapter.record(current_obs, after, cmd, current_rows, final_frame, {}, 0, frames=packet)
        assert [e['kind'] for e in result['events']] == ['supported_insertion_observation', 'supported_insertion_order']
        assert result['events'][-1]['own_before_response']
        item = {'id': 'adapter:passive_packet_' + str(n), 'method': 'record', 'wrapper': 'supported',
            'initialEvents': initial_events, 'beforeState': before_state,
            'before': current_obs, 'after': after, 'command': cmd,
            'rows': current_rows, 'later': final_frame, 'proposal': {}, 'index': 0, 'frames': packet,
            'expected': plain(result), 'afterState': state(source_adapter.memory),
            'snapshot': plain(source_adapter.state())}
        adapter_cases.append(item)
        passive_steps.append(copy.deepcopy(item))
        passive_events.extend(copy.deepcopy(result['events']))
        current_rows, current_obs = final_frame, after
    assert passive_steps[-1]['expected']['events'][0]['blocked_goal_extension']
    supported_rows, supported_obs = current_rows, current_obs
    supported_inputs = pointed_candidates(supported_rows, AVAILABLE) + INPUTS
    supported = access('supported:acquired_preparation', method='propose', pixels=supported_rows,
        value=supported_obs, events=passive_events, supplied=supported_inputs)
    assert supported and supported.get('supported_line_plan'), supported
    common_supported = access('adapter:supported_preparation', method='supported_propose', pixels=supported_rows,
        value=supported_obs, events=passive_events, supplied=INPUTS)
    actual_supported = access('adapter:actual_observed_preparation', method='observed_propose', pixels=supported_rows,
        value=supported_obs, events=passive_events, supplied=INPUTS)
    assert common_supported == actual_supported
    chains.append({'id': 'scored_witness_then_ordered_passive_insertions', 'initialEvents': [],
        'scoredTransition': next(x for x in record_cases if x['id'] == 'repeated:scored_boundary'),
        'initialPublicBoundary': {'rows': one, 'observation': obs_one}, 'steps': passive_steps,
        'events': plain(passive_events), 'following': supported, 'finalState': state(source_adapter.memory),
        'scope': 'Source-produced scored witness then two continuous declared public insertion returns; no native expectation or game execution.'})
    observed_adapter = wrapper('observed', scored_events)
    own_kinds = {'repeated_line_trial', 'repeated_line_scored', 'supported_insertion_observation',
                 'supported_insertion_order', 'supported_line_refutation'}
    for n, step in enumerate(passive_steps):
        initial_events = plain(observed_adapter.events)
        initial_snapshot = plain(observed_adapter.state())
        result = observed_adapter.record(step['before'], step['after'], step['command'],
            step['rows'], step['later'], step['proposal'], step['index'], frames=step['frames'])
        own_events = [e for e in result['events'] if e['kind'] in own_kinds]
        assert own_events == step['expected']['events']
        own_state = state(observed_adapter.memory)
        own_state['digest'] = SupportedLineAccess.retained_digest(observed_adapter.memory)
        adapter_cases.append({'id': 'adapter:actual_observed_passive_packet_' + str(n),
            'wrapper': 'observed', 'method': 'record', 'initialEvents': initial_events,
            'beforeSnapshot': initial_snapshot, 'before': step['before'], 'after': step['after'],
            'command': step['command'], 'rows': step['rows'], 'later': step['later'],
            'proposal': step['proposal'], 'index': step['index'], 'frames': step['frames'],
            'expected': plain(result), 'expectedOwnEvents': plain(own_events),
            'parentKinds': [e['kind'] for e in result['events'] if e['kind'] not in own_kinds],
            'expectedOwnState': own_state, 'snapshot': plain(observed_adapter.state()),
            'scope': 'Actual inherited caller emits parent events as well; only the explicitly projected Repeated/Supported part is an own-component parity claim.'})

    for name, ev in [
        ('no_scored_witness', [e for e in passive_events if e['kind'] != 'repeated_line_scored']),
        ('no_order_proof', [e for e in passive_events if e['kind'] != 'supported_insertion_order']),
        ('one_sample', passive_events[:-2]),
        ('unblocked_only', [{**e, 'blocked_goal_extension': False} if e['kind'] == 'supported_insertion_observation' else e for e in passive_events]),
        ('stale_epoch', [{**e, 'epoch': 1} if e['kind'].startswith('supported_') else e for e in passive_events]),
        ('stale_layout', [{**e, 'layout': 'other'} if e['kind'] == 'supported_insertion_observation' else e for e in passive_events]),
        ('unordered_return', [{**e, 'own_before_response': False} if e['kind'] == 'supported_insertion_order' else e for e in passive_events]),
        ('rejected_epoch', passive_events + [{'kind': 'supported_line_refutation', 'epoch': 2, 'trial': 'another', 'source': 'synthetic', 'reason': 'synthetic refutation'}])]:
        access('supported:' + name, method='propose', pixels=supported_rows, value=supported_obs, events=ev)
    bad_roles = copy.deepcopy(passive_events)
    next(e for e in bad_roles if e['kind'] == 'supported_insertion_observation')['other'] = 4
    access('supported:role_disagreement', method='propose', pixels=supported_rows, value=supported_obs, events=bad_roles)
    same_click = copy.deepcopy(passive_events)
    samples = [e for e in same_click if e['kind'] == 'supported_insertion_observation']
    samples[1]['point'] = samples[0]['point']
    access('supported:two_distinct_clicks_required', method='propose', pixels=supported_rows, value=supported_obs, events=same_click)
    same_arrival = copy.deepcopy(passive_events)
    samples = [e for e in same_arrival if e['kind'] == 'supported_insertion_observation']
    samples[1]['arrived'] = samples[0]['arrived']
    access('supported:two_distinct_arrivals_required', method='propose', pixels=supported_rows, value=supported_obs, events=same_arrival)
    access('supported:no_allowed_point', method='propose', pixels=supported_rows, value=supported_obs,
           events=passive_events, supplied=INPUTS)
    access('supported:disabled', method='propose', pixels=supported_rows, value=supported_obs,
           events=passive_events, config={**CONFIG, 'prepare_supported_lines': False})
    access('supported:repeated_still_precedes_acquired_support', method='propose', events=passive_events)
    rejected_trial_only = passive_events + [{'kind': 'supported_line_refutation', 'epoch': 0,
        'trial': supported['supported_line_plan']['trial'], 'source': 'synthetic', 'reason': 'other-epoch key remains rejected'}]
    access('supported:rejected_trial_tries_next_ranked', method='propose', pixels=supported_rows,
           value=supported_obs, events=rejected_trial_only)
    other_goal = {**goal, 'source': 'synthetic:later-scored-witness', 'epoch': 99, 'candidate_length': 4}
    access('supported:latest_scored_length_even_other_epoch', method='propose', pixels=supported_rows,
           value=supported_obs, events=passive_events + [other_goal])
    for depth in [1, 2, 6]:
        arguments = {'board': fields(supported_rows)[0]['grid'], 'own': 2, 'other': 3,
            'empty': 1, 'length': 3, 'axis': 1, 'sign': 1, 'depth': depth}
        pure(helper_cases, 'search_lines:acquired:' + str(depth), {'method': 'search_lines', 'arguments': arguments},
             lambda a=arguments: search_lines(**a))
    arguments = {'board': [[2, 2, 1], [3, 1, 3], [1, 1, 1]], 'own': 2, 'other': 3,
                 'empty': 1, 'length': 3, 'axis': None, 'sign': 1, 'depth': 3}
    pure(helper_cases, 'search_lines:free_immediate_goal', {'method': 'search_lines', 'arguments': arguments},
         lambda: search_lines(**arguments))

    # Acquisition occurs even when another family (no series plan) supplied the
    # command.  Packet ordering uses only persistent public suffixes.
    sample0 = passive_steps[0]
    sample1 = passive_steps[1]
    for name, packet in [
        ('ordered', sample0['frames']),
        ('simultaneous', [sample0['later']]),
        ('own_transient_then_simultaneous', [sample0['frames'][1], sample0['rows'], sample0['later']]),
        ('response_never_persists', [sample0['frames'][1], sample0['rows']]),
        ('empty_packet', [])]:
        events = sample0['initialEvents'] + [sample0['expected']['events'][0]]
        memory = instance('supported', events)
        data = {'initialEvents': events, 'before': sample0['before'], 'after': sample0['after'],
                'command': sample0['command'], 'rows': sample0['rows'], 'packet': packet,
                'beforeState': state(memory)}
        result = pure(packet_cases, name, data, lambda m=memory, p=packet:
            m.record_packet(sample0['before'], sample0['command'], sample0['after'], sample0['rows'], p, []))
        packet_cases[-1]['afterState'] = state(memory)
    memory = instance('supported', scored_events)
    pure(packet_cases, 'no_matching_sample', {'initialEvents': scored_events, 'before': sample0['before'],
        'after': sample0['after'], 'command': sample0['command'], 'rows': sample0['rows'],
        'packet': sample0['frames'], 'beforeState': state(memory)}, lambda:
        memory.record_packet(sample0['before'], sample0['command'], sample0['after'], sample0['rows'], sample0['frames'], []))
    packet_cases[-1]['afterState'] = state(memory)
    for name, modify in [
        ('sample_last_same_source_wins', lambda e: e.__setitem__('own', 7)),
        ('source_alias_lookup_ignores_sample_epoch', lambda e: e.__setitem__('epoch', 999))]:
        duplicate = copy.deepcopy(sample0['expected']['events'][0]); modify(duplicate)
        events = sample0['initialEvents'] + [sample0['expected']['events'][0], duplicate]
        memory = instance('supported', events)
        pure(packet_cases, name, {'initialEvents': events, 'before': sample0['before'], 'after': sample0['after'],
            'command': sample0['command'], 'rows': sample0['rows'], 'packet': sample0['frames'],
            'beforeState': state(memory)}, lambda m=memory:
            m.record_packet(sample0['before'], sample0['command'], sample0['after'], sample0['rows'], sample0['frames'], []))
        packet_cases[-1]['afterState'] = state(memory)

    for name, kwargs in [
        ('passive_observation', {}),
        ('without_goal_refused', {'events': []}),
        ('different_epoch_refused', {'after': {**sample0['after'], 'level_epoch': 3}}),
        ('nonpoint_refused', {'cmd': {'action_ref': 'ACTION1'}}),
        ('missing_payload_refused', {'cmd': {'action_ref': 'ACTION6'}}),
        ('noncenter_separator_point_accepted', {'cmd': {'action_ref': 'ACTION6', 'data': {'x': 5, 'y': 6}}}),
        ('extra_change_refused', {'later': change_cell(sample0['later'], field, (3, 0), 7)}),
        ('only_own_addition_refused', {'later': sample0['frames'][1]})]:
        params = {'owner': 'supported', 'p': {}, 'pixels': sample0['rows'], 'later': sample0['later'],
                  'before': sample0['before'], 'after': sample0['after'], 'cmd': sample0['command'],
                  'events': sample0['initialEvents']}
        params.update(kwargs)
        record_case('supported:' + name, **params)

    sp = supported['supported_line_plan']
    sf = fields(supported_rows)[0]
    selected = tuple(sp['selected']['point'])
    own_later = change_cell(supported_rows, sf, selected, 2)
    prepared = place(tuple(tuple(r) for r in sf['grid']), selected, 2)
    replies = insertions(prepared, 1, sp['support_axis'], sp['support_sign'])
    assert replies and not sp['selected']['immediate_goal']
    compatible = change_cell(own_later, sf, replies[0], 3)
    supported_meta = {'epoch': supported_obs['level_epoch'], 'score': supported_obs['levels_completed'],
                      'state': supported_obs['state'], 'observation_ref': supported_obs['observation_ref']}
    for method in ['before', 'after']:
        guard('supported:' + method + ':current', method, p=supported, pixels=supported_rows,
              later=compatible, meta=supported_meta)
        for name, changes in [('epoch', {'epoch': 3}), ('score_increase', {'score': 2}),
                               ('score_decrease', {'score': 0}), ('win', {'state': 'WIN'}),
                               ('game_over', {'state': 'GAME_OVER'})]:
            guard('supported:' + method + ':' + name, method, p=supported, pixels=supported_rows,
                  later=compatible, meta={**supported_meta, **changes})
    for name, later in [('unchanged', supported_rows), ('own_without_response', own_later),
                         ('whole_cell_required', change_cell(compatible, sf, selected, 2, corner=7)),
                         ('additional_grid_change', change_cell(compatible, sf, (3, 0), 7))]:
        guard('supported:after:' + name, 'after', p=supported, pixels=supported_rows, later=later, meta=supported_meta)
    guard('supported:before:index', 'before', p=supported, pixels=supported_rows, meta=supported_meta, index=1)
    guard('supported:before:point_payload_not_authenticated', 'before', p=supported, pixels=supported_rows,
          meta=supported_meta, mutate=lambda p: p['supported_line_plan']['action']['data'].__setitem__('x', 0))
    record_case('supported:compatible_response', p=supported, pixels=supported_rows, later=compatible,
        before=supported_obs, after=observation(compatible, 'supported-compatible', level_epoch=2, levels_completed=1), events=passive_events)
    supported_refutation = record_case('supported:refuted_response', p=supported, pixels=supported_rows,
        later=own_later, before=supported_obs,
        after=observation(own_later, 'supported-refuted', level_epoch=2, levels_completed=1), events=passive_events)
    record_case('supported:official_boundary_no_refutation', p=supported, pixels=supported_rows,
        later=own_later, before=supported_obs,
        after=observation(own_later, 'supported-boundary', level_epoch=3, levels_completed=2), events=passive_events)
    # Visual line formation without official progress refutes sufficiency, even
    # when the target and response otherwise match the conditional hypothesis.
    immediate_grid = [[1, 1, 1, 1], [1, 1, 1, 1], [2, 2, 1, 1]]
    immediate_rows = raster([immediate_grid])
    immediate_obs = observation(immediate_rows, 'immediate-without-progress', level_epoch=2, levels_completed=1)
    immediate = access('supported:immediate_geometric_line', method='propose', pixels=immediate_rows,
        value=immediate_obs, events=passive_events)
    assert immediate and immediate['supported_line_plan']['selected']['immediate_goal']
    immediate_field = fields(immediate_rows)[0]
    immediate_point = immediate['supported_line_plan']['selected']['point']
    immediate_own = change_cell(immediate_rows, immediate_field, immediate_point, 2)
    immediate_later = change_cell(immediate_own, immediate_field, (3, 2), 3)
    immediate_after = observation(immediate_later, 'line-insufficient', level_epoch=2, levels_completed=1)
    record_case('supported:scored_line_not_sufficient', p=immediate, pixels=immediate_rows, later=immediate_later,
        before=immediate_obs, after=immediate_after, events=passive_events)
    guard('supported:after:scored_line_not_sufficient', 'after', p=immediate, pixels=immediate_rows,
        later=immediate_later, meta={**supported_meta, 'observation_ref': immediate_obs['observation_ref']})
    # Supported guards have precedence on an envelope carrying both plans.
    mixed = copy.deepcopy(supported); mixed['line_plan'] = copy.deepcopy(repeated['line_plan'])
    guard('mixed:before:supported_precedence', 'before', p=mixed, pixels=supported_rows,
        later=compatible, meta=supported_meta)
    record_case('mixed:record:parent_uses_dynamic_supported_after', p=mixed, pixels=supported_rows,
        later=compatible, before=supported_obs,
        after=observation(compatible, 'mixed-compatible', level_epoch=2, levels_completed=1), events=passive_events)

    for name, events, owner in [
        ('repeated_empty', [], 'repeated'), ('repeated_matched', matched_events, 'repeated'),
        ('repeated_scored', scored_events, 'repeated'),
        ('repeated_overwrite_same_trial', [matched_events[0], refuted_events[0]], 'repeated'),
        ('repeated_scored_duplicates_retained', [goal, goal], 'repeated'),
        ('repeated_foreign_event', [{'kind': 'other'}], 'repeated'),
        ('supported_acquired', passive_events, 'supported'),
        ('supported_refuted', passive_events + supported_refutation, 'supported'),
        ('supported_order_overwrite_by_source', passive_events + [{**sample0['expected']['events'][1], 'own_before_response': False}], 'supported'),
        ('supported_set_deduplication', supported_refutation * 2, 'supported'),
        ('supported_unknown_event', [{'kind': 'other'}], 'supported'),
        ('supported_missing_source', [{'kind': 'supported_insertion_order'}], 'supported'),
        ('supported_missing_trial', [{'kind': 'supported_line_refutation', 'epoch': 2}], 'supported')]:
        memory = instance(owner)
        item = {'id': name, 'owner': owner, 'events': plain(events), 'beforeState': state(memory)}
        try:
            for event in copy.deepcopy(events):
                memory.apply_event(event)
            item['expected'] = state(memory)
        except Exception as error:
            item['error'] = err(error)
        item['afterState'] = state(memory)
        event_cases.append(item)

    for which, events in [('pointed', scored_events), ('supported', passive_events), ('observed', passive_events)]:
        for name in ['empty', 'retained', 'corrupt_digest', 'invalid_event']:
            adapter = wrapper(which, scored_events)
            target = wrapper(which, [] if name == 'empty' else events)
            snapshot = plain(target.state())
            if name == 'corrupt_digest':
                snapshot['digest'] = 'corrupt'
            if name == 'invalid_event':
                if which == 'pointed':
                    snapshot['trials'] = [{'kind': 'other'}]
                else:
                    snapshot['events'] = [{'kind': 'other'}]
            item = {'id': which + ':' + name, 'wrapper': which, 'initialEvents': scored_events,
                    'snapshot': snapshot, 'beforeState': state(adapter.memory),
                    'beforeSnapshot': plain(adapter.state())}
            try:
                adapter.restore(copy.deepcopy(snapshot))
                item['expectedState'] = state(adapter.memory)
                item['expectedSnapshot'] = plain(adapter.state())
            except Exception as error:
                item['error'] = err(error)
            item['afterState'] = state(adapter.memory)
            item['afterSnapshot'] = plain(adapter.state())
            restore_cases.append(item)

    for which, p in [('pointed', common_repeated), ('supported', common_repeated), ('observed', common_repeated),
                      ('supported', common_supported), ('observed', common_supported)]:
        for name, mutation, bindings in [
            ('current', None, True), ('missing_domain', None, False),
            ('point_mismatch', lambda q: q['point_support'].__setitem__('point', [0, 0]), True),
            ('two_actions', lambda q: q['actions'].append(copy.deepcopy(q['actions'][0])), True),
            ('palette_not_rechecked', lambda q: q['point_support'].__setitem__('palette_value', 7), True),
            ('proposal_id_not_authenticated', lambda q: q.__setitem__('proposal_id', 'foreign'), True)]:
            proposal = copy.deepcopy(p)
            if mutation:
                mutation(proposal)
            support = proposal['point_support']
            domain_bindings = [(support['level_epoch'], support['frame_hash'])] if bindings else []
            adapter = wrapper(which)
            item = {'id': which + ':' + p['kind'] + ':bind:' + name, 'wrapper': which, 'method': 'bind',
                    'proposal': plain(proposal), 'bindings': plain(domain_bindings)}
            try:
                adapter.bind(proposal, SimpleNamespace(bindings=set(domain_bindings)))
                item['expected'] = plain(proposal)
            except Exception as error:
                item['error'] = err(error)
            adapter_cases.append(item)
    # Binding and own guards intentionally do not authenticate the whole bundle;
    # a common runtime must also check complete-envelope and current-point facts.
    source_aliases = {
        'strategyImport': 'ObservedCompositionConstraint as ProgramCompositionConstraint',
        'strategyInstance': 'self.lines = ProgramCompositionConstraint()',
        'recurrentCaller': 'self.lines.propose(obs, rows, inputs, remaining, window_constraints)',
        'resolvedPropose': ObservedCompositionConstraint.propose.__qualname__,
        'resolvedProposeModule': ObservedCompositionConstraint.propose.__module__,
        'pointedPlanActionAliasesOuterAction': repeated['line_plan']['action'] is repeated['actions'][0],
        'note': 'JSON exports prove value contracts; object alias identity is not a native persistence claim.'}
    actual_adapter = ObservedCompositionConstraint()
    source_aliases['resolvedWrapperMethods'] = {name: {
        'qualname': getattr(actual_adapter, name).__qualname__, 'module': getattr(actual_adapter, name).__module__}
        for name in ['propose', 'before', 'after', 'record', 'state', 'restore', 'bind']}
    source_aliases['resolvedMemoryMethods'] = {name: {
        'qualname': getattr(actual_adapter.memory, name).__qualname__, 'module': getattr(actual_adapter.memory, name).__module__}
        for name in ['propose', 'before', 'after', 'record', 'record_packet', 'apply_event', 'retained_digest']}
    source_aliases['wrapperMro'] = [c.__module__ + '.' + c.__name__ for c in type(actual_adapter).__mro__]
    source_aliases['memoryMro'] = [c.__module__ + '.' + c.__name__ for c in type(actual_adapter.memory).__mro__]
    # Observe alias identity before plain/JSON strips it, using an original call.
    alias_memory = RepeatedLinePatterns()
    alias_proposal = alias_memory.line_question(obs, rows, inputs)
    source_aliases['pointedPlanActionAliasesOuterAction'] = alias_proposal['line_plan']['action'] is alias_proposal['actions'][0]
    source_aliases['pointedStepActionAliasesOuterAction'] = alias_proposal['steps'][0]['action'] is alias_proposal['actions'][0]
    source_aliases['bundleActionsAliasesOuterAction'] = alias_proposal['bundle_template']['actions'][0] is alias_proposal['actions'][0]

    paths = ['agents/yf_arc3_v6/laya_proto/' + name for name in [
        'common_repeated_lines.py', 'common_supported_lines.py', 'common_crossed_prefix.py',
        'common_observed_compositions.py', 'common_cell_placement.py', 'cell_placement_access.py',
        'reference_population_access.py', 'coupled_pair_access.py',
        'geometric_observer.py', 'terminal_composition.py', 'neutral_observer.py']]
    paths += ['agents/yf_arc3_v6/morphology_policy/strategy.py', 'agents/yf_arc3_v6/morphology_policy/strategy.drm']
    fixture = {'schema': 'logos-engine.v6-recurrent-series.original-contracts.v1', 'sourceCommit': COMMIT,
        'sourceFiles': {name: MANIFEST[name]['sha256'] for name in paths},
        'originalFilesVerifiedBefore': verified_before, 'originalFilesVerifiedAfter': verify_source(),
        'fieldCases': field_cases, 'pointedCases': pointed_cases, 'extensionCases': extension_cases,
        'layoutCases': layout_cases, 'helperCases': helper_cases, 'accessCases': access_cases,
        'guardCases': guard_cases, 'recordCases': record_cases, 'packetCases': packet_cases,
        'eventCases': event_cases, 'restoreCases': restore_cases, 'adapterCases': adapter_cases,
        'chains': chains, 'sourceDivergences': divergences, 'sourceAliases': source_aliases,
        'qualifications': [
            'Own common_repeated_lines and common_supported_lines contracts; actual ObservedCompositionConstraint inherited propose/bind/restore are separately labelled adapters.',
            'No claim that descendant modules or unrelated ancestors become fully ported by these own component cases.',
            'Synthetic rasters and returned packets are declared inputs. All expectations come from unchanged Python source, never native output.',
            'The original finite lookahead has no internal deadline or node budget. Its numeric arithmetic is unbounded Python integer arithmetic.',
            'A repeated geometric continuation is a hypothesis; a scored witness retains an appearance and length, not a universal current-level goal law.',
            'Supported preparation requires current-epoch layout, distinct clicks/arrivals, persistent public order, and a blocked extension; actual response policy remains unknown.',
            'Source permissive guards, boundary decreases, dynamic after dispatch, first retained anchor, last-source packet sample, overwritten event slots and source exceptions remain visible.',
            'Source aliases are measured separately because serialization retains values, not Python object identity.',
            'Native admission is a positive rectangular uint8 raster of at most 65536 pixels; malformed, nonuint8, or unbounded search domains are not silently counted as parity.'
        ]}
    target = ROOT / 'tests/fixtures/v6-recurrent-series-reference.json.gz'
    target.write_bytes(gzip.compress(json.dumps(fixture, separators=(',', ':'), ensure_ascii=False).encode(), mtime=0))
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    collections = ['fieldCases', 'pointedCases', 'extensionCases', 'layoutCases', 'helperCases', 'accessCases',
        'guardCases', 'recordCases', 'packetCases', 'eventCases', 'restoreCases', 'adapterCases', 'chains', 'sourceDivergences']
    counts = {key: len(fixture[key]) for key in collections}
    receipt = {'schema': 'logos-engine.lot3i.source-oracle-export.v1', 'recordedAt': datetime.now(LOCAL).isoformat(),
        'status': 'passed', 'sourceCommit': COMMIT, 'sourceFiles': fixture['sourceFiles'],
        'generator': record(Path(__file__)), 'fixture': record(target), 'counts': counts,
        'sourceErrors': sum('error' in item for key in collections for item in fixture[key]),
        'originalFilesVerifiedBefore': verified_before, 'originalFilesVerifiedAfter': fixture['originalFilesVerifiedAfter'],
        'gameExecutions': 0, 'gameEngineOrSpecificationReads': 0, 'nativeModuleExecutions': 0,
        'qualification': 'Separate case groups, not a summed native test suite. Original source exceptions retained. Actual descendant adapter scope remains separately qualified.'}
    (EVIDENCE / 'source-oracle-export.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'counts': counts, 'fixture': receipt['fixture'], 'sourceErrors': receipt['sourceErrors']}))


if __name__ == '__main__':
    if sys.argv[1:]:
        raise SystemExit('Usage: export-v6-recurrent-series-reference.py')
    run_export()
