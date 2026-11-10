#!/usr/bin/env python3
"""Unchanged Python SymbolTransactions oracle on explicit synthetic rasters.

No game is opened or dispatched.  Guide decisions, binding, guards, acquisition,
SRC receipts and state are obtained from the original owner.  Interface learning
uses the original nested Interface on the retained argument corpus of its own
oracle, then invokes the original owner; it is labelled as a component chain,
not as an observed game or a cold production policy trajectory.  Direct select
inputs and restored history boundary cases have separate qualifications.
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
SESSION = 'symbols:synthetic'
sys.dont_write_bytecode = True
CACHE = tempfile.TemporaryDirectory(prefix='symbol-transactions-original-')
sys.pycache_prefix = CACHE.name
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']


def verify_sources():
    for name, record in MANIFEST.items():
        assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == record['sha256'], name


verify_sources()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from neutral_observer import measure
from agents.yf_arc3_v6.morphology_policy.symbol_transactions.family import SymbolTransactions, digest, holds, substitute
from agents.yf_arc3_v6.morphology_policy.symbol_transactions import geometry


def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)): return [plain(item) for item in value]
    if isinstance(value, (set, frozenset)): return [plain(item) for item in sorted(value)]
    if isinstance(value, SimpleNamespace): return plain(vars(value))
    return value


EXECUTED = Counter()
SOURCE_PREFIX = str(SOURCE) + '/'


def source_profile(frame, event, _arg):
    if event == 'call' and frame.f_code.co_filename.startswith(SOURCE_PREFIX):
        EXECUTED[(frame.f_code.co_filename[len(SOURCE_PREFIX):], frame.f_code.co_firstlineno, frame.f_code.co_qualname)] += 1


sys.setprofile(source_profile)
CONFIG = SymbolTransactions().config
CASES, SELECTION_CASES, HELPER_CASES = [], [], []
REAL = 'Original owner and SRC on a genuinely measured synthetic raster; no game transition claim.'
STATE_BOUNDARY = 'Explicit restored source-state boundary fixture; not an acquired game history.'
SELECT_BOUNDARY = 'Direct original select callback on explicit measured-port arguments; constructed metadata is not a raster or a game proof.'


def packet(rows, revision=1, epoch=1, available=None):
    return {'frame_rows': copy.deepcopy(rows), 'frame_packet': [copy.deepcopy(rows)],
        'frame_hash': hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16],
        'level': epoch, 'levels_completed': epoch - 1, 'state': 'NOT_FINISHED', 'step_index': revision - 1,
        'available_action_refs': available if available is not None else ['ACTION6']}


def observation(rows, revision=1, epoch=1, available=None, session=SESSION):
    return measure(SimpleNamespace(**packet(rows, revision, epoch, available)), revision, session)[0]


def perimeter(rows, box, value):
    left, top, right, bottom = box
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            if y in (top, bottom) or x in (left, right): rows[y][x] = value


def square(rows, x, y, value, extent=3):
    for row in range(y, y + extent):
        for col in range(x, x + extent): rows[row][col] = value


def guide_raster():
    rows = [[9] * 60 for _ in range(36)]
    perimeter(rows, [2, 2, 31, 10], 8)
    for x, value in ((5, 3), (10, 4), (22, 6)): square(rows, x, 5, value)
    for y in range(5, 8): rows[y][18] = 7
    for x in range(16, 19): rows[6][x] = 7
    perimeter(rows, [40, 18, 48, 26], 0)
    square(rows, 43, 21, 5)
    return rows


def counts(owner):
    return {'rejected': len(owner.rejected), 'events': len(owner.events)}


def family_case(name, operation, arguments, seed=None, qualification=REAL):
    owner = SymbolTransactions()
    if seed is not None: owner.restore(copy.deepcopy(seed))
    row = {'id': name, 'operation': operation, 'qualification': qualification,
        'arguments': plain(arguments), 'seedState': plain(seed if seed is not None else owner.state()),
        'srcCallsBefore': owner.src_calls}
    args = copy.deepcopy(arguments)
    if operation == 'before': args[2] = SimpleNamespace(**args[2])
    method = {'proposeSource': 'propose', 'recordSource': 'record'}.get(operation, operation)
    try: row['value'] = plain(getattr(owner, method)(*args))
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
        row['error'] = {'name': type(error).__name__, 'message': str(error)}
    row['afterState'] = plain(owner.state()); row['internalCounts'] = counts(owner); row['srcCallsAfter'] = owner.src_calls
    CASES.append(row)
    return row


def selection_case(name, measured, obs, rejected=()):
    owner = SymbolTransactions(); owner.observation = copy.deepcopy(obs); owner.rejected = list(rejected)
    row = {'id': name, 'qualification': SELECT_BOUNDARY, 'measured': plain(measured),
        'observation': plain(obs), 'rejected': list(rejected)}
    try: row['value'] = plain(owner.select(copy.deepcopy(measured)))
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
        row['error'] = {'name': type(error).__name__, 'message': str(error)}
    row['selected'] = plain(owner.selected); SELECTION_CASES.append(row)
    return row


BASE = guide_raster()
OBS = observation(BASE)
PUBLIC = packet(BASE)
ACTION = {'action_ref': 'ACTION6', 'data': {'x': 44, 'y': 22}}
INPUTS = [ACTION]
MEASURED = geometry.project(OBS, BASE, INPUTS, CONFIG, 0)
assert MEASURED is not None and holds(CONFIG['activation'], MEASURED['context'])
assert len(MEASURED['options']) == 1
assert MEASURED['options'][0]['entities'][0]['id'] != MEASURED['options'][0]['point_entity']['id']

# Continuous cold owner chain. All choices and returned objects are original.
cold = SymbolTransactions()
PROPOSAL = cold.propose(OBS, BASE, INPUTS, 16)
assert PROPOSAL and PROPOSAL['symbol_transaction_plan']['mode'] == 'guide'
AFTER_PROPOSE = plain(cold.state())
BEFORE_CURRENT = cold.before(PROPOSAL, 0, SimpleNamespace(**PUBLIC), OBS)
assert BEFORE_CURRENT['admitted']
no_effect_obs = observation(BASE, 2)
NO_EFFECT_RETURN = cold.record(OBS, no_effect_obs, ACTION, BASE, BASE, PROPOSAL, 0)
NO_EFFECT_STATE = plain(cold.state())
NO_EFFECT_NEXT = cold.propose(no_effect_obs, BASE, INPUTS, 16)
assert NO_EFFECT_NEXT is None
boundary_obs = observation(BASE, 3, 2)
BOUNDARY_RETURN = cold.record(no_effect_obs, boundary_obs, ACTION, BASE, BASE, PROPOSAL, 0)
BOUNDARY_STATE = plain(cold.state())
FRESH_PROPOSAL = cold.propose(boundary_obs, BASE, INPUTS, 16)
assert FRESH_PROPOSAL is not None
KERNEL = {'qualification': REAL, 'sessionId': SESSION, 'rows': BASE, 'observation': plain(OBS), 'public': PUBLIC,
    'inputs': INPUTS, 'remaining': 16, 'proposal': plain(PROPOSAL), 'afterProposeState': AFTER_PROPOSE,
    'beforeCurrent': plain(BEFORE_CURRENT), 'noEffectObservation': plain(no_effect_obs), 'noEffectPublic': packet(BASE, 2),
    'noEffectReturn': plain(NO_EFFECT_RETURN), 'noEffectState': NO_EFFECT_STATE, 'postRefutationProposal': plain(NO_EFFECT_NEXT),
    'boundaryObservation': plain(boundary_obs), 'boundaryPublic': packet(BASE, 3, 2),
    'boundaryReturn': plain(BOUNDARY_RETURN), 'boundaryState': BOUNDARY_STATE, 'postBoundaryProposal': plain(FRESH_PROPOSAL)}

family_case('cold_real_guide_proposes_actual_src', 'proposeSource', [OBS, BASE, INPUTS, 16])
family_case('zero_budget_still_scopes_owner', 'proposeSource', [OBS, BASE, INPUTS, 0])
empty = [[9] * 8 for _ in range(8)]
family_case('absent_guide_reaches_cold_interface_and_abstains', 'proposeSource', [observation(empty), empty, INPUTS, 16])
inactive = copy.deepcopy(BASE); square(inactive, 10, 5, 9)
family_case('inactive_guide_reaches_cold_interface_and_abstains', 'proposeSource', [observation(inactive), inactive, INPUTS, 16])
family_case('active_guide_with_no_options_does_not_fallback', 'proposeSource', [OBS, BASE, [], 16])
family_case('identical_full_actions_group_to_one', 'proposeSource', [OBS, BASE, [ACTION, ACTION], 16])
for name, commands in [
    ('different_actions_at_one_locus_are_ambiguous', [ACTION, {'action_ref': 'ACTION7', 'data': ACTION['data']}]),
    ('extra_data_key_is_not_the_exact_point_contract', [{'action_ref': 'ACTION6', 'data': {'x': 44, 'y': 22, 'z': 1}}]),
    ('boolean_coordinate_is_not_a_guide_integer', [{'action_ref': 'ACTION6', 'data': {'x': True, 'y': 22}}]),
    ('fractional_coordinate_is_not_a_guide_integer', [{'action_ref': 'ACTION6', 'data': {'x': 44.5, 'y': 22}}]),
    ('missing_coordinate_is_not_a_guide_point', [{'action_ref': 'ACTION6', 'data': {'x': 44}}]),
]: family_case(name, 'proposeSource', [OBS, BASE, commands, 16])
family_case('valid_conditional_point_binding', 'bind', [PROPOSAL, None], AFTER_PROPOSE)
for name, transform in [
    ('different_step_action', lambda p: p['steps'][0].update(action={'action_ref': 'ACTION1'})),
    ('missing_expected_after', lambda p: p['steps'][0].pop('expected_after')),
    ('missing_point_entity', lambda p: p['steps'][0]['point_binding'].pop('entity_ref')),
    ('two_actions', lambda p: p['actions'].append(copy.deepcopy(ACTION))),
]:
    proposal = copy.deepcopy(PROPOSAL); transform(proposal)
    family_case('binding_refuses_' + name, 'bind', [proposal, None], AFTER_PROPOSE)
for name, current, public, index in [
    ('current', OBS, PUBLIC, 0), ('wrong_index', OBS, PUBLIC, 1),
    ('different_observation_same_pixels', observation(BASE, 9), PUBLIC, 0),
    ('different_epoch', observation(BASE, 1, 2), PUBLIC, 0),
    ('different_progress', {**OBS, 'levels_completed': 1}, PUBLIC, 0),
    ('different_frame_hash', {**OBS, 'frame_hash': 'changed'}, PUBLIC, 0),
    ('public_hash_changed', OBS, {**PUBLIC, 'frame_hash': 'changed'}, 0),
    ('public_epoch_changed', OBS, {**PUBLIC, 'level': 2}, 0),
    ('action_unavailable', OBS, {**PUBLIC, 'available_action_refs': []}, 0),
    ('current_raster_no_longer_has_guide', OBS, {**PUBLIC, 'frame_rows': empty}, 0),
]: family_case('before_' + name, 'before', [PROPOSAL, index, public, current], AFTER_PROPOSE)
for name, key, value in [('entity_ref', 'entity_ref', 'foreign'), ('entity_signature', 'entity_signature', 'foreign'),
    ('measured_facts', 'measured_facts', {'other': True})]:
    proposal = copy.deepcopy(PROPOSAL); proposal['symbol_transaction_plan'][key] = value
    family_case('before_rejects_stale_' + name, 'before', [proposal, 0, PUBLIC, OBS], AFTER_PROPOSE)
family_case('after_never_predicts_interaction_effect', 'after', [PROPOSAL, 0, OBS, no_effect_obs, BASE, BASE], AFTER_PROPOSE)
family_case('active_no_effect_records_and_rejects', 'recordSource', [OBS, no_effect_obs, ACTION, BASE, BASE, PROPOSAL, 0], AFTER_PROPOSE)
family_case('rejected_action_abstains_without_interface_fallback', 'proposeSource', [no_effect_obs, BASE, INPUTS, 16], NO_EFFECT_STATE)
family_case('foreign_plan_has_no_acquisition_or_scope_change', 'recordSource', [boundary_obs, OBS, ACTION, BASE, BASE, {'workshop_plan': {}}, 0], NO_EFFECT_STATE)
family_case('no_plan_has_no_acquisition_or_scope_change', 'recordSource', [boundary_obs, OBS, ACTION, BASE, BASE], NO_EFFECT_STATE)
family_case('mismatched_active_command_has_no_stored_event', 'recordSource', [OBS, no_effect_obs, {'action_ref': 'ACTION5'}, BASE, BASE, PROPOSAL, 0], AFTER_PROPOSE)
family_case('official_boundary_resets_local_rejection_and_counter', 'recordSource', [no_effect_obs, boundary_obs, ACTION, BASE, BASE, PROPOSAL, 0], NO_EFFECT_STATE)
family_case('new_scope_requires_fresh_proposal', 'proposeSource', [boundary_obs, BASE, INPUTS, 16], BOUNDARY_STATE)

# Genuine measured diagram transformation within a synthetic guide experiment.
# The synthetic return makes no claim about an actual game's command effect.
paired = copy.deepcopy(BASE)
for left, value in ((6, 3), (14, 4)):
    perimeter(paired, [left, 19, left + 4, 23], 2); square(paired, left + 1, 20, value)
transformed = copy.deepcopy(paired)
for left in (6, 14): square(transformed, left + 1, 20, 11)
square(transformed, 25, 20, 6)
pair_obs, result_obs = observation(paired, 10), observation(transformed, 11)
transition = SymbolTransactions(); pair_proposal = transition.propose(pair_obs, paired, INPUTS, 16)
assert pair_proposal is not None
pair_before = transition.before(pair_proposal, 0, SimpleNamespace(**packet(paired, 10)), pair_obs)
assert pair_before['admitted']
transition_event = transition.record(pair_obs, result_obs, ACTION, paired, transformed, pair_proposal, 0)
assert transition_event['diagram_operand_removal_result_appearance_matches'] == 1
transition_state = plain(transition.state())
transition_next = transition.propose(result_obs, transformed, INPUTS, 16)
assert transition_next and transition_state['transition_count'] == 1
TRANSITION = {'qualification': REAL, 'before': plain(pair_obs), 'after': plain(result_obs), 'first': paired, 'second': transformed,
    'inputs': INPUTS, 'remaining': 16, 'proposal': plain(pair_proposal), 'beforeResult': plain(pair_before),
    'event': plain(transition_event), 'afterState': transition_state, 'nextProposal': plain(transition_next)}
family_case('measured_transition_acquires_integer_count', 'recordSource',
    [pair_obs, result_obs, ACTION, paired, transformed, pair_proposal, 0], {'epoch': 1})
family_case('acquired_transition_projects_later_drm_rule', 'proposeSource', [result_obs, transformed, INPUTS, 16], transition_state)

# Source export limits are distinguished from the live rejection ledger.
many = copy.deepcopy(NO_EFFECT_STATE)
many['rejected'] = [f'synthetic_rejection_{i}' for i in range(40)]
many['events'] = [{**copy.deepcopy(NO_EFFECT_RETURN), 'synthetic_boundary_index': i} for i in range(40)]
family_case('source_export_bounds_are_not_live_restore_truncation', 'state', [], many, STATE_BOUNDARY)
family_case('record_caps_events_but_only_exports_last_rejections', 'recordSource', [OBS, no_effect_obs, ACTION, BASE, BASE, PROPOSAL, 0], many, STATE_BOUNDARY)
family_case('partial_restore_preserves_unexported_live_rejections', 'restore', [{'transition_count': 3}], many, STATE_BOUNDARY)
family_case('partial_nested_restore_preserves_other_interface_fields', 'restore', [{'interface_state': {'bound': None}}], NO_EFFECT_STATE, STATE_BOUNDARY)
family_case('scope_preserves_events_and_interface_until_its_own_use', 'scope', [boundary_obs], {**many, 'transition_count': 3}, STATE_BOUNDARY)

# Direct callback boundaries: full-action grouping, sequential rules and Python
# format_map are compared independently from the measured-raster chain above.
selection_case('real_guide_option', MEASURED, OBS)
selection_case('source_rejection_key_is_complete_action', MEASURED, OBS, [digest([OBS['frame_hash'], ACTION])])
metadata = copy.deepcopy(MEASURED)
metadata['options'][0]['facts'].update(diagram_left_removal_right_appearance_count=2,
    diagram_point_full_symbol_count=1, diagram_point_equal_pair_center_count=1, diagram_tight_white_center_count=1,
    diagram_point_branch_value_square_count=1, diagram_equal_pair_matches_left_group_count=1,
    diagram_point_hollow_matches_tight_value_count=1)
metadata['options'][0]['point_entity']['id'] = 'entity:雪:{literal}'
all_rules = selection_case('sequential_rules_keep_literal_inserted_braces', metadata, OBS)
assert len(all_rules['selected']['rules']) == len(CONFIG['projection_rules'])
assert all_rules['selected']['conclusions']['active_goal_ref'] == 'goal.fill_matching_symbol_request'
duplicate = copy.deepcopy(MEASURED); later = copy.deepcopy(duplicate['options'][0]); later['source_boundary_tag'] = 'last_payload'
duplicate['options'].append(later)
selection_case('identical_action_keeps_last_payload', duplicate, OBS)
different = copy.deepcopy(MEASURED); later = copy.deepcopy(different['options'][0]); later['action']['extra'] = 'different_complete_action'
different['options'].append(later)
selection_case('full_action_extra_field_is_distinct', different, OBS)
base_option = copy.deepcopy(MEASURED['options'][0])


def interface_option(kind, point, row, depth=0, target=(10, 11), tag=''):
    option = copy.deepcopy(base_option); option['action'] = {'action_ref': 'ACTION6', 'data': {'x': point[0], 'y': point[1]}}
    option['facts'] = {'interface_method_current': True, 'offer_kind': kind, 'target_x': target[0], 'target_y': target[1],
        'source_x': point[0], 'source_y': point[1], 'recipe_dependency_depth': depth, 'selected_present': False, 'loaded_count': 0}
    option['interface_offer'] = {'displayed_row': row, 'source_boundary_tag': tag}; return option


for name, options in [
    ('kind_priority_precedes_tuple_cost', [interface_option('select_operand', (2, 2), {'left': [1, 2]}, 0), interface_option('receive_selected', (8, 8), None, 9)]),
    ('tuple_cost_precedes_action_grouping', [interface_option('select_operand', (2, 2), {'left': [1, 2]}, 1), interface_option('select_operand', (8, 8), {'left': [3, 4]}, 0)]),
    ('same_action_keeps_all_alternative_rows_and_last_payload', [interface_option('select_operand', (8, 8), None, tag='first'), interface_option('select_operand', (8, 8), {'left': [1, 2]}, tag='last')]),
    ('distinct_commands_with_identical_cost_abstain', [interface_option('select_operand', (8, 8), None), {**interface_option('select_operand', (8, 8), None), 'action': {'action_ref': 'ACTION7', 'data': {'x': 8, 'y': 8}}}]),
]: selection_case(name, {'mode': 'interface', 'context': {}, 'options': options}, OBS)

for name, value, bindings in [
    ('nested_values_keep_dictionary_keys', {'literal.{candidate_ref}': ['x.{candidate_ref}', 7, None, True]}, {'candidate_ref': 'entity:雪:{other}'}),
    ('escaped_literal_braces', '{{literal}}:{candidate_ref}', {'candidate_ref': 'E'}),
    ('missing_binding_raises', '{missing}', {'candidate_ref': 'E'}),
]:
    row = {'id': name, 'operation': 'substitute', 'arguments': [value, bindings], 'qualification': SELECT_BOUNDARY}
    try: row['value'] = plain(substitute(value, bindings))
    except (ValueError, TypeError, KeyError) as error: row['error'] = {'name': type(error).__name__, 'message': str(error)}
    HELPER_CASES.append(row)

# This corpus contributes only raw arguments; all expected values below are
# recalculated by unchanged original Interface and SymbolTransactions methods.
INTERFACE_PATH = ROOT / 'tests/fixtures/v6-symbol-interface-reference.json.gz'
INTERFACE_CHAIN = None
INPUT_CORPORA = []
if '--guide-only' not in sys.argv:
    raw = INTERFACE_PATH.read_bytes(); interface_corpus = json.loads(gzip.decompress(raw))
    INPUT_CORPORA.append({'path': INTERFACE_PATH.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(raw).hexdigest(),
        'bytes': len(raw), 'use': 'Acquisition and next-decision arguments only; expected values independently recomputed.'})
    owner = SymbolTransactions(); steps = []
    for source_step in interface_corpus['acquisitionSteps']:
        args = copy.deepcopy(source_step['arguments'])
        result = owner.interface.record(*args)
        steps.append({'id': source_step['id'], 'arguments': plain(args), 'value': plain(result), 'afterState': plain(owner.state())})
    acquired = plain(owner.state()); assert len(acquired['interface_state']['methods']) == 1
    current = copy.deepcopy(interface_corpus['next'])
    obs, rows, commands, remaining = current['observation'], current['rows'], current['inputs'], current['remaining']
    proposed = owner.propose(obs, rows, commands, remaining)
    assert proposed and proposed['symbol_transaction_plan']['mode'] == 'interface'
    public = {**packet(rows, obs['revision'], obs['level_epoch'], obs['available_action_refs']),
        'frame_hash': obs['frame_hash'], 'levels_completed': obs['levels_completed']}
    guarded = owner.before(proposed, 0, SimpleNamespace(**public), obs); assert guarded['admitted']
    proposed_state = plain(owner.state())
    session_suffix = f":epoch:{obs['level_epoch']}:revision:{obs['revision']}:frame:"
    assert session_suffix in obs['observation_ref']
    interface_session = obs['observation_ref'].rsplit(session_suffix, 1)[0]
    after = observation(rows, obs['revision'] + 1, obs['level_epoch'], obs['available_action_refs'], interface_session)
    event = owner.record(obs, after, proposed['actions'][0], rows, rows, proposed, 0)
    refuted = plain(owner.state()); following = owner.propose(after, rows, commands, remaining)
    assert following is None and len(refuted['interface_state']['refutations']) == 1
    qualification = ('Synthetic component acquisition through original nested Interface.record from a cold owner, then real owner SRC, guard and active return. '
        'No learned state injected. Acquisition inputs were not all chosen by the cold common caller; not a game or full policy trajectory.')
    INTERFACE_CHAIN = {'qualification': qualification, 'acquisitionSteps': steps, 'acquiredState': acquired, 'next': current,
        'proposal': plain(proposed), 'afterProposeState': proposed_state, 'public': public, 'beforeCurrent': plain(guarded),
        'noEffectObservation': plain(after), 'noEffectReturn': plain(event), 'noEffectState': refuted, 'postRefutationProposal': plain(following)}
    family_case('acquired_interface_selects_actual_src_proposal', 'proposeSource', [obs, rows, commands, remaining], acquired, qualification)
    family_case('acquired_interface_exact_current_guard', 'before', [proposed, 0, public, obs], proposed_state, qualification)
    family_case('acquired_interface_no_effect_refutes_in_scope', 'recordSource', [obs, after, proposed['actions'][0], rows, rows, proposed, 0], proposed_state, qualification)
    family_case('refuted_interface_abstains_in_scope', 'proposeSource', [after, rows, commands, remaining], refuted, qualification)
    family_case('duplicate_interface_command_is_not_unique', 'proposeSource', [obs, rows, commands + [proposed['actions'][0]], remaining], acquired, qualification)
    family_case('restored_interface_new_epoch_requires_current_revalidation', 'proposeSource',
        [observation(rows, obs['revision'] + 2, obs['level_epoch'] + 1, obs['available_action_refs'], interface_session), rows, commands, remaining], refuted, qualification)
    # An actually active guide must suppress a learned interface even when its
    # measured options are empty, ambiguous or currently rejected.
    for name, commands, seed in [
        ('empty_options', [], acquired),
        ('ambiguous_options', [ACTION, {'action_ref': 'ACTION7', 'data': ACTION['data']}], acquired),
        ('rejected_option', INPUTS, {**acquired, 'epoch': OBS['level_epoch'], 'rejected': [digest([OBS['frame_hash'], ACTION])]})]:
        family_case('active_guide_never_postfalls_back_' + name, 'proposeSource', [OBS, BASE, commands, 16], seed, qualification)

sys.setprofile(None)
verify_sources()
paths = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module, '__file__', None)
    and Path(module.__file__).resolve().is_relative_to(SOURCE)}
paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/symbol_transactions').glob('*.drm'))
paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/symbol_transactions').glob('*.src'))
payload = {'schema': 'logos-engine.v6.symbol-transactions-reference.v1', 'referenceCommit': COMMIT,
    'qualification': 'Unchanged original Python on genuinely measured synthetic rasters and separately labelled callback/state boundary inputs. No game dispatch or solved-level claim.',
    'sourceModified': False, 'sourceFilesVerifiedBeforeAndAfter': len(MANIFEST),
    'sourceHashes': {path.relative_to(SOURCE).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(paths)},
    'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': count} for (path, line, name), count in sorted(EXECUTED.items())],
    'inputCorpora': INPUT_CORPORA, 'actionsDispatched': 0, 'completeInterfaceCoverage': INTERFACE_CHAIN is not None,
    'cases': CASES, 'selectionCases': SELECTION_CASES, 'helperCases': HELPER_CASES,
    'kernelControlled': KERNEL, 'transitionControlled': TRANSITION, 'interfaceControlled': INTERFACE_CHAIN}
out = ROOT / 'tests/fixtures/v6-symbol-transactions-reference.json.gz'
out.write_bytes(gzip.compress((json.dumps(payload, separators=(',', ':'), ensure_ascii=False) + '\n').encode(), mtime=0))
print(json.dumps({'path': out.relative_to(ROOT).as_posix(), 'familyCases': len(CASES), 'selectionCases': len(SELECTION_CASES),
    'helperCases': len(HELPER_CASES), 'completeInterfaceCoverage': INTERFACE_CHAIN is not None,
    'bytes': out.stat().st_size, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest()}))
