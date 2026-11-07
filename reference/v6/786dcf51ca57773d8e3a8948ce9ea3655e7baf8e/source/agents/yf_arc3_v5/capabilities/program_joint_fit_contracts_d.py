"""Exact finite shared-definition fitting input/output; no selection or action."""
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref, require_unique
from .contracts import (
    TypedAssignmentDomainsInput, TypedAssignmentDomainsMeasurements,
    TypedInterpreterInput, TypedInterpreterMeasurements, TypedJointAssignment,
)


class ProgramSocketDefinitionD(FrozenModel):
    definition_ref: Ref
    socket_refs: tuple[Ref, ...] = Field(max_length=16)


class ProgramJointFitInputD(FrozenModel):
    assignment_request: TypedAssignmentDomainsInput
    interpreter_template: TypedInterpreterInput
    definitions: tuple[ProgramSocketDefinitionD, ...] = Field(min_length=1, max_length=16)
    maximum_evaluations: int = Field(ge=1, le=65536)
    maximum_witnesses: int = Field(default=3, ge=1, le=3)
    schema_version: Ref = 'yf_arc3_v5.program_joint_fit_input_d.v1'

    @model_validator(mode='after')
    def validate_current_model(self):
        assignment = self.assignment_request
        template = self.interpreter_template
        require_unique(tuple(d.definition_ref for d in self.definitions), 'joint fit definitions')
        sockets = tuple(ref for d in self.definitions for ref in d.socket_refs)
        require_unique(sockets, 'joint fit physical sockets')
        if set(sockets) != {s.socket_ref for s in assignment.sockets}:
            raise ValueError('every physical socket requires exactly one definition owner')
        definitions = {d.definition_ref for d in self.definitions}
        if definitions != set(assignment.definition_refs) or definitions != {d.definition_ref for d in template.definitions}:
            raise ValueError('assignment and interpreter must share the same named definitions')
        if assignment.tokens != template.tokens:
            raise ValueError('assignment and interpreter must share exact physical token inventory')
        if not assignment.enumerate_joint_assignments or template.resume_state is not None:
            raise ValueError('fit requires joint enumeration and a fresh interpreter for each supplied assignment')
        if assignment.model_revision_ref is None or assignment.model_revision_ref != template.model_revision_ref:
            raise ValueError('assignment and interpreter require the same model revision')
        return self


class ProgramOutputFragmentD(FrozenModel):
    definition_ref: Ref
    call_site_chain: tuple[tuple[Ref, int], ...] = Field(max_length=64)
    output_start: int = Field(ge=0, le=255)
    output_stop: int = Field(ge=1, le=256)
    same_definition_value_occurrences: int = Field(ge=1, le=257)
    call_return_observed_in_simulation: bool


class ProgramJointFitWitnessD(FrozenModel):
    assignment: TypedJointAssignment
    interpretation: TypedInterpreterMeasurements
    fragments: tuple[ProgramOutputFragmentD, ...] = Field(default=(), max_length=257)
    fragment_projection_complete: bool = True


class ProgramLiteralDeficitD(FrozenModel):
    value_ref: Ref
    required_flat_occurrences: int = Field(ge=1, le=256)
    physical_literal_count: int = Field(ge=0, le=32)
    flat_stock_deficit: int = Field(ge=0, le=256)


class ProgramJointFitMeasurementsD(FrozenModel):
    assignment_measurement: TypedAssignmentDomainsMeasurements
    witnesses: tuple[ProgramJointFitWitnessD, ...] = Field(max_length=3)
    assignments_checked: int = Field(ge=0, le=256)
    matching_assignments: int = Field(ge=0, le=256)
    rejected_assignments: int = Field(ge=0, le=256)
    bounded_assignments: int = Field(ge=0, le=256)
    unvisited_assignments: int = Field(ge=0, le=256)
    evaluations: int = Field(ge=0, le=65536)
    enumeration_complete: bool
    interpretation_complete: bool
    literal_deficits: tuple[ProgramLiteralDeficitD, ...] = Field(default=(), max_length=256)
    flat_entry_socket_deficit: int = Field(default=0, ge=0, le=256)
    witness_projection_complete: bool = True
    model_sha256: Ref
    schema_version: Ref = 'yf_arc3_v5.program_joint_fit_measurements_d.v1'
