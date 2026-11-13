#!/usr/bin/env python3
"""Verify retained proof inputs and the one allowed native version change; execute no runtime."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, subprocess

ROOT = Path(__file__).resolve().parents[5]
OUT = ROOT / 'docs/migration/lot8b-evidence/final-version-067-01/historical-input-reconciliation.json'
PRIOR = ROOT / 'docs/migration/lot8b-evidence/delivery-qualification-01'
COMMON = ROOT / 'docs/migration/lot8b-evidence/common-integration-01'
RUNTIME = 'src/logos-engine/v6-native-runtime.ts'
OLD = b"export const NATIVE_V6_IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.66.0';"
NEW = OLD.replace(b'0.66.0', b'0.67.0')


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def retained_bytes(name, expected):
    """Hash opaque bytes. Missing full archives may be proved by exact tracked parts."""
    p = Path(name)
    if not p.is_absolute():
        p = ROOT / p
    if p.is_file():
        actual = sha(p)
        return {'path': name, 'expected': expected, 'actual': actual,
                'status': 'unchanged' if actual == expected else 'different', 'materialized': True}
    manifest = p.with_name(p.name + '.parts.json')
    if not manifest.is_file():
        return {'path': name, 'expected': expected, 'status': 'missing'}
    data = json.loads(manifest.read_text())
    assert data['schema'] == 'logos-engine.evidence-byte-parts.v1'
    assert data['original']['file'] == p.name and data['original']['sha256'] == expected
    h, total, parts = hashlib.sha256(), 0, []
    for item in data['parts']:
        part = manifest.parent / item['file']
        assert part.parent == manifest.parent and part.is_file()
        assert part.stat().st_size == item['bytes'] and sha(part) == item['sha256']
        with part.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                h.update(block); total += len(block)
        parts.append({'path': part.relative_to(ROOT).as_posix(), 'sha256': item['sha256'], 'bytes': item['bytes']})
    assert total == data['original']['bytes']
    return {'path': name, 'expected': expected, 'actual': h.hexdigest(),
            'status': 'unchanged' if h.hexdigest() == expected else 'different', 'materialized': False,
            'preservedAsExactParts': True, 'decoded': False, 'regenerated': False,
            'partsManifest': manifest.relative_to(ROOT).as_posix(), 'partsManifestSha256': sha(manifest),
            'parts': parts}


def main():
    assert not OUT.exists()
    current = (ROOT / RUNTIME).read_bytes()
    original = subprocess.check_output(['git', 'show', '2583d81d856c13295040db88f5df8b3a99906bdc:' + RUNTIME], cwd=ROOT)
    assert original.count(OLD) == current.count(NEW) == 1 and current.replace(NEW, OLD) == original
    expected_old = json.loads((PRIOR / 'candidate-native.json').read_text())
    expected_new = json.loads((OUT.parent / 'candidate-native.json').read_text())
    assert set(expected_old['files']) == set(expected_new['files'])
    changed = [name for name in expected_old['files'] if expected_old['files'][name] != expected_new['files'][name]]
    assert changed == [RUNTIME]
    assert all(sha(ROOT / name) == expected for name, expected in expected_new['files'].items())
    # These domains contain the actual source, public inputs, tests and build configuration.
    # Git emits only changed path names; no closed-case payload is decoded or inspected.
    domains = ['src', 'tests', 'scripts', 'reference', 'public', 'content', 'migration',
               'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', '.openai/hosting.json']
    changes = subprocess.check_output(['git', 'diff', '--no-ext-diff', '--name-only',
                                      '2583d81d856c13295040db88f5df8b3a99906bdc', '--', *domains], cwd=ROOT, text=True).splitlines()
    assert changes == [RUNTIME], changes
    common = json.loads((COMMON / 'validation-summary.json').read_text())
    common_inputs, common_proofs = {}, []
    for key, group in common['checks'].items():
        for row in group['inputManifests']:
            p = ROOT / row['path']; assert sha(p) == row['sha256']
        manifest = ROOT / group['inputManifests'][0]['path']
        for name, expected in json.loads(manifest.read_text()).items():
            if name in common_inputs: assert common_inputs[name] == expected
            common_inputs[name] = expected
        common_proofs.append({'check': key, 'historicalStatus': group['status'],
                              'historicalTestCounts': group['testCounts'],
                              'receipt': group['receipt'], 'rerun': False})
    rows, excluded = [], []
    for name, expected in sorted(common_inputs.items()):
        if 'lkey' in name.lower():
            # Closure is absolute: do not target or rehash this individual archive.
            # Its tracked domain remains unchanged according to the aggregate Git comparison above.
            excluded.append({'reason': 'Closed case: no individual new payload access; tracked domain unchanged by aggregate Git comparison.'})
            continue
        if name == RUNTIME:
            assert hashlib.sha256(original).hexdigest() == expected
            rows.append({'path': name, 'expected': expected, 'actual': sha(ROOT / name),
                         'status': 'declared_version_only_difference', 'normalizedByteEquality': True})
        else:
            rows.append(retained_bytes(name, expected))
    assert all(row['status'] in ('unchanged', 'declared_version_only_difference') for row in rows), [r for r in rows if r['status'] not in ('unchanged', 'declared_version_only_difference')]
    regression_manifest = PRIOR / 'regressions-01/inputs-before.json'
    regressions = [retained_bytes(name, row['sha256']) for name, row in json.loads(regression_manifest.read_text()).items()]
    assert all(row['status'] == 'unchanged' for row in regressions), [r for r in regressions if r['status'] != 'unchanged']
    summary = json.loads((PRIOR / 'regressions-01/regression-summary.json').read_text())
    assert summary['status'] == 'passed' and summary['passed'] == 11 and summary['comparisonChecksPassed'] == 187
    result = {'schema': 'logos-engine.lot8b.historical-input-reconciliation.v1',
              'recordedAt': datetime.now(timezone.utc).isoformat(), 'status': 'reconciled_with_explicit_identity_delta',
              'generator': {'path': Path(__file__).relative_to(ROOT).as_posix(), 'sha256': sha(Path(__file__))},
              'qualifiedProductionCodeCommit': '2583d81d856c13295040db88f5df8b3a99906bdc',
              'finalNativeDigest': expected_new['digest'], 'previousNativeDigest': expected_old['digest'],
              'changedNativeFiles': changed, 'normalizedRuntimeByteEquality': True,
              'otherNativeFilesUnchanged': 330, 'sourceTestBuildDomainChanges': changes,
              'historicalCommonGroups': common_proofs,
              'commonInputCount': len(common_inputs), 'commonInputsExamined': len(rows),
              'closedCaseIndividualAccessExclusions': excluded,
              'commonInputResults': rows, 'recordedRegressionInputs': regressions,
              'recordedRegressionReuse': {'historicalCases': 11, 'historicalProjections': 187,
                                         'rerun': False, 'newFinalGraphEqualityClaim': False,
                                         'basis': 'All algorithm/data/test domains are unchanged after the sole declared version-literal normalization; original archives and comparator inputs remain exact. New identity-sensitive graph qualification is separate.'},
              'graphRenewalRequiredBeforeFinalQualification': True,
              'nativeSessionsExecuted': 0, 'gameSessionsExecuted': 0, 'oracleCalls': 0,
              'officialPerformanceMeasured': False, 'globalLockAcquired': False,
              'LKEY': 'permanently_closed_no_case_access_no_budget_reset'}
    with OUT.open('x') as f: json.dump(result, f, indent=2); f.write('\n')
    print(json.dumps({k: result[k] for k in ['status','commonInputCount','commonInputsExamined','otherNativeFilesUnchanged']}))


if __name__ == '__main__': main()
