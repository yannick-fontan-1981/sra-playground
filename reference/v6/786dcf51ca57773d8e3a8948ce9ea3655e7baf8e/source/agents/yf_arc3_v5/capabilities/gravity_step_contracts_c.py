"""Exact native gravity STEP and caller-bound event ownership/clocks."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .coupled_member_control import CoupledMemberRequest
from .mechanical_family_contracts_d import DMechanicalResult
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalNormalizedReturn


class GravityPhaseBindingC(FrozenModel):
    phase: Literal["DIRECT_PREPHASE", "MICRO_TICK", "COST_VERDICT", "INDEPENDENT_RESET"]
    occurrence_ref: Ref
    kind_ref: Ref
    clock_ref: Ref
    tick: int = Field(ge=0)
    temporal_scope_ref: Ref
    snapshot_ref: Ref
    snapshot_kind: Literal["PRE_COMMAND", "SIMULTANEOUS", "ACTOR_TURN", "PRE_DOSE"]


class GravityStepInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.gravity_step_input_c.v1"
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    native_request: CoupledMemberRequest
    native_kernel_ref: Ref
    source_parent_goal_ref: Ref
    source_parent_consumer_ref: Ref
    source_next_item_ref: Ref
    model_revision_ref: Ref
    model_status_ref: Ref
    model_ref: Ref
    native_model_digest: Ref
    bound_model_assignments: FrozenMap
    ownership_evidence_refs: tuple[Ref, ...]
    phase_clock_evidence_refs: tuple[Ref, ...]
    inherited_phase_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    other_adapter_case_refs: tuple[Ref, ...] = Field(max_length=16)
    action_ref: Ref
    primitive_ref: Ref
    response_ref: Ref
    closure_domain_ref: Ref
    closure_stop_ref: Ref
    interruption_ref: Ref
    phases: tuple[GravityPhaseBindingC, ...] = Field(min_length=1, max_length=4098)
    source_goal_acceptance_contract_ref: Ref | None = None
    source_goal_evidence_refs: tuple[Ref, ...] = ()


class GravityStepFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.gravity_step_facts_c.v1"
    facts: FrozenMap


class GravityStepMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.gravity_step_measurement_c.v1"
    frozen_request: GravityStepInputC
    native: DMechanicalResult | None
    packet: ExternalPrimitivePacketC | None
    missing_refs: tuple[Ref, ...]
    facts: FrozenMap


class GravityStepDecodeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.gravity_step_decode_input_c.v1"
    request: GravityStepInputC
    native: DMechanicalResult


class GravityStepResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.gravity_step_response_input_c.v1"
    measured: GravityStepMeasurementC
    source_status: Ref
    missing_cause: Ref | None


class GravityStepFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.gravity_step_finish_input_c.v1"
    measured: GravityStepMeasurementC
    normalized: MechanicalNormalizedReturn
    source_packet_allowed: bool


class GravityStepDispatchC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.gravity_step_dispatch_c.v1"
    frozen_measurement: GravityStepMeasurementC
    packet: ExternalPrimitivePacketC | None
    normalized: MechanicalNormalizedReturn
    native: DMechanicalResult | None
    ready_inherited_phase_refs: tuple[Ref, ...]
    proposed_action: None = None
