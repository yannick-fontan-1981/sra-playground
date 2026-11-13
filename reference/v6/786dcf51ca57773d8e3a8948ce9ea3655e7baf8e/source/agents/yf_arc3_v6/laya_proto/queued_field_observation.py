"""Measure repeated solid cells, an enclosing movable mark and smaller previews.

This extends the existing component/lattice observations to touching cell borders.
No input operator, palette role, queue direction or line-removal law is supplied.
"""
from collections import defaultdict, Counter
from geometric_observer import components
from terminal_composition import identity


def measure(rows, geometry=None, member_count=None):
    parts = components(rows)
    rectangles = defaultdict(list)
    for p in parts:
        x,y,r,b=p['bbox'];w,h=r-x+1,b-y+1
        if min(w,h)>=2 and p['area']==w*h:
            rectangles[w,h].append(p)
    if geometry is None:
        candidates=[]
        for (w,h),cells in rectangles.items():
            xs=sorted({p['bbox'][0]for p in cells});ys=sorted({p['bbox'][1]for p in cells})
            if min(len(xs),len(ys))<2 or len(cells)!=len(xs)*len(ys):continue
            dxs={b-a for a,b in zip(xs,xs[1:])};dys={b-a for a,b in zip(ys,ys[1:])}
            if len(dxs)!=1 or len(dys)!=1:continue
            dx=next(iter(dxs));dy=next(iter(dys))
            if dx<=w or dy<=h:continue
            candidates.append((len(cells)*w*h,{'origin':[xs[0],ys[0]],'shape':[len(xs),len(ys)],'size':[w,h],'pitch':[dx,dy]}))
        if not candidates:return None
        best=max(a for a,g in candidates);matches=[g for a,g in candidates if a==best]
        if len(matches)!=1:return None
        geometry=matches[0]
    x0,y0=geometry['origin'];nx,ny=geometry['shape'];w,h=geometry['size'];dx,dy=geometry['pitch']
    if x0<0 or y0<0 or x0+(nx-1)*dx+w>len(rows[0])or y0+(ny-1)*dy+h>len(rows):return None
    grid=[]
    for j in range(ny):
        line=[]
        for i in range(nx):
            values={rows[y][x]for y in range(y0+j*dy,y0+j*dy+h)for x in range(x0+i*dx,x0+i*dx+w)}
            if len(values)!=1:return None
            line.append(next(iter(values)))
        grid.append(line)
    marks=[]
    for p in parts:
        l,t,r,b=p['bbox']
        covered=[(i,j)for j in range(ny)for i in range(nx)if l<x0+i*dx and x0+i*dx+w-1<r and t<y0+j*dy and y0+j*dy+h-1<b]
        if len(covered)<2 or len({i for i,j in covered})!=1:continue
        if r-l+1>dx or b-t+1>len(covered)*dy:continue
        if any(grid[j][i]==p['color']for i,j in covered):continue
        marks.append({'column':covered[0][0],'rows':[j for i,j in covered],'values':[grid[j][i]for i,j in covered],'bbox':p['bbox'],'palette':p['color']})
    compatible=[m for m in marks if member_count is None or len(m['values'])==member_count]
    mark=compatible[0]if len(compatible)==1 else None
    previews=[]
    if mark:
        k=len(mark['values']);palettes={v for row in grid for v in row}
        for (pw,ph),cells in rectangles.items():
            if pw>=w or ph>=h:continue
            cells=[p for p in cells if p['color']in palettes and not(x0<=p['bbox'][0]<x0+nx*dx and y0<=p['bbox'][1]<y0+ny*dy)]
            xs=sorted({p['bbox'][0]for p in cells});ys=sorted({p['bbox'][1]for p in cells})
            if len(ys)!=k or len(cells)!=len(xs)*len(ys)or not xs:continue
            positions={(p['bbox'][0],p['bbox'][1]):p['color']for p in cells}
            for forward,order in ((True,xs),(False,list(reversed(xs)))):
                for downward,vertical in ((True,ys),(False,list(reversed(ys)))):
                    previews.append({'orientation':[forward,downward],'members':[[positions[x,y]for y in vertical]for x in order],'positions':[[[x,y]for y in vertical]for x in order]})
    count=Counter(v for line in grid for v in line);rank=count.most_common()
    return {'geometry':geometry,'geometry_ref':identity(geometry),'grid':grid,'mark':mark,'mark_alternatives':marks,'active_member_count_constraint':member_count,'preview_alternatives':previews,
            'empty_appearance_hypothesis':rank[0][0]if len(rank)==1 or rank[0][1]>rank[1][1]else None}


def board(scene, empty):
    result=[[None if v==empty else v for v in row]for row in scene['grid']]
    if scene['mark']:
        for j in scene['mark']['rows']:result[j][scene['mark']['column']]=None
    return result
