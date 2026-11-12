#!/usr/bin/env python3
"""Commit exactly one declared evidence bin. Never push, reset or retry.

Invocation: python -B commit-bin.py bin-01 --expected-parent FULL_SHA1
A failed receipt is retained. Root must review any partial index/commit state.
"""
import argparse
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import signal
import stat
import subprocess
import sys
import time

DIRECTORY = Path(__file__).resolve().parent
ROOT = DIRECTORY.parents[4]
PLAN = DIRECTORY / 'transport-plan.json'
PLAN_SHA256 = '39a6b0c8024fc7869acd4aeacc1438a1d68199fc4d9769bacac3a3bde66ed2d4'
LOCK = Path('/workspace/shared/sra-coordination/performance.lock')
COORDINATION = LOCK.parent
BRANCH = 'lot6b-selected-rigid-checkpoint-20261111'
BASE = 'a01e6faf330d82fa220feac0c9ad4632bb75a9de'
MAX_BYTES = 24 * 1024 * 1024
TOTAL_SECONDS = 180

def utc():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def require(condition, message):
    if not condition:
        raise ValueError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def guard():
    rows = []
    for lane in ('lot5c', 'lot8a', 'lot10c'):
        value = json.loads((COORDINATION / (lane + '-status.json')).read_bytes())
        require(isinstance(value, dict), 'Invalid lane status: ' + lane)
        rows.append({'lane': lane, 'updatedAt': value.get('updated_at'),
                     'quietRequested': value.get('quiet_requested'),
                     'requestId': value.get('quiet_request_id')})
        require(value.get('quiet_requested') is not True, 'Fresh quiet: ' + lane)
    return rows

def local_file(name):
    require(isinstance(name, str) and name and not any(c in name for c in ('\\', '\x00', '\n', '\r')), 'Invalid path')
    path = PurePosixPath(name)
    require(not path.is_absolute() and path.as_posix() == name and all(p not in ('.', '..') for p in path.parts), 'Path traversal or noncanonical path: ' + name)
    current = ROOT
    for index, part in enumerate(path.parts):
        current = current / part
        info = current.lstat()
        require(not stat.S_ISLNK(info.st_mode), 'Symlink rejected: ' + name)
        require(stat.S_ISREG(info.st_mode) if index == len(path.parts)-1 else stat.S_ISDIR(info.st_mode), 'Wrong file type: ' + name)
    return current

def verify_files(files):
    for item in files:
        path = local_file(item['path'])
        before = path.stat()
        data = path.read_bytes()
        after = path.stat()
        require((before.st_ino, before.st_size, before.st_mtime_ns, before.st_mode) ==
                (after.st_ino, after.st_size, after.st_mtime_ns, after.st_mode), 'File changed during hashing: ' + item['path'])
        require(len(data) == item['bytes'] and sha(data) == item['sha256'], 'Frozen bytes differ: ' + item['path'])
        require(format(stat.S_IMODE(after.st_mode), '04o') == item['mode'], 'Mode differs: ' + item['path'])

def parse_status(data):
    values = data.decode('utf-8').split('\x00')
    require(values[-1] == '', 'Invalid NUL status output')
    values.pop()
    require(len(values) % 2 == 0, 'Invalid status pairs')
    result = {}
    for offset in range(0, len(values), 2):
        status, path = values[offset:offset+2]
        require(status in ('A', 'M') and path not in result, 'Deletion, rename, conflict or duplicate staged path')
        result[path] = status
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bin_id', choices=['bin-%02d' % i for i in range(1, 8)])
    parser.add_argument('--expected-parent', required=True)
    parser.add_argument('--attempt', type=int, choices=range(1, 10), default=1)
    args = parser.parse_args()
    attempt_suffix = '' if args.attempt == 1 else '-attempt-%02d' % args.attempt
    receipt_path = DIRECTORY / (args.bin_id + '-commit' + attempt_suffix + '.json')
    if args.attempt > 1:
        previous_suffix = '' if args.attempt == 2 else '-attempt-%02d' % (args.attempt-1)
        previous_attempt = DIRECTORY / (args.bin_id + '-commit' + previous_suffix + '.json')
        prior = json.loads(previous_attempt.read_text())
        require(prior.get('status') == 'failed' and prior.get('parent') == args.expected_parent, 'Explicit retry requires retained failed prior attempt and same expected parent')
    if receipt_path.exists() or receipt_path.is_symlink():
        raise FileExistsError('Existing immutable receipt; no retry: ' + str(receipt_path))
    receipt = {'schema': 'logos-engine.lot6b.single-bin-commit.v1', 'bin': args.bin_id,
               'status': 'failed', 'attempt': args.attempt, 'startedAt': utc(), 'parent': args.expected_parent,
               'commit': None, 'branch': BRANCH, 'commands': [], 'files': [],
               'networkUsed': False, 'automaticResetOrRetry': False,
               'remoteVerificationPerformed': False, 'rootMustVerifyRemoteSeparately': True}
    lock_fd = None
    deadline = time.monotonic() + TOTAL_SECONDS
    code = 1

    def close_owned_group(child, row, phase):
        """Bounded checks/signals apply only to this invocation's session group."""
        event = {'phase': phase, 'processGroupId': child.pid, 'startedAt': utc(), 'signals': []}
        row.setdefault('processGroupClosureChecks', []).append(event)

        def visible():
            child.poll()  # Reap the direct child whenever it has exited.
            try:
                os.killpg(child.pid, 0)
                return True
            except ProcessLookupError:
                return False
            except PermissionError as error:
                event.setdefault('probeErrors', []).append({'type': type(error).__name__, 'message': str(error)})
                return True
            except OSError as error:
                event.setdefault('probeErrors', []).append({'type': type(error).__name__, 'message': str(error)})
                return None  # Unknown is never treated as proof of disappearance.

        present = visible()
        event['initiallyVisible'] = present
        event['leaderExitObservedInitially'] = child.returncode is not None
        orphan_seen = present is not False and child.returncode is not None
        if present is not False:
            row['processGroupClosureIncident'] = True
            for sig in (signal.SIGTERM, signal.SIGKILL):
                signal_event = {'signal': sig.name, 'at': utc(), 'waitBoundSeconds': 1.0}
                event['signals'].append(signal_event)
                try:
                    os.killpg(child.pid, sig)
                    signal_event['outcome'] = 'sent_to_owned_group'
                except ProcessLookupError:
                    signal_event['outcome'] = 'owned_group_already_absent'
                except OSError as error:
                    signal_event.update(outcome='signal_failed', errorType=type(error).__name__, error=str(error))
                limit = time.monotonic() + 1.0
                while True:
                    present = visible()
                    if present is False or time.monotonic() >= limit:
                        break
                    time.sleep(min(0.05, max(0.0, limit-time.monotonic())))
                signal_event['visibleAfterWait'] = present
                if present is False:
                    break
        present = visible()  # Required final observation, including after cleanup.
        event.update(finishedAt=utc(), finallyVisible=present, directChildExitCode=child.returncode)
        row['childProcessGroupReaped'] = present is False
        terminated = orphan_seen and present is False and any(s['outcome'] == 'sent_to_owned_group' for s in event['signals'])
        row['orphanProcessGroupTerminated'] = row.get('orphanProcessGroupTerminated', False) or terminated
        if present is not False:
            row['ownedGroupCleanupUnconfirmed'] = True
        return event['initiallyVisible'] is not False

    def git(*arguments, timeout=20, opaque=False, input_bytes=None, allowed=(0,)):
        remaining = deadline - time.monotonic()
        require(remaining > 0, 'Overall 180-second operation bound reached')
        # check-ignore --stdin accepts literal path names and rejects pathspec magic.
        command = ['git', *([] if arguments[0] == 'check-ignore' else ['--literal-pathspecs']), *arguments]
        row = {'command': command, 'startedAt': utc(), 'timeoutSeconds': min(timeout, remaining), 'timedOut': False,
               'childProcessGroupReaped': None, 'orphanProcessGroupTerminated': False,
               'processGroupClosureIncident': False, 'childStarted': False,
               'errorCleanupMaximumAdditionalSeconds': 5}
        receipt['commands'].append(row)
        child = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.PIPE if input_bytes is not None else subprocess.DEVNULL,
                                 stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True,
                                 pass_fds=(lock_fd,), env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'})
        row.update(childStarted=True, childPid=child.pid, childProcessGroupId=child.pid)
        try:
            stdout, stderr = child.communicate(input_bytes, timeout=row['timeoutSeconds'])
        except BaseException as error:
            row['timedOut'] = isinstance(error, subprocess.TimeoutExpired)
            row['interruption'] = type(error).__name__
            close_owned_group(child, row, 'interrupted_command_cleanup')
            try:
                stdout, stderr = child.communicate(timeout=1)
                row.update(stderr=stderr.decode('utf-8', 'replace'), stdoutBytes=len(stdout), stdoutSha256=sha(stdout), stdioDrainComplete=True)
            except subprocess.TimeoutExpired:
                row['stdioDrainComplete'] = False
                child.stdout.close(); child.stderr.close()
            finally:
                close_owned_group(child, row, 'after_error_cleanup')
                row.update(exitCode=child.poll(), finishedAt=utc())
            raise
        row.update(exitCode=child.returncode, stderr=stderr.decode('utf-8', 'replace'), stdoutBytes=len(stdout), stdoutSha256=sha(stdout))
        if not opaque:
            row['stdout'] = stdout.decode('utf-8', 'replace')
        orphan_observed = close_owned_group(child, row, 'after_successful_communicate')
        row['finishedAt'] = utc()
        require(not orphan_observed and row['childProcessGroupReaped'] is True,
                'Residual owned process group observed; success refused even if cleanup completed')
        require(child.returncode in allowed, 'Git command failed: ' + ' '.join(arguments[:2]))
        return stdout

    try:
        require(re.fullmatch(r'[0-9a-f]{40}', args.expected_parent) is not None, 'Expected parent must be a full SHA-1')
        lock_fd = os.open(LOCK, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW)
        opened = os.fstat(lock_fd); named = LOCK.lstat()
        require(stat.S_ISREG(opened.st_mode) and (opened.st_dev, opened.st_ino) == (named.st_dev, named.st_ino), 'Unexpected performance lock object')
        fcntl.flock(lock_fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
        receipt['coordinationBefore'] = guard()
        plan_bytes = local_file(PLAN.relative_to(ROOT).as_posix()).read_bytes()
        require(sha(plan_bytes) == PLAN_SHA256, 'Immutable transport plan changed')
        plan = json.loads(plan_bytes)
        require(plan['baseCommit'] == BASE and plan['rawBytesMaximumPerBin'] == MAX_BYTES, 'Unexpected plan contract')
        require(str(ROOT) == plan['checkout'], 'Unexpected checkout')
        bins = {b['id']: b for b in plan['bins']}
        require(len(bins) == 7 and args.bin_id in bins, 'Invalid bin inventory')
        all_paths = [p for b in plan['bins'] for p in b['paths']]
        require(len(all_paths) == len(set(all_paths)), 'Plan bins overlap')
        records = {f['path']: f for f in plan['files']}
        require(len(records) == len(plan['files']) and set(records) == set(all_paths), 'Plan file partition differs')
        selected = bins[args.bin_id]
        paths = selected['paths']; normal = selected['normalAddPaths']; forced = selected['forceAddPaths']
        require(len(paths) == len(set(paths)) and set(normal).isdisjoint(forced) and set(normal) | set(forced) == set(paths), 'Add path partition differs')
        require(len(normal)+len(forced) == len(paths), 'Duplicate add paths')
        files = [records[p] for p in paths]
        require(sum(f['bytes'] for f in files) == selected['rawBytes'] <= MAX_BYTES, 'Bin raw-byte bound differs')
        for path in forced:
            require(records[path]['requiresExplicitForceAdd'] is True and records[path]['gitState'] == 'ignored_auxiliary_of_new_closed_evidence' and path.endswith('.log'), 'Force-add is limited to planned ignored raw logs')
        require(all(records[p]['requiresExplicitForceAdd'] is False for p in normal), 'Normal/force flags differ')
        receipt.update(planSha256=PLAN_SHA256, rawBytes=selected['rawBytes'], files=files, normalAddPaths=normal, forceAddPaths=forced)
        require(git('rev-parse', '--show-toplevel').decode().strip() == str(ROOT), 'Git root differs')
        require(git('rev-parse', 'HEAD').decode().strip() == args.expected_parent, 'HEAD differs from expected parent')
        require(not git('diff', '--cached', '--name-only', '-z'), 'Index already contains staged changes')
        require(not git('ls-files', '--deleted', '-z'), 'Tracked deletion exists')
        number = int(args.bin_id[-2:])
        if number == 1:
            require(args.expected_parent == BASE, 'First bin requires exact initial parent')
        else:
            previous_path = DIRECTORY / ('bin-%02d-push.json' % (number-1))
            previous_bytes = local_file(previous_path.relative_to(ROOT).as_posix()).read_bytes()
            previous = json.loads(previous_bytes)
            require(previous.get('status') == 'verified' and previous.get('remoteVerified') is True and
                    previous.get('commit') == args.expected_parent and previous.get('branch') == BRANCH,
                    'Previous push is not exactly verified for this parent/branch')
            receipt['previousPushReceipt'] = {'path': previous_path.relative_to(ROOT).as_posix(), 'sha256': sha(previous_bytes), 'bytes': len(previous_bytes)}
        verify_files(files)
        if forced:
            actual_ignored = git('check-ignore', '--no-index', '-z', '--stdin', input_bytes=('\x00'.join(forced)+'\x00').encode(), allowed=(0, 1))
            require(set(actual_ignored.decode().rstrip('\x00').split('\x00')) == set(forced), 'A forced path is not currently ignored')
        receipt['coordinationImmediatelyBeforeStaging'] = guard()
        # One bounded bin is now in flight. Finish its checks and receipt; never queue another bin.
        if normal:
            git('add', '--', *normal, timeout=30)
        if forced:
            git('add', '--force', '--', *forced, timeout=30)
        staged = parse_status(git('diff', '--cached', '--name-status', '--no-renames', '-z'))
        require(set(staged) == set(paths), 'Exact staged path set differs')
        index_rows = git('ls-files', '--stage', '-z', '--', *paths).decode().rstrip('\x00').split('\x00')
        staged_objects = {}
        for line in index_rows:
            header, path = line.split('\t', 1)
            mode, oid, stage = header.split()
            require(path in records and path in paths and stage == '0' and path not in staged_objects, 'Unexpected staged entry')
            expected_mode = '100755' if int(records[path]['mode'], 8) & 0o111 else '100644'
            require(mode == expected_mode, 'Staged mode differs: ' + path)
            blob = git('cat-file', 'blob', oid, opaque=True)
            require(len(blob) == records[path]['bytes'] and sha(blob) == records[path]['sha256'], 'Staged blob differs: ' + path)
            staged_objects[path] = {'mode': mode, 'object': oid}
        require(set(staged_objects) == set(paths), 'Missing staged object')
        receipt['stagedObjects'] = staged_objects
        git('commit', '-m', 'Checkpoint Lot 6B functional evidence ' + args.bin_id + '/07', timeout=120)
        receipt['commit'] = git('rev-parse', 'HEAD').decode().strip()
        require(receipt['commit'] != args.expected_parent and git('rev-parse', 'HEAD^').decode().strip() == args.expected_parent, 'Unexpected commit parent')
        committed = parse_status(git('diff', '--name-status', '--no-renames', '-z', args.expected_parent, receipt['commit'], '--'))
        require(set(committed) == set(paths), 'Commit contains unexpected or missing paths')
        tree_rows = git('ls-tree', '-r', '-z', receipt['commit'], '--', *paths).decode().rstrip('\x00').split('\x00')
        tree_objects = {}
        for line in tree_rows:
            header, path = line.split('\t', 1)
            mode, kind, oid = header.split()
            require(kind == 'blob' and path not in tree_objects, 'Unexpected committed tree entry')
            tree_objects[path] = {'mode': mode, 'object': oid}
        require(tree_objects == staged_objects, 'Commit hooks changed the verified staged objects')
        require(not git('diff', '--cached', '--name-only', '-z'), 'Index is not empty after commit')
        verify_files(files)
        receipt.update(status='committed', exactCommittedPathSet=True, committedBlobsMatchPlan=True, workingFilesStillMatchPlan=True)
        code = 0
    except BaseException as error:
        receipt['error'] = {'type': type(error).__name__, 'message': str(error)}
        receipt['partialIndexOrCommitMayExist'] = any(r['command'][2] in ('add', 'commit') for r in receipt['commands'])
    finally:
        receipt['finishedAt'] = utc()
        receipt['elapsedSeconds'] = TOTAL_SECONDS - (deadline - time.monotonic())
        receipt['actualExitCode'] = code
        # Metadata-only terminal receipt; no rollback, cleanup of the index, or retry.
        with receipt_path.open('x') as stream:
            json.dump(receipt, stream, ensure_ascii=False, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
        if lock_fd is not None:
            os.close(lock_fd)
    print(json.dumps({'status': receipt['status'], 'bin': args.bin_id, 'parent': receipt['parent'],
                      'commit': receipt['commit'], 'receipt': receipt_path.relative_to(ROOT).as_posix(),
                      'exitCode': code}, ensure_ascii=False))
    return code

if __name__ == '__main__':
    raise SystemExit(main())
