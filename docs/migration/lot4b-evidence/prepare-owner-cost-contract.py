#!/usr/bin/env python3
"""Close the prospective RelativeArrangements owner-cost contract before timing.

Reads completed untimed graph qualification, real owner/program inventory and
the actual frozen protocol identities. No runtime, source factory, capture,
measurement, test or game is executed. Outputs are exclusive.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot4b-evidence'
OWNER = 'relative_arrangements'
PROGRAM = 'v6.relative_arrangements.choose'
SOURCE_PATHS = ['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-relative-arrangements.ts',
                'src/logos-engine/v6-knowledge-store.ts']
EXPECTATION = {
    'ownerId': OWNER, 'programId': PROGRAM,
    'installedNodeIds': ['family_state:' + OWNER, 'family_activation:' + OWNER, 'program:' + PROGRAM],
    'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
    'mode': 'predeclared_functional_fixture', 'qualification': 'functional_structure_frozen_before_measurement',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def instant(value):
    stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(stamp.tzinfo is not None, 'Timestamp requires a timezone')
    return stamp


def fingerprint(path):
    path = (ROOT / path).resolve()
    hasher = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(chunk)
    return {'path': path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path),
            'bytes': path.stat().st_size, 'sha256': hasher.hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--performance-directory', type=Path, required=True)
    parser.add_argument('--owner-inventory', type=Path, required=True)
    parser.add_argument('--structural-fixture', type=Path, required=True)
    parser.add_argument('--finalize', action='store_true')
    args = parser.parse_args()
    require(args.finalize, 'Pass --finalize only after the actual untimed structural proofs exist')
    perf = (ROOT / args.performance_directory).resolve()
    require(perf.is_relative_to(BASE) and perf != BASE, 'Expected a new lot4B performance directory')
    output = perf / 'owner-growth-contract.json'
    require(not output.exists(), 'Owner-cost contract already exists; refusing overwrite')
    forbidden = ['window.json', 'readiness.json', 'static-preflight.json', 'cohort1/baseline.json',
                 'cohort1/after.json', 'cohort2/baseline.json', 'cohort2/after.json',
                 'owner-growth-comparison.json', 'owner-growth-review.json', 'superseded-before-measurement.json']
    require(not any((perf / name).exists() for name in forbidden), 'Capture qualification cannot be finalized after readiness or measured work')
    inputs, allowed_external = {}, {}

    def retain(path):
        record = fingerprint(path)
        previous = inputs.setdefault(record['path'], record)
        require(previous == record, 'Input changed during contract preparation: ' + record['path'])
        return record

    def checked(record):
        require(set(record) == {'path', 'bytes', 'sha256'}, 'Invalid fingerprint shape')
        lexical = ROOT / record['path']
        actual = lexical.resolve(strict=True)
        require(actual == lexical, 'Fingerprint paths must not traverse symlinks or parent aliases')
        require(actual.is_relative_to(ROOT) or allowed_external.get(record['path']) == record,
                'External input was not declared by the exact baseline capture')
        require(retain(record['path']) == record, 'Recorded input changed: ' + record['path'])
        return actual

    def read(path):
        retain(path)
        return json.loads((ROOT / path).read_bytes())

    declaration_path = perf / 'declaration.json'
    declaration = read(declaration_path)
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration['status'] == 'declared_before_official_window'
            and declaration['noOfficialWindowAtDeclaration'] is True, 'A real premeasurement source declaration is required')
    preparation = read(perf / 'preparation.json')
    require(preparation['baseline'] == declaration['baseline'], 'Preparation and declaration name different baselines')
    baseline_root = Path(preparation['baselineCheckout'])
    require(baseline_root.is_absolute() and baseline_root.resolve(strict=True) == baseline_root
            and baseline_root.is_dir() and baseline_root != ROOT, 'An exact separate baseline checkout is required')
    qualification = declaration['ownerCostQualification']
    tools = {'consolidator': retain(BASE / 'consolidate-owner-costs.mjs'), 'reviewer': retain(BASE / 'review-owner-costs.py')}
    require(qualification == {'schema': 'logos-engine.lot4b-owner-cost-qualification.v1',
            'contractPath': output.relative_to(ROOT).as_posix(), 'tools': tools}, 'Declaration names different owner-cost tools or contract')
    manifests = {}
    for role in ('baseline', 'candidate'):
        manifests[role] = read(checked(declaration[role + 'Manifest']))
        require(manifests[role]['digest'] == declaration['nativeDigests'][role]
                == declaration[role]['nativeDigest'], 'Declared native identities disagree: ' + role)
    for key in ('protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy', 'candidateArchiveManifest'):
        checked(declaration[key])
    for record in declaration['officialTools'] + [declaration['globalDecisionTool'], declaration['globalCalculationTool']]:
        checked(record)
    inventory_path = (ROOT / args.owner_inventory).resolve()
    fixture_path = (ROOT / args.structural_fixture).resolve()
    require(inventory_path.is_relative_to(BASE) and fixture_path.is_relative_to(BASE), 'Retained owner evidence must belong to lot4B')
    inventory, fixture = read(inventory_path), read(fixture_path)
    require(inventory['schema'] == 'logos-engine.lot4b-owner-cost-source-inventory.v1'
            and inventory['programScope'] == 'family-installed programs'
            and inventory['nativeDigests'] == declaration['nativeDigests'], 'Owner inventory differs from the actual source freeze')
    checked(inventory['generator'])
    for key, addition in (('owners', OWNER), ('programs', PROGRAM)):
        a, b = inventory[key]['baseline'], inventory[key]['candidate']
        require(len(a) == len(set(a)) and len(b) == len(set(b)), 'Duplicate actual factory identities')
        require(set(b) - set(a) == {addition} and set(a) - set(b) == set(), 'Only the declared owner/program may be added')
    require(fixture['schema'] == 'logos-engine.lot4b-owner-cost-structural-fixture.v1'
            and fixture['status'] == 'qualified_functional_structure'
            and fixture['nativeDigests'] == declaration['nativeDigests'], 'No qualified functional fixture for this freeze')
    require({k: v for k, v in fixture['cases'].items() if k != 'path'}
            == {k: v for k, v in declaration['cases'].items() if k != 'path'}, 'Untimed and measured cases must contain identical bytes')
    checked(fixture['cases']); checked(fixture['captureTool'])
    require(fixture['captureTool'] == retain(BASE / 'capture-cost-owner-graphs.mjs'), 'Capture tool changed')
    require([(row['case'], row['form']) for row in fixture['forms']]
            == [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')], 'Four ordered functional forms are required')
    attribution = read(checked(fixture['attribution']))
    require(attribution['schema'] == 'logos-engine.lot4b-owner-cost-structural-attribution.v1'
            and attribution['status'] == 'qualified_functional_structure'
            and attribution['nativeDigests'] == declaration['nativeDigests']
            and attribution['checkedCount'] == len(attribution['checks']) > 0
            and all(row['passed'] is True for row in attribution['checks'])
            and attribution['nodeAttributions'] and attribution['failures'] == [], 'Causal graph attribution is incomplete')
    require(attribution['formsSha256'] == hashlib.sha256(json.dumps(fixture['forms'], sort_keys=True,
            separators=(',', ':'), ensure_ascii=False).encode()).hexdigest(), 'Attribution binds different functional forms')
    checked(attribution['generator'])
    require(attribution['generator'] == retain(BASE / 'qualify-cost-owner-graphs.mjs'), 'Qualifier changed')
    external_baseline_inputs = []
    for role in ('baseline', 'candidate'):
        capture = fixture['captures'][role]
        checked(capture['report'])
        receipt = read(checked(capture['receipt']))
        require(receipt['status'] == 'captured_functional_structure' and receipt['role'] == role
                and receipt['nativeDigest'] == declaration['nativeDigests'][role]
                and receipt['report'] == capture['report'] and receipt['failures'] == []
                and receipt['sessionCount'] == 4 and receipt['actions'] == 31
                and all(receipt[key] == 0 for key in ('measuredCostSessions', 'timingReportsRead', 'timingMetricsProduced')),
                'A completed untimed capture is required for each source')
        require(Path(receipt['checkout']) == (baseline_root if role == 'baseline' else ROOT)
                and receipt['inputsBefore'] == receipt['inputsAfter'] and receipt['inputsUnchanged'] is True
                and receipt['nativeInventoryBefore'] == receipt['nativeInventoryAfter'] == manifests[role]
                and receipt['nativeSourceBefore'] == receipt['nativeSourceAfter']
                and receipt['nativeSourceBefore'] in receipt['inputsBefore'] and receipt['cases'] in receipt['inputsBefore']
                and receipt['generator'] == fixture['captureTool'] and receipt['generatorUnchanged'] is True,
                'Functional capture inputs, source or generator differ')
        require(len(receipt['inputsBefore']) == len({row['path'] for row in receipt['inputsBefore']}), 'Duplicate capture input paths')
        for record in receipt['inputsBefore']:
            if Path(record['path']).is_absolute():
                lexical = Path(record['path'])
                require(role == 'baseline' and lexical.resolve(strict=True) == lexical
                        and lexical != baseline_root and lexical.is_relative_to(baseline_root),
                        'Only exact files inside the declared baseline checkout may be external')
                require(allowed_external.setdefault(record['path'], record) == record, 'Conflicting external input fingerprints')
                external_baseline_inputs.append(record)
            checked(record)
        require(instant(receipt['finishedAt']) <= instant(attribution['recordedAt']), 'Attribution predates its completed captures')
    require([row for row in attribution['inputs'] if Path(row['path']).is_absolute()] == external_baseline_inputs,
            'Attribution must retain exactly the ordered external baseline capture inputs')
    for record in attribution['inputs']:
        checked(record)
    source_evidence = [retain(ROOT / path) for path in SOURCE_PATHS]
    require(all(row['sha256'] == manifests['candidate']['files'][row['path']] for row in source_evidence), 'Candidate source evidence changed after freezing')
    now = datetime.now(timezone.utc)
    require(instant(attribution['recordedAt']) <= instant(fixture['recordedAt']) <= now
            and instant(inventory['recordedAt']) <= now and instant(declaration['finalizedAt']) <= now,
            'Completed structural evidence and declaration must precede this contract')
    generator = retain(Path(__file__))
    for record in inputs.values():
        require(fingerprint(record['path']) == record, 'Input changed before finalization')
    require(not output.exists() and not any((perf / name).exists() for name in forbidden), 'A forbidden measured/readiness output appeared')
    value = {'schema': 'logos-engine.lot4b-owner-cost-contract.v2', 'lot': '4B', 'declaredAt': now.isoformat(),
             'performanceDirectory': perf.relative_to(ROOT).as_posix(), 'declaration': retain(declaration_path),
             'tools': tools, 'structuralExpectation': EXPECTATION, 'sourceEvidence': source_evidence,
             'ownerInventory': retain(inventory_path), 'structuralFixture': retain(fixture_path),
             'strictFailureReceipt': (perf / 'aggregation-failure.json').relative_to(ROOT).as_posix(),
             'strictFailureLog': (perf / 'aggregation-failure.log').relative_to(ROOT).as_posix(),
             'historicalAggregateOutput': (perf / 'combined-comparison.json').relative_to(ROOT).as_posix(),
             'generator': generator, 'inputsBefore': list(inputs.values()), 'inputsAfter': list(inputs.values()),
             'inputsUnchanged': True, 'measurementExecuted': False,
             'qualification': 'Prospective owner contract from actual frozen functional graph captures. No constant node/revision delta is presumed. The strict historical comparator remains a separate required gate; any actual refusal must be retained. Cost outcomes and uncaptured private measured graph values are not anticipated.'}
    with output.open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False); stream.write('\n')
    print(json.dumps({'status': 'declared_before_measurement', 'contract': fingerprint(output), 'measurementExecuted': False}))


if __name__ == '__main__':
    main()
