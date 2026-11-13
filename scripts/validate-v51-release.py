#!/usr/bin/env python3
"""Validate retained v51 proofs without running a game, native agent or test suite.

The original component comparator is recomputed with read-only --verify. All
native executions, tests, browser observations and source inventories must already
exist. The only possible output is validation.json; --verify changes no evidence.
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
from urllib.parse import parse_qs, urlsplit

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v51'
SOURCE_DIGEST = 'd0ec90ead65d412cf5e90c2610466a15c1a06994d40fb92a1d3772684e8cf78c'
NATIVE_FILES = 172
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.21.0'
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'
PREVIOUS_RELEASE_COMMIT = '049091c01b5969034350f3982c32141d42f4d67f'
REFERENCE_COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
REFERENCE = ROOT / 'reference/v6' / REFERENCE_COMMIT
TEST_FILES = [
    'tests/v6-field-service-reference.test.ts',
    'tests/v6-field-service-kernel.test.ts',
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
               ('SELE', 3, 44, 44), ('COLM', 3, 45, 21), ('ZIPP', 6, 101, 40),
               ('GRIL', 3, 19, 19), ('LIFE', 3, 49, 47)]
PUBLIC_FIELDS = {'frame_rows', 'frame_packet', 'level', 'levels_completed',
                 'state', 'step_index', 'available_action_refs', 'frame_hash'}
OWN_KINDS = {'nested_control_response', 'envelope_fill_context', 'field_service_context', 'field_service_transfer'}



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
    require(source['fileCount'] == len(source['files']) == NATIVE_FILES,
            'The frozen source must contain the declared native file count')
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
    require(checks['schema'] == 'logos-engine.v51.actual-release-checks.v1' and
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


def evidence_references(value):
    if isinstance(value, str) and value: return [value]
    require(isinstance(value, list), 'Invalid retained observation evidence reference')
    return [reference for item in value for reference in evidence_references(item)]


def raw_command(command):
    if command.get('data') == {} and command['action_ref'] != 'ACTION6':
        require(set(command) == {'action_ref', 'data'}, 'Unexpected scalar transport fields')
        return {'action_ref': command['action_ref']}
    return command


def validate_regressions(source):
    plan_path, verification_path, summary_path = [OUT / name for name in
        ['regression-plan.json', 'regression-verification.json', 'regression-summary.json']]
    plan, verification, summary = map(read, [plan_path, verification_path, summary_path])
    require(plan['schema'] == 'logos-engine.v51.regression-plan.v1' and
            verification['schema'] == 'logos-engine.v51.regression-verification.v1' and
            summary['schema'] == 'logos-engine.v51.regression-summary.v1', 'Regression schema mismatch')
    require(summary['passed'] is True and verification['passed'] is True and
            verification['nativeSourceUnchangedBeforeAfterAllRuns'] is True and
            verification['nativeSourceBeforeAllRuns'] == verification['nativeSourceAfterAllRuns'] == source,
            'Regressions failed or native source changed')
    require(plan['nativeSourceManifest'] == proof(OUT / 'source-manifest.json') and
            plan['nativeSourceManifestDigest'] == summary['sourceDigest'] == SOURCE_DIGEST and
            plan['nativeSourceFiles'] == summary['nativeSourceFiles'] == NATIVE_FILES, 'Regression manifest differs from freeze')
    require(summary['verification'] == proof(verification_path) and
            summary['plan'] == verification['plan'] == proof(plan_path), 'Regression receipt identity mismatch')
    check_file(verification['generator']); check_map(plan['harnessFileSha256'])
    require(len(plan['runs']) == len(verification['runs']) == len(summary['results']) == 7,
            'Exactly seven recorded-public replays are required')
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
                attempt['checks'] == 19 and attempt['failedChecks'] == [], 'Regression comparator failed')
        checked = read(check_file(attempt['result']))
        require(checked['schema'] == 'logos-engine.v51.public-regression-comparison.v1' and checked['passed'] is True and
                len(checked['checks']) == 19 and all(row['passed'] is True for row in checked['checks']), 'A regression assertion failed')
        check_file(checked['before']); check_file(checked['after'])
        if game == 'LIFE':
            material = checked['typedMaterialComparison']; recipe_path = check_file(material['recipes']); recipes = read(recipe_path)
            require(recipe_path == ROOT / 'docs/migration/native-campaigns-v50/life-material-identity-recipes.json.gz' and
                    material['recipes']['verified'] == len(recipes['recipes']) == 328 and
                    material['recipes']['uniqueNativeInputs'] == len({row['nativeHash'] for row in recipes['recipes']}) == 328,
                    'LIFE material normalization lacks the historical independently verified recipes')
            require(material['before'] == material['after'] == {'proposals': 44, 'events': 68, 'explicitNegativeZeroPaths': 14},
                    'LIFE comparison omitted material proposals, events or signed-zero evidence')
            references = [row for row in checked['independentlyRecomputedReferences'] if row['kind'] == 'typed_material_recipe']
            require(len(references) == 328 and all(row['independentlyRecomputed'] is True for row in references) and
                    {row['baseline'] for row in references} == {row['nativeHash'] for row in recipes['recipes']},
                    'LIFE recipe rebinding did not independently cover the complete identity domain')
        else:
            require('typedMaterialComparison' not in checked, 'An unrelated regression acquired material comparison claims')
        require(checked['compared'] == attempt['compared'] ==
                {'commands': commands, 'completePublicPackets': commands + 1, 'prefixes': prefixes}, 'Comparison counts changed')
        require(item['comparison'] == attempt['result'] == proof(ROOT / planned['comparison']), 'Comparison file identity mismatch')
        comparison_log = json.loads(gzip.decompress(check_file(attempt['output']).read_bytes()).decode().splitlines()[-1])
        require(comparison_log == {'passed': True, 'checks': 19, 'compared': checked['compared'], 'failed': []},
                'Recorded comparison output disagrees with retained assertions')
        for prefix in current['prefixes']:
            shared = prefix['sharedSeries']
            require(shared['fieldServiceEventCount'] == 0 and shared['fieldServiceLatestEvent'] is None and
                    shared['fieldServiceAcquiredEvents'] == shared['fieldServiceAcquiredNegativeZeroPaths'] == [] and
                    prefix.get('fieldService') is None, 'Field service acquired a retained unrelated trajectory')
            if game != 'LIFE':
                require(shared['typedMaterialEventCount'] == 0 and shared['typedMaterialLatestEvent'] is None and
                        shared['typedMaterialAcquiredEvents'] == shared['typedMaterialAcquiredNegativeZeroPaths'] == [] and
                        prefix.get('typedMaterial') is None, 'Typed material acquired a trajectory preceding its LIFE evidence')
    expected_groups = [
        {'mode': 'recorded-public-replay', 'runs': 7, 'passed': True, 'commands': sum(row[2] for row in REGRESSIONS),
         'completePublicPackets': sum(row[2] + 1 for row in REGRESSIONS), 'prefixes': sum(row[3] for row in REGRESSIONS), 'comparisonChecks': 133, 'games': [row[0] for row in REGRESSIONS]},
        {'mode': 'actual-game-campaign', 'runs': 0, 'passed': True, 'commands': 0,
         'completePublicPackets': 0, 'prefixes': 0, 'comparisonChecks': 0, 'games': []},
    ]
    require(summary['groups'] == expected_groups, 'Regression aggregation changed')
    return {'summary': proof(summary_path), 'groups': summary['groups'],
            'qualification': 'Seven cold native replays recompute decisions before consuming retained complete public returns. They are not seven additional live wins. The plan, actual receipts and 133 retained comparisons are verified without rerunning the games or replaying the agent.'}


def validate_progress():
    progress_path = ROOT / 'docs/migration/v6-entry-point-progress.json'
    progress = read(progress_path)
    require(progress['schema'] == 'logos-engine.v6.declared-entry-coverage.v1' and
            (progress['connected'], progress['declared'], progress['percent'], progress['implementation']) ==
            (42, 76, 55.3, IMPLEMENTATION), 'Declared source-entry progress changed')
    require(len(progress['groups']) == 4, 'Expected four ordered source DRM lists')
    for group in progress['groups']:
        require(group['declared'] == len(group['entries']) and
                group['connected'] == sum(entry['status'] == 'connected' for entry in group['entries']),
                'Entry group counts do not match explicit statuses')
    require(sum(group['declared'] for group in progress['groups']) == 76 and
            sum(group['connected'] for group in progress['groups']) == 42 and progress['fullV6Parity'] is False,
            'Progress denominator or parity claim changed')
    queue = [entry for group in progress['groups'] for entry in group['entries'] if entry['question'] == 'field_service_composition']
    require(queue == [{'question': 'field_service_composition', 'family': 'public_occurrence_recall', 'status': 'connected'}],
            'Field Service is not registered in the shared owner')
    coverage_path = ROOT / 'docs/migration/v6-coverage.json'; coverage = read(coverage_path)
    require(coverage['complete'] is False and len(coverage['completionGates']) == 6 and
            all(value is False for value in coverage['completionGates'].values()), 'Incomplete migration must remain explicit')
    return {'connected': 42, 'declared': 76, 'percent': 55.3, 'metric': progress['metric'],
            'entryAudit': proof(progress_path), 'migrationAudit': proof(coverage_path),
            'qualification': '55.3% counts registered subquestions in the same four source DRM lists. It is not code-volume progress, game success rate, complete migration or original caller parity.'}


def validate_tests(source):
    path = OUT / 'validation/delta-tests-run.json'
    tests = read(path)
    require(tests['schema'] == 'logos-engine.v51.actual-delta-tests.v1' and tests['status'] == 'passed' and
            tests['sourceAndTestInputsUnchanged'] is True, 'Delta suite failed or inputs changed during execution')
    validate_execution(tests, source)
    require(tests['testFiles'] == TEST_FILES and tests['testFileCount'] == len(TEST_FILES) == 23,
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
            'qualification': 'One retained execution covers the 23 affected test files on unchanged source, test and fixture inputs. Counts and scoped identities are recomputed from its complete TAP output. This is not a rerun of the historical suite.'}


def validate_cold_diagnostic():
    path = OUT / 'cold-start-v50.json'; cold = read(path)
    require(cold['schema'] == 'logos-engine.v51.cold-start-v50.v1' and cold['status'] == 'passed' and
            cold['sourceCommit'] == PREVIOUS_RELEASE_COMMIT and cold['sourceUnchanged'] is True and
            cold['nativeBefore'] == cold['nativeAfter'], 'Published v50 cold diagnostic changed')
    before = cold['nativeBefore']; manifest = read(check_file(before['nativeSourceManifest']))
    require(before['digest'] == manifest['digest'] == '66529083d89d420f9d198e99c8639ee174f1d829380d0d71eb86432ad184a94f'
            and before['files'] == manifest['fileCount'] == len(manifest['files']) == 170,
            'Cold diagnostic source is not the exact published v50')
    corpus = read(check_file(cold['publicCorpus']))
    packet = next(item['packet'] for item in corpus['games'] if item['game'] == 'VALV')
    require(cold['packet'] == packet == read(OUT / 'valv-public-trace.json.gz')['packets'][0]['packet'] and
            cold['packetSha256'] == packet_hash(cold['packet']), 'Cold diagnostic initial public view changed')
    require(cold['game'] == 'VALV' and cold['gameLabelVisibleToRuntime'] is False and
            cold['initializedSessions'] == 1 and cold['dispatchedActions'] == cold['manualPrimingActions'] ==
            cold['levelJumps'] == corpus['actions'] == corpus['levelJumps'] == 0,
            'Cold diagnostic dispatched or primed a game')
    require(set(cold['packet']) == PUBLIC_FIELDS, 'The cold planning input contains nonpublic fields')
    check_file(cold['generator']); result = cold['nativeResult']; snapshot = result['snapshot']
    require(result['kind'] == 'action' and result['command'] == {'action_ref': 'ACTION6', 'data': {'x': 12, 'y': 33}} and
            snapshot['actions'] == 0 and snapshot['lastDecision'] == 'observed_frontier' and
            snapshot['proposal']['kind'] == 'experiment' and
            snapshot['implementation'] == 'logos-engine.typescript.v6.native-migration/0.20.0',
            'The actual unchanged cold caller choice is no longer retained')
    return {'receipt': proof(path), 'sourceCommit': PREVIOUS_RELEASE_COMMIT,
            'proposedCommand': result['command'], 'selectedProvider': snapshot['lastDecision'], 'dispatchedActions': 0,
            'qualification': 'Read-only planning on the exact published v50 selected observed_frontier at (12,33). No returned packet was consumed and no game command was dispatched. This baseline proves no level and does not prescribe the first action of the new source component or native caller.'}


def validate_history():
    selections = [
        'docs/migration/native-campaigns-v50', 'docs/migration/v50-typed-material-and-returned-inquiries.md',
        'tests/fixtures/v6-typed-material-original-public.json.gz', 'tests/fixtures/v6-typed-material-reference.json.gz',
        'scripts/probe-v6-typed-material-original.py', 'scripts/export-v6-typed-material-reference.py',
        'scripts/record-v50-browser-verification.py', 'scripts/validate-v50-release.py',
        'scripts/run-v50-release-checks.py', 'scripts/diagnose-v50-material-cold-path.mjs',
        'scripts/run-v50-campaign-proof.py', 'scripts/select-v50-next-candidate.py',
        'scripts/run-v50-delta-tests.py', 'scripts/compare-v50-material-public-evidence.py',
        'scripts/compare-v50-regressions.mjs', 'scripts/run-v50-regression-checks.py',
        'scripts/replay-v50-public-regression.mjs', 'scripts/probe-v50-cold-start-v49.mjs',
        'scripts/run-v50-final-campaign-proof.py',
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
        require(current == object_id.decode(), 'Historical v50 evidence changed: ' + relative)
        verified[relative] = {'gitObject': object_id.decode(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    require(all(name in verified for name in selections[1:]), 'A protected v50 proof is absent from its committed tree')
    old_docs = {name for name in verified if name.startswith('docs/migration/native-campaigns-v50/')}
    require(old_docs == file_inventory(['docs/migration/native-campaigns-v50']) and len(old_docs) > 50,
            'The complete previous release evidence inventory changed')
    life = read(ROOT / 'docs/migration/native-campaigns-v50/life-three-levels-final.json')
    require(life['status'] == 'passed' and (life['final']['actions'], life['final']['prefixes'], life['final']['levelsCompleted'],
            life['final']['state']) == (49, 47, 3, 'NOT_FINISHED'), 'Previous LIFE three-level result was reclassified')
    return {'commit': PREVIOUS_RELEASE_COMMIT, 'filesVerified': len(verified), 'unchanged': True, 'files': verified,
            'scope': 'Every committed byte of the complete v50 campaign evidence directory and the listed reference fixtures, probes, exporters, comparison tools and release scripts matches its published Git object. Failed first-attempt evidence and final LIFE evidence remain intact. No historical proof is regenerated or reclassified.'}


def retained_input_inventory():
    """Protect comparison inputs without executing any producer of those inputs."""
    folders = ['src', 'tests', 'scripts', 'docs/migration/native-campaigns-v51',
               'docs/migration/native-campaigns-v50', f'reference/v6/{REFERENCE_COMMIT}/source']
    return {name: sha(ROOT / name) for name in sorted(file_inventory(folders))
            if name != 'docs/migration/native-campaigns-v51/validation.json'}


def validate_campaign(source):
    path, trace_path, execution_path = [OUT / name for name in
        ['valv-three-levels.json', 'valv-public-trace.json.gz', 'logs/execution-valv.json']]
    campaign, execution = read(path), read(execution_path)
    require(campaign['schema'] == 'logos-engine.v6.integrated-game-campaign.v1' and
            campaign['game'] == 'VALV' and campaign['targetLevels'] == 3 and campaign['referenceCommit'] == REFERENCE_COMMIT and
            campaign['baseline'] is None and campaign['failure'] is None, 'Wrong actual campaign identity')
    validate_report(campaign, source)
    require(execution['schema'] == 'logos-engine.v51.actual-campaign-execution.v1', 'Campaign execution schema changed')
    validate_execution(execution, source)
    require(execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', 'VALV', '3', str(path), str(trace_path)] and
            execution['generator']['path'] == 'scripts/run-v51-campaign-proof.py', 'Unexpected actual campaign invocation')
    require(execution['report'] == proof(path) and execution['trace'] == proof(trace_path), 'Actual execution inputs were relinked')
    logged = json.loads(gzip.decompress(check_file(execution['output']).read_bytes()).decode().splitlines()[-1])
    require(logged['status'] == 'passed' and logged['sourceDigest'] == SOURCE_DIGEST and logged['final'] == campaign['final'] and
            logged['boundaries'] == campaign['boundaries'], 'Actual campaign log disagrees with the report')
    final = campaign['final']
    require((final['actions'], final['prefixes'], final['levelsCompleted'], final['level'], final['state'], final['status'], final['reason']) ==
            (28, 28, 3, 4, 'NOT_FINISHED', 'stopped', 'target_levels_completed'), 'The three-level result changed or was labeled a full WIN')
    require(final['operationCounts'] == {'init': 1, 'advance': 28, 'resume': 27} and final['caller']['enabled'] is True and
            final['caller']['boundaryReplays'] == 2 and final['caller']['goalEvents'] == 3, 'Continuous common acquisition changed')
    for key, expected in [('totalActions', [10, 20, 28]), ('levelActions', [10, 10, 8]), ('completedLevel', [1, 2, 3]),
                          ('nativeLevel', [2, 3, 4]), ('levelsCompleted', [1, 2, 3]), ('prefixCount', [10, 20, 28])]:
        require([boundary[key] for boundary in campaign['boundaries']] == expected, 'Official boundary changed: ' + key)
    packets = read(trace_path)['packets']; packet_summary = validate_trace(campaign, trace_path)
    require(packet_summary == {'completePublicPackets': 29, 'animationFramesIncludingInitial': 238}, 'Complete actual public packets changed')
    for index, item in enumerate(packets):
        packet = item['packet']
        require(set(packet) == PUBLIC_FIELDS and packet['step_index'] == index and
                packet['frame_hash'] == packet_hash(packet['frame_rows'])[:16], 'Public packet fields, index or raster identity changed')
        if index:
            before = packets[index - 1]['packet']; action = campaign['actions'][index - 1]
            require((action['levelBefore'], action['completedBefore']) == (before['level'], before['levels_completed']),
                    'A native action has the wrong public predecessor')
    require([index for index in range(1, len(packets)) if packets[index]['packet']['levels_completed'] >
             packets[index - 1]['packet']['levels_completed']] == [10, 20, 28], 'Boundary claims disagree with actual public returns')
    kinds, events = Counter(), []
    for index, prefix in enumerate(campaign['prefixes']):
        require(prefix['acquiredActions'] == 1 and prefix['family'] == 'public_occurrence_recall' and
                prefix['fieldSubquestion'] == 'field_service_composition' and prefix['selectionGroup'] == 'window_constraints' and
                prefix['callerAcquiredTransitions'] == index + 1, 'Actual common selection or acquisition changed')
        require('nativeCoordination' not in prefix, 'The source-order result acquired an undeclared native priority rule')
        own = prefix['fieldService']; proposal = own['proposal']; plan = proposal['nested_control_plan']
        require(own['stateNode'] == 'family_state:public_occurrence_recall' and own['negativeZeroPaths'] == [],
                'Own proposal state or numerical scope changed')
        require(proposal['field_subquestion'] == 'field_service_composition' and
                proposal['kind'] == prefix['proposalKind'] and proposal['strategy_receipt']['selected'] == 'window_constraints' and
                'native_coordination' not in proposal['strategy_receipt'], 'Service source receipt changed')
        before, after = packets[index]['packet'], packets[index + 1]['packet']; command = packets[index + 1]['command']
        require(proposal['actions'] == [command] and plan['action'] == command and len(proposal['steps']) == 1 and
                plan['expected_effect'] == 'unknown', 'An unknown service response was replaced by a predetermined route')
        require(plan['epoch'] == before['level'] and plan['score'] == before['levels_completed'] and
                plan['frame_digest'] == packet_hash(before['frame_rows']), 'Service plan is not bound to its current predecessor')
        require(plan['observation_ref'].endswith(':epoch:' + str(before['level']) + ':revision:' + str(index + 1) +
                ':frame:' + before['frame_hash']), 'Service plan observation reference is stale')
        point = [command['data']['x'], command['data']['y']]; step = proposal['steps'][0]
        require(command['action_ref'] == 'ACTION6' and plan['selected']['point'] == point and step['expected_after'] is None and
                step['point_support'] == step['point_binding'] and step['point_binding']['point'] == point and
                step['point_binding']['palette_value'] == before['frame_rows'][point[1]][point[0]], 'Current point support is missing or altered')
        shared = prefix['sharedSeries']; acquired = shared['fieldServiceAcquiredEvents']
        require(shared['fieldServiceAcquiredNegativeZeroPaths'] == [] and acquired and
                all(event['kind'] in OWN_KINDS for event in acquired), 'Own acquisitions or numeric sidecars changed')
        expected_kinds = ['nested_control_response', 'field_service_transfer'] if proposal.get('field_transfer_plan') else (
            ['nested_control_response', 'field_service_context', 'field_service_transfer'] if proposal.get('field_service_plan') else
            ['nested_control_response', 'envelope_fill_context'] + (['field_service_context'] if index == 3 else []))
        require([event['kind'] for event in acquired] == expected_kinds, 'The source record layer order or cutoff changed')
        nested = acquired[0]; changes = [(x, y) for y, row in enumerate(before['frame_rows'])
            for x, value in enumerate(row) if value != after['frame_rows'][y][x]]
        l, t, r, b = plan['selected']['bbox']; inside = sum(l <= x <= r and t <= y <= b for x, y in changes)
        changed_box = [min(x for x, y in changes), min(y for x, y in changes), max(x for x, y in changes), max(y for x, y in changes)] if changes else None
        require(nested['command'] == command and nested['selected'] == plan['selected'] and
                nested['changed_pixels'] == len(changes) and nested['changed_inside_control'] == inside and
                nested['changed_outside_control'] == len(changes) - inside and nested['changed_bbox'] == changed_box and
                nested['official_progress'] == (after['levels_completed'] > before['levels_completed']) and
                nested['same_epoch'] == (after['level'] == before['level']), 'Nested response differs from actual visible changes')
        events.extend(acquired); kinds[proposal['kind']] += 1
        require(shared['fieldServiceEventCount'] == len(events) and shared['fieldServiceLatestEvent'] == events[-1],
                'Own event totals differ from the acquired journal')
    require(kinds == {'nested_control_experiment': 1, 'envelope_fill_experiment': 3, 'field_service_experiment': 6,
                      'field_service_transfer_experiment': 18}, 'Actual proposal-kind distribution changed')
    event_kinds = Counter(event['kind'] for event in events)
    require(len(events) == 63 and event_kinds == {'nested_control_response': 28, 'envelope_fill_context': 4,
            'field_service_context': 7, 'field_service_transfer': 24}, 'Own acquired event distribution changed')
    return {'report': proof(path), 'trace': proof(trace_path), 'actualExecution': proof(execution_path),
            'actions': 28, 'prefixes': 28, 'levelsCompleted': 3, 'enteredLevel': 4, 'officialState': 'NOT_FINISHED',
            'perLevelActions': [10, 10, 8], 'sessions': 1, 'commonCallerAcquiredTransitions': 28, 'boundaryReplays': 2,
            'providerKinds': dict(kinds), 'serviceOwnEvents': 63, 'serviceEventKinds': dict(event_kinds),
            'additionalPriorityRules': 0, 'signedZeroPathsRestored': 0, **packet_summary,
            'qualification': 'One actual cold native common-caller session reaches three official levels in 28 commands. All 28 ordinary WHY/ACT prefixes acquire 63 own events in the source record order, with no added selection rule. Each unknown effect seals its prefix. The terminal public state is entry to level four, not a full-game WIN.'}


def check_safe_identity_value(value):
    if value is None or type(value) in [str, bool]: return
    if type(value) is int:
        require(abs(value) <= 9007199254740991, 'Unsafe integer in own identity recipe')
        return
    if isinstance(value, list):
        for item in value: check_safe_identity_value(item)
        return
    if isinstance(value, dict):
        require(all(type(key) is str for key in value), 'Nonstring own identity key')
        for item in value.values(): check_safe_identity_value(item)
        return
    raise ValueError('Own trace identity contains an unqualified numeric or object type')


def validate_comparator():
    path = OUT / 'valv-original-component-comparison.json'; compared = read(path)
    require(compared['schema'] == 'logos-engine.v51.service-public-component-comparison.v1' and compared['status'] == 'passed' and
            compared['comparisonConclusion'] == 'complete_own_provider_fields_and_actual_acquisitions_match_exactly_on_checked_integer_identity_domain' and
            compared['recordedPublicTrajectoriesEquivalent'] is True and compared['rawPythonNativeIdentityParity'] is True and
            all(compared[key] is False for key in ['originalFullCommonCallerParity', 'generalPythonFloatIdentityParity',
                'nativeFullGraphDigestParity', 'universalDecisionParity']), 'Bounded component agreement was expanded into general caller or numeric parity')
    require(compared['rawIdentityParityScope'] == 'Only the checked own source identity recipes on this trace; no general Python float or ancestor identity claim.',
            'Own identity agreement lost its explicit domain restriction')
    require(set(compared['inputs']) == {'sourceComponentCampaign', 'sourceContracts', 'campaign', 'trace', 'execution', 'source'},
            'Independent comparison input inventory changed')
    for item in compared['inputs'].values(): check_file(item)
    generator = check_file(compared['generator'])
    require(generator == ROOT / 'scripts/compare-v51-service-public-evidence.py', 'Independent comparison generator changed')
    source = compared['sourceVerification']; native = compared['nativeVerification']
    require(source['commit'] == REFERENCE_COMMIT and source['allPinnedFilesVerifiedBefore'] == source['allPinnedFilesVerifiedAfter'] == 1786 and
            source['sourceUnchanged'] is True and len(source['sourceHashes']) == 755, 'Original source identity or immutability changed')
    manifest = read(REFERENCE / 'manifest.json')
    require(manifest['commit'] == REFERENCE_COMMIT and len(manifest['files']) == 1786, 'Pinned original inventory changed')
    for name, item in manifest['files'].items():
        check_file({'path': (REFERENCE / 'source' / name).relative_to(ROOT).as_posix(), 'sha256': item['sha256']})
    for name, digest in source['sourceHashes'].items():
        require(manifest['files'][name]['sha256'] == digest, 'An imported source module differs from its pinned bytes')
    require(native == {'nativeSourceFiles': NATIVE_FILES, 'sourceDigest': SOURCE_DIGEST, 'sourceUnchangedDuringRun': True,
                       'executionExitCode': 0, 'reportTraceLogsAndInventoryVerified': True, 'pythonAgentModules': []},
            'Independent comparison does not use the frozen native campaign')
    original = read(check_file(compared['inputs']['sourceComponentCampaign']))
    reference = read(check_file(compared['inputs']['sourceContracts']))
    for fixture in [original, reference]:
        require(fixture['sourceCommit'] == REFERENCE_COMMIT and fixture['pinnedSourceFilesVerifiedBeforeImport'] == 1786,
                'Reference fixture does not identify the unchanged original source')
        check_file({'path': fixture['generator'], 'sha256': fixture['generatorSha256']})
        for name, digest in fixture['sourceHashes'].items():
            require(manifest['files'][name]['sha256'] == digest, 'Reference imported a modified original source module')
    require(original['status'] == 'passed' and original['sourceModified'] is False and original['fullOriginalCaller'] is False and
            original['actions'] == len(original['prefixes']) == 28 and len(original['packets']) == 29 and original['levelsCompleted'] == 3 and
            original['state'] == 'NOT_FINISHED' and original['sessionCount'] == 1 and
            original['manualPrimingActions'] == original['resets'] == original['levelJumps'] == 0 and
            original['frontierEnabled'] is False and original['providerOrder'] == ['service_propose'],
            'Original component proof changed or was represented as the full caller')
    require(reference['schema'] == 'logos-engine.v6.field-service-reference.v1' and reference['sourceAliasing'] == [] and
            reference['qualification']['sourceModified'] is False and reference['qualification']['gameHostRunByExporter'] is False and
            reference['pinnedSourceFilesVerifiedAfterRun'] == 1786 and reference['originalPublicProbe'] ==
            {key: compared['inputs']['sourceComponentCampaign'][key] for key in ['path', 'sha256']}, 'Reference contract provenance changed')
    require({key: len(reference[key]) for key in ['cases', 'controlledCases', 'guards', 'initialMeasurements', 'packetMeasurements',
            'commonEnvelopes', 'identityRecipes']} == {'cases': 57, 'controlledCases': 46, 'guards': 104,
                'initialMeasurements': 100, 'packetMeasurements': 29, 'commonEnvelopes': 28, 'identityRecipes': 430}, 'Reference contract inventory changed')
    identity_path = check_file(compared['identityEvidence']); identities = read(identity_path)
    require(identities['schema'] == 'logos-engine.v51.service-derived-identities.v1' and identities['sourceCommit'] == REFERENCE_COMMIT and
            identities['sourceInputHashesVerified'] is identities['nativeInputHashesIndependentlyRecomputed'] is identities['allCheckedOwnIdentityBytesEqual'] is True and
            identities['identifierSubstitution'] is False and identities['recipeCount'] == len(identities['recipes']) == 240 and
            identities['qualification'] == reference['qualification'], 'Actual trace identity proof lost its declared bounds')
    require(len({recipe['sourceHash'] for recipe in identities['recipes']}) == 240, 'Actual trace recipes contain duplicate identities')
    for recipe in identities['recipes']:
        check_safe_identity_value(recipe['value'])
        canonical = json.dumps(recipe['value'], sort_keys=True, separators=(',', ':'))
        require(recipe['sourceCanonical'] == recipe['nativeCanonical'] == canonical and
                hashlib.sha256(canonical.encode()).hexdigest() == recipe['sourceHash'] == recipe['nativeHash'],
                'A retained own identity is not bound to its checked canonical input')
    expected = {'nativeActions': 28, 'sourceSubsetActions': 28, 'levelsCompleted': 3, 'officialState': 'NOT_FINISHED', 'enteredLevel': 4,
                'nativePrefixes': 28, 'sourceSubsetPrefixes': 28, 'nativeCompletePublicPackets': 29, 'nativePublicFramesIncludingInitial': 238,
                'exactCommonInitialCommands': 28, 'exactCommonInitialPackets': 29, 'sourceProviderProposalsCompared': 28,
                'ownAcquiredEventsCompared': 63, 'ownEventKinds': {'nested_control_response': 28, 'envelope_fill_context': 4,
                    'field_service_context': 7, 'field_service_transfer': 24}, 'foreignPrefixes': 0, 'foreignActions': 0,
                'stateReconstructions': 28, 'ownDigestLayersPerState': 4, 'identityRecipes': 240, 'explicitNegativeZeroPathsRestored': 0,
                'nativePerLevelActions': [10, 10, 8], 'sourcePerLevelActions': [10, 10, 8]}
    require(compared['summary'] == expected, 'Independent original comparison counts changed')
    trace = read(OUT / 'valv-public-trace.json.gz'); campaign = read(OUT / 'valv-three-levels.json')
    require(len(original['packets']) == len(trace['packets']) == 29, 'Original/native public trajectories are incomplete')
    for old, new in zip(original['packets'], trace['packets']):
        require(old['packet'] == new['packet'] and old['command'] == new['command'], 'A complete original/native command or public return differs')
    public = compared['publicEvidence']
    require(public['fields'] == sorted(PUBLIC_FIELDS) and len(public['packets']) == 29 and public['firstTrajectoryDivergence'] is None,
            'Public equality claim changed or ignores a recorded divergence')
    for index, row in enumerate(public['packets']):
        packet = trace['packets'][index]['packet']
        require(row == {'index': index, 'publicPacketSha256': packet_hash(packet),
                        'canonicalPublicPacketSha256': canonical_hash(packet), 'frames': len(packet['frame_packet'])},
                'Comparator packet receipt differs from the complete actual return')
    replay = compared['componentReplay']
    require(replay['absoluteNumericTolerance'] == 0 and len(replay['proposals']) == len(replay['transitions']) ==
            len(replay['nativeCallerAnnotationsOutsideProvider']) == 28 and replay['foreignProviders'] == [] and
            replay['quantityScope'] == reference['qualification']['quantities'], 'Comparison omitted current proposals, returns or explicit unknown quantities')
    projection = {'nested_events': [], 'fill_events': [], 'fill_context': None, 'service_events': [], 'service_context': None,
                  'transfer_events': [], 'transfer_model': None, 'transfer_context': None}
    stop = None; own_count = 0
    for index, (prefix, offer, transition, annotation) in enumerate(zip(campaign['prefixes'], replay['proposals'], replay['transitions'],
                                                                     replay['nativeCallerAnnotationsOutsideProvider'])):
        require(offer['prefixIndex'] == transition['prefixIndex'] == annotation['prefixIndex'] == index and
                offer['firstAction'] == transition['actionIndex'] == index + 1 and offer['allProviderFieldsCompared'] is
                offer['exactNumericAndIdentityMatch'] is transition['eventsAndReconstructedOwnStateMatch'] is True,
                'Independent comparison skipped a selected offer or acquisition')
        require(annotation['fields'] == ['composition_target_tree', 'field_subquestion', 'morphology', 'strategy_receipt'],
                'An undeclared wrapper field escaped the own-provider comparison')
        proposal = prefix['fieldService']['proposal']; provider = {key: value for key, value in proposal.items() if key not in annotation['fields']}
        require(offer['sourceProposalSha256'] == offer['nativeCanonicalSha256'] == canonical_hash(provider) and
                annotation['sha256'] == canonical_hash({key: proposal[key] for key in annotation['fields']}),
                'Provider or excluded-wrapper hashes differ from the native envelope')
        acquired = prefix['sharedSeries']['fieldServiceAcquiredEvents']
        require(transition['ownEvents'] == len(acquired) and transition['eventsCanonicalSha256'] == canonical_hash(acquired) and
                transition['sourceBeforeGuard']['admitted'] is True and transition['sourceAfterOutcome']['matched'] is None and
                transition['sourceAfterOutcome']['seal_prefix'] is True, 'Actual acquired events or source guards changed')
        for original_event in acquired:
            event = copy.deepcopy(original_event); kind = event['kind']
            if kind == 'nested_control_response':
                projection['nested_events'].append(event)
                if event.get('disposition') != 'local_no_visible_effect': stop = 'nested_control_effect_requires_composition'
            else:
                layer = {'envelope_fill_context': 'fill', 'field_service_context': 'service', 'field_service_transfer': 'transfer'}[kind]
                projection[layer + '_events'].append(event); projection[layer + '_context'] = event['context']; stop = event['stop_reason']
                if layer == 'transfer': projection['transfer_model'] = event['model']
        own_count += len(acquired)
        require(transition['stateCanonicalSha256'] == canonical_hash(projection) and transition['requestedStopReason'] == stop,
                'Reconstructed own state differs from the actual native journal')
        nested = canonical_hash([transition['sourceParentDigest'], projection['nested_events']])
        fill = canonical_hash([nested, projection['fill_events'], projection['fill_context']])
        service = canonical_hash([fill, projection['service_events'], projection['service_context']])
        transfer = canonical_hash([service, projection['transfer_events'], projection['transfer_model'], projection['transfer_context']])
        require(transition['ownDigestsFromNativeAcquisitions'] == {'nested': nested, 'fill': fill, 'service': service, 'transfer': transfer},
                'The four own digest layers differ from their explicitly supplied source ancestor')
    require(own_count == 63, 'A native own event was omitted from independent reconstruction')
    command = [sys.executable, '-B', str(generator), '--verify']
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=60)
    require(result.returncode == 0, 'Read-only source-provider recomputation failed: ' + result.stderr[-4000:])
    require(json.loads(result.stdout.splitlines()[-1]) == {'status': 'passed', 'mode': 'verify',
            'output': path.relative_to(ROOT).as_posix(), 'summary': expected}, 'Read-only comparator output differs from retained assertions')
    return {'receipt': proof(path), 'identityEvidence': proof(identity_path),
            'verificationCommand': ['python', '-B', generator.relative_to(ROOT).as_posix(), '--verify'], 'summary': expected,
            'wholePublicTrajectoriesEquivalent': True, 'rawOwnIdentityEqualityOnCheckedDomain': True,
            'generalPythonFloatIdentityParity': False, 'nativeFullGraphDigestParity': False,
            'universalDecisionParity': False, 'originalFullCommonCallerParity': False,
            'qualification': 'All 28 complete selected own-provider envelopes, 63 acquired own events and 28 reconstructed own states agree exactly. Four own digest layers are rederived using the original ancestor digest. The 240 actual trace identity recipes have equal canonical bytes in the independently checked safe-integer domain. All 28 commands and 29 complete public packets agree. These bounded observations do not establish full original caller, full graph, general float or universal decision parity.'}



def validate_browser(source):
    path = OUT / 'valv-browser-verification.json'; browser = read(path)
    require(browser['schema'] == 'logos-engine.v51.browser-verification.v1' and browser['status'] == 'passed' and
            browser['game'] == 'VALV' and browser['nativeSourceManifestDigest'] == source['digest'], 'Browser proof source mismatch')
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
        require(set(item) == {'phase', 'actions', 'inspectionOpen', 'levels', 'prefixes', 'rects', 'status', 'viewport'},
                'The actual raw rectangle/counter sample schema changed')
    require([(item['phase'], item['status']) for item in measurements] == [
        ('ready', 'Ready to run from level 1.'),
        ('running-1', 'Preparing the agent…'),
        ('completed-1', 'Level completed.'),
        ('running-2', 'Reading the board and planning…'),
        ('completed-2', 'Level completed.'),
        ('running-3', 'Reading the board and planning…'),
        ('completed-3', 'Level completed.'),
    ], 'The actual sampled idle, active and completed states changed')
    counters = [(item['actions'], item['levels'], item['prefixes']) for item in measurements]
    require(counters == [(0, 0, 0), (0, 0, 0), (10, 1, 10), (10, 1, 10), (20, 2, 20), (20, 2, 20), (28, 3, 28)],
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
    require(result['completedLevels'] == 3 and result['actions'] == 28 and result['prefixes'] == 28 and
            result['entryLevel'] == 4 and result['normalStatus'] == 'Level completed.' and
            query == {'game': ['VALV'], 'level': ['4']}, 'Observed browser result is not VALV three levels in 28 actions')
    campaign = browser['browserCampaign']
    require(campaign['sessions'] == 1 and campaign['manualGameActions'] == campaign['resets'] == campaign['levelJumps'] == 0 and
            campaign['runToNextLevelClicks'] == 3, 'Browser campaign includes manual intervention or another session')
    require(campaign['uiActions'] == ['select VALV from game selector', 'select SRA Agent tab'] + ['Run to next level'] * 3,
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
    for text in [result['url'], 'game=VALV&level=4', 'Solve with SRA.', 'Level completed.',
                 'button (collapsed) Inspect reasoning']:
        require(text in accessibility, f'Final accessibility capture lacks observed content: {text}')
    for value, label in [(28, 'actions'), (3, 'levels solved'), (28, 'completed plans')]:
        require(re.search(r'\btext ' + str(value) + r'\s*\n\s*\d+ text ' + re.escape(label) + r'\s*(?:\n|$)', accessibility),
                'Final AX capture does not bind the observed counter to its label: ' + label)
    return {'receipt': proof(path), 'measurements': len(measurements), 'viewport': viewport,
            'boardColumnHeight': 442, 'canvasSize': 384, 'statusHeight': 98,
            'maximumDocumentPositionDeltaPx': max_position_delta, 'maximumDimensionDeltaPx': max_dimension_delta,
            'completedLevels': 3, 'actions': 28, 'prefixes': 28, 'sampledCounters': [list(row) for row in counters], 'inspectionClosedThroughout': True,
            'captureProperties': properties, 'fullscreen': browser['fullscreen']['status'], 'mobile': 'not_measured',
            'qualification': 'Five normal desktop rectangles are identical across seven retained idle, active and completed samples. This is not a per-frame measurement. Every raw sample retains its displayed action, level and plan counters; the final accessibility tree independently binds 28 actions, 3 solved levels and 28 completed plans to their labels and retains the level-4 URL. The unchanged JPEG capture is retained separately. No additional fullscreen-mode or mobile-size verification is claimed.'}


def validate_candidate_screening():
    """Validate retained read-only screening; do not execute its generators."""
    manifest = read(REFERENCE / 'manifest.json')['files']; results = []
    for name, entry in [('candidate-selection.json', 'framed_window_composition'),
                        ('framed-transfer-candidate-selection.json', 'observed_framed_transfer')]:
        path = OUT / name; selection = read(path)
        require(selection['schema'] == 'logos-engine.v51.readonly-candidate-selection.v1' and
                selection['sourceCommit'] == REFERENCE_COMMIT and selection['sourceFilesVerifiedBeforeAndAfter'] == 1786,
                'Candidate screening source is not pinned')
        check_file(selection['generator']); check_file(selection['entryAudit'])
        corpus = read(check_file(selection['corpus']))
        require(selection['corpus']['views'] == len(corpus['games']) == len(selection['results']) == 100 and
                selection['corpus']['actions'] == selection['corpus']['levelJumps'] == corpus['actions'] == corpus['levelJumps'] == 0,
                'Candidate screening contains a game action or altered public corpus')
        for module, digest in selection['sourceHashes'].items():
            require(manifest[module]['sha256'] == digest, 'Candidate screening source module changed')
        require(selection['entryAudit']['implementation'] == IMPLEMENTATION and selection['entryAudit']['entry'] ==
                {'question': entry, 'family': None, 'status': 'pending'}, 'A screened entry was counted as connected')
        require(selection['executionScope'] == {'gameHostsLoaded': 0, 'gameExecutions': 0, 'agentProposals': 0,
                'acquisitionCalls': 0, 'dispatchedActions': 0, 'privateStatesRead': 0}, 'Read-only screening was expanded into execution')
        selected = selection['selection']
        require(selected['entry'] == entry and selected['evaluationGame'] is None and
                selected['status'] == 'candidate_only_no_executed_action_or_level_completion', 'Screening candidate was represented as a solved game')
        for row, public in zip(selection['results'], corpus['games']):
            require(row['game'] == public['game'] and row['observation_ref'] == public['observation']['observation_ref'] and
                    row['frameDigest'] == packet_hash(public['packet']['frame_rows']), 'Candidate screening detached a result from its initial public view')
        if entry == 'framed_window_composition':
            require(selected['candidateGames'] == [] and all(row['scene'] is None for row in selection['results']),
                    'The absence of an exact-window cold candidate changed')
            counts = {}
        else:
            counts = {row['game']: len(row['eligible']) for row in selection['results'] if row['eligible']}
            require(counts == {'HANO': 2, 'GARE': 3, 'LKEY': 2} and selected['candidateGames'] == list(counts),
                    'Eligible framed-transfer candidates changed')
            for row in selection['results']:
                offered = {offer['candidate_ref']: offer for offer in row['offers']}
                for eligible in row['eligible']:
                    require(eligible['candidateRef'] in offered and eligible['projections'], 'A candidate was admitted without a measured offer')
                    facts = offered[eligible['candidateRef']]['facts']
                    require(facts['candidate_execution_count'] == 0 and facts['point_span_locus_binding_count'] == 0 and
                            facts['framed_reception_analogy'] is False, 'Cold geometry was promoted into an acquired transfer law')
        results.append({'receipt': proof(path), 'entry': entry, 'publicViews': 100, 'eligibleOffersByGame': counts,
                        'dispatchedActions': 0, 'completedLevels': 0})
    return {'screenings': results, 'nextEntry': 'observed_framed_transfer',
            'qualification': 'Both screenings inspect the same 100 retained public initial views with no game host, dispatch or acquisition. Exact-window measurement returns no candidate. Framed transfer has two eligible offers on HANO, three on GARE and two on LKEY. None proves an effect or level; an evaluation preference does not change generic eligibility.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true', help='Recompute without changing retained validation.json')
    args = parser.parse_args()
    required = ['source-manifest.json', 'valv-three-levels.json', 'valv-public-trace.json.gz', 'logs/execution-valv.json',
                'valv-original-component-comparison.json', 'valv-service-identity-recipes.json.gz', 'cold-start-v50.json',
                'validation/delta-tests-run.json', 'validation/checks-run.json', 'regression-plan.json',
                'regression-verification.json', 'regression-summary.json', 'valv-browser-verification.json',
                'candidate-selection.json', 'framed-transfer-candidate-selection.json']
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
    candidates = validate_candidate_screening()
    require(validate_source() == source, 'Native source changed during read-only validation')
    require(retained_input_inventory() == before, 'A retained proof, source, test or tool changed during validation')
    report = {'schema': 'logos-engine.v51.release-validation.v1', 'status': 'passed', 'sourceDigest': SOURCE_DIGEST,
              'nativeSourceFiles': NATIVE_FILES, 'nativeSourceManifest': proof(OUT / 'source-manifest.json'),
              'newActualCampaign': campaign, 'coldStartDiagnostic': cold, 'componentComparison': comparisons,
              'deltaTests': tests, 'regressions': regressions, 'checks': checks, 'browser': browser,
              'progress': progress, 'historicalV50Evidence': history, 'nextCandidateScreening': candidates,
              'completeMigration': False, 'originalFullCommonCallerParity': False,
              'retainedInputsUnchangedDuringValidation': True, 'generator': proof(Path(__file__).resolve()),
              'scope': 'Read-only validation of retained actual execution, frozen native inputs, one recomputed original-provider comparison with explicit safe-integer identity bounds, one affected test run, seven recorded-public regressions, build inputs, historical proof bytes, observed browser layout and candidate-only public screenings. No game, native agent, test suite or candidate producer is executed. VALV reaches three official levels and enters level four without full-game WIN. Exact equality of this component and native public trajectory is not complete original caller parity.'}
    output = OUT / 'validation.json'
    if args.verify:
        require(output.is_file() and read(output) == report, 'Retained release validation differs from recomputation')
    else:
        require(not output.exists(), 'validation.json already exists; use --verify without overwriting')
        output.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create', 'newGame': 'VALV',
                      'levelsCompleted': 3, 'enteredLevel': 4, 'officialState': 'NOT_FINISHED', 'actions': 28,
                      'deltaTests': tests['counts'], 'recordedPublicRegressions': 7, 'entryProgressPercent': 55.3}), flush=True)


if __name__ == '__main__':
    main()
