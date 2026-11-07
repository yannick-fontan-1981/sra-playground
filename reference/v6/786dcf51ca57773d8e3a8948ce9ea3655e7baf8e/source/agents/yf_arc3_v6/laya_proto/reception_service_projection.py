"""Measured lattice, concave supports and request counterparts; no palette roles."""
from collections import Counter,defaultdict,deque
from geometric_observer import components
from terminal_composition import identity
from src_bridge import plain

def sides(rows,b,col):
 l,t,r,z=b
 return [all(rows[y][x]==col for x,y in q)for q in [[(x,t)for x in range(l,r+1)],[(x,z)for x in range(l,r+1)],[(l,y)for y in range(t,z+1)],[(r,y)for y in range(t,z+1)]]]
def scene(rows,retained=None):
 cs=components(rows);groups=defaultdict(list)
 for c in cs:
  l,t,r,b=c['bbox'];w=r-l+1
  if w==b-t+1 and 1<w<5 and c['area']==w*w:groups[(c['color'],w)].append(c)
 borders=[]
 for (col,w),items in groups.items():
  if len(items)<16:continue
  rowsets=defaultdict(set)
  for c in items:rowsets[c['bbox'][1]].add(c['bbox'][0])
  for t,topset in rowsets.items():
   top=sorted(topset);gaps={v-u for u,v in zip(top,top[1:])}
   if len(gaps)!=1 or len(top)<6:continue
   pitch=next(iter(gaps));l=top[0];r=top[-1]+w-1
   for z,lower in rowsets.items():
    if z-t<5*pitch or lower!=topset:continue
    b=z+w-1;outer=[c for c in items if t<=c['bbox'][1]<=z and(c['bbox'][0]==l or c['bbox'][2]==r or c['bbox'][1]in(t,z))]
    if len(outer)>20:borders.append((len(outer),col,w,pitch,[l,t,r,b]))
 if not borders:return None
 _,border,w,pitch,box=max(borders);l,t,r,b=box
 if pitch!=w+2 or (r-l+1-w)%pitch or (b-t+1-w)%pitch:return None
 xs=list(range(l+pitch-1,r-pitch+2,pitch));ys=list(range(t+pitch-1,b-pitch+2,pitch));cells=[(x,y)for y in ys for x in xs];size=pitch
 if not cells:return None
 bg=Counter(rows[y][x]for xx,yy in cells for y in range(yy,yy+size)for x in range(xx,xx+size)).most_common(1)[0][0]
 supports=[]
 for c in cs:
  a,z,x,y=c['bbox'];flags=sides(rows,c['bbox'],c['color'])
  if l<a<=x<r and t<z<=y<b and max(x-a+1,y-z+1)==size and min(x-a+1,y-z+1)==size-1 and sum(flags)==3:
   anchor=min(cells,key=lambda p:abs(p[0]-a)+abs(p[1]-z));supports.append({'bbox':c['bbox'],'anchor':anchor,'color':c['color'],'mask':sorted(c['normalized'])})
 counts=Counter(s['color']for s in supports);targets=[s for s in supports if counts[s['color']]==1]if len(supports)>=4 else[]
 target=targets[0]if len(targets)==1 else None
 if target is None and retained:
  old=retained['target'];a,z,x,y=old['bbox'];corners={(old['anchor'][0]+dx,old['anchor'][1]+dy)for dx,dy in ((0,0),(size-1,0),(0,size-1),(size-1,size-1))}
  if all((a+dx,z+dy)in corners or rows[z+dy][a+dx]==old['color']for dx,dy in old['mask']):target=old
 if target is None:return None
 hud=[c for c in cs if c['bbox'][1]>b and 3<=c['area']<=size*size and not c['rectangular']];world=[c for c in cs if t<c['bbox'][1]<=c['bbox'][3]<b and l<c['bbox'][0]<=c['bbox'][2]<r]
 counterparts=[{'request_shape':identity(sorted(h['normalized'])),'request_bbox':h['bbox'],'body_bbox':c['bbox']}for h in hud for c in world if sorted(h['normalized'])==sorted(c['normalized'])]
 if not counterparts and not retained:return None
 return plain({'box':box,'pitch':pitch,'cells':cells,'background':bg,'target':target,'support_candidates':supports,'counterparts':counterparts or retained['counterparts'],'layout':identity([box,pitch,target['bbox'],target['color'],target['mask']])})
def carriers(rows,s):
 n=s['pitch'];result=[]
 for x,y in s['cells']:
  col=rows[y][x];corners=[rows[y+dy][x+dx]for dx,dy in ((0,0),(n-1,0),(0,n-1),(n-1,n-1))]
  if len(set(corners))==1 and col!=s['background']and all(rows[y][x+i]!=col and rows[y+n-1][x+i]!=col and rows[y+i][x]!=col and rows[y+i][x+n-1]!=col for i in range(1,n-1)):
   result.append({'anchor':[x,y],'color':col})
 return result
def path(rows,s,start,target,moves,remaining):
 n=s['pitch'];free={tuple(p)for p in s['cells']if sum(rows[p[1]+dy][p[0]+dx]==s['background']for dy in range(n)for dx in range(n))>=n*n//2};free-={tuple(x['anchor'])for x in s['support_candidates']if list(x['anchor'])!=list(target)};free|={tuple(start),tuple(target)};parents={tuple(start):None};queue=deque([tuple(start)])
 best=tuple(start)
 def dist(p):return abs(p[0]-target[0])+abs(p[1]-target[1])
 while queue:
  p=queue.popleft()
  if dist(p)<dist(best):best=p
  if p==tuple(target):
   steps=[]
   while parents[p]is not None:
    old,key=parents[p];steps.append({'action_ref':key,'from':list(old),'to':list(p)});p=old
   steps.reverse();return steps if len(steps)<=remaining else None
  for key,d in sorted(moves.items()):
   q=(p[0]+d[0],p[1]+d[1])
   if q in free and q not in parents:parents[q]=(p,key);queue.append(q)
 if best!=tuple(start):
  steps=[];p=best
  while parents[p]is not None:
   old,key=parents[p];steps.append({'action_ref':key,'from':list(old),'to':list(p)});p=old
  steps.reverse();return steps if len(steps)<=remaining else None
 return None
