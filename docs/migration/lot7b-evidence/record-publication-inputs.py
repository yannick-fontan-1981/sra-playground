#!/usr/bin/env python3
"""Bind completed 7B evidence and unchanged compiled inputs for publication.

Adapted from docs/migration/lot7a-evidence/record-publication-inputs.py.
Counts, versions and baseline identity come from the retained 7B declaration,
published-baseline receipt, test scope and completed generic verification.
This script runs no test, game, build, measurement, Git or network operation.
It records integrity and provenance; it does not publish the candidate.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot7b-evidence'
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')
CHECK_NAMES = ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
ORDER = ['A1', 'B1', 'B2', 'A2']
TEST_RUNNER = ROOT / 'scripts/verify-native-delta.py'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def local(value):
    path = (ROOT / value).resolve()
    require(path != ROOT and path.is_relative_to(ROOT), 'Input escapes the checkout: ' + str(value))
    return path


def digest_file(path):
    digest, size = hashlib.sha256(), 0
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
            size += len(chunk)
    return {'bytes': size, 'sha256': digest.hexdigest()}


def fingerprint(value):
    path = local(value)
    return {'path': path.relative_to(ROOT).as_posix(), **digest_file(path)}


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timestamp lacks a timezone')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--performance-directory', type=Path, default=BASE / 'performance-integrated')
    parser.add_argument('--candidate-source-directory', type=Path, default=BASE / 'integrated-final')
    parser.add_argument('--validation-directory', type=Path, default=Path('validation'),
                        help='Completed generic verification directory inside the candidate evidence directory.')
    parser.add_argument('--test-scope-plan', type=Path,
                        default=BASE / 'coordination/integrated-test-scope-plan.json')
    parser.add_argument('--baseline-publication-receipt', type=Path, required=True)
    args = parser.parse_args()
    perf, final = local(args.performance_directory), local(args.candidate_source_directory)
    require(perf.is_relative_to(BASE) and final.is_relative_to(BASE), 'Expected 7B evidence directories')
    validation = (final / args.validation_directory).resolve()
    require(validation.is_relative_to(final), 'Validation receipts escape the candidate directory')
    output = final / 'publication-inputs.json'
    require(not output.exists(), 'Publication input receipt already exists')
    retained, external = {}, {}

    def keep(value):
        record = fingerprint(value)
        require(retained.setdefault(record['path'], record) == record,
                'Input changed during publication review: ' + record['path'])
        return record

    def load(value):
        path = local(value)
        keep(path)
        return json.loads(path.read_bytes())

    def verify(record):
        require(keep(record['path']) == record, 'Retained fingerprint differs: ' + record['path'])

    def verify_inventory(files):
        require(isinstance(files, dict) and bool(files), 'An input inventory is empty')
        for name, digest in files.items():
            require(keep(name)['sha256'] == digest, 'Recorded file changed: ' + name)
        return len(files)

    declaration = load(perf / 'declaration.json')
    policy = load(perf / 'global-budget-policy.json')
    preparation = load(perf / 'preparation.json')
    source = load(final / 'source-manifest.json')
    baseline_source = load(declaration['baselineManifest']['path'])
    archive = load(final / 'source-archive.json')
    tests = load(validation / 'delta-tests-run.json')
    checks = load(validation / 'checks-run.json')
    scope = load(args.test_scope_plan)
    integrity = load(final / 'delivery-integrity.json')
    readiness = load(perf / 'readiness.json')
    window = load(perf / 'window.json')
    aggregate = load(perf / 'owner-growth-comparison.json')
    review = load(perf / 'owner-growth-review.json')
    transport = load(perf / 'log-transport.json')
    render = load(perf / 'results-render.json')
    publication = load(args.baseline_publication_receipt)
    source_digest = source['digest']
    for role, manifest in (('baseline', baseline_source), ('candidate', source)):
        files = dict(sorted(manifest['files'].items()))
        require(manifest['fileCount'] == len(files) > 0
                and hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest() == manifest['digest'],
                'Invalid frozen manifest: ' + role)
        require(declaration[role] == policy[role] == preparation[role]
                and declaration['nativeDigests'][role] == policy[role]['nativeDigest'] == manifest['digest']
                and policy[role]['nativeFiles'] == manifest['fileCount']
                and re.fullmatch(r'\d+\.\d+\.\d+', policy[role]['nativeVersion']),
                'Declared source identity differs: ' + role)
    require(declaration['candidateManifest'] == keep(final / 'source-manifest.json')
            and declaration['candidateArchiveManifest'] == keep(final / 'source-archive.json'),
            'Candidate directory differs from the cost declaration')
    require(publication['schema'] == 'logos-engine.lot7b-published-baseline.v1'
            and publication['status'] == 'verified' and publication['deploymentStatus'] == 'succeeded'
            and publication['projectId'] == 'appgprj_6adbc388d79081918581b93b919d7258'
            and type(publication['siteVersion']) is int and publication['siteVersion'] > 0
            and re.fullmatch(r'[0-9a-f]{40}', publication['commit'])
            and all(publication[key] == policy['baseline'][key] for key in ('siteVersion', 'commit', 'nativeVersion'))
            and publication['nativeSourceDigest'] == baseline_source['digest'],
            'Actual published predecessor differs from the frozen baseline')
    require(archive['nativeSourceManifestDigest'] == source_digest
            and archive['baseCommit'] == policy['candidate']['sourceBaseCommit']
            and all(archive['files'].get(name) == digest for name, digest in source['files'].items()),
            'Candidate archive does not bind its native freeze')
    verify(archive['archive'])
    keep(final / 'source-archive-parts.json')
    native_paths = {path.relative_to(ROOT).as_posix() for folder in ('src/logos-engine', 'src/runtime')
                    for path in (ROOT / folder).rglob('*')
                    if path.is_file() and path.suffix in ('.ts', '.json', '.drm')}
    require(native_paths == set(source['files']), 'Current native file set differs from its freeze')

    for receipt in (tests, checks):
        require(receipt['schema'] == 'logos-engine.native-delta-verification.v1'
                and receipt['status'] == 'passed' and receipt['generator'] == keep(TEST_RUNNER)
                and receipt['nativeSourceManifestDigest'] == source_digest and receipt['nativeSource'] == source
                and receipt['nativeSourceUnchanged'] is True,
                'Generic native-delta verification differs from the final source')
        for row in receipt['checks']:
            require(row['exitCode'] == 0, 'A retained verification failed')
            verify(row['output'])
    require(len(tests['checks']) == 1 and tests['checks'][0]['name'] == 'delta-tests'
            and tests['checks'][0]['tapSummaryComplete'] is True
            and tests['sourceAndTestInputsUnchanged'] is True, 'Formal test receipt is incomplete')
    test_files, test_counts = tests['testFiles'], tests['checks'][0]['counts']
    require(scope['testFiles'] == test_files and scope['testFileCount'] == len(test_files) > 0
            and len(test_files) == len(set(test_files)), 'Test scope differs from its retained plan')
    require(tests['checks'][0]['command'] == ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *test_files],
            'Formal tests do not use the recorded generic runner command')
    require(set(test_counts) == set(COUNT_KEYS) and all(type(test_counts[key]) is int for key in COUNT_KEYS)
            and test_counts['tests'] == test_counts['pass'] > 0
            and all(test_counts[key] == 0 for key in COUNT_KEYS[2:]), 'Formal tests did not all pass')
    tap = gzip.decompress(local(tests['checks'][0]['output']['path']).read_bytes()).decode()
    require(all(re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M) == [str(test_counts[key])]
                for key in COUNT_KEYS), 'Test counts differ from their complete retained TAP summary')
    require([row['name'] for row in checks['checks']] == CHECK_NAMES, 'The five generic release checks are incomplete')
    require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1' and integrity['status'] == 'passed'
            and integrity['nativeSourceDigest'] == readiness['nativeSourceDigest'] == source_digest
            and integrity['tests'] == readiness['formalTests'] == test_counts
            and readiness['formalTestFiles'] == len(test_files)
            and integrity['nativeAgentWorker'] == checks['nativeAgentWorker']
            and integrity['sourceArchiveVerification']['byteIdentical'] is True,
            'Delivery integrity, formal tests, build and readiness disagree')
    require(readiness['status'] == 'ready' and readiness['measurementAuthorized'] is True
            and readiness['pendingRequirements'] == [] and readiness['baseline'] == policy['baseline']
            and readiness['candidate'] == policy['candidate'], 'Readiness does not bind this source pair')
    require(keep(args.test_scope_plan) in readiness['inputs']
            and keep(args.baseline_publication_receipt) in readiness['inputs'],
            'Readiness omits this exact test scope or actual baseline publication receipt')

    require(window['status'] == window['finalIntegrity'] == 'passed'
            and [row['label'] for row in window['executions']] == ORDER
            and window['nativeDigests'] == {'baseline': baseline_source['digest'], 'correction': source_digest}
            and instant(readiness['finalizedAt']) < instant(window['startedAt']) <= instant(window['finishedAt']),
            'Completed cost window differs from its predeclared source pair')
    qualification = declaration['ownerCostQualification']
    contract = load(qualification['contractPath'])
    contract_record = keep(qualification['contractPath'])
    require(qualification['schema'] == 'logos-engine.lot7b-owner-cost-qualification.v1'
            and contract['schema'] == 'logos-engine.lot7b-owner-cost-contract.v2' and contract['lot'] == '7B'
            and contract['performanceDirectory'] == perf.relative_to(ROOT).as_posix()
            and contract['declaration'] == keep(perf / 'declaration.json')
            and contract['tools'] == qualification['tools'] and readiness['ownerCostContract'] == contract_record,
            'Qualified cost contract differs from its declaration and readiness')
    require(contract['tools'] == {
                'consolidator': keep(BASE / 'consolidate-owner-costs.mjs'),
                'reviewer': keep(BASE / 'review-owner-costs.py')},
            'Cost generators differ from the exact predeclared 7B tools')
    require(aggregate['schema'] == 'logos-engine.lot7b-owner-cost-consolidation.v2'
            and aggregate['status'] == 'qualified_consolidation_complete'
            and review['schema'] == 'logos-engine.lot7b-owner-cost-review.v2'
            and review['status'] == 'qualified_owner_cost_review_passed'
            and aggregate['generator'] == contract['tools']['consolidator']
            and review['generator'] == contract['tools']['reviewer']
            and aggregate['contract'] == review['contract'] == contract_record
            and review['aggregate'] == keep(perf / 'owner-growth-comparison.json')
            and aggregate['declaration'] == review['declaration'] == contract['declaration']
            and all(not any(key in receipt for key in ('postMeasurementIoCorrection', 'ioCorrection', 'declaredGenerator'))
                    for receipt in (aggregate, review)),
            'Qualified results do not use the exact tools and inputs declared before measurement')
    require(review['checkedCount'] == len(review['checks']) > 0
            and all(row['passed'] is True for row in review['checks']) and review['inputsUnchanged'] is True
            and aggregate['sources'] == review['sources'] == {
                'baseline': {'digest': baseline_source['digest'], 'fileCount': baseline_source['fileCount']},
                'after': {'digest': source_digest, 'fileCount': source['fileCount']}},
            'Independent review is incomplete or names another source pair')
    require(aggregate['globalAccepted'] is review['globalAccepted'] is review['accepted'] is True
            and review['acceptedCases'] == review['totalCases'] == len(policy['caseIds']) == 2
            and aggregate['globalStatus'] == review['globalStatus'] == 'accepted_under_predeclared_owner_cost_rule'
            and policy['globalStage'] == 'session_elapsed' and policy['relativeIncreaseLimit'] == 0.1
            and policy['comparison'] == 'strictly_less_than' and policy['allCasesMustPass'] is True
            and policy['crossCaseCompensation'] is False, 'Independent global cost decision is not accepted')
    for key, count in (('measuredSessions', 32), ('measuredActions', 400),
                       ('excludedWarmupSessions', 8), ('excludedWarmupActions', 24)):
        require(declaration[key] == policy[key] == aggregate[key] == review[key] == count,
                'Cost population changed: ' + key)
    require(aggregate['historicalStrict']['passed'] is review['historicalStrictPassed'] is False
            and aggregate['historicalStrict']['status'] == 'failed_work_metadata'
            and review['diagnosticPhaseRule']['status'] == aggregate['phaseStatus']
            and not local(contract['historicalAggregateOutput']).exists(),
            'Historical strict refusal or phase diagnostics were reclassified')
    verify(aggregate['historicalStrict']['failureReceipt'])
    verify(aggregate['historicalStrict']['failureLog'])
    require(render['schema'] == 'logos-engine.lot7b-cost-report-render.v1'
            and render['status'] == 'rendered_retained_receipts'
            and render['generator'] == keep(BASE / 'write-cost-results.py')
            and render['report'] == keep(perf / 'results.md') and render['inputReceiptsUnchanged'] is True
            and render['displayedMeasuredSessions'] == 32, 'Rendered report does not bind the completed 7B results')

    inventories = {'native': verify_inventory(source['files']), 'archiveMembers': verify_inventory(archive['files']),
                   'sourceAndTests': verify_inventory(tests['sourceAndTestInputs']),
                   'buildInputs': verify_inventory(checks['buildInputs'])}
    verify(checks['nativeAgentWorker'])
    for record in [integrity['generator'], *integrity['verificationHelpers'], *integrity['receipts'],
                   *readiness['inputs'], *review['inputs'], *render['inputs']]:
        verify(record)
    baseline = Path(window['baselineCheckout']).resolve(strict=True)
    require(baseline != ROOT.resolve(strict=True) and str(baseline) == preparation['baselineCheckout'],
            'Window baseline checkout differs from its preparation')
    for receipt in (readiness, review, render):
        for record in receipt.get('watchedExternalInputs', []):
            path = Path(record['path']).resolve(strict=True)
            require(Path(record['path']).is_absolute() and path != baseline and path.is_relative_to(baseline),
                    'External input escapes the frozen baseline')
            require({'path': record['path'], **digest_file(path)} == record,
                    'External baseline input changed: ' + record['path'])
            require(external.setdefault(record['path'], record) == record, 'Conflicting external input fingerprints')
    require(transport['schema'] == 'logos-engine.lossless-log-transport.v1' and transport['status'] == 'passed'
            and transport['generator'] == keep(BASE / 'record-cost-log-transport.py')
            and transport['window'] == keep(perf / 'window.json')
            and [row['series'] for row in transport['logs']] == ORDER,
            'Log transport does not bind all four actual series')
    for log in transport['logs']:
        verify(log['original'])
        verify(log['transport'])
        require(gzip.decompress(local(log['transport']['path']).read_bytes())
                == local(log['original']['path']).read_bytes(), 'Log transport is not byte-identical')
    for execution in window['executions']:
        require(execution['status'] == 'passed' and execution['exitCode'] == 0, 'A cost series is incomplete')
        require(keep(execution['log'])['sha256'] == execution['logSha256'], 'Window log changed')
        require(keep(execution.get('copiedOutput', execution['output']))['sha256'] == execution['reportSha256'],
                'Window raw report changed')
    keep(Path(__file__))
    adapted_from = keep(ROOT / 'docs/migration/lot7a-evidence/record-publication-inputs.py')
    for record in retained.values():
        require(fingerprint(record['path']) == record, 'Local input changed before finalization: ' + record['path'])
    for record in external.values():
        path = Path(record['path']).resolve(strict=True)
        require(path != baseline and path.is_relative_to(baseline)
                and {'path': record['path'], **digest_file(path)} == record,
                'External input changed before finalization: ' + record['path'])
    result = {
        'schema': 'logos-engine.lot7b-publication-inputs.v1', 'status': 'passed',
        'recordedAt': datetime.now(timezone.utc).isoformat(),
        'generator': fingerprint(Path(__file__)), 'adaptedFrom': adapted_from,
        'nativeVersion': policy['candidate']['nativeVersion'], 'nativeSourceDigest': source_digest,
        'baseline': policy['baseline'], 'baselinePublication': fingerprint(args.baseline_publication_receipt),
        'formalTests': test_counts, 'formalTestFiles': len(test_files), 'testScopePlan': fingerprint(args.test_scope_plan),
        'officialCheckNames': CHECK_NAMES, 'fileInventories': inventories,
        'nativeAgentWorker': checks['nativeAgentWorker'], 'costGlobalStatus': review['globalStatus'],
        'costGenerators': contract['tools'], 'historicalStrictPassed': False,
        'functionalQualification': readiness.get('game'), 'inputsUnchanged': True,
        'receipts': list(retained.values()), 'watchedExternalInputs': list(external.values()),
        'publicationExecuted': False,
        'qualification': 'File integrity and publication provenance only. No test, build, game, measurement, Git or network operation. '
            'The actual published predecessor, dynamic test scope, generic verification, compiled worker and every recorded source/test/build input remain bound. '
            'All 32 measured sessions and eight declared warmups remain in the four original reports. The historical strict failure remains failed; '
            'the independently reviewed supplemental decision uses the exact predeclared 7B generators and structural contract. '
            'Functional and browser qualifications remain those retained by readiness. This receipt does not assert candidate publication, '
            'a completed game target, global migration completeness or an arbitrary long-session latency or memory bound.',
    }
    with output.open('x') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'status': 'passed', 'formalTests': test_counts, 'formalTestFiles': len(test_files),
                      'fileInventories': inventories, 'receipt': fingerprint(output)}))


if __name__ == '__main__':
    main()
