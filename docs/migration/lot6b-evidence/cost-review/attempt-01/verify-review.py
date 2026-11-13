#!/usr/bin/env python3
"""Retain this bounded static review; never execute an audited tool or runtime."""
from __future__ import annotations

import ast
from datetime import datetime, timezone
import difflib
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
BASE = HERE.parents[1]
ROOT = BASE.parents[2]
ORIGINAL = Path('/workspace/sites/sra-lot6a-recovery-20261111/.sites-checkout')
NAMES = ['capture-cost-owner-graphs.mjs', 'record-owner-source-inventory.mjs',
         'qualify-cost-owner-graphs.mjs', 'finalize-owner-cost-contract.py',
         'prepare-cost-protocol.py', 'check-cost-static-inputs.py',
         'consolidate-owner-costs.mjs', 'review-owner-costs.py',
         'record-cost-log-transport.py', 'write-cost-results.py', 'finalize-measured-cost.py']


def stamp():
    return datetime.now(timezone.utc).isoformat()


def fp(path):
    data = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def write_new(path, value):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')


def main():
    started = stamp()
    statuses = {}
    for name in ('lot7-followup-status.json', 'lot10b-status.json', 'lot5c-status.json', 'lot6b-status.json'):
        value = json.loads((Path('/workspace/shared/sra-coordination') / name).read_text())
        statuses[name] = value
    write_new(HERE / 'coordination-before-syntax.json', {'recordedAt': started, 'statuses': statuses})
    if any(value.get(key) is True for value in statuses.values()
           for key in ('quiet_requested', 'performance_started', 'performance_lock_held')):
        write_new(HERE / 'blocked-no-syntax.json', {'status': 'blocked_by_fresh_quiet_request',
                  'recordedAt': stamp(), 'executionStarted': False})
        return 75

    before = json.loads((HERE / 'inputs-before.json').read_text())
    expected = {row['file']: row for row in before['files']}
    checks, files, commands = [], [], []

    def check(name, condition, **details):
        checks.append({'name': name, 'passed': bool(condition), **details})

    for directory in ('review-diffs', 'final-derivation-diffs'):
        (HERE / directory).mkdir(exist_ok=False)
    for name in NAMES:
        current = BASE / name
        original = ORIGINAL / 'docs/migration/lot6a-evidence' / name
        retained = ROOT / 'docs/migration/lot6a-evidence' / name
        check('immutable_6A_original/' + name, fp(original) == expected[name]['original6A'])
        check('retained_6A_copy/' + name, retained.read_bytes() == original.read_bytes())
        check('preserved_initial_draft/' + name,
              fp(HERE / 'before' / name)['sha256'] == expected[name]['before']['sha256'])
        text = current.read_text()
        forbidden = [term for term in ('V6Bgent', 'preview_packing', 'PreviewPacking', 'packing_model',
                     'packing_controls', 'packing_events', '_packing_scene_cache', 'PREVIEW_POLICY') if term in text]
        check('no_wrong_owner_or_replacement_residue/' + name, not forbidden, forbidden=forbidden)
        for directory, old, label in (
            ('review-diffs', HERE / 'before' / name, '6b-before-review'),
            ('final-derivation-diffs', original, 'immutable-6a')):
            diff = ''.join(difflib.unified_diff(old.read_text().splitlines(True), text.splitlines(True),
                           fromfile=label + '/' + name, tofile='6b-reviewed/' + name))
            with (HERE / directory / (name + '.diff')).open('x') as stream:
                stream.write(diff)
        if name.endswith('.py'):
            try:
                ast.parse(text, filename=str(current))
                check('python_AST/' + name, True)
            except SyntaxError as error:
                check('python_AST/' + name, False, error=str(error))
        else:
            command = ['node', '--check', str(current)]
            command_start = stamp()
            completed = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
            log = HERE / (name + '.syntax.log')
            with log.open('x') as stream:
                stream.write(completed.stdout)
                stream.write(completed.stderr)
            commands.append({'command': command, 'startedAt': command_start, 'finishedAt': stamp(),
                             'exitCode': completed.returncode, 'log': fp(log)})
            check('node_syntax/' + name, completed.returncode == 0)
        files.append({'file': name, 'original6A': fp(original), 'before': expected[name]['before'],
                      'after': fp(current), 'reviewDiff': fp(HERE / 'review-diffs' / (name + '.diff')),
                      'completeDerivationDiff': fp(HERE / 'final-derivation-diffs' / (name + '.diff'))})

    def functions(path):
        tree = ast.parse(path.read_text())
        result = {}
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                result[node.name] = ast.dump(node, include_attributes=False)
            if isinstance(node, ast.ClassDef):
                for method in node.body:
                    if isinstance(method, ast.FunctionDef):
                        result[node.name + '.' + method.name] = ast.dump(method, include_attributes=False)
        return result

    py_names = ['same', 'numeric', 'distribution', 'samples', 'calculate', 'metric', 'unresolved_for',
                'within_decimal', 'work', 'functional_shape', 'Review.load_window', 'Review.structural_pair',
                'Review.verify_structure_and_ledgers', 'Review.verify_historical_failure', 'Review.recalculate']
    old_py = functions(HERE / 'original-6a/review-owner-costs.py')
    new_py = functions(BASE / 'review-owner-costs.py')
    for name in py_names:
        check('python_arithmetic_population_signature_unchanged/' + name, old_py[name] == new_py[name])

    def js_function(text, name):
        match = re.search(r'^(?:export )?(?:async )?function ' + re.escape(name) + r'\(', text, re.M)
        if not match:
            raise ValueError('Missing retained function: ' + name)
        end = re.search(r'^}\n', text[match.start():], re.M)
        if not end:
            raise ValueError('Missing function end: ' + name)
        return text[match.start():match.start() + end.end()]

    js_names = ['unresolvedFor', 'strictDecimalBudget', 'canonical', 'functionalShape',
                'structuralExpectations', 'compareQualifiedStructure', 'compareOwnerWork',
                'distribution', 'valuesFor', 'metricFor', 'comparisonMetrics', 'workSignature', 'validateTrial']
    old_js = (HERE / 'original-6a/consolidate-owner-costs.mjs').read_text()
    new_js = (BASE / 'consolidate-owner-costs.mjs').read_text()
    for name in js_names:
        check('javascript_arithmetic_population_signature_unchanged/' + name,
              js_function(old_js, name) == js_function(new_js, name))

    history = json.loads((ROOT / 'docs/migration/lot3h-evidence/performance/declaration.json').read_text())
    central = history['officialTools'] + [history['globalDecisionTool'], history['globalCalculationTool']]
    check('exact_seven_retained_central_tools', len(central) == len({row['path'] for row in central}) == 7)
    for record in central:
        check('central_tool_byte_identity/' + record['path'], fp(ROOT / record['path']) == record)

    for file in files:
        check('reviewed_tool_unchanged_during_syntax/' + file['file'], fp(BASE / file['file']) == file['after'])
    receipt = {
        'schema': 'logos-engine.lot6b-cost-tools-static-review.v1', 'startedAt': started, 'finishedAt': stamp(),
        'status': 'static_review_complete' if all(row['passed'] for row in checks) else 'static_review_failed',
        'generator': fp(Path(__file__)), 'sourcePin': '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e',
        'inputsBefore': fp(HERE / 'inputs-before.json'), 'coordination': fp(HERE / 'coordination-before-syntax.json'),
        'reviewNotes': fp(HERE / 'review.md'), 'files': files, 'commands': commands,
        'checkedCount': len(checks), 'checks': checks, 'syntax': {'pythonASTFiles': 7, 'nodeCheckFiles': 4},
        'arithmeticComparison': {'pythonASTFunctions': py_names, 'javascriptExactFunctions': js_names},
        'centralTools': central, 'costCaptureExecuted': False, 'performanceMeasured': False,
        'runtimeImported': False, 'gameExecuted': False, 'testsExecuted': False, 'buildExecuted': False,
        'functionalQualification': 'pending_real_frozen_0.63_baseline_and_final_0.64_captures',
        'noFuturePassAsserted': True,
        'qualification': 'Text audit plus Python AST parsing and Node --check only. The 11 cost tools were not executed. '
            'Six-A sources remain byte-identical. Arithmetic, population, strict failure handling and measured signatures '
            'listed here retain their exact source/AST; all seven central tools retain their historical bytes. '
            'New six-B common-value equality is a stricter prospective contract and does not reinterpret the explicit '
            'limited scope of six-A. No published 0.63 baseline, actual graph attribution, real cost window, global '
            'acceptance, runtime parity or successful future qualification is asserted.'}
    write_new(HERE / 'review.json', receipt)
    print(json.dumps({'status': receipt['status'], 'checks': len(checks), 'passed': sum(row['passed'] for row in checks),
                      'syntax': receipt['syntax'], 'receipt': fp(HERE / 'review.json'),
                      'failures': [row for row in checks if not row['passed']]}))
    return 0 if receipt['status'] == 'static_review_complete' else 1


if __name__ == '__main__':
    raise SystemExit(main())
