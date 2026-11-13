#!/usr/bin/env python3
"""Bind existing frozen lot6B inputs before any official cost window.

Usage: python -B docs/migration/lot6b-evidence/finalize-owner-cost-contract.py PERFORMANCE_DIRECTORY

This command reads completed captures, attribution, fixture, source inventory
and declaration. It creates one exclusive contract; it runs no other script,
test, replay or measurement. It cannot manufacture missing qualification.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import struct
import re
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/migration/lot6b-evidence'
OWNER = 'selected_rigid'
REFERENCE = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6'
INVENTORY_INPUTS = {'src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-knowledge-store.ts',
                    'src/logos-engine/v6-src-program.ts', REFERENCE + '/laya_proto/common_frontier_policy.drm.json',
                    REFERENCE + '/morphology_policy/strategy.drm'}
SOURCES = ['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-selected-rigid.ts', 'src/logos-engine/v6-selected-rigid-types.ts', 'src/logos-engine/v6-selected-rigid-geometry.ts', 'src/logos-engine/v6-selected-rigid-search.ts', 'src/logos-engine/v6-knowledge-store.ts', 'src/logos-engine/kernel.ts']
TOUCHED = {}
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
    require(set(record) == {'path', 'bytes', 'sha256'}, 'Unexpected fingerprint fields')
    require(fingerprint(ROOT / record['path']) == record, 'Input changed: ' + record['path'])
    remember(record)


def remember(record):
    previous = TOUCHED.get(record['path'])
    require(previous is None or previous == record, 'Input changed between bindings: ' + record['path'])
    TOUCHED[record['path']] = record


def manifest_digest(files):
    return hashlib.sha256(json.dumps(dict(sorted(files.items())), separators=(',', ':'),
                                     ensure_ascii=True, allow_nan=False).encode()).hexdigest()



def validate_common_value_attribution(attribution, receipts, fixture):
    """Validate emitted records; the pinned qualifier owns exhaustive graph traversal."""
    comparison = 'exact_except_attributed_trace_envelope_created'
    sources = ['src/logos-engine/v6-reasoning-memory.ts', 'src/logos-engine/v6-native-authority.ts']
    roles = ('baseline', 'candidate')

    def need(condition, message):
        if not condition:
            raise ValueError('Trace-created attribution: ' + message)

    def exact(left, right):
        if isinstance(left, bool) or isinstance(right, bool):
            return type(left) is type(right) and left == right
        if isinstance(left, (int, float)) and isinstance(right, (int, float)):
            return left == right
        if type(left) is not type(right):
            return False
        if isinstance(left, dict):
            return left.keys() == right.keys() and all(exact(left[key], right[key]) for key in left)
        if isinstance(left, list):
            return len(left) == len(right) and all(exact(a, b) for a, b in zip(left, right))
        return left == right

    def integer(value, minimum=0):
        return type(value) is int and minimum <= value <= 9007199254740991

    def millis(value):
        need(isinstance(value, str), 'timestamp must be a string')
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        need(parsed.tzinfo is not None and parsed.utcoffset().total_seconds() == 0
             and parsed.isoformat(timespec='milliseconds').replace('+00:00', 'Z') == value,
             'timestamp must use canonical UTC milliseconds')
        delta = parsed - datetime(1970, 1, 1, tzinfo=timezone.utc)
        result = delta.days * 86400000 + delta.seconds * 1000 + delta.microseconds // 1000
        need(integer(result), 'timestamp must be a nonnegative safe integer')
        return result

    def fingerprint(record):
        need(isinstance(record, dict) and set(record) == {'path', 'bytes', 'sha256'}
             and isinstance(record['path'], str) and bool(record['path'])
             and integer(record['bytes']) and isinstance(record['sha256'], str)
             and re.fullmatch(r'[0-9a-f]{64}', record['sha256']) is not None, 'invalid fingerprint')

    need(attribution['schema'] == 'logos-engine.lot6b-owner-cost-structural-attribution.v1'
         and attribution['status'] == 'qualified_functional_structure'
         and exact(attribution['failures'], []), 'qualification is not successful')
    need(set(receipts) == set(roles) and set(fixture['captures']) == set(roles)
         and exact(attribution['nativeDigests'], fixture['nativeDigests']), 'role/source binding differs')
    policy = attribution['commonValuePolicy']
    need(isinstance(policy, dict) and set(policy) == {'comparison', 'permittedMetadataDifference',
         'identityValueAttributions', 'unattributedDifferencesAllowed', 'traceCreatedAttribution'}, 'policy keys differ')
    need(exact({key: value for key, value in policy.items() if key != 'traceCreatedAttribution'}, {
         'comparison': comparison, 'permittedMetadataDifference': 'origin.source_digest',
         'identityValueAttributions': [], 'unattributedDifferencesAllowed': 0}), 'only the named policy is accepted')
    temporal = policy['traceCreatedAttribution']
    need(isinstance(temporal, dict) and set(temporal) == {'nodeComponent', 'path', 'sourceClock', 'sourceFiles',
         'captureWindows', 'stabilityKey', 'records', 'allOtherFieldsExact'}, 'temporal policy keys differ')
    need(exact({key: value for key, value in temporal.items() if key not in ('captureWindows', 'records')}, {
         'nodeComponent': 'native_reasoning_trace', 'path': '/value/root/members/created/bits',
         'sourceClock': 'Date.now() / 1000', 'sourceFiles': sources,
         'stabilityKey': ['role', 'sessionId', 'nodeId'], 'allOtherFieldsExact': True}), 'temporal exception was broadened')
    inputs = attribution['inputs']
    need(isinstance(inputs, list), 'inputs must be listed')
    for record in inputs:
        fingerprint(record)
    need(len({record['path'] for record in inputs}) == len(inputs), 'duplicate input path')
    generator = attribution['generator']
    fingerprint(generator)
    need(generator['path'] == 'docs/migration/lot6b-evidence/qualify-cost-owner-graphs.mjs'
         and any(exact(generator, record) for record in inputs), 'qualifier is not bound')
    forms = fixture['forms']
    need([(form['case'], form['form']) for form in forms] ==
         [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')], 'functional forms differ')
    windows, sessions, expected_points = {}, {}, None
    for role in roles:
        receipt = receipts[role]
        need(receipt['schema'] == 'logos-engine.lot6b-owner-cost-functional-capture-receipt.v1'
             and receipt['status'] == 'captured_functional_structure' and receipt['role'] == role
             and receipt['nativeDigest'] == attribution['nativeDigests'][role]
             and exact(receipt['report'], fixture['captures'][role]['report'])
             and exact(receipt['generator'], fixture['captureTool']), 'capture role/source/report differs')
        need(exact(receipt['nativeInventoryBefore'], receipt['nativeInventoryAfter'])
             and receipt['nativeInventoryBefore']['digest'] == receipt['nativeDigest']
             and exact(receipt['inputsBefore'], receipt['inputsAfter'])
             and exact(receipt['generator'], receipt['generatorAfter'])
             and all(receipt[key] is True for key in ('nativeSourceUnchanged', 'inputsUnchanged', 'generatorUnchanged'))
             and exact(receipt['failures'], []), 'capture integrity differs')
        for record in fixture['captures'][role].values():
            fingerprint(record)
            need(any(exact(record, item) for item in inputs), 'capture receipt/report is absent from qualifier inputs')
        for path in sources:
            source = [record for record in inputs if record['path'] == path]
            need(len(source) == 1 and source[0]['sha256'] == receipt['nativeInventoryBefore']['files'][path],
                 'clock source is not bound to both captured native manifests: ' + path)
        start, finish = millis(receipt['startedAt']), millis(receipt['finishedAt'])
        need(start <= finish, 'capture interval is reversed')
        windows[role] = {'startedAt': receipt['startedAt'], 'finishedAt': receipt['finishedAt'],
                         'startMs': start, 'finishMs': finish}
        need(integer(receipt['sessionCount'], 1) and receipt['sessionCount'] == len(receipt['sessions']) == len(forms),
             'capture session count differs')
        session_map, point_keys = {}, []
        for session, form in zip(receipt['sessions'], forms):
            sid = 'lot6b-owner-cost-' + form['case'].lower() + '-' + form['form']
            need((session['case'], session['form'], session['sessionId']) == (form['case'], form['form'], sid)
                 and session['status'] == 'captured_functional_structure' and sid not in session_map,
                 'capture session identity differs')
            need(integer(session['captures'], 1) and integer(session['terminalInspections'])
                 and session['captures'] == len(session['shape']['requests'])
                 and session['terminalInspections'] == len(session['shape']['inspection'])
                 and exact(session['shape'], form[role]), 'session point counters differ')
            session_map[sid] = session
            point_keys.extend((form['case'], form['form'], index)
                              for index in range(session['captures'] + session['terminalInspections']))
        sessions[role] = session_map
        if expected_points is None:
            expected_points = point_keys
        need(point_keys == expected_points, 'roles cover different functional points')
    need(exact(temporal['captureWindows'], windows), 'policy windows differ from bound capture receipts')
    points = attribution['points']
    need(isinstance(points, list) and bool(points)
         and [(point['case'], point['form'], point['pointIndex']) for point in points] == expected_points,
         'point coverage is empty, omitted, duplicated or reordered')
    expected_coverage = []
    for point in points:
        need(integer(point['pointIndex']) and integer(point['baselineNodeCount'], 1)
             and integer(point['baselineDeltaCount']), 'common comparison counters are invalid')
        expected_coverage.append({**{key: point[key] for key in ('case', 'form', 'pointIndex')},
             'commonNodesCompared': point['baselineNodeCount'], 'commonDeltasCompared': point['baselineDeltaCount'],
             'comparison': comparison, 'unattributedDifferences': 0})
    need(exact(attribution['commonValueCoverage'], expected_coverage), 'common values lack exact complete point coverage')
    records = temporal['records']
    need(isinstance(records, list) and bool(records), 'temporal record register is empty')
    seen, pairs, represented = set(), {}, set()
    for record in records:
        need(isinstance(record, dict) and set(record) == {'role', 'sessionId', 'nodeId', 'bits', 'seconds',
             'milliseconds', 'createdAt', 'captureStartedAt', 'captureFinishedAt'}, 'record schema differs')
        role, sid, node_id = record['role'], record['sessionId'], record['nodeId']
        need(role in roles and isinstance(sid, str) and sid in sessions[role], 'record role/session is foreign')
        match = re.fullmatch(r'reasoning:trace:([1-9][0-9]*)', node_id) if isinstance(node_id, str) else None
        need(match is not None and integer(int(match[1]), 1), 'record does not name a real trace')
        key = (role, sid, node_id)
        need(key not in seen, 'duplicate or unstable role/session/trace')
        seen.add(key); represented.add((role, sid)); pairs.setdefault((sid, node_id), set()).add(role)
        bits = record['bits']
        need(isinstance(bits, str) and re.fullmatch(r'[0-9a-f]{16}', bits) is not None, 'invalid float64 bits')
        seconds = struct.unpack('>d', bytes.fromhex(bits))[0]
        ms = record['milliseconds']
        need(type(record['seconds']) in (int, float) and math.isfinite(seconds) and integer(ms)
             and record['seconds'] == seconds == ms / 1000 and math.floor(seconds * 1000 + 0.5) == ms,
             'record is not the exact finite millisecond clock encoding')
        window = windows[role]
        need(window['startMs'] <= ms <= window['finishMs'] and millis(record['createdAt']) == ms
             and record['captureStartedAt'] == window['startedAt']
             and record['captureFinishedAt'] == window['finishedAt'], 'record escapes its role capture interval')
    need(all(pair == set(roles) for pair in pairs.values()), 'a trace is missing its baseline/candidate pair')
    need(represented == {(role, sid) for role in roles for sid in sessions[role]}, 'a captured session has no trace records')
    # No trace-count formula: unique records cannot independently prove that no
    # trace was omitted. That guarantee remains in the fingerprinted qualifier's
    # complete common-node/delta traversal; graph bodies, origins, chains and
    # tickets are not reopened or normalized by this local record validator.
    return True

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('performance_directory', type=Path)
    args = parser.parse_args()
    generator = fingerprint(Path(__file__))
    remember(generator)
    perf = (ROOT / args.performance_directory).resolve()
    require(perf.is_relative_to(EVIDENCE) and perf.is_dir(), 'Performance directory must already exist inside lot6b-evidence')
    output = perf / 'owner-growth-contract.json'
    for name in ['window.json', 'readiness.json', 'static-preflight.json', 'owner-growth-contract.json',
                 'owner-growth-comparison.json', 'owner-growth-review.json', 'aggregation-failure.json', 'aggregation-failure.log']:
        require(not (perf / name).exists(), 'Refusing a finalized or measured window: ' + name)
    require(not any(perf.glob('cohort*/*.json')), 'Measured reports already exist')

    declaration_path = perf / 'declaration.json'
    declaration = read(declaration_path)
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2',
            'Need the actual finalized lot6B declaration')
    require(declaration['status'] == 'declared_before_official_window'
            and declaration['noOfficialWindowAtDeclaration'] is True, 'Declaration is not premeasurement')
    require(declaration['baseline']['nativeVersion'] == '0.63.0'
            and declaration['candidate']['nativeVersion'] == '0.64.0'
            and type(declaration['baseline']['siteVersion']) is int and declaration['baseline']['siteVersion'] > 0,
            'The responsible owner must identify the actually published 0.63 predecessor and frozen 0.64 candidate')
    tools = {
        'consolidator': fingerprint(EVIDENCE / 'consolidate-owner-costs.mjs'),
        'reviewer': fingerprint(EVIDENCE / 'review-owner-costs.py'),
    }
    require(declaration['ownerCostQualification'] == {
        'schema': 'logos-engine.lot6b-owner-cost-qualification.v1',
        'contractPath': output.relative_to(ROOT).as_posix(), 'tools': tools,
    }, 'The declared contract or tools differ')
    manifests = {}
    for role in ('baseline', 'candidate'):
        record = declaration[role + 'Manifest']
        verify(record)
        manifests[role] = read(ROOT / record['path'])
        require(manifests[role]['digest'] == declaration['nativeDigests'][role], 'Declared source digest differs')
        require(manifests[role]['fileCount'] == len(manifests[role]['files'])
                and manifests[role]['digest'] == manifest_digest(manifests[role]['files']), 'Malformed native manifest')

    inventory_path = perf / 'owner-source-inventory.json'
    inventory = read(inventory_path)
    require(inventory['schema'] == 'logos-engine.lot6b-owner-cost-source-inventory.v1'
            and inventory['programScope'] == 'family-installed programs'
            and inventory['nativeDigests'] == declaration['nativeDigests'], 'Incorrect factory inventory')
    verify(inventory['generator'])
    verify(inventory['derivedFrom'])
    for key, additions in [('owners', {OWNER}), ('programs', set())]:
        a, b = inventory[key]['baseline'], inventory[key]['candidate']
        require(len(a) == len(set(a)) and len(b) == len(set(b))
                and set(b) - set(a) == additions and not set(a) - set(b), 'Unexpected ' + key + ' change')
    require(inventory['changes'] == {'ownersAdded': [OWNER], 'ownersRemoved': [], 'programsAdded': [], 'programsRemoved': []},
            'The actual factory inventory must declare only this owner and no additional SRC workflow')
    require([owner for owner in inventory['owners']['candidate'] if owner != OWNER] == inventory['owners']['baseline'],
            'Existing owner registration order changed')
    for role in ('baseline', 'candidate'):
        source = inventory['sourceInventory'][role]
        require(source['nativeVersion'] == declaration[role]['nativeVersion'], 'Factory inventory version differs from the declaration')
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
            actual = fingerprint(Path(source['checkout']) / record['path'])
            require((actual['bytes'], actual['sha256']) == (record['bytes'], record['sha256']), 'Factory input changed: ' + record['path'])
            remember(actual)
            if record['path'] in manifests[role]['files']:
                require(record['sha256'] == manifests[role]['files'][record['path']], 'Factory input is outside its native freeze')
    require(inventory['sourceInventory']['candidate']['installations'] == inventory['sourceInventory']['baseline']['installations'],
            'Existing family-installed program registrations changed')

    fixture_path = perf / 'owner-structural-fixture.json'
    fixture = read(fixture_path)
    require(fixture['schema'] == 'logos-engine.lot6b-owner-cost-structural-fixture.v1'
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
    attribution = read(ROOT / fixture['attribution']['path'])
    require(attribution['schema'] == 'logos-engine.lot6b-owner-cost-structural-attribution.v1'
            and attribution['status'] == 'qualified_functional_structure'
            and attribution['nativeDigests'] == declaration['nativeDigests'], 'Missing successful graph attribution')
    require(attribution['checkedCount'] == len(attribution['checks']) > 0
            and all(row['passed'] is True for row in attribution['checks'])
            and attribution['nodeAttributions'], 'Graph attribution is incomplete')
    coverage = attribution['sourceFactCoverage']
    require([(row['case'], row['form'], row['pointIndex']) for row in coverage] ==
            [(row['case'], row['form'], row['pointIndex']) for row in attribution['points']], 'Source-fact coverage omits a captured point')
    for form in fixture['forms']:
        rows = [row for row in coverage if (row['case'], row['form']) == (form['case'], form['form'])]
        require(len(rows) == len(form['candidate']['requests']) + len(form['candidate']['inspection'])
                and [row['pointIndex'] for row in rows] == list(range(len(rows))), 'Source-fact coverage is incomplete or reordered')
        for row in rows:
            require(type(row['acquiredReturns']) is int and row['acquiredReturns'] == 0
                    and row['persistedSourceFacts'] == 0 and row['sourceCallIndices'] == []
                    and type(row['capturedNegativeProposals']) is int and row['capturedNegativeProposals'] >= 0,
                    'SelectedRigid must not acquire any selected or passive return in the fixed common-loop cost traces')
    forms_hash = hashlib.sha256(json.dumps(fixture['forms'], sort_keys=True, separators=(',', ':'),
                                          ensure_ascii=False, allow_nan=False).encode()).hexdigest()
    require(attribution['formsSha256'] == forms_hash, 'Fixture forms differ from their attribution')
    verify(attribution['generator'])
    verify(attribution['derivedFrom'])
    for record in attribution['inputs']:
        verify(record)
    capture_receipts = {}
    for role in ('baseline', 'candidate'):
        capture = fixture['captures'][role]
        verify(capture['report']); verify(capture['receipt'])
        receipt = read(ROOT / capture['receipt']['path'])
        capture_receipts[role] = receipt
        require(receipt['schema'] == 'logos-engine.lot6b-owner-cost-functional-capture-receipt.v1'
                and receipt['role'] == role and receipt['status'] == 'captured_functional_structure'
                and receipt['nativeDigest'] == declaration['nativeDigests'][role]
                and receipt['nativeVersion'] == declaration[role]['nativeVersion']
                and receipt['ownerId'] == OWNER and receipt['acquisitionMode'] == 'selected_only_source_owner_no_passive_returns'
                and receipt['report'] == capture['report'] and receipt['generator'] == fixture['captureTool']
                and receipt['sessionCount'] == 4 and receipt['actions'] == 31 and not receipt['failures'],
                'Capture receipt does not bind the complete functional sessions')
        require(receipt['inputsBefore'] == receipt['inputsAfter'] and receipt['generator'] == receipt['generatorAfter']
                and receipt['nativeInventoryBefore'] == receipt['nativeInventoryAfter'] == manifests[role]
                and receipt['nativeSourceUnchanged'] is True and receipt['inputsUnchanged'] is True and receipt['generatorUnchanged'] is True,
                'Capture sources or inputs changed')
        require(instant(receipt['finishedAt']) <= instant(attribution['recordedAt']), 'Attribution predates capture')

    validate_common_value_attribution(attribution, capture_receipts, fixture)

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
        'schema': 'logos-engine.lot6b-owner-cost-contract.v2', 'lot': '6B', 'declaredAt': now,
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
