"""One Source-qualified cumulative wait ledger for the same reception consumer."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref


class ReceptionWaitBudgetD(FrozenModel):
    parent_goal_ref: Ref
    parent_contribution_ref: Ref
    consumer_request_ref: Ref
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    observed_clock: int = Field(ge=0)
    maximum_total_wait_primitives: int = Field(ge=0,le=128)
    spent_wait_primitives: int = Field(ge=0,le=128)
    ledger_claim_ref: Ref
