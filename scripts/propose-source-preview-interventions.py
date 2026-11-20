"""Project a visible relation when its fixed point may be a movable part.
An input step may drive the subject alone or carry the candidate centre by contact.
"""
import json,sys
from collections import Counter,defaultdict
from pathlib import Path

def add(a,b):return a[0]+b[0],a[1]+b[1]
def sub(a,b):return a[0]-b[0],a[1]-b[1]
def mapping(p,c,t):
    x,y=sub(p,c)
    return add(c,((-x,y),(x,-y),(-x,-y),(y,x),(-y,x),(y,-x),(-y,-x))[t])

def scene(rows):
    by=defaultdict(set)
    for r in rows:by[r[1]].add(tuple(r[2:4]))
    return by

def unique(data):return {k:next(iter(g)) for k,g in data.items() if len(g)==1}

def study(run):
    groups={f:scene(es) for f,es in run['frames'].items()}
    positions={f:unique(es) for f,es in groups.items()}
    samples=defaultdict(set);moves=defaultdict(lambda:defaultdict(dict));coupled=defaultdict(set);hit=defaultdict(Counter)
    seen=set();pool={};witnessed_pushes=defaultdict(set)
    for i,(root,command,to,_) in enumerate(run['steps']):
        current=positions[root];allgroups=groups[root]
        for p,r in set(hit)|set(coupled):
            if p not in current or r not in current or p==r or current[p]==current[r]:continue
            if not hit[p,r] and len(coupled[p,r])<2:continue
            u,v=current[p],current[r]
            earlier=samples[p,r]
            if len({positions[f][p] for f in earlier})<2:continue
            q=hit[p,r].most_common(1)[0][0] if hit[p,r] else None
            for c,sites in allgroups.items():
                if c in (p,r):continue
                for anchor in sites:
                    if anchor in (u,v):continue
                    transforms=[t for t in range(7) if mapping(u,anchor,t)==v]
                    if not transforms:continue
                    # Only pair observations where a candidate from the same family actually occupied this point.
                    prior=[(positions[f][p],positions[f][r]) for f in earlier if anchor in groups[f].get(c,())]
                    if len(set(prior))<2:continue
                    for t in transforms:
                        supported=[(x,y) for x,y in set(prior) if mapping(x,anchor,t)==y]
                        if len(supported)<2 or 4*len(supported)<3*len(set(prior)) or len({sub(y,x) for x,y in supported})<2:continue
                        for (actor,a),options in moves.items():
                            if actor!=p or a==q or (root,a) in seen:continue
                            ranked=sorted(options.items(),key=lambda x:len(x[1]),reverse=True)
                            d,examples=ranked[0]
                            if len(ranked)>1 and len(ranked[1][1])==len(examples):continue
                            end=add(u,d);contact=end==anchor
                            # A moving centre can be tested as a hypothesis before any motion of that part.
                            centre=add(anchor,d) if contact else anchor
                            pred=mapping(end,centre,t)
                            if min((*end,*centre,*pred))<0 or pred in (end,v) or (not contact and pred==add(v,d)):continue
                            fresh=pred not in {y for x,y in supported}
                            if not fresh:continue
                            origin=(p,r,c,a,u,anchor,target_key(pred),contact)
                            row=dict(i=i,root=root,p=p,r=r,c=c,before=[u,v,anchor],rest=sorted(sites-{anchor}),
                                     a=a,q=q,after=[end,pred,centre],fixed=mapping(end,anchor,t),mode='contact' if contact else 'stationary',
                                     map=t,support=len(set(supported)),motor=len(examples),previousPush=bool(witnessed_pushes[p,c,a]))
                            rank=(contact,bool(q),bool(witnessed_pushes[p,c,a]),len(supported),len(examples))
                            if origin not in pool or rank>pool[origin][0]:pool[origin]=rank,row
        if not to:break
        for p in current:
            for r in current:
                if p!=r and current[p]!=current[r]:samples[p,r].add(root)
        if (root,command) in seen:continue
        seen.add((root,command));z=positions[to]
        moved=[p for p in current if p in z and z[p]!=current[p]]
        for p in moved:
            d=sub(z[p],current[p]);moves[p,command][d].setdefault(current[p],i)
            for r in current:
                if p!=r and z[p]==current[r]:hit[p,r][command]+=1
            for r in moved:
                if p!=r and sub(z[r],current[r])!=d:coupled[p,r].add(current[p])
            for c,cs in allgroups.items():
                if c!=p and z[p] in cs and groups[to].get(c)==((cs-{z[p]})|{add(z[p],d)}) and add(z[p],d) not in cs:
                    witnessed_pushes[p,c,command].add(root)
    rows=[];counts=Counter()
    for rank,row in sorted(pool.values(),key=lambda x:x[0],reverse=True):
        key=(row['p'],row['r'],row['c'],row['a'],row['mode'])
        if counts[key]>=3:continue
        counts[key]+=1;rows.append(row)
        if len(rows)>=24:break
    return dict(code=run['code'],level=run['level'],total=len(pool),tickets=rows)

def target_key(p):return tuple(p)

if __name__=='__main__':
    p,out=map(Path,sys.argv[1:]);rs=[study(r) for f in sorted(p.glob('poses20-*.json')) for r in json.loads(f.read_text())]
    out.write_text(json.dumps(rs),encoding='utf8')
    for lower in (True,False):
        rows=[(r['code'],r['level'],t) for r in rs if (r['level']==1)==lower for t in r['tickets']]
        print(lower,len(rows),Counter(t['mode'] for c,l,t in rows),sorted(set((c,l) for c,l,t in rows)))
