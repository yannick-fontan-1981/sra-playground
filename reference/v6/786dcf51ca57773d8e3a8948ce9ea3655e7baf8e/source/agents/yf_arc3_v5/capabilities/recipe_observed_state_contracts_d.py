"""Observed Recipe state binds every field; omission is never known absence."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedInputReadRequest
from agents.yf_arc3_v5.state.observed_canonical_field_reader_b import (
    ObservedCanonicalFieldBindingB, ObservedCanonicalFieldScopeB,
)
from .recipe_composition_a import RecipeJointState
from .observed_field_owner_contracts_d import ObservedFieldOwnerScopeProofD


class RecipeObservedFieldD(FrozenModel):
    binding: ObservedCanonicalFieldBindingB
    scope: ObservedCanonicalFieldScopeB
    owner_scope_proof: ObservedFieldOwnerScopeProofD | None = None


class RecipeObservedSlotD(FrozenModel):
    slot_ref: Ref
    field: RecipeObservedFieldD


class RecipeObservedVariableD(FrozenModel):
    variable_ref: Ref
    field: RecipeObservedFieldD


class RecipeObservedStateRequestD(FrozenModel):
    observation: ObservedInputReadRequest
    state_term_ref: Ref
    state_support_claim_ref: Ref
    projection_contract_ref: Ref
    input_lattice_ref: Ref
    world_lattice_ref: Ref
    input_population_claim_ref: Ref
    world_population_claim_ref: Ref
    input_population_predicate_ref: Ref
    world_population_predicate_ref: Ref
    active_slots: tuple[RecipeObservedSlotD, ...] = Field(max_length=64)
    world_variables: tuple[RecipeObservedVariableD, ...] = Field(max_length=64)
    body: RecipeObservedFieldD
    resource_quantity: RecipeObservedFieldD
    projectile_anchor: RecipeObservedFieldD
    projectile_tick: RecipeObservedFieldD
    expected_claim_scope: FrozenMap


class RecipeObservedStateFactsD(FrozenModel):
    request: RecipeObservedStateRequestD
    state: RecipeJointState | None
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    canonical_state_current: bool = False
