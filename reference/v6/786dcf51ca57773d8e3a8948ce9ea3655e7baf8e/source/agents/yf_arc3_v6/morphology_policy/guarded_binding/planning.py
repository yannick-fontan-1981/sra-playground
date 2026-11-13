from copy import deepcopy
from .geometry import find_body,center,correspondence,empty_frames,near,digest,revalidate_frame,enclosing_contours

def distance(a,b):return sum(abs(x-y) for x,y in zip(a,b))
def shift(box,delta):return [box[0]+delta[0],box[1]+delta[1],box[2]+delta[0],box[3]+delta[1]]
def offers(tracker,obs,rows,remaining,config):
 if tracker.epoch!=obs['level_epoch'] or not tracker.core or remaining<1:return []
 body=find_body(obs,tracker.core['signature'])
 if not body:return []
 if tracker.pending_reception:return separation_offers(tracker,obs,rows,remaining,config,body)
 targets=[]
 if tracker.held:
  if tracker.held['status']=='transport_identity_ambiguous':return []
  current_frame=revalidate_frame(tracker.held['frame'],rows,[body['bbox'],tracker.held['bbox']],enclosing_contours(obs,body));frames=[current_frame] if current_frame else []
  if len(frames)!=1:return []
  targets=[{'ref':tracker.held['ref'],'bbox':frames[0]['interior_bbox'],'center':frames[0]['center'],'frame':frames[0],'mode':'reception','evidence':tracker.held['evidence']}]
 else:
  for pair in correspondence(obs,rows,tracker.core['signature'],tracker.observed_frames.values()):targets.append({**pair['object'],'ref':pair['ref'],'frame':pair['frame'],'mode':'binding','evidence':pair['evidence']})
 result=[];pose=list(center(body['bbox']));available=[a for a in obs['available_action_refs'] if a not in ('RESET','ACTION6')]
 for target in targets:
  context=digest([obs['level_epoch'],pose,target['ref'],target['bbox'],tracker.held and tracker.held['status']]);failed={x['action'] for x in tracker.failed if x['context']==context}
  base={'target':target,'context':context,'evidence':list(dict.fromkeys(tracker.core['evidence']+target['evidence']+[obs['observation_ref']])),'unknown':['pickup_metric_and_radius','release_position_law','directed_threats','protective_field_effect','capacity_beyond_current_one_object'],'risks':['interaction_may_change_control_or_object','unobserved_passage_or_hazard','no_proven_return_for_first_probe'],'falsifiers':['body_identity_changes','frame_correspondence_changes','other_object_moves','predicted_displacement_differs','interaction_has_no_expected_object_effect'],'preserve':['nonselected_object_centres_when_currently_observable','current_body_identity'],'distance':distance(pose,target['center'])}
  if near(body['bbox'],target['bbox']):
   controls=[]
   if tracker.interaction:controls.append((tracker.interaction['action'],tracker.interaction['evidence'],'current_observed_interaction'))
   elif tracker.methods:
    methods=[m for m in tracker.methods if m['interaction'] in available]
    actions={m['interaction'] for m in methods}
    if len(actions)==1:controls.append((next(iter(actions)),[e for m in methods for e in m['evidence']],'portable_interaction_currently_probed'))
   for action,evidence,status in controls:
    if action in failed:continue
    result.append({**deepcopy(base),'kind':'probe_reception' if tracker.held else 'probe_observed_binding','actions':[{'action_ref':action}],'poses':[pose],'conditional':True,'control_status':status,'evidence':list(dict.fromkeys(base['evidence']+evidence)),'hypotheses':config['interaction_models'][target['mode']]})
   if not tracker.held:
    for action in available:
     if action not in tracker.tried and action not in failed:result.append({**deepcopy(base),'kind':'probe_unknown_contact_control','actions':[{'action_ref':action}],'poses':[pose],'conditional':True,'hypotheses':config['interaction_models']['binding']})
  for action,method in tracker.moves.items():
   if action not in available:continue
   delta=method['delta'];box=list(body['bbox']);poses=[];actions=[]
   for _ in range(min(remaining,config['maximum_prefix'])):
    here=list(center(box));nxt=shift(box,delta)
    if any(x['action']==action and x['pose']==here for x in tracker.blocked):break
    if min(nxt[0],nxt[1])<0 or nxt[2]>=len(rows[0]) or nxt[3]>=len(rows):break
    if distance(center(nxt),target['center'])>=distance(here,target['center']):break
    poses.append(here);actions.append({'action_ref':action});box=nxt
    if near(box,target['bbox']):break
   if actions:result.append({**deepcopy(base),'kind':'approach_reception' if tracker.held else 'approach_correspondence','actions':actions,'poses':poses,'delta':delta,'conditional':True,'evidence':list(dict.fromkeys(base['evidence']+method['evidence'])),'hypotheses':['locally_observed_displacement_extends_over_currently_unentered_support'],'residual_distance':distance(center(box),target['center'])})
  for action in available:
   if action not in tracker.tried and action not in failed:result.append({**deepcopy(base),'kind':'probe_control_for_correspondence','actions':[{'action_ref':action}],'poses':[pose],'conditional':True,'hypotheses':['control_may_enable_access_to_the_visible_correspondence','control_may_have_nonmovement_effect_or_no_effect']})
 return result


def separation_offers(tracker,obs,rows,remaining,config,body):
 pending=tracker.pending_reception;pose=list(center(body['bbox']));frame=pending['frame'];other=correspondence(obs,rows,tracker.core['signature'],tracker.observed_frames.values());goals=[p['object']['center'] for p in other if p['frame']['ref']!=frame['ref']];result=[]
 for action,method in tracker.moves.items():
  delta=method['delta'];next_box=shift(body['bbox'],delta);next_pose=list(center(next_box))
  if action not in obs['available_action_refs'] or min(next_box[0],next_box[1])<0 or next_box[2]>=len(rows[0]) or next_box[3]>=len(rows):continue
  if any(e['action']==action and e['pose']==pose for e in tracker.blocked):continue
  if distance(next_pose,frame['center'])<=distance(pose,frame['center']):continue
  target={'ref':pending['object_ref'],'frame':frame,'bbox':frame['interior_bbox'],'center':frame['center'],'mode':'separation','evidence':pending['evidence']}
  result.append({'target':target,'context':digest([obs['level_epoch'],pose,pending['ref']]),'kind':'probe_reception_separation','actions':[{'action_ref':action}],'poses':[pose],'delta':delta,'conditional':True,'hypotheses':config['reception_models'],'evidence':list(dict.fromkeys(pending['evidence']+method['evidence']+[obs['observation_ref']])),'unknown':['release_identity_until_current_separation','directed_threats','protective_field_effect'],'risks':['candidate_release_may_still_be_bound','unobserved_passage_or_hazard'],'falsifiers':['object_translates_with_body','reception_site_unobservable','body_motion_not_locally_revalidated'],'preserve':['nonselected_object_centres_when_currently_observable','current_body_identity','candidate_reception_site_occupancy'],'distance':distance(pose,frame['center']),'residual_distance':min((distance(next_pose,g) for g in goals),default=0),'pending_reception':pending,'secondary_access':[{'frame_ref':p['frame']['ref'],'current_distance':distance(pose,p['object']['center']),'after_distance':distance(next_pose,p['object']['center'])} for p in other if p['frame']['ref']!=frame['ref'] and distance(next_pose,p['object']['center'])<distance(pose,p['object']['center'])]})
 return result
