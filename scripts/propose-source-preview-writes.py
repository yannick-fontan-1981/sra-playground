"""Register A, Q and the indicated future arrival using only information available before A."""
from collections import Counter,defaultdict
from pathlib import Path
import json,sys

def unique(rows):
    counts=Counter(row[1] for row in rows)
    return {row[1]:tuple(row[2:4]) for row in rows if counts[row[1]]==1}

def proposals(run):
    frames={h:unique(rows) for h,rows in run['frames'].items()}
    read=defaultdict(list);writes=defaultdict(lambda:defaultdict(dict));tried=set();selected={};seen=defaultdict(set)
    def difference(a,b):return a[0]-b[0],a[1]-b[1]
    for i,(root,q,after,terminal) in enumerate(run['steps']):
        b=frames[root]
        for (p,r,trigger),examples in read.items():
            if p not in b or r not in b or b[p]==b[r]:continue
            for a,deltas in writes.get((p,r),{}).items():
                if a==trigger or len(deltas)!=1 or (root,a) in tried:continue
                delta,ref=next(iter(deltas.items()))
                if delta==(0,0):continue
                prediction=(b[r][0]+delta[0],b[r][1]+delta[1])
                if prediction==b[p] or min(prediction)<0 or max(prediction)>126:continue
                rank=(any(x[1]==b[p] for x in examples),prediction not in seen[p],len({x[2] for x in examples})>1)
                key=p,r,a,trigger,b[p],prediction
                if key not in selected or rank>selected[key][0]:
                    witness=next((x for x in examples if x[1]==b[p]),examples[0])
                    selected[key]=rank,dict(i=i,root=root,p=p,r=r,origin=b[p],oldMark=b[r],imagined=prediction,a=a,q=trigger,writeRef=ref,readRef=witness[0],readOrigin=witness[1],readMark=witness[2])
        tried.add((root,q))
        if terminal or after not in frames or q.startswith('ACTION6:'):continue
        z=frames[after]
        for p,x in b.items():
            if p not in z:continue
            seen[p].update((x,z[p]))
            if x!=z[p]:
                for r,y in b.items():
                    if p!=r and y==z[p]:
                        read[p,r,q].append((i,x,y))
            else:
                for r,y in b.items():
                    if r!=p and r in z:
                        writes[p,r][q].setdefault(difference(z[r],y),i)
    out=[];budget=Counter()
    for _,t in sorted(selected.values(),key=lambda v:v[0],reverse=True):
        k=t['p'],t['r'],t['a'],t['q']
        if budget[k]>=2:continue
        out.append(t);budget[k]+=1
        if len(out)>=6:break
    return {'code':run['code'],'level':run['level'],'tickets':out}
if __name__=='__main__':
    directory,out=map(Path,sys.argv[1:]);data=[proposals(r) for f in sorted(directory.glob('poses20-*.json')) for r in json.loads(f.read_text())]
    out.write_bytes(json.dumps(data).encode());print(len(data),sum(len(r['tickets']) for r in data))
