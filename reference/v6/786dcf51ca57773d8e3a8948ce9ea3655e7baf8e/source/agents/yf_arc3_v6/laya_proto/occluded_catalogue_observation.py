"""Measured catalogue/field hypotheses and explicit unknown pixels; no semantic palette."""
from collections import defaultdict
from geometric_observer import components,framed_patterns
from terminal_composition import identity

def measure(rows):
    parts=components(rows);frames=[]
    for p in parts:
        l,t,r,b=p['bbox'];w,h=r-l+1,b-t+1
        if min(w,h)<3 or min(l,t)==0 or r==len(rows[0])-1 or b==len(rows)-1:continue
        perimeter={(x,y)for x in range(w)for y in range(h)if x in(0,w-1)or y in(0,h-1)}
        if perimeter.issubset(set(map(tuple,p['mask']))):frames.append(p)
    if not frames:return None
    largest=max((p['bbox'][2]-p['bbox'][0])*(p['bbox'][3]-p['bbox'][1])for p in frames);fields=[p for p in frames if(p['bbox'][2]-p['bbox'][0])*(p['bbox'][3]-p['bbox'][1])==largest]
    if len(fields)!=1:return None
    field=fields[0]['bbox'];l,t,r,b=field;field_values={v for row in rows[t+1:b]for v in row[l+1:r]};groups=defaultdict(list)
    for p in framed_patterns(rows,parts):
        x,y,z,v=p['bbox']
        if y<=b or p['color']not in field_values or p['foreground_area']<2:continue
        groups[(y+v,z-x,p['color'])].append(p)
    groups=[sorted(ps,key=lambda p:p['bbox'][0])for ps in groups.values()if len(ps)>=2]
    if not groups:return None
    # Keep only the outer card row for each foreground palette, not its inner holes.
    spans=[(max(p['bbox'][2]for p in ps)-min(p['bbox'][0]for p in ps),ps)for ps in groups];maximum=max(s for s,p in spans);choices=[ps for s,ps in spans if s==maximum]
    if len(choices)!=1:return None
    cards=choices[0];palette=cards[0]['color'];raw=[]
    for p in cards:
        x,y,z,v=p['bbox'];pixels={(a,c)for c in range(y+1,v)for a in range(x+1,z)if rows[c][a]==palette}
        if not pixels:return None
        xmin=min(a for a,c in pixels);xmax=max(a for a,c in pixels);ymin=min(c for a,c in pixels);ymax=max(c for a,c in pixels)
        raw.append({'bbox':p['bbox'],'point':p['center'],'mask':sorted([a-xmin,c-ymin]for a,c in pixels),'extent':[xmax-xmin+1,ymax-ymin+1]})
    if len({tuple(p['extent'])for p in raw})!=1:return None
    controls=[{'palette':p['color'],'bbox':p['bbox'],'point':[(p['bbox'][0]+p['bbox'][2])//2,(p['bbox'][1]+p['bbox'][3])//2]}for p in parts if p['rectangular']and p['bbox'][3]<t and p['color']in field_values and min(p['bbox'][2]-p['bbox'][0]+1,p['bbox'][3]-p['bbox'][1]+1)>=2]
    if len(controls)<2 or sum(p['palette']==palette for p in controls)!=1:return None
    if len({(p['bbox'][1],p['bbox'][3])for p in controls})!=1:return None
    return {'field':field,'palette':palette,'cards':raw,'controls':controls,'geometry_ref':identity([field,[(p['bbox'],p['extent'])for p in raw],[p['bbox']for p in controls]]),'scope':'Largest enclosed field, aligned lower catalogue and upper same-palette selectors are structural hypotheses; equal native catalogue extents required.'}

def fit(rows,scene,backgrounds):
    """Exhaustive finite pose/scale prefilter using measured positives and scoped negatives."""
    l,t,r,b=scene['field'];color=scene['palette'];present={(x,y)for y in range(t+1,b)for x in range(l+1,r)if rows[y][x]==color};absent={(x,y)for y in range(t+1,b)for x in range(l+1,r)if rows[y][x]in backgrounds}
    if not present:return []
    minx=min(x for x,y in present);maxx=max(x for x,y in present);miny=min(y for x,y in present);maxy=max(y for x,y in present);result=[]
    for index,card in enumerate(scene['cards']):
        w,h=card['extent']
        for scale in range(1,min((r-l-1)//w,(b-t-1)//h)+1):
            expanded={(x*scale+dx,y*scale+dy)for x,y in card['mask']for dx in range(scale)for dy in range(scale)}
            for x in range(max(l+1,maxx-w*scale+1),min(minx,r-w*scale)+1):
                for y in range(max(t+1,maxy-h*scale+1),min(miny,b-h*scale)+1):
                    shifted={(x+a,y+c)for a,c in expanded}
                    if present<=shifted and not shifted&absent:result.append({'candidate':index,'scale':scale,'translation':[x,y]})
    return result

def exposed_values(before,after,scene):
    l,t,r,b=scene['field'];color=scene['palette']
    departed={after[y][x]for y in range(t+1,b)for x in range(l+1,r)if before[y][x]==color and after[y][x]!=color}
    entered={before[y][x]for y in range(t+1,b)for x in range(l+1,r)if after[y][x]==color and before[y][x]!=color}
    # A unique reciprocal replacement value is evidence for an open-substrate hypothesis.
    return sorted(departed)if len(departed)==1 and departed==entered else []
