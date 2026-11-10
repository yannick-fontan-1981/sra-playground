#!/usr/bin/env python3
"""Inventory exact first-creator differences in retained captures; never qualify costs.

Usage: python -B SCRIPT BASELINE.gz CANDIDATE.gz OUTPUT.json
No native runtime, replay, timing report, or comparison-policy mutation executes.
"""
from datetime import datetime, timezone
from pathlib import Path
import argparse
import gzip
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
PROFILE = 'logos-engine.v6.state-graph.v1'
OWNER = 'family_state:linked_temporal_preparation'


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def fingerprint(path):
    path = path.resolve()
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': h.hexdigest()}


def records(path):
    with gzip.open(path, 'rt') as stream:
        for index, line in enumerate(stream):
            value = line.strip()
            if index == 0 or value.startswith('],'):
                continue
            yield json.loads(value.removesuffix(','))


def direct_refs(value, path='$'):
    if isinstance(value, dict):
        if value.get('kind') == 'ref' and isinstance(value.get('id'), str):
            yield value['id'], path
        else:
            for key, item in value.items():
                yield from direct_refs(item, path + '.' + key)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from direct_refs(item, path + '[' + str(index) + ']')


def inspect(path):
    sessions, state = {}, None
    for row in records(path):
        if row['type'] == 'session_start':
            key = row['case'] + ':' + row['form']
            assert key not in sessions
            state = {'case': row['case'], 'form': row['form'], 'nodes': {}, 'fragments': {},
                     'parents': {}, 'firstConsumers': {}, 'points': [], 'rootEvents': [], 'chain': None,
                     'sequence': 0, 'fragmentClosure': {}}
            sessions[key] = state
        elif row['type'] == 'session_end':
            state = None
        elif state is not None and row['type'] in ('capture', 'terminal_inspection'):
            nodes = state['nodes']
            point = {'pointIndex': row['pointIndex'], 'requestType': row['request']['type'],
                     'requestSequence': row['request']['sequence'], 'deltas': [],
                     'nodeCount': row['knowledge']['nodeCount'], 'graphRevision': row['knowledge']['toRevision']}
            state['points'].append(point)
            for delta in row['knowledge']['deltasAdded']:
                node = delta['node']
                assert delta['sequence'] == state['sequence'] + 1
                assert delta['previous'] == state['chain']
                assert digest({k: delta[k] for k in ['sequence', 'previous', 'node', 'cause', 'source_digest']}) == delta['digest']
                assert node['revision'] == nodes.get(node['id'], {}).get('revision', 0) + 1
                state['sequence'], state['chain'] = delta['sequence'], delta['digest']
                nodes[node['id']] = node
                event = {'pointIndex': point['pointIndex'], 'requestType': point['requestType'],
                         'requestSequence': point['requestSequence'], 'deltaSequence': delta['sequence'],
                         'nodeId': node['id'], 'kind': node['kind'], 'revision': node['revision'],
                         'cause': delta['cause'], 'origin': node['origin'],
                         'nodeSha256': digest(node), 'deltaDigest': delta['digest']}
                point['deltas'].append(event)
                if node['kind'] == 'state_fragment':
                    assert node['id'] not in state['fragments'] and node['revision'] == 1
                    assert node['id'] == 'state_fragment:' + digest(node['value'])
                    refs = list(direct_refs(node['value']['node']))
                    closure = set()
                    for target, refpath in refs:
                        assert target in state['fragments'], 'Forward or absent immutable dependency'
                        closure.add(target)
                        closure.update(state['fragmentClosure'][target])
                        state['parents'].setdefault(target, []).append({'parentId': node['id'],
                            'deltaSequence': delta['sequence'], 'pointIndex': point['pointIndex'], 'path': refpath})
                    state['fragmentClosure'][node['id']] = closure
                    state['fragments'][node['id']] = {'event': event, 'node': node, 'directReferences': refs}
                elif isinstance(node['value'], dict) and node['value'].get('profile') == PROFILE:
                    refs = list(direct_refs(node['value']['root']))
                    closure = set()
                    for target, refpath in refs:
                        assert target in state['fragments'], 'Forward or absent root dependency'
                        closure.add(target)
                        closure.update(state['fragmentClosure'][target])
                    root = {'event': event, 'value': node['value'], 'references': sorted(closure)}
                    state['rootEvents'].append(root)
                    for target in closure:
                        state['firstConsumers'].setdefault(target, root)
            assert [state['chain'], state['sequence'], len(nodes)] == [row['knowledge']['chain'], point['graphRevision'], point['nodeCount']]
    assert len(sessions) == 4 and state is None
    return sessions


def paths_to(state, root, fragment):
    def visit(value, prefix, chain):
        for target, path in direct_refs(value, prefix):
            if target == fragment:
                yield {'path': path, 'fragmentChain': [*chain, target]}
            elif fragment in state['fragmentClosure'][target]:
                assert target not in chain
                yield from visit(state['fragments'][target]['node']['value']['node'],
                                 path + '→' + target, (*chain, target))
    return list(visit(root['value']['root'], '$.value.root', ()))


def first_creator(state, fragment):
    creation = state['fragments'][fragment]
    first = state['firstConsumers'].get(fragment)
    consumers = []
    for root in state['rootEvents']:
        if root['event']['pointIndex'] != creation['event']['pointIndex'] or fragment not in root['references']:
            continue
        consumers.append({**root['event'], 'references': paths_to(state, root, fragment)})
    return {**creation['event'], 'node': creation['node'],
            'firstConsumer': None if first is None else {**first['event'], 'references': paths_to(state, first, fragment)},
            'consumerRootsAtFirstPoint': consumers,
            'directParentsAtFirstPoint': [p for p in state['parents'].get(fragment, []) if p['pointIndex'] == creation['event']['pointIndex']]}


def origin_without_source(node):
    return {key: value for key, value in node['origin'].items() if key != 'source_digest'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline', type=Path)
    parser.add_argument('candidate', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    inputs = [(ROOT / p).resolve() for p in [args.baseline, args.candidate]]
    output = (ROOT / args.output).resolve()
    assert output.is_relative_to(ROOT / 'docs/migration/lot5a-evidence') and not output.exists()
    before = [fingerprint(p) for p in inputs]
    a, b = [inspect(p) for p in inputs]
    assert a.keys() == b.keys()
    result = {'schema': 'logos-engine.lot5a-fragment-first-creator-inventory.v1',
              'status': 'diagnostic_complete_not_qualified', 'recordedAt': datetime.now(timezone.utc).isoformat(),
              'generator': fingerprint(Path(__file__)), 'inputsBefore': before, 'sessions': []}
    for key in a:
        left, right = a[key], b[key]
        assert len(left['points']) == len(right['points'])
        common_fragments = set(left['fragments']) & set(right['fragments'])
        all_values_equal = all(canonical(left['fragments'][i]['node']['value']) == canonical(right['fragments'][i]['node']['value']) for i in common_fragments)
        mismatches = []
        for fragment in sorted(common_fragments):
            first, second = left['fragments'][fragment], right['fragments'][fragment]
            if first['event']['pointIndex'] == second['event']['pointIndex'] and origin_without_source(first['node']) == origin_without_source(second['node']):
                continue
            node_a, node_b = first['node'], second['node']
            mismatches.append({'fragmentId': fragment,
                'canonicalCompleteValuesEqual': canonical(node_a['value']) == canonical(node_b['value']),
                'otherCompleteNodeFieldsEqual': {k: v for k, v in node_a.items() if k != 'origin'} == {k: v for k, v in node_b.items() if k != 'origin'},
                'baseline': first_creator(left, fragment), 'candidate': first_creator(right, fragment)})
        shifted = {m['fragmentId'] for m in mismatches}
        candidate_only = set(right['nodes']) - set(left['nodes'])
        baseline_only = set(left['nodes']) - set(right['nodes'])
        remaining = []
        for pa, pb in zip(left['points'], right['points']):
            assert [pa[k] for k in ['pointIndex', 'requestType', 'requestSequence']] == [pb[k] for k in ['pointIndex', 'requestType', 'requestSequence']]
            da = [d for d in pa['deltas'] if d['nodeId'] not in shifted]
            db = [d for d in pb['deltas'] if d['nodeId'] not in shifted and d['nodeId'] not in candidate_only]
            fields = ['nodeId', 'kind', 'revision', 'cause']
            same = [[d[k] for k in fields] for d in da] == [[d[k] for k in fields] for d in db]
            remaining.append({'pointIndex': pa['pointIndex'], 'baselineCount': len(da), 'candidateCount': len(db),
                              'remainingOrderedIdentitiesRevisionsCausesEqual': same,
                              'candidateMinusBaselineNodes': pb['nodeCount'] - pa['nodeCount'],
                              'candidateMinusBaselineRevisions': pb['graphRevision'] - pa['graphRevision']})
            if not same:
                remaining[-1]['baselineDeltas'] = da
                remaining[-1]['candidateDeltas'] = db
        other_metadata = []
        for node_id in sorted(set(left['nodes']) & set(right['nodes']) - shifted):
            na, nb = left['nodes'][node_id], right['nodes'][node_id]
            normalize = lambda n: {k: (origin_without_source(n) if k == 'origin' else v) for k, v in n.items() if k != 'value'}
            if normalize(na) != normalize(nb):
                other_metadata.append({'nodeId': node_id, 'baseline': normalize(na), 'candidate': normalize(nb)})
        result['sessions'].append({'case': left['case'], 'form': left['form'],
            'commonFragments': len(common_fragments), 'allCommonCompleteFragmentValuesEqual': all_values_equal,
            'firstCreatorDifferences': mismatches,
            'baselineOnlyNodeIds': sorted(baseline_only), 'finalCandidateOnlyNodeIds': sorted(candidate_only),
            'otherCommonNodeMetadataDifferences': other_metadata, 'remainingCommonDeltaComparisons': remaining,
            'candidateEarlierFirstCreatedByAddedOwner': all(m['candidate']['pointIndex'] < m['baseline']['pointIndex']
                and m['candidate']['firstConsumer'] is not None and m['candidate']['firstConsumer']['nodeId'] == OWNER for m in mismatches)})
    result['inputsAfter'] = [fingerprint(p) for p in inputs]
    assert result['inputsAfter'] == before
    result.update({'inputsUnchanged': True, 'contractChanged': False, 'qualifiedAttribution': False,
                   'costMeasurementExecuted': False,
                   'qualification': 'Diagnostic only. All retained chains and immutable fragment content addresses are checked independently. Each first-creator difference retains complete fragment values, actual causes and the first consumer paths. The projected remainder is diagnostic, not permission to omit any creation delta or cause. Added-node source attribution and any explicit acceptance rule remain separate premeasurement obligations.'})
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x') as stream:
        stream.write(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': result['status'], 'output': str(output.relative_to(ROOT)), 'sessions': [
        {k: row[k] for k in ['case', 'form', 'commonFragments', 'allCommonCompleteFragmentValuesEqual', 'candidateEarlierFirstCreatedByAddedOwner']}
        | {'firstCreatorDifferences': len(row['firstCreatorDifferences']),
           'otherCommonNodeMetadataDifferences': len(row['otherCommonNodeMetadataDifferences']),
           'allRemainingCommonDeltasExact': all(p['remainingOrderedIdentitiesRevisionsCausesEqual'] for p in row['remainingCommonDeltaComparisons'])}
        for row in result['sessions']]}))


if __name__ == '__main__':
    main()
