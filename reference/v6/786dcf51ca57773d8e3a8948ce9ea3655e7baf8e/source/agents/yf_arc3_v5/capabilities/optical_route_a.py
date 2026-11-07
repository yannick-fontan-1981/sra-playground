"""First-impact graph construction; Source invokes the existing K09 search.

Graph nodes retain fixed relay outputs and activation history. Ray links are
abstract preparation requests, not multiple environmental shot commands.
"""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest
from .discrete_relay_optics import DiscreteOpticsRequest, OpticalRay, OpticalPrerequisite, _state, _first_hit
from .mechanical_common_contracts_c import SearchDomainInputC, SearchStateC, ExternalPrimitivePacketC, RouteCheckpointC, MechanicalEventC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .mechanical_search_c import full_search_state_key
from .mechanical_family_contracts_d import (
    DMechanicalResult, DWorkBudget, DComputationInterrupted, DResumeMismatch,
    d_validate_request, d_input_digest, d_result, d_map, d_resumable_frontier,
)


class OpticalRouteBindingA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.optical_route_binding_a.v1'
    request: DiscreteOpticsRequest
    ready: bool
    query: SearchDomainInputC | None = None
    projection_digest: Ref | None = None
    unavailable: DMechanicalResult | None = None


class OpticalRouteExtractA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.optical_route_extract_a.v1'
    binding: OpticalRouteBindingA


class OpticalRouteReturnA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.optical_route_return_a.v1'
    binding: OpticalRouteBindingA
    returned: MechanicalNormalizedReturn


def optical_geometry_projection_digest_a(request, query):
    """Independent receipt formula; exclude only the formula's own digest."""
    immutable = d_map({k: v for k, v in sorted(query.request.immutable_inputs.items())
        if k != 'optical_geometry_projection_digest'})
    identity = query.request.model_copy(update={'immutable_inputs': immutable})
    packets = tuple(p.model_copy(update={'parent_request': identity,
        'request': p.request.model_copy(update={'immutable_inputs': d_map({k: v
            for k, v in sorted(p.request.immutable_inputs.items()) if k != 'optical_geometry_projection_digest'})})})
        for p in query.packets)
    return stable_digest((request.source_identity_ref, request.scope, request.models,
        request.state, request.route_input.actions, request.route_input.cost_law_ref,
        request.route_input.terminal_contract, identity, query.initial_states,
        query.retained_model_refs, query.action_refs, packets, query.terminal_states,
        query.accepting_states, query.state_observations, query.response_domains,
        query.state_action_domains, query.closed_domain, query.declared_domain_size,
        query.predicates, query.acceptance_predicates, query.terminal_predicates,
        query.controllable_quantifier, query.response_quantifier, query.route_algorithm_ref,
        query.admissible_lower_bounds, query.lower_bound_evidence_refs))


def _route_context(request):
    route, scope = request.route_input, request.scope
    if route is None or request.state is None or not request.models or not request.source_identity_ref:
        raise DResumeMismatch('SOURCE_IDENTITY_MODELS_CURRENT_SETTINGS_AND_ROUTE_TEMPLATE_REQUIRED')
    query, contract = route.query, route.terminal_contract
    identity = query.request
    if (identity.caller_ref != scope.caller_ref or identity.parent_contribution_ref != scope.parent_contribution_ref
            or identity.epoch != scope.epoch or identity.input_revision_ref != scope.evidence_revision_ref
            or identity.immutable_inputs.get('source_identity_ref') != request.source_identity_ref
            or identity.immutable_inputs.get('parent_goal_ref') != scope.parent_goal_ref
            or identity.immutable_inputs.get('event_owner_ref') != scope.event_owner_ref
            or identity.immutable_inputs.get('model_revision_ref') != scope.model_revision_ref
            or identity.immutable_inputs.get('optical_models_digest') != stable_digest(request.models)
            or identity.immutable_inputs.get('optical_initial_state_digest') != stable_digest(request.state)
            or identity.immutable_inputs.get('optics_terminal_contract_digest') != stable_digest(contract)):
        raise DResumeMismatch('EXACT_SOURCE_GOAL_OWNER_MODELS_REVISION_AND_TERMINAL_CONTRACT_REQUIRED')
    refs = tuple(m.model_ref for m in request.models)
    if len(set(refs)) != len(refs) or set(query.retained_model_refs) != set(refs):
        raise DResumeMismatch('EXACT_UNREJECTED_OPTICAL_MODEL_DOMAIN_REQUIRED')
    if (query.initial_states or query.packets or query.state_action_domains or query.response_domains
            or query.terminal_states or query.accepting_states or query.state_observations
            or query.route_checkpoint or query.continuation or query.admissible_lower_bounds):
        raise DResumeMismatch('EMPTY_PHYSICAL_GRAPH_TEMPLATE_REQUIRED_RETAIN_GOAL_PREDICATES')
    if not query.acceptance_predicates or query.controllable_quantifier != 'EXISTS' or query.response_quantifier != 'FORALL':
        raise DResumeMismatch('SOURCE_ACCEPTANCE_PREDICATES_AND_ROUTE_QUANTIFIERS_REQUIRED')
    if any(not isinstance(identity.immutable_inputs.get(name), str) or not identity.immutable_inputs[name]
            for name in ('optical_graph_event_kind_ref', 'optical_graph_clock_ref', 'optical_graph_temporal_scope_ref')):
        raise DResumeMismatch('SOURCE_ABSTRACT_GRAPH_EVENT_CLOCK_AND_TEMPORAL_SCOPE_REQUIRED')
    if (identity.actual_bounds.get('max_states', 0) > request.domain_bound
            or identity.actual_bounds.get('max_candidates', 0) > request.node_bound
            or identity.actual_bounds.get('max_depth', 0) > request.depth_bound):
        raise DResumeMismatch('COMMON_SEARCH_ALLOCATION_EXCEEDS_PARENT')
    if contract.get('evidence_revision_ref') != scope.evidence_revision_ref:
        raise DResumeMismatch('CURRENT_TERMINAL_CONTRACT_REVISION_REQUIRED')
    terminals, activations = contract.get('terminal_by_model', {}), contract.get('required_activation_by_model', {})
    if set(terminals) != set(refs) or set(activations) != set(refs):
        raise DResumeMismatch('EXACT_PER_MODEL_TERMINAL_ACTIVATION_CONTRACT_REQUIRED')
    for model in request.models:
        if terminals[model.model_ref] != model.terminal_ref or tuple(activations[model.model_ref]) != model.required_activation_refs:
            raise DResumeMismatch('MODEL_TERMINAL_OR_ACTIVATION_CONTRADICTS_SOURCE_CONTRACT')
    return query


def prepare_optical_route_a(request: DiscreteOpticsRequest) -> OpticalRouteBindingA:
    budget = DWorkBudget(request)
    states, packets, domains, responses, terminals = [], [], {}, {}, []
    cursor = action_cursor = prior_nodes = 0
    hit_cache = {}
    phase = 'OPTICAL_GRAPH'
    def unavailable(status, cause, frontier=()):
        return OpticalRouteBindingA(request=request, ready=False,
            unavailable=d_result(request, status, cause, examined=budget.examined, frontier=frontier))
    def work():
        return {'phase': phase, 'states': tuple(states), 'packets': tuple(packets),
            'state_action_domains': domains, 'response_domains': responses, 'terminal_states': tuple(terminals),
            'state_cursor': cursor, 'action_cursor': action_cursor, 'first_hit_cache': hit_cache,
            'prior_nodes': prior_nodes + budget.examined}
    rejected = d_validate_request(request)
    if rejected is not None:
        return OpticalRouteBindingA(request=request, ready=False, unavailable=rejected)
    try:
        if request.operation_ref != 'mechanics.discrete_relay_optics.route_domain' or request.mode_ref != 'SEARCH':
            raise DResumeMismatch('EXACT_OPTICAL_ROUTE_SEARCH_SIGNATURE_REQUIRED')
        query = _route_context(request)
        models = {m.model_ref: m for m in request.models}
        actions = {(a.model_ref, a.source_body_ref, a.direction_ref): a for a in request.route_input.actions}
        if len(actions) != len(request.route_input.actions):
            raise DResumeMismatch('UNIQUE_SOURCE_DIRECTION_ACTION_COST_BINDING_REQUIRED')
        if set(actions[k].action_ref for k in sorted(actions)) != set(query.action_refs):
            raise DResumeMismatch('EXACT_ABSTRACT_RAY_ACTION_VOCABULARY_REQUIRED')
        receiver_maps, controller_maps, options = {}, {}, {}
        expected = set()
        for model in request.models:
            receivers, directions, controls, _ = _state(model, request.state, budget)
            if (model.reemission_law_ref != 'receiver_center_absolute_control_direction'
                    or model.loop_law_ref not in ('revisited_relay_stops', 'repeated_source_direction_stops')
                    or model.physical_hop_cap is None or model.required_activation_refs is None
                    or model.terminal_ref not in receivers or receivers[model.terminal_ref].kind_ref != 'TERMINAL'):
                raise OpticalPrerequisite('EXPLICIT_ABSOLUTE_REEMISSION_LOOP_HOP_AND_TERMINAL_LAWS_REQUIRED')
            controller_by_relay = {}
            for control in (controls[k] for k in sorted(controls)):
                if control.relay_ref in controller_by_relay:
                    raise OpticalPrerequisite('UNIQUE_REEMISSION_CONTROLLER_PER_RELAY_REQUIRED')
                controller_by_relay[control.relay_ref] = control
            receiver_maps[model.model_ref], controller_maps[model.model_ref] = receivers, controller_by_relay
            options[(model.model_ref, model.emitter_ref)] = (model.emitter_direction_ref,)
            expected.add((model.model_ref, model.emitter_ref, model.emitter_direction_ref))
            for receiver in (receivers[k] for k in sorted(receivers)):
                if receiver.kind_ref != 'RELAY':
                    continue
                if receiver.body_ref not in controller_by_relay:
                    raise OpticalPrerequisite('RELAY_CONTROLLER_CODEBOOK_REQUIRED')
                values = tuple(dict.fromkeys(d for _, d in controller_by_relay[receiver.body_ref].codebook))
                options[(model.model_ref, receiver.body_ref)] = values
                expected.update((model.model_ref, receiver.body_ref, d) for d in values)
        if set(actions) != expected:
            raise DResumeMismatch('EXHAUSTIVE_EMITTER_AND_RELAY_OUTPUT_ACTION_DOMAIN_REQUIRED')
        if request.resume_frontier:
            if request.resume_frontier.get('input_digest') != d_input_digest(request):
                raise DResumeMismatch('ROUTE_RESUME_SOURCE_INPUT_OR_REVISION_MISMATCH')
            saved = request.resume_frontier.get('work_frontier', {})
            if saved.get('phase') == 'OPTICAL_SEARCH':
                retained = SearchDomainInputC.model_validate(saved['query'])
                digest = optical_geometry_projection_digest_a(request, retained)
                if retained.request.immutable_inputs.get('optical_geometry_projection_digest') != digest:
                    raise DResumeMismatch('EXACT_RETAINED_PHYSICAL_GRAPH_DIGEST_REQUIRED')
                checkpoint = RouteCheckpointC.model_validate(saved['route_checkpoint']) if saved.get('route_checkpoint') is not None else None
                retained = retained.model_copy(update={'route_checkpoint': checkpoint, 'continuation': d_map(saved.get('continuation', {}))})
                return OpticalRouteBindingA(request=request, ready=True, query=retained, projection_digest=digest)
            if saved.get('phase') != phase:
                raise DResumeMismatch('OPTICAL_GRAPH_OR_SEARCH_RESUME_PHASE_REQUIRED')
            states = [SearchStateC.model_validate(x) for x in saved.get('states', ())]
            packets = [ExternalPrimitivePacketC.model_validate(x) for x in saved.get('packets', ())]
            terminals = [SearchStateC.model_validate(x) for x in saved.get('terminal_states', ())]
            domains, responses, hit_cache = dict(saved.get('state_action_domains', {})), dict(saved.get('response_domains', {})), dict(saved.get('first_hit_cache', {}))
            cursor, action_cursor, prior_nodes = saved.get('state_cursor', 0), saved.get('action_cursor', 0), saved.get('prior_nodes', 0)
            if any(type(x) is not int or x < 0 for x in (cursor, action_cursor, prior_nodes)) or cursor > len(states):
                raise DResumeMismatch('EXACT_GRAPH_CONTINUATION_CURSOR_REQUIRED')
        else:
            for model in request.models:
                states.append(SearchStateC(model_ref=model.model_ref, state=d_map({
                    'source_body_ref': model.emitter_ref, 'origin': model.emitter_origin,
                    'activated_relay_refs': (), 'target_outputs': (), 'seen_shot_keys': (),
                    'hop_count': 0, 'outcome_ref': 'CONTINUE', 'receiver_ref': None,
                    'initial_optical_state_digest': stable_digest(request.state)})))
        initial = tuple(states[:len(request.models)])
        known = {full_search_state_key(s) for s in states}
        while cursor < len(states):
            current = states[cursor]
            model, before = models[current.model_ref], current.state
            state_key = full_search_state_key(current)
            if before['outcome_ref'] != 'CONTINUE':
                domains[state_key] = d_map({'complete': True, 'action_refs': (), 'model_ref': current.model_ref,
                    'evidence_refs': (request.source_identity_ref,)})
                cursor += 1; action_cursor = 0
                continue
            if before['hop_count'] >= request.depth_bound:
                raise DComputationInterrupted('OPTICAL_GRAPH_DEPTH_BOUND', d_map())
            source = before['source_body_ref']
            bound_outputs = dict(before['target_outputs'])
            control = controller_maps[current.model_ref].get(source)
            allowed = options[(current.model_ref, source)]
            if control is not None and control.control_ref in bound_outputs:
                allowed = (bound_outputs[control.control_ref],)
            legal = tuple(actions[(current.model_ref, source, d)] for d in allowed)
            if len({a.action_ref for a in legal}) != len(legal):
                raise DResumeMismatch('DISTINCT_ACTION_REF_PER_SOURCE_OUTPUT_REQUIRED')
            domains[state_key] = d_map({'complete': True, 'action_refs': tuple(a.action_ref for a in legal),
                'model_ref': current.model_ref, 'evidence_refs': tuple(a.evidence_ref for a in legal)})
            while action_cursor < len(legal):
                action = legal[action_cursor]
                budget.visit({'graph_state': state_key, 'action_cursor': action_cursor})
                after = dict(before)
                outputs = dict(bound_outputs)
                if control is not None:
                    outputs[control.control_ref] = action.direction_ref
                after['target_outputs'] = tuple(sorted(outputs.items()))
                loop_key = source if model.loop_law_ref == 'revisited_relay_stops' else (source, action.direction_ref)
                seen = before['seen_shot_keys']
                receipt = None
                if loop_key in seen:
                    after['outcome_ref'] = 'LOOP'
                elif before['hop_count'] >= model.physical_hop_cap:
                    after['outcome_ref'] = 'PHYSICAL_HOP_CAP'
                else:
                    cache_key = stable_digest((model.model_ref, source, action.direction_ref, before['origin']))
                    if cache_key not in hit_cache:
                        hit = _first_hit(model, OpticalRay(origin=before['origin'], direction_ref=action.direction_ref,
                            excluded_source_body_ref=source), budget)
                        if not hit['complete_first_hit']:
                            raise OpticalPrerequisite('NUMERICAL_FIRST_HIT_UNCERTAINTY_PREVENTS_CLOSED_ROUTE_GRAPH')
                        hit_cache[cache_key] = d_map(hit)
                    receipt = hit_cache[cache_key]
                    receiver_ref = receipt['first_receiver_ref']
                    after.update({'receiver_ref': receiver_ref, 'seen_shot_keys': (*seen, loop_key),
                        'hop_count': before['hop_count'] + 1})
                    if receiver_ref is None:
                        after['outcome_ref'] = 'EXIT'
                    else:
                        receiver = receiver_maps[current.model_ref][receiver_ref]
                        if receiver.kind_ref == 'TERMINAL':
                            after['outcome_ref'] = 'TERMINAL_REACHED' if receiver_ref == model.terminal_ref and set(model.required_activation_refs) <= set(before['activated_relay_refs']) else 'TERMINAL_OR_ACTIVATION_REQUIREMENT_MISMATCH'
                        elif receiver.kind_ref == 'BLOCKER':
                            after['outcome_ref'] = 'BLOCKED'
                        elif receiver.kind_ref == 'RELAY':
                            after.update({'source_body_ref': receiver_ref, 'origin': receiver.center,
                                'activated_relay_refs': tuple(dict.fromkeys((*before['activated_relay_refs'], receiver_ref)))})
                            if after['hop_count'] >= model.physical_hop_cap:
                                after['outcome_ref'] = 'PHYSICAL_HOP_CAP'
                        else:
                            raise OpticalPrerequisite('DECLARED_RECEIVER_INTERACTION_KIND_REQUIRED')
                next_state = SearchStateC(model_ref=current.model_ref, state=d_map(after))
                next_key = full_search_state_key(next_state)
                if next_key not in known:
                    if len(states) >= request.domain_bound:
                        raise DComputationInterrupted('OPTICAL_GRAPH_STATE_DOMAIN_BOUND', d_map())
                    states.append(next_state); known.add(next_key)
                    if after['outcome_ref'] != 'CONTINUE':
                        terminals.append(next_state)
                response_ref = 'optical.ray_response.' + stable_digest((current.model_ref, state_key, action.action_ref, next_key))
                child_inputs = d_map({**query.request.immutable_inputs, 'state': before})
                child = query.request.model_copy(update={'request_ref': query.request.request_ref + '.' + response_ref,
                    'mode': 'STEP', 'immutable_inputs': child_inputs})
                snapshot_ref = 'optical.graph.pre.' + stable_digest((current.model_ref, state_key))
                event = MechanicalEventC(occurrence_ref=response_ref, producer_ref=request.scope.event_owner_ref,
                    kind_ref=query.request.immutable_inputs['optical_graph_event_kind_ref'],
                    clock_ref=query.request.immutable_inputs['optical_graph_clock_ref'], tick=before['hop_count'],
                    temporal_scope_ref=query.request.immutable_inputs['optical_graph_temporal_scope_ref'],
                    snapshot_ref=snapshot_ref, snapshot_kind='PRE_COMMAND', reads=before,
                    writes=d_map({k: after[k] for k in sorted(after) if before.get(k) != after[k]}),
                    costs=d_map({'declared_ray_edge_cost': action.cost}))
                packets.append(ExternalPrimitivePacketC(request=child, parent_request=query.request,
                    model_ref=current.model_ref, action_ref=action.action_ref, before=before, after=next_state.state,
                    events=(event,), snapshots=d_map({snapshot_ref: before, 'first_hit': receipt, 'outgoing_direction_ref': action.direction_ref,
                        'fixed_output_assignments': after['target_outputs'], 'abstract_graph_link_not_external_input': True}),
                    closure_domain_ref=request.operation_ref, closure_stop_ref=after['outcome_ref'], complete=True,
                    cost=action.cost, terminal=after['outcome_ref'] != 'CONTINUE', acceptance=False, response_ref=response_ref))
                responses[state_key + '|' + action.action_ref] = d_map({'complete': True, 'response_refs': (response_ref,)})
                action_cursor += 1
            cursor += 1; action_cursor = 0
        budget.finish()
        # Bind packets to the finalized identity; source acceptance remains the
        # supplied predicates. Physical terminal does not assert a game victory.
        domain_map = d_map(domains)
        identity = query.request.model_copy(update={'immutable_inputs': d_map({**query.request.immutable_inputs,
            'state_action_domains_digest': stable_digest(domain_map)})})
        packets = [p.model_copy(update={'parent_request': identity, 'request': p.request.model_copy(update={
            'immutable_inputs': d_map({**identity.immutable_inputs, 'state': p.before})})}) for p in packets]
        query = query.model_copy(update={'request': identity, 'initial_states': initial, 'packets': tuple(packets),
            'state_action_domains': domain_map, 'response_domains': d_map(responses),
            'terminal_states': tuple(terminals), 'closed_domain': True, 'declared_domain_size': len(states)})
        digest = optical_geometry_projection_digest_a(request, query)
        identity = identity.model_copy(update={'immutable_inputs': d_map({**identity.immutable_inputs,
            'optical_geometry_projection_digest': digest})})
        packets = tuple(p.model_copy(update={'parent_request': identity, 'request': p.request.model_copy(update={
            'immutable_inputs': d_map({**identity.immutable_inputs, 'state': p.before})})}) for p in query.packets)
        query = query.model_copy(update={'request': identity, 'packets': packets})
        return OpticalRouteBindingA(request=request, ready=True, query=query, projection_digest=digest)
    except (DResumeMismatch, OpticalPrerequisite, ValidationError) as error:
        return unavailable('NEEDS_EVIDENCE', str(error))
    except DComputationInterrupted as error:
        return unavailable('BOUND_REACHED', error.cause, d_resumable_frontier(request, (), None, work()))


def extract_optical_route_a(value: OpticalRouteExtractA) -> SearchDomainInputC:
    if not value.binding.ready or value.binding.query is None:
        raise ValueError('Source must establish an exact optical graph before K09')
    return value.binding.query


def unavailable_optical_route_a(value: OpticalRouteExtractA) -> DMechanicalResult:
    if value.binding.unavailable is None:
        return d_result(value.binding.request, 'NEEDS_EVIDENCE', 'EXACT_OPTICAL_GRAPH_BINDING_REQUIRED')
    return value.binding.unavailable


def return_optical_route_a(value: OpticalRouteReturnA) -> DMechanicalResult:
    binding, returned = value.binding, value.returned
    request, query = binding.request, binding.query
    if (query is None or returned.request != query.request or not binding.ready
            or optical_geometry_projection_digest_a(request, query) != binding.projection_digest
            or query.request.immutable_inputs.get('optical_geometry_projection_digest') != binding.projection_digest):
        return d_result(request, 'NEEDS_EVIDENCE', 'EXACT_K09_GEOMETRY_QUERY_AND_RETURN_IDENTITY_REQUIRED')
    measurement = returned.descriptive_values.get('measurement')
    if not isinstance(measurement, FrozenMap):
        return d_result(request, 'NEEDS_EVIDENCE', 'CANONICAL_K09_SEARCH_MEASUREMENT_REQUIRED')
    complete = measurement.get('complete') is True
    frontier = {} if complete else d_resumable_frontier(request, (), None,
        {'phase': 'OPTICAL_SEARCH', 'query': query, 'route_checkpoint': measurement.get('route_checkpoint'),
            'continuation': measurement.get('continuation', {})})
    return d_result(request, 'COMPLETE' if complete else 'NEEDS_EVIDENCE',
        'EXISTING_K09_OPTICAL_ROUTE_RETURNED' if complete else returned.cause or 'K09_OPTICAL_ROUTE_PREREQUISITE',
        values={'route_query': query, 'optical_geometry_projection_digest': binding.projection_digest,
            'route_return': returned, 'first_hit_derived_graph': True,
            'single_existing_k09_call': True, 'recursive_search_from_shot': False,
            'external_input_count_for_synchronous_shot': 1},
        complete=complete, examined=measurement.get('examined_count', 0), frontier=frontier)
