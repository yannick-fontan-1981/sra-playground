"""Exact K21 frontier receipt and declared parent interpretation, no second solver."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .articulated_dependency_measurement_c import _nodes
from .relief_frontier_contracts_c import ReliefFrontierReturnC,ReliefFrontierAgendaRequestC
from .family_agenda_projection import FamilyAgendaReceipt
from agents.yf_arc3_v5.logos.types import stable_digest
from .scoped_frontier_agenda_root import bind_scoped_frontier_agenda, finish_scoped_frontier_agenda


def bind_relief_frontier_native(value):
    if value.measured.missing_refs:raise ValueError('Source must return current relief acquisition Need')
    return value.measured.request.native_request


def finish_relief_frontier_calculation(value):
    from .scoped_frontier_calculation_c import qualify_scoped_frontier_calculation
    measured=value.measured;request=measured.request
    result,_,rows,missing,work=qualify_scoped_frontier_calculation(measured,value.returned,
        require_complete_result=True,projected_value_key='measured_rows',error_refs={
            'identity':'relief.frontier_exact_native_return','typed':'relief.frontier_typed_calculation',
            'scope':'relief.frontier_complete_current_native_scope','absent':'relief.frontier_requested_calculation_absent',
            'projection':'relief.frontier_complete_result_projection_bound'})
    contribution=None
    if request.native_request.operation_ref.endswith('.backward_domains') and result is not None:
        if len(rows)!=1 or rows[0].get('write_ref')!=request.native_request.writes[0].write_ref:
            missing.append('relief.frontier_exact_actual_stroke_contribution_result')
        else:
            contribution=FrozenMap({'write_ref':rows[0]['write_ref'],'exposed_mask':rows[0]['exposed_mask'],
                'unoccluded_mismatches':rows[0]['unoccluded_mismatches'],
                'earlier_substrate_requirements':rows[0]['earlier_substrate_requirements'],
                'serves_reference':rows[0]['last_layer_compatible'],
                'frozen_why':immutable_json_data(request.why),'complete_surviving_domain':True})
    packet=FrozenMap({**dict(measured.facts),'calculation_bound':result is not None and not bool(missing),
        'native_operation_ref':request.native_request.operation_ref,'native_rows':rows,
        'native_result':immutable_json_data(result) if result is not None else None,
        'contribution_witness':contribution if contribution is not None else measured.facts.get('contribution_witness'),
        'contribution_unusable':contribution['serves_reference'] is False if contribution is not None else measured.facts.get('contribution_unusable',False),
        'normalized_return':immutable_json_data(value.returned),'exact_demand':immutable_json_data(request.demand),
        'epoch':request.agenda.epoch,'episode_ref':request.agenda.episode_ref,'level_scope_ref':request.agenda.level_scope_ref,
        'input_revision_ref':request.demand.request.input_revision_ref,'scope_ref':request.demand.scope_ref,
        'accounted_evaluations':work,'missing_refs':tuple(sorted(set(missing))),
        'principal_goal_changed':False,'execution_authority':False})
    return ReliefFrontierReturnC(measured=measured,returned=value.returned,parent_return=packet,
        missing_refs=tuple(sorted(set(missing))))


def seal_relief_frontier_interpretation(value):
    returned=value.calculated;meaning=value.meaning;missing=list(returned.missing_refs)
    if meaning is not None:
        if (meaning.rule_ref!='rule.relief_frontier_c' or not meaning.template_iteration_complete
                or any(meaning.facts.get(key)!=item for key,item in sorted(returned.parent_return.items()))):
            missing.append('relief.frontier_exact_declared_interpretation');meaning=None
    elif returned.parent_return.get('calculation_bound'):missing.append('relief.frontier_current_declared_meaning')
    local=tuple(immutable_json_data(claim) for claim in meaning.conclusions
        if claim.predicate=='supports_observed_local_relief_effect_and_control') if meaning is not None else ()
    if meaning is not None and len(local)!=1:
        missing.append('relief.frontier_exact_local_confirmation_claim')
    packet=FrozenMap({**dict(returned.parent_return),'declared_interpretation':immutable_json_data(meaning),
        'local_control_effect_confirmation':local[0] if len(local)==1 else None,
        'parent_means_revalidation_needs':tuple(immutable_json_data(term) for term in meaning.terms
            if term.attributes.get('requires_parent_means_revalidation') is True) if meaning is not None else (),
        'scoped_interpretation_current':meaning is not None and not bool(missing),
        'missing_refs':tuple(sorted(set(missing))),'execution_authority':False})
    return returned.model_copy(update={'parent_return':packet,'missing_refs':tuple(sorted(set(missing)))})


def join_relief_frontier_publication(value):
    publication=value.publication;returned=publication.returned;published=value.published
    missing=list((*returned.missing_refs,*publication.missing_refs));receipt=None
    if (published is None or published.request!=publication.publication_request
            or not published.canonical_payload_equal or published.missing_refs):
        missing.append('relief.frontier_exact_canonical_publication_receipt')
    elif not missing:
        receipt=FamilyAgendaReceipt(receipt_ref='receipt.relief.frontier.'+stable_digest((published,returned.returned)),
            demand=returned.measured.request.demand,result=returned.returned)
    parent=FrozenMap({**dict(returned.parent_return),'canonical_publication_applied':receipt is not None,
        'agenda_receipt':immutable_json_data(receipt),'current_parent_consumer_ref':returned.measured.request.why.consumer_ref,
        'next_item_ref':returned.measured.request.why.next_item_ref,
        'eligible_sibling_refs_preserved':returned.measured.request.native_request.scope.eligible_sibling_refs,
        'missing_refs':tuple(sorted(set(missing))),'execution_authority':False})
    return returned.model_copy(update={'parent_return':parent,'missing_refs':tuple(sorted(set(missing))),
        'publication_receipt':published if receipt is not None else None})


def bind_relief_frontier_agenda(value):
    return ReliefFrontierAgendaRequestC(request=bind_scoped_frontier_agenda(value.returned,
        predicate_ref='records_current_scoped_relief_frontier_evidence'))


def finish_relief_frontier_agenda(value):
    return finish_scoped_frontier_agenda(value.returned, value.published, missing_prefix='relief.frontier_')
