#!/usr/bin/env python3
"""Unchanged-source alternating graph access oracle on public raster contracts.

All source record envelopes and the actual parent return are retained. The
native layer comparison concerns their own suffix plus the seven graph fields;
it never removes ancestor events to claim complete inherited parity. Controlled
rasters exercise observations, counterexamples and contact revalidation. They
are not a game, an injected route solver or evidence of a solved game.
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

from alternating_graph_access import AlternatingGraphAccess, signature, box_at, points
from cell_placement_access import CellPlacementAccess
from common_alternating_graph import AlternatingGraphConstraint
from neutral_observer import measure
from terminal_composition import identity

CONFIG = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']
POLICY = CONFIG['alternating_graph_composition']
AVAILABLE = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4']
FIELDS = ('graph_samples', 'graph_refused', 'graph_terminal', 'graph_events', 'graph_calibration', 'graph_contacts', 'graph_removals')
SCENES, STATES, PLANS = {}, {}, {}
JOURNALS, PROPOSALS, GUARDS, BINDINGS, HELPERS = [], [], [], [], []
RAW_EVENTS, COVERED = {}, {}
OWN_FILES = {str(LAYA / name) for name in ('alternating_graph_access.py', 'common_alternating_graph.py')}


def plain(value):
    if isinstance(value, dict): return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (tuple, list)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value


def traced(call):
    parent_returns = []
    def trace(frame, event, arg):
        if event == 'line' and frame.f_code.co_filename in OWN_FILES:
            COVERED.setdefault(Path(frame.f_code.co_filename).name + ':' + frame.f_code.co_name, set()).add(frame.f_lineno)
        if event == 'return' and frame.f_code is CellPlacementAccess.record.__code__:
            parent_returns.append(copy.deepcopy(arg))
        return trace
    sys.settrace(trace)
    try: return call(), parent_returns
    finally: sys.settrace(None)


def paint(rows, position, value, size=3):
    for y in range(position[0], position[0] + size):
        for x in range(position[1], position[1] + size): rows[y][x] = value


def board(actor=(1, 1), *, guards=(), columns=3, line=False, grid_rows=None, guard_direction='right', extra_actors=()):
    rr = [1 + 6 * i for i in range(grid_rows)] if grid_rows else ([1] if line else [1, 7])
    rows = [[0] * (columns * 6 + 2) for _ in range(grid_rows * 6 + 2 if grid_rows else (7 if line else 14))]
    cc = [1 + 6 * i for i in range(columns)]
    for r in rr:
        for c in cc: paint(rows, (r, c), 5)
        for c in cc[:-1]: paint(rows, (r, c + 3), 6)
    for r in rr[:-1]:
        for c in cc: paint(rows, (r + 3, c), 6)
    paint(rows, (rr[-1], cc[-1]), 4)
    for position in guards:
        paint(rows, position, 7)
        dy, dx = (2, 1) if guard_direction == 'down' else (1, 2)
        rows[position[0] + dy][position[1] + dx] = 3
    for position in [actor, *extra_actors]:
        paint(rows, position, 9); rows[position[0] + 1][position[1] + 1] = 8
    return rows


def scene(name, rows, *, epoch=1, score=0, state='NOT_FINISHED', available=None):
    revision = len(SCENES) + 1
    public = SimpleNamespace(frame_rows=copy.deepcopy(rows), frame_packet=[copy.deepcopy(rows)], level=epoch,
        levels_completed=score, state=state, step_index=revision - 1,
        available_action_refs=list(AVAILABLE if available is None else available), frame_hash=identity(rows)[:16])
    observation, _ = measure(public, revision, 'alternating-access-reference')
    SCENES[name] = {'rows': copy.deepcopy(rows), 'public': plain(vars(public)), 'observation': plain(observation)}
    return name


def snapshot(memory):
    return {'projection': plain({name: getattr(memory, name) for name in FIELDS}),
        'sourceParentDigest': CellPlacementAccess.retained_digest(memory),
        'sourceDigest': AlternatingGraphAccess.retained_digest(memory)}


def remember(name, memory):
    STATES[name] = {'events': plain(RAW_EVENTS.get(memory, [])), **snapshot(memory)}
    return name


def restored(name):
    memory = AlternatingGraphAccess()
    RAW_EVENTS[memory] = copy.deepcopy(STATES[name]['events'])
    for event in RAW_EVENTS[memory]: memory.apply_event(copy.deepcopy(event))
    assert snapshot(memory) == {key: STATES[name][key] for key in ('projection', 'sourceParentDigest', 'sourceDigest')}
    return memory


def journal(name, *, initial=None):
    memory = restored(initial) if initial else AlternatingGraphAccess()
    RAW_EVENTS.setdefault(memory, [])
    entry = {'id': name, 'initialState': initial, 'steps': [],
        'qualification': 'Controlled public response contracts executed by the unchanged source class including its complete parent record. No game-private state or game solution.'}
    JOURNALS.append(entry)
    return memory, entry


def record(memory, entry, before, after, command, proposal=None, index=0):
    first, second = SCENES[before], SCENES[after]
    args = [copy.deepcopy(first['observation']), copy.deepcopy(command), copy.deepcopy(second['observation']),
            copy.deepcopy(first['rows']), copy.deepcopy(second['rows']), copy.deepcopy(proposal or {}), index]
    untouched = copy.deepcopy(args)
    result, parent = traced(lambda: memory.record(*args))
    assert len(parent) == 1 and result[:len(parent[0])] == parent[0]
    own = result[len(parent[0]):]
    assert all(event['kind'] == 'alternating_graph_evidence' for event in own)
    assert args == untouched
    RAW_EVENTS[memory].extend(copy.deepcopy(result))
    entry['steps'].append({'before': before, 'after': after, 'command': plain(command), 'proposal': plain(proposal or {}), 'index': index,
        'sourceEvents': plain(result), 'parentEvents': plain(parent[0]), 'expectedOwnEvents': plain(own), 'state': snapshot(memory), 'sourceInputsUnchanged': True})
    entry['finalState'] = snapshot(memory)
    return own


def variant(name, original, edit):
    memory = restored(original)
    projection = copy.deepcopy(snapshot(memory)['projection']); edit(projection)
    event = {'kind': 'alternating_graph_evidence', 'detail': {'explicit_retained_state_contract': name}}
    event.update({key[6:]: value for key, value in projection.items() if key != 'graph_events'})
    memory.apply_event(copy.deepcopy(event)); RAW_EVENTS[memory].append(copy.deepcopy(event))
    remember(name, memory)
    STATES[name]['qualification'] = 'Explicit retained-state reducer contract; not a state acquired in a game.'
    return name


def propose(name, *, state='static', view='seed:4', maximum=16, remaining=40, config=None,
            common=False, deadline=1, observation_patch=None):
    memory = restored(state); current = SCENES[view]
    observation = {**copy.deepcopy(current['observation']), **(observation_patch or {})}
    policy = copy.deepcopy(POLICY if config is None else config)
    if not common: policy.setdefault('remaining_level_actions', remaining)
    entry = {'id': name, 'operation': 'common' if common else 'own', 'state': state, 'scene': view, 'observation': observation,
        'maxPrefix': maximum, 'remaining': remaining, 'config': policy, 'deadline': deadline, 'inputs': []}
    before = snapshot(memory)
    try:
        if common:
            family = AlternatingGraphConstraint(); family.level_deadline = deadline
            for event in STATES[state]['events']: family.memory.apply_event(copy.deepcopy(event)); family.events.append(copy.deepcopy(event))
            old = copy.deepcopy(family.state())
            result, _ = traced(lambda: family.graph_propose(observation, current['rows'], [], remaining, policy))
            assert family.state() == old
        else: result, _ = traced(lambda: memory.propose_graph(observation, current['rows'], [], maximum, policy))
        entry['expected'] = plain(result)
    except (ValueError, TypeError, KeyError, IndexError) as error:
        entry['error'] = {'type': type(error).__name__, 'message': str(error)}
    assert snapshot(memory) == before
    entry['sourceStateUnchanged'] = True
    PROPOSALS.append(entry)
    return entry.get('expected')


def guard(name, operation, plan, before, after=None, *, index=0, edit=lambda value: None, meta_patch=None):
    proposal = copy.deepcopy(PLANS[plan]); edit(proposal)
    scene_value = SCENES[before if operation == 'before' else after]
    obs = scene_value['observation']
    meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'state': obs['state'],
        'observation_ref': obs['observation_ref'], 'available': obs['available_action_refs'], **(meta_patch or {})}
    entry = {'id': name, 'operation': operation, 'proposal': proposal, 'before': before, 'after': after, 'index': index, 'meta': meta}
    untouched = copy.deepcopy(proposal)
    try:
        memory = AlternatingGraphAccess()
        call = (lambda: memory.before(proposal, index, SCENES[before]['rows'], **meta)) if operation == 'before' else (
            lambda: memory.after(proposal, index, SCENES[before]['rows'], SCENES[after]['rows'], **meta))
        value, _ = traced(call); entry['expected'] = plain(value)
    except (ValueError, TypeError, KeyError, IndexError) as error:
        entry['error'] = {'type': type(error).__name__, 'message': str(error)}
    assert proposal == untouched
    GUARDS.append(entry)


def bind(name, plan='static', edit=lambda value: None):
    proposal = copy.deepcopy(PLANS[plan]); edit(proposal)
    entry = {'id': name, 'proposal': plain(proposal)}
    try:
        _, _parent = traced(lambda: AlternatingGraphConstraint().bind(proposal, None))
        entry['expected'] = plain(proposal)
    except (ValueError, TypeError, KeyError) as error: entry['error'] = {'type': type(error).__name__, 'message': str(error)}
    BINDINGS.append(entry)


def main():
    empty = AlternatingGraphAccess(); RAW_EVENTS[empty] = []; remember('empty', empty)
    memory, acquisition = journal('acquire_four_observed_controls')
    positions = [(1, 1), (1, 7), (7, 7), (7, 1), (1, 1)]
    for index, position in enumerate(positions): scene('seed:' + str(index), board(position))
    for index, action in enumerate(('ACTION4', 'ACTION2', 'ACTION3', 'ACTION1')):
        record(memory, acquisition, 'seed:' + str(index), 'seed:' + str(index + 1), {'action_ref': action})
    remember('static', memory)
    PLANS['static'] = propose('static_source_route')
    assert PLANS['static']['actions'] == [{'action_ref': action} for action in ('ACTION4', 'ACTION4', 'ACTION2')]

    # The generated original plan, including an exceptional final contact.
    flow, entry = journal('execute_source_static_prefix_to_official_completion', initial='static')
    view = 'seed:4'
    for index, step in enumerate(PLANS['static']['graph_access_plan']['steps']):
        destination = tuple(step['to']); final = index == len(PLANS['static']['actions']) - 1
        next_view = scene('static-response:' + str(index), board(destination), score=int(final), state='WIN' if final else 'NOT_FINISHED')
        record(flow, entry, view, next_view, PLANS['static']['actions'][index], PLANS['static'], index)
        view = next_view
    remember('terminal', flow)

    # Calibration is learned only after a released original graph proposal.
    learned, acquisition = journal('observed_contact_then_departure_reveals_support', initial='static')
    scene('calibration:after', board((1, 7)))
    record(learned, acquisition, 'seed:4', 'calibration:after', PLANS['static']['actions'][0], PLANS['static'], 0)
    remember('calibrated', learned)
    scene('contact:before', board((1, 7), guards=[(7, 7)]))
    scene('contact:covered', board((7, 7)))
    scene('contact:revealed', board((1, 7)))
    record(learned, acquisition, 'contact:before', 'contact:covered', {'action_ref': 'ACTION2'})
    remember('unverified_contact', learned)
    record(learned, acquisition, 'contact:covered', 'contact:revealed', {'action_ref': 'ACTION1'})
    remember('removal', learned)
    assert learned.graph_removals[0]['status'] == 'ordinary_support_revealed_after_departure'

    occluded, acquisition = journal('departure_restores_guard_and_proves_occlusion', initial='unverified_contact')
    record(occluded, acquisition, 'contact:covered', 'contact:before', {'action_ref': 'ACTION1'})
    remember('occlusion', occluded)
    assert occluded.graph_contacts[0]['status'] == 'occlusion_confirmed_no_removal' and not occluded.graph_removals
    unknown, acquisition = journal('departure_leaves_contact_change_unresolved', initial='unverified_contact')
    unknown_rows = board((1, 7)); paint(unknown_rows, (7, 7), 2)
    scene('contact:unknown', unknown_rows)
    record(unknown, acquisition, 'contact:covered', 'contact:unknown', {'action_ref': 'ACTION1'})
    remember('unknown_contact', unknown)
    assert unknown.graph_contacts[0]['status'] == 'occlusion_or_removal_unknown' and not unknown.graph_removals

    # A different measured topology requires a removable contact before its
    # guarded forward node can lead toward the exceptional uniform occurrence.
    scene('instrumental:before', board((7, 7), guards=[(7, 13)], grid_rows=3, guard_direction='down'))
    remember('instrumental', learned)
    PLANS['instrumental'] = propose('contact_is_an_instrumental_prefix', state='instrumental', view='instrumental:before')
    assert PLANS['instrumental']['actions'] == [{'action_ref': 'ACTION4'}]
    assert PLANS['instrumental']['graph_access_plan']['instrumental_contact']['counterfactual_complete_length'] == 2
    instrumental, acquisition = journal('contact_validation_departure_and_resumed_access', initial='instrumental')
    scene('instrumental:covered', board((7, 13), grid_rows=3))
    record(instrumental, acquisition, 'instrumental:before', 'instrumental:covered', {'action_ref': 'ACTION4'}, PLANS['instrumental'])
    remember('validation_departure', instrumental)
    PLANS['validation_departure'] = propose('covered_contact_requires_safe_departure', state='validation_departure', view='instrumental:covered')
    assert PLANS['validation_departure']['actions'] == [{'action_ref': 'ACTION3'}]
    assert PLANS['validation_departure']['graph_access_plan']['instrumental_contact']['validation_departure'] is True
    scene('instrumental:revealed', board((7, 7), grid_rows=3))
    record(instrumental, acquisition, 'instrumental:covered', 'instrumental:revealed', {'action_ref': 'ACTION3'}, PLANS['validation_departure'])
    remember('after_validation', instrumental)
    PLANS['after_validation'] = propose('ordinary_support_revealed_then_continue', state='after_validation', view='instrumental:revealed')
    assert PLANS['after_validation']['actions'] == [{'action_ref': 'ACTION4'}, {'action_ref': 'ACTION2'}]
    view = 'instrumental:revealed'
    for index, step in enumerate(PLANS['after_validation']['graph_access_plan']['steps']):
        final = index == len(PLANS['after_validation']['actions']) - 1
        next_view = scene('instrumental:completion:' + str(index), board(tuple(step['to']), grid_rows=3), score=int(final), state='WIN' if final else 'NOT_FINISHED')
        record(instrumental, acquisition, view, next_view, PLANS['after_validation']['actions'][index], PLANS['after_validation'], index)
        view = next_view
    remember('instrumental_terminal', instrumental)

    for name, later, proposal, before in [
        ('stationarity_refutes_ordinary_projection', 'seed:4', PLANS['static'], 'seed:4'),
        ('unmoved_contact_remains_unknown', 'instrumental:before', PLANS['instrumental'], 'instrumental:before'),
    ]:
        source_state = 'instrumental' if proposal is PLANS['instrumental'] else 'static'
        current, entry = journal(name, initial=source_state)
        record(current, entry, before, later, proposal['actions'][0], proposal)
        remember(name, current)
    extra_rows = board((1, 7)); extra_rows[12][17] = 2
    scene('static:extra', extra_rows)
    current, entry = journal('extra_interior_effect_refutes_route_but_retains_control_sample', initial='static')
    record(current, entry, 'seed:4', 'static:extra', PLANS['static']['actions'][0], PLANS['static'])
    remember('extra_effect', current)

    # Negative acquisition contracts do not manufacture translated controls.
    scene('stationary', board())
    scene('diagonal', board((7, 7)))
    scene('duplicate:before', board(extra_actors=[(7, 1)]))
    scene('duplicate:after', board((1, 7), extra_actors=[(7, 1)]))
    scene('boundary:unscored', board((1, 7)), epoch=2)
    scene('boundary:scored', board((1, 7)), epoch=2, score=1)
    for name, first, second, plan in [
        ('stationary_without_plan_adds_no_graph_evidence', 'seed:4', 'stationary', {}),
        ('diagonal_translation_not_acquired_as_cardinal', 'seed:4', 'diagonal', {}),
        ('duplicate_histogram_identity_is_ambiguous', 'duplicate:before', 'duplicate:after', {}),
        ('epoch_change_without_completion_has_no_translation', 'seed:4', 'boundary:unscored', {}),
        ('official_completion_on_new_epoch_retains_local_witness', 'seed:4', 'boundary:scored', PLANS['static']),
    ]:
        current, entry = journal(name, initial='static')
        record(current, entry, first, second, {'action_ref': 'ACTION4'}, plan)

    scene('long', board(columns=20))
    PLANS['long'] = propose('long_route_keeps_source_measurement_and_bounded_prefix', view='long')
    assert len(PLANS['long']['actions']) == 16
    assert len(PLANS['long']['graph_access_plan']['measurement']['alternating_material_first_shortest_action_refs']) == 20
    PLANS['common_static'] = propose('common_static_exact_adapter', common=True)
    PLANS['common_long'] = propose('common_long_prefix_is_16', view='long', common=True, remaining=100)
    PLANS['common_instrumental'] = propose('common_instrumental_exact_adapter', state='instrumental', view='instrumental:before', common=True)

    # Planning guards and source abstentions.
    propose('disabled_graph_question', config={})
    propose('empty_graph_question', config={'alternating_graph_question': {}})
    propose('zero_prefix', maximum=0)
    propose('negative_prefix', maximum=-1)
    propose('no_observed_controls', state='empty')
    propose('only_one_available_control', observation_patch={'available_action_refs': ['ACTION4']})
    propose('no_available_controls', observation_patch={'available_action_refs': []})
    propose('single_action_prefix', maximum=1)
    propose('two_action_prefix', maximum=2)
    propose('controls_transfer_by_signature_to_new_epoch', observation_patch={'level_epoch': 7, 'levels_completed': 6})
    propose('common_zero_remaining', common=True, remaining=0)
    propose('common_negative_remaining', common=True, remaining=-1)
    propose('common_missing_deadline', common=True, deadline=None)
    propose('common_zero_precedes_deadline_guard', common=True, remaining=0, deadline=None)
    propose('common_one_remaining', common=True, remaining=1)
    propose('common_no_controls_returns_none', state='empty', common=True)
    propose('unverified_contact_cannot_enable_instrumental_removal', state='unverified_contact', view='instrumental:before')
    propose('known_occlusion_cannot_enable_removal', state='occlusion', view='instrumental:before')
    propose('unresolved_contact_cannot_enable_removal', state='unknown_contact', view='instrumental:before')
    propose('insufficient_remaining_actions_keep_question_unresolved', state='instrumental', view='instrumental:before', remaining=1)
    propose('exact_two_remaining_admits_first_contact_only', state='instrumental', view='instrumental:before', remaining=2)
    scene('line:revealed', board(columns=4, line=True))
    propose('removal_does_not_override_missing_static_route_on_line', state='after_validation', view='line:revealed')
    propose('common_unresolved_question_blocks_unrelated_probe', state='occlusion', view='instrumental:before', common=True)
    propose('validation_departure_unavailable_is_unresolved', state='validation_departure', view='instrumental:covered', observation_patch={'available_action_refs': ['ACTION1', 'ACTION2', 'ACTION4']})
    variant('ambiguous_reverse', 'validation_departure', lambda p: p['graph_samples'].append({**copy.deepcopy(p['graph_samples'][2]), 'action': 'ACTION5'}))
    propose('two_reverse_controls_do_not_choose_arbitrarily', state='ambiguous_reverse', view='instrumental:covered', observation_patch={'available_action_refs': [*AVAILABLE, 'ACTION5']})
    variant('same_vector_controls', 'static', lambda p: p.update(graph_samples=[{**p['graph_samples'][0], 'action': action} for action in ['ACTION1', 'ACTION4']]))
    propose('two_controls_with_same_delta_do_not_bind_two_directions', state='same_vector_controls')
    variant('conflicting_right_samples', 'static', lambda p: p['graph_samples'].append({**p['graph_samples'][0], 'delta': [0, -6]}))
    propose('contradictory_right_action_is_not_used', state='conflicting_right_samples')
    propose('refused_trial_stays_refused', state='stationarity_refutes_ordinary_projection')
    propose('two_matching_actor_overlays_do_not_grant_identity', view='duplicate:before')

    # Exact source before/after rules, including interior-only extra effects.
    guard('initial_bound_context', 'before', 'static', 'seed:4')
    guard('later_guard_uses_current_histogram', 'before', 'static', 'static-response:0', index=1)
    guard('negative_step_index_has_source_sequence_semantics', 'before', 'static', 'static-response:1', index=-1)
    for name, patch in [('changed_epoch', {'epoch': 2}), ('changed_score', {'score': 1}), ('changed_ref', {'observation_ref': 'other'}), ('unavailable_action', {'available': []})]:
        guard(name, 'before', 'static', 'seed:4', meta_patch=patch)
    guard('changed_commands', 'before', 'static', 'seed:4', edit=lambda p: p['actions'][0].update(action_ref='ACTION1'))
    guard('changed_bundle', 'before', 'static', 'seed:4', edit=lambda p: p['bundle_template'].update(actions=[]))
    guard('added_payload', 'before', 'static', 'seed:4', edit=lambda p: p['actions'][0].update(data={'x': 1, 'y': 1}))
    guard('initial_digest_mismatch', 'before', 'static', 'stationary', meta_patch={'observation_ref': SCENES['seed:4']['observation']['observation_ref']}, edit=lambda p: p['graph_access_plan'].update(initial_digest='changed'))
    guard('actor_missing_from_expected_position', 'before', 'static', 'seed:1')
    guard('ordinary_displacement', 'after', 'static', 'seed:4', 'static-response:0')
    guard('second_ordinary_displacement', 'after', 'static', 'static-response:0', 'static-response:1', index=1)
    guard('stayed_in_place', 'after', 'static', 'seed:4', 'seed:4')
    guard('extra_interior_effect', 'after', 'static', 'seed:4', 'static:extra')
    border_rows = board((1, 7)); border_rows[0][0] = 2; scene('static:border_only', border_rows)
    guard('border_signal_is_not_interior_mechanism_refutation', 'after', 'static', 'seed:4', 'static:border_only')
    unvacated = board((1, 7)); paint(unvacated, (1, 1), 2); scene('static:unvacated', unvacated)
    guard('vacated_support_must_match', 'after', 'static', 'seed:4', 'static:unvacated')
    guard('contact_stays_unknown_and_seals', 'after', 'instrumental', 'instrumental:before', 'instrumental:covered')
    guard('unmoved_contact_is_not_false_mechanism_refutation', 'after', 'instrumental', 'instrumental:before', 'instrumental:before')
    guard('safe_departure_is_revalidated', 'after', 'validation_departure', 'instrumental:covered', 'instrumental:revealed')
    for name, patch in [('official_win', {'state': 'WIN'}), ('official_game_over', {'state': 'GAME_OVER'}), ('official_epoch_change', {'epoch': 2}), ('official_score_change', {'score': 1})]:
        guard(name, 'after', 'static', 'seed:4', 'static-response:0', meta_patch=patch)
    guard('bad_index_is_not_silently_accepted', 'before', 'static', 'seed:4', index=30)
    guard('bad_outcome_index_is_not_silently_accepted', 'after', 'static', 'seed:4', 'static-response:0', index=30)
    bind('plain_discrete_commands')
    bind('empty_payload_matches_source', edit=lambda p: p['actions'][0].update(data={}))
    bind('null_payload_matches_source', edit=lambda p: p['actions'][0].update(data=None))
    bind('nonempty_payload_is_rejected', edit=lambda p: p['actions'][0].update(data={'x': 2, 'y': 2}))
    for name, function, args in [('actor_signature', signature, [PLANS['static']['graph_access_plan']['actor']]),
        ('box_at', box_at, [[1, 7], 3]), ('overlapping_point_set', points, [[1, 1, 3, 3]])]:
        HELPERS.append({'id': name, 'operation': function.__name__, 'args': plain(args), 'expected': plain(function(*args))})

    source_hashes = {}
    manifest = json.loads((ROOT / 'reference/v6' / COMMIT / 'manifest.json').read_text())
    for module in list(sys.modules.values()):
        path = getattr(module, '__file__', None)
        if not path: continue
        path = Path(path).resolve()
        if path.suffix != '.py' or not path.is_relative_to(SOURCE): continue
        relative = str(path.relative_to(SOURCE)); value = hashlib.sha256(path.read_bytes()).hexdigest()
        assert manifest['files'][relative]['sha256'] == value, relative
        source_hashes[relative] = value
    result = {'schema': 'logos-engine.v6.alternating-graph-access-oracle.v1', 'sourceCommit': COMMIT,
        'sourceHashes': dict(sorted(source_hashes.items())), 'policy': {'graph': POLICY,
            'recall': CONFIG['window_constraints'], 'coupled': CONFIG['coupled_support_composition']},
        'qualification': 'Unchanged original functions, full raw ancestor returns retained. Graph-layer projections and digests are qualified separately from remaining inherited state. Synthetic public raster contracts are not successful-game evidence.',
        'scenes': SCENES, 'states': STATES, 'plans': PLANS, 'journals': JOURNALS,
        'proposalCases': PROPOSALS, 'guardCases': GUARDS, 'bindCases': BINDINGS, 'helperCases': HELPERS,
        'sourceLineCoverage': {name: sorted(lines) for name, lines in sorted(COVERED.items())},
        'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    output = ROOT / 'tests/fixtures/v6-alternating-graph-access-reference.json.gz'
    with output.open('wb') as raw:
        with gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as stream:
            stream.write(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode())
    print(json.dumps({'path': str(output.relative_to(ROOT)), 'scenes': len(SCENES), 'states': len(STATES), 'journals': len(JOURNALS),
        'recordCalls': sum(len(journal['steps']) for journal in JOURNALS), 'proposalCases': len(PROPOSALS), 'guardCases': len(GUARDS), 'bindCases': len(BINDINGS),
        'sourceFiles': len(source_hashes), 'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}))


if __name__ == '__main__': main()
