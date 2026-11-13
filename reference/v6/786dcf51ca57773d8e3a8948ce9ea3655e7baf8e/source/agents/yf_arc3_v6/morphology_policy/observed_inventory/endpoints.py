"""Adapt existing V5 endpoint measurements, without their old action authority."""
from copy import deepcopy
from agents.yf_arc3_v5.capabilities.contracts import BoundingBox
from agents.yf_arc3_v5.capabilities.interaction import _provisional_object_terminating_routes

def enclosed(inner,outer):return outer[0]<=inner[0]<=inner[2]<=outer[2] and outer[1]<=inner[1]<=inner[3]<=outer[3]
def xybox(cell):return [cell['bbox'][k] for k in ('left','top','right','bottom')]

def endpoint_measurements(scene,probe,obs,rows,forecast,returned,visited,interfaces):
 if (returned and returned['level_epoch']!=obs['level_epoch']) or probe is None or len(scene.get('grids',[]))!=1:return []
 current_forecast=bool(forecast and forecast.get('observation_ref')==obs['observation_ref'] and forecast.get('level_epoch')==obs['level_epoch'])
 grid=scene['grids'][0];starts=[c for c in grid['cells'] if enclosed(scene['body'],xybox(c))]
 if len(starts)!=1:return []
 v=probe.model_copy(update={'established_boundary_indicator_present':current_forecast,'boundary_indicator_remaining_quantum_count':forecast['steps_before_empty'] if current_forecast else None,'interface_action_translation_deltas':tuple((cmd,vector[1],vector[0]) for cmd,vector in interfaces.items()),'action_conditioned_grid_evidence':True,'visited_input_aligned_entity_bboxes':tuple(BoundingBox(left=b[0],top=b[1],right=b[2],bottom=b[3]) for b in visited)})
 routes,_,_=_provisional_object_terminating_routes(v);out=[]
 for route,aligned,ref,trace in routes.values():
  if not route or any(a not in scene['controls'] and a not in interfaces for a in route):continue
  dr=sum(scene['controls'][a]['delta'][1] if a in scene['controls'] else interfaces[a][1]*grid['row_pitch'] for a in route);dc=sum(scene['controls'][a]['delta'][0] if a in scene['controls'] else interfaces[a][0]*grid['col_pitch'] for a in route)
  if dr%grid['row_pitch'] or dc%grid['col_pitch']:continue
  dest=(starts[0]['row']+dr//grid['row_pitch'],starts[0]['col']+dc//grid['col_pitch']);cell=next((c for c in grid['cells'] if (c['row'],c['col'])==dest),None)
  if cell is None:continue
  box=xybox(cell);l,t,r,b=box;entities=[e for e in obs['entities'] if not e['identity_ambiguous'] and e['area']>1 and enclosed(e['bbox'],box)]
  measured={'source_cell':list(dest),'source_bbox':box,'source_entity':deepcopy(entities[0]) if len(entities)==1 else None,'source_entities':deepcopy(entities),'cell_pixels':[list(row[l:r+1]) for row in rows[t:b+1]],'level_epoch':obs['level_epoch'],'observed_at':obs['observation_ref'],'route_ref':ref,'route_actions':list(route),'endpoint_role':'unknown','dependency_return':returned or {}}
  out.append((list(dest),{'unassigned_endpoint_measured':True},measured))
 return out

def retained_method_targets(scene,obs,rows,memories,methods,returned):
 if not returned or returned['level_epoch']!=obs['level_epoch'] or scene.get('displayed_candidate'):return []
 display=returned.get('cleared_display_pattern');box=returned.get('display_bbox')
 if not display or not box:return []
 l,t,r,b=box
 if [list(row[l:r+1]) for row in rows[t:b+1]]!=display:return []
 available=[m for m in methods if m.get('evidence') and m.get('status')=='observed_correspondence_possession_hypothesis' and m['action']['action_ref'] in obs['available_action_refs'] and m['display_bbox']==box]
 actions={m['action']['action_ref'] for m in available}
 if len(actions)!=1:return []
 method=available[-1];out=[]
 for item in memories:
  entities=item.get('source_entities') or ([item['source_entity']] if item.get('source_entity') else []);box=item['source_bbox']
  if item['level_epoch']!=obs['level_epoch'] or not entities or not enclosed(scene['body'],box):continue
  l,t,r,b=box;bl,bt,br,bb=scene['body'];pixels=item['cell_pixels'];under=scene.get('underlay_evidence',{})
  if list(under.get('cell_bbox',[]))!=box:continue
  if any(rows[y][x]!=pixels[y-t][x-l] for y in range(t,b+1) for x in range(l,r+1) if not(bl<=x<=br and bt<=y<=bb)):continue
  proposal={**deepcopy(item),'method':method,'method_action':deepcopy(method['action']),'current_peripheral_clear_ref':obs['observation_ref'],'competing_source_signatures':[e['signature'] for e in entities],'unknown':['transfer_applicability','new_occurrence_usefulness','capacity','terminal_rule']}
  out.append((item['source_cell'],{'retained_endpoint_current':True,'observed_method_revalidated':True},proposal))
 return out
