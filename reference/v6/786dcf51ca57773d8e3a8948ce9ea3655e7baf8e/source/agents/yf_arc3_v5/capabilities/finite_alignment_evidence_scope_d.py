"""Non-mutating finite-game evidence for the exact current Source question.

The old finite-game kernel remains the producer. Its external-input adapter is
not admissible here: a mechanism observation cannot become a live world update.
The returned scoped measurements are interpreted by the caller's DRM policy.
"""
from typing import ClassVar
from agents.yf_arc3_v5.logos.types import Ref
from .native_goal_domain_audit_d import NativeGoalDomainBaseD
from .d_native_goal_domain_audit_d import measure_bound_d_native_goal_domain_d
from .finite_alignment_game import FiniteAlignmentRequest,measure_finite_alignment_game


class FiniteAlignmentEvidenceRequestD(NativeGoalDomainBaseD):
    schema_version: Ref='yf_arc3_v5.finite_alignment_evidence_request_d.v1'
    native_request: FiniteAlignmentRequest
    pure_evidence_purpose_ref: Ref
    pure_evidence_purpose_evidence_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str,str],...]]=(('mechanics.finite_alignment_game','AUDIT'),)
    native_allowed_pairs: ClassVar[tuple[tuple[str,str],...]]=tuple(
        pair for pair in FiniteAlignmentRequest.signature_pairs
        if pair[1] in ('MEASURE','FIT','CORRESPOND','COMPARE','RECONCILE','OBSERVE','RETAIN','UPDATE'))


def measure_finite_alignment_evidence_scope_d(request:FiniteAlignmentEvidenceRequestD):
    return measure_bound_d_native_goal_domain_d(request,measure_finite_alignment_game)
