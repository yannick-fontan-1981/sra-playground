"""Current measurements for a remembered signature after a scope transition.
A changed rectangular indicator is an ambiguity, never proof of hidden contents.
"""
from copy import deepcopy
from .contrast import display_matches
from agents.yf_arc3_v6.morphology_policy.guarded_binding.geometry import find_body

def patch(rows,box):
 l,t,r,b=box
 if not(0<=l<=r<len(rows[0]) and 0<=t<=b<len(rows)):return None
 return [list(row[l:r+1]) for row in rows[t:b+1]]

def capture(before,after,first,second,held,returns,core):
 if not held or not core or before['level_epoch']==after['level_epoch'] or after['levels_completed']<=before['levels_completed'] or not display_matches(held,first):return None
 blank=next((z for z in reversed(returns) if z['level_epoch']==before['level_epoch'] and z.get('cleared_display_pattern') and z['display_bbox']==held['display_bbox']),None)
 if not blank:return None
 return {'status':'unconfirmed_persistence_after_scope_boundary','active':True,'source_receipt':deepcopy(held),'source_epoch':before['level_epoch'],'target_epoch':after['level_epoch'],'old_control_signature':core,'absence_pattern':deepcopy(blank['cleared_display_pattern']),'absence_evidence':blank['evidence'],'before_boundary':before['observation_ref'],'after_boundary':after['observation_ref'],'evidence':held['evidence']+[before['observation_ref'],after['observation_ref']],'alternatives':['same_content_with_changed_presentation','replacement','absence_with_changed_indicator'],'release_authority':False}

def revalidate(memory,obs,rows,methods):
 if not memory or not memory.get('active') or memory['target_epoch']!=obs['level_epoch']:return {'status':'out_of_scope'}
 held=memory['source_receipt'];box=held['display_bbox'];current=patch(rows,box);blank=memory['absence_pattern']
 if current is None:return {'status':'unbound_window'}
 if current==blank:return {'status':'contradicted','reason':'current_window_matches_prior_signature_absence_witness'}
 if any(m.get('source_mask')!=held['source_mask'] and m.get('display_bbox')==box and display_matches(m,rows) for m in methods):return {'status':'contradicted','reason':'different_previously_observed_signature_visible'}
 changed=[(x,y,current[y][x]) for y in range(len(current)) for x in range(len(current[0])) if current[y][x]!=blank[y][x]]
 visible=display_matches(held,rows)
 if not changed:return {'status':'unbound_window'}
 xs=[x for x,y,v in changed];ys=[y for x,y,v in changed]
 rectangular=len(changed)==(max(xs)-min(xs)+1)*(max(ys)-min(ys)+1) and len({v for x,y,v in changed})==1
 if not visible and not rectangular:return {'status':'ambiguous_presentation'}
 body=find_body(obs,memory['old_control_signature'])
 if body is None:return {'status':'unbound_control_correspondence'}
 l,t,_,_=box
 return {'status':'revalidated_hypothesis','body_signature':memory['old_control_signature'],'body_bbox':body['bbox'],'record':{**deepcopy(held),'visibility':'observed_reappearance' if visible else 'opaque_rewrite_hypothesis','current_indicator_pattern':current,'current_indicator_pixels':[[l+x,t+y,v] for x,y,v in changed],'absence_pattern':blank,'current_observation_ref':obs['observation_ref'],'current_level_epoch':obs['level_epoch'],'evidence':memory['evidence']+[obs['observation_ref']],'alternatives':memory['alternatives'],'release_authority':False}}

def complements(scene,rows,held):
 if len(scene.get('grids',[]))!=1:return []
 grid=scene['grids'][0];w=grid['cell_width'];h=grid['cell_height'];shape={tuple(p) for p in held['source_mask']};full={(x,y) for y in range(h) for x in range(w)}
 if not shape or len(shape)>=len(full):return []
 out=[]
 for cell in grid['cells']:
  b=cell['bbox'];l,t=b['left'],b['top'];mask={(x,y) for y in range(h) for x in range(w) if rows[t+y][l+x]==held['source_value']}
  if len(mask)+len(shape)!=len(full):continue
  offsets=[]
  for dy in range(h-max(y for x,y in shape)):
   for dx in range(w-max(x for x,y in shape)):
    placed={(x+dx,y+dy) for x,y in shape}
    if not(mask&placed) and mask|placed==full:offsets.append([dx,dy])
  if len(offsets)==1:out.append({'target_row':cell['row'],'target_col':cell['col'],'target_bbox':[b['left'],b['top'],b['right'],b['bottom']],'level_epoch':scene['level_epoch'],'source_value':held['source_value'],'display_component_ref':held['display_component_ref'],'shape_source':'historically_observed_signature_not_current_pixels','offset':offsets[0],'observation_ref':scene['observation_ref']})
 return out

def current_goal_witnesses(scene,rows,models):
 if len(scene.get('grids',[]))!=1:return []
 out=[]
 for model in models or []:
  if model.get('role')!=scene.get('body_signature') or not model.get('boundary_before'):continue
  old=model.get('scoring_pattern',[])
  for cell in scene['grids'][0]['cells']:
   b=cell['bbox'];w=b['right']-b['left']+1;h=b['bottom']-b['top']+1
   pattern=[rows[y][x] for y in range(b['top'],b['bottom']+1) for x in range(b['left'],b['right']+1)]
   if len(old)!=len(pattern) or min(w,h)<3:continue
   rim=[y*w+x for y in range(h) for x in range(w) if x in (0,w-1) or y in (0,h-1)]
   inside=[i for i in range(w*h) if i not in rim]
   # A visible enclosing contour is a correspondence, never proof that its
   # changed internal state already satisfies the formerly scored composition.
   enclosed=len({old[i] for i in rim})==1 and all(old[i]!=old[rim[0]] for i in inside)
   if pattern!=old and not (enclosed and all(pattern[i]==old[i] for i in rim) and all(pattern[i]!=old[rim[0]] for i in inside)):continue
   residual=[{'cell_offset':[i%w,i//w],'prior':old[i],'current':pattern[i]} for i in inside if pattern[i]!=old[i]]
   out.append({'boundary_before':model['boundary_before'],'boundary_after':model['boundary_after'],'current_cell':[cell['row'],cell['col']],'current_observation_ref':scene['observation_ref'],'interior_residual':residual,'qualification':'current_contour_correspondence_to_prior_scoring_approach_with_unresolved_internal_conditions' if residual else 'current_visual_correspondence_to_prior_scoring_approach_not_a_universal_terminal_law','release_authority':False})
 return out
