"""Forecast a future position at an offset from a visible indicator, or a future form.
Score before revealing the response; compare against the ordinary motion and world-fixed alternatives.
"""
import json,sys
from collections import Counter,defaultdict
from pathlib import Path

def scene(rows):
    count=Counter(r[1] for r in rows)
    return {r[1]:(tuple(r[2:4]),r[0]) for r in rows if count[r[1]]==1}

def sub(a,b):return a[0]-b[0],a[1]-b[1]
def add(a,b):return a[0]+b[0],a[1]+b[1]


def unique_mode(values):
    c=Counter(values)
    if not c:return None,0
    best=c.most_common(2)
    if len(best)>1 and best[0][1]==best[1][1]:return None,0
    return best[0]


def study(run):
    frames={k:scene(rows) for k,rows in run['frames'].items()}
    memory=defaultdict(list);seen=set();tested=set();counts=defaultdict(Counter);questions=[]
    for i,(root,op,to,_) in enumerate(run['steps']):
        if to is None:break
        if (root,op) in seen:continue
        seen.add((root,op));b=frames[root];offers=[]
        for p,(u,form) in b.items():
            for r,(v,mark) in b.items():
                if p==r or u==v:continue
                rows=memory.get((op,p,r),())
                if len(rows)<2:continue
                # Each record contains prior subject, indicator, and returned subject positions and forms.
                offset,n=unique_mode(sub(z,b0) for u0,uf,b0,bf,z,zf in rows)
                if offset is not None and len({b0 for u0,uf,b0,bf,z,zf in rows if sub(z,b0)==offset})>=2:
                    fixed,nf=unique_mode(z for u0,uf,b0,bf,z,zf in rows)
                    delta,nd=unique_mode(sub(z,u0) for u0,uf,b0,bf,z,zf in rows)
                    guess=add(v,offset)
                    # Count tied baseline modes as competitors too.
                    strongest=max(max(Counter(z for *_,z,zf in rows).values()),max(Counter(sub(z,u0) for u0,uf,b0,bf,z,zf in rows).values()))
                    if n>strongest and 2*n>=len(rows) and guess not in (fixed,u,add(u,delta) if delta is not None else u):
                        new=all(b0!=v for u0,uf,b0,bf,z,zf in rows if sub(z,b0)==offset)
                        if new:
                            kind='site' if offset==(0,0) else 'offset'
                            offers.append(((n-strongest,n),kind,p,r,guess,(root,op,p,r,kind),offset))
                current=[(uf,zf,b0) for u0,uf,b0,bf,z,zf in rows if bf==mark]
                if len(current)<2 or len({site for _,_,site in current})<2:continue
                target,votes=unique_mode(zf for uf,zf,b0 in current)
                if target is None or votes!=len(current) or target==form:continue
                if any(uf==form and bf!=mark and zf!=target for u0,uf,b0,bf,z,zf in rows):
                    offers.append(((votes,1),'form',p,r,target,(root,op,p,r,'form'),None))
        # One precommitted question of each type per action to avoid testing until one fits.
        chosen={}
        for rank,kind,p,r,pred,key,offset in sorted(offers,key=lambda v:v[0],reverse=True):
            if kind not in chosen and key not in tested:
                chosen[kind]=(p,r,pred,offset);tested.add(key)
        z=frames[to]
        for kind,(p,r,pred,offset) in chosen.items():
            c=counts[kind];c['issued']+=1
            actual=z.get(p)
            if actual:
                c['observed']+=1;answer=actual[1] if kind=='form' else actual[0]
                c['exact']+=int(answer==pred)
                if len(questions)<36:questions.append(dict(i=i,kind=kind,op=op,p=p,r=r,predicted=pred,actual=answer,offset=offset))
        for p,(u,uf) in b.items():
            if p not in z:continue
            for r,(v,vf) in b.items():
                if r!=p and v!=u:memory[op,p,r].append((u,uf,v,vf,*z[p]))
    return dict(code=run['code'],level=run['level'],counts=counts,examples=questions)

if __name__=='__main__':
    p,out=map(Path,sys.argv[1:]);rs=[study(r) for f in sorted(p.glob('poses20-*.json')) for r in json.loads(f.read_text())]
    out.write_text(json.dumps(rs),encoding='utf8')
    for lower in [True,False]:
        for kind in ['site','offset','form']:
            q=[r for r in rs if(r['level']==1)==lower];c=sum((Counter(r['counts'].get(kind,{})) for r in q),Counter())
            print(lower,kind,dict(c),[(r['code'],r['level']) for r in q if r['counts'].get(kind,{}).get('exact',0)>0])
