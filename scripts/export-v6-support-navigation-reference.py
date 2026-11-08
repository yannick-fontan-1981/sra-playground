#!/usr/bin/env python3
"""Pinned, unchanged Python oracle for the native support coordinator.

Controlled public-pixel scenarios; no game score is claimed. Calls execute the
source methods and calculators directly. Captured expected results never enter
native agent memory. Child-family coverage is recorded separately.
"""
import gzip
from pathlib import Path
from copy import deepcopy
from types import SimpleNamespace
import hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(LAYA),str(SOURCE)]
import common_support_navigation as support
import support_contact_questions as contacts
import common_visible_identity as visible
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v5.capabilities.appearance import measure_orthogonal_bands
from agents.yf_arc3_v5.capabilities.navigation_transition_measurements import measure_current_translation_underlays,measure_remote_navigation_transition
from agents.yf_arc3_v5.capabilities.actor_lattice_measurements import measure_unit_translation_lattices
from agents.yf_arc3_v5.capabilities.valued_mask_pose_measurements import measure_exact_valued_mask_poses
from agents.yf_arc3_v5.capabilities.support_navigation_domain import measure_support_navigation_domain
from agents.yf_arc3_v5.capabilities.sprite_occlusion import enclosed_rendering_pixels
from agents.yf_arc3_v5.capabilities.reconfigurable_support import _support_transform


def plain(value):
    if value is None or type(value) in (str,bool,int,float):return value
    if hasattr(value,'model_dump'):return plain(value.model_dump(mode='json'))
    if isinstance(value,dict)or hasattr(value,'items'):
        out={str(k):plain(v)for k,v in value.items()}
        # Export the exact computed BoundingBox properties consumed by TS.
        if set(out)=={'top','left','bottom','right'}:out.update(height=out['bottom']-out['top']+1,width=out['right']-out['left']+1)
        return out
    if isinstance(value,(set,frozenset)):return [plain(v)for v in sorted(value)]
    if isinstance(value,(list,tuple)):return [plain(v)for v in value]
    if isinstance(value,SimpleNamespace):return plain(vars(value))
    if hasattr(value,'tolist'):return plain(value.tolist())
    raise TypeError(type(value))

def state(s):
    keys=['epoch','actor_signature','target_signature','controls','directions','entered','effects','tried','blocked','events','passed','underlay','last_calculation','equivalences','current_observation','contact_question','contact_attempted','control_introductions','service_edges']
    result={k:plain(getattr(s,k))for k in keys}
    result['control_questions']={'pending':plain(s.control_questions.pending),'attempted':plain(s.control_questions.attempted)}
    return result

scenes={};raws={};cases=[];scenarios=[]
def blank(width=28,height=28):return [[0]*width for _ in range(height)]
def rect(rows,x,y,w,h,color):
    for r in range(y,y+h):
        for c in range(x,x+w):rows[r][c]=color

def navigation(actor=(4,8),closed=False,swapped=False):
    rows=blank();rect(rows,4,8,20,8,1);rect(rows,16,8,4,4,3)
    for x,color in [(4,6),(20,9)]:
        for dy,dx in [(0,0),(1,0),(1,1)]:rows[2+dy][x+dx]=color
    if closed:
        for y in range(8,12):
            for x in range(12,16):rows[y][x]=1 if swapped else (1 if (x+y)%2 else 8)
    if swapped:
        for y in range(12,16):
            for x in range(20,24):rows[y][x]=1 if(x+y)%2 else 8
    rect(rows,actor[0],actor[1],4,4,2)
    return rows

def observe(name,rows,level=1,score=0,status='NOT_FINISHED',actions=tuple(f'ACTION{i}'for i in (1,2,3,4,6))):
    raw=SimpleNamespace(frame_rows=rows,frame_packet=[rows],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16],level=level,levels_completed=score,state=status,step_index=len(scenes),available_action_refs=actions)
    observation,_=measure(raw,len(scenes)+1,'support-reference');domain=ObservedInputDomain(4096);inputs=domain.candidates(observation)
    scenes[name]={'rows':plain(rows),'observation':plain(observation),'public':plain(vars(raw)),'inputs':plain(inputs)};raws[name]=raw;return name

def capture(operation,name,args,callback):
    item={'operation':operation,'id':name,'args':plain(args)}
    try:item['expected']=plain(callback())
    except Exception as exc:item['error']=str(exc)
    cases.append(item)

class Driver:
    def __init__(self,name):self.name=name;self.memory=support.SupportNavigation();self.steps=[];self.proposal=None;self.domain=None
    def execute(self,op):
        kind=op['kind'];m=self.memory
        if kind=='record':
            b,a=scenes[op['before']],scenes[op['after']];result=m._record_existing(b['observation'],a['observation'],op['command'],b['rows'],a['rows'],self.proposal if op.get('selected',False)else None,op.get('index'))
        elif kind=='propose':
            view=scenes[op['scene']];self.domain=ObservedInputDomain(4096);inputs=self.domain.candidates(view['observation']);self.proposal=m.propose(view['observation'],view['rows'],inputs,op.get('remaining',100));result=self.proposal
        elif kind=='bind':m.bind(self.proposal,self.domain);result=self.proposal
        elif kind=='before':result=m.before(self.proposal,op.get('index',0),raws[op['scene']],scenes[op['scene']]['observation'])
        elif kind=='after':
            b,a=scenes[op['before']],scenes[op['after']];result=m.after(self.proposal,op.get('index',0),b['observation'],a['observation'],b['rows'],a['rows'])
        elif kind=='geometry':
            view=scenes[op['scene']];current=m.scene(view['rows']);cells,owners,grid=m.geometry(view['rows'],current[1],current[3]);result={'cells':plain(cells),'owner':[[plain(p),plain(v)]for p,v in sorted(owners.items())],'grid':grid}
        elif kind=='context':
            view=scenes[op['scene']];result=m.experiment_context(m.scene(view['rows']),view['rows'])
        elif kind=='quotient':
            view=scenes[op['scene']];current=m.scene(view['rows']);result=m.quotient_effects(view['rows'],current[1],current[3])
        elif kind=='seed':
            for key,value in op['fields'].items():setattr(m,key,deepcopy(value))
            result=None
        else:raise ValueError(kind)
        self.steps.append({'operation':plain(op),'expected':{'result':plain(result),'state':state(m)}});return result
    def save(self):scenarios.append({'id':self.name,'steps':self.steps})

positions=[('initial',(4,8)),('right',(8,8)),('down',(8,12)),('left',(4,12)),('up',(4,8)),('step1',(8,8)),('step2',(12,8)),('step3',(16,8))]
for name,pos in positions:observe(name,navigation(pos))
observe('victory',navigation((16,8)),score=1,status='WIN')
observe('next_epoch',navigation(),level=2,score=1)
observe('closed',navigation(closed=True));observe('opened',navigation(closed=True,swapped=True))
observe('closed_again',navigation(closed=True));observe('stale',navigation((8,8)),level=2)
observe('blank',blank(8,8));observe('no_point',navigation(),actions=('ACTION1','ACTION2','ACTION3','ACTION4'))

for name,view in scenes.items():capture('parts','parts_'+name,{'scene':name},lambda v=view:support.extract(v['rows']))
for points in [((0,0),),((2,3),(3,3),(3,4)),((0,0),(1,0),(2,0),(2,1),(2,2)),tuple((r,c)for r in range(4)for c in range(4)if r in(0,3)or c in(0,3))]:
    capture('bands','bands_'+str(len(cases)),{'points':points},lambda p=points:measure_orthogonal_bands(p))
    capture('interior','interior_'+str(len(cases)),{'points':points},lambda p=points:enclosed_rendering_pixels(frozenset(p)))
for a,b in [('initial','right'),('right','down'),('down','left'),('left','up'),('initial','initial'),('closed','opened'),('initial','blank')]:
    capture('underlay',a+'_'+b,{'before':a,'after':b},lambda a=a,b=b:measure_current_translation_underlays(before=scenes[a]['rows'],after=scenes[b]['rows']))
    if a!='initial'or b!='blank':capture('residual',a+'_'+b,{'before':a,'after':b},lambda a=a,b=b:visible.residual_correspondences(scenes[a]['observation'],scenes[b]['observation'],scenes[a]['rows'],scenes[b]['rows']))
for before,after,command in [('initial','right','ACTION4'),('right','down','ACTION2'),('down','left','ACTION3'),('left','up','ACTION1')]:pass

d=Driver('public_displacements_path_and_boundary')
assert d.execute({'kind':'propose','scene':'initial'})is None
for before,after,command in [('initial','right','ACTION4'),('right','down','ACTION2'),('down','left','ACTION3'),('left','up','ACTION1')]:
    d.execute({'kind':'record','before':before,'after':after,'command':{'action_ref':command}})
    if command=='ACTION4':
        p=d.execute({'kind':'propose','scene':after});assert p and p['actions']==[{'action_ref':'ACTION1'}]
        d.execute({'kind':'before','scene':after});d.execute({'kind':'after','before':before,'after':after})
d.execute({'kind':'geometry','scene':'up'});d.execute({'kind':'context','scene':'up'})
p=d.execute({'kind':'propose','scene':'up'});assert p and len(p['actions'])==3
d.execute({'kind':'bind'})
for index,(a,b)in enumerate([('up','step1'),('step1','step2'),('step2','victory')]):
    d.execute({'kind':'before','scene':a,'index':index});d.execute({'kind':'after','before':a,'after':b,'index':index});d.execute({'kind':'record','before':a,'after':b,'command':p['actions'][index],'selected':True,'index':index})
d.execute({'kind':'before','scene':'stale'});d.execute({'kind':'propose','scene':'no_point'});d.execute({'kind':'propose','scene':'blank'});d.save()

# Exact remote pattern exchange: acquisition precedes its use in the domain.
d=Driver('remote_control_exchange_and_retest_guard')
for before,after,command in [('initial','right','ACTION4'),('right','down','ACTION2'),('down','left','ACTION3'),('left','up','ACTION1')]:d.execute({'kind':'record','before':before,'after':after,'command':{'action_ref':command}})
# Remove the lower bypass so the conditional frontier stops at the changed cell.
closed=navigation(closed=True);rect(closed,4,12,20,4,0);rect(closed,20,12,4,4,1);opened=navigation(closed=True,swapped=True);rect(opened,4,12,16,4,0)
observe('closed_corridor',closed);observe('opened_corridor',opened)
# Closed corridor may still first approach the nearer reachable cell.
view=scenes['closed_corridor'];m=d.memory
p=d.execute({'kind':'propose','scene':'closed_corridor'})
if p and not p['actions'][0].get('data'):
    nearer=deepcopy(closed);rect(nearer,4,8,4,4,1);rect(nearer,8,8,4,4,2);observe('nearer',nearer)
    d.execute({'kind':'record','before':'closed_corridor','after':'nearer','command':p['actions'][0],'selected':True,'index':0})
    p=d.execute({'kind':'propose','scene':'nearer'});before_name='nearer'
    nearer_open=deepcopy(opened);rect(nearer_open,4,8,4,4,1);rect(nearer_open,8,8,4,4,2);observe('nearer_open',nearer_open);after_name='nearer_open'
else:before_name='closed_corridor';after_name='opened_corridor'
assert p and p['actions'][0].get('data'),p
assert p['support_plan'].get('experiment_key')
d.execute({'kind':'bind'});d.execute({'kind':'before','scene':before_name});d.execute({'kind':'after','before':before_name,'after':after_name});d.execute({'kind':'record','before':before_name,'after':after_name,'command':p['actions'][0],'selected':True,'index':0});d.execute({'kind':'before','scene':before_name})
d.execute({'kind':'quotient','scene':after_name});d.execute({'kind':'propose','scene':after_name})
# A fresh observed translation rebinds the underlay after the remote rewrite.
access=deepcopy(scenes[after_name]['rows']);rect(access,8,8,4,4,1);rect(access,12,8,4,4,2);observe('after_access',access)
d.execute({'kind':'record','before':after_name,'after':'after_access','command':{'action_ref':'ACTION4'}})
after_name='after_access';d.execute({'kind':'propose','scene':after_name});d.save()

# Calculator calls retain the exact scope learned by the preceding coordinator.
m=d.memory;view=scenes[after_name];components,actor,target,controls=m.scene(view['rows']);h,w=actor.bbox.height,actor.bbox.width;ro,co=actor.bbox.top%h,actor.bbox.left%w
associations=[support.association(actor,'moving'),support.association(target,'fixed'),*m.controls.values()]
memory={'moving_association_refs':[associations[0]['term_ref']],'fixed_association_refs':[associations[1]['term_ref']],'control_association_refs':list(m.controls),'observed_lattice_calibration_rows':[{'row_pitch':h,'col_pitch':w,'row_phase':ro,'col_phase':co}],'observed_entered_surface_rows':[{'before_pattern':list(pattern)}for pattern in sorted(m.entered)],'observed_remote_effect_rows':m.effects}
contract={**m.config['dependency_measurement_contract'],'interface_steps':m.directions,'maximum_executable_series_actions':16}
base={'frame':view['rows'],'components':components,'memory':memory,'associations':associations,'contract':contract,'available_actions':view['observation']['available_action_refs'],'current_input_aligned_underlay_values':m.underlay['row']['underlay_values']if m.underlay else (), 'input_aligned_entity_bboxes':(actor.bbox,)if m.underlay else (), 'current_translation_underlay_rows':(m.underlay['row'],)if m.underlay and m.underlay['observed_frame_hash']==view['observation']['frame_hash']else ()}
for name,changes in [('acquired_exchange',{}),('bound_one_action',{'contract':{**contract,'maximum_executable_series_actions':1}}),('search_incomplete',{'contract':{**contract,'maximum_states':1}}),('no_operators',{'memory':{**memory,'observed_remote_effect_rows':[]}}),('invalid_pixel_bound',{'contract':{**contract,'maximum_pixels':1}}),('missing_actor',{'memory':{**memory,'moving_association_refs':['absent']}}),('no_calibration',{'memory':{**memory,'observed_lattice_calibration_rows':[]}})]:
    args={**base,**changes};capture('domain',name,args,lambda args=args:measure_support_navigation_domain(**args))
for epoch in(1,2):capture('reciprocal','fields_epoch_'+str(epoch),{'effects':m.effects,'rows':view['rows'],'epoch':epoch,'height':h,'width':w},lambda epoch=epoch:contacts.current_reciprocal_fields(m.effects,view['rows'],epoch,h,w))
field={'bbox':[4,4,5,5],'pattern':[1,2,2,1]};capture('addressed','field_component',{'field':field},lambda:contacts.addressed_component(field));capture('field_association','field_association',{'field':field},lambda:contacts.field_association(field))
for turns in [[0],[0,1,2,3],[4]]:
    frame=[[0]*7 for _ in range(7)];frame[1][1]=2;frame[1][2]=3;frame[2][1]=2;frame[4][4]=3;frame[4][5]=2;frame[5][5]=2
    args={'frame':frame,'signature':[(0,0,2),(0,1,3),(1,0,2)],'quarter_turns':turns,'maximum_pixels':4096,'maximum_matches':256}
    capture('valued_pose','valued_'+str(turns),args,lambda args=args:measure_exact_valued_mask_poses(**args))
for deltas in [((4,0),(0,4)),((4,0),),((4,0),(0,2))]:
    boxes=[SimpleNamespace(top=4,left=4,height=4,width=4)];capture('lattices','lattice_'+str(deltas),{'boxes':boxes,'translations':deltas},lambda d=deltas:measure_unit_translation_lattices(boxes=boxes,translations=d))
for q in(0,1,2,3):capture('transform','turn_'+str(q),{'points':[(2,4),(2,6)],'command':{'kind':'QUARTER_TURN','pivot':(4,4),'quarter_turns':q}},lambda q=q:_support_transform(((2,4),(2,6)),SimpleNamespace(kind='QUARTER_TURN',pivot=(4,4),quarter_turns=q)))

paths=['agents/yf_arc3_v6/laya_proto/'+p+'.py'for p in('common_support_navigation','support_contact_questions','common_visible_identity','common_control_dependencies','neutral_observer','observed_input_domain')]+['agents/yf_arc3_v5/capabilities/'+p+'.py'for p in('support_navigation_domain','navigation_transition_measurements','appearance','components','actor_lattice_measurements','valued_mask_pose_measurements','sprite_occlusion','reconfigurable_support')]
manifest=json.loads((ROOT/'reference/v6'/COMMIT/'manifest.json').read_text());hashes={}
for path in paths:
    value=hashlib.sha256((SOURCE/path).read_bytes()).hexdigest();assert manifest['files'][path]['sha256']==value,path;hashes[path]=value
result={'commit':COMMIT,'qualification':'Unchanged source methods and support-domain calculators on controlled public-pixel fixtures; zero claimed solved game levels. Child-family ports have separate differential suites.','sourceHashes':hashes,'scenes':scenes,'cases':cases,'scenarios':scenarios}
path=ROOT/'tests/fixtures/v6-support-navigation-reference.json.gz';path.write_bytes(gzip.compress((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode(),mtime=0));print(json.dumps({'path':str(path),'cases':len(cases),'scenarioSteps':sum(len(s['steps'])for s in scenarios),'domainPositive':sum(c['operation']=='domain'and c.get('expected',{}).get('witness_present',False)for c in cases)}))
