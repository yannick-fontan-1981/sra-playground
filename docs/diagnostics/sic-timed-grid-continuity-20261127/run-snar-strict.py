import subprocess,os,json,hashlib,time
from pathlib import Path
root=Path.cwd()
work=Path(os.environ.get('SIC_CHECKPOINT_OUTPUT','/tmp/sic-snar-checkpoint')); work.mkdir(parents=True,exist_ok=True)
rev=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
files=list(sorted((root/'src').rglob('*.ts')))+[root/p for p in ['scripts/check-sic-chronological.mjs','scripts/sic-replay-watchdog.mjs','scripts/sic-replay-budgets.mjs','docs/architecture/sic-replay-reference-levels-20261126.json']]
def source(): return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
before=source(); start=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()); out=work/('snar-strict-'+rev[:8]+'.jsonl')
assert not out.exists()
env={**os.environ,'SIC_REPLAY_REFERENCES':'docs/architecture/sic-replay-reference-levels-20261126.json'}
result=subprocess.run(['node','scripts/check-sic-chronological.mjs','SNAR','6',str(out),'1','sic'],cwd=root,env=env)
after=source(); current=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
receipt={'source':rev,'tree':subprocess.check_output(['git','rev-parse',rev+'^{tree}'],cwd=root,text=True).strip(),'startedAt':start,'finishedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'sourceUnchanged':before==after and current==rev,'sourceHashes':before,'exitCode':result.returncode}
(work/('snar-strict-'+rev[:8]+'.freeze.json')).write_text(json.dumps(receipt,indent=2)+'\n')
assert receipt['sourceUnchanged']; print(json.dumps({'frozen':rev,'sourceUnchanged':True,'exitCode':result.returncode}),flush=True)
