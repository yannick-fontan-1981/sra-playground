"""Bounded ordinal projections preserve gaps and the native observation domain."""
from typing import Any, Literal
from pydantic import Field, field_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, freeze_json


class IndexedSlotObservationC(FrozenModel):
    ordinal: int = Field(ge=0)
    status: Literal["KNOWN_CONTENT", "KNOWN_BACKGROUND", "MASKED", "UNOBSERVED", "OCCLUDED", "OUT_OF_DOMAIN"]
    content: Any
    geometry: FrozenMap
    observation_ref: Ref
    evidence_refs: tuple[Ref, ...]

    @field_validator("content", mode="before")
    @classmethod
    def immutable_content(cls, value):
        return freeze_json(value)


class IndexedSequenceDomainC(FrozenModel):
    domain_ref: Ref
    original_ordinals: tuple[int, ...] = Field(max_length=65536)
    evidence_refs: tuple[Ref, ...]


class IndexedSequenceInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.indexed_sequence_input_c.v1"
    sequence_ref: Ref
    parent_goal_ref: Ref
    consumer_ref: Ref
    epoch: int = Field(ge=0)
    revision_ref: Ref
    scope_ref: Ref
    observation_epoch: int = Field(ge=0)
    observation_revision_ref: Ref
    observation_scope_ref: Ref
    actual_sealed_observation: bool
    domain_alternatives: tuple[IndexedSequenceDomainC, ...] = Field(max_length=256)
    observations: tuple[IndexedSlotObservationC, ...] = Field(max_length=65536)
    max_domains: int = Field(ge=0)
    max_slots: int = Field(ge=0)
    max_observations: int = Field(ge=0)


class IndexedSlotProjectionC(FrozenModel):
    ordinal: int = Field(ge=0)
    statuses: tuple[Ref, ...]
    observations: tuple[IndexedSlotObservationC, ...]
    content_known: bool
    contradictory_content: bool


class IndexedDomainProjectionC(FrozenModel):
    domain: IndexedSequenceDomainC
    slots: tuple[IndexedSlotProjectionC, ...]
    outside_declared_domain: tuple[IndexedSlotObservationC, ...]
    unsupported_observation_refs: tuple[Ref, ...]
    contradictory_ordinals: tuple[int, ...]


class IndexedSequenceMeasurementC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.indexed_sequence_measurement_c.v1"
    frozen_request: IndexedSequenceInputC
    projections: tuple[IndexedDomainProjectionC, ...]
    remaining_domain_refs: tuple[Ref, ...]
    actual_projected_slot_count: int
    facts: FrozenMap


class IndexedSequenceDecisionInputC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.indexed_sequence_decision_input_c.v1"
    measured: IndexedSequenceMeasurementC
    source_disposition_ref: Ref
    source_policy_ref: Ref


class IndexedSequenceDecisionC(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.indexed_sequence_decision_c.v1"
    source_disposition_ref: Ref
    source_policy_ref: Ref
    measured: IndexedSequenceMeasurementC
    operational_projections: tuple[IndexedDomainProjectionC, ...]
    proposed_action: None = None
