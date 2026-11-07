"""Observed input-bearing support appearance, without a prescribed tile role."""
from observed_program_effects import patch
from program_respondent_observations import full_match


def learn_input_support(plan,before_rows,frames):
    if not frames or not plan.get('own_prediction') or not plan.get('prepared_word'):return None
    model=plan['model'];owner=plan['own_prediction']['object'];origin=owner['base'];word=owner['word'];controls=plan['layout']['controls']
    if not all(patch(before_rows,c['bbox'])==c['patch'] for c in controls):return None
    if not full_match(frames[-1],model,origin,word) or not all(patch(frames[-1],c['bbox'])==c['patch'] for c in controls):return None
    width=max(p[0] for p in model['layer']['shape'])+1;height=max(p[1] for p in model['layer']['shape'])+1
    for index,rows in enumerate(frames):
        if full_match(rows,model,plan['own_prediction']['expected_first_base'],word) and not full_match(rows,model,origin,word) and not all(patch(rows,c['bbox'])==c['patch'] for c in controls):
            box=[origin[0],origin[1],origin[0]+width-1,origin[1]+height-1]
            if box[2]>=len(rows[0]) or box[3]>=len(rows):return None
            return {'pattern':patch(rows,box),'origin':origin,'visible_after_departure_frame':index,'input_evidence':'Controls present before; absent after departure; reappear on measured return. Causal sufficiency at another matching support remains hypothetical.','status':'conditional_input_access_support'}
    return None


def candidate_sites(rows,field,support,origin):
    pattern=support['pattern'];height=len(pattern);width=len(pattern[0]);sites=[]
    for point in field['points']:
        x,y=point
        if point==origin or x<0 or y<0 or x+width>len(rows[0]) or y+height>len(rows):continue
        if patch(rows,[x,y,x+width-1,y+height-1])==pattern:sites.append(point)
    return sites
