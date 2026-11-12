#!/usr/bin/env python3
"""Close or read-check the prospective OrderedRecruitment owner-cost contract.

Reads completed untimed graph qualification, real owner/program inventory and
the actual frozen protocol identities. No runtime, source factory, capture,
measurement, test or game is executed. Outputs are exclusive.

--finalize writes the contract once. --verify-only rechecks the same complete
contract before static preflight, writes nothing, and never refreshes its date.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot10c-evidence'
OWNER = 'public_ordered_recruitment'
PROGRAM = 'v6.ordered_recruitment.choose'
SOURCE_PATHS = ['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-ordered-recruitment.ts',
                'src/logos-engine/v6-ordered-recruitment-geometry.ts', 'src/logos-engine/v6-ordered-recruitment-projection.ts', 'src/logos-engine/v6-ordered-recruitment-policy.ts',
                'src/logos-engine/v5-ordered-front-reduction.ts', 'src/logos-engine/v6-native-types.ts',
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


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, 'Duplicate JSON key: ' + key)
        value[key] = item
    return value


def invalid_constant(value): raise ValueError('Non-finite JSON value: ' + value)
def read_json(path): return json.loads(path.read_bytes(), object_pairs_hook=unique_object, parse_constant=invalid_constant)


def native_inventory(root):
    files = {}
    for folder in ('src/logos-engine', 'src/runtime'):
        for path in (root / folder).rglob('*'):
            if path.is_file() and path.suffix in ('.ts', '.json', '.drm'):
                require(path.resolve(strict=True) == path, 'Native source path is not canonical: ' + str(path))
                files[path.relative_to(root).as_posix()] = fingerprint(path)['sha256']
    files = dict(sorted(files.items()))
    require(files, 'Empty native inventory')
    return {'files': files, 'fileCount': len(files),
            'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest()}


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
    parser.add_argument('--baseline-checkout', type=Path, required=True)
    parser.add_argument('--performance-directory', type=Path, required=True)
    parser.add_argument('--owner-inventory', type=Path, required=True)
    parser.add_argument('--structural-fixture', type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--finalize', action='store_true')
    mode.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    perf = (ROOT / args.performance_directory).resolve()
    require(perf.is_relative_to(BASE) and perf not in (BASE, BASE / 'performance'), 'Expected a new named lot10C performance directory')
    output = perf / 'owner-growth-contract.json'
    require(output.is_file() if args.verify_only else not output.exists(),
            'Verify-only requires the existing contract; finalization refuses overwrite')
    existing = read_json(output) if args.verify_only else None
    deadline = instant(existing['declaredAt']) if existing is not None else datetime.now(timezone.utc)
    require(deadline <= datetime.now(timezone.utc), 'Contract date is in the future')
    forbidden = ['window.json', 'readiness.json', 'static-preflight.json', 'cohort1/baseline.json',
                 'cohort1/after.json', 'cohort2/baseline.json', 'cohort2/after.json',
                 'owner-growth-comparison.json', 'owner-growth-review.json', 'superseded-before-measurement.json',
                 'combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json',
                 'aggregation-failure.json', 'aggregation-failure.log']
    baseline_argument = args.baseline_checkout.resolve(strict=True)
    def unmeasured():
        for directory in (perf, baseline_argument / perf.relative_to(ROOT)):
            require(not any((directory / name).exists() for name in forbidden)
                    and not any(directory.glob('cohort*/*')), 'Contract preparation requires no readiness or measured outputs')
    unmeasured()
    inputs, allowed_external = {}, {}

    def retain(path):
        record = fingerprint(path)
        previous = inputs.setdefault(record['path'], record)
        require(previous == record, 'Input changed during contract preparation: ' + record['path'])
        return record

    def checked(record):
        require(set(record) == {'path', 'bytes', 'sha256'}, 'Invalid fingerprint shape')
        require(type(record['bytes']) is int and record['bytes'] >= 0 and isinstance(record['path'], str)
                and re.fullmatch(r'[0-9a-f]{64}', record['sha256']), 'Invalid fingerprint values')
        lexical = ROOT / record['path']
        actual = lexical.resolve(strict=True)
        require(actual == lexical, 'Fingerprint paths must not traverse symlinks or parent aliases')
        require(actual.is_relative_to(ROOT) or allowed_external.get(record['path']) == record,
                'External input was not declared by the exact baseline capture')
        require(retain(record['path']) == record, 'Recorded input changed: ' + record['path'])
        return actual

    def read(path):
        retain(path)
        return read_json(ROOT / path)

    declaration_path = perf / 'declaration.json'
    declaration = read(declaration_path)
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration['status'] == 'declared_before_official_window'
            and declaration['noOfficialWindowAtDeclaration'] is True, 'A real premeasurement source declaration is required')
    preparation = read(perf / 'preparation.json')
    require(preparation['schema'] == 'logos-engine.native-cost-protocol-preparation.v1'
            and preparation['status'] == 'source_freezes_verified_not_functional_readiness'
            and preparation['measurementExecuted'] is False
            and preparation['baseline'] == declaration['baseline'] and preparation['candidate'] == declaration['candidate']
            and preparation['candidateCheckout'] == str(ROOT), 'Preparation and declaration name different sources')
    require(all(preparation[key] == declaration[key] for key in
            ('baselineManifest', 'candidateManifest', 'candidateArchiveManifest')), 'Preparation retained different source files')
    baseline_root = Path(preparation['baselineCheckout'])
    require(baseline_root.is_absolute() and baseline_root.resolve(strict=True) == baseline_root
            and baseline_root.is_dir() and baseline_root != ROOT and baseline_root == baseline_argument,
            'An exact separate baseline checkout matching the CLI is required')
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=baseline_root, text=True).strip()
            == declaration['baseline']['commit'], 'Baseline Git commit changed')
    require(not subprocess.check_output(['git', 'status', '--porcelain=v1', '--untracked-files=all', '--',
            'src/logos-engine', 'src/runtime'], cwd=baseline_root, text=True).strip(), 'Baseline native worktree changed')
    qualification = declaration['ownerCostQualification']
    tools = {'consolidator': retain(BASE / 'consolidate-owner-costs.mjs'), 'reviewer': retain(BASE / 'review-owner-costs.py')}
    require(qualification == {'schema': 'logos-engine.lot10c-owner-cost-qualification.v1',
            'contractPath': output.relative_to(ROOT).as_posix(), 'tools': tools}, 'Declaration names different owner-cost tools or contract')
    for key, names in (
        ('preparationTools', ['prepare-cost-protocol.py', 'prepare-owner-cost-contract.py', 'check-cost-static-inputs.py']),
        ('ownerEvidenceTools', ['record-owner-source-inventory.mjs', 'capture-cost-owner-graphs.mjs', 'qualify-cost-owner-graphs.mjs']),
    ):
        require(declaration[key] == preparation[key] == [retain(BASE / name) for name in names],
                'Preparation/capture tools differ from the predeclared bytes: ' + key)
    manifests = {}
    for role in ('baseline', 'candidate'):
        manifests[role] = read(checked(declaration[role + 'Manifest']))
        require(manifests[role]['digest'] == declaration['nativeDigests'][role]
                == declaration[role]['nativeDigest'], 'Declared native identities disagree: ' + role)
        require(manifests[role] == native_inventory(baseline_root if role == 'baseline' else ROOT),
                'Current checkout differs from frozen source: ' + role)
    for key in ('protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy', 'candidateArchiveManifest'):
        checked(declaration[key])
    for record in declaration['officialTools'] + [declaration['globalDecisionTool'], declaration['globalCalculationTool']]:
        checked(record)
    protocol_check = read(perf / 'protocol-check.json')
    require(protocol_check == {'status': 'protocol_contract_passed', 'declaration': declaration_path.relative_to(ROOT).as_posix(),
            'finalizedAt': declaration['finalizedAt'], 'nativeDigests': declaration['nativeDigests'],
            'caseIds': ['STCK', 'SMLP'], 'measurementExecuted': False}, 'The retained protocol checker did not pass these inputs')
    inventory_path = (ROOT / args.owner_inventory).resolve()
    fixture_path = (ROOT / args.structural_fixture).resolve()
    require(inventory_path.is_relative_to(BASE) and fixture_path.is_relative_to(BASE), 'Retained owner evidence must belong to lot10C')
    inventory, fixture = read(inventory_path), read(fixture_path)
    require(inventory['schema'] == 'logos-engine.lot10c-owner-cost-source-inventory.v1'
            and inventory['programScope'] == 'family-installed programs'
            and inventory['nativeDigests'] == declaration['nativeDigests'], 'Owner inventory differs from the actual source freeze')
    checked(inventory['generator'])
    require(inventory['generator'] == retain(BASE / 'record-owner-source-inventory.mjs'), 'Owner inventory tool changed')
    require(instant(declaration['finalizedAt']) <= instant(inventory['recordedAt']) <= deadline,
            'Owner inventory must follow this declaration and precede the owner contract')
    for role, checkout in (('baseline', baseline_root), ('candidate', ROOT)):
        side = inventory['sourceInventory'][role]
        require(side['checkout'] == str(checkout) and side['native'] == manifests[role]
                and side['runtimeUninitializedBeforeAndAfter'] is True, 'Owner factory inventory used a different source/session')
        require(side['owners'] == inventory['owners'][role] and side['programs'] == inventory['programs'][role],
                'Owner inventory summaries differ from actual factories')
        for record in side['sourceInputs']:
            require(not Path(record['path']).is_absolute() and (checkout / record['path']).resolve(strict=True) == checkout / record['path'],
                    'Factory input is not a canonical checkout-relative path')
            actual = retain(checkout / record['path'])
            require({key: actual[key] for key in ('bytes', 'sha256')} == {key: record[key] for key in ('bytes', 'sha256')},
                    'Factory inventory input changed: ' + role + '/' + record['path'])
    for key, addition in (('owners', OWNER), ('programs', PROGRAM)):
        a, b = inventory[key]['baseline'], inventory[key]['candidate']
        require(a and all(isinstance(item, str) and item for item in a + b)
                and len(a) == len(set(a)) and len(b) == len(set(b)), 'Invalid or duplicate actual factory identities')
        require(set(b) - set(a) == {addition} and set(a) - set(b) == set(), 'Only the declared owner/program may be added')
    require(fixture['schema'] == 'logos-engine.lot10c-owner-cost-structural-fixture.v1'
            and fixture['status'] == 'qualified_functional_structure'
            and fixture['nativeDigests'] == declaration['nativeDigests'], 'No qualified functional fixture for this freeze')
    require({k: v for k, v in fixture['cases'].items() if k != 'path'}
            == {k: v for k, v in declaration['cases'].items() if k != 'path'}, 'Untimed and measured cases must contain identical bytes')
    checked(fixture['cases']); checked(fixture['captureTool'])
    require(fixture['captureTool'] == retain(BASE / 'capture-cost-owner-graphs.mjs'), 'Capture tool changed')
    require([(row['case'], row['form']) for row in fixture['forms']]
            == [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')], 'Four ordered functional forms are required')
    attribution = read(checked(fixture['attribution']))
    require(attribution['schema'] == 'logos-engine.lot10c-owner-cost-structural-attribution.v1'
            and attribution['status'] == 'qualified_functional_structure'
            and attribution['nativeDigests'] == declaration['nativeDigests']
            and attribution['checkedCount'] == len(attribution['checks']) > 0
            and all(row['passed'] is True for row in attribution['checks'])
            and attribution['nodeAttributions'] and attribution['failures'] == [], 'Causal graph attribution is incomplete')
    require(len(attribution['inputs']) == len({record['path'] for record in attribution['inputs']}),
            'Duplicate attribution input paths')
    require(attribution['formsSha256'] == hashlib.sha256(json.dumps(fixture['forms'], sort_keys=True,
            separators=(',', ':'), ensure_ascii=False).encode()).hexdigest(), 'Attribution binds different functional forms')
    checked(attribution['generator'])
    require(attribution['generator'] == retain(BASE / 'qualify-cost-owner-graphs.mjs'), 'Qualifier changed')
    external_baseline_inputs = []
    for role in ('baseline', 'candidate'):
        capture = fixture['captures'][role]
        checked(capture['report'])
        receipt = read(checked(capture['receipt']))
        require(receipt['schema'] == 'logos-engine.lot10c-owner-cost-functional-capture-receipt.v1'
                and receipt['status'] == 'captured_functional_structure' and receipt['role'] == role
                and receipt['nativeDigest'] == declaration['nativeDigests'][role]
                and receipt['report'] == capture['report'] and receipt['failures'] == []
                and receipt['sessionCount'] == 4 and receipt['actions'] == 31
                and all(receipt[key] == 0 for key in ('measuredCostSessions', 'timingReportsRead', 'timingMetricsProduced')),
                'A completed untimed capture is required for each source')
        require(Path(receipt['checkout']) == (baseline_root if role == 'baseline' else ROOT)
                and receipt['inputsBefore'] == receipt['inputsAfter'] and receipt['inputsUnchanged'] is True
                and receipt['nativeInventoryBefore'] == receipt['nativeInventoryAfter'] == manifests[role]
                and receipt['nativeSourceBefore'] == receipt['nativeSourceAfter'] and receipt['nativeSourceUnchanged'] is True
                and receipt['nativeSourceBefore'] in receipt['inputsBefore'] and receipt['cases'] in receipt['inputsBefore']
                and receipt['generator'] == fixture['captureTool'] and receipt['generatorUnchanged'] is True,
                'Functional capture inputs, source or generator differ')
        require({key: receipt['nativeSourceBefore'][key] for key in ('bytes', 'sha256')}
                == {key: declaration[role + 'Manifest'][key] for key in ('bytes', 'sha256')}
                and {key: receipt['cases'][key] for key in ('bytes', 'sha256')}
                == {key: fixture['cases'][key] for key in ('bytes', 'sha256')}, 'Capture uses different frozen manifest or case bytes')
        require(receipt['generatorAfter'] == receipt['generator'], 'Capture generator changed while running')
        require(len(receipt['sessions']) == 4 and [(row['case'], row['form']) for row in receipt['sessions']]
                == [(row['case'], row['form']) for row in fixture['forms']]
                and all(row['status'] == 'captured_functional_structure' and row['shape'] == fixture['forms'][index][role]
                        for index, row in enumerate(receipt['sessions'])), 'Fixture does not reproduce every captured form')
        require(sum(row['shape']['actions'] for row in receipt['sessions']) == 31, 'Functional capture action count changed')
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
        require(instant(declaration['finalizedAt']) <= instant(receipt['startedAt']) <= instant(receipt['finishedAt'])
                <= instant(attribution['recordedAt']), 'Capture/attribution must follow the declared rules and complete in order')
        require(all(record in attribution['inputs'] for record in (capture['report'], capture['receipt'])),
                'Attribution must bind both capture files')
    require([row for row in attribution['inputs'] if Path(row['path']).is_absolute()] == external_baseline_inputs,
            'Attribution must retain exactly the ordered external baseline capture inputs')
    for record in attribution['inputs']:
        checked(record)
    source_evidence = [retain(ROOT / path) for path in SOURCE_PATHS]
    require(all(row['sha256'] == manifests['candidate']['files'][row['path']] for row in source_evidence), 'Candidate source evidence changed after freezing')
    require(instant(attribution['recordedAt']) <= instant(fixture['recordedAt']) <= deadline
            and instant(inventory['recordedAt']) <= deadline and instant(declaration['finalizedAt']) <= deadline,
            'Completed structural evidence and declaration must precede this contract')
    generator = retain(Path(__file__))
    for record in inputs.values():
        require(fingerprint(record['path']) == record, 'Input changed before finalization')
    require(manifests['baseline'] == native_inventory(baseline_root)
            and manifests['candidate'] == native_inventory(ROOT), 'Frozen native source changed during contract verification')
    require(args.verify_only or not output.exists(), 'Contract output appeared during preparation')
    unmeasured()
    value = {'schema': 'logos-engine.lot10c-owner-cost-contract.v2', 'lot': '10C', 'declaredAt': deadline.isoformat(),
             'performanceDirectory': perf.relative_to(ROOT).as_posix(), 'declaration': retain(declaration_path),
             'tools': tools, 'structuralExpectation': EXPECTATION, 'sourceEvidence': source_evidence,
             'ownerInventory': retain(inventory_path), 'structuralFixture': retain(fixture_path),
             'strictFailureReceipt': (perf / 'aggregation-failure.json').relative_to(ROOT).as_posix(),
             'strictFailureLog': (perf / 'aggregation-failure.log').relative_to(ROOT).as_posix(),
             'historicalAggregateOutput': (perf / 'combined-comparison.json').relative_to(ROOT).as_posix(),
             'generator': generator, 'inputsBefore': list(inputs.values()), 'inputsAfter': list(inputs.values()),
             'inputsUnchanged': True, 'measurementExecuted': False,
             'qualification': 'Prospective owner contract from actual frozen functional graph captures. No constant node/revision delta is presumed. The strict historical comparator remains a separate required gate; any actual refusal must be retained. Cost outcomes and uncaptured private measured graph values are not anticipated.'}
    if args.verify_only:
        require(value == existing, 'Existing owner contract differs from the complete unchanged proof chain')
        print(json.dumps({'status': 'owner_contract_checked', 'contract': fingerprint(output), 'measurementExecuted': False}))
        return
    with output.open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False); stream.write('\n')
    print(json.dumps({'status': 'declared_before_measurement', 'contract': fingerprint(output), 'measurementExecuted': False}))


if __name__ == '__main__':
    main()
