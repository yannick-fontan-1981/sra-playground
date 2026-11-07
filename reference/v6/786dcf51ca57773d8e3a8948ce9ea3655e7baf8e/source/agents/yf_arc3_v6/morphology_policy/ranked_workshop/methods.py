"""Bounded geometric relations and current experiments, never creator laws."""
from types import SimpleNamespace
import hashlib,json
from copy import deepcopy
from agents.yf_arc3_v5.capabilities.station_profile_workbench import _operator
from .geometry import stable_context

class Budget:
 def __init__(self):self.count=0
 def visit(self,value):
  self.count+=1
  if self.count>128:raise ValueError('bounded_operator_relation_domain')

def mode_signature(context):
 return {'receiver_side':context.get('station_profile_marked_receiver_horizontal_sign'),'corner_quartets':context.get('station_profile_corner_quartet_count'),'reference_packets':bool(context.get('station_profile_reference_packet_count'))}

def profiles(scene):
 keep=set(scene.get('comparison_domain',{}).get('admitted_profile_refs',[]))
 # Match station_profile_scene.station_profile_context: a displayed stem may
 # overhang its frame; its measured rank cores, not full bbox, bind the copy.
 def ranks_inside(profile,box):
  return all(box[0]<=row<=box[2] and box[1]<=col<=col+profile['stem_relief_rank_width_pixels']-1<=box[3] for row,col in profile['stem_relief_rank_origins'])
 return [p for p in scene.get('profiles',[]) if p['component_ref'] in keep and not any(ranks_inside(p['profile'],b['bbox']) for b in scene.get('reference_packets',[]))]

def values(scene):return sorted((p['bbox'],p['profile']['stem_relief_rank_height_pixels']) for p in profiles(scene))

def changes(a,ca,b,cb):
 return {'mode_toggle':bool(ca and cb and {ca.get('station_profile_inner_singleton_count'),cb.get('station_profile_inner_singleton_count')}=={0,1} and {k:v for k,v in stable_context(ca).items() if k!='station_profile_inner_singleton_count'}=={k:v for k,v in stable_context(cb).items() if k!='station_profile_inner_singleton_count'}),
 'marker_moved':ca.get('station_profile_marker_bbox')!=cb.get('station_profile_marker_bbox'),
 'receiver_changed':ca.get('station_profile_zero_cut_contour_agreement_count')!=cb.get('station_profile_zero_cut_contour_agreement_count'),
 'profile_geometry_changed':values(a)!=values(b)}

def relations(profile,target,height):
 """Hypothetical rank permutations/uniform shifts; bounded by visible raster only.

 This interval is a measurement domain, never a game tool limit. A fitted
 relation is a library explanation of this pair, not a globally acquired law.
 """
 if len(profile)!=len(target) or tuple(profile)==tuple(target):return []
 n=len(profile);permutations={tuple(range(n)),tuple(reversed(range(n)))}
 permutations.update(tuple((j+i)%n for j in range(n)) for i in range(n))
 budget=Budget();result=[];domain=SimpleNamespace(minimum_value=0,maximum_value=height)
 for permutation in sorted(permutations):
  delta={target[j]-profile[permutation[j]] for j in range(n)}
  if len(delta)!=1:continue
  shift=next(iter(delta));operator=SimpleNamespace(operator_ref='hypothetical_rank_value_relation',rank_permutation=permutation,value_delta=shift,value_relation=())
  predicted,refusal=_operator(domain,operator,tuple(profile),budget)
  if not refusal and tuple(predicted)==tuple(target):result.append({'rank_permutation':list(permutation),'value_delta':shift,'domain':'visible_raster_measurement_extent_only','law_status':'hypothesis_for_observed_or_desired_pair'})
 return result

def supports(obs,scene):
 cohort=profiles(scene);receivers=scene.get('receiver_bindings',[]);out=[]
 for e in obs['entities']:
  l,t,r,b=e['bbox'];w=r-l+1;h=b-t+1
  if min(w,h)<3:continue
  mask=set(map(tuple,e['mask']));perimeter={(x,y) for y in (0,h-1) for x in range(w)}|{(x,y) for x in (0,w-1) for y in range(h)}
  if not perimeter.issubset(mask):continue
  if any(t<=q['bbox'][0] and q['bbox'][2]<=b and l<=q['bbox'][1] and q['bbox'][3]<=r for q in cohort):continue
  # A contacting handle is part of the carrier candidate, not a separated support.
  if any(l<=q['bbox'][3]+1 and q['bbox'][1]<=r+1 and t<=q['bbox'][2]+1 and q['bbox'][0]<=b+1 for q in cohort):continue
  if any(list(e['bbox'])==[q['bbox'][1],q['bbox'][0],q['bbox'][3],q['bbox'][2]] for q in receivers):continue
  bands=[q for q in receivers if q['bbox'][0]<=((t+b)/2)<=q['bbox'][2]]
  if len(bands)!=1:continue
  same=[q for q in cohort if bands[0]['bbox'][0]<=q['profile']['stem_relief_stem_origin'][0]<=bands[0]['bbox'][2]]
  if len(same)!=1:continue
  carrier=same[0];receiver=bands[0]
  opposite=(r<carrier['bbox'][1]<receiver['bbox'][1] or receiver['bbox'][3]<carrier['bbox'][3]<l)
  if opposite:out.append({'ref':e['id'],'bbox':e['bbox'],'signature':e['signature'],'appearance_sha256':support_appearance(obs,e['bbox']),'band':receiver['bbox'],'evidence':obs['observation_ref'],'role':'unresolved_framed_glyph_opposite_receiver'})
 return out

def extension_options(owner,obs,rows,scene,context,inputs,remaining):
 cohort=profiles(scene);marked=[p for p in cohort if p['component_ref']==context.get('station_profile_unique_marked_profile_ref')]
 if len(marked)!=1:return []
 marker=context.get('station_profile_marker_bbox');current=marked[0];options=[]
 for method in owner.mode_methods:
  if method['action']['action_ref'] in obs['available_action_refs'] and not method['action'].get('data') and method['signature']==mode_signature(context) and {tuple(x['change']) for x in method['contrasts']}=={(0,1),(1,0)} and context.get('station_profile_inner_singleton_count')==0 and not owner.mode_evidence and [method['ref'],obs['level_epoch']] not in owner.method_refutations:
   options.append({'kind':'revalidate_mode','action':deepcopy(method['action']),'method_ref':method['ref'],'evidence':[x for c in method['contrasts'] for x in c['evidence']],'unknown':['same_input_may_have_new_context_condition'],'relation_models':[]})
 from .preparation import preparation_options,support_relation_admissible
 options.extend(preparation_options(owner,obs,rows,scene,context,current,inputs,remaining))
 if context.get('station_profile_inner_singleton_count')!=1 or not owner.mode_evidence:return options
 profile=current['profile']['stem_relief_rank_height_pixels'];wanted=[]
 for receiver in scene.get('receiver_bindings',[]):
  cut=receiver['cut_measurements'];target=cut['signed_cut_offsets']
  if all(x==0 for x in target):continue
  models=relations(profile,target,len(rows))
  if models:wanted.append({'receiver_ref':receiver['enclosure_component_ref'],'target_profile':list(target),'models':models,'evidence':obs['observation_ref']})
 options.extend(prepared_receiver_access(owner,obs,scene,context,current))
 if not wanted:return options
 # If an exact current consumer exists, its preparation is already useful.
 if any(tuple(profile)==tuple(x['cut_measurements']['signed_cut_offsets']) for x in scene.get('receiver_bindings',[])):return options
 glyphs=supports(obs,scene)
 known_other={e['action']['action_ref'] for e in owner.input_effects if e['changes']['mode_toggle'] or e['changes']['marker_moved'] or e['changes']['receiver_changed']}
 available=[a for a in inputs if not a.get('data') and a['action_ref'] not in known_other]
 for glyph in glyphs:
  relation_admissible=support_relation_admissible(owner,obs,glyph,profile,wanted)
  same=glyph['band'][0]<=current['profile']['stem_relief_stem_origin'][0]<=glyph['band'][2]
  if same:
   for action in available:options.append({'kind':'probe_transform','facts':{'support_relation_admissible':relation_admissible},'action':deepcopy(action),'support':glyph,'consumers':wanted,'relation_models':wanted,'evidence':[obs['observation_ref']],'unknown':['glyph_is_not_yet_a_transform_station','input_is_not_yet_a_tool_binding','predicted_transform_is_not_yet_observed','atomic_refusal_domain_unknown']})
  else:
   sign=1 if glyph['band'][0]>current['profile']['stem_relief_stem_origin'][0] else -1
   for method in owner.input_effects:
    if method['action']['action_ref'] in obs['available_action_refs'] and not method['action'].get('data') and method['changes']['marker_moved'] and method.get('vertical_sign')==sign and method.get('same_profile_multiset'):
     options.append({'kind':'access_transform_support','facts':{'support_relation_admissible':relation_admissible},'action':deepcopy(method['action']),'support':glyph,'consumers':wanted,'relation_models':wanted,'evidence':method['evidence']+[obs['observation_ref']],'unknown':['held_motion_currently_conditional','glyph_is_not_yet_a_transform_station','this_is_access_to_an_experiment_not_an_acquired_tool_effect']})
 return options


def prepared_receiver_access(owner,obs,scene,context,current):
 """Extend a measured held-control method toward an exact remote consumer.

 Intermediate bands need not accept this profile. This is a one-primitive
 conditional access question; no display, tool or global planner law is filled.
 """
 if context.get('station_profile_inner_singleton_count')!=1:return []
 profile=tuple(current['profile']['stem_relief_rank_height_pixels']);origin=current['profile']['stem_relief_stem_origin'][0];offers=[]
 if any(tuple(r['cut_measurements']['signed_cut_offsets'])==profile and r['bbox'][0]<=origin<=r['bbox'][2] for r in scene.get('receiver_bindings',[])):return []
 for receiver in scene.get('receiver_bindings',[]):
  target=tuple(receiver['cut_measurements']['signed_cut_offsets']);band=receiver['bbox']
  if target!=profile or band[0]<=origin<=band[2]:continue
  sign=1 if band[0]>origin else -1
  for method in owner.input_effects:
   if not (method['changes']['marker_moved'] and method.get('vertical_sign')==sign and method.get('same_profile_multiset') and method.get('held_before') and method.get('held_after') and method.get('marked_profile_preserved')):continue
   action=method['action'];method_ref='held_direction:'+hashlib.sha256(json.dumps([action['action_ref'],sign]).encode()).hexdigest()
   if [method_ref,obs['level_epoch']] in owner.method_refutations:continue
   if action['action_ref'] not in obs['available_action_refs'] or action.get('data'):continue
   offers.append({'kind':'access_prepared_receiver','method_ref':method_ref,'action':deepcopy(action),'support':{'ref':receiver['enclosure_component_ref'],'bbox':[band[1],band[0],band[3],band[2]],'role':'current_exact_profile_receiver','evidence':obs['observation_ref']},'consumers':[{'receiver_ref':receiver['enclosure_component_ref'],'current_profile':list(profile),'target_profile':list(target),'equality_current':True,'evidence':obs['observation_ref']}],'relation_models':[],'facts':{'exact_receiver_match':True,'held_direction_evidence_present':True,'current_same_band_receiver_match':False},'evidence':method['evidence']+[obs['observation_ref']],'control_evidence':deepcopy(method),'unknown':['adjacent_control_extension_to_current_layout','intermediate_band_is_access_not_authentication','receiver_acceptance_still_requires_a_separate_test'],'preserve':['held_profile','other_profile_multiset','current_receipts_if_present']})
 return offers


def support_appearance(obs,bbox):
 l,t,r,b=bbox;pixels=[]
 for e in obs['entities']:
  x0,y0,x1,y1=e['bbox']
  if x1<l or r<x0 or y1<t or b<y0:continue
  pixels.extend((x0+x-l,y0+y-t,e['palette_value']) for x,y in e['mask'] if l<=x0+x<=r and t<=y0+y<=b)
 return hashlib.sha256(json.dumps(sorted(pixels)).encode()).hexdigest()
