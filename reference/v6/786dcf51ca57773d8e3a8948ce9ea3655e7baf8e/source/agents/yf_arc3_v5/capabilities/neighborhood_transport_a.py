"""Typed K78 SEARCH binding; SRC calls the existing K09 workflow."""
from pydantic import Field,ValidationError
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,stable_digest
from .neighborhood_pattern_construction import NeighborhoodPatternRequest
from .neighborhood_search_contracts_c import NeighborhoodSearchInputC
from .mechanical_common_contracts_c import ExternalPrimitivePacketC,RouteCheckpointC
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .mechanical_family_contracts_d import DMechanicalResult,d_result,d_input_digest,d_map


class NeighborhoodTransportBindingA(FrozenModel):
    schema_version: Ref='yf_arc3_v5.neighborhood_transport_binding_a.v1'
    request: NeighborhoodPatternRequest
    ready: bool
    missing_cause: Ref|None=None
    route_request: NeighborhoodSearchInputC|None=None
    previous_step_count: int=Field(default=0,ge=0)


class NeighborhoodTransportExtractA(FrozenModel):
    schema_version: Ref='yf_arc3_v5.neighborhood_transport_extract_a.v1'
    binding: NeighborhoodTransportBindingA


class NeighborhoodTransportReturnA(FrozenModel):
    schema_version: Ref='yf_arc3_v5.neighborhood_transport_return_a.v1'
    binding: NeighborhoodTransportBindingA
    returned: MechanicalNormalizedReturn


def prepare_neighborhood_transport_a(request: NeighborhoodPatternRequest) -> NeighborhoodTransportBindingA:
    def missing(cause):return NeighborhoodTransportBindingA(request=request,ready=False,missing_cause=cause)
    if request.operation_ref!='mechanics.neighborhood_pattern_construction.transport_schedule' or request.mode_ref!='SEARCH':
        return missing('EXACT_TRANSPORT_SEARCH_SIGNATURE_REQUIRED')
    if request.source_identity_ref is None or request.transport_route_request is None or request.state is None:
        return missing('SOURCE_BOUND_ROUTE_DTO_AND_OCCUPANCY_REQUIRED')
    try:route=NeighborhoodSearchInputC.model_validate(request.transport_route_request)
    except ValidationError:return missing('CANONICAL_NEIGHBORHOOD_SEARCH_DTO_REQUIRED')
    query=route.query;identity=query.request;scope=request.scope
    if (identity.caller_ref!=scope.caller_ref or identity.parent_contribution_ref!=scope.parent_contribution_ref
        or identity.epoch!=scope.epoch or identity.input_revision_ref!=scope.evidence_revision_ref
        or identity.immutable_inputs.get('source_identity_ref')!=request.source_identity_ref):
        return missing('EXACT_SOURCE_SCOPE_PARENT_AND_EVIDENCE_REQUIRED')
    models={m.model_ref:m for m in request.models}
    if set(query.retained_model_refs)!=set(models) or {p.model_ref for p in route.providers}!=set(models):
        return missing('EXACT_UNREJECTED_MODEL_DOMAIN_REQUIRED')
    if any(s.state!=d_map(request.state) or s.model_ref not in models for s in query.initial_states):
        return missing('EXACT_CURRENT_JOINT_OCCUPANCY_REQUIRED')
    for provider in route.providers:
        native=provider.native_request
        if (provider.parent_request!=identity or provider.source_parent_goal_ref!=scope.parent_goal_ref
            or native.scope.evidence_revision_ref!=scope.evidence_revision_ref
            or native.scope.model_revision_ref!=scope.model_revision_ref
            or native.scope.event_owner_ref!=scope.event_owner_ref or native.state!=request.state
            or models[provider.model_ref] not in native.models):
            return missing('EXACT_NATIVE_PROVIDER_MODEL_GOAL_OWNER_AND_REVISION_REQUIRED')
    bounds=identity.actual_bounds
    if (bounds.get('max_candidates',0)>request.node_bound or bounds.get('max_states',0)>request.domain_bound
        or bounds.get('max_depth',0)>request.depth_bound):
        return missing('DECLARED_ROUTE_BOUND_EXCEEDS_PARENT')
    previous=0
    if request.resume_frontier:
        if request.resume_frontier.get('input_digest')!=d_input_digest(request):return missing('RESUME_SOURCE_INPUT_OR_REVISION_MISMATCH')
        work=request.resume_frontier.get('work_frontier',{})
        if work.get('phase')!='transport_search':return missing('TRANSPORT_SEARCH_RESUME_PHASE_REQUIRED')
        try:
            packets=tuple(ExternalPrimitivePacketC.model_validate(p) for p in work.get('exact_step_packets',()))
            checkpoint=RouteCheckpointC.model_validate(work['route_checkpoint']) if work.get('route_checkpoint') is not None else None
        except ValidationError:return missing('CANONICAL_RETAINED_STEP_OR_ROUTE_CHECKPOINT_REQUIRED')
        def key(p):return (p.model_ref,p.primitive_ref or p.action_ref,p.response_ref,stable_digest(p.before))
        known={key(p):p for p in query.packets}
        if any(key(p) in known and known[key(p)]!=p for p in packets):return missing('CONTRADICTORY_RETAINED_STEP_PACKET')
        appended=tuple(p for p in packets if key(p) not in known)
        query=query.model_copy(update={'packets':(*query.packets,*appended),'route_checkpoint':checkpoint,
            'continuation':d_map(work.get('continuation',{}))})
        route=route.model_copy(update={'query':query});previous=work.get('actual_step_call_count',0)
        if type(previous) is not int or previous<0:return missing('ACTUAL_RETAINED_STEP_COUNT_REQUIRED')
        if previous>=request.node_bound:return missing('CUMULATIVE_NATIVE_STEP_BOUND_REACHED')
        if previous+bounds.get('max_candidates',0)>request.node_bound:
            return missing('CUMULATIVE_NATIVE_STEP_ALLOCATION_EXCEEDS_PARENT')
    return NeighborhoodTransportBindingA(request=request,ready=True,route_request=route,previous_step_count=previous)


def extract_neighborhood_transport_a(value: NeighborhoodTransportExtractA) -> NeighborhoodSearchInputC:
    if not value.binding.ready or value.binding.route_request is None:raise ValueError('Source must establish the exact transport binding before extraction')
    return value.binding.route_request


def unavailable_neighborhood_transport_a(value: NeighborhoodTransportExtractA) -> DMechanicalResult:
    return d_result(value.binding.request,'NEEDS_EVIDENCE',value.binding.missing_cause or 'EXACT_TRANSPORT_BINDING_REQUIRED')


def return_neighborhood_transport_a(value: NeighborhoodTransportReturnA) -> DMechanicalResult:
    binding,returned=value.binding,value.returned;request=binding.request
    if binding.route_request is None or returned.request!=binding.route_request.query.request:
        return d_result(request,'NEEDS_EVIDENCE','EXACT_K09_ROUTE_RETURN_IDENTITY_REQUIRED')
    measurement=returned.descriptive_values.get('measurement')
    if not isinstance(measurement,FrozenMap):return d_result(request,'NEEDS_EVIDENCE','CANONICAL_K09_SEARCH_MEASUREMENT_REQUIRED')
    count=binding.previous_step_count+returned.retained_frontier.get('actual_step_call_count',0)
    frontier=d_map({'input_digest':d_input_digest(request),'completed_model_results':(),
        'unfinished_model_ref':None,'work_frontier':d_map({'phase':'transport_search','actual_step_call_count':count,
            'exact_step_packets':returned.retained_frontier.get('exact_step_packets',()),
            'route_checkpoint':measurement.get('route_checkpoint'),'continuation':measurement.get('continuation',{})}),
        'caller_next_item_ref':request.scope.caller_next_item_ref,'evidence_revision_ref':request.scope.evidence_revision_ref,
        'model_revision_ref':request.scope.model_revision_ref})
    complete=bool(measurement.get('complete',False))
    return d_result(request,'COMPLETE' if returned.status in ('FOUND','EMPTY_DECLARED_DOMAIN') else 'NEEDS_EVIDENCE',
        'EXISTING_K09_TRANSPORT_RETURNED' if returned.status in ('FOUND','EMPTY_DECLARED_DOMAIN') else returned.cause or 'K09_ROUTE_PREREQUISITE',
        values={'route_return':returned,'single_existing_k09_call':True,'recursive_search_from_successor':False},
        complete=complete,examined=count,frontier={} if complete else frontier)
