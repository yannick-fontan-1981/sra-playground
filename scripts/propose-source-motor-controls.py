"""Predict two interventions from the same unseen public state, using earlier source observations."""
from collections import Counter,defaultdict
from itertools import combinations
from pathlib import Path
import json,sys
def diff(a,b):return (a[0]-b[0],a[1]-b[1])
def add(a,b):return [a[0]+b[0],a[1]+b[1]]
def study(r):
 frames={}
 for k,es in r['frames'].items():
  ct=Counter(e[1] for e in es);frames[k]={e[1]:e for e in es if ct[e[1]]==1}
 history=defaultdict(lambda:defaultdict(list));seen=set();pool={};passive=Counter()
 for i,(fr,real,dest,_) in enumerate(r['steps']):
  if not dest:break
  now=frames[fr];nxt=frames[dest];accepted=[]
  for actor,v in now.items():
   p=v[2:4];actions={}
   for op,samples in history[actor].items():
    if op.startswith('ACTION6:') or any(f==fr for f,*_ in samples):continue
    counts=Counter(d for f,a,b,form,d in samples)
    d,m=counts.most_common(1)[0]
    hits=[z for z in samples if z[-1]==d]
    if m*3<len(samples)*2 or len({tuple(h[1]) for h in hits})<2:continue
    actions[op]={'op':op,'to':add(p,d),'hit':m,'n':len(samples),'rootForms':set(h[3] for h in hits),'seenP':{tuple(h[1]) for h in hits},'destinations':{tuple(h[2]) for h in hits}}
   for (a,x),(b,y) in combinations(sorted(actions.items()),2):
    if x['to']==y['to']:continue
    change=v[0] not in x['rootForms'] or v[0] not in y['rootForms']
    newSite=tuple(p) not in x['seenP'] and tuple(p) not in y['seenP']
    if not (change or newSite):continue
    def card(q):return {'op':q['op'],'to':q['to'],'hits':q['hit'],'trials':q['n'],'unseenForm':v[0] not in q['rootForms'],'newLanding':tuple(q['to']) not in q['destinations']}
    arms=[card(x),card(y)]
    score=(int(change),int(newSite),int(all(z['newLanding'] for z in arms)),min(x['hit']/x['n'],y['hit']/y['n']),min(x['hit'],y['hit']))
    ticket={'i':i,'root':fr,'actor':actor,'shape':v[0],'p':p,'arms':arms,'newSite':newSite,'change':change}
    if real in (a,b) and (fr,real) not in seen and actor in nxt:
     expected=x if real==a else y
     if (actor,fr,real) not in seen:
      seen.add((actor,fr,real));k='form' if v[0] not in expected['rootForms'] else 'site';passive[k]+=1;passive[k+'Exact']+=int(nxt[actor][2:4]==expected['to'])
    accepted.append((score,ticket))
  if accepted:
   score,t=max(accepted,key=lambda z:z[0]);key=(t['actor'],tuple(t['p']),t['shape'],tuple(a['op'] for a in t['arms']))
   if key not in pool or score>pool[key][0]:pool[key]=(score,t)
  if (fr,real) in seen:continue
  seen.add((fr,real))
  for actor,v in now.items():
   if actor not in nxt:continue
   p=v[2:4];q=nxt[actor][2:4];history[actor][real].append((fr,p,q,v[0],diff(q,p)))
 return {'code':r['code'],'level':r['level'],'candidates':len(pool),'passive':dict(passive),'tickets':[t for score,t in sorted(pool.values(),key=lambda x:x[0],reverse=True)[:4]]}
p=Path(sys.argv[1]);out=Path(sys.argv[2]);rs=[study(r) for f in sorted(p.glob('poses20-*.json')) for r in json.loads(f.read_text())];out.write_text(json.dumps(rs),'utf8')

