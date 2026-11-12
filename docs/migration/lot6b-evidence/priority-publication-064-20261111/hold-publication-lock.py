import os,sys,json,fcntl,select,time,signal,stat
from pathlib import Path
from datetime import datetime,timezone,timedelta
LOCK=Path('/workspace/shared/sra-coordination/publication.lock')
STATUS=Path('/workspace/shared/sra-coordination/lot6b-status.json')
OUT=Path(sys.argv[1]);OUT.parent.mkdir(parents=True,exist_ok=True)
if OUT.exists():raise RuntimeError('Receipt must be new')
now=lambda:datetime.now(timezone.utc).isoformat()
started=now();deadline=time.monotonic()+300;lease='lot6b-priority064-'+str(os.getpid())
record={'schema':'logos-engine.priority064-publication-lock.v1','owner':'lot6b','lease':lease,'startedAt':started,'maximumSeconds':300,'path':str(LOCK),'blocking':False,'lockFileRemoved':False,'publicationOnly':True}
fd=None;held=False;releasedBy=None
def update(active):
 d=json.loads(STATUS.read_text());at=now()
 if active:
  d.update(updated_at=at,phase='priority064_publication_active',publication_started=True,performance_started=False,quiet_requested=False,compute_idle=False,all_own_subagents_idle=True,active_command='Priority0.64 source push, package and private deployment under owned publication exclusivity; no peer availability wait.')
  d['official_window']={'id':lease,'owner':'lot6b','kind':'publication','state':'active','startedAt':started,'deadlineAt':(datetime.now(timezone.utc)+timedelta(seconds=300)).isoformat(),'releasedAt':None}
 else:
  w=d.get('official_window')
  if isinstance(w,dict) and w.get('id')==lease:
   w.update(state='released',releasedAt=at)
   d.update(updated_at=at,publication_started=False,phase='priority064_publication_lock_released',active_command=None)
 tmp=STATUS.with_suffix('.6b-publication.tmp');tmp.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n');os.replace(tmp,STATUS)
def interrupt(signum,frame):
 raise InterruptedError('holder_signal_'+str(signum))
for sig in [signal.SIGTERM,signal.SIGINT,signal.SIGHUP]:signal.signal(sig,interrupt)
try:
 fd=os.open(LOCK,os.O_RDWR|os.O_NOFOLLOW)
 s=os.fstat(fd);p=LOCK.stat()
 if not stat.S_ISREG(s.st_mode) or (s.st_dev,s.st_ino)!=(p.st_dev,p.st_ino):raise RuntimeError('Lock identity mismatch')
 record['identity']={'device':s.st_dev,'inode':s.st_ino,'bytes':s.st_size}
 try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:
  record.update(status='unavailable',reason='An existing holder retains publication exclusivity; no wait or removal.')
  print(json.dumps(record),flush=True)
  raise SystemExit(75)
 held=True;record.update(status='held',acquiredAt=now(),holderPid=os.getpid());update(True)
 OUT.write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps({'status':'held','lease':lease,'holderPid':os.getpid(),'identity':record['identity'],'maximumSeconds':300}),flush=True)
 while time.monotonic()<deadline:
  ready,_,_=select.select([sys.stdin],[],[],min(1,max(0,deadline-time.monotonic())))
  if ready:
   value=sys.stdin.readline()
   if not value:releasedBy='stdin_closed';break
   if value.strip()=='release:'+lease:releasedBy='explicit_owner_release';break
 if releasedBy is None:releasedBy='bounded_holder_deadline'
except BaseException as e:
 if record.get('status')!='unavailable':record.update(status='failed',error=type(e).__name__+':'+str(e))
 releasedBy=releasedBy or 'exception_cleanup'
 raise
finally:
 if held:
  fcntl.flock(fd,fcntl.LOCK_UN);held=False
  record.update(status='released',releasedBy=releasedBy,releasedAt=now())
  update(False)
 if fd is not None:os.close(fd)
 p=LOCK.stat();record['finalIdentity']={'device':p.st_dev,'inode':p.st_ino,'bytes':p.st_size}
 record['sameLockFile']=record.get('identity')==record['finalIdentity'];record['descriptorClosed']=True
 OUT.write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps({k:record.get(k) for k in ['status','releasedBy','sameLockFile','descriptorClosed']}),flush=True)
