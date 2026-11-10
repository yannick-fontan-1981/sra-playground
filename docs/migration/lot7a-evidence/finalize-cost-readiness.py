#!/usr/bin/env python3
"""Bind completed integrated 7A evidence before the first official cost sample.

This verifies retained receipts and file fingerprints; it does not run a test,
game, replay, build or measurement. Paths are repository-relative (absolute
paths inside the checkout are also accepted). The declaration supplies the
baseline and candidate identities. A qualified LKEY reserve is permitted.
The exclusive output is PERFORMANCE_DIRECTORY/readiness.json.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot7a-evidence'
REFERENCE = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
TEST_RUNNER = ROOT / 'scripts/verify-native-delta.py'
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def local(value):
    path = (ROOT / value).resolve()
    require(path.is_relative_to(ROOT), 'Input escapes the checkout: ' + str(value))
    return path


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def fp(path):
    path = local(path)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path),
            'bytes': path.stat().st_size}


def read(path):
    path = local(path)
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timestamp lacks a timezone')
    return result


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--performance-directory', type=Path,
                        default=BASE / 'performance-integrated')
    parser.add_argument('--candidate-source-directory', type=Path,
                        default=BASE / 'integrated-final')
    parser.add_argument('--parity-receipt', type=Path, required=True,
                        help='Completed original-Python workshop parity receipt for this freeze.')
    parser.add_argument('--browser-receipt', type=Path, required=True,
                        help='Completed browser-qa.v1 receipt for this freeze.')
    parser.add_argument('--case-checkpoint', type=Path,
                        default=BASE / 'lkey-case-checkpoint.json')
    parser.add_argument('--audit-receipt', type=Path,
                        help='Optional passed migration-audit resolution; otherwise use the official check log.')
    args = parser.parse_args()
    perf, candidate_dir = local(args.performance_directory), local(args.candidate_source_directory)
    require(perf.is_relative_to(BASE) and candidate_dir.is_relative_to(BASE),
            '7A readiness and candidate evidence must stay inside lot7a-evidence')
    output = perf / 'readiness.json'
    require(not output.exists() and not (perf / 'window.json').exists(),
            'Readiness or an official window already exists; refusing overwrite')
    require(not (perf / 'superseded-before-measurement.json').exists(),
            'A superseded protocol cannot authorize measurement')
    inputs = {}

    def keep(path):
        record = fp(path)
        prior = inputs.setdefault(record['path'], record)
        require(prior == record, 'Input changed during readiness: ' + record['path'])
        return record

    def load(path):
        keep(path)
        return read(path)

    def checked(record, exact=True):
        require(isinstance(record, dict) and 'path' in record and 'sha256' in record,
                'Missing file fingerprint')
        path = local(record['path'])
        actual = keep(path)
        require(actual == record if exact else actual['sha256'] == record['sha256']
                and ('bytes' not in record or actual['bytes'] == record['bytes']),
                'File fingerprint differs: ' + record['path'])
        return path

    declaration = load(perf / 'declaration.json')
    policy = load(perf / 'global-budget-policy.json')
    preparation = load(perf / 'preparation.json')
    protocol = load(perf / 'protocol-check.json')
    require(declaration['status'] == 'declared_before_official_window'
            and declaration['noOfficialWindowAtDeclaration'] is True,
            'Protocol was not finalized before measurement')
    for key in ('protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy',
                'baselineManifest', 'candidateManifest', 'candidateArchiveManifest',
                'globalDecisionTool', 'globalCalculationTool'):
        checked(declaration[key])
    for record in declaration['officialTools']:
        checked(record)
    require(local(declaration['candidateManifest']['path']) == candidate_dir / 'source-manifest.json'
            and local(declaration['candidateArchiveManifest']['path']) == candidate_dir / 'source-archive.json',
            'Candidate directory differs from the finalized declaration')
    candidate = load(candidate_dir / 'source-manifest.json')
    baseline = load(declaration['baselineManifest']['path'])
    archive = load(candidate_dir / 'source-archive.json')
    keep(candidate_dir / 'source-archive-parts.json')
    digest = candidate['digest']
    for role, manifest in (('baseline', baseline), ('candidate', candidate)):
        files = dict(sorted(manifest['files'].items()))
        require(manifest['fileCount'] == len(files) > 0
                and hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest() == manifest['digest'],
                'Invalid frozen manifest: ' + role)
        require(declaration['nativeDigests'][role] == policy[role]['nativeDigest'] == manifest['digest']
                and policy[role]['nativeFiles'] == manifest['fileCount']
                and declaration[role] == policy[role] == preparation[role],
                'Declared source identities differ: ' + role)
    require(type(policy['baseline']['siteVersion']) is int and policy['baseline']['siteVersion'] > 0
            and re.fullmatch(r'[0-9a-f]{40}', policy['baseline']['commit']),
            'Published baseline identity is incomplete')
    require(archive['nativeSourceManifestDigest'] == digest
            and archive['baseCommit'] == policy['candidate']['sourceBaseCommit']
            and all(archive['files'].get(name) == value for name, value in candidate['files'].items()),
            'Candidate archive does not contain the declared native freeze')
    checked(archive['archive'])
    actual_files = dict(sorted((path.relative_to(ROOT).as_posix(), sha(path))
        for folder in ('src/logos-engine', 'src/runtime') for path in (ROOT / folder).rglob('*')
        if path.is_file() and path.suffix in ('.ts', '.json', '.drm')))
    require(actual_files == candidate['files'], 'Current native source differs from the final freeze')
    require(protocol['status'] == 'protocol_contract_passed'
            and protocol['nativeDigests'] == declaration['nativeDigests'],
            'Protocol check does not bind these source identities')

    tests = load(candidate_dir / 'validation/delta-tests-run.json')
    checks = load(candidate_dir / 'validation/checks-run.json')
    for value in (tests, checks):
        require(value['schema'] == 'logos-engine.native-delta-verification.v1'
                and value['status'] == 'passed' and value['generator'] == fp(TEST_RUNNER)
                and value['nativeSourceManifestDigest'] == digest and value['nativeSource'] == candidate
                and value['nativeSourceUnchanged'] is True,
                'Official native-delta verification is missing or names another source')
        checked(value['generator'])
        for row in value['checks']:
            require(row['exitCode'] == 0, 'A retained release check failed')
            checked(row['output'])
    require(len(tests['checks']) == 1 and tests['checks'][0]['name'] == 'delta-tests'
            and tests['sourceAndTestInputsUnchanged'] is True
            and tests['checks'][0]['tapSummaryComplete'] is True, 'Formal test receipt is incomplete')
    test_files, counts = tests['testFiles'], tests['checks'][0]['counts']
    require(test_files and len(test_files) == len(set(test_files))
            and {'tests/v6-ranked-workshop-reference.test.ts', 'tests/v6-ranked-workshop-kernel.test.ts'} <= set(test_files),
            'Formal scope omits workshop contracts or contains duplicate files')
    require(set(counts) == set(COUNT_KEYS) and all(type(counts[key]) is int for key in COUNT_KEYS)
            and counts['tests'] == counts['pass'] > 0
            and all(counts[key] == 0 for key in COUNT_KEYS[2:]), 'Formal tests did not all pass')
    tap = gzip.decompress(local(tests['checks'][0]['output']['path']).read_bytes()).decode()
    require(all(re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M) == [str(counts[key])]
                for key in COUNT_KEYS), 'Formal counts differ from their retained TAP output')
    expected_checks = ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
    require([row['name'] for row in checks['checks']] == expected_checks,
            'Exactly the five official release checks are required')
    checked(checks['nativeAgentWorker'])
    if args.audit_receipt is not None:
        audit_receipt = load(args.audit_receipt)
        require(audit_receipt['status'] == 'passed' and audit_receipt['exitCode'] == 0
                and audit_receipt['nativeSourceDigest'] == digest,
                'Migration-audit resolution is not passed for this source')
        checked(audit_receipt['output'])
        audit = audit_receipt['audit']
        require(read(audit_receipt['output']['path']) == audit, 'Resolved audit differs from its log')
    else:
        audit = read(checks['checks'][2]['output']['path'])
    require(audit['failures'] == [], 'Migration audit retains unresolved failures')

    regression = load(candidate_dir / 'regressions/regression-summary.json')
    require(regression['status'] == 'passed' and regression['nativeSource'] == candidate
            and regression['nativeSourceAfter'] == candidate and regression['executionInputsUnchanged'] is True
            and regression['passed'] == regression['total'] == len(regression['results']) > 0
            and regression['comparisonChecksPassed'] == regression['comparisonChecksExpected'] > 0,
            'Strict recorded regressions are incomplete or use another freeze')
    checked(regression['caseManifest'])
    comparison_count = 0
    for row in regression['results']:
        require(row['status'] == 'passed' and row['passed'] is True and row['exitCode'] == 0
                and row['timedOut'] is False and row['comparisonPassed'] is True and row['failedChecks'] == []
                and row['nativeSourceBeforeDigest'] == row['nativeSourceAfterDigest'] == digest
                and row['nativeSourceUnchanged'] is True and row['immutableInputsUnchanged'] is True,
                'A strict regression or its immutable inputs failed')
        for key in ('baseline', 'trace', 'output', 'report', 'comparison', 'execution', 'passiveOwnerPresence'):
            checked(row[key])
        comparison = read(row['comparison']['path'])
        require(comparison['passed'] is True and len(comparison['checks']) == row['comparisonChecks'] > 0
                and all(item['passed'] is True for item in comparison['checks']),
                'A retained strict comparison is incomplete')
        comparison_count += row['comparisonChecks']
    require(comparison_count == regression['comparisonChecksExpected'], 'Regression count does not equal its rows')

    integrity = load(candidate_dir / 'delivery-integrity.json')
    require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1'
            and integrity['status'] == 'passed' and integrity['nativeSourceDigest'] == digest
            and integrity['tests'] == counts and integrity['originalSourceFilesUnchanged'] > 0
            and integrity['sourceArchiveVerification']['byteIdentical'] is True,
            'Delivery integrity is not passed for the final source and tests')
    integrity_paths = {record['path'] for record in integrity['receipts']}
    for required in ('source-manifest.json', 'source-archive.json', 'source-archive-parts.json',
                     'validation/delta-tests-run.json', 'validation/checks-run.json',
                     'regressions/regression-summary.json'):
        require((candidate_dir / required).relative_to(ROOT).as_posix() in integrity_paths,
                'Integrity receipt omits required evidence: ' + required)
    for record in [integrity['generator'], *integrity['verificationHelpers'], *integrity['receipts']]:
        checked(record)
    require(integrity['nativeAgentWorker'] == checks['nativeAgentWorker'], 'Integrity and build name different workers')

    parity = load(args.parity_receipt)
    require(parity['schema'] == 'logos-engine.v6.ranked-workshop-public-parity.v1'
            and parity['referenceCommit'] == REFERENCE and parity['sourceModified'] is False
            and parity['sourceFilesVerifiedBeforeAndAfter'] == integrity['originalSourceFilesUnchanged']
            and parity['initialOwner'] == 'fresh RankedWorkshop()' and parity['nativeSourceStatesInjected'] == 0
            and parity['failedCalls'] == 0 and parity['matchedCalls'] == parity['callCount'] == len(parity['calls']) > 0
            and parity['exactChecks'] == parity['totalChecks'] == 3 * parity['callCount']
            and parity['selectedWorkshopCount'] > 0,
            'Cold original-Python workshop parity is incomplete')
    require(all(row['matched'] is True and row['differences'] == {}
                and set(row['checks']) == {'beforeState', 'returnValue', 'afterState'}
                and all(value is True for value in row['checks'].values()) for row in parity['calls']),
            'A captured source call is not exactly matched')
    campaign_record = parity['campaign']
    campaign = read(checked(campaign_record, exact=False))
    require(campaign_record['sourceDigest'] == digest and campaign_record['sourceUnchangedDuringRun'] is True
            and campaign['source'] == candidate and campaign['sourceUnchangedDuringRun'] is True
            and campaign['game'] == campaign_record['game'] == 'LKEY'
            and campaign['targetLevels'] == 3 and campaign['referenceCommit'] == REFERENCE
            and campaign['final']['actions'] == campaign_record['actions'] > 0
            and campaign['final']['levelsCompleted'] == campaign_record['levelsCompleted']
            and campaign['final']['reason'] == campaign_record['reason']
            and campaign['status'] == campaign_record['status'], 'Source parity is not bound to the final actual campaign')
    contribution = read(checked(parity['contributionReceipt']))
    unique = contribution['feedbackUniqueness']
    require(contribution['campaign'] == campaign_record
            and contribution['selectedWorkshopCount'] == parity['selectedWorkshopCount']
            and unique['duplicates'] == []
            and unique['recordCalls'] == unique['distinctObservedTransitions'] == unique['physicalActions']
            == campaign_record['actions'], 'Integrated acquisition is not attributed exactly once per actual action')

    browser = load(args.browser_receipt)
    require(browser['schema'] == 'logos-engine.browser-qa.v1' and browser['nativeDigest'] == digest
            and browser['nativeVersion'] == policy['candidate']['nativeVersion'] and browser['game'] == 'LKEY'
            and browser['startLevel'] == 1 and browser['learnedStateInjected'] is False
            and browser['targetLevels'] == 3
            and browser['targetMet'] is (browser['final']['levels'] >= browser['targetLevels']),
            'Browser receipt does not describe the final cold candidate and actual outcome')
    require(browser['pause']['observed'] == 'Paused.'
            and browser['oneAction']['observed'] == 'One action completed.'
            and browser['oneAction']['actions'] == browser['pause']['actions'] + 1
            and browser['final']['actions'] >= browser['oneAction']['actions'] > 0
            and type(browser['final']['levels']) is int and browser['final']['levels'] >= 0
            and browser['artifacts'], 'Browser Pause, single-step or retained final evidence is incomplete')
    for record in browser['artifacts']:
        checked(record, exact=False)

    case = load(args.case_checkpoint)
    require(case['schema'] == 'logos-engine.cumulative-game-case-checkpoint.v1' and case['game'] == 'LKEY'
            and case['targetLevels'] == 3 and case['maximumCumulativeSeconds'] == 2400
            and case.get('clockReset', False) is False
            and finite(case['cumulativeSeconds']) and 0 <= case['cumulativeSeconds'] <= 2400
            and finite(case['remainingSeconds'])
            and abs(case['remainingSeconds'] + case['cumulativeSeconds'] - 2400) < 0.001,
            'LKEY cumulative clock is missing, reset, invalid or over its cap')
    intervals = case['chargedIntervals']
    require(all(row['status'] == 'closed' and finite(row['elapsedSeconds']) and row['elapsedSeconds'] >= 0
                and abs((instant(row['endedAt']) - instant(row['startedAt'])).total_seconds()
                        - row['elapsedSeconds']) < 0.01 for row in intervals),
            'A charged LKEY interval remains open or differs from its timestamps')
    ledger_total = case['priorCumulativeSeconds'] + case['currentChargedIntervalSeconds'] + sum(
        row['elapsedSeconds'] for row in intervals)
    require(abs(ledger_total - case['cumulativeSeconds']) < 0.001
            and ('paused' in case['casePhase'] or 'complete' in case['casePhase'])
            and case['actualLevels'] >= max(campaign_record['levelsCompleted'], browser['final']['levels'])
            and browser['cumulativeGameCaseSeconds'] <= case['cumulativeSeconds'] + 0.001,
            'Final LKEY evidence is not covered by the paused cumulative ledger')
    game_target_met = campaign_record['levelsCompleted'] >= case['targetLevels']
    require(game_target_met or bool(case.get('limitation')) and bool(browser.get('qualification')),
            'An unmet game target must retain its explicit qualification')

    static = load(perf / 'static-preflight.json')
    require(static['status'] == 'static_inputs_checked' and static['measurementExecuted'] is False
            and static['checkedCount'] == len(static['checks']) > 0 and static['unsatisfied'] == []
            and all(row['satisfied'] is True for row in static['checks'])
            and static['declaration'] == fp(perf / 'declaration.json')
            and static['candidateFreeze'] == declaration['candidateManifest']
            and static['protocolCheck'] == fp(perf / 'protocol-check.json'),
            'Static preflight is incomplete or differs from the finalized inputs')
    for key in ('generator', 'adaptedFrom', 'preparationTool'):
        checked(static[key])
    isolation = load(perf / 'coordinated-isolation.json')
    require(isolation['status'] == 'acknowledged_quiet_before_window'
            and isolation['otherLaneAcknowledged'] is True and isolation['ownTrackedComputeEnded'] is True
            and isolation['previewStopped'] is True and isolation['costNodeOptionsOverride'] is None,
            'Explicit cooperative isolation is not acknowledged')
    finalized = datetime.now(timezone.utc)
    require(instant(declaration['finalizedAt']) <= instant(static['recordedAt']) <= finalized
            and all(instant(row['finishedAt']) <= finalized for value in (tests, checks) for row in value['checks']),
            'Completed evidence must precede readiness')
    keep(Path(__file__))
    for record in list(inputs.values()):
        require(fp(local(record['path'])) == record, 'Input changed before finalization: ' + record['path'])
    require(not output.exists() and not (perf / 'window.json').exists(), 'Window started during readiness validation')
    value = {'schema': 'logos-engine.native-cost-window-readiness.v1', 'status': 'ready',
        'finalizedAt': finalized.isoformat(), 'measurementAuthorized': True, 'pendingRequirements': [],
        'generator': fp(Path(__file__)), 'nativeVersion': policy['candidate']['nativeVersion'],
        'nativeSourceDigest': digest, 'baseline': policy['baseline'], 'candidate': policy['candidate'],
        'formalTests': counts, 'formalTestFiles': len(test_files), 'regressionChecks': comparison_count,
        'sourceParityCalls': parity['callCount'], 'sourceParityChecks': parity['totalChecks'],
        'game': {'id': 'LKEY', 'targetLevels': 3, 'campaignLevels': campaign_record['levelsCompleted'],
                 'browserLevels': browser['final']['levels'], 'targetMet': game_target_met,
                 'qualification': case.get('limitation'), 'cumulativeSeconds': case['cumulativeSeconds'],
                 'remainingSeconds': case['remainingSeconds'], 'clockReset': False},
        'inputs': list(inputs.values()), 'isolation': isolation,
        'qualification': 'Completed official delta tests, five checks, empty audit failures, strict regressions, '
            'delivery integrity, cold original-Python parity, actual browser evidence and the cumulative game '
            'clock precede this cost window. An explicitly qualified unmet three-level game target is retained '
            'and does not become a success claim. Cooperative lane acknowledgement and ended tracked work '
            'establish the declared quiet interval; process visibility alone does not establish isolation.'}
    with output.open('x') as stream:
        stream.write(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'status': 'ready', 'receipt': fp(output), 'gameTargetMet': game_target_met}))


if __name__ == '__main__':
    main()
