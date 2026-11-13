#!/usr/bin/env python3
"""Bind completed delivery and official cost receipts; run only after the cost window.

Usage: python -B docs/migration/lot4a-evidence/verify-publication-inputs.py
       [--directory FROZEN_DIR] [--performance PERFORMANCE_DIR]
Creates only FROZEN_DIR/publication-inputs.json, exclusively. No functional execution.
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
spec = importlib.util.spec_from_file_location('publication_delivery_integrity', OFFICIAL)
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)
QUALIFICATION = 'same executed inputs, no new functional execution'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', default='docs/migration/lot4a-evidence/integrated-051')
    parser.add_argument('--performance', default='docs/migration/lot4a-evidence/performance-integrated')
    args = parser.parse_args()
    directory, perf = V.confined(args.directory), V.confined(args.performance)
    output = V.confined(directory / 'publication-inputs.json')
    V.require(not output.exists(), 'Publication receipt is exclusive: ' + str(output))
    names = ['declaration', 'global-budget-policy', 'readiness', 'window', 'combined-comparison',
             'consolidation-review', 'global-budget-decision', 'results-render']
    required = [perf / (name + '.json') for name in names] + [perf / 'results.md']
    missing = [str(path) for path in required if not path.is_file()]
    V.require(not missing, 'Completed cost receipts missing; no publication receipt: ' + ', '.join(missing))
    records, baseline_root = {}, None

    def current(path):
        path = Path(path)
        path = path if path.is_absolute() else ROOT / path
        boundary = ROOT if path.is_relative_to(ROOT) else baseline_root
        V.require(boundary is not None, 'Undeclared external input: ' + str(path))
        item = V.fingerprint(V.confined(path, boundary), boundary)
        if boundary != ROOT:
            item['path'] = str(path)
        return item

    def retain(path, expected=None):
        item = current(path)
        V.require(expected is None or all(item.get(k) == value for k, value in expected.items()
                  if k in ('sha256', 'bytes')), 'Recorded input changed: ' + str(path))
        V.require(item['path'] not in records or records[item['path']] == item, 'Input changed while reading: ' + str(path))
        records[item['path']] = item
        return item

    def read(path):
        retain(path)
        return V.read_json(path)

    def links(value):
        if isinstance(value, dict):
            if {'path', 'sha256'} <= value.keys():
                retain(value['path'], value)
            for child in value.values():
                links(child)
        elif isinstance(value, list):
            for child in value:
                links(child)

    cost = {name: read(perf / (name + '.json')) for name in names}
    declaration, policy, ready, window, aggregate, review, decision, render = [cost[name] for name in names]
    V.require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
              and policy['schema'] == 'logos-engine.native-global-cost-policy.v1', 'Cost declaration schema differs')
    V.require(window['schema'] == 'logos-engine.native-cost-window.v1'
              and window['status'] == window['finalIntegrity'] == 'passed', 'Official cost window is incomplete')
    baseline_root = V.confined(Path(window['baselineCheckout']), ROOT.parent.parent)
    V.require(baseline_root != ROOT, 'Baseline checkout must be distinct')
    V.require(window['plannedOrder'] == declaration['plannedOrder'] == policy['plannedOrder'] == ['A1', 'B1', 'B2', 'A2']
              == [row['label'] for row in window['executions']], 'Incomplete declared ABBA execution order')
    V.require(all(row['status'] == 'passed' and row['exitCode'] == 0 for row in window['executions']), 'Cost execution failed')
    V.require(review['schema'] == 'logos-engine.native-cost-consolidation-review.v2' and review['status'] == 'passed'
              and review['checkedCount'] == len(review['checks']) > 0 and all(row['passed'] is True for row in review['checks']), 'Arithmetic review incomplete')
    V.require(review['generator'] in declaration['officialTools'], 'Arithmetic reviewer was not predeclared')
    V.require(decision['schema'] == 'logos-engine.predeclared-global-cost-window-decision.v1'
              and decision['status'] == 'accepted_under_user_global_rule' and decision['accepted'] is True
              and decision['acceptedCases'] == decision['totalCases'] == len(policy['caseIds']) > 0, 'Global cost decision does not permit publication')
    V.require(decision['policy'] == policy and decision['generator'] == declaration['globalDecisionTool']
              and decision['calculationHelper'] == declaration['globalCalculationTool'], 'Decision identity differs from declaration')
    V.require(all(decision[key] == declaration[key] == policy[key] for key in
                  ('measuredSessions', 'measuredActions', 'excludedWarmupSessions', 'excludedWarmupActions')), 'Cost session accounting differs')
    V.require(render['schema'] == 'logos-engine.lot4a-cost-report-render.v1' and render['status'] == 'rendered_retained_receipts'
              and render['inputReceiptsUnchanged'] is True and render['runtimeOrGameExecuted'] is False
              and render['measurementExecuted'] is False and render['arithmeticReviewChecks'] == review['checkedCount'], 'Cost rendering incomplete')
    V.require(render['generator']['path'] == 'docs/migration/lot4a-evidence/write-cost-results.py'
              and render['report'] == retain(perf / 'results.md'), 'Cost render generator or report differs')
    V.require(review['budgetStatus'] == aggregate['status'] and decision['diagnosticPhaseRule'] == {
        key: aggregate[key] for key in ('status', 'budgetMetricCount', 'withinObservedBudget', 'unresolved')}, 'Retained diagnostic verdict changed')
    V.require(decision['diagnosticArithmeticReview']['receipt'] == retain(perf / 'consolidation-review.json')
              and decision['diagnosticArithmeticReview']['checkedCount'] == review['checkedCount'], 'Decision names another review')
    comparisons = [read(perf / f'cohort{i}/comparison.json') for i in (1, 2)]
    V.require(aggregate['schema'] == 'logos-engine.native-loop-cost-cohort-comparison.v1'
              and all(row['schema'] == 'logos-engine.native-loop-cost-comparison.v1' for row in comparisons), 'Comparison schema differs')
    V.require(all(row['status'] in ('passed', 'budget_review_required') for row in [aggregate, *comparisons]), 'Diagnostic receipt incomplete')
    for index, side, label in [(1, 'baseline', 'A1'), (1, 'after', 'B1'), (2, 'after', 'B2'), (2, 'baseline', 'A2')]:
        row = next(item for item in window['executions'] if item['label'] == label)
        retain(perf / f'cohort{index}/{side}.json', {'sha256': row['reportSha256']})
        retain(perf / f'cohort{index}/{side}.log', {'sha256': row['logSha256']})
    integrity_path = directory / 'delivery-integrity.json'
    integrity = read(integrity_path)
    V.require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1' and integrity['status'] == 'passed', 'Delivery integrity receipt incomplete')
    V.require(retain(integrity_path) in ready['inputs'], 'Delivery integrity is not pinned by pre-window readiness')
    V.require(ready['status'] == 'ready_for_predeclared_official_window' and not ready['pendingRequirements'], 'Readiness incomplete')
    validation = V.repository_path(integrity['validationDirectory'])
    V.confined(validation, directory)
    native = read(directory / 'source-manifest.json')
    tests, build = read(validation / 'delta-tests-run.json'), read(validation / 'checks-run.json')
    regressions = read(directory / 'regressions/regression-summary.json')
    V.require(native['digest'] == integrity['nativeSourceDigest'] == ready['nativeSourceDigest']
              == declaration['nativeDigests']['candidate'] == window['nativeDigests']['correction'], 'Candidate native source identity differs')
    V.require(declaration['candidateManifest'] == retain(directory / 'source-manifest.json')
              and declaration['candidateArchiveManifest'] == retain(directory / 'source-archive.json'), 'Cost did not bind this frozen delivery')
    V.require(review['sources'] == decision['sources'] == aggregate['sources'] and aggregate['sources']['after']
              == {k: native[k] for k in ('digest', 'fileCount')}, 'Cost source receipts disagree')
    V.require(aggregate['sources']['baseline']['digest'] == declaration['nativeDigests']['baseline']
              == window['nativeDigests']['baseline'] == policy['baseline']['nativeDigest'], 'Cost baseline identity differs')
    for value in [*cost.values(), *comparisons, integrity, tests, build, regressions]:
        links(value)
    required_render = [retain(path) for path in required if path.name != 'results-render.json' and path.name != 'results.md']
    required_render += [retain(perf / f'cohort{i}/{name}.json') for i in (1, 2) for name in ('baseline', 'after', 'comparison')]
    V.require(all(item in render['inputs'] for item in required_render), 'Rendering omits required official inputs')
    archive = read(directory / 'source-archive.json'); archive_parts = read(directory / 'source-archive-parts.json')
    links(archive); links(archive_parts)
    for row in integrity['byteStorage']['restoredByteIdentical']:
        path = V.repository_path(row['manifest']); parts = read(path)
        for item in [parts['original'], *parts['parts']]:
            retain(path.parent / item['file'], item)
    helper_names = [V.CAMPAIGN_HELPER, V.SOURCE_HELPER, V.TRANSPORT_HELPER, V.RESTORE_HELPER]
    generators = [retain(Path(__file__)), retain(OFFICIAL), *[retain(ROOT / name) for name in helper_names]]
    cost_generators = [review['generator'], decision['generator'], decision['calculationHelper'], render['generator'],
                       aggregate['generator'], *[row['generator'] for row in comparisons]]
    cost_receipts = [retain(perf / (name + '.json')) for name in names]
    campaign = V.load_helper('publication_campaign', V.CAMPAIGN_HELPER)
    original = V.load_helper('publication_original', V.SOURCE_HELPER)
    transport = V.load_helper('publication_transport', V.TRANSPORT_HELPER)

    def inventories():
        n = V.verify_native(native, campaign)
        t, counts = V.verify_tests(tests, native); b, worker = V.verify_build(build, native)
        r, count = V.verify_regressions(directory / 'regressions/regression-summary.json', native, True)
        V.require(counts == integrity['tests'] and worker == integrity['nativeAgentWorker'] and r == regressions, 'Executed validation changed')
        return {'native': n, 'archive': V.check_map(archive['files'], 'frozen archive inputs'), 'sourceAndTests': t,
                'buildInputs': b, 'regressionExecutionInputs': count}

    inputs_before = [records[key] for key in sorted(records)]
    matched = inventories()
    V.require(matched == integrity['matchedFileInventories'], 'Delivery inventory counts differ')
    _, archive_check = V.verify_source_archive(directory, native)
    V.require(archive_check == integrity['sourceArchiveVerification'], 'Frozen source archive changed')
    pinned = V.verify_pinned_source(original)
    V.require(len(pinned[0]) == integrity['originalSourceFilesUnchanged'] and pinned[1] == integrity['originalSourceManifest'], 'Pinned original source changed')
    storage = V.verify_byte_storage(directory, transport)
    V.require(storage == {k: v for k, v in integrity['byteStorage'].items() if k != 'generators'}, 'Completed transport differs')
    V.require(inventories() == matched and V.verify_pinned_source(original) == pinned, 'Inventory changed during verification')
    inputs_after = [current(row['path']) for row in inputs_before]
    V.require(inputs_after == inputs_before, 'Publication input or generator changed during verification')
    result = {'schema': 'logos-engine.native-publication-inputs.v1', 'status': 'passed',
              'recordedAt': datetime.now(timezone.utc).isoformat(), 'qualification': QUALIFICATION,
              'directory': directory.relative_to(ROOT).as_posix(), 'performanceDirectory': perf.relative_to(ROOT).as_posix(),
              'generators': generators, 'inputsBefore': inputs_before, 'inputsAfter': inputs_after, 'inputsUnchanged': True,
              'deliveryIntegrity': records[integrity_path.relative_to(ROOT).as_posix()],
              'nativeSourceDigest': native['digest'], 'matchedFileInventories': matched, 'tests': integrity['tests'],
              'regressions': integrity['regressions'], 'sourceArchiveVerification': archive_check, 'byteStorage': storage,
              'cost': {'status': decision['status'], 'acceptedCases': decision['acceptedCases'], 'totalCases': decision['totalCases'],
                       'generators': cost_generators, 'receipts': cost_receipts,
                       'measuredSessions': decision['measuredSessions'], 'measuredActions': decision['measuredActions'],
                       'arithmeticReviewChecks': review['checkedCount'], 'diagnostics': decision['diagnosticPhaseRule'],
                       'cohortStatuses': [row['status'] for row in comparisons], 'render': retain(perf / 'results-render.json')},
              'functionalExecutions': 0, 'costMeasurements': 0, 'arithmeticRecalculations': 0,
              'scope': 'Existing receipts and executed input inventories only; temporary byte restoration is transport verification. No game, agent, test, build, regression or comparator is executed. No hosting deployment is verified.'}
    with V.confined(output).open('xb') as stream:
        stream.write((json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode())
    print(json.dumps({'status': 'passed', 'receipt': V.fingerprint(output), 'qualification': QUALIFICATION}))


if __name__ == '__main__':
    main()
