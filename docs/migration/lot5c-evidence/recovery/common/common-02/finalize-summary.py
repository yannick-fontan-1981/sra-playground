#!/usr/bin/env python3
"""Close existing common-02 receipts without executing either runtime again."""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = next(p for p in Path(__file__).resolve().parents if (p / '.openai/hosting.json').exists())
OUT = Path(__file__).resolve().parent
REL = OUT.relative_to(ROOT).as_posix()
recorded_at = datetime.now(timezone.utc).isoformat()

def read(path):
    return json.loads((ROOT / path).read_text())

def save(name, value):
    with (OUT / name).open('x') as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

expected = {}

def retain(path, digest):
    assert path not in expected or expected[path] == digest, ('conflicting input', path)
    expected[path] = digest

manifest_path = f'{REL}-source/source-manifest.json'
manifest = read(manifest_path)
assert manifest['fileCount'] == len(manifest['files']) == 318
for path, digest in manifest['files'].items():
    retain(path, digest)
preservation = read(f'{REL}/execution-inputs.json')
for entry in preservation['inputs']:
    retain(entry['input']['path'], entry['input']['sha256'])
    retain(entry['preservedPath'], entry['input']['sha256'])

cases = []
for mode in ['positive', 'refutation', 'ambiguity', 'boundary']:
    comparison_path = f'{REL}/{mode}/original-comparison-per-case.json'
    export_path = f'{REL}/{mode}/original-export-per-case.json'
    comparison, export = read(comparison_path), read(export_path)
    assert comparison['status'] == export['status'] == 'passed'
    assert comparison['checks']['failed'] == 0
    assert comparison['checks']['total'] == comparison['checks']['passed']
    assert comparison['inputsUnchanged'] and export['sourceInventoryUnchanged']
    assert comparison['coldOriginal'] and not comparison['nativeResultsUsedAsOracleInputs']
    assert export['sourceFilesVerifiedBefore'] == export['sourceFilesVerifiedAfter'] == 1786
    assert export['sourceInventorySha256Before'] == export['sourceInventorySha256After']
    assert export['counts']['sourceExceptions'] == 0
    for entry in comparison['inputs'] + [export['exporter']]:
        retain(entry['path'], entry['sha256'])
    cases.append({
        'mode': mode, 'comparison': comparison_path, 'export': export_path,
        'checks': comparison['checks']['total'], 'passed': comparison['checks']['passed'],
        **{key: comparison[key] for key in ['operations', 'actualReturns', 'selectedReturns',
            'passiveReturns', 'sourceMemoryPuts', 'nativeMemoryPuts',
            'sourceStateRetentionChecks', 'sourceStateRetentions']},
        'sourceFilesVerifiedBefore': 1786, 'sourceFilesVerifiedAfter': 1786,
        'sourceInventoryUnchanged': True, 'reviewerInputsUnchanged': True,
        'sourceExceptions': 0,
    })

differences = []
for path, digest in expected.items():
    source = ROOT / path
    if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest() != digest:
        differences.append(path)
assert not differences, differences
integrity = {
    'schema': 'logos-engine.lot5c.common-final-input-integrity.v1',
    'status': 'passed', 'recordedAt': recorded_at,
    'sourceManifest': manifest_path, 'nativeFilesVerified': manifest['fileCount'],
    'frozenNativeDigest': manifest['digest'], 'uniqueInputsVerified': len(expected),
    'inputs': expected, 'differences': differences,
    'qualification': 'SHA-256 comparisons of the frozen native files, preserved pre-execution inputs, '
        'four executed original-reviewer input sets and original exporter. No runtime, game, '
        'test, build or performance measurement was executed by this closure.',
}
save('final-input-integrity.json', integrity)

native = read(f'{REL}/native-tests.execution.json')
assert native['status'] == 'passed' and native['exitCode'] == 0 and not native['timedOut']
native_log = (OUT / 'native-tests.log').read_text()
native_counts = {}
for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']:
    match = re.search(rf'^ℹ {key} (\d+)$', native_log, re.MULTILINE)
    assert match, key
    native_counts[key] = int(match.group(1))
assert native_counts == {'tests': 7, 'pass': 7, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}
totals = {key: sum(case[key] for case in cases) for key in [
    'checks', 'passed', 'operations', 'actualReturns', 'selectedReturns', 'passiveReturns',
    'sourceMemoryPuts', 'nativeMemoryPuts', 'sourceStateRetentionChecks', 'sourceStateRetentions',
    'sourceExceptions']}
assert totals['checks'] == totals['passed'] == 6818
assert totals['operations'] == 412 and totals['actualReturns'] == 80
summary = {
    'schema': 'logos-engine.lot5c.common-recovery-summary.v1',
    'recordedAt': recorded_at, 'status': 'passed_within_declared_scope',
    'baseCommit': 'd090c60aa07fb1ef7cb6e9a5b068840a3b81baec',
    'referenceCommit': '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e',
    'plan': f'{REL.rsplit("/", 1)[0]}/common-plan.json',
    'native': {'receipt': f'{REL}/native-tests.execution.json', **native_counts,
        'declaredScenarios': ['positive', 'refutation', 'ambiguity', 'boundary', 'foreign-parent',
            'passive-acquisition-bound', 'selected-acquisition-bound', 'level-clock-acquisition-bound'],
        'durationSeconds': native['durationSeconds']},
    'originalComparisons': cases, 'totals': totals,
    'sourceStateRetention': 'core_or_methods_memory_roundtrip',
    'integrity': f'{REL}/final-input-integrity.json',
    'retainedFailures': [
        {'receipt': f'{REL.rsplit("/", 1)[0]}/common-01/positive/original-comparison.json',
         'failed': 121, 'total': 1852,
         'cause': 'Original caller Memory.put/get/restore branch was absent from the first oracle.'},
        {'receipt': f'{REL}/positive/original-comparison.json', 'failed': 2, 'total': 1895,
         'cause': 'Batched export global retention counts80/80 were compared to one chain24/24.',
         'incident': f'{REL}/export-scope-incident.json',
         'correction': 'Re-export each unchanged native journal independently with the same exporter '
            'and reviewer, keeping separate per-case receipts. No native rerun or criteria change.'},
    ],
    'qualification': 'Eight declared common scenarios pass through seven native tests. The foreign-parent case uses an existing recorded LIFE public replay; the other cases use synthetic scenes. No new live game was launched. Only the '
        'four source scenarios are independently compared to original Python; foreign-parent and '
        'three acquisition-bound scenarios are additional native contracts. This is not full '
        'StrategyRouter parity, a live-game result, a performance verdict or publication.',
    'next': 'Reconcile actually published6A, follow-up7 and10B (including its clock-origin fix), '
        'then freeze and validate the final5C candidate, qualify cost differences, measure and '
        'review full-session cost, and publish after all declared gates pass.',
}
save('summary.json', summary)
print(json.dumps({'status': summary['status'], 'nativeTests': 7, 'declaredScenarios': 8,
    'totals': totals, 'nativeFilesVerified': 318, 'uniqueInputsVerified': len(expected)}))
