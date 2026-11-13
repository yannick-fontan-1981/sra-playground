"""Bounded finite quotient verification and exact word expansion, never native calls."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .mechanical_event_composition_c import packet_context_equal, predicate_value
from .mechanical_simulation_c import fold_mechanical_path
from .macro_expansion_contracts_c import (MacroExpansionInputC, MacroExpansionFactsC,
    MacroExpansionReturnInputC, MacroExpansionReturnC)


def measure_macro_expansion(value: MacroExpansionInputC) -> MacroExpansionFactsC:
    definition, request = value.definition, value.request
    missing, checked, expansions = set(), [], []
    counters = {key: 0 for key in ("max_candidates", "max_primitives", "max_events", "max_state_visits", "max_word_primitives")}
    bounded = False
    bounds = request.actual_bounds
    required = (*counters, "max_states", "max_depth", "max_macro_depth")
    missing.update(key for key in required if key not in bounds)

    def charge(key, count=1):
        nonlocal bounded
        if counters[key] + count > bounds.get(key, 0):
            bounded = True
            return False
        counters[key] += count
        return True

    def changes_allowed(before, after):
        stack = [((), before, after)]
        while stack:
            path, left, right = stack.pop()
            if not charge("max_state_visits"):
                return False
            if left is right:
                continue
            if path in definition.motion_paths:
                if isinstance(left, FrozenMap) or isinstance(right, FrozenMap):
                    return False
                if isinstance(left, tuple) and any(isinstance(x, (FrozenMap, tuple)) for x in left):
                    return False
                if isinstance(right, tuple) and any(isinstance(x, (FrozenMap, tuple)) for x in right):
                    return False
                continue
            if isinstance(left, FrozenMap) and isinstance(right, FrozenMap):
                if set(left) != set(right):
                    return False
                stack.extend((path+(key,), left[key], right[key]) for key in reversed(sorted(left)))
            elif isinstance(left, tuple) and isinstance(right, tuple):
                if len(left) != len(right):
                    return False
                stack.extend((path+(index,), left[index], right[index]) for index in range(len(left)-1, -1, -1))
            elif type(left) is not type(right) or left != right:
                return False
        return True

    if (request.mode != "COMPILE" or request.kernel_ref != "mechanics.bounded_route_search"
            or request.operation_ref != "mechanics.bounded_route_search.certified_macro_expansion"
            or request.expected_return_type != "MacroExpansionReturnC"
            or not definition.evidence_refs
            or not definition.member_domain_complete or not definition.transition_domain_complete
            or not definition.predicate_domain_complete
            or request.immutable_inputs.get("macro_definition_digest") != stable_digest(immutable_json_data(definition))
            or request.immutable_inputs.get("cost_metric_ref") != definition.cost_metric_ref
            or request.immutable_inputs.get("retained_model_refs") != value.retained_model_refs
            or request.immutable_inputs.get("initial_member_refs") != value.initial_member_refs
            or request.immutable_inputs.get("macro_witness_digest") != stable_digest(immutable_json_data(value.witness))):
        missing.add("current_complete_macro_contract")
    if len(definition.members) > bounds.get("max_states", 0):
        bounded = True
    if len(set(definition.macro_refs)) != len(definition.macro_refs):
        missing.add("duplicate_macro_ref")
    if any(not path for path in definition.motion_paths):
        missing.add("whole_state_is_not_a_motion_field")
    members, state_keys, signatures, accepting, classes = {}, set(), {}, {}, {}
    all_predicates = (*definition.relevant_predicates, *definition.acceptance_predicates)
    for member in definition.members:
        if missing or bounded:
            break
        if not charge("max_candidates"):
            break
        state_key = stable_digest((member.underlying.model_ref, member.underlying.state))
        if member.member_ref in members or state_key in state_keys:
            missing.add("duplicate_full_macro_member")
            break
        if not charge("max_candidates", len(all_predicates)):
            break
        values = tuple(predicate_value(predicate, member.underlying.state) for predicate in all_predicates)
        if any(item is None for item in values):
            missing.add("unknown_macro_successor_predicate")
            break
        signature = values
        prior = signatures.get(member.abstract_state_ref)
        if prior is not None and prior != signature:
            missing.add("quotient_loses_relevant_successor_predicate")
            break
        signatures[member.abstract_state_ref] = signature
        members[member.member_ref] = member
        state_keys.add(state_key)
        classes.setdefault(member.abstract_state_ref, []).append(member.member_ref)
        accepting[member.member_ref] = all(values[-len(definition.acceptance_predicates):])
    edge_index, seen_responses, consequences, payload_words = {}, set(), {}, {}
    for edge in definition.edges:
        if missing or bounded:
            break
        if not charge("max_candidates"):
            break
        key = edge.member_ref, edge.macro_ref
        before, after = members.get(edge.member_ref), members.get(edge.successor_member_ref)
        path = edge.primitive_path
        response_key = (*key, edge.response_ref)
        if (response_key in seen_responses or before is None or after is None or edge.macro_ref not in definition.macro_refs
                or before.underlying.model_ref != after.underlying.model_ref
                or path.initial != before.underlying.state or path.request.mode != "PATH"
                or not packet_context_equal(request, path.request, before.underlying.model_ref)
                or path.request.immutable_inputs.get("cost_metric_ref") != definition.cost_metric_ref
                or path.predicates != definition.trace_predicates
                or len(path.packets) != len(path.word)):
            missing.add("exact_macro_edge_path_identity")
            break
        if not charge("max_primitives", len(path.packets)):
            break
        payload_word = []
        for packet in path.packets:
            if not charge("max_events", len(packet.events)):
                break
            if packet.request.immutable_inputs.get("cost_metric_ref") != definition.cost_metric_ref:
                missing.add("macro_primitive_cost_metric")
                break
            payload = packet.request.immutable_inputs.get(definition.primitive_payload_input_ref)
            if payload is None:
                missing.add("macro_primitive_payload_not_bound")
                break
            payload_word.append(FrozenMap({"action_ref": packet.action_ref,
                "primitive_ref": packet.primitive_ref, "payload": payload}))
        if missing or bounded:
            break
        receipt = fold_mechanical_path(path)
        if (not receipt.complete or receipt.bounded or receipt.contradictory or receipt.missing_refs
                or receipt.failed_predicate_refs or receipt.packet_cursor != len(path.word)
                or receipt.state != after.underlying.state or receipt.cost != edge.cost):
            missing.add("macro_primitive_expansion_not_verified")
            break
        if definition.event_free_walk:
            for before_state, after_state in zip(receipt.states, receipt.states[1:]):
                if not changes_allowed(before_state, after_state):
                    missing.add("event_free_walk_changes_hidden_process")
                    break
            if missing or bounded:
                break
        consequence = (after.abstract_state_ref, edge.cost, signatures[after.abstract_state_ref],
            receipt.interruption_ref, after.observation_ref)
        if key in payload_words and payload_words[key] != tuple(payload_word):
            missing.add("intrinsic_macro_responses_need_intermediate_payload_observation")
            break
        payload_words[key] = tuple(payload_word)
        consequences.setdefault(key, set()).add(consequence)
        edge_index.setdefault(key, []).append(edge)
        seen_responses.add(response_key)
        checked.append(response_key)
    quotient_edges = {}
    for member_ref in sorted(members):
        if missing or bounded:
            break
        if not accepting[member_ref]:
            for macro in definition.macro_refs:
                if not charge("max_candidates"):
                    break
                key = member_ref, macro
                declared = definition.response_domains.get(member_ref)
                declared = declared.get(macro) if isinstance(declared, FrozenMap) else None
                actual = tuple(edge.response_ref for edge in edge_index.get(key, ()))
                if (not isinstance(declared, tuple) or any(type(ref) is not str or not ref for ref in declared)
                        or len(set(declared)) != len(declared)
                        or len(set(actual)) != len(actual) or set(actual) != set(declared)):
                    missing.add("macro_response_domain_not_covered")
                    break
                abstract_key = members[member_ref].abstract_state_ref, macro
                consequence_set = frozenset(consequences.get(key, ()))
                if abstract_key in quotient_edges and quotient_edges[abstract_key] != consequence_set:
                    missing.add("quotient_loses_cost_successor_observation_or_interruption")
                    break
                quotient_edges[abstract_key] = consequence_set
    if len(set(value.initial_member_refs)) != len(value.initial_member_refs):
        missing.add("duplicate_initial_macro_member")
    if (len(set(value.retained_model_refs)) != len(value.retained_model_refs)
            or {members[ref].underlying.model_ref for ref in value.initial_member_refs if ref in members}
                != set(value.retained_model_refs)
            or any(members[ref].underlying.model_ref not in value.retained_model_refs for ref in sorted(members))):
        missing.add("macro_retained_model_population")
    if value.witness.policy and value.witness.word:
        missing.add("macro_policy_and_linear_word_are_distinct")
    initial_states = tuple(immutable_json_data(members[ref].underlying)
        for ref in value.initial_member_refs if ref in members)
    if request.immutable_inputs.get("initial_states") != initial_states:
        missing.add("current_full_macro_initial_states")
    expected_root = value.witness.policy.get("action_ref") if value.witness.policy else (
        value.witness.word[0] if value.witness.word else None)
    if value.witness.root_action_ref != expected_root:
        missing.add("macro_witness_root_action")
    if value.witness.policy and (any(ref not in members or members[ref].observation_ref is None
            for ref in value.initial_member_refs)
            or len({members[ref].observation_ref for ref in value.initial_member_refs if ref in members}) != 1):
        missing.add("source_macro_initial_observation_partition")
    # Traverse all responses. A label supplied by Source partitions knowledge;
    # a state hash never becomes an observation or chooses a favorable branch.
    pending, covered_initials, observable_words = [], set(), {}
    for initial in reversed(value.initial_member_refs):
        if initial not in members:
            missing.add("initial_full_macro_member")
            break
        pending.append((initial, initial, 0, value.witness.policy, (), (), 0,
            (members[initial].observation_ref,), (), ()))
    while pending and not missing and not bounded:
        if not charge("max_candidates"):
            break
        initial, current, index, node, word, packet_refs, total, history, response_refs, payloads = pending.pop()
        finished = not node if value.witness.policy else index >= len(value.witness.word)
        if finished:
            if not accepting[current]:
                missing.add("expanded_macro_witness_not_at_declared_goal")
                break
            covered_initials.add(initial)
            expansions.append(FrozenMap({"initial_member_ref": initial,
                "full_initial_state": immutable_json_data(members[initial].underlying),
                "full_final_state": immutable_json_data(members[current].underlying),
                "primitive_word": word, "primitive_request_refs": packet_refs, "cost": total,
                "primitive_payload_word": payloads,
                "source_observation_history": history, "covered_macro_response_refs": response_refs}))
            continue
        if index >= bounds.get("max_macro_depth", 0):
            bounded = True
            break
        macro = node.get("action_ref") if value.witness.policy else value.witness.word[index]
        rows = edge_index.get((current, macro), ())
        if not rows:
            missing.add("witness_macro_has_no_verified_full_state_expansion")
            break
        word_key = index, history
        payload_word = payload_words[(current, macro)]
        if word_key in observable_words and observable_words[word_key] != payload_word:
            missing.add("unobservable_macro_primitive_word_disagreement")
            break
        observable_words[word_key] = payload_word
        for edge in reversed(rows):
            if not charge("max_word_primitives", len(edge.primitive_path.word)):
                break
            if len(word) + len(edge.primitive_path.word) > bounds.get("max_depth", 0):
                bounded = True
                break
            following = edge.successor_member_ref
            observation = members[following].observation_ref
            following_node = node
            if value.witness.policy:
                branches = node.get("observations")
                if observation is None or not isinstance(branches, FrozenMap) or observation not in branches:
                    missing.add("source_macro_policy_observation_branch")
                    break
                following_node = branches[observation]
                if not isinstance(following_node, FrozenMap):
                    missing.add("source_macro_policy_node")
                    break
            pending.append((initial, following, index+1, following_node,
                word+edge.primitive_path.word,
                packet_refs+tuple(packet.request.request_ref for packet in edge.primitive_path.packets),
                total+edge.cost, history+(observation,), response_refs+(edge.response_ref,), payloads+payload_word))
    if expansions and max(item["cost"] for item in expansions) != value.witness.cost:
        missing.add("macro_witness_chosen_cost_not_preserved")
    qualified = not missing and not bounded and not pending and covered_initials == set(value.initial_member_refs)
    return MacroExpansionFactsC(facts=FrozenMap({"quotient_and_word_qualified": qualified, "bounded": bounded,
        "declared_member_count": len(definition.members), "checked_edge_count": len(checked),
        "work_counters": FrozenMap(counters)}), missing_refs=tuple(sorted(missing)),
        expansions=tuple(expansions), checked_edge_refs=tuple(checked))


def assemble_macro_expansion(value: MacroExpansionReturnInputC) -> MacroExpansionReturnC:
    return MacroExpansionReturnC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref,
        source_reason_ref=value.source_reason_ref,
        admissible_expansions=value.measured.expansions if value.source_word_admissible else ())
