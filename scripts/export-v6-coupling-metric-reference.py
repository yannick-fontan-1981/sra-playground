#!/usr/bin/env python3
"""Unchanged pinned Python oracle; controlled public pixels, zero solved games.

The original classes, searches and V5 calculators execute here only at build
time. Expected answers are test data, never runtime agent input.
"""
from pathlib import Path
from types import SimpleNamespace
from copy import deepcopy
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(LAYA),str(SOURCE)]
import common_oriented_coupling as coupling
import common_metric_composition as metric
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v5.capabilities import oriented_cargo_handoffs as handoff
from agents.yf_arc3_v5.capabilities import metric_stack_image as mechanics
from agents.yf_arc3_v5.capabilities.metric_stack_contracts import *

def plain(v):
    if hasattr(v,'model_dump'):return plain(v.model_dump(mode='json'))
    if isinstance(v,dict) or hasattr(v,'items'):return {str(k):plain(x)for k,x in v.items()}
    if isinstance(v,(list,tuple)):return [plain(x)for x in v]
    if isinstance(v,(set,frozenset)):return [plain(x)for x in sorted(v)]
    return v
def clean(v):
    value=plain(v)
    if isinstance(value,dict):return {k:clean(x)for k,x in value.items()if k!='elapsed_ns'}
    if isinstance(value,list):return [clean(x)for x in value]
    return value
def packed_scene(s):
    if s is None:return None
    return {**plain({k:v for k,v in s.items()if k!='boxes'}),'boxes':{','.join(map(str,k)):v for k,v in s['boxes'].items()}}
def coupling_state(m):
    keys=['h','actor_color','epoch','ready','held','coupled','invitation','known','refs','pending_release','blocked_face','tried']
    return {'format':'oriented_coupling_state.v1',**{k:plain(getattr(m,k))for k in keys},'s':packed_scene(m.s)}
scenes={};raws={};cases=[];scenarios=[]
def observe(name,rows,level=1,score=0,actions=tuple(f'ACTION{i}'for i in range(1,7))):
    raw=SimpleNamespace(frame_rows=rows,frame_packet=[rows],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16],level=level,levels_completed=score,state='WIN'if score else 'NOT_FINISHED',step_index=len(scenes),available_action_refs=actions)
    o,_=measure(raw,len(scenes)+1,'coupling-metric-reference');domain=ObservedInputDomain(4096)
    scenes[name]={'rows':plain(rows),'observation':plain(o),'public':plain(vars(raw)),'inputs':plain(domain.candidates(o))};raws[name]=raw;return name
def capture(op,name,args,fn):
    entry={'operation':op,'id':name,'args':plain(args)}
    try:entry['expected']=clean(fn())
    except Exception as e:entry['error']=str(e)
    cases.append(entry)
def rect(rows,x,y,w,h,c):
    for yy in range(y,y+h):
        for xx in range(x,x+w):rows[yy][xx]=c
def coupling_pixels(pose=(1,2),face=(0,1),boxes=(((3,3),6),((3,5),6)),face_color=9):
    q=3;rows=[[0]*27 for _ in range(24)];rect(rows,18,9,3,6,2)
    for (x,y),color in boxes:rect(rows,x*q,y*q,q,q,color);rect(rows,x*q+1,y*q+1,1,1,2)
    x,y=pose;rect(rows,x*q,y*q,q,q,8)
    if face[0]:rect(rows,x*q+(q-1 if face[0]>0 else 0),y*q,1,q,face_color)
    else:rect(rows,x*q,y*q+(q-1 if face[1]>0 else 0),q,1,face_color)
    return rows
for name,pose,face,boxes in [
 ('c_initial',(1,2),(0,1),(((3,3),6),((3,5),6))),
 ('c_learn',(1,3),(0,1),(((3,3),6),((3,5),6))),
 ('c_invitation',(2,3),(1,0),(((3,3),7),((3,5),6))),
 ('c_attached',(2,3),(1,0),(((3,3),10),((3,5),6))),
 ('c_moved',(3,3),(1,0),(((4,3),10),((3,5),6))),
 ('c_released',(3,3),(1,0),(((4,3),6),((3,5),6))),
 ('c_free',(3,2),(0,-1),(((4,3),6),((3,5),6))),
 ('c_turned',(3,2),(-1,0),(((4,3),6),((3,5),6))),
 ('c_refuted',(4,3),(1,0),(((5,4),10),((3,5),6))),
]:observe(name,coupling_pixels(pose,face,boxes))
observe('c_boundary',coupling_pixels((3,3),(1,0),(((4,3),10),((3,5),6))),score=1)
observe('c_next',coupling_pixels(),level=2,score=1);observe('blank',[[0]*12 for _ in range(12)])
h=coupling.initial(scenes['c_initial']['rows'])
for name in ['blank','c_initial','c_learn','c_invitation','c_attached','c_moved','c_released','c_free']:
    capture('coupling_initial',name,{'scene':name},lambda name=name:coupling.initial(scenes[name]['rows']))
    capture('coupling_scene',name,{'scene':name,'geometry':plain(h),'actor_color':8},lambda name=name:packed_scene(coupling.scene(scenes[name]['rows'],h,8)))
for p in [(-1,0),(0,0),(3,3),(100,100)]:capture('coupling_tile',str(p),{'scene':'c_initial','geometry':plain(h),'point':p},lambda p=p:coupling.tile(scenes['c_initial']['rows'],h,p))

class Driver:
    def __init__(self,kind,name):self.kind=kind;self.name=name;self.family=coupling.OrientedCoupling()if kind=='coupling'else metric.MetricComposition();self.steps=[];self.proposal=None
    def do(self,op):
        m=self.family;kind=op['kind']
        if kind=='record':
            b,a=scenes[op['before']],scenes[op['after']];res=m.record(b['observation'],a['observation'],op['command'],b['rows'],a['rows'],self.proposal if op.get('selected')else None,op.get('index'))
        elif kind=='propose':
            s=scenes[op['scene']];self.proposal=m.propose(s['observation'],s['rows'],s['inputs'],op.get('remaining',30));res=self.proposal
        elif kind=='before':s=scenes[op['scene']];res=m.before(self.proposal,op.get('index',0),raws[op['scene']],s['observation'])
        elif kind=='after':
            b,a=scenes[op['before']],scenes[op['after']];res=m.after(self.proposal,op.get('index',0),b['observation'],a['observation'],b['rows'],a['rows'])
        elif kind=='bind':
            for step in self.proposal['steps']:
                if step.get('locus_witness'):step['point_binding']=step['locus_witness']
            res=self.proposal
        elif kind=='models':
            s=scenes[op['scene']];res=m.models(s['observation'],s['rows'],coupling.scene(s['rows'],m.h,m.actor_color))
        elif kind=='reconcile':s=scenes[op['scene']];res=m.reconcile(s['observation'],s['rows'])
        else:raise ValueError(kind)
        self.steps.append({'operation':plain(op),'expected':{'result':clean(res),'state':clean(coupling_state(m)if self.kind=='coupling'else m.state())}})
        if self.kind=='metric':m.restore(m.state())
        return res
    def save(self):scenarios.append({'family':self.kind,'id':self.name,'steps':self.steps})

d=Driver('coupling','public invitation, rigid proof, route and release')
d.do({'kind':'propose','scene':'c_initial'})
d.do({'kind':'record','before':'c_initial','after':'c_learn','command':{'action_ref':'ACTION2'}})
d.do({'kind':'record','before':'c_learn','after':'c_invitation','command':{'action_ref':'ACTION4'}})
p=d.do({'kind':'propose','scene':'c_invitation'});assert p and p['actions']==[{'action_ref':'ACTION5'}]
d.do({'kind':'models','scene':'c_invitation'});d.do({'kind':'before','scene':'c_invitation'});d.do({'kind':'before','scene':'c_initial'})
d.do({'kind':'after','before':'c_invitation','after':'c_attached'})
d.do({'kind':'propose','scene':'c_invitation'}) # already-tested invitation remains closed
d.do({'kind':'record','before':'c_invitation','after':'c_attached','command':{'action_ref':'ACTION5'}})
p=d.do({'kind':'propose','scene':'c_attached'});assert p
d.do({'kind':'before','scene':'c_attached'});d.do({'kind':'after','before':'c_attached','after':'c_moved'})
d.do({'kind':'record','before':'c_attached','after':'c_moved','command':{'action_ref':'ACTION4'}})
d.do({'kind':'models','scene':'c_moved'});p=d.do({'kind':'propose','scene':'c_moved'});assert p
d.do({'kind':'after','before':'c_moved','after':'c_boundary'})
d.do({'kind':'record','before':'c_moved','after':'c_released','command':{'action_ref':'ACTION5'}})
d.do({'kind':'record','before':'c_released','after':'c_free','command':{'action_ref':'ACTION1'}})
d.do({'kind':'record','before':'c_free','after':'c_turned','command':{'action_ref':'ACTION3'}})
d.do({'kind':'record','before':'c_turned','after':'c_next','command':{'action_ref':'ACTION2'}})
d.save()
d=Driver('coupling','refutation and absent domain')
d.do({'kind':'record','before':'blank','after':'blank','command':{'action_ref':'ACTION1'}})
d.do({'kind':'record','before':'c_next','after':'c_next','command':{'action_ref':'ACTION1'}})
d.do({'kind':'record','before':'c_initial','after':'c_learn','command':{'action_ref':'ACTION2'}})
d.do({'kind':'record','before':'c_learn','after':'c_invitation','command':{'action_ref':'ACTION4'}})
d.do({'kind':'record','before':'c_invitation','after':'c_attached','command':{'action_ref':'ACTION5'}})
d.do({'kind':'record','before':'c_attached','after':'c_refuted','command':{'action_ref':'ACTION4'}});d.save()

model_source=coupling.OrientedCoupling()
for b,a,c in [('c_initial','c_learn','ACTION2'),('c_learn','c_invitation','ACTION4'),('c_invitation','c_attached','ACTION5')]:model_source.record(scenes[b]['observation'],scenes[a]['observation'],{'action_ref':c},scenes[b]['rows'],scenes[a]['rows'])
state,model=model_source.models(scenes['c_attached']['observation'],scenes['c_attached']['rows'],coupling.scene(scenes['c_attached']['rows'],model_source.h,8))
for direction in [(1,0),(0,-1),(-1,0),(0,1),(1,1),(0,0)]:
    for hypothetical in (False,True):
        args={'state':state,'model':model,'actor_ref':'controller','dx':direction[0],'dy':direction[1],'maximum':100000,'allow_hypothetical':hypothetical}
        capture('handoff_move',str((direction,hypothetical)),args,lambda args=args:handoff._move(**args))
for updates,name in [({'terrain':()},'unknown terrain'),({'actors':(state.actors[0].model_copy(update={'alive':False}),)},'dead actor'),({'cargo':()},'missing held cargo')]:
    s=state.model_copy(update=updates);args={'state':s,'model':model,'actor_ref':'controller','dx':1,'dy':0,'maximum':100000,'allow_hypothetical':True};capture('handoff_move',name,args,lambda args=args:handoff._move(**args))
for maximum in (0,1):
    args={'state':state,'model':model,'actor_ref':'controller','dx':1,'dy':0,'maximum':maximum,'allow_hypothetical':True};capture('handoff_move','bound '+str(maximum),args,lambda args=args:handoff._move(**args))
held=next(c.cargo_ref for c in state.cargo if c.holder_ref)
for kind,target in [('ATTACH',held),('RELEASE',held),('RELEASE','part:1'),('REMOVE_CARGO',held),('ATTACH','absent')]:
    args={'state':state,'model':model,'actor_ref':'controller','target_ref':target,'kind':kind,'maximum':100000,'allow_hypothetical':True};capture('handoff_interaction',kind+target,args,lambda args=args:handoff._interaction(**args))
released=handoff._interaction(state,model,'controller',held,'RELEASE',100000,True)[0]
for hypothetical in (True,False):
    args={'state':released,'model':model,'actor_ref':'controller','target_ref':held,'kind':'ATTACH','maximum':100000,'allow_hypothetical':hypothetical};capture('handoff_interaction','attach '+str(hypothetical),args,lambda args=args:handoff._interaction(**args))

def metric_pixels(fills=None,selected=None,widths=(4,4,4,4),heights=(4,4,4,4)):
    rows=[[0]*32 for _ in range(28)];fills=fills or {0:3,2:4};xs=[2];ys=[8]
    for w in widths:xs.append(xs[-1]+w)
    for h in heights:ys.append(ys[-1]+h)
    for i in range(16):
        x,y=i%4,i//4;c=fills.get(i,1+(x+y)%2);rect(rows,xs[x],ys[y],widths[x],heights[y],c)
        if i==selected:rect(rows,xs[x],ys[y],widths[x],heights[y],9);rect(rows,xs[x]+1,ys[y]+1,widths[x]-2,heights[y]-2,c)
    rect(rows,23,1,2,2,3);rect(rows,25,1,2,2,4);return rows
observe('m_initial',metric_pixels());observe('m_selected',metric_pixels(selected=2));observe('m_moved',metric_pixels({0:3,1:4},1));observe('m_underlay',metric_pixels({0:3,1:4,2:3},1));observe('m_boundary',metric_pixels({0:3,1:4},1),score=1)
observe('m_irregular',metric_pixels(widths=(3,5,3,5),heights=(3,5,3,5)))
for name in ['blank','m_initial','m_selected','m_moved','m_irregular','m_underlay']:
    capture('metric_scene',name,{'scene':name},lambda name=name:metric.measured_scene(scenes[name]['rows']))
    current=metric.measured_scene(scenes[name]['rows'])
    if current:
        st=metric.metric_state(current,scenes[name]['observation']);capture('metric_state',name,{'scene':current,'observation':scenes[name]['observation']},lambda st=st:st)
        capture('metric_targets',name,{'scene':current,'observation':scenes[name]['observation'],'state':st},lambda current=current,name=name,st=st:metric.target_candidates(current,scenes[name]['observation'],st))
d=Driver('metric','target selection, transfer fit, exact guards and official boundary')
d.do({'kind':'record','before':'m_initial','after':'m_initial','command':{'action_ref':'ACTION1'}})
p=d.do({'kind':'propose','scene':'m_initial','remaining':8});assert p and len(p['actions'])==2,p
assert p['actions'][0]['data']=={'x':11,'y':9},p['actions']
d.do({'kind':'bind'});d.do({'kind':'before','scene':'m_initial'});d.do({'kind':'before','scene':'m_selected'});d.do({'kind':'after','before':'m_initial','after':'m_selected'})
d.do({'kind':'record','before':'m_initial','after':'m_selected','command':p['actions'][0],'index':0,'selected':True})
d.do({'kind':'before','scene':'m_selected','index':1});d.do({'kind':'after','before':'m_selected','after':'m_moved','index':1})
d.do({'kind':'after','before':'m_selected','after':'m_underlay','index':1})
d.do({'kind':'record','before':'m_selected','after':'m_moved','command':p['actions'][1],'index':1,'selected':True})
d.do({'kind':'after','before':'m_moved','after':'m_boundary','index':1});d.do({'kind':'record','before':'m_moved','after':'m_boundary','command':p['actions'][1],'index':1,'selected':True});d.save()
d=Driver('metric','reconcile keeps known underlayers and replaces contradicted tops')
d.do({'kind':'reconcile','scene':'m_initial'});d.do({'kind':'reconcile','scene':'m_selected'});d.do({'kind':'reconcile','scene':'m_underlay'});d.do({'kind':'propose','scene':'blank'});d.save()

obs=scenes['m_initial']['observation'];current=metric.measured_scene(scenes['m_initial']['rows']);st=metric.metric_state(current,obs)
def request(operation,**kw):return MetricStackRequest(identity=metric.identity(obs,operation),evidence_revision_ref=obs['observation_ref'],evidence_refs=(obs['observation_ref'],),**kw)
target=MetricTarget(target_revision_ref='target',rows=(('3','4'),),licensed_scales=((4,1),(3,2)),licensed_anchors=((2,8),(6,8)),outside_color_ref=metric.EMPTY)
for bound in (4096,0,7):
    r=request('target_domain',state=st,target=target);r=r.model_copy(update={'identity':r.identity.model_copy(update={'actual_bounds':metric.FrozenMap({'nodes':bound,'outputs':128,'time_ms':60000})})})
    capture('metric_target_domain','rational/bound '+str(bound),{'request':r},lambda r=r:mechanics.enumerate_metric_target_domain(r))
for demands in [(),(StackDemand(cell_ref='0',color_ref='3'),StackDemand(cell_ref='1',color_ref='4')),(StackDemand(cell_ref='0',color_ref='5'),), (StackDemand(cell_ref='0',color_ref='3'),StackDemand(cell_ref='1',color_ref='3'))]:
    r=request('occurrence_assignment',state=st,demands=demands);capture('metric_assignment',str(plain(demands)),{'request':r},lambda r=r:mechanics.assign_metric_occurrences(r))
stacked=st.model_copy(update={'stacks':((StackOccurrence(occurrence_ref='buried',color_ref='3'),StackOccurrence(occurrence_ref='cover1',color_ref='4'),StackOccurrence(occurrence_ref='cover2',color_ref=None)),)+st.stacks[1:]})
r=request('exposure_dependencies',state=stacked,placements=(OccurrencePlacement(occurrence_ref='visible:2',target_cell_ref='0'),),needed_occurrence_refs=('buried','absent'),buffer_cell_refs=('0','1','missing'))
for bound in (4096,1,20):
    q=r.model_copy(update={'identity':r.identity.model_copy(update={'actual_bounds':metric.FrozenMap({'nodes':bound,'outputs':128,'time_ms':60000})})})
    capture('metric_exposure','underlayers/bound '+str(bound),{'request':q},lambda q=q:mechanics.derive_metric_exposure_dependencies(q))
for n in (0,1,2,3):
    samples=tuple(ControlSample(evidence_ref='e'+str(i),evidence_revision_ref='e',occurrence_ref='o',input_kind='CYCLE'if i==2 else'TRANSFER',position_before=(0,0),position_after=(i+1,0),was_accessible_top=i!=2,selection_accepted=True,dimensions_before=(2,2),dimensions_after=(3,2)if i else(2,2),support_before=(2,2),support_after=(3,2)if i==1 else(2,2),physical_selection_before_ref='o',physical_selection_after_ref='p')for i in range(n))
    r=request('control_fit',control_samples=samples);capture('metric_control_fit','sample count '+str(n),{'request':r},lambda r=r:mechanics.fit_metric_stack_control(r))
law=StackLaw(law_revision_ref='law',evidence_refs=('e',),access='TOP_ONLY',dimension_rule='CELL_SUPPORT',transfer_edges=(('0','1'),('0','15')),select_cost=1,cycle_cost=1,transfer_cost=1,event_owner_ref='external',empty_color_ref=metric.EMPTY)
selected=st.model_copy(update={'physical_selection_ref':'visible:0'})
for name,s,l,p in [
 ('select',st,law,StackPrimitive(primitive_ref='p',kind='SELECT',cell_ref='0',occurrence_ref='visible:0')),
 ('select wrong',st,law,StackPrimitive(primitive_ref='p',kind='SELECT',cell_ref='1',occurrence_ref='visible:0')),
 ('unselected transfer',st,law,StackPrimitive(primitive_ref='p',kind='TRANSFER',occurrence_ref='visible:0',destination_ref='1')),
 ('adjacent transfer',selected,law,StackPrimitive(primitive_ref='p',kind='TRANSFER',occurrence_ref='visible:0',destination_ref='1')),
 ('unlicensed',selected,law,StackPrimitive(primitive_ref='p',kind='TRANSFER',occurrence_ref='visible:0',destination_ref='2')),
 ('nonadjacent',selected,law,StackPrimitive(primitive_ref='p',kind='TRANSFER',occurrence_ref='visible:0',destination_ref='15')),
 ('reset',st,law,StackPrimitive(primitive_ref='p',kind='RESET')),
 ('cycle unknown',st,law,StackPrimitive(primitive_ref='p',kind='CYCLE')),
 ('cycle',st,law.model_copy(update={'access':'CYCLE_TOPS','cycle_order':('0','2')}),StackPrimitive(primitive_ref='p',kind='CYCLE')),
]:capture('metric_transition',name,{'state':s,'law':l,'primitive':p},lambda s=s,l=l,p=p:mechanics._stack_transition(s,l,p))

source_paths=['agents/yf_arc3_v6/laya_proto/'+s for s in ['common_oriented_coupling.py','common_metric_composition.py','common_control_dependencies.py','common_frontier_policy.drm.json','common_fixed_origin.py','common_multiscale_constraints.py','observed_input_domain.py']]+['agents/yf_arc3_v5/capabilities/'+s for s in ['oriented_cargo_handoffs.py','metric_stack_image.py','metric_stack_contracts.py','mechanical_request_contracts.py','components.py']]
out={'commit':COMMIT,'qualification':'Controlled public-pixel and declared-model differential cases; zero claimed solved game levels. Real elapsed_ns is excluded from byte equality and tested as a nonnegative real measurement.','sourceHashes':{p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest()for p in source_paths},'scenes':scenes,'cases':cases,'scenarios':scenarios}
dest=ROOT/'tests/fixtures/v6-coupling-metric-reference.json';dest.write_text(json.dumps(out,separators=(',',':'))+'\n');print(json.dumps({'cases':len(cases),'scenario_steps':sum(len(s['steps'])for s in scenarios),'fixture':str(dest)}))
