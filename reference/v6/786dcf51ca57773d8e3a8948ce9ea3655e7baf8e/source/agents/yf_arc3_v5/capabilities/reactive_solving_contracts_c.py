"""Goal-owned navigation strategies consume the established K33 receipts."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaDemand
from .reactive_graph_contracts_c import ReactiveGraphRequestC, ReactiveGraphSourceReturnC
from .mechanical_common_contracts_c import SearchDomainInputC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .reactive_packet_contracts_c import ReactivePacketReceiptC

class ReactiveExitContractC(FrozenModel):
    exit_node_refs: tuple[Ref, ...]
    required_absent_guard_refs: tuple[Ref, ...]
    exit_evidence_refs: tuple[Ref, ...]
    removal_requirement_evidence_refs: tuple[Ref, ...]
    survival_required: Literal[True] = True
    evidence_revision_ref: Ref

class ReactiveRouteSupportC(FrozenModel):
    purpose: Literal["EXIT_ROUTE", "FLANK_CAPTURE", "LURE_AND_ESCAPE", "TEMPORAL_DETOUR"]
    joint_returns: tuple[ReactiveGraphSourceReturnC, ...] = Field(max_length=4096)
    needed_connection_ref: Ref
    usefulness_evidence_refs: tuple[Ref, ...]
    affected_guard_refs: tuple[Ref, ...]
    route_extraction_evidence_refs: tuple[Ref, ...] = ()
    cost_reduction_evidence_refs: tuple[Ref, ...] = ()
    blocking_return: ReactiveGraphSourceReturnC | None = None

class ReactiveSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_solving_input_c.v1"
    why: CoupledParentWhyC
    native_request: ReactiveGraphRequestC
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    terminal_contract: ReactiveExitContractC
    route_supports: tuple[ReactiveRouteSupportC, ...] = Field(default=(), max_length=128)
    search_query: SearchDomainInputC | None = None
    search_evidence_refs: tuple[Ref, ...] = ()
    packet_receipts: tuple[ReactivePacketReceiptC, ...] = Field(default=(), max_length=65536)
    serving_k03: bool = False
    recovery_control_ref: Ref | None = None
    recovery_scope_evidence_refs: tuple[Ref, ...] = ()
    recovery_scope: FrozenMap = Field(default_factory=FrozenMap)

class ReactiveSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_solving_facts_c.v1"
    frozen_input: ReactiveSolvingInputC
    facts: FrozenMap
    route_reasons: tuple[FrozenMap, ...]
    missing_refs: tuple[Ref, ...]

class ReactiveSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_solving_bind_input_c.v1"
    measured: ReactiveSolvingFactsC

class ReactiveSolvingFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_solving_finish_input_c.v1"
    measured: ReactiveSolvingFactsC
    native_return: ReactiveGraphSourceReturnC | None
    search_return: MechanicalNormalizedReturn | None

class ReactiveSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_solving_return_c.v1"
    frozen_measurement: ReactiveSolvingFactsC
    native_return: ReactiveGraphSourceReturnC | None
    search_return: MechanicalNormalizedReturn | None
    next_item_ref: Ref
    recovery_facts: FrozenMap
    proposed_action: None = None
