"""Exact finite relations and additive costs; Source owns algorithm selection."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_request_contracts import MechanicalRequestIdentity


class FiniteVariableC(FrozenModel):
    variable_ref: Ref
    values: tuple[Ref, ...] = Field(max_length=128)
    costs: FrozenMap


class FiniteRelationC(FrozenModel):
    relation_ref: Ref
    variable_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    allowed_rows: tuple[tuple[Ref, ...], ...] = Field(max_length=65536)
    domain_complete: bool


class FiniteSearchCheckpointC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.finite_search_checkpoint_c.v1"
    context_digest: str
    stage: str
    variable_index: int = Field(ge=0)
    frontier_index: int = Field(ge=0)
    value_index: int = Field(ge=0)
    relation_index: int = Field(ge=0)
    relation_row_index: int = Field(ge=0)
    frontier: tuple[FrozenMap, ...]
    following: tuple[FrozenMap, ...]
    candidate: FrozenMap | None
    candidate_cost: int | None = Field(default=None, ge=0)
    examined_count: int = Field(ge=0)


class FiniteSearchInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.finite_search_input_c.v1"
    request: MechanicalRequestIdentity
    variables: tuple[FiniteVariableC, ...] = Field(max_length=128)
    relations: tuple[FiniteRelationC, ...] = Field(max_length=128)
    variable_order: tuple[Ref, ...] = Field(max_length=128)
    cost_metric_ref: Ref
    domain_complete: bool
    evidence_refs: tuple[Ref, ...]
    resume: FiniteSearchCheckpointC | None = None


class FiniteSearchFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.finite_search_facts_c.v1"
    request: FiniteSearchInputC
    assignments: tuple[FrozenMap, ...]
    minimum_cost: int | None
    complete: bool
    bounded: bool
    missing_refs: tuple[Ref, ...]
    examined_count: int
    retained_frontier: tuple[FrozenMap, ...]
    unfinished_layer: tuple[FrozenMap, ...] = ()
    variable_index: int
    frontier_index: int
    value_index: int
    facts: FrozenMap
    checkpoint: FiniteSearchCheckpointC | None = None
