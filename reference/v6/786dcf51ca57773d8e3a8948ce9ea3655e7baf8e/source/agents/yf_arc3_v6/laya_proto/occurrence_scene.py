"""Palette-neutral occurrence hypotheses; masks retain holes and disjoint parts."""
from collections import Counter,defaultdict
from geometric_observer import components
from terminal_composition import identity

def measure(rows,observation,calibration=None):
    height,width=len(rows),len(rows[0]);parts=components(rows);background=Counter(v for row in rows for v in row).most_common(1)[0][0];outlines=[]
    for part in parts:
        x,y,r,b=part['bbox'];w,h=r-x+1,b-y+1
        if part['color']==background or min(w,h)<3:continue
        exterior={(-1,-1)};queue=[(-1,-1)]
        while queue:
            a,c=queue.pop()
            for point in ((a-1,c),(a+1,c),(a,c-1),(a,c+1)):
                u,v=point
                if -1<=u<=w and -1<=v<=h and point not in part['mask'] and point not in exterior:exterior.add(point);queue.append(point)
        interior={(a,c) for c in range(h) for a in range(w) if (a,c) not in part['mask'] and (a,c) not in exterior}
        inside={rows[y+c][x+a] for a,c in interior}
        if background in inside and inside-{background,part['color']}:outlines.append(part)
    if calibration is not None and 'outline_extent' in calibration:
        outlines=[p for p in outlines if [p['bbox'][2]-p['bbox'][0]+1,p['bbox'][3]-p['bbox'][1]+1]==calibration['outline_extent']]
    else:
        outlines=[p for p in outlines if not any(q is not p and q['bbox'][0]<p['bbox'][0] and q['bbox'][1]<p['bbox'][1] and q['bbox'][2]>p['bbox'][2] and q['bbox'][3]>p['bbox'][3] for q in outlines)]
    if calibration is None:
        if len(outlines)!=1:return None
        x,y,r,b=outlines[0]['bbox'];inner=[p for p in parts if p['color'] not in (background,outlines[0]['color']) and x<p['bbox'][0]<=p['bbox'][2]<r and y<p['bbox'][1]<=p['bbox'][3]<b]
        if not inner or len({p['color'] for p in inner})!=1:return None
        left=min(p['bbox'][0] for p in inner);top=min(p['bbox'][1] for p in inner);right=max(p['bbox'][2] for p in inner);bottom=max(p['bbox'][3] for p in inner)
        calibration={'max_width':right-left+1,'max_height':bottom-top+1,'outline_extent':[r-x+1,b-y+1],'evidence':[observation['observation_ref']],'status':'foreground_and_enclosure_extents_hypotheses_from_one_occurrence'}
    groups=defaultdict(list)
    for part in parts:
        if part['rectangular']:
            x,y,r,b=part['bbox'];groups[(y,b,r-x+1)].append(part)
    indicators=[];excluded=set()
    if 'indicator_boxes' not in calibration:
        for group in groups.values():
            group.sort(key=lambda p:p['bbox'][0])
            if len(group)>=3 and group[-1]['bbox'][2]-group[0]['bbox'][0]+1>=width/2:
                excluded.update(p['id'] for p in group);indicators.extend({'bbox':p['bbox'],'value':p['color']} for p in group)
        calibration={**calibration,'indicator_boxes':[p['bbox'] for p in indicators]}
    else:
        for box in calibration['indicator_boxes']:
            matching=[p for p in parts if p['bbox']==box and p['rectangular']]
            if len(matching)!=1:return None
            excluded.add(matching[0]['id']);indicators.append({'bbox':box,'value':matching[0]['color']})
    excluded.update(p['id'] for p in outlines);small=[]
    for p in parts:
        x,y,r,b=p['bbox']
        if p['id'] not in excluded and p['color']!=background and r-x+1<=calibration['max_width'] and b-y+1<=calibration['max_height']:small.append(p)
    pending=list(small);occurrences=[];ambiguous=[]
    while pending:
        cluster=[pending.pop(0)];changed=True
        while changed:
            changed=False
            for p in list(pending):
                if p['color']!=cluster[0]['color']:continue
                boxes=[q['bbox'] for q in [*cluster,p]];x=min(b[0] for b in boxes);y=min(b[1] for b in boxes);r=max(b[2] for b in boxes);b=max(a[3] for a in boxes)
                if r-x+1<=calibration['max_width'] and b-y+1<=calibration['max_height']:cluster.append(p);pending.remove(p);changed=True
        pixels={(p['bbox'][0]+x,p['bbox'][1]+y) for p in cluster for x,y in p['mask']};left=min(x for x,y in pixels);top=min(y for x,y in pixels);right=max(x for x,y in pixels);bottom=max(y for x,y in pixels)
        if right-left+1!=calibration['max_width'] or bottom-top+1!=calibration['max_height']:
            ambiguous.append({'bbox':[left,top,right,bottom],'reason':'outside_current_foreground_extent_hypothesis'});continue
        border={(x,y) for y in range(max(0,top-1),min(height,bottom+2)) for x in range(max(0,left-1),min(width,right+2)) if x in (left-1,right+1) or y in (top-1,bottom+1)}
        # Test the currently measured background relation; never crop a fixed HUD band.
        enclosing=[o for o in outlines if o['bbox'][0]<left and o['bbox'][1]<top and o['bbox'][2]>right and o['bbox'][3]>bottom];outline_pixels={(o['bbox'][0]+x,o['bbox'][1]+y) for o in enclosing for x,y in o['mask']}
        # Other visible background details may meet the object edge. Preserve the
        # foreground mask rather than erasing it merely because a guide is nearby.
        mask=sorted([x-left,y-top] for x,y in pixels);shape=identity([right-left+1,bottom-top+1,mask]);color=cluster[0]['color'];point=min(pixels,key=lambda p:((2*p[0]-left-right)**2+(2*p[1]-top-bottom)**2,p))
        marked=bool(enclosing)
        value={'bbox':[left,top,right,bottom],'mask':mask,'shape':shape,'color':color,'point':list(point),'marked':marked};value['id']='occurrence:'+identity([observation['observation_ref'],value])[:24];occurrences.append(value)
    occurrences.sort(key=lambda o:o['bbox']);indicators.sort(key=lambda o:o['bbox'])
    scene={'occurrences':occurrences,'indicators':indicators,'background':background,'calibration':calibration,'unknowns':ambiguous,'source_ref':observation['observation_ref'],'epoch':observation['level_epoch']}
    scene['key']=identity([scene['epoch'],[(o['shape'],o['color'],o['bbox']) for o in occurrences],indicators]);return scene

def candidates(scene,context,seen,relation,comparison):
    if context is None:return []
    previous=context['previous']['occurrences'];chosen=context['chosen']
    references=previous if relation=='previous_all' else [o for o in previous if o['id']==chosen] if relation=='previous_chosen' else [o for o in previous if o['id']!=chosen] if relation=='previous_unchosen' else seen
    return [o['id'] for o in scene['occurrences'] if any(o['shape']==p['shape'] and (comparison=='exact_mask' or o['color']==p['color']) for p in references)]

def context_scope(context):return 'singleton_antecedent' if len(context['previous']['occurrences'])==1 else 'plural_antecedent'
