#!/usr/bin/env python3
"""Bind completed 4C delivery, cost and compiled inputs immediately before release.

Run the unchanged scripts/verify-native-delivery.py first. This recorder reads
that passed receipt and rechecks file integrity; it runs no tests, build, game,
measurement, transport or cost calculation. All four directory arguments are
explicit. Optional browser/game/reserve evidence is fingerprinted only.

Usage: python -B docs/migration/lot4c-evidence/record-publication-inputs.py
       BASELINE_CHECKOUT FINAL_DIRECTORY PERFORMANCE_DIRECTORY VALIDATION_DIRECTORY
       [--browser-evidence FILE] [--game-evidence FILE] [--contribution-reserve FILE]
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
VERIFIER_PATH = ROOT / 'scripts/verify-native-delivery.py'
SPEC = importlib.util.spec_from_file_location('lot4c_delivery_verifier', VERIFIER_PATH)
VERIFY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VERIFY)
require = VERIFY.require


def native_inventory(root):
    files = dict(sorted((path.relative_to(root).as_posix(), VERIFY.sha(path))
        for folder in ('src/logos-engine', 'src/runtime')
        for path in VERIFY.walk_files(root / folder, root) if path.suffix in {'.ts', '.json', '.drm'}))
    return {'fileCount': len(files), 'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(), 'files': files}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('baseline_checkout', 'final_directory', 'performance_directory', 'validation_directory'):
        parser.add_argument(name, type=Path)
    parser.add_argument('--browser-evidence', action='append', default=[], type=Path)
    parser.add_argument('--game-evidence', action='append', default=[], type=Path)
    parser.add_argument('--contribution-reserve', type=Path)
    args = parser.parse_args()
    baseline = args.baseline_checkout
    require(baseline.is_absolute() and baseline.resolve(strict=True) == baseline and baseline.is_dir()
            and baseline != ROOT and not baseline.is_relative_to(ROOT) and not ROOT.is_relative_to(baseline),
            'Supply the exact distinct baseline checkout as an absolute canonical path')
    final, perf = VERIFY.confined(args.final_directory), VERIFY.confined(args.performance_directory)
    validation = VERIFY.confined(ROOT / args.validation_directory, final)
    require(all(path.is_dir() for path in (final, perf, validation)), 'Explicit evidence directories must exist')
    output = VERIFY.confined(final / 'publication-inputs.json')
    require(not output.exists() and not output.is_symlink(), 'Publication input receipt is exclusive')
    retained = {}

    def keep(value):
        path = ROOT / value
        boundary = ROOT if path.is_relative_to(ROOT) else baseline
        path = VERIFY.confined(path, boundary)
        record = VERIFY.fingerprint(path, boundary)
        if boundary != ROOT: record['path'] = str(path)
        require(retained.setdefault(path, record) == record, 'Input changed during recording: ' + str(path))
        return record

    def checked(record):
        require(isinstance(record, dict) and set(record) == {'path', 'bytes', 'sha256'}, 'Invalid input fingerprint')
        require(keep(record['path']) == record, 'Recorded input differs: ' + record['path'])

    def read(path):
        keep(path)
        return VERIFY.read_json(path)

    generator = keep(Path(__file__).resolve()); helper = keep(VERIFIER_PATH)
    source = read(final / 'source-manifest.json'); archive = read(final / 'source-archive.json')
    tests = read(validation / 'delta-tests-run.json'); checks = read(validation / 'checks-run.json')
    integrity = read(final / 'delivery-integrity.json')
    require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1' and integrity['status'] == 'passed'
            and integrity['generator'] == helper, 'The unchanged delivery verifier must pass first')
    require(integrity['directory'] == final.relative_to(ROOT).as_posix()
            and integrity['validationDirectory'] == validation.relative_to(ROOT).as_posix()
            and integrity['nativeSourceDigest'] == source['digest'], 'Delivery integrity names different inputs')
    required_receipts = [final / 'source-manifest.json', final / 'source-archive.json', final / 'source-archive-parts.json',
                         validation / 'delta-tests-run.json', validation / 'checks-run.json', final / 'regressions/regression-summary.json']
    require(all(keep(path) in integrity['receipts'] for path in required_receipts), 'Delivery integrity omits a required formal receipt')
    for record in [*integrity['receipts'], *integrity['verificationHelpers'], integrity['originalSourceManifest']]: checked(record)
    checked(archive['archive'])
    require(archive['nativeSourceManifestDigest'] == source['digest']
            and all(archive['files'].get(name) == digest for name, digest in source['files'].items()), 'Archive inventory omits frozen native source')

    contract_path = perf / 'owner-growth-contract.json'; aggregate_path = perf / 'owner-growth-comparison.json'
    contract, aggregate = read(contract_path), read(aggregate_path)
    review = read(perf / 'owner-growth-review.json'); readiness = read(perf / 'readiness.json'); window = read(perf / 'window.json')
    require(review['schema'] == 'logos-engine.lot4c-owner-cost-review.v2'
            and review['status'] == 'qualified_owner_cost_review_passed' and review['lot'] == '4C'
            and review['inputsUnchanged'] is True and review['structuralProof'] is True
            and review['checkedCount'] == len(review['checks']) > 0 and all(row['passed'] is True for row in review['checks']),
            'A completed independent owner cost review is required')
    require(review['globalAccepted'] is True and review['accepted'] is True
            and review['acceptedCases'] == review['totalCases'] == len(review['globalCases']) == 2
            and all(row['accepted'] is True for row in review['globalCases']), 'Both global case budgets must be accepted')
    require(aggregate['schema'] == 'logos-engine.lot4c-owner-cost-consolidation.v2'
            and aggregate['status'] == 'qualified_consolidation_complete'
            and aggregate['globalAccepted'] is True and aggregate['globalCases'] == review['globalCases']
            and aggregate['globalStatus'] == review['globalStatus'], 'Cost consolidation and independent decision differ')
    require(review['contract'] == keep(contract_path) and review['aggregate'] == keep(aggregate_path)
            and VERIFY.confined(contract['performanceDirectory']) == perf, 'Owner review names another performance directory')
    require(contract['schema'] == 'logos-engine.lot4c-owner-cost-contract.v2' and contract['lot'] == '4C'
            and review['generator'] == contract['tools']['reviewer'] == keep(Path(__file__).with_name('review-owner-costs.py'))
            and aggregate['generator'] == contract['tools']['consolidator'] == keep(Path(__file__).with_name('consolidate-owner-costs.mjs')),
            'Declared owner cost tools differ from the completed review')
    for record in [review['generator'], *review['inputs'], *readiness['inputs']]: checked(record)
    for record in review['watchedExternalInputs']:
        require(Path(record['path']).is_absolute() and Path(record['path']).is_relative_to(baseline), 'External input is outside the explicit baseline')
        checked(record)
    require(all(keep(path) in review['inputs'] for path in (contract_path, aggregate_path, perf / 'readiness.json', perf / 'window.json')),
            'Owner review does not bind the supplied window and readiness')
    checked(review['declaration']); declaration = read(ROOT / review['declaration']['path'])
    checked(declaration['baselineManifest']); checked(declaration['candidateManifest'])
    baseline_source = read(ROOT / declaration['baselineManifest']['path'])
    require(read(ROOT / declaration['candidateManifest']['path']) == source, 'Costs measured another candidate freeze')
    require(review['sources'] == aggregate['sources'] == {
        'baseline': {key: baseline_source[key] for key in ('digest', 'fileCount')},
        'after': {key: source[key] for key in ('digest', 'fileCount')}}, 'Reviewed cost source identities differ')
    require(readiness['measurementAuthorized'] is True and readiness['pendingRequirements'] == []
            and readiness['nativeSourceDigest'] == source['digest'], 'Completed measurement readiness is required')

    validation_binding = {}

    def formal_inputs():
        require(native_inventory(ROOT) == source and native_inventory(baseline) == baseline_source, 'A frozen native inventory changed')
        source_tests, test_counts = VERIFY.verify_tests(tests, source)
        build_count, worker = VERIFY.verify_build(checks, source)
        regressions, regression_inputs = VERIFY.verify_regressions(final / 'regressions/regression-summary.json', source, True)
        snapshot_keys = {'sourceAndTestInputs', 'sourceAndTestInputsUnchanged'}
        present = snapshot_keys.intersection(checks)
        checks_only = not present
        if present:
            require(present == snapshot_keys and checks['sourceAndTestInputsUnchanged'] is True
                    and checks['sourceAndTestInputs'] == tests['sourceAndTestInputs'],
                    'Project checks and tests do not bind the same unchanged inputs')
        else:
            # The official --build-script branch records buildInputs only. Its
            # separate --tests receipt remains mandatory and is verified above.
            require(set(checks) == {'schema', 'status', 'generator', 'nativeSource', 'nativeSourceManifestDigest',
                                   'nativeSourceUnchanged', 'checks', 'buildInputs', 'nativeAgentWorker'}
                    and checks['generator']['path'] == 'scripts/verify-native-delta.py'
                    and [row['name'] for row in checks['checks']]
                    == ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build'],
                    'Only the official five checks-only receipt may omit its source/test snapshot')
        require({name: digest for name, digest in tests['sourceAndTestInputs'].items() if name.startswith('src/')}
                == {name: digest for name, digest in checks['buildInputs'].items() if name.startswith('src/')},
                'Test and build receipts disagree on shared source inputs')
        binding = {'checksSourceAndTestSnapshot': 'absent_in_official_five_checks_only' if checks_only
                   else 'present_and_exactly_equal_to_tests',
                   'testsSnapshotVerifiedAgainstCurrentInputs': True, 'buildInputsVerifiedAgainstCurrentInputs': True,
                   'sharedSourceInputsExactlyEqual': True, 'audits': {}}
        for row in checks['checks']:
            name = row['name']
            if name not in {'entry-audit', 'migration-audit'}:
                continue
            if 'semanticPassed' in row:
                require(row['semanticPassed'] is True, 'Recorded audit semantic failure: ' + name)
                binding['audits'][name] = {'mode': 'recorded_semantic_passed', 'semanticPassed': True}
                continue
            require(checks_only, 'A richer validation receipt must retain its semantic audit result: ' + name)
            checked(row['output'])
            log = VERIFY.confined(ROOT / row['output']['path'], validation)
            summary = json.loads(gzip.decompress(log.read_bytes()), object_pairs_hook=VERIFY.unique_object,
                                 parse_constant=VERIFY.invalid_constant)
            report_path = ROOT / ('docs/migration/v6-entry-point-progress.json' if name == 'entry-audit'
                                  else 'docs/migration/v6-coverage.json')
            report = read(report_path)
            require(report['referenceCommit'] == '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e',
                    'Current audit report names another original source')
            if name == 'entry-audit':
                entries = [(group['id'], entry) for group in report['groups'] for entry in group['entries']
                           if entry['question'] == 'facet_example']
                expected = {key: report[key] for key in ('connected', 'declared', 'percent', 'fullV6Parity')}
                expected['groups'] = [{key: group[key] for key in ('id', 'connected', 'declared')} for group in report['groups']]
                require(report['schema'] == 'logos-engine.v6.declared-entry-coverage.v1'
                        and report['implementation'] == 'logos-engine.typescript.v6.native-migration/' + review['nativeVersion']
                        and report['fullV6Parity'] is False and summary['fullV6Parity'] is False
                        and len(entries) == 1 and entries[0][0] == 'surface'
                        and entries[0][1]['family'] == 'facet_examples' and entries[0][1]['status'] == 'connected',
                        'Entry audit must retain the actual Facet source entry without claiming full V6 parity')
            else:
                expected = {'complete': report['complete'], **report['summary'], 'failures': report['failures']}
                require(report['schema'] == 'logos-engine.native-migration-report.v1'
                        and report['failures'] == [] and summary['failures'] == []
                        and report['complete'] is False and summary['complete'] is False,
                        'Migration audit must have no mapping failures and retain its incomplete migration scope')
            require(json.dumps(summary, sort_keys=True, allow_nan=False) == json.dumps(expected, sort_keys=True, allow_nan=False),
                    'Current audit report summary differs from its frozen gate log: ' + name)
            binding['audits'][name] = {'mode': 'frozen_gate_log_with_current_closure_report', 'semanticPassed': True,
                'frozenGateLog': row['output'], 'currentClosureReport': keep(report_path), 'summary': summary,
                'historicalReportFingerprintClaimed': False,
                'qualification': 'The fingerprinted log is the retained gate output. The detailed report is bound now at closure, '
                                 'with its exact summary compared to that log; no missing historical report fingerprint is inferred.'}
        require(not validation_binding or validation_binding == binding, 'Validation bindings changed during recording')
        validation_binding.update(binding)
        counts = {'native': len(source['files']), 'archive': VERIFY.check_map(archive['files'], 'publication archive inputs'),
                  'sourceAndTests': source_tests, 'buildInputs': build_count, 'regressionExecutionInputs': regression_inputs}
        require(counts == integrity['matchedFileInventories'] and test_counts == integrity['tests']
                and worker == integrity['nativeAgentWorker'], 'Formal delivery inventories, tests or compiled worker changed')
        require(integrity['regressions'] == {key: regressions[key] for key in integrity['regressions']}, 'Formal regression summary changed')
        return counts

    counts = formal_inputs()
    require(window['schema'] == 'logos-engine.native-cost-window.v1' and window['status'] == window['finalIntegrity'] == 'passed'
            and window['plannedOrder'] == [row['label'] for row in window['executions']] == ['A1', 'B1', 'B2', 'A2'], 'Complete unchanged ABBA window required')
    require(window['baselineCheckout'] == str(baseline) and window['correctionCheckout'] == str(ROOT)
            and window['nativeDigests'] == {'baseline': baseline_source['digest'], 'correction': source['digest']}, 'Window checkout or source differs')
    for record in window['inputs']:
        require(Path(record['path']).is_absolute() and keep(record['path'])['sha256'] == record['sha256'], 'Window input changed')
    measured, warmups, implementations = [], [], {'baseline': set(), 'after': set()}
    ledger_keys = ('case', 'side', 'cohort', 'round', 'startedAt', 'finishedAt', 'actions')
    for row in window['executions']:
        side = 'baseline' if row['label'].startswith('A') else 'after'
        checkout, expected = (baseline, baseline_source) if side == 'baseline' else (ROOT, source)
        require(row['status'] == 'passed' and type(row['exitCode']) is int and row['exitCode'] == 0
                and row['checkout'] == str(checkout) and row['nativeDigest'] == expected['digest'], 'Unsuccessful or rebound cost execution')
        original = VERIFY.confined(row['output'], checkout)
        report_path = VERIFY.confined(row.get('copiedOutput', row['output']), perf)
        log_path = VERIFY.confined(row['log'], perf)
        require(keep(original)['sha256'] == keep(report_path)['sha256'] == row['reportSha256']
                and keep(log_path)['sha256'] == row['logSha256'], 'Measured report or raw log changed')
        report = read(report_path)
        require(report['schema'] == 'logos-engine.native-loop-costs.v1' and report['status'] == 'passed'
                and report['nativeSourceUnchanged'] is True and report['nativeSource'] == expected, 'Raw report source or status differs')
        for case in report['cases']:
            for trial in case['trials']:
                require(type(trial['warmup']) is bool and type(trial['actions']) is int and trial['actions'] > 0, 'Invalid physical trial')
                implementations[side].add(trial['final']['implementation'])
                identity = (case['id'], side, 'cohort_' + row['label'][1], trial['round'], trial['startedAt'], trial['finishedAt'], trial['actions'])
                (warmups if trial['warmup'] else measured).append(identity)
    population = {'measuredSessions': len(measured), 'measuredActions': sum(row[-1] for row in measured),
                  'excludedWarmupSessions': len(warmups), 'excludedWarmupActions': sum(row[-1] for row in warmups)}
    require(tuple(population.values()) == (32, 400, 8, 24), 'The declared complete cost population changed')
    for key, value in population.items(): require(review[key] == aggregate[key] == value, 'Reviewed population differs: ' + key)
    for name, rows in (('includedMeasuredSessions', measured), ('excludedWarmups', warmups)):
        require(review[name] == aggregate[name] and sorted(rows) == sorted(tuple(row[key] for key in ledger_keys) for row in review[name]),
                'Physical cost ledger differs: ' + name)
    versions = {}
    for side, values in implementations.items():
        require(len(values) == 1, 'Measured native implementation changed within one side')
        match = re.fullmatch(r'logos-engine\.typescript\.v6\.native-migration/(\d+\.\d+\.\d+)', next(iter(values)))
        require(match is not None, 'Cannot infer measured native version'); versions[side] = match.group(1)
    require(review['nativeVersion'] == versions['after'], 'Cost review and measured native version differ')

    historical = review['historicalStrict']
    require(review['historicalStrictPassed'] is False and historical == aggregate['historicalStrict']
            and historical['passed'] is False, 'Historical strict failure must remain failed')
    failure_path = VERIFY.confined(ROOT / contract['strictFailureReceipt'], perf)
    failure_log = VERIFY.confined(ROOT / contract['strictFailureLog'], perf)
    failure = read(failure_path)
    require(historical['failureReceipt'] == keep(failure_path) and historical['failureLog'] == keep(failure_log)
            and failure['schema'] == 'logos-engine.retained-tool-failure.v1' and type(failure['exitCode']) is int
            and failure['exitCode'] != 0 and failure['inputsUnchanged'] is True and failure['outputExists'] is False,
            'The actual retained strict failure is missing or changed')
    require(not VERIFY.confined(ROOT / contract['historicalAggregateOutput'], perf).exists(), 'Strict aggregate output must remain absent')
    provided = {'browser': [keep(VERIFY.confined(path)) for path in args.browser_evidence],
                'game': [keep(VERIFY.confined(path)) for path in args.game_evidence],
                'contributionReserve': keep(VERIFY.confined(args.contribution_reserve)) if args.contribution_reserve else None}
    require(formal_inputs() == counts, 'Formal inputs changed while binding later evidence')
    for path, record in list(retained.items()): require(keep(path) == record, 'Retained input changed')
    result = {'schema': 'logos-engine.lot4c-publication-inputs.v1', 'status': 'passed', 'recordedAt': datetime.now(timezone.utc).isoformat(),
        'generator': generator, 'deliveryVerifier': helper, 'nativeVersion': versions['after'], 'nativeSourceDigest': source['digest'],
        'baseline': {'checkout': str(baseline), 'nativeVersion': versions['baseline'], 'nativeSourceDigest': baseline_source['digest']},
        'directories': {'final': final.relative_to(ROOT).as_posix(), 'performance': perf.relative_to(ROOT).as_posix(),
                        'validation': validation.relative_to(ROOT).as_posix()},
        'fileInventories': counts, 'nativeAgentWorker': checks['nativeAgentWorker'], 'testFiles': len(tests['testFiles']),
        'tests': tests['checks'][0]['counts'], 'projectChecks': len(checks['checks']), 'regressions': integrity['regressions'],
        'validationInputBinding': validation_binding,
        'costGlobalStatus': review['globalStatus'], 'globalAccepted': review['globalAccepted'],
        'acceptedCases': review['acceptedCases'], 'totalCases': review['totalCases'], 'costPopulation': population,
        'historicalStrictPassed': False, 'historicalStrict': historical, 'strictFailureExitCode': failure['exitCode'],
        'providedEvidence': provided, 'inputs': list(retained.values()),
        'qualification': 'Release input integrity only. Existing formal delivery verification, complete ABBA reports and the accepted independent owner-qualified cost review retain their original scope. The actual historical strict failure remains failed. Counts and native versions come from the completed receipts and physical trial records. Browser, game and contribution-reserve files are fingerprinted only; their results are not inferred or promoted. No test, build, game, measurement, cost recalculation or publication was performed by this recorder.'}
    with output.open('x') as stream: json.dump(result, stream, indent=2, allow_nan=False); stream.write('\n')
    print(json.dumps({'status': 'passed', 'nativeVersion': result['nativeVersion'], 'fileInventories': counts, 'receipt': VERIFY.fingerprint(output)}))


if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'status': 'publication_inputs_failed', 'error': f'{type(error).__name__}: {error}'}), file=sys.stderr)
        raise SystemExit(1)
