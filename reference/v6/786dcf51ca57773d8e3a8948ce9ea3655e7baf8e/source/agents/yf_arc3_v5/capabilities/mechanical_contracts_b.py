"""Immutable bounded inputs for the two B-owned mechanical families."""
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref


class MechanicalRequestB(FrozenModel):
    request_ref: Ref
    caller_ref: Ref
    parent_contribution_ref: Ref
    epoch: int = Field(ge=0)
    input_revision_ref: Ref
    event_owner_ref: Ref
    operation_ref: Ref
    mode: Ref
    expected_return_type: Ref
    model_ref: Ref | None = None
    state: FrozenMap = Field(default_factory=FrozenMap)
    model: FrozenMap = Field(default_factory=FrozenMap)
    data: FrozenMap = Field(default_factory=FrozenMap)
    observations: tuple[FrozenMap, ...] = Field(default=(), max_length=256)
    evidence_refs: tuple[Ref, ...] = Field(default=(), max_length=256)
    model_alternatives: tuple[FrozenMap, ...] = Field(default=(), max_length=128)
    bounds: FrozenMap
    requested_domain_ref: Ref | None = None
    schema_version: Ref = "yf_arc3_v5.mechanical_request_b.v1"

    @model_validator(mode='after')
    def finite_bounds(self):
        if not self.bounds or len(self.bounds) > 16:
            raise ValueError('the caller must supply actual finite work bounds')
        if any(type(self.bounds[k]) is not int or not 0 <= self.bounds[k] <= 65536
               for k in sorted(self.bounds)):
            raise ValueError('actual work bounds must be nonnegative finite integers')
        return self


class MechanicalResultB(FrozenModel):
    request: MechanicalRequestB
    source_status: Literal['FOUND', 'NEEDS_EVIDENCE', 'MODEL_CONTRADICTION',
                           'BUDGET_REACHED', 'EMPTY_DECLARED_DOMAIN', 'NOT_APPLICABLE']
    cause: Ref | None = None
    values: FrozenMap = Field(default_factory=FrozenMap)
    examined_count: int = Field(default=0, ge=0)
    domain_size: int | None = Field(default=None, ge=0)
    domain_exhausted: bool = False
    frontier: tuple[FrozenMap, ...] = ()
    missing_refs: tuple[Ref, ...] = ()
    schema_version: Ref = "yf_arc3_v5.mechanical_result_b.v1"

    @model_validator(mode='after')
    def exact_exhaustion(self):
        if self.domain_exhausted and (self.domain_size is None or self.examined_count != self.domain_size or self.frontier):
            raise ValueError('exhaustion needs a complete exact-domain receipt')
        if self.source_status == 'EMPTY_DECLARED_DOMAIN' and not self.domain_exhausted:
            raise ValueError('a computation bound is not an empty domain')
        return self


def found(request, **values):
    return MechanicalResultB(request=request, source_status='FOUND', values=FrozenMap(values))


def missing(request, *refs):
    return MechanicalResultB(request=request, source_status='NEEDS_EVIDENCE',
                             cause='MISSING_OBSERVATION', missing_refs=tuple(refs))
