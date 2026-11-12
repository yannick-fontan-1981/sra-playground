"""Short, nonblocking publication ownership. Never unlink the lock inode."""
import fcntl, json, os, select, signal, stat, sys, time
from pathlib import Path
from datetime import datetime, timezone

LOCK=Path('/workspace/shared/sra-coordination/publication.lock')
STATUS=LOCK.parent/'lot10c-status.json'
OUT=Path(sys.argv[1])
assert OUT.is_absolute() and not OUT.exists()
now=lambda:datetime.now(timezone.utc).isoformat()
lease='lot10c-priority066-'+str(os.getpid())
record={'schema':'logos-engine.lot10c.priority066-publication-lock.v1','owner':'lot10c','lease':lease,'startedAt':now(),'maximumSeconds':300,'path':str(LOCK),'blocking':False,'publicationOnly':True,'peerAvailabilityWait':False,'performanceLockAcquired':False,'lockFileRemoved':False,'holderPid':os.getpid()}
fd=None;held=False;releasedBy=None;deadline=None
def save():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(record,indent=2)+'\n')
def update(active):
    d=json.loads(STATUS.read_text()) if STATUS.exists() else {'owner':'lot10c'}
    if active or d.get('publicationLease')==lease:
        d.update(updated_at=now(),publication_started=active,publication_lock_held=active,publicationLease=lease,performance_started=False,performance_lock_held=False,quiet_requested=False,ordinary_work_requires_global_lock=False,peerAvailabilityWait=False,phase='priority066_publication_active' if active else 'priority066_publication_released')
        tmp=STATUS.with_name(STATUS.name+'.'+str(os.getpid())+'.tmp')
        with tmp.open('x') as f:json.dump(d,f,indent=2);f.write('\n')
        os.replace(tmp,STATUS)
def interrupt(signum,frame):raise InterruptedError('holder_signal_'+str(signum))
for sig in (signal.SIGINT,signal.SIGTERM,signal.SIGHUP):signal.signal(sig,interrupt)
try:
    LOCK.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(LOCK,os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
    s=os.fstat(fd);p=LOCK.stat()
    assert stat.S_ISREG(s.st_mode) and (s.st_dev,s.st_ino)==(p.st_dev,p.st_ino),'Lock inode identity mismatch'
    record['identity']={'device':s.st_dev,'inode':s.st_ino,'bytes':s.st_size}
    try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        record.update(status='unavailable',reason='Existing owner retains publication exclusivity; no waiting, unlinking, or replacement.')
        save();raise SystemExit(75)
    held=True;deadline=time.monotonic()+300
    record.update(status='held',acquiredAt=now());update(True);save()
    print(json.dumps({k:record[k] for k in ('status','lease','holderPid','identity','maximumSeconds')}),flush=True)
    while time.monotonic()<deadline:
        ready,_,_=select.select([sys.stdin],[],[],min(1,max(0,deadline-time.monotonic())))
        if ready:
            line=sys.stdin.readline()
            if not line:releasedBy='stdin_closed';break
            if line.strip()=='release:'+lease:releasedBy='explicit_owner_release';break
    if releasedBy is None:releasedBy='bounded_holder_deadline'
except BaseException as e:
    if record.get('status')!='unavailable':record.update(status='failed',error=type(e).__name__+':'+str(e))
    releasedBy=releasedBy or 'exception_cleanup'
    raise
finally:
    if held:
        fcntl.flock(fd,fcntl.LOCK_UN);held=False
        record.update(status='released',releasedBy=releasedBy,releasedAt=now());update(False)
    if fd is not None:os.close(fd)
    if LOCK.exists():
        p=LOCK.stat();record['finalIdentity']={'device':p.st_dev,'inode':p.st_ino,'bytes':p.st_size}
        record['sameLockFile']=record.get('identity')==record['finalIdentity']
    record['descriptorClosed']=True;save()
    print(json.dumps({k:record.get(k) for k in ('status','releasedBy','sameLockFile','descriptorClosed')}),flush=True)
