"""Public metric tiling, conditional target raster and top-occurrence transport."""
import json
from pathlib import Path
from collections import Counter,defaultdict,deque
from fractions import Fraction
from heapq import heappop,heappush
from itertools import count
from agents.yf_arc3_v5.capabilities import ComponentExtractionInput,FrameGrid,detect_components
from agents.yf_arc3_v5.capabilities.metric_stack_contracts import MetricCell,MetricStackState,StackOccurrence,StackLaw,StackPrimitive,MetricTarget,MetricStackRequest,ControlSample,StackDemand,OccurrencePlacement
from agents.yf_arc3_v5.capabilities.metric_stack_image import enumerate_metric_target_domain,_stack_transition,fit_metric_stack_control,assign_metric_occurrences,derive_metric_exposure_dependencies
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import MechanicalRequestIdentity
from agents.yf_arc3_v5.logos.types import FrozenMap
from common_control_dependencies import ControlDependencies
from common_multiscale_constraints import digest
from observed_input_domain import ObservedInputDomain
from src_bridge import plain

EMPTY='unoccupied_metric_support'

def identity(obs,operation):
 return MechanicalRequestIdentity(request_ref='metric:'+obs['observation_ref']+':'+operation,kernel_ref='mechanics.metric_stack_image',operation_ref='mechanics.metric_stack_image.'+operation,mode='EVALUATE',caller_ref='common_metric_composition',parent_contribution_ref='G_official_completion',epoch=obs['level_epoch'],input_revision_ref=obs['observation_ref'],model_assignments=FrozenMap({'scope':'conditional_current_visible_metric_model'}),immutable_inputs=FrozenMap({'observation_ref':obs['observation_ref']}),actual_bounds=FrozenMap({'nodes':4096,'outputs':128,'time_ms':60000}),expected_return_type='MetricStackCalculation')

def measured_scene(rows):
 components=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,rows))),connectivity=4)).components
 rects=[c for c in components if min(c.bbox.width,c.bbox.height)>1 and c.area==c.bbox.width*c.bbox.height]
 boxes=[(c.bbox.left,c.bbox.top,c.bbox.right+1,c.bbox.bottom+1) for c in rects];adj=defaultdict(set)
 for i,a in enumerate(boxes):
  for j,b in enumerate(boxes[:i]):
   if ((a[2]==b[0] or b[2]==a[0]) and max(a[1],b[1])<min(a[3],b[3])) or ((a[3]==b[1] or b[3]==a[1]) and max(a[0],b[0])<min(a[2],b[2])):adj[i].add(j);adj[j].add(i)
 groups=[];remaining=set(range(len(rects)))
 while remaining:
  todo=[remaining.pop()];group=[]
  while todo:
   i=todo.pop();group.append(i)
   for j in adj[i]&remaining:remaining.remove(j);todo.append(j)
  groups.append(group)
 if not groups:return None
 group=max(groups,key=len)
 if len(group)<9:return None
 xs=sorted({v for i in group for v in (boxes[i][0],boxes[i][2])});ys=sorted({v for i in group for v in (boxes[i][1],boxes[i][3])})
 if (len(xs)-1)*(len(ys)-1)>64 or min(len(xs),len(ys))<3:return None
 if len(group)<(len(xs)-1)*(len(ys)-1)//2:return None
 background=[v for v,n in Counter(rects[i].value for i in group).most_common(2)]
 if len(background)!=2:return None
 fills=[];selected=[];cells=[]
 for y,(top,bottom) in enumerate(zip(ys,ys[1:])):
  for x,(left,right) in enumerate(zip(xs,xs[1:])):
   cells.append([left,top,right,bottom]);inside=[rows[r][c] for r in range(top+1,bottom-1) for c in range(left+1,right-1)] or [rows[r][c] for r in range(top,bottom) for c in range(left,right)]
   color=Counter(inside).most_common(1)[0][0];fills.append(EMPTY if color in background else str(color))
   border=[rows[r][c] for r in range(top,bottom) for c in range(left,right) if r in (top,bottom-1) or c in (left,right-1)]
   if color not in background and len(set(border))==1 and border[0]!=color:selected.append(len(cells)-1)
 if len(selected)>1:return None
 colors={v for v in fills if v!=EMPTY}
 if len(colors)<2:return None
 outside=[c for c in rects if not(xs[0]<=c.bbox.left and c.bbox.right<xs[-1] and ys[0]<=c.bbox.top and c.bbox.bottom<ys[-1]) and str(c.value) in colors]
 if len({str(c.value) for c in outside})<2:return None
 collection_edges=defaultdict(set)
 for i,a in enumerate(outside):
  for j,b in enumerate(outside[:i]):
   gapx=max(a.bbox.left-b.bbox.right-1,b.bbox.left-a.bbox.right-1,0);gapy=max(a.bbox.top-b.bbox.bottom-1,b.bbox.top-a.bbox.bottom-1,0)
   if max(gapx,gapy)<=max(min(a.bbox.width,a.bbox.height),min(b.bbox.width,b.bbox.height)):collection_edges[i].add(j);collection_edges[j].add(i)
 collections=[];unseen=set(range(len(outside)))
 while unseen:
  todo=[unseen.pop()];members=[]
  while todo:
   i=todo.pop();members.append(i)
   for j in collection_edges[i]&unseen:unseen.remove(j);todo.append(j)
  collections.append(members)
 best=[members for members in collections if len({outside[i].value for i in members})>=2]
 if len(best)!=1:return None
 outside=[outside[i] for i in best[0]]
 l=min(c.bbox.left for c in outside);t=min(c.bbox.top for c in outside);r=max(c.bbox.right for c in outside)+1;b=max(c.bbox.bottom for c in outside)+1
 if max(r-l,b-t)>32:return None
 target=[[str(rows[y][x]) if str(rows[y][x]) in colors else EMPTY for x in range(l,r)] for y in range(t,b)]
 legend=[(c.value,c.bbox.width,c.bbox.height) for c in outside]
 return {'cells':cells,'xs':xs,'ys':ys,'fills':fills,'selected':selected[0] if selected else None,'background':background,'target':target,'legend':legend,'grid_ref':digest([xs,ys]),'target_ref':digest(target)}

def metric_state(scene,obs,stacks=None):
 cells=tuple(MetricCell(cell_ref=str(i),left=b[0],top=b[1],right=b[2],bottom=b[3]) for i,b in enumerate(scene['cells']))
 if stacks is None:stacks=tuple(() if c==EMPTY else (StackOccurrence(occurrence_ref='visible:'+str(i),color_ref=c),) for i,c in enumerate(scene['fills']))
 selected=stacks[scene['selected']][-1].occurrence_ref if scene['selected'] is not None and stacks[scene['selected']] else None
 return MetricStackState(state_revision_ref=obs['observation_ref'],grid_revision_ref=scene['grid_ref'],cells=cells,stacks=stacks,physical_selection_ref=selected)

def target_candidates(scene,obs,state):
 xs,ys=scene['xs'],scene['ys'];width=len(scene['target'][0]);height=len(scene['target']);xratios=set();yratios=set()
 for color,w,h in scene['legend']:
  xratios.update(Fraction(b-a,w) for a,b in zip(xs,xs[1:]));yratios.update(Fraction(b-a,h) for a,b in zip(ys,ys[1:]))
 ratios=sorted(xratios&yratios);found=[]
 for scale in ratios:
  if scale<=0:continue
  ax=[x for x in xs[:-1] if x+width*scale in xs];ay=[y for y in ys[:-1] if y+height*scale in ys]
  for x in ax:
   for y in ay:
    target=MetricTarget(target_revision_ref=scene['target_ref'],rows=tuple(map(tuple,scene['target'])),licensed_scales=((scale.numerator,scale.denominator),),licensed_anchors=((x,y),),outside_color_ref=EMPTY)
    req=MetricStackRequest(identity=identity(obs,'target_domain'),evidence_revision_ref=obs['observation_ref'],evidence_refs=(obs['observation_ref'],),state=state,target=target)
    result=enumerate_metric_target_domain(req)
    if result.pending_count or result.facts.get('bound_reached'):continue
    found.extend(plain(v) for v in result.values['candidates'])
 return found

def state_key(s):return tuple(tuple((o.occurrence_ref,o.color_ref) for o in st) for st in s.stacks),s.physical_selection_ref
def visible(s):return tuple(st[-1].color_ref if st else EMPTY for st in s.stacks)

def compose_visible_obligations(state,target,scene,obs,law,edges,directions,remaining):
 """Reapply V5 injective assignment/exposure before solving each accessible need."""
 demands=tuple(StackDemand(cell_ref=i,color_ref=c) for i,c in target['requirements'] if c!=EMPTY)
 req=MetricStackRequest(identity=identity(obs,'occurrence_assignment'),evidence_revision_ref=obs['observation_ref'],evidence_refs=(obs['observation_ref'],),state=state,demands=demands)
 assigned=assign_metric_occurrences(req);surplus=set(assigned.values.get('surplus_occurrence_refs',()))
 if not surplus or assigned.pending_count or assigned.facts.get('bound_reached'):return []
 demanded={d.cell_ref for d in demands};locations={o.occurrence_ref:str(i) for i,st in enumerate(state.stacks) for o in st}
 if any(locations[o] not in demanded for o in surplus):return []
 offers=[]
 for assignment in assigned.values['candidates']:
  placements=tuple(OccurrencePlacement(occurrence_ref=v['occurrence_ref'],target_cell_ref=v['target_cell_ref']) for v in assignment)
  deps=derive_metric_exposure_dependencies(req.model_copy(update={'identity':identity(obs,'exposure_dependencies'),'placements':placements,'needed_occurrence_refs':tuple(v.occurrence_ref for v in placements)}))
  if deps.pending_count or deps.facts.get('bound_reached') or deps.values['cycle_node_refs']:continue
  goals={v.occurrence_ref:int(v.target_cell_ref) for v in placements};current=state;path=[];pieces=len(goals);failed=False
  for unused in range(pieces):
   positions={o.occurrence_ref:i for i,st in enumerate(current.stacks) for o in st};todo=[o for o,destination in goals.items() if positions[o]!=destination or current.stacks[destination][-1].occurrence_ref!=o]
   if not todo:break
   routes=[]
   for occurrence in todo:
    origin=positions[occurrence];destination=goals[occurrence]
    if current.stacks[origin][-1].occurrence_ref!=occurrence:continue
    blockers={positions[o] for o in goals if o!=occurrence}
    if destination in blockers:continue
    queue=deque([(origin,[])]);seen={origin}
    while queue:
     cell,route=queue.popleft()
     if cell==destination:routes.append((len(route)+(current.physical_selection_ref!=occurrence),occurrence,origin,route));break
     for command in directions:
      following=edges.get((cell,command))
      if following is not None and following not in seen and following not in blockers:seen.add(following);queue.append((following,route+[(command,following)]))
   if not routes:failed=True;break
   unused,occurrence,origin,route=min(routes,key=lambda v:(v[0],v[1]))
   if current.physical_selection_ref!=occurrence:
    primitive=StackPrimitive(primitive_ref='select:'+str(origin),kind='SELECT',cell_ref=str(origin),occurrence_ref=occurrence);following,effects,cost,refusal=_stack_transition(current,law,primitive)
    if refusal:failed=True;break
    b=scene['cells'][origin];action={'action_ref':'ACTION6','data':{'x':(b[0]+b[2]-1)//2,'y':(b[1]+b[3]-1)//2}};path.append((action,primitive,current,following));current=following
   for command,destination in route:
    primitive=StackPrimitive(primitive_ref=command+':'+str(destination),kind='TRANSFER',occurrence_ref=occurrence,destination_ref=str(destination));following,effects,cost,refusal=_stack_transition(current,law,primitive)
    if refusal:failed=True;break
    path.append(({'action_ref':command},primitive,current,following));current=following
   if failed:break
  if failed or len(path)>remaining or not all(visible(current)[int(i)]==c for i,c in target['requirements']):continue
  proof={'method':'visible_top_assignment_with_retained_underlayers','assignment':plain(assignment),'surplus_preserved':sorted(surplus),'dependencies':plain(deps.values),'inventory_complete':False,'reason':'Unrequired visible occurrences already occupy future target cells. Cover them with the assigned visible suppliers; no need to remove them. Each subroute preserves all other required occurrences.'}
  offers.append((len(path),target,path,assigned.examined_count+deps.examined_count,proof))
 return offers

class MetricComposition:
 def __init__(self):
  self.policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['metric_composition'];self.epoch=None;self.current=None;self.grid=None;self.evidence=[];self.questions=ControlDependencies();self.control_samples=[];self.control_facts=None;self.events=[];self.scored_targets=[];self.directions={};self.attempted=set()
 def state(self):
  return plain({'format':'metric_composition_state.v1','epoch':self.epoch,'current':self.current.model_dump(mode='json') if self.current is not None else None,'grid':self.grid,'evidence':self.evidence,'questions':{'pending':self.questions.pending,'attempted':sorted(self.questions.attempted)},'control_samples':[s.model_dump(mode='json') for s in self.control_samples],'control_facts':self.control_facts,'events':self.events,'scored_targets':self.scored_targets,'directions':self.directions,'attempted':sorted(self.attempted)})
 def restore(self,state):
  required={'format','epoch','current','grid','evidence','questions','control_samples','control_facts','events','scored_targets','directions','attempted'}
  if state.get('format')!='metric_composition_state.v1' or set(state)!=required or set(state['questions'])!={'pending','attempted'}:raise ValueError('Incomplete metric composition state contract')
  value=json.loads(json.dumps(state));self.current=MetricStackState.model_validate(value['current']) if value['current'] is not None else None
  for key in ('epoch','grid','evidence','control_facts','events','scored_targets','directions'):setattr(self,key,value[key])
  self.control_samples=[ControlSample.model_validate(s) for s in value['control_samples']];self.attempted=set(value['attempted']);self.questions=ControlDependencies();self.questions.pending=value['questions']['pending'];self.questions.attempted=set(value['questions']['attempted'])
 def reconcile(self,obs,rows):
  scene=measured_scene(rows)
  if not scene:return None
  if self.epoch!=obs['level_epoch'] or self.grid!=scene['grid_ref']:
   self.current=metric_state(scene,obs);self.epoch=obs['level_epoch'];self.grid=scene['grid_ref']
  else:
   stacks=[]
   for i,color in enumerate(scene['fills']):
    old=self.current.stacks[i]
    if color==EMPTY:stacks.append(())
    elif old and old[-1].color_ref==color:stacks.append(old)
    else:stacks.append((StackOccurrence(occurrence_ref='observed:'+obs['observation_ref']+':'+str(i),color_ref=color),))
   self.current=metric_state(scene,obs,tuple(stacks))
  return scene
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  self.events=[]
  if proposal and proposal.get('support_plan',{}).get('metric_composition'):
   p=proposal['support_plan'];step=p['transitions'][index]
   if after['levels_completed']>before['levels_completed']:
    self.scored_targets.append(p['target_ref']);self.current=None;self.grid=None;self.epoch=after['level_epoch'];return {'status':'metric_official_boundary','events':[{'kind':'metric_target_official_score','before':before['observation_ref'],'after':after['observation_ref']}]}
   prior=MetricStackState.model_validate(step['before']);predicted=MetricStackState.model_validate(step['after']);self.current=predicted;self.epoch=after['level_epoch'];self.grid=predicted.grid_revision_ref
   scene=self.reconcile(after,second)
   if scene:
    self.attempted.add(p['question_key']);self.evidence.append(after['observation_ref'])
    matched=tuple(scene['fills'])==visible(predicted)
    self.events=[{'kind':'metric_control_response','before':before['observation_ref'],'after':after['observation_ref'],'expected_visible_matched':matched,'primitive':step['primitive'],'unknown_underlay_revealed':not matched}]
    if matched and step['primitive']['kind']=='TRANSFER':
     origin=next(i for i,st in enumerate(prior.stacks) if st and st[-1].occurrence_ref==step['primitive']['occurrence_ref']);destination=int(step['primitive']['destination_ref']);a,b=prior.cells[origin],prior.cells[destination];vector=(b.left-a.left,b.top-a.top);self.directions[command['action_ref']]=[0 if vector[0]==0 else 1 if vector[0]>0 else -1,0 if vector[1]==0 else 1 if vector[1]>0 else -1]
     self.control_samples.append(ControlSample(evidence_ref=after['observation_ref'],evidence_revision_ref=after['observation_ref'],occurrence_ref=step['primitive']['occurrence_ref'],input_kind='TRANSFER',physical_selection_before_ref=prior.physical_selection_ref,physical_selection_after_ref=self.current.physical_selection_ref,position_before=(a.left,a.top),position_after=(b.left,b.top),was_accessible_top=True,selection_accepted=True,dimensions_before=(a.right-a.left,a.bottom-a.top),dimensions_after=(b.right-b.left,b.bottom-b.top),support_before=(a.right-a.left,a.bottom-a.top),support_after=(b.right-b.left,b.bottom-b.top)))
     req=MetricStackRequest(identity=identity(after,'control_fit'),evidence_revision_ref=after['observation_ref'],control_samples=tuple(self.control_samples[-128:]))
     self.control_facts=plain(fit_metric_stack_control(req).values)
   return {'status':'metric_observed','events':self.events}
  return {'status':'metric_not_owned','events':[]}
 def propose(self,obs,rows,inputs,remaining):
  if not self.policy['enabled'] or 'ACTION6' not in obs['available_action_refs'] or remaining<=0:return None
  scene=self.reconcile(obs,rows)
  if not scene:return None
  state=self.current;targets=target_candidates(scene,obs,state)
  if not targets:return None
  cols=len(scene['xs'])-1;directions={k:tuple(v) for k,v in self.policy['conditional_action_vectors'].items() if k in obs['available_action_refs']};directions.update({k:tuple(v) for k,v in self.directions.items()})
  edges={};
  for i in range(len(state.cells)):
   x,y=i%cols,i//cols
   for command,(dx,dy) in directions.items():
    xx,yy=x+dx,y+dy
    if 0<=xx<cols and 0<=yy<len(scene['ys'])-1:edges[i,command]=yy*cols+xx
  law=StackLaw(law_revision_ref='conditional_metric_top_transfer',evidence_refs=tuple((self.evidence or [obs['observation_ref']])[-32:]),access='TOP_ONLY',dimension_rule='CELL_SUPPORT',transfer_edges=tuple((str(i),str(j)) for (i,c),j in edges.items()),select_cost=1,cycle_cost=1,transfer_cost=1,event_owner_ref='current_external_command',acceptance_checkpoint='AFTER_TRANSFER',empty_color_ref=EMPTY)
  inventory=Counter(o.color_ref for st in state.stacks for o in st);eligible=[]
  for target in targets:
   wanted=Counter(c for i,c in target['requirements'] if c!=EMPTY)
   if all(inventory[c]>=n for c,n in wanted.items()):eligible.append(target)
  if not eligible:return None
  def heuristic(s,requirements):
   value=0
   for i,c in requirements.items():
    if c==EMPTY or (s.stacks[i] and s.stacks[i][-1].color_ref==c):continue
    places=[j for j,st in enumerate(s.stacks) if any(o.color_ref==c for o in st)]
    if not places:return 9999
    value+=min(abs(i%cols-j%cols)+abs(i//cols-j//cols) for j in places)
   return value
  offers=[];composition_proofs={}
  for target in eligible:
   composed=compose_visible_obligations(state,target,scene,obs,law,edges,directions,remaining)
   if composed:
    for cost,goal,path,examined,proof in composed:offers.append((cost,goal,path,examined));composition_proofs[digest(goal)]=proof
    continue
   requirements={int(i):c for i,c in target['requirements']};serial=count();queue=[(heuristic(state,requirements),0,next(serial),state,[])];best={state_key(state):0};expanded=0
   while queue and expanded<self.policy['search_states']:
    estimate,cost,unused,current,path=heappop(queue);key=state_key(current)
    if best.get(key)!=cost:continue
    expanded+=1
    if all(visible(current)[i]==c for i,c in requirements.items()):offers.append((cost,target,path,expanded));break
    if cost>=remaining:continue
    for i,stack in enumerate(current.stacks):
     if not stack:continue
     occurrence=stack[-1].occurrence_ref
     for command in directions:
      if (i,command) not in edges:continue
      j=edges[i,command];working=current;prefix=[]
      if working.physical_selection_ref!=occurrence:
       primitive=StackPrimitive(primitive_ref='select:'+str(i),kind='SELECT',cell_ref=str(i),occurrence_ref=occurrence);following,eff,charge,refusal=_stack_transition(working,law,primitive)
       if refusal:continue
       b=scene['cells'][i];action={'action_ref':'ACTION6','data':{'x':(b[0]+b[2]-1)//2,'y':(b[1]+b[3]-1)//2}};prefix.append((action,primitive,working,following));working=following
      primitive=StackPrimitive(primitive_ref=command+':'+str(j),kind='TRANSFER',occurrence_ref=occurrence,destination_ref=str(j));following,eff,charge,refusal=_stack_transition(working,law,primitive)
      if refusal:continue
      prefix.append(({'action_ref':command},primitive,working,following));newcost=cost+len(prefix)
      if newcost>remaining:continue
      nextkey=state_key(following)
      if newcost>=best.get(nextkey,10**9):continue
      best[nextkey]=newcost;heappush(queue,(newcost+heuristic(following,requirements),newcost,next(serial),following,path+prefix))
  if not offers:return None
  cost,target,path,expanded=min(offers,key=lambda v:(v[0],v[1]['anchor']))
  if not path:return None
  prefix=[]
  for item in path[:min(16,remaining)]:
   prefix.append(item)
   if item[1].kind=='TRANSFER' and item[0]['action_ref'] not in self.directions:break
  why='Compose the measured irregular support rectangles into the small raster under one uniform scale. Reuse V5 metric target-domain and top-stack transition; selection must persist into its conditional transfer. Unknown command geometry or revealed underlay seals the prefix and revalidates the composition.'
  question=self.questions.question_key(obs['level_epoch'],'metric_target_access',{'grid':scene['grid_ref'],'target':scene['target_ref'],'state':state_key(state),'requirements':target['requirements']},prefix[0][0]);ref='C_metric_'+question[:16]
  if question in self.attempted:return None
  transitions=[{'primitive':p.model_dump(mode='json'),'before':a.model_dump(mode='json'),'after':b.model_dump(mode='json')} for command,p,a,b in prefix];actions=[command for command,p,a,b in prefix];steps=[]
  for command,p,a,b in prefix:
   step={'action':command,'expected_before':{'metric_visible':list(visible(a)),'selection':a.physical_selection_ref},'expected_after':{'metric_visible':list(visible(b)),'selection':b.physical_selection_ref}}
   if command.get('data'):step['locus_witness']=ObservedInputDomain.make_locus_witness(obs,rows,(command['data']['x'],command['data']['y']),reason=why,evidence=[obs['observation_ref']])
   steps.append(step)
  plan={'metric_composition':True,'frame_hash':obs['frame_hash'],'grid_ref':scene['grid_ref'],'target_ref':scene['target_ref'],'target':target,'question_key':question,'transitions':transitions,'conditional_law':law.model_dump(mode='json'),'control_facts':self.control_facts,'unknown_underlay':'empty_is_provisional_until_exposed','cut_reason':'first_unmeasured_control_geometry' if prefix[-1][0]['action_ref'] not in self.directions else 'bounded_conditional_target_route','search_expanded':expanded,'complete_model_cost':cost}
  plan['visible_obligations']=composition_proofs.get(digest(target))
  facts={'current_metric_partition_measured':True,'uniform_raster_target_domain_calculated':True,'conditional_top_transfer_model':True,'current_selection_or_address_bound':True};proof=[obs['observation_ref']]+self.evidence[-8:]
  return {'status':'proposed','kind':'metric_composition_access','support_plan':plan,'steps':steps,'actions':actions,'facts':facts,'compositions':[{'id':ref,'role':'information_question','observed':False,'open_question':why,'properties':{'target_status':'raster_hypothesis'},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':proof},'route_refs':proof,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':proof,'actions':actions,'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,i,public,o):
  plan=p['support_plan'];s=measured_scene(public.frame_rows);expected=MetricStackState.model_validate(plan['transitions'][i]['before']);selected=next((j for j,st in enumerate(expected.stacks) if st and st[-1].occurrence_ref==expected.physical_selection_ref),None)
  ok=public.level==p['binding']['level_epoch'] and public.levels_completed==p['binding']['levels_completed'] and s is not None and s['grid_ref']==plan['grid_ref'] and s['target_ref']==plan['target_ref'] and tuple(s['fills'])==visible(expected) and s['selected']==selected
  if i==0:ok=ok and public.frame_hash==plan['frame_hash']
  return {'admitted':ok,'reason':'metric_target_selection_and_visible_support_bound' if ok else 'metric_premise_changed'}
 def after(self,p,i,before,after,first,second):
  if after['levels_completed']>before['levels_completed']:return {'matched':True,'seal_prefix':True,'reason':'official_score'}
  plan=p['support_plan'];s=measured_scene(second);expected=MetricStackState.model_validate(plan['transitions'][i]['after']);selected=next((j for j,st in enumerate(expected.stacks) if st and st[-1].occurrence_ref==expected.physical_selection_ref),None)
  ok=s is not None and s['grid_ref']==plan['grid_ref'] and s['target_ref']==plan['target_ref'] and tuple(s['fills'])==visible(expected) and s['selected']==selected
  return {'matched':ok,'seal_prefix':not ok,'reason':'metric_predicted_visible_effect' if ok else 'metric_effect_or_underlay_requires_reconciliation'}
