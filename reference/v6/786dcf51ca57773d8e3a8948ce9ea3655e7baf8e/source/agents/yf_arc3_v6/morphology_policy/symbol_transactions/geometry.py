"""Bounded raster measurements; role and eligibility conclusions belong to DRM."""
from types import SimpleNamespace
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.capabilities.concentric_frames import measure_concentric_frames,measure_concentric_context,measure_concentric_candidate
from agents.yf_arc3_v5.capabilities.symbolic_diagrams import measure_diagram_context,measure_diagram_candidate,measure_diagram_transition

def frame(rows):return FrameGrid(rows=tuple(tuple(row) for row in rows))

def perimeter_entities(obs,value):
 result=[]
 for entity in obs.get('entities',[]):
  if entity.get('palette_value')!=value:continue
  left,top,right,bottom=entity['bbox'];w=right-left+1;h=bottom-top+1
  if min(w,h)>=3 and entity['area']==2*(w+h)-4 and all(x in (0,w-1) or y in (0,h-1) for x,y in entity['mask']):result.append(entity)
 return result

def project(obs,rows,inputs,config,transition_count=0):
 value=config['palette_white_value'];entities=perimeter_entities(obs,value)
 if not entities:return None
 f=frame(rows);rects=measure_concentric_frames(f)
 context={**measure_diagram_context(f,transition_count),**measure_concentric_context(rects,(),value,f)}
 options=[]
 for action in inputs:
  data=action.get('data',{})
  if set(data)!={'x','y'} or not all(isinstance(data[k],int) and not isinstance(data[k],bool) for k in data):continue
  point=(data['y'],data['x']);candidate=SimpleNamespace(point=point)
  matching=[e for e in entities if any(r.center==point and r.maximum_equal_padding>1 and r.outer_value==value and e['bbox']==[r.left,r.top,r.right,r.bottom] for r in rects)]
  if not matching:continue
  facts={**context,**measure_diagram_candidate(f,candidate,value),**measure_concentric_candidate(rects,candidate,(),value,f),'current_spaced_frame_entity_count':len(matching)}
  at_point=[e for e in obs['entities'] if any((x,y)==(point[1]-e['position'][0],point[0]-e['position'][1]) for x,y in e['mask'])]
  if len(at_point)==1:options.append({'action':action,'facts':facts,'entities':matching,'point_entity':at_point[0]})
 return {'context':context,'options':options}
