"""V6 current bindings and execution of Source81-selected compositions."""
from copy import deepcopy
from .geometry import digest, unique, current_body_box, patch
from .source81_context import current_entry
from .source81_projection import source81_project, materialize_selected
from . import stationary_return
from .source81_independent import bind_independent_member


def _component_entity(projection, component_ref, observation):
    ids=projection.get('component_entity_bindings',{}).get(component_ref,[])
    matches=[e for e in observation['entities'] if e['id'] in ids]
    return matches[0] if len(matches)==1 else None


def _cell_entity(projection, cell, observation):
    refs=[ref for ref,p in projection['domain']['component_cells'].items() if list(p)==list(cell)]
    entities=[_component_entity(projection,ref,observation) for ref in refs]
    entities=[e for e in entities if e is not None]
    return entities[0] if len(entities)==1 else None


def _joined_rows(f,projection,obs,rows,remaining):
    origin=f.question.get('origin_measurement')
    if not origin:return [],None
    q=f.question;common={'question_ref':q['id'],'question_already_retained':True,
        'current_identity_binding':q.get('origin_peer_signature')==f.peer and q.get('origin_body_signature')==f.control['signature'],
        'question_evidence_refs':q['origin_measurement_evidence'],
        'controlled_approach':origin['controlled_squared_approach_fourfold'],
        'distance_delta':origin['squared_distance_delta_fourfold'],'shared_translation':origin['shared_translation'],
        'composition_inventory_complete':projection['parent_inventory']['enumeration_complete'],
        'current_frame_ref':obs['observation_ref'],'remaining_budget':remaining,
        'parent_peer_component_ref':projection['binding']['peer_ref']}
    result=[];context=digest([obs['level_epoch'],rows]);history=f.input_trials.get(context,[])
    for raw in projection['parent_inventory']['rows']:
        r=deepcopy(raw);r['geometry_candidate_ref']=raw['candidate_ref'];r['candidate_ref']=raw['candidate_ref']+':'+q['id'];r['alternative_ref']=r['candidate_ref'];r['question_ref']=q['id']
        geometry=r.get('private_geometry',projection['inventory']['geometry']);repeated=False
        if r['access_distance']==1:
            delta=[r['grip_root'][i]-geometry['start'][i] for i in (0,1)]
            inputs=[a for a,v in geometry['vectors'].items() if list(v)==delta]
            repeated=any(t['action']['action_ref'] in inputs and t['directional'] for t in history)
        r['direct_single_input_previously_executed']=int(repeated)
        if r.get('future_part_cells') is not None and f.recipe:
            r['prepared_constraint_contract']={'status':'PROPOSED','question_ref':q['id'],
                'scope':obs['level_epoch'],'source_frame_ref':obs['observation_ref'],
                'geometry_candidate_ref':raw['candidate_ref'],'parked_cells':r['future_part_cells'],
                'operator_action_ref':f.recipe['operator_action_ref'],'coupling_claim_refs':f.recipe.get('method_claim_refs',[])}
            prior=f.prepared_source81
            compatible=bool(prior and prior['epoch']==obs['level_epoch']and prior['parent_ref']==q['id']and all(digest(prior['geometry_row'].get(k))==digest(r.get(k))for k in('grip_root','future_part_cells','stationary_part_neighbor_loss','peer_exit_count_after_independent_actor')))
            proposed_ref=prior['ref']if compatible else'prepared-constraint-proposal:'+digest([obs['level_epoch'],q['id'],raw['candidate_ref'],f.recipe['method_claim_refs'],projection['binding']['actor_ref'],projection['binding']['peer_ref']])
            r['prepared_constraint_ref']=proposed_ref
            r['prepared_constraint_contract'].update(ref=proposed_ref,parent=q['id'],coupling_claim_refs=list(f.recipe['method_claim_refs']))
            r['prepared_constraint_already_retained']=compatible
        if r.get('independent_motion_present')is True and f.prepared_source81:
            prepared=f.prepared_source81
            r['proposal_operator_observation_refs']=list(prepared.get('inverse_reply_refs',[]))
            r['prepared_constraint_contract']={'ref':prepared['ref'],'status':'PROPOSED','parent':prepared['parent_ref'],'epoch':prepared['epoch'],'inverse_reply_refs':list(prepared.get('inverse_reply_refs',[]))}
            r['actor_translation_with_part_stationary_observed']=prepared.get('part_stationary_independence_observed')is True
        result.append(r)
    return result,common


def offer(f,obs,rows,remaining,scene):
    entry=current_entry(f.policy,scene,f.control,f.peer,f.question,f.floor,obs)
    if not entry:return None,{'status':'current_source_entry_unavailable'}
    independent=bool(f.prepared_source81 and f.prepared_source81.get('phase')in('independent_probe_required','independent_access'))
    mode='unbound'if independent else('bound_pair'if f.recipe else'unbound')
    claims=entry['binding_claim_refs']+([] if not f.recipe else f.recipe.get('method_claim_refs',[]))
    projection=source81_project(scene,None if independent else f.recipe,obs,rows,[f.floor],f.policy.config['direction_prior'],
        support_evidence=f.control['support_evidence'],binding_claim_refs=claims,
        parent_question=entry['parent_question'],mode=mode,operator_candidates=entry['explicit_operator_candidates'])
    if independent:projection=bind_independent_member(projection,f.prepared_source81,obs)
    if projection.get('parent_applicability')!='current_parent_rows':
        return None,{'status':projection['status'],'parent_applicability':projection.get('parent_applicability'),'reason':projection.get('reason'),'binding':projection.get('binding')}
    candidates,common=_joined_rows(f,projection,obs,rows,remaining)
    if common is None:return None,{'status':'retained_origin_measurement_missing'}
    retained=f.source81_plan
    continuation=None;target_revision=None
    if retained:
        old=retained['target'];keys=('grip_root','conditional_translation_access','future_part_cells','translated_cell_origin','translated_cell_destination')
        same=[r for r in candidates if all((bool(r.get(k))==bool(old.get(k)))if k=='conditional_translation_access'else(digest(r.get(k))==digest(old.get(k)))for k in keys)and(mode=='bound_pair'or digest(r['part_cells'])==digest(old['part_cells']))]
        if not same:
            prepared=f.prepared_source81;prior=retained['offer'];peer_changed=scene['peer']['bbox']!=prior['peer']['bbox']
            rf={'same_parent':retained['parent']==f.question['id'],'current_scope':retained['scope']==obs['level_epoch'],
                'current_parent_identity':common['current_identity_binding'],'current_actor_and_part_bound':mode=='bound_pair'and projection['binding'].get('part_ref')is not None,
                'coupling_method_retained':bool(f.recipe and f.recipe.get('method_claim_refs')),
                'actual_peer_response_observed':bool(peer_changed and prepared and prepared['phase']=='loaded_preparation_revalidation_required'and retained['last_received'][-1]==obs['observation_ref']),
                'complete_current_inventory':projection['parent_inventory']['enumeration_complete']is True,
                'old_target_current_matches':len(same),'current_geometry_contradicts_old_target':peer_changed,
                'parent_ref':f.question['id'],'old_target_ref':retained['target_ref'],'old_selection_ref':retained['selection'],'revision_evidence_refs':retained['last_received']}
            revision,rw=f.source81_policy.revise_target(rf)
            if revision['status']!='revision':return None,{'status':'retained_target_revision_not_admitted','facts':rf,'revision':revision}
            target_revision={'authority':revision,'workflow':rw,'refuted_target_ref':retained['target_ref'],'old_selection_ref':retained['selection'],'old_target_geometry_ref':old['geometry_candidate_ref'],'peer_before':prior['peer']['bbox'],'peer_now':scene['peer']['bbox'],'evidence':retained['last_received'],'parent':f.question['id'],'scope':obs['level_epoch'],'preserved_method_claim_refs':f.recipe['method_claim_refs'],'refutation_scope':'former future placement under former peer pose; coupling method not refuted'}
            retained=None
    if retained:
        prior=retained['offer'];old=retained['target']
        keys=('grip_root','conditional_translation_access','future_part_cells','translated_cell_origin','translated_cell_destination')
        same=[r for r in candidates if all((bool(r.get(k))==bool(old.get(k)))if k=='conditional_translation_access'else(digest(r.get(k))==digest(old.get(k)))for k in keys)
              and (mode=='bound_pair'or digest(r['part_cells'])==digest(old['part_cells']))]
        if retained['scope']!=obs['level_epoch']or retained['parent']!=f.question['id']or len(same)!=1:
            return None,{'status':'retained_source81_target_requires_explicit_revision','matching_targets':len(same)}
        row=deepcopy(same[0]);row['prospective_grasp_hypothesis_ref']=old['prospective_grasp_hypothesis_ref']
        material=materialize_selected(projection,row['geometry_candidate_ref'],row)
        returned_preparation=retained.get('compatible_translation_return')
        preserved=all(all(v==e['value']for line in patch(rows,e['bbox'])for v in line)for e in prior['preserved_subjects'])
        pub=prior['publication']['facts']
        cf={'retained_target_ref':retained['target_ref'],'retained_selection_ref':retained['selection'],
            'parent_question_ref':f.question['id'],'retained_goal_ref':pub['active_goal_ref'],
            'retained_subgoal_ref':pub['subgoal_ref'],'retained_expected_effect_class':pub['expected_effect_class'],
            'continuation_evidence_refs':retained['last_received'],
            'current_parent_peer_bound':common['current_identity_binding'],'current_actor_bound':True,
            'current_target_bound':True,'current_scope_bound':retained['scope']==obs['level_epoch'],
            'remaining_route_revalidated':bool(material['prospective_grasp_ready']or material['prospective_grasp_action_refs']),
            'preservation_constraints_revalidated':preserved,
            'next_input_available':all(a in obs['available_action_refs']for a in material['prospective_grasp_action_refs']),
            'within_remaining_budget':0<=row['total_primitive_distance']<=remaining,
            'pertinent_contradiction':any(old.get(k)!=row.get(k)for k in ('conditional_peer_contact','stationary_part_neighbor_loss','peer_exit_count_after_independent_actor')if old.get(k)is not None)}
        if returned_preparation:
            if not preserved:return None,{'status':'returned_preparation_preservation_refuted'}
            selected,workflow=f.source81_policy.prepare([row],common)
            if selected['status']!='selected':return None,{'status':'returned_preparation_current_admission_refused','selection':selected}
            row=deepcopy(selected['selected_row']);row={**row,**row.pop('facts')}
            material=materialize_selected(projection,row['geometry_candidate_ref'],row)
            selected['returned_preparation']={'target_ref':retained['target_ref'],'original_selection_ref':retained['selection'],'receipt':returned_preparation,'global_selection_reopened':False}
        else:
            continuation,workflow=f.source81_policy.continue_target(cf)
            if continuation['status']!='continuation':return None,{'status':'retained_source81_continuation_refused','facts':cf,'continuation':continuation}
            selected={**deepcopy(prior['selection']),'selected_row':deepcopy(row),'continuation':continuation}
    else:
        selected,workflow=f.source81_policy.prepare(candidates,common)
        if selected['status']!='selected':return None,{'status':'source81_selection_abstained','selection':selected,'workflow':workflow}
        row=deepcopy(selected['selected_row']);row={**row,**row.pop('facts')}
        material=materialize_selected(projection,row['geometry_candidate_ref'],row)
    parts=[_cell_entity(projection,c,obs) for c in row['part_cells']]
    if len(parts)!=1 or parts[0] is None:return None,{'status':'current_part_occurrence_not_unique','geometry_ref':row['geometry_candidate_ref']}
    goal_part=parts[0];subject=goal_part;phase=('capture_probe'if row.get('conditional_peer_contact')else'independent_access')if independent else('loaded_access'if mode=='bound_pair'else'grasp_access')
    if material['prospective_grasp_conditional_translation_access']:
        subject=_cell_entity(projection,row['translated_cell_origin'],obs)
        if subject is None:return None,{'status':'conditional_translation_subject_not_unique'}
        phase='translation_probe' if material['prospective_grasp_translation_contact_now'] else 'translation_access'
    actions=[{'action_ref':a}for a in material['prospective_grasp_action_refs']]
    prepared=f.prepared_source81 if independent else None
    if mode=='bound_pair':
        part_ids=projection['component_entity_bindings'].get(projection['binding']['part_ref'],[])
        if part_ids!=[subject['id']]:return None,{'status':'current_part_identity_namespace_join_failed'}
        prepared=stationary_return.retain_selected(scene,f.question,f.recipe,row,subject,obs['observation_ref'],obs['level_epoch'],selected['selected_ref'],prior=f.prepared_source81,binding={**projection['binding'],'part_entity_ref':subject['id']})
    context=digest([obs['level_epoch'],rows]);history=f.input_trials.get(context,[])
    first_action=actions[0]if actions else None
    selection_declaration,_=f.source81_policy.drm.resolve(selected['policy_ref'])
    tiers=selection_declaration.selection_tiers
    tier_reasons=[t.reason_ref for t in tiers if f.policy.holds(t.all_conditions,row)and(not t.any_conditions or any(f.policy.holds([c],row)for c in t.any_conditions))]
    source_context={'current_candidate_origin':'source81_materialized_composition',
        'source81_selection_context_complete':len(tier_reasons)==1 and selected['assessment']['alternatives']['selected']==selected['selected_ref'],
        'source81_selected_reason_ref':tier_reasons[0]if len(tier_reasons)==1 else None}
    facts={**row,**material,**source_context,'current_parent_peer_bound':True,'canonical_premise_claim_refs':claims,'release_premise_claim_refs':[],'premise_claim_refs':list(dict.fromkeys([*row.get('premise_claim_refs',[]),*claims])),
        'bounded_zone_state_graph_bound_reached':not projection['inventory'].get('enumeration_complete',False),
        'bounded_zone_state_enclosure_maximum_area_candidate_count':1,
        'candidate_is_bounded_zone_state_route_first_action':bool(actions),
        'incoming_declared_route_engagement_present':False,
        'attempted_without_effect_in_current_context':bool(first_action and any(t['action']==first_action and not t['changed']for t in history))}
    if prepared:facts.update(stationary_return.facts(prepared,row))
    if not actions:
        if prepared and prepared['phase']=='inverse_question_pending':
            phase='inverse_probe';actions=[{'action_ref':prepared['operator_action_ref']}]
        elif material['prospective_grasp_ready'] and mode=='unbound':
            operators=entry['explicit_operator_candidates']
            if len(operators)!=1:return None,{'status':'operator_hypothesis_not_unique'}
            phase='grasp_probe';actions=[{'action_ref':operators[0]['action_ref']}]
        else:return None,{'status':'selected_geometry_has_no_current_intervention','material':material}
    if continuation and phase.endswith('access'):
        publication={'status':'projected','facts':{**facts,**{k:prior['publication']['facts'][k]for k in ('active_goal_ref','subgoal_ref','expected_effect_class')}},'continuation':continuation,'projection_refs':['v6.source81.validated_target_continuation']};publication_workflow=workflow
    else:publication,publication_workflow=f.source81_policy.project(facts)
    if phase=='capture_probe'and any(t['action']==actions[0]for t in history):return None,{'status':'capture_probe_already_tried_unchanged_context'}
    if phase=='grasp_probe':
        ready_facts={'selected_current_grasp_ready':material['prospective_grasp_ready']and selected['status']=='selected',
            'current_parent_peer_bound':common['current_identity_binding'],
            'current_subject_unique':sum(e['bbox']==subject['bbox']and e['palette_value']==subject['palette_value']and digest(e.get('mask'))==digest(subject.get('mask'))for e in obs['entities'])==1,
            'current_operator_candidate_available':actions[0]['action_ref']in obs['available_action_refs'],
            'current_preservation_bound':subject['bbox']not in(scene['body']['bbox'],scene['peer']['bbox']),
            'current_context_untried':not any(t['action']==actions[0]for t in history)}
        ready,ready_workflow=f.policy.ready_operator(ready_facts)
        if ready['status']!='admitted_experiment':return None,{'status':'current_grasp_operator_not_admitted','facts':ready_facts}
        publication={'status':'projected','facts':facts,'adaptation':ready,'projection_refs':[ready['declaration']['id']],'original_publication':publication};publication_workflow=ready_workflow
    if publication['status']!='projected':return None,{'status':'source81_publication_abstained','material':material,'publication':publication}
    deltas={a:[v[0]*scene['pitch'],v[1]*scene['pitch']]for a,v in f.policy.config['direction_prior'].items()}
    expected=[];expected_parts=[];box=list(scene['body']['bbox']);partbox=list(subject['bbox'])
    for a in actions:
        if phase in('grasp_probe','inverse_probe'):
            expected.append(None);expected_parts.append(partbox);continue
        dx,dy=deltas[a['action_ref']];box=[box[0]+dx,box[1]+dy,box[2]+dx,box[3]+dy];expected.append(list(box))
        if phase in('loaded_access','translation_probe'):partbox=[partbox[0]+dx,partbox[1]+dy,partbox[2]+dx,partbox[3]+dy]
        expected_parts.append(list(partbox))
    current_target_ref=('source81_target:'+digest([obs['level_epoch'],f.question['id'],target_revision['refuted_target_ref'],row['grip_root'],row.get('future_part_cells'),target_revision['evidence']]))if target_revision else(f.source81_plan or{}).get('target_ref','source81_target:'+digest([obs['level_epoch'],f.question['id'],row['grip_root'],row['part_cells']]))
    if target_revision:target_revision['replacement_target_ref']=current_target_ref
    return {'kind':'source81_composition','current_target_ref':current_target_ref,'phase':phase,'subject':subject,'goal_part':goal_part,
        'actions':actions,'expected':expected,'expected_subjects':expected_parts,'cost':len(actions),
        'peer_distance':row.get('joint_distance',0),'route':actions if phase.endswith('access')else[],
        'attempt':digest([obs['level_epoch'],subject['bbox'],subject['palette_value'],f.control['signature'],phase]),
        'source81_row':row,'source81_material':material,'source81_projection_binding':projection['binding'],
        'source81_prepared':prepared,'target_revision':target_revision,'retained_continuation':continuation or selected.get('returned_preparation')or target_revision,'entry':entry,'selection':selected,'selection_workflow':workflow,
        'publication':publication,'publication_workflow':publication_workflow,
        'enclosure_value':projection['measurement_scope']['enclosure_value'],
        'calculation':{'source81_refs':projection['calculation_refs'],'selection':selected,'publication':publication,
                       'entry':entry,'phase':phase,'future_configuration_is_conditional':True},
        'evidence':list(dict.fromkeys([obs['observation_ref'],*claims,*f.question['origin_measurement_evidence']])),
        'context':digest([obs['level_epoch'],obs['frame_hash'],row['geometry_candidate_ref'],phase]),
        'facts':{'source81_selection_and_publication':True,'current_parent_peer_bound':True}}, {'status':'source81_current_offer','phase':phase}


def decorate(o,scene,obs):
    mutable=o['phase']in('grasp_probe','inverse_probe','translation_probe','loaded_access')
    entities=[e for e in obs['entities']if e['area']==scene['body']['area']and e['bbox']not in(scene['body']['bbox'],scene['peer']['bbox'])]
    others=[e for e in entities if not(mutable and e['bbox']==o['subject']['bbox'])]
    o['preserved_subjects']=[{'bbox':deepcopy(e['bbox']),'value':e['palette_value']}for e in others]
    o['guard_other_entities']=deepcopy(others)
    o['facts']['retained_contact_dependency']=bool(o.get('source81_prepared')or o.get('retained_continuation'))


def before(f,p,index,rows,obs):
    o=p['reactive_plan']['offer'];expected=o['body']['bbox']if index==0 else o['expected'][index-1]
    if current_body_box(rows,o['body'])!=expected:return {'admitted':False,'reason':'source81_body_position_changed'}
    if obs['level_epoch']!=p['binding']['level_epoch']or p['actions'][index]['action_ref']not in obs['available_action_refs']:return {'admitted':False,'reason':'source81_scope_or_input_changed'}
    if index==0:
        if any(obs[k]!=p['binding'][k]for k in p['binding']):return {'admitted':False,'reason':'source81_binding_stale'}
        offers,_=f.offers(obs,rows,p['reactive_plan']['remaining'])
        if sum(digest(x)==digest(o)for x in offers)!=1:return {'admitted':False,'reason':'source81_current_offer_changed'}
    subject_box=o['subject']['bbox']if index==0 else o['expected_subjects'][index-1]
    if not all(v==o['subject']['palette_value']for line in patch(rows,subject_box)for v in line):return {'admitted':False,'reason':'source81_subject_changed'}
    if not all(all(v==e['value']for line in patch(rows,e['bbox'])for v in line)for e in o['preserved_subjects']):return {'admitted':False,'reason':'source81_other_subject_changed'}
    target=o['expected'][index]
    if target is not None:
        occupied={tuple(e['bbox'])for e in o['guard_other_entities']}
        if tuple(target)in occupied:return {'admitted':False,'reason':'source81_unintended_occupied_destination'}
        for box in [target]+([o['expected_subjects'][index]]if o['phase']in('loaded_access','translation_probe')else[]):
            if not(0<=box[0]<=box[2]<len(rows[0])and 0<=box[1]<=box[3]<len(rows)):return {'admitted':False,'reason':'source81_outside_frame'}
            if any(v==o['enclosure_value']for line in patch(rows,box)for v in line):return {'admitted':False,'reason':'source81_measured_separator_in_destination'}
            blocked=list(occupied);peer_box=current_body_box(rows,o['peer'])
            if peer_box is not None:
                contact=(o['phase']=='capture_probe'and list(box)==list(peer_box)
                    and 'projection.exploration.test_contact_after_stationary_constraint_closure'in o['publication']['projection_refs']
                    and o['publication']['facts'].get('prospective_grasp_independence_observed')is True
                    and o['publication']['facts'].get('prospective_grasp_peer_exit_count_after_independent_actor')==0
                    and o['publication']['facts'].get('prospective_grasp_stationary_part_neighbor_loss',0)>0)
                if not contact:blocked.append(tuple(peer_box))
            if any(not(box[2]<b[0]or b[2]<box[0]or box[3]<b[1]or b[3]<box[1])for b in blocked):return {'admitted':False,'reason':'source81_other_current_mask_in_destination'}
    return {'admitted':True,'reason':'source81_frozen_masks_current_scope_and_declared_conditional_destination'}


def after(f,p,index,first,second):
    o=p['reactive_plan']['offer'];expected=o['expected'][index];body=current_body_box(second,o['body'])
    preserved=all(all(v==e['value']for line in patch(second,e['bbox'])for v in line)for e in o['preserved_subjects'])
    if expected is None or o['phase']=='capture_probe':return {'matched':None,'preservation_matched':preserved,'seal_prefix':True,'reason':'source81_intervention_unknown_until_return'}
    matched=body==expected
    if o['phase']in('loaded_access','translation_probe'):
        matched=matched and all(v==o['subject']['palette_value']for line in patch(second,o['expected_subjects'][index])for v in line)
    peer_same=current_body_box(second,o['peer'])==o['peer']['bbox']
    return {'matched':bool(matched),'preservation_matched':preserved,'peer_position_preserved':peer_same,'seal_prefix':not(matched and preserved)or(o['phase']=='loaded_access'and not peer_same),'reason':'source81_current_geometric_effect_not_capture'}


def record(f,o,index,before_obs,after_obs,command,first,second):
    refs=[before_obs['observation_ref'],after_obs['observation_ref']]
    if o.get('target_revision'):
        revisions=f.question.setdefault('source81_target_revisions',[])
        if not any(x['refuted_target_ref']==o['target_revision']['refuted_target_ref']and x['evidence']==o['target_revision']['evidence']for x in revisions):revisions.append(deepcopy(o['target_revision']))
    body=unique(after_obs).get(f.control['signature'])if f.control else None
    matched=bool(body and body['bbox']==o['expected'][index])
    if o['phase']=='loaded_access':
        prepared=o.get('source81_prepared')or f.prepared_source81
        if prepared:
            f.prepared_source81=stationary_return.record_loaded(prepared,before_obs,after_obs,command,o['expected'][index],o['expected_subjects'][index],at_target=index+1==len(o['actions'])and o['source81_row']['access_distance']==len(o['actions']))
        parts=[e for e in after_obs['entities']if e['bbox']==o['expected_subjects'][index]and e['palette_value']==o['subject']['palette_value']and digest(e.get('mask'))==digest(o['subject'].get('mask'))]
        if matched and len(parts)==1 and f.recipe:
            f.recipe['subject_box']=deepcopy(parts[0]['bbox']);f.recipe['offset']=[parts[0]['bbox'][i]-body['bbox'][i]for i in(0,1)];f.recipe['evidence']=list(dict.fromkeys(f.recipe['evidence']+refs))
        else:f.question['source81_loaded_contradiction']={'refs':refs,'body_arrival':matched,'part_arrival':len(parts)==1}
    elif o['phase']=='inverse_probe':
        f.prepared_source81=stationary_return.record_inverse(o['source81_prepared'],before_obs,after_obs,command)
    elif o['phase']=='independent_access':
        f.prepared_source81=stationary_return.record_independent(f.prepared_source81,before_obs,after_obs,command,o['expected'][index])
    elif o['phase']=='capture_probe':
        f.question['source81_capture_contact_result']={'refs':refs,'outcome':'official_boundary_required','score_before':before_obs['levels_completed'],'score_after':after_obs['levels_completed']}
    elif o['phase']=='translation_probe':
        parts=[e for e in after_obs['entities']if e['bbox']==o['expected_subjects'][index]and e['palette_value']==o['subject']['palette_value']and digest(e.get('mask'))==digest(o['subject'].get('mask'))]
        f.question.setdefault('source81_translation_receipts',[]).append({'refs':refs,'subject_before':o['subject']['bbox'],'subject_after_expected':o['expected_subjects'][index],'actual_body_arrival':matched,'actual_subject_arrival':len(parts)==1,'mechanism_not_universal':True})
        preserved=all(all(v==e['value']for line in patch(second,e['bbox'])for v in line)for e in o['preserved_subjects'])
        if matched and len(parts)==1 and preserved:
            target=deepcopy(o['source81_row']);origin=target['translated_cell_origin'];dx=parts[0]['bbox'][0]-o['subject']['bbox'][0];dy=parts[0]['bbox'][1]-o['subject']['bbox'][1]
            if dx%o['pitch']==0 and dy%o['pitch']==0:
                current_cell=[origin[0]+dy//o['pitch'],origin[1]+dx//o['pitch']];finished=current_cell==target['translated_cell_destination']
                target['translated_cell_origin']=current_cell
                if finished:target['conditional_translation_access']=False;target['translated_cell_origin']=None;target['translated_cell_destination']=None
                f.source81_plan={'parent':f.question['id'],'selection':o['selection']['selected_ref'],'target':target,'target_ref':o.get('current_target_ref')or(f.source81_plan or{}).get('target_ref','source81_target:'+digest([f.question['id'],target['grip_root'],target['part_cells']])),'last_received':refs,'completed_prefix':1,'offer':deepcopy(o),'scope':after_obs['level_epoch'],'compatible_translation_return':{'refs':refs,'body_arrival':True,'subject_arrival':True,'preservation':True,'translation_preparation_finished':finished,'parent_goal_unchanged':True}}
                f.question['source81_preparation_return']=deepcopy(f.source81_plan['compatible_translation_return'])
                return {'status':'source81_translation_child_returned_to_same_preparation','evidence':refs,'preparation_finished':finished,'capture_proved':False}
    if o['phase'].endswith('access')and matched:
        f.source81_plan={'parent':f.question['id'],'selection':o['selection']['selected_ref'],'target':deepcopy(o['source81_row']),'target_ref':o.get('current_target_ref')or(f.source81_plan or{}).get('target_ref','source81_target:'+digest([f.question['id'],o['source81_row']['grip_root'],o['source81_row']['part_cells']])),'last_received':refs,'completed_prefix':index+1,'offer':deepcopy(o),'scope':after_obs['level_epoch']}
        if o['phase']=='independent_access'and index+1>=o['source81_row']['access_distance']:f.source81_plan=None
        # Other preparation targets remain until their intervention has returned.
    elif o['phase']not in('grasp_probe',):f.source81_plan=None
    return {'status':'source81_parent_return','phase':o['phase'],'evidence':refs,'body_position_matched':matched,'official_capture':False,'prepared_phase':(f.prepared_source81 or{}).get('phase')}
