#!/usr/bin/env python3
"""Export contracts from the unchanged pinned field-service Python component.

The game is never run by this exporter. Actual observations come from the
separately retained cold component campaign. Controlled observations exercise
ambiguity, public point binding and refutation; they are not game evidence.
Python profiling observes identity calls without replacing a source function.
"""
from __future__ import annotations
import copy
import gzip
import importlib.util
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('service_probe', Path(__file__).with_name('probe-v6-field-service-original.py'))
helper = importlib.util.module_from_spec(spec); spec.loader.exec_module(helper)
from common_field_service import FieldServiceConstraint
from observed_input_domain import ObservedInputDomain
from terminal_composition import identity
from geometric_observer import components
from envelope_fill_observation import groups, field_state, acquire_fields, state as field_states, directions
from field_service_access import FieldServiceAccess, paired_controls, linked_control
from service_transfer_access import ServiceTransferAccess, crop, shape, same_shape, current_control

ROOT = helper.ROOT
PROBE_PATH = 'tests/fixtures/v6-field-service-original-public.json.gz'
DISCOVERY_PATH = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
PROBE = json.loads(gzip.decompress((ROOT / PROBE_PATH).read_bytes()))
DISCOVERY = json.loads(gzip.decompress((ROOT / DISCOVERY_PATH).read_bytes()))
POLICY = PROBE['policy']
SOURCE_FILES = {'nested_control_access.py', 'envelope_fill_observation.py', 'envelope_fill_access.py',
                'field_service_access.py', 'service_transfer_access.py', 'common_field_service.py'}
RECIPES = {}; PENDING = {}; CASES = []; MEMORY_CASES = []; GUARDS = []

def plain(value): return helper.plain(copy.deepcopy(value))
def proof(path): return {'path': path, 'sha256': helper.hashed((ROOT / path).read_bytes())}
def source_canonical(value): return json.dumps(value, sort_keys=True, separators=(',', ':'))
def finite_canonical(value):
    """Independent JSON spelling; the observed own identity domain is integer-only."""
    if value is None: return 'null'
    if value is True: return 'true'
    if value is False: return 'false'
    if isinstance(value, str): return json.dumps(value, ensure_ascii=True)
    if isinstance(value, int):
        assert abs(value) <= 9007199254740991
        return str(value)
    if isinstance(value, float):
        assert math.isfinite(value)
        raise AssertionError(('Unexpected floating identity operand; qualify before extending this reference', value))
    if isinstance(value, (list, tuple)): return '[' + ','.join(finite_canonical(v) for v in value) + ']'
    if isinstance(value, dict): return '{' + ','.join(json.dumps(k, ensure_ascii=True) + ':' + finite_canonical(v) for k, v in sorted(value.items())) + '}'
    raise TypeError(type(value))

def profile(frame, event, arg):
    if frame.f_code is not identity.__code__: return
    caller = frame.f_back
    if caller is None or Path(caller.f_code.co_filename).name not in SOURCE_FILES: return
    if event == 'call':
        PENDING[id(frame)] = (copy.deepcopy(frame.f_locals['value']), Path(caller.f_code.co_filename).name + ':' + str(caller.f_lineno))
    elif event == 'return':
        value, origin = PENDING.pop(id(frame)); canonical = source_canonical(value)
        assert helper.hashed(canonical.encode()) == arg
        native = finite_canonical(value)
        assert native == canonical, ('Own source numeric identity spelling changed', origin)
        recipe = RECIPES.setdefault(arg, {'sourceHash': arg, 'sourceCanonical': canonical, 'value': plain(value),
                                        'nativeCanonical': native, 'nativeHash': helper.hashed(native.encode()), 'callers': []})
        assert recipe['sourceCanonical'] == canonical
        if origin not in recipe['callers']: recipe['callers'].append(origin)

def own(events): return [plain(e) for e in events if e['kind'] in helper.OWN_KINDS]
def add(name, operation, arguments, expected): CASES.append({'id': name, 'operation': operation, 'arguments': plain(arguments), 'expected': plain(expected)})
def base_events(prefix): return own([e for p in PROBE['prefixes'][:prefix] for s in p['steps'] for e in s['acquired']['events']])
def seeded(prefix, extra=()):
    events = base_events(prefix) + plain(list(extra)); memory = ServiceTransferAccess()
    for event in events: memory.apply_event(copy.deepcopy(event))
    return memory, events

def memory_case(name, operation, prefix, arguments, callback, extra=()):
    memory, events = seeded(prefix, extra); before = helper.state(memory)
    expected = callback(memory)
    MEMORY_CASES.append({'id': name, 'operation': operation, 'seedEvents': events,
                         'arguments': plain(arguments), 'expected': plain(expected),
                         'beforeState': before, 'afterState': helper.state(memory)})
    return expected

def replay():
    family = FieldServiceConstraint(); domain = ObservedInputDomain(4096)
    envelopes = []; packet_measurements = []; accepted = []; cursor = boundary = 0
    for prefix_index, original in enumerate(PROBE['prefixes']):
        first = PROBE['packets'][cursor]; before = helper.state(family.memory)
        assert before == original['beforeState'], ('before', prefix_index)
        inputs = domain.candidates(first['observation'])
        p = family.service_propose(first['observation'], first['packet']['frame_rows'], inputs,
                                   PROBE['budget']['levelActions'] - (cursor - boundary), POLICY)
        assert plain(p) == original['unboundProposal'], ('proposal', prefix_index)
        assert helper.state(family.memory) == original['afterPlanningState']
        unbound = plain(p); family.bind(p, domain); assert plain(p) == original['proposal']
        envelope = {'prefixIndex': prefix_index, 'actionIndex': cursor + 1, 'beforeState': before,
                    'afterPlanningState': helper.state(family.memory), 'unboundProposal': unbound, 'proposal': plain(p), 'steps': []}
        for index, command in enumerate(p['actions']):
            step = original['steps'][index]; a = PROBE['packets'][cursor]; b = PROBE['packets'][cursor + 1]
            assert plain(command) == b['command']
            guard = family.before(p, index, helper.SimpleNamespace(**a['packet']), a['observation'])
            outcome = family.after(p, index, a['observation'], b['observation'], a['packet']['frame_rows'], b['packet']['frame_rows'])
            assert plain(guard) == step['beforeGuard']; assert plain(outcome) == step['outcome']
            acquired = family.record(a['observation'], b['observation'], command, a['packet']['frame_rows'], b['packet']['frame_rows'], p, index, frames=b['packet']['frame_packet'])
            assert plain(acquired) == step['acquired'], ('acquisition', cursor + 1)
            after = helper.state(family.memory); assert after == step['afterState'], ('after', cursor + 1)
            envelope['steps'].append({'actionIndex': cursor + 1, 'index': index, 'beforeGuard': plain(guard),
                                      'outcome': plain(outcome), 'ownEvents': own(acquired['events']), 'afterState': after})
            accepted.extend((e, plain(e)) for e in acquired['events'] if e['kind'] in helper.OWN_KINDS)
            cursor += 1
            if b['observation']['levels_completed'] > a['observation']['levels_completed']: boundary = cursor
        envelopes.append(envelope)
    aliases = [{'ownEventIndex': i, 'emission': value, 'final': plain(event)} for i, (event, value) in enumerate(accepted) if plain(event) != value]
    for index, item in enumerate(PROBE['packets']):
        rows = item['packet']['frame_rows']; observation = item['observation']
        result = {'actionIndex': index, 'pairedControls': paired_controls(rows),
                  'nestedQuestion': family.memory.nested_question(observation, rows, POLICY['nested_control_question'])}
        if index:
            previous = PROBE['packets'][index - 1]
            refs = [previous['observation']['observation_ref'], observation['observation_ref']]
            result.update(changes=groups(previous['packet']['frame_rows'], rows),
                          acquiredFields=acquire_fields(previous['packet']['frame_rows'], rows, refs))
        packet_measurements.append(plain(result))
    assert cursor == PROBE['actions'] and helper.state(family.memory) == PROBE['finalState']
    return envelopes, packet_measurements, aliases

def paint(rows, box, value):
    l, t, r, b = box
    for y in range(t, b + 1):
        for x in range(l, r + 1): rows[y][x] = value

def observation_cases():
    blank = [[0] * 16 for _ in range(16)]
    rect = copy.deepcopy(blank); paint(rect, [2, 2, 3, 3], 7)
    tiny = copy.deepcopy(blank); paint(tiny, [2, 2, 4, 2], 7)
    elbow = copy.deepcopy(rect); elbow[3][3] = 0; elbow[4][2] = 7
    pairs = copy.deepcopy(rect); paint(pairs, [4, 2, 5, 3], 8)
    ordered = copy.deepcopy(blank); paint(ordered, [2, 10, 3, 11], 7); paint(ordered, [10, 2, 11, 3], 7)
    for name, later in [('none', blank), ('rectangle_minimum_area', rect), ('below_minimum_area', tiny),
                        ('nonrectangular_omitted', elbow), ('adjacent_distinct_palette_pairs', pairs), ('x_before_y_order', ordered)]:
        add('groups:' + name, 'groups', {'before': blank, 'after': later}, groups(blank, later))
    first = copy.deepcopy(blank); paint(first, [2, 2, 6, 5], 3); paint(first, [10, 2, 14, 5], 3)
    single = copy.deepcopy(first); paint(single, [2, 2, 3, 5], 11)
    repeated = copy.deepcopy(single); paint(repeated, [10, 2, 11, 5], 11)
    internal = copy.deepcopy(first); paint(internal, [3, 2, 4, 5], 11)
    complete = copy.deepcopy(first); paint(complete, [2, 2, 6, 5], 11)
    for name, later in [('no_change', first), ('single_old_content', single), ('repeated_new_content', repeated),
                        ('interior_band_unbound', internal), ('complete_replacement_no_extent_axis', complete)]:
        args = {'before': first, 'after': later, 'refs': ['controlled:field:before', 'controlled:field:after']}
        add('acquire_fields:' + name, 'acquire_fields', args, acquire_fields(**args))
    field = {'id': 'controlled-field', 'bbox': [1, 1, 5, 3], 'axis': 0, 'side': 1, 'fill_palette': 7,
             'alternative_fill_palette': 3, 'initial_other_palettes': [4]}
    raster = copy.deepcopy(blank); paint(raster, field['bbox'], 3)
    for y, length in enumerate([2, 4, 3], 1): paint(raster, [1, y, length, y], 7)
    known = copy.deepcopy(raster); known[1][5] = 4
    opaque = copy.deepcopy(raster); opaque[1][5] = 9
    for axis in [0, 1]:
        for side in [0, 1]:
            f = {**field, 'axis': axis, 'side': side}
            add(f'field_state:axis_{axis}_side_{side}', 'field_state', {'rows': raster, 'field': f}, field_state(raster, f))
    for name, rows in [('known_initial_palette', known), ('unknown_replacement', opaque)]:
        add('field_state:' + name, 'field_state', {'rows': rows, 'field': field}, field_state(rows, field))
    add('field_states:stable_ids', 'field_states', {'rows': raster, 'fields': [field]}, field_states(raster, [field]))
    for name, aa, bb in [('equal', [1, 2], [1, 2]), ('increase', [1, 2], [1, 3]), ('decrease', [1, 2], [0, 2]),
                         ('mixed', [1, 2], [2, 1]), ('old_opaque', None, [1, 2]), ('new_opaque', [1, 2], None),
                         ('empty_profiles', [], []), ('source_zip_scope', [1, 2, 3], [2, 2])]:
        a = {'field': {'pixel_extent_profiles': aa}}; b = {'field': {'pixel_extent_profiles': bb}}
        add('directions:' + name, 'directions', {'old': a, 'new': b}, directions(a, b))
    def motif(horizontal=False, mismatched=False, gap=1):
        r = copy.deepcopy(blank)
        a = [(0, 0), (0, 1), (1, 1)]
        if horizontal: a = [(0, 0), (1, 0), (1, 1)]
        for x, y in a:
            r[3 + y][3 + x] = 7
            xx, yy = (1 - x + 2 + gap, y) if horizontal else (x, 1 - y + 2 + gap)
            r[3 + yy][3 + xx] = 8 if mismatched else 7
        return r
    for name, rows in [('none', blank), ('vertical_reflection', motif()), ('horizontal_reflection', motif(True)),
                       ('different_palette', motif(mismatched=True)), ('wrong_gap', motif(gap=2))]:
        add('paired_controls:' + name, 'paired_controls', {'rows': rows}, paired_controls(rows))
    box = {'bbox': [5, 5, 9, 9]}
    def control(point): return {'point': point, 'bbox': [point[0] - 1, point[1] - 1, point[0] + 1, point[1] + 1], 'orientation': 'vertical', 'evidence_components': []}
    for name, controls in [('empty', []), ('unique_nearest', [control([7, 2]), control([7, 4])]),
                           ('equal_distance_ambiguous', [control([7, 2]), control([7, 12])]),
                           ('off_axis_ignored', [control([8, 4])]), ('inside_ignored', [control([7, 7])])]:
        add('linked_control:' + name, 'linked_control', {'field': box, 'controls': controls}, linked_control(box, controls))
    for prefix in [4, 10, 15, 16, 20, 21]:
        plan = PROBE['prefixes'][prefix]['proposal']['nested_control_plan']; prior = plan['selected']
        for suffix, index in [('before', prefix), ('after', prefix + 1)]:
            rows = PROBE['packets'][index]['packet']['frame_rows']
            add(f'current_control:public_{prefix}_{suffix}', 'current_control', {'rows': rows, 'prior': prior}, current_control(rows, prior))
    prior = paired_controls(motif())[0]
    for name, target, rows in [('current_crop', prior, motif()), ('out_of_bounds', {**prior, 'point': [0, 0]}, motif()), ('missing_current_control', prior, blank)]:
        add('current_control:' + name, 'current_control', {'rows': rows, 'prior': target}, current_control(rows, target))
    component = components(first)[1]; template = shape(component)
    add('shape:observed_component', 'shape', {'component': component}, template)
    for name, t in [('same', template), ('area_changed', {**template, 'area': template['area'] + 1}),
                    ('background_changed', {**template, 'background': template['background'] + 1}),
                    ('extent_changed', {**template, 'extent': [template['extent'][0] + 1, template['extent'][1]]})]:
        add('same_shape:' + name, 'same_shape', {'component': component, 'template': t}, same_shape(component, t))
    add('crop:inclusive_public_bbox', 'crop', {'rows': first, 'box': [2, 2, 6, 5]}, crop(first, [2, 2, 6, 5]))

def decision_cases():
    obs = {'level_epoch': 7, 'levels_completed': 6, 'state': 'NOT_FINISHED', 'observation_ref': 'controlled:field',
           'frame_hash': 'controlled-frame', 'available_action_refs': ['ACTION6']}
    def framed(count=1, second_size=5):
        rows = [[7] * 40 for _ in range(40)]
        for x, y, size in [(3, 3, 5), (23, 3, second_size)][:count]:
            paint(rows, [x, y, x + size - 1, y + size - 1], 5)
            paint(rows, [x + 1, y + 1, x + size - 2, y + size - 2], 0)
        return rows
    for name, rows, cfg in [('one_unique', framed(), POLICY['nested_control_question']),
                            ('equal_minimum_ambiguity', framed(2), POLICY['nested_control_question']),
                            ('larger_alternative', framed(2, 7), POLICY['nested_control_question']),
                            ('unknown_selection_order', framed(), {**POLICY['nested_control_question'], 'selection_order': 'unknown'}),
                            ('minimum_core_not_met', framed(), {**POLICY['nested_control_question'], 'minimum_core_area': 10}),
                            ('maximum_extent_not_met', framed(), {**POLICY['nested_control_question'], 'maximum_extent_fraction': 0.1}),
                            ('uniform', [[7] * 40 for _ in range(40)], POLICY['nested_control_question'])]:
        args = {'obs': obs, 'rows': rows, 'cfg': cfg}
        memory_case('nested_question:' + name, 'nested_question', 0, args, lambda m, a=args: m.nested_question(**a))
    packet = PROBE['packets'][1]; ctx = PROBE['prefixes'][1]['beforeState']['projection']['fill_context']; target = ctx['forward']
    for name, chosen, rows in [('current', target, packet['packet']['frame_rows']),
                              ('moved_point', {**target, 'point': [target['point'][0] + 1, target['point'][1]]}, packet['packet']['frame_rows']),
                              ('out_of_bounds', {**target, 'bbox': [-1, 0, 3, 4], 'point': [1, 2]}, packet['packet']['frame_rows']),
                              ('missing_control', target, [[5] * 64 for _ in range(64)])]:
        args = {'obs': packet['observation'], 'rows': rows, 'target': chosen, 'cfg': POLICY['envelope_fill_question'], 'phase': 'repeat'}
        memory_case('fill_question:' + name, 'fill_question', 1, args, lambda m, a=args: m.fill_question(**a))
    # A second currently measured alternative must cause ambiguity rather than a coordinate preference.
    packet = PROBE['packets'][2]; rows = copy.deepcopy(packet['packet']['frame_rows'])
    alternative = PROBE['prefixes'][2]['proposal']['nested_control_plan']['selected']; patch = crop(rows, alternative['bbox'])
    paint(rows, [19, 2, 25, 8], 15)
    for y, row in enumerate(patch):
        for x, value in enumerate(row): rows[3 + y][20 + x] = value
    args = {'obs': packet['observation'], 'rows': rows, 'inputs': [], 'max_prefix': 1, 'config': POLICY}
    answer = memory_case('propose:alternative_control_ambiguous', 'propose', 2, args, lambda m: m.propose([], **args))
    assert answer == {'status': 'abstained', 'reason': 'alternative_control_ambiguous'}
    restored = PROBE['prefixes'][4]['beforeState']['projection']['fill_context']
    for name in ['actual_restoration', 'not_restored', 'no_novel_field', 'two_novel_fields', 'no_correlated_field', 'two_correlated_fields', 'missing_control']:
        context = copy.deepcopy(restored); rows = PROBE['packets'][4]['packet']['frame_rows']
        novel = next(f for f in context['fields'] if any(s[f['id']]['opaque_replacement'] for s in context['history']))
        others = [f for f in context['fields'] if f['id'] != novel['id']]
        if name == 'not_restored': context['restored_measured_fields'] = False
        if name == 'no_novel_field':
            for s in context['history']:
                for field in context['fields']: s[field['id']]['opaque_replacement'] = False
        if name == 'two_novel_fields': context['history'][0][others[0]['id']]['opaque_replacement'] = True
        if name == 'no_correlated_field':
            for field in others: context['directions'][field['id']] = -context['directions'][novel['id']]
        if name == 'two_correlated_fields':
            for field in others: context['directions'][field['id']] = context['directions'][novel['id']]
        if name == 'missing_control': rows = [[5] * 64 for _ in range(64)]
        event = {'kind': 'envelope_fill_context', 'context': context, 'stop_reason': None, 'evidence': ['controlled:service-initialization']}
        args = {'rows': rows}
        result = memory_case('initialize_service:' + name, 'initialize_service', 4, args, lambda m, r=rows: m.initialize_service(r), [event])
        assert (result is not None) == (name == 'actual_restoration')
    for prefix, name in [(10, 'known_relay'), (20, 'unknown_intermediate')]:
        packet = PROBE['packets'][prefix]; args = {'obs': packet['observation'], 'rows': packet['packet']['frame_rows'], 'config': POLICY}
        memory_case('bind_transfer:' + name, 'bind_transfer', prefix, args, lambda m, a=args: m.bind_transfer(**a))
    packet = PROBE['packets'][10]; model = PROBE['prefixes'][10]['beforeState']['projection']['transfer_model']
    for name in ['missing_boundary_witness', 'missing_receiver', 'multiple_relay_shapes', 'no_receiver_shapes']:
        changed = copy.deepcopy(model); rows = packet['packet']['frame_rows']; extra = []
        if name == 'missing_boundary_witness': changed.pop('official_boundary_witness')
        if name == 'missing_receiver': changed['receiver'] = None
        if name == 'multiple_relay_shapes':
            rows = [[5] * 64 for _ in range(64)]
            for box in [[2, 2, 8, 8], [20, 2, 26, 8], [40, 2, 48, 10]]: paint(rows, box, 3)
        if name == 'no_receiver_shapes': rows = [[5] * 64 for _ in range(64)]
        extra.append({'kind': 'field_service_transfer', 'model': changed, 'context': None, 'stop_reason': None, 'evidence': ['controlled:transfer']})
        args = {'obs': packet['observation'], 'rows': rows, 'config': POLICY}
        result = memory_case('bind_transfer:' + name, 'bind_transfer', 10, args, lambda m, a=args: m.bind_transfer(**a), extra)
        assert result is None
    # Current controls are necessary even after the relation was acquired in an earlier epoch.
    for prefix, name in [(11, 'missing_relay_control'), (11, 'missing_destination_control'), (17, 'all_receiver_appearances_changed')]:
        packet = PROBE['packets'][prefix]; rows = copy.deepcopy(packet['packet']['frame_rows'])
        ctx = PROBE['prefixes'][prefix]['proposal']['field_transfer_plan']['transfer_context']
        if name == 'missing_relay_control': paint(rows, ctx['relay_gate_scope']['bbox'], 15)
        elif name == 'missing_destination_control': paint(rows, ctx['targets'][0]['gate_scope']['bbox'], 15)
        else:
            for target in ctx['targets']: paint(rows, target['bbox'], 9)
        args = {'obs': packet['observation'], 'rows': rows, 'inputs': [], 'max_prefix': 1, 'config': POLICY}
        memory_case('propose:' + name, 'propose', prefix, args, lambda m, a=args: m.propose([], **a))
    for name, remaining, available in [('zero_budget', 0, ['ACTION6']), ('missing_point_action', 1, [])]:
        packet = PROBE['packets'][4]; changed = {**packet['observation'], 'available_action_refs': available}
        args = {'obs': changed, 'rows': packet['packet']['frame_rows'], 'inputs': [], 'max_prefix': remaining, 'config': POLICY}
        memory_case('propose:' + name, 'propose', 4, args, lambda m, a=args: m.propose([], **a))

def record_case(name, prefix, later, after=None):
    original = PROBE['prefixes'][prefix]; packet = PROBE['packets'][prefix]; next_packet = PROBE['packets'][prefix + 1]
    before = packet['observation']; after = after or {**next_packet['observation'], 'level_epoch': before['level_epoch'], 'levels_completed': before['levels_completed'], 'observation_ref': 'controlled:record:' + name}
    args = {'before': before, 'command': original['proposal']['actions'][0], 'after': after,
            'rows': packet['packet']['frame_rows'], 'later': later, 'proposal': original['proposal'], 'index': 0}
    return memory_case('record:' + name, 'record', prefix, args, lambda m: own(m.record(**args)))

def record_cases():
    first = PROBE['packets'][0]['packet']['frame_rows']
    no_effect = record_case('nested_no_visible_effect', 0, first)
    refusal = next(e for e in no_effect if e['kind'] == 'nested_control_response')
    assert refusal['disposition'] == 'local_no_visible_effect' and not refusal['selection_acquired'] and not refusal['impossibility_acquired']
    for name, score, epoch, rows in [('current', 0, 1, first), ('different_score', 1, 1, first), ('different_epoch', 0, 2, first),
                                    ('different_frame', 0, 1, [[5] * 64 for _ in range(64)])]:
        observation = {**PROBE['packets'][0]['observation'], 'level_epoch': epoch, 'levels_completed': score}
        args = {'obs': observation, 'rows': rows}
        memory_case('nested_refusal:' + name, 'nested_refusal', 0, args, lambda m, a=args: m.nested_refusal(**a), [refusal])
    remote = copy.deepcopy(first); remote[0][0] = 15
    record_case('nested_distant_effect_uncomposed', 0, remote)
    for name in ['isolate_no_effect', 'isolate_orientation_unchanged', 'isolate_nonlocal_preserved_fields', 'isolate_changed_field']:
        later = copy.deepcopy(PROBE['packets'][4 if name in ('isolate_no_effect', 'isolate_orientation_unchanged') else 5]['packet']['frame_rows'])
        if name in ('isolate_orientation_unchanged', 'isolate_nonlocal_preserved_fields'): later[0][0] = 15
        if name == 'isolate_changed_field':
            field = PROBE['prefixes'][4]['proposal']['field_service_plan']['service_context']['other_field']; l, t, _, _ = field['bbox']; later[t][l] = 15
        record_case(name, 4, later)
    record_case('serve_no_effect', 5, PROBE['packets'][5]['packet']['frame_rows'])
    later = copy.deepcopy(PROBE['packets'][6]['packet']['frame_rows'])
    field = PROBE['prefixes'][5]['proposal']['field_service_plan']['service_context']['other_field']; l, t, _, _ = field['bbox']; later[t][l] = 15
    record_case('serve_isolation_refuted', 5, later)
    later = copy.deepcopy(PROBE['packets'][6]['packet']['frame_rows'])
    for field in PROBE['prefixes'][6]['beforeState']['projection']['fill_context']['fields']:
        l, t, r, b = field['bbox']
        for y in range(t, b + 1): later[y][l:r + 1] = first[y][l:r + 1]
    record_case('serve_all_fields_restored', 6, later)
    for prefix, name in [(10, 'transfer_control_no_effect'), (11, 'transfer_service_no_effect')]:
        record_case(name, prefix, PROBE['packets'][prefix]['packet']['frame_rows'])
    later = copy.deepcopy(PROBE['packets'][10]['packet']['frame_rows']); later[0][0] = 15
    record_case('transfer_control_response_refuted', 10, later)

def guard_cases():
    for prefix in [0, 1, 2, 4, 5, 10, 20, 22]:
        p = PROBE['prefixes'][prefix]['proposal']; a = PROBE['packets'][prefix]; b = PROBE['packets'][prefix + 1]
        meta = {'epoch': a['observation']['level_epoch'], 'score': a['observation']['levels_completed'],
                'observation_ref': a['observation']['observation_ref'], 'available': a['observation']['available_action_refs']}
        for name in ['current', 'wrong_index', 'changed_epoch', 'changed_score', 'stale_observation', 'unavailable_action', 'changed_payload', 'changed_frame']:
            proposal = copy.deepcopy(p); rows = a['packet']['frame_rows']; index = 0; changed = copy.deepcopy(meta)
            if name == 'wrong_index': index = 1
            if name == 'changed_epoch': changed['epoch'] += 1
            if name == 'changed_score': changed['score'] += 1
            if name == 'stale_observation': changed['observation_ref'] = 'controlled:stale'
            if name == 'unavailable_action': changed['available'] = []
            if name == 'changed_payload': proposal['actions'][0]['data']['x'] += 1
            if name == 'changed_frame': rows = copy.deepcopy(rows); rows[0][0] = 15 if rows[0][0] != 15 else 14
            args = {'proposal': proposal, 'index': index, 'rows': rows, 'meta': changed}
            expected = ServiceTransferAccess().before(proposal, index, rows, **changed)
            GUARDS.append({'id': f'before:{prefix}:{name}', 'operation': 'before', 'arguments': plain(args), 'expected': expected})
        for name, later, epoch, score, status in [('actual', b['packet']['frame_rows'], b['observation']['level_epoch'], b['observation']['levels_completed'], b['observation']['state']),
                                                ('unchanged', a['packet']['frame_rows'], meta['epoch'], meta['score'], 'NOT_FINISHED'),
                                                ('epoch_without_score', b['packet']['frame_rows'], meta['epoch'] + 1, meta['score'], 'NOT_FINISHED'),
                                                ('score_progress', b['packet']['frame_rows'], meta['epoch'], meta['score'] + 1, 'NOT_FINISHED'),
                                                ('win_without_score', b['packet']['frame_rows'], meta['epoch'], meta['score'], 'WIN')]:
            args = {'proposal': p, 'index': 0, 'rows': a['packet']['frame_rows'], 'later': later, 'meta': {'epoch': epoch, 'score': score, 'state': status}}
            expected = ServiceTransferAccess().after(p, 0, args['rows'], later, **args['meta'])
            GUARDS.append({'id': f'after:{prefix}:{name}', 'operation': 'after', 'arguments': plain(args), 'expected': expected})

def main():
    assert PROBE['status'] == 'passed' and PROBE['actions'] == 28 and PROBE['levelsCompleted'] == 3
    assert helper.hashed((ROOT / PROBE['generator']).read_bytes()) == PROBE['generatorSha256']
    sys.setprofile(profile)
    try:
        envelopes, packets, aliases = replay()
        observation_cases(); decision_cases(); record_cases(); guard_cases()
        memory = ServiceTransferAccess()
        initials = [{'game': item['game'], 'arguments': {'rows': item['packet']['frame_rows'], 'obs': item['observation']},
                     'pairedControls': plain(paired_controls(item['packet']['frame_rows'])),
                     'nestedQuestion': plain(memory.nested_question(item['observation'], item['packet']['frame_rows'], POLICY['nested_control_question']))}
                    for item in DISCOVERY['games']]
    finally: sys.setprofile(None)
    assert not PENDING
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    output = {'schema': 'logos-engine.v6.field-service-reference.v1', 'sourceCommit': helper.COMMIT,
              'qualification': {'sourceModified': False, 'gameHostRunByExporter': False,
                  'commonEnvelope': 'Actual unchanged FieldServiceConstraint and its common bind, guards and acquisition over retained public returns. Component coordinator only; not full original caller or Kernel authorization.',
                  'coldStart': 'The isolated original component proposes on the initial public frame and completes three continuous VALV levels without resets, manual priming, exploration fallback or level jumps.',
                  'numerics': 'Every traced identity operand in these six own source modules is an exactly representable safe integer, string, boolean, null or collection thereof. Python and independent native canonical bytes and hashes are equal on this checked domain. No general Python float identity equivalence is asserted.',
                  'digestScope': 'The actual RadialPortsAccess ancestor digest is supplied separately for each checkpoint. Four own retained digest layers are compared; the full source/native ancestor hierarchy is outside this claim.',
                  'identityTracing': 'Python profiling observes actual identity arguments and returns in the six unchanged own modules; it replaces no source function or binding.',
                  'controlledCases': 'Synthetic ambiguity, current point, no-effect, field refutation and transfer cases are isolated source contracts, never game priming or campaign evidence.',
                  'quantities': 'Pixel extents, appearance and observed conditional response only. Physical units, capacities, global inverse, release and terminal laws remain unknown.'},
              'pinnedSourceFilesVerifiedBeforeImport': len(helper.VERIFIED_PINNED_SOURCE),
              'pinnedSourceFilesVerifiedAfterRun': len(helper.VERIFIED_PINNED_SOURCE), 'sourceHashes': helper.source_hashes(),
              'sourceMro': [cls.__name__ for cls in ServiceTransferAccess.__mro__],
              'originalPublicProbe': proof(PROBE_PATH), 'initialDiscovery': proof(DISCOVERY_PATH), 'policy': POLICY,
              'identityRecipes': list(RECIPES.values()), 'cases': CASES, 'controlledCases': MEMORY_CASES, 'guards': GUARDS,
              'initialMeasurements': initials, 'packetMeasurements': packets, 'commonEnvelopes': envelopes,
              'sourceAliasing': aliases, 'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': helper.hashed(Path(__file__).read_bytes())}
    destination = ROOT / 'tests/fixtures/v6-field-service-reference.json.gz'
    if destination.exists(): raise FileExistsError(destination)
    destination.write_bytes(gzip.compress(json.dumps(output, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(destination.relative_to(ROOT)), 'cases': len(CASES), 'controlledCases': len(MEMORY_CASES),
                      'guards': len(GUARDS), 'initials': len(initials), 'packets': len(packets), 'envelopes': len(envelopes),
                      'ownEvents': sum(len(s['ownEvents']) for e in envelopes for s in e['steps']),
                      'identityRecipes': len(RECIPES), 'aliases': len(aliases),
                      'initialNestedApplicability': [i['game'] for i in initials if i['nestedQuestion']]}), flush=True)

if __name__ == '__main__': main()
