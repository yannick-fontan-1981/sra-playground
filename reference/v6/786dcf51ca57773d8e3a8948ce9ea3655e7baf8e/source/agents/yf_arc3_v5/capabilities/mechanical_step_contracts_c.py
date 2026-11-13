"""One family-owned external STEP and its exact parent calculation."""
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalResponseInput, MechanicalNormalizedReturn
from .mechanical_contracts_b import MechanicalRequestB, MechanicalResultB
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .mechanical_profile_d import DNativeProfileRequest, DNativeProfileContribution
from .rigid_edit_search_contracts_c import RigidEditStepContextC


class ExternalStepInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.external_step_input_c.v1"
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    provider_request: MechanicalRequestB | None = None
    d_profile: DNativeProfileRequest | None = None
    d_rigid_context: RigidEditStepContextC | None = None
    response_ref: Ref
    primitive_ref: Ref | None = None
    cost: int = Field(ge=0)

    @model_validator(mode='after')
    def one_provider(self):
        if self.provider_request is not None and self.d_profile is not None:
            raise ValueError('one STEP cannot have both B and D providers')
        if (self.d_profile is None) != (self.d_rigid_context is None):
            raise ValueError('D rigid profile and packet context must be bound together')
        return self


class ExternalStepFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.external_step_facts_c.v1"
    facts: FrozenMap


class ExternalStepMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.external_step_measurement_c.v1"
    request: ExternalStepInputC
    native: MechanicalResultB | DNativeProfileContribution | None
    packet: ExternalPrimitivePacketC | None
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]


class ExternalStepDecodeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.external_step_decode_input_c.v1"
    request: ExternalStepInputC
    native: MechanicalResultB


class RigidEditStepDecodeInputC(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.rigid_edit_step_decode_input_c.v1'
    request: ExternalStepInputC
    contribution: DNativeProfileContribution


class ExternalStepNativeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.external_step_native_input_c.v1"
    measured: ExternalStepMeasurementC
    source_status: Ref
    missing_cause: Ref | None


class ExternalStepFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.external_step_finish_input_c.v1"
    measured: ExternalStepMeasurementC
    normalized: MechanicalNormalizedReturn


class ExternalStepDispatchResultC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.external_step_dispatch_result_c.v1"
    request: MechanicalRequestIdentity
    normalized: MechanicalNormalizedReturn
    packet: ExternalPrimitivePacketC | None
    proposed_action: None = None
