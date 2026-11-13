#!/usr/bin/env python3
"""Validate recorded v44 release evidence without executing an agent or game."""
from __future__ import annotations

import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v44'
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.14.0'
PREVIOUS = 'c9d57a798045e7de59259a28af55b8222a4497d5'


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


def evidence(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}


def packet_hash(packet):
    return hashlib.sha256(json.dumps(packet, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def main():
    names = ['catl-five-levels.json', 'memo-three-levels.json', 'tict-six-levels.json',
             'hano-four-levels.json', 'elas-three-levels.json', 'tu93-three-levels.json',
             'stck-three-levels.json', 'pipe-three-levels.json', 'comb-six-levels.json', 'ther-six-levels.json']
    campaigns = {name: read(OUT / name) for name in names}
    catl = campaigns['catl-five-levels.json']; source = catl['source']
    assert source['fileCount'] == len(source['files']) == 146
    assert source['digest'] == '1b30d1f0a80275a1204b44198b5fd62f43439d16b5eccdd768a4357b78986093'
    current_paths = {p.relative_to(ROOT).as_posix() for folder in ['src/logos-engine', 'src/runtime']
                     for p in (ROOT / folder).rglob('*') if p.is_file() and p.suffix in ['.ts', '.json', '.drm']}
    assert current_paths == set(source['files'])
    for relative, expected in source['files'].items(): assert sha(ROOT / relative) == expected, relative
    for name, campaign in campaigns.items():
        assert campaign['status'] == 'passed' and campaign['sourceUnchangedDuringRun'] is True, name
        assert campaign['source'] == source and campaign['pythonAgentModules'] == [], name
        final = campaign['final']
        assert final['sessions'] == 1 and final['nativeImplementation'] == IMPLEMENTATION and final['fullV6Parity'] is False
        assert final['caller']['acquiredTransitions'] == final['actions'] == len(campaign['actions'])
        assert final['prefixes'] == len(campaign['prefixes'])
        assert sum(prefix['acquiredActions'] for prefix in campaign['prefixes']) == len(campaign['actions'])
        assert final['operationCounts']['init'] == 1 and final['operationCounts']['advance'] == final['actions']
        assert all(prefix['operations'] == ['OP29', 'OP30', 'OP31'] for prefix in campaign['prefixes'])
        for asset, expected in campaign['gameAssets'].items(): assert sha(ROOT / 'public/python' / asset) == expected

    assert (catl['targetLevels'], catl['final']['actions'], catl['final']['levelsCompleted'], catl['final']['level']) == (5, 40, 5, 6)
    assert catl['final']['state'] == 'NOT_FINISHED' and catl['final']['reason'] == 'target_levels_completed'
    assert catl['final']['caller']['boundaryReplays'] == 4 and catl['final']['prefixes'] == 40
    assert [b['levelActions'] for b in catl['boundaries']] == [8] * 5
    assert [p['labeledSequenceTrainingReused'] for p in catl['prefixes']] == ([False] + [True] * 7) * 5
    for index, prefix in enumerate(catl['prefixes'], 1):
        assert prefix['proposalKind'] == 'labeled_sequence_experiment' and prefix['fieldSubquestion'] == 'labeled_sequence_composition'
        assert prefix['labeledSequenceAgreement'] and prefix['labeledSequenceCompatiblePredicates']
        assert prefix['acquiredActions'] == 1 and prefix['sharedSeries']['labeledSequenceSubmissionCount'] == index
        event = prefix['sharedSeries']['labeledSequenceLatestSubmission']
        action = catl['actions'][index - 1]
        assert event['command'] == action['command'] and event['epoch'] == action['levelBefore']
        assert event['label'] == prefix['labeledSequenceLabel'] and event['query'] == prefix['labeledSequenceQuery']
        assert event['law_uniqueness_claimed'] is False
        assert event['physical_receipt_status'] == ('official_boundary' if index % 8 == 0 else 'changed_public_context')
        assert event['official_progress'] == (index % 8 == 0)

    trace_path = OUT / 'catl-public-trace.json.gz'; trace = read(trace_path)
    assert trace['status'] == 'passed' and trace['game'] == 'CATL' and trace['sourceDigest'] == source['digest']
    assert len(trace['packets']) == 41 and trace['packets'][0]['command'] is None
    assert packet_hash(trace['packets'][0]['packet']) == catl['initial']['publicPacketSha256']
    boundaries = []; previous = 0
    for index, item in enumerate(trace['packets'][1:], 1):
        action = catl['actions'][index - 1]; packet = item['packet']; before = trace['packets'][index - 1]['packet']
        assert item['command'] == action['command'] and packet_hash(packet) == action['publicPacketSha256']
        assert packet['level'] == action['levelAfter'] and before['level'] == action['levelBefore']
        assert packet['levels_completed'] == action['completedAfter'] and before['levels_completed'] == action['completedBefore']
        assert packet['state'] == action['state'] and len(packet['frame_packet']) == action['animationFrames']
        if packet['levels_completed'] > before['levels_completed']:
            boundaries.append({'levelsCompleted': packet['levels_completed'], 'totalActions': index, 'levelActions': index - previous})
            previous = index
    assert boundaries == [{key: row[key] for key in ['levelsCompleted', 'totalActions', 'levelActions']} for row in catl['boundaries']]
    assert sum(len(item['packet']['frame_packet']) for item in trace['packets']) == 106

    comparison_path = OUT / 'catl-original-component-comparison.json'; comparison = read(comparison_path)
    assert comparison['status'] == 'passed_exact_public_trajectory'
    assert comparison['summary']['actionsCompared'] == 40 and comparison['summary']['completePublicPacketsCompared'] == 41
    assert comparison['summary']['animationFramesCompared'] == 106
    for item in comparison['inputs'].values(): assert sha(ROOT / item['path']) == item['sha256']
    assert sha(ROOT / comparison['generator']['path']) == comparison['generator']['sha256']
    original_path = ROOT / 'tests/fixtures/v6-labeled-sequence-original-public.json.gz'; original = read(original_path)
    assert original['status'] == 'stopped' and original['targetLevels'] == 6 and original['levelsCompleted'] == 5
    assert original['reason'] == 'labeled_component_abstained' and original['manualPrimingActions'] == 0
    assert [(item['command'], item['packet']) for item in original['packets']] == [(item['command'], item['packet']) for item in trace['packets']]

    diagnosis_path = OUT / 'catl-next-level-diagnosis.json'; diagnosis = read(diagnosis_path)
    assert diagnosis['status'] == 'passed' and diagnosis['nativeSource'] == source and diagnosis['nativeSourceUnchangedDuringDiagnosis']
    assert all(diagnosis['exactComponentParity'].values())
    d = diagnosis['diagnosis']
    assert d['measurementSucceeded'] and d['featureCalculationComplete'] and d['inferenceReturned']
    assert d['mechanicalStatus'] == 'COMPLETE' and d['cause'] == 'MODEL_CONTRADICTION'
    assert (d['measuredExampleCount'], d['suppliedPredicateRootCount'], d['compatiblePredicateCount'], d['predictionCount']) == (20, 80, 0, 0)
    assert d['everyRootHasActualMeasuredCounterexamples'] and not d['robustAgreement']
    assert diagnosis['cacheBoundary']['trainingReused'] is False
    assert diagnosis['cacheBoundary']['acquiredEpoch'] == 5 and diagnosis['cacheBoundary']['currentEpoch'] == 6
    assert sha(ROOT / diagnosis['generator']) == diagnosis['generatorSha256']

    baseline_path = OUT / 'catl-v43-baseline.json'; baseline = read(baseline_path)
    assert baseline['status'] == 'failed' and baseline['sourceUnchangedDuringRun'] and baseline['pythonAgentModules'] == []
    assert baseline['source'] == read(ROOT / 'docs/migration/native-campaigns-v43/comb-six-levels.json')['source']
    assert baseline['final']['actions'] == 105 and baseline['final']['levelsCompleted'] == 0
    assert baseline['final']['reason'] == 'level_active_time_budget' and baseline['gameAssets'] == catl['gameAssets']

    regressions = []; totals = {'commands': 0, 'completePublicPackets': 0, 'prefixes': 0, 'checks': 0}
    for game in ['memo', 'tict', 'hano', 'elas', 'tu93', 'stck', 'pipe', 'comb', 'ther']:
        path = OUT / f'{game}-comparison.json'; item = read(path)
        assert item['passed'] and all(check['passed'] for check in item['checks'])
        assert item['after']['sourceDigest'] == source['digest']
        for side in ['before', 'after']: assert sha(ROOT / item[side]['path']) == item[side]['sha256']
        for key in ['commands', 'completePublicPackets', 'prefixes']: totals[key] += item['compared'][key]
        totals['checks'] += len(item['checks'])
        regressions.append({**evidence(path), 'compared': item['compared'], 'checks': len(item['checks'])})
    assert totals == {'commands': 433, 'completePublicPackets': 442, 'prefixes': 237, 'checks': 117}

    suite_path = OUT / 'validation/suite-run.json'; suite = read(suite_path)
    assert suite['exitCode'] == 1 and suite['nativeSourceUnchanged'] and suite['testFilesUnchanged']
    assert suite['nativeSourceManifestDigest'] == source['digest']
    files = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'tests').glob('*.test.ts'))
    assert suite['testFiles'] == files and len(files) == 85
    log_path = ROOT / suite['output']['path']; assert sha(log_path) == suite['output']['sha256']
    log = gzip.decompress(log_path.read_bytes()).decode()
    count_keys = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']
    original_counts = {key: int(re.search(r'^# ' + key + r' (\d+)\s*$', log, re.M).group(1)) for key in count_keys}
    assert original_counts == {'tests': 5046, 'pass': 5045, 'fail': 1, 'cancelled': 0, 'skipped': 0, 'todo': 0}
    # Retain the failed original receipt. Only its stale topology expectation
    # was corrected; the whole affected file was then executed again.
    recheck_path = OUT / 'validation/topology-recheck.json'; recheck = read(recheck_path)
    assert recheck['exitCode'] == 0 and recheck['nativeSourceUnchanged'] and recheck['testFilesUnchanged']
    assert recheck['nativeSourceManifestDigest'] == source['digest'] and recheck['nativeSourceFileCount'] == 146
    correction = recheck['correction']; changed_test = correction['file']
    assert recheck['testFiles'] == [changed_test] == ['tests/v6-radial-port-integration.test.ts']
    assert suite['testFileSha256'][changed_test] == correction['beforeSha256']
    assert sha(ROOT / changed_test) == correction['afterSha256'] == recheck['testFileSha256'][changed_test]
    assert all(sha(ROOT / path) == expected for path, expected in suite['testFileSha256'].items() if path != changed_test)
    recheck_log_path = ROOT / recheck['output']['path']; assert sha(recheck_log_path) == recheck['output']['sha256']
    recheck_log = gzip.decompress(recheck_log_path.read_bytes()).decode()
    recheck_counts = {key: int(re.search(r'^# ' + key + r' (\d+)\s*$', recheck_log, re.M).group(1)) for key in count_keys}
    assert recheck_counts == {'tests': 12, 'pass': 12, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}
    initial_rows = re.findall(r'^[ \t]*(ok|not ok) \d+ - (.+)$', log, re.M)
    repeated_rows = re.findall(r'^[ \t]*(ok|not ok) \d+ - (.+)$', recheck_log, re.M)
    assert len(initial_rows) == 5046 and len(repeated_rows) == 12
    assert [(status, name) for status, name in initial_rows if status == 'not ok'] == [('not ok', correction['originalTestName'])]
    for status, name in repeated_rows:
        original_name = correction['originalTestName'] if name == correction['updatedTestName'] else name
        expected_status = 'not ok' if original_name == correction['originalTestName'] else 'ok'
        assert status == 'ok' and initial_rows.count((expected_status, original_name)) == 1
    assert sum(name == correction['updatedTestName'] for _, name in repeated_rows) == 1
    counts = {'tests': 5046, 'pass': 5046, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}
    checks_path = OUT / 'validation/checks-run.json'; checks = read(checks_path)
    assert [check['name'] for check in checks['checks']] == ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
    assert checks['nativeSourceManifestDigest'] == source['digest'] and checks['nativeSourceUnchanged']
    for check in checks['checks']:
        assert check['exitCode'] == 0 and sha(ROOT / check['output']['path']) == check['output']['sha256']
    workers = list((ROOT / 'dist/assets').glob('v6-agent-worker-*.js')); assert len(workers) == 1
    assert not any('agent' in p.name.lower() and p.suffix in ['.py', '.zip'] for p in (ROOT / 'dist').rglob('*') if p.is_file())
    for asset, expected in catl['gameAssets'].items(): assert sha(ROOT / 'dist/python' / asset) == expected

    browser_path = OUT / 'catl-browser-verification.json'; browser = read(browser_path)
    assert browser['nativeSourceManifestDigest'] == source['digest']
    assert (browser['initialLevel'], browser['initialActions'], browser['initialSolvedLevels']) == (1, 0, 0)
    assert browser['solvedLevels'] == 5 and browser['completedPlans'] == 40 and browser['finalVisibleLevel'] == 6
    assert browser['cumulativeActionsAtBoundaries'] == [8, 16, 24, 32, 40]
    assert browser['victoryVisible'] is False
    assert browser['manualGameActions'] == browser['agentSessionResets'] == browser['levelJumps'] == 0
    assert browser['inspectionClosedAtStart'] and not browser['inspectionOpenedDuringRun']
    assert sha(OUT / browser['screenshot']) == browser['screenshotSha256']
    progress_path = ROOT / 'docs/migration/v6-entry-point-progress.json'; progress = read(progress_path)
    coverage_path = ROOT / 'docs/migration/v6-coverage.json'; coverage = read(coverage_path)
    assert (progress['connected'], progress['declared'], progress['percent']) == (35, 76, 46.1)
    assert progress['implementation'] == IMPLEMENTATION and coverage['failures'] == []
    assert coverage['complete'] is False and not any(coverage['completionGates'].values())
    output = {
        'schema': 'logos-engine.v6.v44-validation.v1', 'status': 'passed', 'implementation': IMPLEMENTATION,
        'previousSiteSourceCommit': PREVIOUS, 'referenceCommit': catl['referenceCommit'],
        'nativeSourceManifestDigest': source['digest'], 'nativeSourceFiles': source['fileCount'],
        'nativeSourceStillMatchesAllCampaignsAfterBuild': True, 'fullV6Parity': False,
        'validator': evidence(Path(__file__)),
        'tests': {**counts, 'testFiles': len(files), 'execution': evidence(suite_path),
                  'coverageBasis': 'Distinct coverage reconciled from the original full-suite run and the corrected-file rerun; not a second full-suite execution.',
                  'originalFullSuiteCounts': original_counts,
                  'targetedRecheck': {**evidence(recheck_path), 'counts': recheck_counts, 'correction': correction},
                  'checks': checks,
                  'focusedCapabilities': {'labeledSequenceParity': 517, 'labeledKernelIntegration': 3},
                  'nativeAgentWorker': evidence(workers[0]), 'noPythonAgentAsset': True},
        'campaigns': [{**evidence(OUT / name), 'game': campaign['game'], 'targetLevels': campaign['targetLevels'],
                       'final': campaign['final'], 'levelActions': [b['levelActions'] for b in campaign['boundaries']],
                       'sourceUnchangedDuringRun': True, 'pythonAgentModules': []} for name, campaign in campaigns.items()],
        'catlPublicTrace': {**evidence(trace_path), 'actions': 40, 'packets': 41, 'animationFramesIncludingInitial': 106,
                            'allCommandsAndCompletePublicPacketHashesVerified': True},
        'catlTrainingFeatureReuse': {'computations': 5, 'reuses': 35, 'currentQueryAlwaysMeasured': True},
        'originalComponentComparison': evidence(comparison_path), 'nextLevelDiagnosis': evidence(diagnosis_path),
        'previousBaseline': {**evidence(baseline_path), 'actions': 105, 'completedLevels': 0, 'reason': 'level_active_time_budget'},
        'regressionComparisons': regressions, 'regressionTotals': totals,
        'browserVerification': {**evidence(browser_path), **browser},
        'entryProgress': {**evidence(progress_path), 'connected': 35, 'declared': 76, 'percent': 46.1,
                          'qualification': 'Equally weighted explicit DRM connections, not translated code volume, game score or complete V6 parity.'},
        'sourceCoverage': {**evidence(coverage_path), 'summary': coverage['summary'], 'complete': False, 'completionGates': coverage['completionGates']},
        'qualification': 'Recorded actual execution evidence. No complete CATL victory, full original caller parity or universal learned law is asserted. The sixth-level diagnosis runs no game and is separate from the five-level native campaign. Timings are not a controlled speed benchmark.'
    }
    (OUT / 'validation.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': True, 'tests': counts['pass'], 'testFiles': len(files), 'campaigns': len(campaigns),
                      'catl': [40, 5], 'regressions': totals, 'sourceDigest': source['digest'], 'progress': [35, 76, 46.1]}))


if __name__ == '__main__': main()
