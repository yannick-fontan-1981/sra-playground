"""Rebuild the unchanged 0.65 candidate; opaque inventories, no performance run."""
from pathlib import Path
from datetime import datetime, timezone
import gzip, hashlib, importlib.util, json, os, signal, subprocess, time

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent
def now(): return datetime.now(timezone.utc).isoformat()
def fp(p):
    return {'path':p.relative_to(ROOT).as_posix() if p.is_relative_to(ROOT) else str(p), 'bytes':p.stat().st_size, 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def write_new(name,value):
    with (OUT/name).open('x') as f: json.dump(value,f,indent=2,ensure_ascii=False);f.write('\n')
spec=importlib.util.spec_from_file_location('lot8_readonly_inventory',ROOT/'docs/migration/lot8a-evidence/tools/validate-composition.py')
inventory=importlib.util.module_from_spec(spec);spec.loader.exec_module(inventory)
expected=json.loads((ROOT/'docs/migration/lot8a-evidence/qualification-provisional-01/contract/input-freeze.json').read_text())
before=inventory.inputs()
assert before==expected,'Frozen inputs differ before publication build'
assert before['nativeSource']['fileCount']==324
assert before['nativeSource']['digest']=='936fa2bf81965272b1ddbab4a5c01f98aeb6a48188c1f7a8c91de226598c5e43'
write_new('build-inputs.json',before)
command=['node','/home/agent/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/scripts/build-site.mjs']
record={'schema':'logos-engine.lot8a.priority065-build.v1','startedAt':now(),'command':command,'cwd':str(ROOT),'timeoutSeconds':180,'globalLockAcquired':False,'performanceMeasurement':False,'testsRerun':False,'sourceInputEqualityBefore':True,'nativeFileCount':324,'nativeDigest':before['nativeSource']['digest'],'sourceCheckpointBeforeMergeCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'buildHelper':fp(Path(command[1]))}
start=time.monotonic()
with (OUT/'build.raw.log').open('xb') as log:
    child=subprocess.Popen(command,cwd=ROOT,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    try: code=child.wait(timeout=180)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid,signal.SIGKILL);child.wait();code=124
        record['timedOut']=True
record.update(finishedAt=now(),elapsedSeconds=time.monotonic()-start,exitCode=code)
after=inventory.inputs();record['sourceInputEqualityAfter']=after==before
raw=(OUT/'build.raw.log').read_bytes()
with (OUT/'build.log.gz').open('xb') as f:f.write(gzip.compress(raw,mtime=0))
record['log']=fp(OUT/'build.log.gz')
record['outputFiles']=[fp(p) for p in sorted((ROOT/'dist').rglob('*')) if p.is_file()]
workers=[p for p in (ROOT/'dist/assets').glob('v6-agent-worker-*.js')]
record['nativeWorker']=[fp(p) for p in workers]
record['native065InWorker']=len(workers)==1 and b'logos-engine.typescript.v6.native-migration/0.65.0' in workers[0].read_bytes()
record['status']='passed' if code==0 and record['sourceInputEqualityAfter'] and record['native065InWorker'] else 'failed'
write_new('build-execution.json',record)
print(json.dumps({k:record[k] for k in ['status','exitCode','elapsedSeconds','sourceInputEqualityBefore','sourceInputEqualityAfter','native065InWorker']}),flush=True)
raise SystemExit(0 if record['status']=='passed' else 1)
