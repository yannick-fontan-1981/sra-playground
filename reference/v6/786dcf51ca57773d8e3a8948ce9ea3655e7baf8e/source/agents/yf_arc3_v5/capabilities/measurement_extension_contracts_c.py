"""Exact epistemic measurement requests use the existing family dependency agenda."""
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .family_agenda_projection import FamilyAgendaDemand, FamilyAgendaSnapshot


class MeasurementExtensionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.measurement_extension_input_c.v1"
    agenda: FamilyAgendaSnapshot
    exact_demand: FamilyAgendaDemand
    current_consumer_ref: Ref
    current_consumer_evidence_refs: tuple[Ref, ...]
    current_input_revision_ref: Ref
    current_scope_ref: Ref
    question_ref: Ref
    necessary_for_consumer: bool
    premise_ref: Ref
    premise_status: Literal["PROVISIONAL", "SUPPORTED", "FALSIFIED", "UNKNOWN"]
    premise_evidence_refs: tuple[Ref, ...]
    premise_epoch: int
    premise_revision_ref: Ref
    premise_scope_ref: Ref
    generic_geometry_request_ref: Ref | None


class MeasurementExtensionFactsC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.measurement_extension_facts_c.v1"
    facts: FrozenMap
    exact_signature_ref: Ref
    equivalent_current_request_refs: tuple[Ref, ...]
    conflicting_request_refs: tuple[Ref, ...]
    current_agenda_projection: FrozenMap


class MeasurementExtensionDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.measurement_extension_decision_input_c.v1"
    request: MeasurementExtensionInputC
    measured: MeasurementExtensionFactsC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class MeasurementExtensionDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.measurement_extension_decision_c.v1"
    source_disposition_ref: Ref
    source_policy_ref: Ref
    frozen_request: MeasurementExtensionInputC
    frozen_measurement: MeasurementExtensionFactsC
    proposed_agenda: FamilyAgendaSnapshot
    active_request_refs: tuple[Ref, ...]
    retained_exact_demand: FamilyAgendaDemand
    canonical_consumption_or_dispatch: None = None
    proposed_action: None = None
