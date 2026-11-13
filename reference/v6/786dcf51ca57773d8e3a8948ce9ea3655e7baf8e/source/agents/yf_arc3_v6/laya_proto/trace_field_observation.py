"""Repeated cell envelopes, distinguishable marks and an observed connecting trace."""
from collections import defaultdict,Counter
from math import gcd
from functools import reduce
from geometric_observer import components
from terminal_composition import identity

def center(g,cell):return [g['bbox'][0]+g['pitch']*cell[0]+g['pitch']//2,g['bbox'][1]+g['pitch']*cell[1]+g['pitch']//2]
def pair(a,b):return tuple(sorted((tuple(a),tuple(b))))

def measure(rows,geometry=None):
    parts=components(rows);squares=defaultdict(list);frames=[]
    for p in parts:
        l,t,r,b=p['bbox'];w,h=r-l+1,b-t+1
        if w!=h or w<3:continue
        if p['area']==w*h:squares[w].append(p)
        if p['area']==4*(w-1)and all(rows[y][x]==p['color']for y in range(t,b+1)for x in range(l,r+1)if y in(t,b)or x in(l,r)):frames.append(p)
    if geometry is None:
        candidates=[]
        for f in frames:
            l,t,r,b=f['bbox']
            for size,cells in squares.items():
                cells=[p for p in cells if l<p['bbox'][0]<=p['bbox'][2]<r and t<p['bbox'][1]<=p['bbox'][3]<b]
                xs=sorted({p['bbox'][0]for p in cells});ys=sorted({p['bbox'][1]for p in cells})
                if len(cells)<3 or min(len(xs),len(ys))<2:continue
                ds=[b-a for v in (xs,ys)for a,b in zip(v,v[1:])];pitch=reduce(gcd,ds)
                if pitch<=size or (r-l)%pitch or (b-t)%pitch or (r-l)//pitch<2:continue
                margin=(pitch-size)//2
                if any((x-l-1)%pitch for x in xs)or any((y-t-1)%pitch for y in ys):continue
                candidates.append((len(cells)*size*size,{'bbox':f['bbox'],'pitch':pitch,'size':size,'shape':[(r-l)//pitch,(b-t)//pitch],'outer_value':f['color'],'floor_value':Counter(p['color']for p in cells).most_common(1)[0][0]}))
        if not candidates:return None
        best=max(v for v,g in candidates);matched=[g for v,g in candidates if v==best]
        if len(matched)!=1:return None
        geometry=matched[0]
    g=geometry;l,t,r,b=g['bbox'];pitch=g['pitch'];nx,ny=g['shape']
    if r>=len(rows[0])or b>=len(rows)or any(rows[y][x]!=g['outer_value']for y in range(t,b+1)for x in range(l,r+1)if x in(l,r)or y in(t,b)):return None
    marks=[]
    for f in frames:
        a,c,z,d=f['bbox'];w=z-a+1
        if w>=pitch:continue
        point=[(a+z)//2,(c+d)//2];cells=[(i,j)for j in range(ny)for i in range(nx)if center(g,(i,j))==point]
        if len(cells)==1:marks.append({'cell':list(cells[0]),'bbox':f['bbox'],'palette':f['color'],'center_value':rows[point[1]][point[0]],'width':w})
    heads=[m for m in marks if m['center_value']!=g['floor_value']];receivers=[m for m in marks if m['center_value']==g['floor_value']]
    pairs=[(h,r)for h in heads for r in receivers if h['width']==r['width']]
    if len(pairs)!=1:return None
    head,receiver=pairs[0];receivers=[receiver];trace_value=head['center_value'];edges=[];traced=[]
    for y in range(ny):
        for x in range(nx):
            for dx,dy in [(1,0),(0,1)]:
                if x+dx>=nx or y+dy>=ny:continue
                a=(x,y);bb=(x+dx,y+dy);px,py=center(g,a);qx,qy=center(g,bb);mx,my=(px+qx)//2,(py+qy)//2;value=rows[my][mx]
                if value==trace_value:traced.append(pair(a,bb));width=None
                else:
                    width=1
                    for sign in [-1,1]:
                        k=1
                        while k<pitch//2 and rows[my+sign*k*dy][mx+sign*k*dx]==value:width+=1;k+=1
                edges.append({'cells':[list(a),list(bb)],'midpoint':[mx,my],'value':value,'width':width})
    widths=[e['width']for e in edges if e['width']is not None];minimum=min(widths)if widths else None
    allowed=[e['cells']for e in edges if e['width']is None or e['width']==minimum]
    adjacent=defaultdict(list)
    for a,bb in traced:adjacent[a].append(bb);adjacent[bb].append(a)
    if any(len(v)>2 for v in adjacent.values()):return None
    path=[tuple(head['cell'])];previous=None
    while True:
        following=[p for p in adjacent[path[-1]]if p!=previous]
        if not following:break
        if len(following)!=1 or following[0]in path:return None
        previous=path[-1];path.append(following[0])
    if len(path)>1 and len(path)!=len(adjacent):return None
    path.reverse()
    return {'geometry':g,'geometry_ref':identity(g),'head':head,'receiver_hypothesis':receivers[0],'prefix':[list(p)for p in path],'allowed_edges_hypothesis':allowed,'edge_measurements':edges,'trace_value':trace_value if len(path)>1 else None,'scope':'Thinner separators as passages and distinct empty mark as final receiver remain hypotheses. No palette role or game law is fixed.'}

def ring_matches(rows,g,mark,cell):
    x,y=center(g,cell);half=mark['width']//2
    return all(rows[yy][xx]==mark['palette']for yy in range(y-half,y+half+1)for xx in range(x-half,x+half+1)if yy in(y-half,y+half)or xx in(x-half,x+half))
