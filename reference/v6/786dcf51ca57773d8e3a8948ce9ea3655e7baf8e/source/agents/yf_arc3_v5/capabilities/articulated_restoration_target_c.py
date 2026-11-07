"""Join observed aligned markers to the complete available clearance controls."""
from fractions import Fraction
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data,stable_digest
from ..drm.meaning import DeclaredMeaningInstantiation
from .articulated_solving_contracts_c import ArticulatedPassiveGoalRowsC
from .articulated_indirect_domain_c import derive_articulated_indirect_domains


def prepare_articulated_restoration_targets(value):
    measured=value.measured
    request=measured.frozen_input
    state,model=request.native_request.state,request.native_request.model
    blockers=tuple(row for row in measured.reasons if "ancestor_intervention_options" in row)
    if measured.missing_refs or not blockers:return ArticulatedPassiveGoalRowsC(rows=())
    geometry=tuple(row for row in measured.reasons if "observed_world_geometry" in row and row.get("current")
        and row["observed_world_geometry"].get("geometry_current") is True
        and row["native_geometry_comparison"].get("geometry_matches_native_state") is True)
    if state is None or model is None or len(geometry)!=1:
        return ArticulatedPassiveGoalRowsC(rows=(),missing_refs=("articulated.restoration_current_observed_geometry",))
    domains,debt=derive_articulated_indirect_domains(request,measured.reasons)
    if debt:return ArticulatedPassiveGoalRowsC(rows=(),missing_refs=debt)
    bodies={body.body_ref:body for body in state.bodies}
    controls={control.primitive_ref:control for control in request.route_control_domain.controls}
    options=tuple((domain,option) for domain in domains for option in domain["admissible_intervention_domain"])
    work=(len(options)*(2*len(bodies)**2+len(request.marker_targets)+len(model.attachments))
        +len(bodies)+len(controls)+len(request.marker_targets)
        +sum(len(row["ancestor_intervention_options"])*len(controls) for row in blockers))
    # Reserve the complete join before deriving any conclusion; no partial credit.
    prior=measured.pose_question_work+sum(row.get("publication_work",0) for row in measured.reasons)+sum(
        row["observed_world_geometry"]["examined_count"]+row["native_geometry_comparison"]["examined_count"]
        for row in measured.reasons if "observed_world_geometry" in row)+sum(
        row["actual_angle_pair"]["examined_count"] for row in measured.reasons if "actual_angle_pair" in row)
    if prior+work+request.native_request.maximum_evaluations>request.parent_maximum_evaluations:
        return ArticulatedPassiveGoalRowsC(rows=(),missing_refs=("articulated.restoration_target_parent_work_bound",))
    observed={(row["body_ref"],marker):position for row in geometry[0]["observed_world_geometry"]["rows"]
        for marker,position in row["world_marker_positions"]}
    # All directed child frames inherit their parent's frame. follows_free_end
    # additionally transports an extent edit; it does not gate frame rotation.
    links=tuple((link.parent_ref,link.child_ref) for link in model.attachments)
    rows=[]
    for domain,option in options:
        control=controls[option["primitive_ref"]]
        affected={control.root_body_ref} if control.kind=="ROOTED_SUBCHAIN" else {
            ref for ref,body in sorted(bodies.items()) if control.channel_ref in body.channel_refs}
        for _ in range(len(bodies)):
            propagated={child for parent,child in links if parent in affected}
            if propagated<=affected:break
            affected.update(propagated)
        for target in request.marker_targets:
            position=observed.get((target.body_ref,target.marker_ref))
            aligned=(position is not None and tuple(Fraction(v) for v in position)==tuple(
                Fraction(*v) for v in target.world_position))
            if target.body_ref not in affected or not aligned:continue
            if len(rows)>=128:
                return ArticulatedPassiveGoalRowsC(rows=tuple(rows),accounted_evaluations=work,
                    remaining_count=1,missing_refs=("articulated.restoration_target_projection_bound",))
            rows.append(FrozenMap({"projection_ref":stable_digest((request.demand,domain["dependency_ref"],domain["passive_blocker_ref"],
                control.primitive_ref,target.body_ref,target.marker_ref)),"parent_goal_ref":request.why.parent_goal_ref,
                "dependency_ref":domain["dependency_ref"],"body_ref":target.body_ref,"marker_ref":target.marker_ref,
                "world_position":target.world_position,"primitive_ref":control.primitive_ref,"input_ref":control.input_ref,
                "affected_body_refs":tuple(sorted(affected)),"passive_blocker_ref":domain["passive_blocker_ref"],
                "observed_frame_ref":geometry[0]["observed_world_geometry"]["frame_ref"],
                "initial_alignment_observed":aligned,"clearance_control_affects_contributor":True,
                "influence_is_provisional_frame_dependency":True,"actual_alignment_loss_observed":False,
                "question_formation_current":True,"frozen_why":immutable_json_data(request.why),
                "native_scope":immutable_json_data(request.native_request.scope),
                "preservation_refs":request.why.preservation_refs,"principal_desired_future":request.why.desired_future,
                "falsifier_ref":request.why.falsifier_ref,"evidence_refs":tuple(sorted({
                    target.acquisition.binding.support_claim_ref,*option["support_claim_refs"],
                    geometry[0]["observed_world_geometry"]["observation_record_ref"]})),
                "existing_term_refs":(request.why.parent_goal_ref,)}))
    return ArticulatedPassiveGoalRowsC(rows=tuple(rows),accounted_evaluations=work)


def attach_articulated_restoration_targets(value):
    measured=value.measured
    missing=list((*measured.missing_refs,*value.rows.missing_refs))
    actual=[]
    for receipt in value.meanings:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):
            missing.append("articulated.restoration_target_typed_meaning");continue
        expected=next((row for row in value.rows.rows if row["projection_ref"]==meaning.facts.get("projection_ref")),None)
        if (meaning.rule_ref!="rule.articulated_restoration_target_c" or not meaning.template_iteration_complete
                or expected is None or any(meaning.facts.get(key)!=val for key,val in sorted(expected.items()))):
            missing.append("articulated.restoration_target_exact_current_formation");continue
        actual.append(meaning.facts["projection_ref"])
    if len(set(actual))!=len(actual) or set(actual)!={row["projection_ref"] for row in value.rows.rows}:
        missing.append("articulated.restoration_target_complete_formation")
    return measured.model_copy(update={"restoration_target_receipts":value.meanings,
        "restoration_target_work":value.rows.accounted_evaluations,"missing_refs":tuple(sorted(set(missing))),
        "facts":FrozenMap({**dict(measured.facts),"current_articulated_question":not bool(missing)}),
        "reasons":(*measured.reasons,*value.meanings)})


def read_articulated_restoration_targets(request,receipts):
    rows,missing=[],[]
    targets={(target.body_ref,target.marker_ref):target.world_position for target in request.marker_targets}
    for receipt in receipts:
        try:meaning=DeclaredMeaningInstantiation.model_validate(receipt)
        except (ValidationError,TypeError,ValueError):
            missing.append("articulated.restoration_target_typed_receipt");continue
        row=meaning.facts
        if (meaning.rule_ref!="rule.articulated_restoration_target_c" or not meaning.template_iteration_complete
                or row.get("frozen_why")!=immutable_json_data(request.why)
                or row.get("native_scope")!=immutable_json_data(request.native_request.scope)
                or row.get("parent_goal_ref")!=request.why.parent_goal_ref
                or row.get("dependency_ref") not in request.prerequisite_clearance_refs
                or row.get("initial_alignment_observed") is not True
                or row.get("clearance_control_affects_contributor") is not True
                or (row.get("body_ref"),row.get("marker_ref")) not in targets
                or targets.get((row.get("body_ref"),row.get("marker_ref")))!=row.get("world_position")):
            missing.append("articulated.restoration_target_current_marker_relation");continue
        rows.append(row)
    return tuple(rows),tuple(sorted(set(missing)))
