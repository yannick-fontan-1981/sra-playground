"""Recall a measured local stencil and test a bounded compound reference."""
from collections import Counter
from terminal_composition import identity
from .geometry import rectangles,inside,box,shape,center
from .stencils import candidates,render,bounds

def example(obs,rows):
 frames=rectangles(obs)
 if len(frames)<2:return None
 frames=sorted(frames,key=lambda e:-(e['bbox'][2]-e['bbox'][0])*(e['bbox'][3]-e['bbox'][1]));world=frames[0]['bbox'];background=Counter(v for row in rows for v in row).most_common(1)[0][0];found=[]
 for control in frames[1:]:
  if inside(control['bbox'],world):continue
  parts=[e for e in obs['entities'] if inside(e['bbox'],control['bbox']) and e['palette_value'] not in (background,control['palette_value'],frames[0]['palette_value']) and e['area']>=3]
  if len(parts)<3 or len({e['palette_value'] for e in parts})!=len(parts):continue
  l,t,r,b=box(parts);unitbox=[l-1,t-1,r+1,b+1]
  if not inside(unitbox,control['bbox']):continue
  stamp=[list(row[l-1:r+2]) for row in rows[t-1:b+2]];faces=[{'value':e['palette_value'],'pixels':[[e['bbox'][0]+x-l+1,e['bbox'][1]+y-t+1] for x,y in shape(e)],'point':[center(e)[0]-l+1,center(e)[1]-t+1]} for e in parts]
  found.append({'world':world,'control':control['bbox'],'active_marker':control['palette_value'],'parts':parts,'stamp':stamp,'faces':faces,'background':background,'palette':sorted(e['palette_value'] for e in parts),'unit_box':unitbox})
 return found[0] if len(found)==1 else None

def acquire_seed(before,after,first,second,projection):
 model=example(before,first)
 if not model:return None
 parts=[e for e in after['entities'] if inside(e['bbox'],model['world']) and e['palette_value'] in model['palette']]
 if Counter(e['palette_value'] for e in parts)!=Counter(model['palette']):return None
 l,t,r,b=box(parts);anchor=[l-1,t-1];wanted=render(model['stamp'],[anchor],model['background']);painted={p:v for p,v in wanted.items() if v in model['palette']}
 actual={(x,y):second[y][x] for y in range(model['world'][1]+1,model['world'][3]) for x in range(model['world'][0]+1,model['world'][2]) if second[y][x] in model['palette']}
 if painted!=actual:return None
 support=projection['offer']['support'];cap=next((e for e in model['parts'] if shape(e)==shape(support)),None)
 if cap is None:return None
 return {'schema':'observed_2d_stencil_method.v1','stamp':model['stamp'],'faces':model['faces'],'palette':model['palette'],'background':model['background'],'active_marker':model['active_marker'],
  'cap_value':cap['palette_value'],'seed_face_shape':[list(p) for p in shape(cap)],'seed_support_size':[cap['bbox'][2]-cap['bbox'][0]+1,cap['bbox'][3]-cap['bbox'][1]+1],
  'source_epoch':before['level_epoch'],'evidence':[before['observation_ref'],after['observation_ref']],
  'claim':'pointing_a_congruent_empty_face_produced_this_visible_colored_stencil; outline_is_a_template_hypothesis'}

def reference_group(rows,model):
 palette=set(model['palette']);world=model['world'];control=model['control']
 pending={(x,y) for y,row in enumerate(rows) for x,v in enumerate(row) if v in palette and not (world[0]<=x<=world[2] and world[1]<=y<=world[3]) and not (control[0]<=x<=control[2] and control[1]<=y<=control[3])};groups=[]
 while pending:
  first=min(pending);pending.remove(first);todo=[first];group=[]
  while todo:
   x,y=todo.pop();group.append((x,y))
   for dx in (-1,0,1):
    for dy in (-1,0,1):
     p=x+dx,y+dy
     if p in pending:pending.remove(p);todo.append(p)
  if {rows[y][x] for x,y in group}==palette:groups.append(group)
 if len(groups)!=1:return None
 l,t,r,b=bounds(groups[0]);return {'box':[l,t,r,b],'rows':[list(row[l:r+1]) for row in rows[t:b+1]]}

def plan(obs,rows,portable,cache,configuration):
 configuration=dict(configuration)
 if configuration.get('lateral_rule')!='conditional_stencil_sharing_measured_face_edges' or configuration.get('requires_observed_seed_and_vertical_effect_and_boundary') is not True:raise ValueError('Unsupported compound stencil contract')
 if not portable or not portable.get('up_shift') or not portable.get('boundary_ref'):return None
 model=example(obs,rows)
 if not model or any(model[key]!=portable[key] for key in ('stamp','faces','palette','background','active_marker')):return None
 reference=reference_group(rows,model)
 if not reference:return None
 cap=next(f for f in model['faces'] if f['value']==portable['cap_value']);width=len(model['stamp'][0]);cap_height=max(y for x,y in cap['pixels'])-min(y for x,y in cap['pixels'])+1
 steps={cap['value']:portable['up_shift']};statuses={str(cap['value']):'observed_previous_scope_revalidated_example'}
 for face in model['faces']:
  if face['value']==cap['value']:continue
  if face['point'][0]==cap['point'][0]:return None
  steps[face['value']]=[(-1 if face['point'][0]<cap['point'][0] else 1)*(width-1)//2,(cap_height+1)//2]
  statuses[str(face['value'])]='shared_face_extrusion_hypothesis_not_observed'
 key=identity([model['stamp'],reference['rows'],steps,configuration])
 if key not in cache:cache[key]=candidates(reference['rows'],model['stamp'],model['faces'],steps,model['background'],model['palette'],configuration['maximum_units'],configuration['maximum_states'],configuration['maximum_sample_denominator'],configuration['sample_offsets'])
 result=cache[key]
 if result['status']!='compatible_minimal_within_model' or len(result['solutions'])!=1:return None
 solution=result['solutions'][0];world=model['world'];palette=set(model['palette']);actual={(x,y):rows[y][x] for y in range(world[1]+1,world[3]) for x in range(world[0]+1,world[2]) if rows[y][x] in palette}
 if not actual:
  full=render(model['stamp'],solution['placements'],model['background']);l,t,r,b=bounds(full);seeds=[]
  for e in obs['entities']:
   if e['palette_value']!=model['background'] or not inside(e['bbox'],world) or [list(p) for p in shape(e)]!=portable['seed_face_shape']:continue
   anchor=[e['bbox'][0]-min(x for x,y in cap['pixels']),e['bbox'][1]-min(y for x,y in cap['pixels'])]
   margin=min(anchor[0]+l-world[0]-1,anchor[1]+t-world[1]-1,world[2]-anchor[0]-r-1,world[3]-anchor[1]-b-1)
   if margin<1:continue
   seeds.append((margin,-abs(2*anchor[0]+l+r-world[0]-world[2]),e,anchor))
  if not seeds:return None
  _,_,support,anchor=max(seeds,key=lambda s:(s[0],s[1],-s[2]['bbox'][0]));point=center(support);prefix=0;kind='recall_seed_for_compound_reference';port_value=cap['value'];claim='observed_seed_method_revalidated_here'
 else:
  matches=[];al,at,_,_=bounds(actual)
  for index in range(1,len(solution['placements'])+1):
   image={p:v for p,v in render(model['stamp'],solution['placements'][:index],model['background']).items() if v in palette};l,t,_,_=bounds(image);anchor=[al-l,at-t]
   if {(x+anchor[0],y+anchor[1]):v for (x,y),v in image.items()}==actual:matches.append((index,anchor))
  if len(matches)!=1:return None
  prefix,anchor=matches[0]
  if prefix==len(solution['placements']):return None
  action=solution['actions'][prefix-1];point=[anchor[i]+action['point'][i] for i in (0,1)];port_value=action['port_value'];claim=statuses[str(port_value)];kind='probe_compound_continuation'
  support=next((e for e in obs['entities'] if e['palette_value']==port_value and (point[0]-e['bbox'][0],point[1]-e['bbox'][1]) in shape(e)),None)
  if support is None:return None
 scope=identity([obs['level_epoch'],world,model['control'],reference['box'],reference['rows'],key]);relative_next=solution['placements'][:prefix+1];predicted=render(model['stamp'],[(x+anchor[0],y+anchor[1]) for x,y in relative_next],model['background'])
 predicted_colors=sorted([x,y,v] for (x,y),v in predicted.items() if v in palette)
 return {'world':world,'example_box':model['control'],'example_parts':model['parts'],'reference_parts':[],'scale_hypothesis':None,'scope_ref':scope,
  'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'compound':{'model_ref':key,'prefix':prefix,'anchor':anchor,'solution':solution,'source_method':portable,
   'port_status':claim,'palette':model['palette'],'reference':reference,'expected_colored_pixels':predicted_colors,'state_bound':result['examined'],
   'falsifiers':['whole_current_visible_render_differs','local_edit_not_predicted_stencil','other_interface_changes','final_visible_correspondence_without_score'],
   'limits':['bounded_2d_stencils_not_hidden_3d_occupancy','contour_sampling_alternatives_retained','lateral_offsets_are_conditional_until_observed']},
  'offer':{'kind':kind,'point':point,'support':support,'assumptions':[claim,'new_stencil_overlays_visible_support'],'risks':['return_not_proven','reference_sampling_uncertain','owner_is_visible_support_not_hidden_voxel']}}
