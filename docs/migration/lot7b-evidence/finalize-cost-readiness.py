#!/usr/bin/env python3
"""Bind completed integrated 7B evidence before the first official cost sample.

This verifies retained receipts and file fingerprints; it does not run a test,
game, replay, build or measurement. Paths are repository-relative (absolute
paths inside the checkout are also accepted). The declaration supplies the
baseline and candidate identities. A qualified CRAF reserve is permitted.
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
BASE = ROOT / 'docs/migration/lot7b-evidence'
REFERENCE = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
TEST_RUNNER = ROOT / 'scripts/verify-native-delta.py'
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')
CHECKPOINT_CHECK_KEYS = frozenset({
    'onePrimitiveSourceRecord', 'ownerAndFormat', 'exactNativeEnvelope', 'exactSourceProjection',
    'exactSelectedEvent', 'exactRetainedSourceFact', 'captureEndsAtAcquiredState',
})


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
                        help='Completed original-Python symbol transaction parity receipt for this freeze.')
    parser.add_argument('--browser-receipt', type=Path, required=True,
                        help='Completed browser-qa.v1 receipt for this freeze.')
    parser.add_argument('--case-checkpoint', type=Path,
                        default=BASE / 'craf-case-checkpoint.json')
    parser.add_argument('--audit-receipt', type=Path,
                        help='Optional passed migration-audit resolution; otherwise use the official check log.')
    parser.add_argument('--baseline-publication-receipt', type=Path, required=True,
                        help='Verified actual predecessor Site/deployment/commit receipt.')
    parser.add_argument('--test-scope-plan', type=Path,
                        default=BASE / 'coordination/integrated-test-scope-plan.json')
    args = parser.parse_args()
    perf, candidate_dir = local(args.performance_directory), local(args.candidate_source_directory)
    require(perf.is_relative_to(BASE) and candidate_dir.is_relative_to(BASE),
            '7B readiness and candidate evidence must stay inside lot7b-evidence')
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
    publication = load(args.baseline_publication_receipt)
    require(publication['schema'] == 'logos-engine.lot7b-published-baseline.v1'
            and publication['status'] == 'verified' and publication['deploymentStatus'] == 'succeeded'
            and publication['projectId'] == 'appgprj_6adbc388d79081918581b93b919d7258'
            and publication['siteVersion'] == policy['baseline']['siteVersion']
            and publication['commit'] == policy['baseline']['commit']
            and publication['nativeVersion'] == policy['baseline']['nativeVersion']
            and publication['nativeSourceDigest'] == baseline['digest'],
            'Actual published predecessor receipt differs from the declared baseline')
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
    scope = load(args.test_scope_plan)
    require(scope['testFiles'] == test_files and scope['testFileCount'] == len(test_files),
            'Formal test scope differs from the integrated predeclared scope')
    require(test_files and len(test_files) == len(set(test_files))
            and {'tests/v6-symbol-geometry-reference.test.ts', 'tests/v6-symbol-interface-reference.test.ts', 'tests/v6-symbol-transactions-reference.test.ts', 'tests/v6-symbol-transactions-kernel.test.ts'} <= set(test_files),
            'Formal scope omits symbol contracts or contains duplicate files')
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
    for required in [candidate_dir / name for name in ('source-manifest.json', 'source-archive.json',
                     'source-archive-parts.json', 'regressions/regression-summary.json')] + [
                     validation_dir / 'delta-tests-run.json', validation_dir / 'checks-run.json']:
        require(required.relative_to(ROOT).as_posix() in integrity_paths,
                'Integrity receipt omits required evidence: ' + str(required))
    for record in [integrity['generator'], *integrity['verificationHelpers'], *integrity['receipts']]:
        checked(record)
    require(integrity['nativeAgentWorker'] == checks['nativeAgentWorker'], 'Integrity and build name different workers')

    parity = load(args.parity_receipt)
    require(parity['schema'] == 'logos-engine.v6.symbol-transactions-public-parity.v1'
            and parity['status'] == 'passed'
            and parity['referenceCommit'] == REFERENCE and parity['sourceModified'] is False
            and parity['sourceFilesVerifiedBeforeAndAfter'] == integrity['originalSourceFilesUnchanged']
            and parity['initialOwner'] == 'fresh SymbolTransactions()' and parity['nativeSourceStatesInjected'] == 0
            and parity['failedCalls'] == 0 and parity['matchedCalls'] == parity['callCount'] == len(parity['calls']) > 0
            and parity['exactChecks'] == parity['totalChecks'] == 3 * parity['callCount']
            and parity['selectedSymbolCount'] > 0,
            'Cold original-Python symbol transaction parity is incomplete')
    checked(parity['generator'])
    require(parity['captureCoverage'] and all(value is True for value in parity['captureCoverage'].values())
            and parity['orderedGuardWitnesses'] and all(row['matched'] is True for row in parity['orderedGuardWitnesses']),
            'Selected actions are not fully bound to ordered original proposal, guards and record')
    checkpoint = parity['checkpointProof']
    require(checkpoint['required'] is True and checkpoint['complete'] is True
            and checkpoint['restorationComplete'] is True and checkpoint['restoreTraceOrdered'] is True
            and checkpoint['legacyWithoutCheckpointBlocks'] is False
            and checkpoint['capturedPrefixes'] == checkpoint['matchedPrefixes'] == checkpoint['selectedPrefixes']
            == checkpoint['matchedRestorations'] == len(checkpoint['prefixes']) > 0
            and type(checkpoint['nativeRestoreCalls']) is int
            and checkpoint['nativeRestoreCalls'] >= checkpoint['capturedPrefixes']
            and checkpoint['exactChecks'] == checkpoint['totalChecks'] == 7 * checkpoint['capturedPrefixes']
            and all(row['matched'] is True and row['nativeRestorationMatched'] is True
                    and set(row['checks']) == CHECKPOINT_CHECK_KEYS
                    and all(value is True for value in row['checks'].values())
                    for row in checkpoint['prefixes']), 'Actual retained Symbols checkpoints or observed restorations are incomplete')
    require(all(row['matched'] is True and row['differences'] == {}
                and set(row['checks']) == {'beforeState', 'returnValue', 'afterState'}
                and all(value is True for value in row['checks'].values()) for row in parity['calls']),
            'A captured source call is not exactly matched')
    campaign_record = parity['campaign']
    campaign = read(checked(campaign_record, exact=False))
    require(campaign_record['sourceDigest'] == digest and campaign_record['sourceUnchangedDuringRun'] is True
            and campaign['source'] == candidate and campaign['sourceUnchangedDuringRun'] is True
            and campaign['game'] == campaign_record['game'] == 'CRAF'
            and campaign['targetLevels'] == 3 and campaign['referenceCommit'] == REFERENCE
            and campaign['final']['actions'] == campaign_record['actions'] > 0
            and campaign['final']['levelsCompleted'] == campaign_record['levelsCompleted']
            and campaign['final']['reason'] == campaign_record['reason']
            and campaign['status'] == campaign_record['status'], 'Source parity is not bound to the final actual campaign')
    contribution = read(checked(parity['contributionReceipt']))
    unique = contribution['feedbackUniqueness']
    selected_actions = [action for action in campaign['actions'] if action['family'] == 'public_symbol_transaction']
    require(contribution['campaign'] == campaign_record
            and contribution['selectedSymbolCount'] == parity['selectedSymbolCount']
            and contribution['selectedRecordOnly'] is True and contribution['records'].get('foreign', 0) == 0
            and contribution['records']['active'] == len(selected_actions) > 0
            and contribution['captureCoverage'] == parity['captureCoverage']
            and unique['duplicates'] == []
            and unique['recordCalls'] == unique['distinctObservedTransitions'] == len(selected_actions)
            and unique['physicalActions'] == campaign_record['actions'],
            'Symbols acquisition must occur once per selected own actual action and never for a foreign return')

    browser = load(args.browser_receipt)
    require(browser['schema'] == 'logos-engine.browser-qa.v1' and browser['nativeDigest'] == digest
            and browser['nativeVersion'] == policy['candidate']['nativeVersion'] and browser['game'] == 'CRAF'
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
    require(case['schema'] == 'logos-engine.cumulative-game-case-checkpoint.v1' and case['game'] == 'CRAF'
            and case['targetLevels'] == 3 and case['maximumCumulativeSeconds'] == 2400
            and case.get('clockReset', False) is False
            and finite(case['cumulativeSeconds']) and 0 <= case['cumulativeSeconds'] <= 2400
            and finite(case['remainingSeconds'])
            and abs(case['remainingSeconds'] + case['cumulativeSeconds'] - 2400) < 0.001,
            'CRAF cumulative clock is missing, reset, invalid or over its cap')
    intervals = case['chargedIntervals']
    require(all(row['status'] == 'closed' and finite(row['elapsedSeconds']) and row['elapsedSeconds'] >= 0
                and abs((instant(row['endedAt']) - instant(row['startedAt'])).total_seconds()
                        - row['elapsedSeconds']) < 0.01 for row in intervals),
            'A charged CRAF interval remains open or differs from its timestamps')
    ledger_total = case['preClockCharge']['chargedSeconds'] + sum(row['elapsedSeconds'] for row in intervals)
    require(finite(case['preClockCharge']['chargedSeconds']) and case['preClockCharge']['chargedSeconds'] >= 0
            and all(instant(first['endedAt']) <= instant(second['startedAt'])
                    for first, second in zip(intervals, intervals[1:])),
            'Case pre-clock charge is invalid or charged intervals overlap')
    require(abs(ledger_total - case['cumulativeSeconds']) < 0.001
            and ('paused' in case['casePhase'] or 'complete' in case['casePhase'])
            and case['actualLevels'] >= max(campaign_record['levelsCompleted'], browser['final']['levels'])
            and browser['cumulativeGameCaseSeconds'] <= case['cumulativeSeconds'] + 0.001,
            'Final CRAF evidence is not covered by the paused cumulative ledger')
    game_target_met = campaign_record['levelsCompleted'] >= case['targetLevels']
    browser_target_met = browser['final']['levels'] >= browser['targetLevels']
    require(game_target_met or bool(case.get('limitation')),
            'An unmet campaign target must retain its explicit qualification')
    require(browser_target_met or bool(browser.get('qualification')),
            'An unmet browser target must retain its explicit qualification')

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
        require(owner_qualification['schema'] == 'logos-engine.lot7b-owner-cost-qualification.v1'
                and owner_contract['schema'] == 'logos-engine.lot7b-owner-cost-contract.v2'
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
                and fixture['schema'] == 'logos-engine.lot7b-owner-cost-structural-fixture.v1'
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
                path = Path(record['path']).resolve()
                require(path.is_relative_to(Path(preparation['baselineCheckout']).resolve()),
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
        path = Path(record['path']).resolve()
        actual = {'path': record['path'], 'sha256': sha(path), 'bytes': path.stat().st_size}
        require(actual == record, 'External input changed before finalization: ' + record['path'])
    require(not output.exists() and not (perf / 'window.json').exists(), 'Window started during readiness validation')
    value = {'schema': 'logos-engine.native-cost-window-readiness.v1', 'status': 'ready',
        'finalizedAt': finalized.isoformat(), 'measurementAuthorized': True, 'pendingRequirements': [],
        'generator': fp(Path(__file__)), 'nativeVersion': policy['candidate']['nativeVersion'],
        'nativeSourceDigest': digest, 'baseline': policy['baseline'], 'candidate': policy['candidate'],
        'formalTests': counts, 'formalTestFiles': len(test_files), 'regressionChecks': comparison_count,
        'sourceParityCalls': parity['callCount'], 'sourceParityChecks': parity['totalChecks'],
        'sourceCheckpointPrefixes': checkpoint['capturedPrefixes'], 'sourceCheckpointChecks': checkpoint['totalChecks'],
        'sourceRestoredPrefixes': checkpoint['matchedRestorations'],
        'game': {'id': 'CRAF', 'targetLevels': 3, 'campaignLevels': campaign_record['levelsCompleted'],
                 'browserLevels': browser['final']['levels'], 'targetMet': game_target_met,
                 'browserTargetMet': browser_target_met, 'browserQualification': browser.get('qualification'),
                 'qualification': case.get('limitation'), 'cumulativeSeconds': case['cumulativeSeconds'],
                 'remainingSeconds': case['remainingSeconds'], 'clockReset': False},
        'inputs': list(inputs.values()), 'isolation': isolation,
        'qualification': 'Completed official delta tests, five checks, empty audit failures, strict regressions, '
            'delivery integrity, cold original-Python parity with observed selected-prefix native restoration, '
            'actual browser evidence and the cumulative game '
            'clock precede this cost window. An explicitly qualified unmet three-level game target is retained '
            'and does not become a success claim. Cooperative lane acknowledgement and ended tracked work '
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
