"""Copy typed requests and a SRC-selected result into Grok's common envelope."""
from .mechanical_common_contracts_c import (
    CommonSignatureFactsC, CommonNativeResponseInputC, SearchResultC, EventCompositionResultC,
)
from .mechanical_request_contracts import MechanicalResponseInput, MechanicalDomainReceipt
from agents.yf_arc3_v5.logos.types import FrozenMap
from .mechanical_transport_c import composition_payload, search_payload, event_payload


def project_common_signature(value) -> CommonSignatureFactsC:
    return CommonSignatureFactsC(facts=FrozenMap({
        "operation_ref": value.request.operation_ref, "mode": value.request.mode,
        "kernel_ref": value.request.kernel_ref, "expected_return_type": value.request.expected_return_type,
        "request_ref": value.request.request_ref,
    }))


def assemble_common_native_response(value: CommonNativeResponseInputC) -> MechanicalResponseInput:
    result = value.result
    is_search = isinstance(result, SearchResultC)
    descriptive = FrozenMap({"measurement": search_payload(result) if is_search else composition_payload(result)})
    # No declaration of exhaustive impossibility without a named supplied
    # closed domain. Source selects EMPTY only from these current facts.
    receipt = None
    if (is_search and result.request.requested_domain_ref is not None
            and result.declared_domain_size is not None
            and result.examined_count <= result.declared_domain_size):
        receipt = MechanicalDomainReceipt(domain_ref=result.request.requested_domain_ref,
            input_revision_ref=result.request.input_revision_ref,
            declared_domain_size=result.declared_domain_size,
            examined_count=result.examined_count,
            pending_count=max(0, result.declared_domain_size-result.examined_count)
                if result.complete else max(1, len(result.requested_steps)))
    return MechanicalResponseInput(request=result.request, returned_identity=result.request,
        source_status=value.source_status, returned_type=value.returned_type,
        descriptive_values=descriptive, missing_cause=value.missing_cause,
        distinguishing_question_ref="question.complete_the_exact_declared_step_domain"
            if result.missing_refs else None,
        domain_receipt=receipt,
        retained_frontier=result.continuation if is_search else FrozenMap({
            "state": result.state, "packet_cursor": result.packet_cursor,
            "missing_refs": result.missing_refs, "events": tuple(event_payload(event) for event in result.events)}),
        consumed_request_refs=())


def empty_composition_result(value) -> EventCompositionResultC:
    return EventCompositionResultC(request=value.request, state=value.initial,
        events=(), states=(value.initial,), primitive_count=0, cost=0, complete=False,
        bounded=False, contradictory=False, missing_refs=("unsupported_signature",),
        failed_predicate_refs=(), consumed_request_delta=(), interruption_ref=None,
        packet_cursor=0, facts=FrozenMap({"unsupported_signature": True}))


def empty_search_result(value) -> SearchResultC:
    return SearchResultC(request=value.request, witnesses=(), current_prefix=(), complete=False,
        bounded=False, contradictory=False, examined_count=0,
        declared_domain_size=value.declared_domain_size, missing_refs=("unsupported_signature",),
        requested_steps=(), continuation=value.continuation,
        facts=FrozenMap({"unsupported_signature": True}))
