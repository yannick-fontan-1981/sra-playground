"""Native K63 STEP and its supplied clocks, with no second transition engine."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .metric_stack_contracts import MetricStackRequest, MetricStackCalculation
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalNormalizedReturn


class MetricPhaseBindingC(FrozenModel):
    phase: Literal["DIRECT", "AUTOMATIC", "COST", "ACCEPTANCE"]
    kind_ref: Ref
    clock_ref: Ref
    tick: int = Field(ge=0)
    temporal_scope_ref: Ref
    snapshot_ref: Ref
    snapshot_kind: Literal["PRE_COMMAND", "SIMULTANEOUS", "ACTOR_TURN", "PRE_DOSE"]
    occurrence_ref: Ref


class MetricStepInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_step_input_c.v1"
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    native_request: MetricStackRequest
    source_parent_goal_ref: Ref
    source_identity_contract_ref: Ref
    source_phase_clock_contract_ref: Ref
    model_ref: Ref
    native_model_digest: Ref
    action_ref: Ref
    primitive_ref: Ref
    response_ref: Ref
    closure_domain_ref: Ref
    closure_stop_ref: Ref
    model_interruption_ref: Ref
    phases: tuple[MetricPhaseBindingC, ...] = Field(min_length=4, max_length=4)


class MetricStepFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_step_facts_c.v1"
    facts: FrozenMap


class MetricStepDecodeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_step_decode_input_c.v1"
    request: MetricStepInputC
    native: MetricStackCalculation


class MetricStepMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_step_measurement_c.v1"
    request: MetricStepInputC
    native: MetricStackCalculation | None
    packet: ExternalPrimitivePacketC | None
    missing_refs: tuple[Ref, ...]
    facts: FrozenMap


class MetricStepResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_step_response_input_c.v1"
    measured: MetricStepMeasurementC
    source_status: Ref
    missing_cause: Ref | None


class MetricStepFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_step_finish_input_c.v1"
    measured: MetricStepMeasurementC
    normalized: MechanicalNormalizedReturn


class MetricStepDispatchC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_step_dispatch_c.v1"
    packet: ExternalPrimitivePacketC | None
    normalized: MechanicalNormalizedReturn
    native: MetricStackCalculation | None
