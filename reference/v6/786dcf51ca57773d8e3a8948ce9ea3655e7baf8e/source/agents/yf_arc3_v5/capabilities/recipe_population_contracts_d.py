"""Population publication requires actual fields and independent Source closure."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedInputReadRequest
from .recipe_input_catalogue_contracts_d import RecipeInputCatalogueRequestD
from .recipe_observed_state_contracts_d import RecipeObservedFieldD, RecipeObservedSlotD, RecipeObservedVariableD


class RecipePopulationRequestD(FrozenModel):
    observation: ObservedInputReadRequest
    catalogue_request: RecipeInputCatalogueRequestD
    catalogue_field: RecipeObservedFieldD
    input_lattice_ref: Ref
    world_lattice_ref: Ref
    parent_goal_ref: Ref
    input_role_claim_ref: Ref
    input_role_predicate_ref: Ref
    world_closure_claim_ref: Ref
    world_closure_predicate_ref: Ref
    active_slots: tuple[RecipeObservedSlotD, ...] = Field(min_length=1, max_length=64)
    world_variables: tuple[RecipeObservedVariableD, ...] = Field(max_length=64)
    input_population_claim_ref: Ref
    world_population_claim_ref: Ref
    expected_claim_scope: FrozenMap


class RecipePopulationFactsD(FrozenModel):
    request: RecipePopulationRequestD
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    canonical_populations_current: bool = False

