"""Count witnessed reads with a named reference held in its previously reached placement."""
from collections import defaultdict,Counter
from pathlib import Path
from importlib import import_module
import json,sys
peer=import_module('study-source-controlled-peers')

def study(r):
    frames={h:peer.groups(rows) for h,rows in r['frames'].items()}
    known=set();placed={};roots=set();seen=set();result=[];active={};counts=Counter()
    for i,(h,q,z,terminal) in enumerate(r['steps']):
        if terminal or not z:break
        b,a=frames[h],frames[z]
        for p,m,c,op in sorted(known):
            if q!=op or (p,m,c,op,h) in seen or not all(x in b for x in (p,m,c)) or len(b[m])!=1:continue
            actor=next(iter(b[p])) if len(b[p])==1 else active.get(p)
            if not actor or actor not in b[p]:continue
            mark=next(iter(b[m]));rest=b[p]-{actor}
            if mark in b[p]:continue
            for centre in b[c]:
                step=placed.get((c,centre))
                if step is None or i<=step or any(k in (actor,mark) for k in [centre]):continue
                if sorted(map(abs,peer.delta(actor,centre)))!=sorted(map(abs,peer.delta(mark,centre))):continue
                key=(h,q,p,actor,mark)
                if key in roots:continue
                roots.add(key);seen.add((p,m,c,op,h));counts['asked']+=1
                hit=rest|{mark}==a.get(p,set()) and centre in a.get(c,set())
                counts['hit']+=int(hit)
                if hit and len(result)<3:result.append([i+1,step+1,q,actor,centre,mark])
        for p,g in b.items():
            nxt=a.get(p,set());gone,new=g-nxt,nxt-g
            if len(gone)!=1 or len(new)!=1:
                if g!=nxt:active.pop(p,None)
                continue
            origin,arrival=next(iter(gone)),next(iter(new));active[p]=arrival
            placed.pop((p,origin),None);placed[p,arrival]=i
            for m,marks in b.items():
                if m==p or arrival not in marks:continue
                for c,peers in b.items():
                    if c in (p,m) or len(peers)>12:continue
                    for centre in peers & a.get(c,set()):
                        if centre not in (origin,arrival) and sorted(map(abs,peer.delta(origin,centre)))==sorted(map(abs,peer.delta(arrival,centre))):known.add((p,m,c,q))
    return dict(code=r['code'],level=r['level'],counts=dict(counts),examples=result)
if __name__=='__main__':
    root,out=map(Path,sys.argv[1:]);d=[study(r) for f in sorted(root.glob('poses20-*.json')) for r in json.loads(f.read_bytes())]
    total=Counter()
    for r in d:total.update(r['counts'])
    out.write_bytes(json.dumps(d).encode());print(len(d),dict(total),[(r['code'],r['level'],r['counts']['hit']) for r in d if r['counts'].get('hit')])
