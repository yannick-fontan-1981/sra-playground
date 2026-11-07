from pathlib import Path
from copy import deepcopy
from agents.yf_arc3_v5.drm import load_production_drm,build_production_drm_registry
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain

HERE=Path(__file__).parent
class FramedPolicy:
 def __init__(self):
  self.loaded=load_drm_document(HERE/'framed.drm');self.config=plain(self.loaded.document.declarations[0].configuration)
  docs=load_production_drm();self.registry=build_production_drm_registry(docs)
  route,_=self.registry.resolve('policy.declared_transferred_quantized_plan');self.route=plain(route.configuration)
  self.projections={}
  for loaded in docs:
   for d in loaded.document.declarations:
    for p in d.fact_projections:
     if p.id in self.config['priority']:self.projections[p.id]=plain(p.model_dump())
  self.projections.update(self.config.get('local_projections',{}))
  if set(self.projections)!=set(self.config['priority']):raise ValueError('unbound V5 projection')
  self.policies={};self.rules={}
  for key in self.config['record_policies']:
   d,_=self.registry.resolve(key);self.policies[key]=plain(d.model_dump())
   for rule in d.meaning_template_ref_by_alternative.values():
    r,_=self.registry.resolve(rule);self.rules[rule]=plain(r.model_dump())
  mask,_=self.registry.resolve('policy.record_framed_mask_correspondence');self.mask=plain(mask.configuration)['measurement_contract']
  callbacks={'framed.measure':lambda request:request,'framed.select':self.select,'framed.record':self.project_record}
  self.src=SrcProgram(HERE/'framed.src','v6.framed_transfer.choose',callbacks)
  self.record_src=SrcProgram(HERE/'framed.src','v6.framed_transfer.record',callbacks)
 def holds(self,conditions,facts):return all(_fact_condition_holds(DrmFactCondition.model_validate(c),facts)for c in conditions)
 def projected(self,p,facts):
  result=dict(facts);result.update(deepcopy(p.get('static_facts')or{}))
  result.update({k:facts.get(v)for k,v in(p.get('bound_facts')or{}).items()})
  for k,v in(p.get('templated_facts')or{}).items():
   try:result[k]=v.format_map(facts)if isinstance(v,str)else [x.format_map(facts)for x in v]
   except KeyError as exc:raise ValueError("missing_declared_projection_field:"+str(exc)) from exc
  return result
 def select(self,measured):
  eligible=[]
  for n,row in enumerate(measured):
   for rank,key in enumerate(self.config['priority']):
    p=self.projections[key]
    if self.holds(p['all_conditions'],row['facts'])and self.holds(self.config['local_conditions'],row['facts'])and self.holds(self.config.get('projection_scope_conditions',{}).get(key,[]),row['facts']):eligible.append((rank,tuple(row[k]for k in self.config['tie_break']),n,key))
  if not eligible:return {'status':'abstain','release_authority':False}
  rank,order,n,key=min(eligible)
  try:facts=self.projected(self.projections[key],measured[n]['facts'])
  except ValueError as exc:return {'status':'unbound_declared_why','reason':str(exc),'release_authority':False}
  return {'status':'selected','index':n,'projection_ref':key,'projected':facts,'release_authority':False,'competing_current_offers':len(eligible)}
 def choose(self,rows):return self.src.run({'request':rows})
 def project_record(self,request):
  policy=self.policies[request['policy']];facts=request['facts']
  if not self.holds(policy['selection_eligibility_conditions'],facts):return {'status':'rejected'}
  for p in policy.get('fact_projections',[]):
   if self.holds(p.get('all_conditions')or[],facts):
    try:facts=self.projected(p,facts)
    except ValueError as exc:return {'status':'incomplete','reason':str(exc)}
  names=list(policy['meaning_template_ref_by_alternative'].values())
  if len(names)!=1:return {'status':'ambiguous'}
  rule=self.rules[names[0]];template=rule['term_templates'][0]
  if any(k not in facts for k in template['required_fields']):return {'status':'incomplete'}
  record={**(template.get('static_attributes')or{}),**{k:facts.get(v)for k,v in template['attribute_bindings'].items()}}
  claims=[]
  for claim in rule['claim_templates']:
   if any(k not in facts for k in claim.get('required_fields',[])):return {'status':'incomplete_claim'}
   claims.append({'id':claim['id_pattern'].format_map(facts),'predicate':claim['predicate'],'family':claim['family'],'epistemic_status':claim['epistemic_status'],'arguments':[v.format_map(facts)for v in claim['argument_patterns']],'attributes':{**(claim.get('static_attributes')or{}),**{k:facts.get(v)for k,v in(claim.get('attribute_bindings')or{}).items()}}})
  if record.get('source_claim_ref')not in[c['id']for c in claims]:return {'status':'unbound_source_claim'}
  record['claims']=claims
  return {'status':'derived','record':record,'rule_ref':names[0],'policy_ref':policy['id'],'event_ref':template['id_pattern'].format_map(facts),'release_authority':False}
 def record(self,policy,facts):return self.record_src.run({'request':{'policy':policy,'facts':facts}})
