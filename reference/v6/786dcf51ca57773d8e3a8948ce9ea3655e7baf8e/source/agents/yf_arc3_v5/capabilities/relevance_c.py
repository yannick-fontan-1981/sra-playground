"""Occurrence accounting and exact epoch comparison; DRM names pertinence."""
from .relevance_contracts_c import RelevanceInputC, RelevanceFactsC, RelevanceDeltaInputC, RelevanceDeltaC
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_reconciled_occurrences(value: RelevanceInputC) -> RelevanceFactsC:
    new = tuple(dict.fromkeys(ref for ref in value.external_occurrence_refs
        if ref not in value.state.consumed_occurrence_refs))
    acknowledgements = {ack.occurrence_ref: ack for ack in value.state.wait_acknowledgements}
    conflicting_ack = False
    contract = value.state.wait_contract
    if contract is not None and any(ack.epoch != contract.epoch or ack.scope_ref != contract.scope_ref
            for ack in value.state.wait_acknowledgements):
        conflicting_ack = True
    for ack in value.acknowledgements:
        previous = acknowledgements.get(ack.occurrence_ref)
        if previous is not None and previous != ack:
            conflicting_ack = True
        elif (contract is not None and ack.occurrence_ref in value.external_occurrence_refs
                and ack.epoch == contract.epoch
                and ack.scope_ref == contract.scope_ref):
            acknowledgements[ack.occurrence_ref] = ack
    remaining_inputs = remaining_time = None
    wait_current = contract is not None and contract.epoch == value.state.epoch and contract.scope_ref == value.state.scope_ref
    if contract is not None:
        remaining_inputs = max(0, contract.initial_input_budget-len(acknowledgements))
        remaining_time = max(0, contract.initial_time_budget-
            sum(acknowledgements[ref].elapsed_ticks for ref in sorted(acknowledgements)))
    indicators = (value.useful_contribution, value.named_information_gain,
        value.justified_temporal_progress, value.justified_service_progress)
    return RelevanceFactsC(new_occurrence_refs=new,
        acknowledgements=tuple(acknowledgements[key] for key in sorted(acknowledgements)),
        wait_remaining_inputs=remaining_inputs, wait_remaining_time=remaining_time,
        facts=FrozenMap({
            "epoch_current": value.packet_epoch == value.state.epoch,
            "scope_current": value.packet_scope_ref == value.state.scope_ref,
            "revision_current": value.packet_revision == value.state.evidence_revision,
            "lease_current": value.lease_current,
            "endpoint_sealed": value.endpoint_sealed,
            "explanation_processed": value.explanation_processed,
            "known_positive_contribution": any(indicator is True for indicator in indicators),
            "all_contributions_explicitly_false": all(indicator is False for indicator in indicators),
            "unresolved_contribution": any(indicator is None for indicator in indicators),
            "same_full_successor_state": value.successor_before == value.successor_after,
            "new_occurrence_count": len(new), "ack_conflict": conflicting_ack,
            "wait_present": contract is not None, "wait_current": wait_current,
            "wait_exhausted": wait_current and (remaining_inputs == 0 or remaining_time == 0),
        }))


def apply_src_relevance_delta(value: RelevanceDeltaInputC) -> RelevanceDeltaC:
    request, measured = value.request, value.measured
    state = request.state
    # The branches are exact reducers for dispositions already selected in
    # DRM/SRC, never a Python cognitive fallback or usefulness classifier.
    consumed = state.consumed_occurrence_refs
    pending = state.pending_occurrence_refs
    count = state.irrelevant_count
    if value.disposition_ref in ("relevance.useful", "relevance.irrelevant"):
        consumed = tuple(dict.fromkeys((*consumed, *measured.new_occurrence_refs)))
        pending = tuple(ref for ref in pending if ref not in measured.new_occurrence_refs)
        if value.disposition_ref == "relevance.irrelevant":
            count += len(measured.new_occurrence_refs)
    elif value.disposition_ref == "relevance.unresolved":
        pending = tuple(dict.fromkeys((*pending, *measured.new_occurrence_refs)))
    current_write = value.disposition_ref != "relevance.archive_only"
    updated = state.model_copy(update={"irrelevant_count": count,
        "consumed_occurrence_refs": consumed, "pending_occurrence_refs": pending,
        "wait_acknowledgements": measured.acknowledgements}) if current_write else state
    return RelevanceDeltaC(state=updated, disposition_ref=value.disposition_ref,
        wait_status_ref=value.wait_status_ref,
        successor_after=request.successor_after if current_write else None,
        archived_packet_epoch=request.packet_epoch if not current_write else None,
        wait_remaining_inputs=measured.wait_remaining_inputs,
        wait_remaining_time=measured.wait_remaining_time)
