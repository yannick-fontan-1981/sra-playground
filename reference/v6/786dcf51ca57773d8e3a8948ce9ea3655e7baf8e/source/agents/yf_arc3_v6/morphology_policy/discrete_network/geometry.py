"""Bounded public-raster rectangle and orthogonal-connector candidates.
No semantic gate types, palette meanings, game names, or solution vectors.
"""
from collections import Counter, deque

def rectangles(rows, max_side=13):
 h,w=len(rows),len(rows[0]);background=Counter(v for row in rows for v in row).most_common(1)[0][0];found=[]
 for t in range(h-2):
  for l in range(w-2):
   c=rows[t][l]
   if c==background:continue
   for r in range(l+2,min(w,l+max_side)):
    if rows[t][r]!=c:break
    if any(rows[t][x]!=c for x in range(l,r+1)):break
    for b in range(t+2,min(h,t+max_side)):
     if rows[b][l]!=c or rows[b][r]!=c:break
     if any(rows[y][l]!=c or rows[y][r]!=c for y in range(t,b+1)):break
     if any(rows[b][x]!=c for x in range(l,r+1)):continue
     inside=[rows[y][x] for y in range(t+1,b) for x in range(l+1,r)]
     if all(v==c for v in inside):continue
     found.append({'box':[l,t,r,b],'rim':c,'interior':inside,'shape':[r-l+1,b-t+1]})
 return found

def ports(rows,box,background):
 l,t,r,b=box;h=len(rows)
 return {side:[(x,y) for x in range(l,r+1) if 0<=y<h and rows[y][x]!=background] for side,y in [('top',t-1),('bottom',b+1)]}

def paths(rows,start,end,blocked):
 sx,sy=start;ex,ey=end
 if sy<ey:return []
 color=rows[sy][sx];h,w=len(rows),len(rows[0]);out=[]
 for turn in range(ey,sy+1):
  points=[(sx,y) for y in range(sy,turn-1,-1)]
  if ex!=sx:points += [(x,turn) for x in range(sx+(1 if ex>sx else -1),ex+(1 if ex>sx else -1),1 if ex>sx else -1)]
  points += [(ex,y) for y in range(turn-1,ey-1,-1)]
  if any(p in blocked for p in points):continue
  holes=[];valid=True
  for k,(x,y) in enumerate(points):
   if rows[y][x]==color:continue
   # A missing raster pixel is tolerated only inside a straight segment,
   # with visible continuation on both sides and a transverse covering line.
   if k==0 or k==len(points)-1:valid=False;break
   before,after=points[k-1],points[k+1]
   if rows[before[1]][before[0]]!=color or rows[after[1]][after[0]]!=color:valid=False;break
   vertical=before[0]==after[0]==x;horizontal=before[1]==after[1]==y
   cover=rows[y][x]
   crosses=(vertical and 0<x<w-1 and rows[y][x-1]==cover==rows[y][x+1]) or (horizontal and 0<y<h-1 and rows[y-1][x]==cover==rows[y+1][x])
   if not crosses:valid=False;break
   holes.append([x,y])
  if valid:
   candidate={'points':points,'occluded':holes,'palette':color}
   if not any(x['points']==points for x in out):out.append(candidate)
 return out

def project(rows,extent):
 left,top,right,bottom=extent
 nodes=[n for n in rectangles(rows) if left<=n["box"][0]<=n["box"][2]<=right and top<=n["box"][1]<=n["box"][3]<=bottom]
 nodes=[n for n in nodes if not any(m is not n and m["rim"]==n["rim"] and m["box"][0]<=n["box"][0] and m["box"][1]<=n["box"][1] and m["box"][2]>=n["box"][2] and m["box"][3]>=n["box"][3] for m in nodes)]
 background=Counter(v for row in rows for v in row).most_common(1)[0][0]
 for i,n in enumerate(nodes):n['id']=i;n['ports']=ports(rows,n['box'],background)
 blocked={(x,y) for n in nodes for l,t,r,b in [n['box']] for y in range(t,b+1) for x in range(l,r+1)}
 blocked.update((x,y) for y in range(len(rows)) for x in range(len(rows[0])) if not (left<=x<=right and top<=y<=bottom))
 edges=[]
 for source in nodes:
  for target in nodes:
   if source['box'][1]<=target['box'][3]:continue
   for a in source['ports']['top']:
    for b in target['ports']['bottom']:
     options=trace_connector(rows,a,b,blocked,background)
     if options:edges.append({'source':source['id'],'target':target['id'],'source_port':a,'target_port':b,'alternatives':options})
 return {'nodes':nodes,'edges':edges,'background':background}


def trace_connector(rows,start,end,blocked,background,max_covered=3):
 """Orthogonal route witness; covered intervals stay hypotheses."""
 h,w=len(rows),len(rows[0]);color=rows[start[1]][start[0]]
 if rows[end[1]][end[0]]!=color or start[1]<end[1]:return []
 queue=deque([start]);parent={start:None};segments={}
 while queue:
  current=queue.popleft()
  if current==end:break
  x,y=current
  for dx,dy in [(1,0),(-1,0),(0,-1),(0,1)]:
   covered=[]
   for distance in range(1,max_covered+2):
    nx,ny=x+dx*distance,y+dy*distance;q=(nx,ny)
    if not (0<=nx<w and 0<=ny<h) or q in blocked:break
    c=rows[ny][nx]
    if c==color:
     if q not in parent:parent[q]=current;segments[q]=covered;queue.append(q)
     break
    if c==background:break
    covered.append(q)
 if end not in parent:return []
 points=[];holes=[];q=end
 while q is not None:
  points.append(q);holes+=segments.get(q,[]);q=parent[q]
 return [{'points':list(reversed(points)),'occluded':holes,'palette':color,'qualification':'visible_route_with_bounded_occlusion_hypothesis'}]
