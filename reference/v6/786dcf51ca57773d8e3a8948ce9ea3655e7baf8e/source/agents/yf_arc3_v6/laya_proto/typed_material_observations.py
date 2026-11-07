"""Public typed-substructure continuity and framed requests; no fixed palette."""
from collections import Counter,defaultdict
from geometric_observer import components
from terminal_composition import identity

def descendants(context,before,later,obs):
    sources=context.get('removed',[])
    if not sources:return []
    background=Counter(v for row in later for v in row).most_common(1)[0][0]
    radius=int(max(abs(a) for c in sources for _,dx,dy in c['marks'] for a in (dx,dy)));found=[]
    for source in sources:
        hits=[];typed={m[0] for m in source['marks']}
        for y in range(radius,len(later)-radius):
            for x in range(radius,len(later[0])-radius):
                if not all(later[int(y+dy)][int(x+dx)]==v for v,dx,dy in source['marks']):continue
                box=[x-radius,y-radius,x+radius,y+radius]
                if not any(before[v][u]!=later[v][u] for v in range(box[1],box[3]+1) for u in range(box[0],box[2]+1)):continue
                material=[(u,v,later[v][u]) for v in range(box[1],box[3]+1) for u in range(box[0],box[2]+1) if later[v][u] not in typed|{background}]
                colors={p[2] for p in material}
                if len(colors)!=1:continue
                point=min(([u,v]for u,v,_ in material),key=lambda p:((p[0]-x)**2+(p[1]-y)**2,p));hits.append({'id':identity([obs['observation_ref'],box,source['signature']]),'bbox':box,'center':[x,y],'point':point,'marks':source['marks'],'core_signature':source['signature'],'body_palette':next(iter(colors)),'source_ref':obs['observation_ref'],'source_occurrence':source['id']})
        if not hits:return []
        found.extend(hits)
    grouped={}
    for c in found:grouped.setdefault(tuple(c['center']),[]).append(c)
    occurrences=[]
    for matches in grouped.values():
        signatures=sorted({c['core_signature']for c in matches});patterns={identity(c['marks'])for c in matches}
        if len(patterns)!=1:return []
        c=dict(matches[0]);origins=sorted({q['source_occurrence']for q in matches});c['compatible_source_occurrences']=origins;c['source_occurrence']=origins[0]if len(origins)==1 else None;c['lineage_status']='unique_observed_match'if len(origins)==1 else'ambiguous_observed_matches_preserved'
        if len(signatures)>1:c['core_signature']=identity(['ambiguous_source_core_extents',signatures])
        occurrences.append(c)
    return occurrences

def requests(rows,obs,known_shapes=()):
    background=Counter(v for row in rows for v in row).most_common(1)[0][0];found=[]
    for p in components(rows):
        x,y,r,b=p['bbox'];w,h=r-x+1,b-y+1
        if not(5<=w<=len(rows[0])/4 and 5<=h<=len(rows)/4):continue
        border={(u,v)for v in range(h)for u in range(w)if u in (0,w-1)or v in(0,h-1)}
        if p['mask']!=border:continue
        inner=[(u,v,rows[v][u])for v in range(y+1,b)for u in range(x+1,r)];values={a for _,_,a in inner}
        if background not in values or len(values-{background})!=1:continue
        pigment=next(iter(values-{background}));pixels=[(u,v)for u,v,a in inner if a==pigment]
        if not pixels:continue
        left=min(u for u,v in pixels);top=min(v for u,v in pixels);right=max(u for u,v in pixels);bottom=max(v for u,v in pixels);mask=sorted([u-left,v-top]for u,v in pixels);descriptor={'palette':pigment,'width':right-left+1,'height':bottom-top+1,'mask':mask};point=min(([u,v]for u,v in pixels),key=lambda q:((q[0]-(x+r)/2)**2+(q[1]-(y+b)/2)**2,q));found.append({'id':identity([obs['level_epoch'],p['bbox']]),'bbox':p['bbox'],'point':point,'descriptor':descriptor,'source_ref':obs['observation_ref']})
    groups=Counter((q['bbox'][2]-q['bbox'][0],q['bbox'][3]-q['bbox'][1])for q in found)
    return [q for q in found if groups[(q['bbox'][2]-q['bbox'][0],q['bbox'][3]-q['bbox'][1])]>=2 or (q['bbox'][2]-q['bbox'][0],q['bbox'][3]-q['bbox'][1]) in known_shapes]

def child_present(child,rows):
    x,y=child['center']
    return all(0<=int(y+dy)<len(rows) and 0<=int(x+dx)<len(rows[0]) and rows[int(y+dy)][int(x+dx)]==v for v,dx,dy in child['marks'])

def local_child_mark(child,first,later):
    x,y,r,b=child['bbox'];margin=max(r-x+1,b-y+1);changed=[(u,v)for v,row in enumerate(first)for u,a in enumerate(row)if a!=later[v][u]]
    return bool(changed and child_present(child,later) and all(x-margin<=u<=r+margin and y-margin<=v<=b+margin and not(x<=u<=r and y<=v<=b)for u,v in changed))
