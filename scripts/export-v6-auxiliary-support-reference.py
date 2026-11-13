#!/usr/bin/env python3
"""Unchanged-source AuxiliarySupportAccess oracle on controlled public rasters.

The full source record envelopes are retained, including ancestral events.
The native comparison claims the auxiliary layer and its emitted pair update,
not the still-unported AlternatingGraph acquisition or its inherited digest.
No game identifier, private engine state, or solution enters these scenarios.
"""
from __future__ import annotations

import copy
import gzip
import hashlib
import inspect
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

from auxiliary_support_access import AuxiliarySupportAccess
from common_coupled_support import CoupledSupportConstraint
from coupled_pair_access import CoupledPairAccess
from coupled_support_preparation import (
    patch, put, translate, inside, controls, current_pair, occurrences, erased,
    group_route, select_question, parking_route, group_control_question, group_control_response,
)
from support_continuation import mode_key, scene_key, recall, observed_model, covered, prefix, cached_route, retain_suffix
from neutral_observer import measure
from terminal_composition import identity

AUX_KINDS = {'coupled_support_preparation', 'coupled_support_control_model'}
PAIR_KINDS = {'coupled_pair_epoch_anchor', 'coupled_pair_evidence'}
CONFIG = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']['coupled_support_composition']
CONFIG = {**CONFIG, 'remaining_level_actions': 40}
AVAILABLE = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6']
SCENES = {}
JOURNALS = []
HELPERS = []
PROPOSE = []
GUARDS = []
COVERED = {}
OWN_PATHS = {str(LAYA / name) for name in ('auxiliary_support_access.py', 'coupled_support_preparation.py', 'support_continuation.py')}


def plain(value):
    if isinstance(value, dict): return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)): return [plain(item) for item in value]
    if isinstance(value, (set, frozenset)): return [plain(item) for item in sorted(value)]
    return value


def traced(call):
    parent = []
    def trace(frame, event, arg):
        if event == 'line' and frame.f_code.co_filename in OWN_PATHS:
            COVERED.setdefault(Path(frame.f_code.co_filename).name + ':' + frame.f_code.co_name, set()).add(frame.f_lineno)
        if event == 'return' and frame.f_code is CoupledPairAccess.record.__code__:
            parent.append({'events': copy.deepcopy(arg), 'pair': pair_projection(frame.f_locals['self'])})
        return trace
    sys.settrace(trace)
    try: return call(), parent
    finally: sys.settrace(None)


def paint(rows, box, value):
    put(rows, box, [[value] * (box[3] - box[1] + 1) for _ in range(box[2] - box[0] + 1)])
    return rows


def open_board(boxes=((4, 4, 5, 5), (4, 12, 5, 13)), value=2):
    rows = [[0] * 20 for _ in range(12)]
    for box in boxes: paint(rows, box, value)
    return rows


def corridor(*, helper=3, pair_value=2, parking_row=2):
    rows = [[9] * 20 for _ in range(12)]
    paint(rows, [4, 2, 5, 17], 0)
    paint(rows, [parking_row, 8, 3, 9], 0)
    for box in ((4, 4, 5, 5), (4, 12, 5, 13)): paint(rows, box, pair_value)
    rows[4][8] = helper
    return rows


def scene(name, rows, *, epoch=1, score=0, revision=10, state='NOT_FINISHED', available=None):
    packet = SimpleNamespace(frame_rows=copy.deepcopy(rows), frame_packet=[copy.deepcopy(rows)], level=epoch,
        levels_completed=score, state=state, step_index=revision - 1,
        available_action_refs=list(available or AVAILABLE), frame_hash=identity(rows)[:16])
    observation, _ = measure(packet, revision, 'auxiliary-support-reference')
    SCENES[name] = {'rows': copy.deepcopy(rows), 'observation': plain(observation), 'public': plain(vars(packet))}
    return name


def pair_projection(memory):
    return plain(copy.deepcopy({'pair_state': memory.pair_state, 'pair_events': memory.pair_events, 'pair_initials': memory.pair_initials}))


def auxiliary_projection(memory):
    return plain(copy.deepcopy({'support_state': memory.support_state, 'support_events': memory.support_events, 'support_models': memory.support_models}))


def snapshot(memory):
    return {'pair': pair_projection(memory), 'auxiliary': auxiliary_projection(memory),
        'sourceParentDigest': CoupledPairAccess.retained_digest(memory),
        'sourceAuxiliaryDigest': AuxiliarySupportAccess.retained_digest(memory)}


def seeded():
    """Acquire the pair signs/floor with five actual source record operations."""
    memory = AuxiliarySupportAccess()
    specs = [((2, 4, 3, 5), (2, 12, 3, 13)), ((4, 4, 5, 5), (4, 12, 5, 13)),
        ((4, 6, 5, 7), (4, 10, 5, 11)), ((4, 4, 5, 5), (4, 12, 5, 13)),
        ((2, 4, 3, 5), (2, 12, 3, 13)), ((4, 4, 5, 5), (4, 12, 5, 13))]
    for i, boxes in enumerate(specs): scene('pair-seed:' + str(i), open_board(boxes), revision=i + 1)
    for i, action in enumerate(('ACTION2', 'ACTION4', 'ACTION3', 'ACTION1', 'ACTION2')):
        before, after = SCENES['pair-seed:' + str(i)], SCENES['pair-seed:' + str(i + 1)]
        memory.record(before['observation'], {'action_ref': action}, after['observation'], before['rows'], after['rows'], {}, 0)
    assert memory.pair_state['floors'] == [0]
    assert memory.pair_state['pair']['boxes'] == [[4, 4, 5, 5], [4, 12, 5, 13]]
    return memory


def helper(name, operation, arguments, function):
    result, _ = traced(function)
    HELPERS.append({'id': name, 'operation': operation, 'arguments': plain(copy.deepcopy(arguments)), 'expected': plain(copy.deepcopy(result))})
    return result


def proposal_case(name, memory, scene_name, *, limit=16, config=None):
    current = SCENES[scene_name]
    actual_config = copy.deepcopy(CONFIG if config is None else config)
    before = snapshot(memory)
    value, _ = traced(lambda: memory.propose_graph(current['observation'], current['rows'], [], limit, actual_config))
    assert snapshot(memory) == before, 'Proposing a support question must not acquire a response'
    case = {'id': name, 'scene': scene_name, 'maxPrefix': limit, 'config': plain(actual_config), 'initial': before,
        'expected': plain(copy.deepcopy(value)), 'qualification': 'Unchanged source AuxiliarySupportAccess.propose_graph, including its real parent call. No private game state.'}
    if config is None and limit == 16:
        adapter = CoupledSupportConstraint(); adapter.memory = copy.deepcopy(memory); adapter.level_deadline = 123456.0
        adapted = adapter.coupled_propose(current['observation'], current['rows'], [], 40, actual_config)
        case['adapter'] = {'remaining': 40, 'levelDeadline': 123456.0, 'expectedProposal': plain(copy.deepcopy(adapted))}
        if adapted is not None and adapted.get('status') == 'proposed':
            adapter.bind(adapted, None)
            case['adapter']['expectedBound'] = plain(copy.deepcopy(adapted))
    PROPOSE.append(case)
    return copy.deepcopy(value)


def guard_case(name, memory, proposal, first_name, second_name=None, *, index=0, meta_override=None, operation='before'):
    first = SCENES[first_name]
    if operation == 'before':
        meta = {'epoch': first['observation']['level_epoch'], 'score': first['observation']['levels_completed'],
            'observation_ref': first['observation']['observation_ref'], 'available': first['observation']['available_action_refs']}
        meta.update(meta_override or {})
        result, _ = traced(lambda: memory.before(proposal, index, first['rows'], **meta))
    else:
        second = SCENES[second_name]
        meta = {'epoch': second['observation']['level_epoch'], 'score': second['observation']['levels_completed'], 'state': second['observation']['state']}
        meta.update(meta_override or {})
        result, _ = traced(lambda: memory.after(proposal, index, first['rows'], second['rows'], **meta))
    GUARDS.append({'id': name, 'operation': operation, 'first': first_name, 'second': second_name, 'proposal': plain(copy.deepcopy(proposal)),
        'index': index, 'meta': plain(meta), 'expected': plain(result)})
    return result


class Driver:
    def __init__(self, name, memory=None):
        self.memory = copy.deepcopy(memory) if memory is not None else seeded()
        self.entry = {'id': name, 'qualification': 'Controlled public raster responses. The source complete envelopes are retained; native layer comparisons do not claim the unported ancestral graph acquisition.',
            'initial': snapshot(self.memory), 'steps': []}
        JOURNALS.append(self.entry)

    def record(self, first_name, second_name, proposal, *, index=0, command=None):
        first, second = SCENES[first_name], SCENES[second_name]
        command = copy.deepcopy(command if command is not None else proposal['actions'][index])
        result, parent = traced(lambda: self.memory.record(first['observation'], command, second['observation'], first['rows'], second['rows'], proposal, index))
        assert len(parent) == 1
        inherited = parent[0]['events']
        assert result[:len(inherited)] == inherited
        own = result[len(inherited):]
        assert all(e['kind'] in AUX_KINDS | {'coupled_pair_evidence'} for e in own)
        self.entry['steps'].append({'operation': {'kind': 'record', 'before': first_name, 'after': second_name, 'proposal': plain(copy.deepcopy(proposal)), 'index': index, 'command': plain(command)},
            'expected': {**snapshot(self.memory), 'rawSourceEvents': plain(copy.deepcopy(result)),
                'parentEvents': plain(copy.deepcopy(inherited)), 'pairAfterParent': parent[0]['pair'],
                'parentPairEvents': plain([e for e in inherited if e['kind'] in PAIR_KINDS]), 'auxiliaryLayerEvents': plain(copy.deepcopy(own)),
                'unportedAncestorEvents': plain([e for e in inherited if e['kind'] not in PAIR_KINDS])}})
        return copy.deepcopy(result)


def main():
    initial = seeded()
    scene('support:ready', corridor(), revision=10)
    scene('support:selected', corridor(helper=7, pair_value=1), revision=11)
    parked = corridor(helper=0, pair_value=1); parked[2][8] = 7
    scene('support:parked', parked, revision=12)
    scene('support:parked-no-return', parked, revision=13)
    returned = corridor(helper=0); returned[2][8] = 3
    scene('support:returned', returned, revision=14)
    moved = copy.deepcopy(returned)
    for box in initial.pair_state['pair']['boxes']: paint(moved, box, 0)
    for box in [[4, 6, 5, 7], [4, 10, 5, 11]]: paint(moved, box, 2)
    scene('support:group-moved', moved, revision=15)

    d = Driver('selection_parking_return_and_physical_group_verification', initial)
    select = proposal_case('select_blocking_compact_support', d.memory, 'support:ready')
    assert select.get('support_preparation_plan', {}).get('mode') == 'select'
    guard_case('current_selection_admitted', d.memory, select, 'support:ready')
    guard_case('selection_reply_remains_unknown', d.memory, select, 'support:ready', 'support:selected', operation='after')
    d.record('support:ready', 'support:selected', select)
    selected_memory = copy.deepcopy(d.memory)
    move = proposal_case('borrowed_control_first_unknown_move', d.memory, 'support:selected')
    assert move['support_preparation_plan']['mode'] == 'move'
    assert move['actions'] == [{'action_ref': 'ACTION1'}]
    guard_case('current_move_admitted', d.memory, move, 'support:selected')
    guard_case('first_control_effect_is_not_known_before_reply', d.memory, move, 'support:selected', 'support:parked', operation='after')
    d.record('support:selected', 'support:parked', move)
    parked_memory = copy.deepcopy(d.memory)
    returning = proposal_case('unmapped_discrete_return_experiment', d.memory, 'support:parked')
    assert returning['actions'] == [{'action_ref': 'ACTION5'}]
    d.record('support:parked', 'support:parked-no-return', returning)
    after_failed_return = copy.deepcopy(d.memory)
    point_return = proposal_case('current_pair_point_after_inert_return', d.memory, 'support:parked-no-return')
    assert point_return['support_preparation_plan']['mode'] == 'return' and point_return['actions'][0]['action_ref'] == 'ACTION6'
    d.record('support:parked-no-return', 'support:returned', point_return)
    returned_memory = copy.deepcopy(d.memory)
    verify = proposal_case('appearance_is_followed_by_physical_group_control', d.memory, 'support:returned')
    assert verify['support_preparation_plan']['mode'] == 'verify_group'
    guard_case('group_response_remains_a_sealed_experiment', d.memory, verify, 'support:returned', 'support:group-moved', operation='after')
    d.record('support:returned', 'support:group-moved', verify)
    assert d.memory.support_state['phase'] == 'group'
    assert d.entry['steps'][-1]['expected']['auxiliaryLayerEvents'][0]['kind'] == 'coupled_pair_evidence'
    proposal_case('parent_pair_route_resumes_after_verified_return', d.memory, 'support:group-moved')

    # Falsifiers retain evidence rather than silently replacing the measured mode.
    for label, rows in [('no_visible_selection', corridor()), ('lost_pair_on_selection', paint(corridor(helper=7), [4, 4, 5, 5], 0))]:
        name = scene('failure:' + label, rows, revision=11)
        Driver(label, initial).record('support:ready', name, select)
    bad_moves = {
        'selected_occurrence_stays': copy.deepcopy(SCENES['support:selected']['rows']),
        'remote_change_refutes_preservation': copy.deepcopy(parked),
        'vacated_support_mismatch': copy.deepcopy(parked),
        'ambiguous_selected_correspondence': copy.deepcopy(parked),
        'pair_locus_disappears': copy.deepcopy(parked),
    }
    bad_moves['remote_change_refutes_preservation'][8][16] = 6
    bad_moves['vacated_support_mismatch'][4][8] = 6
    bad_moves['ambiguous_selected_correspondence'][4][6] = 7
    paint(bad_moves['pair_locus_disappears'], [4, 4, 5, 5], 0)
    for label, rows in bad_moves.items():
        name = scene('failure:' + label, rows, revision=12)
        guard_case('after_' + label, selected_memory, move, 'support:selected', name, operation='after')
        bad = Driver(label, selected_memory); bad.record('support:selected', name, move)
        proposal_case('abstain_after_' + label, bad.memory, name)
    legacy_move = copy.deepcopy(move); legacy_move['support_preparation_plan']['detail'].pop('floor')
    Driver('legacy_uncovered_zero_displacement', selected_memory).record('support:selected', 'failure:selected_occurrence_stays', legacy_move)

    lost = copy.deepcopy(returned); paint(lost, [4, 4, 5, 5], 0)
    scene('failure:point-return-lost-pair', lost, revision=14)
    Driver('point_return_without_pair_is_unresolved', after_failed_return).record('support:parked-no-return', 'failure:point-return-lost-pair', point_return)
    Driver('point_return_can_require_control_despite_unchanged_appearance', after_failed_return).record('support:parked-no-return', 'support:parked-no-return', point_return)
    no_click = copy.deepcopy(returning); no_click['support_preparation_plan']['detail']['return_kind'] = 'non_translation_input'
    name = scene('failure:return-without-point-input', parked, revision=13, available=['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'])
    Driver('failed_return_without_available_point_is_unresolved', parked_memory).record('support:parked', name, no_click)

    for label, rows in [('group_unchanged', returned), ('parked_helper_changed', copy.deepcopy(moved)), ('group_recolored', copy.deepcopy(moved))]:
        if label == 'parked_helper_changed': rows[2][8] = 8
        if label == 'group_recolored':
            for box in [[4, 6, 5, 7], [4, 10, 5, 11]]: paint(rows, box, 11)
        name = scene('failure:' + label, rows, revision=15)
        guard_case('response_' + label, returned_memory, verify, 'support:returned', name, operation='after')
        Driver(label, returned_memory).record('support:returned', name, verify)

    boundary = scene('boundary:next-epoch', parked, epoch=2, score=1, revision=20)
    Driver('epoch_boundary_preserves_auxiliary_projection', selected_memory).record('support:selected', boundary, move)
    for label, override in [('score', {'score': 1}), ('epoch', {'epoch': 2}), ('win', {'state': 'WIN'}), ('game_over', {'state': 'GAME_OVER'})]:
        guard_case('after_boundary_' + label, selected_memory, move, 'support:selected', 'support:parked', operation='after', meta_override=override)
    for label, override in [('epoch', {'epoch': 2}), ('score', {'score': 1}), ('observation', {'observation_ref': 'different'}), ('available', {'available': ['ACTION2']})]:
        guard_case('before_mismatch_' + label, selected_memory, move, 'support:selected', meta_override=override)
    for label, mutate in [('actions', lambda p: p['actions'].append({'action_ref': 'ACTION2'})),
        ('bundle', lambda p: p['bundle_template'].update(actions=[])), ('initial_digest', lambda p: p['support_preparation_plan'].update(frame_digest='changed'))]:
        changed = copy.deepcopy(move); mutate(changed); guard_case('before_payload_' + label, selected_memory, changed, 'support:selected')
    extended_select = copy.deepcopy(select)
    extended_select['actions'] = extended_select['actions'] * 2
    extended_select['bundle_template']['actions'] = copy.deepcopy(extended_select['actions'])
    extended_select['support_preparation_plan']['commands'] = copy.deepcopy(extended_select['actions'])
    guard_case('selection_cannot_release_second_primitive', initial, extended_select, 'support:ready', index=1)

    # The complete original callback continues to arbitrate pair-first priority.
    proposal_case('disabled_support_preparation_preserves_parent', initial, 'support:ready', config={'coupled_pair_question': {**CONFIG['coupled_pair_question'], 'prepare_unmatched_supports': False}})
    proposal_case('missing_pair_uses_exact_parent_abstention', AuxiliarySupportAccess(), 'support:ready')
    proposal_case('stale_pair_uses_parent', initial, boundary)
    stale_aux = copy.deepcopy(selected_memory); stale_state = copy.deepcopy(stale_aux.support_state); stale_state['epoch'] = 0
    stale_aux.apply_event({'kind': 'coupled_support_preparation', 'state': stale_state, 'mode': 'controlled_initial_projection', 'evidence': []})
    proposal_case('stale_auxiliary_is_ignored_for_current_selection', stale_aux, 'support:ready')
    blocked = copy.deepcopy(initial); blocked_state = copy.deepcopy(blocked.pair_state); blocked_state['unresolved'] = {'kind': 'joint_projection_refuted'}
    blocked.apply_event({'kind': 'coupled_pair_evidence', 'state': blocked_state, 'evidence': []})
    proposal_case('parent_refutation_blocks_auxiliary_erasure_question', blocked, 'support:ready')
    no_point = scene('context:no-point', SCENES['support:ready']['rows'], available=['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'], revision=10)
    proposal_case('selection_requires_current_point_input', initial, no_point)
    proposal_case('zero_prefix_cannot_release_uncovered_move', selected_memory, 'support:selected', limit=0)
    parked_no_controls = copy.deepcopy(parked_memory)
    empty_available = scene('context:no-return-input', parked, available=['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'], revision=12)
    proposal_case('no_return_control_preserves_unknown', parked_no_controls, empty_available)

    # Selected-role model recall and suffix admission are geometry-conditioned.
    aux = copy.deepcopy(parked_memory.support_state)
    models = copy.deepcopy(parked_memory.support_models)
    helper('mode_identity', 'mode_key', {'aux': aux}, lambda: mode_key(aux))
    helper('scene_identity_erases_only_selected_role', 'scene_key', {'rows': parked, 'aux': aux}, lambda: scene_key(parked, aux))
    helper('recall_same_mode', 'recall', {'models': models, 'aux': aux, 'available': AVAILABLE}, lambda: recall(models, aux, AVAILABLE))
    helper('recall_unavailable_input', 'recall', {'models': models, 'aux': aux, 'available': ['ACTION2']}, lambda: recall(models, aux, ['ACTION2']))
    other_epoch = {**aux, 'epoch': 2}
    helper('recall_is_epoch_scoped', 'recall', {'models': models, 'aux': other_epoch, 'available': AVAILABLE}, lambda: recall(models, other_epoch, AVAILABLE))
    event = helper('model_keeps_duplicate_witness', 'observed_model', {'models': models, 'aux': aux, 'action': 'ACTION1', 'delta': [-2, 0], 'evidence': ['b', 'a']}, lambda: observed_model(models, aux, 'ACTION1', [-2, 0], ['b', 'a']))
    divergent = copy.deepcopy(models); divergent[event['model_ref']] = copy.deepcopy(event['model']); divergent[event['model_ref']]['controls']['ACTION1']['witnesses'].append({'delta': [2, 0], 'evidence': ['b2', 'a2'], 'occurrence': aux['selection_ref']})
    helper('conflicting_model_is_not_recalled', 'recall', {'models': divergent, 'aux': aux, 'available': AVAILABLE}, lambda: recall(divergent, aux, AVAILABLE))
    event = helper('model_refutation_is_retained', 'observed_model', {'models': models, 'aux': aux, 'action': 'ACTION1', 'delta': [0, 0], 'evidence': ['b', 'a'], 'refutation': {'matched': False}}, lambda: observed_model(models, aux, 'ACTION1', [0, 0], ['b', 'a'], refutation={'matched': False}))
    refuted = {**models, event['model_ref']: event['model']}
    helper('counterexample_blocks_recall', 'recall', {'models': refuted, 'aux': aux, 'available': AVAILABLE}, lambda: recall(refuted, aux, AVAILABLE))
    route = {'path': [{'action_ref': 'ACTION1', 'from': [6, 8, 7, 9], 'to': [4, 8, 5, 9], 'mapping_observed': False},
        {'action_ref': 'ACTION1', 'from': [4, 8, 5, 9], 'to': [2, 8, 3, 9], 'mapping_observed': False},
        {'action_ref': 'ACTION4', 'from': [2, 8, 3, 9], 'to': [2, 10, 3, 11], 'mapping_observed': False}], 'joint_length': 3, 'states': 5, 'scope': 'controlled admitted path'}
    free = open_board(); role = {'epoch': 1, 'box': [6, 8, 7, 9], 'selected_patch': [[7, 0], [0, 0]], 'floor': 0, 'measured_moves': {}, 'selection_ref': ['b', 'a']}
    put(free, role['box'], role['selected_patch'])
    for label, changes in [('unknown_effect_cuts_first', {}), ('current_controls_span_new_cells', {'measured_moves': {'ACTION1': [-2, 0]}}),
        ('conditional_recall_spans_new_cells', {'recalled_moves': {'ACTION1': {'delta': [-2, 0], 'evidence': ['earlier']}}}),
        ('incorrect_recall_does_not_cover', {'recalled_moves': {'ACTION1': {'delta': [2, 0], 'evidence': ['contrary']}}})]:
        current_aux = {**role, **changes}
        helper(label, 'prefix', {'route': route, 'aux': current_aux, 'rows': free, 'limit': 16}, lambda a=current_aux: prefix(route, a, free, 16))
    helper('prefix_honors_zero_bound', 'prefix', {'route': route, 'aux': role, 'rows': free, 'limit': 0}, lambda: prefix(route, role, free, 0))
    bad_route = copy.deepcopy(route); bad_route['path'][0]['from'][0] += 1
    helper('prefix_rejects_wrong_origin', 'prefix', {'route': bad_route, 'aux': role, 'rows': free, 'limit': 16}, lambda: prefix(bad_route, role, free, 16))
    blocked_rows = copy.deepcopy(free); blocked_rows[4][8] = 9
    helper('prefix_rejects_new_obstacle', 'prefix', {'route': route, 'aux': role, 'rows': blocked_rows, 'limit': 16}, lambda: prefix(route, role, blocked_rows, 16))
    # A known conditional effect can continue at index 1. A new cell alone is
    # not an unknown control mapping, and only the first action uses full-frame
    # identity; every later primitive still binds its selected patch/free cell.
    known_role = {**role, 'measured_moves': {'ACTION1': [-2, 0]}}
    known_steps = prefix(route, known_role, free, 2)
    known_first = scene('known-prefix:first', free, revision=30)
    known_middle_rows = copy.deepcopy(free); paint(known_middle_rows, role['box'], 0); put(known_middle_rows, known_steps[0]['to'], role['selected_patch'])
    known_middle = scene('known-prefix:middle', known_middle_rows, revision=31)
    known_last_rows = copy.deepcopy(known_middle_rows); paint(known_last_rows, known_steps[0]['to'], 0); put(known_last_rows, known_steps[1]['to'], role['selected_patch'])
    known_last = scene('known-prefix:last', known_last_rows, revision=32)
    known_plan = copy.deepcopy(move)
    known_plan['actions'] = [{'action_ref': step['action_ref']} for step in known_steps]
    known_plan['bundle_template']['actions'] = copy.deepcopy(known_plan['actions'])
    known_plan['support_preparation_plan'].update(observation_ref=SCENES[known_first]['observation']['observation_ref'], frame_digest=identity(free),
        commands=copy.deepcopy(known_plan['actions']), motion_steps=copy.deepcopy(known_steps),
        detail={**known_plan['support_preparation_plan']['detail'], 'box': role['box'], 'selected_patch': role['selected_patch'],
            'floor': 0, 'preserved_pair': initial.pair_state['pair'], 'step': known_steps[0], 'parking': route})
    guard_case('known_prefix_first_primitive_admitted', selected_memory, known_plan, known_first)
    guard_case('known_effect_continues_without_sealing', selected_memory, known_plan, known_first, known_middle, operation='after')
    guard_case('known_prefix_second_primitive_admitted', selected_memory, known_plan, known_middle, index=1)
    guard_case('known_second_effect_continues', selected_memory, known_plan, known_middle, known_last, index=1, operation='after')
    bad_later = copy.deepcopy(known_middle_rows); bad_later[2][8] = 9
    name = scene('known-prefix:next-cell-blocked', bad_later, revision=31)
    guard_case('known_prefix_rejects_new_cell_obstruction', selected_memory, known_plan, name, index=1)
    helper('retained_empty_suffix', 'cached_route', {'aux': aux, 'rows': parked}, lambda: cached_route(aux, parked))
    outside = copy.deepcopy(parked); outside[0][0] = 8
    helper('suffix_ignores_outer_border', 'cached_route', {'aux': aux, 'rows': outside}, lambda: cached_route(aux, outside))
    inside_change = copy.deepcopy(parked); inside_change[8][16] = 8
    helper('suffix_rejects_interior_change', 'cached_route', {'aux': aux, 'rows': inside_change}, lambda: cached_route(aux, inside_change))
    role_change = copy.deepcopy(parked); role_change[2][8] = 3
    helper('suffix_rejects_selected_pattern_change', 'cached_route', {'aux': aux, 'rows': role_change}, lambda: cached_route(aux, role_change))

    # Public measurements and absence results have independent exact cases.
    state = copy.deepcopy(initial.pair_state); ready = SCENES['support:ready']['rows']
    helper('controls_keep_observed_iteration_order', 'controls', {'state': state, 'available': AVAILABLE}, lambda: controls(state, AVAILABLE))
    contradictory = copy.deepcopy(state); contradictory['samples']['ACTION4'].append({'deltas': [[0, 2], [0, 2]], 'evidence': ['b', 'a']})
    helper('conflicting_signs_stay_unknown', 'controls', {'state': contradictory, 'available': AVAILABLE}, lambda: controls(contradictory, AVAILABLE))
    helper('same_loci_can_change_pair_palette', 'current_pair', {'rows': SCENES['support:selected']['rows'], 'known': state['pair']}, lambda: current_pair(SCENES['support:selected']['rows'], state['pair']))
    reversed_pair = copy.deepcopy(state['pair']); reversed_pair['boxes'].reverse()
    helper('current_pair_preserves_tracked_member_order', 'current_pair', {'rows': ready, 'known': reversed_pair}, lambda: current_pair(ready, reversed_pair))
    items = helper('one_compact_occurrence_per_cell', 'occurrences', {'rows': ready, 'pair': state['pair'], 'floor': 0}, lambda: occurrences(ready, state['pair'], 0))
    helper('erasure_is_a_returned_counterfactual_copy', 'erased', {'rows': ready, 'items': items, 'floor': 0}, lambda: erased(ready, items, 0))
    helper('parked_support_is_not_selected_again', 'select_question', {'rows': ready, 'state': state, 'available': AVAILABLE, 'remaining': 40, 'parked': [items[0]['box']]}, lambda: select_question(ready, state, AVAILABLE, 40, [items[0]['box']]))
    two_floors = {**state, 'floors': [0, 1]}
    helper('selection_requires_one_revealed_floor', 'select_question', {'rows': ready, 'state': two_floors, 'available': AVAILABLE, 'remaining': 40, 'parked': []}, lambda: select_question(ready, two_floors, AVAILABLE, 40, []))
    helper('parking_has_a_real_zero_depth_refusal', 'parking_route', {'rows': SCENES['support:selected']['rows'], 'state': state, 'aux': selected_memory.support_state, 'available': AVAILABLE, 'remaining': 0}, lambda: parking_route(SCENES['support:selected']['rows'], state, selected_memory.support_state, AVAILABLE, 0))
    helper('group_control_requires_free_measured_destinations', 'group_control_question', {'rows': ready, 'state': state, 'aux': selected_memory.support_state, 'available': ['ACTION1', 'ACTION2']}, lambda: group_control_question(ready, state, selected_memory.support_state, ['ACTION1', 'ACTION2']))
    helper('group_control_observation_preserves_auxiliary', 'group_control_response', {'rows': returned, 'later': moved, 'detail': verify['support_preparation_plan']['detail']}, lambda: group_control_response(returned, moved, verify['support_preparation_plan']['detail']))

    # A matched parent pair response can finish an older pending return method.
    legacy_return = copy.deepcopy(returned_memory); legacy_state = copy.deepcopy(legacy_return.support_state)
    legacy_state['return_method'] = {'status': 'appearance_restored', 'evidence': ['old']}
    legacy_return.apply_event({'kind': 'coupled_support_preparation', 'state': legacy_state, 'mode': 'controlled_legacy_projection', 'evidence': []})
    original_pair = copy.deepcopy(initial.pair_state['pair']); expected = [[4, 6, 5, 7], [4, 10, 5, 11]]
    pair_plan = {'pair_access_plan': {'epoch': 1, 'score': 0, 'pair': original_pair, 'expected': [expected], 'trial': 'controlled-parent-return'}, 'actions': [{'action_ref': 'ACTION4'}]}
    Driver('matched_parent_pair_revalidates_pending_return_method', legacy_return).record('support:returned', 'support:group-moved', pair_plan)

    sources = [LAYA / name for name in ('auxiliary_support_access.py', 'coupled_support_preparation.py', 'support_continuation.py', 'common_coupled_support.py', 'coupled_pair_access.py', 'coupled_pair_observation.py', 'alternating_graph_access.py', 'alternating_graph_observation.py', 'terminal_composition.py')]
    sources += [SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm']
    manifest = json.loads((ROOT / 'reference/v6' / COMMIT / 'manifest.json').read_text())
    hashes = {}
    for path in sources:
        relative = str(path.relative_to(SOURCE)); actual = hashlib.sha256(path.read_bytes()).hexdigest()
        assert manifest['files'][relative]['sha256'] == actual
        hashes[relative] = actual
    for journal in JOURNALS: journal['final'] = journal['steps'][-1]['expected'] if journal['steps'] else journal['initial']
    result = {'provenance': {'commit': COMMIT, 'sourceModified': False, 'sources': hashes,
        'sourceMethod': 'Direct unchanged AuxiliarySupportAccess, coupled_support_preparation and support_continuation with the actual original parent pair planner and record chain.',
        'qualification': 'Controlled public rasters and public pair-acquisition seed; no game completion or private state. Raw source record events are preserved, including alternating_graph_evidence. Native parity is the auxiliary layer, its guards/helpers and emitted pair update, not unported ancestral graph acquisition or the full inheritance digest.'},
        'config': CONFIG, 'scenes': SCENES, 'journals': JOURNALS, 'proposals': PROPOSE, 'guards': GUARDS, 'helpers': HELPERS,
        'sourceLineCoverage': {key: sorted(lines) for key, lines in sorted(COVERED.items())}}
    output = ROOT / 'tests/fixtures/v6-auxiliary-support-reference.json.gz'
    output.write_bytes(gzip.compress(json.dumps(plain(result), ensure_ascii=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(output), 'journals': len(JOURNALS), 'recordSteps': sum(len(j['steps']) for j in JOURNALS),
        'proposals': len(PROPOSE), 'guards': len(GUARDS), 'helpers': len(HELPERS), 'unportedAncestorEvents': sum(len(s['expected']['unportedAncestorEvents']) for j in JOURNALS for s in j['steps']), 'gzipBytes': output.stat().st_size}))


if __name__ == '__main__': main()
