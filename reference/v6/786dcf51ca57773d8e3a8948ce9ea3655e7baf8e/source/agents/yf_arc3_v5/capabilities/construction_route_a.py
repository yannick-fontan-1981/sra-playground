"""Typed Source session for existing K09 plus the complete construction C stepper.

No contact, load, stability, failure or route algorithm is implemented here.
"""
from time import monotonic
from typing import Literal
from pydantic import Field, ValidationError
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest
from .supported_construction import SupportedConstructionRequest, ConstructionState
from .construction_step_contracts_c import ConstructionStepInputC, ConstructionStepDispatchC
from .mechanical_common_contracts_c import SearchDomainInputC, SearchResultC, ExternalPrimitivePacketC, RouteCheckpointC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .mechanical_event_composition_c import packet_context_equal
from .mechanical_family_contracts_d import DMechanicalResult, d_validate_request, d_input_digest, d_map, d_result, d_resumable_frontier


class ConstructionRouteProviderA(FrozenModel):
    model_ref: Ref
    primitive_ref: Ref
    template: ConstructionStepInputC


class ConstructionRouteInputA(FrozenModel):
    query: SearchDomainInputC
    providers: tuple[ConstructionRouteProviderA, ...] = Field(min_length=1, max_length=4096)
    cost_metric_ref: Literal['TOTAL_EXTERNAL_INPUT_COST']
    primitive_domain_evidence_ref: Ref


class ConstructionRouteSessionA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.construction_route_session_a.v1'
    request: SupportedConstructionRequest
    route: ConstructionRouteInputA | None = None
    query: SearchDomainInputC | None = None
    returned: MechanicalNormalizedReturn | None = None
    measurement: SearchResultC | None = None
    needed: tuple[FrozenMap, ...] = Field(default=(), max_length=4096)
    search_allowed: bool
    stopped: bool = False
    pending: bool = False
    actual_step_calls: int = Field(default=0, ge=0)
    native_examined: int = Field(default=0, ge=0)
    started_at: float
    elapsed_ms: int = Field(default=0, ge=0)
    missing_cause: Ref | None = None


class ConstructionRouteSessionInputA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.construction_route_session_input_a.v1'
    session: ConstructionRouteSessionA


class ConstructionRouteAbsorbA(ConstructionRouteSessionInputA):
    schema_version: Ref = 'yf_arc3_v5.construction_route_absorb_a.v1'
    returned: MechanicalNormalizedReturn


class ConstructionRouteNextA(ConstructionRouteSessionInputA):
    schema_version: Ref = 'yf_arc3_v5.construction_route_next_a.v1'
    needed: FrozenMap


class ConstructionRouteStepBindingA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.construction_route_step_binding_a.v1'
    ready: bool
    child: ConstructionStepInputC | None = None
    missing_cause: Ref | None = None


class ConstructionRouteStepExtractA(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.construction_route_step_extract_a.v1'
    binding: ConstructionRouteStepBindingA


class ConstructionRouteAppendA(ConstructionRouteSessionInputA):
    schema_version: Ref = 'yf_arc3_v5.construction_route_append_a.v1'
    binding: ConstructionRouteStepBindingA
    dispatched: ConstructionStepDispatchC


class ConstructionRouteRefuseA(ConstructionRouteSessionInputA):
    schema_version: Ref = 'yf_arc3_v5.construction_route_refuse_a.v1'
    binding: ConstructionRouteStepBindingA


def _scope_equal(outer, native):
    return all(getattr(outer.scope, name) == getattr(native.scope, name) for name in (
        'caller_ref', 'parent_goal_ref', 'parent_consumer_ref', 'parent_contribution_ref',
        'caller_next_item_ref', 'epoch', 'evidence_revision_ref', 'model_revision_ref',
        'model_status_ref', 'event_owner_ref'))


def _elapsed(session):
    return session.elapsed_ms + max(0, int((monotonic() - session.started_at) * 1000))


def initialize_construction_route_a(request: SupportedConstructionRequest) -> ConstructionRouteSessionA:
    def missing(cause):
        return ConstructionRouteSessionA(request=request, search_allowed=False, started_at=monotonic(), missing_cause=cause)
    rejected = d_validate_request(request)
    if rejected is not None:
        return missing(rejected.cause)
    try:
        if (request.operation_ref != 'mechanics.supported_construction.prefix_plan' or request.mode_ref != 'SEARCH'
                or not request.source_identity_ref or request.route_input is None or request.state is None or not request.models):
            return missing('EXACT_CONSTRUCTION_ROUTE_SIGNATURE_SOURCE_AND_CURRENT_JOINT_STATE_REQUIRED')
        route = ConstructionRouteInputA.model_validate(request.route_input)
        query, scope = route.query, request.scope
        identity = query.request
        if (identity.caller_ref != scope.caller_ref or identity.parent_contribution_ref != scope.parent_contribution_ref
                or identity.epoch != scope.epoch or identity.input_revision_ref != scope.evidence_revision_ref
                or identity.immutable_inputs.get('source_identity_ref') != request.source_identity_ref
                or identity.immutable_inputs.get('parent_goal_ref') != scope.parent_goal_ref
                or identity.immutable_inputs.get('event_owner_ref') != scope.event_owner_ref
                or identity.immutable_inputs.get('model_revision_ref') != scope.model_revision_ref
                or identity.immutable_inputs.get('construction_models_digest') != stable_digest(request.models)
                or identity.immutable_inputs.get('cost_metric_ref') != route.cost_metric_ref):
            return missing('EXACT_SOURCE_GOAL_OWNER_MODEL_REVISION_AND_EXTERNAL_COST_SCOPE_REQUIRED')
        models = {m.model_ref: m for m in request.models}
        if len(models) != len(request.models) or set(query.retained_model_refs) != set(models):
            return missing('EXACT_UNREJECTED_CONSTRUCTION_MODEL_DOMAIN_REQUIRED')
        if ({s.model_ref for s in query.initial_states} != set(models)
                or len(query.initial_states) != len(models)
                or any(s.state != d_map(request.state) for s in query.initial_states)):
            return missing('EXACT_CURRENT_FULL_BEAMS_STOCK_SELECTION_RESERVE_AND_TERMINATION_REQUIRED')
        pairs = {(p.model_ref, p.primitive_ref) for p in route.providers}
        if len(pairs) != len(route.providers) or pairs != {(m, a) for m in models for a in query.action_refs}:
            return missing('COMPLETE_MODEL_BY_ATOMIC_EXTERNAL_ACTION_PROVIDER_DOMAIN_REQUIRED')
        if (query.request.actual_bounds.get('max_candidates', 0) > request.node_bound
                or query.request.actual_bounds.get('max_states', 0) > request.domain_bound
                or query.request.actual_bounds.get('max_depth', 0) > request.depth_bound):
            return missing('COMMON_SEARCH_ALLOCATION_EXCEEDS_PARENT')
        if query.deterministic_response_ref is None:
            return missing('DECLARED_COMPLETE_PER_MODEL_DETERMINISTIC_RESPONSE_DOMAIN_REQUIRED')
        for provider in route.providers:
            step, native = provider.template, provider.template.native_request
            if (step.model_ref != provider.model_ref or step.primitive_ref != provider.primitive_ref
                    or native.models != (models[provider.model_ref],) or not _scope_equal(request, native)
                    or native.state != request.state or native.resume_frontier
                    or native.operation_ref != 'mechanics.supported_construction.external_primitive' or native.mode_ref != 'STEP'
                    or step.parent_request != identity or not packet_context_equal(identity, step.request, provider.model_ref)
                    or native.primitive is None or native.primitive.kind_ref not in ('select_width', 'point', 'place', 'reset')):
                return missing('EXACT_COMPLETE_CONSTRUCTION_STEP_PROVIDER_SCOPE_MODEL_STATE_AND_ATOMIC_INPUT_REQUIRED')
            if step.response_ref != query.deterministic_response_ref:
                return missing('EXACT_DECLARED_CONSTRUCTION_RESPONSE_REF_REQUIRED')
            if not step.ownership_evidence_refs or not step.phase_clock_evidence_refs:
                return missing('ACTUAL_NATIVE_EVENT_PHASE_AND_OWNERSHIP_EVIDENCE_REQUIRED')
        session = ConstructionRouteSessionA(request=request, route=route, query=query,
            search_allowed=True, started_at=monotonic())
        if request.resume_frontier:
            if request.resume_frontier.get('input_digest') != d_input_digest(request):
                return missing('CONSTRUCTION_ROUTE_RESUME_SOURCE_INPUT_OR_REVISION_MISMATCH')
            saved = request.resume_frontier.get('work_frontier', {})
            if saved.get('phase') != 'CONSTRUCTION_SEARCH':
                return missing('CONSTRUCTION_SEARCH_CONTINUATION_REQUIRED')
            retained = SearchDomainInputC.model_validate(saved['query'])
            # Only K09's packet delta and retained continuation may differ.
            original = retained.model_copy(update={'packets': query.packets,
                'continuation': query.continuation, 'route_checkpoint': query.route_checkpoint})
            if original != query:
                return missing('EXACT_RETAINED_CONSTRUCTION_SEARCH_CONTEXT_REQUIRED')
            session = session.model_copy(update={'query': retained,
                'actual_step_calls': saved.get('actual_step_calls', 0),
                'native_examined': saved.get('native_examined', 0), 'elapsed_ms': saved.get('elapsed_ms', 0)})
            if any(type(v) is not int or v < 0 for v in (session.actual_step_calls, session.native_examined, session.elapsed_ms)):
                return missing('EXACT_RETAINED_WORK_COUNTS_REQUIRED')
            if session.elapsed_ms >= request.time_bound_ms:
                session = session.model_copy(update={'search_allowed': False, 'missing_cause': 'CONSTRUCTION_ROUTE_TIME_BOUND'})
        return session
    except ValidationError:
        return missing('CANONICAL_TYPED_CONSTRUCTION_ROUTE_QUERY_AND_STEP_TEMPLATES_REQUIRED')


def extract_construction_route_query_a(value: ConstructionRouteSessionInputA) -> SearchDomainInputC:
    session = value.session
    if not session.search_allowed or session.query is None:
        raise ValueError('Source must establish the exact route query before K09')
    return session.query


def absorb_construction_route_a(value: ConstructionRouteAbsorbA) -> ConstructionRouteSessionA:
    session, returned = value.session, value.returned
    if session.query is None or returned.request != session.query.request:
        return session.model_copy(update={'search_allowed': False, 'pending': False, 'stopped': True, 'missing_cause': 'EXACT_K09_CONSTRUCTION_RETURN_IDENTITY_REQUIRED'})
    try:
        measurement = SearchResultC.model_validate(returned.descriptive_values['measurement'])
    except (KeyError, ValidationError):
        return session.model_copy(update={'search_allowed': False, 'pending': False, 'stopped': True, 'missing_cause': 'CANONICAL_K09_CONSTRUCTION_SEARCH_MEASUREMENT_REQUIRED'})
    elapsed = _elapsed(session)
    time_bound = elapsed >= session.request.time_bound_ms
    bounded = time_bound or session.actual_step_calls >= session.query.request.actual_bounds.get('max_candidates', 0)
    pending = bool(measurement.requested_steps) and not measurement.complete and not measurement.contradictory and not measurement.bounded and not bounded
    query = session.query.model_copy(update={'route_checkpoint': measurement.route_checkpoint, 'continuation': measurement.continuation})
    return session.model_copy(update={'returned': returned, 'measurement': measurement, 'query': query,
        'needed': measurement.requested_steps, 'pending': pending, 'search_allowed': pending, 'stopped': not pending,
        'missing_cause': 'CONSTRUCTION_ROUTE_TIME_BOUND' if time_bound else 'CONSTRUCTION_ROUTE_STEP_BOUND' if bounded and not measurement.complete else None})


def bind_construction_route_step_a(value: ConstructionRouteNextA) -> ConstructionRouteStepBindingA:
    session, needed = value.session, value.needed
    def missing(cause):
        return ConstructionRouteStepBindingA(ready=False, missing_cause=cause)
    if session.query is None or session.route is None or not session.pending or needed not in session.needed:
        return missing('EXACT_CURRENT_K09_REQUESTED_STEP_REQUIRED')
    if (_elapsed(session) >= session.request.time_bound_ms
            or session.actual_step_calls >= session.query.request.actual_bounds.get('max_candidates', 0)
            or session.native_examined >= session.request.node_bound):
        return missing('CONSTRUCTION_ROUTE_TIME_NODE_OR_STEP_BOUND')
    providers = [p for p in session.route.providers if p.model_ref == needed.get('model_ref') and p.primitive_ref == needed.get('action_ref')]
    if len(providers) != 1:
        return missing('EXACT_CURRENT_CONSTRUCTION_STEP_PROVIDER_REQUIRED')
    provider = providers[0]
    try:
        state = ConstructionState.model_validate(needed['state'])
    except (KeyError, ValidationError):
        return missing('FULL_CONSTRUCTION_BODY_SELECTION_AND_RESOURCE_STATE_REQUIRED')
    template, query = provider.template, session.query
    primitive = template.native_request.primitive
    child_ref = 'mechanical.construction_route_step.' + stable_digest((query.request, needed, d_map(primitive)))
    scope = template.native_request.scope.model_copy(update={'request_ref': child_ref})
    remaining_time = max(0, session.request.time_bound_ms - _elapsed(session))
    if remaining_time == 0:
        return missing('CONSTRUCTION_ROUTE_TIME_BOUND')
    native = template.native_request.model_copy(update={'scope': scope, 'state': state, 'primitive': primitive,
        'node_bound': min(template.native_request.node_bound, session.request.node_bound - session.native_examined),
        'time_bound_ms': min(template.native_request.time_bound_ms, remaining_time)})
    suffix = '.' + stable_digest(child_ref)
    phases = tuple(p.model_copy(update={'occurrence_ref': p.occurrence_ref + suffix, 'snapshot_ref': p.snapshot_ref + suffix}) for p in template.phases)
    identity = template.request.model_copy(update={'request_ref': child_ref,
        'actual_bounds': d_map({'node_bound': native.node_bound, 'depth_bound': native.depth_bound,
            'domain_bound': native.domain_bound, 'time_bound_ms': native.time_bound_ms}),
        'immutable_inputs': d_map({**template.request.immutable_inputs,
            'state': d_map(state), 'primitive': d_map(primitive), 'action_ref': template.action_ref,
            'primitive_ref': template.primitive_ref, 'native_context_digest': stable_digest(d_map(native))})})
    child = template.model_copy(update={'request': identity, 'parent_request': query.request,
        'native_request': native, 'phases': phases})
    return ConstructionRouteStepBindingA(ready=True, child=child)


def extract_construction_route_step_a(value: ConstructionRouteStepExtractA) -> ConstructionStepInputC:
    if not value.binding.ready or value.binding.child is None:
        raise ValueError('Source must establish a complete child binding')
    return value.binding.child


def refuse_construction_route_step_a(value: ConstructionRouteRefuseA) -> ConstructionRouteSessionA:
    return value.session.model_copy(update={'search_allowed': False, 'pending': False, 'stopped': True,
        'missing_cause': value.binding.missing_cause or 'EXACT_CONSTRUCTION_STEP_BINDING_REQUIRED'})


def append_construction_route_step_a(value: ConstructionRouteAppendA) -> ConstructionRouteSessionA:
    session, child, dispatch = value.session, value.binding.child, value.dispatched
    packet, native = dispatch.packet, dispatch.native
    count = session.actual_step_calls + 1
    examined = session.native_examined + (native.examined_count if native is not None else 0)
    updates = {'actual_step_calls': count, 'native_examined': examined}
    if (child is None or session.query is None or packet is None or native is None
            or packet.request != child.request or packet.parent_request != session.query.request
            or packet.model_ref != child.model_ref or not packet.complete
            or packet.before != d_map(child.native_request.state)
            or dispatch.normalized.request != child.request
            or native.scope != child.native_request.scope):
        return session.model_copy(update={**updates, 'search_allowed': False, 'pending': False, 'stopped': True,
            'missing_cause': 'EXACT_COMPLETE_CONSTRUCTION_C_STEP_RECEIPT_REQUIRED'})
    # Selection, placement and reset are actual external primitives. The existing
    # C adapter owns the physical verdict; A transports its sealed packet once.
    kind = child.native_request.primitive.kind_ref
    model = child.native_request.models[0]
    expected_cost = model.reset_cost if kind == 'reset' else dict(model.input_costs).get(kind)
    if packet.cost != expected_cost:
        return session.model_copy(update={**updates, 'search_allowed': False, 'pending': False, 'stopped': True,
            'missing_cause': 'FULL_EXTERNAL_DEBIT_AND_PACKET_COST_MUST_MATCH'})
    key = (packet.model_ref, packet.primitive_ref or packet.action_ref, packet.response_ref, stable_digest(packet.before))
    prior = {(p.model_ref, p.primitive_ref or p.action_ref, p.response_ref, stable_digest(p.before)): p for p in session.query.packets}
    if key in prior and prior[key] != packet:
        return session.model_copy(update={**updates, 'search_allowed': False, 'pending': False, 'stopped': True,
            'missing_cause': 'CONTRADICTORY_RETAINED_CONSTRUCTION_STEP'})
    packets = session.query.packets if key in prior else (*session.query.packets, packet)
    query = session.query.model_copy(update={'packets': packets})
    # An exhausted physical STEP budget still permits sealing the current
    # packet set through K09. bind_next refuses any additional physical call.
    allowed = _elapsed(session) < session.request.time_bound_ms
    return session.model_copy(update={**updates, 'query': query, 'search_allowed': allowed,
        'pending': allowed, 'stopped': not allowed, 'missing_cause': None if allowed else 'CONSTRUCTION_ROUTE_TIME_BOUND'})


def finish_construction_route_a(value: ConstructionRouteSessionInputA) -> DMechanicalResult:
    session, request = value.session, value.session.request
    measurement = session.measurement
    complete = (measurement is not None and measurement.complete and not measurement.contradictory
        and not measurement.bounded and session.missing_cause is None)
    frontier = {} if complete or session.query is None else d_resumable_frontier(request, (), None,
        {'phase': 'CONSTRUCTION_SEARCH', 'query': session.query, 'actual_step_calls': session.actual_step_calls,
            'native_examined': session.native_examined, 'elapsed_ms': _elapsed(session)})
    return d_result(request, 'COMPLETE' if complete else 'NEEDS_EVIDENCE',
        'EXISTING_K09_WITH_COMPLETE_CONSTRUCTION_C_STEPS' if complete else session.missing_cause or 'K09_CONSTRUCTION_DOMAIN_UNRESOLVED',
        values={'route_return': session.returned, 'route_query': session.query,
            'cost_metric_ref': session.route.cost_metric_ref if session.route else None,
            'actual_external_step_calls': session.actual_step_calls, 'native_examined_count': session.native_examined,
            'selected_material_and_active_beam_state_retained': True, 'full_external_costs_retained': True,
            'no_second_mechanics_pass_or_cost_debit': True, 'command_optimality_scope': 'SOURCE_DECLARED_ATOMIC_ACTION_DOMAIN_ONLY'},
        complete=complete, examined=session.native_examined, frontier=frontier)
