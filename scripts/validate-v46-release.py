#!/usr/bin/env python3
"""Validate retained v46 evidence and build without executing a game or agent."""
from __future__ import annotations
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v46'
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.16.0'
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)
def proof(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def check_file(item):
    path = ROOT / item['path']
    if path.is_file() and sha(path) == item['sha256']:
        if 'bytes' in item: assert path.stat().st_size == item['bytes'], item['path']
        return path
    retention = read(OUT / 'diagnostics/retention-map.json')
    matches = [row for row in retention['artifacts'] if row['originalPath'] == item['path'] and row['sha256'] == item['sha256']]
    assert len(matches) == 1, f'Missing original evidence: {item}'
    retained = ROOT / matches[0]['retainedPath']
    assert sha(retained) == item['sha256'], retained
    if 'bytes' in item: assert retained.stat().st_size == item['bytes']
    return retained
def packet_hash(packet):
    return hashlib.sha256(json.dumps(packet, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
def public_action(action): return {k:v for k,v in action.items() if k != 'executionMs'}
def validate_report(report, source):
    assert report['status'] == 'passed' and report['sourceUnchangedDuringRun']
    assert report['source'] == source and report['pythonAgentModules'] == []
    final = report['final']
    assert final['sessions'] == 1 and final['nativeImplementation'] == IMPLEMENTATION and final['fullV6Parity'] is False
    assert final['actions'] == final['caller']['acquiredTransitions'] == len(report['actions'])
    assert final['prefixes'] == len(report['prefixes'])
    assert sum(p['acquiredActions'] for p in report['prefixes']) == final['actions']
    assert final['operationCounts']['init'] == 1 and final['operationCounts']['advance'] == final['actions']
    assert all(p['operations'] == ['OP29', 'OP30', 'OP31'] for p in report['prefixes'])
    for name, expected in report['gameAssets'].items(): assert sha(ROOT / 'public/python' / name) == expected
def validate_trace(report, path, source):
    trace = read(path)
    assert trace['status'] == 'passed' and trace['game'] == report['game'] and trace['sourceDigest'] == source['digest']
    assert len(trace['packets']) == len(report['actions']) + 1
    assert trace['packets'][0]['command'] is None
    assert packet_hash(trace['packets'][0]['packet']) == report['initial']['publicPacketSha256']
    for item, action in zip(trace['packets'][1:], report['actions']):
        assert item['command'] == action['command'] and packet_hash(item['packet']) == action['publicPacketSha256']
        assert len(item['packet']['frame_packet']) == action['animationFrames']
    return sum(len(item['packet']['frame_packet']) for item in trace['packets'])
def validate_execution(execution, source):
    assert execution['exitCode'] == 0 and execution['nativeSourceUnchanged']
    assert execution['nativeSource'] == execution['nativeSourceAfter'] == source
    for key in ['generator', 'output']: check_file(execution[key])
    if 'harnessFileSha256' in execution:
        assert execution['harnessFilesUnchanged'] and execution['harnessFileSha256'] == execution['harnessFileSha256After']
        for name, expected in execution['harnessFileSha256'].items(): check_file({'path': name, 'sha256': expected})
    for item in execution.get('inputs', {}).values(): check_file(item)

def main():
    source = read(OUT / 'source-manifest.json')
    paths = {p.relative_to(ROOT).as_posix() for folder in ['src/logos-engine', 'src/runtime']
             for p in (ROOT / folder).rglob('*') if p.is_file() and p.suffix in ['.ts', '.json', '.drm']}
    assert source['fileCount'] == len(source['files']) == 152 and paths == set(source['files'])
    assert source['digest'] == hashlib.sha256(json.dumps(source['files'], separators=(',', ':')).encode()).hexdigest()
    for name, expected in source['files'].items(): assert sha(ROOT / name) == expected, name

    campaign = read(OUT / 'zipp-four-levels.json'); validate_report(campaign, source)
    assert not campaign.get('recordedPublicReplay') and campaign['targetLevels'] == 4
    final = campaign['final']
    assert (final['actions'], final['levelsCompleted'], final['level'], final['state'], final['prefixes']) == (53, 4, 5, 'NOT_FINISHED', 12)
    assert final['reason'] == 'target_levels_completed' and final['caller']['boundaryReplays'] == 3
    assert [row['levelActions'] for row in campaign['boundaries']] == [8, 15, 15, 15]
    assert all(p['fieldSubquestion'] == 'trace_field_composition' and p['family'] == 'public_occurrence_recall' for p in campaign['prefixes'])
    assert campaign['prefixes'][-1]['sharedSeries']['traceFieldExtensionCount'] == 53
    frames = validate_trace(campaign, OUT / 'zipp-public-trace.json.gz', source); assert frames == 66
    execution = read(OUT / 'logs/execution-zipp.json'); validate_execution(execution, source)
    assert execution['nativeSourceManifestDigest'] == source['digest']
    for key in ['report', 'trace']: check_file(execution[key])
    assert execution['command'][0:4] == ['node', 'scripts/run-v44-campaign.mjs', 'ZIPP', '4']

    comparison_path = OUT / 'zipp-original-component-comparison.json'; comparison = read(comparison_path)
    assert comparison['status'] == 'passed' and comparison['nativeSourceDigest'] == source['digest']
    assert comparison['recordedPublicTrajectoryEquivalent'] and not comparison['originalFullCommonCallerParity']
    assert comparison['summary']['rawExactCommands'] == 53 and comparison['summary']['rawExactCompletePublicPackets'] == 54
    assert comparison['summary']['scopeNormalizedRetainedTransitionEvidence'] == 53
    for item in comparison['inputs'].values(): check_file(item)
    check_file(comparison['generator'])
    verified = subprocess.run(['python', 'scripts/compare-v46-trace-public-evidence.py', '--verify'], cwd=ROOT, capture_output=True, text=True)
    assert verified.returncode == 0, verified.stdout + verified.stderr

    tests_path = OUT / 'validation/delta-tests-run.json'; tests = read(tests_path)
    assert tests['status'] == 'passed' and tests['exitCode'] == 0 and tests['nativeSourceUnchanged'] and tests['sourceAndTestInputsUnchanged']
    assert tests['nativeSource'] == tests['nativeSourceAfter'] == source and tests['nativeSourceManifestDigest'] == source['digest']
    assert tests['testFileCount'] == len(tests['testFiles']) == 13
    for key in ['output', 'generator']: check_file(tests[key])
    for path, expected in tests['sourceAndTestInputs'].items(): assert sha(ROOT / path) == expected, path
    tap = gzip.decompress((ROOT / tests['output']['path']).read_bytes()).decode()
    counts = {key: int(re.search(r'^# ' + key + r' (\d+)\s*$', tap, re.M).group(1)) for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']}
    assert counts == tests['counts'] and counts['tests'] == counts['pass'] and counts['tests'] > 500
    assert all(counts[k] == 0 for k in ['fail', 'cancelled', 'skipped', 'todo'])

    plan = read(OUT / 'regression-plan.json'); regressions = read(OUT / 'regression-verification.json'); summary = read(OUT / 'regression-summary.json')
    assert summary['passed'] and regressions['passed'] and regressions['nativeSourceUnchangedBeforeAfterAllRuns']
    assert regressions['nativeSourceBeforeAllRuns'] == regressions['nativeSourceAfterAllRuns'] == source
    assert len(plan['runs']) == len(regressions['runs']) == len(summary['results']) == 8
    check_file(summary['verification']); check_file(summary['plan']); check_file(regressions['generator'])
    for name, expected in plan['harnessFileSha256'].items(): check_file({'path': name, 'sha256': expected})
    for planned, record, item in zip(plan['runs'], regressions['runs'], summary['results']):
        assert planned['game'] == record['game'] == item['game'] and record['passed'] and item['passed']
        baseline = read(check_file(planned['baseline'])); current = read(check_file(record['report'])); validate_report(current, source)
        assert [public_action(a) for a in baseline['actions']] == [public_action(a) for a in current['actions']]
        assert baseline['initial'] == current['initial'] and len(current['actions']) == planned['expectedCommands']
        validate_execution(record['execution'], source)
        last = record['comparisonAttempts'][-1]; assert last['passed']; validate_execution(last, source)
        checked = read(check_file(last['result'])); assert checked['passed'] and all(c['passed'] for c in checked['checks'])
        assert len(checked['checks']) == 14
        for attempt in record['comparisonAttempts']:
            check_file(attempt['receipt']); check_file(attempt['result']); check_file(attempt['output'])
        assert all(p['sharedSeries']['traceFieldExtensionCount'] == 0 and p['sharedSeries']['traceFieldLatestExtension'] is None for p in current['prefixes'])
        if record['mode'] == 'recorded-public-replay':
            assert current['recordedPublicReplay']['trace'] == {k:planned['recordedTrace'][k] for k in ['path', 'sha256']}
            check_file(planned['recordedTrace'])
        else:
            assert record['game'] == 'TICT' and not current.get('recordedPublicReplay')
            assert (current['final']['actions'], current['final']['levelsCompleted'], current['final']['state']) == (55, 6, 'WIN')
            actual = read(check_file(record['actualExecutionReceipt'])); validate_execution(actual, source)
            for key in ['report', 'trace']: check_file(actual[key])
            validate_trace(current, check_file(record['actualTrace']), source)
    assert [(g['mode'], g['runs'], g['commands']) for g in summary['groups']] == [('recorded-public-replay', 7, 370), ('actual-game-campaign', 1, 55)]

    checks_path = OUT / 'validation/checks-run.json'; checks = read(checks_path)
    assert checks['status'] == 'passed' and checks['nativeSourceUnchanged'] and checks['nativeSource'] == checks['nativeSourceAfter'] == source
    assert [c['name'] for c in checks['checks']] == ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
    check_file(checks['generator'])
    for check in checks['checks']: assert check['exitCode'] == 0; check_file(check['output'])
    for path, expected in checks['buildInputs'].items(): assert sha(ROOT / path) == expected, path
    worker = check_file(checks['nativeAgentWorker']); assert IMPLEMENTATION in worker.read_text()
    assert read(ROOT / '.openai/hosting.json') == {'project_id': PROJECT, 'static': {'directory': 'dist'}}
    assert {p.name for p in (ROOT / 'public/python').iterdir() if p.is_file()} == {'custom_level_navigation.py', 'custom-manifest.json', 'game_bridge.py', 'custom-games.zip', 'official-games.zip', 'official_adapter.py'}

    browser_path = OUT / 'zipp-browser-verification.json'; browser = read(browser_path)
    assert browser['nativeSourceDigest'] == source['digest'] and browser['nativeSourceFiles'] == 152
    assert len(browser['actions']) == 4 and all(a['action'] == 'Run to next level' for a in browser['actions'])
    assert [b['totalActions'] for b in browser['boundaries']] == [8, 23, 38, 53]
    assert [b['levelsCompleted'] for b in browser['boundaries']] == [1, 2, 3, 4]
    assert [b['plans'] for b in browser['boundaries']] == [3, 6, 9, 12]
    assert not browser['inspectionOpened'] and browser['manualGameActions'] == browser['resets'] == browser['levelJumps'] == 0
    assert browser['final'] == {'level': 5, 'levelsCompleted': 4, 'actions': 53, 'plans': 12, 'sessionRetained': True, 'officialWin': False}
    check_file(browser['screenshot']); ax = check_file(browser['finalAccessibility']).read_text()
    assert 'Level completed. V6 acquired the outcome and retained its transfer memory.' in ax
    assert 'text 53' in ax and 'text 12' in ax and 'button (collapsed) Inspect reasoning' in ax and 'game=ZIPP&level=5' in ax
    progress = read(ROOT / 'docs/migration/v6-entry-point-progress.json')
    assert (progress['connected'], progress['declared'], progress['percent'], progress['implementation']) == (37, 76, 48.7, IMPLEMENTATION)
    coverage = read(ROOT / 'docs/migration/v6-coverage.json')
    assert not coverage['complete'] and len(coverage['completionGates']) == 6 and not any(coverage['completionGates'].values())
    assert (coverage['summary']['componentVerifiedModules'], coverage['summary']['partiallyTransferredModules'], coverage['summary']['pendingModules'], coverage['summary']['verifiedModules']) == (98, 75, 1196, 0)
    report = {'schema': 'logos-engine.v46.release-validation.v1', 'status': 'passed', 'sourceDigest': source['digest'], 'nativeSourceFiles': 152,
        'newActualCampaign': {'game': 'ZIPP', 'levels': 4, 'actions': 53, 'prefixes': 12, 'completePublicPackets': 54, 'animationFramesIncludingInitial': frames, 'officialWin': False},
        'sourceComponentComparison': proof(comparison_path), 'deltaTests': {'receipt': proof(tests_path), 'counts': counts, 'testFiles': 13},
        'regressions': {'summary': proof(OUT / 'regression-summary.json'), 'groups': summary['groups']},
        'checks': proof(checks_path), 'nativeAgentWorker': checks['nativeAgentWorker'], 'browser': proof(browser_path),
        'progress': {'connected': 37, 'declared': 76, 'percent': 48.7}, 'completeMigration': False,
        'generator': proof(Path(__file__)), 'scope': 'Read-only validation of recorded executions, exact source identities, component evidence, targeted regressions, browser observations and build. It does not run a game or claim complete original-caller parity.'}
    (OUT / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': 'passed', 'newGame': 'ZIPP', 'levels': 4, 'tests': counts, 'regressions': len(regressions['runs']), 'percent': 48.7}), flush=True)

if __name__ == '__main__': main()
