#!/usr/bin/env python3
"""Independent unchanged-Python component contracts; no game host is opened.

Synthetic rasters, scopes and acquired-component fixtures exercise contracts.
They never initialize a delivered campaign or count as a completed game level.
"""
from __future__ import annotations
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
CACHE = tempfile.TemporaryDirectory(prefix='reactive-source-lookup-')
sys.pycache_prefix = CACHE.name
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from neutral_observer import measure
from agents.yf_arc3_v6.morphology_policy.reactive_contact.family import ReactiveContact
from agents.yf_arc3_v6.morphology_policy.reactive_contact import geometry, parent_return, escape_domain, stationary_return
from agents.yf_arc3_v5.capabilities.escape_topology import EscapeTopologyDomain, measure_escape_topology

def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value

def capture(callback):
    try: return {'value': plain(callback())}
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
        return {'error': {'name': type(error).__name__, 'message': str(error)}}

def raster(body=(9, 5), peer=(17, 13), part=(9, 9), palette=(0, 2, 3, 4)):
    rows = [[palette[0]] * 24 for _ in range(20)]
    for (left, top), color in zip([body, peer, part], palette[1:]):
        for y in range(top, top + 2):
            for x in range(left, left + 2): rows[y][x] = color
    return rows

def observation(rows, revision=1, epoch=1, available=None):
    packet = SimpleNamespace(frame_rows=rows,
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16],
        level=epoch, levels_completed=epoch - 1, state='NOT_FINISHED',
        available_action_refs=tuple(available or ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5']))
    return measure(packet, revision, 'reactive:synthetic')[0]

cases = []
def add(name, operation, arguments, callback, seed=None):
    row = {'id': name, 'operation': operation, 'arguments': plain(arguments), **capture(callback)}
    if seed is not None: row['seedState'] = plain(seed)
    cases.append(row)
    return row.get('value')

def family_case(name, operation, arguments, seed=None):
    family = ReactiveContact()
    if seed is not None: family.restore(copy.deepcopy(seed))
    initial = family.state()
    methods = {'recordSource': family.record, 'propose': family.propose, 'before': family.before,
               'after': family.after, 'scope': family.scope, 'current': family.current, 'offers': family.offers}
    row = {'id': name, 'operation': operation, 'arguments': plain(arguments), 'seedState': plain(initial),
           **capture(lambda: methods[operation](*copy.deepcopy(arguments)))}
    row['afterState'] = plain(family.state()); cases.append(row)
    return row

# A real calculator input sequence of synthetic public observations. No future
# state, control law or role is supplied to the initially empty source owner.
before_rows = raster((5, 5), (13, 5), (9, 9))
rows = raster((9, 5), (13, 13), (9, 9))
before, current = observation(before_rows), observation(rows, 2)
acquisition = family_case('passive_unique_axial_acquisition', 'recordSource',
    [before, current, {'action_ref': 'ACTION4'}, before_rows, rows])
acquired = acquisition['afterState']
family_case('unchanged_foreign_input', 'recordSource', [current, observation(rows, 3), {'action_ref': 'ACTION5'}, rows, rows], acquired)
family_case('natural_epoch_clears_state', 'recordSource', [current, observation(rows, 3, 2), {'action_ref': 'ACTION4'}, rows, rows], acquired)
family_case('foreign_command_data_retained', 'recordSource', [current, observation(rows, 3), {'action_ref': 'ACTION6', 'data': {'x': 7, 'y': 8}}, rows, rows], acquired)
for label, later in [('contradiction', raster((5, 5), (13, 13), (9, 9))), ('independent_peer', raster((9, 5), (17, 13), (9, 9)))]:
    family_case(label, 'recordSource', [current, observation(later, 3), {'action_ref': 'ACTION4'}, rows, later], acquired)
family_case('source81_initial_proposal', 'propose', [current, rows, [], 16], acquired)
family_case('current_source_scene', 'current', [current, rows], acquired)

probe = ReactiveContact(); probe.restore(copy.deepcopy(acquired))
body = geometry.unique(current)[probe.control['signature']]
member = next(e for e in current['entities'] if e['palette_value'] == 4)
# A controlled source-state contract isolates the existing post-operator branch.
# The actual state under test explicitly remains synthetic, not a game result.
probe.pending = {'epoch': 1, 'control_signature': body['signature'], 'subject_box': member['bbox'],
    'subject_value': member['palette_value'], 'evidence': ['synthetic:operator:before', current['observation_ref']],
    'before_shape': copy.deepcopy(member), 'operator': 'ACTION5'}
assert probe.question is not None, 'Synthetic measurements should retain the actual source parent'
pending = probe.state()
offered = family_case('pending_nonpushing_offers', 'offers', [current, rows, 16], pending)
proposed = family_case('pending_nonpushing_proposal', 'propose', [current, rows, [], 16], pending)
proposal = proposed.get('value')
assert proposal and proposal['reactive_plan']['offer']['kind'] == 'binding_followup'

for label, available, epoch, changed_rows in [
    ('current', current['available_action_refs'], 1, rows),
    ('missing_input', [a for a in current['available_action_refs'] if a != proposal['actions'][0]['action_ref']], 1, rows),
    ('changed_epoch', current['available_action_refs'], 2, rows),
    ('changed_subject', current['available_action_refs'], 1, raster((9, 5), (13, 13), (5, 9))),
]:
    obs = current if label == 'current' else observation(changed_rows, 2, epoch, available)
    family = ReactiveContact(); family.restore(copy.deepcopy(pending))
    add('before_' + label, 'before', [proposal, 0, {'frame_rows': changed_rows}, obs],
        lambda family=family, obs=obs, changed_rows=changed_rows: family.before(copy.deepcopy(proposal), 0, SimpleNamespace(frame_rows=changed_rows), obs), pending)

delta = probe.policy.config['direction_prior'][proposal['actions'][0]['action_ref']]
delta = [v * 4 for v in delta]
next_body = tuple(body['bbox'][i] + delta[i] for i in (0, 1))
next_part = tuple(member['bbox'][i] + delta[i] for i in (0, 1))
for label, next_rows in [('common_translation', raster(next_body, (13, 13), next_part)),
                         ('body_only', raster(next_body, (13, 13), (9, 9))), ('no_change', rows)]:
    later = observation(next_rows, 3)
    family_case('after_' + label, 'after', [proposal, 0, current, later, rows, next_rows], pending)
    family_case('record_' + label, 'recordSource', [current, later, proposal['actions'][0], rows, next_rows, proposal, 0], pending)

scope_copy = copy.deepcopy(pending)
family_case('same_epoch_scope_preserves', 'scope', [current], scope_copy)
family_case('new_epoch_scope_clears', 'scope', [observation(rows, 3, 2)], scope_copy)

# Exact finite-topology calculation, including incomplete/unknown domains.
for idx, availability in enumerate(['free', 'blocked', 'unknown']):
    for complete in [False, True]:
        domain = {'model_ref': 'synthetic:topology', 'actor_ref': 'synthetic:peer', 'current_node_ref': 'a',
            'node_refs': ['a', 'b', 'c'], 'region_node_refs': ['a', 'b'], 'occupancy_scope': 'current_occupancy',
            'complete_successor_node_refs': ['a', 'b'] if complete else [], 'completeness_evidence_refs': ['observed:domain'] if complete else [],
            'transitions': [{'origin_ref': 'a', 'destination_ref': 'a', 'availability': 'free', 'evidence_refs': ['observed:stay']},
                {'origin_ref': 'a', 'destination_ref': 'b', 'availability': availability, 'evidence_refs': ['observed:edge']},
                {'origin_ref': 'b', 'destination_ref': 'c', 'availability': 'free', 'evidence_refs': ['observed:boundary']}]}
        def topology(domain=domain):
            class Budget:
                def __init__(self): self.count = 0
                def visit(self, _value): self.count += 1
            budget = Budget(); measured = measure_escape_topology(EscapeTopologyDomain(**domain), budget)
            return {'measurement': plain(measured), 'evaluations': budget.count}
        add('topology_%s_%s' % (availability, complete), 'topology', [domain], topology)

probe.restore(copy.deepcopy(pending)); scene = probe.current(current, rows)
recipe = {'status': 'observed_nonpushing_common_translation', 'scope': 1, 'evidence': ['observed:common-translation'],
    'subject_box': member['bbox'], 'subject_value': member['palette_value'], 'offset': [0, 4],
    'operator_action_ref': 'ACTION5', 'operator_observation_refs': ['observed:operator'], 'method_claim_refs': ['observed:method']}
for label, modified in [('current', recipe), ('missing', None), ('stale', {**recipe, 'scope': 2}),
                        ('wrong_offset', {**recipe, 'offset': [4, 0]}), ('missing_evidence', {**recipe, 'evidence': []})]:
    add('escape_' + label, 'escape.project', [scene, modified, current['observation_ref'], 1],
        lambda modified=modified: escape_domain.project(copy.deepcopy(scene), copy.deepcopy(modified), current['observation_ref'], 1))
    add('parent_' + label, 'parent.offers', [scene, probe.question, modified, probe.policy.config['direction_prior'], 16, current['observation_ref'], 1],
        lambda modified=modified: parent_return.offers(copy.deepcopy(scene), copy.deepcopy(probe.question), copy.deepcopy(modified), probe.policy.config['direction_prior'], 16, current['observation_ref'], 1))

parent_offers, _ = parent_return.offers(copy.deepcopy(scene), copy.deepcopy(probe.question), recipe,
    probe.policy.config['direction_prior'], 16, current['observation_ref'], 1)
if parent_offers:
    offer = parent_offers[0]
    for label, epoch in [('current', 1), ('stale', 2)]:
        add('parent_guard_' + label, 'parent.validate_current', [scene, offer, 0, epoch],
            lambda epoch=epoch: parent_return.validate_current(scene, offer, 0, epoch))
    returned = copy.deepcopy(scene); returned['body']['bbox'] = offer['expected'][0]
    for e in returned['stones']:
        if e['signature'] == member['signature']: e['bbox'] = offer['expected_subjects'][0]
    returned['current_entities'] = []
    add('parent_reconcile_exact', 'parent.reconcile', [probe.question, recipe, offer, 0, returned, 'synthetic:parent:return', 1],
        lambda: parent_return.reconcile(probe.question, recipe, offer, 0, returned, 'synthetic:parent:return', 1))

selected_row = {'candidate_ref': 'synthetic:stationary:geometry', 'actor_component_ref': 'geometry:actor',
    'peer_component_ref': 'geometry:peer', 'part_component_ref': 'geometry:part', 'part_entity_ref': member['id'],
    'access_distance': 0, 'grip_root': [2, 1], 'peer_cell': [3, 3], 'part_cells': [[2, 2]],
    'independent_terminal': True, 'stationary_part_neighbor_loss': 1, 'joint_terminal_reachable': False,
    'peer_exit_count_after_independent_actor': 0, 'future_part_cells': [[2, 2]]}
binding = {'observation_ref': current['observation_ref'], 'epoch': 1, 'actor_ref': 'geometry:actor',
    'peer_ref': 'geometry:peer', 'part_ref': 'geometry:part', 'part_entity_ref': member['id']}
prepared = add('stationary_retain', 'stationary.retain_selected',
    [scene, probe.question, recipe, selected_row, member, current['observation_ref'], 1, 'synthetic:selected', None, {'binding': binding}],
    lambda: stationary_return.retain_selected(scene, probe.question, recipe, selected_row, member,
        current['observation_ref'], 1, 'synthetic:selected', binding=binding))
assert prepared
for label, argument in [('current', prepared), ('absent', None), ('empty', {})]:
    add('stationary_facts_' + label, 'stationary.facts', [argument], lambda argument=argument: stationary_return.facts(argument))
add('stationary_binding', 'stationary.current_binding', [prepared, current], lambda: stationary_return.current_binding(prepared, current))
inverse = add('stationary_inverse', 'stationary.record_inverse', [prepared, current, observation(rows, 3), {'action_ref': 'ACTION5'}],
    lambda: stationary_return.record_inverse(prepared, current, observation(rows, 3), {'action_ref': 'ACTION5'}))
recolor_rows = raster((9, 5), (13, 13), (9, 9), palette=(0, 2, 3, 7))
add('stationary_inverse_recolor_is_not_detachment', 'stationary.record_inverse', [prepared, current, observation(recolor_rows, 3), {'action_ref': 'ACTION5'}],
    lambda: stationary_return.record_inverse(prepared, current, observation(recolor_rows, 3), {'action_ref': 'ACTION5'}))
for label, next_rows in [('independent', raster((5, 5), (13, 13), (9, 9))),
                        ('still_bound', raster((5, 5), (13, 13), (5, 9))), ('no_motion', rows)]:
    args = [inverse, observation(rows, 3), observation(next_rows, 4), {'action_ref': 'ACTION3'}, [5, 5, 6, 6]]
    add('stationary_' + label, 'stationary.record_independent', args, lambda args=args: stationary_return.record_independent(*args))
loaded = copy.deepcopy(prepared); loaded['phase'] = 'loaded_preparation_access'
next_rows = raster((5, 5), (13, 13), (5, 9))
for at_target in [False, True]:
    args = [loaded, current, observation(next_rows, 3), {'action_ref': 'ACTION3'}, [5, 5, 6, 6], [5, 9, 6, 10]]
    add('stationary_loaded_' + str(at_target), 'stationary.record_loaded', args + [{'at_target': at_target}],
        lambda args=args, at_target=at_target: stationary_return.record_loaded(*args, at_target=at_target))

# The native kernel's first current observation has revision1. Independently
# execute this scoped synthetic component at that same revision rather than
# relabeling retained observation references or hashed source identifiers.
kernel_before, kernel_current = observation(before_rows, 0), observation(rows, 1)
kernel = ReactiveContact(); kernel.record(kernel_before, kernel_current, {'action_ref': 'ACTION4'}, before_rows, rows)
kernel_member = next(e for e in kernel_current['entities'] if e['palette_value'] == 4)
kernel.pending = {'epoch': 1, 'control_signature': kernel.control['signature'], 'subject_box': kernel_member['bbox'],
    'subject_value': kernel_member['palette_value'], 'evidence': ['synthetic:operator:before', kernel_current['observation_ref']],
    'before_shape': copy.deepcopy(kernel_member), 'operator': 'ACTION5'}
kernel_seed = kernel.state(); kernel_proposal = kernel.propose(kernel_current, rows, [], 16)
kernel_guard = kernel.before(kernel_proposal, 0, SimpleNamespace(frame_rows=rows), kernel_current)
kernel_after = observation(rows, 2)
kernel_outcome = kernel.after(kernel_proposal, 0, kernel_current, kernel_after, rows, rows)
kernel_record = kernel.record(kernel_current, kernel_after, kernel_proposal['actions'][0], rows, rows, kernel_proposal, 0)
kernel_controlled = {'qualification': 'Explicitly synthetic scoped post-operator component state and current guard, used only to isolate common-kernel contracts. Never a cold campaign seed.',
    'seedState': plain(kernel_seed), 'rows': rows, 'observation': plain(kernel_current), 'proposal': plain(kernel_proposal),
    'beforeGuard': plain(kernel_guard), 'afterObservation': plain(kernel_after), 'afterOutcome': plain(kernel_outcome),
    'record': plain(kernel_record), 'afterState': plain(kernel.state())}

manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
sources = {}
for module in list(sys.modules.values()):
    filename = getattr(module, '__file__', None)
    if not filename: continue
    path = Path(filename).resolve()
    if path.is_relative_to(SOURCE) and path.is_file():
        name = path.relative_to(SOURCE).as_posix(); actual = hashlib.sha256(path.read_bytes()).hexdigest()
        assert manifest[name]['sha256'] == actual, name
        sources[name] = actual
result = {'schema': 'logos-engine.v6.reactive-contact-family-reference.v1', 'referenceCommit': COMMIT,
    'qualification': 'Unchanged original Python source component contracts on explicitly synthetic public rasters and synthetic scoped state. No game dispatch, hidden engine, level solution, cold campaign seed or native-produced expected value.',
    'sourceHashes': dict(sorted(sources.items())), 'cases': cases, 'kernelControlled': kernel_controlled,
    'continuationPolicy': json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']['reactive_contact_continuation']}
output = ROOT / 'tests/fixtures/v6-reactive-contact-family-reference.json.gz'
# Preserve mapping insertion order: escape_domain deliberately enumerates the
# supplied tile inventory in that order, so sorted fixture input would replay
# a different contract even if its mapping equality were unchanged.
output.write_bytes(gzip.compress(json.dumps(result, separators=(',', ':'), allow_nan=False).encode(), mtime=0))
print(json.dumps({'cases': len(cases), 'bytes': output.stat().st_size, 'path': str(output.relative_to(ROOT)),
    'operations': sorted(set(row['operation'] for row in cases)), 'errors': [row['id'] for row in cases if 'error' in row]}))
