"""Bounded descriptive reachability in a supplied conditional component graph.

Reverse adjacency transposes supplied directed links; it never asserts a reverse
physical connection. No goal, epistemic promotion or action is selected here.
"""
from collections import deque


def measure_conditional_room_frontiers(request, model, membership, ports, links, count):
    cardinal = {(-1, 0), (1, 0), (0, -1), (0, 1)}
    signature = {
        'single_cell_footprint': model.footprint == ((0, 0),),
        'four_unit_cardinal_moves': len(model.commands) == 4
            and all(c.kind == 'MOVE' and c.cost == 1 for c in model.commands)
            and {c.delta for c in model.commands} == cardinal,
        'no_terrain_patch': not model.patches,
        'no_graph_rewrite': not model.rewrites,
        'no_required_visit_state': not model.required_visit_refs,
        'no_required_mode_state': model.required_mode_ref is None,
        'floor_terminal_signature': model.goal_phases == ('FLOOR',),
        'front_face_entry': model.entry_side == 'FRONT_ONLY',
        'on_endpoint_landing': model.landing == 'ON_ENDPOINT',
        'movable_landing': model.landing_control == 'DISMOUNT_BY_MOVE',
    }
    # These are the mechanical signature of this room projection, not a policy:
    # dynamic/cargo/mode domains keep the existing component calculation exactly.
    if not all(signature.values()):
        return {'available': False, 'static_signature_supported': False,
                'signature_conditions': signature,
                'epistemic_scope': 'unsupported_room_projection_preserves_base_graph'}, count, []
    cuts = []

    def charge(units, phase):
        nonlocal count
        if count + units > request.maximum_evaluations:
            if not cuts:
                cuts.append({'phase': phase, 'reason': 'evaluation_bound'})
            return False
        count += units
        return True

    by_endpoint = {}
    for port in ports:
        if not charge(1, 'room_port_index'):
            break
        by_endpoint[port['endpoint_ref']] = port
    current = (membership.get((request.state.layer_ref, request.state.point))
               if request.state.phase == 'FLOOR' else
               by_endpoint.get(request.state.landed_endpoint_ref, {}).get('walking_component_ref'))
    goal = membership.get((model.goal_layer_ref, model.goal_point))
    forward, reverse, records, unknown, nonprojected = {}, {}, [], [], []
    if not cuts:
        for link in links:
            if not charge(1, 'room_connection_index'):
                break
            source = by_endpoint.get(link['source_endpoint_ref'], {}).get('walking_component_ref')
            destination = by_endpoint.get(link.get('destination_endpoint_ref'), {}).get('walking_component_ref')
            record = {'source_endpoint_ref': link['source_endpoint_ref'],
                      'destination_endpoint_ref': link.get('destination_endpoint_ref'),
                      'source_component_ref': source, 'destination_component_ref': destination,
                      'pre_graph_revision': request.state.graph_revision,
                      'evidence_revision_ref': request.scope.evidence_revision_ref,
                      'model_revision_ref': request.scope.model_revision_ref,
                      'model_status_ref': request.scope.model_status_ref,
                      'evidence_kind': 'conditional_supplied_model',
                      'epoch': request.scope.epoch,
                      'event_owner_ref': request.scope.event_owner_ref,
                      'level_scope_ref': request.state.level_scope_ref,
                      'restore_epoch': request.state.restore_epoch,
                      'missing_refs': tuple(link.get('missing_refs', ()))}
            usable = bool(link.get('usable') and source is not None and destination is not None)
            records.append({**record, 'usable_in_supplied_graph': usable})
            if usable:
                forward.setdefault(source, []).append(destination)
                reverse.setdefault(destination, []).append(source)
            elif link.get('missing_refs'):
                unknown.append(record)
            else:
                nonprojected.append(record)

    def breadth_first(root, adjacency, phase):
        distances = {} if root is None else {root: 0}
        pending = deque(distances)
        while pending and not cuts:
            if not charge(1, phase):
                break
            node = pending.popleft()
            for neighbor in adjacency.get(node, ()):
                if not charge(1, phase):
                    break
                if neighbor not in distances:
                    distances[neighbor] = distances[node] + 1
                    pending.append(neighbor)
        return distances

    from_current = breadth_first(current, forward, 'room_forward_frontier') if not cuts else {}
    to_goal = breadth_first(goal, reverse, 'room_reverse_frontier') if not cuts else {}
    complete = not cuts
    hops = from_current.get(goal) if complete and goal is not None else None
    first_endpoints = []
    if complete and hops is not None and hops > 0:
        for record in records:
            if not charge(1, 'room_frontier_join'):
                break
            destination = record['destination_component_ref']
            if (record['usable_in_supplied_graph'] and record['source_component_ref'] == current
                    and destination in to_goal and to_goal[destination] + 1 == hops):
                first_endpoints.append(record['source_endpoint_ref'])
    complete = not cuts
    return {'available': True, 'static_signature_supported': True,
            'signature_conditions': signature, 'search_complete_in_returned_graph': complete,
            'current_component_ref': current, 'goal_component_ref': goal,
            'forward_component_distances': from_current,
            'reverse_component_distances': to_goal,
            'meeting_component_refs': tuple(sorted(set(from_current) & set(to_goal))) if complete else (),
            'current_goal_same_component': current is not None and current == goal,
            'positive_goal_connection': complete and hops is not None and hops > 0,
            'component_hops_to_goal': hops if complete else None,
            'first_connection_endpoint_refs': tuple(sorted(first_endpoints)) if complete else (),
            'connection_records': tuple(records), 'unresolved_connection_records': tuple(unknown),
            'nonprojected_connection_records': tuple(nonprojected),
            'epistemic_scope': 'conditional_supplied_model_not_established_route',
            'physical_reverse_edges_inferred': False,
            'scope_ref': request.scope.request_ref}, count, cuts
