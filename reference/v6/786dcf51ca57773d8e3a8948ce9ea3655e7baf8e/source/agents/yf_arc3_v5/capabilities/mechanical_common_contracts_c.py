"""Immutable K03/K09 data; meanings and operation selection remain in SRC/DRM."""
from __future__ import annotations

from typing import Literal
from pydantic import Field, model_validator, field_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, require_unique, freeze_json
from .mechanical_request_contracts import MechanicalRequestIdentity
from .search_objective_contracts_d import SearchObjectiveSpecD
from .counterfactual_scope_contracts_d import CounterfactualEditScopeD


class MechanicalEventC(FrozenModel):
    occurrence_ref: Ref
    producer_ref: Ref
    kind_ref: Ref
    clock_ref: Ref
    tick: int = Field(ge=0)
    temporal_scope_ref: Ref
    snapshot_ref: Ref
    snapshot_kind: Literal["PRE_COMMAND", "SIMULTANEOUS", "ACTOR_TURN", "PRE_DOSE"]
    reads: FrozenMap
    writes: FrozenMap
    deleted_state_refs: tuple[Ref, ...] = ()
    costs: FrozenMap = Field(default_factory=FrozenMap)
    predecessor_refs: tuple[Ref, ...] = ()
    predicate_values: FrozenMap = Field(default_factory=FrozenMap)
    interruption_ref: Ref | None = None


class MechanicalRelationDomainD(FrozenModel):
    domain_ref: Ref
    graph_kind_ref: Ref
    predicate_kind_ref: Ref
    evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    triggering_rule_ref: Ref
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref


class MechanicalRelationBindingD(FrozenModel):
    field_ref: Ref
    field_path: tuple[str|int,...] = Field(default=(),max_length=16)
    domain: MechanicalRelationDomainD
    expected_value_digest: Ref


class MechanicalConstraintScopeD(FrozenModel):
    subject_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    event_domain: Literal['ALL_INTERMEDIATE','TRIGGER_EVENTS']
    event_kind_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    event_occurrence_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    temporal_scope_ref: Ref
    clock_ref: Ref
    valid_from_tick: int = Field(ge=0)
    valid_through_tick: int = Field(ge=0)
    triggering_law_ref: Ref
    evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref

    @model_validator(mode='after')
    def exact_domain(self):
        if self.valid_through_tick<self.valid_from_tick:raise ValueError('constraint validity interval is ordered')
        for values in (self.subject_refs,self.event_kind_refs,self.event_occurrence_refs,self.evidence_refs):
            if len(set(values))!=len(values):raise ValueError('constraint scope members are exact distinct references')
        if self.event_domain=='ALL_INTERMEDIATE' and (self.event_kind_refs or self.event_occurrence_refs):
            raise ValueError('all-intermediate safety cannot carry a hidden event filter')
        if self.event_domain=='TRIGGER_EVENTS' and not (self.event_kind_refs or self.event_occurrence_refs):
            raise ValueError('trigger-only constraints name their exact event domain')
        return self


class MechanicalPredicateC(FrozenModel):
    predicate_ref: Ref
    field_ref: Ref
    field_path: tuple[str | int, ...] = ()
    comparison: Literal["EQ", "NE", "LE", "GE", "IN", "SET_EQ"]
    expected: object
    event_kind_refs: tuple[Ref, ...] = ()
    include_initial: bool = True
    constraint_scope: MechanicalConstraintScopeD | None = None
    relation_domain: MechanicalRelationDomainD | None = None

    @model_validator(mode='after')
    def scoped_event_filter(self):
        scope=self.constraint_scope
        if scope is not None:
            if scope.event_domain=='ALL_INTERMEDIATE' and (not self.include_initial or self.event_kind_refs):
                raise ValueError('all-intermediate safety preserves initial and every intermediate evaluation')
            if scope.event_domain=='TRIGGER_EVENTS' and (self.include_initial or self.event_kind_refs!=scope.event_kind_refs):
                raise ValueError('trigger-only predicates use the exact independently bound event filter')
        return self

    @field_validator("expected")
    @classmethod
    def immutable_expected(cls, value):
        return freeze_json(value)


class ExternalPrimitivePacketC(FrozenModel):
    request: MechanicalRequestIdentity
    parent_request: MechanicalRequestIdentity
    model_ref: Ref
    action_ref: Ref
    primitive_ref: Ref | None = None
    before: FrozenMap
    after: FrozenMap
    events: tuple[MechanicalEventC, ...] = Field(default=(), max_length=4096)
    snapshots: FrozenMap
    closure_domain_ref: Ref
    closure_stop_ref: Ref
    complete: bool
    missing_refs: tuple[Ref, ...] = ()
    cost: int = Field(ge=0)
    terminal: bool = False
    acceptance: bool = False
    source_goal_acceptance_contract_ref: Ref | None = None
    response_ref: Ref
    observation_ref: Ref | None = None

    @model_validator(mode="after")
    def validate_step(self) -> "ExternalPrimitivePacketC":
        if self.request.mode != "STEP":
            raise ValueError("an external packet must be one exact STEP")
        require_unique(self.missing_refs, "missing primitive measurements")
        return self


class MechanicalAcceptanceBoundaryC(FrozenModel):
    """Source supplies the exact event scope and candidate predicate conjunction."""
    boundary_ref: Ref
    completion_contract_ref: Ref
    request_ref: Ref
    event_occurrence_ref: Ref
    producer_ref: Ref
    event_kind_ref: Ref
    temporal_scope_ref: Ref
    snapshot_ref: Ref
    snapshot_kind: Literal["PRE_COMMAND", "SIMULTANEOUS", "ACTOR_TURN", "PRE_DOSE"]
    clock_ref: Ref
    tick: int = Field(ge=0)
    predicates: tuple[MechanicalPredicateC, ...] = Field(min_length=1, max_length=128)


class MechanicalAcceptanceObservationC(FrozenModel):
    boundary: MechanicalAcceptanceBoundaryC
    occurred: bool
    event_index: int | None = None
    state_index: int | None = None
    predicate_results: FrozenMap = Field(default_factory=FrozenMap)
    conjunction: bool | None = None
    interruption_ref: Ref | None = None


class EventCompositionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.event_composition_input_c.v1"
    request: MechanicalRequestIdentity
    initial: FrozenMap
    packets: tuple[ExternalPrimitivePacketC, ...] = Field(default=(), max_length=1024)
    predicates: tuple[MechanicalPredicateC, ...] = Field(default=(), max_length=128)
    consumed_request_refs: tuple[Ref, ...] = ()
    acceptance_boundaries: tuple[MechanicalAcceptanceBoundaryC, ...] = Field(default=(), max_length=128)
    declared_event_order: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=4096)
    relation_bindings: tuple[MechanicalRelationBindingD,...] = Field(default=(),max_length=128)


class EventCompositionResultC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.event_composition_result_c.v1"
    request: MechanicalRequestIdentity
    state: FrozenMap
    events: tuple[MechanicalEventC, ...]
    states: tuple[FrozenMap, ...]
    primitive_count: int
    cost: int
    complete: bool
    bounded: bool
    contradictory: bool
    missing_refs: tuple[Ref, ...]
    failed_predicate_refs: tuple[Ref, ...]
    consumed_request_delta: tuple[Ref, ...]
    interruption_ref: Ref | None
    packet_cursor: int
    facts: FrozenMap
    acceptance_observations: tuple[MechanicalAcceptanceObservationC, ...] = ()


class SimulationPathInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.simulation_path_input_c.v1"
    request: MechanicalRequestIdentity
    initial: FrozenMap
    word: tuple[Ref, ...] = Field(default=(), max_length=1024)
    packets: tuple[ExternalPrimitivePacketC, ...] = Field(default=(), max_length=1024)
    predicates: tuple[MechanicalPredicateC, ...] = ()
    relation_bindings: tuple[MechanicalRelationBindingD,...] = Field(default=(),max_length=128)
    consumed_request_refs: tuple[Ref, ...] = ()
    acceptance_boundaries: tuple[MechanicalAcceptanceBoundaryC, ...] = Field(default=(), max_length=128)
    declared_event_order: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=4096)


class CounterfactualPathInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.counterfactual_path_input_c.v2"
    original: SimulationPathInputC
    edited: SimulationPathInputC
    # Only this explicitly bound immutable field may carry the edited word.
    word_input_ref: Ref | None = None
    edit_scope: CounterfactualEditScopeD | None = None


class CounterfactualPathResultC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.counterfactual_path_result_c.v2"
    frozen_request: CounterfactualPathInputC
    original: EventCompositionResultC
    edited: EventCompositionResultC
    re_evaluated_predicate_refs: tuple[Ref, ...]
    first_changed_event_index: int | None
    endpoint_equal: bool
    cost_delta: int
    initial_and_model_equal: bool
    comparison_scope_equal: bool
    first_changed_effect_index: int | None
    edit_scope_measurement: FrozenMap = Field(default_factory=FrozenMap)


class SearchStateC(FrozenModel):
    state: FrozenMap
    model_ref: Ref


class SearchWitnessC(FrozenModel):
    root_action_ref: Ref | None
    word: tuple[Ref, ...]
    cost: int
    policy: FrozenMap = Field(default_factory=FrozenMap)
    covered_response_refs: tuple[Ref, ...] = ()


class RouteFrontierNodeC(FrozenModel):
    cost: int = Field(ge=0)
    depth: int = Field(ge=0)
    serial: int = Field(ge=0)
    state_key: Ref
    word: tuple[Ref, ...]
    root_action_ref: Ref | None
    priority: int | None = Field(default=None, ge=0)


class RouteCheckpointC(FrozenModel):
    context_digest: Ref
    packet_digests: FrozenMap
    frontier: tuple[RouteFrontierNodeC, ...]
    best_cost_records: tuple[tuple[Ref, Ref | None, int], ...]
    completed_action_records: tuple[tuple[Ref, Ref | None, int, Ref], ...]
    expanded_state_records: tuple[tuple[Ref, Ref | None], ...]
    root_witnesses: tuple[SearchWitnessC, ...] = Field(default=(), max_length=3)
    next_serial: int = Field(ge=0)
    expansion_count: int = Field(ge=0)


class SearchDomainInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_domain_input_c.v1"
    request: MechanicalRequestIdentity
    initial_states: tuple[SearchStateC, ...] = Field(default=(), max_length=128)
    retained_model_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    # Required, including an explicit empty restricted action domain. Missing
    # actions and an unknown/unclosed response domain are separate conditions.
    action_refs: tuple[Ref, ...] = Field(max_length=256)
    packets: tuple[ExternalPrimitivePacketC, ...] = Field(default=(), max_length=65536)
    terminal_states: tuple[SearchStateC, ...] = Field(default=(), max_length=65536)
    accepting_states: tuple[SearchStateC, ...] = Field(default=(), max_length=65536)
    state_observations: FrozenMap = Field(default_factory=FrozenMap)
    response_domains: FrozenMap = Field(default_factory=FrozenMap)
    # Optional complete admissibility domain for each full state/model key.
    # Empty legal actions is a dead end, never a fictitious terminal response.
    state_action_domains: FrozenMap = Field(default_factory=FrozenMap)
    # An explicit list of response ids for each (state, action) proves coverage.
    closed_domain: bool
    declared_domain_size: int | None = Field(default=None, ge=0, le=65536)
    controllable_quantifier: Literal["EXISTS"] | None = None
    response_quantifier: Literal["FORALL"] | None = None
    predicates: tuple[MechanicalPredicateC, ...] = ()
    relation_bindings: tuple[MechanicalRelationBindingD,...] = Field(default=(),max_length=128)
    acceptance_predicates: tuple[MechanicalPredicateC, ...] = ()
    terminal_predicates: tuple[MechanicalPredicateC, ...] = ()
    deterministic_response_ref: Ref | None = None
    packet_acceptance_contract_ref: Ref | None = None
    packet_acceptance_model_refs: tuple[Ref, ...] = ()
    continuation: FrozenMap = Field(default_factory=FrozenMap)
    route_checkpoint: RouteCheckpointC | None = None
    route_algorithm_ref: Literal["UNIFORM_COST", "ASTAR"] = "UNIFORM_COST"
    admissible_lower_bounds: FrozenMap = Field(default_factory=FrozenMap)
    lower_bound_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    route_witness_policy_ref: Literal['PER_ROOT_BOUNDED', 'FIRST_SHORTEST'] = 'PER_ROOT_BOUNDED'
    route_witness_evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    objective: SearchObjectiveSpecD | None = None


class CommonSignatureFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.common_signature_facts_c.v1"
    facts: FrozenMap


class SearchResultC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.search_result_c.v1"
    request: MechanicalRequestIdentity
    witnesses: tuple[SearchWitnessC, ...] = Field(default=(), max_length=3)
    current_prefix: tuple[Ref, ...]
    complete: bool
    bounded: bool
    contradictory: bool
    examined_count: int
    declared_domain_size: int | None
    missing_refs: tuple[Ref, ...]
    requested_steps: tuple[FrozenMap, ...]
    continuation: FrozenMap
    facts: FrozenMap
    route_checkpoint: RouteCheckpointC | None = None


class CommonNativeResponseInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.common_native_response_input_c.v1"
    result: EventCompositionResultC | SearchResultC
    source_status: Ref
    returned_type: Ref
    missing_cause: Literal["MISSING_OBSERVATION", "UNSUPPORTED_MODEL", "SIGNATURE_MISMATCH",
        "MISSING_IMPLEMENTATION", "DOMAIN_EXHAUSTED", "COMPUTATION_BOUND"] | None = None
