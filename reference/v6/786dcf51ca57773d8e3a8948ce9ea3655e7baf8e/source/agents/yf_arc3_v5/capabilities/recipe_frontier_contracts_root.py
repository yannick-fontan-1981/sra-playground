"""Source-owned Recipe facet questions over actual sealed intervals."""
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from agents.yf_arc3_v5.state.sealed_interval_production import SealedIntervalProductionRequest
from agents.yf_arc3_v5.state.observed_canonical_field_reader_b import (
    ObservedCanonicalFieldBindingB, ObservedCanonicalFieldScopeB,
)
from .recipe_solving_contracts_root import RecipeParentWhyRoot, RecipeSolvingInputRoot
from .recipe_operator_service_a import RecipeOperatorRequest
from .recipe_composition_a import RecipeJointState
from .recipe_body_observation_contracts_d import RecipeBodyObservationRequestD
from .mechanical_request_contracts import MechanicalNormalizedReturn


class RecipeFacetFieldRoot(FrozenModel):
    binding: ObservedCanonicalFieldBindingB
    scope: ObservedCanonicalFieldScopeB


class RecipePreservationFieldRoot(FrozenModel):
    condition_ref: Ref
    before: RecipeFacetFieldRoot
    after: RecipeFacetFieldRoot


class RecipeProjectileEffectRoot(FrozenModel):
    effect_ref: Ref
    world_variable_ref: Ref
    support_claim_ref: Ref
    support_predicate_ref: Ref
    publish_observed_link: bool = False


class RecipeStepQuantumObservationRoot(FrozenModel):
    interval: SealedIntervalProductionRequest
    movement_claim_ref: Ref
    movement_predicate_ref: Ref
    expected_body: RecipeJointState


class RecipeObservedImpactRoot(FrozenModel):
    impact_anchor: tuple[int, int]
    impact_tick: int = Field(ge=0)
    impact_region_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    remote_effect_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    projectile_disappeared: bool
    termination_observed: bool
    retained_direction_alternative_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    retained_collision_alternative_refs: tuple[Ref, ...] = Field(default=(), max_length=128)


class RecipeProjectileRegionObservationRoot(FrozenModel):
    region_ref: Ref
    body_field: RecipeFacetFieldRoot
    body_acquisition: RecipeBodyObservationRequestD | None = None


class RecipeProjectileContactObservationRoot(FrozenModel):
    coordinate_axis_order: Literal['ROW_COLUMN', 'COLUMN_ROW']
    projectile_body_field: RecipeFacetFieldRoot
    projectile_body_acquisition: RecipeBodyObservationRequestD | None = None
    regions: tuple[RecipeProjectileRegionObservationRoot, ...] = Field(min_length=1, max_length=128)
    retained_direction_alternative_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    retained_collision_alternative_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    maximum_cell_visits: int = Field(default=4096, ge=1, le=65536)

    @model_validator(mode='after')
    def distinct_region_identities(self):
        if len({row.region_ref for row in self.regions}) != len(self.regions):
            raise ValueError('actual observed collision regions remain distinct')
        for field, request in ((self.projectile_body_field, self.projectile_body_acquisition),
                *((row.body_field, row.body_acquisition) for row in self.regions)):
            if request is not None and (
                    request.body_term_ref != field.binding.term_ref
                    or request.body_support_claim_ref != field.binding.support_claim_ref
                    or request.scene.observation_record_ref != field.scope.observation_record_ref
                    or request.scene.expected_frame_ref not in (None, field.scope.frame_ref)
                    or request.expected_claim_scope != field.scope.expected_claim_scope):
                raise ValueError('body acquisition must produce the exact observation/owner field consumed by contact')
        return self


class RecipeFrontierInputRoot(FrozenModel):
    why: RecipeParentWhyRoot
    facet_ref: Ref
    facet_support_claim_ref: Ref
    facet_predicate_ref: Ref
    facet_projection_contract_ref: Ref
    facet_kind: Literal['RECIPE_EDIT', 'DEMONSTRATION', 'RESIZE', 'PROJECTILE', 'TRANSPORT']
    interval: SealedIntervalProductionRequest
    native_request: RecipeOperatorRequest
    interpretation_ref: Ref
    interpretation_claim_ref: Ref
    sibling_facet_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    premise_claim_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    demonstration_claim_refs: tuple[Ref, ...] = Field(default=(), max_length=32)
    demonstration_predicate_ref: Ref | None = None
    trigger_claim_refs: tuple[Ref, ...] = Field(default=(), max_length=32)
    trigger_predicate_ref: Ref | None = None
    before_step_quantum: RecipeFacetFieldRoot | None = None
    after_step_quantum: RecipeFacetFieldRoot | None = None
    before_step_observation: RecipeStepQuantumObservationRoot | None = None
    after_step_observation: RecipeStepQuantumObservationRoot | None = None
    impact_field: RecipeFacetFieldRoot | None = None
    projectile_contact_observation: RecipeProjectileContactObservationRoot | None = None
    destination_field: RecipeFacetFieldRoot | None = None
    target_before: RecipeFacetFieldRoot | None = None
    target_after: RecipeFacetFieldRoot | None = None
    preservation_fields: tuple[RecipePreservationFieldRoot, ...] = Field(default=(), max_length=64)
    projectile_effects: tuple[RecipeProjectileEffectRoot, ...] = Field(default=(), max_length=64)

    @model_validator(mode='after')
    def retain_distinct_facet_and_interpretation(self):
        terms = (self.facet_ref, self.interval.packet_term_ref,
            self.why.parent_goal_ref, self.interpretation_ref)
        if len(set(terms)) != len(terms):
            raise ValueError('the interpretation must not overwrite its facet, packet or parent')
        if self.interpretation_claim_ref == self.facet_support_claim_ref:
            raise ValueError('interpretation and facet qualification claims remain distinct')
        if len(set(self.sibling_facet_refs)) != len(self.sibling_facet_refs) or self.facet_ref in self.sibling_facet_refs:
            raise ValueError('retain distinct unconsumed sibling facets')
        if len({row.condition_ref for row in self.preservation_fields}) != len(self.preservation_fields):
            raise ValueError('preservation fields must have distinct declared conditions')
        if len({(row.effect_ref, row.world_variable_ref) for row in self.projectile_effects}) != len(self.projectile_effects):
            raise ValueError('projectile effect links must remain distinct')
        return self


class RecipeFrontierFactsRoot(FrozenModel):
    request: RecipeFrontierInputRoot
    sealed_receipt: FrozenMap
    descriptive_facts: FrozenMap
    transitions: tuple[FrozenMap, ...]
    before: RecipeJointState | None
    after: RecipeJointState | None
    missing_refs: tuple[Ref, ...]


class RecipeFrontierReturnRoot(FrozenModel):
    request: RecipeFrontierInputRoot
    frozen_measurement: RecipeFrontierFactsRoot
    source_disposition_ref: Ref
    native_return: MechanicalNormalizedReturn | None
    interpretation: FrozenMap
    descriptive_outcome: FrozenMap
    missing_refs: tuple[Ref, ...]
    next_item_ref: Ref
    sibling_facet_refs: tuple[Ref, ...]
    action_release: None = None


class RecipeFrontierParentInputRoot(FrozenModel):
    parent: RecipeSolvingInputRoot
    facet: RecipeFrontierInputRoot
    agenda_receipt_ref: Ref | None = None
    agenda_receipt_claim_ref: Ref | None = None
    agenda_source_return_claim_ref: Ref | None = None

    @model_validator(mode="after")
    def complete_agenda_return_identifiers(self):
        refs = (self.agenda_receipt_ref, self.agenda_receipt_claim_ref,
                self.agenda_source_return_claim_ref)
        if any(ref is not None for ref in refs) and (any(ref is None for ref in refs)
                or len(set(refs)) != 3):
            raise ValueError("recipe agenda return requires three distinct publication identifiers")
        return self
