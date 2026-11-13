"""Exact family request/result transport for the shared frontier SRC pipeline."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .effect_frontier_contracts_c import EffectFrontierReturnC,EffectFrontierAgendaRequestC
from .scoped_frontier_calculation_c import qualify_scoped_frontier_calculation
from .articulated_dependency_measurement_c import _nodes
from .coupled_value_contracts_c import CoupledValueSourceReturnC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .mechanical_return_a import assemble_mechanical_response_a
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .family_agenda_projection import FamilyAgendaReceipt
from .scoped_frontier_agenda_root import bind_scoped_frontier_agenda,finish_scoped_frontier_agenda
from agents.yf_arc3_v5.logos.types import stable_digest
from .effect_frontier_axes_c import measure_effect_frontier_axes,measure_program_frontier_axes
from .program_effect_c import PROGRAM_EFFECT_RESULT_MODELS_C
from .contracts import TypedInterpreterMeasurements,TypedAssignmentDomainsMeasurements
from .mechanical_family_contracts_d import DMechanicalRequest,DMechanicalResult
from .effect_frontier_d_transport import qualify_d_frontier_return
from .reactive_graph_contracts_c import ReactiveGraphSourceReturnC
from .metric_frontier_contracts_d import MetricFrontierRequestD
from .metric_frontier_transport_d import qualify_metric_frontier_return_d


def bind_effect_frontier_native(value):
    if value.measured.missing_refs:
        raise ValueError('Source must return acquired information Need before native calculation')
    return value.measured.request.native_request


def bind_effect_frontier_coupled_measurement(value):
    returned=value.returned;request=value.measured.request
    if (request.family!='coupled' or value.measured.missing_refs
            or not isinstance(returned,CoupledValueSourceReturnC) or returned.frozen_request!=request.native_request):
        raise ValueError('Source must retain the exact acquired coupled calculation')
    return returned.calculation.native


def bind_coupled_mechanical_response(value):
    # Only immutable transport; Source selects status and the common workflow normalizes.
    return assemble_mechanical_response_a(value)


def finish_effect_frontier_calculation(value):
    measured=value.measured;request=measured.request;native=request.native_request
    if isinstance(native,MetricFrontierRequestD):
        result,values,missing,work=qualify_metric_frontier_return_d(measured,value.returned)
    elif isinstance(native,DMechanicalRequest):
        result,values,missing,work=qualify_d_frontier_return(measured,value.returned)
    elif request.family=='program':
        missing=list(measured.missing_refs);result=None;response=value.returned
        if not isinstance(response,MechanicalNormalizedReturn) or response.request!=request.demand.request:
            missing.append('effect.frontier_exact_typed_program_normalized_return')
        else:
            try:result=PROGRAM_EFFECT_RESULT_MODELS_C[native.operation_ref.rsplit('.',1)[-1]].model_validate(
                response.descriptive_values.get('typed_measurement'))
            except (TypeError,ValueError):missing.append('effect.frontier_actual_specialized_program_output')
            if response.status!='FOUND':missing.append('effect.frontier_incomplete_typed_program_scope')
        values=immutable_json_data(result) if result is not None else FrozenMap()
        work=measured.accounted_evaluations
        if isinstance(result,TypedInterpreterMeasurements):work+=result.steps_executed+result.calls_executed
        elif isinstance(result,TypedAssignmentDomainsMeasurements):work+=result.assignment_visits+result.matching_visits
        projection=_nodes(values,max(0,request.maximum_evaluations-work))
        if projection is None:missing.append('effect.frontier_complete_typed_result_projection');values=FrozenMap()
        else:work+=projection
    elif request.family not in ('coupled','reactive_graph') or isinstance(value.returned,MechanicalNormalizedReturn):
        response=value.returned if isinstance(value.returned,MechanicalNormalizedReturn) else None
        result,values,_,missing,work=qualify_scoped_frontier_calculation(measured,response,error_refs={
            'identity':'effect.frontier_exact_native_return','typed':'effect.frontier_typed_native_return',
            'scope':'effect.frontier_exact_native_scope','incomplete':'effect.frontier_incomplete_native_domain',
            'absent':'effect.frontier_requested_native_return_absent','projection':'effect.frontier_complete_result_projection'})
        if value.returned is not None and response is None:missing.append('effect.frontier_typed_normalized_return_required')
    else:
        missing=list(measured.missing_refs);returned=value.returned;result=None
        frozen_type=ReactiveGraphSourceReturnC if request.family=='reactive_graph' else CoupledValueSourceReturnC
        if not isinstance(returned,frozen_type) or returned.frozen_request!=native:
            missing.append('effect.frontier_exact_reactive_graph_source_return' if request.family=='reactive_graph' else 'effect.frontier_exact_coupled_source_return')
        else:
            result=returned.calculation.native
            if (result.scope!=native.scope or result.operation_ref!=native.operation_ref or result.mode!=native.mode
                    or not result.signature_supported):
                missing.append('effect.frontier_exact_reactive_graph_scope' if request.family=='reactive_graph' else 'effect.frontier_exact_coupled_calculation_scope');result=None
            elif not result.domain_complete or result.computation_bound_reached:
                missing.append('effect.frontier_incomplete_reactive_graph_domain' if request.family=='reactive_graph' else 'effect.frontier_incomplete_coupled_domain')
            if result is not None:missing.extend((*result.prerequisite_refs,*result.implementation_debt_refs))
        work=measured.accounted_evaluations+(returned.calculation.native.examined_count
            if isinstance(returned,frozen_type) else 0)
        values=result.values if result is not None else FrozenMap()
        projection=_nodes(values,max(0,request.maximum_evaluations-work))
        if projection is None:missing.append('effect.frontier_complete_result_projection');values=FrozenMap()
        else:work+=projection
    axes=FrozenMap()
    if not measured.missing_refs:
        axes=measure_program_frontier_axes(measured,result) if request.family=='program' else measure_effect_frontier_axes(measured,result if isinstance(result,MechanicalFamilyResult) else None,values)
    axis_projection=_nodes(axes,max(0,request.maximum_evaluations-work))
    if axis_projection is None:
        missing.append('effect.frontier_complete_causal_axis_projection_bound');axes=FrozenMap()
    else:work+=axis_projection
    parent=FrozenMap({**dict(measured.facts),**dict(axes),'calculation_bound':result is not None and not bool(missing),
        'incomplete_calculation_bound':result is not None and not measured.missing_refs and bool(missing),
        'native_values':values,'native_result':immutable_json_data(result),
        'native_source_return':immutable_json_data(value.returned),'exact_demand':immutable_json_data(request.demand),
        'epoch':request.agenda.epoch,'episode_ref':request.agenda.episode_ref,'level_scope_ref':request.agenda.level_scope_ref,
        'input_revision_ref':request.demand.request.input_revision_ref,'scope_ref':request.demand.scope_ref,
        'accounted_evaluations':work,'missing_refs':tuple(sorted(set(missing))),
        'principal_goal_changed':False,'execution_authority':False})
    return EffectFrontierReturnC(measured=measured,returned=value.returned,parent_return=parent,
        missing_refs=tuple(sorted(set(missing))))


def seal_effect_frontier_interpretation(value):
    returned=value.calculated;meaning=value.meaning;missing=list(returned.missing_refs)
    if (meaning is None or meaning.rule_ref!='rule.effect_frontier_c' or not meaning.template_iteration_complete
            or any(meaning.facts.get(key)!=item for key,item in sorted(returned.parent_return.items()))):
        missing.append('effect.frontier_exact_current_declared_interpretation');meaning=None
    claims=tuple(immutable_json_data(claim) for claim in meaning.conclusions
        if claim.predicate=='records_current_scoped_effect_frontier_evidence') if meaning is not None else ()
    if meaning is not None and len(claims)!=1:
        missing.append('effect.frontier_single_scoped_evidence_claim')
    parent=FrozenMap({**dict(returned.parent_return),'declared_interpretation':immutable_json_data(meaning),
        'scoped_effect_claim':claims[0] if len(claims)==1 else None,
        'current_information_needs':tuple(immutable_json_data(term) for term in meaning.terms
            if term.attributes.get('requires_current_evidence') is True) if meaning is not None else (),
        'parent_means_revalidation_needs':tuple(immutable_json_data(term) for term in meaning.terms
            if term.attributes.get('requires_parent_means_revalidation') is True) if meaning is not None else (),
        'scoped_interpretation_current':meaning is not None and not bool(missing),
        'missing_refs':tuple(sorted(set(missing))),'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing)))})


def join_effect_frontier_publication(value):
    publication=value.publication;returned=publication.returned;published=value.published
    missing=list((*returned.missing_refs,*publication.missing_refs));receipt=None
    if (published is None or published.request!=publication.publication_request
            or not published.canonical_payload_equal or published.missing_refs):
        missing.append('effect.frontier_exact_canonical_publication_receipt')
    elif not missing and isinstance(returned.returned,MechanicalNormalizedReturn):
        receipt=FamilyAgendaReceipt(receipt_ref='receipt.effect.frontier.'+stable_digest((published,returned.returned)),
            demand=returned.measured.request.demand,result=returned.returned)
    else:missing.append('effect.frontier_normalized_result_required')
    parent=FrozenMap({**dict(returned.parent_return),'canonical_publication_applied':receipt is not None,
        'agenda_receipt':immutable_json_data(receipt),'current_parent_consumer_ref':returned.measured.request.why.consumer_ref,
        'next_item_ref':returned.measured.request.why.next_item_ref,
        'eligible_sibling_refs_preserved':returned.measured.request.native_request.scope.eligible_sibling_refs,
        'missing_refs':tuple(sorted(set(missing))),'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing)))})


def bind_effect_frontier_agenda(value):
    return EffectFrontierAgendaRequestC(request=bind_scoped_frontier_agenda(value.returned,
        predicate_ref='records_current_scoped_effect_frontier_evidence'))


def finish_effect_frontier_agenda(value):
    return finish_scoped_frontier_agenda(value.returned,value.published,missing_prefix='effect.frontier_')
