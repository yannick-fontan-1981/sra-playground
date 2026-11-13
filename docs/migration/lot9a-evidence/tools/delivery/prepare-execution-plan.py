#!/usr/bin/env python3
"""Freeze the reviewed final9A functional tools before any session is created."""
from datetime import datetime, timezone
import argparse
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scope', choices=['work', 'common', 'all'], default='all')
    args = parser.parse_args()
    work = TOOLS / 'work-forms'
    common = TOOLS / 'chart-common'
    if args.scope in ['work', 'all']:
        for name in ['record-owner-source-inventory.mjs', 'capture-cost-owner-graphs.mjs',
                     'qualify-cost-owner-graphs.mjs', 'provenance.json']:
            assert (work / name).is_file(), name
    if args.scope in ['common', 'all']:
        for name in ['capture.mjs', 'qualify.mjs', 'preparation-plan.json', 'provenance.json']:
            assert (common / name).is_file(), name
    reference_declarations = [REFERENCE / 'laya_proto/common_frontier_policy.drm.json',
                              REFERENCE / 'morphology_policy/strategy.drm']
    common_inputs = []
    if args.scope in ['common', 'all']:
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
    inputs.update(p for p in TOOLS.iterdir() if p.is_file())
    if args.scope in ['work', 'all']:
        inputs.update(p for p in work.rglob('*') if p.is_file())
    inputs.update(reference_declarations)
    inputs.update(common_inputs)
    inputs.update([STAGE / name for name in ['baseline-native.json', 'candidate-native.json',
                  'prior-candidate-native.json', 'identity-reconciliation.json', 'protocol.md']])
    if args.scope in ['common', 'all']:
        inputs.add(STAGE / 'common-declaration.json')
    if args.scope in ['work', 'all']:
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
        'common-qualify': command(node + [rel(common / 'qualify.mjs'), '--capture', path + '/common-capture-01/capture', '--output', '{attempt}/review'], 240,
            dependencies=[path + '/common-capture-01/capture/receipt.json', path + '/common-capture-01/capture/events.jsonl.gz']),
    }
    for key, specification in commands.items():
        specification['budgetKey'] = key
    if args.scope != 'all':
        commands = {key: value for key, value in commands.items() if key.startswith(args.scope + '-')}
    plan = {'schema': 'logos-engine.lot9a.functional-execution-plan.v1',
            'declaredAt': datetime.now(timezone.utc).isoformat(),
            'baselineCheckout': '/workspace/sites/sra-lot9a-baseline067-20261112',
            'inputFiles': [pin(p) for p in sorted(inputs)], 'commands': commands,
            'scope': args.scope,
            'plannedThisPlan': {'work': {'initializedSessions': 8, 'physicalReturns': 62},
                'common': {'initializedSessions': 5, 'physicalReturns': 9},
                'all': {'initializedSessions': 13, 'physicalReturns': 71}}[args.scope],
            'plannedNew': {'initializedSessions': 13, 'physicalReturns': 71},
            'maximumNewIncludingCorrectiveCaptures': {'initializedSessions': 26, 'physicalReturns': 142},
            'priorConsumedCommon': {'initializedSessions': 10, 'physicalReturns': 14, 'registrationOnlyFactories': 2,
                'source': 'integration-runs/chart-common-01 and chart-common-02; first failed attempt retained',
                'reservation': 'Historical maximumSessions8 lacked per-launch/cumulative scope; not retroactively repaired.'},
            'plannedIncludingPriorCommon': {'initializedSessions': 23, 'physicalReturns': 85},
            'maximumIncludingPriorCommon': {'initializedSessions': 36, 'physicalReturns': 156},
            'noAutomaticRetries': True, 'allAttemptsRetained': True, 'globalLockRequired': False,
            'correctivePlanPolicy': 'All initial reader paths select attempt01 explicitly. If an observed defect requires a corrective capture or reader, retain this plan, the failed outputs and the original tools. Freeze a separate prospective amendment with exact new paths, changed tool fingerprints and correction reason before execution. Keep each original budgetKey, maximumAttempts and maximumCumulativeSeconds unchanged so the supervisor includes all prior launches. Never autodiscover or silently prefer a passing attempt.',
            'commonGraphDependencies': 'The supervisor pins the capture receipt and compressed events before/after qualification. The receipt binds every full graph blob by path, compressed SHA and raw SHA. The common reader independently verifies these exact blobs and their before/after fingerprints.',
            'officialPerformanceEligible': False, 'publicWorkerQualifiedByThisPlan': False,
            'originalOracleExecuted': False, 'gameEngineExecuted': False, 'LKEY': 'permanently_closed',
            'qualificationScope': 'Final identity direct-service work forms plus NativeV6Runtime Chart common graphs. Synthetic/retained observations; no new game success or official cost.'}
    save(STAGE / (('' if args.scope == 'all' else args.scope + '-') + 'execution-plan.json'), plan)
    print(json.dumps({'status': 'frozen', 'scope': args.scope, 'inputFiles': len(inputs), 'commands': list(commands),
                      'plannedSessions': plan['plannedThisPlan']['initializedSessions'],
                      'plannedReturns': plan['plannedThisPlan']['physicalReturns'], 'nativeCodeExecuted': False}))


if __name__ == '__main__':
    main()
