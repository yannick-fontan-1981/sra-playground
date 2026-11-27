import subprocess,os,datetime,json,hashlib
from pathlib import Path
root=Path('/workspace/scratch/8b7740e8a750/ordered-contact')
base=Path('/workspace/scratch/8b7740e8a750/sk48-continuity-531e03d6-r3')
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
assert sha=='531e03d666a8e4cf18c5802cde50d12a2008da4d'
assert not subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip()
manifest={'schema':'sic.physical-campaign.v1','source':sha,'githubSource':'5e9940b50dd704bc2a62fae6a167cf895038a798','tree':subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=root,text=True).strip(),'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':['node','scripts/compare-source100.mjs','.','.',str(base)+'.jsonl','source:SK48','1','8','96'],'env':{'SIC_STUDY_CONTINUITY':'1','SIC_STUDY_WORKERS':'1','SIC_STUDY_SOLVER':'sic','SIC_STUDY_PROGRESS':'1'},'qualification':'Passive physical evidence; separate original-budget strict source dd683bd3 remains authoritative for timing.'}
Path(str(base)+'-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
env=os.environ.copy();env.update(manifest['env'])
with open(str(base)+'.log','w') as log:
 result=subprocess.run(manifest['command'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
manifest['endedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();manifest['exitCode']=result.returncode
manifest['sourceUnchanged']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==sha and not subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip()
if Path(str(base)+'.jsonl').exists():manifest['rawSha256']=hashlib.sha256(Path(str(base)+'.jsonl').read_bytes()).hexdigest()
Path(str(base)+'-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({k:manifest[k] for k in ['source','startedAt','endedAt','exitCode','sourceUnchanged']}))
raise SystemExit(result.returncode)
