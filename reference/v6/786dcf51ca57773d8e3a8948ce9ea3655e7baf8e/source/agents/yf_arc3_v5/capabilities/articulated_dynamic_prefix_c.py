"""Measure reachable intermediate amplitudes from Source K09/K24 receipts."""
from fractions import Fraction
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .articulated_channel_kinematics import ArtiState
from .articulated_solving_contracts_c import ArticulatedDependencyRowsC
from .articulated_route_bridge_c import measure_articulated_route_bridge
from .articulated_session_edges_c import project_articulated_session_edges
from .articulated_dependency_receipt_c import read_articulated_dependency_receipts
from .articulated_dependency_measurement_c import _nodes


def measure_articulated_dynamic_prefixes(returned):
    if returned.derived_route_query is None:return None
    request=returned.frozen_measurement.frozen_input
    session=returned.transition_session
    if session is None or request.native_request.state is None:
        return ArticulatedDependencyRowsC(missing_refs=("articulated.dynamic_prefix_current_session",),projection_complete=False)
    route,debt=project_articulated_session_edges(returned)
    if route is None:return ArticulatedDependencyRowsC(missing_refs=("articulated.dynamic_prefix_exact_route_scope",),projection_complete=False)
    bridge=measure_articulated_route_bridge(route)
    effects,effect_debt,work=read_articulated_dependency_receipts(request,returned.conditional_dependency_receipts)
    missing=list((*debt,*bridge.missing_refs,*effect_debt))
    if missing:return ArticulatedDependencyRowsC(missing_refs=tuple(sorted(set(missing))),projection_complete=False)
    remaining=request.parent_maximum_evaluations-returned.accounted_evaluations
    initial=immutable_json_data(request.native_request.state)
    initial_digest=stable_digest(initial)
    original={body.body_ref:body for body in request.native_request.state.bodies}
    rows=[]
    for index,(edge,receipt) in enumerate(zip(route.edges,session.returns)):
        if len(rows)>=128:
            missing.append("articulated.dynamic_prefix_projection_bound");break
        needed=receipt.get("K09_requested_step")
        before=immutable_json_data(edge.native_request.state)
        if (not isinstance(needed,FrozenMap) or needed.get("state")!=before
                or needed.get("action_ref")!=edge.primitive_ref
                or needed.get("parent_request_ref")!=route.query.request.request_ref
                or needed.get("model_ref")!=edge.native_request.model.model_ref
                or needed.get("mode")!="STEP"
                or receipt.get("K09_search_request_ref")!=route.query.request.request_ref
                or not receipt.get("K09_search_measurement_digest")):
            missing.append("articulated.dynamic_prefix_actual_K09_reachability_request");continue
        result=edge.native_return.descriptive_values.get("calculation")
        if not isinstance(result,FrozenMap):
            missing.append("articulated.dynamic_prefix_actual_native_measurement");continue
        after=result.get("values",FrozenMap()).get("after_state")
        events=result.get("values",FrozenMap()).get("joint_events",())
        if not any(isinstance(event,FrozenMap) and event.get("kind")=="JOINT_ARTICULATED_EDIT" and event.get("committed") is True for event in events):continue
        try:state=ArtiState.model_validate(after)
        except (ValidationError,TypeError,ValueError):
            missing.append("articulated.dynamic_prefix_typed_after_state");continue
        nodes=_nodes(after,max(0,remaining-work))
        required=2*(nodes or 0)+len(effects)+len(events)+len(state.bodies)+len(request.restorations)
        if nodes is None or work+required>remaining:
            missing.append("articulated.dynamic_prefix_parent_work_bound");break
        work+=required
        digest=stable_digest(after)
        matched=tuple(effect for effect in effects if effect["before_state_digest"]==digest
            and effect["dependency_ref"] in request.prerequisite_clearance_refs)
        amplitudes=[]
        for body in state.bodies:
            delta=Fraction(*body.local_extent)-Fraction(*original[body.body_ref].local_extent)
            if delta:amplitudes.append(FrozenMap({"body_ref":body.body_ref,"extent_delta":(delta.numerator,delta.denominator)}))
        rows.append(FrozenMap({"projection_ref":stable_digest((request.demand,receipt["request_ref"],digest)),
            "parent_goal_ref":request.why.parent_goal_ref,"candidate_ref":receipt["request_ref"],
            "prefix_primitive_count":None,"prefix_after_state":after,"prefix_state_digest":digest,
            "state_changed_from_initial":digest!=initial_digest,"amplitudes_by_body":tuple(amplitudes),
            "last_input_ref":edge.action_ref,"complete_word_blocked":None,
            "matched_dependency_effects":matched,"matched_effect_count":len(matched),
            "K09_requested_step":needed,"K09_search_measurement_digest":receipt["K09_search_measurement_digest"],
            "restoration_targets":tuple(FrozenMap({"body_ref":r.body_ref,"restoration_target_ref":r.restoration_target_ref,
                "enabling_dependency_ref":r.enabling_dependency_ref}) for r in request.restorations),
            "frozen_why":immutable_json_data(request.why),
            "evidence_refs":tuple(sorted({effect["support_claim_ref"] for effect in matched})),
            "existing_term_refs":(request.why.parent_goal_ref,),"full_amplitude_domain_proved":False}))
    return ArticulatedDependencyRowsC(rows=tuple(rows),missing_refs=tuple(sorted(set(missing))),
        accounted_evaluations=work,projection_complete=not bool(missing),
        frontier=FrozenMap({"retained_reachable_states":len(rows)}) if missing else FrozenMap())
