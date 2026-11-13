"""Exact terminal states for K09, measured by existing K24 rooted geometry."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .articulated_channel_kinematics import ArtiState,measure_articulated_kinematics
from .contracts import ArticulatedKinematicsInput
from .mechanical_common_contracts_c import SearchStateC
from .articulated_route_bridge_c import measure_articulated_route_bridge
from ..drm.meaning import DeclaredMeaningInstantiation
from .articulated_restoration_target_c import read_articulated_restoration_targets


def derive_articulated_route_terminal_states(request,route,remaining_evaluations,pose_questions=(),restoration_receipts=()):
    targets=request.marker_targets
    restorations=request.restorations
    states={}
    missing=[]
    questions=[]
    derived,restoration_debt=read_articulated_restoration_targets(request,restoration_receipts)
    if restoration_debt:return (),restoration_debt,0
    if pose_questions:
        for receipt in pose_questions:
            try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
            except (ValidationError,TypeError,ValueError):
                return (), ("articulated.route_exact_declared_pose_question",),0
            if (meaning.rule_ref!="rule.articulated_pose_question_c" or not meaning.template_iteration_complete
                    or meaning.facts.get("parent_goal_ref")!=request.why.parent_goal_ref
                    or meaning.facts.get("frozen_why")!=immutable_json_data(request.why)):
                return (), ("articulated.route_current_parent_pose_question",),0
            questions.extend((meaning.facts["body_ref"],row) for row in meaning.facts.get("marker_constraints",()))
        initial_offsets={(body.body_ref,ref):offset for body in request.native_request.state.bodies for ref,offset in body.marker_offsets}
        if any(initial_offsets.get((ref,row["marker_ref"]))!=row.get("local_offset") for ref,row in questions):
            return (), ("articulated.route_pose_question_exact_local_offsets",),0
        expected={(target.body_ref,target.marker_ref):target.world_position for target in targets}
        actual={(ref,row["marker_ref"]):row["world_position"] for ref,row in questions}
        if actual!=expected or len(questions)!=len(expected):
            return (), ("articulated.route_whole_pose_question_marker_conjunction",),0
    maximum_states=route.query.request.actual_bounds.get("max_states",0)
    if type(maximum_states) is not int or not 1<=maximum_states<=65536:
        return (), ("articulated.route_goal_explicit_state_bound",),0
    bridge=measure_articulated_route_bridge(route)
    if bridge.missing_refs:
        return (),bridge.missing_refs,0
    for state in route.query.initial_states:
        states[stable_digest((state.model_ref,state.state))]=state
    for packet in bridge.packets:
        for data in (packet.before,packet.after):
            state=SearchStateC(state=data,model_ref=packet.model_ref)
            states[stable_digest((state.model_ref,state.state))]=state
        if len(states)>maximum_states:
            return (), ("articulated.route_goal_state_domain_bound",),len(states)
    work=0
    accepting=[]
    for key in sorted(states):
        state=states[key]
        try:native=ArtiState.model_validate(state.state)
        except (ValidationError,TypeError,ValueError):
            missing.append("articulated.route_goal_typed_full_state");continue
        required=1+len(native.bodies)**2+sum(len(b.marker_offsets) for b in native.bodies)+len(targets)+len(restorations)+len(derived)
        if work+required>remaining_evaluations:
            missing.append("articulated.route_goal_measurement_bound");break
        work+=required
        geometry=measure_articulated_kinematics(ArticulatedKinematicsInput(bodies=native.bodies))
        markers={(b.body_ref,ref):point for b in geometry.body_geometries for ref,point in b.marker_positions}
        bodies={b.body_ref:immutable_json_data(b) for b in native.bodies}
        if questions:
            offsets={(body.body_ref,ref):offset for body in native.bodies for ref,offset in body.marker_offsets}
            if any(offsets.get((ref,row["marker_ref"]))!=row.get("local_offset") for ref,row in questions):
                missing.append("articulated.route_pose_question_requires_current_marker_transform");continue
        constraints=tuple((ref,row["marker_ref"],row["world_position"]) for ref,row in questions) if pose_questions else tuple(
            (target.body_ref,target.marker_ref,target.world_position) for target in targets)
        if (all(markers.get((ref,marker_ref))==position for ref,marker_ref,position in constraints)
                and all(markers.get((row["body_ref"],row["marker_ref"]))==row["world_position"] for row in derived)
                and all(bodies.get(target.body_ref)==target.reference_body for target in restorations)):
            accepting.append(state)
    return tuple(accepting),tuple(sorted(set(missing))),work
