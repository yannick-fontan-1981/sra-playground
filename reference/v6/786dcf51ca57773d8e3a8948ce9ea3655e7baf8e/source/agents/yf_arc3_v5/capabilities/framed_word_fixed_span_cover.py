from collections import Counter,defaultdict
from itertools import permutations
from math import factorial
from agents.yf_arc3_v5.capabilities.framed_word_parameters_d import _inside,_regular
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput

def fixed_span_scene(value,contract):
    if contract.get('fixed_span_group_correspondence')!='revisable_row_major_disjoint_cover':return None
    frame=value.current_observed_frame or value.frame
    if frame.width*frame.height>contract['maximum_frame_pixels']:return None
    components=value.components.components if frame==value.frame else detect_components(ComponentExtractionInput(frame=frame)).components
    if len(components)>contract['maximum_components']:return None
    groups=defaultdict(list)
    for c in components:
        b=c.bbox
        if b.width>b.height>=4 and c.area==2*(b.width+b.height)-4 and all(frame.rows[y][x]==c.value for y in range(b.top,b.bottom+1) for x in range(b.left,b.right+1) if y in (b.top,b.bottom) or x in (b.left,b.right)):
            groups[(b.height,b.width)].append(c)
    alternatives=[]
    for _,group in sorted(groups.items()):
        panels=tuple(sorted(group,key=lambda c:(c.bbox.top,c.bbox.left)))
        if not 2<=len(panels)<=contract['maximum_panels'] or len({p.bbox.top for p in panels})<2:continue
        if factorial(len(panels))>contract['maximum_group_correspondences']:continue
        words=defaultdict(list)
        for c in components:
            b=c.bbox
            if b.bottom<panels[0].bbox.top and b.width==b.height>=2 and c.area==b.width*b.height:words[(b.top,b.width)].append(c)
        for _,row in sorted(words.items()):
            word=tuple(sorted(row,key=lambda c:c.bbox.left))
            if len(word)>contract['maximum_word_members'] or not _regular(word):continue
            runs=[]
            for c in word:
                if runs and runs[-1][0]==c.value:runs[-1]=(c.value,runs[-1][1]+1)
                else:runs.append((c.value,1))
            if len(runs)!=len(panels) or len({p for p,_ in runs})<2:continue
            header={c.value for c in word};descriptors=[]
            for panel in panels:
                box=panel.bbox;members=tuple(c for c in components if _inside(c,panel))
                hist=Counter(frame.rows[y][x] for y in range(box.top+1,box.bottom) for x in range(box.left+1,box.right))
                peaks=[v for v,n in sorted(hist.items()) if n==max(hist.values())]
                if len(peaks)!=1:break
                rows=defaultdict(list)
                for c in members:
                    b=c.bbox
                    if c.value==peaks[0] or not b.width==b.height>=2 or b.top<=(box.top+box.bottom)//2:continue
                    corners={(b.top,b.left),(b.top,b.right),(b.bottom,b.left),(b.bottom,b.right)}
                    missing={(r,col) for r in range(b.top,b.bottom+1) for col in range(b.left,b.right+1)}-set(c.pixels)
                    kind='filled' if c.area==b.width*b.height else 'one_missing_corner' if len(missing)==1 and missing<=corners else None
                    if kind:rows[(b.top,b.width,kind)].append(c)
                marker_rows=[(key,tuple(sorted(cs,key=lambda c:c.bbox.left))) for key,cs in sorted(rows.items()) if _regular(tuple(sorted(cs,key=lambda c:c.bbox.left)))]
                if len(marker_rows)!=1:break
                (_,_,kind),markers=marker_rows[0]
                if len(markers)>contract['maximum_markers']:break
                paints=tuple(c.value for c in markers);prefix=1
                while prefix<len(paints) and paints[prefix]==paints[0]:prefix+=1
                if len(set(paints))>2 or len(set(paints[prefix:]))>1:break
                patches=tuple(c for c in members if c.value in header and c.bbox.width>=2 and c.bbox.height>=2 and c.area>=c.bbox.width*c.bbox.height-1 and c.bbox.bottom<markers[0].bbox.top)
                if not patches:break
                patch_paints={c.value for c in patches};left=min(c.bbox.left for c in patches)
                domain=patch_paints|{c.value for c in members if c.area==1 and c.value in header and c.bbox.left<left and c.bbox.bottom<markers[0].bbox.top}
                wildcard=len(patch_paints)>1 and any(c.bbox.width==1 and c.bbox.height==2 and c.area==2 and min(p.bbox.top for p in patches)<=c.bbox.top<=c.bbox.bottom<=max(p.bbox.bottom for p in patches) and left<=c.bbox.left<=max(p.bbox.right for p in patches) for c in members)
                if len(patch_paints)>1 and not wildcard:break
                descriptors.append((panel,kind,len(markers) if kind=='one_missing_corner' else prefix,markers,patches,domain,wildcard))
            if len(descriptors)!=len(panels) or not any(d[1]=='one_missing_corner' for d in descriptors) or not any(d[-1] for d in descriptors):continue
            matches=[]
            for assignment in permutations(range(len(runs))):
                remaining=set(range(len(runs)));valid=True
                for d,index in zip(descriptors,assignment):
                    _,kind,count,markers,patches,domain,wildcard=d;paint,length=runs[index]
                    if (kind=='one_missing_corner' and count!=length) or (kind=='filled' and length>len(markers)) or (not wildcard and paint not in domain) or (wildcard and index!=min(remaining)):
                        valid=False;break
                    remaining.remove(index)
                if valid:matches.append(assignment)
            if len(matches)!=1:continue
            result=tuple((d[0],runs[index][1],runs[index][0],d[1],d[2],d[3],d[4]) for d,index in zip(descriptors,matches[0]))
            alternatives.append((frame,word,result))
    return alternatives[0] if len(alternatives)==1 else None
