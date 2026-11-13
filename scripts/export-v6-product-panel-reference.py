#!/usr/bin/env python3
"""Export the pinned ProductPanel source contracts from saved public evidence.

No game is run here. Own source layers and the true full source family envelope
are retained separately; no missing ancestor is replaced by an empty digest.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import itertools
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
from product_panel_observation import measure as product_measure
from product_panel_access import ProductPanelAccess, current, command_for
from product_panel_methods import compile_routes
from common_product_panel import ProductPanelConstraint
from queued_field_access import QueuedFieldAccess
from common_observed_compositions import ObservedCompositionConstraint
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from rooted_quota_methods import plain
from agents.yf_arc3_v5.capabilities.cyclic_configuration_coverage import CyclicCoverageRequest, measure_cyclic_configuration_coverage

PROBE_PATH = 'tests/fixtures/v6-product-panel-original-public.json.gz'
PROBE = json.loads(gzip.decompress((ROOT / PROBE_PATH).read_bytes()))
POLICY = PROBE['policy']
SCENES, CASES, PLANS, ENVELOPES = {}, [], {}, []
OWN_FIELDS = ('product_state', 'product_events')


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
    return {'projection': own_state(memory), 'parentDigest': QueuedFieldAccess.retained_digest(memory),
            'digest': ProductPanelAccess.retained_digest(memory)}
def memory_from(events=()):
    memory = ProductPanelAccess()
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
    obs, _ = measure(SimpleNamespace(**public), len(SCENES) + 1, 'product-panel-contract')
    SCENES[name] = {'rows': raster, 'public': public, 'observation': plain(obs)}


def proposal_case(name, view, events=(), remaining=16, config=None, deadline=True, common=True):
    memory = memory_from(events); before = own_state(memory)
    family = ProductPanelConstraint(); family.memory = memory
    family.level_deadline = time.perf_counter() + 600 if deadline else None
    domain = ObservedInputDomain(4096); inputs = domain.candidates(observation(view))
    arguments = {'scene': view, 'ownEvents': events, 'remaining': remaining, 'policy': config if config is not None else POLICY,
                 'deadlinePresent': deadline}
    try:
        value = family.product_propose(observation(view), rows(view), inputs, remaining, arguments['policy']) if common else memory.propose(
            [], observation(view), rows(view), inputs, remaining, {**arguments['policy'], 'level_deadline': family.level_deadline, 'remaining_level_actions': remaining})
    except (AssertionError, ValueError, TypeError) as error:
        add(name, 'common_propose' if common else 'propose', arguments, {'rejected': True, 'sourceError': type(error).__name__}); return None
    assert own_state(memory) == before
    add(name, 'common_propose' if common else 'propose', arguments, value)
    if value and 'product_panel_plan' in value:
        PLANS[name] = copy.deepcopy(value)
        if common:
            bound = copy.deepcopy(value); family.bind(bound, domain)
            add(name + ':bind', 'bind', {'scene': view, 'proposal': name, 'observed': True}, bound)
            # The original binder validates the measured point payload. Its
            # physical caller, not this helper, owns the observed input domain.
            empty_bound = copy.deepcopy(value); family.bind(empty_bound, ObservedInputDomain(4096))
            add(name + ':bind_empty_domain', 'bind', {'scene': view, 'proposal': name, 'observed': False}, empty_bound)
    return value


def before_case(name, proposal, view, index=0, changes=None, patch=None):
    obs = observation(view)
    meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'observation_ref': obs['observation_ref'], 'available': obs['available_action_refs']}
    meta.update(changes or {})
    p = copy.deepcopy(PLANS[proposal]); p.update(patch or {})
    value = ProductPanelAccess().before(p, index, rows(view), **meta)
    add(name, 'before', {'proposal': proposal, 'scene': view, 'index': index, 'meta': meta, 'patch': patch or {}}, value)


def after_case(name, proposal, first, second, index=0, changes=None):
    obs = observation(second); meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'state': obs['state']}
    meta.update(changes or {})
    value = ProductPanelAccess().after(copy.deepcopy(PLANS[proposal]), index, rows(first), rows(second), **meta)
    add(name, 'after', {'proposal': proposal, 'before': first, 'after': second, 'index': index, 'meta': meta}, value)


def record_case(name, proposal, first, second, events=(), index=0, command=None, passive=False):
    memory = memory_from(events); p = copy.deepcopy(PLANS[proposal]); command = copy.deepcopy(command or p['actions'][index])
    if passive: p.pop('product_panel_plan')
    arguments = [observation(first), command, observation(second), rows(first), rows(second), p, index]
    unchanged = copy.deepcopy(arguments); parent_calls = []
    def trace(frame, event, value):
        if frame.f_code is QueuedFieldAccess.record.__code__ and event == 'call': parent_calls.append(True)
    sys.setprofile(trace)
    try: acquired = memory.record(*arguments)
    finally: sys.setprofile(None)
    assert arguments == unchanged and len(parent_calls) == 1
    assert own_state(memory_from(memory.product_events)) == own_state(memory)
    add(name, 'record', {'proposal': proposal, 'before': first, 'after': second, 'index': index, 'ownEvents': events, 'command': command, 'passive': passive},
        {'events': [event for event in acquired if event['kind'] == 'observed_factor_product'], 'inheritedEvents': [event for event in acquired if event['kind'] != 'observed_factor_product'],
         'state': state(memory), 'sourceParentRecordCalls': len(parent_calls), 'inputsUnchanged': True})
    return memory.product_events


def public_cases():
    for i, item in enumerate(PROBE['packets']):
        SCENES[f'public:{i}'] = {'rows': copy.deepcopy(item['packet']['frame_rows']), 'public': copy.deepcopy(item['packet']), 'observation': copy.deepcopy(item['observation'])}
    boundary = 0
    for i, prefix in enumerate(PROBE['prefixes']):
        first = prefix['steps'][0]['actionIndex'] - 1; name = f'public:prefix:{i}'
        events = copy.deepcopy(prefix['beforeState']['projection']['product_events']); remaining = 120 - (first - boundary)
        value = proposal_case(name, f'public:{first}', events, remaining)
        assert value
        bound = copy.deepcopy(value); domain = ObservedInputDomain(4096); domain.candidates(observation(f'public:{first}'))
        ProductPanelConstraint().bind(bound, domain)
        assert bound == prefix['proposal'], name
        for record in prefix['steps']:
            second = record['actionIndex']; index = record['index']
            before_case(f'{name}:before:{index}', name, f'public:{second-1}', index)
            after_case(f'{name}:after:{index}', name, f'public:{second-1}', f'public:{second}', index)
            events = record_case(f'{name}:record:{index}', name, f'public:{second-1}', f'public:{second}', events, index)
            if observation(f'public:{second}')['levels_completed'] > observation(f'public:{second-1}')['levels_completed']: boundary = second
    # Real full source family, cold, advanced by all 24 saved public returns.
    family = ObservedCompositionConstraint(); domain = ObservedInputDomain(4096); boundary = 0
    for i, prefix in enumerate(PROBE['prefixes']):
        first = prefix['steps'][0]['actionIndex'] - 1; view = f'public:{first}'; remaining = 120 - (first - boundary)
        family.level_deadline = time.perf_counter() + 600
        proposal = family.product_propose(observation(view), rows(view), domain.candidates(observation(view)), remaining, POLICY)
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
                                   'record': plain(acquired), 'state': plain(family.state()), 'productState': state(family.memory)})
            if observation(b)['levels_completed'] > observation(a)['levels_completed']: boundary = second
        ENVELOPES.append(entry)


def controlled_cases():
    initial = copy.deepcopy(rows('public:0')); scene = product_measure(initial)
    add_scene('controlled:blank', [[0] * 64 for _ in range(64)])
    add_scene('controlled:recolored', [[(7 * value + 3) % 16 for value in row] for row in initial])
    add_scene('controlled:reflected', [list(reversed(row)) for row in initial])
    add_scene('controlled:shifted', [[0] * 72 for _ in range(5)] + [[0] * 3 + row + [0] * 5 for row in initial] + [[0] * 72 for _ in range(3)])
    add_scene('controlled:double_scale', [[value for value in row for _ in range(2)] for row in initial for _ in range(2)])
    add_scene('controlled:no_action', initial, available=[])
    # Invalid current member: the vocabulary is measured, not assigned a role by palette.
    changed = copy.deepcopy(initial); x, y = scene['controls'][0]['point']; changed[y][x] = next(v for v in range(16) if v not in scene['controls'][0]['values'])
    add_scene('controlled:outside_vocabulary', changed)
    # A current tuple changes in two dimensions; the original keeps a counterexample.
    changed = copy.deepcopy(initial)
    for control in scene['controls']:
        l, t, r, b = control['bbox']; old = control['current']; values = control['values']; new = values[(values.index(old) + 1) % len(values)]
        for yy in range(t + 1, b):
            for xx in range(l + 1, r):
                if changed[yy][xx] == old: changed[yy][xx] = new
    add_scene('controlled:coupled_change', changed)
    assert product_measure(changed)['geometry_ref'] == scene['geometry_ref']
    # Catalogue exactness: copy one tuple member to create a duplicate catalogue.
    changed = copy.deepcopy(initial); first, second = scene['entries'][:2]
    for dx, dy in scene['geometry']['offsets']: changed[second['bbox'][1] + dy][second['bbox'][0] + dx] = initial[first['bbox'][1] + dy][first['bbox'][0] + dx]
    add_scene('controlled:incomplete_catalogue', changed)
    for name in list(SCENES):
        measured = product_measure(rows(name)); add('measure:' + name, 'measure', {'scene': name}, measured)
        if measured:
            add('current:' + name, 'current', {'scene': name, 'geometry': measured['geometry']}, current(rows(name), measured['geometry']))
            for i, control in enumerate(measured['controls']): add(f'command:{name}:{i}', 'command', {'control': control}, command_for(control))
    for name in [name for name in SCENES if name.startswith('controlled:')]: proposal_case('proposal:' + name, name)
    proposal_case('proposal:zero_remaining', 'public:0', remaining=0)
    proposal_case('proposal:negative_remaining', 'public:0', remaining=-1)
    proposal_case('proposal:no_config', 'public:0', config={})
    proposal_case('proposal:missing_deadline', 'public:0', deadline=False)
    proposal_case('proposal:own_initial', 'public:0', common=False)
    name = 'public:prefix:0'
    before_case('before:changed_epoch', name, 'public:0', changes={'epoch': 2})
    before_case('before:changed_score', name, 'public:0', changes={'score': 1})
    before_case('before:changed_observation', name, 'public:0', changes={'observation_ref': 'unseen'})
    before_case('before:action_unavailable', name, 'public:0', changes={'available': []})
    before_case('before:negative_index', name, 'public:0', index=-1)
    before_case('before:index_outside', name, 'public:0', index=99)
    changed_actions = copy.deepcopy(PLANS[name]['actions']); changed_actions[0]['data']['x'] += 1
    before_case('before:payload_changed', name, 'public:0', patch={'actions': changed_actions})
    bundle = copy.deepcopy(PLANS[name]['bundle_template']); bundle['actions'] = changed_actions
    before_case('before:bundle_changed', name, 'public:0', patch={'bundle_template': bundle})
    before_case('before:current_values_changed', name, 'controlled:coupled_change')
    after_case('after:unknown_stationary', name, 'public:0', 'public:0')
    after_case('after:official_score', name, 'public:0', 'public:1', changes={'score': 1})
    record_case('record:stationary', name, 'public:0', 'public:0')
    record_case('record:coupled_counterexample', name, 'public:0', 'controlled:coupled_change')
    record_case('record:wrong_point_no_edge', name, 'public:0', 'public:1', command={'action_ref': 'ACTION6', 'data': {'x': 0, 'y': 0}})
    record_case('record:passive_other_proposal', name, 'public:0', 'public:1', passive=True)
    record_case('record:lost_measurement', name, 'public:0', 'controlled:blank')
    events = PROBE['prefixes'][2]['beforeState']['projection']['product_events']
    proposal_case('proposal:cap_one', 'public:2', events=events, remaining=1)
    config = copy.deepcopy(POLICY); config['factor_product_question']['max_factors'] = 1
    proposal_case('proposal:too_many_factors', 'public:2', events=events, config=config)


def route_case(name, scene, state, observation, remaining=120, max_factors=4, expired=False):
    value = compile_routes(copy.deepcopy(scene), copy.deepcopy(state), observation, remaining, time.perf_counter() + (-1 if expired else 600), max_factors)
    add(name, 'routes', {'geometry': scene, 'state': state, 'observation': observation, 'remaining': remaining, 'maxFactors': max_factors, 'expired': expired}, value)


def route_cases():
    # Three-symbol vocabularies distinguish the measured forward and reverse candidates.
    scene = {'controls': [{'values': [2, 3, 4]}, {'values': [5, 6]}], 'current': [2, 5],
             'catalogue': [list(x) for x in itertools.product([2, 3, 4], [5, 6])]}
    obs = observation('public:0')
    state = {'visited': [[2, 5]], 'edges': [{'factor': 0, 'from': 2, 'to': 3}, {'factor': 1, 'from': 5, 'to': 6}], 'counterexamples': []}
    route_case('routes:forward', scene, state, obs)
    reverse = copy.deepcopy(state); reverse['edges'][0]['to'] = 4
    route_case('routes:reverse', scene, reverse, obs)
    contradictory = copy.deepcopy(state); contradictory['edges'].append({'factor': 0, 'from': 2, 'to': 4})
    route_case('routes:contradictory_direction', scene, contradictory, obs)
    coupled = copy.deepcopy(state); coupled['counterexamples'].append({'changed_factors': [0, 1], 'evidence': ['before', 'after']})
    route_case('routes:source_retains_conditional_independence_after_counterexample', scene, coupled, obs)
    route_case('routes:factor_bound', scene, state, obs, max_factors=1)
    route_case('routes:no_reserve', scene, state, obs, remaining=0)
    route_case('routes:insufficient_reserve', scene, state, obs, remaining=2)
    route_case('routes:expired', scene, state, obs, expired=True)


def mechanical_case(name, request):
    try: typed = CyclicCoverageRequest(**copy.deepcopy(request))
    except Exception as error:
        add(name, 'mechanical', {'request': request}, {'rejected': True, 'sourceError': type(error).__name__}); return None
    value = plain(measure_cyclic_configuration_coverage(typed).model_dump())
    add(name, 'mechanical', {'request': plain(typed.model_dump())}, value)
    return value


def mechanical_cases():
    scope = {'request_ref': 'product:contract', 'caller_ref': 'public_product_question', 'parent_consumer_ref': 'SRC_composition',
             'parent_goal_ref': 'G_official_completion', 'parent_contribution_ref': 'experimentally_cover_measured_catalogue',
             'caller_next_item_ref': 'observation:contract', 'epoch': 1, 'evidence_revision_ref': 'evidence:1', 'model_revision_ref': 'model:1',
             'model_status_ref': 'conditional_local_cycle_and_independence_hypotheses', 'event_owner_ref': 'SRC', 'input_domain_complete': True}
    model = {'model_ref': 'model:a', 'factors': [['a', 'b'], ['x', 'y', 'z']], 'bindings': [['f:0', 0], ['f:1', 1]],
             'costs': [['f:0', 1], ['f:1', 1]], 'independent': True, 'initial_credited': True,
             'catalogue': [list(x) for x in itertools.product(['a', 'b'], ['x', 'y', 'z'])], 'debit_rule': 'reject_if_insufficient',
             'terminal_order': ['acceptance', 'exhaustion'], 'sweep_actions': ['f:0', 'f:1']}
    base = {'scope': scope, 'operation_ref': 'mechanics.cyclic_configuration_coverage.product_sweep', 'mode_ref': 'COMPILE',
            'requested_result_type': 'DMechanicalResult', 'node_bound': 100000, 'depth_bound': 4096, 'domain_bound': 4096, 'time_bound_ms': 300000,
            'models': [model], 'state': {'current': ['a', 'x'], 'visited': [['a', 'x']], 'reserve': 120}, 'factor_order': [0, 1]}
    mechanical_case('mechanical:complete', base)
    variants = [('node_1', {'node_bound': 1}), ('node_8', {'node_bound': 8}), ('domain_1', {'domain_bound': 1}), ('depth_1', {'depth_bound': 1}),
                ('reversed_order', {'factor_order': [1, 0]}), ('invalid_order', {'factor_order': [0, 0]}), ('missing_state', {'state': None}),
                ('missing_models', {'models': []}), ('duplicate_model', {'models': [model, model]}), ('wrong_operation', {'operation_ref': 'unrelated'}),
                ('wrong_mode', {'mode_ref': 'STEP'}), ('wrong_result', {'requested_result_type': 'Other'}),
                ('incomplete_domain', {'scope': {**scope, 'input_domain_complete': False}}),
                ('zero_reserve', {'state': {**base['state'], 'reserve': 0}}), ('early_exhaustion', {'state': {**base['state'], 'reserve': 2}}),
                ('exact_reserve', {'state': {**base['state'], 'reserve': 5}}), ('initial_not_visited', {'state': {**base['state'], 'visited': []}}),
                ('already_visited', {'state': {**base['state'], 'visited': model['catalogue']}})]
    for name, patch in variants: mechanical_case('mechanical:' + name, {**copy.deepcopy(base), **copy.deepcopy(patch)})
    changes = [('independence_unknown', {'independent': None}), ('duplicate_vocabulary', {'factors': [['a', 'a'], ['x', 'y', 'z']]}),
               ('empty_vocabulary', {'factors': [[], ['x', 'y', 'z']]}), ('wrong_binding', {'bindings': [['f:0', 9], ['f:1', 1]]}),
               ('missing_cost', {'costs': [['f:1', 1]]}), ('negative_cost', {'costs': [['f:0', -1], ['f:1', 1]]}),
               ('high_cost', {'costs': [['f:0', 200], ['f:1', 1]]}), ('missing_catalogue', {'catalogue': []}),
               ('duplicate_catalogue', {'catalogue': [*model['catalogue'], model['catalogue'][0]]}), ('outside_catalogue', {'catalogue': [['outside', 'x']]}),
               ('missing_debit', {'debit_rule': None}), ('missing_terminal_order', {'terminal_order': []}),
               ('exhaustion_first', {'terminal_order': ['exhaustion', 'acceptance']}), ('missing_sweep', {'sweep_actions': ['f:0']})]
    for name, patch in changes: mechanical_case('mechanical:' + name, {**copy.deepcopy(base), 'models': [{**copy.deepcopy(model), **patch}]})
    for credit in [False, None]:
        mechanical_case('mechanical:uncredited_' + str(credit), {**copy.deepcopy(base), 'models': [{**copy.deepcopy(model), 'initial_credited': credit}], 'state': {**base['state'], 'visited': []}})
    mechanical_case('mechanical:saturating_debit', {**copy.deepcopy(base), 'models': [{**copy.deepcopy(model), 'debit_rule': 'saturating', 'costs': [['f:0', 200], ['f:1', 1]]}]})
    unicode_model = {**copy.deepcopy(model), 'factors': [['\ue000', '\U00010000'], ['x', 'y', 'z']],
                     'catalogue': [list(x) for x in itertools.product(['\ue000', '\U00010000'], ['x', 'y', 'z'])]}
    mechanical_case('mechanical:unicode_codepoint_order', {**copy.deepcopy(base), 'models': [unicode_model], 'state': {'current': ['\ue000', 'x'], 'visited': [], 'reserve': 120}})
    second = {**copy.deepcopy(model), 'model_ref': 'model:b'}
    multi = {**copy.deepcopy(base), 'models': [model, second]}
    interrupted = mechanical_case('mechanical:partial_model_prefix', {**copy.deepcopy(multi), 'node_bound': 14})
    assert interrupted['status'] == 'NEEDS_EVIDENCE' and len(interrupted['frontier']['completed_model_results']) == 1
    mechanical_case('mechanical:resume', {**copy.deepcopy(multi), 'resume_frontier': interrupted['frontier']})
    mechanical_case('mechanical:resume_wrong_digest', {**copy.deepcopy(multi), 'resume_frontier': {**interrupted['frontier'], 'input_digest': 'wrong'}})
    broken = copy.deepcopy(interrupted['frontier']); broken['completed_model_results'][0]['model_ref'] = 'wrong'
    mechanical_case('mechanical:resume_wrong_model_prefix', {**copy.deepcopy(multi), 'resume_frontier': broken})
    mechanical_case('mechanical:invalid_bound', {**copy.deepcopy(base), 'node_bound': 0})


def main():
    source_hashes()
    assert sha((ROOT / PROBE['generator']).read_bytes()) == PROBE['generatorSha256']
    public_cases(); controlled_cases(); route_cases(); mechanical_cases()
    result = {'schema': 'logos-engine.v6.product-panel-reference.v1', 'sourceCommit': COMMIT, 'sourceHashes': source_hashes(), 'policy': POLICY,
              'qualification': {'sourceModified': False, 'gameHostRunByExporter': False,
                  'realTrajectory': 'Separate unchanged original isolated component; no full-caller selection claim.',
                  'ownLayer': 'Own proposals, passive events and digest around separately retained original ancestor digest; queue/catalogue and other absent ancestors remain unported.',
                  'commonEnvelope': 'True ObservedCompositionConstraint with CombinedObservedCompositionMemory, cold and advanced by all saved public packets. This is family acquisition, not original full caller selection.',
                  'mechanics': 'Called product_sweep/COMPILE branch and its helpers on canonical safe-integer JSON; other operations and general Pydantic coercions are not transferred.',
                  'conditionalIndependence': 'Original route compiler retains its conditional independence hypothesis even after recorded simultaneous-factor counterexamples; no stronger refutation claim.',
                  'controlledVariants': 'Public-raster and mechanical contract cases; no live success claim.',
                  'time': 'Source real deadlines remain active. Deterministic bounded receipts are compared; native wall-time interruption is tested separately.'},
              'sourceMro': [cls.__name__ for cls in type(ObservedCompositionConstraint().memory).__mro__],
              'scenes': SCENES, 'plans': PLANS, 'cases': CASES, 'commonEnvelopes': ENVELOPES,
              'originalPublicProbe': {'path': PROBE_PATH, 'sha256': sha((ROOT / PROBE_PATH).read_bytes()), 'actions': PROBE['actions'],
                                      'levelsCompleted': PROBE['levelsCompleted'], 'boundaries': PROBE['boundaries']},
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': sha(Path(__file__).read_bytes())}
    output = ROOT / 'tests/fixtures/v6-product-panel-reference.json.gz'
    output.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(output.relative_to(ROOT)), 'cases': len(CASES), 'scenes': len(SCENES),
                      'combinedEnvelopes': len(ENVELOPES), 'sourceFilesVerified': len(result['sourceHashes'])}), flush=True)


if __name__ == '__main__': main()
