"""Join witnessed inverse transitions in a declared observable projection.

This is not a simulated route through an invented complete world model. Both
directions have actual observations; their future applicability stays open.
"""
from typing import Literal
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest, immutable_json_data
from agents.yf_arc3_v5.logos.operations import ControlEvidenceSignature
from .conscious_application_prediction import _unique_pose


class OperationalConsciousnessObservedInverse(FrozenModel):
    witness_ref: Ref
    candidate_ref: Ref
    participant_refs: tuple[Ref, ...]
    field_refs: tuple[Ref, ...]
    departure_state: FrozenMap
    displaced_state: FrozenMap
    forward_observation_ref: Ref
    return_observation_ref: Ref
    forward_action_ref: Ref
    forward_action_data: FrozenMap
    return_action_ref: Ref
    return_action_data: FrozenMap
    return_control_signature: ControlEvidenceSignature
    conflicting_return_observation_refs: tuple[Ref, ...]
    current_matches_departure: bool
    current_matches_displaced: bool
    observed_return_primitive_count: Literal[1] = 1
    executed_recovery_sequence_verified: Literal[False] = False
    complete_world_restored: Literal[False] = False
    future_recovery_established: Literal[False] = False
    grants_action: Literal[False] = False


def _project(values, refs, fields, subject_fields=None):
    rows = {}
    for ref in refs:
        pose = _unique_pose(values, ref)
        requested = tuple(dict.fromkeys((*fields, *(subject_fields or {}).get(ref, ()))))
        if pose is None or any(field not in pose for field in requested):
            return None
        rows[ref] = FrozenMap({field: pose[field] for field in requested})
    if subject_fields is not None and any(ref not in rows for ref in subject_fields):
        return None
    return FrozenMap(rows)


def _qualified_observation_edges(domain):
    fields = domain.recovery_observation_fields
    history = (domain.observed_return_context or {}).get('goal_recovery_transition_history', FrozenMap())
    maximum = domain.maximum_observed_inverse_pairs
    missing = list(history.get('missing_refs', ()))
    if not fields or maximum is None:
        missing.append('recovery.declared_observable_projection_and_bound')
    if not history:
        missing.append('recovery.actual_scoped_observations')
    edges, unmeasured = [], {}
    for interval in history.get('intervals', ()) if fields and maximum is not None else ():
        transition = interval['participant_transition']
        reasons = []
        if interval.get('producer_source_current') is not True:
            reasons.append('recovery.current_observation_source')
        if interval.get('physical_packet_dimensions_consistent') is not True:
            reasons.append('recovery.compatible_observed_dimensions')
        if interval.get('single_primitive_interval_qualified') is not True:
            reasons.append('recovery.exact_single_primitive_interval')
        if transition['control_signature'] is None:
            reasons.append('recovery.witnessed_control_and_payload')
        refs = tuple(sorted(transition['before']))
        before = _project(transition['before'], refs, fields, domain.recovery_subject_fields)
        after = _project(transition['after'], refs, fields, domain.recovery_subject_fields)
        if not refs or set(transition['after']) != set(refs) or before is None or after is None:
            reasons.append('recovery.same_unambiguous_observed_context')
        if reasons:
            unmeasured[transition['observation_ref']] = tuple(reasons)
            continue
        control = ControlEvidenceSignature.model_validate(transition['control_signature'])
        command = stable_digest((transition['action_ref'], transition['action_data'], control.response_recall_key()))
        edges.append((transition, before, after, control, command))
    return fields, history, missing, unmeasured, edges


def measure_observed_inverse_evidence(domain, enumeration):
    fields, history, missing, unmeasured, edges = _qualified_observation_edges(domain)
    maximum = domain.maximum_observed_inverse_pairs
    by_before = {}
    for edge in edges:
        by_before.setdefault(stable_digest(edge[1]), []).append(edge)
    witnesses = {}
    candidates = enumeration.rows if enumeration is not None and enumeration.complete else ()
    for forward, departure, displaced, control, _ in edges:
        if (departure == displaced or domain.request is None
                or forward['action_ref'] != domain.request.operator_ref
                or control.addressed_control_ref not in domain.addressed_control_refs):
            continue
        possible_returns = by_before.get(stable_digest(displaced), ())
        current = _project(domain.participant_measurements, tuple(sorted(departure)), fields, domain.recovery_subject_fields)
        for back, back_before, back_after, back_control, command in possible_returns:
            if back_before != displaced or back_after != departure or back['observation_ref'] == forward['observation_ref']:
                continue
            conflicts = tuple(sorted({row[0]['observation_ref'] for row in possible_returns
                if row[4] == command and row[1] == displaced and row[2] != departure}))
            for candidate in candidates:
                if not any(tuple(refs) == candidate.participant_refs
                        for _, refs in sorted(forward['historical_bindings'].items())):
                    continue
                ref = 'observed-inverse:' + stable_digest((candidate.candidate_ref, fields,
                    forward['observation_ref'], back['observation_ref'], departure, displaced, conflicts))
                witnesses[ref] = OperationalConsciousnessObservedInverse(witness_ref=ref,
                    candidate_ref=candidate.candidate_ref, participant_refs=candidate.participant_refs, field_refs=fields,
                    departure_state=departure, displaced_state=displaced,
                    forward_observation_ref=forward['observation_ref'], return_observation_ref=back['observation_ref'],
                    forward_action_ref=forward['action_ref'], forward_action_data=forward['action_data'],
                    return_action_ref=back['action_ref'], return_action_data=back['action_data'],
                    return_control_signature=back_control, conflicting_return_observation_refs=conflicts,
                    current_matches_departure=current == departure, current_matches_displaced=current == displaced)
                if len(witnesses) > maximum:
                    return FrozenMap({'rows': (), 'search_complete': False,
                        'missing_refs': tuple(sorted(set((*missing, 'recovery.inverse_pair_domain_exceeds_bound')))),
                        'unmeasured_observations': FrozenMap(unmeasured), 'observed_inverse_count': 0,
                        'absence_of_recovery_established': False})
    return FrozenMap({'rows': tuple(immutable_json_data(row) for _, row in sorted(witnesses.items())),
        'search_complete': history.get('complete') is True and not missing and not unmeasured,
        'missing_refs': tuple(sorted(set(missing))), 'unmeasured_observations': FrozenMap(unmeasured),
        'observed_inverse_count': len(witnesses), 'absence_of_recovery_established': False})
