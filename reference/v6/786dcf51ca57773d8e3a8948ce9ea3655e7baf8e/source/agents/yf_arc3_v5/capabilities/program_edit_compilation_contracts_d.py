"""Source-ordered finite edit compilation with exact physical-token identity."""
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref, require_unique
from .contracts import TypedEditSuccessorInput, TypedJointAssignment, TypedInstructionResource, TypedEditSuccessorMeasurements, TypedResourceLocation, TypedSocketState


class ProgramEditCompilationInputD(FrozenModel):
    initial: TypedEditSuccessorInput
    tokens: tuple[TypedInstructionResource, ...] = Field(min_length=1, max_length=32)
    assignment: TypedJointAssignment
    socket_order: tuple[Ref, ...] = Field(max_length=16)
    preserved_socket_refs: tuple[Ref, ...] = Field(default=(), max_length=16)
    model_revision_ref: Ref
    maximum_operations: int = Field(default=32, ge=1, le=32)
    schema_version: Ref = 'yf_arc3_v5.program_edit_compilation_input_d.v1'

    @model_validator(mode='after')
    def validate_assignment_inventory(self):
        require_unique(tuple(token.token_ref for token in self.tokens), 'compiler physical tokens')
        require_unique(self.socket_order, 'compiler source-declared socket order')
        require_unique(self.preserved_socket_refs, 'compiler preservation sockets')
        if {token.token_ref for token in self.tokens} != {location.token_ref for location in self.initial.locations}:
            raise ValueError('compiler requires the entire current physical inventory')
        targets = dict(self.assignment.socket_token_refs)
        sockets = {socket.socket_ref: socket for socket in self.initial.sockets}
        tokens = {token.token_ref: token for token in self.tokens}
        if set(self.socket_order) != set(targets) or not set(targets).issubset(sockets):
            raise ValueError('each target requires one actual Source-ordered socket')
        if not set(self.preserved_socket_refs).issubset(sockets):
            raise ValueError('preserved sockets must exist in the current layout')
        for socket_ref, token_ref in self.assignment.socket_token_refs:
            if token_ref not in tokens or tokens[token_ref].instruction_kind not in sockets[socket_ref].accepted_instruction_kinds:
                raise ValueError('target token must fit its actual typed socket')
            if socket_ref in self.preserved_socket_refs and sockets[socket_ref].occupant_token_ref != token_ref:
                raise ValueError('target assignment contradicts an already justified fragment')
        pinned_tokens = {sockets[ref].occupant_token_ref for ref in self.preserved_socket_refs}
        for socket_ref, token_ref in self.assignment.socket_token_refs:
            if token_ref in pinned_tokens and sockets[socket_ref].occupant_token_ref != token_ref:
                raise ValueError('compilation cannot remove a token from a preserved fragment')
        return self


class ProgramCompiledEditD(FrozenModel):
    input: TypedEditSuccessorInput
    output: TypedEditSuccessorMeasurements


class ProgramEditStateD(FrozenModel):
    locations: tuple[TypedResourceLocation, ...] = Field(min_length=1, max_length=32)
    sockets: tuple[TypedSocketState, ...] = Field(min_length=1, max_length=16)
    selection_token_ref: Ref | None = None


class ProgramEditCompilationMeasurementsD(FrozenModel):
    operations: tuple[ProgramCompiledEditD, ...] = Field(max_length=32)
    final_state: ProgramEditStateD
    complete: bool
    remaining_socket_refs: tuple[Ref, ...] = Field(max_length=16)
    operations_applied: int = Field(ge=0, le=32)
    evaluations: int = Field(ge=0, le=65536)
    model_sha256: Ref
    execution_authority: None = None
    schema_version: Ref = 'yf_arc3_v5.program_edit_compilation_measurements_d.v1'
