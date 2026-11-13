from copy import deepcopy
from .geometry import *
from .policy import ContactPolicy
from . import parent_return, source81_execution
from .source81_policy import Source81Policy
class ReactiveContact:
 def __init__(self):
  self.policy=ContactPolicy();self.source81_policy=Source81Policy();self.epoch=None;self.control=None;self.peer=None;self.floor=None;self.observations=[];self.question=None;self.trials={};self.pending=None;self.recipe=None;self.last=None;self.input_trials={};self.source81_plan=None;self.prepared_source81=None
 def state(self):return deepcopy({k:getattr(self,k)for k in('epoch','control','peer','floor','observations','question','trials','pending','recipe','last','input_trials','source81_plan','prepared_source81')})
 def restore(self,s):
  for k in('epoch','control','peer','floor','observations','question','trials','pending','recipe','last','input_trials','source81_plan','prepared_source81'):
   if k in s:setattr(self,k,deepcopy(s[k]))
 def scope(self,obs):
  if self.epoch!=obs['level_epoch']:
   self.epoch=obs['level_epoch'];self.control=None;self.peer=None;self.floor=None;self.observations=[];self.question=None;self.trials={};self.pending=None;self.recipe=None;self.last=None;self.input_trials={};self.source81_plan=None;self.prepared_source81=None
 def current(self,obs,rows):return scene(obs,rows,self.control,self.peer,self.floor)if self.control and self.peer else None
 def offers(self,obs,rows,remaining):
  s=self.current(obs,rows);out=[]
  if s is None or not self.question:return [],s
  directions=self.policy.config['direction_prior'];paths,calc=routes(s,directions,excluded=(s['peerkey'],));body=s['body'];pitch=s['pitch']
  if self.pending:
   matches=[x for x in s.get('current_entities',[])if self.pending.get('epoch')==obs['level_epoch']and self.pending.get('control_signature')==self.control['signature']and x['bbox']==self.pending['subject_box']and x['palette_value']==self.pending['subject_value']and x['area']==self.pending['before_shape']['area']and digest(x.get('mask'))==digest(self.pending['before_shape'].get('mask'))]
   if len(matches)==1:
    subject=matches[0];offset=[subject['bbox'][0]-body['bbox'][0],subject['bbox'][1]-body['bbox'][1]];terrain={(x,y):('SUPPORTED',obs['observation_ref'])for k in s['admitted']for y in range(s['tiles'][k]['box'][1],s['tiles'][k]['box'][3]+1)for x in range(s['tiles'][k]['box'][0],s['tiles'][k]['box'][2]+1)};terrain.update({p:('SUPPORTED',obs['observation_ref'])for p in mask(subject)})
    obstacles=[p for x in s['stones']if x['bbox']!=subject['bbox']for p in mask(x)]+mask(s['peer'])
    for action,d in directions.items():
     delta=[v*pitch for v in d]
     if delta==offset:continue
     carrier=translated_mask(mask(body),delta);part=translated_mask(mask(subject),delta);blocked,unknown=support_collisions(carrier,part,terrain,obstacles)
     if not blocked and not unknown:
      expected=[v+delta[i%2]for i,v in enumerate(body['bbox'])];out.append({'kind':'binding_followup','subject':subject,'route':[],'actions':[{'action_ref':action}],'expected':[expected],'expected_subject':[v+delta[i%2]for i,v in enumerate(subject['bbox'])],'peer_distance':sum(abs(subject['bbox'][i]-s['peer']['bbox'][i])for i in(0,1)),'cost':1,'calculation':{'calculator':'rigid_grasp_geometry.support_collisions','nonpushing':True,'attachment_still_unknown':True}})
  else:
   candidate,diagnostic=source81_execution.offer(self,obs,rows,remaining,s)
   if candidate:out=[candidate]
  for o in out:
   o['facts']={**o.get('facts',{}),'retained_contact_dependency':bool(self.pending or self.recipe),'current_control_bound':True,'counteracted_approach_observed':bool(self.question),'current_scope_and_input':all(a['action_ref']in obs['available_action_refs']for a in o['actions']),'subject_current_unique':sum(x['bbox']==o['subject']['bbox']and x['palette_value']==o['subject']['palette_value']for x in obs['entities'])==1,'retreat_exists':True};o['guard_tiles']={k:{'box':v['box']}for k,v in s['tiles'].items()};o['guard_support_value']=self.floor;o['guard_other_entities']=[v for v in s['stones']if v['bbox']!=o['subject']['bbox']];o['pitch']=pitch;o['body']=body;o['peer']=s['peer'];o['evidence']=list(dict.fromkeys([*o.get('evidence',[]),obs['observation_ref'],*self.control['evidence'],*self.question['evidence']]));o.setdefault('context',digest([obs['level_epoch'],body['bbox'],o['subject']['bbox'],o['subject']['palette_value'],s['grid']]));o['parent']=deepcopy(self.question);o['preserved_subjects']=[{'bbox':v['bbox'],'value':v['palette_value']}for v in s['stones']if v['bbox']!=o['subject']['bbox']]
  for o in out:
   if o['kind']=='source81_composition':source81_execution.decorate(o,s,obs)
  return out,s
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs);offers,s=self.offers(obs,rows,remaining);choice,workflow=self.policy.choose(offers)
  if choice.get('status')!='selected':return None
  o=offers[choice['index']];actions=o['actions'][:16];steps=[{'action':a,'expected_after':o['expected'][i]}for i,a in enumerate(actions)];focus='reactive_contact:'+digest(o['context']);facts={'hypothesis':True,'mechanism':'reactive_peer_contact_dependency','parent_goal':'capture_contact_hypothesis'}
  return {'status':'proposed','kind':'public_reactive_contact','actions':actions,'steps':steps,'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash','levels_completed')},'reactive_plan':{'offer':o,'remaining':remaining,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'information_child_of_capture_hypothesis','observed':False,'things':[self.control['signature'],self.peer,digest(o['subject']['bbox'])],'properties':{'parent':o['parent'],'unknown':['manipulability','complete_escape_domain','capture_law','response_order'],'alternatives':['guide_into_existing_dead_end','modify_escape_options'],'calculation':o['calculation']},'relations':['contributes_to:G_official_completion'],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':o['evidence'],'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','purpose':choice['reason'],'preconditions':facts,'evidence':o['evidence'],'actions':actions,'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,p,preserve):
  o=p['reactive_plan']['offer']
  if p['actions']!=o['actions'][:16]or p['steps']!=[{'action':a,'expected_after':o['expected'][i]}for i,a in enumerate(p['actions'])]:raise ValueError('exact reactive contact binding')
 def before(self,p,index,public,obs):
  self.bind(p,None);o=p['reactive_plan']['offer'];rows=public.frame_rows
  if obs['level_epoch']!=p['binding']['level_epoch']:return {'admitted':False,'reason':'scope_changed'}
  if o['kind']=='source81_composition':return source81_execution.before(self,p,index,rows,obs)
  expected=o['body']['bbox']if index==0 else o['expected'][index-1]
  body=current_body_box(rows,o['body']);subject=o['subject'];box=subject['bbox']if index==0 or o['kind']!='parent_escape_configuration_access'else o['expected_subjects'][index-1]
  cs=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=rows),connectivity=4)).components
  matches=[c for c in cs if [c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom]==box and c.value==subject['palette_value'] and c.area==subject['area']]
  ok=body==expected and len(matches)==1 and p['actions'][index]['action_ref']in obs['available_action_refs']
  if index==0:
   offers,_=self.offers(obs,rows,p['reactive_plan']['remaining']);ok=ok and all(obs[k]==p['binding'][k]for k in p['binding'])and sum(digest(v)==digest(o)for v in offers)==1
  ok=ok and all(all(v==e['value']for row in patch(rows,e['bbox'])for v in row)for e in o.get('preserved_subjects',[]))
  target=p['steps'][index]['expected_after']
  if o['kind']=='parent_escape_configuration_access':
   member_scene=current_member_scene(rows,o,box);guard=parent_return.validate_current(member_scene,o,index,obs['level_epoch']);ok=ok and guard['admitted']
   old=set((x,y)for bb in (body,box)if bb for y in range(bb[1],bb[3]+1)for x in range(bb[0],bb[2]+1))
   ok=ok and all(rows[y][x]==self.floor or (x,y)in old for bb in (target,o['expected_subjects'][index])for y in range(bb[1],bb[3]+1)for x in range(bb[0],bb[2]+1))
   return {'admitted':bool(ok),'reason':'parent_current_members_support_and_conditional_peer_binding'}
  if target is not None:
   if o['kind']=='parent_capture_contact_question':
    ok=ok and current_body_box(rows,o['peer'])==target and all(rows[y][x]==self.floor or (x,y)in set(mask(o['body'])+mask(o['subject']))for y in range(o['expected_subject'][1],o['expected_subject'][3]+1)for x in range(o['expected_subject'][0],o['expected_subject'][2]+1))
   elif o['kind']!='binding_followup':ok=ok and all(rows[y][x]==self.floor for y in range(target[1],target[3]+1)for x in range(target[0],target[2]+1))
  else:
   adjacent=[c for c in cs if c.area==subject['area'] and c.value!=o['body']['palette_value'] and abs(c.bbox.left-body[0])+abs(c.bbox.top-body[1])==o['pitch']]if body else[]
   ok=ok and body is not None and abs(box[0]-body[0])+abs(box[1]-body[1])==o['pitch'] and len(adjacent)==1
  return {'admitted':bool(ok),'reason':'current_measured_masks_support_scope_and_exact_input'}
 def after(self,p,index,before,after,first,second):
  if p['reactive_plan']['offer']['kind']=='source81_composition':return source81_execution.after(self,p,index,first,second)
  target=p['steps'][index]['expected_after'];b=current_body_box(second,p['reactive_plan']['offer']['body']);matched=None if target is None else b==target
  preserved=all(all(v==e['value']for row in patch(second,e['bbox'])for v in row)for e in p['reactive_plan']['offer'].get('preserved_subjects',[]))
  o=p['reactive_plan']['offer']
  if o['kind']=='parent_capture_contact_question':return {'matched':None,'preservation_matched':preserved,'seal_prefix':True,'reason':'capture_contact_outcome_unknown_official_boundary_only'}
  if o['kind']=='parent_escape_configuration_access':
   members=current_member_scene(second,o,o['expected_subjects'][index]);part=members['stones'][0]['bbox']if members and members['stones']else None;rigid=matched and part==o['expected_subjects'][index];peer_same=bool(members and members['peer']['bbox']==o['expected_peer'])
   return {'matched':bool(rigid and peer_same),'body_position_matched':matched,'rigid_translation_matched':bool(rigid),'preservation_matched':preserved,'seal_prefix':not rigid or not peer_same or not preserved or index+1==len(p['actions']),'reason':'local_transport_and_peer_response_separate_no_capture_claim'}
  return {'matched':matched,'preservation_matched':preserved,'seal_prefix':not preserved or matched is not True or p['reactive_plan']['offer']['kind']=='binding_followup','reason':'current_body_arrival_separate_from_unknown_interaction_and_peer_response'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  self.scope(before);refs=[before['observation_ref'],after['observation_ref']];action=command['action_ref'];relevant=proposal and'reactive_plan'in proposal
  if before['level_epoch']!=after['level_epoch']:self.scope(after);return {'status':'official_boundary','evidence':refs}
  context=digest([before['level_epoch'],first]);trial={'action':deepcopy(command),'directional':action in self.policy.config['direction_prior'],'changed':first!=second,'evidence':refs};self.input_trials.setdefault(context,[]).append(trial)
  motions=movements(before,after);prior=self.policy.config['direction_prior'].get(action);compatible=[m for m in motions if prior and m['delta'][0]*prior[1]==m['delta'][1]*prior[0]and sum(a*b for a,b in zip(m['delta'],prior))>0]
  if not self.control and len(compatible)==1:
   m=compatible[0];binding,workflow=self.policy.bind_control({'unique_input_compatible_motion':True,'current_exact_shape':True,'positive_axial_displacement':True})
   if binding['status']=='conditional_control_bound':self.control={'signature':m['signature'],'commands':{},'evidence':[],'binding':binding,'workflow':workflow}
  event=None
  if self.control:
   matching=[m for m in motions if m['signature']==self.control['signature']]
   if len(matching)==1 and prior:
    m=matching[0]
    if m['delta'][0]*prior[1]!=m['delta'][1]*prior[0]or sum(a*b for a,b in zip(m['delta'],prior))<=0:
     self.control=None;self.pending=None;self.recipe=None;self.question=None;return {'status':'control_contradiction','evidence':refs}
    self.control['last_motion']={'after_ref':after['observation_ref'],'translation':[action,m['delta'][1],m['delta'][0]],'evidence':refs};self.control['commands'][action]=m['delta'];self.control['evidence']=list(dict.fromkeys(self.control['evidence']+refs));oldpatch=patch(second,m['before']['bbox']);values={v for row in oldpatch for v in row}
    if len(values)==1 and(self.floor is None or self.floor==next(iter(values))):
     self.floor=next(iter(values));self.control['support_evidence']=list(dict.fromkeys(self.control.get('support_evidence',[])+refs))
    elif len(values)==1:self.control['latest_changed_departure_underlay']={'value':next(iter(values)),'evidence':refs,'status':'not_a_replacement_support_law'}
    other=[v for v in motions if v['signature']!=self.control['signature']and v['after']['area']==m['after']['area']]
    if self.peer is None and len(other)==1:self.peer=other[0]['signature']
    quantum=max(abs(v)for v in m['delta']);measured=relative(before,after,first,second,self.control['signature'],quantum)
    if measured:self.observations.append({'measure':measured,'evidence':refs});self.observations=self.observations[-16:]
    if measured and measured['relative_escape_counteracted_approach_count']>0:
     if self.question is None:self.question={'id':'capture_question:'+digest([self.epoch,self.control['signature'],self.peer]),'goal':'capture_contact_hypothesis','status':'active_missing_manipulability','alternatives':['guide_into_existing_dead_end','modify_escape_options'],'evidence':[]}
     if 'origin_measurement'not in self.question:
      origin=bound_relative_peer_row(measured,after,second,self.peer)
      if origin is not None:self.question['origin_measurement']=deepcopy(origin);self.question['origin_measurement_evidence']=list(refs);self.question['origin_peer_signature']=self.peer;self.question['origin_body_signature']=self.control['signature']
     self.question['evidence']=list(dict.fromkeys(self.question['evidence']+refs));event={'status':'counteracted_approach_question_retained','evidence':refs,'measurement':measured}
  if relevant:
   o=proposal['reactive_plan']['offer']
   if o['kind']=='source81_composition'and o['phase']!='grasp_probe':
    event=source81_execution.record(self,o,index,before,after,command,first,second)
   elif o['kind']=='parent_capture_contact_question':
    current=self.current(after,second);b=unique(after).get(self.control['signature']);parts=[x for x in after['entities']if x['bbox']==o['expected_subject']and x['palette_value']==o['subject']['palette_value']]
    if b and b['bbox']==o['expected'][0]and len(parts)==1:self.recipe['subject_box']=parts[0]['bbox'];self.recipe['offset']=[parts[0]['bbox'][i]-b['bbox'][i]for i in (0,1)];self.recipe['evidence']=list(dict.fromkeys(self.recipe['evidence']+refs))
    self.question['last_capture_contact']={'evidence':refs,'official_completion':False,'effect_unknown_without_boundary':True};event={'status':'capture_contact_return_parent_still_open','evidence':refs}
   elif o['kind']=='parent_escape_configuration_access':
    current=self.current(after,second);returned=parent_return.reconcile(self.question,self.recipe,o,index,current,after['observation_ref'],after['level_epoch']);self.question=returned['question'];self.recipe=returned['recipe'];
    if returned['receipt']['rigid_translation_matched'] and current:self.recipe['offset']=[self.recipe['subject_box'][i]-current['body']['bbox'][i]for i in (0,1)]
    event={'status':'capture_parent_configuration_return','receipt':returned['receipt'],'evidence':refs}
   elif proposal['steps'][index]['expected_after']is None:
    if o['kind']=='source81_composition':self.source81_plan=None
    measured=relative(before,before,first,first,self.control['signature'],o['pitch']) or {}
    contact_facts={**measured,'relative_escape_candidate_contact_input_available':action in before['available_action_refs'],'interaction_measurement_kind':'discrete','is_directional_interface_action':action in self.policy.config['direction_prior'],'candidate_previously_executed_in_current_configuration':o['attempt']in self.trials,'incoming_declared_route_engagement_present':bool(o['route']),'incoming_declared_route_lease_consumed':index==len(proposal['steps'])-1,'candidate_ref':o['attempt'],'relative_motion_controlled_approach_counteracted':bool(self.question),'relative_escape_transition_rows':[row for obs in self.observations for row in obs['measure'].get('relative_escape_transition_rows',[])]}
    projection,projection_workflow=self.policy.contact(contact_facts)
    if projection['status']!='contact_question_projected':
     if o['kind']=='source81_composition'and o['phase']=='grasp_probe'and o['publication'].get('adaptation',{}).get('status')=='admitted_experiment':projection={'status':'contact_question_projected','source':'returned_declared_ready_operator_question','authority':deepcopy(o['publication']),'historical_projection_refusal':projection,'effect_unknown_until_measurement':True}
     else:return {'status':'contact_return_without_current_projection','projection':projection,'evidence':refs,'parent_preserved':deepcopy(self.question)}
    self.question['contact_projection']={'result':projection,'workflow':projection_workflow,'evidence':refs}
    box=o['subject']['bbox'];values={v for row in patch(second,box)for v in row};body=unique(after).get(self.control['signature']);changed=patch(first,box)!=patch(second,box)
    self.trials[o['attempt']]={'evidence':refs,'local_changed':changed,'attachment_confirmed':False}
    if len(values)==1 and changed and body and body['bbox']==(o['expected'][index-1]if index else o['body']['bbox']):self.pending={'epoch':self.epoch,'control_signature':self.control['signature'],'subject_box':box,'subject_value':next(iter(values)),'evidence':refs,'before_shape':o['subject'],'operator':action};event={'status':'local_contact_change_binding_unknown','evidence':refs}
   elif o['kind']=='binding_followup':
    b=unique(after).get(self.control['signature']);oldbody=unique(before).get(self.control['signature']);oldparts=[e for e in before['entities']if e['bbox']==o['subject']['bbox']and e['palette_value']==o['subject']['palette_value']and digest(e.get('mask'))==digest(o['subject'].get('mask'))];matches=[e for e in after['entities']if e['bbox']==o['expected_subject']and e['palette_value']==o['subject']['palette_value']and e['area']==o['subject']['area']and digest(e.get('mask'))==digest(o['subject'].get('mask'))]
    body_delta=[b['bbox'][i]-oldbody['bbox'][i]for i in(0,1)]if b and oldbody else None;part_delta=[matches[0]['bbox'][i]-oldparts[0]['bbox'][i]for i in(0,1)]if len(matches)==len(oldparts)==1 else None
    facts={'same_current_scope':bool(self.pending and self.pending['epoch']==before['level_epoch']==after['level_epoch']),'body_and_part_distinct':bool(oldbody and len(oldparts)==1 and oldbody['bbox']!=oldparts[0]['bbox'] and oldparts[0]['signature']!=self.peer),'current_unique_shapes':bool(b and oldbody and len(matches)==len(oldparts)==1 and digest(b.get('mask'))==digest(oldbody.get('mask'))),'same_nonzero_translation':bool(body_delta and any(body_delta)and body_delta==part_delta and b['bbox']==o['expected'][0]),'nonpushing_translation':bool(oldbody and len(oldparts)==1 and body_delta!=[oldparts[0]['bbox'][i]-oldbody['bbox'][i]for i in(0,1)]),'other_declared_subjects_preserved':all(all(v==e['value']for row in patch(second,e['bbox'])for v in row)for e in o.get('preserved_subjects',[])),'actual_operator_receipt_present':bool(self.pending and self.pending.get('operator')and self.pending.get('evidence'))}
    receipt={'epoch':self.epoch,'body_signature':self.control['signature'],'subject_mask_digest':digest(matches[0]['mask'])if len(matches)==1 else None,'subject_area':matches[0]['area']if len(matches)==1 else None,'operator_action_ref':self.pending.get('operator')if self.pending else None,'operator_observation_refs':deepcopy(self.pending.get('evidence',[]))if self.pending else[],'transition_refs':refs,'body_delta_xy':body_delta,'part_delta_xy':part_delta}
    claim_result,claim_workflow=self.policy.reconcile_binding(facts,receipt)
    if claim_result['status']=='observed_method_claim':
     claim=claim_result['claim'];self.recipe={'status':claim['status'],'subject_box':matches[0]['bbox'],'subject_value':matches[0]['palette_value'],'subject_mask_digest':receipt['subject_mask_digest'],'subject_area':receipt['subject_area'],'offset':[matches[0]['bbox'][0]-b['bbox'][0],matches[0]['bbox'][1]-b['bbox'][1]],'evidence':self.pending['evidence']+refs,'scope':self.epoch,'operator_action_ref':receipt['operator_action_ref'],'operator_observation_refs':receipt['operator_observation_refs'],'method_claim_refs':[claim['ref']],'method_claim':claim,'method_workflow':claim_workflow};self.pending=None;self.question['status']='active_with_observed_rigid_transport_method';self.question['available_method']=deepcopy(self.recipe);event={'status':'transport_method_acquired_parent_consumer_pending','evidence':refs,'recipe':deepcopy(self.recipe),'parent':deepcopy(self.question),'remaining_unknown':'current_escape_configuration_consumer_required'}
    else:self.pending=None;event={'status':'binding_followup_unresolved_or_refuted','evidence':refs,'claim_result':claim_result,'claim_workflow':claim_workflow}
  self.last={'before':before['observation_ref'],'after':after['observation_ref']};return event
