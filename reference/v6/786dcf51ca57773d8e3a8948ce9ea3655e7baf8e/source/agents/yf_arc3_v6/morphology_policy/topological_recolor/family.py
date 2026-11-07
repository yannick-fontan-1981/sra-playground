from copy import deepcopy
from .geometry import measure,digest,selection_support_signature
from .policy import RecolorPolicy
class TopologicalRecolor:
 def __init__(self):self.policy=RecolorPolicy();self.epoch=None;self.selection=[];self.writes=[];self.attempts={};self.portable=[];self.last=None
 def state(self):return deepcopy({k:getattr(self,k)for k in('epoch','selection','writes','attempts','portable','last')})
 def restore(self,state):
  for k in('epoch','selection','writes','attempts','portable','last'):
   if k in state:setattr(self,k,deepcopy(state[k]))
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.selection or self.writes:self.portable.append({'source_epoch':self.epoch,'selection':self.selection,'writes':self.writes,'authority':'method_hypothesis_not_current_permit'})
  self.epoch=obs['level_epoch'];self.selection=[];self.writes=[];self.attempts={};self.last=None
 def revalidate_selection(self,m,obs):
  current=selection_support_signature(m)
  if not current['one_distinct_indicator']or not current['uniform_well_bodies']or self.policy.config['point_action']not in obs['available_action_refs']:return None
  for source in [*self.selection,*[r for p in self.portable for r in p['selection']]]:
   if source.get('method_signature')==current and source.get('action_ref')==self.policy.config['point_action']and len(source.get('evidence',[]))==2:
    return {'source_evidence':source['evidence'],'source_epoch':source['source_epoch'],'current_observation_ref':obs['observation_ref'],'current_epoch':obs['level_epoch'],'current_frame_hash':obs['frame_hash'],'method_signature':current,'command_ref':source['action_ref'],'status':'current_supports_match_observed_selection_method','law_status':'revisable_transfer_hypothesis','release_authority':False}
  return None
 def offers(self,obs,rows):
  m=measure(rows,obs,self.writes)
  if not m:return [],None
  revalidation=self.revalidate_selection(m,obs);supported=revalidation is not None;out=[]
  for b in m['bodies']:
   if b['value']==b['target']:continue
   needed=m['active']!=b['target']or not supported;mode='select_pigment'if needed else'paint_region';well=next(c for c in m['wells']if c['value']==b['target']);site=well if needed else b;x,y=(int((site['bbox'][0]+site['bbox'][2])//2),int((site['bbox'][1]+site['bbox'][3])//2));x,y=(x,y)if(x,y)in set(map(tuple,site['cells']))else site['cells'][0];key=digest([obs['level_epoch'],mode,site['cells'],b['cells'],b['value'],b['target'],m['mapping'],m['active']])
   if key in self.attempts:continue
   out.append({'key':key,'mode':mode,'point':[x,y],'site':site,'body':b,'measurement':m,'facts':{'target_differs':True,'selection_needed':needed,'selection_method_supported':supported,'relation_kind':b.get('relation_kind','shell'),'shells_currently_match':b.get('shells_currently_match',False),'partial_topology':b.get('partial_topology',False)},'signature':digest(site),'method_revalidation':revalidation})
  return out,m
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs);a=self.policy.config['point_action']
  if remaining<1 or a not in obs['available_action_refs']:return None
  offers,m=self.offers(obs,rows)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  s=offers[choice['index']];x,y=s['point'];action={'action_ref':a,'data':{'x':x,'y':y}};facts={'topological_relation_current':True};focus='composition:recolor:'+s['key'];evidence=[obs['observation_ref'],*(s['method_revalidation']['source_evidence']if s['method_revalidation']else []),*[ref for r in self.writes if r.get('source_epoch')==obs['level_epoch']for ref in r['evidence']]]
  return {'status':'proposed','kind':'public_topological_recolor','actions':[action],'steps':[{'action':action,'expected_after':None,'point_binding':{'entity_ref':'region:'+s['signature'],'observation_ref':obs['observation_ref'],'signature':s['signature'],'bbox':s['site']['bbox'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'current_topological_correspondence'}}],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash','levels_completed')},'recolor_plan':{'offer':s,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'hypothetical_topological_recolor','observed':False,'things':['region:'+s['signature']],'properties':{'pocket_count':s['body']['pocket_count'],'topology_scope':s['body']['evidence'].get('scope','complete_visible_region'),'partial_topology':s['body'].get('partial_topology',False),'correspondence_relation':s['body'].get('relation_kind','shell'),'target_pigment':s['body']['target'],'goal_hypothesis':True,'selection_supported':s['facts']['selection_method_supported'],'method_revalidation':s['method_revalidation'],'partition_write_evidence':[r['evidence']for r in self.writes if r.get('source_epoch')==obs['level_epoch']],'unknown':['write_scope','acceptance_rule','hidden_partition'],'portable_not_permit':len(self.portable)},'relations':['contributes_to:'+self.policy.config['goal']],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':self.policy.config['goal'],'purpose':choice['reason'],'preconditions':facts,'evidence':evidence,'actions':[action],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,proposal,preserve):
  if len(proposal['actions'])!=1 or proposal['actions']!=[s.get('action')for s in proposal['steps']]:raise ValueError('recolor exact action mismatch')
 def before(self,proposal,index,public,obs):
  if index!=0 or any(obs[k]!=proposal['binding'][k]for k in('observation_ref','level_epoch','frame_hash')):return {'admitted':False,'reason':'scope_changed'}
  self.bind(proposal,None);s=proposal['recolor_plan']['offer'];a={'action_ref':self.policy.config['point_action'],'data':dict(zip(('x','y'),s['point']))}
  offers,m=self.offers(obs,public.frame_rows);matches=[o for o in offers if o['key']==s['key']and o['signature']==s['signature']]
  return {'admitted':len(matches)==1 and a==proposal['actions'][0]and a['action_ref']in obs['available_action_refs'],'reason':'current_partition_topology_and_exact_point'}
 def after(self,proposal,index,before,after,first,second):
  s=proposal['recolor_plan']['offer'];m=s['measurement'];allowed=set(map(tuple,s['body']['cells']))if s['mode']=='paint_region'else{(x,y)for w in m['wells']for y in range(w['bbox'][1]-1,w['bbox'][3]+2)for x in range(w['bbox'][0]-1,w['bbox'][2]+2)}
  changed={(x,y)for y in range(len(first))for x in range(len(first[y]))if first[y][x]!=second[y][x]};outside=changed-allowed
  return {'matched':None,'preservation_matched':not outside,'seal_prefix':True,'reason':'unknown_effect_measured_not_goal_confirmation','changed_count':len(changed),'outside_count':len(outside)}
 def record(self,before,after,command,first,second,proposal=None,index=0):
  self.scope(before);refs=[before['observation_ref'],after['observation_ref']]
  if before['level_epoch']!=after['level_epoch']:self.scope(after);return {'status':'boundary','evidence':refs,'goal_scope':'acceptance_only_for_completed_configuration'}
  relevant=proposal and 'recolor_plan'in proposal
  if not relevant:return None
  s=proposal['recolor_plan']['offer'];m=measure(second,after,self.writes);changed=[(x,y)for y in range(len(first))for x in range(len(first[y]))if first[y][x]!=second[y][x]];result=self.after(proposal,index,before,after,first,second);status='unknown_or_no_visible_effect'
  if s['mode']=='select_pigment'and m and m['active']==s['body']['target']and changed and result['preservation_matched']:
   self.selection.append({'evidence':refs,'point':s['point'],'pigment':m['active'],'scope':'well_point_selection_observed','method_signature':selection_support_signature(m),'action_ref':command['action_ref'],'source_epoch':after['level_epoch'],'partition_signature':digest([m['field'],m['legend'],m['mapping']])});status='selection_observed'
  if s['mode']=='paint_region'and changed:
   expected=set(map(tuple,s['body']['cells']));painted={(x,y)for x,y in changed if second[y][x]==s['body']['target']};self.writes.append({'evidence':refs,'seed':s['point'],'pigment':s['body']['target'],'changed_mask':changed,'same_component_scope':set(changed)==expected,'only_target_pigment':len(painted)==len(changed),'outside_count':result['outside_count'],'goal_confirmed':False,'source_epoch':before['level_epoch'],'partition_binding':{k:s['measurement'][k]for k in('field','legend','separator','mapping')}});status='write_effect_observed'
  self.attempts[s['key']]={'evidence':refs,'status':status};self.last={'status':status,'evidence':refs,'changed_count':len(changed),'comparison':result,'goal_hypothesis':True};return self.last
