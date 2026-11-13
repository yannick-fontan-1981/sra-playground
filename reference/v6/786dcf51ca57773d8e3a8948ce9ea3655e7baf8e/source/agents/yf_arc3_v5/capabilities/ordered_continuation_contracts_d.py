"""Source-bound consumed budget and a supported remaining transfer witness."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref


class OrderedBudgetContinuationD(FrozenModel):
    parent_goal_ref: Ref
    parent_contribution_ref: Ref
    model_ref: Ref
    allowance_claim_ref: Ref
    remaining_bound_claim_ref: Ref
    consumed_budget_charge: int = Field(ge=0,le=65536)
    declared_allowance: int = Field(ge=0,le=65536)
    supported_remaining_upper_bound: int = Field(ge=0,le=65536)
