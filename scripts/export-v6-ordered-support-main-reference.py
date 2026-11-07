#!/usr/bin/env python3
"""Bind the native-family oracle to a completed, original V6 MAIN run.

This exporter reads creator-side public execution artifacts. It verifies every
command and public response against the family fixture before reusing those
pixels by reference, and retains the actual original MAIN proposals verbatim.
It does not execute a solver or provide a runtime lookup table.
"""
from pathlib import Path
import argparse
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original-run',type=Path,required=True)
    args=parser.parse_args();run=args.original_run.resolve()
    fixture_path=ROOT/'tests/fixtures/v6-ordered-support-reference.json'
    family=json.loads(fixture_path.read_text())['session']
    report=json.loads((run/'report.json').read_text())
    trace_path=run/'public-trace.jsonl'
    trace=[json.loads(line)for line in trace_path.read_text().splitlines()]
    expected=[(transition['proposal']['actions'][index],step['afterPublic'])
        for transition in family['transitions'] for index,step in enumerate(transition['steps'])]
    assert len(trace)==len(expected)+1
    def compare_public(public,packet):
        for key,target in [('frame','frame_rows'),('frames','frame_packet'),('state','state'),
            ('level','level'),('levelsCompleted','levels_completed'),('stepIndex','step_index')]:
            assert public[key]==packet[target],key
        assert ['ACTION'+str(n)for n in public['availableActionIds']]==packet['available_action_refs']
    compare_public(trace[0]['observation'],family['initial']['public'])
    for actual,(command,public) in zip(trace[1:],expected):
        assert actual['command']=={'actionRef':command['action_ref'],'data':command['data']}
        compare_public(actual['observation'],public)
    assert report['status']=='L3_passed' and report['final']['levels_completed']==3 and report['actions']==len(expected)
    originals=[]
    for path in sorted(run.glob('proposal-*.json'),key=lambda path:int(path.stem.split('-')[-1])):
        proposal=json.loads(path.read_text());revision=int(path.stem.split('-')[-1])
        assert proposal['kind']=='conditional_ordered_support_transfer'
        assert proposal['strategy_receipt']['selected']=='factored_material_return'
        assert proposal['material_access_subquestion']=='ordered_support_transfer'
        originals.append({'revision':revision,'proposal':proposal,'artifactSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    assert len(originals)==len(family['transitions'])
    source=ROOT/'reference'/'v6'/COMMIT/'source'
    files=['agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py',
        'agents/yf_arc3_v6/laya_proto/common_ordered_support.py','agents/yf_arc3_v6/laya_proto/common_support_navigation.py']
    value={'sourceCommit':COMMIT,'scope':'Native ordered-support proposal, support binding and guards against original MAIN artifacts; router-added fields retained for future router parity',
        'sourceSha256':{name:hashlib.sha256((source/name).read_bytes()).hexdigest()for name in files},
        'familyFixtureSha256':hashlib.sha256(fixture_path.read_bytes()).hexdigest(),
        'originalPublicTraceSha256':hashlib.sha256(trace_path.read_bytes()).hexdigest(),
        'publicPacketsExactlyEqualToFamilyFixture':True,'observationScope':'run','initialRevision':1,
        'levelActionCaps':[160,160,160],'globalActionCap':480,
        'status':report['status'],'actions':report['actions'],'levelActions':report['level_actions'],
        'levelsCompleted':report['final']['levels_completed'],'decisions':originals}
    destination=ROOT/'tests/fixtures/v6-ordered-support-main-reference.json'
    destination.write_text(json.dumps(value,separators=(',',':'))+'\n')
    print(json.dumps({'output':str(destination),'actions':value['actions'],'levelsCompleted':value['levelsCompleted'],'decisions':len(originals)}))


if __name__=='__main__':main()
