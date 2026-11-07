"""Caller-scoped K27 envelope retaining the existing specialized typed inputs."""
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .mechanical_family_contracts_a import MechanicalFamilyScope
from .contracts import TypedAssignmentDomainsInput,TypedEditSuccessorInput,TypedInterpreterInput,TypedAssignmentDomainsMeasurements,TypedEditSuccessorMeasurements,TypedInterpreterMeasurements
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_return_a import mechanical_request_identity_a
from .program_joint_fit_contracts_d import ProgramJointFitInputD, ProgramJointFitMeasurementsD
from .program_edit_compilation_contracts_d import ProgramEditCompilationInputD, ProgramEditCompilationMeasurementsD
from .program_validation_contracts_d import ProgramValidationInputD, ProgramValidationMeasurementsD


class ProgramEffectRequestC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.program_effect_request_c.v1'
    scope: MechanicalFamilyScope
    source_identity_ref: Ref
    operation_ref: Literal['mechanics.typed_recursive_program.assignment_domains',
        'mechanics.typed_recursive_program.edit_successor','mechanics.typed_recursive_program.bounded_interpret',
        'mechanics.typed_recursive_program.joint_fit','mechanics.typed_recursive_program.compile_edit',
        'mechanics.typed_recursive_program.validation_precondition']
    mode: Ref
    assignment_request: TypedAssignmentDomainsInput
    edit_request: TypedEditSuccessorInput
    interpreter_request: TypedInterpreterInput
    measurement_facts: FrozenMap
    joint_fit_request: ProgramJointFitInputD | None = None
    edit_compilation_request: ProgramEditCompilationInputD | None = None
    validation_request: ProgramValidationInputD | None = None
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    resume: None = None

    @model_validator(mode='after')
    def validate_joint_operation_packet(self):
        is_joint=self.operation_ref=='mechanics.typed_recursive_program.joint_fit'
        if is_joint != (self.joint_fit_request is not None):
            raise ValueError('joint fit requires its exact typed packet and no unused joint packet')
        if is_joint and (self.joint_fit_request.assignment_request!=self.assignment_request
                or self.joint_fit_request.interpreter_template!=self.interpreter_request):
            raise ValueError('joint fitting must preserve the original assignment and interpreter inputs')
        is_compile=self.operation_ref=='mechanics.typed_recursive_program.compile_edit'
        if is_compile != (self.edit_compilation_request is not None):
            raise ValueError('edit compilation requires its exact typed packet and no unused compilation packet')
        if is_compile and (self.edit_compilation_request.initial!=self.edit_request
                or self.edit_compilation_request.tokens!=self.assignment_request.tokens):
            raise ValueError('compilation must retain the original current edit state and physical inventory')
        is_validation=self.operation_ref=='mechanics.typed_recursive_program.validation_precondition'
        if is_validation != (self.validation_request is not None):
            raise ValueError('validation requires its exact current packet and no unused packet')
        if is_validation and (self.validation_request.current.locations!=self.edit_request.locations
                or self.validation_request.current.sockets!=self.edit_request.sockets
                or self.validation_request.current.selection_token_ref!=self.edit_request.selection_token_ref):
            raise ValueError('validation must retain the original observed current configuration')
        return self


PROGRAM_EFFECT_RETURN_TYPES_C={
    'assignment_domains':'yf_arc3_v5.typed_assignment_domains_measurements.v1',
    'edit_successor':'yf_arc3_v5.typed_edit_successor_measurements.v1',
    'bounded_interpret':'yf_arc3_v5.typed_interpreter_measurements.v1',
    'joint_fit':'yf_arc3_v5.program_joint_fit_measurements_d.v1',
    'compile_edit':'yf_arc3_v5.program_edit_compilation_measurements_d.v1',
    'validation_precondition':'yf_arc3_v5.program_validation_measurements_d.v1',
}


def program_effect_identity_c(request) -> MechanicalRequestIdentity:
    identity=mechanical_request_identity_a(request,'mechanics.typed_recursive_program',request.scope,request.operation_ref,request.mode)
    return identity.model_copy(update={'expected_return_type':PROGRAM_EFFECT_RETURN_TYPES_C[request.operation_ref.rsplit('.',1)[-1]]})


class ProgramEffectMeasurementInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.program_effect_measurement_input_c.v1'
    request: ProgramEffectRequestC
    measurement: TypedAssignmentDomainsMeasurements | TypedEditSuccessorMeasurements | TypedInterpreterMeasurements | ProgramJointFitMeasurementsD | ProgramEditCompilationMeasurementsD | ProgramValidationMeasurementsD


class ProgramEffectPacketC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.program_effect_packet_c.v1'
    request: ProgramEffectRequestC
    measurement: TypedAssignmentDomainsMeasurements | TypedEditSuccessorMeasurements | TypedInterpreterMeasurements | ProgramJointFitMeasurementsD | ProgramEditCompilationMeasurementsD | ProgramValidationMeasurementsD
    source_status: Literal['FOUND','UNKNOWN','BUDGET_REACHED']
    missing_cause: Literal['NONE','UNSUPPORTED_MODEL','COMPUTATION_BOUND']
    question_ref: Ref


class ProgramEffectResultFactsC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.program_effect_result_facts_c.v1'
    measured: FrozenMap
    complete: bool
    bounded: bool
