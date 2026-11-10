#!/usr/bin/env python3
"""Run one declared resumed case phase under its retained cumulative deadline."""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib, json, os, shutil, signal, subprocess, sys, time
ROOT=Path(__file__).resolve().parents[3]
BASE=Path(__file__).resolve().parent
phase=sys.argv[1] if len(sys.argv)==2 else ''
assert phase in ['baseline','candidate'], 'Expected baseline or candidate'
selection=json.loads((BASE/'weav-resumption.json').read_text())
deadline=datetime.fromisoformat(selection['resumeDeadline'])
remaining=(deadline-datetime.now(timezone.utc)).total_seconds()
assert remaining>0, 'Retained WEAV case deadline exhausted'
checkout=Path('/workspace/sites/sra-published-048') if phase=='baseline' else ROOT
relative=Path('docs/migration/lot3h-evidence')/('baseline/weav-native048' if phase=='baseline' else 'final/weav-crossed-prefix-session')
out=checkout/relative;out.mkdir(parents=True,exist_ok=True)
manifest=BASE/('baseline/source-manifest.json' if phase=='baseline' else 'final/source-manifest.json')
with (out/'source-manifest.json').open('xb') as f:f.write(manifest.read_bytes())
argv=([sys.executable,'-B','scripts/run-bounded-native-campaign-proof.py','WEAV','3','8',str(relative)] if phase=='baseline' else [sys.executable,'-B','scripts/run-v53-campaign-proof.py','WEAV','3',str(relative)])
log=BASE/f'{phase}-case-phase.log'
assert not log.exists()
start=datetime.now(timezone(timedelta(hours=-3)));clock=time.monotonic();timed_out=False
with log.open('xb') as stream:
 process=subprocess.Popen(argv,cwd=checkout,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
 try:code=process.wait(timeout=remaining)
 except subprocess.TimeoutExpired:
  timed_out=True;os.killpg(process.pid,signal.SIGTERM)
  try:code=process.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);code=process.wait()
if phase=='baseline':shutil.copytree(out,ROOT/relative)
end=datetime.now(timezone(timedelta(hours=-3)))
def record(path):return {'path':path.relative_to(ROOT).as_posix(),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
value={'schema':'logos-engine.resumed-game-case-phase.v1','phase':phase,'game':'WEAV','selection':record(BASE/'weav-resumption.json'),'generator':record(Path(__file__)),'checkout':str(checkout),'command':argv,'startedAt':start.isoformat(),'finishedAt':end.isoformat(),'displayTimeZone':'UTC-03:00','elapsedSeconds':time.monotonic()-clock,'exitCode':code,'caseDeadlineReached':timed_out,'cumulativeCaseSecondsAtEnd':selection['caseClock']['previousChargedSeconds']+(end-datetime.fromisoformat(selection['resumedAt'])).total_seconds(),'output':record(log),'artifacts':[record(p) for p in sorted((ROOT/relative).rglob('*')) if p.is_file()],'qualification':'Same retained WEAV identity and cumulative40-minute deadline. Standard native common harness computes every command against an opaque public game host. No policy edit, level jump, seeded knowledge or expected return. Baseline has only the predeclared8-action outer cap; it is not a complete-game failure verdict.'}
with (BASE/f'{phase}-case-phase.json').open('x') as f:f.write(json.dumps(value,indent=2)+'\n')
print(json.dumps({'phase':phase,'exitCode':code,'deadlineReached':timed_out,'cumulativeSeconds':value['cumulativeCaseSecondsAtEnd'],'directory':str(relative)}))
raise SystemExit(code if not timed_out else 124)
