#!/usr/bin/env python3
"""Bind existing frozen lot5A inputs before any official cost window.

Usage: python -B docs/migration/lot5a-evidence/finalize-owner-cost-contract.py PERFORMANCE_DIRECTORY

This command reads completed captures, attribution, fixture, source inventory
and declaration. It creates one exclusive contract; it runs no other script,
test, replay or measurement. It cannot manufacture missing qualification.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/migration/lot5a-evidence'
OWNER = 'linked_temporal_preparation'
SOURCES = [
    'src/logos-engine/v6-native-runtime.ts',
    'src/logos-engine/v6-linked-temporal-preparation.ts',
    'src/logos-engine/v6-linked-temporal-contact.ts',
    'src/logos-engine/v6-linked-temporal-phase.ts',
    'src/logos-engine/v6-linked-temporal-common.ts',
    'src/logos-engine/v6-knowledge-store.ts',
    'src/logos-engine/kernel.ts',
]
EXPECTATION = {
    'ownerId': OWNER, 'programId': None,
    'installedNodeIds': ['family_state:' + OWNER, 'family_activation:' + OWNER],
    'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
    'mode': 'predeclared_functional_fixture',
    'qualification': 'functional_structure_frozen_before_measurement',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(path.read_bytes())


def stamp():
    return datetime.now(timezone.utc).isoformat()


def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Every timestamp must state its timezone')
    return result


def fingerprint(path):
    path = path.resolve()
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    label = path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path)
    return {'path': label, 'bytes': path.stat().st_size, 'sha256': digest.hexdigest()}


def verify(record):
    require(set(record) == {'path', 'bytes', 'sha256'}, 'Unexpected fingerprint fields')
    require(fingerprint(ROOT / record['path']) == record, 'Input changed: ' + record['path'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('performance_directory', type=Path)
    args = parser.parse_args()
    perf = (ROOT / args.performance_directory).resolve()
    require(perf.is_relative_to(EVIDENCE) and perf.is_dir(), 'Performance directory must already exist inside lot5a-evidence')
    output = perf / 'owner-growth-contract.json'
    for name in ['window.json', 'readiness.json', 'static-preflight.json', 'owner-growth-contract.json',
                 'owner-growth-comparison.json', 'owner-growth-review.json', 'aggregation-failure.json', 'aggregation-failure.log']:
        require(not (perf / name).exists(), 'Refusing a finalized or measured window: ' + name)
    require(not any(perf.glob('cohort*/*.json')), 'Measured reports already exist')

    declaration_path = perf / 'declaration.json'
    declaration = read(declaration_path)
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2',
            'Need the actual finalized lot5A declaration')
    require(declaration['baseline']['nativeVersion'] == '0.52.0'
            and isinstance(declaration['baseline']['siteVersion'], int) and declaration['baseline']['siteVersion'] > 0,
            'The responsible owner must identify the published native0.52 baseline')
    tools = {
        'consolidator': fingerprint(EVIDENCE / 'consolidate-owner-costs.mjs'),
        'reviewer': fingerprint(EVIDENCE / 'review-owner-costs.py'),
    }
    require(declaration['ownerCostQualification'] == {
        'schema': 'logos-engine.lot5a-owner-cost-qualification.v1',
        'contractPath': output.relative_to(ROOT).as_posix(), 'tools': tools,
    }, 'The declared contract or tools differ')
    manifests = {}
    for role in ('baseline', 'candidate'):
        record = declaration[role + 'Manifest']
        verify(record)
        manifests[role] = read(ROOT / record['path'])
        require(manifests[role]['digest'] == declaration['nativeDigests'][role], 'Declared source digest differs')

    inventory_path = perf / 'owner-source-inventory.json'
    inventory = read(inventory_path)
    require(inventory['schema'] == 'logos-engine.lot5a-owner-cost-source-inventory.v1'
            and inventory['programScope'] == 'family-installed programs'
            and inventory['nativeDigests'] == declaration['nativeDigests'], 'Incorrect factory inventory')
    verify(inventory['generator'])
    for key, additions in [('owners', {OWNER}), ('programs', set())]:
        a, b = inventory[key]['baseline'], inventory[key]['candidate']
        require(len(a) == len(set(a)) and len(b) == len(set(b))
                and set(b) - set(a) == additions and not set(a) - set(b), 'Unexpected ' + key + ' change')

    fixture_path = perf / 'owner-structural-fixture.json'
    fixture = read(fixture_path)
    require(fixture['schema'] == 'logos-engine.lot5a-owner-cost-structural-fixture.v1'
            and fixture['status'] == 'qualified_functional_structure'
            and fixture['nativeDigests'] == declaration['nativeDigests'], 'Missing qualified functional fixture')
    require([(row['case'], row['form']) for row in fixture['forms']] ==
            [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')], 'The four forms must be complete and ordered')
    verify(fixture['cases']); verify(declaration['cases'])
    require((fixture['cases']['bytes'], fixture['cases']['sha256']) ==
            (declaration['cases']['bytes'], declaration['cases']['sha256']), 'Functional and measured cases differ')
    verify(fixture['captureTool']); verify(fixture['attribution'])
    attribution = read(ROOT / fixture['attribution']['path'])
    require(attribution['schema'] == 'logos-engine.lot5a-owner-cost-structural-attribution.v1'
            and attribution['status'] == 'qualified_functional_structure'
            and attribution['nativeDigests'] == declaration['nativeDigests'], 'Missing successful graph attribution')
    require(attribution['checkedCount'] == len(attribution['checks']) > 0
            and all(row['passed'] is True for row in attribution['checks'])
            and attribution['nodeAttributions'], 'Graph attribution is incomplete')
    forms_hash = hashlib.sha256(json.dumps(fixture['forms'], sort_keys=True, separators=(',', ':'),
                                          ensure_ascii=False, allow_nan=False).encode()).hexdigest()
    require(attribution['formsSha256'] == forms_hash, 'Fixture forms differ from their attribution')
    verify(attribution['generator'])
    for record in attribution['inputs']:
        verify(record)
    for role in ('baseline', 'candidate'):
        capture = fixture['captures'][role]
        verify(capture['report']); verify(capture['receipt'])
        receipt = read(ROOT / capture['receipt']['path'])
        require(receipt['schema'] == 'logos-engine.lot5a-owner-cost-functional-capture-receipt.v1'
                and receipt['role'] == role and receipt['status'] == 'captured_functional_structure'
                and receipt['nativeDigest'] == declaration['nativeDigests'][role]
                and receipt['report'] == capture['report'] and receipt['generator'] == fixture['captureTool']
                and receipt['sessionCount'] == 4 and receipt['actions'] == 31 and not receipt['failures'],
                'Capture receipt does not bind the complete functional sessions')
        require(instant(receipt['finishedAt']) <= instant(attribution['recordedAt']), 'Attribution predates capture')

    sources = [fingerprint(ROOT / path) for path in SOURCES]
    for record in sources:
        require(record['sha256'] == manifests['candidate']['files'][record['path']], 'Source differs from the final candidate freeze')
        require(any(item == record for item in attribution['inputs']), 'Source evidence is absent from attribution')
    now = stamp()
    require(instant(attribution['recordedAt']) <= instant(fixture['recordedAt']) <= instant(now)
            and instant(inventory['recordedAt']) <= instant(now)
            and instant(declaration['finalizedAt']) <= instant(now), 'Premeasurement chronology differs')
    result = {
        'schema': 'logos-engine.lot5a-owner-cost-contract.v2', 'lot': '5A', 'declaredAt': now,
        'performanceDirectory': perf.relative_to(ROOT).as_posix(), 'declaration': fingerprint(declaration_path),
        'tools': tools, 'structuralExpectation': EXPECTATION, 'sourceEvidence': sources,
        'ownerInventory': fingerprint(inventory_path), 'structuralFixture': fingerprint(fixture_path),
        'strictFailureReceipt': (perf / 'aggregation-failure.json').relative_to(ROOT).as_posix(),
        'strictFailureLog': (perf / 'aggregation-failure.log').relative_to(ROOT).as_posix(),
        'historicalAggregateOutput': (perf / 'combined-comparison.json').relative_to(ROOT).as_posix(),
    }
    with output.open('x') as stream:
        stream.write(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': 'owner_cost_contract_finalized_before_measurement',
                      'contract': output.relative_to(ROOT).as_posix(), 'nativeDigests': declaration['nativeDigests']}))


if __name__ == '__main__':
    main()
