"""Observed single-cell boolean edits, not recipe completion or operator law."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.actual_observation_dispatch_reader_b import ObservedDispatchPairInputB
from .recipe_input_catalogue_contracts_d import RecipeInputCatalogueRequestD
from .recipe_observed_state_contracts_d import RecipeObservedSlotD, RecipeObservedFieldD


class RecipeInputEditSampleD(FrozenModel):
    pair: ObservedDispatchPairInputB
    target_slot_ref: Ref
    before_slots: tuple[RecipeObservedSlotD, ...] = Field(min_length=1, max_length=64)
    after_slots: tuple[RecipeObservedSlotD, ...] = Field(min_length=1, max_length=64)
    row_payload_key: Ref
    column_payload_key: Ref


class RecipeInputEditRequestD(FrozenModel):
    catalogue_request: RecipeInputCatalogueRequestD
    catalogue_field: RecipeObservedFieldD
    samples: tuple[RecipeInputEditSampleD, ...] = Field(min_length=1, max_length=64)
    input_role_claim_ref: Ref
    expected_claim_scope: FrozenMap


class RecipeInputEditFactsD(FrozenModel):
    request: RecipeInputEditRequestD
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    canonical_input_role_current: bool = False
