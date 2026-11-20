from pathlib import Path
from collections import defaultdict,Counter
import json,sys

def groups(rows):
 g=defaultdict(dict)
 for row in rows:g[row[1]][tuple(row[2:4])]=row
 return g
def single_move(b,z):
 if not b or not z or len(b)!=len(z):return
 old=b.keys()-z.keys();new=z.keys()-b.keys()
 if len(old)==len(new)==1:return next(iter(old)),next(iter(new))
def covers(row,site):
 return abs(row[2]-site[0])<row[5] and abs(row[3]-site[1])<row[6]
def sub(a,b):return a[0]-b[0],a[1]-b[1]
def survey(run):
 frames={h:groups(v) for h,v in run['frames'].items()};active={};latest={};evidence=defaultdict(list);known=set();seen=set();pool=[];last=None
 for i,(h,q,z,terminal) in enumerate(run['steps']):
  cur=frames[h]
  if last:
   old=frames[last]
   for p,origin in active.items():
    actor=cur.get(p,{}).get(origin)
    if not actor or len(cur[p])<2 or not latest.get(p):continue
    for r,g in cur.items():
     if r==p or (p,r) in known:continue
     prev=old.get(r,{})
     for at in g.keys()-prev.keys():
      if any(covers(row,at) for row in cur[p].values()):continue
      roots=[j for j,u,v,ds in evidence[p] if r not in ds]
      if not roots:continue
      key=(p,r,origin,at)
      if key in seen:continue
      seen.add(key)
      t=dict(i=i,root=h,p=p,r=r,origin=origin,site=at,peers=sorted(cur[p].keys()-{origin}),lastMotion=latest[p],independent=roots[-1],appeared=r not in old,indicatorUnique=len(g)==1,ordinary=any(sub(v,u)==sub(at,origin) for _,u,v,_ in evidence[p]),singleNew=len(g.keys()-prev.keys())==1)
      pool.append(t)
  if terminal or z not in frames:break
  after=frames[z]
  for p,g in cur.items():
   end=after.get(p,{});move=single_move(g,end)
   if move:
    u,v=move;active[p]=v;latest[p]=i+1;evidence[p].append((i+1,u,v,set(cur)))
    for r,displays in cur.items():
     if r!=p and any(not covers(g[u],at) and covers(end[v],at) for at in displays):known.add((p,r))
   elif not end or g.keys()!=end.keys():active.pop(p,None)
  last=h
 budget=Counter();chosen=[]
 for t in sorted(pool,key=lambda t:(not t['indicatorUnique'],not t['appeared'],not t['singleNew'],t['ordinary'],t['i'])):
  k=(t['p'],t['r'])
  if budget[k]>=2:continue
  budget[k]+=1;chosen.append(t)
  if len(chosen)>=8:break
 return dict(code=run['code'],level=run['level'],tickets=chosen)
if __name__=='__main__':
 d,dest=map(Path,sys.argv[1:])
 out=[survey(r) for f in sorted(d.glob('poses20-*.json')) for r in json.loads(f.read_text())]
 dest.write_bytes(json.dumps(out).encode())
 print(len(out),sum(bool(g['tickets']) for g in out),sum(len(g['tickets']) for g in out))
