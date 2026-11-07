"""Ordinal lookup never compacts known observations or invents hidden content."""
from .indexed_sequence_contracts_c import (IndexedSequenceInputC, IndexedSequenceMeasurementC,
    IndexedSlotProjectionC, IndexedDomainProjectionC, IndexedSequenceDecisionInputC,
    IndexedSequenceDecisionC)
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_indexed_sequence(value: IndexedSequenceInputC) -> IndexedSequenceMeasurementC:
    current = (value.actual_sealed_observation and value.epoch == value.observation_epoch
        and value.revision_ref == value.observation_revision_ref
        and value.scope_ref == value.observation_scope_ref)
    domain_refs = tuple(domain.domain_ref for domain in value.domain_alternatives)
    unique_domains = len(domain_refs) == len(set(domain_refs))
    indices_valid = all(all(isinstance(index, int) and index >= 0 for index in domain.original_ordinals)
        and len(domain.original_ordinals) == len(set(domain.original_ordinals))
        for domain in value.domain_alternatives)
    bounded = len(value.observations) > value.max_observations or len(domain_refs) > value.max_domains
    projections, count, remaining = [], 0, []
    observation_rows = {}
    if not bounded:
        for observation in value.observations:
            observation_rows.setdefault(observation.ordinal, []).append(observation)
    for domain in value.domain_alternatives:
        if bounded or not indices_valid or not unique_domains or count+len(domain.original_ordinals) > value.max_slots:
            remaining.append(domain.domain_ref)
            bounded = bounded or count+len(domain.original_ordinals) > value.max_slots
            continue
        slots, unsupported, contradictions = [], [], []
        for ordinal in domain.original_ordinals:
            observations = tuple(observation_rows.get(ordinal, ()))
            statuses = tuple(sorted({item.status for item in observations})) if observations else ("UNOBSERVED",)
            known = tuple(item for item in observations
                if item.status in ("KNOWN_CONTENT", "KNOWN_BACKGROUND") and bool(item.evidence_refs))
            signatures = {stable_digest((item.status, item.content)) for item in known}
            content_status_unambiguous = bool(statuses) and all(
                status in ("KNOWN_CONTENT", "KNOWN_BACKGROUND") for status in statuses)
            contradictory = len(signatures) > 1 or any(item.status == "OUT_OF_DOMAIN" for item in observations)
            unsupported.extend(item.observation_ref for item in observations
                if item.status in ("KNOWN_CONTENT", "KNOWN_BACKGROUND", "OUT_OF_DOMAIN") and not item.evidence_refs)
            if contradictory:
                contradictions.append(ordinal)
            slots.append(IndexedSlotProjectionC(ordinal=ordinal, statuses=statuses,
                observations=observations, content_known=bool(known) and not contradictory
                    and content_status_unambiguous and all(bool(item.evidence_refs) for item in observations),
                contradictory_content=contradictory))
        domain_set = set(domain.original_ordinals)
        outside = tuple(item for item in value.observations if item.ordinal not in domain_set)
        projections.append(IndexedDomainProjectionC(domain=domain, slots=tuple(slots),
            outside_declared_domain=outside, unsupported_observation_refs=tuple(sorted(set(unsupported))),
            contradictory_ordinals=tuple(contradictions)))
        count += len(slots)
    supported_domains = all(bool(domain.evidence_refs) for domain in value.domain_alternatives)
    return IndexedSequenceMeasurementC(frozen_request=value, projections=tuple(projections),
        remaining_domain_refs=tuple(remaining), actual_projected_slot_count=count,
        facts=FrozenMap({"scope_current": current, "domains_present": bool(domain_refs),
            "domain_refs_unique": unique_domains, "ordinal_indices_valid": indices_valid,
            "domains_currently_evidenced": supported_domains, "budget_reached": bounded,
            "unsupported_content_present": any(item.unsupported_observation_refs for item in projections),
            "contradictory_content_present": any(item.contradictory_ordinals for item in projections),
            "multiple_domains_retained": len(domain_refs) > 1}))


def assemble_indexed_sequence(value: IndexedSequenceDecisionInputC) -> IndexedSequenceDecisionC:
    return IndexedSequenceDecisionC(source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref, measured=value.measured,
        operational_projections=value.measured.projections
            if value.source_disposition_ref == "sequence.use_current_ordinal_projection" else ())
