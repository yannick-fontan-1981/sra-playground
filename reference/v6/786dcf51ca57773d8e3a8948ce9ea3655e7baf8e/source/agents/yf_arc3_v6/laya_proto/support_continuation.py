"""Current-mode conditional recall and mechanical suffix admission."""
import copy
from coupled_support_preparation import patch,put,inside
from terminal_composition import identity

def mode_key(aux):
    return identity([aux['epoch'],len(aux['selected_patch']),aux['floor'],aux['selected_patch']])

def scene_key(rows,aux):
    clean=[list(r)for r in rows];q=len(aux['selected_patch']);put(clean,aux['box'],[[aux['floor']]*q for _ in range(q)])
    return identity([r[1:-1]for r in clean[1:-1]])

def recall(models,aux,available):
    key=mode_key(aux);model=models.get(key);result={}
    if not model:return result
    for action,record in model['controls'].items():
        deltas={tuple(x['delta'])for x in record['witnesses']}
        if action in available and len(deltas)==1 and not record.get('counterexamples'):
            result[action]={'delta':list(next(iter(deltas))),'model_ref':key,'acquisition_epoch':model['epoch'],'evidence':[r for x in record['witnesses']for r in x['evidence']][-16:],'scope':'Same selected pattern, stride, revealed support and epoch; different occurrence is a conditional application with per-primitive falsifiers.'}
    return result

def observed_model(models,aux,action,delta,evidence,*,refutation=None):
    key=mode_key(aux);model=copy.deepcopy(models.get(key,{'epoch':aux['epoch'],'quantum':len(aux['selected_patch']),'selected_pattern_digest':identity(aux['selected_patch']),'controls':{}}))
    record=model['controls'].setdefault(action,{'witnesses':[],'counterexamples':[]})
    if refutation:record['counterexamples'].append({'evidence':evidence,'cause':'Expected effect refuted in the current geometry; control versus support cause unresolved.','detail':refutation})
    else:record['witnesses'].append({'delta':list(delta),'evidence':list(evidence),'occurrence':aux['selection_ref']})
    return {'kind':'coupled_support_control_model','model_ref':key,'model':model}

def covered(step,aux):
    action=step['action_ref'];delta=[step['to'][0]-step['from'][0],step['to'][1]-step['from'][1]]
    actual=aux.get('measured_moves',{}).get(action);prior=aux.get('recalled_moves',{}).get(action)
    return actual==delta or bool(prior and prior['delta']==delta)

def prefix(route,aux,rows,limit):
    """A new cell is not a stop criterion. Only an uncovered effect ends a set."""
    clean=[list(r)for r in rows];q=len(aux['selected_patch']);put(clean,aux['box'],[[aux['floor']]*q for _ in range(q)]);result=[]
    expected_from=aux['box']
    for original in route['path'][:limit]:
        step=copy.deepcopy(original)
        if step['from']!=expected_from or not inside(clean,step['to'])or any(v!=aux['floor']for row in patch(clean,step['to'])for v in row):break
        step['mapping_observed']=step['action_ref']in aux.get('measured_moves',{})
        step['mapping_covered']=covered(step,aux)
        step['control_provenance']='current_selected_occurrence'if step['mapping_observed']else'conditional_recall'if step['mapping_covered']else'borrowed_mapping_hypothesis'
        step['control_evidence']=aux.get('recalled_moves',{}).get(step['action_ref'],{}).get('evidence',[])
        result.append(step);expected_from=step['to']
        if not step['mapping_covered']:break
    return result

def cached_route(aux,rows):
    cached=aux.get('continuation')
    if not cached or cached['scene_key']!=scene_key(rows,aux)or patch(rows,aux['box'])!=aux['selected_patch']:return None
    route=copy.deepcopy(cached['route'])
    if route['path']and route['path'][0]['from']!=aux['box']:return None
    route['continuation_source']=cached['source_ref'];return route

def retain_suffix(aux,rows,plan,index):
    route=copy.deepcopy(plan['detail']['parking']);route['path']=route['path'][index+1:]
    aux['continuation']={'route':route,'source_ref':plan['observation_ref'],'scene_key':scene_key(rows,aux),'scope':'Same conditional parking goal and geometry, selected role preserved. No planning or SRC reconciliation inside the released prefix.'}
