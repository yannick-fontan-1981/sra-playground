"""Public, action-conditioned cell and peripheral correspondence measurements.
No object meaning, route authorization or capacity law is assigned here.
"""
import hashlib,json
from copy import deepcopy
from .material_layers import current_material_layers
from .effect_scope import measure as measure_effect_scope
from agents.yf_arc3_v5.capabilities.navigation_transition_measurements import measure_current_translation_underlays
from agents.yf_arc3_v6.morphology_policy.guarded_binding.geometry import moved_core,find_body
from agents.yf_arc3_v5.capabilities.contracts import InteractionProbeInput,FrameGrid,BoundingBox,ComponentExtractionInput
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.interaction import (_action_quantized_route_grid_candidates,
 _current_action_quantized_control_cell_retained_underlay_value_count,
 _edge_display_exact_complement_cell_measurements)

class CellProjection:
 def __init__(self):
  self.epoch=None;self.core=None;self.controls={};self.underlays={};self.events=[];self.last_motion=None;self.displayed=None;self.transfer_methods=[];self.initial_hash=None;self.initial_ref=None;self.scope_returns=[];self.metric_revalidation_epoch=None
 def observe_scope(self,obs,rows):
  if self.epoch!=obs['level_epoch']:
   source_epoch=self.epoch;methods=deepcopy(self.controls);transfers=deepcopy(self.transfer_methods);self.__init__();self.epoch=obs['level_epoch'];self.controls={k:{**v,'recalled_hypothesis':True,'recalled_from_epoch':source_epoch} for k,v in methods.items() if not v['contradictions']};self.transfer_methods=transfers
  if self.initial_hash is None:self.initial_hash=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest();self.initial_ref=obs['observation_ref']
 def state(self):
  value=deepcopy(self.__dict__);value['underlays']=[[list(k),v] for k,v in self.underlays.items()];return value
 def restore(self,state):
  value=deepcopy(state);value['underlays']={tuple(k):v for k,v in value.get('underlays',[])};self.__dict__.update(value)
 def record(self,before,after,action,first,second,control_revalidation=None):
  self.observe_scope(before,first)
  if before['level_epoch']!=after['level_epoch']:return None
  current_hash=hashlib.sha256(json.dumps(second,separators=(',',':')).encode()).hexdigest()
  if current_hash==self.initial_hash and first!=second:
   self.underlays={};self.displayed=None;self.last_motion=None
   for control in self.controls.values():control['recalled_hypothesis']=True
   event={'status':'exact_observed_scene_restoration','evidence':[self.initial_ref,before['observation_ref'],after['observation_ref']],'qualification':'whole_public_image_equal_no_reset_command_or_universal_exhaustion_cause_inferred'};self.scope_returns.append(event);return event
  if action.get('data'):return None
  moved=moved_core(before,after,minimum_area=1,preferred_minimum_area=4)
  if not moved:
   if self.core:
    from .contrast import transferred_shape,reverse_transfer
    bf=self.measure(before,first);af=self.measure(after,second)
    result=transferred_shape(before,after,first,second,bf,af,action)
    if result['status']=='unique_corresponding_transfer':
     receipt={**result['matches'][0],'evidence':result['evidence'],'action':action,'epoch':self.epoch,'status':'observed_correspondence_possession_hypothesis'}
     self.displayed=receipt;self.transfer_methods.append(receipt);self.events.append(result);return result
    if self.displayed:
     inverse=reverse_transfer(self.displayed,before,after,first,second,bf)
     if inverse['status']=='unique_reverse_correspondence':
      bl,bt,br,bb=bf['body'];cl,ct,cr,cb=inverse['alternatives'][0]['cell_bbox']
      exterior=[(x-cl,y-ct) for y in range(ct,cb+1) for x in range(cl,cr+1) if not(bl<=x<=br and bt<=y<=bb)]
      prior_under=self.underlays.get(tuple(bf['body']),{});offset=inverse['alternatives'][0]['offset'];material=[[x+offset[0],y+offset[1]] for x,y in self.displayed['source_mask']]
      self.underlays.setdefault(tuple(bf['body']),{})['material_overlay']={'substrate_patch':deepcopy(prior_under.get('patch')) if prior_under.get('cell_bbox')==[cl,ct,cr,cb] else None,'material_mask':material,'material_value':self.displayed['source_value'],'control_signature':self.core,'entry_evidence':deepcopy(prior_under.get('evidence',[])),'level_epoch':before['level_epoch'],'cell_bbox':[cl,ct,cr,cb],'body_bbox':bf['body'],'prior_exterior':[[x,y,first[ct+y][cl+x]] for x,y in exterior],'current_exterior':[[x,y,second[ct+y][cl+x]] for x,y in exterior],'evidence':[before['observation_ref'],after['observation_ref']],'qualification':'retained_surface_under_observed_material_transfer_departure_still_conditional'}
      self.displayed=None;self.events.append(inverse);return inverse
   return None
  dx,dy=moved['delta']
  if bool(dx)==bool(dy) or dx!=int(dx) or dy!=int(dy):return None
  if self.core and self.core!=moved['signature']:return None
  self.core=moved['signature'];cmd=action['action_ref'];delta=[int(dx),int(dy)]
  prior=self.controls.get(cmd);refs=[before['observation_ref'],after['observation_ref']];rebound=None
  if prior and prior['delta']!=delta:
   if control_revalidation:
    from .control_revalidation import measurements
    raw_underlays=[dict(item) for item in measure_current_translation_underlays(before=tuple(map(tuple,first)),after=tuple(map(tuple,second)))]
    facts=measurements(prior,self.epoch,delta,moved,raw_underlays,second);meaning=control_revalidation(facts)
    if meaning['status']=='unique' and meaning['conclusions'][0]['status']=='current_quantum_revalidation_candidate':
     rebound={'status':'current_quantum_revalidation_candidate','evidence':refs,'measurements':facts['measurement'],'rule_ref':meaning['conclusions'][0]['rule_ref'],'prior_scope_method':{'scope':prior['recalled_from_epoch'],'delta':deepcopy(prior['delta']),'evidence':deepcopy(prior['evidence'])}}
     self.controls[cmd]={'delta':delta,'evidence':[refs],'contradictions':[],'recalled_hypothesis':True,'current_scope_candidate':True,'observed_epoch':self.epoch,'parameter_revalidation':rebound};self.metric_revalidation_epoch=self.epoch;self.events.append(deepcopy(rebound))
    elif meaning['status']=='unique' and meaning['conclusions'][0]['status']=='foreign_metric_withdrawn_current_input_unresolved':
     rebound={'status':'foreign_metric_withdrawn_current_input_unresolved','evidence':refs,'measurements':facts['measurement'],'rule_ref':meaning['conclusions'][0]['rule_ref'],'prior_scope_method':{'scope':prior['recalled_from_epoch'],'delta':deepcopy(prior['delta']),'evidence':deepcopy(prior['evidence'])}}
     prior['withdrawn_epoch']=self.epoch;prior['unresolved_current_scope']=rebound;self.events.append(deepcopy(rebound))
   if rebound is None:
    prior['contradictions'].append([before['observation_ref'],after['observation_ref'],delta]);return None
  self.last_motion={'after':after['observation_ref'],'command':cmd,'delta':delta}
  if rebound is not None:pass
  elif prior:prior['evidence'].append(refs);prior['recalled_hypothesis']=False;prior['observed_epoch']=self.epoch;prior['current_scope_candidate']=False;prior.pop('withdrawn_epoch',None);prior.pop('unresolved_current_scope',None)
  else:self.controls[cmd]={'delta':delta,'evidence':[refs],'contradictions':[],'observed_epoch':self.epoch}
  l,t,r,b=moved['bbox']
  measured_underlays=[dict(item) for item in measure_current_translation_underlays(before=tuple(map(tuple,first)),after=tuple(map(tuple,second))) if tuple(item['bbox'])==(t,l,b,r) and tuple(item['translation_delta'])==(dy,dx)]
  if len(measured_underlays)!=1:return None
  under=list(measured_underlays[0]['underlay_values'])
  previous=self.underlays.get(tuple(moved['bbox']),{})
  retained=current_material_layers({tuple(moved['bbox']):previous},self.epoch,first,before_body['bbox'] if (before_body:=find_body(before,self.core)) else None,self.core)
  self.underlays[tuple(moved['bbox'])]={'values':under,'evidence':refs,'epoch':self.epoch,'measurement':measured_underlays[0]}
  if retained:self.underlays[tuple(moved['bbox'])]['material_overlay']=deepcopy(previous['material_overlay'])
  projected=self.measure(after,second)
  if len(projected.get('grids',()))==1:
   cells=projected['grids'][0]['cells'];hits=[c for c in cells if c['bbox']['left']<=l and c['bbox']['right']>=r and c['bbox']['top']<=t and c['bbox']['bottom']>=b]
   if len(hits)==1:
    cell=hits[0]['bbox'];cl,ct,cr,cb=[cell[k] for k in ('left','top','right','bottom')]
    self.underlays[tuple(moved['bbox'])].update(cell_bbox=[cl,ct,cr,cb],patch=[list(row[cl:cr+1]) for row in first[ct:cb+1]])
  return {'motion':delta,'body_bbox':moved['bbox'],'entered_underlay_values':sorted(set(under)),'evidence':refs,'parameter_revalidation':rebound}
 def measure(self,obs,rows):
  return self.measure_with_input(obs,rows)[0]
 def measure_with_input(self,obs,rows):
  out={'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'status':'unbound','release_authority':False}
  if obs['level_epoch']!=self.epoch or not self.core:return out,None
  body=find_body(obs,self.core)
  controls={k:v for k,v in self.controls.items() if not v['contradictions'] and v.get('withdrawn_epoch')!=self.epoch and k in obs['available_action_refs'] and (self.metric_revalidation_epoch!=self.epoch or v.get('observed_epoch')==self.epoch)}
  if body is None or not controls:return out,None
  l,t,r,b=body['bbox'];box=BoundingBox(left=l,top=t,right=r,bottom=b)
  frame=FrameGrid(rows=tuple(map(tuple,rows)));components=detect_components(ComponentExtractionInput(frame=frame,connectivity=4))
  under=self.underlays.get(tuple(body['bbox']),{})
  value=InteractionProbeInput(frame=frame,components=components,available_action_refs=tuple(obs['available_action_refs']),
   canonical_provisional_control_geometry_bboxes=(box,),input_aligned_entity_bboxes=(box,),
   known_action_translation_deltas=tuple((k,v['delta'][1],v['delta'][0]) for k,v in controls.items()),
   current_input_aligned_underlay_values=tuple(under.get('values',())),
   observed_input_aligned_action_translation=(self.last_motion['command'],self.last_motion['delta'][1],self.last_motion['delta'][0]) if self.last_motion and self.last_motion['after']==obs['observation_ref'] else None)
  grids=_action_quantized_route_grid_candidates(value)
  value=value.model_copy(update={'periodic_cell_grids':value.periodic_cell_grids.model_copy(update={'candidates':grids})})
  relations=_edge_display_exact_complement_cell_measurements(value,route_grids=grids)
  from .contrast import display_matches
  out['unresolved_current_controls']={k:deepcopy(v['unresolved_current_scope']) for k,v in self.controls.items() if v.get('withdrawn_epoch')==self.epoch and v.get('unresolved_current_scope')}
  out['rejected_interface_commands']=[k for k,v in self.controls.items() if v['contradictions']]
  out['displayed_candidate']=deepcopy(self.displayed) if self.displayed and display_matches(self.displayed,rows) else None
  out['support_effect_scope']=measure_effect_scope(components,self.underlays,self.epoch,body['bbox'],obs['observation_ref'])
  out.update(status='measured' if len(grids)==1 else 'ambiguous_lattice',body=body['bbox'],body_signature=self.core,controls=controls,
   grids=[g.model_dump(mode='json') for g in grids],retained_underlay_value_count=_current_action_quantized_control_cell_retained_underlay_value_count(value),
   underlay_evidence=under,retained_material_surfaces=current_material_layers(self.underlays,self.epoch,rows,body['bbox'],self.core),display_complements=[dict(x) for x in relations])
  return out,value
