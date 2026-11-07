"""Measured, relocatable uniform-cell rows; no game, coordinate or palette literals."""
from collections import defaultdict
from terminal_composition import identity

def groups(obs):
    rows=defaultdict(list)
    for e in obs['entities']:
        x,y,r,b=e['bbox'];w,h=r-x+1,b-y+1
        if w==h and w>=2 and e['area']==w*h:rows[y,w,h].append((x,e['palette_value']))
    return {key:sorted(cells) for key,cells in rows.items()}

def initial_layout(obs):
    rows=groups(obs);fits=[]
    for (y,w,h),cells in rows.items():
        xs=[x for x,v in cells];values=[v for x,v in cells]
        if len(xs)<3 or len(set(values))!=len(values):continue
        pitch=xs[1]-xs[0]
        if pitch<w or any(b-a!=pitch for a,b in zip(xs,xs[1:])):continue
        slots=[]
        for (other,ww,hh),parts in rows.items():
            if other==y or (ww,hh)!=(w,h) or len(parts)<3:continue
            if [x for x,v in parts]!=xs[:len(parts)] or len(set(v for x,v in parts))!=1:continue
            slots.append({'y':other,'count':len(parts),'empty':parts[0][1]})
        if len(slots)==2 and slots[0]['count']==slots[1]['count']:
            fits.append({'epoch':obs['level_epoch'],'ref':obs['observation_ref'],'size':[w,h],'pitch':pitch,'xs':xs,
                         'palette_y':y,'alphabet':values,'slot_rows':slots,'count':slots[0]['count']})
    return fits[0] if len(fits)==1 else None

def values(rows,layout,y,count=None):
    w,h=layout['size'];out=[]
    for x in layout['xs'][:count or len(layout['xs'])]:
        samples={rows[j][i] for j in range(y,y+h) for i in range(x,x+w)}
        if len(samples)!=1:return None
        out.append(next(iter(samples)))
    return out

def palette(obs,layout):
    parts=groups(obs).get((layout['palette_y'],*layout['size']),[])
    if any(v not in layout['alphabet'] for x,v in parts) or len({v for x,v in parts})!=len(parts):return None
    if [x for x,v in parts]!=layout['xs'][:len(parts)]:return None
    return parts

def border(rows,x,y,w,h):
    # Horizontal ownership avoids the shared side borders of adjacent cells.
    if y<1:return None
    return tuple(rows[y-1][x:x+w])

def mark(rows,x,y,w,h):
    style=border(rows,x,y,w,h)
    return 'style:'+identity(style)[:16] if style and len(set(style))==1 else None

def snapshot_signature(rows,layout):
    w,h=layout['size'];regions=[]
    for y in [layout['palette_y'],*[s['y'] for s in layout['slot_rows']]]:
        regions.extend(tuple(rows[j][max(0,layout['xs'][0]-1):layout['xs'][-1]+w+1]) for j in range(max(0,y-1),y+h+1))
    return identity(regions)

def feedback(rows,obs,layout,trial):
    matches=[];w,h=layout['size']
    excluded={layout['palette_y'],*[s['y'] for s in layout['slot_rows']]}
    for (y,ww,hh),cells in groups(obs).items():
        if y in excluded or (ww,hh)!=(w,h):continue
        by_x=dict(cells)
        if [by_x.get(x) for x in layout['xs'][:len(trial)]]!=trial:continue
        marks=[mark(rows,x,y,w,h) for x in layout['xs'][:len(trial)]]
        if None not in marks:matches.append({'y':y,'values':trial,'marks':marks})
    return matches
