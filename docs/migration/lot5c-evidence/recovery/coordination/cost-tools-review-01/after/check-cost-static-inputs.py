#!/usr/bin/env python3
"""Inspect finalized lot 5C cost inputs without starting measured work.

The default receipt belongs to the future integrated 5C window. A separate
declaration may be selected with --performance-directory; existing receipts
are never replaced. The declared baseline capture bounds external attribution
paths before measurement; no post-measurement I/O correction is assumed.
Functional readiness, cross-thread coordination and isolation remain separate.
"""
# Copied and adapted from docs/migration/lot5b-evidence/check-cost-static-inputs.py.
# Direct 5B source SHA-256: 024c23aad5bae4b666cd2e47226b396a937a658a84a0d3cd927fcd1b9fa14cc1.
# No predecessor measurements or outcomes are reused.
from __future__ import annotations
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/migration/lot5c-evidence'
DOMAIN_REVIEW = EVIDENCE / 'recovery/coordination/cost-domain-source-review.json'
SOURCE_PATH_LIST = EVIDENCE / 'recovery/coordination/cost-source-evidence-paths.json'
ACQUISITION_DOMAIN = {
    'acquisitionMode': 'passive_nonadmitted_source_binding', 'contextAdmission': False,
    'core': None, 'methods': [], 'attentionMutation': False, 'nativeAcquisitionIncomplete': False,
    'recordOutsideOfficialBoundary': None,
    'recordAtOfficialBoundary': {'status': 'scope_changed_preserving_conditional_methods',
                                'evidence': ['before.observation_ref', 'after.observation_ref']},
    'recordPayloadKeys': ['status', 'evidence'],
    'officialBoundaryPredicate': 'before.level_epoch != after.level_epoch or after.levels_completed > before.levels_completed',
    'factCoverage': 'One exact passive source fact for each actually captured nonnull boundary return; no fact for a null return. sourceCallIndices covers every acquired return; sourceEventCallIndices is exactly the ordered nonnull subset.',
}
SOURCES = ["src/logos-engine/v6-native-runtime.ts", "src/logos-engine/v6-observed-binding.ts", "src/logos-engine/v6-observed-binding-state.ts", "src/logos-engine/v6-object-binding-common.ts", "src/logos-engine/v6-object-binding-geometry.ts", "src/logos-engine/v6-object-binding-identity.ts", "src/logos-engine/v6-object-binding-planning.ts", "src/logos-engine/v6-object-binding-reception.ts", "src/logos-engine/v6-object-binding-tracker.ts", "src/logos-engine/v6-knowledge-store.ts", "src/logos-engine/kernel.ts"]
HISTORY = ROOT / 'docs/migration/lot3h-evidence/performance'
EXPECTED_TOOLS = [
    'scripts/run-native-cost-window.py', 'scripts/measure-native-loop-costs.mjs',
    'scripts/compare-native-loop-costs.mjs', 'scripts/compare-native-cost-cohorts.mjs',
    'scripts/review-native-cost-consolidation.py', 'scripts/review-native-global-cost-window.py',
    'scripts/review-native-global-cost-budget.py',
]


def require(condition, message):
    if not condition:
        raise ValueError(message)

def validate_source_coverage(fixture, attribution):
    coverage, points = attribution['sourceFactCoverage'], attribution['points']
    expected = [(form['case'], form['form'], index) for form in fixture['forms']
                for index in range(len(form['candidate']['requests']) + len(form['candidate']['inspection']))]
    require([(row['case'], row['form'], row['pointIndex']) for row in coverage] == expected
            and [(row['case'], row['form'], row['pointIndex']) for row in points] == expected,
            'Every ordered capture/inspection must have exactly one source-fact coverage row')
    for form in fixture['forms']:
        identity = (form['case'], form['form'])
        rows = [row for row in coverage if (row['case'], row['form']) == identity]
        observed = [row for row in points if (row['case'], row['form']) == identity]
        sequences = [row['sequence'] for row in form['candidate']['requests']] + [form['candidate']['actions']] * len(form['candidate']['inspection'])
        event_indices = []
        for index, (row, point, sequence) in enumerate(zip(rows, observed, sequences)):
            require(set(row) == {'case', 'form', 'pointIndex', 'acquiredReturns', 'persistedSourceFacts', 'sourceCallIndices', 'sourceEventCallIndices'},
                    'Unknown or missing source coverage field')
            require(all(type(value) is int and value >= 0 for value in (row['pointIndex'], point['pointIndex'], sequence, point['sequence'], row['acquiredReturns'], row['persistedSourceFacts']))
                    and row['pointIndex'] == point['pointIndex'] == index
                    and row['acquiredReturns'] == point['sequence'] == sequence,
                    'Source coverage counters must equal the actual ordered request sequence')
            require(type(row['sourceCallIndices']) is list and all(type(value) is int for value in row['sourceCallIndices'])
                    and row['sourceCallIndices'] == list(range(row['acquiredReturns'])), 'Actual returns are omitted, duplicated or reordered')
            current = point['officialBoundarySourceCalls']
            require(type(current) is list and all(type(value) is int and 0 <= value < row['acquiredReturns'] for value in current)
                    and current == sorted(set(current)) and not set(current).intersection(event_indices), 'Invalid or repeated actual boundary call')
            event_indices.extend(current)
            require(type(row['sourceEventCallIndices']) is list and all(type(value) is int for value in row['sourceEventCallIndices'])
                    and event_indices == sorted(set(event_indices)) and row['sourceEventCallIndices'] == event_indices
                    and row['persistedSourceFacts'] == len(event_indices), 'Only the complete actual nonnull boundary subset may create facts')
            facts = [item for item in attribution['nodeAttributions'] if (item['case'], item['form'], item['pointIndex']) == (*identity, index)
                     and item['category'] == 'observedBinding_source_event_fact']
            require(all(type(item['pointIndex']) is int and type(item['sourceCallIndex']) is int and type(item['sourceEventCount']) is int and item['sourceEventCount'] == 1
                        and item['officialBoundary'] is True and item['sourceStatus'] == ACQUISITION_DOMAIN['recordAtOfficialBoundary']['status'] for item in facts)
                    and sorted(item['sourceCallIndex'] for item in facts) == current,
                    'Coverage must match the exact source event facts attributed at this point')
        require(rows[-1]['acquiredReturns'] == form['candidate']['actions'], 'Final coverage omits acquired source returns')

def exact(a, b):
    """JSON equality that cannot equate false/true with integer 0/1."""
    return json.dumps(a, sort_keys=True, separators=(',', ':'), allow_nan=False) == json.dumps(b, sort_keys=True, separators=(',', ':'), allow_nan=False)

def now(): return datetime.now(timezone.utc).isoformat()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, 'Duplicate JSON object key: ' + key)
        value[key] = item
    return value

def invalid_constant(value):
    raise ValueError('Non-finite JSON constant: ' + value)

def read(path): return json.loads(path.read_bytes(), object_pairs_hook=unique_object, parse_constant=invalid_constant)
def fp(path):
    data = path.read_bytes()
    return {'path': path.resolve().relative_to(ROOT).as_posix(),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}


def inventory(root):
    files = dict(sorted((path.relative_to(root).as_posix(), sha(path))
        for folder in ('src/logos-engine', 'src/runtime') for path in (root / folder).rglob('*')
        if path.is_file() and path.suffix in ('.ts', '.json', '.drm')))
    return {'fileCount': len(files),
            'digest': hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest(),
            'files': files}


def git(root, *args):
    return subprocess.check_output(['git', *args], cwd=root, text=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--performance-directory', type=Path, default=EVIDENCE / 'performance-integrated',
                        help='Finalized declaration directory inside the lot 5C evidence tree.')
    args = parser.parse_args()
    perf = args.performance_directory.resolve()
    if not perf.is_relative_to(EVIDENCE.resolve()):
        raise ValueError('The static receipt must stay inside lot5c-evidence')
    output_path = perf / 'static-preflight.json'
    if output_path.exists():
        raise FileExistsError(output_path)
    names = ['declaration.json', 'protocol-check.json', 'global-budget-policy.json',
             'preparation.json', 'cases.json', 'comparison-policy.json']
    missing = [str(perf / name) for name in names if not (perf / name).is_file()]
    if missing:
        raise ValueError('Finalize the real source-bound protocol first: ' + ', '.join(missing))
    declared = read(perf / 'declaration.json')
    policy = read(perf / 'global-budget-policy.json')
    prep = read(perf / 'preparation.json')
    cases = read(perf / 'cases.json')
    old = read(HISTORY / 'declaration.json')
    base = Path(prep['baselineCheckout']).resolve()
    candidate_manifest_path = ROOT / declared['candidateManifest']['path']
    candidate_freeze = read(candidate_manifest_path)
    started = now()
    checks = []

    def check(name, predicate, **detail):
        checks.append({'name': name, 'satisfied': bool(predicate), **detail})

    check('direct_5b_derivation_unchanged', sha(ROOT / 'docs/migration/lot5b-evidence/check-cost-static-inputs.py')
          == '024c23aad5bae4b666cd2e47226b396a937a658a84a0d3cd927fcd1b9fa14cc1')
    check('distinct_checkouts', ROOT.resolve() != base)
    check('declared_checkouts', prep['baselineCheckout'] == str(base)
          and prep['candidateCheckout'] == str(ROOT))
    check('baseline_published_commit', git(base, 'rev-parse', 'HEAD') == policy['baseline']['commit']
          and type(policy['baseline']['siteVersion']) is int and policy['baseline']['siteVersion'] > 0,
          commit=git(base, 'rev-parse', 'HEAD'), siteVersion=policy['baseline']['siteVersion'])
    check('baseline_native_worktree_clean', not git(base, 'status', '--porcelain', '--',
          'src/logos-engine', 'src/runtime'))
    check('distinct_native_digests', declared['nativeDigests']['baseline'] != declared['nativeDigests']['candidate']
          and all(re.fullmatch(r'[0-9a-f]{64}', value) for value in declared['nativeDigests'].values()))
    for role, checkout in [('baseline', base), ('candidate', ROOT)]:
        manifest = read(ROOT / declared[role + 'Manifest']['path'])
        actual = inventory(checkout)
        identity = policy[role]
        check(role + '_actual_native_inventory', manifest == actual
              and actual['digest'] == identity['nativeDigest'] and actual['fileCount'] == identity['nativeFiles'],
              digest=actual['digest'], fileCount=actual['fileCount'])
        check(role + '_declared_native_identity', declared['nativeDigests'][role] == actual['digest']
              and declared[role] == policy[role] == prep[role])
        versions = re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]",
                              (checkout / 'src/logos-engine/v6-native-runtime.ts').read_text())
        check(role + '_actual_version', versions == [identity['nativeVersion']]
              and re.fullmatch(r'\d+\.\d+\.\d+', identity['nativeVersion']), versions=versions)
    record_keys = ['protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy', 'baselineManifest',
                   'candidateManifest', 'candidateArchiveManifest', 'globalDecisionTool', 'globalCalculationTool']
    for key in record_keys:
        check('declared_fingerprint_' + key, fp(ROOT / declared[key]['path']) == declared[key])
    retained = declared['officialTools'] + [declared['globalDecisionTool'], declared['globalCalculationTool']]
    prior_tools = old['officialTools'] + [old['globalDecisionTool'], old['globalCalculationTool']]
    check('exact_seven_historical_tools', [item['path'] for item in retained] == EXPECTED_TOOLS
          and [item['path'] for item in prior_tools] == EXPECTED_TOOLS
          and prep['retainedTools'] == retained, count=len(retained))
    for record in retained:
        previous = next(item for item in prior_tools if item['path'] == record['path'])
        check('unchanged_tool_' + record['path'], fp(ROOT / record['path']) == record == previous)
    for name in ('cases.json', 'comparison-policy.json'):
        check('historical_input_' + name, (perf / name).read_bytes() == (HISTORY / name).read_bytes(),
              sha256=sha(perf / name))
    check('same_measurement_runner', sha(base / 'scripts/measure-native-loop-costs.mjs')
          == sha(ROOT / 'scripts/measure-native-loop-costs.mjs'))
    original = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/'
    for suffix in ('laya_proto/common_frontier_policy.drm.json', 'morphology_policy/strategy.drm'):
        path = original + suffix
        check('same_source_declaration_' + suffix, sha(base / path) == sha(ROOT / path), sha256=sha(ROOT / path))
    traces = []
    for case in cases['cases']:
        for role, checkout in [('baseline', base), ('candidate', ROOT)]:
            path = checkout / case['trace']
            digest = sha(path)
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
    check('declared_order_and_cohorts', declared['plannedOrder'] == policy['plannedOrder'] == ['A1', 'B1', 'B2', 'A2']
          and declared['cohorts'] == policy['cohorts'] == 2
          and declared['sessionsPerCaseVersionCohort'] == policy['sessionsPerCaseVersionCohort'] == 4
          and policy['caseIds'] == ['STCK', 'SMLP']
          and declared['globalBudgetCases'] == 2 and declared['diagnosticMetrics'] == 16)
    counts = {'measuredSessions': len(cases['cases']) * cases['rounds'] * 2 * 2,
              'measuredActions': sum(case['actions'] for case in cases['cases']) * cases['rounds'] * 2 * 2,
              'excludedWarmupSessions': len(cases['cases']) * 2 * 2,
              'excludedWarmupActions': sum(case['warmupActions'] for case in cases['cases']) * 2 * 2}
    check('cohort_counts_calculated_from_cases', list(counts.values()) == [32, 400, 8, 24]
          and all(type(declared[key]) is int and type(policy[key]) is int and declared[key] == policy[key] == value for key, value in counts.items()), **counts)
    check('strict_per_game_global_gate', policy['globalStage'] == 'session_elapsed'
          and policy['statistic'] == 'pooled median of complete measured-session durations per tested case'
          and policy['relativeIncreaseLimit'] == declared['relativeGlobalBudget'] == 0.1
          and policy['comparison'] == declared['globalComparison'] == 'strictly_less_than'
          and policy['allCasesMustPass'] is declared['allCasesMustPass'] is True
          and policy['crossCaseCompensation'] is declared['crossCaseCompensation'] is False
          and policy['phaseOverrunsMayBeAccepted'] is True and policy['phasesAndP95RemainVisible'] is True
          and declared['phaseOverrunsBlockAcceptance'] is False
          and type(policy['excludedMeasuredSessions']) is int and type(policy['excludedOutliers']) is int
          and policy['excludedMeasuredSessions'] == policy['excludedOutliers'] == 0)
    check('finalization_is_explicit', declared['status'] == 'declared_before_official_window'
          and declared['noOfficialWindowAtDeclaration'] is True and declared['functionalReadinessNotAnticipated'] is True
          and prep['status'] == 'source_freezes_verified_not_functional_readiness' and prep['measurementExecuted'] is False
          and all(prep[key] == declared[key] for key in ('baselineManifest', 'candidateManifest', 'candidateArchiveManifest')))
    check('declared_chronology', datetime.fromisoformat(prep['preparedAt']) == datetime.fromisoformat(policy['declaredAt'])
          <= datetime.fromisoformat(declared['recordedAt']) <= datetime.fromisoformat(declared['finalizedAt'])
          <= datetime.fromisoformat(started), finalizedAt=declared['finalizedAt'])
    relative_perf = perf.relative_to(ROOT)
    for name in ('cases.json', 'comparison-policy.json', 'protocol.md'):
        destination = base / relative_perf / name
        check('baseline_input_copy_' + name, not destination.exists() or destination.read_bytes() == (perf / name).read_bytes(),
              state='present_and_identical' if destination.exists() else 'absent_runner_will_copy')
    output_names = ['window.json', 'combined-comparison.json', 'consolidation-review.json', 'global-budget-decision.json']
    output_names += [f'cohort{c}/comparison.json' for c in (1, 2)]
    output_names += [f'cohort{c}/{name}.{extension}' for c in (1, 2) for name in ('baseline', 'after') for extension in ('json', 'log')]
    existing = [str(path) for directory in (perf, base / relative_perf) for name in output_names if (path := directory / name).exists()]
    check('exclusive_measurement_outputs_absent', not existing, existing=existing)
    links = []
    for name in ('node_modules', 'public/vendor/pyodide'):
        path, candidate_path = base / name, ROOT / name
        entry = {'path': str(path), 'candidatePath': str(candidate_path), 'isSymlink': path.is_symlink(),
                 'target': str(path.resolve()), 'targetExists': path.exists(), 'candidateExists': candidate_path.exists(),
                 'sameTargetAsCandidate': path.resolve() == candidate_path.resolve()}
        compatible = entry['targetExists'] and entry['sameTargetAsCandidate']
        if not compatible and path.is_dir() and candidate_path.is_dir():
            trees = [dict(sorted((p.relative_to(folder).as_posix(), sha(p))
                     for p in folder.rglob('*') if p.is_file())) for folder in (path, candidate_path)]
            compatible = trees[0] == trees[1] and bool(trees[0])
            entry['copiedTree'] = {'byteIdentical': compatible, 'baselineFiles': len(trees[0]), 'candidateFiles': len(trees[1]),
                'baselineDigest': hashlib.sha256(json.dumps(trees[0], separators=(',', ':')).encode()).hexdigest(),
                'candidateDigest': hashlib.sha256(json.dumps(trees[1], separators=(',', ':')).encode()).hexdigest(),
                'baselineOnly': sorted(trees[0].keys() - trees[1].keys()),
                'candidateOnly': sorted(trees[1].keys() - trees[0].keys()),
                'changed': sorted(key for key in trees[0].keys() & trees[1].keys() if trees[0][key] != trees[1][key]),
                'comparison': 'Every file name and SHA-256, including generated caches; no asset was imported or interpreted.'}
        links.append(entry)
        check('baseline_dependency_equivalence_' + name, compatible)
    archive = read(ROOT / declared['candidateArchiveManifest']['path'])
    archive_path = ROOT / archive['archive']['path']
    check('candidate_archive_identity', archive['nativeSourceManifestDigest'] == candidate_freeze['digest']
          and archive['baseCommit'] == policy['candidate']['sourceBaseCommit']
          and all(archive['files'].get(path) == digest for path, digest in candidate_freeze['files'].items())
          and fp(archive_path) == archive['archive'], files=len(archive['files']))
    mismatched_archive_inputs = [path for path, digest in archive['files'].items()
                                 if not (ROOT / path).is_file() or sha(ROOT / path) != digest]
    check('all_frozen_archive_inputs_current', not mismatched_archive_inputs, mismatched=mismatched_archive_inputs)
    archived = {}
    with tarfile.open(archive_path, 'r:gz') as stream:
        for member in stream.getmembers():
            if member.isfile():
                archived[member.name] = hashlib.sha256(stream.extractfile(member).read()).hexdigest()
    check('archived_bytes_match_manifest', archived == archive['files'], archivedFiles=len(archived))
    command = [sys.executable, '-B', 'scripts/review-native-global-cost-window.py', '--check-protocol',
               (perf / 'declaration.json').relative_to(ROOT).as_posix()]
    result = subprocess.run(command, cwd=ROOT, text=True, capture_output=True)
    checker = json.loads(result.stdout) if result.returncode == 0 else None
    check('retained_protocol_contract_checker', result.returncode == 0 and checker == read(perf / 'protocol-check.json'),
          command=command, exitCode=result.returncode, stdout=result.stdout, stderr=result.stderr)
    owner_contract_record, owner_tools = None, None
    qualification = declared.get('ownerCostQualification')
    if qualification is not None:
        contract_path = (ROOT / qualification['contractPath']).resolve()
        contract = read(contract_path)
        owner_contract_record, owner_tools = fp(contract_path), qualification['tools']
        check('owner_contract_declared_inside_window', contract_path.parent == perf
              and qualification['schema'] == 'logos-engine.lot5c-owner-cost-qualification.v1'
              and contract['schema'] == 'logos-engine.lot5c-owner-cost-contract.v2'
              and contract['lot'] == '5C' and contract['performanceDirectory'] == relative_perf.as_posix()
              and contract['declaration'] == fp(perf / 'declaration.json')
              and contract['tools'] == owner_tools)
        domain = read(DOMAIN_REVIEW)
        domain_record, source_paths_record = fp(DOMAIN_REVIEW), fp(SOURCE_PATH_LIST)
        check('owner_source_domain_declared_exactly', exact(contract['domainReview'], domain_record)
              and exact(contract['sourceEvidencePaths'], source_paths_record)
              and exact(contract['acquisitionDomain'], ACQUISITION_DOMAIN)
              and domain['schema'] == 'logos-engine.lot5c.cost-domain-source-review.v1'
              and domain['status'] == 'superseded_before_capture'
              and all(domain[key] is False for key in ['functionalCapturesStarted', 'costMeasurementsStarted', 'executionFailureClaimed'])
              and exact(domain['revisedDomain'], ACQUISITION_DOMAIN)
              and exact(read(SOURCE_PATH_LIST), SOURCES) and exact(domain['sourceEvidencePaths'], SOURCES)
              and any(exact(item, source_paths_record) for item in domain['evidenceInputs'])
              and all(type(item['bytes']) is int and exact(fp(ROOT / item['path']), item) for item in domain['evidenceInputs'])
              and exact(prep['ownerSourceDomain'], {'domainReview': domain_record, 'sourceEvidencePaths': source_paths_record})
              and datetime.fromisoformat(domain['recordedAt']) <= datetime.fromisoformat(declared['finalizedAt']))
        check('owner_contract_generator_and_derivation',
              contract['generator']['path'] == 'docs/migration/lot5c-evidence/finalize-owner-cost-contract.py'
              and exact(fp(ROOT / contract['generator']['path']), contract['generator'])
              and contract['derivedFrom']['path'] == 'docs/migration/lot5b-evidence/finalize-owner-cost-contract.py'
              and contract['derivedFrom']['sha256'] == '58fd6f433ee6043c3cd24f3c763f4ede265c4b2e60374a9916807bccc68c2997'
              and exact(fp(ROOT / contract['derivedFrom']['path']), contract['derivedFrom']))
        check('owner_tools_unchanged', set(owner_tools) == {'consolidator', 'reviewer'}
              and owner_tools['consolidator']['path'] == 'docs/migration/lot5c-evidence/consolidate-owner-costs.mjs'
              and owner_tools['reviewer']['path'] == 'docs/migration/lot5c-evidence/review-owner-costs.py'
              and all(fp(ROOT / item['path']) == item for item in owner_tools.values()))
        expectation = contract['structuralExpectation']
        check('owner_structural_rule_fixed', expectation == {
            'ownerId': 'public_observed_binding', 'programId': 'v6.observed_binding.choose',
            'installedNodeIds': ['family_state:public_observed_binding', 'family_activation:public_observed_binding', 'program:v6.observed_binding.choose'],
            'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes',
                             'final.nodeCount', 'final.graphRevision'],
            'mode': 'predeclared_functional_fixture',
            'qualification': 'functional_structure_frozen_before_measurement'})
        fixture = read(ROOT / contract['structuralFixture']['path'])
        attribution = read(ROOT / fixture['attribution']['path'])
        check('owner_attribution_source_domain', exact(attribution['domainReview'], domain_record)
              and attribution['acquisitionMode'] == ACQUISITION_DOMAIN['acquisitionMode']
              and exact(attribution['acceptedBoundaryReturn'], ACQUISITION_DOMAIN['recordAtOfficialBoundary'])
              and all(any(exact(item, required) for item in attribution['inputs']) for required in [domain_record, source_paths_record]))
        coverage_error = None
        try:
            validate_source_coverage(fixture, attribution)
        except (ValueError, KeyError, TypeError, IndexError) as error:
            coverage_error = str(error)
        check('owner_exact_source_fact_coverage', coverage_error is None, error=coverage_error)
        baseline_capture_record = fixture['captures']['baseline']['receipt']
        baseline_capture = read(ROOT / baseline_capture_record['path'])
        baseline_capture_inputs = baseline_capture['inputsBefore']
        baseline_external = [item for item in baseline_capture_inputs if Path(item['path']).is_absolute()]
        baseline_whitelist = {item['path']: item for item in baseline_external}
        check('owner_baseline_capture_io_predeclared',
              fp(ROOT / baseline_capture_record['path']) == baseline_capture_record
              and baseline_capture['schema'] == 'logos-engine.lot5c-owner-cost-functional-capture-receipt.v1'
              and baseline_capture['status'] == 'captured_functional_structure'
              and baseline_capture['role'] == 'baseline'
              and Path(baseline_capture['checkout']).is_absolute()
              and Path(baseline_capture['checkout']).resolve(strict=True) == base != ROOT.resolve(strict=True)
              and baseline_capture['nativeDigest'] == declared['nativeDigests']['baseline']
              and baseline_capture['report'] == fixture['captures']['baseline']['report']
              and baseline_capture['generator'] == fixture['captureTool']
              and baseline_capture_inputs == baseline_capture['inputsAfter']
              and isinstance(baseline_capture_inputs, list) and bool(baseline_capture_inputs)
              and len(baseline_capture_inputs) == len({item['path'] for item in baseline_capture_inputs})
              and baseline_capture['nativeSourceUnchanged'] is True
              and baseline_capture['inputsUnchanged'] is True
              and baseline_capture['generatorUnchanged'] is True and baseline_capture['failures'] == []
              and bool(baseline_external) and len(baseline_external) == len(baseline_whitelist)
              and all(Path(item['path']).resolve(strict=True) != base
                      and Path(item['path']).resolve(strict=True).is_relative_to(base)
                      for item in baseline_external)
              and datetime.fromisoformat(baseline_capture['startedAt'])
                  <= datetime.fromisoformat(baseline_capture['finishedAt'])
                  <= datetime.fromisoformat(attribution['recordedAt']),
              baselineCheckout=str(base), externalPaths=[item['path'] for item in baseline_external])
        structural_records = [contract['structuralFixture'], fixture['cases'], fixture['captureTool'],
                              fixture['attribution'], attribution['generator'], *attribution['inputs']]
        structural_records += [item for side in ('baseline', 'candidate')
                               for item in fixture['captures'][side].values()]
        def structural_fingerprint(record):
            path = (ROOT / record['path']).resolve(strict=True)
            if not Path(record['path']).is_absolute():
                if path == ROOT or not path.is_relative_to(ROOT):
                    raise ValueError('Relative functional structure input escapes this checkout')
                return fp(path)
            if record != baseline_whitelist.get(record['path']):
                raise ValueError('External attribution input is not exactly in the predeclared baseline capture')
            if path == base or not path.is_relative_to(base):
                raise ValueError('External attribution input escapes its frozen baseline checkout')
            return {'path': record['path'], 'sha256': sha(path), 'bytes': path.stat().st_size}
        check('owner_baseline_capture_inputs_unchanged',
              all(structural_fingerprint(item) == item for item in baseline_capture_inputs))
        check('owner_attribution_external_inputs_exact',
              len(attribution['inputs']) == len({item['path'] for item in attribution['inputs']})
              and all(item == baseline_whitelist.get(item['path']) for item in attribution['inputs']
                      if Path(item['path']).is_absolute()))
        check('functional_structure_fingerprints',
              all(structural_fingerprint(item) == item for item in structural_records))
        check('functional_structure_identity',
              fixture['schema'] == 'logos-engine.lot5c-owner-cost-structural-fixture.v1'
              and attribution['schema'] == 'logos-engine.lot5c-owner-cost-structural-attribution.v1'
              and fixture['status'] == attribution['status'] == 'qualified_functional_structure'
              and fixture['nativeDigests'] == attribution['nativeDigests'] == declared['nativeDigests']
              and fixture['cases'] == declared['cases']
              and [(row['case'], row['form']) for row in fixture['forms']] ==
                  [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')]
              and attribution['formsSha256'] == hashlib.sha256(json.dumps(fixture['forms'], sort_keys=True,
                  separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest()
              and type(attribution['checkedCount']) is int and attribution['checkedCount'] == len(attribution['checks']) > 0
              and all(row['passed'] is True for row in attribution['checks']))
        for role in ('baseline', 'candidate'):
            captured = read(ROOT / fixture['captures'][role]['receipt']['path'])
            check('owner_capture_source_domain_' + role, captured['ownerId'] == 'public_observed_binding'
                  and captured['acquisitionMode'] == ACQUISITION_DOMAIN['acquisitionMode']
                  and exact(captured['domainReview'], domain_record)
                  and all(type(captured[key]) is int and captured[key] == 0 for key in ['measuredCostSessions', 'timingReportsRead', 'timingMetricsProduced'])
                  and all(any(exact(item, required) for item in captured['inputsBefore']) for required in [domain_record, source_paths_record])
                  and datetime.fromisoformat(domain['recordedAt']) <= datetime.fromisoformat(captured['startedAt']))
        check('functional_structure_predeclared', datetime.fromisoformat(attribution['recordedAt'])
              <= datetime.fromisoformat(fixture['recordedAt'])
              <= datetime.fromisoformat(contract['declaredAt']))
        source_inventory = read(ROOT / contract['ownerInventory']['path'])
        check('owner_source_inventory_bound', fp(ROOT / contract['ownerInventory']['path']) == contract['ownerInventory']
              and source_inventory['schema'] == 'logos-engine.lot5c-owner-cost-source-inventory.v1'
              and source_inventory['nativeDigests'] == declared['nativeDigests']
              and source_inventory['programScope'] == 'family-installed programs'
              and [item['path'] for item in contract['sourceEvidence']] == SOURCES
              and all(fp(ROOT / item['path']) == item for item in contract['sourceEvidence']))
        for key, addition in [('owners', 'public_observed_binding'), ('programs', 'v6.observed_binding.choose')]:
            a, b = source_inventory[key]['baseline'], source_inventory[key]['candidate']
            check('owner_inventory_exact_addition_' + key,
                  type(a) is list and type(b) is list and all(type(value) is str and bool(value) for value in a + b)
                  and len(a) == len(set(a)) and len(b) == len(set(b))
                  and set(b) - set(a) == (set() if addition is None else {addition}) and not set(a) - set(b))
        check('owner_inventory_existing_order_unchanged',
              [owner for owner in source_inventory['owners']['candidate'] if owner != 'public_observed_binding'] == source_inventory['owners']['baseline']
              and [row for row in source_inventory['sourceInventory']['candidate']['installations'] if row['owner'] != 'public_observed_binding']
                  == source_inventory['sourceInventory']['baseline']['installations'])
        check('owner_contract_chronology', datetime.fromisoformat(declared['finalizedAt'])
              <= datetime.fromisoformat(contract['declaredAt']) <= datetime.fromisoformat(started)
              and datetime.fromisoformat(source_inventory['recordedAt']) <= datetime.fromisoformat(contract['declaredAt']))
        check('owner_outputs_absent', not any((perf / name).exists() for name in (
            'owner-growth-comparison.json', 'owner-growth-review.json',
            'aggregation-failure.json', 'aggregation-failure.log')))
    node = subprocess.check_output(['node', '--version'], text=True).strip()
    failed = [item for item in checks if not item['satisfied']]
    superseded = perf / 'superseded-before-measurement.json'
    receipt = {'schema': 'logos-engine.native-cost-static-preflight.v1', 'recordedAt': now(), 'startedAt': started,
        'status': 'static_inputs_checked' if not failed else 'static_input_review_failed', 'measurementExecuted': False,
        'baselineCheckout': str(base), 'candidateCheckout': str(ROOT), 'nodeVersion': node,
        'checkedCount': len(checks), 'checks': checks, 'unsatisfied': failed,
        'declaration': fp(perf / 'declaration.json'), 'traces': traces, 'dependencyLinks': links,
        'protocolCheck': fp(perf / 'protocol-check.json'), 'readinessCreated': False,
        'isolationChecked': False, 'functionalReadinessChecked': False,
        'generator': fp(Path(__file__).resolve()),
        'adaptedFrom': fp(ROOT / 'docs/migration/lot5b-evidence/check-cost-static-inputs.py'),
        'historicalOrigin': fp(ROOT / 'docs/migration/lot3h-evidence/check-cost-static-inputs.py'),
        'candidateFreeze': fp(candidate_manifest_path),
        'preparationTool': fp(ROOT / 'docs/migration/lot5c-evidence/prepare-cost-protocol.py'),
        'supersession': fp(superseded) if superseded.is_file() else None,
        'qualification': 'Static inventory, archive, fingerprint, AST and dependency inspection only. '
            'The retained protocol checker performs no measurement. No runtime worker, game, replay, test or build was started. '
            'Dependency gaps and cache differences are retained, not repaired or treated as equivalent. '
            'This receipt neither authorizes a superseded window nor asserts functional readiness, isolation or a game outcome. '
            'The owner must separately bind actual completed evidence and cross-thread coordination before any official window.'}
    if owner_contract_record is not None:
        receipt.update(ownerCostContract=owner_contract_record, ownerCostTools=owner_tools)
        receipt['ownerSourceDomain'] = {'domainReview': domain_record, 'sourceEvidencePaths': source_paths_record}
        receipt['ownerStructuralFixture'] = contract['structuralFixture']
        receipt['ownerStructuralExternalInputs'] = list({item['path']: item
            for item in [*structural_records, *baseline_capture_inputs]
            if Path(item['path']).is_absolute()}.values())
    with output_path.open('x') as stream:
        stream.write(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'status': receipt['status'], 'checkedCount': len(checks), 'unsatisfied': [c['name'] for c in failed],
                      'measurementExecuted': False, 'readinessCreated': False, 'receipt': fp(output_path)}))
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
