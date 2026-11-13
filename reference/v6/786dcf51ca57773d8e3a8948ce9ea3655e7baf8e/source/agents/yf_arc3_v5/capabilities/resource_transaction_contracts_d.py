"""Source-declared typed quantities and partial depletion/contact ordering."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref

QuantityKindD=Literal['STOCK','RESERVED_CAPACITY','ATTEMPTS','LIFE','PROGRESS','SATISFIED_DEMAND']
QuantityOperationD=Literal['CONSUME','PRODUCE','RESERVE','RELEASE','INCREMENT','MARK_SATISFIED']


class ResourceValueD(FrozenModel):
    quantity_ref: Ref
    kind_ref: QuantityKindD
    amount: int = Field(ge=0,le=65536)
    reserved: int = Field(default=0,ge=0,le=65536)
    maximum: int | None = Field(default=None,ge=0,le=65536)


class ResourceOperationLawD(FrozenModel):
    law_ref: Ref
    evidence_scope_ref: Ref
    evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    quantity_ref: Ref
    kind_ref: QuantityKindD
    operation_ref: QuantityOperationD
    insufficient_ref: Literal['REFUSE','CLAMP_ZERO']


class ResourceOperationD(FrozenModel):
    event_ref: Ref
    law_ref: Ref
    units: int = Field(ge=0,le=65536)
    demand_ref: Ref | None = None


class ResourceStateD(FrozenModel):
    quantities: tuple[ResourceValueD,...] = Field(min_length=1,max_length=128)
    pose: FrozenMap
    symbol: FrozenMap
    used_refill_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    acquired_target_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    satisfied_demand_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    failed: bool


class ResourcePartialLifeD(FrozenModel):
    evidence_scope_ref: Ref
    evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    depleted_quantity_ref: Ref
    life_quantity_ref: Ref
    life_debit: int = Field(ge=1,le=65536)
    replenished_amount: int = Field(ge=0,le=65536)
    restored_pose: FrozenMap
    restored_symbol: FrozenMap
    final_when_life_zero: bool


class ResourceContactD(FrozenModel):
    contact_ref: Ref
    evidence_scope_ref: Ref
    evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=64)
    expected_pose: FrozenMap
    expected_symbol: FrozenMap
    refill_ref: Ref | None = None
    refill_quantity_ref: Ref | None = None
    refill_amount: int | None = Field(default=None,ge=0,le=65536)
    refill_mode_ref: Literal['ADD','SET'] | None = None
    acquired_target_ref: Ref | None = None


class ResourcePrimitiveD(FrozenModel):
    primitive_ref: Ref
    pose_after_direct: FrozenMap
    symbol_after_direct: FrozenMap
    operations: tuple[ResourceOperationD,...] = Field(default=(),max_length=128)
    contacts_after_depletion: tuple[ResourceContactD,...] = Field(default=(),max_length=128)


class ResourceTransactionInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.resource_transaction_input_d.v1'
    evidence_scope_ref: Ref
    initial: ResourceStateD
    laws: tuple[ResourceOperationLawD,...] = Field(min_length=1,max_length=128)
    partial_life: ResourcePartialLifeD | None = None
    primitives: tuple[ResourcePrimitiveD,...] = Field(min_length=1,max_length=128)
    maximum_evaluations: int = Field(ge=1,le=65536)


class ResourceTransactionResultD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.resource_transaction_result_d.v1'
    request: ResourceTransactionInputD
    predicted_state: ResourceStateD
    rows: tuple[FrozenMap,...]
    missing_refs: tuple[Ref,...]
    accounted_evaluations: int
    action_authority: None = None
