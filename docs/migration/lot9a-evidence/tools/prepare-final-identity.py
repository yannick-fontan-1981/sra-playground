#!/usr/bin/env python3
"""Reserve the prospective 9A identity and reconcile a literal-only change. No native execution."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[4]
BASELINE = Path('/workspace/sites/sra-lot9a-baseline067-20261112')
STAGE = ROOT / 'docs/migration/lot9a-evidence/delivery-final-068-01'
COORDINATION = Path('/workspace/shared/sra-coordination')
PUBLISHED = '8462204043aa368faa7df280d796bb706eb53b38'
RUNTIME = 'src/logos-engine/v6-native-runtime.ts'
PREFIX = 'logos-engine.typescript.v6.native-migration/'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def save(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n')


def inventory(root):
    names = sorted(str(path.relative_to(root))
                   for folder in ['src/logos-engine', 'src/runtime']
                   for path in (root / folder).rglob('*')
                   if path.is_file() and path.suffix in {'.ts', '.json', '.drm'})
    files = {name: sha((root / name).read_bytes()) for name in names}
    return {'fileCount': len(files), 'digest': sha(json.dumps(files, separators=(',', ':')).encode()), 'files': files}


def main():
    assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=BASELINE, text=True).strip() == PUBLISHED
    before = inventory(ROOT)
    prior = json.loads((ROOT / 'docs/migration/lot9a-evidence/candidate-native.json').read_text())
    assert before == prior, 'The previously qualified production bytes must be intact'
    baseline = inventory(BASELINE)
    assert baseline['fileCount'] == 331 and baseline['digest'] == 'c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a'
    source = (ROOT / RUNTIME).read_text()
    assert source.count(PREFIX + '0.67.0') == 1
    stamp = datetime.now(timezone.utc).isoformat()
    reservation = {
        'schema': 'logos-engine.lot9a.native-version-reservation.v1', 'declaredAt': stamp,
        'owner': 'lot9a', 'nativeVersion': '0.68.0',
        'projectId': 'appgprj_6adbc388d79081918581b93b919d7258',
        'sourceBranch': 'lot9a-chart-navigation-20261112',
        'checkpointBranch': 'lot9a-chart-navigation-checkpoint-20261112',
        'parentCheckpoint': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'observedPublished': {'siteVersion': 108, 'nativeVersion': '0.67.0', 'commit': PUBLISHED},
        'scope': 'Prospective own-candidate reservation, created exclusively. Recheck actual publication and collisions inside the short publication lease; no cross-lane allocator is claimed.',
        'globalLockAcquired': False, 'peerAvailabilityWait': False,
        'publicationPerformed': False, 'status': 'reserved_for_final_delivery_qualification',
    }
    STAGE.mkdir(exist_ok=False)
    save(COORDINATION / 'native-version-0.68.0.json', reservation)
    save(STAGE / 'version-reservation.json', reservation)
    (ROOT / RUNTIME).write_text(source.replace(PREFIX + '0.67.0', PREFIX + '0.68.0'))
    after = inventory(ROOT)
    changed = [name for name in before['files'] if before['files'][name] != after['files'][name]]
    assert changed == [RUNTIME] and after['fileCount'] == 334
    assert (ROOT / RUNTIME).read_text().replace(PREFIX + '0.68.0', PREFIX + '0.67.0') == source
    added = sorted(set(after['files']) - set(baseline['files']))
    old_changed = [name for name in baseline['files'] if baseline['files'][name] != after['files'].get(name)]
    assert added == ['src/logos-engine/v6-chart-navigation-geometry.ts', 'src/logos-engine/v6-chart-navigation-policy.ts', 'src/logos-engine/v6-chart-navigation.ts']
    assert old_changed == [RUNTIME]
    save(STAGE / 'baseline-native.json', baseline)
    save(STAGE / 'prior-candidate-native.json', before)
    save(STAGE / 'candidate-native.json', after)
    save(STAGE / 'identity-reconciliation.json', {
        'schema': 'logos-engine.lot9a.final-identity-reconciliation.v1', 'declaredAt': stamp,
        'status': 'passed_literal_only', 'sourceGenerator': {'path': str(Path(__file__).relative_to(ROOT)), 'sha256': sha(Path(__file__).read_bytes())},
        'previousQualifiedDigest': before['digest'], 'finalCandidateDigest': after['digest'],
        'publishedDigest': baseline['digest'], 'nativeFiles': after['fileCount'],
        'changedSinceQualified': changed, 'inverseLiteralSubstitutionExact': True,
        'addedSincePublished': added, 'changedSincePublished': old_changed,
        'retainedTests': {'passed': 175, 'modules': 8, 'newTestExecutions': 0,
                          'qualification': 'Historical functional evidence applies to unchanged algorithms. Identity-sensitive delivery graphs will be freshly captured; this is not a rerun or relabeling of the historical tests.'},
        'priorCommonAccounting': {'initializedSessions': 10, 'physicalReturns': 14, 'registrationOnlyFactories': 2,
                                 'reservation': 'Old maximumSessions8 did not specify per-launch versus cumulative; retained, not erased.'},
        'nativeCodeExecuted': False, 'officialPerformanceMeasured': False, 'publicationPerformed': False,
    })
    status_path = COORDINATION / 'lot9a-status.json'
    status = json.loads(status_path.read_text())
    status.update(phase='final_068_delivery_preparation', updated_at=stamp,
                  active_workers=['chart_reference', 'chart_contract', 'chart_geometry'],
                  next_ordinary_work='Freeze final0.68 delivery tools and explicit per-attempt/cumulative bounds, capture paired published0.67 and candidate0.68 graphs, retain common prior10sessions14returns. Then official cost and private publication under short exclusivity.')
    status['candidate'].update(nativeDigest=after['digest'], implementationLiteral='0.68.0 prospective final candidate', newReleaseReserved=True, buildPassed=False)
    status_path.write_text(json.dumps(status, indent=2) + '\n')
    print(json.dumps({'status': 'prepared', 'nativeVersion': '0.68.0', 'nativeFiles': after['fileCount'], 'digest': after['digest'], 'sourceChange': 'literal_only', 'nativeCodeExecuted': False}))


if __name__ == '__main__':
    main()
