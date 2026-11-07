"""Exact mechanical return qualification shared by acquired evidence frontiers.

This is transport validation only. SRC invokes the native workflow; each family
retains its measurement adapter, causal projection and DRM interpretation.
"""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .articulated_dependency_measurement_c import _nodes


def qualify_scoped_frontier_calculation(measured, returned, *, error_refs,
        require_complete_result=False, projected_value_key=None):
    request=measured.request;native=request.native_request
    missing=list(measured.missing_refs);result=None;examined=0
    if returned is not None:
        if returned.request!=request.demand.request:missing.append(error_refs['identity'])
        else:
            try:result=MechanicalFamilyResult.model_validate(returned.descriptive_values.get('calculation'))
            except (ValidationError,TypeError,ValueError):missing.append(error_refs['typed'])
            if result is not None:
                examined=result.examined_count
                exact=(result.scope==native.scope and result.operation_ref==native.operation_ref
                    and result.mode==native.mode and result.signature_supported)
                complete=(result.domain_complete and not result.computation_bound_reached
                    and not result.prerequisite_refs and not result.implementation_debt_refs)
                if not exact or require_complete_result and not complete:
                    missing.append(error_refs['scope']);result=None
                elif not require_complete_result:
                    missing.extend(result.prerequisite_refs);missing.extend(result.implementation_debt_refs)
                    if not result.domain_complete or result.computation_bound_reached:
                        missing.append(error_refs['incomplete'])
    elif not missing:missing.append(error_refs['absent'])
    # Account even a rejected typed calculation: its work has already happened.
    work=measured.accounted_evaluations+examined
    values=result.values if result is not None else FrozenMap()
    projection_value=values.get(projected_value_key,()) if projected_value_key else values
    projection=_nodes(projection_value,max(0,request.maximum_evaluations-work))
    if projection is None:
        missing.append(error_refs['projection']);values=FrozenMap();projection_value=() if projected_value_key else values
    else:work+=projection
    return result,values,projection_value,missing,work
