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
import gzip
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[5]
SHARED = Path('/workspace/shared/sra-coordination')
LANES = ('lot6b', 'lot8a', 'lot10c')
ACTIVE_LANES = ('lot6b', 'lot10c')
INACTIVE_LANES = ('lot8a',)
TERMINAL_GUARD = ('Development task is complete. No active process, preview, worker or queued command; '
                  'no automatic future8A work will start. Any new user turn must check active quiet windows '
                  'before source/compute work.')
REQUEST = 'lot5c-cost-a33a5f88-final-01'
PERF = ROOT / 'docs/migration/lot5c-evidence/recovery/performance-integrated-02'
COORD = ROOT / 'docs/migration/lot5c-evidence/recovery/coordination/cost-final-01'
BASELINE = Path('/workspace/sites/sra-lot5c-baseline-site102-1019d2e/.sites-checkout')
BASE_MANIFEST = ROOT / 'docs/migration/lot10b-evidence/recovery-20261111/integrated-final-02/source-manifest.json'
CAND_MANIFEST = ROOT / 'docs/migration/lot5c-evidence/recovery/integrated-final-01/source-manifest.json'


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


def require_terminal_inactivity(value):
    require(value.get('terminal_idle') is True and value.get('preview_stopped') is True
            and value.get('all_own_subagents_compute_idle') is True
            and value.get('performance_started') is False and value.get('publication_started') is False
            and value.get('quiet_acknowledged') is False
            and value.get('coordination_availability') == TERMINAL_GUARD,
            'Closed lane no longer retains its terminal inactivity and guarded-resumption declaration')


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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true', help='Start the actual declared measurements')
    args = parser.parse_args()
    require(args.execute, 'Explicit --execute required; this is not a preflight command')
    require(os.environ.get('NODE_OPTIONS') is None, 'No cost NODE_OPTIONS override is authorized')
    readiness_path, isolation_path = PERF / 'readiness.json', COORD / 'isolation.json'
    readiness, isolation = read(readiness_path), read(isolation_path)
    require(readiness['status'] == 'ready' and readiness['measurementAuthorized'] is True
            and readiness['pendingRequirements'] == [], 'Readiness is incomplete')
    require(isolation['requestId'] == REQUEST and isolation['status'] == 'acknowledged_quiet_before_window'
            and isolation['otherLaneAcknowledged'] is True and isolation['ownTrackedComputeEnded'] is True
            and isolation['previewStopped'] is True, 'Fresh isolation is incomplete')
    require(len(isolation['knownLanes']) == len(ACTIVE_LANES)
            and {row['lane'] for row in isolation['knownLanes']} == set(ACTIVE_LANES), 'Exact active lanes required')
    require(len(isolation['inactiveLanes']) == len(INACTIVE_LANES)
            and {row['lane'] for row in isolation['inactiveLanes']} == set(INACTIVE_LANES), 'Exact closed monitored lane required')
    require(not (PERF / 'window.json').exists(), 'An actual window already exists; never overwrite it')
    for item in readiness['inputs']:
        require(fingerprint(ROOT / item['path']) == item, 'Readiness input changed: ' + item['path'])
    require(fingerprint(isolation_path) in readiness['inputs'], 'Readiness must bind the exact isolation receipt')
    require(fingerprint(Path(__file__)) in readiness['inputs'], 'Readiness must bind this reviewed controller')
    request_path = COORD / 'request.json'
    require(fingerprint(request_path) == isolation['request'] and isolation['request'] in readiness['inputs'], 'Exact current request required')
    request = read(request_path)
    require(request['requestId'] == REQUEST, 'Wrong request identity')
    requested = datetime.fromisoformat(request['requestedAt'])
    declared = read(PERF / 'declaration.json')
    require(readiness['nativeSourceDigest'] == declared['candidate']['nativeDigest'], 'Candidate readiness mismatch')
    baseline_payloads = {}
    for row in [*isolation['knownLanes'], *isolation['inactiveLanes']]:
        item = row['evidence']
        require(fingerprint(ROOT / item['path']) == item, 'Retained acknowledgment changed')
        payload = read(ROOT / item['path'])
        if row['lane'] in ACTIVE_LANES:
            require(datetime.fromisoformat(row['acknowledgedAt']) >= requested, 'Active ACK predates this request')
        else:
            require(row['mode'] == 'terminal_inactive_guarded' and row['observationForRequestId'] == REQUEST
                    and row['acknowledgedAt'] is None and row['originalUpdatedAt'] == payload['updated_at']
                    and datetime.fromisoformat(row['observedAt']) >= requested, 'Closed lane observation is not fresh or misstates an ACK')
            require_terminal_inactivity(payload)
        baseline_payloads[row['lane']] = normalized(payload)
    controller_path = COORD / 'lock-window.json'
    observations_path = COORD / 'quiet-observations.jsonl'
    require(not controller_path.exists() and not observations_path.exists(), 'Controller outputs already exist')
    lock = (SHARED / 'performance.lock').open('a+')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    receipt = {'schema': 'logos-engine.lot5c-coordinated-cost-controller.v1', 'status': 'running',
        'requestId': REQUEST, 'lockAcquiredAt': stamp(), 'lockMode': 'exclusive_nonblocking',
        'readiness': fingerprint(readiness_path), 'isolation': fingerprint(isolation_path),
        'controller': fingerprint(Path(__file__)), 'executions': [], 'observations': 0,
        'activeAcknowledgedLanes': list(ACTIVE_LANES), 'terminalInactiveMonitoredLanes': list(INACTIVE_LANES),
        'allObservedLanePayloadsStableExceptTimestamp': True,
        'qualification': 'Cooperative named-status observations, not continuous operating-system process monitoring. No unrelated source, Git, archive, browser or worker activity is authorized.'}
    exclusive(controller_path, receipt)
    observations = observations_path.open('x')
    old_handlers = {sig: signal.signal(sig, interrupted) for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP)}

    def observe(phase):
        rows = []
        for lane in LANES:
            path = SHARED / (lane + '-status.json')
            data = path.read_bytes()
            require(len(data) <= 100_000, 'Coordination file exceeds the bounded metadata allowance')
            value = json.loads(data)
            if lane in ACTIVE_LANES:
                require(value.get('quiet_acknowledged') is True and value.get('quiet_request_id') == REQUEST,
                        'Exact active quiet acknowledgment missing: ' + lane)
            else:
                require_terminal_inactivity(value)
            require(value.get('active_command') is None and value.get('heavy_execution_active') is False
                    and value.get('all_own_subagents_idle') is True and value.get('no_queued_commands') is True,
                    'Lane reports active or queued work: ' + lane)
            stable = normalized(value) == baseline_payloads[lane]
            receipt['allObservedLanePayloadsStableExceptTimestamp'] &= stable
            rows.append({'lane': lane, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                         'mode': 'active_lane_fresh_ack' if lane in ACTIVE_LANES else 'terminal_inactive_guarded',
                         'updatedAt': value.get('updated_at'), 'stableExceptTimestamp': stable})
            require(stable, 'Acknowledged lane payload changed during isolation: ' + lane)
        observations.write(json.dumps({'at': stamp(), 'phase': phase, 'lanes': rows}) + '\n')
        observations.flush(); os.fsync(observations.fileno())
        receipt['observations'] += 1
        replace(controller_path, receipt)

    def run(label, command, log_path=None):
        observe('before_' + label)
        log_path = log_path or COORD / (label + '.log')
        row = {'label': label, 'command': command, 'startedAt': stamp(), 'status': 'running'}
        receipt['executions'].append(row); replace(controller_path, receipt)
        print(json.dumps({'phase': 'starting', 'label': label, 'at': row['startedAt']}), flush=True)
        child, start, last = None, time.monotonic(), time.monotonic()
        try:
            with log_path.open('xb') as stream:
                child = subprocess.Popen(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
                while child.poll() is None:
                    now = time.monotonic()
                    if now - last >= 30:
                        observe('during_' + label); last = now
                    require(now - start < 3600, 'Bounded command exceeded 3600 seconds: ' + label)
                    time.sleep(0.5)
                row['exitCode'] = child.returncode
                stream.flush(); os.fsync(stream.fileno())
        finally:
            if child is not None and child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL); child.wait(timeout=5)
            if child is not None:
                row['exitCode'] = child.returncode
            row.update(finishedAt=stamp(), elapsedSeconds=time.monotonic() - start,
                       status='terminal', log=fingerprint(log_path) if log_path.exists() else None)
            replace(controller_path, receipt)
        observe('after_' + label)
        print(json.dumps({'phase': 'finished', 'label': label, 'exitCode': row['exitCode']}), flush=True)
        return row

    try:
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
                       explicitQuietReleasePerformed=False)
    except BaseException as error:
        receipt.update(status='failed', error=f'{type(error).__name__}: {error}', failedAt=stamp(),
                       explicitQuietReleasePerformed=False)
    finally:
        for sig, handler in old_handlers.items():
            signal.signal(sig, handler)
        observations.close()
        receipt['coordinationObservations'] = fingerprint(observations_path)
        receipt['lockReleaseRequestedAt'] = stamp()
        fcntl.flock(lock, fcntl.LOCK_UN); lock.close()
        receipt['lockReleasedAt'] = stamp()
        replace(controller_path, receipt)
        print(json.dumps({k: receipt.get(k) for k in ['status', 'error', 'lockReleasedAt', 'observations']}), flush=True)
    return 0 if receipt['status'] == 'completed_pending_root_acceptance' else 1


if __name__ == '__main__':
    raise SystemExit(main())
