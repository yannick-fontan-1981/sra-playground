"""Study visible target contacts before official transitions with earlier data in each episode."""
import json,sys
from pathlib import Path
from collections import Counter,defaultdict
from importlib import import_module
peer=import_module('study-source-controlled-peers')
models=import_module('study-source-motion-calibration').models

def study(run):
    frames={h:peer.groups(rows) for h,rows in run['frames'].items()}
    hist=defaultdict(lambda:defaultdict(dict));active={};visits=Counter();tested=set(); positives=[];directions=defaultdict(Counter)
    for i,(h,q,z,end) in enumerate(run['steps']):
        b=frames[h];rows=run['frames'][h];asks=[]
        for p,sites in b.items():
            if not hist[p].get(q):continue
            at=next(iter(sites)) if len(sites)==1 else active.get(p)
            if not at or at not in sites:continue
            strict,pooled,pitch=models(hist[p]);d=strict.get(q) or pooled.get(q)
            if not d:continue
            dest=at[0]+d[0],at[1]+d[1]
            for _,r,x,y,area,width,height in rows:
                if p==r or len(b[r])>12 or (x,y) in sites:continue
                if abs(dest[0]-x)>=max(width,pitch/2) or abs(dest[1]-y)>=max(height,pitch/2):continue
                t=p,r,(x,y),q
                if (h,t) in tested:continue
                asks.append((t,at,dest))
        if end:
            positives=[dict(p=t[0],r=t[1],op=q,at=t[2],actor=at,predicted=dest,previousUnsuccessful=visits[t]) for t,at,dest in asks];break
        for t,_,_ in asks:tested.add((h,t));visits[t]+=1
        if not z:break
        a=frames[z]
        per=set()
        for p,sites in b.items():
            final=a.get(p,set());lost,new=sites-final,final-sites
            if len(lost)==len(new)==1:
                pos,to=next(iter(lost)),next(iter(new));active[p]=to
                if not q.startswith('ACTION6'):
                    d=peer.delta(to,pos);hist[p][q][h,pos]=d
                    if (d[0]==0)!=(d[1]==0):
                        direction=tuple((n>0)-(n<0) for n in d);per.add(direction)
            elif sites!=final:active.pop(p,None)
        if len(per)==1:directions[q][next(iter(per))]+=1
    return dict(code=run['code'],level=run['level'],official=bool(run['steps'] and run['steps'][-1][-1]),offered=len(positives),fresh=sum(z['previousUnsuccessful']==0 for z in positives),examples=positives[:8],directions={q:{str(d):n for d,n in v.items()} for q,v in directions.items()})
if __name__=='__main__':
    root,out=map(Path,sys.argv[1:]);d=[study(r) for f in sorted(root.glob('poses20-*.json')) for r in json.loads(f.read_bytes())];out.write_bytes(json.dumps(d).encode())
    print(len(d),sum(r['official'] for r in d),sum(r['offered']>0 for r in d),sum(r['fresh']>0 for r in d));print([(r['code'],r['level'],r['fresh']) for r in d if r['fresh']][:14])
