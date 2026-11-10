#!/usr/bin/env python3
"""Inspect a first-creator difference in retained functional captures only.

Usage: python -B SCRIPT BASELINE.gz CANDIDATE.gz FRAGMENT_ID OUTPUT.json
No runtime, replay or cost analysis executes. The output is a diagnostic, not
an attribution acceptance or a change to the comparison contract.
"""
from datetime import datetime, timezone
from pathlib import Path
import argparse
import gzip
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
PROFILE = 'logos-engine.v6.state-graph.v1'


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


def sha(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def fingerprint(path):
    path = path.resolve()
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': h.hexdigest()}


def rows(path):
    with gzip.open(path, 'rt') as stream:
        for index, line in enumerate(stream):
            value = line.strip()
            if index == 0 or value.startswith('],'):
                continue
            yield json.loads(value.removesuffix(','))


def compare(a, b, path='$'):
    if type(a) is not type(b):
        return [{'path': path, 'baseline': a, 'candidate': b}]
    if isinstance(a, dict):
        if a.keys() != b.keys():
            return [{'path': path + '.keys', 'baseline': sorted(a), 'candidate': sorted(b)}]
        return [difference for key in a for difference in compare(a[key], b[key], path + '.' + key)]
    if isinstance(a, list):
        if len(a) != len(b):
            return [{'path': path + '.length', 'baseline': len(a), 'candidate': len(b)}]
        return [difference for i, (x, y) in enumerate(zip(a, b)) for difference in compare(x, y, path + '[' + str(i) + ']')]
    return [] if a == b else [{'path': path, 'baseline': a, 'candidate': b}]


def inspect(path, fragment):
    nodes, creation, consumers, timeline, frames, states = {}, None, [], [], [], []
    selected = False
    result = {'case': 'STCK', 'form': 'measured', 'creation': None, 'consumers': consumers,
              'timeline': timeline, 'matchingPublicFrames': frames, 'matchingLinkedStates': states}

    def decode(value):
        if not isinstance(value, dict):
            return value
        kind = value.get('kind')
        if kind == 'ref':
            return decode(nodes[value['id']]['value']['node'])
        if kind == 'array':
            return [decode(item) for item in value['items']]
        if kind == 'object':
            return {key: decode(item) for key, item in value['members'].items()}
        if kind == 'concat':
            return [item for part in value['parts'] for item in decode(part)]
        if kind == 'merge':
            return {key: item for part in value['parts'] for key, item in decode(part).items()}
        raise ValueError('Unexpected target encoding: ' + str(kind))

    def trails(value, path='value.root', chain=()):
        if not isinstance(value, (dict, list)):
            return []
        if isinstance(value, dict) and value.get('kind') == 'ref':
            target = value['id']
            if target == fragment:
                return [{'path': path, 'fragmentChain': [*chain, target]}]
            if target in chain:
                raise ValueError('Cyclic fragment reference')
            if target not in nodes:
                raise ValueError('Missing captured fragment ' + target)
            return trails(nodes[target]['value']['node'], path + '→' + target, (*chain, target))
        items = enumerate(value) if isinstance(value, list) else value.items()
        return [trail for key, child in items for trail in trails(child, path + '.' + str(key), chain)]

    def record_consumer(node, row, scope):
        value = node.get('value')
        if node['kind'] == 'state_fragment' or not isinstance(value, dict) or value.get('profile') != PROFILE:
            return
        refs = trails(value['root'])
        if refs:
            consumers.append({'pointIndex': row['pointIndex'], 'request': row['request'],
                              'nodeId': node['id'], 'kind': node['kind'], 'revision': node['revision'],
                              'origin': node['origin'], 'scope': scope, 'references': refs})

    for row in rows(path):
        if row['type'] == 'session_start':
            selected = row['case'] == 'STCK' and row['form'] == 'measured'
            if selected:
                nodes = {}; result['sessionId'] = row['sessionId']
            continue
        if not selected:
            continue
        if row['type'] == 'session_end':
            break
        if row['type'] not in ('capture', 'terminal_inspection'):
            continue
        deltas = row['knowledge']['deltasAdded']
        for delta in deltas:
            nodes[delta['node']['id']] = delta['node']
            if delta['node']['id'] == fragment:
                if creation is not None:
                    raise ValueError('Immutable shared fragment was revised')
                expected = {key: delta[key] for key in ['sequence', 'previous', 'node', 'cause', 'source_digest']}
                assert sha(expected) == delta['digest'], 'First creation delta digest does not match'
                assert 'state_fragment:' + sha(delta['node']['value']) == fragment, 'Content-addressed identity does not match'
                creation = {'pointIndex': row['pointIndex'], 'request': row['request'],
                            'delta': delta, 'valueSha256': sha(delta['node']['value']),
                            'decodedValue': decode(delta['node']['value']['node'])}
                result['creation'] = creation
        if creation:
            for delta in deltas:
                record_consumer(delta['node'], row, 'new_or_revised_root')
            if row['pointIndex'] == creation['pointIndex']:
                for node in nodes.values():
                    record_consumer(node, row, 'current_root_at_first_creation')
            public = row.get('publicPacket')
            if public and public['frame_rows'] == creation['decodedValue']:
                frames.append({'pointIndex': row['pointIndex'], 'sequence': row['request']['sequence'],
                               'level': public['level'], 'score': public['levels_completed'],
                               'state': public['state'], 'frameHash': public['frame_hash']})
            for call in row.get('linkedTemporalCalls', []):
                for side in ['sourceBefore', 'sourceAfter']:
                    for state in call[side]['phase']['states']:
                        if state['rows'] == creation['decodedValue']:
                            states.append({'pointIndex': row['pointIndex'], 'callIndex': call['index'], 'side': side,
                                           'observationRef': state['ref'], 'frameHash': state['frame'],
                                           'before': call['before'], 'after': call['after']})
        timeline.append({'pointIndex': row['pointIndex'], 'requestType': row['request']['type'],
                         'sequence': row['request']['sequence'], 'present': fragment in nodes,
                         'nodeCount': row['knowledge']['nodeCount'], 'graphRevision': row['knowledge']['toRevision'],
                         'fragmentDeltas': [delta['sequence'] for delta in deltas if delta['node']['id'] == fragment]})
    assert creation is not None, 'Fragment missing from selected functional session'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('baseline', type=Path)
    parser.add_argument('candidate', type=Path)
    parser.add_argument('fragment')
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    paths = [(ROOT / path).resolve() for path in [args.baseline, args.candidate]]
    output = (ROOT / args.output).resolve()
    assert output.is_relative_to(ROOT / 'docs/migration/lot5a-evidence') and not output.exists()
    before = [fingerprint(path) for path in paths]
    first, second = [inspect(path, args.fragment) for path in paths]
    a, b = first['creation']['delta'], second['creation']['delta']
    differences = compare(a['node'], b['node'])
    after = [fingerprint(path) for path in paths]
    assert before == after
    result = {'schema': 'logos-engine.lot5a-shared-fragment-origin-diagnostic.v1',
              'status': 'captured_first_creator_difference', 'recordedAt': datetime.now(timezone.utc).isoformat(),
              'generator': fingerprint(Path(__file__)), 'fragmentId': args.fragment,
              'inputsBefore': before, 'inputsAfter': after, 'inputsUnchanged': True,
              'canonicalCompleteValuesEqual': canonical(a['node']['value']) == canonical(b['node']['value']),
              'completeNodesEqual': a['node'] == b['node'], 'nodeDifferences': differences,
              'baseline': first, 'candidate': second,
              'contractChanged': False, 'qualifiedAttribution': False, 'costMeasurementExecuted': False,
              'qualification': 'Read-only diagnostic of retained STCK measured-form graphs. Exact complete fragment values and first creation delta hashes are compared; actual referencing roots and the creation timeline remain visible. This does not approve a changed provenance rule or provide a cost result.'}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x') as stream:
        stream.write(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': result['status'], 'output': str(output.relative_to(ROOT)),
                      'canonicalCompleteValuesEqual': result['canonicalCompleteValuesEqual'],
                      'nodeDifferences': differences,
                      'firstCreationPoints': {'baseline': first['creation']['pointIndex'], 'candidate': second['creation']['pointIndex']},
                      'firstRootIds': {role: sorted({row['nodeId'] for row in item['consumers'] if row['pointIndex'] == item['creation']['pointIndex']})
                                       for role, item in [('baseline', first), ('candidate', second)]}}))


if __name__ == '__main__':
    main()
