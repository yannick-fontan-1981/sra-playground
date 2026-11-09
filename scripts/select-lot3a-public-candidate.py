#!/usr/bin/env python3
"""Measure original composition admission on archived initial public rasters.

This selection audit runs no host, proposer, acquisition routine, or game action.
It never imports or reads game implementations, specifications, or solutions.
"""
from __future__ import annotations

import gzip
import hashlib
import importlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
CORPUS = ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
DESTINATION = ROOT / 'docs/migration/lot3a-evidence/public-candidate-scan.json'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def verify_source():
    manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    for relative, entry in manifest.items():
        assert digest((SOURCE / relative).read_bytes()) == entry['sha256'], relative
    return len(manifest)


def main():
    before = verify_source()
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    names = [('exposed_reception_plan', 'exposed_reception_access'),
             ('chamber_relation_plan', 'relational_chamber_projection'),
             ('panel_service_plan', 'panel_service_projection'),
             ('rooted_line_plan', 'rooted_line_projection'),
             ('reception_service_plan', 'reception_service_projection'),
             ('reference_population_plan', 'reference_population_access')]
    raw = CORPUS.read_bytes()
    corpus = json.loads(gzip.decompress(raw))
    assert corpus['sourceCommit'] == COMMIT and corpus['actions'] == corpus['levelJumps'] == 0
    results = []
    for key, name in names:
        module = importlib.import_module(name)
        matches = []
        for view in corpus['games']:
            rows = view['packet']['frame_rows']
            assert digest(json.dumps(rows, separators=(',', ':')).encode())[:16] == view['observation']['frame_hash']
            measured = module.scene(rows)
            if measured is not None:
                counts = {field: len(value) for field, value in measured.items() if isinstance(value, (list, dict))}
                matches.append({'game': view['game'], 'observationRef': view['observation']['observation_ref'],
                                'frameHash': view['observation']['frame_hash'], 'measuredCounts': counts,
                                'measurement': measured})
        results.append({'planKey': key, 'function': name + '.scene', 'sourceFile': str(Path(module.__file__).relative_to(SOURCE)),
                        'sourceSha256': digest(Path(module.__file__).read_bytes()),
                        'viewsMeasured': len(corpus['games']), 'acceptedCount': len(matches), 'matches': matches})
    carry_receipt = ROOT / 'docs/migration/lot2b-evidence/final/catr-resolution.json'
    carry = json.loads(carry_receipt.read_text())
    result = {'schema': 'logos-engine.lot3a.public-candidate-scan.v1', 'sourceCommit': COMMIT,
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': digest(Path(__file__).read_bytes()),
              'pinnedSourceFilesVerifiedBeforeImport': before, 'pinnedSourceFilesVerifiedAfterRun': verify_source(),
              'corpus': {'path': str(CORPUS.relative_to(ROOT)), 'sha256': digest(raw), 'views': len(corpus['games']),
                         'recordedActions': corpus['actions'], 'recordedLevelJumps': corpus['levelJumps']},
              'executionScope': {'gameHostsLoaded': 0, 'gameExecutions': 0, 'agentProposals': 0,
                                 'acquisitionCalls': 0, 'dispatchedActions': 0, 'privateStatesRead': 0,
                                 'gameSourcesRead': 0, 'solutionsOrOraclesRead': 0,
                                 'scope': 'Only unchanged pure source scene measurements over retained public rows.'},
              'results': results,
              'clockEvidence': {'CATR': {'priorResolution': str(carry_receipt.relative_to(ROOT)),
                                          'sha256': digest(carry_receipt.read_bytes()),
                                          'carriedBlockedSeconds': carry['secondsSinceSelection']},
                                'RSWP': {'carriedBlockedSeconds': 0,
                                         'basis': 'No prior selected RSWP game found in the archived docs/migration selection and resolution receipts before this selection.'}},
              'selection': {'entry': 'observed_composition_services', 'subscope': 'panel_service_plan',
                            'evaluationGame': 'RSWP', 'candidateOnly': True,
                            'basis': 'The only initial public raster admitted by the unchanged panel observer; all three panels have a unique direct current material/receiver correspondence. No new V5 numerical kernel is required for this first branch.',
                            'qualification': 'Admission and displayed correspondence are hypotheses for a bounded cold campaign, not observed execution semantics or completed levels.'}}
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'path': str(DESTINATION.relative_to(ROOT)), 'views': len(corpus['games']),
                      'matches': {item['planKey']: [match['game'] for match in item['matches']] for item in results},
                      'sourceFilesVerified': before}))


if __name__ == '__main__':
    main()
