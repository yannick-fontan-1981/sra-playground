#!/usr/bin/env python3
"""Bind existing frozen lot5C inputs before any official cost window.

Usage: python -B docs/migration/lot5c-evidence/finalize-owner-cost-contract.py PERFORMANCE_DIRECTORY

This command reads completed captures, attribution, fixture, source inventory
and declaration. It creates one exclusive contract; it runs no other script,
test, replay or measurement. It cannot manufacture missing qualification.
"""
# Direct 5B source SHA-256: 58fd6f433ee6043c3cd24f3c763f4ede265c4b2e60374a9916807bccc68c2997.
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/migration/lot5c-evidence'
OWNER = 'public_observed_binding'
DOMAIN_REVIEW = EVIDENCE / 'recovery/coordination/cost-domain-source-review.json'
SOURCE_PATH_LIST = EVIDENCE / 'recovery/coordination/cost-source-evidence-paths.json'
ACQUISITION_DOMAIN = {
    'acquisitionMode': 'passive_nonadmitted_source_binding', 'contextAdmission': False,
    'core': None, 'methods': [], 'attentionMutation': False, 'nativeAcquisitionIncomplete': False,
    'recordOutsideOfficialBoundary': None,
    'recordAtOfficialBoundary': {'status': 'scope_changed_preserving_conditional_methods',
                                'evidence': ['before.observation_ref', 'after.observation_ref']},
    'recordPayloadKeys': ['status', 'evidence'],
    'officialBoundaryPredicate': 'before.level_epoch != after.level_epoch or after.levels_completed > before.levels_completed',
    'factCoverage': 'One exact passive source fact for each actually captured nonnull boundary return; no fact for a null return. sourceCallIndices covers every acquired return; sourceEventCallIndices is exactly the ordered nonnull subset.',
}
REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6'
INVENTORY_INPUTS = {'src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-knowledge-store.ts',
                    'src/logos-engine/v6-src-program.ts', REFERENCE + '/laya_proto/common_frontier_policy.drm.json',
                    REFERENCE + '/morphology_policy/strategy.drm'}
SOURCES = ["src/logos-engine/v6-native-runtime.ts", "src/logos-engine/v6-observed-binding.ts", "src/logos-engine/v6-observed-binding-state.ts", "src/logos-engine/v6-object-binding-common.ts", "src/logos-engine/v6-object-binding-geometry.ts", "src/logos-engine/v6-object-binding-identity.ts", "src/logos-engine/v6-object-binding-planning.ts", "src/logos-engine/v6-object-binding-reception.ts", "src/logos-engine/v6-object-binding-tracker.ts", "src/logos-engine/v6-knowledge-store.ts", "src/logos-engine/kernel.ts"]
TOUCHED = {}
EXTERNAL_INPUTS = {}
EXPECTATION = {
    'ownerId': OWNER, 'programId': 'v6.observed_binding.choose',
    'installedNodeIds': ['family_state:' + OWNER, 'family_activation:' + OWNER, 'program:v6.observed_binding.choose'],
    'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
    'mode': 'predeclared_functional_fixture',
    'qualification': 'functional_structure_frozen_before_measurement',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def exact(a, b):
    """JSON equality that cannot equate false/true with integer 0/1."""
    return json.dumps(a, sort_keys=True, separators=(',', ':'), allow_nan=False) == json.dumps(b, sort_keys=True, separators=(',', ':'), allow_nan=False)


def validate_source_coverage(fixture, attribution):
    coverage, points = attribution['sourceFactCoverage'], attribution['points']
    expected = [(form['case'], form['form'], index) for form in fixture['forms']
                for index in range(len(form['candidate']['requests']) + len(form['candidate']['inspection']))]
    require([(row['case'], row['form'], row['pointIndex']) for row in coverage] == expected
            and [(row['case'], row['form'], row['pointIndex']) for row in points] == expected,
            'Every ordered capture/inspection must have exactly one source-fact coverage row')
    for form in fixture['forms']:
        identity = (form['case'], form['form'])
        rows = [row for row in coverage if (row['case'], row['form']) == identity]
        observed = [row for row in points if (row['case'], row['form']) == identity]
        shape = form['candidate']
        require(len(shape['observations']) == len(shape['requests']), 'Every request must retain its actual acquisition observation')
        sequences = [row['sequence'] for row in shape['requests']] + [shape['actions']] * len(shape['inspection'])
        acquisitions = [row['acquiredTransitions'] for row in shape['observations']] + [shape['final']['acquiredTransitions']] * len(shape['inspection'])
        event_indices, previous_acquired = [], 0
        for index, (row, point, sequence, acquired) in enumerate(zip(rows, observed, sequences, acquisitions)):
            require(set(row) == {'case', 'form', 'pointIndex', 'acquiredReturns', 'persistedSourceFacts', 'sourceCallIndices', 'sourceEventCallIndices'},
                    'Unknown or missing source coverage field')
            require(all(type(value) is int and value >= 0 for value in (row['pointIndex'], point['pointIndex'], sequence, point['sequence'], acquired, row['acquiredReturns'], row['persistedSourceFacts']))
                    and row['pointIndex'] == point['pointIndex'] == index
                    and point['sequence'] == sequence and row['acquiredReturns'] == acquired
                    and previous_acquired <= acquired <= sequence,
                    'Source coverage must match monotone acquired transitions, which may trail an open prefix sequence')
            previous_acquired = acquired
            require(type(row['sourceCallIndices']) is list and all(type(value) is int for value in row['sourceCallIndices'])
                    and row['sourceCallIndices'] == list(range(row['acquiredReturns'])), 'Actual returns are omitted, duplicated or reordered')
            current = point['officialBoundarySourceCalls']
            require(type(current) is list and all(type(value) is int and 0 <= value < row['acquiredReturns'] for value in current)
                    and current == sorted(set(current)) and not set(current).intersection(event_indices), 'Invalid or repeated actual boundary call')
            event_indices.extend(current)
            require(type(row['sourceEventCallIndices']) is list and all(type(value) is int for value in row['sourceEventCallIndices'])
                    and event_indices == sorted(set(event_indices)) and row['sourceEventCallIndices'] == event_indices
                    and row['persistedSourceFacts'] == len(event_indices), 'Only the complete actual nonnull boundary subset may create facts')
            facts = [item for item in attribution['nodeAttributions'] if (item['case'], item['form'], item['pointIndex']) == (*identity, index)
                     and item['category'] == 'observedBinding_source_event_fact']
            require(all(type(item['pointIndex']) is int and type(item['sourceCallIndex']) is int and type(item['sourceEventCount']) is int and item['sourceEventCount'] == 1
                        and item['officialBoundary'] is True and item['sourceStatus'] == ACQUISITION_DOMAIN['recordAtOfficialBoundary']['status'] for item in facts)
                    and sorted(item['sourceCallIndex'] for item in facts) == current,
                    'Coverage must match the exact source event facts attributed at this point')
        require(rows[-1]['acquiredReturns'] == shape['final']['acquiredTransitions'] == shape['actions'], 'Final coverage omits acquired source returns')


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, 'Duplicate JSON object key: ' + key)
        value[key] = item
    return value


def invalid_constant(value):
    raise ValueError('Non-finite JSON constant: ' + value)


def read(path):
    contents = path.read_bytes()
    record = fingerprint(path)
    require(hashlib.sha256(contents).hexdigest() == record['sha256'], 'Input changed during read: ' + str(path))
    remember(record)
    return json.loads(contents, object_pairs_hook=unique_object, parse_constant=invalid_constant)


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
    require(type(record) is dict and set(record) == {'path', 'bytes', 'sha256'}
            and type(record['path']) is str and bool(record['path'])
            and type(record['bytes']) is int and record['bytes'] >= 0
            and type(record['sha256']) is str and re.fullmatch(r'[0-9a-f]{64}', record['sha256']), 'Unexpected fingerprint fields/types')
    path = (ROOT / record['path']).resolve(strict=True)
    if Path(record['path']).is_absolute():
        require(exact(EXTERNAL_INPUTS.get(record['path']), record), 'External input is not exactly predeclared by its frozen baseline capture/inventory')
    else:
        require(path != ROOT and path.is_relative_to(ROOT) and path.relative_to(ROOT).as_posix() == record['path'], 'Noncanonical or escaping local input path')
    require(exact(fingerprint(path), record), 'Input changed: ' + record['path'])
    remember(record)


def authorize_external(record, checkout):
    path = Path(record['path']).resolve(strict=True)
    require(Path(record['path']).is_absolute() and str(path) == record['path'] and path != checkout and path.is_relative_to(checkout)
            and checkout != ROOT, 'External input escapes its declared baseline checkout')
    previous = EXTERNAL_INPUTS.setdefault(record['path'], record)
    require(exact(previous, record), 'Conflicting baseline input fingerprints')


def remember(record):
    previous = TOUCHED.get(record['path'])
    require(previous is None or previous == record, 'Input changed between bindings: ' + record['path'])
    TOUCHED[record['path']] = record


def manifest_digest(files):
    return hashlib.sha256(json.dumps(dict(sorted(files.items())), separators=(',', ':'),
                                     ensure_ascii=True, allow_nan=False).encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('performance_directory', type=Path)
    args = parser.parse_args()
    generator = fingerprint(Path(__file__))
    remember(generator)
    derived_from = fingerprint(ROOT / 'docs/migration/lot5b-evidence/finalize-owner-cost-contract.py')
    require(derived_from['sha256'] == '58fd6f433ee6043c3cd24f3c763f4ede265c4b2e60374a9916807bccc68c2997', 'Direct 5B derivation bytes changed')
    verify(derived_from)
    perf = (ROOT / args.performance_directory).resolve()
    require(perf.is_relative_to(EVIDENCE) and perf.is_dir(), 'Performance directory must already exist inside lot5c-evidence')
    output = perf / 'owner-growth-contract.json'
    for name in ['window.json', 'readiness.json', 'static-preflight.json', 'owner-growth-contract.json',
                 'owner-growth-comparison.json', 'owner-growth-review.json', 'aggregation-failure.json', 'aggregation-failure.log']:
        require(not (perf / name).exists(), 'Refusing a finalized or measured window: ' + name)
    require(not any(perf.glob('cohort*/*.json')), 'Measured reports already exist')

    declaration_path = perf / 'declaration.json'
    declaration = read(declaration_path)
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2',
            'Need the actual finalized lot5C declaration')
    require(declaration['status'] == 'declared_before_official_window'
            and declaration['noOfficialWindowAtDeclaration'] is True, 'Declaration is not premeasurement')
    require(isinstance(declaration['baseline']['nativeVersion'], str)
            and type(declaration['baseline']['siteVersion']) is int and declaration['baseline']['siteVersion'] > 0,
            'The responsible owner must identify the actually published predecessor')
    domain = read(DOMAIN_REVIEW)
    path_list = read(SOURCE_PATH_LIST)
    domain_record, paths_record = fingerprint(DOMAIN_REVIEW), fingerprint(SOURCE_PATH_LIST)
    require(domain['schema'] == 'logos-engine.lot5c.cost-domain-source-review.v1' and domain['status'] == 'superseded_before_capture'
            and all(domain[key] is False for key in ['functionalCapturesStarted', 'costMeasurementsStarted', 'executionFailureClaimed'])
            and exact(domain['revisedDomain'], ACQUISITION_DOMAIN), 'The exact revised source domain must be declared before capture')
    require(exact(path_list, SOURCES) and exact(domain['sourceEvidencePaths'], SOURCES)
            and any(exact(item, paths_record) for item in domain['evidenceInputs']), 'Canonical source paths are not bound by the domain review')
    for record in domain['evidenceInputs']:
        verify(record)
    require(instant(domain['recordedAt']) <= instant(declaration['finalizedAt']), 'Domain review must precede protocol finalization')
    tools = {
        'consolidator': fingerprint(EVIDENCE / 'consolidate-owner-costs.mjs'),
        'reviewer': fingerprint(EVIDENCE / 'review-owner-costs.py'),
    }
    require(declaration['ownerCostQualification'] == {
        'schema': 'logos-engine.lot5c-owner-cost-qualification.v1',
        'contractPath': output.relative_to(ROOT).as_posix(), 'tools': tools,
    }, 'The declared contract or tools differ')
    manifests = {}
    for role in ('baseline', 'candidate'):
        record = declaration[role + 'Manifest']
        verify(record)
        manifests[role] = read(ROOT / record['path'])
        require(manifests[role]['digest'] == declaration['nativeDigests'][role], 'Declared source digest differs')
        require(type(manifests[role]['fileCount']) is int and manifests[role]['fileCount'] == len(manifests[role]['files'])
                and manifests[role]['digest'] == manifest_digest(manifests[role]['files']), 'Malformed native manifest')

    inventory_path = perf / 'owner-source-inventory.json'
    inventory = read(inventory_path)
    require(inventory['schema'] == 'logos-engine.lot5c-owner-cost-source-inventory.v1'
            and inventory['programScope'] == 'family-installed programs'
            and inventory['nativeDigests'] == declaration['nativeDigests'], 'Incorrect factory inventory')
    verify(inventory['generator'])
    verify(inventory['derivedFrom'])
    require(inventory['generator']['path'] == 'docs/migration/lot5c-evidence/record-owner-source-inventory.mjs'
            and inventory['derivedFrom']['path'] == 'docs/migration/lot5b-evidence/record-owner-source-inventory.mjs', 'Inventory generator/derivation is not the declared tool')
    baseline_checkout = Path(inventory['sourceInventory']['baseline']['checkout']).resolve(strict=True)
    for key, additions in [('owners', {OWNER}), ('programs', {'v6.observed_binding.choose'})]:
        a, b = inventory[key]['baseline'], inventory[key]['candidate']
        require(type(a) is list and type(b) is list and all(type(value) is str and bool(value) for value in a + b)
                and len(a) == len(set(a)) and len(b) == len(set(b))
                and set(b) - set(a) == additions and not set(a) - set(b), 'Unexpected ' + key + ' change')
    require(inventory['changes'] == {'ownersAdded': [OWNER], 'ownersRemoved': [], 'programsAdded': ['v6.observed_binding.choose'], 'programsRemoved': []},
            'The actual factory inventory must declare only this owner and its source workflow')
    require([owner for owner in inventory['owners']['candidate'] if owner != OWNER] == inventory['owners']['baseline'],
            'Existing owner registration order changed')
    for role in ('baseline', 'candidate'):
        source = inventory['sourceInventory'][role]
        checkout = Path(source['checkout']).resolve(strict=True)
        require(Path(source['checkout']).is_absolute() and str(checkout) == source['checkout']
                and ((role == 'candidate' and checkout == ROOT) or (role == 'baseline' and checkout != ROOT)), 'Incorrect source-inventory checkout')
        require(source['native'] == manifests[role] and source['owners'] == inventory['owners'][role]
                and source['programs'] == inventory['programs'][role]
                and source['programNodeIds'] == inventory['programNodeIds'][role], 'Factory inventory is not bound to its source freeze')
        require(source['runtimeUninitializedBeforeAndAfter'] is True, 'Factory inventory initialized a session')
        require(source['sourceDeclaredNodeIds'] == {
            'family_state': ['family_state:' + owner for owner in source['owners']],
            'family_activation': ['family_activation:' + owner for owner in source['owners']],
            'program': source['programNodeIds'],
        }, 'Declared owner/program nodes differ from the actual factory inventory')
        inputs = source['sourceInputs']
        require(len(inputs) == len(INVENTORY_INPUTS) and {record['path'] for record in inputs} == INVENTORY_INPUTS,
                'Factory source inputs are incomplete')
        for record in inputs:
            require(type(record['bytes']) is int and record['bytes'] >= 0, 'Inventory input byte count must be an integer')
            actual = fingerprint(Path(source['checkout']) / record['path'])
            require((actual['bytes'], actual['sha256']) == (record['bytes'], record['sha256']), 'Factory input changed: ' + record['path'])
            if role == 'baseline':
                authorize_external(actual, baseline_checkout)
            remember(actual)
            if record['path'] in manifests[role]['files']:
                require(record['sha256'] == manifests[role]['files'][record['path']], 'Factory input is outside its native freeze')
    require([row for row in inventory['sourceInventory']['candidate']['installations'] if row['owner'] != OWNER] == inventory['sourceInventory']['baseline']['installations'],
            'Existing family-installed program registrations changed')
    require([row for row in inventory['sourceInventory']['candidate']['installations'] if row['owner'] == OWNER] == [{'owner': OWNER, 'workflowId': 'v6.observed_binding.choose', 'nodeId': 'program:v6.observed_binding.choose'}], 'Incorrect binding workflow registration')

    fixture_path = perf / 'owner-structural-fixture.json'
    fixture = read(fixture_path)
    require(fixture['schema'] == 'logos-engine.lot5c-owner-cost-structural-fixture.v1'
            and fixture['status'] == 'qualified_functional_structure'
            and fixture['nativeDigests'] == declaration['nativeDigests'], 'Missing qualified functional fixture')
    require([(row['case'], row['form']) for row in fixture['forms']] ==
            [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')], 'The four forms must be complete and ordered')
    for form in fixture['forms']:
        for role in ('baseline', 'candidate'):
            require(form[role]['final']['implementation'] == 'logos-engine.typescript.v6.native-migration/' + declaration[role]['nativeVersion'],
                    'Captured implementation is not the declared actual version: ' + role)
    verify(fixture['cases']); verify(declaration['cases'])
    require((fixture['cases']['bytes'], fixture['cases']['sha256']) ==
            (declaration['cases']['bytes'], declaration['cases']['sha256']), 'Functional and measured cases differ')
    verify(fixture['captureTool']); verify(fixture['attribution'])
    require(fixture['captureTool']['path'] == 'docs/migration/lot5c-evidence/capture-cost-owner-graphs.mjs', 'Unexpected capture tool')
    attribution = read(ROOT / fixture['attribution']['path'])
    require(attribution['schema'] == 'logos-engine.lot5c-owner-cost-structural-attribution.v1'
            and attribution['status'] == 'qualified_functional_structure'
            and attribution['nativeDigests'] == declaration['nativeDigests'], 'Missing successful graph attribution')
    require(type(attribution['checkedCount']) is int and attribution['checkedCount'] == len(attribution['checks']) > 0
            and all(row['passed'] is True for row in attribution['checks'])
            and attribution['nodeAttributions'], 'Graph attribution is incomplete')
    require(exact(attribution['domainReview'], domain_record) and attribution['acquisitionMode'] == ACQUISITION_DOMAIN['acquisitionMode']
            and exact(attribution['acceptedBoundaryReturn'], ACQUISITION_DOMAIN['recordAtOfficialBoundary']), 'Attribution is not bound to the exact source domain')
    validate_source_coverage(fixture, attribution)
    forms_hash = hashlib.sha256(json.dumps(fixture['forms'], sort_keys=True, separators=(',', ':'),
                                          ensure_ascii=False, allow_nan=False).encode()).hexdigest()
    require(attribution['formsSha256'] == forms_hash, 'Fixture forms differ from their attribution')
    verify(attribution['generator'])
    verify(attribution['derivedFrom'])
    require(attribution['generator']['path'] == 'docs/migration/lot5c-evidence/qualify-cost-owner-graphs.mjs'
            and attribution['derivedFrom']['path'] == 'docs/migration/lot5b-evidence/qualify-cost-owner-graphs.mjs', 'Unexpected qualifier/derivation')
    baseline_capture_inputs = {}
    for role in ('baseline', 'candidate'):
        capture = fixture['captures'][role]
        verify(capture['report']); verify(capture['receipt'])
        receipt = read(ROOT / capture['receipt']['path'])
        require(receipt['schema'] == 'logos-engine.lot5c-owner-cost-functional-capture-receipt.v1'
                and receipt['role'] == role and receipt['status'] == 'captured_functional_structure'
                and receipt['nativeDigest'] == declaration['nativeDigests'][role]
                and receipt['ownerId'] == OWNER and receipt['acquisitionMode'] == 'passive_nonadmitted_source_binding'
                and exact(receipt['domainReview'], domain_record)
                and receipt['report'] == capture['report'] and receipt['generator'] == fixture['captureTool']
                and type(receipt['sessionCount']) is int and receipt['sessionCount'] == 4
                and type(receipt['actions']) is int and receipt['actions'] == 31 and not receipt['failures']
                and all(type(receipt[key]) is int and receipt[key] == 0 for key in ['measuredCostSessions', 'timingReportsRead', 'timingMetricsProduced']),
                'Capture receipt does not bind the complete functional sessions')
        require(receipt['inputsBefore'] == receipt['inputsAfter'] and receipt['generator'] == receipt['generatorAfter']
                and receipt['nativeInventoryBefore'] == receipt['nativeInventoryAfter'] == manifests[role]
                and receipt['nativeSourceUnchanged'] is True and receipt['inputsUnchanged'] is True and receipt['generatorUnchanged'] is True,
                'Capture sources or inputs changed')
        require(Path(receipt['checkout']).is_absolute()
                and Path(receipt['checkout']).resolve(strict=True) == (baseline_checkout if role == 'baseline' else ROOT), 'Capture and inventory checkout differ')
        require(instant(domain['recordedAt']) <= instant(receipt['startedAt']) <= instant(receipt['finishedAt']) <= instant(attribution['recordedAt']), 'Domain/capture/attribution chronology differs')
        for record in receipt['inputsBefore']:
            if Path(record['path']).is_absolute():
                require(role == 'baseline', 'Only baseline capture may bind external inputs')
                authorize_external(record, baseline_checkout)
                baseline_capture_inputs[record['path']] = record
            verify(record)
        require(any(exact(item, domain_record) for item in receipt['inputsBefore'])
                and any(exact(item, paths_record) for item in receipt['inputsBefore']), 'Capture omits declared domain/path-list inputs')
    require(len(attribution['inputs']) == len({item['path'] for item in attribution['inputs']}), 'Duplicate attribution input')
    for record in attribution['inputs']:
        if Path(record['path']).is_absolute():
            require(exact(baseline_capture_inputs.get(record['path']), record), 'External attribution input was not pinned by its actual baseline capture')
        verify(record)
    require(all(any(exact(item, required) for item in attribution['inputs']) for required in [domain_record, paths_record]), 'Attribution omits declared domain/path-list inputs')

    sources = [fingerprint(ROOT / path) for path in SOURCES]
    for record in sources:
        require(record['sha256'] == manifests['candidate']['files'][record['path']], 'Source differs from the final candidate freeze')
        require(any(item == record for item in attribution['inputs']), 'Source evidence is absent from attribution')
    now = stamp()
    require(instant(attribution['recordedAt']) <= instant(fixture['recordedAt']) <= instant(now)
            and instant(inventory['recordedAt']) <= instant(now)
            and instant(declaration['finalizedAt']) <= instant(now), 'Premeasurement chronology differs')
    for record in list(TOUCHED.values()):
        verify(record)
    result = {
        'schema': 'logos-engine.lot5c-owner-cost-contract.v2', 'lot': '5C', 'declaredAt': now,
        'generator': generator, 'derivedFrom': derived_from,
        'domainReview': domain_record, 'sourceEvidencePaths': paths_record, 'acquisitionDomain': ACQUISITION_DOMAIN,
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
