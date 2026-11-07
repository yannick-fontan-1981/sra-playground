"""Body queries contain acquisition/role references, never supplied body masks."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedSceneReadRequest
from .recipe_observed_state_contracts_d import RecipeObservedFieldD
from .contracts import RecipeBodyState


class RecipeBodyObservationRequestD(FrozenModel):
    scene: ObservedSceneReadRequest
    layer_ref: Ref
    calibration_ref: Ref
    seed_point: tuple[int, int]
    body_term_ref: Ref
    body_support_claim_ref: Ref
    role_binding: RecipeObservedFieldD
    occupancy_rule: RecipeObservedFieldD
    anchor_rule: RecipeObservedFieldD
    size: RecipeObservedFieldD
    heading: RecipeObservedFieldD
    expected_claim_scope: FrozenMap
    node_bound: int = Field(ge=1, le=100000)
    domain_bound: int = Field(ge=1, le=4096)
    time_bound_ms: int = Field(ge=1, le=300000)


class RecipeBodyObservationFactsD(FrozenModel):
    request: RecipeBodyObservationRequestD
    body: RecipeBodyState | None
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    canonical_body_current: bool = False
