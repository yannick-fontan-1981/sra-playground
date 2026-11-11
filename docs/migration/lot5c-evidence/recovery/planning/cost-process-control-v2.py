#!/usr/bin/env python3
"""Bounded owned-process lifecycle. No native, benchmark or lock policy lives here.

The only signal targets are process groups created by this helper, registered
before an explicit pipe gate lets their command execute. The registry is an
immediate parent/watchdog cleanup aid, never a process-discovery mechanism.
"""
from __future__ import annotations
import argparse
import ctypes
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

CATCHABLE = (signal.SIGINT, signal.SIGTERM, signal.SIGHUP, signal.SIGALRM)

def stamp():
    return datetime.now(timezone.utc).isoformat()

def atomic_json(path, value):
    path = Path(path)
    temporary = path.with_name(path.name + '.tmp-' + str(os.getpid()))
    try:
        with temporary.open('x') as stream:
            json.dump(value, stream, indent=2, allow_nan=False)
            stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        try:
            temporary.unlink(missing_ok=True)
        except OSError:
            pass

def enable_subreaper():
    """Adopt our orphan descendants so their termination can be reaped, no /proc."""
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:  # Linux PR_SET_CHILD_SUBREAPER
        raise OSError(ctypes.get_errno(), 'Cannot enable owned-descendant subreaper')

def group_exists(pgid):
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False

def signal_owned_group(pgid, sig):
    if not isinstance(pgid, int) or pgid <= 1 or pgid == os.getpgrp():
        raise ValueError('Refusing an unowned/self process group')
    try:
        os.killpg(pgid, sig)
    except ProcessLookupError:
        pass

def reap_owned_group(child, pgid):
    # Popen keeps ownership of its own leader's wait status.
    if child is not None:
        child.poll()
        if child.returncode is None:
            return
    while True:
        try:
            pid, _ = os.waitpid(-pgid, os.WNOHANG)
        except ChildProcessError:
            return
        if not pid:
            return

def terminate_owned_group(pgid, child=None, grace_seconds=1.0, kill_seconds=2.0):
    """Clean the whole registered group even when its leader has already exited."""
    previous = {sig: signal.signal(sig, signal.SIG_IGN) for sig in CATCHABLE}
    try:
        signal_owned_group(pgid, signal.SIGTERM)
        deadline = time.monotonic() + grace_seconds
        while time.monotonic() < deadline:
            reap_owned_group(child, pgid)
            if not group_exists(pgid):
                return {'pgid': pgid, 'terminal': True, 'escalatedToKill': False}
            time.sleep(0.025)
        signal_owned_group(pgid, signal.SIGKILL)
        deadline = time.monotonic() + kill_seconds
        while time.monotonic() < deadline:
            reap_owned_group(child, pgid)
            if not group_exists(pgid):
                return {'pgid': pgid, 'terminal': True, 'escalatedToKill': True}
            time.sleep(0.025)
        reap_owned_group(child, pgid)
        if group_exists(pgid):
            raise RuntimeError('Owned process group did not reach terminal cleanup: ' + str(pgid))
        return {'pgid': pgid, 'terminal': True, 'escalatedToKill': True}
    finally:
        for sig, handler in previous.items():
            signal.signal(sig, handler)

class Registry:
    def __init__(self, path, request_id):
        self.path, self.request_id = Path(path), request_id
        self.groups = {}
        self.owner_pid = os.getpid()
        if self.path.exists():
            raise FileExistsError('Refusing existing lifecycle registry: ' + str(self.path))
        self.save()

    def save(self):
        atomic_json(self.path, {'schema': 'logos-engine.owned-process-groups.v2',
            'requestId': self.request_id, 'controllerPid': self.owner_pid,
            'updatedAt': stamp(), 'activeGroups': list(self.groups.values()),
            'qualification': 'Only groups created here, registered before pipe-gated execution; no process scan or arbitrary PID adoption.'})

    def add(self, child):
        self.groups[child.pid] = {'pid': child.pid, 'pgid': child.pid,
            'createdAt': stamp(), 'commandGateNotReleasedAtRegistration': True}
        self.save()

    def remove(self, child):
        self.groups.pop(child.pid, None)
        self.save()

def cleanup_registered(path, request_id, controller_pid, grace_seconds=1.0):
    """For the immediate owning watchdog only, after its known controller dies.

The caller must have created/waited for that exact controller. This is not an
API for investigating locks or signaling a registry found in another session.
"""
    path = Path(path)
    if not path.exists():
        return []
    raw = path.read_bytes()
    if len(raw) > 32768:
        raise ValueError('Lifecycle registry is not bounded')
    data = json.loads(raw)
    if (data.get('schema') != 'logos-engine.owned-process-groups.v2'
            or data.get('requestId') != request_id or data.get('controllerPid') != controller_pid):
        raise ValueError('Lifecycle registry does not belong to the known controller')
    result = []
    for row in data['activeGroups']:
        if (row['pid'] != row['pgid'] or row['commandGateNotReleasedAtRegistration'] is not True):
            raise ValueError('Malformed owned process-group entry')
        result.append(terminate_owned_group(row['pgid'], grace_seconds=grace_seconds))
    data.update(activeGroups=[], terminalCleanup=result, updatedAt=stamp())
    atomic_json(path, data)
    return result

def run_owned(command, *, cwd, stdout, timeout_seconds, deadline_monotonic=None,
              registry=None, check=None, poll_seconds=0.1):
    """Run exactly argv after registering a new isolated process group.

No inherited lock descriptors: close_fds=True and pass_fds contains only the
one-use command gate. Returns actual leader exit plus whole-group cleanup.
The optional check is source-free coordination/deadline monitoring.
"""
    enable_subreaper()
    if not command or not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
        raise ValueError('Explicit argv and positive finite timeout required')
    gate_read, gate_write = os.pipe2(os.O_CLOEXEC)
    child = None
    start = time.monotonic()
    cleanup = None
    try:
        child = subprocess.Popen([sys.executable, '-B', str(Path(__file__).resolve()),
            '--gate-fd', str(gate_read), '--', *command], cwd=cwd, stdout=stdout,
            stderr=subprocess.STDOUT, start_new_session=True, close_fds=True,
            pass_fds=(gate_read,))
        os.close(gate_read); gate_read = None
        if registry is not None:
            registry.add(child)
        if check is not None:
            check()
        os.write(gate_write, b'G')
        os.close(gate_write); gate_write = None
        deadline = min(start + timeout_seconds,
                       deadline_monotonic if deadline_monotonic is not None else float('inf'))
        while child.poll() is None:
            if time.monotonic() >= deadline:
                raise TimeoutError('Owned command exceeded its declared deadline')
            if check is not None:
                check()
            time.sleep(poll_seconds)
        result = {'exitCode': child.returncode, 'pid': child.pid, 'pgid': child.pid,
                  'elapsedSeconds': time.monotonic() - start}
    finally:
        for fd in (gate_read, gate_write):
            if fd is not None:
                os.close(fd)
        if child is not None:
            cleanup = terminate_owned_group(child.pid, child)
            if registry is not None:
                registry.remove(child)
    result['cleanup'] = cleanup
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gate-fd', type=int, required=True)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('Explicit command required')
    try:
        permitted = os.read(args.gate_fd, 1) == b'G'
    finally:
        os.close(args.gate_fd)
    if not permitted:
        return 125
    os.execvp(command[0], command)

if __name__ == '__main__':
    raise SystemExit(main())
