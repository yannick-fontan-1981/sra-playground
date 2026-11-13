"""Conditional observable-property rewrites induced from actual transitions.

Exact geometry establishes identity; an observed input point binds a variable
bearer. Values are learned from observations, never enumerated by game. Keyboard
effects without an identifiable bearer remain unknown in this first increment.
This module does not choose actions or grant release authority.
"""
from __future__ import annotations
import copy
from collections import defaultdict
from common_mechanisms import _check,_digest,_evidence,_position,_ref,_support,FORBIDDEN

SCHEMA='prototype.common_property_rewrites.v1'

def _properties(entity):
    properties={}
    signature=entity.get('signature',{})
    if not isinstance(signature,dict):signature={}
    for key in ('palette_value','area','scale'):
        if key in entity:properties[key]=entity[key]
        elif key in signature:properties[key]=signature[key]
    for key,value in entity.get('properties',{}).items():
        if key in FORBIDDEN:raise ValueError('Non-neutral property input')
        if isinstance(value,(str,int,float,bool)) or value is None:properties[key]=copy.deepcopy(value)
    return properties

def _geometry(entity):
    points=_support(entity)
    if points is None:return None
    x,y=_position(entity)
    return {'relative_support':sorted([px-x,py-y] for px,py in points)}

def _absolute_key(entity):
    support=_support(entity)
    return tuple(sorted(support)) if support is not None else None

def _context(observation):
    return {k:copy.deepcopy(observation[k]) for k in ('level_epoch','state','available_action_refs','context_scope') if k in observation}

def _action_template(action):
    data=action.get('data',{})
    if not isinstance(data,dict) or not all(isinstance(data.get(k),(int,float)) for k in ('x','y')):return None
    return {'action_ref':action['action_ref'],'other_data':{k:copy.deepcopy(v) for k,v in data.items() if k not in ('x','y')}}

def _point(action):return (action['data']['x'],action['data']['y'])

def _bind(rule,observation,action):
    conditions=rule['conditions']
    if observation.get('coordinate_basis')!=conditions['coordinate_basis'] or _action_template(action)!=conditions['action_template']:return None,'coordinate_or_action_template_differs'
    point=_point(action);matches=[]
    for entity in observation['entities']:
        support=_support(entity)
        if support is None or point not in support:continue
        x,y=_position(entity)
        if [point[0]-x,point[1]-y]!=conditions['address']['relative_point']:continue
        if _geometry(entity)!=conditions['bearer_geometry']:continue
        if any(_properties(entity).get(k,object())!=v for k,v in conditions['before_properties'].items()):continue
        matches.append(entity)
    if len(matches)!=1:return None,'bearer_binding_missing_or_ambiguous'
    return matches[0],None

def _apply(properties,effect):
    result=copy.deepcopy(properties)
    for operation in effect['property_operations']:
        if operation['operator']!='assign_observed_value':raise ValueError('Unknown property rewrite operator')
        result[operation['property']]=copy.deepcopy(operation['value'])
    return result

def construct_property_rule(before,after,action):
    """Return candidate plus diagnostics, or unknown; never guess correspondence."""
    _check(before,after,action);evidence=_evidence(before,after,action)
    if before.get('coordinate_basis') is None or before.get('coordinate_basis')!=after.get('coordinate_basis'):
        return {'status':'unknown','reason':'coordinate_basis_not_bound','evidence':evidence,'rule':None}
    template=_action_template(action)
    if template is None:return {'status':'unknown','reason':'no_observed_point_to_bind_bearer; nonpoint_identity_induction_not_implemented','evidence':evidence,'rule':None}
    point=_point(action);left=defaultdict(list);right=defaultdict(list)
    for entity in before['entities']:
        key=_absolute_key(entity)
        if key is not None:left[key].append(entity)
    for entity in after['entities']:
        key=_absolute_key(entity)
        if key is not None:right[key].append(entity)
    candidates=[];ambiguous=0
    for key,entities in left.items():
        if point not in key:continue
        if len(entities)!=1 or len(right.get(key,[]))!=1:ambiguous+=1;continue
        old,new=entities[0],right[key][0]
        if _position(old)!=_position(new):continue
        old_values,new_values=_properties(old),_properties(new)
        changes={k:new_values[k] for k in old_values.keys()&new_values.keys() if old_values[k]!=new_values[k]}
        if changes:candidates.append((old,new,changes))
    if len(candidates)!=1:
        return {'status':'unknown','reason':'no_unique_addressed_property_change_with_exact_persistent_support','candidate_count':len(candidates),'ambiguous_support_count':ambiguous,'evidence':evidence,'rule':None}
    old,new,changes=candidates[0];x,y=_position(old)
    conditions={'coordinate_basis':before['coordinate_basis'],'action_template':template,
        'address':{'relation':'input_point_in_exact_support','relative_point':[point[0]-x,point[1]-y]},
        'bearer_geometry':_geometry(old),'before_properties':_properties(old)}
    effect={'property_operations':[{'property':k,'operator':'assign_observed_value','value':copy.deepcopy(v)} for k,v in sorted(changes.items())],
        'preserve_geometry':True,'preserve_position':True}
    evidence['position_context']=list(_position(old));evidence['observable_context']=_context(before)
    rule={'rule_id':'property:'+_digest([conditions,effect]),'rule_family':'observable_property_rewrite',
        'status':'candidate','predictive_use_allowed':False,'conditions':conditions,'effect':effect,
        'validation_evidence':[evidence],'evidence_refs':[evidence['before'],evidence['after']],'counterexamples':[],
        'independent_confirmations':1,'validated_contexts':[],
        'scope':{'kind':'variable_bearer_with_measured_shape_properties_and_address_relation','causal_status':'unconfirmed_action_property_association','unmodeled_other_entities':len(before['entities'])-1,'transfer':'unproved'},
        'uncertainty':['one_example_not_a_law','contextual_instructions_or_hidden_state_may_change_rewrite','autonomous_step_dynamics_not_excluded','only_addressed_bearer_properties_predicted']}
    return {'status':'candidate_constructed','evidence':evidence,'rule':rule,'observed_changes':changes}

def predict_property_rule(rule,observation,action):
    """Conditional prediction to persist before dispatch; never release permission."""
    if rule.get('status')=='refuted':return {'status':'unknown','rule_id':rule['rule_id'],'reason':'counterexample_retained_requires_condition_refinement'}
    entity,reason=_bind(rule,observation,action)
    if entity is None:return {'status':'not_applicable','rule_id':rule['rule_id'],'reason':reason}
    context=_context(observation);known_context=context in rule['validated_contexts']
    return {'status':'conditional_prediction','rule_id':rule['rule_id'],'rule_digest':_digest(rule),'observation_ref':_ref(observation),
        'binding':{'variable':'bearer','observed_entity_ref':entity.get('id'),'position':list(_position(entity)),'geometry':_geometry(entity)},
        'expected_properties':_apply(_properties(entity),rule['effect']),'observable_context':context,
        'predictive_use_allowed':bool(rule.get('predictive_use_allowed')) and known_context,
        'scope':copy.deepcopy(rule['scope']),'uncertainty':copy.deepcopy(rule['uncertainty'])+([] if known_context else ['observable_context_not_independently_validated']),
        'release_authority':False}

def apply_property_rule(rule,observation,action):
    prediction=predict_property_rule(rule,observation,action)
    if prediction.get('predictive_use_allowed') and rule['status']=='mechanism_acquired':prediction['status']='prediction'
    elif prediction['status']=='conditional_prediction':prediction['status']='unknown';prediction['reason']='independent_validation_in_current_observable_context_required'
    return prediction

def validate_property_rule(rule,before,after,action):
    """Predict from the old rule, then confront new observations without refitting."""
    _check(before,after,action);updated=copy.deepcopy(rule);evidence=_evidence(before,after,action)
    used={e['transition_ref'] for e in rule['validation_evidence']}|{e['transition_ref'] for e in rule['counterexamples']}
    if evidence['transition_ref'] in used:updated['last_validation']={'status':'duplicate_evidence_not_independent'};return updated
    prediction=predict_property_rule(rule,before,action)
    if prediction['status']!='conditional_prediction':updated['last_validation']={'status':prediction['status'],'reason':prediction.get('reason')};return updated
    old,reason=_bind(rule,before,action);support=_absolute_key(old)
    matches=[e for e in after['entities'] if _absolute_key(e)==support and _position(e)==_position(old)]
    if len(matches)!=1:
        updated['last_validation']={'status':'unknown','reason':'after_identity_or_geometry_ambiguous; no_property_counterexample_asserted','evidence':evidence};return updated
    observed=_properties(matches[0]);expected=prediction['expected_properties']
    if set(expected)-observed.keys():updated['last_validation']={'status':'unknown','reason':'expected_properties_unmeasured_after'};return updated
    evidence.update(position_context=prediction['binding']['position'],observable_context=prediction['observable_context'],frozen_rule_digest=prediction['rule_digest'],prediction=expected)
    differences={k:{'predicted':v,'observed':observed[k]} for k,v in expected.items() if observed[k]!=v}
    updated['evidence_refs']=sorted(set(updated['evidence_refs']+[evidence['before'],evidence['after']]))
    if differences:
        updated['counterexamples'].append({**evidence,'differences':differences})
        updated.update(status='refuted',predictive_use_allowed=False,last_validation={'status':'refuted','differences':differences,'evidence':evidence['transition_ref']})
        return updated
    changed=any(e['position_context']!=evidence['position_context'] for e in rule['validation_evidence'])
    updated['validation_evidence'].append(evidence);updated['independent_confirmations']=len(updated['validation_evidence'])
    same_context=[e for e in updated['validation_evidence'] if e['observable_context']==evidence['observable_context']]
    varied=len({tuple(e['position_context']) for e in same_context})>=2
    if varied and not updated['counterexamples']:
        updated.update(status='mechanism_acquired',predictive_use_allowed=True)
        if evidence['observable_context'] not in updated['validated_contexts']:updated['validated_contexts'].append(evidence['observable_context'])
        updated['scope']['causal_status']='locally_supported_property_relation; exclusive_causation_not_proved'
        updated['uncertainty']=[u for u in updated['uncertainty'] if u!='one_example_not_a_law']
    updated['last_validation']={'status':'confirmed','changed_position_context':changed,'current_mode_independently_supported':varied,'evidence':evidence['transition_ref']}
    updated['evidence_refs']=sorted(set(updated['evidence_refs']+[evidence['before'],evidence['after']]))
    return updated

def assess_property_transition(before,after,action,*,prior_rules=()):
    """Retain the registry and unknowns; no closed-catalogue rejection of reality."""
    construction=construct_property_rule(before,after,action)
    updated={r['rule_id']:validate_property_rule(r,before,after,action) for r in prior_rules}
    candidate=construction.get('rule')
    if candidate is not None and candidate['rule_id'] not in updated:
        conflicting=[r for r in prior_rules if r['conditions']==candidate['conditions'] and r['effect']!=candidate['effect']]
        if conflicting:
            candidate['counterexamples']=[{**e,'reason':'contrary_observed_property_rewrite_with_same_declared_conditions'} for r in conflicting for e in r['validation_evidence']]
            candidate.update(status='refuted',predictive_use_allowed=False)
            candidate['uncertainty'].append('missing_condition_requires_discovery; do_not_select_by_game_or_level_name')
        updated[candidate['rule_id']]=candidate
    return {'schema':SCHEMA,'evidence_refs':[_ref(before),_ref(after)],'construction':{k:v for k,v in construction.items() if k!='rule'},
        'property_rules':list(updated.values()),'unexplained_transition_retained':construction['status']=='unknown','release_authority':False,
        'limitations':['exact_support_identity_required','nonpoint_bearer_binding_not_implemented','only_observed_scalar_properties_rewritten','contextual_condition_induction_after_refutation_remains_open']}
