"""Exact parent-question bindings, never support meaning or action selection."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .reconfigurable_support import SupportRequest
from .support_solving_contracts_d import (SupportSolvingInputD, SupportSolvingFactsD,
    SupportSolvingAnswerInputD, SupportSolvingAnswerD)


def measure_support_solving_question_d(request: SupportSolvingInputD) -> SupportSolvingFactsD:
    frontier = request.frontier
    why = frontier.why
    missing = []
    if frontier.family != 'support' or not isinstance(frontier.native_request, SupportRequest):
        missing.append('exact_k22_support_request')
    desired = why.desired_future
    bindings = (('destination_predicate', request.destination_predicate),
        ('useful_region_ref', request.useful_region_ref),
        ('connecting_configuration_ref', request.connecting_configuration_ref),
        ('staging_predicate', request.staging_predicate))
    if any(not value or desired.get(name) != value for name, value in bindings):
        missing.append('destination_region_connection_safe_staging_parent_binding')
    declared = (*why.and_dependency_refs, *why.or_dependency_refs)
    dependencies = (*request.permission_dependency_refs, *request.connection_dependency_refs)
    if not request.connection_dependency_refs or any(ref not in declared for ref in dependencies):
        missing.append('explicit_parent_connection_and_permission_dependencies')
    if (not why.usefulness_premise_refs or not why.morphology_premise_refs
            or not why.preservation_refs or not why.falsifier_ref):
        missing.append('full_current_support_why_and_preservation')
    native = frontier.native_request
    return SupportSolvingFactsD(request=request, missing_refs=tuple(sorted(set(missing))),
        facts=FrozenMap({'parent_question_bound': not bool(missing),
            'requested_question': request.requested_question,
            'operation_ref': native.operation_ref, 'mode': native.mode,
            'model_status_ref': native.scope.model_status_ref}))


def finish_support_solving_answer_d(value: SupportSolvingAnswerInputD) -> SupportSolvingAnswerD:
    measured, returned = value.measured, value.returned
    missing = list(measured.missing_refs)
    if returned is not None:
        if returned.measured.request != measured.request.frontier:
            missing.append('exact_returned_support_parent_question')
            returned = None
        else:
            missing.extend(returned.missing_refs)
    elif not missing:
        missing.append('drm_declared_support_operation_and_current_model')
    return SupportSolvingAnswerD(request=measured.request, returned=returned,
        missing_refs=tuple(sorted(set(missing))))
