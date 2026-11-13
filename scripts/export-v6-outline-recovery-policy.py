#!/usr/bin/env python3
"""Extract three bounded V5 service questions without changing their rules.

The wrappers preserve each projection and its original tier. They qualify the
reduced questions, not the ordering or behavior of the complete V5 caller.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('outline_recovery_reference', ROOT / 'scripts/export-v6-outline-continuation-reference.py')
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)
SOURCE = reference.SOURCE_FILE
packed = reference.packed
sha = lambda data: hashlib.sha256(data).hexdigest()
MODES = [('announced_rejoin', [624, 666], 15), ('overlaid_capture', [1300, 1301], 16), ('adjacent_capture', [1298, 1299], 17)]


def extract():
    raw = json.loads(SOURCE.read_bytes())
    source = raw['declarations'][217]
    output, cases = {}, []
    for mode, indices, tier_index in MODES:
        policy_ref = 'native.outline.recovery.' + mode
        projections = [source['fact_projections'][i] for i in indices]
        tier = source['selection_tiers'][tier_index]
        policy = {'id': policy_ref, 'kind': 'selection_policy', 'reason_refs': [tier['reason_ref']],
                  'evaluation': 'declared_eligibility_single', 'supported_operators': source['supported_operators'],
                  'input_contract': source['input_contract'], 'output_contract': source['output_contract'],
                  'fact_projections': projections}
        text = packed({'module_id': policy_ref, 'declarations': [policy]})
        registry = reference.DrmRegistry()
        registry.register(reference._parse_drm_source(text)); registry.seal()
        loaded = registry.resolve(policy_ref)[0]
        original_tier = reference.DrmSelectionTier.model_validate(tier)
        pointers = [{'id': value['id'], 'pointer': ['declarations', 217, 'fact_projections', index]}
                    for index, value in zip(indices, projections)]
        pointers.append({'id': tier['id'], 'pointer': ['declarations', 217, 'selection_tiers', tier_index]})
        subset = {'referenceCommit': reference.helper.COMMIT,
                  'sourcePath': SOURCE.relative_to(reference.helper.SOURCE).as_posix(),
                  'sourceSha256': sha(SOURCE.read_bytes()), 'sourceSelectionPolicyRef': source['id'],
                  'subsetPolicyRef': policy_ref, 'document': {'text': text.decode(), 'sha256': sha(text)},
                  'selectionTier': tier, 'sourcePointers': pointers,
                  'qualification': 'Exact original V5 projections and tier, evaluated as a bounded question. No complete V5 caller parity is claimed.',
                  'wrapperQualification': 'The reduced wrapper retains source operator and contract names. Its eligibility label is metadata; it adds no predicate or physical action authority.'}
        output[mode] = subset
        facts = {'candidate_ref': 'controlled:recovery', 'interaction_kind': 'discrete',
                 'interaction_measurement_kind': 'discrete', 'attempted_without_effect_in_current_context': False}
        for rule in [*projections, tier]:
            for condition in rule.get('all_conditions', []):
                if condition['operator'] == 'equals': facts[condition['field']] = condition['expected']
        # These fields must be produced, not supplied, by the first projection.
        for name in ('remaining_action_bound', 'full_metaplan_reprojection_required_after_primitive'):
            facts.pop(name, None)
        variants = [('eligible', facts)]
        for field, value in facts.items():
            if field == 'candidate_ref': continue
            changed = copy.deepcopy(facts); changed.pop(field)
            variants.append(('missing-' + field, changed))
            changed = copy.deepcopy(facts)
            changed[field] = not value if isinstance(value, bool) else value + 1 if isinstance(value, int) else 'controlled:other'
            variants.append(('different-' + field, changed))
        for name, current in variants:
            result = reference.project_declared_alternatives(drm=registry, selection_policy_ref=policy_ref,
                alternative_refs=(current['candidate_ref'],), descriptive_facts=current)
            projected = result.alternative_facts[current['candidate_ref']]
            _, matched = reference._first_matching_tier(projected, (original_tier,))
            complete = tuple(result.projection_refs) == tuple(row.id for row in loaded.fact_projections)
            cases.append({'id': mode + ':' + name, 'mode': mode, 'facts': current,
                'value': {'projection_result': reference.plain(result), 'projected_facts': reference.plain(projected),
                          'matched_tier_ref': matched.id if matched else None,
                          'all_required_projections_matched': complete, 'matched': complete and matched is not None}})
    destination = ROOT / 'src/logos-engine/v6/outline-recovery.json'
    destination.write_text(json.dumps({'schema': 'logos-engine.v5.outline-recovery-subsets.v1', 'subsets': output}, indent=2) + '\n')
    fixture = ROOT / 'tests/fixtures/v6-outline-recovery-policy-reference.json.gz'
    fixture.write_bytes(gzip.compress(packed({'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': sha(SOURCE.read_bytes()),
        'originalStrictLoaderAccepted': True, 'nativeExecuted': False, 'cases': cases}), mtime=0))
    print(json.dumps({'subsets': len(output), 'originalEvaluatorCases': len(cases), 'fixture': str(fixture.relative_to(ROOT))}))


if __name__ == '__main__': extract()
