#!/usr/bin/env python3
"""Pinned unchanged-Python oracle for native public animation reasoning.

All frames are controlled test pixels. No game engine or private world state is
used, and these comparisons claim zero completed game levels.
"""
from pathlib import Path
from types import SimpleNamespace
from copy import deepcopy
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto';sys.path[:0]=[str(LAYA),str(SOURCE)]
import common_animated_contact as wrapper
import animated_contact_access as access
import transient_contact_memory as memory
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,SceneTransitionMeasurementInput
from agents.yf_arc3_v5.capabilities import transition

def plain(v):
    if hasattr(v,'model_dump'):return plain(v.model_dump(mode='json'))
    if isinstance(v,dict)or hasattr(v,'items'):return {str(k):plain(x)for k,x in v.items()}
    if isinstance(v,(list,tuple)):return[plain(x)for x in v]
    if isinstance(v,(set,frozenset)):return[plain(x)for x in sorted(v)]
    return v
scenes={};packets={};cases=[];scenarios=[];raws={}
def capture(op,name,args,fn):
    item={'operation':op,'id':name,'args':plain(args)}
    try:item['expected']=plain(fn())
    except Exception as exc:item['error']=str(exc)
    cases.append(item)
def observe(name,rows,epoch=1,score=0):
    raw=SimpleNamespace(frame_rows=rows,frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16],level=epoch,levels_completed=score,state='NOT_FINISHED',step_index=len(scenes),available_action_refs=('ACTION1','ACTION2','ACTION3','ACTION4','ACTION5','ACTION6'))
    o,_=measure(raw,len(scenes)+1,'animated-contact-reference');domain=ObservedInputDomain(4096);scenes[name]={'rows':plain(rows),'observation':plain(o),'public':plain(vars(raw)),'inputs':plain(domain.candidates(o))};raws[name]=raw
def rect(rows,x,y,w,h,color):
    for r in range(y,y+h):
        for c in range(x,x+w):rows[r][c]=color
def frame(fill=18,source=(7,42,3,3),peer=(52,42),cross=True,wall=False):
    rows=[[0]*64 for _ in range(64)];rect(rows,*source,2);x,y=peer
    if cross:
        for d in range(-2,3):rows[y+d][x]=3;rows[y][x+d]=3
    else:rect(rows,x-1,y-1,3,3,3)
    rect(rows,4,60,fill,1,4);rect(rows,4+fill,60,40-fill,1,5)
    if wall:rect(rows,31,15,3,45,6)
    return rows
base=frame();contact_points=[(13+4*i,y)for i,y in enumerate((38,33,29,26,24,23,23,24,26,29,33))];short_points=[(13+4*i,y)for i,y in enumerate((39,36,34,33,33,34,36,39,43))]
def packet(name,points,before=base,after=None,second_path=False):
    frames=[]
    for x,y in points:
        f=deepcopy(before);f[y][x]=7
        if second_path:f[y-10][x]=8
        frames.append(f)
    packets[name]={'before':plain(before),'intermediate':frames,'after':plain(before if after is None else after),'action_ref':'ACTION6','action_data':{'x':52,'y':42}};return packets[name]
packet('contact',contact_points);packet('disclosure',short_points);packet('blocked',contact_points,frame(wall=True));packet('ambiguous',contact_points,second_path=True);packet('straight',[(13+i*3,38-i)for i in range(9)]);packet('few_positions',[(13,38),(14,38),(14,38),(13,38)]);packet('no_source',contact_points,[[0]*64 for _ in range(64)])
rotating=packet('rotating_shape',contact_points)
for i,(f,(x,y))in enumerate(zip(rotating['intermediate'],contact_points)):
    for dy,dx in (((0,1),(1,0))if i%2 else((1,0),(1,1))):f[y+dy][x+dx]=7
packets['nonpoint']={**packets['contact'],'action_ref':'ACTION1'}
packets['short_packet']={**packets['contact'],'intermediate':packets['contact']['intermediate'][:1]}
packets['frame_bound']={'before':[[0]*8 for _ in range(8)],'intermediate':[[[0]*8 for _ in range(8)]]*191,'after':[[0]*8 for _ in range(8)],'action_ref':'ACTION6','action_data':{}}
checker=[[int((r+c)%2)for c in range(32)]for r in range(32)];packets['component_bound']={'before':[[0]*32 for _ in range(32)],'intermediate':[checker,checker],'after':[[0]*32 for _ in range(32)],'action_ref':'ACTION6','action_data':{}}
measurements={}
def measured(p):return transition._ordered_transient_component_path_facts(SceneTransitionMeasurementInput(before=FrameGrid(rows=p['before']),intermediate_frames=tuple(FrameGrid(rows=f)for f in p['intermediate']),after=FrameGrid(rows=p['after']),transition_ref='packet',action_ref=p['action_ref'],action_data=p['action_data'],context_epoch=1))
for name,p in packets.items():
    measurements[name]=measured(p);capture('ordered_packet',name,{'packet':name},lambda p=p:measured(p))
for name in ['contact','disclosure']:assert measurements[name]['unique_transient_path_curved'],measurements[name]
assert measurements['contact']['ballistic_contact_solution_present'],measurements['contact']
assert measurements['disclosure']['ballistic_curve_disclosure_present'],measurements['disclosure']
for name,rows in [('initial',base),('same_after',base),('relocated',frame(source=(9,40,3,3),peer=(52,42),cross=False)),('fill_changed',frame(fill=21)),('source_changed',frame(source=(7,41,3,4),cross=False)),('no_cross',frame(cross=False)),('blank',[[0]*16 for _ in range(16)]),('boundary',base)]:observe(name,rows,epoch=2 if name in ('relocated','source_changed','no_cross')else 3 if name=='boundary'else 1,score=1 if name=='boundary'else 0)
# Keep a recognizable peer shape for valid relocation, but move its cross out of
# the neutral invitation path by explicitly testing the retained calculators.
observe('relocated_exact',frame(source=(9,40,3,3)),epoch=2);observe('source_changed_exact',frame(source=(7,41,3,4)),epoch=2)
for name,s in scenes.items():
    capture('cross',name,{'scene':name},lambda s=s:access.cross_invitation(s['observation']))
    capture('scalar_fill',name,{'scene':name},lambda s=s:transition.measure_scalar_fill_display(FrameGrid(rows=s['rows'])))
for i,(values,thin)in enumerate([([0,1,1,1,1,2,2,2,2,0],[False]+[True]*8+[False]),([1]*4+[7]+[1]*4+[2]*9,[True]*18),([1]*10+[2]*10,[False]*20),([1]*4+[2]*4+[1]*4,[True]*12)]):capture('maximal_bars',str(i),{'values':values,'thin':thin},lambda values=values,thin=thin:transition._maximal_prefix_suffix_bars(values,thin))
for i,points in enumerate([[(0,0),(2,2),(4,4)],[(0,0),(-4,4),(-6,8),(-4,12),(0,16)],[(0,0),(4,4),(0,8),(4,12)],[(0,0),(0,0)],[(0,0),(2,2),(4,0)]]):capture('consistent_turn',str(i),{'centers':points},lambda points=points:transition._consistent_noncolinear_turn(tuple(points)))
for i,values in enumerate([[],[1],[3,4,7,12,19],[1.5,2.5,3.5,4.5],[-3,-7,-9,-9,-7]]):
    capture('linear_slope',str(i),{'values':values},lambda values=values:transition._linear_slope(tuple(values)))
    capture('quadratic',str(i),{'values':values},lambda values=values:transition._quadratic_linear_and_square(tuple(values)))
for x in [-4.5,-3.5,-2.5,-.5,-.1,.1,.5,1.5,2.5,3.5,4.50000000001]:capture('round',str(x),{'value':x},lambda x=x:round(x))
models={}
for name in ['contact','disclosure']:
    p=packets[name];model=memory.acquire(p['before'],p['intermediate'],measurements[name],1,['before','after'],{'action_ref':'ACTION6','data':p['action_data']});assert model
    models[name]=plain(model);capture('acquire',name,{'packet':name,'measurement':measurements[name],'epoch':1,'evidence':['before','after'],'command':{'action_ref':'ACTION6','data':p['action_data']}},lambda model=model:model)
    for scene,s in scenes.items():
        capture('project',name+':'+scene,{'model':model,'scene':scene},lambda model=model,s=s:memory.project(model,s['rows']))
        capture('calibration',name+':'+scene,{'model':model,'scene':scene},lambda model=model,s=s:memory.calibration(model,s['rows']))
        capture('source_role',name+':'+scene,{'model':model,'scene':scene},lambda model=model,s=s:memory.source_role_probe(model,s['rows']))
    old=memory.components(p['before']);source=next(c for c in old if c.component_id==measurements[name]['unique_transient_path_source_component_ref']);peer=next(c for c in old if c.component_id==measurements[name]['unique_transient_path_source_morphology_peer_ref']);track=tuple(next(c for c in memory.components(f)if c.value==7)for f in p['intermediate'])
    for avoid in (None,(42,52)):
        capture('ballistic',name+':'+str(avoid),{'track':track,'source':source,'peer':peer,'components':old,'rows':p['before'],'avoid':avoid},lambda avoid=avoid,track=track,source=source,peer=peer,old=old,p=p:transition._ballistic_contact_click(track,source,peer,old,FrameGrid(rows=p['before']),avoid=avoid))
    # Missing peer measurement can only reuse one exact current recognized peer.
    missing={**measurements[name],'unique_transient_path_source_morphology_peer_ref':'absent'}
    capture('acquire',name+' retained peer',{'packet':name,'measurement':missing,'epoch':2,'evidence':['next','later'],'command':{'action_ref':'ACTION6','data':p['action_data']},'retained_models':[model]},lambda p=p,missing=missing,model=model:memory.acquire(p['before'],p['intermediate'],missing,2,['next','later'],{'action_ref':'ACTION6','data':p['action_data']},[model]))

class Driver:
    def __init__(self,name,state=None):self.name=name;self.family=wrapper.AnimatedContact();self.steps=[];self.proposal=None;self.initial=plain(state)
    def seed(self,state):self.family.restore(state)
    def do(self,op):
        m=self.family;kind=op['kind']
        if kind=='propose':s=scenes[op['scene']];self.proposal=m.propose(s['observation'],s['rows'],s['inputs'],op.get('remaining',16));res=self.proposal
        elif kind=='bind':
            for step in self.proposal['steps']:
                if step.get('locus_witness'):step['point_binding']=step['locus_witness']
            res=self.proposal
        elif kind=='before':
            s=scenes[op['scene']];p=deepcopy(self.proposal)
            for key,value in op.get('patch',{}).items():p[key]=deepcopy(value)
            res=m.before(p,op.get('index',0),raws[op['scene']],s['observation'])
        elif kind=='after':b,a=scenes[op['before']],scenes[op['after']];res=m.after(self.proposal,0,b['observation'],a['observation'],b['rows'],a['rows'])
        elif kind=='record':
            b,a=scenes[op['before']],scenes[op['after']];frames=packets[op['packet']]['intermediate']+[a['rows']]if op.get('packet')else[a['rows']];res=m.record(b['observation'],a['observation'],self.proposal['actions'][0],b['rows'],a['rows'],self.proposal,0,frames)
        else:raise ValueError(kind)
        self.steps.append({'operation':plain(op),'expected':{'result':plain(res),'state':plain(m.state())}});m.restore(m.state());return res
    def save(self):scenarios.append({'id':self.name,'initial':self.initial,'steps':self.steps})
d=Driver('invitation to complete packet measurement and authorized contact')
p=d.do({'kind':'propose','scene':'initial'});assert p and p['animated_contact_plan']['mode']=='invitation'
d.do({'kind':'bind'});d.do({'kind':'before','scene':'initial'});d.do({'kind':'before','scene':'initial','index':1});d.do({'kind':'before','scene':'fill_changed'});d.do({'kind':'before','scene':'initial','patch':{'facts':{}}});d.do({'kind':'before','scene':'initial','patch':{'steps':[]}});d.do({'kind':'after','before':'initial','after':'same_after'})
d.do({'kind':'record','before':'initial','after':'same_after','packet':'contact'});d.do({'kind':'before','scene':'initial'});p=d.do({'kind':'propose','scene':'same_after'});assert p and p['animated_contact_plan']['mode']=='contact_solution'
d.do({'kind':'before','scene':'same_after'});d.do({'kind':'record','before':'same_after','after':'boundary'});d.do({'kind':'propose','scene':'boundary','remaining':0});d.save()
d=Driver('short curve, measured display experiment and relative-aim contrast')
d.do({'kind':'propose','scene':'initial'});d.do({'kind':'record','before':'initial','after':'same_after','packet':'disclosure'});p=d.do({'kind':'propose','scene':'same_after'});assert p and p['animated_contact_plan']['mode']=='scalar_experiment',p
d.do({'kind':'before','scene':'same_after'});d.do({'kind':'record','before':'same_after','after':'fill_changed'});p=d.do({'kind':'propose','scene':'fill_changed'});assert p and p['animated_contact_plan']['mode']=='parameter_contrast',p;d.save()
seed={'format':'animated_contact.v1','events':[{'kind':'measured_animated_contact','epoch':1,'command':{'action_ref':'ACTION6','data':{'x':52,'y':42}},'mode':'invitation','evidence':['before','after'],'measurement':measurements['contact'],'model':models['contact'],'scalar_before':models['contact']['fill'],'scalar_after':models['contact']['fill'],'scalar_change':None,'after_rows_digest':wrapper.identity(base)}],'authorized':{}}
d=Driver('incompatible current context blocks unrelated probing',seed);d.seed(seed);d.do({'kind':'propose','scene':'blank'});d.save()
rules={k:{'id':v['id'],'all_conditions':v['all_conditions']}for k,v in access.RULES.items()}
paths=['agents/yf_arc3_v6/laya_proto/'+p for p in ['common_animated_contact.py','common_animated_contact_base.py','animated_contact_access.py','transient_contact_memory.py','terminal_composition.py','common_frontier_policy.drm.json']]+['agents/yf_arc3_v5/capabilities/transition.py','agents/yf_arc3_v5/capabilities/components.py','agents/yf_arc3_v5/capabilities/contracts.py','agents/yf_arc3_v5/drm/interaction.drm']
out={'commit':COMMIT,'qualification':'Controlled public-raster packets and immutable Python reference; zero claimed completed game levels. No private game state is read.','sourceHashes':{p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest()for p in paths},'rules':rules,'scenes':scenes,'packets':packets,'cases':cases,'scenarios':scenarios}
dest=ROOT/'tests/fixtures/v6-animated-contact-reference.json';dest.write_text(json.dumps(out,separators=(',',':'))+'\n');print(json.dumps({'cases':len(cases),'scenario_steps':sum(len(x['steps'])for x in scenarios),'fixture':str(dest)}))
