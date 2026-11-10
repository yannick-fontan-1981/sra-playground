#!/usr/bin/env python3
"""Bind the completed 7A results and the unchanged compiled inputs for release.

This does not run a test, game, build or timing experiment. The retained formal
gates and independent cost decision keep their own status and qualifications.
"""
from __future__ import annotations

from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot7a-evidence'
PERF = BASE / 'performance-integrated'
FINAL = BASE / 'integrated-final'


def read(path):
    return json.loads(path.read_text())


def fingerprint(path):
    path = path.resolve()
    assert path.is_relative_to(ROOT), path
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}


def verify(record):
    assert fingerprint(ROOT / record['path']) == record, record['path']


def verify_inventory(files):
    for name, digest in files.items():
        assert fingerprint(ROOT / name)['sha256'] == digest, name
    return len(files)


def main():
    output = FINAL / 'publication-inputs.json'
    assert not output.exists(), output
    source = read(FINAL / 'source-manifest.json')
    archive = read(FINAL / 'source-archive.json')
    tests = read(FINAL / 'validation/delta-tests-run.json')
    checks = read(FINAL / 'project-checks-retry/validation/checks-run.json')
    integrity = read(FINAL / 'delivery-integrity.json')
    readiness = read(PERF / 'readiness.json')
    window = read(PERF / 'window.json')
    aggregate = read(PERF / 'owner-growth-comparison.json')
    review = read(PERF / 'owner-growth-review.json')
    transport = read(PERF / 'log-transport.json')
    render = read(PERF / 'results-render.json')
    assert tests['status'] == checks['status'] == integrity['status'] == 'passed'
    assert len(checks['checks']) == 5 and all(r['exitCode'] == 0 for r in checks['checks'])
    assert tests['checks'][0]['counts']['pass'] == 3745
    assert tests['checks'][0]['counts']['fail'] == 0 and len(tests['testFiles']) == 97
    for receipt in [tests, checks]:
        assert receipt['nativeSourceManifestDigest'] == source['digest']
        assert receipt['nativeSourceUnchanged'] is True
    assert integrity['nativeSourceDigest'] == readiness['nativeSourceDigest'] == source['digest']
    assert window['status'] == window['finalIntegrity'] == 'passed'
    assert [r['label'] for r in window['executions']] == ['A1', 'B1', 'B2', 'A2']
    assert window['nativeDigests']['correction'] == source['digest']
    assert aggregate['status'] == 'qualified_consolidation_complete'
    assert review['status'] == 'qualified_owner_cost_review_passed'
    assert review['globalAccepted'] is True and review['acceptedCases'] == review['totalCases'] == 2
    assert aggregate['historicalStrictPassed'] is review['historicalStrictPassed'] is False
    assert review['inputsUnchanged'] is True
    assert not (PERF / 'combined-comparison.json').exists()
    counts = {
        'native': verify_inventory(source['files']),
        'archiveMembers': verify_inventory(archive['files']),
        'sourceAndTests': verify_inventory(tests['sourceAndTestInputs']),
        'buildInputs': verify_inventory(checks['buildInputs']),
    }
    verify(checks['nativeAgentWorker'])
    for record in readiness['inputs']:
        verify(record)
    for record in review['inputs']:
        verify(record)
    baseline = Path(window['baselineCheckout']).resolve()
    for record in review.get('watchedExternalInputs', []):
        path = Path(record['path']).resolve()
        assert path.is_relative_to(baseline), path
        data = path.read_bytes()
        assert len(data) == record['bytes'] and hashlib.sha256(data).hexdigest() == record['sha256'], path
    assert len(transport['logs']) == 4
    for log in transport['logs']:
        verify(log['original']); verify(log['transport'])
        assert gzip.decompress((ROOT / log['transport']['path']).read_bytes()) == (ROOT / log['original']['path']).read_bytes()
    for execution in window['executions']:
        path = Path(execution['log'])
        assert fingerprint(path)['sha256'] == execution['logSha256']
    for execution in window['executions']:
        path = Path(execution.get('copiedOutput', execution['output']))
        assert fingerprint(path)['sha256'] == execution['reportSha256']
    linked = [
        FINAL / 'source-manifest.json', FINAL / 'source-archive.json',
        FINAL / 'validation/delta-tests-run.json',
        FINAL / 'project-checks-retry/validation/checks-run.json',
        FINAL / 'delivery-integrity.json', PERF / 'readiness.json',
        PERF / 'window.json', PERF / 'owner-growth-contract.json',
        PERF / 'owner-growth-comparison.json', PERF / 'owner-growth-review.json',
        PERF / 'aggregation-failure.json', PERF / 'aggregation-failure.log',
        PERF / 'log-transport.json', PERF / 'results.md', PERF / 'results-render.json',
        BASE / 'coordination/published-base-binding.json',
    ]
    if review.get('ioCorrection'):
        verify(review['ioCorrection'])
        linked.append(ROOT / review['ioCorrection']['path'])
    result = {
        'schema': 'logos-engine.lot7a-publication-inputs.v1', 'status': 'passed',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'generator': fingerprint(Path(__file__)),
        'nativeVersion': '0.52.0', 'nativeSourceDigest': source['digest'],
        'fileInventories': counts, 'nativeAgentWorker': checks['nativeAgentWorker'],
        'costGlobalStatus': review['globalStatus'],
        'historicalStrictPassed': False,
        'postMeasurementIoCorrection': review.get('postMeasurementIoCorrection', False),
        'receipts': [fingerprint(path) for path in linked],
        'qualification': 'File integrity and release provenance only. No test, build, game or cost sample rerun. '
            'The already compiled worker and every recorded source/test/build input are unchanged. '
            'All 32 measured sessions and eight declared warmups remain in the four original reports. '
            'The historical strict failure remains failed; the independently reviewed supplementary '
            'decision retains its premeasurement structural rule and explicit postmeasurement I/O repair. '
            'This receipt does not assert publication, full caller parity, a third LKEY level, '
            'or a bound on arbitrary long-session latency or memory.',
    }
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'fileInventories': counts,
                      'receipt': fingerprint(output)}))


if __name__ == '__main__':
    main()
