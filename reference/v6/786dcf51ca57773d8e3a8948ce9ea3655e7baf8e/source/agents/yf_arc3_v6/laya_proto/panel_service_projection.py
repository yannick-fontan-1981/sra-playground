"""Measured repeated control panels and visible material/service correspondences.

No game identity, palette role, command trajectory, or engine state is accepted.
The compact rectangular panel grammar is a declared structural prior.
"""
from collections import Counter
from geometric_observer import components
from terminal_composition import identity
from src_bridge import plain

def border(rows,b,c):
 l,t,r,z=b
 return all(rows[t][x]==rows[z][x]==c for x in range(l,r+1))and all(rows[y][l]==rows[y][r]==c for y in range(t,z+1))
def inside(a,b):return b[0]<a[0]<=a[2]<b[2] and b[1]<a[1]<=a[3]<b[3]
def pattern(rows,x,y,u,bg):return tuple((dx,dy)for dy in range(u)for dx in range(u)if rows[y+dy][x+dx]!=bg)
def scene(rows,symbols=()):
 cs=components(rows);frames=[c for c in cs if 15<=c['bbox'][2]-c['bbox'][0]<=35 and 10<=c['bbox'][3]-c['bbox'][1]<=25 and border(rows,c['bbox'],c['color'])]
 groups={}
 for c in frames:
  b=c['bbox'];groups.setdefault((b[0],b[2],b[3]-b[1]),[]).append(c)
 groups=[sorted(v,key=lambda c:c['bbox'][1])for v in groups.values()if len(v)>=2]
 if len(groups)!=1:return None
 frames=groups[0];panels=[]
 for f in frames:
  b=f['bbox'];l,t,r,z=b;bg=Counter(rows[y][x]for y in range(t+1,z)for x in range(l+1,r)).most_common(1)[0][0]
  squares=[c for c in cs if inside(c['bbox'],b)and c['area']==9 and c['bbox'][2]-c['bbox'][0]==2 and c['bbox'][3]-c['bbox'][1]==2 and c['color']!=bg]
  if not squares:return None
  # Unit inferred from currently visible complete square controls.
  u=squares[0]['bbox'][2]-squares[0]['bbox'][0]+1
  small=[c for c in cs if inside(c['bbox'],b)and c['color']!=bg and c['bbox'][2]-c['bbox'][0]==u-1 and c['bbox'][3]-c['bbox'][1]<=u-1]
  xs=sorted({c['bbox'][0]for c in small});ys=sorted({c['bbox'][1]for c in small if c['bbox'][3]-c['bbox'][1]==u-1})
  if len(xs)<3 or not ys:return None
  # Complete repeated lattice from observed endpoints, not a fixed screen origin.
  step=min(v-u0 for u0,v in zip(xs,xs[1:]));ystep=min((v-u0 for u0,v in zip(ys,ys[1:])),default=step);allxs=list(range(xs[0],r-u+1,step))
  if len(allxs)!=5 or ystep%step:return None
  ally=list(range(t+2,z-u+1,step))
  if len(ally)!=3:return None
  cells=[]
  for ri,y in enumerate(ally):
   for ci,x in enumerate(allxs):
    pat=pattern(rows,x,y,u,bg)
    if not pat:continue
    colors=Counter(rows[y+dy][x+dx]for dx,dy in pat);color=colors.most_common(1)[0][0]
    cb=[x-1,y-1,x+u,y+u];outline=rows[y-1][x-1]if rows[y-1][x-1]!=bg and border(rows,cb,rows[y-1][x-1])else None
    cells.append({'row':ri,'col':ci,'point':[x+u//2,y+u//2],'bbox':[x,y,x+u-1,y+u-1],'pattern':list(pat),'color':color,'solid':len(pat)==u*u,'outline':outline})
  mats=[c for c in cells if c['col']==0 and c['solid']];selected=[c for c in mats if c['outline']is not None]
  if len(selected)!=1:return None
  select=selected[0]['outline'];marks=[c for c in cs if c['area']==4 and c['bbox'][2]-c['bbox'][0]==1 and c['bbox'][0]<l and l-c['bbox'][2]<=5 and t<=c['bbox'][1]<=z]
  if len(marks)!=1:return None
  room_candidates=[c for c in cs if c['color']==marks[0]['color']and c['bbox'][2]<l and c['bbox'][3]-c['bbox'][1]>=8]
  if not room_candidates or len({(c['bbox'][1],c['bbox'][3])for c in room_candidates})!=1:return None
  room=[min(c['bbox'][0]for c in room_candidates),room_candidates[0]['bbox'][1],max(c['bbox'][2]for c in room_candidates),room_candidates[0]['bbox'][3]];rx,ry,rr,rb=room
  material=selected[0]['color'];external=[c for c in cs if rx<=c['bbox'][0]<=c['bbox'][2]<=rr and ry<=c['bbox'][1]<=c['bbox'][3]<=rb and c['area']==u*u and c['bbox'][2]-c['bbox'][0]==u-1 and c['bbox'][3]-c['bbox'][1]==u-1]
  operators=[];services=[];controls=[c for c in cells if c['col']==1 and not c['solid']]
  signatures={tuple(tuple(v)for v in c['pattern'])for c in controls}|{tuple(tuple(v)for v in s)for s in symbols}
  for sig in signatures:
   c=next((c for c in controls if tuple(tuple(v)for v in c['pattern'])==sig),None);matches=[]
   for y in range(ry,rb-u+2):
    for x in range(rx+1,rr-u+1):
     tile=[rows[y+dy][x+dx]for dy in range(u)for dx in range(u)];freq=Counter(tile)
     if len(freq)!=2:continue
     for background in freq:
      if pattern(rows,x,y,u,background)==sig:matches.append([x,y])
   relations=[]
   for x,y in matches:
    left=[q for q in external if q['bbox'][1]==y and 0<x-q['bbox'][2]<=u];right=[q for q in external if q['bbox'][1]==y and 0<q['bbox'][0]-(x+u-1)<=u]
    below=[q for q in external if q['bbox'][0]==x and 0<q['bbox'][1]-(y+u-1)<=u]
    relation={'control':c,'symbol':list(sig),'observed_site':[x,y],'selected':c is not None and c['outline']==select}
    if len(left)==len(right)==1:relation.update(kind='displayed_rewrite',input=left[0]['color'],output=right[0]['color'])
    elif len(below)==1:relation.update(kind='displayed_receiver',input=below[0]['color'])
    else:continue
    relations.append(relation)
   if len(relations)!=1:continue
   relation=relations[0]
   services.append(relation)
   if c is not None:operators.append(relation)
  panels.append({'id':identity([b,f['color']]),'bbox':b,'color':f['color'],'room':room,'room_marker':marks[0]['color'],'material':material,'selection_color':select,'cells':cells,'operators':operators,'services':services,'activity_controls':controls})
 if len(panels)!=len(frames):return None
 return plain({'panels':panels,'layout':[[p['bbox'],p['color']]for p in panels]})
