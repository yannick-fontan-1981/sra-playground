"""Exact bounded metric receipt transport, without a new physical model."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .mechanical_request_contracts import MechanicalNormalizedReturn
from .articulated_dependency_measurement_c import _nodes


def qualify_metric_frontier_return_d(measured,returned):
    native=measured.request.native_request.calculation_request
    missing=list(measured.missing_refs);result=None
    if not isinstance(returned,MechanicalNormalizedReturn) or returned.request!=native.identity:
        missing.append('effect.metric_frontier_exact_normalized_identity')
    else:
        result=returned
        if returned.status!='FOUND':missing.append('effect.metric_frontier_native_source_result_is_complete')
        if returned.retained_frontier or returned.domain_receipt is not None and returned.domain_receipt.pending_count:
            missing.append('effect.metric_frontier_incomplete_domain_is_not_completion')
    # The original protocol only exposes actual examined work with a domain receipt.
    # Otherwise charge its declared upper bound, never falsely report zero actual work.
    charged=(returned.domain_receipt.examined_count if isinstance(returned,MechanicalNormalizedReturn) and returned.domain_receipt is not None
        else native.identity.actual_bounds['nodes'])
    work=measured.accounted_evaluations+charged
    values=result.descriptive_values if result is not None else FrozenMap()
    projection=_nodes(values,max(0,measured.request.maximum_evaluations-work))
    if projection is None:missing.append('effect.metric_frontier_complete_projection_bound');values=FrozenMap()
    else:work+=projection
    return result,values,missing,work
