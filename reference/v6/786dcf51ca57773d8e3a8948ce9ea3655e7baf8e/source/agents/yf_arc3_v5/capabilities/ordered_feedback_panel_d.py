"""Current ordered-panel measurements through the existing feedback kernel.

Both supplied repetition models remain calculations. DRM selects their current
applicability and the next input; no code, law or executable route is selected
here. Complete minimum populations are measured before compact WHY transport.
"""
from itertools import permutations
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .ordered_feedback_geometry_d import measure_ordered_feedback_scene
from .mechanical_family_contracts_a import MechanicalFamilyScope
from .feedback_code_identification import (FeedbackAccountingLaw,CodeFeedbackRow,
    CodeInterfaceState,CodeTrial,FeedbackCodeRequest,measure_feedback_code_identification)
from .agenda_measurement_transport import append_candidate_measurements


def _value_ref(paint):
    return 'measurement.ordered_value.'+str(paint)


def _domain(value,scene,contract,model):
    n=len(scene['geometry']['rank_lefts']);history=scene['history_rows']
    marks=tuple(sorted({p for row in history for p in row['style_values']}))
    if len(marks)>3:return None
    styles=tuple('measurement.feedback_style.'+str(p)for p in marks)
    styles+=tuple('measurement.unobserved_style.'+str(i)for i in range(3-len(styles)))
    revealed=tuple(p if p in scene['alphabet']else None for p in scene['upper_values'])
    laws=[]
    for i,assignment in enumerate(permutations(styles)):
        exact,elsewhere,absent=assignment
        if any((('measurement.feedback_style.'+str(mark))==exact)!=(revealed[j]==row['values'][j])
               for row in history for j,mark in enumerate(row['style_values'])):
            continue
        for order in contract['allocation_orders']:
            laws.append(FeedbackAccountingLaw(law_ref=f'measurement.feedback_assignment.{i}.{order}',
                exact_ref=exact,elsewhere_ref=elsewhere,absent_ref=absent,allocation_order=order))
    if not laws:return None
    epoch=value.observed_level_index or value.current_context_epoch or 0
    rows=tuple(CodeFeedbackRow(evidence_ref='measurement.feedback_row.'+stable_digest(
        (tuple(row['values']),tuple(row['style_values']))),model_epoch=epoch,
        trial=tuple(_value_ref(p)for p in row['values']),
        feedback=tuple('measurement.feedback_style.'+str(p)for p in row['style_values']))for row in history)
    state=CodeInterfaceState(proposal=tuple(_value_ref(p)for p in scene['prefix'])+(None,)*(n-len(scene['prefix'])),
        revealed=tuple(_value_ref(p)if p is not None else None for p in revealed),
        attempts_remaining=scene['attempts_remaining'],history=rows,recovery_epoch=value.current_context_epoch or 0)
    token=stable_digest(immutable_json_data((scene,model)))[:16]
    scope=MechanicalFamilyScope(request_ref='measurement.ordered_feedback.'+token,
        epoch=value.current_context_epoch or 0,evidence_revision_ref=value.current_observation_frame_ref,
        model_revision_ref=scene['contract_digest'],event_owner_ref='measurement.ordered_feedback.'+token,
        **dict(contract['scope']))
    request=FeedbackCodeRequest(scope=scope,operation_ref=contract['filter_operation_ref'],
        mode=contract['filter_mode'],alphabet=tuple(_value_ref(p)for p in scene['alphabet']),
        secret_length=n,duplicates_allowed=model['duplicates_allowed'],candidate_domain_complete=True,
        candidate_source=contract['candidate_source'],active_model_epoch=epoch,laws=tuple(laws),state=state,
        **dict(contract['search_bounds']))
    filtered=measure_feedback_code_identification(request)
    if not filtered.domain_complete or filtered.computation_bound_reached:return None
    codes=tuple(filtered.values['candidate_residual'])
    prefix=tuple(_value_ref(p)for p in scene['prefix'])
    words=tuple(code for code in codes if code[:len(prefix)]==prefix)
    if not words or len(words)>contract['maximum_trial_count']:return None
    trials=tuple(CodeTrial(trial_ref='measurement.current_trial.'+stable_digest(word)[:16],values=word)for word in words)
    partition_request=request.model_copy(update={'operation_ref':contract['partition_operation_ref'],
        'mode':contract['partition_mode'],'candidate_source':'PROVIDED','candidates':codes,
        'trials':trials,'declared_measures':tuple(contract['declared_measures'])})
    partitioned=measure_feedback_code_identification(partition_request)
    if not partitioned.domain_complete or partitioned.computation_bound_reached:return None
    partitions=partitioned.values['partitions']
    metrics={r['trial_ref']:tuple(dict(r['declared_measures'])[metric]
        for metric in contract['declared_measures'])for r in partitions}
    if len(metrics)!=len(trials):return None
    minimum=min(metrics.values())
    population=tuple(trial.values for trial in trials if metrics[trial.trial_ref]==minimum)
    if not population:return None
    ordinal=len(prefix)
    next_refs=tuple(sorted({word[ordinal]for word in population}))if ordinal<n else ()
    return FrozenMap({'domain_complete':True,'candidate_count':len(codes),'law_count':len(laws),
        'compatible_law_count':len(filtered.values['compatible_law_refs']),
        'minimum_metrics':minimum,'minimum_population_count':len(population),
        'minimum_population_digest':stable_digest(population),'next_value_refs':next_refs,
        'full_current_word_in_minimum_population':ordinal==n and prefix in population,
        'calculation_proof':FrozenMap({'constraint_request':request.model_dump(mode='json'),
            'constraint_return_digest':stable_digest(filtered),'partition_request_digest':stable_digest(partition_request),
            'partition_return_digest':stable_digest(partitioned),'partition_trial_count':len(trials),
            'partition_inputs':'all complete compatible codes extending the currently observed prefix',
            'candidate_domain_count':len(codes),'minimum_population_count':len(population),
            'minimum_metrics':minimum,'minimum_population_digest':stable_digest(population),
            'witnesses':population[:contract['maximum_inspection_witnesses']],
            'witness_cap_not_used_for_population_membership':True,
            'examined_count':filtered.examined_count+partitioned.examined_count})})


def _unique_compacted_input_word(scene,result,contract):
    supplied=contract.get('unique_input_series_contract')or{}
    if not supplied or not scene['input_compaction_correspondence_observed']:
        return ()
    if not result or result['candidate_count']!=1 or result['minimum_population_count']!=1:
        return ()
    if scene['attempts_used']<supplied['minimum_observed_submissions']:
        return ()
    witnesses=result['calculation_proof']['witnesses']
    if len(witnesses)!=1:return ()
    word=tuple(witnesses[0]);prefix=tuple(_value_ref(p)for p in scene['prefix'])
    if word[:len(prefix)]!=prefix:return ()
    paints={_value_ref(p):p for p in scene['alphabet']};palette=list(scene['geometry']['palette_values'])
    geometry=scene['geometry'];payloads=[]
    for ref in word[len(prefix):]:
        paint=paints.get(ref)
        if paint not in palette:return ()
        ordinal=palette.index(paint)
        payloads.append(FrozenMap({'x':geometry['rank_lefts'][0]+ordinal*geometry['pitch']+geometry['extent']//2,
            'y':geometry['palette_row_top']+geometry['extent']//2}))
        palette.remove(paint)
    y,x=geometry['control']['point'];payloads.append(FrozenMap({'x':x,'y':y}))
    if not 1<len(payloads)<=supplied['maximum_actions']:return ()
    return tuple(payloads)


def measure_ordered_feedback_candidates(value,contract):
    scene=measure_ordered_feedback_scene(value,contract)
    if scene is None or scene['attempts_remaining']<=0:return None
    results={model['model_key']:_domain(value,scene,contract,model)for model in contract['domain_models']}
    if not any(results.values()):return None
    common=FrozenMap({'schema_ref':contract['schema_ref'],'contract_digest':scene['contract_digest'],
        'scope_signature':scene['scope_signature'],'scene':scene,
        'source_frame_ref':value.current_observation_frame_ref,'source_frame_digest':scene['source_frame_digest'],
        'conditional_model_assignments':contract['conditional_model_assignments'],
        'domain_calculations':FrozenMap({key:result for key,result in sorted(results.items())if result}),
        'prior_dispatched_context_scope_matches':scene['prior_scope_matches']})
    e=scene['geometry']['extent'];ys=scene['geometry']['palette_row_top'];xs=scene['geometry']['rank_lefts']
    palette={ (ys+e//2,xs[0]+i*scene['geometry']['pitch']+e//2):p
        for i,p in enumerate(scene['geometry']['palette_values'])}
    control=tuple(scene['geometry']['control']['point']);points=tuple(sorted((*palette,control)))
    unique_payloads=_unique_compacted_input_word(scene,results.get('exclude_repetition'),contract)
    measured={}
    for point in points:
        facts={'ordered_feedback_scene_current':True,'ordered_feedback_current_measurement':common,
            'ordered_feedback_prefix_count':len(scene['prefix']),
            'ordered_feedback_current_prefix_repeated_count':len(scene['prefix'])-scene['current_prefix_distinct_count'],
            'ordered_feedback_current_palette_overlap_count':scene['current_palette_overlap_count'],
            'ordered_feedback_prior_prefix_distinct_count':scene['prior_prefix_distinct_count'],
            'ordered_feedback_prior_prefix_repeated_count':scene['prior_prefix_repeated_count'],
            'ordered_feedback_prior_palette_overlap_count':scene['prior_palette_overlap_count'],
            'ordered_feedback_prior_scope_matches':scene['prior_scope_matches'],
            'ordered_feedback_attempts_remaining':scene['attempts_remaining'],
            'ordered_feedback_palette_concentric_frame_count':scene['palette_concentric_frame_count'],
            'ordered_feedback_control_outer_frame_count':scene['control_outer_frame_count'],
            'ordered_feedback_route_remaining_step_count':value.incoming_declared_route_remaining_step_count,
            'ordered_feedback_unique_input_series_length':len(unique_payloads),
            'ordered_feedback_unique_input_series_first_point':bool(unique_payloads and
                point==(unique_payloads[0]['y'],unique_payloads[0]['x'])),
            'ordered_feedback_unique_input_series_action_refs':(contract['point_action_ref'],)*len(unique_payloads),
            'ordered_feedback_unique_input_series_payloads':unique_payloads,
            'ordered_feedback_unique_input_series_component_refs':(None,)*len(unique_payloads),
            'ordered_feedback_unique_input_series_candidate_refs':()}
        for key,result in sorted(results.items()):
            facts['ordered_feedback_'+key+'_complete']=bool(result)
            facts['ordered_feedback_'+key+'_candidate_count']=result['candidate_count']if result else 0
            facts['ordered_feedback_'+key+'_next_palette_point']=bool(result and point in palette
                and _value_ref(palette[point])in result['next_value_refs'])
            facts['ordered_feedback_'+key+'_full_submit_point']=bool(result and point==control
                and result['full_current_word_in_minimum_population'])
        measured[point]=FrozenMap(facts)
    return measured


def append_ordered_feedback_candidates(value,agenda,contract,point_producer):
    rows=measure_ordered_feedback_candidates(value,contract)
    if not rows:return agenda
    represented={c.point for c in agenda.candidates if c.action_ref==contract['point_action_ref']}
    missing=tuple(p for p in sorted(rows)if p not in represented)
    additions=tuple((c,f)for c,f in point_producer(value,
        frozenset(agenda.current_context_no_effect_candidate_refs),
        frozenset(agenda.tested_candidate_refs_without_resolution_plan),{},{},{},{},requested_points=missing)
        if c.point in missing)if missing and contract['point_action_ref']in value.available_action_refs else ()
    if len(agenda.candidates)+len(additions)>contract['maximum_frontier_candidates']:return agenda
    candidates=list(agenda.candidates);facts=dict(agenda.alternative_facts)
    deltas=dict(agenda.descriptive_delta_facts or agenda.alternative_facts);refs=set(agenda.alternative_refs)
    for candidate,base in additions:
        if candidate.candidate_ref not in refs:
            candidates.append(candidate);refs.add(candidate.candidate_ref)
            facts[candidate.candidate_ref]=base;deltas[candidate.candidate_ref]=base
    agenda=agenda.model_copy(update={'candidates':tuple(candidates),
        'alternative_refs':tuple(c.candidate_ref for c in candidates),
        'alternative_facts':FrozenMap(facts),'descriptive_delta_facts':FrozenMap(deltas),
        'has_candidates':bool(candidates)})
    measured={c.candidate_ref:rows[c.point]for c in agenda.candidates
        if c.action_ref==contract['point_action_ref']and c.point in rows}
    return append_candidate_measurements(agenda,FrozenMap(measured),FrozenMap())
