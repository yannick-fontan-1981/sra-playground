#!/usr/bin/env python3
"""Unchanged V5/V6 Recolor contracts on synthetic public rasters only.

No game dispatch, game implementation, solution oracle, or campaign seed is
used. The four controlled returns exercise a component, not solved levels.
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
CACHE = tempfile.TemporaryDirectory(prefix='recolor-source-lookup-')
sys.pycache_prefix = CACHE.name
manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
for relative, item in manifest.items():
    assert hashlib.sha256((SOURCE / relative).read_bytes()).hexdigest() == item['sha256'], relative
print(json.dumps({'phase': 'original_manifest_verified', 'files': len(manifest)}), flush=True)
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from neutral_observer import measure as observe
from agents.yf_arc3_v6.morphology_policy.topological_recolor.family import TopologicalRecolor
from agents.yf_arc3_v6.morphology_policy.topological_recolor import geometry
from agents.yf_arc3_v5.capabilities.topological_region_recolor import RecolorRegion, _pockets, _components
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DWorkBudget, DComputationInterrupted


def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value


def paint(rows, box, value, ring=False):
    x0, y0, x1, y1 = box
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if not ring or x in (x0, x1) or y in (y0, y1): rows[y][x] = value


def raster(active=4):
    rows = [[0] * 40 for _ in range(30)]
    paint(rows, [0, 22, 39, 22], 7); paint(rows, [19, 0, 19, 21], 7)
    for x, value in [(4, 2), (12, 3), (20, 4)]:
        paint(rows, [x-1, 24, x+2, 27], 9 if value == active else 8)
        paint(rows, [x, 25, x+1, 26], value)
    paint(rows, [4, 4, 5, 6], 2); paint(rows, [10, 8, 14, 12], 3, True)
    paint(rows, [24, 4, 25, 6], 5); paint(rows, [30, 8, 34, 12], 6, True)
    return rows


def observation(rows, revision=1, epoch=1, actions=None):
    packet = SimpleNamespace(frame_rows=rows,
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16],
        level=epoch, levels_completed=epoch-1, state='NOT_FINISHED',
        available_action_refs=tuple(['ACTION6'] if actions is None else actions))
    return observe(packet, revision, 'recolor:synthetic')[0]


EXECUTED = Counter()
PROFILE_CODES = {}
SOURCE_PREFIX = str(SOURCE) + '/'
def profile(frame, event, arg):
    if event != 'call': return
    code = frame.f_code
    key = PROFILE_CODES.get(code)
    if key is None:
        filename = code.co_filename
        key = (filename[len(SOURCE_PREFIX):], code.co_firstlineno, code.co_qualname) if filename.startswith(SOURCE_PREFIX) else False
        PROFILE_CODES[code] = key
    if key is not False: EXECUTED[key] += 1


cases, measurements, policies, budgets = [], [], [], []
def capture(call):
    try: return {'value': plain(call())}
    except (ValueError, TypeError, KeyError, IndexError, AttributeError, DComputationInterrupted) as error:
        result = {'name': type(error).__name__, 'message': str(error)}
        if hasattr(error, 'cause'): result['cause'] = error.cause
        if hasattr(error, 'frontier'): result['frontier'] = plain(error.frontier)
        return {'error': result}


def family_case(name, operation, arguments, seed=None):
    owner = TopologicalRecolor()
    if seed is not None: owner.restore(copy.deepcopy(seed))
    item = {'id': name, 'operation': operation, 'arguments': plain(arguments), 'seedState': plain(owner.state())}
    args = copy.deepcopy(arguments)
    if operation == 'before': args[2] = SimpleNamespace(**args[2])
    method = {'proposeSource': 'propose', 'recordSource': 'record', 'revalidateSelection': 'revalidate_selection'}.get(operation, operation)
    item.update(capture(lambda: getattr(owner, method)(*args)))
    item['afterState'] = plain(owner.state()); cases.append(item); return item


def geometry_case(name, operation, arguments):
    method = {'selectionSupportSignature': 'selection_support_signature'}.get(operation, operation)
    item = {'id': name, 'operation': operation, 'arguments': plain(arguments),
            **capture(lambda: getattr(geometry, method)(*copy.deepcopy(arguments)))}
    measurements.append(item); return item


sys.setprofile(profile)
print(json.dumps({'phase': 'original_imports_ready'}), flush=True)
rows = raster(); initial = copy.deepcopy(rows); before = observation(rows)
measured = geometry_case('unique_public_palette_legend_field', 'measure', [rows, before])['value']
assert measured['mapping'] == {'0': 2, '1': 3} and len(measured['bodies']) == 2
print(json.dumps({'phase': 'positive_geometry_measured'}), flush=True)
geometry_case('source_component_order', 'components', [rows])
geometry_case('source_cropped_components', 'components', [rows, measured['legend']])
geometry_case('selection_support_signature', 'selectionSupportSignature', [measured])
for name, transformed in [('horizontal_mirror', [list(reversed(r)) for r in rows]),
                          ('vertical_mirror', list(reversed(rows))),
                          ('palette_bijection', [[(5*v+3) % 16 for v in r] for r in rows])]:
    assert geometry_case(name, 'measure', [transformed, observation(transformed)])['value'] is not None
    family_case(name + '_proposal', 'proposeSource', [observation(transformed), transformed, [], 16])
for name, altered in [('no_palette', [[0]*40 for _ in range(30)]), ('empty', []), ('empty_row', [[]])]:
    geometry_case(name, 'measure', [altered, before])
missing = copy.deepcopy(rows); paint(missing, [20, 25, 21, 26], 0)
assert geometry_case('fewer_than_three_wells', 'measure', [missing, observation(missing)])['value'] is None
duplicate = copy.deepcopy(rows); paint(duplicate, [20, 25, 21, 26], 3)
assert geometry_case('nonunique_well_pigments', 'measure', [duplicate, observation(duplicate)])['value'] is None
ambiguous = copy.deepcopy(rows); paint(ambiguous, [8, 3, 9, 4], 3)
assert geometry_case('conflicting_legend_class', 'measure', [ambiguous, observation(ambiguous)])['value'] is None
for body in measured['bodies']:
    geometry_case('complete_pocket_' + str(body['pocket_count']), 'pockets', [body, before['observation_ref']])
clipped = {'value': 5, 'bbox': [0, 1, 2, 3], 'cells': [[x, y] for x in range(3) for y in range(1, 4) if x in (0, 2) or y in (1, 3)]}
geometry_case('clipped_closed_visible_pocket', 'pockets', [clipped, 'controlled:clipped', [0, 0, 6, 6]])
opened = copy.deepcopy(clipped); opened['cells'].remove([1, 1])
geometry_case('open_visible_pocket', 'pockets', [opened, 'controlled:open', [0, 0, 6, 6]])

family_case('no_budget_still_scopes', 'proposeSource', [before, rows, [], 0])
family_case('missing_point_interface', 'proposeSource', [observation(rows, actions=['ACTION1']), rows, [], 16])
family_case('unrelated_picture_abstains', 'proposeSource', [observation(missing), missing, [], 16])
family_case('caller_inputs_do_not_supply_geometry', 'proposeSource', [before, rows, [{'action_ref': 'ACTION1', 'data': {}}], 16])
seed = None; sequence = []
for step in range(1, 5):
    before = observation(rows, step)
    proposal_case = family_case(f'step_{step}_proposal', 'proposeSource', [before, rows, [], 16], seed)
    proposal = proposal_case['value']; seed = proposal_case['afterState']; offer = proposal['recolor_plan']['offer']
    family_case(f'step_{step}_offers', 'offers', [before, rows], seed)
    admitted = family_case(f'step_{step}_before', 'before', [proposal, 0, {'frame_rows': rows}, before], seed)
    assert admitted['value']['admitted']
    later = copy.deepcopy(rows)
    if offer['mode'] == 'select_pigment':
        for well in offer['measurement']['wells']:
            x0, y0, x1, y1 = well['bbox']
            paint(later, [x0-1, y0-1, x1+1, y1+1], 9 if well['value'] == offer['body']['target'] else 8, True)
    else:
        for x, y in offer['body']['cells']: later[y][x] = offer['body']['target']
    after = observation(later, step + 1)
    comparison = family_case(f'step_{step}_after', 'after', [proposal, 0, before, after, rows, later], seed)['value']
    recorded = family_case(f'step_{step}_record', 'recordSource', [before, after, proposal['actions'][0], rows, later, proposal, 0], seed)
    assert comparison['preservation_matched'] and recorded['value']['status'] in ('selection_observed', 'write_effect_observed')
    sequence.append({'rows': copy.deepcopy(rows), 'afterRows': later, 'observation': before, 'afterObservation': after,
        'seedState': proposal_case['seedState'], 'proposalState': seed, 'proposal': proposal,
        'before': admitted['value'], 'after': comparison, 'record': recorded['value'], 'afterState': recorded['afterState']})
    seed = recorded['afterState']; rows = later
assert [s['proposal']['recolor_plan']['offer']['mode'] for s in sequence] == ['select_pigment', 'paint_region', 'select_pigment', 'paint_region']
assert sequence[-1]['proposal']['actions'][0]['data'] == {'x': 30, 'y': 8}
print(json.dumps({'phase': 'four_step_source_sequence_complete'}), flush=True)
assert family_case('all_shell_targets_match', 'proposeSource', [observation(rows, 5), rows, [], 16], seed)['value'] is None
assert geometry_case('completed_symmetric_partitions_need_actual_write', 'measure', [rows, observation(rows, 5)])['value'] is None
assert geometry_case('actual_local_write_disambiguates_partition', 'measure', [rows, observation(rows, 5), seed['writes']])['value'] is not None
for name, mutate in [('foreign_epoch', lambda r: r.update(source_epoch=2)), ('outside_write', lambda r: r.update(outside_count=1)),
                     ('missing_evidence', lambda r: r.update(evidence=[])), ('wrong_pigment', lambda r: r.update(only_target_pigment=False)),
                     ('outside_mask', lambda r: r.update(changed_mask=[[0, 0]])), ('foreign_binding', lambda r: r.update(partition_binding={}))]:
    receipts = copy.deepcopy(seed['writes'])
    for receipt in receipts: mutate(receipt)
    assert geometry_case('partition_receipt_' + name, 'measure', [rows, observation(rows, 5), receipts])['value'] is None

first = sequence[0]; proposal = first['proposal']; before = first['observation']; first_rows = first['rows']; scoped = first['proposalState']
family_case('exact_bind', 'bind', [proposal, None], scoped)
wrong = copy.deepcopy(proposal); wrong['actions'][0]['data']['x'] += 1
family_case('changed_action_step_mismatch', 'bind', [wrong, None], scoped)
wrong['steps'][0]['action'] = copy.deepcopy(wrong['actions'][0])
family_case('consistent_but_wrong_point_refused', 'before', [wrong, 0, {'frame_rows': first_rows}, before], scoped)
for field, value in [('observation_ref', 'foreign'), ('level_epoch', 2), ('frame_hash', 'changed')]:
    family_case('stale_' + field, 'before', [proposal, 0, {'frame_rows': first_rows}, {**before, field: value}], scoped)
family_case('wrong_prefix_index', 'before', [proposal, 1, {'frame_rows': first_rows}, before], scoped)
family_case('missing_action_at_guard', 'before', [proposal, 0, {'frame_rows': first_rows}, {**before, 'available_action_refs': []}], scoped)
family_case('changed_topology_at_guard', 'before', [proposal, 0, {'frame_rows': missing}, before], scoped)
family_case('no_effect_is_only_attempt', 'recordSource', [before, observation(first_rows, 2), proposal['actions'][0], first_rows, first_rows, proposal, 0], scoped)
foreign = copy.deepcopy(first['afterRows']); foreign[1][1] = 10
family_case('selection_with_foreign_effect_not_acquired', 'recordSource', [before, observation(foreign, 2), proposal['actions'][0], first_rows, foreign, proposal, 0], scoped)
family_case('foreign_proposal_not_acquired', 'recordSource', [before, first['afterObservation'], proposal['actions'][0], first_rows, first['afterRows'], None, 0], scoped)
paint_step = sequence[1]; foreign = copy.deepcopy(paint_step['afterRows']); foreign[1][1] = 10
family_case('write_outside_support_retains_refutation', 'recordSource', [paint_step['observation'], observation(foreign, 3),
    paint_step['proposal']['actions'][0], paint_step['rows'], foreign, paint_step['proposal'], 0], paint_step['proposalState'])
boundary = family_case('official_boundary_retains_hypotheses_only', 'recordSource', [sequence[-1]['afterObservation'], observation(rows, 6, 2),
    proposal['actions'][0], rows, rows, proposal, 0], seed)
assert len(boundary['afterState']['portable']) == 1 and not boundary['afterState']['selection'] and not boundary['afterState']['writes']
family_case('portable_current_method_is_revalidated', 'proposeSource', [observation(initial, 7, 2), initial, [], 16], boundary['afterState'])
family_case('partial_restore_preserves_other_fields', 'restore', [{'last': None, 'unrelated': 'ignored'}], seed)
family_case('same_scope_keeps_current_evidence', 'scope', [observation(rows, 8)], seed)
family_case('scope_without_effect_does_not_fabricate_portable', 'scope', [observation(rows, 9, 2)], scoped)
for name, mutated in [('wrong_method_signature', {'method_signature': {}}), ('missing_two_observations', {'evidence': []}),
                      ('other_action', {'action_ref': 'ACTION1'})]:
    invalid = copy.deepcopy(sequence[0]['afterState']); invalid['selection'][0].update(mutated)
    family_case('selection_' + name, 'revalidateSelection', [geometry.measure(first['afterRows'], first['afterObservation']), first['afterObservation']], invalid)

policy = TopologicalRecolor().policy
for relation in ['shell', 'surround', 'unknown']:
    for supported in [False, True]:
        for match in [False, True]:
            offers = [{'mode': 'select_pigment', 'facts': {'target_differs': True, 'selection_needed': True,
                'selection_method_supported': supported, 'relation_kind': relation, 'shells_currently_match': match}},
                {'mode': 'paint_region', 'facts': {'target_differs': True, 'selection_needed': False,
                'selection_method_supported': supported, 'relation_kind': relation, 'shells_currently_match': match}}]
            policies.append({'id': f'{relation}:{supported}:{match}', 'offers': offers, 'select': plain(policy.select(offers)), 'choose': plain(policy.choose(offers))})
policies.append({'id': 'empty', 'offers': [], 'select': plain(policy.select([])), 'choose': plain(policy.choose([]))})

region = {'region_ref': 'controlled:ring', 'support': [(y, x) for x, y in clipped['cells']], 'evidence_ref': 'controlled:source',
          'clipped': False, 'boundary_complete': True}
for name, bounds in [('normal', (50000, 1000, 20000)), ('node_interrupt', (2, 1000, 20000)),
                     ('domain_interrupt', (50000, 1000, 4)), ('time_interrupt', (50000, 0, 20000))]:
    request = dict(zip(('node_bound', 'time_bound_ms', 'domain_bound'), bounds)); budget = DWorkBudget(SimpleNamespace(**request))
    budgets.append({'id': name, 'operation': 'enclosedPockets', 'region': plain(region), 'connectivity': 4,
        'request': request, **capture(lambda: _pockets(RecolorRegion(**region), 4, budget)), 'examined': budget.examined})
for connectivity in [4, 8]:
    points = [(0, 0), (1, 1), (3, 3), (3, 4)]; request = {'node_bound': 50000, 'time_bound_ms': 1000, 'domain_bound': 20000}
    budget = DWorkBudget(SimpleNamespace(**request))
    budgets.append({'id': 'digital_connectivity_' + str(connectivity), 'operation': 'pocketComponents', 'points': points,
        'connectivity': connectivity, 'request': request, **capture(lambda: _components(set(points), connectivity, budget)), 'examined': budget.examined})

sys.setprofile(None)
paths = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module, '__file__', None)
         and Path(module.__file__).resolve().is_relative_to(SOURCE)}
paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/topological_recolor').glob('*.drm'))
paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/topological_recolor').glob('*.src'))
for path in paths:
    assert path.relative_to(SOURCE).as_posix() in manifest
    assert hashlib.sha256(path.read_bytes()).hexdigest() == manifest[path.relative_to(SOURCE).as_posix()]['sha256']
payload = {'schema': 'logos-engine.v6.topological-recolor-reference.v1', 'referenceCommit': COMMIT,
    'qualification': 'Unchanged original Python on synthetic public rasters and explicit component state. No game dispatch or solved-level claim.',
    'sourceHashes': {p.relative_to(SOURCE).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)},
    'executedSourceFunctions': [{'path': p, 'line': line, 'function': fn, 'calls': count} for (p, line, fn), count in sorted(EXECUTED.items())],
    'geometryCases': measurements, 'cases': cases, 'policyCases': policies, 'budgetCases': budgets,
    'kernelControlled': {'qualification': 'Cold component on controlled raster returns only, never a live campaign seed.', **plain(sequence[0]), 'sequence': plain(sequence)}}
out = ROOT / 'tests/fixtures/v6-topological-recolor-reference.json.gz'
out.write_bytes(gzip.compress((json.dumps(payload, separators=(',', ':'), ensure_ascii=False)+'\n').encode(), mtime=0))
print(json.dumps({'path': out.relative_to(ROOT).as_posix(), 'familyCases': len(cases), 'geometryCases': len(measurements),
    'policyCases': len(policies), 'budgetCases': len(budgets), 'sha256': hashlib.sha256(out.read_bytes()).hexdigest()}))
