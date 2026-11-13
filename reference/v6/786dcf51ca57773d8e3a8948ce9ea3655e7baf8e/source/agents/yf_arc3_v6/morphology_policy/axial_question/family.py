from copy import deepcopy
from .geometry import measure,relations,projected_turns,digest
from .policy import AxialPolicy
class AxialQuestion:
 def __init__(self):self.policy=AxialPolicy();self.epoch=None;self.selection=None;self.rotations=[];self.portable=[];self.attempts={};self.last=None
 def state(self):return deepcopy({k:getattr(self,k)for k in('epoch','selection','rotations','portable','attempts','last')})
 def restore(self,state):
  for k in('epoch','selection','rotations','portable','attempts','last'):
   if k in state:setattr(self,k,deepcopy(state[k]))
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.rotations:self.portable.append({'source_epoch':self.epoch,'methods':self.rotations,'authority':'revisable_method_not_current_permit'})
  self.epoch=obs['level_epoch'];self.selection=None;self.rotations=[];self.attempts={};self.last=None
 def method_signature(self,m):return {'size':m['quantum'],'opposed_distinct_bars':True,'core_side_distinct':m['bodies'][0]['core']!=m['bodies'][0]['side']}
 def offers(self,obs,rows):
  m=measure(rows)
  if not m or not m['selected']or m['ambiguous_selection']or not self.selection:return [],m
  actor=m['selected'];selected=self.selection
  if selected['epoch']!=obs['level_epoch']or actor['center']!=selected['center']or actor['marker']!=selected['marker']or self.method_signature(m)!=selected['signature']:return [],m
  cfg=self.policy.config;cycle=cfg['cycle'];projections=projected_turns(m,actor,cycle);out=[]
  methods=[*[r for p in self.portable for r in p['methods']],*self.rotations]
  for rel in relations(m,actor):
   declared=cfg['desired_axis_relation'][rel['kind']];rel={**rel,'desired_axis':[declared['multiplier']*v for v in rel['peer']['axis']],'direction_hypothesis':declared['hypothesis']}
   if rel['desired_axis']==actor['axis']:continue
   for prior in cfg['rotation_priors']:
    if prior['action']not in obs['available_action_refs']:continue
    turn=prior['turn'];method=next((r for r in reversed(methods)if r['action']==prior['action']and r['signature']==self.method_signature(m)and len(r['evidence'])>=2),None)
    if method:turn=method['turn']
    projected=next(p for p in projections if p['turn']==turn);distance=((cycle.index(rel['desired_axis'])-cycle.index(actor['axis']))*turn)%len(cycle);key=digest([obs['level_epoch'],m['target'],[(b['center'],b['axis'],b['marker'])for b in m['bodies']],prior['action'],rel['kind']])
    if not distance or key in self.attempts:continue
    out.append({'kind':rel['kind'],'facts':{'selection_attested_current':True,'goal_marker_unique':True,'scope_current':True},'quarter_distance':distance,'recalled_control_first':0 if method else 1,'action':prior['action'],'turn':turn,'projection':projected,'relation':rel,'measurement':m,'actor':actor,'key':key,'selection_evidence':selected['evidence'],'method_revalidation':{'method':method,'current_observation_ref':obs['observation_ref'],'current_epoch':obs['level_epoch'],'current_frame_hash':obs['frame_hash'],'current_signature':self.method_signature(m),'status':'current_support_and_command_match','release_authority':False}if method else None})
  return out,m
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs)
  if remaining<1:return None
  offers,m=self.offers(obs,rows)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  s=offers[choice['index']];a={'action_ref':s['action']};focus='composition:axial:'+digest([obs['level_epoch'],self.selection['evidence'][0],m['target'],s['kind']]);facts={'axial_question_current':True};evidence=[obs['observation_ref'],*s['selection_evidence'],*(s['method_revalidation']['method']['evidence']if s['method_revalidation']else [])]
  return {'status':'proposed','kind':'public_axial_question','actions':[a],'steps':[{'action':a,'expected_after':None}],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash','levels_completed')},'axial_plan':{'offer':s,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'conditional_axial_configuration','observed':False,'things':['selected:'+digest(s['actor']['center']),'peer:'+digest(s['relation']['peer']['center'])],'properties':{'relation':s['relation'],'orientation_projection':s['projection'],'method_revalidation':s['method_revalidation'],'goal_hypothesis':True,'unknown':['command_rotation_until_observed','interaction_direction_until_observed','wall_transmission','force_law','terminal_stability','recipient_identity']},'relations':['contributes_to:'+self.policy.config['goal']],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':self.policy.config['goal'],'purpose':choice['reason'],'preconditions':facts,'evidence':evidence,'actions':[a],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,proposal,preserve):
  if len(proposal['actions'])!=1 or proposal['actions']!=[s.get('action')for s in proposal['steps']]:raise ValueError('axial exact action set mismatch')
 def before(self,proposal,index,public,obs):
  if index!=0 or any(obs[k]!=proposal['binding'][k]for k in('observation_ref','level_epoch','frame_hash')):return {'admitted':False,'reason':'scope_changed'}
  self.bind(proposal,None);s=proposal['axial_plan']['offer'];offers,m=self.offers(obs,public.frame_rows);match=[o for o in offers if o['key']==s['key']and o['measurement']==s['measurement']]
  return {'admitted':len(match)==1 and proposal['actions']==[{'action_ref':s['action']}],'reason':'selected_marker_body_peer_target_and_command_current'}
 def after(self,proposal,index,before,after,first,second):return {'matched':None,'preservation_matched':None,'seal_prefix':True,'reason':'conditional_rotation_and_global_effect_require_sealed_public_return'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  self.scope(before);b=measure(first)
  if not b:return None
  refs=[before['observation_ref'],after['observation_ref']];boundary=before['level_epoch']!=after['level_epoch'];a=measure(second);relevant=proposal and'axial_plan'in proposal
  observed=[]
  for ordinal,frame in enumerate(frames or [second]):
   try:sample=measure(frame)
   except(TypeError,IndexError):continue
   if sample and sample['grid_bounds']==b['grid_bounds']and sample['target']==b['target']and len(sample['bodies'])==len(b['bodies']):observed.append((ordinal,sample,frame))
  if observed:ordinal,a,physical=observed[-1]
  elif boundary:a=None
  else:ordinal=0;physical=second
  events=[]
  if a:
   changes=[(x,y)for y in range(len(first))for x in range(len(first[y]))if first[y][x]!=physical[y][x]]
   if b['selected']is None and a['selected']and not a['ambiguous_selection']and len(changes)==1 and changes[0]==tuple(a['selected']['center'])and [(z['center'],z['axis'],z['signature'])for z in a['bodies']]==[(z['center'],z['axis'],z['signature'])for z in b['bodies']]:
    self.selection={'center':a['selected']['center'],'marker':a['selected']['marker'],'signature':self.method_signature(a),'epoch':before['level_epoch'],'evidence':refs,'source_action':command};events.append('selection_marker_changed_under_input')
   if relevant and b['selected']and a['selected']and self.method_signature(a)==self.method_signature(b):
    cycle=self.policy.config['cycle'];delta=(cycle.index(a['selected']['axis'])-cycle.index(b['selected']['axis']))%len(cycle)
    if delta in(1,len(cycle)-1):
     turn=1 if delta==1 else-1;receipt={'action':command['action_ref'],'turn':turn,'signature':self.method_signature(a),'source_epoch':before['level_epoch'],'evidence':[*refs,'returned-frame:'+digest(physical)],'frame_ordinal':ordinal,'boundary':boundary,'unknown':['quantitative_interaction','wall_transmission','complete_goal_law']};self.rotations.append(receipt);events.append('quarter_rotation_observed')
    if self.selection:self.selection={**self.selection,'center':a['selected']['center'],'marker':a['selected']['marker'],'current_evidence':refs}
    events.append({'joint_positions_before':[z['center']for z in b['bodies']],'joint_positions_after':[z['center']for z in a['bodies']],'sealed_score_delta':after['levels_completed']-before['levels_completed']})
   if not a['selected']:self.selection=None
  if relevant:self.attempts[proposal['axial_plan']['offer']['key']]={'evidence':refs,'events':events}
  self.last={'status':'observed_axial_contrast'if events else'no_supported_axial_contrast','events':events,'evidence':refs,'boundary':boundary,'goal_supported_only_by_official_score':after['levels_completed']>before['levels_completed']}
  result=deepcopy(self.last)
  if boundary:self.scope(after)
  return result
