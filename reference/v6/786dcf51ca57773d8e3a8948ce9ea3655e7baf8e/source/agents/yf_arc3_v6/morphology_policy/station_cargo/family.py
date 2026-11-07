from pathlib import Path
from copy import deepcopy
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram
from .tracker import CargoTracker
from .planning import offers
from .geometry import ref
HERE=Path(__file__).resolve().parent

class ObservedStationCargo:
 def __init__(self):
  declaration,=load_drm_document(HERE/'station_cargo.drm').document.declarations;self.config=dict(declaration.configuration);self.tracker=CargoTracker();self.selected=None
  self.src=SrcProgram(HERE/'station_cargo.src','v6.observed_station_cargo.choose',{'cargo.measure':self.measure,'cargo.bind':self.select})
 def measure(self,request):
  obs,rows,remaining=self.context
  return {'offers':offers(self.tracker,rows,obs['observation_ref'],remaining)} if self.tracker.epoch==obs['level_epoch'] else {'offers':[]}
 def select(self,measured):
  allowed=[p for p in measured['offers'] if p['kind'] in self.config['order']]
  relations=self.config.get('support_relation_order',[])
  def key(plan):
   relation=plan.get('support_relation',plan.get('continuation_forecast',{}).get('support_relation'));rank=relations.index(relation) if relation in relations else len(relations)
   return (self.config['order'].index(plan['kind']),rank,len(plan['actions']),str(plan['access']['carrier']))
  self.selected=min(allowed,key=key) if allowed else None
  return {'selected':self.selected is not None}
 def propose(self,obs,rows,inputs,remaining):
  self.context=(obs,rows,remaining);answer,workflow=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
  if not answer['selected']:return None
  plan=deepcopy(self.selected);actions=plan['actions'][:min(remaining,self.config['maximum_prefix'])];located=self.tracker.locate(rows)
  relation=plan.get('support_relation',plan.get('continuation_forecast',{}).get('support_relation'))
  plan['support_relation']=relation;plan['support_models']=deepcopy(self.config.get('support_models',{}).get(relation,[]))
  # A portable mapping is not permission to execute its following steps unseen.
  for index,action in enumerate(actions):
   if self.tracker.moves.get(action['action_ref'],{}).get('recalled_hypothesis'):
    actions=actions[:index+1];plan['prefix_boundary']='first_current_revalidation_of_portable_motion';break
  probes=[{'action_ref':action['action_ref'],'delta':deepcopy(self.tracker.moves[action['action_ref']]['delta']),'status':'portable_control_hypothesis_currently_probed','evidence':deepcopy(self.tracker.moves[action['action_ref']]['evidence'])} for action in actions if self.tracker.moves.get(action['action_ref'],{}).get('recalled_hypothesis')]
  if probes:
   plan['portable_motion_probes']=probes;plan['evidence']=list(dict.fromkeys(plan['evidence']+[e for probe in probes for e in probe['evidence']]+(self.tracker.recall or {}).get('evidence',[])))
  if not actions or not located or any(a['action_ref'] not in obs['available_action_refs'] for a in actions):return None
  cells,pose=located;cargo=self.tracker.cargo;steps=[];offsets=cargo['offsets'] if cargo else [];stationary=cargo['cells'] if cargo else [];glyphs=(cargo['source_glyphs'] if cargo['status']=='detachment_hypothesis' else cargo['held_glyphs']) if cargo else []
  for index,action in enumerate(actions):
   step={'action':action,'carrier_before':list(pose),'cargo_before':[[pose[0]+dx,pose[1]+dy] for dx,dy in offsets] if plan['cargo_moves'] else deepcopy(stationary),'cargo_glyphs':deepcopy(glyphs),'expected_before':{'level_epoch':obs['level_epoch']},'expected_after':None,'interaction':action['action_ref']==self.tracker.interaction}
   if index==0:step['expected_before']['frame_hash']=obs['frame_hash']
   if action['action_ref'] in self.tracker.moves:
    dx,dy=self.tracker.moves[action['action_ref']]['delta'];pose=(pose[0]+dx,pose[1]+dy);step['carrier_after']=list(pose);step['cargo_after']=[[pose[0]+dx,pose[1]+dy] for dx,dy in offsets] if plan['cargo_moves'] else deepcopy(stationary)
    step['expected_after']={'level_epoch':obs['level_epoch'],'carrier_cell':step['carrier_after'],'cargo_cells':step['cargo_after'],'conditional_model':'observed_whole_composition_translation'}
   steps.append(step)
  cargo_ref=cargo['ref'] if cargo else 'object_contact_hypothesis:'+ref(plan['target_cells']);focus='composition:observed_cargo:'+ref([obs['observation_ref'],plan['goal'],plan['target_cells']]);facts={'current_cargo_or_contact_configuration_bound':True,'conditional_action_bundle_current':True};evidence=list(dict.fromkeys(plan['evidence']+[obs['observation_ref']]))
  preserved=[{'id':'preserve:'+ref([obs['observation_ref'],constraint]),'role':'preservation_constraint','observed':True,'things':['current_public_cells',cargo_ref],'properties':{'constraint':constraint,'scope':'translation_prefix' if constraint=='carrier_cargo_relative_pose_during_translation' else 'action_bundle','guard':'compare_whole_composition_and_unaddressed_cells'},'relations':['contributes_to:G_official_completion']} for constraint in plan['preserve']]
  return {'status':'proposed','kind':'public_observed_station_cargo','actions':actions,'steps':steps,'facts':facts,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed'],'frame_hash':obs['frame_hash']},
   'cargo_plan':{'offer':plan,'workflow':workflow,'grid':deepcopy(self.tracker.grid),'cargo_ref':cargo_ref,'status':cargo['status'] if cargo else 'contact_role_hypothesis','evidence':evidence},
   'compositions':[{'id':focus,'role':'information_question','observed':False,'things':['carrier',cargo_ref],'properties':{'target':plan['goal'],'target_cells':plan['target_cells'],'effect_hypotheses':plan['effect_hypotheses'],'access_support_hypotheses':plan['access']['support_hypotheses'],'falsifiers':plan['falsifiers'],'conditional_continuation':plan.get('continuation_forecast'),'alternative_grips':plan.get('alternative_grips'),'portable_method_hypothesis':plan.get('portable_method_hypothesis'),'portable_motion_probes':plan.get('portable_motion_probes'),'support_relation':plan.get('support_relation'),'support_models':plan.get('support_models')},'relations':['contributes_to:G_official_completion'],'open_question':self.config['question']}]+preserved,
   'question':{'reason':self.config['question'],'hypothesis_refs':evidence},'route_refs':evidence,
   'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[item['id'] for item in preserved],'preservation_evidence':{item['id']:{'observation_ref':obs['observation_ref'],'cargo_ref':cargo_ref,'evidence':evidence,'guard':item['properties']['guard'],'scope':item['properties']['scope']} for item in preserved},'purpose':self.config['question'],'preconditions':facts,'evidence':evidence,'actions':actions,'outcome_guard':{'path':['value'],'contains':focus}}}
 def before(self,proposal,index,public,obs):
  step=proposal['steps'][index];located=self.tracker.locate(public.frame_rows)
  ok=bool(located) and public.level==proposal['binding']['level_epoch'] and public.levels_completed==proposal['binding']['levels_completed'] and list(located[1])==step['carrier_before'] and step['action']['action_ref'] in public.available_action_refs
  if index==0:ok=ok and public.frame_hash==proposal['binding']['frame_hash'] and obs['observation_ref']==proposal['binding']['observation_ref']
  if ok:ok=all(located[0].get(tuple(p)) in [tuple(g) for g in step['cargo_glyphs']] for p in step['cargo_before'])
  return {'admitted':ok,'reason':'current_measured_carrier_cargo_composition' if ok else 'composition_changed'}
 def bind(self,proposal,domain):
  if [step['action'] for step in proposal['steps']]!=proposal['actions']:raise ValueError('Unbound cargo action set')
 def after(self,proposal,index,before,after,first,second):
  step=proposal['steps'][index]
  if step['interaction']:return {'matched':None,'seal_prefix':True,'reason':'conditional_interaction_requires_reconciliation'}
  located=self.tracker.locate(second);previous=self.tracker.locate(first);matched=bool(located) and bool(previous) and list(located[1])==step['carrier_after'] and all(located[0].get(tuple(p)) in [tuple(g) for g in step['cargo_glyphs']] for p in step['cargo_after'])
  affected={tuple(p) for p in step['cargo_before']+step['cargo_after']+[step['carrier_before'],step['carrier_after']]}
  if matched:matched=all(previous[0][p]==located[0][p] for p in previous[0] if p not in affected)
  return {'matched':matched,'seal_prefix':not matched,'reason':'whole_composition_translation_compared'}
 def record(self,before,after,command,first,second,proposal=None,index=0):return self.tracker.record(before,after,command,first,second)
 def state(self):return self.tracker.state()
 def restore(self,state):self.tracker.restore(state)
