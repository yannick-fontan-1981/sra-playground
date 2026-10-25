"""Immutable references to open goals; never an alternative action authority."""
from typing import Literal

from pydantic import Field, model_validator, model_serializer

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from agents.yf_arc3_v5.logos.operational_reasoning import OperationalConsciousnessDependencySnapshot
from .operational_goal_intent import OperationalConsciousnessGoalIntent
from .operational_observation import OperationalConsciousnessApplicationAssociation


class AcquisitionGoalBranch(FrozenModel):
    goal_ref: Ref
    operational_consciousness_dependencies: OperationalConsciousnessDependencySnapshot
    # These are canonical graph assertions, not edges inferred from similarity.
    parent_goal_refs: tuple[Ref, ...] = ()
    prerequisite_goal_refs: tuple[Ref, ...] = ()
    alternative_goal_refs: tuple[Ref, ...] = ()
    conflicting_goal_refs: tuple[Ref, ...] = ()
    support_claim_refs: tuple[Ref, ...] = ()
    # Scoped comparisons are questions, not new prerequisites or proved utility.
    native_means_review_refs: tuple[Ref, ...] = ()
    native_participant_observation_refs: tuple[Ref, ...] = ()
    operational_goal_intent: OperationalConsciousnessGoalIntent | None = None
    lifecycle_status: Ref
    blockage_ref: Ref
    priority_position: int
    benefit_status: Literal["possible_not_established"] = "possible_not_established"
    # No relation means unknown, not independent, exclusive, or jointly required.
    undeclared_relationship: Literal["unknown"] = "unknown"

    @model_validator(mode='after')
    def preserve_intent_owner(self):
        if self.operational_goal_intent is not None and self.operational_goal_intent.goal_ref != self.goal_ref:
            raise ValueError('operational goal intent belongs to another acquisition branch')
        return self

    @model_serializer(mode='wrap')
    def preserve_pre_native_branch_shape(self, handler):
        data = handler(self)
        for field in ('native_means_review_refs', 'operational_goal_intent', 'native_participant_observation_refs'):
            if field not in self.model_fields_set:
                data.pop(field, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('native_means_review_refs', 'operational_goal_intent', 'native_participant_observation_refs') or name in self.model_fields_set)


class GoalAcquisitionFrontier(FrozenModel):
    timeline_ref: Ref
    frame_ref: Ref
    execution_scope: FrozenMap
    state_revision: int = Field(ge=0)
    branches: tuple[AcquisitionGoalBranch, ...] = Field(min_length=1)
    projection_refs: tuple[Ref, ...]
    schema_version: Literal["goal_acquisition_frontier.v2"] = "goal_acquisition_frontier.v2"

    @model_validator(mode="after")
    def unique_branches(self):
        refs = tuple(row.goal_ref for row in self.branches)
        if len(set(refs)) != len(refs):
            raise ValueError("acquisition frontier repeats a canonical goal")
        if any(row.operational_consciousness_dependencies.problem_ref != row.goal_ref for row in self.branches):
            raise ValueError('operational consciousness: dependency snapshot belongs to another problem')
        return self


class GoalFrontierBranchReview(FrozenModel):
    goal_ref: Ref
    application_associations: tuple[OperationalConsciousnessApplicationAssociation, ...] = ()
    application_association_disposition_ref: Ref | None = None
    physical_return_disposition_ref: Ref | None = None
    native_means_review_refs: tuple[Ref, ...] = ()
    native_participant_observation_refs: tuple[Ref, ...] = ()
    operational_goal_intent: OperationalConsciousnessGoalIntent | None = None
    disposition_ref: Ref
    current_goal_present: bool
    changed_field_refs: tuple[Ref, ...] = ()
    current_facts: FrozenMap = Field(default_factory=FrozenMap)
    direct_continuation_requires_revalidation: bool = False
    current_dependency_snapshot: OperationalConsciousnessDependencySnapshot
    changed_dependency_refs: tuple[Ref, ...] = ()
    newly_bound_dependency_refs: tuple[Ref, ...] = ()
    lost_dependency_refs: tuple[Ref, ...] = ()
    missing_field_refs: tuple[Ref, ...] = ()
    dependency_reassessment_required: bool = False

    @model_validator(mode='after')
    def preserve_intent_owner(self):
        if self.operational_goal_intent is not None and self.operational_goal_intent.goal_ref != self.goal_ref:
            raise ValueError('operational goal intent belongs to another reviewed branch')
        if any(row.goal_ref != self.goal_ref or row.review_ref not in self.native_means_review_refs
                for row in self.application_associations):
            raise ValueError('application association changed its frozen goal or review owner')
        if 'application_associations' in self.model_fields_set and self.application_association_disposition_ref is None:
            raise ValueError('application associations require their Source-consumed DRM disposition')
        return self

    @model_serializer(mode='wrap')
    def preserve_pre_native_review_shape(self, handler):
        data = handler(self)
        for field in ('native_means_review_refs', 'operational_goal_intent',
                      'application_associations', 'application_association_disposition_ref',
                      'physical_return_disposition_ref', 'native_participant_observation_refs'):
            if field not in self.model_fields_set:
                data.pop(field, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('native_means_review_refs', 'operational_goal_intent',
                'application_associations', 'application_association_disposition_ref',
                'physical_return_disposition_ref', 'native_participant_observation_refs') or name in self.model_fields_set)
