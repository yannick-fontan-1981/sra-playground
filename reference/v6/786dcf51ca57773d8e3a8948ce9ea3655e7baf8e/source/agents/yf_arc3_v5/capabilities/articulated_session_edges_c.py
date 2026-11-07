"""Typed projection of Source-computed K24 session receipts into route edges."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import stable_digest
from .articulated_channel_kinematics import ArtiRequest
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .articulated_route_contracts_c import ArticulatedRouteEdgeC


def project_articulated_session_edges(returned):
    request=returned.frozen_measurement.frozen_input
    route=request.route_question
    if route is not None and returned.derived_route_query is not None:
        route=route.model_copy(update={"query":returned.derived_route_query})
    session=returned.transition_session
    if route is None:return route,()
    if session is None:
        return route,("articulated.requested_transition_domain_has_no_current_session",) if request.transition_domain is not None else ()
    missing=list(session.missing_refs)
    if route.edges:
        missing.append("articulated.computed_transition_session_cannot_mix_supplied_edges")
    templates={(stable_digest(t.source_state),t.primitive_ref):t for t in session.requested.templates}
    edges=[]
    for row in session.returns:
        template=templates.get((row["state_digest"],row["primitive_ref"]))
        if template is None:
            missing.append("articulated.session_edge_exact_template");continue
        try:
            native=ArtiRequest.model_validate(row["native_request"])
            result=MechanicalNormalizedReturn.model_validate(row["native_return"])
        except (ValidationError,TypeError,ValueError):
            missing.append("articulated.session_edge_exact_typed_receipt");continue
        if native.step is None or native.state is None or native.step!=template.step or native.state!=template.source_state:
            missing.append("articulated.session_edge_retains_exact_template_payload");continue
        edges.append(ArticulatedRouteEdgeC(native_request=native,native_return=result,
            action_ref=native.step.input_ref,primitive_ref=template.primitive_ref,cost=template.cost,
            closure_domain_ref=template.closure_domain_ref,response_ref=template.response_ref,
            clock_ref=template.clock_ref,temporal_scope_ref=template.temporal_scope_ref,tick=template.tick))
    if len(edges)!=len(session.requested.questions):
        missing.append("articulated.session_all_qualified_questions_returned")
    return route.model_copy(update={"edges":tuple(edges)}),tuple(sorted(set(missing)))
