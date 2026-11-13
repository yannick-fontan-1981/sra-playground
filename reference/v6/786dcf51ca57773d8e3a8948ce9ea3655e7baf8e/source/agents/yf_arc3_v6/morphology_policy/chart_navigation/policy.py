from pathlib import Path
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
class ChartPolicy:
 def __init__(self):
  p=Path(__file__).parent;self.loaded=load_drm_document(p/'chart.drm');self.config=plain(self.loaded.document.declarations[0].configuration);self.src=SrcProgram(p/'chart.src','v6.chart_navigation.choose',{'chart.select':self.select})
 def select(self,request):
  options=[]
  for i,o in enumerate(request):
   if o['kind']in self.config['priority']and all(_fact_condition_holds(DrmFactCondition.model_validate(c),o['facts'])for c in self.config['conditions']):options.append((self.config['priority'].index(o['kind']),o['distance'],o['action'],i))
  if not options:return {'status':'abstain','release_authority':False}
  i=min(options)[-1];o=request[i];return {'status':'selected','index':i,'reason':self.config['kind_meaning'][o['kind']],'hypotheses':['chart_is_navigation_model','directional_interface_prior','annotation_match_may_be_dependency','same_marker_may_be_target','arrival_and_inventory_are_separate'],'release_authority':False}
 def choose(self,rows):return self.src.run({'request':[{k:r[k]for k in('kind','facts','distance','action')}for r in rows]})
