"""Public lattice and whole-cell appearance measurements; no named palettes."""
from collections import Counter,defaultdict,deque
import hashlib,json

def ref(value):return hashlib.sha256(json.dumps(value,separators=(',',':'),sort_keys=True).encode()).hexdigest()[:24]
def shape(entity):return tuple(tuple(p) for p in entity['mask'])
def discover(before,after,first,second):
 candidates=[];later=defaultdict(list);stationary=set()
 for b in after['entities']:
  key=(b['palette_value'],shape(b));later[key].append(b);stationary.add((key,tuple(b['bbox'])))
 for a in before['entities']:
  if a['area']<2:continue
  key=(a['palette_value'],shape(a))
  if (key,tuple(a['bbox'])) in stationary:continue
  for b in later[key]:
   dx,dy=b['bbox'][0]-a['bbox'][0],b['bbox'][1]-a['bbox'][1]
   if bool(dx)==bool(dy):continue
   l,t,r,bottom=a['bbox'];size=r-l+1
   if bottom-t+1!=size or max(abs(dx),abs(dy))!=size:continue
   if a['area']<size*size//2:continue
   candidates.append((a,b,size,dx,dy))
 if len(candidates)!=1:return None
 a,b,size,dx,dy=candidates[0];ox,oy=a['bbox'][0]%size,a['bbox'][1]%size;w=(len(first[0])-ox)//size;h=(len(first)-oy)//size
 grid={'size':size,'origin':[ox,oy],'width':w,'height':h,'evidence':[before['observation_ref'],after['observation_ref']]}
 cells=tiles(first,grid);border={p:glyph for p,glyph in cells.items() if p[0] in (0,w-1) or p[1] in (0,h-1)}
 if not border:return None
 wall_value=Counter(v for glyph in border.values() for v in glyph).most_common(1)[0][0];clipped=[]
 for (x,y),glyph in border.items():
  for index,v in enumerate(glyph):
   if v==wall_value:continue
   xx,yy=x*size+index%size,y*size+index//size
   if xx not in (0,w*size-1) and yy not in (0,h*size-1):return None
   clipped.append([xx+ox,yy+oy])
 grid['clipped_boundary_pixels']=clipped
 body=tuple(first[y][x] for y in range(a['bbox'][1],a['bbox'][3]+1) for x in range(a['bbox'][0],a['bbox'][2]+1))
 return {'grid':grid,'body':body,'body_cell':[(a['bbox'][0]-ox)//size,(a['bbox'][1]-oy)//size],'next_cell':[(b['bbox'][0]-ox)//size,(b['bbox'][1]-oy)//size],'delta':[dx//size,dy//size],'wall':tuple([wall_value]*(size*size))}
def tiles(rows,grid):
 size=grid['size'];ox,oy=grid['origin'];return {(x,y):tuple(rows[oy+y*size+dy][ox+x*size+dx] for dy in range(size) for dx in range(size)) for y in range(grid['height']) for x in range(grid['width'])}
def groups(cells):
 remaining=set(cells);result=[]
 while remaining:
  start=min(remaining);remaining.remove(start);group={start};queue=deque([start])
  while queue:
   x,y=queue.popleft()
   for q in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
    if q in remaining and cells[q]==cells[start]:remaining.remove(q);group.add(q);queue.append(q)
  result.append({'cells':sorted(group),'glyph':cells[start]})
 return result
def offsets(points,origin):return sorted((x-origin[0],y-origin[1]) for x,y in points)
def turned(points,quarter):
 result=list(points)
 for _ in range(quarter%4):result=[(-y,x) for x,y in result]
 return sorted(result)
def recoloring(first,second):
 if len(first)!=len(second):return False
 mapping=defaultdict(set)
 for a,b in zip(first,second):mapping[a].add(b)
 return all(len(v)==1 for v in mapping.values()) and len({next(iter(v)) for v in mapping.values()})==len(mapping)
