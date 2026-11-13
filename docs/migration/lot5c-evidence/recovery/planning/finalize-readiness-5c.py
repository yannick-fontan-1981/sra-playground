#!/usr/bin/env python3
"""Finalize actual final-a33 Lot5C cost readiness from completed immutable evidence.

This source-only proof reader starts no process, game, test, replay, browser,
build or measurement. It never decodes raw game journals or owner-graph archives.
It verifies the retained functional receipts, exact file identities and a fresh
supplied cooperative isolation receipt. The outer reviewed controller must obtain
nonblocking EX and recheck the exact ACKs at actual window opening; this reader
neither acquires nor claims to have observed that lock. Output is exclusive.

The historical 10B finalizer and frozen common delivery verifier supply the
validation patterns. This new 5C adapter is outside the 867-member source archive;
its own fingerprint and the new external controller are bound in readiness.
"""
from __future__ import annotations

import argparse
import ast
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys
import traceback
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / 'docs/migration/lot5c-evidence'
FINAL = BASE / 'recovery/integrated-final-01'
PERF = BASE / 'recovery/performance-integrated-02'
OLD = BASE / 'recovery/performance-integrated-01'
COMMON = BASE / 'recovery/common/common-final-01'
CONTROLLER = BASE / 'recovery/planning/run-coordinated-cost-5c.py'
VERIFIER = ROOT / 'scripts/verify-native-delivery.py'
BASELINE = Path('/workspace/sites/sra-lot5c-baseline-site102-1019d2e/.sites-checkout')
REQUEST = 'lot5c-cost-a33a5f88-final-01'
LANES = {'lot6b', 'lot8a', 'lot10c'}
CANDIDATE_DIGEST = 'a33a5f88f3fe0034930b2056239889bed6fab662424fc84a141a5f9a28db9e57'
BASELINE_DIGEST = '74143a7a8f7e1d434a9284b34665f30f9c2b0d8d68191d9405b3af7d39815d12'
SOURCE_COMMIT = '805b30297dc1b715dbfd9f1197a9a8ba7b361b90'
BASELINE_COMMIT = '1019d2eb929d7dc201a5c1f6edce5aa1c5dfa464'
EXCLUSIONS = ['tests/v6-ranked-workshop-reference.test.ts', 'tests/v6-ranked-workshop-kernel.test.ts',
              'tests/v6-symbol-transactions-kernel.test.ts', 'tests/v6-framed-transfer-reference.test.ts']
SCENARIOS = ['positive', 'refutation', 'ambiguity', 'boundary', 'foreign-parent',
             'passive-acquisition-bound', 'selected-acquisition-bound', 'level-clock-acquisition-bound']
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')
GATES = ('typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build')
TEST_PREFIX = ['node', '--test', '--test-concurrency=1', '--test-reporter=tap']
GATE_COMMANDS = {'typecheck': ['npm', 'run', 'typecheck'], 'entry-audit': ['node', 'scripts/audit-v6-entry-points.ts'], 'migration-audit': ['python', 'scripts/audit-v6-migration.py'], 'diff-check': ['git', 'diff', '--check'], 'build': ['node', '/home/agent/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/scripts/build-site.mjs']}
OWNER_RULE = {'ownerId': 'public_observed_binding', 'programId': 'v6.observed_binding.choose',
    'installedNodeIds': ['family_state:public_observed_binding', 'family_activation:public_observed_binding',
                         'program:v6.observed_binding.choose'],
    'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
    'mode': 'predeclared_functional_fixture', 'qualification': 'functional_structure_frozen_before_measurement'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def instant(value):
    require(isinstance(value, str), 'Missing timestamp')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timestamp must include timezone')
    return result


def unique_object(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, 'Duplicate JSON key: ' + key)
        out[key] = value
    return out


def decode(raw):
    def invalid(value):
        raise ValueError('Non-finite JSON constant: ' + value)
    return json.loads(raw, object_pairs_hook=unique_object, parse_constant=invalid)


def write_exclusive(path, value):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())


class Evidence:
    def __init__(self, baseline, deadline):
        self.baseline, self.deadline = baseline, deadline
        self.records = {}
        self.latest = datetime.min.replace(tzinfo=timezone.utc)

    def path(self, value):
        value = Path(value)
        path = (ROOT / value).resolve(strict=True) if not value.is_absolute() else value.resolve(strict=True)
        require(path.is_relative_to(ROOT) or path.is_relative_to(self.baseline), 'Unconfined proof input: ' + str(path))
        require('project_sources' not in path.parts, 'Forbidden project_sources traversal')
        require(path.is_file(), 'Proof input is not a regular file: ' + str(path))
        return path

    def remember(self, path, raw=None):
        path = self.path(path)
        h, size = hashlib.sha256(), 0
        if raw is None:
            with path.open('rb') as incoming:
                for chunk in iter(lambda: incoming.read(1024 * 1024), b''):
                    h.update(chunk); size += len(chunk)
        else:
            h.update(raw); size = len(raw)
        name = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)
        record = {'path': name, 'bytes': size, 'sha256': h.hexdigest()}
        require(name not in self.records or self.records[name] == record, 'Input changed while finalizing: ' + name)
        self.records[name] = record
        return record

    def keep(self, value):
        return self.remember(self.path(value))

    def read(self, value, maximum=8 * 1024 * 1024):
        path = self.path(value)
        require(path.suffix == '.json' and path.stat().st_size <= maximum, 'Only bounded JSON receipts may be decoded: ' + str(path))
        raw = path.read_bytes()
        require(len(raw) <= maximum, 'Receipt exceeded its bound while reading')
        self.remember(path, raw)
        result = decode(raw)
        require(isinstance(result, (dict, list)), 'Receipt must be an object or list')
        return result

    def verify(self, record):
        require(isinstance(record, dict) and isinstance(record.get('path'), str)
                and re.fullmatch(r'[0-9a-f]{64}', str(record.get('sha256', ''))), 'Malformed input fingerprint')
        actual = self.keep(record['path'])
        require(actual['sha256'] == record['sha256'] and ('bytes' not in record or actual['bytes'] == record['bytes']),
                'Input fingerprint differs: ' + record['path'])
        return actual

    def fingerprints(self, value):
        if isinstance(value, dict):
            if isinstance(value.get('path'), str) and 'sha256' in value:
                self.verify(value)
            else:
                for child in value.values():
                    self.fingerprints(child)
        elif isinstance(value, list):
            for child in value:
                self.fingerprints(child)

    def file_map(self, values, base=ROOT):
        require(isinstance(values, dict) and values, 'Empty file inventory')
        for name, digest in values.items():
            path = base / name
            require(not Path(name).is_absolute() and '..' not in Path(name).parts, 'Unsafe inventory member')
            actual = self.keep(path)
            expected = digest['sha256'] if isinstance(digest, dict) else digest
            require(actual['sha256'] == expected, 'Inventory input differs: ' + name)
            if isinstance(digest, dict):
                require(actual['bytes'] == digest['bytes'], 'Inventory byte count differs: ' + name)

    def completed(self, value, start='startedAt', end='finishedAt'):
        first, last = instant(value[start]), instant(value[end])
        require(first <= last <= self.deadline, 'Unfinished or future proof interval')
        self.latest = max(self.latest, last)
        return first, last

    def recorded(self, value, field='recordedAt'):
        stamp = instant(value[field])
        require(stamp <= self.deadline, 'Future proof receipt')
        self.latest = max(self.latest, stamp)
        return stamp

    def small_log(self, record, limit=4 * 1024 * 1024):
        actual = self.verify(record)
        path = self.path(actual['path'])
        if path.suffix == '.gz':
            with gzip.open(path, 'rb') as stream:
                data = stream.read(limit + 1)
        else:
            require(actual['bytes'] <= limit, 'Text log exceeds allowed bound')
            data = path.read_bytes()
        require(len(data) <= limit, 'Expanded text log exceeds allowed bound')
        return data.decode('utf-8')

    def snapshot(self, external=False):
        return [self.records[name] for name in sorted(self.records) if Path(name).is_absolute() == external]

    def recheck(self):
        for record in list(self.records.values()):
            self.verify(record)


def unmeasured(perf, baseline):
    forbidden = ('readiness.json', 'window.json', 'combined-comparison.json', 'consolidation-review.json',
                 'global-budget-decision.json', 'owner-growth-comparison.json', 'owner-growth-review.json',
                 'aggregation-failure.json', 'aggregation-failure.log', 'results.md', 'results-render.json')
    for directory in (perf, baseline / perf.relative_to(ROOT)):
        require(not any((directory / name).exists() or (directory / name).is_symlink() for name in forbidden)
                and not any(directory.glob('cohort*')), 'Official outputs or cohort directories already exist: ' + str(directory))


def load_verifier(e, archive):
    record = e.keep(VERIFIER)
    require(archive['files'].get(record['path']) == record['sha256'], 'Delivery verifier is not the frozen helper')
    spec = importlib.util.spec_from_file_location('lot5c_retained_delivery_verifier', VERIFIER)
    require(spec is not None and spec.loader is not None, 'Cannot load frozen verification-only helper')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    require(module.ROOT == ROOT, 'Verifier belongs to another checkout')
    return module


def native_inventory(e, verifier, checkout):
    files = dict(sorted((path.relative_to(checkout).as_posix(), e.keep(path)['sha256'])
        for folder in ('src/logos-engine', 'src/runtime')
        for path in verifier.walk_files(checkout / folder, checkout) if path.suffix in {'.ts', '.json', '.drm'}))
    return {'fileCount': len(files), 'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(),
            'files': files}


def native_version(e, checkout):
    path = checkout / 'src/logos-engine/v6-native-runtime.ts'
    record = e.keep(path)
    require(record['bytes'] < 2 * 1024 * 1024, 'Native implementation label input exceeds bound')
    raw = path.read_bytes(); e.remember(path, raw)
    values = re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]", raw.decode())
    require(len(values) == 1, 'Cannot identify native implementation version')
    return values[0]


def formal(e, verifier, final, source, validation_contract, archive):
    tests = e.read(final / 'validation/delta-tests-run.json')
    gates = e.read(final / 'validation/checks-run.json')
    require(tests['generator'] == gates['generator'] == e.keep(ROOT / 'scripts/verify-native-delta.py'), 'Wrong formal proof generator')
    source_count, counts = verifier.verify_tests(tests, source)
    build_count, worker = verifier.verify_build(gates, source)
    require(counts == {'tests': 5339, 'pass': 5339, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}, 'Final test population differs')
    e.file_map(tests['sourceAndTestInputs']); e.file_map(gates['buildInputs']); e.verify(worker)
    scope = e.read(validation_contract['testScope']['path']); e.verify(validation_contract['testScope'])
    reconciliation = e.read(BASE / 'recovery/integration-published-10b/final-scope-reconciliation.json')
    selected = scope['testFiles']
    require(selected == validation_contract['testFiles'] == reconciliation['testScope']['testFiles'] == tests['testFiles']
            and len(selected) == len(set(selected)) == 138, 'The four exact final test lists differ')
    require(scope['excludedWholeModules'] == validation_contract['wholeModuleExclusions'] == EXCLUSIONS
            and not any(name in selected for name in EXCLUSIONS)
            and 'tests/v6-object-binding-common.test.ts' in selected, 'Binding scope or closed-module exclusions differ')
    require(all(name in archive['files'] for name in selected), 'A selected test was not frozen')
    require(tests['checks'][0]['command'] == [*TEST_PREFIX, *selected], 'Actual test invocation differs from the retained final invocation')
    require([row['name'] for row in gates['checks']] == list(GATES), 'Five required gates are not complete')
    for receipt in (tests, gates):
        for row in receipt['checks']:
            e.completed(row); e.verify(row['output'])
    tap = e.small_log(tests['checks'][0]['output'])
    found = {key: re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M) for key in COUNT_KEYS}
    require(all(len(value) == 1 for value in found.values())
            and counts == {key: int(value[0]) for key, value in found.items()}, 'Actual TAP summary differs from counts')
    audits = {}
    for row in gates['checks']:
        require(row['command'] == GATE_COMMANDS[row['name']], 'Project gate command changed: ' + row['name'])
        if row['name'] in ('entry-audit', 'migration-audit'):
            audits[row['name']] = decode(e.small_log(row['output'], 128 * 1024))
    require(audits['entry-audit']['connected'] == 65 and audits['entry-audit']['declared'] == 76
            and audits['entry-audit']['fullV6Parity'] is False, 'Entry-audit scope changed')
    require(audits['migration-audit']['failures'] == [] and audits['migration-audit']['complete'] is False,
            'Migration semantic failures exist or completeness was reclassified')
    return tests, gates, {'formalTests': counts, 'formalTestFiles': 138, 'formalTestFileNames': selected,
        'projectGates': [{'name': x['name'], 'exitCode': x['exitCode'],
                         'semanticPassed': True if x['name'] in audits else None} for x in gates['checks']],
        'nativeAgentWorker': worker, 'matchedFileInventories': {'native': 318, 'archive': 867,
            'sourceAndTests': source_count, 'buildInputs': build_count}, 'auditScope': audits}


def regressions(e, verifier, directory, launch_path, source, cases_path):
    summary_path = directory / 'regressions/regression-summary.json'
    summary = e.read(summary_path)
    verified, input_count = verifier.verify_regressions(summary_path, source, True)
    require(verified == summary, 'Regression summary changed during validation')
    cases = e.read(cases_path)
    require(cases['schema'] == 'logos-engine.recorded-public-regression-cases.v1'
            and summary['caseManifest'] == e.keep(cases_path) and cases['passiveOwnerRequirements'] == []
            and summary['passiveOwnerRequirements'] == [], 'Unexpected replay scope or Binding coverage claim')
    require(len(cases['cases']) == summary['passed'] == summary['total'] == 11
            and cases['expectedChecksPerCase'] == 17 and cases['expectedComparisonChecks'] == 187,
            'Eleven declared replay cases are required')
    comparator = e.keep(ROOT / 'scripts/compare-v54-regressions.py')
    require(e.keep(e.baseline / comparator['path'])['sha256'] == comparator['sha256'], 'Historical comparator differs in baseline')
    tree = ast.parse((ROOT / comparator['path']).read_text())
    functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'compare']
    require(len(functions) == 1, 'Missing literal comparator function')
    calls = [node.value for node in functions[0].body if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
             and isinstance(node.value.func, ast.Name) and node.value.func.id == 'same']
    require(all(call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str) for call in calls),
            'Nonliteral comparator check labels')
    labels = [call.args[0].value for call in calls]
    require(len(labels) == len(set(labels)) == 17 and cases['strictComparisonCheckNames'] == labels, 'Historical check labels changed')
    require(summary['executionInputs'].get(comparator['path']) == comparator['sha256']
            and summary['maximumConcurrentReplays'] == 1 and summary['nodeOldSpaceMiB'] == 1536, 'Replay execution contract changed')
    e.file_map(summary['executionInputs']); e.verify(summary['preflight'])
    preflight = e.read(summary['preflight']['path'])
    require(preflight['prevalidationProcessExitedBeforeAnyReplay'] is True
            and preflight['nativeSourceDigest'] == source['digest'], 'Historical preparation did not finish before replay')
    launch = e.read(launch_path)
    require(launch['schema'] == 'logos-engine.lot5c.recorded-regression-launch-observation.v1'
            and launch['status'] == 'passed' and type(launch['exitCode']) is int and launch['exitCode'] == 0,
            'The actually observed replay driver is not terminal and passed')
    started, ended = e.completed(launch, end='terminalObservedAt')
    expected_command = ['python', '-B', 'scripts/run-released-public-regressions-streamlog.py',
        cases_path.relative_to(ROOT).as_posix(), directory.relative_to(ROOT).as_posix(), '--source-manifest',
        (FINAL / 'source-manifest.json').relative_to(ROOT).as_posix(), '--node-old-space-mib', '1536', '--timeout-seconds', '2400']
    require(launch['command'] == expected_command and launch['caseManifest'] == e.keep(cases_path)
            and launch['sourceManifest'] == e.keep(FINAL / 'source-manifest.json')
            and launch['regressionSummary'] == e.keep(summary_path) and launch['performanceLock'] == 'shared_nonblocking',
            'Observed driver launch is not bound to this exact execution')
    require([(row['case'], row['game']) for row in summary['results']] == [(case['id'], case['game']) for case in cases['cases']],
            'Replay result membership/order differs')
    previous = started
    for row, case in zip(summary['results'], cases['cases']):
        require(row['status'] == 'passed' and row['passed'] is True and type(row['exitCode']) is int and row['exitCode'] == 0
                and row['timedOut'] is False and row['comparisonPassed'] is True and row['failedChecks'] == []
                and row['nodeExitObserved'] is True and row['nodeExitedBeforeComparison'] is True
                and row['nativeSourceUnchanged'] is True and row['immutableInputsUnchanged'] is True
                and row['nativeSourceBeforeDigest'] == row['nativeSourceAfterDigest'] == source['digest'], 'Replay failed or remained active')
        first, last = e.completed(row)
        processed = instant(row['postprocessingFinishedAt'])
        require(previous <= first <= last <= processed <= ended, 'Replay sequence/postprocessing is incomplete or overlapping')
        previous = processed
        require(row['timeoutSeconds'] == 2400 and row['nodeOldSpaceMiB'] == 1536
                and row['executionInputsBefore'] == summary['executionInputs'], 'Replay budget or source inputs differ')
        e.fingerprints(row)
        require(e.read(row['execution']['path']) == {key: value for key, value in row.items() if key != 'execution'},
                'Replay summary differs from its actual execution receipt')
        for role in ('baseline', 'trace'):
            require({key: row[role][key] for key in case[role]} == case[role], 'Historical replay pin changed')
        comparison = e.read(row['comparison']['path'])
        require(comparison['schema'] == 'logos-engine.scoped-public-regression-comparison.v1'
                and comparison['passed'] is True and comparison['game'] == case['game']
                and comparison['legacyComparatorMetadata']['implementation'] == comparator
                and comparison['legacyComparatorMetadata']['checkLabelsPreserved'] is True
                and [x['name'] for x in comparison['checks']] == labels and row['comparisonChecks'] == 17
                and all(x['passed'] is True and x['baselineProjectionSha256'] == x['currentProjectionSha256']
                        and re.fullmatch(r'[0-9a-f]{64}', x['baselineProjectionSha256']) for x in comparison['checks']),
                'Replay comparator checks are incomplete or changed')
        for key, target in (('before', row['baseline']), ('after', row['report']), ('trace', row['trace'])):
            require({name: comparison[key][name] for name in ('path', 'sha256', 'bytes')} == target, 'Comparison binds another replay')
        require(comparison['after']['sourceDigest'] == source['digest'], 'Comparison names another candidate')
    require(summary['comparisonChecksPassed'] == summary['comparisonChecksExpected'] == 187, 'Not all187 actual comparisons passed')
    require(summary['passiveOwnerPrefixesChecked'] == summary['passiveOwnerPrefixesPassed'] == summary['passiveOwnerTransitionsRetained'] == 0,
            'Unexpected replay-wide Binding presence claim')
    return {'regressionCases': 11, 'regressionChecks': 187, 'regressionComparator': comparator,
            'regressionSummary': e.keep(summary_path), 'regressionLaunchObservation': e.keep(launch_path),
            'regressionExecutionInputs': input_count, 'regressionQualification': summary['qualification'],
            'recordedReplayBindingQualification': cases['passiveOwnerRequirementQualification']}


def common(e, source, tests_record):
    summary = e.read(COMMON / 'summary.json')
    require(summary['schema'] == 'logos-engine.lot5c-final-common-proof-summary.v1'
            and summary['status'] == 'passed_within_declared_final_common_scope'
            and summary['nativeVersion'] == '0.63.0' and summary['nativeFiles'] == 318
            and summary['nativeDigest'] == source['digest'] and summary['frozenSourceCommit'] == SOURCE_COMMIT
            and summary['nativeManifest'] == e.keep(FINAL / 'source-manifest.json')
            and summary['nativeSuiteProof'] == tests_record and summary['nativeCommonTests'] == 7
            and summary['declaredScenarios'] == SCENARIOS and summary['all867FrozenExecutionInputsUnchanged'] is True,
            'Fresh final common proof is absent or misbound')
    e.recorded(summary)
    modes = SCENARIOS[:4]
    require([x['mode'] for x in summary['originalComparisonCases']] == modes
            and [x['mode'] for x in summary['originalExports']] == modes, 'Four declared original common cases are required')
    total, counts = 0, {key: 0 for key in ('operations', 'actualReturns', 'selectedReturns', 'passiveReturns',
                                         'sourceStateRetentions', 'sourceStateRetentionChecks', 'sourceMemoryPuts', 'nativeMemoryPuts')}
    for item, export_item in zip(summary['originalComparisonCases'], summary['originalExports']):
        e.verify(item['receipt']); value = e.read(item['receipt']['path'])
        require(value['schema'] == 'logos-engine.lot5c-common-original-comparison.v1' and value['status'] == 'passed'
                and value['mode'] == item['mode'] and value['coldOriginal'] is True
                and value['nativeResultsUsedAsOracleInputs'] is False and value['inputsUnchanged'] is True,
                'Original common comparison is not a valid independent passed proof')
        checks = value['checks']
        require(checks['total'] == checks['passed'] == len(checks['items']) == item['checksPassed'] == item['checksTotal']
                and checks['failed'] == 0 and all(x['passed'] is True for x in checks['items']), 'Incomplete original common comparison')
        total += checks['total']; e.recorded(value)
        for record in value['inputs']:
            e.verify(record)
        for key in counts:
            require(value[key] == item[key], 'Common summary differs: ' + key)
            counts[key] += value[key]
        e.verify(export_item['receipt']); exported = e.read(export_item['receipt']['path'])
        require(exported['schema'] == 'logos-engine.independent-python-oracle-export.v1' and exported['status'] == 'passed'
                and exported['sourceFilesVerifiedBefore'] == exported['sourceFilesVerifiedAfter'] == 1786
                and exported['sourceInventoryUnchanged'] is True
                and exported['sourceInventorySha256Before'] == exported['sourceInventorySha256After'] == export_item['inventoryBefore'] == export_item['inventoryAfter']
                and exported['counts']['sourceExceptions'] == 0 and exported['counts']['coldChains'] == 1,
                'Original export is incomplete or source inventory changed')
        e.completed(exported, end='recordedAt'); e.fingerprints(exported)
    require(total == summary['checksPassed'] == summary['checksTotal'] == 6818
            and all(summary[key] == count for key, count in counts.items())
            and summary['sourceExceptions'] == 0 and summary['commandsPassed'] == len(summary['executionReceipts']) == 8,
            'Final common totals differ')
    for record in summary['executionReceipts']:
        e.verify(record); execution = e.read(record['path'])
        require(execution['schema'] == 'logos-engine.lot5c.command-execution.v1' and execution['status'] == 'passed'
                and type(execution['exitCode']) is int and execution['exitCode'] == 0 and execution['timedOut'] is False,
                'An original common command is not terminal and passed')
        e.completed(execution); e.fingerprints(execution)
    return {'receipt': e.keep(COMMON / 'summary.json'), 'nativeCommonTests': 7, 'declaredScenarios': SCENARIOS,
            'originalComparisonCases': summary['originalComparisonCases'], 'checksPassed': total, 'checksTotal': total,
            **counts, 'sourceExceptions': 0, 'qualification': summary['qualification']}


def browser(e, source, gates_record):
    path = FINAL / 'browser-qa/summary.json'; qa = e.read(path)
    require(qa['schema'] == 'logos-engine.lot5c-produced-build-browser-qa.v1'
            and qa['status'] == 'passed_within_static_ui_smoke_scope' and qa['nativeVersion'] == '0.63.0'
            and qa['nativeDigest'] == source['digest'] and qa['agentActions'] == qa['agentLevelsSolved'] == 0
            and qa['newGameCampaign'] is False and qa['browserTabClosed'] is True
            and qa['previewStop']['exitCode'] == 0 and qa['previewStatusAfterStop'].strip() == 'Sites preview stopped'
            and qa['applicationConsoleErrorsObserved'] == [], 'Produced-build UI smoke was not closed within its declared scope')
    require(qa['declaredBrowserQaWallBudgetSeconds'] == 180 and qa['declaredBrowserQaWallBudgetExceeded'] is True
            and qa['stagingToClosureWallSeconds'] > 180
            and math.isclose(qa['stagingToClosureWallSeconds'] - 180, qa['declaredBrowserQaWallBudgetOverrunSeconds'], rel_tol=0, abs_tol=1e-9)
            and qa['timingQualification'], 'Actual UI-only wall overrun was omitted or changed')
    e.recorded(qa); e.fingerprints(qa)
    staging = e.read(qa['staging']['path'])
    require(staging['schema'] == 'logos-engine.lot5c-produced-build-browser-qa-staging.v1'
            and staging['nativeDigest'] == source['digest'] and staging['candidateNativeVersion'] == '0.63.0'
            and staging['staticDistributionIdentical'] is True and staging['fileCount'] == len(staging['files']) == 74
            and staging['sourceDistribution'] == str(ROOT / 'dist') and staging['buildCheckReceipt'] == gates_record['path'],
            'QA staging does not bind the actual production build')
    e.file_map(staging['files'], ROOT / 'dist')
    require({p.relative_to(ROOT / 'dist').as_posix() for p in (ROOT / 'dist').rglob('*') if p.is_file()} == set(staging['files']),
            'Production distribution membership changed')
    return {'receipt': e.keep(path), **qa}


def preparation(e, perf, declaration, source, baseline_source):
    prep = e.read(perf / 'preparation.json'); static = e.read(perf / 'static-preflight.json')
    require(prep['schema'] == 'logos-engine.native-cost-protocol-preparation.v1'
            and prep['status'] == 'source_freezes_verified_not_functional_readiness' and prep['measurementExecuted'] is False
            and prep['baselineCheckout'] == str(e.baseline) and prep['candidateCheckout'] == str(ROOT)
            and prep['baseline'] == declaration['baseline'] and prep['candidate'] == declaration['candidate'], 'Invalid actual02 preparation')
    require(static['schema'] == 'logos-engine.native-cost-static-preflight.v1' and static['status'] == 'static_inputs_checked'
            and static['checkedCount'] == len(static['checks']) == 76 and all(x['satisfied'] is True for x in static['checks'])
            and static['unsatisfied'] == [] and static['measurementExecuted'] is False
            and static['declaration'] == e.keep(perf / 'declaration.json'), 'Actual02 static preflight did not pass all76 checks')
    e.recorded(static); e.fingerprints(prep); e.fingerprints(static)
    policy = e.read(perf / 'global-budget-policy.json')
    require(policy['schema'] == 'logos-engine.native-global-cost-policy.v1' and policy['caseIds'] == ['STCK', 'SMLP']
            and policy['relativeIncreaseLimit'] == 0.1 and policy['comparison'] == 'strictly_less_than'
            and policy['allCasesMustPass'] is True and policy['crossCaseCompensation'] is False
            and policy['phaseOverrunsMayBeAccepted'] is True and policy['phasesAndP95RemainVisible'] is True
            and policy['excludedMeasuredSessions'] == policy['excludedOutliers'] == 0
            and policy['measuredSessions'] == 32 and policy['measuredActions'] == 400
            and policy['excludedWarmupSessions'] == 8 and policy['excludedWarmupActions'] == 24
            and policy['plannedOrder'] == ['A1', 'B1', 'B2', 'A2']
            and policy['baseline'] == declaration['baseline'] and policy['candidate'] == declaration['candidate'], 'Global acceptance contract changed')
    owner = e.read(perf / 'owner-growth-contract.json'); owner_record = e.keep(perf / 'owner-growth-contract.json')
    require(owner['schema'] == 'logos-engine.lot5c-owner-cost-contract.v2' and owner['lot'] == '5C'
            and owner['declaration'] == e.keep(perf / 'declaration.json') and owner['structuralExpectation'] == OWNER_RULE
            and owner['performanceDirectory'] == perf.relative_to(ROOT).as_posix()
            and owner['tools'] == declaration['ownerCostQualification']['tools']
            and static['ownerCostContract'] == owner_record and static['ownerCostTools'] == owner['tools'], 'Owner contract differs')
    domain = owner['acquisitionDomain']
    require(domain['acquisitionMode'] == 'passive_nonadmitted_source_binding' and domain['contextAdmission'] is False
            and domain['core'] is None and domain['methods'] == [] and domain['attentionMutation'] is False
            and domain['nativeAcquisitionIncomplete'] is False and domain['recordOutsideOfficialBoundary'] is None
            and domain['recordAtOfficialBoundary'] == {'status': 'scope_changed_preserving_conditional_methods',
                                                       'evidence': ['before.observation_ref', 'after.observation_ref']}, 'Binding source domain widened')
    e.fingerprints(owner)
    require(instant(policy['declaredAt']) <= instant(declaration['recordedAt']) <= instant(declaration['finalizedAt'])
            <= instant(owner['declaredAt']) <= instant(static['recordedAt']), 'Preparation chronology is invalid')
    independent = e.read(perf / 'independent-readiness-input-review.json')
    require(independent['schema'] == 'logos-engine.lot5c-independent-readiness-input-review.v1'
            and independent['status'] == 'passed_inputs_only_readiness_not_asserted'
            and independent['checkedCount'] == len(independent['checks']) == 84
            and all(x['passed'] is True for x in independent['checks']) and independent['findings'] == []
            and independent['activeDirectory'] == perf.relative_to(ROOT).as_posix()
            and independent['supersededPriorDirectory'] == OLD.relative_to(ROOT).as_posix(), 'Independent84-check preparation review failed')
    for record in independent['inputs']:
        e.verify(record)
    e.recorded(independent)
    supersession = e.read(perf / 'superseded-before-measurement.json')
    require(supersession['schema'] == 'logos-engine.lot5c-cost-preparation-supersession.v1'
            and supersession['status'] == 'new_attempt_supersedes_failed_static_preflight_before_measurement'
            and supersession['supersessionAppliesToPriorDirectoryOnly'] is True
            and supersession['supersededDirectory'] == OLD.relative_to(ROOT).as_posix()
            and supersession['activeDirectory'] == perf.relative_to(ROOT).as_posix()
            and all(supersession[key] is False for key in ('nativeSourcesChanged', 'thresholdChanged', 'domainChanged', 'measuredWindowStarted', 'readinessAsserted')),
            'Attempt02 supersession was misapplied or widened')
    e.fingerprints(supersession)
    old_inventory = e.read(perf / 'prior-attempt-inventory.json')
    require(old_inventory['directory'] == OLD.relative_to(ROOT).as_posix() and old_inventory['fileCount'] == len(old_inventory['files']) == 39,
            'Prior attempt inventory differs')
    e.file_map(old_inventory['files'], OLD)
    require({path.relative_to(OLD).as_posix() for path in OLD.rglob('*') if path.is_file()} == set(old_inventory['files']),
            'Prior attempt39-file membership changed')
    old_static = e.read(OLD / 'static-preflight.json')
    require(old_static['status'] == 'static_input_review_failed'
            and e.keep(OLD / 'static-preflight.json') == supersession['priorFailedPreflight'], 'Prior static failure was erased')
    equivalence = e.read(perf / 'structural-repeat-equivalence.json')
    require(equivalence['status'] == 'equivalent_fresh_qualification' and equivalence['checkedCount'] == len(equivalence['checks']) == 29
            and all(x['passed'] is True for x in equivalence['checks']) and equivalence['freshQualificationChecks'] == 64
            and equivalence['attributedDeltas'] == 40 and equivalence['points'] == 58
            and equivalence['measurementExecuted'] is False and equivalence['readinessAsserted'] is False,
            'Fresh02 structural qualification is not equivalent')
    e.fingerprints(equivalence)
    for item in static['dependencyLinks']:
        path = Path(item['path']); candidate = Path(item['candidatePath'])
        require(path.is_symlink() and path.resolve(strict=True) == candidate.resolve(strict=True)
                and str(path.resolve()) == item['target'] and item['sameTargetAsCandidate'] is True, 'Repaired dependency target changed')
    for name in ('package.json', 'package-lock.json', 'scripts/python-runtime-assets.json'):
        require(e.keep(ROOT / name)['sha256'] == e.keep(e.baseline / name)['sha256'], 'Baseline dependency manifest differs')
    require(static['candidateFreeze'] == e.keep(FINAL / 'source-manifest.json')
            and source['digest'] == declaration['nativeDigests']['candidate']
            and baseline_source['digest'] == declaration['nativeDigests']['baseline'], 'Preparation names different frozen sources')
    return owner_record, {'staticPreflight': e.keep(perf / 'static-preflight.json'), 'staticChecks': 76,
        'independentPreparationReview': e.keep(perf / 'independent-readiness-input-review.json'), 'independentChecks': 84,
        'priorAttemptPreservation': {'inventory': e.keep(perf / 'prior-attempt-inventory.json'), 'fileCount': 39,
                                    'allListedFilesByteIdentical': True, 'failedPreflightRetained': supersession['priorFailedPreflight']},
        'supersession': e.keep(perf / 'superseded-before-measurement.json'), 'structuralEquivalence': e.keep(perf / 'structural-repeat-equivalence.json')}


def quiet(e, path, perf, declaration):
    latest = e.latest
    value = e.read(path)
    require(value['schema'] == 'logos-engine.coordinated-cost-isolation.v1'
            and value['status'] == 'acknowledged_quiet_before_window' and value['requestId'] == REQUEST
            and value['otherLaneAcknowledged'] is True and value['ownTrackedComputeEnded'] is True
            and value['previewStopped'] is True and value['costNodeOptionsOverride'] is None
            and value['performanceDirectory'] == perf.relative_to(ROOT).as_posix()
            and value['nativeDigests'] == declaration['nativeDigests'] and value['declaration'] == e.keep(perf / 'declaration.json')
            and isinstance(value['qualification'], str) and value['qualification'].strip(), 'Fresh bound cooperative isolation is required')
    recorded = instant(value['recordedAt'])
    require(latest <= recorded <= e.deadline, 'Isolation predates completed evidence or is future-dated')
    require(len(value['knownLanes']) == 3 and {row['lane'] for row in value['knownLanes']} == LANES,
            'Fresh6B,8A,10C ACKs are all required')
    require(isinstance(value['evidence'], list) and value['evidence'], 'Missing retained isolation evidence')
    for record in value['evidence']:
        e.verify(record)
    for row in value['knownLanes']:
        require(row['requestId'] == REQUEST and row['activeCommand'] is None and row['evidence'] in value['evidence']
                and latest <= instant(row['acknowledgedAt']) <= recorded
                and latest <= instant(row['updatedAt']) <= recorded, 'Stale, wrong-window or active lane ACK')
        payload = e.read(row['evidence']['path'])
        require(payload.get('quiet_acknowledged') is True and payload.get('quiet_request_id') == REQUEST
                and payload.get('active_command') is None and payload.get('heavy_execution_active') is False
                and payload.get('all_own_subagents_idle') is True and payload.get('no_queued_commands') is True
                and latest <= instant(payload['updated_at']) <= recorded, 'Retained lane payload does not acknowledge complete quiet')
    return value


def finalize(args):
    started = datetime.now(timezone.utc)
    require(args.baseline_checkout == BASELINE and args.baseline_checkout.resolve(strict=True) == BASELINE,
            'Use the exact published Site102 baseline checkout')
    require(args.final_directory.resolve(strict=True) == FINAL and args.performance_directory.resolve(strict=True) == PERF,
            'This finalizer is specific to final-a33 / performance-integrated-02')
    regression_directory = args.regression_directory.resolve(strict=True)
    require(regression_directory.is_relative_to(FINAL), 'Regression evidence must remain inside the final attempt')
    e = Evidence(BASELINE, started)
    args._evidence = e
    unmeasured(PERF, BASELINE)
    generator, controller = e.keep(Path(__file__)), e.keep(CONTROLLER)
    transport_pattern = e.keep(ROOT / 'docs/migration/lot5b-evidence/record-cost-log-transport.py')
    controller_review_path = BASE / 'recovery/planning/coordinated-cost-controller-review.json'
    controller_review = e.read(controller_review_path)
    require(controller_review['schema'] == 'logos-engine.lot5c-coordinated-cost-controller-source-review.v1'
            and controller_review['status'] == 'passed_source_review' and controller_review['controller'] == controller
            and controller_review['checkedCount'] == len(controller_review['checks']) > 0
            and all(item['passed'] is True for item in controller_review['checks'])
            and controller_review['unresolvedFindings'] == []
            and all(controller_review[key] is False for key in ('controllerExecuted', 'measurementExecuted', 'readinessAsserted', 'isolationAsserted')),
            'Independent source review does not pass the exact external controller')
    for record in controller_review.get('inputs', []):
        e.verify(record)
    e.recorded(controller_review)
    historical = e.keep(ROOT / 'docs/migration/lot10b-evidence/finalize-cost-readiness.py')
    declaration = e.read(PERF / 'declaration.json')
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration['status'] == 'declared_before_official_window' and declaration['noOfficialWindowAtDeclaration'] is True
            and declaration['baseline']['nativeVersion'] == '0.62.0' and declaration['baseline']['siteVersion'] == 102
            and declaration['baseline']['commit'] == BASELINE_COMMIT and declaration['baseline']['nativeFiles'] == 310
            and declaration['baseline']['nativeDigest'] == BASELINE_DIGEST
            and declaration['candidate']['nativeVersion'] == '0.63.0' and declaration['candidate']['nativeFiles'] == 318
            and declaration['candidate']['nativeDigest'] == CANDIDATE_DIGEST
            and declaration['candidate']['sourceBaseCommit'] == SOURCE_COMMIT, 'Declaration is not the actual published baseline/final candidate pair')
    e.fingerprints(declaration)
    source = e.read(declaration['candidateManifest']['path']); baseline_source = e.read(declaration['baselineManifest']['path'])
    archive = e.read(declaration['candidateArchiveManifest']['path'])
    require(archive['baseCommit'] == SOURCE_COMMIT and archive['nativeSourceManifestDigest'] == CANDIDATE_DIGEST
            and len(archive['files']) == 867, 'Wrong final source archive')
    verifier = load_verifier(e, archive)
    require(native_inventory(e, verifier, ROOT) == source and native_inventory(e, verifier, BASELINE) == baseline_source
            and source['fileCount'] == 318 and source['digest'] == CANDIDATE_DIGEST
            and baseline_source['fileCount'] == 310 and baseline_source['digest'] == BASELINE_DIGEST
            and native_version(e, ROOT) == '0.63.0' and native_version(e, BASELINE) == '0.62.0', 'Actual frozen native sources or versions differ')
    checked_archive, archive_proof = verifier.verify_source_archive(FINAL, source)
    require(checked_archive == archive and archive_proof['files'] == archive_proof['members'] == 867, 'Archive verification differs')
    e.file_map(archive['files']); e.verify(archive['archive'])
    parts = e.read(FINAL / 'source-archive-parts.json'); e.fingerprints(parts)
    validation_contract = e.read(FINAL / 'validation-contract.json')
    require(validation_contract['schema'] == 'logos-engine.lot5c.final-integrated-validation-contract.v1'
            and validation_contract['expectedNativeDigest'] == source['digest']
            and validation_contract['commonEvidenceDirectory'] == COMMON.relative_to(ROOT).as_posix()
            and validation_contract['recordedReplayCaseCount'] == 11 and validation_contract['recordedReplayExpectedChecks'] == 187
            and validation_contract['noNewLiveGame'] is True, 'Final validation contract changed')
    e.verify(validation_contract['recordedReplayScope'])
    tests, gates, facts = formal(e, verifier, FINAL, source, validation_contract, archive)
    replay = regressions(e, verifier, regression_directory, args.regression_launch_receipt,
                         source, FINAL / 'recorded-regression-cases.json')
    common_proof = common(e, source, e.keep(FINAL / 'validation/delta-tests-run.json'))
    browser_proof = browser(e, source, e.keep(FINAL / 'validation/checks-run.json'))
    owner_record, prep_facts = preparation(e, PERF, declaration, source, baseline_source)
    inherited = e.read(ROOT / 'docs/migration/lot10b-evidence/recovery-20261111/performance-integrated-01/readiness.json')
    require(inherited['nativeSourceDigest'] == BASELINE_DIGEST and inherited['game']['id'] == 'HPDL'
            and inherited['game']['status'] == 'partial' and inherited['game']['clockReset'] is False,
            'Inherited HPDL reserve was reclassified')
    e.fingerprints(inherited['game'])
    latest_functional = e.latest.isoformat()
    isolation = quiet(e, args.isolation_receipt, PERF, declaration)
    require(e.keep(args.isolation_receipt)['path'] == (BASE / 'recovery/coordination/cost-final-01/isolation.json').relative_to(ROOT).as_posix(),
            'Controller and readiness must use the same isolation path')
    # Close the read/validate/use boundary on all retained bytes and memberships.
    e.recheck()
    require(native_inventory(e, verifier, ROOT) == source and native_inventory(e, verifier, BASELINE) == baseline_source,
            'Native membership changed during readiness')
    require(verifier.verify_tests(tests, source)[1] == facts['formalTests']
            and verifier.verify_build(gates, source)[1] == facts['nativeAgentWorker'], 'Final test/build input membership changed')
    prior_inventory = e.read(PERF / 'prior-attempt-inventory.json')
    require({path.relative_to(OLD).as_posix() for path in OLD.rglob('*') if path.is_file()} == set(prior_inventory['files']),
            'Prior attempt membership changed during finalization')
    e.recheck(); unmeasured(PERF, BASELINE)
    finalized = datetime.now(timezone.utc)
    require(started <= finalized and instant(isolation['recordedAt']) <= finalized, 'Finalization clock is out of order')
    result = {'schema': 'logos-engine.native-cost-window-readiness.v1', 'status': 'ready',
        'startedAt': started.isoformat(), 'finalizedAt': finalized.isoformat(), 'measurementAuthorized': True,
        'authorizationScope': 'cost_measurement_only', 'publicationAuthorized': False, 'gameActionsAuthorized': False,
        'pendingRequirements': [], 'generator': generator, 'historicalValidationPattern': historical,
        'preWindowController': controller, 'controllerSourceReview': e.keep(controller_review_path),
        'losslessLogTransportPattern': transport_pattern, 'preWindowToolsOutsideFrozenArchive': [generator, controller],
        'nativeVersion': '0.63.0', 'nativeSourceDigest': source['digest'], 'baseline': declaration['baseline'], 'candidate': declaration['candidate'],
        **facts, **replay, 'common': common_proof, 'browser': browser_proof, 'preparationReview': prep_facts,
        'sourceArchiveVerification': archive_proof, 'ownerCostContract': owner_record, 'historicalStrictIdentityNotAnticipated': True,
        'functionalReservations': {'closedCases': validation_contract['closedCases'], 'excludedWholeModules': EXCLUSIONS,
            'recordedReplayBindingQualification': validation_contract['recordedReplayBindingQualification'],
            'inheritedReplayBaselineQualification': validation_contract['replayQualification'],
            'commonQualification': common_proof['qualification'], 'fullStrategyRouterParity': False,
            'inheritedHPDL': inherited['game'], 'noNewLiveGame': True,
            'browserWallBudgetOverrunSeconds': browser_proof['declaredBrowserQaWallBudgetOverrunSeconds']},
        'isolation': isolation, 'isolationReceipt': e.keep(args.isolation_receipt), 'latestCompletedFunctionalEvidenceAt': latest_functional,
        'windowOpeningRequirements': {'requestId': REQUEST, 'exclusiveNonblockingLockRequired': True,
            'lockPath': '/workspace/shared/sra-coordination/performance.lock', 'freshAcknowledgmentsRecheckedByController': True,
            'requiredLanes': sorted(LANES), 'actualLockOwnershipObservedByFinalizer': False,
            'quietMustContinueUntilExplicitRootReleaseAfterCompleteReview': True},
        'inputs': e.snapshot(), 'watchedExternalInputs': e.snapshot(external=True),
        'qualification': 'All functional readiness claims are checked against terminal retained5C evidence on the actual318-file a33 source and published310-file Site102 baseline. This reader performs only file/receipt verification; no game, replay, test, build, profile or measurement runs. Raw game journals and raw owner graphs are streamed only for fingerprints, never decoded. The supplied cooperative ACKs follow all completed evidence. Actual nonblocking EX ownership and current fresh ACK payloads remain mandatory controller checks at window opening; this reader does not claim to observe the lock. Readiness authorizes cost measurement only, preserves all closed budgets and functional/browser reservations, and asserts no cost acceptance, strict historical work identity, whole original-caller parity or publication.'}
    write_exclusive(PERF / 'readiness.json', result)
    print(json.dumps({'status': 'ready', 'path': str(PERF / 'readiness.json'), 'measurementExecuted': False,
                      'formalTests': 5339, 'regressionChecks': 187, 'commonChecks': 6818}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-checkout', type=Path, default=BASELINE)
    parser.add_argument('--final-directory', type=Path, default=FINAL)
    parser.add_argument('--performance-directory', type=Path, default=PERF)
    parser.add_argument('--regression-directory', type=Path, default=FINAL)
    parser.add_argument('--regression-launch-receipt', type=Path, required=True)
    parser.add_argument('--isolation-receipt', type=Path, required=True)
    args = parser.parse_args()
    started = datetime.now(timezone.utc)
    try:
        finalize(args)
    except (Exception, KeyboardInterrupt) as error:
        evidence = getattr(args, '_evidence', None)
        failure = {'schema': 'logos-engine.lot5c-cost-readiness-failure.v1', 'status': 'failed',
            'startedAt': started.isoformat(), 'finishedAt': datetime.now(timezone.utc).isoformat(),
            'measurementAuthorized': False, 'measurementExecuted': False, 'readinessCreated': False,
            'error': f'{type(error).__name__}: {error}', 'traceback': traceback.format_exc(),
            'inputsObservedBeforeFailure': evidence.snapshot() if evidence else [],
            'externalInputsObservedBeforeFailure': evidence.snapshot(external=True) if evidence else [],
            'qualification': 'No existing evidence is replaced. Failure authorizes no measurement.'}
        path = PERF / ('readiness-failure-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ-') + uuid.uuid4().hex + '.json')
        try:
            write_exclusive(path, failure)
        except Exception as retention_error:
            failure['retentionError'] = str(retention_error)
        print(json.dumps({'status': 'failed', 'error': failure['error'], 'retainedFailure': str(path),
                          'retentionError': failure.get('retentionError'), 'measurementAuthorized': False}), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
