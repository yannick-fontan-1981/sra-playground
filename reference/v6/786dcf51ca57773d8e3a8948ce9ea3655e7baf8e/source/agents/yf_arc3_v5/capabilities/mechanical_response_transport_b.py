"""Exact B result transport into Grok's common SRC return pipeline."""
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import (
    MechanicalRequestIdentity, MechanicalResponseInput, MechanicalDomainReceipt,
)
from agents.yf_arc3_v5.capabilities.mechanical_request_shape_b import coerce_request
from agents.yf_arc3_v5.capabilities.mechanical_contracts_b import MechanicalResultB
from agents.yf_arc3_v5.logos.types import FrozenMap


def request_identity(request, family_ref):
    return MechanicalRequestIdentity(
        request_ref=request.request_ref, kernel_ref=family_ref, operation_ref=request.operation_ref,
        mode=request.mode, caller_ref=request.caller_ref, parent_contribution_ref=request.parent_contribution_ref,
        epoch=request.epoch, input_revision_ref=request.input_revision_ref,
        model_assignments=FrozenMap({'model_ref':request.model_ref,'model':request.model,'event_owner_ref':request.event_owner_ref}),
        immutable_inputs=FrozenMap({'state':request.state,'data':request.data,'observations':request.observations,
                                   'evidence_refs':request.evidence_refs,'model_alternatives':request.model_alternatives}),
        actual_bounds=request.bounds, expected_return_type=request.expected_return_type,
        requested_domain_ref=request.requested_domain_ref)


def transport_response(value, result, configuration):
    request=coerce_request(value)
    native=result if isinstance(result,MechanicalResultB) else MechanicalResultB.model_validate(result)
    family=configuration['family_ref']
    receipt=None
    if native.domain_exhausted and request.requested_domain_ref is not None:
        receipt=MechanicalDomainReceipt(domain_ref=request.requested_domain_ref,
            input_revision_ref=native.request.input_revision_ref, declared_domain_size=native.domain_size,
            examined_count=native.examined_count,pending_count=len(native.frontier))
    return MechanicalResponseInput(
        request=request_identity(request,family),returned_identity=request_identity(native.request,family),
        source_status=native.source_status,returned_type='MechanicalResultB',
        descriptive_values=FrozenMap({**native.values,'missing_refs':native.missing_refs,'native_cause':native.cause,
            'examined_count':native.examined_count,'domain_size':native.domain_size,
            'domain_exhausted':native.domain_exhausted,'model_alternatives':request.model_alternatives,
            'feasibility_is_not_robustness_uniqueness_or_optimality':True}),
        missing_cause=native.cause if native.cause in ('MISSING_OBSERVATION','UNSUPPORTED_MODEL','SIGNATURE_MISMATCH',
            'MISSING_IMPLEMENTATION','DOMAIN_EXHAUSTED','COMPUTATION_BOUND') else None,
        retained_alternative_refs=tuple(request.data.get('retained_alternative_refs',())),
        eligible_sibling_refs=tuple(request.data.get('eligible_sibling_refs',())),
        distinguishing_question_ref=request.data.get('distinguishing_question_ref'),domain_receipt=receipt,
        consumed_request_refs=tuple(request.data.get('consumed_request_refs',())),
        retained_frontier=FrozenMap({'rows':native.frontier,'examined_count':native.examined_count}))
