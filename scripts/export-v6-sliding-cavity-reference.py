#!/usr/bin/env python3
"""Unchanged V6 cavity oracle, real AS66 public packets and controlled clock masks."""
import sys,json,hashlib,copy,shutil,tempfile,zipfile
import gzip
from pathlib import Path
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[1];COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto';sys.path[:0]=[str(SOURCE),str(LAYA)]
from common_sliding_cavity import SlidingCavity,components
from common_cavity_clock import CavityClock
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v5.capabilities.open_cavity import rectangular_open_complements,measure_connecting_surface,measure_open_cavity_stop_geometry
from agents.yf_arc3_v5.capabilities.open_cavity_transfer import measure_recalled_stop_graph
from agents.yf_arc3_v5.capabilities.wrap_slide import WrapCell,WrapMember,WrapState,WrapTopology,WrapModel,WrapCommand,_slide
from agents.yf_arc3_v5.capabilities.patrol_body import PatrolBody,PatrolCell,PatrolState,PatrolLaw,PatrolClockModel,PatrolTickRequest,advance_patrol_tick
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_a import MechanicalFamilyScope
from agents.yf_arc3_v5.logos.types import FrozenMap

def plain(v):
 if v is None or type(v)in(str,int,bool,float):return v
 if hasattr(v,'model_dump'):return plain(v.model_dump(mode='python'))
 if hasattr(v,'tolist'):return plain(v.tolist())
 if isinstance(v,dict)or hasattr(v,'items'):
  d={str(k):plain(x)for k,x in v.items()}
  if set(d)=={'top','left','bottom','right'}:d.update(height=d['bottom']-d['top']+1,width=d['right']-d['left']+1)
  return d
 if isinstance(v,(set,frozenset)):return [plain(x)for x in sorted(v)]
 if isinstance(v,(tuple,list)):return [plain(x)for x in v]
 if hasattr(v,'__dict__'):return plain(vars(v))
 raise TypeError(type(v))
def packet(engine,step,scope='cavity-oracle'):
 rows=plain(engine['frame']);raw=SimpleNamespace(frame_rows=rows,frame_packet=plain(engine.get('frames',[rows])),level=engine.get('level',1),levels_completed=engine.get('levelsCompleted',0),state=engine.get('state','NOT_FINISHED'),step_index=step,available_action_refs=[f'ACTION{i}'for i in engine.get('availableActionIds',[1,2,3,4])],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16]);obs,_=measure(raw,step,scope);domain=ObservedInputDomain(4096);inputs=domain.candidates(obs);return {'public':plain(raw),'observation':plain(obs),'inputs':plain(inputs)},raw,obs
fixture={'mechanics':[],'geometry':[],'scenarios':[],'games':[]}
# Every construction below is the exact single-body contract the V6 caller uses.
for terrain in ('free','blocked','unknown','absent'):
 cells=[WrapCell(x=x,y=y,terrain='SUPPORT',evidence_ref='E')for y in range(3)for x in range(4)]
 if terrain in('blocked','unknown'):cells=[c.model_copy(update={'terrain':terrain.upper()})if(c.x,c.y)==(2,1)else c for c in cells]
 if terrain=='absent':cells=[c for c in cells if(c.x,c.y)!=(2,1)]
 for depth,maximum in ((13,65536),(1,65536),(13,1)):
  state=WrapState(members=(WrapMember(member_ref='body',type_ref='body',x=0,y=1,offsets=((0,0),),alive=True),),member_order=('body',),required_member_refs=('body',),cells=tuple(cells),seats=(),remaining_budget=16,input_tick=0,level_scope_ref='1',restore_epoch=0,status='ACTIVE');model=WrapModel(model_ref='conditional',topology=WrapTopology(topology_ref='current',minimum_x=0,maximum_x=3,minimum_y=0,maximum_y=2,horizontal='WRAP',vertical='WRAP',revisit_stop='BEFORE_REENTER_POSE',evidence_ref='E'),order_kind='ORDERED',motion='SLIDE',boundary_body_rule='WRAP_ANCHOR',patrol_clock_phase='NONE');command=WrapCommand(input_ref='ACTION4',action_ref='ACTION4',payload=FrozenMap(),dx=1,dy=0,cost=1)
  after,events,debt,work,cut=_slide(state,model,SimpleNamespace(command_scope_ref='cavity-test',maximum_depth=depth),command,maximum,allow_hypothetical=True)
  # Path is private work in _slide, exported from observed exact event snapshots.
  path=[(0,1)]
  for e in events:
   if e['kind']=='MEMBER_CELL_MOVE':path.append(e['after'])
  fixture['mechanics'].append({'kind':'slide','name':f'{terrain}:{depth}:{maximum}','cells':plain(cells),'position':[0,1],'delta':[1,0],'columns':4,'rows':3,'maximumDepth':depth,'maximum':maximum,'expected':{'position':[after.members[0].x,after.members[0].y],'debt':plain(debt),'work':work,'bound':bool(cut),'path':plain(path)}})
for terrain in('free','blocked','unknown','absent'):
 for response in('REVERSE_ONLY','REVERSE_AND_ATTEMPT'):
  cells=[PatrolCell(x=x,y=y,support='SUPPORTED',evidence_ref='E')for y in range(3)for x in range(4)]
  if terrain in('blocked','unknown'):cells=[c.model_copy(update={'support':terrain.upper()})if(c.x,c.y)==(2,1)else c for c in cells]
  if terrain=='absent':cells=[c for c in cells if(c.x,c.y)!=(2,1)]
  body=PatrolBody(patrol_ref='observed_composite',x=1,y=1,offsets=((0,0),),dx=1,dy=0,phase=0,mask_evidence_ref='E');state=PatrolState(patrols=(body,),cells=tuple(cells),targets=(),clock_tick=0);law=PatrolLaw(patrol_ref=body.patrol_ref,cadence=1,phase_modulus=1,blocked_response=response,other_patrols_block=False,pre_motion_capture=False,post_motion_capture=False,law_evidence_ref='E');model=PatrolClockModel(model_ref='local',input_advancement=(('ACTION4',True),),laws=(law,),clock_evidence_ref='E',time_base='INPUT_INDEX');scope=MechanicalFamilyScope(request_ref='test',caller_ref='oracle',parent_goal_ref='G',parent_contribution_ref='C',epoch=1,evidence_revision_ref='E',model_revision_ref='M',model_status_ref='conditional',event_owner_ref='external',input_domain_complete=False)
  for maximum in(65536,1):
   result=advance_patrol_tick(PatrolTickRequest(scope=scope,operation_ref='mechanics.patrol_body.pre_input_tick',mode='STEP_INTERNAL',maximum_evaluations=maximum,state=state,model=model,input_ref='ACTION4',event_ref='tick',event_clock_tick=0,clock_ref='external_input',temporal_scope_ref='E'))
   final=plain(result.values['after_state']);fixture['mechanics'].append({'kind':'patrol','name':f'{terrain}:{response}:{maximum}','cells':plain(cells),'body':plain(body),'response':response,'maximum':maximum,'expected':{'completed':result.values['clock_event_completed'],'body':final['patrols'][0],'work':result.examined_count,'debt':plain(result.prerequisite_refs),'bound':result.computation_bound_reached}})
# A real-game family harness observes public exploratory commands only when the
# source family has no current proposal; it is not an integrated-agent score.
with tempfile.TemporaryDirectory(prefix='v6-cavity-game-')as folder:
 temp=Path(folder)
 for name in('custom-games.zip','official-games.zip'):
  with zipfile.ZipFile(ROOT/'public/python'/name)as archive:archive.extractall(temp)
 for name in('game_bridge.py','official_adapter.py','custom_level_navigation.py'):shutil.copy(ROOT/'public/python'/name,temp/name)
 sys.path.insert(0,str(temp));import game_bridge
 def send(kind,**payload):
  v=json.loads(game_bridge.dispatch(json.dumps({'type':kind,**payload})))
  if 'error'in v:raise RuntimeError(v['error'])
  return v
 m=SlidingCavity();initial,current,obs=packet(send('load',code='AS66',level=1),0);game={'code':'AS66','qualification':'Original family-only development oracle with labelled public exploratory inputs, not integrated runtime victory','initial':initial,'steps':[]};probes=iter([1,2,3,4]*4)
 for n in range(80):
  domain=ObservedInputDomain(4096);proposal=m.propose(obs,current.frame_rows,domain.candidates(obs),80-n);entry={'beforeState':plain(m.state()),'proposal':plain(copy.deepcopy(proposal)),'before':{'public':plain(current),'observation':plain(obs)},'remaining':80-n};game['steps'].append(entry)
  if proposal:command=proposal['actions'][0];entry['beforeGuard']=plain(m.before(proposal,0,current,obs))
  else:
   try:command={'action_ref':f'ACTION{next(probes)}'}
   except StopIteration:break
   entry['exploratory']=True
  nextdata,nxt,after=packet(send('action',actionId=int(command['action_ref'][6:]),data=command.get('data')),n+1);entry['command']=plain(command);entry['after']=nextdata
  if proposal:entry['afterGuard']=plain(m.after(proposal,0,obs,after,current.frame_rows,nxt.frame_rows))
  entry['record']=plain(m.record(obs,after,command,current.frame_rows,nxt.frame_rows,proposal,0,frames=nxt.frame_packet));entry['state']=plain(m.state())
  value=m.input(after,nxt.frame_rows);entry['geometry']=plain(measure_open_cavity_stop_geometry(value));entry['complements']=plain(rectangular_open_complements(value.components.components));current,obs=nxt,after
  if current.state in('WIN','GAME_OVER'):break
 game['levelsCompleted']=current.levels_completed;game['state']=current.state;fixture['games'].append(game);print(json.dumps({'AS66levels':current.levels_completed,'steps':len(game['steps']),'state':current.state}),flush=True)

def raster(actor=(4,14),hazard=(8,6)):
 rows=[[5]*24 for _ in range(24)]
 for y in range(2,22):
  for x in range(2,22):rows[y][x]=1
 for y in range(10,16):
  for x in range(14,18):
   if not(12<=y<14 and x<16):rows[y][x]=9
 x,y=actor
 for dy in range(2):
  for dx in range(2):rows[y+dy][x+dx]=2
 x,y=hazard
 for dy in range(4):
  for dx in range(2):rows[y+dy][x+dx]=6+dx
 return rows
views={}
for name,actor,hazard in [('a',(4,14),(8,6)),('clock1',(4,14),(10,6)),('b',(4,16),(10,6)),('clock2',(4,16),(12,6)),('c',(6,16),(12,6))]:views[name]=packet({'frame':raster(actor,hazard)},len(views),'clock-raster')
m=SlidingCavity();m.body_type=(2,2,2);m.floor=1;m.directions={'ACTION1':(-1,0),'ACTION2':(1,0),'ACTION3':(0,-1),'ACTION4':(0,1)};scenario={'id':'pre-input-composite-clock','initial':plain(m.state()),'steps':[],'views':{k:v[0]for k,v in views.items()}}
for a,b,mid,command in [('a','b','clock1','ACTION2'),('b','c','clock2','ACTION4')]:
 _,raw,before=views[a];_,nxt,after=views[b];frames=[views[mid][1].frame_rows,nxt.frame_rows];result=m.record(before,after,{'action_ref':command},raw.frame_rows,nxt.frame_rows,None,None,frames);scenario['steps'].append({'operation':{'kind':'record','before':a,'after':b,'command':{'action_ref':command},'frames':frames},'result':plain(result),'state':plain(m.state())})
_,raw,obs=views['c'];proposal=m.propose(obs,raw.frame_rows,[],16);scenario['steps'].append({'operation':{'kind':'propose','scene':'c','remaining':16},'result':plain(copy.deepcopy(proposal)),'state':plain(m.state())});print(json.dumps({'clockMeasurements':len(m.clock.measurements),'clockPositive':bool(proposal)}),flush=True)
if proposal:
 for scene_name in('c','a'):
  _,pub,obs=views[scene_name];scenario['steps'].append({'operation':{'kind':'before','scene':scene_name},'result':plain(m.before(proposal,0,pub,obs)),'state':plain(m.state())})
fixture['scenarios'].append(scenario)
paths=[f'agents/yf_arc3_v6/laya_proto/{p}.py'for p in('common_sliding_cavity','common_cavity_clock')]+[f'agents/yf_arc3_v5/capabilities/{p}.py'for p in('open_cavity','open_cavity_transfer','wrap_slide','patrol_body')];manifest=json.loads((ROOT/'reference/v6'/COMMIT/'manifest.json').read_text());hashes={p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest()for p in paths};assert all(h==manifest['files'][p]['sha256']for p,h in hashes.items());fixture['sourceHashes']=hashes
output=ROOT/'tests/fixtures/v6-sliding-cavity-reference.json.gz';output.write_bytes(gzip.compress((json.dumps(fixture,separators=(',',':'))+'\n').encode(),mtime=0));print(str(output),flush=True)
