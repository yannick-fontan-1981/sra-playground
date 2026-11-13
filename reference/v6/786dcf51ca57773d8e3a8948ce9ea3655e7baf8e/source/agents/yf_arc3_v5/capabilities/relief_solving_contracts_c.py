"""Ordered painting Source reasoning over exact K21 certificates and parent WHY."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .ordered_relief_writing import ReliefRequest
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaDemand
from .family_result_join import FamilyJoinGroup, FamilyJoinRequest, FamilyJoinResult

class ReliefReferenceContractC(FrozenModel):
    reference_cells: tuple[tuple[tuple[int, int], int], ...] = Field(max_length=4096)
    preserved_cells: tuple[tuple[int, int], ...] = Field(max_length=4096)
    reference_evidence_refs: tuple[Ref, ...]
    preservation_evidence_refs: tuple[Ref, ...]
    evidence_revision_ref: Ref

class ReliefContributionSupportC(FrozenModel):
    candidate_ref: Ref
    forward_request: ReliefRequest
    forward_result: MechanicalFamilyResult
    # Exact exposed cells for each application, independently of its hidden footprint.
    surviving_by_step_ref: FrozenMap
    future_cover_by_step_ref: FrozenMap
    contribution_evidence_refs: tuple[Ref, ...]
    smaller_control_evidence_refs: tuple[Ref, ...] = ()
    changed_footprint_evidence_refs: tuple[Ref, ...] = ()

class ReliefSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_solving_input_c.v1"
    why: CoupledParentWhyC
    native_request: ReliefRequest
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    terminal_contract: ReliefReferenceContractC
    contribution_supports: tuple[ReliefContributionSupportC, ...] = Field(default=(), max_length=4096)
    minimum_complete_cost_allowance: int | None = Field(default=None, ge=0)
    resource_evidence_refs: tuple[Ref, ...] = ()
    peer_groups: tuple[FamilyJoinGroup, ...] = Field(default=(), max_length=127)
    join_request_ref: Ref | None = None
    maximum_join_pairs: int = Field(default=0, ge=0, le=65536)
    maximum_join_candidates: int = Field(default=0, ge=0, le=4096)

class ReliefSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_solving_facts_c.v1"
    frozen_input: ReliefSolvingInputC
    facts: FrozenMap
    contribution_reasons: tuple[FrozenMap, ...]
    missing_refs: tuple[Ref, ...]

class ReliefSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_solving_bind_input_c.v1"
    measured: ReliefSolvingFactsC

class ReliefSolvingFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_solving_finish_input_c.v1"
    measured: ReliefSolvingFactsC
    returned: MechanicalNormalizedReturn | None

class ReliefSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_solving_return_c.v1"
    frozen_measurement: ReliefSolvingFactsC
    returned: MechanicalNormalizedReturn | None
    receipt: FrozenMap
    next_item_ref: Ref
    family_join_request: FamilyJoinRequest | None = None
    family_join_result: FamilyJoinResult | None = None
    proposed_action: None = None

class ReliefJoinFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_join_facts_c.v1"
    returned: ReliefSolvingReturnC
    facts: FrozenMap

class ReliefJoinInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_join_input_c.v1"
    returned: ReliefSolvingReturnC

class ReliefJoinReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_join_return_input_c.v1"
    returned: ReliefSolvingReturnC
    joined: FamilyJoinResult

class ReliefMechanicalReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.relief_mechanical_return_input_c.v1"
    request: ReliefRequest
    measurement: MechanicalFamilyResult
    kernel_ref: Ref
    source_status: Ref
    missing_cause: Ref
    question_ref: Ref
