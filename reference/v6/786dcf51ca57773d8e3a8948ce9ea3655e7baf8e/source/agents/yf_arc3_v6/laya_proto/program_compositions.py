"""Compose conditional public-program hypotheses toward an observed reduction.

The search consumes a fitted geometric grammar. It never receives a game name,
level definition, authored word or target coordinate. Its hypotheses about
boundary blocking and repeated local reduction remain explicitly falsifiable.
"""
import time
from itertools import product
from collections import Counter
from program_geometry import render_layers,decode_stacks,fit_layer_offset,fit_glyph_vectors
from observed_program_effects import translation_candidates
from terminal_composition import identity

def pixels(objects,layer):
    result=set()
    for obj in objects:
        x,y=obj['anchor'];result.update((x+a,y+b) for a,b in render_layers(obj['word'],layer['shape'],layer['step']))
    return result

def fit_composition_model(alignment,edit_before,edit_after,before_members,after_members,rows,frames,*,official_progress):
    if not official_progress or not alignment.get('candidate_roles'):return None
    rules=translation_candidates(alignment)
    if not rules:return None
    geometry=alignment['editor_geometry'];ex=[geometry['member_column'],geometry['footer']];layer=fit_layer_offset(edit_before,edit_after,before_members,after_members,rules[0]['operand_shape'],ex);glyph=fit_glyph_vectors(alignment)
    if not layer or not glyph:return None
    palette={c['color'] for c in geometry['controls']};images=[rows,*frames];word=[e['color'] for e in alignment['initial_members']];interactions=[]
    for phase in alignment['phases']:
        operator=next((o for o in glyph['operators'] if o['label']==phase['label']),None)
        if not operator or len(operator['vectors'])<2:continue
        first=decode_stacks(images[phase['start']],layer,palette,ex);last=decode_stacks(images[phase['endpoint']],layer,palette,ex);own=[o for o in first if o['word']==word]
        if len(own)!=1 or not any(o['word']==word and o['base']==own[0]['base'] for o in last):continue
        missing=[o for o in first if o is not own[0] and not any(q['base']==o['base'] for q in last)]
        if len(missing)!=1 or len(missing[0]['word'])!=1:continue
        offset=[missing[0]['base'][i]-own[0]['base'][i] for i in range(2)]
        if offset not in operator['vectors']:continue
        interactions.append({'label':operator['label'],'vectors':operator['vectors'],'observed_offset':offset,'observed_reduction':1,'status':'candidate_single_member_reduction_or_whole_object_removal','evidence':phase['evidence'],'scope':'Only one single-member object disappeared in the observed scoring execution. Repeated unit reduction is a conservative hypothesis for larger words.'})
    if len(interactions)!=1:return None
    moves=[o for o in glyph['operators'] if len(o['vectors'])==1];observed=[r['vector'] for r in rules];basis=None
    for a in observed:
        for b in observed:
            if a[0]*b[1]-a[1]*b[0]:basis=[a,b];break
        if basis:break
    if not basis:return None
    width=max(abs(v[0]) for v in observed)+1;height=max(abs(v[1]) for v in observed)+1;templates=[];background=Counter(v for row in rows for v in row).most_common(1)[0][0]
    for phase in alignment['phases']:
        motions=[t for t in phase['effect'].get('translations',[]) if t['signature']==alignment['candidate_roles'][0]['signature']]
        if len(motions)!=1:continue
        motion=motions[0]
        for frame,anchor in ((images[phase['endpoint']],motion['before']),(images[phase['start']],motion['after'])):
            point=[anchor[i]+len(word)*layer['step'][i] for i in range(2)];occupied=pixels(decode_stacks(frame,layer,palette,ex),layer);x,y=point
            if not(0<=x<=len(frame[0])-width and 0<=y<=len(frame)-height):continue
            sample=[[None if (x+a,y+b) in occupied else frame[y+b][x+a] for a in range(width)] for b in range(height)];known=[v for row in sample for v in row if v is not None]
            if len(known)<width*height/2 or set(known)=={background}:continue
            templates.append({'values':sample,'source_base':point,'source_refs':phase['evidence'],'status':'observed_survived_surface_appearance'})
    if not templates:return None
    model={'layer':layer,'glyphs':glyph,'interaction':interactions[0],'moves':moves,'basis':basis,'surface_templates':templates,'editor_geometry':geometry,'acquisition_epoch':alignment['epoch'],'command_ref':alignment['command_ref'],'evidence_refs':[alignment['before_ref'],alignment['after_ref']],'status':'conditional_program_composition_model','uncertainties':['Glyph extrapolation outside three observed translations.','Unknown interior supports are excluded, never assumed walkable.','Outside the measured lattice extent, blocking is a boundary hypothesis.','Larger-word reduction and stationary identical-label respondents are hypotheses; no universal terminal role.']};model['model_id']='program-model:'+identity(model)[:20];return model

def coordinates(point,origin,basis):
    x,y=point[0]-origin[0],point[1]-origin[1];a,b=basis;d=a[0]*b[1]-a[1]*b[0];u=x*b[1]-y*b[0];v=a[0]*y-a[1]*x
    return (u//d,v//d) if u%d==0 and v%d==0 else None

def surface(rows,model,objects,origin):
    h,w=len(rows),len(rows[0]);occupied=pixels(objects,model['layer']);accepted=set();a,b=model['basis'];ex=[model['editor_geometry']['member_column'],model['editor_geometry']['footer']]
    for u in range(-max(w,h),max(w,h)+1):
        for v in range(-max(w,h),max(w,h)+1):
            x,y=origin[0]+u*a[0]+v*b[0],origin[1]+u*a[1]+v*b[1]
            if not(0<=x<w and 0<=y<h) or any(l<=x<=r and t<=y<=bottom for l,t,r,bottom in ex):continue
            for template in model['surface_templates']:
                pattern=template['values'];th,tw=len(pattern),len(pattern[0])
                if x+tw>w or y+th>h:continue
                pairs=[(value,rows[y+j][x+i]) for j,row in enumerate(pattern) for i,value in enumerate(row) if value is not None and (x+i,y+j) not in occupied]
                if len(pairs)>=tw*th/2 and all(p==q for p,q in pairs):accepted.add((x,y));break
    accepted.update(tuple(o['base']) for o in objects);coords=[coordinates(p,origin,model['basis']) for p in accepted];coords=[p for p in coords if p is not None]
    if not coords:return None
    bounds=[[min(p[i] for p in coords),max(p[i] for p in coords)] for i in (0,1)]
    # The larger anchor patch includes a neighbouring cell at its edge. Use it
    # to delimit the measured lattice, then compare the smaller role footprint
    # inside that extent; a neighbouring hole must not erase a valid support.
    sw=max(p[0] for p in model['layer']['shape'])+1;sh=max(p[1] for p in model['layer']['shape'])+1;interiors=set()
    for t in model['surface_templates']:
        vals={v for row in t['values'][:sh] for v in row[:sw] if v is not None}
        if len(vals)==1:interiors.update(vals)
    for u in range(bounds[0][0],bounds[0][1]+1):
        for v in range(bounds[1][0],bounds[1][1]+1):
            x,y=origin[0]+u*a[0]+v*b[0],origin[1]+u*a[1]+v*b[1]
            if not(0<=x<=w-sw and 0<=y<=h-sh):continue
            values=[rows[y+j][x+i] for j in range(sh) for i in range(sw) if (x+i,y+j) not in occupied]
            if len(values)>=sw*sh/2 and len(set(values))==1 and values[0] in interiors:accepted.add((x,y))
    return {'points':[list(p) for p in sorted(accepted)],'origin':origin,'basis':model['basis'],'bounds':bounds,'scope':'Lattice extent from matched survived anchor patches; interiors from measured smaller role-support appearance. Decoded object pixels are occluded. Unmatched interior support is excluded; outside blocking remains a hypothesis.'}

def simulate_word(word,own_base,targets,model,field,max_turns):
    move={o['label']:o['vectors'][0] for o in model['moves']};interaction=model['interaction'];radius={tuple(v) for v in interaction['vectors']};pos=tuple(own_base);counts=[len(o['word']) for o in targets];safe={tuple(p) for p in field['points']};seen=set();turns=[]
    # No unobserved respondent motion is silently assumed absent.
    if any(any(label!=interaction['label'] for label in t['word']) for t in targets):return None
    for turn in range(max_turns):
        state=pos,tuple(counts)
        if state in seen:return None
        seen.add(state);steps=[]
        for label in word:
            previous=pos
            if label in move:
                d=move[label];target=pos[0]+d[0],pos[1]+d[1]
                if any(count and target==tuple(t['base']) for count,t in zip(counts,targets)):return None
                if target in safe:pos=target;why='matched_survived_surface'
                else:
                    c=coordinates(target,field['origin'],field['basis'])
                    if c is None or all(lo<=q<=hi for q,(lo,hi) in zip(c,field['bounds'])):return None
                    why='conditional_outer_boundary_blocking'
            elif label==interaction['label']:
                counts=[max(0,count-1) if (t['base'][0]-pos[0],t['base'][1]-pos[1]) in radius else count for count,t in zip(counts,targets)];why='conditional_neighbor_reduction'
            else:return None
            steps.append({'label':label,'before':list(previous),'after':list(pos),'remaining':list(counts),'reason':why})
            if not any(counts):turns.append({'steps':steps,'base':list(pos),'remaining':list(counts)});return {'turns':turns,'success':'conditional_all_observed_other_words_reduced','not_official_success':True}
        if any(count and (pos[0]-t['base'][0],pos[1]-t['base'][1]) in radius for count,t in zip(counts,targets)):return None
        turns.append({'steps':steps,'base':list(pos),'remaining':list(counts)})
    return None

def search_program(existing,own_base,targets,model,field,*,max_new_actions,deadline):
    if any(any(label!=model['interaction']['label'] for label in target['word']) for target in targets):return {'status':'unknown','reason':'unvalidated_respondent_operator','nodes':0,'plan':None}
    prefix=list(reversed(existing));labels=sorted({o['label'] for o in model['moves']}|{model['interaction']['label']});best=None;nodes=0
    for length in range(max(1,len(prefix)),len(prefix)+min(15,max_new_actions-1)+1):
        edits=length-len(prefix)
        if best and edits+1>=best['cost']:break
        for suffix in product(labels,repeat=length-len(prefix)):
            nodes+=1
            if time.perf_counter()>=deadline:return {'status':'level_deadline','nodes':nodes,'best':best}
            word=prefix+list(suffix);candidate=simulate_word(word,own_base,targets,model,field,max_new_actions-edits)
            if candidate:
                cost=edits+len(candidate['turns']);entry={'word':word,'edits':list(suffix),'cost':cost,'prediction':candidate}
                if best is None or (cost,len(word),word)<(best['cost'],len(best['word']),best['word']):best=entry
    return {'status':'proposed' if best else 'unknown','nodes':nodes,'plan':best,'scope':'Minimum external command count among enumerated prefix-preserving words under the stated conditional model; no oracle optimum or game success claim.'}
