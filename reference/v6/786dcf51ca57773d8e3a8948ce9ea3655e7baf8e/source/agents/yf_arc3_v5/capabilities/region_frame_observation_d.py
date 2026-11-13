"""Neutral bounded measurements of perforated, nested rectangular frames."""
from collections import Counter
from agents.yf_arc3_v5.logos.types import stable_digest


def measure_region_frames(frame, components, contract):
    background=Counter(x for row in frame.rows for x in row).most_common(1)[0][0]
    found={}
    for component in components:
        box=component.bbox; value=component.value
        if (value==background or min(box.height,box.width)<contract['minimum_frame_size']
                or max(box.height,box.width)>=max(frame.height,frame.width)):
            continue
        t,l,b,r=box.top,box.left,box.bottom,box.right
        counts=Counter(frame.rows[y][x] for y in range(t+1,b) for x in range(l+1,r))
        modes=tuple(x for x,count in sorted(counts.items()) if count==max(counts.values()))
        if len(modes)!=1 or modes[0]==value:
            continue
        interior=modes[0]
        if any(frame.rows[y][x]!=value for y,x in ((t,l),(t,r),(b,l),(b,r))):
            continue
        sides=(tuple(frame.rows[t][x] for x in range(l,r+1)),tuple(frame.rows[b][x] for x in range(l,r+1)),
               tuple(frame.rows[y][l] for y in range(t,b+1)),tuple(frame.rows[y][r] for y in range(t,b+1)))
        numerator,denominator=contract['minimum_border_fraction']
        if any(denominator*side.count(value)<numerator*len(side)
               or any(x not in (value,interior) for x in side) for side in sides):
            continue
        runs=[]
        for x in range(l,r+1):
            n=0
            while t+n<=b and frame.rows[t+n][x]==value:n+=1
            if 0<n<=contract['maximum_wall_thickness']:runs.append(n)
        for y in range(t,b+1):
            n=0
            while l+n<=r and frame.rows[y][l+n]==value:n+=1
            if 0<n<=contract['maximum_wall_thickness']:runs.append(n)
        if not runs:continue
        q=min(runs)
        if box.height%q or box.width%q:continue
        corners=((t,l),(t,r-q+1),(b-q+1,l),(b-q+1,r-q+1))
        if any(frame.rows[y+j][x+i]!=value for y,x in corners for j in range(q) for i in range(q)):
            continue
        found[(t,l,b,r)]={'box':(t,l,b,r),'value':value,'quantum':q,
            'interior_background':interior,'component_ref':component.component_id}
    frames=sorted(found.values(),key=lambda d:(-(d['box'][2]-d['box'][0]+1)*(d['box'][3]-d['box'][1]+1),d['box']))
    if (not 2<=len(frames)<=contract['maximum_frames']
            or len({g['quantum'] for g in frames})!=1
            or len({g['interior_background'] for g in frames})!=1):
        return None
    background=frames[0]['interior_background']
    crosses=[]
    for y in range(1,frame.height-1):
        for x in range(1,frame.width-1):
            corners={frame.rows[y+dy][x+dx] for dy in (-1,1) for dx in (-1,1)}
            arms={frame.rows[y+dy][x+dx] for dy,dx in ((-1,0),(1,0),(0,-1),(0,1))}
            if corners=={background} and len(arms)==1 and len({*corners,*arms,frame.rows[y][x]})==3:
                crosses.append((y,x))
    if len(crosses)!=1:return None
    cy,cx=crosses[0]
    def cleared(y,x):
        return background if abs(y-cy)<=1 and abs(x-cx)<=1 else frame.rows[y][x]
    for i,g in enumerate(frames):
        t,l,b,r=g['box'];q=g['quantum']
        containing=[j for j,p in enumerate(frames) if j!=i and p['box'][0]<t<=b<p['box'][2]
                    and p['box'][1]<l<=r<p['box'][3]]
        parent=min(containing,key=lambda j:(frames[j]['box'][2]-frames[j]['box'][0]+1)*(frames[j]['box'][3]-frames[j]['box'][1]+1)) if containing else None
        g['parent_index']=parent
        descendants=tuple(a['box'] for a in frames if t<a['box'][0]<=a['box'][2]<b and l<a['box'][1]<=a['box'][3]<r)
        walls=[]
        for row,y in enumerate(range(t,b+1,q)):
            for col,x in enumerate(range(l,r+1,q)):
                if any(a<=y and y+q-1<=c and d<=x and x+q-1<=e for a,d,c,e in descendants):continue
                pixels={cleared(y+j,x+k) for j in range(q) for k in range(q)}
                if pixels=={g['value']}:walls.append((row,col))
                elif pixels!={background}:return None
        g['walls']=tuple(walls);g['dimensions']=((b-t+1)//q,(r-l+1)//q)
        g['identity']=stable_digest((g['dimensions'],g['walls']))
        p=frames[parent]['box'] if parent is not None else frames[0]['box']
        if (t-p[0])%q or (l-p[1])%q:return None
        g['local_origin']=((t-p[0])//q,(l-p[1])//q)
    if [i for i,g in enumerate(frames) if g['parent_index'] is None]!=[0]:return None
    if len({g['identity'] for g in frames})!=len(frames):return None
    def depth(i):
        count=0
        while frames[i]['parent_index'] is not None:
            i=frames[i]['parent_index'];count+=1
        return count
    order=tuple(sorted(range(len(frames)),key=lambda i:(depth(i),frames[i]['identity'])))
    remap={old:new for new,old in enumerate(order)}
    for g in frames:
        if g['parent_index'] is not None:g['parent_index']=remap[g['parent_index']]
    frames=tuple(frames[i] for i in order)
    containing=tuple(i for i,g in enumerate(frames) if g['box'][0]<=cy<=g['box'][2] and g['box'][1]<=cx<=g['box'][3])
    if not containing:return None
    owner=min(containing,key=lambda i:frames[i]['dimensions'][0]*frames[i]['dimensions'][1])
    g=frames[owner];q=g['quantum']
    anchor=((cy-g['box'][0])//q,(cx-g['box'][1])//q)
    root=frames[0];h,w=root['dimensions'];walls=set(root['walls'])
    openings=tuple((y,x) for y in range(h) for x in range(w)
                   if (y in (0,h-1) or x in (0,w-1)) and (y,x) not in walls)
    if len(openings)!=1:return None
    return {'frames':frames,'quantum':q,'cross_owner':owner,'cross_anchor':anchor,
            'cross_center':(cy,cx),'boundary_opening':openings[0]}
