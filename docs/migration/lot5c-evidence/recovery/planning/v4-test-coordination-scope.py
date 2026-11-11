#!/usr/bin/env python3
"""TEMP-only tests for mutex-free preparation and ABBA-only exclusivity.

All coordination files and tested mutexes are synthetic under TemporaryDirectory.
The parent/controller production launchers are replaced by explicit test stubs;
no native runtime, real peer status, production lock or actual readiness is used.
"""
import contextlib
from datetime import datetime, timedelta, timezone
import fcntl
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True

def load(path):
    path = Path(path)
    spec = importlib.util.spec_from_file_location(path.stem.replace('-', '_'), path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value))

legacy = load(HERE / 'test-cost-orchestration-v2.py')
legacy_load = legacy.load
legacy.load = lambda name: load(HERE / 'run-coordinated-cost-5c-v4.py') if name == 'run-coordinated-cost-5c-v2.py' else legacy_load(name)

class ScopeTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='lot5c-v4-SYNTHETIC-')
        self.root = Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def parent(self):
        source = self.root / 'docs/migration/lot5c-evidence/recovery/planning/orchestrate-cost-available-03-v4.py'
        source.parent.mkdir(parents=True)
        source.write_bytes((HERE / source.name).read_bytes())
        module = load(source)
        module.SHARED = self.root / 'shared'; module.SHARED.mkdir()
        module.OWN = module.SHARED / 'lot5c-status.json'
        module.REGISTRY = module.SHARED / 'SYNTHETIC-registry.json'
        for path in (module.FINALIZER, module.CONTROLLER, module.PROCESS_HELPER, module.AMENDMENT):
            path.write_text('SYNTHETIC placeholder, never executed')
        now = datetime.now(timezone.utc)
        review = {'schema':'logos-engine.lot5c-coordination-v4-independent-review.v1','status':'passed',
            'recordedAt':(now-timedelta(seconds=2)).isoformat(),'checksPassed':1,'checksTotal':1,
            'checks':[{'passed':True}], 'subjects':[module.fp(q) for q in
                (source,module.FINALIZER,module.CONTROLLER,module.PROCESS_HELPER,module.AMENDMENT)]}
        write(module.REVIEW,review)
        write(module.OWN_CLOSURE,{'requestId':module.REQUEST,'status':'all_own_processes_and_workers_idle',
            'recordedAt':(now-timedelta(seconds=1)).isoformat(),'ownTrackedComputeEnded':True,
            'noQueuedCommands':True,'previewStopped':True,'workers':[{'agent':n,'observedTerminal':True,
                'activeCommand':None,'noQueuedCommands':True} for n in
                ('lot5_cost_protocol_audit','lot5_scope_preview','lot5_site101_merge_audit')]})
        write(module.OWN,{'all_own_subagents_idle':True,'no_queued_commands':True,'quiet_requested':False})
        write(module.PERF/'static-preflight.json',{'status':'static_inputs_checked'})
        for lane in module.LANES:
            write(module.SHARED/(lane+'-status.json'),{'official_performance_active':False,
                'quiet_requested':True,'active_command':'SYNTHETIC ordinary work',
                'publication_started':True,'publication_completed':False,'publication_waiting_for_predecessor':True})
        return module

    def test_exact_shared_active_performance_predicate(self):
        module=self.parent()
        cases=[({},False),({'official_performance_active':True},True),
            ({'official_performance_active':False,'performance_started':'obsolete malformed value'},False),
            ({'official_performance_active':None,'performance_started':True},True),
            ({'performance_started':True,'quiet_released':True},False),
            ({'performance_started':True,'quiet_released':False},True),
            ({'performance_started':False,'publication_started':True,'quiet_requested':True},False),
            ({'publication_started':True,'publication_waiting_for_predecessor':True},False)]
        for value,expected in cases:
            with self.subTest(value=value):self.assertIs(module.official_performance_active(value),expected)
        for value in ({'official_performance_active':1},{'performance_started':'true'},{'quiet_released':0}):
            with self.subTest(malformed=value):
                with self.assertRaises(ValueError):module.official_performance_active(value)

    def test_preflight_allows_ordinary_and_publication_without_mutex(self):
        module=self.parent();self.assertFalse((module.SHARED/'performance.lock').exists())
        review,closure=module.preflight()
        self.assertEqual(review['status'],'passed');self.assertTrue(closure['ownTrackedComputeEnded'])
        self.assertFalse((module.SHARED/'performance.lock').exists())
        self.assertFalse((module.COORD/'request.json').exists())

    def test_preflight_refuses_only_actual_foreign_performance(self):
        module=self.parent();write(module.SHARED/'lot8a-status.json',{'official_performance_active':True})
        with self.assertRaisesRegex(ValueError,'Foreign official performance'):module.preflight()
        self.assertFalse((module.SHARED/'performance.lock').exists())

    def test_parent_readiness_has_no_mutex_and_delegates_exclusivity(self):
        module=self.parent();calls=[]
        module.process_helper=lambda:types.SimpleNamespace(enable_subreaper=lambda:None)
        module.wait_and_isolate=lambda request,closure: {'SYNTHETIC':True}
        def child(label,argv,request):
            self.assertFalse((module.SHARED/'performance.lock').exists())
            calls.append((label,argv));return {'exitCode':0}
        module.run_child=child
        with patch.object(sys,'argv',['SYNTHETIC-parent','--execute']),contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(module.main(),0)
        self.assertEqual([row[0] for row in calls],['readiness','controller'])
        self.assertIn(str(module.FINALIZER),calls[0][1]);self.assertIn(str(module.CONTROLLER),calls[1][1])
        self.assertIn('--availability-deadline',calls[1][1]);self.assertFalse((module.SHARED/'performance.lock').exists())
        self.assertTrue(json.loads(module.OWN.read_text())['quiet_released'])

    def controller(self, abba_exit=0, fail_release_receipt=False):
        fixture=legacy.LifecycleTests(methodName='runTest');fixture.setUp()
        self.addCleanup(fixture.tearDown)
        module,deadline,_=fixture.controller_fixture()
        module.AMENDMENT=fixture.root/'SYNTHETIC-amendment.json';write(module.AMENDMENT,{'SYNTHETIC':True})
        amendment=module.fingerprint(module.AMENDMENT)
        request=json.loads((module.COORD/'request.json').read_text());request['coordinationAmendment']=amendment;write(module.COORD/'request.json',request)
        isolation=json.loads((module.COORD/'isolation.json').read_text());isolation['request']=module.fingerprint(module.COORD/'request.json');write(module.COORD/'isolation.json',isolation)
        ready=json.loads((module.PERF/'readiness.json').read_text());ready['coordinationAmendment']=amendment
        ready['inputs']=[module.fingerprint(p) for p in (module.COORD/'isolation.json',Path(module.__file__),module.HELPER,module.AMENDMENT)];write(module.PERF/'readiness.json',ready)
        stages=[];sealed=[]
        def can_acquire():
            fd=os.open(module.SHARED/'performance.lock',os.O_RDWR|os.O_CLOEXEC)
            try:
                try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);return True
                except BlockingIOError:return False
            finally:os.close(fd)
        def run(command,**kwargs):
            stages.append(command)
            own=json.loads((module.SHARED/'lot5c-status.json').read_text())
            if 'scripts/run-native-cost-window.py' in command:
                self.assertFalse(can_acquire());self.assertTrue(own['official_performance_active'])
                window={'status':'passed' if abba_exit==0 else 'failed','finalIntegrity':'passed' if abba_exit==0 else 'failed',
                    'plannedOrder':['A1','B1','B2','A2'],'executions':[{'label':x,'status':'passed','exitCode':0} for x in ('A1','B1','B2','A2')]}
                write(module.PERF/'window.json',window)
                return {'exitCode':abba_exit,'cleanup':{'terminal':True}}
            self.assertIn('scripts/compare-native-loop-costs.mjs',command)
            self.assertTrue(can_acquire());self.assertFalse(own['official_performance_active'])
            self.assertFalse(own['quiet_requested']);self.assertTrue(own['heavy_execution_active']);self.assertIsNotNone(own['active_command'])
            release=json.loads((module.COORD/'measurement-release.json').read_text())
            self.assertEqual(release['status'],'abba_terminal_integrity_passed_exclusive_and_quiet_released')
            current=module.fingerprint(module.COORD/'quiet-observations.jsonl')
            self.assertEqual(current,release['sealedQuietObservations']);sealed.append(current)
            # Ordinary peer activity after the sample interval must no longer invalidate old ACKs.
            for lane in module.LANES:write(module.SHARED/(lane+'-status.json'),{'official_performance_active':False,'quiet_acknowledged':False,'active_command':'SYNTHETIC ordinary resumed work'})
            return {'exitCode':0 if len(stages)==2 else 1,'cleanup':{'terminal':True}}
        module.lifecycle=lambda:types.SimpleNamespace(enable_subreaper=legacy.H.enable_subreaper,Registry=legacy.H.Registry,
            run_owned=run,terminate_owned_group=legacy.H.terminate_owned_group)
        if fail_release_receipt:
            original=module.exclusive
            def fail(path,value):
                if Path(path)==module.COORD/'measurement-release.json':raise OSError('SYNTHETIC release journal failure')
                return original(path,value)
            module.exclusive=fail
        return module,deadline,stages,sealed,can_acquire

    def test_controller_releases_after_abba_before_ordinary_comparisons(self):
        module,deadline,stages,sealed,can_acquire=self.controller()
        with contextlib.redirect_stdout(io.StringIO()):self.assertEqual(module.main(['--execute','--availability-deadline',deadline]),1)
        self.assertEqual(len(stages),3) # Synthetic second comparator deliberately stops further analysis.
        self.assertEqual(len(sealed),2);self.assertEqual(sealed[0],sealed[1]);self.assertTrue(can_acquire())
        release=json.loads((module.COORD/'measurement-release.json').read_text());final=json.loads((module.COORD/'lock-window.json').read_text())
        self.assertEqual(final['lockReleasedAt'],release['lockReleasedAt']);self.assertEqual(final['descriptorClosedAt'],release['descriptorClosedAt'])
        self.assertEqual(final['quietReleasedAt'],release['quietReleasedAt']);self.assertEqual(final['exclusiveAttempts'],1)
        self.assertEqual(module.fingerprint(module.COORD/'quiet-observations.jsonl'),release['sealedQuietObservations'])

    def test_failed_abba_cleans_without_successful_measurement_release_claim(self):
        module,deadline,stages,_,can_acquire=self.controller(abba_exit=1)
        with contextlib.redirect_stdout(io.StringIO()):self.assertEqual(module.main(['--execute','--availability-deadline',deadline]),1)
        self.assertEqual(len(stages),1);self.assertTrue(can_acquire());self.assertFalse((module.COORD/'measurement-release.json').exists())
        own=json.loads((module.SHARED/'lot5c-status.json').read_text());self.assertFalse(own['official_performance_active']);self.assertFalse(own['quiet_requested'])

    def test_release_receipt_failure_cannot_retain_ex_or_retime_release(self):
        module,deadline,stages,_,can_acquire=self.controller(fail_release_receipt=True)
        with contextlib.redirect_stdout(io.StringIO()):self.assertEqual(module.main(['--execute','--availability-deadline',deadline]),1)
        self.assertEqual(len(stages),1);self.assertTrue(can_acquire())
        own=json.loads((module.SHARED/'lot5c-status.json').read_text());final=json.loads((module.COORD/'lock-window.json').read_text())
        self.assertFalse(own['official_performance_active']);self.assertFalse(own['quiet_requested'])
        self.assertEqual(final['quietReleasedAt'],own['quiet_released_at']);self.assertIsNotNone(final['lockReleasedAt'])

if __name__=='__main__':
    unittest.main(verbosity=2)
