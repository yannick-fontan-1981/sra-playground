from copy import deepcopy
from .geometry import measure,route,digest,shape,reconfiguration_routes,landing_body_context,tile,current_body_layer
from .policy import EndpointPolicy
class InvitedEndpoints:
 def __init__(self):self.policy=EndpointPolicy();self.epoch=None;self.events=[];self.methods=[];self.portable=[];self.attempts=[];self.plan=None;self.cache=None;self.visits=[];self.body_context=None
 def state(self):return {k:deepcopy(getattr(self,k))for k in('epoch','events','methods','portable','attempts','plan','visits','body_context')}
 def restore(self,s):
  for k,v in s.items():setattr(self,k,deepcopy(v))
  self.cache=None
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.methods:self.portable.append({'source_epoch':self.epoch,'methods':deepcopy(self.methods),'status':'method_not_current_permit'})
  self.epoch=obs['level_epoch'];self.events=[];self.methods=[];self.attempts=[];self.plan=None;self.cache=None;self.visits=[];self.body_context=None
 def measured(self,obs,rows):
  self.scope(obs);key=digest(rows)
  if self.cache and self.cache[0]==key:return self.cache[1]
  m=measure(rows,self.body_context);self.cache=(key,m);return m
 def signature(self,m):return {'metric':m['metric'],'size':m['size'],'pitch':m['pitch'],'actor_mask':[list(p)for p in shape(m['actor']['tile'],m['ink'])],'goal_mask':[list(p)for p in shape(m['goal']['tile'],m['ink'])]}
 def offers(self,obs,rows,remaining):
  m=self.measured(obs,rows)
  if m is None:return []
  recalled=[q for h in self.portable for q in h['methods']if q['signature']==self.signature(m)]
  if not(self.events or self.methods or recalled):return []
  q=None
  if self.plan and self.plan['goal']==m['goal']['point']and self.plan['expected_actor']==m['actor']['point']:
   suffix=self.plan['remaining'];cell=next((c for c in m['invited']if suffix and c['point']==suffix[0]),None)
   if cell:q={'cells':[next(c for c in m['cells']if c['point']==p)for p in suffix if any(c['point']==p for c in m['cells'])],'model':self.plan['model'],'hypothesis':True,'retained_continuation':True,'obligations':self.plan.get('obligations'),'context_question':self.plan.get('context_question')}
  if q is None:q=route(m,self.policy.config)
  if q is None and (self.methods or recalled):q=self.policy.choose_context(reconfiguration_routes(m,self.policy.config))
  if not q or not q['cells']:return []
  c=q['cells'][0];context=digest([obs['level_epoch'],rows,c['point']]);kind='context_question'if q.get('context_question')else'current_method'if self.methods else'recalled_method'if recalled else'invitation_experiment'
  facts={'grid_unique':True,'current_invitation':any(c['point']==i['point']for i in m['invited']),'route_found':True,'financed':len(q['cells'])<=remaining,'context_untried':context not in self.attempts,'entry_evidence':bool(self.events or self.methods or recalled),'observed_jump':bool(self.methods or recalled),'method_revalidated':bool(recalled)}
  return [{'kind':kind,'facts':facts,'center':c['point'],'cell':c,'route':q,'context':context,'signature':self.signature(m),'actor':m['actor'],'goal':m['goal'],'method':self.methods or recalled,'events':self.events,'unknown':['other_offset_outcomes','future_endpoint_admission','goal_role','side_effect_order'],'recalled_method_used':bool(recalled)and not self.methods}]
 def propose(self,obs,rows,inputs,remaining,forecast=None):
  if self.policy.config['point_action']not in obs['available_action_refs']:return None
  offers=self.offers(obs,rows,remaining)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  o=offers[choice['index']];x,y=o['center'];a={'action_ref':self.policy.config['point_action'],'data':{'x':int(x),'y':int(y)}};focus='composition:invited-endpoints:'+o['context'];evidence=[obs['observation_ref'],*[r for q in o['method']for r in q['evidence']],*[r for q in o['events']for r in q['evidence']]];facts={'current_invited_endpoint_question':True}
  return {'status':'proposed','kind':'public_invited_endpoints','actions':[a],'steps':[{'action':a,'expected_after':{'actor_cell':o['center'],'status':'conditional_endpoint_hypothesis'},'point_binding':{'entity_ref':'cell:'+o['cell']['ref'],'observation_ref':obs['observation_ref'],'signature':digest(o['cell']),'bbox':o['cell']['bbox'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'current_invited_endpoint'}}],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash')},'endpoint_plan':{'offer':o,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash,'remaining':remaining},'compositions':[{'id':focus,'role':'conditional_endpoint_access','observed':False,'things':[o['actor']['ref'],o['goal']['ref']],'properties':o,'relations':['contributes_to:'+self.policy.config['goal']],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':self.policy.config['goal'],'purpose':choice['reason'],'preconditions':facts,'evidence':evidence,'actions':[a],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,p,preserve):
  o=p['endpoint_plan']['offer'];a={'action_ref':self.policy.config['point_action'],'data':{'x':o['center'][0],'y':o['center'][1]}}
  if p['actions']!=[a]or p['actions']!=[s.get('action')for s in p['steps']]:raise ValueError('endpoint exact actionset mismatch')
 def before(self,p,index,public,obs):
  self.bind(p,None)
  if index!=0 or any(obs[k]!=p['binding'][k]for k in('observation_ref','level_epoch','frame_hash')):return {'admitted':False,'reason':'scope_changed'}
  o=p['endpoint_plan']['offer'];matches=[a for a in self.offers(obs,public.frame_rows,p['endpoint_plan']['remaining'])if a['cell']==o['cell']and a['center']==o['center']and a['context']==o['context']]
  return {'admitted':len(matches)==1,'reason':'current_invitation_exact_endpoint_revalidated_no_walk_intermediate_contract'}
 def after(self,p,index,before,after,first,second):
  prior=self.measured(before,first)
  receipt=current_body_layer(second,landing_body_context(prior,p['endpoint_plan']['offer']['cell'],before))if prior else None
  m=measure(second,receipt)if before['level_epoch']==after['level_epoch']else None
  return {'matched':m['actor']['point']==p['endpoint_plan']['offer']['center']if m else None,'preservation_matched':None,'seal_prefix':True,'reason':'endpoint_position_measured_other_effects_retained_unknown'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  m=self.measured(before,first)
  if before['level_epoch']!=after['level_epoch']:
   event={'status':'official_boundary','evidence':[before['observation_ref'],after['observation_ref']],'score_delta':after['levels_completed']-before['levels_completed']};self.scope(after);return event
  if m is None or command['action_ref']!=self.policy.config['point_action']:return None
  n=None;evidence=[before['observation_ref'],after['observation_ref']];data=command.get('data',{});clicked=next((c for c in m['cells']if c['bbox'][0]<=data.get('x',-1)<=c['bbox'][2]and c['bbox'][1]<=data.get('y',-1)<=c['bbox'][3]),None)
  if clicked is None:return None
  receipt=current_body_layer(second,landing_body_context(m,clicked,before))
  n=measure(second,receipt)or measure(second,self.body_context)
  event={'status':'point_return_unresolved','evidence':evidence,'cell':clicked['point'],'canonical_changed':first!=second,'transient_changed':any(f!=first for f in(frames or []))}
  if n and n['actor']['point']==clicked['point']and n['actor']['point']!=m['actor']['point']and shape(n['actor']['tile'],n['ink'])==shape(m['actor']['tile'],m['ink']):
   delta=[(n['actor']['point'][i]-m['actor']['point'][i])//m['pitch']for i in range(2)];method={'signature':self.signature(m),'observed_delta':delta,'evidence':evidence,'action_ref':command['action_ref'],'meaning':'clicked_endpoint_reached_other_offsets_still_hypothetical'};self.methods.append(method)
   if receipt and tile(second,clicked['bbox'])==receipt['expected_tile']:
    self.body_context={**receipt,'evidence':evidence,'status':'exact_current_body_over_observed_underlay'}
   else:self.body_context=None
   event.update(status='endpoint_arrival_observed',method=method,underlay_discrepancy=receipt.get('underlay_discrepancy',[])if receipt else [],underlay_effect_unknown=bool(receipt and receipt.get('underlay_effect_unknown')))
   if proposal and 'endpoint_plan'in proposal:
    q=proposal['endpoint_plan']['offer'];self.plan={'expected_actor':n['actor']['point'],'goal':q['goal']['point'],'remaining':[c['point']for c in q['route']['cells'][1:]],'model':q['route']['model'],'obligations':q['route'].get('obligations'),'context_question':q['route'].get('context_question')}
  elif proposal and 'endpoint_plan'in proposal:self.plan=None
  if proposal and 'endpoint_plan'in proposal and n:
   req=(proposal['endpoint_plan']['offer']['route'].get('obligations')or{});marks=req.get('cells',[])
   if event['status']=='endpoint_arrival_observed':
    for c in marks:
     if n['actor']['point']==c['point']and not any(v['point']==c['point']for v in self.visits):self.visits.append({'point':c['point'],'tile_before':c['tile'],'badge_value':req.get('badge_value'),'status':'visited_under_actor_credit_unknown','evidence':evidence})
   for v in self.visits:
    if n['actor']['point']!=v['point']and v['status']=='visited_under_actor_credit_unknown':
     revealed=next((c for c in n['cells']if c['point']==v['point']),None)
     if revealed and v['badge_value']not in revealed['values']:v.update(status='mark_absent_after_departure_persistence_candidate',departure_evidence=evidence)
   event['visit_evidence']=deepcopy(self.visits)
   question=proposal['endpoint_plan']['offer']['route'].get('context_question')
   if question and n['actor']['point']==question['target']['point']:
    changes=[{'point':c['point'],'before':c['tile'],'after':next((v['tile']for v in n['all_cells']if v['point']==c['point']),None)}for c in question['blocked']+question['accessible_markers']if any(v['point']==c['point']and v['tile']!=c['tile']for v in n['all_cells'])]
    normalized=lambda t:[[m['floor']if v==m['invitation']else v for v in row]for row in t]
    support_changes=[c for c in changes if c['after']is not None and normalized(c['before'])!=normalized(c['after'])]
    event['context_result']={'status':'related_support_appearances_changed'if support_changes else'no_related_support_change_observed','raw_changes':changes,'support_changes':support_changes,'invitation_before':[c['point']for c in m['invited']],'invitation_after':[c['point']for c in n['invited']],'invitation_pose_confound_preserved':True,'evidence':evidence,'law_unknown':True}
  if proposal and 'endpoint_plan'in proposal:self.attempts.append(proposal['endpoint_plan']['offer']['context'])
  self.events.append(event);return event

