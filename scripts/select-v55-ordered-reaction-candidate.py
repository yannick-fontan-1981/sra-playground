#!/usr/bin/env python3
"""Measure original OrderedReaction geometry on retained public initial views.

This selects evaluation environments only. It runs no game, family proposer,
acquisition, source workflow or physical input, and initializes no live state.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
PIN = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / PIN / 'source'
CORPUS = ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
CORPUS_SHA = '3f82fb0b60a104095623216023054ef438ca4cc516941c671c385ebcbf1e54f2'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def evidence(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path),
            'bytes': path.stat().st_size}


def verify_sources():
    files = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    for path, item in files.items():
        if sha(SOURCE / path) != item['sha256']:
            raise ValueError('Pinned source changed: ' + path)
    return len(files)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output')
    args = parser.parse_args()
    destination = (ROOT / args.output).resolve()
    destination.relative_to(ROOT)
    if destination.exists():
        raise FileExistsError(destination)
    if sha(CORPUS) != CORPUS_SHA:
        raise ValueError('Retained public corpus changed')
    corpus = json.loads(gzip.decompress(CORPUS.read_bytes()))
    if corpus['actions'] != 0 or corpus['levelJumps'] != 0 or len(corpus['games']) != 100:
        raise ValueError('Expected 100 initial public views without actions or jumps')
    verified_before = verify_sources()
    sys.path.insert(0, str(SOURCE))
    from agents.yf_arc3_v6.morphology_policy.ordered_reaction.geometry import (
        FrameGrid, measure, measure_square_field,
    )
    declaration = SOURCE / 'agents/yf_arc3_v6/morphology_policy/ordered_reaction/reaction.drm'
    config = json.loads(declaration.read_text())['declarations'][0]['configuration']
    results = []
    for row in corpus['games']:
        rows = row['packet']['frame_rows']
        facts, per_action = measure(rows, [], config['direction_prior'])
        field = measure_square_field(FrameGrid(rows=rows))
        available = row['observation']['available_action_refs']
        directions = [action for action in config['direction_prior'] if action in available]
        process_available = config['process_prior'] in available
        geometric_candidate = bool(field and facts['ordered_tip_unique_ring_present']
                                   and directions and process_available)
        results.append({
            'game': row['game'], 'frameHash': row['observation']['frame_hash'],
            'observationRef': row['observation']['observation_ref'],
            'availableActionRefs': available, 'geometryAndInputsCandidate': geometric_candidate,
            'field': None if field is None else {
                'stride': field.stride, 'size': field.size,
                'rowPhase': field.row_phase, 'colPhase': field.col_phase,
            },
            'facts': facts, 'perActionFacts': per_action,
            'declaredDirectionalInputsAvailable': directions,
            'declaredProcessInputAvailable': process_available,
            'currentControlObserved': False, 'coldProposalAdmissible': False,
        })
    verified_after = verify_sources()
    output = {
        'schema': 'logos-engine.v55.readonly-ordered-reaction-candidate-selection.v1',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'generator': evidence(Path(__file__)), 'corpus': evidence(CORPUS),
        'referenceCommit': PIN,
        'sourceFilesVerifiedBefore': verified_before,
        'sourceFilesVerifiedAfter': verified_after,
        'declaration': evidence(declaration),
        'declaredRevisableDirectionPrior': config['direction_prior'],
        'declaredRevisableProcessPrior': config['process_prior'],
        'executionScope': {key: 0 for key in [
            'gameHostsLoaded', 'gameExecutions', 'familyInstances', 'agentProposals',
            'srcWorkflowCalls', 'acquisitionCalls', 'physicalActions', 'levelJumps',
            'privateStatesRead', 'commandsInjectedIntoAgent', 'statesInjectedIntoAgent',
        ]},
        'results': results,
        'summary': {
            'views': len(results),
            'squareFields': sum(row['field'] is not None for row in results),
            'uniqueRings': sum(row['facts']['ordered_tip_unique_ring_present'] for row in results),
            'geometryAndInputsCandidates': [row['game'] for row in results if row['geometryAndInputsCandidate']],
        },
        'qualification': 'Only unchanged original pure geometry is measured on recorded initial public rasters. '
                         'The declared directions and process input are revisable priors, not acquired controls. '
                         'Current control and ordered packet history are empty, so no cold OrderedReaction '
                         'proposal is admitted. Game codes label evaluation candidates; they do not select '
                         'production behavior. No geometry, input sequence, plan or learned state from this '
                         'study is supplied to any live agent. Initial morphology predicts neither a '
                         'successful acquisition nor an official level completion.',
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('x') as stream:
        json.dump(output, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'output': evidence(destination), 'summary': output['summary'],
                      'sourceFilesVerified': verified_after}), flush=True)


if __name__ == '__main__':
    main()
