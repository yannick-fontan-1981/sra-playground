#!/usr/bin/env python3
"""Hold the shared exclusive flock throughout the unchanged official ABBA runner.

The predeclared coordination policy names exact files and required signals.
Text-only progress changes are retained but do not invalidate quiet signals.
All start/completion receipts are exclusive and failures remain failures.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]


def require(value, message):
    if not value:
        raise ValueError(message)


def stamp():
    return datetime.now(timezone.utc).isoformat()


def instant(value):
    require(isinstance(value, str) and value, 'A completed interval needs an explicit timestamp')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'A timestamp lacks its timezone')
    return result


def bytes_fp(path, raw):
    path = Path(path).resolve()
    return {'path': path.relative_to(ROOT).as_posix() if path.is_relative_to(ROOT) else str(path),
            'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def fp(path):
    path = Path(path).resolve()
    return bytes_fp(path, path.read_bytes())


def write_new(path, data):
    with path.open('x') as stream:
        json.dump(data, stream, indent=2, ensure_ascii=False); stream.write('\n')


def process_group_state(pgid):
    """Inspect only PID/state membership of the child's Linux process group.

    A reaped Python runner does not imply its Node child has stopped. Zombies
    cannot execute but can remain visible until their parent/init reaps them.
    """
    try:
        os.killpg(pgid, 0)
    except ProcessLookupError:
        return {'members': [], 'live': [], 'zombies': []}
    members = []
    for directory in Path('/proc').iterdir():
        if not directory.name.isdigit():
            continue
        try:
            tail = (directory / 'stat').read_text(errors='replace').rsplit(')', 1)[1].split()
        except (FileNotFoundError, ProcessLookupError):
            continue
        if int(tail[2]) == pgid:
            members.append({'pid': int(directory.name), 'state': tail[0]})
    if not members:
        try:
            os.killpg(pgid, 0)
        except ProcessLookupError:
            return {'members': [], 'live': [], 'zombies': []}
        raise ValueError('The owned process group exists but its membership could not be observed')
    members.sort(key=lambda row: row['pid'])
    return {'members': members, 'live': [row for row in members if row['state'] not in ('Z', 'X')],
            'zombies': [row for row in members if row['state'] in ('Z', 'X')]}


def stop_process_group(process, receipt):
    """Stop any surviving group member, even when the direct runner has exited."""
    pgid = process.pid
    process.poll()
    receipt.update(processGroup=pgid, required=True, completed=False, signalsSent=[])
    receipt['before'] = process_group_state(pgid)
    receipt['required'] = bool(receipt['before']['live'])
    receipt['completed'] = False
    for number in (signal.SIGTERM, signal.SIGKILL):
        state = process_group_state(pgid)
        if not state['live']:
            break
        try:
            os.killpg(pgid, number)
            receipt['signalsSent'].append(number)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + 10
        while True:
            process.poll()
            state = process_group_state(pgid)
            if not state['live'] or time.monotonic() >= deadline:
                break
            time.sleep(.05)
    process.poll()
    receipt['after'] = process_group_state(pgid)
    receipt['completed'] = process.returncode is not None and not receipt['after']['live']
    require(receipt['completed'], 'The owned runner/process group has not demonstrably stopped')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('performance_directory', type=Path)
    parser.add_argument('coordination_policy', type=Path)
    args = parser.parse_args()
    perf = (ROOT / args.performance_directory).resolve()
    policy_path = (ROOT / args.coordination_policy).resolve()
    require(perf.is_relative_to(ROOT / 'docs/migration/lot4c-evidence'), 'Expected a 4C cost directory')
    require(policy_path.is_relative_to(ROOT / 'docs/migration/lot4c-evidence'), 'Retain the coordination policy in 4C evidence')
    before_path = perf / 'coordinated-isolation-start.json'
    after_path = perf / 'coordinated-isolation-completion.json'
    window_path = perf / 'window.json'
    require(perf.is_dir() and all(not p.exists() for p in [before_path, after_path, window_path]),
            'Refusing an absent directory, existing window or isolation receipt')
    lock_path = Path('/workspace/shared/sra-coordination/performance.lock')
    signals = {'quiet_acknowledged', 'heavy_work_started', 'performance_started', 'publication_started', 'active_command'}
    retained = {}
    policy = declaration = readiness = preparation = None
    lock = process = command = start = None
    acquired = held_through = None
    locked = start_written = False
    before_ok = after_ok = signals_unchanged = window_covered = False
    before, after, failures = [], [], []
    exit_code = window_record = window_value = start_record = None
    cleanup = {'required': False, 'completed': True}
    receipt_written = False
    spawning = False
    deferred_interrupts = []

    def failed(stage, error):
        failures.append({'stage': stage, 'type': type(error).__name__, 'message': str(error)})

    def read_bound(name, path):
        path = Path(path).resolve(); raw = path.read_bytes()
        retained[name] = bytes_fp(path, raw)
        value = json.loads(raw)
        require(isinstance(value, dict), 'Expected a JSON object: ' + str(path))
        return value

    def verify_inputs():
        for record in [*retained.values(), *readiness['inputs'], *readiness.get('watchedExternalInputs', [])]:
            require(fp(ROOT / record['path']) == record, 'Prelaunch input changed: ' + record['path'])

    def snapshot(phase, rows):
        for index, lane in enumerate(policy['lanes']):
            path = Path(lane['path']).resolve()
            require(path.parent == Path('/workspace/shared/sra-coordination') and path.is_file(), 'Unknown coordination surface')
            require(re.fullmatch(r'[A-Za-z0-9_-]+', lane['name']), 'Invalid coordination lane name')
            raw = path.read_bytes()
            saved = perf / 'isolation-evidence' / f'{phase}-{index:02d}-{lane["name"]}.json'
            saved.parent.mkdir(parents=True, exist_ok=True)
            with saved.open('xb') as stream:
                stream.write(raw)
            # Preserve the observed bytes even when parsing or quiet validation fails.
            row = {'name': lane['name'], 'mode': lane['mode'], 'source': str(path),
                   'snapshot': bytes_fp(saved, raw), 'observedAt': stamp()}
            rows.append(row)
            data = json.loads(raw)
            require(isinstance(data, dict), 'Coordination status is not an object: ' + lane['name'])
            required = lane['requiredSignals']
            row.update(requiredSignals=required, actualSignals={key: data.get(key) for key in sorted(signals)})
            require(set(required) == signals and all(key in data and type(data[key]) is type(val) and data[key] == val
                                                    for key, val in required.items()),
                    'Lane is not in its declared quiet state: ' + lane['name'])
            require(required['heavy_work_started'] is False and required['performance_started'] is False
                    and required['publication_started'] is False and required['active_command'] is None,
                    'A declared lane still has active work')
            require(lane['mode'] in ('explicit_quiet', 'completed_no_further_execution'), 'Unknown quiet mode')
            if lane['mode'] == 'explicit_quiet':
                require(required['quiet_acknowledged'] is True, 'Fresh explicit quiet is missing')
            else:
                require(lane.get('completionEvidence') and lane.get('terminalStatement'), 'Completed lane lacks its explicit terminal evidence')
                for record in lane['completionEvidence']:
                    require(fp(ROOT / record['path']) == record, 'Terminal lane evidence changed')
            row['quietVerified'] = True

    def interrupted(signum, frame):
        if spawning:
            # Popen must become reachable by cleanup before this signal raises.
            deferred_interrupts.append(signum)
            return
        raise InterruptedError('Isolation launcher received signal ' + str(signum))

    handlers = {number: signal.getsignal(number) for number in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)}
    try:
        for number in handlers:
            signal.signal(number, interrupted)
        retained['generator'] = fp(__file__)
        policy = read_bound('coordinationPolicy', policy_path)
        require(policy['schema'] == 'logos-engine.coordinated-cost-isolation-policy.v1' and policy['lanes'],
                'Explicit coordination policy required')
        require(Path(policy['lock']).resolve() == lock_path, 'Use the shared machine performance lock')
        require(len({lane['name'] for lane in policy['lanes']}) == len(policy['lanes']), 'Duplicate coordination lane')
        declaration = read_bound('declaration', perf / 'declaration.json')
        readiness = read_bound('readiness', perf / 'readiness.json')
        preparation = read_bound('preparation', perf / 'preparation.json')
        require(readiness['status'] == 'ready' and readiness['functionalMeasurementReady'] is True
                and readiness['measurementAuthorized'] is True and readiness['pendingRequirements'] == []
                and readiness['measurementExecuted'] is False
                and readiness['nativeDigests'] == declaration['nativeDigests']
                and readiness['nativeSourceDigest'] == declaration['nativeDigests']['candidate'],
                'Functional readiness does not match this declaration')
        require(preparation['baseline'] == declaration['baseline'] and preparation['candidate'] == declaration['candidate']
                and Path(preparation['candidateCheckout']).resolve() == ROOT
                and Path(preparation['baselineCheckout']).resolve() != ROOT, 'Preparation differs from the declared checkouts')
        require(retained['declaration'] in readiness['inputs'] and retained['preparation'] in readiness['inputs'],
                'Readiness does not bind the launch inputs')
        verify_inputs()
        lock = lock_path.open('a+')
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        locked = True
        acquired = stamp()
        require(all(not p.exists() for p in [before_path, after_path, window_path]), 'A competing window appeared before lock acquisition')
        snapshot('before', before); before_ok = True
        verify_inputs()
        require(instant(declaration['finalizedAt']) <= instant(readiness['finalizedAt']) <= instant(acquired),
                'Completed readiness must precede the isolated launch')
        start = {'schema': 'logos-engine.coordinated-cost-isolation-start.v1', 'status': 'quiet_verified_with_exclusive_lock',
                 'recordedAt': stamp(), 'lock': str(lock_path), 'lockAcquiredAt': acquired,
                 'generator': retained['generator'], 'coordinationPolicy': retained['coordinationPolicy'],
                 'declaration': retained['declaration'], 'readiness': retained['readiness'],
                 'preparation': retained['preparation'],
                 'lanes': before,
                 'qualification': 'Fresh declared cooperative signals and an exclusive flock are observed. No claim is made about uninstrumented unrelated host processes.'}
        write_new(before_path, start); start_written = True
        start_record = fp(before_path)
        command = [sys.executable, '-B', 'scripts/run-native-cost-window.py', preparation['baselineCheckout'],
                   perf.relative_to(ROOT).as_posix(), declaration['baselineManifest']['path'], declaration['candidateManifest']['path']]
        # Only this child's process group may be stopped on interruption; keep the
        # shared flock until the official runner and its measurement child stop.
        spawning = True
        try:
            process = subprocess.Popen(command, cwd=ROOT, start_new_session=True)
        finally:
            spawning = False
        if deferred_interrupts:
            raise InterruptedError('Isolation launch interrupted during child creation: ' + str(deferred_interrupts))
        exit_code = process.wait()
        require(exit_code == 0, 'The unchanged ABBA runner failed')
    except BaseException as error:
        failed('preflight_or_runner', error)
    finally:
        # A second catchable termination must not abandon a running measurement
        # between cleanup and the exclusive completion receipt.
        for number in handlers:
            signal.signal(number, signal.SIG_IGN)
        if process is not None:
            try:
                stop_process_group(process, cleanup)
                require(not cleanup['required'] or failures,
                        'The runner returned while its measurement process group was still active')
            except BaseException as error:
                failed('child_cleanup', error)
                # An observation failure must not skip a stop request to a
                # surviving group merely because the direct Python parent died.
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                except BaseException as stop_error:
                    failed('child_cleanup_fallback', stop_error)
                try:
                    process.wait(timeout=10)
                    cleanup['afterFallback'] = process_group_state(process.pid)
                    cleanup['completed'] = not cleanup['afterFallback']['live']
                    require(cleanup['completed'], 'The owned process group still has live members after fallback')
                except BaseException as stop_error:
                    failed('child_cleanup_fallback_observation', stop_error)
            exit_code = process.poll()
        if locked:
            try:
                snapshot('after', after); after_ok = True
                signals_unchanged = before_ok and [row['actualSignals'] for row in before] == [row['actualSignals'] for row in after]
                require(signals_unchanged, 'Quiet signals changed or the initial quiet check was incomplete')
                verify_inputs()
            except BaseException as error:
                failed('post_run_coordination_or_inputs', error)
        if start_written:
            try:
                require(fp(before_path) == start_record, 'The initial isolation receipt changed')
            except BaseException as error:
                failed('start_receipt', error)
        if process is not None or start_written:
            try:
                raw = window_path.read_bytes()
                window_record = bytes_fp(window_path, raw)
                window_value = json.loads(raw)
                require(isinstance(window_value, dict), 'The official window receipt is not an object')
            except BaseException as error:
                failed('window_read', error)
            if isinstance(window_value, dict):
                try:
                    require(window_value['schema'] == 'logos-engine.native-cost-window.v1'
                            and window_value['status'] == window_value['finalIntegrity'] == 'passed'
                            and window_value['plannedOrder'] == ['A1', 'B1', 'B2', 'A2']
                            and [row['label'] for row in window_value['executions']] == window_value['plannedOrder']
                            and all(row['status'] == 'passed' and row['exitCode'] == 0 for row in window_value['executions'])
                            and window_value['nativeDigests'] == {'baseline': declaration['nativeDigests']['baseline'],
                                                                 'correction': declaration['nativeDigests']['candidate']},
                            'The official ABBA window is incomplete or failed')
                except BaseException as error:
                    failed('window_completion', error)
        held_through = stamp() if locked else None
        if isinstance(window_value, dict):
            try:
                # Missing, null, malformed or timezone-less boundaries fail here;
                # none is replaced by an invented finish time.
                require(locked and start is not None
                        and instant(acquired) <= instant(start['recordedAt']) <= instant(window_value.get('startedAt'))
                        < instant(window_value.get('finishedAt')) <= instant(held_through),
                        'The complete observed window is not bounded by the held lock interval')
                window_covered = True
            except BaseException as error:
                failed('window_lock_interval', error)
        complete = {'schema': 'logos-engine.coordinated-cost-isolation-completion.v1',
                    'status': 'passed' if not failures and exit_code == 0 and window_covered and signals_unchanged and cleanup['completed'] else 'failed',
                    'recordedAt': stamp(), 'startReceipt': start_record, 'command': command, 'exitCode': exit_code,
                    'measurementAttempted': process is not None, 'runnerPid': None if process is None else process.pid,
                    'window': window_record,
                    'windowOutcome': ({key: window_value.get(key) for key in ('status', 'finalIntegrity', 'startedAt', 'finishedAt', 'error', 'integrityError')}
                                      if isinstance(window_value, dict) else None),
                    'lock': str(lock_path), 'lockAcquiredAt': acquired, 'lockHeldThrough': held_through,
                    'lockHeldAcrossWholeWindow': window_covered, 'coordinationSignalsUnchanged': signals_unchanged,
                    'beforeVerified': before_ok, 'afterVerified': after_ok,
                    'before': before, 'after': after, 'inputs': list(retained.values()), 'childCleanup': cleanup,
                    'failure': failures[0] if failures else None, 'failures': failures,
                    'qualification': 'Observed source-bound ABBA completion and before/after cooperative signals only. The flock remains held through child cleanup, post-run verification and receipt writing. Incomplete or absent window boundaries are retained as failures and never synthesized. No claim is made about uninstrumented unrelated host processes.'}
        try:
            write_new(after_path, complete); receipt_written = True
        except BaseException as error:
            failed('completion_receipt_write', error)
            print(json.dumps({'status': 'failed', 'receiptWriteFailure': failures[-1]}), file=sys.stderr, flush=True)
        finally:
            try:
                if lock is not None:
                    try:
                        if locked:
                            fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
                    finally:
                        lock.close()
            finally:
                for number, handler in handlers.items():
                    signal.signal(number, handler)
    status = complete['status'] if receipt_written else 'failed'
    print(json.dumps({'status': status, 'lockReleasedAt': stamp() if acquired is not None else None,
                      'receipt': str(after_path) if receipt_written else None}), flush=True)
    return 0 if status == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
