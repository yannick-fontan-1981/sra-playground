#!/usr/bin/env python3
"""Harmless batch-supervisor controls, isolated from native imports/test/game data."""
import argparse
import ast
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time

BASE = Path(__file__).resolve().parent

def fingerprint(path):
    raw=path.read_bytes()
    return {'path':str(path),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args(); output=args.output.resolve()
    if not output.is_relative_to(BASE) or output.exists():raise ValueError('New evidence output required')
    coord=Path('/workspace/shared/sra-coordination')
    for name in ('lot5c-status.json','lot6b-status.json','lot8a-status.json','lot10c-status.json'):
        d=json.loads((coord/name).read_text())
        if d.get('quiet_requested') is True or (d.get('performance_started') is True and d.get('performance_completed') is not True):raise ValueError('Fresh quiet '+name)
    with (coord/'performance.lock').open('r') as lock:
        fcntl.flock(lock,fcntl.LOCK_SH|fcntl.LOCK_NB)
        runner=BASE/'run-release-checks.py'; before=fingerprint(runner)
        # Compile the exact supervisor AST only. Importing the runner would load
        # its proof helper; this control deliberately does not import that module.
        tree=ast.parse(runner.read_text())
        nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='run_owned_process_group']
        assert len(nodes)==1
        namespace={'os':os,'subprocess':subprocess,'time':time}
        exec(compile(ast.Module(body=nodes,type_ignores=[]),str(runner),'exec'),namespace)
        supervisor=namespace['run_owned_process_group']; results=[]
        sleeper="import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);print('harmless grandchild ready',flush=True);time.sleep(60)"
        parent="import subprocess,sys,time;subprocess.Popen([sys.executable,'-B','-c',"+repr(sleeper)+"]);print('harmless parent ready',flush=True);time.sleep(60)"
        for name,code,timeout,expected in [('normal_exit',"print('harmless normal exit',flush=True)",2,None),('timeout_descendant',parent,0.4,'TimeoutExpired'),('interrupt_descendant',parent,3,'KeyboardInterrupt')]:
            record={}; caught=None; timer=None
            raw=output.with_name(output.stem+'-'+name+'.raw.txt')
            started=time.monotonic()
            with raw.open('xb') as stream:
                if name=='interrupt_descendant':
                    import signal
                    timer=threading.Timer(0.4,lambda:os.kill(os.getpid(),signal.SIGTERM));timer.start()
                try:
                    completed=supervisor([sys.executable,'-B','-c',code],BASE,stream,timeout,record)
                    assert completed.returncode==0
                except (subprocess.TimeoutExpired,KeyboardInterrupt) as exc:caught=type(exc).__name__
                finally:
                    if timer is not None:timer.cancel();timer.join()
            assert caught==expected,(caught,expected)
            assert record['terminal'] and record['ownedGroupGone'] and record['directChildReaped']
            if expected:
                assert 'SIGKILL' in record['signalsSent'] and record['reapedDescendants'],record
            try:os.killpg(record['processGroupId'],0)
            except ProcessLookupError:pass
            else:raise AssertionError('Owned process group survived cleanup')
            results.append({'name':name,'passed':True,'expectedException':expected,'observedException':caught,'supervision':record,'durationSeconds':time.monotonic()-started,'raw':fingerprint(raw)})
            print(json.dumps(results[-1]),flush=True)
        after=fingerprint(runner);assert before==after
        report={'schema':'logos-engine.lot10c.batch-process-group-controls.v1','recordedAt':datetime.now(timezone.utc).isoformat(),'passed':True,'controls':results,'runnerBefore':before,'runnerAfter':after,'runnerUnchanged':True,'nativeTestsExecuted':0,'gamesExecuted':0,'actualDevelopmentBatchesExecuted':0,'allOwnedGroupsTerminal':True,'qualification':'Exact isolated supervisor function with harmless Python child/grandchild processes only; no native proof or final delivery acceptance.'}
        with output.open('x') as stream:json.dump(report,stream,indent=2);stream.write('\n')
        print(json.dumps({'receipt':fingerprint(output),'passed':True}))

if __name__=='__main__':main()
