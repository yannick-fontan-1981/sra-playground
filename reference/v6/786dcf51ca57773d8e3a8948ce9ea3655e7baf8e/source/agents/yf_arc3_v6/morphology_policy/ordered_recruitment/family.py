from copy import deepcopy
from .geometry import measure,digest
from .projection import alternatives,summary
from .policy import RecruitmentPolicy
class OrderedRecruitment:
 def __init__(self):self.policy=RecruitmentPolicy();self.epoch=None;self.order=None;self.methods=[];self.portable=[];self.attempts={};self.continuation=None;self.last=None
 def state(self):return deepcopy({k:getattr(self,k)for k in('epoch','order','methods','portable','attempts','continuation','last')})
 def restore(self,state):
  for k in('epoch','order','methods','portable','attempts','continuation','last'):
   if k in state:setattr(self,k,deepcopy(state[k]))
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.methods:self.portable.append({'source_epoch':self.epoch,'methods':self.methods,'authority':'revisable_method_not_current_permit'})
  self.epoch=obs['level_epoch'];self.order=None;self.methods=[];self.attempts={};self.continuation=None;self.last=None
 def offers(self,obs,rows,remaining):
  m=measure(rows,self.order)
  if not m:return [],m
  methods=[e for e in self.methods if e['signature']==m['signature']]+[e for p in self.portable for e in p['methods']if e['signature']==m['signature']]
  if not methods:return [],m
  current=summary(m);kind='continuation';stored=self.continuation
  if stored and stored['steps']and stored['steps'][0]['expected_context']==current and digest(stored['legend'])==digest(m['legend'])and digest(stored['order'])==digest(m['order']):
   plans=[stored];search={'status':'validated_suffix_retained_no_new_search'}
  else:plans,search=alternatives(m,self.policy.config,obs,remaining);kind='composition_question'
  out=[]
  for plan in plans:
   if not plan['steps']or len(plan['steps'])>remaining:continue
   step=plan['steps'][0];action=step['action']
   if action['action_ref']not in obs['available_action_refs']:continue
   if step['kind']=='assign':
    buttons=[b for b in m['buttons']if b['type']==step['type']]
    if len(buttons)!=1:continue
    x,y=buttons[0]['point'];action={'action_ref':self.policy.config['point_action'],'data':{'x':x,'y':y}}
   key=digest([obs['level_epoch'],m,action])
   if key in self.attempts:continue
   out.append({'kind':kind,'key':key,'action':action,'cost':len(plan['steps']),'survivors':plan['survivors'],'facts':{'actual_interface_contrast':True,'current_scene_revalidated':True,'conditional_parent_survival':True,'untried_context':True},'measurement':m,'plan':plan,'step':step,'search':search,'method_revalidation':{'methods':methods,'signature':m['signature'],'current_epoch':obs['level_epoch'],'current_observation':obs['observation_ref'],'release_authority':False}})
  return out,m
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs)
  if remaining<1:return None
  offers,m=self.offers(obs,rows,remaining)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  o=offers[choice['index']];a=o['action'];step={'action':a,'expected_after':None};focus='composition:ordered_replenishment:'+digest([obs['level_epoch'],m['order'],o['plan']['steps']]);evidence=[obs['observation_ref'],*[ref for e in o['method_revalidation']['methods']for ref in e['evidence']]]
  if 'data'in a:
   b=next(b for b in m['buttons']if b['type']==o['step']['type']);x,y=b['point'];step['point_binding']={'entity_ref':'role_button:'+digest(b['bbox']),'observation_ref':obs['observation_ref'],'signature':digest(b),'bbox':b['bbox'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'current_button_and_legend_correspondence'}
  facts={'ordered_recruitment_current':True}
  return {'status':'proposed','kind':'public_ordered_recruitment','actions':[a],'steps':[step],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash','levels_completed')},'recruitment_plan':{'offer':o,'remaining':remaining,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'conditional_ordered_survival_and_replenishment','observed':False,'things':['rooms:'+digest(m['order']),'queue:'+digest(summary(m))],'properties':{'projection':o['plan'],'method_revalidation':o['method_revalidation'],'hypotheses':self.policy.config['hypotheses'],'unknown':['unseen_relation_outcomes','tie_outcome','full_folded_order','all_future_phase_boundaries','final_goal_law']},'relations':['contributes_to:G_official_completion'],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','purpose':choice['reason'],'preconditions':facts,'evidence':evidence,'actions':[a],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,p,preserve):
  if len(p['actions'])!=1 or p['actions']!=[s.get('action')for s in p['steps']]or p['actions']!=[p['recruitment_plan']['offer']['action']]:raise ValueError('ordered exact binding mismatch')
 def before(self,p,index,public,obs):
  if index!=0 or any(obs[k]!=p['binding'][k]for k in('observation_ref','level_epoch','frame_hash')):return {'admitted':False,'reason':'scope_changed'}
  self.bind(p,None);stored=p['recruitment_plan'];offers,m=self.offers(obs,public.frame_rows,stored['remaining']);matches=[o for o in offers if o['key']==stored['offer']['key']and digest(o)==digest(stored['offer'])]
  return {'admitted':len(matches)==1 and matches[0]['action']==p['actions'][0],'reason':'actual_front_marker_current_queues_legend_buttons_and_exact_payload'}
 def after(self,p,index,before,after,first,second):return {'matched':None,'preservation_matched':None,'seal_prefix':True,'reason':'conditional_append_or_engagement_requires_actual_return'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  self.scope(before);b=measure(first,self.order)
  if not b:return None
  if self.order is None:self.order=b['order']
  refs=[before['observation_ref'],after['observation_ref']];boundary=before['level_epoch']!=after['level_epoch'];a=None if boundary else measure(second,self.order);events=[];relevant=proposal and'recruitment_plan'in proposal
  if a and a['signature']==b['signature']:
   old=summary(b);new=summary(a)
   if old['phase']=='COMBAT'and new['phase']=='RECRUIT'and old['room']==new['room']and old['queue']==new['queue']and len(old['enemy'])==1 and not new['enemy']:
    left,right=old['queue'][0],old['enemy'][0];relation=[r for r in b['legend']['relations']if b['types'][r['left'][0]]==left and b['types'][r['right'][0]]==right]
    if len(relation)==1:
     receipt={'kind':'legend_direction_calibrated_by_actual_single_enemy_return','signature':a['signature'],'command':command,'observed_pair':[left,right],'evidence':refs,'source_epoch':before['level_epoch'],'unknown':['other_relation_outcomes','tie_outcome','full_queue_order']};self.methods.append(receipt);events.append(receipt)
   if old['phase']=='RECRUIT'and command['action_ref']==self.policy.config['point_action']and new['queue'][:-1]==old['queue']and len(new['queue'])==len(old['queue'])+1:
    events.append({'kind':'one_current_occurrence_appended','type':new['queue'][-1],'before':old,'after':new,'evidence':refs})
  if relevant:
   o=proposal['recruitment_plan']['offer'];expected=o['step']['projected_context'];actual=summary(a)if a else None;compatible=not boundary and actual==expected;self.attempts[o['key']]={'evidence':refs,'observed_context':actual,'projected_context':expected,'matched_context':compatible,'boundary':boundary}
   if compatible and len(o['plan']['steps'])>1:self.continuation={**o['plan'],'steps':o['plan']['steps'][1:],'legend':a['legend'],'order':a['order'],'evidence':refs}
   else:self.continuation=None
   events.append({'kind':'conditional_plan_reconciled','matched_context':compatible,'actual':actual,'expected':expected,'boundary':boundary,'score_delta':after['levels_completed']-before['levels_completed']})
  if not a and not boundary:self.order=None;self.continuation=None
  self.last={'status':'observed_ordered_interface'if events else'no_supported_ordered_change','events':events,'evidence':refs,'boundary':boundary,'returned_frames':len(frames or[])};result=deepcopy(self.last)
  if boundary:self.scope(after)
  return result
