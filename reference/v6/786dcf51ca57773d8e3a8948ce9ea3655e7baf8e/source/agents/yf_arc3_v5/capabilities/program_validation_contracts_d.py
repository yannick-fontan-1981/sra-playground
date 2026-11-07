"""Current validation control and configuration, supplied by Source/DRM."""
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .contracts import TypedJointAssignment
from .program_edit_compilation_contracts_d import ProgramEditStateD


class ProgramValidationInputD(FrozenModel):
    current: ProgramEditStateD
    assignment: TypedJointAssignment
    action_ref: Ref
    available_action_ref: Ref
    control_ref: Ref
    action_data: FrozenMap = Field(default_factory=FrozenMap)
    model_revision_ref: Ref
    schema_version: Ref = 'yf_arc3_v5.program_validation_input_d.v1'

    @model_validator(mode='after')
    def validate_current_configuration(self):
        sockets = {socket.socket_ref for socket in self.current.sockets}
        tokens = {location.token_ref for location in self.current.locations}
        if any(socket_ref not in sockets or token_ref not in tokens
                for socket_ref, token_ref in self.assignment.socket_token_refs):
            raise ValueError('validation target must refer to actual current sockets and physical tokens')
        if not self.assignment.socket_token_refs or len(self.action_data)>8:
            raise ValueError('validation requires an explicit configuration and bounded current control payload')
        return self


class ProgramValidationMeasurementsD(FrozenModel):
    configuration_equal: bool
    differing_socket_refs: tuple[Ref, ...] = Field(max_length=16)
    action_ref: Ref
    available_action_ref: Ref
    control_ref: Ref
    action_data: FrozenMap
    proposed_primitive_count: int = Field(default=1, ge=1, le=1)
    interpreter_steps_are_game_inputs: bool = False
    evaluations: int = Field(ge=0, le=65536)
    execution_authority: None = None
    schema_version: Ref = 'yf_arc3_v5.program_validation_measurements_d.v1'
