"""Bounded conditional paths over current repeated support, no choice of goals."""
from collections import deque

def measured_paths(facts,rows,target_cells,interface_hypotheses,available,maximum=16,conditional_cells=()):
 if len(facts.get('grids',()))!=1:return []
 grid=facts['grids'][0];bl,bt,br,bb=facts['body'];cells={(c['row'],c['col']):c for c in grid['cells']}
 start=[k for k,c in cells.items() if c['bbox']['left']<=bl<=br<=c['bbox']['right'] and c['bbox']['top']<=bt<=bb<=c['bbox']['bottom']]
 if len(start)!=1:return []
 start=start[0];box=cells[start]['bbox'];left,top=box['left'],box['top'];w=grid['cell_width'];h=grid['cell_height']
 exterior={(x,y):rows[top+y][left+x] for y in range(h) for x in range(w) if not(bl<=left+x<=br and bt<=top+y<=bb)}
 if not exterior:return []
 departure=facts.get('conditional_departure_support')
 overlay=departure or facts.get('underlay_evidence',{}).get('material_overlay');retained=False
 if overlay and overlay['level_epoch']==facts['level_epoch'] and tuple(overlay['body_bbox'])==tuple(facts['body']) and overlay['cell_bbox']==[box['left'],box['top'],box['right'],box['bottom']] and all(exterior.get((x,y))==v for x,y,v in overlay['current_exterior']):
  exterior={(x,y):v for x,y,v in overlay['prior_exterior']};retained=True
 controls={};known=facts.get('controls',{})
 for cmd,delta in interface_hypotheses.items():
  if cmd in available and cmd not in facts.get('rejected_interface_commands',[]):controls[cmd]={'cell_delta':(delta[1],delta[0]),'status':'interface_mapping_hypothesis'}
 for cmd,record in known.items():
  dx,dy=record['delta']
  if cmd in available and dx%grid['col_pitch']==0 and dy%grid['row_pitch']==0:
   controls[cmd]={'cell_delta':(dy//grid['row_pitch'],dx//grid['col_pitch']),'status':'recalled_translation_hypothesis' if record.get('recalled_hypothesis') else 'observed_translation','evidence':record['evidence']}
 allowed=set()
 for key,c in cells.items():
  l,t=c['bbox']['left'],c['bbox']['top']
  if all(rows[t+y][l+x]==v for (x,y),v in exterior.items()):allowed.add(key)
 materials={}
 for layer in facts.get('retained_material_surfaces',[]):
  matching=[key for key,c in cells.items() if [c['bbox'][k] for k in ('left','top','right','bottom')]==layer['cell_bbox']]
  if len(matching)!=1:continue
  key=matching[0];substrate=layer['substrate_patch']
  if len(substrate)!=h or any(len(row)!=w for row in substrate) or any(substrate[y][x]!=v for (x,y),v in exterior.items()):continue
  if key in materials:materials[key]=None
  else:materials[key]=layer
 materials={key:layer for key,layer in materials.items() if layer is not None}
 allowed.update(materials)
 conditional={tuple(cell) for cell in conditional_cells}
 results=[]
 for target in target_cells:
  end=tuple(target);queue=deque([start]);parent={start:None};edge={}
  while queue and end not in parent:
   current=queue.popleft()
   for cmd,control in controls.items():
    dr,dc=control['cell_delta'];dest=(current[0]+dr,current[1]+dc)
    if dest not in cells or dest in parent or (dest not in allowed and dest!=end and dest not in conditional):continue
    parent[dest]=current;edge[dest]=(cmd,control);queue.append(dest)
  if end not in parent:continue
  reverse=[];point=end
  while parent[point] is not None:
   cmd,control=edge[point];reverse.append({'action':{'action_ref':cmd},'from_cell':parent[point],'to_cell':point,'control':control,'surface_status':'retained_material_surface_hypothesis' if point in materials else 'matching_observed_exterior_hypothesis' if point in allowed else 'conditional_intermediate_partition' if point in conditional else 'destination_effect_unknown'});point=parent[point]
  path=list(reversed(reverse));prefix=[]
  for step in path[:maximum]:
   if step['to_cell'] in materials:step={**step,'control':{**step['control'],'status':'retained_material_entry_hypothesis','surface_evidence':materials[step['to_cell']]['evidence']}}
   if retained and not prefix:step={**step,'control':{**step['control'],'status':'retained_endpoint_departure_hypothesis' if departure else 'retained_surface_departure_hypothesis','surface_evidence':overlay['evidence']}}
   if step['to_cell']==end and prefix:break
   prefix.append(step)
   if step['control']['status']!='observed_translation' or step['to_cell']==end:break
  results.append({'target_cell':end,'length':len(path),'prefix':prefix,'path':path,'start_cell':start,'support_evidence':'entered_support_and_current_endpoint_revalidated' if retained and departure else 'retained_pre_material_exterior_currently_revalidated' if retained else 'matching_current_exterior_of_candidate_body_cell','hypotheses':['other_similar_surfaces_may_differ','interface_direction_not_an_acquired_game_law'],'resource_model_required':True})
  if retained and departure:results[-1]['conditional_departure_support']=departure
  used=[materials[step['to_cell']] for step in path if step['to_cell'] in materials]
  if used:results[-1]['conditional_material_entries']=[{k:layer[k] for k in ('cell_bbox','evidence','qualification','visible_pixels','hidden_pixels')} for layer in used]
 return results
