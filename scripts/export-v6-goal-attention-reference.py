#!/usr/bin/env python3
"""Original goal adapter, attention and information election references."""
from pathlib import Path
from copy import deepcopy
import hashlib,json,sys,tempfile
ROOT=Path(__file__).resolve().parents[1];COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(LAYA),str(SOURCE)]
from goal_access_adapter import GoalAccessAdapter
from attention_memory import AttentionMemory
from memory import Memory
import composition_curiosity as curiosity

def plain(value):return json.loads(json.dumps(value,ensure_ascii=False))
def capture(collection,name,kind,args,fn):
    row=dict(id=name,kind=kind,args=deepcopy(args))
    try:row['expected']=plain(fn())
    except Exception as e:row['error']=str(e)
    collection.append(row);return row.get('expected')

def export():
    composition=json.loads((ROOT/'tests/fixtures/v6-composition-reference.json').read_text())
    goals=[];goal_steps=[];information=[];attention=[]
    for case in composition['cases']:
        if case['operation']!='memory_propose':continue
        args=case['arguments'];scene=composition['scenes'][args['scene']]
        for maximum in [1,16]:
            adapter=GoalAccessAdapter();adapter.memory.models=deepcopy(args['models'])
            capture(goals,f'{case["id"]}:{maximum}','propose',dict(args,max_prefix=maximum),lambda:adapter.propose(scene['observation'],scene['rows'],args['actions'],maximum))
    args=next(case['arguments']for case in composition['cases']if case['id']=='bound_memory_proposal');scene=composition['scenes'][args['scene']]
    capture(goals,'no_models','propose',dict(args,models=[],max_prefix=16),lambda:GoalAccessAdapter().propose(scene['observation'],scene['rows'],args['actions'],16))
    adapter=GoalAccessAdapter();adapter.memory.models=deepcopy(args['models']);proposal=adapter.propose(scene['observation'],scene['rows'],args['actions'],16)
    before=deepcopy(scene['observation']);rows=deepcopy(scene['rows']);before['entities']=[deepcopy(e)for e in before['entities']];before['state']='NOT_FINISHED'
    for index,step in enumerate(proposal['goal_access_plan']['prefix']):
        after_rows=deepcopy(rows);x,y=step['from'];u,v=step['to'];after_rows[y][x]=0;after_rows[v][u]=9
        after=deepcopy(before);after['observation_ref']=f'goal-return:{index}';after['frame_hash']=f'goal-frame:{index}'
        for e in after['entities']:
            if e['signature']==proposal['goal_access_plan']['role']:e['bbox']=[u,v,u,v];e['position']=[u,v]
        command=proposal['actions'][index]
        before_options=dict(epoch=before['level_epoch'],score=before['levels_completed'],available=[a['action_ref']for a in args['actions']],observation_ref=before['observation_ref'])
        after_options=dict(epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
        goal_steps.append(dict(proposal=proposal,index=index,before=deepcopy(before),before_rows=deepcopy(rows),command=command,after=after,after_rows=after_rows,
                               before_options=before_options,after_options=after_options,
                               expected_before=adapter.before(proposal,index,rows,**before_options),expected_after=adapter.after(proposal,index,rows,after_rows,**after_options),
                               events=plain(adapter.record(before,rows,command,after,after_rows,proposal=proposal,index=index)),retained=plain(adapter.memory.retained_state())))
        before,rows=after,after_rows
    def entity(sig,box):return dict(signature=sig,bbox=box,identity_ambiguous=False)
    a=dict(observation_ref='attention:a',revision=1,frame_hash='A',level_epoch=1,levels_completed=0,state='NOT_FINISHED',
           entities=[entity('a',[1,1,1,1]),entity('b',[10,1,10,1]),entity('c',[1,10,1,10]),entity('moving',[4,4,4,4])])
    b=deepcopy(a);b.update(observation_ref='attention:b',revision=2,frame_hash='B');b['entities'][-1]['bbox']=[7,4,7,4]
    question=dict(observation_ref=a['observation_ref'],pair_ref='pair:one',action_ref='ACTION1',experiment='replicate_translation',objective='Check role movement',expected_motion={'moving':[3,0]},evidence=['earlier',a['observation_ref']])
    for variant in ['matched','contradicted','unobserved','superseded','boundary','expired','interrupted']:
        memory=Memory(Path(tempfile.mkdtemp())/'attention.sqlite');agent=AttentionMemory(memory,'episode')
        scenario=dict(id=variant,steps=[]);attention.append(scenario)
        def step(method,*arguments,focus=False):
            row=dict(method=method,args=deepcopy(arguments),focus=focus)
            actual=list(arguments)
            if focus:actual[-1]=agent.item['id']
            result=getattr(agent,method)(*actual)
            row.update(expected=plain(result),state=plain({'item':agent.item,'composition':agent.composition}))
            facts={key:memory.get('episode',key)for key in ['attention','attention_composition']if memory.db.execute('SELECT 1 FROM facts WHERE episode=? AND k=?',('episode',key)).fetchone()}
            row['facts']=plain(facts);scenario['steps'].append(row);return result
        step('open',question,a);step('matches',question,a);step('open',question,a)
        changed=deepcopy(question);changed['pair_ref']='different';step('open',changed,a)
        if variant=='expired':step('revalidate',b)
        elif variant=='interrupted':step('close_pending',a,'host_interruption')
        else:
            after=deepcopy(b);command={'action_ref':'ACTION1'}
            if variant=='contradicted':after['entities'][-1]['bbox']=[8,4,8,4]
            if variant=='unobserved':after['entities']=after['entities'][-1:]
            if variant=='superseded':command['data']={}
            if variant=='boundary':after['level_epoch']=2
            step('observe',a,after,command,None,focus=True);step('take_parent_return',after);step('take_parent_return',after)
        step('retain_composition','owner','target','Compose a target',[a['observation_ref'],a['observation_ref'],'older'],a,{'source':'visible'})
        step('composition_for','other',a);step('retain_composition','other','next','Other target',[a['observation_ref']],a)
        step('return_composition','owner','target','achieved',[b['observation_ref']],b)
        step('retain_composition','owner','new','Next target',[b['observation_ref']],b)
        step('composition_for','owner',dict(b,level_epoch=2,observation_ref='new_epoch'))
        memory.close()
    policy=dict(excluded_risks=['protected_resource'],continue_observed_parent=True,order=['worst_case_separation','distinct_relations','recovery_cost','stable_binding'])
    def offer(name,**changes):return dict(source=name,action={'action_ref':name},predictions={'p':True,'q':False},relations=[['e','role','effect']],evidence=['e0'],risks=[],return_steps=1,question='Test relation',observation_ref='obs',level_epoch=1,**changes)
    obs={'observation_ref':'obs','level_epoch':1}
    offers=[offer('ACTION1'),offer('ACTION2')]
    scenarios=[('stable_order',offers,5,None,policy),('no_budget',offers,0,None,policy),('meter_limit',offers,3,{'steps_before_empty':1},policy)]
    rich=[offer('ACTION1'),dict(offer('ACTION2'),predictions={'a':0,'b':1,'c':2},relations=[['e','role','effect'],['e','shape','extent']]),
          dict(offer('ACTION3'),return_steps=None,risks=['local_rewrite']),dict(offer('ACTION4'),engaged_parent=True),
          dict(offer('stale'),level_epoch=2),dict(offer('ungrounded'),evidence=[]),dict(offer('protected'),risks=['protected_resource'])]
    scenarios.extend([('dominance_and_parent',rich,8,None,policy),('dominance_without_parent',rich,8,None,dict(policy,continue_observed_parent=False))])
    for name,offers,remaining,meter,p in scenarios:capture(information,name,'elect',[offers,obs,remaining,meter,p],lambda:list(curiosity.elect(offers,obs,remaining,meter,p)))
    probe={'binding':{'action':{'action_ref':'ACTION6','data':{'x':2,'y':3}},'entity_ref':'e','observation_ref':'obs','mode':[1,'NOT_FINISHED']},
           'frozen_predictions':{'a':True,'b':False,'c':True},'rivals':[{'id':'a','feature':'outline','source_ref':'r1'},{'id':'b','feature':'color','source_ref':'r2'},{'id':'c','feature':'shape','source_ref':'r1'}],
           'new_contrast_pairs':[['a','b'],['b','c']],'feature_partitions':[['outline','shape'],['color']],'question':'Which visible feature predicts change?'}
    capture(information,'point_goal','point_goal',[probe],lambda:curiosity.point_goal(probe))
    for source in ['point_contrast','coupled_displays','motion_contrast','unknown']:
        receipt={'source':source,'predictions':{'yes':True,'no':False,'position':[7,4]},'role_refs':['moving']}
        for boundary in [False,True]:
            after=dict(b,levels_completed=int(boundary));point={'record':{'observed_local_change':True}}
            capture(information,f'reconcile:{source}:{boundary}','reconcile',[receipt,a,after,point,False],lambda:curiosity.reconcile(receipt,a,after,point,external_measurement=False))
    hashes={str(path.relative_to(SOURCE)):hashlib.sha256(path.read_bytes()).hexdigest()for path in [LAYA/'goal_access_adapter.py',LAYA/'attention_memory.py',LAYA/'composition_curiosity.py']}
    destination=ROOT/'tests/fixtures/v6-goal-attention-reference.json'
    destination.write_text(json.dumps(dict(commit=COMMIT,sourceHashes=hashes,goals=goals,goal_steps=goal_steps,attention=attention,information=information),ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(dict(goalCases=len(goals),goalTransitions=len(goal_steps),attentionScenarios=len(attention),informationCases=len(information))))

if __name__=='__main__':export()
