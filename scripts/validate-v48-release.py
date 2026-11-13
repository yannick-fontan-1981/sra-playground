#!/usr/bin/env python3
"""Validate retained v48 proofs without executing a game, agent or test suite.

Only the two independent component comparators run, in read-only --verify mode.
The sole output is validation.json; --verify leaves all evidence unchanged.
COLM reaches its declared three-level target. ZIPP has an official six-level WIN.
Neither result asserts full original caller parity or complete native migration.
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

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v48'
SOURCE_DIGEST = '30f078d458bf7771e203f3af194ff0bd89fb8fa233d3d0c14cee32282551ea24'
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.18.0'
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'
PREVIOUS_RELEASE_COMMIT = '7ecdfc708ae80305640fc907dd8ddd4048202fe9'
TEST_FILES = [
    'tests/v6-queued-field-reference.test.ts',
    'tests/v6-queued-field-kernel.test.ts',
    'tests/v6-trace-continuation.test.ts',
    'tests/v6-acquired-continuation.test.ts',
    'tests/v6-acquired-continuation-priority.test.ts',
    'tests/v6-learned-preparation-priority.test.ts',
    'tests/v6-animated-contact.test.ts',
    'tests/v6-shared-series.test.ts',
    'tests/v6-shared-series-native.test.ts',
    'tests/v6-native-runtime.test.ts',
    'tests/v6-native-family-registration.test.ts',
    'tests/v6-native-checkpoint-integration.test.ts',
    'tests/v6-cell-placement-integration.test.ts',
    'tests/v6-labeled-sequence-integration.test.ts',
    'tests/v6-product-panel-integration.test.ts',
    'tests/v6-trace-field-kernel.test.ts',
    'tests/v6-linked-packet-kernel.test.ts',
    'tests/v6-v45-kernel-integration.test.ts',
]
REGRESSIONS = [('STCK', 3, 35, 15), ('CATL', 6, 48, 48),
               ('LF52', 3, 104, 71), ('TICT', 6, 55, 55), ('SELE', 3, 44, 44)]


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
    require(source['fileCount'] == len(source['files']) == 163,
            'The frozen source must contain exactly 163 files')
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
    require(checks['schema'] == 'logos-engine.v48.actual-release-checks.v1' and
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


def validate_campaigns(source):
    outputs = {}
    cases = [
        ('COLM', 'colm-three-levels.json', 3, 45, 3, 4, 21, 'NOT_FINISHED',
         [17, 34, 45], [17, 17, 11], 125, 2, 25),
        ('ZIPP', 'zipp-six-levels.json', 6, 101, 6, 6, 40, 'WIN',
         [8, 23, 38, 53, 77, 101], [8, 15, 15, 15, 24, 24], 119, 5, 6),
    ]
    for game, filename, target, actions, levels, level, prefixes, state, boundaries, per_level, frames, replays, goal_events in cases:
        path = OUT / filename
        campaign = read(path)
        require(campaign['schema'] == 'logos-engine.v6.integrated-game-campaign.v1' and
                campaign['game'] == game and campaign['targetLevels'] == target and
                not campaign.get('recordedPublicReplay'), 'Expected an actual opaque-host campaign')
        validate_report(campaign, source)
        final = campaign['final']
        require((final['actions'], final['levelsCompleted'], final['level'], final['prefixes'],
                 final['state'], final['status'], final['reason']) ==
                (actions, levels, level, prefixes, state, 'stopped', 'target_levels_completed'),
                f'{game}: actual final result changed')
        require(campaign['failure'] is None and final['caller']['boundaryReplays'] == replays
                and final['caller']['goalEvents'] == goal_events, 'Declared target or retained caller events changed')
        require([b['totalActions'] for b in campaign['boundaries']] == boundaries and
                [b['levelActions'] for b in campaign['boundaries']] == per_level and
                [b['levelsCompleted'] for b in campaign['boundaries']] == list(range(1, levels + 1)),
                f'{game}: official boundary counts changed')
        require([a['sequence'] for a in campaign['actions'] if a['completedAfter'] > a['completedBefore']]
                == boundaries, 'Boundary report differs from actual complete returns')
        require(all(p['family'] == 'public_occurrence_recall' for p in campaign['prefixes']),
                'Campaign escaped the shared acquired owner')
        trace_path = OUT / f'{game.lower()}-public-trace.json.gz'
        trace_counts = validate_trace(campaign, trace_path)
        require(trace_counts == {'completePublicPackets': actions + 1, 'animationFramesIncludingInitial': frames},
                'Unexpected complete public trajectory size')
        execution_path = OUT / f'logs/execution-{game.lower()}.json'
        execution = read(execution_path)
        require(execution['schema'] == 'logos-engine.v48.actual-campaign-execution.v1', 'Wrong execution receipt schema')
        validate_execution(execution, source)
        require(execution['report'] == proof(path) and execution['trace'] == proof(trace_path),
                'Execution receipt does not identify the current report and trace')
        require(execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', game, str(target), str(path), str(trace_path)],
                'Actual campaign execution command changed')
        final_log = json.loads(gzip.decompress(check_file(execution['output']).read_bytes()).decode().splitlines()[-1])
        require(final_log['status'] == 'passed' and final_log['final'] == final and
                final_log['boundaries'] == campaign['boundaries'] and final_log['sourceDigest'] == SOURCE_DIGEST,
                'Execution output disagrees with the retained campaign')
        shared = campaign['prefixes'][-1]['sharedSeries']
        if game == 'COLM':
            require(all(p['fieldSubquestion'] == 'queued_field_composition' and
                        p['proposalKind'] == 'queued_field_experiment' for p in campaign['prefixes']),
                    'Unexpected COLM source entry')
            require(shared['queuedFieldModelCount'] == 39 and
                    sum(len(p['sharedSeries']['queuedFieldAcquiredModels']) for p in campaign['prefixes']) == 39,
                    'COLM must retain exactly 39 acquired queue-model events')
            require(shared['traceFieldExtensionCount'] == shared['linkedPacketEvidenceCount'] == 0,
                    'COLM acquired evidence in an unrelated layer')
            require(all(a['state'] != 'WIN' for a in campaign['actions']), 'COLM three levels must not be relabeled as full WIN')
        else:
            require(all(p['fieldSubquestion'] == 'trace_field_composition' and
                        p['proposalKind'] == 'trace_field_experiment' for p in campaign['prefixes']),
                    'Unexpected ZIPP source entry')
            require((shared['eventCount'], shared['traceFieldExtensionCount'], shared['queuedFieldModelCount'],
                     shared['linkedPacketEvidenceCount']) == (107, 101, 0, 0), 'ZIPP retained evidence counts changed')
            require([a['sequence'] for a in campaign['actions'] if a['state'] == 'WIN'] == [101],
                    'ZIPP official WIN must be the actual final public return')
            require([p['acquiredActions'] for p in campaign['prefixes'][36:]] == [1, 1, 16, 6],
                    'ZIPP sixth-level prefix acquisition changed')
            coordinated = [p for p in campaign['prefixes'] if p.get('nativeCoordination')]
            require(len(coordinated) == 1 and coordinated[0]['decisionRevision'] == 78,
                    'ZIPP must have one retained continuation coordination at the sixth-level entry')
        outputs[game] = {'report': proof(path), 'execution': proof(execution_path), 'trace': proof(trace_path),
                         'campaignStatus': 'passed', 'targetLevels': target, 'targetReached': True,
                         'levelsCompleted': levels, 'actions': actions, 'prefixes': prefixes,
                         'sessions': 1, 'stopReason': final['reason'], 'officialState': state,
                         'officialWin': state == 'WIN', 'boundaryActions': boundaries,
                         'perLevelActions': per_level, **trace_counts}
    return outputs


def validate_comparators():
    comparisons = {}
    for name, script in [
        ('colm-original-component-comparison.json', 'compare-v48-queued-public-evidence.py'),
        ('zipp-trace-continuation-comparison.json', 'compare-v48-trace-continuation.py'),
    ]:
        path = OUT / name
        comparison = read(path)
        require(comparison['status'] == 'passed' and comparison['nativeSourceDigest'] == SOURCE_DIGEST,
                'Component comparison failed or source differs')
        for item in comparison['inputs'].values(): check_file(item)
        require(check_file(comparison['generator']) == ROOT / 'scripts' / script, 'Unexpected comparator generator')
        before = sha(path)
        verified = subprocess.run([sys.executable, '-B', 'scripts/' + script, '--verify'], cwd=ROOT, capture_output=True, text=True)
        require(verified.returncode == 0, verified.stdout + verified.stderr)
        require(sha(path) == before, 'Read-only comparator changed its retained output')
        comparisons[name] = comparison
    queue = comparisons['colm-original-component-comparison.json']
    require(queue['schema'] == 'logos-engine.v48.queued-public-component-comparison.v1' and
            queue['recordedPublicTrajectoryEquivalent'] is True and queue['originalFullCommonCallerParity'] is False,
            'Queued component parity scope changed')
    expected = {'levelsCompleted': 3, 'sourceCommands': 45, 'nativeCommands': 45, 'rawExactCommands': 0,
                'normalizedPublicCommands': 45, 'exactActionReferencesAndEffectParameters': 45,
                'rawExactCompletePublicPackets': 46, 'animationFramesIncludingInitial': 125,
                'sourcePrefixes': 21, 'nativePrefixes': 21, 'officialBoundaries': 3,
                'completeComparedPlans': 21, 'completeComparedAcquiredQueueEvents': 39,
                'transitionsWithoutOwnQueueEvent': 6, 'sourceMutableAliasMutations': 0,
                'callerAcquiredTransitions': 45, 'callerBoundaryReplays': 2, 'sessionCountPerCampaign': 1,
                'comparedNumbers': 12372, 'exactIntegerValues': 12370, 'exactFractionalValues': 2}
    require(all(queue['summary'][key] == value for key, value in expected.items()), 'Queued comparison counts changed')
    require(queue['internalProjectionComparison']['absoluteNumericTolerance'] == 0 and
            queue['publicComparison']['packetNormalizations'] == [], 'Queued numeric or public comparison was relaxed')
    require(len(queue['publicComparison']['commandNormalizations']) == 45, 'Missing scalar transport normalizations')
    for row in queue['publicComparison']['commandNormalizations']:
        require(row['kind'] == 'empty_scalar_transport_payload' and set(row['source']) == {'action_ref'} and
                row['native'] == {**row['source'], 'data': {}}, 'A scalar normalization changes an effect parameter')
    require(queue['sourceVerification']['completePinnedManifestFilesVerified'] == 1786 and
            queue['sourceVerification']['sourceUnchanged'] is True and queue['nativeVerification']['fileCount'] == 163,
            'Queued source provenance changed')
    trace = comparisons['zipp-trace-continuation-comparison.json']
    require(trace['schema'] == 'logos-engine.v48.trace-continuation-comparison.v1', 'Wrong continuation comparison schema')
    expected_trace = {'baselineLevels': 5, 'rawExactBaselineCommands': 77, 'rawExactBaselinePackets': 78,
                      'scopeNormalizedBaselinePlans': 36, 'scopeNormalizedBaselineLatestKernelEvents': 36,
                      'scopeNormalizedBaselineRetainedTransitions': 77, 'levelsCompleted': 6,
                      'totalActions': 101, 'additionalOfficialLevels': 1, 'additionalActions': 24,
                      'coordinationReceipts': 1, 'traceTransitionCount': 101,
                      'campaignTargetReached': True, 'officialWin': True}
    require(all(trace['summary'][key] == value for key, value in expected_trace.items()), 'Continuation comparison counts changed')
    require(trace['baselineComparison']['publicNormalizations'] == [], 'Baseline public returns were normalized')
    continuation = trace['continuation']
    require(continuation['campaignStatus'] == 'passed' and continuation['targetReached'] is True and
            continuation['officialState'] == 'WIN' and continuation['targetLevels'] == 6,
            'Actual ZIPP WIN differs from the retained continuation')
    require('full preauthorization proposal payload is not retained' in continuation['qualification'],
            'Continuation comparison must retain its preauthorization-hash verification limit')
    require(len(continuation['coordinationChecks']) == 1 and trace['nativeVerification']['sourceUnchanged'] is True,
            'Continuation provenance or arbitration count changed')
    diagnostic = ROOT / 'tests/fixtures/v6-queued-field-reference-parent-diagnostic.json.gz'
    archive = ROOT / 'scripts/history/export-v6-queued-field-reference-parent-diagnostic.py'
    require(sha(archive) == read(diagnostic)['generatorSha256'] ==
            '86889a425dd02505ad772ce75a64a265a11f2573acfb51816b8acf0a2fa69af7',
            'The original parent-projection diagnostic and exporter must be retained exactly')
    return {'queuedField': proof(OUT / 'colm-original-component-comparison.json'),
            'traceContinuation': proof(OUT / 'zipp-trace-continuation-comparison.json'),
            'readOnlyRecomputationPassed': True, 'queuedNumericTolerance': 0,
            'originalParentProjectionDiagnostic': {'diagnostic': proof(diagnostic), 'exporter': proof(archive)},
            'qualification': 'All 21 COLM plans and 39 own acquired events are compared. ZIPP preserves the first 77 public commands and independently validates the sixth-level continuation. Its complete preauthorization proposal is not projected, so that typed provenance hash is not independently recomputed here. No full original caller parity is claimed.'}


def validate_tests(source):
    path = OUT / 'validation/delta-tests-run.json'
    tests = read(path)
    require(tests['schema'] == 'logos-engine.v48.actual-delta-tests.v1' and tests['status'] == 'passed' and
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
        while ancestry and ancestry[-1][0] >= indent: ancestry.pop()
        ancestry.append((indent, name))
        identities.append(tuple(item[1] for item in ancestry))
    require(len(identities) == len(set(identities)) == counts['tests'] == 417,
            'Missing or duplicated scoped test identities')
    require(len(re.findall(r'^\s*ok \d+ - ', output, re.M)) == 417 and
            len(re.findall(r'^ok \d+ - ', output, re.M)) == 396 and '\n1..396\n' in output,
            'Actual root and nested TAP results do not cover the 417 tests')
    require(not (OUT / 'validation/delta-tests-final.json').exists(), 'Unexpected composite test receipt in this single-run release')
    return {'receipt': proof(path), 'validationMode': 'single-frozen-delta-execution', 'counts': counts,
            'testFiles': len(TEST_FILES), 'topLevelTests': 396, 'nestedTests': 21, 'sourceAndTestInputsUnchanged': True,
            'qualification': 'One retained execution covers the 18 affected test files on unchanged source, test and fixture inputs. This is not a rerun of the entire historical suite.'}


def validate_regressions(source):
    plan_path, verification_path, summary_path = [OUT / name for name in
        ['regression-plan.json', 'regression-verification.json', 'regression-summary.json']]
    plan, verification, summary = map(read, [plan_path, verification_path, summary_path])
    require(plan['schema'] == 'logos-engine.v48.regression-plan.v1' and
            verification['schema'] == 'logos-engine.v48.regression-verification.v1' and
            summary['schema'] == 'logos-engine.v48.regression-summary.v1', 'Regression schema mismatch')
    require(summary['passed'] is True and verification['passed'] is True and
            verification['nativeSourceUnchangedBeforeAfterAllRuns'] is True and
            verification['nativeSourceBeforeAllRuns'] == verification['nativeSourceAfterAllRuns'] == source,
            'Regressions failed or native source changed')
    require(plan['nativeSourceManifest'] == proof(OUT / 'source-manifest.json') and
            plan['nativeSourceManifestDigest'] == summary['sourceDigest'] == SOURCE_DIGEST and
            plan['nativeSourceFiles'] == summary['nativeSourceFiles'] == 163, 'Regression manifest differs from freeze')
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
                attempt['checks'] == 16 and attempt['failedChecks'] == [], 'Regression comparator failed')
        checked = read(check_file(attempt['result']))
        require(checked['schema'] == 'logos-engine.v48.public-regression-comparison.v1' and checked['passed'] is True and
                len(checked['checks']) == 16 and all(row['passed'] is True for row in checked['checks']), 'A regression assertion failed')
        check_file(checked['before']); check_file(checked['after'])
        require(checked['compared'] == attempt['compared'] ==
                {'commands': commands, 'completePublicPackets': commands + 1, 'prefixes': prefixes}, 'Comparison counts changed')
        require(item['comparison'] == attempt['result'] == proof(ROOT / planned['comparison']), 'Comparison file identity mismatch')
        comparison_log = json.loads(gzip.decompress(check_file(attempt['output']).read_bytes()).decode().splitlines()[-1])
        require(comparison_log == {'passed': True, 'checks': 16, 'compared': checked['compared'], 'failed': []},
                'Recorded comparison output disagrees with retained assertions')
        for prefix, old_prefix in zip(current['prefixes'], baseline['prefixes']):
            shared, previous = prefix['sharedSeries'], old_prefix['sharedSeries']
            require(shared['traceFieldExtensionCount'] == shared['queuedFieldModelCount'] == 0 and
                    shared['traceFieldLatestExtension'] is None and shared['queuedFieldLatestModel'] is None and
                    shared['queuedFieldAcquiredModels'] == [], 'A new layer acquired these legacy trajectories')
            require(shared['linkedPacketEvidenceCount'] == previous.get('linkedPacketEvidenceCount', 0),
                    'Retained Linked Packet acquisition count changed')
    expected_groups = [
        {'mode': 'recorded-public-replay', 'runs': 5, 'passed': True, 'commands': 286,
         'completePublicPackets': 291, 'prefixes': 233, 'comparisonChecks': 80, 'games': [row[0] for row in REGRESSIONS]},
        {'mode': 'actual-game-campaign', 'runs': 0, 'passed': True, 'commands': 0,
         'completePublicPackets': 0, 'prefixes': 0, 'comparisonChecks': 0, 'games': []},
    ]
    require(summary['groups'] == expected_groups, 'Regression aggregation changed')
    return {'summary': proof(summary_path), 'groups': summary['groups'],
            'qualification': 'Five cold native replays recompute decisions before consuming retained complete public returns. They are not five additional live wins. The plan, actual receipts and 80 retained comparisons are verified without rerunning the games or replaying the agent.'}


def validate_progress():
    progress_path = ROOT / 'docs/migration/v6-entry-point-progress.json'
    progress = read(progress_path)
    require(progress['schema'] == 'logos-engine.v6.declared-entry-coverage.v1' and
            (progress['connected'], progress['declared'], progress['percent'], progress['implementation']) ==
            (39, 76, 51.3, IMPLEMENTATION), 'Declared source-entry progress changed')
    require(len(progress['groups']) == 4, 'Expected four ordered source DRM lists')
    for group in progress['groups']:
        require(group['declared'] == len(group['entries']) and
                group['connected'] == sum(entry['status'] == 'connected' for entry in group['entries']),
                'Entry group counts do not match explicit statuses')
    require(sum(group['declared'] for group in progress['groups']) == 76 and
            sum(group['connected'] for group in progress['groups']) == 39 and progress['fullV6Parity'] is False,
            'Progress denominator or parity claim changed')
    queue = [entry for group in progress['groups'] for entry in group['entries'] if entry['question'] == 'queued_field_composition']
    require(queue == [{'question': 'queued_field_composition', 'family': 'public_occurrence_recall', 'status': 'connected'}],
            'Queued Field is not registered in the shared owner')
    coverage_path = ROOT / 'docs/migration/v6-coverage.json'; coverage = read(coverage_path)
    require(coverage['complete'] is False and len(coverage['completionGates']) == 6 and
            all(value is False for value in coverage['completionGates'].values()), 'Incomplete migration must remain explicit')
    return {'connected': 39, 'declared': 76, 'percent': 51.3, 'metric': progress['metric'],
            'entryAudit': proof(progress_path), 'migrationAudit': proof(coverage_path),
            'qualification': '51.3% counts registered subquestions in the same four source DRM lists. It is not code-volume progress, game success rate, complete migration or original caller parity.'}


def validate_history():
    selections = ['docs/migration/native-campaigns-v47', 'docs/migration/v47-linked-packets-and-stable-board.md',
        'tests/fixtures/v6-linked-packet-initial-public.json.gz', 'tests/fixtures/v6-linked-packet-original-public.json.gz',
        'tests/fixtures/v6-linked-packet-reference.json.gz', 'tests/fixtures/v6-linked-packet-reference-alias-diagnostic.json.gz',
        'tests/fixtures/v6-visible-box-ray-reference.json.gz', 'scripts/probe-v6-linked-packet-original.py',
        'scripts/probe-v6-linked-packet-initial-public.py', 'scripts/export-v6-linked-packet-reference.py',
        'scripts/history/export-v6-linked-packet-reference-pre-emission.py', 'scripts/export-v6-visible-box-ray-reference.py',
        'scripts/compare-v47-linked-public-evidence.py', 'scripts/compare-v47-trace-extension.py', 'scripts/validate-v47-release.py']
    command = ['git', 'ls-tree', '-r', '-z', PREVIOUS_RELEASE_COMMIT, '--', *selections]
    tree = subprocess.run(command, cwd=ROOT, capture_output=True)
    require(tree.returncode == 0, 'Cannot read the previous committed release tree')
    verified = {}
    for row in tree.stdout.split(b'\0'):
        if not row: continue
        metadata, name = row.split(b'\t', 1); mode, kind, object_id = metadata.split(b' ')
        require(kind == b'blob', 'Historical evidence must be an ordinary Git blob')
        relative = name.decode(); data = (ROOT / relative).read_bytes()
        current_object = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        require(current_object == object_id.decode(), f'Historical v47 evidence changed: {relative}')
        verified[relative] = {'gitObject': object_id.decode(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    require(len(verified) > 40 and any(path.endswith('/zipp-six-levels.json') for path in verified) and
            any(path.endswith('/sele-three-levels.json') for path in verified), 'Historical proof inventory is incomplete')
    historical = read(ROOT / 'docs/migration/native-campaigns-v47/zipp-six-levels.json')
    require(historical['status'] == 'failed' and historical['final']['actions'] == 78 and
            historical['final']['levelsCompleted'] == 5 and historical['final']['state'] == 'NOT_FINISHED',
            'The old failed ZIPP attempt was relabeled')
    return {'commit': PREVIOUS_RELEASE_COMMIT, 'filesVerified': len(verified), 'unchanged': True,
            'files': verified, 'scope': 'Every tracked byte in the v47 campaign evidence directory and the listed source-reference fixtures, probes and exporters matches its published Git commit. No historical proof is regenerated or reclassified.'}


def validate_browser(source):
    path = OUT / 'colm-browser-verification.json'; browser = read(path)
    require(browser['schema'] == 'logos-engine.v48.browser-verification.v1' and browser['status'] == 'passed' and
            browser['game'] == 'COLM' and browser['nativeSourceManifestDigest'] == source['digest'], 'Browser proof source mismatch')
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
        require(set(item) == {'label', 'inspectionOpen', 'rects', 'status', 'viewport'},
                'Unexpected fields in a raw browser sample; counters were not recorded there')
    require([(item['label'], item['status']) for item in measurements] == [
        ('level-1-ready', 'Ready to run from level 1.'),
        ('level-1-running', 'Preparing the agent…'),
        ('level-1-observed', 'Level completed.'),
        ('level-2-running', 'Reading the board and planning…'),
        ('level-2-observed', 'Level completed.'),
        ('level-3-running', 'Reading the board and planning…'),
        ('level-3-completed', 'Level completed.'),
    ], 'The actual sampled idle, active and completed states changed')
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
    require(result['completedLevels'] == 3 and result['actions'] == 45 and result['prefixes'] == 21 and
            result['entryLevel'] == 4 and result['normalStatus'] == 'Level completed.' and
            query == {'game': ['COLM'], 'level': ['4']}, 'Observed browser result is not COLM three levels in 45 actions')
    campaign = browser['browserCampaign']
    require(campaign['sessions'] == 1 and campaign['manualGameActions'] == campaign['resets'] == campaign['levelJumps'] == 0 and
            campaign['runToNextLevelClicks'] == 3, 'Browser campaign includes manual intervention or another session')
    require(campaign['uiActions'] == raw['uiActions'] == ['select SRA Agent tab'] + ['Run to next level'] * 3 and
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
    for text in [result['url'], 'game=COLM&level=4', 'Solve with SRA.', 'Level completed.',
                 'button (collapsed) Inspect reasoning']:
        require(text in accessibility, f'Final accessibility capture lacks observed content: {text}')
    for value, label in [(45, 'actions'), (3, 'levels solved'), (21, 'completed plans')]:
        require(re.search(r'\btext ' + str(value) + r'\s*\n\s*\d+ text ' + re.escape(label) + r'\s*(?:\n|$)', accessibility),
                'Final AX capture does not bind the observed counter to its label: ' + label)
    return {'receipt': proof(path), 'measurements': len(measurements), 'viewport': viewport,
            'boardColumnHeight': 442, 'canvasSize': 384, 'statusHeight': 98,
            'maximumDocumentPositionDeltaPx': max_position_delta, 'maximumDimensionDeltaPx': max_dimension_delta,
            'completedLevels': 3, 'actions': 45, 'prefixes': 21, 'inspectionClosedThroughout': True,
            'captureProperties': properties, 'fullscreen': browser['fullscreen']['status'], 'mobile': 'not_measured',
            'qualification': 'Five normal desktop rectangles are identical across seven retained idle, active and completed samples. This is not a per-frame measurement. The raw samples contain no counters; the final accessibility tree binds 45 actions, 3 solved levels and 21 completed plans to their labels and retains the level-4 URL. The unchanged JPEG capture is retained separately. No additional fullscreen-mode or mobile-size verification is claimed.'}


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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true', help='Recompute without changing the retained validation.json')
    args = parser.parse_args()
    required = ['source-manifest.json', 'colm-three-levels.json', 'zipp-six-levels.json',
                'colm-public-trace.json.gz', 'zipp-public-trace.json.gz',
                'colm-original-component-comparison.json', 'zipp-trace-continuation-comparison.json',
                'validation/delta-tests-run.json', 'validation/checks-run.json',
                'regression-plan.json', 'regression-verification.json', 'regression-summary.json',
                'colm-browser-verification.json']
    missing = [name for name in required if not (OUT / name).is_file()]
    require(not missing, 'Missing retained release evidence: ' + ', '.join(missing))
    source = validate_source()
    campaigns = validate_campaigns(source)
    comparisons = validate_comparators()
    tests = validate_tests(source)
    regressions = validate_regressions(source)
    checks = validate_checks(source)
    progress = validate_progress()
    history = validate_history()
    browser = validate_browser(source)
    require(validate_source() == source, 'Native source changed during read-only validation')
    report = {'schema': 'logos-engine.v48.release-validation.v1', 'status': 'passed', 'sourceDigest': SOURCE_DIGEST,
              'nativeSourceFiles': 163, 'nativeSourceManifest': proof(OUT / 'source-manifest.json'),
              'newActualCampaign': campaigns['COLM'], 'completedContinuationCampaign': campaigns['ZIPP'],
              'componentComparisons': comparisons, 'deltaTests': tests, 'regressions': regressions,
              'checks': checks, 'browser': browser, 'progress': progress, 'historicalV47Evidence': history,
              'completeMigration': False, 'originalFullCommonCallerParity': False, 'generator': proof(Path(__file__).resolve()),
              'scope': 'Read-only validation of retained actual executions, frozen native inputs, two recomputed component comparisons, one affected test run, five recorded-public regressions, build inputs, historical proof bytes and observed desktop layout. No game, agent or test suite is executed. COLM reaches its declared three-level target without full-game WIN; ZIPP has a retained official WIN after six levels.'}
    output = OUT / 'validation.json'
    if args.verify:
        require(output.is_file() and read(output) == report, 'Retained release validation differs from recomputation')
    else:
        require(not output.exists(), 'validation.json already exists; use --verify to inspect it without overwriting')
        output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create', 'newGame': 'COLM',
                      'levelsCompleted': 3, 'actions': 45, 'zippOfficialState': 'WIN', 'zippLevelsCompleted': 6,
                      'deltaTests': tests['counts'], 'recordedPublicRegressions': 5, 'entryProgressPercent': 51.3}), flush=True)


if __name__ == '__main__':
    main()
