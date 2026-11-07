from .local_contact import targets as local_contact_targets,reconcile as reconcile_local_contact,departure_support as endpoint_departure_support,equivalent_current_contact_offers
from .boundary import capture as capture_boundary, revalidate as revalidate_boundary, complements as remembered_complements, current_goal_witnesses
from .endpoints import endpoint_measurements,retained_method_targets
from .continuation import access_measurements,capacity_targets
from .effect_scope import recall as recall_effect_scope,retain as retain_effect_scope
from .context_intervention import targets as context_targets,record as record_context_intervention,decorate as decorate_context_question
from pathlib import Path
from copy import deepcopy
import hashlib,json
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram
from agents.yf_arc3_v6.morphology_policy.guarded_binding.family import locate
from agents.yf_arc3_v6.morphology_policy.guarded_binding.geometry import find_body
from .project import CellProjection
from .contrast import world_complements,display_matches
from .dependencies import measured_dependencies,recalled_gain_targets,frontier_target
from .initial import provisional_scenes
from .routing import measured_paths
from .policy import InventoryPolicy
HERE=Path(__file__).parent

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def core(entity):return {'signature':entity['signature'],'palette_value':entity['palette_value'],'area':entity['area'],'offsets':[list(p) for p in entity['mask']]}

class ObservedInventory:
 def __init__(self):
  self.tracker=CellProjection();self.policy=InventoryPolicy();self.config=self.policy.config;self.seen_pairs=[];self.failed=[];self.selected=None;self.access_returns=[];self.endpoint_memory=[];self.boundary_memory=None;self.pending_access=None;self.retained_effect_scope=None
  self.src=SrcProgram(HERE/'inventory.src','v6.observed_inventory.choose',{'inventory.measure':lambda request:self.measured,'inventory.interpret':self.select})
 def state(self):return {'tracker':self.tracker.state(),'seen_pairs':deepcopy(self.seen_pairs),'failed':deepcopy(self.failed),'access_returns':deepcopy(self.access_returns),'endpoint_memory':deepcopy(self.endpoint_memory),'boundary_memory':deepcopy(self.boundary_memory),'pending_access':deepcopy(self.pending_access),'retained_effect_scope':deepcopy(self.retained_effect_scope)}
 def restore(self,state):self.tracker.restore(state['tracker']);self.seen_pairs=deepcopy(state.get('seen_pairs',[]));self.failed=deepcopy(state.get('failed',[]));self.access_returns=deepcopy(state.get('access_returns',[]));self.endpoint_memory=deepcopy(state.get('endpoint_memory',[]));self.boundary_memory=deepcopy(state.get('boundary_memory'));self.pending_access=deepcopy(state.get('pending_access'));self.retained_effect_scope=deepcopy(state.get('retained_effect_scope'))
 def preservation_obligations(self,obs,rows):
  held=self.tracker.displayed if self.tracker.epoch==obs['level_epoch'] else None;recall=revalidate_boundary(self.boundary_memory,obs,rows,self.tracker.transfer_methods)
  if not held and recall['status']=='revalidated_hypothesis':held=recall['record']
  if not held:return []
  recalled=bool(held.get('visibility'))
  if not recalled and (self.tracker.epoch!=obs['level_epoch'] or not display_matches(held,rows)):return []
  l,t,r,b=held['display_bbox'];pixels=held['current_indicator_pixels'] if recalled else [[l+x,t+y,held['source_value']] for x,y in held['source_mask']];revision_inputs=[held['action']['action_ref']]
  core=recall['body_signature'] if recalled else self.tracker.core;body=find_body(obs,core)
  pairs=self.seen_pairs
  if recalled:
   measured=self.tracker.measure(obs,rows) if self.tracker.epoch==obs['level_epoch'] else {}
   scenes=[measured] if measured.get('status')=='measured' else provisional_scenes(obs,rows)
   pairs=[pair for scene in scenes if scene.get('body_signature')==core for pair in remembered_complements(scene,rows,held)]
  if body:
   cx=(body['bbox'][0]+body['bbox'][2])/2;cy=(body['bbox'][1]+body['bbox'][3])/2
   for pair in pairs:
    if pair['level_epoch']!=obs['level_epoch'] or pair['source_value']!=held['source_value']:continue
    tl,tt,tr,tb=pair['target_bbox'];tx=(tl+tr)/2;ty=(tt+tb)/2
    for cmd,vector in self.config['interface_prior']['directions'].items():
     delta=self.tracker.controls.get(cmd,{}).get('delta',[vector[0]*(tr-tl+1),vector[1]*(tb-tt+1)])
     if [cx+delta[0],cy+delta[1]]==[tx,ty]:revision_inputs.append(cmd)
  return [{'id':'preserve:displayed_signature:'+digest(held['evidence']),'meaning':'Preserve the current observed indicator until the bound access or allocation experiment; its hidden content remains a hypothesis.','pixels':pixels,'revision_inputs':revision_inputs,'evidence':held['evidence']}]
 def remember(self,facts,rows):
  pairs=world_complements(facts,rows)
  for pair in pairs:
   key=digest([pair['level_epoch'],pair['source_value'],pair['source_cell'],pair['target_cell']])
   if not any(x['key']==key for x in self.seen_pairs):self.seen_pairs.append({'key':key,**deepcopy(pair)})
  return pairs
 def project(self,request):
  obs,rows,inputs,remaining,forecast,goal_models,collection=self.context;available={a['action_ref'] for a in inputs if not a.get('data')};facts,probe_input=self.tracker.measure_with_input(obs,rows)
  scenes=[facts] if facts.get('status')=='measured' else provisional_scenes(obs,rows) if self.tracker.core is None else []
  options=[]
  for scene in scenes:
   if not scene.get('support_effect_scope'):scene['support_effect_scope']=recall_effect_scope(self.retained_effect_scope,scene,obs,rows)
   scene['conditional_departure_support']=endpoint_departure_support(scene,obs,rows,self.endpoint_memory,self.config.get('equivalent_departure_witnesses'))
   pairs=self.remember(scene,rows);display=scene.get('displayed_candidate');targets=[]
   recall=revalidate_boundary(self.boundary_memory,obs,rows,self.tracker.transfer_methods)
   if not display and recall['status']=='revalidated_hypothesis' and scene.get('body_signature')==recall['body_signature']:
    witnesses=current_goal_witnesses(scene,rows,goal_models)
    if witnesses:
     display=recall['record'];scene['displayed_candidate']=display;scene['display_complements']=remembered_complements(scene,rows,display);scene['goal_revalidation']=witnesses

   dependency=None
   held=display or (self.pending_access.get('held') if self.pending_access and self.pending_access['level_epoch']==obs['level_epoch'] else None)
   if held:
    dep_pairs=scene.get('display_complements',[]) if display else remembered_complements(scene,rows,held)
    found=measured_dependencies(scene,rows,pairs,dep_pairs,self.config['interface_prior']['directions'],available)
    if len(found)==1:dependency=found[0]
   if dependency:
    if display:
     candidate=frontier_target(scene,dependency,display)
     if candidate:targets.append(candidate)
    else:
     # Retain the named supplier of the still-current access dependency. Other
     # occurrences remain measured; they are not erased or declared useless.
     pairs=[{**p,'dependency':dependency} for p in pairs if p['source_cell']==dependency['supplier']['source_cell'] and p['target_cell']==dependency['supplier']['target_cell']]
    targets.extend(recalled_gain_targets(scene,obs,collection,dependency))
   if display:
    for pair in scene.get('display_complements',[]):
     if pair['display_component_ref']==display['display_component_ref']:
       recalled=bool(display.get('visibility'))
       flags={'display_transfer_current':not recalled,'display_complement_unique':not recalled and len(scene['display_complements'])==1,'remembered_correspondence_unique':recalled and len(scene['display_complements'])==1,'prior_boundary_target_revalidated':bool(scene.get('goal_revalidation')),'world_complement_unique':False,'local_source_retained':False}
       targets.append(([pair['target_row'],pair['target_col']],flags,{**pair,'goal_revalidation':scene.get('goal_revalidation',[])}))
   else:
    for pair in pairs:targets.append((pair['source_cell'],{'display_transfer_current':False,'display_complement_unique':False,'world_complement_unique':len(pairs)==1,'local_source_retained':False},pair))
    # Revalidate the actual entered source under current visible pixels; the full
    # mask comes from its pre-entry observation, not a guessed hidden drawing.
    under=scene.get('underlay_evidence',{})
    if scene.get('retained_underlay_value_count') and under.get('cell_bbox'):
     l,t,r,b=under['cell_bbox'];grid=scene['grids'][0]
     for pair in self.seen_pairs:
      if dependency and (pair['source_cell']!=dependency['supplier']['source_cell'] or pair['target_cell']!=dependency['supplier']['target_cell']):continue
      if pair['level_epoch']!=obs['level_epoch']:continue
      sr,sc=pair['source_cell'];cell=next((c for c in grid['cells'] if (c['row'],c['col'])==(sr,sc)),None)
      if not cell or [cell['bbox'][k] for k in ('left','top','right','bottom')]!=[l,t,r,b]:continue
      tl,tt,tr,tb=pair['target_bbox'];value=pair['source_value'];shape={tuple(q) for q in pair['source_mask']};dx,dy=pair['offset']
      # Current full complement must still be the same observed partition.
      if any((rows[tt+y][tl+x]==value)==((x-dx,y-dy) in shape) for y in range(tb-tt+1) for x in range(tr-tl+1)):continue
      targets.append((pair['source_cell'],{'display_transfer_current':False,'display_complement_unique':False,'world_complement_unique':True,'local_source_retained':True},pair))
   returned=next((z for z in reversed(self.access_returns) if z['level_epoch']==obs['level_epoch'] and z.get('active')),None)
   targets.extend(capacity_targets(scene,obs,forecast,returned))
   endpoints=endpoint_measurements(scene,probe_input,obs,rows,forecast,returned,self.tracker.underlays,self.config['interface_prior']['directions'])
   for _,_,item in endpoints:
    key=(item['level_epoch'],tuple(item['source_cell']),item['source_entity']['signature'] if item['source_entity'] else None)
    self.endpoint_memory=[old for old in self.endpoint_memory if (old['level_epoch'],tuple(old['source_cell']),old['source_entity']['signature'] if old['source_entity'] else None)!=key]
    self.endpoint_memory.append(item);self.endpoint_memory=self.endpoint_memory[-32:]
   targets.extend(endpoints)
   targets.extend(local_contact_targets(scene,obs,rows,self.endpoint_memory,self.tracker.transfer_methods,self.config['interface_prior']))
   targets.extend(retained_method_targets(scene,obs,rows,self.endpoint_memory,self.tracker.transfer_methods,returned))
   targets.extend(context_targets(scene,obs,rows,self.endpoint_memory,self.tracker.transfer_methods,targets))
   for target,flags,pair in targets:
    interpretations=self.policy.interpret({'current_scope_and_observation':True,**flags})
    if interpretations['status']!='unique':continue
    meaning=interpretations['conclusions'][0];kind=meaning['status']
    paths=measured_paths(scene,rows,[target],self.config['interface_prior']['directions'],available,min(16,remaining))
    for route in paths:
     if not route['path']:
      action=deepcopy(pair.get('method_action') or {'action_ref':self.config['interface_prior']['interaction']})
      if kind not in ('acquisition_probe_candidate','method_probe_candidate','allocation_probe_candidate','local_contact_probe_candidate','local_contact_recall_candidate','context_reconfiguration_candidate') or action['action_ref'] not in available:continue
      steps=[{'action':action,'from_cell':route['start_cell'],'to_cell':route['start_cell'],'control':{'status':'interaction_hypothesis'},'surface_status':'unknown_transaction'}]
     else:steps=route['prefix']
     if not steps or len(steps)>remaining:continue
     entity=find_body(obs,scene['body_signature'])
     if not entity:continue
     key=digest([obs['level_epoch'],scene['body_signature'],scene['body'],target,steps[0]['action'],bool(display),rows[scene['body'][1]:scene['body'][3]+1]])
     if key in self.failed:continue
     current_forecast=bool(forecast and forecast.get('observation_ref')==obs['observation_ref'] and forecast.get('level_epoch')==obs['level_epoch'])
     minimum_cost=route['length']+(1 if kind in ('approach_candidate','acquisition_probe_candidate','endpoint_approach_candidate','method_probe_candidate','local_contact_probe_candidate','local_contact_recall_candidate','context_reconfiguration_candidate') else 0)
     financing={'minimum_composition_primitives':minimum_cost,'prefix_primitives':len(steps),'remaining_steps_before_empty':forecast['steps_before_empty'] if current_forecast else None,'final_margin':1,'status':'lower_bound_inside_margin' if current_forecast and minimum_cost+1<=forecast['steps_before_empty'] else 'lower_bound_exceeds_margin' if current_forecast else 'unmeasured','unknown':['full_future_continuation_cost','recharge_or_exhaustion_law']}
     options.append({'scene':scene,'target':pair,'conclusions':meaning,'kind':kind,'steps':steps,'path_length':route['length'],'primitive_count':len(steps),'route':route,'core':core(entity),'key':key,'forecast':forecast,'financing':financing})
  return {'options':options}
 def select(self,measured):
  options=[o for o in measured['options'] if o['financing']['status'] in self.config['admitted_financing_statuses']];self.selected=None
  if options:
   order=self.config['choice_order'];fields=self.config['choice_fields'];best=min((order.index(o['kind']),*(o[k] for k in fields)) for o in options);pool=[o for o in options if (order.index(o['kind']),*(o[k] for k in fields))==best];pool=equivalent_current_contact_offers(pool,self.config.get('equivalent_contact_offers',{}),digest);groups={digest([o['scene']['body_signature'],o['target'],[s['action'] for s in o['steps']]]):o for o in pool}
   if len(groups)==1:self.selected=next(iter(groups.values()))
   if self.selected and self.selected['target'].get('dependency') and self.selected['scene'].get('displayed_candidate'):
    self.pending_access={'level_epoch':self.context[0]['level_epoch'],'dependency':deepcopy(self.selected['target']['dependency']),'held':deepcopy(self.selected['scene']['displayed_candidate'])}
  return {'selected':self.selected is not None,'alternatives':len(options)}
 def propose(self,obs,rows,inputs,remaining,forecast=None,goal_models=None,collection=None):
  if remaining<1:return None
  self.tracker.observe_scope(obs,rows)
  recall=revalidate_boundary(self.boundary_memory,obs,rows,self.tracker.transfer_methods)
  if recall['status']=='contradicted':self.boundary_memory['active']=False;self.boundary_memory['refutation']={'observation_ref':obs['observation_ref'],'reason':recall['reason']}
  if self.tracker.core is None and recall['status']=='revalidated_hypothesis':self.tracker.core=recall['body_signature']
  self.context=obs,rows,inputs,remaining,forecast,goal_models or [],collection
  self.measured=self.project({'observation_ref':obs['observation_ref']})
  if not self.measured['options']:return None
  result,receipt=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
  if not result['selected']:return None
  plan=deepcopy(self.selected);scene=plan['scene'];grid=scene['grids'][0];l,t,r,b=scene['body'];steps=[]
  for step in plan['steps']:
   dr=step['to_cell'][0]-plan['route']['start_cell'][0];dc=step['to_cell'][1]-plan['route']['start_cell'][1]
   expected=[l+dc*grid['col_pitch'],t+dr*grid['row_pitch'],r+dc*grid['col_pitch'],b+dr*grid['row_pitch']]
   prior_dr=step['from_cell'][0]-plan['route']['start_cell'][0];prior_dc=step['from_cell'][1]-plan['route']['start_cell'][1]
   before_box=[l+prior_dc*grid['col_pitch'],t+prior_dr*grid['row_pitch'],r+prior_dc*grid['col_pitch'],b+prior_dr*grid['row_pitch']]
   steps.append({'action':step['action'],'body_before':before_box,'to_cell':list(step['to_cell']),'expected_after':None if step['control']['status']=='interaction_hypothesis' else {'body_bbox':expected,'qualification':'conditional_body_and_step_prediction'},'seal_after':step['control']['status']!='observed_translation' or step is plan['steps'][-1]})
  actions=[s['action'] for s in steps];focus='composition:inventory:'+digest([obs['observation_ref'],plan['target'],plan['kind']]);facts={'current_inventory_composition_bound':True};evidence=[obs['observation_ref']]+(scene.get('displayed_candidate') or {}).get('evidence',[]);meaning=plan['conclusions'];evidence += [w['boundary_before'] for w in plan['target'].get('goal_revalidation',[])];evidence+=plan['target'].get('dependency_return',{}).get('evidence',[])+plan['target'].get('method',{}).get('evidence',[])+plan['target'].get('evidence',[])
  control_revalidation={cmd:deepcopy(record['parameter_revalidation']) for cmd,record in scene.get('controls',{}).items() if record.get('parameter_revalidation')}
  for record in control_revalidation.values():
   for ref in record['evidence']+[ref for pair in record['prior_scope_method']['evidence'] for ref in pair]:
    if ref not in evidence:evidence.append(ref)
  unresolved_controls=deepcopy(scene.get('unresolved_current_controls',{}))
  for record in unresolved_controls.values():
   for ref in record['evidence']+[ref for pair in record['prior_scope_method']['evidence'] for ref in pair]:
    if ref not in evidence:evidence.append(ref)
  scope=scene.get('support_effect_scope')
  if scope:evidence.extend(ref for ref in scope['evidence'] if ref not in evidence)
  departure=plan['route'].get('conditional_departure_support')
  if departure:evidence.extend(ref for ref in departure['evidence'] if ref not in evidence)
  material_entries=list(plan['route'].get('conditional_material_entries',[]))
  dependency=plan['target'].get('dependency') or {}
  for route_name in ('frontier_route','supplier_route'):
   material_entries.extend(dependency.get(route_name,{}).get('conditional_material_entries',[]))
  for entry in material_entries:
   evidence.extend(ref for ref in entry.get('evidence',[]) if ref not in evidence)
  proposal={'status':'proposed','kind':'public_inventory_composition','actions':actions,'steps':steps,'facts':facts,'binding':{k:obs[k] for k in ('observation_ref','level_epoch','levels_completed','frame_hash')},'inventory_plan':{'offer':plan,'workflow':receipt,'drm_hash':self.policy.loaded.sha256 if hasattr(self.policy.loaded,'sha256') else digest(self.config)},'compositions':[{'id':focus,'role':meaning['role'],'observed':False,'things':[scene['body_signature']],'properties':{'target':meaning['composition'],'conditional':True,'interface_prior':self.config['interface_prior'],'unknown':meaning['unknown'],'composition_financing':plan['financing'],'dependency_return':plan['target'].get('dependency_return'),'method_recall':plan['target'].get('method') or plan['target'].get('method_recall'),'goal_revalidation':plan['target'].get('goal_revalidation'),'unmet_access_dependency':plan['target'].get('dependency'),'conditional_material_transit':material_entries,'conditional_endpoint_departure':departure,'current_control_revalidation':control_revalidation,'unresolved_current_control_hypotheses':unresolved_controls,'equivalent_contact_descriptions':plan['target'].get('equivalent_descriptions'),'regional_continuation_equivalence':plan['target'].get('equivalence'),'measured_effect_scope':scope,'unexplained_remote_effects':plan['target'].get('arrival',{}).get('remote_effects') or (plan['target'].get('method') or {}).get('remote_effects'),'future_service':plan['target'].get('future_consumer'),'falsifiers':['different_current_body_or_displacement','source_or_display_contradiction','unexpected_effect_on_other_compositions','scope_changed']},'relations':['contributes_to:'+self.config['goal']],'open_question':meaning['question']}],'question':{'reason':meaning['question'],'hypothesis_refs':[meaning['rule_ref']]},'route_refs':evidence,'bundle_template':{'operation_key':meaning['operation'],'composition_ref':focus,'objective_ref':self.config['goal'],'purpose':meaning['question'],'preconditions':facts,'evidence':evidence,'actions':actions,'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
  decorate_context_question(proposal,obs)
  if plan['kind'] in ('access_probe_candidate','allocation_probe_candidate') and len(steps)==1 and tuple(plan['steps'][-1]['to_cell'])==tuple(plan['route']['target_cell']):
   for obligation in self.preservation_obligations(obs,rows):
    proposal.setdefault('preservation_changes',{})[obligation['id']]={'observation_ref':obs['observation_ref'],'action_ref':actions[0]['action_ref'],'actions':actions,'why':'Use the preserved observed signature in the explicitly tested complementary access composition.','expected_reestablishment':'Compare retained signature, local partition and body after this single contact; consumption remains unknown until observed.','revise_condition':True}
  return proposal
 def bind(self,p,domain):
  if p['actions']!=[s['action'] for s in p['steps']] or any('expected_after' not in s for s in p['steps']):raise ValueError('unbound inventory prefix')
 def before(self,p,index,public,obs):
  box=locate(public.frame_rows,p['inventory_plan']['offer']['core']);ok=box==p['steps'][index]['body_before'] and public.level==p['binding']['level_epoch'] and public.levels_completed==p['binding']['levels_completed'] and p['actions'][index]['action_ref'] in public.available_action_refs
  if index==0:ok=ok and public.frame_hash==p['binding']['frame_hash'] and obs['observation_ref']==p['binding']['observation_ref'] and obs['frame_hash']==p['binding']['frame_hash']
  return {'admitted':ok,'reason':'current_scoped_inventory_composition' if ok else 'current_binding_changed'}
 def after(self,p,index,before,after,first,second):
  step=p['steps'][index];expected=step['expected_after'];box=locate(second,p['inventory_plan']['offer']['core']);matched=None if expected is None else box==expected['body_bbox'];body_position_matched=matched
  if matched:
   offer=p['inventory_plan']['offer'];grid=offer['scene']['grids'][0];regions=[step['body_before'],expected['body_bbox']]
   if step['seal_after']:
    cell=next(c for c in grid['cells'] if [c['row'],c['col']]==step['to_cell']);regions.append([cell['bbox'][k] for k in ('left','top','right','bottom')])
    if offer['kind']=='access_probe_candidate' and offer['scene'].get('displayed_candidate'):regions.append(offer['scene']['displayed_candidate']['display_bbox'])
   for cell in grid['cells']:
    b=cell['bbox']
    if any(first[y][x]!=second[y][x] and not any(l<=x<=r and t<=y<=bb for l,t,r,bb in regions) for y in range(b['top'],b['bottom']+1) for x in range(b['left'],b['right']+1)):matched=False;break
  preservation_matched=None
  if expected is None and p['inventory_plan']['offer']['kind'] in ('method_probe_candidate','allocation_probe_candidate'):
   offer=p['inventory_plan']['offer'];regions=[offer['target']['source_bbox'],offer['target']['method']['display_bbox']]
   preservation_matched=box==step['body_before']
   for cell in offer['scene']['grids'][0]['cells']:
    b=cell['bbox']
    if any(first[y][x]!=second[y][x] and not any(l<=x<=r and t<=y<=bb for l,t,r,bb in regions) for y in range(b['top'],b['bottom']+1) for x in range(b['left'],b['right']+1)):preservation_matched=False;break
  if expected is None and p['inventory_plan']['offer']['kind'] in ('local_contact_probe_candidate','local_contact_recall_candidate','context_reconfiguration_candidate'):
   offer=p['inventory_plan']['offer'];region=offer['target']['source_bbox'];preservation_matched=box==step['body_before']
   for cell in offer['scene']['grids'][0]['cells']:
    b=cell['bbox']
    if any(first[y][x]!=second[y][x] and not(region[0]<=x<=region[2] and region[1]<=y<=region[3]) for y in range(b['top'],b['bottom']+1) for x in range(b['left'],b['right']+1)):preservation_matched=False;break
  # Keep unexplained remote coeffects, but never waive a current obligation.
  scoped=None;offer=p['inventory_plan']['offer'];kind=offer['kind']
  arrival=kind in ('endpoint_approach_candidate','context_reconfiguration_candidate') and tuple(step['to_cell'])==tuple(offer['route']['target_cell'])
  operator=kind in ('local_contact_probe_candidate','local_contact_recall_candidate') or (kind=='context_reconfiguration_candidate' and expected is None)
  control_matched=box==(expected['body_bbox'] if expected else step['body_before'])
  if (kind in ('endpoint_approach_candidate','context_reconfiguration_candidate') or operator) and control_matched:
   from .effect_scope import contrast
   regions=[offer['target']['source_bbox'] if arrival or operator else step['body_before'],step['body_before'],box]
   contrast_result=contrast(offer['scene'].get('support_effect_scope'),before,after,first,second,regions,box)
   if contrast_result:
    from common_preservation import check as check_preservation
    preservation=check_preservation(p,second,after['level_epoch'],after=True,observation=after)
    meaning=self.policy.interpret({'current_scope_and_observation':True,'bound_endpoint_or_local_operator':True,'current_control_effect_matched':True,'measured_support_domain_revalidated':True,'other_domain_compositions_preserved':contrast_result['unauthorized_domain_changes']==0,'explicit_preservation_satisfied':preservation['admitted'],'unexplained_remote_effect_observed':True})
    scoped={**contrast_result,'explicit_preservation':preservation,'interpretation':meaning}
    if meaning['status']=='unique' and meaning['conclusions'][0]['status']=='conditional_local_reconciliation':
     if expected is not None and kind in ('endpoint_approach_candidate','context_reconfiguration_candidate'):matched=True
     if operator:preservation_matched=True
    else:
     if expected is not None and kind in ('endpoint_approach_candidate','context_reconfiguration_candidate'):matched=False
     if operator:preservation_matched=False
  result={'matched':matched,'body_position_matched':body_position_matched,'preservation_matched':preservation_matched,'seal_prefix':bool(step['seal_after'] or not matched),'reason':'conditional_body_and_other_current_cells_compared'}
  if scoped:result.update(remote_effects=scoped['remote_effects'],effect_scope_reconciliation=scoped)
  return result
 def record(self,before,after,action,first,second,proposal=None,index=0):
  if before['level_epoch']!=after['level_epoch']:
   if self.retained_effect_scope:self.retained_effect_scope.update(active=False,refutation={'reason':'scope_changed','observation_ref':after['observation_ref']})
   self.boundary_memory=capture_boundary(before,after,first,second,self.tracker.displayed,self.access_returns,self.tracker.core);self.pending_access=None
  current_recall=revalidate_boundary(self.boundary_memory,before,first,self.tracker.transfer_methods)
  if not any(pair['level_epoch']==before['level_epoch'] for pair in self.seen_pairs) and not (proposal and proposal.get('inventory_plan')) and current_recall['status']!='revalidated_hypothesis' and not any(z['level_epoch']==before['level_epoch'] and z.get('active') for z in self.access_returns):
   # A translated current body is a measurement, not an object role or permit.
   # Admit only a unique axial difference under a declared directional input.
   if action.get('action_ref') not in self.config['interface_prior']['directions']:return None
   from ..guarded_binding.geometry import moved_core
   motion=moved_core(before,after,minimum_area=1,preferred_minimum_area=4)
   if not motion or not ((motion['delta'][0]==0)!=(motion['delta'][1]==0)):return None
   return self.tracker.record(before,after,action,first,second,control_revalidation=self.policy.interpret)
  measurements=access_measurements(proposal,index,before,after,first,second)
  returned=None
  if measurements and self.after(proposal,index,before,after,first,second)['matched']:
   meaning=self.policy.interpret(measurements)
   if meaning['status']=='unique' and meaning['conclusions'][0]['status']=='local_access_return':
    returned={**measurements,'status':'local_access_return','active':True,'evidence':[before['observation_ref'],after['observation_ref']],'rule_ref':meaning['conclusions'][0]['rule_ref']}
    self.access_returns.append(returned);self.access_returns=self.access_returns[-16:]
  method_rejected=bool(proposal and proposal.get('inventory_plan',{}).get('offer',{}).get('kind') in ('method_probe_candidate','allocation_probe_candidate') and self.after(proposal,index,before,after,first,second).get('preservation_matched') is False)
  if method_rejected:
   self.failed.append(proposal['inventory_plan']['offer']['key'])
   return {'status':'method_context_rejected','reason':'other_composition_or_control_changed','evidence':[before['observation_ref'],after['observation_ref']],'method_refuted_globally':False}
  event=self.tracker.record(before,after,action,first,second,control_revalidation=self.policy.interpret)
  inventory_outcome=self.after(proposal,index,before,after,first,second) if proposal and proposal.get('inventory_plan') else None
  contact_event=reconcile_local_contact(self.endpoint_memory,self.tracker.transfer_methods,proposal,index,before,after,first,second,inventory_outcome,self.tracker.underlays) if proposal else None
  context_event=record_context_intervention(self.tracker.transfer_methods,proposal,index,before,after,first,second,self.config['maximum_context_regions'])
  if inventory_outcome:
   retained=retain_effect_scope(proposal,index,before,after,second,inventory_outcome,self.retained_effect_scope)
   if retained:self.retained_effect_scope=retained
  if proposal and proposal.get('inventory_plan'):
   expected=proposal['steps'][index]['expected_after'];offer=proposal['inventory_plan']['offer']
   if expected and locate(second,offer['core'])!=expected['body_bbox']:self.failed.append(offer['key'])
   if offer['kind']=='method_probe_candidate' and (not event or event.get('status')!='unique_corresponding_transfer'):self.failed.append(offer['key'])
   if offer['kind']=='allocation_probe_candidate' and (not event or event.get('status')!='unique_reverse_correspondence'):self.failed.append(offer['key'])
  if event and event.get('status')=='exact_observed_scene_restoration':
   self.pending_access=None
   for receipt in self.access_returns:receipt['active']=False
  if returned:
   if self.boundary_memory and self.boundary_memory['target_epoch']==after['level_epoch']:self.boundary_memory['active']=False;self.boundary_memory['ended_by_local_access']=after['observation_ref']
   self.tracker.displayed=None
   return {'measurements':event,'dependency_return':returned}
  if context_event and contact_event:return {**contact_event,'context_association':context_event}
  return context_event or contact_event or event
