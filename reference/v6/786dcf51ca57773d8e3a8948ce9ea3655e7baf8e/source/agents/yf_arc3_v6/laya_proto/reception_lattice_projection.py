"""Public projection at a smaller measured lattice; no game or oracle data."""
from collections import Counter
from geometric_observer import components
from terminal_composition import identity
from src_bridge import plain

def small_scene(rows):
 cs=components(rows);bars=[c for c in cs if c['bbox'][1]>4 and c['bbox'][3]<45 and c['bbox'][1]==c['bbox'][3]and c['bbox'][2]-c['bbox'][0]>24 and c['area']==c['bbox'][2]-c['bbox'][0]+1]
 pairs=[(a,b)for a in bars for b in bars if a['color']==b['color']and a['bbox'][0]==b['bbox'][0]and a['bbox'][2]==b['bbox'][2]and b['bbox'][1]-a['bbox'][1]>=15]
 if not pairs:return None
 top,bottom=max(pairs,key=lambda q:(q[0]['area'],q[1]['bbox'][1]-q[0]['bbox'][1]));left,yt,right,_=top['bbox'];yb=bottom['bbox'][1]
 strips=[c['area']for c in cs if c['color']==top['color']and c['bbox'][1]==c['bbox'][3]and c['bbox'][0]>=left and c['bbox'][2]<=right and yt<c['bbox'][1]<yb and c['area']==c['bbox'][2]-c['bbox'][0]+1 and 3<=c['area']<=8]
 if not strips:return None
 pitch=Counter(strips).most_common(1)[0][0];side=pitch-2
 if side!=2 or (right-left+1)%pitch or (yb-yt)%pitch:return None
 w=(right-left+1)//pitch;h=(yb-yt)//pitch+1;patterns={};wall_patterns=set();slots=[];bodies=[];actors=[]
 for y in range(h):
  for x in range(w):
   px,py=left+x*pitch,yt+y*pitch;patch=[list(row[px:px+pitch])for row in rows[py:py+pitch]]
   if len(patch)!=pitch or any(len(row)!=pitch for row in patch):return None
   pat=identity(patch);patterns[(x,y)]=pat
   if y in(0,h-1):wall_patterns.add(pat)
   col=patch[0][0]
   if patch[0][-1]==patch[-1][0]==patch[-1][-1]==col and patch[0][1]!=col and patch[-1][1]!=col:slots.append({'pos':[x,y],'color':col})
   core=[v for row in patch[1:-1]for v in row[1:-1]];counts=Counter(core)
   if len(counts)==3 and counts.most_common(1)[0][1]==side*side-2:actors.append({'pos':[x,y],'color':counts.most_common(1)[0][0]})
   if len(counts)==1:
    color=core[0];members=[c for c in cs if c['color']==color and c['bbox'][0]<=px+1 and c['bbox'][1]<=py+1 and c['bbox'][2]>=px+side and c['bbox'][3]>=py+side and c['area']<=side*side+side]
    if len(members)==1:bodies.append({'pos':[x,y],'color':color})
   elif len(counts)==2:
    color,n=counts.most_common(1)[0]
    if n==side*side-1 and any(t['pos']==[x,y]and t['color']==color for t in slots):
     members=[c for c in cs if c['color']==color and c['bbox']==[px+1,py+1,px+side,py+side]and c['area']==n]
     if len(members)==1:bodies.append({'pos':[x,y],'color':color,'underlay':'receiver_overlap_candidate'})
 walls=[list(p)for p,v in patterns.items()if v in wall_patterns];bodies=[b for b in bodies if b['pos']not in walls]
 if len(actors)!=1 or not slots or len(slots)!=len(bodies):return None
 dial=[c for c in cs if c['bbox'][1]>=47 and c['bbox'][0]>=45 and c['bbox'][2]-c['bbox'][0]==2 and c['bbox'][3]-c['bbox'][1]==2 and c['area']==8]
 if len(dial)!=8:return None
 def center(b):return [(b[0]+b[2])/2,(b[1]+b[3])/2]
 mid=[sum(center(c['bbox'])[i]for c in dial)/8 for i in(0,1)];dominant=Counter(c['color']for c in dial).most_common(1)[0][0];active=[c for c in dial if c['color']!=dominant]
 if len(active)!=1:return None
 controls=[{'point':[int(z)for z in center(c['bbox'])],'vector':[center(c['bbox'])[i]-mid[i]for i in(0,1)],'active':c is active[0]}for c in dial]
 s={'origin':[left,yt],'pitch':pitch,'size':[w,h],'actor':actors[0]['pos'],'actor_color':actors[0]['color'],'bodies':sorted(bodies,key=lambda q:q['pos']),'slots':sorted(slots,key=lambda q:q['pos']),'walls':walls,'dial':controls,'orientation':next(c['vector']for c in controls if c['active'])};s['layout']=identity([s['origin'],pitch,s['size'],walls,s['slots']]);return plain(s)
