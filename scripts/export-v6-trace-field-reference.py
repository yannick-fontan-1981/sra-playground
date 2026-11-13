#!/usr/bin/env python3
"""Export unchanged trace-field contracts from public evidence and finite graphs.

No game is run by this exporter. Its full original family replay proves the
acquisition envelope, not the original common caller's choice of a question.
"""
from __future__ import annotations

import copy
import gzip
from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace

sys.dont_write_bytecode = True
spec = spec_from_file_location('trace_probe', Path(__file__).with_name('probe-v6-trace-field-original.py'))
helper = module_from_spec(spec)
spec.loader.exec_module(helper)
from common_trace_field import TraceFieldConstraint
from common_observed_compositions import ObservedCompositionConstraint
from trace_field_access import TraceFieldAccess, command, local_effect
from labeled_sequence_access import LabeledSequenceAccess
from trace_field_observation import measure as trace_measure, center, ring_matches
from trace_field_methods import construct
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from geometric_observer import components
from terminal_composition import identity
from agents.yf_arc3_v5.capabilities.single_visit_residual_d import SingleVisitResidualRequestD, measure_single_visit_residual_d
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import d_input_digest

ROOT = helper.ROOT
PROBE_PATH = 'tests/fixtures/v6-trace-field-original-public.json.gz'
PROBE = json.loads(gzip.decompress((ROOT / PROBE_PATH).read_bytes()))
POLICY = PROBE['policy']
SCENES, CASES, PLANS, ENVELOPES = {}, [], {}, []


def own_state(memory): return helper.plain(copy.deepcopy({key: getattr(memory, key) for key in ('trace_state', 'trace_events')}))
def memory_from(events=()):
    memory = TraceFieldAccess()
    for event in events: memory.apply_event(copy.deepcopy(event))
    return memory
def add(name, operation, arguments, expected):
    CASES.append({'id': name, 'operation': operation, 'arguments': helper.plain(copy.deepcopy(arguments)), 'expected': helper.plain(copy.deepcopy(expected))})
def rows(name): return SCENES[name]['rows']
def obs(name): return SCENES[name]['observation']


def add_scene(name, raster, epoch=1, score=0, available=None):
    public = {'frame_rows': copy.deepcopy(raster), 'frame_packet': [copy.deepcopy(raster)], 'level': epoch, 'levels_completed': score,
              'state': 'NOT_FINISHED', 'step_index': 0, 'available_action_refs': ['ACTION6'] if available is None else available,
              'frame_hash': helper.hashed(json.dumps(raster, separators=(',', ':')).encode())[:16]}
    observed, _ = measure(SimpleNamespace(**public), len(SCENES) + 1, 'trace-field-contract')
    SCENES[name] = {'rows': raster, 'public': public, 'observation': helper.plain(observed)}


def proposal_case(name, view, events=(), remaining=16, config=None, deadline=True, common=True, max_prefix=None):
    memory = memory_from(events); before = own_state(memory)
    family = TraceFieldConstraint(); family.memory = memory
    family.level_deadline = time.perf_counter() + 600 if deadline else None
    domain = ObservedInputDomain(4096); inputs = domain.candidates(obs(view))
    arguments = {'scene': view, 'ownEvents': events, 'remaining': remaining, 'policy': config if config is not None else POLICY,
                 'deadlinePresent': deadline, 'maxPrefix': remaining if max_prefix is None else max_prefix}
    try:
        value = family.trace_propose(obs(view), rows(view), inputs, remaining, arguments['policy']) if common else memory.propose(
            [], obs(view), rows(view), inputs, arguments['maxPrefix'], {**arguments['policy'], 'level_deadline': family.level_deadline, 'remaining_level_actions': remaining})
    except (AssertionError, ValueError, TypeError) as error:
        add(name, 'common_propose' if common else 'propose', arguments, {'rejected': True, 'sourceError': type(error).__name__}); return None
    assert own_state(memory) == before
    add(name, 'common_propose' if common else 'propose', arguments, value)
    if value and 'trace_field_plan' in value:
        PLANS[name] = copy.deepcopy(value)
        if common:
            bound = copy.deepcopy(value); family.bind(bound, domain)
            add(name + ':bind', 'bind', {'scene': view, 'proposal': name, 'observed': True}, bound)
            empty_bound = copy.deepcopy(value); family.bind(empty_bound, ObservedInputDomain(4096))
            add(name + ':bind_empty_domain', 'bind', {'scene': view, 'proposal': name, 'observed': False}, empty_bound)
    return value


def before_case(name, proposal, view, index=0, changes=None, patch=None):
    observed = obs(view)
    meta = {'epoch': observed['level_epoch'], 'score': observed['levels_completed'], 'observation_ref': observed['observation_ref'], 'available': observed['available_action_refs']}
    meta.update(changes or {})
    p = copy.deepcopy(PLANS[proposal]); p.update(patch or {})
    value = TraceFieldAccess().before(p, index, rows(view), **meta)
    add(name, 'before', {'proposal': proposal, 'scene': view, 'index': index, 'meta': meta, 'patch': patch or {}}, value)


def after_case(name, proposal, first, second, index=0, changes=None):
    observed = obs(second); meta = {'epoch': observed['level_epoch'], 'score': observed['levels_completed'], 'state': observed['state']}
    meta.update(changes or {})
    value = TraceFieldAccess().after(copy.deepcopy(PLANS[proposal]), index, rows(first), rows(second), **meta)
    add(name, 'after', {'proposal': proposal, 'before': first, 'after': second, 'index': index, 'meta': meta}, value)


def record_case(name, proposal, first, second, events=(), index=0, supplied_command=None, passive=False):
    memory = memory_from(events); p = copy.deepcopy(PLANS[proposal])
    supplied_command = copy.deepcopy(supplied_command if supplied_command is not None else p['actions'][index])
    if passive: p.pop('trace_field_plan')
    arguments = [obs(first), supplied_command, obs(second), rows(first), rows(second), p, index]
    unchanged = copy.deepcopy(arguments); parent_calls = []
    def trace(frame, event, value):
        if frame.f_code is LabeledSequenceAccess.record.__code__ and event == 'call': parent_calls.append(True)
    sys.setprofile(trace)
    try: acquired = memory.record(*arguments)
    except (AssertionError, ValueError, TypeError) as error:
        add(name, 'record', {'proposal': proposal, 'before': first, 'after': second, 'index': index, 'ownEvents': events,
            'command': supplied_command, 'passive': passive}, {'rejected': True, 'sourceError': type(error).__name__})
        return events
    finally: sys.setprofile(None)
    assert arguments == unchanged and len(parent_calls) == 1
    assert own_state(memory_from(memory.trace_events)) == own_state(memory)
    add(name, 'record', {'proposal': proposal, 'before': first, 'after': second, 'index': index, 'ownEvents': events,
        'command': supplied_command, 'passive': passive},
        {'events': [event for event in acquired if event['kind'] == 'observed_trace_extension'],
         'inheritedEvents': [event for event in acquired if event['kind'] != 'observed_trace_extension'],
         'state': helper.state(memory), 'sourceParentRecordCalls': len(parent_calls), 'inputsUnchanged': True})
    return copy.deepcopy(memory.trace_events)


def public_cases():
    for i, item in enumerate(PROBE['packets']):
        SCENES[f'public:{i}'] = {'rows': copy.deepcopy(item['packet']['frame_rows']), 'public': copy.deepcopy(item['packet']), 'observation': copy.deepcopy(item['observation'])}
    boundary = 0
    for i, prefix in enumerate(PROBE['prefixes']):
        first = prefix['steps'][0]['actionIndex'] - 1; name = f'public:prefix:{i}'
        events = copy.deepcopy(prefix['beforeState']['projection']['trace_events']); remaining = PROBE['budget']['levelActions'] - (first - boundary)
        value = proposal_case(name, f'public:{first}', events, remaining)
        assert value
        bound = copy.deepcopy(value); domain = ObservedInputDomain(4096); domain.candidates(obs(f'public:{first}'))
        TraceFieldConstraint().bind(bound, domain)
        assert bound == prefix['proposal'], name
        for record in prefix['steps']:
            second = record['actionIndex']; index = record['index']; a, b = f'public:{second-1}', f'public:{second}'
            before_case(f'{name}:before:{index}', name, a, index)
            after_case(f'{name}:after:{index}', name, a, b, index)
            events = record_case(f'{name}:record:{index}', name, a, b, events, index)
            if obs(b)['levels_completed'] > obs(a)['levels_completed']: boundary = second
    # Full source-family acquisition over the recorded public returns. The
    # original global SRC caller is deliberately not invoked or claimed here.
    family = ObservedCompositionConstraint(); domain = ObservedInputDomain(4096); boundary = 0
    for i, prefix in enumerate(PROBE['prefixes']):
        first = prefix['steps'][0]['actionIndex'] - 1; view = f'public:{first}'; remaining = PROBE['budget']['levelActions'] - (first - boundary)
        family.level_deadline = time.perf_counter() + 600
        proposal = family.trace_propose(obs(view), rows(view), domain.candidates(obs(view)), remaining, POLICY)
        assert proposal
        unbound = copy.deepcopy(proposal); family.bind(proposal, domain)
        assert proposal == prefix['proposal']
        entry = {'id': f'public:combined-prefix:{i}', 'beforeIndex': first, 'remaining': remaining,
                 'proposal': helper.plain(unbound), 'boundProposal': helper.plain(proposal), 'beforeState': helper.plain(family.state()), 'steps': []}
        for record in prefix['steps']:
            second = record['actionIndex']; index = record['index']; a, b = f'public:{second-1}', f'public:{second}'
            guard = family.before(proposal, index, SimpleNamespace(**SCENES[a]['public']), obs(a))
            outcome = family.after(proposal, index, obs(a), obs(b), rows(a), rows(b))
            acquired = family.record(obs(a), obs(b), proposal['actions'][index], rows(a), rows(b), proposal, index, frames=SCENES[b]['public']['frame_packet'])
            entry['steps'].append({'actionIndex': second, 'index': index, 'beforeGuard': helper.plain(guard), 'outcome': helper.plain(outcome),
                                   'record': helper.plain(acquired), 'state': helper.plain(family.state()), 'traceState': helper.state(family.memory)})
            if obs(b)['levels_completed'] > obs(a)['levels_completed']: boundary = second
        ENVELOPES.append(entry)
    final_events = PROBE['finalState']['projection']['trace_events']; final_view = f"public:{PROBE['actions']}"
    proposal_case('public:final_component_abstention', final_view, final_events, remaining=120)
    proposal_case('public:final_own_abstention', final_view, final_events, remaining=120, common=False)


def controlled_cases():
    initial = copy.deepcopy(rows('public:0')); scene = trace_measure(initial); g = scene['geometry']
    add_scene('controlled:blank', [[0] * 64 for _ in range(64)])
    add_scene('controlled:palette_bijection', [[(5 * value + 37) % 256 for value in row] for row in initial])
    add_scene('controlled:horizontal_reflection', [list(reversed(row)) for row in initial])
    add_scene('controlled:vertical_reflection', list(reversed(initial)))
    add_scene('controlled:transposition', [list(row) for row in zip(*initial)])
    background = initial[0][0]
    add_scene('controlled:translated_canvas', [[background] * 72 for _ in range(5)] + [[background] * 3 + row + [background] * 5 for row in initial] + [[background] * 72 for _ in range(3)])
    add_scene('controlled:double_scale', [[value for value in row for _ in range(2)] for row in initial for _ in range(2)])
    add_scene('controlled:no_action', initial, available=[])
    changed = copy.deepcopy(initial); x, y = center(g, scene['head']['cell']); changed[y][x] = g['floor_value']
    add_scene('controlled:head_center_erased', changed)
    changed = copy.deepcopy(initial); l, t, r, b = g['bbox']; changed[t][l] = background
    add_scene('controlled:broken_outer_frame', changed)
    changed = copy.deepcopy(rows('public:1')); changed[0][0] = (changed[0][0] + 1) % 256
    add_scene('controlled:outside_support_change', changed)
    changed = copy.deepcopy(rows('public:1')); changed[b - 1][l + 1] = (changed[b - 1][l + 1] + 1) % 256
    add_scene('controlled:remote_inside_support_change', changed)
    changed = copy.deepcopy(rows('public:1')); p = PLANS['public:prefix:0']; source = center(g, p['steps'][0]['source']); target = center(g, p['steps'][0]['target'])
    midpoint = [(a + b) // 2 for a, b in zip(source, target)]
    changed[midpoint[1]][midpoint[0]] = initial[midpoint[1]][midpoint[0]]
    add_scene('controlled:missing_connecting_trace', changed)
    # Both public local motion and a remote counterexample are checked; source
    # locality deliberately says nothing about pixels outside this support.
    for name in list(SCENES):
        measured = trace_measure(rows(name))
        add('measure:' + name, 'measure', {'scene': name, 'retainedGeometry': None}, measured)
    for name in ('public:1', 'public:2', 'controlled:broken_outer_frame', 'controlled:missing_connecting_trace'):
        add('measure:retained:' + name, 'measure', {'scene': name, 'retainedGeometry': g}, trace_measure(rows(name), g))
    for name in ('controlled:palette_bijection', 'controlled:horizontal_reflection', 'controlled:vertical_reflection',
                 'controlled:transposition', 'controlled:translated_canvas', 'controlled:double_scale', 'controlled:no_action',
                 'controlled:blank', 'controlled:head_center_erased', 'controlled:broken_outer_frame'):
        proposal_case('proposal:' + name, name, remaining=120)
    proposal_case('proposal:no_remaining', 'public:0', remaining=0)
    proposal_case('proposal:insufficient_remaining', 'public:0', remaining=7)
    proposal_case('proposal:missing_deadline', 'public:0', deadline=False)
    proposal_case('proposal:missing_configuration', 'public:0', config={})
    proposal_case('proposal:initial_own', 'public:0', remaining=120, common=False, max_prefix=16)
    proposal_case('proposal:zero_prefix', 'public:0', remaining=120, common=False, max_prefix=0)
    first = 'public:prefix:0'
    for label, change in [('epoch_changed', {'epoch': 2}), ('score_changed', {'score': 1}),
                          ('observation_changed', {'observation_ref': 'different'}), ('action_unavailable', {'available': []})]:
        before_case('before:' + label, first, 'public:0', changes=change)
    before_case('before:rows_changed', first, 'controlled:palette_bijection')
    before_case('before:negative_index', first, 'public:0', index=-1)
    before_case('before:outside_index', first, 'public:0', index=1)
    altered = copy.deepcopy(PLANS[first]['actions']); altered[0]['data']['x'] += 1
    before_case('before:action_payload_changed', first, 'public:0', patch={'actions': altered})
    altered_bundle = copy.deepcopy(PLANS[first]['bundle_template']); altered_bundle['actions'] = altered
    before_case('before:bundle_payload_changed', first, 'public:0', patch={'bundle_template': altered_bundle})
    for second in ('public:0', 'controlled:outside_support_change', 'controlled:remote_inside_support_change', 'controlled:missing_connecting_trace'):
        after_case('after:' + second, first, 'public:0', second)
        record_case('record:' + second, first, 'public:0', second)
    after_case('after:official_score', first, 'public:0', 'public:1', changes={'score': 1})
    after_case('after:official_epoch', first, 'public:0', 'public:1', changes={'epoch': 2})
    after_case('after:official_state_alone', first, 'public:0', 'public:1', changes={'state': 'WIN'})
    record_case('record:passive', first, 'public:0', 'public:1', passive=True)
    record_case('record:command_mismatch', first, 'public:0', 'public:1', supplied_command={'action_ref': 'ACTION6', 'data': {'x': 0, 'y': 0}})
    failed = record_case('record:stationary_refutation', first, 'public:0', 'public:0')
    proposal_case('proposal:exact_refuted_context', 'public:0', failed, remaining=120)
    # Distinct relation observations qualify batching; duplicate observations do
    # not become two distinct relations merely by being retained twice.
    successes = PROBE['prefixes'][2]['beforeState']['projection']['trace_events']
    proposal_case('proposal:learned_two_distinct_relations', 'public:2', successes, remaining=120)
    repeated = copy.deepcopy(successes[-1]); repeated['state']['successes'] = [copy.deepcopy(successes[0]['state']['successes'][0])] * 2
    proposal_case('proposal:duplicate_relation_not_learned', 'public:2', [repeated], remaining=120)
    proposal_case('proposal:old_epoch_cannot_lend_relation', 'public:8', successes, remaining=120)
    for cell in ([0, 0], [1, 0], [2, 2]):
        add('center:' + str(cell), 'center', {'geometry': g, 'cell': cell}, center(g, cell))
        add('command:' + str(cell), 'command', {'geometry': g, 'cell': cell}, command(g, cell))
        add('ring:' + str(cell), 'ring', {'scene': 'public:0', 'geometry': g, 'mark': scene['head'], 'cell': cell}, ring_matches(initial, g, scene['head'], cell))
    for second in ('public:0', 'public:1', 'controlled:outside_support_change', 'controlled:remote_inside_support_change', 'controlled:missing_connecting_trace'):
        a = {'measured': scene, 'source': p['steps'][0]['source'], 'target': p['steps'][0]['target'], 'before': 'public:0', 'after': second}
        add('effect:' + second, 'effect', a, local_effect(scene, a['source'], a['target'], initial, rows(second)))


def graph_request(nodes=('a', 'b', 'c', 'd'), pairs=(('a', 'b'), ('b', 'c'), ('c', 'd')), head='a', endpoint='d', visited=('a',)):
    return {'scope': {'request_ref': 'request:trace-residual', 'caller_ref': 'caller:reference', 'parent_consumer_ref': 'SRC_composition',
        'parent_goal_ref': 'G_official_completion', 'parent_contribution_ref': 'experimental_simple_cover', 'caller_next_item_ref': 'observation:current',
        'epoch': 1, 'evidence_revision_ref': 'observation:current', 'model_revision_ref': 'geometry:current', 'model_status_ref': 'conditional_visible_separator_graph',
        'event_owner_ref': 'SRC', 'input_domain_complete': True, 'assumption_refs': ['simple_cover_is_experiment_not_terminal_law']},
        'operation_ref': 'mechanics.coverage_partition.single_visit_residual', 'mode_ref': 'PROPAGATE', 'requested_result_type': 'DMechanicalResult',
        'node_bound': 100000, 'depth_bound': 4096, 'domain_bound': 4096, 'time_bound_ms': 300000, 'phase_ref': 'RESIDUAL_GRAPH',
        'graph_revision_ref': 'geometry:current', 'node_refs': list(nodes), 'edges': [{'edge_ref': 'e:' + str(i), 'first_ref': a, 'second_ref': b} for i, (a, b) in enumerate(pairs)],
        'head_ref': head, 'endpoint_ref': endpoint, 'visited_node_refs': list(visited), 'remaining_node_refs': [n for n in nodes if n not in visited],
        'ordered_prefix': list(visited), 'append_only_projection_certified': False, 'simple_path_law_supported': True,
        'endpoint_last_visit_law_supported': True, 'licensed_bipartite_parity': True}


def d_case(name, supplied):
    try:
        request = SingleVisitResidualRequestD(**supplied)
        value = helper.plain(measure_single_visit_residual_d(request).model_dump())
    except (AssertionError, ValueError, TypeError) as error:
        add('residual:' + name, 'residual', {'request': supplied}, {'rejected': True, 'sourceError': type(error).__name__}); return None
    add('residual:' + name, 'residual', {'request': helper.plain(request.model_dump())}, value)
    return value


def mechanics_cases():
    base = graph_request()
    d_case('line_propagation', base)
    d_case('line_evaluation', {**base, 'mode_ref': 'EVALUATE'})
    square = graph_request(pairs=(('a', 'b'), ('b', 'c'), ('c', 'd'), ('d', 'a')), endpoint='b')
    d_case('square_endpoint_edge_forbidden', square)
    d_case('even_graph_same_partition_contradiction', {**square, 'endpoint_ref': 'c'})
    d_case('parity_not_licensed', {**square, 'endpoint_ref': 'c', 'licensed_bipartite_parity': False, 'mode_ref': 'EVALUATE'})
    d_case('non_bipartite_triangle', graph_request(('a', 'b', 'c'), (('a', 'b'), ('b', 'c'), ('a', 'c')), endpoint='c'))
    d_case('disconnected', graph_request(pairs=(('a', 'b'), ('c', 'd'))))
    d_case('articulation_exceeds_path_degree', graph_request(('a', 'b', 'c', 'd', 'e'), (('b', 'a'), ('b', 'c'), ('b', 'd'), ('b', 'e')), endpoint='e'))
    d_case('empty_suffix', graph_request(('a',), (), endpoint='a'))
    d_case('endpoint_already_visited', graph_request(head='b', endpoint='a', visited=('a', 'b')))
    d_case('endpoint_head_with_remainder', {**base, 'endpoint_ref': 'a'})
    d_case('endpoint_reentry_unqualified', {**base, 'endpoint_ref': 'a', 'endpoint_last_visit_law_supported': False})
    d_case('forced_outside_residual', {**graph_request(head='b', visited=('a', 'b')), 'forced_edge_refs': ['e:0']})
    d_case('forced_and_forbidden', {**base, 'forced_edge_refs': ['e:0'], 'forbidden_edge_refs': ['e:0']})
    d_case('forced_closed_subtour', {**graph_request(('h', 'z', 'a', 'b', 'c'), (('a', 'b'), ('b', 'c'), ('c', 'a'), ('h', 'a'), ('z', 'b'), ('h', 'z')), head='h', endpoint='z', visited=('h',)), 'forced_edge_refs': ['e:0', 'e:1', 'e:2']})
    d_case('saturated_head_endpoint_chain', {**graph_request(('a', 'b', 'c', 'd', 'e'), (('a', 'b'), ('b', 'c'), ('b', 'd'), ('d', 'e'), ('e', 'b')), endpoint='c'), 'forced_edge_refs': ['e:0', 'e:1']})
    for label, changes in [
        ('unknown_operation', {'operation_ref': 'mechanics.unknown'}), ('unknown_mode', {'mode_ref': 'OTHER'}), ('null_mode', {'mode_ref': None}),
        ('wrong_result_type', {'requested_result_type': 'OtherResult'}), ('domain_bound', {'domain_bound': 2}),
        ('simple_path_unqualified', {'simple_path_law_supported': False}), ('projection_unqualified', {'ordered_prefix': []}),
        ('certified_projection', {'ordered_prefix': [], 'append_only_projection_certified': True}),
        ('node_bound', {'node_bound': 1}), ('depth_bound', {'depth_bound': 1}),
        ('incomplete_domain', {'scope': {**base['scope'], 'input_domain_complete': False}}),
        ('duplicate_node', {'node_refs': ['a', 'b', 'c', 'd', 'a']}), ('duplicate_visited', {'visited_node_refs': ['a', 'a']}),
        ('head_outside_visited', {'head_ref': 'b'}), ('endpoint_outside_graph', {'endpoint_ref': 'z'}),
        ('incorrect_remaining_complement', {'remaining_node_refs': ['b', 'c']}), ('duplicate_remaining', {'remaining_node_refs': ['b', 'c', 'd', 'd']}),
        ('duplicate_edge_ref', {'edges': [base['edges'][0], {**base['edges'][1], 'edge_ref': 'e:0'}]}),
        ('duplicate_undirected_pair', {'edges': [base['edges'][0], {'edge_ref': 'other', 'first_ref': 'b', 'second_ref': 'a'}]}),
        ('edge_outside_graph', {'edges': [{'edge_ref': 'bad', 'first_ref': 'a', 'second_ref': 'z'}]}),
        ('self_edge', {'edges': [{'edge_ref': 'bad', 'first_ref': 'a', 'second_ref': 'a'}]}),
        ('unknown_forced_edge', {'forced_edge_refs': ['missing']}), ('unknown_forbidden_edge', {'forbidden_edge_refs': ['missing']}),
        ('wrong_prefix_head', {'ordered_prefix': ['b']}), ('wrong_phase', {'phase_ref': 'OTHER'}), ('invalid_node_bound', {'node_bound': 0}),
        ('invalid_depth_bound', {'depth_bound': 4097}), ('invalid_domain_bound', {'domain_bound': 0}), ('invalid_time_bound', {'time_bound_ms': 0}),
        ('unknown_request_field', {'extra': True}), ('unknown_scope_field', {'scope': {**base['scope'], 'extra': True}}),
    ]: d_case(label, {**copy.deepcopy(base), **copy.deepcopy(changes)})
    prefix_absent = graph_request(pairs=(('a', 'c'), ('b', 'c'), ('c', 'd')), head='b', visited=('a', 'b'))
    d_case('prefix_uses_absent_edge', prefix_absent)
    interrupted = d_case('resume_initial_interruption', {**base, 'node_bound': 5})
    frontier = copy.deepcopy(interrupted['frontier'])
    d_case('resume_same_input', {**base, 'resume_frontier': frontier})
    for key, changed in [('request_ref', 'different'), ('input_digest', 'different'), ('graph_revision_ref', 'different'), ('forced_edge_refs', ['unknown'])]:
        d_case('resume_changed_' + key, {**base, 'resume_frontier': {**frontier, key: changed}})
    for label, value in [('invalid_string', 'bad'), ('null', None), ('integer_string', '1'), ('boolean', True), ('finite_float', 1.5)]:
        d_case('resume_round_' + label, {**base, 'resume_frontier': {**frontier, 'completed_rounds': value}})
    forced = {**base, 'forced_edge_refs': ['e:0']}
    bad_frontier = {**frontier, 'input_digest': d_input_digest(SingleVisitResidualRequestD(**forced)), 'forced_edge_refs': []}
    d_case('resume_dropped_forced_constraint', {**forced, 'resume_frontier': bad_frontier})
    for name in ('public:0', 'public:1', 'public:2', 'public:8', 'public:23', 'public:38', 'controlled:palette_bijection', 'controlled:horizontal_reflection', 'controlled:translated_canvas'):
        measured = trace_measure(rows(name))
        value = construct(measured, obs(name), 120, time.perf_counter() + 600)
        add('construct:' + name, 'construct', {'measured': measured, 'observation': obs(name), 'remaining': 120, 'expired': False}, value)
    measured = trace_measure(rows('public:0'))
    for label, supplied, remaining, expired in [
        ('remaining_bound', measured, 7, False), ('expired_deadline', measured, 120, True),
        ('no_edges', {**measured, 'allowed_edges_hypothesis': []}, 120, False),
        ('cell_bound', {**measured, 'geometry': {**measured['geometry'], 'shape': [65, 1]}}, 120, False),
        ('complete_experiment', {**measured, 'geometry': {**measured['geometry'], 'shape': [1, 1]}, 'prefix': [[0, 0]], 'receiver_hypothesis': {**measured['receiver_hypothesis'], 'cell': [0, 0]}, 'allowed_edges_hypothesis': []}, 0, False),
    ]:
        value = construct(supplied, obs('public:0'), remaining, time.perf_counter() + (-1 if expired else 600))
        add('construct:' + label, 'construct', {'measured': supplied, 'observation': obs('public:0'), 'remaining': remaining, 'expired': expired}, value)


def final_measurement_diagnostic():
    """Record visible nested envelopes, without choosing a privileged mark."""
    name = f"public:{PROBE['actions']}"; raster = rows(name); frames = []
    for part in components(raster):
        l, t, r, b = part['bbox']; width = r - l + 1
        if width < 3 or width != b - t + 1 or part['area'] != 4 * (width - 1): continue
        if not all(raster[y][x] == part['color'] for y in range(t, b + 1) for x in range(l, r + 1) if y in (t, b) or x in (l, r)): continue
        frames.append({'bbox': part['bbox'], 'width': width, 'palette': part['color'], 'center': [(l + r) // 2, (t + b) // 2], 'center_value': raster[(t + b) // 2][(l + r) // 2]})
    return {'scene': name, 'measurement': trace_measure(raster), 'visibleSquarePerimeters': frames,
            'scope': 'Public connected components only. Nested same-center rings create competing same-width pairs; the pinned measurement requires exactly one pair and returns no scene. No game law, private engine, or future selection rule is supplied.'}


def main():
    destination = ROOT / 'tests/fixtures/v6-trace-field-reference.json.gz'
    if destination.exists(): raise FileExistsError(destination)
    public_cases(); controlled_cases(); mechanics_cases()
    source_hashes = helper.source_hashes()
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    result = {'schema': 'logos-engine.v6.trace-field-reference.v1', 'sourceCommit': helper.COMMIT,
        'sourceHashes': source_hashes, 'pinnedSourceFilesVerifiedBeforeImport': len(helper.VERIFIED_PINNED_SOURCE),
        'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': helper.hashed(Path(__file__).read_bytes()),
        'originalPublicProbe': {'path': PROBE_PATH, 'sha256': helper.hashed((ROOT / PROBE_PATH).read_bytes())},
        'qualification': {'sourceModified': False, 'gameHostRunByExporter': False,
            'component': 'Unchanged original trace component, four observed completions and explicit fifth-level abstention; target six was not reached.',
            'commonEnvelope': 'True ObservedCompositionConstraint methods over recorded public returns; not original full common caller selection.',
            'mechanics': 'Exact source EVALUATE/PROPAGATE residual graph contracts and bounded DFS over explicitly supplied experimental graphs.',
            'nativeDigest': 'Only transferred layers can share a native digest closure; full source family digest is retained separately.'},
        'sourceMro': [cls.__name__ for cls in type(ObservedCompositionConstraint().memory).__mro__],
        'policy': POLICY, 'scenes': SCENES, 'plans': PLANS, 'cases': CASES, 'commonEnvelopes': ENVELOPES,
        'finalMeasurementDiagnostic': final_measurement_diagnostic()}
    destination.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(destination.relative_to(ROOT)), 'cases': len(CASES), 'scenes': len(SCENES), 'commonEnvelopes': len(ENVELOPES),
                      'commonAcquisitions': sum(len(item['steps']) for item in ENVELOPES), 'sourceFiles': len(source_hashes)}), flush=True)


if __name__ == '__main__': main()
