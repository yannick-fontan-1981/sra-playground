#!/usr/bin/env python3
"""Export unchanged rooted-quota contracts from saved public evidence only.

No game host is run here. The separate original cold-component probe retains
the actual public trajectory. This exporter compares source-owned layers and
the true CombinedObservedCompositionMemory envelope, without substituting an
empty ancestor or claiming full original caller selection parity.
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
from rooted_chain_observation import scene as rooted_scene
from rooted_quota_access import RootedQuotaAccess, lengths
from rooted_quota_methods import scope, cells, quotas, request_base, propagate, step, plain
from common_rooted_quota import RootedQuotaConstraint
from common_observed_compositions import ObservedCompositionConstraint
from service_transfer_access import ServiceTransferAccess
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v5.capabilities.rooted_prefix_marginals_d import RootedPrefixMarginalsRequestD, measure_rooted_prefix_marginals_d
from agents.yf_arc3_v5.capabilities.indexed_prefix_primitive_d import IndexedPrefixPrimitiveRequestD, measure_indexed_prefix_primitive_d

PROBE_PATH = 'tests/fixtures/v6-rooted-quota-original-public.json.gz'
PROBE = json.loads(gzip.decompress((ROOT / PROBE_PATH).read_bytes()))
POLICY = PROBE['policy']
SCENES, CASES, PLANS, ENVELOPES = {}, [], {}, []
OWN_FIELDS = ('quota_events', 'quota_model', 'quota_context', 'requested_stop_reason')


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
    return {'projection': own_state(memory), 'parentDigest': ServiceTransferAccess.retained_digest(memory),
            'digest': RootedQuotaAccess.retained_digest(memory)}
def memory_from(events=()):
    memory = RootedQuotaAccess()
    for event in events: memory.apply_event(copy.deepcopy(event))
    return memory
def add(name, operation, args, value):
    CASES.append({'id': name, 'operation': operation, 'arguments': plain(copy.deepcopy(args)), 'expected': plain(copy.deepcopy(value))})
def rows(name): return SCENES[name]['rows']
def observation(name): return SCENES[name]['observation']


def add_scene(name, raster, epoch=1, score=0, available=None):
    public = {'frame_rows': copy.deepcopy(raster), 'frame_packet': [copy.deepcopy(raster)], 'level': epoch, 'levels_completed': score,
              'state': 'NOT_FINISHED', 'step_index': 0, 'available_action_refs': ['ACTION6'] if available is None else available,
              'frame_hash': sha(json.dumps(raster, separators=(',', ':')).encode())[:16]}
    obs, _ = measure(SimpleNamespace(**public), len(SCENES) + 1, 'rooted-quota-contract')
    SCENES[name] = {'rows': raster, 'public': public, 'observation': plain(obs)}


def proposal_case(name, view, events=(), remaining=16, config=None, common=True, deadline=True):
    memory = memory_from(events); before = own_state(memory)
    family = RootedQuotaConstraint(); family.memory = memory
    family.level_deadline = time.perf_counter() + 600 if deadline else None
    domain = ObservedInputDomain(4096); inputs = domain.candidates(observation(view))
    args = {'scene': view, 'ownEvents': events, 'remaining': remaining, 'policy': config if config is not None else POLICY,
            'deadlinePresent': deadline}
    try:
        value = family.rooted_propose(observation(view), rows(view), inputs, remaining, args['policy']) if common else memory.propose([], observation(view), rows(view), inputs, remaining,
                    {**args['policy'], 'level_deadline': family.level_deadline, 'remaining_level_actions': remaining})
    except (AssertionError, ValueError, TypeError) as error:
        add(name, 'common_propose' if common else 'propose', args, {'rejected': True, 'sourceError': type(error).__name__}); return None
    assert own_state(memory) == before
    add(name, 'common_propose' if common else 'propose', args, value)
    if value and 'rooted_quota_plan' in value:
        PLANS[name] = copy.deepcopy(value)
        if common:
            bound = copy.deepcopy(value); family.bind(bound, domain)
            add(name + ':bind', 'bind', {'scene': view, 'proposal': name, 'observed': True}, bound)
            try: family.bind(copy.deepcopy(value), ObservedInputDomain(4096))
            except AssertionError: add(name + ':bind_unobserved', 'bind', {'scene': view, 'proposal': name, 'observed': False}, {'rejected': True})
            else: raise AssertionError('Unobserved binding must fail')
    return value


def before_case(name, proposal, view, index=0, changes=None):
    obs = observation(view)
    meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'observation_ref': obs['observation_ref'], 'available': obs['available_action_refs']}
    meta.update(changes or {})
    value = RootedQuotaAccess().before(copy.deepcopy(PLANS[proposal]), index, rows(view), **meta)
    add(name, 'before', {'proposal': proposal, 'scene': view, 'index': index, 'meta': meta}, value)
def after_case(name, proposal, first, second, index=0, changes=None):
    obs = observation(second); meta = {'epoch': obs['level_epoch'], 'score': obs['levels_completed'], 'state': obs['state']}
    meta.update(changes or {})
    value = RootedQuotaAccess().after(copy.deepcopy(PLANS[proposal]), index, rows(first), rows(second), **meta)
    add(name, 'after', {'proposal': proposal, 'before': first, 'after': second, 'index': index, 'meta': meta}, value)
def record_case(name, proposal, first, second, events, index=0):
    memory = memory_from(events); p = copy.deepcopy(PLANS[proposal]); command = copy.deepcopy(p['actions'][index])
    args = [observation(first), command, observation(second), rows(first), rows(second), p, index]
    unchanged = copy.deepcopy(args); parent_calls = []
    def trace(frame, event, value):
        if frame.f_code is ServiceTransferAccess.record.__code__ and event == 'call': parent_calls.append(True)
    sys.setprofile(trace)
    try: value = memory.record(*args)
    finally: sys.setprofile(None)
    assert args == unchanged and not parent_calls
    assert own_state(memory_from(memory.quota_events)) == own_state(memory)
    add(name, 'record', {'proposal': proposal, 'before': first, 'after': second, 'index': index, 'ownEvents': events, 'command': command},
        {'events': value, 'state': state(memory), 'sourceParentRecordCalls': 0, 'inputsUnchanged': True})
    return memory.quota_events


def public_cases():
    for i, item in enumerate(PROBE['packets']):
        SCENES[f'public:{i}'] = {'rows': copy.deepcopy(item['packet']['frame_rows']), 'public': copy.deepcopy(item['packet']), 'observation': copy.deepcopy(item['observation'])}
    for i, prefix in enumerate(PROBE['prefixes']):
        first = prefix['steps'][0]['actionIndex'] - 1; name = f'public:prefix:{i}'
        events = copy.deepcopy(prefix['beforeState']['projection']['quota_events'])
        value = proposal_case(name, f'public:{first}', events, 120)
        assert value
        bound = copy.deepcopy(value); domain = ObservedInputDomain(4096); domain.candidates(observation(f'public:{first}'))
        RootedQuotaConstraint().bind(bound, domain)
        assert bound == prefix['proposal']
        for record in prefix['steps']:
            second = record['actionIndex']; index = record['index']
            before_case(f'{name}:before:{index}', name, f'public:{second-1}', index)
            after_case(f'{name}:after:{index}', name, f'public:{second-1}', f'public:{second}', index)
            events = record_case(f'{name}:record:{index}', name, f'public:{second-1}', f'public:{second}', events, index)
    # True combined source class, with its actual passive event envelope. No
    # whole-caller proposal selection or restored oracle state is substituted.
    family = ObservedCompositionConstraint(); domain = ObservedInputDomain(4096)
    for i, prefix in enumerate(PROBE['prefixes']):
        first = prefix['steps'][0]['actionIndex'] - 1; view = f'public:{first}'
        family.level_deadline = time.perf_counter() + 600
        proposal = family.rooted_propose(observation(view), rows(view), domain.candidates(observation(view)), 120, POLICY)
        assert proposal
        unbound = copy.deepcopy(proposal); family.bind(proposal, domain)
        assert proposal == prefix['proposal']
        entry = {'id': f'public:combined-prefix:{i}', 'beforeIndex': first, 'proposal': plain(unbound), 'boundProposal': plain(proposal), 'beforeState': plain(family.state()), 'steps': []}
        for record in prefix['steps']:
            second = record['actionIndex']; index = record['index']; a, b = f'public:{second-1}', f'public:{second}'
            guard = family.before(proposal, index, SimpleNamespace(**SCENES[a]['public']), observation(a))
            outcome = family.after(proposal, index, observation(a), observation(b), rows(a), rows(b))
            acquired = family.record(observation(a), observation(b), proposal['actions'][index], rows(a), rows(b), proposal, index,
                                     frames=SCENES[b]['public']['frame_packet'])
            entry['steps'].append({'actionIndex': second, 'index': index, 'beforeGuard': plain(guard), 'outcome': plain(outcome),
                                   'record': plain(acquired), 'state': plain(family.state()), 'rootedState': state(family.memory)})
        ENVELOPES.append(entry)


def controlled_cases():
    initial = copy.deepcopy(rows('public:0'))
    add_scene('controlled:blank', [[0] * 64 for _ in range(64)])
    add_scene('controlled:recolored', [[(7*value+3)%16 for value in row] for row in initial])
    add_scene('controlled:reflected', [list(reversed(row)) for row in initial])
    add_scene('controlled:shifted', [[0] * 72 for _ in range(5)] + [[0]*3 + row + [0]*5 for row in initial] + [[0]*72 for _ in range(3)])
    add_scene('controlled:no_action', initial, available=[])
    geometry = rooted_scene(initial)
    changed = copy.deepcopy(initial); x,y = geometry['chains'][0]['points'][0]; changed[y][x] = (changed[y][x]+1)%16
    add_scene('controlled:changed_center', changed)
    for name in list(SCENES):
        raster = rows(name); found = rooted_scene(raster)
        add(name + ':measure', 'measure', {'scene': name, 'contentPalette': None}, found)
        if found:
            add(name + ':lengths_empty', 'lengths', {'scene': name, 'geometry': found, 'model': {}}, lengths(raster, found, {}))
            add(name + ':cells', 'cells', {'geometry': found}, cells(found))
            add(name + ':quotas', 'quotas', {'geometry': found}, quotas(found))
        if name.startswith('controlled:'): proposal_case(name + ':proposal', name)
    proposal_case('proposal:zero_remaining', 'public:0', remaining=0)
    proposal_case('proposal:no_deadline', 'public:0', deadline=False)
    proposal_case('proposal:disabled', 'public:0', config={})
    proposal_case('proposal:direct', 'public:0', common=False)
    name = 'public:prefix:0'
    for field, value in [('epoch', 9), ('score', 9), ('observation_ref', 'different'), ('available', [])]:
        before_case('guard:' + field, name, 'public:0', changes={field: value})
    changed = copy.deepcopy(PLANS[name]); changed['actions'][0]['data']['x'] += 1
    PLANS['controlled:changed_command'] = changed
    before_case('guard:changed_command', 'controlled:changed_command', 'public:0')
    before_case('guard:changed_frame', name, 'controlled:changed_center')
    after_case('after:official_epoch', name, 'public:0', 'public:1', changes={'epoch': 2})
    after_case('after:official_score', name, 'public:0', 'public:1', changes={'score': 1})
    record_case('record:unchanged_initial_effect', name, 'public:0', 'public:0', [])
    known = 'public:prefix:2'; events = PROBE['prefixes'][2]['beforeState']['projection']['quota_events']
    after_case('after:known_unchanged', known, 'public:2', 'public:2')
    record_case('record:known_unchanged', known, 'public:2', 'public:2', events)


def mechanical_case(name, operation, request):
    ctor, call = (RootedPrefixMarginalsRequestD, measure_rooted_prefix_marginals_d) if operation == 'marginals' else (IndexedPrefixPrimitiveRequestD, measure_indexed_prefix_primitive_d)
    try: typed = ctor(**copy.deepcopy(request))
    except Exception as error:
        add(name, operation, {'request': request}, {'rejected': True, 'sourceError': type(error).__name__}); return None
    value = plain(call(typed).model_dump())
    add(name, operation, {'request': plain(typed.model_dump())}, value)
    return value


def mechanical_cases():
    model = PROBE['prefixes'][2]['beforeState']['projection']['quota_model']
    s = rooted_scene(rows('public:2'), model['empty_palette']); obs = observation('public:2')
    base = request_base(obs, model, 'conditional_joint_marginals', time.perf_counter()+600)
    marginal = {**base, 'operation_ref': 'mechanics.coupled_value_constraints.rooted_prefix_marginals', 'mode_ref': 'PROPAGATE',
                'phase_ref': 'INTEGER_QUOTA_CONSTRAINTS', 'chains': [{**c, 'length_domain': list(range(len(c['cells'])+1))} for c in cells(s)], 'quotas': quotas(s)}
    mechanical_case('mechanical:marginals:complete', 'marginals', marginal)
    variants = [('node_1', {'node_bound': 1}), ('node_50', {'node_bound': 50}), ('depth_1', {'depth_bound': 1}),
                ('domain_1', {'domain_bound': 1}), ('wrong_signature', {'operation_ref': 'unrelated'}),
                ('wrong_mode', {'mode_ref': 'STEP'}), ('wrong_result', {'requested_result_type': 'Other'}),
                ('incomplete', {'scope': {**base['scope'], 'input_domain_complete': False}}), ('evaluate_missing', {'mode_ref': 'EVALUATE'}),
                ('unsupported_marginal_zero', {'quotas': [{'marginal_ref': 'unbound', 'required_count': 0}]}),
                ('impossible_marginal', {'quotas': [{'marginal_ref': 'unbound', 'required_count': 1}]})]
    for name, patch in variants: mechanical_case('mechanical:marginals:' + name, 'marginals', {**copy.deepcopy(marginal), **patch})
    evaluation = copy.deepcopy(marginal); evaluation['mode_ref'] = 'EVALUATE'
    for chain, length in zip(evaluation['chains'], lengths(rows('public:2'), s, model)): chain['evaluated_length'] = length
    mechanical_case('mechanical:marginals:evaluate', 'marginals', evaluation)
    interrupted = mechanical_case('mechanical:marginals:interrupted_round', 'marginals', {**marginal, 'node_bound': 300})
    assert interrupted['status'] == 'NEEDS_EVIDENCE'
    mechanical_case('mechanical:marginals:resume', 'marginals', {**marginal, 'resume_frontier': interrupted['frontier']})
    mechanical_case('mechanical:marginals:resume_wrong_revision', 'marginals', {**marginal, 'resume_frontier': {**interrupted['frontier'], 'input_digest': 'wrong'}})
    mechanical_case('mechanical:marginals:resume_wrong_domains', 'marginals', {**marginal, 'resume_frontier': {**interrupted['frontier'], 'retained_domains': []}})
    invalid = copy.deepcopy(marginal); invalid['chains'][0]['length_domain'] = [999]
    mechanical_case('mechanical:marginals:invalid_domain', 'marginals', invalid)
    invalid = copy.deepcopy(marginal); invalid['chains'][1]['cells'][0]['cell_ref'] = invalid['chains'][0]['cells'][0]['cell_ref']
    mechanical_case('mechanical:marginals:duplicate_cell', 'marginals', invalid)
    add('helper:scope', 'scope', {'observation': obs, 'model': model, 'contribution': 'conditional_joint_marginals'}, scope(obs, model, 'conditional_joint_marginals'))
    add('helper:propagate', 'propagate', {'geometry': s, 'observation': obs, 'model': model}, propagate(s, obs, model, time.perf_counter()+600))
    current = lengths(rows('public:2'), s, model)
    primitive = {**request_base(obs, model, 'conditional_indexed_edit', time.perf_counter()+600),
        'operation_ref': 'mechanics.editable_configuration_graph.indexed_prefix_external_primitive', 'mode_ref': 'STEP', 'phase_ref': 'EXTERNAL_COMMAND',
        'chains': [{**c, 'filled_length': n} for c,n in zip(cells(s),current)], 'quotas': quotas(s), 'channel': 'CLICK',
        'bound_chain_ref': 'chain:0', 'bound_rank': 0, 'native_focus_chain_ref': None, 'native_focus_rank': None,
        'inclusive_fill_exclusive_cut_supported': True, 'focus_initial_selection_supported': False, 'focus_boundary_rule': 'REFUSE', 'focus_delta': 0,
        'submitted_cost': 1, 'selection_cost': 3, 'mutation_cost': 4, 'quota_acceptance_supported': False}
    mechanical_case('mechanical:indexed:click', 'primitive', primitive)
    variants = [('no_target', {'bound_chain_ref': None, 'bound_rank': None}), ('missing_law', {'inclusive_fill_exclusive_cut_supported': False}),
        ('node_1', {'node_bound': 1}), ('domain_1', {'domain_bound': 1}), ('resume', {'resume_frontier': {'pending': True}}),
        ('wrong_signature', {'operation_ref': 'unrelated'}), ('quota_predicate', {'quota_acceptance_supported': True}),
        ('reset_missing', {'channel': 'RESET'}), ('reset', {'channel': 'RESET', 'reset_lengths': [0]*len(current)}),
        ('focus_missing', {'channel': 'FOCUS'}), ('focus_select', {'channel': 'FOCUS', 'focus_initial_selection_supported': True}),
        ('focus_refuse', {'channel': 'FOCUS', 'native_focus_chain_ref': 'chain:0', 'native_focus_rank': 0, 'focus_delta': -1}),
        ('focus_clamp', {'channel': 'FOCUS', 'native_focus_chain_ref': 'chain:0', 'native_focus_rank': 0, 'focus_delta': -1, 'focus_boundary_rule': 'CLAMP'}),
        ('focus_wrap', {'channel': 'FOCUS', 'native_focus_chain_ref': 'chain:0', 'native_focus_rank': 0, 'focus_delta': -1, 'focus_boundary_rule': 'WRAP'}),
        ('activate', {'channel': 'ACTIVATE', 'native_focus_chain_ref': 'chain:0', 'native_focus_rank': 0}),
        ('invalid_rank', {'bound_rank': 999}), ('unpaired_binding', {'bound_rank': None})]
    for name, patch in variants: mechanical_case('mechanical:indexed:' + name, 'primitive', {**copy.deepcopy(primitive), **patch})
    add('helper:step', 'step', {'geometry': s, 'lengths': current, 'chain': 0, 'rank': 0, 'observation': obs, 'model': model}, step(s, current, 0, 0, obs, model, time.perf_counter()+600))


def main():
    source_hashes()
    assert sha((ROOT / PROBE['generator']).read_bytes()) == PROBE['generatorSha256']
    public_cases(); controlled_cases(); mechanical_cases()
    result = {'schema': 'logos-engine.v6.rooted-quota-reference.v1', 'sourceCommit': COMMIT, 'sourceHashes': source_hashes(), 'policy': POLICY,
              'qualification': {'sourceModified': False, 'gameHostRunByExporter': False,
                  'realTrajectory': 'Separate unchanged original isolated component; no full-caller selection claim.',
                  'ownLayer': 'Own proposals, events and digest around separately retained original ancestor digest; absent ancestor producers are not treated as ported.',
                  'commonEnvelope': 'True ObservedCompositionConstraint with CombinedObservedCompositionMemory, fresh and advanced only by saved real public packets. This is family acquisition, not full caller selection.',
                  'controlledVariants': 'Public-raster and bounded mechanical contract cases; not live successes.',
                  'time': 'Source real deadlines remain active. Deterministic node/domain/depth interruption is compared; wall-time counts are not claimed equal.'},
              'scenes': SCENES, 'plans': PLANS, 'cases': CASES, 'commonEnvelopes': ENVELOPES,
              'originalPublicProbe': {'path': PROBE_PATH, 'sha256': sha((ROOT/PROBE_PATH).read_bytes()), 'actions': PROBE['actions'],
                                      'levelsCompleted': PROBE['levelsCompleted'], 'boundaries': PROBE['boundaries']},
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': sha(Path(__file__).read_bytes())}
    output = ROOT / 'tests/fixtures/v6-rooted-quota-reference.json.gz'
    output.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(output.relative_to(ROOT)), 'cases': len(CASES), 'scenes': len(SCENES),
                      'combinedEnvelopes': len(ENVELOPES), 'sourceFilesVerified': len(result['sourceHashes'])}), flush=True)


if __name__ == '__main__': main()
