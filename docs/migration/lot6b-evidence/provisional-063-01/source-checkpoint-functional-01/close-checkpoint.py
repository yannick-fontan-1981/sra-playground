#!/usr/bin/env python3
"""Commit one bounded, explicitly scoped documentary closure; never push."""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
import argparse, fcntl, hashlib, json, os, re, signal, stat, subprocess, time
ROOT=Path('/workspace/sites/sra-lot6b-20261111/.sites-checkout')
BASE=ROOT/'docs/migration/lot6b-evidence/provisional-063-01/source-checkpoint-functional-01'
COORD=Path('/workspace/shared/sra-coordination')
PREFIXES=('docs/migration/lot6b-evidence/provisional-063-01/source-checkpoint-functional-01/','docs/migration/lot6b-evidence/provisional-063-01/klot-fa23-01/browser-qa-02/')
DOCUMENTS={'docs/migration/v6-delivery-roadmap.md','docs/migration/lot6b-selected-rigid.md','docs/migration/lot6b-selected-rigid-lineage.md','docs/migration/lot6b-evidence/klot-case-clock.json'}
def utc():return datetime.now(timezone.utc).isoformat()
def fp(name):
 p=ROOT/name
 assert PurePosixPath(name).as_posix()==name and not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts
 cursor=ROOT
 for part in PurePosixPath(name).parts:
  cursor=cursor/part;assert not cursor.is_symlink()
 assert p.is_file() and (name in DOCUMENTS or name.startswith(PREFIXES)),name
 data=p.read_bytes()
 return {'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'mode':format(stat.S_IMODE(p.stat().st_mode),'04o')}
def group_exists(pid):
 try:os.killpg(pid,0);return True
 except ProcessLookupError:return False
def guard():
 for lane in ['lot5c','lot8a','lot10c']:
  d=json.loads((COORD/(lane+'-status.json')).read_text());assert d.get('quiet_requested') is not True,lane
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--label',required=True);ap.add_argument('--parent',required=True);a=ap.parse_args()
 assert re.fullmatch(r'closure-0[12]',a.label) and re.fullmatch(r'[0-9a-f]{40}',a.parent)
 result=BASE/(a.label+'-command.json');planpath=BASE/(a.label+'-plan.json');assert not result.exists() and not planpath.exists()
 receipt={'schema':'logos-engine.lot6b.documentary-closure-command.v1','status':'failed','label':a.label,'parent':a.parent,'startedAt':utc(),'commands':[],'networkUsed':False,'nativePayloadsInterpreted':False,'automaticRetry':False}
 deadline=time.monotonic()+150;code=1
 with (COORD/'performance.lock').open('rb') as lock:
  fcntl.flock(lock,fcntl.LOCK_SH|fcntl.LOCK_NB);guard()
  def git(*args,opaque=False):
   left=deadline-time.monotonic();assert left>0
   argv=['git','-c','gc.auto=0','-c','maintenance.auto=false','--literal-pathspecs',*args]
   row={'argv':argv,'startedAt':utc(),'limitSeconds':min(60,left),'signals':[]};receipt['commands'].append(row)
   p=subprocess.Popen(argv,cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,pass_fds=(lock.fileno(),),env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'})
   try:out,err=p.communicate(timeout=row['limitSeconds'])
   except BaseException as error:
    row['error']=type(error).__name__
    if group_exists(p.pid):os.killpg(p.pid,signal.SIGKILL);row['signals'].append('SIGKILL')
    try:out,err=p.communicate(timeout=3)
    finally:row.update(exitCode=p.poll(),finishedAt=utc(),processGroupAbsent=not group_exists(p.pid))
    raise
   residual=group_exists(p.pid)
   if residual:
    os.killpg(p.pid,signal.SIGKILL);row['signals'].append('SIGKILL');end=time.monotonic()+2
    while group_exists(p.pid) and time.monotonic()<end:time.sleep(.05)
   row.update(exitCode=p.returncode,finishedAt=utc(),stdoutBytes=len(out),stdoutSha256=hashlib.sha256(out).hexdigest(),stderr=err.decode('utf-8','replace'),processGroupAbsent=not group_exists(p.pid),residualGroupObserved=residual)
   if not opaque:row['stdout']=out.decode('utf-8','replace')
   assert p.returncode==0 and not residual and row['processGroupAbsent'],row
   return out
  try:
   assert git('rev-parse','HEAD').decode().strip()==a.parent
   assert not git('diff','--cached','--name-only','-z')
   assert not git('ls-files','--deleted','-z')
   assert not git('diff','--name-only','a01e6faf330d82fa220feac0c9ad4632bb75a9de','--','src')
   modified=set(filter(None,git('diff','--name-only','-z','HEAD','--').decode().split('\0')))
   untracked=set(filter(None,git('ls-files','--others','--exclude-standard','-z').decode().split('\0')))
   ignored=set(filter(None,git('ls-files','--others','--ignored','--exclude-standard','-z','--',*PREFIXES).decode().split('\0')))
   assert all(p.endswith('.log') for p in ignored),ignored
   names=sorted(modified|untracked|ignored);assert names
   records=[fp(p) for p in names];assert sum(x['bytes'] for x in records)<24*1024*1024
   plan={'schema':'logos-engine.lot6b.documentary-closure-plan.v1','recordedAt':utc(),'parent':a.parent,'label':a.label,'files':records,'fileCount':len(records),'rawBytes':sum(x['bytes'] for x in records),'forceAddPaths':sorted(ignored),'manifestSelfExcluded':True,'qualification':'The plan is staged in addition to the listed files; it does not claim its own hash. Only closed own evidence, metadata, final case clock and three documents are included.'}
   with planpath.open('x') as f:json.dump(plan,f,indent=2);f.write('\n')
   planname=str(planpath.relative_to(ROOT));names.append(planname);records.append(fp(planname));assert sum(x['bytes'] for x in records)<=24*1024*1024
   receipt.update(files=records,fileCount=len(records),rawBytes=sum(x['bytes'] for x in records),plan=str(planpath.relative_to(ROOT)))
   guard()
   normal=sorted(set(names)-ignored)
   git('add','--',*normal)
   if ignored:git('add','-f','--',*sorted(ignored))
   assert set(filter(None,git('diff','--cached','--name-only','-z').decode().split('\0')))==set(names)
   for r in records:
    blob=git('show',':'+r['path'],opaque=True);assert len(blob)==r['bytes'] and hashlib.sha256(blob).hexdigest()==r['sha256']
   git('diff','--cached','--check')
   git('commit','-m','Close Lot 6B functional evidence and roadmap '+a.label)
   commit=git('rev-parse','HEAD').decode().strip();receipt['commit']=commit
   assert git('rev-parse','HEAD^').decode().strip()==a.parent
   assert set(git('diff','--name-only',a.parent,commit,'--').decode().splitlines())==set(names)
   for r in records:
    blob=git('show',commit+':'+r['path'],opaque=True);assert len(blob)==r['bytes'] and hashlib.sha256(blob).hexdigest()==r['sha256'] and fp(r['path'])==r
   assert not git('diff','--cached','--name-only','-z')
   receipt.update(status='committed',exactCommittedFiles=True,allFilesStillMatch=True,allChildGroupsAbsent=True);code=0
  except BaseException as error:receipt['error']={'type':type(error).__name__,'message':str(error)}
  finally:
   receipt.update(finishedAt=utc(),exitCode=code)
   with result.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
 print(json.dumps({k:receipt.get(k) for k in ['status','label','parent','commit','fileCount','rawBytes','exitCode','error']}))
 return code
if __name__=='__main__':raise SystemExit(main())
