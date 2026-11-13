"""Observed dense carriers with sparse typed internal marks; no semantic palette."""
from collections import Counter
from geometric_observer import components
from terminal_composition import identity

def measure(rows,obs,config):
    height,width=len(rows),len(rows[0]);parts=components(rows);background=Counter(v for row in rows for v in row).most_common(1)[0][0];carriers=[]
    candidates=[]
    for part in parts:
        candidates.append((part,part['bbox'],'component'))
        x,y,r,b=part['bbox'];w,h=r-x+1,b-y+1
        if part['area']/(w*h)<config['minimum_body_fill']:continue
        for shape in config.get('observed_body_shapes',[]):
            sw,sh=shape['size'];cx,cy=(x+r)/2,(y+b)/2;left,top=cx-(sw-1)/2,cy-(sh-1)/2
            if sw<w and sh<h and left.is_integer() and top.is_integer():candidates.append((part,[int(left),int(top),int(left)+sw-1,int(top)+sh-1],'calibrated_centered_window'))
    seen=set()
    for part,box,source in candidates:
        x,y,r,b=box;w,h=r-x+1,b-y+1;support={(u,v)for v in range(h)for u in range(w)if rows[y+v][x+u]==part['color']}
        if part['color']==background or not(3<=w<=width/4 and 3<=h<=height/4):continue
        if not config['minimum_body_fill']<=len(support)/(w*h)<1:continue
        missing=[(u,v) for v in range(h) for u in range(w) if (u,v) not in support]
        if any(u in (0,w-1) or v in (0,h-1) for u,v in missing):continue
        values=Counter(rows[y+v][x+u] for u,v in missing)
        if len(values)<config['minimum_distinct_internal_marks'] or max(values.values())>config['maximum_pixels_per_mark']:continue
        center=[(x+r)/2,(y+b)/2];marks=sorted([rows[y+v][x+u],x+u-center[0],y+v-center[1]] for u,v in missing)
        frame=[max(0,x-1),max(0,y-1),min(width-1,r+1),min(height-1,b+1)]
        fringe=[[u-center[0],v-center[1],rows[v][u]] for v in range(frame[1],frame[3]+1) for u in range(frame[0],frame[2]+1) if not(x<=u<=r and y<=v<=b) and rows[v][u]!=background]
        point=min(([x+u,y+v] for u,v in support),key=lambda p:((p[0]-center[0])**2+(p[1]-center[1])**2,p))
        key=(tuple(box),part['color'])
        if key in seen:continue
        seen.add(key);carriers.append({'id':identity([obs['level_epoch'],box,marks]),'bbox':box,'center':center,'point':point,'body_palette':part['color'],'marks':marks,'signature':identity([w,h,marks]),'fringe':fringe,'fringe_signature':identity(fringe),'body_ref':part['id'],'support_source':source,'calibration_refs':[s['evidence']for s in config.get('observed_body_shapes',[])] if source!='component' else []})
    if len(carriers)<config['minimum_repeated_carriers']:return None
    palettes=[set(m[0] for m in c['marks']) for c in carriers]
    if not set.intersection(*palettes):return None
    return {'carriers':carriers,'background_hypothesis':background,'source_ref':obs['observation_ref'],'frame_digest':identity(rows),'scope':'Dense supports and typed holes are measured. Selection, compatibility and production are unconfirmed hypotheses.'}

def replacement_candidate(before_scene,later,after,config):
    """Find one new dense support containing translated prior typed substructures."""
    next_scene=measure(later,after,{**config,'minimum_repeated_carriers':1});current=next_scene['carriers'] if next_scene else []
    removed=[c for c in before_scene['carriers'] if not any(q['bbox']==c['bbox'] and q['signature']==c['signature'] for q in current)]
    if len(removed)<2:return None
    parts=components(later);background=Counter(v for row in later for v in row).most_common(1)[0][0];found=[]
    for part in parts:
        x,y,r,b=part['bbox'];w,h=r-x+1,b-y+1
        if part['color']==background or not(3<=w<=len(later[0])/4 and 3<=h<=len(later)/4) or part['area']/(w*h)<config['minimum_body_fill']:continue
        if any(c['bbox']==part['bbox'] for c in before_scene['carriers']):continue
        embedded=[]
        for old in removed:
            anchors=[]
            for cy in range(y,b+1):
                for cx in range(x,r+1):
                    pixels=[(int(cx+dx),int(cy+dy),value) for value,dx,dy in old['marks']]
                    if all(x<=u<=r and y<=v<=b and later[v][u]==value for u,v,value in pixels):anchors.append([cx,cy])
            if not anchors:break
            embedded.append({'source_signature':old['signature'],'source_id':old['id'],'possible_anchors':anchors})
        if len(embedded)!=len(removed):continue
        center=[(x+r)/2,(y+b)/2];point=min(([x+u,y+v] for u,v in part['mask']),key=lambda p:((p[0]-center[0])**2+(p[1]-center[1])**2,p));selected={'id':identity([after['observation_ref'],part['bbox'],embedded]),'bbox':part['bbox'],'center':center,'point':point,'body_palette':part['color'],'marks':[],'signature':identity(embedded),'fringe':[],'fringe_signature':None,'body_ref':part['id'],'embedded_substructures':embedded}
        found.append({'selected':selected,'removed':removed,'evidence':[before_scene['source_ref'],after['observation_ref']],'status':'material_replacement_with_compatible_embedded_marks'})
    return found[0] if len(found)==1 else None
