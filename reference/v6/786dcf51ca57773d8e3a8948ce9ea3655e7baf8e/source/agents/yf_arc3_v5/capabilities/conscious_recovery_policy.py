"""Bounded strong recovery policies in an explicitly conditional observed model.

Every outcome of a state/command is retained. A policy's rank strictly decreases
for all those outcomes; a lucky shortest path is not a bounded recovery policy.
This mathematical certificate does not qualify the model for future execution.
"""
from heapq import heappop, heappush
from typing import Literal
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, immutable_json_data, stable_digest
from .conscious_recovery_preservation import admitted_projection_states


class OperationalConsciousnessConditionalRecoveryPolicy(FrozenModel):
    policy_ref: Ref
    departure_state_ref: Ref
    endpoint_mode: Ref
    graph_digest: Ref
    predicate_table_digest: Ref | None
    rank_by_state: FrozenMap
    command_groups_by_state: FrozenMap
    fixed_point_reached: bool
    work_bound_reached: bool
    depth_bound_reached: bool
    examined_count: int = Field(ge=0)
    terminal_admitted: bool
    conditional_on_refs: tuple[Ref, ...] = (
        'recovery.projected_state_sufficient_for_transition',
        'recovery.recorded_control_and_payload_remain_applicable',
        'recovery.future_outcomes_covered_by_observed_relation',
    )
    cost_unit: Literal['primitive_action'] = 'primitive_action'
    future_recovery_established: Literal[False] = False
    whole_path_preservation_established: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_conditional_recovery_policy.v1'] = 'operational_consciousness_conditional_recovery_policy.v1'


def command_groups(graph):
    """Group by the existing exact action/payload/control recall signature."""
    grouped, edge_groups = {}, {}
    for ref, edge in sorted(graph['edges'].items()):
        key = 'recovery-command:' + stable_digest((edge['before_state_ref'], edge['command_signature']))
        grouped.setdefault(key, []).append(ref)
        edge_groups[ref] = key
    rows = {}
    for key, refs in sorted(grouped.items()):
        first = graph['edges'][refs[0]]
        rows[key] = FrozenMap({'before_state_ref': first['before_state_ref'],
            'command_signature': first['command_signature'], 'action_ref': first['action_ref'],
            'action_data': first['action_data'], 'edge_refs': tuple(refs),
            'outcome_state_refs': tuple(sorted({graph['edges'][ref]['after_state_ref'] for ref in refs}))})
    return FrozenMap(rows), FrozenMap(edge_groups)


def strong_recovery_policy(groups, departure, admitted_states, maximum_evaluations, maximum_depth):
    """Minimax unit-action distance by bounded retrograde AND/OR reachability.

An AND command is ready only after *all* distinct outcomes have finite ranks.
The OR state retains every command attaining its smallest worst-case rank.
Only finalized ranks are published, even when the work bound is reached.
"""
    incoming, remaining, worst = {}, {}, {}
    for ref, group in sorted(groups.items()):
        if group['before_state_ref'] not in admitted_states:
            continue
        remaining[ref], worst[ref] = len(group['outcome_state_refs']), 0
        for target in group['outcome_state_refs']:
            incoming.setdefault(target, []).append(ref)
    pending = [(0, departure)] if departure in admitted_states else []
    tentative, choices = ({departure: 0}, {departure: ()}) if pending else ({}, {})
    ranks, policy, examined, work_bound, depth_cut_states = {}, {}, 0, False, set()
    while pending:
        if examined >= maximum_evaluations:
            work_bound = True
            break
        distance, state = heappop(pending)
        examined += 1
        if state in ranks or tentative.get(state) != distance:
            continue
        ranks[state], policy[state] = distance, tuple(sorted(choices[state]))
        for ref in sorted(incoming.get(state, ())):
            if examined >= maximum_evaluations:
                work_bound = True
                break
            examined += 1
            remaining[ref] -= 1
            worst[ref] = max(worst[ref], distance)
            if remaining[ref]:
                continue
            predecessor, cost = groups[ref]['before_state_ref'], worst[ref] + 1
            if predecessor in ranks:
                continue
            if cost > maximum_depth:
                depth_cut_states.add(predecessor)
                continue
            prior = tentative.get(predecessor)
            if prior is None or cost < prior:
                tentative[predecessor], choices[predecessor] = cost, (ref,)
                heappush(pending, (cost, predecessor))
            elif cost == prior:
                choices[predecessor] = (*choices[predecessor], ref)
        if work_bound:
            break
    depth_bound = bool(depth_cut_states.difference(ranks))
    return FrozenMap({'rank_by_state': FrozenMap(ranks), 'command_groups_by_state': FrozenMap(policy),
        'fixed_point_reached': not pending and not work_bound and not depth_bound,
        'work_bound_reached': work_bound, 'depth_bound_reached': depth_bound,
        'terminal_admitted': departure in admitted_states, 'examined_count': examined})


def measure_conditional_recovery_policy(domain, graph, preservation):
    bounds = domain.recovery_search_bounds
    required = ('max_states', 'max_edges', 'max_queries', 'max_evaluations', 'max_depth')
    missing = []
    usable = (graph is not None and all(type(bounds.get(key)) is int and bounds[key] > 0 for key in required)
        and len(graph['states']) <= bounds['max_states'] and len(graph['edges']) <= bounds['max_edges']
        and len(graph['queries']) <= bounds['max_queries'])
    if not usable:
        return FrozenMap({'policies': FrozenMap(), 'queries': FrozenMap(), 'command_groups': FrozenMap(),
            'missing_refs': ('recovery.bounded_declared_model',), 'examined_count': 0,
            'world_response_domain_complete': False, 'future_recovery_established': False})
    groups, edge_groups = command_groups(graph)
    graph_digest = stable_digest(graph)
    tables = preservation.get('predicate_tables', FrozenMap()) if preservation else FrozenMap()
    modes = domain.preservation_requirements.endpoint_admission_modes if domain.preservation_requirements else FrozenMap()
    policies, queries, cache, examined = {}, {}, {}, 0
    for query_ref, query in sorted(graph['queries'].items()):
        departure = query['departure_state_ref']
        table = tables.get(departure)
        mode_states = {'observed_projection_without_preservation_claim': set(graph['states'])}
        if table is not None and table['complete']:
            mode_states.update({mode: admitted_projection_states(table, values) for mode, values in sorted(modes.items())})
        else:
            missing.append('recovery.complete_declared_preservation_predicates')
        forward_group = groups[edge_groups[query['forward_edge_ref']]]
        rows = {}
        for mode, admitted in sorted(mode_states.items()):
            key = (departure, mode)
            if key not in cache:
                measured = strong_recovery_policy(groups, departure, admitted,
                    max(0, bounds['max_evaluations'] - examined), bounds['max_depth'])
                examined += measured['examined_count']
                policy_ref = 'conditional-recovery-policy:' + stable_digest((graph_digest, key, table))
                policy = OperationalConsciousnessConditionalRecoveryPolicy(
                    policy_ref=policy_ref, departure_state_ref=departure, endpoint_mode=mode,
                    graph_digest=graph_digest, predicate_table_digest=stable_digest(table) if table else None, **dict(measured))
                policies[policy_ref] = immutable_json_data(policy)
                cache[key] = policy_ref
            policy_ref = cache[key]
            policy = policies[policy_ref]
            ranks = policy['rank_by_state']
            outcomes = forward_group['outcome_state_refs']
            complete = bool(outcomes) and all(state in ranks for state in outcomes) and departure in ranks
            rows[mode] = FrozenMap({'policy_ref': policy_ref,
                'forward_command_group_ref': edge_groups[query['forward_edge_ref']],
                'forward_outcome_state_refs': outcomes, 'conditional_policy_covers_all_recorded_outcomes': complete,
                'worst_case_return_primitive_count': max(ranks[state] for state in outcomes) if complete else None,
                'worst_case_forward_and_return_primitive_count': 1 + max(ranks[state] for state in outcomes) if complete else None,
                'conditional_no_strong_policy': policy['fixed_point_reached'] and not complete,
                'work_bound_reached': policy['work_bound_reached'], 'depth_bound_reached': policy['depth_bound_reached'],
                'unbound_requirement_refs': table['unbound_requirement_refs'] if table else (),
                'future_recovery_established': False, 'whole_path_preservation_established': False})
        queries[query_ref] = FrozenMap(rows)
    if any(row['work_bound_reached'] or row['depth_bound_reached'] for _, row in sorted(policies.items())):
        missing.append('recovery.conditional_policy_search_bound_reached')
    return FrozenMap({'policies': FrozenMap(policies), 'queries': FrozenMap(queries), 'command_groups': groups,
        'missing_refs': tuple(sorted(set(missing))), 'examined_count': examined,
        'world_response_domain_complete': False, 'future_recovery_established': False})
