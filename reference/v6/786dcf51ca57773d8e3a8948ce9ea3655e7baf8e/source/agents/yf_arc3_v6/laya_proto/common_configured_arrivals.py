"""Public trajectories, scoped routing hypotheses and configured arrival questions."""
from collections import Counter,defaultdict,deque
from itertools import permutations,product
from pathlib import Path
import json
from common_fixed_origin import parts,box
from common_multiscale_constraints import digest
from observed_input_domain import ObservedInputDomain
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,PeriodicCellGridInput
from agents.yf_arc3_v5.capabilities.frame import enumerate_periodic_cell_grids
from agents.yf_arc3_v5.capabilities.cell_shape_support import RepeatedShapeFamily,measure_shape_lattice_geometries
from agents.yf_arc3_v5.capabilities.policy_constrained_routing_d import PolicyConstrainedRoutingRequestD,InternalRoutePolicyD,measure_policy_constrained_routing_d
from agents.yf_arc3_v5.capabilities.single_visit_residual_d import ResidualEdgeD
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DMechanicalScope
from agents.yf_arc3_v5.capabilities.prescribed_transit_coincidence_d import FixedTransitActorD,PrescribedTransitCoincidenceRequestD,measure_prescribed_transit_coincidence_d

def crosses(rows):
 found=[]
 for y in range(1,len(rows)-1):
  for x in range(1,len(rows[0])-1):
   v=rows[y-1][x]
   if rows[y][x]!=v and all(rows[yy][xx]==v for xx,yy in ((x+1,y),(x-1,y),(x,y+1))) and all(rows[yy][xx]!=v for xx,yy in ((x-1,y-1),(x+1,y-1),(x-1,y+1),(x+1,y+1))):found.append((v,x,y))
 return found
def patch(rows,p):
 x,y=p;return tuple(tuple(rows[b][x-1:x+2]) for b in range(y-1,y+2))
def turn(a):return tuple(zip(*a[::-1]))
def variants(a,b):
 for reflected in (False,True):
  x=tuple(row[::-1] for row in a) if reflected else a;y=tuple(row[::-1] for row in b) if reflected else b
  for k in range(4):yield x,y;x,y=turn(x),turn(y)
def scene(rows,grid=None):
 actors=crosses(rows)
 if len(actors)<2 or len({v for v,x,y in actors})!=len(actors):return None
 if grid is None:
  gs=enumerate_periodic_cell_grids(PeriodicCellGridInput(frame=FrameGrid(rows=tuple(map(tuple,rows))))).candidates
  choices={(g.row_pitch,g.col_offset+g.col_pitch//2,g.row_offset+g.row_pitch//2) for g in gs if g.row_pitch==g.col_pitch and all((x-g.col_offset-g.col_pitch//2)%g.col_pitch==0 and (y-g.row_offset-g.row_pitch//2)%g.row_pitch==0 for v,x,y in actors)}
  if not choices:
   points=defaultdict(list)
   for c in parts(rows):
    if c.area==1:points[c.value].append((c.bbox.top,c.bbox.left))
   for value,origins in points.items():
    if len(origins)<3:continue
    family=RepeatedShapeFamily(value,1,1,1,len(origins),tuple(origins));measured=measure_shape_lattice_geometries(FrameGrid(rows=tuple(map(tuple,rows))),(family,),max_geometries=32)
    for g in measured.geometries:
     if g.row_pitch==g.col_pitch and g.row_pitch>1 and all(x%g.col_pitch==g.col_offset and y%g.row_pitch==g.row_offset for v,x,y in actors):choices.add((g.row_pitch,g.col_offset,g.row_offset))
  if len(choices)!=1:return None
  pitch,px,py=next(iter(choices));grid=(pitch,px%pitch,py%pitch)
 pitch,px,py=grid
 if not all(x%pitch==px and y%pitch==py for v,x,y in actors):return None
 cells={};floors=[]
 for v,x,y in actors:
  counts=Counter(rows[yy][xx] for yy in range(y-pitch//2,y-pitch//2+pitch) for xx in range(x-pitch//2,x-pitch//2+pitch));floors.append(counts.most_common(1)[0][0])
 if len(set(floors))!=1:return None
 floor=floors[0];components=parts(rows);background={c.value for c in components if c.area>=len(rows)}|{floor}
 dots=Counter(c.value for c in components if c.area==1 and c.bbox.left%pitch==px and c.bbox.top%pitch==py)
 if dots:background.add(dots.most_common(1)[0][0])
 rings=[c for c in components if c.value not in background and c.bbox.width==c.bbox.height and 2<c.bbox.width<=pitch+1 and c.area==4*(c.bbox.width-1) and rows[(c.bbox.top+c.bbox.bottom)//2][(c.bbox.left+c.bbox.right)//2] in background]
 rings=[c for c in rings if ((c.bbox.left+c.bbox.right)//2)%pitch==px and ((c.bbox.top+c.bbox.bottom)//2)%pitch==py]
 if len(rings)!=1:return None
 target=((rings[0].bbox.left+rings[0].bbox.right)//2,(rings[0].bbox.top+rings[0].bbox.bottom)//2)
 for y in range(py,len(rows),pitch):
  for x in range(px,len(rows[0]),pitch):
   l=x-pitch//2;t=y-pitch//2
   if l<0 or t<0 or l+pitch>len(rows[0]) or t+pitch>len(rows) or min(x,y)<1 or x>=len(rows[0])-1 or y>=len(rows)-1:continue
   counts=Counter(rows[b][a] for b in range(t,t+pitch) for a in range(l,l+pitch));colors=set(counts)-background
   cells[x,y]={'point':(x,y),'patch':patch(rows,(x,y)),'floor_count':counts[floor],'ordinary':not colors,'colors':colors,'open':counts[floor]>pitch*pitch//2}
 starts={(x,y) for v,x,y in actors};base={p for p,c in cells.items() if c['open']}|starts|{target};connected=set(starts);q=list(starts)
 while q:
  x,y=q.pop()
  for peer in ((x+pitch,y),(x-pitch,y),(x,y+pitch),(x,y-pitch)):
   if peer in base and peer not in connected:connected.add(peer);q.append(peer)
 candidates=[]
 for p,c in cells.items():
  x,y=p
  if p in starts or p==target or not c['colors']:continue
  adjacent=sum(peer in base for peer in ((x+pitch,y),(x-pitch,y),(x,y+pitch),(x,y-pitch)))
  if p in connected or adjacent>=2:candidates.append(p)
 return {'grid':grid,'actors':actors,'target':target,'cells':cells,'base':base,'candidates':sorted(candidates),'background':background,'floor':floor}
def route(nodes,start,target,order,pitch):
 dist={target:0};q=deque([target])
 while q:
  x,y=q.popleft()
  for dx,dy in order:
   p=(x+dx*pitch,y+dy*pitch)
   if p in nodes and p not in dist:dist[p]=dist[x,y]+1;q.append(p)
 if start not in dist:return None
 result=[start]
 while result[-1]!=target:
  x,y=result[-1];p=next(((x+dx*pitch,y+dy*pitch) for dx,dy in order if dist.get((x+dx*pitch,y+dy*pitch))==dist[x,y]-1),None)
  if p is None:return None
  result.append(p)
 return result

class ConfiguredArrivals:
 def __init__(self):
  self.epoch=None;self.grid=None;self.launch=None;self.races=0;self.orders=list(permutations(((1,0),(-1,0),(0,1),(0,-1))));self.toggle_pairs=[];self.delays={};self.refs=[];self.events=[];self.tried=set();self.goal_method=False;self.fit=[]
 def current(self,rows):return scene(rows,self.grid)
 def bindings(self,s):
  out=[]
  for point in s['candidates']:
   current=s['cells'][point]['patch'];alternatives={b for a,b in self.toggle_pairs if a==current}
   if len(alternatives)==1:out.append((point,current,next(iter(alternatives))))
  return out
 def nodes(self,s,bindings,bits):
  nodes=set(s['base']);p=s['grid'][0]
  for (point,first,second),bit in zip(bindings,bits):
   a=second if bit else first
   if a[1][1] in s['background'] and a[1][1]!=s['floor']:
    # A background wall value is not admitted just because it is familiar.
    opened=sum(v==s['floor'] for row in a for v in row)>len(a)*len(a[0])//2
   else:opened=a[1][1]==s['floor'] or sum(v==s['floor'] for row in a for v in row)>4
   if opened:nodes.add(point)
   else:nodes.discard(point)
  return nodes
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  self.events=[]
  if self.epoch!=before['level_epoch']:self.epoch=before['level_epoch'];self.grid=None;self.races=0;self.delays={};self.tried=set()
  s=self.current(first)
  if not s:return {'status':'configured_trace_domain_absent','events':[]}
  self.grid=s['grid'];frames=frames or [second];owned=bool(proposal and proposal.get('support_plan',{}).get('configured_arrivals'))
  if command['action_ref']=='ACTION6' and owned:
   point=(command['data']['x'],command['data']['y']);a=patch(first,point);b=patch(second,point)
   if a!=b:
    self.toggle_pairs.extend(variants(a,b));self.toggle_pairs.extend(variants(b,a));self.refs.append(after['observation_ref']);self.events.append({'kind':'configured_local_rewrite','before':before['observation_ref'],'after':after['observation_ref'],'point':point,'independent_control':'provisional until other occurrences checked'})
   else:self.tried.add((before['level_epoch'],point,digest(a)))
  elif len(frames)>3:
   tracks={v:[] for v,x,y in s['actors']};poses=[crosses(f) for f in frames]
   for i,ps in enumerate(poses):
    for v,x,y in ps:
     if v in tracks:tracks[v].append((i,x,y))
   realized={};intervals=[];p=s['grid'][0]
   for v,x,y in s['actors']:
    path=[];times=[];last=None
    for i,a,b in tracks[v]:
     if last is not None and abs(a-last[0])+abs(b-last[1])>p*2:break
     last=(a,b)
     if a%p==s['grid'][1] and b%p==s['grid'][2] and (not path or path[-1]!=(a,b)):path.append((a,b));times.append(i)
    if len(path)<3:continue
    tail=[z for z in tracks[v] if z[0]>=times[-1] and abs(z[1]-path[-1][0])+abs(z[2]-path[-1][1])<=p]
    near=tail[0] if tail else None
    if s['target'] not in path and abs(path[-1][0]-s['target'][0])+abs(path[-1][1]-s['target'][1])==p:
     end=max((i for i,a,b in tail if (a,b)!=(x,y)),default=times[-1])+1;path.append(s['target']);times.append(end)
    if path[-1]!=s['target']:continue
    intervals.extend(b-a for a,b in zip(times,times[1:]));realized[v]=(path,times)
   if len(realized)==len(s['actors']):
    base=Counter(intervals).most_common(1)[0][0]
    if base>0:
     self.launch=command;self.races+=1;self.refs.append(after['observation_ref']);bindings=self.bindings(s);bound={p for p,a,b in bindings};nodes=self.nodes(s,bindings,[False]*len(bindings))|(set(s['candidates'])-bound);nodes.update(p for path,times in realized.values() for p in path);compatible=[]
     for order in self.orders:
      if all(route(nodes,(x,y),s['target'],order,p)==realized[v][0] for v,x,y in s['actors']):compatible.append(order)
     if compatible:self.orders=compatible
     for path,times in realized.values():
      for position,a,b in zip(path,times,times[1:]):
       if (b-a)%base==0:self.delays[position]=(b-a)//base-1
     supported={patch(first,p):d for p,d in self.delays.items() if d>0}
     for point in s['candidates']:
      if s['cells'][point]['patch'] in supported:self.delays[point]=supported[s['cells'][point]['patch']]
     self.fit.append({'epoch':before['level_epoch'],'compatible_orders':len(compatible),'base_samples_per_cell':base,'arrivals':{v:times[-1] for v,(path,times) in realized.items()},'evidence':after['observation_ref']})
     self.events.append({'kind':'public_configured_arrival_packet','before':before['observation_ref'],'after':after['observation_ref'],'tracks':len(realized),'compatible_route_orders':len(compatible),'samples_per_cell':base,'time_unit':'public stable-cell interval, not wall clock','target_status':'shared arrival candidate, simultaneity remains a goal hypothesis until score'})
  if after['levels_completed']>before['levels_completed']:
   self.goal_method=True;self.events.append({'kind':'configured_arrival_official_boundary','before':before['observation_ref'],'after':after['observation_ref']})
  return {'status':'configured_arrival_response','events':self.events}
 def scope(self,obs):
  return DMechanicalScope(request_ref='configured:'+obs['observation_ref'],caller_ref='common_configured_arrivals',parent_consumer_ref='SupportNavigation',parent_goal_ref='G_official_completion',parent_contribution_ref='conditional_first_arrival_conjunction',caller_next_item_ref='configured_route_question',epoch=obs['level_epoch'],evidence_revision_ref=obs['observation_ref'],model_revision_ref=self.refs[-1],model_status_ref='public_route_and_timing_hypotheses',event_owner_ref='atomic_public_packet',input_domain_complete=True,assumption_refs=('spatial_shortest_policy_fitted_to_public_routes','all_remaining_cardinal_orders_are_rivals','no_private_route_or_time_parameters'))
 def qualify_routes(self,s,nodes,paths,obs,edits,require_coincidence=True):
  refs={p:str(p) for p in nodes};p=s['grid'][0];edges=[]
  for x,y in sorted(nodes):
   for q in ((x+p,y),(x,y+p)):
    if q in nodes:edges.append(ResidualEdgeD(edge_ref=str(((x,y),q)),first_ref=refs[x,y],second_ref=refs[q]))
  scope=self.scope(obs);common=dict(scope=scope,requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=60000)
  route_receipts=[];actors=[]
  for (v,x,y),path in zip(s['actors'],paths):
   request=PolicyConstrainedRoutingRequestD(**common,operation_ref='mechanics.autonomous_route_intervention.policy_constrained_routing',mode_ref='DOMAIN',phase_ref='ROLE_TAGGED_INTERNAL_ROUTE',graph_role='PHYSICAL_PASSAGE',node_refs=tuple(refs.values()),edges=tuple(edges),blocked_node_refs=(),directed=False,origin_ref=refs[x,y],destination_ref=refs[s['target']],requested_property='REALIZED_ROUTE',policies=(InternalRoutePolicyD(policy_ref='observed_spatial_edge_count_ties_open',metric='EDGE_COUNT',neighbor_order=None,permit_blocked_nodes=False),))
   result=measure_policy_constrained_routing_d(request)
   if result.status!='COMPLETE':return None
   possible=result.values['policy_result_rows'][0]['policy_realized_routes'];wanted=tuple(refs[p] for p in path)
   if wanted not in possible:return None
   route_receipts.append({'actor':v,'admissible_paths':len(possible),'selected_path':wanted,'status':result.status})
   actors.append(FixedTransitActorD(actor_ref=str(v),route=wanted,departure_tick=0,transition_ticks=(1,)*(len(path)-1),exit_ref=refs[s['target']]))
  timed=measure_prescribed_transit_coincidence_d(PrescribedTransitCoincidenceRequestD(**common,operation_ref='mechanics.clock_event_model.prescribed_transit_coincidence',mode_ref='EVALUATE',phase_ref='PRESCRIBED_TIMED_ROUTES',actors=tuple(actors),gates=(),dwell_ticks=tuple((refs[p],d) for p,d in self.delays.items() if p in refs and d>0),timing_rule='CHECK_ARRIVAL_BEFORE_ENTRY',required_actor_refs=tuple(str(v) for v,x,y in s['actors']),stop_actor_at_first_arrival=True,commanded_edit_count=edits,elapsed_tick_limit=4096))
  if timed.status!='COMPLETE' or (require_coincidence and not timed.values['required_first_arrivals_coincide']):return None
  return {'route_domains':route_receipts,'dated_cohorts':plain(timed.values['first_arrival_cohorts']),'calculation':'V5 policy_constrained_routing_d + prescribed_transit_coincidence_d','policy_order_alternatives':len(self.orders)}
 def propose(self,obs,rows,inputs,remaining):
  if not json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text()).get('configured_arrivals',{}).get('enabled') or remaining<1:return None
  if self.epoch!=obs['level_epoch']:self.epoch=obs['level_epoch'];self.grid=None;self.races=0;self.delays={};self.tried=set()
  s=self.current(rows)
  if not s or not self.launch:return None
  self.grid=s['grid'];bindings=self.bindings(s);actions=[];expected=[];proof=None;reason=None
  current={p:c['patch'] for p,c in s['cells'].items()};snapshot=lambda:[{'point':list(p),'patch':plain(a)} for p,a in sorted(current.items()) if p in s['candidates']]
  if self.races==0:
   actions=[self.launch];expected=[snapshot()];reason='Revalidate the acquired atomic launch and route/timing method on current actors and current lattice; new supports and internal orders remain unknown.'
  else:
   bound={p for p,a,b in bindings};unknown=[p for p in s['candidates'] if p not in bound and self.delays.get(p,0)==0 and (obs['level_epoch'],p,digest(current[p])) not in self.tried]
   if unknown and not bindings:
    # The first candidate is a declared intervention question on the measured
    # path, not a gate role assigned from its colour.
    point=min(unknown,key=lambda p:(p[1],p[0]));actions=[{'action_ref':'ACTION6','data':dict(zip(('x','y'),point))}];expected=[snapshot()];reason='Probe a stationary exceptional cell in the measured traversed network; its editing and blocking roles are unknown.'
   else:
    offers=[];experiments=[]
    if not self.fit or self.fit[-1]['compatible_orders']==0:return None
    if len(bindings)>12:return None
    for bits in product((False,True),repeat=len(bindings)):
     cost=sum(bits)+1
     if cost>min(16,remaining):continue
     nodes=self.nodes(s,bindings,bits)|((set(self.delays)|set(s['candidates']))-bound);orders=[];valid=True;predictions=[]
     for order in self.orders:
      paths=[route(nodes,(x,y),s['target'],order,s['grid'][0]) for v,x,y in s['actors']]
      if any(path is None for path in paths):valid=False;break
      # A novel nonordinary support cannot silently inherit zero residence.
      if any(p in unknown for path in paths for p in path):valid=False;break
      times=[len(path)-1+sum(self.delays.get(p,0) for p in path[:-1]) for path in paths]
      orders.append(paths);predictions.append(tuple(times))
     if valid and orders:
      if all(len(set(times))==1 for times in predictions):offers.append((cost,bits,nodes,orders,predictions))
      elif len(set(predictions))>1 and any(bits):experiments.append((max(Counter(predictions).values()),cost,bits,nodes,orders,predictions))
    if offers:cost,bits,nodes,orders,predictions=min(offers,key=lambda x:(x[0],x[1]));discrimination=False
    elif experiments:unused,cost,bits,nodes,orders,predictions=min(experiments,key=lambda x:(x[0],x[1],x[2]));discrimination=True
    else:return None
    proof=self.qualify_routes(s,nodes,orders[0],obs,sum(bits),not discrimination)
    if proof is None:return None
    proof['conditional_predictions']=[{'order':plain(order),'arrival_intervals':list(times)} for order,times in zip(self.orders,predictions)];proof['question']='route_order_discrimination' if discrimination else 'coincident_first_arrivals'
    for (point,a,b),bit in zip(bindings,bits):
     if bit:
      expected.append(snapshot());actions.append({'action_ref':'ACTION6','data':dict(zip(('x','y'),point))});current[point]=b
    expected.append(snapshot());actions.append(self.launch);reason=('Test the least costly current configuration separating the remaining route-order hypotheses by different measured arrival predictions; no guaranteed score is claimed.' if discrimination else 'Configure the current shared network so every still-compatible spatial route policy predicts coincident first arrivals under observed residence times.')+' Launch atomically; current loss after visiting the common receiver motivates the coincidence hypothesis and official success alone qualifies it.'
  if not actions:return None
  steps=[]
  for i,action in enumerate(actions):
   step={'action':action,'expected_before':expected[i],'expected_after':expected[i+1] if i+1<len(actions) else None,'unknown_response':i+1==len(actions)}
   if action['action_ref']=='ACTION6':step['locus_witness']=ObservedInputDomain.make_locus_witness(obs,rows,(action['data']['x'],action['data']['y']),reason=reason,evidence=[obs['observation_ref']]+self.refs[-3:])
   steps.append(step)
  facts={'atomic_public_trajectory_observed':True,'current_actor_lattice_bound':True,'current_configuration_guarded':True};ref='C_arrival_'+digest([obs['observation_ref'],actions])[:16];evidence=[obs['observation_ref']]+self.refs[-4:]
  plan={'configured_arrivals':True,'grid':list(s['grid']),'actors':plain(s['actors']),'target':list(s['target']),'frame_hash':obs['frame_hash'],'prior_goal_method':self.goal_method,'fit':self.fit[-2:],'v5_proof':proof,'unknowns':['unvisited nonordinary timing','exclusive global control law','identity through unresolved overlap'],'launch':self.launch}
  return {'status':'proposed','kind':'configured_first_arrival_composition','support_plan':plan,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'role':'configured_arrival_question','observed':False,'open_question':reason,'properties':{'actors':len(s['actors'])},'relations':['contributes_to:G_official_completion']}],'question':{'reason':reason,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':reason,'preconditions':facts,'evidence':evidence,'actions':actions,'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,proposal,index,public,obs):
  p=proposal['support_plan'];ok=public.level==proposal['binding']['level_epoch'] and public.levels_completed==proposal['binding']['levels_completed'] and plain(crosses(public.frame_rows))==p['actors']
  ok=ok and all(plain(patch(public.frame_rows,tuple(v['point'])))==v['patch'] for v in proposal['steps'][index]['expected_before'])
  if index==0:ok=ok and public.frame_hash==p['frame_hash']
  return {'admitted':bool(ok),'reason':'current_network_edits_and_start_poses'}
 def after(self,proposal,index,before,after,first,second):
  if after['levels_completed']>before['levels_completed']:return {'matched':None,'seal_prefix':True,'reason':'official_score_boundary'}
  expected=proposal['steps'][index]['expected_after']
  if expected is None:return {'matched':None,'seal_prefix':True,'reason':'atomic_response_requires_reconciliation'}
  ok=plain(crosses(second))==proposal['support_plan']['actors'] and all(plain(patch(second,tuple(v['point'])))==v['patch'] for v in expected)
  return {'matched':bool(ok),'seal_prefix':not ok,'reason':'conditional_configuration_effect' if ok else 'configuration_effect_diverged'}
