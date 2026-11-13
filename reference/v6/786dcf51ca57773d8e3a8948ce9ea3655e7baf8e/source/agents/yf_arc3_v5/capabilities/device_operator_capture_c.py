"""Reuse D acquisition for the exact qualified whole-operator candidate method."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .device_solving_contracts_c import DeviceOperatorMethodC,DeviceMemoryFactsC,DeviceMemoryRequestC
from .family_effect_publication_contracts import FamilyEffectPublicationRequest
from .native_memory_owner_contracts_d import DNativeMemoryOwnerRequest


def join_device_operator_method(value):
    measured=value.measured;returned=measured.returned
    missing=list((*returned.missing_refs,*measured.missing_refs))
    work=returned.parent_return.get("accounted_evaluations",0)+measured.accounted_evaluations
    if work>returned.frozen_measurement.frozen_input.parent_maximum_evaluations:
        missing.append("device.operator_method_global_parent_work_bound")
    parent=FrozenMap({**dict(returned.parent_return),"device_operator_method":immutable_json_data(measured.method),
        "operator_method_missing_refs":measured.missing_refs,"accounted_evaluations":work,
        "missing_refs":tuple(sorted(set(missing))),"operator_status_promoted":False,"execution_authority":False})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":tuple(sorted(set(missing)))})


def prepare_device_operator_capture(value):
    returned=value.returned;request=returned.frozen_measurement.frozen_input;capture=request.operator_capture
    if capture is None:return DeviceMemoryFactsC(returned=returned,facts=FrozenMap({"memory_capture_bound":False}))
    missing=list(returned.missing_refs)
    try:
        publication=FamilyEffectPublicationRequest.model_validate(returned.parent_return.get("owner_publication_request"))
        method=DeviceOperatorMethodC.model_validate(publication.interpretation.get("device_operator_method"))
    except (ValidationError,TypeError,ValueError):
        return DeviceMemoryFactsC(returned=returned,facts=FrozenMap({"memory_capture_bound":False}),
            missing_refs=("device.capture_qualified_actual_operator_method_publication",))
    native=request.native_request;context=capture.context
    if (native.operation_ref!="mechanics.finite_instruction_device.demo_fit" or method.operator_status_promoted
            or method.real_world_legality_inferred or returned.parent_return.get("canonical_effect_publication_applied") is not True):
        missing.append("device.capture_exact_fit_and_applied_shared_publication")
    if (context.parent_goal_ref!=request.why.parent_goal_ref or context.scope.parent_goal_ref!=request.why.parent_goal_ref
            or context.scope.request_ref!=native.scope.request_ref or context.scope.caller_ref!=native.scope.caller_ref
            or context.scope.parent_contribution_ref!=native.scope.parent_contribution_ref
            or context.scope.parent_consumer_ref!=request.why.consumer_ref or context.scope.caller_next_item_ref!=request.why.next_item_ref
            or context.scope.epoch!=native.scope.epoch or context.scope.evidence_revision_ref!=native.scope.evidence_revision_ref
            or context.scope.model_revision_ref!=native.scope.model_revision_ref or context.frame_ref!=publication.frame_ref):
        missing.append("device.capture_current_owner_and_context")
    memory=None
    if not missing:
        dependencies=FrozenMap({"trait_order":method.trait_order,"units_digest":stable_digest(method.units),
            "method_digest":stable_digest(method),"status_promoted":False,"real_world_legality_inferred":False})
        memory=DNativeMemoryOwnerRequest(scope=context.scope,parent_goal_ref=context.parent_goal_ref,
            context_owner_workflow_ref=context.context_owner_workflow_ref,context_stack_record_ref=context.context_stack_record_ref,
            context_ref=context.context_ref,context_game_ref=context.context_game_ref,context_level_ref=context.context_level_ref,
            context_session_ref=context.context_session_ref,maximum_context_frames=context.maximum_context_frames,
            timeline_ref=context.timeline_ref,frame_ref=context.frame_ref,publication_request=publication,
            memory_term_ref=capture.memory_term_ref,memory_claim_ref=capture.memory_claim_ref,kind_ref="MODEL_EVIDENCE",
            content_path=("device_operator_method",),dependency_contract_ref="device.whole_operator.dependencies.c.v1",
            dependency_values=dependencies)
    return DeviceMemoryFactsC(returned=returned,memory_request=memory,facts=FrozenMap({"memory_capture_bound":memory is not None}),
        missing_refs=tuple(sorted(set(missing))))


def bind_device_operator_capture(value):return DeviceMemoryRequestC(request=value.memory_request)


def seal_device_operator_capture(value):
    measured=value.measured;returned=measured.returned
    missing=list((*returned.missing_refs,*measured.missing_refs));captured=value.captured
    if captured is not None:
        if captured.request!=measured.memory_request:
            missing.append("device.capture_exact_shared_memory_return");captured=None
        elif not captured.canonical_memory_current:missing.append("device.capture_shared_memory_not_current")
    elif measured.facts.get("memory_capture_bound"):
        missing.append("device.capture_requested_shared_acquisition_absent")
    parent=FrozenMap({**dict(returned.parent_return),"operator_memory_acquisition":immutable_json_data(captured),
        "operator_memory_actual_use_proved":False,"operator_status_promoted":False,
        "missing_refs":tuple(sorted(set(missing))),"execution_authority":False})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":tuple(sorted(set(missing)))})
