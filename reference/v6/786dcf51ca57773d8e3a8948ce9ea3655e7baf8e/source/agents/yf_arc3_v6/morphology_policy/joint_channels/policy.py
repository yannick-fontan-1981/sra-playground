from pathlib import Path
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
class ChannelPolicy:
 def __init__(self):
  p=Path(__file__).parent;self.loaded=load_drm_document(p/'channels.drm');self.config=plain(self.loaded.document.declarations[0].configuration);self.src=SrcProgram(p/'channels.src','v6.joint_channels.choose',{'channels.select':self.select})
 def admits(self,kind,facts):
  if kind not in self.config or not self.config[kind]:raise ValueError('missing declarative admission '+kind)
  return all(_fact_condition_holds(DrmFactCondition.model_validate(c),facts)for c in self.config[kind])
 def select(self,request):
  options=[]
  for i,o in enumerate(request):
   if o['kind']in self.config['priority']and all(_fact_condition_holds(DrmFactCondition.model_validate(c),o['facts'])for c in [*self.config['conditions'],*self.config.get('kind_conditions',{}).get(o['kind'],[])]):options.append((self.config['priority'].index(o['kind']),o['center'],i))
  if not options:return {'status':'abstain','release_authority':False}
  i=min(options)[-1];return {'status':'selected','index':i,'reason':self.config.get('kind_meaning',{}).get(request[i]['kind'],self.config['question']),'hypotheses':self.config['hypotheses'],'release_authority':False}
 def choose(self,rows):return self.src.run({'request':[{k:r[k]for k in('kind','facts','center')}for r in rows]})

 def choose_assignment(self,plans):
  if self.config.get('assignment_order')!='smallest_remaining_excavations_among_found_plans':raise ValueError('Missing assignment selection authority')
  if not plans:return None
  return min(plans,key=lambda q:(q['total_cost'],q['next']['point']))
