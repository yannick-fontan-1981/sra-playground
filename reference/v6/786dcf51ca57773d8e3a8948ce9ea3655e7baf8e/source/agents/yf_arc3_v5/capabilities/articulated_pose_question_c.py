"""Exact marker/frame constraints and Source-declared question transport."""
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from .articulated_solving_contracts_c import ArticulatedPassiveGoalRowsC


def prepare_articulated_pose_questions(value):
    measured=value.measured
    request=measured.frozen_input
    if measured.missing_refs or request.native_request.state is None:
        return ArticulatedPassiveGoalRowsC(rows=())
    bodies={body.body_ref:body for body in request.native_request.state.bodies}
    rows=[]
    work=len(bodies)+len(request.marker_targets)
    for ref in sorted(bodies):
        body=bodies[ref]
        targets=tuple(target for target in request.marker_targets if target.body_ref==ref)
        work+=len(request.marker_targets)
        if not targets:continue
        offsets=dict(body.marker_offsets)
        constraints=[]
        for target in targets:
            work+=3
            if target.marker_ref not in offsets:continue
            offset=offsets[target.marker_ref]
            constraints.append(FrozenMap({"marker_ref":target.marker_ref,"local_offset":offset,
                "world_position":target.world_position,"position_support_claim_ref":target.acquisition.binding.support_claim_ref,
                "coordinate_equations":tuple(FrozenMap({"coordinate_index":axis,
                    "translation_coefficient":(1,1),"linear_column_coefficients":offset,
                    "required_value":target.world_position[axis]}) for axis in (0,1))}))
        ancestors=[]
        current=body
        while current.parent_ref is not None and len(ancestors)<len(bodies):
            work+=1
            ancestors.append(current.parent_ref)
            current=bodies[current.parent_ref]
        population=(ref,*ancestors)
        channels=tuple(sorted({channel for owner in population for channel in bodies[owner].channel_refs}))
        links=tuple(relation.support_claim_ref for relation in request.relations
            if relation.kind=="DIRECTED_ATTACHMENT" and relation.destination_ref in population)
        evidence=tuple(sorted({request.complete_marker_population.binding.support_claim_ref,
            *links,*(target.acquisition.binding.support_claim_ref for target in targets)}))
        work+=len(population)+len(request.relations)+len(request.restorations)+len(targets)
        rows.append(FrozenMap({"projection_ref":stable_digest((request.demand,ref,tuple(constraints))),
            "parent_goal_ref":request.why.parent_goal_ref,"body_ref":ref,
            "marker_constraints":tuple(constraints),"constraint_count":len(constraints),
            "marker_population_complete":len(constraints)==len(targets),
            "ancestor_body_refs":tuple(ancestors),"available_ancestor_channel_refs":channels,
            "attachment_support_claim_refs":links,"principal_desired_future":request.why.desired_future,
            "utility_reason_ref":request.why.utility_reason_ref,"frozen_why":immutable_json_data(request.why),
            "preservation_refs":request.why.preservation_refs,"falsifier_ref":request.why.falsifier_ref,
            "restoration_targets":tuple(FrozenMap({"body_ref":target.body_ref,"target_ref":target.restoration_target_ref,
                "enabling_dependency_ref":target.enabling_dependency_ref}) for target in request.restorations),
            "question_formation_current":len(constraints)==len(targets),"evidence_refs":evidence,
            "existing_term_refs":(request.why.parent_goal_ref,),"unique_mathematical_pose_asserted":False}))
    return ArticulatedPassiveGoalRowsC(rows=tuple(rows),accounted_evaluations=work)


def attach_articulated_pose_questions(value):
    measured=value.measured
    work=value.rows.accounted_evaluations
    request=measured.frozen_input
    missing=list(measured.missing_refs)
    prior=sum(row.get("publication_work",0) for row in measured.reasons)+sum(
        row["actual_angle_pair"]["examined_count"] for row in measured.reasons if "actual_angle_pair" in row)+sum(
        row["observed_world_geometry"]["examined_count"]+row["native_geometry_comparison"]["examined_count"]
        for row in measured.reasons if "observed_world_geometry" in row)
    if prior+work+request.native_request.maximum_evaluations>request.parent_maximum_evaluations:
        missing.append("articulated.pose_question_parent_work_bound")
    return measured.model_copy(update={"pose_question_receipts":value.meanings,"pose_question_work":work,
        "missing_refs":tuple(sorted(set(missing))),"facts":FrozenMap({"current_articulated_question":not bool(missing)}),
        "reasons":(*measured.reasons,*value.meanings)})
