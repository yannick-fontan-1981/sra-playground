"""Current exact point/frame/outline correspondences, before any DRM reading.
Caller scopes and hashes the retained measurement before this pure reducer.
"""
from collections import Counter

def _held(s):return next((g['paint']for g in s['column']if g['tight_count']==1),None)
def _stock(s):return Counter({g['paint']:g['ticks']for g in s['column']})
def _pair(s):return tuple((tuple(g['point']),g['paint']if g['full']else None)for g in s['pair'])
def _outlines(s):return Counter((g['paint'],tuple(g['point']))for g in s['outlines'])

def measure_pip_input_correspondence(value,scene,previous,point_action_ref):
 retained=previous.get('protocol_measurement',{})if previous else{}
 add=retained.get('point_removal_and_tight_frame_observed')is True
 remove=retained.get('tight_frame_and_matching_outline_removal_observed')is True
 checks={'single_source_correspondence':False,'single_outline_correspondence':False,'composed_two_point_correspondence':False}
 refuted=[]
 supports=dict(retained.get('correspondence_supports')or{})
 def support():
  return {'before_frame_ref':previous.get('source_frame_ref'),'after_frame_ref':value.current_observation_frame_ref,'dispatched_intent_ref':value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_intent_ref'),'last_actual_point':tuple(value.last_point_position or()),'primitive_delta':value.current_level_primitive_count-previous['level_primitive_count']}
 if not previous:return {'point_removal_and_tight_frame_observed':False,'tight_frame_and_matching_outline_removal_observed':False,'current_correspondence':checks,'refuted_correspondence_fields':(),'correspondence_supports':{}}
 if type(value.current_level_primitive_count)is not int or type(previous.get('level_primitive_count'))is not int:
  return {'point_removal_and_tight_frame_observed':False,'tight_frame_and_matching_outline_removal_observed':False,'current_correspondence':checks,'refuted_correspondence_fields':(),'correspondence_supports':supports}
 before=previous['geometry'];point=tuple(value.last_point_position or());old=_held(before);now=_held(scene)
 delta=value.current_level_primitive_count-previous['level_primitive_count']
 exact_point=value.last_action_ref==point_action_ref
 word=tuple(previous.get('measured_direct_pair_payloads')or())
 if exact_point and delta==2 and len(word)==2 and point==(word[-1]['y'],word[-1]['x']):
  first=(word[0]['y'],word[0]['x']);glyphs=tuple(g for g in before['column']if tuple(g['point'])==first and g['ticks']>0)
  if old is None and len(glyphs)==1:
   p=glyphs[0]['paint'];target=(p,point)
   valid=(now is None and _stock(scene)==_stock(before)-Counter({p:1})and _outlines(scene)==_outlines(before)-Counter({target:1})and _pair(scene)==_pair(before))
   checks['composed_two_point_correspondence']=valid
   if valid:supports['composed_two_point_correspondence']=support()
   if not valid:add=False;remove=False;refuted.extend(('source_delta','outline_delta'))
 elif exact_point and delta==1:
  glyphs=tuple(g for g in before['column']if tuple(g['point'])==point and g['ticks']>0)
  if old is None and len(glyphs)==1:
   p=glyphs[0]['paint'];valid=(now==p and _stock(scene)==_stock(before)-Counter({p:1})and _outlines(scene)==_outlines(before)and _pair(scene)==_pair(before))
   checks['single_source_correspondence']=valid
   if valid:add=True;supports['single_source_correspondence']=support()
   else:add=False;refuted.append('source_delta')
  elif old is not None and any(tuple(g['point'])==point and g['paint']==old for g in before['outlines']):
   valid=(now is None and _stock(scene)==_stock(before)and _outlines(scene)==_outlines(before)-Counter({(old,point):1})and _pair(scene)==_pair(before))
   checks['single_outline_correspondence']=valid
   if valid:remove=True;supports['single_outline_correspondence']=support()
   else:remove=False;refuted.append('outline_delta')
 return {'point_removal_and_tight_frame_observed':add,'tight_frame_and_matching_outline_removal_observed':remove,'current_correspondence':checks,'refuted_correspondence_fields':tuple(refuted),'correspondence_supports':supports}

def direct_pair_payloads(scene,point,protocol):
 if not(protocol['point_removal_and_tight_frame_observed']and protocol['tight_frame_and_matching_outline_removal_observed']):return ()
 if _held(scene)is not None:return ()
 columns=tuple(g for g in scene['column']if tuple(g['point'])==tuple(point)and g['ticks']>0)
 if len(columns)!=1:return ()
 targets=tuple(g for g in scene['outlines']if g['paint']==columns[0]['paint'])
 if len(targets)!=1:return ()
 return tuple({'x':p[1],'y':p[0]}for p in (tuple(point),tuple(targets[0]['point'])))
