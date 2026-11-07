"""Canonical public-delivery checks shared by commit and event replay."""
from agents.yf_arc3_v5.logos.operations import (
    ConsciousCompiledRecord, WorkflowInstanceRecord, OperationalConsciousnessReasoningFailureRecord,
)


def canonical_reasoning_exception_type(producer, *, store):
    """Read the retained technical cause in either execution representation."""
    if isinstance(producer, OperationalConsciousnessReasoningFailureRecord):
        return producer.exception_type_ref
    if isinstance(producer, WorkflowInstanceRecord):
        from agents.yf_arc3_v5.scheduler.source_return import read_source_technical_failure
        cause = read_source_technical_failure(producer, store=store)
        return cause.exception_type_ref if cause is not None else None
    return None


def require_public_reasoning_return(record, *, consciousness, store):
    outcome = record.returned_outcome
    producer = store.artifact(outcome.producer_record_ref) if store is not None else None
    if isinstance(producer, ConsciousCompiledRecord) and producer.operational_consciousness is not None:
        actual = producer.operational_consciousness.outcome
        consciousness.require_reasoning_return(producer.operational_consciousness)
    elif isinstance(producer, WorkflowInstanceRecord):
        actual = producer.operational_consciousness_outcome
    else:
        raise ValueError('operational consciousness: public delivery has no canonical producer')
    consciousness.require_reasoning_outcome(outcome)
    branch = consciousness.branch_state(outcome.context.context_ref)
    if (actual != outcome or outcome.context.run_ref != store.run_id
            or branch is None or branch.current_record_ref != producer.id
            or branch.status != outcome.status or branch.current_frame_ref != record.frame_id
            or producer.source_unit != record.source_unit):
        raise ValueError('operational consciousness: public delivery is no longer the current branch return')
    technical_type = canonical_reasoning_exception_type(producer, store=store)
    if (record.public_kind == 'operational_consciousness_failure' and (
            technical_type is None or technical_type != record.exception_type_ref)):
        raise ValueError('operational consciousness: public failure changed its canonical exception type')
    if technical_type is not None and record.public_kind != 'operational_consciousness_failure':
        raise ValueError('operational consciousness: technical failure cannot be published as refusal or wait')
    return record
