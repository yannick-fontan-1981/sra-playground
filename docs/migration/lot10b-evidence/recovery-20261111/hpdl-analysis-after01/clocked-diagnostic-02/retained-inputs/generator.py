#!/usr/bin/env python3
"""Charge one bounded HPDL evidence diagnostic to the existing cumulative clock.

The closed modes are writer-parity, writer, and parity. They execute only the
retained streaming-writer checker and/or the retained PARTIAL source comparator,
in that order. There is no arbitrary command, shell, game host or native agent.
The configurable ceiling (180 seconds by default, at most 300) includes
preparation, both child processes and capture; 30 seconds inside that ceiling
are reserved for capture. Every measured second
through receipt retention remains charged, including failure and interruption.
The real conservative 451-second HPDL01 debit must already exist in the ledger;
its separate helper requires the actual 6A quiet release before recording it.
"""
from __future__ import annotations

import time

PROCESS_STARTED_NS = time.monotonic_ns()
PROCESS_STARTED_WALL_NS = time.time_ns()

import argparse
from contextlib import ExitStack
import ctypes
from datetime import datetime, timezone
from decimal import Decimal
import fcntl
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys

sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parent
PROOF_PATH = BASE / 'run-hpdl-clocked-proof.py'
SPEC = importlib.util.spec_from_file_location('lot10b_hpdl_diagnostic_clock_reader', PROOF_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError('The retained HPDL cumulative-clock reader is unavailable')
proof = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(proof)
ROOT = proof.ROOT
LEDGER_LOCK = Path('/workspace/shared/sra-coordination/hpdl-clock-ledger.lock')
SCHEMA = 'logos-engine.lot10b.hpdl-clocked-diagnostic.v1'
BEGIN_SCHEMA = 'logos-engine.lot10b.hpdl-diagnostic-begin.v1'
DEFAULT_SECONDS = 180.0
MAXIMUM_SECONDS = 300.0
CAPTURE_RESERVE_SECONDS = 30.0
STOP_MARGIN_SECONDS = 0.5
WRITER = BASE / 'check-stream-evidence-json.mjs'
PARITY = ROOT / 'scripts/compare-window-question-checkpoint-parity.py'
MODES = {'writer-parity': ('writer', 'parity'), 'writer': ('writer',), 'parity': ('parity',)}


class DiagnosticStopped(RuntimeError):
    pass


def seconds_since_start(stop_ns=None):
    stop = time.monotonic_ns() if stop_ns is None else stop_ns
    if stop < PROCESS_STARTED_NS:
        raise ValueError('Diagnostic monotone time precedes its actual start')
    return Decimal(stop - PROCESS_STARTED_NS) / Decimal(1_000_000_000)


def wall_stamp(ns):
    return datetime.fromtimestamp(ns / 1_000_000_000, timezone.utc).isoformat()


def source_row(record):
    # A historical helper may later change. Its retained copy is checked by the
    # finalizer; the original name here is lineage, not a current-file receipt.
    return {'sourcePath': record['path'], 'sha256': record['sha256'], 'bytes': record['bytes']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', required=True, help='New exclusive directory below lot10b-evidence')
    parser.add_argument('--mode', choices=tuple(MODES), default='writer-parity')
    parser.add_argument('--checkpoint', required=True, help='Actual retained checkpoint; writer requires raw JSON')
    parser.add_argument('--journal', help='Actual retained public journal, required for parity')
    parser.add_argument('--execution-receipt', required=True, help='Actual historical HPDL campaign receipt')
    parser.add_argument('--timeout-seconds', type=float, default=DEFAULT_SECONDS)
    args = parser.parse_args()
    selected = MODES[args.mode]
    if not math.isfinite(args.timeout_seconds) or not CAPTURE_RESERVE_SECONDS + STOP_MARGIN_SECONDS < args.timeout_seconds <= MAXIMUM_SECONDS:
        parser.error('The global diagnostic ceiling must exceed 30.5 seconds and be at most 300 seconds')
    if ('parity' in selected) != bool(args.journal):
        parser.error('Supply --journal exactly when the selected mode contains parity')
    if sys.platform != 'linux':
        raise RuntimeError('The retained process-group and parent-death guards require Linux')
    out = proof.inside(args.directory, must_exist=False)
    if not out.is_relative_to(BASE) or out == BASE or out.exists():
        raise ValueError('A new exclusive diagnostic directory is required')
    checkpoint, execution_path = proof.inside(args.checkpoint), proof.inside(args.execution_receipt)
    if 'writer' in selected and checkpoint.suffix != '.json':
        raise ValueError('The writer checker requires the actual raw JSON checkpoint')
    journal = proof.inside(args.journal) if args.journal else None
    node = shutil.which('node') if 'writer' in selected else None
    if 'writer' in selected and node is None:
        raise FileNotFoundError('node')
    inputs = {'checkpoint': checkpoint, 'diagnosedExecution': execution_path}
    helpers = {'generator': Path(__file__).resolve(), 'cumulativeClockReader': PROOF_PATH}
    if 'writer' in selected:
        helpers.update(writerChecker=proof.inside(WRITER), streamWriter=proof.inside(BASE / 'stream-evidence-json.mjs'),
                       campaignWriterCaller=proof.inside(BASE / 'run-hpdl-campaign.mjs'))
    if 'parity' in selected:
        inputs['publicJournal'] = journal
        helpers.update(partialComparator=proof.inside(PARITY),
                       sharedComparisonCore=proof.inside(ROOT / 'scripts/compare-window-question-public-parity.py'))
    paths = {**helpers, **inputs}
    plans = []
    for phase in selected:
        result = out / ('writer-check.json' if phase == 'writer' else 'window-source-parity.PARTIAL.json.gz')
        command = ([node, '--max-old-space-size=1536', '--expose-gc', str(WRITER),
                    '--checkpoint', str(checkpoint), '--execution-receipt', str(execution_path), '--output', str(result)]
                   if phase == 'writer' else
                   [sys.executable, '-B', str(PARITY), '--checkpoint', str(checkpoint), '--journal', str(journal),
                    '--execution-receipt', str(execution_path), '--output', str(result)])
        plans.append({'name': phase, 'command': command, 'resultPath': proof.name(result),
                      'logPath': proof.name(out / (phase + '.log'))})
    boot_id = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
    if not boot_id:
        raise RuntimeError('The Linux boot identity is unavailable')
    parent_pid = os.getpid()
    libc = ctypes.CDLL(None, use_errno=True)

    def parent_death_guard():
        if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0:
            os._exit(125)
        if os.getppid() != parent_pid:
            os.kill(os.getpid(), signal.SIGKILL)

    received_signals = []

    def receive_signal(number, _frame):
        received_signals.append({'signal': number, 'receivedAt': proof.now(),
                                 'elapsedSeconds': float(seconds_since_start())})

    for number in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(number, receive_signal)
    child_ceiling = Decimal(str(args.timeout_seconds - CAPTURE_RESERVE_SECONDS - STOP_MARGIN_SECONDS))
    capture_ceiling = Decimal(str(args.timeout_seconds - STOP_MARGIN_SECONDS))

    def guard_activity():
        if received_signals:
            raise DiagnosticStopped('A wrapper signal stopped further diagnostic activity')
        if seconds_since_start() >= child_ceiling:
            raise DiagnosticStopped('The shared preparation/child ceiling has expired')

    def guard_capture():
        if seconds_since_start() >= capture_ceiling:
            raise DiagnosticStopped('The global diagnostic capture ceiling has expired')

    with ExitStack() as locks:
        # Each fixed comparator also takes SH; an outer EX would block its child.
        for path, mode in [(proof.PERFORMANCE_LOCK, fcntl.LOCK_SH), (proof.HPDL_LOCK, fcntl.LOCK_EX), (LEDGER_LOCK, fcntl.LOCK_EX)]:
            stream = locks.enter_context(path.open('a+b'))
            fcntl.flock(stream.fileno(), mode | fcntl.LOCK_NB)
        clock_bytes = proof.CLOCK.read_bytes()
        clock = proof.decode_json(clock_bytes)
        prior_total, remaining = proof.validate_clock(clock)
        required_work = None
        for previous in clock['attempts']:
            if previous.get('kind') != 'conservative_case_work' or previous.get('chargedSeconds') != 451:
                continue
            saved = proof.read_json(proof.inside(previous['executionReceipt']['path']))
            if (saved.get('schema') == 'logos-engine.lot10b.hpdl-conservative-case-work.v1'
                    and saved.get('kind') == 'conservative_case_work'
                    and saved.get('chargedSeconds') == 451 and saved.get('elapsedSecondsThroughCapture') == 450.454527
                    and saved.get('monotoneMeasurement') is False):
                required_work = previous['executionReceipt']
                break
        if required_work is None:
            raise ValueError('Record the real 451-second HPDL01 debit after explicit 6A quiet release before any new diagnostic admission')
        # The additional reserve is admission headroom for terminal bookkeeping,
        # never a discount or an automatically charged synthetic duration.
        if Decimal(str(args.timeout_seconds + proof.RETENTION_RESERVE_SECONDS)) > remaining:
            raise ValueError('The requested ceiling plus terminal-retention headroom exceeds the remaining HPDL budget')
        out.mkdir(parents=True, exist_ok=False)
        proof.fsync_directory(out.parent)
        attempt_id = proof.name(out)
        if any(row.get('attemptId') == attempt_id for row in clock['attempts']):
            raise ValueError('This diagnostic identity was already admitted')
        proof.atomic_bytes(out / 'clock-before.json', clock_bytes)
        prior_clock = proof.fingerprint(out / 'clock-before.json')
        started_at = wall_stamp(PROCESS_STARTED_WALL_NS)
        entry = {'attemptId': attempt_id, 'status': 'running', 'kind': 'case_diagnostic', 'game': 'HPDL',
                 'startedAt': started_at, 'admittedAt': proof.now(), 'monotonicStartedNs': str(PROCESS_STARTED_NS),
                 'bootId': boot_id, 'priorCumulativeSeconds': float(prior_total), 'remainingBeforeSeconds': float(remaining),
                 'activityCeilingSeconds': args.timeout_seconds, 'captureReserveSeconds': CAPTURE_RESERVE_SECONDS,
                 'childActivityCeilingSeconds': float(child_ceiling), 'terminationMarginSeconds': STOP_MARGIN_SECONDS,
                 'mode': args.mode, 'phasePlan': plans, 'chargedSeconds': None,
                 'requiredConservativeDebit': required_work,
                 'qualification': 'A non-game diagnostic is running; unresolved admission blocks every later HPDL interval without refund.'}
        begin_path = out / 'diagnostic-begin.json'
        proof.write_json(begin_path, {'schema': BEGIN_SCHEMA, **entry, 'holderPid': parent_pid, 'checkoutRoot': str(ROOT),
                         'pidNamespace': os.readlink('/proc/self/ns/pid'), 'priorClock': prior_clock,
                         'inputPaths': {label: proof.name(path) for label, path in paths.items()},
                         'performanceLock': str(proof.PERFORMANCE_LOCK), 'hpdlLock': str(proof.HPDL_LOCK),
                         'ledgerMutationLock': str(LEDGER_LOCK), 'performanceLockMode': 'shared_functional'})
        begin_receipt = proof.fingerprint(begin_path)
        clock['attempts'].append(entry)
        clock['budgetAvailability'] = 'blocked_by_running_attempt'
        clock['lastUpdatedAt'] = proof.now()
        proof.write_json(proof.CLOCK, clock, replace=True)

        before, after, retained_inputs, phases, errors = {}, {}, {}, [], []
        process, active_phase = None, None
        outcome, diagnosed = 'preflight_failed', None
        diagnosed_validated = False

        def stop_child(reason):
            if process is not None and process.poll() is None:
                termination = {'reason': reason, 'requestedAt': proof.now(),
                               'requestedElapsedSeconds': float(seconds_since_start()), 'signal': 'SIGKILL'}
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                    termination['signalSent'] = True
                except ProcessLookupError:
                    termination['signalSent'] = False
                process.wait()
                termination.update(reapedAt=proof.now(), reapedElapsedSeconds=float(seconds_since_start()), exitCode=process.returncode)
                if active_phase is not None:
                    active_phase['termination'] = termination

        try:
            (out / 'retained-inputs').mkdir()
            for label, path in paths.items():
                observed = proof.fingerprint(path, guard_activity)
                before[label] = source_row(observed)
                if label in helpers:
                    guard_activity()
                    copy = out / 'retained-inputs' / (label + path.suffix)
                    proof.atomic_bytes(copy, path.read_bytes())
                    retained = proof.fingerprint(copy, guard_activity)
                    if (retained['sha256'], retained['bytes']) != (observed['sha256'], observed['bytes']):
                        raise ValueError('A retained helper differs from the bytes observed before execution: ' + label)
                    retained_inputs[label] = retained
                else:
                    retained_inputs[label] = observed
            diagnosed = proof.read_json(execution_path)
            if (not isinstance(diagnosed, dict)
                    or diagnosed.get('schema') != 'logos-engine.lot10b.hpdl-clocked-execution.v1'
                    or diagnosed.get('game') != 'HPDL' or diagnosed.get('targetLevels') != 6
                    or not any(row.get('executionReceipt') == retained_inputs['diagnosedExecution']
                               for row in clock['attempts'][:-1])):
                raise ValueError('The diagnosed execution is not an actual prior HPDL campaign in this cumulative ledger')
            diagnosed_validated = True
            proof.write_json(out / 'inputs-before.json', {'sourceInputs': before, 'retainedInputs': retained_inputs})
            outcome = 'children_returned'
            for plan in plans:
                guard_activity()
                active_phase = {**plan, 'status': 'running', 'startedAt': proof.now(),
                                'monotonicStartedNs': str(time.monotonic_ns()), 'exitCode': None,
                                'childSpawnEstablished': False, 'termination': None}
                phases.append(active_phase)
                log_path = proof.inside(plan['logPath'], must_exist=False)
                with log_path.open('xb') as output:
                    guard_activity()
                    process = subprocess.Popen(plan['command'], cwd=ROOT, stdout=output, stderr=subprocess.STDOUT,
                                               shell=False, start_new_session=True, preexec_fn=parent_death_guard,
                                               env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})
                    active_phase.update(childSpawnEstablished=True, pid=process.pid, processGroupId=process.pid,
                                        parentDeathSignal='SIGKILL', separateProcessGroup=True)
                    proof.write_json(out / (plan['name'] + '-child.json'), active_phase)
                    while True:
                        if received_signals:
                            outcome = active_phase['status'] = 'interrupted'
                            stop_child('received_wrapper_signal')
                            break
                        left = child_ceiling - seconds_since_start()
                        if left <= 0:
                            outcome = active_phase['status'] = 'activity_timeout'
                            stop_child('shared_preparation_and_child_ceiling')
                            break
                        if process.poll() is not None:
                            active_phase['status'] = 'returned'
                            break
                        try:
                            process.wait(timeout=min(float(left), 0.1))
                        except subprocess.TimeoutExpired:
                            pass
                    active_phase.update(finishedAt=proof.now(), monotonicFinishedNs=str(time.monotonic_ns()), exitCode=process.returncode)
                    output.flush()
                    os.fsync(output.fileno())
                proof.write_json(out / (plan['name'] + '-phase.json'), active_phase)
                if active_phase['status'] != 'returned' or process.returncode != 0:
                    if outcome == 'children_returned':
                        outcome = 'phase_failed'
                    break
                process, active_phase = None, None
        except BaseException as error:
            errors.append({'stage': 'preflight_or_child', 'type': type(error).__name__, 'message': str(error)})
            outcome = ('interrupted' if received_signals else 'activity_timeout') if isinstance(error, DiagnosticStopped) else 'wrapper_error'
            stop_child('wrapper_error')
        finally:
            stop_child('wrapper_finalization')
            if active_phase is not None and active_phase.get('status') == 'running':
                active_phase.update(status='wrapper_error', finishedAt=proof.now(),
                                    monotonicFinishedNs=str(time.monotonic_ns()), exitCode=process.returncode if process else None)
        completed_names = {phase['name'] for phase in phases}
        phases.extend({**plan, 'status': 'not_started', 'reason': outcome, 'exitCode': None, 'childSpawnEstablished': False}
                      for plan in plans if plan['name'] not in completed_names)

        # Children are gone. Bounded retention may be incomplete, but its real
        # time is still charged and every raw file remains available untouched.
        for label, path in paths.items():
            try:
                after[label] = source_row(proof.fingerprint(path, guard_capture))
            except BaseException as error:
                errors.append({'stage': 'postflight', 'input': label, 'type': type(error).__name__, 'message': str(error)})
                break
        proof.write_json(out / 'inputs-after.json', {'sourceInputs': after})
        artifacts, incomplete_artifacts = {}, []
        for path in sorted(out.rglob('*')):
            if not path.is_file():
                continue
            try:
                artifacts[path.relative_to(out).as_posix()] = proof.fingerprint(proof.inside(path), guard_capture)
            except BaseException as error:
                incomplete_artifacts.append({'path': proof.name(path), 'fingerprintComplete': False,
                                             'type': type(error).__name__, 'message': str(error)})
        unchanged = bool(len(before) == len(paths) and before == after)
        all_zero = bool(outcome == 'children_returned' and len(phases) == len(plans)
                        and all(phase['status'] == 'returned' and phase['exitCode'] == 0 and phase['childSpawnEstablished'] for phase in phases))
        outputs_retained = all(plan['resultPath'].removeprefix(proof.name(out) + '/') in artifacts for plan in plans)
        captured_ns = time.monotonic_ns()
        same_boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip() == boot_id
        receipt = {'schema': SCHEMA, 'attemptId': attempt_id, 'kind': 'case_diagnostic', 'game': 'HPDL',
                   'startedAt': started_at, 'captureFinishedAt': proof.now(), 'bootId': boot_id, 'sameBootAtCapture': same_boot,
                   'monotonicStartedNs': str(PROCESS_STARTED_NS), 'monotonicCaptureStoppedNs': str(captured_ns),
                   'elapsedSecondsThroughCapture': float(seconds_since_start(captured_ns)),
                   'clockBasis': 'same_process_monotonic_elapsed', 'monotoneMeasurement': True,
                   'activityCeilingSeconds': args.timeout_seconds, 'captureReserveSeconds': CAPTURE_RESERVE_SECONDS,
                   'childActivityCeilingSeconds': float(child_ceiling), 'terminationMarginSeconds': STOP_MARGIN_SECONDS,
                   'terminalRetentionAdmissionHeadroomSeconds': proof.RETENTION_RESERVE_SECONDS,
                   'priorCumulativeSeconds': float(prior_total), 'remainingBeforeSeconds': float(remaining),
                   'beginReceipt': begin_receipt, 'priorClock': prior_clock, 'requiredConservativeDebit': required_work,
                   'mode': args.mode, 'checkoutRoot': str(ROOT),
                   'phasePlan': plans, 'phases': phases, 'attemptOutcome': outcome, 'receivedSignals': received_signals,
                   'inputs': retained_inputs, 'sourceInputsBefore': before, 'sourceInputsAfter': after,
                   'sourceInputsUnchanged': unchanged, 'allDeclaredPhasesReturnedZero': all_zero,
                   'diagnosedExecutionValidated': diagnosed_validated,
                   'allDeclaredOutputsRetained': outputs_retained,
                   'diagnosticEvidenceComplete': bool(all_zero and unchanged and outputs_retained and not errors and not incomplete_artifacts and same_boot),
                   'diagnosedNativeSourceManifestDigest': diagnosed.get('nativeSourceManifestDigest')
                       if diagnosed_validated and isinstance(diagnosed, dict) else None,
                   'gameHostRun': False, 'nativeAgentRun': False, 'gameplayDurationMeasured': False,
                   'campaignPassedEstablished': False, 'observedActions': None, 'observedLevelsCompleted': None,
                   'completeActionCountEstablished': False, 'errors': errors, 'artifacts': artifacts,
                   'artifactsWithIncompleteFingerprint': incomplete_artifacts,
                   'qualification': 'Only the two named evidence tools may run. Their exit codes and retained outputs do not establish a game result. '
                       'The original campaign remains separate and unchanged. Preparation, children, failure, timeout and retention are charged without refund. '
                       'Helper copies preserve the exact diagnostic inputs even if the current helpers later change. '
                       'The final debit additionally includes receipt writing and hashing before the atomic ledger update; no elapsed duration is truncated.'}
        receipt_path = out / 'execution-hpdl-diagnostic.json'
        proof.write_json(receipt_path, receipt)
        receipt_evidence = proof.fingerprint(receipt_path)
        charged_ns = time.monotonic_ns()
        charge = seconds_since_start(charged_ns)
        total = prior_total + charge
        entry.update(status='terminal', finishedAt=proof.now(), monotonicChargeStoppedNs=str(charged_ns),
                     chargedSeconds=float(charge), executionReceipt=receipt_evidence, attemptOutcome=outcome,
                     diagnosedExecutionValidated=diagnosed_validated,
                     clockBasis='same_process_monotonic_elapsed', monotoneMeasurement=True,
                     campaignPassedEstablished=False, observedActions=None, observedLevelsCompleted=None,
                     completeActionCountEstablished=False,
                     qualification='Every measured diagnostic second is charged; no game was executed and no prior debit is refunded.')
        clock.update(cumulativeChargedSeconds=float(total), remainingSeconds=float(max(Decimal(0), proof.MAXIMUM_SECONDS - total)),
                     budgetExceededSeconds=float(max(Decimal(0), total - proof.MAXIMUM_SECONDS)),
                     budgetAvailability='exhausted' if total >= proof.MAXIMUM_SECONDS else 'available', lastUpdatedAt=proof.now())
        proof.write_json(proof.CLOCK, clock, replace=True)
        print(json.dumps({'attempt': attempt_id, 'outcome': outcome,
                          'phaseExits': {row['name']: row['exitCode'] for row in phases},
                          'diagnosticEvidenceComplete': receipt['diagnosticEvidenceComplete'],
                          'chargedSeconds': float(charge), 'remainingSeconds': clock['remainingSeconds'],
                          'receipt': proof.name(receipt_path)}, allow_nan=False), flush=True)
        return 0 if receipt['diagnosticEvidenceComplete'] else (130 if received_signals else 1)


if __name__ == '__main__':
    raise SystemExit(main())
