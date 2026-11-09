#!/usr/bin/env python3
"""Independent V5 prior-raster geometry and scoped operator-declaration cases.

Original Outline input is captured by a profiler, without replacing a source
function. Its V5 helper is then called with the actual previous public raster.
The extra temporal input and caller arbitration are explicitly not provided
by the original V6 Outline wrapper. No action or hidden host query is run.
"""
from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('outline_continuation_original', ROOT / 'scripts/export-v6-outline-continuation-reference.py')
source = importlib.util.module_from_spec(spec); spec.loader.exec_module(source)
contracts, helper = source.contracts, source.helper
from agents.yf_arc3_v5.drm.loader import _parse_drm_source
from agents.yf_arc3_v5.drm.registry import DrmRegistry
from agents.yf_arc3_v5.drm.contracts import DrmSelectionTier
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives, _projection_matches
from agents.yf_arc3_v5.drm.runtime import _first_matching_tier

SUBSET_REF = 'native.outline.current_public_operator_subset'
CAPTURE = False
CAPTURED = []


def plain(value): return source.plain(value)
def packed(value): return source.packed(value)
def digest(value): return source.digest(value)
def load(path): return source.load(path)
def proof(path): return source.proof(path)


def profile(frame, event, value):
    contracts.profile(frame, event, value)
    if CAPTURE and event == 'call' and frame.f_code is helper._compact_body_perimeter_marker_accompaniment.__code__:
        CAPTURED.append(frame.f_locals['value'])


def extraction():
    source_path = helper.SOURCE / 'agents/yf_arc3_v5/drm/interaction.drm'
    raw = json.loads(source_path.read_text()); policy = raw['declarations'][217]
    projection, tier_raw = policy['fact_projections'][1296], policy['selection_tiers'][19]
    assert projection['id'] == 'projection.exploration.tool_on_obstructing_other_inset_opens_scoped_operator_question'
    assert tier_raw['id'] == 'tier.current_tool_on_obstructing_other_inset_operator_question'
    assert projection['all_conditions'] == tier_raw['all_conditions']
    document = {'module_id': SUBSET_REF, 'declarations': [{'id': SUBSET_REF, 'kind': 'selection_policy',
        'reason_refs': [tier_raw['reason_ref']], 'evaluation': 'declared_eligibility_single',
        'supported_operators': policy['supported_operators'], 'input_contract': policy['input_contract'],
        'output_contract': policy['output_contract'], 'fact_projections': [projection]}]}
    text = packed(document); loaded = _parse_drm_source(text)
    registry = DrmRegistry(); registry.register(loaded); registry.seal()
    declaration = registry.resolve(SUBSET_REF)[0]
    tier = DrmSelectionTier.model_validate(tier_raw)
    later_tier = DrmSelectionTier.model_validate(policy['selection_tiers'][20])
    subset = {'source': proof(source_path), 'sourcePolicyRef': policy['id'], 'subsetPolicyRef': SUBSET_REF,
              'document': {'text': text.decode(), 'sha256': hashlib.sha256(text).hexdigest()},
              'selectionTier': tier_raw, 'sourceDeclarations': [
                  {'id': projection['id'], 'path': ['declarations', 217, 'fact_projections', 1296], 'declaration': projection, 'canonicalSha256': digest(projection)},
                  {'id': tier_raw['id'], 'path': ['declarations', 217, 'selection_tiers', 19], 'declaration': tier_raw, 'canonicalSha256': digest(tier_raw)}],
              'followingTier': {'path': ['declarations', 217, 'selection_tiers', 20], 'declaration': policy['selection_tiers'][20]},
              'originalStrictLoaderAccepted': True,
              'configurationScope': 'One exact source projection in a typed projection-only subset wrapper, plus one exact source tier outside that wrapper. The wrapper eligibility counters are not the complete V5 policy eligibility. The original adjacent tiers19/20 are tested separately in their original relative order. No SELECT authority or new caller priority is executed.'}
    return registry, declaration, tier, later_tier, subset


def evaluate(registry, declaration, tier, facts):
    result = project_declared_alternatives(drm=registry, selection_policy_ref=SUBSET_REF,
        alternative_refs=(facts['candidate_ref'],), descriptive_facts=facts)
    projected = result.alternative_facts[facts['candidate_ref']]
    _index, matched = _first_matching_tier(projected, (tier,))
    complete = tuple(result.projection_refs) == tuple(row.id for row in declaration.fact_projections)
    return {'projection_result': plain(result), 'projected_facts': plain(projected), 'matched_tier_ref': matched.id if matched else None,
            'all_required_projections_matched': complete, 'matched': complete and matched is not None}


def rule_cases(registry, declaration, tier, later_tier):
    conditions = []
    for rule, kind in [(declaration.fact_projections[0], 'projection'), (tier, 'tier')]:
        baseline = {condition.field: plain(condition.expected) for condition in rule.all_conditions}
        def add(name, facts):
            value = _first_matching_tier(facts, (rule,))[1] is not None if kind == 'tier' else _projection_matches(rule.all_conditions, rule.any_conditions, facts)
            conditions.append({'id': rule.id + ':' + name, 'kind': kind, 'ruleRef': rule.id, 'facts': facts, 'value': value})
        for bits in itertools.product([False, True], repeat=7):
            facts = {condition.field: plain(condition.expected) if bit else source.other(condition.expected) for condition, bit in zip(rule.all_conditions, bits)}
            add('matrix_' + ''.join('1' if bit else '0' for bit in bits), facts)
        for condition in rule.all_conditions:
            for name, replacement in [('missing', None), ('null', None), ('wrong_type', int(condition.expected) if type(condition.expected) is bool else bool(condition.expected) if type(condition.expected) is int else 1)]:
                facts = copy.deepcopy(baseline)
                if name == 'missing': del facts[condition.field]
                else: facts[condition.field] = replacement
                add(condition.field + ':' + name, facts)
    base = {'candidate_ref': 'candidate:controlled:operator', 'action_ref': 'ACTION5',
            **{condition.field: plain(condition.expected) for condition in tier.all_conditions}}
    projections = []
    def projected(name, facts): projections.append({'id': name, 'facts': facts, **contracts.capture(lambda: evaluate(registry, declaration, tier, facts))})
    for bits in itertools.product([False, True], repeat=7):
        facts = copy.deepcopy(base)
        for condition, bit in zip(tier.all_conditions, bits): facts[condition.field] = plain(condition.expected) if bit else source.other(condition.expected)
        projected('matrix_' + ''.join('1' if bit else '0' for bit in bits), facts)
    for field in base:
        if field == 'candidate_ref': continue
        facts = copy.deepcopy(base); del facts[field]; projected('missing:' + field, facts)
        projected('null:' + field, {**copy.deepcopy(base), field: None})
    for name, override in [
        ('unrelated_payload_preserved', {'foreign': {'fields': [1, True, None]}}),
        ('source_does_not_clear_unmentioned_complete_series_field', {'declared_complete_series_authorized': True}),
        ('source_clears_committed_plan_but_not_unmentioned_declared_plan', {'committed_plan_ref': 'plan:prior', 'declared_plan_ref': 'plan:unmentioned'}),
        ('conditional_and_deterministic_series_cleared', {'declared_conditional_series_authorized': True, 'declared_deterministic_series_authorized': True}),
        ('bounds_overwritten_by_declared_one_step', {'remaining_step_count': 9, 'remaining_action_bound': 9, 'release_remaining_action_bound': 9}),
        ('candidate_unicode', {'candidate_ref': 'candidate:opérateur:中'}),
    ]: projected(name, {**copy.deepcopy(base), **override})
    operator = {condition.field: plain(condition.expected) for condition in tier.all_conditions}
    accompany = {condition.field: plain(condition.expected) for condition in later_tier.all_conditions}
    combined = {**operator, **accompany}
    orders = []
    for name, facts in [('operator_only', operator), ('accompaniment_only', accompany), ('both_declared_matches', combined),
                        ('neither', {}), ('missing_dispatched_goal_falls_to_later_tier', {key: value for key, value in combined.items() if key != 'dispatched_composition_active_goal_ref'}),
                        ('known_prior_trial_blocks_both', {**combined, 'attempted_without_effect_in_current_context': True})]:
        index, matched = _first_matching_tier(facts, (tier, later_tier))
        orders.append({'id': name, 'facts': facts, 'value': {'relativeTierIndex': index, 'matched_tier_ref': matched.id if matched else None},
                       'qualification': 'Explicit isolated comparison of original adjacent tiers19/20, not complete V5 selection or V6 arbitration.'})
    return conditions, projections, orders


def input_fields(value):
    out = {}
    for name in sorted(value.model_fields_set):
        if name in ['frame', 'components', 'route_generation_policy']: continue
        item = getattr(value, name)
        if name.endswith('_bboxes'): out[name] = [[box.left, box.top, box.right, box.bottom] for box in item]
        elif name in ['current_observed_frame', 'previous_action_observed_frame'] and item is not None: out[name] = plain(item.rows)
        else: out[name] = plain(item)
    return out


def public_geometry(registry, declaration, tier):
    global CAPTURE
    directory = ROOT / 'docs/migration/native-campaigns-v53/attempt2'
    report_path, trace_path = directory / 'esct-campaign.json.gz', directory / 'esct-public-trace.json.gz'
    report, trace = load(report_path), load(trace_path)
    assert report['status'] == 'failed' and report['final']['levelsCompleted'] == 0
    assert report['final']['actions'] == 128 and len(trace['packets']) == 129
    scope = report['prefixes'][0]['sharedSeries']['epochAnchors'][0]['observation_ref'].split(':epoch:')[0]
    observations = [source.observe(SimpleNamespace(**row['packet']), index + 1, scope)[0] for index, row in enumerate(trace['packets'][:14])]
    family = helper.OutlineService(); cursor = 0; scenes, cases = [], []
    for prefix_index, prefix in enumerate(report['prefixes']):
        selected = family.propose(observations[cursor], trace['packets'][cursor]['packet']['frame_rows'], [], report['budget']['levelActionCaps'][0] - cursor) if prefix['family'] == 'public_outline_service' else None
        if prefix['family'] == 'public_outline_service': assert selected is not None
        for step in range(prefix['acquiredActions']):
            first, second = [row['packet']['frame_rows'] for row in trace['packets'][cursor:cursor + 2]]
            command = selected['actions'][step] if selected else {'action_ref': trace['packets'][cursor + 1]['command']['action_ref']}
            assert trace['packets'][cursor + 1]['command'] == {'action_ref': command['action_ref'], 'data': {}}
            family.record(observations[cursor], observations[cursor + 1], command, first, second, selected, step)
            cursor += 1
            if cursor not in [11, 13]: continue
            rows, previous = second, first
            obs = observations[cursor]; retained = plain(family.state()); CAPTURED.clear(); CAPTURE = True
            try: measured = family.measure(obs, rows)
            finally: CAPTURE = False
            assert len(CAPTURED) == 1 and plain(family.state()) == retained
            original_input = CAPTURED[0]; fields = input_fields(original_input); route_config = plain(original_input.route_generation_policy)
            reconstructed = contracts.interaction(rows, fields, route_config)
            assert plain(original_input) == plain(reconstructed)
            strict = plain(helper._compact_body_perimeter_marker_accompaniment(original_input))
            assert strict == [plain(measured['accompaniment']), plain(measured['relation'])]
            extended_fields = {**copy.deepcopy(fields), 'previous_action_observed_frame': previous}
            extended = plain(helper._compact_body_perimeter_marker_accompaniment(contracts.interaction(rows, extended_fields, route_config)))
            assert strict[1]['same_value_compact_body_hollow_perimeter_marker_triplet_count'] == 0
            assert extended[1]['same_value_compact_body_hollow_perimeter_marker_triplet_count'] == 1
            assert extended[1]['other_compact_body_marker_immediate_contact_count'] == 0
            assert next(iter(extended[0].values()))['controlled_lead_relation'] == 'cardinal_offset_after_observed_announced_step'
            scene = {'afterActualAction': cursor, 'prefixIndex': prefix_index, 'observation': plain(obs), 'sourceState': retained,
                     'currentRows': rows, 'previousRows': previous, 'previousObservation': plain(observations[cursor - 1]),
                     'actualCommand': command, 'originalV6Measurement': plain(measured), 'originalInteractionFields': fields,
                     'routeConfig': route_config, 'strictV5Helper': strict, 'withActualPreviousRasterV5Helper': extended,
                     'onlyAddedInput': 'previous_action_observed_frame', 'sourceStateUnchangedByMeasurements': True}
            scenes.append(scene)
            variants = [('strict_original_input', fields), ('actual_previous_public_final_frame', extended_fields),
                        ('controlled_previous_equals_current', {**copy.deepcopy(fields), 'previous_action_observed_frame': rows}),
                        ('controlled_blank_previous', {**copy.deepcopy(fields), 'previous_action_observed_frame': [[0] * len(rows[0]) for _ in rows]}),
                        ('controlled_older_public_frame', {**copy.deepcopy(fields), 'previous_action_observed_frame': trace['packets'][cursor - 2]['packet']['frame_rows']}),
                        ('controlled_last_action_unknown', {**copy.deepcopy(extended_fields), 'last_action_ref': None}),
                        ('controlled_no_control_identity', {**copy.deepcopy(extended_fields), 'canonical_provisional_control_term_facts': []}),
                        ('controlled_no_public_directions', {**copy.deepcopy(extended_fields), 'available_action_refs': ['ACTION5', 'ACTION7']})]
            for name, candidate_fields in variants:
                value = helper._compact_body_perimeter_marker_accompaniment(contracts.interaction(rows, candidate_fields, route_config))
                cases.append({'id': f'actual_{cursor}:' + name, 'operation': 'perimeterAccompaniment',
                    'arguments': {'rows': rows, 'fields': plain(candidate_fields), 'routeConfig': route_config}, 'value': plain(value),
                    'qualification': 'Actual public measurement input.' if name in ['strict_original_input', 'actual_previous_public_final_frame'] else 'Controlled input mutation of a retained public scene; not a new observation or acquired transition.'})
            facts = {**extended[1], 'candidate_ref': 'controlled:operator:after:' + str(cursor), 'action_ref': family.config['interface_prior']['interaction'],
                     'interaction_measurement_kind': 'discrete'}
            conditional = {**facts, 'dispatched_composition_active_goal_ref': 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter',
                           'candidate_is_unique_effectful_nondirectional_local_action': True, 'attempted_without_effect_in_current_context': False}
            scene['withoutCallerPremises'] = evaluate(registry, declaration, tier, facts)
            scene['conditionalOnAllThreeCallerPremises'] = evaluate(registry, declaration, tier, conditional)
            assert scene['withoutCallerPremises']['matched'] is False
            assert scene['conditionalOnAllThreeCallerPremises']['matched'] is extended[1]['controlled_lead_covers_other_inset_on_body_target_segment']
            scene['callerPremiseQualification'] = 'The dispatched goal, global uniqueness of an observed effectful nondirectional action and exact current trial absence must come from actual common-caller evidence. They are not inferred from the Outline interface prior or its local attempts. The conditional evaluation tests their declared interpretation only.'
        if cursor >= 13: break
    assert cursor == 13 and len(scenes) == 2
    return {'campaign': proof(report_path), 'trace': proof(trace_path), 'freshOriginalAcquisitionCount': cursor,
            'publicPacketsUsed': 14, 'scenes': scenes}, cases


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--verify', action='store_true'); args = parser.parse_args()
    output = ROOT / 'tests/fixtures/v6-outline-prior-raster-reference.json.gz'
    receipt_path = ROOT / 'docs/migration/native-campaigns-v53/source-reference-prior-raster.json'
    if not args.verify: assert not output.exists() and not receipt_path.exists(), 'Refusing to overwrite retained evidence'
    sys.setprofile(profile)
    try:
        registry, declaration, tier, later_tier, subset = extraction()
        conditions, projections, tiers = rule_cases(registry, declaration, tier, later_tier)
        public, geometry = public_geometry(registry, declaration, tier)
    finally: sys.setprofile(None)
    helper.AUDIT_ACTIVE = False
    assert not contracts.PENDING and helper.verify_source_manifest() == helper.VERIFIED_SOURCE
    fixture = {'schema': 'logos-engine.v53.outline-prior-raster-original-reference.v1', 'sourceCommit': helper.COMMIT,
        'sourceFilesVerifiedBeforeImport': 1786, 'sourceFilesVerifiedAfterExport': 1786, 'sourceUnchanged': True,
        'generator': proof(Path(__file__)), 'subset': subset, 'conditionCases': conditions, 'projectionCases': projections,
        'tierOrderCases': tiers, 'geometryCases': geometry, 'actualPublicMeasurements': public, 'footprint': helper.source_footprint(),
        'counts': {'sourceDeclarations': 2, 'conditionCases': len(conditions), 'projectionCases': len(projections),
                   'tierOrderCases': len(tiers), 'geometryCases': len(geometry), 'actualPublicScenes': len(public['scenes'])},
        'qualification': {'nativeExecuted': False, 'hostExecuted': False, 'nativeOutputsUsedAsExpected': False,
            'originalV6WrapperSuppliesPreviousRaster': False, 'fullV5SelectionParity': False, 'fullV6CallerParity': False,
            'scope': 'Original V5 helper geometry on inputs captured from unchanged original V6 Outline.measure, augmented solely with the actual immediately preceding public final raster. Other variants are explicit controlled cases. Exact projection1296/tier19 and relative order19/20 are evaluated by unchanged original DRM code. The common-caller premises and native annex/arbitration are separate obligations; no game success or new action is produced.'}}
    receipt = {'schema': 'logos-engine.v53.outline-prior-raster-original-reference-receipt.v1', 'status': 'passed',
        'sourceCommit': helper.COMMIT, 'sourceUnchanged': True, 'generator': proof(Path(__file__)), 'counts': fixture['counts'],
        'subsetDocumentSha256': subset['document']['sha256'], 'actualScenes': [
            {'afterActualAction': scene['afterActualAction'], 'strictTriplets': scene['strictV5Helper'][1]['same_value_compact_body_hollow_perimeter_marker_triplet_count'],
             'withPreviousTriplets': scene['withActualPreviousRasterV5Helper'][1]['same_value_compact_body_hollow_perimeter_marker_triplet_count'],
             'announcedActions': list(scene['withActualPreviousRasterV5Helper'][0]),
             'coveredOtherInset': scene['withActualPreviousRasterV5Helper'][1]['controlled_lead_covers_other_inset_on_body_target_segment']}
             for scene in public['scenes']], 'qualification': fixture['qualification']}
    if args.verify:
        assert load(output) == fixture; receipt['fixture'] = proof(output); assert load(receipt_path) == receipt
    else:
        helper.write_gzip_absent(output.relative_to(ROOT).as_posix(), fixture); receipt['fixture'] = proof(output)
        with receipt_path.open('x') as stream: json.dump(receipt, stream, indent=2, sort_keys=True); stream.write('\n')
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__': main()
