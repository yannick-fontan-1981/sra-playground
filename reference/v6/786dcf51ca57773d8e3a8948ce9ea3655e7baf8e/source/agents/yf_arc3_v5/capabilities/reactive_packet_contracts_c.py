"""Thin complete K33 primitive receipt to the existing K03/K09 packet contract."""
from pydantic import Field
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_common_contracts_c import ExternalPrimitivePacketC
from .reactive_graph_contracts_c import ReactiveGraphSourceReturnC

class ReactivePhaseBindingC(FrozenModel):
    occurrence_ref: Ref
    kind_ref: Ref
    producer_ref: Ref
    clock_ref: Ref
    tick: int = Field(ge=0)
    temporal_scope_ref: Ref
    snapshot_ref: Ref
    snapshot_kind: Literal["PRE_COMMAND", "SIMULTANEOUS", "ACTOR_TURN", "PRE_DOSE"]

class ReactivePacketReceiptC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_packet_receipt_c.v1"
    returned: ReactiveGraphSourceReturnC
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    model_ref: Ref
    action_ref: Ref
    primitive_ref: Ref
    response_ref: Ref
    closure_domain_ref: Ref
    closure_stop_ref: Ref
    source_goal_acceptance_contract_ref: Ref | None
    phase_bindings: tuple[ReactivePhaseBindingC, ...] = Field(max_length=4096)
    ownership_evidence_refs: tuple[Ref, ...]
    phase_clock_evidence_refs: tuple[Ref, ...]

class ReactivePacketMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_packet_measurement_c.v1"
    frozen_receipt: ReactivePacketReceiptC
    packet: ExternalPrimitivePacketC | None
    missing_refs: tuple[Ref, ...]
