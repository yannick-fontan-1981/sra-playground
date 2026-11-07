"""Build D's canonical acquisition request from the exact current K41 publication."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .family_effect_publication_contracts import FamilyEffectPublicationRequest
from .native_memory_owner_contracts_d import DNativeMemoryOwnerRequest
from .latent_reference_restoration import ReferenceField
from .latent_solving_contracts_c import LatentMemoryCaptureFactsC,LatentMemoryRequestC


def prepare_latent_reference_capture(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    capture=request.reference_capture
    if capture is None:return LatentMemoryCaptureFactsC(facts=FrozenMap({"memory_capture_bound":False}),missing_refs=())
    missing=list(returned.missing_refs)
    try:publication=FamilyEffectPublicationRequest.model_validate(returned.parent_return.get("owner_publication_request"))
    except (ValidationError,TypeError,ValueError):
        return LatentMemoryCaptureFactsC(facts=FrozenMap({"memory_capture_bound":False}),
            missing_refs=("latent.capture_actual_qualified_native_publication",))
    native=request.native_request
    allowed={"reference_consensus":("native_result","values","reference_candidates"),
        "joint_reference_filter":("native_result","values","retained_fixed_references")}
    path=allowed.get(native.operation_ref)
    if path is None or capture.content_path!=path:
        missing.append("latent.capture_exact_reference_operation_and_content_path")
    content=publication.interpretation
    try:
        for key in capture.content_path:content=content[key]
        references=tuple(ReferenceField.model_validate(row) for row in content)
    except (ValidationError,TypeError,ValueError,KeyError):
        missing.append("latent.capture_original_typed_reference_domain");references=()
    state=native.state or native.actual_state
    context=capture.context
    if (state is None or not references or len(references)>native.maximum_references
            or len({ref.reference_ref for ref in references})!=len(references)):
        missing.append("latent.capture_bounded_nonempty_current_reference_field")
    if (context.parent_goal_ref!=request.why.parent_goal_ref or context.scope.parent_goal_ref!=request.why.parent_goal_ref
            or context.scope.request_ref!=native.scope.request_ref or context.scope.caller_ref!=native.scope.caller_ref
            or context.scope.parent_contribution_ref!=native.scope.parent_contribution_ref
            or context.scope.parent_consumer_ref!=request.why.consumer_ref or context.scope.caller_next_item_ref!=request.why.next_item_ref
            or context.scope.epoch!=native.scope.epoch or context.scope.evidence_revision_ref!=native.scope.evidence_revision_ref
            or context.scope.model_revision_ref!=native.scope.model_revision_ref or context.frame_ref!=publication.frame_ref):
        missing.append("latent.capture_current_context_and_native_owner")
    if state is not None and any(ref.lattice_ref!=state.lattice_ref or ref.level_scope_ref!=state.level_scope_ref
            or {cell.point for cell in ref.cells}!={cell.point for cell in state.cells} for ref in references):
        missing.append("latent.capture_reference_same_current_field")
    memory=None
    if not missing:
        dependencies=FrozenMap({"parent_desired_future_digest":stable_digest(request.why.desired_future),
            "level_scope_ref":state.level_scope_ref,"lattice_ref":state.lattice_ref,
            "cell_addresses":tuple(sorted(cell.point for cell in state.cells)),
            "original_reference_digest":stable_digest(references),"status_promoted":False})
        memory=DNativeMemoryOwnerRequest(scope=context.scope,parent_goal_ref=context.parent_goal_ref,
            context_owner_workflow_ref=context.context_owner_workflow_ref,context_stack_record_ref=context.context_stack_record_ref,
            context_ref=context.context_ref,context_game_ref=context.context_game_ref,context_level_ref=context.context_level_ref,
            context_session_ref=context.context_session_ref,maximum_context_frames=context.maximum_context_frames,
            timeline_ref=context.timeline_ref,frame_ref=context.frame_ref,
            publication_request=publication,memory_term_ref=capture.memory_term_ref,memory_claim_ref=capture.memory_claim_ref,
            kind_ref="REFERENCE_CANDIDATE",content_path=capture.content_path,
            dependency_contract_ref="latent.fixed_reference.dependencies.c.v1",dependency_values=dependencies)
    return LatentMemoryCaptureFactsC(memory_request=memory,facts=FrozenMap({"memory_capture_bound":memory is not None}),
        missing_refs=tuple(sorted(set(missing))))


def get_latent_reference_capture(value):return LatentMemoryRequestC(request=value.memory_request)


def seal_latent_reference_capture(value):
    returned=value.returned
    missing=list((*returned.missing_refs,*value.measured.missing_refs))
    captured=value.captured
    if captured is not None:
        if captured.request!=value.measured.memory_request:missing.append("latent.capture_exact_shared_memory_return");captured=None
        elif not captured.canonical_memory_current:missing.append("latent.capture_shared_memory_not_current")
    parent=FrozenMap({**dict(returned.parent_return),"reference_memory_acquisition":immutable_json_data(captured),
        "reference_memory_missing_refs":tuple(sorted(set(missing))),"reference_status_promoted":False,
        "reference_memory_actual_use_proved":False,"missing_refs":tuple(sorted(set(missing)))})
    return returned.model_copy(update={"parent_return":parent,"missing_refs":tuple(sorted(set(missing)))})
