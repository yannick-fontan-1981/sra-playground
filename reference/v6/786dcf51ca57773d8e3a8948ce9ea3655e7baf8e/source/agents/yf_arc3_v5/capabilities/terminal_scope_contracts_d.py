"""Source-declared finite terminal quantifiers and independent grounding."""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref
from .effect_frontier_contracts_c import EffectFrontierInputC,EffectFrontierFactsC
from .mechanical_common_contracts_c import MechanicalPredicateC
from .coverage_clause_contracts_d import CoverageClauseD


class TerminalClauseD(FrozenModel):
    clause_ref: Ref
    operation: Literal['ATOM','VALUE','COVERAGE','ALL','ANY','COUNT_GE','COUNT_EQ','DISTINCT','EVER','ALL_STAGES','AT_END','BEFORE']
    child_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    predicate: MechanicalPredicateC | None = None
    value_path: tuple[str|int,...] = Field(default=(),max_length=16)
    threshold: int | None = Field(default=None,ge=0,le=4096)
    subject_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    coverage: CoverageClauseD | None = None


class TerminalContractD(FrozenModel):
    contract_ref: Ref
    root_clause_ref: Ref
    clauses: tuple[TerminalClauseD,...] = Field(min_length=1,max_length=4096)
    required_subject_refs: tuple[Ref,...] = Field(max_length=4096)
    temporal_scope_ref: Ref
    event_scope_ref: Ref
    persistence_ref: Ref
    preservation_refs: tuple[Ref,...] = Field(max_length=128)


class TerminalScopeInputD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.terminal_scope_input_d.v1'
    frontier: EffectFrontierInputC
    contract: TerminalContractD
    goal_support_claim_ref: Ref
    goal_support_predicate_ref: Ref
    goal_contract_attribute_path: tuple[str|int,...] = Field(min_length=1,max_length=16)
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)


class TerminalScopeFactsD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.terminal_scope_facts_d.v1'
    request: TerminalScopeInputD
    acquired: EffectFrontierFactsC
    facts: FrozenMap
    rows: tuple[FrozenMap,...] = Field(max_length=4096)
    missing_refs: tuple[Ref,...]


class TerminalScopeReturnD(FrozenModel):
    schema_version: Ref='yf_arc3_v5.terminal_scope_return_d.v1'
    measured: TerminalScopeFactsD
    source_disposition_ref: Ref
    official_completion: None = None
    action_authority: None = None
