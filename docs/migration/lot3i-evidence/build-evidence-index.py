#!/usr/bin/env python3
"""Index completed 3I evidence without rerunning any producer.

Run only after the final publication preflight. Both failed WEAV attempts,
actual strict recovery and either actual global-cost verdict remain explicit.
Temporary/shared coordination files are never delivery evidence.
"""
from pathlib import Path, PurePosixPath
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import hashlib
import json
import subprocess
import sys

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
OUTPUT = BASE / 'evidence-index.json'
LOCAL = timezone(timedelta(hours=-3))
NATIVE_DIGEST = 'e039a62b5dbb563a6c25f5469228e0025ffb66f243a4e09fdf27caeaeef2bf87'
BASELINE_COMMIT = '8fa6b261b8b23ac8d232e60c9c179e2f3407d82f'
BASELINE_DIGEST = 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054'
RELATED = [
    '.gitignore', 'migration/v6-transfer-map.json',
    'docs/migration/lot3i-recurrent-series.md', 'docs/migration/lot3i-recurrent-series-lineage.md',
    'docs/migration/v6-delivery-roadmap.md', 'docs/migration/v6-native-transfer.md',
    'docs/migration/v6-coverage.json', 'docs/migration/v6-entry-point-progress.json',
    'src/logos-engine/v6-recurrent-series-observation.ts', 'src/logos-engine/v6-recurrent-series-access.ts',
    'src/logos-engine/v6-supported-lines.ts', 'src/logos-engine/v6-occurrence-recall.ts',
    'src/logos-engine/v6-shared-series.ts', 'src/logos-engine/v6-native-runtime.ts',
    'tests/v6-recurrent-series-observation.test.ts', 'tests/v6-recurrent-series-access.test.ts',
    'tests/v6-recurrent-series-native.test.ts', 'tests/v6-recurrent-series-integration.test.ts',
    'tests/v6-cell-placement.test.ts', 'tests/v6-coupled-pair-planning.test.ts',
    'tests/v6-radial-port-integration.test.ts', 'tests/v6-support-caller-integration.test.ts',
    'tests/helpers/v6-live-game-campaign.ts', 'scripts/audit-v6-entry-points.ts',
    'scripts/audit-v6-migration.py', 'scripts/export-v6-recurrent-series-reference.py',
    'scripts/export-v6-recurrent-series-legacy-checkpoints.mjs',
    'scripts/probe-v6-recurrent-series-initial-public.py',
    'scripts/prove-recurrent-series-common-loop.mjs',
    'scripts/compare-recurrent-series-public-parity.py',
    'scripts/check-recurrent-series-public-parity.mjs',
    'scripts/replay-public-regression-released-baseline.mjs',
    'scripts/run-released-public-regressions.py', 'scripts/run-released-public-regressions-streamlog.py',
    'scripts/compare-v54-regressions.py',
    'scripts/verify-native-delta.py',
    'tests/fixtures/v6-recurrent-series-reference.json.gz',
    'tests/fixtures/v6-recurrent-series-legacy-checkpoints.json.gz',
    'docs/migration/lot3i-evidence/final/weav-memory-retry-v2/regressions/weav-049-streamlog-output.raw.log',
]


def read(path):
    return json.loads(path.read_text())


@lru_cache(maxsize=None)
def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def record(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError('Expected regular retained file: ' + str(path))
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path)}


def check_record(item):
    assert record(ROOT / item['path']) == {key: item[key] for key in ('path', 'bytes', 'sha256')}, item['path']


def git_names(arguments):
    data = subprocess.check_output(['git', *arguments], cwd=ROOT)
    return [name for name in data.decode().split('\0') if name]


def temporary_coordination(name):
    """Exclude transient notes, never the retained isolation/ack receipts."""
    path = PurePosixPath(name)
    if path.name == 'LOT4A_COORDINATION_REQUEST.md':
        return True
    if any(part.casefold() in {'coordination', 'sra-coordination', '.coordination',
                              'agent-coordination', 'shared-coordination'} for part in path.parts):
        return True
    if path.suffix.casefold() in {'.md', '.json', '.txt', '.lock'} and 'COORDINATION' in path.name.upper():
        return True
    if len(path.parts) == 1 and path.name.upper().startswith('LOT') and path.name.upper().endswith(
            ('-STATUS.JSON', '_STATUS.JSON', '-HANDOFF.MD', '_HANDOFF.MD')):
        return True
    return False


def records():
    paths = {path for path in BASE.rglob('*') if path.is_file() and path != OUTPUT}
    paths.update(ROOT / name for name in RELATED)
    # Relative to the actual published Site78 source, this remains valid before
    # and after the final commit. Additional delivery scripts are not omitted.
    changed = git_names(['diff', '--name-only', '--diff-filter=ACMRT', '-z', BASELINE_COMMIT, '--'])
    changed += git_names(['ls-files', '--others', '--exclude-standard', '-z'])
    paths.update(ROOT / name for name in changed if ROOT / name != OUTPUT)
    assert not any(temporary_coordination(name) for name in RELATED)
    names = sorted(path.relative_to(ROOT).as_posix() for path in paths
                   if not temporary_coordination(path.relative_to(ROOT).as_posix()))
    proc = subprocess.run(['git', 'check-ignore', '-z', '--stdin'], cwd=ROOT,
                          input=('\0'.join(names) + '\0').encode(), capture_output=True)
    if proc.returncode not in (0, 1):
        raise RuntimeError(proc.stderr.decode())
    ignored = set(proc.stdout.decode().split('\0'))
    if ignored.intersection(RELATED):
        raise ValueError('Required related inputs cannot be omitted by ignore rules: '
                         + ', '.join(sorted(ignored.intersection(RELATED))))
    return [record(ROOT / name) for name in names if name not in ignored]


def final_metadata():
    native = read(BASE / 'final/source-manifest.json')
    archive = read(BASE / 'final/source-archive.json')
    baseline = read(BASE / 'baseline/provenance.json')
    preflight = read(BASE / 'publication-preflight.json')
    tests = read(BASE / 'final/validation/delta-tests-run.json')
    scope = read(BASE / 'final/recurrent-series-validation-scope.json')
    conn = read(BASE / 'final/conn-resolution.json')
    cost = read(BASE / 'performance/global-budget-decision.json')
    regressions = read(BASE / 'final/regressions/regression-summary.json')
    audit = read(BASE / 'final/validation/migration-audit-resolution.json')
    entries = read(BASE.parent / 'v6-entry-point-progress.json')
    assert native['digest'] == NATIVE_DIGEST and native['fileCount'] == 270
    assert archive['nativeSourceManifestDigest'] == NATIVE_DIGEST and len(archive['files']) == 281
    assert baseline['commit'] == BASELINE_COMMIT and baseline['siteVersion'] == 78
    assert baseline['nativeVersion'] == '0.49.0'
    assert baseline['nativeSource']['digest'] == BASELINE_DIGEST and baseline['nativeSource']['fileCount'] == 268
    assert preflight['status'] == tests['status'] == 'passed'
    assert preflight['nativeDigest'] == tests['nativeSourceManifestDigest'] == NATIVE_DIGEST
    check_record(preflight['generator'])
    for item in preflight['inputs']:
        check_record(item)
    assert scope['nativeDigest'] == NATIVE_DIGEST
    assert scope['gameContributionStatus'] == preflight['gameContributionStatus']
    assert scope['integratedEvidenceKind'] == preflight['integratedEvidenceKind']
    assert cost['accepted'] == preflight['globalCostAccepted'] and cost['status'] == preflight['globalCostStatus']
    assert cost['status'] == ('accepted_under_user_global_rule' if cost['accepted'] else 'global_budget_review_required')
    counts = next(item['counts'] for item in tests['checks'] if item['name'] == 'delta-tests')
    assert counts['tests'] == counts['pass'] == 3225
    assert all(counts[key] == 0 for key in ('fail', 'cancelled', 'skipped', 'todo'))
    assert counts == preflight['finalFormalTestCounts']
    assert len(tests['testFiles']) == preflight['formalTestFiles'] == 76
    assert audit['status'] == 'passed' and audit['audit']['failures'] == []
    check_record(preflight['migrationAuditResolution'])
    assert conn['game'] == 'CONN' and conn['nativeSourceDigest'] == NATIVE_DIGEST
    assert conn['status'] == preflight['connResolutionStatus']
    assert conn['actual'] == preflight['connActual'] and conn['caseClock'] == preflight['connCaseClock']
    assert conn['sourceComparison'] == preflight['connSourceParity']
    assert conn['contribution'] == preflight['connComponentContribution']
    assert regressions['status'] == 'passed'
    assert regressions['passed'] == regressions['total'] == preflight['strictRegressionCases'] == 5
    assert regressions['comparisonChecksPassed'] == regressions['comparisonChecksExpected'] == preflight['strictRegressionChecks'] == 85
    assert preflight['regressionRecovery']['status'] == 'passed'
    assert preflight['regressionRecovery']['retainedFailureExitCodes'] == [-9, -6]
    assert len(preflight['regressionRecovery']['retainedFailedAttempts']) == 2
    for item in preflight['regressionRecovery']['retainedFailedAttempts']:
        check_record(item)
    assert len(preflight['regressionRecovery']['retainedIncompleteAttempts']) == 1
    assert preflight['regressionRecovery']['retainedIncompleteAttemptStatuses'] == ['incomplete_process_handle_unavailable']
    assert preflight['regressionRecovery']['incompleteAttemptExitStatusKnown'] is False
    assert preflight['regressionRecovery']['incompleteAttemptCauseEstablished'] is False
    assert preflight['regressionRecovery']['finalAttemptNumber'] == 4
    assert preflight['regressionRecovery']['rawOutputMatchesCompressed'] is True
    assert preflight['regressionRecovery']['nodeExitObserved'] is True
    for item in preflight['regressionRecovery']['retainedIncompleteAttempts']:
        check_record(item)
    for key in ['finalExecution', 'strictComparison', 'hostPreparation', 'subprocessPreflight', 'recovery',
                'incompleteHostPreparation', 'incompleteSubprocessPreflight', 'startedReceipt',
                'retainedOutputRaw', 'retainedOutputCompressed']:
        check_record(preflight['regressionRecovery'][key])
    check_record(preflight['coordinatedIsolation'])
    assert entries['connected'] == 54 and entries['declared'] == 76 and entries['partiallyConnected'] == 0
    assert entries['fullV6Parity'] is False
    return {
        'nativeVersion': '0.50.0', 'nativeSourceDigest': NATIVE_DIGEST,
        'nativeFiles': 270, 'frozenArchiveFiles': 281,
        'baselineSiteVersion': 78, 'baselineNativeVersion': '0.49.0', 'baselineSourceCommit': BASELINE_COMMIT,
        'formalValidationDirectory': 'docs/migration/lot3i-evidence/final/validation',
        'formalTestFiles': len(tests['testFiles']), 'finalFormalTestCounts': counts,
        'migrationAuditResolution': preflight['migrationAuditResolution'],
        'globalCostStatus': cost['status'], 'globalCostAccepted': cost['accepted'],
        'publicationQualification': preflight['publicationQualification'],
        'gameContributionStatus': scope['gameContributionStatus'],
        'integratedEvidenceKind': scope['integratedEvidenceKind'],
        'integratedCheckGroups': preflight['integratedCheckGroups'],
        'syntheticCommonScope': preflight['syntheticCommonScope'],
        'connResolutionStatus': conn['status'], 'connActual': conn['actual'], 'connCaseClock': conn['caseClock'],
        'connSourceParity': preflight['connSourceParity'], 'connComponentContribution': conn['contribution'],
        'strictRegressionCases': preflight['strictRegressionCases'],
        'strictRegressionChecks': preflight['strictRegressionChecks'],
        'regressionRecovery': preflight['regressionRecovery'],
        'browserStatus': preflight['browserStatus'], 'coordinatedIsolation': preflight['coordinatedIsolation'],
        'connectedEntries': entries['connected'], 'declaredEntries': entries['declared'], 'fullV6Parity': False,
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
            raise ValueError('Evidence index qualification differs from actual completed receipts')
        print(json.dumps({'status': 'verified', 'fileCount': len(rows), 'indexSha256': sha(OUTPUT)}))
        return
    value = {
        'schema': 'logos-engine.lot3i-recurrent-series.delivery-index.v1',
        'recordedAt': datetime.now(LOCAL).isoformat(), 'displayTimeZone': 'UTC-03:00',
        **metadata,
        'functionalQualification': 'Own RepeatedLine and SupportedLine transfer, measured fields, retained continuation, '
            'conditional insertion, public packet order and the single ancestral owner are checked in their declared scope. '
            'The synthetic complete-controller proof has two cold sessions, 18 groups and two own returned commands; it '
            'does not establish a complete-controller Supported preparation. Actual CONN uses 21 public actions and reaches '
            'three natural levels in one session; cold source/native parity covers 14 selected own proposals and all 21 '
            'returns/packets with 34 own events. The 84 component ablations retain 33 action/refusal changes and 51 '
            'unchanged results. These are component counterfactuals, not alternate live campaigns or full-caller ablations. '
            'All five recorded regressions must pass 85 unchanged checks. Both WEAV terminations, the incomplete third '
            'invocation without a known exit status or established cause, and the actual fourth memory-efficient host '
            'result remain explicit. Formal 3225-test/76-file, build, resolved audit and browser '
            'evidence are separate. 54/76 declared entries is not full inherited-caller parity or whole migration closure. '
            'Global cost acceptance is read separately and may remain rejected without invalidating this integrity index.',
        'fileCount': len(rows), 'files': rows,
        'qualification': 'Retained 3I evidence, named related modules/tests/exporters and all non-ignored delivery changes '
            'relative to the actual Site78 baseline. Ignored originals remain represented by retained byte parts or '
            'lossless compressed transports and their reconstruction receipts. The index excludes itself, the temporary '
            'LOT4A coordination request and shared coordination notes/locks/status files; it never traverses the external '
            'shared coordination directory. Retained in-repository quiet-acknowledgement and isolation receipts remain '
            'publication evidence. No test, build, game, oracle, comparator or cost producer is executed. Every retained '
            'failed preparation and replay remains included. A rejected global budget remains a qualified publication '
            'result, not a manufactured acceptance.'
    }
    with OUTPUT.open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': 'indexed', 'fileCount': len(rows),
                      'gameContributionStatus': metadata['gameContributionStatus'],
                      'connResolutionStatus': metadata['connResolutionStatus'],
                      'globalCostAccepted': metadata['globalCostAccepted']}))


if __name__ == '__main__':
    main()
