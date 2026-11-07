"""Scoped observations for two revisable questions; no physical model confirmation."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .structural_supposition_contracts_c import StructuralScopeC
from .transport_supposition_contracts_c import ScopedTransportObservationC
from .goal_supposition_contracts_c import GoalSuppositionFactsC


class ReceivingPositionC(ScopedTransportObservationC):
    schema_version: Ref = "yf_arc3_v5.receiving_position_c.v1"
    episode_ref: Ref
    entity_ref: Ref
    side_ref: Ref | None
    carried: bool | None
    side_evidence_refs: tuple[Ref, ...]
    carried_evidence_refs: tuple[Ref, ...]


class GuardedTransportSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.guarded_transport_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    paired_region_evidence_refs: tuple[Ref, ...]
    crossing_support_evidence_refs: tuple[Ref, ...]
    independent_carrier_control_evidence_refs: tuple[Ref, ...]
    cargo_body_evidence_refs: tuple[Ref, ...]
    compatible_receiving_frame_evidence_refs: tuple[Ref, ...]
    required_carrier_ref: Ref
    required_beneficiary_refs: tuple[Ref, ...] = Field(max_length=256)
    required_population_complete: bool
    required_population_evidence_refs: tuple[Ref, ...]
    receiving_side_ref: Ref | None
    receiving_side_evidence_refs: tuple[Ref, ...]
    acceptance_checkpoint_ref: Ref | None
    acceptance_checkpoint_evidence_refs: tuple[Ref, ...]
    positions: tuple[ReceivingPositionC, ...] = Field(max_length=257)


class CascadeQuotaObservationC(ScopedTransportObservationC):
    schema_version: Ref = "yf_arc3_v5.cascade_quota_observation_c.v1"
    episode_ref: Ref
    transaction_ref: Ref
    lock_and_cascade_complete: bool | None
    completion_evidence_refs: tuple[Ref, ...]
    credit_after: int | None = Field(default=None, ge=0)
    credit_evidence_refs: tuple[Ref, ...]
    before_terminal_checkpoint: bool | None
    terminal_checkpoint_ref: Ref | None
    checkpoint_evidence_refs: tuple[Ref, ...]


class QueuedCascadeSuppositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.queued_cascade_supposition_input_c.v1"
    scope: StructuralScopeC
    question_ref: Ref
    active_ordered_bundle_evidence_refs: tuple[Ref, ...]
    homologous_queued_miniature_evidence_refs: tuple[Ref, ...]
    near_equal_line_evidence_refs: tuple[Ref, ...]
    removal_effect_evidence_refs: tuple[Ref, ...]
    changing_credit_display_evidence_refs: tuple[Ref, ...]
    required_quota: int | None = Field(default=None, ge=0)
    quota_requirement_evidence_refs: tuple[Ref, ...]
    observation: CascadeQuotaObservationC | None


class BExtensionSuppositionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.b_extension_supposition_decision_input_c.v1"
    request: GuardedTransportSuppositionInputC | QueuedCascadeSuppositionInputC
    measured: GoalSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    source_registration_admissible: bool


class BExtensionSuppositionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.b_extension_supposition_decision_c.v1"
    frozen_request: GuardedTransportSuppositionInputC | QueuedCascadeSuppositionInputC
    frozen_measurement: GoalSuppositionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    source_reason_ref: Ref
    source_registration_admissible: bool
    confirmed_physical_law_terminal_or_action: None = None
