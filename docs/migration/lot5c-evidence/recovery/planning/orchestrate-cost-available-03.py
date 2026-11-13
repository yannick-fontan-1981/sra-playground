#!/usr/bin/env python3
"""One fresh, bounded 5C quiet request; no interactive input and no outer flock.

This coordinator never acquires EX and never changes the benchmark. Its known
controller child performs the sole EX attempt. All old evidence stays intact.
"""
from __future__ import annotations
import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[5]
SHARED = Path('/workspace/shared/sra-coordination')
BASE = ROOT / 'docs/migration/lot5c-evidence/recovery'
PLAN = BASE / 'planning'
COORD = BASE / 'coordination/cost-final-03'
PERF = BASE / 'performance-integrated-04'
REQUEST = 'lot5c-cost-a33a5f88-available-03'
LANES = ('lot6b', 'lot8a', 'lot10c')
OWN = SHARED / 'lot5c-status.json'
REVIEW = PLAN / 'coordination-v3-independent-review.json'
OWN_CLOSURE = BASE / 'coordination/recovery-03/own-preparation-closure.json'
FINALIZER = PLAN / 'finalize-readiness-5c-v3.py'
CONTROLLER = PLAN / 'run-coordinated-cost-5c-v3.py'
PROCESS_HELPER = PLAN / 'cost-process-control-v2.py'
REGISTRY = SHARED / 'lot5c-available-03-active-children.json'
AVAILABILITY_SECONDS = 600
WINDOW_SECONDS = 5400
DIGESTS = {'baseline': '74143a7a8f7e1d434a9284b34665f30f9c2b0d8d68191d9405b3af7d39815d12',
           'candidate': 'a33a5f88f3fe0034930b2056239889bed6fab662424fc84a141a5f9a28db9e57'}

class Interrupted(BaseException):
    pass

def stamp():
    return datetime.now(timezone.utc).isoformat()

def parse(value):
    d = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if d.tzinfo is None:
        raise ValueError('Timezone required')
    return d

def read(path):
    return json.loads(Path(path).read_text())

def require(ok, reason):
    if not ok:
        raise ValueError(reason)

def fp(path):
    p = Path(path).resolve()
    data = p.read_bytes()
    return {'path': str(p.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def save_new(path, value):
    with Path(path).open('x') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write('\n'); f.flush(); os.fsync(f.fileno())

def replace(path, value):
    p = Path(path); tmp = p.with_name(p.name + '.coordinator-' + str(os.getpid()) + '.tmp')
    with tmp.open('x') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.write('\n'); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, p)

@contextmanager
def shared_lock():
    fd = os.open(SHARED / 'performance.lock', os.O_RDWR | os.O_CLOEXEC)
    try:
        os.set_inheritable(fd, False)
        fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
        yield
    finally:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)

_SIGNAL = None
_CLEANUP_CONFIRMED = True

def signal_handler(signum, _frame):
    global _SIGNAL
    _SIGNAL = signum

def check_signal():
    if _SIGNAL is not None:
        raise Interrupted('signal_' + str(_SIGNAL))

def ack_valid(d, requested_at):
    try:
        return (d.get('quiet_request_id') == REQUEST and d.get('quiet_acknowledged') is True
            and d.get('active_command') is None and d.get('heavy_execution_active') is False
            and d.get('all_own_subagents_idle') is True and d.get('no_queued_commands') is True
            and requested_at <= parse(d['quiet_acknowledged_at']) <= datetime.now(timezone.utc)
            and parse(d['updated_at']) >= parse(d['quiet_acknowledged_at']))
    except (KeyError, ValueError, TypeError):
        return False

def preflight():
    require(os.environ.get('NODE_OPTIONS') is None, 'No cost NODE_OPTIONS override')
    require(not (PERF / 'readiness.json').exists() and not (PERF / 'window.json').exists(), 'Never reuse a readiness or window')
    require(not (COORD / 'request.json').exists() and not (COORD / 'attempt-sentinel.json').exists(), 'This unique cycle already exists')
    require(not REGISTRY.exists(), 'A previous process registry exists; never reuse it')
    with shared_lock():
        review = read(REVIEW)
        require(review['schema'] == 'logos-engine.lot5c-coordination-v3-independent-review.v1' and review['status'] == 'passed', 'Independent v2 review required')
        require(review['checksPassed'] == review['checksTotal'] == len(review['checks']) > 0 and all(c['passed'] is True for c in review['checks']), 'Every review check must pass')
        subjects = {x['path']: x for x in review['subjects']}
        require(len(subjects) == len(review['subjects']), 'Duplicate review subjects refused')
        for p in (Path(__file__), FINALIZER, CONTROLLER, PROCESS_HELPER):
            require(subjects.get(fp(p)['path']) == fp(p), 'Reviewed coordinator source changed: ' + p.name)
        for item in review['subjects']:
            target = (ROOT / item['path']).resolve()
            require(target.is_relative_to(ROOT) and fp(target) == item, 'Reviewed input changed')
        closure = read(OWN_CLOSURE)
        require(closure['requestId'] == REQUEST and closure['status'] == 'all_own_processes_and_workers_idle', 'Fresh actual own closure required')
        require(closure['ownTrackedComputeEnded'] is True and closure['noQueuedCommands'] is True and closure['previewStopped'] is True, 'Own work not closed')
        require(parse(closure['recordedAt']) >= parse(review['recordedAt']), 'Closure must follow independent review')
        require(all(w['observedTerminal'] is True and w['activeCommand'] is None and w['noQueuedCommands'] is True for w in closure['workers']) and {w['agent'] for w in closure['workers']} == {'lot5_cost_protocol_audit', 'lot5_scope_preview', 'lot5_site101_merge_audit'}, 'All three own workers must actually be closed')
        own = read(OWN)
        require(own.get('all_own_subagents_idle') is True and own.get('no_queued_commands') is True and own.get('quiet_requested') is not True, 'Own current coordination is not closed')
        for lane in LANES:
            require(read(SHARED / (lane + '-status.json')).get('quiet_requested') is not True, 'Another lane requests quiet')
        require(read(PERF / 'static-preflight.json')['status'] == 'static_inputs_checked', 'Fresh preparation03 must pass')
    return review, closure

def publish_request():
    now = datetime.now(timezone.utc); monotonic_deadline = time.monotonic() + AVAILABILITY_SECONDS
    deadline = now + timedelta(seconds=AVAILABILITY_SECONDS)
    request = {'schema': 'logos-engine.coordinated-cost-request.v1', 'requestId': REQUEST,
        'requestedAt': now.isoformat(), 'availabilityDeadline': deadline.isoformat(),
        'availabilityMaximumSeconds': AVAILABILITY_SECONDS, 'activeWindowMaximumSeconds': WINDOW_SECONDS,
        'lane': 'lot5c', 'performanceDirectory': str(PERF.relative_to(ROOT)), 'nativeDigests': DIGESTS,
        'requiredLanes': list(LANES), 'maximumExclusiveAttempts': 1, 'automaticRetry': False,
        'allowCurrentUsefulCommandsToFinishNormally': True,
        'automaticTimeBasedRelease': True,
        'expiryRule': 'This request is explicitly released at availabilityDeadline unless the exact window-lease.json records real exclusive acquisition before that deadline. If acquired, its fixed windowDeadline is the maximum quiet lease. No deadline extension or new cycle is automatic.',
        'windowLeasePath': str(COORD / 'window-lease.json'),
        'scope': 'Finish current useful commands normally, then root and all workers full-tool-idle: no queued source/Git/hash/archive/test/build/replay/game/browser/cost work. Only tiny named coordination metadata through ABBA/comparisons/review. Fresh exact ACK after actual closure; no cancellation requested.',
        'requestedAckFields': {'quiet_acknowledged': True, 'quiet_request_id': REQUEST, 'active_command': None,
            'heavy_execution_active': False, 'all_own_subagents_idle': True, 'no_queued_commands': True},
        'functionalProofsReusedBecauseInputsUnchanged': True,
        'currentFunctionalProofs': {'testsPassed': 5339, 'testFiles': 138, 'commonChecksPassed': 6818,
            'recordedCasesPassed': 11, 'recordedChecksPassed': 187, 'recordedActions': 390, 'projectChecksPassed': 5},
        'qualification': 'One new bounded cycle. Old01 ACKs/readiness never authorize this attempt. No official sample has started.'}
    save_new(COORD / 'request.json', request)
    own = read(OWN)
    require(own.get('quiet_requested') is not True, 'Own request changed during preparation')
    own.update({'updated_at': stamp(), 'phase': 'available03_waiting_fresh_all_worker_ack', 'quiet_requested': True,
        'quiet_released': False, 'quiet_acknowledged': False, 'quiet_request_id': REQUEST,
        'quiet_requested_at': request['requestedAt'], 'quiet_availability_deadline': request['availabilityDeadline'],
        'quiet_active_window_max_seconds': WINDOW_SECONDS, 'quiet_expiry_rule': request['expiryRule'],
        'active_command': 'Only bounded coordinator metadata wait; actual useful peer commands may finish normally.',
        'heavy_execution_active': False, 'performance_started': False, 'all_own_subagents_idle': True,
        'all_own_subagents_compute_idle': True, 'parallel_worker_activity': None, 'no_queued_commands': True})
    message = ('Fresh one-cycle request ' + REQUEST + '. Finish useful current commands normally, do not cancel them. '
        + 'ACK only after root/all workers actually close and queues are empty. Availability deadline ' + request['availabilityDeadline']
        + '; automatic explicit expiry unless actual EX lease exists. Only one EXNB attempt; refusal releases immediately. No repeated pause/diagnosis cycle.')
    for lane in LANES:
        own['request_to_' + lane] = message
    replace(OWN, own)
    print(json.dumps({'status': 'quiet_requested', 'requestId': REQUEST, 'availabilityDeadline': request['availabilityDeadline']}), flush=True)
    request['_availabilityMonotonicDeadline'] = monotonic_deadline
    return request

def wait_and_isolate(request, closure):
    deadline = parse(request['availabilityDeadline']); requested = parse(request['requestedAt']); last_report = 0
    monotonic_deadline = request.get('_availabilityMonotonicDeadline', time.monotonic() + max(0, (deadline - datetime.now(timezone.utc)).total_seconds()))
    while datetime.now(timezone.utc) < deadline and time.monotonic() < monotonic_deadline:
        check_signal()
        rows = []; missing = []
        for lane in LANES:
            p = SHARED / (lane + '-status.json')
            try:
                raw = p.read_bytes(); d = json.loads(raw)
            except (OSError, ValueError):
                missing.append(lane); continue
            if not ack_valid(d, requested):
                missing.append(lane)
            else:
                rows.append((lane, raw, d))
        if not missing:
            break
        if time.monotonic() - last_report >= 30:
            print(json.dumps({'status': 'waiting_fresh_ack', 'missingLanes': missing, 'at': stamp()}), flush=True)
            last_report = time.monotonic()
        time.sleep(min(2, max(0, (deadline - datetime.now(timezone.utc)).total_seconds()), max(0, monotonic_deadline - time.monotonic())))
    else:
        raise TimeoutError('availability_deadline_before_fresh_acks')
    check_signal()
    require(datetime.now(timezone.utc) < deadline and time.monotonic() < monotonic_deadline, 'Availability expired before isolation')
    now = stamp(); known = []; evidence = []
    for lane, raw, d in rows:
        p = COORD / (lane + '-ack.json')
        with p.open('xb') as f:
            f.write(raw); f.flush(); os.fsync(f.fileno())
        item = fp(p); evidence.append(item)
        known.append({'lane': lane, 'activeCommand': None, 'updatedAt': d['updated_at'],
            'acknowledgedAt': d['quiet_acknowledged_at'], 'requestId': REQUEST,
            'evidence': item, 'liveSnapshotObservedAt': now})
    own = dict(closure); own['recordedAt'] = now; own['priorActualPreparationClosure'] = fp(OWN_CLOSURE)
    own['qualification'] = 'Actual source/test/review work and all own workers are terminal. Only this declared coordinator, fresh readiness and controlled cost protocol follow; no ordinary command is queued.'
    save_new(COORD / 'own-closure.json', own)
    evidence.extend([fp(COORD / 'request.json'), fp(COORD / 'own-closure.json'), fp(OWN_CLOSURE), fp(REVIEW)])
    isolation = {'schema': 'logos-engine.coordinated-cost-isolation.v1', 'status': 'acknowledged_quiet_before_window',
        'recordedAt': now, 'requestId': REQUEST, 'otherLaneAcknowledged': True, 'ownTrackedComputeEnded': True,
        'previewStopped': True, 'costNodeOptionsOverride': None, 'performanceDirectory': str(PERF.relative_to(ROOT)),
        'nativeDigests': DIGESTS, 'declaration': fp(PERF / 'declaration.json'), 'request': fp(COORD / 'request.json'),
        'knownLanes': known, 'evidence': evidence,
        'qualification': 'Three actual peer-authored ACKs after this new request, complete root/worker closure, exact raw snapshots. No old ACK/readiness is reused. One nonblocking EX remains mandatory. Full measured population and all reservations remain unchanged.'}
    save_new(COORD / 'isolation.json', isolation)
    return isolation

_PROCESS_MODULE = None

def process_helper():
    global _PROCESS_MODULE
    if _PROCESS_MODULE is None:
        spec = importlib.util.spec_from_file_location('lot5c_cost_process_cleanup_v2', PROCESS_HELPER)
        mod = importlib.util.module_from_spec(spec); sys.modules[spec.name] = mod; spec.loader.exec_module(mod)
        _PROCESS_MODULE = mod
    return _PROCESS_MODULE

def cleanup_group(proc):
    result = process_helper().terminate_owned_group(proc.pid, child=proc)
    require(result['terminal'] is True and proc.poll() is not None, 'Owned coordinator child cleanup incomplete')
    return {'leaderTerminal': True, **result}

def cleanup_controller_registry(pid):
    if not REGISTRY.exists():
        return []
    return process_helper().cleanup_registered(REGISTRY, REQUEST, pid)

def run_child(label, argv, request):
    global _CLEANUP_CONFIRMED
    proc = None; cleanup = None; registry_cleanup = None; started = stamp(); log_path = COORD / (label + '.log')
    outcome = {'label': label, 'startedAt': started, 'argv': argv, 'logPath': str(log_path.relative_to(ROOT))}
    availability_deadline = parse(request['availabilityDeadline']); active_deadline = None
    child_launch_monotonic = time.monotonic()
    availability_monotonic = request.get('_availabilityMonotonicDeadline', child_launch_monotonic + max(0, (availability_deadline - datetime.now(timezone.utc)).total_seconds()))
    active_monotonic = None
    cleanup_errors = []
    try:
        with log_path.open('xb') as log:
            proc = subprocess.Popen(argv, cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log,
                stderr=subprocess.STDOUT, close_fds=True, start_new_session=True)
            outcome['childPid'] = proc.pid
            check_signal()
            save_new(COORD / (label + '-started.json'), outcome)
            while proc.poll() is None:
                check_signal()
                if label == 'controller' and active_deadline is None and (COORD / 'window-lease.json').exists():
                    lease = read(COORD / 'window-lease.json')
                    require(lease['requestId'] == REQUEST and lease['status'] == 'exclusive_acquired' and lease['controllerPid'] == proc.pid, 'Foreign or invalid window lease')
                    acquired = parse(lease['lockAcquiredAt']); active_deadline = parse(lease['windowDeadline'])
                    require(acquired <= availability_deadline and 0 < (active_deadline - acquired).total_seconds() <= WINDOW_SECONDS, 'Invalid acquired window deadline')
                    # Conservative monotonic ceiling from controller launch; never extends the acquired window.
                    active_monotonic = min(child_launch_monotonic + WINDOW_SECONDS, time.monotonic() + max(0, (active_deadline - datetime.now(timezone.utc)).total_seconds()))
                    print(json.dumps({'status': 'exclusive_window_acquired', 'windowDeadline': lease['windowDeadline']}), flush=True)
                if datetime.now(timezone.utc) >= (active_deadline or availability_deadline) or time.monotonic() >= (active_monotonic if active_monotonic is not None else availability_monotonic):
                    raise TimeoutError(label + '_deadline')
                time.sleep(0.25)
            outcome['exitCode'] = proc.returncode
            check_signal()
    except BaseException as error:
        outcome['errorType'] = type(error).__name__
        raise
    finally:
        if proc is not None:
            try:
                cleanup = cleanup_group(proc)
            except BaseException as error:
                cleanup_errors.append('leader_group_' + type(error).__name__)
            finally:
                # A failed group cleanup must not skip the known controller's registered children.
                if label == 'controller' and proc.poll() is not None:
                    try:
                        registry_cleanup = cleanup_controller_registry(proc.pid)
                    except BaseException as error:
                        cleanup_errors.append('registered_groups_' + type(error).__name__)
                elif label == 'controller':
                    cleanup_errors.append('controller_terminal_unconfirmed')
            if cleanup_errors:
                _CLEANUP_CONFIRMED = False
        outcome.update({'finishedAt': stamp(), 'cleanup': cleanup, 'registeredControllerChildrenCleanup': registry_cleanup, 'cleanupErrors': cleanup_errors})
        try:
            save_new(COORD / (label + '-execution.json'), outcome)
        except OSError:
            print(json.dumps({'status': 'execution_receipt_write_failed', 'label': label}), flush=True)
    require(not cleanup_errors, 'Owned descendant cleanup could not be confirmed')
    require(outcome.get('exitCode') == 0, label + '_nonzero_or_interrupted')
    require(registry_cleanup is None or all(row['terminal'] is True for row in registry_cleanup), 'Controller descendant cleanup incomplete')
    return outcome

def release(reason):
    at = stamp(); own = read(OWN)
    if own.get('quiet_request_id') == REQUEST:
        first_release = own.get('quiet_released_at') if own.get('quiet_requested') is False and own.get('released_request_id') == REQUEST else at
        own.update({'updated_at': at, 'quiet_requested': False, 'quiet_released': True, 'quiet_acknowledged': False,
            'quiet_released_at': first_release, 'released_request_id': REQUEST,
            'active_command': None if _CLEANUP_CONFIRMED else 'Known coordinator execution cleanup unconfirmed; no idle ACK is authorized.',
            'heavy_execution_active': False if _CLEANUP_CONFIRMED else None, 'cleanup_confirmed': _CLEANUP_CONFIRMED,
            'no_queued_commands': True,
            'phase': 'available03_terminal_' + reason})
        for lane in LANES:
            own['request_to_' + lane] = 'Explicit RELEASE of ' + REQUEST + ' at ' + first_release + '. Reason: ' + reason + '. No automatic retry or new pause. Ordinary work under existing SH mutex may proceed. Publication order remains5C,6B,8A,10C; no publication is asserted by this release.'
        replace(OWN, own)
    return {'releasedAt': at, 'reason': reason, 'requestId': REQUEST, 'automaticRetry': False}

def main():
    global _SIGNAL, _CLEANUP_CONFIRMED
    _SIGNAL = None; _CLEANUP_CONFIRMED = True
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--execute', action='store_true'); args = parser.parse_args()
    require(args.execute, 'Explicit --execute required')
    old_handlers = {s: signal.signal(s, signal_handler) for s in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)}
    activated = False; request = None; result = {'schema': 'logos-engine.lot5c-single-recovery-attempt.v1', 'requestId': REQUEST, 'startedAt': stamp(), 'officialMeasurementAcceptanceAsserted': False}
    code = 1
    try:
        review, closure = preflight(); check_signal(); process_helper().enable_subreaper(); COORD.mkdir(parents=True, exist_ok=True)
        save_new(COORD / 'attempt-sentinel.json', {'requestId': REQUEST, 'createdAt': stamp(), 'maximumCycles': 1, 'orchestrator': fp(Path(__file__))})
        request = publish_request(); activated = True; check_signal()
        wait_and_isolate(request, closure)
        with shared_lock():
            run_child('readiness', [sys.executable, '-B', str(FINALIZER), '--regression-launch-receipt',
                str(BASE / 'integrated-final-01/regressions-preparation/retry-driver-launch.execution.json'),
                '--isolation-receipt', str(COORD / 'isolation.json')], request)
        # The readiness SH descriptor is closed before launching the EX controller.
        run_child('controller', [sys.executable, '-B', str(CONTROLLER), '--execute', '--availability-deadline', request['availabilityDeadline']], request)
        result['status'] = 'controller_completed_cost_verdict_must_be_read'; code = 0
    except BaseException as error:
        result['status'] = 'failed_or_expired'; result['failureType'] = type(error).__name__; result['failureReason'] = str(error)
        code = 124 if isinstance(error, TimeoutError) else 130 if isinstance(error, Interrupted) else 1
    finally:
        # Release coordination independently of all receipt/log writes.
        try:
            own = read(OWN)
            if activated or own.get('quiet_request_id') == REQUEST and own.get('quiet_requested') is True:
                result['release'] = release(result.get('status', 'failed_or_expired'))
        except BaseException as error:
            result['releaseWriteFailure'] = type(error).__name__
            result['expiryStillExplicitInRequest'] = request is not None
            code = 1
        result['finishedAt'] = stamp()
        result['windowArtifactPresent'] = (PERF / 'window.json').exists()
        result['cleanupConfirmed'] = _CLEANUP_CONFIRMED
        result['measurementQualification'] = 'Actual samples and acceptance require the controller and window evidence; artifact existence alone is not a measurement claim.'
        try:
            if COORD.exists():
                save_new(COORD / 'attempt-result.json', result)
        except OSError:
            code = 1; result['terminalReceiptWriteFailed'] = True
        for sig, handler in old_handlers.items():
            signal.signal(sig, handler)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    return code

if __name__ == '__main__':
    sys.exit(main())
