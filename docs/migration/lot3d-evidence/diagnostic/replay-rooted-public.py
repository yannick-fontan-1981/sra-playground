#!/usr/bin/env python3
"""Replay saved public returns through unchanged RootedLine source from cold state.

No game is loaded or stepped. Native proposal memory is never used to initialise
source memory. Own source proposals and record() produce the complete state.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT/'reference/v6'/COMMIT/'source'
sys.path[:0] = [str(SOURCE),str(SOURCE/'agents/yf_arc3_v6/laya_proto')]
from rooted_line_access import RootedLineAccess
from panel_service_access import PanelServiceAccess
from rooted_line_projection import scene,physical
from src_bridge import plain
from terminal_composition import identity

MANIFEST=json.loads((SOURCE.parent/'manifest.json').read_text())['files']
HERE=Path(__file__).resolve().parent
SESSION=ROOT/'docs/migration/lot3d-evidence/final/sk48-rooted-session'

def sha(v):return hashlib.sha256(v).hexdigest()
def verify_source():
    for name,value in MANIFEST.items():assert sha((SOURCE/name).read_bytes())==value['sha256'],name
    return len(MANIFEST)
def load(name):return json.loads(gzip.decompress((SESSION/name).read_bytes()))
def find_observations(value,found):
    if isinstance(value,dict):
        if all(k in value for k in ['observation_ref','revision','level_epoch','available_action_refs']):
            found[value['revision']]=value
        else:
            for child in value.values():find_observations(child,found)
    elif isinstance(value,list):
        for child in value:find_observations(child,found)
def state(memory):
    return {'memory':plain(memory.line_memory),'events':plain(memory.line_events),
        'parentDigest':PanelServiceAccess.retained_digest(memory),'digest':memory.retained_digest()}
def compare(original,native,path=''):
    original=plain(original);native=plain(native)
    if original==native:return []
    if isinstance(original,dict) and isinstance(native,dict):
        out=[]
        for key in sorted(set(original)|set(native)):
            if key not in original or key not in native:out.append({'path':path+'.'+key,'sourcePresent':key in original,'nativePresent':key in native})
            else:out.extend(compare(original[key],native[key],path+'.'+key))
        return out
    if isinstance(original,list) and isinstance(native,list) and len(original)==len(native):
        return [d for i,(a,b) in enumerate(zip(original,native)) for d in compare(a,b,path+f'[{i}]')]
    return [{'path':path,'source':original,'native':native}]

def main():
    verified=verify_source();report=load('sk48-campaign.json.gz')
    assert report['game']=='SK48' and report['final']['nativeImplementation'].endswith('/0.45.0')
    raw_journal=(SESSION/'sk48-actual-public-journal.jsonl.gz').read_bytes()
    journal=[json.loads(line) for line in gzip.decompress(raw_journal).splitlines()]
    assert len(journal)==13 and journal[0]['command'] is None
    observations={};find_observations(report['inventorySourceCalls'],observations)
    assert sorted(observations)==list(range(1,14))
    for index,entry in enumerate(journal):
        observation=observations[index+1];packet=entry['packet']
        for key in ['frame_hash','levels_completed','state','available_action_refs']:assert observation[key]==packet[key],(index,key)
    config=json.loads((SOURCE/'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']['observed_composition_services']
    memory=RootedLineAccess();initial=state(memory);assert not memory.line_events and not memory.line_memory['controls']
    prefixes=[];steps=[];differences=[];used=0
    for prefix_index,prefix in enumerate(report['prefixes']):
        revision=prefix['decisionRevision'];assert revision==used+1
        observation=observations[revision];rows=journal[used]['packet']['frame_rows']
        remaining=report['budget']['levelActionCaps'][observation['level_epoch']-1]-used
        replay_config={**copy.deepcopy(config),'remaining_level_actions':remaining}
        prior_state=state(memory);assert len(memory.line_events)==used
        proposal=plain(memory.propose_graph(copy.deepcopy(observation),copy.deepcopy(rows),[],min(16,remaining),replay_config))
        assert state(memory)==prior_state, 'Proposal must not acquire or replace state'
        captured=prefix['observedRootedLine']['proposal']
        # Exact own layer. The common caller adds only expected_before to source
        # steps and additional top-level envelope fields, recorded separately.
        native_own={key:copy.deepcopy(captured[key]) for key in proposal}
        for item in native_own['steps']:item.pop('expected_before',None)
        own_diff=compare(proposal,native_own,'prefixes['+str(prefix_index)+']')
        differences.extend(own_diff)
        assert proposal['status']=='proposed'
        prefixes.append({'index':prefix_index,'revision':revision,'remainingActions':remaining,'prefixLimit':min(16,remaining),
            'sourceProposal':proposal,'nativeOwnProjection':native_own,'differences':own_diff,
            'nativeAdditionalEnvelopeKeys':sorted(set(captured)-set(proposal)),
            'excludedCommonStepFields':['expected_before'],'sourceStateBefore':state(memory)})
        native_events=prefix['sharedSeries']['rootedLineAcquiredEvents']
        assert len(native_events)==prefix['acquiredActions']
        for index in range(prefix['acquiredActions']):
            before=observations[used+1];after=observations[used+2]
            before_rows=journal[used]['packet']['frame_rows'];later=journal[used+1]['packet']['frame_rows']
            command=proposal['actions'][index]
            assert command==native_events[index]['detail']['command']
            actual_command=journal[used+1]['command'];assert actual_command['action_ref']==command['action_ref'] and actual_command.get('data',{})==command.get('data',{})
            before_meta={'epoch':before['level_epoch'],'score':before['levels_completed'],'observation_ref':before['observation_ref'],'available':before['available_action_refs']}
            after_meta={'epoch':after['level_epoch'],'score':after['levels_completed']}
            guard_before=plain(memory.before(proposal,index,before_rows,**before_meta))
            guard_after=plain(memory.after(proposal,index,before_rows,later,**after_meta))
            assert guard_before['admitted']
            emitted=memory.record(copy.deepcopy(before),copy.deepcopy(command),copy.deepcopy(after),copy.deepcopy(before_rows),copy.deepcopy(later),proposal,index)
            own_events=[plain(e) for e in emitted if e.get('kind')=='observed_rooted_line'];assert len(own_events)==1
            event_diff=compare(own_events[0],native_events[index],'events['+str(used)+']');differences.extend(event_diff)
            expected=proposal['rooted_line_plan']['predictions'][index]
            observed_scene=scene(later);observed=None if observed_scene is None else physical(observed_scene)
            steps.append({'sequence':used+1,'prefixIndex':prefix_index,'index':index,'beforeRevision':used+1,'afterRevision':used+2,
                'command':command,'beforeMeta':before_meta,'afterMeta':after_meta,'beforeGuard':guard_before,'afterGuard':guard_after,
                'sourceOwnEvent':own_events[0],'nativeOwnEvent':native_events[index],'eventDifferences':event_diff,
                'sourceEmittedKinds':[e['kind'] for e in emitted], 'expectedPhysical':expected,'observedPhysical':plain(observed),
                'physicalDifferences':[] if expected is None else compare(expected,observed),
                'sourceStateAfter':state(memory)})
            used+=1
    assert used==12 and len(prefixes)==5 and memory.line_memory==native_events[-1]['memory']
    final_observation=observations[13];final_rows=journal[12]['packet']['frame_rows']
    terminal=plain(memory.propose_graph(copy.deepcopy(final_observation),copy.deepcopy(final_rows),[],16,{**copy.deepcopy(config),'remaining_level_actions':588}))
    final=state(memory);restored=RootedLineAccess()
    # A separate reconstruction uses source-produced events only after replay.
    for event in memory.line_events:restored.apply_event(copy.deepcopy(event))
    assert restored.line_memory==memory.line_memory and restored.line_events==memory.line_events
    output={'schema':'logos-engine.lot3d.rooted-public-source-replay.v1','sourceCommit':COMMIT,'game':'SK48',
        'initialState':initial,'prefixes':prefixes,'steps':steps,'terminalSourceRefusal':terminal,'finalState':final,
        'restorationOwnLayerEqual':True,'originalFilesVerifiedBefore':verified,'originalFilesVerifiedAfter':verify_source(),
        'inputHashes':{name:sha((SESSION/name).read_bytes()) for name in ['sk48-campaign.json.gz','sk48-actual-public-journal.jsonl.gz','execution-sk48.json']},
        'scriptSha256':sha(Path(__file__).read_bytes()),'differences':differences,
        'firstPredictionMismatch':next((step['sequence'] for step in steps if step['afterGuard']['matched'] is False),None),
        'qualification':'Cold own-layer replay through unchanged Python; commands and returns are only those already captured. Native proposal memory never seeds source. Added common envelope fields and own state are distinguished. No game or full original caller replay. Time deadline omitted for deterministic completed-work comparison; source node/depth/microstep bounds retained.'}
    target=HERE/'sk48-public-source-replay.json.gz';target.write_bytes(gzip.compress(json.dumps(output,separators=(',',':'),sort_keys=True).encode(),mtime=0))
    print(json.dumps({'path':str(target.relative_to(ROOT)),'bytes':target.stat().st_size,'sha256':sha(target.read_bytes()),
        'prefixes':len(prefixes),'returns':len(steps),'differences':len(differences),'firstPredictionMismatch':output['firstPredictionMismatch'],
        'terminal':terminal,'originalFilesVerified':verified}))
    if differences:sys.exit(1)

if __name__=='__main__':main()
