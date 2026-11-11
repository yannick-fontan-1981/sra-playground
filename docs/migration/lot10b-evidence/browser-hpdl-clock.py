#!/usr/bin/env python3
"""Bracket an observed browser QA interval in the one cumulative HPDL clock.

No browser, game, host, reset or agent operation is performed by this script.
Pause the browser agent before closing the interval; pauses/debugging remain
charged. The declared 180-second limit is observed, not an invented UI stop.

Begin in a retained foreground session and wait for the flushed `ready` event:
  python -B docs/migration/lot10b-evidence/browser-hpdl-clock.py begin --hold \
    --directory docs/migration/lot10b-evidence/recovery-20261111/hpdl-browser-01

After actual CUA observations have been saved as independent evidence:
  python -B docs/migration/lot10b-evidence/browser-hpdl-clock.py end \
    --begin-receipt <attempt>/browser-begin.json --observation <actual-observation> \
    --actions-observed unknown --levels-completed-observed unknown \
    --artifact <actual-screenshot-or-other-evidence>

The begin process holds performance SH + HPDL EX and performs its own closure.
The external end command only publishes an immutable request and waits for the
holder's actual receipt. Separate exec commands may use distinct PID namespaces;
an external PID lookup therefore never authenticates or performs a closure.
Death of the holder before terminalization leaves a blocking running entry.
If the holder writes its immutable receipt but fails before publishing closed,
a later request cannot overwrite it and the holder keeps waiting. Reconcile the retained
receipt/ledger explicitly; do not delete evidence or silently refund the interval.
"""
from __future__ import annotations

import time

PROCESS_STARTED_NS = time.monotonic_ns()
PROCESS_STARTED_WALL_NS = time.time_ns()

import argparse
from contextlib import contextmanager, ExitStack
from datetime import datetime, timezone
from decimal import Decimal
import fcntl
import importlib.util
import json
import math
import os
from pathlib import Path
import signal
from types import SimpleNamespace
import uuid

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
PROOF_PATH = HERE / 'run-hpdl-clocked-proof.py'
SPEC = importlib.util.spec_from_file_location('lot10b_hpdl_clock_proof', PROOF_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError('The shared cumulative clock reader is unavailable')
proof = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(proof)

LEDGER_LOCK = Path('/workspace/shared/sra-coordination/hpdl-clock-ledger.lock')
BOOT_ID = Path('/proc/sys/kernel/random/boot_id')
MAXIMUM_PLANNED_SECONDS = 180.0
BEGIN_SCHEMA = 'logos-engine.lot10b.hpdl-browser-begin.v1'
EXECUTION_SCHEMA = 'logos-engine.lot10b.hpdl-browser-execution.v1'
CLOSURE_SCHEMA = 'logos-engine.lot10b.hpdl-browser-closure.v1'
REQUEST_SCHEMA = 'logos-engine.lot10b.hpdl-browser-end-request.v1'
RESPONSE_SCHEMA = 'logos-engine.lot10b.hpdl-browser-end-response.v1'
END_REASONS = ('qa_finished', 'operator_interrupted', 'declared_deadline', 'capture_incomplete')


def stamp_from_ns(value):
    return datetime.fromtimestamp(value / 1_000_000_000, timezone.utc).isoformat()


def current_boot():
    value = BOOT_ID.read_text().strip()
    if not value:
        raise RuntimeError('The Linux boot identity is unavailable')
    return value


def process_identity(pid):
    if isinstance(pid, bool) or not isinstance(pid, int) or pid <= 0:
        raise ValueError('Invalid holder process identifier')
    # /proc/PID/stat field 22; comm may contain spaces and parentheses.
    text = Path(f'/proc/{pid}/stat').read_text()
    fields = text[text.rfind(')') + 2:].split()
    if len(fields) <= 19 or fields[0] in ('Z', 'X'):
        raise RuntimeError('The recorded browser clock holder is not alive')
    return {'pid': pid, 'bootId': current_boot(), 'processStartTicks': fields[19],
            'pidNamespace': os.readlink('/proc/self/ns/pid')}


def interval_seconds(start_ns, stop_ns=None):
    stop = time.monotonic_ns() if stop_ns is None else stop_ns
    if stop < start_ns:
        raise ValueError('Monotone time precedes the recorded interval start')
    return Decimal(stop - start_ns) / Decimal(1_000_000_000)


def monotone_start(document):
    value = document.get('monotonicStartedNs')
    if not isinstance(value, str) or not value.isdecimal():
        raise ValueError('The original monotone start is missing')
    return int(value)


def observed_count(value):
    if value == 'unknown':
        return None
    if not value.isdecimal():
        raise argparse.ArgumentTypeError('Use a nonnegative observed count or the literal unknown')
    return int(value)


@contextmanager
def mutation_lock(nonblocking=False):
    with LEDGER_LOCK.open('a+b') as stream:
        mode = fcntl.LOCK_EX | (fcntl.LOCK_NB if nonblocking else 0)
        fcntl.flock(stream.fileno(), mode)
        try:
            yield
        finally:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def input_fingerprints():
    return {'browserClockHelper': proof.fingerprint(Path(__file__).resolve()),
            'cumulativeClockReader': proof.fingerprint(PROOF_PATH)}


def evidence_inputs(observation, artifacts):
    paths = []
    if observation is not None:
        paths.append(proof.inside(observation))
    for argument in artifacts:
        path = proof.inside(argument)
        if path not in paths:
            paths.append(path)
    values = [proof.fingerprint(path) for path in paths]
    if any(value['bytes'] == 0 for value in values):
        raise ValueError('An observation/artifact cannot be an empty file')
    return values


def verify_retained_inputs(records):
    if not isinstance(records, list):
        raise ValueError('The independently retained evidence inventory is missing')
    current = []
    for record in records:
        path = proof.inside(record.get('path', ''))
        actual = proof.fingerprint(path)
        if actual != record:
            raise ValueError('Retained observation/artifact changed: ' + proof.name(path))
        current.append(actual)
    return current


def active_entry(clock, begin, begin_fingerprint):
    attempts = clock.get('attempts')
    if not isinstance(attempts, list) or not attempts:
        raise ValueError('No admitted browser interval exists')
    entry = attempts[-1]
    if (entry.get('status') != 'running' or entry.get('kind') != 'browser_qa'
            or entry.get('attemptId') != begin.get('attemptId')
            or entry.get('beginReceipt') != begin_fingerprint):
        raise ValueError('The begin receipt does not identify the one running browser interval')
    # Validate the actual completed prefix with the shared reader. The running
    # debit is not replaced by a fabricated terminal or zero-duration receipt.
    prefix = dict(clock)
    prefix['attempts'] = attempts[:-1]
    prior, remaining = proof.validate_clock(prefix)
    if (entry.get('priorCumulativeSeconds') != float(prior)
            or begin.get('priorCumulativeSeconds') != float(prior)
            or entry.get('remainingBeforeSeconds') != float(remaining)
            or begin.get('remainingBeforeSeconds') != float(remaining)):
        raise ValueError('The admitted interval is not bound to the retained cumulative prefix')
    return entry, prior, remaining


def validate_begin_locally(path):
    begin = proof.read_json(path)
    if begin.get('schema') != BEGIN_SCHEMA or begin.get('game') != 'HPDL':
        raise ValueError('Wrong browser interval begin receipt')
    if begin.get('holder', {}).get('bootId') != current_boot():
        raise ValueError('A different boot prevents monotone closure; preserve the running entry for reconciliation')
    if process_identity(os.getpid()) != begin['holder']:
        raise ValueError('The original live holder identity changed; no implicit closure or refund')
    start_ns = monotone_start(begin)
    interval_seconds(start_ns)
    if begin.get('executionInputs') != input_fingerprints():
        raise ValueError('The browser clock helper or cumulative reader changed during the interval')
    verify_retained_inputs([begin.get('priorClock', {})])
    verify_retained_inputs(begin.get('preActionEvidence'))
    out = path.parent
    if proof.name(out) != begin.get('attemptId') or path.name != 'browser-begin.json':
        raise ValueError('The receipt must stay in its original exclusive interval directory')
    ready = proof.read_json(out / 'browser-ready.json')
    receipt = proof.fingerprint(path)
    if (ready.get('schema') != 'logos-engine.lot10b.hpdl-browser-ready.v1'
            or ready.get('attemptId') != begin['attemptId'] or ready.get('beginReceipt') != receipt):
        raise ValueError('The holder did not publish a matching ready receipt')
    return begin, receipt, start_ns


def begin_interval(args):
    planned = args.planned_seconds
    if not args.hold:
        raise ValueError('Use begin --hold and retain its foreground session during browser QA')
    if not math.isfinite(planned) or not 0 < planned <= MAXIMUM_PLANNED_SECONDS:
        raise ValueError('The declared browser interval must be positive and at most 180 seconds')
    out = proof.inside(args.directory, must_exist=False)
    if not out.is_relative_to(proof.EVIDENCE) or out == proof.EVIDENCE or out.exists():
        raise ValueError('Use a new exclusive browser interval directory below lot10b-evidence')
    holder = process_identity(os.getpid())
    received = []

    def on_signal(number, _frame):
        received.append({'signal': number, 'receivedAt': proof.now(),
                         'monotonicObservedNs': str(time.monotonic_ns())})

    for number in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(number, on_signal)

    with ExitStack() as locks:
        for path, mode in [(proof.PERFORMANCE_LOCK, fcntl.LOCK_SH), (proof.HPDL_LOCK, fcntl.LOCK_EX)]:
            stream = locks.enter_context(path.open('a+b'))
            fcntl.flock(stream.fileno(), mode | fcntl.LOCK_NB)
        with mutation_lock():
            clock_bytes = proof.CLOCK.read_bytes()
            clock = proof.decode_json(clock_bytes)
            prior, remaining = proof.validate_clock(clock)
            if Decimal(str(planned + proof.RETENTION_RESERVE_SECONDS)) > remaining:
                raise ValueError('The planned browser interval plus retention reserve exceeds the shared HPDL budget')
            observed_inputs = evidence_inputs(args.observation, args.artifact)
            if received:
                raise RuntimeError('Interrupted before browser admission; no ready authority was emitted')
            out.mkdir(parents=True, exist_ok=False)
            proof.fsync_directory(out.parent)
            attempt_id = proof.name(out)
            proof.atomic_bytes(out / 'clock-before.json', clock_bytes)
            start_ns = PROCESS_STARTED_NS
            deadline_ns = start_ns + int(Decimal(str(planned)) * Decimal(1_000_000_000))
            begin = {'schema': BEGIN_SCHEMA, 'attemptId': attempt_id, 'game': 'HPDL', 'kind': 'browser_qa',
                     'startedAt': stamp_from_ns(PROCESS_STARTED_WALL_NS), 'admittedAt': proof.now(),
                     'monotonicStartedNs': str(start_ns), 'declaredDeadlineMonotonicNs': str(deadline_ns),
                     'plannedIntervalSeconds': planned, 'retentionReserveSeconds': proof.RETENTION_RESERVE_SECONDS,
                     'holder': holder, 'priorCumulativeSeconds': float(prior), 'remainingBeforeSeconds': float(remaining),
                     'priorClock': proof.fingerprint(out / 'clock-before.json'),
                     'executionInputs': input_fingerprints(), 'preActionEvidence': observed_inputs,
                     'performanceLock': str(proof.PERFORMANCE_LOCK), 'hpdlLock': str(proof.HPDL_LOCK),
                     'ledgerMutationLock': str(LEDGER_LOCK), 'startsBrowserOrHost': False,
                     'qualification': 'Admission precedes browser actions. The foreground holder only retains locks and observes time. '
                         'No browser action, new host, learned state, reset, action count, level count or game result is supplied. '
                         'The operator must pause the browser agent at the declared deadline and before end.'}
            begin_path = out / 'browser-begin.json'
            proof.write_json(begin_path, begin)
            begin_fingerprint = proof.fingerprint(begin_path)
            clock['attempts'].append({'attemptId': attempt_id, 'kind': 'browser_qa', 'game': 'HPDL', 'status': 'running',
                                     'startedAt': begin['startedAt'], 'admittedAt': begin['admittedAt'],
                                     'priorCumulativeSeconds': float(prior), 'remainingBeforeSeconds': float(remaining),
                                     'plannedIntervalSeconds': planned, 'chargedSeconds': None,
                                     'holder': holder, 'beginReceipt': begin_fingerprint,
                                     'qualification': 'A live browser interval is open. Pauses and debugging remain charged; no implicit refund.'})
            clock['budgetAvailability'] = 'blocked_by_running_attempt'
            clock['lastUpdatedAt'] = proof.now()
            proof.write_json(proof.CLOCK, clock, replace=True)
            ready = {'schema': 'logos-engine.lot10b.hpdl-browser-ready.v1', 'attemptId': attempt_id,
                     'beginReceipt': begin_fingerprint, 'readyAt': proof.now(),
                     'monotonicObservedNs': str(time.monotonic_ns()),
                     'remainingUntilDeclaredDeadlineSeconds': max(0.0, (deadline_ns - time.monotonic_ns()) / 1_000_000_000),
                     'locksHeld': ['performance:shared', 'hpdl:exclusive'],
                     'qualification': 'Clock admitted and locks retained. No browser action has been performed by this script.'}
            proof.write_json(out / 'browser-ready.json', ready)
        print(json.dumps({'event': 'ready', **ready}), flush=True)

        deadline_observed = False
        processed_requests = set()
        try:
            while True:
                closing_path = out / 'browser-closed.json'
                if received and not closing_path.exists():
                    stop = {'schema': 'logos-engine.lot10b.hpdl-browser-holder-interrupted.v1',
                            'attemptId': attempt_id, 'recordedAt': proof.now(), 'signals': received,
                            'elapsedSecondsObserved': float(interval_seconds(start_ns)),
                            'qualification': 'The holder stops without observing a valid closed receipt. Preserve the actual ledger state and every partial terminalization file; no game stop, additional debit or refund is invented.'}
                    proof.write_json(out / 'browser-holder-interrupted.json', stop)
                    print(json.dumps({'event': 'holder_interrupted', **stop}), flush=True)
                    return 130
                if closing_path.exists():
                    with mutation_lock():
                        closing = proof.read_json(closing_path)
                        current = proof.read_json(proof.CLOCK)
                        proof.validate_clock(current)
                        entry = current['attempts'][-1]
                        if (closing.get('schema') != CLOSURE_SCHEMA or closing.get('attemptId') != attempt_id
                                or closing.get('beginReceipt') != begin_fingerprint
                                or entry.get('attemptId') != attempt_id or entry.get('status') != 'terminal'
                                or entry.get('executionReceipt') != closing.get('executionReceipt')):
                            raise ValueError('The closing receipt does not match the terminal cumulative debit')
                        released = {'schema': 'logos-engine.lot10b.hpdl-browser-holder-release.v1',
                                    'attemptId': attempt_id, 'recordedAt': proof.now(),
                                    'observedClosure': proof.fingerprint(closing_path),
                                    'receivedSignals': received,
                                    'qualification': 'The foreground holder observed the actual terminal closure and is now releasing its locks. No browser state is inferred.'}
                        proof.write_json(out / 'browser-holder-release.json', released)
                    print(json.dumps({'event': 'holder_releasing', **released}), flush=True)
                    return 0
                for request_path in sorted(out.glob('browser-end-request-*.json')):
                    if request_path.name in processed_requests:
                        continue
                    processed_requests.add(request_path.name)
                    handle_end_request_locally(request_path, begin_path, begin_fingerprint)
                    if closing_path.exists():
                        break
                if closing_path.exists():
                    continue
                observed_ns = time.monotonic_ns()
                if not deadline_observed and observed_ns >= deadline_ns:
                    notice = {'schema': 'logos-engine.lot10b.hpdl-browser-deadline-observed.v1',
                              'attemptId': attempt_id, 'recordedAt': proof.now(),
                              'declaredDeadlineMonotonicNs': str(deadline_ns), 'monotonicObservedNs': str(observed_ns),
                              'elapsedSecondsObserved': float(interval_seconds(start_ns, observed_ns)),
                              'browserStopObserved': False,
                              'qualification': 'The declared interval deadline has been observed. Pause the browser agent. The clock and locks continue until a verified end; no automatic UI stop or game result is claimed.'}
                    proof.write_json(out / 'browser-deadline-observed.json', notice)
                    print(json.dumps({'event': 'deadline_observed_pause_browser', **notice}), flush=True)
                    deadline_observed = True
                time.sleep(0.1)
        except BaseException as error:
            print(json.dumps({'event': 'holder_error', 'attemptId': attempt_id, 'type': type(error).__name__,
                              'message': str(error), 'qualification': 'No implicit terminalization or refund; inspect the retained running ledger.'}), flush=True)
            raise


def finalize_interval_locally(args, request_record):
    begin_path = proof.inside(args.begin_receipt)
    with mutation_lock():
        begin, begin_fingerprint, start_ns = validate_begin_locally(begin_path)
        out = begin_path.parent
        receipt_path, closing_path = out / 'execution-hpdl-browser.json', out / 'browser-closed.json'
        if receipt_path.exists() or closing_path.exists():
            raise FileExistsError('A browser interval cannot be ended twice or overwrite its retained evidence')
        clock = proof.read_json(proof.CLOCK)
        entry, prior, remaining = active_entry(clock, begin, begin_fingerprint)
        observation_path = proof.inside(args.observation)
        artifacts = evidence_inputs(args.observation, args.artifact)
        # Independent retained artifacts are bound as supplied, not generated by
        # this script. Counts are explicitly attributed to the CUA observation.
        observation = proof.fingerprint(observation_path)
        if not artifacts or observation != artifacts[0]:
            raise ValueError('The retained CUA observation changed during capture')
        artifacts_after = verify_retained_inputs(artifacts)
        request_path = proof.inside(request_record['path'])
        request = proof.read_json(request_path)
        if (proof.fingerprint(request_path) != request_record or request.get('observation') != observation
                or request.get('artifacts') != artifacts
                or request.get('reportedObservation') != {'actionsDuringInterval': args.actions_observed,
                                                          'levelsCompletedAtEnd': args.levels_completed_observed}
                or request.get('reason') != args.reason):
            raise ValueError('The terminal capture differs from the immutable end request')
        inputs_after = input_fingerprints()
        if inputs_after != begin['executionInputs']:
            raise ValueError('The execution inputs changed during capture; preserve the running interval for reconciliation')
        if process_identity(os.getpid()) != begin['holder']:
            raise ValueError('The original holder died during capture; no unverified closure')
        capture_stop_ns = time.monotonic_ns()
        through_capture = interval_seconds(start_ns, capture_stop_ns)
        planned = Decimal(str(begin['plannedIntervalSeconds']))
        elapsed_past_plan = max(Decimal(0), through_capture - planned)
        receipt = {'schema': EXECUTION_SCHEMA, 'attemptId': begin['attemptId'], 'game': 'HPDL', 'kind': 'browser_qa',
                   'startedAt': begin['startedAt'], 'captureFinishedAt': proof.now(),
                   'bootId': begin['holder']['bootId'], 'holder': begin['holder'],
                   'monotonicStartedNs': str(start_ns), 'monotonicCaptureStoppedNs': str(capture_stop_ns),
                   'elapsedSecondsThroughCapture': float(through_capture),
                   'plannedIntervalSeconds': float(planned), 'elapsedPastDeclaredIntervalSeconds': float(elapsed_past_plan),
                   'priorCumulativeSeconds': float(prior), 'remainingBeforeSeconds': float(remaining),
                   'beginReceipt': begin_fingerprint, 'endRequest': request_record,
                   'clockClosureExecutedByOriginalHolder': True,
                   'holderIdentityScope': 'Verified locally inside the original holder PID namespace; no external PID lookup',
                   'executionInputs': begin['executionInputs'],
                   'executionInputsAfter': inputs_after, 'observation': observation, 'artifacts': artifacts,
                   'artifactsVerifiedUnchanged': artifacts_after == artifacts,
                   'reportedObservation': {
                       'actionsDuringInterval': args.actions_observed,
                       'levelsCompletedAtEnd': args.levels_completed_observed,
                       'actionsKnown': args.actions_observed is not None,
                       'levelsKnown': args.levels_completed_observed is not None,
                       'provenance': 'Explicit operator declaration from the retained actual CUA observation; unknown remains null.',
                       'countsAutomaticallyInferred': False,
                   },
                   'endReason': args.reason, 'browserStopAutomaticallyEnforced': False,
                   'campaignStatus': None, 'campaignPassedEstablished': False,
                   'qualification': 'This closes one observed browser QA interval in the existing shared HPDL clock. '
                       'All monotone time, including pauses, debugging and capture, is charged. No action, level, game result '
                       'or new host is invented. The operator supplies actual CUA counts or unknown. A missed declared deadline '
                       'does not establish game failure. Receipt writing and hashing are additionally charged before the atomic terminal ledger update.'}
        proof.write_json(receipt_path, receipt)
        receipt_fingerprint = proof.fingerprint(receipt_path)
        charge_stop_ns = time.monotonic_ns()
        charge = interval_seconds(start_ns, charge_stop_ns)
        total = prior + charge
        entry.update({'status': 'terminal', 'finishedAt': proof.now(), 'chargedSeconds': float(charge),
                      'monotonicChargeStoppedNs': str(charge_stop_ns),
                      'attemptOutcome': 'browser_interval_closed', 'endReason': args.reason,
                      'elapsedPastDeclaredIntervalSeconds': float(max(Decimal(0), charge - planned)),
                      'campaignStatus': None, 'campaignPassedEstablished': False,
                      'observedActionsDeclaredFromCUA': args.actions_observed,
                      'observedLevelsCompletedDeclaredFromCUA': args.levels_completed_observed,
                      'completeActionCountEstablished': False,
                      'executionReceipt': receipt_fingerprint,
                      'qualification': 'The whole same-boot monotone interval is debited without refund. CUA counts are declared observations, not synthetic game events or an automatically established completion.'})
        clock['cumulativeChargedSeconds'] = float(total)
        clock['remainingSeconds'] = float(max(Decimal(0), proof.MAXIMUM_SECONDS - total))
        clock['budgetExceededSeconds'] = float(max(Decimal(0), total - proof.MAXIMUM_SECONDS))
        clock['budgetAvailability'] = 'exhausted' if total >= proof.MAXIMUM_SECONDS else 'available'
        clock['lastUpdatedAt'] = proof.now()
        # Check compatibility with the shared reader before installing the state.
        proof.validate_clock(clock)
        proof.write_json(proof.CLOCK, clock, replace=True)
        closing = {'schema': CLOSURE_SCHEMA, 'attemptId': begin['attemptId'], 'closedAt': proof.now(),
                   'beginReceipt': begin_fingerprint, 'executionReceipt': receipt_fingerprint,
                   'endRequest': request_record, 'clockClosureExecutedByOriginalHolder': True,
                   'chargedSeconds': float(charge), 'remainingSeconds': clock['remainingSeconds'],
                   'qualification': 'The terminal debit is persisted. The retained foreground holder may verify this receipt and release its locks.'}
        proof.write_json(closing_path, closing)
    print(json.dumps({'event': 'interval_closed', **closing}), flush=True)
    return 0


def handle_end_request_locally(request_path, begin_path, begin_fingerprint):
    """Only the retained holder invokes the terminalization routine."""
    request_record = proof.fingerprint(request_path)
    request_id = request_path.stem.removeprefix('browser-end-request-')
    if len(request_id) != 32 or any(char not in '0123456789abcdef' for char in request_id):
        raise ValueError('Malformed immutable browser end request name')
    response_path = request_path.with_name(f'browser-end-response-{request_id}.json')
    response = {'schema': RESPONSE_SCHEMA, 'request': request_record,
                'requestId': request_id, 'respondedBy': 'original_foreground_holder'}
    try:
        request = proof.read_json(request_path)
        begin = proof.read_json(begin_path)
        if (request.get('schema') != REQUEST_SCHEMA or request.get('requestId') != request_id
                or request.get('attemptId') != begin['attemptId'] or request.get('beginReceipt') != begin_fingerprint
                or request.get('bootId') != begin['holder']['bootId']
                or request.get('executionInputs') != begin['executionInputs']
                or request.get('reason') not in END_REASONS):
            raise ValueError('The end request does not identify the original admitted interval and inputs')
        verify_retained_inputs([request.get('observation', {})])
        verify_retained_inputs(request.get('artifacts'))
        counts = request.get('reportedObservation', {})
        for key in ('actionsDuringInterval', 'levelsCompletedAtEnd'):
            if key not in counts or (counts[key] is not None and (type(counts[key]) is not int or counts[key] < 0)):
                raise ValueError('An explicit nonnegative observed count or null is required')
        if proof.fingerprint(request_path) != request_record:
            raise ValueError('The immutable end request changed while being checked')
        local_args = SimpleNamespace(begin_receipt=str(begin_path), observation=request['observation']['path'],
            artifact=[item['path'] for item in request['artifacts']], actions_observed=counts['actionsDuringInterval'],
            levels_completed_observed=counts['levelsCompletedAtEnd'], reason=request['reason'])
        finalize_interval_locally(local_args, request_record)
        closing_path = begin_path.parent / 'browser-closed.json'
        closing = proof.read_json(closing_path)
        response.update(status='closed', closure=proof.fingerprint(closing_path),
                        executionReceipt=closing['executionReceipt'], chargedSeconds=closing['chargedSeconds'],
                        remainingSeconds=closing['remainingSeconds'])
    except BaseException as error:
        response.update(status='rejected_or_incomplete', error={'type': type(error).__name__, 'message': str(error)},
                        qualification='No external process calculates or replaces the debit. Retain all files and inspect any partial terminalization before retrying.')
    response['recordedAt'] = proof.now()
    proof.write_json(response_path, response)
    print(json.dumps({'event': 'end_request_processed', **response}), flush=True)


def end_interval(args):
    """External commands request closure; they never mutate the cumulative clock."""
    if not math.isfinite(args.wait_seconds) or not 0 < args.wait_seconds <= 60:
        raise ValueError('The receipt wait must be positive and at most 60 seconds')
    begin_path = proof.inside(args.begin_receipt)
    with mutation_lock():
        begin = proof.read_json(begin_path)
        if (begin.get('schema') != BEGIN_SCHEMA or begin.get('game') != 'HPDL'
                or begin.get('holder', {}).get('bootId') != current_boot()):
            raise ValueError('The end request must refer to an admitted HPDL interval in this same boot')
        out = begin_path.parent
        if begin_path.name != 'browser-begin.json' or proof.name(out) != begin.get('attemptId'):
            raise ValueError('Use the original exclusive interval directory')
        begin_fingerprint = proof.fingerprint(begin_path)
        clock = proof.read_json(proof.CLOCK)
        active_entry(clock, begin, begin_fingerprint)
        ready = proof.read_json(out / 'browser-ready.json')
        if ready.get('beginReceipt') != begin_fingerprint or ready.get('attemptId') != begin['attemptId']:
            raise ValueError('The original holder did not publish a matching ready receipt')
        inputs = input_fingerprints()
        if inputs != begin['executionInputs']:
            raise ValueError('The clock helper or shared reader changed after admission')
        artifacts = evidence_inputs(args.observation, args.artifact)
        request_id = uuid.uuid4().hex
        request = {'schema': REQUEST_SCHEMA, 'requestId': request_id, 'attemptId': begin['attemptId'],
                   'requestedAt': proof.now(), 'bootId': current_boot(), 'beginReceipt': begin_fingerprint,
                   'executionInputs': inputs, 'observation': artifacts[0], 'artifacts': artifacts,
                   'reportedObservation': {'actionsDuringInterval': args.actions_observed,
                                           'levelsCompletedAtEnd': args.levels_completed_observed},
                   'reason': args.reason,
                   'qualification': 'This external command only requests closure from the original holder. It does not look up a foreign PID, calculate a terminal charge, mutate the ledger or claim a browser result.'}
        request_path = out / f'browser-end-request-{request_id}.json'
        response_path = out / f'browser-end-response-{request_id}.json'
        proof.write_json(request_path, request)
        request_record = proof.fingerprint(request_path)
    print(json.dumps({'event': 'end_requested', 'request': request_record, 'requestId': request_id}), flush=True)
    wait_until = time.monotonic() + args.wait_seconds
    while time.monotonic() < wait_until:
        if response_path.exists():
            response = proof.read_json(response_path)
            if (response.get('schema') != RESPONSE_SCHEMA or response.get('request') != request_record
                    or response.get('requestId') != request_id or response.get('respondedBy') != 'original_foreground_holder'):
                raise ValueError('The observed response is not bound to this actual end request')
            if response.get('status') == 'closed':
                verify_retained_inputs([response['closure'], response['executionReceipt']])
                closing = proof.read_json(proof.inside(response['closure']['path']))
                if closing.get('endRequest') != request_record or closing.get('clockClosureExecutedByOriginalHolder') is not True:
                    raise ValueError('The terminal closure did not originate from the holder processing this request')
            print(json.dumps({'event': 'end_response_observed', 'response': proof.fingerprint(response_path), **response}), flush=True)
            return 0 if response.get('status') == 'closed' else 1
        time.sleep(0.1)
    print(json.dumps({'event': 'end_request_pending', 'request': request_record,
                      'qualification': 'No response was observed within this wait. This is not a game failure or a clock closure; retain the request and inspect the original holder session.'}), flush=True)
    return 1


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest='operation', required=True)
    begin = commands.add_parser('begin', help='Persist admission, emit ready, and retain the foreground lock holder')
    begin.add_argument('--hold', action='store_true', required=True)
    begin.add_argument('--directory', required=True)
    begin.add_argument('--planned-seconds', type=float, default=180.0)
    begin.add_argument('--observation', help='Optional actual pre-action browser observation already retained')
    begin.add_argument('--artifact', action='append', default=[])
    end = commands.add_parser('end', help='Request closure from the original holder using explicit retained CUA observations')
    end.add_argument('--begin-receipt', required=True)
    end.add_argument('--observation', required=True)
    end.add_argument('--artifact', action='append', default=[])
    end.add_argument('--actions-observed', type=observed_count, required=True)
    end.add_argument('--levels-completed-observed', type=observed_count, required=True)
    end.add_argument('--reason', choices=END_REASONS, default='qa_finished')
    end.add_argument('--wait-seconds', type=float, default=30.0)
    args = parser.parse_args()
    return begin_interval(args) if args.operation == 'begin' else end_interval(args)


if __name__ == '__main__':
    raise SystemExit(main())
