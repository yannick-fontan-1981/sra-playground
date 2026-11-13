#!/usr/bin/env python3
"""Validate retained v50 proofs without running a game, native agent or test suite.

Only the independent original-provider comparator runs, with read-only --verify.
The sole output is validation.json; --verify leaves all retained evidence unchanged.
LIFE reaches three official levels, entering level four without a full-game WIN.
Source-provider agreement is bounded to the actual native public transitions.
"""
from __future__ import annotations

import argparse
from collections import Counter
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import tarfile
from urllib.parse import parse_qs, urlsplit

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v50'
SOURCE_DIGEST = '66529083d89d420f9d198e99c8639ee174f1d829380d0d71eb86432ad184a94f'
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.20.0'
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'
PREVIOUS_RELEASE_COMMIT = 'ac5015493dee4094c9f358f63aee6fb68c30d770'
REFERENCE_COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
REFERENCE = ROOT / 'reference/v6' / REFERENCE_COMMIT
TEST_FILES = [
    'tests/v6-typed-material-reference.test.ts',
    'tests/v6-typed-material-kernel.test.ts',
    'tests/v6-material-recovery-priority.test.ts',
    'tests/v6-program-control-discovery-integration.test.ts',
    'tests/v6-occluded-catalogue-kernel.test.ts',
    'tests/v6-shared-series.test.ts',
    'tests/v6-shared-series-native.test.ts',
    'tests/v6-native-runtime.test.ts',
    'tests/v6-native-family-registration.test.ts',
    'tests/v6-native-checkpoint-integration.test.ts',
    'tests/v6-native-caller.test.ts',
    'tests/v6-caller-integration.test.ts',
    'tests/v6-queued-field-kernel.test.ts',
    'tests/v6-trace-continuation.test.ts',
    'tests/v6-acquired-continuation-priority.test.ts',
    'tests/v6-learned-preparation-priority.test.ts',
    'tests/v6-cell-placement-integration.test.ts',
    'tests/v6-labeled-sequence-integration.test.ts',
    'tests/v6-product-panel-integration.test.ts',
    'tests/v6-linked-packet-kernel.test.ts',
    'tests/v6-v45-kernel-integration.test.ts',
]
REGRESSIONS = [('STCK', 3, 35, 15), ('CATL', 6, 48, 48),
               ('SELE', 3, 44, 44), ('COLM', 3, 45, 21), ('ZIPP', 6, 101, 40), ('GRIL', 3, 19, 19)]
PUBLIC_FIELDS = {'frame_rows', 'frame_packet', 'level', 'levels_completed',
                 'state', 'step_index', 'available_action_refs', 'frame_hash'}
OWN_KINDS = {'typed_carrier_response', 'typed_material_flow', 'typed_pose_scope', 'typed_pose_model', 'typed_pose_response'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)


def proof(path):
    return {'path': path.relative_to(ROOT).as_posix(),
            'sha256': sha(path), 'bytes': path.stat().st_size}


def check_file(item):
    path = ROOT / item['path']
    require(path.is_file(), f'Missing evidence: {item["path"]}')
    require(sha(path) == item['sha256'], f'Changed evidence: {item["path"]}')
    if 'bytes' in item:
        require(path.stat().st_size == item['bytes'], f'Changed size: {item["path"]}')
    return path


def check_map(items):
    for name, expected in items.items():
        check_file({'path': name, 'sha256': expected})


def file_inventory(folders):
    return {p.relative_to(ROOT).as_posix() for folder in folders
            for p in (ROOT / folder).rglob('*') if p.is_file()}


def packet_hash(packet):
    return hashlib.sha256(json.dumps(packet, ensure_ascii=False,
                                    separators=(',', ':')).encode()).hexdigest()


def tap_counts(output):
    tap = gzip.decompress(check_file(output).read_bytes()).decode()
    counts = {}
    for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']:
        matches = re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M)
        require(len(matches) == 1, f'Missing or ambiguous TAP count: {key}')
        counts[key] = int(matches[0])
    require(counts['tests'] == counts['pass'] and counts['tests'] > 0 and
            all(counts[key] == 0 for key in ['fail', 'cancelled', 'skipped', 'todo']),
            'TAP output contains unsuccessful tests')
    return counts, tap


def validate_source():
    source = read(OUT / 'source-manifest-final.json')
    paths = {name for name in file_inventory(['src/logos-engine', 'src/runtime'])
             if Path(name).suffix in ['.ts', '.json', '.drm']}
    require(source['fileCount'] == len(source['files']) == 170,
            'The frozen source must contain exactly 170 files')
    require(paths == set(source['files']), 'Native source inventory changed')
    digest = hashlib.sha256(json.dumps(source['files'], sort_keys=True,
                                      separators=(',', ':')).encode()).hexdigest()
    require(source['digest'] == digest == SOURCE_DIGEST, 'Native source digest changed')
    check_map(source['files'])
    return source


def validate_execution(execution, source, exit_code=0):
    require(execution['exitCode'] == exit_code, 'Unexpected recorded process exit code')
    require(execution['nativeSourceUnchanged'] is True, 'Source changed during execution')
    require(execution['nativeSource'] == execution['nativeSourceAfter'] == source,
            'Execution source differs from the frozen source')
    for key in ['generator', 'output']:
        check_file(execution[key])
    if 'nativeSourceManifestDigest' in execution:
        require(execution['nativeSourceManifestDigest'] == source['digest'],
                'Execution manifest digest mismatch')
    if 'harnessFileSha256' in execution:
        require(execution['harnessFilesUnchanged'] is True and
                execution['harnessFileSha256'] == execution['harnessFileSha256After'],
                'Regression harness changed during execution')
        check_map(execution['harnessFileSha256'])
    for item in execution.get('inputs', {}).values():
        check_file(item)


def validate_report(report, source, status='passed'):
    require(report['status'] == status and report['sourceUnchangedDuringRun'] is True,
            f'{report["game"]}: unexpected status or source mutation')
    require(report['source'] == source and report['pythonAgentModules'] == [],
            f'{report["game"]}: wrong source or Python agent modules')
    final = report['final']
    require(final['sessions'] == 1 and final['nativeImplementation'] == IMPLEMENTATION
            and final['fullV6Parity'] is False, 'Session or implementation mismatch')
    require(final['actions'] == final['caller']['acquiredTransitions'] == len(report['actions']),
            'Every public action must be acquired exactly once')
    require(final['prefixes'] == len(report['prefixes']) and
            sum(p['acquiredActions'] for p in report['prefixes']) == final['actions'],
            'Prefix acquisition totals mismatch')
    require(final['operationCounts']['init'] == 1 and
            final['operationCounts']['advance'] == final['actions'],
            'Unexpected init or advance count')
    require(dict(Counter(r['operation'] for r in report['requests'])) == final['operationCounts'],
            'Request operations disagree with final counts')
    require(set(final['operationCounts']) == {'init', 'advance', 'resume'},
            'Unexpected operation in a common session')
    require(all(p['operations'] == ['OP29', 'OP30', 'OP31'] for p in report['prefixes']),
            'A prefix did not pass through the Kernel acquisition operations')
    require([a['sequence'] for a in report['actions']] == list(range(1, final['actions'] + 1)),
            'Non-contiguous action sequence')
    require(all(b['sessionRetained'] is True for b in report['boundaries']),
            'A level boundary did not retain the session')
    require(report['initial']['level'] == 1 and report['initial']['levelsCompleted'] == 0
            and report['initial']['state'] == 'NOT_FINISHED', 'Campaign was not cold-started')
    require(report['budget'] == {
        'levelActionCaps': [600] * report['targetLevels'], 'activeSecondsPerLevel': 360,
        'clock': 'real active compute and native execution'}, 'Production budget changed')
    for name, expected in report['gameAssets'].items():
        check_file({'path': 'public/python/' + name, 'sha256': expected})


def validate_trace(report, path, current_source=True):
    trace = read(path)
    require(trace['schema'] == 'logos-engine.native-public-game-trace.v1', 'Wrong trace schema')
    require(trace['status'] == report['status'] and trace['game'] == report['game'],
            'Trace status or game differs from its campaign')
    if current_source:
        require(trace['sourceDigest'] == SOURCE_DIGEST, 'Trace source differs from release')
    packets = trace['packets']
    require(len(packets) == len(report['actions']) + 1 and packets[0]['command'] is None,
            'Incomplete public trajectory')
    require(packet_hash(packets[0]['packet']) == report['initial']['publicPacketSha256'],
            'Initial complete public packet changed')
    for item, action in zip(packets[1:], report['actions']):
        require(item['command'] == action['command'], 'Trace command differs from acquired action')
        require(packet_hash(item['packet']) == action['publicPacketSha256'],
                'Complete public packet hash differs from acquired return')
        require(len(item['packet']['frame_packet']) == action['animationFrames'],
                'Animation packet was truncated')
        require((item['packet']['level'], item['packet']['levels_completed'], item['packet']['state'])
                == (action['levelAfter'], action['completedAfter'], action['state']),
                'Action result disagrees with complete public return')
    return {'completePublicPackets': len(packets), 'animationFramesIncludingInitial':
            sum(len(item['packet']['frame_packet']) for item in packets)}


def validate_checks(source):
    path = OUT / 'validation/checks-run.json'
    checks = read(path)
    require(checks['schema'] == 'logos-engine.v50.actual-release-checks.v1' and
            checks['status'] == 'passed' and checks['nativeSourceUnchanged'] is True and
            checks['nativeSource'] == checks['nativeSourceAfter'] == source and
            checks['nativeSourceManifestDigest'] == SOURCE_DIGEST, 'Build/check source mismatch')
    require([c['name'] for c in checks['checks']] ==
            ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build'],
            'A required release check is missing')
    check_file(checks['generator'])
    for check in checks['checks']:
        require(check['exitCode'] == 0, f'Release check failed: {check["name"]}')
        check_file(check['output'])
    extras = {'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'index.html',
              '.openai/hosting.json', 'scripts/prepare-python.mjs', 'scripts/python-runtime-assets.json',
              'scripts/generate-content-pages.mjs', 'scripts/generate-game-gallery.mjs'}
    require(set(checks['buildInputs']) == file_inventory(['src', 'public', 'content']) | extras,
            'Build input inventory changed')
    check_map(checks['buildInputs'])
    worker = check_file(checks['nativeAgentWorker'])
    require(IMPLEMENTATION in worker.read_text(), 'Built worker does not identify the release implementation')
    require(read(ROOT / '.openai/hosting.json') ==
            {'project_id': PROJECT, 'static': {'directory': 'dist'}}, 'Hosting destination changed')
    return {'receipt': proof(path), 'nativeAgentWorker': checks['nativeAgentWorker']}


def image_properties(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        require(data[12:16] == b'IHDR' and len(data) >= 24, 'Invalid PNG dimensions')
        return {'format': 'PNG', 'width': int.from_bytes(data[16:20], 'big'),
                'height': int.from_bytes(data[20:24], 'big')}
    require(data.startswith(b'\xff\xd8'), 'Unknown retained screenshot format')
    offset = 2
    # Read JPEG metadata only; SOF dimensions do not depend on a display scale or DOM viewport.
    while offset < len(data):
        require(data[offset] == 0xff, 'Invalid JPEG marker')
        while offset < len(data) and data[offset] == 0xff: offset += 1
        require(offset < len(data), 'Truncated JPEG marker')
        marker = data[offset]; offset += 1
        if marker in [0x01, 0xd8] or 0xd0 <= marker <= 0xd7: continue
        require(marker not in [0xd9, 0xda] and offset + 2 <= len(data), 'Missing JPEG frame header')
        length = int.from_bytes(data[offset:offset + 2], 'big')
        require(length >= 2 and offset + length <= len(data), 'Invalid JPEG metadata length')
        if marker in [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]:
            require(length >= 8, 'Truncated JPEG frame dimensions')
            return {'format': 'JPEG', 'width': int.from_bytes(data[offset + 5:offset + 7], 'big'),
                    'height': int.from_bytes(data[offset + 3:offset + 5], 'big')}
        offset += length
    raise ValueError('No JPEG dimensions found')


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def material_canonical(value):
    """Retained finite native identity spelling, including explicit signed zero."""
    if value is None: return 'null'
    if value is True: return 'true'
    if value is False: return 'false'
    if isinstance(value, str): return json.dumps(value, ensure_ascii=True)
    if isinstance(value, (int, float)):
        require(math.isfinite(value), 'Non-finite material identity input')
        if value == 0 and math.copysign(1, value) < 0: return '-0.0'
        if float(value).is_integer():
            require(abs(value) <= 9007199254740991, 'Unsafe material identity integer')
            return str(int(value))
        rendered = repr(value)
        require('e' not in rendered.lower(), 'Unqualified exponent spelling in material receipt')
        return rendered
    if isinstance(value, list): return '[' + ','.join(material_canonical(item) for item in value) + ']'
    if isinstance(value, dict):
        return '{' + ','.join(json.dumps(key, ensure_ascii=True) + ':' + material_canonical(item) for key, item in sorted(value.items())) + '}'
    raise ValueError('Unsupported material identity input')


def material_hash(value):
    return hashlib.sha256(material_canonical(value).encode()).hexdigest()


def restore_signed_zero(value, paths):
    result = copy.deepcopy(value)
    for path in paths:
        item = result
        for key in path[:-1]: item = item[key]
        require(type(item[path[-1]]) in [int, float] and item[path[-1]] == 0, 'Signed-zero path lost its numeric zero')
        item[path[-1]] = -0.0
    return result


def evidence_references(value):
    if isinstance(value, str) and value: return [value]
    require(isinstance(value, list), 'Invalid retained observation evidence reference')
    return [reference for item in value for reference in evidence_references(item)]


def raw_command(command):
    if command.get('data') == {} and command['action_ref'] != 'ACTION6':
        require(set(command) == {'action_ref', 'data'}, 'Unexpected scalar transport fields')
        return {'action_ref': command['action_ref']}
    return command


def validate_campaign(source):
    path, trace_path, execution_path = [OUT / name for name in
        ['life-three-levels-final.json', 'life-public-trace-final.json.gz', 'logs/execution-life-final.json']]
    campaign, execution = read(path), read(execution_path)
    require(campaign['schema'] == 'logos-engine.v6.integrated-game-campaign.v1' and
            campaign['game'] == 'LIFE' and campaign['targetLevels'] == 3 and campaign['referenceCommit'] == REFERENCE_COMMIT and
            campaign['baseline'] is None and campaign['failure'] is None, 'Wrong corrected actual campaign identity')
    validate_report(campaign, source)
    require(execution['schema'] == 'logos-engine.v50.actual-campaign-execution.v1', 'Campaign execution schema changed')
    validate_execution(execution, source)
    require(execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', 'LIFE', '3', str(path), str(trace_path)] and
            execution['generator']['path'] == 'scripts/run-v50-final-campaign-proof.py', 'Unexpected corrected campaign invocation')
    require(execution['report'] == proof(path) and execution['trace'] == proof(trace_path), 'Actual execution inputs were relinked')
    logged = json.loads(gzip.decompress(check_file(execution['output']).read_bytes()).decode().splitlines()[-1])
    require(logged['status'] == 'passed' and logged['sourceDigest'] == SOURCE_DIGEST and logged['final'] == campaign['final'] and
            logged['boundaries'] == campaign['boundaries'], 'Actual campaign log disagrees with the report')
    final = campaign['final']
    require((final['actions'], final['prefixes'], final['levelsCompleted'], final['level'], final['state'], final['status'], final['reason']) ==
            (49, 47, 3, 4, 'NOT_FINISHED', 'stopped', 'target_levels_completed'), 'Actual three-level result changed or was labeled a full WIN')
    require(final['operationCounts'] == {'init': 1, 'advance': 49, 'resume': 46} and final['caller']['enabled'] is True and
            final['caller']['boundaryReplays'] == 2 and final['caller']['goalEvents'] == 3, 'Continuous common acquisition changed')
    boundaries = campaign['boundaries']
    for key, expected in [('totalActions', [15, 30, 49]), ('levelActions', [15, 15, 19]), ('completedLevel', [1, 2, 3]),
                          ('nativeLevel', [2, 3, 4]), ('levelsCompleted', [1, 2, 3]), ('prefixCount', [15, 30, 47])]:
        require([boundary[key] for boundary in boundaries] == expected, 'Official level boundary changed: ' + key)
    packets = read(trace_path)['packets']; packet_summary = validate_trace(campaign, trace_path)
    require(packet_summary == {'completePublicPackets': 50, 'animationFramesIncludingInitial': 238}, 'Complete actual public packets changed')
    for index, item in enumerate(packets):
        packet = item['packet']
        require(set(packet) == PUBLIC_FIELDS and packet['step_index'] == index and
                packet['frame_hash'] == packet_hash(packet['frame_rows'])[:16], 'Public packet fields, index or raster identity changed')
        if index:
            before = packets[index - 1]['packet']; action = campaign['actions'][index - 1]
            require((action['levelBefore'], action['completedBefore']) == (before['level'], before['levels_completed']),
                    'A native action has the wrong public predecessor')
    observed_boundaries = [index for index in range(1, len(packets)) if
        packets[index]['packet']['levels_completed'] > packets[index - 1]['packet']['levels_completed']]
    require(observed_boundaries == [15, 30, 49], 'Boundary claims disagree with complete public returns')
    own_events, retained_events, families, kinds, witness_kinds = [], [], Counter(), Counter(), Counter()
    cursor = negative_paths = 0; foreign_indices = []
    flags = ['typed_carrier_plan', 'material_flow_plan', 'material_pose_plan']
    def verify_zero_paths(value, paths):
        require(len({tuple(path) for path in paths}) == len(paths), 'Duplicate signed-zero receipt paths')
        for path in paths:
            require(isinstance(path, list) and bool(path), 'Empty signed-zero receipt path')
            item = value
            for key in path: item = item[key]
            require(type(item) in [int, float] and item == 0, 'Signed-zero receipt no longer addresses a numeric zero')
        return len(paths)
    for prefix_index, prefix in enumerate(campaign['prefixes']):
        start = cursor; cursor += prefix['acquiredActions']; families[prefix['family']] += 1; kinds[prefix['proposalKind']] += 1
        require(prefix['callerAcquiredTransitions'] == cursor, 'Common caller omitted or duplicated an acquired action')
        shared = prefix['sharedSeries']; events = shared['typedMaterialAcquiredEvents']; before_count = len(own_events)
        require(all(event['kind'] in OWN_KINDS for event in events), 'A foreign event was counted as a material acquisition')
        negative_paths += verify_zero_paths(events, shared['typedMaterialAcquiredNegativeZeroPaths'])
        prior_events = {material_hash(event): event for event in retained_events}
        retained_events.extend(restore_signed_zero(events, shared['typedMaterialAcquiredNegativeZeroPaths']))
        own_events.extend(events)
        require(shared['typedMaterialEventCount'] == len(own_events) and
                shared['typedMaterialLatestEvent'] == (own_events[-1] if own_events else None), 'Cumulative own material events changed')
        own = prefix.get('typedMaterial')
        if own is None:
            foreign_indices.append(prefix_index)
            require(prefix['family'] == 'animated_contact' and prefix['proposalKind'] == 'measured_animated_contact' and
                    prefix['acquiredActions'] == 1 and not events and not prefix.get('nativeCoordination'),
                    'The actual foreign invitation was modified or fabricated material acquisition')
            continue
        proposal = own['proposal']; present = [flag for flag in flags if flag in proposal]
        require(len(present) == 1 and own['stateNode'] == 'family_state:public_occurrence_recall' and
                prefix['family'] == 'public_occurrence_recall' and prefix['selectionGroup'] == 'window_constraints' and
                prefix['fieldSubquestion'] == 'typed_material_flow', 'Material layers do not use their single ordered common owner')
        require(proposal['actions'] == [action['command'] for action in campaign['actions'][start:cursor]],
                'Material envelope actions differ from the actual physical commands')
        negative_paths += verify_zero_paths(proposal, own['negativeZeroPaths'])
        coordination = prefix.get('nativeCoordination'); require(len(coordination or []) == 1, 'Material recovery receipt missing')
        receipt = coordination[0]; witness = receipt['current_inquiry']; witness_kinds[witness['status']] += 1
        require(receipt == proposal['strategy_receipt']['native_coordination'][0] and
                receipt['rule'] == 'returned_unlearned_contact_refusal_is_local' and receipt['physical_action_authorized'] is False and
                receipt['contact_scope_ref'] == 'native_contact_probe_scope:animated_contact' and
                receipt['public_return_status'] == 'transient_returned_unlearned_invitation' and
                receipt['source_state_ref'] == own['stateNode'] and receipt['preferred_proposal_id'] == proposal['proposal_id'] and
                witness['proposal_ref'] == proposal['proposal_id'] and witness['effect_requires_actual_return'] is True,
                'Local unknown-effect coordination was mislabeled as learned action authority')
        require(witness['evidence_refs'] and witness['observation_ref'] == receipt['observation_ref'] and
                witness['level_epoch'] == packets[start]['packet']['level'] and
                witness['frame_digest'] == packet_hash(packets[start]['packet']['frame_rows']), 'Current inquiry evidence missing or stale')
        require(witness['observation_ref'].endswith(':epoch:' + str(packets[start]['packet']['level']) + ':revision:' + str(start + 1) +
                ':frame:' + packets[start]['packet']['frame_hash']), 'Inquiry observation is not the actual current public predecessor')
        used_evidence = []
        require(witness['acquisition_event_refs'] == ['typed-material-event:' + item['event_digest'] for item in witness['acquisition_event_witnesses']],
                'Acquisition digest refs disagree with their witnesses')
        for item in witness['acquisition_event_witnesses']:
            event = prior_events.get(item['event_digest'])
            require(event is not None and item['kind'] == event['kind'] and item['evidence_refs'] == evidence_references(event['evidence']),
                    'A coordination acquisition witness does not identify an own event preceding this prefix')
            used_evidence.extend(evidence_references(event['evidence']))
        require(witness['evidence_refs'] == list(dict.fromkeys([witness['observation_ref'], *used_evidence])),
                'Current inquiry evidence contains an unacquired reference')
        if witness['status'] == 'current_measured_relation_for_unknown_effect':
            require(before_count == 0 and witness['acquisition_event_refs'] == [] and witness['context_model_ids'] == [],
                    'A cold material relation was represented as acquired context')
            first, second = packets[0]['packet'], packets[1]['packet']; changed = set()
            for frame in second['frame_packet']:
                changed.update((x, y) for y, row in enumerate(frame) for x, color in enumerate(row) if color != first['frame_rows'][y][x])
            command = packets[1]['command']; changed.add((command['data']['x'], command['data']['y']))
            require(len(witness['supportBoxes']) == 4 and all(all(x < box[0] or x > box[2] or y < box[1] or y > box[3]
                    for x, y in changed) for box in witness['supportBoxes']), 'Cold material support overlaps the unresolved contact effect or point')
        else:
            require(witness['status'] == 'acquired_context_for_unknown_effect' and before_count > 0 and
                    witness['acquisition_event_refs'] and witness['context_model_ids'], 'Acquired context has no retained event evidence')
        if prefix['acquiredActions'] > 1:
            plan = proposal['material_pose_plan']
            require(prefix['acquiredActions'] == 3 and prefix_index == 45 and plan['reason'] == 'conditional_typed_pose_path' and
                    plan['rule']['status'] == 'conditional_observed_pose_change' and len(plan['expected_after']) == 3 and
                    all(step['expected_after'] is not None for step in proposal['steps']), 'Bounded pose prefix lost its acquired conditional law')
    require(cursor == 49 and negative_paths == 14 and foreign_indices == [0, 15, 30], 'Native action allocation or numeric sidecars changed')
    require(families == {'animated_contact': 3, 'public_occurrence_recall': 44} and
            kinds == {'measured_animated_contact': 3, 'typed_carrier_experiment': 18, 'typed_material_flow': 22, 'typed_pose_dependency': 4},
            'Actual provider selections changed')
    require(len(own_events) == 68 and Counter(event['kind'] for event in own_events) ==
            {'typed_carrier_response': 18, 'typed_pose_scope': 4, 'typed_material_flow': 28, 'typed_pose_model': 12, 'typed_pose_response': 6},
            'Acquired material event totals changed')
    require(witness_kinds == {'current_measured_relation_for_unknown_effect': 1, 'acquired_context_for_unknown_effect': 43},
            'Cold versus acquired inquiry evidence changed')
    return {'report': proof(path), 'trace': proof(trace_path), 'actualExecution': proof(execution_path),
            'actions': 49, 'prefixes': 47, 'levelsCompleted': 3, 'enteredLevel': 4, 'officialState': 'NOT_FINISHED',
            'perLevelActions': [15, 15, 19], 'sessions': 1, 'commonCallerAcquiredTransitions': 49, 'boundaryReplays': 2,
            'providerKinds': dict(kinds), 'materialOwnEvents': 68, 'materialEventKinds': dict(Counter(event['kind'] for event in own_events)),
            'inquiryWitnessKinds': dict(witness_kinds), 'foreignInvitationPrefixIndices': foreign_indices, 'signedZeroPathsRestored': 14,
            **packet_summary,
            'qualification': 'One actual cold native common-caller session reaches three official levels in 49 commands, including three original animated invitations. Forty-four material prefixes acquire their own 68 events through normal WHY/ACT. Cold measured relation and acquired context are distinguished. The final state is entry to level four, not a full-game WIN.'}


def validate_initial_failure():
    path = OUT / 'evidence-retention.json'; retained = read(path)
    require(retained['schema'] == 'logos-engine.v50.initial-evidence-retention.v1', 'Missing initial evidence retention contract')
    expected = {
        'scripts/run-v50-campaign-proof.py', 'scripts/probe-v50-cold-start-v49.mjs',
        'scripts/diagnose-v50-material-cold-path.mjs',
        'docs/migration/native-campaigns-v50/source-manifest.json',
        'docs/migration/native-campaigns-v50/cold-start-v49.json',
        'docs/migration/native-campaigns-v50/life-three-levels.json',
        'docs/migration/native-campaigns-v50/life-public-trace.json.gz',
        'docs/migration/native-campaigns-v50/logs/execution-life.json',
        'docs/migration/native-campaigns-v50/logs/life-output.log.gz',
        'docs/migration/native-campaigns-v50/diagnostics/material-cold-path.json',
        'docs/migration/native-campaigns-v50/diagnostics/native-source-at-first-campaign.tar.gz',
        'docs/migration/native-campaigns-v50/diagnostics/typed-material-kernel-first-run.log.gz',
    }
    require(len(retained['preservedFiles']) == len(expected) == 12 and
            {item['path'] for item in retained['preservedFiles']} == expected, 'Initial evidence inventory changed')
    for item in retained['preservedFiles']: check_file(item)
    source = read(OUT / 'source-manifest.json')
    require(source['fileCount'] == len(source['files']) == 168 and source['digest'] == canonical_hash(source['files']) ==
            'e156fdd0bcf7b1aa81233be74a6c78b1dd0ac819f6a46bcd103e1622bf2d40f0', 'Initial source freeze changed')
    archive_path = OUT / 'diagnostics/native-source-at-first-campaign.tar.gz'
    with tarfile.open(archive_path, 'r:gz') as archive:
        members = archive.getmembers()
        require(len(members) == len(source['files']) and all(member.isfile() for member in members) and
                {member.name for member in members} == set(source['files']), 'Initial source archive inventory differs from its freeze')
        for member in members:
            require(hashlib.sha256(archive.extractfile(member).read()).hexdigest() == source['files'][member.name],
                    'Initial archived source differs from its execution: ' + member.name)
    campaign = read(OUT / 'life-three-levels.json'); execution = read(OUT / 'logs/execution-life.json')
    validate_report(campaign, source, status='failed'); validate_execution(execution, source, exit_code=1)
    require(execution['report'] == proof(OUT / 'life-three-levels.json') and
            execution['trace'] == proof(OUT / 'life-public-trace.json.gz'), 'Initial campaign receipt was relinked')
    require(execution['generator']['path'] == 'scripts/run-v50-campaign-proof.py', 'Initial generator identity changed')
    trace_path = OUT / 'life-public-trace.json.gz'; trace = read(trace_path)
    validate_trace(campaign, trace_path, current_source=False)
    require(trace['sourceDigest'] == source['digest'] and len(trace['packets']) == 2, 'Initial failed trace source or extent changed')
    final = campaign['final']
    require((final['actions'], final['prefixes'], final['levelsCompleted'], final['level'], final['state'], final['reason']) ==
            (1, 1, 0, 1, 'NOT_FINISHED', 'frontier_unknown') and not campaign['boundaries'], 'Initial failure was reclassified')
    first, second = [item['packet'] for item in trace['packets']]
    require(first['frame_rows'] == second['frame_rows'] and len(second['frame_packet']) == 4 and
            any(rows != first['frame_rows'] for rows in second['frame_packet']) and
            all(first[key] == second[key] for key in ['level', 'levels_completed', 'state', 'available_action_refs']),
            'The initial complete transient public response was changed or collapsed')
    measured_changes = [sum(color != first['frame_rows'][y][x] for y, row in enumerate(frame) for x, color in enumerate(row))
                        for frame in second['frame_packet']]
    require(measured_changes == [0, 12, 0, 0] and second['frame_packet'][-1] == second['frame_rows'],
            'Complete initial transient pixels or final restoration changed')
    diagnostic_path = OUT / 'diagnostics/material-cold-path.json'; diagnostic = read(diagnostic_path)
    for item in diagnostic['inputs'].values(): check_file(item)
    check_file(diagnostic['generator'])
    require(diagnostic['status'] == 'passed' and diagnostic['sourceBefore'] == diagnostic['sourceAfter'] ==
            {key: source[key] for key in ['fileCount', 'digest']} and diagnostic['sessions'] == diagnostic['realRecordedReturnsReplayed'] == 1 and
            diagnostic['newGameHostRuns'] == diagnostic['dispatchedActions'] == 0 and
            diagnostic['stopped']['reason'] == 'frontier_unknown' and diagnostic['ownStateUnchangedOnResume'] is True and
            diagnostic['finalRasterRestored'] is True and diagnostic['publicProtocolUnchanged'] is True,
            'Original diagnosis was replaced by a corrected-source result')
    require([row['changedPixels'] for row in diagnostic['frameChanges']] == [0, 12, 0, 0] and
            diagnostic['contactScope']['status'] == 'outside_stationary_invitation_scope', 'Initial refusal explanation changed')
    for offer in diagnostic['material'].values():
        require(offer['proposalKind'] == 'typed_carrier_experiment' and offer['guard']['admitted'] is True and offer['pointGuard'] is True and
                offer['retainedOwnStateUnchangedByProposal'] is True and offer['fullStateDigestUnchangedByProposal'] is True and
                all(offer['retainedOwnState'][key] == [] for key in ['carrier_events', 'flow_events', 'pose_events']),
                'Initial diagnostic acquired or dispatched a material experiment')
    old_test = gzip.decompress((OUT / 'diagnostics/typed-material-kernel-first-run.log.gz').read_bytes()).decode()
    require('fail 2' in old_test and 'pass 4' in old_test, 'The initial failed integration test was not retained')
    return {'retentionContract': proof(path), 'preservedFiles': retained['preservedFiles'], 'sourceDigest': source['digest'],
            'archivedNativeFiles': len(source['files']), 'actualActions': 1, 'levelsCompleted': 0, 'reason': 'frontier_unknown',
            'transientChangedPixelsByFrame': [0, 12, 0, 0],
            'qualification': 'The initial live failure, complete public return, immutable native source snapshot and diagnostic are preserved at their original paths. They are not successful gates. Corrected evidence is stored separately; raster restoration never establishes hidden-state equality.'}


def validate_cold_diagnostic():
    path = OUT / 'cold-start-v49.json'; cold = read(path)
    require(cold['schema'] == 'logos-engine.v50.cold-start-v49.v1' and cold['status'] == 'passed' and
            cold['sourceCommit'] == PREVIOUS_RELEASE_COMMIT and cold['sourceUnchanged'] is True and
            cold['nativeBefore'] == cold['nativeAfter'], 'Published v49 cold diagnostic changed')
    before = cold['nativeBefore']; manifest = read(check_file(before['nativeSourceManifest']))
    require(before['digest'] == manifest['digest'] == 'e5a7fc15461fd1ddbc9019b3749dad98a2235fc38df40898778d6c089cc13a5a'
            and before['files'] == manifest['fileCount'] == 166, 'Cold diagnostic source is not published v49')
    corpus = read(check_file(cold['publicCorpus']))
    packet = next(item['packet'] for item in corpus['games'] if item['game'] == 'LIFE')
    require(cold['packet'] == packet == read(OUT / 'life-public-trace-final.json.gz')['packets'][0]['packet'] and
            cold['packetSha256'] == packet_hash(cold['packet']), 'Cold diagnostic initial public view changed')
    require(cold['game'] == 'LIFE' and cold['gameLabelVisibleToRuntime'] is False and
            cold['initializedSessions'] == 1 and cold['dispatchedActions'] == cold['manualPrimingActions'] ==
            cold['levelJumps'] == corpus['actions'] == corpus['levelJumps'] == 0, 'Cold diagnostic dispatched or primed a game')
    check_file(cold['generator']); result = cold['nativeResult']; snapshot = result['snapshot']
    require(result['kind'] == 'action' and result['command'] == {'action_ref': 'ACTION6', 'data': {'x': 24, 'y': 7}} and
            snapshot['actions'] == 0 and snapshot['lastDecision'] == 'animated_contact' and
            snapshot['proposal']['kind'] == 'measured_animated_contact' and
            snapshot['proposal']['animated_contact_plan']['mode'] == 'invitation' and
            snapshot['implementation'] == 'logos-engine.typescript.v6.native-migration/0.19.0',
            'The unchanged first cold caller proposal is no longer retained')
    return {'receipt': proof(path), 'sourceCommit': PREVIOUS_RELEASE_COMMIT,
            'proposedCommand': result['command'], 'dispatchedActions': 0,
            'qualification': 'Read-only planning on published v49 selected the original animated invitation. The actual source v50 failure and corrected campaign retain that first choice. This diagnostic executes no game and proves no level.'}


def validate_comparator():
    path = OUT / 'life-original-component-comparison.json'; compared = read(path)
    require(compared['schema'] == 'logos-engine.v50.material-public-component-comparison.v1' and compared['status'] == 'passed' and
            compared['comparisonConclusion'] == 'complete_own_provider_fields_and_actual_acquisitions_match_under_independently_verified_native_identity_and_signed_zero_projection' and
            all(compared[key] is False for key in ['recordedPublicTrajectoriesEquivalent', 'originalFullCommonCallerParity',
                                                  'rawPythonNativeIdentityParity', 'universalLexicalHashDecisionParity']),
            'Qualified component agreement was expanded into whole-caller or raw-hash equality')
    require(set(compared['inputs']) == {'sourceComponentCampaign', 'sourceContracts', 'campaign', 'trace', 'execution', 'source'},
            'Independent comparison input inventory changed')
    for item in compared['inputs'].values(): check_file(item)
    generator = check_file(compared['generator'])
    require(generator == ROOT / 'scripts/compare-v50-material-public-evidence.py', 'Independent comparison generator changed')
    source = compared['sourceVerification']; native = compared['nativeVerification']
    require(source['commit'] == REFERENCE_COMMIT and source['allPinnedFilesVerified'] == 1786 and source['sourceUnchanged'] is True,
            'Original source identity or immutability changed')
    manifest = read(REFERENCE / 'manifest.json')
    require(manifest['commit'] == REFERENCE_COMMIT and len(manifest['files']) == 1786, 'Pinned original inventory changed')
    for name, item in manifest['files'].items():
        check_file({'path': (REFERENCE / 'source' / name).relative_to(ROOT).as_posix(), 'sha256': item['sha256']})
    for name, digest in source['sourceHashes'].items():
        require(manifest['files'][name]['sha256'] == digest, 'An imported source module differs from its pinned bytes')
    require(native == {'nativeSourceFiles': 170, 'sourceDigest': SOURCE_DIGEST, 'sourceUnchangedDuringRun': True,
                       'executionExitCode': 0, 'reportTraceLogsAndInventoryVerified': True, 'pythonAgentModules': []},
            'Independent comparison does not use the corrected frozen native campaign')
    original = read(check_file(compared['inputs']['sourceComponentCampaign']))
    reference = read(check_file(compared['inputs']['sourceContracts']))
    for fixture in [original, reference]:
        require(fixture['sourceCommit'] == REFERENCE_COMMIT and fixture['pinnedSourceFilesVerifiedBeforeImport'] == 1786,
                'Reference fixture does not identify the unchanged original source')
        check_file({'path': fixture['generator'], 'sha256': fixture['generatorSha256']})
        for name, digest in fixture['sourceHashes'].items():
            require(manifest['files'][name]['sha256'] == digest, 'Reference imported a modified original source module')
    require(original['status'] == 'passed' and original['fullOriginalCaller'] is False and original['actions'] == 46 and
            len(original['prefixes']) == 44 and len(original['packets']) == 47 and original['levelsCompleted'] == 3 and
            original['state'] == 'NOT_FINISHED' and original['sessionCount'] == 1 and
            original['manualPrimingActions'] == original['resets'] == original['levelJumps'] == 0 and
            original['frontierEnabled'] is False and original['providerOrder'] == ['material_propose'],
            'Original component proof changed or was misrepresented as the whole caller')
    require(reference['sourceAliasing'] == [] and reference['qualification']['sourceModified'] is False and
            reference['qualification']['gameHostRunByExporter'] is False and len(reference['commonEnvelopes']) == 44 and
            len(reference['hashTieContracts']) == 2 and all(row['sourceChosenKey'] != row['nativeChosenSourceKey']
                for row in reference['hashTieContracts']), 'Explicit original/native lexical-hash selection limits were lost')
    identity_path = check_file(compared['identityEvidence']); identities = read(identity_path)
    require(identities['schema'] == 'logos-engine.v50.material-derived-identities.v1' and identities['sourceCommit'] == REFERENCE_COMMIT and
            identities['sourceInputHashesVerified'] is identities['nativeInputHashesIndependentlyRecomputed'] is True and
            identities['recipeCount'] == len(identities['recipes']) == 328 and
            identities['qualification'] == reference['qualification'], 'Derived identity proof changed or dropped numeric qualifications')
    require(len({recipe['sourceHash'] for recipe in identities['recipes']}) == 328, 'Identity recipes contain a duplicate source identity')
    for recipe in identities['recipes']:
        require(recipe['sourceCanonical'] == json.dumps(recipe['value'], sort_keys=True, separators=(',', ':')) and
                hashlib.sha256(recipe['sourceCanonical'].encode()).hexdigest() == recipe['sourceHash'] and
                hashlib.sha256(recipe['nativeCanonical'].encode()).hexdigest() == recipe['nativeHash'],
                'A retained numeric identity is not bound to its explicit canonical input')
    expected = {'nativeActions': 49, 'sourceSubsetActions': 46, 'levelsCompleted': 3, 'officialState': 'NOT_FINISHED', 'enteredLevel': 4,
                'nativePrefixes': 47, 'sourceSubsetPrefixes': 44, 'nativeCompletePublicPackets': 50, 'nativePublicFramesIncludingInitial': 238,
                'exactCommonInitialCommands': 0, 'exactCommonInitialPackets': 1, 'sourceProviderProposalsCompared': 44,
                'ownAcquiredEventsCompared': 68, 'ownEventKinds': {'typed_carrier_response': 18, 'typed_pose_scope': 4,
                    'typed_material_flow': 28, 'typed_pose_model': 12, 'typed_pose_response': 6},
                'foreignPrefixes': 3, 'foreignActions': 3, 'stateReconstructions': 49, 'identityRecipes': 328,
                'explicitNegativeZeroPathsRestored': 14, 'observedSourceHashDecisionTies': {'carrier': 0, 'pose': 0},
                'nativePerLevelActions': [15, 15, 19], 'sourcePerLevelActions': [14, 14, 18]}
    require(compared['summary'] == expected, 'Independent original comparison counts changed')
    trace = read(OUT / 'life-public-trace-final.json.gz'); campaign = read(OUT / 'life-three-levels-final.json')
    require(original['packets'][0]['packet'] == trace['packets'][0]['packet'], 'Source/native initial public conditions changed')
    public = compared['publicEvidence']; divergence = public['firstTrajectoryDivergence']
    require(public['fields'] == sorted(PUBLIC_FIELDS) and len(public['packets']) == 50 and
            divergence == {'actionIndex': 1, 'sourceCommand': original['packets'][1]['command'],
                'nativeCommand': trace['packets'][1]['command'], 'sourcePublicPacketSha256': packet_hash(original['packets'][1]['packet']),
                'nativePublicPacketSha256': packet_hash(trace['packets'][1]['packet'])} and
            divergence['sourceCommand'] != divergence['nativeCommand'], 'The first actual caller divergence was erased')
    for index, row in enumerate(public['packets']):
        packet = trace['packets'][index]['packet']
        require(row == {'index': index, 'publicPacketSha256': packet_hash(packet),
                        'canonicalPublicPacketSha256': canonical_hash(packet), 'frames': len(packet['frame_packet'])},
                'Comparator packet receipt differs from the actual complete return')
    replay = compared['componentReplay']
    require(replay['absoluteNumericTolerance'] == 0 and len(replay['proposals']) == 44 and len(replay['transitions']) == 49 and
            len(replay['foreignProviders']) == 3 and len(replay['nativeCallerAnnotationsOutsideProvider']) == 44 and
            replay['identityProjection'] == reference['qualification']['numerics'] and
            replay['derivedSetOrdering'] == reference['qualification']['derivedSetOrdering'] and
            replay['signedZero'] == reference['qualification']['signedZero'], 'Comparison weakened its declared numerical or own-state scope')
    own_indices = [index for index, prefix in enumerate(campaign['prefixes']) if prefix.get('typedMaterial')]
    require([row['prefixIndex'] for row in replay['proposals']] == own_indices and all(row['allProviderFieldsCompared'] is True and
            row['matchedUnderDeclaredIdentityProjection'] is True for row in replay['proposals']), 'A selected own proposal was omitted')
    cursor = own_count = 0
    for index, prefix in enumerate(campaign['prefixes']):
        rows = replay['transitions'][cursor:cursor + prefix['acquiredActions']]
        require(len(rows) == prefix['acquiredActions'] and all(row['prefixIndex'] == index and
                row['actionIndex'] == cursor + offset + 1 and row['eventsAndReconstructedOwnStateMatch'] is True
                for offset, row in enumerate(rows)), 'Comparison skipped a native acquired transition')
        require(sum(row['ownEvents'] for row in rows) == len(prefix['sharedSeries']['typedMaterialAcquiredEvents']),
                'Comparison own-event totals disagree with the native acquisition')
        for row in rows:
            require((row['sourceBeforeGuard'] is not None and row['sourceBeforeGuard']['admitted'] is True) if prefix.get('typedMaterial')
                    else row['sourceBeforeGuard'] is None, 'Foreign actions acquired source provider guard claims')
        cursor += prefix['acquiredActions']; own_count += sum(row['ownEvents'] for row in rows)
    require(cursor == 49 and own_count == 68 and [row['prefixIndex'] for row in replay['foreignProviders']] == [0, 15, 30],
            'Foreign invitation transitions were omitted from source event replay')
    command = [sys.executable, '-B', str(generator), '--verify']
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
    require(result.returncode == 0, 'Read-only original-provider recomputation failed: ' + result.stderr[-4000:])
    logged = json.loads(result.stdout.splitlines()[-1])
    require(logged == {'status': 'passed', 'mode': 'verify', 'output': path.relative_to(ROOT).as_posix(), 'summary': expected},
            'Read-only comparator output differs from its retained assertions')
    return {'receipt': proof(path), 'identityEvidence': proof(identity_path),
            'verificationCommand': ['python', '-B', generator.relative_to(ROOT).as_posix(), '--verify'], 'summary': expected,
            'firstTrajectoryDivergence': divergence, 'wholePublicTrajectoriesEquivalent': False,
            'rawPythonNativeIdentityParity': False, 'universalLexicalHashDecisionParity': False, 'originalFullCommonCallerParity': False,
            'qualification': 'All 44 actual selected provider envelopes, 68 own events and 49 reconstructed own states agree under independently recomputed finite numerical identities, declared reference-set ordering and retained signed-zero templates. Two controlled contracts retain different lexical-hash choices. Whole-caller parity, raw identity equality and universal tie-breaking equivalence are not asserted.'}


def validate_regressions(source):
    plan_path, verification_path, summary_path = [OUT / name for name in
        ['regression-plan.json', 'regression-verification.json', 'regression-summary.json']]
    plan, verification, summary = map(read, [plan_path, verification_path, summary_path])
    require(plan['schema'] == 'logos-engine.v50.regression-plan.v1' and
            verification['schema'] == 'logos-engine.v50.regression-verification.v1' and
            summary['schema'] == 'logos-engine.v50.regression-summary.v1', 'Regression schema mismatch')
    require(summary['passed'] is True and verification['passed'] is True and
            verification['nativeSourceUnchangedBeforeAfterAllRuns'] is True and
            verification['nativeSourceBeforeAllRuns'] == verification['nativeSourceAfterAllRuns'] == source,
            'Regressions failed or native source changed')
    require(plan['nativeSourceManifest'] == proof(OUT / 'source-manifest-final.json') and
            plan['nativeSourceManifestDigest'] == summary['sourceDigest'] == SOURCE_DIGEST and
            plan['nativeSourceFiles'] == summary['nativeSourceFiles'] == 170, 'Regression manifest differs from freeze')
    require(summary['verification'] == proof(verification_path) and
            summary['plan'] == verification['plan'] == proof(plan_path), 'Regression receipt identity mismatch')
    check_file(verification['generator']); check_map(plan['harnessFileSha256'])
    require(len(plan['runs']) == len(verification['runs']) == len(summary['results']) == 6,
            'Exactly six recorded-public replays are required')
    for expected, planned, record, item in zip(REGRESSIONS, plan['runs'], verification['runs'], summary['results']):
        game, target, commands, prefixes = expected
        require(planned['game'] == record['game'] == item['game'] == game and
                planned['targetLevels'] == record['targetLevels'] == target and
                planned['mode'] == record['mode'] == item['mode'] == 'recorded-public-replay',
                'Regression identity or replay scope changed')
        require(record['passed'] is True and item['passed'] is True and record['modeMatchesPlan'] is True and
                record['reportSourceMatchesFreeze'] is True and record['sourceUnchangedDuringRun'] is True and
                record['pythonAgentModules'] == [], 'Regression failed its declared contract')
        require(read(ROOT / planned['executionReceipt']) == record, 'Regression execution receipt changed')
        baseline = read(check_file(planned['baseline'])); current = read(check_file(record['report']))
        require(current['schema'] == 'logos-engine.v6.recorded-public-regression.v1', 'Replay mislabeled as a live campaign')
        validate_report(current, source)
        require(current['game'] == game and current['targetLevels'] == target and current['initial'] == baseline['initial'],
                'Regression initial public conditions changed')
        public_actions = lambda rows: [{k: v for k, v in row.items() if k != 'executionMs'} for row in rows]
        require(public_actions(current['actions']) == public_actions(baseline['actions']),
                f'{game}: commands, complete public packet hashes or primitive boundaries differ')
        require(current['final']['actions'] == planned['expectedCommands'] == commands and
                current['final']['prefixes'] == planned['expectedPrefixes'] == prefixes and
                planned['expectedCompletePublicPackets'] == commands + 1, 'Regression counts changed')
        require(current['final'] == record['final'] and item['actions'] == commands and item['prefixes'] == prefixes and
                item['levelsCompleted'] == target and item['state'] == current['final']['state'], 'Regression summary changed')
        require(item['report'] == record['report'] == proof(ROOT / planned['report']), 'Regression report identity mismatch')
        replay = current['recordedPublicReplay']
        require(replay['trace'] == {key: planned['recordedTrace'][key] for key in ['path', 'sha256']} and
                replay['baseline'] == {key: planned['baseline'][key] for key in ['path', 'sha256']},
                'Regression replay inputs differ from the plan')
        validate_trace(current, check_file(planned['recordedTrace']), current_source=False)
        validate_execution(record['execution'], source)
        require(record['execution']['command'] == planned['command'] and
                record['execution']['harnessFileSha256'] == plan['harnessFileSha256'], 'Replay harness differs from plan')
        require(len(record['comparisonAttempts']) == 1, 'Unexpected comparison attempts; inspect the retained evidence')
        attempt = record['comparisonAttempts'][0]
        require(read(check_file(attempt['receipt'])) == {key: value for key, value in attempt.items() if key != 'receipt'},
                'Comparison attempt differs from its saved receipt')
        validate_execution(attempt, source)
        require(attempt['command'] == planned['comparisonCommand'] and attempt['passed'] is True and
                attempt['checks'] == 18 and attempt['failedChecks'] == [], 'Regression comparator failed')
        checked = read(check_file(attempt['result']))
        require(checked['schema'] == 'logos-engine.v50.public-regression-comparison.v1' and checked['passed'] is True and
                len(checked['checks']) == 18 and all(row['passed'] is True for row in checked['checks']), 'A regression assertion failed')
        check_file(checked['before']); check_file(checked['after'])
        require(checked['compared'] == attempt['compared'] ==
                {'commands': commands, 'completePublicPackets': commands + 1, 'prefixes': prefixes}, 'Comparison counts changed')
        require(item['comparison'] == attempt['result'] == proof(ROOT / planned['comparison']), 'Comparison file identity mismatch')
        comparison_log = json.loads(gzip.decompress(check_file(attempt['output']).read_bytes()).decode().splitlines()[-1])
        require(comparison_log == {'passed': True, 'checks': 18, 'compared': checked['compared'], 'failed': []},
                'Recorded comparison output disagrees with retained assertions')
        for prefix in current['prefixes']:
            shared = prefix['sharedSeries']
            require(shared['typedMaterialEventCount'] == 0 and shared['typedMaterialLatestEvent'] is None and
                    shared['typedMaterialAcquiredEvents'] == shared['typedMaterialAcquiredNegativeZeroPaths'] == [] and
                    prefix.get('typedMaterial') is None, 'Material or pose acquired a retained unrelated trajectory')
    expected_groups = [
        {'mode': 'recorded-public-replay', 'runs': 6, 'passed': True, 'commands': sum(row[2] for row in REGRESSIONS),
         'completePublicPackets': sum(row[2] + 1 for row in REGRESSIONS), 'prefixes': sum(row[3] for row in REGRESSIONS), 'comparisonChecks': 108, 'games': [row[0] for row in REGRESSIONS]},
        {'mode': 'actual-game-campaign', 'runs': 0, 'passed': True, 'commands': 0,
         'completePublicPackets': 0, 'prefixes': 0, 'comparisonChecks': 0, 'games': []},
    ]
    require(summary['groups'] == expected_groups, 'Regression aggregation changed')
    return {'summary': proof(summary_path), 'groups': summary['groups'],
            'qualification': 'Six cold native replays recompute decisions before consuming retained complete public returns. They are not six additional live wins. The plan, actual receipts and 108 retained comparisons are verified without rerunning the games or replaying the agent.'}


def validate_progress():
    progress_path = ROOT / 'docs/migration/v6-entry-point-progress.json'
    progress = read(progress_path)
    require(progress['schema'] == 'logos-engine.v6.declared-entry-coverage.v1' and
            (progress['connected'], progress['declared'], progress['percent'], progress['implementation']) ==
            (41, 76, 53.9, IMPLEMENTATION), 'Declared source-entry progress changed')
    require(len(progress['groups']) == 4, 'Expected four ordered source DRM lists')
    for group in progress['groups']:
        require(group['declared'] == len(group['entries']) and
                group['connected'] == sum(entry['status'] == 'connected' for entry in group['entries']),
                'Entry group counts do not match explicit statuses')
    require(sum(group['declared'] for group in progress['groups']) == 76 and
            sum(group['connected'] for group in progress['groups']) == 41 and progress['fullV6Parity'] is False,
            'Progress denominator or parity claim changed')
    queue = [entry for group in progress['groups'] for entry in group['entries'] if entry['question'] == 'typed_material_flow']
    require(queue == [{'question': 'typed_material_flow', 'family': 'public_occurrence_recall', 'status': 'connected'}],
            'Typed Material is not registered in the shared owner')
    coverage_path = ROOT / 'docs/migration/v6-coverage.json'; coverage = read(coverage_path)
    require(coverage['complete'] is False and len(coverage['completionGates']) == 6 and
            all(value is False for value in coverage['completionGates'].values()), 'Incomplete migration must remain explicit')
    return {'connected': 41, 'declared': 76, 'percent': 53.9, 'metric': progress['metric'],
            'entryAudit': proof(progress_path), 'migrationAudit': proof(coverage_path),
            'qualification': '53.9% counts registered subquestions in the same four source DRM lists. It is not code-volume progress, game success rate, complete migration or original caller parity.'}


def validate_tests(source):
    path = OUT / 'validation/delta-tests-run.json'
    tests = read(path)
    require(tests['schema'] == 'logos-engine.v50.actual-delta-tests.v1' and tests['status'] == 'passed' and
            tests['sourceAndTestInputsUnchanged'] is True, 'Delta suite failed or inputs changed during execution')
    validate_execution(tests, source)
    require(tests['testFiles'] == TEST_FILES and tests['testFileCount'] == len(TEST_FILES) == 21,
            'The declared affected test suite changed')
    require(tests['command'] == ['node', '--test', '--test-concurrency=1', '--test-reporter=tap', *TEST_FILES],
            'Unexpected delta test command')
    require(set(tests['sourceAndTestInputs']) == file_inventory(['src', 'tests']), 'Test/source input inventory changed')
    check_map(tests['sourceAndTestInputs'])
    counts, output = tap_counts(tests['output'])
    require(counts == tests['counts'], 'Actual TAP counts disagree with the receipt')
    identities, ancestry = [], []
    for match in re.finditer(r'^( *)# Subtest: (.+)$', output, re.M):
        indent, name = len(match.group(1)), match.group(2)
        while ancestry and ancestry[-1][0] >= indent:
            ancestry.pop()
        ancestry.append((indent, name))
        identities.append(tuple(item[1] for item in ancestry))
    all_results = len(re.findall(r'^\s*ok \d+ - ', output, re.M))
    top_level = len(re.findall(r'^ok \d+ - ', output, re.M))
    plans = re.findall(r'^1\.\.(\d+)\s*$', output, re.M)
    require(len(identities) == len(set(identities)) == all_results == counts['tests'],
            'Missing or duplicated scoped test identities or successful TAP results')
    require(len(plans) == 1 and int(plans[0]) == top_level and 0 < top_level <= all_results,
            'Actual root TAP plan does not cover the retained test results')
    require(not (OUT / 'validation/delta-tests-final.json').exists(),
            'Unexpected composite test receipt in this single-run release')
    return {'receipt': proof(path), 'validationMode': 'single-frozen-delta-execution', 'counts': counts,
            'testFiles': len(TEST_FILES), 'topLevelTests': top_level, 'nestedTests': all_results - top_level,
            'sourceAndTestInputsUnchanged': True,
            'qualification': 'One retained execution covers the 21 affected test files on unchanged source, test and fixture inputs. Counts and scoped identities are recomputed from its complete TAP output. This is not a rerun of the historical suite.'}


def validate_history():
    selections = [
        'docs/migration/native-campaigns-v49', 'docs/migration/v49-occluded-catalogues-and-acquired-views.md',
        'tests/fixtures/v6-occluded-catalogue-original-public.json.gz',
        'tests/fixtures/v6-occluded-catalogue-frontier-original-public.json.gz',
        'tests/fixtures/v6-occluded-catalogue-reference.json.gz',
        'scripts/probe-v6-occluded-catalogue-original.py', 'scripts/probe-v6-occluded-catalogue-frontier-original.py',
        'scripts/export-v6-occluded-catalogue-reference.py', 'scripts/probe-v49-cold-start-v48.mjs',
        'scripts/compare-v49-catalogue-public-evidence.py', 'scripts/compare-v49-regressions.mjs',
        'scripts/replay-v49-public-regression.mjs', 'scripts/run-v49-campaign-proof.py',
        'scripts/run-v49-delta-tests.py', 'scripts/run-v49-regression-checks.py', 'scripts/run-v49-release-checks.py',
        'scripts/validate-v49-release.py',
    ]
    tree = subprocess.run(['git', 'ls-tree', '-r', '-z', PREVIOUS_RELEASE_COMMIT, '--', *selections], cwd=ROOT, capture_output=True)
    require(tree.returncode == 0, 'Cannot read previous committed release evidence')
    verified = {}
    for row in tree.stdout.split(b'\0'):
        if not row: continue
        metadata, name = row.split(b'\t', 1); mode, kind, object_id = metadata.split(b' ')
        require(kind == b'blob', 'Historical evidence must be an ordinary Git blob')
        relative = name.decode(); data = (ROOT / relative).read_bytes()
        current = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        require(current == object_id.decode(), 'Historical v49 evidence changed: ' + relative)
        verified[relative] = {'gitObject': object_id.decode(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    require(all(name in verified for name in selections[1:]), 'A protected v49 proof is absent from its committed tree')
    old_docs = {name for name in verified if name.startswith('docs/migration/native-campaigns-v49/')}
    require(old_docs == file_inventory(['docs/migration/native-campaigns-v49']) and len(old_docs) > 50,
            'The complete previous release evidence inventory changed')
    gril = read(ROOT / 'docs/migration/native-campaigns-v49/gril-three-levels.json')
    require(gril['status'] == 'passed' and (gril['final']['actions'], gril['final']['prefixes'], gril['final']['levelsCompleted'],
            gril['final']['state']) == (19, 19, 3, 'NOT_FINISHED'), 'Previous GRIL three-level result was reclassified')
    return {'commit': PREVIOUS_RELEASE_COMMIT, 'filesVerified': len(verified), 'unchanged': True, 'files': verified,
            'scope': 'Every committed byte of the complete v49 campaign evidence directory and the listed reference fixtures, probes, exporters, comparison tools and release scripts matches its published Git object. No historical proof is regenerated or reclassified.'}


def retained_input_inventory():
    """Protect comparator inputs without executing any producer of those inputs."""
    folders = ['src', 'tests', 'scripts', 'docs/migration/native-campaigns-v50',
               'docs/migration/native-campaigns-v49', f'reference/v6/{REFERENCE_COMMIT}/source']
    return {name: sha(ROOT / name) for name in sorted(file_inventory(folders))
            if name != 'docs/migration/native-campaigns-v50/validation.json'}


def validate_browser(source):
    path = OUT / 'life-browser-verification.json'; browser = read(path)
    require(browser['schema'] == 'logos-engine.v50.browser-verification.v1' and browser['status'] == 'passed' and
            browser['game'] == 'LIFE' and browser['nativeSourceManifestDigest'] == source['digest'], 'Browser proof source mismatch')
    check_file(browser['generator'])
    ui_files = {'src/main.ts', 'src/sra-agent.css', 'src/styles.css'}
    require(set(browser['uiFilesSha256']) == ui_files, 'Browser proof omits a layout source')
    check_map(browser['uiFilesSha256'])
    require(browser['uiUnchangedFromCommit'] == PREVIOUS_RELEASE_COMMIT,
            'Browser proof does not identify the previous published UI')
    for name in sorted(ui_files):
        old = subprocess.run(['git', 'show', PREVIOUS_RELEASE_COMMIT + ':' + name], cwd=ROOT, capture_output=True)
        require(old.returncode == 0 and hashlib.sha256(old.stdout).hexdigest() == browser['uiFilesSha256'][name],
                'Observed UI no longer matches its recorded previous-release bytes: ' + name)
    build_inputs = read(OUT / 'validation/checks-run.json')['buildInputs']
    require(browser['uiFilesSha256'] == {name: build_inputs[name] for name in ui_files}, 'Observed UI differs from the build')
    raw = read(check_file(browser['rawMeasurements']))
    require(isinstance(raw, list) and raw == browser['measurements'], 'Browser summary differs from raw measurements')
    measurements = browser['measurements']
    require(browser['measurementCount'] == len(measurements) == 7, 'The seven actual browser samples changed')
    selectors = ['.board-column', '#canvas-stage', '#game-canvas', '#agent-message', '#agent-run']
    baseline, viewport = measurements[0]['rects'], measurements[0]['viewport']
    require(set(baseline) == set(selectors), 'Missing a measured layout rectangle')
    require(set(viewport) == {'width', 'height'} and all(type(value) is int and value > 0 for value in viewport.values()), 'Invalid browser viewport')
    for rect in baseline.values():
        require(set(rect) == {'x', 'y', 'width', 'height'} and
                all(type(value) in [int, float] and math.isfinite(value) for value in rect.values()) and
                rect['width'] > 0 and rect['height'] > 0, 'Invalid layout rectangle')
    for item in measurements:
        require(item['viewport'] == viewport and item['inspectionOpen'] is False, 'Viewport or inspection changed during the run')
        require(item['rects'] == baseline, 'Game layout moved between sampled SRA states')
        require(set(item) == {'label', 'actions', 'inspectionOpen', 'levels', 'prefixes', 'rects', 'status', 'viewport'},
                'The actual raw rectangle/counter sample schema changed')
    require([(item['label'], item['status']) for item in measurements] == [
        ('level-1-ready', 'Ready to run from level 1.'),
        ('level-1-running', 'Preparing the agent…'),
        ('level-1-completed', 'Level completed.'),
        ('level-2-running', 'Reading the board and planning…'),
        ('level-2-completed', 'Level completed.'),
        ('level-3-running', 'Reading the board and planning…'),
        ('level-3-completed', 'Level completed.'),
    ], 'The actual sampled idle, active and completed states changed')
    counters = [(item['actions'], item['levels'], item['prefixes']) for item in measurements]
    require(counters == [(0, 0, 0), (0, 0, 0), (15, 1, 15), (15, 1, 15), (30, 2, 30), (30, 2, 30), (49, 3, 47)],
            'Actual sampled browser action/level/plan counters changed')
    require(viewport == {'width': 1363, 'height': 936}, 'The retained desktop viewport changed')
    max_position_delta = max(abs(item['rects'][selector][axis] - baseline[selector][axis])
                             for item in measurements for selector in selectors for axis in ['x', 'y'])
    max_dimension_delta = max(abs(item['rects'][selector][axis] - baseline[selector][axis])
                              for item in measurements for selector in selectors for axis in ['width', 'height'])
    require(baseline['#canvas-stage']['width'] == baseline['#canvas-stage']['height'] ==
            baseline['#game-canvas']['width'] == baseline['#game-canvas']['height'] == 384 and
            baseline['.board-column']['height'] == 442 and baseline['#agent-message']['height'] == 98,
            'The retained desktop layout dimensions changed')
    layout = {'viewport': viewport, 'boardColumnHeight': 442, 'canvasHeight': 384, 'canvasWidth': 384,
              'statusHeight': 98, 'maxDocumentPositionDeltaPx': max_position_delta, 'maxDimensionDeltaPx': max_dimension_delta,
              'selectors': selectors, 'inspectionClosedThroughout': True}
    require(browser['layout'] == layout, 'Layout summary differs from actual measurements')
    result = browser['observedResult']; parts = urlsplit(result['url']); query = parse_qs(parts.query)
    require(result['completedLevels'] == 3 and result['actions'] == 49 and result['prefixes'] == 47 and
            result['entryLevel'] == 4 and result['normalStatus'] == 'Level completed.' and
            query == {'game': ['LIFE'], 'level': ['4']}, 'Observed browser result is not LIFE three levels in 49 actions')
    campaign = browser['browserCampaign']
    require(campaign['sessions'] == 1 and campaign['manualGameActions'] == campaign['resets'] == campaign['levelJumps'] == 0 and
            campaign['runToNextLevelClicks'] == 3, 'Browser campaign includes manual intervention or another session')
    require(campaign['uiActions'] == ['select LIFE from game selector', 'select SRA Agent tab'] + ['Run to next level'] * 3,
            'Recorded browser controls differ from the declared uninterrupted session')
    require(browser['fullscreen']['status'] in ['not_measured', 'not_retested', 'unavailable_in_browser'] and
            browser['mobile']['status'] == 'not_measured', 'Unobserved fullscreen or mobile behavior must remain unverified')
    screenshot = check_file(browser['screenshot']); data = screenshot.read_bytes()
    png = data.startswith(b'\x89PNG\r\n\x1a\n') and screenshot.suffix.lower() == '.png'
    jpeg = data.startswith(b'\xff\xd8\xff') and screenshot.suffix.lower() in ['.jpg', '.jpeg']
    require(png or jpeg, 'Browser capture filename does not match its unchanged image bytes')
    properties = image_properties(data)
    require(properties == browser['screenshotProperties'], 'Image dimensions differ from the retained image bytes')
    accessibility = check_file(browser['accessibility']).read_text()
    for text in [result['url'], 'game=LIFE&level=4', 'Solve with SRA.', 'Level completed.',
                 'button (collapsed) Inspect reasoning']:
        require(text in accessibility, f'Final accessibility capture lacks observed content: {text}')
    for value, label in [(49, 'actions'), (3, 'levels solved'), (47, 'completed plans')]:
        require(re.search(r'\btext ' + str(value) + r'\s*\n\s*\d+ text ' + re.escape(label) + r'\s*(?:\n|$)', accessibility),
                'Final AX capture does not bind the observed counter to its label: ' + label)
    return {'receipt': proof(path), 'measurements': len(measurements), 'viewport': viewport,
            'boardColumnHeight': 442, 'canvasSize': 384, 'statusHeight': 98,
            'maximumDocumentPositionDeltaPx': max_position_delta, 'maximumDimensionDeltaPx': max_dimension_delta,
            'completedLevels': 3, 'actions': 49, 'prefixes': 47, 'sampledCounters': [list(row) for row in counters], 'inspectionClosedThroughout': True,
            'captureProperties': properties, 'fullscreen': browser['fullscreen']['status'], 'mobile': 'not_measured',
            'qualification': 'Five normal desktop rectangles are identical across seven retained idle, active and completed samples. This is not a per-frame measurement. Every raw sample retains its displayed action, level and plan counters; the final accessibility tree independently binds 49 actions, 3 solved levels and 47 completed plans to their labels and retains the level-4 URL. The unchanged JPEG capture is retained separately. No additional fullscreen-mode or mobile-size verification is claimed.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true', help='Recompute without changing retained validation.json')
    args = parser.parse_args()
    required = ['source-manifest-final.json', 'life-three-levels-final.json', 'life-public-trace-final.json.gz',
                'logs/execution-life-final.json', 'life-original-component-comparison.json', 'life-material-identity-recipes.json.gz',
                'cold-start-v49.json', 'evidence-retention.json', 'validation/delta-tests-run.json', 'validation/checks-run.json',
                'regression-plan.json', 'regression-verification.json', 'regression-summary.json', 'life-browser-verification.json']
    missing = [name for name in required if not (OUT / name).is_file()]
    require(not missing, 'Missing retained release evidence: ' + ', '.join(missing))
    before = retained_input_inventory()
    source = validate_source()
    initial = validate_initial_failure()
    campaign = validate_campaign(source)
    cold = validate_cold_diagnostic()
    comparisons = validate_comparator()
    tests = validate_tests(source)
    regressions = validate_regressions(source)
    checks = validate_checks(source)
    progress = validate_progress()
    history = validate_history()
    browser = validate_browser(source)
    require(validate_source() == source, 'Native source changed during read-only validation')
    require(retained_input_inventory() == before, 'A retained proof, source, test or tool changed during validation')
    report = {'schema': 'logos-engine.v50.release-validation.v1', 'status': 'passed', 'sourceDigest': SOURCE_DIGEST,
              'nativeSourceFiles': 170, 'nativeSourceManifest': proof(OUT / 'source-manifest-final.json'),
              'initialFailedAttempt': initial, 'newActualCampaign': campaign, 'coldStartDiagnostic': cold, 'componentComparison': comparisons,
              'deltaTests': tests, 'regressions': regressions, 'checks': checks, 'browser': browser,
              'progress': progress, 'historicalV49Evidence': history,
              'completeMigration': False, 'originalFullCommonCallerParity': False,
              'retainedInputsUnchangedDuringValidation': True, 'generator': proof(Path(__file__).resolve()),
              'scope': 'Read-only validation of retained actual executions, immutable failed-attempt evidence, frozen native inputs, one recomputed original-provider comparison with explicit numeric identity boundaries, one affected test run, six recorded-public regressions, build inputs, historical proof bytes and observed browser layout. No game, native agent or test suite is executed. LIFE reaches three official levels and enters level four without full-game WIN. Original component and native full-caller trajectories differ from their first action.'}
    output = OUT / 'validation.json'
    if args.verify:
        require(output.is_file() and read(output) == report, 'Retained release validation differs from recomputation')
    else:
        require(not output.exists(), 'validation.json already exists; use --verify without overwriting')
        output.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create', 'newGame': 'LIFE',
                      'levelsCompleted': 3, 'enteredLevel': 4, 'officialState': 'NOT_FINISHED', 'actions': 49,
                      'deltaTests': tests['counts'], 'recordedPublicRegressions': 6, 'entryProgressPercent': 53.9}), flush=True)


if __name__ == '__main__':
    main()


