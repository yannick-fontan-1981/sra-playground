from copy import deepcopy
from .identity import unchanged,compatible
from .reception import arrival,separation
from .geometry import moved_core,find_body,center,correspondence,empty_frames,digest,contains,enclosing_contours

class BindingTracker:
 def __init__(self):
  self.epoch=None;self.core=None;self.moves={};self.tried=[];self.blocked=[];self.held=None;self.interaction=None;self.methods=[];self.events=[];self.failed=[];self.goal_evidence=[];self.correspondence_context=None;self.context_refutations=[];self.pending_reception=None;self.reception_receipts=[];self.observed_frames={}
 def state(self):return deepcopy(self.__dict__)
 def restore(self,state):self.__dict__.update(deepcopy(state))
 def reset(self,epoch):
  methods=deepcopy(self.methods);goals=deepcopy(self.goal_evidence);self.__init__();self.epoch=epoch;self.methods=methods;self.goal_evidence=goals
 def has_transport_context(self):
  return bool(self.correspondence_context or self.held or self.interaction or self.methods or self.goal_evidence)
 def admit_context(self,observation,rows):
  if self.epoch not in (None,observation['level_epoch']):return False
  self.revalidate_context(observation,rows)
  if self.has_transport_context():return True
  pairs=correspondence(observation,rows,self.core['signature'] if self.core else None)
  refused={item['pair_ref'] for item in self.context_refutations};pairs=[pair for pair in pairs if pair['ref'] not in refused]
  if not pairs:return False
  self.epoch=observation['level_epoch'];self.correspondence_context={'level_epoch':self.epoch,'pairs':[p['ref'] for p in pairs],'frames':{p['ref']:p['frame'] for p in pairs},'evidence':[observation['observation_ref']],'status':'observed_correspondence_hypothesis_not_liaison_fact'}
  return True
 def frame_contradiction(self,frame,observation,rows):
  body=find_body(observation,self.core['signature']) if self.core else None
  occluders=([body['bbox']] if body else [])+([self.held['bbox']] if self.held else [])
  contours=enclosing_contours(observation,body) if body else []
  return corner_contradiction(frame,rows,occluders,contours)
 def revalidate_context(self,observation,rows):
  context=self.correspondence_context
  if not context:return
  body=find_body(observation,self.core['signature']) if self.core else None
  occluders=([body['bbox']] if body else [])+([self.held['bbox']] if self.held else [])
  contours=enclosing_contours(observation,body) if body else []
  retained=[]
  for pair_ref in context['pairs']:
   frame=context.get('frames',{}).get(pair_ref);contradiction=corner_contradiction(frame,rows,occluders,contours) if frame else None
   if contradiction:self.context_refutations.append({'pair_ref':pair_ref,'frame_ref':frame['ref'],'reason':'anchored_frame_corner_contradiction','changed_corners':contradiction,'evidence':[observation['observation_ref']],'prior_evidence':context['evidence']})
   else:retained.append(pair_ref)
  if retained:self.correspondence_context={**context,'pairs':retained,'frames':{k:v for k,v in context.get('frames',{}).items() if k in retained}}
  else:self.correspondence_context=None
 def record(self,before,after,command,first,second,proposal=None,index=0):
  if self.epoch!=before['level_epoch']:self.reset(before['level_epoch'])
  action=command['action_ref'];evidence=[before['observation_ref'],after['observation_ref']]
  if before['level_epoch']!=after['level_epoch'] or after['levels_completed']>before['levels_completed']:
   if self.held and proposal and proposal.get('binding_plan',{}).get('offer',{}).get('kind')=='probe_reception':
    method={'ref':'binding_method:'+digest(evidence),'interaction':action,'source_epoch':self.epoch,'scope':'same_appearance_frame_reception_hypothesis','evidence':evidence,'goal':'released_corresponding_object_at_visible_frame_boundary','pickup_evidence':self.held['evidence'],'status':'boundary_support_not_universal_sufficiency'}
    self.methods.append(method);self.goal_evidence.append(method)
   self.reset(after['level_epoch']);return {'status':'scope_changed_preserving_conditional_methods','evidence':evidence}
  if not self.admit_context(before,first) and not self.admit_context(after,second):return None
  for frame in empty_frames(before,first)+empty_frames(after,second):self.observed_frames[frame['ref']]=frame
  self.tried=list(dict.fromkeys(self.tried+[action]));motion=moved_core(before,after)
  if self.core is None and motion:
   self.core={k:motion[k] for k in ('signature','area','palette_value')};self.core['evidence']=evidence
   l,t,r,b=motion['bbox'];self.core['offsets']=[[x-l,y-t] for y in range(t,b+1) for x in range(l,r+1) if second[y][x]==self.core['palette_value']]
  if not self.core:return None
  a=find_body(before,self.core['signature']);b=find_body(after,self.core['signature'])
  if not a or not b:return {'status':'body_identity_unbound','evidence':evidence}
  delta=[y-x for x,y in zip(center(a['bbox']),center(b['bbox']))];event=None
  if self.pending_reception and any(delta):
   proof=separation(self.pending_reception,second,after,b,delta,self.moves.get(action,{}).get('delta'),evidence)
   if proof['status']=='reception_confirmed_by_separation':
    self.reception_receipts.append(proof);self.methods.append({'ref':'binding_method:'+digest(proof['evidence']),'interaction':self.interaction['action'],'source_epoch':self.epoch,'scope':'selected_site_reception_observed_after_separation','evidence':proof['evidence'],'status':'local_relation_not_universal_sufficiency'})
    self.pending_reception=None;self.held=None;self.events=(self.events+[proof])[-32:];return proof
   if proof['status']=='reception_refuted_object_moves_with_body':
    self.events=(self.events+[proof])[-32:]
    self.pending_reception=None;self.held['status']='joint_transport_observed'
   else:return proof
  if any(delta):
   old=self.moves.get(action)
   if old and old['delta']!=delta:
    event={'status':'nonlocal_or_contextual_motion','action':action,'expected':old['delta'],'observed':delta,'evidence':evidence}
   else:self.moves[action]={'delta':delta,'evidence':evidence,'status':'observed_local_displacement'}
   if self.held:
    pieces=[e for e in after['entities'] if e['palette_value']==self.held['palette_value'] and e['area']>=4 and not any(contains(f['bbox'],e['bbox']) for f in empty_frames(after,second))]
    plausible=[e for e in pieces if min(e['bbox'][2]-e['bbox'][0],e['bbox'][3]-e['bbox'][1])>0 and sum(abs(x-y) for x,y in zip(center(e['bbox']),center(b['bbox'])))<=4*max(b['bbox'][2]-b['bbox'][0]+1,b['bbox'][3]-b['bbox'][1]+1)]
    if len(plausible)==1:
     obj=plausible[0];self.held.update({'bbox':obj['bbox'],'status':'joint_transport_observed','evidence':list(dict.fromkeys(self.held['evidence']+evidence))});event={'status':'object_remains_locally_bound_after_motion','relative_pose_is_not_rigid':True,'evidence':evidence}
    else:self.held['status']='transport_identity_ambiguous';event={'status':'transport_identity_ambiguous','evidence':evidence}
  elif action in self.moves:
   self.blocked.append({'action':action,'pose':list(center(a['bbox'])),'evidence':evidence});event={'status':'motion_no_effect_contextual','evidence':evidence}
  else:
   if self.held and proposal and proposal.get('binding_plan',{}).get('offer',{}).get('kind')=='probe_reception':
    plan=proposal['binding_plan']['offer'];pending=arrival(self.held,first,second,a,b,plan.get('preservation_regions',[]),evidence)
    if pending:
     self.pending_reception=pending;self.held['status']='reception_separation_pending';return {'status':'arrival_at_selected_site_requires_separation','frame_ref':pending['frame']['ref'],'evidence':evidence}
   matches=correspondence(before,first,self.core['signature'])
   changed=[];ambiguities=[]
   for match in matches:
    obj=match['object']
    if unchanged(obj,after):continue
    candidates=[e for e in after['entities'] if e['palette_value']==obj['palette_value'] and e['area']>=4 and not unchanged(e,before) and not any(contains(f['bbox'],e['bbox']) for f in empty_frames(after,second))]
    local=[]
    for candidate in candidates:
     if sum(abs(x-y) for x,y in zip(center(candidate['bbox']),center(b['bbox'])))>4*max(b['bbox'][2]-b['bbox'][0]+1,b['bbox'][3]-b['bbox'][1]+1):continue
     identity=compatible(obj,candidate,first,second,before,after,a,b)
     if identity:local.append((candidate,identity))
    if len(local)!=1:
     if candidates:ambiguities.append({'source_bbox':obj['bbox'],'candidate_bboxes':[e['bbox'] for e in candidates],'compatible_count':len(local),'reason':'multiple_compatible_relocations' if len(local)>1 else 'changed_occurrences_not_visibly_compatible'})
     continue
    other,identity=local[0]
    if center(other['bbox'])==obj['center']:continue
    if sum(abs(x-y) for x,y in zip(center(other['bbox']),center(b['bbox'])))>4*max(b['bbox'][2]-b['bbox'][0]+1,b['bbox'][3]-b['bbox'][1]+1):continue
    changed.append((obj,other,match['frame'],identity))
   if not self.held and len(changed)==1:
    obj,other,frame,identity=changed[0];self.held={'ref':'bound_object:'+digest([before['level_epoch'],obj['palette_value'],obj['bbox']]),'palette_value':obj['palette_value'],'bbox':other['bbox'],'original_bbox':obj['bbox'],'frame':frame,'status':'local_attachment_hypothesis','identity_binding':identity,'evidence':evidence};self.interaction={'action':action,'evidence':evidence};event={'status':'local_attachment_hypothesis','alternatives':['attachment','remote_relocation_then_independent_object'],'identity_binding':identity,'evidence':evidence}
   elif ambiguities or len(changed)>1:
    event={'status':'identity_binding_unresolved','ambiguities':ambiguities,'compatible_source_count':len(changed),'evidence':evidence}
   elif proposal and 'binding_plan' in proposal:
    offer=proposal['binding_plan']['offer'];self.failed.append({'action':action,'context':offer['context'],'evidence':evidence});event={'status':'interaction_no_observed_identity_effect','evidence':evidence}
  if event:self.events=(self.events+[event])[-32:]
  return event


def corner_contradiction(frame,rows,occluders,contours):
 # A missing/out-of-view frame is not a contradiction. Require the other
 # measured frame edges and at least two corners to anchor this comparison.
 l,t,r,b=frame['bbox']
 if l<0 or t<0 or b>=len(rows) or r>=len(rows[0]):return None
 equal_corners=0;changed=[];edges=0
 for y in range(t,b+1):
  for x in range(l,r+1):
   if x not in (l,r) and y not in (t,b):continue
   if any(a<=x<=c and d<=y<=e for a,d,c,e in occluders) or rows[y][x] in contours:continue
   if x in (l,r) and y in (t,b):
    if rows[y][x]==frame['corner_value']:equal_corners+=1
    else:changed.append([x,y])
   else:
    if rows[y][x]!=frame['palette_value']:return None
    edges+=1
 return changed if equal_corners>=2 and edges and changed else None
