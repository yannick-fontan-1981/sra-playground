"""Measure a lattice, disjoint drawn chains, endpoint widths and aligned mark counts."""
from collections import Counter
from geometric_observer import components
from terminal_composition import identity

def scene(rows,content_palette=None):
    parts=components(rows);candidates=[]
    for p in parts:
        l,t,r,b=p['bbox'];w,h=r-l+1,b-t+1
        if min(w,h)<9:continue
        xs=[x for x in range(l,r+1)if sum(rows[y][x]==p['color']for y in range(t,b+1))*2>=h]
        ys=[y for y in range(t,b+1)if sum(rows[y][x]==p['color']for x in range(l,r+1))*2>=w]
        if min(len(xs),len(ys))<3 or xs[0]!=l or xs[-1]!=r or ys[0]!=t or ys[-1]!=b:continue
        dx=set(v-u for u,v in zip(xs,xs[1:]));dy=set(v-u for u,v in zip(ys,ys[1:]))
        if len(dx)!=1 or len(dy)!=1 or min(next(iter(dx)),next(iter(dy)))<4:continue
        candidates.append((w*h,p,xs,ys))
    if not candidates:return None
    _,frame,xs,ys=max(candidates,key=lambda z:z[0]);l,t,r,b=frame['bbox'];nx,ny=len(xs)-1,len(ys)-1;centers={(i,j):[(xs[i]+xs[i+1])//2,(ys[j]+ys[j+1])//2]for j in range(ny)for i in range(nx)};bg=Counter(rows[y][x]for y in range(t+1,b)for x in range(l+1,r)if rows[y][x]!=frame['color']).most_common(1)[0][0];empty=Counter(rows[y][x]for x,y in centers.values()).most_common(1)[0][0]
    if content_palette is not None:empty=content_palette
    graph={c:[]for c in centers}
    for c,(x,y)in centers.items():
        for d in((c[0]+1,c[1]),(c[0],c[1]+1)):
            if d not in centers:continue
            X,Y=centers[d];line=[rows[y][u]for u in range(x,X+1)]if y==Y else[rows[v][x]for v in range(y,Y+1)]
            if all(v not in(bg,frame['color'])for v in line):graph[c].append(d);graph[d].append(c)
    if any(len(v)>2 for v in graph.values()):return None
    pending=set(centers);chains=[]
    def thickness(c):
        x,y=centers[c];color=rows[y][x];runs=[]
        for u,v in((1,0),(0,1)):
            count=1
            for sign in(-1,1):
                k=1
                while 0<=x+u*k*sign<len(rows[0])and 0<=y+v*k*sign<len(rows)and rows[y+v*k*sign][x+u*k*sign]==color:count+=1;k+=1
            runs.append(count)
        return min(runs)
    while pending:
        seed=min(pending);group={seed};todo=[seed]
        while todo:
            for d in graph[todo.pop()]:
                if d not in group:group.add(d);todo.append(d)
        pending-=group;ends=[c for c in group if len(graph[c])<=1]
        if len(ends)!=2:return None
        widths=[thickness(c)for c in ends]
        if widths[0]==widths[1]:return None
        root=ends[widths.index(max(widths))];path=[root];previous=None
        while True:
            nxt=[d for d in graph[path[-1]]if d!=previous]
            if not nxt:break
            previous=path[-1];path.append(nxt[0])
        if len(path)!=len(group):return None
        chains.append({'cells':[list(c)for c in path],'points':[centers[c]for c in path],'endpoint_widths':widths,'root_hypothesis':'unique wider endpoint, pending effect validation'})
    clues=[];unit_shapes=[]
    for axis in(0,1):
        values=[];units=set()
        for i in range(ny if axis==0 else nx):
            mid=(ys[i]+ys[i+1])//2 if axis==0 else(xs[i]+xs[i+1])//2;pitch=ys[1]-ys[0]if axis==0 else xs[1]-xs[0];near=[]
            for p in parts:
                L,T,R,B=p['bbox'];cx,cy=(L+R)/2,(T+B)/2
                if(axis==0 and l-pitch<=L<=R<l and abs(cy-mid)<pitch/4)or(axis==1 and t-pitch<=T<=B<t and abs(cx-mid)<pitch/4):near.append(p)
            if not near:return None
            hollow=[p for p in near if p['bbox'][2]-p['bbox'][0]==p['bbox'][3]-p['bbox'][1]and p['area']==(p['bbox'][2]-p['bbox'][0]+1)**2-1 and rows[(p['bbox'][1]+p['bbox'][3])//2][(p['bbox'][0]+p['bbox'][2])//2]!=p['color']]
            if hollow:
                if len(hollow)!=1:return None
                H=hollow[0]['bbox']
                if any(not(H[0]<=p['bbox'][0]<=p['bbox'][2]<=H[2]and H[1]<=p['bbox'][1]<=p['bbox'][3]<=H[3])for p in near):return None
                values.append(0);continue
            shapes={(p['bbox'][2]-p['bbox'][0]+1,p['bbox'][3]-p['bbox'][1]+1)for p in near}
            if len(shapes)!=1 or any(p['area']!=(p['bbox'][2]-p['bbox'][0]+1)*(p['bbox'][3]-p['bbox'][1]+1)for p in near):return None
            units|=shapes;values.append(len(near))
        if len(units)!=1:return None
        unit_shapes.append(next(iter(units)));clues.append(values)
    if unit_shapes[0]!=tuple(reversed(unit_shapes[1])):return None
    chains.sort(key=lambda p:p['points'][0]);result={'bbox':frame['bbox'],'x_lines':xs,'y_lines':ys,'shape':[nx,ny],'background':bg,'grid_palette':frame['color'],'empty_content_palette':empty,'chains':chains,'row_marks':clues[0],'column_marks':clues[1],'mark_unit_shapes':[list(x)for x in unit_shapes],'scope':'Measured counts and drawn connectivity; quota semantics, root and prefix edit remain hypotheses.'};result['geometry_ref']=identity(result);return result
