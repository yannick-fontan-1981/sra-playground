#!/usr/bin/env python3
"""Verify completed 6A bytes with the unchanged common delivery verifier.

Only reads completed receipts, restores byte parts into a temporary empty
directory, and writes an exclusive delivery-integrity.json. No game, test,
build, source comparison, cost measurement or publication is executed.
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
BASE = Path(__file__).resolve().parent
COMMON = ROOT / 'scripts/verify-native-delivery.py'
spec = importlib.util.spec_from_file_location('lot6a_common_delivery_integrity', COMMON)
common = importlib.util.module_from_spec(spec)
spec.loader.exec_module(common)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--validation-directory', default='validation')
    parser.add_argument('--regression-summary', type=Path, required=True)
    parser.add_argument('--receipt', action='append', default=[])
    parser.add_argument('--require-regressions', action='store_true',
                        help='Retained compatibility option; completed regressions are always required for 6A.')
    args = parser.parse_args()
    directory = common.confined(args.directory)
    common.require(directory.is_dir() and directory.is_relative_to(BASE), 'Expected completed 6A evidence directory')
    validation = common.extra_receipt(args.validation_directory, directory)
    common.require(validation.is_dir(), 'Missing validation directory')
    output = common.confined(directory / 'delivery-integrity.json')
    common.require(not output.exists() and not output.is_symlink(), 'Delivery integrity output is exclusive')
    predecessor = common.read_json(BASE.parent / 'lot5b-evidence/integrated-final/delivery-integrity.json')
    common.require(predecessor.get('generator') == common.fingerprint(COMMON),
                   'The common verifier differs from the published 5B verifier')
    campaign = common.load_helper('lot6a_integrity_campaign', common.CAMPAIGN_HELPER)
    original = common.load_helper('lot6a_integrity_original', common.SOURCE_HELPER)
    transport = common.load_helper('lot6a_integrity_transport', common.TRANSPORT_HELPER)
    helpers = [common.fingerprint(COMMON), *[common.fingerprint(common.repository_path(name))
               for name in [common.CAMPAIGN_HELPER, common.SOURCE_HELPER, common.TRANSPORT_HELPER, common.RESTORE_HELPER]]]
    generator = common.fingerprint(Path(__file__))
    regression_path = common.confined(args.regression_summary)
    common.require(regression_path.is_relative_to(directory), 'Regression summary escapes the completed candidate evidence')
    paths = [directory / 'source-manifest.json', directory / 'source-archive.json', directory / 'source-archive-parts.json',
             validation / 'delta-tests-run.json', validation / 'checks-run.json', regression_path,
             BASE.parent / 'lot5b-evidence/integrated-final/delivery-integrity.json']
    paths.extend(common.extra_receipt(name, directory) for name in args.receipt)
    paths = list(dict.fromkeys(paths))
    receipts_before = [common.fingerprint(path) for path in paths]
    native = common.read_json(paths[0])
    native_count = common.verify_native(native, campaign)
    archive, archive_check = common.verify_source_archive(directory, native)
    tests = common.read_json(validation / 'delta-tests-run.json')
    test_count, counts = common.verify_tests(tests, native)
    build = common.read_json(validation / 'checks-run.json')
    build_count, worker = common.verify_build(build, native)
    regressions, regression_count = common.verify_regressions(regression_path, native, True)
    composition_inputs = []
    if regressions.get('composition') is not None:
        composer_path = BASE / 'consolidate-regression-recovery.py'
        composer = common.load_helper('lot6a_integrity_regression_composition', composer_path.relative_to(ROOT).as_posix())
        common.require(composer.verify_summary(regression_path, native) == regressions, 'Composed regression evidence changed')
        composition_inputs = regressions['composition']['inputs']
        helpers.append(common.fingerprint(composer_path))
    pinned_before, pinned_manifest = common.verify_pinned_source(original)
    byte_storage = common.verify_byte_storage(directory, transport)
    byte_storage['generators'] = [common.fingerprint(common.repository_path(name))
                                 for name in [common.TRANSPORT_HELPER, common.RESTORE_HELPER]]
    common.require(common.verify_native(native, campaign) == native_count, 'Native inventory changed during verification')
    common.check_map(archive['files'], 'archive inputs after transport')
    common.require(common.verify_tests(tests, native) == (test_count, counts), 'Test inventory changed during verification')
    common.require(common.verify_build(build, native) == (build_count, worker), 'Build inventory changed during verification')
    common.require(common.verify_regressions(regression_path, native, True)[0] == regressions, 'Regressions changed during verification')
    for record in composition_inputs:
        common.check_record(record)
    common.require(common.verify_pinned_source(original) == (pinned_before, pinned_manifest), 'Pinned original source changed')
    common.require([common.fingerprint(path) for path in paths] == receipts_before, 'Receipts changed during verification')
    common.require(common.fingerprint(Path(__file__)) == generator
                   and [common.fingerprint(common.repository_path(row['path'])) for row in helpers] == helpers,
                   'Verification implementations changed during execution')
    fields = ['passed', 'total', 'comparisonChecksPassed', 'comparisonChecksExpected', 'passiveOwnerPrefixesChecked',
              'passiveOwnerPrefixesPassed', 'passiveOwnerTransitionsRetained', 'prevalidatedTotals']
    result = {'schema': 'logos-engine.native-delivery-integrity.v1', 'status': 'passed',
              'recordedAt': datetime.now(timezone.utc).isoformat(), 'directory': directory.relative_to(ROOT).as_posix(),
              'validationDirectory': validation.relative_to(ROOT).as_posix(), 'generator': generator,
              'verificationHelpers': helpers, 'nativeSourceDigest': native['digest'],
              'matchedFileInventories': {'native': native_count, 'archive': archive_check['files'], 'sourceAndTests': test_count,
                                         'buildInputs': build_count, 'regressionExecutionInputs': regression_count},
              'originalSourceFilesUnchanged': len(pinned_before), 'originalSourceManifest': pinned_manifest,
              'tests': counts, 'regressions': {key: regressions[key] for key in fields}, 'nativeAgentWorker': worker,
              'regressionSummary': common.fingerprint(regression_path),
              'regressionEvidenceMode': regressions.get('mode', 'single_completed_invocation'),
              'sourceArchiveVerification': archive_check, 'byteStorage': byte_storage, 'receipts': receipts_before,
              'qualification': common.QUALIFICATION}
    payload = (json.dumps(result, indent=2, allow_nan=False) + '\n').encode()
    with common.confined(output).open('xb') as stream:
        stream.write(payload)
    print(json.dumps({'status': 'passed', 'receipt': common.fingerprint(output), 'nativeSourceDigest': native['digest'],
                      'inventories': result['matchedFileInventories'], 'byteReports': byte_storage['reports']}))


if __name__ == '__main__':
    main()
