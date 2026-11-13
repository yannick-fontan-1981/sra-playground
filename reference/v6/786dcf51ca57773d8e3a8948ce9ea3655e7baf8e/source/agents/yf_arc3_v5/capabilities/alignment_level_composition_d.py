"""Exact full-level native domain projection into existing C policy search; no new solver."""
from .mechanical_common_contracts_c import SearchStateC, ExternalPrimitivePacketC, MechanicalEventC
from .mechanical_search_c import full_search_state_key, search_complete_step_domain
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_family_contracts_d import d_map, DComputationInterrupted
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _charge_structure(value, budget, frontier):
    pending = [value]
    while pending:
        item = pending.pop()
        budget.visit(frontier)
        if isinstance(item, FrozenMap):
            pending.extend(item[key] for key in reversed(sorted(item)))
        elif isinstance(item, tuple):
            pending.extend(reversed(item))


def compose_alignment_level_domain(request, budget):
    from .finite_alignment_game import AlignmentInput, AlignmentState, AlignmentPrerequisite, _state, _scope, _external
    contract = request.level_composition
    if contract is None or not request.models or request.state is None:
        raise AlignmentPrerequisite('SOURCE_LEVEL_COMPOSITION_QUERY_MODELS_AND_STATE_MISSING')
    if request.mode_ref == 'SEARCH' and contract.origin_ref != 'EXTERNAL_ROOT_QUESTION':
        raise AlignmentPrerequisite('INTERNAL_SUCCESSOR_CANNOT_RECURSIVELY_OPEN_COMMON_POLICY_SEARCH')
    query, identity = contract.query_template, contract.query_template.request
    if (identity.caller_ref != request.scope.caller_ref or identity.parent_contribution_ref != request.scope.parent_contribution_ref
            or identity.epoch != request.scope.epoch or identity.input_revision_ref != request.scope.evidence_revision_ref):
        raise AlignmentPrerequisite('LEVEL_COMPOSITION_PARENT_SCOPE_NOT_CURRENT')
    if identity.mode not in ('POLICY', 'BELIEF') or query.controllable_quantifier != 'EXISTS' or query.response_quantifier != 'FORALL':
        raise AlignmentPrerequisite('SOURCE_UNIVERSAL_LEVEL_POLICY_QUANTIFIERS_REQUIRED')
    if identity.requested_domain_ref is None:
        raise AlignmentPrerequisite('SOURCE_NAMED_LEVEL_COMMAND_DOMAIN_REQUIRED')
    if query.packets or query.response_domains or query.state_action_domains or query.terminal_states or query.accepting_states or query.continuation or query.route_checkpoint:
        raise AlignmentPrerequisite('LEVEL_DOMAIN_TEMPLATE_HAS_STALE_EXECUTABLE_STATE')
    model_refs = tuple(model.model_ref for model in request.models)
    if len(set(model_refs)) != len(model_refs) or set(query.retained_model_refs) != set(model_refs):
        raise AlignmentPrerequisite('LEVEL_COMPOSITION_RETAINED_MODEL_COVERAGE_MISMATCH')
    if identity.mode == 'POLICY' and len(model_refs) != 1:
        raise AlignmentPrerequisite('MULTIPLE_RETAINED_MODELS_REQUIRE_SOURCE_BELIEF_POLICY')
    if (query.packet_acceptance_contract_ref is None
            or identity.immutable_inputs.get('packet_acceptance_contract_ref') != query.packet_acceptance_contract_ref
            or set(query.packet_acceptance_model_refs) != set(model_refs)):
        raise AlignmentPrerequisite('CURRENT_SOURCE_QUOTA_ACCEPTANCE_CONTRACT_MISSING')
    commands = {command.command_ref: command for command in contract.commands}
    if len(commands) != len(contract.commands) or set(query.action_refs) != set(commands):
        raise AlignmentPrerequisite('SOURCE_COMMAND_VOCABULARY_NOT_EXACT')
    if len({(command.kind_ref, command.board_ref, command.cell) for command in contract.commands}) != len(commands):
        raise AlignmentPrerequisite('DISTINCT_COMMAND_REFS_ALIAS_THE_SAME_PLACEMENT')
    phase_by_ref = {phase.phase_ref: phase for phase in contract.phases}
    if len(phase_by_ref) != len(contract.phases):
        raise AlignmentPrerequisite('SOURCE_NATIVE_PHASE_BINDINGS_NOT_UNIQUE')
    initial = tuple(SearchStateC(state=d_map(request.state), model_ref=ref) for ref in model_refs)
    if query.initial_states and query.initial_states != initial:
        raise AlignmentPrerequisite('LEVEL_COMPOSITION_INITIAL_STATE_NOT_CURRENT')
    fields = tuple(AlignmentState.model_fields)
    if len(set(contract.observation_fields)) != len(contract.observation_fields) or not set(contract.observation_fields) <= set(fields):
        raise AlignmentPrerequisite('SOURCE_OBSERVATION_FIELD_DOMAIN_INVALID')
    bounds = identity.actual_bounds
    if any(name not in bounds for name in ('max_states', 'max_candidates', 'max_depth', 'max_events', 'max_primitives')):
        raise AlignmentPrerequisite('SOURCE_COMMON_SEARCH_WORK_BOUNDS_MISSING')
    state_limit = min(request.domain_bound, bounds['max_states'])
    packet_limit = min(65536, bounds['max_candidates'])
    models = {model.model_ref: model for model in request.models}
    templates = {}
    for model_ref in model_refs:
        matches = tuple(binding.request for binding in contract.step_templates if binding.model_ref == model_ref
            and binding.request.mode == 'STEP' and packet_context_equal(identity, binding.request, model_ref))
        if len(matches) != 1:
            raise AlignmentPrerequisite('EXACT_MODEL_STEP_TEMPLATE_NOT_UNIQUE')
        templates[model_ref] = matches[0]
    nodes = {full_search_state_key(state): state for state in initial}
    pending, cursor, packets, terminals, accepting = list(nodes), 0, [], {}, {}
    action_domains, response_domains, observations = {}, {}, {}
    while cursor < len(pending):
        if len(nodes) > state_limit:
            raise DComputationInterrupted('ALIGNMENT_LEVEL_STATE_DOMAIN_BOUND', d_map({'next_state_index': cursor, 'retained_state_count': len(nodes)}))
        key = pending[cursor]
        current = nodes[key]
        _charge_structure(current.state, budget, {'level_state_ref': key, 'work_ref': 'state_key_and_observation'})
        state, model = AlignmentState.model_validate(current.state), models[current.model_ref]
        budget.visit({'level_state_ref': key, 'model_ref': model.model_ref})
        boards, _ = _state(model, state, budget)
        observations[key] = stable_digest(tuple((name, current.state[name]) for name in contract.observation_fields))
        if state.terminated:
            terminals[key] = current
            cursor += 1
            continue
        scope = _scope(model, state, budget)
        legal = []
        for command_ref in query.action_refs:
            command = commands[command_ref]
            budget.visit({'level_state_ref': key, 'command_ref': command_ref})
            if command.kind_ref == 'place':
                if command.board_ref != state.active_board_ref or command.cell not in scope['playable_cells']:
                    continue
                primitive = AlignmentInput(kind_ref='place', board_ref=command.board_ref,
                    board_epoch_ref=boards[command.board_ref].epoch_ref, cell=command.cell)
            else:
                if command.board_ref is not None or command.cell is not None:
                    raise AlignmentPrerequisite('RESET_COMMAND_HAS_UNBOUND_PLACEMENT_FIELDS')
                primitive = AlignmentInput(kind_ref='reset')
            legal.append(command_ref)
            image = _external(model, state, primitive, request, budget)
            if image.get('reply_domain_complete') is not True or not image['responses']:
                raise AlignmentPrerequisite('COMPLETE_NATIVE_LEVEL_RESPONSE_DOMAIN_MISSING')
            response_refs = []
            template = templates[model.model_ref]
            child_inputs = FrozenMap.overlay(template.immutable_inputs, {'state': current.state,
                'primitive': d_map(primitive), 'action_ref': command_ref})
            child = template.model_copy(update={'request_ref': stable_digest((template.request_ref, key, command_ref)),
                'immutable_inputs': child_inputs})
            for ordinal, response in enumerate(image['responses']):
                if len(packets) >= packet_limit:
                    raise DComputationInterrupted('ALIGNMENT_LEVEL_PACKET_DOMAIN_BOUND', d_map({'next_state_index': cursor, 'command_ref': command_ref, 'reply_index': ordinal}))
                budget.visit({'level_state_ref': key, 'command_ref': command_ref, 'reply_index': ordinal})
                after = SearchStateC(state=response['state'], model_ref=model.model_ref)
                after_key = full_search_state_key(after)
                response_ref = stable_digest((child.request_ref, ordinal, response.get('opponent_cell'), after_key))
                response_refs.append(response_ref)
                names = ('actual_reset_protocol',) if command.kind_ref == 'reset' else (
                    'after_player', 'after_opponent', 'after_access_effects', 'after_cost_and_quota')
                events, snapshots, previous = [], {}, current.state
                for tick, name in enumerate(names):
                    if name not in phase_by_ref or name not in response['phase_snapshots']:
                        raise AlignmentPrerequisite('SOURCE_COMPLETE_NATIVE_PHASE_PROJECTION_MISSING')
                    phase, following = phase_by_ref[name], response['phase_snapshots'][name]
                    snapshot_ref = stable_digest((response_ref, name, 'snapshot'))
                    occurrence_ref = stable_digest((response_ref, name, 'occurrence'))
                    snapshot = current.state if phase.snapshot_kind == 'PRE_COMMAND' else previous
                    snapshots[snapshot_ref] = snapshot
                    writes = {}
                    for field in fields:
                        budget.visit({'level_phase_ref': name, 'state_field': field})
                        _charge_structure(previous[field], budget, {'level_phase_ref': name, 'state_field': field})
                        _charge_structure(following[field], budget, {'level_phase_ref': name, 'state_field': field})
                        if previous[field] != following[field]:
                            writes[field] = following[field]
                    events.append(MechanicalEventC(occurrence_ref=occurrence_ref, producer_ref=phase.producer_ref,
                        kind_ref=phase.kind_ref, clock_ref=phase.clock_ref, tick=tick,
                        temporal_scope_ref=phase.temporal_scope_ref, snapshot_ref=snapshot_ref,
                        snapshot_kind=phase.snapshot_kind, reads=FrozenMap(), writes=FrozenMap(writes),
                        predecessor_refs=(events[-1].occurrence_ref,) if events else ()))
                    previous = following
                if previous != after.state or response.get('primitive_complete') is not True:
                    raise AlignmentPrerequisite('NATIVE_PHASES_DO_NOT_CLOSE_THE_COMPLETE_LEVEL_PRIMITIVE')
                packet = ExternalPrimitivePacketC(request=child, parent_request=identity, model_ref=model.model_ref,
                    action_ref=command.action_ref, primitive_ref=command_ref, before=current.state, after=after.state,
                    events=tuple(events), snapshots=FrozenMap(snapshots), closure_domain_ref=contract.closure_domain_ref,
                    closure_stop_ref=contract.closure_stop_ref, complete=True,
                    cost=response['event_ledger']['debit'], terminal=bool(after.state['terminated']),
                    acceptance=response['event_ledger']['accepted'],
                    source_goal_acceptance_contract_ref=query.packet_acceptance_contract_ref,
                    response_ref=response_ref, observation_ref=stable_digest(tuple((name, after.state[name]) for name in contract.observation_fields)))
                packets.append(packet)
                if after.state['terminated']:
                    terminals[after_key] = after
                if response['event_ledger']['accepted']:
                    accepting[after_key] = after
                if after_key not in nodes:
                    nodes[after_key] = after
                    pending.append(after_key)
            response_domains[key + '|' + command_ref] = FrozenMap({'complete': True, 'response_refs': tuple(response_refs)})
        action_domains[key] = FrozenMap({'complete': True, 'action_refs': tuple(legal),
            'model_ref': model.model_ref, 'evidence_refs': contract.evidence_refs})
        cursor += 1
    domain_map = FrozenMap(action_domains)
    parent = identity.model_copy(update={'immutable_inputs': FrozenMap.overlay(identity.immutable_inputs,
        {'state_action_domains_digest': stable_digest(domain_map)})})
    packets = tuple(packet.model_copy(update={'parent_request': parent}) for packet in packets)
    composed = query.model_copy(update={'request': parent, 'initial_states': initial, 'packets': packets,
        'terminal_states': tuple(terminals[key] for key in sorted(terminals)),
        'accepting_states': tuple(accepting[key] for key in sorted(accepting)),
        'state_observations': FrozenMap(observations), 'state_action_domains': domain_map,
        'response_domains': FrozenMap(response_domains), 'closed_domain': True,
        'declared_domain_size': len(packets)})
    values = {'common_search_query': composed, 'state_count': len(nodes), 'packet_count': len(packets),
        'full_level_transition_domain_complete_in_source_command_scope': True,
        'requested_command_domain_ref': identity.requested_domain_ref, 'common_search_invoked': False,
        'source_composition_origin_ref': contract.origin_ref,
        'native_input_or_goal_release_authorized': False}
    if request.mode_ref == 'SEARCH':
        result = search_complete_step_domain(composed)
        values.update({'common_search_result': result, 'common_search_invoked': True,
            'common_receipt_and_source_release_still_required': True})
        if result.bounded:
            return values, 'BOUND_REACHED', 'COMMON_POLICY_COMPUTATION_BOUND'
        if result.contradictory or result.missing_refs:
            return values, 'NEEDS_EVIDENCE', 'COMMON_POLICY_CURRENT_SCOPE_OR_COVERAGE_MISSING'
    return values, 'OK', 'EXACT_FULL_LEVEL_NATIVE_DOMAIN_AND_REQUESTED_COMMON_POLICY'
