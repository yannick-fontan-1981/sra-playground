"""K33 bounded graph ports; models and reaction order are supplied by Source."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult
from .patrol_body import PatrolState, PatrolClockModel


class ReactiveGraphNodeC(FrozenModel):
    node_ref: Ref
    x: int
    y: int
    resting_mask: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=128)
    geometry_evidence_refs: tuple[Ref, ...]


class ReactiveGraphLinkC(FrozenModel):
    link_ref: Ref
    from_node_ref: Ref
    to_node_ref: Ref
    action_ref: Ref
    internal_masks: tuple[tuple[tuple[int, int], ...], ...] = Field(min_length=1, max_length=256)
    support: Literal["SUPPORTED", "BLOCKED", "UNKNOWN"]
    cost: int = Field(ge=0)
    evidence_refs: tuple[Ref, ...]


class ReactiveGraphGuardC(FrozenModel):
    guard_ref: Ref
    node_ref: Ref | None
    dx: int
    dy: int
    body_offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=128)
    frontal_offsets: tuple[tuple[int, int], ...] = Field(max_length=4096)
    side_offsets: tuple[tuple[int, int], ...] = Field(max_length=4096)
    rear_offsets: tuple[tuple[int, int], ...] = Field(max_length=4096)
    patrol_ref: Ref | None = None
    patrol_direction_controls_orientation: bool | None = None
    evidence_refs: tuple[Ref, ...]
    x: int
    y: int


class ReactiveFollowerStateC(FrozenModel):
    follower_ref: Ref
    node_ref: Ref
    awake: bool
    history_queue: tuple[Ref, ...] = Field(max_length=4096)
    history_cursor: int = Field(ge=0)
    clock_phase: int = Field(ge=0)


class ReactiveFollowerLawC(FrozenModel):
    follower_ref: Ref
    delay: int = Field(ge=0, le=4096)
    cadence: int = Field(ge=1, le=65536)
    phase_modulus: int = Field(ge=1, le=65536)
    wake_node_refs: tuple[Ref, ...] = Field(max_length=4096)
    wake_domain_complete: bool
    follows_blocked_inputs: bool | None
    evidence_refs: tuple[Ref, ...]
    body_offsets: tuple[tuple[int, int], ...] | None = Field(default=None, max_length=128)
    pre_motion_contact_effect: Literal["DEATH", "NO_EFFECT", "UNKNOWN"] | None = None
    post_motion_contact_effect: Literal["DEATH", "NO_EFFECT", "UNKNOWN"] | None = None


class ReactiveGraphStateC(FrozenModel):
    player_node_ref: Ref | None
    player_transit_mask: tuple[tuple[int, int], ...] | None = Field(default=None, max_length=128)
    guards: tuple[ReactiveGraphGuardC, ...] = Field(max_length=128)
    live_guard_refs: tuple[Ref, ...] = Field(max_length=128)
    followers: tuple[ReactiveFollowerStateC, ...] = Field(max_length=128)
    patrol_state: PatrolState | None
    phase_tick: int = Field(ge=0)
    dead: bool
    completed: bool
    successor_context: FrozenMap = Field(default_factory=FrozenMap)


class ReactiveGraphReactionC(FrozenModel):
    guard_ref: Ref
    contact: Literal["FRONT", "SIDE", "REAR", "BODY"]
    effect: Literal["DEATH", "REMOVE_GUARD", "NO_EFFECT", "UNKNOWN"]
    evidence_refs: tuple[Ref, ...]


class ReactiveGraphModelC(FrozenModel):
    model_ref: Ref
    nodes: tuple[ReactiveGraphNodeC, ...] = Field(min_length=1, max_length=4096)
    links: tuple[ReactiveGraphLinkC, ...] = Field(max_length=65536)
    action_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    follower_laws: tuple[ReactiveFollowerLawC, ...] = Field(max_length=128)
    reactions: tuple[ReactiveGraphReactionC, ...] = Field(max_length=512)
    patrol_model: PatrolClockModel | None
    player_patrol_target_ref: Ref | None
    patrol_phase_enabled: bool
    follower_phase_enabled: bool
    blocked_command_supported: bool | None
    blocked_command_cost: int | None = Field(default=None, ge=0)
    blocked_command_advances_clock: bool | None
    nominal_input_advances_phase: bool | None
    phase_clock_evidence_refs: tuple[Ref, ...]
    joint_phase_order: tuple[Literal["PLAYER_MOVE", "INPUT_CLOCK", "CONTACT", "FOLLOWER", "PATROL", "BOUNDARY"], ...]
    simultaneous_priority_evidence_refs: tuple[Ref, ...]
    contact_guard_order_refs: tuple[Ref, ...] = Field(max_length=128)
    contact_kind_order: tuple[Literal["FRONT", "SIDE", "REAR", "BODY"], ...] = Field(max_length=4)
    completion_node_refs: tuple[Ref, ...] = Field(max_length=4096)
    completion_requires_guard_refs_absent: tuple[Ref, ...] = Field(max_length=128)
    completion_evidence_refs: tuple[Ref, ...]
    supported_period: int | None = Field(default=None, ge=1, le=65536)
    period_evidence_refs: tuple[Ref, ...] = ()
    applicability_evidence_refs: tuple[Ref, ...]
    domain_complete: bool


class ReactiveGraphControlC(FrozenModel):
    action_ref: Ref
    link_ref: Ref | None
    event_ref: Ref
    clock_ref: Ref
    temporal_scope_ref: Ref
    patrol_input_ref: Ref | None
    patrol_event_clock_tick: int | None = Field(default=None, ge=0)
    evidence_refs: tuple[Ref, ...]
    blocked_input_outcome: bool | None = None


class ReactiveGraphCheckpointC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_graph_checkpoint_c.v1"
    context_digest: str
    operation_ref: Ref
    outer_index: int = Field(ge=0)
    phase_index: int = Field(ge=0)
    item_index: int = Field(ge=0)
    current_state: ReactiveGraphStateC
    retained_rows: tuple[FrozenMap, ...] = Field(max_length=65536)
    current_events: tuple[FrozenMap, ...] = Field(max_length=65536)
    examined_count: int = Field(ge=0)
    pending_refs: tuple[Ref, ...] = Field(max_length=128)
    request_consumed: bool
    secondary_state: ReactiveGraphStateC | None = None
    cursor_data: FrozenMap = Field(default_factory=FrozenMap)


class ReactiveGraphResultC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_graph_result_c.v1"
    native: MechanicalFamilyResult
    checkpoint: ReactiveGraphCheckpointC | None
    state: ReactiveGraphStateC | None
    rows: tuple[FrozenMap, ...]


class ReactiveGraphObservationC(FrozenModel):
    before_state: ReactiveGraphStateC
    control: ReactiveGraphControlC
    after_state: ReactiveGraphStateC
    evidence_revision_ref: Ref
    current_revalidation_ref: Ref | None


class ReactiveGraphRequestC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_graph_request_c.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref
    state: ReactiveGraphStateC | None
    model: ReactiveGraphModelC | None
    control: ReactiveGraphControlC | None
    controls: tuple[ReactiveGraphControlC, ...] = Field(default=(), max_length=4096)
    other_state: ReactiveGraphStateC | None = None
    alternative_state: ReactiveGraphStateC | None = None
    model_candidates: tuple[ReactiveGraphModelC, ...] = Field(default=(), max_length=128)
    observations: tuple[ReactiveGraphObservationC, ...] = Field(default=(), max_length=4096)
    inverse_candidates: tuple[ReactiveGraphStateC, ...] = Field(default=(), max_length=65536)
    target_state: ReactiveGraphStateC | None = None
    candidate_domain_complete: bool = False
    calendar_policy_revision_ref: Ref | None = None
    calendar_removal_revision_ref: Ref | None = None
    horizon: int = Field(ge=0, le=4096)
    maximum_evaluations: int = Field(ge=1, le=65536)
    maximum_states: int = Field(ge=1, le=65536)
    resume: ReactiveGraphCheckpointC | None = None

class ReactiveGraphSourceReturnInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_graph_source_return_input_c.v1"
    request: ReactiveGraphRequestC
    calculation: ReactiveGraphResultC
    source_policy_ref: Ref
    source_disposition_ref: Ref
    source_reason_ref: Ref


class ReactiveGraphSourceReturnC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.reactive_graph_source_return_c.v1"
    frozen_request: ReactiveGraphRequestC
    calculation: ReactiveGraphResultC
    source_policy_ref: Ref
    source_disposition_ref: Ref
    source_reason_ref: Ref
    proposed_action: None = None
