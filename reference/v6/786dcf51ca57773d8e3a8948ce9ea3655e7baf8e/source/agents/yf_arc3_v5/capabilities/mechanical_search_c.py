"""Finite K09 algorithms over exact STEP ledgers, never PATH per search edge.

Missing edges are explicit requests for the caller's declared STEP operation.
The complete state digest retains hidden members; raster/progress is no key.
"""
from __future__ import annotations

from heapq import heappop, heappush
from .mechanical_common_contracts_c import (
    SearchDomainInputC, SearchResultC, SearchWitnessC, EventCompositionInputC,
    SearchStateC,
    RouteCheckpointC, RouteFrontierNodeC,
)
from .mechanical_event_composition_c import compose_mechanical_events, packet_context_equal, predicate_value
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .mechanical_transport_c import route_checkpoint_payload


def full_search_state_key(state: SearchStateC) -> str:
    return stable_digest((state.model_ref, state.state))


def search_context_digest(value: SearchDomainInputC) -> str:
    """One shared binding formula, usable before executing K09."""
    return stable_digest((value.request, value.initial_states,
        value.retained_model_refs, value.declared_domain_size, value.closed_domain,
        value.action_refs, value.predicates, value.response_domains, value.state_action_domains,
        value.terminal_states, value.accepting_states, value.state_observations,
        value.acceptance_predicates, value.terminal_predicates, value.deterministic_response_ref,
        value.packet_acceptance_contract_ref, value.packet_acceptance_model_refs,
        value.route_algorithm_ref, value.admissible_lower_bounds, value.lower_bound_evidence_refs,
        value.controllable_quantifier,value.response_quantifier,value.relation_bindings,value.objective,
        value.route_witness_policy_ref,value.route_witness_evidence_refs))


def search_complete_step_domain(value: SearchDomainInputC) -> SearchResultC:
    from .search_objective_d import measure_search_objective_d,retain_search_objective_need_d
    bounds = value.request.actual_bounds
    objective = measure_search_objective_d(value)
    if objective.missing_refs:
        return retain_search_objective_need_d(value)
    missing = set(objective.missing_refs)
    single_witness = value.route_witness_policy_ref == 'FIRST_SHORTEST'
    first_shortest_settled = False
    if single_witness and (value.request.mode != 'ROUTE' or value.route_algorithm_ref != 'UNIFORM_COST'
            or value.objective is not None or not value.route_witness_evidence_refs
            or value.request.immutable_inputs.get('route_witness_policy_ref') != value.route_witness_policy_ref
            or value.request.immutable_inputs.get('route_witness_evidence_digest') != stable_digest(value.route_witness_evidence_refs)
            or value.request.immutable_inputs.get('primitive_unit_cost_domain') is not True
            or any(packet.cost != 1 for packet in value.packets)):
        missing.add('current_first_shortest_uniform_unit_cost_contract')
    if (value.state_action_domains and value.request.immutable_inputs.get("state_action_domains_digest")
            != stable_digest(value.state_action_domains)):
        missing.add("current_closed_state_action_domain")
    requested = {}
    contradictory = bounded = False
    examined = 0
    for name in ("max_states", "max_candidates", "max_depth", "max_events", "max_primitives"):
        if name not in bounds:
            missing.add(name)
    states = {full_search_state_key(state): state for state in value.initial_states}
    terminal = {full_search_state_key(state) for state in value.terminal_states}
    accepting = {full_search_state_key(state) for state in value.accepting_states}
    if any(state.model_ref not in value.retained_model_refs for state in value.initial_states):
        contradictory = True
        missing.add("initial_model_outside_retained_domain")
    if not value.initial_states:
        contradictory = True
        missing.add("empty_retained_belief")
    if (value.request.mode in ("POLICY","BELIEF") and {state.model_ref for state in value.initial_states}
            != set(value.retained_model_refs)):
        missing.add("retained_model_without_initial_state")
    if not accepting.issubset(terminal):
        contradictory = True
        missing.add("accepting_state_not_terminal")
    packet_index = {}
    response_index = {}
    unsafe_requests = set()
    for packet in value.packets:
        if examined >= bounds.get("max_candidates", 0):
            bounded = True
            break
        examined += 1
        if (packet.parent_request != value.request
                or not packet_context_equal(value.request, packet.request, packet.model_ref)
                or packet.request.immutable_inputs.get("state") != packet.before
                or packet.model_ref not in value.retained_model_refs):
            contradictory = True
            missing.add("exact_step_request_identity")
            continue
        before_state = SearchStateC(state=packet.before, model_ref=packet.model_ref)
        after_state = SearchStateC(state=packet.after, model_ref=packet.model_ref)
        before_id, after_id = full_search_state_key(before_state), full_search_state_key(after_state)
        states[before_id], states[after_id] = before_state, after_state
        if value.state_action_domains:
            admissible = value.state_action_domains.get(before_id)
            primitive = packet.primitive_ref if packet.primitive_ref is not None else packet.action_ref
            if (not isinstance(admissible, FrozenMap) or admissible.get("complete") is not True
                    or not isinstance(admissible.get("action_refs"), tuple)
                    or admissible.get("model_ref") != before_state.model_ref
                    or not isinstance(admissible.get("evidence_refs"), tuple)
                    or not admissible["evidence_refs"]):
                missing.add("current_closed_state_action_domain")
                continue
            if primitive not in admissible["action_refs"]:
                contradictory = True
                missing.add("packet_command_outside_closed_state_action_domain")
                continue
        if packet.complete and packet.terminal:
            terminal.add(after_id)
            # A stable Source goal contract may license this model's native
            # acceptance. Termination or appearance alone never licenses it.
            if (packet.acceptance and value.packet_acceptance_contract_ref is not None
                    and packet.source_goal_acceptance_contract_ref == value.packet_acceptance_contract_ref
                    and value.request.immutable_inputs.get("packet_acceptance_contract_ref") == value.packet_acceptance_contract_ref
                    and packet.model_ref in value.packet_acceptance_model_refs):
                accepting.add(after_id)
        edge_key = (before_id, packet.primitive_ref if packet.primitive_ref is not None else packet.action_ref)
        occurrence = (edge_key, packet.response_ref)
        previous = response_index.get(occurrence)
        if previous is not None:
            if previous != packet:
                contradictory = True
                missing.add("conflicting_step_response")
            continue
        # Event safety and exact ownership are checked, not assumed from a
        # settled graph endpoint. The fold neither calls PATH nor an adapter.
        folded = compose_mechanical_events(EventCompositionInputC(
            request=value.request, initial=packet.before, packets=(packet,),
            predicates=value.predicates,relation_bindings=value.relation_bindings))
        if folded.contradictory:
            contradictory = True
        if folded.bounded:
            bounded = True
        if folded.missing_refs:
            missing.update(folded.missing_refs)
        response_index[occurrence] = packet
        if folded.failed_predicate_refs:
            unsafe_requests.add(packet.request.request_ref)
        if not (folded.missing_refs or folded.contradictory or folded.bounded):
            packet_index.setdefault(edge_key, []).append(packet)
    if len(states) > bounds.get("max_states", 0):
        bounded = True
    for state_id, bound_state in sorted(states.items()):
        goal_values = tuple(predicate_value(predicate, bound_state.state) for predicate in value.acceptance_predicates)
        terminal_values = tuple(predicate_value(predicate, bound_state.state) for predicate in value.terminal_predicates)
        if value.acceptance_predicates and any(item is None for item in goal_values):
            missing.add("unresolved_requested_goal_predicate")
        elif value.acceptance_predicates and all(item is True for item in goal_values):
            accepting.add(state_id)
            terminal.add(state_id)
        if value.terminal_predicates and all(item is True for item in terminal_values):
            terminal.add(state_id)

    legal_actions = {}

    def actions_for_state(state_id):
        nonlocal contradictory
        if not value.state_action_domains:
            return value.action_refs
        if state_id in legal_actions:
            return legal_actions[state_id]
        domain = value.state_action_domains.get(state_id)
        if (value.request.immutable_inputs.get("state_action_domains_digest") != stable_digest(value.state_action_domains)
                or not isinstance(domain, FrozenMap) or domain.get("complete") is not True
                or not isinstance(domain.get("evidence_refs"), tuple) or not domain["evidence_refs"]):
            missing.add("current_closed_state_action_domain")
            return None
        refs = domain.get("action_refs")
        if (not isinstance(refs, tuple) or len(set(refs)) != len(refs)
                or any(ref not in value.action_refs for ref in refs)
                or domain.get("model_ref") != states[state_id].model_ref):
            missing.add("state_action_domain_model_and_command_vocabulary")
            contradictory = True
            return None
        legal_actions[state_id] = refs
        return refs

    def successors(state_id, action):
        key = state_id + "|" + action
        rows = packet_index.get((state_id, action), ())
        domain = value.response_domains.get(key)
        if domain is None and value.deterministic_response_ref is not None:
            domain = FrozenMap({"complete": True, "response_refs": (value.deterministic_response_ref,)})
        if domain is None or not isinstance(domain, FrozenMap) or domain.get("complete") is not True:
            missing.add("unclosed_response_domain")
            requested[key] = FrozenMap({"state": states[state_id].state,
                "model_ref": states[state_id].model_ref, "action_ref": action,
                "parent_request_ref": value.request.request_ref, "mode": "STEP"})
            return None
        required = domain.get("response_refs")
        if not isinstance(required, tuple):
            missing.add("response_domain_members")
            return None
        if not required and state_id not in terminal:
            # A nonterminal universal leaf is never proved by all([]).
            missing.add("nonterminal_empty_response_domain")
            return None
        actual = {packet.response_ref for packet in rows}
        if actual != set(required):
            missing.add("missing_step_response")
            requested[key] = FrozenMap({"state": states[state_id].state,
                "model_ref": states[state_id].model_ref, "action_ref": action,
                "response_refs": tuple(ref for ref in required if ref not in actual),
                "parent_request_ref": value.request.request_ref, "mode": "STEP"})
            return None
        return tuple(rows)

    heuristic = {}
    heuristic_verified = False
    if value.route_algorithm_ref == "ASTAR":
        if (value.request.mode != "ROUTE" or not value.closed_domain or not value.lower_bound_evidence_refs
                or value.request.immutable_inputs.get("route_algorithm_ref") != "ASTAR"
                or value.request.immutable_inputs.get("admissible_lower_bound_digest") != stable_digest((
                    value.admissible_lower_bounds, value.lower_bound_evidence_refs))
                or set(value.admissible_lower_bounds) != set(states)):
            missing.add("current_full_admissible_lower_bound_contract")
        elif any(type(value.admissible_lower_bounds[key]) is not int or value.admissible_lower_bounds[key] < 0
                for key in sorted(value.admissible_lower_bounds)):
            missing.add("nonnegative_integer_lower_bound_domain")
        else:
            heuristic = dict(value.admissible_lower_bounds)
            if any(heuristic[key] != 0 for key in sorted(accepting) if key in heuristic):
                missing.add("lower_bound_goal_must_be_zero")
            # Complete deterministic edge coverage plus Bellman inequalities
            # gives an inductive lower bound for every goal-reaching word.
            # Unknown edges cannot inherit a guessed zero or a proof label.
            for state_id in sorted(states):
                if state_id in terminal or missing or bounded:
                    continue
                for action in actions_for_state(state_id) or ():
                    if examined >= bounds.get("max_candidates", 0):
                        bounded = True
                        break
                    examined += 1
                    rows = successors(state_id, action)
                    if rows is None:
                        continue
                    if len(rows) != 1:
                        missing.add("astar_response_domain_not_deterministic")
                        continue
                    packet = rows[0]
                    following = full_search_state_key(SearchStateC(state=packet.after, model_ref=packet.model_ref))
                    if heuristic[state_id] > packet.cost + heuristic[following]:
                        missing.add("lower_bound_bellman_inequality_failed")
            heuristic_verified = not (missing or bounded or contradictory)
    context_digest = search_context_digest(value)
    if value.continuation and value.continuation.get("context_digest") != context_digest:
        contradictory = True
        missing.add("stale_search_continuation")
    checkpoint = value.route_checkpoint
    certificate_packet_digests = tuple((packet.request.request_ref, stable_digest(packet)) for packet in value.packets)
    packet_digests = dict(certificate_packet_digests)
    if checkpoint is not None:
        if checkpoint.context_digest != context_digest:
            contradictory = True
            missing.add("stale_route_checkpoint")
        if any(ref not in packet_digests or checkpoint.packet_digests[ref] != packet_digests[ref]
                for ref in checkpoint.packet_digests):
            contradictory = True
            missing.add("changed_or_missing_consumed_step")
    retained_checkpoint = checkpoint if checkpoint is not None and not contradictory else None
    witnesses = list(retained_checkpoint.root_witnesses) if retained_checkpoint is not None else []
    explored = retained_checkpoint.expansion_count if retained_checkpoint is not None else 0
    frontier = [(node.priority,node.cost,node.depth,node.serial,node.state_key,node.word,node.root_action_ref)
        for node in retained_checkpoint.frontier] if retained_checkpoint is not None else []
    route_checkpoint = retained_checkpoint
    mode = value.request.mode
    if not contradictory and not bounded and not missing and mode == "ROUTE":
        if len(value.initial_states) != 1:
            missing.add("route_requires_one_initial_state")
        else:
            start = full_search_state_key(value.initial_states[0])
            serial = 0
            frontier = [(heuristic.get(start, 0), 0, 0, serial, start, (), None)]
            best = {(start, None): 0}
            root_witnesses = set()
            completed_actions = set()
            expanded_states = set()
            if checkpoint is not None:
                frontier = [(node.cost+heuristic.get(node.state_key, 0), node.cost, node.depth, node.serial, node.state_key, node.word, node.root_action_ref)
                    for node in checkpoint.frontier]
                best = {(state_key, root): cost for state_key, root, cost in checkpoint.best_cost_records}
                completed_actions = set(checkpoint.completed_action_records)
                expanded_states = set(checkpoint.expanded_state_records)
                witnesses = list(checkpoint.root_witnesses)
                root_witnesses = {witness.root_action_ref for witness in witnesses}
                serial = checkpoint.next_serial
                explored = checkpoint.expansion_count
            pending_nodes = []
            requested_parent_costs = {}
            def route_key(state_key, root_ref):
                return state_key, None if single_witness else root_ref
            while frontier:
                node = heappop(frontier)
                _, cost, depth, _, current, word, root = node
                if cost != best.get(route_key(current, root)):
                    continue
                if current not in states:
                    contradictory = True
                    missing.add("checkpoint_state_not_in_exact_step_domain")
                    break
                if single_witness and witnesses and cost >= witnesses[0].cost:
                    heappush(frontier, node)
                    break
                # An unanswered lower-cost state is a Dijkstra frontier, not
                # permission to spend the work bound on more costly states.
                if single_witness and pending_nodes and cost > min(row[1] for row in pending_nodes):
                    heappush(frontier, node)
                    break
                if route_key(current, root) not in expanded_states:
                    if explored >= bounds["max_states"]:
                        bounded = True
                        serial += 1
                        heappush(frontier, (cost+heuristic.get(current, 0), cost, depth, serial, current, word, root))
                        break
                    explored += 1
                    expanded_states.add(route_key(current, root))
                if current in accepting:
                    candidate_witness = SearchWitnessC(root_action_ref=root, word=word, cost=cost)
                    if single_witness:
                        if not witnesses or cost < witnesses[0].cost:
                            witnesses = [candidate_witness]
                        continue
                    existing_index = next((index for index, witness in enumerate(witnesses)
                        if witness.root_action_ref == root), None)
                    if existing_index is not None:
                        if cost < witnesses[existing_index].cost:
                            witnesses[existing_index] = candidate_witness
                    elif len(witnesses) < 3:
                        root_witnesses.add(root)
                        witnesses.append(candidate_witness)
                    else:
                        worst = max(range(len(witnesses)), key=lambda index: witnesses[index].cost)
                        if cost < witnesses[worst].cost:
                            root_witnesses.discard(witnesses[worst].root_action_ref)
                            root_witnesses.add(root)
                            witnesses[worst] = candidate_witness
                    witnesses.sort(key=lambda witness: witness.cost)
                    continue
                if current in terminal:
                    continue
                if depth >= bounds["max_depth"]:
                    bounded = True
                    continue
                available_actions = actions_for_state(current)
                pending_here = available_actions is None
                for action in available_actions or ():
                    action_record = (current, None if single_witness else root, cost, action)
                    if action_record in completed_actions:
                        continue
                    rows = successors(current, action)
                    if rows is None:
                        pending_here = True
                        if single_witness:
                            requested_parent_costs[current+'|'+action] = cost
                        continue
                    if len(rows) != 1:
                        missing.add("route_successor_not_deterministic")
                        continue
                    completed_actions.add(action_record)
                    packet = rows[0]
                    if packet.request.request_ref in unsafe_requests:
                        continue
                    following = full_search_state_key(SearchStateC(state=packet.after, model_ref=packet.model_ref))
                    first = root or action
                    candidate = cost + packet.cost
                    key = route_key(following, first)
                    if key not in best or candidate < best[key]:
                        best[key] = candidate
                        serial += 1
                        if single_witness and following in accepting:
                            if not witnesses or candidate < witnesses[0].cost:
                                witnesses = [SearchWitnessC(root_action_ref=first, word=word+(action,), cost=candidate)]
                        else:
                            heappush(frontier, (candidate+heuristic.get(following, 0), candidate, depth+1, serial, following, word+(action,), first))
                if pending_here:
                    serial += 1
                    pending_nodes.append((cost+heuristic.get(current, 0), cost, depth, serial, current, word, root))
            frontier.extend(pending_nodes)
            frontier.sort()
            if single_witness and witnesses:
                goal_cost = witnesses[0].cost
                requested = {key:row for key,row in sorted(requested.items())
                    if requested_parent_costs.get(key, 0) < goal_cost}
                first_shortest_settled = (not bounded and not contradictory and not requested
                    and all(row[1] >= goal_cost for row in frontier))
                if first_shortest_settled:
                    missing.discard('missing_step_response')
                    missing.discard('unclosed_response_domain')
            route_checkpoint = RouteCheckpointC(context_digest=context_digest,
                packet_digests=FrozenMap(packet_digests),
                frontier=tuple(RouteFrontierNodeC(priority=row[0], cost=row[1], depth=row[2], serial=row[3],
                    state_key=row[4], word=row[5], root_action_ref=row[6]) for row in frontier),
                best_cost_records=tuple((key[0], key[1], best[key])
                    for key in sorted(best, key=lambda key: (key[0], key[1] or ""))),
                completed_action_records=tuple(sorted(completed_actions,
                    key=lambda row: (row[0], row[1] or "", row[2], row[3]))),
                expanded_state_records=tuple(sorted(expanded_states, key=lambda row: (row[0], row[1] or ""))),
                root_witnesses=tuple(witnesses), next_serial=serial, expansion_count=explored)
    elif not contradictory and not bounded and not missing and mode in ("POLICY", "BELIEF"):
        if value.controllable_quantifier != "EXISTS" or value.response_quantifier != "FORALL":
            missing.add("explicit_existential_universal_quantifiers")
        elif mode == "POLICY" and len(value.initial_states) != 1:
            missing.add("policy_requires_one_initial_state")
        else:
            memo = {}
            visiting = set()

            def solve(belief, depth):
                nonlocal explored, bounded
                if not belief:
                    missing.add("empty_retained_belief")
                    return None
                if all(state in accepting for state in belief):
                    return 0, FrozenMap(), ()
                if any(state in terminal and state not in accepting for state in belief):
                    return None
                key = belief, depth
                if key in memo:
                    return memo[key]
                if depth >= bounds["max_depth"] or explored >= bounds["max_states"]:
                    bounded = True
                    return None
                if belief in visiting:
                    return None
                visiting.add(belief)
                explored += 1
                options = []
                belief_domains = tuple(actions_for_state(current) for current in belief)
                if any(domain is None for domain in belief_domains):
                    visiting.remove(belief)
                    return None
                for action in value.action_refs:
                    if any(action not in domain for domain in belief_domains):
                        continue
                    partitions, responses, immediate_costs = {}, [], {}
                    incomplete = False
                    for current in belief:
                        rows = successors(current, action)
                        if rows is None:
                            incomplete = True
                            break
                        for packet in rows:
                            if packet.request.request_ref in unsafe_requests:
                                incomplete = True
                                break
                            following = full_search_state_key(SearchStateC(state=packet.after, model_ref=packet.model_ref))
                            observation = value.state_observations.get(following)
                            if observation is None:
                                missing.add("unknown_observation_partition")
                                incomplete = True
                                break
                            partitions.setdefault(observation, set()).add(following)
                            responses.append(packet.response_ref)
                            immediate_costs.setdefault(observation, []).append(packet.cost)
                    if incomplete or not responses:
                        continue
                    branch_costs, branch_maps = [], {}
                    covered = set(responses)
                    for observation, members in sorted(partitions.items()):
                        child = solve(tuple(sorted(members)), depth+1)
                        if child is None:
                            incomplete = True
                            break
                        branch_costs.append(max(immediate_costs[observation])+child[0])
                        branch_maps[observation] = child[1]
                        covered.update(child[2])
                    if not incomplete:
                        options.append((max(branch_costs), action,
                            FrozenMap({"action_ref": action, "observations": FrozenMap(branch_maps)}),
                            tuple(sorted(ref for ref in covered if ref is not None))))
                visiting.remove(belief)
                # Deterministic minimax on the complete supplied domain. No beam
                # or favorable reply is allowed to close a universal obligation.
                best_option = min(options, key=lambda row: row[0]) if options else None
                memo[key] = None if best_option is None else (best_option[0], best_option[2], best_option[3])
                return memo[key]

            initial = tuple(sorted(full_search_state_key(state) for state in value.initial_states))
            if any(value.state_observations.get(state) is None for state in initial):
                missing.add("initial_observation_partition")
            else:
                initial_observations = {value.state_observations[state] for state in initial}
                if len(initial_observations) != 1:
                    missing.add("root_belief_is_not_one_observation_partition")
                else:
                    solution = solve(initial, 0)
                    if solution is not None:
                        action = solution[1].get("action_ref")
                        witnesses.append(SearchWitnessC(root_action_ref=action,
                            word=() if action is None else (action,), cost=solution[0],
                            policy=solution[1], covered_response_refs=solution[2]))
    elif mode not in ('ROUTE','POLICY','BELIEF'):
        missing.add("unsupported_request_mode")
    if not value.closed_domain:
        missing.add("declared_domain_not_closed")
    if value.declared_domain_size is None:
        missing.add("named_finite_domain_size")
    else:
        declared_size = sum(len(domain.get("response_refs", ()))
            for _,domain in sorted(value.response_domains.items()) if isinstance(domain, FrozenMap))
        if declared_size != value.declared_domain_size or len(response_index) > declared_size:
            contradictory = True
            missing.add("declared_domain_cardinality_mismatch")
    complete = not (bounded or contradictory or missing)
    # Incomplete universal coverage never returns an executable prefix. ROUTE
    # also stays a calculation result until DRM/SRC authorizes engagement.
    prefix = witnesses[0].word if witnesses and complete else ()
    continuation = FrozenMap({"context_digest": context_digest,
        "pending_steps": tuple(requested[key] for key in sorted(requested)),
        "unexpanded_state_refs": tuple(row[4] for row in frontier),
        "examined_count": examined, "explored_state_count": explored,
        "route_checkpoint": route_checkpoint_payload(route_checkpoint)})
    return SearchResultC(request=value.request, witnesses=tuple(witnesses), current_prefix=prefix,
        complete=complete, bounded=bounded, contradictory=contradictory,
        examined_count=len(response_index), declared_domain_size=value.declared_domain_size,
        missing_refs=tuple(sorted(missing)),
        requested_steps=tuple(requested[key] for key in sorted(requested)), continuation=continuation,
        route_checkpoint=route_checkpoint,
        facts=FrozenMap({"complete": complete, "bounded": bounded, "contradictory": contradictory,
            "certificate_input_digest": stable_digest((context_digest, certificate_packet_digests)),
            "search_objective": objective.facts,
            "missing_measurement": bool(missing), "witness_count": len(witnesses),
            "candidate_evaluation_count": examined,
            "route_algorithm_ref": value.route_algorithm_ref, "admissible_lower_bound_verified": heuristic_verified and complete,
            "route_witness_policy_ref": value.route_witness_policy_ref,
            "first_shortest_witness_settled": first_shortest_settled,
            "first_shortest_cost": witnesses[0].cost if first_shortest_settled else None,
            "explored_state_count": explored, "named_domain_exhausted": complete and not witnesses}))
