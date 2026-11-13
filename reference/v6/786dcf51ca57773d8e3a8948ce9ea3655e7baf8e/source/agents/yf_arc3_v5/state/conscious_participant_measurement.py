"""Exact current or frozen Source tracking observations, without entity invention."""
from agents.yf_arc3_v5.capabilities.conscious_participant_measurement import project_conscious_participants
from agents.yf_arc3_v5.capabilities.conscious_quantity_observation import project_conscious_quantity_participants
from agents.yf_arc3_v5.logos.operations import CompiledTemporalTrackingRecord, WorkflowInstanceRecord, WorkflowStatus
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from agents.yf_arc3_v5.scheduler.source_return import read_source_return


def read_frozen_participant_measurements(owner, record_refs, *, timeline_ref, frame_ref, participant_refs,
        before_sequence=None):
    observations, quantity_observations, evidence = {}, {}, set()
    wanted = set(participant_refs)
    for ref in record_refs:
        record = owner._store.artifact(ref)
        sequence = owner._store.artifact_sequence(ref)
        if before_sequence is not None and (sequence is None or sequence >= before_sequence):
            continue
        if not isinstance(record, (CompiledTemporalTrackingRecord, WorkflowInstanceRecord)):
            continue
        entry = owner._entries.get(record.workflow_definition_id)
        if (record.timeline_id != timeline_ref or record.frame_id != frame_ref
                or entry is None or entry.transitive_source_hash != record.source_hash):
            continue
        if isinstance(record, CompiledTemporalTrackingRecord):
            measurements = record.participant_measurements
        else:
            if record.status is not WorkflowStatus.COMPLETED:
                continue
            try:
                returned = read_source_return(record, store=owner._store)
            except (TypeError, ValueError):
                continue
            try:
                measurements = project_conscious_participants(returned)
            except (TypeError, ValueError):
                try:
                    quantities = project_conscious_quantity_participants(returned, frame_ref)
                except (KeyError, TypeError, ValueError):
                    continue
                for participant_ref, values in sorted(quantities.items()):
                    if participant_ref in wanted:
                        quantity_observations.setdefault(participant_ref, {})[stable_digest(values)] = values
                        evidence.add(record.id)
                continue
        for row in measurements:
            if row.entity_ref not in wanted:
                continue
            # Frame/producer refs attest current revalidation separately. They
            # must not wake semantic work when the measured facts did not change.
            value = FrozenMap({key: value for key, value in sorted(immutable_json_data(row).items())
                if key not in ('component_ref', 'match_kind')})
            observations.setdefault(row.entity_ref, {})[stable_digest(value)] = value
            evidence.add(ref)
    for ref, variants in sorted(quantity_observations.items()):
        if ref not in observations:
            continue  # A resource role cannot invent a visually tracked identity.
        alternatives = tuple(variants[key] for key in sorted(variants))
        if len(alternatives) == 1:
            fields = alternatives[0]
        else:
            # Preserve all disagreements; never select the newest or cheapest.
            # Only fields shared by every candidate are usable. Missing disputed
            # fields keep their predicates unknown, without erasing agreement.
            agreed = {key: value for key, value in sorted(alternatives[0].items())
                if all(key in row and row[key] == value for row in alternatives)}
            fields = FrozenMap({**agreed, 'quantity_observation_alternatives': alternatives})
        joined = tuple(FrozenMap.overlay(fields, row) for _, row in sorted(observations[ref].items()))
        observations[ref] = {stable_digest(row): row for row in joined}
    return FrozenMap({'values': FrozenMap({ref: tuple(rows[key] for key in sorted(rows))
        for ref, rows in sorted(observations.items())}), 'evidence_refs': tuple(sorted(evidence))})


def read_current_participant_measurements(owner, context, participant_refs, workflow_refs):
    return read_participant_measurements_at_frame(owner, timeline_ref=context.timeline_id,
        frame_ref=context.frame_id, participant_refs=participant_refs, workflow_refs=workflow_refs)


def read_participant_measurements_at_frame(owner, *, timeline_ref, frame_ref, participant_refs, workflow_refs,
        before_sequence=None):
    records = {record.id for record in owner._store.current_tracking_observations(timeline_ref, frame_ref)
        if record.workflow_definition_id in workflow_refs}
    for workflow_ref in workflow_refs:
        records.update(record.id for record in owner._store.current_workflows_in_scope(
            workflow_ref, timeline_ref, frame_ref) if record.status is WorkflowStatus.COMPLETED)
    return read_frozen_participant_measurements(owner, tuple(sorted(records)),
        timeline_ref=timeline_ref, frame_ref=frame_ref, participant_refs=participant_refs, before_sequence=before_sequence)
