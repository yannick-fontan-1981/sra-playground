#!/usr/bin/env python3
"""Read-only v3 source/path and documentary preparation verification.

This does not call finalize(), main(), a native runtime or a benchmark. Only the
preparation receipt reader runs; process creation is disabled during validation.
Its temporary result is retained as source-only evidence, never readiness.
"""
import ast
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[5]
PLANNING = Path(__file__).resolve().parent
PERF = ROOT / 'docs/migration/lot5c-evidence/recovery/performance-integrated-04'

def fp(path):
    path = Path(path)
    h = hashlib.sha256(); size = 0
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b''):
            h.update(chunk); size += len(chunk)
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': size, 'sha256': h.hexdigest()}

def load(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), PLANNING / name)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

def definitions(path):
    return {node.name: node for node in ast.parse(path.read_text()).body
            if isinstance(node, (ast.FunctionDef, ast.ClassDef))}

def main():
    output = PLANNING / 'v3-source-documentary-validation.json'
    if output.exists():
        raise FileExistsError(output)
    started = datetime.now(timezone.utc)
    sources = [PLANNING / name for name in ('run-coordinated-cost-5c-v2.py',
        'run-coordinated-cost-5c-v3.py', 'finalize-readiness-5c-v2.py',
        'finalize-readiness-5c-v3.py', 'cost-process-control-v2.py',
        'v3-verify-source-and-documentary-bindings.py', 'v3-source-substitutions.json')]
    before = [fp(path) for path in sources]
    checks = []
    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        checks.append({'id': name, 'passed': True})
    def blocked(*args, **kwargs):
        raise AssertionError('Process creation is forbidden during documentary validation')
    subprocess.Popen = blocked
    ctrl = load('run-coordinated-cost-5c-v3.py')
    finalizer = load('finalize-readiness-5c-v3.py')
    finalizer.finalize = blocked
    finalizer.main = blocked
    check('exact_new_request', ctrl.REQUEST == finalizer.REQUEST == 'lot5c-cost-a33a5f88-available-03')
    check('exact_performance04', ctrl.PERF == finalizer.PERF == PERF)
    check('exact_coordination03', ctrl.COORD == finalizer.COORD == ROOT / 'docs/migration/lot5c-evidence/recovery/coordination/cost-final-03')
    check('exact_parent_v3', finalizer.ORCHESTRATOR == PLANNING / 'orchestrate-cost-available-03.py')
    check('exact_global_review_v3', finalizer.GLOBAL_REVIEW == PLANNING / 'coordination-v3-independent-review.json')
    check('exact_child_registry03', str(ctrl.REGISTRY_PATH) == '/workspace/shared/sra-coordination/lot5c-available-03-active-children.json')
    check('same_existing_mutex', ctrl.EXPECTED_LOCK_IDENTITY == (27, 1971854))
    check('same_process_helper', ctrl.HELPER == finalizer.PROCESS_HELPER == PLANNING / 'cost-process-control-v2.py'
        and fp(ctrl.HELPER)['sha256'] == '7e5fa20cdc5590cb28fdfbda24a9f493ec3e24534b9866fa366221a1a3a5a24c')
    old = definitions(PLANNING / 'run-coordinated-cost-5c-v2.py')
    new = definitions(PLANNING / 'run-coordinated-cost-5c-v3.py')
    check('all_controller_bodies_unchanged', set(old) == set(new)
        and all(ast.dump(old[k], include_attributes=False) == ast.dump(new[k], include_attributes=False) for k in old))
    old = definitions(PLANNING / 'finalize-readiness-5c-v2.py')
    new = definitions(PLANNING / 'finalize-readiness-5c-v3.py')
    for name in ('Evidence', 'unmeasured', 'load_verifier', 'native_inventory', 'native_version',
                 'formal', 'regressions', 'common', 'browser', 'preparation_02'):
        check('unchanged_reader_' + name, ast.dump(old[name], include_attributes=False) == ast.dump(new[name], include_attributes=False))
    substitutions = json.loads((PLANNING / 'v3-source-substitutions.json').read_bytes())
    expected = (PLANNING / 'run-coordinated-cost-5c-v2.py').read_text()
    for item in substitutions['controllerLiteralSubstitutions']:
        check('single_substitution_' + item['before'].split(' = ')[0], expected.count(item['before']) == 1)
        expected = expected.replace(item['before'], item['after'])
    check('controller_exact_four_substitutions_only', expected == (PLANNING / 'run-coordinated-cost-5c-v3.py').read_text())
    check('documentary_predecessor03_anchor02', finalizer.PRIOR == PERF.with_name('performance-integrated-03')
        and finalizer.SOURCE_PRIOR == PERF.with_name('performance-integrated-02'))
    evidence = finalizer.Evidence(finalizer.BASELINE, datetime.now(timezone.utc))
    declaration = evidence.read(PERF / 'declaration.json')
    source = evidence.read(declaration['candidateManifest']['path'])
    baseline = evidence.read(declaration['baselineManifest']['path'])
    contract, facts = finalizer.preparation(evidence, PERF, declaration, source, baseline)
    check('actual04_documentary_preparation_reader_passed', facts['staticChecks'] == 76
        and facts['independentChecks'] == 84 and facts['historical03Preservation']['fileCount'] == 23
        and facts['historical02Preservation']['fileCount'] == 44
        and facts['oldReadinessReusedAsActive'] is False)
    evidence.recheck()
    check('all_observed_documentary_inputs_unchanged', before == [fp(path) for path in sources])
    check('no_current_readiness_or_window', not any((PERF / name).exists() for name in
        ('readiness.json', 'window.json', 'owner-growth-comparison.json', 'owner-growth-review.json')))
    result = {'schema': 'logos-engine.lot5c-v3-source-documentary-validation.v1', 'status': 'passed',
        'startedAt': started.isoformat(), 'finishedAt': datetime.now(timezone.utc).isoformat(),
        'checksPassed': len(checks), 'checksTotal': len(checks), 'checks': checks, 'sources': before,
        'documentaryInputsVerified': len(evidence.records), 'ownerContract': contract,
        'actualPreparationFacts': facts, 'runtimeProcessCreationDisabled': True,
        'fullReadinessFinalizerInvoked': False, 'readinessCreated': False, 'quietRequestIssued': False,
        'measurementExecuted': False, 'newNativeProofExecuted': False,
        'qualification': 'Pure source/path checks and the source-only documentary preparation reader. Its original02 proof checks and new03/04 bindings are verified without calling finalize/main or any process. Unchanged lifecycle bodies retain their prior temporary tests; no production mutex or peer status is changed.'}
    with tempfile.TemporaryDirectory(prefix='lot5c-v3-SOURCE-ONLY-') as directory:
        temporary = Path(directory) / 'result.json'
        temporary.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
        with output.open('xb') as stream:
            stream.write(temporary.read_bytes())
    print(json.dumps({'status': 'passed', 'checksPassed': len(checks), 'checksTotal': len(checks),
        'documentaryInputsVerified': len(evidence.records), 'readinessCreated': False,
        'measurementExecuted': False, 'receipt': fp(output)}))

if __name__ == '__main__':
    main()
