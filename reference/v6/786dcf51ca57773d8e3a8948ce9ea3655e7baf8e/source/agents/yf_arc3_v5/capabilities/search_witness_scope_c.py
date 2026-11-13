"""Validate provenance and bounds; never search or flatten policy proof branches."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_search_c import search_context_digest
from .search_witness_scope_contracts_c import (SearchWitnessScopeInputC,
    SearchWitnessScopeFactsC, SearchWitnessScopeDecisionInputC, SearchWitnessScopeDecisionC)


def measure_search_witness_scope(value: SearchWitnessScopeInputC) -> SearchWitnessScopeFactsC:
    domain, result = value.domain, value.result
    context_digest = search_context_digest(domain)
    packets = tuple((packet.request.request_ref, stable_digest(packet)) for packet in domain.packets)
    digest_equal = result.facts.get("certificate_input_digest") == stable_digest((context_digest, packets))
    identity_equal = domain.request == result.request == value.current_request
    mode = domain.request.mode
    universal = mode in ("POLICY", "BELIEF")
    quantifiers = not universal or (domain.controllable_quantifier == "EXISTS" and domain.response_quantifier == "FORALL")
    rows, authorization_matches = [], []
    for witness in result.witnesses:
        witness_ref = stable_digest(witness)
        permitted_word = (not universal or len(witness.word) <= 1
            and (not witness.word or witness.word == (witness.root_action_ref,)))
        prefix_equal = value.authorized_prefix == witness.word[:len(value.authorized_prefix)]
        current_authorization = (witness_ref == value.authorized_witness_ref
            and bool(value.authorization_evidence_refs) and prefix_equal and permitted_word)
        if current_authorization:
            authorization_matches.append(witness_ref)
        rows.append(FrozenMap({"witness_ref": witness_ref, "root_action_ref": witness.root_action_ref,
            "cost": witness.cost, "policy": witness.policy,
            "covered_response_refs": witness.covered_response_refs,
            "branch_proofs_are_executable_route_suggestions": False,
            "current_authorization_matches": current_authorization}))
    bounds = domain.request.actual_bounds
    bound_rows, statuses = [], []
    native_refs = frozenset(("max_candidates", "max_states", "max_depth", "max_events", "max_primitives"))
    counts = {"max_candidates": result.facts.get("candidate_evaluation_count"),
        "max_states": result.facts.get("explored_state_count")}
    for bound_ref in sorted(bounds):
        count = counts.get(bound_ref)
        evidence_refs = ()
        if bound_ref not in native_refs:
            receipts = tuple(receipt for receipt in value.additional_bound_receipts
                if receipt.bound_ref == bound_ref and receipt.request_ref == domain.request.request_ref
                and receipt.epoch == domain.request.epoch and receipt.input_revision_ref == domain.request.input_revision_ref
                and bool(receipt.measurement_evidence_refs))
            values = {receipt.measured_count for receipt in receipts if receipt.measured_count is not None}
            count = next(iter(values)) if len(values) == 1 and all(receipt.measured_count is not None for receipt in receipts) else None
            evidence_refs = tuple(sorted({ref for receipt in receipts for ref in receipt.measurement_evidence_refs}))
        if count is not None:
            satisfied = count <= bounds[bound_ref] if type(count) is int and count >= 0 else None
        elif bound_ref in native_refs and bound_ref not in counts:
            # Depth and per-primitive event/phase limits are established only by
            # the matching complete native calculation, not a fabricated counter.
            satisfied = True if digest_equal and result.complete and not result.bounded else None
        else:
            satisfied = None
        statuses.append(satisfied)
        bound_rows.append(FrozenMap({"bound_ref": bound_ref, "limit": bounds[bound_ref],
            "measured_count": count, "measurement_evidence_refs": evidence_refs, "satisfied": satisfied}))
    return SearchWitnessScopeFactsC(root_witness_rows=tuple(rows), bound_rows=tuple(bound_rows),
        facts=FrozenMap({"current_request_equal": identity_equal, "certificate_input_digest_equal": digest_equal,
            "native_search_complete": result.complete and not result.bounded and not result.contradictory
                and not result.missing_refs and not result.requested_steps,
            "declared_response_domain_complete": domain.closed_domain
                and domain.declared_domain_size is not None and result.declared_domain_size == domain.declared_domain_size,
            "supported_request_mode": mode in ("ROUTE", "POLICY", "BELIEF"),
            "explicit_universal_quantifiers": quantifiers,
            "one_current_authorized_root_witness": len(authorization_matches) == 1,
            "all_declared_bounds_supported": all(status is True for status in statuses),
            "all_native_bound_refs_present": native_refs <= set(bounds),
            "root_witness_count": len(result.witnesses), "root_witness_cap": 3,
            "retained_model_count": len(domain.retained_model_refs),
            "declared_response_count": domain.declared_domain_size,
            "examined_response_count": result.examined_count,
            "candidate_evaluation_count": result.facts.get("candidate_evaluation_count"),
            "explored_state_count": result.facts.get("explored_state_count"),
            "additional_bounds_missing_or_ambiguous": any(status is None for status in statuses),
            "authorized_prefix_primitive_count_fits": len(value.authorized_prefix) <= bounds.get("max_primitives", 0)}))


def assemble_search_witness_scope(value: SearchWitnessScopeDecisionInputC) -> SearchWitnessScopeDecisionC:
    prefix = value.request.authorized_prefix if value.source_disposition_ref == "witness.retain_authorized_engagement_prefix" else ()
    return SearchWitnessScopeDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref,
        engagement_prefix=prefix)
