from pathlib import Path
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
class SelectionPolicy:
 def __init__(self):
  p=Path(__file__).parent;self.loaded=load_drm_document(p/'selection.drm');self.config=plain(self.loaded.document.declarations[0].configuration);self.src=SrcProgram(p/'selection.src','v6.temporal_selection.choose',{'selection.select':self.select})
 def select(self,request):
  if not self.config.get('conditions'):raise ValueError('missing selection admission')
  ok=[(self.config['priority'].index(o['kind']),o['distance'],i)for i,o in enumerate(request)if o['kind']in self.config['priority']and all(_fact_condition_holds(DrmFactCondition.model_validate(c),o['facts'])for c in self.config['conditions'])]
  if not ok:return {'status':'abstain','release_authority':False}
  best=min((rank,a)for rank,a,i in ok);indices=[i for rank,a,i in ok if (rank,a)==best]
  if len(indices)!=1:return {'status':'abstain','reason':'equally_related_candidates','release_authority':False}
  return {'status':'selected','index':indices[0],'reason':self.config['questions'][request[indices[0]]['kind']],'hypotheses':self.config['hypotheses'],'release_authority':False}
 def choose(self,offers):return self.src.run({'request':[{'kind':o['kind'],'distance':o['candidate']['distance'],'facts':o['facts']}for o in offers]})
