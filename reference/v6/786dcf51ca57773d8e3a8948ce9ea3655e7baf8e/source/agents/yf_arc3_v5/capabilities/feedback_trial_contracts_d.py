"""Declared trial costs and a Source/DRM-owned information-partition choice."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .feedback_code_identification import FeedbackCodeRequest
from .mechanical_request_contracts import MechanicalNormalizedReturn


class FeedbackTrialCostD(FrozenModel):
    trial_ref: Ref
    input_cost: int = Field(ge=0,le=65536)
    support_claim_ref: Ref


class FeedbackTrialChoiceInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.feedback_trial_choice_input_d.v1'
    calculation: FeedbackCodeRequest
    trial_costs: tuple[FeedbackTrialCostD,...] = Field(min_length=1,max_length=256)
    unresolved_ref: Ref
    maximum_projection_nodes: int = Field(ge=1,le=65536)


class FeedbackTrialBindInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.feedback_trial_bind_input_d.v1'
    choice: FeedbackTrialChoiceInputD
    reply: MechanicalNormalizedReturn


class FeedbackTrialFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.feedback_trial_facts_d.v1'
    request: FeedbackTrialBindInputD
    alternative_refs: tuple[Ref,...]
    alternative_facts: FrozenMap
    missing_refs: tuple[Ref,...]


class FeedbackTrialFinishInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.feedback_trial_finish_input_d.v1'
    measured: FeedbackTrialFactsD
    source_alternative_ref: Ref


class FeedbackTrialChoiceReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.feedback_trial_choice_return_d.v1'
    measured: FeedbackTrialFactsD
    source_alternative_ref: Ref
    trial_ref: Ref | None
    action_authority: None = None
