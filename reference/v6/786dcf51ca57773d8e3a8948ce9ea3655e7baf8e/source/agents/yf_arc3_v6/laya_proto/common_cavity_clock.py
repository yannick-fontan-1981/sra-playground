"""Public rigid co-motion measurements and conditional K13 / slide composition."""
from collections import defaultdict,deque
from types import SimpleNamespace
from agents.yf_arc3_v5.capabilities.patrol_body import PatrolBody,PatrolCell,PatrolState,PatrolLaw,PatrolClockModel,PatrolTickRequest,advance_patrol_tick,patrol_mask
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_a import MechanicalFamilyScope
from agents.yf_arc3_v5.capabilities.wrap_slide import WrapCell,WrapMember,WrapState,WrapTopology,WrapModel,WrapCommand,_slide
from agents.yf_arc3_v5.capabilities.open_cavity import rectangular_open_complements,measure_connecting_surface
from agents.yf_arc3_v5.logos.types import FrozenMap
from common_multiscale_constraints import digest
from src_bridge import plain

def signature(c):return (c.value,c.bbox.height,c.bbox.width,tuple(sorted((r-c.bbox.top,x-c.bbox.left) for r,x in c.pixels)))

class CavityClock:
 def __init__(self):self.measurements=[];self.current=None
 def reset(self):self.measurements=[];self.current=None
 def record(self,owner,before,after,command,first,second,frames,extract):
  if owner.body_type is None:return
  prior={};later={}
  for target,rows in ((prior,first),(later,second)):
   for c in extract(rows).components:target.setdefault(signature(c),[]).append(c)
  groups=defaultdict(list)
  for sig,items in prior.items():
   if len(items)!=1 or len(later.get(sig,[]))!=1:continue
   a,b=items[0],later[sig][0];delta=(b.bbox.left-a.bbox.left,b.bbox.top-a.bbox.top)
   if delta==(0,0) or (b.value,b.bbox.height,b.bbox.width)==owner.body_type:continue
   groups[delta].append((a,b))
  groups=[(d,p) for d,p in groups.items() if len(p)>1]
  if len(groups)!=1:return
  delta,pairs=groups[0];left=min(b.bbox.left for a,b in pairs);top=min(b.bbox.top for a,b in pairs)
  pattern=tuple(sorted((r-top,c-left,b.value) for a,b in pairs for r,c in b.pixels))
  height=max(r for r,c,v in pattern)+1;width=max(c for r,c,v in pattern)+1
  if len(pattern)!=height*width:return
  def locate(rows):
   parts=extract(rows).components;found=[]
   for a,b in pairs:
    matches=[c for c in parts if signature(c)==signature(b)]
    if len(matches)!=1:return None
    found.append(matches[0])
   x=min(c.bbox.left for c in found);y=min(c.bbox.top for c in found)
   actual=tuple(sorted((r-y,z-x,c.value) for c in found for r,z in c.pixels))
   return (x,y) if actual==pattern else None
  sequence=[first]+list(frames or [second]);poses=[locate(r) for r in sequence]
  if any(p is None for p in poses):return
  changes=[i for i in range(1,len(poses)) if poses[i]!=poses[i-1]]
  bodyposes=[]
  for rows in sequence:
   b=owner.body(extract(rows));bodyposes.append((b.bbox.left,b.bbox.top) if b else None)
  bodychanges=[i for i in range(1,len(bodyposes)) if bodyposes[i] is not None and bodyposes[i-1] is not None and bodyposes[i]!=bodyposes[i-1]]
  if len(changes)!=1 or not bodychanges or changes[0]>=min(bodychanges):return
  current={'pattern':pattern,'position':(left,top),'delta':delta,'size':(width,height),'action':command['action_ref'],'evidence':after['observation_ref'],'before_actor':True}
  self.measurements.append(current);self.current=current
 def masks(self):
  if not self.current:return set()
  x,y=self.current['position'];return {(x+c,y+r) for r,c,v in self.current['pattern']}
 def propose(self,owner,obs,rows,remaining,extract):
  if len(self.measurements)<2 or self.current is None:return None
  a,b=self.measurements[-2:]
  if a['pattern']!=b['pattern'] or a['delta']!=b['delta'] or a['action']==b['action']:return None
  x,y=b['position']
  if any(rows[y+r][x+c]!=v for r,c,v in b['pattern']):return None
  value=owner.input(obs,rows);body=owner.body(value.components)
  if body is None:return None
  h,w=owner.body_type[1:];cores=[z for z in rectangular_open_complements(value.components.components) if z[1].height==h and z[1].width==w]
  if len(cores)!=1:return None
  core=cores[0][1];incidence=measure_connecting_surface(value.components.components,body.bbox,core)
  regions=[c for c in value.components.components if c.component_id==incidence.get('open_cavity_connecting_surface_ref')]
  if len(regions)!=1 or regions[0].value!=owner.floor:return None
  bounds=regions[0].bbox;nr,nc=bounds.height//h,bounds.width//w
  if any((v%p) for v,p in ((bounds.height,h),(bounds.width,w),(x-bounds.left,w),(y-bounds.top,h),(b['delta'][0],w),(b['delta'][1],h))):return None
  mask=tuple(sorted({(c//w,r//h) for r,c,v in b['pattern']}));px,py=(x-bounds.left)//w,(y-bounds.top)//h
  current=(body.bbox.left-bounds.left)//w,(body.bbox.top-bounds.top)//h;goal=(core.left-bounds.left)//w,(core.top-bounds.top)//h
  evidence=b['evidence'];static=[list(r) for r in rows]
  # Exposed terrain is a conditional continuation of the measured supporting surface.
  # Its pixels are predicted, and compared after every actual primitive.
  for xx,yy in self.masks():static[yy][xx]=owner.floor
  for rr,cc in body.pixels:static[rr][cc]=owner.floor
  cells=tuple(WrapCell(x=xx,y=yy,terrain='SUPPORT' if all(static[rr][cc]==owner.floor for rr in range(bounds.top+yy*h,bounds.top+(yy+1)*h) for cc in range(bounds.left+xx*w,bounds.left+(xx+1)*w)) else 'BLOCKED',evidence_ref=evidence) for yy in range(nr) for xx in range(nc))
  patrol=PatrolBody(patrol_ref='observed_composite',x=px,y=py,offsets=mask,dx=b['delta'][0]//w,dy=b['delta'][1]//h,phase=0,mask_evidence_ref=evidence)
  pcells=tuple(PatrolCell(x=c.x,y=c.y,support='SUPPORTED' if c.terrain=='SUPPORT' else 'BLOCKED',evidence_ref='current_support_and_conditional_revealed_underlay') for c in cells)
  ps=PatrolState(patrols=(patrol,),cells=pcells,targets=(),clock_tick=0)
  law=PatrolLaw(patrol_ref=patrol.patrol_ref,cadence=1,phase_modulus=1,blocked_response='UNKNOWN',other_patrols_block=False,pre_motion_capture=False,post_motion_capture=False,law_evidence_ref=evidence)
  clock=PatrolClockModel(model_ref='local_pre_input_translation_hypothesis',input_advancement=tuple((k,True) for k in owner.directions),laws=(law,),clock_evidence_ref=evidence,time_base='INPUT_INDEX')
  topology=WrapTopology(topology_ref='measured_current_view',minimum_x=0,maximum_x=nc-1,minimum_y=0,maximum_y=nr-1,horizontal='WRAP',vertical='WRAP',revisit_stop='BEFORE_REENTER_POSE',evidence_ref=evidence)
  model=WrapModel(model_ref='conditional_stop_and_pre_input_mask',topology=topology,order_kind='ORDERED',motion='SLIDE',boundary_body_rule='WRAP_ANCHOR',patrol_clock_phase='NONE')
  scope=MechanicalFamilyScope(request_ref='cavity_clock',caller_ref='common_cavity_clock',parent_goal_ref='G_official_completion',parent_contribution_ref='current_cavity_access',epoch=obs['level_epoch'],evidence_revision_ref=obs['observation_ref'],model_revision_ref=evidence,model_status_ref='conditional_local_two_inputs',event_owner_ref='one_external_command',input_domain_complete=False,assumption_refs=('unseen_input_classes_tick','revealed_floor_continues','no_bounce_prediction'))
  forecasts=[]
  for alternative in ('REVERSE_ONLY','REVERSE_AND_ATTEMPT'):
   branch=[];state=ps;candidate=clock.model_copy(update={'laws':(law.model_copy(update={'blocked_response':alternative}),)})
   for t in range(min(remaining,16)):
    receipt=advance_patrol_tick(PatrolTickRequest(scope=scope,operation_ref='mechanics.patrol_body.pre_input_tick',mode='STEP_INTERNAL',maximum_evaluations=65536,state=state,model=candidate,input_ref=next(iter(owner.directions)),event_ref=alternative+':'+str(t),event_clock_tick=t,clock_ref='external_input',temporal_scope_ref=obs['observation_ref']))
    if not receipt.values.get('clock_event_completed'):break
    state=PatrolState.model_validate(plain(receipt.values['after_state']));branch.append(state)
   forecasts.append(branch)
  queue=deque([(current,[])]);seen={(current,0)};solution=None
  while queue and len(seen)<=owner.policy['state_bound']:
   pos,path=queue.popleft();t=len(path)
   if pos==goal and path:solution=path;break
   if any(t>=len(branch) for branch in forecasts):continue
   hazard={cell for branch in forecasts for cell in patrol_mask(branch[t].patrols[0])}
   if pos in hazard:continue
   scoped=tuple(c.model_copy(update={'terrain':'UNKNOWN'}) if (c.x,c.y) in hazard else c for c in cells)
   state=WrapState(members=(WrapMember(member_ref='body',type_ref='body',x=pos[0],y=pos[1],offsets=((0,0),),alive=True),),member_order=('body',),required_member_refs=('body',),cells=scoped,seats=(),remaining_budget=remaining,input_tick=t,level_scope_ref=str(obs['level_epoch']),restore_epoch=0,status='ACTIVE')
   for action in owner.policy['action_order']:
    if action not in owner.directions:continue
    dr,dc=owner.directions[action];command=WrapCommand(input_ref=action,action_ref=action,payload=FrozenMap(),dx=dc,dy=dr,cost=1)
    after,events,debt,work,cut=_slide(state,model,SimpleNamespace(command_scope_ref='clock_path:'+str(t),maximum_depth=nr*nc+1),command,65536,allow_hypothetical=True)
    if debt or cut:continue
    end=(after.members[0].x,after.members[0].y);key=(end,t+1)
    if key not in seen:seen.add(key);queue.append((end,path+[(action,pos,end,t)]))
  if not solution:return None
  expected=[];positions=[[body.bbox.left,body.bbox.top]];steps=[];regions=[]
  colors=sorted({v for r,c,v in b['pattern']})
  def board_digest(frame,box):
   l,top,r,bottom=box
   return digest([[(-1 if l<=xx<=r and top<=yy<=bottom and frame[yy][xx] in colors else frame[yy][xx]) for xx in range(bounds.left,bounds.right+1)] for yy in range(bounds.top,bounds.bottom+1)])
  initial_box=[x,y,x+b['size'][0]-1,y+b['size'][1]-1]
  expected.append([board_digest(rows,initial_box)]*len(forecasts));regions.append([initial_box]*len(forecasts))
  for action,start,end,t in solution:
   point=[bounds.left+end[0]*w,bounds.top+end[1]*h]
   variants=[];boxes=[]
   for branch in forecasts:
    frame=[list(r) for r in static];p=branch[t].patrols[0];ox,oy=bounds.left+p.x*w,bounds.top+p.y*h
    for rr,cc,v in b['pattern']:frame[oy+rr][ox+cc]=v
    for rr in range(point[1],point[1]+h):
     for cc in range(point[0],point[0]+w):frame[rr][cc]=owner.body_type[0]
    box=[ox,oy,ox+b['size'][0]-1,oy+b['size'][1]-1];variants.append(board_digest(frame,box));boxes.append(box)
   expected.append(variants);regions.append(boxes);steps.append({'action':{'action_ref':action},'expected_before':{'board_digest_alternatives':expected[-2]},'expected_after':{'board_digest_alternatives':expected[-1]}});positions.append(point)
  plan={'sliding_cavity':True,'clock_composition':True,'body_type':list(owner.body_type),'positions':positions,'bounds':[bounds.left,bounds.top,bounds.right,bounds.bottom],'board_digests':expected,'mask_regions':regions,'mask_colors':colors,'mask_color_counts':{str(v):sum(z==v for r,c,z in b['pattern']) for v in colors},'before_frame':obs['frame_hash'],'clock_evidence':[a['evidence'],b['evidence']],'conditional_assumptions':['both V5 bounce alternatives retained','opaque interior orientation unknown','revealed supporting surface provisional']}
  ref='C_clock_cavity_'+digest([obs['observation_ref'],steps])[:16];actions=[s['action'] for s in steps];facts={'current_composite_mask_bound':True,'two_distinct_inputs_precede_body_motion':True,'future_clock_is_conditional':True,'no_contact_with_forecast_mask':True};why='Compose retained cavity access with the observed pre-input composite motion; compare every complete board and cancel at the first divergence. Contact, bounce and underlay remain conditional.'
  evidence=[obs['observation_ref'],a['evidence'],b['evidence']]
  return {'status':'proposed','kind':'clocked_cavity_access','support_plan':plan,'steps':steps,'actions':actions,'facts':facts,'compositions':[{'id':ref,'role':'information_question','observed':False,'open_question':why,'properties':{'terminal_relevance':'retained morphological hypothesis'},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':actions,'frozen_support_plan':plan,'outcome_guard':{'path':['value'],'contains':ref}}}
