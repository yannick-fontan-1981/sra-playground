"""Source prebinds one complete A packet producer; no second phase simulation."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .rewritable_endpoint_transport import OrientedPassageRequest
from .inventory_gated_navigation import ChartedNavigationRequest
from .station_gated_cargo import StationCargoRequest
from .wrap_slide import WrapRequest
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalNormalizedReturn
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .complete_owner_contracts_c import CompleteOwnerBindingC


class APacketStepInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.a_packet_step_input_c.v1"
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    native_request: OrientedPassageRequest | ChartedNavigationRequest | StationCargoRequest | WrapRequest
    owner_binding: CompleteOwnerBindingC
    native_kernel_ref: Ref
    model_assignment_ref: Ref
    source_parent_goal_ref: Ref
    source_next_item_ref: Ref
    model_revision_ref: Ref
    model_status_ref: Ref
    inherited_phase_refs: tuple[Ref, ...] = Field(min_length=1, max_length=64)
    native_packet_field_ref: Ref = "primitive_packet"
    native_cost_field_ref: Ref = "actual_primitive_cost"
    source_goal_acceptance_contract_ref: Ref | None = None


class OrientedPacketStepInputC(APacketStepInputC):
    native_request: OrientedPassageRequest


class ChartedPacketStepInputC(APacketStepInputC):
    native_request: ChartedNavigationRequest


class StationPacketStepInputC(APacketStepInputC):
    native_request: StationCargoRequest
    native_packet_field_ref: Ref = "external_primitive_packet"
    native_cost_field_ref: Ref = "primitive_cost"


class WrapPacketStepInputC(APacketStepInputC):
    native_request: WrapRequest
    native_cost_field_ref: Ref = "primitive_cost"


class APacketStepFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.a_packet_step_facts_c.v1"
    facts: FrozenMap


class APacketStepMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.a_packet_step_measurement_c.v1"
    frozen_request: APacketStepInputC
    native: MechanicalFamilyResult | None
    packet: ExternalPrimitivePacketC | None
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]


class APacketStepDecodeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.a_packet_step_decode_input_c.v1"
    request: APacketStepInputC
    native: MechanicalFamilyResult


class APacketStepResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.a_packet_step_response_input_c.v1"
    measured: APacketStepMeasurementC
    source_status: Ref
    missing_cause: Ref | None


class APacketStepFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.a_packet_step_finish_input_c.v1"
    measured: APacketStepMeasurementC
    normalized: MechanicalNormalizedReturn
    source_return_packet_allowed: bool


class APacketStepDispatchC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.a_packet_step_dispatch_c.v1"
    frozen_measurement: APacketStepMeasurementC
    normalized: MechanicalNormalizedReturn
    packet: ExternalPrimitivePacketC | None
    ready_inherited_phase_refs: tuple[Ref, ...]
    physical_sealed_or_action_release: None = None
