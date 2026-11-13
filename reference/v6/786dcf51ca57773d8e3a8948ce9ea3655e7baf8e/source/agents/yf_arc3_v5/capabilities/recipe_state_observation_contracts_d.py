"""Source-declared exact display signals, not request-supplied world states."""
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedInputReadRequest
from .contracts import FrameGrid


class RecipeDisplayAlternativeD(FrozenModel):
    alternative_ref: Ref
    expected_display: FrameGrid
    decoded_value: Ref | int | bool | None


class RecipeDisplaySignalD(FrozenModel):
    signal_ref: Ref
    field_ref: Ref
    bounds: tuple[int, int, int, int]
    alternatives: tuple[RecipeDisplayAlternativeD, ...] = Field(min_length=1, max_length=128)
    evidence_ref: Ref
    support_claim_ref: Ref

    @model_validator(mode='after')
    def nonempty_bounds(self):
        if self.bounds[2] < self.bounds[0] or self.bounds[3] < self.bounds[1]:
            raise ValueError('display query bounds are nonempty and ordered')
        return self


class RecipeSignalAcquisitionD(FrozenModel):
    observation: ObservedInputReadRequest
    schema_term_ref: Ref
    schema_claim_ref: Ref
    schema_predicate_ref: Ref
    projection_contract_ref: Ref
    maximum_signals: int = Field(ge=1, le=128)
    node_bound: int = Field(ge=1, le=100000)
    domain_bound: int = Field(ge=1, le=4096)
    time_bound_ms: int = Field(ge=1, le=300000)


class RecipeObservedSignalD(FrozenModel):
    request: RecipeSignalAcquisitionD
    signal_ref: Ref
    field_ref: Ref
    raster: tuple[tuple[int | None, ...], ...]
    matching_alternatives: tuple[RecipeDisplayAlternativeD, ...]
    unknown_positions: tuple[tuple[int, int], ...]
    evidence_refs: tuple[Ref, ...]
    descriptive_facts: FrozenMap


class RecipeSignalAcquisitionFactsD(FrozenModel):
    request: RecipeSignalAcquisitionD
    signals: tuple[RecipeObservedSignalD, ...]
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    published_field_refs: tuple[Ref, ...] = ()
    consumption_receipt_ref: Ref | None = None
