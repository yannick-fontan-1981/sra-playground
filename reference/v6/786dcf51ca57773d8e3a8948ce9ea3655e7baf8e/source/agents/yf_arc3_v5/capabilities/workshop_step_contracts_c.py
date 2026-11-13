"""Exact native workshop STEP and caller-bound event ownership/clocks."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .station_profile_workbench import StationWorkbenchRequest
from .mechanical_family_contracts_d import DMechanicalResult
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalNormalizedReturn


class WorkshopPhaseBindingC(FrozenModel):
    phase: Literal["DIRECT", "AUTOMATIC", "COST_VERDICT", "RESET"]
    occurrence_ref: Ref
    kind_ref: Ref
    clock_ref: Ref
    tick: int = Field(ge=0)
    temporal_scope_ref: Ref
    snapshot_ref: Ref
    snapshot_kind: Literal["PRE_COMMAND", "SIMULTANEOUS", "ACTOR_TURN", "PRE_DOSE"]


class WorkshopStepInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.workshop_step_input_c.v1"
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    native_request: StationWorkbenchRequest
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
    phases: tuple[WorkshopPhaseBindingC, ...] = Field(min_length=1, max_length=3)
    source_goal_acceptance_contract_ref: Ref | None = None
    source_goal_evidence_refs: tuple[Ref, ...] = ()


class WorkshopStepFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.workshop_step_facts_c.v1"
    facts: FrozenMap


class WorkshopStepMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.workshop_step_measurement_c.v1"
    frozen_request: WorkshopStepInputC
    native: DMechanicalResult | None
    packet: ExternalPrimitivePacketC | None
    missing_refs: tuple[Ref, ...]
    facts: FrozenMap


class WorkshopStepDecodeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.workshop_step_decode_input_c.v1"
    request: WorkshopStepInputC
    native: DMechanicalResult


class WorkshopStepResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.workshop_step_response_input_c.v1"
    measured: WorkshopStepMeasurementC
    source_status: Ref
    missing_cause: Ref | None


class WorkshopStepFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.workshop_step_finish_input_c.v1"
    measured: WorkshopStepMeasurementC
    normalized: MechanicalNormalizedReturn


class WorkshopStepDispatchC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.workshop_step_dispatch_c.v1"
    frozen_measurement: WorkshopStepMeasurementC
    packet: ExternalPrimitivePacketC | None
    normalized: MechanicalNormalizedReturn
    native: DMechanicalResult | None
    discharged_inherited_phase_refs: tuple[Ref, ...]
    proposed_action: None = None
