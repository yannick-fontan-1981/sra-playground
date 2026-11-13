from pathlib import Path
from copy import deepcopy
from agents.yf_arc3_v5.drm import load_production_drm
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
class ReactionPolicy:
 def __init__(self):
  p=Path(__file__).parent;self.loaded=load_drm_document(p/'reaction.drm');self.config=plain(self.loaded.document.declarations[0].configuration);self.projections={}
  for doc in load_production_drm():
   for d in doc.document.declarations:
    for rule in d.fact_projections:
     if rule.id in self.config['projections']:self.projections[rule.id]=plain(rule.model_dump())
  if set(self.projections)!=set(self.config['projections']):raise ValueError('missing V5 projection')
  self.src=SrcProgram(p/'reaction.src','v6.ordered_reaction.choose',{'reaction.select':self.select})
 def holds(self,cs,f):return all(_fact_condition_holds(DrmFactCondition.model_validate(c),f)for c in cs)
 def project(self,p,f):
  r={**f,**deepcopy(p.get('static_facts')or{})}
  for k,v in(p.get('templated_facts')or{}).items():r[k]=v.format_map(f)if isinstance(v,str)else[x.format_map(f)for x in v]
  return r
 def select(self,request):
  out=[]
  for i,o in enumerate(request):
   kind=o['kind'];f=o['facts'];rule=self.config['rules'].get(kind)
   if rule is None or not self.holds(rule['conditions'],f):continue
   ref=rule.get('projection');p=self.projections.get(ref)
   if p and(not self.holds(p['all_conditions'],f)or p.get('any_conditions')and not any(self.holds([c],f)for c in p['any_conditions'])):continue
   try:why=self.project(p,f)if p else dict(f)
   except KeyError:continue
   out.append((self.config['priority'].index(kind),i,why,rule['meaning'],ref))
  if not out:return {'status':'abstain','release_authority':False}
  _,i,why,meaning,ref=min(out,key=lambda x:x[:2]);return {'status':'selected','index':i,'projected':why,'reason':meaning,'projection_ref':ref,'release_authority':False}
 def choose(self,offers):return self.src.run({'request':offers})

