"""Source-owned stable-arrival contract and exact K71 contribution supports."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_profile_d import DNativeProfileRequest, DNativeProfileContribution
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaDemand

class AxialArrivalContractC(FrozenModel):
    contract_ref: Ref
    quantifier: Literal["SOME_ADMISSIBLE_BODY_AFTER_NORMAL_GLOBAL_CLOSURE"]
    target_by_model: FrozenMap
    admissible_bodies_by_model: FrozenMap
    quantifier_evidence_refs: tuple[Ref, ...]
    persistence_scope_ref: Ref
    persistence_evidence_refs: tuple[Ref, ...]
    event_scope_ref: Ref
    event_evidence_refs: tuple[Ref, ...]
    acceptance_evidence_refs: tuple[Ref, ...]
    guard_cap_disqualifies: Literal[True] = True
    evidence_revision_ref: Ref

class AxialServiceSupportC(FrozenModel):
    inverse_return: DNativeProfileContribution
    provider_rotation_return: DNativeProfileContribution
    model_ref: Ref
    service_row_index: int = Field(ge=0, le=65535)
    provider_body_ref: Ref
    consumer_body_ref: Ref
    alignment_evidence_refs: tuple[Ref, ...]
    polarity_evidence_refs: tuple[Ref, ...]
    contact_stop_evidence_refs: tuple[Ref, ...] = ()
    deactivation_evidence_refs: tuple[Ref, ...] = ()
    usefulness_evidence_refs: tuple[Ref, ...]
    # Supplied Source relation; inverse-domain feasibility never implies reachability.
    preparation_dependency_refs: tuple[Ref, ...]

class AxialSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.axial_solving_input_c.v1"
    profile: DNativeProfileRequest
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    terminal_contract: AxialArrivalContractC
    service_supports: tuple[AxialServiceSupportC, ...] = Field(default=(), max_length=128)
    serving_k03: bool = False

class AxialSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.axial_solving_facts_c.v1"
    frozen_input: AxialSolvingInputC
    facts: FrozenMap
    service_reasons: tuple[FrozenMap, ...]
    missing_refs: tuple[Ref, ...]

class AxialSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.axial_solving_bind_input_c.v1"
    measured: AxialSolvingFactsC

class AxialSolvingFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.axial_solving_finish_input_c.v1"
    measured: AxialSolvingFactsC
    profile_return: DNativeProfileContribution | None

class AxialSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.axial_solving_return_c.v1"
    frozen_measurement: AxialSolvingFactsC
    profile_return: DNativeProfileContribution | None
    next_item_ref: Ref
    sibling_item_refs: tuple[Ref, ...]
    receipt: FrozenMap
    proposed_action: None = None
