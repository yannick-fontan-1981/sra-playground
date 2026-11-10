#!/usr/bin/env python3
"""Verify frozen delivery and separately qualified cost receipts without execution.

Usage: python -B docs/migration/lot4a-evidence/verify-owner-qualified-publication.py
       [--directory FROZEN_DIR] [--performance PERFORMANCE_DIR]
Exclusive output: FROZEN_DIR/publication-inputs-owner-qualified.json.
The original strict publication verifier and its required contracts stay unchanged.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OFFICIAL = ROOT / 'scripts/verify-native-delivery.py'
spec = importlib.util.spec_from_file_location('owner_publication_delivery_helpers', OFFICIAL)
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', default='docs/migration/lot4a-evidence/integrated-051')
    parser.add_argument('--performance', default='docs/migration/lot4a-evidence/performance-integrated')
    args = parser.parse_args()
    directory, perf = V.confined(args.directory), V.confined(args.performance)
    output = V.confined(directory / 'publication-inputs-owner-qualified.json')
    V.require(not output.exists(), 'Qualified publication receipt is exclusive: ' + str(output))
    names = ['declaration', 'global-budget-policy', 'readiness', 'window', 'owner-addition-declaration',
             'owner-addition-qualification', 'owner-qualified-comparison', 'owner-qualified-cost-review',
             'owner-qualified-global-budget-decision', 'results-qualified-render', 'aggregation-failure-reproduced']
    missing = [name for name in names if not (perf / (name + '.json')).is_file()]
    V.require(not missing, 'Completed qualified receipts missing; no publication receipt: ' + ', '.join(missing))
    V.require(not (perf / 'combined-comparison.json').exists(), 'Strict aggregation must remain without a fabricated output')
    records, baseline_root = {}, None

    def fingerprint(path):
        path = Path(path); path = path if path.is_absolute() else ROOT / path
        boundary = ROOT if path.is_relative_to(ROOT) else baseline_root
        V.require(boundary is not None, 'Undeclared external input: ' + str(path))
        record = V.fingerprint(V.confined(path, boundary), boundary)
        if boundary != ROOT:
            record['path'] = str(path)
        return record

    def retain(path, expected=None):
        actual = fingerprint(path)
        V.require(expected is None or all(actual.get(key) == value for key, value in expected.items()
                  if key in ('sha256', 'bytes')), 'Retained input changed: ' + str(path))
        V.require(actual['path'] not in records or records[actual['path']] == actual, 'Input changed while reading: ' + str(path))
        records[actual['path']] = actual
        return actual

    def read(path):
        retain(path)
        return V.read_json(path)

    def links(value):
        if isinstance(value, dict):
            if {'path', 'sha256'} <= value.keys():
                V.require(V.valid_digest(value['sha256']), 'Invalid linked digest')
                retain(value['path'], value)
            for child in value.values():
                links(child)
        elif isinstance(value, list):
            for child in value:
                links(child)

    cost = {name: read(perf / (name + '.json')) for name in names}
    declared, policy, ready, window, extension, owner, aggregate, review, decision, render, strict = [cost[name] for name in names]
    baseline_root = V.confined(Path(window['baselineCheckout']), ROOT.parent.parent)
    V.require(baseline_root != ROOT and window['status'] == window['finalIntegrity'] == 'passed', 'Completed A/B window required')
    V.require(window['plannedOrder'] == [row['label'] for row in window['executions']] == policy['plannedOrder'] == ['A1', 'B1', 'B2', 'A2']
              and all(row['status'] == 'passed' and row['exitCode'] == 0 for row in window['executions']), 'Incomplete measured execution set')
    V.require(strict['exitCode'] == 1 and strict['outputExists'] is False and strict['inputsUnchanged'] is True,
              'Original strict failure must remain explicit')
    strict_identity = {'status': 'failed', 'receipt': retain(perf / 'aggregation-failure-reproduced.json'),
                       'unchanged': True, 'originalOutputAbsent': True}
    V.require(owner['schema'] == 'logos-engine.feedback-cost-owner-addition-qualification.v1'
              and owner['status'] == 'qualified_owner_addition_verified' and owner['workMetadataExact'] is False
              and owner['strictAggregationReclassified'] is False and owner['nativeDigests'] == declared['nativeDigests'], 'Owner qualification incomplete')
    V.require(owner['checks'] and all(row['passed'] is True and type(row['assertions']) is int and row['assertions'] > 0 for row in owner['checks'])
              and owner['checkedCount'] == sum(row['assertions'] for row in owner['checks']) and owner['inputsUnchanged'] is True
              and owner['inputsBefore' if 'inputsBefore' in owner else 'inputs'] == owner['inputsAfter'], 'Owner proof checks or input stability incomplete')
    V.require(aggregate['schema'] == 'logos-engine.native-cost-owner-qualified-comparison.v1'
              and aggregate['status'] == 'qualified_diagnostic_calculation' and aggregate['method']['workMetadataExactAcrossAllSessions'] is False
              and aggregate['originalStrictAggregation'] == strict_identity, 'Aggregate qualification or strict failure was lost')
    V.require(review['schema'] == 'logos-engine.native-cost-owner-qualified-review.v1' and review['status'] == 'owner_qualified_arithmetic_verified'
              and review['checkedCount'] == len(review['checks']) > 0 and all(row['passed'] is True for row in review['checks'])
              and review['aggregate'] == retain(perf / 'owner-qualified-comparison.json'), 'Independent qualified review incomplete')
    V.require(decision['schema'] == 'logos-engine.native-cost-owner-qualified-global-budget-decision.v1'
              and decision['status'] == 'accepted_under_user_global_rule_with_owner_addition_qualification' and decision['accepted'] is True
              and decision['acceptedCases'] == decision['totalCases'] == len(policy['caseIds']) > 0
              and all(row['accepted'] is True for row in decision['globalCases']), 'Qualified global budget does not permit publication')
    V.require(decision['arithmeticReview'] == retain(perf / 'owner-qualified-cost-review.json')
              and decision['arithmeticReviewChecks'] == review['checkedCount'] and decision['policy'] == policy
              and decision['numericRulePredeclared'] is True and decision['comparabilityDeclaredAfterMeasurement'] is True,
              'Qualified decision does not bind the independent review and declared numeric policy')
    V.require(review['generator'] == decision['generator'] and review['generator']['path']
              == 'docs/migration/lot4a-evidence/review-owner-qualified-cost.py', 'Unexpected qualified reviewer')
    for receipt in (review, decision):
        V.require(receipt['inputsBefore'] == receipt['inputsAfter'] and receipt['inputsUnchanged'] is True
                  and receipt['ownerQualification'] == retain(perf / 'owner-addition-qualification.json')
                  and receipt['ownerAdditionDeclaration'] == retain(perf / 'owner-addition-declaration.json')
                  and receipt['originalStrictAggregation'] == strict_identity and receipt['strictAggregationReclassified'] is False
                  and receipt['workMetadataExactAcrossAllSessions'] is False and receipt['runtimeOrGameExecuted'] is False
                  and receipt['measurementExecuted'] is False, 'Qualified reviewer provenance differs')
        V.require(all(receipt[key] == declared[key] == policy[key] for key in
                      ('measuredSessions', 'measuredActions', 'excludedWarmupSessions', 'excludedWarmupActions')), 'Cost accounting differs')
    V.require(review['budgetStatus'] == aggregate['budgetStatus'] and review['budget'] == {'metrics': aggregate['budgetMetricCount'],
              'withinObservedBudget': aggregate['withinObservedBudget'], 'unresolved': aggregate['unresolved']}
              and decision['diagnosticPhaseRule'] == {key: aggregate[key] for key in
                  ('budgetStatus', 'budgetMetricCount', 'withinObservedBudget', 'unresolved')}, 'Adverse diagnostics were changed')
    V.require(render['schema'] == 'logos-engine.lot4a-owner-qualified-cost-report-render.v1'
              and render['status'] == 'rendered_qualified_receipts' and render['inputsBefore'] == render['inputsAfter']
              and render['inputReceiptsUnchanged'] is True and render['runtimeOrGameExecuted'] is False
              and render['measurementExecuted'] is False and render['arithmeticReviewChecks'] == review['checkedCount']
              and render['report'] == retain(perf / 'results-qualified.md'), 'Qualified report rendering incomplete')
    V.require(all(retain(perf / (name + '.json')) in render['inputsBefore'] for name in
                  ('owner-qualified-comparison', 'owner-qualified-cost-review', 'owner-qualified-global-budget-decision', 'owner-addition-qualification')),
              'Qualified rendering omits a required cost receipt')
    comparisons = [read(perf / f'cohort{i}/comparison.json') for i in (1, 2)]
    V.require([row['status'] for row in comparisons] == [row['budgetStatus'] for row in review['cohortResults'][:2]], 'Original cohort diagnostics differ')
    integrity_path = directory / 'delivery-integrity.json'; integrity = read(integrity_path)
    V.require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1' and integrity['status'] == 'passed'
              and retain(integrity_path) in ready['inputs'], 'Pre-window delivery integrity changed')
    validation = V.repository_path(integrity['validationDirectory']); V.confined(validation, directory)
    native = read(directory / 'source-manifest.json')
    tests, build = read(validation / 'delta-tests-run.json'), read(validation / 'checks-run.json')
    regressions = read(directory / 'regressions/regression-summary.json')
    V.require(native['digest'] == integrity['nativeSourceDigest'] == ready['nativeSourceDigest'] == declared['nativeDigests']['candidate']
              == window['nativeDigests']['correction'] and review['sources'] == decision['sources'] == aggregate['sources']
              and review['sources']['after'] == {key: native[key] for key in ('digest', 'fileCount')}, 'Native source identities differ')
    V.require(declared['candidateManifest'] == retain(directory / 'source-manifest.json')
              and declared['candidateArchiveManifest'] == retain(directory / 'source-archive.json'), 'Costs did not bind this frozen delivery')
    for value in [*cost.values(), *comparisons, integrity, tests, build, regressions]:
        links(value)
    archive = read(directory / 'source-archive.json'); archive_parts = read(directory / 'source-archive-parts.json')
    links(archive); links(archive_parts)
    for row in integrity['byteStorage']['restoredByteIdentical']:
        path = V.repository_path(row['manifest']); parts = read(path)
        for item in [parts['original'], *parts['parts']]:
            retain(path.parent / item['file'], item)
    performance_parts = [path for path in V.walk_files(perf) if path.name.endswith('.json.gz.parts.json')]
    for path in performance_parts:
        parts = read(path)
        for item in [parts['original'], *parts['parts']]:
            retain(path.parent / item['file'], item)
    helpers = [V.CAMPAIGN_HELPER, V.SOURCE_HELPER, V.TRANSPORT_HELPER, V.RESTORE_HELPER]
    generators = [retain(Path(__file__)), retain(OFFICIAL), *[retain(ROOT / name) for name in helpers]]
    campaign = V.load_helper('owner_publication_campaign', V.CAMPAIGN_HELPER)
    original = V.load_helper('owner_publication_original', V.SOURCE_HELPER)
    transport = V.load_helper('owner_publication_transport', V.TRANSPORT_HELPER)

    def inventories():
        n = V.verify_native(native, campaign)
        t, counts = V.verify_tests(tests, native); b, worker = V.verify_build(build, native)
        r, count = V.verify_regressions(directory / 'regressions/regression-summary.json', native, True)
        V.require(counts == integrity['tests'] and worker == integrity['nativeAgentWorker'] and r == regressions, 'Executed validation changed')
        return {'native': n, 'archive': V.check_map(archive['files'], 'frozen archive inputs'), 'sourceAndTests': t,
                'buildInputs': b, 'regressionExecutionInputs': count}

    inputs_before = [records[key] for key in sorted(records)]
    matched = inventories(); V.require(matched == integrity['matchedFileInventories'], 'Delivery inventory counts differ')
    _, archive_check = V.verify_source_archive(directory, native)
    V.require(archive_check == integrity['sourceArchiveVerification'], 'Frozen archive changed')
    pinned = V.verify_pinned_source(original)
    V.require(len(pinned[0]) == integrity['originalSourceFilesUnchanged'] and pinned[1] == integrity['originalSourceManifest'], 'Pinned source changed')
    storage = V.verify_byte_storage(directory, transport)
    V.require(storage == {key: value for key, value in integrity['byteStorage'].items() if key != 'generators'}, 'Evidence transport changed')
    performance_storage = V.verify_byte_storage(perf, transport)
    V.require(performance_storage['reports'] >= 2, 'Both large A/B graph captures require verified byte transport')
    V.require([path for path in V.walk_files(perf) if path.name.endswith('.json.gz.parts.json')] == performance_parts,
              'Performance byte-parts membership changed during verification')
    V.require(inventories() == matched and V.verify_pinned_source(original) == pinned, 'Inputs changed during verification')
    inputs_after = [fingerprint(row['path']) for row in inputs_before]
    V.require(inputs_after == inputs_before, 'Input or generator changed before qualified publication receipt')
    V.require(not (perf / 'combined-comparison.json').exists(), 'Strict output appeared during qualified verification')
    result = {'schema': 'logos-engine.native-publication-inputs-owner-qualified.v1', 'status': 'integrity_verified_with_owner_qualified_cost',
              'recordedAt': datetime.now(timezone.utc).isoformat(), 'generators': generators,
              'directory': directory.relative_to(ROOT).as_posix(), 'performanceDirectory': perf.relative_to(ROOT).as_posix(),
              'inputsBefore': inputs_before, 'inputsAfter': inputs_after, 'inputsUnchanged': True,
              'deliveryIntegrity': retain(integrity_path), 'nativeSourceDigest': native['digest'], 'matchedFileInventories': matched,
              'tests': integrity['tests'], 'regressions': integrity['regressions'], 'sourceArchiveVerification': archive_check, 'byteStorage': storage,
              'performanceByteStorage': performance_storage,
              'originalStrictAggregation': strict_identity, 'workMetadataExactAcrossAllSessions': False, 'strictAggregationReclassified': False,
              'cost': {'decision': retain(perf / 'owner-qualified-global-budget-decision.json'), 'status': decision['status'],
                       'review': retain(perf / 'owner-qualified-cost-review.json'), 'arithmeticReviewChecks': review['checkedCount'],
                       'aggregate': retain(perf / 'owner-qualified-comparison.json'), 'ownerQualification': retain(perf / 'owner-addition-qualification.json'),
                       'render': retain(perf / 'results-qualified-render.json'), 'diagnostics': decision['diagnosticPhaseRule'],
                       'acceptedCases': decision['acceptedCases'], 'totalCases': decision['totalCases']},
              'functionalExecutions': 0, 'costMeasurements': 0, 'arithmeticRecalculations': 0,
              'qualification': 'same executed inputs, no new functional execution. Numerical policy unchanged; owner comparability qualified after measurement. The original strict aggregation remains failed and its publication verifier remains unchanged. Uncaptured measured-session leaves are not retrospectively proved by separate captures. Transport restoration is byte verification only. No hosting deployment is verified.'}
    with V.confined(output).open('x') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2, allow_nan=False); stream.write('\n')
    print(json.dumps({'status': result['status'], 'receipt': V.fingerprint(output), 'strictAggregationStatus': 'failed'}))


if __name__ == '__main__':
    main()
