#!/usr/bin/env python3
"""Export unchanged labeled-sequence source contracts from public evidence.

This exporter never runs a game. A separate opaque-host probe supplies actual
packets; synthetic cases exercise observable geometry and mechanical contracts.
Own-layer state and the complete original acquisition envelope remain distinct.
"""
from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
LAYA = SOURCE / 'agents/yf_arc3_v6/laya_proto'
sys.path[:0] = [str(SOURCE), str(LAYA)]

from labeled_sequence_observation import measure as labeled_measure, sequences
from labeled_sequence_access import LabeledSequenceAccess
from labeled_sequence_methods import scope, features, infer
from common_labeled_sequence import LabeledSequenceConstraint
from product_panel_access import ProductPanelAccess
from common_observed_compositions import ObservedCompositionConstraint
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from rooted_quota_methods import plain
from agents.yf_arc3_v5.capabilities.ordered_predicate_features_d import OrderedPredicateFeaturesRequestD, measure_ordered_predicate_features_d
from agents.yf_arc3_v5.capabilities.labeled_predicate_induction_d import LabeledPredicateInductionRequestD, measure_labeled_predicate_induction_d

PROBE_PATH = 'tests/fixtures/v6-labeled-sequence-original-public.json.gz'
PROBE = json.loads(gzip.decompress((ROOT / PROBE_PATH).read_bytes()))
POLICY = PROBE['policy']
SCENES, CASES, PLANS, ENVELOPES, MIXED_INPUTS = {}, [], {}, [], []
OWN_FIELDS = ('labeled_cache', 'labeled_events')


def sha(raw): return hashlib.sha256(raw).hexdigest()


def source_hashes():
    manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    paths = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module, '__file__', None)}
    paths.add(SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm')
    result = {}
    for path in paths:
        if path.is_relative_to(SOURCE) and path.is_file():
            relative = str(path.relative_to(SOURCE)); result[relative] = sha(path.read_bytes())
            assert manifest[relative]['sha256'] == result[relative], relative
    return dict(sorted(result.items()))


def own_state(memory): return plain({key: copy.deepcopy(getattr(memory, key)) for key in OWN_FIELDS})
def state(memory):
    return {'projection': own_state(memory), 'parentDigest': ProductPanelAccess.retained_digest(memory),
            'digest': LabeledSequenceAccess.retained_digest(memory)}
def memory_from(events=()):
    memory = LabeledSequenceAccess()
    for event in events: memory.apply_event(copy.deepcopy(event))
    return memory
def add(name, operation, arguments, expected):
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(copy.deepcopy(arguments)), 'expected': plain(copy.deepcopy(expected))})
def rows(name): return SCENES[name]['rows']
def observation(name): return SCENES[name]['observation']


def add_scene(name, raster, epoch=1, score=0, available=None):
    public = {'frame_rows': copy.deepcopy(raster), 'frame_packet': [copy.deepcopy(raster)], 'level': epoch, 'levels_completed': score,
              'state': 'NOT_FINISHED', 'step_index': 0, 'available_action_refs': ['ACTION6'] if available is None else available,
              'frame_hash': sha(json.dumps(raster, separators=(',', ':')).encode())[:16]}
    obs, _ = measure(SimpleNamespace(**public), len(SCENES) + 1, 'labeled-sequence-contract')
    SCENES[name] = {'rows': raster, 'public': public, 'observation': plain(obs)}


def proposal_case(name, view, events=(), remaining=16, config=None, deadline=True, common=True):
    memory = memory_from(events); before = own_state(memory)
    family = LabeledSequenceConstraint(); family.memory = memory
    family.level_deadline = time.perf_counter() + 600 if deadline else None
    domain = ObservedInputDomain(4096); inputs = domain.candidates(observation(view))
    arguments = {'scene': view, 'ownEvents': events, 'remaining': remaining, 'policy': config if config is not None else POLICY,
                 'deadlinePresent': deadline}
    try:
        value = family.labeled_propose(observation(view), rows(view), inputs, remaining, arguments['policy']) if common else memory.propose(
            [], observation(view), rows(view), inputs, remaining, {**arguments['policy'], 'level_deadline': family.level_deadline, 'remaining_level_actions': remaining})
    except (AssertionError, ValueError, TypeError) as error:
        add(name, 'common_propose' if common else 'propose', arguments, {'rejected': True, 'sourceError': type(error).__name__}); return None
    assert own_state(memory) == before
    add(name, 'common_propose' if common else 'propose', arguments, value)
    if value and 'labeled_sequence_plan' in value:
        PLANS[name] = copy.deepcopy(value)
        if common:
            bound = copy.deepcopy(value); family.bind(bound, domain)
            add(name + ':bind', 'bind', {'scene': view, 'proposal': name, 'observed': True}, bound)
            empty_bound = copy.deepcopy(value); family.bind(empty_bound, ObservedInputDomain(4096))
            add(name + ':bind_empty_domain', 'bind', {'scene': view, 'proposal': name, 'observed': False}, empty_bound)
    return value


def before_case(name, proposal, view, index=0, changes=None, patch=None):
    obs = observation(view)
    meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'observation_ref': obs['observation_ref'], 'available': obs['available_action_refs']}
    meta.update(changes or {})
    p = copy.deepcopy(PLANS[proposal]); p.update(patch or {})
    value = LabeledSequenceAccess().before(p, index, rows(view), **meta)
    add(name, 'before', {'proposal': proposal, 'scene': view, 'index': index, 'meta': meta, 'patch': patch or {}}, value)


def after_case(name, proposal, first, second, index=0, changes=None):
    obs = observation(second); meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'state': obs['state']}
    meta.update(changes or {})
    value = LabeledSequenceAccess().after(copy.deepcopy(PLANS[proposal]), index, rows(first), rows(second), **meta)
    add(name, 'after', {'proposal': proposal, 'before': first, 'after': second, 'index': index, 'meta': meta}, value)


def record_case(name, proposal, first, second, events=(), index=0, command=None, passive=False):
    memory = memory_from(events); p = copy.deepcopy(PLANS[proposal]); command = copy.deepcopy(command or p['actions'][index])
    if passive: p.pop('labeled_sequence_plan')
    arguments = [observation(first), command, observation(second), rows(first), rows(second), p, index]
    unchanged = copy.deepcopy(arguments); parent_calls = []
    def trace(frame, event, value):
        if frame.f_code is ProductPanelAccess.record.__code__ and event == 'call': parent_calls.append(True)
    sys.setprofile(trace)
    try: acquired = memory.record(*arguments)
    finally: sys.setprofile(None)
    assert arguments == unchanged and len(parent_calls) == 1
    assert own_state(memory_from(memory.labeled_events)) == own_state(memory)
    add(name, 'record', {'proposal': proposal, 'before': first, 'after': second, 'index': index, 'ownEvents': events, 'command': command, 'passive': passive},
        {'events': [event for event in acquired if event['kind'] == 'labeled_sequence_submission'],
         'inheritedEvents': [event for event in acquired if event['kind'] != 'labeled_sequence_submission'],
         'state': state(memory), 'sourceParentRecordCalls': len(parent_calls), 'inputsUnchanged': True})
    return memory.labeled_events


def public_cases():
    for i, item in enumerate(PROBE['packets']):
        SCENES[f'public:{i}'] = {'rows': copy.deepcopy(item['packet']['frame_rows']), 'public': copy.deepcopy(item['packet']), 'observation': copy.deepcopy(item['observation'])}
    boundary = 0
    for i, prefix in enumerate(PROBE['prefixes']):
        first = prefix['steps'][0]['actionIndex'] - 1; name = f'public:prefix:{i}'
        events = copy.deepcopy(prefix['beforeState']['projection']['labeled_events']); remaining = PROBE['budget']['levelActions'] - (first - boundary)
        value = proposal_case(name, f'public:{first}', events, remaining)
        assert value
        bound = copy.deepcopy(value); domain = ObservedInputDomain(4096); domain.candidates(observation(f'public:{first}'))
        LabeledSequenceConstraint().bind(bound, domain)
        assert bound == prefix['proposal'], name
        for record in prefix['steps']:
            second = record['actionIndex']; index = record['index']
            before_case(f'{name}:before:{index}', name, f'public:{second-1}', index)
            after_case(f'{name}:after:{index}', name, f'public:{second-1}', f'public:{second}', index)
            events = record_case(f'{name}:record:{index}', name, f'public:{second-1}', f'public:{second}', events, index)
            if observation(f'public:{second}')['levels_completed'] > observation(f'public:{second-1}')['levels_completed']: boundary = second
    # Replay the saved public returns through the true complete source family.
    # This is family acquisition/proposal parity, never full-caller selection.
    family = ObservedCompositionConstraint(); domain = ObservedInputDomain(4096); boundary = 0
    for i, prefix in enumerate(PROBE['prefixes']):
        first = prefix['steps'][0]['actionIndex'] - 1; view = f'public:{first}'; remaining = PROBE['budget']['levelActions'] - (first - boundary)
        family.level_deadline = time.perf_counter() + 600
        proposal = family.labeled_propose(observation(view), rows(view), domain.candidates(observation(view)), remaining, POLICY)
        assert proposal
        unbound = copy.deepcopy(proposal); family.bind(proposal, domain)
        assert proposal == prefix['proposal']
        entry = {'id': f'public:combined-prefix:{i}', 'beforeIndex': first, 'remaining': remaining,
                 'proposal': plain(unbound), 'boundProposal': plain(proposal), 'beforeState': plain(family.state()), 'steps': []}
        for record in prefix['steps']:
            second = record['actionIndex']; index = record['index']; a, b = f'public:{second-1}', f'public:{second}'
            guard = family.before(proposal, index, SimpleNamespace(**SCENES[a]['public']), observation(a))
            outcome = family.after(proposal, index, observation(a), observation(b), rows(a), rows(b))
            acquired = family.record(observation(a), observation(b), proposal['actions'][index], rows(a), rows(b), proposal, index, frames=SCENES[b]['public']['frame_packet'])
            entry['steps'].append({'actionIndex': second, 'index': index, 'beforeGuard': plain(guard), 'outcome': plain(outcome),
                                   'record': plain(acquired), 'state': plain(family.state()), 'labeledState': state(family.memory)})
            if observation(b)['levels_completed'] > observation(a)['levels_completed']: boundary = second
        ENVELOPES.append(entry)
    events = PROBE['finalState']['projection']['labeled_events']
    proposal_case('public:final_component_abstention', f"public:{PROBE['actions']}", events, remaining=120)
    proposal_case('public:final_own_abstention', f"public:{PROBE['actions']}", events, remaining=16, common=False)


def controlled_cases():
    initial = copy.deepcopy(rows('public:0')); scene = labeled_measure(initial)
    controls = copy.deepcopy(scene['buttons'])
    add_scene('controlled:blank', [[0] * 64 for _ in range(64)])
    add_scene('controlled:recolored', [[(7 * value + 3) % 16 for value in row] for row in initial])
    add_scene('controlled:reflected', [list(reversed(row)) for row in initial])
    add_scene('controlled:shifted', [[0] * 72 for _ in range(5)] + [[0] * 3 + row + [0] * 5 for row in initial] + [[0] * 72 for _ in range(3)])
    add_scene('controlled:double_scale', [[value for value in row for _ in range(2)] for row in initial for _ in range(2)])
    add_scene('controlled:no_action', initial, available=[])
    # A nonrectangular extension merges the current component; the retained
    # original envelope still has a completely uniform current perimeter/body.
    changed = copy.deepcopy(initial); button = controls[0]; l, t, r, b = button['bbox']
    changed[t][l - 1] = changed[t][l - 2] = button['label']
    add_scene('controlled:merged_control', changed)
    assert labeled_measure(changed) is None
    assert labeled_measure(changed, controls) is not None
    changed2 = copy.deepcopy(changed); changed2[t + 1][l + 1] = 0
    add_scene('controlled:merged_control_hole', changed2)
    changed2 = copy.deepcopy(changed); changed2[t][l] = 0
    add_scene('controlled:merged_control_corner', changed2)
    changed = copy.deepcopy(initial)
    for y in range(58, 60):
        for x in range(40, 43): changed[y][x] = button['label']
    add_scene('controlled:duplicate_control', changed)
    changed = copy.deepcopy(initial)
    for y in range(t, b + 1):
        for x in range(l, r + 1): changed[y][x] = 0
    add_scene('controlled:missing_control', changed)
    changed = copy.deepcopy(initial); q = scene['query']; box = q['words'][0]['boxes'][0]
    for y in range(box[1], box[3] + 1):
        for x in range(box[0], box[2] + 1): changed[y][x] = 6
    add_scene('controlled:query_outside_palette', changed)
    changed = copy.deepcopy(initial); box = scene['panels'][0]['words'][2]['boxes'][1]
    token = changed[box[1]][box[0]]
    for y in range(box[1], box[3] + 1):
        for x in range(box[0], box[2] + 1): changed[y][x] = 0
    for y in range(box[1], box[3] + 1):
        for x in range(box[0] + 1, box[2] + 2): changed[y][x] = token
    add_scene('controlled:unequal_panel_pitch', changed)
    changed = copy.deepcopy(initial); box = scene['panels'][0]['bbox']; changed[box[1]][box[0] + 1] = 0
    add_scene('controlled:broken_panel_perimeter', changed)
    # A geometrically valid query with a new visible order is not a cached answer.
    changed = copy.deepcopy(initial); boxes = scene['query']['words'][0]['boxes']
    for box in boxes:
        for y in range(box[1], box[3] + 1):
            for x in range(box[0], box[2] + 1): changed[y][x] = 9
    add_scene('controlled:new_query_same_training', changed)
    for name in list(SCENES):
        add('measure:' + name, 'measure', {'scene': name, 'priorControls': None}, labeled_measure(rows(name)))
    for name in ['controlled:merged_control', 'controlled:merged_control_hole', 'controlled:merged_control_corner',
                 'controlled:duplicate_control', 'controlled:missing_control']:
        add('measure:prior:' + name, 'measure', {'scene': name, 'priorControls': controls}, labeled_measure(rows(name), controls))
    invalid_prior = copy.deepcopy(controls); invalid_prior[0]['bbox'][0] = -1
    add('measure:prior_outside', 'measure', {'scene': 'controlled:merged_control', 'priorControls': invalid_prior}, labeled_measure(rows('controlled:merged_control'), invalid_prior))
    doubled_prior = [*controls, controls[0]]
    add('measure:prior_duplicate', 'measure', {'scene': 'controlled:merged_control', 'priorControls': doubled_prior}, labeled_measure(rows('controlled:merged_control'), doubled_prior))
    for name in [name for name in SCENES if name.startswith('controlled:')]: proposal_case('proposal:' + name, name)
    events = PROBE['prefixes'][1]['beforeState']['projection']['labeled_events']
    proposal_case('proposal:merged_control_prior_revalidated', 'controlled:merged_control', events)
    proposal_case('proposal:merged_control_prior_hole', 'controlled:merged_control_hole', events)
    proposal_case('proposal:duplicate_control_prior_revalidated', 'controlled:duplicate_control', events)
    proposal_case('proposal:zero_remaining', 'public:0', remaining=0)
    proposal_case('proposal:negative_remaining', 'public:0', remaining=-1)
    proposal_case('proposal:no_config', 'public:0', config={})
    proposal_case('proposal:missing_deadline', 'public:0', deadline=False)
    proposal_case('proposal:own_initial', 'public:0', common=False)
    proposal_case('proposal:duplicate_context', 'public:0', events=events, common=False)
    cfg = copy.deepcopy(POLICY); cfg['labeled_sequence_question']['root_bound'] = 1
    proposal_case('proposal:root_bound_abstention', 'public:0', config=cfg, common=False)
    name = 'public:prefix:0'
    for key, value in [('epoch', 2), ('score', 1), ('observation_ref', 'unseen'), ('available', [])]:
        before_case('before:changed_' + key, name, 'public:0', changes={key: value})
    before_case('before:negative_index', name, 'public:0', index=-1)
    before_case('before:index_outside', name, 'public:0', index=1)
    changed_actions = copy.deepcopy(PLANS[name]['actions']); changed_actions[0]['data']['x'] += 1
    before_case('before:payload_changed', name, 'public:0', patch={'actions': changed_actions})
    bundle = copy.deepcopy(PLANS[name]['bundle_template']); bundle['actions'] = changed_actions
    before_case('before:bundle_changed', name, 'public:0', patch={'bundle_template': bundle})
    before_case('before:frame_changed', name, 'controlled:new_query_same_training')
    after_case('after:stationary_still_seals', name, 'public:0', 'public:0')
    after_case('after:official_score', name, 'public:0', 'public:1', changes={'score': 1})
    record_case('record:stationary', name, 'public:0', 'public:0')
    record_case('record:passive_other_proposal', name, 'public:0', 'public:1', passive=True)
    record_case('record:lost_measurement_retains_receipt', name, 'public:0', 'controlled:blank')
    record_case('record:command_is_actual_not_invented', name, 'public:0', 'public:1', command={'action_ref': 'ACTION6', 'data': {'x': 1, 'y': 1}})


def method_cases():
    first = labeled_measure(rows('public:0')); obs = observation('public:0'); cfg = POLICY['labeled_sequence_question']
    for operation in ['features', 'induction']:
        add('scope:' + operation, 'scope', {'observation': obs, 'measured': first, 'operation': operation}, scope(obs, first, operation))
    prior = PROBE['prefixes'][1]['beforeState']['projection']['labeled_cache']
    cases = [('cold', first, obs, cfg, None), ('reused', first, observation('public:1'), cfg, prior),
             ('new_query_reuses_training', labeled_measure(rows('controlled:new_query_same_training')), obs, cfg, prior),
             ('epoch_invalidates', first, {**obs, 'level_epoch': 2}, cfg, prior),
             ('context_invalidates', {**first, 'context_ref': 'different-context'}, obs, cfg, prior),
             ('queries_invalidate', first, obs, {**cfg, 'features': ['LENGTH']}, prior),
             ('comparisons_reuse_features', first, obs, {**cfg, 'comparisons': ['EQ']}, prior),
             ('root_bound', first, obs, {**cfg, 'root_bound': 1}, prior)]
    last = labeled_measure(rows(f"public:{PROBE['actions']}"), prior['controls'])
    if last is not None: cases.append(('last_unresolved_query', last, observation(f"public:{PROBE['actions']}"), cfg, None))
    for name, scene, observation_value, configuration, retained in cases:
        result = infer(copy.deepcopy(scene), copy.deepcopy(observation_value), time.perf_counter() + 600, copy.deepcopy(configuration), copy.deepcopy(retained))
        add('infer:' + name, 'infer', {'measured': scene, 'observation': observation_value, 'cfg': configuration, 'prior': retained}, result)
    query = [{'feature_ref': 'LENGTH', 'kind': 'LENGTH', 'type_ref': None}, {'feature_ref': 'COUNT:8', 'kind': 'TYPE_COUNT', 'type_ref': '8'}]
    words = [['a', [8, 9, 8]], ['b', []]]
    add('features:wrapper', 'features', {'words': words, 'queries': query, 'measured': first, 'observation': obs},
        features(words, query, first, obs, time.perf_counter() + 600))
    # Shape grouping / exclusion / ordered pitch independently of panel pairing.
    frame = [0, 0, 40, 20]
    solids = [{'bbox': [2, 2, 4, 4], 'color': 8}, {'bbox': [7, 2, 9, 4], 'color': 9},
              {'bbox': [2, 7, 4, 9], 'color': 11}, {'bbox': [12, 2, 12, 2], 'color': 15}]
    variants = [('ordered', solids), ('reverse_input', list(reversed(solids))), ('empty', []),
                ('only_single_pixels', [solids[-1]]), ('touching_frame', [{'bbox': [0, 2, 2, 4], 'color': 8}]),
                ('rectangular_anchor_excluded', [*solids, {'bbox': [16, 2, 17, 4], 'color': 15}]),
                ('larger_scale_wins', [*solids, {'bbox': [16, 2, 19, 5], 'color': 7}]),
                ('nonuniform_pitch', [*solids, {'bbox': [13, 2, 15, 4], 'color': 8}]),
                ('touching_tokens', [solids[0], {'bbox': [5, 2, 7, 4], 'color': 9}])]
    for name, values in variants: add('sequences:' + name, 'sequences', {'frame': frame, 'solids': values}, sequences(frame, values))


def mixed_envelope_cases():
    """Adversarial envelopes test the real inherited guard/binder precedence."""
    sources = [('cell', 'v6-cell-placement-reference.json.gz', 'cell_placement_plan'),
               ('graph', 'v6-alternating-graph-access-reference.json.gz', 'graph_access_plan'),
               ('pair', 'v6-coupled-pair-planning-reference.json.gz', 'pair_access_plan'),
               ('support', 'v6-auxiliary-support-reference.json.gz', 'support_preparation_plan'),
               ('product', 'v6-product-panel-reference.json.gz', 'product_panel_plan'),
               ('rooted', 'v6-rooted-quota-reference.json.gz', 'rooted_quota_plan')]
    def find(value, key, path='$'):
        if isinstance(value, dict):
            if key in value and 'actions' in value: return path, value
            for name, child in value.items():
                found = find(child, key, path + '.' + name)
                if found: return found
        elif isinstance(value, list):
            for index, child in enumerate(value):
                found = find(child, key, path + '[' + str(index) + ']')
                if found: return found
        return None
    for name, filename, key in sources:
        path = ROOT / 'tests/fixtures' / filename
        source = json.loads(gzip.decompress(path.read_bytes()))
        found = find(source, key); assert found, filename
        pointer, candidate = found
        MIXED_INPUTS.append({'path': str(path.relative_to(ROOT)), 'sha256': sha(path.read_bytes()), 'selectedProposal': pointer})
        proposal = copy.deepcopy(PLANS['public:prefix:0']); proposal[key] = copy.deepcopy(candidate[key])
        family = ObservedCompositionConstraint()
        for operation in ['before', 'after', 'bind']:
            current = copy.deepcopy(proposal)
            try:
                if operation == 'before':
                    value = family.before(current, 0, SimpleNamespace(**SCENES['public:0']['public']), observation('public:0'))
                elif operation == 'after':
                    value = family.after(current, 0, observation('public:0'), observation('public:1'), rows('public:0'), rows('public:1'))
                else:
                    domain = ObservedInputDomain(4096); domain.candidates(observation('public:0'))
                    family.bind(current, domain); value = current
            except (AssertionError, ValueError, TypeError, KeyError) as error:
                value = {'rejected': True, 'sourceError': type(error).__name__}
            add('mixed:' + name + ':' + operation, 'shared_' + operation,
                {'proposalValue': proposal, 'before': 'public:0', 'after': 'public:1', 'index': 0}, value)


def mechanical_case(name, operation, request):
    typed_class, method = ((OrderedPredicateFeaturesRequestD, measure_ordered_predicate_features_d) if operation == 'ordered' else
                           (LabeledPredicateInductionRequestD, measure_labeled_predicate_induction_d))
    try: typed = typed_class(**copy.deepcopy(request))
    except Exception as error:
        add(name, operation, {'request': request}, {'rejected': True, 'sourceError': type(error).__name__}); return None
    value = plain(method(typed).model_dump())
    add(name, operation, {'request': plain(typed.model_dump())}, value)
    return value


def mechanical_cases():
    current = labeled_measure(rows('public:0')); obs = observation('public:0')
    mechanical_scope = scope(obs, current, 'contract')
    base = {'scope': mechanical_scope, 'requested_result_type': 'DMechanicalResult', 'node_bound': 100000,
            'depth_bound': 128, 'domain_bound': 4096, 'time_bound_ms': 300000}
    kinds = ['LENGTH', 'TYPE_COUNT', 'ENDPOINT_EQUAL', 'ADJACENT_EQUAL_PAIRS', 'ALL_ADJACENT_DIFFERENT',
             'MAXIMAL_RUNS', 'TYPE_RUN_COUNT', 'ONE_CONTIGUOUS_RUN_PER_TYPE']
    queries = [{'feature_ref': kind, 'kind': kind, 'type_ref': 'a' if kind in ['TYPE_COUNT', 'TYPE_RUN_COUNT'] else None} for kind in kinds]
    def model(values, complete=True, visible=None):
        return {'model_ref': 'ordered:a', 'tokens': [{'occurrence_ref': f't:{i}', 'type_ref': value,
                 'visible': True if visible is None else visible[i]} for i, value in enumerate(values)], 'order_and_segmentation_complete': complete}
    ordered = {**base, 'operation_ref': 'mechanics.visual_sequence.ordered_predicate_features', 'mode_ref': 'EVALUATE',
               'phase_ref': 'FINITE_ORDERED_FEATURES', 'models': [model(['a', 'a', 'b', 'a'])], 'queries': queries}
    mechanical_case('ordered:complete', 'ordered', ordered)
    for name, m in [('empty', model([])), ('single', model(['a'])), ('all_same', model(['a', 'a', 'a'])),
                    ('all_different', model(['a', 'b', 'c'])), ('same_histogram_other_order', model(['a', 'a', 'a', 'b'])),
                    ('unsegmented', model(['a', 'a', 'b'], False)), ('unread_middle', model(['a', 'a', 'b'], visible=[True, False, True])),
                    ('null_middle', model(['a', None, 'b'])), ('known_counterexample_with_unknown', model(['a', 'a', None])),
                    ('unknown_end', model([None, 'a', 'a'])), ('unicode_types', model(['\ue000', '\U00010000', '\ue000']))]:
        mechanical_case('ordered:' + name, 'ordered', {**copy.deepcopy(ordered), 'models': [m]})
    for kind in kinds:
        mechanical_case('ordered:single_feature:' + kind, 'ordered', {**copy.deepcopy(ordered), 'queries': [q for q in queries if q['kind'] == kind]})
    unknown_pairs = {**copy.deepcopy(ordered), 'models': [model(['a', None, 'b'])], 'queries': [q for q in queries if q['kind'] == 'ADJACENT_EQUAL_PAIRS']}
    mechanical_case('ordered:pair_rows_with_unknown_remain_descriptive_complete', 'ordered', unknown_pairs)
    variants = [('node_1', {'node_bound': 1}), ('node_after_tokens', {'node_bound': 4}), ('domain_1', {'domain_bound': 1}),
                ('resume_requires_restart', {'resume_frontier': {'restart_ordered_features': True}}),
                ('duplicate_model', {'models': [ordered['models'][0], ordered['models'][0]]}),
                ('wrong_operation', {'operation_ref': 'other'}), ('wrong_mode', {'mode_ref': 'FIT'}),
                ('wrong_result', {'requested_result_type': 'Other'}), ('incomplete_domain', {'scope': {**mechanical_scope, 'input_domain_complete': False}}),
                ('missing_models', {'models': []}), ('missing_queries', {'queries': []}), ('invalid_bound', {'node_bound': 0}),
                ('duplicate_query', {'queries': [queries[0], queries[0]]}), ('unbound_type', {'queries': [{**queries[1], 'type_ref': None}]}),
                ('duplicate_token', {'models': [model(['a']) | {'tokens': [model(['a'])['tokens'][0]] * 2}]})]
    for name, patch in variants: mechanical_case('ordered:' + name, 'ordered', {**copy.deepcopy(ordered), **copy.deepcopy(patch)})
    atom = {'node_ref': 'length:2', 'kind': 'ATOM', 'feature_ref': 'LENGTH', 'comparator': 'GE', 'value': 2, 'child_refs': []}
    inverse = {'node_ref': 'not:length:2', 'kind': 'NOT', 'feature_ref': None, 'comparator': None, 'value': None, 'child_refs': ['length:2']}
    examples = [{'example_ref': 'positive', 'receipt_ref': 'actual:positive', 'label_ref': 'yes', 'sealed': True, 'epoch': 1},
                {'example_ref': 'negative', 'receipt_ref': 'actual:negative', 'label_ref': 'no', 'sealed': True, 'epoch': 1}]
    joint = {'model_ref': 'assignment:a', 'feature_values': [['positive', 'LENGTH', 3], ['negative', 'LENGTH', 1], ['query', 'LENGTH', 4]],
             'submission_preconditions': [['yes', True], ['no', True]], 'measurement_complete': True}
    induction = {**base, 'operation_ref': 'mechanics.visual_sequence.labeled_predicate_induction', 'mode_ref': 'PREDICT',
                 'phase_ref': 'FINITE_LABELED_GRAMMAR', 'grammar': [atom, inverse], 'predicate_root_refs': ['length:2', 'not:length:2'],
                 'positive_label_ref': 'yes', 'negative_label_ref': 'no', 'examples': examples, 'models': [joint],
                 'query_example_ref': 'query', 'grammar_domain_complete': True, 'assignment_domain_complete': True}
    mechanical_case('induction:complete', 'induction', induction)
    variants = [('fit', {'mode_ref': 'FIT'}), ('unsealed_examples', {'examples': [{**e, 'sealed': False} for e in examples]}),
                ('other_epoch_examples', {'examples': [{**e, 'epoch': 2} for e in examples]}), ('no_examples', {'examples': []}),
                ('query_unbound', {'query_example_ref': None}), ('node_1', {'node_bound': 1}), ('node_6', {'node_bound': 6}),
                ('domain_1', {'domain_bound': 1}), ('grammar_incomplete', {'grammar_domain_complete': False}),
                ('assignments_incomplete', {'assignment_domain_complete': False}),
                ('resume_requires_restart', {'resume_frontier': {'restart_finite_version_space': True}}),
                ('wrong_operation', {'operation_ref': 'other'}), ('wrong_mode', {'mode_ref': 'EVALUATE'}),
                ('wrong_result', {'requested_result_type': 'Other'}), ('incomplete_input', {'scope': {**mechanical_scope, 'input_domain_complete': False}}),
                ('duplicate_model', {'models': [joint, joint]}), ('missing_grammar', {'grammar': []}), ('missing_roots', {'predicate_root_refs': []}),
                ('unknown_root', {'predicate_root_refs': ['absent']}), ('same_labels', {'negative_label_ref': 'yes'}),
                ('outside_label', {'examples': [{**examples[0], 'label_ref': 'outside'}]}),
                ('unbound_atomic_feature', {'grammar': [{**atom, 'feature_ref': None}], 'predicate_root_refs': ['length:2']}),
                ('unbound_comparator', {'grammar': [{**atom, 'comparator': None}], 'predicate_root_refs': ['length:2']}),
                ('invalid_atom_children', {'grammar': [{**atom, 'child_refs': ['length:2']}]}),
                ('invalid_not_arity', {'grammar': [atom, {**inverse, 'child_refs': []}]}),
                ('cyclic_grammar', {'grammar': [atom, {**inverse, 'child_refs': ['not:length:2']}]}),
                ('missing_child', {'grammar': [atom, {**inverse, 'child_refs': ['absent']}]}),
                ('duplicate_nodes', {'grammar': [atom, atom]}), ('invalid_bound', {'node_bound': 0})]
    for name, patch in variants: mechanical_case('induction:' + name, 'induction', {**copy.deepcopy(induction), **copy.deepcopy(patch)})
    model_variants = [('measurement_incomplete', {'measurement_complete': False}),
                      ('query_unknown', {'feature_values': joint['feature_values'][:2]}),
                      ('training_unknown', {'feature_values': joint['feature_values'][1:]}),
                      ('null_query', {'feature_values': [*joint['feature_values'][:2], ['query', 'LENGTH', None]]}),
                      ('false_submission_agrees_descriptively', {'submission_preconditions': [['yes', False], ['no', False]]}),
                      ('unknown_submission', {'submission_preconditions': [['yes', None], ['no', True]]}),
                      ('missing_submission', {'submission_preconditions': []}),
                      ('duplicate_assignment', {'feature_values': [*joint['feature_values'], joint['feature_values'][0]]}),
                      ('duplicate_precondition', {'submission_preconditions': [*joint['submission_preconditions'], ['yes', True]]})]
    for name, patch in model_variants:
        mechanical_case('induction:' + name, 'induction', {**copy.deepcopy(induction), 'models': [{**copy.deepcopy(joint), **copy.deepcopy(patch)}]})
    contradictory = {**copy.deepcopy(induction), 'examples': [*examples, {**examples[0], 'receipt_ref': 'actual:contradiction', 'label_ref': 'no'}]}
    mechanical_case('induction:contradiction_nonvacuous', 'induction', contradictory)
    mechanical_case('induction:contradiction_incomplete_grammar', 'induction', {**contradictory, 'grammar_domain_complete': False})
    alternate = {**copy.deepcopy(joint), 'model_ref': 'assignment:b', 'feature_values': [*joint['feature_values'][:2], ['query', 'LENGTH', 0]]}
    mechanical_case('induction:joint_model_disagreement', 'induction', {**copy.deepcopy(induction), 'models': [joint, alternate]})
    partition = {**copy.deepcopy(induction), 'mode_ref': 'PARTITION', 'models': [joint, alternate],
                 'contrasts': [{'example_ref': 'query', 'actual_observation_channel_ref': 'available:measure', 'descriptive_only': False}]}
    mechanical_case('induction:partition_actionable_channel', 'induction', partition)
    mechanical_case('induction:partition_descriptive_only', 'induction', {**partition, 'contrasts': [{**partition['contrasts'][0], 'descriptive_only': True}]})
    mechanical_case('induction:partition_missing_channel', 'induction', {**partition, 'contrasts': [{**partition['contrasts'][0], 'actual_observation_channel_ref': None}]})
    # Scalar comparisons preserve Python exact type distinctions, including bool/int.
    for comparison in ['EQ', 'NE', 'LT', 'LE', 'GT', 'GE']:
        for value in [True, 1, 'a', None]:
            node = {**copy.deepcopy(atom), 'comparator': comparison, 'value': value}
            actual = {**copy.deepcopy(joint), 'feature_values': [['positive', 'LENGTH', value], ['negative', 'LENGTH', False], ['query', 'LENGTH', 1]]}
            mechanical_case(f'induction:scalar:{comparison}:{type(value).__name__}', 'induction',
                            {**copy.deepcopy(induction), 'grammar': [node], 'predicate_root_refs': ['length:2'], 'models': [actual]})
    for kind in ['AND', 'OR']:
        other = {**copy.deepcopy(atom), 'node_ref': 'other', 'feature_ref': 'OTHER', 'comparator': 'EQ', 'value': True}
        logical = {'node_ref': 'logical', 'kind': kind, 'feature_ref': None, 'comparator': None, 'value': None, 'child_refs': ['length:2', 'other']}
        model2 = {**copy.deepcopy(joint), 'feature_values': [*joint['feature_values'], ['positive', 'OTHER', True], ['negative', 'OTHER', False], ['query', 'OTHER', None]]}
        mechanical_case('induction:logical:' + kind, 'induction', {**copy.deepcopy(induction), 'grammar': [atom, other, logical], 'predicate_root_refs': ['logical'], 'models': [model2]})
        mechanical_case('induction:empty_logical:' + kind, 'induction', {**copy.deepcopy(induction), 'grammar': [{**logical, 'child_refs': []}], 'predicate_root_refs': ['logical']})
    nested = [atom, inverse, {'node_ref': 'double-not', 'kind': 'NOT', 'feature_ref': None, 'comparator': None, 'value': None, 'child_refs': ['not:length:2']}]
    mechanical_case('induction:nested_complete', 'induction', {**copy.deepcopy(induction), 'grammar': nested, 'predicate_root_refs': ['double-not']})
    mechanical_case('induction:depth_bound', 'induction', {**copy.deepcopy(induction), 'grammar': nested, 'predicate_root_refs': ['double-not'], 'depth_bound': 1})


def main():
    source_hashes()
    assert sha((ROOT / PROBE['generator']).read_bytes()) == PROBE['generatorSha256']
    public_cases(); controlled_cases(); method_cases(); mixed_envelope_cases(); mechanical_cases()
    assert len({case['id'] for case in CASES}) == len(CASES)
    result = {'schema': 'logos-engine.v6.labeled-sequence-reference.v1', 'sourceCommit': COMMIT, 'sourceHashes': source_hashes(), 'policy': POLICY,
              'qualification': {'sourceModified': False, 'gameHostRunByExporter': False,
                  'realTrajectory': 'Separate unchanged original isolated component; 40 public actions complete five levels, then abstention. No full-caller selection or full-game WIN claim.',
                  'ownLayer': 'Own proposals, cache, events and digest around separately retained original Product ancestor digest; absent source ancestors remain unported.',
                  'commonEnvelope': 'True ObservedCompositionConstraint with CombinedObservedCompositionMemory, cold and advanced by all saved public packets. This is family acquisition, not original full caller selection.',
                  'mechanics': 'All eight ordered feature kinds and the FIT/PREDICT/PARTITION finite-grammar algorithms on canonical safe-integer JSON; general Pydantic coercions and arbitrary Python integers remain outside the native contract.',
                  'agreement': 'Version-space agreement is grammar-relative and nonvacuous, never unique-law proof or action authorization. A shared false submission precondition can still be descriptive agreement in the original contract.',
                  'controlledVariants': 'Public-raster and mechanical contract cases; no live success claim.',
                  'time': 'Source real deadlines remain active. Deterministic bounded receipts are compared; native wall-time interruption is tested separately.'},
              'sourceMro': [cls.__name__ for cls in type(ObservedCompositionConstraint().memory).__mro__],
              'scenes': SCENES, 'plans': PLANS, 'cases': CASES, 'commonEnvelopes': ENVELOPES,
              'mixedEnvelopeInputs': MIXED_INPUTS,
              'originalPublicProbe': {'path': PROBE_PATH, 'sha256': sha((ROOT / PROBE_PATH).read_bytes()), 'actions': PROBE['actions'],
                                      'levelsCompleted': PROBE['levelsCompleted'], 'boundaries': PROBE['boundaries']},
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': sha(Path(__file__).read_bytes())}
    output = ROOT / 'tests/fixtures/v6-labeled-sequence-reference.json.gz'
    output.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(output.relative_to(ROOT)), 'cases': len(CASES), 'scenes': len(SCENES),
                      'combinedEnvelopes': len(ENVELOPES), 'sourceFilesVerified': len(result['sourceHashes'])}), flush=True)


if __name__ == '__main__': main()
