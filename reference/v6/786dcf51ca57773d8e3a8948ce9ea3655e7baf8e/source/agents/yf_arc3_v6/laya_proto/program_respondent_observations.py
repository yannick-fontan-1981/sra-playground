"""Local public word supports, including later revealed raster-edge occlusion.

No editor appearance or future result is used as an execution permission.
The retrospective revealed-word hypotheses remain distinguished from predictions.
"""
from program_geometry import render_layers,decode_stacks


def support_match(rows,model,base,word):
    step=model['layer']['step'];anchor=[base[i]-len(word)*step[i] for i in range(2)]
    image=render_layers(word,model['layer']['shape'],step);visible=matched=0
    for (x,y),color in image.items():
        x+=anchor[0];y+=anchor[1]
        if 0<=y<len(rows) and 0<=x<len(rows[0]):
            visible+=1;matched+=rows[y][x]==color
    return {'visible':visible,'hidden':len(image)-visible,'matched':matched,'matches':bool(visible) and visible==matched}


def full_match(rows,model,base,word):
    result=support_match(rows,model,base,word)
    return result['matches'] and result['hidden']==0


def observe_respondent_packet(plan,before_rows,frames,*,same_epoch):
    if not same_epoch:return {'status':'unknown','reason':'epoch_boundary_excludes_cross_level_attribution','results':[],'revealed_candidates':[]}
    model=plan['model'];candidates=[*plan['candidates'],*([plan['own_prediction']] if plan.get('own_prediction') else [])];results=[]
    for candidate in candidates:
        obj=candidate['object'];hits=[];stationary=[]
        for i,rows in enumerate(frames):
            old=full_match(rows,model,obj['base'],obj['word']);new=full_match(rows,model,candidate['expected_first_base'],obj['word'])
            if new and not old:hits.append(i)
            elif old:stationary.append(i)
        results.append({'candidate':candidate,'status':'predicted_local_translation_witnessed' if hits else 'stationary_support_observed' if stationary else 'unknown_support','matching_packet_indices':hits,'stationary_packet_indices':stationary,'universal_rule_confirmed':False})
    g=model['editor_geometry'];palette={c['color'] for c in g['controls']};exclusions=[g['member_column'],g['footer']]
    initial=decode_stacks(before_rows,model['layer'],palette,exclusions);initial_words={tuple(o['word']) for o in initial};seen=set();revealed=[]
    for i,rows in enumerate(frames):
        for obj in decode_stacks(rows,model['layer'],palette,exclusions):
            key=tuple(obj['word'])
            if key in initial_words or key in seen:continue
            seen.add(key);compatible=[]
            for move in model['moves']:
                if move['label'] not in obj['word']:continue
                for vector in move['vectors']:
                    prior=[obj['base'][j]-vector[j] for j in range(2)]
                    before=support_match(before_rows,model,prior,obj['word'])
                    adjacent=support_match(frames[i-1],model,prior,obj['word']) if i else before
                    after=support_match(rows,model,prior,obj['word'])
                    if before['matches'] and before['hidden'] and adjacent['matches'] and not after['matches']:
                        compatible.append({'operator':move['label'],'vector':vector,'prior_base':prior,'initial_support':before,'preceding_support':adjacent,'source_status':move['status']})
            revealed.append({'object':obj,'first_complete_packet_index':i,'compatible_retroprojections':compatible,'status':'revealed_translation_hypothesis' if compatible else 'new_unexplained_word','prospective_prediction':False})
    return {'status':'observed','results':results,'revealed_candidates':revealed,'scope':'Exact local word supports within the same official epoch. Editor changes do not invalidate spatial supports. A revealed word is retrospective evidence, not a prior forecast; other hidden objects and universal interaction laws remain unknown.'}
