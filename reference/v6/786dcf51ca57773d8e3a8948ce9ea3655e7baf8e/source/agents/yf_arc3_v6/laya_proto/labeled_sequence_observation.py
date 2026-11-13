"""Geometric labeled panels and scale-normalized ordered token occurrences."""
from collections import defaultdict
from geometric_observer import components
from terminal_composition import identity
from agents.yf_arc3_v6.morphology_policy.guarded_binding.geometry import revalidate_frame

def inside(a,b):return b[0]<a[0]<=a[2]<b[2]and b[1]<a[1]<=a[3]<b[3]

def sequences(frame,solids):
    groups=defaultdict(list)
    for c in solids:
        l,t,r,b=c['bbox'];w,h=r-l+1,b-t+1
        if w==h and w>1 and inside(c['bbox'],frame):groups[w].append(c)
    if not groups:return None
    scale=max(groups);byrow=defaultdict(list)
    for c in groups[scale]:byrow[c['bbox'][1]].append(c)
    words=[];pitches=set()
    for y,items in sorted(byrow.items()):
        items=sorted(items,key=lambda c:c['bbox'][0]);d=[b['bbox'][0]-a['bbox'][0]for a,b in zip(items,items[1:])]
        if len(set(d))>1 or any(x<=scale for x in d):return None
        pitches.update(d);words.append({'values':[c['color']for c in items],'boxes':[c['bbox']for c in items]})
    if len(pitches)>1:return None
    return {'scale':scale,'words':words,'pitch':next(iter(pitches),None)}

def measure(rows,prior_controls=None):
    cs=components(rows);solids=[];frames=[]
    for c in cs:
        l,t,r,b=c['bbox'];w,h=r-l+1,b-t+1
        if c['area']==w*h:solids.append(c)
        if w<3 or h<3:continue
        edge={rows[y][x]for y in range(t,b+1)for x in range(l,r+1)if y in(t,b)or x in(l,r)}
        if len(edge)==1:frames.append({'bbox':c['bbox'],'label':next(iter(edge))})
    panels=[]
    for f in frames:
        value=sequences(f['bbox'],solids)
        if value and len(value['words'])>=2:panels.append({**f,**value})
    pairs=[]
    for i,a in enumerate(panels):
        for b in panels[i+1:]:
            ab,bb=a['bbox'],b['bbox'];same=(ab[2]-ab[0],ab[3]-ab[1])==(bb[2]-bb[0],bb[3]-bb[1]);apart=ab[2]<bb[0]or bb[2]<ab[0]
            if same and apart and a['label']!=b['label']and a['scale']==b['scale']:pairs.append(sorted([a,b],key=lambda p:p['bbox'][0]))
    if len(pairs)!=1:return None
    panels=pairs[0];palette=set(v for p in panels for w in p['words']for v in w['values'])
    if any(p['label']in palette for p in panels):return None
    queries=[]
    for f in frames:
        if any(f['bbox']==p['bbox']or inside(f['bbox'],p['bbox'])for p in panels):continue
        value=sequences(f['bbox'],solids)
        if value and len(value['words'])==1 and set(value['words'][0]['values'])<=palette:queries.append({**f,**value})
    queries=[q for q in queries if not any(z is not q and inside(z['bbox'],q['bbox'])and z['words']==q['words']for z in queries)]
    if len(queries)!=1:return None
    buttons=[]
    for panel in panels:
        found=[c for c in solids if c['color']==panel['label']and not any(inside(c['bbox'],p['bbox'])for p in panels)]
        if len(found)!=1 and prior_controls:
            prior=[p for p in prior_controls if p['label']==panel['label']]
            found=[]
            for p in prior:
                frame={'bbox':p['bbox'],'palette_value':p['label'],'corner_value':p['label']};valid=revalidate_frame(frame,rows)
                if not valid:continue
                l,t,r,b=p['bbox']
                if all(rows[y][x]==p['label']for y in range(t,b+1)for x in range(l,r+1)):found.append({'bbox':p['bbox'],'color':p['label']})
        if len(found)!=1:return None
        l,t,r,b=found[0]['bbox'];buttons.append({'label':panel['label'],'bbox':[l,t,r,b],'point':[(l+r)//2,(t+b)//2]})
    scene={'panels':panels,'query':queries[0],'buttons':buttons,'palette':sorted(palette)}
    scene['context_ref']=identity([panels,buttons]);return scene
