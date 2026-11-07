"""Bounded reachability in observed projections, not simulated world dynamics.

Reverse distance labels retain every shortest edge and its conflicting observed
outcomes. They are a graph certificate, never an executable action series.
"""
from collections import deque
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest, immutable_json_data
from .conscious_recovery_evidence import _qualified_observation_edges, _project


class OperationalConsciousnessRecoveryReachability(FrozenModel):
    query_ref: Ref
    candidate_ref: Ref
    participant_refs: tuple[Ref, ...]
    forward_edge_ref: Ref
    departure_state_ref: Ref
    displaced_state_ref: Ref
    distance_to_departure: FrozenMap
    shortest_return_edge_refs: tuple[Ref, ...]
    conflicting_observation_refs: tuple[Ref, ...]
    minimum_return_primitive_count: int | None = Field(default=None, ge=0)
    minimum_forward_and_return_primitive_count: int | None = Field(default=None, ge=1)
    observed_projection_unchanged: bool
    current_matches_departure: bool
    current_matches_displaced: bool
    observed_graph_search_complete: bool
    shortest_relation_complete: bool
    world_response_domain_complete: Literal[False] = False
    complete_world_recovery_established: Literal[False] = False
    future_resource_cost_known: Literal[False] = False
    executable_series_constructed: Literal[False] = False
    grants_action: Literal[False] = False


def observed_reverse_distances(incoming, edges, departure, maximum_evaluations, maximum_depth, admitted_states=None):
    """Mechanical distance calculation, also used for declared predicate subsets."""
    if admitted_states is not None and departure not in admitted_states:
        return FrozenMap(), True, 0
    distance, pending, complete, examined = {departure: 0}, deque((departure,)), True, 0
    while pending:
        state = pending.popleft()
        for ref in sorted(incoming.get(state, ())):
            if examined >= maximum_evaluations:
                complete = False
                pending.clear()
                break
            examined += 1
            predecessor = edges[ref]['before_state_ref']
            if predecessor in distance or admitted_states is not None and predecessor not in admitted_states:
                continue
            if distance[state] >= maximum_depth:
                complete = False
                continue
            distance[predecessor] = distance[state] + 1
            pending.append(predecessor)
    return FrozenMap(distance), complete, examined


def measure_observed_recovery_composition(domain, enumeration):
    fields, history, missing, unmeasured, observations = _qualified_observation_edges(domain)
    bounds = domain.recovery_search_bounds
    required = ('max_states', 'max_edges', 'max_queries', 'max_evaluations', 'max_depth')
    if any(type(bounds.get(key)) is not int or bounds[key] < 1 for key in required):
        missing.append('recovery.declared_composition_search_bounds')
        observations = ()
    states, edges, incoming, outgoing = {}, {}, {}, {}
    for transition, before, after, control, command in observations:
        before_ref, after_ref = 'observed-state:' + stable_digest(before), 'observed-state:' + stable_digest(after)
        ref = 'observed-edge:' + stable_digest((transition, fields, domain.recovery_subject_fields))
        states[before_ref], states[after_ref] = before, after
        edges[ref] = FrozenMap({'observation_ref': transition['observation_ref'],
            'before_state_ref': before_ref, 'after_state_ref': after_ref,
            'action_ref': transition['action_ref'], 'action_data': transition['action_data'],
            'control_signature': immutable_json_data(control), 'command_signature': command,
            'historical_bindings': transition['historical_bindings'], 'observed_primitive_count': 1})
        incoming.setdefault(after_ref, []).append(ref)
        outgoing.setdefault(before_ref, []).append(ref)
    if len(states) > bounds.get('max_states', 0) or len(edges) > bounds.get('max_edges', 0):
        missing.append('recovery.observed_graph_exceeds_bound')
        states, edges, incoming, outgoing = {}, {}, {}, {}
    queries = {}
    candidates = enumeration.rows if enumeration is not None and enumeration.complete else ()
    if enumeration is None or not enumeration.complete:
        missing.append('recovery.current_complete_application_domain')
    for ref, edge in sorted(edges.items()):
        if (domain.request is None
                or edge['action_ref'] != domain.request.operator_ref
                or edge['control_signature']['addressed_control_ref'] not in domain.addressed_control_refs):
            continue
        for candidate in candidates:
            if any(tuple(refs) == candidate.participant_refs for _, refs in sorted(edge['historical_bindings'].items())):
                queries['recovery-query:' + stable_digest((candidate.candidate_ref, ref))] = (candidate, ref)
    if len(queries) > bounds.get('max_queries', 0):
        missing.append('recovery.composition_queries_exceed_bound')
        queries = {}
    # No route permutations or action series are materialized. One reverse BFS
    # per departure establishes minimum lengths in this supplied observation graph.
    cache, results, examined = {}, {}, 0
    edge_conflicts = {ref: tuple(sorted({other['observation_ref'] for _, other in sorted(edges.items())
        if other['before_state_ref'] == edge['before_state_ref']
        and other['command_signature'] == edge['command_signature']
        and other['after_state_ref'] != edge['after_state_ref']})) for ref, edge in sorted(edges.items())}
    for query_ref, (candidate, forward_ref) in sorted(queries.items()):
        edge = edges[forward_ref]
        departure, displaced = edge['before_state_ref'], edge['after_state_ref']
        if departure not in cache:
            distance, complete, used = observed_reverse_distances(incoming, edges, departure,
                bounds['max_evaluations'] - examined, bounds['max_depth'])
            examined += used
            cache[departure] = (distance, complete)
        distance, complete = cache[departure]
        length = distance.get(displaced)
        # Keep the entire shortest relation from this displaced state, including
        # equally short controls; conflicting responses remain attached to each.
        relation_complete = True
        shortest, conflicts, visited, pending = set(), set(edge_conflicts[forward_ref]), set(), [displaced] if length is not None else []
        while pending:
            state = pending.pop()
            if state in visited or state == departure:
                continue
            visited.add(state)
            for ref in sorted(outgoing.get(state, ())):
                if examined >= bounds['max_evaluations']:
                    relation_complete = False
                    pending.clear()
                    break
                examined += 1
                item = edges[ref]
                if item['after_state_ref'] not in distance or distance[item['after_state_ref']] != distance[state] - 1:
                    continue
                shortest.add(ref)
                pending.append(item['after_state_ref'])
                conflicts.update(edge_conflicts[ref])
        if not relation_complete:
            # Incomplete return search cannot erase an already observed conflict
            # of the forward command, including unchanged/displaced alternatives.
            shortest, conflicts = set(), set(edge_conflicts[forward_ref])
        current = _project(domain.participant_measurements, tuple(sorted(states[departure])), fields, domain.recovery_subject_fields)
        results[query_ref] = immutable_json_data(OperationalConsciousnessRecoveryReachability(
            query_ref=query_ref, candidate_ref=candidate.candidate_ref, participant_refs=candidate.participant_refs,
            forward_edge_ref=forward_ref, departure_state_ref=departure, displaced_state_ref=displaced,
            distance_to_departure=distance, shortest_return_edge_refs=tuple(sorted(shortest)),
            conflicting_observation_refs=tuple(sorted(conflicts)), minimum_return_primitive_count=length,
            minimum_forward_and_return_primitive_count=length + 1 if length is not None else None,
            observed_projection_unchanged=departure == displaced,
            current_matches_departure=current == states[departure], current_matches_displaced=current == states[displaced],
            observed_graph_search_complete=complete, shortest_relation_complete=relation_complete))
    complete = history.get('complete') is True and not missing and not unmeasured \
        and all(row['observed_graph_search_complete'] and row['shortest_relation_complete'] for _, row in sorted(results.items()))
    if any(not row['observed_graph_search_complete'] or not row['shortest_relation_complete'] for _, row in sorted(results.items())):
        missing.append('recovery.composition_search_bound_reached')
    return FrozenMap({'field_refs': fields, 'subject_field_refs': domain.recovery_subject_fields,
        'states': FrozenMap(states), 'edges': FrozenMap(edges),
        'queries': FrozenMap(results), 'edge_conflicting_observations': FrozenMap(edge_conflicts), 'search_complete': complete,
        'missing_refs': tuple(sorted(set(missing))), 'unmeasured_observations': FrozenMap(unmeasured),
        'examined_edge_count': examined,
        'composed_return_count': sum(row['minimum_return_primitive_count'] is not None
            and row['minimum_return_primitive_count'] > 1 for _, row in sorted(results.items())),
        'world_response_domain_complete': False, 'absence_of_recovery_established': False,
        'executable_series_constructed': False})
