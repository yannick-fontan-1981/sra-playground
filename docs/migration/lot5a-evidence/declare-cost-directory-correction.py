#!/usr/bin/env python3
"""Bind a separate, post-measurement correction of one contradictory directory guard.

Usage: python -B SCRIPT PERFORMANCE_DIRECTORY
No analysis, runtime or measurement is executed. Original frozen tools and all
premeasurement evidence remain unchanged. Source checks compare real bytes/ASTs.
"""
from datetime import datetime, timezone
from pathlib import Path
import argparse
import ast
import difflib
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot5a-evidence'
EXACT_DIRECTORY = 'docs/migration/lot5a-evidence/performance'


def fingerprint(path):
    path = path.resolve()
    assert path.is_relative_to(ROOT)
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def read(path):
    return json.loads(path.read_bytes())


def verify(record):
    assert fingerprint(ROOT / record['path']) == record, 'Frozen input changed: ' + record['path']


def section(text, first, last):
    assert text.count(first) == 1 and text.count(last) == 1
    return text[text.index(first):text.index(last)].rstrip()


def functions(tree):
    found = {}
    for item in tree.body:
        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            found[item.name] = item
        elif isinstance(item, ast.ClassDef):
            for child in item.body:
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    found[item.name + '.' + child.name] = child
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('performance_directory', type=Path)
    args = parser.parse_args()
    perf = (ROOT / args.performance_directory).resolve()
    assert perf == ROOT / EXACT_DIRECTORY
    output = perf / 'diagnostic/owner-cost-directory-correction-v1.json'
    patch = perf / 'diagnostic/owner-cost-directory-correction-v1.diff'
    assert not output.exists() and not patch.exists()
    assert not (perf / 'owner-growth-comparison.json').exists() and not (perf / 'owner-growth-review.json').exists()
    contract_path = perf / 'owner-growth-contract.json'
    contract = read(contract_path)
    assert contract['performanceDirectory'] == EXACT_DIRECTORY
    assert contract['declaration'] == fingerprint(perf / 'declaration.json')
    declaration = read(perf / 'declaration.json')
    assert declaration['ownerCostQualification']['tools'] == contract['tools']
    for record in contract['tools'].values():
        verify(record)
    window_path = perf / 'window.json'; window = read(window_path)
    assert window['status'] == window['finalIntegrity'] == 'passed'
    failure_path = perf / 'owner-growth-analysis-initial-failure.json'; failure = read(failure_path)
    assert failure['status'] == 'retained_actual_analysis_failure' and failure['exitCode'] == 1
    assert failure['reportedError']['error'] == 'A new lot 5A window directory is required'
    assert failure['generator'] == contract['tools']['consolidator']
    assert failure['contract'] == fingerprint(contract_path) and failure['window'] == fingerprint(window_path)
    verify(failure['log'])
    declared = {role: ROOT / record['path'] for role, record in contract['tools'].items()}
    executed = {'consolidator': BASE / 'consolidate-owner-costs-directory-v1.mjs',
                'reviewer': BASE / 'review-owner-costs-directory-v1.py'}
    old_js, new_js = declared['consolidator'].read_text(), executed['consolidator'].read_text()
    old_py, new_py = declared['reviewer'].read_text(), executed['reviewer'].read_text()
    checks = []

    def identical(language, name, left, right, mode):
        assert left == right, 'Source change outside correction: ' + name
        checks.append({'language': language, 'section': name, 'comparison': mode, 'passed': True,
                       'sha256': hashlib.sha256(left.encode()).hexdigest()})

    identical('JavaScript', 'rules_constants_and_existing_readers',
              section(old_js, 'const HISTORICAL = ', 'function instant('),
              section(new_js, 'const HISTORICAL = ', 'async function loadDirectoryCorrection('), 'byte_identical')
    identical('JavaScript', 'all_existing_pure_and_raw_validation_functions',
              section(old_js, 'function instant(', 'async function main()'),
              section(new_js, 'function instant(', 'async function main()'), 'byte_identical')
    identical('JavaScript', 'all_original_protocol_work_cohort_pooling_and_global_loops',
              section(old_js, '  const history = ', '  const report = {'),
              section(new_js, '  const history = ', '  const report = {'), 'byte_identical')
    identical('JavaScript', 'all_output_metrics_methods_counts_and_verdicts',
              section(old_js, '    method: { selectedCohort:', '    qualification: '),
              section(new_js, '    method: { selectedCohort:', '    qualification: '), 'byte_identical')
    old_functions, new_functions = functions(ast.parse(old_py)), functions(ast.parse(new_py))
    for name, original in old_functions.items():
        if name in ['Review.load_protocol', 'Review.finish', 'main']:
            continue
        assert name in new_functions
        identical('Python', name, ast.dump(original, include_attributes=False),
                  ast.dump(new_functions[name], include_attributes=False), 'ast_identical_without_source_positions')
    assert set(new_functions) - set(old_functions) == {'Review.load_directory_correction'}
    original_guard = "assert.ok(perf.startsWith(EVIDENCE) && perf !== EVIDENCE + 'performance', 'A new lot 5A window directory is required');"
    corrected_guard = "assert.equal(perf, EXACT_PERFORMANCE_DIRECTORY, 'Only the exact already-declared lot 5A directory is admitted');"
    assert original_guard in old_js and original_guard not in new_js and corrected_guard in new_js
    diff = ''.join(difflib.unified_diff(old_js.splitlines(keepends=True), new_js.splitlines(keepends=True),
                                      fromfile=contract['tools']['consolidator']['path'],
                                      tofile=executed['consolidator'].relative_to(ROOT).as_posix()))
    diff += ''.join(difflib.unified_diff(old_py.splitlines(keepends=True), new_py.splitlines(keepends=True),
                                       fromfile=contract['tools']['reviewer']['path'],
                                       tofile=executed['reviewer'].relative_to(ROOT).as_posix()))
    with patch.open('x') as stream:
        stream.write(diff)
    names = ['owner-growth-contract.json', 'declaration.json', 'readiness.json', 'static-preflight.json',
             'window.json', 'aggregation-failure.json', 'aggregation-failure.log',
             'owner-growth-analysis-initial-failure.json', 'owner-growth-comparison.log',
             'owner-structural-fixture.json', 'owner-structural-attribution-v2.json',
             'shared-fragment-premeasurement-supplement.json', 'owner-source-inventory.json']
    names += [f'cohort{index}/{name}.json' for index in [1, 2] for name in ['baseline', 'after', 'comparison']]
    inputs = [fingerprint(perf / name) for name in names]
    inputs += [fingerprint(patch), fingerprint(Path(__file__))]
    now = datetime.now(timezone.utc).isoformat()
    instant = lambda text: datetime.fromisoformat(text.replace('Z', '+00:00'))
    assert instant(window['finishedAt']) <= instant(failure['recordedAt']) <= instant(now)
    result = {
        'schema': 'logos-engine.lot5a-owner-cost-io-correction.v1',
        'status': 'declared_post_measurement_io_correction', 'recordedAt': now,
        'postMeasurement': True, 'scope': 'exact_predeclared_performance_directory_only',
        'allowedPerformanceDirectory': EXACT_DIRECTORY,
        'contract': fingerprint(contract_path), 'declaration': contract['declaration'],
        'window': fingerprint(window_path), 'originalFailure': fingerprint(failure_path),
        'declaredTools': contract['tools'], 'executedTools': {role: fingerprint(path) for role, path in executed.items()},
        'rulesChanged': False, 'calculationsChanged': False, 'rawInputsRewritten': False,
        'sourceChecks': checks, 'patch': fingerprint(patch), 'boundInputs': inputs,
        'originalDirectoryGuard': original_guard, 'correctedDirectoryGuard': corrected_guard,
        'executionPerformedByThisCorrection': False,
        'qualification': 'The original frozen JavaScript consolidator actually rejected the literal performance directory that its own premeasurement declaration and contract already bind. The separate executed variant admits only that exact existing directory; it does not admit another directory or change any reader, structural allowance, arithmetic, sample, phase or global rule. The independent Python variant changes only correction and declared/executed generator provenance; its arithmetic and data checks remain unchanged. Original tools, declaration, readiness, window, retained failures and raw reports remain intact. This correction is explicitly post-measurement and still requires independent diff review and real execution.'
    }
    for record in inputs + list(contract['tools'].values()) + list(result['executedTools'].values()):
        verify(record)
    with output.open('x') as stream:
        stream.write(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': result['status'], 'scope': result['scope'], 'sourceChecks': len(checks),
                      'receipt': fingerprint(output), 'patch': fingerprint(patch), 'measurementExecuted': False}))


if __name__ == '__main__':
    main()
