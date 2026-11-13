"""An observed route from an open question to an available exploration choice."""
from typing import Literal
from pydantic import model_validator
from .types import FrozenMap, FrozenModel, Ref, stable_digest


class OperationalConsciousnessDeclaredQuestionBinding(FrozenModel):
    """A question already declared by the selected contribution or its motives."""
    question_ref: Ref
    owner_goal_ref: Ref
    origin_kind: Literal['action_contribution', 'information_opportunity']
    origin_ref: Ref
    grants_action: Literal[False] = False


def declared_action_question_bindings(intent):
    """Transport all declared owners; never select a winning question."""
    responsibility = intent.operational_consciousness.responsibility
    rows = []
    if (responsibility.contribution.experiment_ref is not None
            and responsibility.problem.local_goal_ref is not None):
        rows.append(OperationalConsciousnessDeclaredQuestionBinding(
            question_ref=responsibility.contribution.experiment_ref,
            owner_goal_ref=responsibility.problem.local_goal_ref,
            origin_kind='action_contribution', origin_ref=responsibility.responsibility_ref))
    rows.extend(OperationalConsciousnessDeclaredQuestionBinding(
        question_ref=item.question_ref, owner_goal_ref=item.goal_ref,
        origin_kind='information_opportunity', origin_ref=item.opportunity_ref)
        for item in intent.operational_information_opportunities)
    return tuple(sorted(rows, key=lambda row: (row.origin_kind, row.origin_ref, row.question_ref, row.owner_goal_ref)))


class OperationalConsciousnessInformationOpportunity(FrozenModel):
    opportunity_ref: Ref
    frame_ref: Ref
    timeline_ref: Ref
    candidate_ref: Ref
    action_ref: Ref
    action_data: FrozenMap
    goal_ref: Ref
    question_ref: Ref
    native_review_ref: Ref
    nomination_ref: Ref
    domain_ref: Ref
    control_claim_ref: Ref
    control_claim_digest: Ref
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def exact_origin_identity(self):
        expected = 'conscious-information-opportunity:' + stable_digest((
            self.timeline_ref, self.frame_ref, self.candidate_ref, self.native_review_ref,
            self.nomination_ref, self.control_claim_ref))
        if self.opportunity_ref != expected:
            raise ValueError('information opportunity identity differs from its question/control origin')
        return self
