"""Find third-subject transfers in indexed public poses, independently of colours or game names."""
import argparse
import json
from collections import defaultdict
from pathlib import Path


def touching(a,b,stride):
    dx,dy=abs(a[2]-b[2]),abs(a[3]-b[3])
    # The stored centres and strides are doubled; widths and heights are pixels.
    return ((dx>=a[5]+b[5] and dx<=1.5*stride and dy<a[6]+b[6]) or
            (dy>=a[6]+b[6] and dy<=1.5*stride and dx<a[5]+b[5]))


def episode(run,role,local=False):
    def group(rows):
        out=defaultdict(dict)
        for part in rows:
            out[part[role]][tuple(part[2:4])]=part
        return out
    scenes={h:group(rows) for h,rows in run['frames'].items()}
    ids={};serial=0
    def fresh():
        nonlocal serial
        serial+=1
        return serial
    support=defaultdict(set); current={}; examples=[]; proposals={};strides=defaultdict(set)
    matched_copies=0
    for i,(h,act,z,terminal) in enumerate(run['steps']):
        if terminal or z not in scenes:
            break
        past,now=scenes[h],scenes[z]
        if not ids:
            ids={(kind,at):fresh() for kind,parts in past.items() for at in parts}
        following={};positions={};vectors={}
        for kind in past.keys()|now.keys():
            old,new=past.get(kind,{}),now.get(kind,{})
            lost=old.keys()-new.keys();entered=new.keys()-old.keys()
            for at in old.keys()&new.keys():
                ident=ids[kind,at];following[kind,at]=ident;positions[ident]=old[at];vectors[ident]=(0,0)
            if len(lost)==len(entered)==1:
                a,b=next(iter(lost)),next(iter(entered));d=(b[0]-a[0],b[1]-a[1])
                stride=abs(d[0])+abs(d[1])
                if (bool(d[0])!=bool(d[1])) and stride<=8*max(old[a][5:7]):
                    ident=ids[kind,a];following[kind,b]=ident;positions[ident]=old[a];vectors[ident]=d
                    strides[kind].add(stride)
            elif local and lost and entered and strides[kind]:
                candidates={a:[b for b in entered if (a[0]==b[0])!=(a[1]==b[1]) and
                               abs(a[0]-b[0])+abs(a[1]-b[1]) in strides[kind]] for a in lost}
                for a,ends in candidates.items():
                    if len(ends)!=1 or sum(ends[0] in others for others in candidates.values())!=1:
                        continue
                    b=ends[0]
                    ident=ids[kind,a];following[kind,b]=ident;positions[ident]=old[a]
                    vectors[ident]=(b[0]-a[0],b[1]-a[1]);matched_copies+=1
            for at in entered:
                if (kind,at) not in following:
                    following[kind,at]=fresh()
        ids=following
        for cargo,e in list(proposals.items()):
            owner=e['newOwner']
            if cargo not in vectors or owner not in vectors:
                del proposals[cargo]; continue
            if vectors[cargo]!=(0,0) or vectors[owner]!=(0,0):
                e['nextMovingResponse']=dict(step=i+1,command=act,matched=vectors[cargo]==vectors[owner])
                del proposals[cargo]
        moving=[q for q,d in vectors.items() if d!=(0,0)]
        for cargo in moving:
            d=vectors[cargo];stride=abs(d[0])+abs(d[1])
            partners=[a for a in moving if a!=cargo and vectors[a]==d and touching(positions[a],positions[cargo],stride)]
            # Moving clusters do not identify which neighbour carries the piece.
            if local and len(partners)>1:
                # A decorated moving body may contribute both an outline and
                # an interior component. Keep it only when all centres coincide.
                centres={tuple(positions[p][2:4]) for p in partners}
                if len(centres)==1:
                    partners=[max(partners,key=lambda p:positions[p][4])]
            if len(partners)!=1:
                continue
            owner=partners[0]
            poses=support[cargo,owner]
            poses.add(tuple(positions[cargo][2:4]))
            if len(poses)<2:
                continue
            previous=current.get(cargo)
            if previous and previous!=owner and previous in vectors and vectors[previous]!=d:
                e=dict(step=i+1,command=act,cargo=cargo,oldOwner=previous,newOwner=owner,
                       oldSites=len(support[cargo,previous]),newSites=len(poses),oldStayed=vectors[previous]==(0,0))
                examples.append(e);proposals[cargo]=e
            current[cargo]=owner
    return dict(code=run['code'],level=run['level'],matchedCopies=matched_copies,transfers=examples)


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('directory',type=Path);p.add_argument('output',type=Path)
    p.add_argument('--extra',type=Path,nargs='*',default=[])
    args=p.parse_args()
    rows=[r for f in [*sorted(args.directory.glob('poses20-*.json')),*args.extra] for r in json.loads(f.read_bytes())]
    assert len({(r['code'],r['level']) for r in rows})==len(rows)
    data={name:[episode(r,index,local) for r in rows] for name,index,local in
          [('exact',0,False),('shapeFamily',1,False),('localExact',0,True),('localFamily',1,True)]}
    args.output.write_text(json.dumps(data),encoding='utf8')
    for name,entries in data.items():
        print(name,len(entries),sum(len(r['transfers']) for r in entries),sum(bool(r['transfers']) for r in entries))


if __name__=='__main__':
    main()
