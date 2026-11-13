"""Exact collision-to-ancestor relation queries; DRM owns any subgoal selection."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,stable_digest,immutable_json_data
from .articulated_solving_contracts_c import ArticulatedPassiveGoalRowsC,ArticulatedPassiveMeaningRowsC,ArticulatedPassiveGoalInputC
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_return_a import mechanical_request_identity_a


def measure_articulated_passive_blockers(request):
    native=request.native_request
    rows,missing=[],[]
    for blocked in request.blocked_edits:
        question,returned=blocked.native_request,blocked.native_return
        identity=mechanical_request_identity_a(question,"mechanics.articulated_channel_kinematics",
            question.scope,question.operation_ref,question.mode)
        if (question.state is None or question.model is None or question.state!=native.state or question.model!=native.model or question.step is None
                or question.operation_ref!="mechanics.articulated_channel_kinematics.successor" or question.mode!="STEP"
                or returned.request!=identity or blocked.dependency_ref not in request.prerequisite_clearance_refs
                or any(getattr(question.scope,key)!=getattr(native.scope,key) for key in (
                    "parent_goal_ref","epoch","evidence_revision_ref","model_revision_ref","model_status_ref","event_owner_ref"))):
            missing.append("articulated.passive_exact_blocked_edit_parent_scope");continue
        try:result=MechanicalFamilyResult.model_validate(returned.descriptive_values.get("calculation"))
        except (ValidationError,TypeError,ValueError):
            missing.append("articulated.passive_actual_blocked_native_packet");continue
        if (result.scope!=question.scope or result.operation_ref!=question.operation_ref or result.mode!=question.mode
                or not result.domain_complete or result.prerequisite_refs or result.computation_bound_reached):
            missing.append("articulated.passive_complete_current_blocked_result");continue
        if not result.signature_supported or result.implementation_debt_refs:
            missing.append("articulated.passive_supported_native_signature");continue
        events=result.values.get("joint_events",())
        blockers=set()
        for event in events:
            if isinstance(event,FrozenMap) and event.get("committed") is False:
                for contact in event.get("contacts",()):
                    if (isinstance(contact,tuple) and len(contact)>=2
                            and all(isinstance(ref,str) for ref in contact[:2])):blockers.update(contact[:2])
                    else:missing.append("articulated.passive_typed_contact_identity")
        state=question.state
        bodies={body.body_ref:body for body in state.bodies}
        passive={mask.body_ref for mask in state.masks if mask.passive}
        for ref in sorted(blockers&passive):
            ancestor=bodies[ref].parent_ref
            chain=[]
            options=[]
            while ancestor is not None and len(chain)<len(bodies):
                chain.append(ancestor)
                body=bodies[ancestor]
                supports=tuple(relation.support_claim_ref for relation in request.relations
                    if relation.kind=="CONTROL_CHANNEL" and relation.destination_ref==ancestor
                    and relation.origin_ref in body.channel_refs)
                if body.channel_refs and supports:
                    options.append(FrozenMap({"ancestor_body_ref":ancestor,"channel_refs":body.channel_refs,
                        "control_support_claim_refs":supports,"directed_chain":tuple(chain)}))
                ancestor=body.parent_ref
            rows.append(FrozenMap({"dependency_ref":blocked.dependency_ref,"passive_blocker_ref":ref,
                "blocked_input_ref":question.step.input_ref,"ancestor_intervention_options":tuple(options),
                "direct_passive_control_inferred":False,"collision_mask_retained":True,
                "restoration_target_refs":tuple(r.restoration_target_ref for r in request.restorations
                    if r.body_ref in chain),"physical_clearance_observed":False}))
    return tuple(rows),tuple(sorted(set(missing)))


def prepare_articulated_passive_goals(value):
    measured=value.measured
    request=measured.frozen_input
    rows=[]
    for reason in measured.reasons:
        if "ancestor_intervention_options" not in reason:continue
        supports=tuple(sorted({ref for option in reason["ancestor_intervention_options"]
            for ref in option["control_support_claim_refs"]}))
        rows.append(FrozenMap({**dict(reason),"parent_goal_ref":request.why.parent_goal_ref,
            "projection_ref":stable_digest((request.demand,reason)),
            "question_ref":request.why.question_ref,"frozen_why":immutable_json_data(request.why),
            "preservation_refs":request.why.preservation_refs,"falsifier_ref":request.why.falsifier_ref,
            "indirect_options_present":bool(reason["ancestor_intervention_options"]),
            "goal_formation_current":bool(reason["ancestor_intervention_options"]) and not bool(measured.missing_refs),
            "parent_question_current":not bool(measured.missing_refs),
            "evidence_refs":supports,"existing_term_refs":(request.why.parent_goal_ref,)}))
    return ArticulatedPassiveGoalRowsC(rows=tuple(rows[:32]),remaining_count=max(0,len(rows)-32))


def attach_articulated_passive_meanings(value):
    missing=list(value.measured.missing_refs)
    if sum("ancestor_intervention_options" in row for row in value.measured.reasons)>32:
        missing.append("articulated.passive_goal_projection_bound_with_retained_parent_frontier")
    for row in value.measured.reasons:
        if "ancestor_intervention_options" in row and not row["ancestor_intervention_options"]:
            missing.append("articulated.passive_blocker_has_no_current_indirect_control."+row["passive_blocker_ref"])
    return value.measured.model_copy(update={"reasons":(*value.measured.reasons,*value.meanings),
        "missing_refs":tuple(sorted(set(missing))),"facts":FrozenMap({**dict(value.measured.facts),
            "current_articulated_question":not bool(missing)})})


def append_articulated_passive_meaning(value):
    return ArticulatedPassiveMeaningRowsC(rows=(*value.prior,immutable_json_data(value.meaning)))


def initialize_articulated_passive_meanings(value):
    return ArticulatedPassiveMeaningRowsC(rows=())


def bind_articulated_passive_goal_input(value):
    return ArticulatedPassiveGoalInputC(measured=value.measured)
