"""Read shared tracked-observable contracts from source-qualified measurements."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .conscious_participant_measurement import read_participant_measurements_at_frame, read_frozen_participant_measurements


def read_participant_observables(owner, specifications, *, timeline_ref, frame_ref, before_sequence=None, frozen_record_refs=None):
    groups, signature, evidence, missing, alternatives = {}, {}, set(), [], {}
    for item in specifications:
        groups.setdefault(item.source_workflow_refs, []).append(item)
    for workflows, fields in sorted(groups.items()):
        if owner is None:
            missing.extend('acquisition.source_reader_unavailable:' + item.field_ref for item in fields)
            continue
        arguments = dict(timeline_ref=timeline_ref, frame_ref=frame_ref,
            participant_refs=tuple(sorted({item.participant_ref for item in fields})), before_sequence=before_sequence)
        if frozen_record_refs is None:
            measured = read_participant_measurements_at_frame(owner, workflow_refs=workflows, **arguments)
        else:
            refs = tuple(ref for ref in frozen_record_refs
                if getattr(owner._store.artifact(ref), 'workflow_definition_id', None) in workflows)
            measured = read_frozen_participant_measurements(owner, refs, **arguments)
        evidence.update(measured['evidence_refs'])
        for item in fields:
            rows = measured['values'].get(item.participant_ref, ())
            alternatives[item.field_ref] = rows
            if len(rows) != 1 or rows[0]['possible_predecessor_entity_refs']:
                missing.append('acquisition.unambiguous_participant:' + item.field_ref)
            elif item.measurement_field_ref not in rows[0]:
                missing.append('acquisition.declared_measurement_field:' + item.field_ref)
            else:
                signature[item.field_ref] = rows[0][item.measurement_field_ref]
    return FrozenMap({'observed_signature': FrozenMap(signature), 'participant_alternatives': FrozenMap(alternatives),
        'evidence_refs': tuple(sorted(evidence)), 'missing_refs': tuple(sorted(set(missing)))})
