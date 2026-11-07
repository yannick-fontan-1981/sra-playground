"""Transport existing K27 outputs without inventing a MechanicalFamilyResult."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .program_effect_contracts_c import program_effect_identity_c,ProgramEffectResultFactsC
from .mechanical_request_contracts import MechanicalResponseInput
from .contracts import TypedAssignmentDomainsMeasurements,TypedEditSuccessorMeasurements,TypedInterpreterMeasurements
from .program_joint_fit_contracts_d import ProgramJointFitMeasurementsD
from .program_edit_compilation_contracts_d import ProgramEditCompilationMeasurementsD
from .program_validation_contracts_d import ProgramValidationMeasurementsD

PROGRAM_EFFECT_RESULT_MODELS_C={
    'assignment_domains':TypedAssignmentDomainsMeasurements,
    'edit_successor':TypedEditSuccessorMeasurements,
    'bounded_interpret':TypedInterpreterMeasurements,
    'joint_fit':ProgramJointFitMeasurementsD,
    'compile_edit':ProgramEditCompilationMeasurementsD,
    'validation_precondition':ProgramValidationMeasurementsD,
}


def measure_program_effect_result(value):
    operation=value.request.operation_ref.rsplit('.',1)[-1]
    result=PROGRAM_EFFECT_RESULT_MODELS_C[operation].model_validate(value.measurement)
    if isinstance(result,ProgramEditCompilationMeasurementsD):
        complete=result.complete
        bounded=not complete
    elif isinstance(result,ProgramJointFitMeasurementsD):
        complete=result.enumeration_complete and result.interpretation_complete and result.witness_projection_complete
        bounded=not complete
    elif isinstance(result,TypedInterpreterMeasurements):
        bounded=result.status in ('budget_reached','stack_bound_reached','call_bound_reached')
        complete=not bounded
    elif isinstance(result,TypedAssignmentDomainsMeasurements):
        complete=result.domain_enumeration_complete and (not value.request.assignment_request.enumerate_joint_assignments
            or result.assignment_enumeration_complete and result.matching_complete)
        bounded=not complete
    else:complete=True;bounded=False
    return ProgramEffectResultFactsC(measured=immutable_json_data(result),complete=complete,bounded=bounded)


def bind_program_effect_response(value):
    identity=program_effect_identity_c(value.request)
    result=PROGRAM_EFFECT_RESULT_MODELS_C[value.request.operation_ref.rsplit('.',1)[-1]].model_validate(value.measurement)
    return MechanicalResponseInput(request=identity,returned_identity=identity,source_status=value.source_status,
        returned_type=result.schema_version,descriptive_values=FrozenMap({'typed_measurement':immutable_json_data(result)}),
        retained_alternative_refs=value.request.scope.retained_alternative_refs,
        eligible_sibling_refs=value.request.scope.eligible_sibling_refs,
        distinguishing_question_ref=None if value.question_ref=='NONE' else value.question_ref,
        missing_cause=None if value.missing_cause=='NONE' else value.missing_cause,
        retained_frontier=FrozenMap({'retained_state':immutable_json_data(result.retained_state)})
            if isinstance(result,(TypedInterpreterMeasurements,TypedAssignmentDomainsMeasurements))
                and result.retained_state is not None else FrozenMap())
