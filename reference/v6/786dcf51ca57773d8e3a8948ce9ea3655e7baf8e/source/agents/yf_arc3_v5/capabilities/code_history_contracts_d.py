"""Source-qualified retained feedback and exact-rank preservation premises."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref


class CodeHistorySupportD(FrozenModel):
    evidence_ref: Ref
    support_claim_ref: Ref


class CodeExactConstraintD(FrozenModel):
    rank: int = Field(ge=0,le=11)
    value_ref: Ref
    model_epoch: int = Field(ge=0)
    support_claim_ref: Ref
