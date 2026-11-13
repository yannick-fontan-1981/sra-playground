#!/usr/bin/env python3
"""Pinned Python oracle for native transition learning and preservation.

Synthetic public measurements exercise ambiguity, independent confirmation,
counterexamples and preservation authority. Additional cases consume only
actual public observations already captured from the shared native game engine.
No synthetic expectation is computed by the TypeScript implementation.
"""
from pathlib import Path
import copy
import hashlib
import json
import sys

ROOT=Path(__file__).resolve().parents[1]
COMMIT='786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE=ROOT/'reference'/'v6'/COMMIT/'source'
LAYA=SOURCE/'agents/yf_arc3_v6/laya_proto'
sys.path[:0]=[str(LAYA),str(SOURCE)]
import common_mechanisms as mechanisms
import common_property_rewrites as properties
import common_control_dependencies as controls
import common_preservation as preservation

CASES=[];CONTROL_CASES=[]


def record(name,function,*args,**kwargs):
    case={'name':name,'module':function.__module__,'function':function.__name__,'args':copy.deepcopy(args),'kwargs':copy.deepcopy(kwargs)}
    try:case['expected']=function(*args,**kwargs)
    except Exception as error:case['error']={'type':type(error).__name__,'message':str(error)}
    CASES.append(case);return copy.deepcopy(case.get('expected'))


def observation(reference,entities,**changes):
    return {'observation_ref':reference,'frame_hash':hashlib.sha256(reference.encode()).hexdigest()[:16],
        'revision':0,'level_epoch':1,'coordinate_basis':'screen','state':'NOT_FINISHED','levels_completed':0,
        'available_action_refs':['ACTION1','ACTION2','ACTION6'],'entities':copy.deepcopy(entities),**changes}


def entity(name,point,color=2,mask=((0,0),),**extra):
    return {'id':name,'signature':{'palette_value':color,'shape':list(mask)},'position':list(point),
        'mask':[list(p)for p in mask],'palette_value':color,'area':len(mask),'scale':1,**extra}


def translated(value,dx,dy=0):
    item=copy.deepcopy(value);item['position']=[item['position'][0]+dx,item['position'][1]+dy]
    if 'support'in item:item['support']=[[x+dx,y+dy]for x,y in item['support']]
    return item


def mechanical_cases():
    command={'action_ref':'ACTION1'}
    first=entity('receiver',(1,1));later=translated(first,1)
    before=observation('move-1-before',[first]);after=observation('move-1-after',[later])
    candidate=record('translation_candidate',mechanisms.construct_empirical_rule,before,after,command)
    record('candidate_cannot_predict_authoritatively',mechanisms.apply_empirical_rule,candidate,before,command)
    record('conditional_prediction',mechanisms.predict_candidate_rule,candidate,before,command)
    record('duplicate_transition_not_independent',mechanisms.validate_empirical_rule,candidate,before,after,command)
    same_before=observation('same-position-before',[first]);same_after=observation('same-position-after',[later])
    record('new_provenance_same_position_not_acquired',mechanisms.validate_empirical_rule,candidate,same_before,same_after,command)
    second_before=observation('move-2-before',[translated(first,3)]);second_after=observation('move-2-after',[translated(first,4)])
    acquired=record('changed_positions_acquire_translation',mechanisms.validate_empirical_rule,candidate,second_before,second_after,command)
    record('acquired_translation_prediction',mechanisms.apply_empirical_rule,acquired,second_before,command)
    record('extra_empty_data_is_different_action',mechanisms.apply_empirical_rule,acquired,second_before,{'action_ref':'ACTION1','data':{}})
    record('different_mode_is_not_applicable',mechanisms.predict_candidate_rule,acquired,{**second_before,'level_epoch':2},command)
    repeated=copy.deepcopy(second_before);repeated['entities'].append(copy.deepcopy(repeated['entities'][0]))
    record('ambiguous_signature_cannot_bind',mechanisms.predict_candidate_rule,acquired,repeated,command)
    failed_before=observation('failed-before',[translated(first,6)]);failed_after=observation('failed-after',[translated(first,6)])
    refuted=record('failed_frozen_translation_refutes',mechanisms.validate_empirical_rule,acquired,failed_before,failed_after,command)
    record('refuted_rule_not_reused',mechanisms.predict_candidate_rule,refuted,failed_before,command)
    record('registry_retains_contradictory_candidate',mechanisms.assess_transition,failed_before,failed_after,command,prior_rules=[acquired])
    record('library_rigid_movement',mechanisms.assess_transition,before,after,command)
    a=entity('left',(1,3),2);b=entity('right',(2,3),3)
    record('contact_push_is_compatibility_not_cause',mechanisms.assess_transition,
        observation('push-before',[a,b]),observation('push-after',[translated(a,1),translated(b,1)]),command)
    record('contacted_support_did_not_move',mechanisms.assess_transition,
        observation('partial-push-before',[a,b]),observation('partial-push-after',[translated(a,1),b]),command)
    wall=entity('contact',(8,1),3)
    record('failed_acquired_motion_with_contact',mechanisms.assess_transition,
        {**failed_before,'entities':failed_before['entities']+[wall]},
        {**failed_after,'entities':failed_after['entities']+[wall]},command,prior_rules=[acquired])
    record('stationarity_does_not_prove_blocking',mechanisms.assess_transition,failed_before,failed_after,command,prior_rules=[acquired])
    no_support=[{k:v for k,v in e.items()if k!='mask'}for e in [a,b]]
    record('bounding_boxes_do_not_prove_contact',mechanisms.assess_transition,
        observation('unsupported-before',no_support),observation('unsupported-after',[translated(e,1)for e in no_support]),command)
    distorted=copy.deepcopy(later);distorted['mask'].append([1,0])
    record('same_signature_distorted_support',mechanisms.assess_transition,before,observation('distorted-after',[distorted]),command)
    record('coordinate_basis_unknown',mechanisms.assess_transition,{**before,'coordinate_basis':None},after,command)
    record('sweep_bound_retains_unknown',mechanisms.assess_transition,
        observation('long-sweep-before',[a,b]),observation('long-sweep-after',[translated(a,2048),b]),command)
    many=[entity('m'+str(i),(i*2,1),i)for i in range(13)]
    record('pair_catalogue_bound_is_visible',mechanisms.assess_transition,
        observation('many-before',many),observation('many-after',[translated(e,1)for e in many]),command)
    recolored=entity('receiver',(1,1),4)
    literal=record('property_change_is_literal_translation_fallback',mechanisms.construct_empirical_rule,before,observation('literal-after',[recolored]),command)
    record('literal_replay_never_becomes_mechanism',mechanisms.validate_empirical_rule,literal,
        observation('literal-confirm-before',[first]),observation('literal-confirm-after',[recolored]),command)
    record('same_conditions_conflicting_outputs_are_retained',mechanisms.assess_transition,before,
        observation('opposite-move',[translated(first,-1)]),command,prior_rules=[candidate])
    support_first=copy.deepcopy(first);support_first.pop('mask');support_first['support']=[[1,1]]
    record('absolute_support_input',mechanisms.construct_empirical_rule,
        observation('absolute-before',[support_first]),observation('absolute-after',[translated(support_first,1)]),command)
    record('forbidden_game_identifier_rejected',mechanisms.construct_empirical_rule,{**before,'game_id':'not-an-input'},after,command)
    record('forbidden_entity_goal_rejected',mechanisms.construct_empirical_rule,
        {**before,'entities':[{**first,'goal':True}]},after,command)
    record('same_observation_not_new_evidence',mechanisms.construct_empirical_rule,before,before,command)
    record('too_many_neutral_entities',mechanisms.construct_empirical_rule,
        observation('too-many',[first]*513),after,command)
    return acquired


def property_cases():
    mask=((0,0),(0,1),(1,0),(1,1));old=entity('bearer',(2,2),2,mask)
    changed=entity('bearer',(2,2),3,mask)
    before=observation('property-1-before',[old]);after=observation('property-1-after',[changed]);action={'action_ref':'ACTION6','data':{'x':2,'y':2}}
    constructed=record('addressed_property_candidate',properties.construct_property_rule,before,after,action);rule=constructed['rule']
    record('property_candidate_not_acquired',properties.apply_property_rule,rule,before,action)
    record('property_conditional_prediction',properties.predict_property_rule,rule,before,action)
    record('duplicate_property_evidence',properties.validate_property_rule,rule,before,after,action)
    before2=observation('property-2-before',[translated(old,5)]);after2=observation('property-2-after',[translated(changed,5)])
    action2={'action_ref':'ACTION6','data':{'x':7,'y':2}}
    acquired=record('property_at_new_position_acquires',properties.validate_property_rule,rule,before2,after2,action2)
    record('property_acquired_prediction',properties.apply_property_rule,acquired,before2,action2)
    record('property_new_mode_requires_validation',properties.apply_property_rule,acquired,{**before2,'level_epoch':2},action2)
    record('same_property_position_new_provenance',properties.validate_property_rule,rule,
        observation('property-repeat-before',[old]),observation('property-repeat-after',[changed]),action)
    record('property_missing_after_entity_is_unknown',properties.validate_property_rule,rule,before2,observation('property-identity-lost',[]),action2)
    record('property_ambiguous_after_entity_is_unknown',properties.validate_property_rule,rule,before2,
        observation('property-identity-ambiguous',[translated(changed,5),translated(changed,5)]),action2)
    unmeasured=translated(changed,5);unmeasured.pop('palette_value');unmeasured['signature']='without-palette'
    record('unmeasured_property_is_not_counterexample',properties.validate_property_rule,rule,before2,observation('property-unmeasured',[unmeasured]),action2)
    divergent=translated(changed,5);divergent['palette_value']=4
    refuted=record('changed_property_refutes_frozen_prediction',properties.validate_property_rule,acquired,before2,
        observation('property-divergence',[divergent]),action2)
    record('refuted_property_not_reused',properties.predict_property_rule,refuted,before2,action2)
    record('property_registry_retains_conflicting_outcome',properties.assess_property_transition,before2,
        observation('property-conflict',[divergent]),action2,prior_rules=[acquired])
    record('property_registry_acquires_from_actual_transition',properties.assess_property_transition,before2,after2,action2,prior_rules=[rule])
    record('keyboard_bearer_remains_unknown',properties.construct_property_rule,before,after,{'action_ref':'ACTION1'})
    record('property_coordinate_unknown',properties.construct_property_rule,{**before,'coordinate_basis':None},after,action)
    record('wrong_address_cannot_bind',properties.predict_property_rule,rule,before,{'action_ref':'ACTION6','data':{'x':3,'y':2}})
    record('changed_other_action_data_cannot_bind',properties.predict_property_rule,rule,before,{'action_ref':'ACTION6','data':{'x':2,'y':2,'button':1}})
    record('no_change_cannot_construct_property',properties.construct_property_rule,before,observation('property-no-change',[old]),action)
    ambiguous={**before,'entities':[old,copy.deepcopy(old)]}
    record('ambiguous_before_support_unknown',properties.construct_property_rule,ambiguous,after,action)
    unicode_old={**old,'properties':{'mode':'é','active':False,'complex':[1,2]}}
    unicode_new={**old,'properties':{'mode':'中','active':True,'complex':[2,1]}}
    record('unicode_scalar_properties_use_utf8_hash',properties.construct_property_rule,
        observation('unicode-before',[unicode_old]),observation('unicode-after',[unicode_new]),action)
    record('python_boolean_integer_equality',properties.construct_property_rule,
        observation('boolean-before',[{**old,'properties':{'flag':False}}]),
        observation('boolean-after',[{**old,'properties':{'flag':0}}]),action)
    record('python_boolean_coordinate_support_membership',properties.construct_property_rule,
        observation('boolean-point-before',[translated(old,-1,-1)]),
        observation('boolean-point-after',[translated(changed,-1,-1)]),{'action_ref':'ACTION6','data':{'x':True,'y':True}})
    record('forbidden_nested_property_rejected',properties.construct_property_rule,
        observation('bad-property-before',[{**old,'properties':{'solution':'excluded'}}]),after,action)
    return acquired


def control_cases(rule):
    receiver=entity('receiver',(9,1));button=entity('changed-occurrence',(2,5),5);other=entity('changed-occurrence',(2,5),6)
    before=observation('control-intervention-before',[receiver,button]);after=observation('control-intervention-after',[receiver,other])
    intervention={'record':{'observed_local_change':True,'observation_ref':before['observation_ref'],'after_ref':after['observation_ref'],
        'features':{'before':5,'after':6,'label':'é'},'action':{'action_ref':'ACTION6','data':{'x':2,'y':5}},'entity_ref':'changed-occurrence'}}
    command={'action_ref':'ACTION1'};action_domain=[command,{'action_ref':'ACTION6','data':{'x':2,'y':5}}]
    def scenario(name,after_outcome=None,command_override=None,repeat=False):
        control=controls.ControlDependencies();steps=[]
        def step(method,*args):
            item={'method':method,'args':copy.deepcopy(args)}
            try:item['expected']=getattr(control,method)(*args)
            except Exception as error:item['error']={'type':type(error).__name__,'message':str(error)}
            item['state']={'pending':copy.deepcopy(control.pending),'attempted':sorted(control.attempted)};steps.append(item)
            return copy.deepcopy(item.get('expected'))
        step('change',before,after,intervention);selected=step('offer',after,action_domain,[rule]);assert selected is not None
        if after_outcome is not None:step('evaluate',selected,after,command_override or command,after_outcome)
        if repeat:step('evaluate',selected,after,command,after_outcome)
        step('offer',after,action_domain,[rule]);CONTROL_CASES.append({'name':name,'steps':steps});return selected
    matched=observation('control-matched',[translated(receiver,1),other])
    selected=scenario('control_response_persists',matched,repeat=True)
    scenario('control_response_differs',observation('control-differs',[receiver,other]))
    scenario('control_boundary_is_unknown',observation('control-boundary',[translated(receiver,1),other],level_epoch=2))
    scenario('control_identity_ambiguous',observation('control-ambiguous',[translated(receiver,1),translated(receiver,1),other]))
    scenario('control_identity_missing',observation('control-missing',[other]))
    scenario('empty_data_mismatch_is_rejected',matched,{'action_ref':'ACTION1','data':{}})
    c=controls.ControlDependencies();steps=[]
    for method,args in [('change',(before,after,intervention)),('offer',({**after,'frame_hash':'stale'},action_domain,[rule])),
        ('offer',({**after,'observation_ref':'stale'},action_domain,[rule])),('offer',(after,[{'action_ref':'ACTION1','data':{'x':1}}],[rule])),
        ('record_attempt',(selected['question_key'],)),('record_attempt',(selected['question_key'],)),('offer',(after,action_domain,[rule])),
        ('change',(before,{**after,'state':'OTHER'},intervention)),('offer',(after,action_domain,[rule]))]:
        item={'method':method,'args':copy.deepcopy(args)}
        try:item['expected']=getattr(c,method)(*args)
        except Exception as error:item['error']={'type':type(error).__name__,'message':str(error)}
        item['state']={'pending':copy.deepcopy(c.pending),'attempted':sorted(c.attempted)};steps.append(item)
    CONTROL_CASES.append({'name':'staleness_action_domain_and_single_attempt','steps':steps})
    record('control_question_digest_uses_ascii_escapes',controls.ControlDependencies.question_key,1,'relation',{'label':'é'},selected['expected_receivers'])


def preservation_cases():
    rows=[[0]*8 for _ in range(8)];rows[1][1]=1;rows[1][2]=2
    obs=observation('preserve-before',[])
    obligation={'id':'P_measured','pixels':[[1,1,1],[2,1,2]],'evidence':['observed-condition'],
        'meaning':'retain these measured values','revision_inputs':['ACTION6']}
    proposal={'status':'proposed','actions':[{'action_ref':'ACTION1'}],'compositions':[],
        'bundle_template':{'operation_key':'OP18','preserve_refs':[]}}
    record('visible_preservation_measure',preservation.condition_measure,obligation,rows,obs)
    bound=record('bind_acquired_preservation',preservation.bind,proposal,[obligation],obs,rows)[0]
    record('preservation_matches_before',preservation.check,bound,rows,1,observation=obs)
    record('preservation_unbound_is_admitted',preservation.check,proposal,rows,1)
    record('preservation_epoch_change_stops',preservation.check,bound,rows,2,observation=obs)
    record('official_boundary_reconciles',preservation.check,bound,rows,2,after=True,boundary=True,observation=obs)
    changed=copy.deepcopy(rows);changed[1][1]=7
    record('changed_acquired_condition_rejects_proposal',preservation.bind,proposal,[obligation],obs,changed)
    record('changed_acquired_condition_stops_prefix',preservation.check,bound,changed,1,after=True,observation=obs)
    destructive={**proposal,'actions':[{'action_ref':'ACTION6','data':{'x':1,'y':1}}]}
    record('undeclared_revision_input_is_returned_for_reselection',preservation.bind,destructive,[obligation],obs,rows)
    revision={'observation_ref':obs['observation_ref'],'why':'measured contribution','expected_reestablishment':'after observed completion','action_ref':'ACTION6'}
    authorized={**destructive,'preservation_changes':{obligation['id']:revision}}
    record('single_action_revision_authorized',preservation.authorized_revision,authorized,obligation,obs)
    revised=record('authorized_revision_is_bound',preservation.bind,authorized,[obligation],obs,rows)[0]
    record('authorized_revised_condition_skipped_after',preservation.check,revised,changed,1,after=True,observation=obs)
    strict=copy.deepcopy(revised);strict['preservation_changes'][obligation['id']]['revise_condition']=False
    record('explicitly_preserved_condition_still_checked',preservation.check,strict,changed,1,after=True,observation=obs)
    strict['preservation_changes'][obligation['id']]['revise_condition']=None
    record('null_revision_does_not_skip_condition',preservation.check,strict,changed,1,after=True,observation=obs)
    multi=copy.deepcopy(authorized);multi['actions']*=2
    record('undeclared_multi_action_revision_rejected',preservation.authorized_revision,multi,obligation,obs)
    multi['preservation_changes'][obligation['id']]['actions']=copy.deepcopy(multi['actions'])
    record('exact_declared_multi_action_revision_authorized',preservation.authorized_revision,multi,obligation,obs)
    tampered=copy.deepcopy(multi);tampered['actions'][0]['data']['x']=4
    record('changed_multi_action_payload_rejected',preservation.authorized_revision,tampered,obligation,obs)
    for key,value in [('observation_ref','stale'),('why',''),('expected_reestablishment',None),('action_ref','ACTION2')]:
        altered=copy.deepcopy(authorized);altered['preservation_changes'][obligation['id']][key]=value
        record('revision_guard_'+key,preservation.authorized_revision,altered,obligation,obs)
    occluder={**obligation,'occluder_mask':[[0,0],[1,0]]}
    occupied=observation('fully-covered',[entity('cover',(1,1),7,((0,0),(1,0)))])
    occluded=record('occlusion_does_not_assert_invisible_pixels',preservation.bind,proposal,[occluder],occupied,changed)[0]
    record('fully_occluded_condition_seals_prefix',preservation.check,occluded,changed,1,observation=occupied)
    partial=observation('partly-covered',[entity('cover',(0,1),7,((0,0),(1,0)))])
    record('partial_occlusion_keeps_visible_condition',preservation.condition_measure,occluder,changed,partial)
    square=lambda name,box: {'id':name,'bbox':box,'palette_value':7,'rectangular':True}
    typed={'id':'P_typed','entity_predicate':{'palette_value':7,'minimum_count':2,'exclude_boxes':[[5,5,7,7]]},'evidence':['typed-evidence'],'meaning':'retain visible typed occurrences'}
    entities=[square('one',[1,1,2,2]),square('two',[3,1,3,1]),square('excluded',[5,5,6,6]),square('rectangle',[1,4,3,4]),{**square('not-filled',[2,5,3,6]),'rectangular':False}]
    record('typed_square_occurrence_count',preservation.condition_measure,typed,rows,observation('typed',entities))
    record('typed_predicate_requires_projection',preservation.condition_measure,typed,rows)
    record('non_proposed_candidate_has_no_preservation_mutation',preservation.bind,{**proposal,'status':'unknown'},[obligation],obs,rows)


def real_public_cases():
    support=json.loads((ROOT/'tests/fixtures/v6-ordered-support-reference.json').read_text())['session']
    fields=json.loads((ROOT/'tests/fixtures/v6-field-reference.json').read_text())['cases']
    for case in [support]+[c for c in fields if c['game']in ('SYME','DNOI')]:
        before=case['initial']['observation'];count=0
        for transition in case['transitions']:
            for index,step in enumerate(transition['steps']):
                after=step['afterObservation'];action=transition['proposal']['actions'][index]
                if before['level_epoch']==after['level_epoch']:
                    record('actual_public_'+case['game']+'_'+str(count)+'_mechanisms',mechanisms.assess_transition,before,after,action)
                    record('actual_public_'+case['game']+'_'+str(count)+'_properties',properties.assess_property_transition,before,after,action)
                before=after;count+=1
                if count>=2:break
            if count>=2:break


def main():
    acquired=mechanical_cases();property_cases();control_cases(acquired);preservation_cases();real_public_cases()
    files=['common_mechanisms.py','common_property_rewrites.py','common_control_dependencies.py','common_preservation.py']
    output={'sourceCommit':COMMIT,'sourceSha256':{name:hashlib.sha256((LAYA/name).read_bytes()).hexdigest()for name in files},
        'scope':'Exact original-function differential on synthetic public measurements plus six real public transitions. This is not a complete agent score.',
        'numericDomain':'Portable safe integers, booleans, strings and JSON; Python float/int tagging is not represented by browser Numbers',
        'cases':CASES,'controlCases':CONTROL_CASES}
    path=ROOT/'tests/fixtures/v6-transition-reference.json';path.write_text(json.dumps(output,separators=(',',':'),ensure_ascii=False)+'\n')
    print(json.dumps({'output':str(path),'cases':len(CASES),'controlScenarios':len(CONTROL_CASES),'bytes':path.stat().st_size}))


if __name__=='__main__':main()
