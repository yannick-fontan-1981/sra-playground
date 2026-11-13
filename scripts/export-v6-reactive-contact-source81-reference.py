#!/usr/bin/env python3
"""Independent original Python Source81 contracts; synthetic public rasters.

No game implementation, native result, physical command or learned state is
used to choose expected values. Supplied source states are component fixtures.
"""
from __future__ import annotations
import copy, gzip, hashlib, importlib.util, json, sys
from pathlib import Path
from types import SimpleNamespace
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('source81_verified_source',ROOT/'scripts/probe-v6-outline-service-original.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
from agents.yf_arc3_v6.morphology_policy.reactive_contact.source81_policy import Source81Policy
from agents.yf_arc3_v6.morphology_policy.reactive_contact.source81_projection import source81_project,materialize_selected,current_independent_inventory
from agents.yf_arc3_v6.morphology_policy.reactive_contact.source81_context import current_entry
from agents.yf_arc3_v6.morphology_policy.reactive_contact.source81_execution import _joined_rows,offer
from agents.yf_arc3_v6.morphology_policy.reactive_contact import source81_execution as execution
from agents.yf_arc3_v6.morphology_policy.reactive_contact import geometry
from agents.yf_arc3_v6.morphology_policy.reactive_contact.family import ReactiveContact
from agents.yf_arc3_v6.morphology_policy.reactive_contact._source81 import peer_constraint_geometry as constraints
sys.path.insert(0,str(helper.SOURCE/'agents/yf_arc3_v6/laya_proto'))
from neutral_observer import measure

plain=helper.plain
CASES=[]
def record(name,operation,arguments,callback):
    try: result={'value':plain(callback())}
    except Exception as exc:
        cause=exc.__cause__ or exc
        result={'error':{'name':type(exc).__name__,'causeName':type(cause).__name__,'message':str(cause)}}
    CASES.append({'id':name,'operation':operation,'arguments':plain(copy.deepcopy(arguments)),**result})
    return result.get('value')

policy=Source81Policy()
common={'question_ref':'parent:synthetic','question_already_retained':True,'current_identity_binding':True,
    'question_evidence_refs':['seen:before','seen:after'],'controlled_approach':4,'distance_delta':0,
    'shared_translation':False,'composition_inventory_complete':True,'current_frame_ref':'seen:current',
    'remaining_budget':100,'parent_peer_component_ref':'peer:current'}
row={'candidate_ref':'candidate:one','alternative_ref':'candidate:one','peer_component_ref':'peer:current',
    'contact_group_count_excluding_peer':1,'joint_distance':3,'total_primitive_distance':7,
    'access_distance':3,'direct_single_input_previously_executed':0,'grip_row':1,'grip_col':2}
for label,rows in [('empty',[]),('single',[row]),('cost',[row,{**row,'candidate_ref':'candidate:two','alternative_ref':'candidate:two','total_primitive_distance':6}]),
    ('tie',[row,{**row,'candidate_ref':'candidate:two','alternative_ref':'candidate:two'}]),
    ('foreign-peer',[{**row,'peer_component_ref':'foreign'}]),('duplicate',[row,row])]:
    record('prepare:'+label,'prepare',{'rows':rows,'question_facts':common},lambda rows=rows:policy.prepare(rows,common))
for field in common:
    changed=copy.deepcopy(common);changed.pop(field)
    record('prepare:missing:'+field,'prepare',{'rows':[row],'question_facts':changed},lambda changed=changed:policy.prepare([row],changed))
for value in [True,0,-1,6,7,2.5,None]:
    changed={**common,'remaining_budget':value}
    record('prepare:remaining:'+repr(value),'prepare',{'rows':[row],'question_facts':changed},lambda changed=changed:policy.prepare([row],changed))

def satisfy(projection):
    facts={}
    for condition in projection.get('all_conditions',[]):
        field,op=condition['field'],condition['operator'];expected=condition.get('expected')
        facts[field]=expected if op=='equals' else expected+1 if op=='greater_than' else 0 if op=='between_inclusive' else False if op=='not_equals' and expected is True else 'other' if op=='not_equals' else 'witness:'+field if op=='is_present' else None
    for dest,source in projection.get('bound_facts',{}).items():facts.setdefault(source,['evidence'] if source.endswith('refs') else 'binding:'+source)
    return facts
for filename,method in [('source81-continuation.drm','continue_target'),('source81-target-revision.drm','revise_target')]:
    source=helper.SOURCE/'agents/yf_arc3_v6/morphology_policy/reactive_contact'/filename
    declaration=json.loads(source.read_text())['declarations'][0]
    for i,projection in enumerate(declaration.get('fact_projections',[])):
        facts=satisfy(projection)
        for label,values in [('valid',facts),*[(f'absent:{k}',{a:b for a,b in facts.items() if a!=k})for k in facts]]:
            record(method+':'+str(i)+':'+label,method,values,lambda values=values,method=method:getattr(policy,method)(values))
record('publish:empty','project',{},lambda:policy.project({}))

def observe(rows,revision=1,epoch=1):
    raw=SimpleNamespace(frame_rows=rows,frame_packet=[rows],frame_hash=helper.hashed(json.dumps(rows,separators=(',',':')).encode())[:16],level=epoch,levels_completed=epoch-1,state='NOT_FINISHED',step_index=revision-1,available_action_refs=('ACTION1','ACTION2','ACTION3','ACTION4','ACTION5'))
    return measure(raw,revision,'source81-synthetic')[0]
def raster(body=(5,5),peer=(13,13),part=(9,5),palette=(0,9,2,3,4),transpose=False):
    floor,border,a,b,c=palette;rows=[[floor]*20 for _ in range(20)]
    for i in range(20):rows[0][i]=rows[19][i]=rows[i][0]=rows[i][19]=border
    for (x,y),value in [(body,a),(peer,b),(part,c)]:
        for yy in range(y,y+2):
            for xx in range(x,x+2):rows[yy][xx]=value
    return [list(row)for row in zip(*rows)]if transpose else rows

family=ReactiveContact()
for label,palette,transpose in [('base',(0,9,2,3,4),False),('palette',(8,1,6,2,7),False),('transpose',(0,9,2,3,4),True),('corner',(0,9,2,3,4),False)]:
    rows=raster(palette=palette,transpose=transpose)
    if label=='corner':
        rows=raster(body=(5,13),peer=(5,5),part=(9,13),palette=palette)
        for y in range(20):
            for x in range(20):
                if x<4 or x>=16 or y<4 or y>=16:rows[y][x]=palette[1]
    obs=observe(rows)
    body=next(e for e in obs['entities']if e['palette_value']==palette[2]);peer=next(e for e in obs['entities']if e['palette_value']==palette[3]);part=next(e for e in obs['entities']if e['palette_value']==palette[4])
    binding,workflow=family.policy.bind_control({'unique_input_compatible_motion':True,'current_exact_shape':True,'positive_axial_displacement':True})
    control={'signature':body['signature'],'commands':{'ACTION1':[0,-4],'ACTION4':[4,0]},'evidence':['control:1','control:2'],'support_evidence':['support:1'],'binding':binding,'workflow':workflow}
    question={'id':'parent:'+label,'evidence':['approach:1','approach:2'],'origin_peer_signature':peer['signature'],'origin_body_signature':body['signature'],'origin_measurement':{'controlled_squared_approach_fourfold':4,'squared_distance_delta_fourfold':0,'shared_translation':False},'origin_measurement_evidence':['approach:1','approach:2']}
    scene=geometry.scene(obs,rows,control,peer['signature'],palette[0]);assert scene
    entry=current_entry(family.policy,scene,control,peer['signature'],question,palette[0],obs);assert entry
    args={'scene':scene,'recipe':None,'observation':obs,'rows':rows,'observed_support_values':[palette[0]],'directions':family.policy.config['direction_prior'],'support_evidence':control['support_evidence'],'binding_claim_refs':entry['binding_claim_refs'],'parent_question':entry['parent_question'],'mode':'unbound','operator_candidates':entry['explicit_operator_candidates']}
    projection=record('projection:'+label,'projection',args,lambda args=args:source81_project(**args))
    for field,value in [('binding_claim_refs',()),('support_evidence',()),('observed_support_values',()),('operator_candidates',()),('mode','invalid'),('maximum_cells',1),('maximum_comparisons',1)]:
        changed={**args,field:value};record('projection:'+label+':'+field,'projection',changed,lambda changed=changed:source81_project(**changed))
    recipe={'status':'observed_nonpushing_common_translation','scope':obs['level_epoch'],'evidence':['operator:before','operator:after','motion:after'],'operator_action_ref':'ACTION5','operator_observation_refs':['operator:before','operator:after'],'subject_mask_digest':geometry.digest(part['mask']),'subject_area':part['area'],'subject_box':part['bbox'],'subject_value':part['palette_value'],'offset':[part['bbox'][0]-body['bbox'][0],part['bbox'][1]-body['bbox'][1]],'method_claim_refs':['method:actual']}
    boundargs={**args,'recipe':recipe,'mode':'bound_pair','binding_claim_refs':entry['binding_claim_refs']+recipe['method_claim_refs']}
    bound=record('projection:bound:'+label,'projection',boundargs,lambda:source81_project(**boundargs))
    if bound and bound.get('parent_inventory',{}).get('rows'):
        b=bound['binding'];independentargs={'projection':bound,'actor_ref':b['actor_ref'],'peer_ref':b['peer_ref'],'part_ref':b['part_ref'],'origin_bbox':b['origin_bbox'],'proposal_ref':'prepared:synthetic'}
        record('independent:'+label,'independent',{'projection':bound,'actor':b['actor_ref'],'peer':b['peer_ref'],'part':b['part_ref'],'origin_bbox':b['origin_bbox'],'proposal_ref':'prepared:synthetic'},lambda:current_independent_inventory(bound,b['actor_ref'],b['peer_ref'],b['part_ref'],b['origin_bbox'],'prepared:synthetic'))

    for field,value in [('subject_area',7),('subject_mask_digest','foreign'),('offset',[99,99]),('scope',99),('operator_observation_refs',[])]:
        changed={**boundargs,'recipe':{**recipe,field:value}};record('projection:bound:'+label+':'+field,'projection',changed,lambda changed=changed:source81_project(**changed))
    for mode,pr,rec in [('unbound',projection,None),('bound',bound,recipe)]:
        family.restore({'epoch':obs['level_epoch'],'control':control,'peer':peer['signature'],'floor':palette[0],'observations':[],'question':question,'trials':{},'pending':None,'recipe':rec,'last':None,'input_trials':{},'source81_plan':None,'prepared_source81':None})
        if pr and pr.get('parent_inventory',{}).get('rows'):
            candidates,shared=_joined_rows(family,pr,obs,rows,100)
            record('joined:'+label+':'+mode,'joined',{'state':family.state(),'projection':pr,'observation':obs,'rows':rows,'remaining':100},lambda:_joined_rows(family,pr,obs,rows,100))
            selected,_=policy.prepare(candidates,shared)
            if selected['status']=='selected':
                selectedrow=copy.deepcopy(selected['selected_row']);selectedrow={**selectedrow,**selectedrow.pop('facts')}
                record('materialize:'+label+':'+mode,'materialize',{'projection':pr,'candidate_ref':selectedrow['geometry_candidate_ref'],'selected_row':selectedrow},lambda:materialize_selected(pr,selectedrow['geometry_candidate_ref'],selectedrow))
        record('offer:'+label+':'+mode,'offer',{'state':family.state(),'observation':obs,'rows':rows,'remaining':100,'scene':scene},lambda:offer(family,obs,rows,100,scene))
        proposal=family.propose(obs,rows,[],100)
        if proposal is None:continue
        state=copy.deepcopy(family.state()); selected_offer=proposal['reactive_plan']['offer']
        for suffix,frame,current in [('current',rows,obs),('stale-scope',rows,{**obs,'level_epoch':99}),('stale-observation',rows,{**obs,'observation_ref':'foreign'}),('unavailable',rows,{**obs,'available_action_refs':[]})]:
            family.restore(copy.deepcopy(state))
            record('before:'+label+':'+mode+':'+suffix,'before',{'state':state,'proposal':proposal,'index':0,'rows':frame,'observation':current},lambda frame=frame,current=current:execution.before(family,proposal,0,frame,current))
        record('after:'+label+':'+mode+':unchanged','after',{'state':state,'proposal':proposal,'index':0,'first':rows,'second':rows},lambda:execution.after(family,proposal,0,rows,rows))
        if selected_offer['phase']=='loaded_access':
            afterrows=copy.deepcopy(rows)
            for entity in [selected_offer['body'],selected_offer['subject']]:
                l,t,r,b=entity['bbox']
                for y in range(t,b+1):
                    for x in range(l,r+1):afterrows[y][x]=palette[0]
            for box,color in [(selected_offer['expected'][0],selected_offer['body']['palette_value']),(selected_offer['expected_subjects'][0],selected_offer['subject']['palette_value'])]:
                l,t,r,b=box
                for y in range(t,b+1):
                    for x in range(l,r+1):afterrows[y][x]=color
            afterobs=observe(afterrows,2)
            record('after:'+label+':'+mode+':translated','after',{'state':state,'proposal':proposal,'index':0,'first':rows,'second':afterrows},lambda:execution.after(family,proposal,0,rows,afterrows))
            def returned(afterobs=afterobs,afterrows=afterrows):
                family.restore(copy.deepcopy(state));result=execution.record(family,selected_offer,0,obs,afterobs,proposal['actions'][0],rows,afterrows)
                return {'result':result,'state':family.state()}
            retained=record('record:'+label+':'+mode+':translated','record',{'state':state,'offer':selected_offer,'index':0,'before':obs,'after':afterobs,'command':proposal['actions'][0],'first':rows,'second':afterrows},returned)
            if retained and retained['state']['source81_plan']:
                family.restore(copy.deepcopy(retained['state']));nextscene=family.current(afterobs,afterrows)
                if nextscene:record('continuation-offer:'+label+':'+mode,'offer',{'state':family.state(),'observation':afterobs,'rows':afterrows,'remaining':99,'scene':nextscene},lambda:offer(family,afterobs,afterrows,99,nextscene))


assert helper.verify_source_manifest()==helper.VERIFIED_SOURCE
source_hashes={name:sha for name,sha in helper.VERIFIED_SOURCE.items() if '/reactive_contact/' in name or name.endswith('/capabilities/routing.py') or name.endswith('/capabilities/components.py') or name.endswith('/logos/types.py')}
value={'sourceHashes':source_hashes,'sourceUnchanged':True,'schema':'logos-engine.v6.reactive-contact-source81-reference.v1','referenceCommit':helper.COMMIT,'qualification':'Unchanged original Python Source81 functions, independently evaluated on synthetic observations and component state. No game outcomes or full caller parity claimed.','cases':CASES}
out=ROOT/'tests/fixtures/v6-reactive-contact-source81-reference.json.gz';out.write_bytes(gzip.compress((json.dumps(value,ensure_ascii=True,separators=(',',':'))+'\n').encode(),mtime=0))
print(json.dumps({'cases':len(CASES),'errors':sum('error'in c for c in CASES),'operations':{op:sum(c['operation']==op for c in CASES)for op in sorted({c['operation']for c in CASES})},'path':str(out),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
