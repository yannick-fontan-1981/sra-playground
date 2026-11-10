#!/usr/bin/env python3
"""Index completed 3H evidence and changed delivery files; run no producer."""
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
NATIVE_DIGEST = 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054'
BASELINE_COMMIT = 'fbbc3fb6b796c0ba359654da7234008767090e1f'
RELATED = [
    '.gitignore', 'migration/v6-transfer-map.json',
    'docs/migration/lot3h-crossed-prefix.md', 'docs/migration/lot3h-crossed-prefix-lineage.md',
    'docs/migration/v6-delivery-roadmap.md', 'docs/migration/v6-native-transfer.md',
    'docs/migration/v6-coverage.json', 'docs/migration/v6-entry-point-progress.json',
    'src/logos-engine/v6-crossed-prefix-observation.ts', 'src/logos-engine/v6-crossed-prefix-access.ts',
    'src/logos-engine/v6-occurrence-recall.ts', 'src/logos-engine/v6-shared-series.ts',
    'src/logos-engine/v6-native-runtime.ts',
    'tests/v6-crossed-prefix-observation.test.ts', 'tests/v6-crossed-prefix-access.test.ts',
    'tests/v6-crossed-prefix-integration.test.ts',
    'tests/v6-coupled-pair-planning.test.ts', 'tests/v6-radial-port-integration.test.ts',
    'tests/v6-support-caller-integration.test.ts', 'tests/helpers/v6-live-game-campaign.ts',
    'scripts/audit-v6-entry-points.ts', 'scripts/audit-v6-migration.py',
    'scripts/export-v6-crossed-prefix-reference.py', 'scripts/export-v6-crossed-prefix-legacy-checkpoints.mjs',
    'scripts/prove-crossed-prefix-common-loop.mjs', 'scripts/capture-native-loop-semantics.mjs',
    'scripts/verify-native-delta.py',
    'tests/fixtures/v6-crossed-prefix-reference.json.gz',
    'tests/fixtures/v6-crossed-prefix-legacy-checkpoints.json.gz',
]


def read(path):
    return json.loads(path.read_text())


def git_names(arguments):
    data = subprocess.check_output(['git', *arguments], cwd=ROOT)
    return [name for name in data.decode().split('\0') if name]


def records():
    paths = {path for path in BASE.rglob('*') if path.is_file() and path != OUTPUT}
    paths.update(ROOT / name for name in RELATED)
    # The same baseline comparison works before and after the final commit.
    # This catches an additional campaign exporter or related modified file
    # without silently depending on an incomplete manually maintained list.
    changed = git_names(['diff', '--name-only', '--diff-filter=ACMRT', '-z', BASELINE_COMMIT, '--'])
    changed += git_names(['ls-files', '--others', '--exclude-standard', '-z'])
    paths.update(ROOT / name for name in changed if ROOT / name != OUTPUT)
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
    tests = read(BASE / 'final/validation/delta-tests-run.json')
    scope = read(BASE / 'final/crossed-prefix-validation-scope.json')
    weav = read(BASE / 'final/weav-resolution.json')
    cost = read(BASE / 'performance/global-budget-decision.json')
    assert native['digest'] == NATIVE_DIGEST and native['fileCount'] == 268
    assert archive['nativeSourceManifestDigest'] == NATIVE_DIGEST and len(archive['files']) == 279
    assert baseline['commit'] == BASELINE_COMMIT and baseline['siteVersion'] == 76
    assert baseline['nativeVersion'] == '0.48.0'
    assert preflight['status'] == tests['status'] == 'passed'
    assert preflight['nativeDigest'] == tests['nativeSourceManifestDigest'] == NATIVE_DIGEST
    assert scope['nativeDigest'] == NATIVE_DIGEST
    assert scope['gameContributionStatus'] == preflight['gameContributionStatus']
    assert scope['integratedEvidenceKind'] == preflight['integratedEvidenceKind']
    assert cost['accepted'] == preflight['globalCostAccepted']
    assert cost['status'] == preflight['globalCostStatus']
    counts = next(item['counts'] for item in tests['checks'] if item['name'] == 'delta-tests')
    assert counts['tests'] == counts['pass'] and counts['tests'] > 0
    assert all(counts[key] == 0 for key in ('fail', 'cancelled', 'skipped', 'todo'))
    assert counts == preflight['finalFormalTestCounts']
    assert len(tests['testFiles']) == preflight['formalTestFiles'] == 71
    assert weav['game'] == 'WEAV'
    assert weav['status'] == preflight['weavResolutionStatus']
    assert weav['actual'] == preflight['weavActual']
    assert weav.get('caseClock', weav.get('clock')) == preflight['weavCaseClock']
    return {
        'nativeVersion': '0.49.0', 'nativeSourceDigest': NATIVE_DIGEST,
        'nativeFiles': 268, 'frozenArchiveFiles': 279,
        'baselineSiteVersion': 76, 'baselineNativeVersion': '0.48.0', 'baselineSourceCommit': BASELINE_COMMIT,
        'formalValidationDirectory': 'docs/migration/lot3h-evidence/final/validation',
        'formalTestFiles': len(tests['testFiles']), 'finalFormalTestCounts': counts,
        'globalCostStatus': cost['status'], 'globalCostAccepted': cost['accepted'],
        'gameContributionStatus': scope['gameContributionStatus'],
        'integratedEvidenceKind': scope['integratedEvidenceKind'],
        'syntheticCommonScope': preflight['syntheticCommonScope'],
        'weavResolutionStatus': weav['status'], 'weavActual': weav['actual'],
        'weavCaseClock': preflight['weavCaseClock'],
        'browserStatus': preflight['browserStatus'],
        'optionalIndependentCostReview': preflight['optionalIndependentCostReview'],
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
        'schema': 'logos-engine.lot3h-crossed-prefix.delivery-index.v1',
        'recordedAt': datetime.now(LOCAL).isoformat(), 'displayTimeZone': 'UTC-03:00',
        **metadata,
        'functionalQualification': 'Own CrossedPrefix transfer, consumed current-raster measurements, retained '
            'selection/input/crossing contracts and the single inherited owner are checked within the declared scope. '
            'The source-ordered common-controller proof has three cold controlled synthetic sessions, 23 check groups '
            'and 17 returned commands, with two component ablations. It is not a live-game resolution or complete '
            'caller ablation. The actual WEAV result and cumulative case clock are read separately from their final '
            'receipt; this index neither anticipates success nor closes an open contribution reserve. Four recorded '
            'regressions and browser QA remain separate evidence. Formal test counts are read from the completed '
            '71-file receipt; no earlier lot retry narrative is imported. Eleven actual published 0.48 checkpoints '
            'include the historical sparse Crossed journal without inventing missing evidence. 53/76 declared '
            'entries, 6/6 observed branches and 37 workflows are distinct counts. Full inherited-caller parity and '
            'whole migration completion remain open. Cost acceptance is the separate per-game global decision.',
        'fileCount': len(rows), 'files': rows,
        'qualification': 'Retained delivery evidence, named related modules/tests/exporters/proof tools and all '
            'non-ignored changed or new files relative to the published baseline. Ignored large originals remain '
            'represented by indexed byte parts or deterministic gzip and reconstruction receipts. This index '
            'excludes itself and does not rerun tests, build, game evidence, source oracles or cost calculations. '
            'All retained preparation failures remain included. The published commit also preserves prior evidence history.'
    }
    with OUTPUT.open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': 'indexed', 'fileCount': len(rows),
                      'gameContributionStatus': metadata['gameContributionStatus'],
                      'weavResolutionStatus': metadata['weavResolutionStatus']}))


if __name__ == '__main__':
    main()
