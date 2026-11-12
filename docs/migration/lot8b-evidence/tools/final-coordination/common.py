"""Bounded, prospective Lot 8B coordination primitives; import acquires no lock."""
from __future__ import annotations

import ctypes
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import stat
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[5]
EVIDENCE = ROOT / 'docs/migration/lot8b-evidence'
COORDINATION = Path('/workspace/shared/sra-coordination')
OWN_STATUS = COORDINATION / 'lot8a-status.json'
HEX = re.compile(r'^[0-9a-f]{64}$')
COMMIT = re.compile(r'^[0-9a-f]{40}$')
VERSION = re.compile(r'^\d+\.\d+\.\d+$')
STOP_SIGNAL = None


def utc():
    return datetime.now(timezone.utc).isoformat()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def interrupted(signum, _frame):
    global STOP_SIGNAL
    STOP_SIGNAL = signum


def signals():
    for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(signum, interrupted)


def check_time(deadline, honor_signal=True):
    if honor_signal and STOP_SIGNAL is not None:
        raise InterruptedError('signal_' + str(STOP_SIGNAL))
    if deadline is not None and time.monotonic() >= deadline:
        raise TimeoutError('Declared operation deadline reached')


def canonical(path, root=None, must_exist=True):
    path = Path(path)
    require(path.is_absolute(), 'Absolute canonical path required')
    require('..' not in path.parts, 'Parent traversal is forbidden')
    if root is not None:
        path.relative_to(root)
    for ancestor in [path, *path.parents]:
        require(not ancestor.is_symlink(), 'Symlink path forbidden: ' + str(ancestor))
    require(path.resolve(strict=must_exist) == path, 'Noncanonical path: ' + str(path))
    return path


def local(value, evidence=False, must_exist=True):
    require(isinstance(value, str) and value and not Path(value).is_absolute(),
            'Repository-relative path required')
    path = canonical(ROOT / value, ROOT, must_exist)
    if evidence:
        path.relative_to(EVIDENCE)
    return path


def baseline_path(value):
    require(isinstance(value, str), 'Baseline path must be a string')
    path = canonical(Path(value), Path('/workspace/sites'))
    first = path.relative_to('/workspace/sites').parts[0]
    require(first.startswith('sra-lot8b-baseline'), 'Only an owned Lot 8B baseline checkout is allowed')
    require(path != ROOT and path.is_dir(), 'Baseline must be a distinct existing checkout')
    return path


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'Duplicate JSON key: ' + key)
        result[key] = value
    return result


def read_json(path):
    def bad_constant(value):
        raise ValueError('Nonfinite JSON value: ' + value)
    return json.loads(Path(path).read_bytes(), object_pairs_hook=unique_object,
                      parse_constant=bad_constant)


def fingerprint(path, deadline=None, honor_signal=True):
    digest = hashlib.sha256()
    size = 0
    canonical(Path(path))
    with Path(path).open('rb') as stream:
        require(stat.S_ISREG(os.fstat(stream.fileno()).st_mode), 'Regular input file required')
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            check_time(deadline, honor_signal)
            size += len(chunk)
            digest.update(chunk)
    check_time(deadline, honor_signal)
    return {'bytes': size, 'sha256': digest.hexdigest()}


def input_path(item, baseline=None):
    require(isinstance(item, dict), 'Input fingerprint object required')
    require(set(item) == {'role', 'path', 'bytes', 'sha256'}, 'Unexpected input fingerprint fields')
    require(type(item['bytes']) is int and item['bytes'] >= 0 and
            isinstance(item['sha256'], str) and HEX.fullmatch(item['sha256']), 'Invalid fingerprint')
    value = item['path']
    require(isinstance(value, str) and value and not Path(value).is_absolute(), 'Relative input path required')
    if item['role'] == 'candidate':
        return local(value)
    require(item['role'] == 'baseline' and baseline is not None, 'Invalid input role')
    return canonical(baseline / value, baseline)


def verify_input(item, baseline=None, deadline=None):
    path = input_path(item, baseline)
    expected = {key: item[key] for key in ('bytes', 'sha256')}
    require(fingerprint(path, deadline) == expected, 'Immutable input differs: ' + str(path))
    return path


def verify_inputs(items, baseline=None, deadline=None):
    require(isinstance(items, list) and items, 'Nonempty immutable input list required')
    seen = set()
    for item in items:
        path = verify_input(item, baseline, deadline)
        require(path not in seen, 'Duplicate immutable input: ' + str(path))
        seen.add(path)
    return seen


def atomic_json(path, value, create=False):
    path = Path(path)
    canonical(path, must_exist=False)
    data = (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + '\n').encode()
    if create:
        with path.open('xb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        return
    temporary = path.with_name(path.name + '.tmp-' + uuid.uuid4().hex)
    try:
        with temporary.open('xb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()  # Only this writer's unique JSON temporary, never a lock.


def emit(value):
    try:
        print(json.dumps(value, ensure_ascii=False), flush=True)
    except (BrokenPipeError, OSError):
        pass


def current_head(checkout, deadline):
    check_time(deadline)
    remaining = max(0.1, min(10, deadline - time.monotonic()))
    result = subprocess.run(['git', 'rev-parse', '--verify', 'HEAD'], cwd=checkout,
                            text=True, capture_output=True, timeout=remaining, check=True)
    value = result.stdout.strip()
    require(COMMIT.fullmatch(value), 'Invalid local commit identity')
    return value


def source_commit(checkout, expected, deadline, exact_head=False):
    """Allow later evidence commits, while requiring exact committed native bytes."""
    require(isinstance(expected, str) and COMMIT.fullmatch(expected), 'Full source commit required')
    head = current_head(checkout, deadline)
    if exact_head:
        require(head == expected, 'Published baseline HEAD differs')
    for command in (['git', 'merge-base', '--is-ancestor', expected, head],
                    ['git', 'diff', '--quiet', expected, '--', 'src/logos-engine', 'src/runtime']):
        check_time(deadline)
        remaining = max(0.1, min(10, deadline - time.monotonic()))
        result = subprocess.run(command, cwd=checkout, capture_output=True, timeout=remaining)
        require(result.returncode == 0, 'Native source commit ancestry or bytes differ')
    result = subprocess.run(['git', 'ls-tree', '-r', '--name-only', expected, '--',
                             'src/logos-engine', 'src/runtime'], cwd=checkout, capture_output=True,
                            text=True, timeout=max(0.1, min(10, deadline - time.monotonic())), check=True)
    names = {name for name in result.stdout.splitlines() if Path(name).suffix in {'.ts', '.json', '.drm'}}
    require(names, 'Committed native source is empty')
    return head, names


def native_version(checkout):
    source = (checkout / 'src/logos-engine/v6-native-runtime.ts').read_text()
    values = re.findall(r"NATIVE_V6_IMPLEMENTATION\s*=\s*['\"]logos-engine\.typescript\.v6\.native-migration/([^'\"]+)['\"]", source)
    require(len(values) == 1 and VERSION.fullmatch(values[0]), 'Cannot identify native version')
    return values[0]


def own_idle_status():
    canonical(OWN_STATUS, COORDINATION)
    data = read_json(OWN_STATUS)
    require(data.get('owner') in {'lot8a', 'lot8b'}, 'Unexpected owner of Lot 8 status')
    for key in ('active_execution_session', 'active_command'):
        require(key in data and data[key] is None, 'Own work has not closed: ' + key)
    require(data.get('active_workers') == [], 'Own active workers must be empty')
    for key in ('performance_started', 'publication_started', 'performance_lock_held', 'publication_lock_held'):
        require(data.get(key) is False, 'Own exclusive work remains active: ' + key)
    for key in ('heavy_execution_active', 'functional_tests_running'):
        require(data.get(key, False) is False, 'Own active work remains: ' + key)
    return data


def update_own_status(kind, lease, active, extra=None):
    require(kind in {'performance', 'publication'}, 'Unsupported own status operation')
    canonical(OWN_STATUS, COORDINATION)
    data = read_json(OWN_STATUS)
    require(data.get('owner') in {'lot8a', 'lot8b'}, 'Unexpected owner of Lot 8 status')
    key = kind + 'Lease'
    if active:
        require(not data.get(kind + '_started') and not data.get(kind + '_lock_held'),
                'Own exclusive state became active')
        opposite = 'publication' if kind == 'performance' else 'performance'
        require(not data.get(opposite + '_started') and not data.get(opposite + '_lock_held'),
                'Other own exclusive operation became active')
    elif data.get(key) != lease:
        return {'updated': False, 'reason': 'own_lease_no_longer_matches'}
    data.update(updated_at=utc(), ordinary_work_requires_global_lock=False, peerAvailabilityWait=False)
    data[kind + '_started'] = active
    data[kind + '_lock_held'] = active
    data[key] = lease if active else None
    data['current_phase'] = 'lot8b_' + kind + ('_active' if active else '_released')
    data['phase'] = data['current_phase']
    if extra:
        data.update(extra)
    atomic_json(OWN_STATUS, data)
    return {'updated': True, 'path': str(OWN_STATUS)}


class ExclusiveLock:
    """One nonblocking acquisition on a stable shared inode; never unlink it."""
    def __init__(self, kind):
        require(kind in {'performance', 'publication'}, 'Unsupported lock kind')
        self.path = COORDINATION / (kind + '.lock')
        self.fd = None
        self.held = False
        self.record = {'path': str(self.path), 'attempts': 0, 'blocking': False,
                       'lockFileRemoved': False, 'lockFileReplaced': False, 'descriptorClosed': False}

    @staticmethod
    def identity(result):
        return {'device': result.st_dev, 'inode': result.st_ino}

    def check_identity(self):
        require(self.fd is not None, 'Lock descriptor unavailable')
        descriptor = os.fstat(self.fd)
        pathname = self.path.lstat()
        require(stat.S_ISREG(descriptor.st_mode) and stat.S_ISREG(pathname.st_mode),
                'Lock must remain a regular file')
        require(self.identity(descriptor) == self.identity(pathname), 'Lock inode identity changed')
        return self.identity(descriptor)

    def acquire(self):
        canonical(COORDINATION)
        canonical(self.path, COORDINATION, must_exist=False)
        self.record['pathExistedBeforeOpen'] = self.path.exists()
        self.fd = os.open(self.path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
        self.record['identity'] = self.check_identity()
        self.record['attempts'] = 1
        try:
            fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.record.update(status='unavailable', refusedAt=utc())
            return False
        self.held = True
        self.record.update(status='held', acquiredAt=utc())
        self.check_identity()
        return True

    def release(self):
        errors = []
        if self.fd is not None:
            try:
                self.record['finalIdentity'] = self.check_identity()
                self.record['sameLockFile'] = self.record.get('identity') == self.record['finalIdentity']
            except BaseException as error:
                self.record['sameLockFile'] = False
                errors.append(type(error).__name__ + ': ' + str(error))
            try:
                if self.held:
                    fcntl.flock(self.fd, fcntl.LOCK_UN)
                    self.record.update(status='released', releasedAt=utc())
            except BaseException as error:
                errors.append(type(error).__name__ + ': ' + str(error))
            finally:
                self.held = False
                try:
                    os.close(self.fd)
                    self.record['descriptorClosed'] = True
                except BaseException as error:
                    errors.append(type(error).__name__ + ': ' + str(error))
                self.fd = None
        else:
            self.record['descriptorClosed'] = True
        if errors:
            self.record['releaseErrors'] = errors
        return self.record


def process_snapshot(checkouts=()):
    """Read command names/resource counts only, never argv or environments."""
    rows = []
    unavailable = 0
    candidates = [p for p in Path('/proc').iterdir() if p.name.isdigit()]
    for path in sorted(candidates, key=lambda p: int(p.name))[:4096]:
        try:
            text = (path / 'stat').read_text()
            tail = text[text.rfind(')') + 2:].split()
            cwd_scope = 'other_visible'
            try:
                cwd = Path(os.readlink(path / 'cwd'))
                for index, checkout in enumerate(checkouts):
                    if cwd == checkout or checkout in cwd.parents:
                        cwd_scope = 'candidate_checkout' if index == 0 else 'baseline_checkout'
                        break
            except OSError:
                cwd_scope = 'unreadable'
            rows.append({'pid': int(path.name), 'commandName': (path / 'comm').read_text().strip(),
                         'state': tail[0], 'parentPid': int(tail[1]), 'processGroup': int(tail[2]),
                         'session': int(tail[3]), 'userTicks': int(tail[11]), 'systemTicks': int(tail[12]),
                         'startTicks': int(tail[19]), 'residentPages': int(tail[21]), 'cwdScope': cwd_scope})
        except (OSError, ValueError, IndexError):
            unavailable += 1
    namespaces = {}
    for name in ('pid', 'mnt', 'user', 'cgroup'):
        try:
            namespaces[name] = os.readlink('/proc/self/ns/' + name)
        except OSError:
            namespaces[name] = None
    result = {'recordedAt': utc(), 'scope': 'current_visible_execution_namespace_only',
              'globalQuietEstablishedByThisObservation': False, 'processes': rows,
              'visibleProcessCount': len(candidates), 'truncated': len(candidates) > 4096,
              'unreadableOrVanished': unavailable, 'namespaces': namespaces,
              'loadAverage': list(os.getloadavg()), 'cpuAffinity': sorted(os.sched_getaffinity(0)),
              'clockTicksPerSecond': os.sysconf('SC_CLK_TCK'), 'pageBytes': os.sysconf('SC_PAGE_SIZE')}
    for name in ('cpu.max', 'memory.max', 'pids.max'):
        path = Path('/sys/fs/cgroup') / name
        try:
            result[name] = path.read_text().strip()
        except OSError:
            result[name] = None
    return result


def require_no_visible_own_work(snapshot):
    require(not snapshot['truncated'], 'Cannot inspect all visible own processes')
    by_pid = {row['pid']: row for row in snapshot['processes']}
    allowed = set()
    pid = os.getpid()
    while pid > 0 and pid not in allowed:
        allowed.add(pid)
        row = by_pid.get(pid)
        if row is None:
            break
        pid = row['parentPid']
    active = [row for row in snapshot['processes']
              if row['pid'] not in allowed and row['cwdScope'] in {'candidate_checkout', 'baseline_checkout'}]
    require(not active, 'Visible own checkout work still active: ' + ','.join(str(row['pid']) for row in active))
    return {'passed': True, 'allowedControllerAncestors': sorted(allowed),
            'scope': 'visible_process_cwd_plus_explicit_own_status_not_cross_namespace_proof'}


def enable_subreaper():
    libc = ctypes.CDLL(None, use_errno=True)
    previous = ctypes.c_int()
    if libc.prctl(37, ctypes.byref(previous), 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), 'PR_GET_CHILD_SUBREAPER failed')
    if libc.prctl(36, 1, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), 'PR_SET_CHILD_SUBREAPER failed')
    return libc, previous.value
