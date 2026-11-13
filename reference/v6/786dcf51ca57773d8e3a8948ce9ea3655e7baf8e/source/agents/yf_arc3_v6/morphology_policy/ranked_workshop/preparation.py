"""Finite conditional preparation paths from public profiles and observed inputs.

No engine access, named game, fixed control, tool law or accepted receipt is
provided here. Numerical paths are projections whose meaning/order lives in DRM.
"""
from copy import deepcopy
from .methods import profiles, supports, relations, mode_signature

def band_index(scene,profile):
 y=profile['profile']['stem_relief_stem_origin'][0]
 bands=sorted(scene.get('receiver_bindings',[]),key=lambda r:r['bbox'])
 found=[i for i,r in enumerate(bands) if r['bbox'][0]<=y<=r['bbox'][2]]
 return found[0] if len(found)==1 else None

def control(owner,obs,held,sign):
 found=[]
 for item in owner.input_effects:
  action=item['action']
  if item.get('held_before')!=held or item.get('held_after')!=held or item.get('vertical_sign')!=sign or not item.get('same_profile_multiset') or not item.get('changes',{}).get('marker_moved'):continue
  if held and not item.get('marked_profile_preserved'):continue
  if action['action_ref'] not in obs['available_action_refs'] or action.get('data'):continue
  if item.get('slot_delta')!=sign:continue
  found.append(item)
 actions={x['action']['action_ref'] for x in found}
 return found[-1] if len(actions)==1 else None

def grasp(owner,obs,context):
 found=[m for m in owner.mode_methods if m['signature']==mode_signature(context) and any(x['change']==[0,1] for x in m['contrasts']) and m['action']['action_ref'] in obs['available_action_refs'] and not m['action'].get('data') and [m['ref'],obs['level_epoch']] not in owner.method_refutations]
 return found[-1] if len({m['action']['action_ref'] for m in found})==1 else None

def _model_key(model):return tuple(model['rank_permutation']),model['value_delta']
def _apply(model,profile):
 permutation,delta=_model_key(model)
 return tuple(profile[i]+delta for i in permutation) if sorted(permutation)==list(range(len(profile))) else None

def preparation_options(owner,obs,rows,scene,context,current,inputs,remaining):
 # This extension is the continuation of measured progress, not a new cold policy.
 if not (0<context.get('station_profile_zero_cut_contour_agreement_count',0)<context.get('station_profile_receiver_binding_count',0)):return []
 if not owner.mode_evidence:return []
 cohort=profiles(scene);bands=sorted(scene.get('receiver_bindings',[]),key=lambda r:r['bbox']);current_band=band_index(scene,current);held=context.get('station_profile_inner_singleton_count')==1
 if current_band is None:return []
 targets=[(i,r) for i,r in enumerate(bands) if any(r['cut_measurements']['signed_cut_offsets'])]
 glyphs=supports(obs,scene);options=[]
 # Inputs already evidenced as focus/mode/acceptance are not invented as tools.
 known_other={e['action']['action_ref'] for e in owner.input_effects if e['changes']['mode_toggle'] or e['changes']['marker_moved'] or e['changes']['receiver_changed']}
 unknown_actions=[dict(a) for a in inputs if a['action_ref'] not in known_other and not a.get('data')]
 # Point-bound controls are excluded by the measured input domain in the caller.
 for carrier in cohort:
  profile=tuple(carrier['profile']['stem_relief_rank_height_pixels']);carrier_band=band_index(scene,carrier)
  if carrier_band is None or (held and carrier['component_ref']!=current['component_ref']):continue
  if any(profile==tuple(r['cut_measurements']['signed_cut_offsets']) for _,r in targets):continue
  for receiver_band,receiver in targets:
   target=tuple(receiver['cut_measurements']['signed_cut_offsets']);desired=relations(profile,target,len(rows))
   if not desired:continue
   for glyph in glyphs:
    site_indices=[i for i,r in enumerate(bands) if r['bbox']==glyph['band']]
    if len(site_indices)!=1:continue
    site=site_indices[0]
    observations=[x for x in owner.operator_observations if x['source_epoch']==obs['level_epoch'] and x['support'].get('appearance_sha256')==glyph.get('appearance_sha256') and x['support']['bbox']==glyph['bbox'] and x['other_profiles_and_receivers_preserved']]
    observed=bool(observations);tool_actions={x['action']['action_ref'] for x in observations};model_keys=None
    if observed:
     for item in observations:
      keys={_model_key(m) for m in item['models']};model_keys=keys if model_keys is None else model_keys&keys
     if not model_keys or len(tool_actions)!=1:continue
     predictions={_apply({'rank_permutation':list(k[0]),'value_delta':k[1]},profile) for k in model_keys}
     if predictions!={target}:continue
     tool=[deepcopy(observations[-1]['action'])];models=[{'rank_permutation':list(k[0]),'value_delta':k[1],'status':'observed_pairs_conditional_extension'} for k in sorted(model_keys)]
    else:tool=unknown_actions;models=desired
    for tool_action in tool:
     if tool_action['action_ref'] not in obs['available_action_refs'] or tool_action.get('data'):continue
     focus_sign=(carrier_band>current_band)-(carrier_band<current_band);support_sign=(site>carrier_band)-(site<carrier_band);return_sign=(receiver_band>site)-(receiver_band<site)
     focus_control=control(owner,obs,False,focus_sign) if focus_sign else None
     support_control=control(owner,obs,True,support_sign) if support_sign else None
     return_control=control(owner,obs,True,return_sign) if return_sign else None
     mode=grasp(owner,obs,context) if not held else None
     if (focus_sign and not focus_control) or (support_sign and not support_control) or (return_sign and not return_control) or (not held and not mode):continue
     # Conditional geometric cost, never a pre-certified global transition model.
     cost=abs(carrier_band-current_band)+(0 if held else 1)+abs(site-carrier_band)+1+abs(receiver_band-site)+1
     if cost>remaining:continue
     obligations=[]
     if focus_sign:obligations.append(('focus',focus_control['action']))
     if not held:obligations.append(('grasp',mode['action']))
     if support_sign:obligations.append(('access_support',support_control['action']))
     obligations.append(('transform',tool_action))
     first,action=obligations[0];evidence=[obs['observation_ref']]
     for item in (focus_control,support_control,return_control):
      if item:evidence+=item['evidence']
     if mode:evidence += [e for c in mode['contrasts'] for e in c['evidence']]
     evidence += [e for item in observations for e in item['evidence']]
     options.append({'kind':'prepare_observed_receiver' if observed else 'prepare_unknown_receiver','action':deepcopy(action),'support':glyph,'method_ref':'conditional_preparation:'+glyph['appearance_sha256'],'objective_key':[carrier['component_ref'],receiver['enclosure_component_ref']],'consumer':{'receiver_ref':receiver['enclosure_component_ref'],'target_profile':list(target),'evidence':obs['observation_ref']},'carrier':{'ref':carrier['component_ref'],'profile':list(profile),'band':carrier_band},'consumers':[{'receiver_ref':receiver['enclosure_component_ref'],'target_profile':list(target),'models':models}],'relation_models':models,'obligation':first,'obligations':[{'kind':k,'action':deepcopy(a)} for k,a in obligations],'estimated_actions_to_test':cost,'observed_support_model':observed,'evidence':list(dict.fromkeys(evidence)),'facts':{'conditional_preparation_bound':True,'remaining_action_cost_admissible':True},'unknown':['control_extension_to_current_layout','operator_domain_and_atomic_refusal','unchanged_receipts_after_carrier_transit','conditional_path_not_complete_workshop_model']+([] if observed else ['support_transform_law_and_input_binding_unknown']),'preserve':['other_profile_values','receipt_evidence','carrier_identity_until_transformation']})
 return options


def support_relation_admissible(owner,obs,glyph,profile,targets):
 observations=[x for x in owner.operator_observations if x['source_epoch']==obs['level_epoch'] and x['support'].get('appearance_sha256')==glyph.get('appearance_sha256') and x['support']['bbox']==glyph['bbox'] and x['other_profiles_and_receivers_preserved']]
 if not observations:return True
 keys=None
 for item in observations:
  current={_model_key(m) for m in item['models']};keys=current if keys is None else keys&current
 if not keys:return False
 predictions={_apply({'rank_permutation':list(k[0]),'value_delta':k[1]},profile) for k in keys}
 return len(predictions)==1 and next(iter(predictions)) in {tuple(t['target_profile']) for t in targets}
