"""Exact Source bridge measurements, without implicit strategy or physics."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_common_contracts_c import SearchDomainInputC
from .mechanical_family_contracts_d import d_map
from .prefix_step_c import measure_prefix_step_signature, decode_prefix_step
from .prefix_step_contracts_c import PrefixStepDecodeInputC
from .prefix_query_bridge_contracts_c import (PrefixQuerySourceInputC, PrefixQuerySourceFactsC,
    PrefixQuerySourceFinishInputC, PrefixQuerySourceReturnC)


def measure_prefix_query_source(value: PrefixQuerySourceInputC) -> PrefixQuerySourceFactsC:
    request, query = value.request, value.request.schedule_query
    current = bool(value.current_binding_evidence_refs) and request.scope.model_status_ref == "ACTIVE"
    receipts = value.schedule_step_receipts
    receipts_current = (query is not None and len(receipts) == len(query.packets)
        and tuple(item.packet for item in receipts) == query.packets
        and all(item.packet is not None and item.packet.complete and not item.packet.missing_refs
            and item.packet.parent_request == query.request
            and item.native is not None and item.native.domain_complete
            and not item.missing_refs
            and decode_prefix_step(PrefixStepDecodeInputC(request=item.frozen_request, native=item.native)).packet == item.packet
            and all(fact is True for fact in sorted(measure_prefix_step_signature(item.frozen_request).facts.values()))
            and item.frozen_request.native_request.scope.model_revision_ref == request.scope.model_revision_ref
            and item.frozen_request.native_request.scope.evidence_revision_ref == request.scope.evidence_revision_ref
            for item in receipts))
    search_current = (current and receipts_current and not value.serving_k03 and query is not None
        and query.request.caller_ref == request.scope.caller_ref
        and query.request.parent_contribution_ref == request.scope.parent_contribution_ref
        and query.request.epoch == request.scope.epoch
        and query.request.input_revision_ref == request.scope.evidence_revision_ref
        and query.request.immutable_inputs.get("prefix_query_request_ref") == request.scope.request_ref
        and query.request.immutable_inputs.get("prefix_query_model_revision_ref") == request.scope.model_revision_ref
        and query.request.immutable_inputs.get("prefix_schedule_binding_digest") == stable_digest((
            tuple(d_map(model) for model in request.models), d_map(request.state),
            request.schedule_threads, request.bindings, request.schedule_clock_contract_ref,
            request.schedule_commutation_evidence_refs, value.current_binding_evidence_refs,
            tuple(d_map(item) for item in receipts)))
        and set(query.retained_model_refs) == {model.model_ref for model in request.models}
        and all(item.packet.model_ref in query.retained_model_refs for item in receipts)
        and set(state.model_ref for state in query.initial_states) == set(query.retained_model_refs)
        and all(state.state == d_map(request.state) for state in query.initial_states)
        and all(item.frozen_request.source_parent_goal_ref == request.scope.parent_goal_ref
            and item.frozen_request.source_parent_consumer_ref == request.scope.parent_consumer_ref
            and item.frozen_request.source_next_item_ref == request.scope.caller_next_item_ref
            and item.frozen_request.native_model_digest == stable_digest(d_map(model))
            for item in receipts for model in request.models if model.model_ref == item.packet.model_ref))
    return PrefixQuerySourceFactsC(facts=FrozenMap({"operation_ref": request.operation_ref,
        "mode_ref": request.mode_ref, "current_query_binding": current,
        "current_search_binding": search_current, "current_native_packet_receipts": receipts_current}))


def get_prefix_schedule_query(value: PrefixQuerySourceInputC) -> SearchDomainInputC:
    return value.request.schedule_query


def finish_prefix_query_source(value: PrefixQuerySourceFinishInputC) -> PrefixQuerySourceReturnC:
    return PrefixQuerySourceReturnC(frozen_request=value.request, native=value.native, search=value.search,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref,
        source_reason_ref=value.source_reason_ref)
