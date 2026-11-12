#!/usr/bin/env python3
"""Review four ordinary development batch receipts without a global lock; never run tests.

Manifest: schema=logos-engine.lot10c.development-test-partition.v1,
developmentOnly=true, fullTestFiles=[56], excludedClosedCaseModules=[the exact
three inherited exclusions], batches=[{index:1,testFiles:[14]},...,{index:4,...}].

CLI: review-ordinary-test-batches.py FREEZE --batch-manifest PARTITION --extra-tests EXTRA
     --output NEW.json
This derived receipt is not a monolithic execution or an accepted final gate.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
PARTITION_SCHEMA = 'logos-engine.lot10c.development-test-partition.v1'
BATCH_SCHEMA = 'logos-engine.lot10c.development-test-batch.v1'
SUMMARY_SCHEMA = 'logos-engine.lot10c.development-test-batch-review.v1'
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')
NODE_PREFIX = ['node', '--test', '--test-concurrency=1', '--test-reporter=tap']
EXCLUDED = ['tests/v6-ranked-workshop-kernel.test.ts', 'tests/v6-ranked-workshop-reference.test.ts', 'tests/v6-symbol-transactions-kernel.test.ts']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON property: ' + key)
        result[key] = value
    return result


def decode(raw):
    def invalid(value):
        raise ValueError('Non-finite JSON number: ' + value)
    return json.loads(raw, object_pairs_hook=unique_object, parse_constant=invalid)


def encode(value):
    return json.dumps(value, allow_nan=False, sort_keys=True, separators=(',', ':')).encode()


def fingerprint_bytes(path, raw):
    return {'path': path, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def local_path(name, root=ROOT):
    path = root / name
    require(path.resolve(strict=True) == path and path.is_relative_to(root) and path.is_file(), 'Noncanonical or missing retained input: ' + str(name))
    return path


def fingerprint(path, root=ROOT):
    path = Path(path)
    if not path.is_absolute():
        path = root / path
    path = local_path(path, root)
    return fingerprint_bytes(path.relative_to(root).as_posix(), path.read_bytes())


def validate_partition(value, full_tests, excluded):
    require(isinstance(value, dict) and value.get('schema') == PARTITION_SCHEMA and value.get('developmentOnly') is True,
            'An explicit development-only partition is required')
    require(isinstance(full_tests, list) and len(full_tests) == len(set(full_tests)) == 56, 'Expected exactly 56 distinct full-scope files')
    require(excluded == EXCLUDED and value.get('excludedClosedCaseModules') == EXCLUDED, 'The exact three whole-module exclusions are required')
    require(not set(full_tests).intersection(EXCLUDED), 'Closed eager module in test scope')
    for name in full_tests:
        require(isinstance(name, str) and name.startswith('tests/') and name.endswith('.test.ts')
                and PurePosixPath(name).as_posix() == name and '..' not in PurePosixPath(name).parts,
                'Noncanonical test-module path')
    require(value.get('fullTestFiles') == full_tests, 'Partition full scope differs from scope(extra)')
    batches = value.get('batches')
    require(isinstance(batches, list) and len(batches) == 4, 'Exactly four batches are required')
    combined = []
    for index, batch in enumerate(batches, 1):
        require(isinstance(batch, dict) and set(batch) == {'index', 'testFiles'} and type(batch['index']) is int
                and batch['index'] == index and isinstance(batch['testFiles'], list) and len(batch['testFiles']) == 14,
                'Each ordered batch must declare exactly 14 files')
        combined.extend(batch['testFiles'])
    require(len(combined) == len(set(combined)) == 56 and combined == full_tests,
            'Batch partition must be disjoint and reproduce the full ordered scope exactly')
    return batches


def batch_scope(partition_record, batch):
    return {'schema': 'logos-engine.lot10c.development-test-batch-scope.v1',
        'index': batch['index'], 'batchCount': 4, 'partitionManifest': partition_record,
        'testFiles': batch['testFiles'], 'testFileCount': 14, 'fullTestFileCount': 56}


def instant(value):
    result = datetime.fromisoformat(value)
    require(result.tzinfo is not None, 'A timezone-aware execution date is required')
    return result


def tap_counts(raw):
    text = raw.decode('utf8', errors='replace')
    matches = {key: re.findall(r'^# ' + key + r' (\d+)\s*$', text, re.M) for key in COUNT_KEYS}
    require(all(len(values) == 1 for values in matches.values()), 'Incomplete or ambiguous raw TAP summary')
    counts = {key: int(values[0]) for key, values in matches.items()}
    require(counts['tests'] == counts['pass'] > 0 and not any(counts[key] for key in ('fail', 'cancelled', 'skipped', 'todo')),
            'Raw TAP is not a complete passing batch without skips')
    return counts


def validate_receipts(receipts, receipt_paths, partition, partition_record, full_scope, excluded, load_record):
    """Pure validation; load_record must verify each fingerprint before returning bytes."""
    batches = validate_partition(partition, full_scope['testFiles'], excluded)
    require(len(receipts) == len(receipt_paths) == 4 and len(set(receipt_paths)) == 4, 'Four distinct actual batch receipts are required')
    totals = {key: 0 for key in COUNT_KEYS}
    shared = ('nativeSource', 'nativeSourceAfter', 'nativeSourceManifestDigest', 'sourceManifest', 'sourceAndTestInputs',
              'generator', 'sharedProofHelper', 'batchVerifier', 'watchedInputs', 'fullTestScope')
    first = receipts[0]
    require(isinstance(first.get('sourceAndTestInputs'), dict) and first['sourceAndTestInputs'], 'Missing complete source/test inventory')
    require(isinstance(first.get('nativeSource'), dict) and first['nativeSource'].get('files'), 'Missing native freeze')
    require(first['nativeSourceManifestDigest'] == first['nativeSource'].get('digest'), 'Native digest differs from the freeze')
    require(decode(load_record(first['sourceManifest'])) == first['nativeSource'], 'Retained native manifest differs')
    require(first['fullTestScope'] == full_scope, 'Full scope differs from the declared scope')
    for path in full_scope['testFiles']:
        require(path in first['sourceAndTestInputs'], 'A selected test is absent from the frozen input inventory')
    for path, sha in first['nativeSource']['files'].items():
        require(first['sourceAndTestInputs'].get(path) == sha, 'Native member differs from the full input inventory')
    watched = first.get('watchedInputs')
    require(isinstance(watched, list) and len(watched) == len({row['path'] for row in watched}), 'Duplicate or missing watched inputs')
    required = [first['generator'], first['sharedProofHelper'], first['sourceManifest'], first['batchVerifier'],
                full_scope['manifest'], partition_record]
    if full_scope['explicitExtraTestManifest'] is not None:
        required.append(full_scope['explicitExtraTestManifest'])
    require(all(row in watched for row in required), 'A required runner/scope/partition input is not watched')
    for row in watched:
        load_record(row)
    previous_end = None
    for receipt, path, batch in zip(receipts, receipt_paths, batches):
        require(receipt.get('schema') == BATCH_SCHEMA and receipt.get('developmentOnly') is True
                and receipt.get('finalDeliveryAccepted') is False and receipt.get('completeDeclaredScope') is False,
                'A batch cannot claim whole-scope or final-delivery execution')
        require(receipt.get('status') == 'passed' and not receipt.get('error') and not receipt.get('integrityError')
                and receipt.get('inputIntegrity') == 'passed' and receipt.get('nativeSourceUnchanged') is True
                and receipt.get('sourceAndTestInputsUnchanged') is True, 'Failed or incomplete actual batch')
        require(all(receipt.get(key) == first.get(key) for key in shared), 'Changed source, runner or scope inputs between batches')
        require(receipt['nativeSourceAfter'] == receipt['nativeSource'], 'Native before/after inventories differ')
        expected_scope = batch_scope(partition_record, batch)
        require(receipt.get('batchScope') == receipt.get('testScope') == expected_scope
                and receipt.get('testFiles') == batch['testFiles'] and receipt.get('testFileCount') == 14,
                'Receipt batch index or file coverage differs')
        command = NODE_PREFIX + batch['testFiles']
        require(receipt.get('plannedChecks') == [{'name': 'delta-tests', 'command': command}], 'Unexpected or filtered planned Node command')
        checks = receipt.get('checks')
        require(isinstance(checks, list) and len(checks) == 1, 'Each receipt must contain one actual child')
        row = checks[0]
        require(row.get('name') == 'delta-tests' and row.get('command') == command and type(row.get('exitCode')) is int
                and row['exitCode'] == 0 and not row.get('timedOut') and not row.get('error')
                and type(row.get('timeoutSeconds')) is int and 1 <= row['timeoutSeconds'] <= 300,
                'Failed, unbounded or filtered actual child')
        supervision = row.get('processSupervision', {})
        require(supervision.get('schema') == 'logos-engine.owned-process-group-supervision.v1'
                and supervision.get('startNewSession') is True and supervision.get('childSubreaper') is True
                and supervision.get('terminal') is True and supervision.get('directChildReaped') is True
                and supervision.get('ownedGroupGone') is True
                and supervision.get('completionReason') == 'child_exit'
                and supervision.get('directChildExitCode') == 0
                and type(supervision.get('pid')) is int and supervision['pid'] > 0
                and supervision.get('processGroupId') == supervision['pid'],
                'Actual child process group is not proven terminal')
        require(type(row.get('durationSeconds')) in (int, float) and math.isfinite(row['durationSeconds']) and row['durationSeconds'] >= 0,
                'Malformed actual child duration')
        start, end = instant(receipt['startedAt']), instant(receipt['finishedAt'])
        require(start <= instant(row['startedAt']) <= instant(row['finishedAt']) <= end
                and (previous_end is None or previous_end <= start), 'Batch executions overlap or are reordered')
        previous_end = end
        parent = PurePosixPath(path).parent
        require(parent.name == f"batch-{batch['index']:02d}" and parent.parent.name == 'development-batches'
                and PurePosixPath(path).name == 'development-test-batch.json', 'Unexpected exclusive batch receipt path')
        require(row.get('rawOutputPath') == row['rawOutput']['path']
                and PurePosixPath(row['rawOutput']['path']) == parent / 'delta-tests-output.raw.txt'
                and PurePosixPath(row['output']['path']) == parent / 'delta-tests-output.log.gz', 'Raw/gzip retention belongs to another batch')
        raw, compressed = load_record(row['rawOutput']), load_record(row['output'])
        require(gzip.decompress(compressed) == raw, 'Compressed retention is not the exact raw child output')
        counts = tap_counts(raw)
        require(row.get('tapSummaryComplete') is True and isinstance(row.get('counts'), dict)
                and set(row['counts']) == set(COUNT_KEYS) and all(type(row['counts'][key]) is int for key in COUNT_KEYS)
                and row['counts'] == counts, 'Declared counts differ from actual raw TAP')
        for key in COUNT_KEYS:
            totals[key] += counts[key]
    return {'actualBatchCount': 4, 'testFileCount': 56, 'testFiles': full_scope['testFiles'], 'counts': totals,
            'completeDeclaredCoverage': True, 'serialExecutionsVerified': True}


def declared_scope(extra):
    manifest = BASE / 'validation-test-scope.json'
    value = decode(manifest.read_bytes())
    require(value.get('schema') == 'logos-engine.lot10c.affected-test-scope.v1', 'Unknown base scope')
    files = [name for group in value['groups'] for name in group['testFiles']]
    require(len(files) == len(set(files)), 'Duplicated base scope')
    extra_value = decode(extra.read_bytes()) if extra else []
    extras = extra_value.get('testFiles') if isinstance(extra_value, dict) else extra_value
    require(isinstance(extras, list), 'Missing explicit extra test list')
    full = list(dict.fromkeys([*files, *extras]))
    return {'manifest': fingerprint(manifest), 'declaredGroups': value['groups'],
            'explicitExtraTestManifest': fingerprint(extra) if extra else None, 'explicitExtraTestFiles': extras,
            'testFiles': full, 'testFileCount': len(full), 'qualification': value['qualification']}, value['excludedClosedCaseModules']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory')
    parser.add_argument('--batch-manifest', required=True)
    parser.add_argument('--extra-tests')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    review(args)


def review(args):
    output = (ROOT / args.output).resolve()
    require(output.is_relative_to(BASE) and not output.exists(), 'A new development review output is required')
    partition_path = local_path(args.batch_manifest)
    extra = local_path(args.extra_tests) if args.extra_tests else None
    full_scope, excluded = declared_scope(extra)
    partition = decode(partition_path.read_bytes()); partition_record = fingerprint(partition_path)
    validate_partition(partition, full_scope['testFiles'], excluded)
    freeze = (ROOT / args.directory).resolve()
    require(freeze.is_relative_to(BASE) and freeze.is_dir(), 'Expected a Lot10C freeze directory')
    paths = [freeze / 'validation/development-batches' / f'batch-{i:02d}/development-test-batch.json' for i in range(1, 5)]
    retained = {}
    def load_record(record):
        require(isinstance(record, dict) and set(record) == {'path', 'bytes', 'sha256'}, 'Malformed fingerprint')
        require(type(record['bytes']) is int and record['bytes'] >= 0 and re.fullmatch(r'[0-9a-f]{64}', record['sha256']), 'Malformed fingerprint values')
        path = local_path(record['path']); raw = path.read_bytes()
        require(fingerprint_bytes(path.relative_to(ROOT).as_posix(), raw) == record, 'Changed retained bytes: ' + record['path'])
        require(retained.setdefault(record['path'], record) == record, 'Conflicting retained fingerprint')
        return raw
    receipt_records = [fingerprint(path) for path in paths]
    receipts = [decode(load_record(row)) for row in receipt_records]
    result = validate_receipts(receipts, [row['path'] for row in receipt_records], partition, partition_record, full_scope, excluded, load_record)
    expected = receipts[0]['sourceAndTestInputs']
    current = {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
               for folder in ('src', 'tests') for p in sorted((ROOT / folder).rglob('*')) if p.is_file()}
    require(current == expected, 'Current complete source/test inventory differs from the common frozen inputs')
    require(receipts[0]['generator'] == fingerprint(BASE / 'run-ordinary-release-checks.py')
            and receipts[0]['batchVerifier'] == fingerprint(BASE / 'review-test-batches.py'), 'Current runner/reviewer differs from the captured helpers')
    require(receipts[0]['sourceManifest'] == fingerprint(freeze / 'source-manifest.json'), 'Receipts name another source freeze')
    for record in list(retained.values()):
        load_record(record)
    summary = {'schema': SUMMARY_SCHEMA, 'status': 'development_batches_verified',
        'recordedAt': datetime.now(timezone.utc).isoformat(), 'developmentOnly': True,
        'derivedSummary': True, 'monolithicExecutionClaimed': False, 'finalDeliveryAccepted': False,
        'officialCostAccepted': False, 'generator': fingerprint(Path(__file__)),
        'coordination': {'mode': 'ordinary_unlocked', 'globalLockAcquired': False, 'timingClaim': False},
        'partitionManifest': partition_record, 'fullTestScope': full_scope, 'actualReceipts': receipt_records,
        'nativeSourceManifest': receipts[0]['sourceManifest'], 'nativeSourceManifestDigest': receipts[0]['nativeSourceManifestDigest'],
        'retainedInputsVerified': list(retained.values()), **result,
        'qualification': 'Derived coverage/count verification of four actual development children. This is not a monolithic test receipt. Final delivery requires explicit later acceptance by its existing gates; no readiness or official-cost gate is changed.'}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x') as stream:
        json.dump(summary, stream, ensure_ascii=False, indent=2); stream.write('\n')
    print(json.dumps({'status': summary['status'], 'developmentOnly': True, 'output': fingerprint(output), 'counts': result['counts']}))


if __name__ == '__main__':
    main()
