#!/usr/bin/env python3
"""Run the unchanged pinned SymbolTransactions Interface on controlled rasters.

All returns and boundaries below are synthetic source-oracle inputs. No game
host is opened, no action is dispatched, and no observed game win is claimed.
The portable method is learned by original record calls, never installed as a
handwritten expected method. Further controlled state perturbations are named.
"""
from __future__ import annotations

from collections import Counter
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.dont_write_bytecode = True
CACHE = tempfile.TemporaryDirectory(prefix='symbol-interface-original-')
sys.pycache_prefix = CACHE.name
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']


def verify_sources():
    for name, record in MANIFEST.items():
        assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == record['sha256'], name


verify_sources()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from neutral_observer import measure
from agents.yf_arc3_v6.morphology_policy.symbol_transactions.family import SymbolTransactions, holds
from agents.yf_arc3_v6.morphology_policy.symbol_transactions.interface import Interface, scene, signature, pair_signature, inside, at, count_inside


def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple)): return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)): return [plain(child) for child in sorted(value)]
    return value


EXECUTED = Counter()
SOURCE_PREFIX = str(SOURCE) + '/'


def profile(frame, event, _arg):
    if event == 'call' and frame.f_code.co_filename.startswith(SOURCE_PREFIX):
        EXECUTED[(frame.f_code.co_filename[len(SOURCE_PREFIX):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1


sys.setprofile(profile)
CONFIG = SymbolTransactions().config
assert CONFIG['palette_white_value'] == 0
CASES, PURE_CASES, SEQUENCES = [], [], []


def observation(rows, epoch=1, revision=1):
    packet = SimpleNamespace(frame_rows=rows,
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16],
        level=epoch, levels_completed=epoch-1, state='NOT_FINISHED', available_action_refs=('ACTION6',))
    return measure(packet, revision, 'symbols:synthetic')[0]


def command(point):
    return {'action_ref': 'ACTION6', 'data': {'x': point[0], 'y': point[1]}}


def perimeter(rows, box, value):
    left, top, right, bottom = box
    for y in range(top, bottom+1):
        for x in range(left, right+1):
            if y in (top, bottom) or x in (left, right): rows[y][x] = value


def square(rows, point, value, hollow=False, size=3):
    x, y = point; radius = size//2
    for py in range(y-radius, y+radius+1):
        for px in range(x-radius, x+radius+1):
            rows[py][px] = value if not hollow or px in (x-radius, x+radius) or py in (y-radius, y+radius) else 9


SOURCE_BOX, RECEIVER_BOX = [2, 24, 23, 46], [40, 24, 61, 46]
PAIR = [[28, 17], [36, 17]]
SOURCE_ONE, SOURCE_TWO, DIRECT_THREE, RESULT = [4, 29], [17, 29], [7, 39], [17, 39]
DEMAND_THREE, DEMAND_TWO, ACTIVATE = [42, 29], [55, 39], [32, 17]


def raster(left=(1, 2), right=(3,)):
    rows = [[9]*64 for _ in range(50)]
    perimeter(rows, [2, 2, 31, 10], 8)
    for x, value in zip((6, 11), left): square(rows, [x, 6], value)
    for y in range(5, 8): rows[y][18] = 7
    for x in range(16, 19): rows[6][x] = 7
    for x, value in zip((23, 28), right): square(rows, [x, 6], value)
    perimeter(rows, SOURCE_BOX, 6); perimeter(rows, RECEIVER_BOX, 5)
    for point, value in ((SOURCE_ONE, 1), (SOURCE_TWO, 2), (DIRECT_THREE, 3)):
        square(rows, point, value)
    square(rows, DEMAND_THREE, 3, True); square(rows, DEMAND_TWO, 2, True)
    for x, y in PAIR:
        perimeter(rows, [x-2, y-2, x+2, y+2], 4); square(rows, [x, y], 11)
    return rows


def selection(rows, point, enabled=True):
    rows = copy.deepcopy(rows); x, y = point
    box = [x-2, y-2, x+2, y+2]
    perimeter(rows, box, CONFIG['palette_white_value'] if enabled else 9)
    if not enabled:
        # Explicit synthetic underlay: the first inventory glyph touches the
        # inner edge, so its selection perimeter occludes the parent border.
        for parent, value in ((SOURCE_BOX, 6), (RECEIVER_BOX, 5)):
            for py in range(box[1], box[3]+1):
                for px in range(box[0], box[2]+1):
                    if (py in (box[1], box[3]) or px in (box[0], box[2])) and (
                        parent[0] <= px <= parent[2] and parent[1] <= py <= parent[3]
                        and (px in (parent[0], parent[2]) or py in (parent[1], parent[3]))): rows[py][px] = value
    return rows


def pure(name, operation, arguments):
    functions = {'scene': scene, 'signature': signature, 'pair_signature': pair_signature,
                 'inside': inside, 'at': at, 'count_inside': count_inside}
    row = {'id': name, 'operation': operation, 'arguments': plain(arguments)}
    try: row['value'] = plain(functions[operation](*copy.deepcopy(arguments)))
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
        row['error'] = {'name': type(error).__name__, 'message': str(error)}
    PURE_CASES.append(row)
    return row


def invoke(interface, operation, arguments):
    try: return {'value': plain(getattr(interface, operation)(*copy.deepcopy(arguments)))}
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
        return {'error': {'name': type(error).__name__, 'message': str(error)}}


def case(name, operation, arguments, seed=None, config=None):
    selected_config = CONFIG if config is None else config
    interface = Interface(selected_config, holds)
    if seed is not None: interface.restore(copy.deepcopy(seed))
    row = {'id': name, 'operation': operation, 'arguments': plain(arguments), 'seedState': plain(interface.state())}
    if config is not None: row['config'] = plain(config)
    row.update(invoke(interface, operation, arguments)); row['afterState'] = plain(interface.state())
    CASES.append(row)
    return row


def sequence(name, operations, seed=None):
    interface = Interface(CONFIG, holds)
    if seed is not None: interface.restore(copy.deepcopy(seed))
    row = {'id': name, 'seedState': plain(interface.state()), 'steps': []}
    for operation, arguments in operations:
        step = {'operation': operation, 'arguments': plain(arguments)}
        step.update(invoke(interface, operation, arguments)); step['afterState'] = plain(interface.state())
        row['steps'].append(step)
    SEQUENCES.append(row)
    return row


BASE = raster()
assert scene(BASE, CONFIG)['diagrams'] == [{'left': [1, 2], 'right': [3], 'branch': 7, 'size': 3}]
assert [slot['value'] for slot in scene(BASE, CONFIG)['pairs'][0]] == [11, 11]
learner = Interface(CONFIG, holds)
ACQUISITION = []
current, revision = copy.deepcopy(BASE), 1


def learn(label, point, after_rows, after_epoch=1):
    global current, revision
    before = observation(current, 1, revision); after = observation(after_rows, after_epoch, revision+1)
    args = [before, after, command(point), current, after_rows, {}]
    result = learner.record(*copy.deepcopy(args))
    ACQUISITION.append({'id': label, 'operation': 'record', 'arguments': plain(args),
                        'value': plain(result), 'afterState': plain(learner.state())})
    current = copy.deepcopy(after_rows); revision += 1
    return result


assert learn('select_operand_one', SOURCE_ONE, selection(current, SOURCE_ONE))['kinds'] == ['select']
loaded = selection(current, SOURCE_ONE, False); square(loaded, PAIR[0], 1)
assert learn('load_operand_one', PAIR[0], loaded)['kinds'] == ['load']
assert learn('select_operand_two', SOURCE_TWO, selection(current, SOURCE_TWO))['kinds'] == ['select']
loaded = selection(current, SOURCE_TWO, False); square(loaded, PAIR[1], 2)
assert learn('load_operand_two', PAIR[1], loaded)['kinds'] == ['load']
transformed = copy.deepcopy(current)
for point in PAIR: square(transformed, point, 11)
square(transformed, RESULT, 3)
assert learn('transform_displayed_pair', ACTIVATE, transformed)['kinds'] == ['transform']
assert learn('select_observed_result', RESULT, selection(current, RESULT))['kinds'] == ['select']
received = selection(current, RESULT, False); square(received, DEMAND_THREE, 3)
assert learn('receive_matching_hollow', DEMAND_THREE, received)['kinds'] == ['receive']
PRE_BOUNDARY = plain(learner.state())
assert not PRE_BOUNDARY['methods']
assert learn('official_boundary_builds_method', ACTIVATE, BASE, 2)['status'] == 'boundary_method_built'
ACQUIRED = plain(learner.state())
assert len(ACQUIRED['methods']) == 1 and ACQUIRED['epoch'] == 2 and not ACQUIRED['contrasts'] and not ACQUIRED['samples']
METHOD = ACQUIRED['methods'][0]
assert METHOD['source_signature'] == [6, 22, 23] and METHOD['receiver_signature'] == [5, 22, 23], METHOD
assert METHOD['empty_value'] == 11 and METHOD['activation_offset_twice'] == [0, 0]
POINTS = [SOURCE_ONE, SOURCE_TWO, DIRECT_THREE, RESULT, *PAIR, DEMAND_THREE, DEMAND_TWO, ACTIVATE]
NEXT = {'rows': BASE, 'observation': observation(BASE, 2, 100), 'inputs': [command(point) for point in POINTS], 'remaining': 1}

pure('complete_scene', 'scene', [BASE, CONFIG])
pure('selection_scene', 'scene', [selection(BASE, SOURCE_ONE), CONFIG])
pure('strict_inside_boundary', 'inside', [[SOURCE_BOX[0], SOURCE_ONE[1]], SOURCE_BOX])
pure('strict_inside_interior', 'inside', [SOURCE_ONE, SOURCE_BOX])
pure('container_signature_translation_independent', 'signature', [{'value': 6, 'box': [20, 30, 41, 52]}])
pure('oriented_pair_signature', 'pair_signature', [scene(BASE, CONFIG)['pairs'][0]])
pure('no_diagram_no_glyphs', 'scene', [[[9]*9 for _ in range(7)], CONFIG])
case('no_method_abstains', 'options', [NEXT['observation'], BASE, NEXT['inputs'], 1])
case('learned_method_current_options', 'options', [NEXT['observation'], BASE, NEXT['inputs'], 1], ACQUIRED)
case('remaining_zero_abstains', 'options', [NEXT['observation'], BASE, NEXT['inputs'], 0], ACQUIRED)
case('remaining_negative_abstains', 'options', [NEXT['observation'], BASE, NEXT['inputs'], -1], ACQUIRED)
case('all_effects_before_boundary_are_not_portable_yet', 'options', [observation(BASE, 1, 100), BASE, NEXT['inputs'], 1], PRE_BOUNDARY)

# All current options are recomputed by the original Interface. None of these
# calls use expected TypeScript output or a handwritten acquired method.
def original_options(rows, seed=ACQUIRED, epoch=2, inputs=None, remaining=1):
    interface = Interface(CONFIG, holds); interface.restore(copy.deepcopy(seed))
    return interface.options(observation(rows, epoch, 100), rows,
                             NEXT['inputs'] if inputs is None else inputs, remaining)


OPTIONS = original_options(BASE)
assert {o['facts']['offer_kind'] for o in OPTIONS} == {'select_direct', 'select_operand'}
operand = next(o for o in OPTIONS if o['facts']['offer_kind'] == 'select_operand' and o['action'] == command(SOURCE_ONE))
select_proposal = {'symbol_transaction_plan': {'interface_offer': copy.deepcopy(operand['interface_offer'])}}
selected_one = selection(BASE, SOURCE_ONE)
selected_args = [observation(BASE, 2, 110), observation(selected_one, 2, 111), command(SOURCE_ONE), BASE, selected_one, select_proposal]
selected_case = case('active_select_records_current_binding', 'record', selected_args, ACQUIRED)
assert selected_case['value']['kinds'] == ['select']
selected_state = selected_case['afterState']
case('selected_source_requires_same_scope_bound_revalidation', 'options',
     [observation(selected_one, 2, 111), selected_one, NEXT['inputs'], 1], selected_state)
case('selected_occluded_source_without_binding_abstains', 'options',
     [observation(selected_one, 2, 111), selected_one, NEXT['inputs'], 1], ACQUIRED)
case('source_binding_cannot_cross_epoch', 'options',
     [observation(selected_one, 3, 112), selected_one, NEXT['inputs'], 1], selected_state)
broken_source = copy.deepcopy(selected_one); broken_source[24][12] = 12
case('source_parent_changed_outside_selection_abstains', 'options',
     [observation(broken_source, 2, 113), broken_source, NEXT['inputs'], 1], selected_state)

for name, values in [('one_ordered_operand_loaded', [1, 11]), ('loaded_filter_keeps_pair_order', [11, 1]),
                     ('complete_ordered_pair_can_activate', [1, 2]), ('permuted_operands_abstain', [2, 1])]:
    rows = copy.deepcopy(BASE)
    for point, value in zip(PAIR, values): square(rows, point, value)
    case(name, 'options', [observation(rows, 2, 120), rows, NEXT['inputs'], 1], ACQUIRED)
    if values == [1, 2]: FULL_PAIR = rows
repeated = raster(left=(1, 1))
repeat_case = case('repeated_operand_with_one_stock_glyph_remains_unknown', 'options',
                  [observation(repeated, 2, 121), repeated, NEXT['inputs'], 1], ACQUIRED)
assert any(o['facts']['offer_kind'] == 'select_operand' for o in repeat_case['value'])
assert all('inventory_exact_multiplicities' in o['interface_offer']['unknown'] for o in repeat_case['value'])
missing_stock = copy.deepcopy(BASE); square(missing_stock, SOURCE_TWO, 9)
case('missing_operand_value_blocks_recipe_selection', 'options',
     [observation(missing_stock, 2, 122), missing_stock, NEXT['inputs'], 1], ACQUIRED)
odd = copy.deepcopy(ACQUIRED); odd['methods'][0]['activation_offset_twice'] = [1, 0]
case('controlled_odd_activation_offset_is_not_a_pixel', 'options',
     [observation(FULL_PAIR, 2, 123), FULL_PAIR, NEXT['inputs'], 1], odd)
duplicate_source = copy.deepcopy(BASE); perimeter(duplicate_source, [40, 1, 61, 23], 6)
case('two_current_sources_do_not_establish_unique_binding', 'options',
     [observation(duplicate_source, 2, 124), duplicate_source, NEXT['inputs'], 1], ACQUIRED)
triple_pair = copy.deepcopy(BASE); perimeter(triple_pair, [42, 15, 46, 19], 4); square(triple_pair, [44, 17], 11)
case('three_equal_frames_are_not_a_pair', 'options',
     [observation(triple_pair, 2, 125), triple_pair, NEXT['inputs'], 1], ACQUIRED)
multiple_selection = selection(selection(BASE, SOURCE_ONE), SOURCE_TWO)
case('multiple_current_selections_abstain', 'options',
     [observation(multiple_selection, 2, 126), multiple_selection, NEXT['inputs'], 1], ACQUIRED)
foreign_selection = selection(BASE, [6, 6])
case('selection_outside_source_abstains', 'options',
     [observation(foreign_selection, 2, 127), foreign_selection, NEXT['inputs'], 1], ACQUIRED)
case('duplicate_equal_commands_are_not_unique', 'options',
     [NEXT['observation'], BASE, [command(SOURCE_TWO), command(SOURCE_TWO)], 1], ACQUIRED)
case('extra_command_data_is_not_exact_xy', 'options',
     [NEXT['observation'], BASE, [{'action_ref': 'ACTION6', 'data': {**command(SOURCE_TWO)['data'], 'extra': 1}}], 1], ACQUIRED)
case('outer_command_fields_are_retained', 'options',
     [NEXT['observation'], BASE, [{**command(SOURCE_TWO), 'opaque': {'label': 'source-owned'}}], 1], ACQUIRED)
no_entity = copy.deepcopy(NEXT['observation']); no_entity['entities'] = []
case('no_entity_at_point_abstains', 'options', [no_entity, BASE, NEXT['inputs'], 1], ACQUIRED)
ambiguous_entity = copy.deepcopy(NEXT['observation']); ambiguous_entity['entities'] *= 2
case('two_entities_at_point_abstain', 'options', [ambiguous_entity, BASE, NEXT['inputs'], 1], ACQUIRED)
translated = [[9]*66 for _ in range(2)] + [[9]+row+[9] for row in BASE] + [[9]*66 for _ in range(2)]
case('current_geometry_rebinds_under_translation', 'options',
     [observation(translated, 2, 128), translated, [command([x+1, y+2]) for x, y in POINTS], 1], ACQUIRED)

# A no-effect return refutes this method only in its current epoch. It does not
# erase the portable method, nor authorize a later action without revalidation.
no_effect_args = [observation(BASE, 2, 130), observation(BASE, 2, 131), command(SOURCE_ONE), BASE, BASE, select_proposal]
no_effect = case('active_no_effect_refutes_in_current_epoch', 'record', no_effect_args, ACQUIRED)
case('current_epoch_refutation_disables_method', 'options',
     [observation(BASE, 2, 132), BASE, NEXT['inputs'], 1], no_effect['afterState'])
case('next_epoch_revalidates_method_despite_old_refutation', 'options',
     [observation(BASE, 3, 133), BASE, NEXT['inputs'], 1], no_effect['afterState'])
case('scope_change_preserves_methods_and_refutations_only', 'scope', [3], no_effect['afterState'])
case('same_scope_preserves_current_samples_and_binding', 'scope', [2], selected_state)

selected_three = selection(BASE, DIRECT_THREE)
receive_offer = next(o for o in original_options(selected_three) if o['facts']['offer_kind'] == 'receive_selected')
receive_proposal = {'symbol_transaction_plan': {'interface_offer': copy.deepcopy(receive_offer['interface_offer'])}}
received = selection(selected_three, DIRECT_THREE, False); square(received, DEMAND_THREE, 3)
receive_args = [observation(selected_three, 2, 140), observation(received, 2, 141), command(DEMAND_THREE), selected_three, received, receive_proposal]
case('active_matching_receipt_preserves_other_requests', 'record', receive_args, ACQUIRED)
damaged = copy.deepcopy(received); square(damaged, DEMAND_TWO, 2)
damaged_args = [observation(selected_three, 2, 142), observation(damaged, 2, 143), command(DEMAND_THREE), selected_three, damaged, receive_proposal]
damage = case('other_request_change_refutes_but_retains_recorded_contrast', 'record', damaged_args, ACQUIRED)
assert damage['value']['kinds'] == [] and damage['afterState']['contrasts'][-1]['kind'] == 'receive'
assert damage['afterState']['refutations'][-1]['expected'] == 'receive'

# The overlay is measured against the ORIGINAL parent perimeter, including
# changed pixels on x=40. A child wholly inside the parent does not qualify.
overlay_rows = copy.deepcopy(received); perimeter(overlay_rows, [40, 26, 45, 33], 13)
overlay_args = [observation(selected_three, 2, 150), observation(overlay_rows, 2, 151), command(DEMAND_THREE), selected_three, overlay_rows, receive_proposal]
overlay = case('new_receipt_perimeter_retains_hidden_parent_unknown', 'record', overlay_args, ACQUIRED)
assert len(overlay['afterState']['bound']['receipt_overlays']) == 1
overlay_state = overlay['afterState']
case('receipt_overlay_revalidates_parent_without_inventing_hidden_pixels', 'options',
     [observation(overlay_rows, 2, 152), overlay_rows, NEXT['inputs'], 1], overlay_state)
case('receipt_overlay_does_not_survive_new_scope', 'options',
     [observation(overlay_rows, 3, 153), overlay_rows, NEXT['inputs'], 1], overlay_state)
for name, x, y, value in [('changed_receipt_glyph_refuses_overlay', 42, 29, 12),
                          ('changed_child_perimeter_refuses_overlay', 43, 26, 9),
                          ('changed_uncovered_parent_perimeter_refuses_overlay', 60, 24, 12)]:
    rows = copy.deepcopy(overlay_rows); rows[y][x] = value
    case(name, 'options', [observation(rows, 2, 154), rows, NEXT['inputs'], 1], overlay_state)
selected_two = selection(BASE, SOURCE_TWO)
second_receive_offer = next(o for o in original_options(selected_two) if o['facts']['offer_kind'] == 'receive_selected')
second_receive_proposal = {'symbol_transaction_plan': {'interface_offer': copy.deepcopy(second_receive_offer['interface_offer'])}}
internal_rows = selection(selected_two, SOURCE_TWO, False); square(internal_rows, DEMAND_TWO, 2)
perimeter(internal_rows, [52, 36, 58, 42], 13)
internal = case('internal_child_perimeter_is_not_parent_occlusion_evidence', 'record',
                [observation(selected_two, 2, 155), observation(internal_rows, 2, 156),
                 command(DEMAND_TWO), selected_two, internal_rows, second_receive_proposal], ACQUIRED)
assert internal['value']['kinds'] == ['receive'] and not internal['afterState']['bound']['receipt_overlays']

# Exact source bounds: 24 samples, 32 contrasts/refutations, 8 methods/overlays.
bounded = Interface(CONFIG, holds)
for _ in range(36): bounded.record(*copy.deepcopy([*selected_args[:5], {}]))
bounded_case = case('samples_24_and_contrasts_32_keep_latest', 'record', [*selected_args[:5], {}], bounded.state())
assert len(bounded_case['afterState']['samples']) == 24 and len(bounded_case['afterState']['contrasts']) == 32
refuted = Interface(CONFIG, holds); refuted.restore(copy.deepcopy(ACQUIRED))
for _ in range(35): refuted.record(*copy.deepcopy(no_effect_args))
refuted_case = case('refutations_32_keep_latest', 'record', no_effect_args, refuted.state())
assert len(refuted_case['afterState']['refutations']) == 32
received_many = Interface(CONFIG, holds); received_many.restore(copy.deepcopy(ACQUIRED))
for _ in range(9): received_many.record(*copy.deepcopy(overlay_args))
overlay_cap = case('receipt_overlays_8_keep_latest_without_deduplication', 'record', overlay_args, received_many.state())
assert len(overlay_cap['afterState']['bound']['receipt_overlays']) == 8

method_learner = Interface(CONFIG, holds)
for epoch in range(10, 20):
    for i, acquired_step in enumerate(ACQUISITION):
        args = copy.deepcopy(acquired_step['arguments'])
        args[0] = observation(args[3], epoch, epoch*100+i)
        args[1] = observation(args[4], epoch+1 if i == len(ACQUISITION)-1 else epoch, epoch*100+i+1)
        if acquired_step['id'] == 'transform_displayed_pair': args[2]['data']['x'] += epoch-10
        if epoch == 19 and i == len(ACQUISITION)-1:
            cap_seed, cap_args = method_learner.state(), copy.deepcopy(args)
        result = method_learner.record(*args)
    assert result['status'] == 'boundary_method_built'
cap = case('methods_8_keep_latest_distinct_acquired_methods', 'record', cap_args, cap_seed)
assert len(cap['afterState']['methods']) == 8

# Methods with all effects still refuse incoherent signatures or activation.
case('explicit_build_candidate_does_not_install_it', 'build_method', [['boundary:a', 'boundary:b']], PRE_BOUNDARY)
for kind in CONFIG['interface_required_effects']:
    seed = copy.deepcopy(PRE_BOUNDARY); seed['contrasts'] = [e for e in seed['contrasts'] if e['kind'] != kind]
    case('missing_' + kind + '_contrast_cannot_build_method', 'build_method', [['boundary']], seed)
for name in ('actions', 'empty_value', 'pair_signature', 'transform_pair_count', 'activation_offset', 'source_signature'):
    seed = copy.deepcopy(PRE_BOUNDARY)
    if name == 'actions': seed['contrasts'][0]['action_ref'] = 'ACTION7'
    elif name == 'empty_value': next(e for e in seed['contrasts'] if e['kind'] == 'load')['glyph_before'][0]['value'] = 12
    elif name == 'pair_signature': next(e for e in seed['contrasts'] if e['kind'] == 'load')['pair'][0]['width'] += 2
    elif name == 'transform_pair_count':
        event = next(e for e in seed['contrasts'] if e['kind'] == 'transform'); event['transform_pairs'].append(copy.deepcopy(event['transform_pairs'][0]))
    elif name == 'activation_offset':
        event = copy.deepcopy(next(e for e in seed['contrasts'] if e['kind'] == 'transform')); event['point'][0] += 1; seed['contrasts'].append(event)
    else:
        seed['samples'][0]['scene']['containers'].append({'value': 6, 'box': [1, 24, 23, 45]})
    contradiction = case('controlled_incoherent_' + name + '_refuses_method', 'build_method', [['boundary']], seed)
    assert contradiction['value'] is None, name

for name, action in [('missing_xy', {'action_ref': 'ACTION6'}),
                     ('extra_xy_key', {'action_ref': 'ACTION6', 'data': {'x': 4, 'y': 29, 'extra': 1}}),
                     ('null_data_raises_after_remembering', {'action_ref': 'ACTION6', 'data': None})]:
    case(name, 'record', [observation(BASE, 2, 160), observation(BASE, 2, 161), action, BASE, BASE, {}], ACQUIRED)
case('boundary_does_not_inspect_after_raster_or_command_data', 'record',
     [observation(BASE, 1, 162), observation(BASE, 2, 163), {'action_ref': 'ACTION6'}, BASE, [], {}], PRE_BOUNDARY)
case('boundary_without_all_contrasts_is_incomplete', 'record',
     [observation(BASE, 2, 164), observation(BASE, 3, 165), command(ACTIVATE), BASE, BASE, {}], ACQUIRED)
duplicate_seed = copy.deepcopy(PRE_BOUNDARY); duplicate_seed['methods'] = copy.deepcopy(ACQUIRED['methods'])
duplicate = case('boundary_equal_method_keeps_original_evidence_without_refresh', 'record',
                 [observation(BASE, 1, 166), observation(BASE, 2, 167), command(ACTIVATE), BASE, BASE, {}], duplicate_seed)
assert duplicate['afterState']['methods'] == ACQUIRED['methods']
duplicate_config = copy.deepcopy(CONFIG)
duplicate_config['interface_learning_rules'].insert(1, copy.deepcopy(duplicate_config['interface_learning_rules'][0]))
case('all_matching_learning_rules_keep_declared_order_and_duplicates', 'record',
     [*selected_args[:5], {}], ACQUIRED, duplicate_config)
pure('diagram_area_bound_refuses_partial_scene', 'scene', [[[9]*65 for _ in range(64)], CONFIG])
sequence('restore_partial_fields_and_current_scope', [
    ('restore', [ACQUIRED]), ('restore', [{'bound': selected_state['bound'], 'ignored_extra_field': True}]),
    ('state', []), ('scope', [3]), ('state', []),
])
case('restore_does_not_clamp_source_state_prematurely', 'restore',
     [{'samples': [{'scene': scene(BASE, CONFIG), 'ref': str(i)} for i in range(25)]}], ACQUIRED)

sys.setprofile(None)
verify_sources()
SOURCE_FILES = [
    'agents/yf_arc3_v6/morphology_policy/symbol_transactions/interface.py',
    'agents/yf_arc3_v6/morphology_policy/symbol_transactions/geometry.py',
    'agents/yf_arc3_v6/morphology_policy/symbol_transactions/family.py',
    'agents/yf_arc3_v6/morphology_policy/symbol_transactions/transactions.drm',
    'agents/yf_arc3_v6/morphology_policy/guarded_binding/geometry.py',
    'agents/yf_arc3_v5/capabilities/symbolic_diagrams.py',
    'agents/yf_arc3_v5/capabilities/concentric_frames.py',
]
fixture = {'schema': 'logos-engine.v6-symbol-interface-reference.v1', 'referenceCommit': COMMIT,
    'sourceModified': False, 'sourceFilesVerifiedBeforeAndAfter': len(MANIFEST),
    'sourceHashes': {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() for name in SOURCE_FILES},
    'qualification': 'Original unchanged Python on synthetic raster returns and an explicit synthetic official epoch boundary. '
                     'The method is learned from record calls; controlled state perturbations are named. No game dispatch or game completion proof.',
    'config': plain(CONFIG), 'acquisitionSteps': ACQUISITION, 'preBoundaryState': PRE_BOUNDARY,
    'acquiredState': ACQUIRED, 'next': plain(NEXT), 'pureCases': PURE_CASES, 'cases': CASES, 'sequences': SEQUENCES,
    'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': count}
        for (path, line, name), count in sorted(EXECUTED.items())]}
output = ROOT / 'tests/fixtures/v6-symbol-interface-reference.json.gz'
output.write_bytes(gzip.compress(json.dumps(fixture, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
print(json.dumps({'output': str(output), 'bytes': output.stat().st_size, 'acquisitionSteps': len(ACQUISITION),
                  'pureCases': len(PURE_CASES), 'cases': len(CASES), 'sequences': len(SEQUENCES),
                  'learnedMethod': METHOD['id'], 'sourceFilesVerifiedBeforeAndAfter': len(MANIFEST)}))
