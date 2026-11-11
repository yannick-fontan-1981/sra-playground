#!/usr/bin/env python3
"""TEMP-only lifecycle tests: dummy Python children, temporary mutexes and receipts.

No production status, mutex, readiness, game, native runtime or benchmark is used.
Controller globals are replaced inside each test module; its command launcher is
blocked explicitly before it can execute any command. Production has no CLI
switch allowing a substitute mutex, shortened budget or dummy cost execution.
"""
import contextlib
from datetime import datetime, timezone, timedelta
import fcntl
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import types
import unittest

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True

def load(name):
    path = HERE / name
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

H = load('cost-process-control-v2.py')

def wait_for(predicate, seconds=3):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        if predicate():
            return
        time.sleep(0.02)
    raise AssertionError('Timed out waiting for temporary child evidence')

class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='lot5c-SYNTHETIC-lifecycle-')
        self.root = Path(self.temporary.name)
        H.enable_subreaper()

    def tearDown(self):
        self.temporary.cleanup()

    def registry(self):
        return H.Registry(self.root / 'active-groups.json', 'SYNTHETIC-ONLY')

    def test_success_and_non_inherited_temporary_ex(self):
        mutex = self.root / 'temporary.lock'
        fd = os.open(mutex, os.O_RDWR | os.O_CREAT | os.O_CLOEXEC, 0o600)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(10)'],
            close_fds=True, start_new_session=True)
        try:
            self.assertFalse(os.get_inheritable(fd))
            os.close(fd); fd = None  # Deliberately no LOCK_UN: inheritance would retain it.
            probe = os.open(mutex, os.O_RDWR | os.O_CLOEXEC)
            try:
                fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
            finally:
                os.close(probe)
            with (self.root / 'dummy.log').open('wb') as stream:
                result = H.run_owned([sys.executable, '-c', 'print("synthetic terminal")'],
                    cwd=self.root, stdout=stream, timeout_seconds=2, registry=self.registry())
            self.assertEqual(result['exitCode'], 0)
            self.assertTrue(result['cleanup']['terminal'])
            self.assertEqual(json.loads((self.root / 'active-groups.json').read_text())['activeGroups'], [])
        finally:
            if fd is not None:
                os.close(fd)
            H.terminate_owned_group(child.pid, child)

    def test_timeout_and_global_deadline_cleanup(self):
        registry = self.registry()
        with (self.root / 'dummy.log').open('wb') as stream:
            with self.assertRaises(TimeoutError):
                H.run_owned([sys.executable, '-c', 'import time; time.sleep(30)'], cwd=self.root,
                    stdout=stream, timeout_seconds=10, deadline_monotonic=time.monotonic()+0.15, registry=registry)
        self.assertEqual(registry.groups, {})
        self.assertEqual(json.loads(registry.path.read_text())['activeGroups'], [])

    def test_descendant_survives_leader_and_ignores_term(self):
        registry = self.registry()
        child_pid = self.root / 'descendant-pid.txt'
        code = ("import os,signal,time,pathlib\npid=os.fork()\nif pid == 0:\n"
                " signal.signal(signal.SIGTERM,signal.SIG_IGN)\n"
                " pathlib.Path(" + repr(str(child_pid)) + ").write_text(str(os.getpid()))\n"
                " time.sleep(30)\nelse:\n time.sleep(.15)\n os._exit(0)\n")
        with (self.root / 'dummy.log').open('wb') as stream:
            result = H.run_owned([sys.executable, '-c', code], cwd=self.root, stdout=stream,
                timeout_seconds=3, registry=registry)
        self.assertEqual(result['exitCode'], 0)
        self.assertTrue(result['cleanup']['escalatedToKill'])
        self.assertTrue(child_pid.exists())
        self.assertFalse(H.group_exists(result['pgid']))
        self.assertEqual(registry.groups, {})

    def test_signal_reaches_finally_and_cleans_owned_group(self):
        registry_path = self.root / 'signal-registry.json'
        launched = self.root / 'dummy-started'
        code = """import importlib.util,pathlib,signal,sys
spec=importlib.util.spec_from_file_location('helper',sys.argv[1]); h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
def stop(sig,frame): raise KeyboardInterrupt('synthetic signal')
signal.signal(signal.SIGTERM,stop)
r=h.Registry(pathlib.Path(sys.argv[2]),'SYNTHETIC-SIGNAL')
try:
 with open(sys.argv[3]+'.log','wb') as stream:
  h.run_owned([sys.executable,'-c','import pathlib,time;pathlib.Path('+repr(sys.argv[3])+').touch();time.sleep(30)'],cwd=pathlib.Path(sys.argv[2]).parent,stdout=stream,timeout_seconds=20,registry=r)
except KeyboardInterrupt:
 raise SystemExit(23)
"""
        harness = subprocess.Popen([sys.executable, '-B', '-c', code, str(HERE / 'cost-process-control-v2.py'),
            str(registry_path), str(launched)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            close_fds=True, start_new_session=True)
        try:
            wait_for(launched.exists)
            harness.send_signal(signal.SIGTERM)
            self.assertEqual(harness.wait(timeout=6), 23)
            self.assertEqual(json.loads(registry_path.read_text())['activeGroups'], [])
        finally:
            H.terminate_owned_group(harness.pid, harness)
            H.cleanup_registered(registry_path, 'SYNTHETIC-SIGNAL', harness.pid)

    def controller_fixture(self):
        module = load('run-coordinated-cost-5c-v2.py')
        module.ROOT = self.root
        module.SHARED, module.COORD, module.PERF = [self.root / n for n in ('shared', 'coord', 'perf')]
        module.BASELINE = self.root / 'baseline'
        module.BASE_MANIFEST = self.root / 'SYNTHETIC-baseline-manifest.json'
        module.CAND_MANIFEST = self.root / 'SYNTHETIC-candidate-manifest.json'
        module.REGISTRY_PATH = self.root / 'controller-groups.json'
        for directory in (module.SHARED, module.COORD, module.PERF, module.BASELINE):
            directory.mkdir()
        mutex = module.SHARED / 'performance.lock'
        mutex.touch(exist_ok=False)
        st = mutex.stat(); module.EXPECTED_LOCK_IDENTITY = (st.st_dev, st.st_ino)
        def fp(path):
            path = Path(path).resolve(); raw = path.read_bytes()
            return {'path': str(path), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
        module.fingerprint = fp
        now = datetime.now(timezone.utc); at=now.isoformat(); deadline=(now+timedelta(seconds=600)).isoformat()
        write=lambda p,v: p.write_text(json.dumps(v))
        write(module.SHARED/'lot5c-status.json',{'quiet_request_id':module.REQUEST,'quiet_requested':True})
        write(module.COORD/'request.json',{'requestId':module.REQUEST,'requestedAt':at,'availabilityDeadline':deadline})
        rows=[]
        for lane in module.LANES:
            payload={'quiet_acknowledged':True,'quiet_request_id':module.REQUEST,'active_command':None,
                'heavy_execution_active':False,'all_own_subagents_idle':True,'no_queued_commands':True,'updated_at':at}
            write(module.SHARED/(lane+'-status.json'),payload); retained=module.COORD/(lane+'-ack.json');write(retained,payload)
            rows.append({'lane':lane,'evidence':fp(retained),'acknowledgedAt':at})
        isolation={'requestId':module.REQUEST,'status':'acknowledged_quiet_before_window','otherLaneAcknowledged':True,
            'ownTrackedComputeEnded':True,'previewStopped':True,'knownLanes':rows,'recordedAt':at,
            'request':fp(module.COORD/'request.json')}
        write(module.COORD/'isolation.json',isolation)
        inputs=[fp(module.COORD/'isolation.json'),fp(Path(module.__file__)),fp(module.HELPER)]
        write(module.PERF/'readiness.json',{'status':'ready','measurementAuthorized':True,'pendingRequirements':[],
            'nativeSourceDigest':'SYNTHETIC-NO-NATIVE','inputs':inputs,'finalizedAt':at})
        write(module.PERF/'declaration.json',{'candidate':{'nativeDigest':'SYNTHETIC-NO-NATIVE'}})
        launched=[]
        def blocked(*args,**kwargs):
            launched.append(args[0]);raise RuntimeError('SYNTHETIC guard: no benchmark or command launched')
        module.lifecycle=lambda:types.SimpleNamespace(enable_subreaper=H.enable_subreaper,Registry=H.Registry,
            run_owned=blocked,terminate_owned_group=H.terminate_owned_group)
        return module,deadline,launched

    def assert_released(self,module):
        value=json.loads((module.SHARED/'lot5c-status.json').read_text())
        self.assertFalse(value['quiet_requested']);self.assertTrue(value['quiet_released'])
        fd=os.open(module.SHARED/'performance.lock',os.O_RDWR|os.O_CREAT|os.O_CLOEXEC,0o600)
        try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        finally:os.close(fd)
        self.assertFalse((module.PERF/'window.json').exists())

    def test_one_ex_refusal_releases_quiet_no_retry_no_command(self):
        module,deadline,launched=self.controller_fixture()
        fd=os.open(module.SHARED/'performance.lock',os.O_RDWR|os.O_CREAT|os.O_CLOEXEC,0o600)
        fcntl.flock(fd,fcntl.LOCK_SH|fcntl.LOCK_NB)
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(module.main(['--execute','--availability-deadline',deadline]),1)
        finally:os.close(fd)
        receipt=json.loads((module.COORD/'lock-window.json').read_text())
        self.assertEqual(receipt['status'],'refused_ex_no_measurement');self.assertEqual(receipt['exclusiveAttempts'],1)
        self.assertEqual(launched,[]);self.assert_released(module)
        self.assertIsNone(receipt['lockReleasedAt'])
        self.assertIsNotNone(receipt['descriptorClosedAt'])

    def test_missing_mutex_is_not_created(self):
        module,deadline,launched=self.controller_fixture()
        mutex=module.SHARED/'performance.lock';mutex.unlink()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(module.main(['--execute','--availability-deadline',deadline]),1)
        self.assertFalse(mutex.exists());self.assertEqual(launched,[])
        receipt=json.loads((module.COORD/'lock-window.json').read_text())
        self.assertEqual(receipt['exclusiveAttempts'],0)
        self.assertIsNone(receipt['lockReleasedAt']);self.assertIsNone(receipt['descriptorClosedAt'])
        self.assertTrue(json.loads((module.SHARED/'lot5c-status.json').read_text())['quiet_released'])

    def test_journal_failure_after_ex_still_unlocks_and_releases(self):
        module,deadline,launched=self.controller_fixture();original=module.replace
        def failing(path,value):
            if Path(path)==module.COORD/'lock-window.json' and value.get('exclusiveAttempts')==1:
                raise OSError('SYNTHETIC journal failure')
            return original(path,value)
        module.replace=failing
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(module.main(['--execute','--availability-deadline',deadline]),1)
        self.assertEqual(launched,[]);self.assert_released(module)
        self.assertTrue((module.COORD/'window-lease.json').exists())
        self.assertIn('terminal journal',json.dumps(json.loads((module.COORD/'controller-release.json').read_text())))

    def test_post_ex_child_start_guard_error_cleans_then_releases(self):
        module,deadline,launched=self.controller_fixture()
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(module.main(['--execute','--availability-deadline',deadline]),1)
        self.assertEqual(len(launched),1) # blocked test substitute, never an executed command
        self.assert_released(module)

if __name__=='__main__':
    unittest.main(verbosity=2)
