from copy import deepcopy
from .policy import FramedPolicy
from .geometry import candidates,transition,digest

class FramedTransfer:
 def __init__(self):self.policy=FramedPolicy();self.epoch=None;self.spans=[];self.receipts=[];self.attempts={};self.portable=[];self.last=None
 def state(self):return deepcopy({k:getattr(self,k)for k in('epoch','spans','receipts','attempts','portable','last')})
 def restore(self,state):
  for k in('epoch','spans','receipts','attempts','portable','last'):
   if k in state:setattr(self,k,deepcopy(state[k]))
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.spans or self.receipts:self.portable.append({'source_epoch':self.epoch,'spans':self.spans,'receipts':self.receipts,'authority':'historical_not_current_permit'})
  self.epoch=obs['level_epoch'];self.spans=[];self.receipts=[];self.attempts={};self.last=None
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs);action_ref=self.policy.config['point_action']
  if remaining<1 or action_ref not in obs['available_action_refs']:return None
  offers=candidates(rows,obs,self.policy,self.spans,self.receipts,self.attempts)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  selected=offers[choice['index']];action={'action_ref':action_ref,'data':{'x':selected['point_x'],'y':selected['point_y']}};facts={'framed_interface_current':True};evidence=[obs['observation_ref'],*choice['projected'].get('premise_claim_refs',[])];focus='composition:framed:'+selected['candidate_ref'];purpose=choice['projected'].get('subgoal_ref','test_current_framed_relation')
  point_binding={'observation_ref':obs['observation_ref'],'entity_ref':selected['component_ref'],'signature':selected['signature'],'bbox':selected['bbox'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[selected['point_x'],selected['point_y']],'palette_value':selected['point_value'],'source':'measured_parallel_support_pair'}
  return {'status':'proposed','kind':'public_framed_transfer','actions':[action],'steps':[{'action':action,'expected_after':None,'point_binding':point_binding}],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash','levels_completed')},'framed_transfer_plan':{'offer':selected,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'conditional_framed_relation','observed':False,'things':[selected['component_ref']],'properties':{'current_measurement':selected['facts'],'projected':choice['projected'],'unknown':['control_effect','interior_rigidity','cargo_role','terminal_role'],'portable_records_not_current':len(self.portable)},'relations':['contributes_to:'+self.policy.config['goal']],'open_question':purpose}],'question':{'reason':purpose,'hypothesis_refs':[choice['projection_ref']]},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':self.policy.config['goal'],'purpose':purpose,'preconditions':facts,'evidence':evidence,'actions':[action],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def analogy(self,obs,rows,inputs,remaining):
  proposal=self.propose(obs,rows,inputs,remaining)
  if proposal:
   choice=proposal['framed_transfer_plan']['choice'];conditions=self.policy.config['early_continuation_by_projection'].get(choice['projection_ref'])
   if conditions and self.policy.holds(conditions,choice['projected']):return proposal
  return None
 def bind(self,proposal,preserve):
  if len(proposal['actions'])!=1 or proposal['actions']!=[s.get('action')for s in proposal['steps']]:raise ValueError('framed action set changed')
 def before(self,proposal,index,public,obs):
  if index!=0 or any(obs[k]!=proposal['binding'][k]for k in('observation_ref','level_epoch','frame_hash')):return {'admitted':False,'reason':'scope_or_observation_changed'}
  self.bind(proposal,None);offer=proposal['framed_transfer_plan']['offer'];action=proposal['actions'][0]
  if action!={'action_ref':self.policy.config['point_action'],'data':{'x':offer['point_x'],'y':offer['point_y']}}:return {'admitted':False,'reason':'payload_changed'}
  current=candidates(public.frame_rows,obs,self.policy,self.spans,self.receipts,{})
  matches=[o for o in current if o['candidate_ref']==offer['candidate_ref']and o['patches']==offer['patches']]
  return {'admitted':len(matches)==1 and action['action_ref']in obs['available_action_refs'],'reason':'current_parallel_support_and_payload'}
 def after(self,proposal,index,before,after,first,second):return {'matched':None,'preservation_matched':None,'seal_prefix':True,'reason':'reconcile_complete_point_transition_without_assumed_mechanics'}
 def record(self,before,after,command,first,second,proposal=None,index=0):
  self.scope(before)
  if command['action_ref']!=self.policy.config['point_action']or not command.get('data'):return None
  refs=[before['observation_ref'],after['observation_ref']]
  if before['level_epoch']!=after['level_epoch']:
   self.scope(after);return {'status':'boundary','evidence':refs,'portable_not_revalidated':True}
  relevant=proposal and'framed_transfer_plan'in proposal
  if not relevant and not self.spans and not candidates(first,before,self.policy,[],[],{}):return None
  spans,replacements=transition(first,second,before,after,command,self.policy,self.spans);derived=[]
  for key,rows,target in [('policy.record_observed_point_motion_span',spans['point_motion_span_rows'],self.spans),('policy.record_observed_framed_replacement',replacements['framed_replacement_rows'],self.receipts)]:
   for row in rows:
    result,workflow=self.policy.record(key,row)
    if result['status']=='derived':
     record={**result['record'],'evidence':refs,'derivation':{'policy':result['policy_ref'],'rule':result['rule_ref'],'event':result['event_ref'],'workflow':workflow}}
     if record not in target:target.append(record)
     derived.append(record)
  if relevant:self.attempts[proposal['framed_transfer_plan']['offer']['candidate_ref']]={'evidence':refs,'unchanged':tuple(map(tuple,first))==tuple(map(tuple,second))}
  self.last={'status':'observed_records'if derived else'no_supported_record','evidence':refs,'spans':len(spans['point_motion_span_rows']),'replacements':len(replacements['framed_replacement_rows']),'derived':derived,'scene_changed':tuple(map(tuple,first))!=tuple(map(tuple,second)),'temporal_correspondence':spans.get('temporal_correspondence'),'unresolved':'reception_or_coupled_state_change'}
  return self.last
