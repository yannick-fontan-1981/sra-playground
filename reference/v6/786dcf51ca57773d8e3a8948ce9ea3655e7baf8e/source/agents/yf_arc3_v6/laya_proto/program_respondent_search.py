"""Conditional composition with observed respondent order and unresolved reductions.

Both ends of a heterogeneous word remain hypotheses until an observed reduction
distinguishes them. No game identity, palette assignment, or target word enters here.
"""
import time
from itertools import product
from program_compositions import coordinates


def simulate(word,own_base,targets,model,field,max_turns,*,removed_end,interaction_scope,access_sites=()):
    moves={m['label']:m['vectors'][0] for m in model['moves']};interaction=model['interaction'];radius={tuple(v) for v in interaction['vectors']};safe={tuple(p) for p in field['points']}
    bodies=[{'base':tuple(own_base),'word':list(reversed(word))},*[{'base':tuple(t['base']),'word':list(t['word'])} for t in targets]];turns=[];seen=set()
    for turn in range(max_turns):
        key=tuple((b['base'],tuple(b['word'])) for b in bodies)
        if key in seen:return None
        seen.add(key)
        for actor,body in enumerate(bodies):
            # Program for a bearer is read when that bearer starts its turn.
            program=list(reversed(body['word']))
            for label in program:
                if not body['word']:break
                if label in moves:
                    vector=moves[label];target=tuple(body['base'][i]+vector[i] for i in range(2))
                    if any(j!=actor and other['word'] and other['base']==target for j,other in enumerate(bodies)):return None
                    if target in safe:body['base']=target
                    else:
                        c=coordinates(target,field['origin'],field['basis'])
                        if c is None or all(lo<=q<=hi for q,(lo,hi) in zip(c,field['bounds'])):return None
                        # Blocking outside measured extent remains explicitly conditional.
                elif label==interaction['label']:
                    for j,other in enumerate(bodies):
                        if j==actor or not other['word']:continue
                        if actor and interaction_scope=='own_bearer_only' and j:continue
                        if tuple(other['base'][i]-body['base'][i] for i in range(2)) in radius:
                            if j==0:return None # Never plan through losing an own member.
                            other['word']=other['word'][1:] if removed_end=='top' else other['word'][:-1]
                else:return None
                if not any(b['word'] for b in bodies[1:]) and not access_sites:
                    turns.append({'base':list(bodies[0]['base']),'targets':[{'base':list(b['base']),'word':b['word']} for b in bodies[1:]]})
                    return turns
        turns.append({'base':list(bodies[0]['base']),'targets':[{'base':list(b['base']),'word':list(b['word'])} for b in bodies[1:]]})
        if access_sites and bodies[0]['base'] in {tuple(p) for p in access_sites}:return turns
    return None


def search(existing,own_base,targets,model,field,*,max_new_actions,deadline,max_members=None,access_sites=(),first_feasible=True):
    prefix=list(reversed(existing));labels=sorted({m['label'] for m in model['moves']}|{model['interaction']['label']});nodes=0;best=None
    hypotheses=[{'removed_end':end,'interaction_scope':scope} for end in ('top','bottom') for scope in ('own_bearer_only','all_other_bearers')]
    maximum=min(15,max_new_actions-1)
    if max_members is not None:maximum=min(maximum,max_members-len(existing))
    for extra in range(maximum+1):
        if best and extra+1>=best['cost']:break
        for suffix in product(labels,repeat=extra):
            nodes+=1
            if time.perf_counter()>=deadline:return {'status':'deadline','nodes':nodes,'best':best}
            word=prefix+list(suffix);predictions=[]
            for hypothesis in hypotheses:
                turns=simulate(word,own_base,targets,model,field,max_new_actions-extra,access_sites=access_sites,**hypothesis)
                if turns is None:break
                predictions.append({'hypothesis':hypothesis,'turns':turns})
            if len(predictions)!=len(hypotheses):continue
            cost=extra+max(len(p['turns']) for p in predictions)
            entry={'word':word,'edits':list(suffix),'cost':cost,'predictions':predictions}
            if first_feasible:return {'status':'proposed','nodes':nodes,'plan':entry,'scope':'First feasible composition under four explicit reduction/interaction hypotheses and observed bearer order. No optimum or official success is inferred.'}
            if best is None or cost<best['cost']:best=entry
    return {'status':'proposed' if best else 'unknown','nodes':nodes,'plan':best,'scope':'Robust only across the explicitly enumerated reduction/interaction hypotheses and observed bearer order. Surface extent, execution order persistence, and completeness of decoded bodies remain conditional; no official success is inferred.'}


def search_replacement(existing,own_base,targets,model,field,*,max_new_actions,deadline,max_members,access_sites=()):
    nodes=0;best=None
    for removals in range(len(existing)+1):
        if removals>=max_new_actions:break
        result=search(existing[removals:],own_base,targets,model,field,max_new_actions=max_new_actions-removals,deadline=deadline,max_members=max_members,access_sites=access_sites,first_feasible=False)
        nodes+=result['nodes']
        if result['status']=='proposed':
            result['plan']['removals']=removals;result['plan']['cost']+=removals
            if best is None or result['plan']['cost']<best['plan']['cost']:best=result
        if result['status']=='deadline':return {**result,'nodes':nodes}
    if best:return {**best,'nodes':nodes,'scope':best['scope']+' Conservative member-count hypothesis, not universal capacity. Access-site resemblance is an experiment, not a guaranteed permission.'}
    return {'status':'unknown','nodes':nodes,'plan':None,'scope':'No candidate within the conservative member-count hypothesis after top-member removals; no impossibility or universal capacity claim.'}
