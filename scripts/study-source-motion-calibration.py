"""Compare strictly prior per-command and shared-pitch forecasts on unchanged public prefixes."""
from pathlib import Path
from collections import Counter, defaultdict
from importlib import import_module
import json,sys
peer=import_module('study-source-controlled-peers')

def models(history):
    votes={q:Counter(z.values()) for q,z in history.items() if z}
    strict={}
    for q,v in votes.items():
        straight=Counter({d:n for d,n in v.items() if (d[0]==0)!=(d[1]==0)})
        if not straight:continue
        d,n=straight.most_common(1)[0]
        if n*2>sum(straight.values()):strict[q]=d
    lengths=Counter()
    for v in votes.values():
        for (x,y),n in v.items():
            if (x==0)!=(y==0):lengths[max(abs(x),abs(y))]+=min(n,8)
    if not lengths:return strict,{},0
    pitch=lengths.most_common(1)[0][0]
    cross=[(pitch,0),(-pitch,0),(0,pitch),(0,-pitch)]
    pooled={}
    for q,v in votes.items():
        counts=Counter()
        for d,n in v.items():
            for h in cross:
                if max(abs(d[0]-h[0]),abs(d[1]-h[1]))*2<pitch:counts[h]+=n
        if not counts:continue
        d,n=counts.most_common(1)[0]
        if n*2>sum(counts.values()):pooled[q]=d
    return strict,pooled,pitch
def study(run):
    frames={h:peer.groups(rows) for h,rows in run['frames'].items()}
    hist=defaultdict(lambda:defaultdict(dict)); active={};seen=set(); counts=Counter(); examples=[]
    for i,(h,q,z,terminal) in enumerate(run['steps']):
        if terminal or not z:break
        b,a=frames[h],frames[z]
        for p,sites in b.items():
            if not hist[p].get(q):continue
            at=next(iter(sites)) if len(sites)==1 else active.get(p)
            if at not in sites or (h,q,p,at) in seen:continue
            s,m,pitch=models(hist[p]);d=m.get(q)
            if not d or not pitch:continue
            seen.add((h,q,p,at)); dest=at[0]+d[0],at[1]+d[1];rest=sites-{at}
            future=a.get(p,set())-rest
            identified=len(future)==1 and rest<=a.get(p,set()) and len(a.get(p,set()))==len(sites)
            actual=next(iter(future)) if identified else None
            cell=lambda pred: bool(actual and actual!=at and max(abs(actual[0]-pred[0]),abs(actual[1]-pred[1]))*2<pitch)
            hit=cell(dest)
            counts['issued']+=1;counts['cellHit']+=hit;counts['exactPixel']+=int(dest==actual)
            if q in s:
                cold=at[0]+s[q][0],at[1]+s[q][1]
                counts['paired']+=1;counts['strictHits']+=cell(cold);counts['pooledHits']+=hit
            else:
                counts['additional']+=1;counts['additionalHit']+=hit
                if hit and len(examples)<2:examples.append([i+1,q,at,dest,actual,pitch])
        for p,sites in b.items():
            aft=a.get(p,set());old,new=sites-aft,aft-sites
            if len(old)==len(new)==1:
                pos,dest=next(iter(old)),next(iter(new));active[p]=dest
                if not q.startswith('ACTION6'):hist[p][q][h,pos]=peer.delta(dest,pos)
            elif sites!=aft:active.pop(p,None)
    return dict(code=run['code'],level=run['level'],counts=dict(counts),examples=examples)

if __name__=='__main__':
    root,out=map(Path,sys.argv[1:]);d=[study(r) for f in sorted(root.glob('poses20-*.json')) for r in json.loads(f.read_bytes())]
    total=Counter()
    for r in d:total.update(r['counts'])
    out.write_bytes(json.dumps(d).encode());print(len(d),dict(total),sum(bool(r['counts'].get('additionalHit')) for r in d))
