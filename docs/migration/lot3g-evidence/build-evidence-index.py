#!/usr/bin/env python3
"""Index completed 3G delivery evidence; never run an agent or a measurement."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import hashlib
import json
import subprocess
import sys

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
OUTPUT = BASE / 'evidence-index.json'
LOCAL = timezone(timedelta(hours=-3))
NATIVE_DIGEST = 'fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26'
BASELINE_COMMIT = '08bc35e447d17530a774c146ce4e660b1ef29d9a'
RELATED = [
    '.gitignore', 'migration/v6-transfer-map.json',
    'docs/migration/lot3g-framed-window.md', 'docs/migration/lot3g-framed-window-lineage.md',
    'docs/migration/v6-delivery-roadmap.md', 'docs/migration/v6-native-transfer.md',
    'docs/migration/v6-coverage.json', 'docs/migration/v6-entry-point-progress.json',
    'src/logos-engine/v5-temporal-fragment-match.ts',
    'src/logos-engine/v6-framed-window-observation.ts', 'src/logos-engine/v6-framed-window-access.ts',
    'src/logos-engine/v6-shared-series.ts', 'src/logos-engine/v6-native-runtime.ts',
    'tests/v5-temporal-fragment-match.test.ts', 'tests/v6-framed-window-observation.test.ts',
    'tests/v6-framed-window-access.test.ts', 'tests/v6-framed-window-integration.test.ts',
    'tests/v6-coupled-pair-planning.test.ts', 'tests/v6-radial-port-integration.test.ts',
    'tests/v6-support-caller-integration.test.ts',
    'tests/helpers/v6-live-game-campaign.ts',
    'scripts/audit-v6-entry-points.ts', 'scripts/audit-v6-migration.py',
    'scripts/export-v6-framed-window-reference.py', 'scripts/export-v6-framed-window-legacy-checkpoints.mjs',
    'scripts/prove-framed-window-common-loop.mjs', 'scripts/capture-native-loop-semantics.mjs',
    'scripts/verify-native-delta.py',
    'tests/fixtures/v6-framed-window-reference.json.gz',
    'tests/fixtures/v6-framed-window-legacy-checkpoints.json.gz',
]


def read(path):
    return json.loads(path.read_text())


def records():
    paths = {path for path in BASE.rglob('*') if path.is_file() and path != OUTPUT}
    paths.update(ROOT / name for name in RELATED)
    names = sorted(path.relative_to(ROOT).as_posix() for path in paths)
    proc = subprocess.run(['git', 'check-ignore', '-z', '--stdin'], cwd=ROOT,
                          input=('\0'.join(names) + '\0').encode(), capture_output=True)
    if proc.returncode not in (0, 1):
        raise RuntimeError(proc.stderr.decode())
    ignored = set(proc.stdout.decode().split('\0'))
    if ignored.intersection(RELATED):
        raise ValueError('Required related inputs cannot be omitted by ignore rules: '
                         + ', '.join(sorted(ignored.intersection(RELATED))))
    rows = []
    for name in names:
        if name in ignored:
            continue
        path = ROOT / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Expected regular retained file: ' + name)
        digest = hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        rows.append({'path': name, 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()})
    return rows


def final_metadata():
    native = read(BASE / 'final/source-manifest.json')
    archive = read(BASE / 'final/source-archive.json')
    baseline = read(BASE / 'baseline/provenance.json')
    preflight = read(BASE / 'publication-preflight.json')
    tests = read(BASE / 'final/revalidated/validation/delta-tests-run.json')
    scope = read(BASE / 'final/framed-window-validation-scope.json')
    cost = read(BASE / 'performance/global-budget-decision.json')
    assert native['digest'] == NATIVE_DIGEST and native['fileCount'] == 266
    assert archive['nativeSourceManifestDigest'] == NATIVE_DIGEST and len(archive['files']) == 277
    assert baseline['commit'] == BASELINE_COMMIT and baseline['siteVersion'] == 75
    assert baseline['nativeVersion'] == '0.47.0'
    assert preflight['status'] == tests['status'] == 'passed'
    assert preflight['nativeDigest'] == tests['nativeSourceManifestDigest'] == NATIVE_DIGEST
    assert scope['nativeDigest'] == NATIVE_DIGEST
    assert scope['gameContributionStatus'] == preflight['gameContributionStatus'] == 'open_not_demonstrated'
    assert scope['newSelectedGame'] is scope['newGameTarget'] is scope['newCaseClock'] is None
    assert cost['accepted'] == preflight['globalCostAccepted']
    counts = next(item['counts'] for item in tests['checks'] if item['name'] == 'delta-tests')
    assert counts['tests'] == counts['pass'] == 2566 and counts['fail'] == 0
    return {
        'nativeVersion': '0.48.0', 'nativeSourceDigest': NATIVE_DIGEST,
        'nativeFiles': 266, 'frozenArchiveFiles': 277,
        'baselineSiteVersion': 75, 'baselineNativeVersion': '0.47.0', 'baselineSourceCommit': BASELINE_COMMIT,
        'formalValidationDirectory': 'docs/migration/lot3g-evidence/final/revalidated/validation',
        'finalFormalTestCounts': counts,
        'initialFailedFormalReceiptRetained': 'docs/migration/lot3g-evidence/final/validation/delta-tests-run.json',
        'globalCostStatus': cost['status'], 'globalCostAccepted': cost['accepted'],
        'gameContributionStatus': scope['gameContributionStatus'],
        'newSelectedGame': None, 'newGameTarget': None, 'newCaseClock': None,
        'integratedEvidenceKind': scope['integratedEvidenceKind'],
    }


def main():
    if sys.argv[1:] not in ([], ['--verify']):
        raise ValueError('Usage: build-evidence-index.py [--verify]')
    metadata = final_metadata()
    rows = records()
    if sys.argv[1:] == ['--verify']:
        value = read(OUTPUT)
        if value['files'] != rows or value['fileCount'] != len(rows):
            raise ValueError('Evidence index differs from current retained membership or bytes')
        if any(value.get(key) != expected for key, expected in metadata.items()):
            raise ValueError('Evidence index qualification differs from completed source receipts')
        print(json.dumps({'status': 'verified', 'fileCount': len(rows),
                          'indexSha256': hashlib.sha256(OUTPUT.read_bytes()).hexdigest()}))
        return
    value = {
        'schema': 'logos-engine.lot3g-framed-window.delivery-index.v1',
        'recordedAt': datetime.now(LOCAL).isoformat(), 'displayTimeZone': 'UTC-03:00',
        **metadata,
        'functionalQualification': 'Own FramedWindow transfer and consumed V5 exact_candidates contracts verified. '
            'The source-ordered common-controller loop has two cold controlled synthetic sessions and 15 check groups, '
            'including acquired negative-trial contribution, current point authority and checkpoint reconstruction. '
            'This is not a live-game resolution or a complete caller ablation. Game contribution remains '
            'open_not_demonstrated. No new game case, target or clock is selected. Four recorded regressions and CATR '
            'browser controls remain separate evidence. The initial 2564/2566 formal run is preserved; two old registry '
            'expectations are corrected before all 68 files are revalidated on the unchanged native freeze. '
            '52/76 complete declared entries, 6/6 observed branches and 37 compiled workflows are distinct counts. '
            'Inherited source closure and full original-caller parity remain partial; prior CWSE/SK48/FOGW/VOIS '
            'clocks are unchanged. Cost acceptance remains a distinct per-case global decision.',
        'fileCount': len(rows), 'files': rows,
        'qualification': 'Retained delivery files plus named related modules, tests, fixture exports, common-loop proof, '
            'audits, capture helper, map, roadmap and registry. Ignored large originals are retained byte-identically '
            'as indexed parts or deterministic gzip with reconstruction receipts. This index excludes itself and '
            'does not rerun or reinterpret tests, build, game evidence or costs. Both original and revalidated formal '
            'receipts remain indexed. The published commit also contains the complete prior evidence history.'
    }
    with OUTPUT.open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': 'indexed', 'fileCount': len(rows),
                      'gameContributionStatus': metadata['gameContributionStatus']}))


if __name__ == '__main__':
    main()
