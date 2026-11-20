"""Predict which command to try when a displayed part appears or changes relative to a controlled subject."""
from collections import Counter,defaultdict
from pathlib import Path
import json,sys

def sub(a,b):return a[0]-b[0],a[1]-b[1]
def add(a,b):return a[0]+b[0],a[1]+b[1]
def unique(rows):
    counts=Counter(x[1] for x in rows)
    return {x[1]:tuple(x[2:4]) for x in rows if counts[x[1]]==1}

def study(run):
    frames={k:unique(v) for k,v in run['frames'].items()}
    edges=[];known=set();motions=defaultdict(lambda:defaultdict(lambda:defaultdict(set)))
    seen_sites=defaultdict(set);pool={};last=None
    for i,(root,op,to,_) in enumerate(run['steps']):
        b=frames[root]
        if last:
            before=frames[last[0]]
            for p,u in b.items():
                if p not in before or p not in motions:continue
                motor={q:max(ds,key=lambda d:len(ds[d])) for q,ds in motions[p].items() if ds}
                if not motor:continue
                for r,v in b.items():
                    if p==r or u==v:continue
                    birth=r not in before
                    shifted=not birth and v!=before[r] and sub(v,before[r])!=sub(u,before[p])
                    if not (birth or shifted):continue
                    independent=sum(p in frames[f] and p in frames[t] and frames[f][p]!=frames[t][p] and r not in frames[f] for f,q,t in edges)
                    if not independent and len(motor)<2:continue
                    for q in {a for _,a,_ in edges}:
                        if q.startswith('ACTION6:') or (root,q) in known:continue
                        baselines=[(f,frames[t][p]) for f,a,t in edges if a==q and p in frames[f] and p in frames[t]]
                        neg=[f for f,z in baselines if z==frames[f][p] and r not in frames[f]]
                        prior_hit=any(r in frames[f] and z==frames[f][r] and frames[f][p]!=z for f,z in baselines)
                        if not neg or prior_hit:continue
                        if q in motor and add(u,motor[q])==v:continue
                        # A first proposed ability, with an actual stationary control when the display was absent.
                        rank=(q not in motor,birth,independent>0,len({frames[f][p] for f in neg})>1,
                              len(motor)>1,v not in seen_sites[p],min(4,len(neg)),min(4,independent))
                        k=p,r,q,root
                        pool[k]=(rank,dict(i=i,root=root,p=p,r=r,suggested=q,newCue=True,motor=sorted(motor),
                                           newDisplay=birth,from_=u,to=v,controls=len(neg),independent=independent))
        if not to:break
        z=frames[to]
        if (root,op) not in known:
            known.add((root,op));edges.append((root,op,to))
            for p,u in b.items():
                if p in z and u!=z[p]:motions[p][op][sub(z[p],u)].add(u);seen_sites[p].update([u,z[p]])
        last=(root,op)
    out=[];budget=Counter()
    for _,t in sorted(pool.values(),key=lambda v:v[0],reverse=True):
        k=(t['p'],t['r'],t['suggested'])
        if budget[k]>=2:continue
        budget[k]+=1;t['from']=t.pop('from_');out.append(t)
        if len(out)>=8:break
    return dict(code=run['code'],level=run['level'],tickets=out)
if __name__=='__main__':
    p,out=map(Path,sys.argv[1:]);d=[study(r) for f in sorted(p.glob('poses20-*.json')) for r in json.loads(f.read_text())];out.write_text(json.dumps(d),encoding='utf8')
    print('levels, questions',len(d),sum(len(r['tickets']) for r in d))
