#!/usr/bin/env python3
"""Offline source oracle for typed derivation, target binding and caller projections."""
from pathlib import Path
from copy import deepcopy
from types import SimpleNamespace
import ast, hashlib, json, sys

ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
REF=ROOT/'reference/v6'/COMMIT/'source'; LAYA=REF/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(LAYA),str(REF)]
from target_tree import CompositionTargetTree
from agents.yf_arc3_v6.morphology_policy.derive import derive
from agents.yf_arc3_v6.morphology_policy.observed_derivations import observed_derivations

tree=CompositionTargetTree(); cases=[]
def sha(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def plain(value):return json.loads(json.dumps(value,ensure_ascii=False))
def capture(operation,name,args,call):
    item=dict(operation=operation,id=name,args=deepcopy(args))
    try:item['expected']=plain(call())
    except Exception as error:item['error']=str(error)
    cases.append(item)
def derivation(name,patch=lambda c,t,m,o:None):
    current=dict(facts=dict(stage='a',safe=True),resources=dict(energy=5),persistent_effects={},scope=dict(epoch=1),
        observations=dict(goal=dict(kind='observed_goal',target_ref='target'),
            r1=dict(kind='observed_transition',mechanism_ref='a-b',before_ref='o1',after_ref='o2',scope=dict(epoch=1)),
            r2=dict(kind='observed_transition',mechanism_ref='b-c',before_ref='o2',after_ref='o3',scope=dict(epoch=1))))
    target=dict(id='target',requires=dict(stage='c'),evidence=['goal'])
    mechanisms=[dict(id='a-b',scope=dict(epoch=1),preconditions=dict(stage='a'),effects=dict(stage='b'),cost=1,actions=[dict(action_ref='ACTION1')],
        evidence=['r1'],falsifiers=['different-stage'],preserve=dict(safe=True),resource_delta=dict(energy=-1)),
        dict(id='b-c',scope=dict(epoch=1),preconditions=dict(stage='b'),effects=dict(stage='c'),cost=1,actions=[dict(action_ref='ACTION2')],
        evidence=['r2'],falsifiers=['different-stage'],preserve=dict(safe=True),resource_delta=dict(energy=-1))]
    options=dict(preserve=dict(facts=dict(safe=True),minimum_resources=dict(energy=0)),remaining_actions=5,max_depth=2,max_states=32)
    patch(current,target,mechanisms,options)
    capture('derive',name,[current,target,mechanisms,options],lambda:derive(current,target,mechanisms,**options))
def target_case(name,patch=lambda p,o,g,v:None):
    observation=dict(level_epoch=1,observation_ref='o1',levels_completed=0)
    objective=dict(id='G_official_completion')
    proposal=dict(binding=dict(level_epoch=1,observation_ref='o1'),actions=[dict(action_ref='ACTION1')],steps=[dict(expected_after=None)],
        compositions=[dict(id='child',relations=['contributes_to:G_official_completion'])],question={},
        bundle_template=dict(composition_ref='child',objective_ref='G_official_completion',actions=[dict(action_ref='ACTION1')],evidence=['o1'],operation_key='OP18'))
    previous={};patch(proposal,observation,objective,previous)
    capture('bind',name,[proposal,observation,objective,previous],lambda:tree.bind(proposal,observation,objective,previous))

def main():
    derivation('two-stage-attested')
    for field,value in [('remaining_actions',0),('remaining_actions',1),('max_depth',0),('max_depth',1),('max_states',1),('max_states',2),('remaining_actions',-1),('max_depth',3),('max_states',33),('remaining_actions',True)]:
        derivation(f'bound-{field}-{value}',lambda c,t,m,o,f=field,v=value:o.update({f:v}))
    derivation('missing-target-evidence',lambda c,t,m,o:t.update(evidence=[]))
    derivation('self-target-evidence',lambda c,t,m,o:t.update(evidence=['target']))
    derivation('mismatched-target-scope',lambda c,t,m,o:t.update(scope=dict(epoch=2)))
    derivation('empty-target',lambda c,t,m,o:t.update(requires={}))
    derivation('wrong-goal-kind',lambda c,t,m,o:c['observations']['goal'].update(kind='assertion'))
    derivation('missing-rule-evidence',lambda c,t,m,o:m[0].update(evidence=[]))
    derivation('wrong-rule-binding',lambda c,t,m,o:c['observations']['r1'].update(mechanism_ref='elsewhere'))
    derivation('same-before-after',lambda c,t,m,o:c['observations']['r1'].update(after_ref='o1'))
    derivation('foreign-rule-scope',lambda c,t,m,o:m[0].update(scope=dict(epoch=2)))
    derivation('foreign-evidence',lambda c,t,m,o:c['observations']['r1'].update(scope=dict(epoch=0)))
    def revalidate(c,t,m,o):
        c['observations']['r1']['scope']=dict(epoch=0);m[0]['revalidation_refs']=['rebind']
        c['observations']['rebind']=dict(kind='current_revalidation',mechanism_ref='a-b',scope=dict(epoch=1),evidence=['r1'])
    derivation('revalidated-prior-transition',revalidate)
    derivation('falsifier-absent',lambda c,t,m,o:m[0].update(falsifiers=[]))
    derivation('duplicate-rule',lambda c,t,m,o:m.append(deepcopy(m[0])))
    derivation('zero-cost',lambda c,t,m,o:m[0].update(cost=0))
    derivation('cost-mismatch',lambda c,t,m,o:m[0].update(cost=2))
    derivation('ambiguous-binding',lambda c,t,m,o:m[0].update(probe=dict(route='future')))
    def probe(c,t,m,o):m[0].pop('actions');m[0]['probe']=dict(route='future')
    derivation('conditional-probe',probe)
    derivation('minimum-unsatisfied',lambda c,t,m,o:o.update(preserve=dict(minimum_resources=dict(energy=9))))
    derivation('negative-resource',lambda c,t,m,o:c.update(resources=dict(energy=-1)))
    derivation('unknown-resource',lambda c,t,m,o:m[0].update(resource_delta=dict(missing=-1)))
    derivation('exhausted-resource',lambda c,t,m,o:m[0].update(resource_delta=dict(energy=-6)))
    derivation('resource-precondition',lambda c,t,m,o:m[0].update(requires_resources=dict(energy=6)))
    derivation('preservation-conflict',lambda c,t,m,o:m[0].update(preserve=dict(safe=False)))
    derivation('new-effect-breaks-preservation',lambda c,t,m,o:m[0].update(effects=dict(stage='b',safe=False)))
    derivation('typed-bool-is-not-int',lambda c,t,m,o:m[0].update(preconditions=dict(safe=1)))
    derivation('no-observable-change',lambda c,t,m,o:m[0].update(effects={},resource_delta={}))
    def equivalent(c,t,m,o):
        other=deepcopy(m[0]);other.update(id='same-future',evidence=['same-r']);m.insert(1,other)
        c['observations']['same-r']=dict(kind='observed_transition',mechanism_ref='same-future',before_ref='o3',after_ref='o4')
    derivation('equivalent-retained-future',equivalent)
    derivation('goal-already-satisfied-extension',lambda c,t,m,o:t.update(requires=dict(safe=True)))
    derivation('persistent-effect-goal',lambda c,t,m,o:(t.update(requires={},persistent_effects=dict(learned=True)),m[0].update(persistent_effects=dict(learned=True))))
    derivation('fractional-facts',lambda c,t,m,o:(c['facts'].update(stage=1.25),t.update(requires=dict(stage=2.5)),m[0].update(preconditions=dict(stage=1.25),effects=dict(stage=2.5))))
    derivation('oversized-inventory',lambda c,t,m,o:m.extend([deepcopy(m[0])]*128))
    target_case('independent-contribution')
    target_case('wrong-root',lambda p,o,g,v:g.update(id='elsewhere'))
    target_case('wrong-parent',lambda p,o,g,v:p['bundle_template'].update(objective_ref='elsewhere'))
    target_case('stale-proposal',lambda p,o,g,v:p['binding'].update(observation_ref='old'))
    target_case('missing-parent-relation',lambda p,o,g,v:p['compositions'][0].update(relations=[]))
    target_case('duplicated-focus',lambda p,o,g,v:p['compositions'].append(deepcopy(p['compositions'][0])))
    target_case('unbound-actions',lambda p,o,g,v:p['bundle_template'].update(actions=[]))
    target_case('missing-point-evidence',lambda p,o,g,v:p['bundle_template'].update(evidence=[]))
    target_case('missing-preservation',lambda p,o,g,v:p['bundle_template'].update(preserve_refs=['keep']))
    target_case('preservation-bound',lambda p,o,g,v:p['bundle_template'].update(preserve_refs=['keep'],preservation_evidence=dict(keep='r1')))
    target_case('retained-target-is-not-current',lambda p,o,g,v:v.update(level_epoch=1,retained_target=dict(pair_ref='pair',composition='alignment_of_homologous_patterns',evidence='old')))
    target_case('target-epoch-changed',lambda p,o,g,v:v.update(level_epoch=0,retained_target=dict(pair_ref='pair')))
    def morphology(p,o,g,v,branch='modifier'):
        goal=tree.contract['goals']['alignment_of_homologous_patterns'];facts=deepcopy(goal['children'][branch]['requires'])
        facts.update(pair_ref='pair',routes={branch:dict(level_epoch=1,observation_ref='o1',actions=p['actions'])},motion_examples=dict(ACTION1=[1,0]))
        p['morphology']=dict(status='proposed',level_epoch=1,observation_ref='o1',measured_facts=deepcopy(facts),composition='alignment_of_homologous_patterns',reason='remaining-feature',route_key=branch,operation='OP18')
        p['morphology_plan']=dict(route_key=branch,facts=facts,role_refs=['a','b'],contact_in_prefix=True,goal_xy=[3,4])
    target_case('bound-morphology',morphology)
    target_case('stale-morphology',lambda p,o,g,v:(morphology(p,o,g,v),p['morphology'].update(observation_ref='old')))
    target_case('missing-child',lambda p,o,g,v:(morphology(p,o,g,v),p['morphology'].update(route_key='unknown')))
    target_case('unsatisfied-child',lambda p,o,g,v:(morphology(p,o,g,v),p['morphology_plan']['facts'].update(homologous=False)))
    target_case('changed-child-route',lambda p,o,g,v:(morphology(p,o,g,v),p['morphology_plan']['facts']['routes']['modifier'].update(actions=[])))
    target_case('other-pair',lambda p,o,g,v:(morphology(p,o,g,v),p['morphology_plan']['facts'].update(pair_ref='other')))
    target_case('entry-probe-without-return',lambda p,o,g,v:morphology(p,o,g,v,'entry_probe'))
    def entry_return(p,o,g,v):
        morphology(p,o,g,v,'entry_probe');p['morphology_plan']['facts']['entry_access_return']=True
        v.update(level_epoch=1,retained_target=dict(pair_ref='pair',composition='alignment_of_homologous_patterns'),sealed_child=dict(route_key='entry_rebind',complete=True,after='o1',pair_ref='pair',level_epoch=1))
    target_case('entry-probe-with-return',entry_return)
    def info(p,o,g,v):
        q=dict(observation_ref='o1',level_epoch=1,action=p['actions'][0],distinct_outcomes=2,tree_key='information',relations=[['a','r','b']])
        p['question'].update(curiosity=q,information_target='info');p['compositions'][0]['relations'].append('investigates:info')
        p['compositions'].append(dict(id='info',role='information_objective',properties=dict(tested_relations=q['relations'])))
    target_case('information-target',info)
    target_case('information-target-unlinked',lambda p,o,g,v:(info(p,o,g,v),p['compositions'][0].update(relations=['contributes_to:G_official_completion'])))
    target_case('information-stale',lambda p,o,g,v:(info(p,o,g,v),p['question']['curiosity'].update(observation_ref='old')))
    target_case('context-consumer-mismatch',lambda p,o,g,v:p['question'].update(context_intervention={}))
    def control(p,o,g,v):
        morphology(p,o,g,v);p.pop('morphology_plan');p['question']['control_acquisition']=dict(pair_ref='pair',observation_ref='o1',action_ref='ACTION1',experiment='control')
    target_case('control-bound',control)
    target_case('control-unbound',lambda p,o,g,v:p['question'].update(control_acquisition=dict(pair_ref='pair',observation_ref='o1',action_ref='ACTION1',experiment='control')))
    for source_case in [c for c in cases if c['operation']=='bind' and c.get('expected',{}).get('admitted')]:
        receipt=source_case['expected']
        for interrupted in [False,True]:
            record=dict(final_observation_ref='o2',released_composition_ref='child',executed_prefix_count=1,released_actions_count=1,interruption='changed' if interrupted else None)
            capture('seal',source_case['id']+('-cut' if interrupted else '-complete'),[receipt,record],lambda r=receipt,x=record:tree.seal(r,x))

    sites=[[2,2,3,3],[8,2,9,3]]; site_hash=sha(sorted(sites));pair_ref=sha([1,site_hash])
    pair=dict(sites=sites,shape_class='shape',palette_values=[2,4],quarter_turns=3)
    facts=dict(observation_ref='now',level_epoch=1,pair_ref=pair_ref,control_attested=True,homologous=True,alignment_refuted=False,
        controlled_xy=[1,1],motion_examples=dict(ACTION3=[1,0],ACTION2=[0,1]),
        feature_residuals=dict(shape_class='shape',possible_peer=sites[1],sites=sites,orientation_alternatives=[3],palette_values=[2,4],
            prior_method_ref='rotation-after',color='different',orientation='different'))
    plans={}
    for route,end,action,surface in [('modifier',[2,1],'ACTION3','rotation-surface'),('feature_probe',[1,2],'ACTION2','color-surface')]:
        plans[route]=dict(level_epoch=1,observation_ref='now',pair=pair,contact_in_prefix=True,goal_xy=end,role_refs=['shape'],size=[2,2],
            steps=[dict(action_ref=action,**{'from':[1,1],'to':end},surface_sha=surface)])
    facts['routes']={r:dict(level_epoch=1,observation_ref='now',actions=[dict(action_ref=p['steps'][0]['action_ref'])],end_xy=p['goal_xy'])for r,p in plans.items()}
    rotation=dict(before='rotation-before',after='rotation-after',peer_preserved=True,delta=3,
        before_pose=dict(residual=1,mobile_color=2,peer_color=4),after_pose=dict(residual=0,mobile_color=2,peer_color=4),**{'from':[1,1]})
    contacts={(1,site_hash):dict(peer=sites[1],observed='color-after',stations=dict(station=dict(site=[2,1],site_surface='rotation-surface',entries=[rotation],departures=[])))}
    trials=dict(color=dict(arrived=True,before_ref='color-before',after_ref='color-after',site=[1,2],epoch=1,pair_ref=pair_ref,site_surface='color-surface',
        outcome=dict(status='measured',color_only_at_one_site=True,orientation_preserved=True,shape_preserved=True,
            sites=[dict(bbox=sites[0],before=dict(shape='shape',color=2),after=dict(shape='shape',color=4),changed=['color']),
                dict(bbox=sites[1],before=dict(shape='shape',color=4),after=dict(shape='shape',color=4),changed=[])])))
    def observed(name,patch=lambda f,p,c,t,m:None,remaining=8):
        f,p,c,t,m=deepcopy((facts,plans,contacts,trials,{}));patch(f,p,c,t,m)
        args=[f,p,[[list(k),v]for k,v in c.items()],t,m or None,remaining,{}]
        capture('observed',name,args,lambda:observed_derivations(f,p,c,t,m or None,remaining))
        capture('extend',name,args[:6],lambda:tree.extend_target(f,p,c,t,m or None,remaining))
    observed('rotation-and-color')
    observed('no-budget',remaining=0)
    observed('unbound-control',lambda f,p,c,t,m:f.update(control_attested=False))
    observed('no-pair',lambda f,p,c,t,m:(p.clear(),f.update(feature_residuals={})))
    observed('competing-peer',lambda f,p,c,t,m:f['feature_residuals'].update(possible_peer=sites[0]))
    observed('rotation-only',lambda f,p,c,t,m:t.clear())
    observed('color-only',lambda f,p,c,t,m:c[(1,site_hash)].update(stations={}))
    observed('mixed-color-refused',lambda f,p,c,t,m:t['color']['outcome'].update(orientation_preserved=False))
    observed('unbound-color-locus',lambda f,p,c,t,m:p['feature_probe']['steps'][0].update(surface_sha='changed'))
    observed('contradicted-rotation',lambda f,p,c,t,m:c[(1,site_hash)]['stations']['station']['entries'].append(dict(rotation,delta=2,after='other')))
    observed('two-source-poses',lambda f,p,c,t,m:c[(1,site_hash)]['stations']['station']['entries'].append(dict(rotation,after='third',before_pose=dict(residual=2,mobile_color=2,peer_color=4))))
    observed('preserved-palette-unknown',lambda f,p,c,t,m:c[(1,site_hash)]['stations']['station']['entries'][0]['after_pose'].pop('mobile_color'))
    observed('meter-bound',lambda f,p,c,t,m:f.update(meter_forecast=dict(observation_ref='now',level_epoch=1,steps_before_empty=1)))
    observed('stale-route',lambda f,p,c,t,m:p['modifier'].update(observation_ref='old'))
    observed('aligned-pose',lambda f,p,c,t,m:(p['modifier']['pair'].update(quarter_turns=0),p['feature_probe']['pair'].update(quarter_turns=0),f['feature_residuals'].update(orientation='aligned')))
    observed('residual-only',lambda f,p,c,t,m:(c.clear(),t.clear()))
    observed('homology-refused',lambda f,p,c,t,m:f.update(homologous=False))
    # Capture the unchanged public caller helpers without importing its environment adapter.
    original=ast.parse((LAYA/'common_frontier_runtime.py').read_text());selected=[n for n in original.body if isinstance(n,ast.FunctionDef)and n.name in ('main_objective','state_compositions','protocol_projection','post_analysis')]
    namespace={};exec(compile(ast.Module(body=selected,type_ignores=[]),'original-public-callers','exec'),namespace)
    policy=json.loads((LAYA/'common_frontier_policy.drm.json').read_text());objective=namespace['main_objective'](policy,3)
    capture('objective','principal',[policy,3],lambda:objective)
    for proposals in [dict(),dict(compositions=[dict(id='child')]),dict(compositions=[objective])]:
        capture('state_compositions',f'compositions-{len(cases)}',[proposals,objective],lambda p=proposals:namespace['state_compositions'](p,objective))
    public=dict(level=2,levels_completed=1,frame_hash='abcd',state='NOT_FINISHED',available_action_refs=['ACTION1','ACTION6'])
    capture('protocol','between-primitives',[public,7,'scope'],lambda:namespace['protocol_projection'](SimpleNamespace(**public),7,'scope'))
    for boundary in [False,True]:
        obs=dict(level_epoch=2,levels_completed=1,observation_ref='after')
        record=dict(released_composition_ref='child',step_expectations=[dict(action_index=0,status='matched'),dict(action_index=1,status='unknown'),dict(action_index=2,status='diverged')])
        calls=[]
        class Memory:
            def put(self,episode,key,value,**kwargs):calls.append(dict(type='put',episode=episode,key=key,value=deepcopy(value),**kwargs))
        class Bridge:
            def run(self,request):
                calls.append(dict(type='run',request=deepcopy(request)))
                return dict(src_status='completed',decision=dict(status='composition_analysis',operation_result=dict(operation=request['bundles']['R0']['operation_key'])))
        result=namespace['post_analysis'](Memory(),Bridge(),'episode',obs,7,objective,record,boundary=boundary)
        cases.append(dict(operation='post_analysis',id=f'analysis-{boundary}',args=[obs,7,objective,record,boundary],expected=dict(calls=calls,result=result)))
    paths=[LAYA/'target_tree.py',LAYA/'composition_target_tree.json',LAYA/'common_frontier_runtime.py',REF/'agents/yf_arc3_v6/morphology_policy/derive.py',REF/'agents/yf_arc3_v6/morphology_policy/observed_derivations.py']
    sources={str(p.relative_to(REF)):dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())for p in paths}
    output=ROOT/'tests/fixtures/v6-target-reference.json';output.write_text(json.dumps(dict(provenance=dict(commit=COMMIT,sources=sources),cases=cases),separators=(',',':'))+'\n')
    print(json.dumps(dict(cases=len(cases),errors=sum('error'in c for c in cases),file=str(output))))
if __name__=='__main__':main()
