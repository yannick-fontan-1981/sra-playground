#!/usr/bin/env python3
"""Bounded readonly admission scan of already retained canonical public pixels."""
from pathlib import Path
from datetime import datetime, timezone
import gzip
import hashlib
import importlib.util
import json
import time

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[3]
PLAN = BASE / 'retained-public-scan-plan.json'
OUTPUT = BASE / 'retained-public-admission.json'


def fingerprint(path):
    data = path.read_bytes()
    return {'path':path.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}


def main():
    if OUTPUT.exists(): raise FileExistsError(OUTPUT)
    plan = json.loads(PLAN.read_text())
    assert len(plan['traces']) <= plan['maxTraces'] == 30
    spec = importlib.util.spec_from_file_location('framed_original_oracle',ROOT/'scripts/export-v6-framed-window-reference.py')
    original = importlib.util.module_from_spec(spec);spec.loader.exec_module(original)
    count_before = original.verify_source()
    started = datetime.now(timezone.utc).isoformat(); start_clock=time.monotonic()
    excluded=set(plan['excludedGames']);traces=[];calls=0;admissions=[]
    for item in plan['traces']:
        # The exclusion runs before reading trace bytes or calling the source.
        assert item['game'] not in excluded
        path=ROOT/item['path'];before=fingerprint(path)
        assert before['bytes']==item['bytes']
        data=json.loads(gzip.decompress(path.read_bytes()))
        assert data['game']==item['game'] and data['game'] not in excluded
        unique=[];seen=set()
        for index,record in enumerate(data['packets']):
            packet=record['packet'];rows=packet['frame_rows']
            digest=original.sha(json.dumps(rows,separators=(',',':')).encode())
            if digest in seen:continue
            seen.add(digest)
            unique.append((index,packet,rows,digest))
        cap=plan['maxCanonicalViewsPerTrace']
        selected=list(range(len(unique))) if len(unique)<=cap else [(i*(len(unique)-1))//(cap-1) for i in range(cap)]
        assert len(selected)==len(set(selected)) and len(selected)<=40
        results=[]
        for unique_index in selected:
            index,packet,rows,digest=unique[unique_index]
            assert calls<plan['maxSourceCalls']
            result={'packetIndex':index,'uniqueCanonicalIndex':unique_index,'stepIndex':packet['step_index'],
                'level':packet['level'],'levelsCompleted':packet['levels_completed'],'state':packet['state'],
                'frameHash':packet['frame_hash'],'rowsSha256':digest}
            try:result['scene']=original.plain(original.measure(rows))
            except Exception as error:result['scene']=None;result['sourceError']=original.error_value(error)
            calls+=1;results.append(result)
            if result['scene'] is not None:
                admissions.append({'game':item['game'],'trace':item['path'],**result})
        assert fingerprint(path)==before
        traces.append({'game':item['game'],'input':before,'packetCount':len(data['packets']),
            'uniqueCanonicalViews':len(unique),'selectedCanonicalViews':len(results),
            'unmeasuredUniqueCanonicalViews':len(unique)-len(results),'results':results,
            'admittedCount':sum(r['scene'] is not None for r in results),
            'sourceErrorCount':sum('sourceError' in r for r in results),'inputUnchanged':True})
        print(json.dumps({'game':item['game'],'selected':len(results),'unique':len(unique),'admitted':traces[-1]['admittedCount'],'calls':calls}),flush=True)
    count_after=original.verify_source()
    value={'schema':'logos-engine.framed-window-retained-public-admission.v1','status':'completed_bounded_scan',
        'startedAt':started,'finishedAt':datetime.now(timezone.utc).isoformat(),'elapsedSeconds':time.monotonic()-start_clock,
        'generator':fingerprint(Path(__file__)),'plan':fingerprint(PLAN),
        'sourceCommit':original.COMMIT,'sourcePath':'agents/yf_arc3_v6/laya_proto/framed_window_access.py',
        'sourceSha256':original.MANIFEST['agents/yf_arc3_v6/laya_proto/framed_window_access.py']['sha256'],
        'originalFilesVerifiedBefore':count_before,'originalFilesVerifiedAfter':count_after,
        'excludedGames':plan['excludedGames'],'traceCount':len(traces),'sourceCalls':calls,
        'admittedViews':len(admissions),'admittedGames':sorted({row['game'] for row in admissions}),
        'sourceErrors':sum(t['sourceErrorCount'] for t in traces),'admissions':admissions,'traces':traces,
        'executionScope':{'gameHostsLoaded':0,'gameExecutions':0,'dispatchedActions':0,'levelJumps':0,
            'nativeAgentProposals':0,'sourceAgentProposals':0,'acquisitionCalls':0,'animationsConsumed':0,'privateStatesRead':0},
        'qualification':'Deterministic bounded corpus diagnosis only. Source measure receives complete canonical public frame_rows, never commands, animation rows, native plans or learned expected state. Non-admission covers only selected views; omitted unique views remain unmeasured and do not become negative evidence. An admission is a structural candidate, not a selected game, executed contribution, solved level or timing result. No cumulative game-case clock is reset or newly selected by this scan.'}
    with OUTPUT.open('x') as stream:stream.write(json.dumps(value,indent=2)+'\n')
    print(json.dumps({'output':OUTPUT.relative_to(ROOT).as_posix(),'traceCount':len(traces),'sourceCalls':calls,
        'admittedViews':len(admissions),'admittedGames':value['admittedGames'],'sourceErrors':value['sourceErrors']}))


if __name__=='__main__':main()
