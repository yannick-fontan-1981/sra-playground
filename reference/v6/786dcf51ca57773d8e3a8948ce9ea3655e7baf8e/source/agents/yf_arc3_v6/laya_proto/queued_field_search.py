"""Bounded composition enumeration over measured controls and V5 projections."""
from collections import deque
from functools import lru_cache
import time
from queued_field_methods import placement,closure,models
from queued_field_observation import board
from queued_field_models import translation_premise


def preparations(bundle,column,controls,width,field=None,active_rows=(),state=None):
    start=(tuple(bundle),column);queue=deque([(start,[])]);seen={start};result=[]
    while queue:
        (values,x),path=queue.popleft();result.append((list(values),x,path))
        for action,law in sorted(controls.items()):
            if law['kind']=='translate':
                dest=x+law['delta'];new=(values,dest)
                if field is not None and 0<=dest<width and any(field[y][dest]is not None for y in active_rows):continue
                if state and any(r['premise_ref']==translation_premise(state['key'],field,values,x,action)for r in state.get('refuted_translations',[])):continue
            elif law['kind']=='reorder'and len(law['permutations'])==1:new=(tuple(values[i]for i in law['permutations'][0]),x)
            else:continue
            if 0<=new[1]<width and new not in seen:
                seen.add(new);queue.append((new,path+[{'action_ref':action}]))
    return result


def choose(scene,state,remaining,deadline,node_bound=24000,depth_bound=3):
    if state.get('closure_incompatible'):return None
    empty=state['empty'];initial=board(scene,empty);mark=scene['mark'];controls=state['controls'];gravity=state['gravity']
    drops=[a for a,v in controls.items()if v['kind']=='receive']
    if len(drops)!=1:return None
    hypotheses=state.get('closure_models')or models(scene['geometry']['shape'],gravity)
    previews=[p['members']for p in scene['preview_alternatives']if p['orientation']in state.get('preview_orientations',[])]
    previews=previews or [[]];depth=min(depth_bound,1+min(map(len,previews)));nodes=0;bounded=False
    roots=[]
    for values,column,path in preparations(mark['values'],mark['column'],controls,scene['geometry']['shape'][0],initial,mark['rows'],state):
        actions=path+[{'action_ref':drops[0]}]
        if len(actions)>min(16,remaining):continue
        if any(r['board']==initial and r['bundle']==values and r['column']==column for r in state.get('restorations',[])):continue
        placed=placement(initial,values,column,gravity)
        if placed is not None:roots.append((values,column,actions,placed))
    if not roots:return None
    @lru_cache(None)
    def project(grid,bundle,column,model_index):
        nonlocal nodes,bounded
        if nodes>=node_bound or time.perf_counter()>=deadline:
            bounded=True;return None
        nodes+=1;p=placement(grid,bundle,column,gravity)
        return closure(p,hypotheses[model_index])if p is not None else None
    @lru_cache(None)
    def future(grid,queue,left,model_index,budget):
        if left<=0 or not queue or budget<=0:return 0
        best=0;values=queue[0];origin=state.get('spawn_column_observed',mark['column'])
        if any(grid[y][origin]is not None for y in mark['rows']):return 0
        for ordered,col,path in preparations(values,origin,controls,scene['geometry']['shape'][0],grid,mark['rows'],state):
            cost=len(path)+1
            if cost>budget:continue
            out=project(grid,tuple(ordered),col,model_index)
            if out is None:continue
            score=out['removed']+future(tuple(map(tuple,out['board'])),queue[1:],left-1,model_index,budget-cost)
            best=max(best,score)
        return best
    offers=[]
    for values,col,actions,placed in roots:
        outcomes=[];scores=[]
        for mi,model in enumerate(hypotheses):
            out=project(tuple(map(tuple,initial)),tuple(values),col,mi)
            if out is None:continue
            outcomes.append(out)
            for q in previews:
                score=out['removed']+future(tuple(map(tuple,out['board'])),tuple(map(tuple,q)),depth-1,mi,remaining-len(actions))
                scores.append(score)
        if len(outcomes)!=len(hypotheses):continue
        if state.get('closure_models'):
            rank=(min(scores),sum(scores)/len(scores),-len(actions))
        else:
            rank=(sum(x['removed']>0 for x in outcomes),sum(x['removed']for x in outcomes),-len(actions))
        offers.append((rank,values,col,actions,placed,outcomes))
    if not offers:return None
    rank,values,col,actions,placed,outcomes=max(offers,key=lambda x:x[0])
    return {'actions':actions,'bundle':values,'column':col,'placed':placed,'outcomes':outcomes,'model_alternatives':hypotheses,
            'rank':rank,'nodes':nodes,'node_bound':node_bound,'depth_bound':depth,'bounded':bounded,
            'scope':'Finite conditional queue contribution estimate, not a terminal solution certificate. Unknown line predicates remain alternatives. Future queue/spawn readings are revalidated after each receipt.'}
