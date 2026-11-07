"""Exact transport DOMAIN -> published C K09 request, never a local search."""
from collections.abc import Mapping
from agents.yf_arc3_v5.logos.types import FrozenMap,stable_digest,immutable_json_data
from .mechanical_contracts_b import MechanicalRequestB,MechanicalResultB
from .mechanical_response_transport_b import request_identity
from .mechanical_common_contracts_c import SearchDomainInputC,SearchStateC,MechanicalPredicateC
from .mechanical_search_driver_contracts_c import SearchDriverInputC,SearchProviderC,SearchPrimitiveC
from .mechanical_request_contracts import MechanicalNormalizedReturn,MechanicalRequestIdentity,MAX_MECHANICAL_MODEL_ASSIGNMENTS
from .mechanical_common_contracts_c import SearchResultC
from .mechanical_transport_c import search_payload
from .retained_guarded_route_domains_b import retained_route_domains


def prepare_guarded_search(request,domain):
    request=request if isinstance(request,MechanicalRequestB) else MechanicalRequestB.model_validate(request)
    domain=domain if isinstance(domain,MechanicalResultB) else MechanicalResultB.model_validate(domain)
    if domain.request!=request:raise ValueError('route descriptor is not this exact request')
    descriptor=domain.values.get('search_ready_descriptor')
    missing=list(domain.missing_refs)
    if descriptor is None:missing.append('result.search_ready_descriptor')
    else:missing.extend(descriptor['unresolved_dependencies'])
    retained=()
    if descriptor is not None:
        retained,retained_missing=retained_route_domains(request,descriptor)
        missing.extend(retained_missing)
    search_mode=request.data.get('k09_mode','ROUTE')
    if search_mode not in ('ROUTE','BELIEF'):
        missing.append('data.k09_mode.supported_search_mode')
    if request.model_alternatives and search_mode!='BELIEF':
        missing.append('data.k09_mode.explicit_belief_for_retained_models')
    if len(retained)>MAX_MECHANICAL_MODEL_ASSIGNMENTS:missing.append('composition.root_model_assignment_capacity')
    state_observations=request.data.get('k09_state_observations',FrozenMap())
    if not isinstance(state_observations,Mapping):
        missing.append('data.k09_state_observations.typed_partition');state_observations=FrozenMap()
    if search_mode=='BELIEF':
        if not state_observations:missing.append('data.k09_state_observations.actual_partition')
        if request.data.get('k09_controllable_quantifier')!='EXISTS':
            missing.append('data.k09_controllable_quantifier.explicit_exists')
        if request.data.get('k09_response_quantifier')!='FORALL':
            missing.append('data.k09_response_quantifier.explicit_forall')
    bounds=request.data.get('k09_bounds')
    if not isinstance(bounds,Mapping):missing.append('data.k09_bounds');bounds=FrozenMap()
    else:
        for field in ('max_states','max_candidates','max_depth','max_events','max_primitives'):
            if field not in bounds or type(bounds[field]) is not int or not 0<=bounds[field]<=65536:
                missing.append('data.k09_bounds.'+field)
    for field in ('event_clock_ref','temporal_scope_ref','closure_domain_ref','deterministic_response_ref'):
        if not isinstance(request.data.get(field),str) or not request.data[field]:missing.append('data.'+field)
    goal=descriptor['goal_contract'] if descriptor is not None else FrozenMap()
    for field in ('terminal_assignments','terminal_carrier_side','terminal_carried_refs'):
        if field not in goal:missing.append('goal_contract.'+field)
    # SRC/DRM owns predicate identities and their cognitive role. The adapter
    # transports those declared identities; it does not manufacture goals.
    predicate_refs=request.data.get('k09_predicate_refs',FrozenMap())
    if not isinstance(predicate_refs,Mapping):missing.append('data.k09_predicate_refs');predicate_refs=FrozenMap()
    delivery_refs=predicate_refs.get('terminal_assignments',FrozenMap())
    if not isinstance(delivery_refs,Mapping):missing.append('data.k09_predicate_refs.terminal_assignments');delivery_refs=FrozenMap()
    for ref in sorted(goal.get('terminal_assignments',{})):
        if not delivery_refs.get(ref):missing.append('data.k09_predicate_refs.terminal_assignments.'+ref)
    for field in ('terminal_carrier_side','terminal_carried_refs','checkpoint_threat'):
        if not predicate_refs.get(field):missing.append('data.k09_predicate_refs.'+field)
    declared_refs=tuple(delivery_refs[ref] for ref in sorted(goal.get('terminal_assignments',{})) if delivery_refs.get(ref))
    declared_refs+=tuple(predicate_refs[field] for field in ('terminal_carrier_side','terminal_carried_refs','checkpoint_threat')
        if predicate_refs.get(field))
    if any(not isinstance(ref,str) for ref in declared_refs):missing.append('data.k09_predicate_refs.typed_identities')
    elif len(set(declared_refs))!=len(declared_refs):missing.append('data.k09_predicate_refs.unique_clause_identities')
    carried=goal.get('terminal_carried_refs')
    if not isinstance(carried,(tuple,list)) or any(not isinstance(ref,str) for ref in carried):
        missing.append('goal_contract.typed_terminal_carried_refs')
    elif len(set(carried))!=len(carried):missing.append('goal_contract.unique_terminal_carried_refs')
    if missing:return FrozenMap({'ready':False,'missing_refs':tuple(missing),'search_request':None})
    goal_predicates=tuple(MechanicalPredicateC(predicate_ref=delivery_refs[ref],
        field_ref='sides',field_path=(ref,),comparison='EQ',expected=goal['terminal_assignments'][ref])
        for ref in sorted(goal['terminal_assignments']))
    goal_predicates+=(MechanicalPredicateC(predicate_ref=predicate_refs['terminal_carrier_side'],field_ref='carrier_side',
        comparison='EQ',expected=goal['terminal_carrier_side']),
        MechanicalPredicateC(predicate_ref=predicate_refs['terminal_carried_refs'],field_ref='carried_refs',
        comparison='SET_EQ',expected=goal['terminal_carried_refs']))
    # Only a model's actual threat checkpoint is tested. Initial absence of a
    # computed marker is not converted to an observed safe state.
    protection=(MechanicalPredicateC(predicate_ref=predicate_refs['checkpoint_threat'],field_ref='active_threats',
        comparison='EQ',expected=(),include_initial=False,event_kind_refs=('checkpoint.threat',)),)
    providers=tuple(SearchProviderC(model_ref=bound.model_ref,kernel_ref='mechanics.guarded_transport',
        template=bound.model_copy(update={'operation_ref':'mechanics.guarded_transport.external_primitive',
            'mode':'STEP','expected_return_type':'MechanicalResultB','model_alternatives':()})) for bound,_ in retained)
    provider=providers[0].template
    identity=request_identity(provider,'mechanics.guarded_transport')
    root=MechanicalRequestIdentity.model_validate({**immutable_json_data(identity),
        'model_assignments':FrozenMap({p.model_ref:request_identity(p.template,p.kernel_ref).model_assignments for p in providers})
            if len(providers)>1 else identity.model_assignments,
        'request_ref':request.request_ref+'.k09.'+stable_digest(request),
        'kernel_ref':'mechanics.bounded_route_search','operation_ref':'mechanics.bounded_route_search',
        'mode':search_mode,'expected_return_type':'SearchResultC','actual_bounds':FrozenMap(bounds),
        'requested_domain_ref':request.data['closure_domain_ref']})
    primitives=tuple(SearchPrimitiveC(primitive_ref=item['primitive_ref'],action_ref=item['action_ref'],
        data=FrozenMap(item.get('data',{})),cost=descriptor['input_costs'][item['action_ref']])
        for item in descriptor['primitive_domain'])
    query=SearchDomainInputC(request=root,
        initial_states=tuple(SearchStateC(state=model_descriptor['initial_state'],model_ref=bound.model_ref)
            for bound,model_descriptor in retained),
        retained_model_refs=tuple(p.model_ref for p in providers),action_refs=tuple(p.primitive_ref for p in primitives),
        state_observations=FrozenMap(state_observations),
        controllable_quantifier=request.data.get('k09_controllable_quantifier') if search_mode=='BELIEF' else None,
        response_quantifier=request.data.get('k09_response_quantifier') if search_mode=='BELIEF' else None,
        closed_domain=False,predicates=protection,acceptance_predicates=goal_predicates,
        terminal_predicates=goal_predicates,
        deterministic_response_ref=request.data['deterministic_response_ref'])
    driver=SearchDriverInputC(query=query,primitives=primitives,
        providers=providers)
    return FrozenMap({'ready':True,'missing_refs':(),'search_request':immutable_json_data(driver)})


def unavailable_guarded_search(request,preparation):
    request=request if isinstance(request,MechanicalRequestB) else MechanicalRequestB.model_validate(request)
    missing_refs=tuple(preparation['missing_refs'])
    return MechanicalResultB(request=request,source_status='NEEDS_EVIDENCE',
        cause='MISSING_IMPLEMENTATION' if any(ref.startswith('implementation.') for ref in missing_refs)
            else 'MISSING_OBSERVATION',missing_refs=missing_refs,
        values=FrozenMap({'search_execution_pending':True,'search_preparation':preparation}))


def prepare_handoff_search(request,domain):
    from .guarded_transport import route_domain
    request=request if isinstance(request,MechanicalRequestB) else MechanicalRequestB.model_validate(request)
    domain=domain if isinstance(domain,MechanicalResultB) else MechanicalResultB.model_validate(domain)
    if domain.request!=request:raise ValueError('handoff descriptor is not this exact request')
    required=request.data.get('requires_generic_search')
    if required is None or required is False:return FrozenMap({'composition_requested':False,'ready':False})
    if required is not True:return FrozenMap({'composition_requested':True,'ready':False,
        'missing_refs':('data.explicit_requires_generic_search',),'search_request':None})
    prepared=prepare_guarded_search(request,route_domain(request))
    return FrozenMap({**prepared,'composition_requested':True})


def bind_handoff_search_return(request,domain,preparation,returned):
    bound=bind_guarded_search_return(request,preparation,returned)
    domain=domain if isinstance(domain,MechanicalResultB) else MechanicalResultB.model_validate(domain)
    return bound.model_copy(update={'values':FrozenMap({**domain.values,**bound.values,
        'local_handoff_domain':immutable_json_data(domain),'local_handoff_is_not_complete_delivery_proof':True})})


def bind_guarded_search_return(request,preparation,returned):
    """Retain the actual C return. FOUND here means a bound measurement packet.

    The wrapper transports the exact C disposition and measurement; it grants
    no action authority and retains the complete result apart from display caps.
    """
    request=request if isinstance(request,MechanicalRequestB) else MechanicalRequestB.model_validate(request)
    driver=SearchDriverInputC.model_validate(preparation['search_request'])
    returned=returned if isinstance(returned,MechanicalNormalizedReturn) else MechanicalNormalizedReturn.model_validate(returned)
    measured=returned.descriptive_values.get('measurement')
    if measured is None:
        return MechanicalResultB(request=request,source_status='NEEDS_EVIDENCE',cause='MISSING_IMPLEMENTATION',
            missing_refs=('return.measurement.SearchResultC',),
            values=FrozenMap({'search_return':immutable_json_data(returned)}))
    result=SearchResultC.model_validate(measured)
    if driver.query.request!=returned.request or returned.request!=result.request:
        return MechanicalResultB(request=request,source_status='MODEL_CONTRADICTION',cause='SIGNATURE_MISMATCH',
            values=FrozenMap({'search_request':immutable_json_data(driver),'search_return':immutable_json_data(returned)}))
    # C SRC/DRM has already classified this exact normalized measurement.
    # Transport its disposition instead of selecting a second status in Python.
    status=returned.status
    exhausted=(status=='EMPTY_DECLARED_DOMAIN' and result.complete and not result.bounded
        and not result.contradictory and result.declared_domain_size is not None
        and result.examined_count==result.declared_domain_size and not result.missing_refs)
    witnesses=tuple(FrozenMap({**immutable_json_data(witness),'source_return_ref':stable_digest(returned),
        'model_refs':driver.query.retained_model_refs,'measurement_complete':result.complete,
        'measurement_bounded':result.bounded,'measurement_contradictory':result.contradictory,
        'measurement_missing_refs':result.missing_refs,'no_dispatch_or_action_authority':True})
        for witness in result.witnesses[:3])
    return MechanicalResultB(request=request,source_status=status,cause=returned.cause,
        examined_count=result.examined_count,domain_size=result.declared_domain_size,
        domain_exhausted=exhausted,missing_refs=result.missing_refs,
        frontier=tuple(result.requested_steps) if not exhausted else (),values=FrozenMap({
        'search_request':immutable_json_data(driver),'search_return':immutable_json_data(returned),
        'root_witnesses':witnesses,
        'search_result':search_payload(result),'search_execution_pending':False,
        'measurement_packet_is_not_route_feasibility':True}))


def compare_guarded_search_returns(caller,unrestricted,restricted,free_result,reduced_result):
    """Compare exact published C witness/closure packets, not DOMAIN descriptors."""
    from .guarded_transport import route_domain
    from .mechanical_transport_b import provider_result_payload
    sides=[];missing=[]
    for label,request,native in (('unrestricted',unrestricted,free_result),('restricted',restricted,reduced_result)):
        expected=prepare_guarded_search(request,route_domain(request))
        if not expected['ready']:
            missing.extend(label+'.'+ref for ref in expected['missing_refs']);continue
        if native.source_status=='MODEL_CONTRADICTION':
            return MechanicalResultB(request=caller,source_status='MODEL_CONTRADICTION',cause='SIGNATURE_MISMATCH')
        absent=tuple(key for key in ('search_request','search_return','search_result') if key not in native.values)
        if absent:
            missing.extend(label+'.result.'+key for key in absent);continue
        driver=SearchDriverInputC.model_validate(native.values['search_request'])
        supplied=SearchDriverInputC.model_validate(expected['search_request'])
        returned=MechanicalNormalizedReturn.model_validate(native.values['search_return'])
        result=SearchResultC.model_validate(native.values['search_result'])
        if (driver!=supplied or returned.request!=supplied.query.request or result.request!=returned.request
                or returned.descriptive_values.get('measurement')!=native.values['search_result']):
            return MechanicalResultB(request=caller,source_status='MODEL_CONTRADICTION',cause='SIGNATURE_MISMATCH')
        if returned.status=='MODEL_CONTRADICTION' or result.contradictory:
            return MechanicalResultB(request=caller,source_status='MODEL_CONTRADICTION',cause=returned.cause,
                values=FrozenMap({'audit_only':True,'conditional_necessity':None,
                    'contradictory_search_return':immutable_json_data(returned)}))
        receipt=returned.domain_receipt
        closed_empty=(returned.status=='EMPTY_DECLARED_DOMAIN' and result.complete and not result.bounded
            and not result.contradictory and not result.witnesses and not result.missing_refs
            and not result.requested_steps and receipt is not None
            and receipt.domain_ref==supplied.query.request.requested_domain_ref
            and receipt.input_revision_ref==supplied.query.request.input_revision_ref
            and receipt.examined_count==receipt.declared_domain_size==result.examined_count==result.declared_domain_size
            and receipt.pending_count==0 and returned.retained_frontier.get('failed_return') is None)
        has_witness=(returned.status=='FOUND' and not result.contradictory and bool(result.witnesses))
        sides.append((returned,result,closed_empty,has_witness))
    values={'audit_only':True,'same_declared_domain':True,'restriction_ref':caller.data['restriction_ref'],
        'removed_primitive_refs':tuple(caller.data['removed_primitive_refs']),
        'conditional_necessity':None,'restriction_not_necessary':None,
        'retained_model_ref':unrestricted.model_ref,'scoped_optimality_claimed':False,
        'remaining_model_alternatives':unrestricted.model_alternatives,
        'unrestricted_return':provider_result_payload(free_result),'restricted_return':provider_result_payload(reduced_result)}
    if missing:
        return MechanicalResultB(request=caller,source_status='NEEDS_EVIDENCE',cause='MISSING_OBSERVATION',
            values=FrozenMap({**values,'unresolved':True}),missing_refs=tuple(missing))
    free,free_search,free_empty,free_witness=sides[0]
    reduced,reduced_search,reduced_empty,reduced_witness=sides[1]
    values['cost_records']=tuple(FrozenMap({'domain_variant':variant,'request_ref':search.request.request_ref,
        'input_revision_ref':search.request.input_revision_ref,'model_ref':unrestricted.model_ref,
        'word':witness.word,'actual_witness_cost':witness.cost,'optimality_proved':False})
        for variant,search in (('unrestricted',free_search),('restricted',reduced_search)) for witness in search.witnesses)
    if reduced_witness:
        return MechanicalResultB(request=caller,source_status='FOUND',values=FrozenMap({**values,
            'conditional_necessity':False,'restriction_not_necessary':True,
            'restricted_witnesses':tuple(immutable_json_data(row) for row in reduced_search.witnesses),'unresolved':False}))
    if free_witness and reduced_empty:
        removed=set(caller.data['removed_primitive_refs'])
        if not all(any(ref in removed for ref in witness.word) for witness in free_search.witnesses):
            return MechanicalResultB(request=caller,source_status='MODEL_CONTRADICTION',cause='SIGNATURE_MISMATCH',
                values=FrozenMap({**values,'witness_does_not_use_the_proved_restriction':True}))
        return MechanicalResultB(request=caller,source_status='FOUND',values=FrozenMap({**values,
            'conditional_necessity':True,'restriction_not_necessary':False,
            'unrestricted_witnesses':tuple(immutable_json_data(row) for row in free_search.witnesses),
            'restricted_closed_domain_receipt':immutable_json_data(reduced.domain_receipt),'unresolved':False}))
    bound=free.status=='BUDGET_REACHED' or reduced.status=='BUDGET_REACHED'
    return MechanicalResultB(request=caller,source_status='BUDGET_REACHED' if bound else 'NEEDS_EVIDENCE',
        cause='COMPUTATION_BOUND' if bound else 'MISSING_OBSERVATION',
        values=FrozenMap({**values,'unresolved':True,'unrestricted_closed_empty':free_empty,
            'restricted_closed_empty':reduced_empty}),
        missing_refs=tuple(ref for condition,ref in ((not free_witness,'evidence.unrestricted_feasible_witness'),
            (not reduced_empty,'evidence.restricted_closed_empty_or_feasible_witness')) if condition))
