"""Re-read a consumed Source boundary instead of trusting comparison flags.

This authenticates the producer and the examined evidence. It does not choose
the contribution's disposition or attest its downstream semantic effect.
"""
from collections.abc import Mapping

from agents.yf_arc3_v5.logos.operations import WorkflowInstanceRecord
from agents.yf_arc3_v5.logos.types import stable_digest


def require_contribution_consumption(record, *, consciousness, store):
    """Use the same guard on publication and every operational receipt read."""
    return consciousness.require_outcome_consumption(record, store=store)


def require_consumed_source_boundary(record, *, consciousness, store):
    from agents.yf_arc3_v5.logos.source_completion import SourceFailureEvidence, SourceDeferralEvidence
    from agents.yf_arc3_v5.scheduler.source_return import (
        read_source_return, read_source_refusal,
        read_source_failure_evidence, read_source_deferral_evidence,
    )

    binding = record.operational_consciousness
    if binding.basis != 'source_return':
        return
    if store is None:
        raise ValueError('operational consciousness: consumption requires its canonical producer store')
    evidence = record.comparison_facts.get('return_source_terminal_evidence')
    primary = binding.returned_outcome_ref
    if (not isinstance(evidence, Mapping)
            or record.comparison_facts.get('return_source_terminal_matches') is not True
            or evidence.get('source_terminal_matches') is not True
            or evidence.get('source_checkpoint_ref') != primary
            or evidence.get('source_return_missing_refs')):
        raise ValueError('operational consciousness: consumed boundary differs from its measured producer')
    checkpoint = store.artifact(primary)
    if (not isinstance(checkpoint, WorkflowInstanceRecord)
            or checkpoint.operational_consciousness_outcome != consciousness.reasoning_outcome(primary)
            or checkpoint.operational_consciousness_outcome is None
            or checkpoint.state_revision > record.state_revision
            or evidence.get('source_status_ref') != checkpoint.status.value):
        raise ValueError('operational consciousness: consumed producer lost its canonical outcome')

    if checkpoint.status.value == 'completed':
        actual = read_source_return(checkpoint, store=store)
        if stable_digest(actual) != evidence.get('source_return_value_digest'):
            raise ValueError('operational consciousness: consumed Source value differs from its sealed result')
    else:
        # A refusal can be inspected, but it cannot acquire a successful STOP.
        if (evidence.get('source_return_value_digest') is not None
                or read_source_refusal(checkpoint, store=store) is None
                or not isinstance(evidence.get('source_failure_evidence'), Mapping)
                or evidence['source_failure_evidence'].get('root_checkpoint_ref') != primary):
            raise ValueError('operational consciousness: consumed non-success lost its actual refusal')

    examined = []
    for field, model, reader in (
        ('source_failure_evidence', SourceFailureEvidence, read_source_failure_evidence),
        ('source_deferral_evidence', SourceDeferralEvidence, read_source_deferral_evidence),
    ):
        raw = evidence.get(field)
        if raw is None:
            continue
        declared = model.model_validate(raw)
        root = store.artifact(declared.root_checkpoint_ref)
        if (not isinstance(root, WorkflowInstanceRecord)
                or root.state_revision > record.state_revision
                or reader(root, store=store) != declared):
            raise ValueError('operational consciousness: examined cause differs from its canonical lineage')
        if declared.missing_refs:
            raise ValueError('operational consciousness: consumed cause still has missing evidence')
        examined.extend(declared.checkpoint_refs)
        examined.extend(declared.reasoning_outcome_refs)
    expected = tuple(dict.fromkeys(ref for ref in examined if ref != primary))
    if expected != binding.examined_outcome_refs:
        raise ValueError('operational consciousness: consumption changed the exact examined outcome set')
