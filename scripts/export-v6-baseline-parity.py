#!/usr/bin/env python3
"""Export public evidence for original MAIN versus native-family fixtures.

The baseline folder is produced by a creator-side, isolated original-V6 run.
Private game payloads are absent. Every public pixel/animation/action/counter is
compared before compact digests are retained beside the existing test fixtures.
"""
from pathlib import Path
import argparse
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'


def packed(value):return json.dumps(value,sort_keys=True,separators=(',',':')).encode()
def digest(value):return hashlib.sha256(packed(value)).hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--baseline-root',type=Path,required=True)
    args=parser.parse_args();base=args.baseline_root.resolve()
    support_path=ROOT/'tests/fixtures/v6-ordered-support-reference.json';fields_path=ROOT/'tests/fixtures/v6-field-reference.json'
    support=json.loads(support_path.read_text());fields=json.loads(fields_path.read_text());cases=[]
    for code,fixture,fixture_path in [('HANO',support['session'],support_path)]+[
        (code,next(item for item in fields['cases']if item['game']==code),fields_path)for code in ['SYME','DNOI']]:
        run=base/code/'reference/v6-parity/run';report=json.loads((run/'report.json').read_text())
        trace_path=run/'public-trace.jsonl';trace=[json.loads(line)for line in trace_path.read_text().splitlines()]
        packets=[fixture['initial']['public']]+[step['afterPublic']for transition in fixture['transitions']for step in transition['steps']]
        commands=[transition['proposal']['actions'][index]for transition in fixture['transitions']for index,step in enumerate(transition['steps'])]
        assert len(trace)==len(packets)==len(commands)+1
        public=[]
        for index,(actual,expected)in enumerate(zip(trace,packets)):
            p=actual['observation']
            for left,right in [('frame','frame_rows'),('frames','frame_packet'),('state','state'),('level','level'),('levelsCompleted','levels_completed'),('stepIndex','step_index')]:
                assert p[left]==expected[right],(code,index,left)
            assert ['ACTION'+str(n)for n in p['availableActionIds']]==expected['available_action_refs']
            if index:assert actual['command']=={'actionRef':commands[index-1]['action_ref'],'data':commands[index-1]['data']}
            public.append({'event':actual['event'],'ordinal':index,'command':actual.get('command'),
                'publicPacketSha256':digest(p),'frameSha256':digest(p['frame']),'animationPacketSha256':digest(p['frames']),
                'state':p['state'],'level':p['level'],'levelsCompleted':p['levelsCompleted'],
                'stepIndex':p['stepIndex'],'availableActionIds':p['availableActionIds']})
        proposals=[json.loads(path.read_text())for path in run.glob('proposal-*.json')]
        assert report['status']=='L3_passed' and report['final']['levels_completed']==3
        assert report['actions']==len(commands)==fixture['actions']
        cases.append({'game':code,'status':report['status'],'actualLevelsCompleted':report['final']['levels_completed'],
            'actualActions':report['actions'],'levelActions':report['level_actions'],'decisionCount':len(proposals),
            'selectedProposalKinds':sorted({p['kind']for p in proposals}),
            'selectedStrategyFamilies':sorted({p['strategy_receipt']['selected']for p in proposals}),
            'allCommandsAndPublicPacketsExactlyMatchNativeFamilyFixture':True,
            'nativeFixture':str(fixture_path.relative_to(ROOT)),'nativeFixtureSha256':hashlib.sha256(fixture_path.read_bytes()).hexdigest(),
            'originalPublicTraceSha256':hashlib.sha256(trace_path.read_bytes()).hexdigest(),
            'originalReportSha256':hashlib.sha256((run/'report.json').read_bytes()).hexdigest(),
            'observations':public})
    source=ROOT/'reference'/'v6'/COMMIT/'source'
    names=['common_frontier_runtime.py','common_ordered_support.py','common_multiscale_constraints.py','common_symmetric_field.py',
        'common_support_navigation.py','custom_bridge.py','neutral_observer.py','geometric_observer.py','common_frontier_policy.drm.json']
    record={'schema':'logos.v6.original-main-native-family-baseline.v1','sourceCommit':COMMIT,
        'sourceSha256':{name:hashlib.sha256((source/'agents/yf_arc3_v6/laya_proto'/name).read_bytes()).hexdigest()for name in names},
        'originalMain':'Executed without AST transformation; source manifest, session lease, active clock and public transport are explicit host bindings',
        'admission':{'targetLevelsPerGame':3,'levelActionCaps':[160,160,160],'globalActionCap':480,'clock':'active compute plus measured host execution',
            'budgetQualification':'Diagnostic equal limits; not oracle-qualified competition limits'},
        'scope':{'verified':'Full original MAIN completed nine actual levels. Its public commands and all resulting frames/animations exactly match the native-family fixtures.',
            'notClaimed':'This evidence does not establish full native router, memory, every V6 capability, all levels, competition score, or arbitrary-game parity.',
            'pythonUse':'Development oracle only; no Python agent ships in the site',
            'gameSourceAccess':'Native game engines remain host-side; solvers receive public packets only'},
        'aggregate':{'games':len(cases),'actualLevelsCompleted':sum(c['actualLevelsCompleted']for c in cases),'actualActions':sum(c['actualActions']for c in cases)},
        'cases':cases}
    destination=ROOT/'docs/migration/v6-baseline-parity.json';destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'output':str(destination),**record['aggregate']}))


if __name__=='__main__':main()
