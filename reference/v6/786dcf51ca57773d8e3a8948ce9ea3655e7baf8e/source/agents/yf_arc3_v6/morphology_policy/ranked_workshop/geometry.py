"""Adapt current public components to the existing palette-neutral V5 projector."""
from agents.yf_arc3_v5.capabilities.contracts import ComponentDescription,BoundingBox
from agents.yf_arc3_v5.capabilities.station_profile_scene import measure_station_profile_scene,station_profile_context

def candidates(observation):
 # Cheap structural admission: separated monochrome combs with a complete edge stem.
 found=0
 for e in observation.get('entities',[]):
  l,t,r,b=e['bbox'];w=r-l+1;h=b-t+1
  if w<5 or h<2 or e['rectangular']:continue
  mask=set(map(tuple,e['mask']))
  if not (all((x,h-1) in mask for x in range(w)) or all((x,0) in mask for x in range(w))):continue
  occupied=[x for x in range(w) if sum((x,y) in mask for y in range(h))>1]
  groups=sum(i==0 or occupied[i-1]!=x-1 for i,x in enumerate(occupied))
  if groups>=2:found+=1
 return found>=2

def project(observation,rows,config):
 if not candidates(observation):return {},{}
 height,width=len(rows),len(rows[0]);parts=[]
 for e in observation['entities']:
  l,t,r,b=e['bbox'];relative=tuple((y,x) for x,y in e['mask']);pixels=tuple((t+y,l+x) for y,x in relative)
  if any(not (0<=y<height and 0<=x<width) or rows[y][x]!=e['palette_value'] for y,x in pixels):return {},{}
  parts.append(ComponentDescription(component_id=e['id'],value=e['palette_value'],pixels=pixels,relative_pixels=relative,bbox=BoundingBox(top=t,left=l,bottom=b,right=r),area=len(pixels),touches_frame_boundary=l==0 or t==0 or r==width-1 or b==height-1))
 scene=measure_station_profile_scene(rows,parts,config['stem'],config['scene']);return scene,comparison_context(scene,config['scene'])

def stable_context(context):
 return {k:v for k,v in context.items() if not k.endswith('_ref')}


def comparison_context(scene,configuration):
 """Bound profile comparisons to formats actually instantiated by current receivers.

 Keep all original profiles in scene; a format exclusion is not an assertion
 that a glyph has no use. No count, pitch, palette or station is supplied here.
 """
 formats=set()
 for binding in scene.get('receiver_bindings',()):
  cut=binding['cut_measurements'];columns=cut['rank_columns']
  pitches={b-a for a,b in zip(columns,columns[1:])}
  if len(pitches)!=1 or cut['uncertain_rank_indexes']:continue
  for axis in configuration['receiver_axis_directions']:
   formats.add((axis,len(columns),cut['rank_width_pixels'],next(iter(pitches))))
 admitted=[];other=[]
 for profile in scene.get('profiles',()):
  p=profile['profile'];fmt=(p['stem_relief_axis_direction'],len(p['stem_relief_rank_height_pixels']),p['stem_relief_rank_width_pixels'],p['stem_relief_rank_pitch_pixels'])
  (admitted if fmt in formats else other).append(profile)
 scene['comparison_domain']={'measured_receiver_formats':[list(f) for f in sorted(formats)],'admitted_profile_refs':[p['component_ref'] for p in admitted],'retained_other_profiles':other,'exclusion_scope':'not_homologous_to_these_receiver_formats; utility_and_role_unknown','axis_scope':'declared_reference_cut_measurement_orientation; not_universal_geometry'}
 return station_profile_context({**scene,'profiles':tuple(admitted)})
