"""Transport exact acquired K25 returns; Source/DRM own their causal meaning."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .anchor_frontier_contracts_c import AnchorFrontierReturnC,AnchorFrontierAgendaRequestC
from .family_agenda_projection import FamilyAgendaReceipt
from .scoped_frontier_agenda_root import bind_scoped_frontier_agenda, finish_scoped_frontier_agenda
from agents.yf_arc3_v5.logos.types import stable_digest
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .articulated_dependency_measurement_c import _nodes


def bind_anchor_frontier_native(value):
    if value.measured.missing_refs:raise ValueError('Source must return acquired anchor Need before calculation')
    return value.measured.request.native_request


def finish_anchor_frontier_calculation(value):
    from .scoped_frontier_calculation_c import qualify_scoped_frontier_calculation
    measured=value.measured;request=measured.request;native=request.native_request
    result,values,_,missing,work=qualify_scoped_frontier_calculation(measured,value.returned,error_refs={
        'identity':'anchor.frontier_exact_current_native_return','typed':'anchor.frontier_typed_K25_return',
        'scope':'anchor.frontier_supported_exact_K25_scope','incomplete':'anchor.frontier_incomplete_K25_domain',
        'absent':'anchor.frontier_requested_native_return_absent','projection':'anchor.frontier_complete_result_projection_bound'})
    clearance=values.get('typed_clearance',FrozenMap())
    waypoint=values.get('waypoint_candidates',FrozenMap())
    parent=FrozenMap({**dict(measured.facts),'calculation_bound':result is not None and not bool(missing),
        'incomplete_calculation_bound':result is not None and not measured.missing_refs and bool(missing),
        'native_operation_ref':native.operation_ref,'native_values':values,
        'native_result':immutable_json_data(result) if result is not None else None,
        'normalized_return':immutable_json_data(value.returned),'exact_demand':immutable_json_data(request.demand),
        'epoch':request.agenda.epoch,'episode_ref':request.agenda.episode_ref,'level_scope_ref':request.agenda.level_scope_ref,
        'input_revision_ref':request.demand.request.input_revision_ref,'scope_ref':request.demand.scope_ref,
        'anchor_blocked_positions':clearance.get('anchor_blocked_positions',()),
        'beacon_destination_blocked_positions':clearance.get('dependent_blocked_positions',()),
        'beacon_path_blocked_positions':clearance.get('transition_blocked_positions',()),
        'beacon_path_status':clearance.get('transition_path_status'),
        'rejected_waypoint_candidate_refs':waypoint.get('rejected_candidate_refs',()),
        'uncertain_waypoint_candidate_refs':waypoint.get('uncertain_candidate_refs',()),
        'current_configuration_waypoint_rejected':measured.facts.get('actual_legal_placement_bound') is True
            and bool(waypoint.get('rejected_candidate_refs')) and not waypoint.get('compatible_candidate_refs')
            and not waypoint.get('uncertain_candidate_refs'),
        'incomplete_prediction_frontier':result.frontier if result is not None and result.computation_bound_reached else None,
        'accounted_evaluations':work,'missing_refs':tuple(sorted(set(missing))),
        'principal_goal_changed':False,'execution_authority':False})
    return AnchorFrontierReturnC(measured=measured,returned=value.returned,parent_return=parent,missing_refs=tuple(sorted(set(missing))))


def seal_anchor_frontier_interpretation(value):
    returned=value.calculated;meaning=value.meaning;missing=list(returned.missing_refs)
    if meaning is not None:
        if (meaning.rule_ref!='rule.anchor_frontier_c' or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=item for key,item in sorted(returned.parent_return.items()))):
            missing.append('anchor.frontier_exact_declared_interpretation');meaning=None
    elif returned.parent_return.get('calculation_bound'):missing.append('anchor.frontier_current_declared_meaning')
    local=tuple(immutable_json_data(claim) for claim in meaning.conclusions
        if claim.predicate=='records_current_scoped_anchor_frontier_evidence') if meaning is not None else ()
    if meaning is not None and len(local)!=1:
        missing.append('anchor.frontier_exact_local_confirmation_claim')
    packet=FrozenMap({**dict(returned.parent_return),'declared_interpretation':immutable_json_data(meaning),
        'scoped_anchor_effect_claim':local[0] if len(local)==1 else None,
        'parent_means_revalidation_needs':tuple(immutable_json_data(term) for term in meaning.terms
            if term.attributes.get('requires_parent_means_revalidation') is True) if meaning is not None else (),
        'scoped_interpretation_current':meaning is not None and not bool(missing),
        'current_information_needs':tuple(immutable_json_data(term) for term in meaning.terms
            if term.attributes.get('requires_current_evidence') is True) if meaning is not None else (),
        'missing_refs':tuple(sorted(set(missing))),'execution_authority':False})
    return returned.model_copy(update={'parent_return':packet,'missing_refs':tuple(sorted(set(missing)))})


def join_anchor_frontier_publication(value):
    publication=value.publication;returned=publication.returned;published=value.published
    missing=list((*returned.missing_refs,*publication.missing_refs));receipt=None
    if (published is None or published.request!=publication.publication_request
            or not published.canonical_payload_equal or published.missing_refs):
        missing.append('anchor.frontier_exact_canonical_publication_receipt')
    elif not missing:
        receipt=FamilyAgendaReceipt(receipt_ref='receipt.anchor.frontier.'+stable_digest((published,returned.returned)),
            demand=returned.measured.request.demand,result=returned.returned)
    parent=FrozenMap({**dict(returned.parent_return),'canonical_publication_applied':receipt is not None,
        'agenda_receipt':immutable_json_data(receipt),'current_parent_consumer_ref':returned.measured.request.why.consumer_ref,
        'next_item_ref':returned.measured.request.why.next_item_ref,
        'eligible_sibling_refs_preserved':returned.measured.request.native_request.scope.eligible_sibling_refs,
        'missing_refs':tuple(sorted(set(missing))),'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing))),
        'publication_receipt':published if receipt is not None else None})


def bind_anchor_frontier_agenda(value):
    return AnchorFrontierAgendaRequestC(request=bind_scoped_frontier_agenda(value.returned,
        predicate_ref='records_current_scoped_anchor_frontier_evidence'))


def finish_anchor_frontier_agenda(value):
    return finish_scoped_frontier_agenda(value.returned, value.published, missing_prefix='anchor.frontier_')
