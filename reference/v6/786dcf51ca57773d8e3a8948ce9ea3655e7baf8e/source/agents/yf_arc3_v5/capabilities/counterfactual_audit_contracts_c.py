"""Source owns the interpretation of two supplied bounded PATH ledgers."""
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_common_contracts_c import CounterfactualPathResultC


class CounterfactualAuditFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.counterfactual_audit_facts_c.v1"
    facts: FrozenMap


class CounterfactualAuditDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.counterfactual_audit_decision_input_c.v1"
    measured: CounterfactualPathResultC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class CounterfactualAuditDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.counterfactual_audit_decision_c.v1"
    frozen_measurement: CounterfactualPathResultC
    source_disposition_ref: Ref
    source_policy_ref: Ref
    deletion_or_replacement_universally_safe: None = None
    proposed_action: None = None

