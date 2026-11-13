#!/usr/bin/env python3
"""Cold differential replay of a retained public ReceptionService trajectory.

Lane one executes the unchanged original until its first exception/difference.
Lane two applies the separately declared native owner/budget contract around
unchanged original methods. Neither lane seeds state from a captured proposal.
No game engine, specification, solution, host or new action is loaded.
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
HERE = Path(__file__).resolve().parent
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from reception_service_access import ReceptionServiceAccess
from reception_service_projection import scene, carriers
from rooted_line_access import RootedLineAccess
from terminal_composition import identity
from src_bridge import plain

MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
POLICY_PATH = 'agents/yf_arc3_v6/morphology_policy/strategy.drm'
POLICY = json.loads((SOURCE / POLICY_PATH).read_text())['declarations'][0]['configuration']['observed_composition_services']


def sha(value):return hashlib.sha256(value).hexdigest()
def verify_source():
    for name,value in MANIFEST.items():assert sha((SOURCE/name).read_bytes())==value['sha256'],name
    return len(MANIFEST)
def read_json_gz(path):return json.loads(gzip.decompress(path.read_bytes()))
def find_observations(value,found):
    if isinstance(value,dict):
        if all(key in value for key in ['observation_ref','revision','level_epoch','available_action_refs','entities']):
            old=found.get(value['revision'])
            if old is not None:assert old==value,('inconsistent observation',value['revision'])
            found[value['revision']]=value
        else:
            for child in value.values():find_observations(child,found)
    elif isinstance(value,list):
        for child in value:find_observations(child,found)
def compare(a,b,path=''):
    a=plain(a);b=plain(b)
    if a==b:return []
    if isinstance(a,dict)and isinstance(b,dict):
        result=[]
        for key in sorted(set(a)|set(b)):
            if key not in a or key not in b:result.append({'path':path+'.'+key,'sourcePresent':key in a,'nativePresent':key in b})
            else:result.extend(compare(a[key],b[key],path+'.'+key))
        return result
    if isinstance(a,list)and isinstance(b,list)and len(a)==len(b):
        return [item for index,(left,right)in enumerate(zip(a,b))for item in compare(left,right,path+f'[{index}]')]
    return [{'path':path,'source':a,'native':b}]
def state_receipt(memory):
    return {'memoryDigest':identity(memory.reception_memory),'eventsDigest':identity(memory.reception_events),
            'eventCount':len(memory.reception_events),'parentDigest':RootedLineAccess.retained_digest(memory),
            'digest':memory.retained_digest()}
def error_receipt(error):
    value={'type':type(error).__name__,'message':str(error)}
    if hasattr(error,'errors'):value['errors']=[{'type':e['type'],'loc':list(e['loc'])}for e in error.errors()]
    return value
def nonpoint_inputs(observation):
    # This is the exact nonpoint subset produced by original ObservedInputDomain.
    # Reception's allowed set discards every candidate with a nonempty payload.
    return [{'action_ref':key,'data':{}}for key in sorted(set(observation['available_action_refs'])&{'ACTION1','ACTION2','ACTION3','ACTION4','ACTION5'})]


class DeclaredNativeOwnerAdapter:
    """External policy envelope, never a modification of reference source.

    Persistent state comes exclusively from original source-produced own events.
    The sole state assignment before a record commits the current tentative
    source reset on the actual return, matching the declared native contract.
    """
    def __init__(self,adapted):
        self.memory=ReceptionServiceAccess();self.adapted=adapted;self.adjustments=[]

    def propose(self,observation,rows,inputs,limit,config):
        if not self.adapted:
            return plain(self.memory.propose_graph(copy.deepcopy(observation),copy.deepcopy(rows),copy.deepcopy(inputs),limit,copy.deepcopy(config)))
        work=copy.deepcopy(self.memory);changes=[];cfg=copy.deepcopy(config)
        changed_epoch=work.reception_memory['epoch']!=observation['level_epoch']
        if changed_epoch and 'stationary'in work.reception_memory:
            work.reception_memory.pop('stationary')
            changes.append({'kind':'renew_current_epoch_stationary_witness','epoch':observation['level_epoch']})
        projected=scene(rows,work.reception_memory['scene'])
        if projected is not None:
            tentative=copy.deepcopy(work.reception_memory)
            if changed_epoch:tentative.update(epoch=observation['level_epoch'],scene=projected,controls={},trials={},wait_spent=0,refuted=[])
            remaining=cfg.get('remaining_level_actions',limit)
            declared=cfg.get('level_action_cap',remaining+tentative['wait_spent'])
            maximum=min(128,declared);cfg['level_action_cap']=maximum
            if maximum!=declared:changes.append({'kind':'separate_wait_ceiling','declaredMaximum':declared,'waitMaximum':maximum})
            found=carriers(rows,projected);actor=found[0]if len(found)==1 else None
            allowed={a['action_ref']for a in inputs if not a.get('data')}
            moves={k:v['delta']for k,v in tentative['controls'].items()if k in allowed}
            target=list(projected['target']['anchor'])
            outward=[key for key,delta in moves.items()if [target[0]+delta[0],target[1]+delta[1]]not in projected['cells']]
            if not tentative['refuted']and actor and actor['anchor']==target and outward and tentative['wait_spent']>=maximum:
                changes.append({'kind':'block_exhausted_wait','spent':tentative['wait_spent'],'maximum':maximum})
                self.adjustments.append({'revision':observation['revision'],'phase':'proposal','changes':changes})
                return {'status':'unknown','reason':'reception_wait_budget_exhausted','block_unrelated_probe':True}
        result=plain(work.propose_graph(copy.deepcopy(observation),copy.deepcopy(rows),copy.deepcopy(inputs),limit,cfg))
        self.adjustments.append({'revision':observation['revision'],'phase':'proposal','changes':changes})
        return result

    def record(self,before,command,after,rows,later,proposal,index):
        work=copy.deepcopy(self.memory);changes=[]
        if self.adapted and work.reception_memory['epoch']!=before['level_epoch']:
            # The tentative reset below was generated by this cold original
            # replay; captured native proposal.memory is never an input.
            plan=proposal['reception_service_plan']
            assert plan['memory']['epoch']==before['level_epoch']
            work.reception_memory=copy.deepcopy(plan['memory']);work.reception_memory.pop('stationary',None)
            changes.append({'kind':'commit_current_epoch_on_actual_return','epoch':before['level_epoch']})
        emitted=work.record(copy.deepcopy(before),copy.deepcopy(command),copy.deepcopy(after),copy.deepcopy(rows),copy.deepcopy(later),copy.deepcopy(proposal),index)
        own=[plain(event)for event in emitted if event.get('kind')=='observed_reception_service']
        assert len(own)==1
        # Only own selected proposals are replayed; the inherited shared-list
        # counterexample remains separately retained in the component oracle.
        assert all(e['kind']=='observed_reception_service'for e in work.reception_events)
        self.memory=work
        self.adjustments.append({'revision':after['revision'],'phase':'acquisition','changes':changes})
        return own,[e['kind']for e in emitted]


def main():
    session=Path(sys.argv[1]).resolve()if len(sys.argv)>1 else ROOT/'docs/migration/lot3e-evidence/final/fogw-reception-session'
    reports=sorted(session.glob('*-campaign.json.gz'));assert len(reports)==1,reports
    report_path=reports[0];report=read_json_gz(report_path);game=report['game'];slug=game.lower()
    assert report['final']['nativeImplementation'].endswith('/0.46.0')
    verified=verify_source()
    journal_path=session/(slug+'-actual-public-journal.jsonl.gz')
    journal=[json.loads(line)for line in gzip.decompress(journal_path.read_bytes()).splitlines()]
    assert journal and journal[0]['command']is None
    observations={};find_observations(report['inventorySourceCalls'],observations)
    assert sorted(observations)==list(range(1,len(journal)+1)),('observations incomplete',sorted(observations),len(journal))
    for index,entry in enumerate(journal):
        observation=observations[index+1];packet=entry['packet']
        for key in ['frame_hash','levels_completed','state','available_action_refs']:assert observation[key]==packet[key],(index,key)
        assert observation['level_epoch']==packet['level']
    def budget_at(position):
        observation=observations[position+1];epoch=observation['level_epoch']
        caps=report['budget']['levelActionCaps'];cap=caps[min(epoch-1,len(caps)-1)]
        spent=sum(observations[i+1]['level_epoch']==epoch for i in range(position))
        return cap-spent
    def run_lane(adapted):
        owner=DeclaredNativeOwnerAdapter(adapted);initial=state_receipt(owner.memory)
        result={'mode':'declared_native_owner_adapter'if adapted else'unchanged_original','coldStart':True,
                'primedFromCapturedProposalMemory':False,'initialState':initial,'prefixes':[],'steps':[],'differences':[],
                'stop':None,'foreignPrefixCount':0}
        for prefix_index,prefix in enumerate(report['prefixes']):
            position=prefix['decisionRevision']-1;observation=observations[position+1]
            if 'observedReceptionService'not in prefix:
                assert not prefix['sharedSeries'].get('receptionServiceAcquiredEvents',[])
                result['foreignPrefixCount']+=1;continue
            rows=journal[position]['packet']['frame_rows'];remaining=budget_at(position);limit=min(16,remaining)
            inputs=nonpoint_inputs(observation);config={**copy.deepcopy(POLICY),'remaining_level_actions':remaining}
            prior=state_receipt(owner.memory)
            try:proposal=owner.propose(observation,rows,inputs,limit,config)
            except Exception as error:
                result['stop']={'kind':'original_exception','prefixIndex':prefix_index,'revision':observation['revision'],
                                'remainingActions':remaining,'error':error_receipt(error),'stateUnchanged':state_receipt(owner.memory)==prior}
                break
            assert state_receipt(owner.memory)==prior,'proposal changed acquired state'
            captured=prefix['observedReceptionService']['proposal']
            if proposal.get('status')!='proposed'or'reception_service_plan'not in proposal:
                result['stop']={'kind':'own_proposal_not_produced','prefixIndex':prefix_index,'revision':observation['revision'],'source':proposal};break
            native_own={key:copy.deepcopy(captured[key])for key in proposal if key in captured}
            for step in native_own.get('steps',[]):step.pop('expected_before',None)
            differences=compare(proposal,native_own,'prefixes['+str(prefix_index)+']')
            result['differences']+=differences
            result['prefixes'].append({'index':prefix_index,'revision':observation['revision'],'remainingActions':remaining,'prefixLimit':limit,
                                      'nonpointInputs':inputs,'sourceProposal':proposal,'proposalDifferences':differences,
                                      'nativeAdditionalEnvelopeKeys':sorted(set(captured)-set(proposal)),
                                      'excludedCommonStepFields':['expected_before'],'sourceStateBefore':prior})
            if differences:
                result['stop']={'kind':'proposal_difference','prefixIndex':prefix_index,'revision':observation['revision']};break
            captured_events=prefix['sharedSeries'].get('receptionServiceAcquiredEvents',[])
            assert len(captured_events)==prefix['acquiredActions']
            for index in range(prefix['acquiredActions']):
                pos=position+index;before=observations[pos+1];after=observations[pos+2]
                first=journal[pos]['packet']['frame_rows'];last=journal[pos+1]['packet']['frame_rows']
                command=proposal['actions'][index];actual=journal[pos+1]['command']
                assert command['action_ref']==actual['action_ref']and command.get('data',{})==actual.get('data',{})
                before_meta={'epoch':before['level_epoch'],'score':before['levels_completed'],'observation_ref':before['observation_ref'],'available':before['available_action_refs']}
                after_meta={'epoch':after['level_epoch'],'score':after['levels_completed']}
                guard_before=plain(owner.memory.before(proposal,index,first,**before_meta))
                guard_after=plain(owner.memory.after(proposal,index,first,last,**after_meta))
                assert guard_before['admitted']
                projected_before=scene(first,proposal['reception_service_plan']['scene'])
                projected_after=scene(last,projected_before)
                own,kinds=owner.record(before,command,after,first,last,proposal,index)
                delta=compare(own[0],captured_events[index],'events['+str(pos)+']');result['differences']+=delta
                result['steps'].append({'sequence':pos+1,'prefixIndex':prefix_index,'index':index,
                                        'beforeRevision':pos+1,'afterRevision':pos+2,'command':command,
                                        'beforeMeta':before_meta,'afterMeta':after_meta,'beforeGuard':guard_before,'afterGuard':guard_after,
                                        'sourceProjectionBefore':plain(projected_before),'sourceProjectionAfter':plain(projected_after),
                                        'sourceCarriersAfter':plain(carriers(last,projected_after))if projected_after else[],
                                        'sourceOwnEvent':own[0],'eventDifferences':delta,'sourceEmittedKinds':kinds,
                                        'sourceStateAfter':state_receipt(owner.memory)})
                if delta:
                    result['stop']={'kind':'event_difference','prefixIndex':prefix_index,'sequence':pos+1};break
            if result['stop']:break
        result['finalState']=state_receipt(owner.memory);restored=ReceptionServiceAccess()
        for event in owner.memory.reception_events:restored.apply_event(copy.deepcopy(event))
        result['restorationOwnLayerEqual']=(restored.reception_memory==owner.memory.reception_memory and restored.reception_events==owner.memory.reception_events)
        assert result['restorationOwnLayerEqual']
        if result['stop']is None and report['final']['levelsCompleted']<3:
            position=len(journal)-1;observation=observations[position+1];remaining=budget_at(position)
            if remaining>0:
                try:result['terminalProposal']=owner.propose(observation,journal[-1]['packet']['frame_rows'],nonpoint_inputs(observation),min(16,remaining),
                                                            {**copy.deepcopy(POLICY),'remaining_level_actions':remaining})
                except Exception as error:result['terminalException']=error_receipt(error)
            else:result['terminalQualification']='Common remaining-action gate is zero; no own proposal is invoked.'
        result['adjustments']=owner.adjustments
        return result
    exact=run_lane(False);adapted=run_lane(True)
    report_actions=sum(prefix['acquiredActions']for prefix in report['prefixes'])
    assert report_actions==len(journal)-1,(report_actions,len(journal))
    selected_actions=sum(prefix['acquiredActions']for prefix in report['prefixes']if'observedReceptionService'in prefix)
    status='passed_with_declared_native_adaptations'if adapted['stop']is None and not adapted['differences']and len(adapted['steps'])==selected_actions else'failed'
    input_paths=[report_path,journal_path,SOURCE/POLICY_PATH,Path(__file__)]
    execution=session/('execution-'+slug+'.json')
    if execution.exists():input_paths.append(execution)
    output={'schema':'logos-engine.lot3e.reception-public-source-replay.v1','status':status,'game':game,'sourceCommit':COMMIT,
            'sessionPath':str(session.relative_to(ROOT)),'inputs':{str(p.relative_to(ROOT)):sha(p.read_bytes())for p in input_paths},
            'originalFilesVerifiedBefore':verified,'originalFilesVerifiedAfter':verify_source(),
            'capturedGameActions':len(journal)-1,'capturedSelectedReceptionActions':selected_actions,
            'newGameActions':0,'levelJumps':0,'exactOriginal':exact,'adaptedOriginal':adapted,
            'capturedCommonTerminal':report['final'],
            'qualification':'Both lanes start cold and use only actual retained public observations/commands/returns. The exact original stops at its first recorded exception or discrepancy; its limitation is not hidden. The adapted lane wraps unchanged original methods with the declared separate owner, current-epoch/stationary renewal and cumulative wait ceiling contracts. Captured native proposal.memory never initializes either lane. Point candidates are irrelevant to the consumed nonpoint allowed set. Physical time deadlines are omitted for deterministic comparison of completed work. No full original caller parity, new game action, game code or inferred success is claimed.'}
    target=HERE/(slug+'-public-source-replay.json.gz')
    target.write_bytes(gzip.compress(json.dumps(output,separators=(',',':'),sort_keys=True).encode(),mtime=0))
    print(json.dumps({'path':str(target.relative_to(ROOT)),'status':status,'sha256':sha(target.read_bytes()),'bytes':target.stat().st_size,
                      'exactOriginal':{'prefixes':len(exact['prefixes']),'returns':len(exact['steps']),'stop':exact['stop'],'differences':len(exact['differences'])},
                      'adaptedOriginal':{'prefixes':len(adapted['prefixes']),'returns':len(adapted['steps']),'stop':adapted['stop'],'differences':len(adapted['differences'])},
                      'originalFilesVerified':verified}))
    if status=='failed':sys.exit(1)


if __name__=='__main__':main()
