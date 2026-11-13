#!/usr/bin/env python3
"""Development-only untouched-source oracle for three support subcompositions.

Real-game packets and controlled compartment scenes are distinctly labelled.
No fixture, game identity or solution is an input of the deployed agent.
"""
import copy, gzip, hashlib, json, shutil, sys, tempfile, time, zipfile
from pathlib import Path
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(SOURCE),str(LAYA)]
from common_joint_transport import JointTransport
from joint_transport_geometry import measure as joint_measure, exact_path
from common_contextual_compartments import ContextualCompartments, measure as compartment_measure
from common_invited_reduction import InvitedReduction,scene as reduction_scene,geometry as reduction_geometry
from neutral_observer import measure as observe
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v5.capabilities.program_instruction_shape_d import measure_program_instruction_shape_d
from agents.yf_arc3_v5.capabilities.ray_capture_domain_d import RayCaptureDomainRequestD,measure_ray_capture_domain_d

def plain(x):
    if x is None or isinstance(x,(bool,int,float,str)):return x
    if hasattr(x,'model_dump'):return plain(x.model_dump(mode='python'))
    if hasattr(x,'tolist'):return plain(x.tolist())
    if isinstance(x,dict) or hasattr(x,'items'):return {str(k):plain(v) for k,v in x.items()}
    if isinstance(x,(set,frozenset)):return [plain(v) for v in sorted(x)]
    if isinstance(x,(tuple,list)):return [plain(v) for v in x]
    if isinstance(x,SimpleNamespace):return plain(vars(x))
    raise TypeError(type(x))

def state(family):
    if not isinstance(family,ContextualCompartments):return plain(family.state())
    result={name:plain(getattr(family,name)) for name in ('epoch','mark','refs','tried','pending','events','passed','transitions','receipts','terminal_shapes','productive')}
    result.update(format='native.contextual_compartments.v1',dependencies=[[list(k),plain(v)]for k,v in family.dependencies.items()]);return result

def packet(engine,step,scope):
    rows=plain(engine['frame']);raw=SimpleNamespace(frame_rows=rows,frame_packet=plain(engine['frames']),level=engine['level'],levels_completed=engine['levelsCompleted'],state=engine['state'],step_index=step,available_action_refs=[f'ACTION{i}'for i in engine['availableActionIds']],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16])
    obs,_=observe(raw,step,scope);domain=ObservedInputDomain(4096);inputs=domain.candidates(obs)
    return {'public':plain(raw),'observation':plain(obs),'inputs':plain(inputs)},raw,obs

def run_game(send,code,kind,ctor,target,cap=240):
    family=ctor();initial,current,obs=packet(send('load',code=code,level=1),0,'support-extension-'+kind)
    journal=[];step=0
    if isinstance(family,JointTransport):family.level_deadline=time.perf_counter()+360
    while step<cap and current.levels_completed<target and current.state not in ('WIN','GAME_OVER','LEVEL_COMPLETE'):
        domain=ObservedInputDomain(4096);inputs=domain.candidates(obs);proposal=family.propose(obs,current.frame_rows,inputs,cap-step)
        entry={'remaining':cap-step,'proposal':plain(copy.deepcopy(proposal)),'proposedState':state(family),'steps':[]};journal.append(entry)
        if not proposal:break
        witnessed=[]
        for i,command in enumerate(proposal['actions']):
            pre=family.before(proposal,i,current,obs)
            if not pre['admitted']:entry['steps'].append({'beforeGuard':plain(pre)});break
            nextdata,nxt,after=packet(send('action',actionId=int(command['action_ref'][6:]),data=command.get('data')),step+1,'support-extension-'+kind)
            post=family.after(proposal,i,obs,after,current.frame_rows,nxt.frame_rows)
            item={'beforeGuard':plain(pre),'after':nextdata,'afterGuard':plain(post)};entry['steps'].append(item)
            witnessed.append((obs,after,command,current.frame_rows,nxt.frame_rows,i,nxt.frame_packet,item));step+=1;current,obs=nxt,after
            if post['seal_prefix'] or current.state in ('WIN','GAME_OVER','LEVEL_COMPLETE'):break
        for before,after,command,first,second,i,frames,item in witnessed:
            item['record']=plain(family.record(before,after,command,first,second,proposal,i,frames=frames));item['state']=state(family)
        entry['finalState']=state(family)
        if not witnessed:break
    return {'kind':kind,'game':code,'qualification':'Family-only original development oracle, not an integrated runtime campaign','initial':initial,'journal':journal,'actions':step,'levelsCompleted':current.levels_completed,'state':current.state,'finalState':state(family)}

def main():
    paths=[f'agents/yf_arc3_v6/laya_proto/{n}.py'for n in ('common_joint_transport','joint_transport_geometry','common_contextual_compartments','common_invited_reduction','common_fixed_origin','common_control_dependencies')]+[f'agents/yf_arc3_v5/capabilities/{n}.py'for n in ('program_instruction_shape_d','ray_capture_domain_d','mechanical_family_contracts_d')]
    manifest=json.loads((ROOT/'reference/v6'/COMMIT/'manifest.json').read_text());hashes={}
    for p in paths:
        h=hashlib.sha256((SOURCE/p).read_bytes()).hexdigest();assert h==manifest['files'][p]['sha256'];hashes[p]=h
    policy=json.loads((LAYA/'common_frontier_policy.drm.json').read_text())
    fixture={'schema':'logos-engine.v6.support-extensions-reference.v1','commit':COMMIT,'sourceHashes':hashes,'policy':{k:policy[k]for k in ('joint_transport_question','contextual_compartments','invited_reduction')},'games':[],'compartments':[],'shapes':[],'rays':[]}
    with tempfile.TemporaryDirectory(prefix='v6-support-extension-') as folder:
        temp=Path(folder)
        for name in ('custom-games.zip','official-games.zip'):
            with zipfile.ZipFile(ROOT/'public/python'/name)as archive:archive.extractall(temp)
        for name in ('game_bridge.py','official_adapter.py','custom_level_navigation.py'):shutil.copy(ROOT/'public/python'/name,temp/name)
        sys.path.insert(0,str(temp));import game_bridge
        def send(kind,**payload):
            r=json.loads(game_bridge.dispatch(json.dumps({'type':kind,**payload})))
            if 'error'in r:raise RuntimeError(r['error'])
            return r
        for args in [('SKBN','joint',JointTransport,6),('DAME','reduction',InvitedReduction,6),('CRAF','compartment',ContextualCompartments,1)]:
            result=run_game(send,*args);fixture['games'].append(result);print(json.dumps({k:result[k]for k in ('game','actions','levelsCompleted','state')}),flush=True)
    a=[[0]*64 for _ in range(64)]
    for i in range(6):
        l=4+i*9;t=8;r=l+4;b=t+10;border=9 if i==2 else 2
        for y in range(t,b+1):
            for x in range(l,r+1):
                if y in (t,b)or x in(l,r):a[y][x]=border
    b=copy.deepcopy(a);b[12][24]=4
    c=copy.deepcopy(b);c[12][15]=5
    raws=[]
    for n,rows in enumerate([a,b,c,a]):raws.append(packet({'frame':rows,'frames':[rows],'level':1,'levelsCompleted':0,'state':'NOT_FINISHED','availableActionIds':[6]},n,'controlled-compartment'))
    family=ContextualCompartments()
    for i in range(3):
        data,raw,obs=raws[i];nextdata,nxt,after=raws[i+1];proposal=family.propose(obs,raw.frame_rows,data['inputs'],100)
        entry={'before':data,'after':nextdata,'measurement':plain(compartment_measure(raw.frame_rows,family.mark)),'proposal':plain(copy.deepcopy(proposal)),'proposedState':state(family)}
        if proposal:
            entry['beforeGuard']=plain(family.before(proposal,0,raw,obs));entry['afterGuard']=plain(family.after(proposal,0,obs,after,raw.frame_rows,nxt.frame_rows));entry['record']=plain(family.record(obs,after,proposal['actions'][0],raw.frame_rows,nxt.frame_rows,proposal,0,frames=nxt.frame_packet))
        entry['state']=state(family);fixture['compartments'].append(entry)
    for support in [((0,0),),tuple((r,c)for r in range(3)for c in range(4)),tuple((r,c)for r in range(4)for c in range(5)if r in(0,3)or c in(0,4)),(),((0,0),(0,0)),((0,0),(256,256))]:fixture['shapes'].append({'support':plain(support),'result':plain(measure_program_instruction_shape_d(support))})
    scope=dict(request_ref='ray:1',caller_ref='original-test',parent_consumer_ref='SupportNavigation',parent_goal_ref='G',parent_contribution_ref='C',caller_next_item_ref='capture',epoch=1,evidence_revision_ref='E',model_revision_ref='M',model_status_ref='observed',event_owner_ref='public',input_domain_complete=True,assumption_refs=())
    base=dict(scope=scope,operation_ref='mechanics.typed_jump_carriers.ray_capture_domain',mode_ref='DOMAIN',requested_result_type='DMechanicalResult',node_bound=10000,depth_bound=64,domain_bound=4096,time_bound_ms=1000,phase_ref='CURRENT_CAPTURE_DOMAIN',population=[dict(member_ref='actor',type_ref='t',rank=0,origin=(0,0),occupied_offsets=((0,0),)),dict(member_ref='victim',type_ref='t',rank=0,origin=(1,0),occupied_offsets=((0,0),))],native_focus_ref='actor',board_cells=[(x,0)for x in range(5)],ray_passage_cells=[(x,0)for x in range(5)],landing_support_cells=[(x,0)for x in range(5)],eligible_victim_refs=['victim'],range_kind='SHORT',range_law_evidence_ref='M',range_law_rank=0,directions=[(1,0)],short_relations=[dict(relation_ref='short',intermediate_delta=(1,0),landing_delta=(2,0))],proposed_landing=None)
    variants=[('short',{}),('ray',{'range_kind':'RAY'}),('wrong_rank',{'range_law_rank':1}),('wrong_signature',{'operation_ref':'other'}),('domain_incomplete',{'scope':{**scope,'input_domain_complete':False}}),('node_bound',{'node_bound':1}),('domain_bound',{'domain_bound':1}),('missing_landing',{'mode_ref':'PRECONDITION'}),('landing_bound',{'mode_ref':'PRECONDITION','proposed_landing':(2,0)}),('forbidden_landing',{'landing_support_cells':[(0,0),(1,0)]}),('depth_bound',{'range_kind':'RAY','depth_bound':2}),('resume',{'resume_frontier':{'prior':True}}),('ray_limited',{'range_kind':'RAY','maximum_ray_distance':2})]
    for name,delta in variants:
        req=RayCaptureDomainRequestD(**{**base,**delta});fixture['rays'].append({'name':name,'request':plain(req),'result':plain(measure_ray_capture_domain_d(req))})
    output=ROOT/'tests/fixtures/v6-support-extensions-reference.json.gz';output.write_bytes(gzip.compress((json.dumps(fixture,separators=(',',':'))+'\n').encode(),mtime=0));print(str(output),flush=True)

if __name__=='__main__':main()
