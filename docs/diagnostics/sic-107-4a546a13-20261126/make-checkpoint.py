from pathlib import Path
import gzip, hashlib, json, shutil, subprocess
root=Path(__file__).resolve().parent
raw=(root/'results.jsonl').read_bytes()
if not raw.endswith(b'\n'):
    raw=raw.rsplit(b'\n',1)[0]+b'\n'
rows=[json.loads(l) for l in raw.splitlines()]
ended=(root/'execution-end.json').exists()
snapshot=root/'checkpoints'/f'{"final" if ended else "first"}-{len(rows):03d}'
snapshot.mkdir(parents=True,exist_ok=False)
for n in ['manifest.json','execution-start.json','launch.py','summarize.py','expected-budgets.json','make-checkpoint.py']:
    shutil.copyfile(root/n,snapshot/n)
(snapshot/'results.jsonl.gz').write_bytes(gzip.compress(raw,compresslevel=9,mtime=0))
if ended:
    shutil.copyfile(root/'execution-end.json',snapshot/'execution-end.json')
    for n in ['runner.log','results.jsonl.levels']:
        (snapshot/(n+'.gz')).write_bytes(gzip.compress((root/n).read_bytes(),compresslevel=9,mtime=0))
subprocess.run(['python',str(snapshot/'summarize.py')],capture_output=True,text=True,check=True)
report=json.loads((snapshot/'report.json').read_text())
files=[]
for p in sorted(snapshot.iterdir()):
    b=p.read_bytes()
    files.append({'name':p.name,'bytes':len(b),'chars':len(b.decode()) if p.suffix!='.gz' else None,'gitSha':hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest(),'sha256':hashlib.sha256(b).hexdigest()})
print(json.dumps({'snapshot':str(snapshot),'results':len(rows),'ended':ended,'aggregate':report['aggregate'],'files':files},ensure_ascii=False))
