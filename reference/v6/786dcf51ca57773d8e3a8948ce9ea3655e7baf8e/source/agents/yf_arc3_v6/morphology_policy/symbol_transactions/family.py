"""SRC-owned current probe, DRM-owned revisable symbol-interface interpretation."""
from copy import deepcopy
from pathlib import Path
import hashlib,json
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
from .geometry import project,frame,measure_diagram_transition
from .interface import Interface
HERE=Path(__file__).resolve().parent

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def holds(conditions,facts):return all(_fact_condition_holds(DrmFactCondition.model_validate(c),facts) for c in conditions)

def substitute(value,bindings):
 if isinstance(value,str):return value.format_map(bindings)
 if isinstance(value,list):return [substitute(v,bindings) for v in value]
 if isinstance(value,dict):return {k:substitute(v,bindings) for k,v in value.items()}
 return value

class SymbolTransactions:
 def __init__(self):
  self.loaded=load_drm_document(HERE/'transactions.drm');self.config=plain(self.loaded.document.declarations[0].configuration)
  self.src=SrcProgram(HERE/'transactions.src','v6.symbol_transactions.choose',{'symbols.measure':self.measure,'symbols.select':self.select})
  self.epoch=None;self.rejected=[];self.events=[];self.transition_count=0;self.src_calls=0;self.selected=None;self.interface=Interface(self.config,holds)
 def scope(self,obs):
  if self.epoch!=obs['level_epoch']:self.epoch=obs['level_epoch'];self.rejected=[];self.transition_count=0
 def measure(self,request):return self.measured
 def select(self,measured):
  offers=[]
  for option in measured['options']:
   facts={**self.config['initial_facts'],**option['facts']};rules=[]
   for rule in self.config['interface_projection_rules' if measured.get('mode')=='interface' else 'projection_rules']:
    if holds(rule['all_conditions'],facts):
     facts.update(deepcopy(rule['static_facts']));facts.update(substitute(rule.get('templated_facts',{}),{'candidate_ref':option['point_entity']['id']}));rules.append(rule['id'])
   key=digest([self.observation['frame_hash'],option['action']])
   if holds(self.config['interface_candidate_admission' if measured.get('mode')=='interface' else 'candidate_admission'],facts) and key not in self.rejected:offers.append({**option,'conclusions':facts,'rules':rules,'rejection_key':key})
  if measured.get('mode')=='interface' and offers:
   order=self.config['interface_choice_order'];rank=min(order.index(o['facts']['offer_kind']) for o in offers);offers=[o for o in offers if order.index(o['facts']['offer_kind'])==rank];fields=self.config['interface_choice_fields'];cost=min(tuple(o['facts'][k] for k in fields) for o in offers);offers=[o for o in offers if tuple(o['facts'][k] for k in fields)==cost]
  grouped={digest(o['action']):o for o in offers}
  for key,item in grouped.items():
   if 'interface_offer' in item:item['interface_offer']['alternative_displayed_rows']=[o['interface_offer'].get('displayed_row') for o in offers if digest(o['action'])==key]
  self.selected=next(iter(grouped.values())) if len(grouped)==1 else None
  return {'selected':self.selected is not None,'alternatives':len(grouped)}
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs)
  if remaining<1:return None
  measured=project(obs,rows,inputs,self.config,self.transition_count)
  if not measured or not holds(self.config['activation'],measured['context']):
   options=self.interface.options(obs,rows,inputs,remaining)
   if not options:return None
   measured={'mode':'interface','context':{},'options':options}
  self.measured=measured;self.observation=obs;self.src_calls+=1
  result,workflow=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
  if not result['selected']:return None
  selected=self.selected;entity=selected['entities'][0];action=deepcopy(selected['action']);facts={'symbol_transaction_current_bound':True}
  question=self.config['interface_question' if measured.get('mode')=='interface' else 'question'];hypotheses=self.config['interface_hypotheses' if measured.get('mode')=='interface' else 'hypotheses']
  focus='composition:symbol_transaction:'+digest([obs['observation_ref'],action]);evidence=list(dict.fromkeys([obs['observation_ref']]+selected.get('interface_offer',{}).get('evidence',[])))
  plan={'interface_offer':deepcopy(selected.get('interface_offer')),'mode':measured.get('mode','guide'),'measured_facts':selected['facts'],'conclusions':selected['conclusions'],'rule_refs':selected['rules'],'entity_ref':entity['id'],'entity_signature':entity['signature'],'rejection_key':selected['rejection_key'],'workflow':workflow,'drm_sha256':hashlib.sha256((HERE/'transactions.drm').read_bytes()).hexdigest(),'origin_drm_sha256':self.config['origin_drm_sha256'],'hypotheses':hypotheses,'expected_effect':self.config['expected_effect'],'falsifiers':self.config['falsifiers'],'authority':'current_revisable_experiment_not_acquired_role','preserve':self.config['preserve'],'effect_status':'unknown_until_sealed_observation'}
  point_entity=selected['point_entity']
  point_binding={'observation_ref':obs['observation_ref'],'entity_ref':point_entity['id'],'signature':point_entity['signature'],'bbox':point_entity['bbox'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[action['data']['x'],action['data']['y']],'palette_value':point_entity['palette_value'],'source':'measured_current_symbol_interface_point'}
  return {'status':'proposed','kind':'public_symbol_transaction','actions':[action],'steps':[{'action':action,'expected_before':{'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash']},'expected_after':None,'point_binding':point_binding}],'facts':facts,'binding':{k:obs[k] for k in ('observation_ref','level_epoch','levels_completed','frame_hash')},'symbol_transaction_plan':plan,'compositions':[{'id':focus,'role':self.config['composition_role'],'observed':False,'things':[entity['id']],'properties':{'target':selected['conclusions']['active_goal_ref'],'conditional':True,'hypotheses':hypotheses,'falsifiers':self.config['falsifiers'],'roles_remain_revisable':True,'interface_dependency':deepcopy(selected.get('interface_offer'))},'relations':['contributes_to:'+self.config['goal']],'open_question':question}],'question':{'reason':question,'hypothesis_refs':hypotheses},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':self.config['goal'],'purpose':question,'preconditions':facts,'evidence':evidence,'actions':[action],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,proposal,domain):
  if len(proposal['actions'])!=1 or proposal['actions']!=[s['action'] for s in proposal['steps']] or any('expected_after' not in s or 'entity_ref' not in s.get('point_binding',{}) for s in proposal['steps']):raise ValueError('Unbound symbol transaction probe')
  if domain is not None:domain.bind_proposal(proposal)
 def before(self,proposal,index,public,obs):
  ok=index==0 and all(obs[k]==proposal['binding'][k] for k in ('observation_ref','level_epoch','levels_completed','frame_hash')) and public.frame_hash==proposal['binding']['frame_hash'] and public.level==proposal['binding']['level_epoch'] and proposal['actions'][0]['action_ref'] in public.available_action_refs
  if ok:
   if proposal['symbol_transaction_plan'].get('mode')=='interface':
    options=self.interface.options(obs,public.frame_rows,proposal['actions'],1)
    options=[o for o in options if digest(o['facts'])==digest(proposal['symbol_transaction_plan']['measured_facts'])]
   else:
    measured=project(obs,public.frame_rows,proposal['actions'],self.config,self.transition_count);options=measured['options'] if measured else []
   ok=bool(options) and all(o['action']==proposal['actions'][0] and o['entities']==options[0]['entities'] for o in options) and len(options[0]['entities'])==1 and options[0]['entities'][0]['id']==proposal['symbol_transaction_plan']['entity_ref'] and options[0]['entities'][0]['signature']==proposal['symbol_transaction_plan']['entity_signature'] and digest(options[0]['facts'])==digest(proposal['symbol_transaction_plan']['measured_facts'])
  return {'admitted':bool(ok),'reason':'current_symbol_frame_and_exact_discriminating_input' if ok else 'symbol_frame_binding_changed'}
 def after(self,proposal,index,before,after,first,second):return {'matched':None,'seal_prefix':True,'reason':'unknown_interaction_requires_sealed_observation'}
 def record(self,before,after,command,first,second,proposal=None,index=0):
  if not proposal or 'symbol_transaction_plan' not in proposal:return None
  self.scope(before)
  if proposal['actions'][index]!=command:return {'status':'command_proposal_mismatch','evidence':[before['observation_ref']]}
  evidence=[before['observation_ref'],after['observation_ref']]
  interface_event=self.interface.record(before,after,command,first,second,proposal)
  if before['level_epoch']!=after['level_epoch']:
   event={'status':'official_boundary','evidence':evidence,'acquired_roles':False};self.scope(after)
  else:
   changed=sum(a!=b for ra,rb in zip(first,second) for a,b in zip(ra,rb));matches=measure_diagram_transition(frame(first),frame(second)) if changed else 0
   self.transition_count+=matches
   if not changed:self.rejected.append(proposal['symbol_transaction_plan']['rejection_key'])
   event={'status':'observed_change_requires_role_reconciliation' if changed else 'no_discriminating_change','evidence':evidence,'action':deepcopy(command),'changed_pixels':changed,'diagram_operand_removal_result_appearance_matches':matches,'conclusions_before':deepcopy(proposal['symbol_transaction_plan']['conclusions']),'hypotheses':deepcopy(proposal['symbol_transaction_plan']['hypotheses']),'preservation_status':'unknown_until_typed_role_acquisition' if changed else 'all_pixels_preserved','universal_law_confirmed':False,'source_epoch':before['level_epoch']}
  event['interface_event']=interface_event;self.events.append(event);self.events=self.events[-32:];return event
 def state(self):return deepcopy({'epoch':self.epoch,'rejected':self.rejected[-32:],'events':self.events[-32:],'transition_count':self.transition_count,'interface_state':self.interface.state()})
 def restore(self,state):
  if 'interface_state' in state:self.interface.restore(state['interface_state'])
  for name in ('epoch','rejected','events','transition_count'):
   if name in state:setattr(self,name,deepcopy(state[name]))
