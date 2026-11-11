#!/usr/bin/env python3
"""Two semantic corruptions of an already source-verified SelectedRigid capture.

This is reader qualification, never a game or native-runtime execution. Run the
whole command through the case-clock wrapper when its input belongs to a game.
A passed existing cold-reader result is reused only with exact input/tool hashes.
Two full copies are retained; the original report and positive proof are untouched.
Each copy must remain structurally valid but fail the original Python comparison
on the deliberately changed field. Exceptions and timeouts alone never qualify.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
PIN = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'


def require(value, message):
    if not value:
        raise ValueError(message)


def fp(path):
    data = Path(path).read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def same_fp(actual, expected):
    return actual == {key: expected.get(key) for key in ('bytes', 'sha256')}


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def save(path, value):
    data = (json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()
    if path.suffix == '.gz':
        data = gzip.compress(data, mtime=0)
    with path.open('xb') as stream:
        stream.write(data)
    return {'path': str(path), **fp(path)}


def corrupt_proposal(report):
    target = next((event['result'] for event in report['selectedRigidEvents']
                   if event['method'] == 'propose' and isinstance(event['result'], dict)
                   and event['result'].get('kind') == 'selected_rigid'), None)
    require(target is not None, 'Positive capture has no SelectedRigid proposal')
    proposal_id = target['proposal_id']
    require(target.get('facts', {}).get('current_full_masks_measured') is True,
            'Expected measured-mask fact is absent from the actual positive proposal')
    require(target.get('bundle_template', {}).get('preconditions', {}).get('current_full_masks_measured') is True,
            'Expected matching precondition is absent from the actual positive proposal')
    changed = deepcopy(report)
    paths = []

    def visit(value, path):
        if isinstance(value, dict):
            if value.get('kind') == 'selected_rigid' and value.get('proposal_id') == proposal_id:
                require(value.get('facts', {}).get('current_full_masks_measured') is True,
                        'Captured copies disagree on the selected fact before corruption')
                require(value.get('bundle_template', {}).get('preconditions', {}).get('current_full_masks_measured') is True,
                        'Captured copies disagree on the matching precondition before corruption')
                value['facts']['current_full_masks_measured'] = False
                value['bundle_template']['preconditions']['current_full_masks_measured'] = False
                paths.extend([path + '.facts.current_full_masks_measured',
                              path + '.bundle_template.preconditions.current_full_masks_measured'])
            for key, child in value.items():
                visit(child, path + '.' + key)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, path + '[' + str(index) + ']')

    visit(changed, '$')
    require(paths, 'No captured proposal copy was corrupted')
    return changed, {'name': 'proposal-measured-mask-fact', 'proposalId': proposal_id,
        'field': 'current_full_masks_measured', 'before': True, 'after': False, 'paths': paths,
        'expectedDifferenceSuffixes': ['.facts.current_full_masks_measured',
                                       '.preconditions.current_full_masks_measured'],
        'scope': 'One semantic fact and its matching precondition in every captured copy of one proposal; plan and identity unchanged.'}


def corrupt_acquisition(report):
    target = next((event['result']['events'][0] for event in report['selectedRigidEvents']
                   if event['method'] == 'record' and isinstance(event['result'], dict)
                   and event['result'].get('events')
                   and type(event['result']['events'][0].get('detail', {}).get('selection_pixels_changed')) is bool), None)
    require(target is not None, 'Positive capture has no acquired selection-detail witness')
    original = target['detail']['selection_pixels_changed']
    changed = deepcopy(report)
    paths = []

    def visit(value, path):
        if isinstance(value, dict):
            if value == target:
                value['detail']['selection_pixels_changed'] = not original
                paths.append(path + '.detail.selection_pixels_changed')
            for key, child in value.items():
                visit(child, path + '.' + key)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                visit(child, path + '[' + str(index) + ']')

    visit(changed, '$')
    require(paths, 'No acquired/retained event copy was corrupted')
    return changed, {'name': 'acquired-selection-detail', 'field': 'selection_pixels_changed',
        'beforeObservation': target['detail']['before'], 'afterObservation': target['detail']['after'],
        'before': original, 'after': not original, 'paths': paths,
        'expectedDifferenceSuffixes': ['.detail.selection_pixels_changed'],
        'scope': 'One acquired observation detail in its exact event, state, restoration and fact copies; public rasters and commands unchanged.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, required=True)
    parser.add_argument('--positive-result', type=Path, required=True)
    parser.add_argument('--positive-receipt', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--timeout-seconds', type=int, required=True,
                        help='Timeout for each of the two Python comparison subprocesses (1..300); outer case clock remains authoritative.')
    args = parser.parse_args()
    require(1 <= args.timeout_seconds <= 300, 'Declare a bounded child timeout in 1..300 seconds')
    output = args.output_dir.resolve()
    output.relative_to(ROOT)
    output.mkdir(parents=True, exist_ok=False)
    started = time.monotonic()
    result = {'schema': 'sra.selected-rigid-cold-reader-negative-qualification.v1', 'status': 'failed',
        'startedAt': datetime.now(timezone.utc).isoformat(), 'command': sys.argv,
        'gameExecution': False, 'nativeExecution': False, 'baselineReexecuted': False,
        'caseClockQualification': 'All processing must be charged by the outer case-clock wrapper for a game-derived input.',
        'cases': [], 'inputs': {}}
    tracked = {}
    try:
        reader_path = ROOT / 'scripts/compare-selected-rigid-public-parity.py'
        exporter_path = ROOT / 'scripts/export-v6-selected-rigid-reference.py'
        presence_path = ROOT / 'scripts/verify-selected-rigid-presence.py'
        for path in [args.report, args.positive_result, args.positive_receipt,
                     reader_path, exporter_path, presence_path, Path(__file__)]:
            tracked[str(path.resolve())] = fp(path)
        result['inputs'] = deepcopy(tracked)
        reader = load(reader_path, 'selected_rigid_cold_reader_qualification')
        presence = load(presence_path, 'selected_rigid_cold_reader_presence')
        capture = reader.read_json(args.report)
        positive = reader.read_json(args.positive_result)
        receipt = reader.read_json(args.positive_receipt)
        require(receipt.get('schema') == 'sra.selected-rigid-cold-original-execution.v1'
                and positive.get('schema') == 'sra.selected-rigid-cold-original-parity.v1',
                'Expected the original cold-reader execution and comparison schemas')
        require(receipt.get('status') == positive.get('status') == 'passed' and receipt.get('exitCode') == 0,
                'An actually passed existing cold-original comparison is required')
        require(same_fp(fp(args.report), receipt['input']) and same_fp(fp(args.positive_result), receipt['output']),
                'Positive proof is not bound to these exact capture/result bytes')
        for key, path in [('reader', reader_path), ('exporter', exporter_path), ('presenceVerifier', presence_path)]:
            require(same_fp(fp(path), receipt[key]), 'Positive proof used different ' + key + ' source')
        require(receipt.get('sourceBefore') == receipt.get('sourceAfter')
                and receipt['sourceBefore'].get('files') == 1786 and receipt['sourceBefore'].get('commit') == PIN,
                'Positive proof did not preserve the complete original source')
        require(positive.get('stop') is None and positive.get('differences') == []
                and positive.get('counts', {}).get('selectedPrefixes', 0) > 0
                and positive['counts'].get('selectedRecords', 0) > 0,
                'Positive proof lacks an actual selected original prefix/acquisition')
        require(positive['counts'].get('comparedEvents') == len(capture['selectedRigidEvents']),
                'Positive proof did not cover the complete captured event journal')
        result['positiveProof'] = {'result': str(args.positive_result), 'receipt': str(args.positive_receipt),
            'game': capture.get('game'), 'inputSchema': capture.get('schema'), 'inputStatus': capture.get('status'),
            'syntheticQualification': capture.get('syntheticQualification'), 'counts': positive['counts'],
            'scope': positive.get('scope'), 'sourceBefore': receipt['sourceBefore']}
        captured_event_count = len(capture['selectedRigidEvents'])
        del positive
        for mutate in (corrupt_proposal, corrupt_acquisition):
            mutant, declaration = mutate(capture)
            case_dir = output / declaration['name']
            case_dir.mkdir()
            case = {'mutation': declaration, 'status': 'failed'}
            result['cases'].append(case)
            case['input'] = save(case_dir / 'report.json.gz', mutant)
            roots, structural_snapshots = presence.journal(mutant['selectedRigidEvents'])
            case['structuralJournal'] = {'status': 'passed', 'rootEvents': len(roots),
                                         'totalEvents': len(mutant['selectedRigidEvents'])}
            if mutant.get('schema') == 'logos-engine.v6.recorded-public-regression.v1':
                structural = presence.verify_report(mutant, declaration['name'])
                case['structuralReport'] = structural
                require(structural['status'] == 'passed', 'Mutation must pass structural report validation')
            # The child reads the retained copy. Release redundant large in-memory
            # journals before replay and before allocating the next independent copy.
            del mutant, roots, structural_snapshots
            child_output = case_dir / 'source-comparison.json.gz'
            child_receipt = case_dir / 'source-execution.json'
            command = [sys.executable, '-B', str(reader_path), '--root', str(ROOT),
                       '--report', case['input']['path'], '--output', str(child_output),
                       '--receipt', str(child_receipt), '--without-ablations', '--require-prefixes']
            case.update(command=command, timeoutSeconds=args.timeout_seconds,
                        startedAt=datetime.now(timezone.utc).isoformat())
            child_started = time.monotonic()
            log = case_dir / 'execution.log'
            try:
                with log.open('xb') as stream:
                    child = subprocess.run(command, cwd=ROOT, env={**os.environ, 'PYTHONHASHSEED': '0'},
                                           stdout=stream, stderr=subprocess.STDOUT, timeout=args.timeout_seconds)
                case['exitCode'] = child.returncode
            except subprocess.TimeoutExpired:
                case['timedOut'] = True
                raise ValueError('Reader timeout is not a successful semantic rejection')
            finally:
                case.update(elapsedSeconds=time.monotonic() - child_started,
                            finishedAt=datetime.now(timezone.utc).isoformat())
                if log.exists():
                    case['log'] = {'path': str(log), **fp(log)}
            require(child_receipt.exists() and child_output.exists(), 'Reader did not retain comparison and execution receipts')
            rejection = reader.read_json(child_output)
            child_proof = reader.read_json(child_receipt)
            case['comparison'] = {'path': str(child_output), **fp(child_output)}
            case['execution'] = {'path': str(child_receipt), **fp(child_receipt)}
            require(case['exitCode'] == child_proof.get('exitCode') == 1
                    and child_proof.get('status') == rejection.get('status') == 'failed',
                    'Corrupted capture was not actually rejected')
            require('error' not in child_proof and 'integrityError' not in child_proof
                    and child_proof.get('inputChanged') is not True,
                    'Execution/integrity failure does not establish a semantic rejection')
            require(same_fp(fp(case['input']['path']), child_proof['input'])
                    and same_fp(fp(child_output), child_proof['output']), 'Child proof is not bound to its actual mutated bytes')
            require(child_proof.get('sourceBefore') == child_proof.get('sourceAfter') == receipt['sourceBefore'],
                    'Negative comparison did not preserve the same complete original source')
            targets = [difference for difference in rejection.get('differences', [])
                       if any(difference.get('path', '').endswith(suffix)
                              for suffix in declaration['expectedDifferenceSuffixes'])]
            case.update(semanticDifferences=targets, allDifferenceCount=len(rejection.get('differences', [])),
                        stop=rejection.get('stop'))
            require(targets and rejection.get('stop') is None,
                    'Expected explicit semantic differences with complete source replay were not observed')
            require(rejection.get('counts', {}).get('comparedEvents') == captured_event_count,
                    'Negative replay did not finish the complete event journal')
            case['failureKind'] = 'original_python_semantic_mismatch_after_structural_acceptance'
            case['status'] = 'passed'
            del rejection, child_proof
        require(len(result['cases']) == 2 and all(case['status'] == 'passed' for case in result['cases']),
                'Both declared independent semantic corruptions must be rejected')
        result['status'] = 'passed'
    except Exception as error:
        result['error'] = {'type': type(error).__name__, 'message': str(error), 'traceback': traceback.format_exc()}
    finally:
        input_errors = []
        for path, value in tracked.items():
            try:
                if fp(Path(path)) != value:
                    input_errors.append({'path': path, 'error': 'Input bytes changed'})
            except Exception as error:
                input_errors.append({'path': path, 'error': str(error)})
        result['inputVerificationErrors'] = input_errors
        result['inputsUnchanged'] = not input_errors
        if not result['inputsUnchanged']:
            result['status'] = 'failed'
        result.update(elapsedSeconds=time.monotonic() - started,
                      finishedAt=datetime.now(timezone.utc).isoformat(), exitCode=0 if result['status'] == 'passed' else 1)
        receipt_path = output / 'qualification.json'
        save(receipt_path, result)
        print(json.dumps({'status': result['status'], 'exitCode': result['exitCode'],
                          'cases': [{'name': row['mutation']['name'], 'status': row['status']} for row in result['cases']],
                          'receipt': str(receipt_path), 'error': result.get('error')}, ensure_ascii=False))
    return result['exitCode']


if __name__ == '__main__':
    raise SystemExit(main())
