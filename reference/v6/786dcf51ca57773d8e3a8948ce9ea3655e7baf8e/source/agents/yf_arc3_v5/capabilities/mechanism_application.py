"""Exact bounded matching of supplied operator applications and observations.

DRM supplies the signatures, conditioning and candidate domains. This module
neither creates hypotheses nor decides which unanswered application to test.
"""
from __future__ import annotations

from itertools import combinations, permutations
from math import comb, perm

from pydantic import Field, model_validator

from agents.yf_arc3_v5.logos.types import FrozenModel, Ref


class ApplicationCandidate(FrozenModel):
    candidate_ref: Ref
    operator_ref: Ref
    conditioning_signature_ref: Ref
    participant_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    participant_signature_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    measurement_complete: bool

    @model_validator(mode="after")
    def validate_participants(self) -> "ApplicationCandidate":
        if len(set(self.participant_refs)) != len(self.participant_refs):
            raise ValueError("one identity cannot fill two application slots")
        if len(self.participant_refs) != len(self.participant_signature_refs):
            raise ValueError("each participant requires its supplied signature")
        return self


class ApplicationObservation(FrozenModel):
    evidence_ref: Ref
    operator_ref: Ref
    conditioning_signature_ref: Ref
    participant_signature_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)
    evidence_rebound_to_current_context: bool


class ApplicationMatchRequest(FrozenModel):
    current_participant_refs: tuple[Ref, ...] = Field(max_length=64)
    candidates: tuple[ApplicationCandidate, ...] = Field(max_length=256)
    observations: tuple[ApplicationObservation, ...] = Field(max_length=128)

    @model_validator(mode="after")
    def validate_unique_refs(self) -> "ApplicationMatchRequest":
        for refs in (
            self.current_participant_refs,
            tuple(c.candidate_ref for c in self.candidates),
            tuple(o.evidence_ref for o in self.observations),
        ):
            if len(set(refs)) != len(refs):
                raise ValueError("application packets require unique references")
        return self


class ApplicationMatchRow(FrozenModel):
    candidate_ref: Ref
    participant_count: int = Field(ge=1, le=16)
    candidate_measurement_complete: bool
    all_participants_current: bool
    matching_observation_refs: tuple[Ref, ...]
    matching_observation_count: int = Field(ge=0, le=128)


class ParticipantSignature(FrozenModel):
    participant_ref: Ref
    signature_ref: Ref


class ApplicationBindingRequest(FrozenModel):
    operator_ref: Ref
    conditioning_signature_ref: Ref
    candidate_prefix: Ref
    participants: tuple[ParticipantSignature, ...] = Field(max_length=64)
    requested_cardinalities: tuple[int, ...] = Field(min_length=1, max_length=16)
    exchangeable_slots_declared: bool
    maximum_bindings: int = Field(ge=1, le=256)

    @model_validator(mode="after")
    def validate_binding_packet(self) -> "ApplicationBindingRequest":
        refs=tuple(p.participant_ref for p in self.participants)
        if len(set(refs)) != len(refs):
            raise ValueError("binding participants require distinct current identities")
        if len(set(self.requested_cardinalities)) != len(self.requested_cardinalities):
            raise ValueError("requested cardinalities require unique values")
        if any(not 1 <= count <= 16 for count in self.requested_cardinalities):
            raise ValueError("requested cardinalities must be within the declared slot bound")
        return self


class ApplicationBindingEnumeration(FrozenModel):
    complete: bool
    exact_binding_count: int = Field(ge=0)
    rows: tuple[ApplicationCandidate, ...] = Field(max_length=256)


def enumerate_declared_application_bindings(
    request: ApplicationBindingRequest,
) -> ApplicationBindingEnumeration:
    """Enumerate supplied slot cardinalities without choosing a question.

    Exchangeability must be explicitly declared. Bound overflow returns no
    partial witnesses. A binding is not an influence-domain measurement.
    """
    n=len(request.participants)
    count_fn=comb if request.exchangeable_slots_declared else perm
    exact_count=sum(count_fn(n,k) for k in request.requested_cardinalities if k<=n)
    if exact_count > request.maximum_bindings:
        return ApplicationBindingEnumeration(complete=False,exact_binding_count=exact_count,rows=())
    # Canonicalization removes only permutations explicitly declared equivalent.
    participants=tuple(sorted(request.participants,key=lambda p:(p.signature_ref,p.participant_ref)))
    bindings_fn=combinations if request.exchangeable_slots_declared else permutations
    rows=[]
    for cardinality in request.requested_cardinalities:
        if cardinality>n:
            continue
        for binding in bindings_fn(participants,cardinality):
            rows.append(ApplicationCandidate(
                candidate_ref=f"{request.candidate_prefix}:{len(rows)}",
                operator_ref=request.operator_ref,
                conditioning_signature_ref=request.conditioning_signature_ref,
                participant_refs=tuple(p.participant_ref for p in binding),
                participant_signature_refs=tuple(p.signature_ref for p in binding),
                measurement_complete=False,
            ))
    return ApplicationBindingEnumeration(complete=True,exact_binding_count=exact_count,rows=tuple(rows))


def measure_application_observation_matches(
    request: ApplicationMatchRequest,
) -> tuple[ApplicationMatchRow, ...]:
    """Compare exact supplied keys; preserve ordering and every candidate."""
    current = set(request.current_participant_refs)
    rows = []
    for candidate in request.candidates:
        matches = tuple(
            observation.evidence_ref
            for observation in request.observations
            if observation.evidence_rebound_to_current_context
            and observation.operator_ref == candidate.operator_ref
            and observation.conditioning_signature_ref == candidate.conditioning_signature_ref
            and observation.participant_signature_refs == candidate.participant_signature_refs
        )
        rows.append(ApplicationMatchRow(
            candidate_ref=candidate.candidate_ref,
            participant_count=len(candidate.participant_refs),
            candidate_measurement_complete=candidate.measurement_complete,
            all_participants_current=set(candidate.participant_refs) <= current,
            matching_observation_refs=matches,
            matching_observation_count=len(matches),
        ))
    return tuple(rows)
