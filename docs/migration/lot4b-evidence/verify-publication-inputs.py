#!/usr/bin/env python3
"""Bind unchanged final 4B delivery inputs and the completed qualified cost chain.

CLI: python -B SCRIPT --directory FROZEN_DIR --performance PERFORMANCE_DIR
Exclusive output: FROZEN_DIR/publication-inputs.json. This wrapper imports only
the existing delivery verification helpers. It executes no game, replay, test,
build, original-source comparison or cost calculation. It never overwrites the
delivery-integrity.json already consumed by readiness.
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
BASE = ROOT / 'docs/migration/lot4b-evidence'
OFFICIAL = ROOT / 'scripts/verify-native-delivery.py'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--performance', required=True)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('lot4b_delivery_helpers', OFFICIAL)
    V = importlib.util.module_from_spec(spec); spec.loader.exec_module(V)
    directory, perf = V.confined(args.directory), V.confined(args.performance)
    V.require(directory.is_relative_to(BASE) and perf.is_relative_to(BASE), 'Expected separate final 4B evidence directories')
    V.require(directory != perf, 'Delivery and performance directories must be distinct')
    output = V.confined(directory / 'publication-inputs.json')
    V.require(not output.exists(), 'Publication receipt already exists; refusing overwrite')
    records, baseline_root = {}, None

    def fingerprint(path):
        path = Path(path); path = path if path.is_absolute() else ROOT / path
        boundary = ROOT if path.is_relative_to(ROOT) else baseline_root
        V.require(boundary is not None, 'Undeclared external baseline input')
        V.require(path.resolve(strict=True) == path, 'Input paths must not traverse symlinks or aliases')
        result = V.fingerprint(V.confined(path, boundary), boundary)
        if boundary != ROOT:
            result['path'] = str(path)
        return result

    def retain(path, expected=None):
        actual = fingerprint(path)
        V.require(expected is None or all(actual[key] == expected[key] for key in ('sha256', 'bytes') if key in expected),
                  'Linked input changed: ' + str(path))
        V.require(records.setdefault(actual['path'], actual) == actual, 'Input changed during verification')
        return actual

    def read(path):
        retain(path)
        return V.read_json(path)

    def links(value):
        if isinstance(value, dict):
            if {'path', 'sha256'} <= value.keys():
                V.require(V.valid_digest(value['sha256']), 'Invalid linked fingerprint')
                retain(value['path'], value)
            for child in value.values():
                links(child)
        elif isinstance(value, list):
            for child in value:
                links(child)

    names = ['declaration', 'global-budget-policy', 'preparation', 'protocol-check', 'static-preflight', 'readiness',
             'window', 'owner-growth-contract', 'owner-growth-comparison', 'owner-growth-review', 'aggregation-failure',
             'log-transport', 'results-render']
    cost = {name: read(perf / (name + '.json')) for name in names}
    declaration, policy, preparation = (cost[key] for key in names[:3])
    ready, window, contract, aggregate, review = (cost[key] for key in names[5:10])
    strict, log_transport, render = (cost[key] for key in names[10:])
    baseline_root = Path(preparation['baselineCheckout'])
    V.require(baseline_root.is_absolute() and baseline_root.resolve(strict=True) == baseline_root
              and baseline_root != ROOT and window['baselineCheckout'] == str(baseline_root), 'Exact baseline checkout differs')
    V.require(window['status'] == window['finalIntegrity'] == 'passed'
              and window['plannedOrder'] == [row['label'] for row in window['executions']] == ['A1', 'B1', 'B2', 'A2']
              and all(row['status'] == 'passed' and row['exitCode'] == 0 for row in window['executions']), 'Completed ABBA window required')
    V.require(ready['status'] == 'ready' and ready['measurementAuthorized'] is True and ready['pendingRequirements'] == [], 'Completed readiness required')
    V.require(contract['schema'] == 'logos-engine.lot4b-owner-cost-contract.v2'
              and contract['declaration'] == retain(perf / 'declaration.json')
              and contract['tools'] == declaration['ownerCostQualification']['tools']
              and ready['ownerCostContract'] == retain(perf / 'owner-growth-contract.json'), 'Owner contract binding differs')
    V.require(aggregate['schema'] == 'logos-engine.lot4b-owner-cost-consolidation.v2'
              and aggregate['status'] == 'qualified_consolidation_complete'
              and review['schema'] == 'logos-engine.lot4b-owner-cost-review.v2'
              and review['status'] == 'qualified_owner_cost_review_passed'
              and review['checkedCount'] == len(review['checks']) > 0 and all(row['passed'] is True for row in review['checks'])
              and review['inputsUnchanged'] is True and review['structuralProof'] is True
              and review['aggregate'] == retain(perf / 'owner-growth-comparison.json'), 'Independent qualified calculation is incomplete')
    V.require(review['generator'] == contract['tools']['reviewer'] and aggregate['generator'] == contract['tools']['consolidator']
              and review.get('postMeasurementIoCorrection', False) is False
              and aggregate.get('postMeasurementIoCorrection', False) is False, 'Executed tools differ from premeasurement declaration')
    V.require(review['contract'] == aggregate['contract'] == retain(perf / 'owner-growth-contract.json')
              and review['declaration'] == aggregate['declaration'] == retain(perf / 'declaration.json')
              and review['structuralFixture'] == aggregate['inputs']['structuralFixture'] == contract['structuralFixture'],
              'Qualified receipts do not bind this exact contract and declaration')
    for key, name in [('window', 'window'), ('readiness', 'readiness'), ('staticPreflight', 'static-preflight')]:
        V.require(aggregate['inputs'][key] == retain(perf / (name + '.json')), 'Aggregate names a different execution chain')
    V.require(review['accepted'] is review['globalAccepted'] is aggregate['globalAccepted'] is True
              and review['acceptedCases'] == review['totalCases'] == len(review['globalCases']) == 2
              and all(row['accepted'] is True for row in review['globalCases'])
              and review['globalCases'] == aggregate['globalCases']
              and review['globalStatus'] == aggregate['globalStatus'] == 'accepted_under_predeclared_owner_cost_rule', 'Global budget does not permit release')
    V.require(review['historicalStrictPassed'] is False and aggregate['historicalStrict']['passed'] is False
              and review['historicalStrict'] == aggregate['historicalStrict']
              and strict['schema'] == 'logos-engine.retained-tool-failure.v1' and strict['exitCode'] != 0
              and strict['inputsUnchanged'] is True and strict['outputExists'] is False
              and not (perf / 'combined-comparison.json').exists(), 'Historical strict refusal must remain unchanged')
    V.require(review['historicalStrict']['failureReceipt'] == retain(perf / 'aggregation-failure.json')
              and review['historicalStrict']['failureLog'] == retain(perf / 'aggregation-failure.log'),
              'Qualified analysis names another historical refusal')
    V.require(aggregate['method']['workMetadataExactAcrossVersions'] is False
              and aggregate['method']['workMetadataExactWithinEachVersion'] is True
              and aggregate['method']['behaviorMetadataExactAcrossVersions'] is True, 'Structural qualification was lost')
    for key, expected in [('measuredSessions', 32), ('measuredActions', 400), ('excludedWarmupSessions', 8), ('excludedWarmupActions', 24)]:
        V.require(review[key] == aggregate[key] == declaration[key] == policy[key] == expected, 'Cost population differs')
    V.require(review['comparisons'] == aggregate['comparisons'] and review['cohortComparisons'] == aggregate['cohortComparisons']
              and review['structuralDifferences'] == aggregate['structuralDifferences'], 'Adverse phases, cohorts or structural rows changed')
    V.require(render['schema'] == 'logos-engine.lot4b-cost-report-render.v1' and render['status'] == 'rendered_retained_receipts'
              and render['inputReceiptsUnchanged'] is True and render['runtimeOrGameExecuted'] is False
              and render['measurementExecuted'] is False and render['report'] == retain(perf / 'results.md')
              and log_transport['status'] == 'passed' and log_transport['window'] == retain(perf / 'window.json'), 'Rendering or log transport is incomplete')
    V.require(render['generator'] == retain(BASE / 'write-cost-results.py')
              and all(retain(perf / (name + '.json')) in render['inputs'] for name in
                      ['window', 'readiness', 'owner-growth-comparison', 'owner-growth-review', 'log-transport']),
              'Rendered report omits this exact completed cost chain')
    integrity_path = directory / 'delivery-integrity.json'; integrity = read(integrity_path)
    V.require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1' and integrity['status'] == 'passed'
              and retain(integrity_path) in ready['inputs'], 'Readiness does not bind this preserved delivery integrity')
    validation = V.repository_path(integrity['validationDirectory']); V.confined(validation, directory)
    native, archive = read(directory / 'source-manifest.json'), read(directory / 'source-archive.json')
    tests, build = read(validation / 'delta-tests-run.json'), read(validation / 'checks-run.json')
    regressions = read(directory / 'regressions/regression-summary.json')
    V.require(native['digest'] == integrity['nativeSourceDigest'] == ready['nativeSourceDigest']
              == declaration['nativeDigests']['candidate'] == window['nativeDigests']['correction']
              and aggregate['sources'] == review['sources']
              and review['sources']['after'] == {key: native[key] for key in ('digest', 'fileCount')}, 'Candidate source identities differ')
    V.require(declaration['candidateManifest'] == retain(directory / 'source-manifest.json')
              and declaration['candidateArchiveManifest'] == retain(directory / 'source-archive.json'), 'Costs refer to another delivery freeze')
    for value in [*cost.values(), integrity, tests, build, regressions, archive, read(directory / 'source-archive-parts.json')]:
        links(value)
    performance_parts = [path for path in V.walk_files(perf) if path.name.endswith('.json.gz.parts.json')]
    for root_dir in (directory, perf):
        for path in V.walk_files(root_dir):
            if path.name.endswith('.json.gz.parts.json'):
                parts = read(path)
                for item in [parts['original'], *parts['parts']]:
                    retain(path.parent / item['file'], item)
    helpers = [V.CAMPAIGN_HELPER, V.SOURCE_HELPER, V.TRANSPORT_HELPER, V.RESTORE_HELPER]
    generators = [retain(Path(__file__)), retain(OFFICIAL), *[retain(ROOT / name) for name in helpers]]
    campaign = V.load_helper('lot4b_publication_campaign', V.CAMPAIGN_HELPER)
    original = V.load_helper('lot4b_publication_original', V.SOURCE_HELPER)
    transport = V.load_helper('lot4b_publication_transport', V.TRANSPORT_HELPER)

    def inventories():
        n = V.verify_native(native, campaign); t, counts = V.verify_tests(tests, native); b, worker = V.verify_build(build, native)
        r, count = V.verify_regressions(directory / 'regressions/regression-summary.json', native, True)
        V.require(counts == integrity['tests'] and worker == integrity['nativeAgentWorker'] and r == regressions, 'Executed validation changed')
        return {'native': n, 'archive': V.check_map(archive['files'], 'frozen archive inputs'), 'sourceAndTests': t,
                'buildInputs': b, 'regressionExecutionInputs': count}

    before = [records[key] for key in sorted(records)]
    matched = inventories(); V.require(matched == integrity['matchedFileInventories'], 'Frozen inventory counts differ')
    _, archive_check = V.verify_source_archive(directory, native)
    pinned = V.verify_pinned_source(original)
    V.require(archive_check == integrity['sourceArchiveVerification'] and len(pinned[0]) == integrity['originalSourceFilesUnchanged']
              and pinned[1] == integrity['originalSourceManifest'], 'Frozen archive or pinned originals changed')
    storage = V.verify_byte_storage(directory, transport); performance_storage = V.verify_byte_storage(perf, transport)
    V.require(storage == {key: value for key, value in integrity['byteStorage'].items() if key != 'generators'}, 'Delivery transport changed')
    V.require(performance_storage['reports'] >= 2
              and [path for path in V.walk_files(perf) if path.name.endswith('.json.gz.parts.json')] == performance_parts,
              'Both functional graph captures require unchanged byte transport')
    V.require(inventories() == matched and V.verify_pinned_source(original) == pinned, 'Inputs changed during final verification')
    after = [fingerprint(row['path']) for row in before]
    V.require(after == before and not (perf / 'combined-comparison.json').exists(), 'Input changed or strict output appeared')
    result = {'schema': 'logos-engine.lot4b-publication-inputs.v1', 'status': 'integrity_verified_with_predeclared_owner_cost',
        'recordedAt': datetime.now(timezone.utc).isoformat(), 'generators': generators,
        'directory': directory.relative_to(ROOT).as_posix(), 'performanceDirectory': perf.relative_to(ROOT).as_posix(),
        'nativeVersion': policy['candidate']['nativeVersion'], 'nativeSourceDigest': native['digest'],
        'deliveryIntegrity': retain(integrity_path), 'matchedFileInventories': matched, 'tests': integrity['tests'],
        'regressions': integrity['regressions'], 'partialRegression': ready.get('partialRegression'),
        'inputsBefore': before, 'inputsAfter': after, 'inputsUnchanged': True,
        'sourceArchiveVerification': archive_check, 'byteStorage': storage, 'performanceByteStorage': performance_storage,
        'historicalStrictPassed': False, 'workMetadataExactAcrossVersions': False,
        'cost': {'review': retain(perf / 'owner-growth-review.json'), 'aggregate': retain(perf / 'owner-growth-comparison.json'),
                 'globalStatus': review['globalStatus'], 'arithmeticReviewChecks': review['checkedCount'],
                 'diagnosticPhaseRule': review['diagnosticPhaseRule'], 'render': retain(perf / 'results-render.json')},
        'runtimeOrGameExecuted': False, 'measurementExecuted': False,
        'qualification': 'same executed inputs, no new functional execution. File integrity and byte transport only. The premeasurement owner qualification and independent cost decision retain their limits; historical strict aggregation remains failed. This is not publication, a new live success, a new performance calculation or proof of uncaptured private measured graph leaves.'}
    with output.open('x') as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False); stream.write('\n')
    print(json.dumps({'status': result['status'], 'receipt': fingerprint(output)}))


if __name__ == '__main__':
    main()
