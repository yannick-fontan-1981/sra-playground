#!/usr/bin/env python3
"""Independent temporary-process tests; never calls Git, Node, project code or a network."""
from __future__ import annotations
import argparse
import errno
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
WRAPPER = HERE / 'run-bounded-locked-command.py'
DUMMY = 'DUMMY_CREDENTIAL_FOR_TEMPORARY_TESTS_ONLY_7293'
READY = b'Ready for bounded checkpoint JSON on stdin (hidden input).\n'
PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258'
LANES = ('lot5c', 'lot6b', 'lot8a', 'lot10c')

RUNNER = r"""
import hashlib, importlib.util, json, pathlib, sys
config = json.loads(pathlib.Path(sys.argv[1]).read_text())
spec = importlib.util.spec_from_file_location('bounded_wrapper', config['wrapper'])
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
helper = pathlib.Path(config['helper'])
receipt = pathlib.Path(config['receipt'])
statuses = tuple(pathlib.Path(p) for p in config['statuses'])
digest = hashlib.sha256(helper.read_bytes()).hexdigest()
if config.get('bad_hash'): digest = '0' * 64
settings = module.Settings(
    program=(sys.executable, '-B', str(helper), config['mode'], config['observation'], config['lock'], str(receipt), str(statuses[0])),
    helper_name='temporary-stand-in', helper_path=helper, helper_sha256=digest,
    cwd=pathlib.Path(config['cwd']), lock_path=pathlib.Path(config['lock']),
    status_paths=statuses, receipt_path=receipt,
    input_timeout=config.get('input_timeout', 1.0), handshake_timeout=config.get('handshake_timeout', 0.4),
    work_timeout=config.get('work_timeout', 1.5), term_grace=0.15, kill_grace=1.5,
    ready_marker=module.SITE_READY if config['mode']=='sites' else module.READY,
    result_kind='sites-workflow' if config['mode']=='sites' else 'checkpoint')
def change():
    statuses[0].write_text(json.dumps({'quiet_requested': True}))
raise SystemExit(module.run(settings,
    _after_input=change if config.get('after_input') else None,
    _after_lock=change if config.get('after_lock') else None))
"""

FAKE = r"""
import json, os, pathlib, signal, subprocess, sys, termios, time, tty
mode, observation, lock_path, receipt_path, status_path = sys.argv[1:]
observation = pathlib.Path(observation)
assert os.isatty(0)
echo_off = not (termios.tcgetattr(0)[3] & termios.ECHO)
if mode != 'transport_without_child_setraw': tty.setraw(0)
lock_stat = os.stat(lock_path)
lock_absent = True
for descriptor in range(64):
    try: current = os.fstat(descriptor)
    except OSError: continue
    if (current.st_dev, current.st_ino) == (lock_stat.st_dev, lock_stat.st_ino): lock_absent = False
record = {'leader': os.getpid(), 'group': os.getpgrp(), 'echoOff': echo_off, 'lockFdAbsent': lock_absent,
          'hooksDisabled': os.environ.get('GIT_CONFIG_COUNT') == '1' and os.environ.get('GIT_CONFIG_KEY_0') == 'core.hooksPath' and os.environ.get('GIT_CONFIG_VALUE_0') == '/dev/null' and 'GIT_CONFIG_PARAMETERS' not in os.environ}
observation.write_text(json.dumps(record))
if mode == 'handshake':
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    while True: time.sleep(0.05)
ready = 'Ready for Site workflow JSON on stdin (input is hidden).\n' if mode == 'sites' else 'Ready for checkpoint JSON on stdin (input is hidden).\n'
sys.stderr.write(ready); sys.stderr.flush()
raw = bytearray()
while b'\n' not in raw:
    chunk = os.read(0, 4096)
    if not chunk: raise SystemExit(9)
    raw.extend(chunk)
request = json.loads(raw)
record['inputBytes'] = len(raw)
observation.write_text(json.dumps(record))
if mode in ('tree', 'leader_exit'):
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    descendant_ready = str(observation) + '.descendant'
    code = "import pathlib,signal,sys,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); pathlib.Path(sys.argv[1]).write_text('ready'); time.sleep(60)"
    child = subprocess.Popen([sys.executable, '-B', '-c', code, descendant_ready], close_fds=True)
    while not pathlib.Path(descendant_ready).exists(): time.sleep(0.005)
    record['descendant'] = child.pid
    observation.write_text(json.dumps(record))
if mode == 'nonzero':
    # Deliberately hostile output must not be echoed or copied into the receipt.
    sys.stdout.write(json.dumps({'status': []}) + '\n' + request['credential']['token'] + '\n')
    sys.stderr.write(request['credential']['token'] + '\n')
    sys.stdout.flush(); sys.stderr.flush(); raise SystemExit(7)
if mode == 'quiet_work':
    pathlib.Path(status_path).write_text(json.dumps({'quiet_requested': True}))
    while True: time.sleep(0.05)
if mode == 'tree':
    while True: time.sleep(0.05)
if mode == 'sites':
    print(json.dumps({'project_id': 'appgprj_6adbc388d79081918581b93b919d7258',
                      'checkout_path': os.getcwd(), 'commit_sha': 'a'*40, 'archive': request['archivePath']}), flush=True)
else:
    print(json.dumps({'status': 'pushed_and_verified', 'commit': 'a'*40, 'remoteHead': 'a'*40,
                      'branch': 'refs/heads/lot5c-recovery-checkpoint-20261111', 'sitePublicationPerformed': False}), flush=True)
"""


def fingerprint(path):
    raw = path.read_bytes()
    return {'file': path.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


def real_coordination_clear():
    for lane in LANES:
        path = Path('/workspace/shared/sra-coordination') / (lane + '-status.json')
        data = json.loads(path.read_bytes())
        if data.get('quiet_requested') is True:
            raise RuntimeError('production_quiet_requested_before_next_test')


def can_take_ex(path):
    fd = os.open(path, os.O_RDWR | os.O_CLOEXEC)
    try:
        try: fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: return False
        fcntl.flock(fd, fcntl.LOCK_UN)
        return True
    finally:
        os.close(fd)


def still_exists(pid):
    try: os.kill(pid, 0); return True
    except ProcessLookupError: return False


def exercise(parent, case, runner, helper):
    started = time.monotonic()
    folder = parent / case['name']; folder.mkdir()
    cwd = folder / 'work'; cwd.mkdir()
    lock = folder / 'temporary.lock'; lock.write_bytes(b'')
    statuses = []
    for lane in LANES:
        path = folder / (lane + '-status.json')
        path.write_text(json.dumps({'quiet_requested': bool(case.get('initial_quiet') and lane == 'lot5c')}))
        statuses.append(path)
    receipt_path = folder / 'receipt.json'; observation = folder / 'observation.json'
    config = {'wrapper': str(WRAPPER), 'helper': str(helper), 'cwd': str(cwd), 'lock': str(lock),
              'receipt': str(receipt_path), 'observation': str(observation),
              'statuses': [str(path) for path in statuses], 'mode': case.get('mode', 'success'),
              'input_timeout': 0.5 if case.get('partial_input') else 1.0,
              'work_timeout': 0.5 if case.get('work_timeout') else 1.5,
              **{key: True for key in ('after_input', 'after_lock', 'bad_hash') if case.get(key)}}
    config_path = folder / 'config.json'; config_path.write_text(json.dumps(config))
    master, slave = os.openpty(); os.set_blocking(master, False)
    held = None; process = None; selected = None; captured = bytearray()
    input_sent = False; interrupted = False; before_input_ex = None; supplied_input_bytes = None
    receipt = None; observed = {}; checks = []
    try:
        if case.get('held_ex'):
            held = os.open(lock, os.O_RDWR | os.O_CLOEXEC)
            fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
        environment = os.environ.copy()
        if case.get('hostile_git_config'):
            environment.update(GIT_CONFIG_PARAMETERS="'core.hooksPath=/tmp/test-unused-hooks'", GIT_CONFIG_COUNT='1', GIT_CONFIG_KEY_0='core.hooksPath', GIT_CONFIG_VALUE_0='/tmp/test-unused-hooks')
        process = subprocess.Popen([sys.executable, '-B', str(runner), str(config_path)], env=environment,
                                   stdin=slave, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   close_fds=True, start_new_session=True)
        os.close(slave); slave = None
        os.set_blocking(process.stdout.fileno(), False)
        selected = selectors.DefaultSelector()
        selected.register(process.stdout, selectors.EVENT_READ, 'stdout')
        selected.register(master, selectors.EVENT_READ, 'tty')
        deadline = time.monotonic() + 6
        while process.poll() is None:
            if time.monotonic() >= deadline:
                raise RuntimeError('test_outer_deadline')
            for key, _ in selected.select(0.02):
                fd = key.fileobj if isinstance(key.fileobj, int) else key.fileobj.fileno()
                try: chunk = os.read(fd, 65536)
                except BlockingIOError: continue
                except OSError as error:
                    if error.errno == errno.EIO:
                        selected.unregister(key.fileobj); continue
                    raise
                if not chunk:
                    selected.unregister(key.fileobj); continue
                captured.extend(chunk)
            if READY in captured and not input_sent:
                before_input_ex = can_take_ex(lock) if held is None else None
                request = {'credential': {'token': DUMMY}, 'expectedCommit': 'a'*40}
                if config['mode'] == 'sites':
                    request.update(source={'project_id': PROJECT, 'checkout_path': str(cwd)},
                                   commands=[], archivePath=str(folder / 'archive.zip'))
                if case.get('payload_target_bytes'):
                    request['padding'] = ''
                    overhead = len((json.dumps(request) + '\n').encode())
                    request['padding'] = 'x' * (case['payload_target_bytes'] - overhead)
                raw = (json.dumps(request) + '\n').encode()
                supplied_input_bytes = len(raw)
                if case.get('partial_input'): raw = raw[:len(raw)//2]
                sent = 0
                while sent < len(raw):
                    try: sent += os.write(master, raw[sent:])
                    except BlockingIOError: time.sleep(0.005)
                input_sent = True
            if case.get('interrupt') and not interrupted and observation.exists():
                current = json.loads(observation.read_text())
                if current.get('descendant'):
                    os.kill(process.pid, signal.SIGTERM)
                    interrupted = True
        returncode = process.wait(timeout=0.5)
        # The child is terminal; read its last bounded output without waiting.
        try:
            while chunk := os.read(process.stdout.fileno(), 65536): captured.extend(chunk)
        except BlockingIOError:
            pass
        receipt = json.loads(receipt_path.read_text())
        if observation.exists(): observed = json.loads(observation.read_text())
        def check(name, value):
            checks.append({'name': name, 'passed': bool(value)})
        check('expected_exit_code', returncode == case['exit'])
        check('expected_terminal_status', receipt['status'] == case.get('status', 'failed'))
        check('expected_terminal_reason', receipt.get('reason') == case.get('reason'))
        check('cleanup_complete', receipt.get('cleanup', {}).get('complete') is True)
        check('no_dummy_credential_in_console_or_receipt', DUMMY.encode() not in captured and DUMMY not in json.dumps(receipt))
        check('tool_session_id_not_fabricated', receipt['toolSessionId'] is None)
        check('child_spawn_matches_expectation', receipt['childStarted'] is case.get('child', True))
        check('lock_acquired_matches_expectation', receipt['lockAcquired'] is case.get('locked', True))
        if input_sent and held is None:
            check('no_shared_lock_during_input', before_input_ex is True)
        if observed:
            check('child_tty_echo_disabled', observed.get('echoOff') is True)
            check('lock_descriptor_not_inherited', observed.get('lockFdAbsent') is True)
            check('git_hooks_disabled_even_with_inherited_override', observed.get('hooksDisabled') is True)
            check('leader_terminal', not still_exists(observed['leader']))
            if case.get('payload_target_bytes'):
                check('whole_large_input_delivered', observed.get('inputBytes') == supplied_input_bytes == case['payload_target_bytes'])
                check('whole_large_input_counted', receipt['inputBytesRead'] == supplied_input_bytes)
            if 'descendant' in observed:
                check('descendant_terminal', not still_exists(observed['descendant']))
                check('descendant_reaped', receipt['cleanup']['reapedDescendants'] >= 1)
        if case.get('interrupt'):
            check('signal_retained', interrupted and receipt.get('receivedSignal') == 'SIGTERM')
        if case.get('partial_input'):
            check('partial_input_retained_only_as_count', 0 < receipt['inputBytesRead'] < 65536)
        if case.get('initial_quiet'):
            check('input_never_requested', READY not in captured and not input_sent)
        if held is not None:
            fcntl.flock(held, fcntl.LOCK_UN); os.close(held); held = None
        check('lock_free_after_terminal', can_take_ex(lock))
        return {'name': case['name'], 'passed': all(row['passed'] for row in checks),
                'durationSeconds': round(time.monotonic()-started,6), 'checks': checks,
                'receipt': receipt, 'testObservation': observed}
    finally:
        if process is not None and process.poll() is None:
            # Only known test-created process groups are ever signalled.
            os.kill(process.pid, signal.SIGTERM)
            try: process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL); process.wait(timeout=2)
        if receipt_path.exists():
            saved = json.loads(receipt_path.read_text())
            group = saved.get('childProcessGroup')
            if isinstance(group, int):
                try: os.killpg(group, signal.SIGKILL)
                except ProcessLookupError: pass
                until = time.monotonic() + 1
                while time.monotonic() < until:
                    try: child, _ = os.waitpid(-group, os.WNOHANG)
                    except ChildProcessError: break
                    if child == 0: time.sleep(0.01)
        if selected: selected.close()
        if process and process.stdout: process.stdout.close()
        for fd in (master, slave, held):
            if fd is not None:
                try: os.close(fd)
                except OSError: pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    if args.report.exists(): raise SystemExit('Refusing to overwrite a test receipt.')
    spec = importlib.util.spec_from_file_location('wrapper_test_api', WRAPPER)
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
    old_subreaper = module.set_subreaper(True)
    cases = [
        {'name':'success', 'exit':0, 'status':'passed'},
        {'name':'nonzero_and_secret_output', 'mode':'nonzero', 'exit':1, 'reason':'child_exit_nonzero'},
        {'name':'partial_input_timeout', 'partial_input':True, 'exit':124, 'reason':'input_timeout', 'child':False, 'locked':False},
        {'name':'handshake_timeout', 'mode':'handshake', 'exit':124, 'reason':'handshake_timeout'},
        {'name':'work_timeout_child_and_descendant', 'mode':'tree', 'work_timeout':True, 'exit':124, 'reason':'work_timeout'},
        {'name':'signal_interruption_child_and_descendant', 'mode':'tree', 'interrupt':True, 'exit':143, 'status':'interrupted', 'reason':'interrupted'},
        {'name':'lock_descriptor_absent_in_child', 'exit':0, 'status':'passed'},
        {'name':'quiet_changed_after_input_before_lock', 'after_input':True, 'exit':75, 'reason':'coordination_quiet_requested', 'child':False, 'locked':False},
        {'name':'quiet_changed_after_lock_before_child', 'after_lock':True, 'exit':75, 'reason':'coordination_quiet_requested', 'child':False},
        {'name':'leader_success_descendant_cleanup', 'mode':'leader_exit', 'exit':0, 'status':'passed'},
        {'name':'exclusive_lock_refusal_no_retry', 'held_ex':True, 'exit':75, 'reason':'shared_lock_unavailable', 'child':False, 'locked':False},
        {'name':'official_sites_protocol_stand_in', 'mode':'sites', 'exit':0, 'status':'passed'},
        {'name':'quiet_present_before_input', 'initial_quiet':True, 'exit':75, 'reason':'coordination_quiet_requested', 'child':False, 'locked':False},
        {'name':'changed_helper_fingerprint', 'bad_hash':True, 'exit':1, 'reason':'helper_fingerprint_changed', 'child':False},
        {'name':'new_quiet_during_child_work', 'mode':'quiet_work', 'exit':75, 'reason':'coordination_quiet_requested'},
        {'name':'inherited_git_hook_override_removed', 'hostile_git_config':True, 'exit':0, 'status':'passed'},
        {'name':'json_6016_bytes_without_child_setraw', 'mode':'transport_without_child_setraw', 'payload_target_bytes':6016, 'exit':0, 'status':'passed'},
        {'name':'json_65536_bytes_without_child_setraw', 'mode':'transport_without_child_setraw', 'payload_target_bytes':65536, 'exit':0, 'status':'passed'},
    ]
    report = {'schema':'logos-engine.lot5c.bounded-locked-command-independent-tests.v1',
              'startedAt':datetime.now(timezone.utc).isoformat(), 'status':'running',
              'wrapper':fingerprint(WRAPPER), 'harness':fingerprint(Path(__file__)),
              'temporaryLocksOnly':True, 'productionExclusiveLockAttempted':False,
              'actualCheckpointHelpersExecuted':False, 'officialSitesWorkflowExecuted':False,
              'gitExecuted':False, 'networkExecuted':False, 'projectRuntimeExecuted':False,
              'cases':[]}
    try:
        with tempfile.TemporaryDirectory(prefix='lot5-coordination-v2-independent-') as temporary:
            parent=Path(temporary)
            runner=parent/'runner.py'; runner.write_text(RUNNER)
            helper=parent/'fake_helper.py'; helper.write_text(FAKE)
            for case in cases:
                real_coordination_clear()
                row=exercise(parent,case,runner,helper)
                report['cases'].append(row)
                print(json.dumps({'case':row['name'],'passed':row['passed']}),flush=True)
                if not row['passed']:
                    break
        report['status']='passed' if len(report['cases'])==len(cases) and all(row['passed'] for row in report['cases']) else 'failed'
    except BaseException as error:
        report['status']='failed'; report['failureClass']=type(error).__name__
        report['failureCode']=str(error) if str(error) in ('production_quiet_requested_before_next_test','test_outer_deadline') else 'test_harness_exception'
    finally:
        module.set_subreaper(old_subreaper)
        report['finishedAt']=datetime.now(timezone.utc).isoformat()
        report['plannedCases']=len(cases); report['completedCases']=len(report['cases'])
        report['passedChecks']=sum(check['passed'] for row in report['cases'] for check in row['checks'])
        report['totalChecks']=sum(len(row['checks']) for row in report['cases'])
        raw=json.dumps(report,indent=2)+'\n'
        assert DUMMY not in raw
        with args.report.open('x') as stream:stream.write(raw)
    print(json.dumps({key:report[key] for key in ('status','completedCases','plannedCases','passedChecks','totalChecks')}),flush=True)
    return 0 if report['status']=='passed' else 1


if __name__=='__main__':
    raise SystemExit(main())
