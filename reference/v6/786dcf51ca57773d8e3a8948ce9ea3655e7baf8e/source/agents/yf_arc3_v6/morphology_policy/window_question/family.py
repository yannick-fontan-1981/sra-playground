from copy import deepcopy
from .geometry import measure,plans,digest
from .policy import WindowPolicy
class WindowQuestion:
 def __init__(self):self.policy=WindowPolicy();self.epoch=None;self.edits=[];self.portable=[];self.launches=[];self.attempts={};self.last=None
 def state(self):return deepcopy({k:getattr(self,k)for k in('epoch','edits','portable','launches','attempts','last')})
 def restore(self,state):
  for k in('epoch','edits','portable','launches','attempts','last'):
   if k in state:setattr(self,k,deepcopy(state[k]))
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.edits:self.portable.append({'source_epoch':self.epoch,'methods':self.edits,'launches':self.launches,'authority':'method_only_not_current_permit'})
  self.epoch=obs['level_epoch'];self.edits=[];self.launches=[];self.attempts={};self.last=None
 def offers(self,obs,rows,remaining):
  m=measure(rows)
  if not m:return [],m
  methods=[e for e in self.edits if e['signature']==m['signature']]+[e for p in self.portable for e in p['methods']if e['signature']==m['signature']]
  if not methods:return [],m
  candidates,bound=plans(m,self.policy.config['model']);out=[]
  for plan in candidates:
   if plan['cost']>remaining:continue
   edit=plan['edits'][0]if plan['edits']else None;action={'action_ref':self.policy.config['point_action'],'data':{'x':edit['point'][0],'y':edit['point'][1]}}if edit else{'action_ref':self.policy.config['launch_prior']}
   if action['action_ref']not in obs['available_action_refs']:continue
   key=digest([obs['level_epoch'],m,action]);kind='setting_question'if edit else'traversal_question'
   if key in self.attempts:continue
   out.append({'kind':kind,'key':key,'action':action,'cost':plan['cost'],'facts':{'field_control_observed':True,'current_geometry_revalidated':True,'conditional_coverage_complete':True,'cost_admissible':True,'untried_context':True},'measurement':m,'plan':plan,'edit':edit,'model':self.policy.config['model'],'method_revalidation':{'current_epoch':obs['level_epoch'],'current_observation':obs['observation_ref'],'signature':m['signature'],'methods':methods,'release_authority':False},'search':bound})
  return out,m
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs)
  if remaining<1:return None
  offers,m=self.offers(obs,rows,remaining)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  o=offers[choice['index']];a=o['action'];focus='composition:window:'+digest([obs['level_epoch'],m['signature'],o['plan']['settings']]);evidence=[obs['observation_ref'],*[ref for e in o['method_revalidation']['methods']for ref in e['evidence']]];step={'action':a,'expected_after':None}
  if o['edit']:
   b=m['boxes'][o['edit']['box']];x,y=o['edit']['point'];step['point_binding']={'entity_ref':'window:'+digest(b['bbox']),'observation_ref':obs['observation_ref'],'signature':digest(b),'bbox':b['bbox'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'current_box_field_geometry'}
  facts={'window_question_current':True}
  return {'status':'proposed','kind':'public_window_question','actions':[a],'steps':[step],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash','levels_completed')},'window_question_plan':{'offer':o,'remaining':remaining,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'conditional_window_coverage','observed':False,'things':['word:'+digest(m['word']),*['box:'+digest(b['bbox'])for b in m['boxes']]],'properties':{'coverage_hypothesis':o['plan'],'model_hypotheses':o['model'],'method_revalidation':o['method_revalidation'],'unknown':['capture_role','first_opportunity','single_use','rail_order','impulse_dependencies','painting','complete_goal_law']},'relations':['contributes_to:G_official_completion'],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','purpose':choice['reason'],'preconditions':facts,'evidence':evidence,'actions':[a],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,p,preserve):
  if len(p['actions'])!=1 or p['actions']!=[s.get('action')for s in p['steps']]or p['actions']!=[p['window_question_plan']['offer']['action']]:raise ValueError('window exact binding mismatch')
 def before(self,p,index,public,obs):
  if index!=0 or any(obs[k]!=p['binding'][k]for k in('observation_ref','level_epoch','frame_hash')):return {'admitted':False,'reason':'scope_changed'}
  self.bind(p,None);stored=p['window_question_plan'];offers,m=self.offers(obs,public.frame_rows,stored['remaining']);matches=[o for o in offers if o['key']==stored['offer']['key']and digest(o)==digest(stored['offer'])]
  return {'admitted':len(matches)==1 and matches[0]['action']==p['actions'][0],'reason':'exact_current_geometry_method_and_payload'}
 def after(self,p,index,before,after,first,second):return {'matched':None,'preservation_matched':None,'seal_prefix':True,'reason':'setting_or_traversal_is_conditional_and_requires_actual_return'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  self.scope(before);b=measure(first)
  if not b:return None
  refs=[before['observation_ref'],after['observation_ref']];boundary=before['level_epoch']!=after['level_epoch'];a=None if boundary else measure(second);events=[]
  if a and a['signature']==b['signature']and a['word']==b['word']and [z['bbox']for z in a['boxes']]==[z['bbox']for z in b['boxes']]:
   changes=[]
   for i,(old,new)in enumerate(zip(b['boxes'],a['boxes'])):
    for field in('capacity','filter','second_field'):
     if old[field]!=new[field]:changes.append({'box':i,'field':field,'before':old[field],'after':new[field]})
   if len(changes)==1:
    e={**changes[0],'command':command,'signature':a['signature'],'source_epoch':before['level_epoch'],'evidence':refs,'authority':'observed_field_change_not_capture_law'};self.edits.append(e);events.append(e)
  if frames and len(frames)>1:
   event={'command':command,'frames':len(frames),'distinct_frames':len({digest(f)for f in frames}),'signature':b['signature'],'evidence':refs,'boundary':boundary,'score_delta':after['levels_completed']-before['levels_completed'],'authority':'observed_packet_not_complete_mechanical_model'};self.launches.append(event);events.append(event)
  relevant=proposal and'window_question_plan'in proposal
  if relevant:self.attempts[proposal['window_question_plan']['offer']['key']]={'evidence':refs,'events':events}
  self.last={'status':'observed_window_interface'if events else'no_supported_window_change','events':events,'evidence':refs,'boundary':boundary};result=deepcopy(self.last)
  if boundary:self.scope(after)
  return result
