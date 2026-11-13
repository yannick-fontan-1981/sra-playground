"""Finite request/receipt transport; SRC invokes K24 and owns sequence."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .articulated_channel_kinematics import _arti_work
from .mechanical_return_a import mechanical_request_identity_a
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .articulated_transition_domain_c import ArticulatedTransitionSessionC


def initialize_articulated_transition_session(value):
    measured,request=value.measured,value.request
    missing=list(measured.missing_refs)
    total=measured.accounted_evaluations
    for question in measured.questions:
        native=question.native_request
        required=_arti_work(native.state,native.step)
        if required>native.maximum_evaluations:
            missing.append("articulated.transition_per_question_work_bound")
        total+=required
    if total>request.maximum_total_evaluations:
        missing.append("articulated.transition_whole_projection_work_bound")
    return ArticulatedTransitionSessionC(requested=measured.model_copy(update={"calculation_bound":not bool(missing)}),returns=(),accounted_evaluations=measured.accounted_evaluations,
        missing_refs=tuple(sorted(set(missing))),calculation_bound=not bool(missing),source_request=request)


def append_articulated_transition_return(value):
    session,question,returned=value.session,value.question,value.returned
    missing=list(session.missing_refs)
    native=question.native_request
    identity=mechanical_request_identity_a(native,"mechanics.articulated_channel_kinematics",native.scope,native.operation_ref,native.mode)
    if (question not in session.requested.questions or returned.request!=identity
            or any(row["request_ref"]==identity.request_ref for row in session.returns)):
        missing.append("articulated.transition_exact_unique_question_return")
        return session.model_copy(update={"missing_refs":tuple(sorted(set(missing))),"calculation_bound":False})
    try:result=MechanicalFamilyResult.model_validate(returned.descriptive_values.get("calculation"))
    except (ValidationError,TypeError,ValueError):
        missing.append("articulated.transition_typed_native_return")
        return session.model_copy(update={"missing_refs":tuple(sorted(set(missing))),"calculation_bound":False})
    if result.scope!=native.scope or result.operation_ref!=native.operation_ref or result.mode!=native.mode:
        missing.append("articulated.transition_exact_native_return_scope")
    row=FrozenMap({"request_ref":identity.request_ref,"primitive_ref":question.primitive_ref,
        "state_digest":question.state_digest,"native_request":immutable_json_data(native),
        "native_return":immutable_json_data(returned),"physical_effect_observed":False})
    return session.model_copy(update={"returns":(*session.returns,row),
        "accounted_evaluations":session.accounted_evaluations+result.examined_count,
        "missing_refs":tuple(sorted(set(missing))),"calculation_bound":not bool(missing)})
