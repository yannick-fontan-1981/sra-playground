#!/usr/bin/env python3
"""Verify completed 3G publication inputs without rerunning their producers.

Run only after final revalidation, timing, consolidation and delivery writing.
The initial failed test receipt remains historical evidence. The authoritative
passing test receipt is final/revalidated/validation/delta-tests-run.json.
"""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import gzip
import hashlib
import json

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
LOCAL = timezone(timedelta(hours=-3))
NATIVE_DIGEST = 'fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26'
BASELINE_COMMIT = '08bc35e447d17530a774c146ce4e660b1ef29d9a'
BASELINE_DIGEST = '54d8742300a04dcdf0cb1b038bc62b947d4a1c60f70da4ee80e6971b0f021165'
VALIDATION = BASE / 'final/revalidated/validation'
CHANGED_TESTS = {'tests/v6-coupled-pair-planning.test.ts',
                 'tests/v6-radial-port-integration.test.ts'}


@lru_cache(maxsize=None)
def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def record(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError('Expected regular retained input: ' + str(path))
    return {'path': path.relative_to(ROOT).as_posix(),
            'bytes': path.stat().st_size, 'sha256': sha(path)}


def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)


def check(files):
    for name, digest in files.items():
        assert record(ROOT / name)['sha256'] == digest, name
    return len(files)


def check_record(item):
    assert record(ROOT / item['path']) == item, item['path']


def test_result(value):
    checks = [item for item in value['checks'] if item['name'] == 'delta-tests']
    assert len(checks) == 1
    assert checks[0]['tapSummaryComplete'] is True
    check_record(checks[0]['output'])
    return checks[0]


def main():
    manifest = read(BASE / 'final/source-manifest.json')
    assert manifest['digest'] == NATIVE_DIGEST and manifest['fileCount'] == 266
    current = dict(sorted((path.relative_to(ROOT).as_posix(), sha(path))
        for folder in ['src/logos-engine', 'src/runtime']
        for path in (ROOT / folder).rglob('*')
        if path.is_file() and path.suffix in ('.ts', '.json', '.drm')))
    assert current == manifest['files']
    assert hashlib.sha256(json.dumps(current, separators=(',', ':')).encode()).hexdigest() == NATIVE_DIGEST
    assert (BASE / 'final/revalidated/source-manifest.json').read_bytes() == (BASE / 'final/source-manifest.json').read_bytes()
    archive = read(BASE / 'final/source-archive.json')
    assert archive['nativeSourceManifestDigest'] == NATIVE_DIGEST and len(archive['files']) == 277

    baseline = read(BASE / 'baseline/provenance.json')
    assert baseline['siteVersion'] == 75 and baseline['nativeVersion'] == '0.47.0'
    assert baseline['commit'] == BASELINE_COMMIT
    assert baseline['nativeSource']['digest'] == BASELINE_DIGEST
    assert baseline['nativeSource']['fileCount'] == 263

    initial = read(BASE / 'final/validation/delta-tests-run.json')
    tests = read(VALIDATION / 'delta-tests-run.json')
    retry = read(BASE / 'diagnostic/formal-validation-retry.json')
    build_path = VALIDATION / 'checks-run.json'
    build = read(build_path)
    assert initial['status'] == 'failed'
    initial_check, final_check = test_result(initial), test_result(tests)
    assert initial_check['counts'] == {'tests': 2566, 'pass': 2564, 'fail': 2,
                                       'cancelled': 0, 'skipped': 0, 'todo': 0}
    assert initial_check['exitCode'] != 0
    assert tests['status'] == build['status'] == 'passed'
    assert final_check['exitCode'] == 0
    assert final_check['counts'] == {'tests': 2566, 'pass': 2566, 'fail': 0,
                                     'cancelled': 0, 'skipped': 0, 'todo': 0}
    assert tests['testFiles'] == initial['testFiles'] and len(tests['testFiles']) == 68
    assert set(tests['sourceAndTestInputs']) == set(initial['sourceAndTestInputs'])
    changed = {name for name, digest in tests['sourceAndTestInputs'].items()
               if digest != initial['sourceAndTestInputs'][name]}
    assert changed == CHANGED_TESTS == set(retry['changedTests'])
    assert retry['nativeSourceUnchanged'] and retry['nativeDigest'] == NATIVE_DIGEST
    assert retry['initialCounts'] == initial_check['counts']
    assert retry['retryDirectory'] == (BASE / 'final/revalidated').relative_to(ROOT).as_posix()
    for item in [retry['initial'], retry['retainedInitialLog'], retry['reusedBuildReceipt']]:
        check_record(item)
    # This is the same completed build receipt, not a claim of a second build.
    assert build_path.read_bytes() == (BASE / 'final/validation/checks-run.json').read_bytes()
    for value in [initial, tests, build]:
        assert value['nativeSourceManifestDigest'] == NATIVE_DIGEST
        assert value['nativeSourceUnchanged'] is True
    assert tests['sourceAndTestInputsUnchanged'] is True
    assert len(build['checks']) == 5 and all(item['exitCode'] == 0 for item in build['checks'])
    for item in build['checks']:
        check_record(item['output'])
    counts = {'native': check(manifest['files']),
              'frozenArchiveInputs': check(archive['files']),
              'revalidatedSourceAndTests': check(tests['sourceAndTestInputs']),
              'unchangedBuildInputs': check(build['buildInputs'])}

    scope = read(BASE / 'final/framed-window-validation-scope.json')
    loop = read(BASE / 'final/framed-window-common-loop.json.gz')
    assert scope['nativeDigest'] == loop['nativeSource']['digest'] == NATIVE_DIGEST
    assert scope['gameContributionStatus'] == 'open_not_demonstrated'
    assert scope['newSelectedGame'] is scope['newGameTarget'] is scope['newCaseClock'] is None
    assert scope['integratedEvidenceKind'] == 'two_cold_controlled_synthetic_common_caller_sessions'
    check_record(scope['integratedEvidence'])
    assert loop['status'] == 'passed' and loop['verifiedCheckGroups'] == len(loop['checks']) == 15
    assert loop['scope']['synthetic'] is True and loop['scope']['coldControllerSessions'] == 2
    for name in ['liveGameSessions', 'liveGameActions', 'liveGameLevelCompletions',
                 'liveGameVictories', 'sourcePythonAgentExecutions', 'learnedCheckpointsInjected']:
        assert loop['scope'][name] == 0, name
    assert loop['scope']['fullCallerParityClaimed'] is False
    assert loop['scope']['fullCallerAblationExecuted'] is False
    assert loop['componentAblation']['actionOrRefusalChanged'] is True
    assert loop['componentAblation']['scope'] == 'framed_window_component_only'
    assert loop['sourceUnchangedDuringRun'] and loop['executionInputsUnchangedDuringRun']
    assert loop['sourceDeclarationsModified'] is False
    for item in loop['executionInputs']:
        check_record(item)
    assert {item['game'] for item in scope['retainedCaseClocks']} == {'CWSE', 'SK48', 'FOGW', 'VOIS'}
    for item in scope['retainedCaseClocks']:
        check_record(item['source'])
        original_resolution = read(ROOT / item['source']['path'])
        assert item['caseClock'] == original_resolution.get('caseClock', original_resolution.get('clock'))
        assert item['furtherDiagnosisOrLiveAttemptThisDelivery'] is False

    regressions = read(BASE / 'final/regressions/regression-summary.json')
    assert regressions['status'] == 'passed' and regressions['passed'] == regressions['total'] == 4
    assert regressions['nativeSource']['digest'] == regressions['nativeSourceAfter']['digest'] == NATIVE_DIGEST
    assert regressions['executionInputsUnchanged'] is True
    assert regressions['comparisonChecksPassed'] == regressions['comparisonChecksExpected']
    browser = read(BASE / 'final/browser/browser-qa.json')
    assert browser['status'] == 'controls_and_three_levels_verified'
    assert browser['nativeSourceDigest'] == NATIVE_DIGEST
    for item in browser['artifacts']:
        check_record(item)

    window = read(BASE / 'performance/window.json')
    cost = read(BASE / 'performance/global-budget-decision.json')
    policy = read(BASE / 'performance/global-budget-policy.json')
    consolidation = read(BASE / 'performance/consolidation-review.json')
    independent_cost = read(BASE / 'diagnostic/cost-result-review.json')
    assert window['status'] == window['finalIntegrity'] == consolidation['status'] == 'passed'
    assert consolidation['checkedCount'] == len(consolidation['checks'])
    assert all(item['passed'] is True for item in consolidation['checks'])
    assert independent_cost['status'] == 'passed'
    assert independent_cost['checkedCount'] == len(independent_cost['checks']) == 96
    assert all(item['passed'] is True for item in independent_cost['checks'])
    assert independent_cost['inputReceiptsUnchanged'] and not independent_cost['unsatisfied']
    assert cost['totalCases'] == len(cost['globalCases']) == 2
    assert cost['acceptedCases'] == sum(item['accepted'] is True for item in cost['globalCases'])
    assert cost['accepted'] == (cost['acceptedCases'] == cost['totalCases'])
    assert cost['measuredSessions'] == 32 and cost['measuredActions'] == 400
    assert policy['globalStage'] == 'session_elapsed' and policy['relativeIncreaseLimit'] == 0.1
    assert policy['comparison'] == 'strictly_less_than' and policy['allCasesMustPass'] is True
    assert policy['crossCaseCompensation'] is False
    assert policy['baseline']['commit'] == BASELINE_COMMIT and policy['baseline']['siteVersion'] == 75
    assert policy['candidate']['nativeDigest'] == NATIVE_DIGEST
    readiness = read(BASE / 'performance/readiness.json')
    assert readiness['measurementAuthorized'] and not readiness['pendingRequirements']
    for item in [*readiness['inputs'], *consolidation['inputs'], *cost['inputs'],
                 *independent_cost['inputs']]:
        check_record(item)
    results = (BASE / 'performance/results.md').read_text()
    report = (BASE.parent / 'lot3g-framed-window.md').read_text()
    assert 'En attente' not in results
    assert 'Aucun résultat de coût n’est anticipé.' not in report
    inputs = [BASE / name for name in [
        'baseline/provenance.json', 'final/source-manifest.json', 'final/source-archive.json',
        'final/revalidated/source-manifest.json', 'final/revalidated/validation/delta-tests-run.json',
        'final/revalidated/validation/checks-run.json', 'final/validation/delta-tests-run.json',
        'final/validation/checks-run.json', 'diagnostic/formal-validation-retry.json',
        'final/regressions/regression-summary.json', 'final/browser/browser-qa.json',
        'final/framed-window-common-loop.json.gz', 'final/framed-window-validation-scope.json',
        'diagnostic/shared-integration-review.json', 'final/delivery-integrity.json',
        'performance/readiness.json', 'performance/window.json', 'performance/global-budget-policy.json',
        'performance/global-budget-decision.json', 'performance/consolidation-review.json', 'performance/results.md',
        'diagnostic/cost-result-review.json', 'README.md',
    ]]
    inputs += [BASE.parent / name for name in ['lot3g-framed-window.md', 'lot3g-framed-window-lineage.md',
                                             'v6-delivery-roadmap.md', 'v6-native-transfer.md']]
    value = {
        'schema': 'logos-engine.lot3g.publication-inputs.v1', 'status': 'passed',
        'recordedAt': datetime.now(LOCAL).isoformat(), 'displayTimeZone': 'UTC-03:00',
        'generator': record(Path(__file__)), 'nativeVersion': '0.48.0', 'nativeDigest': NATIVE_DIGEST,
        'baselineSiteVersion': 75, 'baselineNativeVersion': '0.47.0', 'baselineCommit': BASELINE_COMMIT,
        'checkedInventories': counts, 'globalCostAccepted': cost['accepted'],
        'initialFormalTestCountsRetained': initial_check['counts'], 'finalFormalTestCounts': final_check['counts'],
        'formalValidationDirectory': VALIDATION.relative_to(ROOT).as_posix(),
        'buildReceiptReusedByteIdentically': True, 'changedTestMetadataFiles': sorted(changed),
        'gameContributionStatus': scope['gameContributionStatus'], 'newSelectedGame': None, 'newCaseClock': None,
        'integratedEvidenceKind': scope['integratedEvidenceKind'], 'integratedCheckGroups': loop['verifiedCheckGroups'],
        'inputs': [record(path) for path in inputs],
        'qualification': 'Final retained-input check after completed timing. No test, build, game or cost result is regenerated. '
            'The original 2564/2566 formal result remains retained; only two stale registry expectations changed, followed '
            'by the complete 68-file revalidation on the same frozen native source. The passing build receipt is reused '
            'byte-identically. FramedWindow common-loop evidence is explicitly synthetic; its component ablation is not '
            'a full-caller ablation. Game contribution remains open_not_demonstrated. No new game case or clock is selected; '
            'CWSE/SK48/FOGW/VOIS clocks remain unchanged. Global per-case cost acceptance is reported independently and '
            'cannot be overridden by this integrity check. Inherited source closure and full original-caller parity remain partial.'
    }
    with (BASE / 'publication-preflight.json').open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': value['status'], 'checkedInventories': counts,
                      'globalCostAccepted': cost['accepted'], 'gameContributionStatus': scope['gameContributionStatus']}))


if __name__ == '__main__':
    main()
