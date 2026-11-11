#!/usr/bin/env python3
"""Pinned, unmodified AxialQuestion Python oracle on controlled public rasters.

Every effect below is a deliberately synthetic return. No game engine is
opened, no game action is dispatched, and no solved level is asserted. The
source's permissive same-geometry boundary behavior is retained as a separate
reference case; the native caller's stricter frame attribution is not hidden
inside this oracle.
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
CACHE = tempfile.TemporaryDirectory(prefix='axial-original-')
sys.pycache_prefix = CACHE.name
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']


def verify_sources():
    for name, record in MANIFEST.items():
        assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == record['sha256'], name


verify_sources()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from neutral_observer import measure as observe
from agents.yf_arc3_v6.morphology_policy.axial_question.family import AxialQuestion
from agents.yf_arc3_v6.morphology_policy.axial_question import geometry
from agents.yf_arc3_v6.morphology_policy.axial_question.policy import AxialPolicy
from agents.yf_arc3_v5.capabilities.axial_field_configuration import AxialPrerequisite
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DComputationInterrupted


def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value


EXECUTED = Counter()
SOURCE_PREFIX = str(SOURCE) + '/'


def profile(frame, event, arg):
    if event == 'call' and frame.f_code.co_filename.startswith(SOURCE_PREFIX):
        EXECUTED[(frame.f_code.co_filename[len(SOURCE_PREFIX):],
                  frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1


def capture(call):
    try: return {'value': plain(call())}
    except (ValueError, TypeError, KeyError, IndexError, AttributeError,
            AxialPrerequisite, DComputationInterrupted) as error:
        return {'error': {'name': type(error).__name__, 'message': str(error)}}


def box(rows, left, top, right, bottom, value, perimeter=False):
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            if not perimeter or x in (left, right) or y in (top, bottom): rows[y][x] = value


def body(rows, center, axis, selected=False, n=5):
    x, y = center; half = n // 2
    box(rows, x-half, y-half, x+half, y+half, 8)
    box(rows, x-half+1, y-half+1, x+half-1, y+half-1, 3)
    if axis[0]:
        positive, negative = (y-half, y+half) if axis[0] == -1 else (y+half, y-half)
        box(rows, x-half, positive, x+half, positive, 1)
        box(rows, x-half, negative, x+half, negative, 2)
    else:
        positive, negative = (x-half, x+half) if axis[1] == -1 else (x+half, x-half)
        box(rows, positive, y-half, positive, y+half, 1)
        box(rows, negative, y-half, negative, y+half, 2)
    rows[y][x] = 7 if selected else 3


def raster(selected=False, axis=(-1, 0), n=5, peer_count=1, target=None):
    rows = [[0] * (7*n+1) for _ in range(6*n+1)]; half = n // 2
    for y in range(n, 6*n, n):
        for x in range(n, 7*n, n): box(rows, x-half+1, y-half+1, x+half-1, y+half-1, 3)
    body(rows, (2*n, 3*n), axis, selected, n)
    body(rows, (6*n, 3*n), (0, 1), False, n)
    if peer_count == 2: body(rows, (5*n, 3*n), (0, 1), False, n)
    x, y = target if target is not None else (4*n, 3*n)
    box(rows, x-half, y-half, x+half, y+half, 9, True); rows[y][x] = 9
    return rows


def observation(rows, revision=1, epoch=1, actions=None):
    packet = SimpleNamespace(frame_rows=rows,
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16],
        level=epoch, levels_completed=epoch-1, state='NOT_FINISHED',
        available_action_refs=tuple(['ACTION3', 'ACTION4', 'ACTION6'] if actions is None else actions))
    return observe(packet, revision, 'axial:synthetic')[0]


CASES, GEOMETRY, POLICIES = [], [], []


def family_case(name, operation, arguments, seed=None):
    owner = AxialQuestion()
    if seed is not None: owner.restore(copy.deepcopy(seed))
    row = {'id': name, 'operation': operation, 'arguments': plain(arguments), 'seedState': plain(owner.state())}
    args = copy.deepcopy(arguments)
    if operation == 'before': args[2] = SimpleNamespace(**args[2])
    method = {'proposeSource': 'propose', 'recordSource': 'record', 'methodSignature': 'method_signature'}.get(operation, operation)
    row.update(capture(lambda: getattr(owner, method)(*args)))
    row['afterState'] = plain(owner.state()); CASES.append(row); return row


def geometry_case(name, operation, arguments):
    method = {'projectedTurns': 'projected_turns', 'barSegments': 'bar_segments'}.get(operation, operation)
    row = {'id': name, 'operation': operation, 'arguments': plain(arguments),
           **capture(lambda: getattr(geometry, method)(*copy.deepcopy(arguments)))}
    GEOMETRY.append(row); return row


sys.setprofile(profile)
initial, selected = raster(), raster(True)
obs0, obs1 = observation(initial), observation(selected, 2)
measured = geometry_case('unselected_anchor_grid', 'measure', [initial])['value']
selected_measure = geometry_case('one_distinct_selected_marker', 'measure', [selected])['value']
assert measured and len(measured['bodies']) == 2 and measured['selected'] is None
assert selected_measure['selected']['center'] == [10, 15]
cycle = AxialPolicy().config['cycle']

for name, rows in [
    ('empty', []), ('empty_row', [[]]), ('absent_bodies', [[0]*36 for _ in range(31)]),
    ('horizontal_mirror', [list(reversed(row)) for row in selected]),
    ('vertical_mirror', list(reversed(selected))),
    ('palette_bijection', [[(5*v+3) % 16 for v in row] for row in selected]),
    ('translated', [[0]*40 for _ in range(2)] + [[0, 0]+row+[0, 0] for row in selected] + [[0]*40 for _ in range(2)]),
]: geometry_case(name, 'measure', [rows])
for n in (3, 7, 9): geometry_case('quantum_' + str(n), 'measure', [raster(True, n=n)])
for axis in cycle:
    rows = raster(True, axis)
    m = geometry_case('orientation_' + str(axis), 'measure', [rows])['value']
    geometry_case('pivot_projection_' + str(axis), 'projectedTurns', [m, m['selected'], cycle])
    geometry_case('relations_' + str(axis), 'relations', [m, m['selected']])
ambiguous = copy.deepcopy(selected); ambiguous[15][30] = 7
geometry_case('multiple_selected_markers', 'measure', [ambiguous])
missing_target = copy.deepcopy(selected); box(missing_target, 18, 13, 22, 17, 0)
geometry_case('missing_unique_target', 'measure', [missing_target])
duplicate_target = copy.deepcopy(selected); box(duplicate_target, 18, 18, 22, 22, 9, True); duplicate_target[20][20] = 9
geometry_case('two_target_markers', 'measure', [duplicate_target])
mixed = copy.deepcopy(selected); mixed[14][29] = 4
geometry_case('nonuniform_body_core', 'measure', [mixed])
geometry_case('connected_bars_source_order', 'barSegments', [
    [{'value': 1, 'bbox': [1, 1, 5, 1], 'cells': [[x, 1] for x in range(1, 6)]},
     {'value': 2, 'bbox': [8, 1, 12, 5], 'cells': [[x, 1] for x in range(8, 13)] + [[12, y] for y in range(2, 6)]}]])
geometry_case('canonical_digest_nested_order', 'digest', [{'z': [3, 2, 1], 'a': {'q': False, 'p': None}}])

# Pure relation cases exercise dependencies without claiming a raster model.
for label, target, peer, peer_axis, extra in [
    ('outside_before_pair', [5, 15], [30, 15], [0, 1], []),
    ('outside_after_pair', [35, 15], [30, 15], [0, -1], []),
    ('column_between', [10, 20], [10, 25], [1, 0], []),
    ('peer_axis_not_aligned', [20, 15], [30, 15], [-1, 0], []),
    ('peer_off_axis', [20, 15], [30, 20], [0, 1], []),
    ('transverse_dependency', [20, 20], [30, 15], [0, 1], [[20, 25]]),
    ('transverse_without_dependency', [20, 20], [30, 15], [0, 1], []),
    ('target_at_actor_is_outside', [10, 15], [30, 15], [0, 1], []),
]:
    m = copy.deepcopy(selected_measure); actor = m['bodies'][0]
    actor = next(b for b in m['bodies'] if b['center'] == [10, 15])
    other = next(b for b in m['bodies'] if b['center'] != [10, 15]); other['center'], other['axis'] = peer, peer_axis
    m['target']['center'] = target
    for position in extra: m['bodies'].append({**copy.deepcopy(other), 'center': position})
    geometry_case(label, 'relations', [m, actor])

family_case('cold_unselected_abstention', 'proposeSource', [obs0, initial, [], 8])
family_case('visible_selection_without_acquisition_abstains', 'proposeSource', [obs1, selected, [], 8])
family_case('zero_budget_scopes_without_offer', 'proposeSource', [obs0, initial, [], 0])
select_command = {'action_ref': 'ACTION6', 'data': {'x': 10, 'y': 15}}
passive = family_case('cold_passive_single_marker_acquisition', 'recordSource', [obs0, obs1, select_command, initial, selected])
acquired = passive['afterState']; assert acquired['selection'] and not acquired['rotations']
proposal_row = family_case('acquired_selection_invokes_real_src', 'proposeSource', [obs1, selected, [], 8], acquired)
proposal = proposal_row['value']; assert proposal['actions'] == [{'action_ref': 'ACTION4'}]
family_case('acquired_offers_keep_both_controls_in_source_order', 'offers', [obs1, selected], acquired)
family_case('method_signature_contract', 'methodSignature', [selected_measure])
family_case('current_single_action_binding', 'bind', [proposal, None], acquired)
family_case('current_before_guard', 'before', [proposal, 0, {'frame_rows': selected}, obs1], acquired)
family_case('after_does_not_assume_rotation_or_goal', 'after', [proposal, 0, obs1, observation(selected, 3), selected, selected], acquired)
for field, value in [('observation_ref', 'foreign'), ('level_epoch', 2), ('frame_hash', 'foreign')]:
    family_case('before_stale_' + field, 'before', [proposal, 0, {'frame_rows': selected}, {**obs1, field: value}], acquired)
family_case('before_wrong_step_index', 'before', [proposal, 1, {'frame_rows': selected}, obs1], acquired)
family_case('before_absent_available_control', 'before', [proposal, 0, {'frame_rows': selected}, {**obs1, 'available_action_refs': ['ACTION6']}], acquired)
family_case('before_scene_measurement_changed', 'before', [proposal, 0, {'frame_rows': raster(True, (1, 0))}, obs1], acquired)
family_case('before_marker_ambiguous', 'before', [proposal, 0, {'frame_rows': ambiguous}, obs1], acquired)
changed = copy.deepcopy(proposal); changed['steps'][0]['action'] = {'action_ref': 'ACTION3'}
family_case('binding_rejects_changed_action_step', 'bind', [changed, None], acquired)
changed = copy.deepcopy(proposal); changed['actions'] = []; changed['steps'] = []
family_case('binding_rejects_empty_prefix', 'bind', [changed, None], acquired)
changed = copy.deepcopy(proposal); changed['actions'][0]['action_ref'] = 'ACTION3'; changed['steps'][0]['action'] = copy.deepcopy(changed['actions'][0])
family_case('before_exact_selected_command_required', 'before', [changed, 0, {'frame_rows': selected}, obs1], acquired)
for name, replacement in [('epoch', 2), ('center', [11, 15]), ('marker', 6), ('signature', {})]:
    seed = copy.deepcopy(acquired); seed['selection'][name] = replacement
    family_case('selection_attestation_' + name + '_incompatible', 'proposeSource', [obs1, selected, [], 8], seed)
family_case('no_public_rotation_commands', 'proposeSource', [{**obs1, 'available_action_refs': ['ACTION6']}, selected, [{'action_ref': 'ACTION4'}], 8], acquired)
family_case('caller_inputs_do_not_override_public_control', 'proposeSource', [obs1, selected, [{'action_ref': 'ACTION1'}], 8], acquired)

# An external target exercises the opposite-axis multiplier, including its
# integer zero component. JavaScript negative zero must not change source JSON.
outside0, outside1 = raster(target=(25, 15)), raster(True, target=(25, 15))
for rows in (outside0, outside1):
    box(rows, 28, 13, 32, 17, 0); box(rows, 29, 14, 31, 16, 3)
    body(rows, (20, 15), (0, 1))
outside_passive = family_case('outside_target_selection_acquired', 'recordSource',
    [observation(outside0), observation(outside1, 2), select_command, outside0, outside1])
outside_offer = family_case('outside_target_opposed_axis_proposal', 'proposeSource',
    [observation(outside1, 2), outside1, [], 8], outside_passive['afterState'])
assert outside_offer['value']['axial_plan']['offer']['kind'] == 'outside'
transverse0, transverse1 = raster(target=(20, 20)), raster(True, target=(20, 20))
for rows in (transverse0, transverse1): body(rows, (20, 25), (-1, 0))
transverse_passive = family_case('transverse_target_selection_acquired', 'recordSource',
    [observation(transverse0), observation(transverse1, 2), select_command, transverse0, transverse1])
transverse_offer = family_case('transverse_dependency_proposal', 'proposeSource',
    [observation(transverse1, 2), transverse1, [], 8], transverse_passive['afterState'])
assert transverse_offer['value']['axial_plan']['offer']['kind'] == 'transverse_dependency'

# Selection is acquired only by the source's exact one-pixel contrast.
foreign = copy.deepcopy(selected); foreign[0][0] = 11
family_case('selection_plus_foreign_change_is_not_evidence', 'recordSource', [obs0, observation(foreign, 2), select_command, initial, foreign])
family_case('selection_already_present_is_not_new_evidence', 'recordSource', [obs1, observation(selected, 3), select_command, selected, selected])
family_case('ambiguous_marker_change_is_not_evidence', 'recordSource', [obs0, observation(ambiguous, 2), select_command, initial, ambiguous])
family_case('absent_before_domain_has_no_return', 'recordSource', [observation([[0]*8 for _ in range(8)]), obs1, select_command, [[0]*8 for _ in range(8)], selected])
family_case('passive_selection_disappeared', 'recordSource', [obs1, observation(initial, 3), select_command, selected, initial], acquired)

# The observed control deliberately contradicts its prior. One receipt with
# the two observation refs is sufficient recall evidence; two trials are not.
contrary_rows = raster(True, (0, -1)); contrary_obs = observation(contrary_rows, 3)
active = family_case('active_contrary_quarter_turn_observed', 'recordSource',
    [obs1, contrary_obs, proposal['actions'][0], selected, contrary_rows, proposal, 0, [contrary_rows]], acquired)
learned = active['afterState']; assert learned['rotations'][0]['turn'] == -1
next_row = family_case('recalled_control_changes_next_choice', 'proposeSource', [contrary_obs, contrary_rows, [], 8], learned)
ablated = copy.deepcopy(learned); ablated['rotations'] = []
without_row = family_case('same_return_without_rotation_memory_selects_other_control', 'proposeSource', [contrary_obs, contrary_rows, [], 8], ablated)
assert next_row['value']['actions'] == [{'action_ref': 'ACTION4'}]
assert without_row['value']['actions'] == [{'action_ref': 'ACTION3'}]
family_case('passive_rotation_does_not_establish_control_law', 'recordSource', [obs1, contrary_obs, proposal['actions'][0], selected, contrary_rows], acquired)
half_rows = raster(True, (1, 0))
family_case('half_turn_is_not_a_quarter_rotation', 'recordSource', [obs1, observation(half_rows, 3), proposal['actions'][0], selected, half_rows, proposal, 0], acquired)

no_effect = family_case('no_effect_retains_attempt', 'recordSource', [obs1, observation(selected, 3), proposal['actions'][0], selected, selected, proposal, 0], acquired)
alternative = family_case('no_effect_prevents_same_control_repetition', 'proposeSource', [observation(selected, 3), selected, [], 8], no_effect['afterState'])
assert alternative['value']['actions'] == [{'action_ref': 'ACTION3'}]
again = family_case('second_no_effect_retains_both_attempts', 'recordSource',
    [observation(selected, 3), observation(selected, 4), alternative['value']['actions'][0], selected, selected, alternative['value'], 0], alternative['afterState'])
assert family_case('both_context_attempts_prevent_blind_repeat', 'proposeSource', [observation(selected, 4), selected, [], 8], again['afterState'])['value'] is None
family_case('changed_geometry_reopens_new_question', 'proposeSource', [contrary_obs, contrary_rows, [], 8], again['afterState'])

# Same action/kind shares the source attempt key across different peers. The
# chooser still selects deterministically; exact before-action uniqueness is a
# separate source guard and must be preserved.
multi0, multi1 = raster(peer_count=2), raster(True, peer_count=2)
multi_passive = family_case('multiple_peers_selection_acquired', 'recordSource',
    [observation(multi0), observation(multi1, 2), select_command, multi0, multi1])
multi_proposal = family_case('multiple_peers_choose_deterministically', 'proposeSource',
    [observation(multi1, 2), multi1, [], 8], multi_passive['afterState'])
assert multi_proposal['value'] is not None
multi_guard = family_case('shared_key_multiple_peers_guard_abstains', 'before',
    [multi_proposal['value'], 0, {'frame_rows': multi1}, observation(multi1, 2)], multi_passive['afterState'])
assert multi_guard['value']['admitted'] is False

# Animation chooses the last compatible old-scene sample, not the last packet
# index unconditionally. An incompatible new level carries no old effect.
new_rows = raster(True, (1, 0), target=(20, 20)); new_obs = observation(new_rows, 4, 2)
boundary = family_case('boundary_uses_last_compatible_old_scene_sample', 'recordSource',
    [obs1, new_obs, proposal['actions'][0], selected, new_rows, proposal, 0, [selected, contrary_rows, new_rows]], acquired)
assert boundary['afterState']['epoch'] == 2 and boundary['afterState']['selection'] is None
assert boundary['afterState']['rotations'] == [] and len(boundary['afterState']['portable']) == 1
family_case('boundary_without_old_scene_sample_acquires_no_rotation', 'recordSource',
    [obs1, new_obs, proposal['actions'][0], selected, new_rows, proposal, 0, [new_rows]], acquired)
family_case('source_identical_geometry_boundary_is_permissive', 'recordSource',
    [obs1, observation(contrary_rows, 4, 2), proposal['actions'][0], selected, contrary_rows, proposal, 0, [contrary_rows]], acquired)
family_case('source_empty_packet_falls_back_to_return', 'recordSource',
    [obs1, contrary_obs, proposal['actions'][0], selected, contrary_rows, proposal, 0, []], acquired)
family_case('malformed_intermediate_skipped', 'recordSource',
    [obs1, contrary_obs, proposal['actions'][0], selected, contrary_rows, proposal, 0, [None, [], contrary_rows]], acquired)
family_case('restored_portable_method_cannot_authorize_selection', 'proposeSource',
    [observation(selected, 5, 2), selected, [], 8], boundary['afterState'])
portable_acquired = family_case('new_epoch_selection_reacquired_from_public_return', 'recordSource',
    [observation(initial, 5, 2), observation(selected, 6, 2), select_command, initial, selected], boundary['afterState'])
family_case('portable_method_current_signature_revalidated', 'proposeSource',
    [observation(selected, 6, 2), selected, [], 8], portable_acquired['afterState'])
for name, mutate in [('insufficient_evidence', lambda r: r.update(evidence=['one'])),
                     ('foreign_signature', lambda r: r.update(signature={})),
                     ('unavailable_control', lambda r: r.update(action='ACTION1'))]:
    seed = copy.deepcopy(learned); mutate(seed['rotations'][0])
    family_case('historical_method_' + name + '_not_recalled', 'proposeSource', [contrary_obs, contrary_rows, [], 8], seed)
family_case('same_epoch_keeps_knowledge', 'scope', [contrary_obs], learned)
family_case('new_epoch_exports_rotations_and_resets_context', 'scope', [observation(contrary_rows, 4, 2)], learned)
family_case('selection_without_rotation_does_not_create_portable', 'scope', [observation(selected, 4, 2)], acquired)
family_case('partial_restore_preserves_other_source_fields', 'restore', [{'last': None, 'ignored': True}], learned)

# Common-runtime integration gets a separate cold sequence. The unselected
# initial public interface offers only ACTION1, so another family must act.
# That real public contrast, rather than a preloaded state, attests selection.
cold_obs0 = observation(initial, actions=['ACTION1'])
cold_obs1 = observation(selected, 2, actions=['ACTION3', 'ACTION4'])
cold_command = {'action_ref': 'ACTION1'}
cold_passive = family_case('common_cold_foreign_action_acquires_selection', 'recordSource',
    [cold_obs0, cold_obs1, cold_command, initial, selected])
cold_proposal = family_case('common_cold_next_decision_is_axial', 'proposeSource',
    [cold_obs1, selected, [], 8], cold_passive['afterState'])
cold_no_effect = family_case('common_cold_axial_no_effect_attempt', 'recordSource',
    [cold_obs1, observation(selected, 3, actions=['ACTION3', 'ACTION4']), cold_proposal['value']['actions'][0],
     selected, selected, cold_proposal['value'], 0], cold_passive['afterState'])
cold_turn = family_case('common_cold_axial_contrary_rotation', 'recordSource',
    [cold_obs1, contrary_obs, cold_proposal['value']['actions'][0], selected, contrary_rows,
     cold_proposal['value'], 0, [contrary_rows]], cold_passive['afterState'])
cold_next = family_case('common_cold_recalled_rotation_next_decision', 'proposeSource',
    [contrary_obs, contrary_rows, [], 8], cold_turn['afterState'])

policy = AxialPolicy()
facts = {'selection_attested_current': True, 'goal_marker_unique': True, 'scope_current': True}


def offer(kind='between', distance=1, recalled=1, action='ACTION4', fields=None):
    return {'kind': kind, 'facts': copy.deepcopy(facts if fields is None else fields),
            'quarter_distance': distance, 'recalled_control_first': recalled, 'action': action}


policy_inputs = [
    ('empty', []), ('single', [offer()]),
    ('kind_priority_before_distance', [offer('outside', 1, 0, 'ACTION3'), offer('between', 3)]),
    ('quarter_distance_before_recall', [offer(distance=3, recalled=0), offer(distance=1, action='ACTION3')]),
    ('recall_before_command', [offer(action='ACTION3'), offer(recalled=0, action='ACTION4')]),
    ('command_before_index', [offer(action='ACTION4'), offer(action='ACTION3')]),
    ('source_index_final_tie', [offer(), offer()]),
    ('three_kinds_reversed', [offer('transverse_dependency'), offer('outside'), offer('between')]),
    ('unknown_kind_ignored', [offer('foreign'), offer('outside')]),
    ('all_unknown_kinds_abstain', [offer('foreign')]),
]
for fact in facts:
    missing = copy.deepcopy(facts); del missing[fact]
    false = {**facts, fact: False}
    policy_inputs.extend([(fact+'_missing', [offer(fields=missing)]), (fact+'_false', [offer(fields=false)])])
for name, offers in policy_inputs:
    POLICIES.append({'id': name, 'offers': offers, 'select': plain(policy.select(offers)), 'choose': plain(policy.choose(offers))})

sys.setprofile(None)
verify_sources()
paths = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module, '__file__', None)
         and Path(module.__file__).resolve().is_relative_to(SOURCE)}
paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/axial_question').glob('*.drm'))
paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/axial_question').glob('*.src'))
payload = {
    'schema': 'logos-engine.v6.axial-question-reference.v1', 'referenceCommit': COMMIT,
    'qualification': 'Unchanged original Python on synthetic public rasters and controlled returns. No game dispatch or solved-level claim.',
    'sourceModified': False, 'sourceFilesVerifiedBeforeAndAfter': len(MANIFEST),
    'boundaryQualification': 'The source accepts a same-grid, same-target, same-body-count final frame across an epoch boundary. This source limitation is explicitly retained; native attribution is tested separately.',
    'sourceHashes': {p.relative_to(SOURCE).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)},
    'executedSourceFunctions': [{'path': p, 'line': line, 'function': fn, 'calls': count} for (p, line, fn), count in sorted(EXECUTED.items())],
    'geometryCases': GEOMETRY, 'cases': CASES, 'policyCases': POLICIES,
    'kernelCold': {'qualification': 'Cold synthetic public-runtime sequence. Foreign ACTION1 alone exposes the selected marker; no preloaded knowledge.',
        'initialRows': initial, 'selectedRows': selected, 'initialObservation': cold_obs0, 'selectedObservation': cold_obs1,
        'selectionCommand': cold_command, 'passive': cold_passive, 'proposal': cold_proposal,
        'noEffect': cold_no_effect, 'contraryRows': contrary_rows, 'contraryObservation': contrary_obs,
        'active': cold_turn, 'next': cold_next, 'boundary': boundary, 'newRows': new_rows, 'newObservation': new_obs},
    'kernelControlled': {'qualification': 'Cold component synthetic public-return sequence only; never a live campaign seed.',
        'initialRows': initial, 'selectedRows': selected, 'initialObservation': obs0, 'selectedObservation': obs1,
        'selectionCommand': select_command, 'passive': passive, 'proposal': proposal_row,
        'contraryRows': contrary_rows, 'contraryObservation': contrary_obs, 'active': active,
        'next': next_row, 'withoutRotationMemory': without_row, 'boundary': boundary,
        'newRows': new_rows, 'newObservation': new_obs}}
out = ROOT / 'tests/fixtures/v6-axial-question-reference.json.gz'
out.write_bytes(gzip.compress((json.dumps(payload, separators=(',', ':'), ensure_ascii=False)+'\n').encode(), mtime=0))
print(json.dumps({'path': out.relative_to(ROOT).as_posix(), 'familyCases': len(CASES), 'geometryCases': len(GEOMETRY),
    'policyCases': len(POLICIES), 'sha256': hashlib.sha256(out.read_bytes()).hexdigest()}))
