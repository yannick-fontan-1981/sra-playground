#!/usr/bin/env python3
"""Retain the authorized post-HPDL01 work debit after the real 6A quiet release.

This is bookkeeping for an already observed UTC wall interval, not gameplay,
an execution timer, or an invented monotone measurement. The two observed bounds
are 2026-11-11T12:39:50.403851Z and 2026-11-11T12:47:20.858378Z: 450.454527
seconds, conservatively rounded up to a nonrefundable 451-second case debit.
The 6A quiet interval after the second bound is excluded.

Run only after the real quiet release has been copied, and before admitting the
next HPDL interval. Choose --release-time-pointer from the actual copied 6A
status; do not manufacture a timestamp or release field. That status must retain
this quiet_request_id and explicitly set quiet_requested=false.

  python -B docs/migration/lot10b-evidence/record-hpdl-conservative-case-work.py \
    --prior-execution <HPDL01>/execution-hpdl.json \
    --quiet-ack docs/migration/lot10b-evidence/recovery-20261111/hpdl-analysis-after01/quiet-acknowledgement.json \
    --quiet-release docs/migration/lot10b-evidence/recovery-20261111/hpdl-analysis-after01/quiet-release.json \
    --release-time-pointer /ACTUAL_OBSERVED_TIMESTAMP_FIELD \
    --output docs/migration/lot10b-evidence/recovery-20261111/hpdl-analysis-after01/hpdl-conservative-case-work.json

No game, browser, source comparison, test, replay, build or cost is run here.
"""
from __future__ import annotations

import argparse
from contextlib import ExitStack
from datetime import datetime
from decimal import Decimal, ROUND_CEILING
import fcntl
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
PROOF_PATH = BASE / 'run-hpdl-clocked-proof.py'
SPEC = importlib.util.spec_from_file_location('lot10b_hpdl_clock_reader', PROOF_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError('The retained cumulative clock reader is unavailable')
proof = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(proof)

SCHEMA = 'logos-engine.lot10b.hpdl-conservative-case-work.v1'
LEDGER_LOCK = Path('/workspace/shared/sra-coordination/hpdl-clock-ledger.lock')
OBSERVED_START = '2026-11-11T12:39:50.403851Z'
OBSERVED_END = '2026-11-11T12:47:20.858378Z'
QUIET_REQUEST = 'lot6a-reconstruction-ea2b5228-final-window'


def instant(value):
    if not isinstance(value, str):
        raise ValueError('Missing actual observed UTC timestamp')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('The observed timestamp must include its time zone')
    return parsed


def pointer(document, path):
    if not path.startswith('/'):
        raise ValueError('Use an exact JSON Pointer for the actual release timestamp')
    value = document
    for encoded in path[1:].split('/'):
        key = encoded.replace('~1', '/').replace('~0', '~')
        if isinstance(value, dict):
            value = value[key]
        elif isinstance(value, list) and key.isdecimal():
            value = value[int(key)]
        else:
            raise ValueError('Release timestamp pointer does not identify an observed field')
    return value


def fingerprint_checked(record):
    path = proof.inside(record['path'])
    if proof.fingerprint(path) != record:
        raise ValueError('A retained evidence fingerprint differs: ' + record['path'])
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for option in ('prior-execution', 'quiet-ack', 'quiet-release', 'release-time-pointer', 'output'):
        parser.add_argument('--' + option, required=True)
    args = parser.parse_args()
    output = proof.inside(args.output, must_exist=False)
    if not output.is_relative_to(BASE) or output.name != 'hpdl-conservative-case-work.json' or output.exists():
        raise ValueError('Use a new exclusive hpdl-conservative-case-work.json below lot10b-evidence')
    prior_path, ack_path, release_path = (proof.inside(value) for value in
                                        (args.prior_execution, args.quiet_ack, args.quiet_release))
    if ack_path == release_path:
        raise ValueError('Keep separate immutable acknowledgement and actual release copies')
    with ExitStack() as locks:
        for path, mode in [(proof.PERFORMANCE_LOCK, fcntl.LOCK_SH), (proof.HPDL_LOCK, fcntl.LOCK_EX), (LEDGER_LOCK, fcntl.LOCK_EX)]:
            stream = locks.enter_context(path.open('a+b'))
            fcntl.flock(stream.fileno(), mode | fcntl.LOCK_NB)
        clock_bytes = proof.CLOCK.read_bytes()
        clock = proof.decode_json(clock_bytes)
        prior_total, remaining = proof.validate_clock(clock)
        prior_receipt = proof.fingerprint(prior_path)
        if not clock['attempts'] or clock['attempts'][-1].get('executionReceipt') != prior_receipt:
            raise ValueError('Book this known interval immediately after HPDL01 and before a later HPDL admission')
        previous = clock['attempts'][-1]
        prior = proof.read_json(prior_path)
        if (prior.get('schema') != 'logos-engine.lot10b.hpdl-clocked-execution.v1'
                or prior.get('attemptId') != previous.get('attemptId') or prior.get('game') != 'HPDL'
                or instant(previous['finishedAt']) != instant(OBSERVED_START)):
            raise ValueError('The observed start must be the exact real HPDL01 terminal ledger boundary')
        ack, release = proof.read_json(ack_path), proof.read_json(release_path)
        if (ack.get('schema') != 'sra.shared-lane-status.v1' or ack.get('lane') != '10B'
                or ack.get('quiet_request_id') != QUIET_REQUEST or ack.get('quiet_acknowledged') is not True
                or ack.get('preview_stopped') is not True or ack.get('heavy_execution_active') is not False
                or instant(ack.get('quiet_acknowledged_at')) != instant(OBSERVED_END)):
            raise ValueError('The copied quiet acknowledgement does not contain the actual observed stop boundary')
        if (release.get('lot') != '6A PreviewPacking' or release.get('quiet_request_id') != QUIET_REQUEST
                or release.get('quiet_requested') is not False):
            raise ValueError('The actual 6A quiet request has not been explicitly released in the retained status copy')
        release_value = pointer(release, args.release_time_pointer)
        if not instant(OBSERVED_END) <= instant(release_value) <= instant(proof.now()):
            raise ValueError('The observed release timestamp is missing, premature or in the future')
        delta = instant(OBSERVED_END) - instant(OBSERVED_START)
        wall_seconds = Decimal(delta.days * 86400 + delta.seconds) + Decimal(delta.microseconds) / Decimal(1_000_000)
        charge = wall_seconds.to_integral_value(rounding=ROUND_CEILING)
        if wall_seconds != Decimal('450.454527') or charge != Decimal(451):
            raise ValueError('The retained observed bounds no longer yield the authorized conservative debit')
        inputs = {'priorExecution': prior_receipt, 'quietAcknowledgement': proof.fingerprint(ack_path),
                  'quietRelease': proof.fingerprint(release_path), 'generator': proof.fingerprint(Path(__file__).resolve()),
                  'cumulativeClockReader': proof.fingerprint(PROOF_PATH)}
        attempt_id = proof.name(output.parent)
        if any(entry.get('attemptId') == attempt_id for entry in clock['attempts']):
            raise ValueError('This conservative case-work debit was already registered')
        output.parent.mkdir(parents=True, exist_ok=True)
        before_path = output.with_name('hpdl-conservative-case-work.prior-clock.json')
        proof.atomic_bytes(before_path, clock_bytes)
        for record in inputs.values():
            fingerprint_checked(record)
        recorded_at = proof.now()
        receipt = {'schema': SCHEMA, 'attemptId': attempt_id, 'kind': 'conservative_case_work', 'game': 'HPDL',
                   'recordedAt': recorded_at, 'startedAt': OBSERVED_START, 'captureFinishedAt': OBSERVED_END,
                   'timestampOrigin': 'Previously observed UTC boundaries, not timestamps generated for a new live execution',
                   'elapsedSecondsThroughCapture': float(wall_seconds), 'chargedSeconds': int(charge),
                   'elapsedBasis': 'observed_utc_wall_interval_conservative_upper_scope',
                   'monotoneMeasurement': False, 'gameplayDurationMeasured': False,
                   'rounding': 'ceil observed wall seconds to a whole second; no refund',
                   'priorCumulativeSeconds': float(prior_total), 'remainingBeforeSeconds': float(remaining),
                   'priorClock': proof.fingerprint(before_path), 'inputs': inputs,
                   'quietBoundary': {'requestId': QUIET_REQUEST, 'acknowledgedAt': OBSERVED_END,
                                     'releaseTimestampPointer': args.release_time_pointer,
                                     'actualReleaseTimestamp': release_value,
                                     'quietIntervalAfterAcknowledgementExcluded': True},
                   'observedActions': None, 'observedLevelsCompleted': None, 'completeActionCountEstablished': False,
                   'campaignStatus': None, 'campaignPassedEstablished': False,
                   'qualification': 'Conservative non-live case-work debit for diagnosis and the wider observed post-game work interval. '
                       'The true UTC boundaries cover 450.454527 seconds; 451 seconds are charged irreversibly. '
                       'This is not a gameplay duration or a monotone measurement, and no actions or levels are inferred. '
                       'The subsequent 6A quiet interval is excluded. The entry is recorded only after the actual quiet release; '
                       'the pre-existing HPDL01 receipt and prior cumulative clock remain intact.'}
        proof.write_json(output, receipt)
        receipt_record = proof.fingerprint(output)
        total = prior_total + charge
        clock['attempts'].append({'attemptId': attempt_id, 'kind': 'conservative_case_work', 'game': 'HPDL',
                                 'status': 'terminal', 'startedAt': OBSERVED_START, 'finishedAt': OBSERVED_END,
                                 'debitedAt': recorded_at, 'chargedSeconds': int(charge),
                                 'priorCumulativeSeconds': float(prior_total), 'remainingBeforeSeconds': float(remaining),
                                 'attemptOutcome': 'observed_non_live_case_work_conservatively_charged',
                                 'clockBasis': receipt['elapsedBasis'], 'monotoneMeasurement': False,
                                 'campaignStatus': None, 'campaignPassedEstablished': False,
                                 'observedActions': None, 'completeActionCountEstablished': False,
                                 'executionReceipt': receipt_record,
                                 'qualification': 'An already observed past work interval is charged, not admitted as a new game. No time, outcome or actions are reset or refunded.'})
        clock['cumulativeChargedSeconds'] = float(total)
        clock['remainingSeconds'] = float(max(Decimal(0), proof.MAXIMUM_SECONDS - total))
        clock['budgetExceededSeconds'] = float(max(Decimal(0), total - proof.MAXIMUM_SECONDS))
        clock['budgetAvailability'] = 'exhausted' if total >= proof.MAXIMUM_SECONDS else 'available'
        clock['lastUpdatedAt'] = proof.now()
        proof.validate_clock(clock)
        proof.write_json(proof.CLOCK, clock, replace=True)
        print(json.dumps({'receipt': receipt_record, 'chargedSeconds': int(charge),
                          'elapsedBasis': receipt['elapsedBasis'], 'cumulativeChargedSeconds': float(total),
                          'remainingSeconds': clock['remainingSeconds'], 'newGameplayExecuted': False}), flush=True)


if __name__ == '__main__':
    main()
