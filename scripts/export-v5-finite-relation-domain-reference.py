#!/usr/bin/env python3
"""Export the exact V5 finite-domain kernel used by V6 chamber access.

Only controlled relation contracts and unchanged pinned agent sources are used.
No game implementation, specification, oracle, host or action is loaded.
This deliberately does not claim parity for the complete finite-relation facade.
"""
from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
OUTPUT = ROOT / 'tests/fixtures/v5-finite-relation-domain-reference.json.gz'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify():
    for relative, item in MANIFEST.items():
        assert digest((SOURCE / relative).read_bytes()) == item['sha256'], relative
    return len(MANIFEST)


verified_before = verify()
sys.path.insert(0, str(SOURCE))
from agents.yf_arc3_v5.capabilities.finite_relation_network import (
    RelationVariable, RelationComponent, FiniteRelationRow, FiniteRelationAlternative,
    _indexed_combination, _network_domain,
)


def plain(value):
    return json.loads(json.dumps(value, separators=(',', ':')))


def variable(ref, values=('0', '1'), source=True):
    return {'variable_ref': ref, 'values': list(values), 'source': source}


def component(ref, inputs, output, scope='scope'):
    return {'component_ref': ref, 'model_scope_ref': scope, 'signature_ref': scope + ':signature',
            'context_ref': scope + ':context', 'ordered_input_refs': list(inputs), 'output_ref': output}


def model(ref='model', rows=(), *, scope='scope', arity=1, complete=False, deterministic=True):
    return {'model_ref': ref, 'model_scope_ref': scope, 'signature_ref': scope + ':signature',
            'context_ref': scope + ':context', 'arity': arity,
            'rows': [{'inputs': list(inputs), 'outputs': list(outputs)} for inputs, outputs in rows],
            'table_complete': complete, 'deterministic': deterministic}


def request(variables, components, models, **bounds):
    return {'variables': variables, 'components': components, 'models': models,
            'domain_offset': 0, 'maximum_states': 4096, 'maximum_relation_checks': 65536, **bounds}


cases = []


def add(name, spec, fixed=None, requirements=(), offset=None):
    spec = copy.deepcopy(spec)
    arguments = {'request': spec, 'fixed': {} if fixed is None else fixed,
                 'requirements': plain(requirements), 'offset': offset}
    native = SimpleNamespace(**{**spec,
        'variables': tuple(RelationVariable(**row) for row in spec['variables']),
        'components': tuple(RelationComponent(**row) for row in spec['components']),
        'models': tuple(FiniteRelationAlternative(**row) for row in spec['models'])})
    expected = _network_domain(native, arguments['fixed'], arguments['requirements'], offset)
    cases.append({'id': name, 'arguments': arguments, 'expected': plain(expected)})


basic = request([variable('x'), variable('y', source=False)],
                [component('c', ['x'], 'y')], [model(rows=[(('0',), ('1',))])])
add('partial-known-row-rejects-and-unknown-row-remains', basic)
complete = copy.deepcopy(basic); complete['models'][0]['table_complete'] = True
add('complete-missing-row-refuses', complete)
add('fixed-output-inverts-partial-table', basic, {'y': '0'})
add('fixed-input-is-singleton', basic, {'x': '1'})
add('requirements-prune-without-checks', basic, requirements=[('y', ['0'])])
add('requirements-empty-domain-still-counts-enumeration', basic, requirements=[('y', [])])
add('requirements-intersection-preserves-declaration-order', basic,
    requirements=[('y', ['1', '0']), ('x', ['1'])])

shared = request([variable('x'), variable('y', source=False), variable('z', source=False)],
                 [component('first', ['x'], 'y'), component('second', ['x'], 'z')], [model()])
add('unknown-deterministic-row-shared-across-components', shared)
nondeterministic = copy.deepcopy(shared); nondeterministic['models'][0]['deterministic'] = False
add('unknown-nondeterministic-row-retains-last-output', nondeterministic)
known_multiple = copy.deepcopy(nondeterministic)
known_multiple['models'][0]['rows'] = [{'inputs': ['0'], 'outputs': ['0', '1']}]
add('known-nondeterministic-output-set', known_multiple)
alternatives = copy.deepcopy(shared)
alternatives['models'] = [model('inverse', [(('0',), ('1',)), (('1',), ('0',))], complete=True),
                          model('identity', [(('0',), ('0',)), (('1',), ('1',))], complete=True)]
add('one-model-alternative-bound-per-shared-scope', alternatives)
add('shared-model-alternatives-conflict-with-fixed-outputs', alternatives, {'y': '0', 'z': '1'})

repeated = request([variable('x'), variable('y', source=False)],
                   [component('twice', ['x', 'x'], 'y')],
                   [model(arity=2, rows=[(('0', '0'), ('1',)), (('1', '1'), ('0',))], complete=True)])
add('repeated-ports-keep-one-shared-source', repeated)
ordered = request([variable('x'), variable('q'), variable('y', source=False)],
                  [component('ordered', ['q', 'x'], 'y')],
                  [model(arity=2, rows=[(('0', '1'), ('1',)), (('1', '0'), ('0',))], complete=True)])
add('ordered-inputs-remain-ordered', ordered)
cyclic = request([variable('x', source=False), variable('y', source=False)],
                 [component('x-producer', ['y'], 'x', 'one'), component('y-producer', ['x'], 'y', 'two')],
                 [model('one-model', [(('0',), ('0',)), (('1',), ('1',))], scope='one', complete=True),
                  model('two-model', [(('0',), ('1',)), (('1',), ('0',))], scope='two', complete=True)])
add('cyclic-constraints-check-joint-assignment', cyclic)

unicode = request([variable('source', ('\ue000', '😀')), variable('z', ('z', 'a'), False), variable('a', ('a', 'z'), False)],
                  [component('later', ['source'], 'z', 'later'), component('earlier', ['source'], 'a', 'earlier')],
                  [model('😀', scope='later'), model('\ue000', scope='earlier')])
add('scope-order-and-unicode-unknown-row-sort', unicode)
escaped = request([variable('__proto__', ('x","y', 'x')), variable('constructor', ('0', '1'), False)],
                  [component('c', ['__proto__'], 'constructor')],
                  [model('m:["x"]', [(('x","y',), ('0',)), (('x',), ('1',))], complete=True)])
add('quoted-tuple-keys-and-prototype-like-variable-refs', escaped, {'__proto__': 'x'})

for limit in [1, 2, 3, 4, 5]:
    add('enumeration-state-bound:' + str(limit), {**basic, 'maximum_states': limit})
add('state-bound-counts-rejected-assignments', {**basic, 'maximum_states': 2}, requirements=[('x', ['1'])])
for limit in [1, 2, 3, 4, 5, 16]:
    add('relation-check-preflight-bound:' + str(limit), {**shared, 'maximum_relation_checks': limit})
add('preflight-after-short-circuit-rejection', {**alternatives, 'maximum_relation_checks': 3})
for start in [0, 1, 3, 4, 8]:
    add('domain-offset:' + str(start), {**basic, 'domain_offset': start})
add('explicit-zero-offset-overrides-request', {**basic, 'domain_offset': 3}, offset=0)
add('explicit-offset-overrides-request', {**basic, 'domain_offset': 0, 'maximum_states': 1}, offset=2)
add('empty-network-has-one-empty-assignment', request([], [], []))
add('source-only-network-preserves-variable-order', request([variable('z'), variable('a')], [], []))

binary12 = request([variable('source:' + str(i)) for i in range(12)] + [variable('output', ('-1', '0', '1'), False)],
                    [component('axis', ['source:0', 'source:11'], 'output')], [model(arity=2)])
add('twelve-binary-source-domain-at-source-budget', binary12, {'output': '0'})

combination_cases = []
for domains in [[], [['a']], [['a', 'b'], ['x', 'y', 'z']], [['0', '1']] * 12]:
    total = 1
    for domain in domains: total *= len(domain)
    for index in sorted(set([0, 1, total - 1, total, total + 2, -1, -total - 1])):
        combination_cases.append({'domains': domains, 'index': index,
                                  'expected': plain(_indexed_combination(domains, index))})

assert verified_before == verify() == 1786
sources = ['agents/yf_arc3_v5/capabilities/finite_relation_network.py',
           'agents/yf_arc3_v5/logos/types.py',
           'agents/yf_arc3_v6/laya_proto/relational_chamber_access.py']
payload = {'schema': 'logos-engine.finite-relation-domain-source-reference.v1', 'sourceCommit': COMMIT,
           'sourceHashes': {name: MANIFEST[name]['sha256'] for name in sources},
           'originalSourceFilesVerifiedBeforeAndAfter': verified_before,
           'qualification': 'Exact directly invoked source kernels on controlled relation contracts. No game or full finite-relation facade parity is claimed. Native portable integers are additionally bounded to safe integers.',
           'cases': cases, 'combinationCases': combination_cases}
OUTPUT.write_bytes(gzip.compress((json.dumps(payload, separators=(',', ':'), ensure_ascii=False) + '\n').encode(), mtime=0))
print(json.dumps({'output': str(OUTPUT), 'cases': len(cases), 'combinationCases': len(combination_cases),
                  'sha256': digest(OUTPUT.read_bytes()), 'originalSourceFilesUnchanged': verified_before}))
