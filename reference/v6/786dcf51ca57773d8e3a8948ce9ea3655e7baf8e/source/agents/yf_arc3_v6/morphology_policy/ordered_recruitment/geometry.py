from collections import Counter
from hashlib import sha256
import json
from agents.yf_arc3_v6.morphology_policy.topological_recolor.geometry import components

def digest(v):return sha256(json.dumps(v,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def rectangles(rows):
 h=len(rows);w=len(rows[0]);out=[];background=Counter(v for row in rows for v in row).most_common(1)[0][0]
 for t in range(h-5):
  x=0
  while x<w:
   r=x
   while r+1<w and rows[t][r+1]==rows[t][x]:r+=1
   if 6<=r-x+1<=40 and rows[t][x]!=background:
    v=rows[t][x]
    for b in range(t+3,min(h,t+32)):
     if all(rows[y][x]==v and rows[y][r]==v for y in range(t,b+1))and all(rows[b][xx]==v for xx in range(x,r+1)):
      inside=Counter(rows[y][xx]for y in range(t+1,b)for xx in range(x+1,r))
      if inside and inside.most_common(1)[0][0]!=v:out.append({'bbox':[x,t,r,b],'border':v,'base':inside.most_common(1)[0][0]})
   x=r+1
 return out

def legend(rows,cc):
 sq=[c for c in cc if c['bbox'][2]-c['bbox'][0]==c['bbox'][3]-c['bbox'][1]and c['bbox'][2]>c['bbox'][0]and len(c['cells'])==(c['bbox'][2]-c['bbox'][0]+1)**2];groups={}
 for c in sq:groups.setdefault((c['bbox'][1],c['bbox'][3]-c['bbox'][1]+1),[]).append(c)
 relations=[]
 for (y,n),large in groups.items():
  small=[c for c in groups.get((y,n-1),[])if c['bbox'][0]>max(z['bbox'][2]for z in large)]
  if len(large)!=2 or len(small)!=2:continue
  large.sort(key=lambda c:c['bbox'][0]);small.sort(key=lambda c:c['bbox'][0])
  if large[-1]['bbox'][2]>=small[0]['bbox'][0]:continue
  l=large[-1]['bbox'][2]+1;r=small[0]['bbox'][0]-1
  glyphs=[]
  for x in range(l,r):
   v=rows[y][x]
   if n>=3 and rows[y+n-1][x]==v and rows[y+n//2][x+1]==v and rows[y+n//2][x]!=v and rows[y][x+1]!=v:glyphs.append([x,y,x+1,y+n-1,v])
  if len(glyphs)!=1:continue
  relations.append({'left':[c['value']for c in large],'right':[c['value']for c in small],'glyph':glyphs[0],'evidence_boxes':[c['bbox']for c in large+small]})
 if len(relations)<2:return None
 pairs={tuple(sorted(r['left']))for r in relations}
 if any(tuple(sorted(r['right']))not in pairs for r in relations)or len(pairs)!=len(relations)or len({v for p in pairs for v in p})!=2*len(pairs):return None
 return {'pairs':sorted(pairs),'relations':relations}

def spiral(n):
 out=[];left=top=0;right=bottom=n-1
 while left<=right and top<=bottom:
  out.extend((x,top)for x in range(left,right+1));top+=1
  out.extend((right,y)for y in range(top,bottom+1));right-=1
  if top<=bottom:out.extend((x,bottom)for x in range(right,left-1,-1));bottom-=1
  if left<=right:out.extend((left,y)for y in range(bottom,top-1,-1));left+=1
 return out

def lattice_subsets(allpoints):
 out=[]
 row_counts=Counter(y for xx,y in allpoints);eligible=sorted(y for y,count in row_counts.items()if count>=3)
 lattices=[]
 for top in eligible:
  for following in eligible:
   pitch=following-top
   if pitch<2:continue
   for n in range(3,9):
    ys=[top+pitch*k for k in range(n)]
    if not set(ys)<=set(eligible):continue
    points=[(xx,y)for xx,y in allpoints if y in ys];xs=sorted({xx for xx,y in points})
    if len(xs)!=2*n:continue
    a=xs[:n];e=xs[n:]
    if any(v-u!=pitch for group in(a,e)for u,v in zip(group,group[1:]))or e[0]-a[-1]<=pitch:continue
    # Each lattice point is visible except at most one front marker per camp.
    if len(points)<2*n*n-2:continue
    lattices.append((a,e,ys,pitch))
 for candidate in lattices:
  footprint={(xx,yy)for xx in candidate[0]+candidate[1]for yy in candidate[2]}
  if not any(footprint<{(xx,yy)for xx in other[0]+other[1]for yy in other[2]}for other in lattices):out.append(candidate)
 return out

def connector(rows,bbox,base,axis):
 l,t,r,b=bbox
 cells={(x,y)for y in range(t,b+1)for x in range(l,r+1)if rows[y][x]!=base}
 if len(cells)not in(3,4)or len({rows[y][x]for x,y in cells})!=1:return None
 # A measured tip plus two symmetric wings; the wing center may be filled.
 matches=[]
 for tip in cells:
  for direction in(-1,1):
   for depth in range(1,max(r-l,b-t)+1):
    wing=(tip[0]-direction*depth,tip[1])if axis=='horizontal'else(tip[0],tip[1]-direction*depth)
    wings={(wing[0],wing[1]-depth),(wing[0],wing[1]+depth)}if axis=='horizontal'else{(wing[0]-depth,wing[1]),(wing[0]+depth,wing[1])}
    core={tip}|wings
    if cells==core or cells==core|{wing}:matches.append({'tip':list(tip),'wings':[list(v)for v in sorted(wings)],'direction':direction,'axis':axis,'center_filled':wing in cells,'cells':[list(v)for v in sorted(cells)]})
 return matches[0]if len(matches)==1 else None

def measure(rows,order=None):
 if not rows or not rows[0]:return None
 cc=components(rows);lg=legend(rows,cc)
 if not lg:return None
 types={v:i for i,p in enumerate(lg['pairs'])for v in p};rects=rectangles(rows);buttons=[]
 for r in rects:
  l,t,x,b=r['bbox']
  if not x-l<b-t:continue
  fields=[c for c in cc if c['value']in types and l<c['bbox'][0]<=c['bbox'][2]<x and t<c['bbox'][1]<=c['bbox'][3]<b and c['bbox'][2]-c['bbox'][0]==c['bbox'][3]-c['bbox'][1]and len(c['cells'])==(c['bbox'][2]-c['bbox'][0]+1)**2]
  if len(fields)==1:buttons.append({**r,'value':fields[0]['value'],'type':types[fields[0]['value']],'point':[(l+x)//2,(t+b)//2]})
 if len(buttons)!=len(lg['pairs'])or len({b['type']for b in buttons})!=len(buttons)or len({(b['bbox'][2]-b['bbox'][0],b['bbox'][3]-b['bbox'][1])for b in buttons})!=1:return None
 player={b['value']for b in buttons};enemy=set(types)-player
 if len(enemy)!=len(player)or any(len(set(p)&player)!=1 for p in lg['pairs']):return None
 rooms=[]
 for r in rects:
  l,t,x,b=r['bbox']
  if not x-l>b-t or t>=min(z['bbox'][1]for z in buttons):continue
  possible=[]
  for value in {rows[y][xx]for y in range(t+1,b)for xx in range(l+1,x)}-set(types)-{r['base'],r['border']}:
   allpoints=[(xx,y)for y in range(t+1,b)for xx in range(l+1,x)if rows[y][xx]==value]
   possible.extend((value,*lattice)for lattice in lattice_subsets(allpoints))
  if len(possible)!=1:continue
  value,a,e,ys,pitch=possible[0];n=len(ys);path=spiral(n);left=[];right=[];valid=True
  for camp,xs,values,out in(('player',list(reversed(a)),player,left),('enemy',e,enemy,right)):
   empty_seen=False
   for u,v in path:
    xx,y=xs[u]-(pitch-1),ys[v]-(pitch-1);color=rows[y][xx]
    if color in values:
     if empty_seen:valid=False;break
     out.append({'type':types[color],'value':color,'point':[xx,y]})
    elif color==r['base']:empty_seen=True
    else:valid=False;break
  if not valid:continue
  fronts=[]
  for xs,queue in ((list(reversed(a)),left),(e,right)):
   if not queue:continue
   marker=rows[ys[0]][xs[0]]
   if marker in set(types)|{r['base'],value}:valid=False;break
   marks=[(xx,yy)for yy in ys for xx in xs if rows[yy][xx]not in {r['base'],value}]
   if marks!=[(xs[0],ys[0])]:valid=False;break
   fronts.append({'point':[xs[0],ys[0]],'value':marker})
  if not valid:continue
  lower=[c for c in cc if len(c['cells'])==1 and l<c['bbox'][0]<x and ys[-1]+1<c['bbox'][1]<b and c['value']not in set(types)|{r['base'],r['border'],value}]
  # Closed compartments have a repeated interior contour; isolated non-grid marks remain candidate quota tokens.
  quota=len(lower);rooms.append({**r,'left':left,'right':right,'empty_value':value,'grid':{'left':a,'right':e,'ys':ys,'pitch':pitch},'quota_hypothesis':quota,'front_markers':fronts,'order_status':'front_anchored_inward_spiral_hypothesis_not_full_order_law'})
 if len(rooms)<2 or len({(r['bbox'][2]-r['bbox'][0],r['bbox'][3]-r['bbox'][1])for r in rooms})!=1:return None
 active=[i for i,r in enumerate(rooms)if r['left']]
 if len(active)!=1:return None
 graph={i:[]for i in range(len(rooms))};links=[]
 for i,a in enumerate(rooms):
  for j,b in enumerate(rooms):
   if i>=j:continue
   l,t,r,d=a['bbox'];u,v,x,y=b['bbox'];linked=False
   if d==y and t==v:
    left,right=sorted((a,b),key=lambda z:z['bbox'][0]);lo=left['bbox'][2]+1;hi=right['bbox'][0]-1
    blocked=any(z is not a and z is not b and z['bbox'][0]<=hi and z['bbox'][2]>=lo and z['bbox'][1]<=d and z['bbox'][3]>=t for z in rooms)
    witness=connector(rows,[lo,t+1,hi,d-1],a['base'],'horizontal')if not blocked and lo<=hi else None;linked=witness is not None
   elif l==u and r==x:
    upper,lower=sorted((a,b),key=lambda z:z['bbox'][1]);lo=upper['bbox'][3]+1;hi=lower['bbox'][1]-1
    blocked=any(z is not a and z is not b and z['bbox'][1]<=hi and z['bbox'][3]>=lo and z['bbox'][0]<=r and z['bbox'][2]>=l for z in rooms)
    witness=connector(rows,[l+1,lo,r-1,hi],a['base'],'vertical')if not blocked and lo<=hi else None;linked=witness is not None
   if linked:graph[i].append(j);graph[j].append(i);links.append({'rooms':[a['bbox'],b['bbox']],'witness':witness,'meaning':'chain_link_hypothesis_not_progression_law'})
 if any(len(v)>2 or not v for v in graph.values()):return None
 if order:
  if {tuple(r['bbox'])for r in rooms}!={tuple(b)for b in order}:return None
  ordered=[next(r for r in rooms if r['bbox']==list(b))for b in order]
  indices=[next(i for i,r in enumerate(rooms)if r['bbox']==list(b))for b in order]
  expected_edges={frozenset((i,j))for i,j in zip(indices,indices[1:])};actual_edges={frozenset((i,j))for i,neighbors in graph.items()for j in neighbors}
  if actual_edges!=expected_edges:return None
 else:
  if len(graph[active[0]])!=1:return None
  walk=[active[0]]
  while len(walk)<len(rooms):
   nexts=[j for j in graph[walk[-1]]if j not in walk]
   if len(nexts)!=1:return None
   walk.append(nexts[0])
  ordered=[rooms[i]for i in walk]
 current=next(i for i,r in enumerate(ordered)if r['left']);ar=ordered[current];active_buttons=all(b['border']==ar['border']for b in buttons);quota=None
 if active_buttons:
  candidates=[r for r in rects if r['bbox'][1]>max(q['bbox'][3]for q in rooms)and r['bbox'][3]<min(q['bbox'][1]for q in buttons)and r['border']==ar['border']]
  if len(candidates)!=1:return None
  q=candidates[0];l,t,r,b=q['bbox'];runs=[];xx=l+1
  while xx<r:
   if all(rows[yy][xx]==q['base']for yy in range(t+1,b)):xx+=1;continue
   end=xx
   while end+1<r and any(rows[yy][end+1]!=q['base']for yy in range(t+1,b)):end+=1
   vals={rows[yy][xxx]for yy in range(t+1,b)for xxx in range(xx,end+1)}
   if len(vals)!=1:return None
   runs.append(next(iter(vals)));xx=end+1
  quota=sum(v==q['border']for v in runs)
  if quota<1:return None
 return {'links':links,'rooms':ordered,'current':current,'buttons':buttons,'legend':lg,'types':types,'player_values':sorted(player),'enemy_values':sorted(enemy),'phase_hypothesis':'RECRUIT'if active_buttons else'COMBAT','quota':quota,'order':[r['bbox']for r in ordered],'signature':{'room_shape':[ar['bbox'][2]-ar['bbox'][0]+1,ar['bbox'][3]-ar['bbox'][1]+1],'grid_side':len(ar['grid']['ys']),'grid_pitch':ar['grid']['pitch'],'legend_pair_count':len(lg['pairs'])}}
