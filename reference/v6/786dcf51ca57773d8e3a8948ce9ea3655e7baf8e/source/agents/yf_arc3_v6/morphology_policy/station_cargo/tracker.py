"""Carrier/cargo identity from public recoloring, co-motion and pose effects."""
from copy import deepcopy
from .geometry import discover,tiles,ref,groups,offsets,turned,recoloring

class CargoTracker:
 def __init__(self):
  self.grid=None;self.body=None;self.wall=None;self.base={};self.moves={};self.interaction=None;self.cargo=None;self.effects=[];self.stations={};self.trials={};self.epoch=None;self.floor=set();self.settled=[];self.receivers={};self.grasp_methods=[];self.initial_support=None;self.portable=None;self.recall=None
 def locate(self,rows):
  if not self.grid:return None
  cells=tiles(rows,self.grid);body=[p for p,glyph in cells.items() if tuple(glyph)==tuple(self.body)]
  size=self.grid['size'];ox,oy=self.grid['origin'];clipped={tuple(p) for p in self.grid.get('clipped_boundary_pixels',[])}
  for (x,y),glyph in cells.items():
   if x not in (0,self.grid['width']-1) and y not in (0,self.grid['height']-1):continue
   if any(v!=self.wall[index] and (ox+x*size+index%size,oy+y*size+index//size) not in clipped for index,v in enumerate(glyph)):return None
  return (cells,body[0]) if len(body)==1 else None
 def context(self,rows):
  current=self.locate(rows)
  if not current or not self.cargo:return None
  return self.context_at(current[1])
 def context_at(self,body):
  body=tuple(body);cargo=self.cargo;mask=[tuple(p) for p in cargo['offsets']];under=[self.base.get((body[0]+dx,body[1]+dy)) for dx,dy in mask];neighborhood=[]
  for q in range(4):
   neighborhood.append([self.base.get((body[0]+dx,body[1]+dy)) for dx,dy in turned(mask,q)])
  return ref([self.base.get(body),under,neighborhood,mask,cargo['status']])
 def motion_context(self,body,delta):
  mask=[(0,0)]+([tuple(p) for p in self.cargo['offsets']] if self.cargo else [])
  return ref([list(body),list(delta),mask,[self.base.get((body[0]+delta[0]+dx,body[1]+delta[1]+dy)) for dx,dy in mask]])
 def record(self,before,after,command,first,second):
  if self.epoch is not None and self.epoch!=before['level_epoch']:
   portable=deepcopy(self.portable);self.__init__();self.portable=portable
  self.epoch=before['level_epoch'];refs=[before['observation_ref'],after['observation_ref']]
  if after['levels_completed']>before['levels_completed']:
   if self.grid:
    self.portable={'body':list(self.body),'wall':list(self.wall),'size':self.grid['size'],'initial_support':list(self.initial_support),'interaction':self.interaction,'moves':{key:{'delta':deepcopy(value['delta']),'evidence':deepcopy(value['evidence'])} for key,value in self.moves.items() if not value.get('recalled_hypothesis')},'grasp_methods':deepcopy(self.grasp_methods),'receivers':deepcopy(self.receivers),'stations':deepcopy(self.stations),'boundary_ref':after['observation_ref'],'source_epoch':before['level_epoch']}
   event={'status':'official_boundary','evidence':refs,'claim':'whole_level_accepted_no_hidden_completion_rule_inferred'};self.effects.append(event);return event
  if not self.grid:
   if command.get('data') or first==second:return None
   found=discover(before,after,first,second)
   if not found:return None
   self.grid=found['grid'];self.body=found['body'];self.wall=found['wall'];self.base=tiles(first,self.grid);self.moves[command['action_ref']]={'delta':found['delta'],'evidence':refs}
   a=tuple(found['body_cell']);b=tuple(found['next_cell']);self.base[a]=tiles(second,self.grid)[a];self.floor.add(self.base[a]);self.initial_support=self.base[a]
   prior=self.portable
   if prior and tuple(prior['body'])==tuple(self.body) and tuple(prior['wall'])==tuple(self.wall) and prior['size']==self.grid['size'] and tuple(prior['initial_support'])==self.initial_support and prior['moves'].get(command['action_ref'],{}).get('delta')==found['delta'] and prior['interaction'] in before['available_action_refs']:
    self.interaction=prior['interaction'];self.grasp_methods=deepcopy(prior['grasp_methods'])
    self.recall={'status':'method_hypotheses_rebound_by_current_body_lattice_and_control','evidence':[prior['boundary_ref']]+refs,'source_epoch':prior['source_epoch'],'falsifiers':['changed_action_mapping','unexpected_contact_effect','whole_composition_access_blocked']}
    for action,method in prior['moves'].items():
     if action!=command['action_ref'] and action in before['available_action_refs']:self.moves[action]={**deepcopy(method),'recalled_hypothesis':True,'evidence':method['evidence']+refs}
   return {'status':'carrier_lattice_measured','grid':self.grid,'delta':found['delta'],'evidence':refs}
  left=self.locate(first);right=self.locate(second)
  if not left or not right:return {'status':'carrier_identity_unresolved','evidence':refs}
  a,origin=left;b,destination=right;delta=(destination[0]-origin[0],destination[1]-origin[1]);event=None
  if delta!=(0,0):
   expected=self.moves.get(command['action_ref'],{})
   if expected.get('recalled_hypothesis') and list(delta)!=expected['delta']:
    self.effects.append({'status':'portable_control_mapping_refuted','expected_delta':expected['delta'],'observed_delta':list(delta),'evidence':refs});self.portable=None;self.recall=None
    self.moves={key:value for key,value in self.moves.items() if not value.get('recalled_hypothesis')}
    self.grasp_methods=[method for method in self.grasp_methods if any(':epoch:'+str(self.epoch)+':' in value for value in method['evidence'])]
    if not self.cargo:self.interaction=None
   if abs(delta[0])+abs(delta[1])!=1:return {'status':'nonlocal_motion_unbound','evidence':refs}
   self.moves[command['action_ref']]={'delta':list(delta),'evidence':refs}
   if self.cargo and self.cargo['status']=='detachment_hypothesis':
    cargo=self.cargo;stationary=all(b.get(tuple(p)) in [tuple(g) for g in cargo['source_glyphs']] for p in cargo['cells'])
    if stationary:
     event={'status':'independent_carrier_motion_confirms_release','cargo_ref':cargo['ref'],'cells':cargo['cells'],'evidence':cargo['release_evidence']+refs}
     self.settled.append({'ref':cargo['ref'],'cells':deepcopy(cargo['cells']),'source_glyphs':deepcopy(cargo['source_glyphs']),'evidence':event['evidence'],'obstacle_until_counterevidence':True})
     if cargo.get('release_support'):self.receivers[ref(cargo['source_glyphs'])]={'support_glyph':cargo['release_support'],'evidence':event['evidence'],'claim':'observed_conditional_release_on_full_coverage_not_universal_receiver_rule'}
     self.cargo=None;self.floor.add(b[origin])
    else:event={'status':'detachment_hypothesis_refuted','evidence':refs};cargo['status']='unresolved'
   elif self.cargo:
    cargo=self.cargo;predicted=[(destination[0]+dx,destination[1]+dy) for dx,dy in cargo['offsets']]
    if all(b.get(p) in [tuple(g) for g in cargo['held_glyphs']] for p in predicted):
     cargo['status']='attachment_attested';cargo['evidence']=list(dict.fromkeys(cargo['evidence']+refs));cargo['cells']=[list(p) for p in predicted]
     event={'status':'rigid_attachment_comotion','cargo_ref':cargo['ref'],'delta':list(delta),'offsets':cargo['offsets'],'evidence':refs}
    else:event={'status':'attachment_prediction_refuted','cargo_ref':cargo['ref'],'evidence':refs};cargo['status']='unresolved'
   else:self.floor.add(b[origin])
   occupied={destination}|({tuple(p) for p in self.cargo['cells']} if self.cargo else set())
   for point in a:
    if point not in occupied:self.base[point]=b[point]
   if destination not in self.base or self.base[destination]==self.body:self.base[destination]=self.base.get(origin)
  elif first!=second:
   changed=[p for p in a if a[p]!=b[p] and p!=origin]
   if not self.cargo and changed and all(recoloring(a[p],b[p]) for p in changed):
    components=groups({p:a[p] for p in changed})
    if len(components)==1 and any(abs(p[0]-origin[0])+abs(p[1]-origin[1])==1 for p in changed):
     self.interaction=command['action_ref'];self.cargo={'ref':'cargo:'+ref([before['observation_ref'],changed]),'source_glyphs':[list(g) for g in sorted({a[p] for p in changed})],'held_glyphs':[list(g) for g in sorted({b[p] for p in changed})],'cells':[list(p) for p in changed],'offsets':[list(p) for p in offsets(changed,origin)],'status':'attachment_hypothesis','evidence':refs}
     self.grasp_methods.append({'source_glyphs':deepcopy(self.cargo['source_glyphs']),'command':command['action_ref'],'adjacent_offsets':[list(p) for p in self.cargo['offsets'] if abs(p[0])+abs(p[1])==1],'evidence':refs})
     event={'status':'same_mask_recolored_adjacent_to_carrier','cargo_ref':self.cargo['ref'],'offsets':self.cargo['offsets'],'evidence':refs}
   elif self.cargo and command['action_ref']==self.interaction:
    cargo=self.cargo;present=[p for p,g in b.items() if g in [tuple(x) for x in cargo['held_glyphs']]];new=offsets(present,origin);turns=[q for q in [1,2,3] if turned(cargo['offsets'],q)==new]
    if not present and all(b.get(tuple(p)) in [tuple(g) for g in cargo['source_glyphs']] for p in cargo['cells']):
     support={self.base.get(tuple(p)) for p in cargo['cells']};cargo['status']='detachment_hypothesis';cargo['release_evidence']=refs;cargo['release_support']=list(next(iter(support))) if len(support)==1 and None not in support else None
     event={'status':'same_identity_release_hypothesis','cargo_ref':cargo['ref'],'covered_support':cargo['release_support'],'evidence':refs,'falsifier':'subsequent_carrier_translation_still_moves_cargo'}
    elif len(present)==len(cargo['offsets']) and len(turns)==1:
     site=self.base.get(origin);effect={'status':'conditional_relative_rotation_observed','quarter_turns':turns[0],'site_glyph':list(site) if site else None,'command':command['action_ref'],'evidence':refs,'before_offsets':deepcopy(cargo['offsets']),'after_offsets':[list(p) for p in new]}
     cargo['offsets']=[list(p) for p in new];cargo['cells']=[list(p) for p in present];cargo['status']='attachment_attested';self.stations[ref(site)]={'glyph':list(site),'quarter_turns':turns[0],'evidence':refs};event=effect
     occupied={origin}|set(present)
     for p in b:
      if p not in occupied:self.base[p]=b[p]
  elif command['action_ref']==self.interaction and self.cargo:
   context=self.context(first);self.trials[context]={'command':command['action_ref'],'evidence':refs,'status':'no_effect_in_this_composition'};event={'status':'conditional_interaction_no_effect','context':context,'evidence':refs}
  elif self.moves.get(command['action_ref'],{}).get('recalled_hypothesis'):
   method=self.moves[command['action_ref']];context=self.motion_context(origin,method['delta']);method['blocked_contexts']=list(dict.fromkeys(method.get('blocked_contexts',[])+[context]))[-32:]
   event={'status':'portable_motion_blocked_in_current_composition','context':context,'evidence':refs,'mapping_refuted':False}
  if event:self.effects.append(event)
  return event
 def state(self):
  return {'grid':self.grid,'body':self.body,'wall':self.wall,'base':[[*p,list(g)] for p,g in self.base.items() if g is not None],'moves':self.moves,'interaction':self.interaction,'cargo':self.cargo,'effects':self.effects,'stations':self.stations,'trials':self.trials,'epoch':self.epoch,'floor':[list(g) for g in self.floor],'settled':self.settled,'receivers':self.receivers,'grasp_methods':self.grasp_methods,'initial_support':list(self.initial_support) if self.initial_support else None,'portable':self.portable,'recall':self.recall}
 def restore(self,state):
  self.portable=deepcopy(state.get('portable'));self.recall=deepcopy(state.get('recall'))
  self.__dict__.update(deepcopy(state));self.base={(x,y):tuple(g) for x,y,g in state['base']};self.floor={tuple(g) for g in state['floor']};self.body=tuple(state['body']) if state['body'] else None;self.wall=tuple(state['wall']) if state['wall'] else None;self.settled=deepcopy(state.get('settled',[]));self.receivers=deepcopy(state.get('receivers',{}));self.grasp_methods=deepcopy(state.get('grasp_methods',[]));self.initial_support=tuple(state['initial_support']) if state.get('initial_support') else None
