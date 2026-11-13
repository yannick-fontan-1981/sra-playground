#!/usr/bin/env python3
"""Local validators against retained evidence; no full consumer CLI or runtime."""
from pathlib import Path
from datetime import datetime, timezone
import copy, hashlib, importlib.util, json, subprocess, sys, traceback
HERE = Path(__file__).resolve().parent
EVIDENCE = HERE.parents[2]
ROOT = EVIDENCE.parents[2]
ATTRIBUTION = HERE.parent / 'qualified-functional-attribution.json'
FIXTURE = HERE.parent / 'qualified-functional-fixture.json'
OUTPUT = HERE / 'retained-attribution-local-result-01.json'

def read(path):
    return json.loads(path.read_bytes())

def verify(record):
    path = ROOT / record['path']
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            digest.update(chunk)
    if path.stat().st_size != record['bytes'] or digest.hexdigest() != record['sha256']:
        raise ValueError('Retained fingerprint differs: ' + record['path'])

def main():
    if OUTPUT.exists():
        raise FileExistsError(OUTPUT)
    started = datetime.now(timezone.utc).isoformat()
    attribution, fixture = read(ATTRIBUTION), read(FIXTURE)
    if (ROOT / fixture['attribution']['path']).resolve() != ATTRIBUTION.resolve():
        raise ValueError('Fixture binds another attribution')
    verify(fixture['attribution'])
    for record in attribution['inputs']:
        verify(record)
    receipts = {}
    for role in ('baseline', 'candidate'):
        for record in fixture['captures'][role].values():
            verify(record)
        receipts[role] = read(ROOT / fixture['captures'][role]['receipt']['path'])
    rows = []
    for index, name in enumerate(('finalize-owner-cost-contract.py', 'check-cost-static-inputs.py', 'review-owner-costs.py')):
        data = copy.deepcopy({'attribution': attribution, 'receipts': receipts, 'fixture': fixture})
        retained = copy.deepcopy(data)
        try:
            spec = importlib.util.spec_from_file_location('retained_downstream_' + str(index), EVIDENCE / name)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            value = module.validate_common_value_attribution(data['attribution'], data['receipts'], data['fixture'])
            if value is not True or data != retained:
                raise AssertionError('Validator did not return true without modifying evidence')
            rows.append({'consumer': name, 'passed': True, 'evidenceUnchanged': True})
        except Exception as error:
            rows.append({'consumer': name, 'passed': False, 'evidenceUnchanged': data == retained,
                         'error': type(error).__name__ + ': ' + str(error), 'traceback': traceback.format_exc()})
    command = ['node', str(HERE / 'validate-retained-attribution-01.mjs')]
    child = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
    try:
        node_row = json.loads(child.stdout)
        if not isinstance(node_row, dict) or node_row.get('consumer') != 'consolidate-owner-costs.mjs':
            raise ValueError('Unexpected Node validator result')
    except Exception as error:
        node_row = {'consumer': 'consolidate-owner-costs.mjs', 'passed': False,
                    'error': type(error).__name__ + ': ' + str(error)}
    node_row.update({'exitCode': child.returncode, 'stdout': child.stdout, 'stderr': child.stderr})
    node_row['passed'] = node_row.get('passed') is True and child.returncode == 0
    rows.append(node_row)
    passed = len(rows) == 4 and all(row['passed'] is True and row.get('evidenceUnchanged') is True for row in rows)
    result = {'schema': 'logos-engine.lot6b-retained-attribution-local-compatibility.v1',
              'status': 'local_compatibility_passed' if passed else 'local_compatibility_failed',
              'startedAt': started, 'finishedAt': datetime.now(timezone.utc).isoformat(),
              'nativeDigests': attribution['nativeDigests'], 'consumers': rows,
              'forms': len(fixture['forms']), 'points': len(attribution['points']),
              'commonValueCoverage': len(attribution['commonValueCoverage']),
              'temporalRecords': len(attribution['commonValuePolicy']['traceCreatedAttribution']['records']),
              'attributionFailures': attribution['failures'], 'fingerprintedAttributionInputsVerified': len(attribution['inputs']),
              'fullConsumerCliExecuted': False, 'graphBodiesRequalified': False,
              'contractFinalized': False, 'preflightExecuted': False, 'officialCostExecuted': False,
              'nativeImported': False, 'publicationProvenance': 'provisional805b/a33 against fa23/322; no actual published predecessor claimed',
              'proofBoundary': 'Local function compatibility with exact retained attribution/fixture/receipts. Graph traversal, other bodies and chains/tickets are not replayed. Semantic ValueError remains a refusal, not a negative static-preflight JSON receipt.'}
    with OUTPUT.open('x') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'consumers'}, ensure_ascii=False))
    for row in rows:
        print(json.dumps(row, ensure_ascii=False))
    raise SystemExit(0 if passed else 1)

if __name__ == '__main__':
    main()
