#!/usr/bin/env python3
"""Verify completed 3H publication inputs without rerunning their producers.

Run after final tests, actual case work/browser QA, timing, consolidation,
delivery integrity and report writing. Actual outcomes are read from retained
receipts: a synthetic proof is not a game result, and cost acceptance is not
anticipated. No retry or reused-build narrative is imported from earlier lots.
"""
from pathlib import Path
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import gzip
import hashlib
import json
import math

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
LOCAL = timezone(timedelta(hours=-3))
NATIVE_DIGEST = 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054'
BASELINE_COMMIT = 'fbbc3fb6b796c0ba359654da7234008767090e1f'
BASELINE_DIGEST = 'fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26'
VALIDATION = BASE / 'final/validation'
PRIOR_WEAV = ROOT / 'docs/migration/lot2b-evidence/final/weav-resolution.json'


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
    actual = record(ROOT / item['path'])
    assert actual == {key: item[key] for key in ('path', 'bytes', 'sha256')}, item['path']


def check_embedded_records(value):
    """Verify explicit file fingerprints without interpreting arbitrary data."""
    if isinstance(value, dict):
        if all(key in value for key in ('path', 'bytes', 'sha256')):
            check_record(value)
        else:
            for item in value.values():
                check_embedded_records(item)
    elif isinstance(value, list):
        for item in value:
            check_embedded_records(item)


def final_status(value, label):
    status = value.get('status')
    assert isinstance(status, str) and status, label
    assert status not in ('pending', 'running', 'in_progress', 'not_started', 'awaiting_result'), label
    return status


def main():
    output = BASE / 'publication-preflight.json'
    if output.exists():
        raise FileExistsError(output)
    manifest = read(BASE / 'final/source-manifest.json')
    assert manifest['digest'] == NATIVE_DIGEST and manifest['fileCount'] == 268
    current = dict(sorted((path.relative_to(ROOT).as_posix(), sha(path))
        for folder in ['src/logos-engine', 'src/runtime']
        for path in (ROOT / folder).rglob('*')
        if path.is_file() and path.suffix in ('.ts', '.json', '.drm')))
    assert current == manifest['files']
    assert hashlib.sha256(json.dumps(current, separators=(',', ':')).encode()).hexdigest() == NATIVE_DIGEST
    archive = read(BASE / 'final/source-archive.json')
    assert archive['nativeSourceManifestDigest'] == NATIVE_DIGEST and len(archive['files']) == 279
    check_record(archive['archive'])

    baseline = read(BASE / 'baseline/provenance.json')
    assert baseline['siteVersion'] == 76 and baseline['nativeVersion'] == '0.48.0'
    assert baseline['commit'] == BASELINE_COMMIT
    assert baseline['nativeSource']['digest'] == BASELINE_DIGEST
    assert baseline['nativeSource']['fileCount'] == 266

    tests = read(VALIDATION / 'delta-tests-run.json')
    build = read(VALIDATION / 'checks-run.json')
    assert tests['status'] == build['status'] == 'passed'
    formal = [item for item in tests['checks'] if item['name'] == 'delta-tests']
    assert len(formal) == 1 and formal[0]['tapSummaryComplete'] is True
    formal = formal[0]
    assert formal['exitCode'] == 0
    test_counts = formal['counts']
    assert test_counts['tests'] == test_counts['pass'] and test_counts['tests'] > 0
    assert all(test_counts[key] == 0 for key in ('fail', 'cancelled', 'skipped', 'todo'))
    assert len(tests['testFiles']) == len(set(tests['testFiles'])) == 71
    for value in [tests, build]:
        assert value['nativeSourceManifestDigest'] == NATIVE_DIGEST
        assert value['nativeSourceUnchanged'] is True
        for item in value['checks']:
            check_record(item['output'])
    assert tests['sourceAndTestInputsUnchanged'] is True
    assert len(build['checks']) == 5 and all(item['exitCode'] == 0 for item in build['checks'])
    counts = {'native': check(manifest['files']), 'frozenArchiveInputs': check(archive['files']),
              'sourceAndTests': check(tests['sourceAndTestInputs']),
              'buildInputs': check(build['buildInputs'])}

    scope = read(BASE / 'final/crossed-prefix-validation-scope.json')
    loop = read(BASE / 'final/crossed-prefix-common-loop.json.gz')
    assert scope['nativeDigest'] == loop['nativeSource']['digest'] == NATIVE_DIGEST
    assert isinstance(scope['gameContributionStatus'], str) and scope['gameContributionStatus']
    assert isinstance(scope['integratedEvidenceKind'], str) and scope['integratedEvidenceKind']
    assert scope['integratedEvidence']['path'] == (BASE / 'final/crossed-prefix-common-loop.json.gz').relative_to(ROOT).as_posix()
    check_embedded_records(scope)
    assert loop['status'] == 'passed' and loop['verifiedCheckGroups'] == len(loop['checks']) == 23
    assert loop['scope']['synthetic'] is True and loop['scope']['coldControllerSessions'] == 3
    assert loop['scope']['controlledReturnedCommands'] == loop['scope']['commonAcquiredTransitions'] == 17
    assert loop['scope']['ownControlledReturnedCommands'] == 10
    assert loop['scope']['priorCellPatchControlledReturns'] == 7
    for name in ['liveGameSessions', 'liveGameActions', 'liveGameLevelCompletions',
                 'liveGameVictories', 'sourcePythonAgentExecutions', 'learnedCheckpointsInjected']:
        assert loop['scope'][name] == 0, name
    assert loop['scope']['fullCallerParityClaimed'] is False
    assert loop['scope']['fullCallerAblationExecuted'] is False
    assert len(loop['componentAblations']) == 2
    assert {item['branch'] for item in loop['componentAblations']} == {'compatible_pair', 'no_effect_then_next'}
    for item in loop['componentAblations']:
        assert item['actionOrRefusalChanged'] is True
        assert item['scope'] == 'crossed_prefix_component_only'
        assert item['fullCallerCounterfactualExecuted'] is False
    assert loop['sourceUnchangedDuringRun'] and loop['executionInputsUnchangedDuringRun']
    assert loop['sourceDeclarationsModified'] is False
    for item in loop['executionInputs']:
        check_record(item)

    # WEAV's actual outcome is independent of the synthetic common-loop proof.
    # Its pre-existing case clock may be continued, never replaced by zero.
    weav = read(BASE / 'final/weav-resolution.json')
    prior_weav = read(PRIOR_WEAV)
    assert weav['game'] == prior_weav['game'] == 'WEAV'
    weav_status = final_status(weav, 'WEAV resolution')
    assert isinstance(weav.get('actual'), dict), 'WEAV actual result must remain explicit'
    clock = weav.get('caseClock', weav.get('clock'))
    assert isinstance(clock, dict), 'WEAV cumulative clock is required'
    prior = clock.get('previousCumulativeSeconds', clock.get('priorCumulativeSeconds'))
    interval = clock.get('currentIntervalSeconds', clock.get('continuedSeconds'))
    assert prior == prior_weav['secondsSinceSelection'] == 474.037204
    assert clock['maximumCumulativeSeconds'] == prior_weav['maximumBlockedSeconds'] == 2400
    assert clock.get('clockReset', False) is False
    assert isinstance(interval, (int, float)) and math.isfinite(interval) and interval >= 0
    assert math.isclose(clock['cumulativeSeconds'], prior + interval, rel_tol=0, abs_tol=1e-6)
    if 'remainingSeconds' in clock:
        assert math.isclose(clock['remainingSeconds'], max(0, 2400 - clock['cumulativeSeconds']), rel_tol=0, abs_tol=1e-6)
    check_embedded_records(weav)
    # Other case clocks are verified where the scope explicitly carries them;
    # the script does not invent either a clock or an absence of case work.
    for item in scope.get('retainedCaseClocks', []):
        if item.get('game') == 'WEAV':
            continue
        if 'source' in item and 'caseClock' in item:
            original_resolution = read(ROOT / item['source']['path'])
            assert item['caseClock'] == original_resolution.get('caseClock', original_resolution.get('clock'))

    regressions = read(BASE / 'final/regressions/regression-summary.json')
    assert regressions['status'] == 'passed' and regressions['passed'] == regressions['total'] == 4
    assert regressions['nativeSource']['digest'] == regressions['nativeSourceAfter']['digest'] == NATIVE_DIGEST
    assert regressions['executionInputsUnchanged'] is True
    assert regressions['comparisonChecksPassed'] == regressions['comparisonChecksExpected'] == 68
    assert {item['game'] for item in regressions['results']} == {'CATR', 'RSWP', 'FOGW', 'VOIS'}
    assert all(item['passed'] and item['comparisonPassed'] and item['comparisonChecks'] == 17 for item in regressions['results'])
    check_embedded_records(regressions)
    for item in regressions['results']:
        comparison = read(ROOT / item['comparison']['path'])
        assert comparison['passed'] is True and len(comparison['checks']) == 17
        assert comparison['before']['sourceDigest'] == BASELINE_DIGEST
        assert comparison['after']['sourceDigest'] == NATIVE_DIGEST
        assert comparison['before']['path'] == item['baseline']['path']
        assert comparison['after']['path'] == item['report']['path']
        assert item['nativeSourceBeforeDigest'] == item['nativeSourceAfterDigest'] == NATIVE_DIGEST
        assert item['nativeSourceUnchanged'] and item['immutableInputsUnchanged']
        assert item['final']['nativeImplementation'] == 'logos-engine.typescript.v6.native-migration/0.49.0'
    counts['regressionExecutionInputs'] = check(regressions['executionInputs'])
    browser = read(BASE / 'final/browser/browser-qa.json')
    browser_status = final_status(browser, 'Browser QA')
    assert browser_status not in ('failed', 'not_run')
    assert browser['nativeSourceDigest'] == NATIVE_DIGEST
    for item in browser['artifacts']:
        check_record(item)
    integrity = read(BASE / 'final/delivery-integrity.json')
    assert integrity['status'] == 'passed' and integrity['nativeSourceDigest'] == NATIVE_DIGEST
    assert integrity['matchedFileInventories']['native'] == counts['native']
    assert integrity['matchedFileInventories']['archive'] == counts['frozenArchiveInputs']
    assert integrity['matchedFileInventories']['sourceAndTests'] == counts['sourceAndTests']
    assert integrity['matchedFileInventories']['buildInputs'] == counts['buildInputs']
    assert integrity['matchedFileInventories']['regressionExecutionInputs'] == counts['regressionExecutionInputs']
    assert integrity['originalSourceFilesUnchanged'] == 1786
    for item in integrity['receipts']:
        check_record(item)

    window = read(BASE / 'performance/window.json')
    cost = read(BASE / 'performance/global-budget-decision.json')
    policy = read(BASE / 'performance/global-budget-policy.json')
    consolidation = read(BASE / 'performance/consolidation-review.json')
    assert window['status'] == window['finalIntegrity'] == consolidation['status'] == 'passed'
    assert consolidation['checkedCount'] == len(consolidation['checks']) == 231
    assert all(item['passed'] is True for item in consolidation['checks'])
    assert cost['totalCases'] == len(cost['globalCases']) == 2
    assert {item['case'] for item in cost['globalCases']} == {'STCK', 'SMLP'}
    for item in cost['globalCases']:
        assert item['sessionsPerVersion'] == 8 and item['beforeMedianMs'] > 0
        ratio = item['afterMedianMs'] / item['beforeMedianMs'] - 1
        assert math.isclose(item['medianRelativeIncrease'], ratio, rel_tol=0, abs_tol=1e-12)
        assert item['accepted'] == (ratio < 0.1)
    assert cost['acceptedCases'] == sum(item['accepted'] is True for item in cost['globalCases'])
    assert cost['accepted'] == (cost['acceptedCases'] == cost['totalCases'])
    assert cost['measuredSessions'] == 32 and cost['measuredActions'] == 400
    assert policy['globalStage'] == 'session_elapsed' and policy['relativeIncreaseLimit'] == 0.1
    assert policy['comparison'] == 'strictly_less_than' and policy['allCasesMustPass'] is True
    assert policy['crossCaseCompensation'] is False and policy['phaseOverrunsMayBeAccepted'] is True
    assert policy['baseline']['commit'] == BASELINE_COMMIT and policy['baseline']['siteVersion'] == 76
    assert policy['candidate']['nativeDigest'] == NATIVE_DIGEST
    readiness = read(BASE / 'performance/readiness.json')
    assert readiness['measurementAuthorized'] and not readiness['pendingRequirements']
    for item in [*readiness['inputs'], *consolidation['inputs'], *cost['inputs']]:
        check_record(item)
    optional_review = BASE / 'diagnostic/cost-result-review.json'
    optional_review_record = None
    if optional_review.is_file():
        independent = read(optional_review)
        assert independent['status'] == 'passed'
        assert independent['checkedCount'] == len(independent['checks']) and independent['checkedCount'] > 0
        assert all(item['passed'] is True for item in independent['checks'])
        assert not independent.get('unsatisfied', [])
        if 'inputReceiptsUnchanged' in independent:
            assert independent['inputReceiptsUnchanged'] is True
        for item in independent['inputs']:
            check_record(item)
        optional_review_record = record(optional_review)
    results = (BASE / 'performance/results.md').read_text()
    report = (BASE.parent / 'lot3h-crossed-prefix.md').read_text()
    assert 'En attente' not in results
    for placeholder in ['Aucun résultat de coût n’est anticipé.', 'FINAL_COST', 'LOT3H_COST_RESULT']:
        assert placeholder not in report
    entries = read(BASE.parent / 'v6-entry-point-progress.json')
    assert entries['connected'] == 53 and entries['declared'] == 76 and entries['partiallyConnected'] == 0
    assert entries['fullV6Parity'] is False

    inputs = [BASE / name for name in [
        'baseline/provenance.json', 'final/source-manifest.json', 'final/source-archive.json',
        'final/validation/delta-tests-run.json', 'final/validation/checks-run.json',
        'final/regressions/regression-summary.json', 'final/browser/browser-qa.json',
        'final/crossed-prefix-common-loop.json.gz', 'final/crossed-prefix-validation-scope.json',
        'final/weav-resolution.json', 'final/delivery-integrity.json',
        'performance/readiness.json', 'performance/window.json', 'performance/global-budget-policy.json',
        'performance/global-budget-decision.json', 'performance/consolidation-review.json',
        'performance/results.md', 'README.md',
    ]]
    inputs += [BASE.parent / name for name in ['lot3h-crossed-prefix.md', 'lot3h-crossed-prefix-lineage.md',
                                             'v6-delivery-roadmap.md', 'v6-native-transfer.md', 'v6-entry-point-progress.json']]
    inputs.append(PRIOR_WEAV)
    if optional_review_record is not None:
        inputs.append(optional_review)
    value = {
        'schema': 'logos-engine.lot3h.publication-inputs.v1', 'status': 'passed',
        'recordedAt': datetime.now(LOCAL).isoformat(), 'displayTimeZone': 'UTC-03:00',
        'generator': record(Path(__file__)), 'nativeVersion': '0.49.0', 'nativeDigest': NATIVE_DIGEST,
        'baselineSiteVersion': 76, 'baselineNativeVersion': '0.48.0', 'baselineCommit': BASELINE_COMMIT,
        'checkedInventories': counts, 'globalCostAccepted': cost['accepted'], 'globalCostStatus': cost['status'],
        'finalFormalTestCounts': test_counts, 'formalTestFiles': len(tests['testFiles']),
        'formalValidationDirectory': VALIDATION.relative_to(ROOT).as_posix(),
        'gameContributionStatus': scope['gameContributionStatus'],
        'integratedEvidenceKind': scope['integratedEvidenceKind'], 'integratedCheckGroups': loop['verifiedCheckGroups'],
        'syntheticCommonScope': loop['scope'], 'weavResolutionStatus': weav_status,
        'weavActual': weav['actual'], 'weavCaseClock': clock, 'browserStatus': browser_status,
        'optionalIndependentCostReview': optional_review_record,
        'inputs': [record(path) for path in inputs],
        'qualification': 'Final retained-input verification after completed functional, case, browser and timing work. '
            'No test, build, game, oracle or cost result is regenerated. Test counts and WEAV outcomes are read from '
            'their actual receipts. The three-session 23-group common-loop proof has 17 controlled synthetic returns '
            'and zero live game actions; its two ablations are component-scoped. Any actual WEAV contribution remains '
            'a separate result with its pre-existing cumulative clock preserved. This integrity receipt does not '
            'turn an unmet game target or a rejected cost budget into an acceptance. Source inheritance and full '
            'original-caller parity remain qualified independently. Historical failures remain retained in the evidence index.'
    }
    with output.open('x') as stream:
        stream.write(json.dumps(value, indent=2) + '\n')
    print(json.dumps({'status': value['status'], 'checkedInventories': counts, 'formalTests': test_counts,
                      'globalCostAccepted': cost['accepted'], 'gameContributionStatus': scope['gameContributionStatus'],
                      'weavResolutionStatus': weav_status, 'optionalIndependentCostReviewPresent': optional_review_record is not None}))


if __name__ == '__main__':
    main()
