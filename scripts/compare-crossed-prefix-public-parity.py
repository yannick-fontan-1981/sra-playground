#!/usr/bin/env python3
"""Cold original CrossedPrefix replay over an explicit completed public campaign.

Reads no game engine, specification or solution. Native captured plan state is
comparison data only. Actual returns drive the unchanged original from empty
own memory. Counterfactuals remove only earlier acquired own journal evidence.
"""
from __future__ import annotations
import argparse
import copy
from datetime import datetime, timezone, timedelta
import gzip
import hashlib
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source'
sys.path[:0]=[str(SOURCE),str(SOURCE/'agents/yf_arc3_v6/laya_proto')]
from common_crossed_prefix import CrossedPrefixAccess,CrossedPrefixConstraint,geometry,measure_controls
from common_supported_lines import SupportedLineAccess
from neutral_observer import measure
from terminal_composition import identity
from src_bridge import plain

OWN={'crossed_prefix_state','crossed_prefix_input','crossed_prefix_pair'}
MANIFEST=json.loads((SOURCE.parent/'manifest.json').read_text())['files']
LOCAL=timezone(timedelta(hours=-3))


def sha(data):return hashlib.sha256(data).hexdigest()
def label(path):
    try:return path.relative_to(ROOT).as_posix()
    except ValueError:return str(path)
def file_record(path):
    data=path.read_bytes();return {'path':label(path),'bytes':len(data),'sha256':sha(data)}
def read(path):
    data=path.read_bytes();return json.loads(gzip.decompress(data) if path.suffix=='.gz' else data)
def verify_source():
    for name,expected in MANIFEST.items():assert sha((SOURCE/name).read_bytes())==expected['sha256'],name
    return len(MANIFEST)
def error_value(error):return {'type':type(error).__name__,'message':str(error)}
def public_command(value):return {'action_ref':value['action_ref'],'data':value.get('data',{})}


def differences(left,right,path=''):
    left,right=plain(left),plain(right)
    if left==right:return []
    if isinstance(left,dict) and isinstance(right,dict):
        out=[]
        for key in sorted(set(left)|set(right)):
            if key not in left or key not in right:out.append({'path':path+'.'+key,'sourcePresent':key in left,'nativePresent':key in right})
            else:out.extend(differences(left[key],right[key],path+'.'+key))
        return out
    if isinstance(left,list) and isinstance(right,list) and len(left)==len(right):
        return [item for i,(a,b) in enumerate(zip(left,right)) for item in differences(a,b,path+f'[{i}]')]
    return [{'path':path,'source':left,'native':right}]


def compare_complete_source(source,native):
    """Keep every source property; record native-only envelope additions.

    The full own plan, actions and source bundle compare strictly. Elsewhere only
    documented envelope additions may remain, and their paths/values are saved.
    No source field is dropped to manufacture parity.
    """
    extras=[]
    def project(value,captured,path=''):
        if isinstance(value,dict) and isinstance(captured,dict):
            for key in sorted(set(captured)-set(value)):
                extras.append({'path':path+'.'+key,'value':plain(captured[key])})
            return {key:project(child,captured[key],path+'.'+key) for key,child in value.items() if key in captured}
        if isinstance(value,list) and isinstance(captured,list) and len(value)==len(captured):
            return [project(a,b,path+f'[{i}]') for i,(a,b) in enumerate(zip(value,captured))]
        return captured
    projected=project(source,native)
    diff=differences(source,projected)
    for key in ['crossed_prefix_plan','actions','bundle_template']:
        if key in source:diff.extend(differences(source[key],native.get(key),'.strict.'+key))
    return diff,extras


def projection(memory):
    return plain({'cross_state':memory.cross_state,'cross_pairs':memory.cross_pairs,
                  'cross_axis_inputs':{str(k):sorted(v) for k,v in memory.cross_axis_inputs.items()},
                  'cross_events':memory.cross_events})
def state(memory):
    p=projection(memory)
    return {'acquiredState':{key:value for key,value in p.items() if key!='cross_events'},
            'eventsDigest':identity(p['cross_events']),'projectionDigest':identity(p),
            'eventCount':len(p['cross_events']),'parentDigest':SupportedLineAccess.retained_digest(memory),
            'digest':memory.retained_digest()}
def knowledge_projection(memory):
    return {key:value for key,value in projection(memory).items() if key!='cross_events'}
def restore(events):
    memory=CrossedPrefixAccess()
    for event in copy.deepcopy(events):memory.apply_event(event)
    return memory
def restore_check(memory):
    rebuilt=restore(memory.cross_events)
    assert projection(rebuilt)==projection(memory)
    parent=SupportedLineAccess.retained_digest(memory)
    p=projection(rebuilt)
    suffix=identity([parent,p['cross_state'],p['cross_pairs'],p['cross_axis_inputs'],p['cross_events']])
    assert suffix==memory.retained_digest()
    return rebuilt,{'ownProjectionEqual':True,'eventCount':len(memory.cross_events),
                    'projectionDigest':identity(p),'opaqueOriginalParentDigest':parent,
                    'restoredSuffixOnOriginalParent':suffix,'freshParentDigest':SupportedLineAccess.retained_digest(rebuilt)}


def find_observations(value,found):
    if isinstance(value,dict):
        if all(k in value for k in ['observation_ref','revision','level_epoch','available_action_refs','entities']):
            ref=value['observation_ref'];assert ref not in found or found[ref]==value
            found[ref]=value
        else:
            for child in value.values():find_observations(child,found)
    elif isinstance(value,list):
        for child in value:find_observations(child,found)
def transitions(prefix):
    names=[key for key in ['inventoryAcquisition','reactionAcquisition','reactiveAcquisition','recolorAcquisition']
           if isinstance(prefix.get(key,{}).get('transitions'),list)]
    assert names,'Missing independent sealed transitions'
    values=prefix[names[0]]['transitions']
    for key in names[1:]:assert prefix[key]['transitions']==values
    assert len(values)==prefix['acquiredActions']
    return values,names


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('session',type=Path)
    parser.add_argument('--selection',required=True,type=Path,help='Retained cumulative case-clock declaration')
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args();session=args.session.resolve();selection_path=args.selection.resolve()
    selection=read(selection_path);deadline=datetime.fromisoformat(selection['resumeDeadline'])
    def clock_check():
        if datetime.now(timezone.utc)>=deadline:raise TimeoutError('Retained cumulative game-case deadline reached; no further case analysis authorized')
    clock_check();started=datetime.now(LOCAL).isoformat()
    paths=sorted(session.glob('*-campaign.json.gz'));assert len(paths)==1
    report_path=paths[0];report=read(report_path);game=report['game'];slug=game.lower()
    assert game==selection['game'] and re.fullmatch('[A-Z0-9]{4}',game)
    journal_path=session/(slug+'-actual-public-journal.jsonl.gz');trace_path=session/(slug+'-public-trace.json.gz')
    execution_path=session/('execution-'+slug+'.json');manifest_path=session/'source-manifest.json'
    journal=[json.loads(line) for line in gzip.decompress(journal_path.read_bytes()).splitlines() if line]
    trace=read(trace_path);execution=read(execution_path);manifest=read(manifest_path)
    assert trace['packets']==journal and journal[0]['command'] is None
    assert report['sourceUnchangedDuringRun'] and report['pythonAgentModules']==[]
    assert execution['nativeSourceUnchanged'] and execution['executionCodeUnchanged']
    assert report['source']['digest']==manifest['digest']==execution['nativeSourceManifestDigest']==selection['nativeDigest']
    for name,digest in manifest['files'].items():assert sha((ROOT/name).read_bytes())==digest,name
    originals_before=verify_source()
    input_paths=[report_path,journal_path,trace_path,execution_path,manifest_path,selection_path,Path(__file__),SOURCE.parent/'manifest.json']
    input_receipts=[file_record(p) for p in input_paths]
    assert len(journal)==len(report['actions'])+1
    assert sum(p['acquiredActions'] for p in report['prefixes'])==len(report['actions'])
    for i,entry in enumerate(journal):
        packet=entry['packet'];assert packet['step_index']==i
        assert identity(packet['frame_rows'])[:16]==packet['frame_hash']
        if i:assert entry['command']==report['actions'][i-1]['command']
    captured_observations={};find_observations(report.get('inventorySourceCalls',[]),captured_observations)
    observation_cache={};observation_receipts=[]
    def observation(packet,reference):
        if reference in observation_cache:
            old=observation_cache[reference];assert old['rasterDigest']==identity(packet['frame_rows']);return old['value']
        match=re.fullmatch(r'(.*):epoch:(\d+):revision:(\d+):frame:([a-f0-9]+)',reference)
        assert match and int(match[2])==packet['level'] and match[4]==packet['frame_hash']
        value,_=measure(SimpleNamespace(**packet),int(match[3]),match[1]);value=plain(value)
        assert value['observation_ref']==reference
        captured=captured_observations.get(reference)
        if captured is not None:assert value==captured,('Full public observation mismatch',reference)
        observation_cache[reference]={'value':value,'rasterDigest':identity(packet['frame_rows'])}
        observation_receipts.append({'observationRef':reference,'revision':value['revision'],
            'rasterDigest':identity(packet['frame_rows']),'observationDigest':identity(value),
            'capturedInventoryObservationMatched':captured is not None})
        return value
    def context(packet,reference,cursor):
        value=observation(packet,reference);cap=report['budget']['levelActionCaps'][packet['levels_completed']]
        spent=sum(a['levelBefore']==packet['level'] for a in report['actions'][:cursor]);remaining=cap-spent
        assert remaining>0
        inputs=[{'action_ref':a} for a in packet['available_action_refs'] if a!='ACTION6']
        return value,inputs,remaining
    def bounded_source_domain(memory,value,rows):
        clock_check()
        s=memory.cross_state
        g=geometry(rows) if s is None or s.get('epoch')!=value['level_epoch'] else s.get('layout')
        if g is None:return {'controllers':0,'assignments':0,'withinReplayDomain':True}
        controls=measure_controls(rows,g)
        if controls is None:return {'controllers':0,'assignments':0,'withinReplayDomain':True}
        product=1
        for c in controls:product*=len({c['color'],*(a['color'] for a in c.get('alternatives',[]))})
        return {'controllers':len(controls),'assignments':product,'withinReplayDomain':len(controls)<=128 and product<=65536}
    def common_proposal(memory,value,rows,inputs,remaining):
        domain=bounded_source_domain(memory,value,rows)
        if not domain['withinReplayDomain']:raise RuntimeError('Original exhaustive product exceeds the declared native-completed replay domain: '+str(domain))
        wrapper=CrossedPrefixConstraint();wrapper.memory=memory
        p=wrapper.cross_propose(copy.deepcopy(value),copy.deepcopy(rows),copy.deepcopy(inputs),remaining)
        if p:wrapper.bind(p,SimpleNamespace(bindings={(value['level_epoch'],value['frame_hash'])}))
        return plain(p),domain
    def decision(proposal):
        plan=(proposal or {}).get('crossed_prefix_plan',{})
        return {'status':None if proposal is None else proposal.get('status'),'reason':None if proposal is None else proposal.get('reason'),
                'actions':[] if proposal is None else proposal.get('actions',[]),'mode':plan.get('mode'),
                'controller':plan.get('controller',{}).get('key'),'intent':plan.get('intent',{})}
    def action_projection(proposal):
        d=decision(proposal);return {key:d[key] for key in ['status','reason','actions']}
    memory=CrossedPrefixAccess();result={'coldStart':True,'primedFromCapturedProposalMemory':False,
        'initialState':state(memory),'prefixes':[],'steps':[],'restorations':[],'foreignPrefixes':[],'differences':[],'stop':None}
    ablations=[];cursor=0;captured_count=0
    def ablate(proposal,value,pixels,inputs,remaining,prefix_index):
        history=plain(memory.cross_events)
        for intervention in ['remove_pairs','remove_axis_inputs','remove_local_state','remove_last_acquired_return']:
            clock_check()
            if intervention=='remove_pairs':modified=[e for e in history if e['kind']!='crossed_prefix_pair']
            elif intervention=='remove_axis_inputs':modified=[e for e in history if e['kind']!='crossed_prefix_input']
            elif intervention=='remove_local_state':modified=[e for e in history if e['kind']!='crossed_prefix_state']
            else:
                # Own return batches end in a state event. Remove only the last
                # batch, retaining every earlier event unchanged and in order.
                previous=[i for i,e in enumerate(history[:-1]) if e['kind']=='crossed_prefix_state']
                modified=history[:previous[-1]+1] if previous else []
            altered=restore(modified);item={'prefixIndex':prefix_index,'intervention':intervention,
                'earlierAcquiredEvents':len(history),'retainedEvents':len(modified),'removedEvents':len(history)-len(modified),
                'actualProjectionDigest':identity(projection(memory)),'counterfactualProjectionDigest':identity(projection(altered)),
                'knowledgeChanged':knowledge_projection(memory)!=knowledge_projection(altered),'actual':decision(proposal),
                'scope':'Source component counterfactual at an actual selected public context; only named earlier acquired events are omitted. No game, common-caller ablation, future event, or learned seed is supplied.'}
            try:
                alternative,domain=common_proposal(altered,value,pixels,inputs,remaining)
                item.update(executed=True,replayDomain=domain,counterfactual=decision(alternative),
                    actionOrRefusalChanged=action_projection(alternative)!=action_projection(proposal),
                    decisionChanged=decision(alternative)!=decision(proposal),strictProposalChanged=alternative!=proposal)
            except Exception as error:
                item.update(executed=False,error=error_value(error),actionOrRefusalChanged=None,decisionChanged=None,strictProposalChanged=None)
            ablations.append(item)
    for pi,prefix in enumerate(report['prefixes']):
        clock_check();captured=prefix.get('observedCrossedPrefix');series=prefix.get('sharedSeries',{})
        own_events=series.get('crossedPrefixAcquiredEvents',[]);assert isinstance(own_events,list)
        captured_count+=len(own_events);assert series.get('crossedPrefixEventCount',0)==captured_count
        if captured is None:
            assert not own_events
            result['foreignPrefixes'].append({'index':pi,'id':prefix.get('id'),'family':prefix['family'],'firstSequence':cursor+1,'acquiredActions':prefix['acquiredActions']})
            cursor+=prefix['acquiredActions'];continue
        packet=journal[cursor]['packet'];native=captured['proposal'];reference=native['crossed_prefix_plan']['observation_ref']
        value,inputs,remaining=context(packet,reference,cursor)
        before_state=state(memory)
        try:p,replay_domain=common_proposal(memory,value,packet['frame_rows'],inputs,remaining)
        except Exception as error:
            result['stop']={'kind':'source_exception','phase':'propose','prefixIndex':pi,'error':error_value(error)};break
        assert state(memory)==before_state
        if not p or p.get('status')!='proposed':
            result['stop']={'kind':'source_own_proposal_missing','prefixIndex':pi,'source':p};break
        diff,extras=compare_complete_source(p,native)
        result['differences'].extend(diff)
        entry={'index':pi,'id':prefix.get('id'),'position':cursor,'observationRef':reference,'observation':value,
            'inputs':inputs,'remainingActions':remaining,'sourceProposal':p,'sourceStateBefore':before_state,
            'replayDomain':replay_domain,'proposalDifferences':diff,'nativeAdditionalEnvelopeFields':extras}
        result['prefixes'].append(entry)
        if diff:result['stop']={'kind':'proposal_difference','prefixIndex':pi};break
        restored,restoration=restore_check(memory);p2,_=common_proposal(restored,value,packet['frame_rows'],inputs,remaining)
        assert p2==p;restoration.update(prefixIndex=pi,phase='before_prefix',nextProposalEqual=True)
        result['restorations'].append(restoration)
        ablate(p,value,packet['frame_rows'],inputs,remaining,pi)
        sealed,names=transitions(prefix);event_cursor=0;previous_after=None
        assert len(sealed)==1,'Crossed source always seals its one-step proposal'
        for index,transition in enumerate(sealed):
            clock_check();position=cursor+index;first_packet=journal[position]['packet'];later_packet=journal[position+1]['packet']
            assert transition['before']==(reference if index==0 else previous_after)
            before=observation(first_packet,transition['before']);after=observation(later_packet,transition['after']);previous_after=after['observation_ref']
            command=p['actions'][index]
            assert transition['command']==command and public_command(command)==public_command(journal[position+1]['command'])
            rows=first_packet['frame_rows'];later=later_packet['frame_rows']
            before_meta={'epoch':before['level_epoch'],'score':before['levels_completed'],'observation_ref':before['observation_ref'],'available':before['available_action_refs']}
            after_meta={'epoch':after['level_epoch'],'score':after['levels_completed'],'state':after['state']}
            try:
                before_guard=plain(memory.before(p,index,rows,**before_meta));after_guard=plain(memory.after(p,index,rows,later,**after_meta))
                assert before_guard['admitted'] and after_guard['seal_prefix']
                outcome_diff=differences(after_guard,transition['outcome'],f'outcomes[{position}]')
                prior=state(memory)
                emitted=memory.record(copy.deepcopy(before),copy.deepcopy(command),copy.deepcopy(after),copy.deepcopy(rows),copy.deepcopy(later),copy.deepcopy(p),index)
            except Exception as error:
                result['stop']={'kind':'source_exception','phase':'return','prefixIndex':pi,'sequence':position+1,'error':error_value(error)};break
            own=[plain(e) for e in emitted if e['kind'] in OWN]
            event_diff=differences(own,own_events[event_cursor:event_cursor+len(own)],f'events[{position}]');event_cursor+=len(own)
            result['differences'].extend(outcome_diff+event_diff)
            rebuilt,return_restore=restore_check(memory);return_restore.update(prefixIndex=pi,phase='after_return',sequence=position+1)
            result['restorations'].append(return_restore)
            result['steps'].append({'sequence':position+1,'prefixIndex':pi,'index':index,'command':command,
                'before':before,'after':after,'beforeMeta':before_meta,'afterMeta':after_meta,'beforeGuard':before_guard,'afterGuard':after_guard,
                'capturedOutcome':transition['outcome'],'guardDifferences':outcome_diff,'sourceOwnEvents':own,'eventDifferences':event_diff,
                'sourceEmittedKinds':[e['kind'] for e in emitted],'sourceStateBefore':prior,'sourceStateAfter':state(memory),
                'sealedTransitionSources':names,'boundary':before['level_epoch']!=after['level_epoch']})
            if outcome_diff or event_diff:result['stop']={'kind':'return_difference','prefixIndex':pi,'sequence':position+1};break
        if result['stop']:break
        assert event_cursor==len(own_events) and len(memory.cross_events)==captured_count
        cursor+=prefix['acquiredActions']
    result['finalState']=state(memory);_,restoration=restore_check(memory)
    result['restorations'].append({**restoration,'phase':'final'})
    selected=[p for p in report['prefixes'] if 'observedCrossedPrefix' in p]
    selected_actions=sum(p['acquiredActions'] for p in selected)
    selected_events=sum(len(p['sharedSeries'].get('crossedPrefixAcquiredEvents',[])) for p in selected)
    complete=(result['stop'] is None and not result['differences'] and len(result['prefixes'])==len(selected) and len(result['steps'])==selected_actions)
    originals_after=verify_source()
    for item in input_receipts:
        path=ROOT/item['path'];assert file_record(path)==item
    clock_check()
    status='passed' if complete and selected else 'no_selected_crossed_prefix' if not selected else 'failed'
    output={'schema':'logos-engine.lot3h.crossed-prefix-public-source-parity.v1','status':status,
        'startedAt':started,'recordedAt':datetime.now(LOCAL).isoformat(),'displayTimeZone':'UTC-03:00',
        'game':game,'sourceCommit':COMMIT,'sessionPath':label(session),'inputs':input_receipts,
        'nativeSourceDigest':manifest['digest'],'nativeFilesVerified':len(manifest['files']),
        'caseSelection':file_record(selection_path),'caseDeadline':selection['resumeDeadline'],
        'originalFilesVerifiedBefore':originals_before,'originalFilesVerifiedAfter':originals_after,
        'capturedGameActions':len(journal)-1,'capturedSelectedCrossedActions':selected_actions,'capturedSelectedCrossedEvents':selected_events,
        'newGameActions':0,'levelJumps':0,'fullInheritedCallerParity':False,'completeSelectedOwnTrajectoryParity':complete,
        'originalObservationReceipts':observation_receipts,'exactOriginal':result,'capturedCommonTerminal':report['final'],
        'ablation':{'scope':'unchanged_original_component_at_actual_public_contexts','interventions':len(ablations),
            'executed':sum(a['executed'] for a in ablations),'unexecuted':sum(not a['executed'] for a in ablations),
            'knowledgeChanges':sum(a['knowledgeChanged'] for a in ablations),
            'actionOrRefusalChanges':sum(a.get('actionOrRefusalChanged') is True for a in ablations),
            'decisionChanges':sum(a.get('decisionChanged') is True for a in ablations),
            'strictOnlyChanges':sum(a.get('strictProposalChanged') is True and not a.get('decisionChanged') for a in ablations),
            'negativeOrUnchanged':sum(a['executed'] and not a.get('actionOrRefusalChanged') for a in ablations),'cases':ablations},
        'qualification':'Own source component and common wrapper start cold. Every source proposal field is compared, with all own-plan/action/bundle fields strict; native-only envelope additions are listed, never used to prime state. Actual returned commands and complete public observations drive source acquisition. Parent digest is an opaque boundary, not full caller parity. Ablations omit only earlier acquired event types or the final earlier return batch, preserving null and negative results; they are component counterfactuals, not a new live campaign or a full-caller ablation. Source calls are limited to domains whose exhaustive product fits the declared completed native assignment domain; interruption/timing is not replayed. Captured official campaign outcome remains separate. No game engine, specification, solution or native module was executed.'}
    target=args.output.resolve();target.parent.mkdir(parents=True,exist_ok=True)
    data=gzip.compress(json.dumps(output,separators=(',',':'),ensure_ascii=False).encode(),mtime=0)
    with target.open('xb') as stream:stream.write(data)
    print(json.dumps({'status':status,'output':label(target),'bytes':len(data),'sha256':sha(data),
        'prefixes':len(result['prefixes']),'returns':len(result['steps']),'events':result['finalState']['eventCount'],
        'restorations':len(result['restorations']),'differences':len(result['differences']),'stop':result['stop'],
        'ablations':len(ablations),'actionOrRefusalChanges':output['ablation']['actionOrRefusalChanges']}))
    if status!='passed':raise SystemExit(1)


if __name__=='__main__':main()
