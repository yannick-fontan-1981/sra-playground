"""Compact motifs inside/outside a measured frame; roles remain hypotheses."""
from collections import Counter
from geometric_observer import components
from packet_line_observation import frame_support
from terminal_composition import identity

def merge_boxes(boxes):
    groups=[]
    for box in boxes:
        matching=[g for g in groups if any(not(box[2]<b[0]-1 or b[2]<box[0]-1 or box[3]<b[1]-1 or b[3]<box[1]-1)for b in g)]
        combined=[box]
        for g in matching:combined+=g;groups.remove(g)
        groups.append(combined)
    return [[min(b[0]for b in g),min(b[1]for b in g),max(b[2]for b in g),max(b[3]for b in g)]for g in groups]

def foreground_groups(rows,background,bounds):
    l,t,r,b=bounds;seen=set();groups=[]
    for y in range(t,b+1):
        for x in range(l,r+1):
            if(x,y)in seen or rows[y][x]==background:continue
            todo=[(x,y)];seen.add((x,y));pts=[]
            while todo:
                xx,yy=todo.pop();pts.append((xx,yy))
                for dx in(-1,0,1):
                    for dy in(-1,0,1):
                        q=(xx+dx,yy+dy)
                        if l<=q[0]<=r and t<=q[1]<=b and q not in seen and rows[q[1]][q[0]]!=background:seen.add(q);todo.append(q)
            groups.append(pts)
    return groups

def scene(rows):
    frame=frame_support(rows)
    if not frame:return None
    l,t,r,b=frame;counts=Counter(rows[y][x]for y in range(t+1,b)for x in range(l+1,r));peak=counts.most_common(2)
    if len(peak)<2 or peak[0][1]==peak[1][1]:return None
    background=peak[0][0];limit=min(r-l,b-t)/3;inside=[];outside=[];cores=[]
    for p in components(rows):
        a,c,z,d=p['bbox'];w,h=z-a+1,d-c+1
        if p['color']==background or min(w,h)<3 or max(w,h)>limit or p['area']<w*h*.4:continue
        if l<a<=z<r and t<c<=d<b:inside.append(p['bbox']);cores.append(p)
        elif z<l or a>r or d<t or c>b:
            if p['area']<w*h:outside.append(p['bbox'])
    for pts in foreground_groups(rows,background,[l+1,t+1,r-1,b-1]):
        box=[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)];w,h=box[2]-box[0]+1,box[3]-box[1]+1
        if min(w,h)>=3 and max(w,h)<=limit and len(pts)>=4:inside.append(box)
    objects=[]
    for box in merge_boxes(inside):
        extent=list(box);contained=[p for p in cores if box[0]<=p['bbox'][0]<=p['bbox'][2]<=box[2]and box[1]<=p['bbox'][1]<=p['bbox'][3]<=box[3]]
        if contained:
            largest=max(p['area']for p in contained);best=[p for p in contained if p['area']==largest];centers={((p['bbox'][0]+p['bbox'][2]+1)//2,(p['bbox'][1]+p['bbox'][3]+1)//2)for p in best}
            if len(centers)!=1:return None
            box=best[0]['bbox']
        a,c,z,d=box;point=[(a+z+1)//2,(c+d+1)//2];objects.append({'bbox':box,'point':point,'ref':'support:'+identity(box),'shape':[[int(rows[y][x]!=background)for x in range(a,z+1)]for y in range(c,d+1)]})
        objects[-1]['connected_extent_bbox']=extent;objects[-1]['center_scope']='largest measured compact core, attached thin continuation kept separately'if contained else'compact connected support extent'
    controls=[]
    for box in merge_boxes(outside):
        a,c,z,d=box;point=[(a+z+1)//2,(c+d+1)//2];radius=(max(z-a+1,d-c+1)+1)//2
        if point[0]-radius<0 or point[1]-radius<0 or point[0]+radius>=len(rows[0])or point[1]+radius>=len(rows):continue
        controls.append({'bbox':box,'point':point,'radius':radius,'ref':'control:'+identity(box)})
    if not controls or len(objects)<2:return None
    return {'frame':frame,'background':background,'objects':objects,'controls':controls,'scope':'Outside compact motifs as possible controls, inside supports as possible recipients. No palette roles, game identity or optical law.'}

def phase(rows,control,occlusion=()):
    x,y=control['point'];r=control['radius'];masked=set(map(tuple,occlusion))
    return identity([[None if(dx,dy)in masked else rows[y+dy][x+dx]for dx in range(-r,r+1)]for dy in range(-r,r+1)])

def changed_supports(before,after,measurement):
    return [o for o in measurement['objects']if any(before[y][x]!=after[y][x]for y in range(o['bbox'][1],o['bbox'][3]+1)for x in range(o['bbox'][0],o['bbox'][2]+1))]

def selection_recipient(before,after,affected,previous):
    if len(affected)==1:return affected[0],{'kind':'single_cochanged_support'}
    if len(affected)!=2 or not previous or previous['ref']not in{o['ref']for o in affected}:return None,{'kind':'ambiguous_cochange'}
    current=next(o for o in affected if o['ref']!=previous['ref']);x,y=previous['point'];u,v=current['point']
    old=(before[y][x],after[y][x]);new=(before[v][u],after[v][u])
    if old[0]!=old[1]and old==new[::-1]:return current,{'kind':'reciprocal_center_decoration_replacement','previous_ref':previous['ref'],'current_ref':current['ref'],'previous_values':list(old),'current_values':list(new)}
    return None,{'kind':'cochange_without_reciprocal_decoration'}
