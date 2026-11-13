"""Bind useful-prefix questions to their actual after-state and named dependency."""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyResult
from .mechanical_return_a import mechanical_request_identity_a
from .articulated_solving_contracts_c import ArticulatedClearanceRowsC,ArticulatedClearancePreparedC
from .articulated_channel_kinematics import _arti_work


def prepare_articulated_clearance(value):
    returned=value.returned
    request=returned.frozen_measurement.frozen_input
    native=request.native_request
    domain=returned.native_result.values.get("articulated_candidate_domain",()) if returned.native_result else ()
    preparations,missing=[],[]
    work=returned.accounted_evaluations
    for witness in request.clearance_witnesses:
        matches=tuple(row for row in domain if row.get("candidate_ref")==witness.candidate_ref)
        question=witness.clearance_request
        if (len(matches)!=1 or question.state is None or question.model!=native.model
                or immutable_json_data(question.state)!=matches[0].get("after_state")
                or question.operation_ref!="mechanics.articulated_channel_kinematics.successor"
                or question.mode!="STEP" or question.step is None
                or question.resume is not None
                or question.step.before_bodies!=question.state.bodies
                or question.source_identity_ref!=native.source_identity_ref
                or witness.enabling_dependency_ref not in request.prerequisite_clearance_refs
                or any(getattr(question.scope,key)!=getattr(native.scope,key) for key in (
                    "parent_goal_ref","epoch","evidence_revision_ref","model_revision_ref","model_status_ref","event_owner_ref"))):
            missing.append("articulated.clearance_exact_after_state_model_and_dependency");continue
        required_work=_arti_work(question.state,question.step)
        if (required_work>question.maximum_evaluations
                or work+required_work>request.parent_maximum_evaluations):
            missing.append("articulated.global_clearance_budget_reached");break
        work+=required_work
        preparations.append(ArticulatedClearancePreparedC(witness_ref=witness.witness_ref,
            candidate_ref=witness.candidate_ref,enabling_dependency_ref=witness.enabling_dependency_ref,
            native_request=question))
    if len({p.witness_ref for p in preparations})!=len(preparations):
        missing.append("articulated.unique_clearance_witness_population")
    return ArticulatedClearanceRowsC(preparations=tuple(preparations),rows=(),
        missing_refs=tuple(sorted(set(missing))),accounted_evaluations=work)


def append_articulated_clearance(value):
    prepared,returned,prior=value.prepared,value.returned,value.prior
    native=prepared.native_request
    identity=mechanical_request_identity_a(native,"mechanics.articulated_channel_kinematics",
        native.scope,native.operation_ref,native.mode)
    missing=list(prior.missing_refs)
    result=None
    if prepared not in prior.preparations or returned.request!=identity:
        missing.append("articulated.clearance_exact_prepared_return")
    else:
        try: result=MechanicalFamilyResult.model_validate(returned.descriptive_values.get("calculation"))
        except (ValidationError,TypeError,ValueError):missing.append("articulated.clearance_native_packet")
    exact=result is not None and result.scope==native.scope and result.operation_ref==native.operation_ref and result.mode==native.mode
    if not exact: missing.append("articulated.clearance_exact_result_scope")
    if exact and result.examined_count>_arti_work(native.state,native.step):
        missing.append("articulated.clearance_reported_work_exceeds_reserved_native_work")
    resolved=exact and result.domain_complete and not result.prerequisite_refs and not result.computation_bound_reached
    events=result.values.get("joint_events",()) if exact else ()
    transactions=tuple(event for event in events if isinstance(event,FrozenMap) and event.get("kind")=="JOINT_ARTICULATED_EDIT")
    admissible=resolved and len(transactions)==1 and transactions[0].get("committed") is True
    contacts=tuple(contact for event in events if isinstance(event,FrozenMap) for contact in event.get("contacts",()))
    row=FrozenMap({"witness_ref":prepared.witness_ref,"candidate_ref":prepared.candidate_ref,
        "enabling_dependency_ref":prepared.enabling_dependency_ref,
        "dependent_edit_admissible":bool(admissible) if resolved else None,
        "remaining_limiting_contacts":contacts,
        "model_domain_complete":bool(resolved),"physical_dependency_satisfied":False,
        "parent_goal_kept_open":True,"current_observation_required_before_dependency_satisfaction":True,
        "missing_refs":result.prerequisite_refs if exact else ()})
    if len(prior.rows)>=128 or any(r["witness_ref"]==prepared.witness_ref for r in prior.rows):
        missing.append("articulated.clearance_unique_bounded_rows")
        return prior.model_copy(update={"missing_refs":tuple(sorted(set(missing)))})
    return prior.model_copy(update={"rows":(*prior.rows,row),"missing_refs":tuple(sorted(set(missing)))})


def seal_articulated_clearance(value):
    returned,clearance=value.returned,value.clearance
    missing=tuple(sorted(set((*returned.missing_refs,*clearance.missing_refs))))
    if {p.witness_ref for p in clearance.preparations}!={r["witness_ref"] for r in clearance.rows}:
        missing=tuple(sorted(set((*missing,"articulated.all_prepared_clearances_returned"))))
    if missing:
        parent_note=FrozenMap({"parent_goal_ref":returned.frozen_measurement.frozen_input.why.parent_goal_ref,
            "remaining_clearance_missing_refs":missing,"parent_goal_kept_open":True})
        reasons=(*returned.reasons,*clearance.rows,parent_note)
    else: reasons=(*returned.reasons,*clearance.rows)
    return returned.model_copy(update={"reasons":reasons,"missing_refs":missing,
        "accounted_evaluations":clearance.accounted_evaluations})
