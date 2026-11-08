#!/usr/bin/env python3
"""Validate retained v49 proofs without running a game, native agent or test suite.

Only the independent original-provider comparator runs, with read-only --verify.
The sole output is validation.json; --verify leaves all retained evidence unchanged.
GRIL reaches three official levels, entering level four without a full-game WIN.
Source-provider agreement is bounded to the actual native public transitions.
"""
from __future__ import annotations

import argparse
from collections import Counter
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import parse_qs, urlsplit

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v49'
SOURCE_DIGEST = 'e5a7fc15461fd1ddbc9019b3749dad98a2235fc38df40898778d6c089cc13a5a'
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.19.0'
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'
PREVIOUS_RELEASE_COMMIT = 'eb2a7b40d87cacd6b16d1b71b5042f9ccefc6cf7'
REFERENCE_COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
REFERENCE = ROOT / 'reference/v6' / REFERENCE_COMMIT
TEST_FILES = [
    'tests/v6-occluded-catalogue-reference.test.ts',
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
               ('SELE', 3, 44, 44), ('COLM', 3, 45, 21), ('ZIPP', 6, 101, 40)]
PUBLIC_FIELDS = {'frame_rows', 'frame_packet', 'level', 'levels_completed',
                 'state', 'step_index', 'available_action_refs', 'frame_hash'}
OWN_KINDS = {'catalogue_observation', 'catalogue_response', 'catalogue_field_input_observed'}


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
    source = read(OUT / 'source-manifest.json')
    paths = {name for name in file_inventory(['src/logos-engine', 'src/runtime'])
             if Path(name).suffix in ['.ts', '.json', '.drm']}
    require(source['fileCount'] == len(source['files']) == 166,
            'The frozen source must contain exactly 166 files')
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
        require(execution['nativeSourceManifestDigest'] == SOURCE_DIGEST,
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
    require(checks['schema'] == 'logos-engine.v49.actual-release-checks.v1' and
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


def raw_command(command):
    if command.get('data') == {} and command['action_ref'] != 'ACTION6':
        require(set(command) == {'action_ref', 'data'}, 'Unexpected scalar transport fields')
        return {'action_ref': command['action_ref']}
    return command


def validate_campaign(source):
    path, trace_path, execution_path = [OUT / name for name in
        ['gril-three-levels.json', 'gril-public-trace.json.gz', 'logs/execution-gril.json']]
    campaign, execution = read(path), read(execution_path)
    require(campaign['schema'] == 'logos-engine.v6.integrated-game-campaign.v1' and
            campaign['game'] == 'GRIL' and campaign['targetLevels'] == 3 and
            campaign['referenceCommit'] == REFERENCE_COMMIT and campaign['baseline'] is None and
            campaign['failure'] is None, 'Wrong actual campaign identity or unsuccessful execution')
    validate_report(campaign, source)
    require(execution['schema'] == 'logos-engine.v49.actual-campaign-execution.v1',
            'Campaign execution receipt schema changed')
    validate_execution(execution, source)
    require(execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', 'GRIL', '3',
                                    str(path), str(trace_path)], 'Unexpected actual campaign command')
    require(execution['report'] == proof(path) and execution['trace'] == proof(trace_path),
            'Campaign/trace identity differs from its actual execution')
    logged = json.loads(gzip.decompress(check_file(execution['output']).read_bytes()).decode().splitlines()[-1])
    require(logged['status'] == 'passed' and logged['sourceDigest'] == SOURCE_DIGEST and
            logged['final'] == campaign['final'] and logged['boundaries'] == campaign['boundaries'],
            'Actual campaign log disagrees with the retained report')
    final = campaign['final']
    require((final['actions'], final['prefixes'], final['levelsCompleted'], final['level'], final['state'],
             final['status'], final['reason']) ==
            (19, 19, 3, 4, 'NOT_FINISHED', 'stopped', 'target_levels_completed'),
            'The retained campaign must stop after three levels, without claiming a full-game WIN')
    require(final['operationCounts'] == {'init': 1, 'advance': 19, 'resume': 18} and
            final['caller']['enabled'] is True and final['caller']['boundaryReplays'] == 2 and
            final['caller']['goalEvents'] == 3, 'Continuous common caller acquisition changed')
    boundaries = campaign['boundaries']
    require([b['totalActions'] for b in boundaries] == [5, 10, 19] and
            [b['levelActions'] for b in boundaries] == [5, 5, 9] and
            [b['completedLevel'] for b in boundaries] == [1, 2, 3] and
            [b['nativeLevel'] for b in boundaries] == [2, 3, 4] and
            [b['levelsCompleted'] for b in boundaries] == [1, 2, 3] and
            [b['prefixCount'] for b in boundaries] == [5, 10, 19],
            'Official level boundaries changed')
    packets = read(trace_path)['packets']
    packet_summary = validate_trace(campaign, trace_path)
    for index, item in enumerate(packets):
        packet = item['packet']
        require(set(packet) == PUBLIC_FIELDS and packet['step_index'] == index,
                'A trace packet lost a public field or a step')
        require(packet['frame_hash'] == packet_hash(packet['frame_rows'])[:16],
                'A public frame hash does not bind its full pixel rows')
        if index:
            before = packets[index - 1]['packet']
            action = campaign['actions'][index - 1]
            require((action['levelBefore'], action['completedBefore']) ==
                    (before['level'], before['levels_completed']), 'A native action has the wrong public predecessor')
    observed_boundaries = [i for i in range(1, len(packets)) if
                          packets[i]['packet']['levels_completed'] > packets[i - 1]['packet']['levels_completed']]
    require(observed_boundaries == [5, 10, 19], 'Boundary claims disagree with complete public returns')
    own_events, modes, families = [], Counter(), Counter()
    for index, prefix in enumerate(campaign['prefixes'], 1):
        require(prefix['acquiredActions'] == 1 and prefix['callerAcquiredTransitions'] == index,
                'An actual return is missing or duplicated in common acquisition')
        families[prefix['family']] += 1
        shared = prefix['sharedSeries']
        events = shared['catalogueAcquiredEvents']
        require(events and all(e['kind'] in OWN_KINDS for e in events), 'Catalogue own acquisition is incomplete')
        require(all(e['command'] == raw_command(campaign['actions'][index - 1]['command']) for e in events),
                'Acquisition did not retain the actual raw command')
        own_events.extend(events)
        require(shared['catalogueEventCount'] == len(own_events) and shared['catalogueLatestEvent'] == own_events[-1],
                'Catalogue cumulative acquisition differs from retained events')
        own = prefix.get('occludedCatalogue')
        if own is None:
            continue
        mode = own['plan']['mode']
        modes[mode] += 1
        require(own['stateNode'] == 'family_state:public_occurrence_recall' and
                prefix['family'] == 'public_occurrence_recall' and
                own['proposal']['occluded_catalogue_plan'] == own['plan'],
                'Catalogue and view must use the same existing family owner')
        require(own['proposal']['actions'] == [raw_command(campaign['actions'][index - 1]['command'])],
                'The selected catalogue proposal differs from the actual action')
        if mode == 'view':
            require(prefix['selectionGroup'] == 'view' and prefix['fieldSubquestion'] is None and
                    prefix['proposalKind'] == 'catalogue_view_experiment' and
                    all(e['kind'] != 'catalogue_response' for e in events),
                    'Scalar view was incorrectly recorded as a point response')
        else:
            require(mode in ['answer', 'select'] and prefix['selectionGroup'] == 'window_constraints' and
                    prefix['fieldSubquestion'] == 'occluded_catalogue_composition',
                    'Point catalogue entry changed')
    require(modes == {'answer': 7, 'select': 4, 'view': 3} and len(own_events) == 34 and
            Counter(e['kind'] for e in own_events) ==
            {'catalogue_observation': 16, 'catalogue_response': 11, 'catalogue_field_input_observed': 7},
            'Actual catalogue modes or own acquisition totals changed')
    require(families == {'observed_frontier': 2, 'containment': 2, 'public_occurrence_recall': 15},
            'The retained common-caller family selection changed')
    first = campaign['prefixes'][0]
    require(first['family'] == 'observed_frontier' and first['proposalKind'] == 'experiment' and
            campaign['actions'][0]['command'] == {'action_ref': 'ACTION3', 'data': {}} and
            [event['kind'] for event in first['sharedSeries']['catalogueAcquiredEvents']] ==
            ['catalogue_observation', 'catalogue_field_input_observed'],
            'Cold acquisition was not obtained passively from the first common frontier experiment')
    return {'report': proof(path), 'trace': proof(trace_path), 'actualExecution': proof(execution_path),
            'actions': final['actions'], 'prefixes': final['prefixes'], 'levelsCompleted': final['levelsCompleted'],
            'enteredLevel': final['level'], 'officialState': final['state'], 'perLevelActions': [5, 5, 9],
            'sessions': 1, 'commonCallerAcquiredTransitions': 19, 'boundaryReplays': 2,
            'selectedCatalogueProposalModes': dict(modes), 'catalogueOwnEvents': len(own_events),
            **packet_summary,
            'qualification': 'One actual cold native common-caller session reaches the official third boundary and stops at entry to level four. The first useful scalar effect is acquired from the existing frontier. This is a three-level success, not a complete-game WIN.'}


def validate_cold_diagnostic():
    path = OUT / 'cold-start-v48.json'
    cold = read(path)
    require(cold['schema'] == 'logos-engine.v49.cold-start-v48.v1' and cold['status'] == 'passed' and
            cold['sourceCommit'] == PREVIOUS_RELEASE_COMMIT and cold['sourceUnchanged'] is True and
            cold['nativeBefore'] == cold['nativeAfter'], 'Published v48 cold diagnostic changed')
    before = cold['nativeBefore']
    manifest = read(check_file(before['nativeSourceManifest']))
    require(before['digest'] == manifest['digest'] ==
            '30f078d458bf7771e203f3af194ff0bd89fb8fa233d3d0c14cee32282551ea24' and
            before['files'] == manifest['fileCount'] == 163, 'Wrong source for the recorded cold diagnostic')
    corpus = read(check_file(cold['publicCorpus']))
    packet = next(item['packet'] for item in corpus['games'] if item['game'] == 'GRIL')
    require(cold['packet'] == packet == read(OUT / 'gril-public-trace.json.gz')['packets'][0]['packet'] and
            cold['packetSha256'] == packet_hash(cold['packet']), 'Cold diagnosis used a different public initial view')
    require(cold['game'] == 'GRIL' and cold['gameLabelVisibleToRuntime'] is False and
            cold['initializedSessions'] == 1 and cold['dispatchedActions'] == cold['manualPrimingActions'] ==
            cold['levelJumps'] == corpus['actions'] == corpus['levelJumps'] == 0,
            'The cold diagnostic dispatched or primed a game action')
    check_file(cold['generator'])
    result = cold['nativeResult']; snapshot = result['snapshot']
    require(result['kind'] == 'action' and result['command'] == {'action_ref': 'ACTION3'} and
            snapshot['actions'] == 0 and snapshot['lastDecision'] == 'observed_frontier' and
            snapshot['proposal']['kind'] == 'experiment' and
            snapshot['proposal']['question']['reason'] == 'unobserved_input_effect_or_unexplained_transition' and
            snapshot['proposal']['question']['input_trials_at_context'] == 0 and
            snapshot['implementation'] == 'logos-engine.typescript.v6.native-migration/0.18.0',
            'The recorded existing frontier no longer shows an unprimed scalar proposal')
    return {'receipt': proof(path), 'sourceCommit': PREVIOUS_RELEASE_COMMIT,
            'proposedCommand': result['command'], 'dispatchedActions': 0,
            'qualification': 'A retained read-only v48 planning decision establishes that the existing common frontier can choose the first scalar experiment. It was not executed by this diagnostic and is not rerun on v49.'}


def validate_comparator():
    path = OUT / 'gril-original-component-comparison.json'
    compared = read(path)
    require(compared['schema'] == 'logos-engine.v49.catalogue-public-component-comparison.v1' and
            compared['status'] == 'passed' and compared['recordedPublicTrajectoriesEquivalent'] is False and
            compared['originalFullCommonCallerParity'] is False and compared['comparisonConclusion'] ==
            'exact_catalogue_provider_and_acquisition_on_actual_native_public_returns_with_explicit_caller_trajectory_divergence',
            'Component agreement was expanded into a full caller or whole-trajectory claim')
    require(set(compared['inputs']) == {'sourceComponentCampaign', 'isolatedColdProbe', 'sourceContracts',
                                      'campaign', 'trace', 'execution', 'source'}, 'Comparison inputs changed')
    for item in compared['inputs'].values():
        check_file(item)
    generator = check_file(compared['generator'])
    require(generator == ROOT / 'scripts/compare-v49-catalogue-public-evidence.py', 'Unexpected independent comparator')
    source = compared['sourceVerification']; native = compared['nativeVerification']
    require(source['commit'] == REFERENCE_COMMIT and source['allPinnedFilesVerified'] == 1786 and
            source['sourceUnchanged'] is True and source['sourceAndNativeGameAssetsExact'] is True and
            source['sourceIsolatedColdAbstentionRetained'] is True,
            'Source identity, isolation or retained initial abstention changed')
    manifest = read(REFERENCE / 'manifest.json')
    require(manifest['commit'] == REFERENCE_COMMIT and len(manifest['files']) == 1786,
            'Pinned original source inventory changed')
    for name, item in manifest['files'].items():
        check_file({'path': (REFERENCE / 'source' / name).relative_to(ROOT).as_posix(), 'sha256': item['sha256']})
    require(source['importedSourceFiles'] == len(source['sourceHashes']), 'Imported source inventory count changed')
    for name, digest in source['sourceHashes'].items():
        require(manifest['files'][name]['sha256'] == digest, 'A compared source module differs from its pinned identity')
    require(native == {'nativeSourceFiles': 166, 'nativeSourceDigest': SOURCE_DIGEST, 'currentInventoryExact': True,
                       'sourceUnchangedDuringRun': True, 'executionExitCode': 0,
                       'reportTraceAndLogsVerified': True, 'pythonAgentModules': []},
            'Comparison native inputs differ from the actual frozen campaign')
    summary = compared['summary']
    trace = read(OUT / 'gril-public-trace.json.gz')
    source_subset = read(check_file(compared['inputs']['sourceComponentCampaign']))
    isolated = read(check_file(compared['inputs']['isolatedColdProbe']))
    reference = read(check_file(compared['inputs']['sourceContracts']))
    for evidence in [source_subset, isolated, reference]:
        require(evidence['sourceCommit'] == REFERENCE_COMMIT and
                evidence['pinnedSourceFilesVerifiedBeforeImport'] == 1786, 'Reference fixture source changed')
        check_file({'path': evidence['generator'], 'sha256': evidence['generatorSha256']})
    require(source_subset['status'] == 'passed' and source_subset['fullOriginalCaller'] is False and
            source_subset['actions'] == len(source_subset['prefixes']) == 18 and
            len(source_subset['packets']) == 19 and source_subset['levelsCompleted'] == 3 and
            source_subset['state'] == 'NOT_FINISHED' and source_subset['sessionCount'] == 1 and
            source_subset['manualPrimingActions'] == source_subset['resets'] == source_subset['levelJumps'] == 0 and
            source_subset['providerOrder'] == ['catalogue_propose', 'catalogue_view_propose', 'ObservedFrontier.propose'],
            'Original bounded subset proof changed or was misclassified as the complete caller')
    require(isolated['actions'] == 0 and isolated['reason'] == 'occluded_catalogue_component_abstained' and
            reference['sourceAliasing'] == [], 'Initial component abstention or exact source identity was hidden')
    common = 0
    for left, right in zip(source_subset['packets'][1:], trace['packets'][1:]):
        if left['command'] == raw_command(right['command']) and left['packet'] == right['packet']:
            common += 1
        else:
            break
    require(common == 8, 'The complete public trajectories no longer diverge after eight commands')
    expected = {'nativeActions': 19, 'sourceSubsetActions': 18, 'levelsCompleted': 3, 'officialState': 'NOT_FINISHED',
                'enteredLevel': 4, 'nativePrefixes': 19, 'sourceSubsetPrefixes': 18,
                'nativeCompletePublicPackets': 20,
                'nativePublicFramesIncludingInitial': sum(len(p['packet']['frame_packet']) for p in trace['packets']),
                'exactCommonInitialCommands': common, 'exactCommonInitialPackets': common + 1,
                'sameCurrentInputSourceProposalsCompared': 14, 'proposalModes': {'answer': 7, 'select': 4, 'view': 3},
                'allNativeOwnEventsCompared': 34,
                'eventKinds': {'catalogue_observation': 16, 'catalogue_response': 11, 'catalogue_field_input_observed': 7},
                'foreignProviderTransitionsAcquired': 5, 'stateReconstructions': 19,
                'nativeCallerAcquiredTransitions': 19, 'nativeBoundaryReplays': 2, 'sourceAndNativeSessions': 1,
                'normalizedScalarTransportCommands': sum(raw_command(p['command']) != p['command'] for p in trace['packets'][1:])}
    require(summary == expected, 'Independent component comparison counts differ from retained native/source evidence')
    public = compared['publicEvidence']; divergence = public['firstTrajectoryDivergence']
    require(public['fields'] == sorted(PUBLIC_FIELDS) and public['nativeBoundaryActions'] == [5, 10, 19] and
            public['sourceSubsetBoundaryActions'] == [5, 10, 18] and public['nativePerLevelActions'] == [5, 5, 9] and
            public['sourceSubsetPerLevelActions'] == [5, 5, 8] and divergence['actionIndex'] == common + 1 and
            divergence['sourceCommand'] == {'action_ref': 'ACTION3'} and
            divergence['nativeCommand'] == {'action_ref': 'ACTION4'} and divergence['nativeFamily'] == 'containment',
            'The actual caller trajectory divergence was lost or normalized away')
    for index, row in enumerate(public['packets']):
        packet = trace['packets'][index]['packet']
        require(row == {'packetIndex': index, 'allPublicFieldsRetained': True, 'publicPacketSha256': packet_hash(packet),
                        'canonicalPublicPacketSha256': canonical_hash(packet), 'frames': len(packet['frame_packet'])},
                'Comparator public packet receipts differ from actual returns')
    require(len(public['packets']) == 20, 'Comparator omitted a complete public packet')
    replay = compared['componentReplay']; campaign = read(OUT / 'gril-three-levels.json')
    require(replay['normalizations'] == [] and replay['absoluteNumericTolerance'] == 0 and
            len(replay['prefixes']) == 19 and len(replay['foreignProviders']) == 5,
            'Component comparison weakened its exact own-state scope')
    for index, (row, prefix) in enumerate(zip(replay['prefixes'], campaign['prefixes']), 1):
        events = prefix['sharedSeries']['catalogueAcquiredEvents']; own = prefix.get('occludedCatalogue')
        require(row['actionIndex'] == index and row['sourceCatalogueProposalCompared'] == bool(own) and
                row['completeAcquiredEventsExact'] is True and row['ownStateExactAfterNativeEventReplay'] is True and
                row['acquiredOwnEvents'] == len(events) and row['eventsSha256'] == canonical_hash(events) and
                row['retainedEventCount'] == prefix['sharedSeries']['catalogueEventCount'],
                'Component comparison does not bind every retained native own event')
        require((row['sourceBeforeGuard'] is not None and row['sourceBeforeGuard']['admitted'] is True) if own else
                row['sourceBeforeGuard'] is None, 'Provider guard evidence is missing or overclaimed for a foreign provider')
    command = [sys.executable, '-B', str(generator), '--verify']
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
    require(result.returncode == 0, 'Read-only original-provider comparison failed: ' + result.stderr[-4000:])
    logged = json.loads(result.stdout.splitlines()[-1])
    require(logged == {'status': 'passed', 'mode': 'verify', 'output': path.relative_to(ROOT).as_posix(),
                       'summary': summary}, 'Read-only comparator result differs from retained assertions')
    return {'receipt': proof(path), 'verificationCommand': ['python', '-B', generator.relative_to(ROOT).as_posix(), '--verify'],
            'summary': summary, 'firstTrajectoryDivergence': divergence,
            'wholePublicTrajectoriesEquivalent': False, 'originalFullCommonCallerParity': False,
            'qualification': compared['qualification']}




def validate_regressions(source):
    plan_path, verification_path, summary_path = [OUT / name for name in
        ['regression-plan.json', 'regression-verification.json', 'regression-summary.json']]
    plan, verification, summary = map(read, [plan_path, verification_path, summary_path])
    require(plan['schema'] == 'logos-engine.v49.regression-plan.v1' and
            verification['schema'] == 'logos-engine.v49.regression-verification.v1' and
            summary['schema'] == 'logos-engine.v49.regression-summary.v1', 'Regression schema mismatch')
    require(summary['passed'] is True and verification['passed'] is True and
            verification['nativeSourceUnchangedBeforeAfterAllRuns'] is True and
            verification['nativeSourceBeforeAllRuns'] == verification['nativeSourceAfterAllRuns'] == source,
            'Regressions failed or native source changed')
    require(plan['nativeSourceManifest'] == proof(OUT / 'source-manifest.json') and
            plan['nativeSourceManifestDigest'] == summary['sourceDigest'] == SOURCE_DIGEST and
            plan['nativeSourceFiles'] == summary['nativeSourceFiles'] == 166, 'Regression manifest differs from freeze')
    require(summary['verification'] == proof(verification_path) and
            summary['plan'] == verification['plan'] == proof(plan_path), 'Regression receipt identity mismatch')
    check_file(verification['generator']); check_map(plan['harnessFileSha256'])
    require(len(plan['runs']) == len(verification['runs']) == len(summary['results']) == 5,
            'Exactly five recorded-public replays are required')
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
                attempt['checks'] == 17 and attempt['failedChecks'] == [], 'Regression comparator failed')
        checked = read(check_file(attempt['result']))
        require(checked['schema'] == 'logos-engine.v49.public-regression-comparison.v1' and checked['passed'] is True and
                len(checked['checks']) == 17 and all(row['passed'] is True for row in checked['checks']), 'A regression assertion failed')
        check_file(checked['before']); check_file(checked['after'])
        require(checked['compared'] == attempt['compared'] ==
                {'commands': commands, 'completePublicPackets': commands + 1, 'prefixes': prefixes}, 'Comparison counts changed')
        require(item['comparison'] == attempt['result'] == proof(ROOT / planned['comparison']), 'Comparison file identity mismatch')
        comparison_log = json.loads(gzip.decompress(check_file(attempt['output']).read_bytes()).decode().splitlines()[-1])
        require(comparison_log == {'passed': True, 'checks': 17, 'compared': checked['compared'], 'failed': []},
                'Recorded comparison output disagrees with retained assertions')
        for prefix in current['prefixes']:
            shared = prefix['sharedSeries']
            require(shared['catalogueEventCount'] == 0 and shared['catalogueLatestEvent'] is None and
                    shared['catalogueAcquiredEvents'] == [] and prefix.get('occludedCatalogue') is None,
                    'Catalogue or catalogue-view acquired a retained prior trajectory')
    expected_groups = [
        {'mode': 'recorded-public-replay', 'runs': 5, 'passed': True, 'commands': sum(row[2] for row in REGRESSIONS),
         'completePublicPackets': sum(row[2] + 1 for row in REGRESSIONS), 'prefixes': sum(row[3] for row in REGRESSIONS), 'comparisonChecks': 85, 'games': [row[0] for row in REGRESSIONS]},
        {'mode': 'actual-game-campaign', 'runs': 0, 'passed': True, 'commands': 0,
         'completePublicPackets': 0, 'prefixes': 0, 'comparisonChecks': 0, 'games': []},
    ]
    require(summary['groups'] == expected_groups, 'Regression aggregation changed')
    return {'summary': proof(summary_path), 'groups': summary['groups'],
            'qualification': 'Five cold native replays recompute decisions before consuming retained complete public returns. They are not five additional live wins. The plan, actual receipts and 85 retained comparisons are verified without rerunning the games or replaying the agent.'}


def validate_progress():
    progress_path = ROOT / 'docs/migration/v6-entry-point-progress.json'
    progress = read(progress_path)
    require(progress['schema'] == 'logos-engine.v6.declared-entry-coverage.v1' and
            (progress['connected'], progress['declared'], progress['percent'], progress['implementation']) ==
            (40, 76, 52.6, IMPLEMENTATION), 'Declared source-entry progress changed')
    require(len(progress['groups']) == 4, 'Expected four ordered source DRM lists')
    for group in progress['groups']:
        require(group['declared'] == len(group['entries']) and
                group['connected'] == sum(entry['status'] == 'connected' for entry in group['entries']),
                'Entry group counts do not match explicit statuses')
    require(sum(group['declared'] for group in progress['groups']) == 76 and
            sum(group['connected'] for group in progress['groups']) == 40 and progress['fullV6Parity'] is False,
            'Progress denominator or parity claim changed')
    queue = [entry for group in progress['groups'] for entry in group['entries'] if entry['question'] == 'occluded_catalogue_composition']
    require(queue == [{'question': 'occluded_catalogue_composition', 'family': 'public_occurrence_recall', 'status': 'connected'}],
            'Occluded Catalogue is not registered in the shared owner')
    coverage_path = ROOT / 'docs/migration/v6-coverage.json'; coverage = read(coverage_path)
    require(coverage['complete'] is False and len(coverage['completionGates']) == 6 and
            all(value is False for value in coverage['completionGates'].values()), 'Incomplete migration must remain explicit')
    return {'connected': 40, 'declared': 76, 'percent': 52.6, 'metric': progress['metric'],
            'entryAudit': proof(progress_path), 'migrationAudit': proof(coverage_path),
            'qualification': '52.6% counts registered subquestions in the same four source DRM lists. It is not code-volume progress, game success rate, complete migration or original caller parity.'}


def validate_tests(source):
    path = OUT / 'validation/delta-tests-run.json'
    tests = read(path)
    require(tests['schema'] == 'logos-engine.v49.actual-delta-tests.v1' and tests['status'] == 'passed' and
            tests['sourceAndTestInputsUnchanged'] is True, 'Delta suite failed or inputs changed during execution')
    validate_execution(tests, source)
    require(tests['testFiles'] == TEST_FILES and tests['testFileCount'] == len(TEST_FILES) == 18,
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
            'qualification': 'One retained execution covers the 18 affected test files on unchanged source, test and fixture inputs. Counts and scoped identities are recomputed from its complete TAP output. This is not a rerun of the historical suite.'}


def validate_history():
    selections = [
        'docs/migration/native-campaigns-v48',
        'docs/migration/v48-queued-fields-and-acquired-continuation.md',
        'tests/fixtures/v6-queued-field-original-public.json.gz',
        'tests/fixtures/v6-queued-field-reference.json.gz',
        'tests/fixtures/v6-queued-field-reference-parent-diagnostic.json.gz',
        'scripts/probe-v6-queued-field-original.py',
        'scripts/export-v6-queued-field-reference.py',
        'scripts/history/export-v6-queued-field-reference-parent-diagnostic.py',
        'scripts/compare-v48-queued-public-evidence.py',
        'scripts/compare-v48-trace-continuation.py',
        'scripts/compare-v48-regressions.mjs',
        'scripts/replay-v48-public-regression.mjs',
        'scripts/run-v48-campaign-proof.py',
        'scripts/run-v48-delta-tests.py',
        'scripts/run-v48-regression-checks.py',
        'scripts/run-v48-release-checks.py',
        'scripts/validate-v48-release.py',
    ]
    tree = subprocess.run(['git', 'ls-tree', '-r', '-z', PREVIOUS_RELEASE_COMMIT, '--', *selections],
                          cwd=ROOT, capture_output=True)
    require(tree.returncode == 0, 'Cannot read the previous committed release tree')
    verified = {}
    for row in tree.stdout.split(b'\0'):
        if not row:
            continue
        metadata, name = row.split(b'\t', 1); mode, kind, object_id = metadata.split(b' ')
        require(kind == b'blob', 'Historical evidence must be an ordinary Git blob')
        relative = name.decode(); data = (ROOT / relative).read_bytes()
        current = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        require(current == object_id.decode(), f'Historical v48 evidence changed: {relative}')
        verified[relative] = {'gitObject': object_id.decode(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    require(all(name in verified for name in selections[1:]), 'A selected v48 proof is absent from the Git tree')
    old_docs = {name for name in verified if name.startswith('docs/migration/native-campaigns-v48/')}
    require(old_docs == file_inventory(['docs/migration/native-campaigns-v48']) and len(old_docs) > 50,
            'The complete published v48 evidence inventory changed')
    colm = read(ROOT / 'docs/migration/native-campaigns-v48/colm-three-levels.json')
    zipp = read(ROOT / 'docs/migration/native-campaigns-v48/zipp-six-levels.json')
    require(colm['status'] == zipp['status'] == 'passed' and
            (colm['final']['actions'], colm['final']['prefixes'], colm['final']['levelsCompleted'], colm['final']['state']) ==
            (45, 21, 3, 'NOT_FINISHED') and
            (zipp['final']['actions'], zipp['final']['prefixes'], zipp['final']['levelsCompleted'], zipp['final']['state']) ==
            (101, 40, 6, 'WIN'), 'Published v48 outcomes were reclassified')
    return {'commit': PREVIOUS_RELEASE_COMMIT, 'filesVerified': len(verified), 'unchanged': True,
            'files': verified,
            'scope': 'Every tracked byte in the full v48 campaign evidence directory and the listed original-reference fixtures, probes, exporters, comparison tools and release scripts matches its published Git object. No historical proof is regenerated or reclassified.'}


def retained_input_inventory():
    """Protect comparator inputs without executing any producer of those inputs."""
    folders = ['src', 'tests', 'scripts', 'docs/migration/native-campaigns-v49',
               'docs/migration/native-campaigns-v48', f'reference/v6/{REFERENCE_COMMIT}/source']
    return {name: sha(ROOT / name) for name in sorted(file_inventory(folders))
            if name != 'docs/migration/native-campaigns-v49/validation.json'}


def validate_browser(source):
    path = OUT / 'gril-browser-verification.json'; browser = read(path)
    require(browser['schema'] == 'logos-engine.v49.browser-verification.v1' and browser['status'] == 'passed' and
            browser['game'] == 'GRIL' and browser['nativeSourceManifestDigest'] == source['digest'], 'Browser proof source mismatch')
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
    require(raw['measurements'] == browser['measurements'], 'Browser summary differs from raw measurements')
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
    require(counters == [(0, 0, 0), (0, 0, 0), (5, 1, 5), (5, 1, 5), (10, 2, 10), (10, 2, 10), (19, 3, 19)],
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
    require(result['completedLevels'] == 3 and result['actions'] == 19 and result['prefixes'] == 19 and
            result['entryLevel'] == 4 and result['normalStatus'] == 'Level completed.' and
            query == {'game': ['GRIL'], 'level': ['4']} and raw['finalUrl'] == result['url'], 'Observed browser result is not GRIL three levels in 19 actions')
    campaign = browser['browserCampaign']
    require(campaign['sessions'] == 1 and campaign['manualGameActions'] == campaign['resets'] == campaign['levelJumps'] == 0 and
            campaign['runToNextLevelClicks'] == 3, 'Browser campaign includes manual intervention or another session')
    require(campaign['uiActions'] == raw['uiActions'] == ['select GRIL from game selector', 'select SRA Agent tab'] + ['Run to next level'] * 3 and
            raw['manualGameActions'] == raw['sessionResets'] == raw['levelJumps'] == 0,
            'Raw browser actions differ from the declared uninterrupted session')
    require(browser['fullscreen']['status'] in ['not_measured', 'not_retested', 'unavailable_in_browser'] and
            browser['mobile']['status'] == 'not_measured', 'Unobserved fullscreen or mobile behavior must remain unverified')
    screenshot = check_file(browser['screenshot']); data = screenshot.read_bytes()
    png = data.startswith(b'\x89PNG\r\n\x1a\n') and screenshot.suffix.lower() == '.png'
    jpeg = data.startswith(b'\xff\xd8\xff') and screenshot.suffix.lower() in ['.jpg', '.jpeg']
    require(png or jpeg, 'Browser capture filename does not match its unchanged image bytes')
    properties = image_properties(data)
    require(properties == browser['screenshotProperties'], 'Image dimensions differ from the retained image bytes')
    accessibility = check_file(browser['accessibility']).read_text()
    for text in [result['url'], 'game=GRIL&level=4', 'Solve with SRA.', 'Level completed.',
                 'button (collapsed) Inspect reasoning']:
        require(text in accessibility, f'Final accessibility capture lacks observed content: {text}')
    for value, label in [(19, 'actions'), (3, 'levels solved'), (19, 'completed plans')]:
        require(re.search(r'\btext ' + str(value) + r'\s*\n\s*\d+ text ' + re.escape(label) + r'\s*(?:\n|$)', accessibility),
                'Final AX capture does not bind the observed counter to its label: ' + label)
    return {'receipt': proof(path), 'measurements': len(measurements), 'viewport': viewport,
            'boardColumnHeight': 442, 'canvasSize': 384, 'statusHeight': 98,
            'maximumDocumentPositionDeltaPx': max_position_delta, 'maximumDimensionDeltaPx': max_dimension_delta,
            'completedLevels': 3, 'actions': 19, 'prefixes': 19, 'sampledCounters': [list(row) for row in counters], 'inspectionClosedThroughout': True,
            'captureProperties': properties, 'fullscreen': browser['fullscreen']['status'], 'mobile': 'not_measured',
            'qualification': 'Five normal desktop rectangles are identical across seven retained idle, active and completed samples. This is not a per-frame measurement. Every raw sample retains its displayed action, level and plan counters; the final accessibility tree independently binds 19 actions, 3 solved levels and 19 completed plans to their labels and retains the level-4 URL. The unchanged JPEG capture is retained separately. No additional fullscreen-mode or mobile-size verification is claimed.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true', help='Recompute without changing retained validation.json')
    args = parser.parse_args()
    required = ['source-manifest.json', 'gril-three-levels.json', 'gril-public-trace.json.gz',
                'logs/execution-gril.json', 'gril-original-component-comparison.json', 'cold-start-v48.json',
                'validation/delta-tests-run.json', 'validation/checks-run.json', 'regression-plan.json',
                'regression-verification.json', 'regression-summary.json', 'gril-browser-verification.json']
    missing = [name for name in required if not (OUT / name).is_file()]
    require(not missing, 'Missing retained release evidence: ' + ', '.join(missing))
    before = retained_input_inventory()
    source = validate_source()
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
    report = {'schema': 'logos-engine.v49.release-validation.v1', 'status': 'passed', 'sourceDigest': SOURCE_DIGEST,
              'nativeSourceFiles': 166, 'nativeSourceManifest': proof(OUT / 'source-manifest.json'),
              'newActualCampaign': campaign, 'coldStartDiagnostic': cold, 'componentComparison': comparisons,
              'deltaTests': tests, 'regressions': regressions, 'checks': checks, 'browser': browser,
              'progress': progress, 'historicalV48Evidence': history,
              'completeMigration': False, 'originalFullCommonCallerParity': False,
              'retainedInputsUnchangedDuringValidation': True, 'generator': proof(Path(__file__).resolve()),
              'scope': 'Read-only validation of retained actual executions, frozen native inputs, one recomputed original-provider comparison, one affected test run, five recorded-public regressions, build inputs, historical proof bytes and observed browser layout. No game, native agent or test suite is executed. GRIL reaches three official levels and enters level four without full-game WIN. The full original common caller and native trajectories remain explicitly different.'}
    output = OUT / 'validation.json'
    if args.verify:
        require(output.is_file() and read(output) == report, 'Retained release validation differs from recomputation')
    else:
        require(not output.exists(), 'validation.json already exists; use --verify without overwriting')
        output.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create', 'newGame': 'GRIL',
                      'levelsCompleted': 3, 'enteredLevel': 4, 'officialState': 'NOT_FINISHED', 'actions': 19,
                      'deltaTests': tests['counts'], 'recordedPublicRegressions': 5, 'entryProgressPercent': 52.6}), flush=True)


if __name__ == '__main__':
    main()


