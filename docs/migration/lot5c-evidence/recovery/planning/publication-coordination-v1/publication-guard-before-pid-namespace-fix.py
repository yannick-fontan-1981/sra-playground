#!/usr/bin/env python3
"""Noninteractive publication mutex guardian. It never spawns a child or calls an API."""
from __future__ import annotations
import argparse
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import stat
import sys
import tempfile
import time

COORD = Path('/workspace/shared/sra-coordination')
LOCK = COORD / 'publication.lock'
LEDGER = COORD / 'publication-operation-state.json'
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'
CHECKOUT = Path(__file__).resolve().parents[6]
SCHEMA = 'logos-engine.lot5c.publication-guard.v1'
LEDGER_SCHEMA = 'logos-engine.publication-operation-state.v1'
LIMIT = 16384
MAX_PROGRESS = 128
KINDS = {'prepare_source', 'save_version', 'save_and_deploy_private', 'deploy_version', 'publish_on_push'}
PENDING = {'pending', 'building', 'publishing', 'unknown'}
TERMINAL = {'succeeded', 'failed', 'saved', 'not_started'}
ID_RE = re.compile(r'[A-Za-z0-9_.~:-]{1,240}\Z')


class GuardError(Exception):
    pass


@dataclass(frozen=True)
class Config:
    run_dir: Path
    request_id: str
    lock_path: Path = LOCK
    ledger_path: Path = LEDGER
    expected_device: int = 27
    expected_inode: int = 1971855
    duration: float = 600.0
    reconcile_only: bool = False


def now():
    return datetime.now(timezone.utc)


def strict_json(raw):
    def pairs(items):
        value = {}
        for key, item in items:
            if key in value: raise GuardError('duplicate_json_key')
            value[key] = item
        return value
    def constant(_): raise GuardError('nonfinite_json')
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)


def read_small(path, *, absent=False):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK)
    except FileNotFoundError:
        if absent: return None
        raise
    with os.fdopen(fd, 'rb') as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode): raise GuardError('metadata_not_regular')
        raw = stream.read(LIMIT + 1)
    if len(raw) > LIMIT: raise GuardError('metadata_too_large')
    value = strict_json(raw)
    if not isinstance(value, dict): raise GuardError('metadata_not_object')
    return value


def durable_json(path, value, *, exclusive=False):
    data = (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()
    if len(data) > LIMIT: raise GuardError('metadata_too_large')
    fd, name = tempfile.mkstemp(prefix='.' + path.name + '.', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        if exclusive:
            os.link(name, path)
            os.unlink(name)
        else:
            os.replace(name, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
        try: os.fsync(directory)
        finally: os.close(directory)
    finally:
        try: os.unlink(name)
        except FileNotFoundError: pass


def identifier(value):
    return isinstance(value, str) and ID_RE.fullmatch(value) is not None


def ledger_checked(path):
    value = read_small(path, absent=True)
    if value is None: return None
    if (value.get('schema') != LEDGER_SCHEMA or value.get('projectId') != PROJECT
            or type(value.get('unresolved')) is not bool or not isinstance(value.get('operation'), dict)):
        raise GuardError('existing_ledger_invalid')
    return value


def validate_progress(event, request_id, sequence):
    allowed = {'schema', 'requestId', 'sequence', 'event', 'operationId', 'operation', 'status',
               'commitSha', 'archiveSha256', 'versionId', 'deploymentId', 'evidencePath', 'evidenceSha256'}
    if set(event) - allowed: raise GuardError('unexpected_progress_field')
    if (event.get('schema') != 'logos-engine.publication-progress.v1'
            or event.get('requestId') != request_id or event.get('sequence') != sequence
            or type(event.get('sequence')) is not int or not 1 <= sequence <= MAX_PROGRESS
            or not identifier(event.get('operationId'))):
        raise GuardError('progress_identity_invalid')
    if event.get('event') not in ('begin', 'update'): raise GuardError('progress_event_invalid')
    for key, length in (('commitSha', 40), ('archiveSha256', 64), ('evidenceSha256', 64)):
        if key in event and (not isinstance(event[key], str) or not re.fullmatch('[a-f0-9]{' + str(length) + '}', event[key])):
            raise GuardError('progress_hash_invalid')
    for key in ('versionId', 'deploymentId'):
        if key in event and not identifier(event[key]): raise GuardError('native_identifier_invalid')
    if 'evidencePath' in event and (not isinstance(event['evidencePath'], str) or len(event['evidencePath']) > 1024
                                 or not Path(event['evidencePath']).is_absolute()):
        raise GuardError('evidence_path_invalid')
    if event['event'] == 'begin':
        if event.get('operation') not in KINDS or 'status' in event: raise GuardError('begin_invalid')
        if event['operation'] != 'prepare_source' and 'commitSha' not in event: raise GuardError('begin_commit_required')
        if event['operation'] == 'deploy_version' and 'versionId' not in event: raise GuardError('deploy_version_required')
    elif event.get('status') not in PENDING | TERMINAL or 'operation' in event:
        raise GuardError('update_invalid')
    return event


def apply_progress(config, state, event):
    previous = ledger_checked(config.ledger_path)
    if event['event'] == 'begin':
        if config.reconcile_only: raise GuardError('reconcile_mode_cannot_begin')
        if previous and previous['unresolved']: raise GuardError('provider_operation_unresolved')
        operation = {'operationId': event['operationId'], 'kind': event['operation'],
                     'ownerRequestId': config.request_id, 'begunAt': now().isoformat(), 'status': 'intent_durable'}
        operation.update({key: event[key] for key in ('commitSha', 'archiveSha256', 'versionId', 'deploymentId') if key in event})
        value = {'schema': LEDGER_SCHEMA, 'projectId': PROJECT, 'unresolved': True, 'operation': operation}
    else:
        if not previous or not previous['unresolved'] or previous['operation'].get('operationId') != event['operationId']:
            raise GuardError('update_without_matching_unresolved_operation')
        operation = dict(previous['operation'])
        for key in ('commitSha', 'archiveSha256', 'versionId', 'deploymentId'):
            if key in event:
                if key in operation and operation[key] != event[key]: raise GuardError('native_or_source_identity_changed')
                operation[key] = event[key]
        status_value = event['status']
        if status_value == 'not_started' and not config.reconcile_only:
            raise GuardError('not_started_requires_reconciliation_mode')
        if status_value in TERMINAL:
            if 'evidencePath' not in event or 'evidenceSha256' not in event: raise GuardError('terminal_evidence_required')
            evidence_fd = os.open(event['evidencePath'], os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK)
            with os.fdopen(evidence_fd, 'rb') as evidence_stream:
                if not stat.S_ISREG(os.fstat(evidence_stream.fileno()).st_mode): raise GuardError('evidence_not_regular')
                evidence_raw = evidence_stream.read(65537)
            if len(evidence_raw) > 65536 or hashlib.sha256(evidence_raw).hexdigest() != event['evidenceSha256']:
                raise GuardError('terminal_evidence_fingerprint_mismatch')
            if status_value == 'saved' and ('versionId' not in operation or operation['kind'] != 'save_version'):
                raise GuardError('saved_version_identity_required')
            if status_value == 'succeeded':
                if operation['kind'] == 'save_version': raise GuardError('save_requires_saved_status')
                if operation['kind'] != 'prepare_source' and ('versionId' not in operation or 'deploymentId' not in operation):
                    raise GuardError('terminal_native_identifiers_required')
            operation['evidence'] = {'path': event['evidencePath'], 'sha256': event['evidenceSha256']}
        operation.update(status=status_value, observedAt=now().isoformat())
        value = {'schema': LEDGER_SCHEMA, 'projectId': PROJECT,
                 'unresolved': status_value in PENDING, 'operation': operation}
    value.update(lastGuardRequestId=config.request_id, lastProgressSequence=event['sequence'], updatedAt=now().isoformat())
    # This durable ledger precedes the ACK. Root must not call a native API before the ACK.
    durable_json(config.ledger_path, value)
    state.update(acceptedProgressSequence=event['sequence'], operation=value['operation'], providerUnresolved=value['unresolved'])


def hold(config):
    started = time.monotonic(); deadline = started + config.duration
    started_wall = now(); end_wall = started_wall + timedelta(seconds=config.duration)
    state = {'schema': SCHEMA, 'requestId': config.request_id, 'projectId': PROJECT,
             'state': 'starting', 'startedAt': started_wall.isoformat(), 'deadlineAt': end_wall.isoformat(),
             'durationLimitSeconds': config.duration, 'pid': os.getpid(), 'toolSessionId': None,
             'toolSessionBinding': 'root_records_actual_tool_id_separately_before_first_operation',
             'lockAttemptCount': 0, 'lockAcquired': False, 'lockReleased': False,
             'acceptedProgressSequence': 0, 'providerUnresolved': False,
             'reconcileOnly': config.reconcile_only, 'childProcessesSpawned': False, 'apiCallsMade': False}
    descriptor = None; locked = False; run_owned = False; handlers = {}; stop = {'signal': 0}; code = 1
    journal = config.run_dir / 'guard.json'; terminal = config.run_dir / 'terminal.json'
    def stop_signal(number, _frame):
        if not stop['signal']: stop['signal'] = number
    try:
        if not identifier(config.request_id) or not 0 < config.duration <= 600: raise GuardError('configuration_invalid')
        if config.run_dir.resolve().is_relative_to(CHECKOUT): raise GuardError('journal_inside_checkout')
        config.run_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        if journal.exists() or terminal.exists() or (config.run_dir / 'release.json').exists():
            raise GuardError('run_directory_already_used')
        (config.run_dir / 'progress').mkdir(mode=0o700, exist_ok=False)
        run_owned = True
        durable_json(journal, state, exclusive=True)
        for number in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
            handlers[number] = signal.signal(number, stop_signal)
        descriptor = os.open(config.lock_path, os.O_RDWR | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK)
        metadata = os.fstat(descriptor)
        if not stat.S_ISREG(metadata.st_mode) or (metadata.st_dev, metadata.st_ino) != (config.expected_device, config.expected_inode):
            raise GuardError('existing_mutex_identity_mismatch')
        os.set_inheritable(descriptor, False)
        state['lockDescriptorInheritable'] = os.get_inheritable(descriptor)
        state['lockAttemptCount'] = 1
        try: fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise GuardError('publication_lock_unavailable') from None
        locked = True
        state.update(lockAcquired=True, lockAcquiredAt=now().isoformat())
        prior = ledger_checked(config.ledger_path)
        if prior:
            state.update(operation=prior['operation'], providerUnresolved=prior['unresolved'])
            if prior['unresolved'] and not config.reconcile_only: raise GuardError('prior_provider_operation_unresolved')
        state['state'] = 'held'
        heartbeat_due = 0.0
        while True:
            if stop['signal']: raise GuardError('interrupted')
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                state['state'] = 'expired'; code = 124; break
            release = read_small(config.run_dir / 'release.json', absent=True)
            if release is not None:
                if (set(release) != {'schema', 'requestId', 'reason'}
                        or release.get('schema') != 'logos-engine.publication-release.v1'
                        or release.get('requestId') != config.request_id
                        or release.get('reason') not in ('completed', 'abort')):
                    raise GuardError('release_invalid')
                state.update(state='released', releaseReason=release['reason'])
                code = 0 if not state['providerUnresolved'] else 2
                break
            sequence = state['acceptedProgressSequence'] + 1
            path = config.run_dir / 'progress' / f'{sequence:06d}.json'
            event = read_small(path, absent=True) if sequence <= MAX_PROGRESS else None
            if event is not None:
                validate_progress(event, config.request_id, sequence)
                apply_progress(config, state, event)
                state['heartbeatAt'] = now().isoformat()
                durable_json(journal, state)
                heartbeat_due = time.monotonic() + 0.5
            if time.monotonic() >= heartbeat_due:
                state['heartbeatAt'] = now().isoformat()
                durable_json(journal, state)
                heartbeat_due = time.monotonic() + 0.5
            time.sleep(min(0.05, max(0, deadline - time.monotonic())))
    except BaseException as error:
        state['state'] = 'interrupted' if stop['signal'] else 'failed'
        state['reason'] = str(error) if isinstance(error, GuardError) else 'journal_or_system_error'
        state['exceptionClass'] = type(error).__name__
        if isinstance(error, OSError): state['errno'] = error.errno
        code = 128 + stop['signal'] if stop['signal'] else 1
    finally:
        # Unlock precedes journal writes, so a broken journal cannot strand the mutex.
        if descriptor is not None:
            try:
                if locked:
                    fcntl.flock(descriptor, fcntl.LOCK_UN)
                    state.update(lockReleased=True, lockReleasedAt=now().isoformat())
            except OSError as error:
                state['unlockErrno'] = error.errno; code = 1
            finally:
                os.close(descriptor)
        if stop['signal']: state['receivedSignal'] = signal.Signals(stop['signal']).name
        state.update(finishedAt=now().isoformat(), durationSeconds=round(time.monotonic()-started,6), exitCode=code,
                     providerCancellationClaimed=False,
                     followUpRequired=bool(state.get('providerUnresolved')))
        if run_owned and config.run_dir.is_dir():
            for path, exclusive in ((journal, False), (terminal, True)):
                try: durable_json(path, state, exclusive=exclusive)
                except (OSError, GuardError): pass
        for number, handler in handlers.items(): signal.signal(number, handler)
    print(json.dumps({'requestId':config.request_id,'state':state['state'],'exitCode':code,
                      'lockAcquired':state['lockAcquired'],'lockReleased':state['lockReleased'],
                      'providerUnresolved':state['providerUnresolved']}),flush=True)
    return code


def inspect_run(run_dir, request_id):
    value = read_small(run_dir / 'guard.json')
    if value.get('schema') != SCHEMA or value.get('requestId') != request_id: raise GuardError('guard_identity_mismatch')
    if value.get('state') != 'held' or not value.get('lockAcquired') or value.get('lockReleased'):
        raise GuardError('guard_not_held')
    if now() >= datetime.fromisoformat(value['deadlineAt']): raise GuardError('guard_deadline_passed')
    if (now()-datetime.fromisoformat(value['heartbeatAt'])).total_seconds() > 2: raise GuardError('guard_heartbeat_stale')
    os.kill(value['pid'], 0)  # Only the explicitly recorded owned guard PID; no /proc traversal.
    return value


def send_progress(run_dir, request_id, event):
    state = inspect_run(run_dir, request_id)
    sequence = state['acceptedProgressSequence'] + 1
    event = dict(event, schema='logos-engine.publication-progress.v1', requestId=request_id, sequence=sequence)
    validate_progress(event, request_id, sequence)
    path = run_dir / 'progress' / f'{sequence:06d}.json'
    durable_json(path, event, exclusive=True)
    deadline = time.monotonic()+3
    while time.monotonic() < deadline:
        current = inspect_run(run_dir, request_id)
        if current['acceptedProgressSequence'] == sequence:
            if current.get('operation',{}).get('operationId') != event['operationId']: raise GuardError('ack_operation_mismatch')
            return {'acceptedProgressSequence':sequence,'operationId':event['operationId'],
                    'deadlineAt':current['deadlineAt'],'providerUnresolved':current['providerUnresolved']}
        time.sleep(0.02)
    raise GuardError('progress_ack_timeout_do_not_call_provider')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('hold','inspect','progress','release'))
    parser.add_argument('--run-dir',type=Path,required=True)
    parser.add_argument('--request-id',required=True)
    parser.add_argument('--reconcile-only',action='store_true')
    parser.add_argument('--event',choices=('begin','update'))
    parser.add_argument('--operation-id')
    parser.add_argument('--operation',choices=sorted(KINDS))
    parser.add_argument('--status',choices=sorted(PENDING|TERMINAL))
    parser.add_argument('--commit-sha'); parser.add_argument('--archive-sha256')
    parser.add_argument('--version-id'); parser.add_argument('--deployment-id')
    parser.add_argument('--evidence-path'); parser.add_argument('--evidence-sha256')
    parser.add_argument('--reason',choices=('completed','abort'))
    args = parser.parse_args()
    run_dir = args.run_dir.resolve()
    if not run_dir.is_relative_to(COORD) or run_dir == COORD or not identifier(args.request_id):
        parser.error('Use a fresh run directory under the coordination directory and a bounded request ID.')
    if args.action == 'hold':
        return hold(Config(run_dir=run_dir, request_id=args.request_id, reconcile_only=args.reconcile_only))
    try:
        if args.action == 'inspect': result=inspect_run(run_dir,args.request_id)
        elif args.action == 'release':
            inspect_run(run_dir,args.request_id)
            if not args.reason: raise GuardError('release_reason_required')
            durable_json(run_dir/'release.json',{'schema':'logos-engine.publication-release.v1',
                         'requestId':args.request_id,'reason':args.reason},exclusive=True)
            result={'releaseRequested':True,'terminalToolResultStillRequired':True}
        else:
            mapping={'event':'event','operation_id':'operationId','operation':'operation','status':'status',
                     'commit_sha':'commitSha','archive_sha256':'archiveSha256','version_id':'versionId',
                     'deployment_id':'deploymentId','evidence_path':'evidencePath','evidence_sha256':'evidenceSha256'}
            event={target:getattr(args,key) for key,target in mapping.items() if getattr(args,key) is not None}
            result=send_progress(run_dir,args.request_id,event)
        print(json.dumps(result),flush=True);return 0
    except BaseException as error:
        reason=str(error) if isinstance(error,GuardError) else 'metadata_or_system_error'
        print(json.dumps({'status':'refused','reason':reason,'providerCallAuthorized':False}),flush=True);return 1


if __name__ == '__main__':
    raise SystemExit(main())
