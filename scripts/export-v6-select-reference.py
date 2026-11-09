#!/usr/bin/env python3
"""Independent unchanged-Python SELECT evaluator and operator projection cases."""
from copy import deepcopy
import gzip
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.path.insert(0, str(SOURCE))
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmDeclaration
from agents.yf_arc3_v5.drm.runtime import declared_selection_result
from agents.yf_arc3_v5.operators.contracts import SelectionInput
from agents.yf_arc3_v5.operators.selection_projection import project_selection_output
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain

DRM = 'agents/yf_arc3_v6/morphology_policy/reactive_contact/source81-declarations.drm'
loaded = load_drm_document(SOURCE / DRM)
source_policy = next(d for d in loaded.document.declarations if d.id == 'policy.prepare_observed_peer_composition_access')
base = plain(source_policy.model_dump())
cases = []

def capture(name, facts, policy=None, refs=None, context=None, witnesses=None):
    document = deepcopy(policy or base)
    declaration = DrmDeclaration.model_validate(document)
    value = {'goal_ref': 'question.current_relation', 'alternative_refs': refs or list(facts),
             'requirement_refs': ['requirement.current_relation'], 'preserve_refs': list(facts),
             'alternative_facts': deepcopy(facts), 'context_facts': deepcopy(context or {}),
             'dominance_witnesses': deepcopy(witnesses or [])}
    row = {'name': name, 'policy': plain(declaration.model_dump()), 'input': value}
    try:
        request = SelectionInput.model_validate(value)
        decision = declared_selection_result(request, declaration)
        row['result'] = plain(decision.model_dump())
        if decision.selected_ref is not None:
            row['output'] = plain(project_selection_output(request.alternative_refs, decision).model_dump())
        else:
            row['blocked'] = True
    except Exception as error:
        row['error'] = {'type': type(error).__name__, 'message': str(error)}
    cases.append(row)

def fact(ref, **changes):
    return {'alternative_ref': ref, 'composition_access_admissible': True,
            'composition_relation_count': 3, 'total_primitive_distance': 4,
            'access_distance': 2, 'direct_single_input_previously_executed': False,
            'conditional_peer_response_exit_upper_bound': 1, 'grip_row': 2, 'grip_col': 3, **changes}

capture('source_single', {'a': fact('a')})
capture('source_canonical_tie', {'z': fact('z'), 'a': fact('a')})
capture('source_hashed_reference_unresolved', {'part:abcdef012345': fact('part:abcdef012345'), 'part:fedcba987654': fact('part:fedcba987654')})
for field, values in [('composition_access_admissible', [True, False, 1, None]),
                      ('composition_relation_count', [1, 4, None, True, '3', 1.5]),
                      ('total_primitive_distance', [1, 9, None, True, '4', 1.5]),
                      ('access_distance', [0, 8, None, False, '2']),
                      ('direct_single_input_previously_executed', [True, None, 0]),
                      ('conditional_peer_response_exit_upper_bound', [0, 6, None]),
                      ('grip_row', [0, 8, None]), ('grip_col', [0, 9, None])]:
    for index, value in enumerate(values):
        capture(f'source_{field}_{index}', {'z': fact('z', **{field: value}), 'a': fact('a')})
for field in base['selection_required_fact_fields']:
    row = fact('a'); del row[field]
    capture('source_missing_' + field, {'a': row})
capture('source_context_fallback', {'a': {'alternative_ref': 'a'}, 'z': {'alternative_ref': 'z', 'total_primitive_distance': 2}}, context=fact('shared'))
capture('source_explicit_null_overrides_context', {'a': {'alternative_ref': 'a', 'composition_access_admissible': None}}, context=fact('shared'))
capture('source_empty_facts_error', {}, refs=['a'])
capture('source_missing_fact_inventory_error', {'a': fact('a')}, refs=['a', 'b'])
capture('source_duplicate_alternative_error', {'a': fact('a')}, refs=['a', 'a'])

# Synthetic declarations exercise the same generic evaluator. They are not
# claims that Source81 authors these alternative policies.
for evaluation in ['single_admissible', 'declared_eligibility_single', 'symbolic_partial_order']:
    policy = {**base, 'evaluation': evaluation, 'selection_tiers': [],
              'selection_precedence_criteria': [], 'selection_tie_breakers': [],
              'canonical_equivalence_tie_break_debt_ref': None}
    if evaluation != 'declared_eligibility_single':
        policy.update(selection_eligibility_conditions=[], selection_required_fact_fields=[])
    for count in [1, 2, 3]:
        capture(evaluation + '_' + str(count), {chr(97+i): fact(chr(97+i)) for i in range(count)}, policy)
    capture(evaluation + '_ineligible', {'a': fact('a', composition_access_admissible=False)}, policy)
    if evaluation == 'symbolic_partial_order':
        witness = {'criterion_ref': 'criterion.distance', 'left_ref': 'z', 'right_ref': 'a',
                   'preferred_order': 'minimize', 'observed_order': 'less_than', 'evidence_refs': ['observation.real']}
        capture('dominance_direct', {'a': fact('a'), 'z': fact('z')}, policy, witnesses=[witness])
        capture('dominance_reversed', {'a': fact('a'), 'z': fact('z')}, policy, witnesses=[{**witness, 'left_ref': 'a', 'right_ref': 'z', 'observed_order': 'greater_than'}])
        capture('dominance_equal', {'a': fact('a'), 'z': fact('z')}, policy, witnesses=[{**witness, 'observed_order': 'equal'}])
        capture('dominance_conflicting', {'a': fact('a'), 'z': fact('z')}, policy, witnesses=[witness, {**witness, 'criterion_ref': 'criterion.other', 'observed_order': 'greater_than'}])
        capture('dominance_undeclared_error', {'a': fact('a')}, policy, witnesses=[witness])
for preserve in [False, True]:
    policy = {**base, 'preserves_alternatives': preserve, 'canonical_equivalence_tie_break_debt_ref': 'debt.arbitrary_identity'}
    capture('canonical_debt_' + str(preserve), {'a': fact('a'), 'z': fact('z')}, policy)
policy = {**base, 'selection_precedence_criteria': [], 'selection_tiers': [
    {'id': 'tier.preferred', 'reason_ref': 'reason.first', 'all_conditions': [{'field': 'first', 'operator': 'equals', 'expected': True}]},
    {'id': 'tier.other', 'reason_ref': 'reason.other', 'any_conditions': [{'field': 'other', 'operator': 'equals', 'expected': True}]}]}
capture('tier_first_match', {'z': fact('z', first=True), 'a': fact('a', other=True)}, policy)
capture('tier_fallback', {'z': fact('z'), 'a': fact('a', other=True)}, policy)
capture('unicode_scalar_order', {'a': fact('a', grip_row='\U0001f600'), 'z': fact('z', grip_row='\ue000')})

paths = [DRM, 'agents/yf_arc3_v5/drm/runtime.py', 'agents/yf_arc3_v5/drm/contracts.py',
         'agents/yf_arc3_v5/operators/contracts.py', 'agents/yf_arc3_v5/operators/selection_projection.py',
         'agents/yf_arc3_v5/scheduler/operator_builders.py']
result = {'schema': 'logos-engine.v6.select-reference.v1', 'referenceCommit': COMMIT,
          'sourceHashes': {path: hashlib.sha256((SOURCE/path).read_bytes()).hexdigest() for path in paths},
          'scope': 'Unchanged original evaluator and mechanical output projection; source policy plus explicitly synthetic declarative variants. Safe-integer JSON domain; Python-only float/integer representation distinctions are not claimed.',
          'cases': cases}
target = ROOT / 'tests/fixtures/v6-select-reference.json.gz'
target.write_bytes(gzip.compress(json.dumps(result, ensure_ascii=True, separators=(',', ':')).encode(), mtime=0))
print(json.dumps({'cases': len(cases), 'bytes': target.stat().st_size, 'path': str(target.relative_to(ROOT))}))
