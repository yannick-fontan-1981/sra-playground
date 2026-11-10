#!/usr/bin/env python3
# Adapted before measurement from lot7a-evidence/finalize-cost-readiness.py; source SHA-256 5ffa9f9a720f3977ac3a07696fe61140517ee3e41c6962c800c9e38ae39dd7ec.
"""Bind completed integrated 4B evidence before the first official cost sample.

This verifies retained receipts and file fingerprints; it does not run a test,
game, replay, build or measurement. Paths are repository-relative (absolute
paths inside the checkout are also accepted). The declaration supplies the
baseline and candidate identities. A recorded final-release replay is identified
separately from its earlier live session. Explicit browser infrastructure
failure with zero actions is retained as a limitation, never a passing test.
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
BASE = ROOT / 'docs/migration/lot4b-evidence'
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
    parser.add_argument('--validation-directory', type=Path, default=Path('validation'),
                        help='Completed official test/build receipts inside the candidate evidence directory.')
    parser.add_argument('--parity-receipt', type=Path, required=True,
                        help='Completed compare-relative-arrangement-public-parity.py receipt for the final frozen replay.')
    parser.add_argument('--browser-receipt', type=Path, required=True,
                        help='Completed browser-qa.v1 receipt for this freeze.')
    parser.add_argument('--game', required=True, help='Actual selected game case, for example TRIA; never a cost-sample identity.')
    parser.add_argument('--case-resolution', '--case-checkpoint', dest='case_checkpoint', type=Path, required=True,
                        help='Retained original cumulative case resolution; never a reset clock.')
    parser.add_argument('--audit-receipt', type=Path,
                        help='Optional passed migration-audit resolution; otherwise use the official check log.')
    parser.add_argument('--partial-regression-receipt', type=Path,
                        help='Optional declared partial trajectory preservation; its raw failed status is retained outside strict regression totals.')
    args = parser.parse_args()
    perf, candidate_dir = local(args.performance_directory), local(args.candidate_source_directory)
    require(perf.is_relative_to(BASE) and candidate_dir.is_relative_to(BASE),
            '4B readiness and candidate evidence must stay inside lot4b-evidence')
    validation_dir = (candidate_dir / args.validation_directory).resolve()
    require(validation_dir.is_relative_to(candidate_dir), 'Validation receipts escape the candidate directory')
    output = perf / 'readiness.json'
    require(not output.exists() and not (perf / 'window.json').exists(),
            'Readiness or an official window already exists; refusing overwrite')
    require(not (perf / 'superseded-before-measurement.json').exists(),
            'A superseded protocol cannot authorize measurement')
    inputs, external_inputs = {}, {}

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

    tests = load(validation_dir / 'delta-tests-run.json')
    checks = load(validation_dir / 'checks-run.json')
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
            and {'tests/v6-relative-arrangements-reference.test.ts', 'tests/v6-relative-arrangements-integration.test.ts'} <= set(test_files),
            'Formal scope omits RelativeArrangements contracts or contains duplicate files')
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

    partial_summary = None
    if args.partial_regression_receipt is not None:
        partial = load(args.partial_regression_receipt)
        require(partial['schema'] == 'logos-engine.partial-public-regression-qualification.v1'
                and partial['status'] == 'partial_trajectory_preserved'
                and partial['historicalStatus'] == partial['rawCampaignStatus'] == 'failed'
                and partial['historicalExitCode'] == 1 and partial['gameTargetCompleted'] is False
                and partial['liveGameExecuted'] is False and partial['error'] is None
                and partial['nativeSource'] == partial['nativeSourceAfter'] == candidate
                and partial['inputs'] == partial['executionInputsAfter'],
                'A partial trajectory must remain qualified preservation of an unresolved raw failure')
        require(partial['inputs']['runner'] == fp(ROOT / 'scripts/replay-native-partial-public-regression.mjs'),
                'Partial qualification must use the reviewed runner unchanged')
        for record in partial['inputs'].values():
            checked(record)
        for key in ('report', 'trace', 'rawPublicJournal', 'publicJournal', 'progress'):
            checked(partial[key])
        partial_contract = read(checked(partial['inputs']['contract']))
        expected = partial['expectedPartialOutcome']
        require(partial_contract['schema'] == 'logos-engine.partial-public-regression-contract.v1'
                and partial_contract['status'] == 'declared'
                and partial_contract['expected'] == expected
                and partial_contract['comparisonScope'] == partial['comparisonScope']
                and instant(partial_contract['declaredAt']) <= instant(partial['startedAt'])
                <= instant(partial['finishedAt']), 'Partial contract differs or was not declared before replay')
        scope = partial['comparisonScope']
        require(scope['targetCompletionClaim'] is False and scope['speedComparisonClaim'] is False
                and scope['originalCallerParityClaim'] is False
                and scope['actionNormalization'] == scope['publicPacketNormalization'] == 'none'
                and scope['excluded'] and partial['qualification'], 'Partial preservation must retain its exact limits')
        require(expected['status'] == expected['traceStatus'] == 'failed'
                and expected['baselineExitCode'] == 1 and expected['final']['reason'] == 'frontier_unknown'
                and partial['rawCampaignFailure'] == expected['failure']
                and partial['commandsCheckedBeforeReturn'] == expected['actions']
                and partial['publicPacketsObserved'] == expected['completePublicPackets'] == expected['actions'] + 1
                and partial['acquiredPrefixesObserved'] == expected['prefixes']
                and partial['naturalBoundariesObserved'] == len(expected['boundaryActionCounts'])
                and 0 < partial['actualFinal']['levelsCompleted'] == expected['final']['levelsCompleted'] < partial['targetLevels'],
                'Complete partial trajectory counters or its unresolved frontier differ')
        required_partial_checks = {'raw status remains failed', 'every full public return consumed',
            'one command checked before each archived return', 'native freeze unchanged before and after',
            'every execution/evidence input unchanged before and after'}
        require(partial['checks'] and all(row['passed'] is True for row in partial['checks'])
                and required_partial_checks <= {row['name'] for row in partial['checks']},
                'Partial trajectory checks are incomplete')
        partial_summary = {'receipt': fp(local(args.partial_regression_receipt)), 'status': partial['status'],
            'game': partial['game'], 'rawCampaignStatus': 'failed', 'targetCompleted': False,
            'actions': expected['actions'], 'publicPackets': expected['completePublicPackets'],
            'boundaries': len(expected['boundaryActionCounts']), 'reason': 'frontier_unknown',
            'includedInStrictRegressionTotals': False, 'qualification': partial['qualification']}

    integrity = load(candidate_dir / 'delivery-integrity.json')
    require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1'
            and integrity['status'] == 'passed' and integrity['nativeSourceDigest'] == digest
            and integrity['tests'] == counts and integrity['originalSourceFilesUnchanged'] > 0
            and integrity['sourceArchiveVerification']['byteIdentical'] is True,
            'Delivery integrity is not passed for the final source and tests')
    integrity_paths = {record['path'] for record in integrity['receipts']}
    for required in [candidate_dir / name for name in ('source-manifest.json', 'source-archive.json',
                     'source-archive-parts.json', 'regressions/regression-summary.json')] + [
                     validation_dir / 'delta-tests-run.json', validation_dir / 'checks-run.json']:
        require(required.relative_to(ROOT).as_posix() in integrity_paths,
                'Integrity receipt omits required evidence: ' + str(required))
    for record in [integrity['generator'], *integrity['verificationHelpers'], *integrity['receipts']]:
        checked(record)
    require(integrity['nativeAgentWorker'] == checks['nativeAgentWorker'], 'Integrity and build name different workers')

    parity = load(args.parity_receipt)
    replay = parity['replay']
    require(parity['schema'] == 'logos-engine.relative-arrangement-public-source-parity.v1'
            and parity['status'] == 'passed' and parity['sourceCommit'] == REFERENCE
            and parity['inputsUnchanged'] is True and parity['inputs'] == parity['inputsAfter']
            and parity['originalsUnchanged'] is True and parity['sourceBefore'] == parity['sourceAfter']
            and parity['sourceBefore']['commit'] == REFERENCE
            and parity['sourceBefore']['filesVerified'] == integrity['originalSourceFilesUnchanged'] == 1786,
            'Cold original-source parity does not preserve all 1786 pinned files and its actual inputs')
    for record in parity['inputs'].values():
        checked(record)
    require(parity['inputs']['generator'] == fp(ROOT / 'scripts/compare-relative-arrangement-public-parity.py'),
            'Parity must come from the actual unchanged RelativeArrangements source comparator')
    checked(parity['sourceBefore']['manifest'])
    require(replay['componentParityPassed'] is True and replay['coldStart'] is True
            and replay['nativeStatesUsedToPrimeSource'] is False and replay['nativePlansUsedToAcquireSource'] is False
            and replay['stop'] is None and replay['differences'] == [] and replay['capturedNativeFailures'] == []
            and replay['callsCompared'] == replay['callsExpected'] == len(replay['callChecks']) > 0
            and replay['prefixesCompared'] == replay['prefixesExpected'] == len(replay['prefixChecks']) > 0
            and replay['allSelectedRecordsGuarded'] is True and replay['passiveRecords'] == 0,
            'Original component comparison, cold state, guarded selected acquisition or complete prefixes failed')
    call_checks = {row['index']: row for row in replay['callChecks']}
    require(len(call_checks) == replay['callsCompared']
            and all(row['beforeDifferences'] == row['resultDifferences'] == row['afterDifferences'] == 0
                    for row in call_checks.values())
            and all('error' not in row and row['stateDifferences'] == row['proposalDifferences'] == 0
                    for row in replay['prefixChecks']),
            'Actual complete parsed source/native results or owner checkpoints differ')
    source_counts = replay['counts']
    records = replay['sourceRecordCalls']
    record_ids = [row['index'] for row in records]
    require(source_counts['propose'] > 0 and source_counts['before'] > 0 and source_counts['after'] > 0
            and source_counts['record'] == source_counts['selectedRecords'] == len(records) > 0
            and len(set(record_ids)) == len(record_ids)
            and replay['guardsCompared'] == source_counts['before'] + source_counts['after']
            and all(call_checks[index]['method'] == 'record' for index in record_ids),
            'Selected records and actual guard calls have inconsistent counts')
    coverage = replay['guardCoverage']
    require(len(coverage) == len(records) and {row['recordCallIndex'] for row in coverage} == set(record_ids)
            and all(row['passed'] is True and row['beforeGuardCallIndices'] and row['afterGuardCallIndices']
                    and all(index in call_checks and call_checks[index]['method'] == 'before' for index in row['beforeGuardCallIndices'])
                    and all(index in call_checks and call_checks[index]['method'] == 'after' for index in row['afterGuardCallIndices'])
                    for row in coverage), 'Every selected source record must retain its actual before and after guards')
    ablations = replay['ablationCounts']
    require(ablations['errors'] == 0 and ablations['executed'] == ablations['total']
            == ablations['expected'] == len(replay['ablations']),
            'All predeclared source-memory ablations must remain visible, including unchanged decisions')
    campaign_record = parity['inputs']['campaign']
    campaign = read(checked(campaign_record))
    campaign_final = campaign['final']
    require(parity['nativeSource'] == campaign['source'] == candidate
            and campaign['sourceUnchangedDuringRun'] is True
            and parity['game'] == campaign['game'] == args.game
            and parity['campaignStatus'] == campaign['status'] == 'passed'
            and parity['campaignFinal'] == campaign_final
            and campaign['targetLevels'] == 3 and campaign['referenceCommit'] == REFERENCE
            and campaign_final['actions'] > 0 and campaign_final['levelsCompleted'] >= 3
            and replay['prefixesExpected'] == len(campaign['prefixes']),
            'The complete frozen final-release public replay must bind the exact source parity and actual outcome')

    browser = load(args.browser_receipt)
    require(browser['schema'] in ('logos-engine.relative-arrangement-browser-qa.v1', 'logos-engine.browser-qa.v1')
            and browser.get('nativeSourceDigest', browser.get('nativeDigest')) == digest
            and browser['nativeVersion'] == policy['candidate']['nativeVersion'],
            'Browser evidence must name the actual final frozen candidate')
    browser_blocked = browser['status'] == 'blocked_infrastructure'
    if browser_blocked:
        require(browser['browserGameActions'] == 0 and browser['verifiedFunctionalChecks'] == []
                and bool(browser['qualification']) and browser.get('attempts')
                and browser['sourceManifest'] == fp(candidate_dir / 'source-manifest.json')
                and browser['buildReceipt'] == fp(validation_dir / 'checks-run.json'),
                'An infrastructure block must retain actual attempts, zero actions and no invented passing check')
        checked(browser['sourceManifest']); checked(browser['buildReceipt'])
        browser_levels = None
    else:
        require(browser['status'] == 'passed' and browser['game'] == args.game
                and browser['startLevel'] == 1 and browser['learnedStateInjected'] is False
                and browser['targetLevels'] == 3
                and browser['targetMet'] is (browser['final']['levels'] >= browser['targetLevels']),
                'Passing browser receipt must describe the actual cold game outcome')
        require(browser['pause']['observed'] == 'Paused.'
                and browser['oneAction']['observed'] == 'One action completed.'
                and browser['oneAction']['actions'] == browser['pause']['actions'] + 1
                and browser['final']['actions'] >= browser['oneAction']['actions'] > 0
                and type(browser['final']['levels']) is int and browser['final']['levels'] >= 0
                and browser['artifacts'], 'Browser Pause, single-step or retained final evidence is incomplete')
        browser_levels = browser['final']['levels']
        for record in browser['artifacts']:
            checked(record, exact=False)

    case = load(args.case_checkpoint)
    case_seconds = case['cumulativeChargedSeconds']
    require(case['schema'] == 'logos-engine.relative-arrangement-case-resolution.v1'
            and case['status'] == 'target_three_levels_achieved' and case['game'] == args.game
            and case['maximumCumulativeSeconds'] == 2400 and case['clockReset'] is False
            and finite(case_seconds) and 0 <= case_seconds <= 2400
            and abs((instant(case['resolvedAt']) - instant(case['selectedAt'])).total_seconds() - case_seconds) < 0.01,
            'The retained original case clock is missing, reset or inconsistent with its continuous charged interval')
    require(case['candidate']['continuousColdSession'] is True and case['candidate']['manualActions'] == 0
            and case['candidate']['levelJumps'] == 0 and case['candidate']['levelsCompleted'] >= 3
            and campaign_final['actions'] == case['candidate']['actions']
            and campaign_final['levelsCompleted'] == case['candidate']['levelsCompleted'],
            'Final recorded replay must preserve the actual earlier cold live result; it is not a new live success')
    checked(case['sourceParity'])
    for interval in case['phases']:
        require(finite(interval['elapsedSeconds']) and interval['elapsedSeconds'] >= 0
                and abs((instant(interval['finishedAt']) - instant(interval['startedAt'])).total_seconds()
                        - interval['elapsedSeconds']) < 0.01
                and 0 <= interval['cumulativeCaseSecondsAtEnd'] <= case_seconds,
                'A retained charged phase is invalid or exceeds the original cumulative clock')
    if not browser_blocked:
        require(browser['cumulativeGameCaseSeconds'] <= case_seconds + 0.001,
                'Actual browser game time must be covered by the retained clock')
    game_target_met = campaign_final['levelsCompleted'] >= campaign['targetLevels']

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
    owner_qualification = declaration.get('ownerCostQualification')
    if owner_qualification is not None:
        owner_contract_path = local(owner_qualification['contractPath'])
        owner_contract = load(owner_contract_path)
        require(owner_qualification['schema'] == 'logos-engine.lot4b-owner-cost-qualification.v1'
                and owner_contract['schema'] == 'logos-engine.lot4b-owner-cost-contract.v2'
                and owner_contract['declaration'] == fp(perf / 'declaration.json')
                and owner_contract['tools'] == owner_qualification['tools'] == static['ownerCostTools']
                and static['ownerCostContract'] == fp(owner_contract_path)
                and instant(declaration['finalizedAt']) <= instant(owner_contract['declaredAt'])
                <= instant(static['recordedAt']),
                'Added-owner qualification is not source-bound and predeclared before the static check')
        for record in [*owner_contract['tools'].values(), owner_contract['ownerInventory'],
                       *owner_contract['sourceEvidence'], owner_contract['structuralFixture']]:
            checked(record)
        fixture = load(owner_contract['structuralFixture']['path'])
        attribution = load(checked(fixture['attribution']))
        require(static['ownerStructuralFixture'] == owner_contract['structuralFixture']
                and fixture['schema'] == 'logos-engine.lot4b-owner-cost-structural-fixture.v1'
                and fixture['status'] == attribution['status'] == 'qualified_functional_structure'
                and fixture['nativeDigests'] == attribution['nativeDigests'] == declaration['nativeDigests']
                and fixture['cases'] == declaration['cases']
                and instant(attribution['recordedAt']) <= instant(fixture['recordedAt'])
                <= instant(owner_contract['declaredAt']),
                'Functional structure fixture is not fixed before the cost contract')
        for record in [fixture['cases'], fixture['captureTool'], attribution['generator'],
                       *attribution['inputs'], *[item for side in ('baseline', 'candidate')
                       for item in fixture['captures'][side].values()]]:
            if Path(record['path']).is_absolute():
                lexical = Path(record['path'])
                path = lexical.resolve(strict=True)
                require(path == lexical and path.is_relative_to(Path(preparation['baselineCheckout']).resolve()),
                        'External structure input escapes the declared baseline checkout')
                actual = {'path': record['path'], 'sha256': sha(path), 'bytes': path.stat().st_size}
                require(actual == record, 'External structure input fingerprint differs')
                external_inputs[record['path']] = record
            else:
                checked(record)
    isolation = load(perf / 'coordinated-isolation.json')
    require(isolation['status'] == 'acknowledged_quiet_before_window'
            and isolation['otherLaneAcknowledged'] is True and isolation['ownTrackedComputeEnded'] is True
            and isolation['previewStopped'] is True and isolation['costNodeOptionsOverride'] is None,
            'Explicit cooperative isolation is not acknowledged')
    for record in isolation.get('evidence', []):
        checked(record)
    finalized = datetime.now(timezone.utc)
    require(instant(declaration['finalizedAt']) <= instant(static['recordedAt']) <= finalized
            and all(instant(row['finishedAt']) <= finalized for value in (tests, checks) for row in value['checks']),
            'Completed evidence must precede readiness')
    keep(Path(__file__))
    for record in list(inputs.values()):
        require(fp(local(record['path'])) == record, 'Input changed before finalization: ' + record['path'])
    for record in external_inputs.values():
        path = Path(record['path'])
        require(path.resolve(strict=True) == path
                and {'path': record['path'], 'sha256': sha(path), 'bytes': path.stat().st_size} == record,
                'External baseline input changed before finalization: ' + record['path'])
    require(not output.exists() and not (perf / 'window.json').exists(), 'Window started during readiness validation')
    value = {'schema': 'logos-engine.native-cost-window-readiness.v1', 'status': 'ready',
        'finalizedAt': finalized.isoformat(), 'measurementAuthorized': True, 'pendingRequirements': [],
        'generator': fp(Path(__file__)), 'nativeVersion': policy['candidate']['nativeVersion'],
        'nativeSourceDigest': digest, 'baseline': policy['baseline'], 'candidate': policy['candidate'],
        'formalTests': counts, 'formalTestFiles': len(test_files), 'regressionChecks': comparison_count,
        'partialRegression': partial_summary,
        'sourceParityCalls': replay['callsCompared'], 'sourceParityGuards': replay['guardsCompared'],
        'sourceParityPrefixes': replay['prefixesCompared'], 'sourceParityAblations': ablations,
        'game': {'id': args.game, 'targetLevels': 3, 'campaignLevels': campaign_final['levelsCompleted'],
                 'campaignEvidenceKind': 'recorded_final_release_replay_of_retained_cold_live_case',
                 'liveSourceDigest': case['candidate']['nativeDigest'], 'frozenReplayDigest': digest,
                 'browserLevels': browser_levels, 'browserStatus': browser['status'], 'targetMet': game_target_met,
                 'browserQualification': browser.get('qualification'), 'cumulativeSeconds': case_seconds,
                 'remainingSeconds': 2400 - case_seconds, 'clockReset': False},
        'inputs': list(inputs.values()), 'isolation': isolation,
        'qualification': 'Completed official delta tests, five checks, empty audit failures, strict regressions, '
            'delivery integrity, cold original-Python selected-only parity and the retained cumulative game '
            'clock precede this cost window. The final recorded replay is not a new live success. Browser '
            'infrastructure blockage with zero game actions, when present, remains explicitly nonpassing. '
            'Cooperative lane acknowledgement and ended tracked work '
            'establish the declared quiet interval; process visibility alone does not establish isolation.'}
    if owner_qualification is not None:
        value['ownerCostContract'] = fp(owner_contract_path)
        value['historicalStrictIdentityNotAnticipated'] = True
        value['watchedExternalInputs'] = list(external_inputs.values())
    with output.open('x') as stream:
        stream.write(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'status': 'ready', 'receipt': fp(output), 'gameTargetMet': game_target_met}))


if __name__ == '__main__':
    main()
