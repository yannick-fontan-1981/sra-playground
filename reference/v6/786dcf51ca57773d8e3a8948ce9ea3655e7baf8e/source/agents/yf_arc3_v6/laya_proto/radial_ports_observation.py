"""Measure a repeated radial field; colors and support sites are observations."""
from collections import Counter
from geometric_observer import components
from common_port_assembly import view
from terminal_composition import identity
DIRECTIONS=((0,-1),(1,0),(0,1),(-1,0))
def rotate(ports,turn):return sorted((d+turn)%4 for d in ports)
def at_geometry(rows,g):
    x,y=g['origin'];pitch=g['pitch'];n=g['shape'][0];substrate=g['substrate'];cells=[]
    for j in range(n):
        for i in range(n):
            cx=x+i*pitch+pitch//2;cy=y+j*pitch+pitch//2
            if rows[cy][cx]==substrate:return None
            ports=[]
            for d,(dx,dy) in enumerate(DIRECTIONS):
                ray=[rows[cy+dy*k][cx+dx*k]for k in range(max(1,pitch//4),pitch//2)]
                if ray and all(v!=substrate for v in ray):ports.append(d)
            if not ports or len(ports)>3:return None
            cells.append({'index':j*n+i,'grid':[i,j],'point':[cx,cy],'ports':ports,'bbox':[x+i*pitch,y+j*pitch,x+(i+1)*pitch,y+(j+1)*pitch]})
    return {**g,'cells':cells}
def measure(rows):
    candidates=[]
    for part in components(rows):
        x,y,r,b=part['bbox'];span=r-x
        if span!=b-y or span<12:continue
        border=part['color'];rim=[rows[v][u]==border for u,v in [(u,y)for u in range(x,r+1)]+[(u,b)for u in range(x,r+1)]+[(x,v)for v in range(y,b+1)]+[(r,v)for v in range(y,b+1)]]
        if sum(rim)<.75*len(rim):continue
        substrate=Counter(rows[v][u]for v in range(y+1,b)for u in range(x+1,r)).most_common(1)[0][0]
        if substrate==border:continue
        for n in range(2,span//4+1):
            if span%n or (span//n)%2:continue
            g={'origin':[x,y],'shape':[n,n],'pitch':span//n,'border':border,'substrate':substrate};s=at_geometry(rows,g)
            if s:candidates.append(s)
    if len(candidates)!=1:return None
    s=candidates[0];s['geometry_ref']=identity({k:v for k,v in s.items()if k!='cells'});return s
def assembly_model(scene):
    bodies=[];domains=[];current=[]
    for cell in scene['cells']:
        ports={DIRECTIONS[d]for d in cell['ports']};material=ports|{(0,0)};body={'material':material,'ports':ports,'known':True};bodies.append(body);i,j=cell['grid'];poses=[]
        for k in range(4):
            _,_,mapping=view(material,ports,k);dx,dy=mapping[0,0];poses.append((k,2*i+1-dx,2*j+1-dy))
        domains.append(poses);current.append(poses[0])
    n=scene['shape'][0]
    return {'bodies':bodies,'pose_domains':domains,'unit':1,'phase':[0,1],'width':2*n+1,'height':2*n+2,'require_connected':True,'require_acyclic':True},tuple(current)
def selected_occurrence(rows,scene):
    hits=[]
    for cell in scene['cells']:
        l,t,r,b=cell['bbox'];l+=1;t+=1;r-=1;b-=1
        rim=[rows[v][u]for u,v in [(u,t)for u in range(l,r+1)]+[(u,b)for u in range(l,r+1)]+[(l,v)for v in range(t,b+1)]+[(r,v)for v in range(t,b+1)]]
        if len(set(rim))==1 and rim[0] not in (scene['substrate'],scene['border']):hits.append({'index':cell['index'],'frame_palette':rim[0]})
    return hits[0]if len(hits)==1 else None
