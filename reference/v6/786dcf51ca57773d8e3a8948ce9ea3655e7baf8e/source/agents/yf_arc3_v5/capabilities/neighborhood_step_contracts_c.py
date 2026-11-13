"""One exact native D STEP, independently of the two B providers."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_request_contracts import MechanicalRequestIdentity, MechanicalResponseInput, MechanicalNormalizedReturn
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .mechanical_family_contracts_d import DMechanicalResult
from .neighborhood_pattern_construction import NeighborhoodPatternRequest


class NeighborhoodPhaseBindingC(FrozenModel):
    phase: Literal["DIRECT", "RECOLOR", "ACCEPTANCE", "RESET", "IGNORED"]
    kind_ref: Ref
    clock_ref: Ref
    tick: int = Field(ge=0)
    temporal_scope_ref: Ref
    snapshot_ref: Ref
    snapshot_kind: Literal["PRE_COMMAND", "SIMULTANEOUS", "ACTOR_TURN", "PRE_DOSE"]
    occurrence_ref: Ref


class NeighborhoodStepInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_step_input_c.v2"
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    native_request: NeighborhoodPatternRequest
    source_parent_goal_ref: Ref
    source_identity_contract_ref: Ref
    source_phase_clock_contract_ref: Ref
    model_ref: Ref
    native_model_revision_ref: Ref
    native_model_status_ref: Ref
    native_model_digest: Ref
    native_bounds: FrozenMap
    action_ref: Ref
    primitive_ref: Ref
    response_ref: Ref
    closure_domain_ref: Ref
    closure_stop_ref: Ref
    model_interruption_ref: Ref
    phases: tuple[NeighborhoodPhaseBindingC, ...] = Field(min_length=5, max_length=5)
    cost: int = Field(ge=0)
    source_goal_acceptance_contract_ref: Ref | None = None
    source_goal_evidence_refs: tuple[Ref, ...] = ()


class NeighborhoodStepFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_step_facts_c.v1"
    facts: FrozenMap


class NeighborhoodStepDecodeInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_step_decode_input_c.v1"
    request: NeighborhoodStepInputC
    native: DMechanicalResult


class NeighborhoodStepMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_step_measurement_c.v1"
    request: NeighborhoodStepInputC
    native: DMechanicalResult | None
    packet: ExternalPrimitivePacketC | None
    missing_refs: tuple[Ref, ...]
    facts: FrozenMap


class NeighborhoodStepResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_step_response_input_c.v1"
    measured: NeighborhoodStepMeasurementC
    source_status: Ref
    missing_cause: Ref | None


class NeighborhoodStepFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_step_finish_input_c.v1"
    measured: NeighborhoodStepMeasurementC
    normalized: MechanicalNormalizedReturn


class NeighborhoodStepDispatchC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.neighborhood_step_dispatch_c.v2"
    frozen_measurement: NeighborhoodStepMeasurementC
    ready_inherited_phase_refs: tuple[Ref, ...]
    packet: ExternalPrimitivePacketC | None
    normalized: MechanicalNormalizedReturn
    native: DMechanicalResult | None
