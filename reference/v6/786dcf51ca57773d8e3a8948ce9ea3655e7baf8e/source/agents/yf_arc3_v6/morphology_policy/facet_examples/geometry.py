"""Congruent empty/filled faces and partial reference proportions from pixels."""
from collections import Counter
from math import ceil
from terminal_composition import identity

def inside(a,b):return b[0]<a[0] and b[1]<a[1] and a[2]<b[2] and a[3]<b[3]
def box(parts):return [min(e['bbox'][0] for e in parts),min(e['bbox'][1] for e in parts),max(e['bbox'][2] for e in parts),max(e['bbox'][3] for e in parts)]
def shape(e):return tuple(sorted(map(tuple,e['mask'])))
def center(e):
 points=shape(e);n=len(points);sx=sum(x for x,y in points);sy=sum(y for x,y in points)
 x,y=min(points,key=lambda p:((n*p[0]-sx)**2+(n*p[1]-sy)**2,p[1],p[0]));return [e['bbox'][0]+x,e['bbox'][1]+y]
def rectangles(obs):
 result=[]
 for e in obs['entities']:
  l,t,r,b=e['bbox'];w,h=r-l+1,b-t+1
  if min(w,h)<3 or e['area']!=2*w+2*h-4:continue
  if set(map(tuple,e['mask']))=={(x,y) for y in range(h) for x in range(w) if x in (0,w-1) or y in (0,h-1)}:result.append(e)
 return result
def project(obs,rows):
 frames=rectangles(obs)
 if len(frames)<2:return None
 ordered=sorted(frames,key=lambda e:-(e['bbox'][2]-e['bbox'][0])*(e['bbox'][3]-e['bbox'][1]));world=ordered[0]['bbox'];background=Counter(v for row in rows for v in row).most_common(1)[0][0]
 candidates=[]
 for frame in ordered[1:]:
  if inside(frame['bbox'],world):continue
  parts=[e for e in obs['entities'] if inside(e['bbox'],frame['bbox']) and e['palette_value'] not in (background,frame['palette_value'],ordered[0]['palette_value']) and e['area']>=3]
  if len(parts)<3 or len({e['palette_value'] for e in parts})!=len(parts):continue
  palette={e['palette_value'] for e in parts}
  reference=[e for e in obs['entities'] if e['palette_value'] in palette and not inside(e['bbox'],world) and not inside(e['bbox'],frame['bbox'])]
  if Counter(e['palette_value'] for e in reference)!=Counter(palette):continue
  if any(inside(e['bbox'],f['bbox']) for e in reference for f in frames):continue
  paired=[(p,next(e for e in reference if e['palette_value']==p['palette_value'])) for p in parts]
  scales=[(b['bbox'][2]-b['bbox'][0]+1)/(a['bbox'][2]-a['bbox'][0]+1) for a,b in paired]
  if max(scales)-min(scales)>0.15 or not 0<sum(scales)/len(scales)<1:continue
  scale=sum(scales)/len(scales);extension=[];constant=[]
  for source,target in paired:
   sy=source['bbox'][3]-source['bbox'][1]+1;ty=target['bbox'][3]-target['bbox'][1]+1;residual=ty/scale-sy
   (extension if residual>2/scale else constant).append((source,target,residual))
  if len(constant)!=1 or len(extension)<2:continue
  cap,refcap,_=constant[0]
  if any(center(cap)[1]>=center(p)[1] or center(refcap)[1]>=center(q)[1] for p,q,_ in extension):continue
  unit=box(parts);height_extra=max(v for _,_,v in extension)
  world_parts=[e for e in obs['entities'] if inside(e['bbox'],world) and e['palette_value'] in palette]
  if world_parts:
   by=Counter(e['palette_value'] for e in world_parts)
   if set(by)!=palette or by[cap['palette_value']]!=1:continue
   current_cap=next(e for e in world_parts if e['palette_value']==cap['palette_value'])
   if shape(current_cap)!=shape(cap):continue
   # A long connected side is measured as a visible face contribution, never one cube.
   still_missing=[];side_valid=True
   for source,target,_ in extension:
    contributions=sorted([e for e in world_parts if e['palette_value']==source['palette_value']],key=lambda e:e['bbox'][1]);bounds=box(contributions)
    if len({(e['bbox'][0],e['bbox'][2]) for e in contributions})!=1 or any(b['bbox'][1]>a['bbox'][3]+1 for a,b in zip(contributions,contributions[1:])):side_valid=False;break
    if not current_cap['bbox'][1]<bounds[1]<=current_cap['bbox'][3]+1:side_valid=False;break
    missing=(target['bbox'][3]-target['bbox'][1]+1)/scale-(bounds[3]-bounds[1]+1)
    still_missing.append(missing)
   if not side_valid:continue
   if min(still_missing)<=1/scale:continue
   if current_cap['bbox'][1]-world[1]<ceil(min(still_missing)):continue
   offer={'kind':'probe_visible_cap','support':current_cap,'point':center(current_cap),'unresolved_visible_height':still_missing,
      'assumptions':['clicking_current_cap_may_extend_corresponding_sides'],'risks':['may_replace_or_delete_instead_of_extend','sampling_and_outline_differences','hidden_owner_unknown']}
  else:
   seeds=[]
   for e in obs['entities']:
    if e['palette_value']!=background or not inside(e['bbox'],world) or shape(e)!=shape(cap):continue
    dx,dy=e['bbox'][0]-cap['bbox'][0],e['bbox'][1]-cap['bbox'][1]
    estimate=[unit[0]+dx,unit[1]+dy-ceil(height_extra),unit[2]+dx,unit[3]+dy]
    margin=min(estimate[0]-world[0]-1,estimate[1]-world[1]-1,world[2]-estimate[2]-1,world[3]-estimate[3]-1)
    if margin<1:continue
    seeds.append((margin,e,estimate))
   if not seeds:continue
   margin,seed,estimate=max(seeds,key=lambda item:(item[0],-abs(sum(item[1]['bbox'][::2])-world[0]-world[2]),-item[1]['bbox'][0]))
   offer={'kind':'probe_congruent_empty_face','support':seed,'point':center(seed),'estimated_reference_envelope':estimate,'margin':margin,
      'assumptions':['bounded_empty_face_is_editable','filled_example_describes_local_construction'],'risks':['face_may_not_accept_click','scale_is_correspondence_not_exact_bitmap','growth_direction_unconfirmed']}
  candidates.append({'world':world,'example_box':frame['bbox'],'example_parts':parts,'reference_parts':reference,'scale_hypothesis':scale,
   'reference_role':'hypothesis_from_shared_parts_and_relative_proportions','offer':offer,'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],
   'scope_ref':identity([obs['level_epoch'],world,frame['bbox'],[(e['bbox'],e['palette_value'],e['mask']) for e in reference]])})
 return candidates[0] if len(candidates)==1 else None
