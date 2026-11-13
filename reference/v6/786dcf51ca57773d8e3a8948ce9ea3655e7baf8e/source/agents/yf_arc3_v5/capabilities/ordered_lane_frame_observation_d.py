"""Closed frame pairs and ordered uniform square occurrences; no class decision."""
from collections import defaultdict

def box(c):return (c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right)
def inside(a,b):
    t,l,d,r=box(a);u,x,v,z=box(b);return u<t<=d<v and x<l<=r<z
def overlap(a,b):
    t,l,d,r=box(a);u,x,v,z=box(b);return not(d<u or v<t or r<x or z<l)
def measure_ordered_lane_groups(frame,components,contract):
    if (frame.width*frame.height>contract['maximum_frame_pixels'] or len(components)>contract['maximum_components']):return None
    squares=[c for c in components if c.bbox.width==c.bbox.height>=contract['minimum_occurrence_extent'] and c.area==c.bbox.width**2]
    outlines=[]
    for c in components:
        t,l,b,r=box(c)
        if r-l+1<contract['minimum_frame_width'] or b-t+1<contract['minimum_frame_height']:continue
        if (all(frame.rows[y][x]==c.value for y in (t,b) for x in range(l,r+1))
            and all(frame.rows[y][x]==c.value for x in (l,r) for y in range(t,b+1))):outlines.append(c)
    collections=[]
    def lane_rows(c):
        patches=[p for p in squares if inside(p,c)]
        if not patches:return None
        quanta=sorted({p.bbox.width for p in patches})
        if len(quanta)!=1:return None
        q=quanta[0];rows=defaultdict(list)
        for p in patches:
            if p.bbox.width==q:rows[p.bbox.top].append(p)
        ordered=[]
        for y,parts in sorted(rows.items()):
            parts.sort(key=lambda p:p.bbox.left)
            heads=[p for p in components if inside(p,c) and p.bbox.top==y
                and p.bbox.width==p.bbox.height==q and p.area<q*q
                and p.bbox.right<parts[0].bbox.left]
            if len(heads)!=1:return None
            ordered.append({'y':y,'values':tuple(p.value for p in parts),'lefts':tuple(p.bbox.left for p in parts),
                'head_box':box(heads[0]),'head_value':heads[0].value})
        return q,ordered
    for c in outlines:
        read=lane_rows(c)
        if read is not None and len(read[1])>=contract['minimum_repeated_lanes']:collections.append((c,*read))
    pairs=[]
    for i,(a,qa,ra) in enumerate(collections):
        for b,qb,rb in collections[i+1:]:
            if (a.bbox.width,a.bbox.height)==(b.bbox.width,b.bbox.height) and a.value!=b.value and qa==qb and not overlap(a,b):
                pairs.append(((a,qa,ra),(b,qb,rb)))
    if len(pairs)!=1:return None
    panels=sorted(pairs[0],key=lambda row:box(row[0]))
    queries=[]
    for c in outlines:
        if any(overlap(c,p[0]) for p in panels):continue
        read=lane_rows(c)
        if read is not None and len(read[1])==1:queries.append((c,*read))
    queries=[row for row in queries if not any(inside(row[0],other[0]) for other in queries if row is not other)]
    if len(queries)!=1:return None
    query=queries[0];buttons=[]
    for panel,q,rows in panels:
        candidates=[c for c in components if c.value==panel.value and c.area==c.bbox.width*c.bbox.height
            and c.bbox.width>c.bbox.height>=q and not overlap(c,query[0]) and not any(overlap(c,p[0]) for p in panels)]
        if len(candidates)!=1:return None
        buttons.append({'value':panel.value,'box':box(candidates[0])})
    return {'frame_groups':[{'box':box(c),'frame_value':c.value,'quantum':q,'rows':rows} for c,q,rows in panels],
        'isolated_lane':{'box':box(query[0]),'quantum':query[1],'row':query[2][0]},'matched_rectangles':buttons}

