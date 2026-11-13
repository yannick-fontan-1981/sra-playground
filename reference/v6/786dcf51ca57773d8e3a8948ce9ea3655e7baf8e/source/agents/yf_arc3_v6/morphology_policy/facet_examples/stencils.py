"""Bounded compositions of observed 2D stencils; no hidden occupancy or gate rules."""
from fractions import Fraction
from math import floor

def render(stamp,placements,background):
 out={}
 for dx,dy in placements:
  for y,row in enumerate(stamp):
   for x,value in enumerate(row):
    if value!=background:out[x+dx,y+dy]=value
 return out

def bounds(points):return min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)

def compare(reference,image,stamp,placements,background,palette,max_denominator=8,sample_offsets=(-.5,0,.5)):
 """Sampled correspondence alternatives retain contour pixels as uncertainty."""
 rh,rw=len(reference),len(reference[0]);sh,sw=len(stamp),len(stamp[0]);l=min(x for x,y in placements);t=min(y for x,y in placements);r=max(x for x,y in placements)+sw-1;b=max(y for x,y in placements)+sh-1;w,h=r-l+1,b-t+1
 possible=sorted({Fraction(n,d) for d in range(1,max_denominator+1) for n in range(1,d+1) if floor(w*n/d)==rw and floor(h*n/d)==rh})
 models=[]
 for scale in possible:
  for ox in sample_offsets:
   for oy in sample_offsets:
    mismatch=0;uncertain=0
    for y,row in enumerate(reference):
     for x,value in enumerate(row):
      px=l+floor((x+.5)/float(scale)+ox);py=t+floor((y+.5)/float(scale)+oy);got=image.get((px,py),background)
      if got not in palette and got!=background:
       allowed={image.get((px+dx,py+dy),background) for dx in (-1,0,1) for dy in (-1,0,1)} & (set(palette)|{background});uncertain+=1
      else:allowed={got}
      if value not in allowed:mismatch+=1;break
     if mismatch:break
    if not mismatch:models.append({'scale':[scale.numerator,scale.denominator],'sample_offset':[ox,oy],'uncertain_contour_samples':uncertain,'claim':'compatible_sampled_correspondence_not_exact_renderer_identification'})
 return models

def candidates(reference,stamp,faces,steps,background,palette,max_units=5,max_states=512,max_denominator=8,sample_offsets=(-.5,0,.5)):
 states=[{'placements':[(0,0)],'actions':[]}];seen=set();results=[];examined=0
 for count in range(1,max_units+1):
  following=[]
  for state in states:
   image=render(stamp,state['placements'],background);signature=(tuple(sorted(image.items())),tuple(sorted(state['placements'])))
   if signature in seen:continue
   seen.add(signature);examined+=1
   if examined>max_states:return {'status':'bounded_incomplete','examined':examined-1,'solutions':results}
   fitted=compare(reference,image,stamp,state['placements'],background,palette,max_denominator,sample_offsets)
   if fitted:results.append({**state,'comparisons':fitted});continue
   if count==max_units:continue
   for origin in state['placements']:
    for face in faces:
     if face['value'] not in steps:continue
     dx,dy=steps[face['value']];destination=(origin[0]+dx,origin[1]+dy)
     if destination in state['placements']:continue
     pixels=[(origin[0]+x,origin[1]+y) for x,y in face['pixels']]
     if any(image.get(p)!=face['value'] for p in pixels):continue
     action={'owner_origin':list(origin),'port_value':face['value'],'offset':list(steps[face['value']]),'destination':list(destination),'point':[origin[i]+face['point'][i] for i in (0,1)]}
     following.append({'placements':[*state['placements'],destination],'actions':[*state['actions'],action]})
  if results:return {'status':'compatible_minimal_within_model','examined':examined,'solutions':results,'model_limit':'No hidden duplicate origins; new stencil overlays measured visible support.'}
  states=following
 return {'status':'no_compatible_composition','examined':examined,'solutions':[]}
