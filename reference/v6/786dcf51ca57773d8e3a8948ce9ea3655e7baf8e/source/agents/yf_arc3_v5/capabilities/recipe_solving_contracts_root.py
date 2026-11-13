"""Typed data for Source-owned recipe questions; no semantic selection or ACT."""
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .family_agenda_projection import FamilyAgendaSnapshot
from .recipe_operator_service_a import RecipeOperatorRequest
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .recipe_composition_a import RecipeJointState
from .family_result_join import FamilyJoinGroup, FamilyJoinRequest, FamilyJoinResult
from agents.yf_arc3_v5.state.sealed_interval_production import SealedIntervalProductionRequest
from .recipe_state_observation_contracts_d import RecipeSignalAcquisitionD
from .recipe_body_observation_contracts_d import RecipeBodyObservationRequestD
from .recipe_observed_state_contracts_d import RecipeObservedStateRequestD
from .recipe_pose_correspondence_contracts_d import RecipePoseCorrespondenceRequestD
from agents.yf_arc3_v5.state.cargo_scalar_acquisition_b import CargoScalarAcquisitionInputB
from .recipe_input_catalogue_contracts_d import RecipeInputCatalogueRequestD
from .recipe_population_contracts_d import RecipePopulationRequestD
from .observed_field_owner_contracts_d import ObservedFieldOwnerRequestD
from .recipe_input_edit_contracts_d import RecipeInputEditRequestD
from .recipe_world_domain_contracts_d import RecipeWorldDomainRequestD


class RecipeParentWhyRoot(FrozenModel):
    parent_goal_ref: Ref
    consumer_ref: Ref
    next_item_ref: Ref
    question_ref: Ref
    desired_world_future: FrozenMap
    utility_reason_ref: Ref
    needed_world_condition_ref: Ref
    supported_operator_ref: Ref | None = None
    usefulness_premise_refs: tuple[Ref, ...]
    morphology_premise_refs: tuple[Ref, ...]
    and_dependency_refs: tuple[Ref, ...]
    or_dependency_refs: tuple[Ref, ...]
    preservation_refs: tuple[Ref, ...]
    falsifier_ref: Ref
    episode_ref: Ref
    level_scope_ref: Ref
    temporal_scope_ref: Ref


class RecipeInputLifecycleRoot(FrozenModel):
    example_lattice_ref: Ref
    input_lattice_ref: Ref
    world_lattice_ref: Ref
    entered_pattern_refs: tuple[Ref, ...] = Field(max_length=64)
    completing_edit_ref: Ref | None = None
    completion_trigger_ref: Ref | None = None
    automatic_trigger_supported: bool | None = None
    clear_after_trigger_supported: bool | None = None
    control_binding_refs: tuple[Ref, ...] = Field(max_length=128)
    lifecycle_evidence_refs: tuple[Ref, ...] = Field(max_length=128)
    bootstrap_obligation_ref: Ref | None = None
    bootstrap_input_ref: Ref | None = None
    bootstrap_effect_evidence_refs: tuple[Ref, ...] = ()

    @model_validator(mode="after")
    def separate_scales(self):
        if len({self.example_lattice_ref, self.input_lattice_ref, self.world_lattice_ref}) != 3:
            raise ValueError("example, input widget and world lattice must retain distinct identities")
        if len(set(self.entered_pattern_refs)) != len(self.entered_pattern_refs):
            raise ValueError("actual entered pattern positions must be unique")
        return self


class RecipeWorldEffectLinkRoot(FrozenModel):
    effect_ref: Ref
    subject_ref: Ref
    kind: Literal["RESIZE", "PROJECTILE_IMPACT", "DESTRUCTION", "REMOTE_GATE", "RESOURCE", "TRANSPORT"]
    parent_condition_ref: Ref
    before_binding: FrozenMap
    after_binding: FrozenMap | None = None
    effect_evidence_refs: tuple[Ref, ...] = ()
    model_status: Literal["HYPOTHESIS", "SUPPORTED", "CONTRADICTED"]
    falsifier_ref: Ref
    state_subject_path: tuple[str | int, ...] = Field(default=(), max_length=16,
        description="Empty path addresses the complete acquired joint state; binding keys still name the required fields.")


class RecipeDemonstrationRoot(FrozenModel):
    demonstration_ref: Ref
    demonstrated_actor_ref: Ref
    real_actor_ref: Ref
    input_grammar_evidence_refs: tuple[Ref, ...]
    suggested_effect_refs: tuple[Ref, ...]
    applicable_world_transition_refs: tuple[Ref, ...] = ()
    validated_transfer_rule_refs: tuple[Ref, ...] = ()

    @model_validator(mode="after")
    def tutorial_is_not_real_actor(self):
        if self.demonstrated_actor_ref == self.real_actor_ref:
            raise ValueError("a tutorial actor and real world actor need distinct identities")
        return self


class RecipeAcquisitionPlanRoot(FrozenModel):
    catalogue_requests: tuple[RecipeInputCatalogueRequestD, ...] = Field(default=(), max_length=16)
    population_requests: tuple[RecipePopulationRequestD, ...] = Field(default=(), max_length=2)
    owner_requests: tuple[ObservedFieldOwnerRequestD, ...] = Field(default=(), max_length=64)
    input_role_requests: tuple[RecipeInputEditRequestD, ...] = Field(default=(), max_length=2)
    world_domain_requests: tuple[RecipeWorldDomainRequestD, ...] = Field(default=(), max_length=2)
    scalar_requests: tuple[CargoScalarAcquisitionInputB, ...] = Field(default=(), max_length=32)
    pose_requests: tuple[RecipePoseCorrespondenceRequestD, ...] = Field(default=(), max_length=16)
    signal_requests: tuple[RecipeSignalAcquisitionD, ...] = Field(default=(), max_length=16)
    body_requests: tuple[RecipeBodyObservationRequestD, ...] = Field(default=(), max_length=16)
    state_requests: tuple[RecipeObservedStateRequestD, ...] = Field(min_length=1, max_length=2)


class RecipeSolvingInputRoot(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recipe_solving_input_root.v1"
    why: RecipeParentWhyRoot
    agenda: FamilyAgendaSnapshot
    native_template: RecipeOperatorRequest
    lifecycle: RecipeInputLifecycleRoot
    requested_question: Literal["PATTERN", "EDIT", "RESIZE", "PROJECTILE", "TRANSPORT", "RESOURCE", "COMPOSE", "DEMONSTRATION", "WORLD_CONTINUATION"]
    effects: tuple[RecipeWorldEffectLinkRoot, ...] = Field(max_length=128)
    demonstrations: tuple[RecipeDemonstrationRoot, ...] = Field(default=(), max_length=32)
    mechanical_prerequisite_request_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    passage_clearance_evidence_refs: tuple[Ref, ...] = ()
    size_movement_model_evidence_refs: tuple[Ref, ...] = ()
    resize_reference_point_ref: Ref | None = None
    resize_reanchor_evidence_refs: tuple[Ref, ...] = ()
    firing_pose_evidence_refs: tuple[Ref, ...] = ()
    projectile_direction_evidence_refs: tuple[Ref, ...] = ()
    transport_model_refs: tuple[Ref, ...] = ()
    reconciled_world_effect_ref: Ref | None = None
    actual_world_state_ref: Ref | None = None
    source_mechanical_receipt: MechanicalNormalizedReturn | None = None
    current_world_evidence_refs: tuple[Ref, ...] = ()
    maximum_parent_claims: int = Field(default=32, ge=1, le=128)
    interval_request: SealedIntervalProductionRequest | None = None
    observed_before: RecipeJointState | None = None
    observed_after: RecipeJointState | None = None
    acquisition_plan: RecipeAcquisitionPlanRoot | None = None
    acquisition_missing_refs: tuple[Ref, ...] = Field(default=(), max_length=256)


class RecipeSolvingQuestionRoot(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recipe_solving_question_root.v1"
    request: RecipeSolvingInputRoot
    source_disposition_ref: Ref
    native_request: RecipeOperatorRequest | None = None
    canonical_parent_claim_refs: tuple[Ref, ...] = ()
    missing_evidence_refs: tuple[Ref, ...] = ()
    model_alternative_refs: tuple[Ref, ...] = ()
    input_goal_is_instrumental: bool = True
    action_release: None = None


class RecipeSolvingFactsRoot(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recipe_solving_facts_root.v1"
    request: RecipeSolvingInputRoot
    facts: FrozenMap
    canonical_parent_claim_refs: tuple[Ref, ...]
    current_evidence_refs: tuple[Ref, ...]
    missing_evidence_refs: tuple[Ref, ...]
    preparation_relations: tuple[FrozenMap, ...]
    actual_world_state: RecipeJointState | None = None
    sealed_interval_receipt: FrozenMap | None = None
    state_field_provenance: tuple[FrozenMap, ...] = Field(default=(), max_length=2)


class RecipeSolvingFinishRoot(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recipe_solving_finish_root.v1"
    measured: RecipeSolvingFactsRoot
    source_disposition_ref: Ref
    native_return: MechanicalNormalizedReturn | None = None
    demonstrated_effect_status_ref: Ref | None = None
    satisfied_condition_refs: tuple[Ref, ...] = Field(default=(), max_length=1)


class RecipeSolvingReturnRoot(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.recipe_solving_return_root.v1"
    frozen_measurement: RecipeSolvingFactsRoot
    source_disposition_ref: Ref
    native_return: MechanicalNormalizedReturn | None
    original_parent_why: RecipeParentWhyRoot
    next_item_ref: Ref
    model_alternative_refs: tuple[Ref, ...]
    missing_evidence_refs: tuple[Ref, ...]
    preparation_relations: tuple[FrozenMap, ...]
    action_release: None = None
    actual_world_state: RecipeJointState | None = None
    demonstrated_effect_status_ref: Ref | None = None
    satisfied_condition_refs: tuple[Ref, ...] = Field(default=(), max_length=1)
    state_field_provenance: tuple[FrozenMap, ...] = Field(default=(), max_length=2)


class RecipeJoinProjectionRoot(FrozenModel):
    candidate_ref: Ref
    assignment_paths: FrozenMap
    resource_paths: FrozenMap = Field(default_factory=FrozenMap)

    @model_validator(mode="after")
    def bounded_actual_paths(self):
        for mapping in (self.assignment_paths, self.resource_paths):
            if len(mapping) > 128:
                raise ValueError('recipe join projections must be explicitly bounded')
            for key in sorted(mapping):
                path = mapping[key]
                if not isinstance(path, tuple) or not 1 <= len(path) <= 16:
                    raise ValueError('recipe assignments require exact native result paths')
                if any(not isinstance(part, (str, int)) or isinstance(part, bool) for part in path):
                    raise ValueError('native result paths contain only field names or indices')
        return self


class RecipeJoinInputRoot(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.recipe_join_input_root.v1'
    answer: RecipeSolvingReturnRoot
    peer_groups: tuple[FamilyJoinGroup, ...] = Field(default=(), max_length=127)
    projections: tuple[RecipeJoinProjectionRoot, ...] = Field(min_length=1, max_length=3)
    group_ref: Ref
    request_ref: Ref
    max_pairs: int = Field(ge=0, le=65536)
    max_candidates: int = Field(ge=0, le=4096)


class RecipeJoinFactsRoot(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.recipe_join_facts_root.v1'
    original_input: RecipeJoinInputRoot
    request: FamilyJoinRequest | None
    missing_refs: tuple[Ref, ...]
    join_ready: bool


class RecipeJoinReturnRoot(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.recipe_join_return_root.v1'
    original_answer: RecipeSolvingReturnRoot
    joined: FamilyJoinResult | None
    missing_refs: tuple[Ref, ...]
    next_item_ref: Ref
    action_release: None = None


class RecipeSolveAndComposeRoot(FrozenModel):
    request: RecipeSolvingInputRoot
    peer_groups: tuple[FamilyJoinGroup, ...] = Field(default=(), max_length=127)
    projections: tuple[RecipeJoinProjectionRoot, ...] = Field(min_length=1, max_length=3)
    group_ref: Ref
    request_ref: Ref
    max_pairs: int = Field(ge=0, le=65536)
    max_candidates: int = Field(ge=0, le=4096)
