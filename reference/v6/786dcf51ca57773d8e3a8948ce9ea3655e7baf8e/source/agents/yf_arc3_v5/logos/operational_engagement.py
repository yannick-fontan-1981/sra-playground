"""A canonical lease-consumption review, never a goal-completion certificate."""
from typing import Literal
from pydantic import Field, model_serializer, model_validator
from .types import FrozenMap, FrozenModel, Ref
from .operational_reasoning import OperationalConsciousnessDependencySnapshot


class OperationalConsciousnessEngagementDependencies(FrozenModel):
    goal_ref: Ref
    declared_premise_refs: tuple[Ref, ...]
    preservation_refs: tuple[Ref, ...]
    snapshot: OperationalConsciousnessDependencySnapshot
    missing_premise_refs: tuple[Ref, ...]
    expired_premise_refs: tuple[Ref, ...]
    inactive_premise_refs: tuple[Ref, ...]
    contested_premise_refs: tuple[Ref, ...]
    contest_evidence_versions: FrozenMap
    reference_domain_complete: bool
    establishes_continuation_validity: Literal[False] = False
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def retain_named_dependency_domain(self):
        premises = set(self.declared_premise_refs)
        domain = {self.goal_ref, *premises, *self.preservation_refs}
        if (self.snapshot.problem_ref != self.goal_ref
                or not set(self.snapshot.bindings).issubset(domain)
                or (self.reference_domain_complete and set(self.snapshot.bindings) != domain)
                or any(not set(refs).issubset(premises) for refs in (
                    self.missing_premise_refs, self.expired_premise_refs,
                    self.inactive_premise_refs, self.contested_premise_refs))
                or not set(self.contest_evidence_versions).issubset(premises)):
            raise ValueError('engagement dependency review changed its named goal or premise domain')
        return self


class OperationalConsciousnessEngagementReview(FrozenModel):
    incoming_intent_ref: Ref | None
    terminal_locator_refs: tuple[Ref, ...]
    maximum_members: int = Field(ge=1)
    identity_digest: Ref
    incoming_intent_digest: Ref | None
    engagement_refs: FrozenMap
    incoming_scope_current: bool
    candidate_proofs: FrozenMap
    missing_evidence_refs: tuple[Ref, ...]
    lease_consumption_complete: bool
    dependency_review: OperationalConsciousnessEngagementDependencies | None = None
    goal_achieved: Literal[False] = False
    remaining_route_invalidated: Literal[False] = False
    grants_action: Literal[False] = False

    @model_serializer(mode='wrap')
    def preserve_prior_dependency_shape(self, handler):
        value = handler(self)
        if self.dependency_review is None:
            value.pop('dependency_review', None)
        return value

    def canonical_field_names(self):
        return tuple(name for name in type(self).model_fields
            if name != 'dependency_review' or self.dependency_review is not None)
