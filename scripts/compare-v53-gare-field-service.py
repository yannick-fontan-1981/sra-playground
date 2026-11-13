#!/usr/bin/env python3
"""Evidence-only comparison of GARE's already populated field-service layer.

No solver, game, replay harness or native state is executed or modified. The
original failed aggregate comparison is retained. Only observation namespaces
and independently verified C_nested identities are rebased for this proof.
"""
from __future__ import annotations

import argparse
import ast
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
OBSERVATION = re.compile(r'^(sra-v6-[^:]+)(:epoch:\d+:revision:\d+:frame:[0-9a-f]{16})$')
SERIES_FIELDS = ['fieldServiceEventCount', 'fieldServiceLatestEvent',
                 'fieldServiceAcquiredEvents', 'fieldServiceAcquiredNegativeZeroPaths']
EMPTY_LAYER_CHECK = 'field-service layers remain empty on the seven earlier trajectories'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(path):
    raw = path.read_bytes()
    decoded = gzip.decompress(raw) if path.suffix == '.gz' else raw
    return json.loads(decoded), raw, decoded


def proof(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path.read_bytes()),
            'bytes': path.stat().st_size}


def unchanged_function(path, name, namespace):
    tree = ast.parse(path.read_text())
    node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(path), 'exec'), namespace)
    return namespace[name]


def walk_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from walk_strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from walk_strings(item)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline', type=Path)
    parser.add_argument('current', type=Path)
    parser.add_argument('prior_comparison', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    paths = {key: (ROOT / getattr(args, key)).resolve() for key in
             ['baseline', 'current', 'prior_comparison', 'output']}
    assert paths['output'] not in [paths[k] for k in ['baseline', 'current', 'prior_comparison']]
    before, before_raw, before_json = read(paths['baseline'])
    after, after_raw, after_json = read(paths['current'])
    prior, prior_raw, _ = read(paths['prior_comparison'])
    assert before['game'] == after['game'] == 'GARE'
    assert before['status'] == after['status'] == 'passed'
    assert before['referenceCommit'] == after['referenceCommit'] == COMMIT
    assert before['sourceUnchangedDuringRun'] and after['sourceUnchangedDuringRun']
    assert before['pythonAgentModules'] == after['pythonAgentModules'] == []
    assert len(before['prefixes']) == len(after['prefixes']) == 53
    assert before['final']['actions'] == after['final']['actions'] == 53
    assert before['final']['levelsCompleted'] == after['final']['levelsCompleted'] == 3
    assert prior['before']['sha256'] == sha(before_json)
    assert prior['after']['sha256'] == sha(after_json)
    assert prior['before']['sourceDigest'] == before['source']['digest']
    assert prior['after']['sourceDigest'] == after['source']['digest']
    failed_prior = [c['name'] for c in prior['checks'] if not c['passed']]
    assert prior['passed'] is False and failed_prior == [EMPTY_LAYER_CHECK]

    # Reuse the existing independent finite-domain canonical spelling and the
    # unchanged pinned Python identity function, without importing an agent.
    generator = ROOT / 'scripts/export-v6-field-service-reference.py'
    terminal = SOURCE / 'agents/yf_arc3_v6/laya_proto/terminal_composition.py'
    nested = SOURCE / 'agents/yf_arc3_v6/laya_proto/nested_control_access.py'
    fixture_path = ROOT / 'tests/fixtures/v6-field-service-reference.json.gz'
    fixture, _, _ = read(fixture_path)
    manifest, _, _ = read(SOURCE.parent / 'manifest.json')
    for path in [terminal, nested]:
        relative = path.relative_to(SOURCE).as_posix()
        assert sha(path.read_bytes()) == manifest['files'][relative]['sha256'] == fixture['sourceHashes'][relative]
    assert fixture['sourceCommit'] == COMMIT and fixture['generatorSha256'] == sha(generator.read_bytes())
    canonical = unchanged_function(generator, 'finite_canonical', {'json': json, 'math': math})
    identity = unchanged_function(terminal, 'identity', {'json': json, 'hashlib': hashlib})
    nested_tree = ast.parse(nested.read_text())
    owner = next(n for n in nested_tree.body if isinstance(n, ast.ClassDef) and n.name == 'NestedControlAccess')
    question = next(n for n in owner.body if isinstance(n, ast.FunctionDef) and n.name == 'nested_question')
    propose = next(n for n in owner.body if isinstance(n, ast.FunctionDef) and n.name == 'propose')
    assignment = lambda node, name: isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets)
    plan_node = next(n.value for n in ast.walk(question) if assignment(n, 'plan'))
    plan_fields = [n.value for n in plan_node.keys]
    ref_node = next(n.value for n in ast.walk(question) if assignment(n, 'ref'))
    ref_expression = compile(ast.Expression(body=ref_node), str(nested), 'eval')
    appended_fields = [t.slice.value for n in ast.walk(propose) if isinstance(n, ast.Assign) for t in n.targets
                       if isinstance(t, ast.Subscript) and isinstance(t.value, ast.Name) and t.value.id == 'plan'
                       and isinstance(t.slice, ast.Constant)]
    assert appended_fields == ['no_visible_effect_contract']
    recipes = [r for r in fixture['identityRecipes'] if isinstance(r['value'], dict)
               and any(c == f'nested_control_access.py:{question.end_lineno - 1}' for c in r['callers'])]
    # Match by the source-built operand fields as well, so source line movement
    # cannot silently replace the declared constructor recipe.
    assert recipes and all(set(r['value']) == set(plan_fields) for r in recipes)
    for recipe in recipes:
        assert canonical(recipe['value']) == recipe['sourceCanonical'] == recipe['nativeCanonical']
        assert sha(canonical(recipe['value']).encode()) == identity(recipe['value']) == recipe['sourceHash'] == recipe['nativeHash']

    projections = []
    identity_checks = []
    namespace_checks = []
    for side, report in [('baseline', before), ('current', after)]:
        values = []
        events = []
        for prefix in report['prefixes']:
            series = prefix['sharedSeries']
            assert all(k in series for k in SERIES_FIELDS)
            values.append({**{k: copy.deepcopy(series[k]) for k in SERIES_FIELDS},
                           'fieldService': copy.deepcopy(prefix.get('fieldService'))})
            events.extend(series['fieldServiceAcquiredEvents'])
            assert series['fieldServiceEventCount'] == len(events)
            assert canonical(series['fieldServiceLatestEvent']) == canonical(events[-1] if events else None)
            assert series['fieldServiceAcquiredNegativeZeroPaths'] == []
            if prefix.get('fieldService') is not None:
                assert prefix['fieldService']['negativeZeroPaths'] == []
            canonical(values[-1])  # Qualify every compared number independently.
        observation_values = [v for value in values for v in walk_strings(value) if 'sra-v6-' in v]
        matches = [OBSERVATION.fullmatch(v) for v in observation_values]
        assert matches and all(matches)
        namespaces = {m.group(1) for m in matches}
        assert len(namespaces) == 1
        namespace = next(iter(namespaces))

        def rebase_observation(value):
            match = OBSERVATION.fullmatch(value)
            if match:
                assert match.group(1) == namespace
                return 'campaign-scope' + match.group(2)
            return value

        def map_value(value, names):
            if isinstance(value, str):
                if value.startswith('C_nested_'):
                    assert value in names, ('Unverified nested identity', value)
                    return names[value]
                return rebase_observation(value)
            if isinstance(value, list):
                return [map_value(v, names) for v in value]
            if isinstance(value, dict):
                return {k: map_value(v, names) for k, v in value.items()}
            return value

        names = {}
        for index, value in enumerate(values):
            captured = value['fieldService']
            if captured is None:
                continue
            proposal = captured['proposal']
            assert proposal['kind'] == 'nested_control_experiment'
            plan = proposal['nested_control_plan']
            assert set(plan) == set(plan_fields + appended_fields)
            operand = {k: plan[k] for k in plan_fields}
            raw_id = eval(ref_expression, {'identity': identity, 'plan': operand})
            assert raw_id == proposal['proposal_id']
            assert identity(operand) == sha(canonical(operand).encode())
            rebased_operand = map_value(operand, {})
            rebased_id = eval(ref_expression, {'identity': identity, 'plan': rebased_operand})
            assert raw_id not in names or names[raw_id] == rebased_id
            names[raw_id] = rebased_id
            identity_checks.append({'side': side, 'prefixIndex': index, 'prefixRef': report['prefixes'][index]['id'],
                                    'actual': raw_id, 'recomputed': raw_id, 'rebased': rebased_id,
                                    'completeRetainedPlanSha256': sha(canonical(plan).encode()),
                                    'sourceIdentityOperandSha256': identity(operand),
                                    'postConstructionFieldsStillCompared': appended_fields, 'passed': True})
        assert len(names) == len(events) == 14
        projections.append([map_value(value, names) for value in values])
        namespace_checks.append({'side': side, 'namespace': namespace,
                                 'occurrences': len(observation_values), 'uniqueReferences': len(set(observation_values)),
                                 'fieldServiceEvents': len(events), 'verifiedProposalIdentities': len(names)})

    checks = []
    for index, (left, right) in enumerate(zip(*projections)):
        b, a = before['prefixes'][index], after['prefixes'][index]
        assert [b['id'], b['decisionRevision'], b['acquiredActions']] == [a['id'], a['decisionRevision'], a['acquiredActions']]
        assert ('fieldService' in b) == ('fieldService' in a)
        fields = []
        for name in SERIES_FIELDS + ['fieldService']:
            lc, rc = canonical(left[name]), canonical(right[name])
            fields.append({'field': name, 'passed': lc == rc,
                           'baselineCanonicalSha256': sha(lc.encode()), 'currentCanonicalSha256': sha(rc.encode())})
        checks.append({'prefixIndex': index, 'prefixRef': b['id'], 'fieldServicePresent': 'fieldService' in b,
                       'eventCount': left['fieldServiceEventCount'], 'fields': fields,
                       'passed': all(f['passed'] for f in fields)})

    assert paths['prior_comparison'].read_bytes() == prior_raw
    result = {
        'schema': 'logos-engine.v53.gare-field-service-regression.v1',
        'passed': all(c['passed'] for c in checks), 'referenceCommit': COMMIT,
        'baseline': {**proof(paths['baseline']), 'uncompressedSha256': sha(before_json), 'sourceDigest': before['source']['digest']},
        'current': {**proof(paths['current']), 'uncompressedSha256': sha(after_json), 'sourceDigest': after['source']['digest'],
                    'mode': 'recorded-public-replay'},
        'priorComparison': {**proof(paths['prior_comparison']), 'retainedPassedValue': prior['passed'],
                            'unchanged': True, 'otherChecksPassed': len(prior['checks']) - 1,
                            'inapplicableEmptyLayerAssertion': EMPTY_LAYER_CHECK},
        'generator': proof(Path(__file__).resolve()),
        'identitySource': {'files': [proof(terminal), proof(nested), proof(generator), proof(fixture_path)],
                           'verifiedExistingConstructorRecipes': len(recipes), 'constructorPlanFields': plan_fields,
                           'postConstructionFields': appended_fields,
                           'recipe': 'Unchanged nested_question ref expression over every constructor plan field. propose appends no_visible_effect_contract after identity construction; that field remains in the complete payload comparison.'},
        'compared': {'prefixes': len(checks), 'fieldsPerPrefix': 5, 'fieldComparisons': len(checks) * 5,
                     'acquiredEventsPerRun': 14, 'completeProviderPayloadsPerRun': 14,
                     'proposalIdentityPairs': 14, 'independentRawIdentityChecks': len(identity_checks),
                     'negativeZeroPathListsCompared': len(checks) * 2 + 28},
        'observationNamespaces': namespace_checks, 'identityChecks': identity_checks, 'prefixChecks': checks,
        'qualification': 'Exact comparison of the five previously tested field-service values at every retained prefix: count, complete latest event, every acquired event, acquisition negative-zero paths and the complete fieldService payload including provider/caller envelope, plan, contracts, state-node label and numeric scope. No payload field is omitted. Only full observation-reference session namespaces and independently source-recomputed C_nested identities are rebased. Epochs, revisions, frame identifiers and every other value remain compared. Both operands independently satisfy the existing safe-integer JSON identity domain; all declared negative-zero lists are checked and empty. This supplements the preserved failed aggregate receipt: its empty-layer premise does not apply to GARE because the v52 baseline already acquired 14 field-service events. Its other 18 checks remain passed and unchanged. This is retained-public regression evidence, not a fresh live game or full unretained internal-state parity.'
    }
    paths['output'].write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': result['passed'], **result['compared'], 'output': result['generator']['path'].replace('scripts/compare-v53-gare-field-service.py', paths['output'].relative_to(ROOT).as_posix())}))
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
