from copy import deepcopy
from .geometry import acquire,current,joint_plan,digest,tile,affected_component,remaining_group_hypothesis,group_plan,merged_marker_hypothesis,assignment_hypotheses,prioritize_source_fusions,contrary_assignment
from .policy import ChannelPolicy

def equality(t):
 values=[];out=[]
 for row in t:
  r=[]
  for v in row:
   if v not in values:values.append(v)
   r.append(values.index(v))
  out.append(r)
 return out

class JointChannels:
 def __init__(self):self.policy=ChannelPolicy();self.epoch=None;self.layout=None;self.refusals=[];self.methods=[];self.portable=[];self.events=[];self.failed=[];self.invalid=False;self.cache=None;self.plan=None;self.plan_refutations=[]
 def state(self):return {k:deepcopy(getattr(self,k))for k in('epoch','layout','refusals','methods','portable','events','failed','invalid','plan','plan_refutations')}
 def restore(self,s):
  for k,v in s.items():setattr(self,k,deepcopy(v))
  self.cache=None
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.methods:self.portable.append({'source_epoch':self.epoch,'methods':deepcopy(self.methods),'status':'method_not_current_permit'})
  self.epoch=obs['level_epoch'];self.layout=None;self.refusals=[];self.methods=[];self.events=[];self.failed=[];self.invalid=False;self.cache=None;self.plan=None;self.plan_refutations=[]
 def measured(self,obs,rows):
  self.scope(obs)
  if self.invalid:return None
  if self.layout is None:
   self.layout=acquire(rows,obs)
   if self.layout:
    augmented=merged_marker_hypothesis(self.layout);hyp=augmented.get('merged_marker_hypothesis')
    if hyp and self.policy.admits('merged_marker_hypothesis',hyp['facts']):self.layout=augmented
  return current(self.layout,rows)if self.layout else None
 def offers(self,obs,rows,remaining):
  v=self.measured(obs,rows)
  if v is None:return []
  refused=any(q['pattern']==self.layout['blocked_pattern']for q in self.refusals)
  sample=next((c for c in v if c['class']=='candidate_edit'and not c['opened']),None)
  if not sample:return []
  recalled=[m for h in self.portable for m in h['methods']if m['pattern_equality']==equality(sample['tile'])and m['action_ref']==self.policy.config['point_action']]
  if not(refused or self.methods or recalled):return []
  if self.failed:return [] # local counterexample requires a new topology question, not silent obstacle promotion
  key=digest([obs['level_epoch'],rows])
  if self.plan is None:
   cfg=self.policy.config['planning'];q=joint_plan(self.layout,v,cfg['work_limit'],cfg['path_limit'])
   methods=self.methods+[m for h in self.portable for m in h['methods']]
   hypothesis=remaining_group_hypothesis(v,methods)if q is None else None
   if hypothesis and self.policy.admits('source_subset_experiment',{'one_current_subset':len(hypothesis['remaining_alternatives'])==1,'singleton_exclusions_observed':bool(hypothesis['rejected_under_observed_stable_output_model']),'current_point_method':bool(self.methods or recalled)}):q=group_plan(self.layout,v,hypothesis,cfg['group_work_limit'],cfg['path_limit'])
   if q is None and (self.methods or recalled):
    domain=assignment_hypotheses(v,methods,cfg['assignment_bound'])
    if domain:
     found=[];summaries=[]
     for ordinal,a in enumerate(domain['assignments']):
      if any(set(g['sources'])==set(ref['sources'])and g['target']==ref['target']for g in a['groups']for ref in self.plan_refutations):continue
      alternative=group_plan(self.layout,v,a,cfg['group_work_limit'],cfg['path_limit']);summaries.append({'ordinal':ordinal,'groups':a['groups'],'status':'conditional_plan_found'if alternative else'bounded_search_unresolved','cost':alternative['total_cost']if alternative else None})
      if alternative and alternative['next']:found.append(alternative)
     q=self.policy.choose_assignment(found)
     if q and self.policy.config.get('assignment_execution_order')=='source_fusion_before_receiver_when_existing_joint_paths_allow':q=prioritize_source_fusions(q)
     if q:q={**q,'assignment_portfolio':{'domain':domain,'results':summaries,'selection_authority':self.policy.config['assignment_order'],'unresolved_not_falsified':True},'merged_marker_hypothesis':self.layout.get('merged_marker_hypothesis')}
   if q:self.plan={**q,'initial_opened':[c['ref']for c in v if c['opened']],'acquisition_evidence':[obs['observation_ref']]}
  if not self.plan:return []
  opened={c['ref']for c in v if c['opened']}
  if not opened<=set(self.plan['initial_opened'])|set(self.plan['excavations']):
   self.invalid=True;return []
  remaining_cells=[r for r in self.plan['excavations']if r not in opened]
  if not remaining_cells:return []
  c=next(c for c in v if c['ref']==remaining_cells[0]);q={**deepcopy(self.plan),'next':c,'excavations':remaining_cells,'total_cost':len(remaining_cells),'continuation_of_retained_joint_plan':True};kind='joint_assignment_experiment'if q.get('assignment_portfolio')else'source_subset_experiment'if q.get('source_group_hypothesis')else'current_method'if self.methods else'recalled_method'if recalled else'contrast_class'
  facts={'grid_unique':True,'joint_feasible':True,'currently_bound':True,'financed':q['total_cost']<=remaining,'observed_edit':bool(self.methods),'method_revalidated':bool(recalled),'local_refusal_contrast':refused,'one_current_subset':bool(q.get('source_group_hypothesis')),'singleton_exclusions_observed':bool(q.get('source_group_hypothesis',{}).get('rejected_under_observed_stable_output_model')),'current_point_method':bool(self.methods or recalled),'portfolio_retained':bool(q.get('assignment_portfolio'))}
  return [{'kind':kind,'facts':facts,'center':c['point'],'cell':c,'plan':q,'context':key,'method':self.methods or recalled,'refusals':self.refusals,'unknown':['target_role','mixture_laws','internal_resource_quantity','unentered_terrain_affordance'],'recalled_method_used':bool(recalled)and not self.methods}]
 def propose(self,obs,rows,inputs,remaining,forecast=None):
  if self.policy.config['point_action']not in obs['available_action_refs']:return None
  current_forecast=bool(forecast and forecast.get('observation_ref')==obs['observation_ref']and forecast.get('level_epoch')==obs['level_epoch'])
  financing=min(remaining,max(0,int(forecast['steps_before_empty'])-1))if current_forecast else remaining
  offers=self.offers(obs,rows,financing)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  o=offers[choice['index']];x,y=o['center'];a={'action_ref':self.policy.config['point_action'],'data':{'x':int(x),'y':int(y)}};focus='composition:joint-channels:'+digest([obs['level_epoch'],o['context']]);evidence=[obs['observation_ref'],*self.layout['evidence'],*[r for m in o['method']for r in m['evidence']],*[r for m in self.refusals for r in m['evidence']]];facts={'joint_channel_question_current':True}
  return {'status':'proposed','kind':'public_joint_channels','actions':[a],'steps':[{'action':a,'expected_after':None,'point_binding':{'entity_ref':'cell:'+o['cell']['ref'],'observation_ref':obs['observation_ref'],'signature':digest(o['cell']),'bbox':o['cell']['bbox'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'current_joint_residual_cell'}}],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash')},'channel_plan':{'offer':o,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash,'remaining':financing,'forecast':forecast if current_forecast else None},'compositions':[{'id':focus,'role':'conditional_joint_connections','observed':False,'things':[p for pair in o['plan']['hypothetical_pairs']for p in pair[:2]],'properties':o,'relations':['contributes_to:'+self.policy.config['goal']],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':self.policy.config['goal'],'purpose':choice['reason'],'preconditions':facts,'evidence':evidence,'actions':[a],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,p,preserve):
  if len(p['actions'])!=1 or p['actions']!=[s.get('action')for s in p['steps']]:raise ValueError('joint channel actionset mismatch')
 def before(self,p,index,public,obs):
  self.bind(p,None)
  if index!=0 or any(obs[k]!=p['binding'][k]for k in('observation_ref','level_epoch','frame_hash')):return {'admitted':False,'reason':'scope_changed'}
  o=p['channel_plan']['offer'];matches=[a for a in self.offers(obs,public.frame_rows,p['channel_plan']['remaining'])if a['cell']==o['cell']and a['center']==o['center']and a['context']==o['context']]
  return {'admitted':len(matches)==1 and p['actions']==[{'action_ref':self.policy.config['point_action'],'data':{'x':matches[0]['center'][0],'y':matches[0]['center'][1]}}],'reason':'current_joint_residual_and_exact_cell_revalidated'}
 def after(self,p,index,before,after,first,second):
  v=current(self.layout,second)if before['level_epoch']==after['level_epoch']else None
  prior=current(self.layout,first)if v else None
  allowed=affected_component(self.layout,prior,p['channel_plan']['offer']['cell']['ref'])if prior else set()
  preserved=bool(v)and all(a['current_tile']==b['current_tile']or a['ref']in allowed for a,b in zip(prior or [],v or []))
  return {'matched':None,'preservation_matched':preserved if before['level_epoch']==after['level_epoch']else None,'seal_prefix':True,'reason':'local_opening_and_component_response_to_measure_not_goal_prediction'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  v=self.measured(before,first)
  if before['level_epoch']!=after['level_epoch']:
   event={'status':'official_boundary','evidence':[before['observation_ref'],after['observation_ref']],'score_delta':after['levels_completed']-before['levels_completed'],'new_scope_not_old_effect':True};self.scope(after);return event
  if v is None:return None
  data=command.get('data',{});x=data.get('x');y=data.get('y');clicked=[c for c in v if x is not None and y is not None and c['bbox'][0]<=x<=c['bbox'][2]and c['bbox'][1]<=y<=c['bbox'][3]];evidence=[before['observation_ref'],after['observation_ref']]
  if command['action_ref']!=self.policy.config['point_action']or len(clicked)!=1:return None
  c=clicked[0];aftertile=tile(second,c['bbox']);changed=aftertile!=c['current_tile'];transient=any(tile(f,c['bbox'])!=c['current_tile']for f in(frames or []))
  if not changed and transient:self.refusals.append({'cell':c['ref'],'pattern':c['current_pattern'],'evidence':evidence,'meaning':'local_transient_return_not_universal_hardness'})
  w=current(self.layout,second)
  if w is None:self.invalid=True;event={'status':'layout_or_marker_contradicted','evidence':evidence};self.events.append(event);return event
  opened=[d['ref']for a,d in zip(v,w)if not a['opened']and d['opened']]
  if c['class']=='candidate_edit'and opened==[c['ref']]:
   m={'action_ref':command['action_ref'],'pattern_equality':equality(c['tile']),'evidence':evidence,'cell':c['ref'],'meaning':'point_opened_local_cell_other_effects_not_goal_law'};component=affected_component(self.layout,v,c['ref']);originals=sorted({a['marker']['pigment']for a in v if a['ref']in component and a['marker']and a['marker']['kind']=='cross'})
   displayed={val for row in aftertile for val in row}
   m['equilibria']=[{'original_source_set':originals,'source_occurrences':[{'ref':a['ref'],'role_status':a['marker'].get('role_status','measured_contrasted_marker')}for a in v if a['ref']in component and a['marker']and a['marker']['kind']=='cross'],'provenance_status':'hypothetical_merged_marker'if any(a['ref']in component and a['marker']and a['marker'].get('role_status')for a in v)else'measured_contrasted_markers','display_value':next(iter(displayed)),'evidence':evidence,'scope':'observed_local_cell_after_join_not_universal_law'}]if originals and len(displayed)==1 else []
   self.methods.append(m)
   if self.plan and len(displayed)==1:
    contradicted=contrary_assignment(self.plan,component,next(iter(displayed)))
    if contradicted:
     self.plan_refutations.extend([{**g,'observed_display':next(iter(displayed)),'evidence':evidence,'original_source_set':originals,'reason':'complete_contributors_output_contradicts_assignment'}for g in contradicted]);self.events.append({'status':'assignment_refuted','groups':contradicted,'evidence':evidence});self.plan=None

  elif proposal and'channel_plan'in proposal:self.failed.append({'cell':c['ref'],'evidence':evidence,'opened':opened,'no_global_material_law_inferred':True})
  changes=[d['ref']for a,d in zip(v,w)if a['current_tile']!=d['current_tile']]
  if changed and not set(changes)<=affected_component(self.layout,v,c['ref']):self.invalid=True
  event={'status':'local_point_response','opened':opened,'changed_cells':changes,'transient_local':transient,'evidence':evidence,'original_markers_retained':True,'goal_and_mixture_unknown':True};self.events.append(event);self.cache=None;return event
