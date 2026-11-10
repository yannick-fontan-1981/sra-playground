#!/usr/bin/env python3
"""Bind completed 10A evidence before the first official cost sample.

This reader reuses the unchanged delivery verifier after checking its recorded
fingerprint. It starts no native process, test, replay, build, browser, game or
measurement. A supplied cooperative quiet receipt is mandatory; locks and
process visibility are not evidence of isolation. Browser and POLA reservations
remain explicit. The exclusive readiness.json authorizes cost measurement only.
Failures are retained as exclusive readiness-failure-*.json files.
"""
from __future__ import annotations

import argparse
import ast
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import traceback
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot10a-evidence'
VERIFIER = ROOT / 'scripts/verify-native-delivery.py'
COMPARATOR = ROOT / 'scripts/compare-v54-regressions.py'
RELEASE_DRIVER = BASE / 'run-release-checks.py'
REGRESSION_DRIVER = BASE / 'run-regressions.py'
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')
AXIAL_TESTS = ('tests/v6-axial-question-reference.test.ts', 'tests/v6-axial-question-kernel.test.ts')
GATES = ('typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build')
OWNER_RULE = {
    'ownerId': 'public_axial_question', 'programId': 'v6.axial_question.choose',
    'installedNodeIds': ['family_state:public_axial_question', 'family_activation:public_axial_question',
                         'program:v6.axial_question.choose'],
    'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
    'mode': 'predeclared_functional_fixture', 'qualification': 'functional_structure_frozen_before_measurement',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def instant(value):
    require(isinstance(value, str), 'Missing recorded timestamp')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timestamp lacks a timezone: ' + value)
    return result


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key: ' + key)
        result[key] = value
    return result


def invalid_constant(value):
    raise ValueError('Non-finite JSON value: ' + value)


def decode(raw):
    return json.loads(raw, object_pairs_hook=unique_object, parse_constant=invalid_constant)


def confined(value, boundary=ROOT):
    path = Path(value)
    require('..' not in path.parts and '\\' not in str(value) and all(ord(c) >= 32 for c in str(value)),
            'Unsafe path: ' + repr(str(value)))
    if not path.is_absolute():
        path = boundary / path
    require(path.is_relative_to(boundary) and boundary.resolve(strict=True) == boundary,
            'Path is outside its canonical checkout: ' + str(path))
    current = boundary
    for part in path.relative_to(boundary).parts:
        current = current / part
        require(not current.is_symlink(), 'Symlink input/output is not accepted: ' + str(current))
    require(path.resolve() == path, 'Noncanonical path: ' + str(path))
    return path


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def write_exclusive(path, value):
    payload = json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n'
    with path.open('x', encoding='utf-8') as stream:
        stream.write(payload)


class Evidence:
    def __init__(self, baseline):
        self.baseline = baseline
        self.retained = {}

    def path(self, value):
        path = ROOT / value
        return confined(path, ROOT if path.is_relative_to(ROOT) else self.baseline)

    def keep(self, value):
        path = self.path(value)
        require(path.is_file(), 'Missing regular evidence file: ' + str(path))
        name = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)
        record = {'path': name, 'sha256': sha(path), 'bytes': path.stat().st_size}
        require(self.retained.setdefault(name, record) == record, 'Input changed while checking: ' + name)
        return record

    def checked(self, record):
        require(isinstance(record, dict) and set(record) == {'path', 'sha256', 'bytes'}, 'Invalid fingerprint shape')
        require(isinstance(record['path'], str) and isinstance(record['sha256'], str)
                and re.fullmatch(r'[0-9a-f]{64}', record['sha256'])
                and type(record['bytes']) is int and record['bytes'] >= 0, 'Invalid fingerprint values')
        require(self.keep(record['path']) == record, 'Fingerprint differs: ' + record['path'])
        return self.path(record['path'])

    def read(self, value):
        self.keep(value)
        path = self.path(value)
        with (gzip.open(path, 'rt', encoding='utf-8') if path.suffix == '.gz' else path.open(encoding='utf-8')) as stream:
            return decode(stream.read())

    def records(self, value):
        """Check exact fingerprints in a receipt, never infer root for source maps."""
        if isinstance(value, dict):
            if set(value) == {'path', 'sha256', 'bytes'}:
                self.checked(value)
            else:
                for item in value.values():
                    self.records(item)
        elif isinstance(value, list):
            for item in value:
                self.records(item)

    def file_map(self, values, label, checkout=ROOT):
        require(isinstance(values, dict) and values, 'Empty input inventory: ' + label)
        for name, digest in values.items():
            require(isinstance(name, str) and not Path(name).is_absolute(), 'Non-relative inventory path')
            require(self.keep(confined(name, checkout))['sha256'] == digest, 'Changed ' + label + ': ' + name)
        return len(values)

    def snapshot(self, external=False):
        return [record for name, record in self.retained.items() if Path(name).is_absolute() is external]

    def recheck(self):
        for record in list(self.retained.values()):
            self.checked(record)


def native_inventory(evidence, verifier, checkout):
    files = dict(sorted((path.relative_to(checkout).as_posix(), evidence.keep(path)['sha256'])
        for folder in ('src/logos-engine', 'src/runtime')
        for path in verifier.walk_files(checkout / folder, checkout) if path.suffix in {'.ts', '.json', '.drm'}))
    require(files, 'Empty native source inventory')
    return {'fileCount': len(files), 'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(),
            'files': files}


def native_version(evidence, checkout):
    path = confined('src/logos-engine/v6-native-runtime.ts', checkout)
    evidence.keep(path)
    matches = re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]", path.read_text())
    require(len(matches) == 1 and re.fullmatch(r'\d+\.\d+\.\d+', matches[0]), 'Cannot identify the actual native version')
    return matches[0]


def unmeasured(perf, baseline):
    forbidden = ('readiness.json', 'window.json', 'combined-comparison.json', 'consolidation-review.json',
                 'global-budget-decision.json', 'owner-growth-comparison.json', 'owner-growth-review.json',
                 'aggregation-failure.json', 'aggregation-failure.log', 'superseded-before-measurement.json')
    for directory in (perf, confined(baseline / perf.relative_to(ROOT), baseline)):
        require(not any((directory / name).exists() or (directory / name).is_symlink() for name in forbidden)
                and not any(directory.glob('cohort*')), 'Readiness requires absent readiness, cost and cohort outputs: ' + str(directory))


def interval(value, limit, label):
    start, end = instant(value['startedAt']), instant(value['finishedAt'])
    require(start <= end <= limit, 'Unfinished or out-of-order ' + label)
    return end


def check_logs(evidence, receipt, limit):
    interval(receipt, limit, 'formal receipt')
    require(receipt['plannedChecks'] == [{'name': row['name'], 'command': row['command']} for row in receipt['checks']],
            'Actual checks differ from the retained plan')
    output = {}
    previous = instant(receipt['startedAt'])
    for row in receipt['checks']:
        require(previous <= instant(row['startedAt']), 'Formal checks overlap or are reordered')
        previous = interval(row, instant(receipt['finishedAt']), row['name'])
        raw = evidence.checked(row['rawOutput'])
        compressed = evidence.checked(row['output'])
        require(row['rawOutputPath'] == row['rawOutput']['path'], 'Raw output path differs')
        raw_bytes = raw.read_bytes()
        require(gzip.decompress(compressed.read_bytes()) == raw_bytes, 'Raw and compressed check logs differ')
        output[row['name']] = raw_bytes.decode('utf-8')
    return output


def formal_evidence(evidence, verifier, final, validation, cases_path, source, integrity):
    tests = evidence.read(validation / 'delta-tests-run.json')
    checks = evidence.read(validation / 'checks-run.json')
    deadline = instant(integrity['recordedAt'])
    for value in (tests, checks):
        require(value['generator'] == evidence.keep(RELEASE_DRIVER)
                and value['sharedProofHelper'] == evidence.keep(ROOT / 'scripts/run-v53-campaign-proof.py')
                and value['inputIntegrity'] == 'passed' and value['nativeSourceAfter'] == source,
                'Formal checks must be the completed unchanged 10A driver receipts')
        require(evidence.read(evidence.checked(value['sourceManifest'])) == source, 'Checks used a different freeze')
    source_tests, counts = verifier.verify_tests(tests, source)
    build_count, worker = verifier.verify_build(checks, source)
    require(checks['sourceAndTestInputsUnchanged'] is True and checks['sourceAndTestInputs'] == tests['sourceAndTestInputs'],
            'Tests and project checks bind different source/test inputs')
    evidence.file_map(tests['sourceAndTestInputs'], 'source/test inputs')
    evidence.file_map(checks['buildInputs'], 'build inputs')
    evidence.checked(worker)
    tap = check_logs(evidence, tests, deadline)['delta-tests']
    matches = {key: re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M) for key in COUNT_KEYS}
    require(all(len(value) == 1 for value in matches.values())
            and counts == {key: int(value[0]) for key, value in matches.items()}, 'Actual TAP summary differs from the passed receipt')
    scope = tests['testScope']
    require(scope['manifest'] == evidence.keep(BASE / 'validation-test-scope.json'), 'Unexpected test-scope manifest')
    manifest = evidence.read(scope['manifest']['path'])
    require(manifest['schema'] == 'logos-engine.lot10a.affected-test-scope.v1' and scope['declaredGroups'] == manifest['groups'],
            'Formal test groups changed')
    declared = [name for group in manifest['groups'] for name in group['testFiles']]
    require(declared and len(set(declared)) == len(declared), 'Invalid base test scope')
    extra = evidence.read(evidence.checked(scope['explicitExtraTestManifest'])) if scope['explicitExtraTestManifest'] is not None else []
    extras = extra['testFiles'] if isinstance(extra, dict) else extra
    require(extras == scope['explicitExtraTestFiles'] and isinstance(extras, list), 'Extra test manifest differs')
    selected = list(dict.fromkeys([*declared, *extras]))
    require(selected == tests['testFiles'] == scope['testFiles'] and len(selected) == tests['testFileCount'] == scope['testFileCount']
            and all(name in selected and name in tests['sourceAndTestInputs'] for name in AXIAL_TESTS),
            'The complete declared scope and both Axial tests must actually pass')
    require(tests['checks'][0]['command'] == ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *selected],
            'Actual test command differs from the declared files')

    logs = check_logs(evidence, checks, deadline)
    gates = {row['name']: row for row in checks['checks']}
    require(list(gates) == list(GATES), 'Missing or reordered project gate')
    require(gates['typecheck']['command'] == ['npm', 'run', 'typecheck']
            and gates['entry-audit']['command'] == ['node', 'scripts/audit-v6-entry-points.ts']
            and gates['migration-audit']['command'][1:] == ['-B', 'scripts/audit-v6-migration.py']
            and gates['diff-check']['command'] == ['git', 'diff', '--check']
            and gates['build']['command'][0] == 'node', 'Unexpected project-check command')
    entry = evidence.read(evidence.checked(gates['entry-audit']['auditReport']))
    entries = [(group['id'], item) for group in entry['groups'] for item in group['entries'] if item['question'] == 'axial_question']
    entry_log = decode(logs['entry-audit'])
    require(gates['entry-audit']['semanticPassed'] is True and len(entries) == 1
            and entries[0][0] == 'factored_material_return' and entries[0][1]['family'] == 'public_axial_question'
            and entries[0][1]['status'] == 'connected'
            and all(entry_log[key] == gates['entry-audit'][key] == entry[key] for key in ('connected', 'declared')),
            'Actual entry audit does not establish the connected Axial entry')
    migration = evidence.read(evidence.checked(gates['migration-audit']['auditReport']))
    migration_log = decode(logs['migration-audit'])
    require(gates['migration-audit']['semanticPassed'] is True and migration_log == gates['migration-audit']['auditSummary']
            and migration_log['failures'] == migration['failures'] == [], 'Actual migration audit retains failures')

    regression_path = final / 'regressions/regression-summary.json'
    evidence.keep(regression_path)
    regressions, regression_inputs = verifier.verify_regressions(regression_path, source, True)
    cases = evidence.read(cases_path)
    require(cases['schema'] == 'logos-engine.recorded-public-regression-cases.v1'
            and regressions['caseManifest'] == evidence.keep(cases_path), 'Regressions used another case manifest')
    # Read literals only: do not import or execute the comparator or replay driver.
    driver_tree = ast.parse(evidence.checked(evidence.keep(REGRESSION_DRIVER)).read_text())
    assignments = [node.value for node in driver_tree.body if isinstance(node, ast.Assign)
                   and any(isinstance(target, ast.Name) and target.id == 'EXPECTED_GAMES' for target in node.targets)]
    require(len(assignments) == 1 and [item['game'] for item in cases['cases']] == ast.literal_eval(assignments[0]),
            'The supplied manifest omits or reorders the actual 10A regression scope')
    comparator_record = evidence.keep(COMPARATOR)
    require(evidence.keep(evidence.baseline / COMPARATOR.relative_to(ROOT))['sha256'] == comparator_record['sha256'],
            'The historical regression comparator differs between checkouts')
    functions = [node for node in ast.parse(COMPARATOR.read_text()).body if isinstance(node, ast.FunctionDef) and node.name == 'compare']
    require(len(functions) == 1, 'Cannot identify the unchanged comparator')
    calls = [node.value for node in functions[0].body if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
             and isinstance(node.value.func, ast.Name) and node.value.func.id == 'same']
    require(calls and all(call.args and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str) for call in calls),
            'Comparator check labels must remain literal and ordered')
    labels = [call.args[0].value for call in calls]
    require(len(labels) == len(set(labels)), 'Duplicate comparator labels')
    rows = regressions['results']
    require([(row['case'], row['game']) for row in rows] == [(case['id'], case['game']) for case in cases['cases']],
            'Incomplete or reordered actual regression cases')
    evidence.file_map(regressions['executionInputs'], 'regression execution inputs')
    require(regressions['executionInputs'].get(COMPARATOR.relative_to(ROOT).as_posix()) == comparator_record['sha256'],
            'Regression execution did not bind the retained comparator')
    for row, case in zip(rows, cases['cases']):
        require(row['status'] == 'passed' and row['passed'] is True and type(row['exitCode']) is int and row['exitCode'] == 0
                and row['timedOut'] is False and row['comparisonPassed'] is True and row['failedChecks'] == []
                and row['nativeSourceUnchanged'] is True and row['immutableInputsUnchanged'] is True
                and row['nativeSourceBeforeDigest'] == row['nativeSourceAfterDigest'] == source['digest'], 'A replay did not actually pass')
        interval(row, deadline, 'regression ' + row['case'])
        if 'postprocessingFinishedAt' in row:
            require(instant(row['finishedAt']) <= instant(row['postprocessingFinishedAt']) <= deadline, 'Regression comparison is unfinished')
        evidence.records(row)
        require(evidence.read(row['execution']['path']) == {key: value for key, value in row.items() if key != 'execution'},
                'Regression summary differs from its actual execution receipt')
        for role in ('baseline', 'trace'):
            require({key: row[role][key] for key in case[role]} == case[role], 'A historical regression input differs from its manifest')
        comparison = evidence.read(row['comparison']['path'])
        require(comparison['schema'] == 'logos-engine.scoped-public-regression-comparison.v1'
                and comparison['passed'] is True and comparison['game'] == case['game']
                and comparison['legacyComparatorMetadata']['implementation'] == comparator_record
                and comparison['legacyComparatorMetadata']['checkLabelsPreserved'] is True
                and [item['name'] for item in comparison['checks']] == labels and row['comparisonChecks'] == len(labels)
                and all(item['passed'] is True and item['baselineProjectionSha256'] == item['currentProjectionSha256']
                        and re.fullmatch(r'[0-9a-f]{64}', item['baselineProjectionSha256']) for item in comparison['checks']),
                'A retained regression comparison is incomplete or reinterpreted')
        for key, target in (('before', row['baseline']), ('after', row['report']), ('trace', row['trace'])):
            require({name: comparison[key][name] for name in ('path', 'sha256', 'bytes')} == target, 'Comparison binds another report')
        require(comparison['after']['sourceDigest'] == source['digest'], 'Comparison binds another candidate source')
    comparison_count = len(rows) * len(labels)
    require(regressions['comparisonChecksPassed'] == regressions['comparisonChecksExpected'] == comparison_count,
            'Declared and actual regression-check populations differ')
    launch = evidence.read(final / 'regression-launch.json')
    require(launch['schema'] == 'logos-engine.lot10a.regression-launch.v1' and launch['status'] == 'passed'
            and type(launch['exitCode']) is int and launch['exitCode'] == 0 and launch['generator'] == evidence.keep(REGRESSION_DRIVER)
            and launch['regressionSummary'] == evidence.keep(regression_path) and launch['caseManifest'] == evidence.keep(cases_path)
            and launch['nativeSourceDigest'] == source['digest'] and launch['executionInputsUnchanged'] is True
            and launch['executionInputs'] == launch['executionInputsAfter'], 'The complete regression driver did not pass')
    evidence.records(launch)
    evidence.file_map(launch['executionInputs'], 'regression launcher inputs')
    interval(launch, deadline, 'regression launch')
    actual_counts = {'native': len(source['files']), 'archive': len(evidence.read(final / 'source-archive.json')['files']),
                     'sourceAndTests': source_tests, 'buildInputs': build_count, 'regressionExecutionInputs': regression_inputs}
    require(actual_counts == integrity['matchedFileInventories'] and counts == integrity['tests']
            and worker == integrity['nativeAgentWorker']
            and integrity['regressions'] == {key: regressions[key] for key in integrity['regressions']},
            'Delivery-integrity summaries differ from the actual completed evidence')
    return {'formalTests': counts, 'formalTestFiles': len(selected), 'formalTestFileNames': selected,
            'projectGates': [{'name': row['name'], 'exitCode': row['exitCode'], 'semanticPassed': row.get('semanticPassed')} for row in checks['checks']],
            'regressionCases': len(rows), 'regressionChecks': comparison_count, 'regressionComparator': comparator_record,
            'nativeAgentWorker': worker, 'matchedFileInventories': actual_counts}


def cost_preparation(evidence, final, perf, sources, versions, archive):
    declaration = evidence.read(perf / 'declaration.json')
    preparation = evidence.read(perf / 'preparation.json')
    policy = evidence.read(perf / 'global-budget-policy.json')
    protocol = evidence.read(perf / 'protocol-check.json')
    static = evidence.read(perf / 'static-preflight.json')
    contract_path = perf / 'owner-growth-contract.json'
    contract = evidence.read(contract_path)
    digests = {role: value['digest'] for role, value in sources.items()}
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration['status'] == 'declared_before_official_window' and declaration['noOfficialWindowAtDeclaration'] is True
            and declaration['nativeDigests'] == digests, 'A prospective declaration of these actual sources is required')
    require(preparation['schema'] == 'logos-engine.native-cost-protocol-preparation.v1'
            and preparation['status'] == 'source_freezes_verified_not_functional_readiness' and preparation['measurementExecuted'] is False
            and preparation['baselineCheckout'] == str(evidence.baseline) and preparation['candidateCheckout'] == str(ROOT)
            and confined(preparation['outputDirectory']) == perf and confined(preparation['candidateSourceDirectory']) == final,
            'Preparation names a different checkout or evidence directory')
    require(policy['schema'] == 'logos-engine.native-global-cost-policy.v1', 'Unexpected global policy')
    for role, source in sources.items():
        identity = declaration[role]
        require(identity == policy[role] == preparation[role] and identity['nativeDigest'] == source['digest']
                and identity['nativeFiles'] == source['fileCount'] and identity['nativeVersion'] == versions[role]
                and evidence.read(evidence.checked(declaration[role + 'Manifest'])) == source
                and preparation[role + 'Manifest'] == declaration[role + 'Manifest'], 'Declared identity differs from actual source: ' + role)
    require(declaration['candidateManifest'] == evidence.keep(final / 'source-manifest.json')
            and declaration['candidateArchiveManifest'] == preparation['candidateArchiveManifest'] == evidence.keep(final / 'source-archive.json')
            and archive['baseCommit'] == declaration['candidate']['sourceBaseCommit'], 'Candidate archive/freeze binding differs')
    baseline_identity = declaration['baseline']
    require(type(baseline_identity['siteVersion']) is int and baseline_identity['siteVersion'] > 0
            and re.fullmatch(r'[0-9a-f]{40}', baseline_identity['commit']), 'Incomplete published baseline identity')
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=evidence.baseline, text=True, timeout=15).strip()
            == baseline_identity['commit'], 'The explicit baseline checkout moved to another commit')
    require(not subprocess.check_output(['git', 'status', '--porcelain=v1', '--untracked-files=all', '--',
            'src/logos-engine', 'src/runtime'], cwd=evidence.baseline, text=True, timeout=15).strip(), 'Published baseline native worktree is dirty')
    evidence.records(declaration)
    evidence.records(preparation)
    evidence.records(policy.get('authorization', {}))
    for key, names in (
        ('preparationTools', ('prepare-cost-protocol.py', 'prepare-owner-cost-contract.py', 'check-cost-static-inputs.py')),
        ('ownerEvidenceTools', ('record-owner-source-inventory.mjs', 'capture-cost-owner-graphs.mjs', 'qualify-cost-owner-graphs.mjs')),
    ):
        require(declaration[key] == preparation[key] == [evidence.keep(BASE / name) for name in names],
                'A predeclared preparation/graph tool changed: ' + key)
    for record in declaration['officialTools']:
        actual = evidence.keep(evidence.baseline / record['path'])
        require(all(actual[key] == record[key] for key in ('sha256', 'bytes')), 'The baseline official tool differs: ' + record['path'])
    cases = evidence.read(declaration['cases']['path'])
    require(protocol == {'status': 'protocol_contract_passed', 'declaration': (perf / 'declaration.json').relative_to(ROOT).as_posix(),
            'finalizedAt': declaration['finalizedAt'], 'nativeDigests': digests,
            'caseIds': [case['id'] for case in cases['cases']], 'measurementExecuted': False}, 'The retained protocol checker did not pass these inputs')

    tools = {'consolidator': evidence.keep(BASE / 'consolidate-owner-costs.mjs'), 'reviewer': evidence.keep(BASE / 'review-owner-costs.py')}
    require(declaration['ownerCostQualification'] == {'schema': 'logos-engine.lot10a-owner-cost-qualification.v1',
            'contractPath': contract_path.relative_to(ROOT).as_posix(), 'tools': tools}, 'Owner qualification names other tools or contract')
    require(contract['schema'] == 'logos-engine.lot10a-owner-cost-contract.v2' and contract['lot'] == '10A'
            and confined(contract['performanceDirectory']) == perf and contract['declaration'] == evidence.keep(perf / 'declaration.json')
            and contract['tools'] == tools and contract['structuralExpectation'] == OWNER_RULE
            and contract['inputsBefore'] == contract['inputsAfter'] and contract['inputsUnchanged'] is True
            and contract['measurementExecuted'] is False and contract['generator'] == evidence.keep(BASE / 'prepare-owner-cost-contract.py'),
            'Owner contract is incomplete or differs from the prospective Axial rule')
    require(contract['sourceEvidence'] == [evidence.keep(ROOT / name) for name in (
            'src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-axial-question.ts', 'src/logos-engine/v6-knowledge-store.ts')],
            'Owner contract names different source evidence')
    for key, name in (('strictFailureReceipt', 'aggregation-failure.json'), ('strictFailureLog', 'aggregation-failure.log'),
                      ('historicalAggregateOutput', 'combined-comparison.json')):
        require(confined(contract[key]) == perf / name, 'The separate strict historical outputs were rebound')
    evidence.records(contract)
    require(static['schema'] == 'logos-engine.native-cost-static-preflight.v1' and static['status'] == 'static_inputs_checked'
            and static['measurementExecuted'] is False and static['checkedCount'] == len(static['checks']) > 0
            and static['unsatisfied'] == [] and all(row['satisfied'] is True for row in static['checks'])
            and len({row['name'] for row in static['checks']}) == len(static['checks'])
            and static['baselineCheckout'] == str(evidence.baseline) and static['candidateCheckout'] == str(ROOT)
            and static['declaration'] == evidence.keep(perf / 'declaration.json')
            and static['candidateFreeze'] == declaration['candidateManifest'] and static['protocolCheck'] == evidence.keep(perf / 'protocol-check.json')
            and static['ownerCostContract'] == evidence.keep(contract_path) and static['ownerCostTools'] == tools
            and static['readinessCreated'] is False and static['isolationChecked'] is False
            and static['functionalReadinessChecked'] is False and static['supersession'] is None,
            'Static preflight is not a passed binding of the completed preparation')
    require(static['generator'] == evidence.keep(BASE / 'check-cost-static-inputs.py')
            and static['preparationTool'] == evidence.keep(BASE / 'prepare-cost-protocol.py'), 'Static preparation tool changed')
    evidence.checked(static['adaptedFrom'])
    static_checks = {row['name']: row for row in static['checks']}
    for name, expected, tail in (
        ('retained_protocol_contract_checker', protocol,
         ['-B', 'scripts/review-native-global-cost-window.py', '--check-protocol', (perf / 'declaration.json').relative_to(ROOT).as_posix()]),
        ('complete_owner_proof_chain_rechecked', {'status': 'owner_contract_checked', 'contract': evidence.keep(contract_path), 'measurementExecuted': False},
         ['-B', str(BASE / 'prepare-owner-cost-contract.py'), '--verify-only', '--baseline-checkout', str(evidence.baseline),
          '--performance-directory', str(perf), '--owner-inventory', contract['ownerInventory']['path'],
          '--structural-fixture', contract['structuralFixture']['path']]),
    ):
        row = static_checks[name]
        require(type(row['exitCode']) is int and row['exitCode'] == 0 and row['command'][1:] == tail
                and decode(row['stdout']) == expected, 'Static preflight lacks an actual successful retained reader: ' + name)
    for row in static['traces']:
        checkout = evidence.baseline if row['role'] == 'baseline' else ROOT
        require(row['role'] in ('baseline', 'candidate'), 'Unknown static trace role')
        case = next(item for item in cases['cases'] if item['id'] == row['case'])
        path = confined(checkout / case['trace'], checkout)
        actual = evidence.keep(path)
        require(row['path'] == str(path) and row['sha256'] == row['expectedSha256'] == actual['sha256'] == case['traceSha256']
                and row['bytes'] == actual['bytes'], 'A static trace changed')

    inventory = evidence.read(contract['ownerInventory']['path'])
    fixture = evidence.read(contract['structuralFixture']['path'])
    attribution = evidence.read(evidence.checked(fixture['attribution']))
    require(inventory['schema'] == 'logos-engine.lot10a-owner-cost-source-inventory.v1'
            and inventory['nativeDigests'] == digests and inventory['programScope'] == 'family-installed programs'
            and inventory['generator'] == evidence.keep(BASE / 'record-owner-source-inventory.mjs'), 'Owner inventory differs')
    for role, checkout in (('baseline', evidence.baseline), ('candidate', ROOT)):
        side = inventory['sourceInventory'][role]
        require(side['checkout'] == str(checkout) and side['native'] == sources[role] and side['runtimeUninitializedBeforeAndAfter'] is True
                and all(side[key] == inventory[key][role] for key in ('owners', 'programs')), 'Owner factory inventory names a different source')
        for record in side['sourceInputs']:
            require(not Path(record['path']).is_absolute(), 'Factory source path must be checkout-relative')
            actual = evidence.keep(confined(record['path'], checkout))
            require(all(actual[key] == record[key] for key in ('sha256', 'bytes')), 'An owner factory input changed')
    for key, addition in (('owners', OWNER_RULE['ownerId']), ('programs', OWNER_RULE['programId'])):
        before, after = inventory[key]['baseline'], inventory[key]['candidate']
        require(len(before) == len(set(before)) and len(after) == len(set(after))
                and set(after) - set(before) == {addition} and not set(before) - set(after), 'Unexpected owner/program addition')
    forms = [(case['id'], form) for case in cases['cases'] for form in ('warmup', 'measured')]
    require(fixture['schema'] == 'logos-engine.lot10a-owner-cost-structural-fixture.v1'
            and attribution['schema'] == 'logos-engine.lot10a-owner-cost-structural-attribution.v1'
            and fixture['status'] == attribution['status'] == 'qualified_functional_structure'
            and fixture['nativeDigests'] == attribution['nativeDigests'] == digests
            and fixture['cases'] == declaration['cases'] and fixture['captureTool'] == evidence.keep(BASE / 'capture-cost-owner-graphs.mjs')
            and attribution['generator'] == evidence.keep(BASE / 'qualify-cost-owner-graphs.mjs')
            and static['ownerStructuralFixture'] == contract['structuralFixture']
            and [(row['case'], row['form']) for row in fixture['forms']] == forms
            and attribution['formsSha256'] == hashlib.sha256(json.dumps(fixture['forms'], sort_keys=True, separators=(',', ':'),
                ensure_ascii=False, allow_nan=False).encode()).hexdigest()
            and attribution['checkedCount'] == len(attribution['checks']) > 0 and attribution['failures'] == []
            and attribution['nodeAttributions'] and all(row['passed'] is True for row in attribution['checks']),
            'Functional graph fixture/attribution is not the actual qualified input')
    evidence.records(fixture)
    evidence.records(attribution)
    external = []
    for role, checkout in (('baseline', evidence.baseline), ('candidate', ROOT)):
        capture = fixture['captures'][role]
        receipt = evidence.read(capture['receipt']['path'])
        require(receipt['schema'] == 'logos-engine.lot10a-owner-cost-functional-capture-receipt.v1'
                and receipt['status'] == 'captured_functional_structure' and receipt['role'] == role
                and receipt['checkout'] == str(checkout) and receipt['nativeDigest'] == digests[role]
                and receipt['report'] == capture['report'] and receipt['generator'] == receipt['generatorAfter'] == fixture['captureTool']
                and receipt['generatorUnchanged'] is True and receipt['failures'] == []
                and receipt['inputsBefore'] == receipt['inputsAfter'] and receipt['inputsUnchanged'] is True
                and receipt['nativeInventoryBefore'] == receipt['nativeInventoryAfter'] == sources[role]
                and receipt['nativeSourceBefore'] == receipt['nativeSourceAfter'] and receipt['nativeSourceUnchanged'] is True
                and all(receipt[key] == 0 for key in ('measuredCostSessions', 'timingReportsRead', 'timingMetricsProduced'))
                and receipt['sessionCount'] == len(receipt['sessions']) == len(forms), 'A functional graph capture did not complete unchanged')
        require([(row['case'], row['form']) for row in receipt['sessions']] == forms
                and all(row['status'] == 'captured_functional_structure' and row['shape'] == fixture['forms'][index][role]
                        for index, row in enumerate(receipt['sessions']))
                and receipt['actions'] == sum(row['shape']['actions'] for row in receipt['sessions']), 'Captured graph forms differ')
        require(receipt['nativeSourceBefore'] in receipt['inputsBefore'] and receipt['cases'] in receipt['inputsBefore']
                and all(receipt['nativeSourceBefore'][key] == declaration[role + 'Manifest'][key] for key in ('bytes', 'sha256'))
                and all(receipt['cases'][key] == fixture['cases'][key] for key in ('bytes', 'sha256')),
                'Capture did not bind the declared source and cases')
        evidence.records(receipt)
        require(instant(declaration['finalizedAt']) <= instant(receipt['startedAt']), 'Capture predates the prospective declaration')
        interval(receipt, instant(attribution['recordedAt']), 'functional graph capture')
        external.extend(row for row in receipt['inputsBefore'] if Path(row['path']).is_absolute())
        require(all(record in attribution['inputs'] for record in capture.values()), 'Attribution omits capture bytes')
    require([row for row in attribution['inputs'] if Path(row['path']).is_absolute()] == external,
            'Attribution external inputs differ from the exact baseline captures')
    for record in static['ownerStructuralExternalInputs']:
        evidence.checked(record)
    require(instant(policy['declaredAt']) <= instant(declaration['recordedAt']) <= instant(declaration['finalizedAt'])
            <= instant(inventory['recordedAt']) <= instant(contract['declaredAt']) <= instant(static['startedAt']) <= instant(static['recordedAt'])
            and instant(attribution['recordedAt']) <= instant(fixture['recordedAt']) <= instant(contract['declaredAt']),
            'Preparation, graph qualification, contract and static preflight are out of order')
    return declaration, static


def browser_and_reserve(evidence, browser_path, reserve_path, source, version):
    browser = evidence.read(browser_path)
    require(browser['schema'] == 'logos-engine.browser-qa.v1' and browser['nativeDigest'] == source['digest']
            and browser['nativeVersion'] == version and browser['status'] in ('passed', 'blocked', 'inconclusive')
            and isinstance(browser['qualification'], str) and bool(browser['qualification'].strip())
            and isinstance(browser['artifacts'], list) and browser['artifacts'], 'An honest source-bound browser receipt with retained artifacts is required')
    for record in browser['artifacts']:
        evidence.checked(record)
    if browser['status'] == 'passed':
        require(browser['learnedStateInjected'] is False and browser['pause']['observed'] == 'Paused.'
                and browser['oneAction']['observed'] == 'One action completed.'
                and type(browser['pause']['actions']) is int and browser['pause']['actions'] >= 0
                and type(browser['oneAction']['actions']) is int
                and browser['oneAction']['actions'] == browser['pause']['actions'] + 1,
                'A passed browser receipt must retain actual Pause and one-action observations')
    if 'startedAt' in browser or 'finishedAt' in browser:
        interval(browser, instant(browser['recordedAt']), 'browser attempt')
    # A blocked attempt binds its intended target, not an observed runtime or UI.
    browser_summary = {'status': browser['status'], 'receipt': evidence.keep(browser_path),
                       'qualification': browser['qualification'], 'provesAxialContribution': False,
                       'nativeBinding': 'observed_receipt' if browser['status'] == 'passed' else 'intended_target_only'}
    reserve = evidence.read(reserve_path)
    require(reserve['schema'] == 'logos-engine.lot10a.case-budget-review.v1' and reserve['case'] == 'POLA',
            'The explicit POLA contribution/budget reserve is required')
    decision, historical = reserve['decision'], reserve['historicalAttempt']
    require(decision['officialSuccess'] == 'not_established' and decision['ownLiveContribution'] in ('open', 'not_established')
            and decision['newCaseClockCreated'] is False and decision['priorBudgetAssumedFresh'] is False
            and decision['borrowedElapsedFromOtherGame'] is False and type(decision['newGameActions']) is int
            and decision['newGameActions'] == 0 and historical['cumulativeSeconds'] is None and historical['remainingSeconds'] is None
            and isinstance(decision['reason'], str) and decision['reason'].strip(), 'The supplied reserve no longer describes an unestablished POLA budget/contribution')
    evidence.records(reserve)
    game = {'id': reserve['case'], 'status': 'not_established', 'officialSuccess': decision['officialSuccess'],
            'contributionStatus': 'not_established', 'retainedContributionDecision': decision['ownLiveContribution'],
            'cumulativeSeconds': historical['cumulativeSeconds'], 'remainingSeconds': historical['remainingSeconds'],
            'clockReset': decision['newCaseClockCreated'], 'reserve': evidence.keep(reserve_path), 'qualification': decision['reason']}
    reservations = [{'subject': 'POLA game and own contribution', 'status': 'not_established', 'evidence': game['reserve'],
                     'qualification': decision['reason']}]
    if browser['status'] != 'passed':
        reservations.append({'subject': 'browser QA', 'status': browser['status'], 'evidence': browser_summary['receipt'],
                             'qualification': browser['qualification']})
    return browser_summary, game, reservations, max(instant(browser['recordedAt']), instant(reserve['reviewedAt']))


def quiet_receipt(evidence, path, latest_evidence, now, perf, declaration):
    isolation = evidence.read(path)
    require(isolation['schema'] == 'logos-engine.coordinated-cost-isolation.v1'
            and isolation['status'] == 'acknowledged_quiet_before_window' and isolation['otherLaneAcknowledged'] is True
            and isolation['ownTrackedComputeEnded'] is True and isolation['previewStopped'] is True
            and isolation['costNodeOptionsOverride'] is None and isinstance(isolation['evidence'], list) and isolation['evidence']
            and isinstance(isolation['qualification'], str) and isolation['qualification'].strip(),
            'A supplied explicit cooperative quiet acknowledgement is required; a lock is insufficient')
    require(latest_evidence <= instant(isolation['recordedAt']) <= now,
            'Quiet acknowledgement must follow all completed evidence and precede finalization')
    for record in isolation['evidence']:
        evidence.checked(record)
    for lane in isolation.get('knownLanes', []):
        require(lane['activeCommand'] is None and instant(lane['updatedAt']) <= instant(isolation['recordedAt']),
                'The supplied quiet receipt retains active or future lane work')
    # Preserve optional explicit binding when supplied. Never infer it from a lock.
    if 'performanceDirectory' in isolation:
        require(confined(isolation['performanceDirectory']) == perf, 'Quiet receipt names another performance directory')
    if 'nativeDigests' in isolation:
        require(isolation['nativeDigests'] == declaration['nativeDigests'], 'Quiet receipt names another source pair')
    if 'declaration' in isolation:
        require(isolation['declaration'] == evidence.keep(perf / 'declaration.json'), 'Quiet receipt names another declaration')
    return isolation


def finalize(args, evidence, perf, started):
    final = confined(args.final_directory)
    validation = confined(ROOT / args.validation_directory, final)
    require(final.is_dir() and validation.is_dir(), 'Final and validation directories must exist; validation must be inside final')
    unmeasured(perf, evidence.baseline)
    source = evidence.read(final / 'source-manifest.json')
    integrity = evidence.read(final / 'delivery-integrity.json')
    require(integrity['schema'] == 'logos-engine.native-delivery-integrity.v1' and integrity['status'] == 'passed'
            and integrity['generator'] == evidence.keep(VERIFIER) and integrity['nativeSourceDigest'] == source['digest']
            and integrity['directory'] == final.relative_to(ROOT).as_posix()
            and integrity['validationDirectory'] == validation.relative_to(ROOT).as_posix(), 'The unchanged common delivery verifier must pass these inputs first')
    # Import only after its bytes equal the generator of the already-passed receipt.
    spec = importlib.util.spec_from_file_location('lot10a_readiness_delivery_verifier', VERIFIER)
    require(spec is not None and spec.loader is not None, 'Cannot load the retained delivery verifier')
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    require(verifier.ROOT == ROOT, 'Shared verifier loaded from another checkout')
    evidence.keep(VERIFIER)
    required = [final / name for name in ('source-manifest.json', 'source-archive.json', 'source-archive-parts.json', 'regressions/regression-summary.json')]
    required += [validation / name for name in ('delta-tests-run.json', 'checks-run.json')]
    require(all(evidence.keep(path) in integrity['receipts'] for path in required), 'Delivery integrity omits a required formal receipt')
    for record in [*integrity['receipts'], *integrity['verificationHelpers'], integrity['originalSourceManifest']]:
        evidence.checked(record)
    archive, archive_verification = verifier.verify_source_archive(final, source)
    require(archive_verification == integrity['sourceArchiveVerification'], 'Current source archive differs from the passed delivery verification')
    evidence.file_map(archive['files'], 'archive inputs')
    evidence.checked(archive['archive'])
    evidence.records(evidence.read(final / 'source-archive-parts.json'))
    declaration = evidence.read(perf / 'declaration.json')
    baseline_source = evidence.read(evidence.checked(declaration['baselineManifest']))
    sources = {'baseline': baseline_source, 'candidate': source}
    for role, checkout in (('baseline', evidence.baseline), ('candidate', ROOT)):
        require(native_inventory(evidence, verifier, checkout) == sources[role], 'Actual native freeze differs: ' + role)
    versions = {role: native_version(evidence, checkout) for role, checkout in (('baseline', evidence.baseline), ('candidate', ROOT))}
    generator = evidence.keep(Path(__file__).resolve())
    formal = formal_evidence(evidence, verifier, final, validation, confined(args.regression_cases), source, integrity)
    declaration, static = cost_preparation(evidence, final, perf, sources, versions, archive)
    browser, game, reservations, browser_reserve_time = browser_and_reserve(evidence, confined(args.browser_evidence),
        confined(args.contribution_reserve), source, versions['candidate'])
    latest = max(instant(integrity['recordedAt']), instant(static['recordedAt']), browser_reserve_time)
    isolation = quiet_receipt(evidence, confined(args.isolation_receipt), latest, datetime.now(timezone.utc), perf, declaration)
    # Recheck every consumed file and inventory membership after the final read.
    evidence.recheck()
    for role, checkout in (('baseline', evidence.baseline), ('candidate', ROOT)):
        require(native_inventory(evidence, verifier, checkout) == sources[role], 'Native files changed during readiness: ' + role)
    tests = evidence.read(validation / 'delta-tests-run.json')
    checks = evidence.read(validation / 'checks-run.json')
    require(verifier.verify_tests(tests, source)[1] == formal['formalTests']
            and verifier.verify_build(checks, source)[1] == formal['nativeAgentWorker'], 'Formal file membership or worker changed during readiness')
    evidence.recheck()
    unmeasured(perf, evidence.baseline)
    finalized = datetime.now(timezone.utc)
    require(started <= finalized and instant(isolation['recordedAt']) <= finalized, 'Finalization clock is out of order')
    result = {'schema': 'logos-engine.native-cost-window-readiness.v1', 'status': 'ready',
        'startedAt': started.isoformat(), 'finalizedAt': finalized.isoformat(), 'measurementAuthorized': True,
        'authorizationScope': 'cost_measurement_only', 'publicationAuthorized': False, 'gameActionsAuthorized': False,
        'pendingRequirements': [], 'functionalReservations': reservations, 'generator': generator,
        'nativeVersion': versions['candidate'], 'nativeSourceDigest': source['digest'],
        'baseline': declaration['baseline'], 'candidate': declaration['candidate'], **formal,
        'deliveryIntegrity': evidence.keep(final / 'delivery-integrity.json'), 'sourceArchiveVerification': archive_verification,
        'ownerCostContract': evidence.keep(perf / 'owner-growth-contract.json'), 'historicalStrictIdentityNotAnticipated': True,
        'browser': browser, 'game': game, 'isolation': isolation, 'isolationReceipt': evidence.keep(args.isolation_receipt),
        'inputs': evidence.snapshot(), 'watchedExternalInputs': evidence.snapshot(external=True),
        'qualification': 'All cost-readiness prerequisites are bound to completed retained evidence and actual frozen inputs. '
            'No test, build, replay, graph capture, browser, game or cost measurement was started by this reader. '
            'The supplied cooperative acknowledgement is retained as the isolation evidence; no lock or process scan substitutes for it. '
            'A blocked/inconclusive browser remains so; POLA game success and own contribution remain not established with no reconstructed clock. '
            'Pending requirements refers only to this cost measurement. Functional reservations are not game success, complete migration, '
            'strict historical cost identity, cost acceptance or publication authorization.'}
    output = confined(perf / 'readiness.json')
    write_exclusive(output, result)
    print(json.dumps({'status': 'ready', 'receipt': evidence.keep(output), 'authorizationScope': result['authorizationScope'],
                      'browserStatus': browser['status'], 'gameStatus': game['status'], 'measurementExecuted': False}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('baseline-checkout', 'final-directory', 'performance-directory', 'validation-directory',
                 'isolation-receipt', 'browser-evidence', 'contribution-reserve', 'regression-cases'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    started = datetime.now(timezone.utc)
    perf, evidence = None, None
    try:
        perf = confined(args.performance_directory)
        require(perf.is_dir(), 'The explicit performance directory must already exist')
        baseline = args.baseline_checkout
        require(baseline.is_absolute() and baseline.resolve(strict=True) == baseline and baseline.is_dir()
                and baseline != ROOT and not baseline.is_relative_to(ROOT) and not ROOT.is_relative_to(baseline),
                'Supply the canonical absolute distinct baseline checkout')
        evidence = Evidence(baseline)
        finalize(args, evidence, perf, started)
    except (Exception, KeyboardInterrupt) as error:
        failure = {'schema': 'logos-engine.lot10a-cost-readiness-failure.v1', 'status': 'failed',
                   'startedAt': started.isoformat(), 'finishedAt': datetime.now(timezone.utc).isoformat(),
                   'measurementAuthorized': False, 'measurementExecuted': False,
                   'arguments': {key: str(value) for key, value in vars(args).items()},
                   'error': f'{type(error).__name__}: {error}', 'traceback': traceback.format_exc(),
                   'inputsObservedBeforeFailure': evidence.snapshot() if evidence else [],
                   'externalInputsObservedBeforeFailure': evidence.snapshot(external=True) if evidence else [],
                   'qualification': 'Failure retained without replacing any existing file or authorizing measurement.'}
        if perf is not None and perf.is_dir():
            path = perf / ('readiness-failure-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ-') + uuid.uuid4().hex + '.json')
            try:
                write_exclusive(confined(path), failure)
                failure['retainedFailure'] = path.relative_to(ROOT).as_posix()
            except Exception as retention_error:
                failure['retentionError'] = f'{type(retention_error).__name__}: {retention_error}'
        print(json.dumps({'status': 'failed', 'error': failure['error'], 'retainedFailure': failure.get('retainedFailure'),
                          'retentionError': failure.get('retentionError'), 'measurementAuthorized': False}), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
