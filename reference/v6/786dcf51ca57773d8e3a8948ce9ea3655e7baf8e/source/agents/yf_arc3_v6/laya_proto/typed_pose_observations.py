"""Typed pose comparisons and novel public controls, independent of game identity."""
from collections import Counter
from geometric_observer import components
from typed_carrier_scene import measure
from typed_material_observations import requests
from terminal_composition import identity

def small_parts(rows):
    background=Counter(v for row in rows for v in row).most_common(1)[0][0];out=[]
    for p in components(rows):
        x,y,r,b=p['bbox'];w,h=r-x+1,b-y+1
        if p['color']==background or p['rectangular'] or min(w,h)<3 or max(w,h)>max(len(rows),len(rows[0]))/4:continue
        out.append({'bbox':p['bbox'],'color':p['color'],'mask':sorted(map(list,p['mask']))})
    return out

def novel_controls(old,rows,obs,cfg):
    current=small_parts(rows);seen={identity(p)for p in old};scene=measure(rows,obs,cfg);boxes=[q['bbox']for q in requests(rows,obs)]+[q['bbox']for q in (scene or {}).get('carriers',[])];novel=[]
    for p in current:
        x,y,r,b=p['bbox']
        if identity(p) in seen or any(not(r<l-3 or x>rr+3 or b<t-3 or y>bb+3)for l,t,rr,bb in boxes):continue
        novel.append(p)
    groups=[]
    for p in novel:
        support={(p['bbox'][0]+u,p['bbox'][1]+v)for u,v in p['mask']};touch=[i for i,g in enumerate(groups)if any((u+dx,v+dy)in g for u,v in support for dx,dy in ((0,0),(1,0),(-1,0),(0,1),(0,-1)))]
        for i in reversed(touch):support|=groups.pop(i)
        groups.append(support)
    out=[]
    for pixels in groups:
        x,y=min(u for u,v in pixels),min(v for u,v in pixels);r,b=max(u for u,v in pixels),max(v for u,v in pixels);point=min((list(p)for p in pixels),key=lambda p:((p[0]-(x+r)/2)**2+(p[1]-(y+b)/2)**2,p));out.append({'bbox':[x,y,r,b],'point':point,'projection':[[rows[v][u]for u in range(x,r+1)]for v in range(y,b+1)],'source_ref':obs['observation_ref'],'epoch':obs['level_epoch'],'status':'uncharacterized_new_scope_control_candidate'})
    return out,current

def rotated(marks,turns):
    result=[list(m)for m in marks]
    for _ in range(turns%4):result=[[v,-dy,dx]for v,dx,dy in result]
    return sorted(result)

def current_marks(child,rows):
    cx,cy=child['center'];x,y,r,b=child['bbox'];out=[]
    for value in sorted({m[0]for m in child['marks']}):
        points=[(u,v)for v in range(y,b+1)for u in range(x,r+1)if rows[v][u]==value]
        if len(points)!=1:return None
        u,v=points[0];out.append([value,u-cx,v-cy])
    return sorted(out)

def outside_digest(rows,*boxes):
    return identity([[u,v,a]for v,row in enumerate(rows)for u,a in enumerate(row)if not any(x<=u<=r and y<=v<=b for x,y,r,b in boxes)])

def control_matches(control,rows,epoch):
    x,y,r,b=control['bbox'];return epoch==control['epoch'] and [[rows[v][u]for u in range(x,r+1)]for v in range(y,b+1)]==control['projection']
