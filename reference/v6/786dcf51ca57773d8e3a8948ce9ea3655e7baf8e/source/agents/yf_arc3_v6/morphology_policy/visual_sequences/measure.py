"""Bounded public rectangle/row decomposition; no screen offsets or color roles."""
from collections import Counter,defaultdict
from terminal_composition import identity

def frame_boxes(observation):
    boxes=[]
    for e in observation['entities']:
        l,t,r,b=e['bbox'];w,h=r-l+1,b-t+1
        if w<4 or h<4 or e['area']!=2*w+2*h-4:continue
        expected={(x,y) for y in range(h) for x in range(w) if x in (0,w-1) or y in (0,h-1)}
        if set(map(tuple,e['mask']))==expected:boxes.append({'box':[l,t,r,b],'border':e['palette_value'],'size':[w,h]})
    return boxes

def interior(rows,box):
    l,t,r,b=box
    return tuple(tuple(row[l+1:r]) for row in rows[t+1:b])

def layout(observation,rows):
    boxes=frame_boxes(observation);groups=defaultdict(list)
    for box in boxes:groups[tuple(box['size']),box['box'][1]].append(box)
    matrix=defaultdict(list)
    for (size,y),group in groups.items():
        group=sorted(group,key=lambda b:b['box'][0]);xs=tuple(b['box'][0] for b in group)
        if len(xs)<3 or len({b-a for a,b in zip(xs,xs[1:])})!=1:continue
        matrix[size,xs].append(group)
    candidates=[];background=Counter(v for row in rows for v in row).most_common(1)[0][0]
    for (size,xs),lines in matrix.items():
        if len(lines)<2:continue
        lines=sorted(lines,key=lambda l:l[0]['box'][1]);ys=[line[0]['box'][1] for line in lines]
        if len(set(b-a for a,b in zip(ys,ys[1:])))!=1:continue
        options=[sorted(group,key=lambda b:b['box'][0]) for (sz,y),group in groups.items() if sz==size and y not in ys and len(group)>=2]
        if len(options)!=1:continue
        active=[];questions=[]
        for row_index,line in enumerate(lines):
            rasters=[interior(rows,b['box']) for b in line]
            missing=[i for i,raster in enumerate(rasters) if all(v==background for row in raster for v in row)]
            if len(missing)!=1:continue
            missing=missing[0];surround={b['border'] for i,b in enumerate(line) if i!=missing}
            q={'row':row_index,'missing':missing,'boxes':[b['box'] for b in line],'rasters':rasters}
            questions.append(q)
            if len(surround)==1 and line[missing]['border'] not in surround:active.append(q)
        if len(active)==1:
            candidates.append({'active':active[0],'grid':[[b['box'] for b in line] for line in lines],
             'options':[{'box':b['box'],'raster':interior(rows,b['box'])} for b in options[0]],'background':background,
             'question_ref':'question:'+identity([observation['level_epoch'],active[0]['boxes']]),
             'grid_digest':identity([[interior(rows,b['box']) for b in line] for line in lines])})
    return candidates[0] if len(candidates)==1 else None
