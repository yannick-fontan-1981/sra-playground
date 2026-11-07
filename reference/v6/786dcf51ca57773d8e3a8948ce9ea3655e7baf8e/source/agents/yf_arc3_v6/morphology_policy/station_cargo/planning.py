"""Conditional composition access using V5's pure whole-carrier geometry."""
from collections import deque,Counter
from agents.yf_arc3_v5.capabilities.station_gated_cargo import StationCargoState,StationCargo,CargoTerrain,_translate
from .geometry import groups,ref,turned

def partition(glyph):
 values={};return tuple(values.setdefault(v,len(values)) for v in glyph)

def build_state(tracker,rows,extra_support,observation,remaining):
 located=tracker.locate(rows)
 if not located:return None
 cells,origin=located;cargo=tracker.cargo;attached=bool(cargo) and cargo['status']!='detachment_hypothesis';own={origin}|({tuple(p) for p in cargo['cells']} if attached else set());allowed=set(extra_support)|own
 terrain=[]
 for p,glyph in tracker.base.items():
  supported=glyph in tracker.floor or p in allowed
  terrain.append(CargoTerrain(x=p[0],y=p[1],support='SUPPORTED' if supported else 'BLOCKED',evidence_ref=observation if glyph in tracker.floor else 'hypothesis:composition_access:'+observation))
 item=StationCargo(cargo_ref=cargo['ref'],type_ref='measured_appearance:'+ref(cargo['source_glyphs']),origin_x=origin[0],origin_y=origin[1],offsets=tuple(tuple(p) for p in cargo['offsets']),orientation=0,delivered=False,mask_evidence_ref=cargo['evidence'][-1]) if cargo else None
 return StationCargoState(carrier_x=origin[0],carrier_y=origin[1],carrier_offsets=((0,0),),cargo=(item,) if item else (),attached_cargo_ref=item.cargo_ref if attached else None,terrain=tuple(terrain),receivers=(),stations=(),required_cargo_refs=(),remaining_budget=remaining,level_scope_ref=observation,restore_epoch=tracker.epoch,status='ACTIVE',input_tick=0)

def route(tracker,rows,targets,extra_support,observation,remaining):
 initial=build_state(tracker,rows,extra_support,observation,remaining)
 if initial is None:return None
 origin=(initial.carrier_x,initial.carrier_y);queue=deque([(initial,[])]);seen={origin};targets=set(targets)
 while queue:
  state,actions=queue.popleft();pose=(state.carrier_x,state.carrier_y)
  if pose in targets:return {'actions':actions,'carrier':list(pose),'expanded_states':len(seen),'backend':'station_gated_cargo._translate','support_hypotheses':sorted(extra_support)}
  if len(actions)>=remaining:continue
  for command,method in sorted(tracker.moves.items()):
   if tracker.motion_context(pose,method['delta']) in method.get('blocked_contexts',[]):continue
   dx,dy=method['delta'];after,events,debt,count,cut=_translate(state,dx,dy,4096)
   destination=(after.carrier_x,after.carrier_y)
   if debt or cut or destination==pose or destination in seen:continue
   seen.add(destination);queue.append((after,actions+[{'action_ref':command}]))
 return None

def offers(tracker,rows,observation,remaining):
 if not tracker.interaction:return []
 located=tracker.locate(rows)
 if not located:return []
 cells,origin=located;cargo=tracker.cargo
 if cargo is None:
  settled={tuple(p) for item in tracker.settled for p in item['cells']};known={tuple(g) for m in tracker.grasp_methods for g in m['source_glyphs']};partitions={partition(g) for g in known};candidates=[]
  for group in groups(tracker.base):
   points=set(group['cells']);glyph=group['glyph']
   if glyph in tracker.floor or glyph==tracker.wall or glyph==tracker.body or points&settled or partition(glyph) not in partitions:continue
   adjacency=[(x+dx,y+dy) for x,y in points for dx,dy in [(0,-1),(1,0),(0,1),(-1,0)] if (x+dx,y+dy) not in points]
   access=route(tracker,rows,adjacency,set(),observation,max(0,remaining-1))
   if access:candidates.append({'kind':'probe_known_grasp' if glyph in known else 'probe_analogous_grasp','target_cells':sorted(points),'access':access,'operation':'OP18','effect_hypotheses':['attach','other_effect','no_effect'],'goal':'acquire_another_cargo_without_reentering_released_objects','actions':access['actions']+[{'action_ref':tracker.interaction}],'evidence':[observation]+[v for m in tracker.grasp_methods for v in m['evidence']],'falsifiers':['current_object_identity_or_access_changed'],'preserve':['released_cargo_obstacles','all_unaddressed_objects'],'interaction':True,'cargo_moves':False})
  from .continuation import grasp_offers
  conditional,diagnostics=grasp_offers(tracker,rows,observation,remaining)
  for offer in conditional:offer['alternative_grips']=[{'target_cells':item['target_cells'],'grasp_pose':item['grasp_pose'],'status':item['forecast']['status'],'reason':item['forecast'].get('reason')} for item in diagnostics][:24]
  return candidates+conditional
 if cargo['status']=='detachment_hypothesis':
  candidates=[]
  for command,method in sorted(tracker.moves.items()):
   dx,dy=method['delta'];access=route(tracker,rows,[(origin[0]+dx,origin[1]+dy)],set(),observation,1)
   if access and len(access['actions'])==1:candidates.append({'kind':'probe_separation','target_cells':cargo['cells'],'access':access,'operation':'OP18','effect_hypotheses':['carrier_alone','cargo_still_follows','blocked'],'goal':'confirm_release_by_independent_motion','actions':access['actions'],'evidence':cargo['release_evidence']+[observation],'falsifiers':['released_mask_not_stationary'],'preserve':['cargo_identity'],'interaction':False,'cargo_moves':False})
  return candidates
 if cargo['status'] not in ('attachment_hypothesis','attachment_attested'):return []
 source_partitions={partition(g) for g in cargo['source_glyphs']};own={origin}|{tuple(p) for p in cargo['cells']}
 candidates=[]
 if cargo['status']=='attachment_hypothesis':
  for command,method in sorted(tracker.moves.items()):
   dx,dy=method['delta'];access=route(tracker,rows,[(origin[0]+dx,origin[1]+dy)],set(),observation,1)
   if access and len(access['actions'])==1:
    candidates.append({'kind':'probe_joint_motion','target_cells':[],'access':access,'operation':'OP18','effect_hypotheses':['joint_translation','carrier_only','blocked','other_effect'],'goal':'discriminate_attachment_from_recoloring','actions':access['actions'],'evidence':cargo['evidence']+[observation],'falsifiers':['mask_identity_or_offsets_change'],'preserve':['unaddressed_objects'],'interaction':False,'cargo_moves':True})
  return candidates
 for group in groups(tracker.base):
  glyph=group['glyph'];points=set(group['cells'])
  if (glyph==tracker.initial_support if tracker.initial_support is not None else glyph in tracker.floor) or glyph==tracker.wall or glyph==tracker.body or partition(glyph) in source_partitions:continue
  if any(x in (0,tracker.grid['width']-1) or y in (0,tracker.grid['height']-1) for x,y in points):continue
  # Current exact coverage is a hypothesis of conditional release, not receiver truth.
  coverage=[]
  if len(points)>=len(cargo['offsets']):
   for x,y in points:
    for dx,dy in cargo['offsets']:
     p=(x-dx,y-dy)
     if {(p[0]+a,p[1]+b) for a,b in cargo['offsets']}<=points:coverage.append(p)
  if coverage:
   access=route(tracker,rows,coverage,points,observation,max(0,remaining-1))
   learned=tracker.receivers.get(ref(cargo['source_glyphs'])) or (tracker.portable['receivers'].get(ref(cargo['source_glyphs'])) if tracker.recall else None);compatible=learned is None or list(glyph)==learned['support_glyph']
   if access and compatible and tracker.context_at(access['carrier']) not in tracker.trials:candidates.append({'kind':'probe_complete_coverage','target_cells':sorted((access['carrier'][0]+a,access['carrier'][1]+b) for a,b in cargo['offsets']),'support_region_cells':sorted(points),'support_relation':'equal' if len(points)==len(cargo['offsets']) else 'proper_subset','target_glyph':list(glyph),'access':access,'operation':'OP18','effect_hypotheses':['detach','relative_pose_change','other_effect','no_effect'],'goal':'cargo_whole_mask_is_contained_in_visible_compatible_support'})
  access=route(tracker,rows,points,points,observation,max(0,remaining-1))
  if access:
   # Avoid repeating an identical present interaction context; moving to a different
   # support remains a distinct condition to test.
   if tracker.context_at(access['carrier']) in tracker.trials:continue
   candidates.append({'kind':'probe_distinct_carrier_support','target_cells':sorted(points),'target_glyph':list(glyph),'access':access,'operation':'OP18','effect_hypotheses':['detach','relative_pose_change','other_effect','no_effect'],'goal':'test_interaction_condition_on_distinct_visible_support'})
 for candidate in candidates:
  candidate['actions']=candidate['access']['actions']+[{'action_ref':tracker.interaction}]
  candidate['evidence']=list(dict.fromkeys(cargo['evidence']+[observation]+[ref for method in tracker.moves.values() for ref in method['evidence']]))
  candidate['falsifiers']=['carrier_or_cargo_deviates_from_whole_body_translation','unexpected_scope_change','inferred_support_blocks_access','interaction_effect_differs_from_declared_alternatives']
  candidate['preserve']=['cargo_identity','all_unaddressed_objects','carrier_cargo_relative_pose_during_translation']
  candidate['interaction']=True
  candidate['cargo_moves']=True
  if tracker.recall:
   candidate['evidence']=list(dict.fromkeys(candidate['evidence']+tracker.recall['evidence']))
   candidate['portable_method_hypothesis']={'status':tracker.recall['status'],'falsifiers':tracker.recall['falsifiers'],'release_method':tracker.portable['receivers'].get(ref(cargo['source_glyphs']))}
 return candidates
