#!/usr/bin/env python3
"""Charge diagnostic and browser intervals to the same append-only case clock.

An unresolved start blocks campaigns. Finish charges the complete monotonic
interval, including retention, even if its declared ceiling was exceeded.
This helper supplies no game input or learned state.
"""
from __future__ import annotations

import argparse
from decimal import Decimal
import fcntl
import importlib.util
import os
from pathlib import Path
import re
import time

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('recruitment_clock', HERE / 'run-clocked-proof.py')
C = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(C)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['initialize', 'start', 'finish', 'verify'])
    parser.add_argument('--id')
    parser.add_argument('--purpose')
    parser.add_argument('--ceiling-seconds', type=float)
    parser.add_argument('--status', choices=['completed', 'failed', 'interrupted'])
    parser.add_argument('--evidence', action='append', default=[])
    args = parser.parse_args()
    contract = C.read_json(C.inside(C.CASE_CONTRACT))
    C.GAME, C.TARGET_LEVELS = contract.get('game'), contract.get('targetLevels')
    if (contract.get('schema') != 'logos-engine.lot10c.case-contract.v1'
            or not isinstance(C.GAME, str) or not re.fullmatch(r'[A-Z0-9]{4}', C.GAME)
            or C.TARGET_LEVELS != 3):
        raise ValueError('Invalid immutable case contract')
    lock_path = Path('/workspace/shared/sra-coordination') / (C.GAME.lower() + '.lock')
    with lock_path.open('a+b') as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.operation == 'initialize':
            admission = contract.get('admissionEvidence')
            if not isinstance(admission, dict) or C.fingerprint(C.inside(admission.get('path', ''))) != admission:
                raise ValueError('The immutable contract must bind an explicit prior-activity admission review')
            review = C.read_json(C.inside(admission['path']))
            if (review.get('game') != C.GAME or review.get('priorMatchingCaseEvidenceFound') is not False
                    or review.get('caseSpecificExecutionStarted') is not False or not review.get('searches')):
                raise ValueError('No explicit new-case admission has been established')
            clock = {'schema': C.SCHEMA, 'game': C.GAME, 'maximumCumulativeSeconds': 2400,
                     'clockReset': False, 'initialAccounting': {'newCase': True, 'chargedSeconds': 0,
                         'caseContract': C.fingerprint(C.CASE_CONTRACT), 'admissionEvidence': admission},
                     'attempts': [], 'cumulativeChargedSeconds': 0, 'remainingSeconds': 2400,
                     'budgetExceededSeconds': 0, 'budgetAvailability': 'available', 'lastUpdatedAt': C.now()}
            C.write_json(C.CLOCK, clock)
            print('Initialized one new cumulative case clock; no game launched.')
            return
        clock = C.read_json(C.inside(C.CLOCK))
        if args.operation in ['start', 'verify']:
            total, remaining = C.validate_clock(clock)
            if args.operation == 'verify':
                print({'chargedSeconds': float(total), 'remainingSeconds': float(remaining), 'attempts': len(clock['attempts'])})
                return
            if (not args.id or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,79}', args.id)
                    or not args.purpose or args.ceiling_seconds is None
                    or not 0 < args.ceiling_seconds <= 600
                    or Decimal(str(args.ceiling_seconds + 5)) > remaining):
                raise ValueError('A unique activity id, purpose and admissible <=600s ceiling are required')
            out = HERE / 'case-activities' / args.id
            out.mkdir(parents=True, exist_ok=False)
            entry = {'attemptId': C.name(out), 'status': 'running', 'kind': 'diagnostic_or_browser',
                     'purpose': args.purpose, 'game': C.GAME, 'targetLevels': C.TARGET_LEVELS,
                     'startedAt': C.now(), 'monotonicStartNs': time.monotonic_ns(),
                     'bootId': Path('/proc/sys/kernel/random/boot_id').read_text().strip(),
                     'priorCumulativeSeconds': float(total), 'activityCeilingSeconds': args.ceiling_seconds,
                     'chargedSeconds': None, 'processPidAtAdmission': os.getpid()}
            entry['executionHelpers'] = [C.fingerprint(Path(__file__)), C.fingerprint(HERE / 'run-clocked-proof.py')]
            C.write_json(out / 'activity-start.json', entry)
            clock['attempts'].append(entry)
            clock.update(budgetAvailability='blocked_by_running_attempt', lastUpdatedAt=C.now())
            C.write_json(C.CLOCK, clock, replace=True)
            print({'activity': args.id, 'startedAt': entry['startedAt'], 'ceilingSeconds': args.ceiling_seconds,
                   'remainingBeforeSeconds': float(remaining)})
            return
        if not args.id or not args.status:
            raise ValueError('Finish requires the active id and its actual status')
        entry = clock['attempts'][-1]
        if (entry.get('status') != 'running' or entry.get('kind') != 'diagnostic_or_browser'
                or entry['attemptId'] != C.name(HERE / 'case-activities' / args.id)
                or entry['bootId'] != Path('/proc/sys/kernel/random/boot_id').read_text().strip()):
            raise ValueError('An exact running interval on the same monotonic clock is required; no reset is permitted')
        prior_clock = {**clock, 'attempts': clock['attempts'][:-1],
                       'cumulativeChargedSeconds': entry['priorCumulativeSeconds'],
                       'remainingSeconds': float(max(Decimal(0), C.MAXIMUM_SECONDS - Decimal(str(entry['priorCumulativeSeconds']))))}
        total, _ = C.validate_clock(prior_clock)
        helpers_unchanged = all(C.fingerprint(C.inside(row['path'])) == row for row in entry['executionHelpers'])
        evidence = [C.fingerprint(C.inside(name)) for name in args.evidence]
        seconds = (time.monotonic_ns() - entry['monotonicStartNs']) / 1_000_000_000
        receipt = {'schema': 'logos-engine.lot10c.case-activity-execution.v1', 'attemptId': entry['attemptId'],
                   'game': C.GAME, 'purpose': entry['purpose'], 'startedAt': entry['startedAt'],
                   'finishedAt': C.now(), 'status': args.status, 'elapsedSecondsThroughCapture': seconds,
                   'activityCeilingSeconds': entry['activityCeilingSeconds'], 'ceilingExceeded': seconds > entry['activityCeilingSeconds'],
                   'evidence': evidence, 'generator': C.fingerprint(Path(__file__)),
                   'executionHelpersUnchanged': helpers_unchanged,
                   'qualification': 'The entire observed diagnostic/browser interval is charged, including any ceiling excess. No new campaign or success is inferred.'}
        path = C.ROOT / entry['attemptId'] / 'execution.json'
        C.write_json(path, receipt)
        fingerprint = C.fingerprint(path)
        charge = C.finite_seconds((time.monotonic_ns() - entry['monotonicStartNs']) / 1_000_000_000)
        total += charge
        entry.update(status='terminal', finishedAt=C.now(), chargedSeconds=float(charge),
                     executionReceipt=fingerprint, outcome=args.status, ceilingExceeded=float(charge) > entry['activityCeilingSeconds'])
        clock.update(cumulativeChargedSeconds=float(total), remainingSeconds=float(max(Decimal(0), C.MAXIMUM_SECONDS-total)),
                     budgetExceededSeconds=float(max(Decimal(0), total-C.MAXIMUM_SECONDS)),
                     budgetAvailability='exhausted' if total >= C.MAXIMUM_SECONDS else 'available', lastUpdatedAt=C.now())
        C.write_json(C.CLOCK, clock, replace=True)
        print({'activity': args.id, 'chargedSeconds': float(charge), 'remainingSeconds': clock['remainingSeconds'],
               'ceilingExceeded': entry['ceilingExceeded']})


if __name__ == '__main__':
    main()
