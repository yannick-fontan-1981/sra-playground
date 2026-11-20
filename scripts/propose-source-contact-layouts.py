"""Forecast the first contact with a part from repeated free movements of another.
Only positions and motion witnesses earlier than the proposed intervention are visible.
"""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


def sub(a,b):
    return a[0]-b[0],a[1]-b[1]


def add(a,b):
    return a[0]+b[0],a[1]+b[1]


def lattice(rows):
    by_family=defaultdict(list)
    for row in rows:
        by_family[row[1]].append(tuple(row[2:4]))
    return {k:tuple(sorted(v)) for k,v in by_family.items()}


def study(run):
    frames={k:lattice(v) for k,v in run['frames'].items()}
    moves=defaultdict(lambda:defaultdict(dict))
    moving=set();previous=set();offers={};passive=Counter();pairs=Counter()
    for i,(root,chosen,to,terminal) in enumerate(run['steps']):
        scene=frames[root]
        # Identify the position of each potential contact partner, preserving repeated copies.
        at=defaultdict(list)
        for c,ps in scene.items():
            for site in ps:at[site].append(c)
        candidates=[]
        for (p,op),modes in moves.items():
            if (root,op) in previous or len(scene.get(p,()))!=1:
                continue
            point=scene[p][0]
            supported=[(d,v) for d,v in modes.items() if len(v)>=1]
            if not supported:continue
            max_strength=max(len(v) for d,v in supported)
            for d,witnesses in supported:
                if len(witnesses)<max_strength:continue
                mark=add(point,d);target=add(mark,d)
                if min(target)<0:continue
                for c in at[mark]:
                    if c==p or target in scene[c]:continue
                    fixed=tuple(z for z in scene[c] if z!=mark)
                    prior_push=pairs[p,c,op]
                    continuations=[]
                    for (actor,q),options in moves.items():
                        if actor!=p:continue
                        best=max(options,key=lambda v:len(options[v]))
                        if len(options[best])>=2:
                            continuations.append(dict(op=q,after=add(mark,best),ref=next(iter(options[best].values()))))
                    rec=dict(i=i,root=root,p=p,c=c,op=op,fromP=point,fromC=mark,
                             nextP=mark,nextC=target,rest=fixed,
                             support=len(witnesses),refs=list(witnesses.values())[:2],
                             first=c not in moving,priorPush=prior_push,continuations=continuations)
                    rank=(prior_push==0,c not in moving,len(witnesses),len(fixed)>0)
                    key=(p,c,op,mark,target)
                    if key not in offers or rank>offers[key][0]:
                        offers[key]=rank,rec
                    candidates.append(rec)
        if not to:break
        after=frames[to]
        if (root,chosen) in previous:continue
        previous.add((root,chosen))
        for t in candidates:
            if t['op']!=chosen:continue
            dest=after.get(t['p'],())
            cs=after.get(t['c'],());new_cs=tuple(sorted((*t['rest'],tuple(t['nextC']))))
            pushed=tuple(dest)==(tuple(t['nextP']),) and cs==new_cs
            passive['observed']+=1;passive['pushed']+=int(pushed)
            if pushed:pairs[t['p'],t['c'],chosen]+=1
        for p,sites in scene.items():
            new=after.get(p,())
            if new and len(sites)==len(new) and sites!=new:moving.add(p)
            if len(sites)!=1 or len(new)!=1 or sites==new:continue
            d=sub(new[0],sites[0])
            moves[p,chosen][d].setdefault(sites[0],i)
    ranked=sorted(offers.values(),key=lambda a:a[0],reverse=True)
    # Retain multiple part families and interventions when one game supplies many near-identical sites.
    rows=[];counts=Counter()
    for rank,row in ranked:
        group=(row['p'],row['c'],row['op'])
        if counts[group]>=3:continue
        counts[group]+=1;rows.append(row)
        if len(rows)==16:break
    return dict(code=run['code'],level=run['level'],passive=dict(passive),possible=len(offers),tickets=rows)


if __name__=='__main__':
    source,out=map(Path,sys.argv[1:])
    result=[study(r) for f in sorted(source.glob('poses20-*.json')) for r in json.loads(f.read_text(encoding='utf8'))]
    out.write_text(json.dumps(result),encoding='utf8')
    for lower in [True,False]:
        rs=[r for r in result if (r['level']==1)==lower]
        print('levels',len(rs),'questions',sum(len(r['tickets']) for r in rs),'archive',sum((Counter(r['passive']) for r in rs),Counter()))
