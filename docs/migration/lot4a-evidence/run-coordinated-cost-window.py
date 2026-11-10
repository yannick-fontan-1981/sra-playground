#!/usr/bin/env python3
"""Hold the shared lock around the unchanged, predeclared official cost runner."""
import datetime
import fcntl
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
OUT = BASE / 'performance-integrated'
COORD = Path('/workspace/shared/sra-coordination')
def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def read(p): return json.loads(p.read_text())
def record(p): return {'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
def write(p,v):
    with p.open('x') as f: f.write(json.dumps(v,ensure_ascii=False,indent=2)+'\n')

def main():
    assert not (OUT/'window.json').exists() and not (OUT/'readiness.json').exists(), 'An earlier window must never be overwritten'
    baseline = read(BASE/'baseline-integrated/provenance.json')
    frozen = BASE/'integrated-051'
    native = read(frozen/'source-manifest.json')
    for path in [frozen/'validation/delta-tests-run.json', frozen/'validation/checks-run.json', frozen/'regressions/regression-summary.json', frozen/'feedback-live-contribution.json', frozen/'delivery-integrity.json']:
        assert read(path)['status']=='passed', path
    assert read(frozen/'browser/preview-stopped.json')['previewStopped'] is True
    assert read(OUT/'protocol-check.json')['status']=='protocol_contract_passed'
    paths=[frozen/'source-manifest.json',frozen/'source-archive.json',frozen/'validation/delta-tests-run.json',frozen/'validation/checks-run.json',frozen/'regressions/regression-summary.json',frozen/'feedback-live-contribution.json',frozen/'delivery-integrity.json',frozen/'browser/browser-qa.json',frozen/'browser/preview-stopped.json',BASE/'baseline-integrated/source-manifest.json',BASE/'baseline-integrated/provenance.json',BASE/'planning/integrated-051-regression-provenance.json',OUT/'protocol-check.json',OUT/'declaration.json',Path(__file__).resolve()]
    command=[sys.executable,'-B','scripts/run-native-cost-window.py',baseline['checkout'],OUT.relative_to(ROOT).as_posix(),(BASE/'baseline-integrated/source-manifest.json').relative_to(ROOT).as_posix(),(frozen/'source-manifest.json').relative_to(ROOT).as_posix()]
    with (COORD/'performance.lock').open('a+') as lock:
        fcntl.flock(lock.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        acknowledgements={}
        for lane in ['lot3','lot7a']:
            status=read(COORD/(lane+'-status.json'))
            assert status['coordination_acknowledged'] is True
            assert status['heavy_work_started'] is False and status['performance_started'] is False
            assert not status.get('publication_started',False) or status.get('publication_completed',False)
            if lane=='lot3': assert status['slot_released_to']=='4A observed_feedback_sequence'
            if lane=='lot7a': assert status['quiet_acknowledged'] is True
            acknowledgements[lane]=status
        acquired=now()
        owner={'owner':'4A observed_feedback_sequence','acquiredAt':acquired,'nativeDigest':native['digest'],'officialCommand':command}
        lock.seek(0);lock.truncate();lock.write(json.dumps(owner)+'\n');lock.flush()
        lock_receipt=OUT/'lock-acquisition.json'
        write(lock_receipt,{'schema':'logos-engine.coordinated-exclusive-cost-lock.v1','status':'acquired','lockPath':str(COORD/'performance.lock'),**owner,'otherLanesAtAcquisition':acknowledgements,'qualification':'The lock and all known active-lane acknowledgements are both required; the lock alone does not establish isolation.'})
        readiness={'schema':'logos-engine.native-cost-window-readiness.v1','status':'ready_for_predeclared_official_window','measurementAuthorized':True,'finalizedAt':now(),'pendingRequirements':[],'inputs':[record(p) for p in paths+[lock_receipt]],'nativeSourceDigest':native['digest'],'baselineCommit':baseline['commit'],'baselineSiteVersion':baseline['siteVersion'],'nativeVersion':'0.51.0','functionalSummary':{'tests':3566,'testFiles':90,'projectGates':5,'regressions':5,'regressionChecks':85,'mindLevels':3,'mindActions':31,'mindPrefixes':20,'feedbackSourceCalls':51},'browserQualification':'Blocked infrastructure; zero browser game actions and no browser functional pass. The managed preview is stopped.','ownAgentWork':'Only light report editing by feedback_component; all tests/builds/campaigns/replays/source verification completed. No preview or other4A heavy process.','isolation':'Shared exclusive flock held before this receipt and throughout the unchanged official child;3I completed and7A explicitly quiet through4A publication.','officialCommand':command,'noNodeOptionsOrHeapOverrideAdded':True}
        write(OUT/'readiness.json',readiness)
        own=read(COORD/'lot4a-status.json');own.update(updated_at=now(),stage='Official4A A1/B1/B2/A2 cost window active under the shared exclusive lock. Functional gates complete. Other lanes quiet.',performance_started=True,heavy_work_started=True,active_command='unchanged run-native-cost-window.py; no environment or heap override')
        (COORD/'lot4a-status.json').write_text(json.dumps(own,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({'phase':'exclusive_window_start','readiness':record(OUT/'readiness.json'),'officialCommand':command}),flush=True)
        started=now();code=None
        try:
            code=subprocess.call(command,cwd=ROOT)
        finally:
            finished=now()
            execution={'schema':'logos-engine.coordinated-cost-window-execution.v1','generator':record(Path(__file__).resolve()),'officialCommand':command,'startedAt':started,'finishedAt':finished,'exitCode':code,'lockAcquisition':record(lock_receipt),'readiness':record(OUT/'readiness.json'),'lockHeldThroughoutChild':True}
            if (OUT/'window.json').exists(): execution['window']=record(OUT/'window.json');execution['windowStatus']=read(OUT/'window.json')['status']
            fcntl.flock(lock.fileno(),fcntl.LOCK_UN);execution['lockReleasedAt']=now()
            write(OUT/'coordinated-window-execution.json',execution)
            own=read(COORD/'lot4a-status.json');own.update(updated_at=now(),stage='4A official measurement child ended; all results retained. Reviewing the global decision before publication.',performance_started=False,heavy_work_started=False,active_command=None)
            (COORD/'lot4a-status.json').write_text(json.dumps(own,ensure_ascii=False,indent=2)+'\n')
        return code if isinstance(code,int) else 1
if __name__=='__main__': sys.exit(main())
