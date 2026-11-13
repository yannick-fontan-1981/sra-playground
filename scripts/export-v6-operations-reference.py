#!/usr/bin/env python3
"""Export the unchanged operation/catalog/memory oracle; development only."""
from pathlib import Path
from copy import deepcopy
import hashlib, json, sys, tempfile

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
LAYA = SOURCE / 'agents/yf_arc3_v6/laya_proto'
sys.path[:0] = [str(LAYA), str(SOURCE)]
import catalog, operations, memory

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def export():
    files = [LAYA / f'{name}.py' for name in ['catalog', 'operations', 'memory']]
    files += [catalog.TREE, catalog.RECONCILIATION]
    hashes = {str(path.relative_to(SOURCE)): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    db = memory.Memory(Path(tempfile.mkdtemp()) / 'oracle.sqlite')
    imported = db.import_catalog()
    nodes = catalog.parse_tree()
    edges = [dict(zip(['src', 'relation', 'dst'], row)) for row in db.db.execute('SELECT src,relation,dst FROM edges ORDER BY src,relation,dst')]
    data = {'schema': 'logos-engine.v6.catalog.v1', 'referenceCommit': COMMIT, 'sourceHashes': hashes,
            'treeSha256': catalog.sha(catalog.TREE), 'reconciliationSha256': catalog.sha(catalog.RECONCILIATION),
            'nodes': nodes, 'edges': edges, 'operations': catalog.OPERATIONS}
    write(ROOT / 'src/logos-engine/v6/catalog.json', data)
    rich = {
        'compositions': [
            {'id': 'C1', 'requires': {'ready': True}, 'effect': {'open': True}, 'kind': 'access', 'observed': False,
             'open_question': 'Which visible change?', 'candidate_objective': True, 'depends_on': ['C3']},
            {'id': 'C2', 'requires': {'open': True}, 'effect': {'safe': False}, 'kind': 'transfer', 'observed': True},
            {'id': 'C3', 'requires': {'missing': 2, 'ready': 1}, 'effect': {'ready': True}, 'open_question': 'Unmeasured',
             'candidate_objective': True, 'feasibility': 'refuted', 'depends_on': ['C1', 'absent']},
            {'id': 'C4', 'requires': {'ready': True}, 'effect': {'open': True}, 'kind': 'access'},
        ],
        'facts': {'ready': True, 'safe': True, 'open': False}, 'focus': 'C1', 'preserve': {'safe': True},
        'observations': [{'composition': 'C1', 'after': {'open': True}}, {'composition': 'C1', 'after': {'open': False}},
                         {'composition': 'C2', 'after': {}}, {'composition': 'C1'}],
        'frontiers': [{'id': 'F1', 'reachable': True, 'open_goal_evidence': ['e']}, {'id': 'F2', 'reachable': 1, 'open_goal_evidence': ['e']},
                      {'id': 'F3', 'reachable': True, 'visited': True, 'open_goal_evidence': ['e']}, {'id': 'F4', 'reachable': True, 'open_goal_evidence': []}],
        'paths': [{'id': 'P1', 'post_state': {'x': 2}, 'post_state_complete': True, 'constraints_verified': True},
                  {'id': 'P2', 'post_state': {'x': 2}, 'post_state_complete': True, 'constraints_verified': True},
                  {'id': 'P3', 'post_state': {'x': 2}, 'post_state_complete': True, 'constraints_verified': False},
                  {'id': 'P4', 'post_state': {'x': 2}, 'constraints_verified': True}],
        'alternatives': [['C1', 'C2'], ['C3', 'C1']], 'alternatives_complete': True,
        'goals': [{'id': 'G1', 'composition': 'C1', 'terminal': True}, {'id': 'G2', 'composition': 'C2', 'requires': {'ready': 1}},
                  {'id': 'G3', 'composition': 'C3', 'completed': True}, {'id': 'G4', 'requires': {'absent': None}}],
        'deadlocks': [{'proof': ['w'], 'scope': 'global'}, {'proof': ['w'], 'scope': 'local'}, {'proof': [], 'scope': 'global'}],
        'recovery': [{'authorized': True, 'preserve_verified': True}, {'authorized': 1, 'preserve_verified': True}],
        'forced': [{'proof': ['w'], 'constraints_verified': True, 'action': 'ACTION1'}, {'proof': [], 'constraints_verified': True, 'action': 'ACTION2'}],
        'entities': [{'id': 'E1', 'utility': 'unknown', 'cycle': ['a', 'b', 'c'], 'cycle_proof': ['w'], 'phase': -2},
                     {'id': 'E2', 'utility': 'known', 'autonomous': True}, {'id': 'E3', 'utility': 'unknown', 'question': 'Which object?'}],
        'spaces': [{'id': 'S1', 'utility': 'unknown'}, {'id': 'S2', 'utility': 'known'}],
        'remote_effects': [{'id': 'R1', 'observation': 'ref1'}, {'id': 'R2', 'observation': []}],
        'desired_post_state': {'x': 2},
        'accesses': [{'id': 'A1', 'target': 'C1', 'constraints_verified': True}, {'id': 'A2', 'target': 'C2', 'constraints_verified': True}],
        'preserve_refs': ['C2'], 'permutations': [{'id': 'M1', 'target': 'C1', 'constraints_verified': True, 'preserved_refs': ['C2', 'C3']},
                                               {'id': 'M2', 'target': 'C1', 'constraints_verified': True, 'preserved_refs': []}],
        'bundles': [{'id': 'B1', 'composition_ref': 'C1', 'admitted': True, 'actions': ['ACTION1']},
                    {'id': 'B2', 'composition_ref': 'C1', 'admitted': 1, 'actions': ['ACTION1']},
                    {'id': 'B3', 'composition_ref': 'C1', 'admitted': True, 'actions': []}],
        'expected_properties': {'a': True, 'b': 2, 'c': None, 'd': {}}, 'observed_properties': {'a': 1, 'b': 3, 'd': {}},
        'observation_revision': 4,
        'knowledge_updates': [{'composition_ref': 'C1', 'evidence': ['e'], 'revision': 4}, {'composition_ref': 'C1', 'evidence': [], 'revision': 4},
                              {'composition_ref': 'C1', 'evidence': ['e'], 'revision': 3}],
        'objective_assessments': [{'composition_ref': 'C1', 'satisfied': False, 'feasible': True}, {'composition_ref': 'C2'}],
    }
    states = {'empty': {}, 'rich': rich, 'missing_focus': {**rich, 'focus': 'unlisted'},
              'unknowns': {'compositions': [{'id': 'X', 'requires': {'new': 1}, 'effect': {'keep': None}, 'observed': [], 'open_question': []}],
                           'alternatives': [], 'alternatives_complete': True, 'preserve': {'keep': None}}}
    cases = []
    for name, state in states.items():
        for op in catalog.OPERATIONS:
            cases.append({'id': f'{name}:{op}', 'operation': op, 'state': state, 'expected': operations.execute(op, deepcopy(state))})
    bounded = {'compositions': [{'id': f'C{i:02}', 'requires': {'u': 1}, 'depends_on': [f'C{i+1:02}']} for i in range(70)], 'focus': 'C00'}
    cases.append({'id': 'bounded:OP12', 'operation': 'OP12', 'state': bounded, 'expected': operations.execute('OP12', bounded)})
    no_complete = {**rich, 'alternatives_complete': 1}
    cases.append({'id': 'strict:OP09', 'operation': 'OP09', 'state': no_complete, 'expected': operations.execute('OP09', no_complete)})
    all_keys = [n['key'] for n in nodes]
    counts = dict(db.db.execute('SELECT src,COUNT(*) FROM edges GROUP BY src'))
    window_keys = set(all_keys[::max(1, len(all_keys)//24)]) | {all_keys[-1], max(counts, key=counts.get)}
    window_keys.update(op['authority_refs'][0] for op in catalog.OPERATIONS.values())
    windows = [{'key': key, 'expected': db.window(key)} for key in sorted(window_keys)]
    memory.time.time = lambda: 1234.5
    initial_stats = db.stats()
    memory_cases = []
    def capture(kind, arguments, operation):
        output = operation()
        memory_cases.append({'kind': kind, 'arguments': arguments, 'result': output, 'stats': db.stats()})
    capture('put', ['ep', 'state', {'facts': {'é': True}}, 'obs:1', 3], lambda: db.put('ep', 'state', {'facts': {'é': True}}, 'obs:1', 3))
    capture('get', ['ep', 'state'], lambda: db.get('ep', 'state'))
    capture('put', ['ep', 'state', {'facts': {'é': False}}, 'obs:2', 4], lambda: db.put('ep', 'state', {'facts': {'é': False}}, 'obs:2', 4))
    capture('get', ['ep', 'state'], lambda: db.get('ep', 'state'))
    capture('put', ['other', 'state', [True, 0, None], 'fixture', 1], lambda: db.put('other', 'state', [True, 0, None]))
    capture('trace', ['ep', 'measure', {'result': 'ok'}], lambda: db.trace('ep', 'measure', {'result': 'ok'}))
    target = catalog.OPERATIONS['OP01']['authority_refs'][0]
    capture('jump', ['ep', all_keys[0], target, 4], lambda: db.jump('ep', all_keys[0], target, 4))
    class Tokenizer:
        def encode(self, text, add_special_tokens=False): return list(text)
    capture('seed_archive', [600], lambda: db.seed_archive(Tokenizer(), 600))
    capture('import_catalog', [], lambda: db.import_catalog())
    trace_rows = [dict(zip(['id', 'episode', 'kind', 'body', 'created'], row)) for row in db.db.execute('SELECT id,episode,kind,body,created FROM traces ORDER BY id')]
    for row in trace_rows: row['body'] = json.loads(row['body'])
    write(ROOT / 'tests/fixtures/v6-operations-reference.json', {
        'commit': COMMIT, 'sourceHashes': hashes, 'imported': imported, 'initialStats': initial_stats,
        'cases': cases, 'windows': windows, 'memoryCases': memory_cases, 'traces': trace_rows,
        'canonical': [{'value': value, 'expected': operations.canonical(value)} for value in [None, True, {'é': '😀', 'a': [False, 1, None]}, {'z': {}, 'a': []}]],
    })
    db.close()
    print(json.dumps({'operationCases': len(cases), 'windows': len(windows), 'catalogNodes': len(nodes), 'catalogEdges': len(edges), 'memoryOperations': len(memory_cases)}))

if __name__ == '__main__': export()
