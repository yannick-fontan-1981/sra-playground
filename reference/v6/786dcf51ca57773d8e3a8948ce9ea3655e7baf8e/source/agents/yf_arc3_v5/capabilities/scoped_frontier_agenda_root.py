"""Exact canonical agenda transport shared by acquired evidence frontiers.

SRC owns admission, interpretation and publication. These functions only bind
the existing Root receipt request and compare the returned immutable payload.
"""
from collections.abc import Mapping
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap
from .agenda_receipt_contracts_root import AgendaReceiptInputRoot
from .family_agenda_projection import FamilyAgendaReceipt, FamilyAgendaSnapshot


def bind_scoped_frontier_agenda(returned, *, predicate_ref):
    if returned.missing_refs or returned.parent_return.get('canonical_publication_applied') is not True:
        raise ValueError('Source must qualify the exact publication before agenda consumption')
    request = returned.measured.request
    receipt = FamilyAgendaReceipt.model_validate(returned.parent_return['agenda_receipt'])
    return AgendaReceiptInputRoot(
        agenda=request.agenda, receipt=receipt, consumer_ref=request.why.consumer_ref,
        source_return_claim_ref=returned.parent_return['source_return_claim_ref'],
        source_return_predicate_ref=predicate_ref, receipt_claim_ref=request.receipt_claim_ref,
        evidence_refs=returned.measured.evidence_refs,
        invalidated_dependency_refs=returned.parent_return.get('affected_dependency_refs',()),
    )


def finish_scoped_frontier_agenda(returned, published, *, missing_prefix):
    missing = list(returned.missing_refs)
    if not isinstance(published, Mapping) or published.get('canonical_receipt_current') is not True:
        missing.append(missing_prefix + 'canonical_agenda_receipt_required')
    else:
        reported = published.get('missing_refs', ())
        if (not isinstance(reported, (tuple, list)) or len(reported) > 128
                or any(not isinstance(ref, str) or not ref for ref in reported)):
            missing.append(missing_prefix + 'typed_canonical_agenda_missing_refs')
        else:
            missing.extend(reported)
        expected = returned.parent_return.get('agenda_receipt')
        try:
            receipt = FamilyAgendaReceipt.model_validate(expected)
            agenda = FamilyAgendaSnapshot.model_validate(published.get('agenda'))
        except (ValidationError, TypeError, ValueError):
            missing.append(missing_prefix + 'typed_canonical_agenda_after_receipt')
            agenda = None
        if agenda is not None:
            if published.get('receipt_ref') != receipt.receipt_ref:
                missing.append(missing_prefix + 'exact_agenda_receipt_identity')
            before = returned.measured.request.agenda
            receipts = before.receipts if receipt in before.receipts else (*before.receipts, receipt)
            invalidated=tuple(dict.fromkeys((*before.invalidated_dependency_refs,
                *returned.parent_return.get('affected_dependency_refs',()))))
            if agenda != before.model_copy(update={'receipts': receipts,'invalidated_dependency_refs':invalidated}):
                missing.append(missing_prefix + 'agenda_preserves_all_siblings_and_exact_receipt_append')
    refs = tuple(sorted(set(missing)))
    parent = FrozenMap({
        **dict(returned.parent_return), 'canonical_agenda_receipt_applied': not refs,
        'current_agenda': published.get('agenda') if not refs else None,
        'missing_refs': refs, 'principal_goal_changed': False, 'execution_authority': False,
    })
    return returned.model_copy(update={'parent_return': parent, 'missing_refs': refs})
