"""Thin K09 session reducers; no local search or physical action release."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .articulated_dynamic_contracts_c import ArticulatedDynamicSessionC,ArticulatedDynamicNextC,ArticulatedDynamicBoundC
from .articulated_channel_kinematics import ArtiState,_arti_work
from .articulated_transition_domain_c import ArticulatedTransitionSessionC,ArticulatedTransitionDomainFactsC,ArticulatedTransitionAppendInputC
from .articulated_transition_session_c import append_articulated_transition_return
from .articulated_route_goal_c import derive_articulated_route_terminal_states
from .articulated_route_bridge_c import measure_articulated_route_bridge
from .articulated_route_parent_c import measure_articulated_route_parent
from .articulated_solving_contracts_c import ArticulatedRouteParentInputC,ArticulatedTransitionParentFactsC
from .articulated_session_edges_c import project_articulated_session_edges
from .mechanical_search_c import search_complete_step_domain
from .mechanical_search_c import full_search_state_key
from .mechanical_common_contracts_c import CommonSignatureFactsC,SearchStateC


def initialize_articulated_dynamic(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    domain,route=request.transition_domain,request.route_question
    missing=list(returned.missing_refs)
    if (domain is None or not domain.control_laws or domain.templates or route is None or route.edges
            or domain.base_request!=request.native_request or domain.states!=(request.native_request.state,)
            or route.query.packets or route.query.request.mode!="ROUTE"
            or request.route_control_domain is None):
        missing.append("articulated.dynamic_current_initial_domain_laws_and_route")
    if not missing:
        controls={c.primitive_ref:c for c in request.route_control_domain.controls}
        if set(controls)!={law.primitive_ref for law in domain.control_laws} or set(controls)!=set(route.query.action_refs):
            missing.append("articulated.dynamic_complete_current_control_law_domain")
        for law in domain.control_laws:
            control=controls.get(law.primitive_ref)
            if control is None or control.input_ref!=law.input_ref or control.channel_ref!=law.channel_ref:
                missing.append("articulated.dynamic_law_uses_current_control");continue
            direct={op.receiver_ref for op in law.operations}
            if control.kind=="ROOTED_SUBCHAIN" and direct!={control.root_body_ref}:
                missing.append("articulated.dynamic_rooted_law_has_only_its_root")
            if control.kind=="SHARED_CHANNEL" and direct!={b.body_ref for b in request.native_request.state.bodies if law.channel_ref in b.channel_refs}:
                missing.append("articulated.dynamic_channel_law_has_all_receivers")
    transitions=None
    initial_goal_work=0
    if not missing:
        transitions=ArticulatedTransitionSessionC(source_request=domain,requested=ArticulatedTransitionDomainFactsC(
            questions=(),templates=(),missing_refs=(),calculation_bound=True,domain_complete=False,frontier=FrozenMap()),
            returns=(),accounted_evaluations=0,missing_refs=(),calculation_bound=True)
        initial=returned.model_copy(update={"transition_session":transitions})
        checked=measure_articulated_route_parent(ArticulatedRouteParentInputC(returned=initial),require_measured_indirect_edges=False)
        initial_goal_work=checked.facts.get("goal_measurement_work",0)
        missing.extend(checked.missing_refs)
    return ArticulatedDynamicSessionC(returned=returned,query=route.query if route is not None else None,
        transitions=transitions,missing_refs=tuple(sorted(set(missing))),calculation_bound=not bool(missing),
        accounted_evaluations=initial_goal_work)


def recalculate_articulated_dynamic(value):
    session=value.session
    if not session.calculation_bound or session.query is None or session.transitions is None:return session
    request=session.returned.frozen_measurement.frozen_input
    provisional=session.returned.model_copy(update={"transition_session":session.transitions,
        "derived_route_query":session.query.model_copy(update={"packets":()})})
    route,missing=project_articulated_session_edges(provisional)
    bridge=measure_articulated_route_bridge(route)
    budget=request.parent_maximum_evaluations-session.returned.accounted_evaluations-session.accounted_evaluations
    accepting,goal_missing,goal_work=derive_articulated_route_terminal_states(request,route,max(0,budget),
        session.returned.frozen_measurement.pose_question_receipts,
        session.returned.frozen_measurement.restoration_target_receipts)
    debt=list((*missing,*bridge.missing_refs,*goal_missing))
    if debt:return session.model_copy(update={"missing_refs":tuple(sorted(set((*session.missing_refs,*debt)))),
        "calculation_bound":False,"pending_steps_present":False,"accounted_evaluations":session.accounted_evaluations+goal_work})
    query=session.query.model_copy(update={"packets":bridge.packets,"accepting_states":accepting,"terminal_states":accepting,
        "route_checkpoint":None,"continuation":FrozenMap()})
    remaining=budget-goal_work
    bounds=dict(query.request.actual_bounds)
    if remaining<=0:
        return session.model_copy(update={"missing_refs":(*session.missing_refs,"articulated.dynamic_parent_search_budget"),
            "calculation_bound":False,"pending_steps_present":False,"accounted_evaluations":session.accounted_evaluations+goal_work})
    if bounds.get("max_candidates",0)>remaining:
        return session.model_copy(update={"missing_refs":(*session.missing_refs,"articulated.dynamic_search_iteration_reserved_budget"),
            "calculation_bound":False,"pending_steps_present":False,"accounted_evaluations":session.accounted_evaluations+goal_work})
    result=search_complete_step_domain(query)
    # K09 examined_count counts response packets; its candidate counter owns
    # actual search work and the max_candidates bound.
    candidate_work=result.facts.get("candidate_evaluation_count")
    if type(candidate_work) is not int or not 0<=candidate_work<=bounds.get("max_candidates",0):
        return session.model_copy(update={"search":result,"missing_refs":(*session.missing_refs,"articulated.dynamic_exact_search_work_counter"),
            "calculation_bound":False,"pending_steps_present":False,
            "accounted_evaluations":session.accounted_evaluations+goal_work})
    work=session.accounted_evaluations+goal_work+candidate_work
    return session.model_copy(update={"query":query,"search":result,"accounted_evaluations":work,
        "pending_steps_present":bool(result.requested_steps) and not result.bounded and not result.contradictory,
        "calculation_bound":not result.bounded and not result.contradictory,
        "missing_refs":tuple(sorted(set((*session.missing_refs,
            *(("articulated.dynamic_search_bound_or_contradiction",) if result.bounded or result.contradictory else ())))))})


def measure_articulated_dynamic_requested(value):
    request=value.returned.frozen_measurement.frozen_input
    return ArticulatedTransitionParentFactsC(facts=FrozenMap({"dynamic_requested":request.transition_domain is not None
        and bool(request.transition_domain.control_laws) and request.route_question is not None}),missing_refs=())


def next_articulated_dynamic_question(value):
    session,needed=value.session,value.needed
    domain=session.returned.frozen_measurement.frozen_input.transition_domain
    if session.actual_step_call_count>=domain.maximum_questions:
        return ArticulatedDynamicNextC(domain=None,missing_refs=("articulated.dynamic_actual_step_call_bound",))
    if session.search is None or needed not in session.search.requested_steps:
        return ArticulatedDynamicNextC(domain=None,missing_refs=("articulated.dynamic_exact_K09_requested_step",))
    laws=tuple(law for law in domain.control_laws if law.primitive_ref==needed.get("action_ref"))
    try:state=ArtiState.model_validate(needed.get("state"))
    except (ValidationError,ValueError,TypeError):
        return ArticulatedDynamicNextC(domain=None,missing_refs=("articulated.dynamic_full_K09_requested_state",))
    if len(laws)!=1 or needed.get("model_ref")!=domain.base_request.model.model_ref:
        return ArticulatedDynamicNextC(domain=None,missing_refs=("articulated.dynamic_exact_model_and_primitive_law",))
    request=session.returned.frozen_measurement.frozen_input
    remaining=request.parent_maximum_evaluations-session.returned.accounted_evaluations-session.accounted_evaluations
    if remaining<=0:return ArticulatedDynamicNextC(domain=None,missing_refs=("articulated.dynamic_parent_step_budget",))
    return ArticulatedDynamicNextC(domain=domain.model_copy(update={"states":(state,),"control_laws":laws,
        "maximum_questions":1,"maximum_total_evaluations":min(domain.maximum_total_evaluations,remaining)}),missing_refs=(),needed=needed)


def bind_articulated_dynamic_question(value):
    measured=value.qualified
    missing=list((*value.next_request.missing_refs,*measured.missing_refs))
    question=measured.questions[0] if len(measured.questions)==1 else None
    if question is None:missing.append("articulated.dynamic_single_qualified_successor_question")
    else:
        required=_arti_work(question.native_request.state,question.native_request.step)
        maximum=value.next_request.domain.maximum_total_evaluations
        if measured.accounted_evaluations+required>maximum or required>question.native_request.maximum_evaluations:
            missing.append("articulated.dynamic_generated_step_reserved_budget")
    return ArticulatedDynamicBoundC(question=question,measured=measured,missing_refs=tuple(sorted(set(missing))),
        calculation_bound=not bool(missing),needed=value.next_request.needed)


def append_articulated_dynamic(value):
    session,bound=value.session,value.bound
    missing=list((*session.missing_refs,*bound.missing_refs))
    if not bound.calculation_bound or value.native_return is None or session.transitions is None:
        return session.model_copy(update={"calculation_bound":False,"pending_steps_present":False,
            "missing_refs":tuple(sorted(set((*missing,"articulated.dynamic_actual_successor_return"))))})
    if session.search is None or bound.needed not in session.search.requested_steps:
        return session.model_copy(update={"calculation_bound":False,"pending_steps_present":False,
            "missing_refs":(*session.missing_refs,"articulated.dynamic_return_current_K09_request")})
    prior=session.transitions
    requested=prior.requested.model_copy(update={"questions":(*prior.requested.questions,bound.question),
        "templates":(*prior.requested.templates,*bound.measured.templates)})
    transitions=append_articulated_transition_return(ArticulatedTransitionAppendInputC(session=prior.model_copy(update={"requested":requested}),
        question=bound.question,returned=value.native_return))
    if len(transitions.returns)==len(prior.returns)+1:
        last=transitions.returns[-1]
        last=FrozenMap({**dict(last),"K09_requested_step":bound.needed,
            "K09_search_request_ref":session.query.request.request_ref,
            "K09_search_measurement_digest":stable_digest(immutable_json_data(session.search))})
        transitions=transitions.model_copy(update={"returns":(*transitions.returns[:-1],last)})
    used=transitions.accounted_evaluations-prior.accounted_evaluations+bound.measured.accounted_evaluations
    missing.extend(transitions.missing_refs)
    return session.model_copy(update={"transitions":transitions,"actual_step_call_count":session.actual_step_call_count+1,
        "accounted_evaluations":session.accounted_evaluations+used,"missing_refs":tuple(sorted(set(missing))),
        "calculation_bound":not bool(missing)})


def seal_articulated_dynamic(value):
    session=value.session
    returned=session.returned
    return returned.model_copy(update={"transition_session":session.transitions,
        "derived_route_query":session.query.model_copy(update={"packets":()}) if session.query is not None else None,
        "accounted_evaluations":returned.accounted_evaluations+session.accounted_evaluations,
        "missing_refs":tuple(sorted(set((*returned.missing_refs,*session.missing_refs)))),
        "reasons":(*returned.reasons,FrozenMap({"dynamic_K09_step_calls":session.actual_step_call_count,
            "dynamic_search_measurement":immutable_json_data(session.search) if session.search is not None else None,
            "complete_state_graph_attested":False,"action_authority":False}))})


def measure_articulated_dynamic_closure(value):
    session=value.session
    result=session.search
    return CommonSignatureFactsC(facts=FrozenMap({
        "metadata_only_missing":result is not None and set(result.missing_refs)<={"named_finite_domain_size","declared_domain_not_closed"},
        "pending_steps_absent":result is not None and not result.requested_steps,
        "computation_unbounded":result is not None and not result.bounded and session.calculation_bound,
        "model_consistent":result is not None and not result.contradictory and not session.missing_refs,
        "deterministic_response_bound":session.query is not None and session.query.deterministic_response_ref is not None}))


def close_articulated_dynamic_domain(value):
    session=value.session
    # Called only after Source selects the common reachable-domain closure rule.
    domains={}
    for packet in session.query.packets:
        key=full_search_state_key(SearchStateC(state=packet.before,model_ref=packet.model_ref))
        domains[key+"|"+packet.primitive_ref]=FrozenMap({"complete":True,"response_refs":(packet.response_ref,)})
    query=session.query.model_copy(update={"closed_domain":True,"declared_domain_size":len(domains),
        "response_domains":FrozenMap(domains)})
    return session.model_copy(update={"query":query})
