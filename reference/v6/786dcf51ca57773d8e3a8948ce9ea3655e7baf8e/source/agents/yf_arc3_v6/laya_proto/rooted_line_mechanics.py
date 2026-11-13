"""Thin bindings to existing V5 conditional rod/contact/search measurements."""
from rooted_line_projection import configuration,physical,projected
from agents.yf_arc3_v5.capabilities.contracts import PiercingCommandEffect,PiercingConditionalModel,PiercingConfiguration,PiercingStepInput,PiercingPlanSearchInput
from agents.yf_arc3_v5.capabilities.piercing_plan import _simulate_model,search_piercing_plans

def model(cfg):
 return PiercingConditionalModel(model_ref='conditional_rooted_contact',source_model_ref=cfg['source_rule'],**cfg['conditional_model'],evidence_refs=(),falsifier_refs=('current_root_tip_or_piece_projection_differs',))
def effect(action,a,b,refs):
 dy=b['root'][1]-a['root'][1];dx=b['root'][0]-a['root'][0];de=b['tip']-a['tip']-dx
 if dx or (dy and de)or not(dy or de)or a['layout']!=b['layout']:return None
 return PiercingCommandEffect(effect_ref='observed:'+action,action_ref=action,rod_ref='current_rod',root_translation=(dy,dx),extent_delta=de,extent_cross_section_offsets=tuple((i,0)for i in range(len(a['line_rows']))),axis_direction=(0,1),evidence_refs=tuple(refs),coordinate_scope_ref='coordinate.world')
def plan(s,observation,effects,cfg,retained=None):
 c=configuration(s,observation['observation_ref'],observation['level_epoch'])
 if retained is not None:
  old=PiercingConfiguration.model_validate(retained)
  if projected(old)==physical(s):c=old.model_copy(update={'frame_ref':observation['observation_ref']})
 request=PiercingPlanSearchInput(configuration=c,effects=tuple(PiercingCommandEffect.model_validate(v)for v in effects.values()),models=(model(cfg),),goal_requested_root_ref='current_root',goal_requested_type_order=tuple(s['order']),max_microsteps=cfg['max_microsteps'],max_depth=cfg['max_depth'],max_nodes=cfg['max_nodes'],max_plans=1)
 result=search_piercing_plans(request)
 return c,result
