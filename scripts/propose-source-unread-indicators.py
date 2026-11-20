"""Register controllable subjects and newly visible similar footprints from the original source traces."""
from collections import Counter,defaultdict
from pathlib import Path
import json,sys

def view(rows):
    counts=Counter(x[1] for x in rows)
    return {x[1]:x for x in rows if counts[x[1]]==1}
def at(v): return tuple(v[2:4])
def delta(a,b):return a[0]-b[0],a[1]-b[1]
def study(r,excluded):
    frames={h:view(rows) for h,rows in r['frames'].items()}
    motors=defaultdict(lambda:defaultdict(set));edges=[];tried=set();already=set();proposals=[]
    for i,(root,q,after,terminal) in enumerate(r['steps']):
        scene=frames[root]
        if edges:
            last=frames[edges[-1][0]]
            for p,actor in scene.items():
                if p not in last or p not in motors:continue
                for mark,glyph in scene.items():
                    if mark==p or at(actor)==at(glyph) or (root,p,mark) in excluded:continue
                    if sorted(actor[5:7])!=sorted(glyph[5:7]) or abs(actor[4]-glyph[4])>max(1,min(actor[4],glyph[4])//4):continue
                    if mark in last and (at(glyph)==at(last[mark]) or delta(at(glyph),at(last[mark]))==delta(at(actor),at(last[p]))):continue
                    if (p,mark) in already:continue
                    independent=[(f,c,t) for f,c,t in edges if mark not in frames[f] and p in frames[f] and p in frames[t] and at(frames[f][p])!=at(frames[t][p])]
                    if not independent:continue
                    key=(p,mark,at(actor),at(glyph))
                    if any(t['key']==key for t in proposals):continue
                    # A demonstrated ordinary stroke provides a rival explanation for this particular destination.
                    ordinary=any(delta(at(glyph),at(actor)) in ds for ds in motors[p].values())
                    proposals.append(dict(key=key,i=i,root=root,p=p,r=mark,origin=at(actor),site=at(glyph),ordinary=ordinary,independent=len(independent)))
        if terminal or after not in frames:continue
        nxt=frames[after]
        for p,a in scene.items():
            if p not in nxt or at(nxt[p])==at(a):continue
            motors[p][q].add(delta(at(nxt[p]),at(a)))
            for mark,b in scene.items():
                if mark!=p and at(b)==at(nxt[p]):already.add((p,mark))
        edges.append((root,q,after));tried.add((root,q))
    # Keep new public configurations; cap repeated appearances of the same candidate relation.
    unique=Counter();jobs=[]
    for t in sorted(proposals,key=lambda t:(t['ordinary'],t['i'])):
        k=t['p'],t['r']
        if unique[k]>=2:continue
        unique[k]+=1;t.pop('key');jobs.append(t)
        if len(jobs)==6:break
    return dict(code=r['code'],level=r['level'],tickets=jobs)
if __name__=='__main__':
    directory,out=map(Path,sys.argv[1:])
    excl={(r['code'],r['level']):{(t['root'],t['p'],t['r']) for t in r['tickets']} for r in json.loads((directory/'emerging22-questions.json').read_text())}
    data=[study(r,excl.get((r['code'],r['level']),set())) for f in sorted(directory.glob('poses20-*.json')) for r in json.loads(f.read_text())]
    out.write_bytes(json.dumps(data).encode());print(len(data),sum(bool(r['tickets']) for r in data),sum(len(r['tickets']) for r in data))
