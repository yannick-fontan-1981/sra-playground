#!/usr/bin/env python3
"""Independent public-evidence comparison for the optional Outline v2 domain.

The seven-field acquisition remains the unchanged original Python component.
The extra preceding-raster input is evaluated by the unchanged V5 helper and
the two exact declaration subsets by the original DRM evaluator. Construction,
caller admission and one-return retention are separately named native contracts.
No host, native agent, native evaluator or counterfactual return is executed.
The v1 comparison generators and their retained receipts are not modified.
"""
from __future__ import annotations

import argparse
from collections import Counter
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import tarfile
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('outline_v1_comparison_immutable', ROOT / 'scripts/compare-v53-outline-public-evidence.py')
base = importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
contracts, helper = base.contracts, base.helper
from common_frontier import ObservedFrontier, _action, _action_key, _protocol, _index
from common_preservation import bind as bind_preservation, check as check_preservation
from agents.yf_arc3_v5.drm.loader import _parse_drm_source
from agents.yf_arc3_v5.drm.registry import DrmRegistry
from agents.yf_arc3_v5.drm.contracts import DrmSelectionTier
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
from agents.yf_arc3_v5.drm.runtime import _first_matching_tier

plain, packed, digest, check, load, proof = base.plain, base.packed, base.digest, base.check, base.load, base.proof
GOAL = 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter'
PUBLIC_FORMAT = 'native.public_outline_service.v2'
COORDINATION_RULE = 'v5_current_required_service_before_independent_contact_question'
PUBLIC_SCOPE = ('observation_ref', 'level_epoch', 'levels_completed', 'frame_hash', 'revision')
CORE_KEYS = ('status', 'kind', 'actions', 'steps', 'facts', 'binding', 'outline_plan', 'route_refs', 'compositions', 'question', 'bundle_template')
ADMISSION_FIELDS = {'native_current_service_witness', 'native_current_service_admission'}
CAPTURE_INPUT = False
CAPTURED_INPUTS = []
NATIVE_ANNOTATIONS = []
PRESERVATION_INPUTS = []


def profile(frame, event, value):
    contracts.profile(frame, event, value)
    if CAPTURE_INPUT and event == 'call' and frame.f_code is helper._compact_body_perimeter_marker_accompaniment.__code__:
        CAPTURED_INPUTS.append(frame.f_locals['value'])


def unique(values): return list(dict.fromkeys(values))
def scope(obs): return {key: obs[key] for key in PUBLIC_SCOPE}
def physical(command): return {'action_ref': command['action_ref'], 'data': command.get('data', {})}
def pure(value): return base.source_projection(value, 'independent.source')


def original_input_fields(value):
    result = {}
    for name in sorted(value.model_fields_set):
        if name in ('frame', 'components', 'route_generation_policy'): continue
        child = getattr(value, name)
        if name.endswith('_bboxes'):
            result[name] = [[box.left, box.top, box.right, box.bottom] for box in child]
        elif name in ('current_observed_frame', 'previous_action_observed_frame') and child is not None:
            result[name] = plain(child.rows)
        else: result[name] = plain(child)
    return result


def augmented_measurement(family, obs, rows, previous):
    """Capture the real source wrapper input, then add only the prior frame."""
    global CAPTURE_INPUT
    retained = plain(family.state())
    CAPTURED_INPUTS.clear(); CAPTURE_INPUT = True
    try: measured = family.measure(obs, rows)
    finally: CAPTURE_INPUT = False
    check(plain(family.state()), retained, 'previous.measure.source.readonly')
    if measured is None:
        assert not CAPTURED_INPUTS
        return None, None
    assert len(CAPTURED_INPUTS) == 1
    original_input = CAPTURED_INPUTS[0]
    fields = original_input_fields(original_input)
    route = plain(original_input.route_generation_policy)
    rebuilt = contracts.interaction(rows, fields, route)
    check(plain(rebuilt), plain(original_input), 'previous.measure.original.input')
    extended_fields = {**fields, 'previous_action_observed_frame': previous}
    accompaniment, relation = plain(helper._compact_body_perimeter_marker_accompaniment(contracts.interaction(rows, extended_fields, route)))
    result = plain(measured)
    result['accompaniment'], result['relation'] = accompaniment, relation
    result['facts'] = {**result['facts'], 'unique_mobile_correspondence': len(accompaniment) == 1,
        'immediate_other_contact': relation.get('other_compact_body_marker_immediate_contact_count', 0) > 0,
        'lead_on_announced_cell': bool(relation.get('controlled_lead_bbox_matches_cardinal_marker_cell'))}
    return result, {'originalInputFields': fields, 'routeConfigSha256': digest(route),
        'onlyAdditionalInput': 'previous_action_observed_frame', 'previousRowsSha256': helper.digest(previous),
        'originalCurrentOnlyMeasurementSha256': digest(plain(measured)), 'augmentedMeasurementSha256': digest(result)}


def extract_subset(kind, archive):
    """Build documents from pinned declarations, never from native results."""
    path = helper.SOURCE / 'agents/yf_arc3_v5/drm/interaction.drm'
    raw = json.loads(path.read_text()); source_policy = raw['declarations'][217]
    if kind == 'operator':
        subset_ref = 'native.outline.current_public_operator_subset'
        pointers = [('declarations', 217, 'fact_projections', 1296), ('declarations', 217, 'selection_tiers', 19)]
        projections = [source_policy['fact_projections'][1296]]
        declarations = []
        tier_raw = source_policy['selection_tiers'][19]
        native_path = 'src/logos-engine/v6/outline-public-context.json'
    else:
        subset_ref = 'native.outline.current_announced_service_subset'
        pointers = [('declarations', 213), ('declarations', 217, 'fact_projections', 634),
                    ('declarations', 217, 'fact_projections', 665), ('declarations', 217, 'fact_projections', 984),
                    ('declarations', 217, 'selection_tiers', 20)]
        projections = [source_policy['fact_projections'][index] for index in (634, 665, 984)]
        declarations = [raw['declarations'][213]]
        tier_raw = source_policy['selection_tiers'][20]
        native_path = 'src/logos-engine/v6/outline-continuation.json'
    declarations.append({'id': subset_ref, 'kind': 'selection_policy', 'reason_refs': [tier_raw['reason_ref']],
        'evaluation': 'declared_eligibility_single', 'supported_operators': source_policy['supported_operators'],
        'input_contract': source_policy['input_contract'], 'output_contract': source_policy['output_contract'],
        'fact_projections': projections})
    document = {'module_id': subset_ref, 'declarations': declarations}
    text = packed(document); registry = DrmRegistry(); registry.register(_parse_drm_source(text)); registry.seal()
    declaration = registry.resolve(subset_ref)[0]; tier = DrmSelectionTier.model_validate(tier_raw)
    fragments = []
    for pointer in pointers:
        item = raw
        for key in pointer: item = item[key]
        fragments.append({'id': item['id'], 'pointer': list(pointer), 'canonicalSha256': digest(item)})
    with tarfile.open(archive, 'r:gz') as stream: transferred = json.load(stream.extractfile(native_path))
    check(transferred['document'], {'text': text.decode(), 'sha256': hashlib.sha256(text).hexdigest()}, kind + '.transferred.document')
    check(transferred['selectionTier'], tier_raw, kind + '.transferred.tier')
    check(transferred['sourcePointers'], [{'id': row['id'], 'pointer': row['pointer']} for row in fragments], kind + '.transferred.pointers')
    check(transferred['referenceCommit'], helper.COMMIT, kind + '.transferred.commit')
    check(transferred['sourceSha256'], base.sha(path), kind + '.transferred.source')
    assert transferred['sourcePath'] == path.relative_to(helper.SOURCE).as_posix()
    assert transferred['sourceBytes'] == path.stat().st_size and transferred['sourceSelectionPolicyRef'] == source_policy['id']
    assert transferred['subsetPolicyRef'] == subset_ref
    assert isinstance(transferred['qualification'], str) and isinstance(transferred['wrapperQualification'], str)
    return {'registry': registry, 'declaration': declaration, 'tier': tier, 'subset_ref': subset_ref,
        'document': {'text': text.decode(), 'sha256': hashlib.sha256(text).hexdigest()}, 'fragments': fragments,
        'source': proof(path), 'transferred': transferred, 'nativeSource': base.ARCHIVED_PROOFS[native_path]}


def evaluate_subset(subset, facts):
    result = project_declared_alternatives(drm=subset['registry'], selection_policy_ref=subset['subset_ref'],
        alternative_refs=(facts['candidate_ref'],), descriptive_facts=facts)
    projected = result.alternative_facts[facts['candidate_ref']]
    _index_value, matched = _first_matching_tier(projected, (subset['tier'],))
    complete = tuple(result.projection_refs) == tuple(row.id for row in subset['declaration'].fact_projections)
    return {'projection_result': plain(result), 'projected_facts': plain(projected),
        'matched_tier_ref': matched.id if matched else None, 'all_required_projections_matched': complete,
        'matched': complete and matched is not None}


def package_native_question(family, obs, measured, meaning, receipt, operator, subset):
    """Named native construction; geometry and meanings above are source outputs.

    This deliberately does not invoke or claim original Outline.propose for the
    extended candidate. It spells the bounded public contract independently.
    """
    current, prior = measured['current'], family.config['interface_prior']
    choices = [prior['interaction']] if operator else list(measured['accompaniment'])
    if len(choices) != 1 or choices[0] not in obs['available_action_refs']: return None
    action = {'action_ref': choices[0]}; position = current['bbox'][:]
    delta = prior['directions'].get(action['action_ref'])
    if delta:
        actual = family.control.get('controls', {}).get(action['action_ref'], {}).get('delta', [delta[0] * current['width'], delta[1] * current['height']])
        position = [position[0] + actual[0], position[1] + actual[1], position[2] + actual[0], position[3] + actual[1]]
    steps = [{'action': action, 'body_before': current['bbox'][:],
              'expected_after': None if operator else {'body_bbox': position, 'qualification': 'conditional_control_displacement'}, 'seal_after': True}]
    evidence = unique(family.control['evidence'] + [obs['observation_ref']])
    focus = 'composition:outline_service:' + helper.digest([obs['observation_ref'], meaning, measured['zone'], measured['relation']])
    facts = {'current_outline_service_bound': True}
    plan = {'measurement': measured, 'meaning': meaning, 'operator': operator, 'locus_patch': [], 'control': plain(family.control)}
    if receipt is not None:
        plan['workflow'] = plain(receipt)
        plan['drm_sha256'] = base.sha(Path(helper.source_family.__file__).with_name('outline.drm'))
    else:
        plan['native_construction'] = {'status': 'pending_actual_caller_service_witness', 'projection_ref': subset['fragments'][0]['id'],
            'unknown_conditions': ['attempted_without_effect_in_current_context', 'candidate_is_unique_effectful_nondirectional_local_action'], 'release_authority': False}
        plan['drm_sha256'] = subset['document']['sha256']
    return {'status': 'proposed', 'kind': 'public_outline_service', 'actions': [action], 'steps': steps, 'facts': facts,
        'binding': {key: obs[key] for key in ('observation_ref', 'level_epoch', 'levels_completed', 'frame_hash')},
        'outline_plan': plan, 'route_refs': evidence,
        'compositions': [{'id': focus, 'role': meaning['role'], 'observed': False, 'things': [current['signature']],
            'properties': {'conditional': True, 'current_measurement': measured, 'recalled_control_method': family.control.get('recalled_method'),
                'unknown': ['local_effect', 'autonomous_policy', 'terminal_rule', 'contact_consequence'],
                'falsifiers': ['outline_did_not_follow', 'locus_changed', 'ambiguous_control', 'current_preservation_violated']},
            'relations': ['contributes_to:' + family.config['goal']], 'open_question': meaning['question']}],
        'question': {'reason': meaning['question'], 'hypothesis_refs': [meaning['rule_ref'], meaning['mechanism_ref']]},
        'bundle_template': {'operation_key': meaning['operation'], 'composition_ref': focus, 'objective_ref': family.config['goal'],
            'purpose': meaning['question'], 'preconditions': facts, 'evidence': evidence, 'actions': [action],
            'preserve_refs': [], 'preservation_evidence': {}, 'outcome_guard': {'path': ['value'], 'contains': focus}}}


def reconstruct_candidate(family, obs, rows, remaining, annex, subsets):
    source_error = None
    try: original = plain(family.propose(obs, rows, [], remaining))
    except ValueError as error:
        translations = [row for row in (family.control or {}).get('transitions', []) if row['level_epoch'] == obs['level_epoch']]
        if len(translations) <= 64 or 'observed_controlled_translation_count' not in str(error): raise
        original = None
        source_error = {'name': type(error).__name__, 'message': str(error), 'field': 'observed_controlled_translation_count', 'value': len(translations), 'limit': 64}
    if source_error or not family.control or remaining < 1 or annex is None: return original, original, None, source_error
    assert annex['source_state_ref'] == 'outline_source:' + helper.digest(plain(family.state()))
    check(annex['after'], scope(obs), 'candidate.current.annex.scope')
    assert annex['after_rows_sha256'] == helper.digest(rows)
    measured, diagnostic = augmented_measurement(family, obs, rows, annex['before_rows'])
    if not measured or not measured['facts']['unique_mobile_correspondence'] or not measured['facts']['local_operator_observed'] \
            or measured['relation'].get('compact_body_hollow_perimeter_marker_route_bound_reached') is not False:
        return original, original, diagnostic, None
    local = [row for row in family.methods if row['scope'] == obs['level_epoch'] and row['status'] == 'observed_local_change'
             and row['local_count'] > 0 and row['action']['action_ref'] == family.config['interface_prior']['interaction']]
    if not local: return original, original, diagnostic, None
    relation = measured['relation']; dispatched = annex['selected_outline']
    if dispatched and dispatched['active_goal_ref'] == GOAL \
            and relation.get('same_value_compact_body_hollow_perimeter_marker_triplet_count') == 1 \
            and relation.get('controlled_lead_covers_other_inset_on_body_target_segment') is True \
            and relation.get('other_compact_body_marker_immediate_contact_count') == 0:
        mode = 'obstructing_inset_operator'
        meaning = {'kind': 'native_current_obstructing_inset_operator_hypothesis', 'operation': 'OP18',
            'role': 'controlled_outline_testing_current_overlaid_obstruction', 'rule_ref': subsets['operator']['tier'].id,
            'mechanism_ref': subsets['operator']['fragments'][0]['id'],
            'question': 'Ask whether the observed local operator changes the currently overlaid obstruction serving the acquired announced relation; its effect remains unknown.'}
        proposed = package_native_question(family, obs, measured, meaning, None, True, subsets['operator'])
    else:
        mode = 'announced_continuation'; decision, receipt = family.policy.evaluate(measured['facts'])
        if decision['status'] != 'unique' or decision['conclusions'][0]['kind'] != 'announced_correspondence_hypothesis':
            return original, original, diagnostic, None
        if original and original['outline_plan']['meaning']['kind'] == 'announced_correspondence_hypothesis' \
                and original['outline_plan']['measurement']['accompaniment'] == measured['accompaniment'] \
                and original['outline_plan']['measurement']['relation'] == measured['relation']:
            return original, original, diagnostic, None
        proposed = package_native_question(family, obs, measured, plain(decision['conclusions'][0]), receipt, False, subsets['continuation'])
    if proposed is None: return original, original, diagnostic, None
    proposed['requires_current_service_witness'] = True
    proposed['native_outline_public_context'] = {'schema': 'native.outline.current_public_context_question.v1', 'kind': mode,
        'public_transition_ref': 'outline_public_transition:' + helper.digest(annex), 'before': annex['before'], 'after': annex['after'],
        'prior_command': annex['command'], 'selected_outline': annex['selected_outline'], 'previous_rows_sha256': annex['before_rows_sha256'],
        'current_rows_sha256': annex['after_rows_sha256'], 'source_proposal_available': original is not None,
        'source_proposal_kind': original['outline_plan']['meaning']['kind'] if original else None,
        'actual_trial_not_yet_measured': True, 'release_authority': False, 'action_effect_known': False}
    return original, proposed, diagnostic, None


def proposal_core(proposal):
    result = {key: plain(proposal[key]) for key in CORE_KEYS}
    for key in ('preservation', 'preservation_changes'):
        if key in proposal: result[key] = plain(proposal[key])
    if proposal.get('requires_current_service_witness') is True:
        result['requires_current_service_witness'] = True
        result['native_outline_public_context'] = plain(proposal['native_outline_public_context'])
    return result


def protect_actual_constraints(candidate, supplied, obs, rows, prefix_index):
    if 'preservation' not in supplied:
        assert 'preservation_changes' not in supplied
        return candidate
    bound = supplied['preservation']
    assert isinstance(bound, dict) and isinstance(bound.get('obligations'), list)
    assert bound['level_epoch'] == obs['level_epoch'] and bound['observation_ref'] == obs['observation_ref']
    # Outline itself supplies no revision. An unexplained caller rewrite must
    # not be laundered by copying it into the independently computed candidate.
    assert 'preservation_changes' not in supplied
    result, rejected = bind_preservation(candidate, bound['obligations'], obs, rows)
    assert not rejected and result['status'] == 'proposed'
    check(result['preservation'], bound, f'prefix.{prefix_index}.original.preservation.binding')
    PRESERVATION_INPUTS.append({'prefixIndex': prefix_index, 'obligationsSha256': digest(bound['obligations']),
        'obligationCount': len(bound['obligations']), 'originalBinderRecomputed': True,
        'currentPublicConditionsMeasured': True, 'historicalObligationProducerReconstructed': False})
    return result


def reconstruct_trial(supplied, obs, command, frontier, prefix_index, caller_metadata):
    where = f'prefix.{prefix_index}.current_trial'
    context, action_key = _index(obs), _action_key(command)
    node = frontier.nodes.get(context)
    assert node is not None and action_key not in node['attempts'], ('Not actually untried', where)
    assert command['action_ref'] in obs['available_action_refs'] and not command.get('data')
    assert re.fullmatch('[a-f0-9]{64}', supplied['source_frontier_chain'])
    for key in ('source_frontier_sequence', 'source_state_revision'):
        assert type(supplied[key]) is int and supplied[key] > 0
    metadata = {key: supplied[key] for key in ('source_frontier_chain', 'source_frontier_sequence', 'source_state_revision')}
    if caller_metadata:
        assert metadata['source_frontier_sequence'] >= caller_metadata[-1]['source_frontier_sequence']
        assert metadata['source_state_revision'] >= caller_metadata[-1]['source_state_revision']
    caller_metadata.append({'prefixIndex': prefix_index, **metadata})
    positive, known, evidence, considered = [], set(), set(), 0
    # State graph hydration orders object members lexically before each plan.
    # The actual transitions and their per-edge evidence retain event order.
    for edge_ref, edge in sorted(frontier.edges.items()):
        before = frontier.nodes[edge['source']]['protocol']; after = frontier.nodes[edge['target']]['protocol']
        if any(packet['level_epoch'] != obs['level_epoch'] or packet['levels_completed'] != obs['levels_completed'] for packet in (before, after)): continue
        considered += len(edge['evidence_refs'])
        if before['frame_hash'] == after['frame_hash']: continue
        known.add(edge['action']['action_ref']); evidence.update(edge['evidence_refs'])
        positive.append({'edge_ref': edge_ref, 'command': edge['action'], 'source_index': edge['source'], 'target_index': edge['target'],
            'before_frame_hash': before['frame_hash'], 'after_frame_hash': after['frame_hash'], 'transition_refs': edge['evidence_refs'],
            'effect_status': 'observed_final_raster_change'})
    inventory = {'status': 'observed_effectful_action_inventory', 'observation_ref': obs['observation_ref'],
        'level_epoch': obs['level_epoch'], 'levels_completed': obs['levels_completed'], 'available_action_refs': obs['available_action_refs'],
        'known_effectful_action_refs': sorted(known), 'witnesses': positive, 'evidence_refs': sorted(evidence),
        'considered_transition_count': considered, 'source_state_ref': 'caller:frontier',
        'source_frontier_chain': metadata['source_frontier_chain'], 'source_frontier_sequence': metadata['source_frontier_sequence'],
        'domain_complete': True, 'measurement_domain': 'final_public_raster_change_within_current_epoch_and_score', 'v5_producer_parity': False,
        'level_start_checkpoint_action_ref': None,
        'checkpoint_qualification': 'The admitted V6 public protocol has no checkpoint-role attribute; null retains the V5 InteractionProbeInput default and gives no action a checkpoint role.',
        'qualification': 'All acquired frontier edges in this declared scope are examined. A positive final-raster change is an observed response, not a general causal law. Unseen inputs and final-equal returns, including possible transient effects, remain unknown; no effect or no-effect is inferred for them.'}
    expected = {'status': 'untried_exact_public_context', 'observation_ref': obs['observation_ref'], 'level_epoch': obs['level_epoch'],
        'frame_hash': obs['frame_hash'], 'action_ref': command['action_ref'], 'trial_key': context + ':' + action_key,
        'action_key': action_key, 'context_index': context, 'protocol': _protocol(obs), 'command': _action(command), 'domain_complete': True,
        'attempted_without_effect_in_current_context': False, 'evidence_refs': [obs['observation_ref']], 'prior_trial_count': 0,
        'prior_transition_refs': [], 'source_state_ref': 'caller:frontier', **metadata,
        'context_projection': 'v6.frontierProtocol', 'v5_caller_context_parity': False, 'effectful_action_context': inventory,
        'qualification': 'No acquired trial exists for this exact admitted command and public protocol. All previously tried commands are outside this narrower native priority domain; no hidden-state equivalence or transient no-effect is inferred.'}
    check(supplied, expected, where)
    return expected


def subset_info(subset, old=False):
    native = subset['transferred']
    result = {'reference_commit': helper.COMMIT, 'source_path': 'agents/yf_arc3_v5/drm/interaction.drm',
        'source_sha256': subset['source']['sha256'], 'subset_sha256': subset['document']['sha256'],
        'declaration_refs': [row['id'] for row in subset['fragments']],
        'qualification': native['qualification'], 'wrapper_qualification': native['wrapperQualification']}
    if old: result['original_policy_ref'] = native['sourceSelectionPolicyRef']
    return result


def reconstruct_witness(family, candidate, obs, rows, annex, trial, subsets):
    assert len(candidate['actions']) == len(candidate['steps']) == 1
    command, plan, state = candidate['actions'][0], candidate['outline_plan'], plain(family.state())
    measured = plan['measurement']; relation = measured['relation']
    local = [row for row in state['methods'] if row['scope'] == obs['level_epoch'] and row['status'] == 'observed_local_change'
             and row['local_count'] > 0 and row['action']['action_ref'] == family.config['interface_prior']['interaction']]
    source_guard = family.before(candidate, 0, SimpleNamespace(frame_rows=rows), obs)
    assert source_guard['admitted'] and local and state['control']['interior_contrast']
    transitions = [row for row in state['control']['transitions'] if row['level_epoch'] == obs['level_epoch']]
    assert 1 <= len(transitions) <= 64 and measured['current_transitions'] == transitions
    if candidate.get('requires_current_service_witness') is True:
        mode = candidate['native_outline_public_context']['kind']
        proposal_ref = 'outline_public_service:' + helper.digest(proposal_core(candidate))
        facts = {**relation, 'candidate_ref': proposal_ref, 'action_ref': command['action_ref'],
                 'interaction_measurement_kind': 'discrete', 'attempted_without_effect_in_current_context': False}
        effectful = None
        if mode == 'obstructing_inset_operator':
            context = trial['effectful_action_context']; directions = list(family.config['interface_prior']['directions'])
            candidates = [ref for ref in context['known_effectful_action_refs'] if ref in obs['available_action_refs']
                          and ref != 'ACTION6' and ref != context['level_start_checkpoint_action_ref'] and ref not in directions]
            assert candidates == [command['action_ref']] and context['evidence_refs']
            assert annex['selected_outline']['active_goal_ref'] == GOAL and plan['operator'] is True and candidate['steps'][0]['expected_after'] is None
            effectful = {**context, 'unique_available_nondirectional_local_action_ref': command['action_ref'],
                         'interface_directional_action_refs': directions, 'point_action_ref': 'ACTION6', 'candidate_count': 1}
            facts.update(dispatched_composition_active_goal_ref=GOAL, candidate_is_unique_effectful_nondirectional_local_action=True)
            subset = subsets['operator']
        else:
            assert mode == 'announced_continuation' and list(measured['accompaniment']) == [command['action_ref']]
            assert plan['operator'] is False and relation['controlled_lead_bbox_is_compatible_with_announced_motion'] is True
            facts['candidate_matches_compact_body_hollow_perimeter_marker_direction'] = True
            subset = subsets['continuation']
        interpreted = evaluate_subset(subset, facts); projected = interpreted['projected_facts']
        assert interpreted['matched'] and projected['remaining_action_bound'] == 1
        assert projected['full_metaplan_reprojection_required_after_primitive'] is True
        assert projected['declared_conditional_series_authorized'] is projected['declared_deterministic_series_authorized'] is False
        evidence = unique([obs['observation_ref'], annex['before']['observation_ref'], annex['after']['observation_ref'],
            *state['control']['evidence'], *(ref for row in local for ref in row['evidence']), *trial['evidence_refs'],
            *(effectful['evidence_refs'] if effectful else [])])
        return {'schema': 'logos-engine.native.outline-required-service.v2', 'rule': 'native.current_public_announcement_service',
            'status': 'current_required_service', 'mode': mode, 'observation_ref': obs['observation_ref'], 'level_epoch': obs['level_epoch'],
            'frame_hash': obs['frame_hash'], 'action_ref': command['action_ref'], 'trial_key': trial['trial_key'], 'proposal_ref': proposal_ref,
            'current_trial': trial, 'global_operator_evidence': effectful,
            'public_transition_ref': 'outline_public_transition:' + helper.digest(annex),
            'public_transition': {key: annex[key] for key in ('before', 'after', 'command', 'before_rows_sha256', 'after_rows_sha256', 'selected_outline', 'source_state_ref')},
            'source_subset': subset_info(subset), 'source_condition_receipt': interpreted, 'source_guard': source_guard,
            'source_guard_scope': 'Only the original current-outline/action binding is shared; the new candidate and current-service admission are explicit native extensions.',
            'current_measurement': measured, 'current_control': state['control'], 'local_operator_evidence': local, 'evidence_refs': evidence,
            'primitive_bound': 1, 'replan_after_each_primitive': True, 'release_authority': False, 'action_effect_known': False,
            'terminal_rule_known': False, 'unknown': ['local_effect', 'autonomous_policy', 'terminal_rule', 'contact_consequence'],
            'qualification': 'An actual immediately preceding public raster completes the unchanged V5 measurement. The exact acquired dispatch and current caller trial support only one conditional question; every following action requires a new public measurement.'}
    assert plan['meaning']['kind'] == 'announced_correspondence_hypothesis' and plan['operator'] is False
    assert list(measured['accompaniment']) == [command['action_ref']]
    assert relation['controlled_lead_bbox_matches_cardinal_marker_cell'] is True and measured['facts']['lead_on_announced_cell'] is True
    proposal_ref = 'outline_service:' + helper.digest(proposal_core(candidate))
    facts = {**relation, 'candidate_ref': proposal_ref, 'action_ref': command['action_ref'], 'interaction_measurement_kind': 'discrete',
             'candidate_matches_compact_body_hollow_perimeter_marker_direction': True, 'attempted_without_effect_in_current_context': False}
    interpreted = evaluate_subset(subsets['continuation'], facts); assert interpreted['matched']
    return {'schema': 'logos-engine.native.outline-required-service.v1', 'rule': 'native.current_announced_outline_service_before_independent_contact',
        'status': 'current_required_service', 'observation_ref': obs['observation_ref'], 'level_epoch': obs['level_epoch'], 'frame_hash': obs['frame_hash'],
        'action_ref': command['action_ref'], 'trial_key': trial['trial_key'], 'proposal_ref': proposal_ref,
        'proposal_identity_profile': 'source_outline_proposal_with_four_original_src_receipt_fields.v1', 'current_rows_sha256': helper.digest(rows),
        'current_trial': trial, 'source_subset': subset_info(subsets['continuation'], old=True), 'source_condition_receipt': interpreted,
        'source_guard': source_guard, 'current_measurement': measured, 'current_control': state['control'], 'local_operator_evidence': local,
        'evidence_refs': unique([obs['observation_ref'], *state['control']['evidence'], *(ref for row in local for ref in row['evidence']), *trial['evidence_refs']]),
        'primitive_bound': 1, 'replan_after_each_primitive': True, 'release_authority': False, 'action_effect_known': False, 'terminal_rule_known': False,
        'unknown': ['next_local_effect', 'autonomous_policy', 'terminal_rule', 'contact_consequence'],
        'qualification': 'The currently remeasured announced relation and an actual same-epoch local intervention support one conditional service question. The exact caller trial is retained separately; historical evidence grants no current action permission, and this limited V5 subset is not the unchanged V6 caller order.'}


def native_guard(source_guard, witness, proposal, obs):
    if witness is None or witness['schema'] != 'logos-engine.native.outline-required-service.v2': return source_guard
    receipt = {'schema': 'logos-engine.native.current-outline-public-binding.v1', 'rule': 'native.current_public_announcement_service',
        'observation_ref': obs['observation_ref'], 'level_epoch': obs['level_epoch'], 'frame_hash': obs['frame_hash'], 'source_guard': source_guard,
        'current_service_witness': witness, 'common_preservation_revalidated': bool(proposal.get('preservation')),
        'release_authority': False, 'action_effect_known': False}
    return {'admitted': True, 'reason': 'current_public_announcement_service_and_trial', 'native_binding_receipt': receipt}


def make_annex(before, after, command, first, second, source_state, selected, index, guard, witness):
    if before['level_epoch'] != after['level_epoch'] or before['levels_completed'] != after['levels_completed']: return None
    dispatched = None
    if selected is not None:
        assert guard['admitted'] and physical(command) == physical(selected['actions'][index])
        meaning = selected['outline_plan']['meaning']; goal = terminal = None
        if selected.get('requires_current_service_witness'):
            projected = witness['source_condition_receipt']['projected_facts']; goal = projected.get('active_goal_ref'); terminal = projected.get('active_terminal_goal_ref')
        elif meaning['kind'] == 'announced_correspondence_hypothesis' and meaning['rule_ref'] == 'outline_service.announced_accompaniment' and meaning['mechanism_ref'] == GOAL:
            goal = terminal = GOAL
        dispatched = {'proposal_ref': 'outline_dispatched:' + helper.digest(proposal_core(selected)), 'meaning_kind': meaning['kind'],
            'active_goal_ref': goal, 'active_terminal_goal_ref': terminal, 'observation_ref': before['observation_ref'],
            'frame_hash': before['frame_hash'], 'level_epoch': before['level_epoch'], 'action_index': index, 'command': command,
            'guard_admitted': True, 'provenance': 'actual_selected_outline_prefix_before_guard'}
    return {'schema': 'native.outline.public_transition.v1', 'before': scope(before), 'after': scope(after), 'command': command,
        'before_rows': first, 'before_rows_sha256': helper.digest(first), 'after_rows_sha256': helper.digest(second),
        'source_state_ref': 'outline_source:' + helper.digest(source_state), 'selected_outline': dispatched,
        'qualification': 'Only the immediately preceding actual public transition is retained. Its raster is evidence for the unchanged V5 previous-frame measurement, not a future action sequence or an effect guarantee.'}


def verify_coordination(receipt, witness, prefix, obs, prefix_index, receipt_index, guard):
    where = f'prefix.{prefix_index}.coordination.{receipt_index}'
    assert receipt['rule'] == COORDINATION_RULE and receipt['observation_ref'] == obs['observation_ref']
    assert receipt['preferred_family'] == prefix['family'] == 'public_outline_service'
    assert receipt['selected_group'] == prefix['selectionGroup'] and receipt['selected_subquestion'] == prefix['materialSubquestion']
    assert receipt['source_trigger_index'] < receipt['selected_group_index'] and receipt['primitive_bound'] == 1
    assert receipt['replan_after_each_primitive'] is True and receipt['physical_action_authorized'] is False
    assert receipt['source_state_ref'] == 'family_state:public_outline_service' and type(receipt['source_state_revision']) is int
    assert receipt['guard_reason'] == guard['reason']
    independent = receipt['independent_unknown_effect_question']
    assert independent['status'] == 'unknown_effect_inquiry_with_measured_access' and independent['effect_status'] == 'unobserved'
    assert independent['observation_ref'] == obs['observation_ref'] and independent['level_epoch'] == obs['level_epoch']
    assert independent['contact_evidence'] == [] and independent['physical_action_authorized'] is False
    base.own_check(receipt['current_required_service'], witness, where + '.independently.reconstructed.service')
    NATIVE_ANNOTATIONS.append({'prefixIndex': prefix_index, 'receiptIndex': receipt_index, 'kind': 'native_coordination_metadata',
        'deferredProviderReconstructed': False, 'deferredWitnessSha256': digest(independent),
        'preferredTransportDigest': receipt['preferred_proposal_digest'], 'preferredTransportProfile': receipt['preferred_proposal_digest_profile'],
        'sourceStateRevision': receipt['source_state_revision'], 'completeReceiptSha256': digest(receipt)})


def compare(paths, game, allow_failed):
    campaign, trace, execution, native, packet_checks = base.verify_input(paths, game, allow_failed)
    initial_reference = load(ROOT / 'tests/fixtures/v6-outline-service-reference.json.gz')
    observation_scope = base.retained_scope(campaign)
    observations = [base.observe(SimpleNamespace(**item['packet']), index + 1, observation_scope)[0] for index, item in enumerate(trace['packets'])]
    subsets = {kind: extract_subset(kind, paths['archive']) for kind in ('continuation', 'operator')}
    family = helper.OutlineService(); cold = plain(family.state()); check(cold, initial_reference['initialState'], 'cold.original.state')
    frontier = ObservedFrontier(target_levels=campaign['targetLevels'], max_prefix=16)
    frontier.observe(observations[0])
    cursor = boundary = 0; annex = None; counts = Counter()
    prefix_checks, proposals, acquisitions, witness_checks, refusal_checks, wrappers, caller_metadata = [], [], [], [], [], [], []
    first_control = None
    helper.AUDIT_ACTIVE = True
    sys.setprofile(profile)
    try:
        for prefix_index, prefix in enumerate(campaign['prefixes']):
            if prefix_index % 10 == 0:
                print(json.dumps({'phase': 'independent_outline_public_context', 'prefix': prefix_index, 'prefixes': len(campaign['prefixes']), 'returns': cursor}), file=sys.stderr, flush=True)
            first_action = cursor + 1; obs = observations[cursor]; packet = trace['packets'][cursor]['packet']; rows = packet['frame_rows']
            assert prefix['decisionRevision'] == obs['revision']
            retained = prefix['outlineAcquisition']
            assert retained['stateNode'] == 'family_state:public_outline_service' and retained['checkpointFormat'] == PUBLIC_FORMAT
            owned = prefix.get('outlineService'); selected = witness = None; original = None; extended = False
            relevant_coordination = [(index, row) for index, row in enumerate(prefix.get('nativeCoordination', [])) if row.get('rule') == COORDINATION_RULE]
            for index, receipt in enumerate(prefix.get('nativeCoordination', [])):
                if receipt.get('rule') != COORDINATION_RULE:
                    NATIVE_ANNOTATIONS.append({'prefixIndex': prefix_index, 'receiptIndex': index, 'kind': 'other_coordination', 'rule': receipt.get('rule'), 'sha256': digest(receipt)})
            if owned:
                assert prefix['family'] == 'public_outline_service' and prefix['selectionGroup'] == 'factored_material_return'
                assert prefix['materialSubquestion'] == 'observed_outline_service' and owned['stateNode'] == retained['stateNode']
                remaining = campaign['budget']['levelActionCaps'][min(obs['level_epoch'] - 1, len(campaign['budget']['levelActionCaps']) - 1)] - (cursor - boundary)
                original, current, diagnostic, error = reconstruct_candidate(family, obs, rows, remaining, annex, subsets)
                assert error is None and current is not None, ('Independent current candidate unavailable', prefix_index, error)
                supplied = owned['proposal']; extended = current.get('requires_current_service_witness') is True
                assert (supplied.get('requires_current_service_witness') is True) == extended, (
                    'Current proposal construction differs', prefix_index, current['outline_plan']['meaning']['kind'],
                    supplied['outline_plan']['meaning']['kind'], extended, supplied.get('requires_current_service_witness'))
                if not extended: assert 'requires_current_service_witness' not in supplied
                selected = protect_actual_constraints(plain(current), supplied, obs, rows, prefix_index)
                if extended or relevant_coordination:
                    supplied_witness = supplied['native_current_service_witness'] if extended else relevant_coordination[0][1]['current_required_service']
                    trial = reconstruct_trial(supplied_witness['current_trial'], obs, current['actions'][0], frontier, prefix_index, caller_metadata)
                    witness = reconstruct_witness(family, current, obs, rows, annex, trial, subsets)
                    base.own_check(supplied_witness, witness, f'prefix.{prefix_index}.service.witness')
                    witness_checks.append({'prefixIndex': prefix_index, 'actualActionIndex': first_action, 'schema': witness['schema'],
                        'mode': witness.get('mode', 'strict_current_announcement'), 'witnessSha256': digest(witness),
                        'originalConditionResultSha256': digest(witness['source_condition_receipt']), 'originalSourceGuard': witness['source_guard'],
                        'actualGlobalInventorySha256': digest(trial['effectful_action_context']),
                        'actualGlobalPositiveEdges': len(trial['effectful_action_context']['witnesses']),
                        'actualCurrentEpochReturnsConsidered': trial['effectful_action_context']['considered_transition_count'],
                        'actualParentDispatch': annex['selected_outline'] if extended else None, 'earlierTrialsAtExactPublicContext': 0})
                    counts['sourceDeclaredServiceWitnesses'] += 1
                if extended:
                    assert prefix['acquiredActions'] == 1
                    admission = supplied['native_current_service_admission']
                    assert type(admission['source_state_revision']) is int and admission['source_state_revision'] > 0
                    expected_admission = {'rule': 'current_required_service_witness_on_every_selection_path',
                        'source_state_ref': 'family_state:public_outline_service', 'source_state_revision': admission['source_state_revision'],
                        'trial_state_ref': 'caller:frontier', 'trial_state_revision': witness['current_trial']['source_state_revision'],
                        'observation_ref': obs['observation_ref'], 'release_authority': False}
                    check(admission, expected_admission, f'prefix.{prefix_index}.service.admission')
                    selected['native_current_service_witness'] = witness; selected['native_current_service_admission'] = expected_admission
                    NATIVE_ANNOTATIONS.append({'prefixIndex': prefix_index, 'kind': 'native_owner_revision', 'sourceStateRevision': admission['source_state_revision']})
                    counts['nativeExtendedPrefixes'] += 1; counts['nativeExtension:' + current['native_outline_public_context']['kind']] += 1
                else:
                    assert original is not None
                    base.own_check(current, original, f'prefix.{prefix_index}.original.proposal.unmodified')
                    counts['strictOriginalPrefixes'] += 1
                family.bind(selected, None)
                extras = set(supplied) - set(selected)
                assert extras <= base.WRAPPER_KEYS and not (set(selected) - set(supplied)), (prefix_index, sorted(extras))
                expected_hash = base.own_check({key: value for key, value in supplied.items() if key not in extras}, selected, f'prefix.{prefix_index}.entire.provider.proposal')
                wrappers.append({'prefixIndex': prefix_index, 'fields': sorted(extras), 'sha256': digest({key: supplied[key] for key in sorted(extras)})})
                source_guard = family.before(selected, 0, SimpleNamespace(**packet), obs)
                expected_guard = native_guard(source_guard, witness, selected, obs)
                for receipt_index, receipt in relevant_coordination:
                    verify_coordination(receipt, witness, prefix, obs, prefix_index, receipt_index, expected_guard)
                    counts['coordinationReceiptsCompared'] += 1
                proposals.append({'prefixIndex': prefix_index, 'firstAction': first_action, 'classification': 'native_public_context_extension' if extended else 'unchanged_original_component',
                    'proposal': selected, 'originalProposalOnSameAcquiredState': plain(original), 'originalProposalWasNull': original is None,
                    'originalProposalParityAsserted': not extended, 'sourceMeasurementAddendum': diagnostic,
                    'allProviderFieldsCompared': True, 'independentAndNativeProjectionSha256': expected_hash})
                counts['selectedOutlinePrefixes'] += 1
            else:
                assert prefix['family'] != 'public_outline_service' and not relevant_coordination
                counts['foreignPrefixes'] += 1
            for refusal_index, envelope in enumerate(prefix.get('nativeProposalRefusals', [])):
                if envelope.get('family') != 'public_outline_service': continue
                refusal = envelope['refusal']; candidate, _current, _diagnostic, error = reconstruct_candidate(family, obs, rows, 1, annex, subsets)
                assert error is not None and candidate is None
                expected = {'schema': 'logos-engine.native.outline-domain-refusal.v1', 'rule': 'native.retain_outline_measurement_domain_refusal',
                    'provider': 'public_outline_service', 'observation_ref': obs['observation_ref'], 'level_epoch': obs['level_epoch'], 'frame_hash': obs['frame_hash'],
                    'owner_state_ref': 'outline_owner:' + helper.digest(plain(family.state())), 'field': error['field'], 'value': error['value'], 'limit': 64,
                    'source_error': 'Outline interaction measurement count exceeds its source contract',
                    'evidence_refs': unique([obs['observation_ref'], *(family.control or {}).get('evidence', [])]),
                    'status': 'unknown', 'domain_status': 'source_contract_exceeded', 'release_authority': False, 'acquisition_truncated': False,
                    'impossibility_established': False,
                    'qualification': 'The retained observations exceed the original InteractionProbeInput count domain. All source transitions remain intact; this optional native refusal neither refutes the service nor proves a permitted action.'}
                check(refusal, expected, f'prefix.{prefix_index}.domain.refusal.{refusal_index}')
                refusal_checks.append({'prefixIndex': prefix_index, 'refusalIndex': refusal_index, 'sourceException': error,
                    'nativeRefusalSha256': digest(refusal), 'qualification': 'Original source raises; native explicit unknown refusal retains that domain limit without truncating acquisition.'})
                counts['sourceDomainRefusalsCompared'] += 1
            acquired_offset = binding_offset = 0
            for step in range(prefix['acquiredActions']):
                first, second = trace['packets'][cursor]['packet'], trace['packets'][cursor + 1]['packet']
                before, after = observations[cursor:cursor + 2]; host_command = trace['packets'][cursor + 1]['command']
                if selected is not None: command = copy.deepcopy(selected['actions'][step])
                elif host_command['action_ref'] != 'ACTION6':
                    assert prefix['family'] in base.BARE_DISCRETE_FOREIGN_PROVIDERS, ('Unaudited foreign discrete provider', prefix['family'])
                    assert set(host_command) == {'action_ref', 'data'} and host_command['data'] == {}
                    command = {'action_ref': host_command['action_ref']}
                else: command = copy.deepcopy(host_command)
                check(host_command, physical(command), f'physical.command.{cursor + 1}')
                source_guard = guard = outcome = preservation = None
                if selected is not None:
                    source_guard = family.before(selected, step, SimpleNamespace(**first), before)
                    assert source_guard['admitted']
                    guard = native_guard(source_guard, witness, selected, before)
                    preservation = check_preservation(selected, first['frame_rows'], before['level_epoch'], observation=before)
                    assert preservation['admitted']
                    outcome = family.after(selected, step, before, after, first['frame_rows'], second['frame_rows'])
                    if outcome.get('seal_prefix'): assert step + 1 == prefix['acquiredActions']
                    if extended:
                        actual_binding = prefix['nativeBindings'][binding_offset]; binding_offset += 1
                        expected_binding = {'index': step, 'observation_ref': before['observation_ref'], 'command': command,
                            'native_binding_receipt': guard['native_binding_receipt'], 'evidence_node': 'reasoning:binding:' + str(before['revision']),
                            'retainedGuard': {'observation_ref': before['observation_ref'], 'level_epoch': before['level_epoch'], 'frame_hash': before['frame_hash'],
                                'command': command, 'guard': guard,
                                'qualification': 'Current public input binding retained before ordinary WHY/ACT release; no physical effect or terminal role is inferred.'}}
                        base.own_check(actual_binding, expected_binding, f'prefix.{prefix_index}.actual.WHY_ACT.binding.{step}')
                        counts['rawExtendedGuardsAndWhyActBindingsCompared'] += 1
                    counts['recomputedAdmittedSourceGuards'] += 1; counts['recomputedSourceOutcomes'] += 1
                event = family.record(before, after, command, first['frame_rows'], second['frame_rows'], selected, step)
                if selected is not None or event is not None:
                    fact = retained['acquired'][acquired_offset]; acquired_offset += 1
                    assert fact['key'] == 'outline_service_event:' + str(before['revision'])
                    assert fact['evidence'] == after['observation_ref'] and fact['revision'] == after['revision']
                    base.own_check(fact['result'], event, f'actual.source.acquisition.{cursor + 1}')
                    counts['retainedAcquisitionFactsCompared'] += 1
                annex = make_annex(before, after, command, first['frame_rows'], second['frame_rows'], plain(family.state()), selected, step, guard, witness)
                if first_control is None and family.control is not None:
                    first_control = {'actionIndex': cursor + 1, 'observation_ref': after['observation_ref'], 'control': plain(family.control)}
                if event is not None:
                    counts['sourceNonNullEvents'] += 1; counts['event:' + event['status']] += 1
                acquisitions.append({'actionIndex': cursor + 1, 'prefixIndex': prefix_index, 'owned': selected is not None,
                    'candidateConstruction': 'native_public_context_extension' if extended else 'original_component' if selected is not None else 'foreign_provider',
                    'actualComponentCommand': command, 'physicalTransportCommand': host_command, 'sourceGuard': source_guard,
                    'extensionGuard': guard if extended else None, 'sourcePreservationCheck': preservation, 'sourceOutcome': plain(outcome),
                    'sourceAcquisition': plain(event), 'sourceStateSha256': digest(plain(family.state())),
                    'lastActualTransitionAnnexSha256': digest(annex), 'rawNativeGuardCompared': extended})
                frontier.record_transition(before, command, after)
                counts['sourceAcquisitionCalls'] += 1; counts['actualFrontierTransitionsReconstructed'] += 1
                cursor += 1
                if after['levels_completed'] > before['levels_completed']: boundary = cursor
            assert acquired_offset == len(retained['acquired'])
            if selected is not None: assert binding_offset == len(prefix.get('nativeBindings', []))
            expected_checkpoint = {'format': PUBLIC_FORMAT, 'source_state': plain(family.state()), 'public_transition': annex}
            state_hash = base.own_check(retained['sourceState'], family.state(), f'prefix.{prefix_index}.seven.source.fields')
            checkpoint_hash = base.own_check(retained['nativeCheckpoint'], expected_checkpoint, f'prefix.{prefix_index}.complete.native.checkpoint')
            prefix_checks.append({'prefixIndex': prefix_index, 'firstAction': first_action, 'lastAction': cursor, 'owned': selected is not None,
                'sourceStateFields': sorted(family.state()), 'sourceAndNativeStateSha256': state_hash,
                'independentAndNativeCheckpointSha256': checkpoint_hash, 'completeNativeCheckpointCompared': True,
                'retainedAcquisitionFactsCompared': acquired_offset, 'publicAnnexIsExactlyLastActualReturn': True,
                'publicAnnexNullAtBoundary': annex is None})
        assert cursor == campaign['final']['actions']
        final_state = plain(family.state())
        final_measurement = contracts.capture(lambda: family.measure(observations[-1], trace['packets'][-1]['packet']['frame_rows']))
        check(plain(family.state()), final_state, 'final.original.measurement.readonly')
    finally: sys.setprofile(None)
    helper.AUDIT_ACTIVE = False
    assert not contracts.PENDING and helper.verify_source_manifest() == helper.VERIFIED_SOURCE
    check(proof(paths['archive']), load(paths['archiveManifest'])['archive'], 'frozen.archive.after')
    recipes = [contracts.RECIPES[key] for key in sorted(contracts.RECIPES)]
    dependency_names = ['scripts/compare-v53-outline-public-evidence.py', 'scripts/export-v6-outline-service-reference.py', 'scripts/probe-v6-outline-service-original.py']
    return {'schema': 'logos-engine.v53.outline-public-context-independent-comparison.v1', 'status': 'passed', 'game': game,
        'nativeCampaignStatus': campaign['status'], 'nativeCompletedLevels': campaign['final']['levelsCompleted'], 'nativeFinalState': campaign['final'].get('state'),
        'nativeSourceDigest': native['digest'], 'nativeSourceFiles': native['fileCount'], 'referenceCommit': helper.COMMIT,
        'sourceFilesVerifiedBeforeImport': 1786, 'sourceFilesVerifiedAfterComparison': 1786, 'sourceUnchanged': True,
        'nativeSourceUnchangedDuringCampaign': True, 'frozenNativeSourceArchiveVerified': True,
        'generator': proof(Path(__file__)), 'immutableGeneratorDependencies': [proof(ROOT / name) for name in dependency_names],
        'inputs': {key: proof(path) for key, path in paths.items()}, 'originalReference': proof(ROOT / 'tests/fixtures/v6-outline-service-reference.json.gz'),
        'observationScope': observation_scope, 'coldInitialState': cold, 'counts': dict(sorted(counts.items())),
        'publicPacketsCompared': len(packet_checks), 'completePublicJournalMatched': True, 'packetChecks': packet_checks,
        'animationFramesIncludingInitial': sum(row['frames'] for row in packet_checks), 'prefixChecks': prefix_checks,
        'proposals': proposals, 'acquisitionChecks': acquisitions, 'witnessChecks': witness_checks, 'domainRefusalChecks': refusal_checks,
        'firstAcquiredControl': first_control, 'finalSourceState': final_state, 'finalSourceMeasurement': plain(final_measurement),
        'sourceDeclarationSubsets': {key: {name: subset[name] for name in ('subset_ref', 'document', 'fragments', 'source', 'nativeSource')} for key, subset in subsets.items()},
        'callerWrapperAnnotations': wrappers, 'nativeSrcAnnotations': base.ANNOTATIONS,
        'nativeCallerMetadataInventoried': NATIVE_ANNOTATIONS, 'frontierPersistenceAnnotations': caller_metadata,
        'preservationInputs': PRESERVATION_INPUTS, 'qualifiedIdentityRecipeCount': len(recipes), 'footprint': helper.source_footprint(),
        'sourceReceiptFieldsCompared': sorted(base.SOURCE_RECEIPT_KEYS), 'allowedNativeSrcAnnotationFields': sorted(base.NATIVE_RECEIPT_KEYS),
        'differenceCount': 0, 'differences': [],
        'qualification': {'hostExecuted': False, 'nativeAgentExecuted': False, 'nativeOutputsUsedAsExpected': False,
            'sourceRewritten': False, 'nativeExtendedCandidateIsOriginalV6Proposal': False, 'fullOriginalCallerParity': False,
            'fullV5CallerContextParity': False, 'counterfactualReturnInvented': False, 'frontierPersistenceChainReconstructed': False,
            'historicalPreservationProducerReconstructed': False, 'deferredProviderReconstructed': False,
            'ordinaryRawNativeGuardsAvailable': False, 'extendedRawNativeGuardsAndWhyActBindingsCompared': True,
            'scope': 'All actual public returns are acquired once by unchanged original Outline Python, with seven-field checkpoints compared in full. Default proposals are compared to original propose. Extended proposals are explicitly reconstructed native compositions of original V5 prior-frame measurement and exact source declarations; the original proposal on that same acquired state is retained separately. The one-return annex, actual parent dispatch, all exact-context prior trials and all positive final-raster action witnesses are recomputed from the public trajectory. The three frontier persistence annotations and native owner revisions are inventoried, not asserted as full original-caller parity. Actual caller preservation obligations are explicit inputs to unchanged original binding and current public checks; no protection field is removed. Failed games remain failed and no new action is dispatched by this comparator.'}}, recipes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory'); parser.add_argument('game')
    parser.add_argument('--allow-failed-campaign', action='store_true'); parser.add_argument('--verify', action='store_true')
    args = parser.parse_args(); out = ROOT / args.directory; stem = args.game.lower()
    paths = {'campaign': out / (stem + '-campaign.json.gz'), 'trace': out / (stem + '-public-trace.json.gz'),
        'execution': out / ('execution-' + stem + '.json'), 'source': out / 'source-manifest.json',
        'archiveManifest': out / 'source-archive.json', 'archive': out / 'source-archive.tar.gz'}
    output = out / 'outline-public-context-independent-comparison.json.gz'
    recipe_path = out / 'outline-public-context-identity-recipes.json.gz'
    if not args.verify: assert not output.exists() and not recipe_path.exists(), 'Refusing to replace retained evidence'
    result, recipes = compare(paths, args.game, args.allow_failed_campaign)
    identity = {'schema': 'logos-engine.v53.outline-public-context-identity-recipes.v1', 'sourceCommit': helper.COMMIT,
        'nativeSourceDigest': result['nativeSourceDigest'], 'generator': proof(Path(__file__)), 'recipes': recipes,
        'scope': 'Unchanged original Outline/V5 component identities on actual public inputs; separate native-composition identities use explicitly named safe-integer JSON contracts.'}
    if args.verify:
        check(load(recipe_path), identity, 'retained.public.context.identity.recipes')
        result['identityRecipes'] = proof(recipe_path); check(load(output), result, 'retained.public.context.comparison')
    else:
        helper.write_gzip_absent(recipe_path.relative_to(ROOT).as_posix(), identity)
        result['identityRecipes'] = proof(recipe_path); helper.write_gzip_absent(output.relative_to(ROOT).as_posix(), result)
    print(json.dumps({'status': result['status'], 'mode': 'verify' if args.verify else 'create', 'game': args.game,
        'nativeCampaignStatus': result['nativeCampaignStatus'], 'nativeCompletedLevels': result['nativeCompletedLevels'],
        'publicPackets': result['publicPacketsCompared'], 'prefixes': len(result['prefixChecks']), **result['counts'],
        'output': output.relative_to(ROOT).as_posix()}), flush=True)


if __name__ == '__main__': main()
