"""Measure repeated controls, local vocabularies and a complete miniature product."""
from collections import defaultdict
from itertools import product
from geometric_observer import components
from terminal_composition import identity

def measure(rows):
    groups=defaultdict(list);solids=[]
    for c in components(rows):
        l,t,r,b=c['bbox'];w,h=r-l+1,b-t+1
        if c['area']==w*h:solids.append(c)
        if w<3 or h<3:continue
        edge={rows[y][x]for y in range(t,b+1)for x in range(l,r+1)if y in(t,b)or x in(l,r)}
        if len(edge)==1:groups[w,h].append({'bbox':[l,t,r,b],'border':next(iter(edge))})
    candidates=[]
    for (w,h),frames in groups.items():
        if w!=h or len(frames)<2:continue
        byrow=defaultdict(list)
        for f in frames:byrow[f['bbox'][1]].append(f)
        for group in byrow.values():
            if len(group)<2:continue
            controls=[]
            for f in sorted(group,key=lambda z:z['bbox'][0]):
                l,t,r,b=f['bbox'];legends=defaultdict(list)
                for c in solids:
                    x,y,rr,bb=c['bbox'];ww,hh=rr-x+1,bb-y+1
                    if ww==hh and ww<w and l<=x<=rr<=r and b<y:legends[y,ww].append(c)
                valid=[(y,size,cs)for(y,size),cs in legends.items()if len(cs)>=2 and len({c['color']for c in cs})==len(cs)]
                if not valid:break
                y,size,cs=min(valid,key=lambda a:(a[0],-a[1]));cs=sorted(cs,key=lambda c:c['bbox'][0]);values=[c['color']for c in cs];point=[(l+r)//2,(t+b)//2];current=rows[point[1]][point[0]]
                if current not in values:break
                controls.append({'bbox':f['bbox'],'point':point,'values':values,'current':current,'legend_boxes':[c['bbox']for c in cs]})
            if len(controls)!=len(group):continue
            count=1
            for c in controls:count*=len(c['values'])
            for (cw,ch),cards in groups.items():
                if cw>=w or ch>=h or len(cards)!=count:continue
                cards=sorted(cards,key=lambda f:(f['bbox'][1],f['bbox'][0]));offsets=[]
                for c in controls:
                    matches=[]
                    for yy in range(1,ch-1):
                        for xx in range(1,cw-1):
                            vals={rows[z['bbox'][1]+yy][z['bbox'][0]+xx]for z in cards}
                            if vals==set(c['values']):matches.append([xx,yy])
                    if len(matches)!=1:break
                    offsets.append(matches[0])
                if len(offsets)!=len(controls)or len({tuple(x)for x in offsets})!=len(offsets):continue
                entries=[{**f,'values':[rows[f['bbox'][1]+y][f['bbox'][0]+x]for x,y in offsets]}for f in cards]
                catalogue=[tuple(e['values'])for e in entries]
                if len(set(catalogue))!=count or set(catalogue)!=set(product(*(c['values']for c in controls))):continue
                geometry={'controls':[c['bbox']for c in controls],'legends':[c['legend_boxes']for c in controls],'cards':[e['bbox']for e in entries],'offsets':offsets}
                candidates.append({'geometry':geometry,'geometry_ref':identity(geometry),'controls':controls,'entries':entries,'current':[c['current']for c in controls],'catalogue':[list(x)for x in catalogue]})
    return candidates[0]if len(candidates)==1 else None
