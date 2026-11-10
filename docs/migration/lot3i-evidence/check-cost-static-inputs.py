#!/usr/bin/env python3
"""Read-only checks of finalized lot3I cost inputs; never runs a benchmark.

Writes one static-preflight receipt. Functional readiness and isolation remain
the delivery owner's separate gate, especially while a campaign is active.
"""
from __future__ import annotations
import ast
from datetime import datetime, timezone, timedelta
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[3]
PERF = ROOT / 'docs/migration/lot3i-evidence/performance'
BASE = Path('/workspace/sites/sra-published-049')
HISTORY = ROOT / 'docs/migration/lot3h-evidence/performance'
EXPECTED_BASE = 'd6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054'
CANDIDATE_MANIFEST = ROOT / 'docs/migration/lot3i-evidence/final/source-manifest.json'
EXPECTED_TOOLS = [
    'scripts/run-native-cost-window.py', 'scripts/measure-native-loop-costs.mjs',
    'scripts/compare-native-loop-costs.mjs', 'scripts/compare-native-cost-cohorts.mjs',
    'scripts/review-native-cost-consolidation.py', 'scripts/review-native-global-cost-window.py',
    'scripts/review-native-global-cost-budget.py',
]

def now(): return datetime.now(timezone(timedelta(hours=-3))).isoformat()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_text())
def fp(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
def inventory(root):
    files = dict(sorted((path.relative_to(root).as_posix(), sha(path))
        for folder in ('src/logos-engine', 'src/runtime') for path in (root / folder).rglob('*')
        if path.is_file() and path.suffix in ('.ts', '.json', '.drm')))
    return {'fileCount': len(files), 'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(), 'files': files}

def main():
    output_path = PERF / 'static-preflight.json'
    if output_path.exists(): raise FileExistsError(output_path)
    required_final = ['declaration.json', 'protocol-check.json', 'global-budget-policy.json']
    missing = [str(PERF / name) for name in required_final if not (PERF / name).is_file()]
    if not CANDIDATE_MANIFEST.is_file(): missing.append(str(CANDIDATE_MANIFEST))
    if missing: raise ValueError('Run only after the real candidate freeze and prepare-cost-protocol.py --finalize: ' + ', '.join(missing))
    candidate_freeze = read(CANDIDATE_MANIFEST)
    expected_candidate = candidate_freeze['digest']
    if not re.fullmatch(r'[0-9a-f]{64}', expected_candidate) or expected_candidate == EXPECTED_BASE:
        raise ValueError('Candidate must have its own finalized native digest')
    started = now(); checks = []
    def check(name, predicate, **detail): checks.append({'name': name, 'satisfied': bool(predicate), **detail})
    declared = read(PERF / 'declaration.json'); policy = read(PERF / 'global-budget-policy.json')
    cases = read(PERF / 'cases.json'); old = read(HISTORY / 'declaration.json')
    prep = read(PERF / 'preparation.json')
    check('distinct_checkouts', ROOT.resolve() != BASE.resolve())
    check('declared_checkouts', prep['baselineCheckout'] == str(BASE) and prep['candidateCheckout'] == str(ROOT))
    check('baseline_published_commit', subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=BASE, text=True).strip()
          == policy['baseline']['commit'] == '8fa6b261b8b23ac8d232e60c9c179e2f3407d82f'
          and policy['baseline']['siteVersion'] == 78, siteVersion=policy['baseline']['siteVersion'])
    for role, checkout, expected, count in [('baseline', BASE, EXPECTED_BASE, 268), ('candidate', ROOT, expected_candidate, 270)]:
        manifest = read(ROOT / declared[role + 'Manifest']['path']); actual = inventory(checkout)
        check(role + '_actual_native_inventory', manifest == actual and actual['digest'] == expected and actual['fileCount'] == count,
              digest=actual['digest'], fileCount=actual['fileCount'])
        check(role + '_declared_native_identity', declared['nativeDigests'][role] == policy[role]['nativeDigest'] == actual['digest']
              and policy[role]['nativeFiles'] == actual['fileCount'])
        version = re.search(r"NATIVE_V6_IMPLEMENTATION = 'logos-engine.typescript.v6.native-migration/([^']+)'", (checkout / 'src/logos-engine/v6-native-runtime.ts').read_text()).group(1)
        check(role + '_actual_version', version == policy[role]['nativeVersion']
              == ('0.49.0' if role == 'baseline' else '0.50.0'), version=version)
    record_keys = ['protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy', 'baselineManifest',
                   'candidateManifest', 'candidateArchiveManifest', 'globalDecisionTool', 'globalCalculationTool']
    for key in record_keys: check('declared_fingerprint_' + key, fp(ROOT / declared[key]['path']) == declared[key])
    retained = declared['officialTools'] + [declared['globalDecisionTool'], declared['globalCalculationTool']]
    prior_tools = old['officialTools'] + [old['globalDecisionTool'], old['globalCalculationTool']]
    check('exact_seven_historical_tools', [item['path'] for item in retained] == EXPECTED_TOOLS
          and [item['path'] for item in prior_tools] == EXPECTED_TOOLS
          and prep['retainedTools'] == retained, count=len(retained))
    for record in retained:
        previous = next(item for item in prior_tools if item['path'] == record['path'])
        check('unchanged_tool_' + record['path'], fp(ROOT / record['path']) == record == previous)
    for name in ('cases.json', 'comparison-policy.json'):
        check('historical_input_' + name, (PERF / name).read_bytes() == (HISTORY / name).read_bytes(), sha256=sha(PERF / name))
    check('same_measurement_runner', sha(BASE / 'scripts/measure-native-loop-costs.mjs') == sha(ROOT / 'scripts/measure-native-loop-costs.mjs'))
    original = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/'
    for suffix in ('laya_proto/common_frontier_policy.drm.json', 'morphology_policy/strategy.drm'):
        path = original + suffix
        check('same_source_declaration_' + suffix, sha(BASE / path) == sha(ROOT / path), sha256=sha(ROOT / path))
    traces = []
    for case in cases['cases']:
        for role, checkout in [('baseline', BASE), ('candidate', ROOT)]:
            path = checkout / case['trace']; digest = sha(path)
            check(role + '_trace_' + case['id'], digest == case['traceSha256'], path=str(path), sha256=digest)
            traces.append({'role': role, 'case': case['id'], 'path': str(path), 'bytes': path.stat().st_size,
                           'sha256': digest, 'expectedSha256': case['traceSha256']})
    wrapper = ast.parse((ROOT / 'scripts/run-native-cost-window.py').read_text())
    planned = next(node.value for node in ast.walk(wrapper) if isinstance(node, ast.Assign)
                   and any(isinstance(target, ast.Name) and target.id == 'plans' for target in node.targets))
    plans = [(item.elts[0].value, item.elts[1].id, item.elts[2].value) for item in planned.elts]
    check('wrapper_order', plans == [('A1', 'baseline', 'cohort1/baseline'), ('B1', 'ROOT', 'cohort1/after'),
          ('B2', 'ROOT', 'cohort2/after'), ('A2', 'baseline', 'cohort2/baseline')], plans=plans)
    check('exact_case_schedule', cases['rounds'] == 4 and [item['id'] for item in cases['cases']] == ['STCK', 'SMLP']
          and [item['actions'] for item in cases['cases']] == [10, 15]
          and [item['warmupActions'] for item in cases['cases']] == [3, 3])
    check('declared_order_and_cohorts', declared['plannedOrder'] == policy['plannedOrder'] == prep['plannedOrder']
          == ['A1', 'B1', 'B2', 'A2'] and declared['cohorts'] == policy['cohorts'] == 2
          and declared['sessionsPerCaseVersionCohort'] == policy['sessionsPerCaseVersionCohort'] == 4
          and policy['caseIds'] == ['STCK', 'SMLP']
          and declared['globalBudgetCases'] == 2 and declared['diagnosticMetrics'] == 16)
    measured_sessions = len(cases['cases']) * cases['rounds'] * 2 * 2
    measured_actions = sum(case['actions'] for case in cases['cases']) * cases['rounds'] * 2 * 2
    warmup_sessions = len(cases['cases']) * 2 * 2
    warmup_actions = sum(case['warmupActions'] for case in cases['cases']) * 2 * 2
    check('cohort_counts_calculated_from_cases', (measured_sessions, measured_actions, warmup_sessions, warmup_actions)
          == (32, 400, 8, 24) and all(declared[key] == policy[key] == value for key, value in
          [('measuredSessions', measured_sessions), ('measuredActions', measured_actions),
           ('excludedWarmupSessions', warmup_sessions), ('excludedWarmupActions', warmup_actions)]),
          measuredSessions=measured_sessions, measuredActions=measured_actions,
          excludedWarmupSessions=warmup_sessions, excludedWarmupActions=warmup_actions)
    check('strict_per_game_global_gate', policy['globalStage'] == 'session_elapsed'
          and policy['statistic'] == 'pooled median of complete measured-session durations per tested case'
          and policy['relativeIncreaseLimit'] == 0.1
          and policy['comparison'] == 'strictly_less_than' and policy['allCasesMustPass'] is True
          and policy['crossCaseCompensation'] is False and policy['phaseOverrunsMayBeAccepted'] is True
          and policy['phasesAndP95RemainVisible'] is True and policy['excludedMeasuredSessions'] == policy['excludedOutliers'] == 0
          and declared['relativeGlobalBudget'] == prep['relativeGlobalBudget'] == 0.1
          and declared['globalComparison'] == prep['globalComparison'] == 'strictly_less_than'
          and declared['phaseOverrunsBlockAcceptance'] is prep['phaseOverrunsBlockAcceptance'] is False
          and declared['allCasesMustPass'] is prep['allCasesMustPass'] is True
          and declared['crossCaseCompensation'] is prep['crossCaseCompensation'] is False)
    check('finalization_is_explicit', declared['status'] == 'declared_before_official_window'
          and declared['noOfficialWindowAtDeclaration'] is True
          and declared['functionalReadinessNotAnticipated'] is True
          and declared['candidateManifest']['path'] == CANDIDATE_MANIFEST.relative_to(ROOT).as_posix()
          and prep['candidateManifestPath'] == declared['candidateManifest']['path']
          and prep['candidateArchiveManifestPath'] == declared['candidateArchiveManifest']['path'])
    check('declared_chronology', datetime.fromisoformat(prep['preparedAt']) == datetime.fromisoformat(policy['declaredAt']) <= datetime.fromisoformat(declared['recordedAt'])
          <= datetime.fromisoformat(declared['finalizedAt']) <= datetime.fromisoformat(started), finalizedAt=declared['finalizedAt'])
    relative_perf = PERF.relative_to(ROOT)
    for name in ('cases.json', 'comparison-policy.json', 'protocol.md'):
        destination = BASE / relative_perf / name
        check('baseline_input_copy_' + name, not destination.exists() or destination.read_bytes() == (PERF / name).read_bytes(),
              state='present_and_identical' if destination.exists() else 'absent_runner_will_copy')
    output_names = ['window.json', 'combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json']
    output_names += [f'cohort{c}/comparison.json' for c in (1, 2)]
    output_names += [f'cohort{c}/{name}.{extension}' for c in (1, 2) for name in ('baseline', 'after') for extension in ('json', 'log')]
    existing = [str(path) for base in (PERF, BASE / relative_perf) for name in output_names if (path := base / name).exists()]
    check('exclusive_measurement_outputs_absent', not existing, existing=existing)
    links = []
    for name in ('node_modules', 'public/vendor/pyodide'):
        path = BASE / name; entry = {'path': str(path), 'isSymlink': path.is_symlink(), 'target': str(path.resolve()),
                                  'targetExists': path.exists(), 'sameTargetAsCandidate': path.resolve() == (ROOT / name).resolve()}
        compatible = entry['targetExists'] and entry['sameTargetAsCandidate']
        if not compatible and path.is_dir() and (ROOT / name).is_dir():
            trees = []
            for folder in (path, ROOT / name):
                files = dict(sorted((p.relative_to(folder).as_posix(), sha(p)) for p in folder.rglob('*') if p.is_file()))
                trees.append(files)
            compatible = trees[0] == trees[1] and bool(trees[0])
            entry['copiedTree'] = {'byteIdentical': compatible, 'baselineFiles': len(trees[0]), 'candidateFiles': len(trees[1]),
                'baselineDigest': hashlib.sha256(json.dumps(trees[0], separators=(',', ':')).encode()).hexdigest(),
                'candidateDigest': hashlib.sha256(json.dumps(trees[1], separators=(',', ':')).encode()).hexdigest(),
                'comparison': 'File names and SHA-256 of every file, without importing or interpreting assets.'}
        links.append(entry); check('baseline_dependency_equivalence_' + name, compatible)
    archive = read(ROOT / declared['candidateArchiveManifest']['path']); archive_path = ROOT / archive['archive']['path']
    check('candidate_archive_identity', archive['nativeSourceManifestDigest'] == expected_candidate
          and len(archive['files']) == 281 and fp(archive_path) == archive['archive'], files=len(archive['files']))
    mismatched_archive_inputs = [path for path, digest in archive['files'].items() if sha(ROOT / path) != digest]
    check('all_frozen_archive_inputs_current', not mismatched_archive_inputs, mismatched=mismatched_archive_inputs)
    archived = {}
    with tarfile.open(archive_path, 'r:gz') as stream:
        for member in stream.getmembers():
            if member.isfile(): archived[member.name] = hashlib.sha256(stream.extractfile(member).read()).hexdigest()
    check('archived_bytes_match_manifest', archived == archive['files'], archivedFiles=len(archived))
    command = ['python', '-B', 'scripts/review-native-global-cost-window.py', '--check-protocol',
               (PERF / 'declaration.json').relative_to(ROOT).as_posix()]
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    checker = json.loads(result.stdout) if result.returncode == 0 else None
    check('retained_protocol_contract_checker', result.returncode == 0 and checker == read(PERF / 'protocol-check.json'),
          command=command, exitCode=result.returncode, stdout=result.stdout, stderr=result.stderr)
    node = subprocess.check_output(['node', '--version'], text=True).strip()
    failed = [check for check in checks if not check['satisfied']]
    receipt = {'schema': 'logos-engine.native-cost-static-preflight.v1', 'recordedAt': now(), 'startedAt': started,
        'status': 'static_inputs_checked' if not failed else 'static_input_review_failed', 'measurementExecuted': False,
        'baselineCheckout': str(BASE), 'candidateCheckout': str(ROOT), 'nodeVersion': node,
        'checkedCount': len(checks), 'checks': checks, 'unsatisfied': failed,
        'declaration': fp(PERF / 'declaration.json'), 'traces': traces, 'dependencyLinks': links,
        'protocolCheck': fp(PERF / 'protocol-check.json'), 'readinessCreated': False,
        'isolationChecked': False, 'functionalReadinessChecked': False,
        'generator': fp(Path(__file__).resolve()),
        'adaptedFrom': fp(ROOT / 'docs/migration/lot3h-evidence/check-cost-static-inputs.py'),
        'candidateFreeze': fp(CANDIDATE_MANIFEST),
        'preparationTool': fp(ROOT / 'docs/migration/lot3i-evidence/prepare-cost-protocol.py'),
        'qualification': 'Independent static inventory, archive, fingerprint, AST and dependency inspection only. '
            'The retained protocol checker performs no measurement. No runtime, worker, game, replay, test or build was started. '
            'This static receipt does not assert final functional readiness or isolation. '
            'The owner must finish actual campaign/contribution/browser work, stop preview and all compute jobs, and bind final readiness before the official window. '
            'This checker anticipates neither a synthetic-only scope nor a new game result. Any selected case must retain any existing cumulative clock and be qualified by completed receipts.'}
    with output_path.open('x') as stream: stream.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'status': receipt['status'], 'checkedCount': len(checks), 'unsatisfied': [c['name'] for c in failed],
                      'measurementExecuted': False, 'readinessCreated': False, 'receipt': fp(output_path)}))
    if failed: raise SystemExit(1)

if __name__ == '__main__': main()
