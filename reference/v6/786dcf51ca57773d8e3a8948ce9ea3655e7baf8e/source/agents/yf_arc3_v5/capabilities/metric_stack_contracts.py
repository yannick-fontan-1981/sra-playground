"""Immutable, bounded packets for metric-grid top-occurrence calculations.

No palette, game identity, playable pitch or action payload is inferred here.
The caller supplies the current evidence, scoped laws and exact licensed cases.
"""
from __future__ import annotations

from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, require_unique
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import MechanicalRequestIdentity


class MetricCell(FrozenModel):
    cell_ref: Ref
    left: int = Field(ge=-4096, le=4096)
    top: int = Field(ge=-4096, le=4096)
    right: int = Field(ge=-4096, le=4096)
    bottom: int = Field(ge=-4096, le=4096)

    @model_validator(mode="after")
    def positive_rectangle(self):
        if self.left >= self.right or self.top >= self.bottom:
            raise ValueError("a measured cell must have positive extent")
        return self


class BoundaryWitness(FrozenModel):
    model_ref: Ref
    cut_ref: Ref
    axis: Literal["X", "Y"]
    lower: int = Field(ge=-4096, le=4096)
    upper: int = Field(ge=-4096, le=4096)
    span_start: int = Field(ge=-4096, le=4096)
    span_end: int = Field(ge=-4096, le=4096)
    evidence_ref: Ref
    evidence_revision_ref: Ref
    occluded: bool

    @model_validator(mode="after")
    def valid_interval(self):
        if self.lower > self.upper or self.span_start >= self.span_end:
            raise ValueError("invalid cut interval or continuity span")
        if not self.occluded and self.lower != self.upper:
            raise ValueError("a directly measured cut must have an exact position")
        return self


class StackOccurrence(FrozenModel):
    occurrence_ref: Ref
    # None is genuinely unobserved, never an inferred background colour.
    color_ref: Ref | None = None


class MetricStackState(FrozenModel):
    state_revision_ref: Ref
    grid_revision_ref: Ref
    cells: tuple[MetricCell, ...] = Field(max_length=64)
    stacks: tuple[tuple[StackOccurrence, ...], ...] = Field(max_length=64)
    physical_selection_ref: Ref | None = None
    inventory_complete_evidence_ref: Ref | None = None

    @model_validator(mode="after")
    def validate_inventory(self):
        if len(self.cells) != len(self.stacks):
            raise ValueError("one bottom-to-top stack is required for every metric cell")
        require_unique(tuple(c.cell_ref for c in self.cells), "metric cell identities")
        objects = tuple(o.occurrence_ref for stack in self.stacks for o in stack)
        if len(objects) > 128:
            raise ValueError("at most 128 explicit occurrences")
        require_unique(objects, "physical occurrence identities")
        if self.physical_selection_ref is not None and self.physical_selection_ref not in objects:
            raise ValueError("selected occurrence is absent from the supplied inventory")
        for i, a in enumerate(self.cells):
            for b in self.cells[i + 1:]:
                if max(a.left, b.left) < min(a.right, b.right) and max(a.top, b.top) < min(a.bottom, b.bottom):
                    raise ValueError("measured metric cells overlap")
        return self


class StackLaw(FrozenModel):
    law_revision_ref: Ref
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    # These are declared hypotheses, not rules inferred from successful clicks.
    access: Literal["TOP_ONLY", "CYCLE_TOPS"]
    dimension_rule: Literal["CELL_SUPPORT", "RIGID"]
    transfer_edges: tuple[tuple[Ref, Ref], ...] = Field(max_length=256)
    cycle_order: tuple[Ref, ...] = Field(default=(), max_length=64)
    select_cost: int = Field(ge=0, le=4096)
    cycle_cost: int = Field(ge=0, le=4096)
    transfer_cost: int = Field(ge=0, le=4096)
    event_owner_ref: Ref
    # A None checkpoint is an unknown acceptance law, not automatic success.
    acceptance_checkpoint: Literal["AFTER_TRANSFER", "AFTER_EACH_INPUT"] | None = None
    # Empty damier is scored only through its independently supplied meaning.
    empty_color_ref: Ref | None = None

    @model_validator(mode="after")
    def unique_edges(self):
        require_unique(self.transfer_edges, "licensed directed transfer edges")
        require_unique(self.cycle_order, "selection cycle cell order")
        return self


class StackPrimitive(FrozenModel):
    primitive_ref: Ref
    kind: Literal["SELECT", "CYCLE", "TRANSFER", "RESET"]
    cell_ref: Ref | None = None
    occurrence_ref: Ref | None = None
    destination_ref: Ref | None = None


class MetricTarget(FrozenModel):
    target_revision_ref: Ref
    rows: tuple[tuple[Ref, ...], ...] = Field(min_length=1, max_length=32)
    licensed_scales: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=16)
    licensed_anchors: tuple[tuple[int, int], ...] = Field(max_length=128)
    outside_color_ref: Ref

    @model_validator(mode="after")
    def bounded_raster(self):
        width = len(self.rows[0])
        if not 1 <= width <= 32 or any(len(row) != width for row in self.rows):
            raise ValueError("target must be a bounded rectangular raster")
        if any(not 1 <= n <= 4096 or not 1 <= d <= 4096 for n, d in self.licensed_scales):
            raise ValueError("uniform scales must be positive explicit rational numbers")
        require_unique(self.licensed_scales, "licensed scales")
        require_unique(self.licensed_anchors, "licensed anchors")
        return self


class StackDemand(FrozenModel):
    cell_ref: Ref
    color_ref: Ref


class OccurrencePlacement(FrozenModel):
    occurrence_ref: Ref
    target_cell_ref: Ref


class ControlSample(FrozenModel):
    evidence_ref: Ref
    evidence_revision_ref: Ref
    occurrence_ref: Ref
    input_kind: Literal["SELECT", "CYCLE", "TRANSFER"]
    physical_selection_before_ref: Ref | None = None
    physical_selection_after_ref: Ref | None = None
    position_before: tuple[int, int]
    position_after: tuple[int, int]
    was_accessible_top: bool
    selection_accepted: bool
    dimensions_before: tuple[int, int]
    dimensions_after: tuple[int, int]
    support_before: tuple[int, int]
    support_after: tuple[int, int]


class StackComparisonSample(FrozenModel):
    sample_ref: Ref
    primitive_index: int = Field(ge=0, le=4096)
    expected: MetricStackState
    observed: MetricStackState
    authoritative_terminal_receipt_ref: Ref | None = None


class MetricExternalOwnership(FrozenModel):
    """Current supplied phase law, never inferred from a successful endpoint."""
    contract_ref: Ref
    event_owner_ref: Ref
    primitive_ref: Ref
    automatic_identity_evidence_ref: Ref
    charged_cost: int = Field(ge=0, le=65536)
    budget_remaining: int = Field(ge=0, le=65536)
    budget_zero_terminates: bool
    cost_acceptance_order: Literal["COST_THEN_ACCEPTANCE", "ACCEPTANCE_THEN_COST"]
    acceptance_precedes_budget_terminal: bool
    pre_terminal: bool


class MetricSchedulePhase(FrozenModel):
    phase: Literal["DIRECT", "AUTOMATIC", "COST", "ACCEPTANCE"]
    kind_ref: Ref
    clock_ref: Ref
    tick: int = Field(ge=0)
    temporal_scope_ref: Ref
    snapshot_ref: Ref
    snapshot_kind: Literal["PRE_COMMAND", "SIMULTANEOUS", "ACTOR_TURN", "PRE_DOSE"]
    occurrence_ref: Ref


class MetricScheduleScope(FrozenModel):
    search_identity: MechanicalRequestIdentity
    child_identity: MechanicalRequestIdentity
    parent_goal_ref: Ref
    goal_contract_ref: Ref
    identity_contract_ref: Ref
    phase_clock_contract_ref: Ref
    model_ref: Ref
    response_ref: Ref
    closure_domain_ref: Ref
    closure_stop_ref: Ref
    model_interruption_ref: Ref
    phases: tuple[MetricSchedulePhase, ...] = Field(min_length=4, max_length=4)


class MetricStackRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_stack_request.v1"
    identity: MechanicalRequestIdentity
    evidence_revision_ref: Ref
    evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    state: MetricStackState | None = None
    law: StackLaw | None = None
    boundaries: tuple[BoundaryWitness, ...] = Field(default=(), max_length=256)
    query_points: tuple[tuple[int, int], ...] = Field(default=(), max_length=128)
    control_samples: tuple[ControlSample, ...] = Field(default=(), max_length=128)
    target: MetricTarget | None = None
    demands: tuple[StackDemand, ...] = Field(default=(), max_length=64)
    placements: tuple[OccurrencePlacement, ...] = Field(default=(), max_length=64)
    buffer_cell_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    needed_occurrence_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    primitive: StackPrimitive | None = None
    sealed_samples: tuple[StackComparisonSample, ...] = Field(default=(), max_length=128)
    sealed_packet_ref: Ref | None = None
    declared_restoration: MetricStackState | None = None
    restoration_contract_ref: Ref | None = None
    external_ownership: MetricExternalOwnership | None = None
    witness_cost: int | None = Field(default=None, ge=0, le=65536)
    witness_primitives: tuple[StackPrimitive, ...] = Field(default=(), max_length=256)
    execution_scope_ref: Ref | None = None
    execution_primitive_kinds: tuple[Literal["SELECT", "CYCLE", "TRANSFER", "RESET"], ...] = Field(default=(), max_length=4)
    target_domain_complete_evidence_ref: Ref | None = None
    resume_frontier: FrozenMap = Field(default_factory=FrozenMap)
    schedule_scope: MetricScheduleScope | None = None
    # None means the full licensed destination domain; () is explicitly empty.
    schedule_allowed_destination_refs: tuple[Ref, ...] | None = Field(default=None, max_length=64)
    schedule_restriction_evidence_ref: Ref | None = None

    @model_validator(mode="after")
    def validate_work_bound(self):
        bounds = self.identity.actual_bounds
        if any(name not in bounds for name in ("nodes", "outputs", "time_ms")):
            raise ValueError("metric work requires actual node, output and time bounds")
        if bounds["nodes"] > 4096 or bounds["outputs"] > 128 or bounds["time_ms"] > 60000:
            raise ValueError("metric work exceeds the declared library ceiling")
        require_unique(self.evidence_refs, "current metric evidence")
        require_unique(tuple(x.cell_ref for x in self.demands), "target cell requirements")
        require_unique(tuple(x.occurrence_ref for x in self.placements), "assigned occurrences")
        require_unique(tuple(x.target_cell_ref for x in self.placements), "assigned target cells")
        require_unique(self.needed_occurrence_refs, "future required occurrences")
        require_unique(self.buffer_cell_refs, "reserved buffers")
        require_unique(self.execution_primitive_kinds, "declared execution primitive kinds")
        if len(self.resume_frontier) > 16:
            raise ValueError("resume envelope has too many components")
        return self


class MetricStackFacts(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_stack_facts.v1"
    facts: FrozenMap


class MetricStackCalculation(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_stack_calculation.v1"
    request_identity: MechanicalRequestIdentity
    values: FrozenMap
    facts: FrozenMap
    examined_count: int = Field(ge=0, le=65536)
    declared_domain_size: int | None = Field(default=None, ge=0, le=65536)
    pending_count: int = Field(ge=0, le=65536)
    retained_frontier: FrozenMap = Field(default_factory=FrozenMap)
    retained_alternative_refs: tuple[Ref, ...] = Field(default=(), max_length=128)


class MetricStackAssemblyInput(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.metric_stack_assembly_input.v1"
    request: MetricStackRequest
    calculation: MetricStackCalculation | None = None
    source_status: str
    cause: str
