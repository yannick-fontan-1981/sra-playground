#!/usr/bin/env python3
"""Validate saved v43 release evidence without running games or agents."""
from __future__ import annotations

import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v43'
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.13.0'


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


def evidence(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}


def packet_hash(packet):
    # The trace preserves the production JSON.stringify field insertion order.
    return hashlib.sha256(json.dumps(packet, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def main():
    names = ['comb-three-levels.json', 'comb-six-levels.json', 'ther-six-levels.json',
             'memo-three-levels.json', 'tict-six-levels.json', 'hano-four-levels.json',
             'elas-three-levels.json', 'tu93-three-levels.json', 'stck-three-levels.json', 'pipe-three-levels.json']
    campaigns = {name: read(OUT / name) for name in names}
    source = campaigns['comb-three-levels.json']['source']
    assert source['fileCount'] == len(source['files']) == 143
    for relative, expected in source['files'].items():
        assert sha(ROOT / relative) == expected, relative
    current_paths = {path.relative_to(ROOT).as_posix() for folder in ['src/logos-engine', 'src/runtime']
                     for path in (ROOT / folder).rglob('*') if path.is_file() and path.suffix in ['.ts', '.json', '.drm']}
    assert current_paths == set(source['files'])
    for name, campaign in campaigns.items():
        assert campaign['status'] == 'passed', name
        assert campaign['source'] == source and campaign['sourceUnchangedDuringRun'] is True, name
        assert campaign['pythonAgentModules'] == [] and campaign['final']['sessions'] == 1, name
        assert campaign['final']['nativeImplementation'] == IMPLEMENTATION and campaign['final']['fullV6Parity'] is False
        assert campaign['final']['caller']['acquiredTransitions'] == campaign['final']['actions'] == len(campaign['actions'])
        assert sum(prefix['acquiredActions'] for prefix in campaign['prefixes']) == len(campaign['actions'])
        assert campaign['final']['operationCounts']['init'] == 1
        assert campaign['final']['operationCounts']['advance'] == len(campaign['actions'])
        for asset, expected in campaign['gameAssets'].items():
            assert sha(ROOT / 'public/python' / asset) == expected, (name, asset)
        assert all(prefix['operations'] == ['OP29', 'OP30', 'OP31'] for prefix in campaign['prefixes'])

    assert [b['levelActions'] for b in campaigns['comb-three-levels.json']['boundaries']] == [3, 7, 14]
    assert [b['levelActions'] for b in campaigns['comb-six-levels.json']['boundaries']] == [3, 7, 14, 19, 30, 31]
    assert [b['levelActions'] for b in campaigns['ther-six-levels.json']['boundaries']] == [4, 3, 4, 4, 5, 6]
    for name in ['comb-six-levels.json', 'ther-six-levels.json']:
        final = campaigns[name]['final']
        assert final['levelsCompleted'] == 6 and final['state'] == 'WIN', name

    traces = {}
    trace_proofs = []
    for trace_name, campaign_name in [('comb-public-trace.json.gz', 'comb-three-levels.json'),
                                      ('comb-six-level-public-trace.json.gz', 'comb-six-levels.json'),
                                      ('ther-six-level-public-trace.json.gz', 'ther-six-levels.json')]:
        trace = read(OUT / trace_name); campaign = campaigns[campaign_name]; traces[trace_name] = trace
        assert trace['sourceDigest'] == source['digest'] and trace['status'] == 'passed'
        assert len(trace['packets']) == len(campaign['actions']) + 1
        assert trace['packets'][0]['command'] is None
        assert packet_hash(trace['packets'][0]['packet']) == campaign['initial']['publicPacketSha256']
        boundaries = []
        previous_boundary = 0
        for index, item in enumerate(trace['packets'][1:], 1):
            action = campaign['actions'][index - 1]; packet = item['packet']; before = trace['packets'][index - 1]['packet']
            assert item['command'] == action['command'] and packet_hash(packet) == action['publicPacketSha256']
            assert packet['level'] == action['levelAfter'] and before['level'] == action['levelBefore']
            assert packet['levels_completed'] == action['completedAfter'] and before['levels_completed'] == action['completedBefore']
            assert packet['state'] == action['state'] and len(packet['frame_packet']) == action['animationFrames']
            if packet['levels_completed'] > before['levels_completed']:
                boundaries.append({'levelsCompleted': packet['levels_completed'], 'totalActions': index, 'levelActions': index - previous_boundary})
                previous_boundary = index
        assert boundaries == [{key: row[key] for key in ['levelsCompleted', 'totalActions', 'levelActions']} for row in campaign['boundaries']]
        trace_proofs.append({**evidence(OUT / trace_name), 'packets': len(trace['packets']),
                             'allCommandsAndCompletePublicPacketHashesVerified': True})
    assert traces['comb-public-trace.json.gz']['packets'] == traces['comb-six-level-public-trace.json.gz']['packets'][:25]
    old_ther = read(ROOT / 'docs/migration/native-campaigns-v42/ther-four-level-public-trace.json.gz')
    assert old_ther['packets'] == traces['ther-six-level-public-trace.json.gz']['packets'][:16]

    comparison = read(OUT / 'comb-original-component-comparison.json')
    assert comparison['status'] == 'passed_exact_public_trajectory'
    assert comparison['summary']['actionsCompared'] == 24 and comparison['summary']['completePublicPacketsCompared'] == 25
    assert comparison['summary']['animationFramesCompared'] == 46
    baseline = read(OUT / 'comb-v42-baseline.json')
    assert baseline['status'] == 'failed' and baseline['sourceUnchangedDuringRun'] is True
    assert baseline['final']['actions'] == 23 and baseline['final']['levelsCompleted'] == 0
    assert baseline['final']['state'] == 'GAME_OVER' and baseline['pythonAgentModules'] == []
    mark_path = OUT / 'ther-mark-support-audit.json'; mark = read(mark_path)
    assert mark.get('status', mark.get('auditStatus')) in ['passed', 'passed_exact_public_evidence']

    regressions = []
    totals = {'commands': 0, 'completePublicPackets': 0, 'prefixes': 0, 'checks': 0}
    for game in ['memo', 'tict', 'hano', 'elas', 'tu93', 'stck', 'pipe']:
        path = OUT / f'{game}-comparison.json'; item = read(path)
        assert item['passed'] is True and all(check['passed'] for check in item['checks'])
        assert item['after']['sourceDigest'] == source['digest']
        for side in ['before', 'after']:
            assert sha(ROOT / item[side]['path']) == item[side]['sha256']
        for key in ['commands', 'completePublicPackets', 'prefixes']: totals[key] += item['compared'][key]
        totals['checks'] += len(item['checks'])
        regressions.append({**evidence(path), 'checks': len(item['checks']), 'compared': item['compared']})

    suite = read(OUT / 'validation/suite-run.json')
    assert suite['exitCode'] == 1 and suite['nativeSourceUnchanged'] and suite['testFilesUnchanged']
    assert suite['nativeSourceManifestDigest'] == source['digest']
    files = sorted(path.relative_to(ROOT).as_posix() for path in (ROOT / 'tests').glob('*.test.ts'))
    assert suite['testFiles'] == files and len(files) == 83
    recheck = read(OUT / 'validation/topology-recheck.json')
    assert recheck['exitCode'] == 0 and recheck['nativeSourceUnchanged'] and recheck['testFilesUnchanged']
    assert recheck['nativeSourceManifestDigest'] == source['digest']
    assert len(recheck['testFiles']) == 5 and set(recheck['testFiles']) < set(files)
    assert all(sha(ROOT / path) == expected for path, expected in recheck['testFileSha256'].items())
    changed_tests = {path for path, expected in suite['testFileSha256'].items() if sha(ROOT / path) != expected}
    assert changed_tests == set(recheck['testFiles'])
    log_path = ROOT / suite['output']['path']; assert sha(log_path) == suite['output']['sha256']
    log = gzip.decompress(log_path.read_bytes()).decode()
    counts = {key: int(re.search(r'^# ' + key + r' (\d+)\s*$', log, re.M).group(1))
              for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']}
    assert counts['tests'] == counts['pass'] + counts['fail'] == 4526 and counts['fail'] == 7
    assert all(counts[key] == 0 for key in ['cancelled', 'skipped', 'todo'])
    recheck_log_path = ROOT / recheck['output']['path']; assert sha(recheck_log_path) == recheck['output']['sha256']
    recheck_log = gzip.decompress(recheck_log_path.read_bytes()).decode()
    recheck_counts = {key: int(re.search(r'^# ' + key + r' (\d+)\s*$', recheck_log, re.M).group(1))
                      for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']}
    assert recheck_counts['tests'] == recheck_counts['pass']
    assert all(recheck_counts[key] == 0 for key in ['fail', 'cancelled', 'skipped', 'todo'])
    failed_names = set(re.findall(r'^\s*not ok \d+ - (.+)$', log, re.M))
    passed_recheck_names = set(re.findall(r'^\s*ok \d+ - (.+)$', recheck_log, re.M))
    assert len(failed_names) == 7 and failed_names <= passed_recheck_names
    failed_files = set(re.findall(r"location: '[^']*/(tests/[^':]+\.test\.ts):", log))
    assert failed_files == changed_tests
    resolved_counts = {**counts, 'pass': counts['tests'], 'fail': 0}
    checks = read(OUT / 'validation/checks-run.json')
    assert [check['name'] for check in checks['checks']] == ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
    for check in checks['checks']:
        assert check['exitCode'] == 0
        assert sha(ROOT / check['output']['path']) == check['output']['sha256']
    assert checks['nativeSourceManifestDigest'] == source['digest'] and checks['nativeSourceUnchanged']
    workers = list((ROOT / 'dist/assets').glob('v6-agent-worker-*.js'))
    assert len(workers) == 1
    assert not any('agent' in path.name.lower() and path.suffix in ['.py', '.zip'] for path in (ROOT / 'dist').rglob('*') if path.is_file())
    for asset, expected in campaigns['comb-three-levels.json']['gameAssets'].items():
        assert sha(ROOT / 'dist/python' / asset) == expected, asset

    browsers = []
    for game, campaign_name in [('comb', 'comb-six-levels.json'), ('ther', 'ther-six-levels.json')]:
        path = OUT / f'{game}-browser-verification.json'; browser = read(path); campaign = campaigns[campaign_name]
        assert browser['nativeSourceManifestDigest'] == source['digest']
        assert browser['initialLevel'] == 1 and browser['initialActions'] == browser['initialSolvedLevels'] == 0
        assert browser['solvedLevels'] == 6 and browser['visibleVictoryHeading'] == 'VICTORY'
        assert browser['manualGameActions'] == browser['agentSessionResets'] == browser['levelJumps'] == 0
        assert browser['inspectionClosedAtStart'] and not browser['inspectionOpenedDuringRun']
        assert browser['cumulativeActionsAtBoundaries'] == [row['totalActions'] for row in campaign['boundaries']]
        assert browser['completedPlans'] == campaign['final']['prefixes']
        assert sha(OUT / browser['screenshot']) == browser['screenshotSha256']
        browsers.append({**evidence(path), **browser})
    progress_path = ROOT / 'docs/migration/v6-entry-point-progress.json'; progress = read(progress_path)
    coverage_path = ROOT / 'docs/migration/v6-coverage.json'; coverage = read(coverage_path)
    assert (progress['connected'], progress['declared'], progress['percent']) == (34, 76, 44.7)
    assert progress['implementation'] == IMPLEMENTATION
    assert coverage['failures'] == [] and coverage['complete'] is False and not any(coverage['completionGates'].values())
    result = {
        'schema': 'logos-engine.v6.v43-validation.v1', 'implementation': IMPLEMENTATION,
        'previousSiteSourceCommit': 'a1d05e95b1fd4f32e8c3566cd7b36099edf98dcd',
        'referenceCommit': campaigns['comb-three-levels.json']['referenceCommit'],
        'nativeSourceManifestDigest': source['digest'], 'nativeSourceFiles': source['fileCount'],
        'nativeSourceStillMatchesAllCampaignsAfterBuild': True, 'fullV6Parity': False,
        'validator': evidence(Path(__file__)),
        'tests': {'testFiles': len(files), **resolved_counts,
                  'initialExecution': {'receipt': evidence(OUT / 'validation/suite-run.json'), **counts},
                  'targetedRecheck': {'receipt': evidence(OUT / 'validation/topology-recheck.json'), **recheck_counts,
                                      'resolvedFailures': sorted(failed_names)},
                  'qualification': 'All 83 test files ran on frozen production source. The first pass exposed six stale registration count/order assertions in five files (seven failed tests including a parent). Only those assertions changed; the five affected files then passed in full. The remaining 78 files are reused from the first pass. Test totals count final distinct coverage, not the sum of duplicate runs. Both original and corrected receipts/logs remain available.',
                  'checks': checks, 'focusedCapabilities': {'productPanelParity': 366, 'productKernelIntegration': 4, 'nativeMarkSupport': 46},
                  'nativeAgentWorker': evidence(workers[0]), 'noPythonAgentAsset': True},
        'campaigns': [{**evidence(OUT / name), 'game': campaign['game'], 'targetLevels': campaign['targetLevels'],
                       'final': campaign['final'], 'levelActions': [b['levelActions'] for b in campaign['boundaries']],
                       'sourceUnchangedDuringRun': True, 'pythonAgentModules': []} for name, campaign in campaigns.items()],
        'publicTraces': trace_proofs, 'combFirstThreeAreExactPrefixOfFullWin': True,
        'therFirstFourAreExactV42PublicTrajectory': True,
        'originalProductComponentComparison': evidence(OUT / 'comb-original-component-comparison.json'),
        'therMarkSupportAudit': evidence(mark_path),
        'previousCombBaseline': {**evidence(OUT / 'comb-v42-baseline.json'), 'actions': 23, 'completedLevels': 0,
                                 'state': 'GAME_OVER', 'timingComparisonClaimed': False},
        'regressionComparisons': regressions, 'regressionTotals': totals, 'browserVerifications': browsers,
        'entryProgress': {**evidence(progress_path), 'connected': 34, 'declared': 76, 'percent': 44.7,
                          'qualification': 'Equally weighted explicit DRM connections, not code volume, game score or complete parity. Product adds one source entry; native mark support adds none.'},
        'sourceCoverage': {**evidence(coverage_path), 'summary': coverage['summary'], 'complete': False, 'completionGates': coverage['completionGates']},
        'qualification': 'Saved actual execution evidence only. This validator runs no agent or game. Full source-caller parity and universal control/terminal laws are not asserted. Timings from shared resources are not speed benchmarks.'
    }
    (OUT / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': True, 'tests': resolved_counts['pass'], 'testFiles': len(files), 'campaigns': len(campaigns),
                      'regressions': totals, 'sourceDigest': source['digest'], 'entryProgress': [34, 76, 44.7]}))


if __name__ == '__main__': main()
