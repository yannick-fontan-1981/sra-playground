from .geometry import acquire,current,connected,digest,paired_profiles,equality_pattern
from .policy import RegionPolicy
from copy import deepcopy
class RegionIntervention:
 def __init__(self):self.policy=RegionPolicy();self.epoch=None;self.layout=None;self.method=[];self.focus=[];self.effects=[];self.attempts={};self.portable=[];self.invalidations=[];self.preparations=[];self.recall_disabled=False
 def state(self):return {k:deepcopy(getattr(self,k))for k in('epoch','layout','method','focus','effects','attempts','portable','invalidations','preparations','recall_disabled')}
 def restore(self,s):
  for k,v in s.items():setattr(self,k,deepcopy(v))
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.method:self.portable.append({'source_epoch':self.epoch,'method':self.method,'effects':self.effects[-4:],'preparations':self.preparations,'status':'historical_not_current_permit'})
  self.epoch=obs['level_epoch'];self.layout=None;self.method=[];self.focus=[];self.effects=[];self.attempts={};self.preparations=[];self.recall_disabled=False
 def measured(self,obs,rows):
  self.scope(obs)
  if self.layout is None:self.layout=acquire(rows,obs)
  return current(self.layout,rows)if self.layout else None
 def offers(self,obs,rows):
  view=self.measured(obs,rows)
  if view is None:return []
  context=digest(view);out=[]
  if self.method and self.focus:
   reached,proof=connected(self.layout,view,self.focus)
   for g in view['gates']:
    if not any(m['signature']=={'radius':g['radius'],'axis':g['axis'],'values':g['closed_values']}for m in self.method):continue
    if g['open']or sum(i in reached for i in g['regions'])!=1 or context+g['ref']in self.attempts:continue
    outside=next(i for i in g['regions']if i not in reached);bodies=[b for b in view['bodies']if b['region']==outside]
    out.append({'kind':'populated_frontier'if bodies else'unpopulated_frontier','facts':{'control_method_supported':True,'observed_effect_available':bool(self.effects),'current_separator':True,'frontier_linked':True},'center':g['center'],'gate':g,'reached_regions':reached,'target_region':outside,'outside_occurrences':bodies,'graph_proof':proof,'context':context,'method':self.method,'effects':self.effects[-4:],'unknown':['identity_through_recolor_or_consumption','goal_role','global_phase_order','actor_access','quota_and_inventory'],'historical_portable_not_used':True})
  recalled=[]
  for history in ([]if self.recall_disabled else self.portable):
   for method in history.get('preparations',[]):
    for g in view['gates']:
     if g['open']or context+g['ref']in self.attempts:continue
     control={'radius':g['radius'],'axis':g['axis'],'equality_pattern':equality_pattern(g['closed_values'])}
     for profile in paired_profiles(self.layout,view,g):
      facts={'control_method_supported':control==method['control'],'observed_effect_available':bool(method['evidence']),'current_separator':True,'profile_relation_revalidated':self.policy.admits('preparation_learning',profile['facts']),'current_analogy_unique':False,'target_cardinality_retained':profile['target_count']==method['profile']['target_count'],'areas_retained':profile['source_area']==method['profile']['source_area']and profile['target_area']==method['profile']['target_area'],'control_shape_revalidated':control==method['control']}
      if self.policy.admits('recall_candidates',facts):
       recalled.append({'kind':'recalled_preparation','facts':facts,'center':g['center'],'gate':g,'reached_regions':profile['source_regions'],'target_region':profile['target_regions'],'outside_occurrences':profile['target_occurrences'],'graph_proof':profile['graph_proofs'],'context':context,'method':[method],'effects':[],'current_profile':profile,'source_epoch':history['source_epoch'],'unknown':['global_effect_in_new_context','identity_through_appearance_change','predation_law','terminal_necessity'],'historical_portable_not_used':False})
  distinct={(tuple(o['center']),tuple(o['reached_regions']))for o in recalled}
  for o in recalled:o['facts']['current_analogy_unique']=len(distinct)==1
  equivalent={}
  for o in recalled:
   key=digest({k:o[k]for k in ('kind','facts','center','gate','reached_regions','target_region','context','current_profile','unknown')})
   if key not in equivalent:equivalent[key]={**o,'source_epochs':[o['source_epoch']]}
   else:
    equivalent[key]['method'].extend(o['method']);equivalent[key]['source_epochs'].append(o['source_epoch'])
  out.extend(equivalent.values());return out
 def propose(self,obs,rows,inputs,remaining):
  if remaining<1:return None
  offers=self.offers(obs,rows)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  o=offers[choice['index']];x,y=o['center'];a={'action_ref':self.policy.config['point_action'],'data':{'x':int(x),'y':int(y)}};focus='composition:region-intervention:'+digest([obs['level_epoch'],o['gate']['ref'],o['context']]);evidence=[obs['observation_ref'],*self.layout['evidence'],*[r for m in o['method']for r in m['evidence']]];facts={'regional_intervention_current':True}
  return {'status':'proposed','kind':'public_region_intervention','actions':[a],'steps':[{'action':a,'expected_after':None,'point_binding':{'entity_ref':o['gate']['ref'],'observation_ref':obs['observation_ref'],'signature':digest(o['gate']),'bbox':[x,y,x,y],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'current_measured_separator'}}],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash')},'region_plan':{'offer':o,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'conditional_regional_opportunity','observed':False,'things':[o['gate']['ref']],'properties':o,'relations':['contributes_to:'+self.policy.config['goal']],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':self.policy.config['goal'],'purpose':choice['reason'],'preconditions':facts,'evidence':evidence,'actions':[a],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,p,preserve):
  if len(p['actions'])!=1 or p['actions']!=[s.get('action')for s in p['steps']]:raise ValueError('regional actionset mismatch')
 def before(self,p,index,public,obs):
  self.bind(p,None)
  if index!=0 or any(obs[k]!=p['binding'][k]for k in('observation_ref','level_epoch','frame_hash')):return {'admitted':False,'reason':'scope_changed'}
  o=p['region_plan']['offer'];matches=[a for a in self.offers(obs,public.frame_rows)if a['gate']==o['gate']and a['center']==o['center']and a['context']==o['context']and a['reached_regions']==o['reached_regions']]
  return {'admitted':len(matches)==1 and p['actions']==[{'action_ref':self.policy.config['point_action'],'data':{'x':o['center'][0],'y':o['center'][1]}}],'reason':'current_separator_and_observed_effect_region_revalidated'}
 def after(self,p,index,before,after,first,second):return {'matched':None,'preservation_matched':None,'seal_prefix':True,'reason':'global_autonomous_effect_unknown'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  v=self.measured(before,first)
  if before['level_epoch']!=after['level_epoch']:
   event={'status':'official_boundary','evidence':[before['observation_ref'],after['observation_ref']],'score_delta':after['levels_completed']-before['levels_completed'],'new_epoch_not_old_scope_effect':True};self.scope(after);return event
  if v is None:return None
  w=current(self.layout,second)
  if w is None:
   event={'status':'layout_contradicted','evidence':[before['observation_ref'],after['observation_ref']],'old_method':self.method,'old_effects':self.effects};self.invalidations.append(event);self.layout=None;self.method=[];self.focus=[];self.effects=[];self.preparations=[];self.recall_disabled=True;return event
  data=command.get('data',{});center=[data.get('x'),data.get('y')];clicked=[g for g in v['gates']if g['center']==center];changes=[g for g,h in zip(v['gates'],w['gates'])if g['open']!=h['open']];regions=[];before_by={str(i):[b for b in v['bodies']if b['region']==i]for i in range(len(self.layout['regions']))};after_by={str(i):[b for b in w['bodies']if b['region']==i]for i in range(len(self.layout['regions']))}
  for i in before_by:
   if before_by[i]!=after_by[i]:regions.append(int(i))
  evidence=[before['observation_ref'],after['observation_ref']]
  if command.get('action_ref')==self.policy.config['point_action']and len(clicked)==1 and len(changes)==1 and clicked[0]['ref']==changes[0]['ref']:
   receipt={'site':center,'signature':{'radius':clicked[0]['radius'],'axis':clicked[0]['axis'],'values':clicked[0]['closed_values']},'evidence':evidence,'local_toggle_observed':True};self.method.append(receipt)
   if regions:
    for profile in paired_profiles(self.layout,v,clicked[0]):
     if self.policy.admits('preparation_learning',profile['facts']):
      self.preparations.append({'profile':profile,'control':{'radius':clicked[0]['radius'],'axis':clicked[0]['axis'],'equality_pattern':equality_pattern(clicked[0]['closed_values'])},'evidence':evidence,'effect_regions':regions,'meaning':'observed_regional_change_not_predation_or_goal_law'})
    self.focus=regions;self.effects.append({'regions':regions,'before':before_by,'after':after_by,'evidence':evidence,'occurrence_identity_and_cause_unknown':True})
  if proposal and'region_plan'in proposal:self.attempts[proposal['region_plan']['offer']['context']+proposal['region_plan']['offer']['gate']['ref']]={'evidence':evidence,'changed_regions':regions}
  return {'status':'observed_regional_response','local_separator_changes':[g['ref']for g in changes],'changed_occurrence_regions':regions,'evidence':evidence,'global_response_not_predation_law':True}
