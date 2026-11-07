"""Project actual K24 result fields; predictions remain conditional domain values."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data


def project_articulated_result_reasons(request,result):
    if result is None: return (),()
    native=request.native_request
    if result.scope != native.scope or result.operation_ref != native.operation_ref or result.mode != native.mode:
        return (), ("articulated.reason_exact_native_result",)
    reasons,missing=[],[]
    rows=result.values.get("articulated_candidate_domain",())
    if not isinstance(rows,tuple): return (), ("articulated.typed_candidate_domain",)
    before=immutable_json_data(native.state) if native.state is not None else None
    before_bodies={b["body_ref"]:b for b in before["bodies"]} if before is not None else {}
    for row in rows:
        if not isinstance(row,FrozenMap):
            missing.append("articulated.typed_candidate_row");continue
        after=row.get("after_state")
        if not isinstance(after,FrozenMap) or not isinstance(after.get("bodies"),tuple):
            missing.append("articulated.actual_candidate_after_state");continue
        after_bodies={b["body_ref"]:b for b in after["bodies"] if isinstance(b,FrozenMap)}
        if set(after_bodies)!=set(before_bodies):
            missing.append("articulated.joint_owned_body_population_preserved");continue
        deltas=tuple(FrozenMap({"body_ref":ref,"before":before_bodies[ref],"after":after_bodies[ref]})
            for ref in sorted(before_bodies) if before_bodies[ref]!=after_bodies[ref])
        limiting_contacts=[]
        trace=row.get("joint_word_trace",())
        if not isinstance(trace,tuple):
            missing.append("articulated.actual_joint_word_trace");continue
        for event in trace:
            if isinstance(event,FrozenMap):
                contacts=event.get("contacts",())
                if isinstance(contacts,tuple):limiting_contacts.extend(contacts)
        restorations=[]
        for target in request.restorations:
            if target.restoration_candidate_ref != row.get("candidate_ref"):continue
            current=after_bodies.get(target.body_ref)
            restorations.append(FrozenMap({"body_ref":target.body_ref,
                "restoration_target_ref":target.restoration_target_ref,
                "enabling_dependency_ref":target.enabling_dependency_ref,
                "reference_pose_reached":current==target.reference_body,
                "complete_word_succeeded":row.get("complete_intended_word_succeeded"),
                "physical_restoration_observed":False}))
        reasons.append(FrozenMap({"candidate_ref":row.get("candidate_ref"),
            "amplitude":row.get("amplitude"),"joint_body_deltas":deltas,
            "first_blocked_step":row.get("first_blocked_step"),
            "retained_useful_prefix":row.get("retained_useful_prefix"),
            "limiting_contacts":tuple(limiting_contacts),
            "endpoint_predicate_satisfied":row.get("endpoint_predicate_satisfied"),
            "executable_inverse_pose":row.get("executable_inverse_pose"),
            "restoration_checks":tuple(restorations),"native_missing_refs":row.get("missing_refs",()),
            "complete_marker_goal_proved_by_endpoint":False,
            "complete_route_search_proven":False,"action_authority":False}))
    # Root-relative measures and physical transaction packets retain their native
    # representation. No partial receiver is independently committed here.
    for key in ("kinematics","joint_events","contacts","collision_mode","clearance",
            "owned_hidden_world_masks","ownership_alternatives"):
        if key in result.values:
            reasons.append(FrozenMap({"native_field_ref":key,"value":result.values[key],
                "scope":immutable_json_data(result.scope),"action_authority":False}))
    # Actual angle edges are measured in the parent reader and already retained
    # in measured.reasons; a supplied expected delta is not a second observation.
    return tuple(reasons),tuple(sorted(set(missing)))
