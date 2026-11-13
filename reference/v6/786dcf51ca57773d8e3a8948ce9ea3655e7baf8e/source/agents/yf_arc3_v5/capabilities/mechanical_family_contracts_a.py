"""Immutable, bounded caller-owned envelopes for finite mechanical calculations."""
from __future__ import annotations

from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, immutable_json_data


class MechanicalFamilyScope(FrozenModel):
    request_ref: Ref
    caller_ref: Ref
    parent_goal_ref: Ref
    parent_contribution_ref: Ref
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    model_status_ref: Ref
    event_owner_ref: Ref
    input_domain_complete: bool
    assumption_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    retained_alternative_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    eligible_sibling_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    consumed_request_refs: tuple[Ref, ...] = Field(default=(), max_length=256)


class MechanicalFamilyResult(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.mechanical_family_result.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None
    signature_supported: bool
    prerequisite_refs: tuple[Ref, ...] = ()
    implementation_debt_refs: tuple[Ref, ...] = ()
    values: FrozenMap = Field(default_factory=FrozenMap)
    examined_count: int = Field(default=0, ge=0)
    domain_complete: bool = False
    computation_bound_reached: bool = False
    # These are descriptive receipts, never commitment or action permits.
    frontier: FrozenMap = Field(default_factory=FrozenMap)
    descriptive_facts: FrozenMap = Field(default_factory=FrozenMap)


class MechanicalSignatureFacts(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.mechanical_signature_facts.v1"
    descriptive_facts: FrozenMap


def project_requested_signature(request):
    """Copy supplied data; DRM owns the matching operation case."""
    return MechanicalSignatureFacts(descriptive_facts=FrozenMap({
        "requested_operation_ref":request.operation_ref,
        "requested_mode_ref":request.mode if request.mode is not None else "mechanical_signature.mode_missing",
    }))


def reject_requested_signature(request):
    """Return a dispatch receipt without running any world calculation."""
    return family_result(request,signature_supported=False,domain_complete=False)


def family_result(request, *, signature_supported=True, prerequisite_refs=(),
                  values=None, examined_count=0, domain_complete=True,
                  computation_bound_reached=False, frontier=None):
    domain_complete = (domain_complete and request.scope.input_domain_complete
                       and signature_supported and not prerequisite_refs)
    return MechanicalFamilyResult(
        scope=request.scope, operation_ref=request.operation_ref, mode=request.mode,
        signature_supported=signature_supported, prerequisite_refs=prerequisite_refs,
        values=immutable_json_data(values or {}), examined_count=examined_count,
        domain_complete=domain_complete,
        computation_bound_reached=computation_bound_reached,
        frontier=immutable_json_data(frontier or {}),
        descriptive_facts=FrozenMap({
            "signature_supported":signature_supported,
            "implementation_complete":True,
            "prerequisites_empty":not bool(prerequisite_refs),
            "domain_complete":domain_complete,
            "computation_bound_reached":computation_bound_reached,
        }),
    )


def missing_supplied_fields(request, required_fields):
    """An omitted optional input is not evidence for an empty world domain."""
    return tuple(name for name in required_fields
                 if name not in request.model_fields_set or getattr(request,name) is None)


def with_implementation_debt(result, debt_refs):
    """A useful partial measurement must not impersonate the whole requested operation."""
    if not debt_refs or not result.signature_supported:
        return result
    facts=dict(result.descriptive_facts)
    facts["domain_complete"]=False
    facts["implementation_complete"]=False
    return result.model_copy(update={"implementation_debt_refs":tuple(debt_refs),
        "domain_complete":False,"descriptive_facts":FrozenMap(facts)})
