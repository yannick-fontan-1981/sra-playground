"""Bounded immutable identities and native responses for mechanical services."""
from __future__ import annotations

from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, require_unique


# Root banks bind each of the same 128 explicit models admitted by K09.
# Metadata also counts toward this limit; callers must preflight, never truncate.
MAX_MECHANICAL_MODEL_ASSIGNMENTS = 128


class MechanicalRequestIdentity(FrozenModel):
    request_ref: Ref
    kernel_ref: Ref
    operation_ref: Ref
    # The family SRC/DRM owner validates its exact operation/mode pair. This
    # envelope retains the supplied mode, including its explicit absence, without
    # guessing a replacement or restricting separately registered signatures.
    mode: Ref | None
    caller_ref: Ref
    parent_contribution_ref: Ref
    epoch: int = Field(ge=0)
    input_revision_ref: Ref
    model_assignments: FrozenMap
    immutable_inputs: FrozenMap
    actual_bounds: FrozenMap
    expected_return_type: Ref
    requested_domain_ref: Ref | None = None

    @model_validator(mode="after")
    def validate_bounds(self) -> "MechanicalRequestIdentity":
        if not self.actual_bounds or len(self.actual_bounds) > 16:
            raise ValueError("the exact mechanical request must declare bounded work")
        if any(type(self.actual_bounds[key]) is not int or self.actual_bounds[key] < 0
                or self.actual_bounds[key] > 65536 for key in sorted(self.actual_bounds)):
            raise ValueError("actual bounds must be finite nonnegative integer bounds")
        if len(self.model_assignments) > MAX_MECHANICAL_MODEL_ASSIGNMENTS or len(self.immutable_inputs) > 64:
            raise ValueError("too many explicit mechanical model assignments")
        return self


class MechanicalDomainReceipt(FrozenModel):
    domain_ref: Ref
    input_revision_ref: Ref
    declared_domain_size: int = Field(ge=0, le=65536)
    examined_count: int = Field(ge=0, le=65536)
    pending_count: int = Field(ge=0, le=65536)

    @model_validator(mode="after")
    def validate_counts(self) -> "MechanicalDomainReceipt":
        if self.examined_count > self.declared_domain_size:
            raise ValueError("examined work exceeds the declared finite domain")
        return self


class MechanicalResponseInput(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.mechanical_response_input.v1"
    request: MechanicalRequestIdentity
    returned_identity: MechanicalRequestIdentity
    source_status: Ref
    returned_type: Ref
    descriptive_values: FrozenMap
    retained_alternative_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    eligible_sibling_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    distinguishing_question_ref: Ref | None = None
    missing_cause: Literal["MISSING_OBSERVATION", "UNSUPPORTED_MODEL", "SIGNATURE_MISMATCH",
        "MISSING_IMPLEMENTATION", "DOMAIN_EXHAUSTED", "COMPUTATION_BOUND"] | None = None
    domain_receipt: MechanicalDomainReceipt | None = None
    scoped_optimality_proof_ref: Ref | None = None
    proof_input_revision_ref: Ref | None = None
    consumed_request_refs: tuple[Ref, ...] = Field(default=(), max_length=256)
    retained_frontier: FrozenMap = Field(default_factory=FrozenMap)

    @model_validator(mode="after")
    def validate_packet(self) -> "MechanicalResponseInput":
        require_unique(self.consumed_request_refs, "consumed mechanical requests")
        require_unique(self.retained_alternative_refs, "mechanical alternatives")
        require_unique(self.eligible_sibling_refs, "mechanical eligible siblings")
        if len(self.descriptive_values) > 64 or len(self.retained_frontier) > 64:
            raise ValueError("mechanical response envelopes must remain bounded")
        if self.source_status in {"AMBIGUOUS", "UNKNOWN"} and self.distinguishing_question_ref is None:
            raise ValueError("an ambiguous or unknown native result must retain its distinguishing question")
        return self


class MechanicalResponseFacts(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.mechanical_response_facts.v1"
    facts: FrozenMap


class MechanicalReturnAssemblyInput(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.mechanical_return_assembly_input.v1"
    request: MechanicalResponseInput
    status: Literal["FOUND", "NEEDS_EVIDENCE", "BUDGET_REACHED", "EMPTY_DECLARED_DOMAIN",
        "MODEL_CONTRADICTION", "NOT_APPLICABLE"]
    cause: Literal["MISSING_OBSERVATION", "UNSUPPORTED_MODEL", "SIGNATURE_MISMATCH",
        "MISSING_IMPLEMENTATION", "DOMAIN_EXHAUSTED", "COMPUTATION_BOUND", "NONE"]
    carry_scoped_optimality_proof: bool
    consume_response: bool


class MechanicalNormalizedReturn(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.mechanical_normalized_return.v1"
    contribution_consumption_ref: Ref | None = None
    request: MechanicalRequestIdentity
    status: Ref
    cause: Ref | None
    source_status: Ref
    descriptive_values: FrozenMap
    retained_alternative_refs: tuple[Ref, ...]
    eligible_sibling_refs: tuple[Ref, ...]
    distinguishing_question_ref: Ref | None
    domain_receipt: MechanicalDomainReceipt | None
    scoped_optimality_proof_ref: Ref | None
    consumed_request_delta: tuple[Ref, ...]
    retained_frontier: FrozenMap
    proposed_environment_experiment: None = None
    proposed_reset: None = None
