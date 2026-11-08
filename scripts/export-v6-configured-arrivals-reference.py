#!/usr/bin/env python3
"""Unchanged-source differential oracle: configured routes and raster lattices.
Controlled public raster/packet scenarios; no game victory claim or runtime oracle.
"""
import sys,json,hashlib,copy,random
import gzip
from pathlib import Path
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[1];COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';SOURCE=ROOT/'reference/v6'/COMMIT/'source';LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto';sys.path[:0]=[str(SOURCE),str(LAYA)]
from agents.yf_arc3_v5.capabilities.frame import enumerate_periodic_cell_grids,_measure_periodic_axes
from agents.yf_arc3_v5.capabilities.tile_lattice import exact_bordered_tile_lattices,exact_joint_tile_lattices
from agents.yf_arc3_v5.capabilities.cell_shape_support import RepeatedShapeFamily,measure_shape_lattice_geometries
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,PeriodicCellGridInput
from agents.yf_arc3_v5.capabilities.policy_constrained_routing_d import PolicyConstrainedRoutingRequestD,measure_policy_constrained_routing_d
from agents.yf_arc3_v5.capabilities.prescribed_transit_coincidence_d import PrescribedTransitCoincidenceRequestD,measure_prescribed_transit_coincidence_d
from common_configured_arrivals import ConfiguredArrivals,scene,crosses,route
from neutral_observer import measure
from observed_input_domain import ObservedInputDomain

def plain(v):
 if v is None or type(v)in(str,int,bool,float):return v
 if hasattr(v,'model_dump'):return plain(v.model_dump(mode='python'))
 if isinstance(v,dict)or hasattr(v,'items'):return {str(k):plain(x)for k,x in v.items()}
 if isinstance(v,(set,frozenset)):return [plain(x)for x in sorted(v)]
 if isinstance(v,(tuple,list)):return [plain(x)for x in v]
 if hasattr(v,'__dataclass_fields__'):return {k:plain(getattr(v,k))for k in v.__dataclass_fields__}
 raise TypeError(type(v))
def state(m):return {'schema':'logos-engine.configured-arrivals.v1',**{k:plain(getattr(m,k))for k in ('epoch','grid','launch','races','orders','toggle_pairs','refs','events','tried','goal_method','fit')},'delays':[[list(p),d]for p,d in sorted(m.delays.items())]}
def plain_scene(s):
 if s is None:return None
 return {**{k:plain(v)for k,v in s.items()if k not in('cells','base')},'cells':[[list(p),plain(c)]for p,c in s['cells'].items()],'base':plain(s['base'])}
def raster(poses=((2,2,2),(3,2,22)),extra=False):
 rows=[[1]*25 for _ in range(25)]
 for y in range(2,25,5):
  for x in range(2,25,5):rows[y][x]=8
 for y in range(10,15):
  for x in range(15,20):
   if y in(10,14)or x in(15,19):rows[y][x]=9
 for v,x,y in poses:
  for a,b in((x-1,y),(x+1,y),(x,y-1),(x,y+1)):rows[b][a]=v
 if extra:
  for y in range(1,4):
   for x in range(6,9):rows[y][x]=7
 return rows
frames=[raster([(2,2+5*min(i,3),2+5*max(i-3,0)),(3,2+5*min(i,3),22-5*max(i-3,0))])for i in range(5)]+[raster([]),raster()]
rasters={'network':raster(),'exceptional':raster(extra=True),'empty':[[0]*12 for _ in range(12)]}
for n in range(5):
 random.seed(n);rasters[f'noise{n}']=[[random.randrange(4)for _ in range(14)]for _ in range(13)]
rasters['joint']=[[((y//3)+(x//3))%3 for x in range(15)]for y in range(15)]
rasters['bordered']=[[0 if x%5 in(0,4)or y%5 in(0,4)else 2 for x in range(20)]for y in range(20)]
cases=[]
for name,rows in rasters.items():
 f=FrameGrid(rows=tuple(map(tuple,rows)))
 for conditioned in (True,False):
  request=PeriodicCellGridInput(frame=f,action_conditioned_grid_evidence=conditioned);result=plain(enumerate_periodic_cell_grids(request));result.pop('schema_version');
  for c in result['candidates']:
   for k in ('cells','clipped_cells','visible_row_range','visible_column_range','schema_version'):c.pop(k)
  cases.append({'id':name+str(conditioned),'kind':'grid','rows':rows,'options':{'action_conditioned_grid_evidence':conditioned},'expected':result})
 for bordered in(False,True):cases.append({'id':name+'tiles'+str(bordered),'kind':'tiles','rows':rows,'bordered':bordered,'expected':plain((exact_bordered_tile_lattices if bordered else exact_joint_tile_lattices)(f,maximum_pitch=16))})
 for axis in('row','column'):cases.append({'id':name+axis,'kind':'axis','rows':rows,'axis':axis,'expected':plain(_measure_periodic_axes(f,axis=axis,maximum_pitch=min(16,len(rows)if axis=='row'else len(rows[0]))))})
 for grid in(None,(5,2,2)):
  try:cases.append({'id':name+'scene'+str(grid),'kind':'scene','rows':rows,'grid':grid,'expected':plain_scene(scene(rows,grid))})
  except Exception:pass
families=[RepeatedShapeFamily(8,1,1,1,9,tuple((y,x)for y in(2,7,12)for x in(2,7,12)))]
cases.append({'id':'shape_lattice','kind':'shape','rows':rasters['network'],'families':plain(families),'expected':plain(measure_shape_lattice_geometries(FrameGrid(rows=tuple(map(tuple,rasters['network']))),tuple(families),max_geometries=32))})
scenes={}
def observe(name,rows,level=1,score=0):
 raw=SimpleNamespace(frame_rows=rows,frame_packet=[rows],frame_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()[:16],level=level,levels_completed=score,state='NOT_FINISHED',step_index=len(scenes),available_action_refs=['ACTION1','ACTION6'])
 obs,_=measure(raw,len(scenes),'configured-reference');domain=ObservedInputDomain(4096);inputs=domain.candidates(obs);scenes[name]={'rows':rows,'observation':plain(obs),'public':plain(vars(raw)),'inputs':plain(inputs)};return raw
raws={'network':observe('network',rasters['network']),'exceptional':observe('exceptional',rasters['exceptional']),'new_epoch':observe('new_epoch',rasters['network'],2,1),'scored':observe('scored',rasters['network'],1,1)}
scenarios=[]
for variant in ('packet','explicit_grid','exceptional'):
 m=ConfiguredArrivals();steps=[];proposal=None
 def do(op):
  global proposal
  k=op['kind'];v=scenes[op.get('scene','network')]
  if k=='seed':
   for key,value in op['fields'].items():setattr(m,key,copy.deepcopy(value))
   result=None
  elif k=='record':
   a,b=scenes[op['before']],scenes[op['after']];result=m.record(a['observation'],b['observation'],op['command'],a['rows'],b['rows'],proposal if op.get('selected')else None,op.get('index'),op.get('frames'))
  elif k=='propose':proposal=m.propose(v['observation'],v['rows'],v['inputs'],op.get('remaining',16));result=copy.deepcopy(proposal)
  elif k=='before':result=m.before(proposal,op.get('index',0),raws[op['scene']],v['observation'])
  elif k=='after':
   a,b=scenes[op['before']],scenes[op['after']];result=m.after(proposal,op.get('index',0),a['observation'],b['observation'],a['rows'],b['rows'])
  else:raise ValueError(k)
  steps.append({'operation':plain(op),'expected':{'result':plain(result),'state':state(m)}});return result
 do({'kind':'propose','scene':'network'})
 if variant=='explicit_grid':do({'kind':'seed','fields':{'epoch':1,'grid':(5,2,2)}})
 do({'kind':'record','before':'network','after':'network','command':{'action_ref':'ACTION1'},'frames':frames})
 p=do({'kind':'propose','scene':'exceptional'if variant=='exceptional'else'network'})
 if p:
  do({'kind':'before','scene':'exceptional'if variant=='exceptional'else'network'});do({'kind':'before','scene':'new_epoch'});do({'kind':'after','before':'network','after':'network'});do({'kind':'after','before':'network','after':'scored'})
  if variant=='exceptional':do({'kind':'record','before':'exceptional','after':'network','command':p['actions'][0],'selected':True,'index':0});do({'kind':'propose','scene':'network'})
 do({'kind':'propose','scene':'new_epoch'});do({'kind':'propose','scene':'network','remaining':0})
 scenarios.append({'id':variant,'steps':steps})
scope=dict(request_ref='arrival:1',caller_ref='oracle',parent_consumer_ref='SupportNavigation',parent_goal_ref='G',parent_contribution_ref='C',caller_next_item_ref='routes',epoch=1,evidence_revision_ref='E',model_revision_ref='M',model_status_ref='observed',event_owner_ref='public',input_domain_complete=True,assumption_refs=())
base=dict(scope=scope,requested_result_type='DMechanicalResult',node_bound=10000,depth_bound=4096,domain_bound=4096,time_bound_ms=60000)
routebase={**base,'operation_ref':'mechanics.autonomous_route_intervention.policy_constrained_routing','mode_ref':'DOMAIN','phase_ref':'ROLE_TAGGED_INTERNAL_ROUTE','graph_role':'PHYSICAL_PASSAGE','node_refs':['a','b','c','d'],'edges':[dict(edge_ref=f'e{i}',first_ref=a,second_ref=b)for i,(a,b)in enumerate([('a','b'),('a','c'),('b','d'),('c','d')])],'directed':False,'origin_ref':'a','destination_ref':'d','requested_property':'REALIZED_ROUTE','policies':[dict(policy_ref='shortest',metric='EDGE_COUNT',neighbor_order=None,permit_blocked_nodes=False)]}
for name,change in [('positive',{}),('node_bound',{'node_bound':1}),('domain_bound',{'domain_bound':1}),('depth_bound',{'depth_bound':1}),('blocked',{'blocked_node_refs':['b','c']}),('resume',{'resume_frontier':{'test':True}}),('reachability',{'requested_property':'REACHABILITY_ONLY'}),('signature',{'operation_ref':'other'}),('tie_order',{'policies':[dict(policy_ref='ordered',metric='EDGE_COUNT',neighbor_order=['a','b','c','d'],permit_blocked_nodes=False)]})]:
 req=PolicyConstrainedRoutingRequestD(**{**routebase,**change});cases.append({'id':name,'kind':'route_mechanics','request':plain(req),'expected':plain(measure_policy_constrained_routing_d(req))})
timedbase={**base,'operation_ref':'mechanics.clock_event_model.prescribed_transit_coincidence','mode_ref':'EVALUATE','phase_ref':'PRESCRIBED_TIMED_ROUTES','actors':[dict(actor_ref=str(i),route=['a','b','d'],departure_tick=0,transition_ticks=[1,1],exit_ref='d')for i in(2,3)],'timing_rule':'CHECK_ARRIVAL_BEFORE_ENTRY','required_actor_refs':['2','3'],'stop_actor_at_first_arrival':True,'commanded_edit_count':0,'elapsed_tick_limit':4096}
for name,change in [('coincident',{}),('dwell',{'dwell_ticks':[('b',2)]}),('gate',{'gates':[dict(cell_ref='d',period=5,open_phases=[1,3])]}),('closed_gate',{'gates':[dict(cell_ref='d',period=5,open_phases=[])]}),('time_rule',{'timing_rule':'CHECK_DEPARTURE_THEN_TRAVEL'}),('depth_bound',{'depth_bound':1}),('node_bound',{'node_bound':1}),('elapsed_bound',{'elapsed_tick_limit':1}),('resume_bad',{'resume_frontier':{'input_digest':'wrong'}})]:
 req=PrescribedTransitCoincidenceRequestD(**{**timedbase,**change});cases.append({'id':name,'kind':'time_mechanics','request':plain(req),'expected':plain(measure_prescribed_transit_coincidence_d(req))})
paths=[f'agents/yf_arc3_v6/laya_proto/{p}.py'for p in('common_configured_arrivals',)]+[f'agents/yf_arc3_v5/capabilities/{p}.py'for p in('frame','tile_lattice','cell_shape_support','policy_constrained_routing_d','prescribed_transit_coincidence_d','mechanical_family_contracts_d')];manifest=json.loads((ROOT/'reference/v6'/COMMIT/'manifest.json').read_text());hashes={p:hashlib.sha256((SOURCE/p).read_bytes()).hexdigest()for p in paths};assert all(h==manifest['files'][p]['sha256']for p,h in hashes.items())
output=ROOT/'tests/fixtures/v6-configured-arrivals-reference.json.gz';output.write_bytes(gzip.compress((json.dumps({'sourceHashes':hashes,'cases':cases,'scenes':scenes,'scenarios':scenarios},separators=(',',':'))+'\n').encode(),mtime=0));print(json.dumps({'path':str(output),'cases':len(cases),'steps':sum(len(s['steps'])for s in scenarios),'positiveProposals':sum(x['operation']['kind']=='propose'and x['expected']['result']is not None for s in scenarios for x in s['steps'])}))
