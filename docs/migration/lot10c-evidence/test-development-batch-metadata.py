#!/usr/bin/env python3
"""Small synthetic metadata controls; imports no runtime and executes no tests/game."""
from __future__ import annotations
import argparse
from copy import deepcopy
from datetime import datetime, timezone
import fcntl
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
spec = importlib.util.spec_from_file_location('development_batch_review_metadata_only', BASE / 'review-test-batches.py')
review = importlib.util.module_from_spec(spec); spec.loader.exec_module(review)


def fixture():
    blobs = {}
    def put(path, value):
        raw = value if isinstance(value, bytes) else review.encode(value)
        blobs[path] = raw
        return review.fingerprint_bytes(path, raw)
    files = [f'tests/synthetic_{i:02d}.test.ts' for i in range(1, 57)]
    base = {'schema': 'logos-engine.lot10c.affected-test-scope.v1', 'groups': [{'contract': 'synthetic', 'testFiles': files[:33]}],
            'qualification': 'Synthetic metadata only', 'excludedClosedCaseModules': review.EXCLUDED}
    scope = {'manifest': put('synthetic/base-scope.json', base), 'declaredGroups': base['groups'],
             'explicitExtraTestManifest': put('synthetic/extra-scope.json', {'testFiles': files[33:]}),
             'explicitExtraTestFiles': files[33:], 'testFiles': files, 'testFileCount': 56, 'qualification': base['qualification']}
    partition = {'schema': review.PARTITION_SCHEMA, 'developmentOnly': True, 'fullTestFiles': files,
                 'excludedClosedCaseModules': review.EXCLUDED,
                 'batches': [{'index': i+1, 'testFiles': files[14*i:14*(i+1)]} for i in range(4)]}
    part_record = put('synthetic/partition.json', partition)
    native_hash = hashlib.sha256(b'synthetic metadata, not executable').hexdigest()
    native = {'digest': '0'*64, 'fileCount': 1, 'files': {'src/synthetic.ts': native_hash}}
    inputs = {name: native_hash for name in ['src/synthetic.ts', *files]}
    manifest = put('synthetic/source-manifest.json', native)
    generator = put('synthetic/runner.py', b'synthetic runner metadata')
    proof = put('synthetic/proof.py', b'synthetic helper metadata')
    verifier = put('synthetic/reviewer.py', b'synthetic reviewer metadata')
    watched = [generator, proof, manifest, scope['manifest'], scope['explicitExtraTestManifest'], part_record, verifier]
    receipts, paths = [], []
    for batch in partition['batches']:
        index = batch['index']; parent = f'synthetic/validation/development-batches/batch-{index:02d}'
        path = parent + '/development-test-batch.json'; paths.append(path)
        raw = b'TAP version 13\n# tests 14\n# pass 14\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'
        command = review.NODE_PREFIX + batch['testFiles']
        start = f'2026-01-01T00:00:{2*index:02d}+00:00'; end = f'2026-01-01T00:00:{2*index+1:02d}+00:00'
        counts = {'tests': 14, 'pass': 14, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}
        row = {'name': 'delta-tests', 'command': command, 'exitCode': 0, 'timeoutSeconds': 300,
               'durationSeconds': 1.0, 'startedAt': start, 'finishedAt': end,
               'rawOutputPath': parent+'/delta-tests-output.raw.txt', 'rawOutput': put(parent+'/delta-tests-output.raw.txt', raw),
               'output': put(parent+'/delta-tests-output.log.gz', gzip.compress(raw, mtime=0)),
               'tapSummaryComplete': True, 'counts': counts}
        row['processSupervision'] = {'schema': 'logos-engine.owned-process-group-supervision.v1',
            'startNewSession': True, 'childSubreaper': True, 'terminal': True,
            'directChildReaped': True, 'ownedGroupGone': True, 'completionReason': 'child_exit',
            'directChildExitCode': 0, 'pid': 1000+index, 'processGroupId': 1000+index}
        receipt = {'schema': review.BATCH_SCHEMA, 'status': 'passed', 'developmentOnly': True,
            'finalDeliveryAccepted': False, 'completeDeclaredScope': False, 'inputIntegrity': 'passed',
            'nativeSourceUnchanged': True, 'sourceAndTestInputsUnchanged': True, 'nativeSource': native,
            'nativeSourceAfter': native, 'nativeSourceManifestDigest': native['digest'], 'sourceManifest': manifest,
            'sourceAndTestInputs': inputs, 'generator': generator, 'sharedProofHelper': proof,
            'batchVerifier': verifier, 'watchedInputs': watched, 'fullTestScope': scope,
            'batchScope': review.batch_scope(part_record, batch), 'testScope': review.batch_scope(part_record, batch),
            'testFiles': batch['testFiles'], 'testFileCount': 14,
            'plannedChecks': [{'name': 'delta-tests', 'command': command}], 'checks': [row],
            'startedAt': start, 'finishedAt': end}
        receipts.append(deepcopy(receipt))
    return blobs, scope, partition, part_record, receipts, paths


def main():
    parser = argparse.ArgumentParser(description=__doc__);parser.add_argument('--output', type=Path, required=True);args = parser.parse_args()
    output = args.output.resolve(); review.require(output.is_relative_to(BASE) and not output.exists(), 'New metadata-only receipt required')
    coord = Path('/workspace/shared/sra-coordination');review.require_released(coord)
    with (coord/'performance.lock').open('a') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_SH | fcntl.LOCK_NB)
        before = [review.fingerprint(p) for p in (Path(__file__), BASE/'review-test-batches.py', BASE/'run-release-checks.py')]
        results = []
        def execute(name, mutate=None, expected=None):
            blobs, scope, partition, part_record, receipts, paths = fixture()
            if mutate: mutate(blobs, scope, partition, part_record, receipts, paths)
            def load(record):
                raw = blobs[record['path']]
                review.require(review.fingerprint_bytes(record['path'], raw) == record, 'Changed retained synthetic bytes')
                return raw
            error = None
            try:
                result = review.validate_receipts(receipts, paths, partition, part_record, scope, review.EXCLUDED, load)
                okay = expected is None and result['testFileCount'] == 56 and result['counts']['tests'] == 56
            except Exception as failure:
                error = {'type': type(failure).__name__, 'message': str(failure)}
                okay = expected is not None and expected in str(failure)
            results.append({'name': name, 'passed': okay, 'expectedRejection': expected, 'observedError': error})
            print(json.dumps(results[-1]), flush=True)
            if not okay: raise AssertionError(name)
        execute('accept_complete_synthetic_metadata')
        def duplicate(b,s,p,f,r,paths):p['batches'][1]['testFiles'][0]=p['batches'][0]['testFiles'][0]
        execute('reject_duplicate_partition_member', duplicate, 'disjoint')
        def missing(b,s,p,f,r,paths):p['batches'].pop()
        execute('reject_missing_partition_batch', missing, 'four batches')
        def changed(b,s,p,f,r,paths):r[1]['sourceAndTestInputs']['src/synthetic.ts']='f'*64
        execute('reject_changed_source_input', changed, 'Changed source, runner or scope')
        def failed(b,s,p,f,r,paths):r[2]['status']='failed'
        execute('reject_failed_actual_batch', failed, 'Failed or incomplete')
        def absent(b,s,p,f,r,paths):r.pop();paths.pop()
        execute('reject_missing_actual_receipt', absent, 'Four distinct')
        def doubled(b,s,p,f,r,paths):r[1]=deepcopy(r[0])
        execute('reject_duplicate_actual_receipt', doubled, 'batch index or file coverage')
        def changed_runner(b,s,p,f,r,paths):r[2]['generator']['sha256']='f'*64
        execute('reject_changed_runner_input', changed_runner, 'Changed source, runner or scope')
        def skipped(b,s,p,f,r,paths):r[1]['checks'][0]['counts']['skipped']=1
        execute('reject_skipped_or_false_tap_counts', skipped, 'Declared counts differ')
        def filtering(b,s,p,f,r,paths):r[1]['checks'][0]['command'].insert(2,'--test-name-pattern=only-one')
        execute('reject_test_name_filtering', filtering, 'planned Node command')
        def altered_raw(b,s,p,f,r,paths):b[r[2]['checks'][0]['rawOutput']['path']]+=b'changed\n'
        execute('reject_changed_retained_raw', altered_raw, 'Changed retained synthetic bytes')
        def false_global(b,s,p,f,r,paths):r[3]['completeDeclaredScope']=True
        execute('reject_fourteen_file_whole_scope_claim', false_global, 'cannot claim whole-scope')
        after = [review.fingerprint(p) for p in (Path(__file__), BASE/'review-test-batches.py', BASE/'run-release-checks.py')]
        assert before == after
        report = {'schema': 'logos-engine.lot10c.development-batch-metadata-controls.v1',
            'recordedAt': datetime.now(timezone.utc).isoformat(), 'passed': all(row['passed'] for row in results),
            'testCount': len(results), 'controls': results, 'inputsBefore': before, 'inputsAfter': after,
            'inputsUnchanged': True, 'syntheticMetadataOnly': True, 'nativeTestProcessesExecuted': 0,
            'gameProcessesExecuted': 0, 'actualDevelopmentBatchesExecuted': 0,
            'qualification': 'In-memory artificial receipt/TAP metadata exercises rejection logic only. No synthetic batch is presented as an actual native execution or final delivery gate.'}
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open('x') as stream:json.dump(report,stream,indent=2);stream.write('\n')
        print(json.dumps({'passed': report['passed'], 'controls': len(results), 'receipt': review.fingerprint(output)}))


if __name__ == '__main__': main()
