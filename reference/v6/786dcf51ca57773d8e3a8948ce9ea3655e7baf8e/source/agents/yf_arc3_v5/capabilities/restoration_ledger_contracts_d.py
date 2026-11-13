"""Goal-bound restoration ledgers; material and knowledge remain distinct."""
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .effect_frontier_contracts_c import EffectFrontierInputC,EffectFrontierFactsC
from .mechanical_common_contracts_c import MechanicalPredicateC


class MaterialRestorationD(FrozenModel):
    obligation_ref: Ref
    consumer_ref: Ref
    restoration_request_ref: Ref
    predicate: MechanicalPredicateC
    provider_ref_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    admissible_provider_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    required_identity_ref: Ref | None = None


class RetainedKnowledgeD(FrozenModel):
    claim_ref: Ref
    retention_law_claim_ref: Ref
    retention_scope: FrozenMap


class RestorationLedgerSpecD(FrozenModel):
    contract_ref: Ref
    material: tuple[MaterialRestorationD,...] = Field(default=(),max_length=128)
    knowledge: tuple[RetainedKnowledgeD,...] = Field(default=(),max_length=128)
    persistent_receipts: tuple[MaterialRestorationD,...] = Field(default=(),max_length=128)


class RestorationLedgerInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.restoration_ledger_input_d.v1'
    frontier: EffectFrontierInputC
    contract: RestorationLedgerSpecD
    goal_contract_attribute_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    goal_support_claim_ref: Ref
    maximum_evaluations: int = Field(ge=1,le=65536)


class RestorationLedgerFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.restoration_ledger_facts_d.v1'
    request: RestorationLedgerInputD
    acquired: EffectFrontierFactsC
    material_rows: tuple[FrozenMap,...]
    knowledge_rows: tuple[FrozenMap,...]
    receipt_rows: tuple[FrozenMap,...]
    facts: FrozenMap
    missing_refs: tuple[Ref,...]


class RestorationLedgerReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.restoration_ledger_return_d.v1'
    measured: RestorationLedgerFactsD
    action_authority: None = None
