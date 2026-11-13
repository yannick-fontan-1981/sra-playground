from copy import deepcopy
from .geometry import digest,measure,observe,measure_square_field,FrameGrid
from .policy import ReactionPolicy

class OrderedReaction:
 def __init__(self):
  self.policy=ReactionPolicy();self.epoch=None;self.control=[];self.packets=[];self.attempts={};self.progress=None;self.history=[]
 def state(self):return deepcopy({k:getattr(self,k)for k in('epoch','control','packets','attempts','progress','history')})
 def restore(self,s):
  for k in('epoch','control','packets','attempts','progress','history'):
   if k in s:setattr(self,k,deepcopy(s[k]))
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.packets:self.history.append({'epoch':self.epoch,'packets':deepcopy(self.packets),'authority':'history_only_no_current_permit'})
  self.epoch=obs['level_epoch'];self.control=[];self.packets=[];self.attempts={};self.progress=None
 def measurement(self,rows):return measure(rows,self.packets,self.policy.config['direction_prior'])
 def offers(self,obs,rows):
  facts,per=self.measurement(rows);out=[];field=measure_square_field(FrameGrid(rows=rows))
  if field is None or not facts['ordered_tip_unique_ring_present']or not self.control:return []
  current=[field.stride,field.size,field.row_phase,field.col_phase]
  controls=[c for c in self.control if c['lattice']==current]
  if not controls:return []
  ring=list(facts['ordered_tip_ring_position']);process=self.policy.config['process_prior'];context=digest([obs['level_epoch'],rows]);known=self.progress and self.progress['after_hash']==digest(rows)and self.progress['progress']
  commands=[]
  for action,af in per.items():
   if af.get('ordered_tip_first_shortest_route_edge'):commands.append(('cover',action))
  commands += [('protected',facts.get('ordered_tip_packet_action_ref',process)),('continue',self.progress['action']if self.progress else process),('probe',process)]
  for kind,action in commands:
   if action not in obs['available_action_refs']:continue
   attempt=digest([context,action]);f={**facts,**per.get(action,{}),'candidate_ref':attempt,'action_ref':action,'current_control_translation_observed':True,'current_input_bound':True,'untried_current_context':attempt not in self.attempts,'last_action_known_to_produce_scene_effect':True,'is_directional_interface_action':action in self.policy.config['direction_prior'],'interaction_kind':'discrete','interaction_measurement_kind':'discrete','action_execution_count':sum(v['action']==action for v in self.attempts.values()),'attempted_without_effect_in_current_context':attempt in self.attempts,'current_progress_without_restoration':bool(known)}
   delta=self.policy.config['direction_prior'].get(action);expected=[ring[0]+delta[0]*field.stride,ring[1]+delta[1]*field.stride]if kind=='cover'else None
   out.append({'kind':kind,'action':{'action_ref':action},'expected':expected,'ring':ring,'attempt':attempt,'context':context,'facts':f,'lattice':current,'evidence':[obs['observation_ref'],*[x for c in controls for x in c['evidence']],*[p['evidence_ref']for p in self.packets]],'hypotheses':self.policy.config['hypotheses']})
  return out
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs)
  if remaining<1:return None
  offers=self.offers(obs,rows);choice,workflow=self.policy.choose(offers)
  if choice.get('status')!='selected':return None
  o=offers[choice['index']];focus='ordered_reaction:'+o['attempt'];actions=[o['action']];step={'action':o['action'],'expected_after':o['expected']};facts={'mechanism':'measured_ordered_field_conditional_intervention','hypothesis':True,'continuation':o['kind']=='continue','projection':choice['projection_ref']};evidence=o['evidence']
  return {'status':'proposed','kind':'public_ordered_reaction','actions':actions,'steps':[step],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash','levels_completed')},'reaction_plan':{'offer':o,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'conditional_ordered_process_or_arrival_protection','observed':False,'things':['current_outline','measured_oriented_field'],'properties':{'hypotheses':o['hypotheses'],'incidences':o['facts'].get('ordered_tip_temporal_incidences',[]),'unknown':['phase_laws','quota','terminal_role','overlay_blocking']},'relations':['contributes_to:G_official_completion'],'open_question':choice['reason']}],'question':{'reason':choice['reason']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','purpose':choice['reason'],'preconditions':facts,'evidence':evidence,'actions':actions,'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,p,preserve):
  o=p['reaction_plan']['offer']
  if p['actions']!=[o['action']]or p['steps']!=[{'action':o['action'],'expected_after':o['expected']}]:raise ValueError('exact declared reaction input')
 def before(self,p,index,public,obs):
  self.bind(p,None)
  if index!=0 or any(obs[k]!=p['binding'][k]for k in p['binding']):return {'admitted':False,'reason':'stale_scope_or_observation'}
  o=p['reaction_plan']['offer'];offers=self.offers(obs,public.frame_rows)
  admit=sum(digest(v)==digest(o)for v in offers)==1
  return {'admitted':admit,'reason':'exact_current_outline_field_evidence_and_declared_input'}
 def after(self,p,index,before,after,first,second):
  expected=p['steps'][index]['expected_after'];facts,_=self.measurement(second);matched=None if expected is None else list(facts.get('ordered_tip_ring_position',()))==expected
  return {'matched':matched,'preservation_matched':None,'seal_prefix':True,'reason':'unknown_process_or_observed_outline_arrival_not_full_reaction_law'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  self.scope(before);a=command['action_ref'];refs=[before['observation_ref'],after['observation_ref']];fb,_=self.measurement(first);fa,_=self.measurement(second);field=measure_square_field(FrameGrid(rows=first));event=None
  if before['level_epoch']!=after['level_epoch']:
   event={'status':'official_boundary','evidence':refs,'score_delta':after['levels_completed']-before['levels_completed']};self.scope(after);return event
  if field and fb['ordered_tip_unique_ring_present']and fa['ordered_tip_unique_ring_present']and a in self.policy.config['direction_prior']:
   p=fb['ordered_tip_ring_position'];q=fa['ordered_tip_ring_position'];delta=[q[0]-p[0],q[1]-p[1]];prior=self.policy.config['direction_prior'][a]
   if delta==[v*field.stride for v in prior] and delta!=[0,0]:
    item={'action':a,'delta':delta,'lattice':[field.stride,field.size,field.row_phase,field.col_phase],'evidence':refs};self.control.append(item);self.control=self.control[-16:];event={'status':'observed_outline_translation',**item}
  packet=observe(first,frames or[second],a)
  if packet:
   item={'packet':packet,'evidence_ref':after['observation_ref'],'before_ref':before['observation_ref'],'source_digest':digest([first,frames or[second]])}
   if not any(digest(p['packet'])==digest(packet)for p in self.packets):self.packets.append(item)
   self.packets=self.packets[-4:];self.progress={'action':a,'after_hash':digest(second),'progress':first!=second,'evidence':refs};event={'status':'ordered_marker_change_observed','evidence':refs,'packet_digest':digest(packet),'frames':packet['frame_count'],'restored':first==second,'complete_law_acquired':False}
  elif a not in self.policy.config['direction_prior']:self.progress=None
  if proposal and'reaction_plan'in proposal:
   o=proposal['reaction_plan']['offer'];self.attempts[o['attempt']]={'action':a,'evidence':refs,'event':event,'result_unknown':event is None}
  return event

