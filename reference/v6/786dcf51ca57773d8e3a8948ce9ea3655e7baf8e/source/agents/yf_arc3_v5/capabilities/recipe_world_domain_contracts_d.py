"""Requested native world-variable domain; never a whole-world inventory."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.observed_scene_reader import ObservedInputReadRequest
from .recipe_operator_service_a import RecipeOperatorRequest


class RecipeWorldDomainLinkD(FrozenModel):
    condition_ref: Ref
    support_claim_ref: Ref
    support_predicate_ref: Ref
    variable_refs: tuple[Ref, ...] = Field(max_length=64)


class RecipeWorldDomainRequestD(FrozenModel):
    observation: ObservedInputReadRequest
    native_request: RecipeOperatorRequest
    agenda_ref: Ref
    agenda_claim_ref: Ref
    world_lattice_ref: Ref
    domain_term_ref: Ref
    world_closure_claim_ref: Ref
    links: tuple[RecipeWorldDomainLinkD, ...] = Field(max_length=64)
    expected_claim_scope: FrozenMap
    node_bound: int = Field(ge=1, le=1000000)
    time_bound_ms: int = Field(ge=1, le=300000)


class RecipeWorldDomainFactsD(FrozenModel):
    request: RecipeWorldDomainRequestD
    descriptive_facts: FrozenMap
    missing_refs: tuple[Ref, ...]
    canonical_world_domain_current: bool = False
