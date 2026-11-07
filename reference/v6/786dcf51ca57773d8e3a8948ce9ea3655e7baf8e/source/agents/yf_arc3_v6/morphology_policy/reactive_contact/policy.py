from pathlib import Path
import hashlib,json
from copy import deepcopy
from agents.yf_arc3_v5.drm import load_production_drm
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
class ContactPolicy:
 def __init__(self):
  p=Path(__file__).parent;self.loaded=load_drm_document(p/'contact.drm');self.config=plain(self.loaded.document.declarations[0].configuration);self.projections={}
  for doc in load_production_drm():
   for d in doc.document.declarations:
    for rule in d.fact_projections:
     if rule.id in self.config['contact_projections']:self.projections[rule.id]=plain(rule.model_dump())
  if set(self.projections)!=set(self.config['contact_projections']):raise ValueError('missing exact V5 contact projections')
  callbacks={'contact.select':self.select,'contact.control':self.control,'contact.project':self.project_contact,'contact.binding':self.project_binding,'contact.source81_entry':self.project_source81_entry,'contact.ready':self.admit_ready_operator};self.src=SrcProgram(p/'contact.src','v6.reactive_contact.choose',callbacks);self.control_src=SrcProgram(p/'contact.src','v6.reactive_contact.bind_control',callbacks);self.contact_src=SrcProgram(p/'contact.src','v6.reactive_contact.reconcile_contact',callbacks);self.binding_src=SrcProgram(p/'contact.src','v6.reactive_contact.reconcile_binding',callbacks);self.entry_src=SrcProgram(p/'contact.src','v6.reactive_contact.project_source81_entry',callbacks);self.ready_src=SrcProgram(p/'contact.src','v6.reactive_contact.admit_ready_operator',callbacks)
 def holds(self,cs,f):return all(_fact_condition_holds(DrmFactCondition.model_validate(c),f)for c in cs)
 def control(self,request):return {'status':'conditional_control_bound'if self.holds(self.config['control_conditions'],request)else'abstain','authority':'current_input_compatible_shape_under_revisable_interface_prior','release_authority':False}
 def project_contact(self,request):
  f=deepcopy(request);used=[]
  for ref in self.config['contact_projections']:
   p=self.projections[ref]
   if not self.holds(p['all_conditions'],f)or p.get('any_conditions')and not any(self.holds([c],f)for c in p['any_conditions']):return {'status':'abstain','missing_projection':ref,'release_authority':False}
   f.update(deepcopy(p.get('static_facts')or{}))
   for k,v in(p.get('bound_facts')or{}).items():
    if v not in f:return {'status':'abstain','missing_bound_fact':v,'release_authority':False}
    f[k]=deepcopy(f[v])
   try:
    for k,v in(p.get('templated_facts')or{}).items():f[k]=v.format_map(f)if isinstance(v,str)else[x.format_map(f)for x in v]
   except KeyError as e:return {'status':'abstain','missing_template':str(e),'release_authority':False}
   used.append(ref)
  return {'status':'contact_question_projected','projections':used,'facts':f,'release_authority':False}
 def contact(self,facts):return self.contact_src.run({'request':facts})
 def select(self,request):
  rows=[(self.config['priority'].index(o['kind']),o['cost'],o['peer_distance'],i)for i,o in enumerate(request)if o['kind']in self.config['priority']and self.holds(self.config['conditions'],o['facts'])and(o['kind']!='parent_escape_configuration_access'or self.holds(self.config['parent_conditions'],o['facts']))]
  if not rows:return {'status':'abstain','release_authority':False}
  i=min(rows)[-1];return {'status':'selected','index':i,'reason':request[i]['kind']+': resolve whether a current stationary subject can change escape options; retain existing-dead-end alternative','hypotheses':self.config['hypotheses'],'release_authority':False}
 def choose(self,offers):return self.src.run({'request':offers})
 def bind_control(self,facts):return self.control_src.run({'request':facts})

 def claim_digest(self,value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 def project_binding(self,request):
  rule=self.config['common_translation_claim'];receipt=request['receipt']
  if not self.holds(rule['conditions'],request['facts'])or any(k not in receipt for k in rule['required_receipt_fields']):return {'status':'abstain','release_authority':False}
  claim={'projection_ref':rule['id'],'status':rule['status'],'scope':rule['scope'],'receipt':deepcopy(receipt),'falsifiers':deepcopy(rule['falsifiers']),'release_authority':False}
  claim['ref']=rule['id']+':'+self.claim_digest(claim)
  return {'status':'observed_method_claim','claim':claim,'release_authority':False}
 def reconcile_binding(self,facts,receipt):return self.binding_src.run({'request':{'facts':facts,'receipt':receipt}})
 def project_source81_entry(self,request):
  rule=self.config['source81_entry']
  if not self.holds(rule['conditions'],request['facts']):return {'status':'abstain','release_authority':False}
  claim={'projection_ref':rule['id'],'scope':rule['claim_scope'],'receipt':deepcopy(request['receipt']),'release_authority':False};claim['ref']=rule['id']+':'+self.claim_digest(claim)
  action=self.config['operator_prior'];candidates=[]
  if action in request['available_action_refs']:
   candidates=[{'action_ref':action,'hypothesis_ref':rule['operator_candidate_ref']+':'+self.claim_digest([claim['ref'],action]),'meaning':rule['unknown_operator_meaning'],'binding_claim_refs':[claim['ref']],'observed':False}]
  return {'status':'current_prospective_entry','claim':claim,'explicit_operator_candidates':candidates,'release_authority':False}
 def source81_entry(self,request):return self.entry_src.run({'request':request})

 def admit_ready_operator(self,facts):return {'status':'admitted_experiment'if self.holds(self.config['source81_ready_operator_conditions'],facts)else'abstain','declaration':deepcopy(self.config['source81_ready_operator_meaning']),'release_authority':False}
 def ready_operator(self,facts):return self.ready_src.run({'request':facts})
