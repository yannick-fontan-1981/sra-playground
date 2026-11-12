#!/usr/bin/env python3
"""Freeze the reviewed final9A functional tools before any session is created."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
BASE = ROOT / 'docs/migration/lot9a-evidence'
STAGE = BASE / 'delivery-final-068-01'
TOOLS = BASE / 'tools/delivery'
REFERENCE = ROOT / 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6'


def rel(path):
    return str(path.relative_to(ROOT))


def pin(path):
    return {'path': rel(path), 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def save(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n')


def command(argv, timeout, sessions=0, returns=0, dependencies=None):
    return {'argv': argv, 'timeoutSeconds': timeout, 'maximumAttempts': 2,
            'maximumCumulativeSeconds': 2 * timeout, 'maximumSessionsPerLaunch': sessions,
            'maximumReturnsPerLaunch': returns, 'maximumSessionsCumulative': 2 * sessions,
            'maximumReturnsCumulative': 2 * returns, 'dependencies': dependencies or []}


def main():
    work = TOOLS / 'work-forms'
    common = TOOLS / 'chart-common'
    for name in ['record-owner-source-inventory.mjs', 'capture-cost-owner-graphs.mjs',
                 'qualify-cost-owner-graphs.mjs', 'provenance.json']:
        assert (work / name).is_file(), name
    for name in ['capture.mjs', 'qualify.mjs', 'preparation-plan.json', 'provenance.json']:
        assert (common / name).is_file(), name
    reference_declarations = [REFERENCE / 'laya_proto/common_frontier_policy.drm.json',
                              REFERENCE / 'morphology_policy/strategy.drm']
    common_inputs = [p for p in common.rglob('*') if p.is_file()]
    common_inputs += [STAGE / 'candidate-native.json', BASE / 'reference-01/reference.json.gz',
                      ROOT / 'tests/v6-chart-navigation-kernel.test.ts', *reference_declarations]
    common_declaration = json.loads((common / 'preparation-plan.json').read_text())['declarationTemplate']
    common_declaration['allowExecution'] = True
    common_declaration['declaredAt'] = datetime.now(timezone.utc).isoformat()
    common_declaration['inputPins'] = [pin(p) for p in sorted(common_inputs)]
    save(STAGE / 'common-declaration.json', common_declaration)

    native = json.loads((STAGE / 'candidate-native.json').read_text())
    inputs = {ROOT / name for name in native['files']}
    inputs.update(p for p in TOOLS.rglob('*') if p.is_file())
    inputs.update(reference_declarations)
    inputs.update(common_inputs)
    inputs.update([STAGE / name for name in ['baseline-native.json', 'candidate-native.json',
                  'prior-candidate-native.json', 'identity-reconciliation.json', 'protocol.md', 'common-declaration.json']])
    cases = json.loads((work / 'cases.json').read_text())
    inputs.update(ROOT / row['trace'] for row in cases['cases'])
    # Retained originals are immutable derivation inputs, not executable oracles.
    inputs.update(p for p in (ROOT / 'docs/migration/lot8b-evidence/tools/final-functional').rglob('*') if p.is_file())
    inputs.add(ROOT / 'docs/migration/lot8b-evidence/tools/delivery/work-forms/cases.json')
    inputs.add(ROOT / 'package.json')
    node = ['node', '--max-old-space-size=1536']
    path = rel(STAGE)
    inventory_output = path + '/work-inventory-01/owner-source-inventory.json'
    a = path + '/work-baseline-01/baseline.json.gz'
    ar = path + '/work-baseline-01/baseline.receipt.json'
    b = path + '/work-candidate-01/candidate.json.gz'
    br = path + '/work-candidate-01/candidate.receipt.json'
    commands = {
        'work-inventory': command(node + [rel(work / 'record-owner-source-inventory.mjs'), '{baseline}', '{root}', '{attempt}/owner-source-inventory.json'], 120),
        'work-baseline': command(node + [rel(work / 'capture-cost-owner-graphs.mjs'), 'baseline', '{baseline}', rel(work / 'cases.json'), path + '/baseline-native.json', '{attempt}/baseline.json.gz'], 300, 4, 31),
        'work-candidate': command(node + [rel(work / 'capture-cost-owner-graphs.mjs'), 'candidate', '{root}', rel(work / 'cases.json'), path + '/candidate-native.json', '{attempt}/candidate.json.gz'], 300, 4, 31),
        'work-qualify': command(node + [rel(work / 'qualify-cost-owner-graphs.mjs'), inventory_output, a, ar, b, br, '{attempt}/graph-review.json', '{attempt}/work-forms.json'], 300, dependencies=[inventory_output, a, ar, b, br]),
        'common-capture': command(node + [rel(common / 'capture.mjs'), '--declaration', path + '/common-declaration.json', '--output', '{attempt}/capture'], 300, 5, 9),
        'common-qualify': command(node + [rel(common / 'qualify.mjs'), '--capture', path + '/common-capture-01/capture', '--output', '{attempt}/review'], 240),
    }
    plan = {'schema': 'logos-engine.lot9a.functional-execution-plan.v1',
            'declaredAt': datetime.now(timezone.utc).isoformat(),
            'baselineCheckout': '/workspace/sites/sra-lot9a-baseline067-20261112',
            'inputFiles': [pin(p) for p in sorted(inputs)], 'commands': commands,
            'plannedNew': {'initializedSessions': 13, 'physicalReturns': 71},
            'maximumNewIncludingCorrectiveCaptures': {'initializedSessions': 26, 'physicalReturns': 142},
            'priorConsumedCommon': {'initializedSessions': 10, 'physicalReturns': 14, 'registrationOnlyFactories': 2,
                'source': 'integration-runs/chart-common-01 and chart-common-02; first failed attempt retained',
                'reservation': 'Historical maximumSessions8 lacked per-launch/cumulative scope; not retroactively repaired.'},
            'plannedIncludingPriorCommon': {'initializedSessions': 23, 'physicalReturns': 85},
            'maximumIncludingPriorCommon': {'initializedSessions': 36, 'physicalReturns': 156},
            'noAutomaticRetries': True, 'allAttemptsRetained': True, 'globalLockRequired': False,
            'officialPerformanceEligible': False, 'publicWorkerQualifiedByThisPlan': False,
            'originalOracleExecuted': False, 'gameEngineExecuted': False, 'LKEY': 'permanently_closed',
            'scope': 'Final identity direct-service work forms plus NativeV6Runtime Chart common graphs. Synthetic/retained observations; no new game success or official cost.'}
    save(STAGE / 'execution-plan.json', plan)
    print(json.dumps({'status': 'frozen', 'inputFiles': len(inputs), 'commands': list(commands),
                      'plannedSessions': 13, 'plannedReturns': 71, 'nativeCodeExecuted': False}))


if __name__ == '__main__':
    main()
