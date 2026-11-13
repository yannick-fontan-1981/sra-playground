#!/usr/bin/env python3
"""Qualify an explicit five-declaration V5 accompaniment subset.

The three original fact projections are evaluated by the unchanged original
project_declared_alternatives function and strict DRM loader. The original
tier is matched separately. This is not the complete V5 selection policy,
nor the V6 caller arbitration, and does not dispatch any action.
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
spec = importlib.util.spec_from_file_location('outline_original_contracts', ROOT / 'scripts/export-v6-outline-service-reference.py')
contracts = importlib.util.module_from_spec(spec); spec.loader.exec_module(contracts)
helper = contracts.helper
sys.path.insert(0, str(helper.SOURCE / 'agents/yf_arc3_v6/laya_proto'))
from neutral_observer import measure as observe
from agents.yf_arc3_v5.drm.loader import _parse_drm_source
from agents.yf_arc3_v5.drm.registry import DrmRegistry
from agents.yf_arc3_v5.drm.contracts import DrmSelectionTier
from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives, _projection_matches
from agents.yf_arc3_v5.drm.runtime import _first_matching_tier

SOURCE_FILE = helper.SOURCE / 'agents/yf_arc3_v5/drm/interaction.drm'
SUBSET_REF = 'native.outline.current_announced_service_subset'
POINTERS = [('declarations', 213), ('declarations', 217, 'fact_projections', 634),
            ('declarations', 217, 'fact_projections', 665), ('declarations', 217, 'fact_projections', 984),
            ('declarations', 217, 'selection_tiers', 20)]


def plain(value): return contracts.plain(value)
def packed(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
def digest(value): return hashlib.sha256(packed(value)).hexdigest()


def load(path):
    path = Path(path)
    with (gzip.open(path, 'rt') if path.suffix == '.gz' else path.open()) as stream: return json.load(stream)


def proof(path):
    path = Path(path)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}


def extraction():
    raw = json.loads(SOURCE_FILE.read_text())
    declarations = []
    for pointer in POINTERS:
        value = raw
        for key in pointer: value = value[key]
        declarations.append({'path': list(pointer), 'id': value['id'], 'declaration': value, 'canonicalSha256': digest(value)})
    document = {'module_id': SUBSET_REF, 'declarations': [declarations[0]['declaration'],
                {'id': SUBSET_REF, 'kind': 'selection_policy', 'reason_refs': [declarations[4]['declaration']['reason_ref']],
                 'evaluation': 'declared_eligibility_single',
                 'supported_operators': raw['declarations'][217]['supported_operators'],
                 'input_contract': raw['declarations'][217]['input_contract'],
                 'output_contract': raw['declarations'][217]['output_contract'],
                 'fact_projections': [row['declaration'] for row in declarations[1:4]]}]}
    text = packed(document)
    loaded = _parse_drm_source(text)
    registry = DrmRegistry(); registry.register(loaded); registry.seal()
    policy = registry.resolve(SUBSET_REF)[0]
    tier = DrmSelectionTier.model_validate(declarations[4]['declaration'])
    result = {'source': proof(SOURCE_FILE), 'sourcePolicyRef': raw['declarations'][217]['id'],
              'subsetPolicyRef': SUBSET_REF, 'sourceDeclarations': declarations,
              'document': {'text': text.decode(), 'sha256': hashlib.sha256(text).hexdigest()},
              'selectionTier': declarations[4]['declaration'], 'originalStrictLoaderAccepted': True,
              'configurationScope': 'Explicit projection wrapper containing exactly three source projections in their original relative order. Its declared_eligibility_single tag is wrapper metadata with no added eligibility condition or ordering; the source operator and input/output contract names are retained to satisfy the original strict declaration model. No authority SELECT is executed. The exact principle is retained as a declaration; the exact tier is evaluated separately, without the full V5 eligibility/precedence/tie-break policy.'}
    return registry, policy, tier, result


def evaluate(registry, policy, tier, facts):
    result = project_declared_alternatives(drm=registry, selection_policy_ref=SUBSET_REF,
        alternative_refs=(facts['candidate_ref'],), descriptive_facts=facts)
    projected = result.alternative_facts[facts['candidate_ref']]
    _index, matched = _first_matching_tier(projected, (tier,))
    complete = tuple(result.projection_refs) == tuple(row.id for row in policy.fact_projections)
    return {'projection_result': plain(result), 'projected_facts': plain(projected),
            'matched_tier_ref': matched.id if matched else None, 'all_required_projections_matched': complete,
            'matched': complete and matched is not None}


def other(value):
    if type(value) is bool: return not value
    if type(value) is int: return value + 1
    if isinstance(value, str): return 'controlled:other'
    raise TypeError(type(value))


def condition_cases(policy, tier):
    out = []
    for rule, kind in [(row, 'projection') for row in policy.fact_projections] + [(tier, 'tier')]:
        conditions = rule.all_conditions
        baseline = {condition.field: plain(condition.expected) for condition in conditions}
        def add(name, facts):
            if kind == 'tier': value = _first_matching_tier(facts, (rule,))[1] is not None
            else: value = _projection_matches(rule.all_conditions, rule.any_conditions, facts)
            out.append({'id': rule.id + ':' + name, 'kind': kind, 'ruleRef': rule.id, 'facts': facts, 'value': value})
        for bits in itertools.product([False, True], repeat=len(conditions)):
            facts = {condition.field: plain(condition.expected) if bit else other(condition.expected) for condition, bit in zip(conditions, bits)}
            add('matrix_' + ''.join('1' if bit else '0' for bit in bits), facts)
        for condition in conditions:
            for name, replacement in [('missing', None), ('null', None), ('wrong_type', int(condition.expected) if type(condition.expected) is bool else bool(condition.expected) if type(condition.expected) is int else 1)]:
                facts = copy.deepcopy(baseline)
                if name == 'missing': del facts[condition.field]
                else: facts[condition.field] = replacement
                add(condition.field + ':' + name, facts)
        if kind == 'tier':
            for label, override in [('absent', {}), ('null', {'interaction_kind': None}), ('explicit_wrong', {'interaction_kind': 'point'}), ('explicit_discrete', {'interaction_kind': 'discrete'})]:
                facts = {**baseline, 'interaction_measurement_kind': 'discrete'}
                facts.pop('interaction_kind', None); facts.update(override)
                add('interaction_kind_alias:' + label, facts)
    return out


def projection_cases(registry, policy, tier):
    out = []
    baseline = {'candidate_ref': 'candidate:controlled:outline', 'action_ref': 'ACTION4',
                **{condition.field: plain(condition.expected) for condition in policy.fact_projections[1].all_conditions}}
    def add(name, facts, qualification='Controlled source-evaluator input, not a game observation or caller release.'):
        out.append({'id': name, 'facts': facts, **contracts.capture(lambda: evaluate(registry, policy, tier, facts)), 'qualification': qualification})
    independently_measured = policy.fact_projections[1].all_conditions[:7]
    for bits in itertools.product([False, True], repeat=7):
        facts = copy.deepcopy(baseline)
        for condition, bit in zip(independently_measured, bits): facts[condition.field] = plain(condition.expected) if bit else other(condition.expected)
        add('ordered_matrix_' + ''.join('1' if bit else '0' for bit in bits), facts)
    for field in baseline:
        if field == 'candidate_ref': continue
        facts = copy.deepcopy(baseline); del facts[field]; add('missing:' + field, facts)
        facts = copy.deepcopy(baseline); facts[field] = None; add('null:' + field, facts)
    for label, changes in [
        ('stale_goal_does_not_establish_triplet', {'same_value_compact_body_hollow_perimeter_marker_triplet_count': 0, 'active_goal_ref': 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter'}),
        ('prior_series_authority_cleared', {'declared_complete_series_authorized': True, 'remaining_step_count': 900, 'release_remaining_action_bound': 900, 'declared_plan_ref': 'plan:controlled:stale'}),
        ('explicit_wrong_interaction_overrides_alias', {'interaction_kind': 'point'}),
        ('null_interaction_uses_alias', {'interaction_kind': None}),
        ('candidate_unicode_and_punctuation', {'candidate_ref': 'candidate:é/中.{suffix}', 'suffix': 'qualified'}),
        ('foreign_payload_is_preserved', {'unrelated_record': {'domain': ['untouched', 4, False]}}),
    ]: add(label, {**copy.deepcopy(baseline), **changes})
    return out


def actual_current_question(registry, policy, tier):
    directory = ROOT / 'docs/migration/native-campaigns-v53/attempt1'
    report_path, trace_path = directory / 'esct-campaign.json.gz', directory / 'esct-public-trace.json.gz'
    report, trace = load(report_path), load(trace_path)
    actual_scope = report['prefixes'][0]['sharedSeries']['epochAnchors'][0]['observation_ref'].split(':epoch:')[0]
    observations = [observe(SimpleNamespace(**row['packet']), index + 1, actual_scope)[0] for index, row in enumerate(trace['packets'][:9])]
    family = helper.OutlineService(); cursor = 0
    for prefix in report['prefixes']:
        rows = trace['packets'][cursor]['packet']['frame_rows']
        selected = family.propose(observations[cursor], rows, [], report['budget']['levelActionCaps'][0] - cursor) if prefix['family'] == 'public_outline_service' else None
        for index in range(prefix['acquiredActions']):
            first, second = [row['packet']['frame_rows'] for row in trace['packets'][cursor:cursor + 2]]
            command = selected['actions'][index] if selected else {'action_ref': trace['packets'][cursor + 1]['command']['action_ref']}
            assert trace['packets'][cursor + 1]['command'] == {'action_ref': command['action_ref'], 'data': {}}
            family.record(observations[cursor], observations[cursor + 1], command, first, second, selected, index)
            cursor += 1
        if cursor == 8: break
    assert cursor == 8
    obs, rows = observations[-1], trace['packets'][8]['packet']['frame_rows']
    seed = plain(family.state())
    proposal = family.propose(obs, rows, [], report['budget']['levelActionCaps'][0] - cursor)
    assert proposal and proposal['actions'] == [{'action_ref': 'ACTION4'}]
    measurement = proposal['outline_plan']['measurement']
    assert proposal['outline_plan']['meaning']['kind'] == 'announced_correspondence_hypothesis'
    guard = family.before(proposal, 0, SimpleNamespace(frame_rows=rows), obs)
    assert guard['admitted'] and plain(family.state()) == seed
    facts = {**plain(measurement['relation']), 'candidate_ref': proposal['compositions'][0]['id'],
             'action_ref': 'ACTION4', 'interaction_measurement_kind': 'discrete',
             'candidate_matches_compact_body_hollow_perimeter_marker_direction': 'ACTION4' in measurement['accompaniment']}
    unknown = evaluate(registry, policy, tier, facts)
    conditional = evaluate(registry, policy, tier, {**facts, 'attempted_without_effect_in_current_context': False})
    assert unknown['matched'] is False and conditional['matched'] is True
    return {'afterActualAction': 8, 'campaign': proof(report_path), 'trace': proof(trace_path),
            'observation': plain(obs), 'rows': rows, 'sourceState': seed, 'proposal': plain(proposal), 'sourceGuard': plain(guard),
            'actualNextCommand': trace['packets'][9]['command'], 'measuredFactsWithoutCallerTrial': facts,
            'withoutCallerNoEffectPremise': unknown, 'conditionalOnCallerNoEffectPremiseFalse': conditional,
            'qualification': 'The original Outline component has an unexecuted ACTION4 alternative after actual return8. The original/native common caller actually selected ACTION1. No caller no-effect trial is inferred from local Outline attempts: without that additional caller premise the retained V5 tier does not match. The conditional case only checks how an explicitly supplied false premise is interpreted, and does not establish a counterfactual outcome.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    output = ROOT / 'tests/fixtures/v6-outline-continuation-reference.json.gz'
    receipt_path = ROOT / 'docs/migration/native-campaigns-v53/source-reference-continuation.json'
    if not args.verify: assert not output.exists() and not receipt_path.exists(), 'Refusing to overwrite retained evidence'
    sys.setprofile(contracts.profile)
    try:
        registry, policy, tier, subset = extraction()
        conditions = condition_cases(policy, tier)
        projections = projection_cases(registry, policy, tier)
        current = actual_current_question(registry, policy, tier)
    finally: sys.setprofile(None)
    helper.AUDIT_ACTIVE = False
    assert not contracts.PENDING and helper.verify_source_manifest() == helper.VERIFIED_SOURCE
    fixture = {'schema': 'logos-engine.v53.outline-continuation-original-reference.v1', 'sourceCommit': helper.COMMIT,
               'sourceFilesVerifiedBeforeImport': 1786, 'sourceFilesVerifiedAfterExport': 1786, 'sourceUnchanged': True,
               'generator': proof(Path(__file__)), 'subset': subset, 'conditionCases': conditions, 'projectionCases': projections,
               'actualCurrentQuestion': current, 'footprint': helper.source_footprint(),
               'counts': {'sourceDeclarations': 5, 'conditionCases': len(conditions), 'projectionCases': len(projections), 'actualCurrentQuestions': 1},
               'qualification': {'nativeExecuted': False, 'gameHostExecuted': False, 'nativeOutputsUsedAsExpected': False,
                                 'fullV5SelectionParity': False, 'fullV6CallerParity': False, 'nativeArbitrationExtensionTested': False,
                                 'scope': 'Unchanged original strict DRM loader, ordered projection evaluator, condition matcher and tier matcher on an explicit source-derived subset. Output eligibility counts belong only to the reduced projection wrapper. They do not certify the complete V5 policy, a common-caller preference, any action release or any game success.'}}
    receipt = {'schema': 'logos-engine.v53.outline-continuation-original-reference-receipt.v1', 'status': 'passed',
               'sourceCommit': helper.COMMIT, 'sourceUnchanged': True, 'generator': proof(Path(__file__)),
               'counts': fixture['counts'], 'subsetDocumentSha256': subset['document']['sha256'],
               'actualAlternative': current['proposal']['actions'], 'actualNextCommand': current['actualNextCommand'],
               'qualification': fixture['qualification']}
    if args.verify:
        assert load(output) == fixture
        receipt['fixture'] = proof(output)
        assert load(receipt_path) == receipt
    else:
        helper.write_gzip_absent(output.relative_to(ROOT).as_posix(), fixture)
        receipt['fixture'] = proof(output)
        with receipt_path.open('x') as stream: json.dump(receipt, stream, indent=2, sort_keys=True); stream.write('\n')
    print(json.dumps(receipt), flush=True)


if __name__ == '__main__': main()
