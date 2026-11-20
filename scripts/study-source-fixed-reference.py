"""Forecast an observed subject's next arrival around a visible reference, with earlier public frames only."""
from collections import Counter, defaultdict
from pathlib import Path
import json, sys
from importlib import import_module
peer = import_module('study-source-controlled-peers')


def rotations(v):
    x,y=v
    return ((x,y),(-x,y),(x,-y),(-x,-y),(y,x),(-y,x),(y,-x),(-y,-x))


def study(run, passive=False, ray=False):
    frames={h:peer.groups(rows) for h,rows in run['frames'].items()}
    tracked,relations,excluded,counts={},defaultdict(dict),set(),Counter()
    samples=[]; roots={}
    for i,(h,q,z,terminal) in enumerate(run['steps']):
        if terminal or not z: break
        b,a=frames[h],frames[z]
        for (p,r,c,command),evidence in relations.items():
            if command!=q or p not in b or c not in b or r not in b: continue
            sites=b[p]
            pos=next(iter(sites)) if len(sites)==1 else tracked.get(p)
            if not pos or pos not in sites: continue
            for anchor in b[c]:
                seen={u:v for u,v in evidence.items() if v is not None}
                fits=[j for j in range(1,8) if len(seen)>=2 and all(rotations(u)[j]==v for u,v in seen.items())]
                relative=peer.delta(pos,anchor)
                if relative in seen:
                    predictions={seen[relative]}
                elif len(fits) and any(u[0]*relative[1]==u[1]*relative[0] and u[0]*relative[0]+u[1]*relative[1]>0 for u in seen):
                    predictions={rotations(relative)[j] for j in fits}
                elif ray:
                    predictions=set()
                    for u,v in seen.items():
                        d=abs(u[0])+abs(u[1]); n=abs(relative[0])+abs(relative[1])
                        if not d or not n or u[0]*relative[1]!=u[1]*relative[0] or u[0]*relative[0]+u[1]*relative[1]<=0:continue
                        if v[0]*n%d==0 and v[1]*n%d==0:predictions.add((v[0]*n//d,v[1]*n//d))
                else:continue
                if len(predictions)!=1:continue
                dx,dy=predictions.pop(); dest=anchor[0]+dx,anchor[1]+dy
                ticket=h,q,p,r,c,anchor,pos,dest
                if dest not in b[r] or dest in sites or ticket in excluded:continue
                excluded.add(ticket);counts['predicted']+=1
                exact=(sites-{pos})|{dest}==a.get(p,set())
                counts['exact']+=int(exact)
                roots[h,q,p,pos,dest]=exact
                if exact and len(samples)<2:samples.append([i+1,p,r,c,pos,anchor,dest])
        if passive:
            # These displayed pairs may contribute only to later forecasts, after the action has been bound.
            for (p,r,c,command),evidence in list(relations.items()):
                if any(x not in b for x in (p,r,c)) or len(b[r])!=1:continue
                pos=next(iter(b[p])) if len(b[p])==1 else tracked.get(p)
                mark=next(iter(b[r]))
                if not pos or pos not in b[p] or mark in b[p]:continue
                compatible=[]
                for at in b[c]:
                    u,v=peer.delta(pos,at),peer.delta(mark,at)
                    if at not in (pos,mark) and v in rotations(u)[1:]:compatible.append((sum(map(abs,u)),u,v))
                compatible.sort()
                if compatible and (len(compatible)==1 or compatible[0][0]<compatible[1][0]):
                    _,u,v=compatible[0]
                    if u not in evidence:evidence[u]=v
                    elif evidence[u]!=v:evidence[u]=None
        for p,sites in b.items():
            end=a.get(p,set()); gone,new=sites-end,end-sites
            if len(gone)!=1 or len(new)!=1:
                if sites!=end:tracked.pop(p,None)
                continue
            pos,dest=next(iter(gone)),next(iter(new));tracked[p]=dest
            for r,marks in b.items():
                if p==r or dest not in marks:continue
                for c,anchors in b.items():
                    if c in (p,r) or len(anchors)>12:continue
                    for at in anchors & a.get(c,set()):
                        u,v=peer.delta(pos,at),peer.delta(dest,at)
                        if at in (pos,dest) or v not in rotations(u)[1:]:continue
                        m=relations[p,r,c,q]
                        if u not in m:m[u]=v
                        elif m[u]!=v:m[u]=None
    if roots: counts.update(distinct=len(roots),distinctExact=sum(roots.values()))
    return dict(code=run['code'],level=run['level'],counts=dict(counts),examples=samples)

if __name__=='__main__':
    root,dest=map(Path,sys.argv[1:3]); passive='--displays' in sys.argv[3:]
    result=[study(r,passive,'--ray' in sys.argv[3:]) for f in sorted(root.glob('poses20-*.json')) for r in json.loads(f.read_bytes())]
    dest.write_bytes(json.dumps(result).encode()); total=Counter()
    for r in result:total.update(r['counts'])
    print(len(result),sum(bool(r['counts']) for r in result),sum(bool(r['counts'].get('exact')) for r in result),dict(total))
