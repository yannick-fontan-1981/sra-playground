#!/usr/bin/env python3
"""Bind completed lot 5A evidence before the first official cost sample.

Usage: python -B docs/migration/lot5a-evidence/finalize-cost-readiness.py \
    --performance-directory REPOSITORY_PATH --coordination-receipt REPOSITORY_PATH

This tool verifies retained receipts and current bytes. It invokes only the
read-only functions of scripts/verify-native-delivery.py; it starts no test,
build, game, replay, compiler, measurement, child process or browser. Its only
write is an exclusive PERFORMANCE_DIRECTORY/readiness.json after every check.
Neither a browser success nor a WEAV six-level success is inferred.

The separate coordination receipt must use
logos-engine.lot5a-cost-coordination.v1, status acknowledged_quiet_before_window,
recordedAt, performanceDirectory, nativeSourceDigest, ownTrackedComputeEnded=true,
previewStopped=true, costNodeOptionsOverride=null, and otherLanes containing
4B and 7B. Each lane has status acknowledged_quiet, acknowledgedAt, and a
nonempty evidence list of repository file fingerprints. This tool binds the
responsible owner's explicit acknowledgements; it does not infer quiet from
process visibility or produce those acknowledgements itself.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'docs/migration/lot5a-evidence'
FINAL = BASE / 'final'
VALIDATION = FINAL / 'test-expectation-correction/validation'
VERIFIER = ROOT / 'scripts/verify-native-delivery.py'
NATIVE_DIGEST = 'd30dedc767c588b0fdf33ea398a4ad207b07b027e8b3642b3b262c625c52387f'
BASELINE_DIGEST = 'f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb'
BASELINE_COMMIT = '0ca36b0a6a358e1e89420753bbcec4a33f028e0a'
DOCUMENTARY_COMMIT = 'bed48116585da864dd5c412ed11dd6990a950e8e'
COUNT_KEYS = ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo')
CHECK_NAMES = ['typecheck', 'entry-audit', 'migration-audit', 'diff-check', 'build']
GAME_IDS = {'CATR', 'RSWP', 'FOGW', 'VOIS', 'CONN', 'MIND', 'WEAV'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def instant(value):
    require(isinstance(value, str), 'Expected a timestamp string')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'Timestamp lacks a timezone: ' + value)
    return result


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def load_verifier():
    spec = importlib.util.spec_from_file_location('lot5a_readonly_delivery', VERIFIER)
    require(spec is not None and spec.loader is not None, 'Cannot load the read-only delivery verifier')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    require(module.ROOT == ROOT, 'Delivery verifier names another checkout')
    return module


class Evidence:
    def __init__(self, verifier):
        self.verifier = verifier
        self.inputs = {}
        self.external = {}
        self.baseline_checkout = None

    def local(self, value):
        return self.verifier.confined(value, ROOT)

    def keep(self, value):
        record = self.verifier.fingerprint(self.local(value))
        prior = self.inputs.setdefault(record['path'], record)
        require(prior == record, 'Input changed during readiness: ' + record['path'])
        return record

    def read(self, value):
        path = self.local(value)
        self.keep(path)
        raw = path.read_bytes()
        if path.suffix == '.gz':
            raw = gzip.decompress(raw)
        return json.loads(raw, object_pairs_hook=self.verifier.unique_object,
                          parse_constant=self.verifier.invalid_constant)

    def check(self, record):
        require(isinstance(record, dict) and set(record) == {'path', 'sha256', 'bytes'},
                'Expected an exact path/sha256/bytes fingerprint')
        require(self.verifier.valid_digest(record['sha256'])
                and type(record['bytes']) is int and record['bytes'] >= 0,
                'Malformed file fingerprint')
        path = Path(record['path'])
        if path.is_absolute():
            require(self.baseline_checkout is not None, 'External evidence before baseline identification')
            path = self.verifier.confined(path, self.baseline_checkout)
            require(path.is_file(), 'Missing external baseline input: ' + str(path))
            actual = {'path': str(path), 'sha256': self.verifier.sha(path), 'bytes': path.stat().st_size}
            prior = self.external.setdefault(record['path'], actual)
            require(prior == actual, 'External input changed during readiness: ' + record['path'])
        else:
            self.verifier.relative_name(record['path'])
            path = self.local(path)
            actual = self.keep(path)
        require(actual == record, 'File fingerprint differs: ' + record['path'])
        return path

    def reread_all(self):
        for record in list(self.inputs.values()) + list(self.external.values()):
            self.check(record)


def require_unmeasured(perf):
    forbidden = ['readiness.json', 'window.json', 'superseded-before-measurement.json',
                 'owner-growth-comparison.json', 'owner-growth-review.json',
                 'combined-comparison.json', 'aggregation-failure.json', 'aggregation-failure.log']
    for name in forbidden:
        require(not (perf / name).exists() and not (perf / name).is_symlink(),
                'Refusing a finalized, superseded or measured directory: ' + name)
    require(not any(perf.glob('cohort*/*.json')), 'Cohort reports already exist before readiness')


def verify_manifest(manifest, expected_digest):
    require(isinstance(manifest, dict) and set(manifest) == {'fileCount', 'digest', 'files'},
            'Unsupported native manifest')
    files = dict(sorted(manifest['files'].items()))
    require(type(manifest['fileCount']) is int and manifest['fileCount'] == len(files) > 0
            and manifest['digest'] == expected_digest
            and hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest() == expected_digest,
            'Frozen native inventory or digest differs')


def protocol_inputs(evidence, perf):
    declaration = evidence.read(perf / 'declaration.json')
    policy = evidence.read(perf / 'global-budget-policy.json')
    preparation = evidence.read(perf / 'preparation.json')
    protocol = evidence.read(perf / 'protocol-check.json')
    require(declaration['schema'] == 'logos-engine.native-cost-protocol-declaration.v2'
            and declaration['status'] == 'declared_before_official_window'
            and declaration['noOfficialWindowAtDeclaration'] is True,
            'The finalized premeasurement declaration is absent')
    require(preparation['schema'] == 'logos-engine.native-cost-protocol-preparation.v1'
            and preparation['status'] == 'source_freezes_verified_not_functional_readiness'
            and preparation['measurementExecuted'] is False
            and Path(preparation['candidateCheckout']).resolve() == ROOT
            and evidence.local(preparation['outputDirectory']) == perf,
            'Source preparation does not bind this checkout and directory')
    baseline_checkout = Path(preparation['baselineCheckout'])
    require(baseline_checkout.is_absolute() and baseline_checkout.is_dir()
            and baseline_checkout.resolve() != ROOT, 'Missing distinct baseline checkout')
    evidence.baseline_checkout = baseline_checkout
    for key in ('protocol', 'cases', 'diagnosticComparisonPolicy', 'globalBudgetPolicy',
                'baselineManifest', 'candidateManifest', 'candidateArchiveManifest',
                'globalDecisionTool', 'globalCalculationTool'):
        evidence.check(declaration[key])
    require(isinstance(declaration['officialTools'], list) and declaration['officialTools'],
            'Missing retained cost tools')
    for record in declaration['officialTools']:
        evidence.check(record)
    require(preparation['retainedTools'] == declaration['officialTools'] +
            [declaration['globalDecisionTool'], declaration['globalCalculationTool']],
            'Preparation binds different retained tools')
    require(policy['schema'] == 'logos-engine.native-global-cost-policy.v1'
            and policy['globalStage'] == 'session_elapsed' and policy['relativeIncreaseLimit'] == 0.1
            and policy['comparison'] == 'strictly_less_than' and policy['allCasesMustPass'] is True
            and policy['crossCaseCompensation'] is False and policy['phaseOverrunsMayBeAccepted'] is True
            and policy['phasesAndP95RemainVisible'] is True and policy['excludedMeasuredSessions'] == 0
            and policy['excludedOutliers'] == 0 and policy['caseIds'] == ['STCK', 'SMLP'],
            'The authorized global budget rule changed')
    candidate_path = evidence.local(declaration['candidateManifest']['path'])
    archive_path = evidence.local(declaration['candidateArchiveManifest']['path'])
    require(candidate_path.name == 'source-manifest.json'
            and candidate_path.parent in (FINAL, FINAL / 'test-expectation-correction')
            and archive_path == candidate_path.parent / 'source-archive.json',
            'Declaration names another final candidate freeze')
    candidate = evidence.read(candidate_path)
    baseline = evidence.read(declaration['baselineManifest']['path'])
    verify_manifest(candidate, NATIVE_DIGEST)
    verify_manifest(baseline, BASELINE_DIGEST)
    require(candidate['fileCount'] == 283, 'Final 0.53 freeze must contain 283 native files')
    for role, manifest in (('baseline', baseline), ('candidate', candidate)):
        require(declaration['nativeDigests'][role] == manifest['digest']
                and declaration[role] == policy[role] == preparation[role]
                and declaration[role]['nativeDigest'] == manifest['digest']
                and declaration[role]['nativeFiles'] == manifest['fileCount']
                and preparation[role + 'Manifest'] == declaration[role + 'Manifest'],
                'Declared source identities disagree: ' + role)
    require(declaration['baseline']['siteVersion'] == 82
            and declaration['baseline']['nativeVersion'] == '0.52.0'
            and declaration['baseline']['commit'] == BASELINE_COMMIT
            and declaration['candidate']['nativeVersion'] == '0.53.0'
            and declaration['candidate']['siteVersion'] is None,
            'Actual Site 82 baseline or unpublished 0.53 candidate identity differs')
    require(protocol['status'] == 'protocol_contract_passed'
            and protocol['measurementExecuted'] is False
            and protocol['nativeDigests'] == declaration['nativeDigests']
            and evidence.local(protocol['declaration']) == perf / 'declaration.json'
            and preparation['candidateArchiveManifest'] == declaration['candidateArchiveManifest'],
            'The retained protocol check does not bind this declaration')
    archive, archive_verification = evidence.verifier.verify_source_archive(archive_path.parent, candidate)
    require(archive_verification['files'] == archive_verification['members'] == 294
            and archive_verification['byteIdentical'] is True
            and archive['baseCommit'] == declaration['candidate']['sourceBaseCommit'],
            'Final source archive is incomplete or differs')
    evidence.check(archive['archive'])
    parts = evidence.read(archive_path.parent / 'source-archive-parts.json')
    for record in parts['parts']:
        evidence.check(record)
    current = evidence.verifier.inventory(['src/logos-engine', 'src/runtime'], {'.ts', '.json', '.drm'})
    require(current == candidate['files'], 'Current native source differs from the 0.53 freeze')
    for name, digest in baseline['files'].items():
        path = evidence.verifier.confined(baseline_checkout / evidence.verifier.relative_name(name), baseline_checkout)
        evidence.check({'path': str(path), 'sha256': digest, 'bytes': path.stat().st_size})
    predecessor = evidence.read(FINAL / 'published-predecessor-reconciliation.json')
    require(predecessor['schema'] == 'logos-engine.lot5a.published-predecessor-reconciliation.v1'
            and predecessor['publishedPredecessor']['siteVersion'] == 83
            and predecessor['publishedPredecessor']['commit'] == DOCUMENTARY_COMMIT
            and predecessor['publishedPredecessor']['deploymentStatus'] == 'succeeded'
            and predecessor['officialCostBaseline'] == {
                'siteVersion': 82, 'commit': BASELINE_COMMIT,
                'nativeVersion': '0.52.0', 'nativeDigest': BASELINE_DIGEST}
            and predecessor['executionInputDiff']['changedFiles'] == []
            and predecessor['candidateNativeDigest'] == NATIVE_DIGEST
            and predecessor['candidateNativeUnchanged'] is True
            and predecessor['bothPublishedCommitsAreAncestors'] is True,
            'The actual published predecessor has not been reconciled')
    return declaration, policy, preparation, candidate, archive_verification, predecessor


def functional_inputs(evidence, candidate):
    tests = evidence.read(VALIDATION / 'delta-tests-run.json')
    checks = evidence.read(VALIDATION / 'checks-run.json')
    test_input_count, counts = evidence.verifier.verify_tests(tests, candidate)
    build_input_count, worker = evidence.verifier.verify_build(checks, candidate)
    require(counts == {'tests': 3835, 'pass': 3835, 'fail': 0, 'cancelled': 0, 'skipped': 0, 'todo': 0}
            and len(tests['testFiles']) == 102
            and {'tests/v6-linked-temporal-preparation.test.ts', 'tests/v6-linked-temporal-reference.test.ts'}
            <= set(tests['testFiles']), 'The final 3835/3835 affected-file suite is incomplete')
    for receipt in (tests, checks):
        require(receipt['generator'] == evidence.keep(ROOT / 'scripts/verify-native-delta.py'),
                'Release receipt uses another verifier')
        for row in receipt['checks']:
            evidence.check(row['output'])
            require(instant(row['startedAt']) <= instant(row['finishedAt']), 'Release check chronology differs')
    require([row['name'] for row in checks['checks']] == CHECK_NAMES, 'Five release checks are required')
    evidence.check(worker)
    tap = gzip.decompress(evidence.local(tests['checks'][0]['output']['path']).read_bytes()).decode()
    require(all(re.findall(r'^# ' + key + r' (\d+)\s*$', tap, re.M) == [str(counts[key])]
                for key in COUNT_KEYS), 'Recorded formal counts differ from retained TAP')
    audit = evidence.read(checks['checks'][2]['output']['path'])
    require(audit['failures'] == [], 'Migration audit retains unresolved failures')
    initial = evidence.read(FINAL / 'validation/delta-tests-run.json')
    correction = evidence.read(BASE / 'diagnostic/validation-correction.json')
    require(initial['status'] == 'failed' and initial['checks'][0]['counts']['tests'] == 3835
            and initial['checks'][0]['counts']['pass'] == 3834
            and initial['checks'][0]['counts']['fail'] == 1
            and correction['nativeImplementationChanged'] is False,
            'The initial failure and test-only correction are not retained')
    for row in initial['checks']:
        evidence.check(row['output'])

    execution = evidence.read(FINAL / 'linked-temporal-common-loop-execution.json')
    common_path = evidence.check(execution['report'])
    require(common_path == FINAL / 'linked-temporal-common-loop.json.gz'
            and execution['schema'] == 'logos-engine.native-contract-diagnostic-execution.v1'
            and execution['exitCode'] == 0, 'Missing final common-loop execution')
    evidence.check(execution['log'])
    for record in execution['executionInputs']:
        evidence.check(record)
    common = evidence.read(common_path)
    require(common['schema'] == 'logos-engine.linked-temporal-common-loop.v1'
            and common['status'] == 'passed'
            and common['nativeSource'] == {'fileCount': candidate['fileCount'], 'digest': candidate['digest']}
            and common['sourceUnchangedDuringRun'] is True
            and common['executionInputsUnchangedDuringRun'] is True
            and common['sourceDeclarationsModified'] is False
            and common['checks']['passed'] == 16 and common['checks']['failed'] == 0
            and len(common['checks']['names']) == len(set(common['checks']['names'])) == 16,
            'The exact final common proof is incomplete')
    for record in common['executionInputs']:
        evidence.check(record)
    branches = common['branches']
    require({row['id'] for row in branches} == {'learned-multi-action-access', 'learned-path-no-remote-effect'}
            and len(branches) == 2
            and all(row['synthetic'] is True and row['returned'] == row['ownReturns'] + row['passiveReturns']
                    for row in branches)
            and sum(row['returned'] for row in branches) == 12
            and sum(row['ownReturns'] for row in branches) == 10
            and sum(row['passiveReturns'] for row in branches) == 2
            and sum(row['ownPathReturns'] for row in branches) == 4,
            'The two-branch contribution counts differ')

    regression_path = FINAL / 'regressions/regression-summary.json'
    regression = evidence.read(regression_path)
    evidence.verifier.verify_regressions(regression_path, candidate, True)
    require(regression['total'] == regression['passed'] == 7
            and regression['comparisonChecksPassed'] == regression['comparisonChecksExpected'] == 119
            and {row['game'] for row in regression['results']} == GAME_IDS,
            'All seven final recorded regressions are required')
    evidence.check(regression['caseManifest'])
    for name, digest in regression['executionInputs'].items():
        require(evidence.keep(ROOT / name)['sha256'] == digest, 'Regression tool changed: ' + name)
    for row in regression['results']:
        require(row['status'] == 'passed' and row['passed'] is True and row['exitCode'] == 0
                and row['timedOut'] is False and row['comparisonPassed'] is True and row['failedChecks'] == []
                and row['nativeSourceBeforeDigest'] == row['nativeSourceAfterDigest'] == NATIVE_DIGEST
                and row['nativeSourceUnchanged'] is True and row['immutableInputsUnchanged'] is True,
                'A final recorded regression or its inputs failed')
        for key in ('baseline', 'trace', 'output', 'report', 'comparison', 'execution', 'passiveOwnerPresence'):
            evidence.check(row[key])
        comparison = evidence.read(row['comparison']['path'])
        require(comparison['passed'] is True and len(comparison['checks']) == row['comparisonChecks'] == 17
                and all(item['passed'] is True for item in comparison['checks']),
                'Historical 17-check regression comparison is incomplete')
    actions = sum(row['actions'] for row in regression['results'])
    prefixes = sum(row['prefixes'] for row in regression['results'])
    require(actions == 292 and prefixes == 210, 'Recorded regression totals differ')
    review = evidence.read(FINAL / 'functional-block-review.json')
    require(review['schema'] == 'logos-engine.lot5a-final-functional-block.v1'
            and review['status'] == 'passed' and review['incidents'] == []
            and review['nativeSource'] == {'fileCount': candidate['fileCount'], 'digest': candidate['digest']}
            and review['commonLoop']['report'] == execution['report']
            and review['commonLoop']['labeledChecksPassed'] == 16
            and review['regressions']['summary'] == evidence.keep(regression_path)
            and review['regressions']['passed'] == review['regressions']['total'] == 7
            and review['regressions']['comparisonChecksPassed'] == 119,
            'Final functional review does not bind these completed reports')
    for record in (review['commonLoop']['execution'], review['regressions']['driverExecution'],
                   review['transport']['receipt'], review['transport']['partsManifest']):
        evidence.check(record)
    parts = evidence.read(FINAL / 'regression-evidence-parts.json')
    require(parts['operation'] == 'pack' and len(parts['verified']) == 7
            and {row['path'] for row in parts['verified']} == {row['report']['path'] for row in regression['results']},
            'Complete regression report transport is absent')
    part_count = 0
    for row in parts['verified']:
        manifest_path = evidence.local(row['manifest'])
        manifest = evidence.read(manifest_path)
        require(manifest['schema'] == 'logos-engine.evidence-byte-parts.v1'
                and manifest['original'] == {'file': Path(row['path']).name,
                    'sha256': row['sha256'], 'bytes': row['bytes']}
                and len(manifest['parts']) == row['parts'], 'Report part manifest differs from its original')
        digest, size = hashlib.sha256(), 0
        with evidence.local(row['path']).open('rb') as original:
            for index, part in enumerate(manifest['parts']):
                require(part['file'] == Path(row['path']).name + f'.part{index:03d}',
                        'Report parts are not in the declared consecutive order')
                record = {'path': (manifest_path.parent / part['file']).relative_to(ROOT).as_posix(),
                          'sha256': part['sha256'], 'bytes': part['bytes']}
                path = evidence.check(record)
                raw = path.read_bytes()
                require(original.read(len(raw)) == raw, 'Report parts are not byte-identical to the original')
                digest.update(raw)
                size += len(raw)
                part_count += 1
            require(original.read(1) == b'', 'Report parts omit original bytes')
        require(size == row['bytes'] and digest.hexdigest() == row['sha256'], 'Report reconstruction differs')
    require(review['transport']['verifiedReports'] == len(parts['verified'])
            and review['transport']['verifiedParts'] == part_count, 'Functional transport counts differ')
    return {'tests': tests, 'checks': checks, 'counts': counts, 'audit': audit,
            'testInputFiles': test_input_count, 'buildInputFiles': build_input_count,
            'worker': worker, 'common': {'checks': 16, 'branches': 2, 'returns': 12,
                'ownReturns': 10, 'passiveReturns': 2, 'ownPathReturns': 4},
            'regressions': {'cases': 7, 'checks': 119, 'actions': actions, 'prefixes': prefixes},
            'computeFinishedAt': [execution['endedAt'], *[row['finishedAt'] for row in regression['results']]]}


def owner_inputs(evidence, perf, declaration):
    static = evidence.read(perf / 'static-preflight.json')
    require(static['schema'] == 'logos-engine.native-cost-static-preflight.v1'
            and static['status'] == 'static_inputs_checked' and static['measurementExecuted'] is False
            and static['checkedCount'] == len(static['checks']) > 0 and static['unsatisfied'] == []
            and all(row['satisfied'] is True for row in static['checks'])
            and static['declaration'] == evidence.keep(perf / 'declaration.json')
            and static['candidateFreeze'] == declaration['candidateManifest']
            and static['protocolCheck'] == evidence.keep(perf / 'protocol-check.json')
            and static['supersession'] is None, 'Static preflight is incomplete, superseded or source-mismatched')
    for key in ('generator', 'adaptedFrom', 'preparationTool'):
        evidence.check(static[key])
    cases = evidence.read(declaration['cases']['path'])
    cases_by_id = {row['id']: row for row in cases['cases']}
    trace_keys = [(row['role'], row['case']) for row in static['traces']]
    require(len(cases_by_id) == len(cases['cases']) and len(trace_keys) == len(set(trace_keys))
            and set(trace_keys) == {(role, name) for role in ('baseline', 'candidate') for name in cases_by_id},
            'Static preflight omits or duplicates a baseline/candidate trace')
    for row in static['traces']:
        case = cases_by_id[row['case']]
        root = evidence.baseline_checkout if row['role'] == 'baseline' else ROOT
        expected = evidence.verifier.confined(root / evidence.verifier.relative_name(case['trace']), root)
        require(Path(row['path']) == expected and row['sha256'] == row['expectedSha256'] == case['traceSha256'],
                'Static trace differs from the predeclared case')
        record_path = str(expected) if row['role'] == 'baseline' else expected.relative_to(ROOT).as_posix()
        evidence.check({'path': record_path, 'bytes': row['bytes'], 'sha256': row['sha256']})
    qualification = declaration['ownerCostQualification']
    require(qualification['schema'] == 'logos-engine.lot5a-owner-cost-qualification.v1'
            and evidence.local(qualification['contractPath']) == perf / 'owner-growth-contract.json',
            'The declared owner contract is missing or outside this window')
    contract_path = evidence.local(qualification['contractPath'])
    contract = evidence.read(contract_path)
    require(contract['schema'] == 'logos-engine.lot5a-owner-cost-contract.v2' and contract['lot'] == '5A'
            and evidence.local(contract['performanceDirectory']) == perf
            and contract['declaration'] == evidence.keep(perf / 'declaration.json')
            and contract['tools'] == qualification['tools'] == static['ownerCostTools']
            and set(contract['tools']) == {'consolidator', 'reviewer'}
            and static['ownerCostContract'] == evidence.keep(contract_path)
            and static['ownerStructuralFixture'] == contract['structuralFixture'],
            'Contract, declaration and static preflight disagree')
    require(contract['structuralExpectation'] == {
        'ownerId': 'linked_temporal_preparation', 'programId': None,
        'installedNodeIds': ['family_state:linked_temporal_preparation', 'family_activation:linked_temporal_preparation'],
        'allowedPaths': ['observations[*].nodeCount', 'inspection[*].graphNodes', 'final.nodeCount', 'final.graphRevision'],
        'mode': 'predeclared_functional_fixture', 'qualification': 'functional_structure_frozen_before_measurement'},
        'The declared owner qualification changed scope')
    for record in [*contract['tools'].values(), contract['ownerInventory'], *contract['sourceEvidence'],
                   contract['structuralFixture'], contract['premeasurementAttributionSupplement']]:
        evidence.check(record)
    candidate = evidence.read(declaration['candidateManifest']['path'])
    require(contract['sourceEvidence'] and len({row['path'] for row in contract['sourceEvidence']})
            == len(contract['sourceEvidence'])
            and all(candidate['files'].get(row['path']) == row['sha256'] for row in contract['sourceEvidence']),
            'Owner source evidence differs from the candidate freeze')
    fixture = evidence.read(contract['structuralFixture']['path'])
    attribution = evidence.read(evidence.check(fixture['attribution']))
    require(fixture['schema'] == 'logos-engine.lot5a-owner-cost-structural-fixture.v1'
            and attribution['schema'] == 'logos-engine.lot5a-owner-cost-structural-attribution.v1'
            and fixture['status'] == attribution['status'] == 'qualified_functional_structure'
            and fixture['nativeDigests'] == attribution['nativeDigests'] == declaration['nativeDigests']
            and attribution['failures'] == []
            and attribution['checkedCount'] == len(attribution['checks']) > 0
            and all(row['passed'] is True for row in attribution['checks'])
            and attribution['nodeAttributions']
            and contract['premeasurementAttributionSupplement'] in attribution['inputs'],
            'The supplemented graph attribution is not complete and source-bound')
    forms_sha = hashlib.sha256(json.dumps(fixture['forms'], sort_keys=True, separators=(',', ':'),
                                         ensure_ascii=False, allow_nan=False).encode()).hexdigest()
    require(attribution['formsSha256'] == forms_sha, 'Fixture forms differ from the passed attribution')
    evidence.check(fixture['cases'])
    require((fixture['cases']['sha256'], fixture['cases']['bytes']) ==
            (declaration['cases']['sha256'], declaration['cases']['bytes']), 'Functional and declared cases differ')
    for record in [fixture['captureTool'], attribution['generator'], *attribution['inputs']]:
        evidence.check(record)
    capture_finishes = []
    for role in ('baseline', 'candidate'):
        capture = fixture['captures'][role]
        evidence.check(capture['report'])
        receipt = evidence.read(evidence.check(capture['receipt']))
        require(receipt['schema'] == 'logos-engine.lot5a-owner-cost-functional-capture-receipt.v1'
                and receipt['status'] == 'captured_functional_structure' and receipt['role'] == role
                and receipt['nativeDigest'] == declaration['nativeDigests'][role]
                and receipt['report'] == capture['report'] and receipt['generator'] == fixture['captureTool']
                and receipt['failures'] == []
                and instant(receipt['finishedAt']) <= instant(attribution['recordedAt']),
                'A functional capture is incomplete or has changed')
        capture_finishes.append(receipt['finishedAt'])
    inventory = evidence.read(contract['ownerInventory']['path'])
    require(inventory['schema'] == 'logos-engine.lot5a-owner-cost-source-inventory.v1'
            and inventory['nativeDigests'] == declaration['nativeDigests']
            and inventory['programScope'] == 'family-installed programs', 'Owner inventory is not source-bound')
    evidence.check(inventory['generator'])
    for key, additions in (('owners', {'linked_temporal_preparation'}), ('programs', set())):
        before, after = inventory[key]['baseline'], inventory[key]['candidate']
        require(len(before) == len(set(before)) and len(after) == len(set(after))
                and set(after) - set(before) == additions and not set(before) - set(after),
                'Unexpected owner or program membership change: ' + key)
    require(instant(attribution['recordedAt']) <= instant(fixture['recordedAt']) <= instant(contract['declaredAt'])
            and instant(inventory['recordedAt']) <= instant(contract['declaredAt'])
            and instant(declaration['finalizedAt']) <= instant(contract['declaredAt']) <= instant(static['recordedAt']),
            'Attribution, contract and preflight chronology differ')
    return static, contract, capture_finishes


def reservations(evidence, candidate):
    browser_path = FINAL / 'browser/browser-qa.json'
    browser = evidence.read(browser_path)
    require(browser['schema'] == 'logos-engine.lot5a.browser-verification.v1'
            and browser['nativeSourceManifestDigest'] == candidate['digest']
            and browser['status'] == 'unavailable_browser_control'
            and browser['observedCurrentCandidateGameplay'] is False and browser['gameSessionStarted'] is False
            and len(browser['attempts']) == 2
            and all('timed out' in row['result'] for row in browser['attempts']),
            'Browser unavailability must remain an explicit separate reserve')
    weav_path = BASE / 'weav/native050-delta-diagnostic/result.json'
    weav = evidence.read(weav_path)
    clock_path = BASE / 'weav/followup-clock.json'
    clock = evidence.read(clock_path)
    require(weav['schema'] == 'sra.case-followup-result.v1' and weav['status'] == 'case_budget_exhausted'
            and weav['targetLevels'] == 6 and weav['lastObserved']['levelsCompleted'] == 3
            and weav['lastObserved']['level'] == 4 and weav['lastObserved']['actions'] == 105
            and weav['remainingSeconds'] == 0 and weav['driver']['caseCutoffReached'] is True
            and clock['schema'] == 'sra.case-followup-clock.v1' and clock['case'] == 'WEAV'
            and all(finite(weav[key]) for key in ('priorCumulativeSeconds', 'followupElapsedSeconds', 'cumulativeSeconds'))
            and weav['priorCumulativeSeconds'] == clock['priorCumulativeSeconds']
            and abs(weav['priorCumulativeSeconds'] + weav['followupElapsedSeconds'] - weav['cumulativeSeconds']) < 1e-6
            and weav['cumulativeSeconds'] >= clock['totalBudgetSeconds'],
            'The separate exhausted WEAV case must not become a six-level success')
    return [
        {'id': 'browser_unavailable', 'status': browser['status'], 'receipt': evidence.keep(browser_path),
         'candidateGameplayObserved': False, 'gameSessionStarted': False, 'uiGatePassed': False,
         'qualification': browser['qualification']},
        {'id': 'weav_case_budget_exhausted', 'status': weav['status'], 'receipt': evidence.keep(weav_path),
         'clock': evidence.keep(clock_path), 'targetLevels': weav['targetLevels'], 'targetMet': False,
         'lastObserved': weav['lastObserved'], 'cumulativeSeconds': weav['cumulativeSeconds'],
         'remainingSeconds': 0, 'newLiveAuthorized': False, 'qualification': weav['qualification']},
    ]


def coordination(evidence, path, perf):
    value = evidence.read(path)
    require(value['schema'] == 'logos-engine.lot5a-cost-coordination.v1'
            and value['status'] == 'acknowledged_quiet_before_window'
            and evidence.local(value['performanceDirectory']) == perf
            and value['nativeSourceDigest'] == NATIVE_DIGEST
            and value['ownTrackedComputeEnded'] is True and value['previewStopped'] is True
            and value['costNodeOptionsOverride'] is None,
            'Explicit cooperative quiet is not attested for this window')
    lanes = value['otherLanes']
    require(isinstance(lanes, list) and len(lanes) == 2
            and {row['lane'] for row in lanes} == {'4B', '7B'}, 'Both active conversations must acknowledge quiet')
    for row in lanes:
        require(row['status'] == 'acknowledged_quiet' and isinstance(row['evidence'], list) and row['evidence']
                and instant(row['acknowledgedAt']) <= instant(value['recordedAt']),
                'Lane acknowledgement is missing, unbound or dated after coordination')
        for record in row['evidence']:
            require(not Path(record['path']).is_absolute(), 'Lane evidence must be inside the repository')
            evidence.check(record)
    for record in value.get('evidence', []):
        require(not Path(record['path']).is_absolute(), 'Coordination evidence must be inside the repository')
        evidence.check(record)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--performance-directory', type=Path, required=True,
                        help='Existing, unmeasured directory inside docs/migration/lot5a-evidence.')
    parser.add_argument('--coordination-receipt', type=Path, required=True,
                        help='Repository receipt with fresh explicit 4B and 7B quiet acknowledgements.')
    args = parser.parse_args()
    verifier = load_verifier()
    evidence = Evidence(verifier)
    perf, coordination_path = evidence.local(args.performance_directory), evidence.local(args.coordination_receipt)
    require(perf.is_relative_to(BASE) and perf.is_dir(), 'Performance directory must exist inside lot5a-evidence')
    require_unmeasured(perf)
    evidence.keep(VERIFIER)
    evidence.keep(Path(__file__))
    declaration, policy, preparation, candidate, archive_verification, predecessor = protocol_inputs(evidence, perf)
    functional = functional_inputs(evidence, candidate)
    static, contract, capture_finishes = owner_inputs(evidence, perf, declaration)
    reserves = reservations(evidence, candidate)
    isolation = coordination(evidence, coordination_path, perf)
    finalized = datetime.now(timezone.utc)
    require(instant(policy['declaredAt']) <= instant(declaration['recordedAt'])
            <= instant(declaration['finalizedAt']) <= instant(contract['declaredAt'])
            <= instant(static['recordedAt']) <= finalized
            and instant(isolation['recordedAt']) <= finalized
            and all(instant(value) <= instant(isolation['recordedAt'])
                    for value in functional['computeFinishedAt'] + capture_finishes)
            and all(instant(row['finishedAt']) <= instant(isolation['recordedAt'])
                    for value in (functional['tests'], functional['checks']) for row in value['checks']),
            'Completed validation, source binding and explicit quiet must precede readiness')
    # The verifier checks membership as well as every hash. Repeat at the end;
    # source/test/build maps remain bound by their complete retained receipts.
    verifier.verify_tests(functional['tests'], candidate)
    verifier.verify_build(functional['checks'], candidate)
    require(verifier.inventory(['src/logos-engine', 'src/runtime'], {'.ts', '.json', '.drm'}) == candidate['files'],
            'Native source changed during readiness')
    evidence.reread_all()
    require_unmeasured(perf)
    finalized = datetime.now(timezone.utc)
    value = {
        'schema': 'logos-engine.native-cost-window-readiness.v1', 'lot': '5A', 'status': 'ready',
        'finalizedAt': finalized.isoformat(), 'measurementAuthorized': True,
        'measurementExecuted': False, 'pendingRequirements': [],
        'generator': evidence.keep(Path(__file__)), 'verificationHelpers': [evidence.keep(VERIFIER)],
        'nativeVersion': '0.53.0', 'nativeSourceDigest': NATIVE_DIGEST,
        'baseline': policy['baseline'], 'candidate': policy['candidate'],
        'publishedPredecessor': predecessor['publishedPredecessor'], 'candidatePublished': False,
        'formalTests': functional['counts'], 'formalTestFiles': 102, 'releaseChecks': CHECK_NAMES,
        'sourceTestInputFiles': functional['testInputFiles'], 'buildInputFiles': functional['buildInputFiles'],
        'nativeAgentWorker': functional['worker'], 'sourceArchiveVerification': archive_verification,
        'commonContribution': functional['common'], 'recordedRegressions': functional['regressions'],
        'migrationAudit': functional['audit'], 'reservations': reserves,
        'ownerCostContract': evidence.keep(perf / 'owner-growth-contract.json'),
        'premeasurementAttributionSupplement': contract['premeasurementAttributionSupplement'],
        'historicalStrictIdentityNotAnticipated': True,
        'coordinationReceipt': evidence.keep(coordination_path), 'isolation': isolation,
        'inputs': list(evidence.inputs.values()), 'watchedExternalInputs': list(evidence.external.values()),
        'qualification': 'Read-only verification of completed 3835/3835 affected-file tests, five release checks, '
            'empty audit failures, 16/16 synthetic common-loop checks, seven recorded regressions and their '
            '119 comparisons, exact native/source/test/build inputs and the 294-file archive. The passed owner '
            'attribution, its explicit premeasurement supplement, contract, protocol and static preflight are '
            'bound before any cost sample. Browser unavailability and the exhausted earlier WEAV diagnostic '
            'remain separate reserves; neither becomes a successful UI or six-level result. Explicit lane '
            'acknowledgements attest cooperative quiet, not process-visibility inference. No test, build, '
            'game, measurement or candidate publication is performed by this tool.',
    }
    output = perf / 'readiness.json'
    with output.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({'status': 'ready', 'receipt': verifier.fingerprint(output),
                      'measurementExecuted': False, 'reservations': [row['id'] for row in reserves]}))


if __name__ == '__main__':
    main()
