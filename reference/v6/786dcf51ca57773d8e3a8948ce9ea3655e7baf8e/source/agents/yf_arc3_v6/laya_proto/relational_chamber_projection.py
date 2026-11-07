"""Measured chamber axes and miniature pair controls; no palette semantics."""
from collections import Counter
from geometric_observer import components
from terminal_composition import identity
from src_bridge import plain

def center(b):return [(b[0]+b[2])/2,(b[1]+b[3])/2]
def inside(a,b):return b[0]<a[0]<=a[2]<b[2]and b[1]<a[1]<=a[3]<b[3]
def perimeter(rows,b,c):
 l,t,r,z=b
 return all(rows[t][x]==rows[z][x]==c for x in range(l,r+1))and all(rows[y][l]==rows[y][r]==c for y in range(t,z+1))
def pair(a,b):return ':'.join(map(str,sorted((a,b))))
def scene(rows):
 cs=components(rows);background=Counter(v for row in rows for v in row).most_common(1)[0][0]
 frames=[c for c in cs if c['color']!=background and min(c['bbox'][2]-c['bbox'][0],c['bbox'][3]-c['bbox'][1])>=14 and perimeter(rows,c['bbox'],c['color'])]
 grids=[]
 for f in frames:
  l,t,r,b=f['bbox'];col=f['color'];xs=[x for x in range(l,r+1)if all(rows[y][x]==col for y in range(t,b+1))];ys=[y for y in range(t,b+1)if all(rows[y][x]==col for x in range(l,r+1))]
  if len(xs)<3 or len(ys)<3:continue
  dx={b-a for a,b in zip(xs,xs[1:])};dy={b-a for a,b in zip(ys,ys[1:])}
  if len(dx)==len(dy)==1 and dx==dy and next(iter(dx))>=6:grids.append((f,xs,ys))
 if len(grids)!=1:return None
 frame,xs,ys=grids[0];main=frame['bbox'];solids=[c for c in cs if inside(c['bbox'],main)and c['color']not in(background,frame['color'])and c['bbox'][2]-c['bbox'][0]==c['bbox'][3]-c['bbox'][1]and c['area']==(c['bbox'][2]-c['bbox'][0]+1)**2 and c['area']>=4]
 if not solids:return None
 unit=min(c['bbox'][2]-c['bbox'][0]+1 for c in solids)
 if unit%2!=1:return None
 rooms=[];offsets=[]
 for y,(top,bottom)in enumerate(zip(ys,ys[1:])):
  for x,(left,right)in enumerate(zip(xs,xs[1:])):
   box=[left,top,right,bottom];mid=center(box);goals=[c for c in cs if inside(c['bbox'],box)and c['bbox'][2]-c['bbox'][0]+1==unit+2 and c['bbox'][3]-c['bbox'][1]+1==unit+2 and c['color']not in(background,frame['color'])and perimeter(rows,c['bbox'],c['color'])]
   if len(goals)>1:return None
   target=center(goals[0]['bbox'])if goals else None;body=[c for c in solids if inside(c['bbox'],box)and c['bbox'][2]-c['bbox'][0]+1==unit]
   overlay=False
   if not body and len(goals)==1 and goals[0]['area']==(unit+2)**2:body=goals;overlay=True
   if len(body)!=1:return None
   pos=center(body[0]['bbox']);offsets +=[abs(pos[i]-mid[i])for i in(0,1)if pos[i]!=mid[i]]
   if target:offsets +=[abs(target[i]-mid[i])for i in(0,1)if target[i]!=mid[i]]
   rooms.append({'id':f'room:{x}:{y}','cell':[x,y],'box':box,'center':mid,'body':pos,'color':body[0]['color'],'target':target,'overlap_hypothesis':overlay})
 if not offsets or len(set(offsets))!=1:return None
 quantum=offsets[0];controls=[];panel_boxes=[]
 for f in frames:
  if f is frame:continue
  l,t,r,b=f['bbox'];mx,my=(l+r)//2,(t+b)//2
  if (r-l)%2 or (b-t)%2 or r-l!=b-t:continue
  boxes=[[l,t,mx,my],[mx,t,r,my],[l,my,mx,b],[mx,my,r,b]];small=[]
  for box in boxes:
   candidates=[c for c in cs if inside(c['bbox'],box)and c['color']not in(background,f['color'])and c['bbox'][2]-c['bbox'][0]==c['bbox'][3]-c['bbox'][1]and c['area']==(c['bbox'][2]-c['bbox'][0]+1)**2 and 1<c['bbox'][2]-c['bbox'][0]+1<unit]
   if len(candidates)!=1:break
   small.append(candidates[0])
  if len(small)!=4:continue
  panel=[]
  for coords,a,z in [([(mx,y)for y in range(t+1,my)],0,1),([(mx,y)for y in range(my+1,b)],2,3),([(x,my)for x in range(l+1,mx)],0,2),([(x,my)for x in range(mx+1,r)],1,3)]:
   runs=[];run=[];last=None
   for point in coords:
    value=rows[point[1]][point[0]]
    if value in(background,f['color']):
     if run:runs.append((last,run));run=[]
    elif value==last:run.append(point)
    else:
     if run:runs.append((last,run))
     run=[point]
    last=value
   if run:runs.append((last,run))
   runs=[z for z in runs if len(z[1])>=2]
   if len(runs)!=1:break
   value,points=runs[0];colors=[small[a]['color'],small[z]['color']];point=points[len(points)//2];panel.append({'id':'relation:'+pair(*colors),'pair':sorted(colors),'value':str(value),'point':list(point),'support':[list(p)for p in points]})
  if len(panel)==4:controls+=panel;panel_boxes.append(f['bbox'])
 if not controls or len({c['id']for c in controls})!=len(controls):return None
 controls.sort(key=lambda c:(c['point'][1],c['point'][0]));by_pair={pair(*c['pair']):c['id']for c in controls};by_cell={tuple(r['cell']):r for r in rooms};axes=[]
 for r in rooms:
  for axis in(0,1):
   neighbors=[]
   for sign in(-1,1):
    cell=list(r['cell']);cell[axis]+=sign;n=by_cell.get(tuple(cell))
    if n:
     ref=by_pair.get(pair(r['color'],n['color']))
     if ref is None:return None
     neighbors.append((sign,ref))
   if not neighbors:continue
   direction=neighbors[0][0]if len(neighbors)==1 else 1;context='single_toward'if len(neighbors)==1 else'ordered_opposite'
   value=(r['body'][axis]-r['center'][axis])/quantum*direction;target=(r['target'][axis]-r['center'][axis])/quantum*direction if r['target']else None
   if value not in(-1,0,1)or target not in(None,-1,0,1):return None
   axes.append({'id':r['id']+':'+str(axis),'room':r['id'],'axis':axis,'context':context,'inputs':[ref for _,ref in neighbors],'value':str(int(value)),'target':None if target is None else str(int(target)),'direction':direction})
 if not any(a['target']is not None for a in axes):return None
 s={'main':main,'pitch':xs[1]-xs[0],'unit':unit,'quantum':quantum,'rooms':rooms,'controls':controls,'axes':axes,'panels':panel_boxes}
 s['layout']=identity([main,[(r['cell'],r['color'],r['target'])for r in rooms],[(c['id'],c['point'])for c in controls],quantum]);return plain(s)

def projection(s):return {'settings':[[c['id'],c['value']]for c in s['controls']],'axes':[[a['id'],a['value']]for a in s['axes']]}
