"""Five current interaction questions preserve lifetime, identity and route scope."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC, VisibleGraphInputC, StructuralSuppositionFactsC
from .production_supposition_contracts_c import NativeMeasureBindingC, NormalizedPatternUnitC
from .transport_supposition_contracts_c import ScopedTransportObservationC
from .indexed_sequence_contracts_c import IndexedSequenceMeasurementC
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .shared_symbol_automata import SharedSymbolRequest
from .identity_contact_authentication import IdentityContactRequest
from .push_only_logistics import PushRequest
from .mechanical_common_contracts_c import SearchResultC
from .mechanical_request_contracts import MechanicalRequestIdentity


class EndpointPatternPairC(FrozenModel):
    first: NormalizedPatternUnitC
    second: NormalizedPatternUnitC
    endpoint_role_evidence_refs: tuple[Ref, ...]


class PairingRewriteExampleC(ScopedTransportObservationC):
    pairing_before: FrozenMap
    pairing_after: FrozenMap
    complete_pairing_inventory: bool
    actual_contact_evidence_refs: tuple[Ref, ...]
    independent_pairing_identity_evidence_refs: tuple[Ref, ...]


class EndpointRewriteSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.endpoint_rewrite_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    endpoint_refs: tuple[Ref, ...] = Field(max_length=256)
    graph: VisibleGraphInputC
    patterns: tuple[EndpointPatternPairC, ...] = Field(max_length=64)
    oriented_exit_evidence_refs: tuple[Ref, ...]
    acquisition_light_evidence_refs: tuple[Ref, ...]
    access_controlled_destination_evidence_refs: tuple[Ref, ...]
    rewrites: tuple[PairingRewriteExampleC, ...] = Field(max_length=128)
    max_total_pattern_slots: int = Field(ge=0)


class WellMeasurementC(FrozenModel):
    well_ref: Ref
    value: int | None
    lower_bound: int | None
    upper_bound: int | None
    quantity_identity_evidence_refs: tuple[Ref, ...]
    band_role_evidence_refs: tuple[Ref, ...]


class GlyphWellExampleC(ScopedTransportObservationC):
    glyph_ref: Ref
    glyph_well_before: Ref | None
    glyph_well_after: Ref | None
    glyph_persistence_value: bool | None
    glyph_identity_evidence_refs: tuple[Ref, ...]
    complete_glyph_inventory: bool
    quantities_before: FrozenMap
    quantities_after: FrozenMap
    complete_quantity_inventory: bool
    quantity_evidence_refs: tuple[Ref, ...]


class RecurringQuantitySuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recurring_quantity_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    wells: tuple[WellMeasurementC, ...] = Field(max_length=128)
    grouped_queue_alternative_evidence_refs: tuple[Ref, ...]
    finite_horizon_evidence_refs: tuple[Ref, ...]
    examples: tuple[GlyphWellExampleC, ...] = Field(max_length=256)


class SymbolFocusExampleC(ScopedTransportObservationC):
    input_channel_ref: Ref
    primitive_ref: Ref
    prefix_before: FrozenMap
    prefix_after: FrozenMap
    word_lengths: FrozenMap
    full_group_inventory: bool
    ordered_word_focus_evidence_refs: tuple[Ref, ...]
    latched_group_refs: tuple[Ref, ...]
    independent_latch_evidence_refs: tuple[Ref, ...]


class SharedSymbolSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shared_symbol_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    framed_ordered_rows_evidence_refs: tuple[Ref, ...]
    independent_focus_evidence_refs: tuple[Ref, ...]
    shared_channel_refs: tuple[Ref, ...] = Field(max_length=128)
    group_refs: tuple[Ref, ...] = Field(max_length=128)
    shared_channel_identity_evidence_refs: tuple[Ref, ...]
    examples: tuple[SymbolFocusExampleC, ...] = Field(max_length=256)
    native_groups: SharedSymbolRequest | None = None
    native_binding: NativeMeasureBindingC | None = None


class AuthenticationExampleC(ScopedTransportObservationC):
    candidate_ref: Ref
    mode_ref: Ref
    actual_contact_evidence_refs: tuple[Ref, ...]
    glow_observed: bool | None
    readiness_display: bool | None
    display_identity_evidence_refs: tuple[Ref, ...]
    independently_accepted_request_refs: tuple[Ref, ...]
    accepted_request_evidence_refs: tuple[Ref, ...]
    calibrated_readiness: bool | None
    calibration_evidence_refs: tuple[Ref, ...]


class AuthenticationSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.authentication_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    candidate_refs: tuple[Ref, ...] = Field(max_length=256)
    similar_candidate_evidence_refs: tuple[Ref, ...]
    requested_identity_refs: tuple[Ref, ...] = Field(max_length=256)
    counted_request_evidence_refs: tuple[Ref, ...]
    calibration_device_evidence_refs: tuple[Ref, ...]
    mode_dependent_visibility_evidence_refs: tuple[Ref, ...]
    examples: tuple[AuthenticationExampleC, ...] = Field(max_length=256)
    native_layers: IdentityContactRequest | None = None
    native_binding: NativeMeasureBindingC | None = None


class SupportRouteEvidenceC(FrozenModel):
    expected_request: MechanicalRequestIdentity
    returned: SearchResultC
    actor_ref: Ref
    support_cell: tuple[int, int]
    issuance_evidence_refs: tuple[Ref, ...]
    actor_support_goal_evidence_refs: tuple[Ref, ...]


class PushSiteQuestionC(FrozenModel):
    crate_ref: Ref
    actor_ref: Ref
    crate_cell: tuple[int, int]
    declared_push_delta: tuple[int, int]
    single_cell_crate_evidence_refs: tuple[Ref, ...]
    lattice_and_delta_evidence_refs: tuple[Ref, ...]
    receiving_space_free: bool | None
    receiving_cell_observed: tuple[int, int]
    receiving_inventory_evidence_refs: tuple[Ref, ...]
    support_route: SupportRouteEvidenceC | None = None


class PushLogisticsSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.push_logistics_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    movable_crate_evidence_refs: tuple[Ref, ...]
    repeated_hollow_target_evidence_refs: tuple[Ref, ...]
    small_independently_moving_actor_evidence_refs: tuple[Ref, ...]
    sites: tuple[PushSiteQuestionC, ...] = Field(max_length=256)
    native_board: PushRequest | None = None
    native_binding: NativeMeasureBindingC | None = None


class InteractionSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.interaction_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    graph_measurement: StructuralSuppositionFactsC | None = None
    indexed_measurements: tuple[IndexedSequenceMeasurementC, ...] = ()
    native_measurement: MechanicalFamilyResult | None = None
    actual_projected_slot_count: int = Field(default=0, ge=0)


class InteractionSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.interaction_supposition_decision_input_c.v1"
    request: EndpointRewriteSuppositionInputC | RecurringQuantitySuppositionInputC | SharedSymbolSuppositionInputC | AuthenticationSuppositionInputC | PushLogisticsSuppositionInputC
    measured: InteractionSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class InteractionSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.interaction_supposition_decision_c.v1"
    frozen_request: EndpointRewriteSuppositionInputC | RecurringQuantitySuppositionInputC | SharedSymbolSuppositionInputC | AuthenticationSuppositionInputC | PushLogisticsSuppositionInputC
    frozen_measurement: InteractionSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_law_permission_goal_or_action: None = None
