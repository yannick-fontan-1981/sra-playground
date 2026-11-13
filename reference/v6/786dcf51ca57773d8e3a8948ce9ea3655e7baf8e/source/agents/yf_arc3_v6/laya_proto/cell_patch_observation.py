"""Exact framed cell patches. Geometry is not an interaction or goal law."""
from collections import Counter,defaultdict
from functools import reduce
from math import gcd
from queued_field_observation import measure as queued_measure
from geometric_observer import components
from agents.yf_arc3_v6.morphology_policy.guarded_binding.geometry import revalidate_frame
from terminal_composition import identity

def center(g,point):
    return [g['origin'][i]+point[i]*g['pitch'][i]+(g['size'][i]-1)//2 for i in(0,1)]

def validate_geometry(rows,g):
    x,y=g['origin'];w,h=g['size'];dx,dy=g['pitch'];nx,ny=g['shape'];box=[x-1,y-1,x+(nx-1)*dx+w,y+(ny-1)*dy+h]
    if box[0]<0 or box[1]<0 or box[2]>=len(rows[0])or box[3]>=len(rows):return False
    value=rows[box[1]][box[0]]
    if not revalidate_frame({'bbox':box,'corner_value':value,'palette_value':value},rows):return False
    for v in range(y,box[3]):
        for u in range(x,box[2]):
            if ((u-x)%dx>=w or(v-y)%dy>=h)and rows[v][u]!=value:return False
    return True

def fields(rows,prior=()):
    geometries=[];receipts=[];base=queued_measure(rows)
    if base and validate_geometry(rows,base['geometry']):geometries.append(base['geometry']);receipts.append('queued_field_observation.measure')
    for g in prior:
        if validate_geometry(rows,g)and g not in geometries:geometries.append(g);receipts.append('current_separator_and_perimeter_revalidation')
    parts=components(rows);rectangles=defaultdict(list)
    for p in parts:
        l,t,r,b=p['bbox'];w,h=r-l+1,b-t+1
        if min(w,h)>=2 and p['area']==w*h:rectangles[w,h].append(p)
    # Reuse the repeated-rectangle geometry even when marks interrupt some
    # uniform occurrences or a thin indicator is connected to the outer frame.
    # Every proposed separator and the derived perimeter must still be present.
    for(w,h),cells in rectangles.items():
        xs=sorted({p['bbox'][0]for p in cells});ys=sorted({p['bbox'][1]for p in cells})
        if min(len(xs),len(ys))<2:continue
        dx=reduce(gcd,[z-a for a,z in zip(xs,xs[1:])]);dy=reduce(gcd,[z-a for a,z in zip(ys,ys[1:])])
        if dx<=w or dy<=h:continue
        g={'origin':[xs[0],ys[0]],'shape':[(xs[-1]-xs[0])//dx+1,(ys[-1]-ys[0])//dy+1],'size':[w,h],'pitch':[dx,dy]}
        if validate_geometry(rows,g)and g not in geometries:geometries.append(g);receipts.append('partial_repeated_rectangles_with_current_full_perimeter_and_separators')
    for f in parts:
        l,t,r,b=f['bbox']
        if not revalidate_frame({'bbox':f['bbox'],'corner_value':f['color'],'palette_value':f['color']},rows):continue
        for(w,h),parts_of_size in rectangles.items():
            inside=[p for p in parts_of_size if l<p['bbox'][0]<=p['bbox'][2]<r and t<p['bbox'][1]<=p['bbox'][3]<b];xs=sorted({p['bbox'][0]for p in inside});ys=sorted({p['bbox'][1]for p in inside})
            if min(len(xs),len(ys))<2:continue
            dx=reduce(gcd,[z-a for a,z in zip(xs,xs[1:])]);dy=reduce(gcd,[z-a for a,z in zip(ys,ys[1:])])
            if dx<=w or dy<=h:continue
            x=l+(xs[0]-l)%dx;y=t+(ys[0]-t)%dy
            if(x,y)!=(l+1,t+1):continue
            nx=(r-x-w)//dx+1;ny=(b-y-h)//dy+1
            if min(nx,ny)<2 or x+(nx-1)*dx+w!=r or y+(ny-1)*dy+h!=b:continue
            g={'origin':[x,y],'shape':[nx,ny],'size':[w,h],'pitch':[dx,dy]}
            if validate_geometry(rows,g)and g not in geometries:geometries.append(g);receipts.append('framed_repeated_rectangles_and_exact_separators')
    def contained(a,b):
        if a==b or a['pitch']!=b['pitch']or a['size']!=b['size']:return False
        return all(a['origin'][i]>=b['origin'][i]and(a['origin'][i]-b['origin'][i])%b['pitch'][i]==0 and a['origin'][i]+(a['shape'][i]-1)*a['pitch'][i]<=b['origin'][i]+(b['shape'][i]-1)*b['pitch'][i]for i in(0,1))
    geometries=[g for g in geometries if not any(contained(g,other)for other in geometries)]
    result=[]
    for g in geometries:
        p=project(rows,g)
        if p:p['measurement_receipts']=receipts;result.append(p)
    return sorted(result,key=lambda f:tuple(f['geometry']['origin'][::-1]))

def project(rows,g):
    if not validate_geometry(rows,g):return None
    x,y=g['origin'];w,h=g['size'];dx,dy=g['pitch'];nx,ny=g['shape'];grid=[];uniform=Counter();motifs={}
    for j in range(ny):
        line=[]
        for i in range(nx):
            patch=[row[x+i*dx:x+i*dx+w]for row in rows[y+j*dy:y+j*dy+h]];key=identity(patch);values={v for row in patch for v in row};line.append(key);motifs[key]={'uniform':len(values)==1,'palette':next(iter(values))if len(values)==1 else None,'digest':key}
            if len(values)==1:uniform[key]+=1
        grid.append(line)
    ranked=uniform.most_common();empty=ranked[0][0]if ranked and(len(ranked)==1 or ranked[0][1]>ranked[1][1])else None
    return {'geometry':g,'ref':identity(g),'grid':grid,'empty_hypothesis':empty,'motifs':motifs,'scope':'Exact cell patch identities; uniform majority is an empty-cell hypothesis only. No mark role, dimension, response law or terminal length supplied.'}

def changes(before,after):
    if before['geometry']!=after['geometry']:return None
    return [(x,y,a,after['grid'][y][x])for y,row in enumerate(before['grid'])for x,a in enumerate(row)if a!=after['grid'][y][x]]
