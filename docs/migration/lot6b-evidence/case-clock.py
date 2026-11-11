#!/usr/bin/env python3
"""Charge actual wall-clock intervals to one retained cumulative case budget."""
from pathlib import Path
from datetime import datetime, timezone
import argparse, hashlib, json, os, time

ROOT = Path(__file__).resolve().parents[3]

def now(): return datetime.now(timezone.utc).isoformat()
def fp(p):
    return {'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': p.stat().st_size}

def main():
    p=argparse.ArgumentParser(); p.add_argument('operation', choices=['init','start','stop','status']); p.add_argument('path', type=Path)
    p.add_argument('--case'); p.add_argument('--prior',type=float); p.add_argument('--limit',type=float,default=2400)
    p.add_argument('--prior-observation',type=Path);p.add_argument('--label')
    a=p.parse_args(); path=(ROOT/a.path).resolve();path.relative_to(ROOT)
    if a.operation=='init':
        if path.exists():raise FileExistsError(path)
        if not a.case or a.prior is None or not a.prior_observation:raise ValueError('Initialization requires case, prior charge and observation')
        d={'schema':'logos-engine.lot6b.cumulative-case-clock.v1','case':a.case,'status':'inactive','limitSeconds':a.limit,
           'priorChargedSeconds':a.prior,'chargedSeconds':a.prior,'remainingSeconds':a.limit-a.prior,'intervals':[],
           'active':None,'priorObservation':fp((ROOT/a.prior_observation).resolve()),'generator':fp(Path(__file__))}
    else:d=json.loads(path.read_text())
    if a.operation=='start':
        if d['active'] is not None or d['remainingSeconds']<=0 or not a.label:raise ValueError('Case is active, exhausted or unlabeled')
        d['active']={'label':a.label,'startedAt':now(),'startedMonotonic':time.monotonic(),'bootId':Path('/proc/sys/kernel/random/boot_id').read_text().strip()};d['status']='active'
    if a.operation=='stop':
        x=d['active']
        if x is None:raise ValueError('No active interval')
        if x['bootId']==Path('/proc/sys/kernel/random/boot_id').read_text().strip():elapsed=time.monotonic()-x['startedMonotonic']
        else:elapsed=(datetime.now(timezone.utc)-datetime.fromisoformat(x['startedAt'])).total_seconds()
        d['intervals'].append({**x,'finishedAt':now(),'elapsedSeconds':elapsed});d['active']=None
        d['chargedSeconds']=d['priorChargedSeconds']+sum(x['elapsedSeconds'] for x in d['intervals']);d['remainingSeconds']=d['limitSeconds']-d['chargedSeconds']
        d['status']='completed_within_budget' if d['remainingSeconds']>=0 else 'budget_exceeded'
    if a.operation!='status':
        d['updatedAt']=now();path.parent.mkdir(parents=True,exist_ok=True)
        temp=path.with_suffix('.tmp');temp.write_text(json.dumps(d,indent=2)+'\n');os.replace(temp,path)
    elapsed=0
    if d['active']:
        elapsed=(datetime.now(timezone.utc)-datetime.fromisoformat(d['active']['startedAt'])).total_seconds()
    print(json.dumps({'case':d['case'],'status':d['status'],'chargedSeconds':d['chargedSeconds']+elapsed,'remainingSeconds':d['remainingSeconds']-elapsed,'active':d['active']}))
    if d['chargedSeconds']+elapsed>d['limitSeconds']:raise SystemExit(1)

if __name__=='__main__':main()
