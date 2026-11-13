#!/usr/bin/env python3
"""Preserve an actual instrumented run, including complete public returns on abort."""
import datetime,gzip,hashlib,importlib.util,json,pathlib,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
s=importlib.util.spec_from_file_location('proof',ROOT/'scripts/run-v52-campaign-proof.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
OUT=ROOT/'docs/migration/native-campaigns-v52/diagnostic-memory'
OUT.mkdir(parents=True,exist_ok=True)
paths={k:OUT/v for k,v in {'journal':'actual-public-journal.jsonl','checkpoint':'last-completed-prefix.json','report':'actual-report.json','log':'actual-output.log','receipt':'execution.json'}.items()}
for p in paths.values():
 if p.exists(): raise FileExistsError(p)
before=m.native_source(); start=datetime.datetime.now(datetime.timezone.utc).isoformat();clock=time.monotonic()
command=['node','scripts/diagnose-v52-native-provider-memory.mjs','GARE','3',str(paths['journal']),str(paths['checkpoint']),str(paths['report'])]
with paths['log'].open('wb') as f: completed=subprocess.run(command,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT)
after=m.native_source()
proofs={}
for k in ['journal','checkpoint','report','log']:
 p=paths[k]
 if p.exists():
  z=p.with_suffix(p.suffix+'.gz');z.write_bytes(gzip.compress(p.read_bytes(),mtime=0));proofs[k]=m.evidence(z);p.unlink()
receipt={'schema':'logos-engine.v52.instrumented-memory-diagnostic.v1','command':command,'exitCode':completed.returncode,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-clock,'nativeSource':before,'nativeSourceAfter':after,'nativeSourceUnchanged':before==after,'generator':m.evidence(pathlib.Path(__file__)),'harness':m.evidence(ROOT/'scripts/diagnose-v52-native-provider-memory.mjs'),'evidence':proofs,'qualification':'Actual cold native common caller with unchanged inputs, priorities and budgets. Provider call timings and process memory are observed outside the production agent. The incremental journal contains only complete public returns, and the last checkpoint is only a completed prefix, not a final success report.'}
paths['receipt'].write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'exitCode':completed.returncode,'sourceUnchanged':before==after,'evidence':proofs}),flush=True)
