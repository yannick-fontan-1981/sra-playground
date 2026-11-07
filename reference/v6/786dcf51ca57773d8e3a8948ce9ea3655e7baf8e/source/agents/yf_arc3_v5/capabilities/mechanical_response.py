"""Descriptive identity comparisons and assembly of a SRC-selected return.

Status and cause selection belong to the mechanical_response DRM/SRC workflow.
These functions neither choose experiments nor consume canonical runtime state.
"""
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import (
    MechanicalResponseInput, MechanicalResponseFacts,
    MechanicalReturnAssemblyInput, MechanicalNormalizedReturn,
)
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_mechanical_response_facts(value: MechanicalResponseInput) -> MechanicalResponseFacts:
    receipt = value.domain_receipt
    return MechanicalResponseFacts(facts=FrozenMap({
        "source_status": value.source_status,
        "same_request_identity": value.request == value.returned_identity,
        "same_return_type": value.returned_type == value.request.expected_return_type,
        "already_consumed": value.request.request_ref in value.consumed_request_refs,
        "missing_cause": value.missing_cause or "UNSUPPORTED_MODEL",
        "named_domain_exhausted": receipt is not None
            and receipt.domain_ref == value.request.requested_domain_ref
            and receipt.input_revision_ref == value.request.input_revision_ref
            and receipt.examined_count == receipt.declared_domain_size
            and receipt.pending_count == 0,
        "scoped_proof_current": value.scoped_optimality_proof_ref is not None
            and value.proof_input_revision_ref == value.request.input_revision_ref,
    }))


def assemble_mechanical_return(value: MechanicalReturnAssemblyInput) -> MechanicalNormalizedReturn:
    packet = value.request
    # No mapping, fallback, experiment, reset, or semantic proof is computed here.
    # SRC passes these constants only after its declared DRM branch selection.
    return MechanicalNormalizedReturn(
        request=packet.request, status=value.status,
        cause=None if value.cause == "NONE" else value.cause,
        source_status=packet.source_status, descriptive_values=packet.descriptive_values,
        retained_alternative_refs=packet.retained_alternative_refs,
        eligible_sibling_refs=packet.eligible_sibling_refs,
        distinguishing_question_ref=packet.distinguishing_question_ref,
        domain_receipt=packet.domain_receipt,
        scoped_optimality_proof_ref=packet.scoped_optimality_proof_ref
            if value.carry_scoped_optimality_proof else None,
        consumed_request_delta=(packet.request.request_ref,) if value.consume_response else (),
        retained_frontier=packet.retained_frontier,
    )
