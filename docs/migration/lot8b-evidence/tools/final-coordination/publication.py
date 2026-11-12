#!/usr/bin/env python3
"""Own a short Lot 8B publication lease, then release the owned descriptor.

No deployment or Git push is performed by this helper. The delivery owner
rechecks publication/access under the lease and calls the native Sites tools.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import select
import sys
import time
import traceback

sys.dont_write_bytecode = True
import common as c

SELF = Path(__file__).resolve()
MAXIMUM_SECONDS = 300
PREFLIGHT_SECONDS = 180
PLAN_SCHEMA = 'logos-engine.lot8b.publication-lease-plan.v1'


def verify_plan(plan, deadline, execution_head):
    c.require(plan.get('schema') == PLAN_SCHEMA and plan.get('owner') == 'lot8b', 'Unsupported publication plan')
    c.require(plan.get('publicationAuthorized') is True and plan.get('maximumSeconds') == MAXIMUM_SECONDS,
              'Publication authorization and fixed 300 second bound required')
    c.require(isinstance(plan.get('candidateCommit'), str) and c.COMMIT.fullmatch(plan['candidateCommit']),
              'Full frozen candidate commit required')
    c.require(isinstance(plan.get('candidateNativeVersion'), str) and c.VERSION.fullmatch(plan['candidateNativeVersion']),
              'Final native version required')
    c.require(type(plan.get('expectedPublishedSiteVersion')) is int and plan['expectedPublishedSiteVersion'] > 0 and
              isinstance(plan.get('expectedPublishedSourceCommit'), str) and
              c.COMMIT.fullmatch(plan['expectedPublishedSourceCommit']), 'Observed publication identity required')
    c.require(plan.get('audience') == 'owner_private', 'This helper preserves the confirmed owner-private scope')
    known = c.verify_inputs(plan['immutableInputs'], deadline=deadline)
    c.require({SELF, SELF.with_name('common.py'), c.ROOT / 'src/logos-engine/v6-native-runtime.ts'} <= known,
              'Publication helper, shared helper and native version source must be frozen')
    head, committed_names = c.source_commit(c.ROOT, plan['candidateCommit'], deadline)
    c.require(head == execution_head, 'Publication execution HEAD changed')
    c.require(c.native_version(c.ROOT) == plan['candidateNativeVersion'], 'Native publication version differs')
    c.require({c.ROOT / name for name in committed_names} <= known, 'All native publication source files must be frozen')
    actual_names = {path.relative_to(c.ROOT).as_posix()
                    for folder in ('src/logos-engine', 'src/runtime')
                    for path in (c.ROOT / folder).rglob('*')
                    if path.is_file() and path.suffix in {'.ts', '.json', '.drm'}}
    c.require(actual_names == committed_names, 'Uncommitted or missing native publication file')
    return known


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plan', required=True, help='Prospective repository-relative 8B publication plan')
    parser.add_argument('--output', required=True, help='New repository-relative 8B lease evidence directory')
    args = parser.parse_args()
    plan_path = c.local(args.plan, evidence=True)
    output = c.local(args.output, evidence=True, must_exist=False)
    c.require(output != c.EVIDENCE and not output.exists(), 'New dedicated output directory required')
    output.mkdir(parents=True, exist_ok=False)
    c.signals()
    started = time.monotonic()
    preflight_deadline = started + PREFLIGHT_SECONDS
    lease = 'lot8b-publication-' + str(os.getpid()) + '-' + os.urandom(6).hex()
    lock = c.ExclusiveLock('publication')
    receipt_path = output / 'lease.json'
    row = {'schema': 'logos-engine.lot8b.publication-lease.v1', 'status': 'preflight',
           'startedAt': c.utc(), 'plan': args.plan, 'lease': lease,
           'maximumSeconds': MAXIMUM_SECONDS, 'preflightMaximumSeconds': PREFLIGHT_SECONDS,
           'blocking': False, 'peerAvailabilityWait': False, 'performanceLockAcquired': False,
           'publicationPerformedByHelper': False, 'deploymentSuccessAssertedByHelper': False,
           'requiresFreshPublicationAndAudienceCheckByDeliveryOwnerUnderLease': True,
           'lock': lock.record}
    c.atomic_json(output / 'lease.started.json', row, create=True)
    c.atomic_json(receipt_path, row, create=True)
    active_status_written = False
    previous_stdin_blocking = None
    exit_code = 1
    try:
        expected_plan = c.fingerprint(plan_path, preflight_deadline)
        row['planFingerprint'] = expected_plan
        plan = c.read_json(plan_path)
        execution_head = c.current_head(c.ROOT, preflight_deadline)
        row['executionHead'] = execution_head
        verify_plan(plan, preflight_deadline, execution_head)
        c.own_idle_status()
        observation = c.process_snapshot((c.ROOT,))
        row['ownWorkCheck'] = c.require_no_visible_own_work(observation)
        c.atomic_json(output / 'environment-before.json', observation, create=True)
        c.check_time(preflight_deadline)
        if not lock.acquire():
            row.update(status='unavailable', reason='publication_mutex_busy_no_wait')
            exit_code = 75
        else:
            acquired = time.monotonic()
            deadline = acquired + MAXIMUM_SECONDS
            c.own_idle_status()
            c.update_own_status('publication', lease, True)
            active_status_written = True
            c.require(c.fingerprint(plan_path, deadline) == expected_plan, 'Publication plan changed')
            verify_plan(plan, deadline, execution_head)
            lock.check_identity()
            row.update(status='held', acquiredAt=c.utc(), expectedPublishedSiteVersion=plan['expectedPublishedSiteVersion'],
                       expectedPublishedSourceCommit=plan['expectedPublishedSourceCommit'],
                       candidateCommit=plan['candidateCommit'], candidateNativeVersion=plan['candidateNativeVersion'])
            c.atomic_json(receipt_path, row)
            c.emit({'status': 'held', 'lease': lease, 'maximumSeconds': MAXIMUM_SECONDS,
                    'remainingSeconds': max(0, deadline - time.monotonic()), 'identity': lock.record['identity'],
                    'releaseLine': 'release:' + lease, 'abortLine': 'abort:' + lease})
            stdin_fd = sys.stdin.fileno()
            previous_stdin_blocking = os.get_blocking(stdin_fd)
            os.set_blocking(stdin_fd, False)
            pending = b''
            released_by = None
            while time.monotonic() < deadline:
                c.check_time(deadline)
                lock.check_identity()
                ready, _, _ = select.select([stdin_fd], [], [], min(0.5, max(0, deadline - time.monotonic())))
                if not ready:
                    continue
                try:
                    chunk = os.read(stdin_fd, 4096)
                except BlockingIOError:
                    continue
                if not chunk:
                    released_by = 'stdin_closed'
                    break
                pending += chunk
                c.require(len(pending) <= 8192, 'Publication control input exceeded its bound')
                while b'\n' in pending:
                    raw_line, pending = pending.split(b'\n', 1)
                    line = raw_line.decode('utf-8', errors='strict').strip()
                    if line == 'release:' + lease:
                        released_by = 'explicit_owner_release'
                        break
                    if line == 'abort:' + lease:
                        released_by = 'explicit_owner_abort'
                        break
                    c.require(not line, 'Unknown publication control line')
                if released_by is not None:
                    break
            row['releasedBy'] = released_by or 'bounded_holder_deadline'
            if released_by == 'explicit_owner_release':
                c.require(c.fingerprint(plan_path, deadline) == expected_plan, 'Plan changed while publication lease held')
                verify_plan(plan, deadline, execution_head)
                row['finalInputIntegrity'] = 'passed'
                row['status'] = 'released_by_owner'
                exit_code = 0
            elif released_by == 'explicit_owner_abort':
                row['status'] = 'aborted_by_owner'
                exit_code = 1
            else:
                row['status'] = 'expired_or_disconnected'
                exit_code = 124 if released_by is None else 1
    except BaseException as error:
        row.update(status='failed', error=type(error).__name__ + ': ' + str(error), traceback=traceback.format_exc())
        row['releasedBy'] = 'signal_' + str(c.STOP_SIGNAL) if c.STOP_SIGNAL is not None else 'exception_cleanup'
        exit_code = 130 if c.STOP_SIGNAL is not None else (124 if isinstance(error, TimeoutError) else 1)
    finally:
        row['lock'] = lock.release()
        if row['lock'].get('releaseErrors') or row['lock'].get('sameLockFile') is False:
            row['status'] = 'failed_lock_integrity'
            exit_code = 1
        if active_status_written:
            try:
                row['statusRelease'] = c.update_own_status('publication', lease, False)
                if not row['statusRelease']['updated']:
                    row['status'] = 'failed_status_release'
                    exit_code = 1
            except BaseException as error:
                row['statusReleaseError'] = type(error).__name__ + ': ' + str(error)
                row['status'] = 'failed_status_release'
                exit_code = 1
        if previous_stdin_blocking is not None:
            try:
                os.set_blocking(sys.stdin.fileno(), previous_stdin_blocking)
            except OSError as error:
                row['stdinRestoreError'] = str(error)
        row.update(finishedAt=c.utc(), elapsedSeconds=time.monotonic() - started, controllerExitCode=exit_code)
        try:
            c.atomic_json(receipt_path, row)
        except BaseException as error:
            c.emit({'status': 'receipt_storage_failed_after_release', 'error': type(error).__name__ + ': ' + str(error),
                    'lock': row['lock']})
            exit_code = 1
        c.emit({'status': row['status'], 'exitCode': exit_code, 'releasedBy': row.get('releasedBy'),
                'lockDescriptorClosed': row['lock']['descriptorClosed'], 'sameLockFile': row['lock'].get('sameLockFile'),
                'output': args.output})
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
