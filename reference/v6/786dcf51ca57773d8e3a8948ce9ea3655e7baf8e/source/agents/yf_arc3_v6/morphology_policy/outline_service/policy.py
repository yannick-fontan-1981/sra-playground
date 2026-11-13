from pathlib import Path
from copy import deepcopy
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v5.drm.contracts import DrmFactCondition
from agents.yf_arc3_v5.drm.meaning import _fact_condition_holds
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram,plain
HERE=Path(__file__).parent
class OutlinePolicy:
 def __init__(self):
  self.loaded=load_drm_document(HERE/'outline.drm')
  from agents.yf_arc3_v5.drm import load_production_drm,build_production_drm_registry
  route,_=build_production_drm_registry(load_production_drm()).resolve('policy.declared_transferred_quantized_plan')
  self.route_config=route.configuration
  self.config=plain(self.loaded.document.declarations[0].configuration)
  self.src=SrcProgram(HERE/'outline.src','v6.outline_service.choose',{'outline.measure':lambda request:request,'outline.interpret':self.interpret,'outline.control':self.interpret_control})
  self.control_config=plain(self.loaded.document.declarations[1].configuration)
  self.control_src=SrcProgram(HERE/'outline.src','v6.outline_service.bind_control',{'outline.control':self.interpret_control,'outline.measure':lambda request:request,'outline.interpret':self.interpret})
 def interpret_control(self,measured):
  conclusions=[{'rule_ref':rule['id'],**deepcopy(rule['conclusions'])} for rule in self.control_config['rules'] if all(_fact_condition_holds(DrmFactCondition.model_validate(c),measured) for c in rule['all_conditions'])]
  return {'status':'unique' if len(conclusions)==1 else 'ambiguous' if conclusions else 'abstain','conclusions':conclusions,'release_authority':False}
 def bind_control(self,facts):return self.control_src.run({'request':facts})
 def interpret(self,measured):
  if not measured.get('current_scope_and_observation'):return {'status':'unbound','release_authority':False}
  conclusions=[{'rule_ref':rule['id'],**deepcopy(rule['conclusions'])} for rule in self.config['rules'] if all(_fact_condition_holds(DrmFactCondition.model_validate(c),measured) for c in rule['all_conditions'])]
  return {'status':'unique' if len(conclusions)==1 else 'ambiguous' if conclusions else 'abstain','conclusions':conclusions,'release_authority':False}
 def evaluate(self,facts):
  return self.src.run({'request':facts})
