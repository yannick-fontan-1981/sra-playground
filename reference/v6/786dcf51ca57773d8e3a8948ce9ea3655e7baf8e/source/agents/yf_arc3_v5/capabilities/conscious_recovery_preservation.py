"""Declared preservation obligations evaluated in observed state projections.

The same predicate evaluator handles scalar machine values, free geometry and
cell coordinates. Sampled endpoints never establish preservation inside a step.
"""
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, immutable_json_data, stable_digest
from .mechanical_common_contracts_c import MechanicalPredicateC
from .mechanical_event_composition_c import predicate_value
from .conscious_recovery_composition import observed_reverse_distances


class OperationalConsciousnessPreservationRequirements(FrozenModel):
    goal_ref: Ref
    mechanism_ref: Ref
    declaration_digest: Ref
    goal_preserve_constraint_refs: tuple[Ref, ...]
    goal_overshoot_constraint_refs: tuple[Ref, ...]
    dimension_bindings: FrozenMap
    unresolved_dimension_refs: tuple[Ref, ...]
    maximum_predicate_evaluations: int = Field(ge=1)
    endpoint_admission_modes: FrozenMap
    requirements_exhaustive: Literal[False] = False
    grants_action: Literal[False] = False


def bind_recovery_subject_fields(attributes, configuration):
    """Bind DRM-declared observed dimensions to their exact participant only."""
    dimensions = tuple(attributes.get('preserved_dimension_refs') or ())
    changed = attributes.get('changed_dimension_ref')
    if changed:
        dimensions = (*dimensions, changed)
    fields = {}
    for dimension in dimensions:
        rule = configuration['preservation_projection_rules'].get(dimension)
        subject = attributes.get(rule['subject_attribute']) if rule is not None else None
        if isinstance(subject, str) and subject:
            fields.setdefault(subject, set()).update(rule['field_refs'])
    return FrozenMap({ref: tuple(sorted(values)) for ref, values in sorted(fields.items())})


def bind_declared_preservation(goal_intent, mechanism_ref, attributes, configuration):
    dimensions = tuple(attributes.get('preserved_dimension_refs') or ())
    rules = configuration['preservation_projection_rules']
    bindings, unresolved = {}, []
    for dimension in dimensions:
        rule = rules.get(dimension)
        subject = attributes.get(rule['subject_attribute']) if rule is not None else None
        if not isinstance(subject, str) or not subject or not rule.get('field_refs'):
            unresolved.append(dimension)
            continue
        bindings[dimension] = FrozenMap({'subject_ref': subject, 'field_refs': tuple(rule['field_refs'])})
    return OperationalConsciousnessPreservationRequirements(
        goal_ref=goal_intent.goal_ref, mechanism_ref=mechanism_ref,
        declaration_digest=stable_digest((goal_intent, mechanism_ref, attributes, rules)),
        goal_preserve_constraint_refs=tuple(goal_intent.declarations.get('preserve_constraint_refs') or ()),
        goal_overshoot_constraint_refs=tuple(goal_intent.declarations.get('overshoot_constraint_refs') or ()),
        dimension_bindings=FrozenMap(bindings), unresolved_dimension_refs=tuple(unresolved),
        endpoint_admission_modes=FrozenMap(configuration['preservation_endpoint_admission_modes']),
        maximum_predicate_evaluations=configuration['maximum_preservation_predicate_evaluations'])


def declared_state_constraint_values(evidence, values):
    """Empty declared domain is true; a missing declared value is unknown.

This is a conjunction over the recorded requirements only. It cannot establish
that all world constraints are known, or that an edge's interior is preserved.
"""
    predicates = evidence['predicates']
    outcomes = tuple(values.get(ref) for ref in predicates)
    if evidence['unbound_requirement_refs'] or set(values) != set(predicates):
        outcomes += (None,)
    return outcomes


def admitted_projection_states(evidence, admitted_values):
    """Apply only the declared endpoint policy, including unresolved predicates."""
    if evidence.get('complete') is not True:
        return set()
    states = set()
    for ref, values in sorted(evidence['state_values'].items()):
        outcomes = declared_state_constraint_values(evidence, values)
        if all(value in admitted_values for value in outcomes):
            states.add(ref)
    return states


def measure_recovery_preservation(domain, graph):
    contract = domain.preservation_requirements
    if contract is None:
        return FrozenMap({'queries': FrozenMap(), 'missing_refs': ('preservation.declared_requirements',),
            'complete': False, 'whole_path_preservation_established': False})
    unbound = tuple(dict.fromkeys((*contract.goal_preserve_constraint_refs,
        *contract.goal_overshoot_constraint_refs, *contract.unresolved_dimension_refs)))
    queries, examined, missing, cache, search_cache, searched = {}, 0, [], {}, {}, 0
    incoming = {}
    for ref, edge in sorted(graph['edges'].items()):
        incoming.setdefault(edge['after_state_ref'], []).append(ref)
    for query_ref, query in sorted(graph['queries'].items()):
        departure_ref = query['departure_state_ref']
        if departure_ref not in cache:
            departure = graph['states'][departure_ref]
            predicates, unknown = {}, list(unbound)
            for dimension, binding in sorted(contract.dimension_bindings.items()):
                subject = binding['subject_ref']
                for field in binding['field_refs']:
                    ref = 'preservation-field:' + stable_digest((dimension, subject, field))
                    if subject not in departure or field not in departure[subject]:
                        unknown.append(ref)
                        continue
                    predicates[ref] = MechanicalPredicateC(predicate_ref=ref, field_ref=subject,
                        field_path=(field,), comparison='EQ', expected=departure[subject][field])
            values, complete = {}, True
            for state_ref, state in sorted(graph['states'].items()):
                if examined + len(predicates) > contract.maximum_predicate_evaluations:
                    complete = False
                    break
                values[state_ref] = FrozenMap({ref: predicate_value(predicate, state)
                    for ref, predicate in sorted(predicates.items())})
                examined += len(predicates)
            if not complete:
                values = {}  # A partial table cannot exclude the unvisited alternatives.
                missing.append('preservation.predicate_evaluation_bound_reached')
            cache[departure_ref] = FrozenMap({'predicates': FrozenMap({ref: immutable_json_data(value)
                for ref, value in sorted(predicates.items())}), 'state_values': FrozenMap(values),
                'unbound_requirement_refs': tuple(unknown), 'complete': complete,
                'declared_requirements_empty': not predicates and not unknown,
                'requirements_exhaustive': contract.requirements_exhaustive})
        evidence = cache[departure_ref]
        state_values = evidence['state_values']
        relevant = {departure_ref, query['displaced_state_ref']}
        for edge_ref in query['shortest_return_edge_refs']:
            edge = graph['edges'][edge_ref]
            relevant.update((edge['before_state_ref'], edge['after_state_ref']))
        false_states = tuple(ref for ref in sorted(relevant)
            if any(value is False for value in declared_state_constraint_values(evidence, state_values.get(ref, {}))))
        unknown_states = tuple(ref for ref in sorted(relevant) if ref not in state_values
            or any(value is None for value in declared_state_constraint_values(evidence, state_values[ref])))
        paths = {}
        for mode, admitted_values in sorted(contract.endpoint_admission_modes.items()):
            key = (departure_ref, mode)
            if key not in search_cache:
                admitted_states = admitted_projection_states(evidence, admitted_values)
                distances, complete, used = observed_reverse_distances(incoming, graph['edges'], departure_ref,
                    domain.recovery_search_bounds['max_evaluations'] - searched,
                    domain.recovery_search_bounds['max_depth'], admitted_states)
                searched += used
                search_cache[key] = (distances, complete and evidence['complete'])
            distances, complete = search_cache[key]
            length = distances.get(query['displaced_state_ref'])
            paths[mode] = FrozenMap({'distance_to_departure': distances,
                'minimum_return_primitive_count': length,
                'minimum_forward_and_return_primitive_count': length + 1 if length is not None else None,
                'observed_subgraph_search_complete': complete,
                'whole_path_preservation_established': False})
            if not complete:
                missing.append('preservation.filtered_graph_search_incomplete')
        queries[query_ref] = FrozenMap({'declaration_digest': contract.declaration_digest,
            'predicate_table_ref': departure_ref, 'sampled_state_refs': tuple(sorted(relevant)),
            'false_state_refs': false_states, 'unknown_state_refs': unknown_states,
            'shortest_relation_complete': query['shortest_relation_complete'],
            'all_shortest_sampled_endpoints_satisfy_bound_predicates': query['minimum_return_primitive_count'] is not None
                and evidence['complete'] and query['shortest_relation_complete'] and not false_states and not unknown_states,
            'declared_requirements_empty': evidence['declared_requirements_empty'],
            'bound_predicate_count': len(evidence['predicates']),
            'requirements_exhaustive': contract.requirements_exhaustive,
            'unbound_requirement_refs': evidence['unbound_requirement_refs'],
            'endpoint_admission_paths': FrozenMap(paths),
            'world_intermediate_states_observed': False,
            'whole_path_preservation_established': False})
    return FrozenMap({'requirements': immutable_json_data(contract), 'predicate_tables': FrozenMap(cache),
        'queries': FrozenMap(queries), 'complete': not missing, 'missing_refs': tuple(sorted(set(missing))),
        'examined_predicate_count': examined,
        'examined_search_edge_count': searched,
        'contradicted_query_count': sum(bool(row['false_state_refs']) for _, row in sorted(queries.items())),
        'unknown_query_count': sum(bool(row['unknown_state_refs']) for _, row in sorted(queries.items())),
        'whole_path_preservation_established': False})
