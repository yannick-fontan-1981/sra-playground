"""Current invitations and conditional rigid-cargo compositions using V5 mechanics."""
import copy,json
from collections import Counter,deque
from pathlib import Path
from common_fixed_origin import parts
from common_multiscale_constraints import digest
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.oriented_cargo_handoffs import HandoffState,HandoffActor,HandoffCargo,HandoffTerrain,HandoffModel,HandoffInteractionRule,_move,_interaction as _interact

def initial(rows):
 cs=parts(rows);rings=[]
 for c in cs:
  b=c.bbox;p=b.width
  if p<3 or b.height!=p or c.area!=p*p-(p-2)**2:continue
  edge=[rows[y][x]for y in range(b.top,b.bottom+1)for x in range(b.left,b.right+1)if x in (b.left,b.right)or y in (b.top,b.bottom)]
  inside={rows[y][x]for y in range(b.top+1,b.bottom)for x in range(b.left+1,b.right)}
  if len(set(edge))==1 and len(inside)==1 and c.value not in inside:rings.append((p,c.value,next(iter(inside)),b.left,b.top))
 groups=Counter(r[:3]for r in rings);eligible=[k for k,n in groups.items()if n>=2]
 if len(eligible)!=1:return None
 p,shell,core=eligible[0];rs=[r for r in rings if r[:3]==eligible[0]];phase=(rs[0][3]%p,rs[0][4]%p)
 if any((x%p,y%p)!=phase for _,_,_,x,y in rs):return None
 boxes=[]
 for c in cs:
  b=c.bbox
  if c.value!=core or b.width%p or b.height%p or b.width*b.height<=p*p:continue
  if (b.left%p,b.top%p)!=phase:continue
  boundary=[rows[y][x]for y in range(b.top,b.bottom+1)for x in range(b.left,b.right+1)if x in (b.left,b.right)or y in (b.top,b.bottom)]
  if all(v==core for v in boundary):boxes.append(b)
 if len(boxes)!=1:return None
 b=boxes[0];targets={(x,y)for x in range((b.left-phase[0])//p,(b.right-phase[0]+1)//p)for y in range((b.top-phase[1])//p,(b.bottom-phase[1]+1)//p)}
 if len(targets)<len(rs):return None
 return {'pitch':p,'phase':phase,'core':core,'rest_shell':shell,'targets':targets,'initial_boxes':{((x-phase[0])//p,(y-phase[1])//p)for _,_,_,x,y in rs},'background':Counter(v for r in rows for v in r).most_common(1)[0][0]}

def tile(rows,h,p):
 q=h['pitch'];x=h['phase'][0]+p[0]*q;y=h['phase'][1]+p[1]*q
 if x<0 or y<0 or y+q>len(rows)or x+q>len(rows[0]):return None
 return tuple(tuple(rows[y+dy][x+dx]for dx in range(q))for dy in range(q))

def scene(rows,h,actor_color):
 q=h['pitch'];phase=tuple(h['phase']);cs=parts(rows);bodies=[c for c in cs if c.value==actor_color and c.area>=q and c.bbox.width<=q and c.bbox.height<=q]
 if len(bodies)!=1:return None
 b=bodies[0].bbox;pose=((b.left-phase[0])//q,(b.top-phase[1])//q);patch=tile(rows,h,pose)
 if patch is None:return None
 minor=[(x,y,v)for y,r in enumerate(patch)for x,v in enumerate(r)if v!=actor_color]
 if len(minor)!=q or len({v for x,y,v in minor})!=1:return None
 if not(any(all(x==edge for x,y,v in minor)for edge in (0,q-1))or any(all(y==edge for x,y,v in minor)for edge in (0,q-1))):return None
 axes=[(sum(x for x,y,v in minor)/len(minor)-(q-1)/2),(sum(y for x,y,v in minor)/len(minor)-(q-1)/2)]
 if (axes[0]==0)==(axes[1]==0):return None
 face=(0,1 if axes[1]>0 else -1)if axes[0]==0 else(1 if axes[0]>0 else -1,0)
 boxes={}
 for c in cs:
  b=c.bbox
  if c.value!=h['core']or b.width!=q-2 or b.height!=q-2 or c.area!=(q-2)**2:continue
  if ((b.left-1)%q,(b.top-1)%q)!=phase:continue
  pos=((b.left-1-phase[0])//q,(b.top-1-phase[1])//q);t=tile(rows,h,pos)
  edge={t[y][x]for y in range(q)for x in range(q)if x in (0,q-1)or y in (0,q-1)}
  if len(edge)!=1 or h['core']in edge:return None
  boxes[pos]=next(iter(edge))
 if len(boxes)!=len(h['initial_boxes']):return None
 return {'pose':pose,'face':face,'boxes':boxes,'actor_color':actor_color,'face_value':minor[0][2]}

def reduced(s,held):return {'pose':s['pose'],'face':s['face'],'boxes':sorted(s['boxes']),'held':held}
def equal(expected,s):return s is not None and tuple(expected['pose'])==s['pose']and tuple(expected['face'])==s['face']and set(map(tuple,expected['boxes']))==set(s['boxes'])

class OrientedCoupling:
 def __init__(self):
  self.h=None;self.actor_color=None;self.epoch=None;self.ready=False;self.s=None;self.held=None;self.coupled=False;self.invitation=None;self.known=set();self.refs=[];self.pending_release=False;self.blocked_face=False;self.tried=set()
  self.policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['oriented_coupling']
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  if self.epoch!=before['level_epoch']:
   self.__init__();self.epoch=before['level_epoch'];self.h=initial(first)
  if self.h is None:return {'status':'coupling_domain_absent','events':[]}
  if self.actor_color is None:
   candidates=[]
   for v in {c.value for c in parts(first)}-{self.h['core'],self.h['rest_shell'],self.h['background']}:
    a=scene(first,self.h,v);b=scene(second,self.h,v)
    if a and b and a['pose']!=b['pose']and a['boxes']==b['boxes']:candidates.append(v)
   if len(candidates)!=1:return {'status':'coupling_controller_unknown','events':[]}
   self.actor_color=candidates[0]
  a=scene(first,self.h,self.actor_color);b=scene(second,self.h,self.actor_color)
  if not a or not b:return {'status':'coupling_current_measurement_unknown','events':[]}
  if after['levels_completed']>before['levels_completed']:return {'status':'coupling_official_boundary','events':[{'kind':'official_completion','evidence':after['observation_ref']}]}
  action=command['action_ref'];delta=(b['pose'][0]-a['pose'][0],b['pose'][1]-a['pose'][1]);newpos=set(b['boxes'])-set(a['boxes']);oldpos=set(a['boxes'])-set(b['boxes']);events=[]
  if self.held is not None and delta!=(0,0):
   predicted=(self.held[0]+delta[0],self.held[1]+delta[1])
   if oldpos=={self.held}and newpos=={predicted}:
    self.held=predicted;self.coupled=True;self.known.add(('held',action));events.append({'kind':'public_rigid_pair_translation','delta':delta,'evidence':after['observation_ref']})
   else:self.held=None;self.coupled=False;events.append({'kind':'rigid_pair_prediction_refuted','evidence':after['observation_ref']})
  elif delta!=(0,0)and not newpos and not oldpos:
   self.known.add(('free',action));self.pending_release=False
  if delta==(0,0)and a['face']!=b['face']:self.blocked_face=True
  ahead=(b['pose'][0]+b['face'][0],b['pose'][1]+b['face'][1]);changed=[p for p in a['boxes']if p in b['boxes']and a['boxes'][p]!=b['boxes'][p]]
  if action==self.policy['interaction_candidate']and delta==(0,0)and len(changed)==1 and changed[0]==ahead:
   if self.held is None:self.held=ahead;events.append({'kind':'visible_relation_change_candidate','evidence':after['observation_ref'],'uncertainty':'coupling awaits co-translation'})
   else:self.held=None;self.pending_release=True;events.append({'kind':'release_candidate','evidence':after['observation_ref'],'uncertainty':'independent actor movement or official boundary must confirm'})
  if delta!=(0,0)and changed==[ahead]and self.held is None:self.invitation=ahead;self.ready=True;events.append({'kind':'front_contour_invitation','evidence':after['observation_ref'],'uncertainty':'available is not attached'})
  if self.held is not None or self.coupled:self.ready=True
  self.s=b;self.refs.append(after['observation_ref']);return {'status':'coupling_observed','events':events}
 def models(self,obs,rows,s):
  h=self.h;q=h['pitch'];floor=[]
  for y in range((len(rows)-h['phase'][1])//q):
   for x in range((len(rows[0])-h['phase'][0])//q):
    p=(x,y);t=tile(rows,h,p)
    if p in s['boxes']or p==s['pose']or p in h['targets']or all(v==h['background']for r in t for v in r):floor.append(p)
  cargos=tuple(HandoffCargo(cargo_ref='part:'+str(i),type_ref='part',x=p[0],y=p[1],offsets=((0,0),),holder_ref='controller'if p==self.held else None,delivery_acquired=False,mask_evidence_ref=obs['observation_ref'])for i,p in enumerate(sorted(s['boxes'])))
  held=next((c.cargo_ref for c in cargos if c.holder_ref),None)
  actor=HandoffActor(actor_ref='controller',type_ref='controller',x=s['pose'][0],y=s['pose'][1],offsets=((0,0),),face=s['face'],held_cargo_ref=held,locked_interaction_face=s['face']if held else None,alive=True)
  terrain=tuple(HandoffTerrain(x=x,y=y,actor_type_ref=role,traversable=True,evidence_ref=obs['observation_ref'])for x,y in floor for role in ('controller','part'))
  state=HandoffState(actors=(actor,),player_ref='controller',cargo=cargos,terrain=terrain,remaining_budget=512,input_tick=0,level_scope_ref=str(obs['level_epoch']),restore_epoch=0,status='ACTIVE')
  rules=tuple(HandoffInteractionRule(actor_type_ref='controller',target_type_ref='part',kind=k,front_required=True,delivered_cargo_regrasp_allowed=False,evidence_ref=self.refs[-1]if self.coupled else None)for k in ('ATTACH','RELEASE'))
  model=HandoffModel(model_ref='conditional_current_rigid_relation',free_facing='BEFORE_TRANSLATION',free_facing_evidence_ref=self.refs[-1]if self.blocked_face else None,free_move_evidence_ref=self.refs[0],coupling_evidence_ref=self.refs[-1]if self.coupled else None,interaction_rules=rules)
  return state,model
 def search(self,state,model,predicate):
  queue=deque([(state,[])]);seen=set();vectors=self.policy['direction_candidates']
  while queue:
   s,path=queue.popleft();a=s.actors[0];key=(a.x,a.y,a.face,tuple((c.x,c.y)for c in s.cargo))
   if key in seen:continue
   seen.add(key)
   if predicate(s):return path,s
   for action,d in vectors.items():
    t,events,missing,work,resume=_move(s,model,'controller',*d,100000,allow_hypothetical=True)
    if not missing and t!=s:queue.append((t,path+[(action,t)]))
  return None
 def route(self,state,model):
  actor=state.actors[0];choices=[]
  for cargo in state.cargo:
   pos=(cargo.x,cargo.y)
   if actor.held_cargo_ref and cargo.cargo_ref!=actor.held_cargo_ref:continue
   if not actor.held_cargo_ref and pos in self.h['targets']:continue
   for target in sorted(self.h['targets']-{(c.x,c.y)for c in state.cargo if c.cargo_ref!=cargo.cargo_ref}):
    faces=[actor.face]if actor.held_cargo_ref else list(map(tuple,self.policy['direction_candidates'].values()))
    for face in faces:
     prefix=[];start=state
     if actor.held_cargo_ref is None:
      grasp=(cargo.x-face[0],cargo.y-face[1]);found=self.search(state,model,lambda s:s.actors[0].face==face and(s.actors[0].x,s.actors[0].y)==grasp)
      if found is None:continue
      prefix,start=found;start,events,missing,_,_=_interact(start,model,'controller',cargo.cargo_ref,'ATTACH',100000,allow_hypothetical=True)
      if missing:continue
      prefix=prefix+[(self.policy['interaction_candidate'],start)]
     found=self.search(start,model,lambda s:any(c.cargo_ref==cargo.cargo_ref and(c.x,c.y)==target for c in s.cargo))
     if found is None:continue
     suffix,end=found;end,events,missing,_,_=_interact(end,model,'controller',cargo.cargo_ref,'RELEASE',100000,allow_hypothetical=True)
     if missing:continue
     path=prefix+suffix+[(self.policy['interaction_candidate'],end)];choices.append((len(path),cargo.cargo_ref,target,face,path))
  return min(choices,key=lambda x:x[:4])[-1]if choices else None
 def propose(self,obs,rows,inputs,remaining):
  if not self.ready or not self.h or obs['level_epoch']!=self.epoch:return None
  s=scene(rows,self.h,self.actor_color)
  if not s:return None
  state,model=self.models(obs,rows,s);ahead=(s['pose'][0]+s['face'][0],s['pose'][1]+s['face'][1])
  if not self.coupled and self.held is None:
   key=(s['pose'],s['face'],ahead,s['boxes'].get(ahead))
   if ahead!=self.invitation or key in self.tried:return None
   self.tried.add(key);path=[(self.policy['interaction_candidate'],None)];why='Test the current frontal contour invitation; availability is distinct from attachment'
  else:
   path=self.route(state,model)
   if not path:return None
   why='Deliver a current compatible part into the retained homologous region, then test release; preserve other parts and the rigid offset'
  actions=[];steps=[];cur=state
  for action,next_state in path[:min(16,remaining)]:
   if action not in obs['available_action_refs']:break
   a=cur.actors[0];oldheld=next(((c.x,c.y)for c in cur.cargo if c.holder_ref),None);before={'pose':(a.x,a.y),'face':a.face,'boxes':[(c.x,c.y)for c in cur.cargo],'held':oldheld}
   expected=None
   if next_state:
    b=next_state.actors[0];expected={'pose':(b.x,b.y),'face':b.face,'boxes':[(c.x,c.y)for c in next_state.cargo],'held':next(((c.x,c.y)for c in next_state.cargo if c.holder_ref),None)}
   unknown=action==self.policy['interaction_candidate']or(('held'if oldheld else'free',action)not in self.known)or self.pending_release or not self.blocked_face and expected and before['pose']==expected['pose']and before['face']!=expected['face']
   actions.append({'action_ref':action});steps.append({'expected_before':before,'expected_after':expected,'uncertain':bool(unknown)})
   if unknown:break
   cur=next_state
  if not actions:return None
  ref='C_coupling_'+digest([obs['observation_ref'],actions])[:16];evidence=[obs['observation_ref']]+self.refs[-4:];facts={'current_contour_relation_bound':True,'measured_lattice_and_masks':True,'conditional_v5_composition':True};plan={'oriented_coupling':True,'frame_hash':obs['frame_hash'],'geometry':plain({**self.h,'targets':sorted(self.h['targets']),'initial_boxes':sorted(self.h['initial_boxes'])}),'actor_color':self.actor_color,'target_hypothesis':sorted(self.h['targets']),'scope':'Current repeated hollow objects and homologous enclosure; single measured controller, no autonomous model','v5_consumers':['oriented_cargo_handoffs._move','oriented_cargo_handoffs._interaction'],'unknowns':['receiver acceptance before official score','untried command/role bindings','class support beyond current uniform appearance','exclusive frontal interaction law']}
  return {'status':'proposed','kind':'conditional_oriented_coupling','support_plan':plan,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'role':'oriented_part_delivery','observed':False,'open_question':why,'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':actions,'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,i,public,obs):
  plan=p['support_plan'];s=scene(public.frame_rows,plan['geometry'],plan['actor_color']);ok=public.level==p['binding']['level_epoch']and equal(p['steps'][i]['expected_before'],s)
  if i==0:ok=ok and public.frame_hash==plan['frame_hash']
  return {'admitted':bool(ok),'reason':'current_controller_part_masks_and_orientation'}
 def after(self,p,i,before,after,first,second):
  if after['levels_completed']>before['levels_completed']:return {'matched':True,'seal_prefix':True,'reason':'official_boundary'}
  expected=p['steps'][i]['expected_after']
  if expected is None:return {'matched':None,'seal_prefix':True,'reason':'current_relation_experiment_requires_reconciliation'}
  plan=p['support_plan'];ok=equal(expected,scene(second,plan['geometry'],plan['actor_color']))
  return {'matched':ok,'seal_prefix':not ok or p['steps'][i]['uncertain'],'reason':'conditional_rigid_coupling_prediction'if ok else'coupling_pose_or_face_contradiction'}
