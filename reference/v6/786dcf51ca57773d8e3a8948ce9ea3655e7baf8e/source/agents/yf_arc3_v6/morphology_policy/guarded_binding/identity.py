"""Bounded visible-shape comparison for a relocated occurrence, not a palette identity."""
from .geometry import enclosing_contours

def unchanged(entity,observation):
 return any(e['signature']==entity['signature'] and e['bbox']==entity['bbox'] for e in observation['entities'])

def compatible(source,candidate,first,second,before,after,body_before,body_after):
 value=source['palette_value'];old=source['bbox'];new=candidate['bbox'];occlusions=[body_before['bbox'],body_after['bbox']];contours=[enclosing_contours(before,body_before),enclosing_contours(after,body_after)]
 shifts={(new[0]-old[0],new[1]-old[1]),(new[2]-old[2],new[1]-old[1]),(new[0]-old[0],new[3]-old[3]),(new[2]-old[2],new[3]-old[3])};accepted=[]
 def visible(rows,x,y,box,values):
  return 0<=x<len(rows[0]) and 0<=y<len(rows) and not (box[0]<=x<=box[2] and box[1]<=y<=box[3]) and rows[y][x] not in values
 for dx,dy in sorted(shifts):
  l=min(old[0],new[0]-dx);t=min(old[1],new[1]-dy);r=max(old[2],new[2]-dx);b=max(old[3],new[3]-dy);same=[];background=0;hidden=0;contradicted=False
  for y in range(t,b+1):
   for x in range(l,r+1):
    xx,yy=x+dx,y+dy
    if not visible(first,x,y,occlusions[0],contours[0]) or not visible(second,xx,yy,occlusions[1],contours[1]):hidden+=1;continue
    a=first[y][x]==value;c=second[yy][xx]==value
    if a!=c:contradicted=True;break
    if a:same.append([x,y])
    else:background+=1
   if contradicted:break
  if not contradicted and len({x for x,y in same})>1 and len({y for x,y in same})>1:
   accepted.append({'translation':[dx,dy],'matching_visible_foreground':same,'matching_visible_background_count':background,'unobservable_points':hidden})
 return {'status':'visible_shape_compatible_under_bounded_translation','alternatives':accepted,'scope':'visible_part_only_occluded_part_unknown'} if accepted else None
