#!/usr/bin/env python3
"""Synthetic orchestration tests: temporary statuses/mutex and Python stand-ins only."""
import argparse, contextlib, datetime, fcntl, hashlib, importlib.util, io, json, os
from pathlib import Path
import signal, sys, tempfile, threading, time, unittest
SOURCE = Path(__file__).with_name('orchestrate-cost-recovery-02.py')
HELPER = SOURCE.with_name('cost-process-control-v2.py')

def digest(p):
    data = p.read_bytes(); return {'path': str(p), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def load():
    spec = importlib.util.spec_from_file_location('temporary_lot5c_orchestrator', SOURCE)
    mod = importlib.util.module_from_spec(spec); sys.modules[spec.name] = mod; spec.loader.exec_module(mod)
    return mod

class Cases(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='lot5c-orchestration-test-')
        self.m = m = load(); root = Path(self.tmp.name)
        m.ROOT = root; m.SHARED = root / 'shared'; m.SHARED.mkdir()
        m.BASE = root / 'proofs'; m.PLAN = m.BASE / 'planning'; m.PLAN.mkdir(parents=True)
        m.COORD = m.BASE / 'coordination'; m.COORD.mkdir(); m.PERF = m.BASE / 'performance'; m.PERF.mkdir()
        m.OWN = m.SHARED / 'lot5c-status.json'; m.REVIEW = m.PLAN / 'review.json'
        module_source=m.PLAN/'synthetic-orchestrator.py';module_source.write_bytes(SOURCE.read_bytes());m.__file__=str(module_source)
        m.OWN_CLOSURE = m.BASE / 'own-closure.json'; m.REGISTRY = m.SHARED / 'registry.json'
        m.PROCESS_HELPER = HELPER; m.process_helper().enable_subreaper()
        m.FINALIZER = m.PLAN / 'fake-finalizer.py'; m.CONTROLLER = m.PLAN / 'fake-controller.py'
        m.FINALIZER.write_text("from pathlib import Path\nPath(" + repr(str(m.PERF / 'readiness.json')) + ").write_text('{\"synthetic\": true}')\n")
        m.CONTROLLER.write_text('raise SystemExit(7)\n')
        (m.SHARED / 'performance.lock').touch(); (m.PERF / 'declaration.json').write_text('{}')
        self.closure = {'schema':'logos-engine.lot5c-own-cost-quiet-closure.v1', 'requestId':m.REQUEST,
            'status':'all_own_processes_and_workers_idle','recordedAt':m.stamp(),'ownTrackedComputeEnded':True,
            'activeCommand':None,'noQueuedCommands':True,'previewStopped':True,'browserTabClosed':True,
            'workers':[{'agent':n,'activeCommand':None,'observedTerminal':True,'noQueuedCommands':True,
                'toolsAndReadsStoppedUntilExplicitRelease':True} for n in ('lot5_cost_protocol_audit','lot5_scope_preview','lot5_site101_merge_audit')]}
        self.write(m.OWN_CLOSURE,self.closure); self.write(m.REVIEW,{'synthetic':True})
        self.write(m.OWN, {'quiet_requested':False, 'all_own_subagents_idle':True,'no_queued_commands':True})
        for lane in m.LANES:
            self.write(m.SHARED / (lane+'-status.json'), {'quiet_request_id':'old-request','quiet_acknowledged':True})
        self.actual_preflight = m.preflight
        m.preflight = lambda: ({'synthetic':True}, self.closure)
        m.AVAILABILITY_SECONDS = 0.15
        self.threads = [];self.stop=threading.Event();self.main_outputs=[]
    def tearDown(self):
        self.stop.set()
        for thread in self.threads:
            thread.join(timeout=1)
            self.assertFalse(thread.is_alive(), 'No synthetic writer thread may remain')
        self.tmp.cleanup()
    def write(self,path,value):
        path.write_text(json.dumps(value))
    def fresh(self):
        m=self.m; now=m.stamp()
        return {'quiet_request_id':m.REQUEST,'quiet_acknowledged':True,'quiet_acknowledged_at':now,'updated_at':now,
            'active_command':None,'heavy_execution_active':False,'all_own_subagents_idle':True,'no_queued_commands':True}
    def acquire_temp_ex(self):
        with (self.m.SHARED / 'performance.lock').open('r+') as f:
            fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB);fcntl.flock(f,fcntl.LOCK_UN)
    def call_main(self):
        old=sys.argv; sys.argv=[str(SOURCE),'--execute']
        try:
            buffer=io.StringIO()
            with contextlib.redirect_stdout(buffer):code=self.m.main()
            self.main_outputs.append(buffer.getvalue());return code
        finally:sys.argv=old
    def async_ack(self, signal_stage=None):
        m=self.m
        def worker():
            deadline=time.monotonic()+3
            while not (m.COORD/'request.json').exists() and time.monotonic()<deadline and not self.stop.is_set():time.sleep(.003)
            if not (m.COORD/'request.json').exists() or self.stop.is_set():return
            for lane in m.LANES:
                data=self.fresh();p=m.SHARED/(lane+'-status.json');tmp=p.with_suffix('.new');self.write(tmp,data);os.replace(tmp,p)
            if signal_stage:
                target=m.COORD/(signal_stage+'-started.json')
                while not target.exists() and time.monotonic()<deadline and not self.stop.is_set():time.sleep(.003)
                if target.exists() and not self.stop.is_set():os.kill(os.getpid(),signal.SIGTERM)
        t=threading.Thread(target=worker);t.start();self.threads.append(t)
    def request(self, seconds=.3):
        m=self.m;now=datetime.datetime.now(datetime.timezone.utc)
        return {'requestedAt':now.isoformat(),'availabilityDeadline':(now+datetime.timedelta(seconds=seconds)).isoformat()}
    def test_old_incomplete_future_ack_refused(self):
        m=self.m;at=datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(seconds=1)
        d=self.fresh();self.assertTrue(m.ack_valid(d,at))
        d['quiet_request_id']='old-request';self.assertFalse(m.ack_valid(d,at))
        d=self.fresh();d['all_own_subagents_idle']=False;self.assertFalse(m.ack_valid(d,at))
        d=self.fresh();d['quiet_acknowledged_at']=(at+datetime.timedelta(hours=1)).isoformat();self.assertFalse(m.ack_valid(d,at))
    def test_timeout_releases_and_one_cycle_only(self):
        m=self.m;self.assertEqual(self.call_main(),124);self.assertFalse(m.read(m.OWN)['quiet_requested'])
        original=(m.COORD/'request.json').read_bytes();self.assertTrue((m.COORD/'attempt-sentinel.json').exists())
        self.assertEqual(self.call_main(),1);self.assertEqual(original,(m.COORD/'request.json').read_bytes())
        self.assertFalse((m.PERF/'readiness.json').exists());self.assertFalse((m.PERF/'window.json').exists());self.acquire_temp_ex()
    def test_fresh_raw_acks_then_controller_refusal_release(self):
        m=self.m;m.AVAILABILITY_SECONDS=3;self.async_ack()
        self.assertEqual(self.call_main(),1);self.assertFalse(m.read(m.OWN)['quiet_requested'])
        iso=m.read(m.COORD/'isolation.json');self.assertEqual(len(iso['knownLanes']),3)
        for row in iso['knownLanes']:
            self.assertEqual(m.fp(m.ROOT/row['evidence']['path']),row['evidence'])
            self.assertEqual((m.COORD/(row['lane']+'-ack.json')).read_bytes(),(m.SHARED/(row['lane']+'-status.json')).read_bytes())
        self.assertTrue((m.PERF/'readiness.json').exists());self.assertFalse((m.PERF/'window.json').exists());self.acquire_temp_ex()
    def test_child_timeout_cleans_descendant_and_shared_lock(self):
        m=self.m;marker=m.ROOT/'descendant.json';script=m.ROOT/'owned-sleep.py'
        script.write_text("import subprocess,sys,signal,time,json,os\nfrom pathlib import Path\nsignal.signal(signal.SIGTERM,signal.SIG_IGN)\np=subprocess.Popen([sys.executable,'-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(30)'])\nPath("+repr(str(marker))+").write_text(json.dumps({'leader':os.getpid(),'descendant':p.pid}))\ntime.sleep(30)\n")
        with self.assertRaises(TimeoutError):
            with m.shared_lock():m.run_child('readiness',[sys.executable,str(script)],self.request(.4))
        for pid in m.read(marker).values():
            with self.assertRaises(ProcessLookupError):os.kill(pid,0)
        self.acquire_temp_ex();self.assertTrue(m.read(m.COORD/'readiness-execution.json')['cleanup']['terminal'])
    def test_signal_during_readiness_releases_and_closes(self):
        m=self.m;m.AVAILABILITY_SECONDS=3;m.FINALIZER.write_text('import time\ntime.sleep(30)\n');self.async_ack('readiness')
        self.assertEqual(self.call_main(),130);self.assertFalse(m.read(m.OWN)['quiet_requested']);self.acquire_temp_ex()
        self.assertTrue(m.read(m.COORD/'readiness-execution.json')['cleanup']['terminal'])
    def test_started_receipt_write_error_still_cleans(self):
        m=self.m;old=m.save_new
        def fail(path,value):
            if str(path).endswith('-started.json'):raise OSError('synthetic_write_failure')
            return old(path,value)
        m.save_new=fail
        with self.assertRaises(OSError):
            with m.shared_lock():m.run_child('readiness',[sys.executable,'-c','import time;time.sleep(30)'],self.request(2))
        receipt=m.read(m.COORD/'readiness-execution.json');self.assertTrue(receipt['cleanup']['terminal'])
        with self.assertRaises(ProcessLookupError):os.kill(receipt['childPid'],0)
        self.acquire_temp_ex()
    def test_terminal_receipt_failure_cannot_keep_quiet(self):
        m=self.m;old=m.save_new
        def fail(path,value):
            if Path(path).name=='attempt-result.json':raise OSError('synthetic_receipt_failure')
            return old(path,value)
        m.save_new=fail;self.assertEqual(self.call_main(),1);self.assertFalse(m.read(m.OWN)['quiet_requested']);self.acquire_temp_ex()
    def test_foreign_controller_lease_refused(self):
        m=self.m;p=m.COORD/'window-lease.json';lease={'requestId':'wrong','status':'exclusive_acquired','controllerPid':0}
        code='from pathlib import Path;import time;Path('+repr(str(p))+').write_text('+repr(json.dumps(lease))+');time.sleep(30)'
        with self.assertRaises(ValueError):m.run_child('controller',[sys.executable,'-c',code],self.request(2))
        self.assertTrue(m.read(m.COORD/'controller-execution.json')['cleanup']['terminal'])
    def test_active_window_uses_its_separate_deadline(self):
        m=self.m;m.WINDOW_SECONDS=2;p=m.COORD/'window-lease.json'
        code="from pathlib import Path\nimport os,json,time,datetime\nn=datetime.datetime.now(datetime.timezone.utc)\nd={'requestId':"+repr(m.REQUEST)+",'status':'exclusive_acquired','controllerPid':os.getpid(),'lockAcquiredAt':n.isoformat(),'windowDeadline':(n+datetime.timedelta(seconds=1)).isoformat()}\nPath("+repr(str(p))+").write_text(json.dumps(d))\ntime.sleep(.4)\n"
        with contextlib.redirect_stdout(io.StringIO()):outcome=m.run_child('controller',[sys.executable,'-c',code],self.request(.25))
        self.assertEqual(outcome['exitCode'],0)
        self.assertTrue(outcome['cleanup']['terminal'])

    def test_monotonic_expiry_when_wall_clock_stops(self):
        m=self.m;fixed=datetime.datetime.now(datetime.timezone.utc)
        class FrozenDateTime(datetime.datetime):
            @classmethod
            def now(cls,tz=None):return fixed
        m.datetime=FrozenDateTime;start=time.monotonic()
        self.assertEqual(self.call_main(),124);self.assertLess(time.monotonic()-start,1)
        self.assertFalse(m.read(m.OWN)['quiet_requested']);self.acquire_temp_ex()
    def test_signal_between_spawn_and_assignment_is_cleaned(self):
        m=self.m;real=m.subprocess.Popen;captured=[]
        def launch(*a,**kw):
            proc=real(*a,**kw);captured.append(proc);m.signal_handler(signal.SIGTERM,None);return proc
        m.subprocess.Popen=launch
        try:
            with self.assertRaises(m.Interrupted):
                with m.shared_lock():m.run_child('readiness',[sys.executable,'-c','import time;time.sleep(30)'],self.request(2))
        finally:m.subprocess.Popen=real
        self.assertEqual(len(captured),1);self.assertIsNotNone(captured[0].poll());self.acquire_temp_ex()
        self.assertTrue(m.read(m.COORD/'readiness-execution.json')['cleanup']['terminal'])
    def test_cleanup_error_still_checks_registry_and_never_claims_idle(self):
        m=self.m;real=m.cleanup_group;called=[]
        def cleanup(proc):real(proc);raise OSError('synthetic_cleanup_reporting_failure')
        m.cleanup_group=cleanup;m.cleanup_controller_registry=lambda pid: called.append(pid) or []
        with self.assertRaises(ValueError):m.run_child('controller',[sys.executable,'-c','pass'],self.request(2))
        self.assertEqual(len(called),1);self.assertFalse(m._CLEANUP_CONFIRMED)
        self.write(m.OWN,{'quiet_request_id':m.REQUEST,'quiet_requested':True});m.release('synthetic_failed_cleanup')
        state=m.read(m.OWN);self.assertFalse(state['quiet_requested']);self.assertIsNotNone(state['active_command'])
        self.assertIsNone(state['heavy_execution_active']);self.assertFalse(state['cleanup_confirmed'])
    def test_malformed_review_counts_and_duplicate_subjects_refused(self):
        m=self.m;review={'schema':'logos-engine.lot5c-coordination-v2-independent-review.v1','status':'passed',
            'checksPassed':1,'checksTotal':1,'checks':[],'subjects':[]}
        self.write(m.REVIEW,review)
        with self.assertRaisesRegex(ValueError,'Every review check'):self.actual_preflight()
        review['checks']=[{'passed':True}];review['subjects']=[{'path':'same'},{'path':'same'}];self.write(m.REVIEW,review)
        with self.assertRaisesRegex(ValueError,'Duplicate review subjects'):self.actual_preflight()
        self.acquire_temp_ex()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',required=True,type=Path);args=parser.parse_args()
    before=[digest(SOURCE),digest(HELPER),digest(Path(__file__))];started=datetime.datetime.now(datetime.timezone.utc).isoformat()
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(Cases);buffer=io.StringIO();result=unittest.TextTestRunner(stream=buffer,verbosity=2).run(suite)
    after=[digest(SOURCE),digest(HELPER),digest(Path(__file__))];receipt={'schema':'logos-engine.lot5c-orchestration-temporary-tests.v1','status':'passed' if result.wasSuccessful() and before==after else 'failed','startedAt':started,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'casesRun':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),'sourceBefore':before,'sourceAfter':after,'inputsUnchanged':before==after,'onlyTemporaryMutexAndStatuses':True,'actualCostExecuted':False,'nativeTestsExecuted':False,'runnerOutput':buffer.getvalue()}
    with args.output.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
    print(json.dumps({k:v for k,v in receipt.items() if k not in ['runnerOutput','sourceBefore','sourceAfter']}));print(buffer.getvalue())
    sys.exit(0 if receipt['status']=='passed' else 1)
