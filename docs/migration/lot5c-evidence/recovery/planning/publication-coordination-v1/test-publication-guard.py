#!/usr/bin/env python3
"""Independent TEMP-mutex guardian tests; no provider, Git, source helper, or production EX."""
from __future__ import annotations
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone

HERE=Path(__file__).resolve().parent
GUARD=HERE/'publication-guard.py'
spec=importlib.util.spec_from_file_location('publication_guard_test_api',GUARD)
module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
RUNNER=r"""
import importlib.util,json,pathlib,sys
value=json.loads(pathlib.Path(sys.argv[1]).read_text())
spec=importlib.util.spec_from_file_location('publication_guard_temporary',value.pop('module'))
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
for name in ('run_dir','lock_path','ledger_path'): value[name]=pathlib.Path(value[name])
raise SystemExit(m.hold(m.Config(**value)))
"""


def stamp():return datetime.now(timezone.utc).isoformat()
def fingerprint(path):
 raw=path.read_bytes();return {'file':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
def production_quiet_check():
 for lane in ('lot5c','lot6b','lot8a','lot10c'):
  value=json.loads((Path('/workspace/shared/sra-coordination')/(lane+'-status.json')).read_bytes())
  if value.get('quiet_requested') is True:raise RuntimeError('new_quiet_request_stop_tests')
def acquire_temp_ex(path):
 fd=os.open(path,os.O_RDWR|os.O_CLOEXEC)
 try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:os.close(fd);return None
 return fd
def release_temp(fd):
 fcntl.flock(fd,fcntl.LOCK_UN);os.close(fd)
def wait_held(process,run,request):
 deadline=time.monotonic()+2
 while time.monotonic()<deadline:
  if process.poll() is not None:raise RuntimeError('guard_exited_before_held')
  try:return module.inspect_run(run,request)
  except (OSError,ValueError,KeyError,module.GuardError):time.sleep(.01)
 raise RuntimeError('guard_initial_ack_timeout')
def terminal(process,run):
 code=process.wait(timeout=3)
 output=process.stdout.read(8192).decode()
 path=run/'terminal.json'
 value=json.loads(path.read_text()) if path.exists() else None
 return code,value,output

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--report',type=Path,required=True);args=parser.parse_args()
 if args.report.exists():raise SystemExit('Test receipt already exists')
 report={'schema':'logos-engine.lot5c.publication-guard-independent-tests.v1','status':'running','startedAt':stamp(),
         'guardian':fingerprint(GUARD),'harness':fingerprint(Path(__file__)),
         'temporaryMutexOnly':True,'productionPublicationMutexAcquired':False,
         'actualProviderCalls':0,'actualSourceOrGitCommands':0,'productionEvidenceCreated':False,'cases':[]}
 processes=[]
 try:
  with tempfile.TemporaryDirectory(prefix='lot5-publication-guard-temporary-') as temp:
   root=Path(temp);runner=root/'runner.py';runner.write_text(RUNNER)
   def start(name,*,duration=.8,lock=None,ledger=None,reconcile=False,request=None,expected_inode=None):
    folder=root/name;folder.mkdir(exist_ok=True)
    mutex=lock or folder/'test-only.lock'
    if lock is None:mutex.write_bytes(b'')
    metadata=mutex.stat() if mutex.exists() else None
    cfg={'module':str(GUARD),'run_dir':str(folder/'run'),'request_id':request or 'test-only-'+name,
         'lock_path':str(mutex),'ledger_path':str(ledger or folder/'test-only-ledger.json'),
         'expected_device':metadata.st_dev if metadata else 0,
         'expected_inode':expected_inode if expected_inode is not None else metadata.st_ino if metadata else 0,
         'duration':duration,'reconcile_only':reconcile}
    path=folder/('config-'+str(len(processes))+'.json');path.write_text(json.dumps(cfg))
    p=subprocess.Popen([sys.executable,'-B',str(runner),str(path)],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,close_fds=True,start_new_session=True)
    processes.append(p)
    return p,Path(cfg['run_dir']),mutex,Path(cfg['ledger_path']),cfg['request_id']
   def case(name,checks,details):
    row={'name':name,'passed':all(checks.values()),'checks':[{'name':k,'passed':bool(v)} for k,v in checks.items()],'details':details}
    report['cases'].append(row);print(json.dumps({'case':name,'passed':row['passed']}),flush=True)
    if not row['passed']:raise RuntimeError('independent_assertion_failed')
   production_quiet_check()
   folder=root/'refused';folder.mkdir();lock=folder/'held.lock';lock.write_bytes(b'')
   owner=acquire_temp_ex(lock)
   try:
    p,run,mutex,ledger,request=start('refused',lock=lock)
    code,end,_=terminal(p,run)
    case('one_nonblocking_refusal',{'exit_nonzero':code==1,'one_attempt':end['lockAttemptCount']==1,'never_acquired':not end['lockAcquired'],
      'exact_reason':end.get('reason')=='publication_lock_unavailable','no_provider_record':not ledger.exists()},end)
   finally:release_temp(owner)
   production_quiet_check()
   missing=root/'does-not-exist.lock'
   p,run,mutex,ledger,request=start('missing',lock=missing)
   code,end,_=terminal(p,run)
   case('absent_mutex_never_created',{'exit_nonzero':code==1,'absent_still':not missing.exists(),'zero_attempts':end['lockAttemptCount']==0,'never_acquired':not end['lockAcquired']},end)
   production_quiet_check()
   p,run,mutex,ledger,request=start('deadline',duration=.25)
   held=wait_held(p,run,request);blocked=acquire_temp_ex(mutex)
   if blocked is not None:release_temp(blocked)
   code,end,_=terminal(p,run);fd=acquire_temp_ex(mutex);free=fd is not None
   if fd is not None:release_temp(fd)
   case('fixed_deadline_and_unlock',{'held_exclusively':blocked is None,'exit124':code==124,'expired':end['state']=='expired','released':end['lockReleased'],
      'reacquired':free,'no_child':end['childProcessesSpawned'] is False,'fd_noninheritable':end['lockDescriptorInheritable'] is False,'provider_not_cancelled':not end['providerCancellationClaimed']},end)
   for sig in (signal.SIGTERM,signal.SIGINT):
    production_quiet_check()
    p,run,mutex,ledger,request=start('signal-'+signal.Signals(sig).name,duration=2)
    wait_held(p,run,request);os.kill(p.pid,sig)
    code,end,_=terminal(p,run);fd=acquire_temp_ex(mutex);free=fd is not None
    if fd is not None:release_temp(fd)
    case('catch_'+signal.Signals(sig).name,{'exact_exit':code==128+sig,'interrupted':end['state']=='interrupted','signal_recorded':end['receivedSignal']==signal.Signals(sig).name,'released':end['lockReleased'],'reacquired':free},end)
   production_quiet_check()
   p,run,mutex,ledger,request=start('journal-error',duration=2)
   wait_held(p,run,request)
   (run/'guard.json').unlink();(run/'guard.json').mkdir()
   code,end,_=terminal(p,run);fd=acquire_temp_ex(mutex);free=fd is not None
   if fd is not None:release_temp(fd)
   case('journal_failure_still_unlocks',{'failed':code==1,'fallback_terminal_exists':end is not None,'reason_retained':end.get('reason')=='journal_or_system_error','released':end['lockReleased'],'reacquired':free},end)
   production_quiet_check()
   p,run,mutex,ledger,request=start('normal-release',duration=2)
   wait_held(p,run,request)
   module.durable_json(run/'release.json',{'schema':'logos-engine.publication-release.v1','requestId':request,'reason':'completed'},exclusive=True)
   code,end,_=terminal(p,run);before=(run/'guard.json').read_bytes();terminal_before=(run/'terminal.json').read_bytes()
   p2,run2,_,_,_=start('normal-release',lock=mutex,duration=.5)
   code2=p2.wait(timeout=2)
   case('normal_release_and_reuse_refusal',{'release_success':code==0 and end['state']=='released','released':end['lockReleased'],'reuse_refused':code2==1,
      'old_journal_unchanged':(run2/'guard.json').read_bytes()==before,'old_terminal_unchanged':(run2/'terminal.json').read_bytes()==terminal_before},end)
   production_quiet_check()
   p,run,mutex,ledger,request=start('uncertain',duration=.65)
   wait_held(p,run,request)
   begin=module.send_progress(run,request,{'event':'begin','operationId':'test-only-publication-operation','operation':'save_and_deploy_private','commitSha':'a'*40,'archiveSha256':'b'*64})
   durable_before_api=json.loads(ledger.read_text())
   pending=module.send_progress(run,request,{'event':'update','operationId':'test-only-publication-operation','status':'publishing','versionId':'test-only-version','deploymentId':'test-only-deployment'})
   code,end,_=terminal(p,run);saved=ledger.read_bytes()
   p2,run2,_,_,request2=start('blocked-next-run',lock=mutex,ledger=ledger,duration=.5)
   code2,end2,_=terminal(p2,run2)
   case('uncertain_provider_operation_retained_and_blocks_repeat',{'begin_ack':begin['acceptedProgressSequence']==1,
      'durable_before_any_simulated_provider_step':durable_before_api['unresolved'] is True,'native_ids_retained':json.loads(saved)['operation'].get('deploymentId')=='test-only-deployment',
      'expired':code==124,'follow_up_required':end['followUpRequired'],'next_run_refused':code2==1 and end2.get('reason')=='prior_provider_operation_unresolved',
      'ledger_unchanged_by_refusal':ledger.read_bytes()==saved,'expired_not_provider_cancellation':end['providerCancellationClaimed'] is False},end)
   production_quiet_check()
   evidence=root/'explicitly-test-only-provider-receipt.json';evidence.write_text(json.dumps({'testOnly':True,'noActualProviderCalled':True,'status':'failed'}))
   p,run,mutex,ledger,request=start('reconcile',lock=mutex,ledger=ledger,duration=2,reconcile=True)
   wait_held(p,run,request)
   update=module.send_progress(run,request,{'event':'update','operationId':'test-only-publication-operation','status':'failed',
       'evidencePath':str(evidence),'evidenceSha256':hashlib.sha256(evidence.read_bytes()).hexdigest()})
   module.durable_json(run/'release.json',{'schema':'logos-engine.publication-release.v1','requestId':request,'reason':'completed'},exclusive=True)
   code,end,_=terminal(p,run)
   case('explicit_reconciliation_metadata_protocol',{'update_ack':update['acceptedProgressSequence']==1,'known_result_clears_block':json.loads(ledger.read_text())['unresolved'] is False,
      'release_success':code==0,'no_actual_provider':True,'evidence_fingerprint_bound':'evidence' in json.loads(ledger.read_text())['operation']},end)
   production_quiet_check()
   p,run,mutex,ledger,request=start('wrong-inode',duration=.5,expected_inode=0)
   code,end,_=terminal(p,run)
   case('existing_mutex_identity_mismatch_refused',{'failed':code==1,'zero_lock_attempts':end['lockAttemptCount']==0,'not_acquired':not end['lockAcquired'],'reason':end.get('reason')=='existing_mutex_identity_mismatch'},end)
   report['status']='passed'
 except BaseException as error:
  report['status']='failed';report['failureClass']=type(error).__name__
  report['failureCode']=str(error) if str(error) in ('new_quiet_request_stop_tests','guard_exited_before_held','guard_initial_ack_timeout','independent_assertion_failed') else 'test_harness_error'
 finally:
  for p in processes:
   if p.poll() is None:
    os.kill(p.pid,signal.SIGTERM)
    try:p.wait(timeout=2)
    except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=2)
   if p.stdout:p.stdout.close()
  report['allOwnedTestProcessesTerminal']=all(p.poll() is not None for p in processes)
  report['finishedAt']=stamp();report['caseCount']=len(report['cases'])
  report['passedChecks']=sum(c['passed'] for row in report['cases'] for c in row['checks'])
  report['totalChecks']=sum(len(row['checks']) for row in report['cases'])
  with args.report.open('x') as f:json.dump(report,f,indent=2);f.write('\n')
 print(json.dumps({key:report[key] for key in ('status','caseCount','passedChecks','totalChecks','allOwnedTestProcessesTerminal')}),flush=True)
 return 0 if report['status']=='passed' else 1


if __name__=='__main__':raise SystemExit(main())
