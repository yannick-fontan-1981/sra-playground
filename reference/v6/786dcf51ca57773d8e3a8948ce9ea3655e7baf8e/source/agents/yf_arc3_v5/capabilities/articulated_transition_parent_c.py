"""Source-owned transition session activation; preserve exact parent and query."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .articulated_solving_contracts_c import ArticulatedTransitionParentFactsC


def measure_articulated_transition_parent(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    domain=request.transition_domain
    missing=[]
    if domain is not None:
        if (returned.missing_refs or domain.base_request!=request.native_request
                or domain.episode_ref!=request.why.episode_ref or domain.level_scope_ref!=request.why.level_scope_ref
                or returned.accounted_evaluations+domain.maximum_total_evaluations>request.parent_maximum_evaluations):
            missing.append("articulated.current_transition_domain_parent_and_remaining_budget")
    return ArticulatedTransitionParentFactsC(facts=FrozenMap({"transition_domain_bound":domain is not None and not bool(missing)}),
        missing_refs=tuple(missing))


def get_articulated_transition_domain(value):
    return value.returned.frozen_measurement.frozen_input.transition_domain


def seal_articulated_transition_parent(value):
    request=value.returned.frozen_measurement.frozen_input
    missing=list((*value.returned.missing_refs,*value.measured.missing_refs))
    session=value.session
    if session is not None and session.source_request!=request.transition_domain:
        missing.append("articulated.exact_parent_transition_session");session=None
    if session is not None:missing.extend(session.missing_refs)
    return value.returned.model_copy(update={"transition_session":session,
        "accounted_evaluations":value.returned.accounted_evaluations+(session.accounted_evaluations if session else 0),
        "missing_refs":tuple(sorted(set(missing)))})
