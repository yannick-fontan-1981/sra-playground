"""Conditional geometric grammar from observed program phases and an edit.

All labels, masks, directions and layer offsets are data fitted from public
evidence. Extrusion and glyph linearity are explicit candidate model families.
"""
from collections import defaultdict,deque
from observed_program_effects import patch,world_parts,translation_candidates
from terminal_composition import identity

def render_layers(word,shape,step):
    result={}
    for i in reversed(range(len(word))):
        for x,y in shape:result[x+i*step[0],y+i*step[1]]=word[i]
    return result

def fit_layer_offset(before,after,before_members,after_members,shape,exclusions):
    change=len(after_members)-len(before_members)
    if abs(change)!=1 or not before_members or not after_members or before_members[0]['color']!=after_members[0]['color']:return None
    palette=before_members[0]['color'];matches=[]
    for rows in (before,after):
        matches.append([e for group in world_parts(rows,exclusions).values() for e in group if e['palette']==palette and e['mask']==shape])
    if any(len(es)!=1 for es in matches):return None
    a,b=matches[0][0]['position'],matches[1][0]['position'];growth=[(b[i]-a[i])//change for i in range(2)]
    if any((b[i]-a[i])%change for i in range(2)) or sum(v*v for v in growth)!=1:return None
    step=[-v for v in growth]
    for rows,members,entity in ((before,before_members,matches[0][0]),(after,after_members,matches[1][0])):
        x,y=entity['position'];image=render_layers([e['color'] for e in members],shape,step)
        if any(rows[y+v][x+u]!=color for (u,v),color in image.items()):return None
    return {'step':step,'shape':shape,'status':'conditional_visual_extrusion','before_anchor':a,'after_anchor':b,'member_delta':change,'same_base_hypothesis':[a[i]+len(before_members)*step[i] for i in range(2)],'scope':'Visual height correspondence fitted to a collection edit; not a physical translation law.'}

def fit_glyph_vectors(alignment):
    rules=translation_candidates(alignment);controls=alignment['editor_geometry']['controls'];bylabel={c['color']:c for c in controls};known=[]
    for r in rules:
        c=bylabel[r['label']];rows=c['patch'];holes={(x,y) for y,row in enumerate(rows) for x,v in enumerate(row) if v!=c['color']};known.append((r,c,holes))
    if len(known)<2:return None
    holes=set.intersection(*(h for _,_,h in known))
    if len(holes)<3:return None
    center=[sum(p[i] for p in holes)/len(holes) for i in range(2)]
    inks=set(v for _,c,_ in known for row in c['patch'] for v in row)
    viable=[]
    for ink in inks:
        examples=[]
        for r,c,_ in known:
            marks=[p for p in holes if c['patch'][p[1]][p[0]]==ink]
            if len(marks)!=1:break
            examples.append(([marks[0][i]-center[i] for i in range(2)],r['vector']))
        else:
            for (a,u) in examples:
                for (b,v) in examples:
                    determinant=a[0]*b[1]-a[1]*b[0]
                    if not determinant:continue
                    matrix=[[(u[j]*b[1]-v[j]*a[1])/determinant,(-u[j]*b[0]+v[j]*a[0])/determinant] for j in range(2)];matrix=[[0.0 if abs(v)<1e-12 else v for v in row] for row in matrix]
                    if all(all(abs(sum(matrix[j][i]*point[i] for i in range(2))-target[j])<1e-9 for j in range(2)) for point,target in examples):viable.append((ink,matrix))
    unique={identity(v):v for v in viable}
    if len(unique)!=1:return None
    ink,matrix=next(iter(unique.values()));operators=[]
    for c in controls:
        marks=[p for p in holes if c['patch'][p[1]][p[0]]==ink];vectors=[]
        for p in marks:
            vector=[sum(matrix[j][i]*(p[i]-center[i]) for i in range(2)) for j in range(2)]
            if any(abs(v-round(v))>1e-9 for v in vector):vectors=[];break
            vectors.append([round(v) for v in vector])
        if vectors:operators.append({'label':c['color'],'glyph_patch':c['patch'],'vectors':vectors,'status':'phase_observed_translation' if any(r['label']==c['color'] for r in rules) else 'glyph_extrapolation_candidate'})
    return {'status':'conditional_glyph_vector_map','matrix':matrix,'ink':ink,'center':center,'operators':operators,'scope':'A shared marked-position grammar fits three phase-observed displacements; other marks remain extrapolated hypotheses.'}

def decode_stacks(rows,model,palette,exclusions):
    """Decode color-agnostic connected supports fitting the measured extrusion."""
    h,w=len(rows),len(rows[0]);remaining={(x,y) for y,row in enumerate(rows) for x,color in enumerate(row) if color in palette and not any(a<=x<=c and b<=y<=d for a,b,c,d in exclusions)};regions=[]
    while remaining:
        seed=remaining.pop();group={seed};queue=[seed]
        while queue:
            x,y=queue.pop()
            for p in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if p in remaining:remaining.remove(p);group.add(p);queue.append(p)
        regions.append(group)
    shape=[tuple(p) for p in model['shape']];step=model['step'];result=[]
    for region in regions:
        x=min(p[0] for p in region);y=min(p[1] for p in region);actual={(a-x,b-y) for a,b in region}
        for count in range(1,len(region)+1):
            supports=[{(u+i*step[0],v+i*step[1]) for u,v in shape} for i in range(count)];union=set.union(*supports)
            minx=min(p[0] for p in union);miny=min(p[1] for p in union);normal={(a-minx,b-miny) for a,b in union}
            if len(normal)>len(region):break
            if normal!=actual:continue
            origin=[x-minx,y-miny];word=[]
            for i,support in enumerate(supports):
                exclusive=support-set.union(*(s for j,s in enumerate(supports) if j!=i)) if count>1 else support
                colors={rows[origin[1]+b][origin[0]+a] for a,b in exclusive}
                if len(colors)!=1:break
                word.append(next(iter(colors)))
            if len(word)!=count:continue
            image=render_layers(word,shape,step)
            if any(rows[origin[1]+b][origin[0]+a]!=color for (a,b),color in image.items()):continue
            result.append({'anchor':origin,'word':word,'base':[origin[i]+count*step[i] for i in range(2)],'binding':'measured_extruded_public_color_word'});break
    return result
