#!/usr/bin/env python3
"""Declare and verify the reconstructed follow-up's strict publication inputs.

Run --declare before the official window, then commit this tool and its
declaration. Commit the successful functional forms and readiness before the
candidate B reports record their Git heads. After the official window, run the
strict-work verifier successfully BEFORE the unchanged renderer, then run this
tool without --declare. No mode runs tests, games, builds or measurements.
Verification reuses unchanged delivery helpers and the original global rule.
It performs read-only Git checks and writes one exclusive provenance receipt;
it does not push source or deploy a Site. No owner qualification is supported.
Use --recheck after the final full transport checkout/package. It preserves the
original receipt, checks the current committed source/build again, and prints
the final binding for retention outside this checkout before Site deployment.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import io
import json
import math
from pathlib import Path
import re
import statistics
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / 'docs/migration/lot7b-evidence/followup-recovery'
LOT = ROOT / 'docs/migration/lot7b-evidence'
SCRIPT = Path(__file__).resolve()
ORDER = ['A1', 'B1', 'B2', 'A2']
GAMES = ['CATR', 'RSWP', 'FOGW', 'VOIS', 'CONN', 'MIND', 'WEAV', 'TRIA', 'CRAF', 'ISOS', 'KATA']
POPULATION = {'measuredSessions': 32, 'measuredActions': 400,
              'excludedWarmupSessions': 8, 'excludedWarmupActions': 24}
TOOLS = {
    'delivery': 'scripts/verify-native-delivery.py',
    'campaign': 'scripts/run-v53-campaign-proof.py',
    'original': 'scripts/compare-v54-reactive-public-evidence.py',
    'transport': 'scripts/evidence-byte-parts.py',
    'restore': 'scripts/restore-v53-evidence.py',
    'globalReview': 'scripts/review-native-global-cost-window.py',
    'globalCalculation': 'scripts/review-native-global-cost-budget.py',
    'arithmeticReview': 'scripts/review-native-cost-consolidation.py',
    'workSignature': 'scripts/compare-native-cost-cohorts.mjs',
    'renderer': 'docs/migration/lot7b-evidence/write-cost-results.py',
    'logTransport': 'docs/migration/lot7b-evidence/record-cost-log-transport.py',
    'readiness': 'docs/migration/lot7b-evidence/followup-recovery/tools/finalize-cost-readiness.py',
    'capture': 'docs/migration/lot7b-evidence/followup-recovery/tools/capture-strict-cost-forms.mjs',
    'strictVerifier': 'docs/migration/lot7b-evidence/followup-recovery/tools/verify-strict-cost-forms.mjs',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def local(value, boundary=ROOT):
    path = Path(value)
    require('..' not in path.parts and '\\' not in str(value), 'Unsafe input path')
    if not path.is_absolute():
        path = ROOT / path
    require(path != boundary and path.is_relative_to(boundary), 'Input escapes its declared directory: ' + str(value))
    current = boundary
    require(not current.is_symlink(), 'Symlink boundary is unsupported')
    for part in path.relative_to(boundary).parts:
        current /= part
        require(not current.is_symlink(), 'Symlink input is unsupported: ' + str(current))
    require(path.resolve().is_relative_to(boundary.resolve()), 'Resolved input escapes its directory')
    return path


def digest_file(path):
    digest, size = hashlib.sha256(), 0
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
            size += len(chunk)
    return {'sha256': digest.hexdigest(), 'bytes': size}


def fp(value):
    path = local(value)
    return {'path': path.relative_to(ROOT).as_posix(), **digest_file(path)}


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timestamp lacks an explicit timezone')
    return result


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, 'Duplicate JSON key: ' + key)
        value[key] = item
    return value


def json_file(path):
    def invalid_constant(value):
        raise ValueError('Non-finite JSON constant: ' + value)
    return json.loads(path.read_bytes(), object_pairs_hook=unique_object, parse_constant=invalid_constant)


def exclusive(path, value):
    require(path.parent.is_dir(), 'Output directory must already exist')
    with path.open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')


def load_helper(name, path):
    spec = importlib.util.spec_from_file_location(name, local(path))
    require(spec is not None and spec.loader is not None, 'Cannot load retained verifier')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git(*arguments, cwd=ROOT):
    return subprocess.check_output(['git', *arguments], cwd=cwd)


def verify_git_native(commit, manifest, cwd=ROOT):
    """Hash opaque committed native blobs; never import or interpret them."""
    require(re.fullmatch(r'[0-9a-f]{40}', commit), 'Invalid native source commit')
    rows = []
    for record in git('ls-tree', '-r', '-z', '--full-tree', commit, '--',
                      'src/logos-engine', 'src/runtime', cwd=cwd).split(b'\0'):
        if not record:
            continue
        metadata, name_bytes = record.split(b'\t', 1)
        name = name_bytes.decode('utf-8')
        if Path(name).suffix not in ('.ts', '.json', '.drm'):
            continue
        mode, kind, oid = metadata.split()
        require(mode in (b'100644', b'100755') and kind == b'blob'
                and re.fullmatch(rb'[0-9a-f]{40}', oid), 'Committed native input is not a regular blob')
        rows.append((name, oid))
    require(len(rows) == len(manifest['files']) and {name for name, _ in rows} == set(manifest['files']),
            'Committed native file membership differs: ' + commit)
    process = subprocess.run(['git', 'cat-file', '--batch'], cwd=cwd, check=True,
                             input=b''.join(oid + b'\n' for _, oid in rows), stdout=subprocess.PIPE)
    stream = io.BytesIO(process.stdout)
    for name, oid in rows:
        header = stream.readline().rstrip(b'\n').split()
        require(len(header) == 3 and header[0] == oid and header[1] == b'blob'
                and header[2].isdigit(), 'Unexpected native blob batch response')
        size = int(header[2])
        data = stream.read(size)
        require(len(data) == size and stream.read(1) == b'\n'
                and hashlib.sha256(data).hexdigest() == manifest['files'][name],
                'Committed native bytes differ: ' + commit + ':' + name)
    require(stream.read() == b'', 'Unexpected extra native blob batch output')
    return {'commit': commit, 'nativeDigest': manifest['digest'], 'nativeFiles': len(rows)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--declare', action='store_true')
    mode.add_argument('--recheck', action='store_true')
    parser.add_argument('--performance-directory', type=Path, default=BASE / 'performance')
    parser.add_argument('--candidate-source-directory', type=Path, default=BASE / 'integrated-final')
    parser.add_argument('--validation-directory', type=Path, default=Path('verification-attempt-02/validation'))
    parser.add_argument('--test-scope-plan', type=Path, default=BASE / 'contract/test-scope-final.json')
    parser.add_argument('--baseline-publication-receipt', type=Path, default=BASE / 'coordination/baseline-publication.json')
    parser.add_argument('--declaration', type=Path, default=BASE / 'contract/publication-verifier-declaration.json')
    args = parser.parse_args()
    perf, final = local(args.performance_directory, BASE), local(args.candidate_source_directory, BASE)
    validation = local(final / args.validation_directory, final)
    declaration_path = local(args.declaration, BASE)
    output = final / 'publication-inputs.json'
    require(output.is_file() if args.recheck else not output.exists(),
            'Recheck requires an existing publication receipt; other modes require an absent receipt')
    paths = {'performanceDirectory': perf.relative_to(ROOT).as_posix(),
             'candidateSourceDirectory': final.relative_to(ROOT).as_posix(),
             'validationDirectory': validation.relative_to(ROOT).as_posix(),
             'testScopePlan': local(args.test_scope_plan, BASE).relative_to(ROOT).as_posix(),
             'baselinePublicationReceipt': local(args.baseline_publication_receipt, BASE).relative_to(ROOT).as_posix()}
    tool_records = {name: fp(path) for name, path in TOOLS.items()}
    if args.declare:
        require(not declaration_path.exists(), 'Publication verifier declaration already exists')
        require(all(not (perf / name).exists() for name in
                    ('window.json', 'strict-work-verification.json', 'results-render.json')),
                'Publication requirements must be declared before the official window')
        value = {'schema': 'logos-engine.followup-publication-verifier-declaration.v1',
                 'status': 'declared_before_official_window', 'recordedAt': datetime.now(timezone.utc).isoformat(),
                 'generator': fp(SCRIPT), 'tools': tool_records, 'paths': paths,
                 'candidateManifest': fp(final / 'source-manifest.json'), 'testScopePlan': fp(args.test_scope_plan),
                 'population': POPULATION, 'structuralExemptions': [],
                 'globalRule': 'pooled_complete_session_median_strictly_below_plus_10_percent_per_case',
                 'requiredChronology': ['publication_declaration', 'readiness', 'official_window',
                                        'strict_work_verification', 'report_rendering', 'publication_inputs'],
                 'candidateCommitRequirement': 'Exact verifier, declaration, strict tools/forms and readiness in both B report Git heads.',
                 'qualification': 'Prospective file and receipt verification only. No publication, measurement or functional execution.'}
        exclusive(declaration_path, value)
        print(json.dumps({'status': value['status'], 'declaration': fp(declaration_path), 'measurementExecuted': False}))
        return

    retained, external = {}, {}

    def keep(value):
        record = fp(value)
        require(retained.setdefault(record['path'], record) == record, 'Input changed during review: ' + record['path'])
        return record

    def read(value):
        keep(value)
        return json_file(local(value))

    def checked(record):
        require(isinstance(record, dict) and set(record) == {'path', 'sha256', 'bytes'}, 'Invalid input fingerprint')
        require(keep(record['path']) == record, 'Retained input differs: ' + record['path'])
        return record

    prior = read(output) if args.recheck else None
    if prior is not None:
        require(prior['schema'] == 'logos-engine.followup-strict-publication-inputs.v1'
                and prior['status'] == 'passed' and prior['inputsUnchanged'] is True
                and prior['generator'] == keep(SCRIPT), 'The preserved publication receipt differs')
        for record in prior['receipts']:
            checked(record)
        require(re.fullmatch(r'[0-9a-f]{40}', prior['currentSourceCommit']), 'Invalid preserved source commit')
        git('merge-base', '--is-ancestor', prior['currentSourceCommit'], 'HEAD')

    prospective = read(declaration_path)
    require(prospective['schema'] == 'logos-engine.followup-publication-verifier-declaration.v1'
            and prospective['status'] == 'declared_before_official_window'
            and prospective['generator'] == keep(SCRIPT) and prospective['tools'] == tool_records
            and prospective['paths'] == paths and prospective['population'] == POPULATION
            and prospective['structuralExemptions'] == [], 'Prospective publication verifier differs')
    for record in tool_records.values():
        checked(record)
    delivery = load_helper('followup_retained_delivery', TOOLS['delivery'])
    campaign = delivery.load_helper('followup_retained_campaign', TOOLS['campaign'])
    original = delivery.load_helper('followup_retained_original', TOOLS['original'])
    transport_helper = delivery.load_helper('followup_retained_transport', TOOLS['transport'])
    global_review = load_helper('followup_retained_global_review', TOOLS['globalReview'])

    declaration, policy, cases, baseline, native, protocol_records = global_review.protocol(perf / 'declaration.json')
    require('ownerCostQualification' not in declaration, 'Owner or structural cost qualification is forbidden')
    require(policy['caseIds'] == ['STCK', 'SMLP'] and cases['rounds'] == 4, 'Unexpected official cost cases')
    require(all(policy[key] == declaration[key] == count for key, count in POPULATION.items()), 'Declared population differs')
    for record in protocol_records:
        checked(record)
    require(prospective['candidateManifest'] == declaration['candidateManifest'] == keep(final / 'source-manifest.json')
            and declaration['candidateArchiveManifest'] == keep(final / 'source-archive.json')
            and prospective['testScopePlan'] == keep(args.test_scope_plan), 'Publication inputs differ from their predeclaration')
    preparation = read(perf / 'preparation.json')
    baseline_checkout = Path(preparation['baselineCheckout']).resolve(strict=True)
    require(baseline_checkout != ROOT and baseline_checkout.is_dir(), 'Baseline must be a separate existing checkout')

    def checked_external(record):
        path = Path(record['path'])
        require(path.is_absolute() and path != baseline_checkout and path.is_relative_to(baseline_checkout),
                'External input escapes the baseline checkout')
        local(path, baseline_checkout)
        require({'path': record['path'], **digest_file(path)} == record, 'External input changed: ' + record['path'])
        require(external.setdefault(record['path'], record) == record, 'Conflicting external fingerprints')

    publication = read(args.baseline_publication_receipt)
    require(publication['schema'] == 'logos-engine.lot7b-published-baseline.v1'
            and publication['status'] == 'verified' and publication['deploymentStatus'] == 'succeeded'
            and publication['projectId'] == 'appgprj_6adbc388d79081918581b93b919d7258'
            and type(publication['siteVersion']) is int and publication['siteVersion'] > 0
            and re.fullmatch(r'[0-9a-f]{40}', publication['commit'])
            and all(publication[key] == policy['baseline'][key] for key in ('siteVersion', 'commit', 'nativeVersion', 'nativeDigest'))
            and publication['nativeDigest'] == baseline['digest'], 'Actual published predecessor differs')

    def verify_baseline():
        require(git('rev-parse', 'HEAD', cwd=baseline_checkout).decode().strip() == publication['commit'], 'Baseline HEAD changed')
        files = {path.relative_to(baseline_checkout).as_posix(): delivery.sha(path)
                 for folder in ('src/logos-engine', 'src/runtime')
                 for path in delivery.walk_files(baseline_checkout / folder, baseline_checkout)
                 if path.suffix in ('.ts', '.json', '.drm')}
        require(files == baseline['files'], 'Baseline native inventory changed')

    verify_baseline()
    native_commit_bindings = [verify_git_native(publication['commit'], baseline, baseline_checkout)]
    current_head = git('rev-parse', 'HEAD').decode().strip()
    native_commit_bindings.append(verify_git_native(current_head, native))
    if prior is not None:
        committed_receipt = git('show', current_head + ':' + output.relative_to(ROOT).as_posix())
        require(committed_receipt == output.read_bytes(),
                'Final HEAD must contain the exact preserved publication receipt and its accepted input commitments')
    readiness = read(perf / 'readiness.json')
    require(readiness['schema'] == 'logos-engine.native-cost-window-readiness.v1' and readiness['status'] == 'ready'
            and readiness['measurementAuthorized'] is True and readiness['pendingRequirements'] == []
            and readiness['generator'] == tool_records['readiness'] and readiness['nativeSourceDigest'] == native['digest']
            and readiness['baseline'] == policy['baseline'] and readiness['candidate'] == policy['candidate']
            and readiness['validationDirectory'] == paths['validationDirectory'] and readiness['regressionChecks'] == 187,
            'Readiness does not authorize these exact inputs')
    require(instant(prospective['recordedAt']) <= instant(readiness['finalizedAt']), 'Publication gate was declared after readiness')
    require(all(keep(path) in readiness['inputs'] for path in (args.test_scope_plan, args.baseline_publication_receipt)),
            'Readiness omits the exact final test scope or actual publication')
    tests, checks = read(validation / 'delta-tests-run.json'), read(validation / 'checks-run.json')
    scope = read(args.test_scope_plan)
    native_count = delivery.verify_native(native, campaign)
    archive, archive_check = delivery.verify_source_archive(final, native)
    test_inventory_count, counts = delivery.verify_tests(tests, native)
    build_inventory_count, worker = delivery.verify_build(checks, native)
    require(tests['testFiles'] == scope['testFiles'] and len(tests['testFiles']) == scope['testFileCount']
            == readiness['formalTestFiles'] and counts == readiness['formalTests'], 'Selected formal test scope differs')
    failed = read(final / 'validation/delta-tests-run.json')
    require(failed['status'] == 'failed' and failed['nativeSource'] == native
            and failed['testFiles'] == tests['testFiles']
            and failed['checks'][0]['counts']['tests'] == counts['tests']
            and failed['checks'][0]['counts']['fail'] == 2
            and failed['checks'][0]['counts']['pass'] == counts['tests'] - 2,
            'The original two-assertion failure was not preserved')
    checked(failed['checks'][0]['output'])
    checked(readiness['validationRetryAmendment'])
    require(keep(final / 'validation/delta-tests-run.json') in readiness['inputs'], 'Readiness omits the preserved first failure')
    regression_path = final / 'regressions/regression-summary.json'
    regression, regression_input_count = delivery.verify_regressions(regression_path, native, True)
    keep(regression_path)
    regression_cases = read(regression['caseManifest']['path'])
    require([row['game'] for row in regression['results']] == GAMES
            and len(regression_cases['cases']) == 11
            and [row['case'] for row in regression['results']] == [row['id'] for row in regression_cases['cases']]
            and regression['passed'] == regression['total'] == 11
            and regression['comparisonChecksExpected'] == regression['comparisonChecksPassed'] == 187,
            'All eleven strict fresh regressions are required')
    require(keep(regression_path) in readiness['inputs'] and regression['caseManifest'] in readiness['inputs'],
            'Readiness does not bind this exact eleven-case evidence')
    for row, declared_case in zip(regression['results'], regression_cases['cases']):
        require(row['game'] == declared_case['game'] and row['comparisonChecks'] == 17,
                'Regression case or strict comparison count differs')
        for key in ('baseline', 'trace'):
            actual = keep(row[key]['path'])
            require(all(actual[field] == row[key][field] == declared_case[key][field]
                        for field in ('path', 'sha256')), 'Regression ' + key + ' identity differs')
    integrity = read(final / 'delivery-integrity.json')
    inventories = {'native': native_count, 'archive': archive_check['files'], 'sourceAndTests': test_inventory_count,
                   'buildInputs': build_inventory_count, 'regressionExecutionInputs': regression_input_count}
    require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1' and integrity['status'] == 'passed'
            and integrity['generator'] == tool_records['delivery'] and integrity['nativeSourceDigest'] == native['digest']
            and integrity['validationDirectory'] == paths['validationDirectory'] and integrity['tests'] == counts
            and integrity['nativeAgentWorker'] == worker and integrity['matchedFileInventories'] == inventories
            and integrity['sourceArchiveVerification'] == archive_check,
            'Delivery integrity does not bind the selected fresh receipts and current build')
    require(all(keep(path) in integrity['receipts'] for path in
                (validation / 'delta-tests-run.json', validation / 'checks-run.json', regression_path)),
            'Delivery integrity refers to a different validation attempt or regression summary')
    pinned_source, pinned_manifest = delivery.verify_pinned_source(original)
    require(integrity['originalSourceFilesUnchanged'] == len(pinned_source) == 1786
            and integrity['originalSourceManifest'] == pinned_manifest, 'Original source pin differs')
    checked(pinned_manifest)

    forms = read(perf / 'strict-work-forms.json')
    strict = read(perf / 'strict-work-verification.json')
    window = read(perf / 'window.json')
    require(forms['schema'] == 'logos-engine.followup-strict-cost-forms.v1' and forms['status'] == 'passed'
            and forms['generator'] == tool_records['capture'] and forms['sourceAndInputsUnchanged'] is True
            and forms['comparison'] == 'exact_deep_equality_no_exemptions'
            and forms['functionalSessions'] == 8 and forms['functionalActions'] == 62
            and forms['measuredCostSessions'] == forms['timingMetricsRetained'] == 0,
            'Prospective functional forms differ')
    require(strict['schema'] == 'logos-engine.followup-strict-work-verification.v1' and strict['status'] == 'passed'
            and strict['generator'] == readiness['strictPostWindowVerifier'] == tool_records['strictVerifier']
            and strict['forms'] == readiness['strictWorkForms'] == keep(perf / 'strict-work-forms.json')
            and strict['nativeDigests'] == forms['nativeDigests'] == declaration['nativeDigests']
            and strict['checkedTrials'] == 40 and strict['structuralExemptions'] == []
            and strict['excludedMeasuredSessions'] == strict['excludedOutliers'] == 0
            and all(strict[key] == count for key, count in POPULATION.items()), 'Strict forty-trial verification failed or differs')
    require(window['schema'] == 'logos-engine.native-cost-window.v1' and window['status'] == window['finalIntegrity'] == 'passed'
            and window['plannedOrder'] == [row['label'] for row in window['executions']] == ORDER
            and window['nativeDigests'] == {'baseline': baseline['digest'], 'correction': native['digest']}
            and window['baselineCheckout'] == str(baseline_checkout), 'Official window differs')
    require(instant(forms['finishedAt']) <= instant(readiness['finalizedAt']) < instant(window['startedAt'])
            <= instant(window['finishedAt']) <= instant(strict['recordedAt']), 'Strict gate chronology differs')
    required_strict = [keep(perf / name) for name in ('window.json', 'declaration.json', 'readiness.json', 'strict-work-forms.json')]
    required_strict.extend(keep(perf / f'cohort{index}/{side}.json') for index in (1, 2) for side in ('baseline', 'after'))
    require(all(record in strict['inputs'] for record in required_strict), 'Strict verification does not bind this window and all four raw reports')

    aggregate = read(perf / 'combined-comparison.json')
    arithmetic, arithmetic_record, arithmetic_inputs = global_review.verify_consolidation(
        aggregate, keep(perf / 'combined-comparison.json'), keep(perf / 'window.json'), declaration)
    decision = read(perf / 'global-budget-decision.json')
    require(aggregate['schema'] == 'logos-engine.native-loop-cost-cohort-comparison.v1'
            and aggregate['status'] in ('passed', 'budget_review_required')
            and aggregate['generator'] == tool_records['workSignature']
            and aggregate['sources'] == decision['sources'] == {
                'baseline': {key: baseline[key] for key in ('digest', 'fileCount')},
                'after': {key: native[key] for key in ('digest', 'fileCount')}}
            and aggregate['method']['excludedMeasuredSessions'] == aggregate['method']['excludedOutliers'] == 0
            and aggregate['method']['selectedCohort'] is None and aggregate['method']['noiseAllowanceAdded'] is False
            and aggregate['method']['workMetadataExactAcrossAllSessions'] is True,
            'Original aggregate uses different sources or adjusted measured sessions')
    require(decision['schema'] == 'logos-engine.predeclared-global-cost-window-decision.v1'
            and decision['status'] == 'accepted_under_user_global_rule' and decision['accepted'] is True
            and decision['generator'] == declaration['globalDecisionTool'] == tool_records['globalReview']
            and decision['calculationHelper'] == declaration['globalCalculationTool'] == tool_records['globalCalculation']
            and decision['policy'] == policy and decision['acceptedCases'] == decision['totalCases'] == 2
            and all(decision[key] == count for key, count in POPULATION.items()), 'Original per-case global decision is not accepted')
    require(all(record in decision['inputs'] for record in
                [*required_strict[:2], keep(perf / 'combined-comparison.json'), arithmetic_record, *arithmetic_inputs]),
            'Global decision does not bind this exact window, declaration and arithmetic review')
    require(decision['diagnosticPhaseRule'] == {key: aggregate[key] for key in
                ('status', 'budgetMetricCount', 'withinObservedBudget', 'unresolved')}
            and decision['diagnosticArithmeticReview']['receipt'] == arithmetic_record
            and decision['diagnosticArithmeticReview']['status'] == 'passed', 'Phase diagnostics were reclassified')

    prospective_records = list({record['path']: record for record in [keep(SCRIPT), keep(declaration_path),
        *tool_records.values(), *protocol_records, keep(perf / 'readiness.json'), keep(perf / 'strict-work-forms.json'),
        checked(forms['declaration'])]}.values())
    reports, ledger, warmups, strict_rows, candidate_commits = {}, [], [], [], []
    pooled = {case: {'baseline': [], 'after': []} for case in policy['caseIds']}
    cohorts = aggregate['inputs']['cohorts']
    require(len(cohorts) == 2 and len({row['id'] for row in cohorts}) == 2, 'Expected both complete cohorts')
    for index, cohort in enumerate(cohorts, 1):
        for side, prefix, role, manifest in (('baseline', 'A', 'baseline', baseline), ('after', 'B', 'candidate', native)):
            path, label = perf / f'cohort{index}/{side}.json', prefix + str(index)
            report, report_record = read(path), keep(path)
            reports[label] = report
            execution = next(row for row in window['executions'] if row['label'] == label)
            require(cohort[side] == report_record and execution['status'] == 'passed' and execution['exitCode'] == 0
                    and execution['reportSha256'] == report_record['sha256'] and execution['nativeDigest'] == manifest['digest'],
                    'Official report differs from the retained window or cohort')
            require(report['schema'] == 'logos-engine.native-loop-costs.v1' and report['status'] == 'passed'
                    and report['nativeSourceUnchanged'] is True and report['nativeSource'] == manifest
                    and report['manifest'] == cases and report['generator'] in declaration['officialTools']
                    and report['generator']['path'] == 'scripts/measure-native-loop-costs.mjs', 'Raw report source or harness differs')
            require(re.fullmatch(r'[0-9a-f]{40}', report['gitHead']), 'Invalid report Git identity')
            if side == 'after':
                candidate_commits.append(report['gitHead'])
                if not any(row['commit'] == report['gitHead'] for row in native_commit_bindings):
                    native_commit_bindings.append(verify_git_native(report['gitHead'], native))
                require(instant(git('show', '-s', '--format=%cI', report['gitHead']).decode().strip())
                        <= instant(window['startedAt']), 'A candidate report commit was created after the window began')
                for record in prospective_records:
                    data = git('show', report['gitHead'] + ':' + record['path'])
                    require({'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
                            == {key: record[key] for key in ('bytes', 'sha256')},
                            'Prospective verifier input was not committed in ' + label + ': ' + record['path'])
                git('merge-base', '--is-ancestor', publication['commit'], report['gitHead'])
                git('merge-base', '--is-ancestor', report['gitHead'], 'HEAD')
            else:
                require(report['gitHead'] == publication['commit'], 'Baseline report was not run from the actual published commit')
            require([row['id'] for row in report['cases']] == policy['caseIds'], 'Raw case order differs')
            for row, planned_case in zip(report['cases'], cases['cases']):
                require([(trial['round'], trial['warmup']) for trial in row['trials']]
                        == [(0, True), (1, False), (2, False), (3, False), (4, False)], 'Raw trials are missing or reordered')
                for trial in row['trials']:
                    actions = planned_case['warmupActions'] if trial['warmup'] else planned_case['actions']
                    require(trial['case'] == row['id'] and trial['actions'] == actions, 'Raw trial action population differs')
                    form = next(item for item in forms['forms'] if item['case'] == row['id'] and item['warmup'] == trial['warmup'])
                    strict_rows.append({'label': label, 'role': role, 'case': row['id'], 'round': trial['round'],
                                        'warmup': trial['warmup'], 'actions': actions,
                                        'signatureSha256': form['signatureSha256'], 'passed': True})
                    if trial['warmup']:
                        warmups.append(actions)
                    else:
                        elapsed = trial['replayElapsedMs']
                        require(type(elapsed) in (int, float) and math.isfinite(elapsed) and elapsed > 0, 'Invalid complete-session time')
                        pooled[row['id']][side].append(elapsed)
                        ledger.append({'cohort': cohort['id'], 'side': side, 'case': row['id'], 'round': trial['round'],
                                       'startedAt': trial['startedAt'], 'actions': actions, 'elapsedMs': elapsed})
    canonical = global_review.canonical_ledger
    require(canonical(strict_rows) == canonical(strict['checks']) and len(strict_rows) == 40,
            'Strict verification does not retain every exact official trial')
    require(canonical(ledger) == canonical(decision['sessionLedger']) and len(ledger) == 32
            and sum(row['actions'] for row in ledger) == 400 and len(warmups) == 8 and sum(warmups) == 24,
            'Global decision omits or substitutes measured sessions or warmups')
    require([row['case'] for row in decision['globalCases']] == policy['caseIds'], 'Global cases are missing or reordered')
    for row in decision['globalCases']:
        before, after = (statistics.median(pooled[row['case']][side]) for side in ('baseline', 'after'))
        ratio = (after - before) / before
        require(len(pooled[row['case']]['baseline']) == len(pooled[row['case']]['after']) == row['sessionsPerVersion'] == 8
                and row['beforeMedianMs'] == before and row['afterMedianMs'] == after
                and math.isclose(row['medianRelativeIncrease'], ratio, rel_tol=1e-12, abs_tol=1e-12)
                and row['accepted'] is True and global_review.within(before, after),
                'A pooled complete-session median is not strictly below +10%: ' + row['case'])

    render, log_transport = read(perf / 'results-render.json'), read(perf / 'log-transport.json')
    require(render['schema'] == 'logos-engine.lot7b-cost-report-render.v1'
            and render['status'] == 'rendered_retained_receipts' and render['generator'] == tool_records['renderer']
            and render['report'] == keep(perf / 'results.md') and render['inputReceiptsUnchanged'] is True
            and render['displayedMeasuredSessions'] == 32
            and instant(strict['recordedAt']) <= instant(render['recordedAt']) <= datetime.now(timezone.utc),
            'Rendering must follow successful strict forty-trial verification')
    require(all(keep(perf / name) in render['inputs'] for name in
                ('window.json', 'readiness.json', 'combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json')),
            'Renderer does not bind the exact accepted window and decision')
    require(log_transport['schema'] == 'logos-engine.lossless-log-transport.v1' and log_transport['status'] == 'passed'
            and log_transport['generator'] == tool_records['logTransport']
            and log_transport['window'] == keep(perf / 'window.json')
            and [row['series'] for row in log_transport['logs']] == ORDER, 'Official log transport differs')
    for row in log_transport['logs']:
        checked(row['original']); checked(row['transport'])
        require(gzip.decompress(local(row['transport']['path']).read_bytes())
                == local(row['original']['path']).read_bytes(), 'Log transport is not byte-identical')
    for value in (readiness, forms, strict, arithmetic, decision, render):
        for record in value['inputs']:
            checked(record)
        for record in value.get('watchedExternalInputs', []):
            checked_external(record)
    for record in [*integrity['verificationHelpers'], *integrity['receipts'], *arithmetic_inputs]:
        checked(record)
    checked(forms['generator']); checked(forms['workSignatureTool']); checked(forms['declaration'])
    byte_storage = {name: delivery.verify_byte_storage(directory, transport_helper)
                    for name, directory in (('delivery', final), ('performance', perf))}

    # Recheck complete membership and bytes after every archive/transport read.
    require(delivery.verify_native(native, campaign) == native_count
            and delivery.verify_tests(tests, native) == (test_inventory_count, counts)
            and delivery.verify_build(checks, native) == (build_inventory_count, worker)
            and delivery.verify_regressions(regression_path, native, True)[0] == regression
            and delivery.verify_pinned_source(original) == (pinned_source, pinned_manifest),
            'Verified source, tests, build, regressions or original source changed during review')
    delivery.check_map(archive['files'], 'publication archive inputs')
    checked(archive['archive'])
    for record in list(retained.values()):
        require(fp(record['path']) == record, 'Local publication input changed before finalization: ' + record['path'])
    for record in list(external.values()):
        checked_external(record)
    verify_baseline()
    require(git('rev-parse', 'HEAD').decode().strip() == current_head, 'Candidate HEAD changed during publication review')
    result = {'schema': 'logos-engine.followup-strict-publication-inputs.v1', 'status': 'passed',
              'recordedAt': datetime.now(timezone.utc).isoformat(), 'generator': keep(SCRIPT),
              'prospectiveDeclaration': keep(declaration_path), 'candidateMeasurementCommits': candidate_commits,
              'currentSourceCommit': current_head, 'nativeCommitBindings': native_commit_bindings,
              'nativeVersion': policy['candidate']['nativeVersion'], 'nativeSourceDigest': native['digest'],
              'baseline': policy['baseline'], 'baselinePublication': keep(args.baseline_publication_receipt),
              'validationDirectory': paths['validationDirectory'], 'formalTests': counts,
              'formalTestFiles': len(tests['testFiles']), 'testScopePlan': keep(args.test_scope_plan),
              'preservedFailedAttempt': keep(final / 'validation/delta-tests-run.json'),
              'regressions': {'passed': 11, 'total': 11, 'comparisonChecksPassed': 187},
              'fileInventories': inventories, 'nativeAgentWorker': worker, 'sourceArchiveVerification': archive_check,
              'byteStorage': byte_storage, 'strictWorkVerification': keep(perf / 'strict-work-verification.json'),
              'strictVerificationPrecededRendering': True, 'checkedTrials': 40, **POPULATION,
              'structuralExemptions': [], 'costGlobalStatus': decision['status'], 'globalCases': decision['globalCases'],
              'diagnosticPhaseRule': decision['diagnosticPhaseRule'], 'inputsUnchanged': True,
              'receipts': list(retained.values()), 'watchedExternalInputs': list(external.values()),
              'publicationExecuted': False,
              'qualification': 'Current source, build, archive and retained proof integrity only. The exact predeclared work '
                  'forms passed for all forty trials before rendering; both separate pooled complete-session medians passed '
                  'the unchanged strict user rule. Every phase diagnostic and the initial failed test attempt remain retained. '
                  'No owner qualification, excluded measured session, new game/replay, LKEY execution, source publication '
                  'or Site deployment is performed. Functional scope and limitations remain those of readiness.'}
    if prior is not None:
        equal_fields = ['prospectiveDeclaration', 'candidateMeasurementCommits', 'nativeVersion', 'nativeSourceDigest',
            'baseline', 'baselinePublication', 'validationDirectory', 'formalTests', 'formalTestFiles', 'testScopePlan',
            'preservedFailedAttempt', 'regressions', 'fileInventories', 'nativeAgentWorker', 'sourceArchiveVerification',
            'byteStorage', 'strictWorkVerification', 'strictVerificationPrecededRendering', 'checkedTrials',
            *POPULATION, 'structuralExemptions', 'costGlobalStatus', 'globalCases', 'diagnosticPhaseRule']
        require(all(prior[key] == result[key] for key in equal_fields), 'A previously accepted publication input differs')
        require(instant(render['recordedAt']) <= instant(prior['recordedAt']) <= datetime.now(timezone.utc),
                'Preserved publication receipt chronology differs')
        print(json.dumps({'schema': 'logos-engine.followup-publication-input-recheck.v1', 'status': 'passed',
            'recordedAt': datetime.now(timezone.utc).isoformat(), 'generator': fp(SCRIPT),
            'publicationInputs': fp(output), 'currentSourceCommit': current_head,
            'publicationReceiptCommittedInCurrentHead': True,
            'nativeCommitBindings': native_commit_bindings, 'nativeSourceDigest': native['digest'],
            'nativeAgentWorker': worker, 'formalTests': counts, 'checkedTrials': 40,
            'allPublicationInputsUnchanged': True, 'publicationExecuted': False}))
        return
    exclusive(output, result)
    print(json.dumps({'status': 'passed', 'formalTestFiles': len(tests['testFiles']), 'formalTests': counts,
                      'checkedTrials': 40, 'globalCases': decision['globalCases'], 'receipt': fp(output)}))


if __name__ == '__main__':
    main()
