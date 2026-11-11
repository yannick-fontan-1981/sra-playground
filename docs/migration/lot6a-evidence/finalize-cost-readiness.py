#!/usr/bin/env python3
"""Bind completed reconstructed 6A evidence before any official cost sample.

Read-only verification of actual retained sources, test/build receipts, strict
recorded replays, cold original parity, browser controls, cumulative case clock
and predeclared cost structure. The sole output is exclusive readiness.json.
No agent, game, test, build, oracle, measurement, Git or network call is run.
Published 5B file helpers and the common delivery verifier remain unchanged.
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
from urllib.parse import parse_qs, urlparse

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
COMMON_PATH = ROOT / 'docs/migration/lot5b-evidence/finalize-cost-readiness.py'
DELIVERY_PATH = ROOT / 'scripts/verify-native-delivery.py'


def load_helper(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


common = load_helper('lot6a_published_5b_readiness_helpers', COMMON_PATH)
delivery = load_helper('lot6a_common_delivery_helpers', DELIVERY_PATH)
require, decode, instant, finite = common.require, common.decode, common.instant, common.finite
same, manifest_valid, counts_valid = common.same, common.manifest_valid, common.counts_valid
COUNT_KEYS, CHECK_NAMES = common.COUNT_KEYS, common.CHECK_NAMES
STRICT_REGRESSION_CHECK_NAMES = common.STRICT_REGRESSION_CHECK_NAMES
SHA, no_window = common.SHA, common.no_window
TEST_RUNNER = ROOT / 'scripts/verify-native-delta.py'
OWNER = 'preview_packing'
PIN = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
ORIGINAL = ROOT / 'reference/v6' / PIN
ADDED_TESTS = [
    'tests/v6-preview-packing-native.test.ts',
    'tests/v6-preview-packing-reference.test.ts',
    'tests/v6-preview-packing-integration.test.ts',
    'tests/v6-preview-capture.test.ts',
]
EXHAUSTED_CASE_TESTS = {
    'tests/v6-ranked-workshop-reference.test.ts',
    'tests/v6-ranked-workshop-kernel.test.ts',
    'tests/v6-symbol-transactions-kernel.test.ts',
}


def local(value):
    path = delivery.confined(value)
    require(path != ROOT, 'Expected a file or subdirectory inside the checkout')
    return path


def fingerprint(value, external=False):
    path = Path(value) if external else local(value)
    require(path.is_file() and not path.is_symlink(), 'Input is not a regular file: ' + str(path))
    return {'path': str(path) if external else path.relative_to(ROOT).as_posix(),
            'sha256': delivery.sha(path), 'bytes': path.stat().st_size}


class Evidence(common.Evidence):
    """Shared immutable receipt semantics with the common strict path boundary."""
    def keep(self, value):
        actual = fingerprint(value)
        require(self.inputs.setdefault(actual['path'], actual) == actual,
                'Input changed while checking: ' + actual['path'])
        return actual

    def checked(self, record, allow_external=False):
        require(isinstance(record, dict) and isinstance(record.get('path'), str)
                and isinstance(record.get('sha256'), str) and SHA.fullmatch(record['sha256']),
                'Missing valid input fingerprint')
        path = Path(record['path'])
        if not path.is_absolute() or path.is_relative_to(ROOT):
            path = local(path)
            actual = self.keep(path)
        else:
            require(allow_external and self.baseline is not None, 'Undeclared external input')
            path = delivery.confined(path, self.baseline)
            actual = fingerprint(path, external=True)
            require(self.external.setdefault(actual['path'], actual) == actual, 'External input changed')
        require(actual['sha256'] == record['sha256'] and ('bytes' not in record
                or type(record['bytes']) is int and actual['bytes'] == record['bytes']),
                'File fingerprint differs: ' + str(path))
        return path

    def load(self, value):
        path = local(value)
        self.keep(path)
        raw = path.read_bytes()
        return decode(gzip.decompress(raw) if path.suffix == '.gz' else raw)

    def text(self, value):
        path = local(value)
        self.keep(path)
        raw = path.read_bytes()
        return (gzip.decompress(raw) if path.suffix == '.gz' else raw).decode()

    def recheck(self):
        for record in self.inputs.values():
            require(fingerprint(record['path']) == record, 'Input changed before closure: ' + record['path'])
        for record in self.external.values():
            delivery.confined(record['path'], self.baseline)
            require(fingerprint(record['path'], external=True) == record, 'External input changed before closure')


def bind_common_helpers(e):
    prior = e.load(ROOT / 'docs/migration/lot5b-evidence/performance-integrated/readiness.json')
    require(prior['generator'] == e.keep(COMMON_PATH), 'Published common readiness helper changed')
    prior_integrity = e.load(ROOT / 'docs/migration/lot5b-evidence/integrated-final/delivery-integrity.json')
    require(prior_integrity['generator'] == e.keep(DELIVERY_PATH), 'Published common delivery verifier changed')
    for name in ('verify-delivery-integrity.py', 'finalize-cost-readiness.py', 'record-publication-inputs.py',
                 'consolidate-regression-recovery.py'):
        e.keep(BASE / name)


def original_sources(e, integrity):
    manifest_record = e.keep(ORIGINAL / 'manifest.json')
    require(integrity.get('originalSourceManifest') == manifest_record
            and integrity.get('originalSourceFilesUnchanged') == 1786, 'Full pinned original source is not verified')
    manifest = e.load(ORIGINAL / 'manifest.json')
    require(len(manifest.get('files', {})) == 1786, 'Original pinned inventory is incomplete')
    for name, row in manifest['files'].items():
        delivery.relative_name(name)
        e.checked({'path': str(ORIGINAL / 'source' / name), 'sha256': row['sha256']})
    return {'commit': PIN, 'files': 1786,
            'manifest': {key: manifest_record[key] for key in ('bytes', 'sha256')}, 'unchanged': True}


def publication_chain(e, path, baseline, policy, archive, archive_record):
    published = e.load(path)
    require(published.get('schema') == 'logos-engine.lot6a.actual-published-predecessor.v1',
            'Missing actual reconstructed published baseline identity')
    e.at(published['recordedAt'], 'published baseline observation')
    manifest = e.referenced(published['nativeManifest'])
    manifest_valid(manifest, 'published predecessor')
    prior_manifest = e.load(ROOT / 'docs/migration/lot5b-evidence/integrated-final/source-manifest.json')
    require(manifest == baseline == prior_manifest and published['nativeDigest'] == baseline['digest']
            and published['nativeVersion'] == policy['baseline']['nativeVersion']
            and published['siteVersion'] == policy['baseline']['siteVersion']
            and published['commit'] == policy['baseline']['commit'], 'Reference A is not the actual published 5B source')
    opening = published['sourceOpening']
    require(opening.get('project_id') == published['projectId']
            and opening.get('commit_sha') == published['commit'] and opening.get('checkout_path') == str(ROOT),
            'Published source opening has another project, checkout or commit')
    require(published.get('audience', {}).get('ownerOnly') is True, 'Published audience metadata changed')
    require(archive.get('baseCommit') == policy['candidate']['sourceBaseCommit'] == published['commit'],
            'This reconstruction requires the exact published freeze base; a different base needs actual Git ancestry evidence')
    return {'receipt': e.keep(path), 'projectId': published['projectId'],
            'siteVersion': published['siteVersion'], 'publishedPredecessorCommit': published['commit'],
            'candidateSourceBaseCommit': archive['baseCommit'], 'publishedPredecessorIsAncestorOfCandidateBase': True,
            'ancestryBasis': 'identical_immutable_commit', 'candidateArchiveManifest': archive_record,
            'nativeDigest': baseline['digest'], 'nativeFiles': baseline['fileCount'], 'audience': published['audience']}


def verify_scope(e, path, tests, native_digest, published):
    plan = e.load(path)
    require(plan.get('schema') == 'logos-engine.lot6a.declared-test-scope.v1', 'Missing declared 6A union')
    inherited = e.referenced(plan['inheritedReceipt'])
    require(inherited.get('schema') == 'logos-engine.native-delta-verification.v1'
            and inherited.get('status') == 'passed' and inherited.get('nativeSourceUnchanged') is True
            and inherited.get('nativeSourceManifestDigest') == published['nativeDigest'],
            'Inherited tests do not belong to the published predecessor')
    counts_valid(inherited['checks'][0]['counts'], 'published predecessor')
    prior = inherited['testFiles']
    require(prior and len(prior) == len(set(prior)) and plan.get('inheritedFiles') == len(prior)
            and plan.get('newFiles') == ADDED_TESTS and not set(prior).intersection(ADDED_TESTS),
            'Declared test additions omit or duplicate a Preview contract')
    original_plan = e.referenced(plan['priorScope'])
    require(original_plan.get('schema') == 'logos-engine.lot6a.declared-test-scope.v1'
            and original_plan.get('testFiles') == [*prior, *ADDED_TESTS]
            and original_plan.get('totalFiles') == len(prior) + len(ADDED_TESTS),
            'Original pre-exclusion scope was not retained intact')
    exclusions = plan.get('excludedFiles', [])
    require(len(exclusions) == len(EXHAUSTED_CASE_TESTS)
            and {row.get('path') for row in exclusions} == EXHAUSTED_CASE_TESTS,
            'Only the three declared exhausted-LKEY test modules may be excluded')
    for row in exclusions:
        e.checked(row)
        require(isinstance(row.get('reason'), str) and 'LKEY' in row['reason']
                and 'budget' in row['reason'].lower(), 'Test exclusion lacks its explicit exhausted-case budget reason')
        evidence = e.checked(row['evidence'])
        status = e.load(evidence)
        require(status.get('case_clock_state') == 'closed'
                and finite(status.get('case_clock_cumulative_seconds'))
                and finite(status.get('case_clock_remaining_seconds'))
                and 0 <= status['case_clock_remaining_seconds'] < 10
                and abs(status['case_clock_cumulative_seconds'] + status['case_clock_remaining_seconds'] - 2400) < 1e-8
                and 'LKEY' in status.get('request_to_other_lanes', '')
                and all(name in status['request_to_other_lanes'] for name in EXHAUSTED_CASE_TESTS),
                'Exhausted-case exclusion does not retain the observed budget status')
    union = [name for name in [*prior, *ADDED_TESTS] if name not in EXHAUSTED_CASE_TESTS]
    require(plan.get('testFiles') == tests.get('testFiles') == union and plan.get('totalFiles') == len(union),
            'Executed scope differs from predecessor plus four Preview files minus the three explicit budget exclusions')
    require(e.at(plan['declaredAt'], 'test scope declaration') <= instant(tests['checks'][0]['startedAt']),
            'Test scope was not declared before execution')
    return {'receipt': e.keep(path), 'inheritedReceipt': plan['inheritedReceipt'],
            'inheritedFiles': len(prior), 'addedFiles': len(ADDED_TESTS), 'testFileCount': len(union),
            'excludedFiles': exclusions, 'priorScope': plan['priorScope'], 'nativeSourceDigest': native_digest}


def verify_component_oracle(e, export_path, comparison_path, qualification_path, tap, original):
    exported = e.load(export_path)
    require(exported.get('schema') == 'sra.preview-packing-recovery-oracle-execution.v1'
            and exported.get('status') == 'passed' and exported.get('exitCode') == 0
            and exported.get('pythonHashSeed') == '0' and exported.get('historicalReceiptsRecreated') is False
            and exported.get('gameExecution') is False
            and exported.get('sourceBefore') == exported.get('sourceAfter') == original,
            'Original component export is not complete, cold and unchanged')
    e.checked({**exported['script'], 'path': 'scripts/export-v6-preview-packing-reference.py'})
    fixture = e.referenced(exported['output'])
    test_fixture = e.keep('tests/fixtures/v6-preview-packing/reference.json.gz')
    require(all(test_fixture[key] == exported['output'][key] for key in ('sha256', 'bytes')),
            'Formal test fixture differs from the actual independent export')
    require(fixture['provenance']['commit'] == PIN and fixture['provenance']['sources'], 'Fixture lacks pinned source provenance')
    for name, row in fixture['provenance']['sources'].items():
        delivery.relative_name(name)
        e.checked({**row, 'path': str(ORIGINAL / 'source' / name)})
    comparison = e.load(comparison_path)
    e.keep('scripts/compare-v6-preview-packing-reference.ts')
    counts = {'sourceFiles': len(fixture['provenance']['sources']), 'initialCases': len(fixture['initial']),
              'sessions': len(fixture['sessions']), 'sourceSteps': sum(len(row['steps']) for row in fixture['sessions']),
              'helpers': {key: len(value) for key, value in fixture['helpers'].items()},
              'guards': sum(len(fixture['guards'][key]) for key in ('cases', 'continuations', 'after')),
              'stateVariants': len(fixture['stateVariants'])}
    require(comparison.get('schema') == 'sra.preview-packing-independent-source-comparison.v1'
            and comparison.get('status') == 'passed' and type(comparison.get('checks')) is int and comparison['checks'] > 0
            and comparison.get('gameExecution') is False and comparison.get('historicalResultsReused') is False
            and comparison.get('fixture') == {key: test_fixture[key] for key in ('bytes', 'sha256')}
            and all(comparison.get(key) == value for key, value in counts.items()),
            'Independent exact component comparison is incomplete or uses another fixture')
    named = 'PreviewPacking matches the independent pinned Python oracle, including complete proposals, acquisition and restored next decisions'
    require(len(re.findall(r'^ok \d+ - ' + re.escape(named) + r'\s*$', tap, re.M)) == 1,
            'Formal TAP omits or duplicates the exact component oracle test')
    qualification = e.load(qualification_path)
    require(qualification.get('schema') == 'sra.preview-packing-reader-negative-qualification.v1'
            and qualification.get('status') == 'passed' and qualification.get('gameExecution') is False
            and qualification.get('sourceBefore') == qualification.get('sourceAfter') == original
            and qualification.get('cases') and qualification.get('rejected') == len(qualification['cases'])
            and all(row.get('rejected') is True for row in qualification['cases']),
            'Cold original reader has not rejected every declared integrity mutation')
    for key, path in [('reader', 'scripts/compare-preview-packing-public-parity.py'),
                      ('qualificationScript', 'scripts/qualify-preview-packing-reader.py'),
                      ('oracle', 'scripts/export-v6-preview-packing-reference.py')]:
        e.checked({**qualification[key], 'path': path})
    e.checked(qualification['capture'])
    for receipt, label in [(exported, 'component export'), (comparison, 'component comparison'), (qualification, 'reader qualification')]:
        require(e.at(receipt['startedAt'], label + ' start') <= e.at(receipt['finishedAt'], label + ' finish'),
                'Component source proof chronology is invalid')
    return {'receipt': e.keep(export_path), 'comparison': e.keep(comparison_path),
            'readerQualification': e.keep(qualification_path), 'fixture': test_fixture, **counts,
            'checks': comparison['checks'], 'rejectedMutations': qualification['rejected'],
            'formalNamedParityCases': 1, 'nativeRestorationIsExtension': True}


def verify_preview_execution(e, path, component):
    receipt = e.load(path)
    require(receipt.get('schema') == 'logos-engine.actual-command-execution.v1'
            and receipt.get('status') == 'passed' and receipt.get('exitCode') == 0
            and receipt.get('inputsUnchanged') is True, 'Targeted Preview execution did not preserve its watched inputs')
    command = receipt['command']
    permitted = {'node', '--test', '--test-concurrency=1', '--test-reporter=tap', *ADDED_TESTS}
    require(command and command[0] == 'node' and '--test' in command
            and '--test-reporter=tap' in command and all(part in permitted for part in command)
            and 'tests/v6-preview-packing-reference.test.ts' in command,
            'Targeted verification must execute the exact Preview oracle test without a name filter or unrelated game module')
    test_files = [part for part in command if part in ADDED_TESTS]
    require(len(test_files) == len(set(test_files)), 'Targeted verification repeats a test file')
    for record in receipt['inputs']:
        e.checked(record)
    inputs = {row['path'] for row in receipt['inputs']}
    required = {e.keep(name)['path'] for name in [*test_files, 'scripts/compare-v6-preview-packing-reference.ts',
                                                'tests/fixtures/v6-preview-packing/reference.json.gz']}
    require(required <= inputs, 'Actual targeted execution did not watch its imported comparator, fixture and test modules')
    require(component['fixture'] in receipt['inputs'], 'Targeted execution used another exported oracle fixture')
    tap = e.text(e.checked(receipt['output']))
    counts = {}
    for key in COUNT_KEYS:
        found = re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M)
        require(len(found) == 1, 'Targeted TAP summary is missing or repeated: ' + key)
        counts[key] = int(found[0])
    counts_valid(counts, 'targeted Preview input binding')
    name = 'PreviewPacking matches the independent pinned Python oracle, including complete proposals, acquisition and restored next decisions'
    require(len(re.findall(r'^ok \d+ - ' + re.escape(name) + r'\s*$', tap, re.M)) == 1,
            'Targeted execution did not run the complete oracle comparison')
    started = e.at(receipt['startedAt'], 'targeted Preview verification start')
    require(started <= e.at(receipt['finishedAt'], 'targeted Preview verification finish'), 'Targeted chronology is invalid')
    for key in ('receipt', 'comparison'):
        proof = e.referenced(component[key])
        require(instant(proof['finishedAt']) <= started, 'Targeted verification precedes the retained current oracle export/comparison')
    return {'receipt': e.keep(path), 'testFiles': test_files, 'counts': counts, 'inputsUnchanged': True}


def verify_cold_public(e, path, campaign_path, native, original):
    execution = e.load(path)
    require(execution.get('schema') == 'sra.preview-packing-cold-original-execution.v1'
            and execution.get('status') == 'passed' and execution.get('exitCode') == 0
            and execution.get('sourceBefore') == execution.get('sourceAfter') == original
            and execution.get('gameExecution') is False and execution.get('nativeStateSeed') is False
            and execution.get('nativePlanSeed') is False and execution.get('differences') == 0
            and execution.get('stop') is None, 'Actual cold public original replay is incomplete')
    for key, generator in [('reader', 'scripts/compare-preview-packing-public-parity.py'),
                           ('oracle', 'scripts/export-v6-preview-packing-reference.py')]:
        e.checked({**execution[key], 'path': generator})
    capture = e.referenced(execution['input'])
    report = e.referenced(execution['output'])
    require(capture.get('status') == 'passed' and capture.get('game') == 'KATA'
            and capture.get('referenceCommit') == PIN and capture.get('source') == native
            and capture.get('sourceUnchangedDuringRun') is True and capture.get('pythonAgentModules') == []
            and capture.get('failure') is None, 'Cold public comparison does not identify the completed frozen KATA campaign')
    campaign = e.load(campaign_path)
    require(campaign.get('schema') == 'logos-engine.v53.actual-journaled-campaign-execution.v1'
            and campaign.get('exitCode') == 0 and campaign.get('nativeSource') == campaign.get('nativeSourceAfter') == native
            and campaign.get('nativeSourceUnchanged') is True and campaign.get('executionCodeUnchanged') is True
            and campaign.get('executionInputs') == campaign.get('executionInputsAfter')
            and local(campaign['report']['path']) == local(execution['input']['path'])
            and campaign['report']['sha256'] == execution['input']['sha256'],
            'Cold original comparison does not bind an actual unchanged native campaign execution')
    for record in [*campaign['executionInputs'].values(), campaign['report'], campaign['trace'],
                   campaign['publicJournal'], campaign['output']]:
        e.checked(record)
    require(campaign['executionInputs']['generator'] == e.keep('scripts/run-v53-campaign-proof.py')
            and campaign['executionInputs']['runner'] == e.keep('scripts/run-v53-journaled-campaign.mjs')
            and campaign['executionInputs']['harness'] == e.keep('tests/helpers/v6-live-game-campaign.ts'),
            'Actual public campaign implementation changed')
    require(campaign['command'][:4] == ['node', str(ROOT / 'scripts/run-v53-journaled-campaign.mjs'), 'KATA', '3']
            and capture.get('targetLevels') == 3 and capture.get('final', {}).get('levelsCompleted') == 3
            and [row['levelsCompleted'] for row in capture['boundaries']] == [1, 2, 3],
            'Actual KATA campaign does not retain three natural level boundaries')
    require(e.at(campaign['startedAt'], 'actual KATA campaign start')
            <= e.at(campaign['finishedAt'], 'actual KATA campaign finish') <= instant(execution['startedAt']),
            'Cold original replay predates the actual public campaign')
    require(report.get('schema') == 'sra.preview-packing-cold-original-parity.v1'
            and report.get('status') == 'passed' and report.get('coldStart') is True
            and report.get('nativeStatesUsedToPrimeSource') is False and report.get('nativePlansUsedToAcquireSource') is False
            and report.get('stop') is None and report.get('differences') == [], 'Cold public comparison is not exact')
    counts = report['counts']
    expected_keys = ('selectedRecords', 'modelChangingRecords', 'controlChangingRecords', 'epochBoundaryReturns',
                     'actualRestores', 'actionChangingAblations', 'ablations', 'nonemptyAblations', 'ablationErrors',
                     'chronologicalEvents', 'comparedEvents', 'uniqueObservations', 'selectedPrefixes', 'foreignPrefixes',
                     'propose', 'proposed', 'before', 'after', 'record')
    require(all(type(counts.get(key)) is int and counts[key] >= 0 for key in expected_keys)
            and execution.get('counts') == counts and counts['ablationErrors'] == 0
            and counts['comparedEvents'] == counts['chronologicalEvents'] == len(capture['previewPackingEvents'])
            == len(report['callChecks']) and counts['record'] == counts['selectedRecords'] > 0,
            'Cold replay omitted real calls, selected records or current restore operations')
    require(all(counts[key] > 0 for key in ('modelChangingRecords', 'controlChangingRecords', 'actualRestores',
                                          'epochBoundaryReturns', 'selectedPrefixes', 'actionChangingAblations')),
            'Actual KATA journal lacks acquired model, controls, restored use, boundary or action-changing ablation')
    require(len(report['guardCoverage']) == len(report['physicalActionChecks']) == counts['selectedRecords']
            and all(row.get('passed') is True for row in report['guardCoverage'])
            and all(row.get('differences') == 0 for row in report['physicalActionChecks'])
            and len(report['prefixChecks']) == len(capture['prefixes']) > 0
            and all(row.get('passed') is True for row in report['prefixChecks'])
            and len(report['restorationChecks']) == counts['actualRestores']
            and all(row.get('nativeStateSeed') is False for row in report['restorationChecks']),
            'Cold replay lacks exact guards, physical actions, complete prefix states or actual restores')
    require(e.at(execution['startedAt'], 'cold original replay start')
            <= e.at(execution['finishedAt'], 'cold original replay finish'), 'Cold original replay chronology is invalid')
    return {'execution': e.keep(path), 'campaignExecution': e.keep(campaign_path),
            'capture': execution['input'], 'trace': campaign['trace'], 'comparison': execution['output'],
            'counts': counts, 'scope': report['scope'], 'nativeRestorationIsExtension': True}


def verify_regression_recovery(e, path, regression, native):
    composition = regression.get('composition')
    if composition is None:
        return None
    tool = BASE / 'consolidate-regression-recovery.py'
    verifier = load_helper('lot6a_completed_regression_recovery', tool)
    verified = verifier.verify_summary(path, native)
    require(same(verified, regression), 'Actual composed regression summary changed during verification')
    e.keep(tool)
    for record in composition['inputs']:
        e.checked(record)
    return {key: composition[key] for key in ('schema', 'generator', 'originalSummary', 'recoverySummary',
        'originalExecution', 'recoveryExecution', 'intermediateFailedSummary', 'intermediateFailedExecution',
        'finalRecoverySummary', 'finalRecoveryExecution',
        'selectedOriginalCases', 'selectedRecoveryCases', 'selectedIntermediateFailedCases', 'selectedFinalRecoveryCases', 'sourceInvocations',
        'originalStatusPreserved', 'recoveryStatusPreserved', 'retainedFailures', 'replaysExecuted', 'comparisonsReexecuted')}


def replay_case_context(regression, row):
    if regression.get('composition') is None:
        require('postprocessingFinishedAt' in row, 'A direct replay summary lacks its actual comparison finish time')
        return {'caseManifest': regression['caseManifest'], 'finishedAt': row['postprocessingFinishedAt'],
                'timeBasis': 'actual_case_receipt'}
    selections = [item for item in regression['composition']['selections'] if item['case'] == row['case']]
    require(len(selections) == 1 and selections[0]['execution'] == row['execution'],
            'Composed replay lacks its exact source invocation provenance')
    selected = selections[0]
    return {'caseManifest': selected['caseManifest'], 'finishedAt': selected['postprocessingCompletedNoLaterThan'],
            'timeBasis': selected['postprocessingTimeBasis'], 'enclosingExecution': selected['enclosingExecution']}


def verify_replay_scope(e, regression, case_manifest, cold_public, comparison_count):
    previous = e.load(ROOT / 'docs/migration/lot5b-evidence/integrated-final/regressions/regression-summary.json')
    previous_cases = e.referenced(previous['caseManifest'])
    inherited = previous_cases['cases']
    current = case_manifest['cases']
    require(previous.get('status') == 'passed' and len(inherited) == 10
            and len(current) == len(inherited) + 1 and same(current[:-1], inherited),
            'Replay scope must preserve the ten exact published historical cases and add one fresh KATA case')
    fresh = current[-1]
    require(fresh.get('game') == 'KATA'
            and fresh.get('comparisonBasis') == 'fresh_current_native_self_consistency'
            and local(fresh['baseline']['path']) == local(cold_public['capture']['path'])
            and fresh['baseline']['sha256'] == cold_public['capture']['sha256']
            and local(fresh['trace']['path']) == local(cold_public['trace']['path'])
            and fresh['trace']['sha256'] == cold_public['trace']['sha256'],
            'Fresh KATA replay must explicitly identify current-native self-consistency and its actual cold capture')
    require(comparison_count == len(current) * len(STRICT_REGRESSION_CHECK_NAMES)
            and regression['passed'] == regression['total'] == len(current), 'Replay scope/check totals differ')
    return {'caseManifest': regression['caseManifest'],
            'historical': {'caseManifest': previous['caseManifest'], 'cases': len(inherited),
                           'checks': len(inherited) * len(STRICT_REGRESSION_CHECK_NAMES)},
            'freshSelfConsistency': {'case': fresh['id'], 'game': fresh['game'],
                                     'checks': len(STRICT_REGRESSION_CHECK_NAMES), 'capture': cold_public['capture'],
                                     'execution': regression['results'][-1]['execution'],
                                     'startedAt': regression['results'][-1]['startedAt'],
                                     'finishedAt': replay_case_context(regression, regression['results'][-1])['finishedAt'],
                                     'timeBasis': replay_case_context(regression, regression['results'][-1])['timeBasis']},
            'totalCases': len(current), 'totalChecks': comparison_count,
            'qualification': 'Ten historical regressions and one explicitly current-native KATA self-consistency replay; '
                             'the fresh case is not a historical command identity claim.'}


def verify_presence(e, path, qualification_path, regression, native):
    receipt = e.load(path)
    require(receipt.get('schema') == 'logos-engine.lot6a.preview-owner-presence.v1'
            and receipt.get('status') == 'passed' and receipt.get('mode') == 'recorded_public_regressions'
            and receipt.get('nativeDigest') == native['digest']
            and receipt.get('caseManifest') == regression['caseManifest']
            and receipt.get('inputsUnchanged') is True and receipt.get('errors') == [],
            'Independent owner-presence reader is not a completed verification of this replay campaign')
    require(e.referenced(receipt['regressionSummary']) == regression,
            'Owner-presence reader identifies another completed regression summary')
    require(receipt.get('generator') == e.keep('scripts/verify-preview-packing-presence.py'),
            'Owner-presence verification implementation changed')
    for record in receipt['inputs']:
        e.checked(record)
    cases = receipt['cases']
    require(len(cases) == len(regression['results'])
            and [row['case'] for row in cases] == [row['case'] for row in regression['results']],
            'Owner-presence proof omits or reorders a replay case')
    for index, (actual, replay) in enumerate(zip(cases, regression['results'])):
        require(actual.get('report') == replay['report'] and actual.get('status') == 'passed'
                and actual.get('errors') == [] and actual.get('nativeDigest') == native['digest'],
                'Owner-presence proof checks another actual replay report or retains errors')
        e.checked(actual['report'])
        for key in ('prefixes', 'selectedPrefixes', 'foreignPrefixes', 'selectedReturns', 'passiveReturns', 'actualRestores'):
            require(type(actual.get(key)) is int and actual[key] >= 0, 'Owner-presence population is missing: ' + key)
        require(actual['prefixes'] == actual['selectedPrefixes'] + actual['foreignPrefixes']
                and actual['passiveReturns'] == 0, 'Preview has an unowned prefix or passive acquisition')
        if index < len(cases) - 1:
            require(actual['selectedReturns'] == actual['selectedPrefixes'] == 0,
                    'Preview acquired an action on a historical foreign-owner trace')
        else:
            require(actual['selectedReturns'] > 0 and actual['selectedPrefixes'] > 0 and actual['actualRestores'] > 0,
                    'Fresh KATA replay lacks selected Preview acquisition and actual restoration')
    for key in ('prefixes', 'selectedPrefixes', 'foreignPrefixes', 'selectedReturns', 'passiveReturns', 'actualRestores'):
        require(receipt['totals'].get(key) == sum(row[key] for row in cases), 'Owner-presence total differs: ' + key)
    qualification = e.load(qualification_path)
    require(qualification.get('schema') == receipt['schema'] and qualification.get('mode') == 'synthetic_qualification'
            and qualification.get('status') == 'passed' and qualification.get('inputsUnchanged') is True
            and qualification.get('generator') == receipt['generator'], 'Owner-presence negative qualification is missing or stale')
    negative = qualification['negativeQualification']
    require(negative.get('status') == 'passed' and negative.get('baselineMustPass') is True
            and negative.get('mutations') == negative.get('rejected') == negative.get('expectedErrorsObserved')
            == len(negative['cases']) > 0
            and all(row.get('rejected') is True and row.get('expectedErrorObserved') is True for row in negative['cases']),
            'Owner-presence verifier accepted a mutated native journal or source fact')
    for record in qualification['inputs']:
        e.checked(record)
    require(e.at(qualification['recordedAt'], 'owner-presence negative qualification')
            <= e.at(receipt['recordedAt'], 'owner-presence full campaign'), 'Owner-presence qualification follows its campaign check')
    return {'receipt': e.keep(path), 'caseManifest': receipt['caseManifest'],
            'regressionSummary': receipt['regressionSummary'], 'cases': len(cases), 'totals': receipt['totals'],
            'negativeQualification': e.keep(qualification_path), 'rejectedMutations': negative['rejected']}


def verify_preview_build(e, record, native, worker):
    manifest = e.referenced(record)
    require(manifest.get('schema') == 'logos-engine.lot6a.static-preview-inputs.v1'
            and manifest.get('nativeDigest') == native['digest']
            and manifest.get('validatedDistRoot') == str(ROOT / 'dist')
            and manifest.get('previewDistRoot') == str(ROOT / '.sites-runtime/qa/dist'),
            'Browser preview does not identify the exact validated local build')
    files = manifest.get('files')
    require(isinstance(files, list) and files and type(manifest.get('fileCount')) is int
            and manifest['fileCount'] == len(files) and len({row['path'] for row in files}) == len(files)
            and len({row['previewPath'] for row in files}) == len(files), 'Preview file inventory is incomplete or repeated')
    for row in files:
        name = delivery.relative_name(row['path'])
        require(name.startswith('dist/') and row['previewPath'] == '.sites-runtime/qa/' + name,
                'Preview file mapping is not an exact dist copy')
        e.checked({key: row[key] for key in ('path', 'sha256', 'bytes')})
        e.checked({'path': row['previewPath'], 'sha256': row['sha256'], 'bytes': row['bytes']})
    require({row['path'] for row in files} == {path.relative_to(ROOT).as_posix() for path in delivery.walk_files(ROOT / 'dist')}
            and {row['previewPath'] for row in files} == {path.relative_to(ROOT).as_posix()
                 for path in delivery.walk_files(ROOT / '.sites-runtime/qa/dist')}, 'Validated or preview dist membership changed')
    require(any(all(row[key] == worker[key] for key in ('path', 'sha256', 'bytes')) for row in files),
            'Preview inventory omits the exact validated native worker')
    return {'manifest': e.keep(record['path']), 'fileCount': len(files), 'byteIdentical': True}


def verify_browser(e, path, native, worker):
    receipt = e.load(path)
    require(receipt.get('schema') == 'logos-engine.lot6a.browser-qa.v1' and receipt.get('status') == 'passed'
            and receipt.get('nativeDigest') == native['digest'] and receipt.get('worker') == worker
            and receipt.get('game') == 'KATA' and receipt.get('targetLevels') == 3
            and isinstance(receipt.get('qualification'), str) and receipt['qualification'].strip(),
            'Actual browser QA is incomplete or identifies another native build')
    e.checked(worker)
    build = verify_preview_build(e, receipt['previewBuild']['manifest'], native, worker)
    observations = []
    require(receipt.get('observations'), 'Actual browser observations are absent')
    for record in receipt['observations']:
        rows = e.referenced(record)
        require(isinstance(rows, list) and rows, 'Empty browser observation artifact')
        observations.extend(rows)
    indexed, times = {}, []
    last_counters = (0, 0, 0)
    for row in observations:
        key = (row['observedAt'], row['url'])
        require(key not in indexed and isinstance(row.get('panel'), str), 'Repeated or malformed actual browser observation')
        found = re.findall(r'(?:^|\n)(\d+)\nactions\n(\d+)\nlevels solved\n(\d+)\ncompleted plans(?:\n|$)', row['panel'])
        require(len(found) == 1, 'Actual browser panel lacks one unambiguous action/level/plan population')
        counters = tuple(int(value) for value in found[0])
        require(all(after >= before for before, after in zip(last_counters, counters)),
                'Browser counters reset within the retained cold session')
        indexed[key] = (row, counters)
        times.append(e.at(row['observedAt'], 'browser observation'))
        last_counters = counters
    require(times == sorted(times), 'Actual browser observations are not chronological')
    used = set()

    def observed(state):
        require(isinstance(state, dict) and all(type(state.get(key)) is int and state[key] >= 0
                for key in ('actions', 'levelsCompleted', 'plans', 'level')), 'Invalid browser state population')
        key = (state['observedAt'], state['url'])
        require(key in indexed, 'Browser conclusion lacks its actual UI observation')
        row, counters = indexed[key]
        require(counters == (state['actions'], state['levelsCompleted'], state['plans'])
                and isinstance(state.get('observedStatus'), str) and state['observedStatus'] in row['panel'].splitlines(),
                'Browser conclusion differs from the actual panel text')
        query = parse_qs(urlparse(state['url']).query)
        require(query.get('game') == ['KATA'] and query.get('level') == [str(state['level'])],
                'Observed browser route names another game or level')
        used.add(key)
        return instant(state['observedAt'])

    initial, step, paused, resumed, final = [receipt[key] for key in ('initial', 'singleStep', 'paused', 'stepAfterPause', 'final')]
    require((initial['actions'], initial['levelsCompleted'], initial['plans'], initial['level']) == (0, 0, 0, 1),
            'Browser session was not observed cold at level one')
    require(step.get('observedStatus') == resumed.get('observedStatus') == 'One action completed.'
            and step.get('actionsBefore') == initial['actions']
            and step.get('actionsAfter') == step['actions'] == initial['actions'] + 1
            and paused.get('observedStatus') == 'Paused.'
            and resumed.get('actionsBefore') == paused['actions']
            and resumed.get('actionsAfter') == resumed['actions'] == paused['actions'] + 1,
            'Browser lacks actual single-action execution, acknowledged Pause and single-action resume')
    boundaries = receipt.get('boundaries')
    require(isinstance(boundaries, list) and len(boundaries) == 3
            and [row.get('levelsCompleted') for row in boundaries] == [1, 2, 3]
            and [row.get('level') for row in boundaries] == [2, 3, 4]
            and all(row.get('observedStatus') == 'Level completed.' for row in boundaries)
            and all(first['actions'] < second['actions'] for first, second in zip(boundaries, boundaries[1:]))
            and same(final, boundaries[-1]), 'Browser lacks three consecutive natural level boundaries')
    start, stepped, pause, resume, finish = [observed(row) for row in (initial, step, paused, resumed, final)]
    boundary_times = [observed(row) for row in boundaries]
    require(start < stepped <= boundary_times[0] < pause < resume <= boundary_times[1] < boundary_times[2] == finish,
            'Browser controls or boundaries are out of order')
    earlier = receipt.get('earlierPauseAttempt')
    if earlier is not None:
        require(isinstance(earlier.get('qualification'), str) and earlier['qualification'].strip()
                and observed(earlier['request']) <= observed(earlier['settled']) < pause
                and earlier['settled'].get('observedStatus') != 'Paused.',
                'Earlier pause attempt was dropped or relabeled as the successful acknowledgment')
    require(used == set(indexed), 'Browser receipt omits an actual retained observation')
    require(e.at(receipt['startedAt'], 'browser session start') == start
            and e.at(receipt['finishedAt'], 'browser session finish') == finish
            <= e.at(receipt['recordedAt'], 'browser QA receipt'), 'Browser receipt chronology differs from actual observations')
    screenshot = e.checked(receipt['screenshot'])
    with screenshot.open('rb') as stream:
        header = stream.read(8)
    image_format = 'png' if header == b'\x89PNG\r\n\x1a\n' else 'jpeg' if header[:3] == b'\xff\xd8\xff' else None
    require(image_format is not None, 'Browser screenshot lacks a recognized retained image payload')
    return {'receipt': e.keep(path), 'status': 'passed', 'observed': True, 'game': 'KATA', 'targetMet': True,
            'final': final, 'boundaries': len(boundaries), 'pauseObserved': True, 'singleActionResumeObserved': True,
            'previewBuild': build, 'observations': len(observations),
            'screenshotFormat': image_format, 'earlierPauseAttemptRetained': earlier is not None,
            'qualification': receipt['qualification']}


def verify_clock(e, path, cold_public, browser, replay_scope):
    clock = e.load(path)
    require(clock.get('schema') == 'logos-engine.lot6a.cumulative-case-clock.v1'
            and clock.get('case') == 'KATA' and clock.get('status') == 'completed_within_budget'
            and clock.get('active') is None and clock.get('limitSeconds') == 2400
            and clock.get('generator') == e.keep(BASE / 'case-clock.py'),
            'The actual cumulative KATA clock is not closed within its original budget')
    prior = e.referenced(clock['priorObservation'])
    require(clock['priorObservation'] == e.keep(BASE / 'recovery/recovery-observation.json')
            and prior.get('schema') == 'logos-engine.lot6a.workspace-recovery.v1'
            and prior['caseBudget'].get('case') == 'KATA' and prior['caseBudget'].get('reset') is False
            and prior['caseBudget'].get('limitSeconds') == clock['limitSeconds']
            and clock.get('priorChargedSeconds') == prior['caseBudget'].get('priorChargedSeconds') == 1489.2254091450009,
            'The retained pre-recovery KATA charge was changed or reset')
    intervals = clock.get('intervals')
    require(isinstance(intervals, list) and intervals, 'No actual KATA interval was charged')
    ordered, elapsed, previous = [], 0, None
    for row in intervals:
        started = e.at(row['startedAt'], 'charged KATA interval start')
        finished = e.at(row['finishedAt'], 'charged KATA interval finish')
        require(isinstance(row.get('label'), str) and row['label'].strip()
                and started <= finished and (previous is None or previous <= started)
                and finite(row.get('startedMonotonic')) and row['startedMonotonic'] >= 0
                and isinstance(row.get('bootId'), str) and row['bootId']
                and finite(row.get('elapsedSeconds')) and row['elapsedSeconds'] >= 0,
                'Invalid, overlapping or unordered charged KATA interval')
        require(abs((finished - started).total_seconds() - row['elapsedSeconds']) <= 1,
                'KATA wall and retained monotonic interval disagree')
        ordered.append((started, finished))
        elapsed += row['elapsedSeconds']
        previous = finished
    require(finite(clock.get('chargedSeconds')) and finite(clock.get('remainingSeconds'))
            and clock['chargedSeconds'] == clock['priorChargedSeconds'] + elapsed
            and clock['remainingSeconds'] == clock['limitSeconds'] - clock['chargedSeconds'] >= 0,
            'Cumulative KATA arithmetic excludes a prior or current charge')
    require(previous <= e.at(clock['updatedAt'], 'closed KATA clock'), 'Clock closure predates its final interval')
    spans = []
    for key, label in [('campaignExecution', 'actual KATA campaign'), ('execution', 'cold original KATA replay')]:
        receipt = e.referenced(cold_public[key])
        spans.append((receipt['startedAt'], receipt['finishedAt'], label))
    browser_receipt = e.referenced(browser['receipt'])
    spans.append((browser_receipt['startedAt'], browser_receipt['finishedAt'], 'actual KATA browser QA'))
    fresh = replay_scope['freshSelfConsistency']
    e.checked(fresh['execution'])
    spans.append((fresh['startedAt'], fresh['finishedAt'], 'recorded KATA self-consistency replay'))
    for start, finish, label in spans:
        started, finished = instant(start), instant(finish)
        require(started <= finished and any(left <= started <= finished <= right for left, right in ordered),
                'Actual case work is outside its charged interval: ' + label)
    return {'receipt': e.keep(path), 'case': 'KATA', 'limitSeconds': clock['limitSeconds'],
            'priorChargedSeconds': clock['priorChargedSeconds'], 'chargedSeconds': clock['chargedSeconds'],
            'remainingSeconds': clock['remainingSeconds'], 'active': None, 'clockReset': False,
            'intervals': len(intervals), 'coveredExecutions': [label for _, _, label in spans],
            'priorObservation': clock['priorObservation']}


def verify_isolation(e, path, max_age_seconds, horizon=None):
    require(finite(max_age_seconds) and 0 < max_age_seconds <= 3600, 'Invalid quiet freshness interval')
    isolation = e.load(path)
    require(isolation.get('schema') == 'logos-engine.coordinated-cost-isolation.v1'
            and isolation.get('status') == 'acknowledged_quiet_before_window'
            and isolation.get('otherLaneAcknowledged') is True and isolation.get('ownTrackedComputeEnded') is True
            and isolation.get('previewStopped') is True and isolation.get('costNodeOptionsOverride') is None,
            'Cooperative quiet interval is not acknowledged')
    requested = e.at(isolation['requestedAt'], 'quiet request')
    recorded = e.at(isolation['recordedAt'], 'quiet receipt')
    require(requested <= recorded and isolation.get('evidence'), 'Quiet request/evidence is missing')
    for record in isolation['evidence']:
        e.checked(record)
    lanes = isolation.get('laneAcknowledgements', [])
    required_lanes = isolation.get('requiredQuietLanes', [])
    require(required_lanes and len(required_lanes) == len(set(required_lanes))
            and len(lanes) == len(required_lanes) and {row['lot'] for row in lanes} == set(required_lanes),
            'Known concurrent lanes are not completely accounted for')
    observed = []
    for row in lanes:
        require(row.get('activeCommand') is None and row.get('executionStopped') is True,
                'Another lane retains active execution: ' + row['lot'])
        e.checked(row['evidence'])
        timestamp = e.at(row['observedAt'], row['lot'] + ' quiet observation')
        require(requested <= timestamp <= recorded, 'Lane evidence was not freshly observed after the quiet request')
        if row.get('terminalRelease') is not True:
            require(requested <= e.at(row['acknowledgedAt'], row['lot'] + ' quiet acknowledgement') <= timestamp,
                    'Active lane acknowledgement predates this quiet request')
        else:
            require(isinstance(row.get('releaseStatement'), str) and row['releaseStatement'].strip(),
                    'Terminal lane release lacks its actual statement')
        observed.append(timestamp)
    agents = isolation.get('ownAgents', [])
    tracked = isolation.get('trackedAgentIds', [])
    require(agents and tracked and len(tracked) == len(set(tracked)) and len(agents) == len(tracked)
            and {row['id'] for row in agents} == set(tracked), 'Own tracked execution agents are not completely accounted for')
    for row in agents:
        require(row.get('activeCommand') is None and row.get('executionStopped') is True, 'An own agent retains active execution')
        e.checked(row['evidence'])
        require(e.at(row['stoppedAt'], row['id'] + ' compute ended') <= recorded, 'Own compute ended after the quiet receipt')
    horizon = horizon or datetime.now(timezone.utc)
    require(all(0 <= (horizon - timestamp).total_seconds() <= max_age_seconds
                for timestamp in [recorded, *observed]),
            'Quiet evidence is stale or dated after the authorization horizon')
    return isolation


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--performance-directory', type=Path, required=True)
    parser.add_argument('--candidate-source-directory', type=Path, required=True)
    parser.add_argument('--validation-directory', type=Path, default=Path('validation'))
    parser.add_argument('--regression-summary', type=Path, required=True)
    parser.add_argument('--test-scope-plan', type=Path, required=True)
    parser.add_argument('--publication-chain', type=Path, required=True)
    parser.add_argument('--oracle-export-receipt', type=Path, required=True)
    parser.add_argument('--oracle-comparison', type=Path, required=True)
    parser.add_argument('--reader-qualification', type=Path, required=True)
    parser.add_argument('--preview-verification-execution', type=Path, required=True)
    parser.add_argument('--cold-public-execution', type=Path, required=True)
    parser.add_argument('--campaign-execution', type=Path, required=True)
    parser.add_argument('--owner-presence', type=Path, required=True)
    parser.add_argument('--owner-presence-qualification', type=Path, required=True)
    parser.add_argument('--browser-receipt', type=Path, required=True)
    parser.add_argument('--case-clock', type=Path, required=True)
    parser.add_argument('--audit-receipt', type=Path)
    parser.add_argument('--quiet-max-age-seconds', type=float, default=900,
                        help='Maximum age of fresh quiet observations; recorded in readiness (default: 900).')
    args = parser.parse_args()
    perf, candidate_dir = local(args.performance_directory), local(args.candidate_source_directory)
    require(perf.is_relative_to(BASE) and candidate_dir.is_relative_to(BASE), 'Expected final 6A evidence directories')
    require(finite(args.quiet_max_age_seconds) and 0 < args.quiet_max_age_seconds <= 3600, 'Invalid quiet freshness interval')
    validation = (candidate_dir / args.validation_directory).resolve()
    require(validation.is_relative_to(candidate_dir), 'Validation directory escapes final evidence')
    no_window(perf)
    e = Evidence()
    e.keep(__file__)
    bind_common_helpers(e)
    declaration = e.load(perf / 'declaration.json')
    policy = e.load(perf / 'global-budget-policy.json')
    preparation = e.load(perf / 'preparation.json')
    protocol = e.load(perf / 'protocol-check.json')
    require(declaration.get('schema') == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration.get('status') == 'declared_before_official_window'
            and declaration.get('noOfficialWindowAtDeclaration') is True
            and declaration.get('functionalReadinessNotAnticipated') is True
            and preparation.get('status') == 'source_freezes_verified_not_functional_readiness'
            and preparation.get('measurementExecuted') is False, 'Protocol was not finalized before measurement')
    e.baseline = Path(preparation['baselineCheckout']).resolve()
    require(e.baseline != ROOT and preparation['candidateCheckout'] == str(ROOT), 'Wrong declared checkout pair')
    no_window(perf, e.baseline)
    for key in ('protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy', 'baselineManifest',
                'candidateManifest', 'candidateArchiveManifest', 'globalDecisionTool', 'globalCalculationTool'):
        e.checked(declaration[key])
    for record in declaration['officialTools']:
        e.checked(record)
    require(local(declaration['candidateManifest']['path']) == candidate_dir / 'source-manifest.json'
            and local(declaration['candidateArchiveManifest']['path']) == candidate_dir / 'source-archive.json',
            'Final evidence directory differs from the protocol')
    native = e.referenced(declaration['candidateManifest'])
    baseline = e.referenced(declaration['baselineManifest'])
    digest = native['digest']
    for role, manifest in (('baseline', baseline), ('candidate', native)):
        manifest_valid(manifest, role)
        require(declaration[role] == policy[role] == preparation[role]
                and declaration['nativeDigests'][role] == policy[role]['nativeDigest'] == manifest['digest']
                and policy[role]['nativeFiles'] == manifest['fileCount']
                and re.fullmatch(r'\d+\.\d+\.\d+', policy[role]['nativeVersion']), 'Declared source identities differ')
    require(digest != baseline['digest'], 'Candidate and baseline have identical native source')
    actual = {path.relative_to(ROOT).as_posix(): e.keep(path)['sha256']
              for folder in ('src/logos-engine', 'src/runtime') for path in (ROOT / folder).rglob('*')
              if path.is_file() and path.suffix in ('.ts', '.json', '.drm')}
    require(actual == native['files'], 'Current native source differs from its final freeze')
    baseline_actual = {}
    for folder in ('src/logos-engine', 'src/runtime'):
        for path in (e.baseline / folder).rglob('*'):
            if path.is_file() and path.suffix in ('.ts', '.json', '.drm'):
                record = fingerprint(path, external=True)
                e.checked(record, allow_external=True)
                baseline_actual[path.relative_to(e.baseline).as_posix()] = record['sha256']
    require(baseline_actual == baseline['files'], 'Actual baseline checkout differs from its published freeze')
    versions = re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]",
                          e.text('src/logos-engine/v6-native-runtime.ts'))
    require(versions == [policy['candidate']['nativeVersion']], 'Actual native version differs from the declaration')
    archive = e.referenced(declaration['candidateArchiveManifest'])
    published = publication_chain(e, args.publication_chain, baseline, policy, archive, declaration['candidateArchiveManifest'])
    parts = e.load(candidate_dir / 'source-archive-parts.json')
    require(archive.get('nativeSourceManifestDigest') == digest
            and archive.get('baseCommit') == policy['candidate']['sourceBaseCommit']
            and all(archive['files'].get(name) == sha for name, sha in native['files'].items()),
            'Frozen archive does not contain the integrated native source')
    e.checked(archive['archive'])
    e.file_map(archive['files'], 'frozen source archive')
    require(parts.get('original') == archive['archive'] and parts.get('parts'), 'Frozen archive parts have another identity')
    packed_hash, packed_bytes = hashlib.sha256(), 0
    for record in parts['parts']:
        path = e.checked(record)
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                packed_hash.update(chunk)
                packed_bytes += len(chunk)
    require(packed_hash.hexdigest() == archive['archive']['sha256'] and packed_bytes == archive['archive']['bytes'],
            'Frozen archive parts do not reconstruct the same bytes')
    require(protocol.get('status') == 'protocol_contract_passed' and protocol['nativeDigests'] == declaration['nativeDigests'],
            'Protocol check names another source pair')
    require(policy.get('globalStage') == 'session_elapsed' and policy.get('relativeIncreaseLimit') == 0.1
            and policy.get('comparison') == 'strictly_less_than' and policy.get('allCasesMustPass') is True
            and policy.get('crossCaseCompensation') is False and policy.get('phaseOverrunsMayBeAccepted') is True
            and policy.get('phasesAndP95RemainVisible') is True and declaration.get('phaseOverrunsBlockAcceptance') is False,
            'The retained global cost rule or visibility of phase overruns changed')
    require(e.at(preparation['preparedAt'], 'source preparation') == e.at(policy['declaredAt'], 'global policy')
            <= e.at(declaration['recordedAt'], 'protocol recording') <= instant(declaration['finalizedAt']),
            'Source preparation/protocol chronology differs')

    tests, checks = [e.load(validation / name) for name in ('delta-tests-run.json', 'checks-run.json')]
    delivery.verify_tests(tests, native)
    delivery.verify_build(checks, native)
    for receipt in (tests, checks):
        require(receipt.get('schema') == 'logos-engine.native-delta-verification.v1' and receipt.get('status') == 'passed'
                and receipt.get('generator') == e.keep(TEST_RUNNER) and receipt.get('nativeSource') == native
                and receipt.get('nativeSourceManifestDigest') == digest and receipt.get('nativeSourceUnchanged') is True,
                'Formal verification is incomplete or names another final freeze')
        for row in receipt['checks']:
            require(type(row.get('exitCode')) is int and row['exitCode'] == 0, 'A formal check failed')
            require(e.at(row['startedAt'], row['name'] + ' start') <= e.at(row['finishedAt'], row['name'] + ' finish'),
                    'Formal check chronology is invalid')
            e.checked(row['output'])
    require(len(tests['checks']) == 1 and tests['checks'][0]['name'] == 'delta-tests'
            and tests.get('sourceAndTestInputsUnchanged') is True and tests['checks'][0].get('tapSummaryComplete') is True,
            'Formal test receipt is incomplete')
    e.file_map(tests['sourceAndTestInputs'], 'formal source and test inputs')
    scope = verify_scope(e, args.test_scope_plan, tests, digest, published)
    counts = tests['checks'][0]['counts']
    counts_valid(counts, 'integrated 6A')
    tap = e.text(tests['checks'][0]['output']['path'])
    require(all(re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M) == [str(counts[key])] for key in COUNT_KEYS),
            'Formal counts differ from actual retained TAP')
    require(tests['checks'][0]['command'] == ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *tests['testFiles']],
            'Formal command differs from the declared union')
    require([row['name'] for row in checks['checks']] == CHECK_NAMES, 'Exactly the five retained release checks are required')
    e.checked(checks['nativeAgentWorker'])
    e.file_map(checks['buildInputs'], 'build inputs')
    if args.audit_receipt:
        audit_receipt = e.load(args.audit_receipt)
        require(audit_receipt.get('status') == 'passed' and audit_receipt.get('exitCode') == 0
                and audit_receipt.get('nativeSourceDigest') == digest, 'Audit resolution is not passed for the final source')
        audit = e.referenced(audit_receipt['output'])
        require(audit == audit_receipt['audit'], 'Audit resolution differs from its actual log')
    else:
        audit = e.referenced(checks['checks'][2]['output'])
    require(audit.get('failures') == [], 'Migration audit retains unresolved failures')

    regression_path = local(args.regression_summary)
    require(regression_path.is_relative_to(candidate_dir), 'Regression summary escapes the completed candidate evidence')
    regression = e.load(regression_path)
    regression_recovery = verify_regression_recovery(e, regression_path, regression, native)
    require(regression.get('schema') == 'logos-engine.recorded-public-regressions.v1'
            and regression.get('status') == 'passed' and regression.get('nativeSource') == native
            and regression.get('nativeSourceAfter') == native and regression.get('executionInputsUnchanged') is True
            and regression.get('executionInputs') == regression.get('executionInputsAfter')
            and regression.get('passed') == regression.get('total') == len(regression['results']) > 0,
            'Retained strict regressions are incomplete or failed; no silent qualification is allowed')
    case_manifest = e.referenced(regression['caseManifest'])
    declared_cases = case_manifest.get('cases', [])
    require(case_manifest.get('schema') == 'logos-engine.recorded-public-regression-cases.v1'
            and declared_cases and len({row['id'] for row in declared_cases}) == len(declared_cases)
            and [row['case'] for row in regression['results']] == [row['id'] for row in declared_cases]
            and regression.get('passiveOwnerRequirements') == case_manifest.get('passiveOwnerRequirements', []),
            'Strict regression population/order differs from the retained case manifest')
    e.file_map(regression['executionInputs'], 'regression execution inputs')
    comparison_count = 0
    for declared_case, row in zip(declared_cases, regression['results']):
        context = replay_case_context(regression, row)
        require(row.get('status') == 'passed' and row.get('passed') is True and row.get('exitCode') == 0
                and row.get('timedOut') is False and row.get('comparisonPassed') is True and row.get('failedChecks') == []
                and row.get('nativeSourceBeforeDigest') == row.get('nativeSourceAfterDigest') == digest
                and row.get('nativeSourceUnchanged') is True and row.get('immutableInputsUnchanged') is True,
                'A strict regression failed or its inputs changed')
        require(row.get('game') == declared_case['game'] and row.get('mode') == 'recorded-public-replay'
                and all(row[key]['path'] == declared_case[key]['path']
                        and row[key]['sha256'] == declared_case[key]['sha256'] for key in ('baseline', 'trace')),
                'A strict replay used another game, baseline or archived public trace')
        require(e.at(row['startedAt'], row['case'] + ' replay started')
                <= e.at(row['finishedAt'], row['case'] + ' replay finished')
                <= e.at(context['finishedAt'], row['case'] + ' comparison completion bound'),
                'Regression execution/comparison chronology differs')
        for key in ('baseline', 'trace', 'output', 'report', 'comparison', 'execution', 'passiveOwnerPresence'):
            e.checked(row[key])
        comparison = e.referenced(row['comparison'])
        require(comparison.get('schema') == 'logos-engine.scoped-public-regression-comparison.v1'
                and comparison.get('game') == declared_case['game'] and comparison.get('passed') is True
                and [item['name'] for item in comparison['checks']] == STRICT_REGRESSION_CHECK_NAMES
                and len(comparison['checks']) == row['comparisonChecks']
                and all(item.get('passed') is True for item in comparison['checks']), 'A strict comparison is incomplete')
        for comparison_key, row_key in (('before', 'baseline'), ('after', 'report'), ('trace', 'trace')):
            e.checked(comparison[comparison_key])
            require(all(comparison[comparison_key][key] == row[row_key][key] for key in ('path', 'sha256')),
                    'Strict comparison fingerprint differs from its actual replay')
        metadata = comparison['legacyComparatorMetadata']
        e.checked(metadata['implementation'])
        require(metadata.get('checkLabelsPreserved') is True and comparison['after'].get('sourceDigest') == digest,
                'Retained strict comparator labels or final source identity changed')
        presence = e.referenced(row['passiveOwnerPresence'])
        require(presence.get('passed') is True and presence.get('report') == row['report']
                and presence.get('caseManifest') == context['caseManifest'], 'Passive owner evidence does not bind its actual replay invocation')
        comparison_count += row['comparisonChecks']
    require(comparison_count == regression['comparisonChecksPassed'] == regression['comparisonChecksExpected'],
            'Strict regression check counts differ')
    integrity = e.load(candidate_dir / 'delivery-integrity.json')
    require(integrity.get('schema') == 'logos-engine.native-delivery-integrity.v1' and integrity.get('status') == 'passed'
            and integrity.get('nativeSourceDigest') == digest and integrity.get('tests') == counts
            and integrity.get('regressionSummary') == e.keep(regression_path)
            and type(integrity.get('originalSourceFilesUnchanged')) is int and integrity['originalSourceFilesUnchanged'] > 0
            and integrity['sourceArchiveVerification'].get('byteIdentical') is True
            and integrity.get('nativeAgentWorker') == checks['nativeAgentWorker'], 'Final delivery integrity is incomplete')
    e.at(integrity['recordedAt'], 'delivery integrity')
    required = {e.keep(path)['path'] for path in [candidate_dir / 'source-manifest.json', candidate_dir / 'source-archive.json',
                candidate_dir / 'source-archive-parts.json', regression_path, validation / 'delta-tests-run.json', validation / 'checks-run.json']}
    require(required <= {row['path'] for row in integrity['receipts']}, 'Delivery integrity omits required inputs')
    for record in [integrity['generator'], *integrity['verificationHelpers'], *integrity['receipts']]:
        e.checked(record)
    original = original_sources(e, integrity)
    component_oracle = verify_component_oracle(e, args.oracle_export_receipt, args.oracle_comparison,
                                              args.reader_qualification, tap, original)
    component_oracle['targetedExecution'] = verify_preview_execution(e, args.preview_verification_execution, component_oracle)
    cold_public = verify_cold_public(e, args.cold_public_execution, args.campaign_execution, native, original)
    regression_scope = verify_replay_scope(e, regression, case_manifest, cold_public, comparison_count)
    owner_presence = verify_presence(e, args.owner_presence, args.owner_presence_qualification, regression, native)
    browser_status = verify_browser(e, args.browser_receipt, native, checks['nativeAgentWorker'])
    case_clock = verify_clock(e, args.case_clock, cold_public, browser_status, regression_scope)

    static = e.load(perf / 'static-preflight.json')
    require(static.get('status') == 'static_inputs_checked' and static.get('measurementExecuted') is False
            and static.get('checkedCount') == len(static['checks']) > 0 and static.get('unsatisfied') == []
            and all(row.get('satisfied') is True for row in static['checks'])
            and static.get('declaration') == e.keep(perf / 'declaration.json')
            and static.get('candidateFreeze') == declaration['candidateManifest']
            and static.get('protocolCheck') == e.keep(perf / 'protocol-check.json'), 'Static preflight is incomplete')
    for key in ('generator', 'adaptedFrom', 'preparationTool'):
        e.checked(static[key])
    qualification = declaration.get('ownerCostQualification')
    require(isinstance(qualification, dict) and qualification.get('schema') == 'logos-engine.lot6a-owner-cost-qualification.v1',
            'Predeclared added-owner cost contract is missing')
    contract_path = local(qualification['contractPath'])
    contract = e.load(contract_path)
    require(contract_path.parent == perf and contract.get('schema') == 'logos-engine.lot6a-owner-cost-contract.v2'
            and contract.get('lot') == '6A' and contract.get('declaration') == e.keep(perf / 'declaration.json')
            and contract.get('tools') == qualification['tools'] == static.get('ownerCostTools')
            and static.get('ownerCostContract') == e.keep(contract_path)
            and contract['structuralExpectation'].get('ownerId') == OWNER,
            'Owner cost contract differs from its predeclared identity')
    e.keep(BASE / 'finalize-owner-cost-contract.py')
    for record in [*contract['tools'].values(), contract['ownerInventory'], *contract['sourceEvidence'], contract['structuralFixture']]:
        e.checked(record)
    structural = e.referenced(contract['structuralFixture'])
    attribution = e.referenced(structural['attribution'])
    inventory = e.referenced(contract['ownerInventory'])
    require(inventory.get('schema') == 'logos-engine.lot6a-owner-cost-source-inventory.v1'
            and inventory.get('programScope') == 'family-installed programs'
            and inventory.get('nativeDigests') == declaration['nativeDigests']
            and inventory.get('changes') == {'ownersAdded': [OWNER], 'ownersRemoved': [], 'programsAdded': [], 'programsRemoved': []}
            and [owner for owner in inventory['owners']['candidate'] if owner != OWNER] == inventory['owners']['baseline']
            and inventory['owners']['candidate'].count(OWNER) == 1
            and inventory['programs']['candidate'] == inventory['programs']['baseline'],
            'Source inventory does not preserve the existing common owner/program order')
    e.checked(inventory['generator'])
    e.checked(inventory['derivedFrom'])
    for role, manifest in (('baseline', baseline), ('candidate', native)):
        source = inventory['sourceInventory'][role]
        require(source['native'] == manifest and source.get('runtimeUninitializedBeforeAndAfter') is True,
                'Owner inventory is not tied to a cold, final source factory')
        for record in source['sourceInputs']:
            e.checked({**record, 'path': str((Path(source['checkout']) / record['path']).resolve())}, allow_external=True)
    require(static.get('ownerStructuralFixture') == contract['structuralFixture']
            and structural.get('schema') == 'logos-engine.lot6a-owner-cost-structural-fixture.v1'
            and attribution.get('schema') == 'logos-engine.lot6a-owner-cost-structural-attribution.v1'
            and structural.get('status') == attribution.get('status') == 'qualified_functional_structure'
            and structural.get('nativeDigests') == attribution.get('nativeDigests') == declaration['nativeDigests']
            and structural.get('cases') == declaration['cases'], 'Owner structural qualification differs from the frozen source pair')
    require(attribution.get('checkedCount') == len(attribution['checks']) > 0
            and all(row.get('passed') is True for row in attribution['checks']) and attribution.get('nodeAttributions')
            and attribution.get('formsSha256') == hashlib.sha256(json.dumps(structural['forms'], sort_keys=True,
                separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest(),
            'Owner structural forms or attribution checks differ')
    for record in [structural['cases'], structural['captureTool'], attribution['generator'], *attribution['inputs'],
                   *[item for role in ('baseline', 'candidate') for item in structural['captures'][role].values()]]:
        e.checked(record, allow_external=True)
    e.checked(attribution['derivedFrom'])
    for role, manifest in (('baseline', baseline), ('candidate', native)):
        capture = structural['captures'][role]
        receipt = e.referenced(capture['receipt'], allow_external=True)
        require(receipt.get('schema') == 'logos-engine.lot6a-owner-cost-functional-capture-receipt.v1'
                and receipt.get('status') == 'captured_functional_structure' and receipt.get('role') == role
                and receipt.get('ownerId') == OWNER and receipt.get('nativeDigest') == manifest['digest']
                and receipt.get('acquisitionMode') == 'selected_only_source_owner_no_passive_returns'
                and receipt.get('report') == capture['report'] and receipt.get('generator') == structural['captureTool']
                and receipt.get('generator') == receipt.get('generatorAfter')
                and receipt.get('inputsBefore') == receipt.get('inputsAfter')
                and receipt.get('nativeInventoryBefore') == receipt.get('nativeInventoryAfter') == manifest
                and all(receipt.get(key) is True for key in ('nativeSourceUnchanged', 'inputsUnchanged', 'generatorUnchanged'))
                and receipt.get('failures') == [], 'Functional capture changed or omitted source acquisitions')
        require(e.at(receipt['startedAt'], role + ' structure capture start')
                <= e.at(receipt['finishedAt'], role + ' structure capture finish') <= instant(attribution['recordedAt']),
                'Structural attribution precedes a functional capture')
        for record in receipt['inputsBefore']:
            e.checked(record, allow_external=True)
    coverage = attribution['sourceFactCoverage']
    require([(row['case'], row['form'], row['pointIndex']) for row in coverage]
            == [(row['case'], row['form'], row['pointIndex']) for row in attribution['points']],
            'Structural source-fact coverage omits a captured graph')
    for form in structural['forms']:
        rows = [row for row in coverage if (row['case'], row['form']) == (form['case'], form['form'])]
        require(rows and len(rows) == len(form['candidate']['requests']) + len(form['candidate']['inspection'])
                and [row['pointIndex'] for row in rows] == list(range(len(rows)))
                and rows[-1]['acquiredReturns'] == 0, 'Structural capture omits an acquired prefix')
        for row in rows:
            require(type(row['acquiredReturns']) is int and row['acquiredReturns'] == 0
                    and row['persistedSourceFacts'] == 0 and row['sourceCallIndices'] == []
                    and type(row['capturedNegativeProposals']) is int and row['capturedNegativeProposals'] >= 0,
                    'Preview must not acquire selected or passive returns in the fixed common-loop cost traces')
    require(e.at(declaration['finalizedAt'], 'declaration') <= e.at(contract['declaredAt'], 'owner cost contract')
            <= e.at(static['recordedAt'], 'static preflight'), 'Cost contract/preflight chronology differs')
    require(e.at(attribution['recordedAt'], 'structure attribution') <= e.at(structural['recordedAt'], 'structure fixture')
            <= instant(contract['declaredAt']), 'Functional structure was not fixed before the cost contract')
    require(e.at(inventory['recordedAt'], 'owner source inventory') <= instant(contract['declaredAt']),
            'Owner inventory was not fixed before the cost contract')

    isolation = verify_isolation(e, perf / 'coordinated-isolation.json', args.quiet_max_age_seconds)
    e.recheck()
    finalized = datetime.now(timezone.utc)
    require(all(timestamp <= finalized for timestamp, label in e.timestamps), 'Some retained evidence is dated after readiness')
    no_window(perf, e.baseline)
    output = perf / 'readiness.json'
    value = {'schema': 'logos-engine.native-cost-window-readiness.v1', 'status': 'ready',
             'finalizedAt': finalized.isoformat(), 'measurementAuthorized': True, 'pendingRequirements': [],
             'generator': e.keep(__file__), 'nativeVersion': policy['candidate']['nativeVersion'],
             'nativeSourceDigest': digest, 'baseline': policy['baseline'], 'candidate': policy['candidate'],
             'publishedPredecessors': published, 'formalTests': counts, 'formalTestFiles': len(tests['testFiles']),
             'testScope': scope, 'regressionChecks': comparison_count,
             'regressionSummary': e.keep(regression_path), 'regressionRecovery': regression_recovery,
             'componentOracle': component_oracle, 'coldPublicProof': cold_public,
             'ownerPresence': owner_presence, 'regressionScope': regression_scope,
             'browser': browser_status, 'caseClock': case_clock,
             'newGameSuccessClaimed': True,
             'ownerCostContract': e.keep(contract_path), 'historicalStrictIdentityNotAnticipated': True,
             'inputs': list(e.inputs.values()), 'watchedExternalInputs': list(e.external.values()),
             'isolation': isolation, 'quietMaximumAgeSeconds': args.quiet_max_age_seconds,
             'qualification': 'The actual published Site95 source is reference A. The reconstructed candidate, '
                 'explicitly declared effective test scope, five checks, ten historical strict replays and one fresh '
                 'KATA self-consistency replay, exact source archive, original component oracle, cold original public '
                 'replay, independent complete owner-presence checks and observed browser controls are bound before '
                 'measurement. The exact validated and preview dist inventories remain equal. KATA cumulative time '
                 'includes the retained prior charge without reset. Native checkpoint restoration is an extension. '
                 'Current public success does not establish complete original caller parity or causal improvement. '
                 'Fresh quiet observations and ended tracked execution are required; this receipt executes no '
                 'measurement and does not assert a future cost verdict or publication.'}
    with output.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': 'ready', 'receipt': fingerprint(output), 'formalTestFiles': len(tests['testFiles']),
                      'componentOracle': component_oracle['checks'], 'regressionChecks': comparison_count}))


if __name__ == '__main__':
    main()
