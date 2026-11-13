#!/usr/bin/env python3
"""Freeze one final 0.68 cost controller plan after actual preparation closure.

Reads and hashes only. No runtime, game, lock or measurement is executed.
The caller must first close all preparation workers and commands and update
the owned status truthfully. Existing output declarations are never overwritten.
"""
from datetime import datetime, timezone
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[4]
EVIDENCE = ROOT / 'docs/migration/lot9a-evidence'
PREP = EVIDENCE / 'final-cost-preparation-068-01'
PERF = EVIDENCE / 'final-performance-068-01'
DELIVERY = EVIDENCE / 'delivery-final-068-01'
BASELINE = Path('/workspace/sites/sra-lot9a-baseline067-20261112')
BASE_COMMIT = '8462204043aa368faa7df280d796bb706eb53b38'
CANDIDATE_COMMIT = '6f98d0651a6692e9967627ff45ba5b2c7976ac58'
sys.dont_write_bytecode = True
sys.path.insert(0, str(EVIDENCE / 'tools/final-coordination'))
import common as c


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--closed-agents', nargs='+', required=True)
    args = parser.parse_args()
    now = datetime.now(timezone.utc).isoformat()
    contract = c.read_json(PERF / 'contract.json')
    assert contract['schema'] == 'logos-engine.lot9a-final-cost-contract.v1'
    review_statuses = {
        'contract-independent-review.json': 'passed',
        'coordination-independent-review.json': 'favorable_independent_prospective_tools_review'}
    for name, expected_status in review_statuses.items():
        review = c.read_json(PREP / name)
        assert review['status'] == expected_status, name
        assert not review.get('blockingObjections', []), name
    observation = c.read_json(PREP / 'publication-observation.json')
    assert observation['siteVersion'] == 108
    assert observation['latestSavedVersion']['sourceCommit'] == BASE_COMMIT
    assert observation['access']['ownerOnly'] is True
    own = c.own_idle_status()
    environment = c.process_snapshot((ROOT, BASELINE))
    own_check = c.require_no_visible_own_work(environment)
    closure = {
        'schema': 'logos-engine.lot9a.own-preparation-closure.v1',
        'recordedAt': now, 'allPreparationCommandsTerminal': True,
        'closedAgentsConfirmedByDeliveryOwner': args.closed_agents,
        'activeExecutionSessions': [], 'activeCommands': [], 'activeWorkers': [],
        'visibleOwnWorkCheck': own_check,
        'qualification': 'Agent termination is separately confirmed by the delivery owner; process visibility is limited to this namespace. This finite declaration writer and its ancestors are allowed.'}
    created = []
    def write(name, value):
        path = PREP / name
        c.atomic_json(path, value, create=True)
        created.append(path)
        return path
    write('environment-before-declaration.json', environment)
    write('own-work-closure.json', closure)
    write('own-status-before-window.json', own)
    inputs = {}
    def pin(path):
        path = Path(path)
        if not path.is_absolute():
            path = ROOT / path
        path = c.canonical(path)
        if path.is_relative_to(ROOT):
            role, relative = 'candidate', path.relative_to(ROOT).as_posix()
        else:
            assert path.is_relative_to(BASELINE), str(path)
            role, relative = 'baseline', path.relative_to(BASELINE).as_posix()
        value = {'role': role, 'path': relative, **c.fingerprint(path)}
        key = (role, relative)
        assert key not in inputs or inputs[key] == value
        inputs[key] = value
        return value
    for record in contract['inputFingerprints']:
        value = pin(record['path'])
        assert all(value[key] == record[key] for key in ('bytes', 'sha256'))
    contract_fp = pin(PERF / 'contract.json')
    for path in (EVIDENCE / 'tools/final-coordination').rglob('*'):
        if path.is_file() and '__pycache__' not in path.parts:
            pin(path)
    pin(Path(__file__))
    isolation_paths = [*created, PREP / 'publication-observation.json',
                       PREP / 'contract-independent-review.json',
                       PREP / 'coordination-independent-review.json']
    isolation_evidence = [pin(path) for path in isolation_paths]
    readiness = {
        'schema': 'logos-engine.lot9a.official-performance-readiness.v1',
        'recordedAt': now, 'measurementAuthorized': True, 'pendingRequirements': [],
        'baselineCommit': BASE_COMMIT, 'candidateCommit': CANDIDATE_COMMIT,
        'contract': contract_fp,
        'ownWorkClosed': {key: closure[key] for key in (
            'allPreparationCommandsTerminal', 'activeExecutionSessions', 'activeCommands', 'activeWorkers')},
        'isolation': {
            'established': True,
            'basis': 'Dedicated owned candidate and published baseline checkouts, exact native and declared input bytes frozen; all own preparation workers and commands terminal; fresh process observation confirms no other work in either owned checkout. The controller acquires the current shared mutex once without blocking, rechecks the inputs and own work, serializes ABBA in one supervised process group and retains namespace observations every 30 seconds.',
            'scope': 'The owned official execution window and the currently shared performance mutex, within the visible execution namespace.',
            'evidence': isolation_evidence,
            'limitations': [
                'Ordinary concurrent work in other namespaces or elsewhere on the host is not observable here and is not asserted absent.',
                'No peer availability or old context acknowledgment is required; the mutex only serializes holders of its current inode and does not suspend ordinary work.',
                'CPU affinity and load are observed, not allocated as exclusive resources. Periodic controller observations are retained measurement instrumentation.',
                'session_elapsed covers the native harness through the last acquired return including pauses and resumes; worker startup, begin, terminal inspection, close, live game engine, network and browser rendering are excluded.'],
            'flockAloneIsEvidence': False},
        'qualification': {
            'functionalReview': pin(DELIVERY / 'independent-delivery-review.json'),
            'finalReconciliation': pin(DELIVERY / 'final-reconciliation.json'),
            'userGlobalRule': contract['globalRule'],
            'historicalPreparedOnlyEvidenceUnchanged': True,
            'positiveChartPublicTransportRemainsOpen': True,
            'historicalFailuresAndSessionBudgetReservationRetained': True,
            'publicationAccepted': False}}
    readiness_fp = pin(write('official-window-readiness.json', readiness))
    plan = {
        'schema': 'logos-engine.lot9a.official-performance-plan.v1',
        'recordedAt': now, 'owner': 'lot9a', 'baselineCheckout': str(BASELINE),
        'baselineCommit': BASE_COMMIT, 'baselineSiteVersion': 108,
        'baselineNativeVersion': '0.67.0', 'candidateCommit': CANDIDATE_COMMIT,
        'candidateNativeVersion': '0.68.0',
        'performanceDirectory': PERF.relative_to(ROOT).as_posix(),
        'baselineManifest': pin(DELIVERY / 'baseline-native.json'),
        'candidateManifest': pin(DELIVERY / 'candidate-native.json'),
        'contract': contract_fp, 'readiness': readiness_fp,
        'limits': {'preflightSeconds': 180, 'measurementSeconds': 1800,
                   'terminationGraceSeconds': 10, 'killGraceSeconds': 10,
                   'retentionSeconds': 60, 'observationIntervalSeconds': 30}}
    plan['immutableInputs'] = [inputs[key] for key in sorted(inputs)]
    path = write('official-window-plan.json', plan)
    print(json.dumps({'status': 'declared_before_measurement', 'immutableInputs': len(inputs),
                      'plan': str(path), 'planSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                      'nativeExecutionPerformed': False, 'lockAcquired': False}))


if __name__ == '__main__':
    main()
