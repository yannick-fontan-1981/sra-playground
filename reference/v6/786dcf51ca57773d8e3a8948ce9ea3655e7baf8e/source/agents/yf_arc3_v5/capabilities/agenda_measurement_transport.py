"""Append one current measured contribution to both agenda representations.

The compact controller transports descriptive deltas, not the expanded facts.
Updating only one representation silently loses an appended measurement.
This adapter grants no role, priority, goal, permit or execution authority.
"""
from collections.abc import Mapping
from agents.yf_arc3_v5.logos.types import FrozenMap
from .contracts import InteractionProbeAgenda


def append_candidate_measurements(agenda: InteractionProbeAgenda,
        measured_by_ref: FrozenMap, context_measurements: FrozenMap) -> InteractionProbeAgenda:
    if set(measured_by_ref) - set(agenda.alternative_refs):
        raise ValueError('measured contribution refers to a foreign agenda candidate')
    for ref in measured_by_ref:
        if not isinstance(measured_by_ref[ref], Mapping):
            raise TypeError('candidate measurement contribution must be a mapping')
    previous_deltas = agenda.descriptive_delta_facts or agenda.alternative_facts
    facts, deltas = {}, {}
    for ref in agenda.alternative_refs:
        contribution = measured_by_ref.get(ref, FrozenMap())
        facts[ref] = FrozenMap.overlay(contribution, agenda.alternative_facts[ref])
        deltas[ref] = FrozenMap.overlay(contribution, previous_deltas.get(ref, FrozenMap()))
    return agenda.model_copy(update={
        'alternative_facts': FrozenMap(facts), 'descriptive_delta_facts': FrozenMap(deltas),
        'context_facts': FrozenMap.overlay(context_measurements, agenda.context_facts)})
