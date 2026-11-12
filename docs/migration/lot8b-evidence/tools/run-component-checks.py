"""Bounded, retained 8B component checks; no global lock, games or publication."""
from pathlib import Path
from datetime import datetime,timezone
import argparse,gzip,hashlib,json,os,re,signal,subprocess,time

ROOT=Path(__file__).resolve().parents[4]
p=argparse.ArgumentParser();p.add_argument('--kind',choices=['reference','contract','adjacent','typecheck'],required=True);p.add_argument('--attempt',required=True);args=p.parse_args()
assert re.fullmatch(r'[a-z0-9-]+',args.attempt)
tests={'reference':['tests/v6-branch-routing-reference.test.ts'],'contract':['tests/v6-branch-routing-contract.test.ts'],
 'adjacent':['tests/v6-motif-access-reference.test.ts','tests/v6-motif-access-contract.test.ts']}
command=['node','node_modules/typescript/bin/tsc','--noEmit'] if args.kind=='typecheck' else ['node','--test','--test-concurrency=1','--test-reporter=tap',*tests[args.kind]]
OUT=ROOT/'docs/migration/lot8b-evidence/component-stage-01'/args.attempt
OUT.mkdir(parents=True,exist_ok=False)
def now():return datetime.now(timezone.utc).isoformat()
def sha(path):
 d=hashlib.sha256()
 with path.open('rb')as f:
  for block in iter(lambda:f.read(1024*1024),b''):d.update(block)
 return d.hexdigest()
def inputs():
 paths=[p for p in (ROOT/'src').rglob('*')if p.is_file() and p.suffix in ['.ts','.json','.drm']]
 names=['package.json','package-lock.json','tsconfig.json','scripts/export-v6-branch-routing-reference.py','tests/fixtures/v6-branch-routing-reference.json','docs/migration/lot8b-evidence/component-stage-01/plan.json']
 if args.kind!='typecheck':names+=tests[args.kind]
 if args.kind=='adjacent':names+=['tests/fixtures/v6-motif-access-reference.json','scripts/check-v6-motif-access-reference.py']
 paths +=[ROOT/n for n in names]+[Path(__file__).resolve()]
 return {p.relative_to(ROOT).as_posix():sha(p)for p in sorted(set(paths))}
def write(name,value):
 with (OUT/name).open('x')as f:json.dump(value,f,indent=2);f.write('\n')
before=inputs();write('inputs-before.json',before)
record={'schema':'logos-engine.lot8b.component-command.v1','status':'running','kind':args.kind,'command':command,'cwd':str(ROOT),'startedAt':now(),'timeoutSeconds':120,'globalLockAcquired':False,'performanceMeasurement':False,'gameExecution':False,'published':False,'headBefore':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'inputCount':len(before)}
write('declaration.json',record)
start=time.monotonic()
with (OUT/'output.raw.log').open('xb')as log:
 child=subprocess.Popen(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:code=child.wait(timeout=120)
 except subprocess.TimeoutExpired:
  os.killpg(child.pid,signal.SIGKILL);child.wait();code=124;record['timedOut']=True
raw=(OUT/'output.raw.log').read_bytes();gz=OUT/'output.log.gz'
with gz.open('xb')as f:f.write(gzip.compress(raw,mtime=0))
after=inputs();write('inputs-after.json',after)
record.update(finishedAt=now(),elapsedSeconds=time.monotonic()-start,exitCode=code,inputsUnchanged=before==after,
 changedInputPaths=sorted(k for k in set(before)|set(after)if before.get(k)!=after.get(k)),log={'path':gz.relative_to(ROOT).as_posix(),'bytes':gz.stat().st_size,'sha256':sha(gz)})
record['testCounts']={name:int(value)for name,value in re.findall(r'^# (tests|suites|pass|fail|cancelled|skipped|todo) (\d+)\s*$',raw.decode(errors='replace'),re.M)}
record['status']='passed' if code==0 and before==after else 'failed';write('receipt.json',record)
print(json.dumps({k:record[k]for k in ['status','kind','exitCode','elapsedSeconds','inputsUnchanged','testCounts']}),flush=True)
if code or before!=after:print(raw.decode(errors='replace')[-15000:],flush=True)
raise SystemExit(0 if record['status']=='passed' else 1)
