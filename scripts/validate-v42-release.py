#!/usr/bin/env python3
"""Audit saved v42 release evidence, without running an agent or game host."""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v42'
IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/0.12.0'
SOURCE_DIGEST = '6567be12230880198a7b4b085999ecda9354487599e728ee1ae27455f7056d04'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--capture-log-directory', type=Path)
args = parser.parse_args()


def read(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def evidence(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path)}


logs = {'v42-suite.log': 'suite-output.log.gz', 'v42-typecheck.log': 'typecheck-output.log.gz',
        'v42-build.log': 'build-output.log.gz', 'v42-regression-campaigns.log': 'regression-output.log.gz'}
if args.capture_log_directory:
    for original, saved in logs.items():
        (OUT / saved).write_bytes(gzip.compress((args.capture_log_directory / original).read_bytes(), mtime=0))

names = ['ther-three-levels.json', 'ther-four-levels.json', 'stck-four-levels.json',
         'memo-three-levels.json', 'tict-six-levels.json', 'hano-four-levels.json',
         'elas-three-levels.json', 'tu93-three-levels.json', 'stck-three-levels.json', 'pipe-three-levels.json']
campaigns = [read(OUT / name) for name in names]
source = campaigns[0]['source']
assert source['fileCount'] == len(source['files']) == 139
assert source['digest'] == SOURCE_DIGEST
actual = {path.relative_to(ROOT).as_posix() for base in ['src/logos-engine', 'src/runtime']
          for path in (ROOT / base).rglob('*') if path.is_file() and path.suffix in {'.ts', '.json', '.drm'}}
assert actual == set(source['files'])
for path, expected in source['files'].items():
    assert sha(ROOT / path) == expected, ('source changed after campaign', path)


def verify_current_campaign(campaign):
    assert campaign['source'] == source and campaign['sourceUnchangedDuringRun'] is True
    assert campaign['pythonAgentModules'] == [] and campaign['final']['sessions'] == 1
    assert campaign['final']['nativeImplementation'] == IMPLEMENTATION
    for asset, expected in campaign['gameAssets'].items():
        assert sha(ROOT / 'public/python' / asset) == expected
        assert sha(ROOT / 'dist/python' / asset) == expected


for campaign in campaigns:
    verify_current_campaign(campaign)
    assert campaign['status'] == 'passed' and campaign['failure'] is None

suite_text = gzip.decompress((OUT / 'suite-output.log.gz').read_bytes()).decode()
counts = {key: float(value) if '.' in value else int(value)
          for key, value in re.findall(r'^ℹ (\w+) ([\d.]+)$', suite_text, re.M)}
assert counts['tests'] == counts['pass'] == 4078
assert all(counts[key] == 0 for key in ['fail', 'cancelled', 'skipped', 'todo'])
relation_result = read(OUT / 'validation/program-relation-tests-result.json')
assert relation_result['exitCode'] == 0 and relation_result['tests'] == relation_result['passed'] == 32
assert all(relation_result[key] == 0 for key in ['failed', 'cancelled', 'skipped', 'todo'])
assert sha(ROOT / relation_result['testFile']) == relation_result['testFileSha256']
assert sha(ROOT / relation_result['log']) == relation_result['logSha256']
relation_text = (ROOT / relation_result['log']).read_text()
assert 'ℹ tests 32' in relation_text and 'ℹ pass 32' in relation_text and 'ℹ skipped 0' in relation_text
files = sorted((ROOT / 'tests').glob('*.test.ts'))
assert len(files) == 80
rest_files = [path.relative_to(ROOT).as_posix() for path in files if path.relative_to(ROOT).as_posix() != relation_result['testFile']]
assert len(rest_files) == 79
assert subprocess.run(['git', 'diff', '--check'], cwd=ROOT, capture_output=True).returncode == 0
build_text = gzip.decompress((OUT / 'build-output.log.gz').read_bytes()).decode()
assert 'built in' in build_text and 'tsc --noEmit' in build_text
assert 'error TS' not in build_text
workers = sorted((ROOT / 'dist/assets').glob('v6-agent-worker-*.js'))
assert len(workers) == 1 and IMPLEMENTATION in workers[0].read_text()
assert not list((ROOT / 'dist/python').glob('*agent*'))

comparisons = []
for game in ['memo', 'tict', 'hano', 'elas', 'tu93', 'stck', 'pipe']:
    path = OUT / f'{game}-comparison.json'; comparison = read(path)
    assert comparison['passed'] and len(comparison['checks']) == 13
    assert all(check['passed'] for check in comparison['checks'])
    comparisons.append({**evidence(path), 'checks': 13, 'compared': comparison['compared'], 'qualification': comparison['qualification']})
regression_totals = {'campaigns': len(comparisons), 'checks': sum(item['checks'] for item in comparisons),
                    **{key: sum(item['compared'][key] for item in comparisons)
                       for key in ['commands', 'completePublicPackets', 'prefixes']}}
assert regression_totals == {'campaigns': 7, 'checks': 91, 'commands': 303, 'completePublicPackets': 310, 'prefixes': 184}

baseline = read(OUT / 'ther-v41-baseline.json')
assert baseline['source'] == read(ROOT / 'docs/migration/native-campaigns-v41/pipe-three-levels.json')['source']
assert baseline['sourceUnchangedDuringRun'] and baseline['pythonAgentModules'] == []
assert (baseline['final']['actions'], baseline['final']['levelsCompleted']) == (170, 2)
diagnostics = []
for name, actions, levels, reason in [('stck-relation-six-level-attempt.json', 45, 4, 'frontier_unknown'),
                                    ('ther-six-level-attempt.json', 107, 4, 'level_active_time_budget')]:
    path = OUT / 'diagnostics' / name; campaign = read(path)
    verify_current_campaign(campaign)
    assert campaign['status'] == 'failed'
    assert (campaign['final']['actions'], campaign['final']['levelsCompleted'], campaign['final']['reason']) == (actions, levels, reason)
    diagnostics.append({**evidence(path), 'targetLevels': 6, 'final': campaign['final'],
                        'qualification': 'The six-level target was not reached. Four official completions are retained; no complete WIN is claimed.'})

trace_proofs = []
for name, campaign_name in [('ther-public-trace.json.gz', 'ther-three-levels.json'),
                            ('ther-four-level-public-trace.json.gz', 'ther-four-levels.json'),
                            ('stck-four-level-public-trace.json.gz', 'stck-four-levels.json')]:
    trace, campaign = read(OUT / name), read(OUT / campaign_name)
    assert trace['sourceDigest'] == source['digest'] and trace['status'] == 'passed'
    assert len(trace['packets']) == campaign['final']['actions'] + 1
    trace_proofs.append({**evidence(OUT / name), 'packets': len(trace['packets']), 'qualification': 'Public execution output only; never supplied to the live agent.'})
assert read(OUT / 'stck-four-level-public-trace.json.gz')['packets'] == read(OUT / 'diagnostics/stck-relation-public.json.gz')['packets']
ther_packets = read(OUT / 'ther-four-level-public-trace.json.gz')['packets']
assert ther_packets[:12] == read(OUT / 'ther-public-trace.json.gz')['packets']
assert ther_packets == read(OUT / 'diagnostics/ther-six-level-public-trace.json.gz')['packets'][:16]

original = read(OUT / 'ther-original-component-comparison.json')
assert original['status'] == 'passed_exact_public_trajectory'
assert original['summary']['actionsCompared'] == 11 and original['summary']['completePublicPacketsCompared'] == 12
relation_audit = read(OUT / 'diagnostics/stck-program-relations-audit.json')
assert relation_audit['auditStatus'] == 'passed'
relation = read(OUT / 'stck-four-levels.json')['prefixes'][-1]['sharedSeries']['nativeProgramRelations']
assert (relation['modelCount'], relation['trialCount'], relation['refutationCount']) == (1, 5, 0)
assert relation['latestModel']['model']['support_count'] == 1
assert len(relation['latestModel']['model']['candidates']) == 2
assert relation['latestTrial']['official_progress'] is True
assert relation['latestTrial']['outcome'] == 'relation_measurement_unresolved'
assert relation['latestTrial']['measurement']['sample'] is None
quota_diagnosis = read(OUT / 'diagnostics/ther-level-five-quota-diagnosis.json')
assert quota_diagnosis['status'] == 'passed'

browsers = []
for name, actions, plans in [('browser-verification.json', [4, 7, 11, 15], 6),
                             ('stck-browser-verification.json', [3, 10, 35, 45], 25)]:
    path = OUT / name; browser = read(path)
    assert browser['cumulativeActionsAtBoundaries'] == actions and browser['completedPlans'] == plans
    assert browser['solvedLevels'] == 4 and browser['initialLevel'] == 1 and browser['initialActions'] == 0
    assert browser['nativeSourceManifestDigest'] == source['digest']
    assert browser['screenshotSha256'] == sha(OUT / browser['screenshot'])
    browsers.append({**evidence(path), **browser})
entry_path = ROOT / 'docs/migration/v6-entry-point-progress.json'; entry = read(entry_path)
coverage_path = ROOT / 'docs/migration/v6-coverage.json'; coverage = read(coverage_path)
assert (entry['connected'], entry['declared'], entry['percent']) == (33, 76, 43.4)
assert coverage['complete'] is False and not any(coverage['completionGates'].values()) and coverage['failures'] == []

result = {
    'schema': 'logos-engine.v6.v42-validation.v1', 'referenceCommit': campaigns[0]['referenceCommit'],
    'previousSiteSourceCommit': '9fd3c0b643dbb9c2861df45cc7d0c7a78aceed01', 'implementation': IMPLEMENTATION,
    'nativeSourceManifestDigest': source['digest'], 'nativeSourceFiles': source['fileCount'],
    'nativeSourceStillMatchesAllCanonicalCampaignsAfterBuild': True, 'fullV6Parity': False,
    'validator': evidence(Path(__file__)),
    'tests': {'testFiles': len(files), 'tests': 4110, 'pass': 4110, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0,
        'qualification': 'All 80 test files are covered by two disjoint completed runs on unchanged production source. The new relation file ran once separately, including its 45-action cold replay; the other 79 files ran together. No test was skipped.',
        'runs': [{'command': 'node --test --test-concurrency=2 <the 79 explicitly listed files>', 'testFiles': rest_files,
                  'exitCode': 0, 'counts': counts, 'output': evidence(OUT / 'suite-output.log.gz')},
                 {'result': evidence(OUT / 'validation/program-relation-tests-result.json'), **relation_result}],
        'testFileSha256': {path.relative_to(ROOT).as_posix(): sha(path) for path in files},
        'focusedCapabilities': {'rootedQuotaParity': 181, 'programRelationsIncludingColdReplay': 32, 'controlDiscoveryIncludingReturnPreparation': 18},
        'typecheck': {'command': ['npm', 'run', 'typecheck'], 'passed': True, 'exitCode': 0, 'output': evidence(OUT / 'typecheck-output.log.gz')},
        'build': {'command': 'node <Sites plugin>/scripts/build-site.mjs', 'passed': True, 'exitCode': 0,
                  'includesTypecheck': True, 'campaignGameAssetsMatchBuiltAssets': True, 'output': evidence(OUT / 'build-output.log.gz'),
                  'nativeAgentWorker': evidence(workers[0]), 'noPythonAgentAsset': True},
        'diffCheck': {'command': ['git', 'diff', '--check'], 'passed': True}},
    'campaigns': [{**evidence(OUT / name), 'status': campaign['status'], 'game': campaign['game'],
                   'targetLevels': campaign['targetLevels'], 'final': campaign['final'],
                   'levelActions': [boundary['levelActions'] for boundary in campaign['boundaries']],
                   'sourceUnchangedDuringRun': True, 'pythonAgentModules': []}
                  for name, campaign in zip(names, campaigns)],
    'regressionComparisons': comparisons, 'regressionTotals': regression_totals,
    'regressionOutput': evidence(OUT / 'regression-output.log.gz'),
    'publicTraces': trace_proofs, 'originalQuotaComponentComparison': evidence(OUT / 'ther-original-component-comparison.json'),
    'baselineV41': {**evidence(OUT / 'ther-v41-baseline.json'), 'actions': 170, 'completedLevels': 2, 'timingComparisonClaimed': False},
    'browserVerifications': browsers, 'sixLevelAttempts': diagnostics,
    'relationAudit': {**evidence(OUT / 'diagnostics/stck-program-relations-audit.json'), 'status': 'passed',
                      'acquiredModels': 1, 'relationTrials': 5, 'supportCount': 1, 'officialFourthLevel': True,
                      'terminalBoundaryAddsRelationSupport': False, 'sourceProgramModelUnchanged': True},
    'quotaLevelFiveDiagnosis': {**evidence(OUT / 'diagnostics/ther-level-five-quota-diagnosis.json'), 'status': 'passed',
                              'qualification': 'Public-pixel diagnostic and exact pinned Python component agreement. Two visible mark units lie outside the inherited one-grid-step reading band. No production correction or level-five success is claimed.'},
    'preFreezeDiagnostic': {**evidence(OUT / 'diagnostics/ther-integration.json'),
                           'qualification': 'First integrated experiment reached three levels but source changed concurrently. Its failed source-freeze gate is retained; canonical frozen campaigns above are the release evidence.'},
    'entryProgress': {**evidence(entry_path), **{key: entry[key] for key in ['connected', 'declared', 'percent']},
                      'qualification': 'Counts equally weighted explicit DRM registrations. Not code volume, game score or full V6 parity. Rooted quota adds one entry; native extensions add none.'},
    'sourceCoverage': {**evidence(coverage_path), **{key: coverage[key] for key in ['summary', 'complete', 'completionGates']}},
    'nextStep': 'Extend observed aligned-mark support beyond the inherited one-grid-step reading band under explicit homology and ambiguity guards, then revalidate through real returns. THER level five is the first case. Program relations also need a nonterminal contrast; prior official progress must not become a universal operator law.',
    'timingQualification': 'Single runs on shared resources; timings are observations, not controlled speed benchmarks.'
}
(OUT / 'validation.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({'passed': True, 'tests': 4110, 'testFiles': 80, 'canonicalCampaigns': len(campaigns),
                  'regressions': regression_totals, 'sourceDigest': source['digest'], 'entryProgress': [33, 76, 43.4]}))
