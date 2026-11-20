"""Choose an intervention and a subsequent probe stance independently.
Translate a previously measured subject/indicator layout with a proposed movable part;
intermediate positions of the indicator may be hidden. All candidates use prefix evidence.
"""
from collections import Counter,defaultdict,deque
from pathlib import Path
import json,sys

def add(a,b):return a[0]+b[0],a[1]+b[1]
def sub(a,b):return a[0]-b[0],a[1]-b[1]

def groups(rows):
    g=defaultdict(set)
    for z in rows:g[z[1]].add(tuple(z[2:4]))
    return dict(g)

def route(start,end,blocked,motors,known,limit):
    if start==end:return []
    queue=deque([(start,[])]);seen={start}
    ordered=sorted(motors.items(),key=lambda row:-row[1][1])
    while queue:
        u,path=queue.popleft()
        if len(path)>=limit:continue
        for op,(d,n) in ordered:
            v=add(u,d)
            if v in seen or v in blocked or min(v)<0:continue
            if v!=end and v not in known:continue
            step=path+[(op,v)]
            if v==end:return step
            seen.add(v);queue.append((v,step))
    return None


def study(run):
    gs={k:groups(v) for k,v in run['frames'].items()}
    positions={k:{f:next(iter(s)) for f,s in g.items() if len(s)==1} for k,g in gs.items()}
    actions=defaultdict(lambda:defaultdict(lambda:defaultdict(dict)));readouts=defaultdict(list);observed=set()
    visited=defaultdict(set);pushes=set();pool={}
    for i,(root,command,to,_) in enumerate(run['steps']):
        b=positions[root];g=gs[root]
        for p,rows in readouts.items():
            if p not in b:continue
            u=b[p];motors={}
            for op,ds in actions[p].items():
                choices=sorted(ds.items(),key=lambda row:len(row[1]),reverse=True)
                if len(choices)==1 or len(choices[0][1])>len(choices[1][1]):
                    motors[op]=(choices[0][0],len(choices[0][1]))
            for a,(d,strength) in motors.items():
                anchor=add(u,d)
                for c,cs in g.items():
                    if c==p or anchor not in cs:continue
                    for n in (1,2,3):
                        shift=(n*d[0],n*d[1]);placed=add(anchor,shift)
                        if min(placed)<0 or any(add(anchor,(k*d[0],k*d[1])) in cs for k in range(1,n+1)):continue
                        if (root,a) in observed and not any(actor==p and part==c for actor,part,_ in pushes):continue
                        written=add(u,shift)
                        for sample,old_centre in ((row,old) for row in rows for old in gs[row[-1]].get(c,()) if row[2]!=c or old==row[4]):
                            ref,q,r,x,y,fr=sample
                            if old_centre==x or (r!=c and old_centre==y):continue
                            # The earlier experiment is expressed in local coordinates of its own centre.
                            # Write the new layout, then independently solve for the stance that reads it.
                            launch,arrival=add(placed,sub(x,old_centre)),add(placed,sub(y,old_centre))
                            if min((*launch,*arrival))<0 or arrival==launch or (r!=c and arrival==placed) or launch in cs-{anchor} or arrival in cs-{anchor}:continue
                            # Additional contacts must not be silently used as a positioning step.
                            path=route(written,launch,(cs-{anchor})|{placed},motors,visited[p],8)
                            if path is None:continue
                            novel=arrival not in visited[p]
                            new_effect=all(other[4]!=arrival for other in rows if other[1:3]==(q,r))
                            if not new_effect:continue
                            who=(p,r,c,a,q,anchor,placed,launch,arrival)
                            steps=[dict(op=a,p=add(u,(k*d[0],k*d[1])),c=add(anchor,(k*d[0],k*d[1])),kind='contact') for k in range(1,n+1)]
                            steps.extend(dict(op=op,p=pt,c=placed,kind='position') for op,pt in path)
                            known=any(actor==p and part==c for actor,part,_ in pushes)
                            rank=(known,novel,r!=c,(p,c,a) in pushes,n==1,strength,-len(path),-n)
                            if who in pool and pool[who][0]>=rank:continue
                            pool[who]=rank,dict(i=i,root=root,p=p,r=r,c=c,fromP=u,fromC=anchor,rest=sorted(cs-{anchor}),
                                first=a,read=q,steps=steps,launch=launch,arrival=arrival,oldLaunch=x,oldArrival=y,oldCentre=old_centre,knownCause=known,distinctCue=r!=c,
                                writeCount=n,newToSubject=novel,previousContact=(p,c,a) in pushes,receipt=ref,priorRoot=fr)
        if not to:break
        if (root,command) in observed:continue
        observed.add((root,command));z=positions[to]
        for p,u in b.items():
            if p not in z or u==z[p]:continue
            v=z[p];d=sub(v,u);actions[p][command][d].setdefault(u,i);visited[p].update([u,v])
            for r,site in b.items():
                if p!=r and v==site:readouts[p].append((i,command,r,u,site,root))
            for c,sites in g.items():
                if p!=c and v in sites and gs[to].get(c)==((sites-{v})|{add(v,d)}) and add(v,d) not in sites:pushes.add((p,c,command))
    by=Counter();selected=[]
    for _,t in sorted(pool.values(),key=lambda x:x[0],reverse=True):
        k=(t['p'],t['r'],t['c'],t['first'],t['read'])
        if by[k]>=4:continue
        by[k]+=1;selected.append(t)
        if len(selected)>=24:break
    return dict(code=run['code'],level=run['level'],possible=len(pool),tickets=selected)

if __name__=='__main__':
    path,out=map(Path,sys.argv[1:]);rs=[study(r) for f in sorted(path.glob('poses20-*.json')) for r in json.loads(f.read_text())];out.write_text(json.dumps(rs),encoding='utf8')
    for lower in (True,False):
        t=[(r['code'],r['level'],v) for r in rs if (r['level']==1)==lower for v in r['tickets']]
        print(lower,len(t),sorted(set((c,l) for c,l,v in t)),sum(v['newToSubject'] for c,l,v in t))
