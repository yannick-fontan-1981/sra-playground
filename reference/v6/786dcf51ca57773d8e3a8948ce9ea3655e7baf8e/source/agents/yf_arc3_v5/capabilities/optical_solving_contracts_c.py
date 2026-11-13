"""Goal-owned optical propagation strategy over current K73 and common K09."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .mechanical_profile_d import DNativeProfileRequest, DNativeProfileContribution
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaDemand
from .mechanical_common_contracts_c import SearchDomainInputC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .optical_route_a import OpticalRouteBindingA

class OpticalTerminalContractC(FrozenModel):
    quantifier: Literal["LAUNCHED_FIRST_IMPACT_CHAIN_TO_DECLARED_TERMINAL"]
    terminal_by_model: FrozenMap
    required_activation_by_model: FrozenMap
    all_relays_required: bool
    explicit_all_relays_evidence_refs: tuple[Ref, ...]
    quantifier_evidence_refs: tuple[Ref, ...]
    persistence_scope_ref: Ref
    persistence_evidence_refs: tuple[Ref, ...]
    event_scope_ref: Ref
    event_evidence_refs: tuple[Ref, ...]
    authenticated_launch_required: Literal[True] = True
    launch_authentication_evidence_refs: tuple[Ref, ...]
    evidence_revision_ref: Ref

class OpticalRouteSelectionC(FrozenModel):
    model_ref: Ref
    first_receiver_chain: tuple[Ref, ...] = Field(min_length=1, max_length=129)
    # Includes emitter, then each relay; directions are absolute encoded values.
    outgoing_directions: tuple[tuple[Ref, Ref], ...] = Field(max_length=129)
    current_selection_evidence_refs: tuple[Ref, ...]

class OpticalSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.optical_solving_input_c.v1"
    profile: DNativeProfileRequest
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    terminal_contract: OpticalTerminalContractC
    source_route_witnesses: tuple[OpticalRouteSelectionC, ...] = Field(default=(), max_length=32)
    first_hit_returns: tuple[DNativeProfileContribution, ...] = Field(default=(), max_length=4096)
    route_query: SearchDomainInputC | None = None
    route_query_evidence_refs: tuple[Ref, ...] = ()
    route_binding: OpticalRouteBindingA | None = None
    serving_k03: bool = False

class OpticalSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.optical_solving_facts_c.v1"
    frozen_input: OpticalSolvingInputC
    facts: FrozenMap
    preparation_reasons: tuple[FrozenMap, ...]
    missing_refs: tuple[Ref, ...]

class OpticalSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.optical_solving_bind_input_c.v1"
    measured: OpticalSolvingFactsC

class OpticalSolvingFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.optical_solving_finish_input_c.v1"
    measured: OpticalSolvingFactsC
    profile_return: DNativeProfileContribution | None
    search_return: MechanicalNormalizedReturn | None

class OpticalSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.optical_solving_return_c.v1"
    frozen_measurement: OpticalSolvingFactsC
    profile_return: DNativeProfileContribution | None
    search_return: MechanicalNormalizedReturn | None
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref, ...]
    root_witnesses: tuple[FrozenMap, ...] = Field(max_length=3)
    proposed_action: None = None
