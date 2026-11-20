"""Select speculative transfers from publicly observed, coupled motions in archived source trajectories."""
import json,sys
from collections import Counter,defaultdict
from pathlib import Path
def delta(a,b):return (a[0]-b[0],a[1]-b[1])
def study(r):
 frames={}
 for h,es in r['frames'].items():
  counts=Counter(e[1] for e in es);frames[h]={e[1]:e for e in es if counts[e[1]]==1}
 history=defaultdict(list);hits=defaultdict(lambda:defaultdict(list));seen=set();pool={};passive=Counter()
 for i,(fr,op,to,_) in enumerate(r['steps']):
  if to is None:break
  scene=frames[fr];nextv=frames[to];offers=[]
  for p,m in sorted(set(history)|set(hits)):
   evidence=history.get((p,m),[])
   if p not in scene or m not in scene:continue
   u=tuple(scene[p][2:4]);v=tuple(scene[m][2:4])
   if u==v or abs(u[0]-v[0])+abs(u[1]-v[1])<min(scene[p][5:]+scene[m][5:]):continue
   examples={(a,d,e) for a,d,e,f,p0 in evidence};perm={a for a,d,e in examples}
   previous={q:rows for q,rows in hits.get((p,m),{}).items() if (fr,q) not in seen}
   if not previous and len({p0 for a,d,e,f,p0 in evidence})<2:continue
   distinct=len({(d,e) for a,d,e in examples})
   nonparallel=any(d[0]*e[1]!=d[1]*e[0] for a,d,e in examples)
   nonrigid=any(d!=e for a,d,e in examples)
   if not nonrigid and not previous:continue
   # Distinct predictions require the two roles themselves to be spatially separable.
   distinctSites={q:len({pos for _,pos in rows}) if all(pos!=v for _,pos in rows) else 0 for q,rows in previous.items()}
   predicted=max(distinctSites,key=distinctSites.get) if distinctSites else None
   gain=distinctSites.get(predicted,0)
   value=(gain>0,predicted is not None,nonparallel,distinct>1,len(perm)>1,min(5,len(evidence)),abs(u[0]-v[0])+abs(u[1]-v[1]))
   t={'i':i,'root':fr,'p':p,'r':m,'from':u,'to':v,'motor':sorted(perm),'suggested':predicted,'newCue':gain>0,'nonparallel':nonparallel,'samples':len(evidence)}
   if (fr,op) not in seen and (op not in perm or op==predicted) and p in nextv:
    passive['reads']+=1;actual=tuple(nextv[p][2:4]);passive['arrived']+=int(actual==v);passive['moved']+=int(actual!=u)
   offers.append((value,t))
  for value,t in sorted(offers,key=lambda x:x[0],reverse=True)[:2]:
   key=(t['p'],t['r'],tuple(t['to']))
   if key not in pool or pool[key][0]<value:pool[key]=(value,t)
  if (fr,op) in seen:continue
  seen.add((fr,op));mov=[(k,tuple(e[2:4]),delta(nextv[k][2:4],e[2:4])) for k,e in scene.items() if k in nextv and e[2:4]!=nextv[k][2:4]]
  for p,u,d in mov:
   for mid,e in scene.items():
    if mid!=p and tuple(e[2:4])==tuple(nextv[p][2:4]):hits[p,mid][op].append((fr,tuple(e[2:4])))
   for m,v,z in mov:
    if p!=m and u!=v:history[p,m].append((op,d,z,fr,u))
 return {'code':r['code'],'level':r['level'],'passive':dict(passive),'total':len(pool),'tickets':[t for _,t in sorted(pool.values(),key=lambda x:x[0],reverse=True)[:5]]}
p=Path(sys.argv[1]);out=Path(sys.argv[2]);rs=[study(r) for f in sorted(p.glob('poses20-*.json')) for r in json.loads(f.read_text())];out.write_text(json.dumps(rs),'utf8')

