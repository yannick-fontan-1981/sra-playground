#!/usr/bin/env python3
"""Inspect finalized lot 6B cost inputs without starting measured work.

The default receipt belongs to the future integrated 6B window. A separate
declaration may be selected with --performance-directory; existing receipts
are never replaced. The declared baseline capture bounds external attribution
paths before measurement; no post-measurement I/O correction is assumed.
Functional readiness, cross-thread coordination and isolation remain separate.
"""
# Directly adapted from docs/migration/lot6a-evidence/check-cost-static-inputs.py.
# No predecessor measurements or outcomes are reused.
from __future__ import annotations
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
import struct
import math
from pathlib import Path
import re
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / 'docs/migration/lot6b-evidence'
HISTORY = ROOT / 'docs/migration/lot3h-evidence/performance'
EXPECTED_TOOLS = [
    'scripts/run-native-cost-window.py', 'scripts/measure-native-loop-costs.mjs',
    'scripts/compare-native-loop-costs.mjs', 'scripts/compare-native-cost-cohorts.mjs',
    'scripts/review-native-cost-consolidation.py', 'scripts/review-native-global-cost-window.py',
    'scripts/review-native-global-cost-budget.py',
]


def now(): return datetime.now(timezone.utc).isoformat()
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path): return json.loads(path.read_bytes())
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



def validate_common_value_attribution(attribution, receipts, fixture):
    """Validate emitted records; the pinned qualifier owns exhaustive graph traversal."""
    comparison = 'exact_except_attributed_trace_envelope_created'
    sources = ['src/logos-engine/v6-reasoning-memory.ts', 'src/logos-engine/v6-native-authority.ts']
    roles = ('baseline', 'candidate')

    def need(condition, message):
        if not condition:
            raise ValueError('Trace-created attribution: ' + message)

    def exact(left, right):
        if isinstance(left, bool) or isinstance(right, bool):
            return type(left) is type(right) and left == right
        if isinstance(left, (int, float)) and isinstance(right, (int, float)):
            return left == right
        if type(left) is not type(right):
            return False
        if isinstance(left, dict):
            return left.keys() == right.keys() and all(exact(left[key], right[key]) for key in left)
        if isinstance(left, list):
            return len(left) == len(right) and all(exact(a, b) for a, b in zip(left, right))
        return left == right

    def integer(value, minimum=0):
        return type(value) is int and minimum <= value <= 9007199254740991

    def millis(value):
        need(isinstance(value, str), 'timestamp must be a string')
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        need(parsed.tzinfo is not None and parsed.utcoffset().total_seconds() == 0
             and parsed.isoformat(timespec='milliseconds').replace('+00:00', 'Z') == value,
             'timestamp must use canonical UTC milliseconds')
        delta = parsed - datetime(1970, 1, 1, tzinfo=timezone.utc)
        result = delta.days * 86400000 + delta.seconds * 1000 + delta.microseconds // 1000
        need(integer(result), 'timestamp must be a nonnegative safe integer')
        return result

    def fingerprint(record):
        need(isinstance(record, dict) and set(record) == {'path', 'bytes', 'sha256'}
             and isinstance(record['path'], str) and bool(record['path'])
             and integer(record['bytes']) and isinstance(record['sha256'], str)
             and re.fullmatch(r'[0-9a-f]{64}', record['sha256']) is not None, 'invalid fingerprint')

    need(attribution['schema'] == 'logos-engine.lot6b-owner-cost-structural-attribution.v1'
         and attribution['status'] == 'qualified_functional_structure'
         and exact(attribution['failures'], []), 'qualification is not successful')
    need(set(receipts) == set(roles) and set(fixture['captures']) == set(roles)
         and exact(attribution['nativeDigests'], fixture['nativeDigests']), 'role/source binding differs')
    policy = attribution['commonValuePolicy']
    need(isinstance(policy, dict) and set(policy) == {'comparison', 'permittedMetadataDifference',
         'identityValueAttributions', 'unattributedDifferencesAllowed', 'traceCreatedAttribution'}, 'policy keys differ')
    need(exact({key: value for key, value in policy.items() if key != 'traceCreatedAttribution'}, {
         'comparison': comparison, 'permittedMetadataDifference': 'origin.source_digest',
         'identityValueAttributions': [], 'unattributedDifferencesAllowed': 0}), 'only the named policy is accepted')
    temporal = policy['traceCreatedAttribution']
    need(isinstance(temporal, dict) and set(temporal) == {'nodeComponent', 'path', 'sourceClock', 'sourceFiles',
         'captureWindows', 'stabilityKey', 'records', 'allOtherFieldsExact'}, 'temporal policy keys differ')
    need(exact({key: value for key, value in temporal.items() if key not in ('captureWindows', 'records')}, {
         'nodeComponent': 'native_reasoning_trace', 'path': '/value/root/members/created/bits',
         'sourceClock': 'Date.now() / 1000', 'sourceFiles': sources,
         'stabilityKey': ['role', 'sessionId', 'nodeId'], 'allOtherFieldsExact': True}), 'temporal exception was broadened')
    inputs = attribution['inputs']
    need(isinstance(inputs, list), 'inputs must be listed')
    for record in inputs:
        fingerprint(record)
    need(len({record['path'] for record in inputs}) == len(inputs), 'duplicate input path')
    generator = attribution['generator']
    fingerprint(generator)
    need(generator['path'] == 'docs/migration/lot6b-evidence/qualify-cost-owner-graphs.mjs'
         and any(exact(generator, record) for record in inputs), 'qualifier is not bound')
    forms = fixture['forms']
    need([(form['case'], form['form']) for form in forms] ==
         [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')], 'functional forms differ')
    windows, sessions, expected_points = {}, {}, None
    for role in roles:
        receipt = receipts[role]
        need(receipt['schema'] == 'logos-engine.lot6b-owner-cost-functional-capture-receipt.v1'
             and receipt['status'] == 'captured_functional_structure' and receipt['role'] == role
             and receipt['nativeDigest'] == attribution['nativeDigests'][role]
             and exact(receipt['report'], fixture['captures'][role]['report'])
             and exact(receipt['generator'], fixture['captureTool']), 'capture role/source/report differs')
        need(exact(receipt['nativeInventoryBefore'], receipt['nativeInventoryAfter'])
             and receipt['nativeInventoryBefore']['digest'] == receipt['nativeDigest']
             and exact(receipt['inputsBefore'], receipt['inputsAfter'])
             and exact(receipt['generator'], receipt['generatorAfter'])
             and all(receipt[key] is True for key in ('nativeSourceUnchanged', 'inputsUnchanged', 'generatorUnchanged'))
             and exact(receipt['failures'], []), 'capture integrity differs')
        for record in fixture['captures'][role].values():
            fingerprint(record)
            need(any(exact(record, item) for item in inputs), 'capture receipt/report is absent from qualifier inputs')
        for path in sources:
            source = [record for record in inputs if record['path'] == path]
            need(len(source) == 1 and source[0]['sha256'] == receipt['nativeInventoryBefore']['files'][path],
                 'clock source is not bound to both captured native manifests: ' + path)
        start, finish = millis(receipt['startedAt']), millis(receipt['finishedAt'])
        need(start <= finish, 'capture interval is reversed')
        windows[role] = {'startedAt': receipt['startedAt'], 'finishedAt': receipt['finishedAt'],
                         'startMs': start, 'finishMs': finish}
        need(integer(receipt['sessionCount'], 1) and receipt['sessionCount'] == len(receipt['sessions']) == len(forms),
             'capture session count differs')
        session_map, point_keys = {}, []
        for session, form in zip(receipt['sessions'], forms):
            sid = 'lot6b-owner-cost-' + form['case'].lower() + '-' + form['form']
            need((session['case'], session['form'], session['sessionId']) == (form['case'], form['form'], sid)
                 and session['status'] == 'captured_functional_structure' and sid not in session_map,
                 'capture session identity differs')
            need(integer(session['captures'], 1) and integer(session['terminalInspections'])
                 and session['captures'] == len(session['shape']['requests'])
                 and session['terminalInspections'] == len(session['shape']['inspection'])
                 and exact(session['shape'], form[role]), 'session point counters differ')
            session_map[sid] = session
            point_keys.extend((form['case'], form['form'], index)
                              for index in range(session['captures'] + session['terminalInspections']))
        sessions[role] = session_map
        if expected_points is None:
            expected_points = point_keys
        need(point_keys == expected_points, 'roles cover different functional points')
    need(exact(temporal['captureWindows'], windows), 'policy windows differ from bound capture receipts')
    points = attribution['points']
    need(isinstance(points, list) and bool(points)
         and [(point['case'], point['form'], point['pointIndex']) for point in points] == expected_points,
         'point coverage is empty, omitted, duplicated or reordered')
    expected_coverage = []
    for point in points:
        need(integer(point['pointIndex']) and integer(point['baselineNodeCount'], 1)
             and integer(point['baselineDeltaCount']), 'common comparison counters are invalid')
        expected_coverage.append({**{key: point[key] for key in ('case', 'form', 'pointIndex')},
             'commonNodesCompared': point['baselineNodeCount'], 'commonDeltasCompared': point['baselineDeltaCount'],
             'comparison': comparison, 'unattributedDifferences': 0})
    need(exact(attribution['commonValueCoverage'], expected_coverage), 'common values lack exact complete point coverage')
    records = temporal['records']
    need(isinstance(records, list) and bool(records), 'temporal record register is empty')
    seen, pairs, represented = set(), {}, set()
    for record in records:
        need(isinstance(record, dict) and set(record) == {'role', 'sessionId', 'nodeId', 'bits', 'seconds',
             'milliseconds', 'createdAt', 'captureStartedAt', 'captureFinishedAt'}, 'record schema differs')
        role, sid, node_id = record['role'], record['sessionId'], record['nodeId']
        need(role in roles and isinstance(sid, str) and sid in sessions[role], 'record role/session is foreign')
        match = re.fullmatch(r'reasoning:trace:([1-9][0-9]*)', node_id) if isinstance(node_id, str) else None
        need(match is not None and integer(int(match[1]), 1), 'record does not name a real trace')
        key = (role, sid, node_id)
        need(key not in seen, 'duplicate or unstable role/session/trace')
        seen.add(key); represented.add((role, sid)); pairs.setdefault((sid, node_id), set()).add(role)
        bits = record['bits']
        need(isinstance(bits, str) and re.fullmatch(r'[0-9a-f]{16}', bits) is not None, 'invalid float64 bits')
        seconds = struct.unpack('>d', bytes.fromhex(bits))[0]
        ms = record['milliseconds']
        need(type(record['seconds']) in (int, float) and math.isfinite(seconds) and integer(ms)
             and record['seconds'] == seconds == ms / 1000 and math.floor(seconds * 1000 + 0.5) == ms,
             'record is not the exact finite millisecond clock encoding')
        window = windows[role]
        need(window['startMs'] <= ms <= window['finishMs'] and millis(record['createdAt']) == ms
             and record['captureStartedAt'] == window['startedAt']
             and record['captureFinishedAt'] == window['finishedAt'], 'record escapes its role capture interval')
    need(all(pair == set(roles) for pair in pairs.values()), 'a trace is missing its baseline/candidate pair')
    need(represented == {(role, sid) for role in roles for sid in sessions[role]}, 'a captured session has no trace records')
    # No trace-count formula: unique records cannot independently prove that no
    # trace was omitted. That guarantee remains in the fingerprinted qualifier's
    # complete common-node/delta traversal; graph bodies, origins, chains and
    # tickets are not reopened or normalized by this local record validator.
    return True

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--performance-directory', type=Path, default=EVIDENCE / 'performance-integrated',
                        help='Finalized declaration directory inside the lot 6B evidence tree.')
    args = parser.parse_args()
    perf = args.performance_directory.resolve()
    if not perf.is_relative_to(EVIDENCE.resolve()):
        raise ValueError('The static receipt must stay inside lot6b-evidence')
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

    check('distinct_checkouts', ROOT.resolve() != base)
    check('declared_checkouts', prep['baselineCheckout'] == str(base)
          and prep['candidateCheckout'] == str(ROOT))
    check('actual_6B_predecessor_and_candidate_versions',
          declared['baseline']['nativeVersion'] == '0.63.0' and declared['candidate']['nativeVersion'] == '0.64.0')
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
          and all(declared[key] == policy[key] == value for key, value in counts.items()), **counts)
    check('strict_per_game_global_gate', policy['globalStage'] == 'session_elapsed'
          and policy['statistic'] == 'pooled median of complete measured-session durations per tested case'
          and policy['relativeIncreaseLimit'] == declared['relativeGlobalBudget'] == 0.1
          and policy['comparison'] == declared['globalComparison'] == 'strictly_less_than'
          and policy['allCasesMustPass'] is declared['allCasesMustPass'] is True
          and policy['crossCaseCompensation'] is declared['crossCaseCompensation'] is False
          and policy['phaseOverrunsMayBeAccepted'] is True and policy['phasesAndP95RemainVisible'] is True
          and declared['phaseOverrunsBlockAcceptance'] is False
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
    check('owner_qualification_required_for_6B', qualification is not None)
    if qualification is not None:
        contract_path = (ROOT / qualification['contractPath']).resolve()
        contract = read(contract_path)
        owner_contract_record, owner_tools = fp(contract_path), qualification['tools']
        check('owner_contract_declared_inside_window', contract_path.parent == perf
              and qualification['schema'] == 'logos-engine.lot6b-owner-cost-qualification.v1'
              and contract['schema'] == 'logos-engine.lot6b-owner-cost-contract.v2'
              and contract['lot'] == '6B' and contract['performanceDirectory'] == relative_perf.as_posix()
              and contract['declaration'] == fp(perf / 'declaration.json')
              and contract['tools'] == owner_tools)
        check('owner_tools_unchanged', set(owner_tools) == {'consolidator', 'reviewer'}
              and owner_tools['consolidator']['path'] == 'docs/migration/lot6b-evidence/consolidate-owner-costs.mjs'
              and owner_tools['reviewer']['path'] == 'docs/migration/lot6b-evidence/review-owner-costs.py'
              and all(fp(ROOT / item['path']) == item for item in owner_tools.values()))
        expectation = contract['structuralExpectation']
        check('owner_structural_rule_fixed', expectation == {
            'ownerId': 'selected_rigid', 'programId': None,
            'installedNodeIds': ['family_state:selected_rigid', 'family_activation:selected_rigid'],
            'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes',
                             'final.nodeCount', 'final.graphRevision'],
            'mode': 'predeclared_functional_fixture',
            'qualification': 'functional_structure_frozen_before_measurement'})
        fixture = read(ROOT / contract['structuralFixture']['path'])
        attribution = read(ROOT / fixture['attribution']['path'])
        baseline_capture_record = fixture['captures']['baseline']['receipt']
        baseline_capture = read(ROOT / baseline_capture_record['path'])
        baseline_capture_inputs = baseline_capture['inputsBefore']
        baseline_external = [item for item in baseline_capture_inputs if Path(item['path']).is_absolute()]
        baseline_whitelist = {item['path']: item for item in baseline_external}
        check('owner_baseline_capture_io_predeclared',
              fp(ROOT / baseline_capture_record['path']) == baseline_capture_record
              and baseline_capture['schema'] == 'logos-engine.lot6b-owner-cost-functional-capture-receipt.v1'
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
              fixture['schema'] == 'logos-engine.lot6b-owner-cost-structural-fixture.v1'
              and attribution['schema'] == 'logos-engine.lot6b-owner-cost-structural-attribution.v1'
              and fixture['status'] == attribution['status'] == 'qualified_functional_structure'
              and fixture['nativeDigests'] == attribution['nativeDigests'] == declared['nativeDigests']
              and fixture['cases'] == declared['cases']
              and [(row['case'], row['form']) for row in fixture['forms']] ==
                  [('STCK', 'warmup'), ('STCK', 'measured'), ('SMLP', 'warmup'), ('SMLP', 'measured')]
              and attribution['formsSha256'] == hashlib.sha256(json.dumps(fixture['forms'], sort_keys=True,
                  separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest()
              and attribution['checkedCount'] == len(attribution['checks']) > 0
              and all(row['passed'] is True for row in attribution['checks']))
        check('functional_structure_predeclared', datetime.fromisoformat(attribution['recordedAt'])
              <= datetime.fromisoformat(fixture['recordedAt'])
              <= datetime.fromisoformat(contract['declaredAt']))
        capture_receipts = {'baseline': baseline_capture,
                            'candidate': read(ROOT / fixture['captures']['candidate']['receipt']['path'])}
        check('common_value_comparison_fully_bound',
              validate_common_value_attribution(attribution, capture_receipts, fixture))
        source_inventory = read(ROOT / contract['ownerInventory']['path'])
        check('owner_source_inventory_bound', fp(ROOT / contract['ownerInventory']['path']) == contract['ownerInventory']
              and source_inventory['schema'] == 'logos-engine.lot6b-owner-cost-source-inventory.v1'
              and source_inventory['nativeDigests'] == declared['nativeDigests']
              and source_inventory['programScope'] == 'family-installed programs'
              and sorted(item['path'] for item in contract['sourceEvidence']) == sorted(['src/logos-engine/v6-native-runtime.ts', 'src/logos-engine/v6-selected-rigid.ts', 'src/logos-engine/v6-selected-rigid-types.ts', 'src/logos-engine/v6-selected-rigid-geometry.ts', 'src/logos-engine/v6-selected-rigid-search.ts', 'src/logos-engine/v6-knowledge-store.ts', 'src/logos-engine/kernel.ts'])
              and all(fp(ROOT / item['path']) == item for item in contract['sourceEvidence']))
        for key, addition in [('owners', 'selected_rigid'), ('programs', None)]:
            a, b = source_inventory[key]['baseline'], source_inventory[key]['candidate']
            check('owner_inventory_exact_addition_' + key,
                  len(a) == len(set(a)) and len(b) == len(set(b))
                  and set(b) - set(a) == (set() if addition is None else {addition}) and not set(a) - set(b))
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
        'adaptedFrom': fp(ROOT / 'docs/migration/lot6a-evidence/check-cost-static-inputs.py'),
        'historicalOrigin': fp(ROOT / 'docs/migration/lot3h-evidence/check-cost-static-inputs.py'),
        'candidateFreeze': fp(candidate_manifest_path),
        'preparationTool': fp(ROOT / 'docs/migration/lot6b-evidence/prepare-cost-protocol.py'),
        'supersession': fp(superseded) if superseded.is_file() else None,
        'qualification': 'Static inventory, archive, fingerprint, AST and dependency inspection only. '
            'The retained protocol checker performs no measurement. No runtime worker, game, replay, test or build was started. '
            'Dependency gaps and cache differences are retained, not repaired or treated as equivalent. '
            'This receipt neither authorizes a superseded window nor asserts functional readiness, isolation or a game outcome. '
            'The owner must separately bind actual completed evidence and cross-thread coordination before any official window.'}
    if owner_contract_record is not None:
        receipt.update(ownerCostContract=owner_contract_record, ownerCostTools=owner_tools)
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
