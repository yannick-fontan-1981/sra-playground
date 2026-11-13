"""Exact native cycle STEP and caller-bound event ownership/clocks."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .cyclic_configuration_coverage import CyclicCoverageRequest
from .mechanical_family_contracts_d import DMechanicalResult
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalNormalizedReturn


class CyclePhaseBindingC(FrozenModel):
    phase: Literal["COMPLETE_PRIMITIVE"]
    occurrence_ref: Ref
    kind_ref: Ref
    clock_ref: Ref
    tick: int = Field(ge=0)
    temporal_scope_ref: Ref
    snapshot_ref: Ref
    snapshot_kind: Literal["PRE_COMMAND", "SIMULTANEOUS", "ACTOR_TURN", "PRE_DOSE"]


class CycleStepInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cycle_step_input_c.v1"
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    native_request: CyclicCoverageRequest
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
    phases: tuple[CyclePhaseBindingC, ...] = Field(min_length=1, max_length=1)
    source_goal_acceptance_contract_ref: Ref | None = None
    source_goal_evidence_refs: tuple[Ref, ...] = ()


class CycleStepFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cycle_step_facts_c.v1"
    facts: FrozenMap


class CycleStepMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cycle_step_measurement_c.v1"
    frozen_request: CycleStepInputC
    native: DMechanicalResult | None
    packet: ExternalPrimitivePacketC | None
    missing_refs: tuple[Ref, ...]
    facts: FrozenMap


class CycleStepDecodeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cycle_step_decode_input_c.v1"
    request: CycleStepInputC
    native: DMechanicalResult


class CycleStepResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cycle_step_response_input_c.v1"
    measured: CycleStepMeasurementC
    source_status: Ref
    missing_cause: Ref | None


class CycleStepFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cycle_step_finish_input_c.v1"
    measured: CycleStepMeasurementC
    normalized: MechanicalNormalizedReturn


class CycleStepDispatchC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.cycle_step_dispatch_c.v1"
    frozen_measurement: CycleStepMeasurementC
    packet: ExternalPrimitivePacketC | None
    normalized: MechanicalNormalizedReturn
    native: DMechanicalResult | None
    discharged_inherited_phase_refs: tuple[Ref, ...]
    proposed_action: None = None
