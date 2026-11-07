"""Exact bounded product search over independent sibling-pose relations.

The declared conditional hierarchy makes internal admission independent of an
ancestor's translation. Keep complete local relations, not their full product.
No game identity, learned law, goal priority or actuator is introduced here.
"""
from itertools import product

from agents.yf_arc3_v5.logos.types import FrozenMap


def factorized_region_witness(value, field, token, contract, domains):
    word, facts = measure_factorized_region_witness(value, field, token, contract, domains)
    return (word, facts) if word else None


def measure_factorized_region_witness(value, field, token, contract, domains):
    from .region_configuration_observation_d import (
        _sibling_poses_admissible, _passage_present,
    )

    stats = {'stage': 'local_relations'}
    def no_witness():
        return None, FrozenMap({**stats, 'complete_word': False})
    frames = field['frames']
    groups = {}
    for index, frame in enumerate(frames[1:], 1):
        groups.setdefault(frame['parent_index'], []).append(index)
    if len(groups) < 2:
        return no_witness()
    groups = tuple(tuple(indices) for _, indices in sorted(groups.items()))
    factors = []
    finite_examined = batches = retained = 0
    candidate_limit = contract['finite_bounds']['max_candidates']
    total_candidate_limit = candidate_limit
    for indices in groups:
        # A complete local relation is a bounded join of measured pose domains.
        # Do not enumerate and repeatedly revalidate the full Cartesian world.
        configurations = []
        for assignment in product(*(domains[index - 1] for index in indices)):
            finite_examined += 1
            if finite_examined > total_candidate_limit:
                return no_witness()
            if _sibling_poses_admissible(frames, indices, assignment):
                configurations.append(assignment)
                if retained + len(configurations) > contract['finite_bounds']['max_states']:
                    return no_witness()
        configurations = tuple(configurations)
        retained += len(configurations)
        if (not configurations or retained > contract['finite_bounds']['max_states']
                or finite_examined > total_candidate_limit):
            return no_witness()
        factors.append(configurations)

    stats.update(stage='current_membership',retained_factor_states=retained,finite_examined=finite_examined)
    initial = tuple(frame['local_origin'] for frame in frames[1:])
    memberships = tuple(frozenset(factor) for factor in factors)
    owner = {index: ordinal for ordinal, indices in enumerate(groups)
             for index in indices}
    stats['initial_memberships']=tuple(tuple(initial[index-1] for index in indices) in choices for indices,choices in zip(groups,memberships))
    for indices, choices in zip(groups, memberships):
        if tuple(initial[index - 1] for index in indices) not in choices:
            return no_witness()
    from .interaction import ARC_PALETTE_WHITE_VALUE
    focused = tuple(index for index, frame in enumerate(frames)
                    if frame['value'] == ARC_PALETTE_WHITE_VALUE)
    if len(focused) != 1 or focused[0] == 0:
        return no_witness()
    start = (initial, focused[0])
    if contract.get('factorized_goal_frontier_metric') != 'minimum_unit_translation_and_focus_lower_bound':
        return no_witness()
    if any(abs(dy)+abs(dx)!=1 for dy,dx in sorted(contract['direction_vectors'].values())):
        return no_witness()
    max_nodes = contract['maximum_graph_nodes']
    goals = []
    minimum_bound = None
    cost_slice_count = 0
    cost_slice_complete = True
    examined_products = accepted = 0
    stats['stage']='accepting_configurations'
    for assignment in product(*factors):
        examined_products += 1
        if finite_examined + examined_products > total_candidate_limit:
            return no_witness()
        poses = list(initial)
        for indices, configuration in zip(groups, assignment):
            for index, pose in zip(indices, configuration):
                poses[index - 1] = pose
        poses = tuple(poses)
        if not _passage_present(field, poses):
            continue
        accepted += 1
        changed = tuple(index for index,(before,after) in enumerate(zip(initial,poses),1)
                        if before != after)
        distance_bound = sum(abs(a-c)+abs(b-d) for (a,b),(c,d) in zip(initial,poses))
        distance_bound += sum(index != focused[0] for index in changed)
        if minimum_bound is None or distance_bound < minimum_bound:
            minimum_bound = distance_bound
            goals = []
            cost_slice_count = 0
            cost_slice_complete = True
        if distance_bound == minimum_bound:
            cost_slice_count += 1
            if len(goals) + len(frames) <= max_nodes:
                goals.extend((poses,focus) for focus in range(1,len(frames)))
            else:
                cost_slice_complete = False
    stats.update(accepting_configurations=accepted,examined_products=examined_products,
        goal_nodes=len(goals),minimum_primitive_distance_bound=minimum_bound,
        minimum_bound_configuration_count=cost_slice_count)
    if not cost_slice_complete:
        return no_witness()
    if not goals or start in goals:
        return no_witness()
    available = frozenset(value.available_action_refs)
    directions = tuple((action, tuple(vector)) for action, vector in
                       sorted(contract['direction_vectors'].items())
                       if action in available)
    point_action = contract['point_action_ref']

    def neighbors(state, reverse):
        poses, focus = state
        ordinal = owner[focus]
        indices = groups[ordinal]
        sign = -1 if reverse else 1
        for action, (dy, dx) in directions:
            y, x = poses[focus - 1]
            candidate = list(poses)
            candidate[focus - 1] = (y + sign * dy, x + sign * dx)
            if tuple(candidate[index - 1] for index in indices) in memberships[ordinal]:
                yield (tuple(candidate), focus), action, focus
        if point_action in available:
            for other in range(1, len(frames)):
                if other != focus:
                    yield (poses, other), point_action, focus if reverse else other

    forward = {start}
    backward = set(goals)
    seen_forward = {start: 0}
    seen_backward = dict.fromkeys(goals, 0)
    parents_forward = {}
    parents_backward = {}
    depth_forward = depth_backward = expanded = edge_count = 0
    best = None
    stats['stage']='bidirectional_search'
    while forward and backward:
        stats.update(expanded_states=expanded,graph_nodes=len(seen_forward)+len(seen_backward),graph_edges=edge_count)
        if depth_forward + depth_backward >= contract['maximum_route_depth']:
            return no_witness()
        reverse = len(backward) < len(forward)
        frontier = backward if reverse else forward
        seen = seen_backward if reverse else seen_forward
        other_seen = seen_forward if reverse else seen_backward
        parents = parents_backward if reverse else parents_forward
        next_frontier = set()
        for state in sorted(frontier):
            expanded += 1
            if expanded > contract['maximum_expanded_states']:
                return no_witness()
            for neighbor, action, actor in neighbors(state, reverse):
                edge_count += 1
                if edge_count > contract['maximum_graph_edges']:
                    return no_witness()
                if neighbor not in seen:
                    if len(seen_forward) + len(seen_backward) >= max_nodes:
                        return no_witness()
                    seen[neighbor] = seen[state] + 1
                    parents[neighbor] = (state, action, actor)
                    next_frontier.add(neighbor)
                if neighbor in other_seen:
                    distance = seen[neighbor] + other_seen[neighbor]
                    if best is None or distance < best[0]:
                        best = (distance, neighbor)
        if reverse:
            backward = next_frontier
            depth_backward += 1
        else:
            forward = next_frontier
            depth_forward += 1
        if best is not None and depth_forward + depth_backward >= best[0]:
            break
    if best is None or best[0] > contract['maximum_route_depth']:
        return no_witness()
    meeting = best[1]
    prefix = []
    cursor = meeting
    while cursor != start:
        previous, action, actor = parents_forward[cursor]
        prefix.append((previous, cursor, action, actor))
        cursor = previous
    path = list(reversed(prefix))
    cursor = meeting
    while cursor in parents_backward:
        following, action, actor = parents_backward[cursor]
        path.append((cursor, following, action, actor))
        cursor = following
    if len(path) != best[0] or len(path) != minimum_bound:
        return no_witness()
    word = tuple(FrozenMap({
        'before_poses': before[0], 'after_poses': after[0],
        'before_focus': before[1], 'after_focus': after[1],
        'action_ref': action, 'actor_index': actor,
    }) for before, after, action, actor in path)
    return word, FrozenMap({
        'admission_examined': 0, 'finite_examined': finite_examined,
        'finite_batches': batches, 'configuration_population': examined_products,
        'graph_nodes': len(seen_forward) + len(seen_backward),
        'graph_edges': edge_count, 'accepting_configurations': accepted,
        'expanded_states': expanded, 'population_factorized': True,
        'retained_factor_states': retained,
        'goal_domain_complete': True, 'goal_frontier_is_cost_bound_slice': True,
        'minimum_bound_configuration_count': cost_slice_count,
        'minimum_primitive_distance_bound': minimum_bound,
        'conditional_shortest_word_proved': len(word) == minimum_bound,
    })
