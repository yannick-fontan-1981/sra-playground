"""Pure PATH request assembly and prefix folding; SRC owns iteration and stops."""
from .mechanical_path_driver_contracts_c import (
    PathDriverInputC, PathDriverSessionC, PathNextStepInputC, PathStepFoldInputC,
    SourceReferenceEqualityInputC, SourceReferenceEqualityResultC,
    PathDriverNativeInputC,
)
from .mechanical_common_contracts_c import EventCompositionInputC, EventCompositionResultC
from .mechanical_step_contracts_c import ExternalStepInputC
from .mechanical_event_composition_c import compose_mechanical_events, packet_context_equal
from .mechanical_response_transport_b import request_identity
from .mechanical_request_contracts import MechanicalResponseInput
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_transport_c import composition_payload, normalized_return_payload, path_session_payload


def initialize_path_driver(value: PathDriverInputC) -> PathDriverSessionC:
    # No composition or predicate evaluation before the Source signature gate.
    # This is only an unmeasured identity/initial-state envelope.
    result = EventCompositionResultC(request=value.path.request, state=value.path.initial,
        events=(), states=(), primitive_count=0, cost=0, complete=False,
        bounded=False, contradictory=False, missing_refs=("unmeasured_path_prefix",),
        failed_predicate_refs=(), consumed_request_delta=(), interruption_ref=None,
        packet_cursor=0, facts=FrozenMap({"measurement_not_started": True}))
    template = value.provider_template
    identity = request_identity(template, value.provider_kernel_ref) if template and value.provider_kernel_ref else None
    aligned = tuple(primitive.action_ref for primitive in value.primitives) == value.path.word
    fields = {"operation_ref": value.path.request.operation_ref, "kernel_ref": value.path.request.kernel_ref,
        "mode": value.path.request.mode, "expected_return_type": value.path.request.expected_return_type,
        "word_aligned": aligned, "existing_packets_present": bool(value.path.packets),
        "word_count": len(value.primitives), "provider_present": identity is not None,
        "provider_initial_state_equal": template is not None and template.state == value.path.initial,
        "provider_provenance_equal": identity is not None and packet_context_equal(
            value.path.request, identity, template.model_ref), "prefix_complete": result.complete,
        "interrupted": False, "remaining_word_count": len(value.primitives),
        "remaining_word_present": bool(value.primitives), "word_present": bool(value.primitives)}
    return PathDriverSessionC(request=value, cursor=0, result=result, facts=FrozenMap(fields))


def measure_licensed_path_prefix(value: PathDriverSessionC) -> PathDriverSessionC:
    path = value.request.path
    result = compose_mechanical_events(EventCompositionInputC(request=path.request,
        initial=path.initial, packets=path.packets, predicates=path.predicates,
        relation_bindings=path.relation_bindings,
        consumed_request_refs=path.consumed_request_refs,
        acceptance_boundaries=path.acceptance_boundaries, declared_event_order=path.declared_event_order))
    return value.model_copy(update={"result": result,
        "facts": FrozenMap.overlay({"prefix_complete": result.complete,
            "interrupted": result.interruption_ref is not None}, value.facts)})


def prepare_next_path_step(value: PathNextStepInputC) -> ExternalStepInputC:
    session, primitive = value.session, value.primitive
    template = session.request.provider_template
    root = session.request.path.request
    # SRC has licensed the current template, exact word and remaining slot.
    # The nonce is a request identity, not a model selection or a fresh goal.
    child_ref = "mechanical.step." + stable_digest((root.request_ref, session.cursor,
        session.result.state, primitive.action_ref, primitive.data))
    provider = template.model_copy(update={"request_ref": child_ref,
        "state": session.result.state,
        "data": FrozenMap.overlay({"action_ref": primitive.action_ref},
            FrozenMap.overlay(primitive.data, template.data))})
    identity = request_identity(provider, session.request.provider_kernel_ref)
    return ExternalStepInputC(request=identity, parent_request=root,
        provider_request=provider, response_ref="mechanical.response."+child_ref, cost=primitive.cost)


def append_path_step(value: PathStepFoldInputC) -> PathDriverSessionC:
    session = value.session
    packet = value.dispatched.packet
    packets = session.request.path.packets
    if packet is None:
        return session.model_copy(update={"last_return": value.dispatched.normalized,
            "facts": FrozenMap.overlay({"prefix_complete": False}, session.facts)})
    packets = (*packets, packet)
    path = session.request.path.model_copy(update={"packets": packets})
    result = compose_mechanical_events(EventCompositionInputC(request=path.request,
        initial=path.initial, packets=packets, predicates=path.predicates,
        relation_bindings=path.relation_bindings,
        consumed_request_refs=path.consumed_request_refs,
        acceptance_boundaries=path.acceptance_boundaries, declared_event_order=path.declared_event_order))
    cursor = len(packets)
    request = session.request.model_copy(update={"path": path})
    return PathDriverSessionC(request=request, cursor=cursor, result=result,
        last_return=value.dispatched.normalized,
        facts=FrozenMap.overlay({"prefix_complete": result.complete,
            "interrupted": result.interruption_ref is not None,
            "remaining_word_count": max(0, len(request.primitives)-cursor),
            "remaining_word_present": cursor < len(request.primitives)}, session.facts))


def finish_path_measurement(value: PathDriverSessionC):
    result = value.result
    completed_word = value.cursor == len(value.request.primitives) or result.interruption_ref is not None
    complete = result.complete and completed_word
    missing = result.missing_refs if completed_word else tuple(sorted({*result.missing_refs, "uncompleted_external_word"}))
    return result.model_copy(update={"complete": complete, "missing_refs": missing,
        "facts": FrozenMap.overlay({"complete": complete, "missing_measurement": bool(missing)}, result.facts)})


def source_reference_equal(value: SourceReferenceEqualityInputC) -> SourceReferenceEqualityResultC:
    return SourceReferenceEqualityResultC(equal=value.left == value.right)


def assemble_path_driver_response(value: PathDriverNativeInputC) -> MechanicalResponseInput:
    session = value.session
    result = finish_path_measurement(session)
    return MechanicalResponseInput(request=session.request.path.request,
        returned_identity=session.request.path.request, source_status=value.source_status,
        returned_type="EventCompositionResultC", missing_cause=value.missing_cause,
        descriptive_values=FrozenMap({"measurement": composition_payload(result),
            "last_step_return": normalized_return_payload(session.last_return)}),
        distinguishing_question_ref="question.complete_the_bound_path_word" if result.missing_refs else None,
        retained_frontier=FrozenMap({"path_session": path_session_payload(session)}))
