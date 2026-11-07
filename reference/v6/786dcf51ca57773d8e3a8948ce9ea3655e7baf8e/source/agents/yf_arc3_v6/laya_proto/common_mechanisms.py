"""Game-neutral mechanical models and a bounded, open empirical-rule path.

Inputs are public symbolic measurements, never roles or a puzzle solution.
Compatibility is not causal proof. Translation rules use variables, measured
shape predicates and spatial relations. Acquisition requires a frozen prediction
confirmed on an independent transition at different variable positions.
This module neither chooses a game action nor grants SRC release authority.
"""
from __future__ import annotations
import copy
import hashlib
import json
import math
from collections import defaultdict

SCHEMA='prototype.common_mechanisms.v1'
MAX_ENTITIES=512
MAX_PAIRS=128
MAX_SUPPORT_POINTS=65536
FORBIDDEN={'game_id','game_name','planner','planner_name','oracle','oracle_path','goal','goals','solution','winning_route'}

def _pack(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def _digest(value):return hashlib.sha256(_pack(value).encode()).hexdigest()

def _check(before,after,action):
    for value in (before,after,action):
        if FORBIDDEN&value.keys():raise ValueError('Non-neutral input fields: '+str(sorted(FORBIDDEN&value.keys())))
    if not action.get('action_ref'):raise ValueError('Action requires its observed public action_ref')
    for obs in (before,after):
        if not isinstance(obs.get('entities'),list):raise ValueError('Observation requires neutral entities')
        if len(obs['entities'])>MAX_ENTITIES:raise ValueError('Neutral entity measurement domain exceeded')
        for e in obs['entities']:
            if FORBIDDEN&e.keys():raise ValueError('Semantic role/solution fields excluded from entities')
            pos=e.get('position',e.get('pose'))
            if not isinstance(pos,(list,tuple)) or len(pos)!=2 or not all(isinstance(x,(int,float)) and math.isfinite(x) for x in pos):raise ValueError('Entity requires finite measured position')
            if 'signature' not in e:raise ValueError('Entity requires a measured signature')

def _ref(obs):
    if obs.get('observation_ref'):return str(obs['observation_ref'])
    if not obs.get('frame_hash') or 'revision' not in obs:raise ValueError('Observation provenance absent')
    return f"observation:{obs.get('level_epoch','unknown')}:{obs['revision']}:{obs['frame_hash']}"

def _evidence(before,after,action):
    refs=[_ref(before),_ref(after)]
    if refs[0]==refs[1]:raise ValueError('Before and after must be distinct observation events')
    return {'before':refs[0],'after':refs[1],'action':copy.deepcopy(action),'transition_ref':_digest([refs,action])}

def _position(e):return tuple(e.get('position',e.get('pose')))
def _signature(e):return _pack(e['signature'])

def _support(e):
    if 'support' in e:points={tuple(p) for p in e['support']}
    elif 'mask' in e:
        x,y=_position(e);points={(x+p[0],y+p[1]) for p in e['mask']}
    else:return None
    if len(points)>MAX_SUPPORT_POINTS:raise ValueError('Exact support measurement domain exceeded')
    return points

def _neutral_entity(e):
    value={'signature':copy.deepcopy(e['signature']),'position':list(_position(e))}
    for key in ('area','scale','palette_value'):
        if key in e:value[key]=e[key]
    support=_support(e)
    if support is not None:
        x,y=_position(e);value['mask']=sorted([px-x,py-y] for px,py in support)
    return value

def _state(obs):
    return {'coordinate_basis':obs.get('coordinate_basis','unknown'),
        'entities':sorted((_neutral_entity(e) for e in obs['entities']),key=_pack),
        'metadata':{k:copy.deepcopy(obs[k]) for k in ('level_epoch','state','levels_completed','available_action_refs','context_scope') if k in obs}}

def _conditions(obs,action):
    # A literal transition record is useful evidence, but can never be promoted
    # to a mechanism. Hashes belong exclusively to provenance/identification.
    return {'observed_features':_state(obs),'action':copy.deepcopy(action)}

def _matching(before,after):
    left=defaultdict(list);right=defaultdict(list)
    for e in before['entities']:left[_signature(e)].append(e)
    for e in after['entities']:right[_signature(e)].append(e)
    matched=[];unresolved=[]
    for sig in sorted(set(left)|set(right)):
        a,b=left[sig],right[sig]
        if len(a)==len(b)==1:matched.append((a[0],b[0]))
        else:unresolved.append({'signature_digest':_digest(sig),'before_count':len(a),'after_count':len(b),'reason':'identity_not_unique_or_signature_changed'})
    return matched,unresolved

def _translated(points,delta):return {(x+delta[0],y+delta[1]) for x,y in points}

def _swept(points,delta):
    dx,dy=delta
    if not isinstance(dx,int) or not isinstance(dy,int):return None
    count=math.gcd(abs(dx),abs(dy))
    if not count:return set()
    if count>1024:return None
    step=(dx//count,dy//count)
    return set().union(*(_translated(points,(step[0]*i,step[1]*i)) for i in range(1,count+1)))

def _model(name,status,evidence,**fields):
    return {'model':name,'status':status,'evidence_refs':[evidence['before'],evidence['after']],
        'predictive_use_allowed':False,**fields}

def _library(before,after,action,prior_rules,evidence):
    compatible=[];refuted=[];unknown=[]
    if before.get('coordinate_basis')!=after.get('coordinate_basis') or before.get('coordinate_basis') is None:
        return {'status':'unknown','compatible':[],'refuted':[],'unknown':[_model('rigid_translation','unknown',evidence,reason='coordinate_basis_not_bound')],'domain_complete':False}
    pairs,unresolved=_matching(before,after);motions=[]
    for a,b in pairs:
        pa,pb=_position(a),_position(b);delta=(pb[0]-pa[0],pb[1]-pa[1]);sa,sb=_support(a),_support(b)
        exact=sa is not None and sb is not None
        rigid=not exact or _translated(sa,delta)==sb
        item={'entity_ref':a.get('id'), 'signature':a['signature'],'delta':list(delta),'exact_support_checked':exact}
        if not rigid:refuted.append(_model('rigid_translation','refuted',evidence,**item,reason='translated_support_differs_from_observation'))
        elif delta==(0,0):
            refuted.append(_model('nonzero_translation','refuted',evidence,**item,reason='observed_stationary'))
            unknown.append(_model('blocked_motion','unknown',evidence,**item,reason='stationarity_alone_does_not_identify_control_intent_or_contact'))
        else:compatible.append(_model('rigid_translation','compatible',evidence,**item,uncertainty=['action_association_not_causal_proof','camera_or_joint_motion_not_excluded']+([] if exact else ['exact_shape_support_missing'])))
        motions.append((a,b,delta,sa,sb,rigid))
    examined=0
    for a,b,delta,sa,sb,rigid in motions:
        if delta==(0,0) or not rigid:continue
        for c,d,other,sc,sd,other_rigid in motions:
            if a is c:continue
            if examined>=MAX_PAIRS:break
            examined+=1;refs={'driver_ref':a.get('id'),'other_ref':c.get('id')}
            if sa is None or sc is None:
                unknown.append(_model('contact_push','unknown',evidence,**refs,reason='exact_support_required; bounding_boxes_do_not_establish_contact'));continue
            swept=_swept(sa,delta)
            if swept is None:
                unknown.append(_model('contact_push','unknown',evidence,**refs,reason='sweep_domain_not_established'));continue
            contact=bool(swept&sc) and not bool(sa&sc)
            if contact and delta==other and other_rigid:
                compatible.append(_model('contact_push','compatible',evidence,**refs,delta=list(delta),contact_checked=True,uncertainty=['coordinated_motion_remains_an_alternative','driver_control_not_assigned_by_geometry']))
            else:refuted.append(_model('contact_push','refuted',evidence,**refs,reason='no_initial_swept_contact' if not contact else 'contacted_support_did_not_share_translation'))
    # A failed previously acquired prediction is a counterexample. It is not
    # automatically renamed "blocked": contact and intent still need evidence.
    for rule in prior_rules:
        if rule.get('status')!='mechanism_acquired':continue
        prediction=apply_empirical_rule(rule,before,action)
        if prediction.get('status')=='prediction' and not _prediction_matches(prediction,after):
            stationary=[m for m in motions if m[2]==(0,0)]
            blocked=[]
            for expected in prediction['predicted_entities']:
                for a,b,delta,sa,sb,rigid in stationary:
                    if a['signature']!=expected['entity']['signature'] or sa is None:continue
                    intended=tuple(expected['entity']['position'][i]-_position(a)[i] for i in (0,1));swept=_swept(sa,intended)
                    if not swept:continue
                    for c,d,other,sc,sd,other_rigid in stationary:
                        if c is a or sc is None:continue
                        if swept&sc and not sa&sc:blocked.append({'subject':a.get('id'),'contact_support':c.get('id'),'attempted_delta':list(intended)})
            if blocked:compatible.append(_model('blocked_motion','compatible',evidence,contacts=blocked,refuted_rule=rule['rule_id'],uncertainty=['contact_correlates_with_failed_calibrated_motion','unobserved_control_or_mode_change_not_excluded']))
            else:unknown.append(_model('blocked_motion','unknown',evidence,stationary_entities=[m[0].get('id') for m in stationary],refuted_rule=rule['rule_id'],reason='failed_prediction_without_established_contact_is_not_blocking_proof'))
    return {'status':'compatible' if compatible else 'no_compatible_candidate' if pairs else 'unknown',
        'compatible':compatible,'refuted':refuted,'unknown':unknown,'unresolved_correspondences':unresolved,
        'domain_complete':examined<MAX_PAIRS,'pair_candidates_examined':examined,
        'absence_meaning':'no compatible catalog model is not impossibility; empirical construction remains open'}

def _effect(before,after):
    a,b=_state(before),_state(after);used=set();updates=[];removed=[]
    for index,old in enumerate(a['entities']):
        matches=[i for i,new in enumerate(b['entities']) if i not in used and new['signature']==old['signature'] and {k:v for k,v in new.items() if k!='position'}=={k:v for k,v in old.items() if k!='position'}]
        if len(matches)==1:
            j=matches[0];used.add(j);new=b['entities'][j];delta=[new['position'][i]-old['position'][i] for i in (0,1)]
            if delta!=[0,0]:updates.append({'before_index':index,'translation':delta})
        else:removed.append(index)
    return {'entity_translations':updates,'remove_indices':removed,'add_entities':[copy.deepcopy(e) for i,e in enumerate(b['entities']) if i not in used],
        'metadata_after':b['metadata'],'coordinate_basis_after':b['coordinate_basis']}

def _apply_effect(state,effect):
    out=copy.deepcopy(state);removed=set(effect['remove_indices']);entities=[]
    moves={u['before_index']:u['translation'] for u in effect['entity_translations']}
    for i,entity in enumerate(out['entities']):
        if i in removed:continue
        if i in moves:entity['position']=[entity['position'][j]+moves[i][j] for j in (0,1)]
        entities.append(entity)
    entities.extend(copy.deepcopy(effect['add_entities']));out['entities']=sorted(entities,key=_pack)
    out['metadata']=copy.deepcopy(effect['metadata_after']);out['coordinate_basis']=effect['coordinate_basis_after'];return out

def _shape(entity):return {k:v for k,v in _neutral_entity(entity).items() if k!='position'}

def _bind_variables(conditions,observation,action):
    if conditions['action']!=action or conditions['coordinate_basis']!=observation.get('coordinate_basis'):return None
    mode={k:observation.get(k) for k in conditions['observable_mode']}
    if mode!=conditions['observable_mode']:return None
    bindings={}
    for variable in conditions['variables']:
        matches=[e for e in observation['entities'] if _shape(e)==variable['measured_shape']]
        if len(matches)!=1:return None
        bindings[variable['name']]=matches[0]
    for relation in conditions['relations']:
        a,b=_support(bindings[relation['left']]),_support(bindings[relation['right']])
        if a is None or b is None or bool(a&b)!=relation['overlap']:return None
    return bindings

def _position_context(bindings):return {k:list(_position(e)) for k,e in sorted(bindings.items())}

def construct_empirical_rule(before,after,action):
    """Induce an operational translation relation; retain other deltas as evidence.

    Positions are variables, never lookup keys. Unsupported state changes remain
    empirical_transition_candidate: generalized induction for them is incomplete.
    """
    _check(before,after,action);evidence=_evidence(before,after,action);pairs,unresolved=_matching(before,after)
    rigid=[]
    for a,b in pairs:
        delta=[_position(b)[i]-_position(a)[i] for i in (0,1)];sa,sb=_support(a),_support(b)
        if _shape(a)==_shape(b) and (sa is None or sb is None or _translated(sa,delta)==sb):rigid.append((a,b,delta))
    structural=any(delta!=[0,0] for a,b,delta in rigid) and len(rigid)<=32 and before.get('coordinate_basis')==after.get('coordinate_basis') and before.get('coordinate_basis') is not None
    if structural:
        variables=[{'name':f'v{i}','measured_shape':_shape(a),'unique':True} for i,(a,b,delta) in enumerate(rigid)]
        relations=[]
        for i,(a,b,delta) in enumerate(rigid):
            for j,(c,d,other) in enumerate(rigid[:i]):
                sa,sc=_support(a),_support(c)
                if sa is not None and sc is not None:relations.append({'left':f'v{i}','right':f'v{j}','overlap':bool(sa&sc)})
        conditions={'action':copy.deepcopy(action),'coordinate_basis':before['coordinate_basis'],'variables':variables,'relations':relations,
            'observable_mode':{k:copy.deepcopy(before[k]) for k in ('state','level_epoch','available_action_refs','context_scope') if k in before}}
        effect={'variable_translations':{f'v{i}':delta for i,(a,b,delta) in enumerate(rigid)}}
        evidence['position_context']={f'v{i}':list(_position(a)) for i,(a,b,delta) in enumerate(rigid)}
        kind='translation_relation';status='candidate';exact=all(_support(a) is not None and _support(b) is not None for a,b,delta in rigid)
        scope={'kind':'measured_shape_action_and_spatial_relation_conditions','position_generalization':'requires_independent_changed_position_confirmation','mode':conditions['observable_mode'],'exact_support_measured':exact,'unmodeled_before_entities':len(before['entities'])-len(rigid),'unresolved_correspondences':len(unresolved)}
    else:
        conditions=_conditions(before,action);effect=_effect(before,after);kind='observed_transition';status='empirical_transition_candidate'
        if _apply_effect(_state(before),effect)!=_state(after):raise ValueError('Observed transition delta does not reproduce supplied evidence')
        scope={'kind':'literal_observed_features_only','generalized_mechanism_construction':'not_implemented_for_this_effect','predictive_acquisition':'forbidden_for_transition_replay'}
    return {'rule_id':'empirical:'+_digest([kind,conditions,effect]),'rule_family':kind,'status':status,'predictive_use_allowed':False,
        'conditions':conditions,'effect':effect,'validation_evidence':[evidence],'evidence_refs':[evidence['before'],evidence['after']],
        'counterexamples':[],'independent_confirmations':1,'scope':scope,
        'uncertainty':['one_transition_is_not_a_law','unmeasured_state_and_control_changes_not_excluded','observed_association_is_not_universal_causation']}

def predict_candidate_rule(rule,observation,action):
    """Freeze this conditional prediction BEFORE dispatch; it is not permission."""
    if rule.get('rule_family')!='translation_relation' or rule.get('status')=='refuted':return {'status':'unknown','rule_id':rule['rule_id'],'reason':'no_operational_nonrefuted_structural_rule'}
    bindings=_bind_variables(rule['conditions'],observation,action)
    if bindings is None:return {'status':'not_applicable','rule_id':rule['rule_id'],'reason':'measured_shape_action_mode_or_relation_condition_differs'}
    predicted=[]
    for name,e in sorted(bindings.items()):
        entity=_neutral_entity(e);delta=rule['effect']['variable_translations'][name]
        entity['position']=[entity['position'][i]+delta[i] for i in (0,1)];predicted.append({'variable':name,'entity':entity})
    return {'status':'conditional_prediction','rule_id':rule['rule_id'],'rule_digest':_digest(rule),'observation_ref':_ref(observation),
        'predicted_entities':predicted,'position_context':_position_context(bindings),'conditions':copy.deepcopy(rule['conditions']),
        'scope':copy.deepcopy(rule['scope']),'predictive_use_allowed':bool(rule.get('predictive_use_allowed')),'uncertainty':copy.deepcopy(rule['uncertainty'])}

def _prediction_matches(prediction,after):
    actual=[_neutral_entity(e) for e in after['entities']]
    return all(actual.count(item['entity'])==1 for item in prediction['predicted_entities'])

def apply_empirical_rule(rule,observation,action):
    if rule.get('status')!='mechanism_acquired' or not rule.get('predictive_use_allowed'):return {'status':'unknown','rule_id':rule.get('rule_id'),'reason':'independent_changed_context_validation_required'}
    prediction=predict_candidate_rule(rule,observation,action)
    if prediction['status']=='conditional_prediction':prediction['status']='prediction'
    return prediction

def validate_empirical_rule(rule,before,after,action):
    """Compare a frozen prior rule's prediction, never refit it on its validation."""
    _check(before,after,action);updated=copy.deepcopy(rule);evidence=_evidence(before,after,action)
    seen={e['transition_ref'] for e in rule['validation_evidence']}|{e['transition_ref'] for e in rule['counterexamples']}
    if evidence['transition_ref'] in seen:updated['last_validation']={'status':'duplicate_evidence_not_independent'};return updated
    if rule.get('rule_family')=='translation_relation':
        prediction=predict_candidate_rule(rule,before,action)
        if prediction['status']!='conditional_prediction':updated['last_validation']={'status':prediction['status']};return updated
        confirmed=_prediction_matches(prediction,after);evidence['position_context']=prediction['position_context'];evidence['frozen_rule_digest']=prediction['rule_digest']
        evidence['prediction_digest']=_digest(prediction['predicted_entities'])
        changed=all(e.get('position_context')!=prediction['position_context'] for e in rule['validation_evidence'])
    else:
        if rule['conditions']!=_conditions(before,action):updated['last_validation']={'status':'not_applicable'};return updated
        confirmed=_apply_effect(_state(before),rule['effect'])==_state(after);changed=False
    if not confirmed:
        updated['counterexamples'].append({**evidence,'observed_feature_digest':_digest(_state(after))})
        updated.update(status='refuted',predictive_use_allowed=False,last_validation={'status':'refuted','evidence':evidence['transition_ref']})
    else:
        updated['validation_evidence'].append(evidence);updated['independent_confirmations']=len(updated['validation_evidence'])
        if rule.get('rule_family')=='translation_relation' and changed and rule['scope']['exact_support_measured'] and not updated['counterexamples']:
            updated.update(status='mechanism_acquired',predictive_use_allowed=True)
            updated['scope']['position_generalization']='confirmed_on_independent_changed_positions_only'
            updated['uncertainty']=[u for u in updated['uncertainty'] if u!='one_transition_is_not_a_law']+['transfer_outside_measured_conditions_unproved']
        elif rule.get('rule_family')!='translation_relation':updated.update(status='reproduced_transition',predictive_use_allowed=False)
        updated['last_validation']={'status':'confirmed','changed_position_context':changed,'evidence':evidence['transition_ref']}
    updated['evidence_refs']=sorted(set(updated['evidence_refs']+[evidence['before'],evidence['after']]))
    return updated

def assess_transition(before,after,action,*,prior_rules=()):
    """Fit/refute library models and update an open, evidence-bearing rule registry.

    `empirical_rules` is the complete updated registry keyed by `rule_id`.
    A distinct provenance-bound transition at changed variable positions is
    required for translation acquisition. Other effects stay open transition
    candidates: induction beyond these structural relations is not implemented.
    """
    _check(before,after,action);evidence=_evidence(before,after,action)
    library=_library(before,after,action,prior_rules,evidence)
    updated={r['rule_id']:validate_empirical_rule(r,before,after,action) for r in prior_rules}
    candidate=construct_empirical_rule(before,after,action)
    if candidate['rule_id'] not in updated:
        # Conflicting observed outputs under identical measured conditions expose
        # a missing condition; do not silently replace the older learned rule.
        contradictory=[r for r in prior_rules if r['conditions']==candidate['conditions'] and r['effect']!=candidate['effect']]
        if contradictory:
            candidate['counterexamples']=[{**e,'reason':'contrary_observed_effect_under_same_conditions'} for r in contradictory for e in r['validation_evidence']]
            candidate.update(status='refuted',predictive_use_allowed=False)
            candidate['uncertainty'].append('additional_observable_condition_or_nondeterministic_model_required')
        updated[candidate['rule_id']]=candidate
    rules=list(updated.values())
    return {'schema':SCHEMA,'evidence_refs':[evidence['before'],evidence['after']],'library':library,
        'empirical_rules':rules,'construction':{'status':updated[candidate['rule_id']]['status'],
            'rule_id':candidate['rule_id'],'catalog_absence_does_not_discard_transition':True,'generalized_induction_beyond_translation':'not_implemented'},
        'predictive_applications':[apply_empirical_rule(r,before,action) for r in rules if r['status']=='mechanism_acquired'],
        'release_authority':False,'limitations':['no_object_role_or_goal_assignment','contact_push_compatibility_not_driver_causation','stationarity_not_proof_of_blocking','reflection_toggle_and_general_context_induction_not_implemented']}
