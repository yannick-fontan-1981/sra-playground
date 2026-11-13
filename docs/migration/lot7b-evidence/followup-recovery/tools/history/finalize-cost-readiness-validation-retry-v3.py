#!/usr/bin/env python3
"""Bind fresh recovered-follow-up evidence before any official cost sample.

This read-only verifier writes one exclusive readiness receipt. It runs no
game, replay, oracle, build, native worker or cost process. Historical missing
proofs are disclosed, never substituted for current source-bound validation.
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
import subprocess

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / 'docs/migration/lot7b-evidence/followup-recovery'
NATIVE_PATHS = {'src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-ranked-workshop.ts'}
EXCLUDED_TESTS = {
    'tests/v6-ranked-workshop-reference.test.ts',
    'tests/v6-ranked-workshop-kernel.test.ts',
    'tests/v6-symbol-transactions-kernel.test.ts',
    'tests/v6-framed-transfer-reference.test.ts',
}
REQUIRED_TESTS = {
    'tests/v6-ranked-workshop-grounded-inquiry.test.ts',
    'tests/v6-stationary-contact-continuation.test.ts',
    'tests/v6-workshop-cold-caller-continuation.test.ts',
    'tests/v6-workshop-followup-source.test.ts',
    'tests/v6-animated-contact.test.ts',
    'tests/v6-program-control-discovery-integration.test.ts',
    'tests/v6-typed-material-kernel.test.ts',
}
COUNT_KEYS = {'tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'}
GATES = ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
INHERITED_REGRESSION_GAMES = ['CATR', 'RSWP', 'FOGW', 'VOIS', 'CONN', 'MIND', 'WEAV', 'TRIA', 'CRAF', 'ISOS']
REGRESSION_GAMES = [*INHERITED_REGRESSION_GAMES, 'KATA']
REGRESSION_COUNT, REGRESSION_CHECKS = 11, 187
BUILD_EXTRAS = ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html', '.openai/hosting.json',
                'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
                'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs']
REGRESSION_TOOLS = {'scripts/run-released-public-regressions.py', 'scripts/run-recorded-public-regressions.py',
                    'scripts/compare-v54-regressions.py', 'scripts/replay-public-regression-released-baseline.mjs',
                    'scripts/replay-v53-public-regression.mjs', 'scripts/run-v53-campaign-proof.py',
                    'tests/helpers/v6-live-game-campaign.ts', 'scripts/run-released-public-regressions-streamlog.py'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def local(value):
    path = (ROOT / value).resolve()
    require(path.is_relative_to(ROOT), 'Path escapes checkout: ' + str(value))
    return path


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def fp(path):
    path = local(path)
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}


def read(path):
    path = local(path)
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timestamp must specify a timezone')
    return result


def inventory(checkout=ROOT):
    files = dict(sorted((p.relative_to(checkout).as_posix(), sha(p))
                        for folder in ('src/logos-engine', 'src/runtime')
                        for p in (checkout / folder).rglob('*')
                        if p.is_file() and p.suffix in ('.ts', '.json', '.drm')))
    return {'fileCount': len(files), 'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(), 'files': files}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--performance-directory', type=Path, default=BASE / 'performance')
    parser.add_argument('--candidate-source-directory', type=Path, default=BASE / 'integrated-final')
    parser.add_argument('--validation-directory', type=Path, default=Path('validation'),
                        help='Completed test/build receipt directory confined inside the candidate source directory.')
    parser.add_argument('--baseline-publication-receipt', type=Path, default=BASE / 'coordination/baseline-publication.json')
    parser.add_argument('--baseline-regression-manifest', type=Path,
                        default=ROOT / 'docs/migration/lot6a-evidence/integrated-final-02/regression-cases.json',
                        help='Exact regression declaration tracked by the actual published baseline commit.')
    parser.add_argument('--prepared-regression-manifest', type=Path,
                        default=BASE / 'coordination/prepared-6a-regression-cases.json',
                        help='Retained exact eleven-case 6A declaration observed before follow-up replay.')
    parser.add_argument('--prepared-native-manifest', type=Path,
                        default=BASE / 'coordination/prepared-6a-source-manifest.json')
    parser.add_argument('--prepared-source-observation', type=Path,
                        default=BASE / 'coordination/prepared-6a-source-observation.json')
    parser.add_argument('--test-scope-plan', type=Path, default=BASE / 'contract/test-scope.json')
    parser.add_argument('--recovery-record', type=Path, default=BASE / 'coordination/recovery.json')
    parser.add_argument('--case-clock-record', type=Path, default=BASE / 'coordination/lkey-closed-clock.json')
    parser.add_argument('--isolation-receipt', type=Path, default=BASE / 'coordination/quiet-window.json')
    args = parser.parse_args()
    perf, candidate_dir = local(args.performance_directory), local(args.candidate_source_directory)
    require(perf.is_relative_to(BASE) and candidate_dir.is_relative_to(BASE), 'Follow-up outputs must remain in their own evidence directory')
    validation_dir = (candidate_dir / args.validation_directory).resolve()
    require(validation_dir.is_relative_to(candidate_dir), 'Validation receipts escape the candidate directory')
    output = perf / 'readiness.json'
    require(not output.exists() and not (perf / 'window.json').exists(), 'Readiness or official window already exists')
    require(not any(perf.glob('cohort*/*.json')), 'Official measurements already exist')
    inputs, external_inputs = {}, {}

    def keep(path):
        record = fp(path)
        previous = inputs.setdefault(record['path'], record)
        require(previous == record, 'Input changed while finalizing: ' + record['path'])
        return record

    def load(path):
        keep(path)
        return read(path)

    def checked(record, exact=True):
        require(isinstance(record, dict) and 'path' in record and 'sha256' in record, 'Missing fingerprint')
        actual = keep(record['path'])
        require(actual == record if exact else actual['sha256'] == record['sha256']
                and ('bytes' not in record or actual['bytes'] == record['bytes']), 'Fingerprint mismatch: ' + record['path'])
        return local(record['path'])

    def input_names(folders, extras=()):
        return {p.relative_to(ROOT).as_posix() for folder in folders for p in (ROOT / folder).rglob('*') if p.is_file()} | {
            name for name in extras if local(name).is_file()}

    def checked_map(values, label):
        require(isinstance(values, dict) and values, 'Missing input map: ' + label)
        for name, expected in values.items():
            require(isinstance(expected, str) and re.fullmatch(r'[0-9a-f]{64}', expected), 'Invalid input digest: ' + name)
            require(keep(name)['sha256'] == expected, label + ' input changed: ' + name)

    declaration = load(perf / 'declaration.json')
    policy = load(perf / 'global-budget-policy.json')
    preparation = load(perf / 'preparation.json')
    static = load(perf / 'static-preflight.json')
    protocol_check = load(perf / 'protocol-check.json')
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration['status'] == 'declared_before_official_window'
            and declaration['noOfficialWindowAtDeclaration'] is True, 'Protocol was not declared before measurement')
    require('ownerCostQualification' not in declaration, 'This two-file follow-up permits no structural work exemptions')
    for key in ('protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy', 'baselineManifest',
                'candidateManifest', 'candidateArchiveManifest', 'globalDecisionTool', 'globalCalculationTool'):
        checked(declaration[key])
    for record in declaration['officialTools']:
        checked(record)
    require(policy['globalStage'] == 'session_elapsed' and policy['comparison'] == 'strictly_less_than'
            and policy['relativeIncreaseLimit'] == 0.1 and policy['caseIds'] == ['STCK', 'SMLP'], 'Global criterion differs from user rule')
    require(policy['allCasesMustPass'] is True and policy['crossCaseCompensation'] is False
            and policy['excludedMeasuredSessions'] == policy['excludedOutliers'] == 0,
            'Global acceptance cannot compensate cases or exclude measured samples')
    for key, expected in [('measuredSessions', 32), ('measuredActions', 400), ('excludedWarmupSessions', 8), ('excludedWarmupActions', 24)]:
        require(policy[key] == declaration[key] == expected, 'Declared population changed: ' + key)
    require(declaration['phaseOverrunsBlockAcceptance'] is False, 'Phase excess must remain diagnostic')
    require(declaration['baseline'] == policy['baseline'] == preparation['baseline']
            and declaration['candidate'] == policy['candidate'] == preparation['candidate'], 'Declared identities differ')
    require(static['status'] == 'static_inputs_checked' and static['checkedCount'] == len(static['checks']) > 0
            and all(row['satisfied'] is True for row in static['checks']) and static['unsatisfied'] == [], 'Static preflight incomplete')
    require(static['declaration'] == fp(perf / 'declaration.json') and static['candidateFreeze'] == declaration['candidateManifest'], 'Static preflight names another declaration/freeze')
    checked(static['generator'])
    require(protocol_check['status'] == 'protocol_contract_passed' and protocol_check['nativeDigests'] == declaration['nativeDigests'], 'Protocol checker does not bind these sources')

    baseline = load(declaration['baselineManifest']['path'])
    candidate = load(candidate_dir / 'source-manifest.json')
    archive = load(candidate_dir / 'source-archive.json')
    digest = candidate['digest']
    require(candidate == inventory(), 'Current native source differs from final freeze')
    require(declaration['candidateManifest'] == fp(candidate_dir / 'source-manifest.json')
            and declaration['candidateArchiveManifest'] == fp(candidate_dir / 'source-archive.json'), 'Final source directory differs from declaration')
    require(declaration['nativeDigests'] == {'baseline': baseline['digest'], 'candidate': digest}, 'Native identities differ')
    require(set(baseline['files']) == set(candidate['files']), 'Follow-up unexpectedly added or removed native files')
    changes = {name for name in candidate['files'] if candidate['files'][name] != baseline['files'][name]}
    require(changes == NATIVE_PATHS, 'Follow-up must change exactly the runtime and existing Workshop owner against its actual published baseline')
    require(archive['nativeSourceManifestDigest'] == digest
            and all(archive['files'].get(name) == value for name, value in candidate['files'].items()), 'Archive omits current native source')
    checked(archive['archive'])
    checked_map(archive['files'], 'Frozen archive')
    archive_parts = load(candidate_dir / 'source-archive-parts.json')
    require(archive_parts['original'] == archive['archive'], 'Frozen archive parts identify another source')
    for record in archive_parts['parts']:
        checked(record)

    publication = load(args.baseline_publication_receipt)
    require(publication['status'] == 'verified' and publication['deploymentStatus'] == 'succeeded', 'Actual baseline publication is unverified')
    for key in ('siteVersion', 'nativeVersion', 'commit', 'nativeDigest'):
        require(publication[key] == policy['baseline'][key], 'Published baseline identity differs: ' + key)
    require(type(publication['siteVersion']) is int and publication['siteVersion'] > 0
            and re.fullmatch(r'[0-9a-f]{40}', publication['commit']), 'Published source identity is incomplete')
    baseline_checkout = Path(preparation['baselineCheckout']).resolve()
    require(baseline_checkout != ROOT and baseline_checkout.is_dir()
            and inventory(baseline_checkout) == baseline, 'Current baseline source differs from published freeze')
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=baseline_checkout, text=True).strip()
            == publication['commit'], 'Current baseline HEAD differs from actual publication')
    for name, expected in baseline['files'].items():
        path = (baseline_checkout / name).resolve()
        require(path.is_relative_to(baseline_checkout) and sha(path) == expected, 'Baseline native input changed: ' + name)
        external_inputs[str(path)] = {'path': str(path), 'sha256': expected, 'bytes': path.stat().st_size}
    prepared_native_path = local(args.prepared_native_manifest)
    prepared_native = load(prepared_native_path)
    prepared_source_observation = load(args.prepared_source_observation)
    require(prepared_source_observation['schema'] == 'logos-engine.followup-prepared-predecessor-snapshot.v1'
            and prepared_source_observation['status'] == 'prepared_source_snapshot_only'
            and prepared_source_observation['predecessorLane'] == '6A'
            and prepared_source_observation['sourceStableBeforeAndAfterCapture'] is True,
            'Prepared6A source observation is missing or not a stable snapshot')
    require(prepared_native == baseline
            and prepared_source_observation['frozenNativeDigest'] == baseline['digest'] == publication['nativeDigest']
            and prepared_source_observation['nativeFileCount'] == baseline['fileCount']
            and prepared_source_observation['nativeVersion'] == publication['nativeVersion']
            and prepared_source_observation['sourceFreeze']['sha256'] == fp(prepared_native_path)['sha256'],
            'Actual published baseline native source differs from the exact prepared6A source integrated and tested by this candidate')
    prepared_freeze_name = prepared_source_observation['sourceFreeze']['path']
    published_native_manifest_bytes = subprocess.check_output(
        ['git', 'show', publication['commit'] + ':' + prepared_freeze_name], cwd=baseline_checkout)
    require(published_native_manifest_bytes == prepared_native_path.read_bytes(),
            'Prepared6A native manifest is not the exact freeze tracked by its actual published commit')

    recovery = load(args.recovery_record)
    require(recovery['unpublishedSourceRecovered'] is False and recovery['unpublishedRawProofsRecovered'] is False
            and recovery['historicalObservationsReusedAsProof'] is False, 'Missing unpublished evidence must stay explicitly unverified')
    clock = load(args.case_clock_record)
    require(clock['case'] == 'LKEY' and clock['state'] == 'closed' and clock['clockReset'] is False
            and clock['newCaseActivity'] is False, 'LKEY clock must remain closed without new activity')
    require(math.isclose(clock['cumulativeSeconds'], 2390.347106991, abs_tol=1e-9, rel_tol=0)
            and math.isclose(clock['remainingSeconds'], 9.652893009, abs_tol=1e-8, rel_tol=0), 'Cumulative LKEY budget changed or reset')

    validation_retry_path = BASE / 'tools/validation-retry-amendment.json'
    validation_retry = load(validation_retry_path)
    require(validation_retry['schema'] == 'logos-engine.followup-validation-retry-amendment.v1'
            and validation_retry['after'] == fp(Path(__file__))
            and validation_retry['beforeAnyOfficialCost'] is True
            and validation_retry['beforeAnyFunctionalCostCapture'] is True
            and validation_retry['nativeSourceManifestDigest'] == digest
            and validation_retry['selectedValidationDirectory'] == validation_dir.relative_to(candidate_dir).as_posix(),
            'Validation retry amendment does not identify this helper, source or selected receipt directory')
    checked(validation_retry['beforeRetainedCopy'])
    require(validation_retry['beforeRetainedCopy']['sha256'] == validation_retry['before']['sha256'],
            'The audited pre-retry helper bytes were not retained exactly')
    checked(validation_retry['historicalReview'])
    failed_tests = load(checked(validation_retry['failedValidationReceipt']))
    require(failed_tests['schema'] == 'logos-engine.native-delta-verification.v1'
            and failed_tests['status'] == 'failed' and failed_tests['nativeSource'] == candidate
            and failed_tests['nativeSourceUnchanged'] is True
            and failed_tests['sourceAndTestInputsUnchanged'] is True
            and failed_tests['checks'][0]['counts'] == validation_retry['failedCounts'],
            'The preserved first validation failure differs or used another native source')
    checked(failed_tests['checks'][0]['output'])
    scope = load(args.test_scope_plan)
    tests = load(validation_dir / 'delta-tests-run.json')
    checks = load(validation_dir / 'checks-run.json')
    for value, names in [(tests, ['delta-tests']), (checks, GATES)]:
        require(value['schema'] == 'logos-engine.native-delta-verification.v1' and value['status'] == 'passed'
                and value['nativeSource'] == candidate and value['nativeSourceManifestDigest'] == digest
                and value['nativeSourceUnchanged'] is True and [row['name'] for row in value['checks']] == names,
                'Fresh formal verification is incomplete or binds another freeze')
        checked(value['generator'])
        for row in value['checks']:
            require(row['exitCode'] == 0, 'A formal verification failed')
            checked(row['output'])
    test_files = tests['testFiles']
    require(test_files == failed_tests['testFiles'], 'Validation retry must preserve the exact full test-file scope')
    before_test_inputs, after_test_inputs = failed_tests['sourceAndTestInputs'], tests['sourceAndTestInputs']
    require(set(before_test_inputs) == set(after_test_inputs), 'Validation retry changed source/test inventory membership')
    changed_test_inputs = {name for name in before_test_inputs if before_test_inputs[name] != after_test_inputs[name]}
    expected_test_changes = validation_retry['correctedTestFiles']
    require(changed_test_inputs == set(expected_test_changes)
            == {'tests/v6-coupled-pair-planning.test.ts', 'tests/v6-radial-port-integration.test.ts'},
            'Validation retry must change only the two declared stale registry assertions')
    for name, change in expected_test_changes.items():
        require(before_test_inputs[name] == change['beforeSha256'] and after_test_inputs[name] == change['afterSha256'],
                'Corrected test bytes differ from the declared predecessor checkpoint: ' + name)
    require(scope['testFiles'] == test_files and scope.get('nativeSourceManifestDigest', scope.get('frozenDigest')) == digest,
            'Formal tests differ from the prospective source-bound scope')
    require(instant(scope['declaredAt']) <= instant(tests['checks'][0]['startedAt']), 'Test scope was not declared before formal execution')
    require(len(test_files) == len(set(test_files)) and REQUIRED_TESTS <= set(test_files)
            and not EXCLUDED_TESTS.intersection(test_files), 'Required generic contracts missing or closed-case fixture tests selected')
    inherited = load(ROOT / 'docs/migration/lot5b-evidence/integrated-final/validation/delta-tests-run.json')
    inherited_safe = set(inherited['testFiles']) - EXCLUDED_TESTS
    require(len(inherited['testFiles']) == 125 and len(inherited_safe) == 122 and inherited_safe <= set(test_files),
            'Fresh scope omits an inherited safe contract')
    for name in test_files:
        code = local(name).read_text()
        require('v6-ranked-workshop-reference.json' not in code and 'v6-linked-packet-initial-public.json' not in code
                and 'v6-framed-transfer-original-lkey-public' not in code,
                'Fresh test eagerly references a closed-case payload: ' + name)
        require(tests['sourceAndTestInputs'][name] == sha(local(name)), 'Formal test source changed')
        keep(name)
    require(tests['sourceAndTestInputsUnchanged'] is True, 'Source/test inputs changed during formal execution')
    # Opaque file integrity only: archived fixtures are hashed, never decoded,
    # selected, interpreted or executed by this readiness verifier.
    require(set(tests['sourceAndTestInputs']) == input_names(('src', 'tests')), 'Source/test file inventory changed after formal checks')
    checked_map(tests['sourceAndTestInputs'], 'Formal source/test')
    require(set(checks['buildInputs']) == input_names(('src', 'public', 'content'), BUILD_EXTRAS), 'Build input membership changed')
    checked_map(checks['buildInputs'], 'Build')
    counts = tests['checks'][0]['counts']
    require(counts['tests'] == failed_tests['checks'][0]['counts']['tests'], 'Validation retry changed the number of executed tests')
    require(set(counts) == COUNT_KEYS and all(type(n) is int and n >= 0 for n in counts.values())
            and counts['tests'] == counts['pass'] > 0 and all(counts[k] == 0 for k in COUNT_KEYS - {'tests', 'pass'})
            and tests['checks'][0]['tapSummaryComplete'] is True, 'Fresh TAP summary is not a full pass')
    tap = gzip.decompress(local(tests['checks'][0]['output']['path']).read_bytes()).decode()
    require(all(re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M) == [str(counts[key])] for key in COUNT_KEYS), 'Fresh TAP totals differ from retained output')
    audit = read(checks['checks'][2]['output']['path'])
    require(audit['failures'] == [], 'Migration audit has unresolved failures')
    checked(checks['nativeAgentWorker'])
    require({p.resolve() for p in (ROOT / 'dist/assets').glob('v6-agent-worker-*.js')} == {
        local(checks['nativeAgentWorker']['path'])}, 'Built native worker set changed')

    regression = load(candidate_dir / 'regressions/regression-summary.json')
    require(regression['schema'] == 'logos-engine.recorded-public-regressions.v1' and regression['status'] == 'passed'
            and regression['nativeSource'] == regression['nativeSourceAfter'] == candidate
            and regression['executionInputsUnchanged'] is True and regression['maximumConcurrentReplays'] == 1
            and regression['passed'] == regression['total'] == len(regression['results']) == REGRESSION_COUNT
            and regression['comparisonChecksPassed'] == regression['comparisonChecksExpected'] == REGRESSION_CHECKS,
            'Eleven fresh strict public regressions are incomplete')
    regression_manifest = load(checked(regression['caseManifest']))
    expected_regression_inputs = REGRESSION_TOOLS | {regression['caseManifest']['path'], declaration['candidateManifest']['path']}
    require(set(regression['executionInputs']) == expected_regression_inputs
            and regression['executionInputs'] == regression['executionInputsAfter'], 'Regression execution input set changed')
    checked_map(regression['executionInputs'], 'Regression execution')
    require([row['game'] for row in regression_manifest['cases']] == REGRESSION_GAMES,
            'Regression declaration changed or includes the closed case')
    inherited_manifest = load(ROOT / 'docs/migration/lot5b-evidence/integrated-final/regression-cases.json')
    require([row['game'] for row in inherited_manifest['cases']] == INHERITED_REGRESSION_GAMES
            and regression_manifest['cases'][:10] == inherited_manifest['cases'],
            'The ten published Site95 public regression inputs must remain exact')
    prepared_regression_path = local(args.prepared_regression_manifest)
    prepared_regression = load(prepared_regression_path)
    amendment_path = BASE / 'tools/readiness-scope-amendment.json'
    amendment = load(amendment_path)
    require(amendment['schema'] == 'logos-engine.followup-readiness-scope-amendment.v1'
            and amendment['beforeAnyOwnRegression'] is True and amendment['beforeAnyOfficialCost'] is True
            and amendment['after'] == validation_retry['before']
            and amendment['after']['sha256'] != amendment['before']['sha256'],
            'Prospective eleven-case readiness amendment is missing or identifies another helper')
    require(validation_retry['priorScopeAmendment'] == fp(amendment_path)
            and instant(amendment['recordedAt']) <= instant(validation_retry['recordedAt']),
            'Validation retry does not preserve the original eleven-case amendment chain')
    require(amendment['prepared6aRegressionManifest']['retainedCopy'] == fp(prepared_regression_path),
            'Retained prepared6A declaration differs from the prospective amendment')
    checked(amendment['historicalReview'])
    require(prepared_regression['schema'] == regression_manifest['schema'] == 'logos-engine.recorded-public-regression-cases.v1'
            and regression_manifest['cases'] == prepared_regression['cases']
            and prepared_regression['cases'][-1]['id'] == 'kata-060-self-consistency'
            and prepared_regression['cases'][-1]['game'] == 'KATA'
            and prepared_regression['cases'][-1]['comparisonBasis'] == 'fresh_current_native_self_consistency',
            'KATA must preserve the exact prepared6A public trajectory and its qualified comparison basis')
    baseline_regression_path = local(args.baseline_regression_manifest)
    baseline_regression = load(baseline_regression_path)
    require(baseline_regression['schema'] == prepared_regression['schema']
            and baseline_regression['cases'] == regression_manifest['cases'] == prepared_regression['cases'],
            'Actual published baseline regression declaration differs from the prepared and replayed eleven cases')
    baseline_regression_name = baseline_regression_path.relative_to(ROOT).as_posix()
    baseline_regression_actual = (baseline_checkout / baseline_regression_name).resolve()
    require(baseline_regression_actual.is_relative_to(baseline_checkout)
            and baseline_regression_actual.read_bytes() == baseline_regression_path.read_bytes(),
            'Retained baseline regression declaration differs from actual baseline checkout bytes')
    published_regression_bytes = subprocess.check_output(
        ['git', 'show', publication['commit'] + ':' + baseline_regression_name], cwd=baseline_checkout)
    require(published_regression_bytes == baseline_regression_path.read_bytes(),
            'Baseline regression declaration is not the exact file tracked by its actual published commit')
    external_inputs[str(baseline_regression_actual)] = {
        'path': str(baseline_regression_actual), 'sha256': sha(baseline_regression_actual),
        'bytes': baseline_regression_actual.stat().st_size}
    for value in (regression_manifest, prepared_regression, baseline_regression):
        require(value['expectedChecksPerCase'] == 17 and value['expectedComparisonChecks'] == REGRESSION_CHECKS
                and value['strictComparator'] == inherited_manifest['strictComparator']
                and value['strictComparisonCheckNames'] == inherited_manifest['strictComparisonCheckNames']
                and value['passiveOwnerRequirements'] == inherited_manifest['passiveOwnerRequirements'],
                'Eleven-case extension must preserve all seventeen strict comparisons without exemptions')
    first_regression_start = min(instant(row['startedAt']) for row in regression['results'])
    require(instant(amendment['recordedAt']) <= first_regression_start
            and instant(regression_manifest['declaredAt']) <= first_regression_start,
            'The eleven-case scope and helper amendment must precede every fresh regression execution')
    require([row['game'] for row in regression['results']] == REGRESSION_GAMES
            and [row['case'] for row in regression['results']] == [row['id'] for row in regression_manifest['cases']],
            'Fresh regression results omit, duplicate or reorder a declared case')
    for row, declared_case in zip(regression['results'], regression_manifest['cases']):
        require(row['game'] in REGRESSION_GAMES and row['status'] == 'passed' and row['passed'] is True
                and row['exitCode'] == 0 and row['timedOut'] is False and row['comparisonPassed'] is True
                and row['failedChecks'] == [] and row['comparisonChecks'] == 17
                and row['nativeSourceBeforeDigest'] == row['nativeSourceAfterDigest'] == digest
                and row['nativeSourceUnchanged'] is True and row['immutableInputsUnchanged'] is True,
                'A scoped regression failed or changed inputs')
        for key in ('baseline', 'trace'):
            require(all(row[key][field] == declared_case[key][field] for field in ('path', 'sha256')),
                    'Regression used another declared ' + key + ': ' + row['case'])
        for key in ('baseline', 'trace', 'output', 'report', 'comparison', 'execution', 'passiveOwnerPresence'):
            checked(row[key], exact=False)
        comparison = load(row['comparison']['path'])
        require(comparison['passed'] is True and len(comparison['checks']) == 17
                and all(item['passed'] is True for item in comparison['checks']), 'A strict comparison is incomplete')

    integrity = load(candidate_dir / 'delivery-integrity.json')
    require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1' and integrity['status'] == 'passed'
            and integrity['nativeSourceDigest'] == digest and integrity['tests'] == counts
            and integrity['validationDirectory'] == validation_dir.relative_to(ROOT).as_posix()
            and integrity['originalSourceFilesUnchanged'] == 1786
            and integrity['regressions']['passed'] == REGRESSION_COUNT
            and integrity['regressions']['comparisonChecksPassed'] == REGRESSION_CHECKS,
            'Final delivery integrity does not bind all fresh evidence')
    require(all(fp(validation_dir / name) in integrity['receipts'] for name in ('delta-tests-run.json', 'checks-run.json')),
            'Delivery integrity does not bind the exact selected validation attempt receipts')
    for record in [integrity['generator'], *integrity['verificationHelpers'], *integrity['receipts']]:
        checked(record)
    original_manifest_path = checked(integrity['originalSourceManifest'])
    require(original_manifest_path == ROOT / 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/manifest.json',
            'Original source pin differs')
    original_manifest = load(original_manifest_path)
    require(len(original_manifest['files']) == 1786, 'Original source inventory count changed')
    for name, item in original_manifest['files'].items():
        path = (original_manifest_path.parent / 'source' / name).resolve()
        require(path.is_relative_to(original_manifest_path.parent / 'source'), 'Original manifest path escapes source pin')
        require(keep(path)['sha256'] == item['sha256'], 'Original source bytes changed: ' + name)

    forms_path = perf / 'strict-work-forms.json'
    forms = load(forms_path)
    capture = load(perf / 'strict-work-capture.json')
    work_declaration = load(perf / 'strict-work-declaration.json')
    require(forms['schema'] == 'logos-engine.followup-strict-cost-forms.v1' and forms['status'] == capture['status'] == 'passed'
            and forms['sourceAndInputsUnchanged'] is True and forms['comparison'] == 'exact_deep_equality_no_exemptions'
            and forms['functionalSessions'] == len(forms['captures']) == 8 and forms['functionalActions'] == 62
            and forms['measuredCostSessions'] == forms['timingMetricsRetained'] == 0
            and forms['nativeDigests'] == declaration['nativeDigests'] and capture['forms'] == fp(forms_path),
            'Prospective exact work forms are incomplete')
    require(forms['cases'] == declaration['cases'] and forms['declaration'] == fp(perf / 'strict-work-declaration.json')
            and forms['sourceManifests'] == {'baseline': declaration['baselineManifest'], 'candidate': declaration['candidateManifest']}
            and work_declaration['comparison'] == forms['comparison']
            and instant(work_declaration['declaredAt']) <= instant(forms['startedAt']) <= instant(forms['finishedAt']),
            'Work-form declaration does not precede the matching capture')
    require(instant(validation_retry['recordedAt']) <= instant(forms['startedAt']),
            'Validation receipt selection must be declared before the functional cost capture')
    expected_forms = [('STCK', True, 3), ('STCK', False, 10), ('SMLP', True, 3), ('SMLP', False, 15)]
    require([(row['case'], row['warmup'], row['actions']) for row in forms['forms']] == expected_forms, 'Missing exact warmup/full work forms')
    for form in forms['forms']:
        signature_hash = hashlib.sha256(json.dumps(form['signature'], sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
        require(signature_hash == form['signatureSha256'], 'Work-form signature digest differs')
        for role in ('baseline', 'candidate'):
            captures = [row for row in forms['captures'] if row['role'] == role and row['case'] == form['case'] and row['warmup'] == form['warmup']]
            require(len(captures) == 1 and captures[0]['signature'] == form['signature']
                    and captures[0]['signatureSha256'] == signature_hash, 'A/B work forms differ')
    for record in [forms['generator'], forms['workSignatureTool'], *forms['inputs']]:
        checked(record)
    for record in forms['watchedExternalInputs']:
        path = Path(record['path']).resolve()
        require(path.is_absolute() and path.is_relative_to(baseline_checkout)
                and sha(path) == record['sha256'] and path.stat().st_size == record['bytes'], 'External baseline form input changed')
        previous = external_inputs.setdefault(record['path'], record)
        require(previous == record, 'External baseline input records conflict')
    for name in ('capture-strict-cost-forms.mjs', 'verify-strict-cost-forms.mjs', 'finalize-cost-readiness.py'):
        keep(BASE / 'tools' / name)

    isolation = load(args.isolation_receipt)
    require(isolation['status'] == 'acknowledged_quiet_before_window' and isolation['otherLaneAcknowledged'] is True
            and isolation['ownTrackedComputeEnded'] is True and isolation['previewStopped'] is True
            and isolation['costNodeOptionsOverride'] is None, 'Cooperative quiet window is not acknowledged')
    require(isolation['nativeDigests'] == declaration['nativeDigests']
            and isolation['performanceDirectory'] == perf.relative_to(ROOT).as_posix()
            and set(isolation['acknowledgedLanes']) == {'6A', '10B', '5C'}
            and len(isolation['acknowledgedLanes']) == 3 and bool(isolation['evidence']),
            'Quiet acknowledgment must name this source/window and current parallel lanes')
    for record in isolation.get('evidence', []):
        checked(record)
    finalized = datetime.now(timezone.utc)
    completed = [instant(forms['finishedAt']), instant(integrity['recordedAt'])]
    completed += [instant(row['finishedAt']) for value in (tests, checks) for row in value['checks']]
    completed += [instant(row.get('postprocessingFinishedAt', row['finishedAt'])) for row in regression['results']]
    require(max(completed) <= instant(isolation['recordedAt']) <= finalized,
            'The actual quiet acknowledgment must follow completed functional work and precede readiness')
    require(instant(declaration['finalizedAt']) <= instant(static['recordedAt']) <= finalized
            and instant(forms['finishedAt']) <= finalized
            and all(instant(row['finishedAt']) <= finalized for value in (tests, checks) for row in value['checks']),
            'Evidence is not completed before readiness')
    for record in inputs.values():
        require(fp(record['path']) == record, 'Input changed before readiness finalization')
    for record in external_inputs.values():
        path = Path(record['path'])
        require(sha(path) == record['sha256'] and path.stat().st_size == record['bytes'], 'External baseline input changed during readiness')
    require(set(tests['sourceAndTestInputs']) == input_names(('src', 'tests'))
            and set(checks['buildInputs']) == input_names(('src', 'public', 'content'), BUILD_EXTRAS),
            'Source/test/build membership changed during readiness')
    require(candidate == inventory() and inventory(baseline_checkout) == baseline
            and subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=baseline_checkout, text=True).strip() == publication['commit']
            and not output.exists() and not (perf / 'window.json').exists(), 'Source changed or measurement started during verification')
    finalized = datetime.now(timezone.utc)
    result = {'schema': 'logos-engine.native-cost-window-readiness.v1', 'status': 'ready',
        'finalizedAt': finalized.isoformat(), 'measurementAuthorized': True, 'pendingRequirements': [],
        'generator': fp(Path(__file__)), 'nativeVersion': policy['candidate']['nativeVersion'], 'nativeSourceDigest': digest,
        'baseline': policy['baseline'], 'candidate': policy['candidate'], 'nativeChanges': sorted(changes),
        'formalTests': counts, 'formalTestFiles': len(test_files), 'regressionChecks': REGRESSION_CHECKS,
        'validationDirectory': validation_dir.relative_to(ROOT).as_posix(), 'validationRetryAmendment': fp(validation_retry_path),
        'regressionScopeAmendment': fp(amendment_path), 'preparedRegressionManifest': fp(prepared_regression_path),
        'baselineRegressionManifest': fp(baseline_regression_path),
        'preparedNativeManifest': fp(prepared_native_path), 'preparedSourceObservation': fp(args.prepared_source_observation),
        'strictWorkForms': fp(forms_path), 'strictPostWindowVerifier': fp(BASE / 'tools/verify-strict-cost-forms.mjs'),
        'functionalScope': 'Fresh generic synthetic Workshop/current-caller contracts plus inherited safe tests and eleven strict public regressions, including the exact new6A KATA public trajectory.',
        'closedCase': clock, 'recoveryDisclosure': recovery,
        'reserves': ['Unpublished pre-replacement source and raw evidence were not recovered; historical chat observations are not proof of these bytes.',
                     'No fresh LKEY action, replay, oracle, fixture payload analysis, browser proof or complete original-caller parity is claimed.',
                     'The native continuation coordination is an explicit extension, not a claim of original Python caller parity.'],
        'inputs': list(inputs.values()), 'watchedExternalInputs': list(external_inputs.values()), 'isolation': isolation,
        'qualification': 'Prospective readiness for a reconstructed two-file follow-up. Only completed current-source evidence is accepted. '
            'All40 official trials must later match the predeclared work forms; no post-measurement structural exemption is allowed. '
            'The global pooled complete-session median must be strictly below+10% separately for STCK and SMLP; phase excess remains diagnostic.'}
    with output.open('x') as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')
    print(json.dumps({'status': result['status'], 'output': output.relative_to(ROOT).as_posix(),
                      'testFiles': len(test_files), 'tests': counts['pass'], 'regressionChecks': REGRESSION_CHECKS,
                      'functionalSessions': 8, 'measurementExecuted': False}))


if __name__ == '__main__':
    main()
