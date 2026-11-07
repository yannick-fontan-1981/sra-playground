"""Source target layouts, supported dependence and exact K25 questions."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .inverse_anchor_signature import AnchorRequest
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .family_agenda_projection import FamilyAgendaSnapshot, FamilyAgendaDemand
from .coupled_solving_contracts_c import CoupledParentWhyC
from .family_result_join import FamilyJoinGroup, FamilyJoinRequest, FamilyJoinResult
from .contracts import QuantitySimulationInput, QuantitySimulationResult
from agents.yf_arc3_v5.state.parent_measurement_template_b import ParentMeasurementSlotB

class AnchorTargetLayoutC(FrozenModel):
    target_ref: Ref
    system_ref: Ref
    common_center: tuple[int, int]
    # Positions in the same local region frame as the native dependent signature.
    spatial_signature: tuple[tuple[tuple[int,int],Ref], ...] = Field(max_length=4096)
    wanted_beacon_position: tuple[int,int]
    grouping_evidence_refs: tuple[Ref, ...]
    layout_evidence_refs: tuple[Ref, ...]
    # Actual disconnected stroke pixels, grouped by Source; geometry revalidates this group.
    observed_strokes: tuple[tuple[tuple[tuple[int,int],Ref], ...], ...] = Field(min_length=1,max_length=256)

class AnchorGoalContractC(FrozenModel):
    targets: tuple[AnchorTargetLayoutC, ...] = Field(min_length=1,max_length=16)
    preserved_system_refs: tuple[Ref, ...] = Field(default=(),max_length=16)
    quantifier: Literal["ALL_DECLARED_TARGETS_SPATIAL_SIGNATURE_AND_POSE"]
    quantifier_evidence_refs: tuple[Ref, ...]
    resource_evidence_refs: tuple[Ref, ...]
    evidence_revision_ref: Ref

class AnchorLawScopeC(FrozenModel):
    anchor_count: int = Field(ge=2,le=16)
    relation_kind: Literal["MEAN","RATIONAL_WEIGHTED"]
    evidence_refs: tuple[Ref, ...]
    status: Literal["OBSERVED","SUPPORTED_HYPOTHESIS","MISSING"]
    quantizer: Literal["floor","ceil","truncate_toward_zero","nearest_ties_to_even"]
    model_revision_ref: Ref
    falsifier_ref: Ref

class AnchorCanonicalBindingC(FrozenModel):
    term_ref: Ref
    claim_ref: Ref
    native_field_ref: Ref
    value: FrozenMap
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    source_slot: ParentMeasurementSlotB

class AnchorPreparationSupportC(FrozenModel):
    consumer_system_ref: Ref
    inverse_variable_anchor_ref: Ref
    waypoint_ref: Ref
    exhausted_inverse_request: AnchorRequest
    exhausted_inverse_result: MechanicalFamilyResult
    preparation_request: AnchorRequest
    preparation_result: MechanicalFamilyResult
    newly_available_request: AnchorRequest
    newly_available_result: MechanicalFamilyResult
    prerequisite_evidence_refs: tuple[Ref, ...]

class AnchorActionBindingC(FrozenModel):
    operator_kind: Literal["transfer_control","place_active_anchor"]
    requested_anchor_ref: Ref
    affected_system_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    destination: tuple[int,int] | None
    evidence_refs: tuple[Ref, ...]
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref

class AnchorConstructionSupportC(FrozenModel):
    system_ref: Ref
    native_request: AnchorRequest
    native_result: MechanicalFamilyResult

class AnchorStockWitnessC(FrozenModel):
    witness_ref: Ref
    candidate_by_system: FrozenMap
    sink_ref_by_system_resource: FrozenMap
    quantity_simulation: QuantitySimulationInput | None = None
    evidence_refs: tuple[Ref, ...]

class AnchorSolvingInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_solving_input_c.v1"
    why: CoupledParentWhyC
    native_request: AnchorRequest
    agenda: FamilyAgendaSnapshot
    demand: FamilyAgendaDemand
    goal_contract: AnchorGoalContractC
    law_scope: AnchorLawScopeC | None = None
    canonical_bindings: tuple[AnchorCanonicalBindingC, ...] = Field(default=(),max_length=256)
    preparation_supports: tuple[AnchorPreparationSupportC, ...] = Field(default=(),max_length=3)
    action_binding: AnchorActionBindingC | None = None
    construction_supports: tuple[AnchorConstructionSupportC, ...] = Field(default=(),max_length=16)
    stock_witnesses: tuple[AnchorStockWitnessC, ...] = Field(default=(),max_length=3)
    peer_groups: tuple[FamilyJoinGroup, ...] = Field(default=(),max_length=127)
    join_request_ref: Ref | None = None
    maximum_join_pairs: int = Field(default=0,ge=0,le=65536)
    maximum_join_candidates: int = Field(default=0,ge=0,le=4096)

class AnchorSolvingFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_solving_facts_c.v1"
    frozen_input: AnchorSolvingInputC
    facts: FrozenMap
    preparation_reasons: tuple[FrozenMap, ...]
    missing_refs: tuple[Ref, ...]

class AnchorSolvingBindInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_solving_bind_input_c.v1"
    measured: AnchorSolvingFactsC

class AnchorSolvingFinishInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_solving_finish_input_c.v1"
    measured: AnchorSolvingFactsC
    returned: MechanicalNormalizedReturn | None

class AnchorSolvingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_solving_return_c.v1"
    frozen_measurement: AnchorSolvingFactsC
    returned: MechanicalNormalizedReturn | None
    receipt: FrozenMap
    next_item_ref: Ref
    result_reasons: FrozenMap = Field(default_factory=FrozenMap)
    family_join_request: FamilyJoinRequest | None = None
    family_join_result: FamilyJoinResult | None = None
    proposed_action: None = None

class AnchorStockPreparedC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_stock_prepared_c.v1"
    returned: AnchorSolvingReturnC
    witness: AnchorStockWitnessC
    bound: bool
    simulation_required: bool = True
    missing_refs: tuple[Ref, ...]

class AnchorStockPrepareInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_stock_prepare_input_c.v1"
    returned: AnchorSolvingReturnC
    witness: AnchorStockWitnessC

class AnchorStockSimulationInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_stock_simulation_input_c.v1"
    prepared: AnchorStockPreparedC

class AnchorStockAppendInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_stock_append_input_c.v1"
    prepared: AnchorStockPreparedC
    measured: QuantitySimulationResult | None
    prior_rows: tuple[FrozenMap, ...]

class AnchorStockSealInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_stock_seal_input_c.v1"
    returned: AnchorSolvingReturnC
    rows: tuple[FrozenMap, ...]

class AnchorStockRowsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_stock_rows_c.v1"
    rows: tuple[FrozenMap, ...] = Field(default=(),max_length=3)

class AnchorStockStartInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_stock_start_input_c.v1"
    returned: AnchorSolvingReturnC

class AnchorJoinInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_join_input_c.v1"
    returned: AnchorSolvingReturnC

class AnchorJoinFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_join_facts_c.v1"
    returned: AnchorSolvingReturnC
    facts: FrozenMap

class AnchorJoinReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_join_return_input_c.v1"
    returned: AnchorSolvingReturnC
    joined: FamilyJoinResult

class AnchorBindingPublicationC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_binding_publication_c.v1"
    request: AnchorSolvingInputC
    rows: tuple[FrozenMap, ...]
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]

class AnchorBindingReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_binding_return_c.v1"
    request: AnchorSolvingInputC
    facts: FrozenMap
    missing_refs: tuple[Ref, ...]

class AnchorBindingBlockedInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.anchor_binding_blocked_input_c.v1"
    returned: AnchorBindingReturnC
