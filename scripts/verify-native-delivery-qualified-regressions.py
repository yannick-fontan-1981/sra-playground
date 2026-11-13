#!/usr/bin/env python3
"""Verify delivery integrity with an explicitly qualified regression difference.

Usage: python -B scripts/verify-native-delivery-qualified-regressions.py DIRECTORY
       --regression-verifier SCRIPT --regression-receipt PATH
       [--validation-directory PATH] [--receipt FILE ...]

Run only after final validation, browser checks and evidence packing. This uses
unchanged verify-native-delivery.py helpers for native/source archives, tests,
build, 1786 original source files and lossless evidence transport. Only its
regression acceptance contract is replaced: strict 32/34 failure must remain
recorded, and the supplied verifier must reproduce the retained empty-observer
extension diagnostic. Nothing is patched or rewritten. Output is exclusive:
DIRECTORY/delivery-integrity-qualified.json. Additional receipts are only
fingerprinted. This command runs no game, agent, test, build or benchmark.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
LEGACY_PATH = ROOT / 'scripts/verify-native-delivery.py'
LEGACY_SHA256 = 'ca36a235e5da8aa8abd963aaa6a282d90217ed58a721bfdbba361527dd48409a'
if hashlib.sha256(LEGACY_PATH.read_bytes()).hexdigest() != LEGACY_SHA256:
    raise ValueError('Unchanged delivery verification helper differs from its retained version')
spec = importlib.util.spec_from_file_location('unchanged_native_delivery_verification', LEGACY_PATH)
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)
require = legacy.require

QUALIFICATION = (
    'Post-validation file integrity, lossless evidence transport and the explicitly qualified empty-observer '
    'extension diagnostic only. The native inventory, frozen source archive, successful recorded tests/build, '
    '1786 pinned original source files and byte reconstruction use unchanged verify-native-delivery.py helpers. '
    'Only that verifier\'s regression acceptance contract is replaced, visibly in this distinct receipt schema. '
    'The unchanged historical regression summary and comparator outputs remain failed: 32/34 checks and zero '
    'of two strict case passes. The supplied diagnostic is recomputed before and after transport verification '
    'and must exactly match its retained receipt apart from its computation timestamp. It establishes only '
    'the documented empty observer-extension compatibility: the new counter is zero and the new event list '
    'empty, with original integer counters strictly equal. Supplemental inherited-payload equality uses '
    'only the diagnostic\'s declared namespace normalization and digest exclusions; raw private state or '
    'digest equality is not claimed. Empty passive-owner requirements provide zero passive-owner coverage. '
    'All native, harness, regression execution and diagnostic inputs are checked unchanged before and after. '
    'Additional receipts are fingerprinted only. This is not 34/34 historical regression success, a new '
    'campaign, complete source migration, game improvement, a performance verdict or closure of any delivery lot.'
)


def without_timestamp(value):
    return {key: item for key, item in value.items() if key != 'recordedAt'}


def verify_qualified_regressions(summary_path, native, verifier, verifier_path, receipt_path):
    """Keep the failed historical gate and verify its separate, narrow diagnostic."""
    value = legacy.read_json(summary_path)
    require(value.get('schema') == 'logos-engine.recorded-public-regressions.v1', 'Unexpected historical regression schema')
    require(value.get('status') == 'failed' and type(value.get('passed')) is int and value['passed'] == 0
            and type(value.get('total')) is int and value['total'] == 2, 'Strict failed regression status must remain unchanged')
    require(value.get('comparisonChecksPassed') == 32 and value.get('comparisonChecksExpected') == 34,
            'Retained strict regression result must remain 32/34')
    require(value.get('nativeSource') == native and value.get('nativeSourceAfter') == native
            and value.get('executionInputsUnchanged') is True
            and value.get('executionInputs') == value.get('executionInputsAfter'), 'Regression native or execution inputs changed')
    count = legacy.check_map(value['executionInputs'], 'qualified regression execution inputs')
    legacy.check_record(value['caseManifest'])
    results = value.get('results')
    require(isinstance(results, list) and len(results) == value['total']
            and all(row.get('passed') is False and row.get('comparisonPassed') is False
                    and row.get('status') == 'passed' and type(row.get('exitCode')) is int and row['exitCode'] == 0
                    and row.get('timedOut') is False for row in results),
            'Expected completed replays with explicitly failed historical comparisons')
    require(value.get('passiveOwnerRequirements') == []
            and all(type(value.get(key)) is int and value[key] == 0 for key in (
                'passiveOwnerPrefixesChecked', 'passiveOwnerPrefixesPassed', 'passiveOwnerTransitionsRetained')),
            'Empty owner requirements cannot establish passive-owner coverage')
    retained = legacy.read_json(receipt_path)
    require(legacy.check_record(retained['generator']) == verifier_path,
            'The retained diagnostic was generated by another verifier')
    require(legacy.check_record(retained['strictSummary']) == summary_path,
            'Diagnostic names another strict regression summary')
    require(callable(getattr(verifier, 'verify', None)), 'Regression verifier has no importable verify(receipt_path)')
    verified = verifier.verify(receipt_path)
    require(isinstance(verified, dict) and without_timestamp(verified) == without_timestamp(retained),
            'Qualified diagnostic does not reproduce its retained receipt')
    expected = {
        'schema': 'logos-engine.lot3c.empty-series-diagnostic-contract.v1',
        'status': 'qualified_empty_observer_extension', 'nativeSourceDigest': native['digest'],
        'strictStatus': 'failed', 'strictCasePasses': 0, 'strictCasesExpected': 2,
        'strictChecksPassed': 32, 'strictChecksExpected': 34, 'strictChecksExactlyReproduced': True,
        'inputsUnchangedAfterComparison': True,
        'passiveOwnerCoverage': {'requirements': 0, 'owners': 0, 'prefixesChecked': 0, 'transitionsRetained': 0},
    }
    require(all(verified.get(key) == item and type(verified.get(key)) is type(item) for key, item in expected.items()),
            'Qualified regression contract is broader than the retained empty extension')
    require(verified.get('sealedPrefixes') == value['prevalidatedTotals']['prefixes']
            == verified.get('newCounterZeroPrefixes') == verified.get('newAcquiredEventsEmptyPrefixes'),
            'Not every retained sealed prefix has the zero/empty extension')
    records = verified.get('inputs')
    require(isinstance(records, list) and len(records) > 0, 'Missing qualified regression input fingerprints')
    paths = [legacy.check_record(record) for record in records]
    require(len(paths) == len(set(paths)) and summary_path in paths and verifier_path in paths,
            'Diagnostic input inventory is incomplete or ambiguous')
    recorded = {record['path']: record for record in records}
    for name, digest in value['executionInputs'].items():
        require(name in recorded and recorded[name]['sha256'] == digest,
                'Regression execution input is not bound by the diagnostic: ' + name)
    return value, count, retained, records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', help='Completed frozen delivery directory inside this repository')
    parser.add_argument('--regression-verifier', required=True, metavar='SCRIPT', help='Existing importable diagnostic verifier inside the repository')
    parser.add_argument('--regression-receipt', required=True, metavar='PATH', help='Existing diagnostic receipt confined inside DIRECTORY')
    parser.add_argument('--validation-directory', default='validation', metavar='PATH')
    parser.add_argument('--receipt', action='append', default=[], metavar='FILE', help='Additional existing receipt to fingerprint; repeatable')
    args = parser.parse_args()
    directory = legacy.confined(args.directory)
    require(directory.is_dir(), 'Delivery directory does not exist')
    validation = legacy.extra_receipt(args.validation_directory, directory)
    require(validation.is_dir(), 'Validation directory does not exist')
    verifier_path = legacy.confined(args.regression_verifier)
    require(verifier_path.is_file() and verifier_path.suffix == '.py', 'Regression verifier must be an existing Python source')
    regression_receipt = legacy.extra_receipt(args.regression_receipt, directory)
    require(regression_receipt.is_file(), 'Qualified regression receipt does not exist')
    output = legacy.confined(directory / 'delivery-integrity-qualified.json')
    if output.exists() or output.is_symlink():
        raise FileExistsError('Qualified delivery receipt is exclusive: ' + str(output))

    campaign = legacy.load_helper('qualified_delivery_campaign', legacy.CAMPAIGN_HELPER)
    original = legacy.load_helper('qualified_delivery_original', legacy.SOURCE_HELPER)
    transport = legacy.load_helper('qualified_delivery_transport', legacy.TRANSPORT_HELPER)
    verifier = legacy.load_helper('qualified_delivery_regression_verifier', verifier_path.relative_to(ROOT).as_posix())
    helper_paths = [LEGACY_PATH, verifier_path, *[legacy.repository_path(name) for name in (
        legacy.CAMPAIGN_HELPER, legacy.SOURCE_HELPER, legacy.TRANSPORT_HELPER, legacy.RESTORE_HELPER)]]
    helpers = [legacy.fingerprint(path) for path in helper_paths]
    generator = legacy.fingerprint(Path(__file__))
    regression_path = directory / 'regressions/regression-summary.json'
    paths = [directory / 'source-manifest.json', directory / 'source-archive.json', directory / 'source-archive-parts.json',
             validation / 'delta-tests-run.json', validation / 'checks-run.json', regression_path, regression_receipt]
    paths.extend(legacy.extra_receipt(name, directory) for name in args.receipt)
    paths = list(dict.fromkeys(paths))
    receipts_before = [legacy.fingerprint(path) for path in paths]

    native = legacy.read_json(paths[0])
    native_count = legacy.verify_native(native, campaign)
    archive, archive_check = legacy.verify_source_archive(directory, native)
    tests = legacy.read_json(validation / 'delta-tests-run.json')
    test_count, counts = legacy.verify_tests(tests, native)
    build = legacy.read_json(validation / 'checks-run.json')
    build_count, worker = legacy.verify_build(build, native)
    regressions, regression_count, diagnostic, diagnostic_inputs = verify_qualified_regressions(
        regression_path, native, verifier, verifier_path, regression_receipt)
    pinned_before, pinned_manifest = legacy.verify_pinned_source(original)
    byte_storage = legacy.verify_byte_storage(directory, transport)
    byte_storage['generators'] = [legacy.fingerprint(legacy.repository_path(name))
                                 for name in (legacy.TRANSPORT_HELPER, legacy.RESTORE_HELPER)]

    # These are the unchanged delivery checks, with the one explicit qualified
    # regression call. No function, status, result, source file or module is patched.
    require(legacy.verify_native(native, campaign) == native_count, 'Native inventory changed during verification')
    legacy.check_map(archive['files'], 'archive inputs after transport')
    require(legacy.verify_tests(tests, native) == (test_count, counts), 'Test inventory changed during verification')
    require(legacy.verify_build(build, native) == (build_count, worker), 'Build inventory changed during verification')
    require(verify_qualified_regressions(regression_path, native, verifier, verifier_path, regression_receipt)
            == (regressions, regression_count, diagnostic, diagnostic_inputs),
            'Regression summary, diagnostic or execution inputs changed during verification')
    require(legacy.verify_pinned_source(original) == (pinned_before, pinned_manifest), 'Pinned source changed during verification')
    require([legacy.fingerprint(path) for path in paths] == receipts_before, 'Delivery receipts changed during verification')
    require(legacy.fingerprint(Path(__file__)) == generator and [legacy.fingerprint(path) for path in helper_paths] == helpers,
            'Verification helpers changed during execution')
    for record in diagnostic_inputs:
        legacy.check_record(record)

    regression_fields = ['status', 'passed', 'total', 'comparisonChecksPassed', 'comparisonChecksExpected',
                         'passiveOwnerRequirements', 'passiveOwnerPrefixesChecked', 'passiveOwnerPrefixesPassed',
                         'passiveOwnerTransitionsRetained', 'prevalidatedTotals']
    diagnostic_fields = ['status', 'strictStatus', 'strictCasePasses', 'strictCasesExpected', 'strictChecksPassed',
                         'strictChecksExpected', 'strictChecksExactlyReproduced', 'sealedPrefixes',
                         'inheritedIntegerCountValuesStrictlyEqual', 'newCounterZeroPrefixes',
                         'newAcquiredEventsEmptyPrefixes', 'passiveOwnerCoverage', 'declaredNormalization', 'qualification']
    result = {
        'schema': 'logos-engine.native-delivery-integrity-qualified-regressions.v1',
        'status': 'integrity_passed_with_qualified_regression_difference',
        'recordedAt': datetime.now(timezone.utc).isoformat(), 'directory': directory.relative_to(ROOT).as_posix(),
        'validationDirectory': validation.relative_to(ROOT).as_posix(), 'generator': generator,
        'verificationHelpers': helpers, 'nativeSourceDigest': native['digest'],
        'scope': {'fileIntegrity': True, 'losslessEvidenceTransport': True, 'qualifiedEmptyObserverExtension': True,
                  'historicalRegressionGatePassed': False, 'passiveOwnerCoverageClaimed': False},
        'replacedContract': {'helper': LEGACY_PATH.relative_to(ROOT).as_posix(), 'function': 'verify_regressions',
                             'originalRequirement': 'All historical recorded comparisons passed',
                             'qualifiedRequirement': 'Strict failed 32/34 evidence unchanged; supplied empty-extension diagnostic exactly reproduced before and after',
                             'allOtherDeliveryChecksUseUnchangedHelpers': True},
        'matchedFileInventories': {'native': native_count, 'archive': archive_check['files'], 'sourceAndTests': test_count,
                                  'buildInputs': build_count, 'regressionExecutionInputs': regression_count},
        'originalSourceFilesUnchanged': len(pinned_before), 'originalSourceManifest': pinned_manifest,
        'tests': counts, 'regressions': {key: regressions[key] for key in regression_fields},
        'regressionQualification': {'verifier': legacy.fingerprint(verifier_path),
                                    'receipt': legacy.fingerprint(regression_receipt),
                                    'reproducedBeforeAndAfterTransport': True,
                                    'diagnostic': {key: diagnostic[key] for key in diagnostic_fields},
                                    'inputs': diagnostic_inputs},
        'nativeAgentWorker': worker, 'sourceArchiveVerification': archive_check, 'byteStorage': byte_storage,
        'receipts': receipts_before, 'qualification': QUALIFICATION,
    }
    payload = (json.dumps(result, indent=2, allow_nan=False) + '\n').encode()
    legacy.confined(output)
    with output.open('xb') as stream:
        stream.write(payload)
    print(json.dumps({'status': result['status'], 'receipt': legacy.fingerprint(output),
                      'nativeSourceDigest': native['digest'], 'inventories': result['matchedFileInventories'],
                      'strictRegressionStatus': regressions['status'], 'strictChecksPassed': regressions['comparisonChecksPassed'],
                      'strictChecksExpected': regressions['comparisonChecksExpected'],
                      'passiveOwnerCoverage': diagnostic['passiveOwnerCoverage'],
                      'byteReports': byte_storage['reports'], 'byteParts': byte_storage['parts'],
                      'restoredBytes': byte_storage['bytes']}))


if __name__ == '__main__':
    main()
