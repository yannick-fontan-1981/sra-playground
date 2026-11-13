"""Retain controls and alternative closure models from public phase packets."""
from itertools import permutations
from copy import deepcopy
from queued_field_observation import measure,board
from queued_field_methods import placement,closure,models
from terminal_composition import identity

def translation_premise(key,field,members,column,action):
    return identity([key,field,list(members),column,action])

def active_member_count(state):
    if not state:return None
    values={len(p)for law in state.get('controls',{}).values()if law['kind']=='reorder'for p in law['permutations']}
    if state.get('active_member_count')is not None:values.add(state['active_member_count'])
    return next(iter(values))if len(values)==1 else None

def portable_hypothesis(previous,scene,observation):
    """Instantiate prior value-independent relations on a new measured field.

    This does not import a board, pose, queue contents, refuted site or permission.
    """
    if not previous or previous['epoch']==observation['level_epoch']or not scene['mark']:return None
    count=active_member_count(previous)
    if count is None or count!=len(scene['mark']['values']):return None
    if any(previous['geometry'][k]!=scene['geometry'][k]for k in('size','pitch')):return None
    if not previous.get('closure_models')or scene['empty_appearance_hypothesis']is None:return None
    controls={a:{**deepcopy(law),'acquisition_epoch':law.get('acquisition_epoch',previous['epoch']),'status':'portable_hypothesis_pending_revalidation'}for a,law in previous['controls'].items()if a in observation['available_action_refs']}
    if not any(v['kind']=='receive'for v in controls.values()):return None
    return {'key':identity([observation['level_epoch'],scene['geometry']]),'epoch':observation['level_epoch'],'geometry':scene['geometry'],
            'controls':controls,'gravity':previous['gravity'],'empty':scene['empty_appearance_hypothesis'],'active_member_count':count,
            'closure_models':deepcopy(previous['closure_models']),'closure_status':'portable_hypotheses_pending_current_receipt',
            'closure_acquisition_epoch':previous.get('closure_acquisition_epoch',previous['epoch']),
            'preview_orientations':deepcopy(previous.get('preview_orientations',[])),
            'evidence':list(previous['evidence'])+[observation['observation_ref']],
            'restorations':[],'attempts':[],'refuted_translations':[],
            'transfer_scope':{'source_epoch':previous['epoch'],'current_epoch':observation['level_epoch'],
                'source_relation_digest':identity([previous['controls'],previous['closure_models']]),
                'premises':['same measured cell size and pitch','same controlled member cardinality','currently available input','current field and preview measured again'],
                'authority':'conditional prediction to revalidate; no board, coordinates or terminal quota transferred'}}


def acquire(previous,before,after,command,rows,later,frames):
    prior=previous if previous and previous.get('epoch')==before['level_epoch']else None
    count=active_member_count(prior);a=measure(rows,prior['geometry']if prior else None,count);b=measure(later,a['geometry'],count or(len(a['mark']['values'])if a and a['mark']else None))if a else None
    if not a or not a['mark']or not a['preview_alternatives']:return None
    epoch=before['level_epoch'];key=identity([epoch,a['geometry']]);state=dict(previous or {})
    if state.get('key')!=key:
        prior={k:state[k]for k in('controls','gravity','closure_models','preview_orientations')if k in state}
        state={'key':key,'epoch':epoch,'geometry':a['geometry'],'controls':{},'evidence':[],'prior_hypotheses':prior,'restorations':[],'attempts':[],'refuted_translations':[]}
    state['evidence']=list(state['evidence'])+[before['observation_ref'],after['observation_ref']]
    state['controls']=dict(state['controls']);state['restorations']=list(state['restorations'])
    empty=state.get('empty',a['empty_appearance_hypothesis'])
    if empty is None:return state
    initial=board(a,empty);mark=a['mark'];action=command['action_ref'];phases=[measure(f,a['geometry'],len(mark['values']))for f in frames]
    state['attempts']=list(state.get('attempts',[]))+[identity([a['grid'],mark['column'],command])]
    receipts=[]
    for g in(-1,1):
        placed=placement(initial,mark['values'],mark['column'],g)
        if placed is None:continue
        for i,p in enumerate(phases):
            if p and not p['mark'] and p['grid']==[[empty if v is None else v for v in r]for r in placed]:
                receipts.append((g,i,placed));break
    if len(receipts)==1:
        g,index,placed=receipts[0];state['gravity']=g;state['empty']=empty;state['active_member_count']=len(mark['values']);state['controls'][action]={'kind':'receive','phase_index':index,'evidence':[before['observation_ref'],after['observation_ref']]}
        if b and b['mark'] and after['level_epoch']==epoch:
            final=board(b,empty)
            candidates=state.get('closure_models',models(a['geometry']['shape'],g))
            fitting=[m for m in candidates if closure(placed,m)['board']==final]
            preview=[p['orientation']for p in a['preview_alternatives']if p['members']and p['members'][0]==b['mark']['values']and any(q['orientation']==p['orientation']and q['members']==p['members'][1:]for q in b['preview_alternatives'])]
            # A reset-like return must not be explained as a removal law.
            returned=initial==final and a['preview_alternatives']==b['preview_alternatives']
            if not returned and state.get('closure_models'):
                eliminated=[m for m in candidates if m not in fitting]
                if eliminated:
                    state['closure_counterexamples']=list(state.get('closure_counterexamples',[]))+[{'model_refs':[identity(m)for m in eliminated],'evidence':[before['observation_ref'],after['observation_ref']],'source_epoch':state.get('closure_acquisition_epoch',epoch),'current_epoch':epoch}]
                if not fitting:
                    fitting=[m for m in models(a['geometry']['shape'],g)if closure(placed,m)['board']==final]
                    state['closure_models']=fitting;state['closure_acquisition_epoch']=epoch
                    state['closure_incompatible']=not bool(fitting)
                    state['closure_status']='current_reconstruction_after_refutation'if fitting else'no_library_closure_explains_current_receipt'
            if returned or not fitting:
                state['restorations'].append({'board':initial,'bundle':mark['values'],'column':mark['column'],'returned_to_prior_field':returned,'evidence':[before['observation_ref'],after['observation_ref']]})
            else:
                state['closure_models']=fitting;state['closure_status']='compatible_public_closure_models';state['last_removed']=len(mark['values'])+sum(v is not None for r in initial for v in r)-sum(v is not None for r in final for v in r)
                state.setdefault('closure_acquisition_epoch',epoch)
                state['spawn_column_observed']=b['mark']['column']
                if preview:state['preview_orientations']=preview
        state['last_transition']='received_then_automatic_or_return_unknown'
    elif b and b['mark']and after['level_epoch']==epoch and len(frames)<=1 and board(b,empty)==initial:
        first=mark['values'];second=b['mark']['values'];dx=b['mark']['column']-mark['column']
        old=state['controls'].get(action)
        if old and old['kind']=='translate'and not dx and a['grid']==b['grid']:
            premise=translation_premise(key,initial,first,mark['column'],action)
            state['refuted_translations']=list(state.get('refuted_translations',[]))+[{'premise_ref':premise,'evidence':[before['observation_ref'],after['observation_ref']],'scope':'Same epoch, measured field, ordered members, origin and input; stationarity refutes this displacement prediction, not all mechanisms of contact.'}]
        if first==second and dx:
            vacated=[b['grid'][j][mark['column']]for j in mark['rows']]
            if len(set(vacated))==1 and vacated[0]==empty:
                state['empty']=empty;state['controls'][action]={'kind':'translate','delta':dx,'evidence':[before['observation_ref'],after['observation_ref']]}
                state['active_member_count']=len(mark['values'])
        elif not dx and first!=second and sorted(first)==sorted(second):
            possible=[list(p)for p in permutations(range(len(first)))if [first[i]for i in p]==second]
            old=state['controls'].get(action)
            if old and old.get('kind')=='reorder':possible=[p for p in possible if p in old['permutations']]
            state['controls'][action]={'kind':'reorder','permutations':possible,'evidence':[before['observation_ref'],after['observation_ref']]}
        state['last_transition']='single_public_preparation'
    else:state['last_transition']='unexplained_or_boundary'
    if action in state['controls'] and state['controls'][action].get('evidence')==[before['observation_ref'],after['observation_ref']]:
        law=state['controls'][action];old=(previous or{}).get('controls',{}).get(action,{})
        law['acquisition_epoch']=old.get('acquisition_epoch',epoch);law['revalidated_epoch']=epoch;law['status']='observed_current_relation'
        contradicted=bool(old)and(old['kind']!=law['kind']or(law['kind']=='translate'and old.get('delta')!=law.get('delta'))or(law['kind']=='reorder'and not law.get('permutations')))
        if contradicted:
            state['control_counterexamples']=list(state.get('control_counterexamples',[]))+[{'action':action,'prior_relation':old,'observed_relation':dict(law),'evidence':[before['observation_ref'],after['observation_ref']]}]
            if law['kind']=='reorder'and not law.get('permutations'):law['status']='refuted_current'
    if state.get('transfer_scope'):
        state['transfer_scope']={**state['transfer_scope'],'last_current_observation':after['observation_ref'],'last_revalidation':state['last_transition']}
    return state
