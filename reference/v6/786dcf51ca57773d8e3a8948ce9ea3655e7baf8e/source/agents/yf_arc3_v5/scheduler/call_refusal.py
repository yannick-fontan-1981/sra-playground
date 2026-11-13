"""Exact invocation refusals shared by interpreted and compiled Source calls."""
from pydantic import ValidationError

from agents.yf_arc3_v5.logos.source_completion import SourceCallRefusal
from agents.yf_arc3_v5.logos.types import FrozenMap
from .evaluator import RuntimeTypeError
from .registry import PureCallBlocked


def source_call_refusal(error, *, workflow_instance_ref, statement_ref, callee_ref):
    """Retain contract diagnostics, never rejected payloads or a repair decision."""
    if not isinstance(error, (PureCallBlocked, ValidationError, RuntimeTypeError)):
        raise TypeError('a technical exception is not an explicit call refusal')
    invalid_payload = isinstance(error, ValidationError)
    mismatch = error.mismatch if isinstance(error, RuntimeTypeError) else None
    kind = ('invalid_runtime_type' if mismatch is not None else
        'invalid_typed_payload' if invalid_payload else 'blocked_call')
    errors = tuple(FrozenMap({
        'location': tuple(str(part) for part in item['loc']),
        'type': item['type'], 'message': item['msg'][:1024],
    }) for item in error.errors(include_input=False, include_url=False)[:32]) if invalid_payload else ()
    blocked = error if isinstance(error, PureCallBlocked) else None
    return SourceCallRefusal(
        workflow_instance_ref=workflow_instance_ref, statement_ref=statement_ref,
        callee_ref=callee_ref, failure_kind=kind,
        detail=kind if invalid_payload or mismatch is not None else str(error)[:2048],
        runtime_type_mismatch=mismatch, validation_errors=errors,
        validation_error_count=error.error_count() if invalid_payload else 0,
        validation_errors_complete=not invalid_payload or error.error_count() <= 32,
        child_failure_checkpoint_ref=blocked.child_failure_checkpoint_ref if blocked else None,
        child_reasoning_outcome_ref=blocked.child_reasoning_outcome_ref if blocked else None,
        reasoning_entry_refusal=blocked.reasoning_entry_refusal if blocked else None,
        consumption_source_refusal=blocked.consumption_source_refusal if blocked else None,
    )
