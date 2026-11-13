"""Conditional whole-composition access; no hidden law or terminal predicate."""
from collections import deque
from copy import deepcopy
from agents.yf_arc3_v5.capabilities.station_gated_cargo import CargoStation,_translate,_pivot
from .geometry import groups,ref,offsets

def forecast(tracker,rows,points,glyph,pose,observation,remaining,maximum_states=768):
 from .planning import build_state
 prior=tracker.portable if tracker.recall else None
 source_key=ref([list(glyph)])
 method=(tracker.receivers.get(source_key) or prior['receivers'].get(source_key)) if prior else None
 if not method or not method.get('evidence'):return {'status':'unknown','reason':'no_observed_release_method_for_this_current_appearance'}
 targets=[set(g['cells']) for g in groups(tracker.base) if list(g['glyph'])==method['support_glyph'] and len(g['cells'])>=len(points)]
 if not targets:return {'status':'unknown','reason':'no_current_congruent_support_for_observed_method'}
 copy=deepcopy(tracker);mask=offsets(points,pose);copy.cargo={'ref':'hypothesis:prospective_cargo:'+ref(sorted(points)),'source_glyphs':[list(glyph)],'held_glyphs':[],'cells':[list(p) for p in points],'offsets':[list(p) for p in mask],'status':'attachment_hypothesis','evidence':[observation]}
 stations=[];station_evidence=[];extra=set(points)|set().union(*targets)
 for group in groups(tracker.base):
  learned=tracker.stations.get(ref(group['glyph'])) or prior['stations'].get(ref(group['glyph']))
  if not learned or not learned.get('evidence'):continue
  turn=learned['quarter_turns'];turn=-1 if turn==3 else turn
  if turn not in (-1,1,2):continue
  sites=tuple(tuple(p) for p in group['cells']);extra.update(sites);station_evidence.extend(learned['evidence'])
  stations.append(CargoStation(station_ref='hypothesis:current_station:'+ref(sites),carrier_support_cells=sites,pivot_x=0,pivot_y=0,pivot_frame='CARRIER_RELATIVE',licensed_quarter_turns=(turn,),collision_scope='FINAL_MASK',law_evidence_ref=None))
 state=build_state(copy,rows,extra,observation,remaining)
 if state is None:return {'status':'unknown','reason':'current_carrier_not_bound'}
 cargo=state.cargo[0].model_copy(update={'origin_x':pose[0],'origin_y':pose[1]})
 state=state.model_copy(update={'carrier_x':pose[0],'carrier_y':pose[1],'cargo':(cargo,),'stations':tuple(stations)})
 queue=deque([(state,[])]);seen={(pose,tuple(mask))};cuts=False;refusals=[]
 while queue:
  current,actions=queue.popleft();item=current.cargo[0];body=(current.carrier_x,current.carrier_y);world={(body[0]+dx,body[1]+dy) for dx,dy in item.offsets}
  if any(world<=target for target in targets):
   region=next(target for target in targets if world<=target)
   return {'status':'conditional_access','actions_after_grasp':actions+[{'action_ref':tracker.interaction}],'goal_cells':sorted(world),'support_region_cells':sorted(region),'support_relation':'equal' if world==region else 'proper_subset','expanded_states':len(seen),'evidence':list(dict.fromkeys(method['evidence']+station_evidence+tracker.recall['evidence']+[observation])),'conditions':['same_grasp_and_release_methods_revalidated_by_current_appearance','mapped_controls_remain_hypotheses_until_local_motion','support_under_acquired_object_remains_accessible','station_effect_and_final_mask_collision_scope_are_hypotheses','no_unobserved_autonomous_change_during_prefix'],'falsifiers':['pickup_does_not_preserve_identity','composition_translation_or_rotation_differs','covered_pattern_does_not_release'],'meaning':'forecast_of_useful_coverage_not_terminal_success'}
  if len(actions)>=remaining-1:cuts=True;continue
  branches=[]
  for command,motion in sorted(tracker.moves.items()):
   after,events,debt,_,cut=_translate(current,*motion['delta'],4096)
   if not debt and not cut and (after.carrier_x,after.carrier_y)!=body:branches.append((after,{'action_ref':command}))
  for station in stations:
   if body not in station.carrier_support_cells:continue
   for turn in station.licensed_quarter_turns:
    after,events,debt,_,cut=_pivot(current,station.station_ref,turn,4096,allow_hypothetical=True)
    if events and events[0]['kind']=='ROTATION_REFUSED':refusals.append({'station_ref':station.station_ref,'mask':events[0].get('exact_refusal_mask',())})
    if not debt and not cut and after!=current:branches.append((after,{'action_ref':tracker.interaction,'conditional_effect':'relative_rotation'}))
  for after,command in branches:
   key=((after.carrier_x,after.carrier_y),tuple(after.cargo[0].offsets))
   if key in seen:continue
   if len(seen)>=maximum_states:cuts=True;continue
   seen.add(key);queue.append((after,actions+[command]))
 return {'status':'unknown','reason':'bounded_search_incomplete' if cuts else 'no_access_under_current_conditional_model','expanded_states':len(seen),'rotation_refusal_masks':refusals[:8],'physical_impossibility_proved':False}

def grasp_offers(tracker,rows,observation,remaining):
 from .planning import route
 if not tracker.recall:return [],[]
 settled={tuple(p) for item in tracker.settled for p in item['cells']};known={tuple(g) for method in tracker.grasp_methods for g in method['source_glyphs']};result=[];diagnostics=[]
 approach_support=set()
 for group in groups(tracker.base):
  method=tracker.stations.get(ref(group['glyph'])) or tracker.portable['stations'].get(ref(group['glyph']))
  if method and method.get('evidence'):approach_support.update(group['cells'])
 known_groups=[g for g in groups(tracker.base) if g['glyph'] in known and not set(g['cells'])&settled]
 for group in groups(tracker.base):
  points=set(group['cells']);glyph=group['glyph']
  if glyph not in known or points&settled:continue
  adjacent=sorted({(x+dx,y+dy) for x,y in points for dx,dy in [(0,-1),(1,0),(0,1),(-1,0)] if (x+dx,y+dy) not in points})
  for pose in adjacent:
   contacts=[g for g in known_groups if any(abs(x-pose[0])+abs(y-pose[1])==1 for x,y in g['cells'])]
   if len(contacts)!=1:
    diagnostics.append({'target_cells':sorted(points),'grasp_pose':pose,'forecast':{'status':'unknown','reason':'multiple_adjacent_objects_without_observed_selector'}});continue
   access=route(tracker,rows,[pose],approach_support,observation,max(0,remaining-2))
   if not access:continue
   prediction=forecast(tracker,rows,points,glyph,pose,observation,remaining-len(access['actions'])-1)
   diagnostics.append({'target_cells':sorted(points),'grasp_pose':pose,'forecast':prediction})
   if prediction['status']!='conditional_access':continue
   result.append({'kind':'probe_grasp_with_supported_continuation','target_cells':sorted(points),'access':access,'operation':'OP18','effect_hypotheses':['attach','other_effect','no_effect'],'goal':'acquire_cargo_with_a_current_conditional_path_to_useful_coverage','actions':access['actions']+[{'action_ref':tracker.interaction}],'evidence':prediction['evidence']+[v for m in tracker.grasp_methods for v in m['evidence']],'falsifiers':prediction['falsifiers'],'preserve':['released_cargo_obstacles','all_unaddressed_objects'],'interaction':True,'cargo_moves':False,'continuation_forecast':prediction})
 return result,diagnostics
