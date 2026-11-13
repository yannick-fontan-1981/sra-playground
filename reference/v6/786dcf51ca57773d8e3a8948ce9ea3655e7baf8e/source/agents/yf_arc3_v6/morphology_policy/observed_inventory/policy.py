from pathlib import Path
from copy import deepcopy
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
HERE=Path(__file__).parent
class InventoryPolicy:
 def __init__(self):
  self.loaded=load_drm_document(HERE/'inventory.drm')
  self.config=plain(self.loaded.document.declarations[0].configuration)
  self.src=SrcProgram(HERE/'inventory.src','v6.observed_inventory.choose',{'inventory.measure':lambda request:request,'inventory.interpret':self.interpret})
 def interpret(self,measured):
  if not measured.get('current_scope_and_observation'):return {'status':'unbound','release_authority':False}
  conclusions=[{'rule_ref':rule['id'],**deepcopy(rule['conclusions'])} for rule in self.config['rules'] if all(_fact_condition_holds(DrmFactCondition.model_validate(c),measured) for c in rule['all_conditions'])]
  return {'status':'unique' if len(conclusions)==1 else 'ambiguous' if conclusions else 'abstain','conclusions':conclusions,'release_authority':False}
 def evaluate(self,facts):
  return self.src.run({'request':facts})
