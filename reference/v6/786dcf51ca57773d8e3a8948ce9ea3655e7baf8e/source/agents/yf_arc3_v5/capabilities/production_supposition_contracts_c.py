"""Five scoped observational questions preserve unknown mechanisms and principal goals."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .structural_supposition_contracts_c import StructuralScopeC, VisibleGraphInputC, StructuralSuppositionFactsC
from .typed_mask_contracts_c import TypedMaskRelationInputC
from .indexed_sequence_contracts_c import IndexedSequenceInputC, IndexedSequenceMeasurementC
from .transport_supposition_contracts_c import ScopedTransportObservationC
from .consumable_reaction_network import ConsumableReactionRequest
from .chromatic_window_composition import ChromaticWindowRequest
from .adversarial_drop_alignment import AdversarialDropRequest
from .mechanical_family_contracts_a import MechanicalFamilyResult


class NativeMeasureBindingC(FrozenModel):
    current_model_revision_ref: Ref
    binding_evidence_refs: tuple[Ref, ...]


class ReactionSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reaction_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    walking_graph: VisibleGraphInputC
    transmission_graph: VisibleGraphInputC
    graph_role_evidence_refs: tuple[Ref, ...]
    repeated_oriented_cell_evidence_refs: tuple[Ref, ...]
    distinct_primed_state_evidence_refs: tuple[Ref, ...]
    differentiated_terminal_evidence_refs: tuple[Ref, ...]
    independently_movable_overlay_evidence_refs: tuple[Ref, ...]
    native_layers: ConsumableReactionRequest | None = None
    native_binding: NativeMeasureBindingC | None = None


class MixedWindowExampleC(ScopedTransportObservationC):
    sample_ref: Ref
    pane_refs: tuple[Ref, ...]
    canonical_value_ref: Ref | None
    mixed_value_identity_evidence_refs: tuple[Ref, ...]
    pane_ownership_evidence_refs: tuple[Ref, ...]
    inside_observed_window: bool | None
    window_relation_evidence_refs: tuple[Ref, ...]


class ChromaticSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.chromatic_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    framed_field_evidence_refs: tuple[Ref, ...]
    smaller_homologous_reference_evidence_refs: tuple[Ref, ...]
    irregular_pane_evidence_refs: tuple[Ref, ...]
    pane_refs: tuple[Ref, ...] = Field(max_length=16)
    pane_overlap_relations: tuple[TypedMaskRelationInputC, ...] = Field(max_length=128)
    mixtures: tuple[MixedWindowExampleC, ...] = Field(max_length=256)
    white_point_ref: Ref | None
    white_point_competing_role_refs: tuple[Ref, ...]
    native_window: ChromaticWindowRequest | None = None
    native_binding: NativeMeasureBindingC | None = None


class DropPlacementC(FrozenModel):
    token_ref: Ref
    board_ref: Ref
    owner_ref: Ref
    row: int
    column: int
    chronological_ordinal: int = Field(ge=0)
    post_input_automatic: bool | None
    owner_identity_evidence_refs: tuple[Ref, ...]
    actual_placement_evidence_refs: tuple[Ref, ...]
    phase_ownership_evidence_refs: tuple[Ref, ...]


class DropTransactionC(ScopedTransportObservationC):
    board_ref: Ref
    input_owner_ref: Ref
    primitive_refs: tuple[Ref, ...] = Field(max_length=256)
    placements: tuple[DropPlacementC, ...] = Field(max_length=256)
    full_transaction_inventory_complete: bool
    transaction_evidence_refs: tuple[Ref, ...]


class AdversarialSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.adversarial_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    aligned_same_owner_evidence_refs: tuple[Ref, ...]
    gravity_supported_board_evidence_refs: tuple[Ref, ...]
    transactions: tuple[DropTransactionC, ...] = Field(max_length=128)
    native_board: AdversarialDropRequest | None = None
    native_binding: NativeMeasureBindingC | None = None


class TypedSlotCompatibilityC(FrozenModel):
    operand_ref: Ref
    requested_slot_ref: Ref
    compatible: bool | None
    independent_type_relation_evidence_refs: tuple[Ref, ...]


class WorkbenchSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.workbench_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    stock_area_evidence_refs: tuple[Ref, ...]
    separate_operand_holder_evidence_refs: tuple[Ref, ...]
    input_holder_node_refs: tuple[Ref, ...] = Field(max_length=128)
    output_holder_node_refs: tuple[Ref, ...] = Field(max_length=128)
    holder_role_evidence_refs: tuple[Ref, ...]
    diagrams: VisibleGraphInputC
    compatibility: tuple[TypedSlotCompatibilityC, ...] = Field(max_length=256)
    operand_refs: tuple[Ref, ...] = Field(max_length=256)
    requested_slot_refs: tuple[Ref, ...] = Field(max_length=256)
    slot_role_evidence_refs: tuple[Ref, ...]
    emphasized_control_ref: Ref | None
    emphasized_control_competing_role_refs: tuple[Ref, ...]


class NormalizedPatternUnitC(FrozenModel):
    unit_ref: Ref
    comparison_basis_ref: Ref
    normalization_evidence_refs: tuple[Ref, ...]
    sequence: IndexedSequenceInputC


class LocalPatternEditC(ScopedTransportObservationC):
    before: NormalizedPatternUnitC
    after: NormalizedPatternUnitC
    primitive_refs: tuple[Ref, ...] = Field(max_length=256)
    isolated_edit_evidence_refs: tuple[Ref, ...]


class LatentRestorationSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.latent_restoration_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    units: tuple[NormalizedPatternUnitC, ...] = Field(max_length=64)
    edits: tuple[LocalPatternEditC, ...] = Field(max_length=64)
    localized_deviation_cap: int = Field(ge=0)
    maximum_probe_primitives: int = Field(ge=0)
    max_pair_checks: int = Field(ge=0)
    max_total_projected_slots: int = Field(ge=0)


class ProductionSuppositionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.production_supposition_facts_c.v1"
    facts: FrozenMap
    measurements: tuple[FrozenMap, ...]
    graph_measurements: tuple[StructuralSuppositionFactsC, ...] = ()
    native_measurement: MechanicalFamilyResult | None = None
    indexed_measurements: tuple[IndexedSequenceMeasurementC, ...] = ()
    actual_pair_checks: int = Field(default=0, ge=0)
    actual_projected_slot_count: int = Field(default=0, ge=0)


class ProductionSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.production_supposition_decision_input_c.v1"
    request: ReactionSuppositionInputC | ChromaticSuppositionInputC | AdversarialSuppositionInputC | WorkbenchSuppositionInputC | LatentRestorationSuppositionInputC
    measured: ProductionSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class ProductionSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.production_supposition_decision_c.v1"
    frozen_request: ReactionSuppositionInputC | ChromaticSuppositionInputC | AdversarialSuppositionInputC | WorkbenchSuppositionInputC | LatentRestorationSuppositionInputC
    frozen_measurement: ProductionSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    confirmed_law_terminal_or_action: None = None
