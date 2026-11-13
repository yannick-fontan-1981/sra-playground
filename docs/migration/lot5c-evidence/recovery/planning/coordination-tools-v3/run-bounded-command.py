#!/usr/bin/env python3
"""Bounded, hidden-input transport without a performance mutex.

Invoke directly without an outer flock. Ordinary source work takes no mutex.
Actual official performance activity is respected through explicit owner metadata.
Publication is serialized separately by its dedicated guardian.
"""
from __future__ import annotations

import argparse
import ctypes
import errno
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import signal
import subprocess
import sys
import tempfile
import termios
import time
from dataclasses import dataclass
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
CHECKOUT = HERE.parents[5]
HELPER_DIRECTORY = HERE.parent / 'coordination-tools-v2'
COORDINATION = Path('/workspace/shared/sra-coordination')
LANES = ('lot5c', 'lot6b', 'lot8a', 'lot10c')
HELPERS = {'checkpoint': {'file': 'push_lot5_checkpoint.mjs', 'bytes': 4953, 'sha256': 'd2d610d16dc972c6f7263650caf89a06c10a441bc12d2405eb591a7e7f8d39c2'}, 'bounded-checkpoints': {'file': 'push_lot5_checkpoints_bounded.mjs', 'bytes': 7201, 'sha256': '84e8727e4b86a1a5e3d66bc843c4f3718a3d716c498fd232a810aab627665e04'}}
PROJECT_ID = 'appgprj_6adbc388d79081918581b93b919d7258'
OFFICIAL_SCRIPTS = Path('/home/agent/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/scripts')
OFFICIAL_PINS = {'site-workflow.mjs': '21a6404d0e3f5beeff4b95ca0f3bfc77cf2744806f4674a6893fd2a38dfef834', 'workflow-metrics.mjs': '33ddaf60a96ab73c9c9673b5acf7015b2e84025454544d5869554b2b3e94ee17', 'archive-path.mjs': '694d9c451b4fe748ccb12f7d6874b5a4c4dd31930753f4cc628c11c0e8726c42', 'build-site.mjs': '051765bcef22b331b394ff71ea464c9f8bebaafce877855fad6cbee31c56cb1b', 'package-site.mjs': '1c3d64f670771cb9ebb97a11058e88a62b34d79eca2e9fc557d637a3c844941a', 'package-manager.mjs': '7002c22cd4274e820e86f378fbe7411ca843f40f650a71a5bc268c59e7f3d86d'}
READY = b'Ready for checkpoint JSON on stdin (input is hidden).\n'
SITE_READY = b'Ready for Site workflow JSON on stdin (input is hidden).\n'
MAX_INPUT = 65536
MAX_OUTPUT = 1048576
SCHEMA = 'logos-engine.lot5c.bounded-command.v3'


@dataclass(frozen=True)
class Settings:
    # The public CLI constructs this only for the two pinned Node helpers.
    # Independent tests use this internal API with temporary stand-ins.
    program: tuple[str, ...]
    helper_name: str
    helper_path: Path
    helper_sha256: str
    cwd: Path
    status_paths: tuple[Path, ...]
    receipt_path: Path
    input_timeout: float = 45.0
    handshake_timeout: float = 10.0
    work_timeout: float = 300.0
    term_grace: float = 1.0
    kill_grace: float = 3.0
    ready_marker: bytes = READY
    result_kind: str = 'checkpoint'
    dependencies: tuple[tuple[Path, str], ...] = ()


class Stopped(Exception):
    def __init__(self, code, exit_code=1):
        self.code = code
        self.exit_code = exit_code
        super().__init__(code)


def stamp():
    return datetime.now(timezone.utc).isoformat()


def strict_json(raw):
    def pairs(rows):
        result = {}
        for key, value in rows:
            if key in result:
                raise ValueError('duplicate-key')
            result[key] = value
        return result
    def invalid_constant(_):
        raise ValueError('non-finite')
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=invalid_constant)


def write_receipt(path, payload, *, initial=False):
    data = (json.dumps(payload, indent=2, sort_keys=True) + '\n').encode()
    if initial:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_CLOEXEC, 0o600)
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        return
    fd, temporary = tempfile.mkstemp(prefix=path.name + '.update-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass


def official_performance_active(value):
    # Explicit owner state has priority over historical compatibility fields.
    active = value.get('official_performance_active')
    if active is not None:
        if type(active) is not bool:
            raise Stopped('official_performance_active_value_invalid')
        return active
    started = value.get('performance_started')
    released = value.get('quiet_released')
    if started is not None and type(started) is not bool:
        raise Stopped('performance_started_value_invalid')
    if released is not None and type(released) is not bool:
        raise Stopped('quiet_released_value_invalid')
    return started is True and released is not True


def coordination_clear(paths):
    snapshots = []
    if len(paths) != 4:
        raise Stopped('coordination_path_count_invalid')
    for lane, path in zip(LANES, paths, strict=True):
        with path.open('rb') as stream:
            raw = stream.read(131073)
        if len(raw) > 131072:
            raise Stopped('coordination_status_too_large')
        try:
            value = strict_json(raw)
        except (ValueError, UnicodeError):
            raise Stopped('coordination_status_invalid') from None
        if not isinstance(value, dict):
            raise Stopped('coordination_status_invalid')
        active = official_performance_active(value)
        if active:
            raise Stopped('official_performance_window_active', 75)
        snapshots.append({'lane': lane, 'officialPerformanceActive': active,
                          'signal': 'explicit_owner_flag' if value.get('official_performance_active') is not None else 'legacy_started_without_release',
                          'prospectiveQuietRequested': value.get('quiet_requested') is True,
                          'statusSha256': hashlib.sha256(raw).hexdigest()})
    return snapshots


def read_hidden_input(timeout, stopped, receipt):
    fd = sys.stdin.fileno()
    if not os.isatty(fd):
        raise Stopped('interactive_tty_required')
    old_attrs = termios.tcgetattr(fd)
    hidden = list(old_attrs); hidden[6] = list(old_attrs[6])
    hidden[3] &= ~(termios.ECHO | termios.ECHONL | termios.ICANON)
    hidden[6][termios.VMIN] = 0; hidden[6][termios.VTIME] = 0
    old_blocking = os.get_blocking(fd)
    buffer = bytearray(); complete = False
    deadline = time.monotonic() + timeout
    try:
        termios.tcsetattr(fd, termios.TCSANOW, hidden)
        os.set_blocking(fd, False)
        receipt['inputEchoDisabled'] = True
        sys.stdout.write('Ready for bounded checkpoint JSON on stdin (hidden input).\n')
        sys.stdout.flush()
        with selectors.DefaultSelector() as selected:
            selected.register(fd, selectors.EVENT_READ)
            while True:
                if stopped['signal']:
                    raise Stopped('interrupted', 128 + stopped['signal'])
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise Stopped('input_timeout', 124)
                for _, _ in selected.select(min(0.1, remaining)):
                    chunk = os.read(fd, min(4096, MAX_INPUT + 1 - len(buffer)))
                    if not chunk:
                        raise Stopped('input_closed')
                    buffer.extend(chunk)
                    receipt['inputBytesRead'] = len(buffer)
                    if len(buffer) > MAX_INPUT:
                        raise Stopped('input_too_large')
                    if b'\x03' in buffer or b'\x04' in buffer:
                        raise Stopped('input_cancelled')
                    if b'\n' in buffer:
                        before, after = bytes(buffer).split(b'\n', 1)
                        if after.strip():
                            raise Stopped('multiple_input_records')
                        try:
                            value = strict_json(before)
                        except (ValueError, UnicodeError):
                            raise Stopped('input_json_invalid') from None
                        if not isinstance(value, dict):
                            raise Stopped('input_json_object_required')
                        value = None
                        complete = True
                        return buffer
    finally:
        if not complete:
            buffer[:] = b'\0' * len(buffer)
        try:
            termios.tcsetattr(fd, termios.TCSANOW, old_attrs)
        except (OSError, termios.error):
            receipt['inputTerminalRestoreFailed'] = True
        try:
            os.set_blocking(fd, old_blocking)
        except OSError:
            pass


def set_subreaper(enabled):
    # Linux subreaping lets us wait for orphaned grandchildren after a leader exits.
    libc = ctypes.CDLL(None, use_errno=True)
    old = ctypes.c_int()
    if libc.prctl(37, ctypes.byref(old), 0, 0, 0) != 0:
        raise Stopped('subreaper_unavailable')
    if libc.prctl(36, int(enabled), 0, 0, 0) != 0:
        raise Stopped('subreaper_unavailable')
    return bool(old.value)


def group_exists(group):
    try:
        os.killpg(group, 0)
        return True
    except ProcessLookupError:
        return False


def teardown(process, term_grace, kill_grace):
    if process is None:
        return {'complete': True, 'childStarted': False, 'signals': [], 'reapedDescendants': 0}
    group = process.pid
    result = {'complete': False, 'childStarted': True, 'processGroup': group,
              'signals': [], 'reapedDescendants': 0}
    def reap():
        process.poll()
        if process.returncode is not None:
            while True:
                try:
                    child, _ = os.waitpid(-group, os.WNOHANG)
                except ChildProcessError:
                    break
                if child == 0:
                    break
                result['reapedDescendants'] += 1
    for sig, grace in ((signal.SIGTERM, term_grace), (signal.SIGKILL, kill_grace)):
        reap()
        if not group_exists(group):
            break
        try:
            os.killpg(group, sig)
            result['signals'].append(signal.Signals(sig).name)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + grace
        while time.monotonic() < deadline:
            reap()
            if not group_exists(group):
                break
            time.sleep(0.02)
    reap()
    result['complete'] = process.returncode is not None and not group_exists(group)
    result['leaderExitCode'] = process.returncode
    return result


def safe_result_rows(raw, result_kind='checkpoint', expected_site=None):
    # Do not save arbitrary child output, exceptions, argv or credential text.
    # Only the existing helpers' small, structurally verified result fields survive.
    rows = []
    allowed_status = {'fetched_and_verified', 'bounded_checkpoint_pushed_and_verified', 'pushed_and_verified'}
    hashes = ('commit', 'remoteHead', 'fetchedMain', 'previousRemote', 'sourceCheckoutHead')
    for line in raw.splitlines():
        try:
            value = strict_json(line)
        except (ValueError, UnicodeError):
            continue
        if not isinstance(value, dict):
            continue
        if result_kind == 'sites-workflow':
            if (expected_site and value.get('project_id') == PROJECT_ID
                    and value.get('checkout_path') == expected_site['checkout_path']
                    and value.get('archive') == expected_site.get('archive')
                    and isinstance(value.get('commit_sha'), str)
                    and re.fullmatch(r'[a-f0-9]{40}', value['commit_sha'])):
                rows.append({'status': 'source_and_archive_prepared', 'projectId': PROJECT_ID,
                             'commit': value['commit_sha'],
                             'archiveDeclared': 'archive' in expected_site,
                             'sitePublicationPerformed': False})
            continue
        if not isinstance(value.get('status'), str) or value['status'] not in allowed_status:
            continue
        if value.get('sitePublicationPerformed') is not False:
            continue
        row = {'status': value['status'], 'sitePublicationPerformed': False}
        valid = True
        for key in hashes:
            if key in value:
                field = value[key]
                if not isinstance(field, str) or not re.fullmatch(r'[a-f0-9]{40}', field):
                    valid = False; break
                row[key] = field
        for key in ('rawNewObjectBytes', 'objects'):
            if key in value:
                field = value[key]
                if type(field) is not int or not 0 <= field <= 10**12:
                    valid = False; break
                row[key] = field
        if value.get('branch') == 'refs/heads/lot5c-recovery-checkpoint-20261111':
            row['branch'] = value['branch']
        if value.get('sourceMerged') is False:
            row['sourceMerged'] = False
        if valid:
            rows.append(row)
    return rows[-21:]


def run(settings, *, _after_input=None):
    """Internal API; test hooks cannot be selected through the production CLI."""
    started = time.monotonic()
    receipt = {'schema': SCHEMA, 'status': 'starting', 'startedAt': stamp(),
               'wrapperPid': os.getpid(), 'toolSessionId': None,
               'toolSessionBinding': 'external_root_record_required',
               'helper': settings.helper_name,
               'limits': {'inputSeconds': settings.input_timeout,
                          'handshakeSeconds': settings.handshake_timeout,
                          'workSeconds': settings.work_timeout, 'inputBytes': MAX_INPUT,
                          'outputBytes': MAX_OUTPUT, 'termGraceSeconds': settings.term_grace,
                          'killGraceSeconds': settings.kill_grace},
               'inputBytesRead': 0, 'lockAcquired': False, 'childStarted': False,
               'performanceMutexAccessed': False, 'publicationMutexManagedHere': False,
               'rawInputStored': False, 'rawChildOutputStored': False,
               'automaticRetry': False, 'sitePublicationPerformed': False}
    stopped = {'signal': 0}
    old_signals = {}
    process = None
    payload = None; master = None; slave = None; selector = None
    output = bytearray(); errors = bytearray()
    previous_subreaper = None
    expected_site = None
    receipt_created = False; exit_code = 1
    def signal_requested(number, _frame):
        # A flag avoids throwing between Popen creating a child and its assignment.
        if not stopped['signal']:
            stopped['signal'] = number
    def checkpoint(state):
        receipt['status'] = state
        write_receipt(settings.receipt_path, receipt)
    try:
        if not (0 < settings.input_timeout <= 45 and 0 < settings.handshake_timeout <= 15
                and 0 < settings.work_timeout <= 540 and 0 < settings.term_grace <= 2
                and 0 < settings.kill_grace <= 5):
            raise Stopped('deadline_configuration_invalid')
        if settings.receipt_path.resolve().is_relative_to(settings.cwd.resolve()):
            raise Stopped('live_receipt_must_be_outside_checkout')
        write_receipt(settings.receipt_path, receipt, initial=True)
        receipt_created = True
        for number in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            old_signals[number] = signal.signal(number, signal_requested)
        receipt['initialCoordination'] = coordination_clear(settings.status_paths)
        checkpoint('awaiting_input')
        payload = read_hidden_input(settings.input_timeout, stopped, receipt)
        receipt['inputCompletedAt'] = stamp()
        if _after_input:
            _after_input()
        if stopped['signal']:
            raise Stopped('interrupted', 128 + stopped['signal'])
        receipt['postInputCoordination'] = coordination_clear(settings.status_paths)
        if stopped['signal']:
            raise Stopped('interrupted', 128 + stopped['signal'])
        helper_data = settings.helper_path.read_bytes()
        digest = hashlib.sha256(helper_data).hexdigest()
        if digest != settings.helper_sha256:
            raise Stopped('helper_fingerprint_changed')
        receipt['dependencies'] = []
        for dependency, expected_hash in settings.dependencies:
            raw = dependency.read_bytes()
            actual_hash = hashlib.sha256(raw).hexdigest()
            if actual_hash != expected_hash:
                raise Stopped('helper_dependency_changed')
            receipt['dependencies'].append({'file': dependency.name, 'bytes': len(raw),
                                             'sha256': actual_hash})
        if settings.result_kind == 'sites-workflow':
            request = strict_json(payload)
            source = request.get('source')
            if (not isinstance(source, dict) or source.get('project_id') != PROJECT_ID
                    or not isinstance(source.get('checkout_path'), str)
                    or Path(source['checkout_path']).resolve() != settings.cwd.resolve()):
                raise Stopped('site_source_identity_invalid')
            expected_site = {'checkout_path': str(settings.cwd.resolve())}
            archive = request.get('archivePath')
            if archive is not None:
                if (not isinstance(archive, str) or not Path(archive).is_absolute()
                        or Path(archive).resolve().is_relative_to(settings.cwd.resolve())):
                    raise Stopped('site_archive_destination_invalid')
                expected_site['archive'] = archive
            commands = request.get('commands', [])
            if (not isinstance(commands, list) or len(commands) > 20
                    or not all(isinstance(row, list) and 0 < len(row) <= 64
                               and all(isinstance(arg, str) and len(arg) <= 4096 for arg in row)
                               for row in commands)):
                raise Stopped('site_preparation_commands_invalid')
            request = None
        receipt['helperFingerprint'] = {'file': settings.helper_path.name,
                                        'bytes': len(helper_data), 'sha256': digest}
        previous_subreaper = set_subreaper(True)
        master, slave = os.openpty()
        attrs = termios.tcgetattr(slave)
        attrs[3] &= ~(termios.ECHO | termios.ECHONL | termios.ICANON)
        attrs[6][termios.VMIN] = 1
        attrs[6][termios.VTIME] = 0
        termios.tcsetattr(slave, termios.TCSANOW, attrs)
        os.set_inheritable(master, False); os.set_inheritable(slave, False)
        os.set_blocking(master, False)
        environment = os.environ.copy()
        for key in list(environment):
            if key.startswith('GIT_TRACE') or key in ('GIT_CURL_VERBOSE', 'GIT_CONFIG_PARAMETERS') or key.startswith('GIT_CONFIG_KEY_') or key.startswith('GIT_CONFIG_VALUE_'):
                del environment[key]
        # The first legacy helper lacks the bounded helper's command-line hook guard.
        environment.update(GIT_TERMINAL_PROMPT='0', GIT_CONFIG_COUNT='1',
                           GIT_CONFIG_KEY_0='core.hooksPath', GIT_CONFIG_VALUE_0='/dev/null')
        receipt['preLaunchCoordination'] = coordination_clear(settings.status_paths)
        child_started = time.monotonic()
        process = subprocess.Popen(settings.program, cwd=settings.cwd, env=environment,
                                   stdin=slave, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   start_new_session=True, close_fds=True)
        os.close(slave); slave = None
        receipt.update(childStarted=True, childPid=process.pid, childProcessGroup=process.pid,
                       childStartedAt=stamp(), childCloseFds=True, childPtyEchoDisabled=True)
        checkpoint('running')
        selector = selectors.DefaultSelector()
        for stream, tag in ((process.stdout, 'stdout'), (process.stderr, 'stderr')):
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ, tag)
        handshake = False; sent = 0
        work_deadline = child_started + settings.work_timeout
        handshake_deadline = min(work_deadline, child_started + settings.handshake_timeout)
        coordination_due = time.monotonic() + 0.5
        while True:
            if stopped['signal']:
                raise Stopped('interrupted', 128 + stopped['signal'])
            now = time.monotonic()
            if now >= work_deadline:
                raise Stopped('work_timeout', 124)
            if not handshake and now >= handshake_deadline:
                raise Stopped('handshake_timeout', 124)
            if now >= coordination_due:
                coordination_clear(settings.status_paths)
                coordination_due = now + 0.5
            wait = min(0.05, max(0, work_deadline - now))
            for key, _ in selector.select(wait):
                if key.data == 'input':
                    try:
                        count = os.write(master, memoryview(payload)[sent:])
                    except BlockingIOError:
                        continue
                    sent += count
                    if sent == len(payload):
                        selector.unregister(master)
                        receipt['childInputDeliveredAt'] = stamp()
                        payload[:] = b'\0' * len(payload)
                    continue
                try:
                    chunk = os.read(key.fileobj.fileno(), 65536)
                except BlockingIOError:
                    continue
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                destination = output if key.data == 'stdout' else errors
                destination.extend(chunk)
                if len(output) + len(errors) > MAX_OUTPUT:
                    raise Stopped('child_output_limit')
                if not handshake and settings.ready_marker in errors:
                    handshake = True
                    receipt['childHandshakeAt'] = stamp()
                    selector.register(master, selectors.EVENT_WRITE, 'input')
            returncode = process.poll()
            if returncode is not None:
                # Drain available terminal pipe bytes without waiting for descendants.
                for stream, destination in ((process.stdout, output), (process.stderr, errors)):
                    while len(output) + len(errors) <= MAX_OUTPUT:
                        try:
                            chunk = os.read(stream.fileno(), 65536)
                        except BlockingIOError:
                            break
                        if not chunk:
                            break
                        destination.extend(chunk)
                if len(output) + len(errors) > MAX_OUTPUT:
                    raise Stopped('child_output_limit')
                receipt['childExitCode'] = returncode
                if returncode != 0:
                    raise Stopped('child_exit_nonzero')
                if not handshake or sent != len(payload):
                    raise Stopped('child_incomplete_handshake')
                rows = safe_result_rows(output, settings.result_kind, expected_site)
                if not rows or rows[-1]['status'] not in ('fetched_and_verified', 'pushed_and_verified', 'source_and_archive_prepared'):
                    raise Stopped('child_success_receipt_missing')
                receipt['status'] = 'passed'
                exit_code = 0
                break
    except Stopped as error:
        receipt['status'] = 'interrupted' if error.code == 'interrupted' else 'failed'
        receipt['reason'] = error.code
        exit_code = error.exit_code
    except BaseException as error:
        receipt['status'] = 'failed'; receipt['reason'] = 'internal_error'
        receipt['exceptionClass'] = type(error).__name__
        if isinstance(error, OSError):
            receipt['errno'] = error.errno
        exit_code = 1
    finally:
        try:
            cleanup = teardown(process, settings.term_grace, settings.kill_grace)
            receipt['cleanup'] = cleanup
            if process is not None:
                receipt['childExitCode'] = process.returncode
            if not cleanup['complete']:
                receipt['status'] = 'failed'; receipt['reason'] = 'group_cleanup_incomplete'
                exit_code = 1
        except BaseException as error:
            receipt['cleanup'] = {'complete': False, 'exceptionClass': type(error).__name__}
            receipt['status'] = 'failed'; receipt['reason'] = 'group_cleanup_error'; exit_code = 1
        if selector is not None:
            selector.close()
        for fd in (master, slave):
            if fd is not None:
                try:
                    os.close(fd)
                except OSError:
                    pass
        if process is not None:
            for stream in (process.stdout, process.stderr):
                if stream:
                    stream.close()
        if previous_subreaper is not None:
            try:
                set_subreaper(previous_subreaper)
            except Stopped:
                receipt['subreaperRestoreFailed'] = True
        if payload is not None:
            payload[:] = b'\0' * len(payload)
        receipt['childOutputBytes'] = {'stdout': len(output), 'stderr': len(errors)}
        receipt['results'] = safe_result_rows(output, settings.result_kind, expected_site)
        output[:] = b'\0' * len(output); errors[:] = b'\0' * len(errors)
        if stopped['signal']:
            receipt['receivedSignal'] = signal.Signals(stopped['signal']).name
            if receipt['status'] == 'passed':
                receipt['status'] = 'interrupted'; receipt['reason'] = 'interrupted'
                exit_code = 128 + stopped['signal']
        receipt['partialOperationalSideEffectsPossible'] = bool(receipt['childStarted'] and receipt['status'] != 'passed')
        receipt.update(finishedAt=stamp(), durationSeconds=round(time.monotonic() - started, 6),
                       exitCode=exit_code)
        if receipt_created:
            try:
                write_receipt(settings.receipt_path, receipt)
            except OSError:
                sys.stderr.write('Bounded command terminal receipt could not be written.\n')
                exit_code = 1
        for number, handler in old_signals.items():
            signal.signal(number, handler)
    sys.stdout.write(json.dumps({'schema': SCHEMA, 'status': receipt['status'],
                                 'reason': receipt.get('reason'), 'exitCode': exit_code,
                                 'cleanupComplete': receipt.get('cleanup', {}).get('complete')}) + '\n')
    sys.stdout.flush()
    return exit_code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--helper', choices=sorted((*HELPERS, 'sites-workflow')), required=True)
    parser.add_argument('--checkout', type=Path, default=CHECKOUT)
    parser.add_argument('--receipt', type=Path, required=True,
                        help='Fresh metadata receipt outside the checkout; parent directory must exist.')
    parser.add_argument('--input-timeout', type=float, default=45.0)
    parser.add_argument('--handshake-timeout', type=float, default=10.0)
    parser.add_argument('--work-timeout', type=float, default=300.0)
    args = parser.parse_args()
    if args.helper == 'sites-workflow':
        helper = OFFICIAL_SCRIPTS / 'site-workflow.mjs'
        program = ('node', str(helper), '--project-id', PROJECT_ID)
        digest = OFFICIAL_PINS['site-workflow.mjs']
        dependencies = tuple((OFFICIAL_SCRIPTS / name, value) for name, value in OFFICIAL_PINS.items() if name != 'site-workflow.mjs')
        ready_marker = SITE_READY
    else:
        chosen = HELPERS[args.helper]
        helper = HELPER_DIRECTORY / chosen['file']
        program = ('node', str(helper))
        digest = chosen['sha256']
        dependencies = ()
        ready_marker = READY
    return run(Settings(program=program, helper_name=args.helper,
                        helper_path=helper, helper_sha256=digest,
                        cwd=args.checkout.resolve(),
                        status_paths=tuple(COORDINATION / (lane + '-status.json') for lane in LANES),
                        receipt_path=args.receipt.resolve(), input_timeout=args.input_timeout,
                        handshake_timeout=args.handshake_timeout, work_timeout=args.work_timeout,
                        ready_marker=ready_marker, result_kind=args.helper if args.helper == 'sites-workflow' else 'checkpoint',
                        dependencies=dependencies))


if __name__ == '__main__':
    raise SystemExit(main())
