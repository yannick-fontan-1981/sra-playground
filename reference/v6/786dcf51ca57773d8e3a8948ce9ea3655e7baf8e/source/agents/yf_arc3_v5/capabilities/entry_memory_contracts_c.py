"""Current field observation, remembered content and predictions never alias."""
from typing import Literal, Any
from pydantic import Field, field_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, freeze_json


class EntryFieldObservationC(FrozenModel):
    field_ref: Ref
    owner_ref: Ref
    content_status: Literal["KNOWN", "EXPLICIT_EMPTY", "MASKED", "UNOBSERVED"]
    appearance_status: Literal["VISIBLE", "NEUTRAL", "MISSING_DRAWING"]
    value: Any
    observation_ref: Ref
    evidence_refs: tuple[Ref, ...]
    current_identity_support_refs: tuple[Ref, ...]

    @field_validator("value", mode="before")
    @classmethod
    def immutable_value(cls, value):
        return freeze_json(value)


class RememberedEntryFieldC(FrozenModel):
    field_ref: Ref
    owner_ref: Ref
    value: Any
    episode_ref: Ref
    acquired_epoch: int = Field(ge=0)
    acquisition_evidence_refs: tuple[Ref, ...]

    @field_validator("value", mode="before")
    @classmethod
    def immutable_value(cls, value):
        return freeze_json(value)


class PredictedEntryFieldC(FrozenModel):
    field_ref: Ref
    owner_ref: Ref
    value: Any
    model_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    premise_refs: tuple[Ref, ...]
    falsifier_refs: tuple[Ref, ...]

    @field_validator("value", mode="before")
    @classmethod
    def immutable_value(cls, value):
        return freeze_json(value)


class EntryPersistenceEvidenceC(FrozenModel):
    field_ref: Ref
    owner_ref: Ref
    episode_ref: Ref
    from_epoch: int = Field(ge=0)
    to_epoch: int = Field(ge=0)
    current_revision_ref: Ref
    current_scope_ref: Ref
    actual_observed_persistence: bool
    evidence_refs: tuple[Ref, ...]


class PortableEntryMethodC(FrozenModel):
    mechanism_ref: Ref
    portable_method: FrozenMap
    acquisition_evidence_refs: tuple[Ref, ...]
    required_current_field_refs: tuple[Ref, ...]
    falsifier_refs: tuple[Ref, ...]


class CurrentEntryIdentityBindingC(FrozenModel):
    remembered_owner_ref: Ref
    current_owner_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    evidence_refs: tuple[Ref, ...]


class EntryMemoryInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.entry_memory_input_c.v1"
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    episode_ref: Ref
    observation_epoch: int = Field(ge=0)
    observation_revision_ref: Ref
    observation_scope_ref: Ref
    actual_sealed_observation: bool
    parent_goal_ref: Ref
    next_contribution_ref: Ref
    relevant_field_refs: tuple[Ref, ...]
    required_entry_field_refs: tuple[Ref, ...]
    current_fields: tuple[EntryFieldObservationC, ...] = Field(max_length=1024)
    remembered_fields: tuple[RememberedEntryFieldC, ...] = Field(max_length=1024)
    predicted_fields: tuple[PredictedEntryFieldC, ...] = Field(max_length=1024)
    persistence_evidence: tuple[EntryPersistenceEvidenceC, ...] = Field(max_length=1024)
    learned_methods: tuple[PortableEntryMethodC, ...] = Field(max_length=256)
    current_identity_bindings: tuple[CurrentEntryIdentityBindingC, ...] = Field(default=(), max_length=1024)


class EntryFieldMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.entry_field_measurement_c.v1"
    field_ref: Ref
    observed: tuple[EntryFieldObservationC, ...]
    remembered: tuple[RememberedEntryFieldC, ...]
    predicted: tuple[PredictedEntryFieldC, ...]
    supported_remembered: tuple[RememberedEntryFieldC, ...]
    supported_predicted: tuple[PredictedEntryFieldC, ...]
    persistence_candidates: tuple[RememberedEntryFieldC, ...]
    current_persistence_evidence: tuple[EntryPersistenceEvidenceC, ...]
    facts: FrozenMap


class EntryFieldDispositionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.entry_field_disposition_c.v1"
    field_ref: Ref
    source_disposition_ref: Ref
    source_policy_ref: Ref
    frozen_measurement: EntryFieldMeasurementC
    observed: tuple[EntryFieldObservationC, ...]
    remembered: tuple[RememberedEntryFieldC, ...]
    predicted: tuple[PredictedEntryFieldC, ...]
    bound_current_value: Any
    bound_current_value_present: bool
    bound_current_value_provenance_refs: tuple[Ref, ...]
    relevant_ambiguity_pending: bool

    @field_validator("bound_current_value", mode="before")
    @classmethod
    def immutable_value(cls, value):
        return freeze_json(value)


class EntryMemorySessionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.entry_memory_session_c.v1"
    request: EntryMemoryInputC
    measured_fields: tuple[EntryFieldMeasurementC, ...]
    dispositions: tuple[EntryFieldDispositionC, ...] = ()
    unresolved_required_entry_fields: tuple[Ref, ...]
    relevant_question_field_refs: tuple[Ref, ...] = ()
    pending_observation_field_refs: tuple[Ref, ...] = ()
    append_contradiction_refs: tuple[Ref, ...] = ()
    proposed_action: None = None


class EntryFieldAppendInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.entry_field_append_input_c.v1"
    session: EntryMemorySessionC
    measured: EntryFieldMeasurementC
    source_disposition_ref: Ref
    source_policy_ref: Ref
