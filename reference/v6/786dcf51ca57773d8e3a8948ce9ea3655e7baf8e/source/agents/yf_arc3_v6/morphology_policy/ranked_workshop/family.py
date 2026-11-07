"""Current SRC bridge for observed ranked-profile workshop questions."""
from pathlib import Path
from copy import deepcopy
import hashlib,json
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
from .geometry import project,stable_context
from .methods import extension_options,changes,mode_signature,profiles,relations
HERE=Path(__file__).resolve().parent

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def holds(conditions,facts):return all(_fact_condition_holds(DrmFactCondition.model_validate(c),facts) for c in conditions)

class RankedWorkshop:
 def __init__(self):
  self.loaded=load_drm_document(HERE/'workshop.drm');self.config=plain(self.loaded.document.declarations[0].configuration);self.epoch=None;self.mode_evidence=[];self.rejected=[];self.events=[];self.selected=None;self.src_calls=0;self.cache={};self.mode_methods=[];self.input_effects=[];self.method_refutations=[];self.operator_observations=[]
  self.src=SrcProgram(HERE/'workshop.src','v6.ranked_workshop.choose',{'workshop.measure':self.measure,'workshop.select':self.select})
 def projected(self,obs,rows):
  key=(obs['level_epoch'],obs['revision'],obs['frame_hash'])
  if key not in self.cache:
   self.cache[key]=project(obs,rows,self.config)
   while len(self.cache)>2:self.cache.pop(next(iter(self.cache)))
  return self.cache[key]
 def scope(self,obs):
  if self.epoch!=obs['level_epoch']:self.epoch=obs['level_epoch'];self.mode_evidence=[];self.rejected=[]
 def measure(self,request):return self.measured
 def select(self,measured):
  context=measured['context'];offers=[]
  for action in self.observation['available_action_refs']:
   facts={**context,'action_ref':action,'committed_plan_present':False}
   for rule in self.config['rules']:
    if holds(rule['all_conditions'],facts) and [rule['id'],digest(stable_context(context))] not in self.rejected:offers.append({'rule':rule,'action':{'action_ref':action},'kind':'legacy'})
  for option in measured.get('extensions',[]):
   if option['action']['action_ref'] not in self.observation['available_action_refs'] or option['action'].get('data'):continue
   facts={**context,'option_kind':option['kind'],**option.get('facts',{})}
   for rule in self.config['extension_rules']:
    if holds(rule['all_conditions'],facts) and [rule['id'],digest(stable_context(context))] not in self.rejected:offers.append({'rule':rule,'action':option['action'],'kind':option['kind'],'extension':option})
  order=self.config['choice_order'];rank=min((order.index(o['kind']) for o in offers),default=None)
  selected=[o for o in offers if order.index(o['kind'])==rank]
  fields=self.config.get('option_cost_fields',{}).get(selected[0]['kind'],[]) if selected else []
  if fields:
   cost=min(tuple(o['extension'][k] for k in fields) for o in selected);selected=[o for o in selected if tuple(o['extension'][k] for k in fields)==cost]
  # Equivalent control proposals are grouped; genuinely distinct current probes remain alternatives.
  grouped={digest([o['action'],o['rule']['id'],o.get('extension',{}).get('support',{}).get('ref'),o.get('extension',{}).get('objective_key')]):o for o in selected}
  self.selected=next(iter(grouped.values())) if len(grouped)==1 else None
  return {'selected':self.selected is not None,'alternatives':len(grouped)}
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs)
  if remaining<1:return None
  scene,context=self.projected(obs,rows)
  extensions=extension_options(self,obs,rows,scene,context,inputs,remaining) if context else []
  activation={'public_mode_toggle_contrast_observed':bool(self.mode_evidence),'portable_mode_question_present':any(o['kind']=='revalidate_mode' for o in extensions)}
  if not context or not (holds(self.config['activation'],activation) or activation['portable_mode_question_present']):return None
  self.measured={'context':context,'extensions':extensions};self.observation=obs;self.src_calls+=1
  result,workflow=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
  if not result['selected']:return None
  rule=self.selected['rule'];action=self.selected['action'];stage=rule['static_facts']['station_profile_question_stage'];extension=self.selected.get('extension');evidence=list(dict.fromkeys([obs['observation_ref']]+[r for e in self.mode_evidence for r in e['evidence']]+(extension or {}).get('evidence',[])))
  focus='composition:ranked_workshop:'+digest([obs['observation_ref'],rule['id']]);facts={'ranked_workshop_current_bound':True,'observed_control_mode_contrast_bound':bool(self.mode_evidence)}
  plan={'extension':deepcopy(extension),'projection_origin':'current_DRM_extension' if extension else 'V5_conditional_projection','profile_domain':deepcopy(scene.get('comparison_domain',{})),'rule_ref':rule['id'],'rule':deepcopy(rule),'stage':stage,'context':context,'context_sha256':digest(stable_context(context)),'evidence':evidence,'workflow':workflow,'source_drm_sha256':self.config['origin_drm_sha256'],'current_drm_sha256':hashlib.sha256((HERE/'workshop.drm').read_bytes()).hexdigest(),'control_status':'portable_method_to_revalidate' if extension and extension['kind']=='revalidate_mode' else 'conditional_library_input_hypothesis; current_marker_toggle_observed','unknown':['held_move_effect_until_current_probe','authenticating_input_until_effect','receipt_persistence_until_departure','tools_and_their_domains']+(extension or {}).get('unknown',[]),'falsifiers':['current_profile_or_marker_changed','other_profiles_change_unpredicted','selected_control_does_not_produce_discriminating_effect','scope_changed']}
  return {'status':'proposed','kind':'public_ranked_workshop','actions':[action],'steps':[{'action':action,'expected_before':{'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash']},'expected_after':None}],'facts':facts,'binding':{k:obs[k] for k in ('observation_ref','level_epoch','levels_completed','frame_hash')},'workshop_plan':plan,'compositions':[{'id':focus,'role':'information_question','observed':False,'things':[context['station_profile_unique_marked_profile_ref']],'properties':{'consumer_dependencies':deepcopy((extension or {}).get('consumers',[])),'method_ref':(extension or {}).get('method_ref'),'support':deepcopy((extension or {}).get('support')),'target':stage,'conditional':True,'unknown':plan['unknown'],'falsifiers':plan['falsifiers'],'principle_ref':rule['static_facts']['selection_principle_ref'],'receipts_are_not_occupancy':True},'relations':['contributes_to:G_official_completion'],'open_question':self.config['question']}],'question':{'reason':self.config['question'],'hypothesis_refs':evidence},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','purpose':self.config['question'],'preconditions':facts,'evidence':evidence,'actions':[action],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,proposal,domain):
  if len(proposal['actions'])!=1 or proposal['actions']!=[s['action'] for s in proposal['steps']] or any('expected_after' not in s for s in proposal['steps']):raise ValueError('Unbound ranked workshop probe')
 def before(self,proposal,index,public,obs):
  ok=index==0 and all(obs[k]==proposal['binding'][k] for k in ('observation_ref','level_epoch','levels_completed','frame_hash')) and public.frame_hash==proposal['binding']['frame_hash'] and public.level==proposal['binding']['level_epoch'] and proposal['actions'][index]['action_ref'] in public.available_action_refs
  if ok:
   scene,ctx=project(obs,public.frame_rows,self.config);ok=digest(stable_context(ctx))==proposal['workshop_plan']['context_sha256']
  return {'admitted':bool(ok),'reason':'current_ranked_profile_scope_mode_and_exact_probe' if ok else 'ranked_profile_binding_changed'}
 def after(self,proposal,index,before,after,first,second):return {'matched':None,'seal_prefix':True,'reason':'conditional_input_requires_sealed_observation'}
 def record(self,before,after,command,first,second,proposal=None,index=0):
  self.scope(before)
  if proposal and proposal['actions'][index]!=command:return {'status':'command_proposal_mismatch','evidence':[before['observation_ref']]}
  if before['level_epoch']!=after['level_epoch']:
   event={'status':'official_boundary','evidence':[before['observation_ref'],after['observation_ref']],'prior_mode_evidence':deepcopy(self.mode_evidence)};self.events.append(event);self.scope(after);return event
  a,ca=self.projected(before,first);b,cb=self.projected(after,second)
  if not ca or not cb:return None
  effect=changes(a,ca,b,cb);evidence=[before['observation_ref'],after['observation_ref']]
  if any(effect.values()):
   before_y=sum(ca['station_profile_marker_bbox'][::2])/2 if ca.get('station_profile_marker_bbox') else None;after_y=sum(cb['station_profile_marker_bbox'][::2])/2 if cb.get('station_profile_marker_bbox') else None
   direction=0 if before_y is None or after_y is None or before_y==after_y else (1 if after_y>before_y else -1)
   item={'action':deepcopy(command),'changes':effect,'vertical_sign':direction,'held_before':ca.get('station_profile_inner_singleton_count')==1,'held_after':cb.get('station_profile_inner_singleton_count')==1,'marked_profile_preserved':ca.get('station_profile_marked_profile_heights')==cb.get('station_profile_marked_profile_heights'),'same_profile_multiset':sorted(tuple(p['profile']['stem_relief_rank_height_pixels']) for p in profiles(a))==sorted(tuple(p['profile']['stem_relief_rank_height_pixels']) for p in profiles(b)),'evidence':evidence,'source_epoch':before['level_epoch']}
   from .preparation import band_index
   before_marked=[p for p in profiles(a) if p['component_ref']==ca.get('station_profile_unique_marked_profile_ref')];after_marked=[p for p in profiles(b) if p['component_ref']==cb.get('station_profile_unique_marked_profile_ref')]
   ia=band_index(a,before_marked[0]) if len(before_marked)==1 else None;ib=band_index(b,after_marked[0]) if len(after_marked)==1 else None
   item['slot_delta']=ib-ia if ia is not None and ib is not None else None
   self.input_effects.append(item);self.input_effects=self.input_effects[-64:]
  if effect['mode_toggle']:
   signature=mode_signature(ca);ref='mode_method:'+digest([signature,command])
   method=next((m for m in self.mode_methods if m['ref']==ref),None)
   if method is None:method={'ref':ref,'signature':signature,'action':deepcopy(command),'contrasts':[],'law_status':'observed_mode_toggle; new_scope_requires_probe'};self.mode_methods.append(method)
   method['contrasts'].append({'change':[ca['station_profile_inner_singleton_count'],cb['station_profile_inner_singleton_count']],'evidence':evidence,'source_epoch':before['level_epoch']});method['contrasts']=method['contrasts'][-8:]
  extension=proposal.get('workshop_plan',{}).get('extension') if proposal else None
  if extension and extension['kind']=='revalidate_mode' and not effect['mode_toggle']:self.method_refutations.append([extension['method_ref'],before['level_epoch']])
  if extension and extension['kind']=='access_prepared_receiver':
   preserved=ca.get('station_profile_inner_singleton_count')==cb.get('station_profile_inner_singleton_count')==1 and ca.get('station_profile_marked_profile_heights')==cb.get('station_profile_marked_profile_heights') and sorted(tuple(p['profile']['stem_relief_rank_height_pixels']) for p in profiles(a))==sorted(tuple(p['profile']['stem_relief_rank_height_pixels']) for p in profiles(b))
   if not (effect['marker_moved'] and preserved):
    self.method_refutations.append([extension['method_ref'],before['level_epoch']]);self.events.append({'status':'current_held_direction_refuted','method_ref':extension['method_ref'],'evidence':evidence,'scope':before['level_epoch']})
  pa=[p for p in profiles(a) if p['component_ref']==ca.get('station_profile_unique_marked_profile_ref')];pb=[p for p in profiles(b) if p['component_ref']==cb.get('station_profile_unique_marked_profile_ref')]
  if extension and (extension['kind']=='probe_transform' or extension.get('obligation')=='transform') and len(pa)==len(pb)==1 and not effect['marker_moved']:
   previous=list(pa[0]['profile']['stem_relief_rank_height_pixels']);obtained=list(pb[0]['profile']['stem_relief_rank_height_pixels'])
   others_before=sorted((p['bbox'],p['profile']['stem_relief_rank_height_pixels']) for p in profiles(a) if p['component_ref']!=pa[0]['component_ref']);others_after=sorted((p['bbox'],p['profile']['stem_relief_rank_height_pixels']) for p in profiles(b) if p['component_ref']!=pb[0]['component_ref'])
   preserved=others_before==others_after and not effect['receiver_changed']
   models=relations(previous,obtained,len(second)) if preserved else []
   self.operator_observations.append({'support':extension['support'],'action':deepcopy(command),'before_profile':previous,'after_profile':obtained,'models':models,'evidence':evidence,'source_epoch':before['level_epoch'],'status':'observed_pair_with_conditional_models' if models else 'no_identified_transform','other_profiles_and_receivers_preserved':preserved,'global_domain_known':False});self.operator_observations=self.operator_observations[-32:]
  af={k:v for k,v in stable_context(ca).items() if k!='station_profile_inner_singleton_count'};bf={k:v for k,v in stable_context(cb).items() if k!='station_profile_inner_singleton_count'}
  if af==bf and {ca.get('station_profile_inner_singleton_count'),cb.get('station_profile_inner_singleton_count')}=={0,1}:
   self.mode_evidence=[{'action':deepcopy(command),'evidence':[before['observation_ref'],after['observation_ref']],'same_profiles_and_marker_position':True,'observed_change':[ca['station_profile_inner_singleton_count'],cb['station_profile_inner_singleton_count']]}]
  if proposal and 'workshop_plan' in proposal:
   changed=stable_context(ca)!=stable_context(cb)
   if not changed:self.rejected.append([proposal['workshop_plan']['rule_ref'],proposal['workshop_plan']['context_sha256']])
   event={'status':'current_geometric_effect' if changed else 'no_discriminating_change','rule_ref':proposal['workshop_plan']['rule_ref'],'evidence':[before['observation_ref'],after['observation_ref']],'before':stable_context(ca),'after':stable_context(cb),'universal_law_confirmed':False};self.events.append(event);return event
  return {'status':'mode_marker_contrast','evidence':self.mode_evidence[-1]['evidence']} if self.mode_evidence and self.mode_evidence[-1]['evidence'][-1]==after['observation_ref'] else None
 def state(self):return deepcopy({'epoch':self.epoch,'mode_evidence':self.mode_evidence,'rejected':self.rejected,'events':self.events[-32:],'mode_methods':self.mode_methods,'input_effects':self.input_effects,'method_refutations':self.method_refutations,'operator_observations':self.operator_observations})
 def restore(self,state):
  for name in ('epoch','mode_evidence','rejected','events','mode_methods','input_effects','method_refutations','operator_observations'):
   if name in state:setattr(self,name,deepcopy(state[name]))
