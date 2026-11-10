#!/usr/bin/env python3
"""Bind completed functional evidence before the first official cost sample."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
DIGEST = 'e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87'

def read(name): return json.loads((BASE / name).read_text())
def fp(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}

def main():
    output = BASE / 'performance/readiness.json'
    assert not output.exists() and not (BASE / 'performance/window.json').exists()
    tests = read('final/validation/delta-tests-run.json')
    checks = read('final/validation/checks-run.json')
    audit = read('final/validation/migration-audit-resolution.json')
    regression = read('final/regressions/regression-summary.json')
    integrity = read('final/delivery-integrity.json')
    case = read('final/conn-resolution.json')
    browser = read('final/browser/browser-qa.json')
    parity = read('diagnostic/conn-public-parity.json')
    isolation = read('performance/coordinated-isolation.json')
    for value in [tests, checks, audit, regression, integrity, browser, parity]:
        assert value['status'] == 'passed'
    assert tests['nativeSourceManifestDigest'] == checks['nativeSourceManifestDigest'] == DIGEST
    assert integrity['nativeSourceDigest'] == parity['nativeSourceDigest'] == browser['nativeSourceDigest'] == DIGEST
    counts = tests['checks'][0]['counts']
    assert counts == {'tests': 3225, 'pass': 3225, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}
    assert len(tests['testFiles']) == 76
    assert len(checks['checks']) == 5 and all(row['exitCode'] == 0 for row in checks['checks'])
    assert audit['audit']['failures'] == []
    assert regression['passed'] == regression['total'] == 5
    assert regression['comparisonChecksPassed'] == regression['comparisonChecksExpected'] == 85
    assert case['status'] == 'target_reached' and case['actual']['actions'] == 21 and case['actual']['levelsCompleted'] == 3
    assert case['caseClock']['cumulativeSeconds'] == 1014.763812 and not case['caseClock']['clockReset']
    assert browser['final'] == {'actions': 21, 'levelsCompleted': 3, 'plans': 21, 'currentLevel': 4}
    assert parity['checkedCount'] == 1361 and parity['contribution']['interventions'] == 84
    assert parity['contribution']['actionOrRefusalChanges'] == 33 and parity['contribution']['negativeOrUnchanged'] == 51
    assert isolation['status'] == 'acknowledged_quiet_before_window'
    assert isolation['otherLaneAcknowledged'] and isolation['ownTrackedComputeEnded'] and isolation['previewStopped']
    assert isolation['costNodeOptionsOverride'] is None
    static = read('performance/static-preflight.json')
    assert static['status'] == 'static_inputs_checked' and all(row['satisfied'] for row in static['checks'])
    review = read('diagnostic/cost-protocol-review.json')
    assert review['status'] == 'finalized_static_inputs_reviewed_readiness_pending'
    assert review['checkedCount'] == review['satisfiedCount'] == 56 and review['blockingFindings'] == []
    names = [
        'final/source-manifest.json', 'final/source-archive.json', 'final/source-archive-parts.json',
        'baseline/source-manifest.json', 'baseline/provenance.json',
        'final/validation/delta-tests-run.json', 'final/validation/checks-run.json',
        'final/validation/migration-audit-resolution.json',
        'final/regressions/regression-summary.json', 'regression-recovery.json',
        'final/recurrent-series-common-loop.json.gz', 'final/recurrent-series-validation-scope.json',
        'final/conn-resolution.json', 'final/browser/browser-qa.json',
        'diagnostic/conn-public-parity.json', 'diagnostic/conn-public-source-parity.json.gz',
        'diagnostic/source-oracle-export.json', 'diagnostic/shared-integration-review.json',
        'final/delivery-integrity.json', 'pre-window-log-transport.json',
        'performance/declaration.json', 'performance/protocol.md', 'performance/protocol-check.json',
        'performance/global-budget-policy.json', 'performance/static-preflight.json',
        'diagnostic/cost-protocol-review.json', 'performance/coordinated-isolation.json',
    ]
    value = {'schema': 'logos-engine.native-cost-window-readiness.v1',
        'status': 'ready', 'finalizedAt': datetime.now(timezone(timedelta(hours=-3))).isoformat(),
        'measurementAuthorized': True, 'pendingRequirements': [], 'generator': fp(Path(__file__).resolve()),
        'nativeVersion': '0.50.0', 'nativeSourceDigest': DIGEST,
        'formalTests': counts, 'formalTestFiles': 76, 'regressionChecks': 85,
        'inputs': [fp(BASE / name) for name in names],
        'isolation': isolation,
        'qualification': 'Completed functional, source, contribution, browser, regression and byte-integrity evidence precede the first official sample. Both interrupted WEAV attempts remain retained with the recovery. The replay-specific memory configuration is not used by the official cost window. Cooperative lane acknowledgement and tracked task completion establish the declared quiet window; process-namespace visibility is not treated as a complete machine inventory.'}
    with output.open('x') as stream: stream.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': 'ready', 'receipt': fp(output)}))

if __name__ == '__main__':
    main()
