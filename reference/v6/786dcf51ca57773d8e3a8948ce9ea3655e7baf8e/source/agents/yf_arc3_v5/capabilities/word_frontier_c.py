"""Transport exact acquired K30 returns; Source/DRM own their causal meaning."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .word_frontier_contracts_c import WordFrontierReturnC,WordFrontierAgendaRequestC
from .family_agenda_projection import FamilyAgendaReceipt
from .scoped_frontier_agenda_root import bind_scoped_frontier_agenda,finish_scoped_frontier_agenda
from agents.yf_arc3_v5.logos.types import stable_digest
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .articulated_dependency_measurement_c import _nodes
from .mechanical_return_a import mechanical_request_identity_a


def bind_word_frontier_native(value):
    if value.measured.missing_refs:raise ValueError('Source must return acquired word Need before calculation')
    return value.measured.request.native_request


def finish_word_frontier_canonical(value):
    returned=value.returned;missing=list(returned.missing_refs);rows=[];work=returned.parent_return.get('accounted_evaluations',0)
    for request,response in ((returned.measured.canonical_before_request,value.before_return),
            (returned.measured.canonical_after_request,value.after_return)):
        identity=mechanical_request_identity_a(request,'mechanics.typed_word_transduction',request.scope,request.operation_ref,request.mode)
        if response is None or response.request!=identity:
            missing.append('word.frontier_exact_canonical_pair_return');continue
        try:result=MechanicalFamilyResult.model_validate(response.descriptive_values.get('calculation'))
        except (ValidationError,TypeError,ValueError):missing.append('word.frontier_typed_canonical_return');continue
        work+=result.examined_count
        if (result.scope!=request.scope or result.operation_ref!=request.operation_ref or result.mode!=request.mode
                or not result.signature_supported or not result.domain_complete or result.computation_bound_reached
                or result.prerequisite_refs or result.implementation_debt_refs):
            missing.append('word.frontier_complete_canonical_pair');continue
        rows.append(result.values.get('canonical_tiles',()))
    remaining=max(0,returned.measured.request.maximum_evaluations-work)
    projection=_nodes(tuple(rows),remaining//3)
    if projection is None:missing.append('word.frontier_complete_canonical_comparison_bound')
    else:work+=3*projection
    comparisons=[]
    if len(rows)==2 and projection is not None:
        before={row['glyph_ref']:row for row in rows[0]};after={row['glyph_ref']:row for row in rows[1]}
        if len(before)!=len(rows[0]) or len(after)!=len(rows[1]):missing.append('word.frontier_unique_canonical_glyph_domain')
        else:
            for ref in sorted(set(before)|set(after)):
                a,b=before.get(ref),after.get(ref)
                comparisons.append(FrozenMap({'glyph_ref':ref,'before_canonical_mask':a.get('canonical_mask') if a else None,
                    'after_canonical_mask':b.get('canonical_mask') if b else None,
                    'canonical_identity_changed':a is None or b is None or a['canonical_mask']!=b['canonical_mask'],
                    'display_pose_changed':a is not None and b is not None and a['observed_pose_ref']!=b['observed_pose_ref']}))
    derivation_request=returned.measured.derivation_request
    derivation_values=returned.parent_return.get('native_values',FrozenMap())
    derivation_source=returned.measured.request.native_request
    if derivation_request is not None:
        derivation_source=derivation_request;response=value.derivation_return
        identity=mechanical_request_identity_a(derivation_request,'mechanics.typed_word_transduction',
            derivation_request.scope,derivation_request.operation_ref,derivation_request.mode)
        result=None
        if response is None or response.request!=identity:missing.append('word.frontier_exact_derivation_return')
        else:
            try:result=MechanicalFamilyResult.model_validate(response.descriptive_values.get('calculation'))
            except (ValidationError,TypeError,ValueError):missing.append('word.frontier_typed_derivation_return')
        derivation_values=FrozenMap()
        if result is not None:
            work+=result.examined_count
            if (result.scope!=derivation_request.scope or result.operation_ref!=derivation_request.operation_ref
                    or result.mode!=derivation_request.mode or not result.signature_supported or not result.domain_complete
                    or result.computation_bound_reached or result.prerequisite_refs or result.implementation_debt_refs):
                missing.append('word.frontier_complete_current_derivation')
            else:derivation_values=result.values
    projection=_nodes(derivation_values,max(0,returned.measured.request.maximum_evaluations-work)//4)
    alternatives=[]
    if projection is None:missing.append('word.frontier_complete_typed_span_projection_bound')
    else:
        work+=4*projection
        highlights=returned.measured.facts.get('actual_highlighted_spans',())
        paths=[]
        for parse in derivation_values.get('parses',()):
            paths.append((parse['output_word'],((derivation_source.input_type_ref,derivation_source.output_type_ref,
                parse['derivation']),),(derivation_source.input_word,parse['output_word'])))
        for output,intermediates,stages in derivation_values.get('compositions',()):
            paths.append((output,stages,intermediates))
        span_work=sum(len(trace) for _,stages,_ in paths for _,_,trace in stages)*(len(highlights)+4)
        if work+span_work>returned.measured.request.maximum_evaluations:
            missing.append('word.frontier_complete_highlight_join_bound');paths=[]
        else:work+=span_work
        for output,stages,words in paths:
            spans=[]
            for stage_index,(input_type,output_type,trace) in enumerate(stages):
                for start,end,out_start,out_end,rule_ref,provenance in trace:
                    matched=tuple(h for h in highlights if h[2]==rule_ref and
                        ((h[0],h[1])==(start,end) or (h[0],h[1])==(out_start,out_end)))
                    spans.append(FrozenMap({'stage_index':stage_index,'input_type_ref':input_type,
                        'output_type_ref':output_type,'input_span':(start,end),'output_span':(out_start,out_end),
                        'rule_ref':rule_ref,'provenance_refs':provenance,'matching_highlights':matched}))
            covered={h for span in spans for h in span['matching_highlights']}
            alternatives.append(FrozenMap({'output_word':output,'stage_words':words,'typed_rule_spans':tuple(spans),
                'unexplained_highlights':tuple(h for h in highlights if h not in covered)}))
        if returned.measured.request.native_request.operation_ref.endswith('.validation_evidence'):
            supplied=set(returned.measured.request.native_request.supplied_derivation or ())
            if not any(supplied=={(span['input_span'][0],span['input_span'][1],span['rule_ref'])
                    for span in alternative['typed_rule_spans']} for alternative in alternatives):
                missing.append('word.frontier_supplied_spans_require_native_derivation_witness')
    parent=FrozenMap({**dict(returned.parent_return),'canonical_identity_comparisons':tuple(comparisons),
        'typed_derivation_alternatives':tuple(alternatives),'typed_derivation_request':immutable_json_data(derivation_source),
        'canonical_pair_complete':len(rows)==2 and projection is not None and not bool(missing),
        'calculation_bound':returned.parent_return.get('calculation_bound') is True and not bool(missing),
        'incomplete_calculation_bound':bool(missing) and returned.parent_return.get('native_result') is not None,
        'accounted_evaluations':work,'missing_refs':tuple(sorted(set(missing)))})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing)))})


def finish_word_frontier_calculation(value):
    from .scoped_frontier_calculation_c import qualify_scoped_frontier_calculation
    measured=value.measured;request=measured.request;native=request.native_request
    result,values,_,missing,work=qualify_scoped_frontier_calculation(measured,value.returned,error_refs={
        'identity':'word.frontier_exact_current_native_return','typed':'word.frontier_typed_K30_return',
        'scope':'word.frontier_supported_exact_K30_scope','incomplete':'word.frontier_incomplete_K30_domain',
        'absent':'word.frontier_requested_native_return_absent','projection':'word.frontier_complete_result_projection_bound'})
    parent=FrozenMap({**dict(measured.facts),'calculation_bound':result is not None and not bool(missing),
        'incomplete_calculation_bound':result is not None and not measured.missing_refs and bool(missing),
        'native_operation_ref':native.operation_ref,'native_values':values,
        'native_result':immutable_json_data(result) if result is not None else None,
        'normalized_return':immutable_json_data(value.returned),'exact_demand':immutable_json_data(request.demand),
        'epoch':request.agenda.epoch,'episode_ref':request.agenda.episode_ref,'level_scope_ref':request.agenda.level_scope_ref,
        'input_revision_ref':request.demand.request.input_revision_ref,'scope_ref':request.demand.scope_ref,
        'canonical_tiles':values.get('canonical_tiles',()),
        'matching_validation_spans':values.get('matching_spans',()),
        'unexpected_validation_spans':values.get('unexpected_highlights',()),
        'unhighlighted_derivation_spans':values.get('unhighlighted_derivation_spans',()),
        'actual_highlighted_spans':measured.facts.get('actual_highlighted_spans',()),
        'supplied_derivation':native.supplied_derivation,
        'native_edit_successors':values.get('successors',()),
        'incomplete_prediction_frontier':result.frontier if result is not None and result.computation_bound_reached else None,
        'accounted_evaluations':work,'missing_refs':tuple(sorted(set(missing))),
        'principal_goal_changed':False,'execution_authority':False})
    return WordFrontierReturnC(measured=measured,returned=value.returned,parent_return=parent,missing_refs=tuple(sorted(set(missing))))


def seal_word_frontier_interpretation(value):
    returned=value.calculated;meaning=value.meaning;missing=list(returned.missing_refs)
    if meaning is not None:
        if (meaning.rule_ref!='rule.word_frontier_c' or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=item for key,item in sorted(returned.parent_return.items()))):
            missing.append('word.frontier_exact_declared_interpretation');meaning=None
    elif returned.parent_return.get('calculation_bound'):missing.append('word.frontier_current_declared_meaning')
    local=tuple(immutable_json_data(claim) for claim in meaning.conclusions
        if claim.predicate=='records_current_scoped_word_frontier_evidence') if meaning is not None else ()
    if meaning is not None and len(local)!=1:
        missing.append('word.frontier_exact_local_confirmation_claim')
    packet=FrozenMap({**dict(returned.parent_return),'declared_interpretation':immutable_json_data(meaning),
        'scoped_word_effect_claim':local[0] if len(local)==1 else None,
        'parent_means_revalidation_needs':tuple(immutable_json_data(term) for term in meaning.terms
            if term.attributes.get('requires_parent_means_revalidation') is True) if meaning is not None else (),
        'scoped_interpretation_current':meaning is not None and not bool(missing),
        'current_information_needs':tuple(immutable_json_data(term) for term in meaning.terms
            if term.attributes.get('requires_current_evidence') is True) if meaning is not None else (),
        'missing_refs':tuple(sorted(set(missing))),'execution_authority':False})
    return returned.model_copy(update={'parent_return':packet,'missing_refs':tuple(sorted(set(missing)))})


def join_word_frontier_publication(value):
    publication=value.publication;returned=publication.returned;published=value.published
    missing=list((*returned.missing_refs,*publication.missing_refs));receipt=None
    if (published is None or published.request!=publication.publication_request
            or not published.canonical_payload_equal or published.missing_refs):
        missing.append('word.frontier_exact_canonical_publication_receipt')
    elif not missing:
        receipt=FamilyAgendaReceipt(receipt_ref='receipt.word.frontier.'+stable_digest((published,returned.returned)),
            demand=returned.measured.request.demand,result=returned.returned)
    parent=FrozenMap({**dict(returned.parent_return),'canonical_publication_applied':receipt is not None,
        'agenda_receipt':immutable_json_data(receipt),'current_parent_consumer_ref':returned.measured.request.why.consumer_ref,
        'next_item_ref':returned.measured.request.why.next_item_ref,
        'eligible_sibling_refs_preserved':returned.measured.request.native_request.scope.eligible_sibling_refs,
        'missing_refs':tuple(sorted(set(missing))),'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing)))})


def bind_word_frontier_agenda(value):
    return WordFrontierAgendaRequestC(request=bind_scoped_frontier_agenda(value.returned,
        predicate_ref='records_current_scoped_word_frontier_evidence'))


def finish_word_frontier_agenda(value):
    return finish_scoped_frontier_agenda(value.returned,value.published,missing_prefix='word.frontier_')
