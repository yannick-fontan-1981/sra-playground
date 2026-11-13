"""Persistent public fields and pixel-band extents, never liquid units."""
from collections import Counter
from geometric_observer import components
from common_band_transfer import quantities
from terminal_composition import identity
def groups(before,after):
    pending={(x,y)for y,row in enumerate(before)for x,v in enumerate(row)if v!=after[y][x]};found=[]
    while pending:
        seed=min(pending);pending.remove(seed);stack=[seed];points=[];pair=(before[seed[1]][seed[0]],after[seed[1]][seed[0]])
        while stack:
            x,y=stack.pop();points.append((x,y))
            for u,v in((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if(u,v)in pending and(before[v][u],after[v][u])==pair:pending.remove((u,v));stack.append((u,v))
        l,t=min(x for x,y in points),min(y for x,y in points);r,b=max(x for x,y in points),max(y for x,y in points)
        if len(points)==(r-l+1)*(b-t+1)and len(points)>=4:found.append({'bbox':[l,t,r,b],'area':len(points),'palette_pair':list(pair)})
    return found
def field_state(rows,field):
    l,t,r,b=field['bbox'];crop=[row[l:r+1]for row in rows[t:b+1]];axis=field['axis'];cross=len(crop)if axis==0 else len(crop[0]);end=(len(crop[0])-1 if axis==0 else len(crop)-1)if field['side']==0 else 0;lengths=[]
    for k in range(cross):
        values=quantities(crop,{'axis':axis,'probes':[[k]],'side':field['side'],'end':end,'fill':field['fill_palette']});lengths.append(values[0])
    observed=set(v for row in crop for v in row);known={field['fill_palette'],field['alternative_fill_palette']}|set(field.get('initial_other_palettes',[]));opaque=not observed<=known
    return {'pixel_extent_interval':[min(lengths),max(lengths)]if not opaque else[0,None],'pixel_extent_profiles':lengths if not opaque else None,'appearance_digest':identity(crop),'opaque_replacement':opaque,'physical_quantity_interval':[0,None],'capacity':None,'calibration':'unknown','envelope_complete':False}
def acquire_fields(before,after,refs):
    changes=groups(before,after);parts=components(before);pair_counts=Counter(tuple(g['palette_pair'])for g in changes);fields=[]
    for g in changes:
        l,t,r,b=g['bbox'];old,new=g['palette_pair'];possible=[]
        for p in parts:
            x,y,X,Y=p['bbox'];w,h=X-x+1,Y-y+1
            if p['color']!=old or not(x<=l<=r<=X and y<=t<=b<=Y)or p['area']<g['area']or max(w,h)>max(len(before),len(before[0]))/2:continue
            axes=[]
            if h==b-t+1 and w>r-l+1 and(l==x or r==X):axes.append((0,1 if l==x else 0))
            if w==r-l+1 and h>b-t+1 and(t==y or b==Y):axes.append((1,1 if t==y else 0))
            for axis,side in axes:possible.append((w*h,p,axis,side))
        if not possible:continue
        _,part,axis,side=min(possible,key=lambda x:x[0]);repeated=pair_counts[old,new]>1
        field={'id':identity([part['bbox'],refs]),'bbox':part['bbox'],'axis':axis,'side':side if repeated else 1-side,'fill_palette':new if repeated else old,'alternative_fill_palette':old if repeated else new,'polarity_hypothesis':'repeated_new_content'if repeated else'single_old_content','evidence':refs,'scope':'Observed persistent support and contiguous pixel extent. Color polarity is provisional; no units, capacity or flow law supplied.'}
        x,y,X,Y=field['bbox'];field['initial_other_palettes']=sorted({before[v][u]for v in range(y,Y+1)for u in range(x,X+1)}-{old,new})
        field['initial_state']=field_state(before,field);field['observed_state']=field_state(after,field);fields.append(field)
    return fields
def state(rows,fields):return {f['id']:field_state(rows,f)for f in fields}
def directions(old,new):
    out={}
    for ref,a in old.items():
        aa=a['pixel_extent_profiles'];bb=new[ref]['pixel_extent_profiles']
        if aa is None or bb is None:out[ref]=None;continue
        d=[y-x for x,y in zip(aa,bb)]
        out[ref]=1 if all(v>=0 for v in d)and any(v>0 for v in d)else -1 if all(v<=0 for v in d)and any(v<0 for v in d)else 0 if not any(d)else None
    return out
