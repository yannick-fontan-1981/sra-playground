#!/usr/bin/env python3
"""Hold cooperative isolation through the already declared 5C cost protocol.

This controller does not change, normalize or select any measurement. It keeps
the existing runner/comparators intact and retains their actual terminal exits.
Prepare and review readiness and the exact fresh lane acknowledgments first.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fcntl
import importlib.util
import sys
from datetime import timedelta
import gzip
import hashlib
import json
import os
from pathlib import Path
import signal
import stat
import subprocess
import time

ROOT = Path(__file__).resolve().parents[5]
SHARED = Path('/workspace/shared/sra-coordination')
LANES = ('lot6b', 'lot8a', 'lot10c')
REQUEST = 'lot5c-cost-a33a5f88-recovery-02'
PERF = ROOT / 'docs/migration/lot5c-evidence/recovery/performance-integrated-03'
COORD = ROOT / 'docs/migration/lot5c-evidence/recovery/coordination/cost-final-02'
BASELINE = Path('/workspace/sites/sra-lot5c-baseline-site102-1019d2e/.sites-checkout')
BASE_MANIFEST = ROOT / 'docs/migration/lot10b-evidence/recovery-20261111/integrated-final-02/source-manifest.json'
CAND_MANIFEST = ROOT / 'docs/migration/lot5c-evidence/recovery/integrated-final-01/source-manifest.json'


HELPER = Path(__file__).with_name('cost-process-control-v2.py')
REGISTRY_PATH = SHARED / 'lot5c-recovery-02-active-children.json'
EXPECTED_LOCK_IDENTITY = (27, 1971854)


def lifecycle():
    spec = importlib.util.spec_from_file_location('lot5c_cost_process_v2', HELPER)
    module = importlib.util.module_from_spec(spec)
    sys.dont_write_bytecode = True
    spec.loader.exec_module(module)
    return module


def stamp():
    return datetime.now(timezone.utc).isoformat()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def relative(path):
    return str(Path(path).resolve().relative_to(ROOT))


def fingerprint(path):
    path = Path(path).resolve()
    h = hashlib.sha256()
    size = 0
    with path.open('rb') as stream:
        for data in iter(lambda: stream.read(1 << 20), b''):
            size += len(data)
            h.update(data)
    return {'path': relative(path), 'bytes': size, 'sha256': h.hexdigest()}


def read(path):
    return json.loads(Path(path).read_text())


def exclusive(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n'); stream.flush(); os.fsync(stream.fileno())


def replace(path, value):
    temporary = Path(str(path) + '.tmp')
    with temporary.open('w') as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False)
        stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    os.replace(temporary, path)


def normalized(value):
    return {k: v for k, v in value.items() if k != 'updated_at'}


class ControllerInterrupted(BaseException):
    pass


def interrupted(signum, _frame):
    raise ControllerInterrupted(f'Catchable process signal {signum}')


def retain_cost_logs():
    """Adapt the retained 5B transport without changing its scope or byte checks."""
    window_path = PERF / 'window.json'
    window, window_before = read(window_path), fingerprint(window_path)
    require(window['status'] == window['finalIntegrity'] == 'passed', 'Completed cost window required for log transport')
    require([row['label'] for row in window['executions']] == ['A1', 'B1', 'B2', 'A2'], 'All four actual series required')
    logs = []
    for row in window['executions']:
        require(row['status'] == 'passed' and row['exitCode'] == 0, 'Incomplete series cannot be transported')
        path = Path(row['log']).resolve()
        require(path.is_relative_to(PERF), 'Cost log escaped the declared window')
        before = fingerprint(path)
        require(before['sha256'] == row['logSha256'], 'Original cost log differs from the actual window')
        data = path.read_bytes()
        target = path.with_name(path.name + '.gz')
        with target.open('xb') as stream:
            stream.write(gzip.compress(data, mtime=0)); stream.flush(); os.fsync(stream.fileno())
        require(gzip.decompress(target.read_bytes()) == data, 'Lossless log transport differs')
        require(fingerprint(path) == before, 'Original cost log changed during transport')
        logs.append({'series': row['label'], 'original': before, 'transport': fingerprint(target), 'byteIdentical': True})
    require(fingerprint(window_path) == window_before, 'Actual window changed during transport')
    exclusive(PERF / 'log-transport.json', {
        'schema': 'logos-engine.lossless-log-transport.v1', 'status': 'passed', 'recordedAt': stamp(),
        'generator': fingerprint(Path(__file__)), 'mode': 'cost-window',
        'adaptedFrom': fingerprint(ROOT / 'docs/migration/lot5b-evidence/record-cost-log-transport.py'),
        'window': window_before, 'logs': logs,
        'qualification': 'Four complete original logs remain unchanged. Deterministic gzip with mtime0 is decompressed and compared byte for byte. No sample, diagnostic or log is removed, filtered or truncated.'})


def release_quiet(reason, cleanup_complete):
    """Public own-lane release, independent of optional receipt/journal success."""
    at = stamp()
    status_path = SHARED / 'lot5c-status.json'
    value = read(status_path)
    require(value.get('quiet_request_id') == REQUEST, 'Cannot release a different request')
    value.update(updated_at=at, quiet_requested=False, quiet_released=True,
        quiet_released_at=at, released_request_id=REQUEST, performance_lock_held=False,
        performance_completed=True, active_command=None if cleanup_complete else 'cleanup_failed_requires_owner',
        heavy_execution_active=not cleanup_complete, no_queued_commands=True,
        quiet_release_reason=reason, quiet_release_automatic=True)
    replace(status_path, value)
    return at


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--availability-deadline', required=True, help='Exact request deadline ISO UTC, requestedAt +600s')
    args = parser.parse_args(argv)
    require(args.execute, 'Explicit --execute required; no automatic production invocation')
    ctl = lifecycle()
    lock_fd, locked, observations, registry = None, False, None, None
    controller_path = COORD / 'lock-window.json'
    observations_path = COORD / 'quiet-observations.jsonl'
    receipt = {'schema': 'logos-engine.lot5c-coordinated-cost-controller.v2',
        'status': 'opening', 'requestId': REQUEST, 'startedAt': stamp(),
        'lockMode': 'exclusive_nonblocking', 'exclusiveAttempts': 0,
        'availabilityMaximumSeconds': 600, 'windowMaximumSeconds': 5400,
        'childMaximumSeconds': 3600, 'executions': [], 'observations': 0,
        'allObservedLanePayloadsStableExceptTimestamp': True,
        'qualification': 'Named cooperative status observations only. The benchmark, ABBA order, populations, tools and acceptance rules are unchanged. All registered child groups are cleaned before unlock and automatic quiet release.'}
    handlers = {sig: signal.signal(sig, interrupted) for sig in
                (signal.SIGINT, signal.SIGTERM, signal.SIGHUP, signal.SIGALRM)}
    journal_created = False
    cleanup_complete = True
    errors = []
    try:
        require(os.environ.get('NODE_OPTIONS') is None, 'No cost NODE_OPTIONS override is authorized')
        require(not controller_path.exists() and not observations_path.exists(), 'Controller outputs already exist; zero retries')
        exclusive(controller_path, receipt); journal_created = True
        request = read(COORD / 'request.json')
        requested = datetime.fromisoformat(request['requestedAt'])
        available = datetime.fromisoformat(args.availability_deadline)
        require(requested.tzinfo is not None and available.tzinfo is not None, 'Timezone-aware request/deadline required')
        require(request['requestId'] == REQUEST and request['availabilityDeadline'] == args.availability_deadline
                and available == requested + timedelta(seconds=600), 'Wrong request/deadline; old ACKs cannot authorize02')
        remaining = (available - datetime.now(timezone.utc)).total_seconds()
        require(0 < remaining <= 600, 'Availability deadline expired before EX')
        availability_end = time.monotonic() + remaining
        signal.setitimer(signal.ITIMER_REAL, remaining)
        readiness_path, isolation_path = PERF / 'readiness.json', COORD / 'isolation.json'
        readiness, isolation = read(readiness_path), read(isolation_path)
        require(readiness['status'] == 'ready' and readiness['measurementAuthorized'] is True
                and readiness['pendingRequirements'] == [], 'Readiness is incomplete')
        require(isolation['requestId'] == REQUEST and isolation['status'] == 'acknowledged_quiet_before_window'
                and isolation['otherLaneAcknowledged'] is True and isolation['ownTrackedComputeEnded'] is True
                and isolation['previewStopped'] is True, 'Fresh isolation is incomplete')
        require({row['lane'] for row in isolation['knownLanes']} == set(LANES), 'Exact active lanes required')
        require(isolation['request'] == fingerprint(COORD / 'request.json'), 'Isolation must bind this actual request')
        require(not (PERF / 'window.json').exists(), 'An actual window already exists; never overwrite')
        for item in readiness['inputs']:
            require(time.monotonic() < availability_end, 'Availability expired while checking readiness')
            require(fingerprint(ROOT / item['path']) == item, 'Readiness input changed: ' + item['path'])
        for item in readiness.get('watchedExternalInputs', []):
            path = Path(item['path']).resolve()
            require(path.is_relative_to(BASELINE), 'Unexpected external readiness input')
            h = hashlib.sha256(); size = 0
            with path.open('rb') as stream:
                for data in iter(lambda: stream.read(1 << 20), b''):
                    size += len(data); h.update(data)
            require((size, h.hexdigest()) == (item['bytes'], item['sha256']), 'External readiness input changed')
        for path in (isolation_path, Path(__file__), HELPER):
            require(fingerprint(path) in readiness['inputs'], 'Readiness must bind reviewed input: ' + str(path))
        declared = read(PERF / 'declaration.json')
        require(readiness['nativeSourceDigest'] == declared['candidate']['nativeDigest'], 'Candidate readiness mismatch')
        baseline_payloads = {}
        for row in isolation['knownLanes']:
            item = row['evidence']
            require(fingerprint(ROOT / item['path']) == item, 'Retained acknowledgment changed')
            require(requested <= datetime.fromisoformat(row['acknowledgedAt'])
                    <= datetime.fromisoformat(isolation['recordedAt']), 'ACK does not follow the fresh request')
            baseline_payloads[row['lane']] = normalized(read(ROOT / item['path']))
        observations = observations_path.open('x')

        def observe(phase):
            if locked:
                require(time.monotonic() < window_end, 'Global5400s cost/analysis deadline exceeded')
            rows = []
            for lane in LANES:
                path = SHARED / (lane + '-status.json')
                data = path.read_bytes()
                require(len(data) <= 100_000, 'Coordination metadata exceeds its allowance')
                value = json.loads(data)
                require(value.get('quiet_acknowledged') is True and value.get('quiet_request_id') == REQUEST,
                        'Exact quiet acknowledgment missing: ' + lane)
                require(value.get('active_command') is None and value.get('heavy_execution_active') is False
                        and value.get('all_own_subagents_idle') is True and value.get('no_queued_commands') is True,
                        'Lane reports active or queued work: ' + lane)
                stable = normalized(value) == baseline_payloads[lane]
                receipt['allObservedLanePayloadsStableExceptTimestamp'] &= stable
                rows.append({'lane': lane, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                    'updatedAt': value.get('updated_at'), 'stableExceptTimestamp': stable})
                require(stable, 'Acknowledged lane payload changed: ' + lane)
            observations.write(json.dumps({'at': stamp(), 'phase': phase, 'lanes': rows}) + '\n')
            observations.flush(); os.fsync(observations.fileno())
            receipt['observations'] += 1
            replace(controller_path, receipt)

        observe('immediately_before_single_ex_attempt')
        require(time.monotonic() < availability_end, 'Availability expired before EX')
        lock_path = SHARED / 'performance.lock'
        lock_fd = os.open(lock_path, os.O_RDWR | os.O_CLOEXEC | os.O_NOFOLLOW)
        os.set_inheritable(lock_fd, False)
        lock_stat = os.fstat(lock_fd)
        require(stat.S_ISREG(lock_stat.st_mode) and (lock_stat.st_dev, lock_stat.st_ino) == EXPECTED_LOCK_IDENTITY,
                'Existing coordination mutex identity/type changed; never recreate or substitute it')
        path_stat = os.stat(lock_path, follow_symlinks=False)
        require((path_stat.st_dev, path_stat.st_ino) == EXPECTED_LOCK_IDENTITY and stat.S_ISREG(path_stat.st_mode),
                'Coordination mutex path changed while opening it')
        receipt['mutexIdentity'] = {'device': lock_stat.st_dev, 'inode': lock_stat.st_ino}
        receipt['exclusiveAttempts'] = 1
        # Exactly one nonblocking attempt; never poll or substitute this mutex.
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        locked = True
        acquired = datetime.now(timezone.utc)
        receipt['lockAcquiredAt'] = acquired.isoformat()
        require(time.monotonic() < availability_end and acquired < available, 'EX was not obtained within600s')
        window_end = time.monotonic() + 5400
        signal.setitimer(signal.ITIMER_REAL, 5400)
        receipt.update(status='running', lockAcquiredAt=acquired.isoformat(), controllerPid=os.getpid(),
            windowDeadline=(acquired + timedelta(seconds=5400)).isoformat(),
            readiness=fingerprint(readiness_path), isolation=fingerprint(isolation_path),
            controller=fingerprint(Path(__file__)), processHelper=fingerprint(HELPER),
            lockDescriptorInheritable=os.get_inheritable(lock_fd))
        exclusive(COORD / 'window-lease.json', {'schema': 'logos-engine.lot5c-cost-window-lease.v2',
            'requestId': REQUEST, 'status': 'exclusive_acquired', 'controllerPid': os.getpid(),
            'lockAcquiredAt': receipt['lockAcquiredAt'], 'windowDeadline': receipt['windowDeadline'],
            'windowMaximumSeconds': 5400, 'childMaximumSeconds': 3600,
            'activeChildrenRegistry': str(REGISTRY_PATH)})
        own = read(SHARED / 'lot5c-status.json')
        require(own.get('quiet_request_id') == REQUEST and own.get('quiet_requested') is True, 'Own request was withdrawn')
        own.update(updated_at=stamp(), performance_lock_held=True, performance_started=True,
            performance_completed=False, active_command='Declared ABBA and complete cost analysis under EX',
            heavy_execution_active=True, quiet_window_deadline=receipt['windowDeadline'])
        replace(SHARED / 'lot5c-status.json', own)
        ctl.enable_subreaper()
        registry = ctl.Registry(REGISTRY_PATH, REQUEST)

        def run(label, command, log_path=None):
            observe('before_' + label)
            log_path = log_path or COORD / (label + '.log')
            row = {'label': label, 'command': command, 'startedAt': stamp(), 'status': 'running'}
            receipt['executions'].append(row); replace(controller_path, receipt)
            print(json.dumps({'phase': 'starting', 'label': label, 'at': row['startedAt']}), flush=True)
            start, last = time.monotonic(), time.monotonic()
            def check():
                nonlocal last
                require(time.monotonic() < window_end, 'Global5400s cost/analysis deadline exceeded')
                if time.monotonic() - last >= 30:
                    observe('during_' + label); last = time.monotonic()
            try:
                with log_path.open('xb') as stream:
                    result = ctl.run_owned(command, cwd=ROOT, stdout=stream, timeout_seconds=3600,
                        deadline_monotonic=window_end, registry=registry, check=check)
                    row.update(result)
                    stream.flush(); os.fsync(stream.fileno())
            except BaseException as error:
                row['error'] = f'{type(error).__name__}: {error}'
                raise
            finally:
                row.update(finishedAt=stamp(), elapsedSeconds=time.monotonic() - start, status='terminal',
                    log=fingerprint(log_path) if log_path.exists() else None)
                replace(controller_path, receipt)
            observe('after_' + label)
            print(json.dumps({'phase': 'finished', 'label': label, 'exitCode': row['exitCode']}), flush=True)
            return row

        observe('before_window')
        require(datetime.fromisoformat(readiness['finalizedAt']) < datetime.now(timezone.utc), 'Readiness must precede the window')
        command = ['python', '-B', 'scripts/run-native-cost-window.py', str(BASELINE), relative(PERF),
                   relative(BASE_MANIFEST), relative(CAND_MANIFEST)]
        require(run('official-abba', command)['exitCode'] == 0, 'Official ABBA window failed')
        window = read(PERF / 'window.json')
        require(window['status'] == 'passed' and window['finalIntegrity'] == 'passed', 'Incomplete actual window')
        require(window['plannedOrder'] == [r['label'] for r in window['executions']] == ['A1', 'B1', 'B2', 'A2'], 'Order mismatch')
        for index in (1, 2):
            paths = [PERF / 'comparison-policy.json', PERF / f'cohort{index}/baseline.json',
                     PERF / f'cohort{index}/after.json', PERF / f'cohort{index}/comparison.json']
            require(run(f'cohort{index}-comparison', ['node', 'scripts/compare-native-loop-costs.mjs',
                        *map(relative, paths)])['exitCode'] == 0, 'Cohort comparator failed')
        contract = read(PERF / 'owner-growth-contract.json')
        strict_inputs = [ROOT / 'scripts/compare-native-cost-cohorts.mjs', PERF / 'comparison-policy.json']
        for index in (1, 2):
            strict_inputs.extend(PERF / f'cohort{index}/{name}.json' for name in ('baseline', 'after', 'comparison'))
        strict_before = [fingerprint(p) for p in strict_inputs]
        strict_command = ['node', relative(strict_inputs[0]), *map(relative, strict_inputs[1:]), contract['historicalAggregateOutput']]
        strict_log = ROOT / contract['strictFailureLog']
        row = run('historical-strict-aggregation', strict_command, strict_log)
        failure = {'schema': 'logos-engine.retained-tool-failure.v1', 'command': strict_command,
                   'startedAt': row['startedAt'], 'finishedAt': row['finishedAt'], 'exitCode': row['exitCode'],
                   'inputs': strict_before, 'inputsUnchanged': strict_before == [fingerprint(p) for p in strict_inputs],
                   'outputExists': (ROOT / contract['historicalAggregateOutput']).exists(), 'log': fingerprint(strict_log)}
        exclusive(ROOT / contract['strictFailureReceipt'], failure)
        require(failure['exitCode'] != 0 and failure['inputsUnchanged'] and not failure['outputExists'], 'Expected historical refusal not established')
        require('Within-cohort work metadata changed' in strict_log.read_text(), 'Historical comparator failed for another reason')
        for label, command in [
            ('qualified-consolidation', ['node', 'docs/migration/lot5c-evidence/consolidate-owner-costs.mjs',
                relative(PERF / 'owner-growth-contract.json'), relative(PERF / 'owner-growth-comparison.json')]),
            ('independent-arithmetic-review', ['python', '-B', 'docs/migration/lot5c-evidence/review-owner-costs.py',
                relative(PERF / 'owner-growth-contract.json'), relative(PERF / 'owner-growth-comparison.json'),
                relative(PERF / 'owner-growth-review.json')])]:
            require(run(label, command)['exitCode'] == 0, 'Cost postprocessing failed: ' + label)
        observe('before_cost_log_transport')
        retain_cost_logs()
        observe('after_cost_log_transport')
        require(run('cost-report', ['python', '-B', 'docs/migration/lot5c-evidence/write-cost-results.py',
                    '--output-directory', relative(PERF)])['exitCode'] == 0, 'Cost report failed')
        observe('after_all_reviews')
        for lane in LANES:
            exclusive(COORD / (lane + '-after-review.json'), read(SHARED / (lane + '-status.json')))
        receipt.update(status='completed_pending_root_acceptance', completedAt=stamp(),
                       window=fingerprint(PERF / 'window.json'), review=fingerprint(PERF / 'owner-growth-review.json'),
                       comparison=fingerprint(PERF / 'owner-growth-comparison.json'),
                       costAccepted=read(PERF / 'owner-growth-review.json')['accepted'])
    except BaseException as error:
        receipt.update(status='refused_ex_no_measurement' if isinstance(error, BlockingIOError) and not locked else 'failed',
            error=f'{type(error).__name__}: {error}', failedAt=stamp())
    finally:
        # Cleanup does not depend on any journal write, hash, close, or callback.
        signal.setitimer(signal.ITIMER_REAL, 0)
        for sig in handlers:
            signal.signal(sig, signal.SIG_IGN)
        try:
            if registry is not None and registry.groups:
                for row in list(registry.groups.values()):
                    try:
                        ctl.terminate_owned_group(row['pgid'])
                    except BaseException as error:
                        cleanup_complete = False; errors.append('owned-group cleanup: ' + str(error))
        finally:
            lock_released_at, descriptor_closed_at = None, None
            try:
                if lock_fd is not None and locked:
                    fcntl.flock(lock_fd, fcntl.LOCK_UN)
                    lock_released_at = stamp()
            except BaseException as error:
                errors.append('unlock: ' + str(error))
            finally:
                if lock_fd is not None:
                    try:
                        os.close(lock_fd)
                        descriptor_closed_at = stamp()
                        if locked and lock_released_at is None:
                            lock_released_at = descriptor_closed_at
                    except BaseException as error:
                        errors.append('lock close: ' + str(error))
                receipt['lockReleasedAt'] = lock_released_at
                receipt['descriptorClosedAt'] = descriptor_closed_at
                receipt['ownedGroupsTerminal'] = cleanup_complete
                try:
                    receipt['quietReleasedAt'] = release_quiet(receipt['status'], cleanup_complete)
                    receipt['automaticQuietReleasePerformed'] = True
                except BaseException as error:
                    errors.append('public quiet release: ' + str(error))
                    receipt['automaticQuietReleasePerformed'] = False
        if observations is not None:
            try:
                observations.close(); receipt['coordinationObservations'] = fingerprint(observations_path)
            except BaseException as error:
                errors.append('observation retention: ' + str(error))
        if REGISTRY_PATH.exists():
            try:
                exclusive(COORD / 'owned-process-groups-terminal.json', read(REGISTRY_PATH))
            except BaseException as error:
                errors.append('registry retention: ' + str(error))
        receipt['cleanupErrors'] = errors
        if errors:
            receipt['status'] = 'failed'
        if journal_created:
            try:
                replace(controller_path, receipt)
            except BaseException as error:
                errors.append('terminal journal: ' + str(error))
        try:
            exclusive(COORD / 'controller-release.json', {'schema': 'logos-engine.lot5c-controller-release.v2',
                'requestId': REQUEST, 'recordedAt': stamp(), 'status': receipt['status'],
                'lockReleasedAt': receipt['lockReleasedAt'], 'descriptorClosedAt': receipt['descriptorClosedAt'], 'ownedGroupsTerminal': cleanup_complete,
                'automaticQuietReleasePerformed': receipt.get('automaticQuietReleasePerformed', False),
                'errors': errors, 'futureCommandsQueued': False})
        except BaseException as error:
            errors.append('release journal: ' + str(error))
        for sig, handler in handlers.items():
            signal.signal(sig, handler)
        print(json.dumps({k: receipt.get(k) for k in ('status', 'error', 'exclusiveAttempts',
            'lockReleasedAt', 'quietReleasedAt', 'ownedGroupsTerminal')} | {'cleanupErrors': errors}), flush=True)
    return 0 if receipt['status'] == 'completed_pending_root_acceptance' and not errors else 1


if __name__ == '__main__':
    raise SystemExit(main())
