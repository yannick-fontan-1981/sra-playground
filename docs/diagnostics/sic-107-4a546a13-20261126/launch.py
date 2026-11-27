from pathlib import Path
import datetime,json,os,resource,subprocess
out=Path(__file__).resolve().parent
m=json.loads((out/'manifest.json').read_text())
assert not (out/'results.jsonl').exists()
start=datetime.datetime.now(datetime.timezone.utc).isoformat()
(out/'execution-start.json').write_text(json.dumps({'startedAt':start,'sourceCommit':m['sourceCommit']},indent=2)+'\n')
print(json.dumps({'event':'campaign-started','at':start,'games':m['expectedGames'],'source':m['sourceCommit']}),flush=True)
with (out/'runner.log').open('w') as log:
 p=subprocess.run(m['argv'],cwd=m['sourceCheckout'],env={**os.environ,**m['environment']},stdout=log,stderr=subprocess.STDOUT)
end=datetime.datetime.now(datetime.timezone.utc).isoformat()
usage=resource.getrusage(resource.RUSAGE_CHILDREN)
receipt={'startedAt':start,'finishedAt':end,'parentExitCode':p.returncode,'sourceCommitAtEnd':subprocess.check_output(['git','rev-parse','HEAD'],cwd=m['sourceCheckout'],text=True).strip(),'sourceCleanAtEnd':not subprocess.check_output(['git','status','--porcelain=v1'],cwd=m['sourceCheckout'],text=True).strip(),'childUserCpuSeconds':usage.ru_utime,'childSystemCpuSeconds':usage.ru_stime,'childMaximumRssKiB':usage.ru_maxrss}
(out/'execution-end.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'event':'campaign-ended',**receipt}),flush=True)
raise SystemExit(p.returncode)
