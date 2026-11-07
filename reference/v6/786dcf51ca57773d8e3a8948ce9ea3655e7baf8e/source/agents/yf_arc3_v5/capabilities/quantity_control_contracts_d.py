"""Source-declared physical control signatures, never selected in Python."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref


class QuantityControlBindingD(FrozenModel):
    operation_ref: Ref
    operation_kind: Literal['MATERIAL_TRANSFER','DOOR_PASSAGE']
    action_ref: Ref
    action_payload: FrozenMap
    control_ref: Ref
    support_claim_refs: tuple[Ref,...] = Field(min_length=1,max_length=16)
