#!/usr/bin/env python3
"""Validate retained v47 release evidence; never execute a game or agent.

The two component comparators are rerun only in their read-only --verify modes.
A passed validation means that the evidence agrees, including the retained
failed six-level ZIPP attempt. It does not turn that attempt into a success.
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


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v47'
SOURCE_DIGEST = '2f8f5d8660716e44e81fa987d08264324f61838c81ba9e96b2e64f69c136d100'
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.17.0'
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'
TEST_FILES = [
    'tests/v6-linked-packet-reference.test.ts',
    'tests/v6-linked-packet-kernel.test.ts',
    'tests/v6-visible-box-ray-reference.test.ts',
    'tests/v6-trace-field-support.test.ts',
    'tests/v6-trace-field-reference.test.ts',
    'tests/v6-trace-field-kernel.test.ts',
    'tests/v6-shared-series.test.ts',
    'tests/v6-shared-series-native.test.ts',
    'tests/v6-native-runtime.test.ts',
    'tests/v6-native-family-registration.test.ts',
    'tests/v6-native-checkpoint-integration.test.ts',
    'tests/v6-cell-placement-integration.test.ts',
    'tests/v6-labeled-sequence-integration.test.ts',
    'tests/v6-product-panel-integration.test.ts',
    'tests/v6-acquired-continuation-priority.test.ts',
    'tests/v6-learned-preparation-priority.test.ts',
    'tests/v6-v45-kernel-integration.test.ts',
]
REGRESSIONS = [('STCK', 3, 35, 15), ('CATL', 6, 48, 48),
               ('LF52', 3, 104, 71), ('TICT', 6, 55, 55)]


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
    require(source['fileCount'] == len(source['files']) == 158,
            'The frozen source must contain exactly 158 files')
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


def validate_campaigns(source):
    outputs = {}
    cases = [
        ('SELE', 'sele-three-levels.json', 3, 'passed', 44, 3, 4, 44,
         'target_levels_completed', [8, 18, 44], [8, 10, 26], 229, 0),
        ('ZIPP', 'zipp-six-levels.json', 6, 'failed', 78, 5, 6, 37,
         'frontier_unknown', [8, 23, 38, 53, 77], [8, 15, 15, 15, 24], 94, 1),
    ]
    for game, filename, target, status, actions, levels, level, prefixes, reason, boundaries, per_level, frames, exit_code in cases:
        path = OUT / filename
        campaign = read(path)
        require(campaign['schema'] == 'logos-engine.v6.integrated-game-campaign.v1' and
                campaign['game'] == game and campaign['targetLevels'] == target and
                not campaign.get('recordedPublicReplay'), 'Expected an actual game campaign')
        validate_report(campaign, source, status)
        final = campaign['final']
        require((final['actions'], final['levelsCompleted'], final['level'], final['prefixes'],
                 final['state'], final['status'], final['reason']) ==
                (actions, levels, level, prefixes, 'NOT_FINISHED', 'stopped', reason),
                f'{game}: actual final result changed')
        require(all(a['state'] != 'WIN' for a in campaign['actions']),
                f'{game}: this release must not claim an official full-game win')
        require([b['totalActions'] for b in campaign['boundaries']] == boundaries and
                [b['levelActions'] for b in campaign['boundaries']] == per_level and
                [b['levelsCompleted'] for b in campaign['boundaries']] == list(range(1, levels + 1)),
                f'{game}: official level boundary counts changed')
        require([a['sequence'] for a in campaign['actions'] if a['completedAfter'] > a['completedBefore']]
                == boundaries, 'Boundary report differs from actual complete returns')
        trace_path = OUT / f'{game.lower()}-public-trace.json.gz'
        trace_counts = validate_trace(campaign, trace_path)
        require(trace_counts == {'completePublicPackets': actions + 1,
                                 'animationFramesIncludingInitial': frames}, 'Unexpected trace size')
        execution_path = OUT / f'logs/execution-{game.lower()}.json'
        execution = read(execution_path)
        require(execution['schema'] == 'logos-engine.v47.actual-campaign-execution.v1',
                'Wrong actual execution receipt schema')
        validate_execution(execution, source, exit_code)
        require(execution['report'] == proof(path) and execution['trace'] == proof(trace_path),
                'Execution receipt does not identify the current campaign and trace')
        require(execution['command'] == ['node', 'scripts/run-v44-campaign.mjs', game,
                                        str(target), str(path), str(trace_path)],
                'Actual campaign execution command mismatch')
        shared = campaign['prefixes'][-1]['sharedSeries']
        if game == 'SELE':
            require(campaign['failure'] is None and final['caller']['boundaryReplays'] == 2
                    and final['caller']['goalEvents'] == 3, 'SELE did not reach its declared target')
            require(all(p['fieldSubquestion'] == 'linked_packet_composition' and
                        p['family'] == 'public_occurrence_recall' and
                        p['proposalKind'] == 'linked_packet_experiment'
                        for p in campaign['prefixes']), 'Unexpected SELE source selection')
            require((shared['eventCount'], shared['linkedPacketEvidenceCount'],
                     shared['traceFieldExtensionCount']) == (59, 53, 0), 'SELE evidence counts changed')
        else:
            require(campaign['failure'] == 'Did not complete ZIPP level 6: V6 stopped: frontier_unknown. Its acquired evidence is retained for inspection.',
                    'The failed ZIPP target or its diagnostic was relabeled')
            require(final['caller']['boundaryReplays'] == 5 and final['caller']['goalEvents'] == 5,
                    'ZIPP retained boundary counts changed')
            last = campaign['prefixes'][-1]
            require(last['acquiredActions'] == 1 and last['family'] == 'animated_contact'
                    and last['proposalKind'] == 'measured_animated_contact'
                    and last['fieldSubquestion'] is None, 'ZIPP action 78 was not the recorded other-family attempt')
            require(campaign['actions'][-1]['levelBefore'] == 6 and
                    (shared['eventCount'], shared['traceFieldExtensionCount'],
                     shared['linkedPacketEvidenceCount']) == (83, 77, 0), 'ZIPP retained evidence counts changed')
        outputs[game] = {'report': proof(path), 'execution': proof(execution_path),
                         'trace': proof(trace_path), 'campaignStatus': status,
                         'targetLevels': target, 'targetReached': status == 'passed',
                         'levelsCompleted': levels, 'actions': actions, 'prefixes': prefixes,
                         'actionsThroughLastBoundary': boundaries[-1], 'sessions': 1,
                         'stopReason': reason, 'officialState': 'NOT_FINISHED',
                         'officialWin': False, **trace_counts}
    return outputs


def validate_comparators():
    result = {}
    for name, script in [
        ('sele-original-component-comparison.json', 'compare-v47-linked-public-evidence.py'),
        ('zipp-trace-extension-comparison.json', 'compare-v47-trace-extension.py'),
    ]:
        path = OUT / name
        comparison = read(path)
        require(comparison['status'] == 'passed' and comparison['nativeSourceDigest'] == SOURCE_DIGEST,
                f'{name}: comparison failed or source differs')
        for item in comparison['inputs'].values():
            check_file(item)
        require(check_file(comparison['generator']) == ROOT / 'scripts' / script,
                'Unexpected comparator generator')
        before = sha(path)
        verified = subprocess.run([sys.executable, 'scripts/' + script, '--verify'],
                                  cwd=ROOT, capture_output=True, text=True)
        require(verified.returncode == 0, verified.stdout + verified.stderr)
        require(sha(path) == before, 'Read-only comparator changed its retained evidence')
        result[name] = comparison

    linked = result['sele-original-component-comparison.json']
    require(linked['schema'] == 'logos-engine.v47.linked-public-component-comparison.v1'
            and linked['recordedPublicTrajectoryEquivalent'] is True and
            linked['originalFullCommonCallerParity'] is False, 'Linked parity scope changed')
    summary = linked['summary']
    expected = {'levelsCompleted': 3, 'sourceCommands': 44, 'nativeCommands': 44,
                'rawExactCommands': 15, 'normalizedPublicCommands': 29,
                'exactActionReferencesAndEffectParameters': 44,
                'rawExactCompletePublicPackets': 45, 'animationFramesIncludingInitial': 229,
                'sourcePrefixes': 44, 'nativePrefixes': 44, 'officialBoundaries': 3,
                'sourceTargetLevels': 3, 'nativeTargetLevels': 3,
                'sourceTargetReached': True, 'nativeTargetReached': True,
                'officialState': 'NOT_FINISHED', 'enteredLevel': 4,
                'completeComparedPlans': 44, 'completeComparedLatestKernelEvents': 44,
                'linkedEventsRetained': 53, 'commonEventsRetained': 59,
                'sourceMutableAliasReceipts': 9, 'callerAcquiredTransitions': 44,
                'callerBoundaryReplays': 2, 'sessionCountPerCampaign': 1}
    require(all(summary[key] == value for key, value in expected.items()),
            'Linked component comparison count mismatch')
    require(summary['comparedNumbers'] == 54910 and summary['exactIntegerValues'] == 52180
            and 0 <= summary['maximumAbsoluteError'] <= 1e-12, 'Linked numeric comparison failed')
    require(linked['internalProjectionComparison']['absoluteNumericTolerance'] == 1e-12,
            'Linked numerical tolerance was relaxed')
    public = linked['publicComparison']
    require(public['packetNormalizations'] == [] and len(public['commandNormalizations']) == 29,
            'Unexpected public trajectory normalization')
    for row in public['commandNormalizations']:
        require(row['kind'] == 'empty_scalar_transport_payload' and
                set(row['source']) == {'action_ref'} and
                row['native'] == {**row['source'], 'data': {}}, 'A command normalization changes an effect')
    require(linked['sourceVerification']['completePinnedManifestFilesVerified'] == 1786 and
            linked['sourceVerification']['sourceUnchanged'] is True and
            linked['nativeVerification']['fileCount'] == 158 and
            linked['nativeVerification']['executionExitCode'] == 0, 'Linked provenance count mismatch')

    trace = result['zipp-trace-extension-comparison.json']
    require(trace['schema'] == 'logos-engine.v47.trace-extension-comparison.v1', 'Trace comparison schema mismatch')
    expected_trace = {'levelsCompleted': 5, 'totalActions': 78, 'actionsThroughLastBoundary': 77,
                      'rawExactBaselineCommands': 53, 'rawExactBaselinePackets': 54,
                      'scopeNormalizedBaselinePlans': 12, 'scopeNormalizedBaselineLatestKernelEvents': 12,
                      'scopeNormalizedBaselineRetainedTransitions': 53, 'nativeVisualWitnessPrefixes': 1,
                      'traceTransitionCount': 77, 'otherFamilyActionsBeyondBaseline': 1,
                      'campaignTargetReached': False, 'officialWin': False}
    require(all(trace['summary'][key] == value for key, value in expected_trace.items()),
            'Trace extension comparison count mismatch')
    extension = trace['extension']
    require(extension['campaignStatus'] == 'failed' and extension['targetReached'] is False
            and extension['officialState'] == 'NOT_FINISHED' and extension['stopReason'] == 'frontier_unknown'
            and extension['targetLevels'] == 6, 'Trace comparison conceals the failed six-level target')
    require(trace['nativeVerification']['executionExitCode'] == 1 and
            trace['nativeVerification']['sourceUnchanged'] is True and
            trace['nativeVerification']['allHistoricalV46FilesUnchanged'] is True,
            'Trace extension execution or historical provenance mismatch')
    witnesses = extension['retainedVisualWitnesses']
    require(len(witnesses) == 1 and witnesses[0]['actualKernelOutcome'] == 'ordered_trace_projection_refuted'
            and witnesses[0]['headCenterMaterialBefore'] == 9 and witnesses[0]['headCenterMaterialAfter'] == 12
            and witnesses[0]['localControlEffectAcquired'] is False
            and witnesses[0]['primitiveReleaseAuthorizedByWitness'] is False,
            'Refuted visual interpretation was incorrectly promoted to acquired knowledge')
    require(extension['otherFamilyPrefixesBeyondBaseline'] == [
        {'firstAction': 78, 'acquiredActions': 1, 'family': 'animated_contact',
         'proposalKind': 'measured_animated_contact'}], 'ZIPP extra attempt was incorrectly attributed to Trace')
    diagnostic_path = ROOT / 'tests/fixtures/v6-linked-packet-reference-alias-diagnostic.json.gz'
    archived_generator_path = ROOT / 'scripts/history/export-v6-linked-packet-reference-pre-emission.py'
    diagnostic = read(diagnostic_path)
    require(sha(archived_generator_path) == diagnostic['generatorSha256'] ==
            '6523c8cbab77c318a64ebf52d6204dcf426d1140218f45d4126cdb2ea1af16ab',
            'The original alias diagnostic exporter was not retained exactly')
    return {'linkedPacket': proof(OUT / 'sele-original-component-comparison.json'),
            'traceExtension': proof(OUT / 'zipp-trace-extension-comparison.json'),
            'sourceAliasDiagnosticArchive': {'diagnostic': proof(diagnostic_path),
                                             'originalGenerator': proof(archived_generator_path)},
            'readOnlyRecomputationPassed': True, 'maximumAbsoluteNumericError': summary['maximumAbsoluteError'],
            'scope': '44 full production plans and 44 latest Kernel events are compared. The 53 source emissions and nine aliases are tested in the reference fixture; production reports do not retain every intermediate event payload. No full original common-caller parity is claimed.'}


def validate_tests(source):
    initial_path = OUT / 'validation/delta-tests-run.json'
    path = OUT / 'validation/delta-tests-final.json'
    initial, tests = map(read, [initial_path, path])
    require(initial['schema'] == 'logos-engine.v47.actual-delta-tests.v1' and
            initial['status'] == 'failed' and initial['sourceAndTestInputsUnchanged'] is False,
            'The initial test-input freeze failure must remain explicit')
    validate_execution(initial, source)
    require(tests['schema'] == 'logos-engine.v47.actual-delta-composite.v1' and
            tests['status'] == 'passed' and tests['validationMode'] == 'unchanged-tests-plus-scoped-recheck'
            and tests['nativeSourceUnchanged'] is True and
            tests['recheckSourceAndTestInputsUnchanged'] is True,
            'Final scoped recheck failed or its inputs changed')
    require(tests['nativeSource'] == tests['nativeSourceAfter'] == source and
            tests['nativeSourceManifestDigest'] == SOURCE_DIGEST and
            tests['initialExecution'] == proof(initial_path) and tests['initialFreezeGatePassed'] is False,
            'Test source or initial execution provenance mismatch')
    require(tests['testFiles'] == initial['testFiles'] == TEST_FILES and
            tests['testFileCount'] == initial['testFileCount'] == 17,
            'The declared affected test suite changed')
    command = ['node', '--test', '--test-concurrency=1', '--test-reporter=tap']
    require(initial['command'] == [*command, *TEST_FILES],
            'Unexpected delta test command')
    require(tests['unchangedTestFiles'] == TEST_FILES[1:] and
            tests['recheckedTestFiles'] == [TEST_FILES[0]], 'Recheck exceeded or omitted the changed test file')
    require(tests['sourceAndTestInputs'] == tests['sourceAndTestInputsAfter'] and
            set(tests['sourceAndTestInputs']) == set(initial['sourceAndTestInputs']) ==
            file_inventory(['src', 'tests']),
            'Source or test inventory changed after the tests')
    check_map(tests['sourceAndTestInputs'])
    check_file(tests['generator'])
    changed = sorted(name for name, digest in tests['sourceAndTestInputs'].items()
                     if digest != initial['sourceAndTestInputs'][name])
    require(changed == [TEST_FILES[0]], 'An input outside the rechecked file changed')
    require(tests['changedInputs'] == [{
        'path': TEST_FILES[0], 'initialSha256': initial['sourceAndTestInputs'][TEST_FILES[0]],
        'finalSha256': tests['sourceAndTestInputs'][TEST_FILES[0]]}], 'Changed-input receipt is incomplete')
    initial_counts, initial_tap = tap_counts(initial['output'])
    recheck = tests['recheck']
    require(recheck['command'] == [*command, TEST_FILES[0]] and recheck['exitCode'] == 0,
            'The changed reference test was not rerun successfully in isolation')
    recheck_counts, recheck_tap = tap_counts(recheck['output'])
    initial_names = re.findall(r'^# Subtest: (.+)$', initial_tap, re.M)
    recheck_names = re.findall(r'^# Subtest: (.+)$', recheck_tap, re.M)
    require(len(initial_names) == len(set(initial_names)) == 664 and
            len(recheck_names) == len(set(recheck_names)) == 55 and
            set(recheck_names) <= set(initial_names),
            'The recheck does not match the original reference test names')
    # Node orders test files independently of their command-line position.
    # Locate the original complete reference-test block instead of assuming it ran first.
    reference_start = initial_names.index(recheck_names[0])
    require(initial_names[reference_start:reference_start + 55] == recheck_names,
            'Reference test order differs between the original execution and the recheck')
    unchanged_names = [name for name in initial_names if name not in set(recheck_names)]
    require(tests['initialUnchangedTestNames'] == unchanged_names and len(unchanged_names) == 609
            and tests['recheckedTestNames'] == recheck_names, 'Composite test-name partition is incorrect')
    counts = {'tests': 664, 'pass': 664, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}
    require(initial_counts == initial['counts'] == tests['initialFunctionalCounts'] == counts and
            recheck_counts == recheck['counts'] == {**counts, 'tests': 55, 'pass': 55} and
            tests['counts'] == counts and tests['actualExecutedTestCount'] == 719,
            'Composite counts conflate distinct final checks with repeated executions')
    return {'receipt': proof(path), 'initialExecution': proof(initial_path),
            'initialExecutionStatus': 'failed', 'initialFreezeGatePassed': False,
            'validationMode': 'unchanged-tests-plus-scoped-recheck', 'counts': counts,
            'testFiles': len(TEST_FILES), 'unchangedTests': 609, 'recheckedTests': 55,
            'actualExecutedTests': 719,
            'qualification': '609 unchanged checks plus 55 checks rerun from the sole changed test file cover 664 distinct final checks. The original functional 664/664 run and its failed input-freeze gate are retained. This is not a single final frozen execution of all 664 tests.'}


def validate_regressions(source):
    plan_path = OUT / 'regression-plan.json'
    verification_path = OUT / 'regression-verification.json'
    summary_path = OUT / 'regression-summary.json'
    plan, verification, summary = map(read, [plan_path, verification_path, summary_path])
    require(plan['schema'] == 'logos-engine.v47.regression-plan.v1' and
            verification['schema'] == 'logos-engine.v47.regression-verification.v1' and
            summary['schema'] == 'logos-engine.v47.regression-summary.v1', 'Regression proof schema mismatch')
    require(summary['passed'] is True and verification['passed'] is True and
            verification['nativeSourceUnchangedBeforeAfterAllRuns'] is True and
            verification['nativeSourceBeforeAllRuns'] == verification['nativeSourceAfterAllRuns'] == source,
            'Regressions failed or source changed')
    require(plan['nativeSourceManifest'] == proof(OUT / 'source-manifest.json') and
            plan['nativeSourceManifestDigest'] == summary['sourceDigest'] == SOURCE_DIGEST and
            plan['nativeSourceFiles'] == summary['nativeSourceFiles'] == 158,
            'Regression manifest differs from freeze')
    require(summary['verification'] == proof(verification_path) and
            summary['plan'] == verification['plan'] == proof(plan_path), 'Regression receipt identity mismatch')
    check_file(verification['generator'])
    check_map(plan['harnessFileSha256'])
    require(len(plan['runs']) == len(verification['runs']) == len(summary['results']) == 4,
            'Expected exactly four recorded-public regressions')
    for expected, planned, record, item in zip(REGRESSIONS, plan['runs'], verification['runs'], summary['results']):
        game, target, commands, prefixes = expected
        require(planned['game'] == record['game'] == item['game'] == game and
                planned['targetLevels'] == record['targetLevels'] == target and
                planned['mode'] == record['mode'] == item['mode'] == 'recorded-public-replay',
                'Regression identity or replay qualification changed')
        require(record['passed'] is True and item['passed'] is True and record['modeMatchesPlan'] is True
                and record['reportSourceMatchesFreeze'] is True and record['sourceUnchangedDuringRun'] is True
                and record['pythonAgentModules'] == [], 'Regression failed its declared contract')
        require(read(ROOT / planned['executionReceipt']) == record, 'Regression receipt was not retained exactly')
        baseline = read(check_file(planned['baseline']))
        current = read(check_file(record['report']))
        require(current['schema'] == 'logos-engine.v6.recorded-public-regression.v1', 'Replay mislabeled as actual run')
        validate_report(current, source)
        require(current['game'] == game and current['targetLevels'] == target and
                current['initial'] == baseline['initial'], 'Regression public initial conditions changed')
        public_actions = lambda rows: [{k: v for k, v in row.items() if k != 'executionMs'} for row in rows]
        require(public_actions(current['actions']) == public_actions(baseline['actions']),
                f'{game}: regression commands, packets or action boundaries differ')
        require(current['final']['actions'] == planned['expectedCommands'] == commands and
                current['final']['prefixes'] == planned['expectedPrefixes'] == prefixes and
                planned['expectedCompletePublicPackets'] == commands + 1, 'Regression count mismatch')
        require(current['final'] == record['final'] and item['actions'] == commands and
                item['prefixes'] == prefixes and item['levelsCompleted'] == target and
                item['state'] == current['final']['state'], 'Regression summary differs from retained report')
        require(item['report'] == record['report'] == proof(ROOT / planned['report']), 'Regression report identity mismatch')
        replay = current['recordedPublicReplay']
        require(replay['trace'] == {k: planned['recordedTrace'][k] for k in ['path', 'sha256']} and
                replay['baseline'] == {k: planned['baseline'][k] for k in ['path', 'sha256']},
                'Regression replay inputs differ from the plan')
        validate_trace(current, check_file(planned['recordedTrace']), current_source=False)
        validate_execution(record['execution'], source)
        require(record['execution']['command'] == planned['command'], 'Replay execution command changed')
        require(record['execution']['harnessFileSha256'] == plan['harnessFileSha256'], 'Replay harness differs from plan')
        require(len(record['comparisonAttempts']) == 1, 'Unexpected comparison attempts; inspect retained failures')
        attempt = record['comparisonAttempts'][0]
        require(read(check_file(attempt['receipt'])) == {k: v for k, v in attempt.items() if k != 'receipt'},
                'Comparison receipt differs from its retained attempt')
        validate_execution(attempt, source)
        require(attempt['command'] == planned['comparisonCommand'] and attempt['passed'] is True
                and attempt['checks'] == 15 and attempt['failedChecks'] == [], 'Regression comparator failed')
        checked = read(check_file(attempt['result']))
        require(checked['schema'] == 'logos-engine.v47.public-regression-comparison.v1' and
                checked['passed'] is True and len(checked['checks']) == 15 and
                all(c['passed'] is True for c in checked['checks']), 'A regression assertion failed')
        check_file(checked['before'])
        check_file(checked['after'])
        require(checked['compared'] == attempt['compared'] ==
                {'commands': commands, 'completePublicPackets': commands + 1, 'prefixes': prefixes},
                'Regression comparison count mismatch')
        require(item['comparison'] == attempt['result'] == proof(ROOT / planned['comparison']),
                'Regression comparison identity mismatch')
        for prefix in current['prefixes']:
            shared = prefix['sharedSeries']
            require(shared['traceFieldExtensionCount'] == shared['linkedPacketEvidenceCount'] == 0 and
                    shared['traceFieldLatestExtension'] is None and shared['linkedPacketLatestEvidence'] is None,
                    'A new layer acquired legacy regression evidence')
    expected_groups = [
        {'mode': 'recorded-public-replay', 'runs': 4, 'passed': True, 'commands': 242,
         'completePublicPackets': 246, 'prefixes': 189, 'comparisonChecks': 60,
         'games': [row[0] for row in REGRESSIONS]},
        {'mode': 'actual-game-campaign', 'runs': 0, 'passed': True, 'commands': 0,
         'completePublicPackets': 0, 'prefixes': 0, 'comparisonChecks': 0, 'games': []},
    ]
    require(summary['groups'] == expected_groups, 'Regression aggregation changed')
    return {'summary': proof(summary_path), 'groups': summary['groups'],
            'qualification': 'Four cold native replays recompute commands against recorded complete public returns. They are not four additional live game campaigns.'}


def validate_checks(source):
    path = OUT / 'validation/checks-run.json'
    checks = read(path)
    require(checks['schema'] == 'logos-engine.v47.actual-release-checks.v1' and
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


def validate_progress():
    progress_path = ROOT / 'docs/migration/v6-entry-point-progress.json'
    progress = read(progress_path)
    require(progress['schema'] == 'logos-engine.v6.declared-entry-coverage.v1' and
            (progress['connected'], progress['declared'], progress['percent'], progress['implementation'])
            == (38, 76, 50, IMPLEMENTATION), 'Declared source-entry progress changed')
    require(len(progress['groups']) == 4, 'Expected four ordered source DRM lists')
    for group in progress['groups']:
        require(group['declared'] == len(group['entries']) and
                group['connected'] == sum(e['status'] == 'connected' for e in group['entries']),
                'Entry group counts do not match their explicit statuses')
    require(sum(g['declared'] for g in progress['groups']) == 76 and
            sum(g['connected'] for g in progress['groups']) == 38 and progress['fullV6Parity'] is False,
            'Progress denominator or parity claim changed')
    coverage_path = ROOT / 'docs/migration/v6-coverage.json'
    coverage = read(coverage_path)
    require(coverage['complete'] is False and len(coverage['completionGates']) == 6 and
            all(value is False for value in coverage['completionGates'].values()),
            'Incomplete migration must not be represented as complete')
    return {'connected': 38, 'declared': 76, 'percent': 50,
            'metric': progress['metric'], 'entryAudit': proof(progress_path),
            'migrationAudit': proof(coverage_path),
            'qualification': '50% measures connected subquestions in the four declared source DRM lists; it is not full migration, original-caller parity, or a game success rate.'}


def validate_browser(source):
    path = OUT / 'sele-browser-verification.json'
    browser = read(path)
    require(browser['schema'] == 'logos-engine.v47.browser-verification.v1' and
            browser['status'] == 'passed' and browser['game'] == 'SELE' and
            browser['nativeSourceManifestDigest'] == source['digest'], 'Browser proof source mismatch')
    ui_files = {'src/main.ts', 'src/sra-agent.css', 'src/styles.css'}
    require(set(browser['uiFilesSha256']) == ui_files, 'Browser proof omits an edited UI source')
    check_map(browser['uiFilesSha256'])
    build_inputs = read(OUT / 'validation/checks-run.json')['buildInputs']
    require(browser['uiFilesSha256'] == {name: build_inputs[name] for name in ui_files},
            'Observed UI sources differ from the checked build')
    raw = read(check_file(browser['rawMeasurements']))
    require(raw['measurements'] == browser['measurements'] and
            raw['fullscreen'] == browser['fullscreen'] and raw['mobile'] == browser['mobile'],
            'Browser summary differs from retained raw observations')
    measurements = browser['measurements']
    require(browser['measurementCount'] == len(measurements) == 10,
            'Missing observed preparation, thinking, action or boundary measurements')
    selectors = ['.board-column', '#canvas-stage', '#game-canvas', '.minimal-play-area',
                 '#agent-message', '#agent-run']
    viewport = {'height': 936, 'width': 1363}
    baseline = measurements[0]['rectangles']
    require(set(baseline) == set(selectors), 'Missing a layout rectangle')
    for rect in baseline.values():
        require(set(rect) == {'x', 'y', 'width', 'height'} and
                all(type(value) in [int, float] and math.isfinite(value) for value in rect.values())
                and rect['width'] > 0 and rect['height'] > 0, 'Invalid document rectangle')
    for item in measurements:
        require(item['viewport'] == viewport and item['inspectionOpen'] is False,
                'Viewport or inspection state changed between measurements')
        require(item['rectangles'] == baseline, 'Observed layout moved between SRA states')
    require([m['label'] for m in measurements] == [
        'final-ready-level-1', 'final-level-1-preparing', 'final-level-1-complete',
        'final-level-2-thinking', 'final-level-2-complete', 'final-level-3-thinking',
        'final-level-3-progress', 'final-level-3-complete', 'fullscreen',
        'normal-after-fullscreen-unavailable'], 'Observed state coverage changed')
    require([(int(m['actions']), int(m['levels'])) for m in measurements] ==
            [(0, 0), (0, 0), (8, 1), (8, 1), (18, 2), (18, 2), (43, 2), (44, 3), (44, 3), (44, 3)],
            'Browser action or natural-boundary observations changed')
    require([m['status'] for m in measurements] == [
        'Ready to run from level 1.', 'Preparing the agent…', 'Level completed.',
        'Reading the board and planning…', 'Level completed.', 'Reading the board and planning…',
        'Applying the next action…', 'Level completed.', 'Level completed.', 'Level completed.'],
        'Browser status coverage differs from the retained states')
    require(baseline['.board-column']['height'] == 442 and
            baseline['#canvas-stage']['height'] == baseline['#canvas-stage']['width'] == 384 and
            baseline['#game-canvas']['height'] == baseline['#game-canvas']['width'] == 384 and
            baseline['#agent-message']['height'] == 98, 'Observed desktop dimensions changed')
    max_position_delta = max(abs(item['rectangles'][selector][axis] - baseline[selector][axis])
                             for item in measurements for selector in selectors for axis in ['x', 'y'])
    max_dimension_delta = max(abs(item['rectangles'][selector][axis] - baseline[selector][axis])
                              for item in measurements for selector in selectors for axis in ['width', 'height'])
    require(browser['layout'] == {
        'viewport': viewport, 'boardColumnHeight': 442, 'canvasHeight': 384, 'canvasWidth': 384,
        'statusHeight': 98, 'maxDocumentPositionDeltaPx': max_position_delta,
        'maxDimensionDeltaPx': max_dimension_delta, 'selectors': selectors,
        'inspectionClosedThroughout': True}, 'Layout summary differs from actual rectangles')
    result = browser['observedResult']
    require(result == {'completedLevels': 3, 'actions': 44, 'prefixes': 44,
                       'url': 'http://127.0.0.1:4173/?game=SELE&level=4',
                       'normalStatus': 'Level completed.', 'entryLevel': 4},
            'Observed browser result is not SELE three levels in 44 actions')
    require(raw['observedGame'] == 'SELE' and raw['observedCompletedLevels'] == 3 and
            raw['observedActions'] == 44 and raw['actualFinalUrl'] == result['url'],
            'Raw browser result differs from summary')
    campaign = browser['browserCampaign']
    require(campaign['sessions'] == 1 and campaign['manualGameActions'] == campaign['resets'] ==
            campaign['levelJumps'] == 0 and campaign['runToNextLevelClicks'] == 3,
            'Browser result includes manual game intervention or another session')
    require(browser['fullscreen'] == {
        'status': 'unavailable_in_browser',
        'visibleMessage': 'Full-screen mode is not available in this browser window.',
        'normalLayoutPreserved': True} and browser['mobile']['status'] == 'not_measured',
        'Unobserved fullscreen or mobile behavior must not be represented as verified')
    screenshot = check_file(browser['screenshot'])
    capture_bytes = screenshot.read_bytes()
    png = capture_bytes.startswith(b'\x89PNG\r\n\x1a\n') and screenshot.suffix.lower() == '.png'
    jpeg = capture_bytes.startswith(b'\xff\xd8\xff') and screenshot.suffix.lower() in ['.jpg', '.jpeg']
    require(png or jpeg, 'Browser capture filename must match its unchanged PNG or JPEG bytes')
    accessibility = check_file(browser['accessibility']).read_text()
    for text in ['game=SELE&level=4', 'Solve with SRA.', 'Level completed.', 'text 44', 'text 3',
                 'button (collapsed) Inspect reasoning', browser['fullscreen']['visibleMessage']]:
        require(text in accessibility, f'Final accessibility capture lacks observed content: {text}')
    return {'receipt': proof(path), 'measurements': 10, 'viewport': viewport,
            'boardColumnHeight': 442, 'canvasSize': 384, 'statusHeight': 98,
            'maximumDocumentPositionDeltaPx': max_position_delta,
            'maximumDimensionDeltaPx': max_dimension_delta,
            'completedLevels': 3, 'actions': 44, 'prefixes': 44, 'inspectionClosedThroughout': True,
            'captureFormat': 'PNG' if png else 'JPEG',
            'fullscreen': 'unavailable_in_browser', 'mobile': 'not_measured',
            'qualification': 'All six measured document rectangles are identical in ten observations of the normal desktop layout, including after the unavailable fullscreen request. No fullscreen-mode or mobile-size validation is claimed.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true', help='Recompute and compare without changing validation.json')
    args = parser.parse_args()
    required = ['source-manifest.json', 'sele-three-levels.json', 'zipp-six-levels.json',
                'sele-public-trace.json.gz', 'zipp-public-trace.json.gz',
                'sele-original-component-comparison.json', 'zipp-trace-extension-comparison.json',
                'validation/delta-tests-run.json', 'validation/delta-tests-final.json', 'validation/checks-run.json',
                'regression-plan.json', 'regression-verification.json', 'regression-summary.json',
                'sele-browser-verification.json']
    missing = [name for name in required if not (OUT / name).is_file()]
    require(not missing, 'Missing retained release evidence: ' + ', '.join(missing))
    source = validate_source()
    campaigns = validate_campaigns(source)
    comparators = validate_comparators()
    tests = validate_tests(source)
    regressions = validate_regressions(source)
    checks = validate_checks(source)
    progress = validate_progress()
    browser = validate_browser(source)
    require(validate_source() == source, 'Native source changed during read-only validation')
    report = {
        'schema': 'logos-engine.v47.release-validation.v1', 'status': 'passed',
        'sourceDigest': SOURCE_DIGEST, 'nativeSourceFiles': 158,
        'nativeSourceManifest': proof(OUT / 'source-manifest.json'),
        'newActualCampaign': campaigns['SELE'], 'retainedExtensionAttempt': campaigns['ZIPP'],
        'componentComparisons': comparators, 'deltaTests': tests, 'regressions': regressions,
        'checks': checks, 'browser': browser, 'progress': progress,
        'completeMigration': False, 'originalFullCommonCallerParity': False,
        'generator': proof(Path(__file__).resolve()),
        'scope': 'Read-only validation of retained actual executions, the frozen source, recomputed component comparisons, affected tests, four recorded-public regressions, build inputs and observed desktop UI measurements. No game or agent is executed. ZIPP remains a failed six-level attempt with five completed levels; neither new actual campaign is an official full-game WIN.',
    }
    output = OUT / 'validation.json'
    if args.verify:
        require(output.is_file() and read(output) == report, 'Retained release validation differs from recomputation')
    else:
        require(not output.exists(), 'validation.json already exists; use --verify to check it without overwriting')
        output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'status': 'passed', 'mode': 'verify' if args.verify else 'create',
                      'newGame': 'SELE', 'levelsCompleted': 3, 'actions': 44,
                      'zippCampaignStatus': 'failed', 'zippLevelsCompleted': 5,
                      'deltaTests': tests['counts'], 'recordedPublicRegressions': 4,
                      'entryProgressPercent': 50}), flush=True)


if __name__ == '__main__':
    main()
