#!/usr/bin/env python3
"""Validate retained v45 evidence without running an agent or game."""
from __future__ import annotations
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v45'
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.15.0'

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):
    data = path.read_bytes()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)
def proof(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def check_file(item):
    assert sha(ROOT / item['path']) == item['sha256'], item['path']
def packet_hash(packet):
    return hashlib.sha256(json.dumps(packet, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
def tap_counts(text):
    return {key: int(re.search(r'^# ' + key + r' (\d+)\s*$', text, re.M).group(1))
            for key in ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']}
def test_receipt(path, expected_digest):
    receipt = read(path)
    assert receipt['exitCode'] == 0 and receipt['status'] == 'passed'
    assert receipt['testFilesUnchanged'] and receipt['nativeSourceUnchanged'] and receipt['allSourceFilesUnchanged']
    assert receipt['nativeSourceManifestDigest'] == expected_digest
    check_file(receipt['output'])
    text = gzip.decompress((ROOT / receipt['output']['path']).read_bytes()).decode()
    counts = tap_counts(text)
    assert counts['tests'] == counts['pass'] and not any(counts[k] for k in ['fail', 'cancelled', 'skipped', 'todo'])
    return receipt, counts

def main():
    source = read(OUT / 'source-manifest.json')
    assert source['fileCount'] == len(source['files']) == 149
    assert source['digest'] == hashlib.sha256(json.dumps(source['files'], separators=(',', ':')).encode()).hexdigest()
    current_paths = {p.relative_to(ROOT).as_posix() for folder in ['src/logos-engine', 'src/runtime']
                     for p in (ROOT / folder).rglob('*') if p.is_file() and p.suffix in ['.ts', '.json', '.drm']}
    assert current_paths == set(source['files'])
    for relative, expected in source['files'].items(): assert sha(ROOT / relative) == expected, relative

    names = ['catl-six-levels.json', 'lf52-three-levels.json', 'memo-three-levels.json', 'tict-six-levels.json',
             'hano-four-levels.json', 'elas-three-levels.json', 'tu93-three-levels.json', 'stck-three-levels.json',
             'pipe-three-levels.json', 'comb-six-levels.json', 'ther-six-levels.json']
    campaigns = {name: read(OUT / name) for name in names}
    for name, campaign in campaigns.items():
        assert campaign['status'] == 'passed' and campaign['sourceUnchangedDuringRun'], name
        assert campaign['source'] == source and campaign['pythonAgentModules'] == [], name
        final = campaign['final']
        assert final['sessions'] == 1 and final['nativeImplementation'] == IMPLEMENTATION and final['fullV6Parity'] is False
        assert final['caller']['acquiredTransitions'] == final['actions'] == len(campaign['actions'])
        assert final['prefixes'] == len(campaign['prefixes'])
        assert sum(p['acquiredActions'] for p in campaign['prefixes']) == final['actions']
        assert final['operationCounts']['init'] == 1 and final['operationCounts']['advance'] == final['actions']
        assert all(p['operations'] == ['OP29', 'OP30', 'OP31'] for p in campaign['prefixes'])
        for asset, expected in campaign['gameAssets'].items(): assert sha(ROOT / 'public/python' / asset) == expected

    catl, lf52 = campaigns['catl-six-levels.json'], campaigns['lf52-three-levels.json']
    assert (catl['final']['actions'], catl['final']['levelsCompleted'], catl['final']['state'], catl['final']['prefixes']) == (48, 6, 'WIN', 48)
    assert [b['levelActions'] for b in catl['boundaries']] == [8] * 6
    assert (lf52['final']['actions'], lf52['final']['levelsCompleted'], lf52['final']['state'], lf52['final']['prefixes']) == (104, 3, 'NOT_FINISHED', 71)
    assert [b['levelActions'] for b in lf52['boundaries']] == [8, 40, 56]
    assert lf52['final']['reason'] == 'target_levels_completed'
    coordination = [p for p in lf52['prefixes'] if any(r['rule'] == 'current_acquired_continuation_before_unacquired_exploration'
                    for r in p.get('nativeCoordination', []))]
    assert coordination
    for prefix in coordination:
        assert prefix['family'] == 'reduction_transport'
        for receipt in prefix['nativeCoordination']:
            if receipt['rule'] != 'current_acquired_continuation_before_unacquired_exploration': continue
            assert receipt['preferred_family'] == prefix['family'] and receipt['selected_group'] == 'factored_material_return'
            assert receipt['source_trigger_group'] == 'window_constraints'
            assert receipt['unacquired_inquiry']['evidence_refs'] == [] and not receipt['physical_action_authorized']
            witness = receipt['acquired_continuation']
            assert witness['success_ref'] in witness['evidence_refs']
            if witness['step_mode'] == 'calibrate': assert witness['action_effect_known'] is False

    traces = []
    for game, campaign, animations in [('catl', catl, None), ('lf52', lf52, 502)]:
        path = OUT / f'{game}-public-trace.json.gz'; trace = read(path)
        assert trace['status'] == 'passed' and trace['sourceDigest'] == source['digest']
        assert len(trace['packets']) == campaign['final']['actions'] + 1
        assert trace['packets'][0]['command'] is None
        assert packet_hash(trace['packets'][0]['packet']) == campaign['initial']['publicPacketSha256']
        for item, action in zip(trace['packets'][1:], campaign['actions']):
            assert item['command'] == action['command'] and packet_hash(item['packet']) == action['publicPacketSha256']
            assert len(item['packet']['frame_packet']) == action['animationFrames']
        count = sum(len(item['packet']['frame_packet']) for item in trace['packets'])
        if animations is not None: assert count == animations
        receipt = read(OUT / 'logs' / f'execution-{game}.json')
        assert receipt['exitCode'] == 0 and receipt['nativeSourceUnchanged'] and receipt['nativeSourceManifestDigest'] == source['digest']
        report_path = OUT / ('catl-six-levels.json' if game == 'catl' else 'lf52-three-levels.json')
        assert receipt['report']['path'] == report_path.relative_to(ROOT).as_posix()
        assert receipt['trace']['path'] == path.relative_to(ROOT).as_posix()
        assert receipt['nativeSource'] == receipt['nativeSourceAfter'] == source
        assert receipt['command'] == ['node', 'scripts/run-v44-campaign.mjs', game.upper(), str(campaign['targetLevels']), str(report_path), str(path)]
        for key in ['report', 'trace', 'output', 'generator']: check_file(receipt[key])
        traces.append({**proof(path), 'packets': len(trace['packets']), 'animationFramesIncludingInitial': count})

    comparisons = []
    for name in ['lf52-original-component-comparison.json', 'catl-v44-prefix-comparison.json']:
        path = OUT / name; result = read(path)
        assert result['status'] == 'passed' and result['nativeSourceDigest'] == source['digest']
        if name.startswith('lf52'):
            assert result['comparisonConclusion'] == 'shared_prefix_with_explicit_caller_divergence'
            assert result['completeTrajectoryEquivalent'] is False
            assert result['summary']['nativeCommands'] == 104 and result['summary']['sourceComponentCommands'] == 102
            assert result['summary']['sharedPrefixCommands'] == 71 and result['summary']['sharedPrefixCompletePublicPackets'] == 72
            assert result['summary']['differentAlignedPublicPackets'] == 31
        for item in result['inputs'].values(): check_file(item)
        check_file(result['generator']); comparisons.append(proof(path))
    regressions = []; totals = {'commands': 0, 'completePublicPackets': 0, 'prefixes': 0, 'checks': 0}
    for game in ['memo', 'tict', 'hano', 'elas', 'tu93', 'stck', 'pipe', 'comb', 'ther']:
        path = OUT / f'{game}-comparison.json'; result = read(path)
        assert result['passed'] and all(c['passed'] for c in result['checks'])
        assert result['after']['sourceDigest'] == source['digest']
        for side in ['before', 'after']: check_file(result[side])
        for key in ['commands', 'completePublicPackets', 'prefixes']: totals[key] += result['compared'][key]
        totals['checks'] += len(result['checks']); regressions.append(proof(path))
    assert totals == {'commands': 433, 'completePublicPackets': 442, 'prefixes': 237, 'checks': 117}

    initial_source = read(OUT / 'before-continuation-coordination/source-manifest.json')
    baseline_suite, baseline_counts = test_receipt(OUT / 'validation/suite-run.json', initial_source['digest'])
    retained_manifest = OUT / 'before-continuation-coordination/source-manifest.json'
    assert baseline_suite['nativeSourceManifest']['sha256'] == sha(retained_manifest)
    assert baseline_counts['pass'] == 5255 and len(baseline_suite['testFiles']) == 89
    delta, delta_counts = test_receipt(OUT / 'validation/coordination-recheck.json', source['digest'])
    assert all(sha(ROOT / p) == h for p, h in delta['testFileSha256After'].items())
    changed_source = sorted(p for p in set(initial_source['files']) | set(source['files'])
                            if initial_source['files'].get(p) != source['files'].get(p))
    assert changed_source == sorted(['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-native-types.ts',
                                    'src/logos-engine/v6-shared-series.ts', 'src/logos-engine/v6-acquired-continuation.ts'])
    current_tests = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'tests').glob('*.test.ts'))
    for path, expected in baseline_suite['testFileSha256After'].items():
        if sha(ROOT / path) != expected: assert path in delta['testFiles']
    added = sorted(set(current_tests) - set(baseline_suite['testFiles']))
    assert len(current_tests) == 91 and len(added) == 2 and set(added) <= set(delta['testFiles'])
    checks_path = OUT / 'validation/checks-run.json'; checks = read(checks_path)
    assert checks['nativeSourceManifestDigest'] == source['digest'] and checks['nativeSourceUnchanged']
    assert [c['name'] for c in checks['checks']] == ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
    for check in checks['checks']: assert check['exitCode'] == 0; check_file(check['output'])
    workers = list((ROOT / 'dist/assets').glob('v6-agent-worker-*.js')); assert len(workers) == 1
    python_allowlist = {'custom_level_navigation.py', 'custom-manifest.json', 'game_bridge.py',
                       'custom-games.zip', 'official-games.zip', 'official_adapter.py'}
    assert {p.relative_to(ROOT / 'dist/python').as_posix() for p in (ROOT / 'dist/python').rglob('*') if p.is_file()} == python_allowlist
    for relative in python_allowlist: assert sha(ROOT / 'dist/python' / relative) == sha(ROOT / 'public/python' / relative)
    assert not any('agent' in p.relative_to(ROOT / 'dist').as_posix().lower() and p.suffix in ['.py', '.zip']
                   for p in (ROOT / 'dist').rglob('*') if p.is_file())
    for campaign in [catl, lf52]:
        for asset, expected in campaign['gameAssets'].items(): assert sha(ROOT / 'dist/python' / asset) == expected

    browsers = []
    for game, solved, actions, plans, victory in [('catl', 6, [8, 16, 24, 32, 40, 48], 48, True), ('lf52', 3, [8, 48, 104], 71, False)]:
        path = OUT / f'{game}-browser-verification.json'; browser = read(path)
        assert browser['nativeSourceManifestDigest'] == source['digest']
        assert (browser['initialLevel'], browser['initialActions'], browser['initialSolvedLevels']) == (1, 0, 0)
        assert browser['solvedLevels'] == solved and browser['cumulativeActionsAtBoundaries'] == actions
        assert browser['completedPlans'] == plans and browser['victoryVisible'] == victory
        assert browser['manualGameActions'] == browser['agentSessionResets'] == browser['levelJumps'] == 0
        assert browser['inspectionClosedAtStart'] and not browser['inspectionOpenedDuringRun']
        assert sha(OUT / browser['screenshot']) == browser['screenshotSha256']; browsers.append(proof(path))
    progress = read(ROOT / 'docs/migration/v6-entry-point-progress.json')
    coverage = read(ROOT / 'docs/migration/v6-coverage.json')
    assert (progress['connected'], progress['declared'], progress['percent']) == (36, 76, 47.4)
    assert progress['implementation'] == IMPLEMENTATION and coverage['failures'] == []
    assert not coverage['complete'] and not any(coverage['completionGates'].values())
    retained = read(OUT / 'before-continuation-coordination/retention-map.json')
    for item in retained['files']: assert sha(ROOT / item['retainedPath']) == item['sha256']
    first_lf52 = read(OUT / 'before-continuation-coordination/lf52-three-levels.json')
    assert first_lf52['status'] == 'failed' and first_lf52['final']['levelsCompleted'] == 1
    assert first_lf52['final']['reason'] == 'level_active_time_budget'

    output = {'schema': 'logos-engine.v6.v45-validation.v1', 'status': 'passed', 'implementation': IMPLEMENTATION,
              'previousSiteSourceCommit': '5f09bef380512549906ef30d687bed22ad70cb6c',
              'referenceCommit': catl['referenceCommit'], 'nativeSourceManifestDigest': source['digest'],
              'nativeSourceFiles': source['fileCount'], 'nativeSourceStillMatchesAllFinalCampaignsAfterBuild': True,
              'validator': proof(Path(__file__)), 'fullV6Parity': False,
              'tests': {'initialFullSuite': {**proof(OUT / 'validation/suite-run.json'), 'counts': baseline_counts, 'nativeSourceDigest': initial_source['digest']},
                        'initialSourceManifestResolvedAfterRetention': proof(retained_manifest),
                        'finalTargetedRecheck': {**proof(OUT / 'validation/coordination-recheck.json'), 'counts': delta_counts, 'nativeSourceDigest': source['digest']},
                        'finalTestFiles': len(current_tests), 'addedTestFiles': added, 'changedSourceFromInitialSuite': changed_source,
                        'qualification': 'One complete initial suite followed by an explicit targeted recheck of the actual coordinator delta. Counts are not summed or described as a second complete final-source suite.',
                        'checks': proof(checks_path), 'nativeAgentWorker': proof(workers[0]), 'noPythonAgentAsset': True},
              'campaigns': [{**proof(OUT / name), 'game': c['game'], 'final': c['final'], 'levelActions': [b['levelActions'] for b in c['boundaries']]} for name, c in campaigns.items()],
              'publicTraces': traces, 'componentComparisons': comparisons, 'lf52AcquiredContinuationPrefixes': len(coordination),
              'regressionComparisons': regressions, 'regressionTotals': totals, 'browserVerifications': browsers,
              'priorFailedAttemptRetained': proof(OUT / 'before-continuation-coordination/retention-map.json'),
              'entryProgress': {'connected': 36, 'declared': 76, 'percent': 47.4,
                                'qualification': 'Equal-weight explicit DRM entry connections, not code volume, game score or complete original caller parity.'},
              'sourceCoverage': {'summary': coverage['summary'], 'complete': False, 'completionGates': coverage['completionGates']},
              'qualification': 'CATL has an official six-level WIN; LF52 has three completed levels and no claimed complete victory. The AND/OR grammar and acquired-continuation arbitration are explicit native extensions. Isolated original component evidence is separate from original complete caller parity. All action and level results are actual cold retained-session campaigns; timings are not controlled speed benchmarks.'}
    (OUT / 'validation.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': True, 'campaigns': len(campaigns), 'catl': [6, 48, 'WIN'], 'lf52': [3, 104],
                      'initialSuite': baseline_counts['pass'], 'targetedFinalTests': delta_counts['pass'],
                      'nativeSourceDigest': source['digest'], 'progress': [36, 76, 47.4]}))

if __name__ == '__main__': main()
