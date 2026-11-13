#!/usr/bin/env python3
"""Verify completed 4C evidence before timing; never run a solver or test.

The game contribution may be partial. Its raw outcome and remaining limitation
are retained explicitly; passing component parity does not relabel that outcome.
All input paths are supplied by the completed delivery and fingerprinted here.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot4c-evidence'
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')


def require(value, message):
    if not value:
        raise ValueError(message)


def instant(value):
    require(isinstance(value, str) and value, 'A completed receipt needs its timestamp')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'A receipt timestamp lacks its timezone')
    return result


def fingerprint(path):
    path = Path(path).resolve()
    hasher = hashlib.sha256()
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(data)
    return {'path': path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path),
            'bytes': path.stat().st_size, 'sha256': hasher.hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--performance-directory', type=Path, required=True)
    parser.add_argument('--final-directory', type=Path, required=True)
    for name in ('published-predecessor', 'parity', 'browser', 'case-clock', 'integrity'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--partial-regression', action='append', type=Path, default=[])
    args = parser.parse_args()
    perf = (ROOT / args.performance_directory).resolve()
    final = (ROOT / args.final_directory).resolve()
    require(perf.is_relative_to(BASE) and final.is_relative_to(BASE), '4C evidence must belong to this delivery')
    output = perf / 'readiness.json'
    require(not output.exists() and not (perf / 'window.json').exists(), 'Readiness must precede the first cost window')
    inputs, external_inputs = {}, {}
    baseline_root = None
    completed = []

    def keep(path):
        path = (ROOT / path).resolve()
        record = fingerprint(path)
        if path.is_relative_to(ROOT):
            inventory = inputs
        else:
            require(baseline_root is not None and path.is_relative_to(baseline_root),
                    'External readiness inputs must belong to the declared baseline checkout')
            inventory = external_inputs
        require(inventory.setdefault(record['path'], record) == record, 'An input changed during verification')
        return record

    def checked(record):
        actual = keep(record['path'])
        require(actual['sha256'] == record['sha256'] and ('bytes' not in record or actual['bytes'] == record['bytes']),
                'Fingerprint mismatch: ' + record['path'])
        return ROOT / record['path']

    def read(path):
        path = (ROOT / path).resolve()
        keep(path)
        data = path.read_bytes()
        return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)

    declaration = read(perf / 'declaration.json')
    require(declaration['status'] == 'declared_before_official_window' and declaration['noOfficialWindowAtDeclaration'],
            'Actual premeasurement declaration required')
    for key in ('protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy', 'baselineManifest',
                'candidateManifest', 'candidateArchiveManifest', 'globalDecisionTool', 'globalCalculationTool'):
        checked(declaration[key])
    for record in declaration['officialTools']:
        checked(record)
    preparation = read(perf / 'preparation.json')
    baseline_root = Path(preparation['baselineCheckout']).resolve()
    require(preparation['status'] == 'source_freezes_verified_not_functional_readiness'
            and preparation['measurementExecuted'] is False
            and preparation['baseline'] == declaration['baseline']
            and preparation['candidate'] == declaration['candidate']
            and Path(preparation['candidateCheckout']).resolve() == ROOT and baseline_root != ROOT,
            'Prepared source identities or checkouts differ from the declaration')
    protocol_check = read(perf / 'protocol-check.json')
    require(protocol_check['status'] == 'protocol_contract_passed'
            and protocol_check['nativeDigests'] == declaration['nativeDigests'],
            'Protocol verification does not bind this declaration')
    policy = read(perf / 'global-budget-policy.json')
    require(policy['comparison'] == 'strictly_less_than' and policy['relativeIncreaseLimit'] == .1
            and policy['allCasesMustPass'] and not policy['crossCaseCompensation']
            and policy['phaseOverrunsMayBeAccepted'] and policy['phasesAndP95RemainVisible']
            and not declaration['phaseOverrunsBlockAcceptance'], 'The authorized global rule changed')
    published = read(args.published_predecessor)
    version, deployment = published['version'], published['deployment']
    require(deployment['status'] == 'succeeded' and deployment['version_id'] == version['id']
            and version['source']['commit_sha'] == declaration['baseline']['commit']
            and version['version_number'] == declaration['baseline']['siteVersion'],
            'Baseline must match the actually deployed predecessor')
    frozen = read(final / 'source-manifest.json')
    require(frozen['digest'] == declaration['nativeDigests']['candidate'], 'Final evidence uses another native freeze')
    require((ROOT / declaration['candidateManifest']['path']).resolve() == final / 'source-manifest.json',
            'Declared candidate manifest is not this final freeze')
    for name, digest in frozen['files'].items():
        require(keep(name)['sha256'] == digest, 'Native source changed: ' + name)
    archive = read(final / 'source-archive.json')
    require(archive['nativeSourceManifestDigest'] == frozen['digest'], 'Source archive binds another freeze')
    for name, digest in archive['files'].items():
        require(keep(name)['sha256'] == digest, 'Frozen execution input changed: ' + name)
    tests = read(final / 'validation/delta-tests-run.json')
    require(tests['schema'] == 'logos-engine.native-delta-verification.v1'
            and tests['status'] == 'passed' and tests['nativeSource'] == frozen
            and tests['nativeSourceUnchanged'] is True and tests['sourceAndTestInputsUnchanged'] is True
            and len(tests['checks']) == 1 and tests['checks'][0]['name'] == 'delta-tests'
            and tests['checks'][0]['exitCode'] == 0 and tests['checks'][0]['tapSummaryComplete'] is True,
            'Final declared test suite did not pass unchanged')
    counts = tests['checks'][0]['counts']
    require(all(type(counts[k]) is int for k in COUNT_KEYS) and counts['tests'] == counts['pass'] > 0
            and all(counts[k] == 0 for k in COUNT_KEYS[2:]), 'Incomplete or unsuccessful test result')
    require({'tests/v6-facet-examples.test.ts', 'tests/v6-facet-examples-integration.test.ts',
             'tests/v6-facet-examples-foreign-acquisition.test.ts'} <= set(tests['testFiles']), 'Facet contracts omitted')
    checked(tests['generator'])
    for row in tests['checks']:
        checked(row['output'])
        require(instant(row['startedAt']) <= instant(row['finishedAt']), 'Test chronology is invalid')
        completed.append(row['finishedAt'])
    for name, digest in tests['sourceAndTestInputs'].items():
        require(keep(name)['sha256'] == digest, 'Test input changed: ' + name)
    checks = read(final / 'validation/checks-run.json')
    require(checks['status'] == 'passed' and checks['nativeSource'] == frozen and checks['nativeSourceUnchanged']
            and [row['name'] for row in checks['checks']] == ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
            and all(row['exitCode'] == 0 for row in checks['checks']), 'The five final release gates must pass')
    checked(checks['generator']); checked(checks['nativeAgentWorker'])
    for row in checks['checks']:
        checked(row['output'])
        require(instant(row['startedAt']) <= instant(row['finishedAt']), 'Release-check chronology is invalid')
        completed.append(row['finishedAt'])
    for name, digest in checks['buildInputs'].items():
        require(keep(name)['sha256'] == digest, 'Build input changed: ' + name)
    regression = read(final / 'regressions/regression-summary.json')
    require(regression['schema'] == 'logos-engine.recorded-public-regressions.v1'
            and regression['status'] == 'passed' and regression['nativeSource'] == regression['nativeSourceAfter'] == frozen
            and regression['executionInputsUnchanged'] is True
            and regression['executionInputs'] == regression['executionInputsAfter']
            and regression['passed'] == regression['total'] == len(regression['results']) > 0
            and regression['comparisonChecksPassed'] == regression['comparisonChecksExpected'] == 17 * regression['total'],
            'A declared strict regression failed or is incomplete')
    checked(regression['caseManifest'])
    for name, digest in regression['executionInputs'].items():
        require(keep(name)['sha256'] == digest, 'Regression execution input changed: ' + name)
    for row in regression['results']:
        require(row['passed'] is True and row['comparisonPassed'] is True
                and row['status'] == 'passed' and row['exitCode'] == 0 and row['timedOut'] is False,
                'A regression case remains failed')
        for key in ('report', 'comparison', 'output', 'execution'):
            checked(row[key])
        require(instant(row['startedAt']) <= instant(row['finishedAt']) <= instant(row['postprocessingFinishedAt']),
                'Regression chronology is invalid')
        completed.append(row['postprocessingFinishedAt'])
    partials = []
    for path in args.partial_regression:
        partial = read(path)
        require(partial['schema'] == 'logos-engine.partial-public-regression-qualification.v1'
                and partial['status'] == 'partial_trajectory_preserved'
                and partial['nativeSource'] == partial['nativeSourceAfter'] == frozen
                and partial['inputs'] == partial['executionInputsAfter']
                and partial['rawCampaignStatus'] == 'failed' and partial['gameTargetCompleted'] is False,
                'Partial trajectory was not preserved')
        require(partial['checks'] and all(row['passed'] is True for row in partial['checks']),
                'A partial-preservation contract failed')
        for record in [*partial['inputs'].values(), partial['report'], partial['trace'],
                       partial['publicJournal'], partial['rawPublicJournal']]:
            checked(record)
        require(instant(partial['startedAt']) <= instant(partial['finishedAt']), 'Partial-regression chronology is invalid')
        completed.append(partial['finishedAt'])
        partials.append({'receipt': keep(path), 'status': partial['status'], 'qualification': 'Raw campaign failure remains a failure; this is not a new live win.'})
    parity = read(args.parity)
    require(parity['schema'] == 'logos-engine.facet-example-public-source-parity.v1' and parity['status'] == 'passed'
            and parity['nativeSource'] == frozen and parity['originalsUnchanged'] and parity['inputsUnchanged']
            and parity['sourceBefore']['filesVerified'] == parity['sourceAfter']['filesVerified'] == 1786
            and parity['bytecodeIsolation']['passed'], 'Final cold original comparison did not pass')
    replay = parity['replay']
    require(replay['componentParityPassed'] and not replay['differences'] and replay['callsCompared'] == replay['callsExpected'] > 0
            and replay['allSelectedRecordsGuarded'] and replay['allActualNativeRestoresMatched']
            and replay['allSelectedRecordsRestored'] and replay['ablations'], 'Source comparison is incomplete')
    for record in parity['inputs'].values():
        checked(record)
    require(instant(parity['startedAt']) <= instant(parity['completedAt']), 'Source comparison chronology is invalid')
    completed.append(parity['completedAt'])
    campaign = read(parity['inputs']['campaign']['path'])
    require(campaign['source'] == frozen and campaign['sourceUnchangedDuringRun'] is True, 'Final campaign/replay changed source')
    selected = [row for row in campaign['prefixes'] if row['family'] == 'facet_examples']
    require(selected and all(row.get('programSubquestion') == 'facet_example' for row in selected), 'No actual selected Facet contribution')
    browser = read(args.browser)
    require(browser['status'] in ('passed', 'infrastructure_blocked'), 'Browser verification incomplete')
    require(browser['nativeDigest'] == frozen['digest'] and browser['worker'] == checks['nativeAgentWorker'], 'Browser build is not the tested candidate')
    checked(browser['worker'])
    if browser['status'] == 'passed':
        require(browser['game'] == campaign['game'] and browser['pauseObserved'] and browser['oneActionObserved']
                and browser['sameContinuousSession'] and browser['evidence'], 'Browser interaction proof incomplete')
        for record in browser['evidence']:
            checked(record)
    else:
        require(browser['actionsExecuted'] == 0 and browser['failureEvidence'], 'Browser infrastructure limit lacks evidence')
        for record in browser['failureEvidence']:
            checked(record)
    clock = read(args.case_clock)
    require(clock['game'] == campaign['game'] and clock['maximumSeconds'] == 2400
            and type(clock['chargedSeconds']) in (int, float) and 0 <= clock['chargedSeconds'] <= 2400
            and clock['clockWasReset'] is False
            and clock['intervals'], 'Cumulative case budget is invalid or exhausted beyond the retained deadline')
    require(all(type(row['chargedSeconds']) in (int, float) and 0 <= row['chargedSeconds'] <= 2400
                and row['evidence'] for row in clock['intervals']), 'A charged interval is invalid or lacks evidence')
    require(abs(sum(row['chargedSeconds'] for row in clock['intervals']) - clock['chargedSeconds']) < 1e-6,
            'Case intervals do not sum to the retained cumulative time')
    for row in clock['intervals']:
        for record in row['evidence']:
            checked(record)
    integrity = read(args.integrity)
    require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1'
            and integrity['status'] == 'passed' and integrity['nativeSourceDigest'] == frozen['digest']
            and (ROOT / integrity['directory']).resolve() == final
            and (ROOT / integrity['validationDirectory']).resolve() == final / 'validation'
            and integrity['originalSourceFilesUnchanged'] == 1786
            and integrity['tests'] == counts and integrity['nativeAgentWorker'] == checks['nativeAgentWorker']
            and integrity['sourceArchiveVerification']['byteIdentical'] is True
            and integrity['byteStorage']['originalsUnchanged'] is True,
            'The actual delivery-integrity receipt does not verify this final evidence')
    require(integrity['regressions'] is not None and all(integrity['regressions'][key] == regression[key]
            for key in ('passed', 'total', 'comparisonChecksPassed', 'comparisonChecksExpected')),
            'Delivery integrity does not bind the passed strict regressions')
    require(all(keep(path) in integrity['receipts'] for path in (
        final / 'source-manifest.json', final / 'source-archive.json',
        final / 'validation/delta-tests-run.json', final / 'validation/checks-run.json',
        final / 'regressions/regression-summary.json')), 'Delivery integrity omits required final receipts')
    for record in [integrity['generator'], *integrity['verificationHelpers'], integrity['originalSourceManifest'],
                   integrity['sourceArchiveVerification']['archive'], *integrity['receipts'],
                   *integrity['byteStorage']['generators']]:
        checked(record)
    completed.append(integrity['recordedAt'])
    static = read(perf / 'static-preflight.json')
    require(static['status'] == 'static_inputs_checked' and static['measurementExecuted'] is False
            and static['checkedCount'] == len(static['checks']) > 0
            and all(row['satisfied'] is True for row in static['checks']), 'Static cost preflight failed')
    contract = read(perf / 'owner-growth-contract.json')
    require(contract['schema'] == 'logos-engine.lot4c-owner-cost-contract.v2'
            and contract['declaration'] == static['declaration'] == keep(perf / 'declaration.json')
            and static['ownerCostContract'] == keep(perf / 'owner-growth-contract.json')
            and contract['tools'] == static['ownerCostTools'] == declaration['ownerCostQualification']['tools']
            and contract['inputsUnchanged'] is True and contract['inputsBefore'] == contract['inputsAfter'],
            'Owner-cost contract differs from this declaration')
    for record in [*contract['tools'].values(), *contract['inputsBefore'], static['generator'],
                   static['protocolCheck'], static['preparationTool']]:
        checked(record)
    keep(Path(__file__))
    for record in [*inputs.values(), *external_inputs.values()]:
        require(fingerprint(ROOT / record['path']) == record, 'Evidence changed before readiness')
    require(not output.exists() and not (perf / 'window.json').exists(), 'Cost window started during readiness')
    finalized = datetime.now(timezone.utc)
    require(instant(policy['declaredAt']) <= instant(declaration['recordedAt'])
            <= instant(declaration['finalizedAt']) <= instant(contract['declaredAt'])
            <= instant(static['recordedAt']) <= finalized,
            'Policy, declaration, owner contract and static review are not in premeasurement order')
    require(all(instant(value) <= finalized for value in completed), 'A functional receipt is not completed before readiness')
    value = {'schema': 'logos-engine.native-cost-window-readiness.v1', 'status': 'ready',
        'finalizedAt': finalized.isoformat(), 'lot': '4C', 'nativeDigests': declaration['nativeDigests'],
        'nativeSourceDigest': frozen['digest'], 'measurementAuthorized': True, 'pendingRequirements': [],
        'measurementAuthorizationScope': 'Completed functional/source prerequisites only; launch still requires fresh coordinated quiet and the exclusive shared flock.',
        'functionalMeasurementReady': True, 'ownerCostContract': keep(perf / 'owner-growth-contract.json'),
        'generator': fingerprint(Path(__file__)), 'inputs': list(inputs.values()),
        'watchedExternalInputs': list(external_inputs.values()),
        'tests': {'passed': counts['pass'], 'files': len(tests['testFiles'])}, 'releaseChecks': 5,
        'strictRegressions': {'cases': regression['total'], 'checks': regression['comparisonChecksPassed']},
        'partialRegressions': partials, 'game': {'id': campaign['game'], 'rawStatus': campaign['status'],
            'targetLevels': campaign['targetLevels'], 'levelsCompleted': campaign['final']['levelsCompleted'],
            'selectedFacetPrefixes': len(selected), 'contribution': 'actual_selected_visible_experiments',
            'qualification': 'This source-compared public trajectory may be the final frozen public replay. Selected Facet contributions do not establish a new live win; a partial raw outcome remains partial even when component and restoration comparisons pass.'},
        'browser': {'status': browser['status'], 'receipt': keep(args.browser)}, 'caseClock': keep(args.case_clock),
        'isolation': {'status': 'requires_fresh_coordination_and_exclusive_flock',
            'qualification': 'This evidence verifier does not assert that other threads are quiet or acquire the machine lock.'},
        'measurementExecuted': False}
    with output.open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False); stream.write('\n')
    print(json.dumps({'status': value['status'], 'tests': value['tests'], 'strictRegressions': value['strictRegressions'],
                      'game': value['game'], 'inputs': len(inputs), 'output': str(output)}))


if __name__ == '__main__':
    main()
