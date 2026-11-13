"""Exact field provenance comparison and reducers for explicit Source choices."""
from .entry_memory_contracts_c import (EntryMemoryInputC, EntryMemorySessionC,
    EntryFieldMeasurementC, EntryFieldAppendInputC, EntryFieldDispositionC)
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_entry_memory(value: EntryMemoryInputC) -> EntryMemorySessionC:
    current = (value.actual_sealed_observation and value.epoch == value.observation_epoch
        and value.revision_ref == value.observation_revision_ref
        and value.scope_ref == value.observation_scope_ref)
    field_refs = sorted({*value.required_entry_field_refs, *value.relevant_field_refs,
        *(item.field_ref for item in value.current_fields),
        *(item.field_ref for item in value.remembered_fields),
        *(item.field_ref for item in value.predicted_fields)})
    measured = []
    for field_ref in field_refs:
        observed = tuple(item for item in value.current_fields if item.field_ref == field_ref)
        remembered = tuple(item for item in value.remembered_fields if item.field_ref == field_ref)
        predicted = tuple(item for item in value.predicted_fields if item.field_ref == field_ref)
        unique = len(observed) == 1
        identity_supported = unique and bool(observed[0].current_identity_support_refs)
        known = unique and observed[0].content_status in ("KNOWN", "EXPLICIT_EMPTY") and bool(observed[0].evidence_refs)
        bound_prior_owners = set()
        if current and identity_supported:
            bound_prior_owners.add(observed[0].owner_ref)
            bound_prior_owners.update(binding.remembered_owner_ref for binding in value.current_identity_bindings
                if binding.current_owner_ref == observed[0].owner_ref and binding.epoch == value.epoch
                and binding.revision_ref == value.revision_ref and binding.scope_ref == value.scope_ref
                and bool(binding.evidence_refs))
        persistence = tuple(item for item in remembered
            if current and identity_supported and item.owner_ref in bound_prior_owners
            and item.episode_ref == value.episode_ref and item.acquired_epoch <= value.epoch
            and bool(item.acquisition_evidence_refs)
            and any(evidence.field_ref == field_ref and evidence.owner_ref == item.owner_ref
                and evidence.episode_ref == value.episode_ref
                and evidence.from_epoch == item.acquired_epoch and evidence.to_epoch == value.epoch
                and evidence.current_revision_ref == value.revision_ref
                and evidence.current_scope_ref == value.scope_ref
                and evidence.actual_observed_persistence and bool(evidence.evidence_refs)
                for evidence in value.persistence_evidence))
        value_signatures = {stable_digest(item.value) for item in persistence}
        persistence_support = tuple(evidence for evidence in value.persistence_evidence
            if evidence.field_ref == field_ref and evidence.episode_ref == value.episode_ref
            and evidence.to_epoch == value.epoch and evidence.current_revision_ref == value.revision_ref
            and evidence.current_scope_ref == value.scope_ref and evidence.actual_observed_persistence
            and bool(evidence.evidence_refs) and any(evidence.owner_ref == item.owner_ref
                and evidence.from_epoch == item.acquired_epoch for item in persistence))
        supported_memory = tuple(item for item in remembered
            if current and identity_supported and item.owner_ref in bound_prior_owners
            and item.episode_ref == value.episode_ref and item.acquired_epoch <= value.epoch
            and bool(item.acquisition_evidence_refs))
        supported_predictions = tuple(item for item in predicted
            if current and identity_supported and item.owner_ref == observed[0].owner_ref
            and item.epoch == value.epoch and item.revision_ref == value.revision_ref
            and item.scope_ref == value.scope_ref and bool(item.premise_refs) and bool(item.falsifier_refs))
        measured.append(EntryFieldMeasurementC(field_ref=field_ref, observed=observed,
            remembered=remembered, predicted=predicted,
            supported_remembered=supported_memory, supported_predicted=supported_predictions,
            persistence_candidates=persistence, current_persistence_evidence=persistence_support,
            facts=FrozenMap({"scope_current": current, "current_field_unique": unique,
                "actual_content_evidenced": known, "current_identity_supported": identity_supported,
                "current_appearance_neutral_or_missing": unique
                    and observed[0].appearance_status in ("NEUTRAL", "MISSING_DRAWING"),
                "supported_memory_present": bool(supported_memory),
                "supported_prediction_present": bool(supported_predictions),
                "persistence_value_unambiguous": bool(persistence) and len(value_signatures) == 1,
                "relevant_to_next_contribution": field_ref in value.relevant_field_refs,
                "required_at_entry": field_ref in value.required_entry_field_refs})))
    return EntryMemorySessionC(request=value, measured_fields=tuple(measured),
        unresolved_required_entry_fields=tuple(sorted(set(value.required_entry_field_refs))))


def append_source_entry_disposition(value: EntryFieldAppendInputC) -> EntryMemorySessionC:
    session, row = value.session, value.measured
    # Only a reducer for Source's choice. No appearance-based emptiness or
    # remembered/model-predicted value is copied by the measurement function.
    if row not in session.measured_fields or any(item.field_ref == row.field_ref for item in session.dispositions):
        return session.model_copy(update={"append_contradiction_refs": tuple(sorted({
            *session.append_contradiction_refs, row.field_ref}))})
    disposition = value.source_disposition_ref
    bound_value, bound_present, provenance = None, False, ()
    if disposition == "entry.use_actual_observed_content":
        observed = row.observed[0]
        bound_value, bound_present = observed.value, True
        provenance = (observed.observation_ref, *observed.evidence_refs)
    elif disposition == "entry.use_currently_evidenced_persistence":
        # The policy has established equality of every eligible value. Keep
        # every supporting record; the first value does not break an identity tie.
        bound_value, bound_present = row.persistence_candidates[0].value, True
        provenance = tuple(sorted({ref for candidate in row.persistence_candidates
            for ref in candidate.acquisition_evidence_refs} | {
            ref for evidence in row.current_persistence_evidence for ref in evidence.evidence_refs}))
    needs_question = disposition == "entry.request_only_relevant_ambiguity"
    needs_observation = disposition == "entry.request_actual_entry_observation"
    result = EntryFieldDispositionC(field_ref=row.field_ref, source_disposition_ref=disposition,
        source_policy_ref=value.source_policy_ref, frozen_measurement=row,
        observed=row.observed, remembered=row.remembered, predicted=row.predicted,
        bound_current_value=bound_value, bound_current_value_present=bound_present,
        bound_current_value_provenance_refs=provenance, relevant_ambiguity_pending=needs_question)
    unresolved = tuple(ref for ref in session.unresolved_required_entry_fields
        if ref != row.field_ref or not bound_present)
    questions = tuple(sorted({*session.relevant_question_field_refs,
        *((row.field_ref,) if needs_question else ())}))
    observations = tuple(sorted({*session.pending_observation_field_refs,
        *((row.field_ref,) if needs_observation else ())}))
    return session.model_copy(update={"dispositions": (*session.dispositions, result),
        "unresolved_required_entry_fields": unresolved,
        "relevant_question_field_refs": questions, "pending_observation_field_refs": observations})
