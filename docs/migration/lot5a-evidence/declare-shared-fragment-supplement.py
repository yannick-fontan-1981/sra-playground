#!/usr/bin/env python3
"""Declare the closed first-creator qualification before any lot5A cost window.

Usage: python -B SCRIPT PERFORMANCE_DIRECTORY
Reads retained captures' diagnostic metadata only; no runtime or timing runs.
Initial declarations, tools, failed attribution and captures remain intact.
"""
from datetime import datetime, timezone
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot5a-evidence'


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


def fingerprint(path):
    path = path.resolve()
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return {'path': path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path),
            'bytes': path.stat().st_size, 'sha256': h.hexdigest()}


def read(path):
    return json.loads(path.read_bytes())


def verify(record):
    assert fingerprint(ROOT / record['path']) == record, 'Input changed: ' + record['path']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('performance_directory', type=Path)
    args = parser.parse_args()
    perf = (ROOT / args.performance_directory).resolve()
    assert perf.is_relative_to(BASE) and perf.is_dir()
    output = perf / 'shared-fragment-premeasurement-supplement.json'
    assert not output.exists()
    for name in ['window.json', 'readiness.json', 'static-preflight.json', 'owner-growth-contract.json',
                 'owner-growth-comparison.json', 'owner-growth-review.json']:
        assert not (perf / name).exists(), 'A finalized or measured window already exists: ' + name
    assert not any(perf.glob('cohort*/*.json'))
    declaration_path = perf / 'declaration.json'
    declaration = read(declaration_path)
    assert declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
    assert declaration['baseline']['nativeVersion'] == '0.52.0'
    for record in declaration['ownerCostQualification']['tools'].values():
        verify(record)
    failed_path = perf / 'owner-structural-attribution.json'
    failed = read(failed_path)
    assert failed['status'] == 'functional_structure_qualification_failed'
    assert failed['nativeDigests'] == declaration['nativeDigests']
    assert any('Common node origin changed: state_fragment:5447ef' in item['message'] for item in failed['failures'])
    verify(failed['generator'])
    archive_path = perf / 'initial-preparation-tools/manifest.json'
    archive = read(archive_path)
    assert len(archive['files']) == 9
    archived = []
    for item in archive['files']:
        record = {'path': item['archivedPath'], 'bytes': item['bytes'], 'sha256': item['sha256']}
        verify(record)
        archived.append(record)
    inventory_path = perf / 'diagnostic/fragment-first-creator-inventory.json'
    inventory = read(inventory_path)
    assert inventory['status'] == 'diagnostic_complete_not_qualified'
    assert inventory['inputsBefore'] == inventory['inputsAfter']
    for record in [inventory['generator'], *inventory['inputsBefore']]:
        verify(record)
    ledger = []
    for session in inventory['sessions']:
        assert session['allCommonCompleteFragmentValuesEqual']
        assert not session['baselineOnlyNodeIds'] and not session['otherCommonNodeMetadataDifferences']
        assert all(p['remainingOrderedIdentitiesRevisionsCausesEqual'] for p in session['remainingCommonDeltaComparisons'])
        for item in session['firstCreatorDifferences']:
            assert item['canonicalCompleteValuesEqual'] and item['otherCompleteNodeFieldsEqual']
            assert item['candidate']['pointIndex'] < item['baseline']['pointIndex']
            assert item['candidate']['firstConsumer']['nodeId'] == 'family_state:linked_temporal_preparation'
            record = {'case': session['case'], 'form': session['form'], 'fragmentId': item['fragmentId'],
                      'canonicalValueSha256': hashlib.sha256(canonical(item['baseline']['node']['value'])).hexdigest()}
            assert item['fragmentId'] == 'state_fragment:' + record['canonicalValueSha256']
            for role in ['baseline', 'candidate']:
                entry = item[role]
                record[role] = {'creation': {key: value for key, value in entry.items()
                    if key not in ['firstConsumer', 'consumerRootsAtFirstPoint', 'directParentsAtFirstPoint']},
                    'firstConsumer': entry['firstConsumer'], 'consumerRootsAtFirstPoint': entry['consumerRootsAtFirstPoint']}
            ledger.append(record)
    assert len(ledger) == 14
    assert [sum(row['case'] == case and row['form'] == form for row in ledger)
            for case, form in [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')]] == [0, 3, 0, 11]
    assert len({(row['case'], row['form'], row['fragmentId']) for row in ledger}) == 14
    captures = {role: {'report': fingerprint(perf / (role + '-structure.json.gz')),
                       'receipt': fingerprint(perf / (role + '-structure.receipt.json'))}
                for role in ['baseline', 'candidate']}
    for role, capture in captures.items():
        receipt = read(ROOT / capture['receipt']['path'])
        assert receipt['status'] == 'captured_functional_structure' and receipt['report'] == capture['report']
        assert receipt['nativeDigest'] == declaration['nativeDigests'][role]
    bound = [fingerprint(path) for path in [Path(__file__), declaration_path, failed_path, archive_path,
             inventory_path, perf / 'protocol.md', perf / 'preparation.json', perf / 'protocol-check.json',
             BASE / 'qualify-cost-owner-graphs.mjs', BASE / 'qualify-cost-owner-graphs-v2.mjs',
             BASE / 'finalize-owner-cost-contract.py']]
    bound.extend(archived)
    bound.extend([inventory['generator'], *inventory['inputsBefore']])
    for capture in captures.values():
        bound.extend(capture.values())
    bound.extend(declaration['ownerCostQualification']['tools'].values())
    inputs = list({item['path']: item for item in bound}.values())
    result = {
        'schema': 'logos-engine.lot5a-shared-fragment-premeasurement-supplement.v1',
        'status': 'declared_before_measurement', 'declaredAt': datetime.now(timezone.utc).isoformat(),
        'generator': fingerprint(Path(__file__)), 'nativeDigests': declaration['nativeDigests'],
        'initialDeclaration': fingerprint(declaration_path), 'initialFailedAttribution': fingerprint(failed_path),
        'initialToolsArchive': fingerprint(archive_path), 'fragmentInventory': fingerprint(inventory_path),
        'qualifier': fingerprint(BASE / 'qualify-cost-owner-graphs-v2.mjs'),
        'unchangedCostAnalyzers': declaration['ownerCostQualification']['tools'],
        'captures': captures, 'closedLedger': ledger, 'inputs': inputs,
        'allowedWorkPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
        'noOfficialWindowAtDeclaration': True, 'numericPolicyChanged': False, 'measuredSessionsDiscarded': 0,
        'rules': [
            'Only these fourteen (case, form, immutable fragment identity) entries may have different first-creator metadata.',
            'Each complete canonical fragment value and its content address must match; each is terminal and is created once at revision one in each run.',
            'Every other node field is exact. Each source digest is independently checked against its captured runtime. Both actual origins and creation causes remain retained.',
            'B must create and first consume each fragment earlier through the added owner phase.masks with an actual checkpoint and outcome.acquire cause. All B consumers at creation must equal the closed owner-only register; every B consumer before A catches up must still be that owner through phase.masks.',
            'A later creates it under transition.acquire. Every common root consuming it in that A point must have an actual B delta with the identical complete encoded value, metadata and cause apart from runtime source digest.',
            'Every remaining common delta keeps exact identity, revision, cause and order. No global state_fragment filter or cause deletion is allowed.',
            'At every point, revisionB minus revisionA equals cumulative actual attributed B deltas minus cumulative explicitly matched A creation deltas. The cumulative B count is never decremented.',
            'Current candidate-only node counts use the actual identity set, so each shared identity leaves that set exactly when A creates it.',
            'The initial failed attribution and all captures remain intact. This supplement precedes qualification, contract, readiness and every official timing.',
            'All measured sessions, complete-session strict below +10% rule for each case, phase reports and four allowed work paths remain unchanged.'
        ],
        'qualification': 'A narrowly closed causal attribution supplement from retained untimed captures. It is neither a successful qualification receipt nor a cost result. The new qualifier must verify every entry and reject every other difference.'
    }
    for record in inputs:
        verify(record)
    with output.open('x') as stream:
        stream.write(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': result['status'], 'closedLedgerEntries': len(ledger),
                      'output': str(output.relative_to(ROOT)), 'costMeasurementExecuted': False}))


if __name__ == '__main__':
    main()
